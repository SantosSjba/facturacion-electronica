import { createHash, randomBytes } from "node:crypto";

import { Inject, Injectable, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  inviteTokens,
  newId,
  organizations,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";

import type { Env } from "../config/env.schema";
import { Argon2Hasher } from "../crypto/argon2-hasher";
import { NotificationDispatchService } from "../notifications/notification-dispatch.service";
import { InAppNotificationsService } from "../notifications/in-app-notifications.service";
import { DB } from "../persistence/db.tokens";
import type { UserAuthContext } from "../../interfaces/http/auth/auth-context";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

@Injectable()
export class UsersAdminService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly hasher: Argon2Hasher,
    private readonly config: ConfigService<Env, true>,
    @Inject(forwardRef(() => NotificationDispatchService))
    private readonly notifications: NotificationDispatchService,
    @Inject(forwardRef(() => InAppNotificationsService))
    private readonly inApp: InAppNotificationsService,
  ) {}

  async listRoles() {
    const roleRows = await this.db
      .select({
        id: roles.id,
        code: roles.code,
        name: roles.name,
        description: roles.description,
      })
      .from(roles)
      .orderBy(asc(roles.code));

    const result = [];
    for (const role of roleRows) {
      if (role.code.startsWith("platform_")) {
        continue;
      }
      const perms = await this.db
        .select({ code: permissions.code })
        .from(rolePermissions)
        .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
        .where(eq(rolePermissions.roleId, role.id))
        .orderBy(asc(permissions.code));
      result.push({
        ...role,
        permissions: perms.map((p) => p.code),
      });
    }
    return result;
  }

  async listUsers(organizationId: string) {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.organizationId, organizationId))
      .orderBy(desc(users.createdAt), desc(users.id));

    const result = [];
    for (const u of rows) {
      const ur = await this.db
        .select({ code: roles.code })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(eq(userRoles.userId, u.id));
      result.push({ ...u, roles: ur.map((r) => r.code) });
    }
    return result;
  }

  async createUser(
    actor: UserAuthContext,
    input: {
      email: string;
      name: string;
      password?: string;
      invite?: boolean;
      roleCodes: string[];
      status?: "active" | "disabled";
    },
  ) {
    const invite = Boolean(input.invite);
    if (!invite) {
      if (!input.password || input.password.length < 8) {
        throw AppError.validation("password must be at least 8 characters");
      }
    }
    if (!input.roleCodes.length) {
      throw AppError.validation("roles must not be empty");
    }

    const existing = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.organizationId, actor.organizationId),
          eq(users.email, input.email),
        ),
      )
      .limit(1);
    if (existing[0]) {
      throw AppError.conflict("User email already exists in organization");
    }

    const roleRows = await this.resolveRoles(input.roleCodes);
    this.assertCanAssignRoles(actor, input.roleCodes);

    const orgRows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, actor.organizationId))
      .limit(1);
    const org = orgRows[0];
    if (!org) {
      throw AppError.notFound("Organization not found");
    }

    const id = newId();
    const now = new Date();

    if (invite) {
      const inviteId = newId();
      const inviteRaw = randomBytes(32).toString("base64url");
      const ttlHours = this.config.get("INVITE_TOKEN_TTL_HOURS", { infer: true });
      const inviteExpiresAt = new Date(now.getTime() + ttlHours * 3600_000);
      const placeholderPassword = await this.hasher.hash(
        randomBytes(32).toString("base64url"),
      );

      await this.db.insert(users).values({
        id,
        organizationId: actor.organizationId,
        email: input.email,
        name: input.name,
        passwordHash: placeholderPassword,
        status: "disabled",
        createdAt: now,
        updatedAt: now,
      });
      await this.db.insert(userRoles).values(
        roleRows.map((r) => ({ userId: id, roleId: r.id })),
      );
      await this.db.insert(inviteTokens).values({
        id: inviteId,
        userId: id,
        tokenHash: sha256Hex(inviteRaw),
        expiresAt: inviteExpiresAt,
        consumedAt: null,
        createdAt: now,
      });

      await this.notifications.memberInvite({
        inviteId,
        userId: id,
        contactName: input.name,
        contactEmail: input.email,
        organizationName: org.name,
        organizationSlug: org.slug ?? "",
        inviteToken: inviteRaw,
        expiresAt: inviteExpiresAt,
      });

      await this.inApp.createForUser({
        organizationId: actor.organizationId,
        userId: actor.userId,
        eventCode: "invite.member",
        title: "Invitación enviada",
        body: `Se envió una invitación a ${input.email}.`,
        payload: { invited_user_id: id, invited_email: input.email },
      });

      return {
        id,
        email: input.email,
        name: input.name,
        status: "disabled" as const,
        roles: input.roleCodes,
        invited: true,
      };
    }

    const passwordHash = await this.hasher.hash(input.password!);
    await this.db.insert(users).values({
      id,
      organizationId: actor.organizationId,
      email: input.email,
      name: input.name,
      passwordHash,
      status: input.status ?? "active",
    });
    await this.db.insert(userRoles).values(
      roleRows.map((r) => ({ userId: id, roleId: r.id })),
    );

    return {
      id,
      email: input.email,
      name: input.name,
      status: input.status ?? "active",
      roles: input.roleCodes,
      invited: false,
    };
  }

  async updateUser(
    actor: UserAuthContext,
    userId: string,
    input: {
      name?: string;
      status?: "active" | "disabled";
      password?: string;
    },
  ) {
    const target = await this.getOrgUser(actor.organizationId, userId);
    if (input.status === "disabled") {
      await this.assertNotLastOwner(actor.organizationId, userId);
    }

    const patch: {
      name?: string;
      status?: string;
      passwordHash?: string;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.status !== undefined) patch.status = input.status;
    if (input.password !== undefined) {
      if (input.password.length < 8) {
        throw AppError.validation("password must be at least 8 characters");
      }
      patch.passwordHash = await this.hasher.hash(input.password);
    }

    await this.db.update(users).set(patch).where(eq(users.id, target.id));
    return this.getUserDetail(actor.organizationId, userId);
  }

  async assignRoles(
    actor: UserAuthContext,
    userId: string,
    roleCodes: string[],
  ) {
    if (!roleCodes.length) {
      throw AppError.validation("roles must not be empty");
    }
    await this.getOrgUser(actor.organizationId, userId);
    this.assertCanAssignRoles(actor, roleCodes);
    const roleRows = await this.resolveRoles(roleCodes);

    const current = await this.db
      .select({ code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, userId));
    const hadOwner = current.some((r) => r.code === "owner");
    const willHaveOwner = roleCodes.includes("owner");
    if (hadOwner && !willHaveOwner) {
      await this.assertNotLastOwner(actor.organizationId, userId);
    }

    await this.db.delete(userRoles).where(eq(userRoles.userId, userId));
    await this.db.insert(userRoles).values(
      roleRows.map((r) => ({ userId, roleId: r.id })),
    );
    return this.getUserDetail(actor.organizationId, userId);
  }

  private assertCanAssignRoles(actor: UserAuthContext, roleCodes: string[]) {
    const elevated = actor.roles.includes("owner") || actor.roles.includes("admin");
    if (!elevated) {
      throw AppError.forbidden("Only owner/admin can assign roles");
    }
    if (roleCodes.includes("owner") && !actor.roles.includes("owner")) {
      throw AppError.forbidden("Only owner can assign the owner role");
    }
    if (roleCodes.some((c) => c.startsWith("platform_"))) {
      throw AppError.forbidden("Platform roles cannot be assigned via org users API");
    }
  }

  private async resolveRoles(codes: string[]) {
    const roleRows = await this.db
      .select()
      .from(roles)
      .where(inArray(roles.code, codes));
    if (roleRows.length !== codes.length) {
      const found = new Set(roleRows.map((r) => r.code));
      const missing = codes.filter((c) => !found.has(c));
      throw AppError.validation(`Unknown roles: ${missing.join(", ")}`);
    }
    return roleRows;
  }

  private async getOrgUser(organizationId: string, userId: string) {
    const rows = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, organizationId)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw AppError.notFound("User not found");
    }
    return row;
  }

  private async getUserDetail(organizationId: string, userId: string) {
    const u = await this.getOrgUser(organizationId, userId);
    const ur = await this.db
      .select({ code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, userId));
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      roles: ur.map((r) => r.code),
    };
  }

  private async assertNotLastOwner(organizationId: string, userId: string) {
    const ownerCount = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(roles.code, "owner"),
          eq(users.status, "active"),
        ),
      );
    const count = Number(ownerCount[0]?.count ?? 0);
    const targetIsOwner = await this.db
      .select({ code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(userRoles.userId, userId), eq(roles.code, "owner")))
      .limit(1);
    if (targetIsOwner.length > 0 && count <= 1) {
      throw AppError.conflict("Cannot remove or disable the last owner");
    }
  }
}

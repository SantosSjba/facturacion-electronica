import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  newId,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";

import { Argon2Hasher } from "../crypto/argon2-hasher";
import { DB } from "../persistence/db.tokens";
import { withPlanCapacity } from "../saas/plan-capacity";
import type { UserAuthContext } from "../../interfaces/http/auth/auth-context";

@Injectable()
export class UsersAdminService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly hasher: Argon2Hasher,
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
      password: string;
      roleCodes: string[];
      status?: "active" | "disabled";
    },
  ) {
    if (input.password.length < 8)
      throw AppError.validation("password must be at least 8 characters");
    if (!input.roleCodes.length) throw AppError.validation("roles must not be empty");
    const roleRows = await this.resolveRoles(input.roleCodes);
    this.assertCanAssignRoles(actor, input.roleCodes);
    const passwordHash = await this.hasher.hash(input.password);
    const id = newId();
    await withPlanCapacity(this.db, actor.organizationId, "users", async (tx) => {
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.organizationId, actor.organizationId), eq(users.email, input.email)))
        .limit(1);
      if (existing) throw AppError.conflict("User email already exists in organization");
      await tx
        .insert(users)
        .values({
          id,
          organizationId: actor.organizationId,
          email: input.email,
          name: input.name,
          passwordHash,
          status: input.status ?? "active",
        });
      await tx.insert(userRoles).values(roleRows.map((r) => ({ userId: id, roleId: r.id })));
    });
    return this.getUserDetail(actor.organizationId, id);
  }

  async updateUser(
    actor: UserAuthContext,
    userId: string,
    input: {
      name?: string;
      status?: "active" | "disabled";
      password?: string;
      roleCodes?: string[];
    },
  ) {
    const roleRows = input.roleCodes ? await this.resolveRoles(input.roleCodes) : undefined;
    if (input.roleCodes) {
      if (!input.roleCodes.length) throw AppError.validation("roles must not be empty");
      this.assertCanAssignRoles(actor, input.roleCodes);
    }
    if (input.password !== undefined && input.password.length < 8)
      throw AppError.validation("password must be at least 8 characters");
    const passwordHash =
      input.password === undefined ? undefined : await this.hasher.hash(input.password);
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from organizations where id = ${actor.organizationId} for update`,
      );
      const target = await this.getOrgUser(actor.organizationId, userId);
      const targetRoles = await tx
        .select({ code: roles.code })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(eq(userRoles.userId, userId));
      if (targetRoles.some((r) => r.code.startsWith("platform_")))
        throw AppError.forbidden("Platform users cannot be managed via organization users API");
      if (input.status === "disabled" || (input.roleCodes && !input.roleCodes.includes("owner"))) {
        await this.assertNotLastOwner(actor.organizationId, userId);
      }
      await tx
        .update(users)
        .set({ name: input.name, status: input.status, passwordHash, updatedAt: new Date() })
        .where(eq(users.id, target.id));
      if (roleRows) {
        await tx.delete(userRoles).where(eq(userRoles.userId, userId));
        await tx.insert(userRoles).values(roleRows.map((r) => ({ userId, roleId: r.id })));
      }
    });
    return this.getUserDetail(actor.organizationId, userId);
  }

  async assignRoles(actor: UserAuthContext, userId: string, roleCodes: string[]) {
    return this.updateUser(actor, userId, { roleCodes });
  }

  private assertCanAssignRoles(actor: UserAuthContext, roleCodes: string[]) {
    const platformAdmin = actor.ctx === "platform" && actor.permissions.includes("platform:admin");
    const elevated =
      platformAdmin || actor.roles.includes("owner") || actor.roles.includes("admin");
    if (!elevated) {
      throw AppError.forbidden("Only owner/admin can assign roles");
    }
    if (roleCodes.includes("owner") && !actor.roles.includes("owner") && !platformAdmin) {
      throw AppError.forbidden("Only owner can assign the owner role");
    }
    if (roleCodes.some((c) => c.startsWith("platform_"))) {
      throw AppError.forbidden("Platform roles cannot be assigned via org users API");
    }
  }

  private async resolveRoles(codes: string[]) {
    const roleRows = await this.db.select().from(roles).where(inArray(roles.code, codes));
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

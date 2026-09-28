import { createHash, randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { and, eq, inArray, isNull, gt } from "drizzle-orm";
import {
  inviteTokens,
  isPlatformRole,
  newId,
  organizations,
  permissions,
  refreshTokens,
  rolePermissions,
  roles,
  userRoles,
  users,
  type Db,
} from "@factosys/db";
import { AppError } from "@factosys/shared";

import type { Env } from "../config/env.schema";
import { Argon2Hasher } from "../crypto/argon2-hasher";
import { DB } from "../persistence/db.tokens";
import type {
  AuthCtx,
  UserAuthContext,
} from "../../interfaces/http/auth/auth-context";
import { sha256Hex } from "../api-keys/api-key.service";
import { RateLimitService } from "../redis/rate-limit.service";

function hashInviteToken(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export interface AccessTokenPayload {
  sub: string;
  org: string;
  email: string;
  perms: string[];
  roles: string[];
  ctx: AuthCtx;
  typ: "access";
  /** Support impersonation claim (S17-SEC). */
  imp?: {
    reason: string;
    actor_user_id: string;
  };
}

export interface LoginOrganizationOption {
  id: string;
  slug: string | null;
  name: string;
}

export type LoginResult =
  | {
      kind: "tokens";
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }
  | {
      kind: "org_selection";
      organizations: LoginOrganizationOption[];
    };

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly hasher: Argon2Hasher,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly rateLimit: RateLimitService,
  ) {}

  async login(input: {
    email: string;
    password: string;
    organizationSlug?: string;
    organizationId?: string;
  }): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
    await this.rateLimit.consumeLogin(email);
    const hasOrgHint = Boolean(input.organizationSlug || input.organizationId);

    if (hasOrgHint) {
      const org = await this.resolveOrg(
        input.organizationSlug,
        input.organizationId,
      );
      const userRows = await this.db
        .select()
        .from(users)
        .where(and(eq(users.organizationId, org.id), eq(users.email, email)))
        .limit(1);
      const user = userRows[0];
      if (!user || user.status !== "active") {
        throw AppError.unauthorized("Invalid credentials");
      }
      const ok = await this.hasher.verify(user.passwordHash, input.password);
      if (!ok) {
        throw AppError.unauthorized("Invalid credentials");
      }
      return this.completeLogin(user);
    }

    // Email + password only: discover orgs where credentials match.
    const candidates = await this.db
      .select({
        user: users,
        orgId: organizations.id,
        orgSlug: organizations.slug,
        orgName: organizations.name,
        orgStatus: organizations.status,
      })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.organizationId))
      .where(and(eq(users.email, email), eq(users.status, "active")));

    const matched: {
      user: typeof users.$inferSelect;
      org: LoginOrganizationOption;
    }[] = [];

    for (const row of candidates) {
      if (row.orgStatus !== "active") continue;
      const ok = await this.hasher.verify(row.user.passwordHash, input.password);
      if (!ok) continue;
      matched.push({
        user: row.user,
        org: {
          id: row.orgId,
          slug: row.orgSlug,
          name: row.orgName,
        },
      });
    }

    if (matched.length === 0) {
      throw AppError.unauthorized("Invalid credentials");
    }
    const only = matched[0];
    if (matched.length === 1 && only) {
      return this.completeLogin(only.user);
    }

    return {
      kind: "org_selection",
      organizations: matched.map((m) => m.org),
    };
  }

  private async completeLogin(
    user: typeof users.$inferSelect,
  ): Promise<Extract<LoginResult, { kind: "tokens" }>> {
    const { permissions: perms, roles: roleCodes } = await this.loadUserAuth(
      user.id,
    );

    await this.db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    const tokens = await this.issueTokens({
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      permissions: perms,
      roles: roleCodes,
    });
    return { kind: "tokens", ...tokens };
  }

  /**
   * Rotate refresh token: revoke the presented token and issue a new pair.
   * Reusing a revoked/rotated refresh token yields 401.
   */
  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    return this.rotateRefreshToken(refreshToken);
  }

  /** Explicit refresh-token rotation (FE-368). */
  async rotateRefreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const tokenHash = sha256Hex(refreshToken);
    const rows = await this.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw AppError.unauthorized("Invalid refresh token");
    }

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));

    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);
    const user = userRows[0];
    if (!user || user.status !== "active") {
      throw AppError.unauthorized("Invalid refresh token");
    }

    const { permissions: perms, roles: roleCodes } = await this.loadUserAuth(
      user.id,
    );

    return this.issueTokens({
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      permissions: perms,
      roles: roleCodes,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = sha256Hex(refreshToken);
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
  }

  async buildUserContext(userId: string): Promise<UserAuthContext> {
    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const user = userRows[0];
    if (!user || user.status !== "active") {
      throw AppError.unauthorized("User inactive");
    }
    const { permissions: perms, roles: roleCodes } = await this.loadUserAuth(
      user.id,
    );
    return {
      kind: "user",
      organizationId: user.organizationId,
      userId: user.id,
      email: user.email,
      permissions: perms,
      roles: roleCodes,
      ctx: this.resolveAuthCtx(roleCodes),
    };
  }

  async getMe(userId: string) {
    const userRows = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        status: users.status,
        organizationId: users.organizationId,
        orgSlug: organizations.slug,
        orgName: organizations.name,
      })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.organizationId))
      .where(eq(users.id, userId))
      .limit(1);
    const row = userRows[0];
    if (!row || row.status !== "active") {
      throw AppError.unauthorized("User inactive");
    }
    const { permissions: perms, roles: roleCodes } = await this.loadUserAuth(
      row.id,
    );
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      organization_id: row.organizationId,
      organization_slug: row.orgSlug,
      organization_name: row.orgName,
      roles: roleCodes,
      permissions: perms,
    };
  }

  async changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const user = userRows[0];
    if (!user || user.status !== "active") {
      throw AppError.unauthorized("User inactive");
    }
    const ok = await this.hasher.verify(
      user.passwordHash,
      input.currentPassword,
    );
    if (!ok) {
      throw AppError.validation("Contraseña actual incorrecta", [
        { path: "current_password", issue: "mismatch" },
      ]);
    }
    if (input.currentPassword === input.newPassword) {
      throw AppError.validation(
        "La nueva contraseña debe ser distinta a la actual",
        [{ path: "new_password", issue: "same_as_current" }],
      );
    }
    const passwordHash = await this.hasher.hash(input.newPassword);
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  /**
   * Accept owner invite: set password + activate user (S14-APR / FE-422).
   */
  async acceptInvite(input: {
    token: string;
    password: string;
  }): Promise<{ organization_slug: string | null; email: string }> {
    const tokenHash = hashInviteToken(input.token.trim());
    const rows = await this.db
      .select({
        invite: inviteTokens,
        user: users,
        orgSlug: organizations.slug,
      })
      .from(inviteTokens)
      .innerJoin(users, eq(users.id, inviteTokens.userId))
      .innerJoin(organizations, eq(organizations.id, users.organizationId))
      .where(eq(inviteTokens.tokenHash, tokenHash))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw AppError.validation("Invite token inválido", [
        { path: "token", issue: "invalid" },
      ]);
    }
    if (row.invite.consumedAt) {
      throw AppError.conflict("Invite token already used");
    }
    if (row.invite.expiresAt.getTime() < Date.now()) {
      throw AppError.validation("Invite token expirado", [
        { path: "token", issue: "expired" },
      ]);
    }

    const now = new Date();
    const passwordHash = await this.hasher.hash(input.password);
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash,
          status: "active",
          updatedAt: now,
        })
        .where(eq(users.id, row.user.id));
      await tx
        .update(inviteTokens)
        .set({ consumedAt: now })
        .where(eq(inviteTokens.id, row.invite.id));
    });

    return {
      organization_slug: row.orgSlug,
      email: row.user.email,
    };
  }

  private resolveAuthCtx(roleCodes: string[]): AuthCtx {
    return roleCodes.some(isPlatformRole) ? "platform" : "org";
  }

  /**
   * Issue a short-lived org-scoped access token for platform support (S17-SEC).
   * No refresh token — session ends when access expires.
   */
  async impersonate(input: {
    actorUserId: string;
    targetOrganizationId: string;
    reason: string;
    ttlMinutes?: number;
  }): Promise<{
    access_token: string;
    expires_in: number;
    organization_id: string;
    organization_name: string;
    reason: string;
  }> {
    const actor = await this.buildUserContext(input.actorUserId);
    if (actor.ctx !== "platform" || !actor.permissions.includes("platform:admin")) {
      throw AppError.forbidden("platform:admin required to impersonate");
    }

    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw AppError.validation("reason must be at least 3 characters", [
        { path: "reason", issue: "Min length 3" },
      ]);
    }

    const ttlMinutes = Math.min(
      Math.max(input.ttlMinutes ?? 15, 1),
      60,
    );

    const orgRows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, input.targetOrganizationId))
      .limit(1);
    const org = orgRows[0];
    if (!org) {
      throw AppError.notFound("Organization not found");
    }
    if (org.slug === "factosys-platform") {
      throw AppError.conflict("Cannot impersonate the platform organization");
    }
    if (org.status !== "active") {
      throw AppError.conflict("Cannot impersonate a suspended organization");
    }

    const ownerPerms = await this.loadRolePermissions("owner");
    const expiresIn = ttlMinutes * 60;
    const payload: AccessTokenPayload = {
      sub: actor.userId,
      org: org.id,
      email: actor.email,
      perms: ownerPerms,
      roles: ["support_impersonation"],
      ctx: "org",
      typ: "access",
      imp: {
        reason,
        actor_user_id: actor.userId,
      },
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get("JWT_ACCESS_SECRET", { infer: true }),
      expiresIn: `${expiresIn}s`,
    });

    return {
      access_token: accessToken,
      expires_in: expiresIn,
      organization_id: org.id,
      organization_name: org.name,
      reason,
    };
  }

  private async loadRolePermissions(roleCode: string): Promise<string[]> {
    const roleRows = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, roleCode))
      .limit(1);
    const role = roleRows[0];
    if (!role) return [];
    const permRows = await this.db
      .select({ code: permissions.code })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(rolePermissions.roleId, role.id));
    return [...new Set(permRows.map((p) => p.code))];
  }

  private async issueTokens(input: {
    userId: string;
    organizationId: string;
    email: string;
    permissions: string[];
    roles: string[];
  }) {
    const expiresIn = this.config.get("JWT_ACCESS_TTL_SEC", { infer: true });
    const ctx = this.resolveAuthCtx(input.roles);
    const payload: AccessTokenPayload = {
      sub: input.userId,
      org: input.organizationId,
      email: input.email,
      perms: input.permissions,
      roles: input.roles,
      ctx,
      typ: "access",
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get("JWT_ACCESS_SECRET", { infer: true }),
      expiresIn: `${expiresIn}s`,
    });

    const refreshRaw = randomBytes(48).toString("base64url");
    const refreshTtl = this.config.get("JWT_REFRESH_TTL_SEC", { infer: true });
    await this.db.insert(refreshTokens).values({
      id: newId(),
      userId: input.userId,
      tokenHash: sha256Hex(refreshRaw),
      expiresAt: new Date(Date.now() + refreshTtl * 1000),
    });

    return { accessToken, refreshToken: refreshRaw, expiresIn };
  }

  private async resolveOrg(slug?: string, id?: string) {
    if (id) {
      const rows = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);
      const org = rows[0];
      if (!org || org.status !== "active") {
        throw AppError.unauthorized("Invalid credentials");
      }
      return org;
    }
    if (slug) {
      const rows = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);
      const org = rows[0];
      if (!org || org.status !== "active") {
        throw AppError.unauthorized("Invalid credentials");
      }
      return org;
    }
    throw AppError.validation("organization_slug or organization_id is required");
  }

  private async loadUserAuth(
    userId: string,
  ): Promise<{ permissions: string[]; roles: string[] }> {
    const roleRows = await this.db
      .select({ roleId: userRoles.roleId, code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, userId));

    const roleCodes = roleRows.map((r) => r.code);
    const roleIds = roleRows.map((r) => r.roleId);
    if (roleIds.length === 0) {
      return { permissions: [], roles: [] };
    }

    const permRows = await this.db
      .select({ code: permissions.code })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(inArray(rolePermissions.roleId, roleIds));

    const permSet = new Set(permRows.map((p) => p.code));
    return { permissions: [...permSet], roles: roleCodes };
  }
}

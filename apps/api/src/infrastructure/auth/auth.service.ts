import { randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { and, eq, inArray, isNull, gt } from "drizzle-orm";
import {
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
import type { UserAuthContext } from "../../interfaces/http/auth/auth-context";
import { sha256Hex } from "../api-keys/api-key.service";

export interface AccessTokenPayload {
  sub: string;
  org: string;
  email: string;
  perms: string[];
  roles: string[];
  typ: "access";
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly hasher: Argon2Hasher,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(input: {
    email: string;
    password: string;
    organizationSlug?: string;
    organizationId?: string;
  }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const org = await this.resolveOrg(input.organizationSlug, input.organizationId);
    const userRows = await this.db
      .select()
      .from(users)
      .where(and(eq(users.organizationId, org.id), eq(users.email, input.email)))
      .limit(1);
    const user = userRows[0];
    if (!user || user.status !== "active") {
      throw AppError.unauthorized("Invalid credentials");
    }
    const ok = await this.hasher.verify(user.passwordHash, input.password);
    if (!ok) {
      throw AppError.unauthorized("Invalid credentials");
    }

    const { permissions: perms, roles: roleCodes } = await this.loadUserAuth(
      user.id,
    );

    await this.db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return this.issueTokens({
      userId: user.id,
      organizationId: org.id,
      email: user.email,
      permissions: perms,
      roles: roleCodes,
    });
  }

  async refresh(
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
    };
  }

  private async issueTokens(input: {
    userId: string;
    organizationId: string;
    email: string;
    permissions: string[];
    roles: string[];
  }) {
    const expiresIn = this.config.get("JWT_ACCESS_TTL_SEC", { infer: true });
    const payload: AccessTokenPayload = {
      sub: input.userId,
      org: input.organizationId,
      email: input.email,
      perms: input.permissions,
      roles: input.roles,
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

import {
  CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AppError } from "@factosys/shared";
import type { Request } from "express";

import type { Env } from "../../../infrastructure/config/env.schema";
import {
  type AccessTokenPayload,
  AuthService,
} from "../../../infrastructure/auth/auth.service";
import { ApiKeyService } from "../../../infrastructure/api-keys/api-key.service";
import { RateLimitService } from "../../../infrastructure/redis/rate-limit.service";
import {
  AUTH_CONTEXT_KEY,
  type AuthContext,
} from "../auth/auth-context";
import {
  IS_API_KEY_AUTH_KEY,
  REQUIRE_SCOPES_KEY,
} from "../decorators/auth.decorators";

/**
 * Routes marked `@ApiKeyAuth()` accept either:
 * - Bearer API key (scopes via `@RequireScopes`), or
 * - Bearer JWT access token (permissions must cover the same scope strings).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeys: ApiKeyService,
    private readonly rateLimit: RateLimitService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isApiKey = this.reflector.getAllAndOverride<boolean>(IS_API_KEY_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isApiKey) {
      return true;
    }

    const req = context.switchToHttp().getRequest<
      Request & { [AUTH_CONTEXT_KEY]?: AuthContext }
    >();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw AppError.unauthorized("Missing Bearer token");
    }
    const secret = header.slice("Bearer ".length).trim();
    if (!secret) {
      throw AppError.unauthorized("Missing Bearer token");
    }

    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(REQUIRE_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    // Prefer JWT when token looks like one (three base64 segments).
    if (secret.split(".").length === 3) {
      await this.authenticateJwt(req, secret, requiredScopes);
      return true;
    }

    try {
      const auth = await this.apiKeys.authenticate(secret);
      req[AUTH_CONTEXT_KEY] = auth;
      await this.rateLimit.consumeOrg(auth.organizationId);
      if (requiredScopes.length > 0) {
        const have = new Set(auth.scopes);
        const missing = requiredScopes.filter((s) => !have.has(s));
        if (missing.length > 0) {
          throw AppError.forbidden(`Missing scopes: ${missing.join(", ")}`);
        }
      }
      return true;
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Fallback: treat as JWT (opaque keys that happen to have dots are rare).
      await this.authenticateJwt(req, secret, requiredScopes);
      return true;
    }
  }

  private async authenticateJwt(
    req: Request & { [AUTH_CONTEXT_KEY]?: AuthContext },
    token: string,
    requiredScopes: string[],
  ): Promise<void> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get("JWT_ACCESS_SECRET", { infer: true }),
      });
    } catch {
      throw AppError.unauthorized("Invalid access token or API key");
    }
    if (payload.typ !== "access") {
      throw AppError.unauthorized("Invalid access token");
    }
    const auth = await this.authService.buildUserContext(payload.sub);
    if (auth.organizationId !== payload.org) {
      throw AppError.unauthorized("Invalid access token");
    }
    req[AUTH_CONTEXT_KEY] = auth;

    if (requiredScopes.length > 0) {
      const have = new Set(auth.permissions);
      const missing = requiredScopes.filter((s) => !have.has(s));
      if (missing.length > 0) {
        throw AppError.forbidden(`Missing permissions: ${missing.join(", ")}`);
      }
    }
  }
}

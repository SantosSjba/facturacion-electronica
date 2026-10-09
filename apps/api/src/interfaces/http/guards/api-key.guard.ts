import { CanActivate, type ExecutionContext, Injectable, Inject, Optional } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AppError } from "@factosys/shared";
import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { companies, documents, type Db } from "@factosys/db";
import { DB } from "../../../infrastructure/persistence/db.tokens";
import type { ApiKeyAuthContext } from "../auth/auth-context";

import type { Env } from "../../../infrastructure/config/env.schema";
import { type AccessTokenPayload, AuthService } from "../../../infrastructure/auth/auth.service";
import { ApiKeyService } from "../../../infrastructure/api-keys/api-key.service";
import { RateLimitService } from "../../../infrastructure/redis/rate-limit.service";
import { AUTH_CONTEXT_KEY, type AuthContext } from "../auth/auth-context";
import { IS_API_KEY_AUTH_KEY, REQUIRE_SCOPES_KEY } from "../decorators/auth.decorators";

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
    @Optional() @Inject(DB) private readonly db?: Db,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isApiKey = this.reflector.getAllAndOverride<boolean>(IS_API_KEY_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isApiKey) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { [AUTH_CONTEXT_KEY]?: AuthContext }>();
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
      await this.checkEnvironment(req, auth);
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
  private async checkEnvironment(req: Request, auth: ApiKeyAuthContext) {
    const allowed = auth.environmentConstraint;
    if (!allowed) return;
    if (!this.db) throw AppError.forbidden("Environment-constrained key unavailable");
    const body = req.body as
      { company_id?: string; document?: { company_id?: string }; environment?: string } | undefined;
    const direct =
      req.params["companyId"] ??
      body?.company_id ??
      body?.document?.company_id ??
      req.query["company_id"];
    const path = req.originalUrl.split("?")[0] ?? "";
    const companyId = direct ?? (/^\/v1\/companies\//.test(path) ? req.params["id"] : undefined);
    let environment: string | undefined;
    if (
      typeof companyId === "string" &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(companyId)
    ) {
      const [company] = await this.db
        .select({ environment: companies.environment })
        .from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.organizationId, auth.organizationId)));
      if (!company) throw AppError.notFound("Company not found");
      environment = company.environment;
    } else if (
      /^\/v1\/(documents|despatch-advices|reversions)\//.test(path) &&
      typeof req.params["id"] === "string" &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.params["id"])
    ) {
      const [doc] = await this.db
        .select({ environment: documents.environment })
        .from(documents)
        .where(
          and(
            eq(documents.id, req.params["id"]),
            eq(documents.organizationId, auth.organizationId),
          ),
        );
      if (!doc) throw AppError.notFound("Document not found");
      environment = doc.environment;
    }
    if (
      (environment && environment !== allowed) ||
      (body?.environment && body.environment !== allowed)
    )
      throw AppError.forbidden("API key environment does not allow this operation");
  }
}

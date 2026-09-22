import {
  CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppError } from "@factosys/shared";
import type { Request } from "express";

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

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeys: ApiKeyService,
    private readonly rateLimit: RateLimitService,
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
      throw AppError.unauthorized("Missing Bearer API key");
    }
    const secret = header.slice("Bearer ".length).trim();
    if (!secret) {
      throw AppError.unauthorized("Missing Bearer API key");
    }

    const auth = await this.apiKeys.authenticate(secret);
    req[AUTH_CONTEXT_KEY] = auth;

    await this.rateLimit.consumeOrg(auth.organizationId);

    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(REQUIRE_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (requiredScopes.length > 0) {
      const have = new Set(auth.scopes);
      const missing = requiredScopes.filter((s) => !have.has(s));
      if (missing.length > 0) {
        throw AppError.forbidden(`Missing scopes: ${missing.join(", ")}`);
      }
    }

    return true;
  }
}

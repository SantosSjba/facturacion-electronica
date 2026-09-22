import {
  CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AppError } from "@factosys/shared";
import type { Request } from "express";

import type { Env } from "../../../infrastructure/config/env.schema";
import {
  type AccessTokenPayload,
  AuthService,
} from "../../../infrastructure/auth/auth.service";
import {
  AUTH_CONTEXT_KEY,
  type AuthContext,
} from "../auth/auth-context";
import {
  IS_API_KEY_AUTH_KEY,
  IS_PUBLIC_KEY,
} from "../decorators/auth.decorators";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const isApiKey = this.reflector.getAllAndOverride<boolean>(IS_API_KEY_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isApiKey) {
      return true;
    }

    const req = context.switchToHttp().getRequest<
      Request & { [AUTH_CONTEXT_KEY]?: AuthContext }
    >();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw AppError.unauthorized("Missing Bearer access token");
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw AppError.unauthorized("Missing Bearer access token");
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get("JWT_ACCESS_SECRET", { infer: true }),
      });
    } catch {
      throw AppError.unauthorized("Invalid access token");
    }
    if (payload.typ !== "access") {
      throw AppError.unauthorized("Invalid access token");
    }

    const auth = await this.authService.buildUserContext(payload.sub);
    if (auth.organizationId !== payload.org) {
      throw AppError.unauthorized("Invalid access token");
    }
    req[AUTH_CONTEXT_KEY] = auth;
    return true;
  }
}

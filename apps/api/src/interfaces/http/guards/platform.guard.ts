import {
  CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppError } from "@factosys/shared";
import type { Request } from "express";

import {
  AUTH_CONTEXT_KEY,
  type AuthContext,
} from "../auth/auth-context";
import {
  IS_API_KEY_AUTH_KEY,
  IS_PUBLIC_KEY,
  REQUIRE_PLATFORM_KEY,
} from "../decorators/auth.decorators";

@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_PLATFORM_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      return true;
    }

    const req = context.switchToHttp().getRequest<
      Request & { [AUTH_CONTEXT_KEY]?: AuthContext }
    >();
    const auth = req[AUTH_CONTEXT_KEY];
    if (!auth || auth.kind !== "user") {
      throw AppError.unauthorized();
    }
    if (auth.ctx !== "platform") {
      throw AppError.forbidden("Platform access required");
    }
    return true;
  }
}

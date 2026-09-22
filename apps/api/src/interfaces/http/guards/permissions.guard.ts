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
  REQUIRE_PERMISSIONS_KEY,
} from "../decorators/auth.decorators";

@Injectable()
export class PermissionsGuard implements CanActivate {
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

    const required =
      this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<
      Request & { [AUTH_CONTEXT_KEY]?: AuthContext }
    >();
    const auth = req[AUTH_CONTEXT_KEY];
    if (!auth || auth.kind !== "user") {
      throw AppError.unauthorized();
    }

    const have = new Set(auth.permissions);
    const missing = required.filter((p) => !have.has(p));
    if (missing.length > 0) {
      throw AppError.forbidden(`Missing permissions: ${missing.join(", ")}`);
    }
    return true;
  }
}

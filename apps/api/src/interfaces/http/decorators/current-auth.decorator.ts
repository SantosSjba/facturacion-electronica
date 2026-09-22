import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import type { AuthContext } from "../auth/auth-context";
import { AUTH_CONTEXT_KEY } from "../auth/auth-context";

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const req = ctx.switchToHttp().getRequest<Request & { [AUTH_CONTEXT_KEY]?: AuthContext }>();
    const auth = req[AUTH_CONTEXT_KEY];
    if (!auth) {
      throw new Error("Auth context missing — guard misconfiguration");
    }
    return auth;
  },
);

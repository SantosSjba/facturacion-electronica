import type { Request } from "express";

import type { AuthContext } from "../auth/auth-context";
import type {
  AuditActorType,
  AuditAppendInput,
} from "../../../infrastructure/audit/audit.service";

export function actorFromAuth(auth: AuthContext): {
  actorType: AuditActorType;
  actorId: string;
} {
  if (auth.kind === "user") {
    return { actorType: "user", actorId: auth.userId };
  }
  return { actorType: "api_key", actorId: auth.apiKeyId };
}

export function requestMeta(req?: Request): Pick<
  AuditAppendInput,
  "ip" | "userAgent"
> {
  if (!req) return {};
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded : undefined) ??
    req.ip ??
    req.socket?.remoteAddress ??
    null;
  const ua = req.headers["user-agent"];
  return {
    ip: typeof ip === "string" ? ip : null,
    userAgent: typeof ua === "string" ? ua : null,
  };
}

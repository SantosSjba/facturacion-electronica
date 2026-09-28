export type AuthKind = "api_key" | "user";

export interface ApiKeyAuthContext {
  kind: "api_key";
  organizationId: string;
  apiKeyId: string;
  scopes: string[];
}

export type AuthCtx = "platform" | "org";

export interface UserAuthContext {
  kind: "user";
  organizationId: string;
  userId: string;
  email: string;
  permissions: string[];
  roles: string[];
  /** `platform` when the user holds any `platform_*` role; otherwise `org`. */
  ctx: AuthCtx;
  /** Present when access token is a support impersonation session (S17-SEC). */
  impersonation?: {
    reason: string;
    actorUserId: string;
  };
}

export type AuthContext = ApiKeyAuthContext | UserAuthContext;

export const AUTH_CONTEXT_KEY = "authContext";

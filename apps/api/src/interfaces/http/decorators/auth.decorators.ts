import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const IS_API_KEY_AUTH_KEY = "isApiKeyAuth";
export const ApiKeyAuth = () => SetMetadata(IS_API_KEY_AUTH_KEY, true);

export const REQUIRE_PERMISSIONS_KEY = "requirePermissions";
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);

export const REQUIRE_SCOPES_KEY = "requireScopes";
export const RequireScopes = (...scopes: string[]) =>
  SetMetadata(REQUIRE_SCOPES_KEY, scopes);

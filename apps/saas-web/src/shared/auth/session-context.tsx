import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  apiRequest,
  ensureRefreshed,
  getAccessTokenMemory,
  getStoredRefreshToken,
  loginRequest,
  logoutRequest,
  setAccessTokenMemory,
  setAuthFailureHandler,
  setStoredRefreshToken,
  type LoginOrganizationOption,
} from "../api/http-client";
import {
  decodeAccessToken,
  isTokenExpired,
  type AccessTokenClaims,
} from "./jwt";

export interface SessionUser {
  id: string;
  email: string;
  organizationId: string;
  perms: string[];
  roles: string[];
  ctx: "platform" | "org";
}

export type LoginOutcome =
  | { status: "authenticated" }
  | {
      status: "org_selection_required";
      organizations: LoginOrganizationOption[];
    };

interface SessionContextValue {
  user: SessionUser | null;
  bootstrapping: boolean;
  isPlatform: boolean;
  login: (input: {
    email: string;
    password: string;
    organizationSlug?: string;
    organizationId?: string;
  }) => Promise<LoginOutcome>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function resolveCtx(claims: AccessTokenClaims): "platform" | "org" {
  if (claims.ctx === "platform" || claims.ctx === "org") return claims.ctx;
  return claims.roles.some((r) => r.startsWith("platform_"))
    ? "platform"
    : "org";
}

function claimsToUser(claims: AccessTokenClaims): SessionUser {
  return {
    id: claims.sub,
    email: claims.email,
    organizationId: claims.org,
    perms: claims.perms,
    roles: claims.roles,
    ctx: resolveCtx(claims),
  };
}

function applyAccessToken(token: string | null): SessionUser | null {
  setAccessTokenMemory(token);
  if (!token) return null;
  const claims = decodeAccessToken(token);
  if (!claims) return null;
  if (isTokenExpired(claims)) return null;
  return claimsToUser(claims);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  const clearSession = useCallback(() => {
    setAccessTokenMemory(null);
    setStoredRefreshToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setAuthFailureHandler(() => {
      clearSession();
    });
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      try {
        const existing = getAccessTokenMemory();
        if (existing) {
          const u = applyAccessToken(existing);
          if (u && !cancelled) {
            setUser(u);
            return;
          }
        }

        if (!getStoredRefreshToken()) return;

        const pair = await ensureRefreshed();
        if (cancelled) return;
        if (pair) {
          const u = applyAccessToken(pair.accessToken);
          setUser(u);
        } else {
          clearSession();
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(
    async (input: {
      email: string;
      password: string;
      organizationSlug?: string;
      organizationId?: string;
    }): Promise<LoginOutcome> => {
      const result = await loginRequest({
        email: input.email,
        password: input.password,
        organization_slug: input.organizationSlug,
        organization_id: input.organizationId,
      });

      if ("status" in result && result.status === "org_selection_required") {
        return {
          status: "org_selection_required",
          organizations: result.organizations,
        };
      }

      const pair = result as {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      };
      setStoredRefreshToken(pair.refreshToken);
      const u = applyAccessToken(pair.accessToken);
      if (!u) throw new Error("Invalid access token from login");
      setUser(u);
      return { status: "authenticated" };
    },
    [],
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    clearSession();
  }, [clearSession]);

  const hasPermission = useCallback(
    (perm: string) => Boolean(user?.perms.includes(perm)),
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      bootstrapping,
      isPlatform: user?.ctx === "platform",
      login,
      logout,
      hasPermission,
    }),
    [user, bootstrapping, login, logout, hasPermission],
  );

  return createElement(SessionContext.Provider, { value }, children);
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}

export { apiRequest };

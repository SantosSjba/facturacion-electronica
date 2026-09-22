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
}

interface SessionContextValue {
  user: SessionUser | null;
  bootstrapping: boolean;
  login: (input: {
    email: string;
    password: string;
    organizationSlug: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function claimsToUser(claims: AccessTokenClaims): SessionUser {
  return {
    id: claims.sub,
    email: claims.email,
    organizationId: claims.org,
    perms: claims.perms,
    roles: claims.roles,
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
      organizationSlug: string;
    }) => {
      const pair = await loginRequest({
        email: input.email,
        password: input.password,
        organization_slug: input.organizationSlug,
      });
      setStoredRefreshToken(pair.refreshToken);
      const u = applyAccessToken(pair.accessToken);
      if (!u) throw new Error("Invalid access token from login");
      setUser(u);
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

/** Exposed for rare authenticated probes. */
export { apiRequest };

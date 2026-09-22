import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, resolveBackendMode } from "@/lib/api";
import { ApiError, clearSession, describeError, readSession, writeSession } from "@/lib/api-client";
import type {
  AuthSession,
  Credentials,
  RegisterPayload,
  Role,
  User,
} from "@/lib/types";

/**
 * JWT session for the CraveDash stack.
 *
 * The auth-service issues the token, the gateway validates it on every request
 * and forwards X-User-Id / X-User-Email / X-User-Role downstream. The token is
 * kept in localStorage so a refresh keeps the session, and `/api/auth/me`
 * re-validates it on boot.
 */

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  session: AuthSession | null;
  error: string | null;
  login: (credentials: Credentials) => Promise<AuthSession>;
  register: (payload: RegisterPayload) => Promise<AuthSession>;
  signOut: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function profileFromSession(session: AuthSession): User {
  return {
    id: session.userId,
    name: session.name,
    email: session.email,
    role: session.role,
    phone: null,
    createdAt: null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // Decides gateway vs. offline demo before the first request goes out.
      await resolveBackendMode();
      const stored = readSession();
      if (cancelled) return;
      if (!stored) {
        setIsLoading(false);
        return;
      }

      setSession(stored);
      try {
        const me = await api.me();
        if (!cancelled) setProfile(me);
      } catch (cause) {
        // 401 means the stored token is no longer valid; a network error means
        // we keep the cached session and let individual calls surface problems.
        if (cause instanceof ApiError && cause.status === 401) {
          clearSession();
          if (!cancelled) {
            setSession(null);
            setProfile(null);
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials: Credentials) => {
    setError(null);
    try {
      const next = await api.login(credentials);
      writeSession(next);
      setSession(next);
      setProfile(profileFromSession(next));
      void api
        .me()
        .then(setProfile)
        .catch(() => undefined);
      return next;
    } catch (cause) {
      const message = describeError(cause);
      setError(message);
      throw cause;
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setError(null);
    try {
      const next = await api.register(payload);
      writeSession(next);
      setSession(next);
      setProfile(profileFromSession(next));
      void api
        .me()
        .then(setProfile)
        .catch(() => undefined);
      return next;
    } catch (cause) {
      const message = describeError(cause);
      setError(message);
      throw cause;
    }
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setSession(null);
    setProfile(null);
  }, []);

  const user = useMemo(() => {
    if (!session) return null;
    return profile && profile.id === session.userId
      ? profile
      : profileFromSession(session);
  }, [session, profile]);

  const hasRole = useCallback(
    (...roles: Role[]) => Boolean(user && roles.includes(user.role)),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: Boolean(session),
      user,
      session,
      error,
      login,
      register,
      signOut,
      hasRole,
    }),
    [isLoading, session, user, error, login, register, signOut, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}

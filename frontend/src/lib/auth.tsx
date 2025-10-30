import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { login as apiLogin, me as apiMe, TokenInfo } from "@/lib/api";

type User = { id: number; username: string; created_at: string };

type AuthCtx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  authDisabled: boolean;
  ready: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [authDisabled, setAuthDisabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  const refreshMe = useCallback(async (t?: string) => {
    try {
      const u = await apiMe(t);
      setUser(u);
    } catch {
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        if (token) {
          await refreshMe(token);
        } else {
          // detect if auth is disabled by calling /users/me without token
          try {
            const u = await apiMe(undefined);
            if (!canceled) {
              setUser(u);
              setAuthDisabled(true);
            }
          } catch {
            if (!canceled) setAuthDisabled(false);
          }
        }
      } finally {
        if (!canceled) setReady(true);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [token, refreshMe]);

  const doLogin = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const tok: TokenInfo = await apiLogin(username, password);
      setToken(tok.access_token);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login: doLogin, logout, authDisabled, ready }),
    [user, token, loading, doLogin, logout, authDisabled, ready],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

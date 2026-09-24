import { QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import { apiClient, clearToken, getToken, setToken } from "../lib/apiClient";
import { queryClient } from "../lib/queryClient";
import type { AuthUser } from "../types/auth";

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface AuthContextValue {
  user: AuthUser | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session state lives in plain React state, not the TanStack Query cache:
 * login/logout need to change it synchronously and unambiguously, which
 * cache invalidation (removeQueries/setQueryData(undefined) both no-op on
 * an already-fetched query) does not guarantee. QueryClientProvider below
 * still wraps the whole app for every other module's data fetching.
 */
function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    apiClient<{ user: AuthUser }>("/auth/me")
      .then((result) => {
        if (!cancelled) setUser(result.user);
      })
      .catch(() => {
        if (!cancelled) {
          clearToken();
          setUser(undefined);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const result = await apiClient<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(result.accessToken);
    setUser(result.user);
  }

  async function logout(): Promise<void> {
    try {
      await apiClient("/auth/logout", { method: "POST" });
    } finally {
      clearToken();
      setUser(undefined);
    }
  }

  const value: AuthContextValue = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AppProviders");
  }
  return ctx;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>{children}</BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

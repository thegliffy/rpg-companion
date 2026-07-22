import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { PublicUser } from "shared";
import * as authApi from "../api/auth";

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authApi
      .fetchSession()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    setError(null);
    try {
      const u = await authApi.login(username, password);
      setUser(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      throw err;
    }
  }

  async function register(username: string, password: string) {
    setError(null);
    try {
      const u = await authApi.register(username, password);
      setUser(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      throw err;
    }
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

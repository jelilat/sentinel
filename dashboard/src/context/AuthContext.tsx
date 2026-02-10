import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { setStoredToken, clearStoredToken, getStoredToken } from "../api";

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => getStoredToken() !== null
  );

  const login = useCallback(async (token: string) => {
    // Temporarily store token so apiFetch doesn't use it yet
    // We call the login endpoint directly
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Login failed");
    }

    setStoredToken(token);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

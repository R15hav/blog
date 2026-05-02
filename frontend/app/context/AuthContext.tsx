"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { verifyToken } from "../_lib/api_callout";

interface User {
  id: string;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  role: string;
  first_name?: string | null;
  last_name?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (newToken: string, userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("access_token");
    if (!stored) {
      setLoading(false);
      return;
    }
    verifyToken(stored).then(({ valid, detail }: { valid: boolean; detail: User }) => {
      if (valid) {
        setToken(stored);
        setUser(detail);
      } else {
        localStorage.removeItem("access_token");
      }
      setLoading(false);
    });
  }, []);

  function login(newToken: string, userData: User) {
    localStorage.setItem("access_token", newToken);
    setToken(newToken);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem("access_token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

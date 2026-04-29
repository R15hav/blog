"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { verifyToken } from "../_lib/api_callout";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem("access_token");
        if (!stored) {
            setLoading(false);
            return;
        }
        verifyToken(stored).then(({ valid, detail }) => {
            if (valid) {
                setToken(stored);
                setUser(detail);
            } else {
                localStorage.removeItem("access_token");
            }
            setLoading(false);
        });
    }, []);

    function login(newToken, userData) {
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

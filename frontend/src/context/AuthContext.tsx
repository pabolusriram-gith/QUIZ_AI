"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { authService, UserResponse } from "@/services/auth";
import { tokenStorage } from "@/utils/storage";
import { isAxiosError } from "axios";

interface AuthContextType {
  currentUser: UserResponse | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  loginWithToken: (token: string, refreshToken?: string | null, rememberMe?: boolean) => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Monitor global session expiration events (dispatched by API interceptor)
  useEffect(() => {
    const handleAuthExpired = () => {
      tokenStorage.clear();
      setCurrentUser(null);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("auth-expired", handleAuthExpired);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("auth-expired", handleAuthExpired);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initializeAuth = async () => {
      const token = tokenStorage.getAccessToken();
      if (token) {
        try {
          const profile = await authService.getCurrentUser();
          if (isMounted) {
            setCurrentUser(profile);
          }
        } catch (error: unknown) {
          // Sanitize console logging to avoid printing raw Axios config (exposing auth headers/payload)
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error("Failed to restore session:", errorMsg);
          
          // Only clear local tokens if the server explicitly rejects them, not on network drops
          if (isMounted && isAxiosError(error) && error.response && (error.response.status === 401 || error.response.status === 403)) {
            tokenStorage.clear();
          }
        }
      }
      if (isMounted) {
        setLoading(false);
      }
    };

    initializeAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    setLoading(true);
    try {
      const response = await authService.login(email, password);
      // Persist access token based on rememberMe option
      tokenStorage.setAccessToken(response.access_token, rememberMe);
      if (response.refresh_token) {
        tokenStorage.setRefreshToken(response.refresh_token, rememberMe);
      } else {
        tokenStorage.setRefreshToken(response.access_token, rememberMe);
      }

      const profile = await authService.getCurrentUser();
      setCurrentUser(profile);
    } catch (error) {
      tokenStorage.clear();
      setCurrentUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithToken = useCallback(async (token: string, refreshToken?: string | null, rememberMe: boolean = true) => {
    setLoading(true);
    // Handle parameter shift if refreshToken is passed as a boolean (old signature caller)
    let actualRefreshToken = refreshToken;
    let actualRememberMe = rememberMe;
    if (typeof refreshToken === "boolean") {
      actualRememberMe = refreshToken;
      actualRefreshToken = "from_cookie";
    }
    try {
      tokenStorage.setAccessToken(token, actualRememberMe);
      // Persist access token and either the custom token marker ("from_cookie") or fallback
      tokenStorage.setRefreshToken(actualRefreshToken || "from_cookie", actualRememberMe);
      const profile = await authService.getCurrentUser();
      setCurrentUser(profile);
    } catch (error) {
      tokenStorage.clear();
      setCurrentUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      throw new Error("No refresh token stored");
    }
    try {
      const response = await authService.refreshToken(refreshToken);
      const remember = tokenStorage.getRememberPreference();
      tokenStorage.setAccessToken(response.access_token, remember);
      if (response.refresh_token) {
        tokenStorage.setRefreshToken(response.refresh_token, remember);
      } else {
        tokenStorage.setRefreshToken(response.access_token, remember);
      }
      const profile = await authService.getCurrentUser();
      setCurrentUser(profile);
    } catch (error) {
      tokenStorage.clear();
      setCurrentUser(null);
      throw error;
    }
  }, []);

  const checkSession = useCallback(async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setCurrentUser(null);
      return;
    }
    try {
      const profile = await authService.getCurrentUser();
      setCurrentUser(profile);
    } catch {
      setCurrentUser(null);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authService.logout();
    } catch (error) {
      // Sanitize log to prevent sensitive object leakage
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Logout request error:", errorMsg);
    } finally {
      tokenStorage.clear();
      setCurrentUser(null);
      setLoading(false);
    }
  }, []);

  const contextValue = useMemo(() => ({
    currentUser,
    isAuthenticated: !!currentUser,
    loading,
    login,
    loginWithToken,
    refreshAccessToken,
    logout,
    checkSession,
  }), [currentUser, loading, login, loginWithToken, refreshAccessToken, logout, checkSession]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

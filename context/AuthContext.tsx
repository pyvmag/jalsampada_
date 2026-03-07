"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface AuthContextType {
  isAuthenticated: boolean;
  apiKey: string | null;
  apiSecret: string | null;
  posProfile: string | null;
  currentUser: string | null;
  setPosProfile: (profile: string) => void;
  login: (apiKey: string, apiSecret: string) => void;
  logout: () => void;
  getCurrentUser: (apiKey: string | null, apiSecret: string | null) => Promise<string | null>;
  isInitialized: boolean;
  csrfToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiSecret, setApiSecret] = useState<string | null>(null);
  const [posProfile, setPosProfileState] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const router = useRouter();

  // Helper to set posProfile with persistence
  const setPosProfile = (profile: string) => {
    setPosProfileState(profile);
    localStorage.setItem("posProfile", profile);
  };

  useEffect(() => {
    // Load from localStorage on mount
    const storedApiKey = localStorage.getItem("apiKey");
    const storedApiSecret = localStorage.getItem("apiSecret");
    const storedPosProfile = localStorage.getItem("posProfile");
    const storedUser = localStorage.getItem("currentUser");
    const storedCsrfToken = localStorage.getItem("csrfToken");

    if (storedApiKey && storedApiSecret) {
      setApiKey(storedApiKey);
      setApiSecret(storedApiSecret);
      setIsAuthenticated(true);
    }

    if (storedPosProfile) {
      setPosProfileState(storedPosProfile);
    }

    if (storedUser) {
      setCurrentUser(storedUser);
    }

    if (storedCsrfToken) {
      setCsrfToken(storedCsrfToken);
    }

    setIsInitialized(true);

    // Auto-fetch current user if authenticated but user not known
    if (storedApiKey && storedApiSecret && !storedUser) {
      getCurrentUser(storedApiKey, storedApiSecret).then((user) => {
        if (user) {
          setCurrentUser(user);
          localStorage.setItem("currentUser", user);
        }
      });
    }
  }, []);

  const login = (apiKey: string, apiSecret: string) => {
    setApiKey(apiKey);
    setApiSecret(apiSecret);
    setIsAuthenticated(true);
    localStorage.setItem("apiKey", apiKey);
    localStorage.setItem("apiSecret", apiSecret);

    // Fetch current user after login
    getCurrentUser(apiKey, apiSecret).then((user) => {
      if (user) {
        setCurrentUser(user);
        localStorage.setItem("currentUser", user);
      }
    });
  };

  const logout = () => {
    setApiKey(null);
    setApiSecret(null);
    setPosProfileState(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("apiKey");
    localStorage.removeItem("apiSecret");
    localStorage.removeItem("posProfile");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("csrfToken");
    setCsrfToken(null);
    router.push("/login");
  };

  const getCurrentUser = async (currentApiKey: string | null, currentApiSecret: string | null): Promise<string | null> => {
    if (!currentApiKey || !currentApiSecret) {
      return null;
    }

    try {
      // First get the username
      const userResponse = await fetch(
        "http://103.219.1.138:4412//api/method/frappe.auth.get_logged_user",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `token ${currentApiKey}:${currentApiSecret}`,
          },
          credentials: "include",
        }
      );

      if (!userResponse.ok) {
        throw new Error(`HTTP ${userResponse.status}: ${userResponse.statusText}`);
      }

      const userData = await userResponse.json();
      const username = userData.message;

      if (!username) {
        return null;
      }

      // Now get the full user details including full_name
      try {
        const userDetailResponse = await fetch(
          `http://103.219.1.138:4412/api/resource/User/${encodeURIComponent(username)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `token ${currentApiKey}:${currentApiSecret}`,
            },
            credentials: "include",
          }
        );

        if (userDetailResponse.ok) {
          const userDetailData = await userDetailResponse.json();
          // Return full_name if available, otherwise fall back to username
          return userDetailData.data?.full_name || username;
        }
      } catch (error) {
        console.warn("Could not fetch user full name, using username:", error);
      }

      // Fallback to username if full name fetch fails
      return username;
    } catch (error) {
      console.error("Error fetching current user:", error);
      return null;
    }
  };

  const contextValue: AuthContextType = {
    isAuthenticated,
    apiKey,
    apiSecret,
    posProfile,
    currentUser,
    setPosProfile,
    login,
    logout,
    getCurrentUser,
    isInitialized,
    csrfToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Fixed useAuth Hook - Critical Fix for Hook Order Error
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  // Always call useContext first
  // Then validate - never early return before hooks

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
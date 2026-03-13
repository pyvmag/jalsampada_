"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface AuthContextType {
  isAuthenticated: boolean;
  apiKey: string | null;
  apiSecret: string | null;
  posProfile: string | null;
  currentUser: string | null;
  userId: string | null;
  setPosProfile: (profile: string) => void;
  login: (apiKey: string, apiSecret: string) => void;
  logout: () => void;
  getCurrentUser: (apiKey: string | null, apiSecret: string | null) => Promise<{ username: string, full_name: string | null } | null>;
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
  const [userId, setUserId] = useState<string | null>(null);
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
    const storedUserId = localStorage.getItem("userId");
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
    if (storedApiKey && storedApiSecret && (!storedUser || !storedUserId)) {
      getCurrentUser(storedApiKey, storedApiSecret).then((data) => {
        if (data) {
          setCurrentUser(data.full_name || data.username);
          setUserId(data.username);
          localStorage.setItem("currentUser", data.full_name || data.username);
          localStorage.setItem("userId", data.username);
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
    getCurrentUser(apiKey, apiSecret).then((data) => {
      if (data) {
        setCurrentUser(data.full_name || data.username);
        setUserId(data.username);
        localStorage.setItem("currentUser", data.full_name || data.username);
        localStorage.setItem("userId", data.username);
      }
    });
  };

  const logout = () => {
    setApiKey(null);
    setApiSecret(null);
    setPosProfileState(null);
    setCurrentUser(null);
    setUserId(null);
    setIsAuthenticated(false);
    localStorage.removeItem("apiKey");
    localStorage.removeItem("apiSecret");
    localStorage.removeItem("posProfile");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("userId");
    localStorage.removeItem("csrfToken");
    setCsrfToken(null);
    router.push("/login");
  };

  const getCurrentUser = async (currentApiKey: string | null, currentApiSecret: string | null): Promise<{ username: string, full_name: string | null } | null> => {
    if (!currentApiKey || !currentApiSecret) {
      return null;
    }

    try {
      // First get the username
      const userResponse = await fetch(
        "http://103.219.3.169:2223//api/method/frappe.auth.get_logged_user",
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
          `http://103.219.3.169:2223/api/resource/User/${encodeURIComponent(username)}`,
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
          return {
            username: username,
            full_name: userDetailData.data?.full_name || null
          };
        }
      } catch (error) {
        console.warn("Could not fetch user full name, using username:", error);
      }

      return {
        username: username,
        full_name: null
      };
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
    userId,
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
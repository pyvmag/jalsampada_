// Production-ready configuration
export const APP_CONFIG = {
  // API URLs
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://103.219.3.169:2223",

  // App URLs for routing
  BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",

  // Environment
  NODE_ENV: process.env.NODE_ENV || "development",

  // Debug mode
  DEBUG: process.env.NODE_ENV === "development",
};

// Helper function to get the correct URL based on environment
export function getAppUrl(): string {
  return APP_CONFIG.BASE_URL;
}

// Helper function to get the correct API URL based on environment
export function getApiUrl(): string {
  return APP_CONFIG.API_BASE_URL;
}

// Helper function to determine if we're in development
export function isDevelopment(): boolean {
  return APP_CONFIG.NODE_ENV === "development";
}

// Helper function to determine if we're in production
export function isProduction(): boolean {
  return APP_CONFIG.NODE_ENV === "production";
}

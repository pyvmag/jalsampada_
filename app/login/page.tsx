"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, User, Loader2, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Login: React.FC = () => {
  const [username, setUsername] = useState("");

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "http://103.219.3.169:2223/api/method/quantlis_management.api.login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ usr: username, pwd: password }),
        }
      );

      const data = await response.json();

      if (response.ok && data.message === "Logged In") {
        const { api_key, api_secret } = data.key_details;
        login(api_key, api_secret);
        router.push("/");
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError("An error occurred during login");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background image with overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat object-cover w-full h-full"
        style={{ backgroundImage: "url('/images/sangli_irrigation.jpg')" }}
      />
      <div className="absolute inset-0 bg-black/30 dark:bg-black/60" />

      <div className="">
        <Card className="shadow-lg border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-center">
            <div className="mx-auto bg-white/20 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4">
              <Droplets className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">JALSAMPADA</h1>
            <p className="text-blue-100 mt-1">Water Resources Department</p>
          </div>

          <CardHeader className="text-center pb-2 pt-6">
            <CardTitle className="text-xl font-bold text-slate-800 dark:text-white">Portal Login</CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-300">Access your official account</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Username
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 py-5 bg-background/80 border-slate-300 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700/80 dark:text-white"
                    placeholder="Enter your official username"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 py-5 bg-background/80 border-slate-300 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700/80 dark:text-white"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-blue-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-slate-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="py-2 px-3 rounded-lg border-red-200 bg-red-50/80 dark:border-red-900 dark:bg-red-900/30">
                  <AlertDescription className="text-sm text-red-700 dark:text-red-300">{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full py-5 text-base font-medium transition-all duration-200 mt-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md hover:shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Sign In to Portal"
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col items-center justify-center pt-4 border-t border-slate-200 dark:border-slate-700">
            {/* <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Government of India • Water Resources Department
            </p> */}
            <div className="mt-2 flex items-center text-xs text-slate-500 dark:text-slate-400">
              <Lock className="h-3 w-3 mr-1" />
              <span>© 2025 Developed and maintained by QUANBIT TECHNOLOGIES PVT LTD</span>
            </div>
          </CardFooter>
        </Card>

        {/* <div className="mt-6 text-center text-xs text-white/80 dark:text-slate-300">
          <p> 2025 Water Resources Department, Government of India</p>
          <p className="mt-1"></p>
        </div> */}
      </div>
    </div>
  );
};

export default Login;
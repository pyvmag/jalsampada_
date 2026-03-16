"use client";

// 1. Move all your imports here
import "@/styles/globals.css";
import "@/styles/assets.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/ModeToggle";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// 2. This is the wrapper component
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider
        attribute="data-color-scheme"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AppContent>{children}</AppContent>
      </ThemeProvider>
    </AuthProvider>
  );
}

/* -------------------------------------------------------------------------- */
/* APP CONTENT – Your existing sidebar/header logic stays here               */
/* -------------------------------------------------------------------------- */
function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const { 
    isInitialized, 
    isAuthenticated, 
    currentUser, 
    logout, 
    hasPermission, 
    isAdmin, 
    userPermissions 
  } = useAuth();

  const sidebarItems = React.useMemo(() => {
    const items = [
      { href: "/", icon: "fa-tachometer-alt", label: "Dashboard" },
      { 
        href: "/lis-management", 
        icon: "fa-cogs", 
        label: "Asset", 
        doctypes: ["Asset", "Asset Category", "Asset Interchange", "District", "Equipement Capacity", "Equipement Model", "Equipment Make", "Lift Irrigation Scheme", "Location", "Rating", "Stage No", "Taluka", "Village"] 
      },
      { 
        href: "/tender", 
        icon: "fa-gavel", 
        label: "Tender", 
        doctypes: ["Contractor", "Draft Tender Paper", "Expenditure", "Fund Head", "Prapan Suchi", "Project", "Work Subtype", "Work Type"] 
      },
      { 
        href: "/operations", 
        icon: "fa-chart-line", 
        label: "Operations", 
        doctypes: ["LIS Incident Record"] 
      },
      { 
        href: "/maintenance", 
        icon: "fa-tools", 
        label: "Maintenance", 
        doctypes: ["Device Type", "Maintenance Checklist", "Maintenance Log", "Maintenance Schedule", "Parameter Category", "Parameter Checklist", "Parameter Type"] 
      },
      { 
        href: "/attendance", 
        icon: "fa-user-check", 
        label: "Attendance", 
        doctypes: ["Attendance Sheet", "Designation", "Employee"] 
      },
      { 
        href: "/tp_reports", 
        icon: "fa-file-alt", 
        label: "Reports", 
        doctypes: ["Report"] 
      },
      { 
        href: "/admin", 
        icon: "fa-user-cog", 
        label: "Admin", 
        doctypes: ["User", "Role", "Role Profile"],
        adminOnly: true
      }
    ];

    // Filter items based on permissions
    return items.filter(item => {
      // Always show Dashboard
      if (item.href === "/") return true;
      
      // Admin sees everything
      if (isAdmin) return true;
      
      // If the item requires Admin strictly, hide it for non-admin users
      if (item.adminOnly) return false;
      
      // Check if user has permission for ANY of the specified doctypes in the module
      if (item.doctypes && item.doctypes.length > 0) {
        return item.doctypes.some(dt => hasPermission(dt, "read"));
      }

      return true;
    });
  }, [hasPermission, isAdmin]);


  // Debug: Log currentUser and permissions
  React.useEffect(() => {
    console.log("Current User:", currentUser);
    console.log("Is Admin:", isAdmin);
    console.log("User Permissions Map:", userPermissions);
    console.log("Calculated Sidebar Items:", sidebarItems.map(i => i.label));
  }, [currentUser, isAdmin, userPermissions, sidebarItems]);


  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const isLoginPage = pathname === "/login";

  // automatically collapse sidebar on narrow viewports
  React.useEffect(() => {
    function handleResize() {
      if (window.innerWidth <= 768) {
        setSidebarOpen(false);
      }
    }
    // run once to set initial state
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Helper function to get initials from full name
  const getInitials = (fullName: string) => {
    if (!fullName) return "U";

    const names = fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }

    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  /* ------------------- 5. AUTO-DISMISS TOASTS ON NAV ------------------- */
  // 🟢 NEW: When the URL changes (user navigates), close all toasts.
  React.useEffect(() => {
    toast.dismiss();
  }, [pathname]);

  /* ------------------- 1. REDIRECT UNAUTHENTICATED USERS ------------------- */
  React.useEffect(() => {
    if (isInitialized && !isAuthenticated && !isLoginPage) {
      router.replace("/login");
    }
  }, [isInitialized, isAuthenticated, isLoginPage, router]);

  /* -------------------------- 2. LOADING SPINNER -------------------------- */
  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  /* --------------------------- 3. LOGIN PAGE ONLY -------------------------- */
  if (isLoginPage) {
    return <>{children}</>;
  }

  /* --------------------------- 4. PROTECTED UI --------------------------- */
  return (
    <div className={`app-container ${!sidebarOpen ? "sidebar-collapsed" : ""}`}>
      {/* HEADER */}
      <header className="header">
        <div className="header-content">
          {/* logo doubles as toggle on all screen sizes */}
          <div
            className="logo-section"
            onClick={() => setSidebarOpen((v) => !v)}
            style={{ cursor: "pointer" }}
          >
            <i className="fas fa-water"></i>
            <h1>JALSAMPADA</h1>
          </div>

          <div className="user-info">
            <span>Welcome. {currentUser || "Guest"}</span>
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* SIDEBAR */}
      <div
        className={`mobile-overlay ${sidebarOpen ? "mobile-overlay-visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      <nav className="sidebar">
        <div className="nav-items">
          {sidebarItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (window.innerWidth <= 768) {
                  setSidebarOpen(false);
                }
              }}
              className={`nav-item ${pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href))
                ? "active"
                : ""
                }`}
            >
              <i className={`fas ${item.icon}`}></i>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="mt-auto pb-2">
          <div className="border-t border-gray-200 dark:border-gray-700 mx-4 my-4"></div>

          {/* Avatar Section - Bottom Corner */}
          <div className="px-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="nav-item cursor-pointer">
                  <i className="fas fa-user"></i>
                  <span>{currentUser || "Admin"}</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="right" className="bg-white border border-gray-200 rounded-md shadow-lg">
                <DropdownMenuItem onClick={() => router.push("/admin/doctype/session_default")} className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors">
                  <i className="fas fa-user-circle mr-2"></i>
                  Session Default
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors">
                  <i className="fas fa-sign-out-alt mr-2"></i>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="main-content">{children}</main>

      {/* FOOTER */}
      <footer className="footer">
        <p>© 2025 JALSAMPADA. All rights reserved.</p>
      </footer>

      {/* UPDATED TOASTER WITH CAPITALIZATION */}
      <Toaster
        richColors
        position="top-center"
        closeButton
        toastOptions={{
          style: {
            width: '100%',
            minWidth: '450px',
            padding: '20px',
          },
          classNames: {
            toast: "shadow-xl border-2 rounded-xl",
            // ADDED: 'capitalize' class to title
            title: "text-xl font-bold mb-1 capitalize",
            // ADDED: 'capitalize' class to description
            description: "text-base font-medium opacity-90 ",
            actionButton: "text-base font-bold py-2 px-4",
            cancelButton: "text-base font-medium py-2 px-4",
            closeButton: "top-4 right-4",
          }
        }}
      />
    </div>
  );
}

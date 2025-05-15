// src/components/layout/client-only-layout.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import React, { type ReactNode, useEffect } from "react";
import { AppLayout } from "./app-layout";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const MAIN_APP_ROUTES_PREFIXES = [
  "/dashboard",
  "/case-management",
  "/document-analysis",
  "/audio-analysis",
  "/image-analysis",
  "/link-analysis",
  "/financial-analysis",
  "/ric-generation",
  "/settings",
];

const ADMIN_ROUTES_PREFIX = "/admin";
const PUBLIC_ROUTES = ["/", "/request-access", "/login"]; // Landing, request access, and login are public

export default function ClientOnlyLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  const isMainAppRoute = MAIN_APP_ROUTES_PREFIXES.some(prefix => pathname.startsWith(prefix));
  const isAdminRoute = pathname.startsWith(ADMIN_ROUTES_PREFIX);
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (isLoading) return; // Don't do anything while auth state is loading

    if (!isAuthenticated && !isPublicRoute) {
      router.push("/login");
    } else if (isAuthenticated && (pathname === "/login" || pathname === "/request-access")) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, pathname, router, isPublicRoute]);

  if (isLoading && !isPublicRoute) { // Show loader only for protected routes while checking auth
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verificando autenticação...</p>
      </div>
    );
  }

  if (isMainAppRoute || isAdminRoute) {
    if (!isAuthenticated && !isLoading) { // If still not authenticated after loading and not public, login will redirect
      return null; // Or a minimal loading/redirecting state
    }
    if (isMainAppRoute) {
       return <AppLayout>{children}</AppLayout>;
    }
    // Admin routes have their own layout applied by /admin/layout.tsx
    // So, if it's an admin route and authenticated, just render children
    if (isAdminRoute && isAuthenticated) {
      return <>{children}</>;
    }
  }
  
  // For public routes or if none of the above conditions are met (e.g. landing page)
  return <>{children}</>;
}

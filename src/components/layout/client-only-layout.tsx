// src/components/layout/client-only-layout.tsx
"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppLayout } from "./app-layout";

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

// Admin routes will have their own layout (AdminLayout)
const ADMIN_ROUTES_PREFIX = "/admin";

export default function ClientOnlyLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isMainAppRoute = MAIN_APP_ROUTES_PREFIXES.some(prefix => pathname.startsWith(prefix));
  const isAdminRoute = pathname.startsWith(ADMIN_ROUTES_PREFIX);

  if (isMainAppRoute) {
    return <AppLayout>{children}</AppLayout>;
  }
  
  // For admin routes, AdminLayout is applied directly by src/app/admin/layout.tsx
  // For other routes (like landing page, request-access), no special layout is applied here.
  return <>{children}</>;
}

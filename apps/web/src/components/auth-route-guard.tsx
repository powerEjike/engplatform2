"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";

const publicRoutes = new Set(["/login", "/join", "/request-demo"]);

export function AuthRouteGuard({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isPublicRoute = publicRoutes.has(pathname);

  useEffect(() => {
    if (!isLoading && !user && !isPublicRoute) {
      const query = typeof window === "undefined" ? "" : window.location.search;
      router.replace(`/login?next=${encodeURIComponent(`${pathname}${query}`)}`);
    }
  }, [isLoading, isPublicRoute, pathname, router, user]);

  if (!isPublicRoute && (isLoading || !user)) {
    return <main className="auth-loading">Checking your secure workspace…</main>;
  }

  return <>{children}</>;
}

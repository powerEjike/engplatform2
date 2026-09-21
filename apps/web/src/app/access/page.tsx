"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export default function AccessPage() {
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading, signOutUser } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && profile) router.replace("/dashboard");
  }, [isLoading, isProfileLoading, profile, router, user]);

  if (isLoading || isProfileLoading || !user || profile) return <main className="auth-loading">Checking your workspace access…</main>;

  return <main className="onboarding-page"><section className="onboarding-card"><p className="eyebrow">Workspace access</p><h1>Your account is not linked to a workspace yet</h1><p>Ask your Director to send a new invitation to this email address. Open that invitation link to create or connect your account, then you will go straight to your dashboard.</p><div className="auth-actions"><Link className="secondary" href="/login">Back to sign in</Link><button type="button" onClick={() => void signOutUser()}>Sign out</button></div></section></main>;
}

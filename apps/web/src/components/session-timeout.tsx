"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";

const idleLimitMs = 30 * 60 * 1000;

export function SessionTimeout() {
  const { user, profile, signOutUser } = useAuth();

  useEffect(() => {
    if (!user || !profile) return;
    let timeout = window.setTimeout(expire, idleLimitMs);
    function expire() {
      window.sessionStorage.setItem("buildcore:session-ended", "1");
      void signOutUser();
    }
    const reset = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(expire, idleLimitMs);
    };
    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    return () => {
      window.clearTimeout(timeout);
      activityEvents.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [profile, signOutUser, user]);

  return null;
}

"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";

const idleLimitMs = 30 * 60 * 1000;
const maximumSessionMs = 12 * 60 * 60 * 1000;
const sessionStartedKey = "buildcore:session-started-at";
const lastActivityKey = "buildcore:session-last-activity";

export function SessionTimeout() {
  const { user, profile, signOutUser } = useAuth();

  useEffect(() => {
    if (!user || !profile) return;
    const now = Date.now();
    const storedStartedAt = Number(window.sessionStorage.getItem(sessionStartedKey));
    const startedAt = Number.isFinite(storedStartedAt) && storedStartedAt > 0 ? storedStartedAt : now;
    if (!storedStartedAt) window.sessionStorage.setItem(sessionStartedKey, String(startedAt));
    let timeout = 0;
    function expire() {
      window.sessionStorage.setItem("buildcore:session-ended", "1");
      void signOutUser();
    }
    const scheduleExpiry = () => {
      window.clearTimeout(timeout);
      const lastActivity = Number(window.sessionStorage.getItem(lastActivityKey)) || startedAt;
      const expiresAt = Math.min(lastActivity + idleLimitMs, startedAt + maximumSessionMs);
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        expire();
        return;
      }
      timeout = window.setTimeout(expire, remaining);
    };
    const reset = () => {
      window.sessionStorage.setItem(lastActivityKey, String(Date.now()));
      scheduleExpiry();
    };
    const validate = () => scheduleExpiry();
    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    window.addEventListener("focus", validate);
    window.addEventListener("pageshow", validate);
    document.addEventListener("visibilitychange", validate);
    scheduleExpiry();
    return () => {
      window.clearTimeout(timeout);
      activityEvents.forEach((event) => window.removeEventListener(event, reset));
      window.removeEventListener("focus", validate);
      window.removeEventListener("pageshow", validate);
      document.removeEventListener("visibilitychange", validate);
    };
  }, [profile, signOutUser, user]);

  return null;
}

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";

export function OfflineStatus() {
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  if (isLoading || isProfileLoading || !user || !profile) return null;
  return <div className={isOnline ? "connection-status online" : "connection-status offline"} role="status">
    <span aria-hidden="true">{isOnline ? "●" : "◉"}</span>
    {isOnline ? "Online" : "Offline — changes will sync when connected"}
  </div>;
}

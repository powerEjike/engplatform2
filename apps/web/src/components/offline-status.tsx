"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { clearCompletedSyncOperations, offlineSyncChangeEvent, readSyncOperations, type SyncOperation } from "@/lib/offline-sync";
import { waitForPendingWrites } from "firebase/firestore";

export function OfflineStatus() {
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [operations, setOperations] = useState<SyncOperation[]>([]);

  useEffect(() => {
    const refresh = () => {
      setIsOnline(navigator.onLine);
      setOperations(readSyncOperations());
    };
    const syncWhenOnline = () => {
      refresh();
      if (!navigator.onLine || readSyncOperations().filter((operation) => operation.status === "pending").length === 0) return;
      void waitForPendingWrites(db).then(() => {
        clearCompletedSyncOperations();
        refresh();
      }).catch(() => refresh());
    };
    const initialTimer = window.setTimeout(syncWhenOnline, 0);
    window.addEventListener("online", syncWhenOnline);
    window.addEventListener("offline", refresh);
    window.addEventListener(offlineSyncChangeEvent, refresh);
    return () => {
      window.clearTimeout(initialTimer);
      window.removeEventListener("online", syncWhenOnline);
      window.removeEventListener("offline", refresh);
      window.removeEventListener(offlineSyncChangeEvent, refresh);
    };
  }, []);

  if (isLoading || isProfileLoading || !user || !profile) return null;
  const pendingCount = operations.filter((operation) => operation.status === "pending").length;
  const failedCount = operations.filter((operation) => operation.status === "failed").length;
  const message = failedCount > 0 ? `${failedCount} change${failedCount === 1 ? "" : "s"} need attention` : pendingCount > 0 ? isOnline ? `Syncing ${pendingCount} change${pendingCount === 1 ? "" : "s"}…` : `${pendingCount} change${pendingCount === 1 ? "" : "s"} saved — waiting for connection` : isOnline ? "All synced" : "Offline — changes will sync when connected";
  const statusClass = failedCount > 0 ? "failed" : pendingCount > 0 || !isOnline ? "offline" : "online";
  return <div className={`connection-status ${statusClass}`} role="status">
    <span aria-hidden="true">{failedCount > 0 ? "!" : isOnline ? "●" : "◉"}</span>
    {message}
  </div>;
}

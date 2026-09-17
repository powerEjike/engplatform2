"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { clearCompletedSyncOperations, offlineSyncChangeEvent, readSyncOperations, type SyncOperation } from "@/lib/offline-sync";
import { enableNetwork, waitForPendingWrites } from "firebase/firestore";

const manualSyncEvent = "engplatform2:manual-sync";

export function OfflineStatus() {
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [operations, setOperations] = useState<SyncOperation[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setIsOnline(navigator.onLine);
      setOperations(readSyncOperations());
    };
    const syncWhenOnline = () => {
      refresh();
      if (!navigator.onLine || readSyncOperations().filter((operation) => operation.status === "pending").length === 0) return;
      void enableNetwork(db).catch(() => undefined).then(() => waitForPendingWrites(db)).then(() => {
        clearCompletedSyncOperations();
        refresh();
      }).catch(() => refresh());
    };
    const initialTimer = window.setTimeout(syncWhenOnline, 0);
    window.addEventListener("online", syncWhenOnline);
    window.addEventListener("offline", refresh);
    window.addEventListener(offlineSyncChangeEvent, refresh);
    window.addEventListener(manualSyncEvent, syncWhenOnline);
    return () => {
      window.clearTimeout(initialTimer);
      window.removeEventListener("online", syncWhenOnline);
      window.removeEventListener("offline", refresh);
      window.removeEventListener(offlineSyncChangeEvent, refresh);
      window.removeEventListener(manualSyncEvent, syncWhenOnline);
    };
  }, []);

  if (isLoading || isProfileLoading || !user || !profile) return null;
  const pendingCount = operations.filter((operation) => operation.status === "pending").length;
  const failedCount = operations.filter((operation) => operation.status === "failed").length;
  const queuedOperations = operations.filter((operation) => operation.status === "pending");
  const message = failedCount > 0 ? `${failedCount} change${failedCount === 1 ? "" : "s"} need attention` : pendingCount > 0 ? isOnline ? `Syncing ${pendingCount} change${pendingCount === 1 ? "" : "s"}…` : `${pendingCount} change${pendingCount === 1 ? "" : "s"} saved — waiting for connection` : isOnline ? "All synced" : "Offline — changes will sync when connected";
  const statusClass = failedCount > 0 ? "failed" : pendingCount > 0 || !isOnline ? "offline" : "online";
  return <div className={`connection-status ${statusClass}`} role="status">
    <span aria-hidden="true">{failedCount > 0 ? "!" : isOnline ? "●" : "◉"}</span>
    {message}
    {isOnline && pendingCount > 0 && <button type="button" onClick={() => window.dispatchEvent(new Event(manualSyncEvent))}>Sync now</button>}
    {operations.length > 0 && <button className="sync-details-toggle" type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>Details</button>}
    {detailsOpen && <div className="sync-details"><strong>Saved on this device</strong><ul>{operations.map((operation) => <li key={operation.id}><span>{operation.status === "failed" ? "Needs attention" : "Waiting to sync"}</span>{operation.type}</li>)}</ul>{queuedOperations.length > 0 && <p>{isOnline ? "The app is sending these changes now." : "They will send automatically when internet returns."}</p>}</div>}
  </div>;
}

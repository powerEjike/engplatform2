export type SyncOperationType = "project" | "daily report" | "variation";

export type SyncOperation = {
  id: string;
  type: SyncOperationType;
  status: "pending" | "failed";
  createdAt: number;
};

const storageKey = "engplatform2:offline-sync-operations";
const changeEvent = "engplatform2:offline-sync-changed";

const canUseStorage = () => typeof window !== "undefined";

export function readSyncOperations(): SyncOperation[] {
  if (!canUseStorage()) return [];
  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? JSON.parse(value) as SyncOperation[] : [];
  } catch {
    return [];
  }
}

function save(operations: SyncOperation[]) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(operations));
    window.dispatchEvent(new Event(changeEvent));
  } catch {
    // Firestore still owns the actual queued write when browser storage is unavailable.
  }
}

export function beginSyncOperation(type: SyncOperationType) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  save([...readSyncOperations(), { id, type, status: "pending", createdAt: Date.now() }]);
  return id;
}

export function completeSyncOperation(id: string) {
  save(readSyncOperations().filter((operation) => operation.id !== id));
}

export function failSyncOperation(id: string) {
  save(readSyncOperations().map((operation) => operation.id === id ? { ...operation, status: "failed" } : operation));
}

export function clearCompletedSyncOperations() {
  save(readSyncOperations().filter((operation) => operation.status === "failed"));
}

export const offlineSyncChangeEvent = changeEvent;

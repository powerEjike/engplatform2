"use client";

import { collection, onSnapshot, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";

export type WorkspaceInvite = {
  id: string;
  email: string;
  role: string;
  active: boolean;
};

export function useCompanyInvites(companyId: string | undefined) {
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(query(collection(db, "companies", companyId, "invites")), (snapshot) => {
      setInvites(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as WorkspaceInvite));
      setIsLoading(false);
    }, () => {
      setInvites([]);
      setIsLoading(false);
    });
  }, [companyId]);

  return { invites, isLoading };
}

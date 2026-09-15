"use client";

import { collection, onSnapshot, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { AppUser } from "@engplatform2/shared-types";
import { db } from "@/lib/firebase";

export function useCompanyUsers(companyId: string | undefined) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      return;
    }
    return onSnapshot(query(collection(db, "companies", companyId, "users")), (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, companyId, ...item.data() }) as AppUser));
      setIsLoading(false);
    }, () => {
      setUsers([]);
      setIsLoading(false);
    });
  }, [companyId]);

  return { users, isLoading };
}

"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import type { Project } from "@engplatform2/shared-types";

export function useProjects(companyId: string | undefined) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(query(collection(db, "companies", companyId, "projects"), orderBy("createdAt", "desc")), (snapshot) => {
      setProjects(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Project));
      setIsLoading(false);
    }, () => { setProjects([]); setIsLoading(false); });
  }, [companyId]);
  return { projects, isLoading };
}

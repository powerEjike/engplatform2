"use client";

import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import type { Project } from "@engplatform2/shared-types";

export function useProjects(companyId: string | undefined, role: string | undefined, userId: string | undefined) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    if (!companyId || !role || !userId) return;
    const projects = collection(db, "companies", companyId, "projects");
    const projectQuery = role === "director" || role === "quantity_surveyor"
      ? query(projects, orderBy("createdAt", "desc"))
      : role === "project_manager"
        ? query(projects, where("projectManagerId", "==", userId), orderBy("createdAt", "desc"))
        : role === "site_engineer"
          ? query(projects, where("siteEngineerId", "==", userId), orderBy("createdAt", "desc"))
          : null;
    if (!projectQuery) {
      const resetTimer = window.setTimeout(() => { setProjects([]); setIsLoading(false); }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    const loadingTimer = window.setTimeout(() => setIsLoading(true), 0);
    const unsubscribe = onSnapshot(projectQuery, (snapshot) => {
      setProjects(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Project));
      setIsLoading(false);
    }, () => { setProjects([]); setIsLoading(false); });
    return () => { window.clearTimeout(loadingTimer); unsubscribe(); };
  }, [companyId, role, userId]);
  return { projects, isLoading };
}

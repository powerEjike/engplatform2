"use client";

import { collection, onSnapshot, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { Project, ProjectAction } from "@engplatform2/shared-types";
import { db } from "@/lib/firebase";

export type ProjectActionWithProject = ProjectAction & { projectName: string };

export function useProjectActions(companyId: string | undefined, projects: Project[]) {
  const [actions, setActions] = useState<ProjectActionWithProject[]>([]);
  useEffect(() => {
    if (!companyId || projects.length === 0) {
      const resetTimer = window.setTimeout(() => setActions([]), 0);
      return () => window.clearTimeout(resetTimer);
    }
    const byProject: Record<string, ProjectActionWithProject[]> = {};
    const refresh = () => setActions(Object.values(byProject).flat().sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))));
    const unsubscribers = projects.map((project) => onSnapshot(query(collection(db, "companies", companyId, "projects", project.id, "projectActions")), (snapshot) => {
      byProject[project.id] = snapshot.docs.map((item) => ({ id: item.id, ...item.data(), projectName: project.name }) as ProjectActionWithProject);
      refresh();
    }, () => { byProject[project.id] = []; refresh(); }));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [companyId, projects]);
  return { actions };
}

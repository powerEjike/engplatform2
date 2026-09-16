"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { Project, ProjectMilestone } from "@engplatform2/shared-types";
import { db } from "@/lib/firebase";

export type ScheduleMilestone = ProjectMilestone & { projectName: string };

export function useScheduleMilestones(companyId: string | undefined, projects: Project[]) {
  const [milestones, setMilestones] = useState<ScheduleMilestone[]>([]);

  useEffect(() => {
    if (!companyId || projects.length === 0) {
      return;
    }
    const byProject = new Map<string, ScheduleMilestone[]>();
    const refresh = () => setMilestones(Array.from(byProject.values()).flat().sort((left, right) => left.plannedDate.localeCompare(right.plannedDate)));
    const unsubscribers = projects.map((project) => onSnapshot(query(collection(db, "companies", companyId, "projects", project.id, "milestones"), orderBy("plannedDate", "asc")), (snapshot) => {
      byProject.set(project.id, snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data(), projectName: project.name }) as ScheduleMilestone));
      refresh();
    }));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [companyId, projects]);

  return { milestones };
}

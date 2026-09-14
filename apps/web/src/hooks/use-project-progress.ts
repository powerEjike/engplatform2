"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { BoqItem, Project } from "@engplatform2/shared-types";
import { db } from "@/lib/firebase";

export type ProjectProgress = { percentage: number; plannedValue: number; completedValue: number };

const calculateProgress = (items: BoqItem[]): ProjectProgress => {
  const plannedValue = items.reduce((total, item) => total + item.plannedQuantity * item.rate, 0);
  const completedValue = items.reduce((total, item) => total + item.cumulativeQuantityCompleted * item.rate, 0);
  return { plannedValue, completedValue, percentage: plannedValue > 0 ? Math.min(100, (completedValue / plannedValue) * 100) : 0 };
};

export function useProjectProgress(companyId: string | undefined, projects: Project[]) {
  const [progressByProject, setProgressByProject] = useState<Record<string, ProjectProgress>>({});

  useEffect(() => {
    if (!companyId) return;
    setProgressByProject({});
    const unsubscribes = projects.map((project) => onSnapshot(collection(db, "companies", companyId, "projects", project.id, "boqItems"), (snapshot) => {
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as BoqItem);
      setProgressByProject((current) => ({ ...current, [project.id]: calculateProgress(items) }));
    }));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [companyId, projects]);

  return { progressByProject };
}

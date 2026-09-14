"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { BoqItem, Project, SiteReport, Variation } from "@engplatform2/shared-types";
import { db } from "@/lib/firebase";

export type ProjectProgress = { percentage: number; plannedValue: number; completedValue: number };
export type ProjectActivity = { variationExposure: number; latestReportDate: string | null };

const calculateProgress = (items: BoqItem[]): ProjectProgress => {
  const plannedValue = items.reduce((total, item) => total + item.plannedQuantity * item.rate, 0);
  const completedValue = items.reduce((total, item) => total + item.cumulativeQuantityCompleted * item.rate, 0);
  return { plannedValue, completedValue, percentage: plannedValue > 0 ? Math.min(100, (completedValue / plannedValue) * 100) : 0 };
};

export function useProjectProgress(companyId: string | undefined, projects: Project[]) {
  const [progressByProject, setProgressByProject] = useState<Record<string, ProjectProgress>>({});
  const [activityByProject, setActivityByProject] = useState<Record<string, ProjectActivity>>({});

  useEffect(() => {
    if (!companyId) return;
    const unsubscribes = projects.flatMap((project) => [onSnapshot(collection(db, "companies", companyId, "projects", project.id, "boqItems"), (snapshot) => {
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as BoqItem);
      setProgressByProject((current) => ({ ...current, [project.id]: calculateProgress(items) }));
    }), onSnapshot(collection(db, "companies", companyId, "projects", project.id, "variations"), (snapshot) => {
      const variations = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Variation);
      const variationExposure = variations.filter((item) => item.status !== "rejected").reduce((total, item) => total + item.estimatedValue, 0);
      setActivityByProject((current) => ({ ...current, [project.id]: { variationExposure, latestReportDate: current[project.id]?.latestReportDate ?? null } }));
    }), onSnapshot(collection(db, "companies", companyId, "projects", project.id, "siteReports"), (snapshot) => {
      const reports = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as SiteReport).sort((left, right) => right.reportDate.localeCompare(left.reportDate));
      setActivityByProject((current) => ({ ...current, [project.id]: { variationExposure: current[project.id]?.variationExposure ?? 0, latestReportDate: reports[0]?.reportDate ?? null } }));
    })]);
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [companyId, projects]);

  return { progressByProject, activityByProject };
}

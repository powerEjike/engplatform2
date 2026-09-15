"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { BoqItem, Project, SiteReport, Valuation, Variation } from "@engplatform2/shared-types";
import { db } from "@/lib/firebase";

export type ProjectProgress = { percentage: number; plannedValue: number; completedValue: number; scheduleHealth: "on_track" | "attention" | "behind" };
export type ProjectActivity = { variationExposure: number; latestReportDate: string | null };

const calculateProgress = (items: BoqItem[], project: Project): ProjectProgress => {
  const plannedValue = items.reduce((total, item) => total + item.plannedQuantity * item.rate, 0);
  const completedValue = items.reduce((total, item) => total + item.cumulativeQuantityCompleted * item.rate, 0);
  const percentage = plannedValue > 0 ? Math.min(100, (completedValue / plannedValue) * 100) : 0;
  const start = new Date(`${project.startDate}T00:00:00`).getTime(); const end = new Date(`${project.endDate}T00:00:00`).getTime(); const now = Date.now();
  const expectedProgress = Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.min(100, Math.max(0, (now - start) / (end - start) * 100)) : 0;
  const scheduleHealth = percentage >= expectedProgress - 10 ? "on_track" : percentage >= expectedProgress - 25 ? "attention" : "behind";
  return { plannedValue, completedValue, percentage, scheduleHealth };
};

export function useProjectProgress(companyId: string | undefined, projects: Project[]) {
  const [progressByProject, setProgressByProject] = useState<Record<string, ProjectProgress>>({});
  const [activityByProject, setActivityByProject] = useState<Record<string, ProjectActivity>>({});
  const [variationsByProject, setVariationsByProject] = useState<Record<string, Variation[]>>({});
  const [valuationsByProject, setValuationsByProject] = useState<Record<string, Valuation[]>>({});

  useEffect(() => {
    if (!companyId) return;
    const unsubscribes = projects.flatMap((project) => [onSnapshot(collection(db, "companies", companyId, "projects", project.id, "boqItems"), (snapshot) => {
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as BoqItem);
      setProgressByProject((current) => ({ ...current, [project.id]: calculateProgress(items, project) }));
    }), onSnapshot(collection(db, "companies", companyId, "projects", project.id, "variations"), (snapshot) => {
      const variations = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Variation);
      setVariationsByProject((current) => ({ ...current, [project.id]: variations }));
      const variationExposure = variations.filter((item) => item.status !== "rejected").reduce((total, item) => total + item.estimatedValue, 0);
      setActivityByProject((current) => ({ ...current, [project.id]: { variationExposure, latestReportDate: current[project.id]?.latestReportDate ?? null } }));
    }), onSnapshot(collection(db, "companies", companyId, "projects", project.id, "siteReports"), (snapshot) => {
      const reports = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as SiteReport).sort((left, right) => right.reportDate.localeCompare(left.reportDate));
      setActivityByProject((current) => ({ ...current, [project.id]: { variationExposure: current[project.id]?.variationExposure ?? 0, latestReportDate: reports[0]?.reportDate ?? null } }));
    }), onSnapshot(collection(db, "companies", companyId, "projects", project.id, "valuations"), (snapshot) => {
      setValuationsByProject((current) => ({ ...current, [project.id]: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Valuation) }));
    })]);
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [companyId, projects]);

  return { progressByProject, activityByProject, variationsByProject, valuationsByProject };
}

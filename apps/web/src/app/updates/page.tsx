"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useProjects } from "@/hooks/use-projects";
import { useProjectProgress } from "@/hooks/use-project-progress";
import { canWorkOnProject } from "@/lib/project-access";

type UpdateItem = { id: string; title: string; detail: string; date: string; href: string; kind: "report" | "variation" | "valuation" };

export default function UpdatesPage() {
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId);
  const { reportsByProject, variationsByProject, valuationsByProject } = useProjectProgress(profile?.companyId, projects);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/onboarding");
  }, [isLoading, isProfileLoading, profile, router, user]);

  const updates = useMemo(() => {
    if (!profile || !user) return [];
    const accessibleProjects = projects.filter((project) => canWorkOnProject(profile.role, user.uid, project));
    const canSeeReports = ["site_engineer", "project_manager", "director"].includes(profile.role);
    const canSeeVariations = ["site_engineer", "project_manager", "quantity_surveyor", "director"].includes(profile.role);
    const canSeeValuations = ["quantity_surveyor", "director"].includes(profile.role);
    const items: UpdateItem[] = [];
    accessibleProjects.forEach((project) => {
      if (canSeeReports) (reportsByProject[project.id] ?? []).forEach((report) => items.push({ id: `report-${project.id}-${report.id}`, kind: "report", title: "Daily report submitted", detail: `${project.name} · ${report.labourCount} people on site${report.issues.length ? ` · ${report.issues.length} issue${report.issues.length === 1 ? "" : "s"} logged` : ""}`, date: report.createdAt || report.reportDate, href: `/projects/${project.id}` }));
      if (canSeeVariations) (variationsByProject[project.id] ?? []).forEach((variation) => items.push({ id: `variation-${project.id}-${variation.id}`, kind: "variation", title: `Variation ${variation.status.replaceAll("_", " ")}`, detail: `${project.name} · ${variation.description}`, date: variation.approvedAt || variation.reviewedAt || variation.raisedAt, href: `/projects/${project.id}` }));
      if (canSeeValuations) (valuationsByProject[project.id] ?? []).forEach((valuation) => items.push({ id: `valuation-${project.id}-${valuation.id}`, kind: "valuation", title: `Valuation ${valuation.status}`, detail: `${project.name} · ${valuation.certificateNumber}`, date: valuation.createdAt || valuation.valuationDate, href: `/projects/${project.id}` }));
    });
    return items.sort((left, right) => right.date.localeCompare(left.date));
  }, [profile, projects, reportsByProject, user, valuationsByProject, variationsByProject]);

  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening workspace updates…</main>;

  return <main className="report-page"><div className="schedule-content"><Link className="back-link" href="/">← Back to workspace</Link><section className="schedule-hero"><div><p className="eyebrow">Live notifications</p><h1>Workspace updates</h1><p>Recent reports, variations, and valuation activity from the projects available to your role.</p></div><div className="schedule-hero-metrics"><span><strong>{updates.length}</strong> recent update{updates.length === 1 ? "" : "s"}</span></div></section><section className="updates-list">{updates.length === 0 ? <p className="empty-state">There are no updates for your role yet. New site activity will appear here automatically.</p> : updates.map((update) => <Link className="update-row" href={update.href} key={update.id}><span className={`update-icon ${update.kind}`}>{update.kind === "report" ? "Report" : update.kind === "variation" ? "Variation" : "Valuation"}</span><div><h2>{update.title}</h2><p>{update.detail}</p></div><time dateTime={update.date}>{new Date(update.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</time></Link>)}</section></div></main>;
}

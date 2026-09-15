"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/dashboard-data";
import { useAuth } from "@/components/auth-provider";
import { useProjects } from "@/hooks/use-projects";
import { useProjectProgress } from "@/hooks/use-project-progress";
import { canWorkOnProject } from "@/lib/project-access";

export default function ValuationsPage() {
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId);
  const { valuationsByProject } = useProjectProgress(profile?.companyId, projects);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/onboarding");
  }, [isLoading, isProfileLoading, profile, router, user]);

  const certificates = useMemo(() => {
    if (!profile || !user) return [];
    return projects.filter((project) => canWorkOnProject(profile.role, user.uid, project)).flatMap((project) => (valuationsByProject[project.id] ?? []).map((valuation) => ({ ...valuation, projectName: project.name }))).sort((left, right) => right.valuationDate.localeCompare(left.valuationDate));
  }, [profile, projects, user, valuationsByProject]);
  const totalDue = certificates.reduce((total, certificate) => total + certificate.netAmountDue, 0);

  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening valuation register…</main>;

  return <main className="report-page"><div className="schedule-content"><Link className="back-link" href="/">← Back to workspace</Link><section className="schedule-hero"><div><p className="eyebrow">Commercial control</p><h1>Valuation register</h1><p>Every issued payment certificate across your available projects.</p></div><div className="schedule-hero-metrics"><span><strong>{certificates.length}</strong> certificate{certificates.length === 1 ? "" : "s"}</span><span><strong>{formatNaira(totalDue)}</strong> total net due</span></div></section><section className="valuation-portfolio-table"><div className="valuation-portfolio-head"><span>Certificate</span><span>Project</span><span>Date</span><span>Gross value</span><span>Net due</span></div>{certificates.length === 0 ? <p className="empty-state">No valuations have been issued yet.</p> : certificates.map((certificate) => <article className="valuation-portfolio-row" key={`${certificate.projectId}-${certificate.id}`}><div><span className="valuation-certificate">{certificate.certificateNumber}</span><p>{certificate.status}</p></div><Link className="project-name-link" href={`/projects/${certificate.projectId}`}>{certificate.projectName}</Link><span>{new Date(`${certificate.valuationDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span><strong>{formatNaira(certificate.grossValue)}</strong><strong className="valuation-net-value">{formatNaira(certificate.netAmountDue)}</strong></article>)}</section></div></main>;
}

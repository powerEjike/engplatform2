"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const [selectedProject, setSelectedProject] = useState("All projects");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/onboarding");
  }, [isLoading, isProfileLoading, profile, router, user]);

  const certificates = useMemo(() => {
    if (!profile || !user) return [];
    return projects.filter((project) => canWorkOnProject(profile.role, user.uid, project)).flatMap((project) => (valuationsByProject[project.id] ?? []).map((valuation) => ({ ...valuation, projectName: project.name }))).sort((left, right) => right.valuationDate.localeCompare(left.valuationDate));
  }, [profile, projects, user, valuationsByProject]);
  const visibleCertificates = certificates.filter((certificate) => selectedProject === "All projects" || certificate.projectId === selectedProject);
  const totalDue = visibleCertificates.reduce((total, certificate) => total + certificate.netAmountDue, 0);
  const downloadValuations = () => {
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = ["Certificate,Project,Valuation date,Gross value,Retention rate,Retention amount,Net amount due,Status", ...visibleCertificates.map((certificate) => [certificate.certificateNumber, certificate.projectName, certificate.valuationDate, certificate.grossValue, certificate.retentionRate, certificate.retentionAmount, certificate.netAmountDue, certificate.status].map(quote).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "engplatform2-valuation-register.csv"; link.click(); URL.revokeObjectURL(url);
  };

  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening valuation register…</main>;

  return <main className="report-page"><div className="schedule-content"><Link className="back-link" href="/">← Back to workspace</Link><section className="schedule-hero"><div><p className="eyebrow">Commercial control</p><h1>Valuation register</h1><p>Every issued payment certificate across your available projects.</p></div><div className="schedule-hero-metrics"><span><strong>{visibleCertificates.length}</strong> certificate{visibleCertificates.length === 1 ? "" : "s"}</span><span><strong>{formatNaira(totalDue)}</strong> total net due</span></div></section>{certificates.length > 0 && <div className="report-export-row"><label className="state-filter"><span>Project</span><select value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)}><option value="All projects">All projects</option>{projects.filter((project) => canWorkOnProject(profile.role, user.uid, project)).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><button className="secondary compact-action" type="button" disabled={visibleCertificates.length === 0} onClick={downloadValuations}>Download CSV</button></div>}<section className="valuation-portfolio-table"><div className="valuation-portfolio-head"><span>Certificate</span><span>Project</span><span>Date</span><span>Gross value</span><span>Net due</span></div>{certificates.length === 0 ? <p className="empty-state">No valuations have been issued yet.</p> : visibleCertificates.length === 0 ? <p className="empty-state">No valuations match this project.</p> : visibleCertificates.map((certificate) => <article className="valuation-portfolio-row" key={`${certificate.projectId}-${certificate.id}`}><div><span className="valuation-certificate">{certificate.certificateNumber}</span><p>{certificate.status}</p></div><Link className="project-name-link" href={`/projects/${certificate.projectId}`}>{certificate.projectName}</Link><span>{new Date(`${certificate.valuationDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span><strong>{formatNaira(certificate.grossValue)}</strong><strong className="valuation-net-value">{formatNaira(certificate.netAmountDue)}</strong></article>)}</section></div></main>;
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useProjects } from "@/hooks/use-projects";
import { useProjectProgress } from "@/hooks/use-project-progress";
import { canWorkOnProject } from "@/lib/project-access";

export default function ReportsPage() {
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId);
  const { reportsByProject } = useProjectProgress(profile?.companyId, projects);
  const [selectedProject, setSelectedProject] = useState("All projects");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/onboarding");
  }, [isLoading, isProfileLoading, profile, router, user]);

  const reports = useMemo(() => {
    if (!profile || !user) return [];
    return projects.filter((project) => canWorkOnProject(profile.role, user.uid, project)).flatMap((project) => (reportsByProject[project.id] ?? []).map((report) => ({ ...report, projectName: project.name }))).sort((left, right) => right.reportDate.localeCompare(left.reportDate));
  }, [profile, projects, reportsByProject, user]);
  const visibleReports = reports.filter((report) => selectedProject === "All projects" || report.projectId === selectedProject);
  const today = new Date().toISOString().slice(0, 10);
  const visibleProjects = projects.filter((project) => profile && user && canWorkOnProject(profile.role, user.uid, project));
  const todayReports = visibleReports.filter((report) => report.reportDate === today).length;
  const projectsWithoutTodayReport = visibleProjects.filter((project) => project.status === "active" && !(reportsByProject[project.id] ?? []).some((report) => report.reportDate === today));
  const reportedIssues = visibleReports.reduce((total, report) => total + report.issues.length, 0);
  const downloadReports = () => {
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = ["Report date,Project,Completed BOQ items,Labour on site,Equipment,Issues", ...visibleReports.map((report) => [report.reportDate, report.projectName, report.lineItems.length, report.labourCount, report.equipmentOnSite.join("; "), report.issues.map((issue) => `${issue.category.replaceAll("_", " ")}: ${issue.note}`).join("; ")].map(quote).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "engplatform2-daily-reports.csv"; link.click(); URL.revokeObjectURL(url);
  };

  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening daily reports…</main>;

  return <main className="report-page"><div className="schedule-content"><Link className="back-link" href="/">← Back to workspace</Link><section className="schedule-hero"><div><p className="eyebrow">Operations control</p><h1>Daily reports</h1><p>Review site activity, labour, completed BOQ items, equipment, and recorded issues across your projects.</p></div><div className="schedule-hero-metrics"><span><strong>{todayReports}</strong> submitted today</span><span><strong>{reportedIssues}</strong> recorded issues</span></div></section>{projectsWithoutTodayReport.length > 0 && <section className="schedule-alert-card report-coverage-alert"><div><p className="eyebrow">Today&apos;s coverage</p><h2>{projectsWithoutTodayReport.length} project{projectsWithoutTodayReport.length === 1 ? "" : "s"} still need a site report</h2><p>Use this list to follow up before the end of the working day.</p></div><div className="schedule-alert-links">{projectsWithoutTodayReport.slice(0, 4).map((project) => <Link className="text-action" href={`/projects/${project.id}/reports/new`} key={project.id}>{project.name} → report</Link>)}</div></section>}{reports.length > 0 && <div className="report-export-row"><label className="state-filter"><span>Project</span><select value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)}><option value="All projects">All projects</option>{visibleProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><button className="secondary compact-action" type="button" disabled={visibleReports.length === 0} onClick={downloadReports}>Download CSV</button></div>}<section className="reports-portfolio-list">{reports.length === 0 ? <p className="empty-state">No daily reports have been submitted yet.</p> : visibleReports.length === 0 ? <p className="empty-state">No reports match this project.</p> : visibleReports.map((report) => <article className="reports-portfolio-row" key={`${report.projectId}-${report.id}`}><div><span className="report-history-date">{new Date(`${report.reportDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span><Link className="project-name-link" href={`/projects/${report.projectId}`}><h2>{report.projectName}</h2></Link></div><p><span>Completed items</span><strong>{report.lineItems.length}</strong></p><p><span>Labour on site</span><strong>{report.labourCount}</strong></p><p className="reports-portfolio-issue">{report.equipmentOnSite.length > 0 && <><b>Equipment</b> · {report.equipmentOnSite.join(", ")}<br /></>}{report.issues[0] ? <><b>{report.issues[0].category.replaceAll("_", " ")}</b> · {report.issues[0].note}</> : report.equipmentOnSite.length === 0 ? "No issue or equipment recorded" : "No issue recorded"}</p></article>)}</section></div></main>;
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useProjects } from "@/hooks/use-projects";
import { useProjectProgress } from "@/hooks/use-project-progress";
import { canWorkOnProject } from "@/lib/project-access";

export default function IssuesPage() {
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId);
  const { reportsByProject } = useProjectProgress(profile?.companyId, projects);
  const [selectedProject, setSelectedProject] = useState("All projects");
  const [selectedCategory, setSelectedCategory] = useState("All issue types");
  useEffect(() => { if (!isLoading && !user) router.replace("/login"); if (!isProfileLoading && user && !profile) router.replace("/access"); }, [isLoading, isProfileLoading, profile, router, user]);
  const issues = useMemo(() => {
    if (!profile || !user) return [];
    return projects.filter((project) => canWorkOnProject(profile.role, user.uid, project)).flatMap((project) => (reportsByProject[project.id] ?? []).flatMap((report) => report.issues.map((issue) => ({ ...issue, projectId: project.id, projectName: project.name, reportDate: report.reportDate })))).sort((left, right) => right.reportDate.localeCompare(left.reportDate));
  }, [profile, projects, reportsByProject, user]);
  const visibleIssues = issues.filter((issue) => (selectedProject === "All projects" || issue.projectId === selectedProject) && (selectedCategory === "All issue types" || issue.category === selectedCategory));
  const issueSummary = ["weather", "material_shortage", "access", "other"].map((category) => ({ category, count: visibleIssues.filter((issue) => issue.category === category).length })).filter((item) => item.count > 0);
  const downloadIssues = () => {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = ["Report date,Project,Issue type,Issue details", ...visibleIssues.map((issue) => [issue.reportDate, issue.projectName, issue.category.replaceAll("_", " "), issue.note].map(quote).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "engplatform2-issues-register.csv"; link.click(); URL.revokeObjectURL(url);
  };
  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening issues register…</main>;
  return <main className="report-page"><div className="schedule-content"><Link className="back-link" href="/dashboard">← Back to workspace</Link><section className="schedule-hero"><div><p className="eyebrow">Site risk control</p><h1>Issues register</h1><p>Issues recorded by site teams in daily reports, ordered from newest to oldest.</p></div><div className="schedule-hero-metrics"><span><strong>{visibleIssues.length}</strong> recorded issue{visibleIssues.length === 1 ? "" : "s"}</span></div></section><section className="issue-filters" aria-label="Filter issues"><label className="state-filter"><span>Project</span><select value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)}><option value="All projects">All projects</option>{projects.filter((project) => canWorkOnProject(profile.role, user.uid, project)).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="state-filter"><span>Issue type</span><select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option value="All issue types">All issue types</option><option value="weather">Weather</option><option value="material_shortage">Material shortage</option><option value="access">Access</option><option value="other">Other</option></select></label><button className="secondary compact-action" type="button" disabled={visibleIssues.length === 0} onClick={downloadIssues}>Download CSV</button></section>{issueSummary.length > 0 && <section className="role-guide">{issueSummary.map((item) => <p key={item.category}><strong>{item.count}</strong><span>{item.category.replaceAll("_", " ")} issue{item.count === 1 ? "" : "s"}</span></p>)}</section>}<section className="issues-list">{issues.length === 0 ? <p className="empty-state">No site issues have been recorded yet.</p> : visibleIssues.length === 0 ? <p className="empty-state">No issues match these filters.</p> : visibleIssues.map((issue, index) => <article className="issue-row" key={`${issue.projectId}-${issue.reportDate}-${index}`}><span className={`issue-category ${issue.category}`}>{issue.category.replaceAll("_", " ")}</span><div><Link className="project-name-link" href={`/projects/${issue.projectId}`}><h2>{issue.projectName}</h2></Link><p>{issue.note}</p></div><time>{new Date(`${issue.reportDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</time></article>)}</section></div></main>;
}

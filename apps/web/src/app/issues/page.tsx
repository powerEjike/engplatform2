"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
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
  useEffect(() => { if (!isLoading && !user) router.replace("/login"); if (!isProfileLoading && user && !profile) router.replace("/onboarding"); }, [isLoading, isProfileLoading, profile, router, user]);
  const issues = useMemo(() => {
    if (!profile || !user) return [];
    return projects.filter((project) => canWorkOnProject(profile.role, user.uid, project)).flatMap((project) => (reportsByProject[project.id] ?? []).flatMap((report) => report.issues.map((issue) => ({ ...issue, projectId: project.id, projectName: project.name, reportDate: report.reportDate })))).sort((left, right) => right.reportDate.localeCompare(left.reportDate));
  }, [profile, projects, reportsByProject, user]);
  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening issues register…</main>;
  return <main className="report-page"><div className="schedule-content"><Link className="back-link" href="/">← Back to workspace</Link><section className="schedule-hero"><div><p className="eyebrow">Site risk control</p><h1>Issues register</h1><p>Issues recorded by site teams in daily reports, ordered from newest to oldest.</p></div><div className="schedule-hero-metrics"><span><strong>{issues.length}</strong> recorded issue{issues.length === 1 ? "" : "s"}</span></div></section><section className="issues-list">{issues.length === 0 ? <p className="empty-state">No site issues have been recorded yet.</p> : issues.map((issue, index) => <article className="issue-row" key={`${issue.projectId}-${issue.reportDate}-${index}`}><span className={`issue-category ${issue.category}`}>{issue.category.replaceAll("_", " ")}</span><div><Link className="project-name-link" href={`/projects/${issue.projectId}`}><h2>{issue.projectName}</h2></Link><p>{issue.note}</p></div><time>{new Date(`${issue.reportDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</time></article>)}</section></div></main>;
}

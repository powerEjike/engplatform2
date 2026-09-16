"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useProjects } from "@/hooks/use-projects";
import { useProjectProgress } from "@/hooks/use-project-progress";
import { useScheduleMilestones } from "@/hooks/use-schedule-milestones";
import { canWorkOnProject } from "@/lib/project-access";

function expectedProgress(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.min(100, Math.max(0, Math.round(((Date.now() - start) / (end - start)) * 100)));
}

export default function SchedulePage() {
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId);
  const { progressByProject } = useProjectProgress(profile?.companyId, projects);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/onboarding");
  }, [isLoading, isProfileLoading, profile, router, user]);

  const visibleProjects = useMemo(() => {
    if (!profile || !user) return [];
    return projects.filter((project) => canWorkOnProject(profile.role, user.uid, project));
  }, [profile, projects, user]);
  const behindCount = visibleProjects.filter((project) => progressByProject[project.id]?.scheduleHealth === "behind").length;
  const attentionCount = visibleProjects.filter((project) => progressByProject[project.id]?.scheduleHealth === "attention").length;
  const { milestones } = useScheduleMilestones(profile?.companyId, visibleProjects);
  const today = new Date().toISOString().slice(0, 10);
  const dueSoon = milestones.filter((milestone) => milestone.status !== "complete" && milestone.plannedDate >= today).slice(0, 5);
  const overdue = milestones.filter((milestone) => milestone.status !== "complete" && milestone.plannedDate < today);

  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening programme control…</main>;

  return <main className="report-page"><div className="schedule-content"><Link className="back-link" href="/">← Back to workspace</Link><section className="schedule-hero"><div><p className="eyebrow">Programme control</p><h1>Schedule health</h1><p>Compare completed BOQ value against each project&apos;s elapsed programme time.</p></div><div className="schedule-hero-metrics"><span><strong>{behindCount}</strong> behind plan</span><span><strong>{attentionCount}</strong> need attention</span></div></section>{(overdue.length > 0 || dueSoon.length > 0) && <section className="milestone-summary"><div><h2>Milestone watch</h2><p>Open a project milestone to update its recorded progress.</p></div>{overdue.length > 0 && <article className="milestone-watch overdue"><strong>{overdue.length} overdue</strong><span>{overdue.slice(0, 2).map((milestone) => `${milestone.projectName}: ${milestone.title}`).join(" · ")}</span></article>}{dueSoon.length > 0 && <article className="milestone-watch"><strong>Next due</strong>{dueSoon.map((milestone) => <Link key={milestone.id} href={`/projects/${milestone.projectId}/schedule`}>{milestone.projectName}: {milestone.title} — {new Date(`${milestone.plannedDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</Link>)}</article>}</section>}<section className="schedule-table"><div className="schedule-table-head"><span>Project</span><span>Programme</span><span>Actual progress</span><span>Expected</span><span>Health</span></div>{visibleProjects.length === 0 && <p className="empty-state">No projects are available for your schedule view yet.</p>}{visibleProjects.map((project) => { const progress = progressByProject[project.id]; const actual = Math.round(progress?.percentage ?? 0); const expected = expectedProgress(project.startDate, project.endDate); const health = progress?.plannedValue ? progress.scheduleHealth : "on_track"; return <article className="schedule-row" key={project.id}><div><Link className="project-name-link" href={`/projects/${project.id}/schedule`}><h2>{project.name}</h2></Link><p>{project.siteEngineerName ? `Site Engineer: ${project.siteEngineerName}` : "Site Engineer not assigned"}</p><Link className="milestone-link" href={`/projects/${project.id}/schedule`}>View milestones →</Link></div><p><strong>{new Date(`${project.startDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</strong><span>to {new Date(`${project.endDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span></p><div className="schedule-progress"><strong>{progress?.plannedValue ? `${actual}%` : "Setup needed"}</strong>{progress?.plannedValue && <div className="progress-track"><span style={{ width: `${actual}%` }} /></div>}</div><strong className="schedule-expected">{progress?.plannedValue ? `${expected}%` : "—"}</strong><span className={`status ${health}`}>{progress?.plannedValue ? health.replace("_", " ") : "Setup"}</span></article>; })}</section><p className="schedule-note">Schedule health is calculated from BOQ value completed compared with elapsed time between the project start and planned end dates.</p></div></main>;
}

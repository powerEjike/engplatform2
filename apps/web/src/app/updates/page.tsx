"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useProjects } from "@/hooks/use-projects";
import { useProjectProgress } from "@/hooks/use-project-progress";
import { useBoqUploadEvents } from "@/hooks/use-boq-upload-events";
import { useScheduleMilestones } from "@/hooks/use-schedule-milestones";
import { canWorkOnProject } from "@/lib/project-access";

type UpdateKind = "report" | "variation" | "valuation" | "boq" | "milestone" | "project";
type UpdateItem = { id: string; projectId: string; projectName: string; title: string; detail: string; date: string; href: string; kind: UpdateKind };
const updateDate = (value: unknown) => value && typeof value === "object" && "toDate" in value ? (value as { toDate: () => Date }).toDate().toISOString() : String(value ?? "");
const readStorageKey = (companyId: string, userId: string) => `engplatform2:workspace-updates-read:${companyId}:${userId}`;
const kindLabel = (kind: UpdateKind) => ({ project: "Project", report: "Report", variation: "Variation", boq: "BOQ", milestone: "Milestone", valuation: "Valuation" })[kind];

export default function UpdatesPage() {
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId, profile?.role, user?.uid);
  const { reportsByProject, variationsByProject, valuationsByProject } = useProjectProgress(profile?.companyId, projects);
  const { eventsByProject } = useBoqUploadEvents(profile?.companyId, projects);
  const { milestones } = useScheduleMilestones(profile?.companyId, projects);
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/access");
  }, [isLoading, isProfileLoading, profile, router, user]);

  useEffect(() => {
    if (!profile || !user) return;
    const timer = window.setTimeout(() => {
      try { setReadIds(JSON.parse(localStorage.getItem(readStorageKey(profile.companyId, user.uid)) ?? "[]") as string[]); }
      catch { setReadIds([]); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profile, user]);

  const updates = useMemo(() => {
    if (!profile || !user) return [];
    const accessibleProjects = projects.filter((project) => profile.role === "project_manager" ? project.projectManagerId === user.uid : canWorkOnProject(profile.role, user.uid, project));
    const canSeeValuations = ["quantity_surveyor", "director"].includes(profile.role);
    const items: UpdateItem[] = [];
    accessibleProjects.forEach((project) => {
      const base = { projectId: project.id, projectName: project.name };
      const isAssignedProject = (profile.role === "project_manager" && project.projectManagerId === user.uid) || (profile.role === "site_engineer" && project.siteEngineerId === user.uid);
      if (isAssignedProject) {
        const assignmentDate = updateDate(project.assignmentUpdatedAt) || updateDate(project.createdAt);
        items.push({ ...base, id: `project-${project.id}-${user.uid}-${assignmentDate}`, kind: "project", title: "Project assigned to you", detail: `${project.location}, ${project.state}`, date: assignmentDate, href: `/projects/${project.id}` });
      }
      (reportsByProject[project.id] ?? []).forEach((report) => items.push({ ...base, id: `report-${project.id}-${report.id}`, kind: "report", title: "Daily report submitted", detail: `${report.labourCount} people on site${report.issues.length ? ` · ${report.issues.length} issue${report.issues.length === 1 ? "" : "s"} logged` : ""}`, date: updateDate(report.createdAt) || report.reportDate, href: `/projects/${project.id}` }));
      (variationsByProject[project.id] ?? []).forEach((variation) => items.push({ ...base, id: `variation-${project.id}-${variation.id}`, kind: "variation", title: `Variation ${variation.status.replaceAll("_", " ")}`, detail: variation.description, date: updateDate(variation.approvedAt || variation.reviewedAt || variation.raisedAt), href: `/projects/${project.id}` }));
      if (canSeeValuations) (valuationsByProject[project.id] ?? []).forEach((valuation) => items.push({ ...base, id: `valuation-${project.id}-${valuation.id}`, kind: "valuation", title: `Valuation ${valuation.status}`, detail: valuation.certificateNumber, date: updateDate(valuation.createdAt) || valuation.valuationDate, href: `/projects/${project.id}` }));
      (eventsByProject[project.id] ?? []).forEach((upload) => items.push({ ...base, id: `boq-${project.id}-${upload.id}`, kind: "boq", title: "BOQ uploaded", detail: `${upload.itemCount} BOQ item${upload.itemCount === 1 ? "" : "s"} are now ready for project delivery.`, date: updateDate(upload.createdAt), href: `/projects/${project.id}` }));
    });
    milestones.filter((milestone) => accessibleProjects.some((project) => project.id === milestone.projectId)).forEach((milestone) => items.push({ projectId: milestone.projectId, projectName: milestone.projectName, id: `milestone-${milestone.projectId}-${milestone.id}`, kind: "milestone", title: `Milestone ${milestone.status.replaceAll("_", " ")}`, detail: `${milestone.title} · ${milestone.progress}% progress`, date: updateDate(milestone.updatedAt || milestone.createdAt) || milestone.plannedDate, href: `/projects/${milestone.projectId}/schedule` }));
    return items.sort((left, right) => right.date.localeCompare(left.date));
  }, [eventsByProject, milestones, profile, projects, reportsByProject, user, valuationsByProject, variationsByProject]);

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadCount = updates.filter((update) => !readSet.has(update.id)).length;
  const groupedUpdates = useMemo(() => Array.from(updates.reduce((groups, update) => { const current = groups.get(update.projectId) ?? { name: update.projectName, items: [] as UpdateItem[] }; current.items.push(update); groups.set(update.projectId, current); return groups; }, new Map<string, { name: string; items: UpdateItem[] }>()).entries()), [updates]);
  const saveReadIds = (next: string[]) => { setReadIds(next); if (profile && user) localStorage.setItem(readStorageKey(profile.companyId, user.uid), JSON.stringify(next)); };
  const markRead = (id: string) => { if (!readSet.has(id)) saveReadIds([...readIds, id]); };
  const markAllRead = () => saveReadIds(updates.map((update) => update.id));

  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening workspace updates…</main>;

  return <main className="report-page"><div className="schedule-content"><Link className="back-link" href="/dashboard">← Back to workspace</Link><section className="schedule-hero"><div><p className="eyebrow">Live notifications</p><h1>Workspace updates</h1><p>Activity is grouped by project so every delivery team can quickly see what changed and where attention is needed.</p></div><div className="schedule-hero-metrics"><span><strong>{unreadCount}</strong> unread</span><span><strong>{updates.length}</strong> total</span></div></section><div className="updates-controls"><p>{unreadCount ? `${unreadCount} update${unreadCount === 1 ? "" : "s"} still need your attention.` : "You are all caught up."}</p><button className="secondary compact-action" type="button" disabled={unreadCount === 0} onClick={markAllRead}>Mark all as read</button></div><section className="updates-list">{updates.length === 0 ? <p className="empty-state">There are no updates for your role yet. New site activity will appear here automatically.</p> : groupedUpdates.map(([projectId, group]) => <section className="updates-project-group" key={projectId}><header><div><p className="eyebrow">Project activity</p><h2>{group.name}</h2></div><span>{group.items.length} update{group.items.length === 1 ? "" : "s"}</span></header>{group.items.map((update) => <Link className={`update-row ${readSet.has(update.id) ? "read" : "unread"}`} href={update.href} key={update.id} onClick={() => markRead(update.id)}><span className={`update-icon ${update.kind}`}>{kindLabel(update.kind)}</span><div><h3>{update.title}</h3><p>{update.detail}</p></div><span className="update-state">{readSet.has(update.id) ? "Read" : "New"}</span><time dateTime={update.date}>{new Date(update.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</time></Link>)}</section>)}</section></div></main>;
}

"use client";

import Link from "next/link";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useProjects } from "@/hooks/use-projects";
import { db } from "@/lib/firebase";
import { canWorkOnProject } from "@/lib/project-access";
import type { MilestoneStatus, ProjectMilestone } from "@engplatform2/shared-types";

const statusLabel: Record<MilestoneStatus, string> = { not_started: "Not started", in_progress: "In progress", complete: "Complete" };

function readableDate(value?: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "Not recorded";
}

function quoteCsv(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function ProjectMilestonesPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = String(params.projectId);
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [title, setTitle] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [status, setStatus] = useState<MilestoneStatus>("not_started");
  const [progress, setProgress] = useState("0");
  const [actualDate, setActualDate] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<MilestoneStatus>("not_started");
  const [editProgress, setEditProgress] = useState("0");
  const [editActualDate, setEditActualDate] = useState("");
  const [editNote, setEditNote] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/onboarding");
  }, [isLoading, isProfileLoading, profile, router, user]);

  useEffect(() => {
    if (!profile?.companyId || !projectId) return;
    return onSnapshot(query(collection(db, "companies", profile.companyId, "projects", projectId, "milestones"), orderBy("plannedDate", "asc")), (snapshot) => {
      setMilestones(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as ProjectMilestone));
    }, () => setMessage("Milestones could not be loaded. Confirm the updated Firestore rules have been published."));
  }, [profile?.companyId, projectId]);

  const project = useMemo(() => projects.find((item) => item.id === projectId), [projectId, projects]);
  const canManage = profile?.role === "director" || profile?.role === "project_manager";
  const canView = Boolean(project && user && profile && canWorkOnProject(profile.role, user.uid, project));

  async function addMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !user || !title.trim() || !plannedDate) return;
    const numericProgress = Math.min(100, Math.max(0, Number(progress) || 0));
    setIsSaving(true);
    setMessage("");
    try {
      await addDoc(collection(db, "companies", profile.companyId, "projects", projectId, "milestones"), {
        projectId,
        title: title.trim(),
        plannedDate,
        actualDate: actualDate || null,
        status,
        progress: status === "complete" ? 100 : numericProgress,
        note: note.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTitle(""); setPlannedDate(""); setActualDate(""); setStatus("not_started"); setProgress("0"); setNote("");
      setMessage("Milestone added to the project schedule.");
    } catch {
      setMessage("We could not save this milestone. Confirm the updated Firestore rules have been published.");
    } finally { setIsSaving(false); }
  }

  async function completeMilestone(milestone: ProjectMilestone) {
    if (!profile) return;
    setMessage("");
    try {
      await updateDoc(doc(db, "companies", profile.companyId, "projects", projectId, "milestones", milestone.id), { status: "complete", progress: 100, actualDate: new Date().toISOString().slice(0, 10), updatedAt: serverTimestamp() });
      setMessage(`Marked “${milestone.title}” complete.`);
    } catch { setMessage("We could not update this milestone. Confirm the updated Firestore rules have been published."); }
  }

  function startEditing(milestone: ProjectMilestone) {
    setEditingId(milestone.id);
    setEditStatus(milestone.status);
    setEditProgress(String(milestone.progress ?? 0));
    setEditActualDate(milestone.actualDate ?? "");
    setEditNote(milestone.note ?? "");
  }

  async function saveProgress(milestone: ProjectMilestone) {
    if (!profile) return;
    const numericProgress = Math.min(100, Math.max(0, Number(editProgress) || 0));
    const nextStatus = numericProgress === 100 ? "complete" : editStatus;
    setIsSaving(true);
    setMessage("");
    try {
      await updateDoc(doc(db, "companies", profile.companyId, "projects", projectId, "milestones", milestone.id), {
        status: nextStatus,
        progress: nextStatus === "complete" ? 100 : numericProgress,
        actualDate: editActualDate || (nextStatus === "complete" ? new Date().toISOString().slice(0, 10) : null),
        note: editNote.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditingId(null);
      setMessage(`Updated progress for “${milestone.title}”.`);
    } catch { setMessage("We could not update this milestone. Confirm the updated Firestore rules have been published."); }
    finally { setIsSaving(false); }
  }

  function downloadProgramme() {
    const rows = [
      ["Milestone", "Planned completion", "Actual completion", "Status", "Progress (%)", "Delivery note"],
      ...milestones.map((milestone) => [milestone.title, milestone.plannedDate, milestone.actualDate ?? "", statusLabel[milestone.status], milestone.progress, milestone.note ?? ""]),
    ];
    const file = new Blob([rows.map((row) => row.map(quoteCsv).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project?.name.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase() ?? "project"}-milestones.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening project schedule…</main>;
  if (!project || !canView) return <main className="report-page"><div className="report-content"><Link className="back-link" href="/schedule">← Back to schedule health</Link><section className="report-card"><h1>Project unavailable</h1><p className="report-intro">This project is not available in your workspace.</p></section></div></main>;

  const completeCount = milestones.filter((item) => item.status === "complete").length;
  const averageProgress = milestones.length ? Math.round(milestones.reduce((total, item) => total + Number(item.progress || 0), 0) / milestones.length) : 0;

  return <main className="report-page"><div className="report-content"><Link className="back-link" href="/schedule">← Back to schedule health</Link><section className="report-card"><p className="eyebrow">Project programme</p><h1>{project.name} milestones</h1><p className="report-intro">Set the key delivery points for this project and keep their progress visible to the whole project team.</p><div className="schedule-hero-metrics"><span><strong>{completeCount}/{milestones.length}</strong> complete</span><span><strong>{averageProgress}%</strong> average progress</span></div><button className="outline-button milestone-download" type="button" onClick={downloadProgramme} disabled={milestones.length === 0}>Download programme CSV</button></section><div className="milestone-layout">{canManage && <section className="milestone-card"><h2>Add milestone</h2><p>Directors and Project Managers can set the programme milestones.</p><form className="milestone-form" onSubmit={addMilestone}><label>Milestone name<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Foundation complete" required /></label><label>Planned completion date<input type="date" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} required /></label><div className="milestone-fields"><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as MilestoneStatus)}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Progress (%)<input type="number" min="0" max="100" value={progress} onChange={(event) => setProgress(event.target.value)} /></label></div><label>Actual completion date <span className="field-hint">optional</span><input type="date" value={actualDate} onChange={(event) => setActualDate(event.target.value)} /></label><label>Delivery note <span className="field-hint">optional</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What must be delivered, or what needs attention?" /></label><button disabled={isSaving}>{isSaving ? "Saving…" : "Add milestone"}</button></form>{message && <p className={message.startsWith("We could") ? "form-error" : "form-success"}>{message}</p>}</section>}<section className="milestone-card"><h2>Project milestones</h2><p>{milestones.length ? "The team can view progress here as delivery moves forward." : "No milestones have been added yet."}</p>{!canManage && message && <p className="form-error">{message}</p>}<div className="milestone-list">{milestones.map((milestone) => <article className="milestone-item" key={milestone.id}><div className="milestone-item-top"><div><h3>{milestone.title}</h3><p>Planned: {readableDate(milestone.plannedDate)} · Actual: {readableDate(milestone.actualDate)}</p></div><span className={`status milestone-status ${milestone.status}`}>{statusLabel[milestone.status]}</span></div>{milestone.note && <p className="milestone-note">{milestone.note}</p>}<div className="milestone-progress"><div><span>Recorded progress</span><strong>{milestone.progress}%</strong></div><div className="progress-track"><span style={{ width: `${Math.min(100, Math.max(0, Number(milestone.progress || 0)))}%` }} /></div></div>{canManage && editingId === milestone.id && <div className="milestone-update"><label>Status<select value={editStatus} onChange={(event) => setEditStatus(event.target.value as MilestoneStatus)}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Progress (%)<input type="number" min="0" max="100" value={editProgress} onChange={(event) => setEditProgress(event.target.value)} /></label><label>Actual date<input type="date" value={editActualDate} onChange={(event) => setEditActualDate(event.target.value)} /></label><label className="milestone-note-field">Delivery note<textarea value={editNote} onChange={(event) => setEditNote(event.target.value)} /></label><div><button className="milestone-complete" disabled={isSaving} onClick={() => void saveProgress(milestone)}>{isSaving ? "Saving…" : "Save update"}</button><button className="text-button" onClick={() => setEditingId(null)}>Cancel</button></div></div>}{canManage && editingId !== milestone.id && <div className="milestone-actions"><button className="outline-button milestone-complete" onClick={() => startEditing(milestone)}>Update progress</button>{milestone.status !== "complete" && <button className="milestone-complete" onClick={() => void completeMilestone(milestone)}>Mark complete</button>}</div>}</article>)}</div></section></div></div></main>;
}

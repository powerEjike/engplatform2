"use client";

import Link from "next/link";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { useProjects } from "@/hooks/use-projects";
import { useCompanyUsers } from "@/hooks/use-company-users";

export default function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>(); const projectId = params.projectId; const router = useRouter(); const { user, profile, isLoading, isProfileLoading } = useAuth(); const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId, profile?.role, user?.uid); const { users, isLoading: usersLoading } = useCompanyUsers(profile?.companyId); const project = projects.find((item) => item.id === projectId);
  const [name, setName] = useState(""); const [clientName, setClientName] = useState(""); const [location, setLocation] = useState(""); const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState(""); const [status, setStatus] = useState("active"); const [projectManagerId, setProjectManagerId] = useState(""); const [siteEngineerId, setSiteEngineerId] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (!isLoading && !user) router.replace("/login"); if (!isProfileLoading && user && !profile) router.replace("/access"); }, [isLoading, isProfileLoading, profile, router, user]);
  const siteEngineers = users.filter((item) => item.role === "site_engineer");
  const projectManagers = users.filter((item) => item.role === "project_manager");
  const isDirector = profile?.role === "director";
  const isAssignedManager = profile?.role === "project_manager" && project?.projectManagerId === user?.uid;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !project || !user) return;
    const nextEngineerId = siteEngineerId || project.siteEngineerId || "";
    const assignedEngineer = siteEngineers.find((item) => item.id === nextEngineerId);
    if (!nextEngineerId || !assignedEngineer) return setError("Choose an active Site Engineer for this project.");
    setSaving(true); setError("");
    try {
      const projectRef = doc(db, "companies", profile.companyId, "projects", projectId);
      const batch = writeBatch(db);
      if (isAssignedManager && !isDirector) {
        batch.update(projectRef, { siteEngineerId: nextEngineerId, siteEngineerName: assignedEngineer.name, assignmentUpdatedAt: serverTimestamp() });
        batch.set(doc(collection(db, "companies", profile.companyId, "projects", projectId, "activityLog")), { action: "site_engineer_assigned", summary: `${profile.name} assigned ${assignedEngineer.name} as Site Engineer.`, actorId: user.uid, actorName: profile.name, actorRole: profile.role, createdAt: serverTimestamp() });
      } else {
        const nextName = name || project.name; const nextClientName = clientName || project.clientName; const nextLocation = location || project.location; const nextStartDate = startDate || project.startDate; const nextEndDate = endDate || project.endDate; const nextStatus = status || project.status; const nextManagerId = projectManagerId || project.projectManagerId || ""; const assignedManager = projectManagers.find((item) => item.id === nextManagerId);
        if (nextEndDate < nextStartDate) return setError("The planned end date must be after the start date.");
        batch.update(projectRef, { name: nextName.trim(), clientName: nextClientName.trim(), location: nextLocation.trim(), startDate: nextStartDate, endDate: nextEndDate, status: nextStatus, projectManagerId: nextManagerId || null, projectManagerName: assignedManager?.name ?? null, siteEngineerId: nextEngineerId, siteEngineerName: assignedEngineer.name, assignmentUpdatedAt: serverTimestamp() });
        batch.set(doc(collection(db, "companies", profile.companyId, "securityAudit")), { actorId: user.uid, actorName: profile.name, actorRole: "director", action: "project_settings_updated", entityType: "project", entityId: projectId, entityName: nextName.trim(), before: { status: project.status, projectManagerId: project.projectManagerId ?? null, siteEngineerId: project.siteEngineerId ?? null }, after: { status: nextStatus, projectManagerId: nextManagerId || null, siteEngineerId: nextEngineerId }, createdAt: serverTimestamp() });
      }
      await batch.commit(); router.replace(`/projects/${projectId}`);
    } catch { setError("We could not update this project. Please try again."); setSaving(false); }
  };
  if (isLoading || isProfileLoading || projectsLoading || usersLoading || !user || !profile) return <main className="auth-loading">Opening project settings…</main>; if (!project) return <main className="auth-loading">Project not found. <Link href="/dashboard">Return to dashboard</Link></main>; if (!isDirector && !isAssignedManager) return <main className="auth-loading">Only the assigned Project Manager or a Director can manage this project team. <Link href={`/projects/${projectId}`}>Return to project</Link></main>;
  return <main className="report-page"><div className="report-content"><Link className="back-link" href={`/projects/${projectId}`}>← Back to {project.name}</Link><section className="report-card"><p className="eyebrow">Project management</p><h1>{isDirector ? "Project settings" : "Assign Site Engineer"}</h1><p className="report-intro">{isDirector ? "Keep the client, location, programme dates, current status, and team responsibility accurate." : "Set the Site Engineer responsible for daily site activity on your project."}</p><form className="report-form" onSubmit={submit}>{isDirector && <><section className="report-section"><label className="report-labour-field">Project name<input value={name || project.name} onChange={(event) => setName(event.target.value)} required /></label><label className="report-labour-field">Client name<input value={clientName || project.clientName} onChange={(event) => setClientName(event.target.value)} required /></label><label className="report-labour-field">Location<input value={location || project.location} onChange={(event) => setLocation(event.target.value)} required /></label></section><section className="report-section"><div className="boq-number-fields"><label className="report-labour-field">Start date<input type="date" value={startDate || project.startDate} onChange={(event) => setStartDate(event.target.value)} required /></label><label className="report-labour-field">Planned end date<input type="date" value={endDate || project.endDate} onChange={(event) => setEndDate(event.target.value)} required /></label></div><label className="report-labour-field">Project status<select value={status || project.status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option></select></label></section></>}<section className="report-section"><h2>Project team</h2>{isDirector && <label className="report-labour-field">Project Manager<select value={projectManagerId || project.projectManagerId || ""} onChange={(event) => setProjectManagerId(event.target.value)}><option value="">Not assigned</option>{projectManagers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name} — {manager.email}</option>)}</select></label>}<label className="report-labour-field">Site Engineer<select value={siteEngineerId || project.siteEngineerId || ""} onChange={(event) => setSiteEngineerId(event.target.value)}><option value="">Choose a Site Engineer</option>{siteEngineers.filter((engineer) => engineer.active).map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.name} — {engineer.email}</option>)}</select></label>{siteEngineers.length === 0 && <p className="form-error">No Site Engineer has been added to this workspace yet.</p>}</section>{error && <p className="form-error">{error}</p>}<div className="report-submit-row"><p className="report-intro">{isDirector ? "Directors control contract and company settings. The Project Manager controls the Site Engineer allocation for this project." : "This changes only your project’s Site Engineer allocation."}</p><button disabled={saving}>{saving ? "Saving changes…" : "Save Site Engineer"}</button></div></form></section></div></main>;
}

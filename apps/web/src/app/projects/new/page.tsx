"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { useCompanyUsers } from "@/hooks/use-company-users";
import { beginSyncOperation, completeSyncOperation, failSyncOperation } from "@/lib/offline-sync";
import Link from "next/link";

const states = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];
const draftKey = (companyId: string) => `engplatform2:project-draft:${companyId}`;

export default function NewProjectPage() {
  const router = useRouter(); const { user, profile } = useAuth();
  const { users, isLoading: usersLoading } = useCompanyUsers(profile?.companyId);
  const [name, setName] = useState(""); const [clientName, setClientName] = useState("");
  const [contractSum, setContractSum] = useState(""); const [location, setLocation] = useState("");
  const [state, setState] = useState("FCT Abuja"); const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState("");
  const [projectManagerId, setProjectManagerId] = useState(""); const [siteEngineerId, setSiteEngineerId] = useState("");
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const [draftReady, setDraftReady] = useState(false); const [draftMessage, setDraftMessage] = useState("");
  const projectManagers = users.filter((member) => member.role === "project_manager"); const siteEngineers = users.filter((member) => member.role === "site_engineer");
  const companyId = profile?.companyId;
  useEffect(() => {
    if (!companyId) return;
    const saved = window.localStorage.getItem(draftKey(companyId));
    if (!saved) {
      const readyTimer = window.setTimeout(() => setDraftReady(true), 0);
      return () => window.clearTimeout(readyTimer);
    }
    try {
      const draft = JSON.parse(saved) as { name?: string; clientName?: string; contractSum?: string; location?: string; state?: string; startDate?: string; endDate?: string; projectManagerId?: string; siteEngineerId?: string };
      const restoreTimer = window.setTimeout(() => { setName(draft.name ?? ""); setClientName(draft.clientName ?? ""); setContractSum(draft.contractSum ?? ""); setLocation(draft.location ?? ""); setState(draft.state ?? "FCT Abuja"); setStartDate(draft.startDate ?? ""); setEndDate(draft.endDate ?? ""); setProjectManagerId(draft.projectManagerId ?? ""); setSiteEngineerId(draft.siteEngineerId ?? ""); setDraftMessage("Your project draft has been restored on this device."); setDraftReady(true); }, 0);
      return () => window.clearTimeout(restoreTimer);
    } catch {
      window.localStorage.removeItem(draftKey(companyId));
      const readyTimer = window.setTimeout(() => setDraftReady(true), 0);
      return () => window.clearTimeout(readyTimer);
    }
  }, [companyId]);
  useEffect(() => {
    if (!companyId || !draftReady) return;
    const autosaveTimer = window.setTimeout(() => {
      try { window.localStorage.setItem(draftKey(companyId), JSON.stringify({ name, clientName, contractSum, location, state, startDate, endDate, projectManagerId, siteEngineerId })); } catch { /* The form remains usable if device storage is unavailable. */ }
    }, 500);
    return () => window.clearTimeout(autosaveTimer);
  }, [clientName, companyId, contractSum, draftReady, endDate, location, name, projectManagerId, siteEngineerId, startDate, state]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!user || !profile) return; const value = Number(contractSum);
    if (!Number.isFinite(value) || value < 0) return setError("Enter a valid contract sum in Naira.");
    if (endDate < startDate) return setError("The end date must be after the start date.");
    const assignedManagerId = projectManagerId; const assignedEngineerId = siteEngineerId;
    const assignedManager = projectManagers.find((member) => member.id === assignedManagerId); const assignedEngineer = siteEngineers.find((member) => member.id === assignedEngineerId);
    setSaving(true); setError("");
    let syncOperationId = "";
    try {
      syncOperationId = beginSyncOperation("project");
      const createProject = addDoc(collection(db, "companies", profile.companyId, "projects"), {
        name: name.trim(), clientName: clientName.trim(), contractSum: value, location: location.trim(), state, startDate, endDate,
        status: "active", projectManagerId: assignedManagerId || null,
        projectManagerName: assignedManager?.name ?? null,
        siteEngineerId: assignedEngineerId || null, siteEngineerName: assignedEngineer?.name ?? null,
        // A dedicated assignment time makes the recipient's notification
        // unambiguous, even if the project is edited later.
        assignmentUpdatedAt: serverTimestamp(), createdBy: user.uid, createdAt: serverTimestamp(),
      });

      // Firestore queues this write in the device cache. Its promise waits for an
      // internet acknowledgement, so do not keep a field user on this form offline.
      if (!navigator.onLine) {
        void createProject.then(() => completeSyncOperation(syncOperationId)).catch(() => failSyncOperation(syncOperationId));
        window.localStorage.removeItem(draftKey(profile.companyId));
        router.replace("/?projectSavedOffline=1");
        return;
      }

      await createProject;
      window.localStorage.removeItem(draftKey(profile.companyId));
      completeSyncOperation(syncOperationId);
      router.replace("/dashboard");
    }
    catch { if (syncOperationId) failSyncOperation(syncOperationId); setError("We could not create this project. Please try again."); setSaving(false); }
  };
  if (profile && profile.role !== "director") return <main className="auth-loading">Only Directors can create projects and assign delivery teams. <Link href="/dashboard">Return to workspace</Link></main>;
  return <main className="onboarding-page"><section className="onboarding-card project-form-card"><p className="eyebrow">Project setup</p><h1>Add a project</h1><p>Start with the contract details, then assign the delivery team. BOQ items come next.</p><form onSubmit={submit}>
    <label>Project name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Client name<input value={clientName} onChange={(e) => setClientName(e.target.value)} required /></label><label>Contract sum (₦)<input inputMode="decimal" value={contractSum} onChange={(e) => setContractSum(e.target.value)} required /></label><label>Project location<input value={location} onChange={(e) => setLocation(e.target.value)} required /></label><label>State<select value={state} onChange={(e) => setState(e.target.value)}>{states.map((item) => <option key={item}>{item}</option>)}</select></label><div className="date-fields"><label>Start date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></label><label>Planned end date<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></label></div>{profile?.role === "director" && <section className="project-team-allocation"><div><p className="eyebrow">Assign project team</p><h2>Choose who will deliver this project</h2><p>Assign a Project Manager for delivery oversight and a Site Engineer for daily site reporting.</p></div><label>Project Manager<select value={projectManagerId} onChange={(event) => setProjectManagerId(event.target.value)} disabled={usersLoading}><option value="">Not assigned yet</option>{projectManagers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name} — {manager.email}</option>)}</select></label><label>Site Engineer<select value={siteEngineerId} onChange={(event) => setSiteEngineerId(event.target.value)} disabled={usersLoading}><option value="">Not assigned yet</option>{siteEngineers.map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.name} — {engineer.email}</option>)}</select></label>{!usersLoading && projectManagers.length === 0 && <p className="form-error">No Project Manager is available yet. Invite one from Team before assigning this project.</p>}{!usersLoading && siteEngineers.length === 0 && <p className="form-error">No Site Engineer is available yet. Invite one from Team before assigning this project.</p>}</section>}{draftMessage && <p className="form-success">{draftMessage}</p>}{error && <p className="form-error">{error}</p>}<button disabled={saving}>{saving ? "Creating project…" : "Create project"}</button>
  </form></section></main>;
}

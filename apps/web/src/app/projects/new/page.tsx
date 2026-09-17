"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { canManageProject } from "@/lib/permissions";
import { useCompanyUsers } from "@/hooks/use-company-users";
import Link from "next/link";

const states = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];

export default function NewProjectPage() {
  const router = useRouter(); const { user, profile } = useAuth();
  const { users, isLoading: usersLoading } = useCompanyUsers(profile?.companyId);
  const [name, setName] = useState(""); const [clientName, setClientName] = useState("");
  const [contractSum, setContractSum] = useState(""); const [location, setLocation] = useState("");
  const [state, setState] = useState("FCT Abuja"); const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState("");
  const [projectManagerId, setProjectManagerId] = useState(""); const [siteEngineerId, setSiteEngineerId] = useState("");
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const projectManagers = users.filter((member) => member.role === "project_manager"); const siteEngineers = users.filter((member) => member.role === "site_engineer");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!user || !profile) return; const value = Number(contractSum);
    if (!Number.isFinite(value) || value < 0) return setError("Enter a valid contract sum in Naira.");
    if (endDate < startDate) return setError("The end date must be after the start date.");
    const assignedManagerId = profile.role === "director" ? projectManagerId : profile.role === "project_manager" ? user.uid : ""; const assignedEngineerId = profile.role === "director" ? siteEngineerId : "";
    const assignedManager = projectManagers.find((member) => member.id === assignedManagerId); const assignedEngineer = siteEngineers.find((member) => member.id === assignedEngineerId);
    setSaving(true); setError("");
    try {
      const createProject = addDoc(collection(db, "companies", profile.companyId, "projects"), {
        name: name.trim(), clientName: clientName.trim(), contractSum: value, location: location.trim(), state, startDate, endDate,
        status: "active", projectManagerId: assignedManagerId || null,
        projectManagerName: assignedManager?.name ?? (profile.role === "project_manager" ? profile.name : null),
        siteEngineerId: assignedEngineerId || null, siteEngineerName: assignedEngineer?.name ?? null,
        createdBy: user.uid, createdAt: serverTimestamp(),
      });

      // Firestore queues this write in the device cache. Its promise waits for an
      // internet acknowledgement, so do not keep a field user on this form offline.
      if (!navigator.onLine) {
        void createProject.catch(() => undefined);
        router.replace("/?projectSavedOffline=1");
        return;
      }

      await createProject;
      router.replace("/");
    }
    catch { setError("We could not create this project. Please try again."); setSaving(false); }
  };
  if (profile && !canManageProject(profile.role)) return <main className="auth-loading">Your role cannot create projects. <Link href="/">Return to workspace</Link></main>;
  return <main className="onboarding-page"><section className="onboarding-card project-form-card"><p className="eyebrow">Project setup</p><h1>Add a project</h1><p>Start with the contract details. BOQ items come next. Projects created by a Project Manager are automatically assigned to them.</p><form onSubmit={submit}>
    <label>Project name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Client name<input value={clientName} onChange={(e) => setClientName(e.target.value)} required /></label><label>Contract sum (₦)<input inputMode="decimal" value={contractSum} onChange={(e) => setContractSum(e.target.value)} required /></label><label>Project location<input value={location} onChange={(e) => setLocation(e.target.value)} required /></label><label>State<select value={state} onChange={(e) => setState(e.target.value)}>{states.map((item) => <option key={item}>{item}</option>)}</select></label><div className="date-fields"><label>Start date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></label><label>Planned end date<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></label></div>{profile?.role === "director" && <section className="project-team-allocation"><div><p className="eyebrow">Assign project team</p><h2>Choose who will deliver this project</h2><p>Assign a Project Manager for delivery oversight and a Site Engineer for daily site reporting.</p></div><label>Project Manager<select value={projectManagerId} onChange={(event) => setProjectManagerId(event.target.value)} disabled={usersLoading}><option value="">Not assigned yet</option>{projectManagers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name} — {manager.email}</option>)}</select></label><label>Site Engineer<select value={siteEngineerId} onChange={(event) => setSiteEngineerId(event.target.value)} disabled={usersLoading}><option value="">Not assigned yet</option>{siteEngineers.map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.name} — {engineer.email}</option>)}</select></label>{!usersLoading && projectManagers.length === 0 && <p className="form-error">No Project Manager is available yet. Invite one from Team before assigning this project.</p>}{!usersLoading && siteEngineers.length === 0 && <p className="form-error">No Site Engineer is available yet. Invite one from Team before assigning this project.</p>}</section>}{error && <p className="form-error">{error}</p>}<button disabled={saving}>{saving ? "Creating project…" : "Create project"}</button>
  </form></section></main>;
}

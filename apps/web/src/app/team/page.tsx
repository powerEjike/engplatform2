"use client";

import Link from "next/link";
import { doc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@engplatform2/shared-types";
import { useAuth } from "@/components/auth-provider";
import { useCompanyUsers } from "@/hooks/use-company-users";
import { useCompanyInvites } from "@/hooks/use-company-invites";
import { useProjects } from "@/hooks/use-projects";
import { db } from "@/lib/firebase";

const roles: Array<{ value: Exclude<UserRole, "client">; label: string; description: string }> = [
  { value: "site_engineer", label: "Site Engineer", description: "Submits site reports and raises variations." },
  { value: "project_manager", label: "Project Manager", description: "Assigns Site Engineers and manages delivery." },
  { value: "quantity_surveyor", label: "Quantity Surveyor", description: "Manages BOQ items, reviews variations, and prepares valuations." },
  { value: "director", label: "Director", description: "Has portfolio oversight and final approvals." },
];

export default function TeamPage() {
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { users, isLoading: usersLoading } = useCompanyUsers(profile?.companyId);
  const { invites, isLoading: invitesLoading } = useCompanyInvites(profile?.companyId);
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/onboarding");
    if (!isProfileLoading && profile && profile.role !== "director") router.replace("/");
  }, [isLoading, isProfileLoading, profile, router, user]);

  const updateRole = async (memberId: string, role: string) => {
    if (!profile || memberId === user?.uid) return;
    setSavingId(memberId); setError(""); setMessage("");
    try {
      await updateDoc(doc(db, "companies", profile.companyId, "users", memberId), { role });
      setMessage("Role updated. The member will see their new workspace after signing in again.");
    } catch {
      setError("We could not update this role. Please try again.");
    } finally {
      setSavingId("");
    }
  };

  if (isLoading || isProfileLoading || usersLoading || invitesLoading || projectsLoading || !user || !profile || profile.role !== "director") return <main className="auth-loading">Opening team management…</main>;

  return <main className="report-page"><div className="report-content"><Link className="back-link" href="/">← Back to workspace</Link><section className="report-card"><p className="eyebrow">Company administration</p><h1>Team management</h1><p className="report-intro">Set each team member&apos;s working role. Client accounts are not available in this workspace.</p><p className="report-intro"><Link className="text-action" href="/team/invite">Invite a team member →</Link></p><div className="role-guide">{roles.map((role) => <p key={role.value}><strong>{role.label}</strong><span>{role.description}</span></p>)}</div><section className="report-section"><h2>Open invitations</h2>{invites.length === 0 ? <p className="field-hint">No invitation links have been created yet.</p> : invites.filter((invite) => invite.active).map((invite) => <p key={invite.id} className="field-hint"><strong>{invite.email}</strong> · invited as {roles.find((role) => role.value === invite.role)?.label ?? invite.role}</p>)}</section><section className="team-management-list">{users.map((member) => { const isCurrentUser = member.id === user.uid; const managedProjects = projects.filter((project) => project.projectManagerId === member.id); const assignedProjects = projects.filter((project) => project.siteEngineerId === member.id); const allocationText = member.role === "project_manager" ? `${managedProjects.length} managed project${managedProjects.length === 1 ? "" : "s"}${managedProjects.length ? ` · ${managedProjects.map((project) => project.name).join(", ")}` : ""}` : member.role === "site_engineer" ? `${assignedProjects.length} site assignment${assignedProjects.length === 1 ? "" : "s"}${assignedProjects.length ? ` · ${assignedProjects.map((project) => project.name).join(", ")}` : ""}` : member.role === "quantity_surveyor" ? "Controls BOQ, variations, and valuations across the workspace" : "Portfolio oversight and final approvals"; return <article className="team-management-row" key={member.id}><div><h2>{member.name}</h2><p>{member.email}</p></div><label>Role<select value={member.role} disabled={isCurrentUser || savingId === member.id} onChange={(event) => void updateRole(member.id, event.target.value)}>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label><span className="role-change-note">{isCurrentUser ? "Your own Director role is protected" : savingId === member.id ? "Saving…" : allocationText}</span></article>; })}</section>{message && <p className="form-success">{message}</p>}{error && <p className="form-error">{error}</p>}</section></div></main>;
}

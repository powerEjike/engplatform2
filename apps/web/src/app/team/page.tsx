"use client";

import Link from "next/link";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from "firebase/firestore";
import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@engplatform2/shared-types";
import { useAuth } from "@/components/auth-provider";
import { EmailVerificationNotice } from "@/components/email-verification-notice";
import { useCompanyUsers } from "@/hooks/use-company-users";
import { useCompanyInvites } from "@/hooks/use-company-invites";
import { useProjects } from "@/hooks/use-projects";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";

const roles: Array<{ value: Exclude<UserRole, "client">; label: string; description: string }> = [
  { value: "site_engineer", label: "Site Engineer", description: "Submits site reports and raises variations." },
  { value: "project_manager", label: "Project Manager", description: "Assigns Site Engineers and manages delivery." },
  { value: "quantity_surveyor", label: "Quantity Surveyor", description: "Manages BOQ items, reviews variations, and prepares valuations." },
  { value: "director", label: "Director", description: "Has portfolio oversight and final approvals." },
];

type AuditEntry = { id: string; actorName: string; action: string; entityName: string; createdAt?: { toDate?: () => Date } };

export default function TeamPage() {
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { users, isLoading: usersLoading } = useCompanyUsers(profile?.companyId);
  const { invites, isLoading: invitesLoading } = useCompanyInvites(profile?.companyId);
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId, profile?.role, user?.uid);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthError, setReauthError] = useState("");
  const [pendingAction, setPendingAction] = useState<{ type: "role"; memberId: string; role: string; name: string } | { type: "access"; memberId: string; active: boolean; name: string } | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const activeDirectors = users.filter((member) => member.role === "director" && member.active);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/access");
    if (!isProfileLoading && profile && profile.role !== "director") router.replace("/dashboard");
  }, [isLoading, isProfileLoading, profile, router, user]);

  useEffect(() => {
    if (!profile || profile.role !== "director") return;
    return onSnapshot(query(collection(db, "companies", profile.companyId, "securityAudit"), orderBy("createdAt", "desc")), (snapshot) => {
      setAuditEntries(snapshot.docs.slice(0, 8).map((entry) => ({ id: entry.id, ...(entry.data() as Omit<AuditEntry, "id">) })));
    }, () => setAuditEntries([]));
  }, [profile]);

  const updateRole = async (memberId: string, role: string) => {
    if (!profile || memberId === user?.uid) return;
    const member = users.find((item) => item.id === memberId);
    if (!member) return;
    setSavingId(memberId); setError(""); setMessage("");
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "companies", profile.companyId, "users", memberId), { role });
      batch.set(doc(collection(db, "companies", profile.companyId, "securityAudit")), { actorId: user!.uid, actorName: profile.name, actorRole: profile.role, action: "role_changed", entityType: "user", entityId: memberId, entityName: member.name, before: { role: member.role }, after: { role }, createdAt: serverTimestamp() });
      await batch.commit();
      setMessage("Role updated. The member will see their new workspace after signing in again.");
    } catch {
      setError("We could not update this role. Please try again.");
    } finally {
      setSavingId("");
    }
  };

  const confirmSensitiveAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingAction || !user?.email || !reauthPassword) return;
    setReauthError("");
    try {
      await reauthenticateWithCredential(auth.currentUser!, EmailAuthProvider.credential(user.email, reauthPassword));
      const action = pendingAction;
      setPendingAction(null); setReauthPassword("");
      if (action.type === "role") await updateRole(action.memberId, action.role);
      else await applyAccountAccess(action.memberId, action.active, action.name);
    } catch {
      setReauthError("Your password could not be confirmed. No change was made.");
    }
  };

  const applyAccountAccess = async (memberId: string, isActive: boolean, memberName: string) => {
    if (!profile || memberId === user?.uid) return;
    setSavingId(memberId); setError(""); setMessage("");
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "companies", profile.companyId, "users", memberId), { active: !isActive });
      batch.set(doc(collection(db, "companies", profile.companyId, "securityAudit")), { actorId: user!.uid, actorName: profile.name, actorRole: profile.role, action: isActive ? "account_disabled" : "account_restored", entityType: "user", entityId: memberId, entityName: memberName, before: { active: isActive }, after: { active: !isActive }, createdAt: serverTimestamp() });
      await batch.commit();
      setMessage(isActive ? `${memberName}'s workspace access has been disabled.` : `${memberName}'s workspace access has been restored.`);
    } catch {
      setError("We could not change this account's access. Please try again.");
    } finally {
      setSavingId("");
    }
  };

  const requestAccountAccessChange = (memberId: string, isActive: boolean, memberName: string) => {
    if (!user?.emailVerified) { setError("Verify your Director email before changing account access."); return; }
    const action = isActive ? "disable" : "restore";
    if (window.confirm(`${action === "disable" ? "Disable" : "Restore"} workspace access for ${memberName}?`)) setPendingAction({ type: "access", memberId, active: isActive, name: memberName });
  };

  const auditTime = (createdAt?: AuditEntry["createdAt"]) => createdAt?.toDate ? createdAt.toDate().toLocaleString() : "Just now";

  if (isLoading || isProfileLoading || usersLoading || invitesLoading || projectsLoading || !user || !profile || profile.role !== "director") return <main className="auth-loading">Opening team management…</main>;

  return <main className="report-page"><div className="report-content"><Link className="back-link" href="/dashboard">← Back to workspace</Link><section className="report-card"><p className="eyebrow">Company administration</p><h1>Team management</h1><p className="report-intro">Set each team member&apos;s working role. Client accounts are not available in this workspace.</p><EmailVerificationNotice /><p className="report-intro"><Link className="text-action" href="/team/invite">Invite a team member →</Link></p><div className="role-guide">{roles.map((role) => <p key={role.value}><strong>{role.label}</strong><span>{role.description}</span></p>)}</div><section className="report-section"><h2>Open invitations</h2>{invites.length === 0 ? <p className="field-hint">No invitation links have been created yet.</p> : invites.filter((invite) => invite.active).map((invite) => <p key={invite.id} className="field-hint"><strong>{invite.email}</strong> · invited as {roles.find((role) => role.value === invite.role)?.label ?? invite.role}</p>)}</section><section className="report-section"><h2>Recent security activity</h2>{auditEntries.length === 0 ? <p className="field-hint">Role and account-access changes will be recorded here.</p> : auditEntries.map((entry) => <p key={entry.id} className="field-hint"><strong>{entry.actorName}</strong> {entry.action.replaceAll("_", " ")} for <strong>{entry.entityName}</strong><br /><small>{auditTime(entry.createdAt)}</small></p>)}</section><section className="team-management-list">{users.map((member) => { const isCurrentUser = member.id === user.uid; const isLastActiveDirector = member.role === "director" && member.active && activeDirectors.length === 1; const managedProjects = projects.filter((project) => project.projectManagerId === member.id); const assignedProjects = projects.filter((project) => project.siteEngineerId === member.id); const allocationText = member.role === "project_manager" ? `${managedProjects.length} managed project${managedProjects.length === 1 ? "" : "s"}${managedProjects.length ? ` · ${managedProjects.map((project) => project.name).join(", ")}` : ""}` : member.role === "site_engineer" ? `${assignedProjects.length} site assignment${assignedProjects.length === 1 ? "" : "s"}${assignedProjects.length ? ` · ${assignedProjects.map((project) => project.name).join(", ")}` : ""}` : member.role === "quantity_surveyor" ? "Controls BOQ, variations, and valuations across the workspace" : "Portfolio oversight and final approvals"; return <article className={`team-management-row ${member.active ? "" : "account-disabled"}`} key={member.id}><div><h2>{member.name}</h2><p>{member.email}</p></div><label>Role<select value={member.role} disabled={isCurrentUser || savingId === member.id || !user.emailVerified} onChange={(event) => { if (!user.emailVerified) { setError("Verify your Director email before changing a role."); return; } setPendingAction({ type: "role", memberId: member.id, role: event.target.value, name: member.name }); }}>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>{!isCurrentUser && <button className="secondary compact-action" type="button" disabled={savingId === member.id || isLastActiveDirector || !user.emailVerified} onClick={() => requestAccountAccessChange(member.id, member.active, member.name)}>{member.active ? "Disable access" : "Restore access"}</button>}<span className="role-change-note">{isCurrentUser ? "Your own Director role is protected" : !user.emailVerified ? "Verify your email to manage this account" : isLastActiveDirector ? "Keep at least one active Director" : savingId === member.id ? "Saving…" : member.active ? allocationText : "Workspace access is disabled"}</span></article>; })}</section>{message && <p className="form-success">{message}</p>}{error && <p className="form-error">{error}</p>}{pendingAction && <section className="reauthentication-card"><p className="eyebrow">Confirm sensitive action</p><h2>{pendingAction.type === "role" ? `Change ${pendingAction.name}'s role` : `${pendingAction.active ? "Disable" : "Restore"} ${pendingAction.name}'s access`}</h2><p className="report-intro">For security, confirm your own Director password before this change is made.</p><form onSubmit={confirmSensitiveAction}><label className="report-labour-field">Your password<input type="password" autoComplete="current-password" value={reauthPassword} onChange={(event) => setReauthPassword(event.target.value)} required /></label>{reauthError && <p className="form-error">{reauthError}</p>}<div><button className="secondary compact-action" type="button" onClick={() => { setPendingAction(null); setReauthPassword(""); setReauthError(""); }}>Cancel</button><button type="submit">Confirm change</button></div></form></section>}</section></div></main>;
}

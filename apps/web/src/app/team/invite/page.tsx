"use client";

import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";

export default function InviteTeamMemberPage() {
  const router = useRouter(); const { user, profile, isLoading, isProfileLoading } = useAuth();
  const [email, setEmail] = useState(""); const [role, setRole] = useState("site_engineer"); const [link, setLink] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { if (!isLoading && !user) router.replace("/login"); if (!isProfileLoading && profile && profile.role !== "director") router.replace("/"); }, [isLoading, isProfileLoading, profile, router, user]);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!profile || !email.trim()) return; setSaving(true); setError(""); try { const invite = await addDoc(collection(db, "companies", profile.companyId, "invites"), { email: email.trim().toLowerCase(), role, createdAt: serverTimestamp(), active: true }); setLink(`${window.location.origin}/join?company=${profile.companyId}&invite=${invite.id}`); } catch { setError("We could not create this invitation. Publish the invitation rule, then try again."); } finally { setSaving(false); } };
  if (isLoading || isProfileLoading || !user || !profile || profile.role !== "director") return <main className="auth-loading">Opening invitations…</main>;
  return <main className="report-page"><div className="report-content"><Link className="back-link" href="/team">← Back to team</Link><section className="report-card"><p className="eyebrow">Company administration</p><h1>Invite a team member</h1><p className="report-intro">Create a private link and send it only to the person&apos;s work email.</p><form className="report-form" onSubmit={submit}><label className="report-labour-field">Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label className="report-labour-field">Role<select value={role} onChange={(event) => setRole(event.target.value)}><option value="site_engineer">Site Engineer</option><option value="project_manager">Project Manager</option><option value="quantity_surveyor">Quantity Surveyor</option></select></label>{error && <p className="form-error">{error}</p>}<button disabled={saving}>{saving ? "Creating link…" : "Create invitation link"}</button></form>{link && <section className="report-section"><h2>Invitation ready</h2><input readOnly value={link} onFocus={(event) => event.currentTarget.select()} /><p className="field-hint">Copy the full link and send it to {email.trim().toLowerCase()}.</p></section>}</section></div></main>;
}

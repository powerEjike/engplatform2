"use client";

import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

function JoinForm() {
  const params = useSearchParams(); const router = useRouter(); const companyId = params.get("company") ?? ""; const inviteId = params.get("invite") ?? "";
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!companyId || !inviteId) return setError("This invitation link is incomplete. Ask your Director for a new link."); setSaving(true); setError(""); try { let credential; try { credential = await createUserWithEmailAndPassword(auth, email.trim(), password); } catch (authError) { if ((authError as { code?: string }).code !== "auth/email-already-in-use") throw authError; credential = await signInWithEmailAndPassword(auth, email.trim(), password); } const invite = await getDoc(doc(db, "companies", companyId, "invites", inviteId)); if (!invite.exists() || !invite.data().active || String(invite.data().email).toLowerCase() !== email.trim().toLowerCase()) throw new Error("invalid-invite"); const batch = writeBatch(db); batch.set(doc(db, "companies", companyId, "users", credential.user.uid), { companyId, name: name.trim(), email: email.trim().toLowerCase(), role: invite.data().role, inviteId, assignedProjectIds: [], active: true, createdAt: serverTimestamp() }); batch.set(doc(db, "userIndex", credential.user.uid), { companyId, createdAt: serverTimestamp() }); await batch.commit(); router.replace("/"); } catch { setError("We could not join the workspace. Use the invited email and the password chosen on your first attempt, then try again."); } finally { setSaving(false); } };
  return <main className="onboarding-page"><section className="onboarding-card"><p className="eyebrow">Company invitation</p><h1>Join your workspace</h1><p>Create your own sign-in details using the email address invited by your Director.</p><form onSubmit={submit}><label>Your name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Create password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label>{error && <p className="form-error">{error}</p>}<button disabled={saving}>{saving ? "Joining workspace…" : "Join workspace"}</button></form></section></main>;
}

export default function JoinPage() {
  return <Suspense fallback={<main className="onboarding-page"><section className="onboarding-card"><p>Loading invitation…</p></section></main>}><JoinForm /></Suspense>;
}

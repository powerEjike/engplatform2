"use client";

import Link from "next/link";
import { doc, updateDoc } from "firebase/firestore";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";

export default function CompanySettingsPage() {
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading, refreshProfile } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/onboarding");
    if (!isProfileLoading && profile && profile.role !== "director") router.replace("/");
  }, [isLoading, isProfileLoading, profile, router, user]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !companyName.trim()) return setError("Enter a workspace name.");
    setSaving(true); setError(""); setMessage("");
    try {
      await updateDoc(doc(db, "companies", profile.companyId), { name: companyName.trim() });
      await refreshProfile();
      setMessage("Workspace name updated.");
    } catch {
      setError("We could not update the workspace name. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || isProfileLoading || !user || !profile || profile.role !== "director") return <main className="auth-loading">Opening company settings…</main>;

  return <main className="report-page"><div className="report-content"><Link className="back-link" href="/">← Back to workspace</Link><section className="report-card"><p className="eyebrow">Company administration</p><h1>Company settings</h1><p className="report-intro">Keep the workspace identity and team access under Director control.</p><form className="report-form" onSubmit={save}><section className="report-section"><h2>Workspace details</h2><label className="report-labour-field">Company / workspace name<input value={companyName || profile.companyName} onChange={(event) => setCompanyName(event.target.value)} required /></label></section><section className="report-section"><h2>Plan and security</h2><div className="settings-summary"><p><span>Current plan</span><strong>Firebase Spark — free plan</strong></p><p><span>Role control</span><Link className="text-action" href="/team">Manage team roles</Link></p><p><span>Project assignment</span><strong>Project Managers and Directors assign Site Engineers</strong></p></div></section>{message && <p className="form-success">{message}</p>}{error && <p className="form-error">{error}</p>}<div className="report-submit-row"><p className="report-intro">Only Directors can update company settings.</p><button disabled={saving}>{saving ? "Saving changes…" : "Save changes"}</button></div></form></section></div></main>;
}

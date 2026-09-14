"use client";

import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoading, profile, isProfileLoading, refreshProfile } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [directorName, setDirectorName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && profile) router.replace("/");
  }, [isLoading, isProfileLoading, profile, router, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setError("");
    setIsSubmitting(true);
    try {
      const company = await addDoc(collection(db, "companies"), {
        name: companyName.trim(),
        subscriptionTier: "pilot",
        active: true,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "companies", company.id, "users", user.uid), {
        companyId: company.id,
        name: directorName.trim(),
        email: user.email,
        role: "director",
        assignedProjectIds: [],
        active: true,
        createdAt: serverTimestamp(),
      });
      await refreshProfile();
      router.replace("/");
    } catch {
      setError("We could not create your company yet. Confirm that the Firestore rules have been published, then try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isProfileLoading || !user || profile) return <main className="auth-loading">Preparing your workspace…</main>;

  return <main className="onboarding-page"><section className="onboarding-card">
    <p className="eyebrow">First-time setup</p>
    <h1>Create your company workspace</h1>
    <p>Your workspace keeps company data private and gives you Director access.</p>
    <form onSubmit={handleSubmit}>
      <label>Company name<input value={companyName} onChange={(event) => setCompanyName(event.target.value)} required /></label>
      <label>Your name<input value={directorName} onChange={(event) => setDirectorName(event.target.value)} required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating workspace…" : "Create workspace"}</button>
    </form>
  </section></main>;
}

"use client";

import Link from "next/link";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from "firebase/firestore";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { BoqItem } from "@engplatform2/shared-types";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { formatNaira } from "@/lib/dashboard-data";
import { useProjects } from "@/hooks/use-projects";
import { canWorkOnProject } from "@/lib/project-access";
import { canRaiseVariation } from "@/lib/permissions";

export default function NewVariationPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId);
  const project = projects.find((item) => item.id === projectId);
  const [items, setItems] = useState<BoqItem[]>([]);
  const [boqItemId, setBoqItemId] = useState("");
  const [description, setDescription] = useState(""); const [reason, setReason] = useState("");
  const [quantityDelta, setQuantityDelta] = useState(""); const [rateOverride, setRateOverride] = useState(""); const [manualValue, setManualValue] = useState("");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const selectedItem = items.find((item) => item.id === boqItemId);
  const estimate = useMemo(() => {
    const quantity = Number(quantityDelta); const rate = rateOverride.trim() ? Number(rateOverride) : (selectedItem?.rate ?? Number.NaN);
    if (selectedItem && Number.isFinite(quantity) && Number.isFinite(rate)) return quantity * rate;
    const value = Number(manualValue); return Number.isFinite(value) ? value : 0;
  }, [manualValue, quantityDelta, rateOverride, selectedItem]);

  useEffect(() => { if (!isLoading && !user) router.replace("/login"); if (!isProfileLoading && user && !profile) router.replace("/access"); }, [isLoading, isProfileLoading, profile, router, user]);
  useEffect(() => { if (!profile) return; return onSnapshot(query(collection(db, "companies", profile.companyId, "projects", projectId, "boqItems"), orderBy("itemNumber")), (snapshot) => setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as BoqItem))); }, [profile, projectId]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!profile || !user) return;
    if (!description.trim() || !reason.trim() || !Number.isFinite(estimate) || estimate < 0) return setError("Add a description, reason, and valid estimated value.");
    if (selectedItem && (!Number.isFinite(Number(quantityDelta)) || Number(quantityDelta) === 0)) return setError("Enter the quantity increase or decrease for the selected BOQ item.");
    setSaving(true); setError("");
    try {
      const batch = writeBatch(db);
      batch.set(doc(collection(db, "companies", profile.companyId, "projects", projectId, "variations")), {
        projectId, relatedBoqItemId: boqItemId || null, description: description.trim(), reason: reason.trim(), raisedBy: user.uid,
        raisedAt: serverTimestamp(), quantityDelta: selectedItem ? Number(quantityDelta) : null,
        rateOverride: rateOverride.trim() ? Number(rateOverride) : null, estimatedValue: estimate,
        status: "pending_qs_review", supportingPhotoIds: [],
      });
      batch.set(doc(collection(db, "companies", profile.companyId, "projects", projectId, "activityLog")), {
        action: "variation_raised", summary: `Variation raised: ${description.trim()}.`, actorName: profile.name, createdAt: serverTimestamp(),
      });
      const raiseVariation = batch.commit();

      if (!navigator.onLine) {
        void raiseVariation.catch(() => undefined);
        router.replace(`/projects/${projectId}?variationSavedOffline=1`);
        return;
      }

      await raiseVariation;
      router.replace(`/projects/${projectId}`);
    }
    catch { setError("We could not raise this variation. Check the Firestore rules and try again."); setSaving(false); }
  };
  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening variation form…</main>;
  if (!project) return <main className="auth-loading">This project could not be found. <Link href="/">Return to dashboard</Link></main>;
  if (!canWorkOnProject(profile.role, user.uid, project)) return <main className="auth-loading">This variation form is only available for your assigned projects. <Link href="/">Return to your assigned projects</Link></main>;
  if (!canRaiseVariation(profile.role)) return <main className="auth-loading">Your role cannot raise variations. <Link href={`/projects/${projectId}`}>Return to project</Link></main>;
  return <main className="report-page"><div className="report-content"><Link className="back-link" href={`/projects/${projectId}`}>← Back to {project.name}</Link><section className="report-card"><p className="eyebrow">Variation request</p><h1>Raise a variation</h1><p className="report-intro">Record extra work, omissions, or changes before they affect the contract value.</p><form className="report-form" onSubmit={submit}><section className="report-section"><label className="report-date-field">Related BOQ item (optional)<select value={boqItemId} onChange={(event) => setBoqItemId(event.target.value)}><option value="">Standalone variation</option>{items.map((item) => <option key={item.id} value={item.id}>{item.itemNumber} · {item.description}</option>)}</select></label></section><section className="report-section"><label className="report-issue-field">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the additional work or change." required /></label><label className="report-issue-field">Reason for variation<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this change is required." required /></label></section>{selectedItem ? <section className="report-section"><h2>Pricing</h2><p>The original BOQ rate is used unless you enter a new agreed rate.</p><div className="boq-number-fields"><label className="report-labour-field">Quantity change ({selectedItem.unit})<input inputMode="decimal" value={quantityDelta} onChange={(event) => setQuantityDelta(event.target.value)} placeholder="Use - for omission" /></label><label className="report-labour-field">Rate per {selectedItem.unit} (₦)<input inputMode="decimal" value={rateOverride} onChange={(event) => setRateOverride(event.target.value)} placeholder={`BOQ rate: ${selectedItem.rate}`} /></label></div></section> : <section className="report-section"><label className="report-labour-field">Estimated value (₦)<input inputMode="decimal" value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder="0" required /></label></section>}<div className="variation-value"><span>Estimated contract impact</span><strong>{formatNaira(estimate)}</strong></div>{error && <p className="form-error">{error}</p>}<div className="report-submit-row"><p className="report-intro">The request will first be sent for QS or Project Manager review, then to the Director for final approval.</p><button disabled={saving}>{saving ? "Raising variation…" : "Raise variation"}</button></div></form></section></div></main>;
}

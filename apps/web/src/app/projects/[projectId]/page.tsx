"use client";

import Link from "next/link";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { BoqItem, SiteReport, Valuation, Variation } from "@engplatform2/shared-types";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { formatNaira } from "@/lib/dashboard-data";
import { useProjects } from "@/hooks/use-projects";

type BoqForm = { itemNumber: string; description: string; section: string; unit: string; plannedQuantity: string; rate: string };
const initialForm: BoqForm = { itemNumber: "", description: "", section: "", unit: "", plannedQuantity: "", rate: "" };

export default function ProjectWorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId);
  const project = projects.find((item) => item.id === projectId);
  const [items, setItems] = useState<BoqItem[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [reports, setReports] = useState<SiteReport[]>([]);
  const [form, setForm] = useState<BoqForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/onboarding");
  }, [isLoading, isProfileLoading, profile, router, user]);

  useEffect(() => {
    if (!profile || !projectId) return;
    return onSnapshot(query(collection(db, "companies", profile.companyId, "projects", projectId, "boqItems"), orderBy("itemNumber")), (snapshot) => {
      setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as BoqItem));
    });
  }, [profile, projectId]);

  useEffect(() => {
    if (!profile || !projectId) return;
    return onSnapshot(collection(db, "companies", profile.companyId, "projects", projectId, "siteReports"), (snapshot) => {
      setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as SiteReport).sort((left, right) => right.reportDate.localeCompare(left.reportDate)));
    });
  }, [profile, projectId]);

  useEffect(() => {
    if (!profile || !projectId) return;
    return onSnapshot(collection(db, "companies", profile.companyId, "projects", projectId, "valuations"), (snapshot) => {
      setValuations(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Valuation));
    });
  }, [profile, projectId]);

  useEffect(() => {
    if (!profile || !projectId) return;
    return onSnapshot(collection(db, "companies", profile.companyId, "projects", projectId, "variations"), (snapshot) => {
      setVariations(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Variation));
    });
  }, [profile, projectId]);

  const plannedValue = useMemo(() => items.reduce((total, item) => total + item.plannedQuantity * item.rate, 0), [items]);
  const budgetBalance = project ? project.contractSum - plannedValue : 0;
  const variationExposure = useMemo(() => variations.filter((item) => item.status !== "rejected").reduce((total, item) => total + item.estimatedValue, 0), [variations]);

  const update = (key: keyof BoqForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !user) return;
    const plannedQuantity = Number(form.plannedQuantity);
    const rate = Number(form.rate);
    if (!form.itemNumber.trim() || !form.description.trim() || !form.unit.trim() || !Number.isFinite(plannedQuantity) || plannedQuantity <= 0 || !Number.isFinite(rate) || rate < 0) {
      setError("Enter an item number, description, unit, planned quantity, and rate.");
      return;
    }
    setSaving(true); setError("");
    try {
      await addDoc(collection(db, "companies", profile.companyId, "projects", projectId, "boqItems"), {
        itemNumber: form.itemNumber.trim(), description: form.description.trim(), section: form.section.trim() || "General", unit: form.unit.trim(), plannedQuantity, rate, cumulativeQuantityCompleted: 0, createdAt: serverTimestamp(), createdBy: user.uid,
      });
      setForm(initialForm);
    } catch {
      setError("We could not save this BOQ item. Check that the latest Firestore rules have been published, then try again.");
    } finally { setSaving(false); }
  };
  const updateVariation = async (variation: Variation, approved: boolean) => {
    if (!profile || !user) return;
    const rejectionReason = approved ? "" : window.prompt("Why is this variation being rejected?")?.trim();
    if (!approved && !rejectionReason) return;
    try { await updateDoc(doc(db, "companies", profile.companyId, "projects", projectId, "variations", variation.id), approved ? { status: "approved", approvedBy: user.uid, approvedAt: serverTimestamp() } : { status: "rejected", rejectionReason, approvedBy: user.uid, approvedAt: serverTimestamp() }); }
    catch { setError("We could not update this variation. Please try again."); }
  };

  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening project workspace…</main>;
  if (!project) return <main className="auth-loading">This project could not be found. <Link href="/">Return to dashboard</Link></main>;

  return <main className="project-workspace"><div className="workspace-content">
    <Link className="back-link" href="/">← Back to portfolio</Link>
    <div className="project-title-row"><div><p className="eyebrow">Project BOQ</p><h1>{project.name}</h1><p>{project.clientName} · {project.location}, {project.state}</p></div><div className="project-title-actions"><Link className="primary-action" href={`/projects/${projectId}/reports/new`}>+ Daily site report</Link><Link className="secondary compact-action" href={`/projects/${projectId}/variations/new`}>Raise variation</Link><Link className="secondary compact-action" href={`/projects/${projectId}/valuations/new`}>Create valuation</Link><Link className="text-action" href={`/projects/${projectId}/settings`}>Project settings</Link><div className="contract-summary"><span>Contract sum</span><strong>{formatNaira(project.contractSum)}</strong></div></div></div>
    <section className="budget-summary"><article><span>Contract sum</span><strong>{formatNaira(project.contractSum)}</strong></article><article><span>Planned BOQ value</span><strong>{formatNaira(plannedValue)}</strong></article><article className={budgetBalance < 0 ? "budget-overrun" : ""}><span>{budgetBalance < 0 ? "BOQ overrun" : "Unallocated balance"}</span><strong>{formatNaira(Math.abs(budgetBalance))}</strong></article></section>
    <div className="boq-layout"><section className="boq-card"><p className="eyebrow">Add cost item</p><h2>Build your BOQ</h2><p>Add the contract quantities and agreed rates. The platform will use these items for site progress and valuations.</p>
      <form className="boq-form" onSubmit={submit}><label>Item number<input value={form.itemNumber} onChange={(event) => update("itemNumber", event.target.value)} placeholder="e.g. 1.01" required /></label><label>Description<input value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="e.g. Excavation for foundation" required /></label><label>Section (optional)<input value={form.section} onChange={(event) => update("section", event.target.value)} placeholder="e.g. Substructure" /></label><div className="boq-number-fields"><label>Unit<input value={form.unit} onChange={(event) => update("unit", event.target.value)} placeholder="m³, m², No." required /></label><label>Planned quantity<input inputMode="decimal" value={form.plannedQuantity} onChange={(event) => update("plannedQuantity", event.target.value)} placeholder="0" required /></label></div><label>Rate per unit (₦)<input inputMode="decimal" value={form.rate} onChange={(event) => update("rate", event.target.value)} placeholder="0" required /></label>{error && <p className="form-error">{error}</p>}<button disabled={saving}>{saving ? "Saving item…" : "Add BOQ item"}</button></form>
    </section>
    <section className="boq-card"><div className="boq-header"><div><p className="eyebrow">Cost plan</p><h2>BOQ items</h2></div><p className="boq-total">Planned BOQ value<strong>{formatNaira(plannedValue)}</strong></p></div>{items.length === 0 ? <p className="boq-empty">No BOQ items yet. Start with the major contract work items, such as preliminaries, foundation, structure, finishes, or services.</p> : <div className="boq-list">{items.map((item) => { const progress = item.plannedQuantity > 0 ? Math.min(100, Math.round(item.cumulativeQuantityCompleted / item.plannedQuantity * 100)) : 0; return <article className="boq-item" key={item.id}><div className="boq-item-top"><div><span className="boq-item-number">{item.section} · {item.itemNumber}</span><h3>{item.description}</h3></div><strong>{formatNaira(item.plannedQuantity * item.rate)}</strong></div><p className="boq-item-meta">{item.plannedQuantity.toLocaleString()} {item.unit} × {formatNaira(item.rate)} per {item.unit}</p><div className="boq-item-progress"><div><span>{item.cumulativeQuantityCompleted.toLocaleString()} of {item.plannedQuantity.toLocaleString()} {item.unit} complete</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div></article>; })}</div>}</section>
    </div>
    <section className="report-register"><div className="boq-header"><div><p className="eyebrow">Site activity</p><h2>Daily reports</h2></div><Link className="secondary compact-action" href={`/projects/${projectId}/reports/new`}>Add report</Link></div>{reports.length === 0 ? <p className="boq-empty">No daily reports have been submitted for this project.</p> : <div className="report-history">{reports.map((report) => <article className="report-history-row" key={report.id}><div><span className="report-history-date">{new Date(`${report.reportDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span><h3>{report.lineItems.length} BOQ item{report.lineItems.length === 1 ? "" : "s"} updated</h3></div><p><span>Labour</span><strong>{report.labourCount}</strong></p><p><span>Issues</span><strong>{report.issues.length}</strong></p><p className="report-history-note">{report.issues[0] ? <><b>{report.issues[0].category.replaceAll("_", " ")}</b> · {report.issues[0].note}</> : "No issues recorded"}</p></article>)}</div>}</section>
    <section className="variation-register"><div className="boq-header"><div><p className="eyebrow">Change control</p><h2>Variation register</h2></div><p className="boq-total">Open exposure<strong>{formatNaira(variationExposure)}</strong></p></div>{variations.length === 0 ? <p className="boq-empty">No variations have been raised for this project.</p> : <div className="variation-list">{variations.map((variation) => <article className="variation-row" key={variation.id}><div><span className={`variation-status ${variation.status}`}>{variation.status.replaceAll("_", " ")}</span><h3>{variation.description}</h3><p>{variation.reason}</p></div><div className="variation-actions"><strong>{formatNaira(variation.estimatedValue)}</strong>{variation.status === "pending_director_approval" && profile.role === "director" && <div><button type="button" onClick={() => void updateVariation(variation, true)}>Approve</button><button className="reject-button" type="button" onClick={() => void updateVariation(variation, false)}>Reject</button></div>}</div></article>)}</div>}</section>
    <section className="valuation-register"><div className="boq-header"><div><p className="eyebrow">Payment certificates</p><h2>Valuation register</h2></div><Link className="secondary compact-action" href={`/projects/${projectId}/valuations/new`}>Create valuation</Link></div>{valuations.length === 0 ? <p className="boq-empty">No payment certificates have been issued for this project.</p> : <div className="valuation-list">{valuations.map((valuation) => <article className="valuation-row" key={valuation.id}><div><span className="valuation-certificate">{valuation.certificateNumber}</span><h3>{new Date(`${valuation.valuationDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</h3></div><p><span>Gross value</span><strong>{formatNaira(valuation.grossValue)}</strong></p><p><span>Retention</span><strong>{formatNaira(valuation.retentionAmount)}</strong></p><p className="valuation-due"><span>Net due</span><strong>{formatNaira(valuation.netAmountDue)}</strong></p></article>)}</div>}</section>
  </div></main>;
}

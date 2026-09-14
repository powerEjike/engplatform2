"use client";

import Link from "next/link";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from "firebase/firestore";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { BoqItem } from "@engplatform2/shared-types";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { useProjects } from "@/hooks/use-projects";

const today = () => new Date().toISOString().slice(0, 10);

export default function NewSiteReportPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId);
  const project = projects.find((item) => item.id === projectId);
  const [items, setItems] = useState<BoqItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reportDate, setReportDate] = useState(today);
  const [labourCount, setLabourCount] = useState("");
  const [issueCategory, setIssueCategory] = useState("other");
  const [issue, setIssue] = useState("");
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

  const saveReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !user) return;
    const labour = labourCount.trim() ? Number(labourCount) : 0;
    if (!Number.isInteger(labour) || labour < 0) return setError("Labour count must be a whole number of zero or more.");
    const lineItems = items.flatMap((item) => {
      const quantity = Number(quantities[item.id] || 0);
      return quantity > 0 ? [{ boqItemId: item.id, quantityCompleted: quantity }] : [];
    });
    const hasInvalidQuantity = items.some((item) => {
      const entered = quantities[item.id];
      const quantity = Number(entered || 0);
      return !Number.isFinite(quantity) || quantity < 0 || quantity + item.cumulativeQuantityCompleted > item.plannedQuantity;
    });
    if (hasInvalidQuantity) return setError("Each completed quantity must be zero or more and cannot exceed the remaining planned quantity.");
    if (lineItems.length === 0 && labour === 0 && !issue.trim()) return setError("Record completed work, labour, or a site issue before submitting.");

    setSaving(true); setError("");
    try {
      const batch = writeBatch(db);
      const reports = collection(db, "companies", profile.companyId, "projects", projectId, "siteReports");
      const report = doc(reports);
      batch.set(report, { projectId, submittedBy: user.uid, reportDate, status: "synced", lineItems, labourCount: labour, equipmentOnSite: [], issues: issue.trim() ? [{ category: issueCategory, note: issue.trim() }] : [], photoIds: [], clientGeneratedId: report.id, createdAt: serverTimestamp(), syncedAt: serverTimestamp() });
      lineItems.forEach((lineItem) => {
        const item = items.find((current) => current.id === lineItem.boqItemId);
        if (item) batch.update(doc(db, "companies", profile.companyId, "projects", projectId, "boqItems", item.id), { cumulativeQuantityCompleted: item.cumulativeQuantityCompleted + lineItem.quantityCompleted });
      });
      await batch.commit();
      router.replace(`/projects/${projectId}`);
    } catch {
      setError("We could not submit this report. Check that the latest Firestore rules have been published, then try again.");
      setSaving(false);
    }
  };

  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening daily report…</main>;
  if (!project) return <main className="auth-loading">This project could not be found. <Link href="/">Return to dashboard</Link></main>;

  return <main className="report-page"><div className="report-content"><Link className="back-link" href={`/projects/${projectId}`}>← Back to {project.name}</Link><section className="report-card"><p className="eyebrow">Daily site report</p><h1>Record today&apos;s work</h1><p className="report-intro">Add only the quantities completed today. The platform adds them to the BOQ totals when you submit.</p>
    <form className="report-form" onSubmit={saveReport}><section className="report-section"><label className="report-date-field">Report date<input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} required /></label></section><section className="report-section"><h2>Completed work</h2><p>Leave an item blank if no work was completed on it today.</p>{items.length === 0 ? <p className="boq-empty">This project has no BOQ items yet. Return to the project and add BOQ items first.</p> : <div className="report-lines">{items.map((item) => <div className="report-line" key={item.id}><div><span>{item.itemNumber} · Remaining: {(item.plannedQuantity - item.cumulativeQuantityCompleted).toLocaleString()} {item.unit}</span><h3>{item.description}</h3></div><label>Completed today ({item.unit})<input inputMode="decimal" value={quantities[item.id] ?? ""} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="0" /></label></div>)}</div>}</section><section className="report-section"><h2>Site notes</h2><p>These details help the project team understand today&apos;s activity.</p><label className="report-labour-field">Labour on site<input inputMode="numeric" value={labourCount} onChange={(event) => setLabourCount(event.target.value)} placeholder="0" /></label><div className="boq-number-fields"><label className="report-labour-field">Issue category<select value={issueCategory} onChange={(event) => setIssueCategory(event.target.value)}><option value="weather">Weather</option><option value="material_shortage">Material shortage</option><option value="access">Access</option><option value="other">Other</option></select></label></div><label className="report-issue-field">Issue or observation (optional)<textarea value={issue} onChange={(event) => setIssue(event.target.value)} placeholder="e.g. Rain delayed concrete works for two hours." /></label></section>{error && <p className="form-error">{error}</p>}<div className="report-submit-row"><p className="report-intro">You can review the updated BOQ immediately after submitting.</p><button disabled={saving || items.length === 0}>{saving ? "Submitting report…" : "Submit daily report"}</button></div></form>
  </section></div></main>;
}

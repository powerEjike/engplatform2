"use client";

import Link from "next/link";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from "firebase/firestore";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { BoqItem } from "@engplatform2/shared-types";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { useProjects } from "@/hooks/use-projects";
import { canWorkOnProject } from "@/lib/project-access";
import { canSubmitReport } from "@/lib/permissions";

const today = () => new Date().toISOString().slice(0, 10);
const draftKey = (projectId: string) => `engplatform2:report-draft:${projectId}`;
const namedValues = (value: string) => {
  if (!value.trim()) return {};
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => entry.split(":").map((part) => part.trim()));
  if (entries.some(([name, amount]) => !name || !amount || !Number.isFinite(Number(amount)) || Number(amount) < 0)) return null;
  return Object.fromEntries(entries.map(([name, amount]) => [name, Number(amount)]));
};

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
  const [labourByTrade, setLabourByTrade] = useState("");
  const [equipment, setEquipment] = useState("");
  const [equipmentHours, setEquipmentHours] = useState("");
  const [issueCategory, setIssueCategory] = useState("other");
  const [issue, setIssue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftMessage, setDraftMessage] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/access");
  }, [isLoading, isProfileLoading, profile, router, user]);
  useEffect(() => {
    if (!profile || !projectId) return;
    return onSnapshot(query(collection(db, "companies", profile.companyId, "projects", projectId, "boqItems"), orderBy("itemNumber")), (snapshot) => setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as BoqItem)));
  }, [profile, projectId]);
  useEffect(() => {
    const saved = window.localStorage.getItem(draftKey(projectId));
    if (!saved) return;
    try {
      const draft = JSON.parse(saved) as { quantities?: Record<string, string>; reportDate?: string; labourCount?: string; labourByTrade?: string; equipment?: string; equipmentHours?: string; issueCategory?: string; issue?: string };
      const restoreTimer = window.setTimeout(() => { setQuantities(draft.quantities ?? {}); setReportDate(draft.reportDate ?? today()); setLabourCount(draft.labourCount ?? ""); setLabourByTrade(draft.labourByTrade ?? ""); setEquipment(draft.equipment ?? ""); setEquipmentHours(draft.equipmentHours ?? ""); setIssueCategory(draft.issueCategory ?? "other"); setIssue(draft.issue ?? ""); setDraftMessage("Your saved draft has been restored on this device."); }, 0);
      return () => window.clearTimeout(restoreTimer);
    } catch { window.localStorage.removeItem(draftKey(projectId)); }
  }, [projectId]);

  const saveReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !user) return;
    const labour = labourCount.trim() ? Number(labourCount) : 0;
    const equipmentOnSite = equipment.split(",").map((item) => item.trim()).filter(Boolean);
    const labourBreakdown = namedValues(labourByTrade);
    const equipmentBreakdown = namedValues(equipmentHours);
    if (!Number.isInteger(labour) || labour < 0) return setError("Labour count must be a whole number of zero or more.");
    if (!labourBreakdown || !equipmentBreakdown) return setError("Use the format Name: number, for example Mason: 4, Labourer: 8.");
    const lineItems = items.flatMap((item) => Number(quantities[item.id] || 0) > 0 ? [{ boqItemId: item.id, quantityCompleted: Number(quantities[item.id]) }] : []);
    const hasInvalidQuantity = items.some((item) => { const quantity = Number(quantities[item.id] || 0); return !Number.isFinite(quantity) || quantity < 0 || quantity + item.cumulativeQuantityCompleted > item.plannedQuantity; });
    if (hasInvalidQuantity) return setError("Each completed quantity must be zero or more and cannot exceed the remaining planned quantity.");
    if (lineItems.length === 0 && labour === 0 && equipmentOnSite.length === 0 && !issue.trim()) return setError("Record completed work, labour, equipment, or a site issue before submitting.");
    setSaving(true); setError("");
    try {
      const batch = writeBatch(db); const reports = collection(db, "companies", profile.companyId, "projects", projectId, "siteReports"); const report = doc(reports);
      batch.set(report, { projectId, submittedBy: user.uid, reportDate, status: "synced", lineItems, labourCount: labour, labourByTrade: labourBreakdown, equipmentOnSite, equipmentHours: equipmentBreakdown, issues: issue.trim() ? [{ category: issueCategory, note: issue.trim() }] : [], photoIds: [], clientGeneratedId: report.id, createdAt: serverTimestamp(), syncedAt: serverTimestamp() });
      batch.set(doc(collection(db, "companies", profile.companyId, "projects", projectId, "activityLog")), { action: "report_submitted", summary: `Daily report submitted for ${reportDate}.`, actorName: profile.name, createdAt: serverTimestamp() });
      lineItems.forEach((lineItem) => { const item = items.find((current) => current.id === lineItem.boqItemId); if (item) batch.update(doc(db, "companies", profile.companyId, "projects", projectId, "boqItems", item.id), { cumulativeQuantityCompleted: item.cumulativeQuantityCompleted + lineItem.quantityCompleted }); });
      await batch.commit(); window.localStorage.removeItem(draftKey(projectId)); router.replace(`/projects/${projectId}`);
    } catch { setError("We could not submit this report. Check that the latest Firestore rules have been published, then try again."); setSaving(false); }
  };
  const saveDraft = () => { try { window.localStorage.setItem(draftKey(projectId), JSON.stringify({ quantities, reportDate, labourCount, labourByTrade, equipment, equipmentHours, issueCategory, issue })); setDraftMessage("Draft saved safely on this device. It will restore automatically when you return to this report."); } catch { setDraftMessage("We could not save the draft on this device. Check that browser storage is available, then try again."); } };
  const loadDraft = () => { const saved = window.localStorage.getItem(draftKey(projectId)); if (!saved) return setDraftMessage("No saved draft was found for this project on this device."); try { const draft = JSON.parse(saved) as { quantities?: Record<string, string>; reportDate?: string; labourCount?: string; labourByTrade?: string; equipment?: string; equipmentHours?: string; issueCategory?: string; issue?: string }; setQuantities(draft.quantities ?? {}); setReportDate(draft.reportDate ?? today()); setLabourCount(draft.labourCount ?? ""); setLabourByTrade(draft.labourByTrade ?? ""); setEquipment(draft.equipment ?? ""); setEquipmentHours(draft.equipmentHours ?? ""); setIssueCategory(draft.issueCategory ?? "other"); setIssue(draft.issue ?? ""); setDraftMessage("Saved draft loaded. Review the details, then submit when ready."); } catch { setDraftMessage("This saved draft could not be read. Start a new report and save it again if needed."); } };
  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening daily report…</main>;
  if (!project) return <main className="auth-loading">This project could not be found. <Link href="/">Return to dashboard</Link></main>;
  if (!canWorkOnProject(profile.role, user.uid, project)) return <main className="auth-loading">This report page is only available for your assigned projects. <Link href="/">Return to your assigned projects</Link></main>;
  if (!canSubmitReport(profile.role)) return <main className="auth-loading">Your role cannot submit daily site reports. <Link href={`/projects/${projectId}`}>Return to project</Link></main>;
  return <main className="report-page"><div className="report-content"><Link className="back-link" href={`/projects/${projectId}`}>← Back to {project.name}</Link><section className="report-card"><p className="eyebrow">Daily site report</p><h1>Record today&apos;s work</h1><p className="report-intro">Add only the quantities completed today. The platform adds them to the BOQ totals when you submit.</p><form className="report-form" onSubmit={saveReport}><section className="report-section"><label className="report-date-field">Report date<input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} required /></label></section><section className="report-section"><h2>Completed work</h2><p>Leave an item blank if no work was completed on it today.</p>{items.length === 0 ? <p className="boq-empty">This project has no BOQ items yet. You can still submit a report with labour, equipment, or an issue note.</p> : <div className="report-lines">{items.map((item) => <div className="report-line" key={item.id}><div><span>{item.itemNumber} · Remaining: {(item.plannedQuantity - item.cumulativeQuantityCompleted).toLocaleString()} {item.unit}</span><h3>{item.description}</h3></div><label>Completed today ({item.unit})<input inputMode="decimal" value={quantities[item.id] ?? ""} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="0" /></label></div>)}</div>}</section><section className="report-section"><h2>Site resources and notes</h2><p>These details help the project team understand today&apos;s activity.</p><label className="report-labour-field">Labour on site<input inputMode="numeric" value={labourCount} onChange={(event) => setLabourCount(event.target.value)} placeholder="0" /></label><label className="report-issue-field">Labour by trade (optional)<input value={labourByTrade} onChange={(event) => setLabourByTrade(event.target.value)} placeholder="e.g. Mason: 4, Labourer: 8" /><span className="field-hint">Enter each trade as Name: number, separated by commas.</span></label><label className="report-issue-field">Equipment on site (optional)<input value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="e.g. Excavator, concrete mixer, generator" /><span className="field-hint">Separate each item with a comma.</span></label><label className="report-issue-field">Equipment hours (optional)<input value={equipmentHours} onChange={(event) => setEquipmentHours(event.target.value)} placeholder="e.g. Excavator: 6, Generator: 4" /><span className="field-hint">Enter each item as Name: hours, separated by commas.</span></label><div className="boq-number-fields"><label className="report-labour-field">Issue category<select value={issueCategory} onChange={(event) => setIssueCategory(event.target.value)}><option value="weather">Weather</option><option value="material_shortage">Material shortage</option><option value="access">Access</option><option value="other">Other</option></select></label></div><label className="report-issue-field">Issue or observation (optional)<textarea value={issue} onChange={(event) => setIssue(event.target.value)} placeholder="e.g. Rain delayed concrete works for two hours." /></label></section>{draftMessage && <p className="form-success">{draftMessage}</p>}{error && <p className="form-error">{error}</p>}<div className="report-submit-row"><p className="report-intro">Save a local draft if your internet connection is unstable. It stays only on this device until you submit.</p><div className="draft-actions"><button className="outline-button" type="button" onClick={loadDraft}>Load saved draft</button><button className="outline-button" type="button" onClick={saveDraft}>Save draft</button><button disabled={saving}>{saving ? "Submitting report…" : "Submit daily report"}</button></div></div></form></section></div></main>;
}

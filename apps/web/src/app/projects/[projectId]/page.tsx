"use client";

import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { BoqItem, ProjectActivityEvent, SiteReport, Valuation, Variation } from "@engplatform2/shared-types";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { formatNaira } from "@/lib/dashboard-data";
import { useProjects } from "@/hooks/use-projects";
import { useCompanyUsers } from "@/hooks/use-company-users";
import { canFinalApproveVariation, canGenerateValuation, canManageBoq, canManageProject, canRaiseVariation, canReviewVariation, canSubmitReport } from "@/lib/permissions";
import { canWorkOnProject } from "@/lib/project-access";

type ReportComment = { id: string; message: string; authorId: string; authorName: string; recipientIds: string[]; createdAt?: unknown };

type BoqForm = { itemNumber: string; description: string; section: string; unit: string; plannedQuantity: string; rate: string };
const initialForm: BoqForm = { itemNumber: "", description: "", section: "", unit: "", plannedQuantity: "", rate: "" };
type ImportedBoqRow = { itemNumber: string; description: string; unit: string; plannedQuantity: number; rate: number; section: string };

const csvLine = (line: string) => {
  const cells: string[] = []; let current = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) { const character = line[index]; if (character === '"') { if (quoted && line[index + 1] === '"') { current += '"'; index += 1; } else quoted = !quoted; } else if (character === "," && !quoted) { cells.push(current.trim()); current = ""; } else current += character; }
  cells.push(current.trim()); return cells;
};

const parseBoqCsv = (text: string): ImportedBoqRow[] => {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("The CSV needs a header row and at least one BOQ item.");
  const headers = csvLine(lines[0]!).map((header) => header.toLowerCase().replace(/[ _-]/g, ""));
  const column = (name: string) => headers.indexOf(name);
  const itemNumber = column("itemnumber"); const description = column("description"); const unit = column("unit"); const plannedQuantity = column("plannedquantity"); const rate = column("rate"); const section = column("section");
  if ([itemNumber, description, unit, plannedQuantity, rate].some((index) => index < 0)) throw new Error("Use these CSV headings: itemNumber, description, unit, plannedQuantity, rate, section.");
  return lines.slice(1).map((line, index) => {
    const cells = csvLine(line); const quantity = Number((cells[plannedQuantity] ?? "").replace(/,/g, "")); const amount = Number((cells[rate] ?? "").replace(/[₦,]/g, ""));
    const row = { itemNumber: cells[itemNumber] ?? "", description: cells[description] ?? "", unit: cells[unit] ?? "", plannedQuantity: quantity, rate: amount, section: section >= 0 ? cells[section] ?? "" : "" };
    if (!row.itemNumber || !row.description || !row.unit || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(amount) || amount < 0) throw new Error(`Check row ${index + 2}: item number, description, unit, quantity above zero, and rate are required.`);
    return row;
  });
};

export default function ProjectWorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId);
  const { users: companyUsers } = useCompanyUsers(profile?.companyId);
  const project = projects.find((item) => item.id === projectId);
  const [items, setItems] = useState<BoqItem[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [reports, setReports] = useState<SiteReport[]>([]);
  const [reportComments, setReportComments] = useState<Record<string, ReportComment[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [activity, setActivity] = useState<ProjectActivityEvent[]>([]);
  const [form, setForm] = useState<BoqForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [importRows, setImportRows] = useState<ImportedBoqRow[]>([]);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isClearingBoq, setIsClearingBoq] = useState(false);
  const [todayTime] = useState(() => Date.now());

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/access");
  }, [isLoading, isProfileLoading, profile, router, user]);

  useEffect(() => {
    if (!profile || !projectId) return;
    return onSnapshot(query(collection(db, "companies", profile.companyId, "projects", projectId, "boqItems"), orderBy("itemNumber")), (snapshot) => {
      setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as BoqItem));
    });
  }, [profile, projectId]);
  useEffect(() => {
    if (!profile || reports.length === 0) return;
    const unsubscribers = reports.map((report) => onSnapshot(
      collection(db, "companies", profile.companyId, "projects", projectId, "siteReports", report.id, "comments"),
      (snapshot) => setReportComments((current) => ({ ...current, [report.id]: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ReportComment) })),
      () => setReportComments((current) => ({ ...current, [report.id]: [] }))
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [profile, projectId, reports]);
  useEffect(() => {
    if (!profile || !projectId) return;
    return onSnapshot(query(collection(db, "companies", profile.companyId, "projects", projectId, "activityLog"), orderBy("createdAt", "desc")), (snapshot) => setActivity(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ProjectActivityEvent)));
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
  const completedValue = useMemo(() => items.reduce((total, item) => total + item.cumulativeQuantityCompleted * item.rate, 0), [items]);
  const budgetBalance = project ? project.contractSum - plannedValue : 0;
  const projectProgress = plannedValue > 0 ? Math.min(100, Math.round(completedValue / plannedValue * 100)) : 0;
  const startTime = new Date(`${project?.startDate ?? ""}T00:00:00`).getTime();
  const endTime = new Date(`${project?.endDate ?? ""}T00:00:00`).getTime();
  const expectedProgress = Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime ? Math.round(Math.min(100, Math.max(0, (todayTime - startTime) / (endTime - startTime) * 100))) : 0;
  const progressGap = projectProgress - expectedProgress;
  const variationExposure = useMemo(() => variations.filter((item) => item.status !== "rejected").reduce((total, item) => total + item.estimatedValue, 0), [variations]);
  const teamMemberName = (id: string | undefined) => companyUsers.find((member) => member.id === id)?.name ?? "A team member";
  const approvalDate = (value: unknown) => value && typeof value === "object" && "toDate" in value ? (value as { toDate: () => Date }).toDate().toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : value ? new Date(String(value)).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "";
  const printProjectSummary = () => window.print();
  const activityData = (action: ProjectActivityEvent["action"], summary: string) => ({ action, summary, actorName: profile?.name ?? "Team member", createdAt: serverTimestamp() });
  const canCommentOnReport = Boolean(user && profile && (profile.role === "director" || profile.role === "quantity_surveyor" || (profile.role === "project_manager" && project?.projectManagerId === user.uid)));
  const addReportComment = async (report: SiteReport) => {
    const message = commentText[report.id]?.trim();
    if (!profile || !user || !message) return;
    try {
      const batch = writeBatch(db);
      batch.set(doc(collection(db, "companies", profile.companyId, "projects", projectId, "siteReports", report.id, "comments")), {
        message, authorId: user.uid, authorName: profile.name, recipientIds: [report.submittedBy].filter(Boolean), createdAt: serverTimestamp(),
      });
      batch.set(doc(collection(db, "companies", profile.companyId, "projects", projectId, "activityLog")), activityData("report_commented", `${profile.name} commented on the daily report for ${report.reportDate}.`));
      await batch.commit();
      setCommentText((current) => ({ ...current, [report.id]: "" }));
    } catch { setError("We could not save this report comment. Publish the latest Firestore rules, then try again."); }
  };
  const downloadBoq = () => {
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = ["itemNumber,description,unit,plannedQuantity,rate,section,cumulativeQuantityCompleted", ...items.map((item) => [item.itemNumber, item.description, item.unit, item.plannedQuantity, item.rate, item.section, item.cumulativeQuantityCompleted].map(quote).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${project?.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "project"}-boq.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const readBoqCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setImportError(""); setImportMessage("");
    try { const rows = parseBoqCsv(await file.text()); if (rows.length > 200) throw new Error("Import up to 200 BOQ items at a time."); const existing = new Set(items.map((item) => item.itemNumber)); const seen = new Set<string>(); if (rows.some((row) => existing.has(row.itemNumber) || seen.has(row.itemNumber) || !seen.add(row.itemNumber))) throw new Error("Each item number must be unique and must not already exist in this project."); setImportRows(rows); setImportMessage(`${rows.length} BOQ item${rows.length === 1 ? "" : "s"} ready to import.`); }
    catch (caughtError) { setImportRows([]); setImportError(caughtError instanceof Error ? caughtError.message : "We could not read that CSV file."); }
  };

  const importBoq = async () => {
    if (!profile || importRows.length === 0) return;
    setIsImporting(true); setImportError("");
    try { const batch = writeBatch(db); const itemsPath = collection(db, "companies", profile.companyId, "projects", projectId, "boqItems"); importRows.forEach((row) => batch.set(doc(itemsPath), { ...row, projectId, cumulativeQuantityCompleted: 0, createdAt: serverTimestamp() })); batch.set(doc(collection(db, "companies", profile.companyId, "projects", projectId, "boqUploads")), { projectId, itemCount: importRows.length, uploadedBy: user?.uid ?? "", createdAt: serverTimestamp() }); batch.set(doc(collection(db, "companies", profile.companyId, "projects", projectId, "activityLog")), activityData("boq_uploaded", `${importRows.length} BOQ item${importRows.length === 1 ? " was" : "s were"} uploaded.`)); await batch.commit(); setImportMessage(`${importRows.length} BOQ item${importRows.length === 1 ? "" : "s"} imported successfully. The Project Manager and assigned Site Engineer can now view them, and the workspace update has been sent.`); setImportRows([]); }
    catch { setImportError("We could not import the BOQ. Please try again."); }
    finally { setIsImporting(false); }
  };

  const update = (key: keyof BoqForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const removeBoqItem = async (item: BoqItem) => {
    if (!profile) return;
    if (item.cumulativeQuantityCompleted > 0) return setError("This BOQ item has reported progress and cannot be removed. Create a variation instead so the audit trail remains accurate.");
    if (!window.confirm(`Remove ${item.itemNumber} — ${item.description}? This cannot be undone.`)) return;
    try { const batch = writeBatch(db); batch.delete(doc(db, "companies", profile.companyId, "projects", projectId, "boqItems", item.id)); batch.set(doc(collection(db, "companies", profile.companyId, "projects", projectId, "activityLog")), activityData("boq_removed", `${item.itemNumber} · ${item.description} was removed.`)); await batch.commit(); }
    catch { setError("We could not remove this BOQ item. Please try again."); }
  };
  const editBoqItem = async (item: BoqItem) => {
    if (!profile) return;
    const description = window.prompt("BOQ description", item.description); if (description === null) return;
    const quantityText = window.prompt(`Planned quantity (${item.unit})`, String(item.plannedQuantity)); if (quantityText === null) return;
    const rateText = window.prompt(`Rate per ${item.unit} (₦)`, String(item.rate)); if (rateText === null) return;
    const plannedQuantity = Number(quantityText.replace(/,/g, "")); const rate = Number(rateText.replace(/[₦,]/g, ""));
    if (!description.trim() || !Number.isFinite(plannedQuantity) || plannedQuantity <= 0 || !Number.isFinite(rate) || rate < 0) return setError("Use a description, a quantity above zero, and a valid rate.");
    if (plannedQuantity < item.cumulativeQuantityCompleted) return setError("The planned quantity cannot be below the quantity already reported as complete.");
    try { const batch = writeBatch(db); batch.update(doc(db, "companies", profile.companyId, "projects", projectId, "boqItems", item.id), { description: description.trim(), plannedQuantity, rate }); batch.set(doc(collection(db, "companies", profile.companyId, "projects", projectId, "activityLog")), activityData("boq_edited", `${item.itemNumber} · ${description.trim()} was updated.`)); await batch.commit(); }
    catch { setError("We could not update this BOQ item. Please try again."); }
  };
  const clearBoq = async () => {
    if (!profile) return;
    if (reports.length || valuations.length || items.some((item) => item.cumulativeQuantityCompleted > 0)) return setError("The BOQ cannot be cleared after reports, valuations, or completed quantities exist. Remove only unused items, or use a variation to preserve the project history.");
    if (!window.confirm(`Remove all ${items.length} BOQ items from this project? This cannot be undone.`)) return;
    setIsClearingBoq(true); setError("");
    try { const batch = writeBatch(db); items.forEach((item) => batch.delete(doc(db, "companies", profile.companyId, "projects", projectId, "boqItems", item.id))); batch.set(doc(collection(db, "companies", profile.companyId, "projects", projectId, "activityLog")), activityData("boq_cleared", `${items.length} unused BOQ items were removed.`)); await batch.commit(); }
    catch { setError("We could not clear the BOQ. Please try again."); }
    finally { setIsClearingBoq(false); }
  };
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
      await addDoc(collection(db, "companies", profile.companyId, "projects", projectId, "activityLog"), activityData("boq_created", `${form.itemNumber.trim()} · ${form.description.trim()} was added.`));
      setForm(initialForm);
    } catch {
      setError("We could not save this BOQ item. Check that the latest Firestore rules have been published, then try again.");
    } finally { setSaving(false); }
  };
  const updateVariation = async (variation: Variation, approved: boolean) => {
    if (!profile || !user) return;
    const rejectionReason = approved ? "" : window.prompt("Why is this variation being rejected?")?.trim();
    if (!approved && !rejectionReason) return;
    try { const batch = writeBatch(db); batch.update(doc(db, "companies", profile.companyId, "projects", projectId, "variations", variation.id), approved ? { status: "approved", approvedBy: user.uid, approvedAt: serverTimestamp() } : { status: "rejected", rejectionReason, approvedBy: user.uid, approvedAt: serverTimestamp() }); batch.set(doc(collection(db, "companies", profile.companyId, "projects", projectId, "activityLog")), activityData(approved ? "variation_approved" : "variation_rejected", `Variation ${approved ? "approved" : "rejected"}: ${variation.description}.`)); await batch.commit(); }
    catch { setError("We could not update this variation. Please try again."); }
  };
  const forwardVariation = async (variation: Variation) => {
    if (!profile || !user) return;
    try { const batch = writeBatch(db); batch.update(doc(db, "companies", profile.companyId, "projects", projectId, "variations", variation.id), { status: "pending_director_approval", reviewedBy: user.uid, reviewedAt: serverTimestamp() }); batch.set(doc(collection(db, "companies", profile.companyId, "projects", projectId, "activityLog")), activityData("variation_reviewed", `Variation reviewed and sent to the Director: ${variation.description}.`)); await batch.commit(); }
    catch { setError("We could not send this variation to the Director. Please try again."); }
  };

  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening project workspace…</main>;
  if (!project) return <main className="auth-loading">This project could not be found. <Link href="/dashboard">Return to dashboard</Link></main>;
  if (!canWorkOnProject(profile.role, user.uid, project)) return <main className="auth-loading">This project is not assigned to you. <Link href="/dashboard">Return to your assigned projects</Link></main>;

  return <main className="project-workspace"><div className="workspace-content">
    <Link className="back-link" href="/dashboard">← Back to portfolio</Link>
    <nav className="project-tabs" aria-label="Project sections"><button type="button" onClick={() => document.querySelector(".project-title-row")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Overview</button><button type="button" onClick={() => document.querySelector(".boq-layout")?.scrollIntoView({ behavior: "smooth", block: "start" })}>BOQ</button><Link href={`/projects/${projectId}/schedule`}>Schedule</Link><button type="button" onClick={() => document.querySelector(".report-register")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Reports</button><button type="button" onClick={() => document.querySelector(".variation-register")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Variations</button><button type="button" onClick={() => document.querySelector(".valuation-register")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Valuations</button><button type="button" onClick={() => document.querySelector(".site-assignment")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Team</button><button type="button" onClick={() => document.querySelector(".audit-register")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Activity</button></nav>
    <div className="project-title-row"><div><p className="eyebrow">Project BOQ</p><h1>{project.name}</h1><p>{project.clientName} · {project.location}, {project.state}</p></div><div className="project-title-actions">{canSubmitReport(profile.role) && <Link className="primary-action no-print" href={`/projects/${projectId}/reports/new`}>+ Daily site report</Link>}{canRaiseVariation(profile.role) && <Link className="secondary compact-action no-print" href={`/projects/${projectId}/variations/new`}>Raise variation</Link>}{canGenerateValuation(profile.role) && <Link className="secondary compact-action no-print" href={`/projects/${projectId}/valuations/new`}>Create valuation</Link>}{canManageProject(profile.role) && <><Link className="text-action no-print" href={`/projects/${projectId}/settings`}>Project settings</Link><button className="print-summary-button no-print" type="button" onClick={printProjectSummary}>Print / save summary</button></>}<div className="contract-summary"><span>Contract sum</span><strong>{formatNaira(project.contractSum)}</strong></div></div></div>
    <section className="project-command-bar" aria-label="Project at a glance"><div className="project-command-status"><span className={`project-status ${project.status}`}>{project.status.replaceAll("_", " ")}</span><p>{project.location}, {project.state}</p></div><div className="project-command-metrics"><div><span>BOQ progress</span><strong>{plannedValue ? `${projectProgress}%` : "Not set"}</strong></div><div><span>Daily reports</span><strong>{reports.length}</strong><small>{reports[0]?.reportDate ? `Latest: ${new Date(`${reports[0].reportDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}` : "No report yet"}</small></div><div><span>Open variations</span><strong>{variations.filter((item) => item.status !== "approved" && item.status !== "rejected").length}</strong><small>{formatNaira(variationExposure)} exposure</small></div><div><span>Contract end</span><strong>{new Date(`${project.endDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</strong><small>{expectedProgress}% expected by today</small></div></div></section>
    <section className={`site-assignment ${project.siteEngineerName ? "assigned" : "unassigned"}`}><div><p className="eyebrow">Project team</p><h2>{project.projectManagerName ? `Project Manager: ${project.projectManagerName}` : "Project Manager not assigned"}</h2><p>{project.siteEngineerName ? `Site Engineer: ${project.siteEngineerName} · responsible for daily reports and site-level variations.` : "Assign a Site Engineer before site reporting begins."}</p></div>{canManageProject(profile.role) ? <Link className="secondary compact-action" href={`/projects/${projectId}/settings`}>Manage team</Link> : <span className="assignment-status">{project.siteEngineerName ? "Site assigned" : "Awaiting assignment"}</span>}</section>
    <section className="budget-summary"><article><span>Contract sum</span><strong>{formatNaira(project.contractSum)}</strong></article><article><span>Planned BOQ value</span><strong>{formatNaira(plannedValue)}</strong></article><article><span>Completed BOQ value</span><strong>{formatNaira(completedValue)}</strong></article><article className={budgetBalance < 0 ? "budget-overrun" : ""}><span>{budgetBalance < 0 ? "BOQ overrun" : "Project progress"}</span><strong>{budgetBalance < 0 ? formatNaira(Math.abs(budgetBalance)) : `${projectProgress}%`}</strong></article></section>
    <div className="boq-layout">{canManageBoq(profile.role) && <section className="boq-card"><p className="eyebrow">Add cost item</p><h2>Build your BOQ</h2><p>Add the contract quantities and agreed rates. The platform will use these items for site progress and valuations.</p>
      <form className="boq-form" onSubmit={submit}><label>Item number<input value={form.itemNumber} onChange={(event) => update("itemNumber", event.target.value)} placeholder="e.g. 1.01" required /></label><label>Description<input value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="e.g. Excavation for foundation" required /></label><label>Section (optional)<input value={form.section} onChange={(event) => update("section", event.target.value)} placeholder="e.g. Substructure" /></label><div className="boq-number-fields"><label>Unit<input value={form.unit} onChange={(event) => update("unit", event.target.value)} placeholder="m³, m², No." required /></label><label>Planned quantity<input inputMode="decimal" value={form.plannedQuantity} onChange={(event) => update("plannedQuantity", event.target.value)} placeholder="0" required /></label></div><label>Rate per unit (₦)<input inputMode="decimal" value={form.rate} onChange={(event) => update("rate", event.target.value)} placeholder="0" required /></label>{error && <p className="form-error">{error}</p>}<button disabled={saving}>{saving ? "Saving item…" : "Add BOQ item"}</button></form><div className="boq-import"><h3>Import BOQ from CSV</h3><p>In Excel, save your BOQ as a CSV file with these headings: <b>itemNumber, description, unit, plannedQuantity, rate, section</b>.</p><input type="file" accept=".csv,text/csv" onChange={(event) => void readBoqCsv(event)} /><p className="field-hint">Rates may include commas or the ₦ symbol. Import up to 200 items at a time.</p>{importMessage && <p className="form-success">{importMessage}</p>}{importError && <p className="form-error">{importError}</p>}{importRows.length > 0 && <button type="button" onClick={() => void importBoq()} disabled={isImporting}>{isImporting ? "Importing BOQ…" : `Import ${importRows.length} BOQ items`}</button>}</div>
    </section>}
    <section className="boq-card"><div className="boq-header"><div><p className="eyebrow">Cost plan</p><h2>BOQ items</h2></div><p className="boq-total">Planned BOQ value<strong>{formatNaira(plannedValue)}</strong></p></div><p className="field-hint">Visible to the Director, Quantity Surveyor, Project Manager, and the assigned Site Engineer. Only the Director and Quantity Surveyor can upload or edit the BOQ.</p>{items.length > 0 && <button className="download-boq-button" type="button" onClick={downloadBoq}>Download BOQ CSV</button>}{canManageBoq(profile.role) && items.length > 0 && <button className="clear-boq-button" type="button" disabled={isClearingBoq} onClick={() => void clearBoq()}>{isClearingBoq ? "Removing BOQ…" : "Remove all unused BOQ items"}</button>}{error && <p className="form-error">{error}</p>}{items.length === 0 ? <p className="boq-empty">No BOQ items yet. Start with the major contract work items, such as preliminaries, foundation, structure, finishes, or services.</p> : <div className="boq-list">{items.map((item) => { const progress = item.plannedQuantity > 0 ? Math.min(100, Math.round(item.cumulativeQuantityCompleted / item.plannedQuantity * 100)) : 0; return <article className="boq-item" key={item.id}><div className="boq-item-top"><div><span className="boq-item-number">{item.section} · {item.itemNumber}</span><h3>{item.description}</h3></div><strong>{formatNaira(item.plannedQuantity * item.rate)}</strong></div><p className="boq-item-meta">{item.plannedQuantity.toLocaleString()} {item.unit} × {formatNaira(item.rate)} per {item.unit}</p><div className="boq-item-progress"><div><span>{item.cumulativeQuantityCompleted.toLocaleString()} of {item.plannedQuantity.toLocaleString()} {item.unit} complete</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>{canManageBoq(profile.role) && <div className="boq-item-actions"><button className="edit-boq-button" type="button" onClick={() => void editBoqItem(item)}>Edit item</button><button className="remove-boq-button" type="button" onClick={() => void removeBoqItem(item)}>Remove item</button></div>}</article>; })}</div>}</section>
    </div>
    <section className="delivery-snapshot"><div className="delivery-snapshot-heading"><div><p className="eyebrow">Delivery snapshot</p><h2>Planned versus actual progress</h2></div><Link className="text-action" href={`/projects/${projectId}/schedule`}>Open milestones →</Link></div><div className="delivery-progress"><div className="delivery-progress-label"><span>Actual progress</span><strong>{plannedValue ? `${projectProgress}%` : "BOQ setup needed"}</strong></div><div className="delivery-track actual"><span style={{ width: `${projectProgress}%` }} /></div><div className="delivery-progress-label"><span>Expected by today</span><strong>{plannedValue ? `${expectedProgress}%` : "—"}</strong></div><div className="delivery-track expected"><span style={{ width: `${expectedProgress}%` }} /></div></div><div className="delivery-timeline"><span>{new Date(`${project.startDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span><div><i /><b style={{ left: `${expectedProgress}%` }} /><em style={{ left: `${projectProgress}%` }} /></div><span>{new Date(`${project.endDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span></div><p className={`delivery-status ${progressGap >= -10 ? "on-track" : progressGap >= -25 ? "attention" : "behind"}`}>{plannedValue ? progressGap >= -10 ? "On track with the current programme." : progressGap >= -25 ? `${Math.abs(progressGap)}% behind the programme position.` : `${Math.abs(progressGap)}% behind plan — review milestones and site activity.` : "Import the BOQ to begin measuring delivery against the programme."}</p></section>
    <section className="report-register">
      <div className="boq-header"><div><p className="eyebrow">Site activity</p><h2>Daily reports</h2></div>{canSubmitReport(profile.role) && <Link className="secondary compact-action" href={`/projects/${projectId}/reports/new`}>Add report</Link>}</div>
      {reports.length === 0 ? <p className="boq-empty">No daily reports have been submitted for this project.</p> : <div className="report-history">{reports.map((report) => <article className="report-history-row" key={report.id}>
        <div><span className="report-history-date">{new Date(`${report.reportDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span><h3>{report.lineItems.length} BOQ item{report.lineItems.length === 1 ? "" : "s"} updated</h3><p className="report-submitter">Submitted by <strong>{teamMemberName(report.submittedBy)}</strong></p></div>
        <p><span>Labour</span><strong>{report.labourCount}</strong></p><p><span>Issues</span><strong>{report.issues.length}</strong></p>
        <p className="report-history-note">{report.equipmentOnSite.length > 0 && <><b>Equipment</b> · {report.equipmentOnSite.join(", ")}<br /></>}{report.issues[0] ? <><b>{report.issues[0].category.replaceAll("_", " ")}</b> · {report.issues[0].note}</> : report.equipmentOnSite.length === 0 ? "No issues or equipment recorded" : "No issues recorded"}</p>
        <div className="report-comments">
          {(reportComments[report.id] ?? []).filter((comment) => comment.authorId === user?.uid || report.submittedBy === user?.uid || comment.recipientIds?.includes(user?.uid ?? "")).map((comment) => <p key={comment.id}><strong>{comment.authorName}:</strong> {comment.message}</p>)}
          {canCommentOnReport && <div><p className="field-hint">Your comment will be sent directly to the person who submitted this report.</p><textarea value={commentText[report.id] ?? ""} onChange={(event) => setCommentText((current) => ({ ...current, [report.id]: event.target.value }))} placeholder="Write a comment for the report sender…" /><button type="button" onClick={() => void addReportComment(report)} disabled={!commentText[report.id]?.trim()}>Send comment</button></div>}
        </div>
      </article>)}</div>}
    </section>
    <section className="variation-register"><div className="boq-header"><div><p className="eyebrow">Change control</p><h2>Variation register</h2></div><p className="boq-total">Open exposure<strong>{formatNaira(variationExposure)}</strong></p></div>{variations.length === 0 ? <p className="boq-empty">No variations have been raised for this project.</p> : <div className="variation-list">{variations.map((variation) => <article className="variation-row" key={variation.id}><div><span className={`variation-status ${variation.status}`}>{variation.status.replaceAll("_", " ")}</span><h3>{variation.description}</h3><p>{variation.reason}</p><div className="approval-history"><span>Raised {approvalDate(variation.raisedAt)}</span>{variation.reviewedAt && <span>Reviewed by {teamMemberName(variation.reviewedBy)} · {approvalDate(variation.reviewedAt)}</span>}{variation.approvedAt && <span>{variation.status === "approved" ? "Approved" : "Rejected"} by {teamMemberName(variation.approvedBy)} · {approvalDate(variation.approvedAt)}</span>}</div></div><div className="variation-actions"><strong>{formatNaira(variation.estimatedValue)}</strong>{variation.status === "pending_qs_review" && canReviewVariation(profile.role) && <div><button type="button" onClick={() => void forwardVariation(variation)}>{profile.role === "quantity_surveyor" ? "Complete QS review" : "Recommend to Director"}</button></div>}{variation.status === "pending_director_approval" && canFinalApproveVariation(profile.role) && <div><button type="button" onClick={() => void updateVariation(variation, true)}>Approve</button><button className="reject-button" type="button" onClick={() => void updateVariation(variation, false)}>Reject</button></div>}</div></article>)}</div>}</section>
    <section className="valuation-register"><div className="boq-header"><div><p className="eyebrow">Payment certificates</p><h2>Valuation register</h2></div>{canGenerateValuation(profile.role) && <Link className="secondary compact-action" href={`/projects/${projectId}/valuations/new`}>Create valuation</Link>}</div>{valuations.length === 0 ? <p className="boq-empty">No payment certificates have been issued for this project.</p> : <div className="valuation-list">{valuations.map((valuation) => <article className="valuation-row" key={valuation.id}><div><span className="valuation-certificate">{valuation.certificateNumber}</span><h3>{new Date(`${valuation.valuationDate}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</h3></div><p><span>Gross value</span><strong>{formatNaira(valuation.grossValue)}</strong></p><p><span>Retention</span><strong>{formatNaira(valuation.retentionAmount)}</strong></p><p className="valuation-due"><span>Net due</span><strong>{formatNaira(valuation.netAmountDue)}</strong></p></article>)}</div>}</section>
    <section className="audit-register"><div className="boq-header"><div><p className="eyebrow">Audit history</p><h2>Project activity</h2></div></div>{activity.length === 0 ? <p className="boq-empty">BOQ work, reports, variations, and valuations will be recorded here.</p> : <div className="audit-list">{activity.slice(0, 12).map((event) => <article className="audit-row" key={event.id}><div><strong>{event.summary}</strong><p>{event.actorName}</p></div><time>{approvalDate(event.createdAt)}</time></article>)}</div>}</section>
  <nav className="project-mobile-actions no-print" aria-label="Project quick actions"><button type="button" onClick={() => document.querySelector(".project-title-row")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Overview</button><button type="button" onClick={() => document.querySelector(".boq-layout")?.scrollIntoView({ behavior: "smooth", block: "start" })}>BOQ</button>{canSubmitReport(profile.role) ? <Link href={`/projects/${projectId}/reports/new`}>Report</Link> : <button type="button" onClick={() => document.querySelector(".report-register")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Reports</button>}<Link href="/chat">Chat</Link></nav>
  </div></main>;
}

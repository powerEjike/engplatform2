"use client";

import Link from "next/link";
import { addDoc, collection, onSnapshot, serverTimestamp } from "firebase/firestore";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { BoqItem, Valuation, Variation } from "@engplatform2/shared-types";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { formatNaira } from "@/lib/dashboard-data";
import { useProjects } from "@/hooks/use-projects";
import { canGenerateValuation } from "@/lib/permissions";

const today = () => new Date().toISOString().slice(0, 10);
const asAmount = (value: string) => Math.max(0, Number(value) || 0);

export default function NewValuationPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId, profile?.role, user?.uid);
  const project = projects.find((item) => item.id === projectId);
  const [items, setItems] = useState<BoqItem[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [earlierValuations, setEarlierValuations] = useState<Valuation[]>([]);
  const [certificateNumber, setCertificateNumber] = useState("");
  const [valuationDate, setValuationDate] = useState(today);
  const [retentionRate, setRetentionRate] = useState("5");
  const [advanceRecovery, setAdvanceRecovery] = useState("0");
  const [otherDeductions, setOtherDeductions] = useState("0");
  const [vatRate, setVatRate] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/access");
  }, [isLoading, isProfileLoading, profile, router, user]);

  useEffect(() => {
    if (!profile) return;
    return onSnapshot(collection(db, "companies", profile.companyId, "projects", projectId, "boqItems"), (snapshot) => setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as BoqItem)));
  }, [profile, projectId]);

  useEffect(() => {
    if (!profile) return;
    return onSnapshot(collection(db, "companies", profile.companyId, "projects", projectId, "variations"), (snapshot) => setVariations(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Variation)));
  }, [profile, projectId]);

  useEffect(() => {
    if (!profile) return;
    return onSnapshot(collection(db, "companies", profile.companyId, "projects", projectId, "valuations"), (snapshot) => setEarlierValuations(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Valuation)));
  }, [profile, projectId]);

  const totals = useMemo(() => {
    const completedBoqValue = items.reduce((total, item) => total + item.cumulativeQuantityCompleted * item.rate, 0);
    const approvedVariationValue = variations.filter((item) => item.status === "approved").reduce((total, item) => total + item.estimatedValue, 0);
    const cumulativeGrossValue = completedBoqValue + approvedVariationValue;
    const previousCertificates = earlierValuations.filter((item) => item.status === "approved" && item.valuationDate < valuationDate).sort((left, right) => right.valuationDate.localeCompare(left.valuationDate));
    const previousCertificate = previousCertificates[0];
    const previousCertifiedValue = previousCertificate?.cumulativeGrossValue ?? previousCertificate?.grossValue ?? 0;
    const previousRetentionAmount = previousCertificate?.cumulativeRetentionAmount ?? previousCertificate?.retentionAmount ?? 0;
    const previousNetCertifiedAmount = previousCertificates.reduce((total, item) => total + item.netAmountDue, 0);
    const workThisCertificate = Math.max(0, cumulativeGrossValue - previousCertifiedValue);
    const rate = asAmount(retentionRate);
    const cumulativeRetentionAmount = cumulativeGrossValue * rate / 100;
    const retentionThisCertificate = Math.max(0, cumulativeRetentionAmount - previousRetentionAmount);
    const advanceRecoveryAmount = asAmount(advanceRecovery);
    const otherDeductionsAmount = asAmount(otherDeductions);
    const taxableAmount = Math.max(0, workThisCertificate - retentionThisCertificate - advanceRecoveryAmount - otherDeductionsAmount);
    const currentVatRate = asAmount(vatRate);
    const vatAmount = taxableAmount * currentVatRate / 100;
    return { completedBoqValue, approvedVariationValue, cumulativeGrossValue, previousCertifiedValue, previousRetentionAmount, previousNetCertifiedAmount, workThisCertificate, cumulativeRetentionAmount, retentionThisCertificate, advanceRecoveryAmount, otherDeductionsAmount, vatRate: currentVatRate, vatAmount, netAmountDue: taxableAmount + vatAmount };
  }, [advanceRecovery, earlierValuations, items, otherDeductions, retentionRate, valuationDate, variations, vatRate]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !user) return;
    const rate = Number(retentionRate);
    const vat = Number(vatRate);
    if (!certificateNumber.trim() || !Number.isFinite(rate) || rate < 0 || rate > 100 || !Number.isFinite(vat) || vat < 0 || vat > 100) return setError("Enter a certificate number and retention/VAT rates between 0 and 100.");
    setSaving(true);
    setError("");
    try {
      const status = profile.role === "director" ? "pending_director_approval" : "pending_project_manager_review";
      await addDoc(collection(db, "companies", profile.companyId, "projects", projectId, "valuations"), {
        projectId, certificateNumber: certificateNumber.trim(), valuationDate,
        completedBoqValue: totals.completedBoqValue, approvedVariationValue: totals.approvedVariationValue,
        grossValue: totals.cumulativeGrossValue, cumulativeGrossValue: totals.cumulativeGrossValue,
        previousCertifiedValue: totals.previousCertifiedValue, workThisCertificate: totals.workThisCertificate,
        retentionRate: rate, retentionAmount: totals.retentionThisCertificate,
        cumulativeRetentionAmount: totals.cumulativeRetentionAmount, previousRetentionAmount: totals.previousRetentionAmount,
        retentionThisCertificate: totals.retentionThisCertificate, advanceRecoveryAmount: totals.advanceRecoveryAmount,
        otherDeductionsAmount: totals.otherDeductionsAmount, vatRate: totals.vatRate, vatAmount: totals.vatAmount,
        previousNetCertifiedAmount: totals.previousNetCertifiedAmount, netAmountDue: totals.netAmountDue,
        status, createdBy: user.uid, createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, "companies", profile.companyId, "projects", projectId, "activityLog"), {
        action: "valuation_created", summary: `Valuation ${certificateNumber.trim()} was prepared for approval.`,
        actorId: user.uid, actorName: profile.name, actorRole: profile.role, createdAt: serverTimestamp(),
      });
      router.replace(`/projects/${projectId}`);
    } catch {
      setError("We could not prepare this valuation. Check the Firestore rules and try again.");
      setSaving(false);
    }
  };

  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Preparing valuation…</main>;
  if (!project) return <main className="auth-loading">Project not found. <Link href="/dashboard">Return to dashboard</Link></main>;
  if (!canGenerateValuation(profile.role)) return <main className="auth-loading">Your role cannot create valuations. <Link href={`/projects/${projectId}`}>Return to project</Link></main>;

  return <main className="report-page"><div className="report-content">
    <Link className="back-link" href={`/projects/${projectId}`}>← Back to {project.name}</Link>
    <section className="report-card">
      <p className="eyebrow">Interim payment certificate</p><h1>Create valuation</h1>
      <p className="report-intro">Build a certificate from cumulative BOQ work and approved variations. Only the new value since the last approved certificate is payable now.</p>
      <form className="report-form" onSubmit={submit}>
        <section className="report-section"><p className="valuation-step">Step 01 · Certificate details</p><div className="boq-number-fields"><label className="report-labour-field">Certificate number<input value={certificateNumber} onChange={(event) => setCertificateNumber(event.target.value)} placeholder="e.g. IPC-001" required /></label><label className="report-labour-field">Valuation date<input type="date" value={valuationDate} onChange={(event) => setValuationDate(event.target.value)} required /></label></div></section>
        <section className="report-section"><p className="valuation-step">Step 02 · Deductions and tax</p><div className="boq-number-fields valuation-input-grid"><label className="report-labour-field">Retention rate (%)<input inputMode="decimal" value={retentionRate} onChange={(event) => setRetentionRate(event.target.value)} required /></label><label className="report-labour-field">Advance recovery (₦)<input inputMode="decimal" value={advanceRecovery} onChange={(event) => setAdvanceRecovery(event.target.value)} /></label><label className="report-labour-field">Other deductions (₦)<input inputMode="decimal" value={otherDeductions} onChange={(event) => setOtherDeductions(event.target.value)} /></label><label className="report-labour-field">VAT rate (%)<input inputMode="decimal" value={vatRate} onChange={(event) => setVatRate(event.target.value)} /></label></div><p className="field-hint">Enter 0 where a deduction or VAT does not apply to this certificate.</p></section>
        <section className="valuation-breakdown" aria-label="Valuation calculation">
          <p className="valuation-breakdown-heading">Cumulative project value</p>
          <p><span>Completed BOQ work</span><strong>{formatNaira(totals.completedBoqValue)}</strong></p>
          <p><span>Approved variations</span><strong>{formatNaira(totals.approvedVariationValue)}</strong></p>
          <p><span>Cumulative gross value to date</span><strong>{formatNaira(totals.cumulativeGrossValue)}</strong></p>
          <p><span>Less: previously certified value</span><strong>-{formatNaira(totals.previousCertifiedValue)}</strong></p>
          <p className="valuation-subtotal"><span>Work included in this certificate</span><strong>{formatNaira(totals.workThisCertificate)}</strong></p>
          <p><span>Less: retention for this certificate</span><strong>-{formatNaira(totals.retentionThisCertificate)}</strong></p>
          <p><span>Less: advance recovery</span><strong>-{formatNaira(totals.advanceRecoveryAmount)}</strong></p>
          <p><span>Less: other deductions</span><strong>-{formatNaira(totals.otherDeductionsAmount)}</strong></p>
          <p><span>Add: VAT</span><strong>{formatNaira(totals.vatAmount)}</strong></p>
          <p className="valuation-net"><span>Net amount payable now</span><strong>{formatNaira(totals.netAmountDue)}</strong></p>
          <p className="valuation-context"><span>Previously certified (net)</span><strong>{formatNaira(totals.previousNetCertifiedAmount)}</strong></p>
        </section>
        {error && <p className="form-error">{error}</p>}
        <div className="report-submit-row"><p className="report-intro">{profile.role === "director" ? "This valuation will go to your final approval queue." : "This valuation will be sent to the assigned Project Manager for recommendation, then to the Director for final approval."}</p><button disabled={saving}>{saving ? "Preparing certificate…" : "Prepare valuation"}</button></div>
      </form>
    </section>
  </div></main>;
}

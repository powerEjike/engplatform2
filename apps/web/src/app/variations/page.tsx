"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { formatNaira } from "@/lib/dashboard-data";
import { useProjects } from "@/hooks/use-projects";
import { useProjectProgress } from "@/hooks/use-project-progress";
import { canWorkOnProject } from "@/lib/project-access";

export default function VariationsPage() {
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects(profile?.companyId);
  const { variationsByProject } = useProjectProgress(profile?.companyId, projects);
  const [selectedStatus, setSelectedStatus] = useState("All statuses");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/onboarding");
  }, [isLoading, isProfileLoading, profile, router, user]);

  const variations = useMemo(() => {
    if (!profile || !user) return [];
    return projects.filter((project) => canWorkOnProject(profile.role, user.uid, project)).flatMap((project) => (variationsByProject[project.id] ?? []).map((variation) => ({ ...variation, projectName: project.name }))).filter((variation) => selectedStatus === "All statuses" || variation.status === selectedStatus).sort((left, right) => String(right.approvedAt || right.reviewedAt || right.raisedAt).localeCompare(String(left.approvedAt || left.reviewedAt || left.raisedAt)));
  }, [profile, projects, selectedStatus, user, variationsByProject]);
  const openValue = variations.filter((variation) => variation.status !== "rejected").reduce((sum, variation) => sum + variation.estimatedValue, 0);
  const downloadVariations = () => {
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = ["Project,Description,Reason,Estimated value,Status,Raised date", ...variations.map((variation) => [variation.projectName, variation.description, variation.reason, variation.estimatedValue, variation.status.replaceAll("_", " "), String(variation.raisedAt)].map(quote).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "engplatform2-variation-register.csv"; link.click(); URL.revokeObjectURL(url);
  };

  if (isLoading || isProfileLoading || projectsLoading || !user || !profile) return <main className="auth-loading">Opening variation register…</main>;
  if (profile.role === "site_engineer") return <main className="auth-loading">Your variation activity is available within your assigned project. <Link href="/">Return to workspace</Link></main>;

  return <main className="report-page"><div className="schedule-content"><Link className="back-link" href="/">← Back to workspace</Link><section className="schedule-hero"><div><p className="eyebrow">Change control</p><h1>Variation register</h1><p>Review every project change, its value, and the decision currently required.</p></div><div className="schedule-hero-metrics"><span><strong>{variations.length}</strong> variation{variations.length === 1 ? "" : "s"}</span><span><strong>{formatNaira(openValue)}</strong> exposure</span></div></section><section className="variation-filter" aria-label="Filter variations"><label className="state-filter"><span>Status</span><select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}><option value="All statuses">All statuses</option><option value="pending_qs_review">Awaiting QS review</option><option value="pending_director_approval">Awaiting Director approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label><button className="secondary compact-action" type="button" disabled={variations.length === 0} onClick={downloadVariations}>Download CSV</button></section><section className="variation-portfolio-list">{variations.length === 0 ? <p className="empty-state">No variations match this view.</p> : variations.map((variation) => <article className="variation-portfolio-row" key={`${variation.projectId}-${variation.id}`}><div><span className={`variation-status ${variation.status}`}>{variation.status.replaceAll("_", " ")}</span><Link className="project-name-link" href={`/projects/${variation.projectId}`}><h2>{variation.description}</h2></Link><p>{variation.projectName} · {variation.reason}</p></div><strong>{formatNaira(variation.estimatedValue)}</strong><Link className="text-action" href={`/projects/${variation.projectId}`}>Open project</Link></article>)}</section></div></main>;
}

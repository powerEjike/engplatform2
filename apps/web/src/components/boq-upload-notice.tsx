"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BoqUploadEvent, Project } from "@engplatform2/shared-types";

const eventTime = (value: unknown) => value && typeof value === "object" && "toDate" in value ? (value as { toDate: () => Date }).toDate().getTime() : new Date(String(value ?? 0)).getTime();

export function BoqUploadNotice({ eventsByProject, projects, canAccessProject }: { eventsByProject: Record<string, BoqUploadEvent[]>; projects: Project[]; canAccessProject: (project: Project) => boolean }) {
  const latest = useMemo(() => projects.filter(canAccessProject).flatMap((project) => (eventsByProject[project.id] ?? []).map((event) => ({ ...event, projectName: project.name }))).sort((left, right) => eventTime(right.createdAt) - eventTime(left.createdAt))[0], [canAccessProject, eventsByProject, projects]);
  const [dismissedId, setDismissedId] = useState("");
  const isDismissed = !!latest && (dismissedId === latest.id || (typeof window !== "undefined" && localStorage.getItem(`engplatform2:boq-upload:${latest.id}`) === "dismissed"));
  if (!latest || isDismissed) return null;
  const close = () => { localStorage.setItem(`engplatform2:boq-upload:${latest.id}`, "dismissed"); setDismissedId(latest.id); };
  return <aside className="boq-upload-notice" role="status"><div><p className="eyebrow">BOQ uploaded</p><h2>{latest.projectName}</h2><p>{latest.itemCount} BOQ item{latest.itemCount === 1 ? " is" : "s are"} ready for review and project delivery.</p></div><div className="boq-upload-notice-actions"><Link className="primary-action" href={`/projects/${latest.projectId}`} onClick={close}>View BOQ</Link><button className="notice-dismiss" type="button" onClick={close}>Dismiss</button></div></aside>;
}

"use client";

import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useProjects } from "@/hooks/use-projects";
import { db } from "@/lib/firebase";

type CommentNotice = { id: string; projectId: string; authorName: string; message: string };

export function ReportCommentNotifier() {
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const { projects } = useProjects(profile?.companyId);
  const [notice, setNotice] = useState<CommentNotice | null>(null);
  const initializedReports = useRef(new Set<string>());

  useEffect(() => {
    if (!user || !profile) return;
    const commentUnsubscribers: (() => void)[] = [];
    const watchedReports = initializedReports.current;
    const watchComments = (projectId: string, reportId: string) => {
      const reportKey = `${projectId}/${reportId}`;
      if (watchedReports.has(reportKey)) return;
      watchedReports.add(reportKey);
      let initialSnapshot = true;
      commentUnsubscribers.push(onSnapshot(collection(db, "companies", profile.companyId, "projects", projectId, "siteReports", reportId, "comments"), (comments) => {
        if (initialSnapshot) { initialSnapshot = false; return; }
        comments.docChanges().filter((change) => change.type === "added" && !change.doc.metadata.hasPendingWrites).forEach((change) => {
          const data = change.doc.data() as { authorId?: string; authorName?: string; message?: string; recipientIds?: string[] };
          if (data.authorId !== user.uid && data.recipientIds?.includes(user.uid)) setNotice({ id: change.doc.id, projectId, authorName: data.authorName ?? "A team member", message: data.message ?? "New comment on your daily report." });
        });
      }));
    };
    const reportUnsubscribers = projects.map((project) => onSnapshot(collection(db, "companies", profile.companyId, "projects", project.id, "siteReports"), (reports) => reports.docs.forEach((report) => watchComments(project.id, report.id))));
    return () => { reportUnsubscribers.forEach((unsubscribe) => unsubscribe()); commentUnsubscribers.forEach((unsubscribe) => unsubscribe()); watchedReports.clear(); };
  }, [profile, projects, user]);

  if (isLoading || isProfileLoading || !user || !profile || !notice) return null;
  return <aside className="report-comment-notification" role="status"><div><strong>{notice.authorName} commented on your report</strong><p>{notice.message}</p></div><Link href={`/projects/${notice.projectId}`} onClick={() => setNotice(null)}>Open project</Link><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss report comment notification">×</button></aside>;
}

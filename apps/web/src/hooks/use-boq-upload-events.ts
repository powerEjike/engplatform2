import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { BoqUploadEvent, Project } from "@engplatform2/shared-types";
import { db } from "@/lib/firebase";

export function useBoqUploadEvents(companyId: string | undefined, projects: Project[]) {
  const [eventsByProject, setEventsByProject] = useState<Record<string, BoqUploadEvent[]>>({});
  useEffect(() => {
    if (!companyId) return;
    const unsubscribe = projects.map((project) => onSnapshot(query(collection(db, "companies", companyId, "projects", project.id, "boqUploads"), orderBy("createdAt", "desc")), (snapshot) => {
      setEventsByProject((current) => ({ ...current, [project.id]: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as BoqUploadEvent) }));
    }));
    return () => unsubscribe.forEach((stop) => stop());
  }, [companyId, projects]);
  return { eventsByProject };
}

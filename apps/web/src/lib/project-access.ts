import type { Project } from "@engplatform2/shared-types";

export function canWorkOnProject(role: string, userId: string, project: Project) {
  return role === "director"
    || role === "quantity_surveyor"
    || (role === "project_manager" && project.projectManagerId === userId)
    || (role === "site_engineer" && project.siteEngineerId === userId);
}

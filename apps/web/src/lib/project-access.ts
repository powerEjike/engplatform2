import type { Project } from "@engplatform2/shared-types";

export function canWorkOnProject(role: string, userId: string, project: Project) {
  return role !== "site_engineer" || project.siteEngineerId === userId;
}

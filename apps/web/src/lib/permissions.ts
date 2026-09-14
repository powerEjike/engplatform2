export const canSubmitReport = (role: string) => ["site_engineer", "project_manager", "director"].includes(role);
export const canRaiseVariation = (role: string) => ["site_engineer", "project_manager", "director"].includes(role);
export const canManageBoq = (role: string) => ["quantity_surveyor", "director"].includes(role);
export const canDecideVariation = (role: string) => ["project_manager", "director"].includes(role);
export const canGenerateValuation = (role: string) => ["quantity_surveyor", "director"].includes(role);
export const canManageProject = (role: string) => ["project_manager", "director"].includes(role);

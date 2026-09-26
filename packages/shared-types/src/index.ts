export type UserRole =
  | "site_engineer"
  | "project_manager"
  | "quantity_surveyor"
  | "director"
  | "client";

export type ProjectStatus = "active" | "on_hold" | "completed";
export type VariationStatus = "pending_qs_review" | "pending_director_approval" | "approved" | "rejected";
export type ReportSyncStatus = "draft" | "pending_sync" | "synced" | "failed";
export type IssueCategory = "weather" | "material_shortage" | "access" | "other";
export type ScheduleHealth = "on_track" | "attention" | "behind";
export type MilestoneStatus = "not_started" | "in_progress" | "complete";

export interface Company {
  id: string;
  name: string;
  subscriptionTier: string;
  active: boolean;
  ownerId: string;
  createdAt: string;
}

export interface AppUser {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  assignedProjectIds: string[];
  active: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  clientName: string;
  contractSum: number;
  location: string;
  state: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  projectManagerId?: string;
  projectManagerName?: string;
  siteEngineerId?: string;
  siteEngineerName?: string;
  assignmentUpdatedAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  plannedDate: string;
  actualDate?: string | null;
  status: MilestoneStatus;
  progress: number;
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BoqItem {
  id: string;
  projectId: string;
  itemNumber: string;
  description: string;
  unit: string;
  plannedQuantity: number;
  rate: number;
  section: string;
  cumulativeQuantityCompleted: number;
  createdAt: string;
}

export interface BoqUploadEvent {
  id: string;
  projectId: string;
  itemCount: number;
  uploadedBy: string;
  createdAt: string;
}

export interface ProjectActivityEvent {
  id: string;
  action: "boq_uploaded" | "boq_created" | "boq_edited" | "boq_removed" | "boq_cleared" | "report_submitted" | "report_commented" | "report_reviewed" | "action_assigned" | "variation_raised" | "variation_reviewed" | "variation_approved" | "variation_rejected" | "valuation_issued" | "valuation_created" | "valuation_recommended" | "valuation_approved" | "valuation_rejected";
  summary: string;
  actorName: string;
  createdAt: string;
}

export interface ReportLineItem {
  boqItemId: string;
  quantityCompleted: number;
}

export interface SiteIssue {
  category: IssueCategory;
  note: string;
}

export interface SiteReport {
  id: string;
  projectId: string;
  submittedBy: string;
  reportDate: string;
  status: ReportSyncStatus;
  lineItems: ReportLineItem[];
  labourCount: number;
  labourByTrade?: Record<string, number>;
  equipmentOnSite: string[];
  equipmentHours?: Record<string, number>;
  issues: SiteIssue[];
  photoIds: string[];
  clientGeneratedId: string;
  createdAt: string;
  syncedAt?: string;
  reviewStatus?: "submitted" | "reviewed" | "queried" | "accepted";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewReason?: string;
}

export interface Variation {
  id: string;
  projectId: string;
  relatedBoqItemId?: string;
  description: string;
  reason: string;
  raisedBy: string;
  raisedAt: string;
  quantityDelta?: number;
  rateOverride?: number;
  estimatedValue: number;
  status: VariationStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  supportingPhotoIds: string[];
}

export interface Valuation {
  id: string;
  projectId: string;
  certificateNumber: string;
  valuationDate: string;
  completedBoqValue: number;
  approvedVariationValue: number;
  grossValue: number;
  retentionRate: number;
  retentionAmount: number;
  netAmountDue: number;
  status: "draft" | "issued" | "pending_project_manager_review" | "pending_director_approval" | "approved" | "rejected";
  createdBy: string;
  createdAt: string;
  recommendedBy?: string;
  recommendedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface ProjectAction {
  id: string;
  projectId: string;
  title: string;
  detail?: string;
  assignedTo: string;
  assignedToName: string;
  status: "open" | "complete";
  createdBy: string;
  createdByName: string;
  createdAt: string;
  completedAt?: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

import type { BoqItem, SiteReport, ValidationIssue } from "@engplatform2/shared-types";

export const calculateBoqItemProgress = (item: BoqItem): number => {
  if (item.plannedQuantity <= 0) return 0;
  return (item.cumulativeQuantityCompleted / item.plannedQuantity) * 100;
};

export const calculateProjectProgress = (items: BoqItem[]): number => {
  const totalPlannedValue = items.reduce((total, item) => total + item.plannedQuantity * item.rate, 0);
  if (totalPlannedValue <= 0) return 0;

  const completedValue = items.reduce(
    (total, item) => total + item.cumulativeQuantityCompleted * item.rate,
    0,
  );

  return (completedValue / totalPlannedValue) * 100;
};

export const validateSiteReport = (report: Pick<SiteReport, "lineItems" | "labourCount" | "issues" | "reportDate">): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const hasContent = report.lineItems.length > 0 || report.labourCount > 0 || report.issues.length > 0;

  if (!hasContent) {
    issues.push({ field: "report", message: "Add completed work, labour, or an issue before submitting." });
  }

  for (const [index, lineItem] of report.lineItems.entries()) {
    if (lineItem.quantityCompleted < 0) {
      issues.push({ field: `lineItems.${index}.quantityCompleted`, message: "Completed quantity cannot be negative." });
    }
  }

  const reportDate = new Date(report.reportDate);
  const maximumDate = new Date();
  maximumDate.setDate(maximumDate.getDate() + 7);
  if (Number.isNaN(reportDate.getTime()) || reportDate > maximumDate) {
    issues.push({ field: "reportDate", message: "Report date cannot be more than seven days in the future." });
  }

  return issues;
};

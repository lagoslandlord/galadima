// Shared types for the merged KPMS + Galadima system.
// Kept free of mongoose imports on purpose — this file is safe to import
// from client components ("use client"), unlike anything in lib/models/.

export type UserRole = "super_admin" | "department_head" | "staff" | "hr_admin";

export const DEPARTMENTS = [
  "Technology",
  "Creative",
  "Marketing",
  "Sales",
  "CRM",
  "Construction",
  "Inventory",
  "Brand",
  "Finance",
  "Security",
  "Procurement",
  "Facilities",
"Support",
  "Administration",
  "Video Production",
] as const;

export type DepartmentName = (typeof DEPARTMENTS)[number];

export type EmploymentStatus = "active" | "inactive" | "suspended" | "on_leave";

// ─── KPI domain ───
export type KPICategory = "productivity" | "revenue" | "operational" | "quality" | "innovation";
export type KPIFormula = "standard" | "reverse" | "binary" | "weighted" | "growth";
export type KPIType = "weekly" | "monthly" | "quarterly" | "annual";
export type KPIStatus = "pending" | "in_progress" | "completed" | "overdue" | "approved" | "rejected";
export type SubmissionStatus = "pending_review" | "approved" | "rejected";
export type PerformanceRating = "outstanding" | "excellent" | "good" | "fair" | "needs_improvement";

export interface KPICalculationResult {
  achievementPercent: number;
  weightedScore: number;
  cappedAt100: boolean;
}

export interface KPICalculationResult {
  achievementPercent: number;
  weightedScore: number;
  cappedAt100: boolean;
}

export interface KPITrendSource {
  approvedAt?: Date | string;
  updatedAt: Date | string;
  achievementPercent?: number;
}

// ─── Notification domain (Galadima) ───
export type NotificationPriority = "Critical" | "Urgent" | "High" | "Medium" | "Low" | "Informational";
export type NotificationSource = "Freshservice" | "Freshsales" | "Freshdesk" | "KPMS" | "Manual";
export type NotificationStatus = "sent" | "delivered" | "read" | "acknowledged";

// ─── Audit domain ───
export type AuditCategory = "kpi" | "submission" | "template" | "user" | "department" |"appraisal" | "notification" | "auth" | "report";
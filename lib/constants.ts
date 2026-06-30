import type { UserRole } from "@/lib/types";

export const DEFAULT_PAGE_SIZE = 20;

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  department_head: "Department Head",
  staff: "Staff",
  hr_admin: "HR Admin",
};

export interface NavItem {
  label: string;
  href: string;
}

export const NAV_ITEMS: Record<UserRole, NavItem[]> = {
 super_admin: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Departments", href: "/departments" },
    { label: "Employees", href: "/employees" },
    { label: "KPI Management", href: "/kpis" },
     { label: "Submissions", href: "/submissions" },
    { label: "Appraisals", href: "/appraisals" },
    { label: "Escalations", href: "/alerts" },
    { label: "Broadcast", href: "/broadcast" },
    { label: "Reports", href: "/reports" },
    { label: "Audit Logs", href: "/audit" },
    { label: "Admin", href: "/admin" },
  ],
 department_head: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Employees", href: "/employees" },
    { label: "KPI Management", href: "/kpis" },
    { label: "Submissions", href: "/submissions" },
    { label: "Appraisals", href: "/appraisals" },
    { label: "Escalations", href: "/alerts" },
    { label: "Broadcast", href: "/broadcast" },
  ],
  staff: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "KPI Management", href: "/kpis" },
    { label: "Submissions", href: "/submissions" },
    { label: "Appraisals", href: "/appraisals" },
    { label: "Escalations", href: "/alerts" },
  ],
  hr_admin: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Departments", href: "/departments" },
    { label: "Employees", href: "/employees" },
    { label: "KPI Management", href: "/kpis" },
    { label: "Appraisals", href: "/appraisals" },
    { label: "Broadcast", href: "/broadcast" },
    { label: "Reports", href: "/reports" },
    { label: "Audit Logs", href: "/audit" },
  ],
};

export function formatDate(value: Date | string | number): string {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export function generateTemporaryPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const values = new Uint32Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) {
      values[index] = Math.floor(Math.random() * chars.length);
    }
  }
  return Array.from(values, (value) => chars[value % chars.length]).join("");
}
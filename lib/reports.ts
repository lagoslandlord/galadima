import fs from "fs";
import path from "path";
import KPI from "@/lib/models/KPI";
import User from "@/lib/models/User";
import Report, { ReportType } from "@/lib/models/Report";
import { getKPIPeriod } from "@/lib/calculator";
import { getSystemSettings } from "@/lib/models/SystemSettings";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";
import { htmlToPdfBuffer } from "@/lib/pdfcrowd";
import { sendEmail } from "@/lib/email";
import { writeReportToSheet } from "@/lib/googleSheets";
import { createAuditLog } from "@/lib/audit";

const REPORT_LABELS: Record<ReportType, string> = {
  weekly: "Weekly Report",
  monthly: "Monthly Report",
  quarterly: "Quarterly Report",
  annual: "Annual Report",
};

function getPreviousPeriod(type: ReportType) {
  const now = new Date();
  switch (type) {
    case "weekly": {
      const end = new Date(now);
      end.setDate(now.getDate() - now.getDay() - 1);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "monthly": {
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      return { start, end };
    }
    case "quarterly": {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const prevStartMonth = (currentQuarter - 1) * 3;
      const year = prevStartMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const month = prevStartMonth < 0 ? prevStartMonth + 12 : prevStartMonth;
      return { start: new Date(year, month, 1), end: new Date(year, month + 3, 0, 23, 59, 59, 999) };
    }
    case "annual":
      return { start: new Date(now.getFullYear() - 1, 0, 1), end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999) };
  }
}

export async function buildReportData(reportType: ReportType, department?: string, periodMode: "current" | "previous" = "previous") {
  const { start, end } = periodMode === "current" ? getKPIPeriod(reportType) : getPreviousPeriod(reportType);

  const query: Record<string, unknown> = { updatedAt: { $gte: start, $lte: end } };
  if (department) query.department = department;

  const kpis = await KPI.find(query).populate("employee", "name department");
  const approved = kpis.filter((k) => k.status === "approved");
  const overdue = kpis.filter((k) => !["approved", "completed"].includes(k.status) && new Date() > new Date(k.dueDate));

  const departments = [...new Set(kpis.map((k) => k.department))];
  const departmentRankings = departments
    .map((dept) => {
      const deptKpis = kpis.filter((k) => k.department === dept);
      const deptApproved = deptKpis.filter((k) => k.status === "approved");
      const score = deptApproved.length ? Math.round(deptApproved.reduce((s, k) => s + (k.achievementPercent || 0), 0) / deptApproved.length) : 0;
      return { department: dept, score, totalKPIs: deptKpis.length, completedKPIs: deptApproved.length };
    })
    .sort((a, b) => b.score - a.score);

  const employeeMap = new Map<string, { name: string; department: string; scores: number[] }>();
  for (const k of approved) {
   const emp = k.employee as unknown as { _id: { toString(): string }; name: string; department: string };
    const key = emp._id.toString();
    if (!employeeMap.has(key)) employeeMap.set(key, { name: emp.name, department: emp.department, scores: [] });
    employeeMap.get(key)!.scores.push(k.achievementPercent || 0);
  }
  const employeeRankings = Array.from(employeeMap.values())
    .map((v) => ({ name: v.name, department: v.department, score: Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) }))
    .sort((a, b) => b.score - a.score);

  const companyScore = departmentRankings.length ? Math.round(departmentRankings.reduce((s, d) => s + d.score, 0) / departmentRankings.length) : 0;

  return {
    reportType,
    periodStart: start,
    periodEnd: end,
    companyScore,
    totalKPIs: kpis.length,
    completedKPIs: approved.length,
    completionRate: kpis.length ? Math.round((approved.length / kpis.length) * 100) : 0,
    overdueKPIs: overdue.length,
    departmentRankings,
topPerformers: employeeRankings.slice(0, 5),
    exceptions: overdue.map((k) => ({ name: k.name, employee: (k.employee as unknown as { name: string }).name, department: k.department, dueDate: k.dueDate })),
  };
}

function fmt(d: Date) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

let cachedLetterheadBase64: string | null = null;
function getLetterheadHeaderBase64(): string | null {
  if (cachedLetterheadBase64) return cachedLetterheadBase64;
  try {
    const filePath = path.join(process.cwd(), "assets", "letterhead", "letterhead-header.png");
    cachedLetterheadBase64 = fs.readFileSync(filePath).toString("base64");
    return cachedLetterheadBase64;
  } catch {
    console.warn("[reports] Letterhead image not found at assets/letterhead/letterhead-header.png — generating without it");
    return null;
  }
}

function renderReportHtml(data: Awaited<ReturnType<typeof buildReportData>>): string {
  const logoBase64 = getLetterheadHeaderBase64();
  const headerBlock = logoBase64
    ? `<img src="data:image/png;base64,${logoBase64}" style="width:100%; display:block; margin-bottom:20px;" />`
    : `<h1 style="font-size:22px; margin-bottom:4px;">Harmony Garden</h1>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 28px 32px 0; margin: 0; }
  .report-title { font-size: 13px; font-weight: 700; color: #8a6d1f; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
  .stats { display: flex; gap: 16px; margin-bottom: 24px; }
  .stat { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; flex: 1; }
  .stat-label { font-size: 11px; color: #888; text-transform: uppercase; }
  .stat-value { font-size: 22px; font-weight: 700; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eee; }
  th { background: #f7f7f7; font-size: 11px; text-transform: uppercase; color: #888; }
  h2 { font-size: 15px; margin-top: 28px; margin-bottom: 8px; }
  .letterhead-footer { margin-top: 36px; border-top: 1px solid #d9c27a; padding: 14px 0; font-size: 10.5px; color: #555; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px 24px; }
  .letterhead-footer strong { color: #8a6d1f; }
  .letterhead-footer-bar { background: #c41230; height: 8px; margin: 0 -32px; }
</style></head>
<body>
  ${headerBlock}
  <p class="report-title">${REPORT_LABELS[data.reportType]}</p>
  <p class="sub">${fmt(data.periodStart)} – ${fmt(data.periodEnd)}</p>
  <div class="stats">
    <div class="stat"><div class="stat-label">Company Score</div><div class="stat-value">${data.companyScore}%</div></div>
    <div class="stat"><div class="stat-label">Completion Rate</div><div class="stat-value">${data.completionRate}%</div></div>
    <div class="stat"><div class="stat-label">Total KPIs</div><div class="stat-value">${data.totalKPIs}</div></div>
    <div class="stat"><div class="stat-label">Overdue</div><div class="stat-value">${data.overdueKPIs}</div></div>
  </div>
  <h2>Department Rankings</h2>
  <table><thead><tr><th>Department</th><th>Score</th><th>Completed</th><th>Total</th></tr></thead>
  <tbody>${data.departmentRankings.map((d) => `<tr><td>${d.department}</td><td>${d.score}%</td><td>${d.completedKPIs}</td><td>${d.totalKPIs}</td></tr>`).join("")}</tbody></table>
  <h2>Top Performers</h2>
  <table><thead><tr><th>Employee</th><th>Department</th><th>Score</th></tr></thead>
  <tbody>${data.topPerformers.map((p) => `<tr><td>${p.name}</td><td>${p.department}</td><td>${p.score}%</td></tr>`).join("")}</tbody></table>
  <h2>Exceptions — Overdue KPIs</h2>
  <table><thead><tr><th>KPI</th><th>Employee</th><th>Department</th><th>Due Date</th></tr></thead>
  <tbody>${data.exceptions.length ? data.exceptions.map((e) => `<tr><td>${e.name}</td><td>${e.employee}</td><td>${e.department}</td><td>${fmt(e.dueDate)}</td></tr>`).join("") : `<tr><td colspan="4">No exceptions this period.</td></tr>`}</tbody></table>
  <div class="letterhead-footer">
    <span><strong>Head Office:</strong> HarmonyVille Estate (Ogba-Idunnu), Eleko Beach Road, Off Lekki-Epe Expressway, Ibeju-Lekki, Lagos State</span>
    <span><strong>Phone:</strong> +234 013 444 350 · +234 808 2244 044</span>
    <span><strong>Web:</strong> www.landbookbyharmony.com · info@landbookbyharmony.com</span>
  </div>
  <div class="letterhead-footer-bar"></div>
</body></html>`;
}

function buildSheetRows(data: Awaited<ReturnType<typeof buildReportData>>): (string | number)[][] {
  const rows: (string | number)[][] = [];
  rows.push(["Period", `${fmt(data.periodStart)} - ${fmt(data.periodEnd)}`]);
  rows.push(["Company Score", `${data.companyScore}%`]);
  rows.push(["Completion Rate", `${data.completionRate}%`]);
  rows.push(["Total KPIs", data.totalKPIs]);
  rows.push(["Overdue KPIs", data.overdueKPIs]);
  rows.push([]);
  rows.push(["Department Rankings"]);
  rows.push(["Department", "Score", "Completed", "Total"]);
  for (const d of data.departmentRankings) rows.push([d.department, `${d.score}%`, d.completedKPIs, d.totalKPIs]);
  rows.push([]);
  rows.push(["Top Performers"]);
  rows.push(["Employee", "Department", "Score"]);
  for (const p of data.topPerformers) rows.push([p.name, p.department, `${p.score}%`]);
  rows.push([]);
  rows.push(["Exceptions - Overdue KPIs"]);
  rows.push(["KPI", "Employee", "Department", "Due Date"]);
  for (const e of data.exceptions) rows.push([e.name, e.employee, e.department, fmt(e.dueDate)]);
  return rows;
}

export async function generateAndSendReport(reportType: ReportType, department?: string, generatedByUserId?: string, periodMode: "current" | "previous" = "previous") {
  const data = await buildReportData(reportType, department, periodMode);
  const html = renderReportHtml(data);
  const pdfBuffer = await htmlToPdfBuffer(html);
  const pdfUrl = await uploadBufferToCloudinary(pdfBuffer, "reports", `${reportType}-${Date.now()}`, "raw");

  let sheetUrl: string | undefined;
  try {
    const tabName = department ? `${REPORT_LABELS[reportType]} - ${department}` : REPORT_LABELS[reportType];
    sheetUrl = await writeReportToSheet(tabName, buildSheetRows(data));
  } catch (err) {
    console.error("[reports] Google Sheets sync failed (continuing anyway):", err);
  }

 const superAdmins = await User.find({ role: "super_admin", isActive: true }).select("email");
const settings = await getSystemSettings();

const toRecipients = settings.reportRecipientEmails;
const ccRecipients = superAdmins.map((u) => u.email).filter((e) => !toRecipients.includes(e));
const recipients = [...new Set([...toRecipients, ...ccRecipients])];

let emailSent = false;
if (recipients.length === 0) {
  console.warn(`[reports] No recipients configured for ${reportType} report — skipping email send`);
} else {
  // No extra recipients configured — fall back to super admins as primary "to"
  const sendResult = await sendEmail({
    to: toRecipients.length ? toRecipients : ccRecipients,
    cc: toRecipients.length && ccRecipients.length ? ccRecipients : undefined,
    subject: `${REPORT_LABELS[reportType]} — ${fmt(data.periodStart)} to ${fmt(data.periodEnd)}`,
    html: `<p>Attached is the ${REPORT_LABELS[reportType].toLowerCase()} for Harmony Garden, covering ${fmt(data.periodStart)} – ${fmt(data.periodEnd)}.</p>`,
    attachments: [{ filename: `${reportType}-report.pdf`, content: pdfBuffer, type: "application/pdf" }],
  });
  emailSent = sendResult.sent;
}
  const report = await Report.create({
    reportType,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    generatedBy: generatedByUserId,
    recipientEmails: recipients,
    pdfUrl,
    sheetUrl,
    emailSent,
    summary: data,
  });

  await createAuditLog({
    userId: generatedByUserId,
    performedBy: generatedByUserId ? undefined : "system",
    category: "report",
    action: "report_generated",
    resourceType: "Report",
    resourceId: report._id.toString(),
    metadata: { reportType, recipientCount: recipients.length },
  });

  return report;
}
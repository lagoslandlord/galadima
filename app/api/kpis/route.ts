import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import KPI from "@/lib/models/KPI";
import User from "@/lib/models/User";
import { requireAuth, requireRole } from "@/lib/authorize";
import { createAuditLog } from "@/lib/audit";
import { getKPIPeriod, isKPIOverdue } from "@/lib/calculator";
import { notifyUser } from "@/lib/notify";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE));
  const status = searchParams.get("status");
  const kpiType = searchParams.get("kpiType");
  const employeeParam = searchParams.get("employee");
  const departmentParam = searchParams.get("department");

  const query: Record<string, unknown> = {};

  // Role-based scoping — staff only ever see their own KPIs, department
  // heads only ever see their own department's, no matter what the query
  // string asks for.
  if (user!.role === "staff") {
    query.employee = user!._id;
  } else if (user!.role === "department_head") {
    query.department = user!.department;
    if (employeeParam) query.employee = employeeParam;
  } else {
    if (employeeParam) query.employee = employeeParam;
    if (departmentParam) query.department = departmentParam;
  }

  if (status) query.status = status;
  if (kpiType) query.kpiType = kpiType;
  if (searchParams.get("archived") !== "true") query.isArchived = { $ne: true };

  const skip = (page - 1) * limit;

  const [kpis, total] = await Promise.all([
    KPI.find(query)
      .populate("employee", "name email employeeId department")
      .populate("assignedBy", "name")
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(limit),
    KPI.countDocuments(query),
  ]);

  // Live overdue flag — computed on read, not a stored status that needs a
  // cron job to keep accurate.
  const withOverdueFlag = kpis.map((kpi) => ({
    ...kpi.toObject(),
    isOverdue: isKPIOverdue(kpi.dueDate, kpi.status),
  }));

  return NextResponse.json({
    success: true,
    kpis: withOverdueFlag,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireRole(["super_admin", "department_head"]);
  if (error) return error;

  try {
    const body = await req.json();
    const {
      name, description, department, employee, category, formula,
      kpiType, weight, targetValue, evidenceRequired, dueDate, periodStart, periodEnd, notes,
    } = body;

    if (!name || !department || !employee || !category || !kpiType || weight === undefined || targetValue === undefined) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    if (user!.role === "department_head" && department !== user!.department) {
      return NextResponse.json({ success: false, error: "You can only create KPIs within your own department" }, { status: 403 });
    }

    const period = periodStart && periodEnd
      ? { start: new Date(periodStart), end: new Date(periodEnd) }
      : getKPIPeriod(kpiType);

    await connectDB();
    const kpi = await KPI.create({
      name, description, department, employee,
      assignedBy: user!._id,
      category,
      formula: formula || "standard",
      kpiType, weight, targetValue,
      evidenceRequired: !!evidenceRequired,
      dueDate: dueDate ? new Date(dueDate) : period.end,
      periodStart: period.start,
      periodEnd: period.end,
      notes,
      status: "pending",
    });

   await createAuditLog({
      userId: user!._id.toString(),
      category: "kpi",
      action: "kpi_created",
      resourceType: "KPI",
      resourceId: kpi._id.toString(),
      newValue: { name: kpi.name, employee, targetValue, weight },
    });

    const employeeDoc = await User.findById(employee).select("name email");
    if (employeeDoc) {
      await notifyUser(employee, {
        title: "New KPI Assigned",
        message: `"${kpi.name}" has been assigned to you, due ${new Date(kpi.dueDate).toLocaleDateString()}.`,
        priority: "Medium",
        source: "KPMS",
        eventType: "kpi_assigned",
        email: {
          to: employeeDoc.email,
          subject: `New KPI Assigned: ${kpi.name}`,
          html: `<p>Hello ${employeeDoc.name},</p><p>A new KPI has been assigned to you: <strong>${kpi.name}</strong>.</p><p>Target: ${kpi.targetValue} &middot; Due: ${new Date(kpi.dueDate).toLocaleDateString()}</p><p>Log in to Galadima to view the full details and submit progress.</p>`,
        },
      });
    }

    return NextResponse.json({ success: true, kpi }, { status: 201 });
  } catch (err) {
    console.error("KPI create error:", err);
    return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
  }
}
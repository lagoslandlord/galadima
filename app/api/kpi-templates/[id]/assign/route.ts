import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";

import KPI from "@/lib/models/KPI";
import User from "@/lib/models/User";
import { requireRole } from "@/lib/authorize";
import { createAuditLog } from "@/lib/audit";
import { getKPIPeriod } from "@/lib/calculator";
import { notifyUser } from "@/lib/notify";
import KPITemplate from "@/lib/KPITemplate";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireRole(["super_admin", "department_head"]);
  if (error) return error;

  const { id } = await params;
  const { employeeId } = await req.json();

  if (!employeeId) {
    return NextResponse.json({ success: false, error: "employeeId is required" }, { status: 400 });
  }

  await connectDB();

  const template = await KPITemplate.findById(id);
  if (!template || !template.isActive) {
    return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
  }

  const employee = await User.findById(employeeId);
  if (!employee || !employee.isActive) {
    return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
  }

  if (user!.role === "department_head" && employee.department !== user!.department) {
    return NextResponse.json({ success: false, error: "You can only assign KPIs within your own department" }, { status: 403 });
  }

  const createdKPIs = [];
  for (const item of template.kpis) {
    const { start, end } = getKPIPeriod(item.kpiType);
    const kpi = await KPI.create({
      name: item.name,
      description: item.description,
      department: employee.department,
      employee: employee._id,
      assignedBy: user!._id,
      template: template._id,
      category: item.category,
      formula: item.formula,
      kpiType: item.kpiType,
      weight: item.weight,
      targetValue: item.targetValue,
      evidenceRequired: item.evidenceRequired,
      dueDate: end,
      periodStart: start,
      periodEnd: end,
      status: "pending",
    });
    createdKPIs.push(kpi);

    await createAuditLog({
      userId: user!._id.toString(),
      category: "kpi",
      action: "kpi_assigned",
      resourceType: "KPI",
      resourceId: kpi._id.toString(),
      newValue: { name: kpi.name, employee: employee.name, template: template.name },
    });
  }

 await notifyUser(employee._id.toString(), {
    title: "KPIs Assigned",
    message: `${createdKPIs.length} new KPI(s) from "${template.name}" have been assigned to you.`,
    priority: "Medium",
    source: "KPMS",
    eventType: "kpi_assigned",
  });

  await notifyUser(employee._id.toString(), {
    title: "KPIs Assigned",
    message: `${createdKPIs.length} new KPI(s) from "${template.name}" have been assigned to you.`,
    priority: "Medium",
    source: "KPMS",
    eventType: "kpi_assigned",
    email: {
      to: employee.email,
      subject: `${createdKPIs.length} New KPI(s) Assigned`,
      html: `<p>Hello ${employee.name},</p><p>${createdKPIs.length} new KPI(s) from the template "${template.name}" have been assigned to you.</p><p>Log in to Galadima to view the full details and submit progress.</p>`,
    },
  });

  return NextResponse.json(
    { success: true, message: `${createdKPIs.length} KPI(s) assigned to ${employee.name}`, kpis: createdKPIs },
    { status: 201 }
  );
}
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import KPI from "@/lib/models/KPI";
import Submission from "@/lib/models/Submission";
import { requireAuth, requireRole } from "@/lib/authorize";
import { createAuditLog } from "@/lib/audit";
import { isKPIOverdue } from "@/lib/calculator";
import type { IUser } from "@/lib/models/User";

async function loadAndAuthorize(id: string, user: IUser) {
  const kpi = await KPI.findById(id).populate("employee", "name email employeeId department").populate("assignedBy", "name");
  if (!kpi) return { kpi: null, allowed: false };

  const isOwner = kpi.employee._id.toString() === user._id.toString();
  const isOwnDeptHead = user.role === "department_head" && kpi.department === user.department;
  const isPrivileged = user.role === "super_admin" || user.role === "hr_admin";

  return { kpi, allowed: isOwner || isOwnDeptHead || isPrivileged };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  await connectDB();
  const { kpi, allowed } = await loadAndAuthorize(id, user!);
  if (!kpi) return NextResponse.json({ success: false, error: "KPI not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ success: false, error: "Not authorized to view this KPI" }, { status: 403 });

  return NextResponse.json({ success: true, kpi: { ...kpi.toObject(), isOverdue: isKPIOverdue(kpi.dueDate, kpi.status) } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireRole(["super_admin", "department_head"]);

  if (error) return error;

  const { id } = await params;
  await connectDB();
  const { kpi, allowed } = await loadAndAuthorize(id, user!);
  if (!kpi) return NextResponse.json({ success: false, error: "KPI not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ success: false, error: "Not authorized to edit this KPI" }, { status: 403 });

  const updates = await req.json();
  const allowedFields = ["name", "description", "weight", "targetValue", "dueDate", "periodStart", "periodEnd", "notes", "status", "evidenceRequired"];
  const before = kpi.toObject();
  const sanitized: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in updates) sanitized[field] = updates[field];
  }

  Object.assign(kpi, sanitized);
  await kpi.save();

  await createAuditLog({
    userId: user!._id.toString(),
    category: "kpi",
    action: "kpi_updated",
    resourceType: "KPI",
    resourceId: id,
    oldValue: before as unknown as Record<string, unknown>,
    newValue: sanitized,
  });

  return NextResponse.json({ success: true, kpi });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireRole(["super_admin", "department_head"]);
  if (error) return error;

  const { id } = await params;
  await connectDB();
  const { kpi, allowed } = await loadAndAuthorize(id, user!);
  if (!kpi) return NextResponse.json({ success: false, error: "KPI not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ success: false, error: "Not authorized to delete this KPI" }, { status: 403 });

  const submissionCount = await Submission.countDocuments({ kpi: id });
  if (submissionCount > 0) {
    return NextResponse.json(
      { success: false, error: `This KPI has ${submissionCount} submission(s) on record. Archive it instead of deleting, to keep the history intact.` },
      { status: 409 }
    );
  }

  const snapshot = kpi.toObject();
  await KPI.findByIdAndDelete(id);

  await createAuditLog({
    userId: user!._id.toString(),
    category: "kpi",
    action: "kpi_deleted",
    resourceType: "KPI",
    resourceId: id,
    oldValue: snapshot as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ success: true, message: "KPI deleted" });
}
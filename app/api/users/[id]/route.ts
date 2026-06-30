import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import KPI from "@/lib/models/KPI";
import Appraisal from "@/lib/models/Appraisal";
import { requireAuth, requireRole } from "@/lib/authorize";
import { createAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  await connectDB();
  const target = await User.findById(id);
  if (!target) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  const isSelf = target._id.toString() === user!._id.toString();
  const isOwnDeptHead = user!.role === "department_head" && target.department === user!.department;
  const isPrivileged = ["super_admin", "hr_admin"].includes(user!.role);
  if (!isSelf && !isOwnDeptHead && !isPrivileged) {
    return NextResponse.json({ success: false, error: "Not authorized to view this profile" }, { status: 403 });
  }

  return NextResponse.json({ success: true, user: target });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireRole(["super_admin", "hr_admin"]);
  if (error) return error;

  const { id } = await params;
  const updates = await req.json();

  await connectDB();
  const before = await User.findById(id);
  if (!before) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

 const allowedFields = ["name", "email", "phone", "department", "isActive"];
  const sanitized: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in updates) sanitized[field] = updates[field];
  }
  if (typeof sanitized.email === "string") {
  const email = sanitized.email.toLowerCase().trim();
  sanitized.email = email;

  const existing = await User.findOne({ email, _id: { $ne: id } });
  if (existing) {
    return NextResponse.json({ success: false, error: "That email is already in use by another account" }, { status: 409 });
  }
}

  const target = await User.findByIdAndUpdate(id, sanitized, { new: true });

  await createAuditLog({
    userId: user!._id.toString(),
    category: "user",
    action: sanitized.isActive === false ? "user_deactivated" : "user_updated",
    resourceType: "User",
    resourceId: id,
    oldValue: { name: before.name, phone: before.phone, department: before.department, isActive: before.isActive },
    newValue: sanitized,
  });

  return NextResponse.json({ success: true, user: target });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireRole(["super_admin"]);
  if (error) return error;

  const { id } = await params;
  if (id === user!._id.toString()) {
    return NextResponse.json({ success: false, error: "You cannot delete your own account" }, { status: 400 });
  }

 await connectDB();
  const target = await User.findById(id);
  if (!target) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  const kpiCount = await KPI.countDocuments({ employee: id });
  const appraisalCount = await Appraisal.countDocuments({ employee: id });
  if (kpiCount > 0 || appraisalCount > 0) {
    return NextResponse.json(
      { success: false, error: `${target.name} has performance history (${kpiCount} KPI(s), ${appraisalCount} appraisal(s)). Deactivate this account instead of deleting, to preserve their record.` },
      { status: 409 }
    );
  }

  await User.findByIdAndDelete(id);

  await createAuditLog({
    userId: user!._id.toString(),
    category: "user",
    action: "user_deleted",
    resourceType: "User",
    resourceId: id,
    oldValue: { name: target.name, email: target.email, role: target.role },
  });

  return NextResponse.json({ success: true, message: `${target.name} deleted permanently` });
}
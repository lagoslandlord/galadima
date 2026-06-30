import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { hashPassword } from "@/lib/auth";
import { requireAuth, requireRole } from "@/lib/authorize";
import { createAuditLog } from "@/lib/audit";
import { generateTemporaryPassword } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");
  const departmentParam = searchParams.get("department");
  const search = searchParams.get("search");
  const isActiveParam = searchParams.get("isActive");

  const query: Record<string, unknown> = {};

  // department_head and staff only ever see their own department's directory.
  if (user!.role === "department_head" || user!.role === "staff") {
    query.department = user!.department;
  } else if (departmentParam) {
    query.department = departmentParam;
  }

  if (role) query.role = role;
  query.isActive = isActiveParam !== null ? isActiveParam === "true" : true;

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { employeeId: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(query).sort({ name: 1 });
  return NextResponse.json({ success: true, users });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireRole(["super_admin", "hr_admin"]);
  if (error) return error;

  try {
    const { name, email, phone, role, department, password } = await req.json();

    if (!name || !email || !role || !department) {
      return NextResponse.json({ success: false, error: "Name, email, role, and department are required" }, { status: 400 });
    }

    await connectDB();
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return NextResponse.json({ success: false, error: "Email already registered" }, { status: 409 });
    }

    const employeeId = await User.generateEmployeeId();
    const tempPassword = password || generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);

    const newUser = await User.create({
      employeeId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone,
      role,
      department,
      passwordHash,
      isActive: true,
    });

    await createAuditLog({
      userId: user!._id.toString(),
      category: "user",
      action: "user_created",
      resourceType: "User",
      resourceId: newUser._id.toString(),
      newValue: { name: newUser.name, email: newUser.email, role: newUser.role, department: newUser.department },
    });

    return NextResponse.json(
      {
        success: true,
        message: "User created",
        user: { id: newUser._id, employeeId, name: newUser.name, email: newUser.email, role: newUser.role, department: newUser.department },
        temporaryPassword: password ? undefined : tempPassword, // shown once — hand it to the new hire
      },
      { status: 201 }
    );
 } catch (err) {
  if (typeof err === "object" && err !== null && "code" in err && err.code === 11000) {
    return NextResponse.json({ success: false, error: "Email already registered" }, { status: 409 });
  }
  console.error("User create error:", err);
  return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
}
}

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole } from "@/lib/authorize";
import { generateAndSendReport } from "@/lib/reports";

export async function POST(req: NextRequest) {
  const { user, error } = await requireRole(["super_admin", "hr_admin"]);
  if (error) return error;

  const { reportType, department } = await req.json();
  if (!["weekly", "monthly", "quarterly", "annual"].includes(reportType)) {
    return NextResponse.json({ success: false, error: "Invalid report type" }, { status: 400 });
  }

  await connectDB();
  try {
     const report = await generateAndSendReport(reportType, department || undefined, user!._id.toString(), "current");
    return NextResponse.json({ success: true, report });
  } catch (err) {
    console.error("Report generation error:", err);
    return NextResponse.json({ success: false, error: "Could not generate report — check PDFCrowd/SendGrid configuration" }, { status: 500 });
  }
}
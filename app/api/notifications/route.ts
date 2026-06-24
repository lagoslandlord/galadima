import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Notification from "@/lib/models/Notification";
import { requireAuth } from "@/lib/authorize";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE));
  const priority = searchParams.get("priority");
  const acknowledged = searchParams.get("acknowledged");

  const query: Record<string, unknown> = { recipientUserIds: user!._id };
  if (priority) query.priority = priority;
  if (acknowledged !== null) query.acknowledged = acknowledged === "true";

  const skip = (page - 1) * limit;
  const [notifications, total, statsRaw] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(query),
    Notification.find({ recipientUserIds: user!._id }).select("priority acknowledged escalated"),
  ]);

  const stats = {
    total: statsRaw.length,
    critical: statsRaw.filter((n) => n.priority === "Critical").length,
    unacknowledged: statsRaw.filter((n) => !n.acknowledged).length,
    escalated: statsRaw.filter((n) => n.escalated).length,
  };

  return NextResponse.json({ success: true, notifications, stats, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}
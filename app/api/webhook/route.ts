import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { evaluateRule } from "@/lib/ruleEngine";
import { dispatchNotification } from "@/lib/notify";
import { verifyWebhookSignature } from "@/lib/webhookAuth";
import type { NotificationSource } from "@/lib/types";

interface WebhookPayload {
  source?: string;
  event_type?: string;
  event?: string;
  data?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const providedSecret = req.headers.get("x-webhook-secret");

  const verification = verifyWebhookSignature(rawBody, providedSecret);
  if (!verification.ok) {
    return NextResponse.json({ success: false, error: verification.reason }, { status: 401 });
  }

  let body: WebhookPayload;
  try {
    body = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const source: NotificationSource = (body.source as NotificationSource) || "Freshsales";
  const eventType: string = body.event_type || body.event || "";
  const data = body.data || {};

  if (!source || !eventType) {
    return NextResponse.json({ success: false, error: "Missing source or event_type" }, { status: 400 });
  }

  await connectDB();

  const rule = evaluateRule(source, eventType, data);
  if (!rule) {
    return NextResponse.json({ success: true, message: "No matching rule", source, eventType });
  }

  const result = await dispatchNotification({
    title: rule.title,
    message: rule.message,
    priority: rule.priority,
    source,
    eventType,
    group: rule.group,
    assigneeEmail: rule.assigneeField && typeof data[rule.assigneeField] === "string" ? (data[rule.assigneeField] as string) : null,
    includeSupervisor: rule.includeSupervisor,
    mentionedUsers: normalizeList(data.mentioned_users),
    mentionedTeams: normalizeList(data.mentioned_teams),
  });

  return NextResponse.json({
    success: true,
    notificationId: result.notification._id,
    deliveryMode: result.deliveryMode,
    recipientsNotified: result.pushCount,
  });
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}
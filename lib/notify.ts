import mongoose from "mongoose";
import User, { IUser } from "@/lib/models/User";
import Notification from "@/lib/models/Notification";
import PushSubscription from "@/lib/models/PushSubscription";
import { createAuditLog } from "@/lib/audit";
import { sendPushToSubscriptions } from "@/lib/webpush";
import { sendEmail } from "@/lib/email";
import { recipientQuery } from "@/lib/ruleEngine";
import type { NotificationPriority, NotificationSource } from "@/lib/types";

interface DispatchParams {
  title: string;
  message: string;
  priority: NotificationPriority;
  source: NotificationSource;
  eventType: string;
  group: string;
  assigneeEmail?: string | null;
  includeSupervisor?: boolean;
  mentionedUsers?: string[];
  mentionedTeams?: string[];
}

async function findByEmailsOrIds(values: string[]) {
  if (!values.length) return [];
  const ids = values.filter((v) => mongoose.Types.ObjectId.isValid(v));
  const emails = values.filter((v) => !mongoose.Types.ObjectId.isValid(v)).map((v) => v.toLowerCase());
  return User.find({ $or: [{ _id: { $in: ids } }, { email: { $in: emails } }], isActive: true });
}

async function findByDepartments(departments: string[]) {
  if (!departments.length) return [];
  return User.find({ department: { $in: departments }, isActive: true });
}

function dedupe(users: IUser[]) {
  const seen = new Set<string>();
  return users.filter((u) => {
    const id = u._id.toString();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function notifyUser(
  userId: string,
  params: {
    title: string;
    message: string;
    priority: NotificationPriority;
    source: NotificationSource;
    eventType: string;
    email?: { to: string; subject: string; html: string };
  }
) {
  const notification = await Notification.create({
    title: params.title,
    message: params.message,
    priority: params.priority,
    source: params.source,
    eventType: params.eventType,
    recipientGroup: "direct",
    recipientUserIds: [userId],
    deliveryMode: "targeted",
    status: "sent",
  });

  const subscriptions = await PushSubscription.find({ user: userId });
  await sendPushToSubscriptions(subscriptions, { title: params.title, body: params.message, priority: params.priority });

  if (params.email) {
    await sendEmail({ to: params.email.to, subject: params.email.subject, html: params.email.html });
  }

  return notification;
}

export async function dispatchNotification(params: DispatchParams) {
  let recipients: IUser[] = [];
  let deliveryMode: "group" | "targeted" = "group";

  const hasTargeting = (params.mentionedUsers?.length || 0) > 0 || (params.mentionedTeams?.length || 0) > 0;

  if (hasTargeting) {
    deliveryMode = "targeted";
    const [users, teams] = await Promise.all([
      findByEmailsOrIds(params.mentionedUsers || []),
      findByDepartments(params.mentionedTeams || []),
    ]);
    recipients = dedupe([...users, ...teams]);
  } else if (params.assigneeEmail) {
    const assignee = await User.findOne({ email: params.assigneeEmail.toLowerCase(), isActive: true });
    if (assignee) {
      deliveryMode = "targeted";
      recipients = [assignee];
      if (params.includeSupervisor) {
        const supervisors = await User.find({ department: assignee.department, role: "department_head", isActive: true });
        const fallback = supervisors.length ? supervisors : await User.find({ role: "super_admin", isActive: true });
        recipients = dedupe([...recipients, ...fallback]);
      }
    }
  }

  // Nobody specific resolved — fall back to the role/department broadcast.
  if (recipients.length === 0) {
    deliveryMode = "group";
    recipients = await User.find(recipientQuery(params.group));
  }

  const notification = await Notification.create({
    title: params.title,
    message: params.message,
    priority: params.priority,
    source: params.source,
    eventType: params.eventType,
    recipientGroup: params.group,
    recipientUserIds: recipients.map((r) => r._id),
    deliveryMode,
    status: "sent",
  });

  await createAuditLog({
    category: "notification",
    action: "notification_sent",
    resourceType: "Notification",
    resourceId: notification._id.toString(),
    metadata: { source: params.source, eventType: params.eventType, priority: params.priority, deliveryMode, recipientCount: recipients.length },
  });

  let pushCount = 0;
  if (recipients.length) {
    const subscriptions = await PushSubscription.find({ user: { $in: recipients.map((r) => r._id) } });
    pushCount = await sendPushToSubscriptions(subscriptions, { title: params.title, body: params.message, priority: params.priority });
  }

  return { notification, recipientCount: recipients.length, pushCount, deliveryMode };
}
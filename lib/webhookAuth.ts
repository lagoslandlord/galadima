/*
 * Freshworks (Freshsales/Freshdesk/Freshservice) workflow webhooks can only
 * send a fixed custom header value typed into their UI — they can't compute
 * a dynamic HMAC signature of the payload. So this is a shared-secret
 * comparison against a custom header, not a signature check.
 */
export function verifyWebhookSignature(rawBody: string, providedSecret: string | null): { ok: boolean; reason?: string } {
  const secret = process.env.FRESHWORKS_WEBHOOK_SECRET;

  if (!secret) {
    console.warn("[webhookAuth] FRESHWORKS_WEBHOOK_SECRET not set — accepting all webhooks unverified");
    return { ok: true };
  }

  if (!providedSecret) return { ok: false, reason: "Missing x-webhook-secret header" };
  if (providedSecret !== secret) return { ok: false, reason: "Invalid webhook secret" };

  return { ok: true };
}
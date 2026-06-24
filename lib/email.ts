import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;
if (apiKey) sgMail.setApiKey(apiKey);

const FROM_EMAIL = process.env.EMAIL_FROM || "gloria.a@landbookbyharmony.com";

interface SendEmailParams {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer; type: string }[];
}

export async function sendEmail(params: SendEmailParams) {
  if (!apiKey) {
    console.warn("[email] SENDGRID_API_KEY not set — skipping email send");
    return { sent: false };
  }

  try {
    await sgMail.send({
      to: params.to,
      cc: params.cc,
      from: FROM_EMAIL,
      subject: params.subject,
      html: params.html,
      text: params.text || params.subject,
      attachments: params.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
        type: a.type,
        disposition: "attachment",
      })),
    });
    return { sent: true };
  } catch (err) {
    console.error("[email] send failed:", err);
    return { sent: false };
  }
}
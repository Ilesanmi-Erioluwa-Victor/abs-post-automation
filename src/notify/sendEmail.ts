import { env } from "../config/env";
import type { BatchSlot } from "../db/models/Post";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export interface SlotNotification {
  slot: BatchSlot;
  count: number;
  succeeded: number;
  failed: number;
  terms: string[];
}

function htmlBody(notification: SlotNotification): string {
  const { slot, count, succeeded, failed, terms } = notification;
  const heading =
    failed === 0
      ? `All ${count} posts for the <strong>${slot}</strong> slot have been successfully posted.`
      : `${succeeded} of ${count} posts for the <strong>${slot}</strong> slot were posted (${failed} failed).`;

  const list = terms.length
    ? `<ul>${terms.map((term) => `<li>${escapeHtml(term)}</li>`).join("")}</ul>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px;">
      <h2 style="color: #4B2ED1;">Idiom &amp; Vocab Bot</h2>
      <p>${heading}</p>
      ${list}
      <p style="color: #666;">Sent automatically by the post automation bot.</p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendSlotNotification(
  notification: SlotNotification
): Promise<boolean> {
  if (!env.brevoApiKey || !env.brevoEmail || !env.notifyEmail) {
    console.warn(
      "[notify] email notification skipped: BREVO_API_KEY, BREVO_EMAIL or NOTIFY_EMAIL not set"
    );
    return false;
  }

  const { slot, count, succeeded, failed } = notification;
  const subject =
    failed === 0
      ? `Posting bot: ${count} posts posted successfully (${slot} slot)`
      : `Posting bot: ${succeeded}/${count} posted for ${slot} slot (${failed} failed)`;

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": env.brevoApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: env.brevoEmail, name: "Idiom & Vocab Bot" },
      to: [{ email: env.notifyEmail }],
      subject,
      htmlContent: htmlBody(notification),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo send failed (${response.status}): ${body}`);
  }

  console.log(`[notify] sent slot summary email for ${slot} slot`);
  return true;
}

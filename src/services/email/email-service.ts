import nodemailer, { type Transporter } from 'nodemailer';
import { formatSessionLabel } from '../../lib/time.js';
import { listPendingSummarySessionIds, loadSessionSummary, markSessionSummaryEmailed } from '../scheduling/session-service.js';
import { loadEnv } from '../../config/env.js';
import { logger } from '../logger.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const env = loadEnv();
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS
          }
        : undefined
    });
  }

  return transporter;
}

function buildEmailBody(summary: Awaited<ReturnType<typeof loadSessionSummary>>): string {
  const dateKey = summary.session.sessionDate.toISOString().slice(0, 10);
  const lines = [
    `Session: ${formatSessionLabel(dateKey, summary.session.sessionType)}`,
    `Status: ${summary.session.status}`,
    `Planned: ${summary.session.plannedCount}`,
    `Posted: ${summary.session.postedCount}`,
    `Failed: ${summary.session.failedCount}`,
    '',
    'Items:'
  ];

  for (const item of summary.items) {
    lines.push(
      `- ${item.word}: ${item.status} (attempts: ${item.attemptCount})${item.lastErrorMessage ? ` | error: ${item.lastErrorMessage}` : ''}`
    );
  }

  return lines.join('\n');
}

export async function sendPendingSessionSummaries(): Promise<number> {
  const sessionIds = await listPendingSummarySessionIds();
  if (sessionIds.length === 0) {
    return 0;
  }

  const env = loadEnv();
  for (const sessionId of sessionIds) {
    const summary = await loadSessionSummary(sessionId);
    const dateKey = summary.session.sessionDate.toISOString().slice(0, 10);
    const subject = `[ABS] ${formatSessionLabel(dateKey, summary.session.sessionType)}`;

    await getTransporter().sendMail({
      from: env.EMAIL_FROM,
      to: env.EMAIL_TO,
      subject,
      text: buildEmailBody(summary)
    });

    await markSessionSummaryEmailed(sessionId);
    logger.info({ sessionId, to: env.EMAIL_TO }, 'Sent session summary email');
  }

  return sessionIds.length;
}

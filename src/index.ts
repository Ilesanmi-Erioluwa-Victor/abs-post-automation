import { SessionType } from '@prisma/client';
import { loadEnv } from './config/env.js';
import { getPrismaClient } from './db/prisma.js';
import { getNowInZone, toDateKey } from './lib/time.js';
import { sendPendingSessionSummaries } from './services/email/email-service.js';
import { logger } from './services/logger.js';
import { postDueJobs } from './services/posting/posting-service.js';
import { planDueSessions, planSession } from './services/scheduling/session-service.js';
import { generateNextWord } from './services/words/word-service.js';

type Command =
  | 'generate-next'
  | 'plan-due'
  | 'plan-session';
type ExtendedCommand = Command | 'post-due' | 'send-summaries' | 'tick';

function parseSessionType(input: string | undefined): SessionType {
  if (input === 'morning') {
    return SessionType.MORNING;
  }

  if (input === 'afternoon') {
    return SessionType.AFTERNOON;
  }

  if (input === 'evening') {
    return SessionType.EVENING;
  }

  throw new Error('Session type must be one of: morning, afternoon, evening');
}

async function main(): Promise<void> {
  const env = loadEnv();
  const command = (process.argv[2] ?? 'tick') as ExtendedCommand;

  if (command === 'generate-next') {
    const result = await generateNextWord({ requestedBy: 'cli' });
    logger.info({ result }, 'Generate-next command completed');
    return;
  }

  if (command === 'plan-due') {
    await planDueSessions();
    logger.info({ date: toDateKey(getNowInZone(env.APP_TIMEZONE)) }, 'Planned any due sessions');
    return;
  }

  if (command === 'plan-session') {
    const sessionType = parseSessionType(process.argv[3]);
    const sessionDateKey = process.argv[4] ?? toDateKey(getNowInZone(env.APP_TIMEZONE));
    await planSession({ sessionDateKey, sessionType });
    logger.info({ sessionDateKey, sessionType }, 'Planned session');
    return;
  }

  if (command === 'post-due') {
    const processedCount = await postDueJobs();
    logger.info({ processedCount }, 'Processed due post jobs');
    return;
  }

  if (command === 'send-summaries') {
    const sentCount = await sendPendingSessionSummaries();
    logger.info({ sentCount }, 'Sent any pending session summaries');
    return;
  }

  if (command === 'tick') {
    await planDueSessions();
    const processedCount = await postDueJobs();
    const sentCount = await sendPendingSessionSummaries();
    logger.info({ processedCount, sentCount }, 'Tick completed');
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  logger.error({ error }, 'Application boot failed');
  process.exitCode = 1;
}).finally(async () => {
  await getPrismaClient().$disconnect();
});

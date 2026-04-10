import { LexiconStatus, PostJobStatus, SessionStatus, SessionType } from '@prisma/client';
import { loadEnv } from '../../config/env.js';
import { getPrismaClient } from '../../db/prisma.js';
import { addMinutes, buildSessionStart, formatSessionLabel, getConfiguredSessionTimes, getNowInZone, toDateKey, toDateOnly } from '../../lib/time.js';
import { logger } from '../logger.js';
import type { PlanSessionParams, SessionSummary } from '../../types/domain.js';

export async function planSession(params: PlanSessionParams): Promise<void> {
  const prisma = getPrismaClient();
  const env = loadEnv();
  const sessionDate = toDateOnly(params.sessionDateKey, env.APP_TIMEZONE);

  const session = await prisma.postSession.upsert({
    where: {
      sessionDate_sessionType: {
        sessionDate,
        sessionType: params.sessionType
      }
    },
    update: {},
    create: {
      sessionDate,
      sessionType: params.sessionType
    }
  });

  const existingJobsCount = await prisma.postJob.count({
    where: { sessionId: session.id }
  });

  if (existingJobsCount > 0) {
    logger.info({ sessionId: session.id }, 'Session already has planned jobs');
    return;
  }

  const assets = await prisma.lexiconEntry.findMany({
    where: {
      status: LexiconStatus.RENDERED,
      postJobs: { none: {} },
      canvasAsset: { isNot: null }
    },
    include: {
      canvasAsset: true
    },
    orderBy: { sequenceNo: 'asc' },
    take: env.SESSION_POST_LIMIT
  });

  if (assets.length === 0) {
    logger.info({ sessionType: params.sessionType, sessionDate: params.sessionDateKey }, 'No rendered assets available for session');
    return;
  }

  const configuredTime = getConfiguredSessionTimes(env).find((item) => item.sessionType === params.sessionType);
  const sessionStart = buildSessionStart(params.sessionDateKey, configuredTime?.hour ?? env.SESSION_MORNING_HOUR, env.APP_TIMEZONE);

  await prisma.$transaction(async (tx) => {
    for (const [index, entry] of assets.entries()) {
      await tx.postJob.create({
        data: {
          sessionId: session.id,
          lexiconEntryId: entry.id,
          canvasAssetId: entry.canvasAsset!.id,
          provider: env.POST_PROVIDER_NAME,
          scheduledFor: addMinutes(sessionStart, index * env.SESSION_POST_INTERVAL_MINUTES)
        }
      });

      await tx.lexiconEntry.update({
        where: { id: entry.id },
        data: { status: LexiconStatus.SCHEDULED }
      });
    }

    await tx.postSession.update({
      where: { id: session.id },
      data: {
        plannedCount: assets.length,
        status: SessionStatus.PLANNED
      }
    });
  });

  logger.info(
    {
      sessionId: session.id,
      sessionType: params.sessionType,
      sessionDate: params.sessionDateKey,
      plannedCount: assets.length
    },
    'Planned session jobs'
  );
}

export async function planDueSessions(): Promise<void> {
  const env = loadEnv();
  const now = getNowInZone(env.APP_TIMEZONE);
  const dateKey = toDateKey(now);

  for (const sessionTime of getConfiguredSessionTimes(env)) {
    const sessionStart = buildSessionStart(dateKey, sessionTime.hour, env.APP_TIMEZONE);
    if (new Date() < sessionStart) {
      continue;
    }

    await planSession({
      sessionDateKey: dateKey,
      sessionType: sessionTime.sessionType
    });
  }
}

export async function markSessionStarted(sessionId: number): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.postSession.update({
    where: { id: sessionId },
    data: {
      startedAt: new Date(),
      status: SessionStatus.RUNNING
    }
  });
}

export async function refreshSessionCounts(sessionId: number): Promise<void> {
  const prisma = getPrismaClient();
  const [plannedCount, postedCount, failedCount] = await Promise.all([
    prisma.postJob.count({ where: { sessionId } }),
    prisma.postJob.count({ where: { sessionId, status: PostJobStatus.POSTED } }),
    prisma.postJob.count({ where: { sessionId, status: PostJobStatus.FAILED_PERMANENT } })
  ]);

  await prisma.postSession.update({
    where: { id: sessionId },
    data: {
      plannedCount,
      postedCount,
      failedCount
    }
  });
}

export async function finalizeSessionIfComplete(sessionId: number): Promise<void> {
  const prisma = getPrismaClient();
  await refreshSessionCounts(sessionId);

  const [session, terminalCount, totalCount] = await Promise.all([
    prisma.postSession.findUniqueOrThrow({ where: { id: sessionId } }),
    prisma.postJob.count({
      where: {
        sessionId,
        status: { in: [PostJobStatus.POSTED, PostJobStatus.FAILED_PERMANENT] }
      }
    }),
    prisma.postJob.count({ where: { sessionId } })
  ]);

  if (totalCount === 0 || terminalCount < totalCount || session.finishedAt) {
    return;
  }

  await prisma.postSession.update({
    where: { id: sessionId },
    data: {
      finishedAt: new Date(),
      status: session.failedCount > 0 ? SessionStatus.NEEDS_ATTENTION : SessionStatus.COMPLETED
    }
  });
}

export async function loadSessionSummary(sessionId: number): Promise<SessionSummary> {
  const prisma = getPrismaClient();
  const session = await prisma.postSession.findUniqueOrThrow({
    where: { id: sessionId }
  });

  const jobs = await prisma.postJob.findMany({
    where: { sessionId },
    include: { lexiconEntry: true },
    orderBy: { scheduledFor: 'asc' }
  });

  const dateKey = session.sessionDate.toISOString().slice(0, 10);
  logger.info(
    {
      sessionId,
      label: formatSessionLabel(dateKey, session.sessionType)
    },
    'Loaded session summary'
  );

  return {
    session,
    items: jobs.map((job) => ({
      word: job.lexiconEntry.word,
      status: job.status,
      attemptCount: job.attemptCount,
      lastErrorMessage: job.lastErrorMessage
    }))
  };
}

export async function listPendingSummarySessionIds(): Promise<number[]> {
  const prisma = getPrismaClient();
  const sessions = await prisma.postSession.findMany({
    where: {
      finishedAt: { not: null },
      summaryEmailedAt: null
    },
    select: { id: true }
  });

  return sessions.map((session) => session.id);
}

export async function markSessionSummaryEmailed(sessionId: number): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.postSession.update({
    where: { id: sessionId },
    data: { summaryEmailedAt: new Date() }
  });
}

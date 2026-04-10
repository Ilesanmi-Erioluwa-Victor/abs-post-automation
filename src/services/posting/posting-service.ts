import { LexiconStatus, PostJobStatus } from '@prisma/client';
import path from 'node:path';
import { loadEnv } from '../../config/env.js';
import { getPrismaClient } from '../../db/prisma.js';
import { downloadCanvasAsset } from '../storage/storage-service.js';
import { finalizeSessionIfComplete, markSessionStarted } from '../scheduling/session-service.js';
import { logger } from '../logger.js';
import type { CreatePostPayloadParams, ProviderPostFailure, ProviderPostPayload, ProviderPostSuccess } from '../../types/domain.js';

interface DuePostJob {
  id: number;
  sessionId: number;
  attemptCount: number;
  canvasAsset: {
    id: number;
    storagePath: string;
  };
  lexiconEntry: {
    id: number;
    sequenceNo: number;
    word: string;
    partOfSpeech: string;
    meaning: string;
    exampleSentence: string;
  };
}

function buildCaption(params: CreatePostPayloadParams['entry']): string {
  return [
    `Word: ${params.word}`,
    `Part of Speech: ${params.partOfSpeech}`,
    `Meaning: ${params.meaning}`,
    `Example: ${params.exampleSentence}`
  ].join('\n');
}

async function createProviderPayload(params: CreatePostPayloadParams): Promise<ProviderPostPayload> {
  const imageBuffer = await downloadCanvasAsset(params.asset.storagePath);

  return {
    caption: buildCaption(params.entry),
    fileName: path.basename(params.asset.storagePath),
    mimeType: 'image/png',
    imageBuffer,
    visibilityType: loadEnv().POST_PROVIDER_VISIBILITY_TYPE
  };
}

function classifyFailure(responseStatus: number | null, message: string, responseExcerpt: string): ProviderPostFailure {
  const retryable = responseStatus === null || responseStatus === 408 || responseStatus === 429 || responseStatus >= 500;

  return {
    retryable,
    code: responseStatus ? `HTTP_${responseStatus}` : 'NETWORK_ERROR',
    message,
    httpStatus: responseStatus,
    responseExcerpt
  };
}

async function postToProvider(job: DuePostJob): Promise<ProviderPostSuccess | ProviderPostFailure> {
  const env = loadEnv();
  const payload = await createProviderPayload({
    entry: job.lexiconEntry,
    asset: job.canvasAsset
  });

  const formData = new FormData();
  formData.append('images', new Blob([new Uint8Array(payload.imageBuffer)], { type: payload.mimeType }), payload.fileName);
  formData.append('content', payload.caption);
  formData.append('visibilityType', payload.visibilityType);

  try {
    const response = await fetch(env.POST_PROVIDER_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.POST_PROVIDER_TOKEN}`
      },
      body: formData
    });

    const responseText = await response.text();
    const responseExcerpt = responseText.slice(0, 600);
    if (!response.ok) {
      return classifyFailure(response.status, `Provider returned HTTP ${response.status}`, responseExcerpt);
    }

    let providerPostId = `provider-${job.lexiconEntry.id}-${Date.now()}`;
    try {
      const parsed = JSON.parse(responseText) as Record<string, unknown>;
      if (typeof parsed.id === 'string' && parsed.id) {
        providerPostId = parsed.id;
      } else if (typeof parsed.postId === 'string' && parsed.postId) {
        providerPostId = parsed.postId;
      }
    } catch {
      providerPostId = `provider-${job.lexiconEntry.id}-${Date.now()}`;
    }

    return {
      providerPostId,
      responseExcerpt
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown provider error';
    return classifyFailure(null, message, message);
  }
}

function getRetryDelayMinutes(attemptNo: number): number {
  const retrySchedule = [5, 15, 45, 120, 360];
  return retrySchedule[Math.min(attemptNo - 1, retrySchedule.length - 1)];
}

async function claimPostJob(postJobId: number): Promise<number | null> {
  const prisma = getPrismaClient();
  const postJob = await prisma.postJob.findUnique({
    where: { id: postJobId },
    select: { attemptCount: true, status: true }
  });

  if (!postJob || (postJob.status !== PostJobStatus.QUEUED && postJob.status !== PostJobStatus.RETRY_WAIT)) {
    return null;
  }

  const updated = await prisma.postJob.updateMany({
    where: {
      id: postJobId,
      status: { in: [PostJobStatus.QUEUED, PostJobStatus.RETRY_WAIT] }
    },
    data: {
      status: PostJobStatus.POSTING,
      attemptCount: { increment: 1 },
      nextRetryAt: null
    }
  });

  if (updated.count !== 1) {
    return null;
  }

  const freshJob = await prisma.postJob.findUniqueOrThrow({
    where: { id: postJobId },
    select: { attemptCount: true }
  });

  return freshJob.attemptCount;
}

async function handlePostSuccess(params: {
  postJobId: number;
  sessionId: number;
  entryId: number;
  attemptNo: number;
  providerPostId: string;
  responseExcerpt: string;
}): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.$transaction(async (tx) => {
    await tx.postAttempt.create({
      data: {
        postJobId: params.postJobId,
        attemptNo: params.attemptNo,
        success: true,
        finishedAt: new Date(),
        responseExcerpt: params.responseExcerpt
      }
    });

    await tx.postJob.update({
      where: { id: params.postJobId },
      data: {
        status: PostJobStatus.POSTED,
        providerPostId: params.providerPostId,
        lastErrorCode: null,
        lastErrorMessage: null
      }
    });

    await tx.lexiconEntry.update({
      where: { id: params.entryId },
      data: { status: LexiconStatus.POSTED }
    });
  });

  await finalizeSessionIfComplete(params.sessionId);
}

async function handlePostFailure(params: {
  postJobId: number;
  sessionId: number;
  entryId: number;
  attemptNo: number;
  failure: ProviderPostFailure;
}): Promise<void> {
  const prisma = getPrismaClient();
  const env = loadEnv();
  const retryAllowed = params.failure.retryable && params.attemptNo < env.POST_RETRY_LIMIT;
  const nextRetryAt = retryAllowed ? new Date(Date.now() + getRetryDelayMinutes(params.attemptNo) * 60_000) : null;

  await prisma.$transaction(async (tx) => {
    await tx.postAttempt.create({
      data: {
        postJobId: params.postJobId,
        attemptNo: params.attemptNo,
        success: false,
        finishedAt: new Date(),
        httpStatus: params.failure.httpStatus,
        responseExcerpt: params.failure.responseExcerpt,
        errorMessage: params.failure.message
      }
    });

    await tx.postJob.update({
      where: { id: params.postJobId },
      data: {
        status: retryAllowed ? PostJobStatus.RETRY_WAIT : PostJobStatus.FAILED_PERMANENT,
        nextRetryAt,
        lastErrorCode: params.failure.code,
        lastErrorMessage: params.failure.message
      }
    });

    if (!retryAllowed) {
      await tx.lexiconEntry.update({
        where: { id: params.entryId },
        data: { status: LexiconStatus.FAILED_POST }
      });
    }
  });

  await finalizeSessionIfComplete(params.sessionId);
}

async function processPostJob(job: DuePostJob): Promise<void> {
  await markSessionStarted(job.sessionId);
  const attemptNo = await claimPostJob(job.id);
  if (!attemptNo) {
    return;
  }

  const providerResult = await postToProvider(job);
  if ('providerPostId' in providerResult) {
    await handlePostSuccess({
      postJobId: job.id,
      sessionId: job.sessionId,
      entryId: job.lexiconEntry.id,
      attemptNo,
      providerPostId: providerResult.providerPostId,
      responseExcerpt: providerResult.responseExcerpt
    });

    logger.info({ postJobId: job.id, word: job.lexiconEntry.word, attemptNo }, 'Posted word successfully');
    return;
  }

  await handlePostFailure({
    postJobId: job.id,
    sessionId: job.sessionId,
    entryId: job.lexiconEntry.id,
    attemptNo,
    failure: providerResult
  });

  logger.warn(
    {
      postJobId: job.id,
      word: job.lexiconEntry.word,
      attemptNo,
      code: providerResult.code
    },
    'Post attempt failed'
  );
}

export async function postDueJobs(): Promise<number> {
  const prisma = getPrismaClient();
  const env = loadEnv();
  const now = new Date();
  const dueJobs = await prisma.postJob.findMany({
    where: {
      OR: [
        {
          status: PostJobStatus.QUEUED,
          scheduledFor: { lte: now }
        },
        {
          status: PostJobStatus.RETRY_WAIT,
          nextRetryAt: { lte: now }
        }
      ]
    },
    include: {
      canvasAsset: {
        select: {
          id: true,
          storagePath: true
        }
      },
      lexiconEntry: {
        select: {
          id: true,
          sequenceNo: true,
          word: true,
          partOfSpeech: true,
          meaning: true,
          exampleSentence: true
        }
      }
    },
    orderBy: { scheduledFor: 'asc' },
    take: env.POST_BATCH_LIMIT
  });

  for (const job of dueJobs) {
    await processPostJob(job);
  }

  return dueJobs.length;
}

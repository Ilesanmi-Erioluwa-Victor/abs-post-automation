import { LexiconStatus } from '@prisma/client';
import { loadEnv } from '../../config/env.js';
import { getPrismaClient } from '../../db/prisma.js';
import { renderWordCanvas } from '../canvas/canvas-service.js';
import { uploadCanvasAsset } from '../storage/storage-service.js';
import { logger } from '../logger.js';
import type { GenerateNextWordParams, GenerateNextWordResult, RenderCanvasResult } from '../../types/domain.js';

interface ClaimNextWordCandidate {
  id: number;
  sequenceNo: number;
  word: string;
  partOfSpeech: string;
  meaning: string;
  exampleSentence: string;
}

async function claimNextWord(): Promise<ClaimNextWordCandidate | null> {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const cursor = await tx.systemCursor.upsert({
      where: { key: 'next_word_to_generate' },
      update: {},
      create: { key: 'next_word_to_generate', sequenceNo: 1 }
    });

    const candidate = await tx.lexiconEntry.findFirst({
      where: {
        sequenceNo: { gte: cursor.sequenceNo },
        status: { in: [LexiconStatus.PENDING, LexiconStatus.FAILED_RENDER] }
      },
      orderBy: { sequenceNo: 'asc' },
      select: {
        id: true,
        sequenceNo: true,
        word: true,
        partOfSpeech: true,
        meaning: true,
        exampleSentence: true
      }
    });

    if (!candidate) {
      return null;
    }

    const claimed = await tx.lexiconEntry.updateMany({
      where: {
        id: candidate.id,
        status: { in: [LexiconStatus.PENDING, LexiconStatus.FAILED_RENDER] }
      },
      data: { status: LexiconStatus.RENDERING }
    });

    if (claimed.count !== 1) {
      return null;
    }

    return candidate;
  });
}

async function advanceCursor(): Promise<void> {
  const prisma = getPrismaClient();
  const nextEntry = await prisma.lexiconEntry.findFirst({
    where: {
      status: { in: [LexiconStatus.PENDING, LexiconStatus.FAILED_RENDER, LexiconStatus.RENDERING] }
    },
    orderBy: { sequenceNo: 'asc' },
    select: { sequenceNo: true }
  });

  const maxEntry = await prisma.lexiconEntry.aggregate({
    _max: { sequenceNo: true }
  });

  await prisma.systemCursor.upsert({
    where: { key: 'next_word_to_generate' },
    update: {
      sequenceNo: nextEntry?.sequenceNo ?? (maxEntry._max.sequenceNo ?? 0) + 1
    },
    create: {
      key: 'next_word_to_generate',
      sequenceNo: nextEntry?.sequenceNo ?? (maxEntry._max.sequenceNo ?? 0) + 1
    }
  });
}

async function persistRenderedWord(params: {
  entryId: number;
  renderResult: RenderCanvasResult;
  storagePath: string;
  publicUrl: string | null;
}): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.$transaction(async (tx) => {
    await tx.canvasAsset.upsert({
      where: { lexiconEntryId: params.entryId },
      update: {
        storagePath: params.storagePath,
        publicUrl: params.publicUrl,
        checksum: params.renderResult.checksum,
        width: params.renderResult.width,
        height: params.renderResult.height,
        templateName: params.renderResult.templateName,
        renderedAt: new Date()
      },
      create: {
        lexiconEntryId: params.entryId,
        storagePath: params.storagePath,
        publicUrl: params.publicUrl,
        checksum: params.renderResult.checksum,
        width: params.renderResult.width,
        height: params.renderResult.height,
        templateName: params.renderResult.templateName
      }
    });

    await tx.lexiconEntry.update({
      where: { id: params.entryId },
      data: { status: LexiconStatus.RENDERED }
    });
  });

  await advanceCursor();
}

async function markRenderFailed(entryId: number): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.lexiconEntry.update({
    where: { id: entryId },
    data: { status: LexiconStatus.FAILED_RENDER }
  });
}

export async function generateNextWord(params: GenerateNextWordParams): Promise<GenerateNextWordResult | null> {
  const env = loadEnv();
  const candidate = await claimNextWord();

  if (!candidate) {
    logger.info({ requestedBy: params.requestedBy }, 'No pending word is available to render');
    return null;
  }

  try {
    const renderResult = await renderWordCanvas({
      entry: candidate,
      width: env.CANVAS_WIDTH,
      height: env.CANVAS_HEIGHT
    });

    const uploadResult = await uploadCanvasAsset({
      word: candidate.word,
      sequenceNo: candidate.sequenceNo,
      buffer: renderResult.buffer,
      contentType: 'image/png'
    });

    await persistRenderedWord({
      entryId: candidate.id,
      renderResult,
      storagePath: uploadResult.storagePath,
      publicUrl: uploadResult.publicUrl
    });

    logger.info(
      {
        entryId: candidate.id,
        word: candidate.word,
        requestedBy: params.requestedBy,
        storagePath: uploadResult.storagePath
      },
      'Generated and uploaded the next word canvas'
    );

    return {
      entryId: candidate.id,
      word: candidate.word,
      storagePath: uploadResult.storagePath
    };
  } catch (error) {
    await markRenderFailed(candidate.id);
    logger.error({ error, entryId: candidate.id, word: candidate.word }, 'Failed to generate next word');
    throw error;
  }
}

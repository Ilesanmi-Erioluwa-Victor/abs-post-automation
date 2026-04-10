import type { PostJobStatus, PostSession, SessionType, LexiconEntry, CanvasAsset } from '@prisma/client';

export interface GenerateNextWordParams {
  requestedBy: string;
}

export interface GenerateNextWordResult {
  entryId: number;
  word: string;
  storagePath: string;
}

export interface RenderCanvasParams {
  entry: Pick<LexiconEntry, 'id' | 'sequenceNo' | 'word' | 'partOfSpeech' | 'meaning' | 'exampleSentence'>;
  width: number;
  height: number;
}

export interface RenderCanvasResult {
  buffer: Buffer;
  width: number;
  height: number;
  checksum: string;
  templateName: string;
}

export interface CreatePostPayloadParams {
  entry: Pick<LexiconEntry, 'id' | 'sequenceNo' | 'word' | 'partOfSpeech' | 'meaning' | 'exampleSentence'>;
  asset: Pick<CanvasAsset, 'storagePath'>;
}

export interface ProviderPostPayload {
  caption: string;
  fileName: string;
  mimeType: 'image/png';
  imageBuffer: Buffer;
  visibilityType: string;
}

export interface ProviderPostSuccess {
  providerPostId: string;
  responseExcerpt: string;
}

export interface ProviderPostFailure {
  retryable: boolean;
  code: string;
  message: string;
  httpStatus: number | null;
  responseExcerpt: string;
}

export interface SessionSummaryItem {
  word: string;
  status: PostJobStatus;
  attemptCount: number;
  lastErrorMessage: string | null;
}

export interface SessionSummary {
  session: PostSession;
  items: SessionSummaryItem[];
}

export interface PlanSessionParams {
  sessionDateKey: string;
  sessionType: SessionType;
}

export interface UploadCanvasParams {
  word: string;
  sequenceNo: number;
  buffer: Buffer;
  contentType: string;
}

export interface UploadCanvasResult {
  storagePath: string;
  publicUrl: string | null;
}

import { createHash } from 'node:crypto';
import path from 'node:path';

export function sanitizeFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function buildCanvasStoragePath(
  word: string,
  sequenceNo: number,
  renderedAt: Date
): string {
  const year = String(renderedAt.getFullYear());
  const month = String(renderedAt.getMonth() + 1).padStart(2, '0');
  const day = String(renderedAt.getDate()).padStart(2, '0');
  const fileName = `${String(sequenceNo).padStart(5, '0')}-${sanitizeFileName(word)}.png`;

  return path.posix.join('canvas', year, month, day, fileName);
}

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

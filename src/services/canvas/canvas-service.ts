import { createCanvas } from 'canvas';
import { sha256 } from '../../lib/files.js';
import type { CanvasRenderingContext2D } from 'canvas';
import type { RenderCanvasParams, RenderCanvasResult } from '../../types/domain.js';

function fitFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  fontFamily: string,
  fontWeight: 'normal' | 'bold'
): number {
  for (let size = maxSize; size >= minSize; size -= 2) {
    context.font = `${fontWeight} ${size}px ${fontFamily}`;
    if (context.measureText(text).width <= maxWidth) {
      return size;
    }
  }

  return minSize;
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(nextLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fillStyle = fillStyle;
  context.fill();
}

function drawBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const backgroundGradient = context.createLinearGradient(0, 0, 0, height);
  backgroundGradient.addColorStop(0, '#261c1c');
  backgroundGradient.addColorStop(0.45, '#5d4a46');
  backgroundGradient.addColorStop(1, '#181112');

  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, width, height);

  const cloudFill = 'rgba(255, 255, 255, 0.06)';
  context.fillStyle = cloudFill;
  for (let index = 0; index < 12; index += 1) {
    const cloudWidth = 320 + index * 16;
    const cloudHeight = 90 + (index % 3) * 24;
    const cloudX = (index * 97) % width - 80;
    const cloudY = 60 + index * 48;
    drawRoundedRect(context, cloudX, cloudY, cloudWidth, cloudHeight, 40, cloudFill);
  }

  context.strokeStyle = 'rgba(255, 230, 180, 0.32)';
  context.lineWidth = 8;
  context.beginPath();
  context.moveTo(width * 0.82, height * 0.12);
  context.lineTo(width * 0.7, height * 0.28);
  context.lineTo(width * 0.78, height * 0.38);
  context.lineTo(width * 0.62, height * 0.56);
  context.stroke();
}

function drawPaperBlock(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  heading: string,
  bodyLines: string[]
): void {
  drawRoundedRect(context, x, y, width, height, 28, 'rgba(244, 232, 213, 0.96)');

  context.fillStyle = '#1b1717';
  context.font = 'bold 40px Arial';
  context.fillText(heading, x + 42, y + 62);

  context.font = '36px Arial';
  let lineY = y + 120;
  for (const line of bodyLines) {
    context.fillText(line, x + 42, lineY);
    lineY += 46;
  }
}

export async function renderWordCanvas(params: RenderCanvasParams): Promise<RenderCanvasResult> {
  const { entry, width, height } = params;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  drawBackground(context, width, height);

  const wordFontSize = fitFontSize(context, entry.word, width - 160, 118, 74, 'Georgia', 'bold');
  context.fillStyle = '#f4ecdf';
  context.textAlign = 'center';
  context.font = `bold ${wordFontSize}px Georgia`;
  context.shadowColor = 'rgba(0, 0, 0, 0.35)';
  context.shadowBlur = 16;
  context.fillText(entry.word, width / 2, 142);

  context.shadowBlur = 0;
  context.fillStyle = '#f2c45a';
  context.font = 'bold 46px Arial';
  context.fillText(`(${entry.partOfSpeech})`, width / 2, 210);

  const meaningWidth = width - 120;
  context.textAlign = 'left';
  context.font = '36px Arial';
  const meaningLines = wrapText(context, entry.meaning, meaningWidth - 84);
  const meaningHeight = 132 + meaningLines.length * 46;
  drawPaperBlock(context, 60, 270, meaningWidth, meaningHeight, 'Meaning:', meaningLines);

  context.fillStyle = '#f3cb69';
  drawRoundedRect(context, 60, 600, 560, 64, 20, '#d9a847');
  context.fillStyle = '#171212';
  context.font = 'bold 34px Arial';
  context.fillText('Example Sentence:', 94, 642);

  context.fillStyle = '#f7eee4';
  drawRoundedRect(context, 60, 690, width - 120, 220, 30, 'rgba(17, 12, 12, 0.72)');
  context.fillStyle = '#f8f2e9';
  context.font = '36px Arial';
  const sentenceLines = wrapText(context, entry.exampleSentence, width - 180);
  let sentenceY = 760;
  for (const line of sentenceLines) {
    context.fillText(line, 104, sentenceY);
    sentenceY += 48;
  }

  context.fillStyle = '#f4e4c0';
  context.font = 'bold 44px Georgia';
  context.fillText('English Automation', 72, height - 82);
  context.font = '30px Arial';
  context.fillText(`Word #${entry.sequenceNo}`, 72, height - 38);

  const buffer = canvas.toBuffer('image/png');

  return {
    buffer,
    width,
    height,
    checksum: sha256(buffer),
    templateName: 'storm-card'
  };
}

import { createCanvas, loadImage } from "canvas";
import type { CanvasRenderingContext2D } from "canvas";
import { BRAND, CANVAS, brandMoodColor, font } from "./theme";
import { getIllustrationFor } from "./illustrations";
import type { ContentBundle } from "../content/types";

const W = CANVAS.width;
const H = CANVAS.height;
const M = CANVAS.margin;

const GOOD_TO_KNOW_TIP =
  "Follow AbS Tech Connect to grow your English one post at a time. Repetition is the secret!";

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function truncateLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
  return kept;
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const lines = truncateLines(wrapText(ctx, text, maxWidth), maxLines);
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return lines.length;
}

function drawSparkle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  color: string
): void {
  const innerR = outerR * 0.35;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const radius = i % 2 === 0 ? outerR : innerR;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLightbulb(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  const bulbR = size * 0.34;
  ctx.beginPath();
  ctx.arc(cx, cy - bulbR * 0.7, bulbR, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - bulbR * 0.45, cy - bulbR * 0.55, bulbR * 0.9, bulbR * 0.7);
  ctx.fillRect(cx - bulbR * 0.7, cy + bulbR * 0.15, bulbR * 1.4, bulbR * 0.18);
  ctx.fillStyle = BRAND.white;
  ctx.beginPath();
  ctx.arc(cx - bulbR * 0.25, cy - bulbR * 1.05, bulbR * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawNumberedBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  number: number
): void {
  ctx.save();
  ctx.fillStyle = BRAND.purple;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BRAND.white;
  ctx.font = font(r * 1.15, "bold");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), cx, cy + 1);
  ctx.restore();
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  roundRectPath(ctx, x, y, w, h, 16);
  ctx.fill();
  const tailW = 18;
  ctx.beginPath();
  ctx.moveTo(x + 34, y);
  ctx.lineTo(x + 34 + tailW, y);
  ctx.lineTo(x + 34 + tailW / 2, y - 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

async function drawIllustration(
  ctx: CanvasRenderingContext2D,
  mood: ContentBundle["mood"],
  x: number,
  y: number,
  w: number,
  h: number
): Promise<void> {
  const url = getIllustrationFor(mood);
  try {
    const img = await loadImage(url);
    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, 14);
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  } catch {
    ctx.save();
    ctx.fillStyle = `${brandMoodColor(mood)}22`;
    roundRectPath(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = brandMoodColor(mood);
    ctx.lineWidth = 2;
    ctx.stroke();
    drawSparkle(ctx, x + w / 2, y + h / 2, 34, brandMoodColor(mood));
    ctx.restore();
  }
}

function drawHeader(ctx: CanvasRenderingContext2D, input: ContentBundle): void {
  ctx.save();
  ctx.fillStyle = BRAND.purple;
  ctx.fillRect(0, 0, W, 320);

  drawSparkle(ctx, W - 90, 78, 26, BRAND.accent);
  drawSparkle(ctx, 96, 90, 16, `${BRAND.accent}AA`);
  drawSparkle(ctx, W - 220, 180, 12, BRAND.white);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = BRAND.accent;
  ctx.font = font(30, "bold");
  ctx.fillText(
    input.type === "word" ? "WORD OF THE DAY" : "IDIOM OF THE DAY",
    W / 2,
    118
  );

  const title = input.term.toUpperCase();
  let titleSize = 92;
  ctx.fillStyle = BRAND.white;
  while (titleSize > 40) {
    ctx.font = font(titleSize, "bold");
    if (ctx.measureText(title).width <= W - 160) break;
    titleSize -= 4;
  }
  ctx.fillText(title, W / 2, 252);

  ctx.restore();
}

function drawMeaning(ctx: CanvasRenderingContext2D, input: ContentBundle): void {
  ctx.save();
  const boxY = 350;
  const boxH = 220;

  ctx.fillStyle = BRAND.lavenderLight;
  roundRectPath(ctx, M, boxY, CANVAS.contentWidth, boxH, 24);
  ctx.fill();
  ctx.strokeStyle = BRAND.lavender;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = BRAND.purple;
  ctx.font = font(28, "bold");
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("MEANING", M + 36, boxY + 48);

  ctx.fillStyle = BRAND.ink;
  ctx.font = font(34);
  drawTextBlock(
    ctx,
    input.meaning,
    M + 36,
    boxY + 104,
    CANVAS.contentWidth - 72,
    44,
    3
  );

  ctx.restore();
}

function drawThinkOfItAs(ctx: CanvasRenderingContext2D, input: ContentBundle): void {
  ctx.save();
  const boxY = 590;
  const boxH = 140;

  ctx.fillStyle = BRAND.lavender;
  roundRectPath(ctx, M, boxY, CANVAS.contentWidth, boxH, 24);
  ctx.fill();

  drawLightbulb(ctx, M + 44, boxY + 52, 52, BRAND.amber);

  ctx.fillStyle = BRAND.purpleDark;
  ctx.font = font(26, "bold");
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("THINK OF IT AS", M + 92, boxY + 44);

  ctx.fillStyle = BRAND.ink;
  ctx.font = font(30);
  drawTextBlock(ctx, input.thinkOfItAs, M + 92, boxY + 88, CANVAS.contentWidth - 150, 40, 2);

  ctx.restore();
}

function drawExamplesBanner(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  const y = 750;
  ctx.fillStyle = BRAND.purple;
  roundRectPath(ctx, M, y, CANVAS.contentWidth, 56, 16);
  ctx.fill();

  ctx.fillStyle = BRAND.accent;
  ctx.font = font(30, "bold");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("EXAMPLES", W / 2, y + 29);

  ctx.restore();
}

async function drawExamplePanel(
  ctx: CanvasRenderingContext2D,
  input: ContentBundle,
  index: number
): Promise<void> {
  ctx.save();
  const panelTop = index === 0 ? 826 : 1096;
  const panelH = 250;

  ctx.fillStyle = BRAND.lavenderLight;
  roundRectPath(ctx, M, panelTop, CANVAS.contentWidth, panelH, 24);
  ctx.fill();
  ctx.strokeStyle = BRAND.lavender;
  ctx.lineWidth = 2;
  ctx.stroke();

  drawNumberedBadge(ctx, M + 40, panelTop + 44, 26, index + 1);

  const illustrationX = 872;
  const illustrationY = panelTop + 30;
  const illustrationW = 220;
  const illustrationH = 150;
  await drawIllustration(ctx, input.mood, illustrationX, illustrationY, illustrationW, illustrationH);

  const textX = M + 92;
  const textMaxWidth = illustrationX - textX - 16;

  ctx.fillStyle = BRAND.purpleDark;
  ctx.font = font(30, "bold");
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const scenarioLines = drawTextBlock(
    ctx,
    input.examples[index].scenario,
    textX,
    panelTop + 34,
    textMaxWidth,
    38,
    2
  );

  const quoteY = panelTop + 34 + scenarioLines * 38 + 12;
  const quoteMaxLines = 3;
  ctx.font = font(26);
  const quoteLines = truncateLines(
    wrapText(ctx, input.examples[index].quote, textMaxWidth - 56),
    quoteMaxLines
  );
  const quoteH = quoteLines.length * 36 + 30;

  drawSpeechBubble(ctx, textX, quoteY, textMaxWidth, quoteH, BRAND.white);
  ctx.strokeStyle = BRAND.lavender;
  ctx.lineWidth = 2;
  roundRectPath(ctx, textX, quoteY, textMaxWidth, quoteH, 16);
  ctx.stroke();

  ctx.fillStyle = BRAND.inkMuted;
  let ty = quoteY + 42;
  for (const line of quoteLines) {
    ctx.fillText(line, textX + 28, ty);
    ty += 36;
  }

  ctx.restore();
}

function drawFooter(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  const y = 1360;
  ctx.fillStyle = BRAND.purpleDeep;
  ctx.fillRect(0, y, W, H - y);

  ctx.fillStyle = BRAND.accent;
  ctx.font = font(26, "bold");
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("GOOD TO KNOW", M + 36, y + 48);

  ctx.fillStyle = BRAND.white;
  ctx.font = font(26);
  drawTextBlock(ctx, GOOD_TO_KNOW_TIP, M + 36, y + 88, CANVAS.contentWidth - 72, 36, 1);

  ctx.restore();
}

export async function renderCard(input: ContentBundle): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BRAND.white;
  ctx.fillRect(0, 0, W, H);

  drawHeader(ctx, input);
  drawMeaning(ctx, input);
  drawThinkOfItAs(ctx, input);
  drawExamplesBanner(ctx);
  await drawExamplePanel(ctx, input, 0);
  await drawExamplePanel(ctx, input, 1);
  drawFooter(ctx);

  return canvas.toBuffer("image/png");
}

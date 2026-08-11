import { generateWord } from "../content/generateWord";
import { generateIdiom } from "../content/generateIdiom";
import { renderCard } from "../render/renderCard";
import { uploadImage } from "../storage/uploadImage";
import { postToSite } from "../publish/postToSite";
import { Post } from "../db/models/Post";
import type { BatchSlot, ContentType } from "../db/models/Post";
import { sendSlotNotification } from "../notify/sendEmail";
import type { ContentBundle } from "../content/types";

export const BATCH_STRATEGY: "round-robin" | "weighted-random" = "round-robin";

const WEIGHTED_WORD_PROBABILITY = 0.5;

export interface BatchSummary {
  requested: number;
  succeeded: number;
  failed: number;
}

function decideType(index: number): ContentType {
  if (BATCH_STRATEGY === "round-robin") {
    return index % 2 === 0 ? "word" : "idiom";
  }
  return Math.random() < WEIGHTED_WORD_PROBABILITY ? "word" : "idiom";
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message) return error.message;
    if ("errors" in error && Array.isArray((error as AggregateError).errors)) {
      const causes = (error as AggregateError).errors
        .map((inner) => (inner instanceof Error ? inner.message : String(inner)))
        .filter(Boolean);
      if (causes.length) return causes.join("; ");
    }
    return `${error.name} (no message)`;
  }
  return String(error);
}

export async function runBatch(
  count: number,
  slot: BatchSlot
): Promise<BatchSummary> {
  const summary: BatchSummary = { requested: count, succeeded: 0, failed: 0 };
  const postedTerms: string[] = [];

  for (let i = 0; i < count; i++) {
    const type = decideType(i);
    let content: ContentBundle | null = null;

    try {
      content = type === "word" ? await generateWord() : await generateIdiom();

      const imageBuffer = await renderCard(content);
      const imageUrl = await uploadImage(imageBuffer);

      await postToSite({ ...content, type, imageUrl }, imageBuffer);

      await Post.create({
        type,
        term: content.term,
        meaning: content.meaning,
        thinkOfItAs: content.thinkOfItAs,
        examples: content.examples,
        usedIn: content.usedIn,
        imageUrl,
        batchSlot: slot,
        status: "posted",
        errorMessage: null,
      });

      summary.succeeded += 1;
      postedTerms.push(content.term);
      console.log(
        `[runBatch] slot=${slot} item=${i + 1}/${count} ${type} "${content.term}" posted`
      );
    } catch (error) {
      summary.failed += 1;
      const message = describeError(error);
      console.error(
        `[runBatch] slot=${slot} item=${i + 1}/${count} ${type} FAILED: ${message}`
      );

      try {
        await Post.create({
          type,
          term: content?.term ?? "(generation failed)",
          meaning: content?.meaning ?? "",
          thinkOfItAs: content?.thinkOfItAs ?? "",
          examples: content?.examples ?? [],
          usedIn: content?.usedIn ?? "",
          imageUrl: "",
          batchSlot: slot,
          status: "failed",
          errorMessage: message,
        });
      } catch (logError) {
        console.error("[runBatch] failed to record failure in Post collection:", logError);
      }
    }
  }

  console.log(
    `[runBatch] done slot=${slot} requested=${summary.requested} succeeded=${summary.succeeded} failed=${summary.failed}`
  );

  try {
    await sendSlotNotification({
      slot,
      count: summary.requested,
      succeeded: summary.succeeded,
      failed: summary.failed,
      terms: postedTerms,
    });
  } catch (error) {
    console.error(
      `[runBatch] failed to send slot notification email for ${slot}:`,
      describeError(error)
    );
  }

  return summary;
}

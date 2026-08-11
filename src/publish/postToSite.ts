import { env } from "../config/env";
import type { ContentWithImage } from "../content/types";

export const VISIBILITY_TYPE = "Everyone";

function buildCaption(content: ContentWithImage): string {
  const [first, second] = content.examples;
  const lines = [
    `**${content.type === "word" ? "Word" : "Idiom"}:** ${content.term}`,
    `**Meaning:** ${content.meaning}`,
    `**Think of it as:** ${content.thinkOfItAs}`,
  ];
  if (first) {
    lines.push(`**Example 1:** ${first.scenario} — "${first.quote}"`);
  }
  if (second) {
    lines.push(`**Example 2:** ${second.scenario} — "${second.quote}"`);
  }
  lines.push(`**Used in:** ${content.usedIn}`);
  return lines.join("\n");
}

export async function postToSite(
  content: ContentWithImage,
  imageBuffer: Buffer
): Promise<void> {
  const form = new FormData();
  form.append("visibilityType", VISIBILITY_TYPE);
  form.append("newAPI", "Yes");
  form.append("content", buildCaption(content));
  form.append("isPoll", "false");
  form.append("isAttachment", "false");
  form.append("isScholarship", "false");
  form.append(
    "images",
    new Blob([new Uint8Array(imageBuffer)], { type: "image/png" }),
    "post.png"
  );

  const response = await fetch(env.sitePostEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.siteApiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Site POST failed with status ${response.status}: ${body.slice(0, 500)}`
    );
  }
}

import type { ContentType, Mood } from "../db/models/Post";

export interface ExamplePanel {
  scenario: string;
  quote: string;
}

export interface ContentBundle {
  type: ContentType;
  term: string;
  meaning: string;
  thinkOfItAs: string;
  examples: ExamplePanel[];
  usedIn: string;
  mood: Mood;
}

export interface ContentWithImage extends ContentBundle {
  imageUrl: string;
}

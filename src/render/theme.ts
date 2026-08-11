export const BRAND = {
  purple: "#4B2ED1",
  purpleDark: "#3A24A6",
  purpleDeep: "#2C1B8F",
  lavender: "#EDE9FF",
  lavenderLight: "#F6F3FF",
  ink: "#221E3A",
  inkMuted: "#5B5573",
  white: "#FFFFFF",
  accent: "#FFD166",
  amber: "#FFB020",
  positive: "#2E9E5B",
  negative: "#D64545",
  neutral: "#5B78C8",
};

export const CANVAS = {
  width: 1200,
  height: 1500,
  margin: 60,
  contentWidth: 1200 - 60 * 2,
};

export const FONT_FAMILY = "sans-serif";

export function font(size: number, weight: "normal" | "bold" = "normal"): string {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

export function brandMoodColor(mood: "positive" | "negative" | "neutral"): string {
  switch (mood) {
    case "positive":
      return BRAND.positive;
    case "negative":
      return BRAND.negative;
    case "neutral":
      return BRAND.neutral;
  }
}

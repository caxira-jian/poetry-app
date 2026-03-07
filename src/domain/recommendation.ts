import type { Poem, RecommendationResult } from "../types";

const INTERVAL_BY_MASTERY = [0, 1, 2, 4, 7, 15];
const DAY_MS = 24 * 60 * 60 * 1000;

function dueForReview(poem: Poem, now: number): boolean {
  if (poem.learnIntent === "wishlist") {
    return false;
  }

  if (!poem.lastRecitedAt) {
    return true;
  }

  const last = new Date(poem.lastRecitedAt).getTime();
  if (Number.isNaN(last)) {
    return true;
  }

  const mastery = Math.max(0, Math.min(5, poem.masteryLevel));
  const intervalDays = INTERVAL_BY_MASTERY[mastery] ?? 1;
  return now - last >= intervalDays * DAY_MS;
}

export function buildFallbackRecommendation(poems: Poem[]): RecommendationResult {
  const now = Date.now();

  const review = poems
    .filter((poem) => dueForReview(poem, now))
    .map((poem) => ({
      poemId: poem.id,
      reason: poem.lastRecitedAt
        ? "已到复习窗口，建议回顾巩固"
        : "尚无背诵记录，建议开始第一次背诵"
    }));

  const newLearning = poems
    .filter((poem) => poem.learnIntent === "wishlist")
    .slice(0, 5)
    .map((poem) => ({
      poemId: poem.id,
      reason: "来自想学习清单，可作为新学习目标"
    }));

  return {
    review,
    newLearning,
    source: "fallback-list"
  };
}

import type { Poem, RecommendationResult } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_LIMIT = 5;

function parseTime(value?: string): number | null {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function daysForReciteCount(reciteCount: number): number {
  if (reciteCount <= 1) {
    return 1;
  }
  if (reciteCount === 2) {
    return 2;
  }
  if (reciteCount === 3) {
    return 4;
  }
  if (reciteCount === 4) {
    return 7;
  }
  if (reciteCount === 5) {
    return 15;
  }
  return 30;
}

type GroupName = "want-unrecited" | "review" | "viewed-only" | "unseen";

interface ReviewMeta {
  due: boolean;
  elapsedMs: number;
  remainingMs: number;
  missingLastRecitedAt: boolean;
}

function getGroup(poem: Poem): GroupName {
  if (poem.wantToRecite && poem.reciteCount === 0) {
    return "want-unrecited";
  }
  if (poem.reciteCount > 0) {
    return "review";
  }
  if (poem.viewCount > 0) {
    return "viewed-only";
  }
  return "unseen";
}

function getReviewMeta(poem: Poem, now: number): ReviewMeta {
  const lastRecitedAt = parseTime(poem.lastRecitedAt);
  if (poem.reciteCount > 0 && lastRecitedAt === null) {
    return {
      due: true,
      elapsedMs: Number.MAX_SAFE_INTEGER,
      remainingMs: 0,
      missingLastRecitedAt: true
    };
  }

  const intervalMs = daysForReciteCount(poem.reciteCount) * DAY_MS;
  const elapsedMs = lastRecitedAt === null ? 0 : Math.max(0, now - lastRecitedAt);
  const remainingMs = Math.max(0, intervalMs - elapsedMs);

  return {
    due: elapsedMs >= intervalMs,
    elapsedMs,
    remainingMs,
    missingLastRecitedAt: false
  };
}

function compareWantUnrecited(left: Poem, right: Poem): number {
  if (left.viewCount !== right.viewCount) {
    return right.viewCount - left.viewCount;
  }
  const leftViewedAt = parseTime(left.lastViewedAt) ?? 0;
  const rightViewedAt = parseTime(right.lastViewedAt) ?? 0;
  return rightViewedAt - leftViewedAt;
}

function compareReview(left: Poem, right: Poem, now: number): number {
  const leftMeta = getReviewMeta(left, now);
  const rightMeta = getReviewMeta(right, now);

  if (leftMeta.missingLastRecitedAt !== rightMeta.missingLastRecitedAt) {
    return leftMeta.missingLastRecitedAt ? -1 : 1;
  }
  if (leftMeta.due !== rightMeta.due) {
    return leftMeta.due ? -1 : 1;
  }
  if (leftMeta.due && rightMeta.due && leftMeta.elapsedMs !== rightMeta.elapsedMs) {
    return rightMeta.elapsedMs - leftMeta.elapsedMs;
  }
  if (!leftMeta.due && !rightMeta.due && leftMeta.remainingMs !== rightMeta.remainingMs) {
    return leftMeta.remainingMs - rightMeta.remainingMs;
  }
  if (left.reciteCount !== right.reciteCount) {
    return left.reciteCount - right.reciteCount;
  }
  const leftRecitedAt = parseTime(left.lastRecitedAt) ?? 0;
  const rightRecitedAt = parseTime(right.lastRecitedAt) ?? 0;
  return leftRecitedAt - rightRecitedAt;
}

function compareViewedOnly(left: Poem, right: Poem): number {
  if (left.viewCount !== right.viewCount) {
    return right.viewCount - left.viewCount;
  }
  const leftViewedAt = parseTime(left.lastViewedAt) ?? 0;
  const rightViewedAt = parseTime(right.lastViewedAt) ?? 0;
  return rightViewedAt - leftViewedAt;
}

function compareWithinGroup(left: Poem, right: Poem, now: number): number {
  const group = getGroup(left);
  if (group === "want-unrecited") {
    return compareWantUnrecited(left, right);
  }
  if (group === "review") {
    return compareReview(left, right, now);
  }
  if (group === "viewed-only") {
    return compareViewedOnly(left, right);
  }
  return 0;
}

export function sortPoemsByRecommendation(poems: Poem[], now = Date.now()): Poem[] {
  const groupRank: Record<GroupName, number> = {
    "want-unrecited": 0,
    review: 1,
    "viewed-only": 2,
    unseen: 3
  };

  return [...poems].sort((left, right) => {
    const leftGroup = getGroup(left);
    const rightGroup = getGroup(right);
    if (leftGroup !== rightGroup) {
      return groupRank[leftGroup] - groupRank[rightGroup];
    }

    const result = compareWithinGroup(left, right, now);
    if (result !== 0) {
      return result;
    }
    return left.title.localeCompare(right.title, "zh-CN");
  });
}

function buildReason(poem: Poem, now: number): string {
  const group = getGroup(poem);
  if (group === "want-unrecited") {
    return poem.viewCount > 0 ? "已标记想背，且多次浏览，建议优先开始背诵" : "已标记想背，建议开始第一遍背诵";
  }
  if (group === "review") {
    const meta = getReviewMeta(poem, now);
    if (meta.missingLastRecitedAt) {
      return "已有背诵次数，但缺少最近背诵时间，按最久未复习处理";
    }
    if (meta.due) {
      return "已到复习时间，建议优先巩固";
    }
    return "尚未到复习时间，但已进入近期复习候选";
  }
  if (group === "viewed-only") {
    return "浏览较多，但尚未标记想背，可作为候选";
  }
  return "尚未浏览，暂排在后面";
}

export function buildTodayRecommendation(poems: Poem[], now = Date.now()): RecommendationResult {
  const sorted = sortPoemsByRecommendation(poems, now);
  const review = sorted.slice(0, REVIEW_LIMIT).map((poem) => ({
    poemId: poem.id,
    reason: buildReason(poem, now)
  }));

  return {
    review,
    newLearning: [],
    source: "rule-based"
  };
}

export function getSuggestedReviewPoemIds(poems: Poem[], now = Date.now()): string[] {
  return sortPoemsByRecommendation(poems, now)
    .slice(0, REVIEW_LIMIT)
    .map((poem) => poem.id);
}

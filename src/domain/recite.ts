import type { Poem, ReciteLog, ReciteStatus } from "../types";

const STATUS_SCORE: Record<ReciteStatus, number> = {
  completed: 1,
  proficient: 2
};

export function applyReciteResult(
  poem: Poem,
  status: ReciteStatus,
  recitedAt: string
): Poem {
  const delta = STATUS_SCORE[status];
  const nextMastery = Math.min(5, poem.masteryLevel + delta);

  return {
    ...poem,
    currentStatus: status,
    masteryLevel: nextMastery,
    reciteCount: (poem.reciteCount || 0) + 1,
    lastRecitedAt: recitedAt
  };
}

export function buildReciteLog(
  poem: Poem,
  status: ReciteStatus,
  recitedAt: string,
  note?: string
): ReciteLog {
  return {
    id: crypto.randomUUID(),
    poemId: poem.id,
    titleSnapshot: poem.title,
    authorSnapshot: poem.author,
    recitedAt,
    status,
    note: note?.trim() || undefined
  };
}

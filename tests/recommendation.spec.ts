import { describe, expect, it } from "vitest";
import { buildTodayRecommendation, getSuggestedReviewPoemIds, sortPoemsByRecommendation } from "../src/domain/recommendation";
import type { Poem } from "../src/types";

function createPoem(overrides: Partial<Poem> & Pick<Poem, "id" | "title">): Poem {
  return {
    id: overrides.id,
    title: overrides.title,
    author: overrides.author || "作者",
    content: overrides.content || "",
    tags: overrides.tags || [],
    learnIntent: overrides.learnIntent || "learning",
    currentStatus: overrides.currentStatus || "none",
    masteryLevel: overrides.masteryLevel || 0,
    reciteCount: overrides.reciteCount || 0,
    viewCount: overrides.viewCount || 0,
    wantToRecite: overrides.wantToRecite || false,
    dynasty: overrides.dynasty,
    lastRecitedAt: overrides.lastRecitedAt,
    lastViewedAt: overrides.lastViewedAt
  };
}

describe("sortPoemsByRecommendation", () => {
  it("puts want-to-recite unrecited poems first", () => {
    const now = new Date("2026-03-17T08:00:00.000Z").getTime();
    const poems = [
      createPoem({ id: "review", title: "复习", reciteCount: 1, lastRecitedAt: "2026-03-17T06:00:00.000Z" }),
      createPoem({ id: "want", title: "想背", wantToRecite: true, viewCount: 2, lastViewedAt: "2026-03-17T07:00:00.000Z" })
    ];

    const result = sortPoemsByRecommendation(poems, now);
    expect(result.map((item) => item.id)).toEqual(["want", "review"]);
  });

  it("reorders list immediately after want-to-recite is toggled on", () => {
    const now = new Date("2026-03-17T08:00:00.000Z").getTime();
    const poem = createPoem({ id: "target", title: "目标", viewCount: 3, lastViewedAt: "2026-03-17T07:00:00.000Z" });
    const reviewPoem = createPoem({ id: "review", title: "待复习", reciteCount: 1, lastRecitedAt: "2026-03-17T06:00:00.000Z" });

    const before = sortPoemsByRecommendation([poem, reviewPoem], now);
    const after = sortPoemsByRecommendation([{ ...poem, wantToRecite: true }, reviewPoem], now);

    expect(before.map((item) => item.id)).toEqual(["review", "target"]);
    expect(after.map((item) => item.id)).toEqual(["target", "review"]);
  });

  it("sorts review poems by due status and elapsed time", () => {
    const now = new Date("2026-03-17T08:00:00.000Z").getTime();
    const poems = [
      createPoem({ id: "due-late", title: "到期更久", reciteCount: 1, lastRecitedAt: "2026-03-14T08:00:00.000Z" }),
      createPoem({ id: "due-recent", title: "刚到期", reciteCount: 1, lastRecitedAt: "2026-03-16T07:00:00.000Z" }),
      createPoem({ id: "not-due", title: "未到期", reciteCount: 2, lastRecitedAt: "2026-03-16T20:00:00.000Z" })
    ];

    const result = sortPoemsByRecommendation(poems, now);
    expect(result.map((item) => item.id)).toEqual(["due-late", "due-recent", "not-due"]);
  });

  it("treats review poems without lastRecitedAt as longest overdue", () => {
    const now = new Date("2026-03-17T08:00:00.000Z").getTime();
    const poems = [
      createPoem({ id: "missing", title: "缺失时间", reciteCount: 3 }),
      createPoem({ id: "due", title: "正常到期", reciteCount: 1, lastRecitedAt: "2026-03-15T08:00:00.000Z" })
    ];

    const result = sortPoemsByRecommendation(poems, now);
    expect(result.map((item) => item.id)).toEqual(["missing", "due"]);
  });

  it("sorts viewed-only poems after review poems", () => {
    const now = new Date("2026-03-17T08:00:00.000Z").getTime();
    const poems = [
      createPoem({ id: "viewed", title: "只浏览", viewCount: 10, lastViewedAt: "2026-03-17T07:00:00.000Z" }),
      createPoem({ id: "review", title: "待复习", reciteCount: 1, lastRecitedAt: "2026-03-15T08:00:00.000Z" }),
      createPoem({ id: "unseen", title: "未浏览" })
    ];

    const result = sortPoemsByRecommendation(poems, now);
    expect(result.map((item) => item.id)).toEqual(["review", "viewed", "unseen"]);
  });
});

describe("buildTodayRecommendation", () => {
  it("returns top five sorted poems as review items", () => {
    const now = new Date("2026-03-17T08:00:00.000Z").getTime();
    const poems = Array.from({ length: 6 }).map((_, index) =>
      createPoem({
        id: `p${index + 1}`,
        title: `诗${index + 1}`,
        wantToRecite: true,
        viewCount: 6 - index,
        lastViewedAt: `2026-03-1${index}T08:00:00.000Z`
      })
    );

    const result = buildTodayRecommendation(poems, now);
    expect(result.source).toBe("rule-based");
    expect(result.newLearning).toEqual([]);
    expect(result.review).toHaveLength(5);
    expect(result.review[0].poemId).toBe("p1");
    expect(result.review[4].poemId).toBe("p5");
  });

  it("returns suggested review ids for the first five poems", () => {
    const now = new Date("2026-03-17T08:00:00.000Z").getTime();
    const poems = Array.from({ length: 7 }).map((_, index) =>
      createPoem({
        id: `s${index + 1}`,
        title: `条目${index + 1}`,
        wantToRecite: true,
        viewCount: 7 - index,
        lastViewedAt: `2026-03-1${index}T08:00:00.000Z`
      })
    );

    expect(getSuggestedReviewPoemIds(poems, now)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
  });
});

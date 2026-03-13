import { describe, expect, it } from "vitest";
import { buildFallbackRecommendation } from "../src/domain/recommendation";
import type { Poem } from "../src/types";

describe("buildFallbackRecommendation", () => {
  it("returns review and wishlist candidates", () => {
    const poems: Poem[] = [
      {
        id: "p1",
        title: "A",
        author: "甲",
        content: "",
        tags: [],
        learnIntent: "learning",
        currentStatus: "none",
        masteryLevel: 0,
        reciteCount: 0,
        viewCount: 0
      },
      {
        id: "p2",
        title: "B",
        author: "乙",
        content: "",
        tags: [],
        learnIntent: "wishlist",
        currentStatus: "none",
        masteryLevel: 0,
        reciteCount: 0,
        viewCount: 0
      }
    ];

    const result = buildFallbackRecommendation(poems);
    expect(result.source).toBe("fallback-list");
    expect(result.review.length).toBe(1);
    expect(result.review[0].poemId).toBe("p1");
    expect(result.newLearning.length).toBe(1);
    expect(result.newLearning[0].poemId).toBe("p2");
  });
});

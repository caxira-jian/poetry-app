import { describe, expect, it } from "vitest";
import { applyReciteResult } from "../src/domain/recite";
import type { Poem } from "../src/types";

describe("applyReciteResult", () => {
  it("updates snapshot fields", () => {
    const poem: Poem = {
      id: "a",
      title: "静夜思",
      author: "李白",
      content: "x",
      tags: [],
      learnIntent: "learning",
      currentStatus: "none",
      masteryLevel: 0
    };

    const next = applyReciteResult(poem, "proficient", "2026-03-07T10:00:00.000Z");
    expect(next.currentStatus).toBe("proficient");
    expect(next.masteryLevel).toBe(2);
    expect(next.lastRecitedAt).toBe("2026-03-07T10:00:00.000Z");
  });
});

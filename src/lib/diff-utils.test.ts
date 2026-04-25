import { describe, it, expect } from "vitest";
import { computeDiff, applyEdits, revertEdits, formatDiff, diffStats, type TextEdit } from "./diff-utils";

describe("diff-utils", () => {
  describe("computeDiff", () => {
    it("returns empty diff for identical texts", () => {
      const original = "Hello World";
      const modified = "Hello World";
      const diff = computeDiff(original, modified);
      expect(diff).toEqual([{ type: "unchanged", content: "Hello World" }]);
    });

    it("detects added lines", () => {
      const original = "Hello";
      const modified = "Hello\nWorld";
      const diff = computeDiff(original, modified);
      expect(diff).toContainEqual({ type: "unchanged", content: "Hello" });
      expect(diff).toContainEqual({ type: "added", content: "World" });
    });

    it("detects removed lines", () => {
      const original = "Hello\nWorld";
      const modified = "Hello";
      const diff = computeDiff(original, modified);
      expect(diff).toContainEqual({ type: "unchanged", content: "Hello" });
      expect(diff).toContainEqual({ type: "removed", content: "World" });
    });

    it("detects modified lines as remove+add", () => {
      const original = "Hello World";
      const modified = "Hello Beautiful World";
      const diff = computeDiff(original, modified);
      // Since lines differ, it should show as removed + added
      const removed = diff.filter((l) => l.type === "removed");
      const added = diff.filter((l) => l.type === "added");
      expect(removed).toHaveLength(1);
      expect(added).toHaveLength(1);
      expect(removed[0].content).toBe("Hello World");
      expect(added[0].content).toBe("Hello Beautiful World");
    });

    it("handles multi-line diffs correctly", () => {
      const original = "Line 1\nLine 2\nLine 3";
      const modified = "Line 1\nLine 2 modified\nLine 3";
      const diff = computeDiff(original, modified);
      const unchanged = diff.filter((l) => l.type === "unchanged");
      const removed = diff.filter((l) => l.type === "removed");
      const added = diff.filter((l) => l.type === "added");
      expect(unchanged.map((l) => l.content)).toContain("Line 1");
      expect(unchanged.map((l) => l.content)).toContain("Line 3");
      expect(removed[0].content).toBe("Line 2");
      expect(added[0].content).toBe("Line 2 modified");
    });
  });

  describe("applyEdits", () => {
    it("returns original text when no edits provided", () => {
      const original = "Hello World";
      const result = applyEdits(original, []);
      expect(result).toBe(original);
    });

    it("applies a single edit correctly", () => {
      const original = "Hello World";
      const edits: TextEdit[] = [
        {
          originalText: "World",
          suggestedText: "Universe",
          reason: "Better word",
          severity: "low",
          confidence: 0.9,
        },
      ];
      const result = applyEdits(original, edits);
      expect(result).toBe("Hello Universe");
    });

    it("applies multiple edits correctly", () => {
      const original = "The quick brown fox";
      const edits: TextEdit[] = [
        {
          originalText: "quick",
          suggestedText: "slow",
          reason: "slower is better",
          severity: "medium",
          confidence: 0.85,
        },
        {
          originalText: "fox",
          suggestedText: "dog",
          reason: "dog is friendlier",
          severity: "low",
          confidence: 0.8,
        },
      ];
      const result = applyEdits(original, edits);
      expect(result).toBe("The slow brown dog");
    });

    it("handles edits that don't match (no-op)", () => {
      const original = "Hello World";
      const edits: TextEdit[] = [
        {
          originalText: "NonExistent",
          suggestedText: "Replacement",
          reason: "Will not match",
          severity: "high",
          confidence: 0.5,
        },
      ];
      const result = applyEdits(original, edits);
      expect(result).toBe(original);
    });
  });

  describe("revertEdits", () => {
    it("returns modified text when no edits provided", () => {
      const modified = "Hello World";
      const result = revertEdits(modified, []);
      expect(result).toBe(modified);
    });

    it("reverts a single edit correctly", () => {
      const modified = "Hello Universe";
      const edits: TextEdit[] = [
        {
          originalText: "World",
          suggestedText: "Universe",
          reason: "Better word",
          severity: "low",
          confidence: 0.9,
        },
      ];
      const result = revertEdits(modified, edits);
      expect(result).toBe("Hello World");
    });

    it("reverts multiple edits correctly", () => {
      const modified = "The slow brown dog";
      const edits: TextEdit[] = [
        {
          originalText: "quick",
          suggestedText: "slow",
          reason: "slower is better",
          severity: "medium",
          confidence: 0.85,
        },
        {
          originalText: "fox",
          suggestedText: "dog",
          reason: "dog is friendlier",
          severity: "low",
          confidence: 0.8,
        },
      ];
      const result = revertEdits(modified, edits);
      expect(result).toBe("The quick brown fox");
    });
  });

  describe("formatDiff", () => {
    it("formats diff lines correctly", () => {
      const diff = [
        { type: "unchanged" as const, content: "Hello" },
        { type: "added" as const, content: "World" },
        { type: "removed" as const, content: "Goodbye" },
      ];
      const formatted = formatDiff(diff);
      expect(formatted).toBe("  Hello\n+ World\n- Goodbye");
    });
  });

  describe("diffStats", () => {
    it("counts diff types correctly", () => {
      const diff = [
        { type: "unchanged" as const, content: "Line 1" },
        { type: "unchanged" as const, content: "Line 2" },
        { type: "added" as const, content: "Line 3" },
        { type: "removed" as const, content: "Line 4" },
        { type: "added" as const, content: "Line 5" },
      ];
      const stats = diffStats(diff);
      expect(stats).toEqual({ added: 2, removed: 1, unchanged: 2 });
    });
  });
});

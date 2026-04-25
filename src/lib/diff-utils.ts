/**
 * Diff computation utilities for AI review.
 * Pure line-level diff functions — no external dependencies.
 */

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
}

export interface TextEdit {
  originalText: string;
  suggestedText: string;
  reason: string;
  severity: "low" | "medium" | "high";
  confidence: number;
}

/**
 * Compute a line-level diff between original and modified text.
 * Returns an array of DiffLine objects marking added, removed, or unchanged lines.
 */
export function computeDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split("\n");
  const modifiedLines = modified.split("\n");

  // Simple LCS-based line diff
  const lcs = longestCommonSubsequence(originalLines, modifiedLines);

  const result: DiffLine[] = [];
  let origIdx = 0;
  let modIdx = 0;
  let lcsIdx = 0;

  while (origIdx < originalLines.length || modIdx < modifiedLines.length) {
    if (lcsIdx < lcs.length) {
      // Emit removals from original until we reach the next LCS line
      while (origIdx < originalLines.length && originalLines[origIdx] !== lcs[lcsIdx]) {
        result.push({ type: "removed", content: originalLines[origIdx] });
        origIdx++;
      }
      // Emit additions from modified until we reach the next LCS line
      while (modIdx < modifiedLines.length && modifiedLines[modIdx] !== lcs[lcsIdx]) {
        result.push({ type: "added", content: modifiedLines[modIdx] });
        modIdx++;
      }
      // Emit unchanged line
      if (origIdx < originalLines.length && modIdx < modifiedLines.length) {
        result.push({ type: "unchanged", content: originalLines[origIdx] });
        origIdx++;
        modIdx++;
        lcsIdx++;
      }
    } else {
      // No more LCS — emit remaining lines
      while (origIdx < originalLines.length) {
        result.push({ type: "removed", content: originalLines[origIdx] });
        origIdx++;
      }
      while (modIdx < modifiedLines.length) {
        result.push({ type: "added", content: modifiedLines[modIdx] });
        modIdx++;
      }
    }
  }

  return result;
}

/**
 * Longest Common Subsequence of lines.
 */
function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // Build DP table — using flat array for memory efficiency
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the LCS
  const lcs: string[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Apply a set of TextEdit suggestions to the original text.
 * Returns the modified text with all suggestions applied.
 * Note: This is a simplified implementation that replaces originalText with suggestedText.
 */
export function applyEdits(original: string, edits: TextEdit[]): string {
  if (edits.length === 0) return original;

  // Sort edits by position in document (longest first to avoid offset issues)
  const sortedEdits = [...edits].sort((a, b) => {
    const posA = original.indexOf(a.originalText);
    const posB = original.indexOf(b.originalText);
    return posB - posA; // descending so we apply from end to start
  });

  let result = original;

  for (const edit of sortedEdits) {
    const index = result.indexOf(edit.originalText);
    if (index !== -1) {
      result = result.slice(0, index) + edit.suggestedText + result.slice(index + edit.originalText.length);
    }
  }

  return result;
}

/**
 * Revert a set of TextEdit suggestions from modified text.
 * Returns the original text with all suggested changes undone.
 */
export function revertEdits(modified: string, edits: TextEdit[]): string {
  if (edits.length === 0) return modified;

  // Sort edits by position in document (longest first to avoid offset issues)
  const sortedEdits = [...edits].sort((a, b) => {
    const posA = modified.indexOf(a.suggestedText);
    const posB = modified.indexOf(b.suggestedText);
    return posB - posA; // descending so we apply from end to start
  });

  let result = modified;

  for (const edit of sortedEdits) {
    const index = result.indexOf(edit.suggestedText);
    if (index !== -1) {
      result = result.slice(0, index) + edit.originalText + result.slice(index + edit.suggestedText.length);
    }
  }

  return result;
}

/**
 * Format diff for display — returns a readable string representation.
 */
export function formatDiff(diff: DiffLine[]): string {
  return diff
    .map((line) => {
      switch (line.type) {
        case "added":
          return `+ ${line.content}`;
        case "removed":
          return `- ${line.content}`;
        case "unchanged":
          return `  ${line.content}`;
      }
    })
    .join("\n");
}

/**
 * Get summary statistics from a diff.
 */
export function diffStats(diff: DiffLine[]): { added: number; removed: number; unchanged: number } {
  return diff.reduce(
    (acc, line) => {
      acc[line.type]++;
      return acc;
    },
    { added: 0, removed: 0, unchanged: 0 }
  );
}

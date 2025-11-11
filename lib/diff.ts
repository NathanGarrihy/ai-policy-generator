import { diffWords, diffLines, Change } from "diff";

export type DiffResult = {
  added: Array<{ line: number; content: string }>;
  removed: Array<{ line: number; content: string }>;
  unchanged: Array<{ line: number; content: string }>;
};

/**
 * Compare two policy versions and return a diff
 */
export function comparePolicyVersions(
  oldContent: string,
  newContent: string
): DiffResult {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const diff = diffLines(oldContent, newContent);
  const result: DiffResult = {
    added: [],
    removed: [],
    unchanged: [],
  };

  let oldLineNum = 0;
  let newLineNum = 0;

  diff.forEach((part: Change) => {
    const lines = part.value.split("\n").filter((line) => line !== "");
    const isAdded = part.added;
    const isRemoved = part.removed;

    lines.forEach((line) => {
      if (isAdded) {
        result.added.push({ line: newLineNum + 1, content: line });
        newLineNum++;
      } else if (isRemoved) {
        result.removed.push({ line: oldLineNum + 1, content: line });
        oldLineNum++;
      } else {
        result.unchanged.push({ line: newLineNum + 1, content: line });
        oldLineNum++;
        newLineNum++;
      }
    });
  });

  return result;
}

/**
 * Get a summary of changes between versions
 */
export function getChangeSummary(
  oldContent: string,
  newContent: string
): string {
  const diff = diffWords(oldContent, newContent);
  let addedCount = 0;
  let removedCount = 0;

  diff.forEach((part) => {
    if (part.added) addedCount += part.value.split(/\s+/).length;
    if (part.removed) removedCount += part.value.split(/\s+/).length;
  });

  const changes: string[] = [];
  if (addedCount > 0) changes.push(`${addedCount} words added`);
  if (removedCount > 0) changes.push(`${removedCount} words removed`);

  return changes.length > 0 ? changes.join(", ") : "No significant changes";
}


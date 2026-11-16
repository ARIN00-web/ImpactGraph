function normalizePath(path: string) {
  return path.replace(/^\/+/, "").toLowerCase();
}

export function calculateRecallAtK(actualPaths: string[], predictedPaths: string[], k: number) {
  const actual = new Set(actualPaths.map(normalizePath));
  if (actual.size === 0) return 0;
  const predicted = new Set(predictedPaths.slice(0, k).map(normalizePath));
  return [...actual].filter((path) => predicted.has(path)).length / actual.size;
}

export function calculateReciprocalRank(actualPaths: string[], predictedPaths: string[]) {
  const actual = new Set(actualPaths.map(normalizePath));
  const rank = predictedPaths.findIndex((path) => actual.has(normalizePath(path)));
  return rank === -1 ? 0 : 1 / (rank + 1);
}

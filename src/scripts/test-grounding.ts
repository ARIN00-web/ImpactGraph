import assert from "node:assert/strict";
import { verifyFinding } from "@/lib/grounding";
import { calculateRecallAtK, calculateReciprocalRank } from "@/lib/evaluation-metrics";

const retrieved = new Set(["chunk-a", "chunk-b"]);

assert.deepEqual(
  verifyFinding({ evidence_ids: ["chunk-a"] }, retrieved),
  { verified: true, validEvidenceIds: ["chunk-a"], invalidEvidenceIds: [] },
);
assert.deepEqual(
  verifyFinding({ evidence_ids: ["chunk-a", "made-up"] }, retrieved),
  { verified: false, validEvidenceIds: ["chunk-a"], invalidEvidenceIds: ["made-up"] },
);
assert.deepEqual(
  verifyFinding({ evidence_ids: [] }, retrieved),
  { verified: false, validEvidenceIds: [], invalidEvidenceIds: [] },
);
assert.equal(calculateRecallAtK(["src/a.ts", "src/b.ts"], ["src/a.ts", "src/c.ts", "src/b.ts"], 2), 0.5);
assert.equal(calculateRecallAtK([], ["src/a.ts"], 5), 0);
assert.equal(calculateReciprocalRank(["src/b.ts"], ["src/a.ts", "src/b.ts"]), 0.5);

console.log("Grounding checks passed.");

import type { LLMFinding } from "@/lib/analysis";

export type FindingGrounding = {
  verified: boolean;
  validEvidenceIds: string[];
  invalidEvidenceIds: string[];
};

/**
 * Verifies citations against the exact chunks supplied to the LLM.
 * A finding is verified only when it has citations and every citation is valid.
 */
export function verifyFinding(
  finding: Pick<LLMFinding, "evidence_ids">,
  retrievedChunkIds: ReadonlySet<string>
): FindingGrounding {
  const evidenceIds = Array.isArray(finding.evidence_ids)
    ? [...new Set(
        finding.evidence_ids.filter(
          (id): id is string =>
            typeof id === "string" && id.length > 0
        )
      )]
    : [];

  const validEvidenceIds = evidenceIds.filter((id) =>
    retrievedChunkIds.has(id)
  );
  const invalidEvidenceIds = evidenceIds.filter(
    (id) => !retrievedChunkIds.has(id)
  );

  return {
    verified:
      validEvidenceIds.length > 0 &&
      invalidEvidenceIds.length === 0,
    validEvidenceIds,
    invalidEvidenceIds,
  };
}

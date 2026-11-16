import { generate } from "@/lib/llm";
import { buildImpactAnalysisPrompt } from "@/prompts/impact-analysis";

export type AnalysisEvidence = {
  id: string;
  content: string;
  path: string | null;
  chunkType: string;
};

export type LLMFinding = {
  component: string;
  file_path: string;
  impact_type: string;
  confidence: number;
  reason: string;
  evidence_ids: string[];
};

export type LLMAnalysis = {
  assessment: string;
  strengths: string[];
  recommendations: string[];
  limitations: string[];
  findings: LLMFinding[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseAnalysis(value: unknown): LLMAnalysis {
  if (!isRecord(value) || !Array.isArray(value.findings)) throw new Error("LLM returned an invalid analysis shape");
  const list = (input: unknown) => Array.isArray(input) ? input.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 8) : [];
  const findings = value.findings.map((item) => {
    if (!isRecord(item) || typeof item.reason !== "string" || !Array.isArray(item.evidence_ids)) throw new Error("LLM returned an invalid finding");
    return {
      component: typeof item.component === "string" ? item.component : "Unscoped component",
      file_path: typeof item.file_path === "string" ? item.file_path : "",
      impact_type: typeof item.impact_type === "string" ? item.impact_type : "impact",
      confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0)),
      reason: item.reason,
      evidence_ids: item.evidence_ids.filter((id): id is string => typeof id === "string"),
    };
  });
  return {
    assessment: typeof value.assessment === "string" && value.assessment.trim() ? value.assessment.trim() : "The change was reviewed against the retrieved repository context.",
    strengths: list(value.strengths),
    recommendations: list(value.recommendations),
    limitations: list(value.limitations),
    findings,
  };
}

export async function analyzeChange(
  change: string,
  evidence: AnalysisEvidence[]
): Promise<LLMAnalysis> {
  const prompt = buildImpactAnalysisPrompt(
    change,
    evidence
  );

  const result = await generate(
    "You are a precise software impact-analysis engine.",
    prompt
  );

  return parseAnalysis(result);
}

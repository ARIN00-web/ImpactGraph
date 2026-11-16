import { GoogleGenAI } from "@google/genai";

const DEFAULT_ANALYSIS_MODEL = "gemini-3.6-flash";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey });
}

export async function generate(systemPrompt: string, userPrompt: string) {
  const model = process.env.GEMINI_ANALYSIS_MODEL?.trim() || DEFAULT_ANALYSIS_MODEL;
  const response = await getClient().models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0,
      responseMimeType: "application/json",
    },
  });

  const content = response.text;
  if (!content) {
    throw new Error("Gemini returned an empty response");
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }
}

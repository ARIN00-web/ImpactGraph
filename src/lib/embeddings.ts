import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 1536;

export class GeminiQuotaExhaustedError extends Error {}

function isGeminiQuotaError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    message?: unknown;
    error?: { status?: unknown; message?: unknown };
  };
  const status =
    candidate.status ?? candidate.statusCode ?? candidate.error?.status;
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const nestedMessage =
    typeof candidate.error?.message === "string"
      ? candidate.error.message
      : "";

  return (
    status === 429 ||
    /RESOURCE_EXHAUSTED|quota (?:has been )?exceeded|rate limit/i.test(
      `${message} ${nestedMessage}`
    )
  );
}

/**
 * Lazily creates the Gemini client on the server.
 *
 * We intentionally validate the API key when the function is called
 * rather than when the module is imported, which keeps module loading
 * predictable during builds.
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return new GoogleGenAI({ apiKey });
}

/**
 * Generate embeddings for a batch of chunk contents.
 *
 * The returned array preserves the same order as the input array.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const cleanedTexts = texts.map((text) =>
    text.trim()
  );

  if (cleanedTexts.some((text) => text.length === 0)) {
    throw new Error(
      "Cannot generate embeddings for empty text"
    );
  }

  const gemini = getGeminiClient();

  let response: Awaited<ReturnType<typeof gemini.models.embedContent>>;
  try {
    response = await gemini.models.embedContent({
      model: MODEL,
      contents: cleanedTexts,
      config: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    });
  } catch (error) {
    if (isGeminiQuotaError(error)) {
      throw new GeminiQuotaExhaustedError(
        "Gemini embedding quota or rate limit reached"
      );
    }
    throw error;
  }

  const embeddings = (response.embeddings ?? []).map(
    (item) => item.values ?? []
  );

  if (embeddings.length !== cleanedTexts.length) {
    throw new Error(
      `Expected ${cleanedTexts.length} embeddings, received ${embeddings.length}`
    );
  }

  return embeddings;
}


import { retrieveRelevantChunks } from "../lib/retrieval";
import { closeDb } from "../db";

const repositoryId =
  "2818624f-549e-47cc-b8f9-a2cd8be359dd";

const query =
  "How does the compiler prevent setState during rendering?";

async function main() {
  const results = await retrieveRelevantChunks({
    repositoryId,
    query,
  });

  console.log(
    JSON.stringify(
      results.map((result, index) => ({
        rank: index + 1,
        path: result.path,
        chunkType: result.chunkType,
        symbolName: result.symbolName,
        startLine: result.startLine,
        endLine: result.endLine,
        semanticScore:
          Number(result.semanticScore.toFixed(4)),
        lexicalScore:
          Number(result.lexicalScore.toFixed(4)),
        structuralScore:
          Number(result.structuralScore.toFixed(4)),
        recencyScore:
          Number(result.recencyScore.toFixed(4)),
        finalScore:
          Number(result.score.toFixed(4)),
      })),
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });

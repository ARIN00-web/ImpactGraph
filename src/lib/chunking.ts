import type { StaticAnalysisResult } from "@/lib/static-analysis";

export type ChunkInput = {
  documentType:
    | "source"
    | "test"
    | "documentation"
    | "pull_request"
    | "issue";
  path: string | null;
  title: string | null;
  content: string;
  analysis?: StaticAnalysisResult;
};

export type GeneratedChunk = {
  content: string;
  chunkType:
    | "function"
    | "class"
    | "section"
    | "pr_body"
    | "issue_body";
  symbolName?: string;
  startLine?: number;
  endLine?: number;
  metadata?: Record<string, unknown>;
};

function getLines(content: string) {
  return content.split(/\r?\n/);
}

function getLineRange(
  lines: string[],
  startLine: number,
  endLine: number
) {
  return lines.slice(startLine - 1, endLine).join("\n");
}

function chunkSourceFile(
  content: string,
  analysis?: StaticAnalysisResult
): GeneratedChunk[] {
  const lines = getLines(content);
  if (!analysis || analysis.symbols.length === 0) {
    const chunks: GeneratedChunk[] = [];
    const windowSize = 80;
    const overlap = 10;
    for (let start = 0; start < lines.length; start += windowSize - overlap) {
      const end = Math.min(lines.length, start + windowSize);
      const text = lines.slice(start, end).join("\n").trim();
      if (text) chunks.push({ content: text, chunkType: "section", startLine: start + 1, endLine: end, metadata: { fallback: true } });
      if (end === lines.length) break;
    }
    return chunks;
  }

  return analysis.symbols.map((symbol) => ({
    content: getLineRange(
      lines,
      symbol.startLine,
      symbol.endLine
    ),
    chunkType: symbol.kind,
    symbolName: symbol.name,
    startLine: symbol.startLine,
    endLine: symbol.endLine,
  }));
}

function chunkMarkdown(content: string): GeneratedChunk[] {
  const lines = getLines(content);

  const chunks: GeneratedChunk[] = [];

  let currentHeading: string | null = null;
  let currentStartLine = 1;
  let currentLines: string[] = [];

  const flushChunk = () => {
    const text = currentLines.join("\n").trim();

    if (!text) {
      return;
    }

    chunks.push({
      content: text,
      chunkType: "section",
      symbolName: currentHeading ?? undefined,
      startLine: currentStartLine,
      endLine: currentStartLine + currentLines.length - 1,
      metadata: {
        heading: currentHeading,
      },
    });
  };

  lines.forEach((line, index) => {
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);

    if (headingMatch) {
      flushChunk();

      currentHeading = headingMatch[2].trim();
      currentStartLine = index + 1;
      currentLines = [line];

      return;
    }

    currentLines.push(line);
  });

  flushChunk();

  return chunks;
}

function chunkTestFile(
  content: string,
  analysis?: StaticAnalysisResult
): GeneratedChunk[] {
  const testNames: string[] = [];

  const testPattern =
    /\b(?:describe|it|test)\s*\(\s*["'`]([^"'`]+)["'`]/g;

  let match: RegExpExecArray | null;

  while ((match = testPattern.exec(content)) !== null) {
    testNames.push(match[1]);
  }

  return [
    {
      content,
      chunkType: "section",
      metadata: {
        testNames,
        exportedSymbols: analysis?.symbols.map(
          (symbol) => symbol.name
        ) ?? [],
      },
    },
  ];
}

function chunkPullRequest(
  title: string | null,
  content: string
): GeneratedChunk[] {
  const fullContent = [
    title ? `# ${title}` : null,
    content,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return [
    {
      content: fullContent,
      chunkType: "pr_body",
    },
  ];
}

function chunkIssue(
  title: string | null,
  content: string
): GeneratedChunk[] {
  const fullContent = [
    title ? `# ${title}` : null,
    content,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return [
    {
      content: fullContent,
      chunkType: "issue_body",
    },
  ];
}

export function generateChunks(
  input: ChunkInput
): GeneratedChunk[] {
  switch (input.documentType) {
    case "source":
      return chunkSourceFile(
        input.content,
        input.analysis
      );

    case "documentation":
      return chunkMarkdown(input.content);

    case "test":
      return chunkTestFile(
        input.content,
        input.analysis
      );

    case "pull_request":
      return chunkPullRequest(
        input.title,
        input.content
      );

    case "issue":
      return chunkIssue(
        input.title,
        input.content
      );
  }
}

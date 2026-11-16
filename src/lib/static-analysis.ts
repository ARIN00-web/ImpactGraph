import { Project } from "ts-morph";

export type ImportDependency = {
  sourcePath: string;
  importedPath: string;
};

export type SymbolBoundary = {
  kind: "function" | "class";
  name: string;
  startLine: number;
  endLine: number;
};

export type StaticAnalysisResult = {
  imports: ImportDependency[];
  symbols: SymbolBoundary[];
};

const project = new Project({
  useInMemoryFileSystem: true,
  skipAddingFilesFromTsConfig: true,
  compilerOptions: {
    allowJs: true,
    target: 99,
  },
});

/**
 * Normalizes a repository path.
 *
 * Example:
 *   "./utils"          -> "utils"   (because "./" means current directory, so its the same and starting with "./" is unnecessary)
 *   "../lib/session"   -> "../lib/session" (../ means parent directory)
 *   "src/foo.ts"       -> "src/foo.ts"
 */
function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

/**
 * Resolve a relative import against the importing file.
 *
 * We intentionally only resolve relative imports here.
 * External packages such as "react" or "next/server" are not
 * repository file dependencies.
 */
function resolveRelativeImport(
  sourcePath: string,
  importPath: string,
  knownPaths: Set<string>
) {
  const aliasedPath = importPath.startsWith("@/") ? `src/${importPath.slice(2)}` : null;
  if (!importPath.startsWith(".") && !aliasedPath) {
    return null;
  }

  const sourceParts = aliasedPath ? [] : normalizePath(sourcePath).split("/");
  if (!aliasedPath) sourceParts.pop();

  const importParts = (aliasedPath ?? importPath).split("/");

  for (const part of importParts) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      sourceParts.pop();
    } else {
      sourceParts.push(part);
    }
  }

  const basePath = sourceParts.join("/");

  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
    `${basePath}/index.js`,
    `${basePath}/index.jsx`,
  ];

  return candidates.find((candidate) =>
    knownPaths.has(candidate)
  ) ?? null;
}

function getLineNumber(node: {
  getStartLineNumber(): number;
  getEndLineNumber(): number;
}) {
  return {
    startLine: node.getStartLineNumber(),
    endLine: node.getEndLineNumber(),
  };
}

function getLiteralModuleSpecifier(declaration: {
  getModuleSpecifierValue(): string | undefined;
}) {
  try {
    return declaration.getModuleSpecifierValue();
  } catch {
    return null;
  }
}

/**
 * Runs static analysis against one repository source file.
 *
 * Extracts:
 * 1. Relative repository imports
 * 2. Exported function boundaries
 * 3. Exported class boundaries
 *
 * The returned symbol boundaries are consumed later by Phase 4 chunking.
 */
export function analyzeSourceFile(
  sourcePath: string,
  content: string,
  knownPaths: Set<string>
): StaticAnalysisResult {
  const normalizedSourcePath = normalizePath(sourcePath);

  const existing = project.getSourceFile(normalizedSourcePath);

  if (existing) {
    project.removeSourceFile(existing);
  }

  const sourceFile = project.createSourceFile(
    normalizedSourcePath,
    content,
    {
      overwrite: true,
    }
  );

  const imports: ImportDependency[] = [];

  for (const declaration of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = getLiteralModuleSpecifier(declaration);

    if (!moduleSpecifier) {
      continue;
    }

    const importedPath = resolveRelativeImport(
      normalizedSourcePath,
      moduleSpecifier,
      knownPaths
    );

    if (!importedPath) {
      continue;
    }

    imports.push({
      sourcePath: normalizedSourcePath,
      importedPath,
    });
  }

  for (const declaration of sourceFile.getExportDeclarations()) {
    const moduleSpecifier = getLiteralModuleSpecifier(declaration);

    if (!moduleSpecifier) {
      continue;
    }

    const importedPath = resolveRelativeImport(
      normalizedSourcePath,
      moduleSpecifier,
      knownPaths
    );

    if (!importedPath) {
      continue;
    }

    imports.push({
      sourcePath: normalizedSourcePath,
      importedPath,
    });
  }

  const symbols: SymbolBoundary[] = [];

  for (const functionDeclaration of sourceFile.getFunctions()) {
    if (!functionDeclaration.isExported()) {
      continue;
    }

    const name = functionDeclaration.getName();

    if (!name) {
      continue;
    }

    const { startLine, endLine } =
      getLineNumber(functionDeclaration);

    symbols.push({
      kind: "function",
      name,
      startLine,
      endLine,
    });
  }

  for (const classDeclaration of sourceFile.getClasses()) {
    if (!classDeclaration.isExported()) {
      continue;
    }

    const name = classDeclaration.getName();

    if (!name) {
      continue;
    }

    const { startLine, endLine } =
      getLineNumber(classDeclaration);

    symbols.push({
      kind: "class",
      name,
      startLine,
      endLine,
    });
  }

  return {
    imports: [...new Map(imports.map((item) => [`${item.sourcePath}:${item.importedPath}`, item])).values()],
    symbols,
  };
}


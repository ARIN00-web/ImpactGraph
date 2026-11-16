import { Node, Project, type SourceFile } from "ts-morph";

export type PullFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
  previous_filename?: string;
  contents?: { before: string | null; after: string | null };
};

export type IndexedSource = { path: string; content: string };
export type ImportEdge = { sourcePath: string; importedPath: string };

export type ImpactFinding = {
  id: string;
  title: string;
  severity: "critical" | "high" | "moderate" | "low";
  category: "breaking-change" | "dependency-impact" | "test-coverage" | "change-review";
  filePath: string;
  symbol: string | null;
  explanation: string;
  consequence: string;
  recommendation: string;
  confidence: "high" | "medium" | "low";
  confirmed: boolean;
  evidence: string[];
  impactedConsumers: Array<{ path: string; symbol: string | null; evidence: string }>;
};

export type RiskFactor = { score: number | null; weight: number; contribution: number | null; reason: string };

export type PRImpact = {
  files: Array<Omit<PullFile, "contents"> & { patchTruncated: boolean }>;
  findings: ImpactFinding[];
  testRecommendations: Array<{ path: string; reason: string }>;
  sourceFilesCompared: number;
  risk: { score: number; classification: "Low" | "Moderate" | "High" | "Critical"; factors: Record<string, RiskFactor>; weights: Record<string, number>; uncertainty: string[] };
  mergeReadiness: { status: "LOW RISK" | "REVIEW REQUIRED" | "HIGH RISK" | "CRITICAL"; complete: boolean; summary: string; beforeMerge: string[]; counts: Record<string, number> };
  diffAvailable: boolean;
};

const extensions = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];
function makeProject() {
  return new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true, compilerOptions: { allowJs: true, jsx: 4 } });
}
function parse(path: string, content: string): SourceFile {
  const project = makeProject();
  return project.createSourceFile(path.replace(/^\/+/, ""), content, { overwrite: true });
}
function exportedMap(source: SourceFile) {
  return source.getExportedDeclarations();
}
function signature(nodes: Node[]) {
  return nodes.map((node) => {
    if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node) || Node.isMethodSignature(node)) {
      return `${node.getParameters().map((p) => `${p.getName()}${p.hasQuestionToken() ? "?" : ""}:${p.getTypeNode()?.getText() ?? "unknown"}`).join(",")}=>${node.getReturnTypeNode()?.getText() ?? "inferred"}`;
    }
    if (Node.isInterfaceDeclaration(node)) return node.getMembers().map((member) => member.getText()).sort().join(";");
    if (Node.isTypeAliasDeclaration(node)) return node.getTypeNode()?.getText() ?? "";
    if (Node.isEnumDeclaration(node)) return node.getMembers().map((member) => member.getText()).join(";");
    if (Node.isVariableDeclaration(node)) return `${node.getTypeNode()?.getText() ?? "inferred"}=${node.getInitializer()?.getText() ?? ""}`;
    return node.getText();
  }).join("\n");
}
function declarationEvidence(label: string, nodes: Node[]) {
  const spans = nodes.map((node) => `${node.getStartLineNumber()}-${node.getEndLineNumber()}`).join(", ");
  const snippet = nodes.map((node) => node.getText()).join("\n").slice(0, 4000);
  return `${label} lines ${spans}:\n${snippet}`;
}
function hasRequiredPropertyChange(before: Node[], after: Node[]) {
  const a = before.find(Node.isInterfaceDeclaration);
  const b = after.find(Node.isInterfaceDeclaration);
  if (!a || !b) return false;
  const previous = new Map(a.getProperties().map((p) => [p.getName(), p.hasQuestionToken()]));
  return b.getProperties().some((p) => previous.get(p.getName()) === true && !p.hasQuestionToken());
}
function directConsumers(filePath: string, symbol: string | null, edges: ImportEdge[], sources: IndexedSource[]) {
  const edgePaths = new Set(edges.filter((edge) => edge.importedPath === filePath).map((edge) => edge.sourcePath));
  return sources.filter((source) => edgePaths.has(source.path)).flatMap((source) => {
    try {
      const ast = parse(source.path, source.content);
      const declaration = ast.getImportDeclarations().find((item) => {
        const specifier = item.getModuleSpecifierValue();
        const base = source.path.includes("/") ? source.path.slice(0, source.path.lastIndexOf("/") + 1) : "";
        const resolved = `${base}${specifier}`.replace(/\/\.\//g, "/").replace(/\/[^/]+\/\.\.\//g, "/");
        return edgePaths.has(source.path) && (resolved === filePath.replace(/\.(tsx?|jsx?)$/, "") || extensions.some((ext) => `${resolved}${ext}` === filePath));
      });
      if (!declaration) return [];
      const bindings = declaration.getNamedImports().map((item) => item.getAliasNode()?.getText() ?? item.getName());
      const consumed = symbol && bindings.includes(symbol) ? symbol : null;
      if (symbol && !consumed && bindings.length) return [];
      return [{ path: source.path, symbol: consumed, evidence: `Imports ${consumed ?? "the changed module"} from ${filePath}` }];
    } catch { return []; }
  });
}

export function analyzePullRequest(input: {
  files: PullFile[];
  sources: IndexedSource[];
  edges: ImportEdge[];
  weights?: Partial<Record<"changeComplexity" | "dependencyImpact" | "breakingChanges" | "testCoverage" | "criticality", number>>;
}): PRImpact {
  const findings: ImpactFinding[] = [];
  const files = input.files;
  for (const file of files) {
    const before = file.contents?.before;
    const after = file.contents?.after;
    if (before == null || after == null || !extensions.some((ext) => file.filename.endsWith(ext))) continue;
    const importPath = file.previous_filename ?? file.filename;
    try {
      const previous = exportedMap(parse(file.filename, before));
      const current = exportedMap(parse(file.filename, after));
      for (const [name, declarations] of previous) {
        const next = current.get(name);
        if (!next) {
          const consumers = directConsumers(importPath, name, input.edges, input.sources);
          findings.push({ id: `removed-export:${file.filename}:${name}`, title: `Export “${name}” was removed`, severity: consumers.length ? "high" : "moderate", category: "breaking-change", filePath: file.filename, symbol: name, explanation: `The PR removes the exported symbol ${name}. ${consumers.length ? `${consumers.length} indexed importer(s) still reference this module.` : "No indexed importer was found, although external consumers are not visible."}`, consequence: consumers.length ? "An importer may fail to compile or resolve the symbol after merge." : "Downstream users outside this repository may fail to build.", recommendation: consumers.length ? `Update the listed importers or retain a compatibility export for ${name}.` : "Check package/API consumers before removing this export.", confidence: consumers.length ? "high" : "medium", confirmed: false, evidence: [`Removed export: ${name}`, `Changed file: ${file.filename}`], impactedConsumers: consumers });
          continue;
        }
        if (signature(declarations) !== signature(next)) {
          const required = hasRequiredPropertyChange(declarations, next);
          const consumers = directConsumers(importPath, name, input.edges, input.sources);
          findings.push({ id: `signature-change:${file.filename}:${name}`, title: `${required ? "Required interface property added to" : "Public contract changed for"} “${name}”`, severity: consumers.length ? "high" : "moderate", category: "breaking-change", filePath: file.filename, symbol: name, explanation: `${required ? "A previously optional interface property is now required. " : "The exported declaration signature or type shape differs between the base and head revisions. "}${consumers.length ? `${consumers.length} indexed importer(s) depend on this module.` : "No indexed direct consumer was found."}`, consequence: required ? "Existing object values that omit the property may no longer type-check." : "Callers may pass incompatible arguments or rely on a previous type shape.", recommendation: "Review the before/after declaration and update consumers or provide a compatible transition.", confidence: "medium", confirmed: false, evidence: [declarationEvidence("Before", declarations), declarationEvidence("After", next), `Changed file: ${file.filename}`], impactedConsumers: consumers });
        }
      }
    } catch {
      findings.push({ id: `parse:${file.filename}`, title: "Changed source could not be parsed", severity: "moderate", category: "change-review", filePath: file.filename, symbol: null, explanation: "The source was available but AST parsing failed, so semantic compatibility checks were skipped for this file.", consequence: "Potential API changes in this file may be missed.", recommendation: "Check the syntax and run the repository's normal build or type-check command.", confidence: "high", confirmed: true, evidence: [`AST parsing failed for ${file.filename}`], impactedConsumers: [] });
    }
  }

  const changedPaths = new Set(files.flatMap((f) => [f.filename, f.previous_filename].filter((path): path is string => Boolean(path))));
  const impactDepth = new Map<string, number>([...changedPaths].map((path) => [path, 0]));
  let frontier = [...changedPaths];
  for (let depth = 1; depth <= 8 && frontier.length; depth += 1) {
    const next: string[] = [];
    for (const edge of input.edges) {
      if (frontier.includes(edge.importedPath) && !impactDepth.has(edge.sourcePath)) {
        impactDepth.set(edge.sourcePath, depth);
        next.push(edge.sourcePath);
      }
    }
    frontier = next;
  }
  const importerPaths = new Set([...impactDepth.keys()].filter((path) => !changedPaths.has(path)));
  for (const path of importerPaths) {
    if (changedPaths.has(path)) continue;
    findings.push({ id: `consumer:${path}`, title: "Changed module has indexed importers", severity: "low", category: "dependency-impact", filePath: path, symbol: null, explanation: `The indexed import graph shows ${path} imports a file changed by this PR. This confirms a structural relationship, not a defect.`, consequence: "Behavior in this importer may be affected if the changed API or behavior is incompatible.", recommendation: "Review the importer alongside the changed code and run its relevant tests.", confidence: "high", confirmed: false, evidence: [...input.edges.filter((e) => e.sourcePath === path && changedPaths.has(e.importedPath)).map((e) => `${path} imports ${e.importedPath}`)], impactedConsumers: [] });
  }

  const tests = input.sources.filter((source) => /(?:^|\/)(?:__tests__\/.*|.*\.(?:test|spec)\.[cm]?[jt]sx?)$/.test(source.path));
  const testRecommendations = tests.filter((test) => files.some((file) => {
    const stem = file.filename.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
    return stem && (test.path.includes(`${stem}.`) || test.content.includes(stem));
  })).map((test) => ({ path: test.path, reason: "Existing test filename or content references a changed source file; recommended only, not executed." }));
  const sourceChanges = files.filter((file) => extensions.some((ext) => file.filename.endsWith(ext)));
  const hasTests = testRecommendations.length > 0 || files.some((file) => /(?:^|\/)(?:__tests__\/|.*\.(?:test|spec)\.[cm]?[jt]sx?$)/.test(file.filename));
  if (sourceChanges.length && !hasTests) findings.push({ id: "test-coverage:unmapped", title: "No related tests were identified", severity: "moderate", category: "test-coverage", filePath: sourceChanges[0].filename, symbol: null, explanation: "The indexed test files did not reveal a likely test matching the changed source paths. Name-based discovery is incomplete and does not prove that coverage is absent.", consequence: "A regression may not be caught by an obvious focused test.", recommendation: "Add or identify a focused test for the changed behavior and run the repository test suite.", confidence: "low", confirmed: false, evidence: [`${sourceChanges.length} source file(s) changed`, `${tests.length} indexed test file(s) inspected`], impactedConsumers: [] });

  const diffAvailable = files.some((file) => Boolean(file.patch));
  const totalLines = files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
  const direct = [...impactDepth.values()].filter((depth) => depth === 1).length;
  const indirect = [...impactDepth.values()].filter((depth) => depth > 1).length;
  const breakings = findings.filter((f) => f.category === "breaking-change").length;
  const criticalNames = /auth|security|payment|billing|database|migration|session|permission/i;
  const criticality = files.some((f) => criticalNames.test(f.filename)) ? 75 : 15;
  const defaults = { changeComplexity: 0.2, dependencyImpact: 0.25, breakingChanges: 0.25, testCoverage: 0.15, criticality: 0.15 };
  const validWeights = Object.fromEntries(Object.entries(input.weights ?? {}).filter(([, weight]) => typeof weight === "number" && Number.isFinite(weight) && weight > 0));
  const configured = { ...defaults, ...validWeights };
  const sum = Object.values(configured).reduce((a, b) => a + b, 0) || 1;
  const weights = Object.fromEntries(Object.entries(configured).map(([key, value]) => [key, value / sum]));
  const scores = {
    changeComplexity: Math.min(100, 15 + files.length * 9 + Math.ceil(totalLines / 8)),
    dependencyImpact: Math.min(100, direct * 15 + indirect * 7),
    breakingChanges: Math.min(100, breakings * 55),
    testCoverage: hasTests ? 20 : 65,
    criticality,
  };
  const reasons = {
    changeComplexity: `${files.length} changed files and ${totalLines} additions/deletions`,
    dependencyImpact: `${direct} direct and ${indirect} additional indexed importer(s)`,
    breakingChanges: `${breakings} exported contract change(s) detected`,
    testCoverage: hasTests ? `${testRecommendations.length} likely relevant test(s) discovered` : "No likely related test was discovered; absence is uncertain",
    criticality: criticality > 15 ? "A changed path matches a critical subsystem name" : "No critical subsystem path pattern matched",
  };
  const factors: Record<string, RiskFactor> = Object.fromEntries(Object.entries(scores).map(([key, score]) => {
    const weight = weights[key as keyof typeof weights];
    return [key, { score, weight, contribution: Math.round(score * weight * 100) / 100, reason: reasons[key as keyof typeof reasons] }];
  }));
  const riskScore = Math.round(Object.values(factors).reduce((sum, factor) => sum + (factor.contribution ?? 0), 0));
  const classification = riskScore >= 71 ? "Critical" : riskScore >= 41 ? "High" : riskScore >= 21 ? "Moderate" : "Low";
  const uncertainty = [!diffAvailable ? "GitHub did not provide a patch for one or more changed files." : "", files.some((f) => !f.contents) ? "Base/head source was unavailable or not fetched for one or more changed files." : "", files.some((f) => (f.patch?.length ?? 0) > 12000) ? "A displayed patch was truncated to keep the saved report bounded." : "", "Risk values describe deterministic review signals, not a probability of production failure."].filter(Boolean);
  const counts = Object.fromEntries(["critical", "high", "moderate", "low"].map((severity) => [severity, findings.filter((f) => f.severity === severity).length]));
  const status = counts.critical ? "CRITICAL" : counts.high || breakings ? "HIGH RISK" : uncertainty.length > 1 || classification === "Moderate" || classification === "High" ? "REVIEW REQUIRED" : classification === "Low" ? "LOW RISK" : "REVIEW REQUIRED";
  const beforeMerge = [...new Set([...findings.filter((f) => f.severity === "high" || f.severity === "critical").map((f) => f.recommendation), ...testRecommendations.map((test) => `Run ${test.path}.`)])];
  const reportFiles = files.map((file) => ({ filename: file.filename, previous_filename: file.previous_filename, status: file.status, additions: file.additions, deletions: file.deletions, patch: file.patch?.slice(0, 12000), patchTruncated: Boolean(file.patch && file.patch.length > 12000) }));
  return { files: reportFiles, findings, testRecommendations, sourceFilesCompared: files.filter((file) => file.contents?.before != null && file.contents.after != null && extensions.some((ext) => file.filename.endsWith(ext))).length, risk: { score: riskScore, classification, factors, weights, uncertainty }, mergeReadiness: { status, complete: diffAvailable && files.every((f) => f.contents !== undefined) && !files.some((f) => (f.patch?.length ?? 0) > 12000), summary: status === "LOW RISK" ? "No significant compatibility issue was detected by the available checks. Review evidence and tests before approval." : `${status}: findings or incomplete evidence require developer review.`, beforeMerge, counts }, diffAvailable };
}

export function getPRSourcePaths(files: PullFile[]) {
  return files.flatMap((file) => [file.filename, file.previous_filename].filter((path): path is string => Boolean(path)));
}

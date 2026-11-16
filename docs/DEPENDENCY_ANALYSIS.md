# Dependency analysis

## Edge model

`file_dependencies` stores directed file-level imports as `sourcePath -> importedPath`. The TypeScript-aware extractor in `static-analysis.ts` handles relative imports, re-exports, common JS/TS extensions, index files, and the project's `@/` alias. External packages and unresolved/dynamic imports are omitted.

The report route reverses the stored edge direction to discover importers of changed files and renders a bounded graph. The PR analyzer performs a cycle-safe breadth-first reverse traversal (currently depth 8) and counts depth-one importers separately from deeper paths. A path relationship means a source file imports another file; it does not mean every exported symbol is consumed or that runtime behavior fails.

## Symbol specificity

Changed export checks inspect named import bindings in indexed direct importers where the relationship can be resolved. Namespace imports, dynamic imports, barrel/alias edge cases, generated code, external consumers, and package-manager relationships can be missed. Type-only, default, and re-export semantics are not fully modeled. Existing persisted edges reflect the indexed default-branch snapshot, not necessarily the current PR head.

## Cycles and scale

Visited-path tracking prevents cycles. API graph rendering caps traversal at four hops and 60 paths; static scoring caps at eight hops. Repository indexing limits the initial tree to 3,000 supported entries and works in batches. PR API listing is paginated, but the analyzer currently evaluates at most 100 changed files and fetches source for at most 20 TS/JS files to bound GitHub requests and memory. These are product limits, not proofs that omitted files are unaffected.

## Relationship confidence

An edge extracted from a parsed static import is a confirmed structural relationship within the indexed snapshot. The consequence of a PR change on that importer remains potential until compatibility is independently demonstrated. Unsupported or parse-failed modules contribute no edge; absence of an edge is not evidence of independence.

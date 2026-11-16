# Breaking-change detection

## Current support

The PR analyzer compares TS/JS exported declaration maps from fetched base and head source. It can flag removed exports; changed function/method parameter and return annotations; changed interface member text; changed type aliases/enums; and changed exported variable declarations. It specifically explains when an optional interface property becomes required. Findings remain potential and include before/after signature evidence.

Direct consumers come from the indexed import graph and named bindings where source resolution succeeds. Reports distinguish structural import evidence from compatibility conclusions.

## Example

```ts
// before
export interface Result { score: number }
// after
export interface Result { score: string }
```

The exported type shape differs, so the analyzer raises a potential contract finding and checks indexed importers of the module. It does not yet find every property access or prove which consumers perform arithmetic.

## False positives and negatives

Textual type-shape changes may be intentional or compatible; formatting, aliases, inferred types, and overload ordering can cause noisy findings. Dynamic imports, default/namespace imports, barrel re-exports, conditional exports, generated code, external package consumers, and runtime-only contracts may be missed. Body-only behavior changes are not currently semantically classified. A diff line change alone is not treated as a defect.

Supported parse inputs are TypeScript and JavaScript source. Unsupported languages and files over the source-fetch cap are reported as unexamined evidence. A full-program type check against the PR head is not implemented.

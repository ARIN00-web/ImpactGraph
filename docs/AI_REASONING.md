# AI reasoning and evidence

Gemini is used for natural-language explanation over retrieved repository chunks. Deterministic code handles GitHub retrieval, AST comparison, import-graph traversal, risk scoring, evidence-ID validation, and persistence.

The prompt frames repository text as untrusted and asks for structured JSON. Output shape and field types are validated. Each finding's evidence IDs are checked against the exact retrieved chunk IDs; only valid IDs are persisted as evidence, and a finding is grounded only when it cites at least one valid ID and no invalid IDs. This protects citation linkage, but does not prove that the model's inference is correct.

PR risk score is independent of Gemini and remains available when Gemini or retrieval is unavailable. In that case, limitations are saved and deterministic PR findings remain useful. For free-text change descriptions there is no deterministic PR risk score because an actual diff is absent.

The application does not intentionally place GitHub or Google credentials in prompts. Repository code and PR text can still contain prompt injection; the prompt instructs the model not to follow repository instructions, but this is not a formal security boundary. Consider data-sharing requirements before sending private source to a configured model provider. See [SECURITY.md](SECURITY.md).

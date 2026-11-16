const ALLOWED_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".md",
  ".mdx",
];

export function isAllowedFile(path: string) {
  return ALLOWED_EXTENSIONS.some((extension) =>
    path.toLowerCase().endsWith(extension)
  );
}

export function classifyFile(path: string) {
  const lowerPath = path.toLowerCase();

  if (lowerPath.endsWith(".md") || lowerPath.endsWith(".mdx")) {
    return "documentation" as const;
  }

  if (
    lowerPath.includes("test") ||
    lowerPath.includes("spec")
  ) {
    return "test" as const;
  }

  return "source" as const;
}
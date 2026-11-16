import assert from "node:assert/strict";
import { analyzePullRequest } from "@/lib/pr-impact";

const result = analyzePullRequest({
  files: [{
    filename: "src/domain/user.ts", status: "modified", additions: 2, deletions: 1,
    patch: "@@ -1,3 +1,4 @@\n export interface User {\n-  name?: string;\n+  name: string;\n }",
    contents: {
      before: "export interface User { id: number; name?: string }",
      after: "export interface User { id: number; name: string }",
    },
  }],
  sources: [
    { path: "src/domain/user.ts", content: "export interface User { id: number; name?: string }" },
    { path: "src/components/profile.tsx", content: "import { User } from '../domain/user';\nexport function profile(user: User) { return user.name }" },
    { path: "src/components/profile.test.ts", content: "import { User } from '../domain/user';\ntest('profile renders', () => ({ name: 'Ada' } satisfies User));" },
  ],
  edges: [{ sourcePath: "src/components/profile.tsx", importedPath: "src/domain/user.ts" }],
});

assert.equal(result.diffAvailable, true);
assert.equal(result.risk.score >= 0 && result.risk.score <= 100, true);
assert.equal(result.risk.classification, result.risk.score <= 20 ? "Low" : result.risk.score <= 40 ? "Moderate" : result.risk.score <= 70 ? "High" : "Critical");
assert.equal(result.findings.some((finding) => finding.title.includes("Required interface property")), true);
assert.equal(result.findings.find((finding) => finding.title.includes("Required interface property"))?.evidence.some((item) => item.includes("lines ")), true);
assert.equal(result.findings.some((finding) => finding.impactedConsumers.some((consumer) => consumer.path === "src/components/profile.tsx")), true);
assert.equal(result.testRecommendations.some((test) => test.path === "src/components/profile.test.ts"), true);
assert.equal(result.mergeReadiness.status === "LOW RISK", false);

const missingDiff = analyzePullRequest({ files: [{ filename: "src/a.ts", status: "modified", additions: 1, deletions: 0 }], sources: [], edges: [] });
assert.equal(missingDiff.mergeReadiness.complete, false);
assert.equal(missingDiff.risk.uncertainty.length > 0, true);

console.log("PR impact checks passed.");

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { documents } from "@/db/schema";
import {
  getIssues,
  getMergedPullRequests,
} from "@/lib/github";

type HistoricalSyncResult = {
  pullRequestsInserted: number;
  issuesInserted: number;
};

async function getExistingExternalIds(
  repositoryId: string,
  type: "pull_request" | "issue"
) {
  const rows = await db
    .select({ externalId: documents.externalId })
    .from(documents)
    .where(
      and(
        eq(documents.repositoryId, repositoryId),
        eq(documents.type, type)
      )
    );

  return new Set(
    rows
      .map((row) => row.externalId)
      .filter((externalId): externalId is string => Boolean(externalId))
  );
}

/** Inserts only missing historical documents; it never changes file documents. */
export async function syncHistoricalDocuments(
  repositoryId: string,
  owner: string,
  repo: string
): Promise<HistoricalSyncResult> {
  const [existingPullRequestIds, existingIssueIds] = await Promise.all([
    getExistingExternalIds(repositoryId, "pull_request"),
    getExistingExternalIds(repositoryId, "issue"),
  ]);

  const [pullRequests, issues] = await Promise.all([
    getMergedPullRequests(owner, repo),
    getIssues(owner, repo),
  ]);

  let pullRequestsInserted = 0;
  for (const pullRequest of pullRequests) {
    const details = pullRequest as typeof pullRequest & { changed_files?: number; additions?: number; deletions?: number };
    const externalId = String(pullRequest.number);
    if (existingPullRequestIds.has(externalId)) {
      continue;
    }

    await db.insert(documents).values({
      repositoryId,
      type: "pull_request",
      externalId,
      path: null,
      title: pullRequest.title ?? null,
      content: pullRequest.body ?? "",
      sha: null,
      metadata: {
        htmlUrl: pullRequest.html_url,
        changedFiles: details.changed_files,
        additions: details.additions,
        deletions: details.deletions,
      },
    });
    existingPullRequestIds.add(externalId);
    pullRequestsInserted += 1;
  }

  let issuesInserted = 0;
  for (const issue of issues) {
    const externalId = String(issue.number);
    if (existingIssueIds.has(externalId)) {
      continue;
    }

    await db.insert(documents).values({
      repositoryId,
      type: "issue",
      externalId,
      path: null,
      title: issue.title ?? null,
      content: issue.body ?? "",
      sha: null,
      metadata: {
        labels: issue.labels,
        htmlUrl: issue.html_url,
      },
    });
    existingIssueIds.add(externalId);
    issuesInserted += 1;
  }

  return { pullRequestsInserted, issuesInserted };
}

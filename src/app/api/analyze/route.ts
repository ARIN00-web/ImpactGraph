
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  analyses,
  evidence,
  findings,
  documents,
  fileDependencies,
  repositories,
} from "@/db/schema";

import { retrieveRelevantChunks } from "@/lib/retrieval";
import { analyzeChange } from "@/lib/analysis";
import { requireUser } from "@/lib/auth";
import { getFileText, getPullRequest, getPullRequestCommits, getPullRequestFiles } from "@/lib/github";
import { verifyFinding } from "@/lib/grounding";
import { analyzePullRequest, type PullFile } from "@/lib/pr-impact";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const repositoryId = body?.repositoryId;
    const inputType = body?.inputType;
    const description = body?.description;
    const requestedPrNumber = body?.prNumber;

    if (
      typeof repositoryId !== "string" ||
      !repositoryId.trim()
    ) {
      return NextResponse.json(
        { error: "repositoryId is required" },
        { status: 400 }
      );
    }

    if (
      inputType !== "description" &&
      inputType !== "pr"
    ) {
      return NextResponse.json(
        { error: "inputType must be 'description' or 'pr'" },
        { status: 400 }
      );
    }

    if (inputType === "description" && (typeof description !== "string" || !description.trim())) {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 }
      );
    }

    const prNumber = inputType === "pr" && Number.isInteger(Number(requestedPrNumber)) && Number(requestedPrNumber) >= 1 ? Number(requestedPrNumber) : null;
    if (inputType === "pr" && prNumber === null) {
      return NextResponse.json({ error: "A valid pull request number is required" }, { status: 400 });
    }

    const [repository] = await db
      .select()
      .from(repositories)
      .where(and(eq(repositories.id, repositoryId), eq(repositories.userId, user.id)))
      .limit(1);

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    if (repository.indexingStatus !== "ready") {
      return NextResponse.json(
        {
          error:
            "Repository must finish indexing before analysis",
        },
        { status: 409 }
      );
    }

    let changeText = typeof description === "string" ? description.trim() : "";
    let changedPaths: string[] = [];
    let totalChangedFiles = 0;
    let prDetails: { title: string; author: string | null; url: string; baseBranch: string; headBranch: string; baseSha: string; headSha: string; commitCount: number; commits: Array<{ sha: string; message: string; author: string | null }>; commitsMayBeTruncated: boolean } | null = null;
    let prImpact: ReturnType<typeof analyzePullRequest> | null = null;
    if (inputType === "pr" && prNumber !== null) {
      const [pullRequest, files, commits] = await Promise.all([
        getPullRequest(repository.owner, repository.name, prNumber),
        getPullRequestFiles(repository.owner, repository.name, prNumber),
        getPullRequestCommits(repository.owner, repository.name, prNumber),
      ]);
      prDetails = {
        title: pullRequest.title,
        author: pullRequest.user?.login ?? null,
        url: pullRequest.html_url,
        baseBranch: pullRequest.base.ref,
        headBranch: pullRequest.head.ref,
        baseSha: pullRequest.base.sha,
        headSha: pullRequest.head.sha,
        commitCount: pullRequest.commits,
        commits: commits.map((commit) => ({ sha: commit.sha, message: commit.commit.message.slice(0, 300), author: commit.author?.login ?? commit.commit.author?.name ?? null })),
        commitsMayBeTruncated: pullRequest.commits > commits.length,
      };
      changedPaths = files.flatMap((file) => [file.filename, file.previous_filename].filter((path): path is string => Boolean(path)));
      totalChangedFiles = files.length;
      const listedFiles = files.slice(0, 100);
      let sourceFetches = 0;
      const withContents: PullFile[] = await Promise.all(listedFiles.map(async (file) => {
        const supported = /\.(?:[cm]?[jt]sx?)$/i.test(file.filename);
        const fetchSource = supported && sourceFetches < 20;
        if (fetchSource) sourceFetches += 1;
        const [before, after] = fetchSource ? await Promise.all([
          file.status === "added" ? Promise.resolve(null) : getFileText(repository.owner, repository.name, file.previous_filename ?? file.filename, pullRequest.base.sha),
          file.status === "removed" ? Promise.resolve(null) : getFileText(repository.owner, repository.name, file.filename, pullRequest.head.sha),
        ]) : [null, null];
        return { filename: file.filename, previous_filename: file.previous_filename, status: file.status, additions: file.additions, deletions: file.deletions, patch: file.patch, contents: fetchSource ? { before, after } : undefined };
      }));
      const sourceRows = await db.select({ path: documents.path, content: documents.content }).from(documents)
        .where(and(eq(documents.repositoryId, repositoryId), eq(documents.currentRevision, true))).limit(10000);
      const edges = await db.select({ sourcePath: fileDependencies.sourcePath, importedPath: fileDependencies.importedPath })
        .from(fileDependencies).where(eq(fileDependencies.repositoryId, repositoryId));
      const sources = sourceRows.filter((row): row is { path: string; content: string } => Boolean(row.path));
      prImpact = analyzePullRequest({
        files: withContents,
        sources,
        edges,
        weights: {
          changeComplexity: process.env.RISK_WEIGHT_COMPLEXITY ? Number(process.env.RISK_WEIGHT_COMPLEXITY) : undefined,
          dependencyImpact: process.env.RISK_WEIGHT_DEPENDENCIES ? Number(process.env.RISK_WEIGHT_DEPENDENCIES) : undefined,
          breakingChanges: process.env.RISK_WEIGHT_BREAKING ? Number(process.env.RISK_WEIGHT_BREAKING) : undefined,
          testCoverage: process.env.RISK_WEIGHT_TESTS ? Number(process.env.RISK_WEIGHT_TESTS) : undefined,
          criticality: process.env.RISK_WEIGHT_CRITICALITY ? Number(process.env.RISK_WEIGHT_CRITICALITY) : undefined,
        },
      });
      const patchText = withContents.filter((file) => file.patch).map((file) => `${file.filename}\n${file.patch}`).join("\n\n").slice(0, 50000);
      changeText = [pullRequest.title, pullRequest.body, `Base: ${pullRequest.base.ref} (${pullRequest.base.sha})`, `Head: ${pullRequest.head.ref} (${pullRequest.head.sha})`, `Changed files:\n${changedPaths.join("\n")}`, patchText ? `Unified diff:\n${patchText}` : "GitHub did not provide unified diff patches for these files."].filter(Boolean).join("\n\n");
    }
    if (!changeText) return NextResponse.json({ error: "The change description is empty" }, { status: 400 });

    let retrievedChunks: Awaited<ReturnType<typeof retrieveRelevantChunks>> = [];
    let modelFailure: string | null = null;
    try { retrievedChunks = await retrieveRelevantChunks({ repositoryId, query: changeText, paths: changedPaths }); }
    catch (error) {
      modelFailure = error instanceof Error ? error.message : "Retrieval unavailable";
      if (!prImpact) throw error;
    }

    if (retrievedChunks.length === 0 && !prImpact) {
      return NextResponse.json(
        {
          error:
            "No relevant evidence was found for this change",
        },
        { status: 422 }
      );
    }

    const llmEvidence = retrievedChunks.map((chunk) => ({
      id: chunk.chunkId,
      content: chunk.content,
      path: chunk.path,
      chunkType: chunk.chunkType,
    }));

    let result: Awaited<ReturnType<typeof analyzeChange>> | null = null;
    if (retrievedChunks.length) {
      try { result = await analyzeChange(changeText, llmEvidence); }
      catch (error) { modelFailure = error instanceof Error ? error.message : "AI explanation unavailable"; }
    }
    const score = prImpact?.risk.score ?? null;
    const assessment = result?.assessment ?? prImpact?.mergeReadiness.summary ?? "AI explanation completed, but no deterministic score is available without a live pull request diff.";
    const limitations = [...(result?.limitations ?? []), ...(prImpact?.risk.uncertainty ?? []), ...(modelFailure ? [`AI or retrieval unavailable: ${modelFailure}`] : [])];

    const [analysis] = await db
      .insert(analyses)
      .values({
        repositoryId,
        inputType,
        inputText: changeText,
        prNumber,
        riskScore: score,
        summary: assessment,
        reviewDetails: {
          assessment,
          strengths: result?.strengths ?? [],
          recommendations: [...(result?.recommendations ?? []), ...(prImpact?.mergeReadiness.beforeMerge ?? [])],
          limitations,
          prImpact,
          prDetails,
          mergeReadiness: prImpact?.mergeReadiness ?? null,
          risk: prImpact?.risk ?? null,
          github: inputType === "pr" ? { filesReturned: prImpact?.files.length ?? 0, totalChangedFiles, sourceFilesCompared: prImpact?.sourceFilesCompared ?? 0, truncatedAt100Files: totalChangedFiles > (prImpact?.files.length ?? 0) } : null,
          changedPaths,
        },
      })
      .returning();

    const retrievedById = new Map(
      retrievedChunks.map((chunk) => [
        chunk.chunkId,
        chunk,
      ])
    );

    const createdFindings = [];

    for (const finding of result?.findings ?? []) {
      const grounding = verifyFinding(finding, new Set(retrievedById.keys()));
      const validEvidenceIds = grounding.validEvidenceIds;

      const [savedFinding] = await db
        .insert(findings)
        .values({
          analysisId: analysis.id,
          component: finding.component,
          filePath: finding.file_path,
          impactType: finding.impact_type,
          confidence: finding.confidence,
          reason: finding.reason,
          verified: grounding.verified,
        })
        .returning();

      for (const evidenceId of validEvidenceIds) {
        const chunk = retrievedById.get(evidenceId)!;

        await db.insert(evidence).values({
          findingId: savedFinding.id,
          documentId: chunk.documentId,
          chunkId: chunk.chunkId,
          relevanceScore: chunk.score,
          snippet: chunk.content.slice(0, 500),
        });
      }

      createdFindings.push({
        ...savedFinding,
        evidenceIds: validEvidenceIds,
      });
    }

    return NextResponse.json(
      {
        analysisId: analysis.id,
        analysis,
        findings: createdFindings,
        retrievedEvidence: retrievedChunks,
        riskScore: score,
        mergeReadiness: prImpact?.mergeReadiness ?? null,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/analyze failed:", error);
    const githubStatus = typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : 0;
    if (githubStatus === 403 || githubStatus === 429) {
      return NextResponse.json({ error: "GitHub rate limit or repository permission prevented PR retrieval. Check the token's repository access and rate limit, then retry." }, { status: 429 });
    }
    if (githubStatus === 404) return NextResponse.json({ error: "GitHub could not find this pull request, repository, or requested base/head file. The branch may have been deleted or access may be missing." }, { status: 502 });
    if (githubStatus >= 500) return NextResponse.json({ error: "GitHub is temporarily unavailable. No analysis was saved; retry when the GitHub API recovers." }, { status: 502 });

    return NextResponse.json(
      { error: "Failed to analyze change" },
      { status: 500 }
    );
  }
}

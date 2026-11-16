import { Octokit } from "@octokit/rest";

export const octokit = new Octokit({
  ...(process.env.GITHUB_TOKEN ? { auth: process.env.GITHUB_TOKEN } : {}),
  userAgent: "ImpactGraph",
});

export function parseGitHubUrl(input: string) {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Invalid URL");
  }

  if (
    url.hostname !== "github.com" &&
    url.hostname !== "www.github.com"
  ) {
    throw new Error("URL must be a GitHub repository URL");
  }

  const parts = url.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/\.git$/, ""));

  if (parts.length !== 2) {
    throw new Error(
      "URL must look like https://github.com/owner/repository"
    );
  }

  const [owner, repo] = parts;

  return {
    owner,
    repo,
    normalizedUrl: `https://github.com/${owner}/${repo}`,
  };
}

export async function getGitHubRepository(
  owner: string,
  repo: string
) {
  const response = await octokit.rest.repos.get({
    owner,
    repo,
  });

  return response.data;
}

export async function getRepositoryTree(
  owner: string,
  repo: string,
  branch: string
) {
  const response = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: "true",
  });

  return response.data.tree;
}

export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string
) {
  const response = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
    ref,
  });

  return response.data;
}

export async function getFileText(owner: string, repo: string, path: string, ref: string): Promise<string | null> {
  try {
    const content = await getFileContent(owner, repo, path, ref);
    if (Array.isArray(content) || content.type !== "file" || content.encoding !== "base64" || !content.content) return null;
    return Buffer.from(content.content, "base64").toString("utf8");
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status === 404) return null;
    throw error;
  }
}

export async function getMergedPullRequests(
  owner: string,
  repo: string
) {
  const pullRequests = [];

  for (let page = 1; page <= 2; page++) {
    const response = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: 100,
      page,
    });

    const merged = response.data.filter(
      (pullRequest) => pullRequest.merged_at !== null
    );

    pullRequests.push(...merged);

    if (response.data.length < 100) {
      break;
    }
  }

  return pullRequests.slice(0, 200);
}

export async function getIssues(
  owner: string,
  repo: string
) {
  const issues = [];

  for (let page = 1; page <= 2; page++) {
    const response = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: 100,
      page,
    });

    const actualIssues = response.data.filter(
      (issue) => !issue.pull_request
    );

    issues.push(...actualIssues);

    if (response.data.length < 100) {
      break;
    }
  }

  return issues.slice(0, 200);
}

export async function getPullRequest(
  owner: string,
  repo: string,
  pullNumber: number
) {
  const response = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return response.data;
}

export async function getOpenPullRequests(owner: string, repo: string) {
  const response = await octokit.rest.pulls.list({ owner, repo, state: "open", per_page: 50, sort: "updated", direction: "desc" });
  return response.data;
}

export async function getPullRequestFiles(owner: string, repo: string, pullNumber: number) {
  return octokit.paginate(octokit.rest.pulls.listFiles, {
    owner, repo, pull_number: pullNumber, per_page: 100,
  });
}

export async function getPullRequestCommits(owner: string, repo: string, pullNumber: number) {
  const commits = [];
  for (let page = 1; page <= 2; page += 1) {
    const response = await octokit.rest.pulls.listCommits({ owner, repo, pull_number: pullNumber, per_page: 100, page });
    commits.push(...response.data);
    if (response.data.length < 100) break;
  }
  return commits;
}

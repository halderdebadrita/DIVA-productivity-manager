import "server-only";
import { env } from "../env";
import type { GithubData } from "../types";

export function parseRepo(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.trim().match(/^https?:\/\/(www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(\.git)?(\/.*)?$/i);
  return m ? `${m[2]}/${m[3]}` : null;
}

export class GithubError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

// In-memory ETag cache: GitHub doesn't count "304 Not Modified" answers against the rate limit.
const g = globalThis as unknown as { __ghCache?: Map<string, { etag: string; body: unknown }>; __ghResetAt?: number };
g.__ghCache ??= new Map();

function rateLimited(): string | null {
  if (g.__ghResetAt && Date.now() < g.__ghResetAt) {
    const t = new Date(g.__ghResetAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    return env.githubToken
      ? `GitHub rate limit reached — resets at ${t}`
      : `GitHub's free limit (60 requests/hour without a token) is used up — resets at ${t}. Add GITHUB_TOKEN to .env.local for 5,000/hour.`;
  }
  return null;
}

async function gh<T>(path: string): Promise<T> {
  const limited = rateLimited();
  if (limited) throw new GithubError(limited, 403);
  const cached = g.__ghCache!.get(path);
  const res = await fetch(`${env.githubApiUrl}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "diva-productivity",
      ...(env.githubToken ? { authorization: `Bearer ${env.githubToken}` } : {}),
      ...(cached ? { "if-none-match": cached.etag } : {}),
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (res.status === 304 && cached) return cached.body as T;
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    g.__ghResetAt = reset ? reset * 1000 : Date.now() + 15 * 60e3;
    throw new GithubError(rateLimited()!, res.status);
  }
  if (res.status === 404) throw new GithubError("Repository not found (or it is private and no GITHUB_TOKEN is configured)", 404);
  if (res.status === 401) throw new GithubError(env.githubToken ? "GitHub rejected the server token (401) — check GITHUB_TOKEN" : "GitHub refused the request (401) — the network or a proxy may be blocking api.github.com", 401);
  if (res.status === 403 || res.status === 429) throw new GithubError("GitHub temporarily refused the request — try again in a few minutes", res.status);
  if (!res.ok) throw new GithubError(`GitHub returned ${res.status}`, res.status);
  const body = (await res.json()) as T;
  const etag = res.headers.get("etag");
  if (etag) {
    g.__ghCache!.set(path, { etag, body });
    if (g.__ghCache!.size > 500) g.__ghCache!.delete(g.__ghCache!.keys().next().value!);
  }
  return body;
}

/** Fetches public metadata (and private, if the server token allows). Never fabricates data. */
export async function fetchRepo(fullName: string): Promise<GithubData> {
  type Repo = { full_name: string; description: string | null; html_url: string; default_branch: string; stargazers_count: number; forks_count: number; open_issues_count: number; language: string | null; pushed_at: string | null; private: boolean };
  type Commit = { sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } | null } };
  type Release = { name: string | null; tag_name: string; html_url: string; published_at: string | null };
  type Issue = { number: number; title: string; html_url: string; state: string; pull_request?: unknown };
  const repo = await gh<Repo>(`/repos/${fullName}`);
  const [commits, releases, issues] = await Promise.all([
    gh<Commit[]>(`/repos/${fullName}/commits?per_page=6`).catch(() => [] as Commit[]),
    gh<Release[]>(`/repos/${fullName}/releases?per_page=3`).catch(() => [] as Release[]),
    gh<Issue[]>(`/repos/${fullName}/issues?state=open&per_page=8`).catch(() => [] as Issue[]),
  ]);
  return {
    full_name: repo.full_name,
    description: repo.description,
    html_url: repo.html_url,
    default_branch: repo.default_branch,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    open_issues: repo.open_issues_count,
    language: repo.language,
    pushed_at: repo.pushed_at,
    private: repo.private,
    commits: commits.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split("\n")[0].slice(0, 140),
      author: c.commit.author?.name ?? null,
      date: c.commit.author?.date ?? null,
      url: c.html_url,
    })),
    releases: releases.map((r) => ({ name: r.name || r.tag_name, tag: r.tag_name, url: r.html_url, published_at: r.published_at })),
    issues: issues.filter((i) => !i.pull_request).slice(0, 5).map((i) => ({ number: i.number, title: i.title, url: i.html_url, state: i.state })),
  };
}

// ---------------------------------------------------------------------------
// Account-level access: list your repositories, and deep context for analysis
// ---------------------------------------------------------------------------

export interface RepoSummary {
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  pushed_at: string | null;
  created_at: string | null;
  fork: boolean;
  archived: boolean;
  private: boolean;
  stars: number;
}

type RawRepo = {
  full_name: string; name: string; description: string | null; html_url: string; homepage: string | null; language: string | null;
  pushed_at: string | null; created_at: string | null; fork: boolean; archived: boolean; private: boolean; stargazers_count: number;
};
const toSummary = (r: RawRepo): RepoSummary => ({
  full_name: r.full_name, name: r.name, description: r.description, html_url: r.html_url, homepage: r.homepage || null, language: r.language,
  pushed_at: r.pushed_at, created_at: r.created_at, fork: r.fork, archived: r.archived, private: r.private, stars: r.stargazers_count,
});

export const githubUserFromUrl = (url: string | null | undefined) => {
  const m = url?.trim().match(/^https?:\/\/(www\.)?github\.com\/([\w-]+)\/?$/i);
  return m ? m[2] : null;
};

/** Who the server token belongs to (null without a token). */
export async function tokenLogin(): Promise<string | null> {
  if (!env.githubToken) return null;
  const u = await gh<{ login: string }>("/user");
  return u.login;
}

/** Your repos: all you own/collaborate on with a token, otherwise the public repos of `username`. */
export async function listRepos(username: string | null): Promise<{ login: string; repos: RepoSummary[]; includesPrivate: boolean }> {
  const viaToken = await tokenLogin().catch(() => null);
  const login = viaToken ?? username;
  if (!login) throw new GithubError("Add your GitHub profile link in Settings → Quick links (https://github.com/<username>)");
  const repos: RawRepo[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = viaToken
      ? await gh<RawRepo[]>(`/user/repos?per_page=100&page=${page}&sort=pushed&affiliation=owner,collaborator`)
      : await gh<RawRepo[]>(`/users/${encodeURIComponent(login)}/repos?per_page=100&page=${page}&sort=pushed&type=owner`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return { login, repos: repos.map(toSummary), includesPrivate: Boolean(viaToken) };
}

async function ghRaw(path: string, maxChars: number): Promise<string | null> {
  if (rateLimited()) return null;
  const res = await fetch(`${env.githubApiUrl}${path}`, {
    headers: {
      accept: "application/vnd.github.raw+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "diva-productivity",
      ...(env.githubToken ? { authorization: `Bearer ${env.githubToken}` } : {}),
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.text()).slice(0, maxChars);
}

export interface RepoContext {
  data: GithubData;
  readme: string | null;
  tree: string[];
  packageJson: string | null;
  commitLog: string[];
  issueTitles: { open: string[]; closedCount: number };
}

/** Everything the AI needs to judge what's built and what's left. */
export async function fetchRepoContext(fullName: string): Promise<RepoContext> {
  type Repo = { full_name: string; description: string | null; html_url: string; default_branch: string; stargazers_count: number; forks_count: number; open_issues_count: number; language: string | null; pushed_at: string | null; private: boolean; homepage: string | null; created_at: string | null; topics?: string[] };
  type Tree = { tree: { path: string; type: string }[]; truncated: boolean };
  type Commit = { sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } | null } };
  type Issue = { number: number; title: string; html_url: string; state: string; pull_request?: unknown };
  // ~6 requests per analysis (and repeat runs are mostly free 304s)
  const repo = await gh<Repo>(`/repos/${fullName}`);
  const [languages, readme, tree, commits, issues, pkg] = await Promise.all([
    gh<Record<string, number>>(`/repos/${fullName}/languages`).catch(() => ({})),
    ghRaw(`/repos/${fullName}/readme`, 9000),
    gh<Tree>(`/repos/${fullName}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`).catch(() => ({ tree: [], truncated: false })),
    gh<Commit[]>(`/repos/${fullName}/commits?per_page=40`).catch(() => [] as Commit[]),
    gh<Issue[]>(`/repos/${fullName}/issues?state=all&per_page=60`).catch(() => [] as Issue[]),
    ghRaw(`/repos/${fullName}/contents/package.json`, 4000),
  ]);
  const skip = /(^|\/)(node_modules|\.git|dist|build|\.next|vendor|__pycache__|\.venv|venv|coverage)(\/|$)/;
  const paths = tree.tree.filter((t) => !skip.test(t.path)).map((t) => (t.type === "tree" ? `${t.path}/` : t.path));
  const realIssues = issues.filter((i) => !i.pull_request);
  const data: GithubData = {
    full_name: repo.full_name,
    description: repo.description,
    html_url: repo.html_url,
    default_branch: repo.default_branch,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    open_issues: repo.open_issues_count,
    language: repo.language,
    pushed_at: repo.pushed_at,
    private: repo.private,
    commits: commits.slice(0, 6).map((c) => ({ sha: c.sha.slice(0, 7), message: c.commit.message.split("\n")[0].slice(0, 140), author: c.commit.author?.name ?? null, date: c.commit.author?.date ?? null, url: c.html_url })),
    releases: [],
    issues: realIssues.filter((i) => i.state === "open").slice(0, 5).map((i) => ({ number: i.number, title: i.title, url: i.html_url, state: i.state })),
    languages,
    homepage: repo.homepage || null,
    created_at: repo.created_at,
    topics: repo.topics ?? [],
  };
  return {
    data,
    readme,
    tree: paths.slice(0, 350),
    packageJson: pkg,
    commitLog: commits.map((c) => `${c.commit.author?.date?.slice(0, 10) ?? ""} ${c.commit.message.split("\n")[0].slice(0, 120)}`),
    issueTitles: { open: realIssues.filter((i) => i.state === "open").map((i) => i.title.slice(0, 120)).slice(0, 20), closedCount: realIssues.filter((i) => i.state === "closed").length },
  };
}

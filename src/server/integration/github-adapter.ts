import { execFile } from "node:child_process";

export type RepositoryInfo = { nameWithOwner: string; defaultBranch: string };
export type PullRequestInfo = { url: string; state: "OPEN" | "MERGED" | "CLOSED"; mergeCommit: string | null };

export interface GitHubAdapter {
  preflight(): Promise<void>;
  repositoryInfo(): Promise<RepositoryInfo>;
  push(branch: string, commit: string): Promise<void>;
  ensurePullRequest(input: { branch: string; base: string; title: string; body: string }): Promise<PullRequestInfo>;
  mergePullRequest(url: string): Promise<PullRequestInfo>;
}

function command(cwd: string, executable: string, args: readonly string[], timeout = 2 * 60_000) {
  return new Promise<string>((resolvePromise, rejectPromise) => {
    execFile(executable, [...args], { cwd, encoding: "utf8", timeout, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        rejectPromise(new Error(`${executable} ${args[0] ?? ""} failed: ${(stderr || stdout).slice(-1_500)}`));
        return;
      }
      resolvePromise(stdout.trim());
    });
  });
}

function parsePr(source: string): PullRequestInfo {
  const value = JSON.parse(source) as { url: string; state: "OPEN" | "MERGED" | "CLOSED"; mergeCommit?: { oid?: string } | null };
  return { url: value.url, state: value.state, mergeCommit: value.mergeCommit?.oid ?? null };
}

export class CliGitHubAdapter implements GitHubAdapter {
  constructor(private readonly repositoryPath: string) {}

  async preflight() {
    await command(this.repositoryPath, "gh", ["auth", "status"]);
    await command(this.repositoryPath, "git", ["remote", "get-url", "origin"]);
  }

  async repositoryInfo() {
    const value = JSON.parse(await command(this.repositoryPath, "gh", ["repo", "view", "--json", "nameWithOwner,defaultBranchRef"])) as {
      nameWithOwner: string;
      defaultBranchRef: { name: string };
    };
    return { nameWithOwner: value.nameWithOwner, defaultBranch: value.defaultBranchRef.name };
  }

  async push(branch: string, commit: string) {
    if (!/^aideas\/[a-z0-9._/-]+$/u.test(branch) || !/^[a-f0-9]{40,64}$/u.test(commit)) throw new Error("Git integration identifiers are invalid.");
    const local = await command(this.repositoryPath, "git", ["rev-parse", branch]);
    if (local !== commit) throw new Error("Local integration branch does not match EvidenceBundle commit.");
    await command(this.repositoryPath, "git", ["push", "--set-upstream", "origin", `${branch}:${branch}`], 5 * 60_000);
    const remote = await command(this.repositoryPath, "git", ["ls-remote", "--heads", "origin", `refs/heads/${branch}`]);
    if (!remote.startsWith(commit)) throw new Error("Remote branch readback does not match EvidenceBundle commit.");
  }

  async ensurePullRequest(input: { branch: string; base: string; title: string; body: string }) {
    const existing = JSON.parse(await command(this.repositoryPath, "gh", ["pr", "list", "--head", input.branch, "--state", "all", "--limit", "1", "--json", "url,state,mergeCommit"])) as Array<{ url: string; state: "OPEN" | "MERGED" | "CLOSED"; mergeCommit?: { oid?: string } | null }>;
    if (existing[0]) return parsePr(JSON.stringify(existing[0]));
    const url = await command(this.repositoryPath, "gh", ["pr", "create", "--base", input.base, "--head", input.branch, "--title", input.title, "--body", input.body]);
    return parsePr(await command(this.repositoryPath, "gh", ["pr", "view", url, "--json", "url,state,mergeCommit"]));
  }

  async mergePullRequest(url: string) {
    const before = parsePr(await command(this.repositoryPath, "gh", ["pr", "view", url, "--json", "url,state,mergeCommit"]));
    if (before.state !== "MERGED") await command(this.repositoryPath, "gh", ["pr", "merge", url, "--merge"], 5 * 60_000);
    const after = parsePr(await command(this.repositoryPath, "gh", ["pr", "view", url, "--json", "url,state,mergeCommit"]));
    if (after.state !== "MERGED" || !after.mergeCommit) throw new Error("GitHub merge readback is not terminal.");
    return after;
  }
}

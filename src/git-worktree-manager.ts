import { mkdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { spawn } from "node:child_process";

export interface GitWorkspace {
  workspaceId: string;
  contractId: string;
  root: string;
  repoPath: string;
  baseRef: string;
  branchName: string | null;
}

export class GitWorktreeManager {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async create(params: {
    repoPath: string;
    workspaceId: string;
    contractId: string;
    baseRef: string;
    branchName?: string;
  }): Promise<GitWorkspace> {
    const contractRoot = resolve(this.root, params.contractId);
    await mkdir(contractRoot, { recursive: true });
    const root = resolve(contractRoot, params.workspaceId);
    this.assertManaged(root);

    const args = ["worktree", "add"];
    if (params.branchName) args.push("-b", params.branchName);
    else args.push("--detach");
    args.push(root, params.baseRef);

    await runGit(params.repoPath, args);
    return {
      workspaceId: params.workspaceId,
      contractId: params.contractId,
      root,
      repoPath: resolve(params.repoPath),
      baseRef: params.baseRef,
      branchName: params.branchName ?? null,
    };
  }

  async destroy(workspace: GitWorkspace): Promise<void> {
    this.assertManaged(workspace.root);
    await runGit(workspace.repoPath, ["worktree", "remove", "--force", workspace.root]);
  }

  private assertManaged(path: string): void {
    const rel = relative(this.root, resolve(path));
    if (rel === "" || rel.startsWith("..") || resolve(this.root, rel) !== resolve(path)) {
      throw new Error("workspace_outside_managed_root");
    }
  }
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  return await new Promise<string>((resolvePromise, reject) => {
    const child = spawn("git", args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolvePromise(stdout.trim());
      else reject(new Error(stderr.trim() || `git_exit_${code}`));
    });
  });
}

import assert from "node:assert/strict";
import { access, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { JsonCheckpointStore } from "../src/checkpoint-store.ts";
import { GitWorktreeManager } from "../src/git-worktree-manager.ts";
import { FileLockManager } from "../src/lock-manager.ts";

test("lock manager grants one owner at a time and rejects foreign release", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-locks-"));
  const locks = new FileLockManager(root);

  const first = await locks.acquire("target:A", "owner-1", 10_000);
  assert.equal(first.acquired, true);

  const second = await locks.acquire("target:A", "owner-2", 10_000);
  assert.equal(second.acquired, false);
  assert.equal(second.lease.ownerId, "owner-1");

  await assert.rejects(() => locks.release("target:A", "owner-2"), /lock_owner_mismatch/);
  assert.equal(await locks.release("target:A", "owner-1"), true);
});

test("checkpoint store persists invocation progress across process-level restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-checkpoints-"));
  const store = new JsonCheckpointStore(root);

  await store.save({
    invocationId: "I1",
    agentInstanceId: "A1",
    terminalSessionId: "T1",
    contractId: "C1",
    roleId: "executor",
    workspaceId: "W1",
    runtimeId: "R1",
    status: "running",
    contextManifestHash: "H1",
    updatedAt: new Date().toISOString(),
  });

  const restarted = new JsonCheckpointStore(root);
  const running = await restarted.load("I1");
  assert.equal(running?.status, "running");
  assert.equal(running?.agentInstanceId, "A1");
  assert.equal(running?.terminalSessionId, "T1");

  await restarted.save({
    invocationId: "I1",
    agentInstanceId: "A1",
    terminalSessionId: "T1",
    contractId: "C1",
    roleId: "executor",
    workspaceId: "W1",
    runtimeId: "R1",
    status: "completed",
    contextManifestHash: "H1",
    updatedAt: new Date().toISOString(),
    resultRef: "artifact:R1",
  });

  assert.equal((await store.load("I1"))?.resultRef, "artifact:R1");
});

test("git worktree manager creates a real isolated branch workspace and removes only the workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-git-worktree-"));
  const repo = join(root, "repo");
  const workspaceRoot = join(root, "workspaces");

  await run("git", ["init", "-q", repo], root);
  await run("git", ["config", "user.email", "test@example.com"], repo);
  await run("git", ["config", "user.name", "Morrow Test"], repo);
  await writeFile(join(repo, "README.md"), "base\n", "utf8");
  await run("git", ["add", "README.md"], repo);
  await run("git", ["commit", "-qm", "base"], repo);

  const manager = new GitWorktreeManager(workspaceRoot);
  const workspace = await manager.create({
    repoPath: repo,
    contractId: "C1",
    workspaceId: "executor-W1",
    baseRef: "HEAD",
    branchName: "contract/C1-executor",
    roleId: "executor",
  });

  await access(join(workspace.root, "README.md"));
  assert.equal(await run("git", ["branch", "--show-current"], workspace.root), "contract/C1-executor");
  assert.equal(workspace.roleId, "executor");

  await manager.destroy(workspace);
  await assert.rejects(access(workspace.root));
  assert.equal(await run("git", ["rev-parse", "--is-inside-work-tree"], repo), "true");
});

async function run(command: string, args: string[], cwd: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `${command}_exit_${code}`));
    });
  });
}

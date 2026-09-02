import assert from "node:assert/strict";
import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { LocalWorkspaceManager } from "../src/workspace-manager.ts";

test("workspace manager accepts and removes a legitimate Windows-safe workspace path", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-workspaces-cross-platform-"));
  const manager = new LocalWorkspaceManager(root);
  const workspace = await manager.create({
    workspaceId: "W1",
    contractId: "C1",
    roleId: "executor",
  });

  await access(workspace.root);
  await manager.destroy(workspace);
  await assert.rejects(access(workspace.root));
});

test("workspace manager rejects traversal-like identifiers before touching disk", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-workspaces-traversal-"));
  const manager = new LocalWorkspaceManager(root);

  await assert.rejects(
    manager.create({
      workspaceId: "../outside",
      contractId: "C1",
      roleId: "executor",
    }),
    /invalid_workspace_id/,
  );

  await assert.rejects(
    manager.create({
      workspaceId: "W1",
      contractId: "..\\outside",
      roleId: "executor",
    }),
    /invalid_contract_id/,
  );
});

test("workspace manager refuses a forged descriptor even when it points under the managed root", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-workspaces-forged-"));
  const manager = new LocalWorkspaceManager(root);
  const workspace = await manager.create({
    workspaceId: "W1",
    contractId: "C1",
    roleId: "executor",
  });

  await assert.rejects(
    manager.destroy({
      ...workspace,
      root: join(root, "C1"),
    }),
    /workspace_outside_managed_root/,
  );

  await access(workspace.root);
  await manager.destroy(workspace);
});

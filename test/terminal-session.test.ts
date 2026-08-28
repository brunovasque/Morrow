import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  TerminalSessionManager,
  ManagedTerminalRuntimeAdapter,
  type TerminalSessionEvent,
  type TerminalSessionRequest,
} from "../src/terminal-session.ts";
import { LocalWorkspaceManager, type WorkspaceDescriptor } from "../src/workspace-manager.ts";

async function harness() {
  const root = await mkdtemp(join(tmpdir(), "morrow-terminal-sessions-"));
  const workspaceRoot = join(root, "managed-workspaces");
  const workspaces = new LocalWorkspaceManager(workspaceRoot);
  const terminals = new TerminalSessionManager(workspaceRoot);
  return { root, workspaceRoot, workspaces, terminals };
}

function request(
  workspace: WorkspaceDescriptor,
  overrides: Partial<TerminalSessionRequest> = {},
): TerminalSessionRequest {
  return {
    terminalSessionId: `terminal-${workspace.workspaceId}`,
    agentInstanceId: `agent-${workspace.workspaceId}`,
    contractId: workspace.contractId,
    roleId: workspace.roleId,
    runtimeId: "node-test-runtime",
    accessMode: "local",
    workspaceId: workspace.workspaceId,
    workspace,
    command: process.execPath,
    args: ["-e", "process.stdout.write('ok')"],
    timeoutMs: 2_000,
    ...overrides,
  };
}

test("streams agent output before its real OS process exits", async () => {
  const { workspaces, terminals } = await harness();
  const workspace = await workspaces.create({
    workspaceId: "W1",
    contractId: "C1",
    roleId: "executor",
  });
  const events: TerminalSessionEvent[] = [];
  let resolveEarly!: () => void;
  const earlyOutput = new Promise<void>((resolvePromise) => { resolveEarly = resolvePromise; });
  terminals.subscribe((event) => {
    events.push(event);
    if (event.type === "TERMINAL_OUTPUT" && event.payload.data.includes("EARLY")) resolveEarly();
  });

  const handle = await terminals.start(request(workspace, {
    args: [
      "-e",
      "process.stdout.write('EARLY'); setTimeout(()=>process.stdout.write(':LATE'), 120)",
    ],
  }));

  await earlyOutput;
  assert.notEqual(terminals.snapshot(handle.terminalSessionId).status, "completed");
  const result = await handle.completion;

  assert.equal(result.status, "completed");
  assert.equal(result.stdout, "EARLY:LATE");
  assert.equal(result.workspaceRoot, workspace.root);
  assert.equal(result.backend, "process-pipes");
  assert.deepEqual(result.capabilities, { tty: false, interactive: true, resize: false });
  assert.ok(events.some((event) => event.type === "TERMINAL_SESSION_STARTED"));
  assert.ok(events.some((event) => event.type === "TERMINAL_SESSION_EXITED"));
});

test("adapts a governed invocation to an observable terminal session", async () => {
  const { workspaces, terminals } = await harness();
  const workspace = await workspaces.create({
    workspaceId: "W1",
    contractId: "C1",
    roleId: "executor",
  });
  const adapter = new ManagedTerminalRuntimeAdapter(terminals);
  const output: string[] = [];
  terminals.subscribe((event) => {
    if (event.type === "TERMINAL_OUTPUT") output.push(event.payload.data);
  });

  const result = await adapter.invoke({
    invocationId: "I1",
    terminalSessionId: "T1",
    agentInstanceId: "A1",
    contractId: "C1",
    roleId: "executor",
    workspaceId: "W1",
    workspace,
    runtimeId: "node-test-runtime",
    accessMode: "local",
    command: process.execPath,
    args: [
      "-e",
      "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write('RUN:'+d))",
    ],
    prompt: "governed-prompt",
    timeoutMs: 2_000,
  });

  assert.equal(result.stdout, "RUN:governed-prompt");
  assert.equal(result.terminalSessionId, "T1");
  assert.equal(result.agentInstanceId, "A1");
  assert.equal(output.join(""), "RUN:governed-prompt");
});

test("runs multiple agent sessions simultaneously in distinct workspaces", async () => {
  const { workspaces, terminals } = await harness();
  const executorWorkspace = await workspaces.create({
    workspaceId: "executor-W1",
    contractId: "C1",
    roleId: "executor",
  });
  const reviewerWorkspace = await workspaces.create({
    workspaceId: "reviewer-W1",
    contractId: "C1",
    roleId: "reviewer",
  });

  const executor = await terminals.start(request(executorWorkspace, {
    args: ["-e", "setTimeout(()=>process.stdout.write(process.cwd()), 150)"],
  }));
  const reviewer = await terminals.start(request(reviewerWorkspace, {
    args: ["-e", "setTimeout(()=>process.stdout.write(process.cwd()), 150)"],
  }));

  assert.equal(terminals.list().filter((session) => session.status === "running" || session.status === "starting").length, 2);

  const [executorResult, reviewerResult] = await Promise.all([
    executor.completion,
    reviewer.completion,
  ]);
  assert.equal(executorResult.stdout, executorWorkspace.root);
  assert.equal(reviewerResult.stdout, reviewerWorkspace.root);
  assert.notEqual(executorResult.pid, reviewerResult.pid);
});

test("keeps interactive input addressed to one agent terminal", async () => {
  const { workspaces, terminals } = await harness();
  const workspace = await workspaces.create({
    workspaceId: "W1",
    contractId: "C1",
    roleId: "diagnostician",
  });
  const handle = await terminals.start(request(workspace, {
    args: [
      "-e",
      "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write('ACK:'+d))",
    ],
  }));

  await terminals.write(handle.terminalSessionId, "evidence-only");
  terminals.endInput(handle.terminalSessionId);
  const result = await handle.completion;

  assert.equal(result.stdout, "ACK:evidence-only");
  const inputEvent = terminals.history(handle.terminalSessionId)
    .find((event) => event.type === "TERMINAL_INPUT_WRITTEN");
  assert.deepEqual(inputEvent?.payload, { bytes: 13 });
  assert.equal(JSON.stringify(inputEvent).includes("evidence-only"), false);
});

test("refuses workspace sharing, binding mismatch and operator-owned directories", async () => {
  const { root, workspaces, terminals } = await harness();
  const workspace = await workspaces.create({
    workspaceId: "W1",
    contractId: "C1",
    roleId: "executor",
  });
  const first = await terminals.start(request(workspace, {
    args: ["-e", "setTimeout(()=>{}, 5_000)"],
  }));

  await assert.rejects(
    terminals.start(request(workspace, {
      terminalSessionId: "terminal-duplicate-workspace",
      agentInstanceId: "agent-duplicate-workspace",
    })),
    /workspace_already_in_use/,
  );

  const mismatched = await workspaces.create({
    workspaceId: "W2",
    contractId: "C1",
    roleId: "reviewer",
  });
  await assert.rejects(
    terminals.start(request(mismatched, { roleId: "executor" })),
    /terminal_workspace_binding_mismatch/,
  );

  const operatorRoot = await mkdtemp(join(root, "operator-project-"));
  await assert.rejects(
    terminals.start({
      ...request(workspace),
      terminalSessionId: "operator-terminal",
      agentInstanceId: "operator-agent",
      workspaceId: "operator-project",
      workspace: {
        workspaceId: "operator-project",
        contractId: "C1",
        roleId: "executor",
        root: operatorRoot,
      },
    }),
    /terminal_workspace_outside_managed_root/,
  );

  assert.equal(terminals.stop(first.terminalSessionId), true);
  assert.equal((await first.completion).status, "stopped");
});

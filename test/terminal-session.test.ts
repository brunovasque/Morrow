import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  TerminalSessionManager,
  ManagedTerminalRuntimeAdapter,
  type TerminalBackend,
  type TerminalBackendDescriptor,
  type TerminalBackendSession,
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
  assert.deepEqual(result.capabilities, {
    tty: false,
    interactive: true,
    resize: false,
    signals: false,
    utf8: true,
    exitStatus: true,
  });
  assert.equal(result.backendImplementationId, "node-child-process-pipes-v1");
  assert.equal(result.terminalProtocol, "separate-pipes");
  assert.deepEqual(result.presentation, {
    mode: "process-output",
    fullTerminal: false,
    missing: [
      "backend:windows-conpty",
      "protocol:conpty-vt",
      "capability:tty",
      "capability:resize",
      "capability:signals",
    ],
  });
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

test("passes only the governed environment into a managed terminal", async () => {
  const { workspaces, terminals } = await harness();
  const workspace = await workspaces.create({
    workspaceId: "W-env",
    contractId: "C1",
    roleId: "executor",
  });
  const operatorCanary = "MORROW_OPERATOR_ENV_MUST_NOT_CROSS_TERMINAL";
  const previous = process.env[operatorCanary];
  process.env[operatorCanary] = "operator-only";
  try {
    const handle = await terminals.start(request(workspace, {
      terminalSessionId: "terminal-env",
      agentInstanceId: "agent-env",
      env: { MORROW_GOVERNED_ENV: "allowed" },
      args: [
        "-e",
        `process.stdout.write(JSON.stringify({governed:process.env.MORROW_GOVERNED_ENV,operator:process.env.${operatorCanary}??null}))`,
      ],
    }));
    const result = await handle.completion;
    assert.equal(result.status, "completed");
    assert.deepEqual(JSON.parse(result.stdout), { governed: "allowed", operator: null });
  } finally {
    if (previous === undefined) delete process.env[operatorCanary];
    else process.env[operatorCanary] = previous;
  }
});

test("refuses resize, interrupt and full-terminal presentation on process pipes", async () => {
  const { workspaces, terminals } = await harness();
  const workspace = await workspaces.create({
    workspaceId: "W1",
    contractId: "C1",
    roleId: "executor",
  });
  const handle = await terminals.start(request(workspace, {
    args: ["-e", "setTimeout(()=>{}, 5_000)"],
  }));

  assert.throws(() => terminals.resize(handle.terminalSessionId, 100, 40), /terminal_resize_not_supported/);
  assert.throws(() => terminals.resize(handle.terminalSessionId, 32_768, 40), /terminal_dimensions_invalid/);
  assert.throws(
    () => terminals.interrupt(handle.terminalSessionId, "sigterm" as "ctrl-c"),
    /terminal_interrupt_kind_invalid/,
  );
  assert.throws(() => terminals.interrupt(handle.terminalSessionId, "ctrl-c"), /terminal_interrupt_not_supported/);
  assert.equal(terminals.snapshot(handle.terminalSessionId).presentation.mode, "process-output");

  assert.equal(terminals.stop(handle.terminalSessionId), true);
  await handle.completion;
});

test("refuses a backend session that changes capabilities before start", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-terminal-backend-mismatch-"));
  const workspaceRoot = join(root, "managed-workspaces");
  const workspaces = new LocalWorkspaceManager(workspaceRoot);
  let forcedStop = false;
  const backend: TerminalBackend = {
    descriptor: {
      kind: "process-pipes",
      implementationId: "controlled-test-pipes-v1",
      protocol: "separate-pipes",
      capabilities: {
        tty: false,
        interactive: true,
        resize: false,
        signals: false,
        utf8: true,
        exitStatus: true,
      },
    },
    create: (): TerminalBackendSession => ({
      descriptor: {
        kind: "windows-conpty",
        implementationId: "forged-conpty-v1",
        protocol: "conpty-vt",
        capabilities: {
          tty: true,
          interactive: true,
          resize: true,
          signals: true,
          utf8: true,
          exitStatus: true,
        },
      },
      pid: null,
      inputClosed: false,
      start: () => {},
      onStarted: () => {},
      onOutput: () => {},
      onError: () => {},
      onExit: () => {},
      write: () => true,
      waitForDrain: async () => {},
      endInput: () => {},
      resize: () => {},
      interrupt: () => {},
      stop: (force) => {
        forcedStop = force;
        return true;
      },
    }),
  };
  const terminals = new TerminalSessionManager(workspaceRoot, { backend });
  const workspace = await workspaces.create({
    workspaceId: "W1",
    contractId: "C1",
    roleId: "executor",
  });

  await assert.rejects(
    terminals.start(request(workspace)),
    /terminal_backend_descriptor_changed_for_session/,
  );
  assert.equal(forcedStop, true);
  assert.equal(terminals.list().length, 0);
});

test("attaches every observer before a backend can emit its first output", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-terminal-early-output-"));
  const workspaceRoot = join(root, "managed-workspaces");
  const workspaces = new LocalWorkspaceManager(workspaceRoot);
  const descriptor: TerminalBackendDescriptor = {
    kind: "process-pipes",
    implementationId: "synchronous-test-pipes-v1",
    protocol: "separate-pipes",
    capabilities: {
      tty: false,
      interactive: true,
      resize: false,
      signals: false,
      utf8: true,
      exitStatus: true,
    },
  };
  let startedListener: (() => void) | undefined;
  let outputListener: ((stream: "stdout", data: string) => void) | undefined;
  let errorListener: ((error: Error) => void) | undefined;
  let exitListener: ((result: { exitCode: number | null; signal: NodeJS.Signals | null }) => void) | undefined;
  const backend: TerminalBackend = {
    descriptor,
    create: (): TerminalBackendSession => ({
      descriptor,
      pid: 42,
      inputClosed: false,
      start: () => {
        assert.ok(startedListener);
        assert.ok(outputListener);
        assert.ok(errorListener);
        assert.ok(exitListener);
        outputListener("stdout", "EARLY");
        startedListener();
        exitListener({ exitCode: 0, signal: null });
      },
      onStarted: (listener) => { startedListener = listener; },
      onOutput: (listener) => {
        outputListener = listener as (stream: "stdout", data: string) => void;
      },
      onError: (listener) => { errorListener = listener; },
      onExit: (listener) => { exitListener = listener; },
      write: () => true,
      waitForDrain: async () => {},
      endInput: () => {},
      resize: () => {},
      interrupt: () => {},
      stop: () => true,
    }),
  };
  const terminals = new TerminalSessionManager(workspaceRoot, { backend });
  const workspace = await workspaces.create({
    workspaceId: "W1",
    contractId: "C1",
    roleId: "executor",
  });

  const handle = await terminals.start(request(workspace));
  const result = await handle.completion;
  assert.equal(result.status, "completed");
  assert.equal(result.stdout, "EARLY");
  assert.equal(
    terminals.history(handle.terminalSessionId)
      .filter((event) => event.type === "TERMINAL_OUTPUT").length,
    1,
  );
});

test("fails closed when a backend emits a stream forbidden by its protocol", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-terminal-stream-violation-"));
  const workspaceRoot = join(root, "managed-workspaces");
  const workspaces = new LocalWorkspaceManager(workspaceRoot);
  const descriptor: TerminalBackendDescriptor = {
    kind: "process-pipes",
    implementationId: "invalid-stream-test-pipes-v1",
    protocol: "separate-pipes",
    capabilities: {
      tty: false,
      interactive: true,
      resize: false,
      signals: false,
      utf8: true,
      exitStatus: true,
    },
  };
  let startedListener: (() => void) | undefined;
  let outputListener: ((stream: "terminal", data: string) => void) | undefined;
  let exitListener: ((result: { exitCode: number | null; signal: NodeJS.Signals | null }) => void) | undefined;
  let stoppedWithForce = false;
  const backend: TerminalBackend = {
    descriptor,
    create: (): TerminalBackendSession => ({
      descriptor,
      pid: 43,
      inputClosed: false,
      start: () => {
        startedListener?.();
        outputListener?.("terminal", "forged-terminal-stream");
      },
      onStarted: (listener) => { startedListener = listener; },
      onOutput: (listener) => {
        outputListener = listener as (stream: "terminal", data: string) => void;
      },
      onError: () => {},
      onExit: (listener) => { exitListener = listener; },
      write: () => true,
      waitForDrain: async () => {},
      endInput: () => {},
      resize: () => {},
      interrupt: () => {},
      stop: (force) => {
        stoppedWithForce = force;
        exitListener?.({ exitCode: 1, signal: null });
        return true;
      },
    }),
  };
  const terminals = new TerminalSessionManager(workspaceRoot, { backend });
  const workspace = await workspaces.create({
    workspaceId: "W1",
    contractId: "C1",
    roleId: "executor",
  });

  const handle = await terminals.start(request(workspace));
  const result = await handle.completion;
  assert.equal(result.status, "failed");
  assert.equal(result.error, "terminal_backend_output_protocol_violation");
  assert.equal(stoppedWithForce, true);
  assert.equal(
    terminals.history(handle.terminalSessionId)
      .some((event) => event.type === "TERMINAL_OUTPUT"),
    false,
  );
});

test("force-stops a session when its backend reports a fatal error", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-terminal-backend-error-"));
  const workspaceRoot = join(root, "managed-workspaces");
  const workspaces = new LocalWorkspaceManager(workspaceRoot);
  const descriptor: TerminalBackendDescriptor = {
    kind: "process-pipes",
    implementationId: "fatal-error-test-pipes-v1",
    protocol: "separate-pipes",
    capabilities: {
      tty: false,
      interactive: true,
      resize: false,
      signals: false,
      utf8: true,
      exitStatus: true,
    },
  };
  let startedListener: (() => void) | undefined;
  let errorListener: ((error: Error) => void) | undefined;
  let exitListener: ((result: { exitCode: number | null; signal: NodeJS.Signals | null }) => void) | undefined;
  let stoppedWithForce = false;
  const backend: TerminalBackend = {
    descriptor,
    create: (): TerminalBackendSession => ({
      descriptor,
      pid: 44,
      inputClosed: false,
      start: () => {
        startedListener?.();
        errorListener?.(new Error("controlled_backend_failure"));
      },
      onStarted: (listener) => { startedListener = listener; },
      onOutput: () => {},
      onError: (listener) => { errorListener = listener; },
      onExit: (listener) => { exitListener = listener; },
      write: () => true,
      waitForDrain: async () => {},
      endInput: () => {},
      resize: () => {},
      interrupt: () => {},
      stop: (force) => {
        stoppedWithForce = force;
        exitListener?.({ exitCode: 1, signal: null });
        return true;
      },
    }),
  };
  const terminals = new TerminalSessionManager(workspaceRoot, { backend });
  const workspace = await workspaces.create({
    workspaceId: "W1",
    contractId: "C1",
    roleId: "executor",
  });

  const handle = await terminals.start(request(workspace));
  const result = await handle.completion;
  assert.equal(result.status, "failed");
  assert.equal(result.error, "controlled_backend_failure");
  assert.equal(stoppedWithForce, true);
});

test("keeps a failed session workspace reserved until backend exit is confirmed", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-terminal-delayed-exit-"));
  const workspaceRoot = join(root, "managed-workspaces");
  const workspaces = new LocalWorkspaceManager(workspaceRoot);
  const descriptor: TerminalBackendDescriptor = {
    kind: "process-pipes",
    implementationId: "delayed-exit-test-pipes-v1",
    protocol: "separate-pipes",
    capabilities: {
      tty: false,
      interactive: true,
      resize: false,
      signals: false,
      utf8: true,
      exitStatus: true,
    },
  };
  let startedListener: (() => void) | undefined;
  let errorListener: ((error: Error) => void) | undefined;
  let exitListener: ((result: { exitCode: number | null; signal: NodeJS.Signals | null }) => void) | undefined;
  const backend: TerminalBackend = {
    descriptor,
    create: (): TerminalBackendSession => ({
      descriptor,
      pid: 45,
      inputClosed: false,
      start: () => {
        startedListener?.();
        errorListener?.(new Error("controlled_delayed_failure"));
      },
      onStarted: (listener) => { startedListener = listener; },
      onOutput: () => {},
      onError: (listener) => { errorListener = listener; },
      onExit: (listener) => { exitListener = listener; },
      write: () => true,
      waitForDrain: async () => {},
      endInput: () => {},
      resize: () => {},
      interrupt: () => {},
      stop: () => {
        setTimeout(() => exitListener?.({ exitCode: 1, signal: null }), 50);
        return true;
      },
    }),
  };
  const terminals = new TerminalSessionManager(workspaceRoot, { backend });
  const workspace = await workspaces.create({ workspaceId: "W1", contractId: "C1", roleId: "executor" });
  const first = await terminals.start(request(workspace));

  await assert.rejects(
    terminals.start(request(workspace, {
      terminalSessionId: "T-delayed-collision",
      agentInstanceId: "A-delayed-collision",
    })),
    /workspace_already_in_use/,
  );
  const result = await first.completion;
  assert.equal(result.status, "failed");
  assert.equal(result.error, "controlled_delayed_failure");
});

test("keeps a partially started session reserved until its delayed physical exit", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-terminal-partial-start-"));
  const workspaceRoot = join(root, "managed-workspaces");
  const workspaces = new LocalWorkspaceManager(workspaceRoot);
  const descriptor: TerminalBackendDescriptor = {
    kind: "process-pipes",
    implementationId: "partial-start-test-pipes-v1",
    protocol: "separate-pipes",
    capabilities: {
      tty: false,
      interactive: true,
      resize: false,
      signals: false,
      utf8: true,
      exitStatus: true,
    },
  };
  let exitListener: ((result: { exitCode: number | null; signal: NodeJS.Signals | null }) => void) | undefined;
  let forcedStop = false;
  const backend: TerminalBackend = {
    descriptor,
    create: (): TerminalBackendSession => ({
      descriptor,
      pid: 46,
      inputClosed: false,
      start: () => {
        setTimeout(() => exitListener?.({ exitCode: 1, signal: null }), 50);
        throw new Error("controlled_partial_start_failure");
      },
      onStarted: () => {},
      onOutput: () => {},
      onError: () => {},
      onExit: (listener) => { exitListener = listener; },
      write: () => true,
      waitForDrain: async () => {},
      endInput: () => {},
      resize: () => {},
      interrupt: () => {},
      stop: (force) => {
        forcedStop = force;
        return true;
      },
    }),
  };
  const terminals = new TerminalSessionManager(workspaceRoot, { backend });
  const workspace = await workspaces.create({ workspaceId: "W1", contractId: "C1", roleId: "executor" });
  const first = await terminals.start(request(workspace));

  await assert.rejects(
    terminals.start(request(workspace, {
      terminalSessionId: "T-partial-collision",
      agentInstanceId: "A-partial-collision",
    })),
    /workspace_already_in_use/,
  );
  const result = await first.completion;
  assert.equal(forcedStop, true);
  assert.equal(result.status, "failed");
  assert.equal(result.error, "terminal_backend_start_failed");
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

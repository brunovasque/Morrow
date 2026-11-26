import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  TerminalSessionManager,
  type TerminalSessionRequest,
} from "../src/terminal-session.ts";
import { LocalWorkspaceManager, type WorkspaceDescriptor } from "../src/workspace-manager.ts";
import {
  WorkerSessionStream,
  type WorkerSessionStreamEvent,
} from "../src/worker-session-stream.ts";
import { PersistentTranscriptStore, StreamRedactor } from "../src/stream-transcript.ts";
import { LIVE_ACTIVITY_MAX_EVENTS } from "../src/live-activity.ts";

async function harness(t: test.TestContext, options: { maxEventsPerSession?: number } = {}) {
  const root = await mkdtemp(join(tmpdir(), "morrow-worker-session-stream-"));
  const workspaceRoot = join(root, "managed-workspaces");
  const workspaces = new LocalWorkspaceManager(workspaceRoot);
  const terminals = new TerminalSessionManager(workspaceRoot);
  const stream = await WorkerSessionStream.open({
    stateRoot: join(root, "session-stream"),
    terminals,
    redaction: { policyId: "p4-pr04-test", sensitiveLiterals: ["MORROW_SECRET_CANARY"] },
    ...options,
  });
  t.after(async () => {
    await stream.close().catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  });
  return { root, workspaceRoot, workspaces, terminals, stream };
}

function request(workspace: WorkspaceDescriptor, sessionId: string, script: string): TerminalSessionRequest {
  return {
    terminalSessionId: sessionId,
    agentInstanceId: `${sessionId}-agent`,
    contractId: workspace.contractId,
    roleId: workspace.roleId,
    runtimeId: "p4-pr04-test-runtime",
    accessMode: "local",
    workspaceId: workspace.workspaceId,
    workspace,
    command: process.execPath,
    args: ["-e", script],
    timeoutMs: 5_000,
  };
}

function outputEvents(events: readonly WorkerSessionStreamEvent[]): WorkerSessionStreamEvent[] {
  return events.filter((event) => event.type === "TERMINAL_OUTPUT");
}

test("local multi-session stream API exposes session-scoped operations", async () => {
  assert.equal(typeof WorkerSessionStream, "function");
});

test("two real sessions stream independently, replay by cursor, and rehydrate after restart", async (t) => {
  const { root, stream, workspaces } = await harness(t);
  const workspaceA = await workspaces.create({ workspaceId: "W-A", contractId: "C-P4-PR04", roleId: "executor" });
  const workspaceB = await workspaces.create({ workspaceId: "W-B", contractId: "C-P4-PR04", roleId: "reviewer" });
  const eventsA: WorkerSessionStreamEvent[] = [];
  const eventsB: WorkerSessionStreamEvent[] = [];
  const liveA = new Promise<void>((resolve) => {
    stream.subscribe("T-A", (event) => { eventsA.push(event); if (event.payload.data?.includes?.("A-EARLY")) resolve(); });
  });
  const liveB = new Promise<void>((resolve) => {
    stream.subscribe("T-B", (event) => { eventsB.push(event); if (event.payload.data?.includes?.("B-EARLY")) resolve(); });
  });
  stream.subscribe("T-A", () => { throw new Error("slow observer must not affect the stream"); });

  const a = await stream.start(request(workspaceA, "T-A", "process.stdout.write('A-EARLY-' + 'x'.repeat(5000));setTimeout(()=>process.stdout.write('MORROW_SECRET_CANARY'),80);setTimeout(()=>process.stdout.write('-A-LATE'),160)"));
  const b = await stream.start(request(workspaceB, "T-B", "process.stdout.write('B-EARLY-' + 'y'.repeat(5000));setTimeout(()=>process.stdout.write('MORROW_SECRET_CANARY'),70);setTimeout(()=>process.stdout.write('-B-LATE'),140)"));
  await Promise.all([liveA, liveB]);
  assert.equal(stream.list().filter((item) => item.state === "running" || item.state === "starting").length >= 1, true);
  await Promise.all([a.completion, b.completion]);

  assert.ok(outputEvents(eventsA).length > 0);
  assert.ok(outputEvents(eventsB).length > 0);
  assert.equal(eventsA.every((event) => event.sessionId === "T-A"), true);
  assert.equal(eventsB.every((event) => event.sessionId === "T-B"), true);
  assert.equal(outputEvents(eventsA).some((event) => event.payload.data.includes("B-EARLY")), false);
  assert.equal(outputEvents(eventsB).some((event) => event.payload.data.includes("A-EARLY")), false);
  assert.equal(JSON.stringify(eventsA).includes("MORROW_SECRET_CANARY"), false);
  assert.equal(JSON.stringify(eventsB).includes("MORROW_SECRET_CANARY"), false);
  const startedA = eventsA.find((event) => event.type === "TERMINAL_SESSION_STARTED");
  assert.ok(startedA);
  assert.equal(Object.isFrozen(startedA.payload), true);
  assert.equal(Object.isFrozen(startedA.payload.capabilities), true);
  assert.equal(Object.isFrozen(startedA.payload.presentation), true);

  const firstA = await stream.replay("T-A", undefined, 2);
  assert.equal(firstA.status, "ok");
  assert.equal(firstA.events.length <= 2, true);
  const foreign = await stream.replay("T-B", firstA.cursor);
  assert.equal(foreign.status, "invalid");
  const future = await stream.replay("T-A", { streamId: firstA.streamId, sequence: 999_999 });
  assert.equal(future.status, "future");
  const invalid = await stream.replay("T-A", new Proxy({}, { getPrototypeOf() { throw new Error("hostile cursor"); } }));
  assert.equal(invalid.status, "invalid");

  const replayed: WorkerSessionStreamEvent[] = [];
  let cursor: unknown = undefined;
  for (;;) {
    const page = await stream.replay("T-A", cursor, 2);
    assert.equal(page.status, "ok");
    replayed.push(...page.events);
    if (page.events.length === 0) break;
    cursor = page.nextCursor;
  }
  assert.deepEqual(replayed.map((event) => event.eventId), [...new Set(replayed.map((event) => event.eventId))]);
  assert.equal(replayed.some((event) => event.type === "TERMINAL_SESSION_STARTED"), true);
  assert.equal(replayed.some((event) => event.type === "TERMINAL_SESSION_EXITED"), true);
  await stream.close();
  const restarted = await WorkerSessionStream.open({
    stateRoot: join(root, "session-stream"),
    terminals: new TerminalSessionManager(join(root, "managed-workspaces")),
    redaction: { policyId: "p4-pr04-test", sensitiveLiterals: ["MORROW_SECRET_CANARY"] },
  });
  assert.equal(restarted.list().length, 2);
  assert.equal(restarted.list().every((session) => session.state === "completed" && session.liveness === "terminal"), true);
  assert.equal((await restarted.replay("T-A")).status, "ok");
  const restartedSnapshot = restarted.snapshot("T-A");
  assert.equal(restartedSnapshot.liveActivity.ok, true);
  if (restartedSnapshot.liveActivity.ok) {
    assert.equal(restartedSnapshot.liveActivity.projection.activities[0]?.state, "done");
  }
  assert.equal(restartedSnapshot.transcript.records.some((record) => record.terminalSessionId === "T-A"), true);
  await restarted.close();
});

test("restart does not turn an unfinished session into completed", { timeout: 30_000 }, async (t) => {
  const { root, stream, workspaces, terminals } = await harness(t);
  const workspace = await workspaces.create({ workspaceId: "W-restart", contractId: "C-P4-PR04", roleId: "executor" });
  const observed = new Promise<void>((resolve) => {
    stream.subscribe("T-restart", (event) => { if (event.type === "TERMINAL_OUTPUT") resolve(); });
  });
  // Explicit stdin barrier: persistence latency cannot make this process exit early.
  const handle = await stream.start({
    ...request(workspace, "T-restart", "process.stdin.once('data',()=>process.exit(0));process.stdout.write('x'.repeat(5000))"),
    timeoutMs: 20_000,
  });
  const outcome = handle.completion.then((result) => ({ result }), (error) => ({ error }));
  let restarted: WorkerSessionStream | undefined;
  try {
    await observed;
    assert.equal(terminals.snapshot("T-restart").status, "running");
    await stream.close();
    assert.equal(terminals.snapshot("T-restart").status, "running");
    restarted = await WorkerSessionStream.open({
      stateRoot: join(root, "session-stream"),
      terminals: new TerminalSessionManager(join(root, "managed-workspaces")),
      redaction: { policyId: "p4-pr04-test", sensitiveLiterals: ["MORROW_SECRET_CANARY"] },
    });
    const item = restarted.list().find((session) => session.sessionId === "T-restart");
    assert.ok(item);
    assert.equal(item.state, "recoverable");
    assert.equal(item.liveness, "offline");
    assert.equal(item.terminal, false);
    const replay = await restarted.replay("T-restart");
    assert.equal(replay.status, "ok");
    assert.equal(replay.events.some((event) => event.type === "TERMINAL_SESSION_EXITED"), false);
  } finally {
    if (terminals.snapshot("T-restart").status === "running") await terminals.write("T-restart", "finish\n");
    await terminals.wait("T-restart");
    await restarted?.close();
  }
  const settled = await outcome;
  assert.match(String("error" in settled ? settled.error : settled.result.status), /worker_session_terminal_persistence_failed/);
  assert.equal((await terminals.wait("T-restart")).status, "completed");
});

test("cursor at the retained floor is explicit and stale history is not reset", async (t) => {
  const { stream, workspaces } = await harness(t, { maxEventsPerSession: 1 });
  const workspace = await workspaces.create({ workspaceId: "W-cursor", contractId: "C-P4-PR04", roleId: "executor" });
  const handle = await stream.start(request(workspace, "T-cursor", "process.stdout.write('CURSOR');"));
  await handle.completion;
  const descriptor = stream.list().find((item) => item.sessionId === "T-cursor");
  assert.ok(descriptor);
  const stale = await stream.replay("T-cursor", { streamId: descriptor.streamId, sequence: 0 });
  assert.equal(stale.status, "stale");
  const atHead = await stream.replay("T-cursor", { streamId: descriptor.streamId, sequence: descriptor.headSequence });
  assert.equal(atHead.status, "ok");
  assert.equal(atHead.events.length, 0);
});

test("P2 RED: terminal persistence failure cannot resolve completion as completed", async (t) => {
  const { root, stream, workspaces } = await harness(t);
  const workspace = await workspaces.create({ workspaceId: "W-durable", contractId: "C-P4-PR04", roleId: "executor" });
  const started = new Promise<void>((resolve) => {
    stream.subscribe("T-durable", (event) => {
      if (event.type !== "TERMINAL_SESSION_STARTED") return;
      const sessions = (stream as any).sessions as Map<string, any>;
      const record = sessions.get("T-durable");
      assert.ok(record);
      record.eventLog.append = async () => { throw new Error("simulated terminal durability outage"); };
      resolve();
    });
  });
  const handle = await stream.start(request(workspace, "T-durable", "setTimeout(() => process.exit(0), 40);"));
  await started;
  await assert.rejects(handle.completion, /worker_session_terminal_persistence_failed/);
  const failedLive = stream.list().find((session) => session.sessionId === "T-durable");
  assert.ok(failedLive);
  assert.equal(failedLive.state, "failed");
  assert.equal(failedLive.liveness, "failed");
  await stream.close();

  const restarted = await WorkerSessionStream.open({
    stateRoot: join(root, "session-stream"),
    terminals: new TerminalSessionManager(join(root, "managed-workspaces")),
    redaction: { policyId: "p4-pr04-test", sensitiveLiterals: ["MORROW_SECRET_CANARY"] },
  });
  const item = restarted.list().find((session) => session.sessionId === "T-durable");
  assert.ok(item);
  assert.equal(item.terminal, false);
  assert.equal(item.state, "recoverable");
  assert.equal(item.liveness, "offline");
  const replay = await restarted.replay("T-durable");
  assert.equal(replay.status, "ok");
  assert.equal(replay.events.filter((event) => event.type === "TERMINAL_SESSION_STARTED").length, 1);
  assert.equal(replay.events.some((event) => event.type === "TERMINAL_SESSION_EXITED"), false);
  await restarted.close();
});

test("P2 RED: the worker stream composes durable transcript and live activity snapshot", async (t) => {
  const { stream, workspaces } = await harness(t);
  const workspace = await workspaces.create({ workspaceId: "W-composition", contractId: "C-P4-PR04", roleId: "executor" });
  const handle = await stream.start(request(workspace, "T-composition", "process.stdout.write('COMPOSITION-LIVE');"));
  await handle.completion;

  const snapshot = stream.snapshot("T-composition");
  assert.equal(snapshot.terminalSnapshot?.terminalSessionId, "T-composition");
  assert.equal(snapshot.liveActivity.ok, true);
  if (snapshot.liveActivity.ok) {
    assert.equal(snapshot.liveActivity.projection.activities[0]?.identity.terminalSessionId, "T-composition");
    assert.equal(snapshot.liveActivity.projection.activities[0]?.state, "done");
  }
  assert.equal(snapshot.transcript.records.some((record) => record.terminalSessionId === "T-composition"), true);
  assert.equal(snapshot.transcript.records.some((record) => record.content.includes("COMPOSITION-LIVE")), true);
});

test("P2 counterproof: live activity observers cannot mutate the causal history", async (t) => {
  const { stream, workspaces } = await harness(t);
  const workspace = await workspaces.create({ workspaceId: "W-live-immutable", contractId: "C-P4-PR04", roleId: "executor" });
  let observed = false;
  stream.subscribeLiveActivity("T-live-immutable", (event) => {
    observed = true;
    try { (event.transition as { to: string }).to = "failed"; } catch { /* frozen event */ }
  });
  const handle = await stream.start(request(workspace, "T-live-immutable", "process.stdout.write('IMMUTABLE-LIVE');"));
  await handle.completion;

  const live = stream.liveActivity("T-live-immutable");
  assert.equal(observed, true);
  assert.equal(live.ok, true);
  if (live.ok) assert.equal(live.projection.activities[0]?.state, "done");
  const internalEvents = ((stream as any).sessions.get("T-live-immutable").liveActivityEvents) as readonly Record<string, unknown>[];
  assert.equal(Object.isFrozen(internalEvents[0]), true);
  assert.equal(Object.isFrozen(internalEvents[0]?.transition), true);
});

test("P2 counterproof: transcript snapshot preserves contract and terminal identity", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "morrow-worker-session-transcript-identity-"));
  const transcript = await PersistentTranscriptStore.open({
    stateRoot: join(root, "transcript"),
    retention: { maxAgeMs: 86_400_000, maxRecords: 100, maxTotalBytes: 1_048_576, maxRecordBytes: 65_536 },
    access: { writerIds: ["worker-session-stream"], readerIds: ["worker-session-stream"] },
    redaction: { policyId: "p4-pr04-test", sensitiveLiterals: [] },
  });
  const foreign = transcript.beginRecord({
    recordId: "foreign-transcript-record",
    contractId: "C-OTHER",
    stepId: "other-step",
    terminalSessionId: "T-shared",
    agentInstanceId: "foreign-agent",
    stream: "stdout",
    writerId: "worker-session-stream",
  });
  foreign.write("FOREIGN-CONTRACT");
  await foreign.commit();
  const workspaceRoot = join(root, "managed-workspaces");
  const workspaces = new LocalWorkspaceManager(workspaceRoot);
  const terminals = new TerminalSessionManager(workspaceRoot);
  const stream = await WorkerSessionStream.open({
    stateRoot: join(root, "session-stream"),
    terminals,
    transcript,
    redaction: { policyId: "p4-pr04-test", sensitiveLiterals: [] },
  });
  t.after(async () => {
    await stream.close().catch(() => undefined);
    await transcript.close().catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  });
  const workspace = await workspaces.create({ workspaceId: "W-transcript-identity", contractId: "C-P4-PR04", roleId: "executor" });
  const handle = await stream.start(request(workspace, "T-shared", "process.stdout.write('LOCAL-CONTRACT');"));
  await handle.completion;

  const records = stream.transcriptRecords("T-shared");
  assert.equal(records.some((record) => record.contractId === "C-OTHER"), false);
  assert.equal(records.some((record) => record.contractId === "C-P4-PR04" && record.content.includes("LOCAL-CONTRACT")), true);
});

test("P2 counterproof: live activity append remains bounded as history grows", async (t) => {
  const { stream } = await harness(t);
  const record = {
    sessionId: "T-live-bounded",
    contractId: "C-P4-PR04",
    agentInstanceId: "T-live-bounded-agent",
    terminalSessionId: "T-live-bounded",
    workspaceId: "W-live-bounded",
    liveActivityEvents: [],
    liveActivityState: null,
  } as any;
  const append = (stream as any).appendLiveActivity.bind(stream);
  const occurredAt = new Date().toISOString();
  const startedAt = Date.now();
  append(record, { type: "TERMINAL_SESSION_STARTED", occurredAt, payload: {} });
  for (let index = 0; index < 3_999; index += 1) {
    append(record, { type: "TERMINAL_OUTPUT", occurredAt, payload: { stream: "stdout", data: "x" } });
  }
  assert.equal(record.liveActivityEvents.length, 4_001);
  assert.ok(Date.now() - startedAt < 5_000);
});

test("P2 counterproof: live activity append refuses the collection limit", async (t) => {
  const { stream } = await harness(t);
  const record = {
    sessionId: "T-live-limit",
    contractId: "C-P4-PR04",
    agentInstanceId: "T-live-limit-agent",
    terminalSessionId: "T-live-limit",
    workspaceId: "W-live-limit",
    liveActivityEvents: new Array(LIVE_ACTIVITY_MAX_EVENTS),
    liveActivityState: "process",
  } as any;
  const append = (stream as any).appendLiveActivity.bind(stream);
  assert.throws(
    () => append(record, { type: "TERMINAL_OUTPUT", occurredAt: new Date().toISOString(), payload: { stream: "stdout", data: "x" } }),
    /worker_session_live_activity_limit/,
  );
  assert.equal(record.liveActivityEvents.length, LIVE_ACTIVITY_MAX_EVENTS);
});

test("P2 counterproof: collection limit rejects before Event Log persistence", async (t) => {
  const { stream } = await harness(t);
  let persisted = false;
  const record = {
    sessionId: "T-live-persist-limit",
    terminalSessionId: "T-live-persist-limit",
    agentInstanceId: "T-live-persist-limit-agent",
    contractId: "C-P4-PR04",
    roleId: "executor",
    runtimeId: "p4-pr04-test-runtime",
    workspaceId: "W-live-persist-limit",
    workspaceRoot: "C:/morrow-test-workspace",
    streamId: "stream-live-persist-limit",
    eventLog: { append: async () => { persisted = true; } },
    nextSequence: 1,
    lastTerminalSequence: 1,
    state: "running",
    liveness: "online",
    terminal: false,
    historyTruncated: false,
    started: true,
    failure: false,
    persistenceError: null,
    queue: Promise.resolve(),
    redactors: new Map(),
    liveActivityEvents: new Array(LIVE_ACTIVITY_MAX_EVENTS),
    liveActivityState: "process",
  } as any;
  await assert.rejects(
    () => (stream as any).appendPublicEvent(record, {
      type: "TERMINAL_OUTPUT",
      occurredAt: new Date().toISOString(),
      payload: { stream: "stdout", data: "x" },
    }, { stream: "stdout", data: "x" }, false),
    /worker_session_live_activity_limit/,
  );
  assert.equal(persisted, false);
  assert.equal(record.nextSequence, 1);
});

test("recovery P2-01: completion redacts stdout and stderr without losing safe output", async (t) => {
  const { root, stream, workspaces } = await harness(t);
  const workspace = await workspaces.create({ workspaceId: "W-result-redaction", contractId: "C-P4-PR04", roleId: "executor" });
  const handle = await stream.start(request(workspace, "T-result-redaction",
    "process.stdout.write('out safe\\nMORROW_SECRET_');process.stderr.write('err safe\\nMORROW_SECRET_');setTimeout(()=>{process.stdout.write('CANARY\\nout tail\\nout-MORROW_SECRET_CANARY-tail');process.stderr.write('CANARY\\nerr tail\\nerr-MORROW_SECRET_CANARY-tail')},30)"));
  const result = await handle.completion;
  assert.equal(result.status, "completed");
  assert.ok(result.stdout.includes("out safe") && result.stdout.includes("out tail"));
  assert.ok(result.stderr.includes("err safe") && result.stderr.includes("err tail"));
  assert.equal(result.stdout.includes("out-"), false);
  assert.equal(result.stderr.includes("err-"), false);
  assert.equal(JSON.stringify(result).includes("MORROW_SECRET_CANARY"), false);
  const replay = await stream.replay("T-result-redaction");
  assert.equal(replay.status, "ok");
  assert.equal(JSON.stringify(replay).includes("MORROW_SECRET_CANARY"), false);
  assert.equal(JSON.stringify(stream.snapshot("T-result-redaction")).includes("MORROW_SECRET_CANARY"), false);
  const disk = await (await import("node:fs/promises")).readFile(join(root, "session-stream", "sessions", "T-result-redaction.event-log"), "utf8");
  assert.equal(disk.includes("MORROW_SECRET_CANARY"), false);
});

test("recovery P2-02: close before exit cannot return a successful completion", { timeout: 30_000 }, async (t) => {
  const { root, stream, workspaces, terminals } = await harness(t);
  const workspace = await workspaces.create({ workspaceId: "W-close-before-exit", contractId: "C-P4-PR04", roleId: "executor" });
  const started = new Promise<void>((resolve) => stream.subscribe("T-close-before-exit", (event) => {
    if (event.type === "TERMINAL_SESSION_STARTED") resolve();
  }));
  const handle = await stream.start({
    ...request(workspace, "T-close-before-exit", "process.stdin.once('data',()=>process.exit(0))"),
    timeoutMs: 20_000,
  });
  const outcome = handle.completion.then((result) => ({ result }), (error) => ({ error }));
  try {
    await started;
    assert.equal(terminals.snapshot("T-close-before-exit").status, "running");
    await stream.close();
    assert.equal(terminals.snapshot("T-close-before-exit").status, "running");
  } finally {
    if (terminals.snapshot("T-close-before-exit").status === "running") await terminals.write("T-close-before-exit", "finish\n");
    await terminals.wait("T-close-before-exit");
  }
  const settled = await outcome;
  assert.equal((await terminals.wait("T-close-before-exit")).status, "completed");
  const reopened = await WorkerSessionStream.open({
    stateRoot: join(root, "session-stream"),
    terminals: new TerminalSessionManager(join(root, "managed-workspaces")),
    redaction: { policyId: "p4-pr04-test", sensitiveLiterals: ["MORROW_SECRET_CANARY"] },
  });
  try {
    const replay = await reopened.replay("T-close-before-exit");
    assert.equal(replay.status, "ok");
    assert.equal(replay.events.some((event) => event.type === "TERMINAL_SESSION_EXITED"), false);
    assert.equal(reopened.list()[0]?.state, "recoverable");
    assert.match(String("error" in settled ? settled.error : settled.result.status), /worker_session_terminal_persistence_failed/);
  } finally {
    await reopened.close();
  }
});

test("recovery P2-03: transcript excludes a different agent in the same contract and session after restart", async (t) => {
  const { root, stream, workspaces } = await harness(t);
  const transcript = (stream as any).transcript as PersistentTranscriptStore;
  const foreign = transcript.beginRecord({
    recordId: "same-contract-foreign-agent-record",
    contractId: "C-P4-PR04",
    stepId: "worker-session-stream",
    terminalSessionId: "T-agent-filter",
    agentInstanceId: "foreign-agent",
    stream: "stdout",
    writerId: "worker-session-stream",
  });
  foreign.write("FOREIGN-AGENT-ONLY");
  await foreign.commit();
  const workspace = await workspaces.create({ workspaceId: "W-agent-filter", contractId: "C-P4-PR04", roleId: "executor" });
  const handle = await stream.start(request(workspace, "T-agent-filter", "process.stdout.write('OWN-AGENT-ONLY')"));
  await handle.completion;
  const before = stream.snapshot("T-agent-filter").transcript.records;
  await stream.close();
  const reopened = await WorkerSessionStream.open({
    stateRoot: join(root, "session-stream"),
    terminals: new TerminalSessionManager(join(root, "managed-workspaces")),
    redaction: { policyId: "p4-pr04-test", sensitiveLiterals: ["MORROW_SECRET_CANARY"] },
  });
  try {
    const after = reopened.transcriptRecords("T-agent-filter");
    for (const records of [before, after]) {
      assert.ok(records.some((record) => record.content.includes("OWN-AGENT-ONLY")));
      assert.ok(records.every((record) => record.agentInstanceId === "T-agent-filter-agent"));
      assert.equal(JSON.stringify(records).includes("FOREIGN-AGENT-ONLY"), false);
    }
  } finally {
    await reopened.close();
  }
});

test("recovery P2-04: case aliases cannot claim a durable session or cursor", async (t) => {
  const { root, stream, workspaces, terminals } = await harness(t);
  const a = await workspaces.create({ workspaceId: "W-case-original", contractId: "C-P4-PR04", roleId: "executor" });
  const b = await workspaces.create({ workspaceId: "W-case-alias", contractId: "C-P4-PR04", roleId: "reviewer" });
  const original = await stream.start(request(a, "T-Case", "process.stdout.write('ORIGINAL-CASE')"));
  await original.completion;
  const originalReplay = await stream.replay("T-Case");
  const alias = await stream.start(request(b, "t-case", "process.stdout.write('ALIAS-CASE')")).then(async (handle) => {
    await handle.completion.catch(() => undefined);
    return "accepted";
  }, (error) => String(error));
  assert.match(alias, /worker_session_id_already_exists/);
  assert.equal(terminals.list().some((item) => item.terminalSessionId === "t-case"), false);
  assert.equal(stream.list().length, 1);
  assert.deepEqual(await stream.replay("T-Case"), originalReplay);
  await stream.close();
  const reopened = await WorkerSessionStream.open({
    stateRoot: join(root, "session-stream"),
    terminals: new TerminalSessionManager(join(root, "managed-workspaces")),
    redaction: { policyId: "p4-pr04-test", sensitiveLiterals: ["MORROW_SECRET_CANARY"] },
  });
  try {
    assert.deepEqual(await reopened.replay("T-Case"), originalReplay);
    await assert.rejects(reopened.start(request(b, "T-CASE", "process.exit(0)")), /worker_session_id_already_exists/);
  } finally {
    await reopened.close();
  }
});

test("recovery combined: two real sessions, alias contention, foreign agent, transient durable failure and process restart", { timeout: 20_000 }, async (t) => {
  const { root, stream, workspaces, terminals } = await harness(t);
  const workspaceA = await workspaces.create({ workspaceId: "W-combined-A", contractId: "C-P4-PR04", roleId: "executor" });
  const workspaceB = await workspaces.create({ workspaceId: "W-combined-B", contractId: "C-P4-PR04", roleId: "reviewer" });
  const seenA: WorkerSessionStreamEvent[] = [];
  const seenB: WorkerSessionStreamEvent[] = [];
  const started = (sessionId: string, events: WorkerSessionStreamEvent[]) => new Promise<void>((resolve) => {
    stream.subscribe(sessionId, (event) => { events.push(event); if (event.type === "TERMINAL_SESSION_STARTED") resolve(); });
  });
  const startedA = started("T-Combined-A", seenA);
  const startedB = started("T-Combined-B", seenB);
  const scriptA = "process.stdin.once('data',()=>{process.stdout.write('A visible\\n'+'x'.repeat(6000)+'\\nMORROW_SECRET_CANARY\\n');setTimeout(()=>process.exit(0),50)})";
  const scriptB = "process.stdin.once('data',()=>{process.stdout.write('B visible\\n'+'y'.repeat(6000)+'\\nMORROW_SECRET_');process.stderr.write('B stderr\\nMORROW_SECRET_');setTimeout(()=>{process.stdout.write('CANARY\\nB tail\\n');process.stderr.write('CANARY\\nB stderr tail\\n');process.exit(0)},80)})";
  const [a, b] = await Promise.all([
    stream.start(request(workspaceA, "T-Combined-A", scriptA)),
    stream.start(request(workspaceB, "T-Combined-B", scriptB)),
  ]);
  const outcomeA = assert.rejects(a.completion, /^Error: worker_session_terminal_persistence_failed$/);
  await Promise.all([startedA, startedB]);
  const live = terminals.list().filter((item) => item.status === "running");
  assert.equal(live.length, 2);
  assert.ok(live.every((item) => Number.isInteger(item.pid) && item.pid! > 0));
  assert.equal(new Set(live.map((item) => item.pid)).size, 2);
  await assert.rejects(stream.start(request(workspaceB, "t-combined-a", "process.exit(0)")), /worker_session_id_already_exists/);
  assert.equal(terminals.list().length, 2);
  const foreign = (stream as any).transcript.beginRecord({
    recordId: "combined-foreign-record", contractId: "C-P4-PR04", stepId: "worker-session-stream",
    terminalSessionId: "T-Combined-B", agentInstanceId: "T-Combined-A-agent", stream: "stdout", writerId: "worker-session-stream",
  });
  foreign.write("FOREIGN ONLY COMBINED");
  await foreign.commit();
  const internal = (stream as any).sessions.get("T-Combined-A");
  const originalAppend = internal.eventLog.append.bind(internal.eventLog);
  let failedOutput = 0;
  let afterFailureAttempts = 0;
  internal.eventLog.append = async (event: any) => {
    if (!failedOutput && event.type === "TERMINAL_OUTPUT") {
      failedOutput++;
      throw new Error("synthetic transient disk error MORROW_SECRET_CANARY");
    }
    if (failedOutput) afterFailureAttempts++;
    return originalAppend(event);
  };
  await Promise.all([terminals.write("T-Combined-A", "go\n"), terminals.write("T-Combined-B", "go\n")]);
  const resultB = await b.completion;
  await outcomeA;
  assert.equal(failedOutput, 1);
  assert.equal(afterFailureAttempts, 0, "an output gap must never be followed by a durable terminal event");
  assert.equal((await terminals.wait("T-Combined-A")).status, "completed");
  assert.equal(resultB.status, "completed");
  assert.ok(resultB.stdout.includes("B visible") && resultB.stdout.includes("B tail"));
  assert.ok(resultB.stderr.includes("B stderr tail"));
  assert.equal(JSON.stringify(resultB).includes("MORROW_SECRET_CANARY"), false);
  const descriptors = stream.list();
  const failed = descriptors.find((item) => item.sessionId === "T-Combined-A")!;
  assert.equal(failed.state, "failed");
  assert.equal(failed.terminal, false);
  assert.equal(failed.liveness, "failed");
  assert.equal(seenA.some((event) => event.type === "TERMINAL_SESSION_EXITED" || event.type === "TERMINAL_OUTPUT"), false);
  const replayA = await stream.replay("T-Combined-A");
  const replayB = await stream.replay("T-Combined-B");
  assert.equal(replayA.status, "ok");
  assert.equal(replayB.status, "ok");
  assert.equal(replayA.events.some((event) => event.type === "TERMINAL_SESSION_EXITED"), false);
  assert.equal(replayB.events.filter((event) => event.type === "TERMINAL_SESSION_EXITED").length, 1);
  assert.equal((await stream.replay("T-Combined-A", replayB.nextCursor)).status, "invalid");
  assert.deepEqual(seenB, replayB.events);
  assert.ok(stream.transcriptRecords("T-Combined-B").every((item) => item.agentInstanceId === "T-Combined-B-agent"));
  for (const publicValue of [seenA, seenB, replayA, replayB, stream.snapshot("T-Combined-A"), stream.snapshot("T-Combined-B")]) {
    const serialized = JSON.stringify(publicValue);
    assert.equal(serialized.includes("MORROW_SECRET_CANARY"), false);
    assert.equal(serialized.includes("FOREIGN ONLY COMBINED"), false);
  }
  await stream.close();
  // Rehydrate in an independent Node process, not merely a fresh class instance.
  const { execFile } = await import("node:child_process");
  const childCode = [
    "import {WorkerSessionStream} from './src/worker-session-stream.ts';",
    "import {TerminalSessionManager} from './src/terminal-session.ts';",
    "import {join} from 'node:path';",
    "const root=process.argv[1];",
    "const s=await WorkerSessionStream.open({stateRoot:join(root,'session-stream'),terminals:new TerminalSessionManager(join(root,'managed-workspaces')),redaction:{policyId:'p4-pr04-test',sensitiveLiterals:['MORROW_SECRET_CANARY']}});",
    "try{const list=s.list();const a=await s.replay('T-Combined-A');const b=await s.replay('T-Combined-B');const snap=s.snapshot('T-Combined-B');console.log(JSON.stringify({pid:process.pid,list,a,b,snap}));}finally{await s.close();}",
  ].join("\n");
  const raw = await new Promise<string>((resolve, reject) => {
    execFile(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", childCode, root], { cwd: process.cwd(), timeout: 12_000, maxBuffer: 2_000_000, windowsHide: true },
      (error, stdout) => error ? reject(error) : resolve(stdout));
  });
  const reopened = JSON.parse(raw);
  assert.notEqual(reopened.pid, process.pid);
  assert.equal(reopened.list.find((item: any) => item.sessionId === "T-Combined-A").state, "recoverable");
  assert.equal(reopened.list.find((item: any) => item.sessionId === "T-Combined-B").state, "completed");
  assert.deepEqual(reopened.a, replayA);
  assert.deepEqual(reopened.b, replayB);
  assert.equal(raw.includes("MORROW_SECRET_CANARY"), false);
  assert.equal(raw.includes("FOREIGN ONLY COMBINED"), false);
});

test("recovery adversarial: concurrent case-alias starts reserve exactly one identity before any await", { timeout: 10_000 }, async (t) => {
  const { stream, terminals, workspaces } = await harness(t);
  const a = await workspaces.create({ workspaceId: "W-racing-A", contractId: "C-RACE-A", roleId: "executor" });
  const b = await workspaces.create({ workspaceId: "W-racing-B", contractId: "C-RACE-B", roleId: "reviewer" });
  const outcomes = await Promise.allSettled([
    stream.start(request(a, "T-Racing", "process.stdout.write('first winner')")),
    stream.start(request(b, "t-racing", "process.stdout.write('second winner')")),
  ]);
  const successes = outcomes.filter((item) => item.status === "fulfilled");
  const failures = outcomes.filter((item) => item.status === "rejected");
  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  assert.match(String(failures[0]!.reason), /worker_session_id_already_exists/);
  await successes[0]!.value.completion;
  assert.equal(terminals.list().length, 1);
  assert.equal(stream.list().length, 1);
  assert.equal((await stream.replay(successes[0]!.value.sessionId)).status, "ok");
});

async function reopenRecoveryStream(root: string, terminals: TerminalSessionManager) {
  return WorkerSessionStream.open({
    stateRoot: join(root, "session-stream"),
    terminals,
    redaction: { policyId: "p4-pr04-test", sensitiveLiterals: ["MORROW_SECRET_CANARY"] },
  });
}

test("recovery P2-05: sensitive argument boundaries are sanitized before every public surface", { timeout: 30_000 }, async (t) => {
  const { root, stream, workspaces } = await harness(t);
  const scenarios = [
    ["--password", "SYNTHETIC_VALUE_05 with spaces"],
    ["--api-key=SYNTHETIC_VALUE_06 with spaces"],
    ["Bearer", "SYNTHETIC_VALUE_07"],
    ["TOKEN", "=", "SYNTHETIC_VALUE_08 with spaces"],
    ["--authorization", "Bearer", "SYNTHETIC_VALUE_09"],
    ["--safe", "SYNTHETIC_VALUE_10", "--token", "SYNTHETIC_VALUE_11"],
  ];
  const allLive: WorkerSessionStreamEvent[][] = [];
  const failures: string[] = [];
  for (const [index, argv] of scenarios.entries()) {
    const sessionId = "T-argv-" + index;
    const workspace = await workspaces.create({ workspaceId: "W-argv-" + index, contractId: "C-P4-PR04", roleId: "executor" });
    const live: WorkerSessionStreamEvent[] = [];
    allLive.push(live);
    stream.subscribe(sessionId, event => live.push(event));
    const req = request(workspace, sessionId, "process.stdout.write('SAFE PROCESS OUTPUT')");
    req.args.push("--", ...argv);
    const result = await (await stream.start(req)).completion;
    assert.equal(result.status, "completed");
    assert.ok(result.stdout.includes("SAFE PROCESS OUTPUT"));
    const replay = await stream.replay(sessionId);
    assert.equal(replay.status, "ok");
    assert.deepEqual(live, replay.events);
    const disk = await (await import("node:fs/promises")).readFile(join(root, "session-stream", "sessions", sessionId + ".event-log"), "utf8");
    const value = JSON.stringify([live, replay, stream.snapshot(sessionId), result, disk]);
    const marker = argv.flatMap(arg => arg.match(/SYNTHETIC_VALUE_\d+/g) ?? []).filter(x => x !== "SYNTHETIC_VALUE_10");
    if (marker.some(x => value.includes(x))) failures.push(sessionId);
  }
  const safeWorkspace = await workspaces.create({workspaceId:"W-argv-safe",contractId:"C-P4-PR04",roleId:"executor"});
  const safeRequest = request(safeWorkspace,"T-argv-safe","process.exit(0)");
  safeRequest.args.push("--","--safe","ORDINARY_PUBLIC_ARGUMENT");
  await (await stream.start(safeRequest)).completion;
  assert.ok(JSON.stringify(await stream.replay("T-argv-safe")).includes("ORDINARY_PUBLIC_ARGUMENT"));
  await stream.close();
  const restarted = await reopenRecoveryStream(root, new TerminalSessionManager(join(root,"managed-workspaces")));
  try {
    for (const [index, argv] of scenarios.entries()) {
      const sessionId = "T-argv-" + index;
      const data = JSON.stringify([await restarted.replay(sessionId), restarted.snapshot(sessionId)]);
      if (argv.flatMap(arg => arg.match(/SYNTHETIC_VALUE_\d+/g) ?? []).filter(x => x !== "SYNTHETIC_VALUE_10").some(x=>data.includes(x))) failures.push("restart:"+sessionId);
    }
    assert.deepEqual(failures, []);
  } finally { await restarted.close(); }
});

test("recovery P2-06: historical snapshots never attach foreign or same-identity live manager sessions", {timeout:30_000}, async t => {
  const {root, stream, workspaces, terminals} = await harness(t);
  const original = await workspaces.create({workspaceId:"W-history-original",contractId:"C-original",roleId:"executor"});
  const foreign = await workspaces.create({workspaceId:"W-history-foreign",contractId:"C-foreign",roleId:"reviewer"});
  const originalRequest=request(original,"T-history-snapshot","process.exit(0)");
  await (await stream.start(originalRequest)).completion;
  assert.equal(stream.snapshot("T-history-snapshot").terminalSnapshot?.contractId,"C-original");
  await stream.close();
  for(const workspace of [foreign, original]) {
    const manager = new TerminalSessionManager(join(root,"managed-workspaces"));
    const reopened = await reopenRecoveryStream(root,manager);
    try {
      const handle = await manager.start(request(workspace,"T-history-snapshot","process.stdin.once('data',()=>process.exit(0))"));
      const settled = handle.completion;
      try {
        assert.equal(reopened.snapshot("T-history-snapshot").terminalSnapshot,null);
      } finally {
        if(manager.snapshot("T-history-snapshot").status==="running"||manager.snapshot("T-history-snapshot").status==="starting") await manager.write("T-history-snapshot","finish\n");
        await settled;
      }
    } finally { await reopened.close(); }
  }
  void terminals;
});

test("recovery P2-07: exact historical identity cannot acquire a new lifecycle or mutate durable history", {timeout:30_000}, async t => {
  const {root,stream,workspaces,terminals}=await harness(t);
  const oldWorkspace=await workspaces.create({workspaceId:"W-history-lifecycle",contractId:"C-P4-PR04",roleId:"executor"});
  const live = new Promise<void>(resolve=>stream.subscribe("T-history-lifecycle",e=>{if(e.type==="TERMINAL_SESSION_STARTED")resolve()}));
  const original=await stream.start({...request(oldWorkspace,"T-history-lifecycle","process.stdin.once('data',()=>process.exit(0))"),timeoutMs:20_000});
  const originalOutcome=original.completion.then(()=>false,()=>true);
  await live;
  await stream.close();
  await terminals.write("T-history-lifecycle","finish\n");
  assert.equal(await originalOutcome,true);
  const manager=new TerminalSessionManager(join(root,"managed-workspaces"));
  const reopened=await reopenRecoveryStream(root,manager);
  const before=await reopened.replay("T-history-lifecycle");
  const beforeDescriptor=reopened.list().find(x=>x.sessionId==="T-history-lifecycle");
  const beforeTranscript=reopened.transcriptRecords("T-history-lifecycle");
  const observed: WorkerSessionStreamEvent[]=[];
  reopened.subscribe("T-history-lifecycle",e=>observed.push(e));
  const bump=await workspaces.create({workspaceId:"W-history-bump",contractId:"C-P4-PR04",roleId:"executor"});
  await (await reopened.start(request(bump,"T-history-bump","process.stdout.write('BUMP')"))).completion;
  const duplicate=await manager.start(request(oldWorkspace,"T-history-lifecycle","process.stdout.write('FOREIGN LIFECYCLE')"));
  await duplicate.completion;
  const after=await reopened.replay("T-history-lifecycle");
  const afterDescriptor=reopened.list().find(x=>x.sessionId==="T-history-lifecycle");
  const afterTranscript=reopened.transcriptRecords("T-history-lifecycle");
  await reopened.close();
  const again=await reopenRecoveryStream(root,new TerminalSessionManager(join(root,"managed-workspaces")));
  try {
    assert.deepEqual(after,before);
    assert.deepEqual(afterDescriptor,beforeDescriptor);
    assert.deepEqual(afterTranscript,beforeTranscript);
    assert.deepEqual(observed,[]);
    assert.equal(again.snapshot("T-history-lifecycle").state,"recoverable");
    assert.deepEqual(await again.replay("T-history-lifecycle"),before);
  } finally {await again.close()}
});

test("recovery P3-01 combined: two real ConPTY sessions preserve native channel through flush, redaction and restart", {timeout:40_000}, async t => {
  const {WindowsConptyTerminalBackend}=await import("../src/windows-conpty-backend.ts");
  const {mkdir}=await import("node:fs/promises");
  assert.equal(process.platform,"win32");
  const root=await mkdtemp(join(tmpdir(),"morrow-recovery-native-"));
  const managed=join(root,"managed-workspaces");
  const workspaces=new LocalWorkspaceManager(managed);
  const manager=new TerminalSessionManager(managed,{backend:new WindowsConptyTerminalBackend()});
  const stream=await reopenRecoveryStream(root,manager);
  let restarted: WorkerSessionStream|undefined;
  t.after(async()=>{
    for(const session of manager.list())if(session.status==="starting"||session.status==="running")manager.stop(session.terminalSessionId);
    await Promise.allSettled(manager.list().map(session=>manager.wait(session.terminalSessionId)));
    await restarted?.close();
    await stream.close();
    await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  });
  const ids=["T-native-new-A","T-native-new-B"];
  const live=new Map<string,WorkerSessionStreamEvent[]>();
  const raw=new Map<string,Array<{stream:string;data:string}>>();
  manager.subscribe(e=>{if(e.type==="TERMINAL_OUTPUT"){const list=raw.get(e.terminalSessionId)??[];list.push({...e.payload});raw.set(e.terminalSessionId,list)}});
  const ready=ids.map(id=>new Promise<void>(resolve=>{live.set(id,[]);stream.subscribe(id,e=>{live.get(id)!.push(e);if(e.type==="TERMINAL_SESSION_STARTED")resolve()})}));
  const requests=await Promise.all(ids.map(async id=>{
    const workspace=await workspaces.create({workspaceId:"W-"+id,contractId:"C-P4-PR04",roleId:"executor"});
    const profile=join(workspace.root,"profile");
    const appData=join(profile,"AppData","Roaming"),localAppData=join(profile,"AppData","Local");
    await mkdir(appData,{recursive:true});await mkdir(localAppData,{recursive:true});
    const env:Record<string,string>={HOME:profile,USERPROFILE:profile,APPDATA:appData,LOCALAPPDATA:localAppData,POWERSHELL_TELEMETRY_OPTOUT:"1"};
    for(const key of ["SystemRoot","WINDIR","TEMP","TMP"])if(process.env[key]!==undefined)env[key]=process.env[key]!;
    const req=request(workspace,id,"process.stdin.once('data',()=>{process.stdout.write('"+id+" SAFE\\nMORROW_SECRET_CANARY\\n');setTimeout(()=>process.exit(0),100)})");
    req.args.push("--","--password","NATIVE_SYNTHETIC_ARG_8842");
    return {...req,env,timeoutMs:20_000};
  }));
  const handles=await Promise.all(requests.map(req=>stream.start(req)));
  const outcomes=Promise.allSettled(handles.map(h=>h.completion));
  await Promise.all(ready);
  const concurrent=manager.list().filter(s=>s.status==="running");
  assert.equal(concurrent.length,2);
  assert.equal(new Set(concurrent.map(s=>s.pid)).size,2);
  await assert.rejects(stream.start({...requests[1],terminalSessionId:ids[0].toLowerCase()}),/worker_session_id_already_exists/);
  await Promise.all(ids.map(id=>manager.write(id,"go\r")));
  const results=await outcomes;
  assert.ok(results.every(x=>x.status==="fulfilled"&&x.value.status==="completed"));
  const before=await Promise.all(ids.map(id=>stream.replay(id)));
  const snapshots=ids.map(id=>stream.snapshot(id));
  await stream.close();
  restarted=await reopenRecoveryStream(root,new TerminalSessionManager(managed));
  for(const [i,id] of ids.entries()){
    const output=outputEvents(before[i].events);
    assert.ok(output.length>0);
    assert.ok(raw.get(id)?.length);
    assert.ok(raw.get(id)!.every(chunk=>chunk.stream==="terminal"));
    assert.ok(output.every(e=>e.payload.stream==="terminal"));
    assert.deepEqual(live.get(id),before[i].events);
    // ConPTY emits mutating VT controls; the existing fail-closed policy may mask
    // safe-looking lines. Require actual raw fixture output and exact canonical
    // redaction, rather than demanding weaker redaction of native VT sequences.
    const rawText=raw.get(id)!.map(chunk=>chunk.data).join("");
    assert.ok(rawText.includes(id+" SAFE"), "native process emitted its synthetic marker");
    assert.ok(rawText.includes("MORROW_SECRET_CANARY"), "native process emitted its synthetic canary");
    const expected=new StreamRedactor({policyId:"p4-pr04-test",sensitiveLiterals:["MORROW_SECRET_CANARY"]}).redact(rawText).text;
    assert.equal(output.map(e=>e.payload.data).join(""),expected);
    assert.equal(results[i].status==="fulfilled"?results[i].value.stdout:null,expected);
    const transcriptOutput=snapshots[i].transcript.records.filter(r=>r.stream!=="system");
    assert.ok(transcriptOutput.length>0);
    assert.ok(transcriptOutput.every(r=>r.stream==="terminal"));
    assert.equal(transcriptOutput.map(r=>r.content).join(""),expected);
    assert.equal(JSON.stringify([before[i],snapshots[i],results[i]]).includes("MORROW_SECRET_CANARY"),false);
    assert.equal(JSON.stringify([before[i],snapshots[i]]).includes("NATIVE_SYNTHETIC_ARG_8842"),false);
    assert.deepEqual(await restarted.replay(id),before[i]);
    assert.equal(restarted.snapshot(id).terminalSnapshot,null);
    assert.ok(restarted.transcriptRecords(id).filter(r=>r.stream!=="system").every(r=>r.stream==="terminal"));
  }
});

test("recovery adversarial: failed reservation cannot absorb a competing manager lifecycle; fresh external observation is sanitized", {timeout:30_000}, async t=>{
  const {root,stream,terminals,workspaces}=await harness(t);
  const reservedWorkspace=await workspaces.create({workspaceId:"W-reserved",contractId:"C-reserved",roleId:"executor"});
  const externalWorkspace=await workspaces.create({workspaceId:"W-external",contractId:"C-external",roleId:"reviewer"});
  const realStart=terminals.start.bind(terminals);
  let release!:()=>void;
  const barrier=new Promise<void>(resolve=>{release=resolve});
  terminals.start=async req=>{await barrier;return realStart(req)};
  const reserved=stream.start(request(reservedWorkspace,"T-reservation","process.exit(0)"));
  const rejection=assert.rejects(reserved,/terminal_session_id_already_exists/);
  try{
    const external=await realStart(request(externalWorkspace,"T-reservation","process.stdout.write('FOREIGN RESERVATION')"));
    await external.completion;
    assert.equal(stream.snapshot("T-reservation").terminalSnapshot,null);
  }finally{release();terminals.start=realStart;await rejection}
  assert.equal(stream.list().some(x=>x.sessionId==="T-reservation"),false);
  const files=await (await import("node:fs/promises")).readdir(join(root,"session-stream","sessions"));
  assert.equal(files.some(name=>name.toLowerCase().startsWith("t-reservation.")),false);
  const freshWorkspace=await workspaces.create({workspaceId:"W-fresh-external",contractId:"C-external",roleId:"reviewer"});
  const req=request(freshWorkspace,"T-fresh-external","process.stdout.write('FRESH EXTERNAL SAFE')");
  req.args.push("--","EXPLICIT_SYNTHETIC_INDEX_7261","EXPLICIT_SYNTHETIC_INDEX_7261");
  req.sensitiveArgIndexes=[3];
  const live:WorkerSessionStreamEvent[]=[];
  stream.subscribe("T-fresh-external",e=>live.push(e));
  const external=await realStart(req);
  await external.completion;
  const replay=await stream.replay("T-fresh-external");
  assert.equal(replay.status,"ok");
  assert.deepEqual(live,replay.events);
  assert.equal(stream.snapshot("T-fresh-external").terminalSnapshot?.contractId,"C-external");
  assert.equal(JSON.stringify([replay,stream.snapshot("T-fresh-external")]).includes("EXPLICIT_SYNTHETIC_INDEX_7261"),false);
  const foreign=(stream as any).transcript.beginRecord({recordId:"same-agent-foreign-step",contractId:req.contractId,stepId:"foreign-step",terminalSessionId:req.terminalSessionId,agentInstanceId:req.agentInstanceId,stream:"stdout",writerId:"worker-session-stream"});
  foreign.write("FOREIGN STEP SYNTHETIC");
  await foreign.commit();
  assert.equal(JSON.stringify(stream.snapshot("T-fresh-external")).includes("FOREIGN STEP SYNTHETIC"),false);
  await stream.close();
  const restarted=await reopenRecoveryStream(root,new TerminalSessionManager(join(root,"managed-workspaces")));
  try{
    assert.equal(restarted.list().length,1);
    assert.deepEqual(await restarted.replay("T-fresh-external"),replay);
    assert.equal(JSON.stringify(restarted.snapshot("T-fresh-external")).includes("FOREIGN STEP SYNTHETIC"),false);
  }finally{await restarted.close()}
});

test("recovery adversarial: authenticated out-of-lifecycle append cannot be replayed or reopened as a valid history", {timeout:20_000}, async t=>{
  const {root,stream,workspaces}=await harness(t);
  const workspace=await workspaces.create({workspaceId:"W-extra-exit",contractId:"C-P4-PR04",roleId:"executor"});
  const sessionId="T-extra-exit";
  await (await stream.start(request(workspace,sessionId,"process.exit(0)"))).completion;
  const before=await stream.replay(sessionId);
  assert.equal(before.status,"ok");
  const record=(stream as any).sessions.get(sessionId);
  const stored=await record.eventLog.readAll();
  const terminal=stored.at(-1);
  assert.equal(terminal.type,"TERMINAL_SESSION_EXITED");
  // Fixture-only authenticated append, not a tampered JSONL/HMAC.
  await record.eventLog.append({...terminal,eventId:sessionId+":"+(stored.length+1),payload:{...terminal.payload,terminalSequence:terminal.payload.terminalSequence+1}});
  assert.equal((await stream.replay(sessionId)).status,"invalid");
  assert.equal((await stream.replay(sessionId,before.nextCursor)).status,"invalid");
  await stream.close();
  await assert.rejects(reopenRecoveryStream(root,new TerminalSessionManager(join(root,"managed-workspaces"))),/worker_session_event_after_terminal/);
});

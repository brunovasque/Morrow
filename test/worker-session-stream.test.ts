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
  await restarted.close();
});

test("restart does not turn an unfinished session into completed", async (t) => {
  const { root, stream, workspaces, terminals } = await harness(t);
  const workspace = await workspaces.create({ workspaceId: "W-restart", contractId: "C-P4-PR04", roleId: "executor" });
  const observed = new Promise<void>((resolve) => {
    stream.subscribe("T-restart", (event) => { if (event.type === "TERMINAL_OUTPUT") resolve(); });
  });
  const handle = await stream.start(request(workspace, "T-restart", "process.stdout.write('x'.repeat(5000));setTimeout(()=>{},1000)"));
  await observed;
  await stream.close();
  const restarted = await WorkerSessionStream.open({
    stateRoot: join(root, "session-stream"),
    terminals: new TerminalSessionManager(join(root, "managed-workspaces")),
    redaction: { policyId: "p4-pr04-test", sensitiveLiterals: ["MORROW_SECRET_CANARY"] },
  });
  const item = restarted.list().find((session) => session.sessionId === "T-restart");
  assert.ok(item);
  assert.equal(item.state, "recoverable");
  assert.equal(item.liveness, "offline");
  assert.equal(item.terminal, false);
  await handle.completion;
  await restarted.close();
  void terminals;
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

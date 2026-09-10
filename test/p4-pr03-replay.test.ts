import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test, { type TestContext } from "node:test";
import { JsonlEventLog } from "../src/event-log.ts";
import {
  PersistentTranscriptStore,
  TRANSCRIPT_REDACTION_PLACEHOLDER,
  type PersistentTranscriptConfiguration,
} from "../src/stream-transcript.ts";
import {
  WorkerRecoveryCoordinator,
  type WorkerRecoveryConfiguration,
} from "../src/worker-recovery.ts";
import { projectContractLiveActivity, replayLiveActivity, type LiveActivityEvent } from "../src/live-activity.ts";
import type { MorrowEvent } from "../src/types.ts";

const controlledParent = resolve(process.cwd(), ".morrow-test-tmp");
const baseTime = Date.parse("2026-09-01T12:00:00.000Z");

async function makeRoot(t: TestContext): Promise<string> {
  await mkdir(controlledParent, { recursive: true });
  const root = await mkdtemp(join(controlledParent, "p4-pr03-"));
  t.after(async () => await rm(root, { recursive: true, force: true }));
  return root;
}

function transcriptConfiguration(stateRoot: string, clock: () => unknown = () => baseTime): PersistentTranscriptConfiguration {
  return {
    stateRoot,
    retention: { maxAgeMs: 3_600_000, maxRecords: 16, maxTotalBytes: 65_536, maxRecordBytes: 16_384 },
    access: { writerIds: ["kernel"], readerIds: ["operator"] },
    redaction: { policyId: "p4-pr03", sensitiveLiterals: ["P4_PR03_SECRET"] },
    clock: clock as PersistentTranscriptConfiguration["clock"],
  };
}

function recordRequest(recordId: string) {
  return {
    recordId,
    contractId: "MORROW-MVO-001",
    stepId: "P4-PR03",
    terminalSessionId: "terminal-p4-pr03",
    agentInstanceId: "agent-p4-pr03",
    stream: "stdout" as const,
    writerId: "kernel",
  };
}

function event(contractId: string, eventId: string, type = "STEP") : MorrowEvent {
  return {
    eventId,
    contractId,
    type,
    occurredAt: "2026-09-01T12:00:00.000Z",
    actor: { kind: "kernel", id: "kernel" },
    payload: { eventId },
    schemaVersion: "0.1",
  };
}

function hostileClock(): () => unknown {
  return () => {
    const value = Object.create(Date.prototype) as Date & { getTime: () => number };
    value.getTime = () => { throw new Error("HOSTILE_CLOCK_SECRET"); };
    return value;
  };
}

test("D-014 RED: hostile Date conversion escapes the public clock boundary", async (t) => {
  const root = await makeRoot(t);
  await assert.rejects(
    PersistentTranscriptStore.open(transcriptConfiguration(root, hostileClock())),
    /transcript_clock_(failed|invalid)/,
  );
});

test("D-014 RED: hostile worker clock conversion is sanitized", async (t) => {
  const root = await makeRoot(t);
  const configuration = workerConfiguration(root, hostileClock());
  await assert.rejects(WorkerRecoveryCoordinator.open(configuration), /worker_recovery_clock_invalid/);
});

test("D-015 RED: a concurrent snapshot replacement cannot change the object that was validated", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(transcriptConfiguration(root));
  const writer = store.beginRecord(recordRequest("toctou-record"));
  writer.write("safe output");
  await writer.commit();
  await store.close();

  const snapshot = join(root, "transcript-v1.json");
  const outside = join(resolve(root, ".."), `p4-pr03-outside-${randomUUID()}.json`);
  const original = join(resolve(root, ".."), `p4-pr03-original-${randomUUID()}.json`);
  t.after(async () => {
    await unlink(outside).catch(() => undefined);
    await unlink(original).catch(() => undefined);
  });
  await writeFile(outside, await readFile(snapshot, "utf8"), "utf8");
  const replacement = join(root, "replacement.json");
  await symlink(outside, replacement);
  await rename(snapshot, original);
  await rename(replacement, snapshot);

  await assert.rejects(
    PersistentTranscriptStore.open(transcriptConfiguration(root)),
    /transcript_snapshot_(race_detected|too_large_or_invalid)/,
  );
  await unlink(snapshot).catch(() => undefined);
  await rename(original, snapshot);
  await unlink(outside).catch(() => undefined);
});

test("D-015 counterproof: same-size replacement between path check and open is rejected", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(transcriptConfiguration(root));
  const writer = store.beginRecord(recordRequest("same-size-race"));
  writer.write("safe output");
  await writer.commit();
  await store.close();

  const snapshot = join(root, "transcript-v1.json");
  const outside = join(resolve(root, ".."), `p4-pr03-same-size-${randomUUID()}.json`);
  const original = join(resolve(root, ".."), `p4-pr03-original-${randomUUID()}.json`);
  t.after(async () => {
    await unlink(outside).catch(() => undefined);
    await unlink(original).catch(() => undefined);
  });
  const parsed = JSON.parse(await readFile(snapshot, "utf8")) as { records: Array<{ occurredAt: string }>; checksum: string };
  parsed.records[0]!.occurredAt = "2026-09-01T11:59:59.000Z";
  const { checksum: _checksum, ...withoutChecksum } = parsed;
  parsed.checksum = createHash("sha256").update(JSON.stringify(withoutChecksum)).digest("hex");
  await writeFile(outside, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");

  const childCode = `
    import fsp from "node:fs/promises";
    import { syncBuiltinESMExports } from "node:module";
    import { rename } from "node:fs/promises";
    const [snapshot, outside, original, root] = process.argv.slice(1);
    const realOpen = fsp.open;
    fsp.open = async (...args) => {
      if (String(args[0]) !== snapshot) return await realOpen(...args);
      await rename(snapshot, original);
      await rename(outside, snapshot);
      try { return await realOpen(...args); }
      finally { await rename(snapshot, outside); await rename(original, snapshot); }
    };
    syncBuiltinESMExports();
    const { PersistentTranscriptStore } = await import("./src/stream-transcript.ts");
    try {
      const store = await PersistentTranscriptStore.open({
        stateRoot: root,
        retention: { maxAgeMs: 3600000, maxRecords: 16, maxTotalBytes: 65536, maxRecordBytes: 16384 },
        access: { writerIds: ["kernel"], readerIds: ["operator"] },
        redaction: { policyId: "p4-pr03", sensitiveLiterals: ["P4_PR03_SECRET"] },
        clock: () => "2026-09-01T12:00:00.000Z",
      });
      await store.close();
      process.stdout.write("ACCEPTED\\n");
    } catch (error) {
      process.stdout.write(String(error?.message ?? "unknown") + "\\n");
    }
  `;
  const child = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", childCode, snapshot, outside, original, root], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  let errors = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { output += chunk; });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => { errors += chunk; });
  await new Promise<void>((resolvePromise, rejectPromise) => {
    child.once("error", rejectPromise);
    child.once("exit", () => resolvePromise());
  });
  assert.doesNotMatch(output, /ACCEPTED/, `${output}${errors}`);
  assert.match(output, /transcript_snapshot_/, `${output}${errors}`);
  await unlink(outside).catch(() => undefined);
});

test("D-016 RED: a checksummed snapshot cannot trust arbitrary redactionCount metadata", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(transcriptConfiguration(root));
  const writer = store.beginRecord(recordRequest("redaction-count"));
  writer.write("password=P4_PR03_SECRET");
  await writer.commit();
  await store.close();

  const snapshot = join(root, "transcript-v1.json");
  const parsed = JSON.parse(await readFile(snapshot, "utf8")) as { records: Array<{ redactionCount: number }>; checksum: string };
  parsed.records[0]!.redactionCount += 7;
  const { checksum: _checksum, ...withoutChecksum } = parsed;
  parsed.checksum = createHash("sha256").update(JSON.stringify(withoutChecksum)).digest("hex");
  await writeFile(snapshot, `${JSON.stringify(parsed)}\n`, "utf8");

  await assert.rejects(
    PersistentTranscriptStore.open(transcriptConfiguration(root)),
    /transcript_snapshot_(redaction_metadata_invalid|invalid)/,
  );
});

test("D-016 counterproof: an artificial placeholder without redactor provenance is rejected", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(transcriptConfiguration(root));
  const writer = store.beginRecord(recordRequest("artificial-placeholder"));
  writer.write("ordinary output");
  await writer.commit();
  await store.close();

  const snapshot = join(root, "transcript-v1.json");
  const parsed = JSON.parse(await readFile(snapshot, "utf8")) as {
    records: Array<{ content: string; redactionCount: number }>;
    checksum: string;
  };
  parsed.records[0]!.content = TRANSCRIPT_REDACTION_PLACEHOLDER;
  parsed.records[0]!.redactionCount = 1;
  const { checksum: _checksum, ...withoutChecksum } = parsed;
  parsed.checksum = createHash("sha256").update(JSON.stringify(withoutChecksum)).digest("hex");
  await writeFile(snapshot, `${JSON.stringify(parsed)}\n`, "utf8");

  await assert.rejects(
    PersistentTranscriptStore.open(transcriptConfiguration(root)),
    /transcript_snapshot_invalid/,
  );
});

test("P2-03 rejects transcript ordinal gaps and hostile cursor traps", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(transcriptConfiguration(root));
  for (const id of ["gap-1", "gap-2"]) {
    const writer = store.beginRecord(recordRequest(id));
    writer.write(id);
    await writer.commit();
  }
  const hostile = new Proxy({}, { ownKeys: () => { throw new Error("CURSOR_SECRET"); } });
  assert.equal(store.replay("operator", hostile).status, "invalid");
  const snapshot = join(root, "transcript-v1.json");
  const parsed = JSON.parse(await readFile(snapshot, "utf8")) as { records: Array<{ ordinal: number }>; nextOrdinal: number; checksum: string; };
  parsed.records[1]!.ordinal = 3;
  parsed.nextOrdinal = 4;
  const { checksum: _checksum, ...withoutChecksum } = parsed;
  parsed.checksum = createHash("sha256").update(JSON.stringify(withoutChecksum)).digest("hex");
  await store.close();
  await writeFile(snapshot, `${JSON.stringify(parsed)}\n`, "utf8");
  await assert.rejects(PersistentTranscriptStore.open(transcriptConfiguration(root)), /transcript_snapshot_invalid/);
});

test("D-017 counterproof: a stale lease with a reused PID is recoverable without stealing a live instance", async (t) => {
  const root = await makeRoot(t);
  const stateRoot = join(root, ".morrow", "worker");
  await mkdir(stateRoot, { recursive: true });
  const lock = join(stateRoot, "worker-recovery-v1.lock");
  await writeFile(lock, `${JSON.stringify({
    format: "morrow.worker-recovery-lease/v1",
    workerId: "worker-p4-pr03",
    ownerId: randomUUID(),
    processId: process.pid,
    acquiredAt: "2026-09-01T12:00:00.000Z",
  })}\n`, "utf8");

  const recovered = await WorkerRecoveryCoordinator.open(workerConfiguration(root));
  assert.equal(recovered.inspect().connectivity, "offline");
  await recovered.close();
});

test("D-017 counterproof: transcript recovery does not treat a reused PID as a live owner", async (t) => {
  const root = await makeRoot(t);
  const initialized = await PersistentTranscriptStore.open(transcriptConfiguration(root));
  await initialized.close();
  await writeFile(join(root, ".transcript-v1.lock"), JSON.stringify({ pid: process.pid, token: "stale-pid-only" }), "utf8");
  const recovered = await PersistentTranscriptStore.open(transcriptConfiguration(root));
  assert.equal(recovered.replay("operator").status, "ok");
  await recovered.close();
});

test("replays event stream from start, intermediate cursor and durable head without duplication or loss", async (t) => {
  const root = await makeRoot(t);
  const log = new JsonlEventLog(join(root, "events.jsonl"));
  for (let index = 1; index <= 5; index += 1) await log.append(event("C-P4-PR03", `event-${index}`));

  const first = await log.replay("C-P4-PR03");
  assert.equal(first.status, "ok");
  assert.deepEqual(first.events.map((item) => item.eventId), ["event-1", "event-2", "event-3", "event-4", "event-5"]);
  const middle = await log.replay("C-P4-PR03", first.cursor, 2);
  assert.equal(middle.status, "ok");
  assert.deepEqual(middle.events.map((item) => item.eventId), ["event-1", "event-2"]);
  const tail = await log.replay("C-P4-PR03", middle.nextCursor);
  assert.equal(tail.status, "ok");
  assert.deepEqual(tail.events.map((item) => item.eventId), ["event-3", "event-4", "event-5"]);
  const head = await log.replay("C-P4-PR03", tail.nextCursor);
  assert.equal(head.status, "ok");
  assert.deepEqual(head.events, []);

  const reopened = new JsonlEventLog(join(root, "events.jsonl"));
  const afterRestart = await reopened.replay("C-P4-PR03", middle.nextCursor);
  assert.deepEqual(afterRestart.events.map((item) => item.eventId), ["event-3", "event-4", "event-5"]);
  assert.equal(new Set(afterRestart.events.map((item) => item.eventId)).size, afterRestart.events.length);
  assert.ok(afterRestart.events.every((item, index) => item.eventId === `event-${index + 3}`));
});

test("rejects invalid, foreign, stale and future event cursors", async (t) => {
  const root = await makeRoot(t);
  const log = new JsonlEventLog(join(root, "events.jsonl"), { maxEventsPerContract: 2 });
  for (let index = 1; index <= 4; index += 1) await log.append(event("C-P4-PR03", `event-${index}`));
  const current = await log.replay("C-P4-PR03");
  assert.equal(current.status, "stale");
  assert.equal((await log.replay("C-P4-PR03", { streamId: "foreign", sequence: 0 })).status, "invalid");
  assert.equal((await log.replay("C-P4-PR03", { streamId: current.streamId, sequence: -1 })).status, "invalid");
  assert.equal((await log.replay("C-P4-PR03", { streamId: current.streamId, sequence: 99 })).status, "future");
  const retained = await log.replay("C-P4-PR03", { streamId: current.streamId, sequence: 2 });
  assert.equal(retained.status, "ok");
  assert.deepEqual(retained.events.map((item) => item.eventId), ["event-3", "event-4"]);
});

test("P2-03 rejects event reorder, gap, duplicate and hostile cursor traps", async (t) => {
  const root = await makeRoot(t);
  const file = join(root, "events.jsonl");
  const log = new JsonlEventLog(file);
  for (let index = 1; index <= 3; index += 1) await log.append(event("C-P4-PR03", `integrity-${index}`));
  const original = (await readFile(file, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  const corruptions = [
    (entries: Record<string, unknown>[]) => [entries[1], entries[0], entries[2]],
    (entries: Record<string, unknown>[]) => entries.map((entry, index) => index === 1 ? { ...entry, sequence: 4 } : entry),
    (entries: Record<string, unknown>[]) => [...entries.slice(0, 2), entries[1]],
  ];
  for (const corrupt of corruptions) {
    await writeFile(file, `${corrupt(original).map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
    assert.equal((await new JsonlEventLog(file).replay("C-P4-PR03")).status, "invalid");
  }
  await writeFile(file, "{malformed-json}\n", "utf8");
  assert.equal((await new JsonlEventLog(file).replay("C-P4-PR03")).status, "invalid");
  await writeFile(file, `${original.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
  const current = await new JsonlEventLog(file).replay("C-P4-PR03");
  const hostile = new Proxy({}, { getPrototypeOf: () => { throw new Error("CURSOR_SECRET"); } });
  assert.equal((await new JsonlEventLog(file).replay("C-P4-PR03", hostile)).status, "invalid");
  assert.equal(current.status, "ok");
});

test("transcript cursor is ordinal-based and survives restart independently from event cursor", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(transcriptConfiguration(root));
  for (let index = 1; index <= 3; index += 1) {
    const writer = store.beginRecord(recordRequest(`record-${index}`));
    writer.write(index === 2 ? "secret=P4_PR03_SECRET" : `safe-${index}`);
    await writer.commit();
  }
  const first = store.replay("operator");
  assert.equal(first.status, "ok");
  assert.deepEqual(first.records.map((record) => record.ordinal), [1, 2, 3]);
  assert.equal(first.records[1]!.content, TRANSCRIPT_REDACTION_PLACEHOLDER);
  assert.equal(first.records[1]!.redactionCount, 1);
  const middle = store.replay("operator", first.cursor, 1);
  assert.equal(middle.status, "ok");
  assert.deepEqual(middle.records.map((record) => record.recordId), ["record-1"]);
  await store.close();

  const reopened = await PersistentTranscriptStore.open(transcriptConfiguration(root));
  const tail = reopened.replay("operator", middle.nextCursor);
  assert.equal(tail.status, "ok");
  assert.deepEqual(tail.records.map((record) => record.recordId), ["record-2", "record-3"]);
  assert.equal((await reopened.replay("operator", { streamId: "events", ordinal: 0 })).status, "invalid");
  assert.equal((await reopened.replay("operator", { streamId: tail.streamId, ordinal: 99 })).status, "future");
  await reopened.close();
});

test("live activity replay keeps its own sequence and identity cursor", () => {
  const inputs = [liveEvent("live-1", 1, null, "dispatch"), liveEvent("live-2", 2, "live-1", "process")];
  const projection = projectContractLiveActivity("C-P4-PR03", inputs);
  assert.equal(projection.ok, true);
  const first = replayLiveActivity("C-P4-PR03", inputs);
  assert.equal(first.status, "ok");
  const tail = replayLiveActivity("C-P4-PR03", inputs, first.cursor, 1);
  assert.equal(tail.status, "ok");
  assert.deepEqual(tail.events.map((item) => item.eventId), ["live-1"]);
  assert.equal(replayLiveActivity("C-P4-PR03", inputs, { streamId: "transcript", sequence: 0 }).status, "invalid");
  assert.equal(replayLiveActivity("C-P4-PR03", inputs, { streamId: first.streamId, sequence: 99 }).status, "future");
  const hostile = new Proxy({}, { ownKeys: () => { throw new Error("CURSOR_SECRET"); } });
  assert.equal(replayLiveActivity("C-P4-PR03", inputs, hostile).status, "invalid");
});

test("P2-05 replays a large JSONL fixture with a small bounded result", async (t) => {
  const root = await makeRoot(t);
  const file = join(root, "large-events.jsonl");
  const log = new JsonlEventLog(file);
  const payload = "x".repeat(900);
  for (let index = 1; index <= 2_000; index += 1) {
    await log.append({ ...event("C-P4-PR03", `large-${index}`), payload });
  }
  const result = await new JsonlEventLog(file).replay("C-P4-PR03", undefined, 1);
  assert.equal(result.status, "ok");
  assert.equal(result.events.length, 1);
  assert.equal(result.headSequence, 2_000);
  assert.equal(result.events[0]!.eventId, "large-1");
});

function liveEvent(eventId: string, sequence: number, causationId: string | null, to: "dispatch" | "process"): LiveActivityEvent {
  return {
    schema: "morrow.live-activity",
    schemaVersion: "1.0",
    eventId,
    causationId,
    sequence,
    occurredAt: "2026-09-01T12:00:00.000Z",
    actor: { kind: "kernel", id: "kernel" },
    identity: {
      activityId: "activity-1",
      correlationId: "correlation-1",
      contractId: "C-P4-PR03",
      stepId: "P4-PR03",
      agentInstanceId: "agent-1",
      terminalSessionId: "terminal-1",
      workspaceId: "workspace-1",
    },
    transition: { from: sequence === 1 ? null : "dispatch", to, reasonCode: "fixture", sourceKind: to === "dispatch" ? "kernel" : "process", sourceId: "fixture" },
  };
}

function workerConfiguration(root: string, clock: () => unknown = () => baseTime): WorkerRecoveryConfiguration {
  const stateRoot = join(root, ".morrow", "worker");
  return {
    workerId: "worker-p4-pr03",
    stateRoot,
    validationContext: async () => ({}) as never,
    attempt: async () => ({ ok: false, duplicate: false, code: "WORKER_NOT_READY", detail: "not ready" }),
    clock: clock as WorkerRecoveryConfiguration["clock"],
  };
}

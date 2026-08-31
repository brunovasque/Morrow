import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import test, { type TestContext } from "node:test";
import {
  PersistentTranscriptStore,
  SENSITIVE_INPUT_PLACEHOLDER,
  StreamRedactor,
  TRANSCRIPT_REDACTION_PLACEHOLDER,
  type PersistentTranscriptConfiguration,
  type TranscriptStream,
} from "../src/stream-transcript.ts";

const controlledParent = resolve(process.cwd(), ".morrow-test-tmp");
const syntheticSecret = "MORROW_SYNTHETIC_SECRET_CANARY_9f31a7c2";
const baseTime = Date.parse("2026-08-31T15:00:00.000Z");

async function makeRoot(t: TestContext): Promise<string> {
  await mkdir(controlledParent, { recursive: true });
  const root = await mkdtemp(join(controlledParent, "p4-pr02-"));
  t.after(async () => {
    const scoped = relative(controlledParent, root);
    assert.notEqual(scoped, "");
    assert.equal(scoped.startsWith(".."), false);
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

function configuration(
  stateRoot: string,
  now: () => number = () => baseTime,
  overrides: Partial<PersistentTranscriptConfiguration> = {},
): PersistentTranscriptConfiguration {
  return {
    stateRoot,
    retention: {
      maxAgeMs: 60_000,
      maxRecords: 8,
      maxTotalBytes: 65_536,
      maxRecordBytes: 16_384,
    },
    access: { writerIds: ["kernel", "worker"], readerIds: ["operator", "auditor"] },
    redaction: { policyId: "transcript-policy-v1", sensitiveLiterals: [syntheticSecret] },
    clock: now,
    ...overrides,
  };
}

function request(recordId: string, stream: TranscriptStream = "stdout", writerId = "kernel") {
  return {
    recordId,
    contractId: "MORROW-MVO-001",
    stepId: "P4-PR02",
    terminalSessionId: "terminal-fixture-1",
    agentInstanceId: "agent-fixture-1",
    stream,
    writerId,
  };
}

async function append(
  store: PersistentTranscriptStore,
  recordId: string,
  content: string,
  stream: TranscriptStream = "stdout",
) {
  const writer = store.beginRecord(request(recordId, stream));
  writer.write(content);
  return await writer.commit();
}

async function allFileText(root: string): Promise<string> {
  const entries = await readdir(root, { withFileTypes: true });
  const contents: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) contents.push(await allFileText(path));
    else if (entry.isFile()) contents.push(await readFile(path, "utf8"));
  }
  return contents.join("\n");
}

test("redacts exact literals and token shapes split across stream chunks before release", () => {
  const redactor = new StreamRedactor({
    policyId: "stream-policy-v1",
    sensitiveLiterals: [syntheticSecret],
  });
  const session = redactor.start(65_536);
  const fragments = [
    session.push(`visible-${"x".repeat(5_000)}-${syntheticSecret.slice(0, 13)}`),
    session.push(`${syntheticSecret.slice(13)} authorization=Bearer abcdefghijklmnopqrstuvwxyz012345 tail`),
    session.finish(),
  ];
  const released = fragments.map((fragment) => fragment.text).join("");
  assert.doesNotMatch(released, new RegExp(syntheticSecret));
  assert.doesNotMatch(released, /abcdefghijklmnopqrstuvwxyz012345/);
  assert.match(released, /\[REDACTED\]/);
  assert.ok(fragments.some((fragment) => fragment.text.length > 0));
  assert.ok(fragments.reduce((total, fragment) => total + fragment.redactionCount, 0) >= 2);
});

test("persists and returns only redacted output while dropping terminal input by default", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(configuration(root));
  const writer = store.beginRecord(request("record-output"));
  const mirrored = [
    writer.write(`before ${syntheticSecret.slice(0, 10)}`),
    writer.write(`${syntheticSecret.slice(10)} after`),
  ];
  const committed = await writer.commit();
  mirrored.push(committed.finalFragment);
  const mirrorText = mirrored.map((fragment) => fragment.text).join("");
  assert.doesNotMatch(mirrorText, new RegExp(syntheticSecret));
  assert.match(mirrorText, /\[REDACTED\]/);

  const inputWriter = store.beginRecord(request("record-input", "input"));
  const inputMirror = inputWriter.write(`typed-${syntheticSecret}`);
  assert.equal(inputMirror.text, SENSITIVE_INPUT_PLACEHOLDER);
  await inputWriter.commit();

  const view = store.inspect("operator");
  assert.equal(view.records.length, 2);
  assert.equal(view.records[0]?.content.includes(syntheticSecret), false);
  assert.equal(view.records[1]?.content, SENSITIVE_INPUT_PLACEHOLDER);
  assert.equal(Object.isFrozen(view), true);
  assert.equal(Object.isFrozen(view.records), true);
  assert.throws(() => store.inspect("intruder"), /transcript_read_not_authorized/);
  await store.close();

  const disk = await allFileText(root);
  assert.doesNotMatch(disk, new RegExp(syntheticSecret));
  assert.doesNotMatch(disk, /typed-MORROW_SYNTHETIC/);
});

test("enforces writer access, strict data-only requests and record limits before persistence", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(configuration(root, () => baseTime, {
    retention: { maxAgeMs: 60_000, maxRecords: 4, maxTotalBytes: 64, maxRecordBytes: 32 },
  }));
  assert.throws(
    () => store.beginRecord(request("unauthorized", "stdout", "intruder")),
    /transcript_write_not_authorized/,
  );

  let getterCalls = 0;
  const hostile = { ...request("hostile") } as Record<string, unknown>;
  Object.defineProperty(hostile, "recordId", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "hostile";
    },
  });
  assert.throws(() => store.beginRecord(hostile), /transcript_record_request_invalid/);
  assert.equal(getterCalls, 0);

  const oversized = store.beginRecord(request("oversized"));
  assert.throws(() => oversized.write("x".repeat(33)), /transcript_record_too_large/);
  assert.throws(() => oversized.write("later"), /transcript_writer_finished/);
  assert.equal(store.inspect("auditor").records.length, 0);
  await store.close();
  assert.doesNotMatch(await allFileText(root), /xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/);
});

test("applies count, byte and age retention deterministically and reports evictions", async (t) => {
  const root = await makeRoot(t);
  let current = baseTime;
  const store = await PersistentTranscriptStore.open(configuration(root, () => current, {
    retention: { maxAgeMs: 1_000, maxRecords: 2, maxTotalBytes: 12, maxRecordBytes: 12 },
  }));
  await append(store, "record-1", "aaaaaa");
  current += 100;
  await append(store, "record-2", "bbbbbb");
  current += 100;
  const third = await append(store, "record-3", "cccccc");
  assert.deepEqual(third.evictedRecordIds, ["record-1"]);
  assert.deepEqual(store.inspect("operator").records.map((record) => record.recordId), ["record-2", "record-3"]);

  current += 1_001;
  assert.deepEqual(await store.sweepRetention("kernel"), ["record-2", "record-3"]);
  assert.equal(store.inspect("operator").records.length, 0);
  await store.close();
});

test("rehydrates sanitized records but refuses policy drift and corrupted snapshots", async (t) => {
  const root = await makeRoot(t);
  const first = await PersistentTranscriptStore.open(configuration(root));
  await append(first, "record-restart", `safe ${syntheticSecret}`);
  await first.close();

  const reopened = await PersistentTranscriptStore.open(configuration(root));
  assert.equal(reopened.inspect("operator").records[0]?.content, `safe ${TRANSCRIPT_REDACTION_PLACEHOLDER}`);
  await reopened.close();

  await assert.rejects(
    PersistentTranscriptStore.open(configuration(root, () => baseTime, {
      redaction: { policyId: "different-policy", sensitiveLiterals: [syntheticSecret] },
    })),
    /transcript_snapshot_invalid/,
  );

  const snapshot = join(root, "transcript-v1.json");
  const parsed = JSON.parse(await readFile(snapshot, "utf8"));
  parsed.records[0].content = syntheticSecret;
  await writeFile(snapshot, JSON.stringify(parsed), "utf8");
  await assert.rejects(PersistentTranscriptStore.open(configuration(root)), /transcript_snapshot_checksum_invalid/);
});

test("allows only one active owner of a transcript root and releases it on orderly close", async (t) => {
  const root = await makeRoot(t);
  const first = await PersistentTranscriptStore.open(configuration(root));
  await assert.rejects(PersistentTranscriptStore.open(configuration(root)), /transcript_store_already_active/);
  await first.close();
  const replacement = await PersistentTranscriptStore.open(configuration(root));
  await replacement.close();
});

test("fails closed on hostile policy collections without invoking accessors", () => {
  let getterCalls = 0;
  const literals: string[] = [];
  Object.defineProperty(literals, "0", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return syntheticSecret;
    },
  });
  assert.throws(
    () => new StreamRedactor({ policyId: "hostile-policy", sensitiveLiterals: literals }),
    /data_array_element_invalid/,
  );
  assert.equal(getterCalls, 0);

  const proxy = new Proxy({}, {
    getPrototypeOf() {
      throw new Error(syntheticSecret);
    },
  });
  assert.throws(
    () => new StreamRedactor(proxy as never),
    /redaction_policy_inspection_failed/,
  );
});

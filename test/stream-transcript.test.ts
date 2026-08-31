import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
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

  const ansiHidden = `${syntheticSecret.slice(0, 14)}\u001b[31m${syntheticSecret.slice(14)}\u001b[0m`;
  const normalized = redactor.redact(`color=\u001b[32mgreen\u001b[0m hidden=${ansiHidden}`);
  assert.equal(normalized.text.includes("\u001b"), false);
  assert.match(normalized.text, /color=green/);
  assert.doesNotMatch(normalized.text, new RegExp(syntheticSecret));
  assert.doesNotMatch(normalized.text, /MORROW_SYNTHETIC_SECRET/);
  assert.match(normalized.text, /hidden=\[REDACTED\]/);

  const invisibleHidden = `${syntheticSecret.slice(0, 9)}\u200b${syntheticSecret.slice(9)}`;
  const invisible = redactor.redact(`hidden=${invisibleHidden}`);
  assert.equal(invisible.text, "hidden=[REDACTED]");

  const environment = redactor.redact(
    "DB_PASSWORD=hunter2secret AWS_SECRET_ACCESS_KEY=synthetic-access-key-material",
  );
  assert.equal(
    environment.text,
    `${TRANSCRIPT_REDACTION_PLACEHOLDER} ${TRANSCRIPT_REDACTION_PLACEHOLDER}`,
  );
});

test("holds a long quoted assignment until its quote or line boundary can be redacted", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(configuration(root));
  const quotedSecret = `QUOTE_CANARY_${"q".repeat(5_000)}_END`;
  const writer = store.beginRecord(request("record-long-quoted-assignment"));
  const fragments = [
    writer.write(`prefix password="A ${quotedSecret}`),
    writer.write('" suffix'),
  ];
  const committed = await writer.commit();
  fragments.push(committed.finalFragment);

  const mirrored = fragments.map((fragment) => fragment.text).join("");
  assert.equal(mirrored, `prefix ${TRANSCRIPT_REDACTION_PLACEHOLDER} suffix`);
  assert.doesNotMatch(mirrored, /QUOTE_CANARY/);
  assert.doesNotMatch(mirrored, /q{256}/);
  assert.equal(store.inspect("auditor").records[0]?.content, mirrored);

  const lineTerminatedWriter = store.beginRecord(request("record-line-terminated-quoted-assignment"));
  const lineFragments = [
    lineTerminatedWriter.write(`prefix password="A ${quotedSecret}\nvisible`),
  ];
  const lineCommitted = await lineTerminatedWriter.commit();
  lineFragments.push(lineCommitted.finalFragment);
  const lineMirrored = lineFragments.map((fragment) => fragment.text).join("");
  assert.equal(lineMirrored, `prefix ${TRANSCRIPT_REDACTION_PLACEHOLDER}\nvisible`);
  assert.doesNotMatch(lineMirrored, /QUOTE_CANARY|q{256}/);
  assert.equal(store.inspect("auditor").records[1]?.content, lineMirrored);

  const escapedQuoteWriter = store.beginRecord(request("record-escaped-quote-assignment"));
  const escapedFragments = [
    escapedQuoteWriter.write(`prefix password="A \\"${quotedSecret}" suffix`),
  ];
  const escapedCommitted = await escapedQuoteWriter.commit();
  escapedFragments.push(escapedCommitted.finalFragment);
  const escapedMirrored = escapedFragments.map((fragment) => fragment.text).join("");
  assert.equal(escapedMirrored, `prefix ${TRANSCRIPT_REDACTION_PLACEHOLDER} suffix`);
  assert.doesNotMatch(escapedMirrored, /QUOTE_CANARY|q{256}/);
  assert.equal(store.inspect("auditor").records[2]?.content, escapedMirrored);

  const delayedValueWriter = store.beginRecord(request("record-delayed-assignment-value"));
  const delayedFragments = [
    delayedValueWriter.write(`prefix password${" ".repeat(2_500)}=${" ".repeat(2_500)}`),
    delayedValueWriter.write(`${quotedSecret} suffix`),
  ];
  const delayedCommitted = await delayedValueWriter.commit();
  delayedFragments.push(delayedCommitted.finalFragment);
  const delayedMirrored = delayedFragments.map((fragment) => fragment.text).join("");
  assert.equal(delayedMirrored, `prefix ${TRANSCRIPT_REDACTION_PLACEHOLDER} suffix`);
  assert.doesNotMatch(delayedMirrored, /QUOTE_CANARY|q{256}/);
  assert.equal(store.inspect("auditor").records[3]?.content, delayedMirrored);

  await store.close();
  assert.doesNotMatch(await allFileText(root), /QUOTE_CANARY|q{256}/);
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
  await assert.rejects(
    store.commit({}, request("direct-input", "input"), syntheticSecret, 0, false),
    /transcript_commit_not_authorized/,
  );
  assert.equal(Object.hasOwn(store, "state"), false);
  assert.equal(Object.hasOwn(store, "redactor"), false);
  const legitimateWriter = store.beginRecord(request("legitimate-writer"));
  const WriterConstructor = legitimateWriter.constructor as new (...args: unknown[]) => unknown;
  assert.throws(
    () => new WriterConstructor({}, store, request("forged-writer", "stdout", "intruder"), {}),
    /transcript_writer_not_authorized/,
  );
  legitimateWriter.abort();

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
  const { checksum: _checksum, ...tamperedState } = parsed;
  parsed.checksum = createHash("sha256").update(JSON.stringify(tamperedState)).digest("hex");
  await writeFile(snapshot, JSON.stringify(parsed), "utf8");
  await assert.rejects(PersistentTranscriptStore.open(configuration(root)), /transcript_snapshot_invalid/);
});

test("refuses checksummed snapshots that violate record size or time ordering", async (t) => {
  const root = await makeRoot(t);
  let current = baseTime;
  const strictConfiguration = configuration(root, () => current, {
    retention: { maxAgeMs: 60_000, maxRecords: 4, maxTotalBytes: 128, maxRecordBytes: 32 },
  });
  const store = await PersistentTranscriptStore.open(strictConfiguration);
  await append(store, "record-before-oversized-restart", "safe");
  current += 100;
  await append(store, "record-after-oversized-restart", "also-safe");
  await store.close();

  const snapshot = join(root, "transcript-v1.json");
  const original = await readFile(snapshot, "utf8");
  const parsed = JSON.parse(original);
  parsed.records[0].content = "x".repeat(33);
  const { checksum: _checksum, ...tamperedState } = parsed;
  parsed.checksum = createHash("sha256").update(JSON.stringify(tamperedState)).digest("hex");
  await writeFile(snapshot, JSON.stringify(parsed), "utf8");

  await assert.rejects(
    PersistentTranscriptStore.open(strictConfiguration),
    /transcript_snapshot_invalid/,
  );

  const unauthorizedWriter = JSON.parse(original);
  unauthorizedWriter.records[0].writerId = "intruder";
  const { checksum: _writerChecksum, ...writerState } = unauthorizedWriter;
  unauthorizedWriter.checksum = createHash("sha256").update(JSON.stringify(writerState)).digest("hex");
  await writeFile(snapshot, JSON.stringify(unauthorizedWriter), "utf8");
  await assert.rejects(
    PersistentTranscriptStore.open(strictConfiguration),
    /transcript_snapshot_invalid/,
  );

  const futureDated = JSON.parse(original);
  futureDated.records[0].occurredAt = new Date(baseTime + 200).toISOString();
  const { checksum: _futureChecksum, ...futureState } = futureDated;
  futureDated.checksum = createHash("sha256").update(JSON.stringify(futureState)).digest("hex");
  await writeFile(snapshot, JSON.stringify(futureDated), "utf8");
  await assert.rejects(
    PersistentTranscriptStore.open(strictConfiguration),
    /transcript_snapshot_invalid/,
  );

  const outOfOrder = JSON.parse(original);
  outOfOrder.records[1].occurredAt = new Date(baseTime - 100).toISOString();
  const { checksum: _orderChecksum, ...orderedState } = outOfOrder;
  outOfOrder.checksum = createHash("sha256").update(JSON.stringify(orderedState)).digest("hex");
  await writeFile(snapshot, JSON.stringify(outOfOrder), "utf8");
  await assert.rejects(
    PersistentTranscriptStore.open(strictConfiguration),
    /transcript_snapshot_invalid/,
  );
});

test("allows only one active owner of a transcript root and releases it on orderly close", async (t) => {
  const root = await makeRoot(t);
  const first = await PersistentTranscriptStore.open(configuration(root));
  await assert.rejects(PersistentTranscriptStore.open(configuration(root)), /transcript_store_already_active/);
  const writer = first.beginRecord(request("record-before-close"));
  writer.write("safe-before-close");
  const committing = writer.commit();
  const closing = first.close();
  const closingAgain = first.close();
  assert.equal((await committing).record.content, "safe-before-close");
  await Promise.all([closing, closingAgain]);
  assert.throws(() => first.beginRecord(request("record-after-close")), /transcript_store_closed/);
  const staleTemp = "transcript-v1.json.123.00000000-0000-4000-8000-000000000000.tmp";
  const unrelated = "transcript-v1.json.keep.tmp";
  await writeFile(join(root, staleTemp), "sanitized-stale-temp", "utf8");
  const replacement = await PersistentTranscriptStore.open(configuration(root));
  assert.equal(replacement.inspect("operator").records[0]?.recordId, "record-before-close");
  await replacement.close();
  assert.deepEqual((await readdir(root)).sort(), [".morrow-transcript-root.json", "transcript-v1.json"]);

  await writeFile(join(root, unrelated), "operator-owned-name", "utf8");
  await assert.rejects(
    PersistentTranscriptStore.open(configuration(root)),
    /transcript_state_root_contains_foreign_entry/,
  );
  assert.equal(await readFile(join(root, unrelated), "utf8"), "operator-owned-name");
});

test("serializes concurrent stale lease recovery so only one store can acquire the root", async (t) => {
  const root = await makeRoot(t);
  const initialized = await PersistentTranscriptStore.open(configuration(root));
  await initialized.close();
  await writeFile(
    join(root, ".transcript-v1.lock"),
    JSON.stringify({ pid: 2_147_483_647, token: "synthetic-stale-owner" }),
    "utf8",
  );

  const recoveryIdentity = createHash("sha256").update(await realpath(root)).digest("hex");
  const recoveryEndpoint = `\\\\.\\pipe\\morrow-transcript-recovery-${recoveryIdentity}`;
  const holder = spawn(process.execPath, [
    "-e",
    "const net=require('node:net');const server=net.createServer();server.listen(process.argv[1],()=>process.stdout.write('READY\\n'));setInterval(()=>{},1000);",
    recoveryEndpoint,
  ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  t.after(() => {
    if (holder.exitCode === null) holder.kill();
  });
  await new Promise<void>((accept, reject) => {
    let output = "";
    holder.stdout.setEncoding("utf8");
    holder.stdout.on("data", (chunk: string) => {
      output += chunk;
      if (output.includes("READY\n")) accept();
    });
    holder.once("error", reject);
    holder.once("exit", (code) => {
      if (!output.includes("READY\n")) reject(new Error(`recovery_holder_exited:${code}`));
    });
  });
  await assert.rejects(
    PersistentTranscriptStore.open(configuration(root)),
    /transcript_lease_recovery_active/,
  );
  const holderExit = once(holder, "exit");
  holder.kill();
  await holderExit;

  const results = await Promise.allSettled([
    PersistentTranscriptStore.open(configuration(root)),
    PersistentTranscriptStore.open(configuration(root)),
  ]);
  const acquired = results.filter(
    (result): result is PromiseFulfilledResult<PersistentTranscriptStore> => result.status === "fulfilled",
  );
  const refused = results.filter((result) => result.status === "rejected");
  assert.equal(acquired.length, 1);
  assert.equal(refused.length, 1);
  await acquired[0]!.value.close();
  assert.deepEqual(await readdir(root), [".morrow-transcript-root.json"]);
});

test("fails closed on hostile policy collections without invoking accessors", () => {
  for (const conflictingLiteral of ["REDACT", "SENSITIVE_INPUT", "prefix-[REDACTED]-suffix"]) {
    assert.throws(
      () => new StreamRedactor({
        policyId: "placeholder-conflict-policy",
        sensitiveLiterals: [conflictingLiteral],
      }),
      /redaction_literal_invalid/,
    );
  }

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

  const redactor = new StreamRedactor({
    policyId: "encapsulation-policy",
    sensitiveLiterals: [syntheticSecret],
  });
  const session = redactor.start(16_384);
  session.push(syntheticSecret.slice(0, 8));
  assert.deepEqual(Object.getOwnPropertyNames(redactor), ["policyId"]);
  assert.deepEqual(Object.getOwnPropertyNames(session), []);
  session.abort();
});

test("refuses a symbolic snapshot and a junction ancestor without reading outside its canonical root", async (t) => {
  const container = await makeRoot(t);
  const root = join(container, "owned-state");
  const initialized = await PersistentTranscriptStore.open(configuration(root));
  await append(initialized, "record-before-symlink", "safe");
  await initialized.close();
  const controlledTarget = join(container, "controlled-target.json");
  await writeFile(controlledTarget, "controlled-outside-snapshot", "utf8");
  const snapshotLink = join(root, "transcript-v1.json");
  await rm(snapshotLink);
  try {
    await symlink(controlledTarget, snapshotLink, "file");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") {
      t.skip("symbolic links unavailable in this Windows environment");
      return;
    }
    throw error;
  }
  await assert.rejects(
    PersistentTranscriptStore.open(configuration(root)),
    /transcript_snapshot_too_large_or_invalid/,
  );
  await rm(snapshotLink);

  const actualParent = join(container, "actual-parent");
  const junctionParent = join(container, "junction-parent");
  await mkdir(actualParent);
  await symlink(actualParent, junctionParent, "junction");
  await assert.rejects(
    PersistentTranscriptStore.open(configuration(join(junctionParent, "state"))),
    /transcript_state_root_unsafe/,
  );
  assert.deepEqual(await readdir(actualParent), []);
});

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
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

  const structured = redactor.redact('{"password":"json-only-secret","safe":true}');
  assert.equal(structured.text, `{${TRANSCRIPT_REDACTION_PLACEHOLDER},"safe":true}`);
  assert.doesNotMatch(structured.text, /json-only-secret/);
  const basicAuthorization = redactor.redact("Authorization: Basic dXNlcjpwYXNz");
  assert.equal(basicAuthorization.text, TRANSCRIPT_REDACTION_PLACEHOLDER);
  assert.doesNotMatch(basicAuthorization.text, /dXNlcjpwYXNz/);
});

test("keeps redaction mechanics runtime-private against consumer overrides", async (t) => {
  assert.equal(Object.isFrozen(StreamRedactor.prototype), true);
  assert.equal(Object.getOwnPropertyDescriptor(StreamRedactor.prototype, "ranges"), undefined);
  assert.equal(Reflect.set(StreamRedactor.prototype, "ranges", () => []), false);

  const redactor = new StreamRedactor({ policyId: "runtime-private-policy", sensitiveLiterals: [] });
  assert.equal(Object.isFrozen(redactor), true);
  assert.equal(Reflect.set(redactor, "redact", () => ({ text: "unsafe", redactionCount: 0 })), false);
  assert.equal(redactor.redact("password=PROTOTYPE_DIRECT_CANARY").text, TRANSCRIPT_REDACTION_PLACEHOLDER);

  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(configuration(root));
  const writer = store.beginRecord(request("record-runtime-private-redaction"));
  const fragments = [writer.write("password=PROTOTYPE_STORE_CANARY")];
  const committed = await writer.commit();
  fragments.push(committed.finalFragment);
  const liveText = fragments.map((fragment) => fragment.text).join("");
  assert.equal(liveText, TRANSCRIPT_REDACTION_PLACEHOLDER);
  assert.doesNotMatch(store.inspect("operator").records[0]?.content ?? "", /PROTOTYPE_STORE_CANARY/);
  await store.close();
  assert.doesNotMatch(await allFileText(root), /PROTOTYPE_STORE_CANARY/);
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

test("redacts PowerShell quote escaping structurally across chunks and every transcript channel", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(configuration(root));
  const writer = store.beginRecord(request("record-powershell-escaped-quotes"));
  const backtick = String.fromCharCode(96);
  const fragments = [
    writer.write(`visible-prefix-${"x".repeat(5_000)} $pass`),
    writer.write(`word = "alpha${backtick}`),
    writer.write(`"POWERSHELL_BACKTICK_ESCAPE_CANARY omega"; $env:CLIENT_SE`),
    writer.write(`CRET = 'alpha''POWERSHELL_DOUBLED_ESCAPE_CANARY omega'; `),
    writer.write(`$clientSecretary = "public${backtick}"quoted"; $apiKeyboardLayout = 'public''quoted'`),
  ];
  const committed = await writer.commit();
  fragments.push(committed.finalFragment);

  const sensitiveCanaries = /POWERSHELL_(?:BACKTICK|DOUBLED)_ESCAPE_CANARY/;
  const liveText = fragments.map((fragment) => fragment.text).join("");
  for (const fragment of fragments) assert.doesNotMatch(fragment.text, sensitiveCanaries);
  assert.doesNotMatch(liveText, sensitiveCanaries);
  assert.ok(fragments.slice(0, -1).some((fragment) => fragment.text.length > 0));
  assert.match(liveText, /clientSecretary = "public`"quoted"/);
  assert.match(liveText, /apiKeyboardLayout = 'public''quoted'/);
  assert.ok((liveText.match(/\[REDACTED\]/gu) ?? []).length >= 2);

  const inspected = store.inspect("operator").records[0]?.content ?? "";
  assert.equal(inspected, liveText);
  assert.doesNotMatch(inspected, sensitiveCanaries);
  assert.match(inspected, /public`"quoted|public''quoted/);
  await store.close();

  const disk = await allFileText(root);
  assert.doesNotMatch(disk, sensitiveCanaries);
  assert.match(disk, /public`\\"quoted|public''quoted/);
});

test("redacts camelCase sensitive-key categories across chunks before live return and persistence", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(configuration(root));
  const writer = store.beginRecord(request("record-camel-case-assignments"));
  const fragments = [
    writer.write(`visible-prefix-${"x".repeat(5_000)} {"clientSe`),
    writer.write(`cret":"CAMEL_CLIENT_SECRET_CANARY","accessTo`),
    writer.write(`ken":"CAMEL_ACCESS_TOKEN_CANARY","refreshToken":"CAMEL_REFRESH_TOKEN_CANARY",`),
    writer.write(`"apiKey":"CAMEL_API_KEY_CANARY","serviceCredential":"CAMEL_CREDENTIAL_CANARY",`),
    writer.write(`"clientSecretary":"public-secretary","accessTokenizer":"public-tokenizer",`),
    writer.write(`"passwordlessMode":"enabled","credentialedUser":"public-user",`),
    writer.write(`"apiKeyboardLayout":"public-layout"}`),
  ];
  const committed = await writer.commit();
  fragments.push(committed.finalFragment);

  const liveText = fragments.map((fragment) => fragment.text).join("");
  const sensitiveCanaries = /CAMEL_(?:CLIENT_SECRET|ACCESS_TOKEN|REFRESH_TOKEN|API_KEY|CREDENTIAL)_CANARY/;
  for (const fragment of fragments) assert.doesNotMatch(fragment.text, sensitiveCanaries);
  assert.doesNotMatch(liveText, sensitiveCanaries);
  assert.ok(fragments.slice(0, -1).some((fragment) => fragment.text.length > 0));
  assert.match(liveText, /visible-prefix-/);
  assert.match(liveText, /public-secretary/);
  assert.match(liveText, /public-tokenizer/);
  assert.match(liveText, /"passwordlessMode":"enabled"/);
  assert.match(liveText, /"credentialedUser":"public-user"/);
  assert.match(liveText, /"apiKeyboardLayout":"public-layout"/);
  assert.ok((liveText.match(/\[REDACTED\]/gu) ?? []).length >= 5);

  const inspected = store.inspect("operator").records[0]?.content ?? "";
  assert.equal(inspected, liveText);
  assert.doesNotMatch(inspected, sensitiveCanaries);
  assert.match(inspected, /public-secretary|public-tokenizer|public-layout/);
  await store.close();

  const disk = await allFileText(root);
  assert.doesNotMatch(disk, sensitiveCanaries);
  assert.match(disk, /public-secretary/);
  assert.match(disk, /public-tokenizer/);
  assert.match(disk, /public-layout/);
});

test("applies backspace semantics and fails closed on broader cursor rewrites before redaction", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(configuration(root));
  const writer = store.beginRecord(request("record-terminal-overwrite-assignments"));
  const fragments = [
    writer.write(`visible-prefix-${"x".repeat(5_000)} passX`),
    writer.write(`\bword=BACKSPACE_SECRET_CANARY versX\bion=1\n`),
    writer.write(`passX\u001b[1Dword=CSI_SECRET_CANARY status=ok\rpassword=CR_SECRET_CANARY`),
  ];
  const committed = await writer.commit();
  fragments.push(committed.finalFragment);

  const sensitiveCanaries = /(?:BACKSPACE|CSI|CR)_SECRET_CANARY/;
  const liveText = fragments.map((fragment) => fragment.text).join("");
  for (const fragment of fragments) assert.doesNotMatch(fragment.text, sensitiveCanaries);
  assert.doesNotMatch(liveText, sensitiveCanaries);
  assert.ok(fragments.slice(0, -1).some((fragment) => fragment.text.length > 0));
  assert.match(liveText, /visible-prefix-/);
  assert.match(liveText, /version=1/);
  assert.ok((liveText.match(/\[REDACTED\]/gu) ?? []).length >= 2);

  const inspected = store.inspect("operator").records[0]?.content ?? "";
  assert.equal(inspected, liveText);
  assert.doesNotMatch(inspected, sensitiveCanaries);
  assert.match(inspected, /version=1/);
  await store.close();

  const disk = await allFileText(root);
  assert.doesNotMatch(disk, sensitiveCanaries);
  assert.match(disk, /version=1/);
});

test("consumes terminal string controls and fail-closes the existing line on cursor rewrites", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(configuration(root));
  const writer = store.beginRecord(request("record-terminal-string-controls"));
  const fragments = [
    writer.write(`visible-prefix-${"x".repeat(5_000)}\npass\u001b_${"i".repeat(5_000)}\u001b`),
    writer.write(`\\word=APC_CONTROL_CANARY\nclient\u001bPignored\u001b\\Secret=DCS_CONTROL_CANARY\n`),
    writer.write(`api\u001b^ignored\u001b\\Key=PM_CONTROL_CANARY\naccess\u009fignored\u009cToken=C1_APC_CONTROL_CANARY\n`),
    writer.write(`passxord=CURSOR_REWRITE_CANARY\u001b[5Gw\nsafeField=visible`),
  ];
  const committed = await writer.commit();
  fragments.push(committed.finalFragment);

  const sensitiveCanaries = /(?:APC|DCS|PM|C1_APC)_CONTROL_CANARY|CURSOR_REWRITE_CANARY/;
  const liveText = fragments.map((fragment) => fragment.text).join("");
  for (const fragment of fragments) assert.doesNotMatch(fragment.text, sensitiveCanaries);
  assert.doesNotMatch(liveText, sensitiveCanaries);
  assert.match(liveText, /visible-prefix-/);
  assert.match(liveText, /safeField=visible/);
  assert.equal(liveText.includes("ignored"), false);

  const inspected = store.inspect("operator").records[0]?.content ?? "";
  assert.equal(inspected, liveText);
  assert.doesNotMatch(inspected, sensitiveCanaries);
  assert.match(inspected, /safeField=visible/);
  await store.close();

  const disk = await allFileText(root);
  assert.doesNotMatch(disk, sensitiveCanaries);
  assert.match(disk, /safeField=visible/);
});

test("bounds repeated cursor-control normalization while fail-closing the affected line", () => {
  const redactor = new StreamRedactor({ policyId: "cursor-control-complexity", sensitiveLiterals: [] });
  const unit = `safe\u001b[1D`;
  const targetBytes = 60 * 1024;
  const repeated = unit.repeat(Math.floor(targetBytes / Buffer.byteLength(unit)));
  const input = repeated + "s".repeat(targetBytes - Buffer.byteLength(repeated));

  redactor.redact(unit.repeat(64));
  const started = performance.now();
  const result = redactor.redact(input);
  const elapsedMs = performance.now() - started;

  assert.equal(Buffer.byteLength(input), targetBytes);
  assert.equal(input.includes("\r") || input.includes("\n"), false);
  assert.equal(result.text, TRANSCRIPT_REDACTION_PLACEHOLDER);
  assert.ok(elapsedMs < 750, `cursor_control_normalization_too_slow:${elapsedMs.toFixed(1)}ms`);
});

test("redacts sensitive components in quoted dotted keys across chunks without matching substrings", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(configuration(root));
  const writer = store.beginRecord(request("record-quoted-dotted-assignments"));
  const fragments = [
    writer.write(`visible-prefix-${"x".repeat(5_000)} {"request.headers.author`),
    writer.write(`ization":"Basic DOTTED_AUTH_CANARY","oauth.clientSe`),
    writer.write(`cret":"DOTTED_SECRET_CANARY","request.headers.contentType":"public/type",`),
    writer.write(`"meta.clientSecretary":"public-secretary","metrics.accessTokenizer":"public-tokenizer"}`),
  ];
  const committed = await writer.commit();
  fragments.push(committed.finalFragment);

  const sensitiveCanaries = /DOTTED_(?:AUTH|SECRET)_CANARY/;
  const liveText = fragments.map((fragment) => fragment.text).join("");
  for (const fragment of fragments) assert.doesNotMatch(fragment.text, sensitiveCanaries);
  assert.doesNotMatch(liveText, sensitiveCanaries);
  assert.ok(fragments.slice(0, -1).some((fragment) => fragment.text.length > 0));
  assert.match(liveText, /"request\.headers\.contentType":"public\/type"/);
  assert.match(liveText, /"meta\.clientSecretary":"public-secretary"/);
  assert.match(liveText, /"metrics\.accessTokenizer":"public-tokenizer"/);
  assert.ok((liveText.match(/\[REDACTED\]/gu) ?? []).length >= 2);

  const inspected = store.inspect("operator").records[0]?.content ?? "";
  assert.equal(inspected, liveText);
  assert.doesNotMatch(inspected, sensitiveCanaries);
  assert.match(inspected, /public\/type|public-secretary|public-tokenizer/);
  await store.close();

  const disk = await allFileText(root);
  assert.doesNotMatch(disk, sensitiveCanaries);
  assert.match(disk, /public\/type/);
  assert.match(disk, /public-secretary/);
  assert.match(disk, /public-tokenizer/);
});

test("keeps multiline assignment values pending across structural whitespace and chunks", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(configuration(root));
  const writer = store.beginRecord(request("record-multiline-assignments"));
  const fragments = [
    writer.write(`visible-prefix-${"x".repeat(5_000)} {"password":\r`),
    writer.write(`\n  "MULTILINE_JSON_CANARY",\n  "oauth.apiKey":`),
    writer.write(`\n  "MULTILINE_DOTTED_CANARY"}\nserviceCredential:`),
    writer.write(`\n  MULTILINE_YAML_CANARY\nsafeField:\n  public-value`),
  ];
  const committed = await writer.commit();
  fragments.push(committed.finalFragment);

  const sensitiveCanaries = /MULTILINE_(?:JSON|DOTTED|YAML)_CANARY/;
  const liveText = fragments.map((fragment) => fragment.text).join("");
  for (const fragment of fragments) assert.doesNotMatch(fragment.text, sensitiveCanaries);
  assert.doesNotMatch(liveText, sensitiveCanaries);
  assert.ok(fragments.slice(0, -1).some((fragment) => fragment.text.length > 0));
  assert.match(liveText, /safeField:\n  public-value/);
  assert.ok((liveText.match(/\[REDACTED\]/gu) ?? []).length >= 3);

  const inspected = store.inspect("operator").records[0]?.content ?? "";
  assert.equal(inspected, liveText);
  assert.doesNotMatch(inspected, sensitiveCanaries);
  assert.match(inspected, /safeField:\n  public-value/);
  await store.close();

  const disk = await allFileText(root);
  assert.doesNotMatch(disk, sensitiveCanaries);
  assert.match(disk, /safeField:\\n  public-value/);
});

test("redacts multiline quoted and whitespace-containing YAML scalars without consuming safe fields", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(configuration(root));
  const writer = store.beginRecord(request("record-yaml-quoted-and-plain-scalars"));
  const fragments = [
    writer.write(`visible-prefix-${"x".repeat(5_000)}\npassword: "first`),
    writer.write(`\n  YAML_MULTILINE_QUOTED_CANARY"\nclientSecret: 'alpha''YAML_DOUBLED_QUOTE_CANARY omega'\n`),
    writer.write(`apiKey: correct horse YAML_PLAIN_SPACES_CANARY staple # synthetic comment\n`),
    writer.write(`safeField: correct horse battery staple\nsafeQuoted: "first\n  public continuation"`),
  ];
  const committed = await writer.commit();
  fragments.push(committed.finalFragment);

  const sensitiveCanaries = /YAML_(?:MULTILINE_QUOTED|DOUBLED_QUOTE|PLAIN_SPACES)_CANARY/;
  const liveText = fragments.map((fragment) => fragment.text).join("");
  for (const fragment of fragments) assert.doesNotMatch(fragment.text, sensitiveCanaries);
  assert.doesNotMatch(liveText, sensitiveCanaries);
  assert.match(liveText, /# synthetic comment/);
  assert.match(liveText, /safeField: correct horse battery staple/);
  assert.match(liveText, /safeQuoted: "first\n  public continuation"/);

  const inspected = store.inspect("operator").records[0]?.content ?? "";
  assert.equal(inspected, liveText);
  assert.doesNotMatch(inspected, sensitiveCanaries);
  assert.match(inspected, /safeField: correct horse battery staple/);
  await store.close();

  const disk = await allFileText(root);
  assert.doesNotMatch(disk, sensitiveCanaries);
  assert.match(disk, /safeField: correct horse battery staple/);
});

test("redacts complete quoted space-delimited sensitive keys without matching similar phrases", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(configuration(root));
  const writer = store.beginRecord(request("record-space-delimited-keys"));
  const fragments = [
    writer.write(`visible-prefix-${"x".repeat(5_000)} {"API `),
    writer.write(`Key":"SPACE_API_KEY_CANARY","Client Se`),
    writer.write(`cret":"SPACE_CLIENT_SECRET_CANARY","API Keyboard":"public-keyboard",`),
    writer.write(`"Client Secretariat":"public-secretariat","Access Tokenizer":"public-tokenizer"}`),
  ];
  const committed = await writer.commit();
  fragments.push(committed.finalFragment);

  const sensitiveCanaries = /SPACE_(?:API_KEY|CLIENT_SECRET)_CANARY/;
  const liveText = fragments.map((fragment) => fragment.text).join("");
  for (const fragment of fragments) assert.doesNotMatch(fragment.text, sensitiveCanaries);
  assert.doesNotMatch(liveText, sensitiveCanaries);
  assert.match(liveText, /"API Keyboard":"public-keyboard"/);
  assert.match(liveText, /"Client Secretariat":"public-secretariat"/);
  assert.match(liveText, /"Access Tokenizer":"public-tokenizer"/);

  const inspected = store.inspect("operator").records[0]?.content ?? "";
  assert.equal(inspected, liveText);
  assert.doesNotMatch(inspected, sensitiveCanaries);
  await store.close();

  const disk = await allFileText(root);
  assert.doesNotMatch(disk, sensitiveCanaries);
  assert.match(disk, /public-keyboard|public-secretariat|public-tokenizer/);
});

test("keeps YAML block scalar contents inside the sensitive assignment across chunks", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(configuration(root));
  const writer = store.beginRecord(request("record-yaml-block-scalars"));
  const fragments = [
    writer.write(`visible-prefix-${"x".repeat(5_000)} password: |`),
    writer.write(`- # synthetic fixture\n  BLOCK_LITERAL_CANARY_LINE_ONE\n`),
    writer.write(`  BLOCK_LITERAL_CANARY_LINE_TWO\nsafeField: public-value\nclientSecret: >`),
    writer.write(`\n  BLOCK_FOLDED_CANARY_LINE_ONE\n  BLOCK_FOLDED_CANARY_LINE_TWO\nsafeAfter: public-after`),
    writer.write(`\nitems:\n  - password: |\n      BLOCK_SEQUENCE_CANARY\n    safeSequence: visible-sequence\nsafeAfterSequence: visible-root`),
  ];
  const committed = await writer.commit();
  fragments.push(committed.finalFragment);

  const sensitiveCanaries = /BLOCK_(?:(?:LITERAL|FOLDED)_CANARY_LINE_(?:ONE|TWO)|SEQUENCE_CANARY)/;
  const liveText = fragments.map((fragment) => fragment.text).join("");
  for (const fragment of fragments) assert.doesNotMatch(fragment.text, sensitiveCanaries);
  assert.doesNotMatch(liveText, sensitiveCanaries);
  assert.match(liveText, /safeField: public-value/);
  assert.match(liveText, /safeAfter: public-after/);
  assert.match(liveText, /safeSequence: visible-sequence/);
  assert.match(liveText, /safeAfterSequence: visible-root/);
  assert.ok((liveText.match(/\[REDACTED\]/gu) ?? []).length >= 2);

  const inspected = store.inspect("operator").records[0]?.content ?? "";
  assert.equal(inspected, liveText);
  assert.doesNotMatch(inspected, sensitiveCanaries);
  assert.match(inspected, /safeField: public-value|safeAfter: public-after|safeSequence: visible-sequence/);
  await store.close();

  const disk = await allFileText(root);
  assert.doesNotMatch(disk, sensitiveCanaries);
  assert.match(disk, /safeField: public-value/);
  assert.match(disk, /safeAfter: public-after/);
  assert.match(disk, /safeSequence: visible-sequence/);
  assert.match(disk, /safeAfterSequence: visible-root/);
});

test("persists and returns only redacted output while dropping terminal input by default", async (t) => {
  const root = await makeRoot(t);
  const store = await PersistentTranscriptStore.open(configuration(root));
  const writer = store.beginRecord(request("record-output"));
  const mirrored = [
    writer.write(`before ${syntheticSecret.slice(0, 10)}`),
    writer.write(
      `${syntheticSecret.slice(10)} after {"password":"json-persist-canary"} Authorization: Basic cGVyc2lzdC1jYW5hcnk=`,
    ),
  ];
  const committed = await writer.commit();
  mirrored.push(committed.finalFragment);
  const mirrorText = mirrored.map((fragment) => fragment.text).join("");
  assert.doesNotMatch(mirrorText, new RegExp(syntheticSecret));
  assert.doesNotMatch(mirrorText, /json-persist-canary|cGVyc2lzdC1jYW5hcnk=/);
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
  assert.doesNotMatch(disk, /json-persist-canary|cGVyc2lzdC1jYW5hcnk=/);
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

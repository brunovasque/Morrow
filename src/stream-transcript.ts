import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  link,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

export const TRANSCRIPT_FORMAT = "morrow.transcript/1.0" as const;
export const TRANSCRIPT_REDACTION_PLACEHOLDER = "[REDACTED]" as const;
export const SENSITIVE_INPUT_PLACEHOLDER = "[SENSITIVE_INPUT_REDACTED]" as const;

export type TranscriptStream = "stdout" | "stderr" | "input" | "system";

export interface TranscriptRetentionPolicy {
  maxAgeMs: number;
  maxRecords: number;
  maxTotalBytes: number;
  maxRecordBytes: number;
}

export interface TranscriptAccessPolicy {
  writerIds: readonly string[];
  readerIds: readonly string[];
}

export interface StreamRedactionPolicy {
  policyId: string;
  sensitiveLiterals: readonly string[];
}

export interface PersistentTranscriptConfiguration {
  stateRoot: string;
  retention: TranscriptRetentionPolicy;
  access: TranscriptAccessPolicy;
  redaction: StreamRedactionPolicy;
  clock?: () => string | number | Date;
}

export interface TranscriptRecordRequest {
  recordId: string;
  contractId: string;
  stepId: string;
  terminalSessionId: string;
  agentInstanceId: string;
  stream: TranscriptStream;
  writerId: string;
}

export interface TranscriptRecord {
  ordinal: number;
  recordId: string;
  contractId: string;
  stepId: string;
  terminalSessionId: string;
  agentInstanceId: string;
  stream: TranscriptStream;
  writerId: string;
  occurredAt: string;
  content: string;
  redactionCount: number;
  sensitiveInput: boolean;
}

export interface RedactedStreamFragment {
  text: string;
  redactionCount: number;
}

export interface TranscriptCommitResult {
  record: TranscriptRecord;
  finalFragment: RedactedStreamFragment;
  evictedRecordIds: readonly string[];
}

export interface TranscriptView {
  format: typeof TRANSCRIPT_FORMAT;
  redactionPolicyId: string;
  revision: number;
  updatedAt: string;
  retention: TranscriptRetentionPolicy;
  records: readonly TranscriptRecord[];
  totalBytes: number;
}

interface TranscriptState {
  format: typeof TRANSCRIPT_FORMAT;
  redactionPolicyId: string;
  revision: number;
  nextOrdinal: number;
  updatedAt: string;
  retention: TranscriptRetentionPolicy;
  access: NormalizedAccessPolicy;
  records: TranscriptRecord[];
}

interface PersistedTranscriptState extends TranscriptState {
  checksum: string;
}

interface NormalizedAccessPolicy {
  writerIds: string[];
  readerIds: string[];
}

interface RedactionRange {
  start: number;
  end: number;
  replacement: "redact" | "drop";
}

interface NormalizedTerminalText {
  visible: string;
  rawStarts: number[];
  rawEnds: number[];
  controlRanges: RedactionRange[];
}

const transcriptFileName = "transcript-v1.json";
const leaseFileName = ".transcript-v1.lock";
const leaseRecoveryFileName = ".transcript-v1.lock.recovery";
const rootMarkerFileName = ".morrow-transcript-root.json";
const rootMarkerFormat = "morrow.transcript-root/1" as const;
const maximumSnapshotBytes = 16_777_216;
const maximumLiteralCount = 64;
const maximumLiteralLength = 4_096;
const genericPatternHoldback = 4_096;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const canonicalTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const unicodeFormatControlPattern = /^\p{Cf}$/u;
const assignmentKeyPattern = /(?<![A-Za-z0-9_])(?:[A-Za-z0-9]+_)*(?:token|secret|password|credential|authorization|api[_-]?key)(?:_[A-Za-z0-9]+)*(?![A-Za-z0-9_])/giu;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/giu;
const commonTokenPatterns = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/gu,
  /\bsk-[A-Za-z0-9_-]{16,}\b/gu,
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/gu,
] as const;
const privateKeyPattern = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/gu;
const transcriptCommitAuthority = Object.freeze({ kind: "morrow.transcript.commit" });
const transcriptWriterAuthority = Object.freeze({ kind: "morrow.transcript.writer" });

export class StreamRedactor {
  readonly policyId: string;
  #literals: readonly string[];
  #holdback: number;

  constructor(policy: StreamRedactionPolicy) {
    try {
      if (!isPlainDataRecord(policy) || !hasExactDataKeys(policy, ["policyId", "sensitiveLiterals"])) {
        throw transcriptError("redaction_policy_invalid");
      }
      const policyId = ownDataValue(policy, "policyId");
      const sensitiveLiterals = ownDataValue(policy, "sensitiveLiterals");
      if (!isIdentifier(policyId) || !isDataArray(sensitiveLiterals)) {
        throw transcriptError("redaction_policy_invalid");
      }
      if (sensitiveLiterals.length > maximumLiteralCount) {
        throw transcriptError("redaction_literal_capacity_exceeded");
      }
      const literals: string[] = [];
      for (let index = 0; index < sensitiveLiterals.length; index += 1) {
        const literal = readDataArrayElement(sensitiveLiterals, index);
        if (
          typeof literal !== "string"
          || literal.length < 4
          || literal.length > maximumLiteralLength
          || markerConflictsWithLiteral(TRANSCRIPT_REDACTION_PLACEHOLDER, literal)
          || markerConflictsWithLiteral(SENSITIVE_INPUT_PLACEHOLDER, literal)
        ) throw transcriptError("redaction_literal_invalid");
        if (!literals.includes(literal)) literals.push(literal);
      }
      this.policyId = policyId;
      this.#literals = Object.freeze([...literals]);
      this.#holdback = Math.max(genericPatternHoldback, ...literals.map((literal) => literal.length - 1));
    } catch (error) {
      if (isTranscriptError(error)) throw error;
      throw transcriptError("redaction_policy_inspection_failed");
    }
  }

  start(maxPendingBytes: number): StreamRedactorSession {
    if (!Number.isSafeInteger(maxPendingBytes) || maxPendingBytes < 1) {
      throw transcriptError("redaction_pending_limit_invalid");
    }
    return new StreamRedactorSession(this, maxPendingBytes);
  }

  redact(text: string): RedactedStreamFragment {
    if (typeof text !== "string") throw transcriptError("redaction_text_invalid");
    const ranges = this.ranges(text);
    return deepFreeze({ text: renderRedacted(text, ranges), redactionCount: countRedactions(ranges) });
  }

  release(pending: string, final: boolean): { released: RedactedStreamFragment; remainder: string } {
    const ranges = this.ranges(pending);
    if (final) {
      return {
        released: deepFreeze({ text: renderRedacted(pending, ranges), redactionCount: countRedactions(ranges) }),
        remainder: "",
      };
    }
    if (pending.length <= this.#holdback) {
      return { released: deepFreeze({ text: "", redactionCount: 0 }), remainder: pending };
    }
    let cut = pending.length - this.#holdback;
    for (const range of ranges) {
      if (range.start < cut && range.end > cut) cut = range.start;
    }
    const prefixRanges = ranges.filter((range) => range.end <= cut);
    return {
      released: deepFreeze({
        text: renderRedacted(pending.slice(0, cut), prefixRanges),
        redactionCount: countRedactions(prefixRanges),
      }),
      remainder: pending.slice(cut),
    };
  }

  private ranges(text: string): RedactionRange[] {
    const terminal = normalizeTerminalText(text);
    const ranges: RedactionRange[] = [...terminal.controlRanges];
    for (const literal of this.#literals) {
      collectLiteralRanges(text, literal, ranges);
      collectMappedLiteralRanges(terminal, literal, ranges);
    }
    collectAssignmentRanges(text, ranges);
    collectPatternRanges(text, bearerPattern, ranges);
    for (const pattern of commonTokenPatterns) collectPatternRanges(text, pattern, ranges);
    collectPatternRanges(text, privateKeyPattern, ranges);
    collectMappedAssignmentRanges(terminal, ranges);
    collectMappedPatternRanges(terminal, bearerPattern, ranges);
    for (const pattern of commonTokenPatterns) collectMappedPatternRanges(terminal, pattern, ranges);
    collectMappedPatternRanges(terminal, privateKeyPattern, ranges);
    return mergeRanges(ranges);
  }
}

export class StreamRedactorSession {
  #redactor: StreamRedactor;
  #maxPendingBytes: number;
  #pending = "";
  #pendingBytes = 0;
  #finished = false;

  constructor(redactor: StreamRedactor, maxPendingBytes: number) {
    this.#redactor = redactor;
    this.#maxPendingBytes = maxPendingBytes;
  }

  push(chunk: string): RedactedStreamFragment {
    if (this.#finished) throw transcriptError("redaction_session_finished");
    if (typeof chunk !== "string") throw transcriptError("redaction_chunk_invalid");
    const chunkBytes = Buffer.byteLength(chunk, "utf8");
    if (this.#pendingBytes + chunkBytes > this.#maxPendingBytes) {
      this.#finished = true;
      this.#pending = "";
      this.#pendingBytes = 0;
      throw transcriptError("redaction_pending_capacity_exceeded");
    }
    this.#pending += chunk;
    this.#pendingBytes += chunkBytes;
    const result = this.#redactor.release(this.#pending, false);
    this.#pending = result.remainder;
    this.#pendingBytes = Buffer.byteLength(this.#pending, "utf8");
    return result.released;
  }

  finish(): RedactedStreamFragment {
    if (this.#finished) throw transcriptError("redaction_session_finished");
    this.#finished = true;
    const result = this.#redactor.release(this.#pending, true).released;
    this.#pending = "";
    this.#pendingBytes = 0;
    return result;
  }

  abort(): void {
    this.#finished = true;
    this.#pending = "";
    this.#pendingBytes = 0;
  }
}

export class PersistentTranscriptStore {
  #filePath: string;
  #retention: TranscriptRetentionPolicy;
  #access: NormalizedAccessPolicy;
  #redactor: StreamRedactor;
  #clock: (() => string | number | Date) | undefined;
  #lease: TranscriptLease;
  #state: TranscriptState;
  #mutationTail: Promise<void> = Promise.resolve();
  #closed = false;
  #closeOperation: Promise<void> | null = null;

  private constructor(
    root: string,
    retention: TranscriptRetentionPolicy,
    access: NormalizedAccessPolicy,
    redactor: StreamRedactor,
    clock: (() => string | number | Date) | undefined,
    lease: TranscriptLease,
    state: TranscriptState,
  ) {
    this.#filePath = join(root, transcriptFileName);
    this.#retention = retention;
    this.#access = access;
    this.#redactor = redactor;
    this.#clock = clock;
    this.#lease = lease;
    this.#state = state;
  }

  static async open(configuration: PersistentTranscriptConfiguration): Promise<PersistentTranscriptStore> {
    let normalized: ReturnType<typeof normalizeConfiguration>;
    try {
      normalized = normalizeConfiguration(configuration);
    } catch (error) {
      if (isTranscriptError(error)) throw error;
      throw transcriptError("transcript_configuration_inspection_failed");
    }
    const root = await prepareStateRoot(normalized.stateRoot);
    const lease = await TranscriptLease.acquire(root);
    try {
      await cleanupOwnedTemps(root);
      const filePath = join(root, transcriptFileName);
      const loaded = await loadState(filePath, normalized.retention, normalized.access, normalized.redactor);
      const now = trustedNow(normalized.clock);
      const state = loaded ?? initialState(normalized.retention, normalized.access, normalized.redactor.policyId, now);
      if (Date.parse(now) < Date.parse(state.updatedAt)) throw transcriptError("transcript_clock_moved_backwards");
      const store = new PersistentTranscriptStore(
        root,
        normalized.retention,
        normalized.access,
        normalized.redactor,
        normalized.clock,
        lease,
        state,
      );
      if (loaded) await store.#sweepRetentionInternal(now);
      return store;
    } catch (error) {
      await lease.release().catch(() => undefined);
      throw error;
    }
  }

  beginRecord(input: unknown): TranscriptRecordWriter {
    this.assertOpen();
    let request: TranscriptRecordRequest;
    try {
      request = parseRecordRequest(input);
    } catch {
      throw transcriptError("transcript_record_request_invalid");
    }
    if (!this.#access.writerIds.includes(request.writerId)) throw transcriptError("transcript_write_not_authorized");
    return new TranscriptRecordWriter(
      transcriptWriterAuthority,
      this,
      request,
      this.#redactor.start(this.#retention.maxRecordBytes),
    );
  }

  recordByteLimit(): number {
    return this.#retention.maxRecordBytes;
  }

  inspect(readerId: string): TranscriptView {
    this.assertOpen();
    if (!isIdentifier(readerId) || !this.#access.readerIds.includes(readerId)) {
      throw transcriptError("transcript_read_not_authorized");
    }
    return viewState(this.#state);
  }

  async sweepRetention(actorId: string): Promise<readonly string[]> {
    this.assertOpen();
    if (!isIdentifier(actorId) || !this.#access.writerIds.includes(actorId)) {
      throw transcriptError("transcript_write_not_authorized");
    }
    return await this.#serialize(async () => await this.#sweepRetentionInternal(trustedNow(this.#clock)));
  }

  async close(): Promise<void> {
    if (this.#closeOperation) return await this.#closeOperation;
    this.#closed = true;
    this.#closeOperation = (async () => {
      await this.#mutationTail.catch(() => undefined);
      await this.#lease.release();
    })();
    return await this.#closeOperation;
  }

  async commit(
    authority: object,
    request: TranscriptRecordRequest,
    content: string,
    redactionCount: number,
    sensitiveInput: boolean,
  ): Promise<{ record: TranscriptRecord; evictedRecordIds: readonly string[] }> {
    if (authority !== transcriptCommitAuthority) throw transcriptError("transcript_commit_not_authorized");
    this.assertOpen();
    return await this.#serialize(async () => {
      if (!this.#access.writerIds.includes(request.writerId)) {
        throw transcriptError("transcript_write_not_authorized");
      }
      if (Buffer.byteLength(content, "utf8") > this.#retention.maxRecordBytes) {
        throw transcriptError("transcript_record_too_large");
      }
      if (
        this.#redactor.redact(content).text !== content
        || (request.stream === "input") !== sensitiveInput
        || (sensitiveInput && content !== SENSITIVE_INPUT_PLACEHOLDER && content !== "")
      ) {
        throw transcriptError("transcript_content_not_redacted");
      }
      if (this.#state.records.some((record) => record.recordId === request.recordId)) {
        throw transcriptError("transcript_record_id_conflict");
      }
      const now = trustedNow(this.#clock);
      if (Date.parse(now) < Date.parse(this.#state.updatedAt)) throw transcriptError("transcript_clock_moved_backwards");
      const record: TranscriptRecord = {
        ordinal: this.#state.nextOrdinal,
        recordId: request.recordId,
        contractId: request.contractId,
        stepId: request.stepId,
        terminalSessionId: request.terminalSessionId,
        agentInstanceId: request.agentInstanceId,
        stream: request.stream,
        writerId: request.writerId,
        occurredAt: now,
        content,
        redactionCount,
        sensitiveInput,
      };
      const draft = cloneState(this.#state);
      draft.records.push(record);
      draft.nextOrdinal += 1;
      draft.revision += 1;
      draft.updatedAt = now;
      const evictedRecordIds = applyRetention(draft, now);
      await persistState(this.#filePath, draft);
      this.#state = draft;
      return deepFreeze({ record: cloneRecord(record), evictedRecordIds: [...evictedRecordIds] });
    });
  }

  async #sweepRetentionInternal(now: string): Promise<readonly string[]> {
    const draft = cloneState(this.#state);
    const evicted = applyRetention(draft, now);
    if (evicted.length === 0) return Object.freeze([]);
    draft.revision += 1;
    draft.updatedAt = now;
    await persistState(this.#filePath, draft);
    this.#state = draft;
    return Object.freeze([...evicted]);
  }

  async #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.#mutationTail;
    let release: () => void = () => undefined;
    this.#mutationTail = new Promise<void>((resolvePromise) => { release = resolvePromise; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private assertOpen(): void {
    if (this.#closed) throw transcriptError("transcript_store_closed");
  }
}

class TranscriptRecordWriter {
  #store: PersistentTranscriptStore;
  #request: TranscriptRecordRequest;
  #session: StreamRedactorSession;
  #parts: string[] = [];
  #redactionCount = 0;
  #rawBytes = 0;
  #finished = false;
  #sensitiveMarkerWritten = false;

  constructor(
    authority: object,
    store: PersistentTranscriptStore,
    request: TranscriptRecordRequest,
    session: StreamRedactorSession,
  ) {
    if (authority !== transcriptWriterAuthority) throw transcriptError("transcript_writer_not_authorized");
    this.#store = store;
    this.#request = request;
    this.#session = session;
  }

  write(chunk: string): RedactedStreamFragment {
    if (this.#finished) throw transcriptError("transcript_writer_finished");
    if (typeof chunk !== "string") throw transcriptError("transcript_chunk_invalid");
    this.#rawBytes += Buffer.byteLength(chunk, "utf8");
    if (this.#rawBytes > this.maximumRecordBytes()) {
      this.abort();
      throw transcriptError("transcript_record_too_large");
    }
    if (this.#request.stream === "input") {
      this.#session.abort();
      const text = this.#sensitiveMarkerWritten ? "" : SENSITIVE_INPUT_PLACEHOLDER;
      this.#sensitiveMarkerWritten = true;
      if (text) this.#parts.push(text);
      return deepFreeze({ text, redactionCount: text ? 1 : 0 });
    }
    const fragment = this.#session.push(chunk);
    if (fragment.text) this.#parts.push(fragment.text);
    this.#redactionCount += fragment.redactionCount;
    return fragment;
  }

  async commit(): Promise<TranscriptCommitResult> {
    if (this.#finished) throw transcriptError("transcript_writer_finished");
    this.#finished = true;
    const finalFragment = this.#request.stream === "input"
      ? deepFreeze({ text: "", redactionCount: 0 })
      : this.#session.finish();
    if (finalFragment.text) this.#parts.push(finalFragment.text);
    this.#redactionCount += finalFragment.redactionCount;
    const committed = await this.#store.commit(
      transcriptCommitAuthority,
      this.#request,
      this.#parts.join(""),
      this.#request.stream === "input" ? (this.#sensitiveMarkerWritten ? 1 : 0) : this.#redactionCount,
      this.#request.stream === "input",
    );
    this.#parts.length = 0;
    return deepFreeze({
      record: committed.record,
      finalFragment,
      evictedRecordIds: [...committed.evictedRecordIds],
    });
  }

  abort(): void {
    if (this.#finished) return;
    this.#finished = true;
    this.#session.abort();
    this.#parts.length = 0;
    this.#rawBytes = 0;
  }

  private maximumRecordBytes(): number {
    return this.#store.recordByteLimit();
  }
}

class TranscriptLease {
  private readonly path: string;
  private readonly token: string;
  private released = false;

  private constructor(path: string, token: string) {
    this.path = path;
    this.token = token;
  }

  static async acquire(root: string): Promise<TranscriptLease> {
    const path = join(root, leaseFileName);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = randomUUID();
      const temp = join(root, `${leaseFileName}.${process.pid}.${token}.tmp`);
      try {
        try {
          await writeFile(temp, JSON.stringify({ pid: process.pid, token }), {
            encoding: "utf8",
            flag: "wx",
            mode: 0o600,
          });
          await link(temp, path);
          return new TranscriptLease(path, token);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
            throw transcriptError("transcript_lease_failed");
          }
        } finally {
          await unlink(temp).catch(() => undefined);
        }
        const existing = await readLease(path);
        if (!existing) continue;
        if (processIsAlive(existing.pid)) throw transcriptError("transcript_store_already_active");
        const recovery = await TranscriptLeaseRecovery.acquire(root);
        try {
          const current = await readLease(path);
          if (!current) continue;
          if (current.pid !== existing.pid || current.token !== existing.token) {
            throw transcriptError("transcript_lease_changed_during_recovery");
          }
          if (processIsAlive(current.pid)) throw transcriptError("transcript_store_already_active");
          await unlink(path);
        } finally {
          await recovery.release();
        }
      } catch (error) {
        if (isTranscriptError(error)) throw error;
        throw transcriptError("transcript_lease_failed");
      }
    }
    throw transcriptError("transcript_lease_failed");
  }

  async release(): Promise<void> {
    if (this.released) return;
    this.released = true;
    const existing = await readLease(this.path);
    if (!existing || existing.token !== this.token || existing.pid !== process.pid) {
      throw transcriptError("transcript_lease_owner_mismatch");
    }
    await unlink(this.path);
  }
}

class TranscriptLeaseRecovery {
  private readonly path: string;
  private readonly token: string;
  private released = false;

  private constructor(path: string, token: string) {
    this.path = path;
    this.token = token;
  }

  static async acquire(root: string): Promise<TranscriptLeaseRecovery> {
    const path = join(root, leaseRecoveryFileName);
    const token = randomUUID();
    const temp = join(root, `${leaseRecoveryFileName}.${process.pid}.${token}.tmp`);
    try {
      await writeFile(temp, JSON.stringify({ pid: process.pid, token }), {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await link(temp, path);
      return new TranscriptLeaseRecovery(path, token);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw transcriptError("transcript_lease_recovery_active");
      }
      if (isTranscriptError(error)) throw error;
      throw transcriptError("transcript_lease_recovery_failed");
    } finally {
      await unlink(temp).catch(() => undefined);
    }
  }

  async release(): Promise<void> {
    if (this.released) return;
    this.released = true;
    const existing = await readLease(this.path);
    if (!existing || existing.token !== this.token || existing.pid !== process.pid) {
      throw transcriptError("transcript_lease_recovery_owner_mismatch");
    }
    await unlink(this.path);
  }
}

function normalizeConfiguration(configuration: PersistentTranscriptConfiguration): {
  stateRoot: string;
  retention: TranscriptRetentionPolicy;
  access: NormalizedAccessPolicy;
  redactor: StreamRedactor;
  clock?: () => string | number | Date;
} {
  if (!isPlainDataRecord(configuration) || !hasOnlyDataKeys(configuration, [
    "stateRoot",
    "retention",
    "access",
    "redaction",
    "clock",
  ], ["stateRoot", "retention", "access", "redaction"])) {
    throw transcriptError("transcript_configuration_invalid");
  }
  const stateRoot = ownDataValue(configuration, "stateRoot");
  const retentionInput = ownDataValue(configuration, "retention");
  const accessInput = ownDataValue(configuration, "access");
  const redactionInput = ownDataValue(configuration, "redaction");
  const clock = Reflect.ownKeys(configuration).includes("clock")
    ? ownDataValue(configuration, "clock")
    : undefined;
  if (typeof stateRoot !== "string" || !isAbsolute(stateRoot)) {
    throw transcriptError("transcript_state_root_must_be_absolute");
  }
  const retention = normalizeRetention(retentionInput);
  const access = normalizeAccess(accessInput);
  const redactor = new StreamRedactor(redactionInput as StreamRedactionPolicy);
  if (clock !== undefined && typeof clock !== "function") {
    throw transcriptError("transcript_clock_invalid");
  }
  return {
    stateRoot: resolve(stateRoot),
    retention,
    access,
    redactor,
    clock: clock as (() => string | number | Date) | undefined,
  };
}

function normalizeRetention(input: unknown): TranscriptRetentionPolicy {
  if (!isPlainDataRecord(input) || !hasExactDataKeys(input, [
    "maxAgeMs",
    "maxRecords",
    "maxTotalBytes",
    "maxRecordBytes",
  ])) throw transcriptError("transcript_retention_policy_invalid");
  const maxAgeMs = ownDataValue(input, "maxAgeMs");
  const maxRecords = ownDataValue(input, "maxRecords");
  const maxTotalBytes = ownDataValue(input, "maxTotalBytes");
  const maxRecordBytes = ownDataValue(input, "maxRecordBytes");
  if (
    !boundedInteger(maxAgeMs, 1_000, 31_536_000_000)
    || !boundedInteger(maxRecords, 1, 10_000)
    || !boundedInteger(maxTotalBytes, 1, maximumSnapshotBytes)
    || !boundedInteger(maxRecordBytes, 1, maximumSnapshotBytes)
    || maxRecordBytes > maxTotalBytes
  ) throw transcriptError("transcript_retention_policy_invalid");
  return deepFreeze({
    maxAgeMs,
    maxRecords,
    maxTotalBytes,
    maxRecordBytes,
  });
}

function normalizeAccess(input: unknown): NormalizedAccessPolicy {
  if (!isPlainDataRecord(input) || !hasExactDataKeys(input, ["writerIds", "readerIds"])) {
    throw transcriptError("transcript_access_policy_invalid");
  }
  const writerIds = normalizeIdentifierArray(ownDataValue(input, "writerIds"));
  const readerIds = normalizeIdentifierArray(ownDataValue(input, "readerIds"));
  if (writerIds.length === 0 || readerIds.length === 0) throw transcriptError("transcript_access_policy_invalid");
  return deepFreeze({ writerIds, readerIds });
}

function normalizeIdentifierArray(input: unknown): string[] {
  if (!isDataArray(input) || input.length > 64) throw transcriptError("transcript_access_policy_invalid");
  const values: string[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const value = readDataArrayElement(input, index);
    if (!isIdentifier(value) || values.includes(value)) throw transcriptError("transcript_access_policy_invalid");
    values.push(value);
  }
  return values.sort();
}

function parseRecordRequest(input: unknown): TranscriptRecordRequest {
  if (!isPlainDataRecord(input) || !hasExactDataKeys(input, [
    "recordId",
    "contractId",
    "stepId",
    "terminalSessionId",
    "agentInstanceId",
    "stream",
    "writerId",
  ])) throw transcriptError("transcript_record_request_invalid");
  const recordId = ownDataValue(input, "recordId");
  const contractId = ownDataValue(input, "contractId");
  const stepId = ownDataValue(input, "stepId");
  const terminalSessionId = ownDataValue(input, "terminalSessionId");
  const agentInstanceId = ownDataValue(input, "agentInstanceId");
  const stream = ownDataValue(input, "stream");
  const writerId = ownDataValue(input, "writerId");
  if (
    !isIdentifier(recordId)
    || !isIdentifier(contractId)
    || !isIdentifier(stepId)
    || !isIdentifier(terminalSessionId)
    || !isIdentifier(agentInstanceId)
    || !isTranscriptStream(stream)
    || !isIdentifier(writerId)
  ) throw transcriptError("transcript_record_request_invalid");
  return { recordId, contractId, stepId, terminalSessionId, agentInstanceId, stream, writerId };
}

async function prepareStateRoot(root: string): Promise<string> {
  const requested = resolve(root);
  const missing: string[] = [];
  let existing = requested;
  while (true) {
    try {
      await validateCanonicalDirectory(existing);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        if (isTranscriptError(error)) throw error;
        throw transcriptError("transcript_state_root_unsafe");
      }
      missing.push(existing);
      const parent = dirname(existing);
      if (parent === existing) throw transcriptError("transcript_state_root_unsafe");
      existing = parent;
    }
  }
  for (const path of missing.reverse()) {
    try {
      await mkdir(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw transcriptError("transcript_state_root_unsafe");
      }
    }
    await validateCanonicalDirectory(path);
  }
  const canonical = await realpath(requested);
  await ensureOwnedRoot(canonical);
  return canonical;
}

async function validateCanonicalDirectory(path: string): Promise<void> {
  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw transcriptError("transcript_state_root_unsafe");
  }
  const canonical = await realpath(path);
  if (!pathsReferToSameLocation(canonical, resolve(path))) {
    throw transcriptError("transcript_state_root_unsafe");
  }
}

function pathsReferToSameLocation(left: string, right: string): boolean {
  if (process.platform === "win32") {
    return left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US");
  }
  return left === right;
}

async function ensureOwnedRoot(root: string): Promise<void> {
  const markerPath = join(root, rootMarkerFileName);
  let names = await readdir(root);
  if (!names.includes(rootMarkerFileName)) {
    const markerTemps = names.filter((name) => rootMarkerTempPattern().test(name));
    for (const name of markerTemps) {
      const match = rootMarkerTempPattern().exec(name);
      const ownerPid = match?.[1] ? Number(match[1]) : Number.NaN;
      if (Number.isSafeInteger(ownerPid) && processIsAlive(ownerPid)) {
        throw transcriptError("transcript_root_initialization_active");
      }
      const path = join(root, name);
      const metadata = await lstat(path);
      if (!metadata.isFile() || metadata.isSymbolicLink()) {
        throw transcriptError("transcript_state_root_unowned");
      }
      await unlink(path);
    }
    names = await readdir(root);
    if (names.length !== 0) throw transcriptError("transcript_state_root_unowned");
    const token = randomUUID();
    const temp = join(root, `${rootMarkerFileName}.${process.pid}.${token}.tmp`);
    const marker = `${JSON.stringify({ format: rootMarkerFormat, owner: "morrow-core" })}\n`;
    try {
      await writeFile(temp, marker, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await link(temp, markerPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw transcriptError("transcript_root_marker_failed");
      }
    } finally {
      await unlink(temp).catch(() => undefined);
    }
  }
  await validateRootMarker(markerPath);
  await validateOwnedRootEntries(root);
}

async function validateRootMarker(path: string): Promise<void> {
  let value: unknown;
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 256) {
      throw transcriptError("transcript_root_marker_invalid");
    }
    value = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (isTranscriptError(error)) throw error;
    throw transcriptError("transcript_root_marker_invalid");
  }
  if (!isPlainDataRecord(value) || !hasExactDataKeys(value, ["format", "owner"])) {
    throw transcriptError("transcript_root_marker_invalid");
  }
  if (ownDataValue(value, "format") !== rootMarkerFormat || ownDataValue(value, "owner") !== "morrow-core") {
    throw transcriptError("transcript_root_marker_invalid");
  }
}

async function validateOwnedRootEntries(root: string): Promise<void> {
  const names = await readdir(root);
  for (const name of names) {
    if (
      name === rootMarkerFileName
      || name === transcriptFileName
      || name === leaseFileName
      || name === leaseRecoveryFileName
      || snapshotTempPattern().test(name)
      || leaseTempPattern().test(name)
      || leaseRecoveryTempPattern().test(name)
      || rootMarkerTempPattern().test(name)
    ) continue;
    throw transcriptError("transcript_state_root_contains_foreign_entry");
  }
}

function snapshotTempPattern(): RegExp {
  return /^transcript-v1\.json\.\d+\.[0-9a-f-]{36}\.tmp$/;
}

function leaseTempPattern(): RegExp {
  return /^\.transcript-v1\.lock\.\d+\.[0-9a-f-]{36}\.tmp$/;
}

function leaseRecoveryTempPattern(): RegExp {
  return /^\.transcript-v1\.lock\.recovery\.\d+\.[0-9a-f-]{36}\.tmp$/;
}

function rootMarkerTempPattern(): RegExp {
  return /^\.morrow-transcript-root\.json\.(\d+)\.[0-9a-f-]{36}\.tmp$/;
}

async function cleanupOwnedTemps(root: string): Promise<void> {
  const snapshotTemp = snapshotTempPattern();
  const leaseTemp = leaseTempPattern();
  const leaseRecoveryTemp = leaseRecoveryTempPattern();
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (
      !snapshotTemp.test(entry.name)
      && !leaseTemp.test(entry.name)
      && !leaseRecoveryTemp.test(entry.name)
    ) continue;
    const path = join(root, entry.name);
    const metadata = await lstat(path);
    if (!entry.isFile() || !metadata.isFile() || metadata.isSymbolicLink()) {
      throw transcriptError("transcript_temp_artifact_unsafe");
    }
    await unlink(path);
  }
}

async function loadState(
  path: string,
  retention: TranscriptRetentionPolicy,
  access: NormalizedAccessPolicy,
  redactor: StreamRedactor,
): Promise<TranscriptState | null> {
  let metadata;
  try {
    metadata = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw transcriptError("transcript_snapshot_read_failed");
  }
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > maximumSnapshotBytes) {
    throw transcriptError("transcript_snapshot_too_large_or_invalid");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw transcriptError("transcript_snapshot_invalid");
  }
  const state = validatePersistedState(parsed, retention, access, redactor);
  return state;
}

function validatePersistedState(
  input: unknown,
  retention: TranscriptRetentionPolicy,
  access: NormalizedAccessPolicy,
  redactor: StreamRedactor,
): TranscriptState {
  if (!isPlainDataRecord(input) || !hasExactDataKeys(input, [
    "format",
    "redactionPolicyId",
    "revision",
    "nextOrdinal",
    "updatedAt",
    "retention",
    "access",
    "records",
    "checksum",
  ])) throw transcriptError("transcript_snapshot_invalid");
  const checksum = input.checksum;
  if (typeof checksum !== "string" || checksum !== checksumState(withoutChecksum(input))) {
    throw transcriptError("transcript_snapshot_checksum_invalid");
  }
  if (
    input.format !== TRANSCRIPT_FORMAT
    || input.redactionPolicyId !== redactor.policyId
    || !boundedInteger(input.revision, 0, Number.MAX_SAFE_INTEGER)
    || !boundedInteger(input.nextOrdinal, 1, Number.MAX_SAFE_INTEGER)
    || !isCanonicalTimestamp(input.updatedAt)
  ) throw transcriptError("transcript_snapshot_invalid");
  const persistedRetention = normalizeRetention(input.retention);
  const persistedAccess = normalizeAccess(input.access);
  if (JSON.stringify(persistedRetention) !== JSON.stringify(retention)) {
    throw transcriptError("transcript_retention_policy_mismatch");
  }
  if (JSON.stringify(persistedAccess) !== JSON.stringify(access)) {
    throw transcriptError("transcript_access_policy_mismatch");
  }
  if (!isDataArray(input.records) || input.records.length > retention.maxRecords) {
    throw transcriptError("transcript_snapshot_invalid");
  }
  const records: TranscriptRecord[] = [];
  const ids = new Set<string>();
  let previousOrdinal = 0;
  let previousOccurredAt = Number.NEGATIVE_INFINITY;
  const updatedAt = Date.parse(input.updatedAt);
  for (let index = 0; index < input.records.length; index += 1) {
    const record = parsePersistedRecord(readDataArrayElement(input.records, index));
    const occurredAt = Date.parse(record.occurredAt);
    if (
      record.ordinal <= previousOrdinal
      || ids.has(record.recordId)
      || occurredAt < previousOccurredAt
      || occurredAt > updatedAt
      || Buffer.byteLength(record.content, "utf8") > retention.maxRecordBytes
      || redactor.redact(record.content).text !== record.content
    ) {
      throw transcriptError("transcript_snapshot_invalid");
    }
    previousOrdinal = record.ordinal;
    previousOccurredAt = occurredAt;
    ids.add(record.recordId);
    records.push(record);
  }
  if (records.length > 0 && input.nextOrdinal <= records[records.length - 1]!.ordinal) {
    throw transcriptError("transcript_snapshot_invalid");
  }
  if (totalRecordBytes(records) > retention.maxTotalBytes) throw transcriptError("transcript_snapshot_invalid");
  return {
    format: TRANSCRIPT_FORMAT,
    redactionPolicyId: redactor.policyId,
    revision: input.revision,
    nextOrdinal: input.nextOrdinal,
    updatedAt: input.updatedAt,
    retention,
    access,
    records,
  };
}

function parsePersistedRecord(input: unknown): TranscriptRecord {
  if (!isPlainDataRecord(input) || !hasExactDataKeys(input, [
    "ordinal",
    "recordId",
    "contractId",
    "stepId",
    "terminalSessionId",
    "agentInstanceId",
    "stream",
    "writerId",
    "occurredAt",
    "content",
    "redactionCount",
    "sensitiveInput",
  ])) throw transcriptError("transcript_snapshot_invalid");
  if (
    !boundedInteger(input.ordinal, 1, Number.MAX_SAFE_INTEGER)
    || !isIdentifier(input.recordId)
    || !isIdentifier(input.contractId)
    || !isIdentifier(input.stepId)
    || !isIdentifier(input.terminalSessionId)
    || !isIdentifier(input.agentInstanceId)
    || !isTranscriptStream(input.stream)
    || !isIdentifier(input.writerId)
    || !isCanonicalTimestamp(input.occurredAt)
    || typeof input.content !== "string"
    || !boundedInteger(input.redactionCount, 0, Number.MAX_SAFE_INTEGER)
    || typeof input.sensitiveInput !== "boolean"
    || (input.stream === "input") !== input.sensitiveInput
    || (input.sensitiveInput && input.content !== SENSITIVE_INPUT_PLACEHOLDER && input.content !== "")
  ) throw transcriptError("transcript_snapshot_invalid");
  return { ...input } as unknown as TranscriptRecord;
}

async function persistState(path: string, state: TranscriptState): Promise<void> {
  const persisted: PersistedTranscriptState = { ...cloneState(state), checksum: checksumState(state) };
  const serialized = `${JSON.stringify(persisted, null, 2)}\n`;
  if (Buffer.byteLength(serialized, "utf8") > maximumSnapshotBytes) throw transcriptError("transcript_snapshot_too_large");
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temp, path);
  } catch {
    await unlink(temp).catch(() => undefined);
    throw transcriptError("transcript_persistence_failed");
  }
}

function applyRetention(state: TranscriptState, now: string): string[] {
  const evicted: string[] = [];
  const cutoff = Date.parse(now) - state.retention.maxAgeMs;
  while (state.records.length > 0 && Date.parse(state.records[0]!.occurredAt) < cutoff) {
    evicted.push(state.records.shift()!.recordId);
  }
  while (
    state.records.length > state.retention.maxRecords
    || totalRecordBytes(state.records) > state.retention.maxTotalBytes
  ) {
    evicted.push(state.records.shift()!.recordId);
  }
  return evicted;
}

function initialState(
  retention: TranscriptRetentionPolicy,
  access: NormalizedAccessPolicy,
  redactionPolicyId: string,
  now: string,
): TranscriptState {
  return {
    format: TRANSCRIPT_FORMAT,
    redactionPolicyId,
    revision: 0,
    nextOrdinal: 1,
    updatedAt: now,
    retention,
    access,
    records: [],
  };
}

function viewState(state: TranscriptState): TranscriptView {
  return deepFreeze({
    format: TRANSCRIPT_FORMAT,
    redactionPolicyId: state.redactionPolicyId,
    revision: state.revision,
    updatedAt: state.updatedAt,
    retention: { ...state.retention },
    records: state.records.map(cloneRecord),
    totalBytes: totalRecordBytes(state.records),
  });
}

function cloneState(state: TranscriptState): TranscriptState {
  return {
    format: TRANSCRIPT_FORMAT,
    redactionPolicyId: state.redactionPolicyId,
    revision: state.revision,
    nextOrdinal: state.nextOrdinal,
    updatedAt: state.updatedAt,
    retention: { ...state.retention },
    access: { writerIds: [...state.access.writerIds], readerIds: [...state.access.readerIds] },
    records: state.records.map(cloneRecord),
  };
}

function cloneRecord(record: TranscriptRecord): TranscriptRecord {
  return { ...record };
}

function totalRecordBytes(records: readonly TranscriptRecord[]): number {
  return records.reduce((total, record) => total + Buffer.byteLength(record.content, "utf8"), 0);
}

function collectLiteralRanges(text: string, literal: string, ranges: RedactionRange[]): void {
  let offset = 0;
  while (offset <= text.length - literal.length) {
    const index = text.indexOf(literal, offset);
    if (index < 0) break;
    ranges.push({ start: index, end: index + literal.length, replacement: "redact" });
    offset = index + Math.max(1, literal.length);
  }
}

function collectMappedLiteralRanges(
  terminal: NormalizedTerminalText,
  literal: string,
  ranges: RedactionRange[],
): void {
  const visibleRanges: RedactionRange[] = [];
  collectLiteralRanges(terminal.visible, literal, visibleRanges);
  mapVisibleRanges(terminal, visibleRanges, ranges);
}

function collectAssignmentRanges(text: string, ranges: RedactionRange[]): void {
  assignmentKeyPattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = assignmentKeyPattern.exec(text)) !== null) {
    let cursor = match.index + match[0].length;
    while (cursor < text.length && /[^\S\r\n]/u.test(text[cursor]!)) cursor += 1;
    if (cursor >= text.length) {
      ranges.push({ start: match.index, end: cursor, replacement: "redact" });
      continue;
    }
    if (text[cursor] !== ":" && text[cursor] !== "=") continue;
    cursor += 1;
    while (cursor < text.length && /[^\S\r\n]/u.test(text[cursor]!)) cursor += 1;
    if (cursor >= text.length || text[cursor] === "\r" || text[cursor] === "\n") {
      ranges.push({ start: match.index, end: cursor, replacement: "redact" });
      continue;
    }
    const quote = text[cursor];
    if (quote === '"' || quote === "'") {
      cursor += 1;
      while (cursor < text.length) {
        const character = text[cursor];
        if (character === "\r" || character === "\n") break;
        if (character === "\\") {
          cursor += cursor + 1 < text.length && text[cursor + 1] !== "\r" && text[cursor + 1] !== "\n" ? 2 : 1;
          continue;
        }
        cursor += 1;
        if (character === quote) break;
      }
      ranges.push({ start: match.index, end: cursor, replacement: "redact" });
      continue;
    }
    const valueStart = cursor;
    while (cursor < text.length && !/[\s,;]/u.test(text[cursor]!)) cursor += 1;
    if (cursor > valueStart) ranges.push({ start: match.index, end: cursor, replacement: "redact" });
  }
}

function collectMappedAssignmentRanges(
  terminal: NormalizedTerminalText,
  ranges: RedactionRange[],
): void {
  const visibleRanges: RedactionRange[] = [];
  collectAssignmentRanges(terminal.visible, visibleRanges);
  mapVisibleRanges(terminal, visibleRanges, ranges);
}

function collectPatternRanges(text: string, pattern: RegExp, ranges: RedactionRange[]): void {
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length, replacement: "redact" });
    if (match[0].length === 0) pattern.lastIndex += 1;
  }
}

function collectMappedPatternRanges(
  terminal: NormalizedTerminalText,
  pattern: RegExp,
  ranges: RedactionRange[],
): void {
  const visibleRanges: RedactionRange[] = [];
  collectPatternRanges(terminal.visible, pattern, visibleRanges);
  mapVisibleRanges(terminal, visibleRanges, ranges);
}

function mapVisibleRanges(
  terminal: NormalizedTerminalText,
  visibleRanges: readonly RedactionRange[],
  rawRanges: RedactionRange[],
): void {
  for (const range of visibleRanges) {
    if (range.end <= range.start) continue;
    const start = terminal.rawStarts[range.start];
    const end = terminal.rawEnds[range.end - 1];
    if (start !== undefined && end !== undefined) {
      rawRanges.push({ start, end, replacement: "redact" });
    }
  }
}

function normalizeTerminalText(text: string): NormalizedTerminalText {
  let visible = "";
  const rawStarts: number[] = [];
  const rawEnds: number[] = [];
  const controlRanges: RedactionRange[] = [];
  let index = 0;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code === 0x1b) {
      const end = terminalEscapeEnd(text, index);
      controlRanges.push({ start: index, end, replacement: "drop" });
      index = end;
      continue;
    }
    if (code === 0x9b || code === 0x9d) {
      const end = code === 0x9b
        ? terminalCsiEnd(text, index + 1)
        : terminalOscEnd(text, index + 1);
      controlRanges.push({ start: index, end, replacement: "drop" });
      index = end;
      continue;
    }
    const codePoint = text.codePointAt(index)!;
    const codePointLength = codePoint > 0xffff ? 2 : 1;
    const character = String.fromCodePoint(codePoint);
    const variationSelector = (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
      || (codePoint >= 0xe0100 && codePoint <= 0xe01ef);
    if (
      (code < 0x20 && code !== 0x0a && code !== 0x09)
      || (code >= 0x7f && code <= 0x9f)
      || unicodeFormatControlPattern.test(character)
      || variationSelector
    ) {
      controlRanges.push({ start: index, end: index + codePointLength, replacement: "drop" });
      index += codePointLength;
      continue;
    }
    visible += text[index];
    rawStarts.push(index);
    rawEnds.push(index + 1);
    index += 1;
  }
  return { visible, rawStarts, rawEnds, controlRanges };
}

function terminalEscapeEnd(text: string, start: number): number {
  if (start + 1 >= text.length) return text.length;
  const kind = text[start + 1];
  if (kind === "[") {
    return terminalCsiEnd(text, start + 2);
  }
  if (kind === "]") {
    return terminalOscEnd(text, start + 2);
  }
  return Math.min(start + 2, text.length);
}

function terminalCsiEnd(text: string, firstParameter: number): number {
  for (let index = firstParameter; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 0x40 && code <= 0x7e) return index + 1;
  }
  return text.length;
}

function terminalOscEnd(text: string, firstPayload: number): number {
  for (let index = firstPayload; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 0x07) return index + 1;
    if (text.charCodeAt(index) === 0x1b && text[index + 1] === "\\") return index + 2;
  }
  return text.length;
}

function mergeRanges(ranges: RedactionRange[]): RedactionRange[] {
  ranges.sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: RedactionRange[] = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end) merged.push({ ...range });
    else {
      previous.end = Math.max(previous.end, range.end);
      if (range.replacement === "redact") previous.replacement = "redact";
    }
  }
  return merged;
}

function renderRedacted(text: string, ranges: readonly RedactionRange[]): string {
  let output = "";
  let offset = 0;
  for (const range of ranges) {
    output += text.slice(offset, range.start);
    if (range.replacement === "redact") output += TRANSCRIPT_REDACTION_PLACEHOLDER;
    offset = range.end;
  }
  return output + text.slice(offset);
}

function countRedactions(ranges: readonly RedactionRange[]): number {
  return ranges.filter((range) => range.replacement === "redact").length;
}

function checksumState(state: object): string {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}

function withoutChecksum(input: Record<string, unknown>): TranscriptState {
  const { checksum: _checksum, ...state } = input;
  return state as unknown as TranscriptState;
}

async function readLease(path: string): Promise<{ pid: number; token: string } | null> {
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 4_096) {
      throw transcriptError("transcript_lease_invalid");
    }
    const value = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (!isPlainDataRecord(value) || !hasExactDataKeys(value, ["pid", "token"])) {
      throw transcriptError("transcript_lease_invalid");
    }
    const pid = ownDataValue(value, "pid");
    const token = ownDataValue(value, "token");
    if (!boundedInteger(pid, 1, Number.MAX_SAFE_INTEGER) || typeof token !== "string") {
      throw transcriptError("transcript_lease_invalid");
    }
    return { pid, token };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (isTranscriptError(error)) throw error;
    throw transcriptError("transcript_lease_invalid");
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function trustedNow(clock?: () => string | number | Date): string {
  let value: string | number | Date;
  try {
    value = clock ? clock() : Date.now();
  } catch {
    throw transcriptError("transcript_clock_failed");
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw transcriptError("transcript_clock_invalid");
  return date.toISOString();
}

function isTranscriptStream(value: unknown): value is TranscriptStream {
  return value === "stdout" || value === "stderr" || value === "input" || value === "system";
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifierPattern.test(value);
}

function markerConflictsWithLiteral(marker: string, literal: string): boolean {
  return marker.includes(literal) || literal.includes(marker);
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !canonicalTimestampPattern.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function boundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function isPlainDataRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDataArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
}

function readDataArrayElement(values: readonly unknown[], index: number): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
  if (!descriptor || !("value" in descriptor)) throw transcriptError("data_array_element_invalid");
  return descriptor.value;
}

function ownDataValue(value: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !("value" in descriptor)) throw transcriptError("data_property_invalid");
  return descriptor.value;
}

function hasExactDataKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return hasOnlyDataKeys(value, expected, expected);
}

function hasOnlyDataKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
): boolean {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowed.includes(key))) return false;
  if (required.some((key) => !keys.includes(key))) return false;
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor;
  });
}

function transcriptError(code: string): Error {
  const error = new Error(code);
  error.name = "MorrowTranscriptError";
  return error;
}

function isTranscriptError(error: unknown): boolean {
  return error instanceof Error && error.name === "MorrowTranscriptError";
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

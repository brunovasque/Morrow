import { createHash, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { createReadStream } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { defaultEventLogAuthority, type EventLogAuthorityCapability, type EventLogHeadAnchor, type EventLogRecord, type EventLogStreamCapability } from "./governance-registries.ts";
import { assertCanonicalDirectoryPath } from "./stream-transcript.ts";
import type { MorrowEvent } from "./types.ts";

const eventLogFormat = "morrow.event-log/4" as const;
const maximumEventLogBytes = 33_554_432;
const maximumEventLogRecords = 1_000_000;
const maximumEventLineBytes = 1_048_576;
const eventIdBloomBytes = 8 * 1_048_576;
const eventIdBloomHashes = 7;
const zeroEventHash = "0".repeat(64);

export type EventReplayStatus = "ok" | "invalid" | "stale" | "future";
export interface EventReplayCursor { streamId: string; sequence: number; }
export interface EventReplayResult {
  status: EventReplayStatus;
  streamId: string;
  contractId: string;
  cursor: EventReplayCursor;
  nextCursor: EventReplayCursor;
  retainedFromSequence: number;
  headSequence: number;
  events: readonly MorrowEvent[];
}
export interface EventLog {
  append(event: MorrowEvent): Promise<void>;
  readAll(): Promise<MorrowEvent[]>;
  readContract(contractId: string): Promise<MorrowEvent[]>;
  replay(contractId: string, cursor?: unknown, limit?: number): Promise<EventReplayResult>;
}
export interface JsonlEventLogOptions {
  maxEventsPerContract?: number;
  authority?: EventLogAuthorityCapability;
}

interface PersistedEventEnvelope {
  format: typeof eventLogFormat;
  sequence: number;
  previousHash: string;
  eventHash: string;
  event: MorrowEvent;
}

interface EventLogScan {
  bytes: number;
  records: number;
  heads: Map<string, number>;
  lastHashes: Map<string, string>;
  eventIds: EventIdBloom;
  anchors: Map<string, EventLogHeadAnchor>;
  fileIdentity?: { dev: number; ino: number };
}

export class JsonlEventLog implements EventLog {
  private readonly filePath: string;
  private readonly eventLogId: string;
  private readonly authority: EventLogAuthorityCapability;
  private readonly streamIdentity: string;
  private readonly maxEventsPerContract: number | null;
  private appendTail: Promise<void> = Promise.resolve();
  private appendState: EventLogScan | null = null;

  constructor(filePath: string, options: JsonlEventLogOptions = {}) {
    this.filePath = filePath;
    this.eventLogId = createHash("sha256")
      .update(`morrow.event-log/id/v1|${resolve(filePath).toLowerCase()}`, "utf8")
      .digest("hex");
    this.authority = options.authority ?? defaultEventLogAuthority(this.eventLogId);
    if (this.authority.eventLogId !== this.eventLogId) throw new Error("morrow_event_log_authority_binding_invalid");
    this.streamIdentity = createHash("sha256")
      .update(`morrow.event-log/stream/v1|${this.eventLogId}`, "utf8")
      .digest("hex");
    this.maxEventsPerContract = options.maxEventsPerContract === undefined
      ? null
      : Number.isSafeInteger(options.maxEventsPerContract) && options.maxEventsPerContract > 0
        ? options.maxEventsPerContract
        : null;
  }

  async append(event: MorrowEvent): Promise<void> {
    const operation = this.appendTail.then(async () => {
      if (!validEvent(event)) throw new Error("morrow_event_invalid");
      const scan = this.appendState ?? await this.scan();
      const eventKey = eventIdKey(event.contractId, event.eventId);
      if (scan.eventIds.has(eventKey)) throw new Error("morrow_event_duplicate");
      const sequence = (scan.heads.get(event.contractId) ?? 0) + 1;
      const previousHash = scan.lastHashes.get(event.contractId) ?? zeroEventHash;
      const envelope: PersistedEventEnvelope = {
        format: eventLogFormat,
        sequence,
        previousHash,
        eventHash: zeroEventHash,
        event,
      };
      envelope.eventHash = await this.streamAuthority(event.contractId).authenticateRecord(this.recordFor(envelope));
      const serialized = `${JSON.stringify(envelope)}\n`;
      const serializedBytes = Buffer.byteLength(serialized, "utf8");
      if (serializedBytes > maximumEventLineBytes
        || scan.bytes + serializedBytes > maximumEventLogBytes
        || scan.records >= maximumEventLogRecords) throw new Error("morrow_event_log_too_large");
      const previousAnchor = scan.anchors.get(event.contractId) ?? null;
      const prepared: EventLogHeadAnchor = {
        authorityRef: this.authority.authorityRef,
        eventLogId: this.eventLogId,
        contractId: event.contractId,
        streamId: this.streamIdFor(event.contractId),
        generation: (previousAnchor?.generation ?? 0) + 1,
        sequence,
        eventTag: envelope.eventHash,
        phase: "prepared",
        expectedPrevious: previousAnchor ? {
          generation: previousAnchor.generation,
          sequence: previousAnchor.sequence,
          eventTag: previousAnchor.eventTag,
        } : null,
      };
      await this.streamAuthority(event.contractId).prepareHead(prepared, previousAnchor);
      scan.fileIdentity = await this.writeEnvelope(serialized, scan.fileIdentity);
      const committed = { ...prepared, phase: "committed" as const };
      await this.streamAuthority(event.contractId).commitHead(committed, previousAnchor);
      scan.eventIds.add(eventKey);
      scan.heads.set(event.contractId, sequence);
      scan.lastHashes.set(event.contractId, envelope.eventHash);
      scan.anchors.set(event.contractId, committed);
      scan.records += 1;
      scan.bytes += serializedBytes;
      this.appendState = scan;
    });
    this.appendTail = operation.then(() => undefined, () => undefined);
    return await operation;
  }

  async readAll(): Promise<MorrowEvent[]> {
    const events: MorrowEvent[] = [];
    await this.scan(async (event) => { events.push(event); });
    return events;
  }

  async readContract(contractId: string): Promise<MorrowEvent[]> {
    const events: MorrowEvent[] = [];
    await this.scan(async (event) => {
      if (event.contractId === contractId) events.push(event);
    });
    return events;
  }

  async replay(contractId: string, cursor?: unknown, limit = 1_024): Promise<EventReplayResult> {
    const streamId = this.streamIdFor(contractId);
    const initial = { streamId, sequence: 0 } as EventReplayCursor;
    const parsed = parseEventCursor(cursor, streamId);
    if (!parsed.ok || !Number.isSafeInteger(limit) || limit < 0 || limit > 100_000) {
      return replayResult("invalid", streamId, contractId, initial, initial, 1, 0, []);
    }
    const start = parsed.cursor;
    const selected: MorrowEvent[] = [];
    let scan: EventLogScan;
    try {
      scan = await this.scan(async (event, sequence) => {
        if (event.contractId === contractId && sequence > start.sequence && selected.length < limit) {
          selected.push(event);
        }
      });
    } catch {
      return replayResult("invalid", streamId, contractId, initial, initial, 1, 0, []);
    }
    const headSequence = scan.heads.get(contractId) ?? 0;
    const retainedFromSequence = this.maxEventsPerContract === null
      ? 1
      : Math.max(1, headSequence - this.maxEventsPerContract + 1);
    if (start.sequence > headSequence) return replayResult("future", streamId, contractId, start, start, retainedFromSequence, headSequence, []);
    if (start.sequence < retainedFromSequence - 1) return replayResult("stale", streamId, contractId, start, start, retainedFromSequence, headSequence, []);
    const nextSequence = selected.length === 0 ? start.sequence : start.sequence + selected.length;
    return replayResult("ok", streamId, contractId, start, { streamId, sequence: nextSequence }, retainedFromSequence, headSequence, selected);
  }

  streamIdFor(contractId: string): string {
    return createHash("sha256").update(`${this.streamIdentity}|${contractId}`, "utf8").digest("hex");
  }

  private async scan(consumer?: (event: MorrowEvent, sequence: number) => void | Promise<void>): Promise<EventLogScan> {
    const heads = new Map<string, number>();
    const lastHashes = new Map<string, string>();
    const eventIds = new EventIdBloom();
    let bytes = 0;
    let records = 0;
    let input: ReturnType<typeof createReadStream> | undefined;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    let openedFileIdentity: { dev: number; ino: number } | undefined;
    const anchorList = await this.authority.readAnchors();
    const anchors = new Map<string, EventLogHeadAnchor>();
    for (const anchor of anchorList) {
      if (anchor.authorityRef !== this.authority.authorityRef || anchor.eventLogId !== this.eventLogId
        || anchor.streamId !== this.streamIdFor(anchor.contractId)) throw new Error("morrow_event_log_anchor_binding_invalid");
      if (anchors.has(anchor.contractId)) throw new Error("morrow_event_log_anchor_duplicate");
      anchors.set(anchor.contractId, anchor);
    }
    let lineParts: Buffer[] = [];
    let lineBytes = 0;
    const processLine = async (rawLine: Buffer): Promise<void> => {
      let line = rawLine;
      if (line.at(-1) === 0x0d) line = line.subarray(0, line.length - 1);
      if (line.length === 0 || records >= maximumEventLogRecords) {
        throw new Error("morrow_event_log_too_large_or_invalid");
      }
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(line);
      } catch {
        throw new Error("morrow_event_log_invalid_utf8");
      }
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw new Error("morrow_event_log_invalid_json");
      }
      const envelope = parseEnvelope(value);
      const event = envelope.event;
      const previousSequence = heads.get(event.contractId) ?? 0;
      const previousHash = lastHashes.get(event.contractId) ?? zeroEventHash;
      if (envelope.sequence !== previousSequence + 1 || !constantTimeHexEqual(envelope.previousHash, previousHash)) {
        throw new Error("morrow_event_log_sequence_invalid");
      }
      if (!await this.streamAuthority(event.contractId).verifyRecord(this.recordFor(envelope), envelope.eventHash)) {
        throw new Error("morrow_event_log_integrity_invalid");
      }
      const key = eventIdKey(event.contractId, event.eventId);
      if (eventIds.has(key)) throw new Error("morrow_event_log_duplicate");
      eventIds.add(key);
      heads.set(event.contractId, envelope.sequence);
      lastHashes.set(event.contractId, envelope.eventHash);
      records += 1;
      await consumer?.(event, envelope.sequence);
    };
    try {
      await assertCanonicalDirectoryPath(dirname(this.filePath));
      const pathBefore = await lstat(this.filePath);
      if (!pathBefore.isFile() || pathBefore.isSymbolicLink()) throw new Error("morrow_event_log_path_unsafe");
      handle = await open(this.filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const opened = await handle.stat();
      if (!sameFileIdentity(pathBefore, opened)) throw new Error("morrow_event_log_path_race");
      openedFileIdentity = { dev: opened.dev, ino: opened.ino };
      input = createReadStream(this.filePath, { fd: handle.fd, autoClose: false });
      for await (const chunk of input) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > maximumEventLogBytes) throw new Error("morrow_event_log_too_large");
        let offset = 0;
        while (offset < buffer.length) {
          const newline = buffer.indexOf(0x0a, offset);
          const end = newline < 0 ? buffer.length : newline;
          const segment = buffer.subarray(offset, end);
          lineBytes += segment.length;
          if (lineBytes > maximumEventLineBytes) throw new Error("morrow_event_log_record_too_large");
          if (segment.length > 0) lineParts.push(segment);
          if (newline < 0) {
            offset = buffer.length;
          } else {
            await processLine(Buffer.concat(lineParts, lineBytes));
            lineParts = [];
            lineBytes = 0;
            offset = newline + 1;
          }
        }
      }
      if (lineBytes > 0) await processLine(Buffer.concat(lineParts, lineBytes));
      const closed = await handle.stat();
      const pathAfter = await lstat(this.filePath);
      if (!sameFileIdentity(opened, closed) || !sameFileIdentity(closed, pathAfter) || closed.size !== bytes) {
        throw new Error("morrow_event_log_path_race");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        if (anchors.size === 0) return { bytes: 0, records: 0, heads, lastHashes, eventIds, anchors };
        const prepared = [...anchors.values()].filter((anchor) => anchor.phase === "prepared");
        if (prepared.length === anchors.size) {
          for (const anchor of prepared) await this.streamAuthority(anchor.contractId).abortHead(anchor, anchorPrevious(anchor));
          return { bytes: 0, records: 0, heads, lastHashes, eventIds, anchors: new Map() };
        }
        throw new Error("morrow_event_log_missing");
      }
      if (error instanceof Error && error.message.startsWith("morrow_event_log_")) throw error;
      if (error instanceof Error && error.message === "transcript_state_root_unsafe") {
        throw new Error("morrow_event_log_path_unsafe");
      }
      if (error instanceof Error && error.message.startsWith("event_log_")) throw new Error("morrow_event_log_anchor_invalid");
      throw new Error("morrow_event_log_read_failed");
    } finally {
      if (input && !input.destroyed) input.destroy();
      await handle?.close().catch(() => undefined);
    }
    const reconciledAnchors = await reconcileAnchors(this.authority, anchors, heads, lastHashes);
    return { bytes, records, heads, lastHashes, eventIds, anchors: reconciledAnchors, fileIdentity: openedFileIdentity };
  }

  private async writeEnvelope(serialized: string, expectedIdentity?: { dev: number; ino: number }): Promise<{ dev: number; ino: number }> {
    const parent = dirname(this.filePath);
    await assertCanonicalDirectoryPath(parent);
    await mkdir(parent, { recursive: true });
    await assertCanonicalDirectoryPath(parent);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      const pathBefore = await lstat(this.filePath).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      });
      if (expectedIdentity && (!pathBefore || !sameFileIdentity(pathBefore, expectedIdentity))) {
        throw new Error("morrow_event_log_path_race");
      }
      const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND
        | (expectedIdentity ? 0 : constants.O_EXCL) | (constants.O_NOFOLLOW ?? 0);
      handle = await open(this.filePath, flags, 0o600);
      const metadata = await handle.stat();
      if (!metadata.isFile() || metadata.isSymbolicLink()
        || (expectedIdentity && !sameFileIdentity(metadata, expectedIdentity))) {
        throw new Error(expectedIdentity ? "morrow_event_log_path_race" : "morrow_event_log_path_unsafe");
      }
      await handle.write(serialized, undefined, "utf8");
      await handle.sync();
      return { dev: metadata.dev, ino: metadata.ino };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("morrow_event_log_path_race");
      if (error instanceof Error && error.message.startsWith("morrow_event_log_")) throw error;
      throw new Error("morrow_event_log_write_failed");
    } finally {
      await handle?.close().catch(() => undefined);
    }
  }

  private streamAuthority(contractId: string): EventLogStreamCapability {
    return this.authority.bindStream(contractId, this.streamIdFor(contractId));
  }

  private recordFor(envelope: PersistedEventEnvelope): EventLogRecord {
    return {
      format: envelope.format,
      eventLogId: this.eventLogId,
      streamId: this.streamIdFor(envelope.event.contractId),
      contractId: envelope.event.contractId,
      sequence: envelope.sequence,
      eventId: envelope.event.eventId,
      previousAuthenticatedTag: envelope.previousHash,
      event: envelope.event,
    };
  }
}

export function eventLogIdForPath(filePath: string): string {
  return createHash("sha256").update(`morrow.event-log/id/v1|${resolve(filePath).toLowerCase()}`, "utf8").digest("hex");
}

function parseEnvelope(value: unknown): PersistedEventEnvelope {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["format", "sequence", "previousHash", "eventHash", "event"])
    || value.format !== eventLogFormat || !Number.isSafeInteger(value.sequence) || value.sequence < 1
    || typeof value.previousHash !== "string" || !/^[0-9a-f]{64}$/u.test(value.previousHash)
    || typeof value.eventHash !== "string" || !/^[0-9a-f]{64}$/u.test(value.eventHash)
    || !validEvent(value.event)) throw new Error("morrow_event_log_invalid");
  return {
    format: eventLogFormat,
    sequence: value.sequence,
    previousHash: value.previousHash,
    eventHash: value.eventHash,
    event: value.event,
  };
}

function sameFileIdentity(left: { dev: number; ino: number }, right: { dev: number; ino: number }): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function constantTimeHexEqual(expected: string, actual: string): boolean {
  if (!/^[0-9a-f]{64}$/u.test(expected) || !/^[0-9a-f]{64}$/u.test(actual)) return false;
  const expectedBytes = Buffer.from(expected, "hex");
  const actualBytes = Buffer.from(actual, "hex");
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

function anchorPrevious(anchor: EventLogHeadAnchor): EventLogHeadAnchor | null {
  if (!anchor.expectedPrevious) return null;
  return {
    ...anchor,
    generation: anchor.expectedPrevious.generation,
    sequence: anchor.expectedPrevious.sequence,
    eventTag: anchor.expectedPrevious.eventTag,
    phase: "committed",
    expectedPrevious: null,
  };
}

async function reconcileAnchors(
  authority: EventLogAuthorityCapability,
  anchors: Map<string, EventLogHeadAnchor>,
  heads: Map<string, number>,
  lastHashes: Map<string, string>,
): Promise<Map<string, EventLogHeadAnchor>> {
  const result = new Map<string, EventLogHeadAnchor>();
  for (const anchor of anchors.values()) {
    const currentSequence = heads.get(anchor.contractId) ?? 0;
    const currentTag = lastHashes.get(anchor.contractId) ?? null;
    const previous = anchorPrevious(anchor);
    const matchesCurrent = currentSequence === anchor.sequence && currentTag !== null
      && constantTimeHexEqual(currentTag, anchor.eventTag);
    const matchesPrevious = previous === null
      ? currentSequence === 0 && currentTag === null
      : currentSequence === previous.sequence && currentTag !== null
        && constantTimeHexEqual(currentTag, previous.eventTag);
    if (anchor.phase === "prepared") {
      if (matchesCurrent) {
        const committed = { ...anchor, phase: "committed" as const };
        await authority.bindStream(anchor.contractId, anchor.streamId).commitHead(committed, previous);
        result.set(anchor.contractId, committed);
      } else if (matchesPrevious) {
        await authority.bindStream(anchor.contractId, anchor.streamId).abortHead(anchor, previous);
        if (previous) result.set(anchor.contractId, previous);
      } else {
        throw new Error("morrow_event_log_anchor_divergent");
      }
    } else {
      if (!matchesCurrent) throw new Error("morrow_event_log_anchor_ahead");
      result.set(anchor.contractId, anchor);
    }
  }
  for (const contractId of heads.keys()) {
    if (!result.has(contractId)) throw new Error("morrow_event_log_anchor_missing");
  }
  return result;
}

function eventIdKey(contractId: string, eventId: string): string {
  return JSON.stringify([contractId, eventId]);
}

class EventIdBloom {
  private readonly bits = new Uint8Array(eventIdBloomBytes);

  has(value: string): boolean {
    return this.positions(value).every((position) => (this.bits[position >> 3]! & (1 << (position & 7))) !== 0);
  }

  add(value: string): void {
    for (const position of this.positions(value)) this.bits[position >> 3] |= 1 << (position & 7);
  }

  private positions(value: string): number[] {
    const digest = createHash("sha256").update(value, "utf8").digest();
    const bitCount = this.bits.length * 8;
    const positions: number[] = [];
    for (let index = 0; index < eventIdBloomHashes; index += 1) {
      positions.push(digest.readUInt32BE(index * 4) % bitCount);
    }
    return positions;
  }
}

function validEvent(value: unknown): value is MorrowEvent {
  if (!isPlainRecord(value) || !hasRequiredKeys(value, ["eventId", "contractId", "type", "occurredAt", "actor", "payload", "schemaVersion"])) return false;
  return typeof value.eventId === "string" && value.eventId.length > 0
    && typeof value.contractId === "string" && value.contractId.length > 0
    && typeof value.type === "string" && value.type.length > 0
    && typeof value.occurredAt === "string"
    && isPlainRecord(value.actor)
    && typeof value.actor.kind === "string" && typeof value.actor.id === "string"
    && value.schemaVersion === "0.1";
}

function isPlainRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

function hasRequiredKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function parseEventCursor(value: unknown, streamId: string): { ok: true; cursor: EventReplayCursor } | { ok: false } {
  try {
    if (value === undefined) return { ok: true, cursor: { streamId, sequence: 0 } };
    if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return { ok: false };
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 2 || !keys.every((key) => typeof key === "string" && (key === "streamId" || key === "sequence"))) return { ok: false };
    const stream = Object.getOwnPropertyDescriptor(value, "streamId");
    const sequence = Object.getOwnPropertyDescriptor(value, "sequence");
    if (!stream || !sequence || !("value" in stream) || !("value" in sequence)
      || stream.value !== streamId || !Number.isSafeInteger(sequence.value) || sequence.value < 0) return { ok: false };
    return { ok: true, cursor: { streamId, sequence: sequence.value as number } };
  } catch {
    return { ok: false };
  }
}

function replayResult(
  status: EventReplayStatus,
  streamId: string,
  contractId: string,
  cursor: EventReplayCursor,
  nextCursor: EventReplayCursor,
  retainedFromSequence: number,
  headSequence: number,
  events: readonly MorrowEvent[],
): EventReplayResult {
  return Object.freeze({
    status, streamId, contractId,
    cursor: Object.freeze({ ...cursor }),
    nextCursor: Object.freeze({ ...nextCursor }),
    retainedFromSequence, headSequence,
    events: Object.freeze(events.map((event) => structuredClone(event))),
  });
}

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { MorrowEvent } from "./types.ts";

const eventLogFormat = "morrow.event-log/2" as const;
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
export interface JsonlEventLogOptions { maxEventsPerContract?: number; }

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
}

export class JsonlEventLog implements EventLog {
  private readonly filePath: string;
  private readonly streamIdentity: string;
  private readonly maxEventsPerContract: number | null;
  private appendTail: Promise<void> = Promise.resolve();
  private appendState: EventLogScan | null = null;

  constructor(filePath: string, options: JsonlEventLogOptions = {}) {
    this.filePath = filePath;
    this.streamIdentity = createHash("sha256")
      .update(`morrow.event-log/2|${resolve(filePath).toLowerCase()}`, "utf8")
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
      envelope.eventHash = eventHashFor(envelope);
      const serialized = `${JSON.stringify(envelope)}\n`;
      const serializedBytes = Buffer.byteLength(serialized, "utf8");
      if (serializedBytes > maximumEventLineBytes
        || scan.bytes + serializedBytes > maximumEventLogBytes
        || scan.records >= maximumEventLogRecords) throw new Error("morrow_event_log_too_large");
      await mkdir(dirname(this.filePath), { recursive: true });
      await appendFile(this.filePath, serialized, "utf8");
      scan.eventIds.add(eventKey);
      scan.heads.set(event.contractId, sequence);
      scan.lastHashes.set(event.contractId, envelope.eventHash);
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
      if (envelope.sequence !== previousSequence + 1 || envelope.previousHash !== previousHash) {
        throw new Error("morrow_event_log_sequence_invalid");
      }
      if (envelope.eventHash !== eventHashFor(envelope)) {
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
      input = createReadStream(this.filePath);
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
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { bytes: 0, records: 0, heads, lastHashes, eventIds };
      }
      if (error instanceof Error && error.message.startsWith("morrow_event_log_")) throw error;
      throw new Error("morrow_event_log_read_failed");
    } finally {
      input?.destroy();
    }
    return { bytes, records, heads, lastHashes, eventIds };
  }
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

function eventHashFor(envelope: PersistedEventEnvelope): string {
  const domain = {
    format: envelope.format,
    sequence: envelope.sequence,
    previousHash: envelope.previousHash,
    event: envelope.event,
  };
  return createHash("sha256").update(JSON.stringify(domain), "utf8").digest("hex");
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

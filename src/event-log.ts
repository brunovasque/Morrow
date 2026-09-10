import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import type { MorrowEvent } from "./types.ts";

const eventLogFormat = "morrow.event-log/1" as const;
const maximumEventLogBytes = 33_554_432;
const maximumEventLogRecords = 1_000_000;

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
  event: MorrowEvent;
}

interface EventLogScan {
  bytes: number;
  records: number;
  heads: Map<string, number>;
  ids: Map<string, Set<string>>;
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
      .update(`morrow.event-log/1|${resolve(filePath).toLowerCase()}`, "utf8")
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
      const ids = scan.ids.get(event.contractId) ?? new Set<string>();
      if (ids.has(event.eventId)) throw new Error("morrow_event_duplicate");
      const sequence = (scan.heads.get(event.contractId) ?? 0) + 1;
      const envelope: PersistedEventEnvelope = { format: eventLogFormat, sequence, event };
      const serialized = `${JSON.stringify(envelope)}\n`;
      if (scan.bytes + Buffer.byteLength(serialized, "utf8") > maximumEventLogBytes
        || scan.records >= maximumEventLogRecords) throw new Error("morrow_event_log_too_large");
      await mkdir(dirname(this.filePath), { recursive: true });
      await appendFile(this.filePath, serialized, "utf8");
      ids.add(event.eventId);
      scan.ids.set(event.contractId, ids);
      scan.heads.set(event.contractId, sequence);
      scan.records += 1;
      scan.bytes += Buffer.byteLength(serialized, "utf8");
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
    const ids = new Map<string, Set<string>>();
    let bytes = 0;
    let records = 0;
    let input: ReturnType<typeof createReadStream>;
    try {
      input = createReadStream(this.filePath, { encoding: "utf8" });
      const lines = createInterface({ input, crlfDelay: Infinity });
      try {
        for await (const line of lines) {
          bytes += Buffer.byteLength(line, "utf8") + 1;
          if (bytes > maximumEventLogBytes || records >= maximumEventLogRecords || line.length === 0) {
            throw new Error("morrow_event_log_too_large_or_invalid");
          }
          let value: unknown;
          try {
            value = JSON.parse(line);
          } catch {
            throw new Error("morrow_event_log_invalid_json");
          }
          const envelope = parseEnvelope(value);
          const event = envelope.event;
          const previous = heads.get(event.contractId) ?? 0;
          if (envelope.sequence !== previous + 1) throw new Error("morrow_event_log_sequence_invalid");
          const eventIds = ids.get(event.contractId) ?? new Set<string>();
          if (eventIds.has(event.eventId)) throw new Error("morrow_event_log_duplicate");
          eventIds.add(event.eventId);
          ids.set(event.contractId, eventIds);
          heads.set(event.contractId, envelope.sequence);
          records += 1;
          await consumer?.(event, envelope.sequence);
        }
      } finally {
        lines.close();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { bytes: 0, records: 0, heads, ids };
      if (error instanceof Error && error.message.startsWith("morrow_event_log_")) throw error;
      throw new Error("morrow_event_log_read_failed");
    }
    return { bytes, records, heads, ids };
  }
}

function parseEnvelope(value: unknown): PersistedEventEnvelope {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["format", "sequence", "event"])
    || value.format !== eventLogFormat || !Number.isSafeInteger(value.sequence) || value.sequence < 1
    || !validEvent(value.event)) throw new Error("morrow_event_log_invalid");
  return { format: eventLogFormat, sequence: value.sequence, event: value.event };
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

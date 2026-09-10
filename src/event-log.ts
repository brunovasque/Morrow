import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { MorrowEvent } from "./types.ts";

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

export class JsonlEventLog implements EventLog {
  private readonly filePath: string;
  private readonly streamIdentity: string;
  private readonly maxEventsPerContract: number | null;
  private appendTail: Promise<void> = Promise.resolve();

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
      await mkdir(dirname(this.filePath), { recursive: true });
      await appendFile(this.filePath, `${JSON.stringify(event)}\n`, "utf8");
    });
    this.appendTail = operation.then(() => undefined, () => undefined);
    return await operation;
  }

  async readAll(): Promise<MorrowEvent[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line) as MorrowEvent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw new Error("morrow_event_log_read_failed");
    }
  }

  async readContract(contractId: string): Promise<MorrowEvent[]> {
    return (await this.readAll()).filter((event) => event.contractId === contractId);
  }

  async replay(contractId: string, cursor?: unknown, limit = 1_024): Promise<EventReplayResult> {
    const events = await this.readContract(contractId);
    const streamId = this.streamIdFor(contractId);
    const headSequence = events.length;
    const retainedFromSequence = this.maxEventsPerContract === null
      ? 1
      : Math.max(1, headSequence - this.maxEventsPerContract + 1);
    const initial = { streamId, sequence: 0 } as EventReplayCursor;
    if (!validEventStream(events, contractId)) {
      return replayResult("invalid", streamId, contractId, initial, initial, retainedFromSequence, headSequence, []);
    }
    const parsed = parseEventCursor(cursor, streamId);
    if (!parsed.ok) return replayResult("invalid", streamId, contractId, initial, initial, retainedFromSequence, headSequence, []);
    const start = parsed.cursor;
    if (start.sequence > headSequence) return replayResult("future", streamId, contractId, start, start, retainedFromSequence, headSequence, []);
    if (start.sequence < retainedFromSequence - 1) return replayResult("stale", streamId, contractId, start, start, retainedFromSequence, headSequence, []);
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 100_000) {
      return replayResult("invalid", streamId, contractId, start, start, retainedFromSequence, headSequence, []);
    }
    const startIndex = Math.max(start.sequence, retainedFromSequence - 1);
    const selected = events.slice(startIndex, startIndex + limit);
    const nextSequence = selected.length === 0 ? start.sequence : start.sequence + selected.length;
    return replayResult("ok", streamId, contractId, start, { streamId, sequence: nextSequence }, retainedFromSequence, headSequence, selected);
  }

  streamIdFor(contractId: string): string {
    return createHash("sha256").update(`${this.streamIdentity}|${contractId}`, "utf8").digest("hex");
  }
}

function validEventStream(events: readonly MorrowEvent[], contractId: string): boolean {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.contractId !== contractId || typeof event.eventId !== "string" || event.eventId.length === 0 || ids.has(event.eventId)) return false;
    ids.add(event.eventId);
  }
  return true;
}

function parseEventCursor(value: unknown, streamId: string): { ok: true; cursor: EventReplayCursor } | { ok: false } {
  if (value === undefined) return { ok: true, cursor: { streamId, sequence: 0 } };
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return { ok: false };
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 2 || !keys.every((key) => typeof key === "string" && (key === "streamId" || key === "sequence"))) return { ok: false };
  const stream = Object.getOwnPropertyDescriptor(value, "streamId");
  const sequence = Object.getOwnPropertyDescriptor(value, "sequence");
  if (!stream || !sequence || !("value" in stream) || !("value" in sequence)
    || stream.value !== streamId || !Number.isSafeInteger(sequence.value) || sequence.value < 0) return { ok: false };
  return { ok: true, cursor: { streamId, sequence: sequence.value as number } };
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

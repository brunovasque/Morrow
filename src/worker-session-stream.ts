import { createHash } from "node:crypto";
import { mkdir, readdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  JsonlEventLog,
  type EventReplayCursor,
  type EventReplayResult,
} from "./event-log.ts";
import {
  StreamRedactor,
  PersistentTranscriptStore,
  type TranscriptRecord,
  type TranscriptView,
  type StreamRedactionPolicy,
  type StreamRedactorSession,
} from "./stream-transcript.ts";
import {
  projectContractLiveActivity,
  validateLiveActivityEvent,
  type LiveActivityEvent,
  type LiveActivityProjectionResult,
} from "./live-activity.ts";
import {
  WorkerRecoveryCoordinator,
  type WorkerRecoveryView,
} from "./worker-recovery.ts";
import {
  TerminalSessionManager,
  type TerminalSessionSnapshot,
  type TerminalSessionEvent,
  type TerminalSessionRequest,
  type TerminalSessionResult,
  type TerminalSessionStatus,
} from "./terminal-session.ts";
import type { MorrowEvent } from "./types.ts";

export const WORKER_SESSION_STREAM_SCHEMA = "morrow.worker-session-stream" as const;
export const WORKER_SESSION_STREAM_VERSION = "1.0" as const;

export type WorkerSessionState = TerminalSessionStatus | "recoverable";
export type WorkerSessionLiveness = "online" | "recovering" | "offline" | "outcome_unknown" | "terminal" | "failed";

export interface WorkerSessionStreamConfiguration {
  stateRoot: string;
  terminals: TerminalSessionManager;
  redaction: StreamRedactionPolicy;
  maxEventsPerSession?: number;
  transcript?: PersistentTranscriptStore;
  recovery?: WorkerRecoveryCoordinator;
}

export interface WorkerSessionIdentity {
  sessionId: string;
  terminalSessionId: string;
  agentInstanceId: string;
  contractId: string;
  roleId: string;
  runtimeId: string;
  workspaceId: string;
  workspaceRoot: string;
}

export interface WorkerSessionDescriptor extends WorkerSessionIdentity {
  streamId: string;
  state: WorkerSessionState;
  liveness: WorkerSessionLiveness;
  terminal: boolean;
  headSequence: number;
  historyTruncated: boolean;
}

export interface WorkerSessionSnapshot extends WorkerSessionDescriptor {
  terminalSnapshot: TerminalSessionSnapshot | null;
  liveActivity: LiveActivityProjectionResult;
  transcript: TranscriptView;
  recovery: WorkerRecoveryView | null;
}

export interface WorkerSessionStreamEvent {
  schema: typeof WORKER_SESSION_STREAM_SCHEMA;
  schemaVersion: typeof WORKER_SESSION_STREAM_VERSION;
  eventId: string;
  sequence: number;
  occurredAt: string;
  sessionId: string;
  terminalSessionId: string;
  agentInstanceId: string;
  contractId: string;
  roleId: string;
  runtimeId: string;
  workspaceId: string;
  type: TerminalSessionEvent["type"];
  payload: Record<string, any>;
}

export type WorkerSessionStreamListener = (event: WorkerSessionStreamEvent) => void;
export type WorkerLiveActivityListener = (event: LiveActivityEvent) => void;

export type WorkerSessionReplayStatus = "ok" | "invalid" | "stale" | "future";

export interface WorkerSessionReplayResult {
  status: WorkerSessionReplayStatus;
  sessionId: string;
  streamId: string;
  contractId: string;
  cursor: EventReplayCursor;
  nextCursor: EventReplayCursor;
  retainedFromSequence: number;
  headSequence: number;
  events: readonly WorkerSessionStreamEvent[];
}

interface StoredSessionPayload {
  schema: typeof WORKER_SESSION_STREAM_SCHEMA;
  schemaVersion: typeof WORKER_SESSION_STREAM_VERSION;
  sessionId: string;
  terminalSessionId: string;
  agentInstanceId: string;
  contractId: string;
  roleId: string;
  runtimeId: string;
  workspaceId: string;
  workspaceRoot: string;
  terminalSequence: number;
  synthetic: boolean;
  payload: Record<string, any>;
}

interface SessionRecord extends WorkerSessionIdentity {
  eventLog: JsonlEventLog;
  streamId: string;
  nextSequence: number;
  lastTerminalSequence: number;
  state: WorkerSessionState;
  liveness: WorkerSessionLiveness;
  terminal: boolean;
  historyTruncated: boolean;
  started: boolean;
  failure: boolean;
  persistenceError: Error | null;
  queue: Promise<void>;
  redactors: Map<"stdout" | "stderr", StreamRedactorSession>;
  liveActivityEvents: LiveActivityEvent[];
  liveActivityState: LiveActivityEvent["transition"]["to"] | null;
}

const sessionIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const sessionsDirectoryName = "sessions";
const eventLogSuffix = ".event-log";
const redactorMaximumPendingBytes = 1_048_576;
const terminalEventTypes = new Set<TerminalSessionEvent["type"]>([
  "TERMINAL_SESSION_STARTED",
  "TERMINAL_OUTPUT",
  "TERMINAL_INPUT_WRITTEN",
  "TERMINAL_INPUT_ENDED",
  "TERMINAL_RESIZED",
  "TERMINAL_INTERRUPT_REQUESTED",
  "TERMINAL_SESSION_EXITED",
  "TERMINAL_SESSION_FAILED",
]);

export class WorkerSessionStream {
  private readonly stateRoot: string;
  private readonly sessionsRoot: string;
  private readonly terminals: TerminalSessionManager;
  private readonly redactor: StreamRedactor;
  private readonly transcript: PersistentTranscriptStore;
  private readonly ownsTranscript: boolean;
  private readonly recovery: WorkerRecoveryCoordinator | null;
  private readonly maxEventsPerSession: number | undefined;
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly listeners = new Map<string, Set<WorkerSessionStreamListener>>();
  private readonly liveActivityListeners = new Map<string, Set<WorkerLiveActivityListener>>();
  private unsubscribeTerminalEvents: (() => void) | null = null;
  private closed = false;

  private constructor(
    stateRoot: string,
    sessionsRoot: string,
    terminals: TerminalSessionManager,
    redactor: StreamRedactor,
    transcript: PersistentTranscriptStore,
    ownsTranscript: boolean,
    recovery: WorkerRecoveryCoordinator | null,
    maxEventsPerSession: number | undefined,
  ) {
    this.stateRoot = stateRoot;
    this.sessionsRoot = sessionsRoot;
    this.terminals = terminals;
    this.redactor = redactor;
    this.transcript = transcript;
    this.ownsTranscript = ownsTranscript;
    this.recovery = recovery;
    this.maxEventsPerSession = maxEventsPerSession;
  }

  static async open(configuration: WorkerSessionStreamConfiguration): Promise<WorkerSessionStream> {
    assertConfiguration(configuration);
    const stateRoot = resolve(configuration.stateRoot);
    await ensureSafeDirectory(stateRoot);
    const sessionsRoot = join(stateRoot, sessionsDirectoryName);
    await ensureSafeDirectory(sessionsRoot);
    const ownsTranscript = !configuration.transcript;
    const transcript = configuration.transcript ?? await PersistentTranscriptStore.open({
      stateRoot: join(stateRoot, "transcript"),
      retention: {
        maxAgeMs: 7 * 24 * 60 * 60 * 1_000,
        maxRecords: 10_000,
        maxTotalBytes: 16 * 1024 * 1024,
        maxRecordBytes: 1_048_576,
      },
      access: { writerIds: ["worker-session-stream"], readerIds: ["worker-session-stream"] },
      redaction: configuration.redaction,
    });
    const stream = new WorkerSessionStream(
      stateRoot,
      sessionsRoot,
      configuration.terminals,
      new StreamRedactor(configuration.redaction),
      transcript,
      ownsTranscript,
      configuration.recovery ?? null,
      configuration.maxEventsPerSession,
    );
    try {
      await stream.rehydrate();
      stream.unsubscribeTerminalEvents = configuration.terminals.subscribe((event) => {
        void stream.acceptTerminalEvent(event);
      });
      return stream;
    } catch (error) {
      if (ownsTranscript) await transcript.close().catch(() => undefined);
      throw error;
    }
  }

  list(): readonly WorkerSessionDescriptor[] {
    return Object.freeze([...this.sessions.values()].map((record) => this.descriptor(record)));
  }

  subscribe(sessionId: string, listener: WorkerSessionStreamListener): () => void {
    assertSessionId(sessionId);
    if (typeof listener !== "function") throw new Error("worker_session_listener_invalid");
    let listeners = this.listeners.get(sessionId);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(sessionId, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
      if (listeners?.size === 0) this.listeners.delete(sessionId);
    };
  }

  subscribeLiveActivity(sessionId: string, listener: WorkerLiveActivityListener): () => void {
    assertSessionId(sessionId);
    if (typeof listener !== "function") throw new Error("worker_live_activity_listener_invalid");
    let listeners = this.liveActivityListeners.get(sessionId);
    if (!listeners) {
      listeners = new Set();
      this.liveActivityListeners.set(sessionId, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
      if (listeners?.size === 0) this.liveActivityListeners.delete(sessionId);
    };
  }

  snapshot(sessionId: string): WorkerSessionSnapshot {
    this.assertOpen();
    assertSessionId(sessionId);
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error("worker_session_not_found");
    const transcript = this.transcriptFor(record);
    const terminalSnapshot = this.terminals.list().find((item) => item.terminalSessionId === sessionId) ?? null;
    return Object.freeze({
      ...this.descriptor(record),
      terminalSnapshot,
      liveActivity: this.liveActivityFor(record),
      transcript,
      recovery: this.recovery?.inspect() ?? null,
    });
  }

  liveActivity(sessionId: string): LiveActivityProjectionResult {
    this.assertOpen();
    assertSessionId(sessionId);
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error("worker_session_not_found");
    return this.liveActivityFor(record);
  }

  transcriptRecords(sessionId: string): readonly TranscriptRecord[] {
    this.assertOpen();
    assertSessionId(sessionId);
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error("worker_session_not_found");
    return this.transcriptFor(record).records;
  }

  recoveryView(): WorkerRecoveryView | null {
    this.assertOpen();
    return this.recovery?.inspect() ?? null;
  }

  async start(request: TerminalSessionRequest): Promise<{ sessionId: string; completion: Promise<TerminalSessionResult> }> {
    this.assertOpen();
    assertSessionId(request.terminalSessionId);
    if (this.sessions.has(request.terminalSessionId)) throw new Error("worker_session_id_already_exists");
    const record = this.recordFromRequest(request);
    this.sessions.set(record.sessionId, record);
    try {
      const handle = await this.terminals.start(request);
      const completion = handle.completion.then(async (result) => {
        await record.queue;
        if (record.persistenceError) throw record.persistenceError;
        return result;
      });
      return Object.freeze({ sessionId: record.sessionId, completion });
    } catch (error) {
      this.sessions.delete(record.sessionId);
      throw error;
    }
  }

  async replay(sessionId: string, cursor?: unknown, limit = 1_024): Promise<WorkerSessionReplayResult> {
    this.assertOpen();
    assertSessionId(sessionId);
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error("worker_session_not_found");
    await record.queue;
    try {
      const result = await record.eventLog.replay(record.contractId, cursor, limit);
      return this.mapReplay(record, result);
    } catch {
      return this.invalidReplay(record);
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.unsubscribeTerminalEvents?.();
    this.unsubscribeTerminalEvents = null;
    for (const record of this.sessions.values()) {
      record.queue = record.queue.then(async () => {
        if (!record.terminal) await this.flushRedactors(record);
      });
    }
    await Promise.all([...this.sessions.values()].map((record) => record.queue));
    if (this.ownsTranscript) await this.transcript.close();
  }

  private async rehydrate(): Promise<void> {
    const entries = await readdir(this.sessionsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(eventLogSuffix)) {
        throw new Error("worker_session_stream_entry_invalid");
      }
      const sessionId = entry.name.slice(0, -eventLogSuffix.length);
      assertSessionId(sessionId);
      const eventLog = new JsonlEventLog(join(this.sessionsRoot, entry.name), {
        maxEventsPerContract: this.maxEventsPerSession,
      });
      const events = await eventLog.readAll();
      if (events.length === 0) throw new Error("worker_session_stream_empty_log");
      const first = parseStoredEvent(events[0], sessionId, 1);
      const record = this.recordFromStored(first, eventLog);
      for (let index = 0; index < events.length; index += 1) {
        this.applyStoredEvent(record, parseStoredEvent(events[index], sessionId, index + 1), events[index].type as TerminalSessionEvent["type"], index + 1, events[index].occurredAt);
      }
      if (!record.terminal) {
        record.state = "recoverable";
        const recovery = this.recovery?.inspect();
        record.liveness = recovery?.liveness === "outcome_unknown"
          ? "outcome_unknown"
          : recovery?.connectivity === "connecting"
            ? "recovering"
            : "offline";
      }
      record.nextSequence = events.length + 1;
      record.queue = Promise.resolve();
      record.redactors.clear();
      this.sessions.set(sessionId, record);
    }
  }

  private recordFromRequest(request: TerminalSessionRequest): SessionRecord {
    const identity: WorkerSessionIdentity = {
      sessionId: request.terminalSessionId,
      terminalSessionId: request.terminalSessionId,
      agentInstanceId: request.agentInstanceId,
      contractId: request.contractId,
      roleId: request.roleId,
      runtimeId: request.runtimeId,
      workspaceId: request.workspaceId,
      workspaceRoot: request.workspace.root,
    };
    return this.newRecord(identity, this.eventLogFor(identity.sessionId), "starting", "online", false);
  }

  private recordFromStored(stored: StoredSessionPayload, eventLog: JsonlEventLog): SessionRecord {
    const identity: WorkerSessionIdentity = {
      sessionId: stored.sessionId,
      terminalSessionId: stored.terminalSessionId,
      agentInstanceId: stored.agentInstanceId,
      contractId: stored.contractId,
      roleId: stored.roleId,
      runtimeId: stored.runtimeId,
      workspaceId: stored.workspaceId,
      workspaceRoot: stored.workspaceRoot,
    };
    if (stored.terminalSessionId !== stored.sessionId) throw new Error("worker_session_identity_invalid");
    return this.newRecord(identity, eventLog, "recoverable", "offline", false);
  }

  private newRecord(
    identity: WorkerSessionIdentity,
    eventLog: JsonlEventLog,
    state: WorkerSessionState,
    liveness: WorkerSessionLiveness,
    terminal: boolean,
  ): SessionRecord {
    return {
      ...identity,
      eventLog,
      streamId: eventLog.streamIdFor(identity.contractId),
      nextSequence: 1,
      lastTerminalSequence: 0,
      state,
      liveness,
      terminal,
      historyTruncated: false,
      started: false,
      failure: false,
      persistenceError: null,
      queue: Promise.resolve(),
      redactors: new Map([
        ["stdout", this.redactor.start(redactorMaximumPendingBytes)],
        ["stderr", this.redactor.start(redactorMaximumPendingBytes)],
      ]),
      liveActivityEvents: [],
      liveActivityState: null,
    };
  }

  private eventLogFor(sessionId: string): JsonlEventLog {
    const path = join(this.sessionsRoot, `${sessionId}${eventLogSuffix}`);
    if (!isWithin(path, this.sessionsRoot)) throw new Error("worker_session_stream_path_unsafe");
    return new JsonlEventLog(path, { maxEventsPerContract: this.maxEventsPerSession });
  }

  private async acceptTerminalEvent(event: TerminalSessionEvent): Promise<void> {
    if (this.closed) return;
    const record = this.sessions.get(event.terminalSessionId);
    if (!record) {
      if (event.type !== "TERMINAL_SESSION_STARTED") return;
      const identity: WorkerSessionIdentity = {
        sessionId: event.terminalSessionId,
        terminalSessionId: event.terminalSessionId,
        agentInstanceId: event.agentInstanceId,
        contractId: event.contractId,
        roleId: event.roleId,
        runtimeId: event.runtimeId,
        workspaceId: event.workspaceId,
        workspaceRoot: event.payload.cwd,
      };
      assertSessionId(identity.sessionId);
      this.sessions.set(identity.sessionId, this.newRecord(identity, this.eventLogFor(identity.sessionId), "starting", "online", false));
    }
    const current = this.sessions.get(event.terminalSessionId)!;
    current.queue = current.queue.then(() => this.persistTerminalEvent(current, event)).catch(() => {
      current.persistenceError = new Error("worker_session_terminal_persistence_failed");
      current.state = "failed";
      current.liveness = "failed";
      current.terminal = true;
      current.failure = true;
    });
    await current.queue;
  }

  private async persistTerminalEvent(record: SessionRecord, event: TerminalSessionEvent): Promise<void> {
    assertEventIdentity(record, event);
    if (!terminalEventTypes.has(event.type)) throw new Error("worker_session_event_invalid");
    if (!record.started && event.type !== "TERMINAL_SESSION_STARTED") throw new Error("worker_session_start_missing");
    if (record.terminal && event.type !== "TERMINAL_SESSION_EXITED") throw new Error("worker_session_event_after_terminal");
    if (event.sequence <= record.lastTerminalSequence) throw new Error("worker_session_terminal_order_invalid");

    if (event.type === "TERMINAL_OUTPUT") {
      const output = await this.redactedOutput(record, event);
      record.lastTerminalSequence = event.sequence;
      if (output) {
        await this.recordTranscript(record, event, output, false);
        await this.appendPublicEvent(record, event, output, false);
      }
      return;
    }

    if (event.type === "TERMINAL_SESSION_EXITED" || event.type === "TERMINAL_SESSION_FAILED") {
      await this.flushRedactors(record);
    }
    record.lastTerminalSequence = event.sequence;
    const payload = event.type === "TERMINAL_SESSION_STARTED"
      ? this.sanitizeStartedPayload(event.payload)
      : event.type === "TERMINAL_SESSION_FAILED"
      ? { error: "terminal_session_failed", durationMs: event.payload.durationMs }
      : cloneData(event.payload);
    await this.recordTranscript(record, event, payload, false);
    await this.appendPublicEvent(record, event, payload, false);
    this.applyLiveState(record, event);
  }

  private async redactedOutput(record: SessionRecord, event: Extract<TerminalSessionEvent, { type: "TERMINAL_OUTPUT" }>): Promise<Record<string, any> | null> {
    const stream = event.payload.stream === "stderr" ? "stderr" : "stdout";
    const redactor = record.redactors.get(stream);
    if (!redactor) throw new Error("worker_session_redactor_unavailable");
    const fragment = redactor.push(event.payload.data);
    if (!fragment.text) return null;
    return { stream: event.payload.stream, data: fragment.text, redactionCount: fragment.redactionCount };
  }

  private async flushRedactors(record: SessionRecord): Promise<void> {
    for (const [stream, redactor] of record.redactors) {
      const fragment = redactor.finish();
      if (!fragment.text) continue;
      const syntheticEvent = {
        sequence: record.lastTerminalSequence,
        occurredAt: new Date().toISOString(),
        terminalSessionId: record.terminalSessionId,
        agentInstanceId: record.agentInstanceId,
        contractId: record.contractId,
        roleId: record.roleId,
        runtimeId: record.runtimeId,
        accessMode: "local",
        workspaceId: record.workspaceId,
        type: "TERMINAL_OUTPUT" as const,
        payload: { stream, data: fragment.text },
      } satisfies TerminalSessionEvent;
      await this.recordTranscript(record, syntheticEvent, { stream, data: fragment.text, redactionCount: fragment.redactionCount }, true);
      await this.appendPublicEvent(record, syntheticEvent, { stream, data: fragment.text, redactionCount: fragment.redactionCount }, true);
    }
    record.redactors.clear();
  }

  private async appendPublicEvent(
    record: SessionRecord,
    terminalEvent: Pick<TerminalSessionEvent, "occurredAt" | "type" | "payload">,
    payload: Record<string, any>,
    synthetic: boolean,
  ): Promise<void> {
    const sequence = record.nextSequence;
    const eventId = `${record.sessionId}:${sequence}`;
    const stored: StoredSessionPayload = {
      schema: WORKER_SESSION_STREAM_SCHEMA,
      schemaVersion: WORKER_SESSION_STREAM_VERSION,
      sessionId: record.sessionId,
      terminalSessionId: record.terminalSessionId,
      agentInstanceId: record.agentInstanceId,
      contractId: record.contractId,
      roleId: record.roleId,
      runtimeId: record.runtimeId,
      workspaceId: record.workspaceId,
      workspaceRoot: record.workspaceRoot,
      terminalSequence: terminalEvent.type === "TERMINAL_OUTPUT"
        ? record.lastTerminalSequence
        : record.lastTerminalSequence,
      synthetic,
      payload: cloneData(payload),
    };
    const event: MorrowEvent<StoredSessionPayload> = {
      eventId,
      contractId: record.contractId,
      type: terminalEvent.type,
      occurredAt: terminalEvent.occurredAt,
      actor: { kind: "kernel", id: "worker-session-stream" },
      payload: stored,
      correlationId: record.sessionId,
      schemaVersion: "0.1",
    };
    await record.eventLog.append(event);
    record.nextSequence += 1;
    this.appendLiveActivity(record, terminalEvent);
    this.publish(record, this.publicEvent(record, event, sequence, stored.payload));
    if (terminalEvent.type === "TERMINAL_SESSION_STARTED") record.started = true;
  }

  private sanitizeStartedPayload(payload: Extract<TerminalSessionEvent, { type: "TERMINAL_SESSION_STARTED" }>["payload"]): Record<string, any> {
    return {
      ...cloneData(payload),
      command: this.redactor.redact(payload.command).text,
      args: payload.args.map((argument) => this.redactor.redact(argument).text),
    };
  }

  private async recordTranscript(
    record: SessionRecord,
    terminalEvent: Pick<TerminalSessionEvent, "sequence" | "type" | "payload">,
    payload: Record<string, any>,
    synthetic: boolean,
  ): Promise<void> {
    const stream = terminalEvent.type === "TERMINAL_OUTPUT"
      ? payload.stream === "stderr" ? "stderr" : payload.stream === "terminal" ? "terminal" : "stdout"
      : "system";
    const content = terminalEvent.type === "TERMINAL_OUTPUT" ? payload.data : JSON.stringify(payload);
    if (typeof content !== "string") throw new Error("worker_session_transcript_payload_invalid");
    const writer = this.transcript.beginRecord({
      recordId: createHash("sha256")
        .update(`morrow.worker-session-stream/transcript/v1|${record.sessionId}|${record.nextSequence}|${terminalEvent.sequence}|${terminalEvent.type}|${stream}|${synthetic ? "synthetic" : "terminal"}`, "utf8")
        .digest("hex"),
      contractId: record.contractId,
      stepId: "worker-session-stream",
      terminalSessionId: record.terminalSessionId,
      agentInstanceId: record.agentInstanceId,
      stream,
      writerId: "worker-session-stream",
    });
    writer.write(content);
    await writer.commit();
  }

  private appendLiveActivity(
    record: SessionRecord,
    terminalEvent: Pick<TerminalSessionEvent, "occurredAt" | "type" | "payload">,
  ): void {
    if (record.liveActivityState && (record.liveActivityState === "done" || record.liveActivityState === "failed")) return;
    const transitions: Array<{ to: LiveActivityEvent["transition"]["to"]; sourceKind: LiveActivityEvent["transition"]["sourceKind"] }> = [];
    if (terminalEvent.type === "TERMINAL_SESSION_STARTED" && !record.liveActivityState) {
      transitions.push({ to: "dispatch", sourceKind: "kernel" }, { to: "process", sourceKind: "process" });
    } else if (terminalEvent.type === "TERMINAL_OUTPUT") {
      transitions.push({ to: "process", sourceKind: "process" });
    } else if (terminalEvent.type === "TERMINAL_INPUT_WRITTEN" || terminalEvent.type === "TERMINAL_INPUT_ENDED"
      || terminalEvent.type === "TERMINAL_RESIZED" || terminalEvent.type === "TERMINAL_INTERRUPT_REQUESTED") {
      transitions.push({ to: "tool", sourceKind: "tool" });
    } else if (terminalEvent.type === "TERMINAL_SESSION_FAILED") {
      if (!record.liveActivityState) transitions.push({ to: "dispatch", sourceKind: "kernel" });
      transitions.push({ to: "failed", sourceKind: "kernel" });
    } else if (terminalEvent.type === "TERMINAL_SESSION_EXITED") {
      transitions.push({ to: terminalEvent.payload.exitCode === 0 && !terminalEvent.payload.timedOut && !terminalEvent.payload.stopped ? "done" : "failed", sourceKind: "process" });
    }
    for (const transition of transitions) {
      const sequence = record.liveActivityEvents.length + 1;
      const liveIdentity = `${record.sessionId}|${sequence}|${terminalEvent.type}`;
      const previousOccurredAt = record.liveActivityEvents.at(-1)?.occurredAt;
      const occurredAt = previousOccurredAt && Date.parse(terminalEvent.occurredAt) < Date.parse(previousOccurredAt)
        ? previousOccurredAt
        : terminalEvent.occurredAt;
      const event: LiveActivityEvent = {
        schema: "morrow.live-activity",
        schemaVersion: "1.0",
        eventId: createHash("sha256").update(`morrow.worker-session-stream/live-event/v1|${liveIdentity}`, "utf8").digest("hex"),
        causationId: record.liveActivityEvents.at(-1)?.eventId ?? null,
        sequence,
        occurredAt,
        actor: { kind: "kernel", id: "worker-session-stream" },
        identity: {
          activityId: record.sessionId,
          correlationId: record.sessionId,
          contractId: record.contractId,
          stepId: "worker-session-stream",
          agentInstanceId: record.agentInstanceId,
          terminalSessionId: record.terminalSessionId,
          workspaceId: record.workspaceId,
        },
        transition: {
          from: record.liveActivityState,
          to: transition.to,
          reasonCode: `terminal_${terminalEvent.type.toLowerCase()}`,
          sourceKind: transition.sourceKind,
          sourceId: createHash("sha256").update(`morrow.worker-session-stream/live-source/v1|${liveIdentity}|${occurredAt}`, "utf8").digest("hex"),
        },
      };
      const validated = validateLiveActivityEvent(event);
      if (!validated.ok) throw new Error("worker_session_live_activity_invalid");
      assertLiveActivityAppend(record, validated.event);
      record.liveActivityEvents.push(validated.event);
      record.liveActivityState = validated.event.transition.to;
      this.publishLiveActivity(record, validated.event);
    }
  }

  private applyLiveState(record: SessionRecord, event: TerminalSessionEvent): void {
    if (event.type === "TERMINAL_SESSION_STARTED") {
      record.started = true;
      record.state = "running";
      record.liveness = "online";
      return;
    }
    if (event.type === "TERMINAL_SESSION_FAILED") {
      record.failure = true;
      record.state = "failed";
      record.liveness = "failed";
      record.terminal = true;
      return;
    }
    if (event.type === "TERMINAL_SESSION_EXITED") {
      record.terminal = true;
      record.liveness = record.failure ? "failed" : "terminal";
      record.state = record.failure
        ? "failed"
        : event.payload.timedOut
          ? "timed_out"
          : event.payload.stopped
            ? "stopped"
            : event.payload.exitCode === 0
              ? "completed"
              : "failed";
      if (record.state === "failed") record.failure = true;
    }
  }

  private applyStoredEvent(record: SessionRecord, stored: StoredSessionPayload, type: TerminalSessionEvent["type"], sequence: number, occurredAt: string): void {
    if (stored.sessionId !== record.sessionId || stored.contractId !== record.contractId
      || stored.terminalSessionId !== record.terminalSessionId || stored.agentInstanceId !== record.agentInstanceId
      || stored.roleId !== record.roleId || stored.runtimeId !== record.runtimeId
      || stored.workspaceId !== record.workspaceId || stored.workspaceRoot !== record.workspaceRoot) {
      throw new Error("worker_session_identity_drift");
    }
    if (!stored.synthetic && stored.terminalSequence <= record.lastTerminalSequence) {
      throw new Error("worker_session_terminal_order_invalid");
    }
    if (stored.synthetic && stored.payload.stream === undefined) throw new Error("worker_session_flush_invalid");
    record.lastTerminalSequence = Math.max(record.lastTerminalSequence, stored.terminalSequence);
    if (stored.payload.stream === "stdout" || stored.payload.stream === "stderr") {
      if (typeof stored.payload.data !== "string" || this.redactor.redact(stored.payload.data).text !== stored.payload.data) {
        throw new Error("worker_session_output_not_redacted");
      }
    }
    if (type === "TERMINAL_SESSION_STARTED") {
      if (record.started || stored.synthetic) throw new Error("worker_session_start_invalid");
      record.started = true;
      record.state = "running";
      record.liveness = "online";
    } else if (!record.started) {
      throw new Error("worker_session_start_missing");
    }
    if (type === "TERMINAL_SESSION_FAILED") {
      record.failure = true;
      record.terminal = true;
      record.state = "failed";
      record.liveness = "failed";
    } else if (type === "TERMINAL_SESSION_EXITED") {
      record.terminal = true;
      record.liveness = record.failure ? "failed" : "terminal";
      const payload = stored.payload;
      record.state = record.failure
        ? "failed"
        : payload.timedOut === true
          ? "timed_out"
          : payload.stopped === true
            ? "stopped"
            : payload.exitCode === 0
              ? "completed"
              : "failed";
      if (record.state === "failed") record.failure = true;
    } else if (type !== "TERMINAL_OUTPUT" && stored.synthetic) {
      throw new Error("worker_session_flush_invalid");
    }
    this.appendLiveActivity(record, { type, occurredAt, payload: stored.payload });
  }

  private publicEvent(record: SessionRecord, event: MorrowEvent<StoredSessionPayload>, sequence: number, payload: Record<string, any>): WorkerSessionStreamEvent {
    return Object.freeze({
      schema: WORKER_SESSION_STREAM_SCHEMA,
      schemaVersion: WORKER_SESSION_STREAM_VERSION,
      eventId: event.eventId,
      sequence,
      occurredAt: event.occurredAt,
      sessionId: record.sessionId,
      terminalSessionId: record.terminalSessionId,
      agentInstanceId: record.agentInstanceId,
      contractId: record.contractId,
      roleId: record.roleId,
      runtimeId: record.runtimeId,
      workspaceId: record.workspaceId,
      type: event.type as TerminalSessionEvent["type"],
      payload: deepFreezeData(cloneData(payload)),
    });
  }

  private mapReplay(record: SessionRecord, result: EventReplayResult): WorkerSessionReplayResult {
    return Object.freeze({
      status: result.status,
      sessionId: record.sessionId,
      streamId: result.streamId,
      contractId: result.contractId,
      cursor: result.cursor,
      nextCursor: result.nextCursor,
      retainedFromSequence: result.retainedFromSequence,
      headSequence: result.headSequence,
      events: Object.freeze(result.events.map((event, index) => {
        const stored = parseStoredEvent(event, record.sessionId, result.cursor.sequence + index + 1);
        return this.publicEvent(record, event as MorrowEvent<StoredSessionPayload>, result.cursor.sequence + index + 1, stored.payload);
      })),
    });
  }

  private invalidReplay(record: SessionRecord): WorkerSessionReplayResult {
    const cursor = Object.freeze({ streamId: record.streamId, sequence: 0 });
    return Object.freeze({
      status: "invalid" as const,
      sessionId: record.sessionId,
      streamId: record.streamId,
      contractId: record.contractId,
      cursor,
      nextCursor: cursor,
      retainedFromSequence: 1,
      headSequence: 0,
      events: Object.freeze([] as WorkerSessionStreamEvent[]),
    });
  }

  private publish(record: SessionRecord, event: WorkerSessionStreamEvent): void {
    const listeners = this.listeners.get(record.sessionId);
    if (!listeners) return;
    for (const listener of listeners) {
      try { listener(event); } catch { /* observers cannot affect persistence */ }
    }
  }

  private descriptor(record: SessionRecord): WorkerSessionDescriptor {
    return Object.freeze({
      sessionId: record.sessionId,
      terminalSessionId: record.terminalSessionId,
      agentInstanceId: record.agentInstanceId,
      contractId: record.contractId,
      roleId: record.roleId,
      runtimeId: record.runtimeId,
      workspaceId: record.workspaceId,
      workspaceRoot: record.workspaceRoot,
      streamId: record.streamId,
      state: record.state,
      liveness: record.liveness,
      terminal: record.terminal,
      headSequence: record.nextSequence - 1,
      historyTruncated: record.historyTruncated,
    });
  }

  private liveActivityFor(record: SessionRecord): LiveActivityProjectionResult {
    return projectContractLiveActivity(record.contractId, record.liveActivityEvents);
  }

  private transcriptFor(record: SessionRecord): TranscriptView {
    const view = this.transcript.inspect("worker-session-stream");
    const records = view.records.filter((item) => item.contractId === record.contractId
      && item.terminalSessionId === record.terminalSessionId);
    return Object.freeze({
      ...view,
      records: Object.freeze(records),
      totalBytes: records.reduce((total, item) => total + Buffer.byteLength(item.content, "utf8"), 0),
    });
  }

  private publishLiveActivity(record: SessionRecord, event: LiveActivityEvent): void {
    const listeners = this.liveActivityListeners.get(record.sessionId);
    if (!listeners) return;
    for (const listener of listeners) {
      try { listener(event); } catch { /* observers cannot affect persistence */ }
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new Error("worker_session_stream_closed");
  }
}

function parseStoredEvent(value: MorrowEvent, sessionId: string, sequence: number): StoredSessionPayload {
  if (!isPlainRecord(value.payload) || value.eventId !== `${sessionId}:${sequence}`
    || value.schemaVersion !== "0.1" || !terminalEventTypes.has(value.type as TerminalSessionEvent["type"])) {
    throw new Error("worker_session_event_invalid");
  }
  const payload = value.payload;
  const keys = [
    "schema", "schemaVersion", "sessionId", "terminalSessionId", "agentInstanceId", "contractId",
    "roleId", "runtimeId", "workspaceId", "workspaceRoot", "terminalSequence", "synthetic", "payload",
  ];
  if (!hasExactKeys(payload, keys)
    || payload.schema !== WORKER_SESSION_STREAM_SCHEMA
    || payload.schemaVersion !== WORKER_SESSION_STREAM_VERSION
    || payload.sessionId !== sessionId
    || value.contractId !== payload.contractId
    || !isIdentifier(payload.terminalSessionId) || !isIdentifier(payload.agentInstanceId)
    || !isIdentifier(payload.contractId) || !isIdentifier(payload.roleId) || !isIdentifier(payload.runtimeId)
    || !isIdentifier(payload.workspaceId) || typeof payload.workspaceRoot !== "string"
    || !Number.isSafeInteger(payload.terminalSequence) || payload.terminalSequence < 0
    || typeof payload.synthetic !== "boolean" || !isPlainRecord(payload.payload)) {
    throw new Error("worker_session_payload_invalid");
  }
  return payload as unknown as StoredSessionPayload;
}

function assertEventIdentity(record: SessionRecord, event: TerminalSessionEvent): void {
  if (event.terminalSessionId !== record.terminalSessionId || event.agentInstanceId !== record.agentInstanceId
    || event.contractId !== record.contractId || event.roleId !== record.roleId
    || event.runtimeId !== record.runtimeId || event.workspaceId !== record.workspaceId) {
    throw new Error("worker_session_identity_drift");
  }
}

async function ensureSafeDirectory(path: string): Promise<void> {
  if (!isAbsolute(path)) throw new Error("worker_session_state_root_must_be_absolute");
  try {
    const { assertCanonicalDirectoryPath } = await import("./stream-transcript.ts");
    await assertCanonicalDirectoryPath(path);
    await mkdir(path, { recursive: true });
    await assertCanonicalDirectoryPath(path);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("worker_session_")) throw error;
    throw new Error("worker_session_state_root_unsafe");
  }
}

function assertConfiguration(configuration: WorkerSessionStreamConfiguration): void {
  try {
    if (!isPlainRecord(configuration)) throw new Error();
    const keys = Object.keys(configuration);
    if (keys.some((key) => !["stateRoot", "terminals", "redaction", "maxEventsPerSession", "transcript", "recovery"].includes(key))) throw new Error();
    if (typeof configuration.stateRoot !== "string"
      || !isAbsolute(configuration.stateRoot) || !(configuration.terminals instanceof TerminalSessionManager)) throw new Error();
    if (configuration.transcript !== undefined && !(configuration.transcript instanceof PersistentTranscriptStore)) throw new Error();
    if (configuration.recovery !== undefined && !(configuration.recovery instanceof WorkerRecoveryCoordinator)) throw new Error();
    if (configuration.maxEventsPerSession !== undefined
      && (!Number.isSafeInteger(configuration.maxEventsPerSession) || configuration.maxEventsPerSession < 1)) throw new Error();
  } catch {
    throw new Error("worker_session_stream_configuration_invalid");
  }
}

function assertSessionId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !sessionIdPattern.test(value)) throw new Error("worker_session_id_invalid");
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u.test(value);
}

function isPlainRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

function cloneData<T>(value: T): T {
  return structuredClone(value);
}

function assertLiveActivityAppend(record: SessionRecord, event: LiveActivityEvent): void {
  const previous = record.liveActivityEvents.at(-1) ?? null;
  const expectedSequence = record.liveActivityEvents.length + 1;
  const identity = event.identity;
  if (event.sequence !== expectedSequence
    || event.causationId !== (previous?.eventId ?? null)
    || identity.activityId !== record.sessionId
    || identity.correlationId !== record.sessionId
    || identity.contractId !== record.contractId
    || identity.stepId !== "worker-session-stream"
    || identity.agentInstanceId !== record.agentInstanceId
    || identity.terminalSessionId !== record.terminalSessionId
    || identity.workspaceId !== record.workspaceId
    || event.transition.from !== record.liveActivityState) {
    throw new Error("worker_session_live_activity_invalid");
  }
  const occurredAt = Date.parse(event.occurredAt);
  if (previous && occurredAt < Date.parse(previous.occurredAt)) {
    throw new Error("worker_session_live_activity_invalid");
  }
  const from = record.liveActivityState;
  const to = event.transition.to;
  if ((from === null && to !== "dispatch")
    || (from !== null && (!liveActivityActiveStates.has(from) || to === "dispatch"))
    || !liveActivitySourceKinds[to].includes(event.transition.sourceKind)) {
    throw new Error("worker_session_live_activity_invalid");
  }
}

const liveActivityActiveStates = new Set(["dispatch", "gate", "tool", "process", "waiting-lock", "waiting-quota", "waiting-owner"]);
const liveActivitySourceKinds: Record<LiveActivityEvent["transition"]["to"], readonly LiveActivityEvent["transition"]["sourceKind"][]> = {
  dispatch: ["orchestrator", "kernel"],
  gate: ["gate", "kernel"],
  tool: ["tool"],
  process: ["process"],
  "waiting-lock": ["lock"],
  "waiting-quota": ["quota"],
  "waiting-owner": ["owner"],
  blocked: ["orchestrator", "gate", "lock", "quota", "owner", "kernel"],
  failed: ["gate", "tool", "process", "kernel"],
  done: ["orchestrator", "tool", "process", "kernel"],
};

function deepFreezeData<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value;
  const object = value as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const key of Reflect.ownKeys(object)) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (descriptor && "value" in descriptor) deepFreezeData(descriptor.value, seen);
  }
  return Object.freeze(value);
}

function isWithin(candidate: string, root: string): boolean {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

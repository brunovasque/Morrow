import { createHash } from "node:crypto";
import { constants as osConstants } from "node:os";
import { validateTerminalBackendDescriptor, resolveTerminalPresentation, type TerminalProtocol } from "./terminal-backend.ts";
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
  TRANSCRIPT_REDACTION_PLACEHOLDER,
  type TranscriptRecord,
  type TranscriptView,
  type StreamRedactionPolicy,
  type StreamRedactorSession,
} from "./stream-transcript.ts";
import {
  LIVE_ACTIVITY_MAX_EVENTS,
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
  redactorForTerminalRequest,
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
  exitSeen: boolean;
  lastExit: Extract<TerminalSessionEvent, {type:"TERMINAL_SESSION_EXITED"}>["payload"] | null;
  protocol: TerminalProtocol | null;
  redactor: StreamRedactor;
  transcriptIds: Set<string>;
  // Only events admitted in this observation lifetime may mutate a record.
  liveBinding: { accessMode: TerminalSessionRequest["accessMode"]; admitted: boolean; ready: Promise<boolean> } | null;
  persistenceError: Error | null;
  queue: Promise<void>;
  redactors: Map<OutputChannel, StreamRedactorSession>;
  liveActivityEvents: LiveActivityEvent[];
  liveActivityState: LiveActivityEvent["transition"]["to"] | null;
}

type OutputChannel = Extract<TerminalSessionEvent, { type: "TERMINAL_OUTPUT" }>["payload"]["stream"];

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
  // Event-log authority derives identity from a case-folded path, including on Windows.
  private readonly sessionKeys = new Set<string>();
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
    // A historical ID is not proof that a manager session belongs to this lifecycle.
    const terminalSnapshot = record.liveBinding?.admitted && !record.persistenceError
      ? this.terminals.list().find((item) => matchesTerminalSnapshot(record, item) && matchesDurableOutcome(record, item)) ?? null
      : null;
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
    request = cloneData(request);
    assertSessionId(request.terminalSessionId);
    const sessionKey = request.terminalSessionId.toLowerCase();
    if (this.sessionKeys.has(sessionKey)) throw new Error("worker_session_id_already_exists");
    const record = this.recordFromRequest(request);
    let settleAdmission!: (accepted: boolean) => void;
    const ready = new Promise<boolean>((resolveAdmission) => { settleAdmission = resolveAdmission; });
    record.liveBinding = { accessMode: request.accessMode, admitted: false, ready };
    this.sessions.set(record.sessionId, record);
    this.sessionKeys.add(sessionKey);
    try {
      // The authoritative scan includes external anchors even when the log is absent.
      // Reserve the in-memory identity first, then refuse known history before process launch.
      await this.assertUnusedHistory(record);
      this.assertOpen();
      const handle = await this.terminals.start(request);
      record.liveBinding.admitted = true;
      settleAdmission(true);
      const completion = handle.completion.then(async (result) => {
        await record.queue;
        if (record.persistenceError) throw record.persistenceError;
        // A settled terminal process is not proof that its terminal event was committed.
        if (!record.terminal || !matchesDurableOutcome(record, result) || !matchesTerminalSnapshot(record, result)) {
          throw new Error("worker_session_terminal_persistence_failed");
        }
        return Object.freeze({
          ...result,
          stdout: record.redactor.redact(result.stdout).text,
          stderr: record.redactor.redact(result.stderr).text,
          error: result.error === undefined ? undefined : "terminal_session_failed",
        });
      });
      return Object.freeze({ sessionId: record.sessionId, completion });
    } catch (error) {
      settleAdmission(false);
      this.sessions.delete(record.sessionId);
      this.sessionKeys.delete(sessionKey);
      throw error;
    }
  }

  async replay(sessionId: string, cursor?: unknown, limit = 1_024): Promise<WorkerSessionReplayResult> {
    this.assertOpen();
    assertSessionId(sessionId);
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error("worker_session_not_found");
    // Serialize the read with the same persistence queue. A replay cannot
    // silently incorporate an authenticated append outside this lifecycle.
    const replay = record.queue.then(async () => {
      try {
        const result = await record.eventLog.replay(record.contractId, cursor, limit);
        if (result.status !== "invalid" && result.headSequence !== record.nextSequence - 1) {
          return this.invalidReplay(record);
        }
        return this.mapReplay(record, result);
      } catch {
        return this.invalidReplay(record);
      }
    });
    record.queue = replay.then(() => undefined);
    return replay;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.unsubscribeTerminalEvents?.();
    this.unsubscribeTerminalEvents = null;
    let flushError: Error | null = null;
    for (const record of this.sessions.values()) {
      record.queue = record.queue.then(async () => {
        if (!record.terminal && !record.persistenceError) await this.flushRedactors(record, true);
      }).catch(() => {
        this.markPersistenceFailure(record);
        flushError = record.persistenceError;
      });
    }
    await Promise.all([...this.sessions.values()].map((record) => record.queue));
    if (this.ownsTranscript) await this.transcript.close();
    if (flushError) throw flushError;
  }

  private async rehydrate(): Promise<void> {
    const entries = await readdir(this.sessionsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(eventLogSuffix)) {
        throw new Error("worker_session_stream_entry_invalid");
      }
      const sessionId = entry.name.slice(0, -eventLogSuffix.length);
      assertSessionId(sessionId);
      const sessionKey = sessionId.toLowerCase();
      if (this.sessionKeys.has(sessionKey)) throw new Error("worker_session_id_already_exists");
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
      this.sessionKeys.add(sessionKey);
    }
    // Retained transcript evidence is a second existing witness to a session ID.
    // Never reconstruct a successful descriptor from it, and never reset a
    // missing authenticated log as a new session. Retention may omit old IDs;
    // the per-ID authority scan in start remains mandatory.
    for (const item of this.transcript.inspect("worker-session-stream").records) {
      if (item.stepId !== "worker-session-stream" || item.writerId !== "worker-session-stream") continue;
      assertSessionId(item.terminalSessionId);
      const key = item.terminalSessionId.toLowerCase();
      if (this.sessionKeys.has(key)) continue;
      await this.eventLogFor(item.terminalSessionId).readAll();
      this.sessionKeys.add(key);
    }
  }

  private async assertUnusedHistory(record: SessionRecord): Promise<void> {
    if ((await record.eventLog.readAll()).length !== 0) throw new Error("worker_session_id_already_exists");
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
    const redactor = redactorForTerminalRequest(request, this.redactor);
    return this.newRecord(identity, this.eventLogFor(identity.sessionId), "starting", "online", false, redactor);
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
    redactor = this.redactor,
  ): SessionRecord {
    assertCanonicalIdentity(identity, redactor);
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
      exitSeen: false,
      lastExit: null,
      protocol: null,
      redactor,
      transcriptIds: new Set(),
      liveBinding: null,
      persistenceError: null,
      queue: Promise.resolve(),
      redactors: new Map([
        ["stdout", redactor.start(redactorMaximumPendingBytes)],
        ["stderr", redactor.start(redactorMaximumPendingBytes)],
        ["terminal", redactor.start(redactorMaximumPendingBytes)],
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
    if (this.closed || !sessionIdPattern.test(event.terminalSessionId)) return;
    let current = this.sessions.get(event.terminalSessionId);
    if (!current) {
      if (event.type === "TERMINAL_OUTPUT") return;
      const managerSnapshot = this.terminals.list().find(item => item.terminalSessionId === event.terminalSessionId);
      if (!managerSnapshot) return;
      const identity: WorkerSessionIdentity = {
        sessionId: event.terminalSessionId,
        terminalSessionId: event.terminalSessionId,
        agentInstanceId: event.agentInstanceId,
        contractId: event.contractId,
        roleId: event.roleId,
        runtimeId: event.runtimeId,
        workspaceId: event.workspaceId,
        workspaceRoot: managerSnapshot.workspaceRoot,
      };
      const sessionKey = identity.sessionId.toLowerCase();
      if (this.sessionKeys.has(sessionKey)) return;
      if (!matchesIdentity(identity, managerSnapshot) || managerSnapshot.accessMode !== event.accessMode) return;
      // Direct manager calls are privileged, independent of stream.start.
      // Observation may bind only a new canonical lifecycle, never old history.
      this.sessionKeys.add(sessionKey);
      try {
        const redactor = this.terminals.observationRedactor(identity.sessionId, this.redactor);
        const admitted = this.newRecord(identity, this.eventLogFor(identity.sessionId), "starting", "online", false, redactor);
        const ready = this.assertUnusedHistory(admitted).then(() => {
          if (this.closed) return false;
          admitted.liveBinding!.admitted = true;
          return true;
        }, () => {
          this.sessions.delete(identity.sessionId);
          return false;
        });
        admitted.liveBinding = { accessMode: event.accessMode, admitted: false, ready };
        current = admitted;
        this.sessions.set(identity.sessionId, current);
      } catch {
        // A policy that cannot safely represent declared literals cannot be observed.
        return;
      }
    }
    const binding = current.liveBinding;
    // Rehydration never grants a new process authority over a historical ID.
    if (!binding) return;
    const admittedRecord = current;
    // Capture the manager event before another observer can mutate its payload.
    let detached: TerminalSessionEvent;
    try { detached = cloneData(event); } catch { this.markPersistenceFailure(admittedRecord); return; }
    admittedRecord.queue = admittedRecord.queue.then(async () => {
      // A competing manager start cannot write while our reservation is unconfirmed.
      if (await binding.ready && !admittedRecord.persistenceError) {
        await this.persistTerminalEvent(admittedRecord, detached);
      }
    }).catch(() => this.markPersistenceFailure(admittedRecord));
    await admittedRecord.queue;
  }

  private markPersistenceFailure(record: SessionRecord): void {
    record.persistenceError ??= new Error("worker_session_terminal_persistence_failed");
    record.state = "failed";
    record.liveness = "failed";
    record.failure = true;
  }

  private async persistTerminalEvent(record: SessionRecord, event: TerminalSessionEvent): Promise<void> {
    assertEventIdentity(record, event);
    assertTerminalEventEnvelope(event);
    assertCanonicalPayload(record, event.type, event.payload, false);
    assertLifecycleTransition(record, event.type, event.payload);
    if (event.sequence <= record.lastTerminalSequence) throw new Error("worker_session_terminal_order_invalid");

    if (event.type === "TERMINAL_OUTPUT") {
      const output = await this.redactedOutput(record, event);
      record.lastTerminalSequence = event.sequence;
      if (output) {
        this.assertLiveActivityCapacity(record, event);
        assertCanonicalPayload(record, event.type, output, true);
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
      ? this.sanitizeStartedPayload(event.payload, record.redactor)
      : event.type === "TERMINAL_SESSION_FAILED"
      ? { error: "terminal_session_failed", durationMs: event.payload.durationMs }
      : cloneData(event.payload);
    this.assertLiveActivityCapacity(record, event);
    assertCanonicalPayload(record, event.type, payload, true);
    await this.recordTranscript(record, event, payload, false);
    await this.appendPublicEvent(record, event, payload, false);
  }

  private async redactedOutput(record: SessionRecord, event: Extract<TerminalSessionEvent, { type: "TERMINAL_OUTPUT" }>): Promise<Record<string, any> | null> {
    const stream = event.payload.stream;
    if (!isOutputChannel(stream)) throw new Error("worker_session_output_channel_invalid");
    const redactor = record.redactors.get(stream);
    if (!redactor) throw new Error("worker_session_redactor_unavailable");
    const fragment = redactor.push(event.payload.data);
    if (!fragment.text) return null;
    return { stream, data: fragment.text, redactionCount: fragment.redactionCount };
  }

  private async flushRedactors(record: SessionRecord, interrupted = false): Promise<void> {
    for (const [stream, redactor] of record.redactors) {
      const fragment = interrupted ? redactor.finishInterrupted() : redactor.finish();
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
      this.assertLiveActivityCapacity(record, syntheticEvent);
      assertCanonicalPayload(record, syntheticEvent.type, { stream, data: fragment.text, redactionCount: fragment.redactionCount }, true);
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
    this.assertLiveActivityCapacity(record, terminalEvent);
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
    this.assertStoredPublicPayload(record, stored, terminalEvent.type);
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
    record.transcriptIds.add(transcriptRecordId(record.sessionId, sequence, stored.terminalSequence, terminalEvent.type, stored.payload, synthetic));
    this.applyCanonicalState(record, terminalEvent.type, stored.payload);
    this.appendLiveActivity(record, { ...terminalEvent, payload: stored.payload });
    this.publish(record, this.publicEvent(record, event, sequence, stored.payload));
  }

  private assertLiveActivityCapacity(
    record: SessionRecord,
    terminalEvent: Pick<TerminalSessionEvent, "type" | "payload">,
  ): void {
    const additional = liveActivityTransitionCount(record.liveActivityState, terminalEvent);
    if (record.liveActivityEvents.length + additional > LIVE_ACTIVITY_MAX_EVENTS) {
      throw new Error("worker_session_live_activity_limit");
    }
  }

  private sanitizeStartedPayload(payload: Extract<TerminalSessionEvent, { type: "TERMINAL_SESSION_STARTED" }>["payload"], redactor = this.redactor): Record<string, any> {
    if (typeof payload.command !== "string" || !Array.isArray(payload.args)
      || !payload.args.every((argument) => typeof argument === "string")) {
      throw new Error("worker_session_start_payload_invalid");
    }
    const command = redactor.redact(payload.command).text;
    const args = payload.args.map((argument) => redactor.redact(argument).text);
    // The policy recognizes sensitive CLI/assignment values in context. An argv
    // vector is not a shell string: quoting and whitespace have already been
    // resolved. If any member or the full context needs redaction, mask the
    // complete argument vector rather than risk exposing part of a value.
    const context = [payload.command, ...payload.args].join(" ");
    const sensitive = command !== payload.command
      || args.some((argument, index) => argument !== payload.args[index] || argument === TRANSCRIPT_REDACTION_PLACEHOLDER)
      || redactor.redact(context).text !== context;
    return {
      ...cloneData(payload),
      command,
      args: sensitive ? payload.args.map(() => TRANSCRIPT_REDACTION_PLACEHOLDER) : args,
    };
  }

  private async recordTranscript(
    record: SessionRecord,
    terminalEvent: Pick<TerminalSessionEvent, "sequence" | "type" | "payload">,
    payload: Record<string, any>,
    synthetic: boolean,
  ): Promise<void> {
    if (terminalEvent.type === "TERMINAL_OUTPUT" && !isOutputChannel(payload.stream)) {
      throw new Error("worker_session_output_channel_invalid");
    }
    const stream = terminalEvent.type === "TERMINAL_OUTPUT" ? payload.stream as OutputChannel : "system";
    const content = terminalEvent.type === "TERMINAL_OUTPUT" ? payload.data : JSON.stringify(payload);
    if (typeof content !== "string") throw new Error("worker_session_transcript_payload_invalid");
    const writer = this.transcript.beginRecord({
      recordId: transcriptRecordId(record.sessionId, record.nextSequence, terminalEvent.sequence, terminalEvent.type, payload, synthetic),
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
    if (!record.liveActivityState) transitions.push({ to: "dispatch", sourceKind: "kernel" });
    if (terminalEvent.type === "TERMINAL_SESSION_STARTED" || terminalEvent.type === "TERMINAL_OUTPUT") {
      transitions.push({ to: "process", sourceKind: "process" });
    } else if (terminalEvent.type === "TERMINAL_INPUT_WRITTEN" || terminalEvent.type === "TERMINAL_INPUT_ENDED"
      || terminalEvent.type === "TERMINAL_RESIZED" || terminalEvent.type === "TERMINAL_INTERRUPT_REQUESTED") {
      transitions.push({ to: "tool", sourceKind: "tool" });
    } else if (terminalEvent.type === "TERMINAL_SESSION_FAILED") {
      transitions.push({ to: "failed", sourceKind: "kernel" });
    } else if (terminalEvent.type === "TERMINAL_SESSION_EXITED") {
      transitions.push({ to: terminalEvent.payload.exitCode === 0 && !terminalEvent.payload.timedOut && !terminalEvent.payload.stopped ? "done" : "failed", sourceKind: "process" });
    }
    if (record.liveActivityEvents.length + transitions.length > LIVE_ACTIVITY_MAX_EVENTS) {
      throw new Error("worker_session_live_activity_limit");
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

  private applyCanonicalState(record: SessionRecord, type: TerminalSessionEvent["type"], payload: Record<string, any>): void {
    if (type === "TERMINAL_SESSION_STARTED") {
      record.started = true;
      record.protocol = payload.terminalProtocol;
      record.state = "running";
      record.liveness = "online";
    } else if (type === "TERMINAL_SESSION_FAILED") {
      record.failure = true;
      record.state = "failed";
      record.liveness = "failed";
      record.terminal = true;
    } else if (type === "TERMINAL_SESSION_EXITED") {
      record.exitSeen = true;
      record.lastExit = cloneData(payload) as SessionRecord["lastExit"];
      record.terminal = true;
      record.state = record.failure ? "failed" : payload.timedOut ? "timed_out" : payload.stopped ? "stopped" : payload.exitCode === 0 ? "completed" : "failed";
      if (record.state === "failed") record.failure = true;
      record.liveness = record.failure ? "failed" : "terminal";
    }
  }

  private applyStoredEvent(record: SessionRecord, stored: StoredSessionPayload, type: TerminalSessionEvent["type"], sequence: number, occurredAt: string): void {
    this.assertStoredPublicPayload(record, stored, type);
    assertLifecycleTransition(record, type, stored.payload);
    if ((!stored.synthetic && stored.terminalSequence <= record.lastTerminalSequence)
      || (stored.synthetic && stored.terminalSequence < record.lastTerminalSequence)) {
      throw new Error("worker_session_terminal_order_invalid");
    }
    record.lastTerminalSequence = stored.terminalSequence;
    record.transcriptIds.add(transcriptRecordId(record.sessionId, sequence, stored.terminalSequence, type, stored.payload, stored.synthetic));
    this.applyCanonicalState(record, type, stored.payload);
    this.appendLiveActivity(record, { type, occurredAt, payload: stored.payload });
  }

  private assertStoredPublicPayload(record: SessionRecord, stored: StoredSessionPayload, type: TerminalSessionEvent["type"]): void {
    if (stored.sessionId !== record.sessionId || stored.workspaceRoot !== record.workspaceRoot || !matchesIdentity(record, stored)) {
      throw new Error("worker_session_identity_drift");
    }
    if (stored.synthetic && type !== "TERMINAL_OUTPUT") throw new Error("worker_session_flush_invalid");
    assertCanonicalPayload(record, type, stored.payload, true);
    if (type === "TERMINAL_SESSION_STARTED") {
      const payload = stored.payload;
      const sanitized = this.sanitizeStartedPayload(payload as Extract<TerminalSessionEvent, {type:"TERMINAL_SESSION_STARTED"}>["payload"], record.redactor);
      if (sanitized.command !== payload.command || JSON.stringify(sanitized.args) !== JSON.stringify(payload.args)) {
        throw new Error("worker_session_start_not_redacted");
      }
    }
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
        this.assertStoredPublicPayload(record, stored, event.type as TerminalSessionEvent["type"]);
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
      && item.terminalSessionId === record.terminalSessionId
      && item.agentInstanceId === record.agentInstanceId
      && item.stepId === "worker-session-stream" && item.writerId === "worker-session-stream"
      && record.transcriptIds.has(item.recordId));
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
  if (!isPlainRecord(value) || !hasExactKeys(value, ["eventId","contractId","type","occurredAt","actor","payload","correlationId","schemaVersion"])
    || !isPlainRecord(value.actor) || !hasExactKeys(value.actor, ["kind","id"]) || value.actor.kind !== "kernel" || value.actor.id !== "worker-session-stream"
    || value.correlationId !== sessionId || !canonicalTime(value.occurredAt)
    || !isPlainRecord(value.payload) || value.eventId !== `${sessionId}:${sequence}`
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
    || !Number.isSafeInteger(payload.terminalSequence) || payload.terminalSequence < 1
    || typeof payload.synthetic !== "boolean" || !isPlainRecord(payload.payload)) {
    throw new Error("worker_session_payload_invalid");
  }
  return payload as unknown as StoredSessionPayload;
}

function sameWorkspaceRoot(left: string, right: string): boolean {
  if (typeof left !== "string" || typeof right !== "string" || !isAbsolute(left) || !isAbsolute(right)) return false;
  const a = resolve(left), b = resolve(right);
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function matchesIdentity(record: WorkerSessionIdentity, item: Omit<WorkerSessionIdentity, "sessionId">): boolean {
  return item.terminalSessionId === record.terminalSessionId && item.agentInstanceId === record.agentInstanceId
    && item.contractId === record.contractId && item.roleId === record.roleId && item.runtimeId === record.runtimeId
    && item.workspaceId === record.workspaceId && sameWorkspaceRoot(record.workspaceRoot, item.workspaceRoot);
}

function matchesTerminalSnapshot(record: SessionRecord, item: TerminalSessionSnapshot): boolean {
  return record.liveBinding?.admitted === true && item.accessMode === record.liveBinding.accessMode && matchesIdentity(record, item);
}

function matchesDurableOutcome(record: SessionRecord, item: TerminalSessionSnapshot): boolean {
  if (item.status !== record.state) return false;
  const exit = record.lastExit;
  if (exit) return exit.exitCode === item.exitCode && exit.signal === item.signal
    && exit.timedOut === item.timedOut && exit.stopped === item.stopped;
  return !record.terminal || (record.failure && item.exitCode === null && item.signal === null);
}

function assertCanonicalIdentity(identity: WorkerSessionIdentity, redactor: StreamRedactor): void {
  if (identity.sessionId !== identity.terminalSessionId || !sessionIdPattern.test(identity.sessionId)
    || ![identity.terminalSessionId, identity.agentInstanceId, identity.contractId, identity.roleId, identity.runtimeId, identity.workspaceId].every(isIdentifier)
    || typeof identity.workspaceRoot !== "string" || !isAbsolute(identity.workspaceRoot)
    || Object.values(identity).some(value => redactor.redact(value).text !== value)) {
    throw new Error("worker_session_identity_invalid");
  }
}

function canonicalTime(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function assertTerminalEventEnvelope(event: TerminalSessionEvent): void {
  if (!isPlainRecord(event) || !hasExactKeys(event, ["sequence","occurredAt","terminalSessionId","agentInstanceId","contractId","roleId","runtimeId","workspaceId","accessMode","type","payload"])
    || !Number.isSafeInteger(event.sequence) || event.sequence < 1 || !canonicalTime(event.occurredAt)
    || !terminalEventTypes.has(event.type) || !["local","api","quota-session"].includes(event.accessMode)) {
    throw new Error("worker_session_event_invalid");
  }
}

function assertCanonicalPayload(record: SessionRecord, type: TerminalSessionEvent["type"], payload: Record<string, any>, publicPayload: boolean): void {
  const invalid = () => { throw new Error("worker_session_payload_invalid"); };
  if (!isPlainRecord(payload)) invalid();
  const keys = (expected: string[]) => { if (!hasExactKeys(payload, expected)) invalid(); };
  const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
  const clean = (value: unknown) => typeof value === "string" && record.redactor.redact(value).text === value;
  const pid = (value: unknown) => value === null || integer(value, 1);
  switch (type) {
    case "TERMINAL_SESSION_STARTED": {
      keys(["pid","backendHostPid","cwd","command","args","backend","backendImplementationId","terminalProtocol","capabilities","presentation"]);
      if (!pid(payload.pid) || !pid(payload.backendHostPid) || !sameWorkspaceRoot(record.workspaceRoot, payload.cwd)
        || typeof payload.command !== "string" || !payload.command.length
        || !Array.isArray(payload.args) || !payload.args.every((arg:unknown)=>typeof arg==="string")) invalid();
      let presentation;
      try {
        const descriptor = validateTerminalBackendDescriptor({
          kind: payload.backend, implementationId: payload.backendImplementationId, protocol: payload.terminalProtocol, capabilities: payload.capabilities,
        });
        presentation = resolveTerminalPresentation(descriptor);
      } catch { return invalid(); }
      if (!isPlainRecord(payload.presentation) || !hasExactKeys(payload.presentation,["mode","fullTerminal","missing"])
        || payload.presentation.mode !== presentation.mode || payload.presentation.fullTerminal !== presentation.fullTerminal
        || JSON.stringify(payload.presentation.missing) !== JSON.stringify(presentation.missing)
        || (payload.terminalProtocol === "separate-pipes" && payload.backendHostPid !== null)) invalid();
      if (publicPayload && (!clean(payload.command) || !payload.args.every(clean) || !clean(payload.cwd) || !clean(payload.backendImplementationId))) invalid();
      break;
    }
    case "TERMINAL_OUTPUT":
      keys(publicPayload ? ["stream","data","redactionCount"] : ["stream","data"]);
      if (!isOutputChannel(payload.stream) || typeof payload.data !== "string"
        || (record.protocol !== null && (record.protocol === "conpty-vt" ? payload.stream !== "terminal" : payload.stream === "terminal"))
        || (publicPayload && (!integer(payload.redactionCount) || !clean(payload.data)))) invalid();
      break;
    case "TERMINAL_INPUT_WRITTEN":
      keys(["bytes"]); if (!integer(payload.bytes)) invalid(); break;
    case "TERMINAL_INPUT_ENDED":
      keys([]); break;
    case "TERMINAL_RESIZED":
      keys(["columns","rows"]); if (!integer(payload.columns,1,32767) || !integer(payload.rows,1,32767) || record.protocol === "separate-pipes") invalid(); break;
    case "TERMINAL_INTERRUPT_REQUESTED":
      keys(["kind"]); if (!["ctrl-c","ctrl-break"].includes(payload.kind) || record.protocol === "separate-pipes") invalid(); break;
    case "TERMINAL_SESSION_EXITED":
      keys(["exitCode","signal","timedOut","stopped","durationMs"]);
      if (!(payload.exitCode === null || integer(payload.exitCode,-Number.MAX_SAFE_INTEGER))
        || !(payload.signal === null || (typeof payload.signal === "string" && Object.hasOwn(osConstants.signals,payload.signal)))
        || (payload.exitCode !== null && payload.signal !== null)
        || typeof payload.timedOut !== "boolean" || typeof payload.stopped !== "boolean" || !integer(payload.durationMs)) invalid();
      break;
    case "TERMINAL_SESSION_FAILED":
      keys(["error","durationMs"]);
      if (typeof payload.error !== "string" || !payload.error.length || !integer(payload.durationMs)
        || (publicPayload && payload.error !== "terminal_session_failed")) invalid();
      break;
    default: invalid();
  }
}

function transcriptRecordId(sessionId: string, sequence: number, terminalSequence: number, type: TerminalSessionEvent["type"], payload: Record<string, any>, synthetic: boolean): string {
  const stream = type === "TERMINAL_OUTPUT" ? payload.stream : "system";
  return createHash("sha256").update("morrow.worker-session-stream/transcript/v1|"+sessionId+"|"+sequence+"|"+terminalSequence+"|"+type+"|"+stream+"|"+(synthetic?"synthetic":"terminal"),"utf8").digest("hex");
}

function assertEventIdentity(record: SessionRecord, event: TerminalSessionEvent): void {
  if (event.terminalSessionId !== record.terminalSessionId || event.agentInstanceId !== record.agentInstanceId
    || event.contractId !== record.contractId || event.roleId !== record.roleId
    || event.runtimeId !== record.runtimeId || event.workspaceId !== record.workspaceId
    || event.accessMode !== record.liveBinding?.accessMode
    || (event.type === "TERMINAL_SESSION_STARTED" && !sameWorkspaceRoot(record.workspaceRoot, event.payload.cwd))) {
    throw new Error("worker_session_identity_drift");
  }
}

function assertLifecycleTransition(record: SessionRecord, type: TerminalSessionEvent["type"], payload: Record<string, any>): void {
  if (type === "TERMINAL_SESSION_STARTED" && record.started) throw new Error("worker_session_start_invalid");
  // The manager may report a real launch failure before START, or a FAILED
  // followed by the one physical EXIT. It can also accept control input while
  // starting. A failure must never be rewritten as a fabricated START.
  if (record.terminal && !(record.failure && !record.exitSeen && type === "TERMINAL_SESSION_EXITED")) {
    throw new Error("worker_session_event_after_terminal");
  }
  if (!record.started && (type === "TERMINAL_OUTPUT" || (type === "TERMINAL_SESSION_EXITED" && !record.failure && !payload.stopped && !payload.timedOut))) {
    throw new Error("worker_session_start_missing");
  }
}

function isOutputChannel(value: unknown): value is OutputChannel {
  return value === "stdout" || value === "stderr" || value === "terminal";
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

function liveActivityTransitionCount(
  state: LiveActivityEvent["transition"]["from"],
  terminalEvent: Pick<TerminalSessionEvent, "type" | "payload">,
): number {
  if (state === "done" || state === "failed") return 0;
  return terminalEventTypes.has(terminalEvent.type) ? (state === null ? 2 : 1) : 0;
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

import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rename } from "node:fs/promises";
import { isAbsolute, join, parse, relative, resolve } from "node:path";
import type {
  AuthenticatedDispatchResult,
  DispatchValidationContextProvider,
} from "./authenticated-dispatch.ts";
import {
  isControlDispatchBody,
  validateWorkerProtocolMessage,
  type ControlDispatchBody,
  type WorkerHeartbeatBody,
  type WorkerHelloBody,
  type WorkerProtocolRejectionCode,
} from "./worker-protocol.ts";

export type WorkerConnectivity = "offline" | "connecting" | "online";
export type RecoveryDispatchStatus = "queued" | "running" | "completed" | "failed" | "blocked";

export interface WorkerRecoveryAttemptRequest {
  attemptId: string;
  workerSessionId: string;
  body: ControlDispatchBody;
}

export type WorkerRecoveryAttempt = (
  request: WorkerRecoveryAttemptRequest,
) => Promise<AuthenticatedDispatchResult>;

export interface WorkerRecoveryConfiguration {
  workerId: string;
  stateRoot: string;
  validationContext: DispatchValidationContextProvider;
  attempt: WorkerRecoveryAttempt;
  clock?: () => string | number | Date;
  maxDispatchRecords?: number;
}

export interface RecoveryTerminalSummary {
  ok: boolean;
  duplicate: boolean;
  status: "completed" | "failed" | "timed_out" | null;
  exitCode: number | null;
  timedOut: boolean | null;
  rejectionCode: string | null;
}

export interface RecoveryDispatchView {
  dispatchId: string;
  idempotencyKey: string;
  contractId: string;
  stepId: string;
  targetId: string;
  kind: "process" | "agent";
  status: RecoveryDispatchStatus;
  attempts: number;
  reason: string | null;
  terminal: RecoveryTerminalSummary | null;
  updatedAt: string;
}

export interface WorkerRecoveryView {
  workerId: string;
  connectivity: WorkerConnectivity;
  workerSessionId: string | null;
  leaseExpiresAt: string | null;
  connectivityReason: string;
  lastSeenAt: string | null;
  revision: number;
  dispatches: RecoveryDispatchView[];
}

export type RecoveryAcceptanceCode =
  | "PROTOCOL_REJECTED"
  | "MESSAGE_NOT_DISPATCH"
  | "WORKER_ID_MISMATCH"
  | "IDEMPOTENCY_CONFLICT"
  | "DISPATCH_CAPACITY_EXHAUSTED"
  | "PERSISTENCE_FAILED";

export type RecoveryAcceptanceResult =
  | { ok: true; duplicate: boolean; dispatch: RecoveryDispatchView }
  | {
    ok: false;
    code: RecoveryAcceptanceCode;
    detail: string;
    protocolCode?: WorkerProtocolRejectionCode;
  };

export type RecoveryObservationCode =
  | "PROTOCOL_REJECTED"
  | "MESSAGE_NOT_WORKER_LIVENESS"
  | "WORKER_ID_MISMATCH"
  | "WORKER_SESSION_MISMATCH"
  | "HEARTBEAT_LEASE_EXPIRED"
  | "HEARTBEAT_STATE_CONFLICT"
  | "PERSISTENCE_FAILED";

export type RecoveryObservationResult =
  | { ok: true; view: WorkerRecoveryView }
  | {
    ok: false;
    code: RecoveryObservationCode;
    detail: string;
    protocolCode?: WorkerProtocolRejectionCode;
  };

interface RecoveryConnectionState {
  state: WorkerConnectivity;
  workerSessionId: string | null;
  leaseExpiresAt: string | null;
  reason: string;
  lastSeenAt: string | null;
}

interface RecoveryDispatchRecord {
  dispatchId: string;
  idempotencyKey: string;
  fingerprint: string;
  body: ControlDispatchBody;
  status: RecoveryDispatchStatus;
  attempts: number;
  attemptId: string | null;
  reason: string | null;
  terminal: RecoveryTerminalSummary | null;
  updatedAt: string;
}

interface RecoveryState {
  format: typeof recoveryFormat;
  workerId: string;
  revision: number;
  updatedAt: string;
  connection: RecoveryConnectionState;
  dispatches: RecoveryDispatchRecord[];
}

interface PersistedRecoveryState extends RecoveryState {
  checksum: string;
}

interface MutationResult<T> {
  value: T;
  changed: boolean;
}

interface ClaimedDispatch {
  dispatchId: string;
  attemptId: string;
  workerSessionId: string;
  body: ControlDispatchBody;
}

const recoveryFormat = "morrow.worker-recovery/v1" as const;
const recoveryFileName = "worker-recovery-v1.json";
const defaultMaxDispatchRecords = 512;
const absoluteMaxDispatchRecords = 4_096;
const maxRecoverySnapshotBytes = 33_554_432;
const retryableWithoutEffect = new Set([
  "WORKER_NOT_READY",
  "LOCK_UNAVAILABLE",
  "QUOTA_REJECTED",
  "BUDGET_REJECTED",
]);
const terminalExecutionFailures = new Set([
  "EXECUTION_FAILED",
  "RESOURCE_SETTLEMENT_FAILED",
  "CLEANUP_FAILED",
]);

export class WorkerRecoveryCoordinator {
  private readonly configuration: WorkerRecoveryConfiguration;
  private readonly store: AtomicWorkerRecoveryStore;
  private readonly maxDispatchRecords: number;
  private state: RecoveryState;
  private mutationTail: Promise<void> = Promise.resolve();
  private drainOperation: Promise<void> | null = null;

  private constructor(
    configuration: WorkerRecoveryConfiguration,
    store: AtomicWorkerRecoveryStore,
    state: RecoveryState,
    maxDispatchRecords: number,
  ) {
    this.configuration = configuration;
    this.store = store;
    this.state = state;
    this.maxDispatchRecords = maxDispatchRecords;
  }

  static async open(configuration: WorkerRecoveryConfiguration): Promise<WorkerRecoveryCoordinator> {
    assertConfiguration(configuration);
    const maximum = configuration.maxDispatchRecords ?? defaultMaxDispatchRecords;
    const canonicalRoot = await prepareStateRoot(configuration.stateRoot);
    const store = new AtomicWorkerRecoveryStore(join(canonicalRoot, recoveryFileName));
    const now = trustedNow(configuration.clock);
    const loaded = await store.load(configuration.workerId, maximum);
    const state = loaded ?? initialState(configuration.workerId, now);
    const coordinator = new WorkerRecoveryCoordinator(configuration, store, state, maximum);
    await coordinator.recoverAfterProcessRestart();
    return coordinator;
  }

  async accept(input: unknown): Promise<RecoveryAcceptanceResult> {
    let validation: ReturnType<typeof validateWorkerProtocolMessage>;
    try {
      validation = validateWorkerProtocolMessage(
        input,
        await this.configuration.validationContext(input),
      );
    } catch {
      return acceptanceRejected("PROTOCOL_REJECTED", "dispatch_validation_boundary_failed");
    }
    if (!validation.ok) {
      return {
        ok: false,
        code: "PROTOCOL_REJECTED",
        detail: "worker_protocol_message_rejected",
        protocolCode: validation.code,
      };
    }
    if (validation.message.messageType !== "control.dispatch") {
      return acceptanceRejected("MESSAGE_NOT_DISPATCH", "control_dispatch_required");
    }
    if (validation.message.recipient.id !== this.configuration.workerId) {
      return acceptanceRejected("WORKER_ID_MISMATCH", "dispatch_recipient_worker_mismatch");
    }

    const body = validation.message.body as ControlDispatchBody;
    const fingerprint = canonicalSha256(body);
    let accepted: RecoveryAcceptanceResult;
    try {
      accepted = await this.mutate((draft, now) => {
        const existingByKey = draft.dispatches.find((record) => record.idempotencyKey === body.idempotencyKey);
        if (existingByKey) {
          if (existingByKey.dispatchId !== body.dispatchId || existingByKey.fingerprint !== fingerprint) {
            return {
              value: acceptanceRejected("IDEMPOTENCY_CONFLICT", "idempotency_key_rebound"),
              changed: false,
            };
          }
          return { value: { ok: true, duplicate: true, dispatch: viewRecord(existingByKey) }, changed: false };
        }
        const existingByDispatch = draft.dispatches.find((record) => record.dispatchId === body.dispatchId);
        if (existingByDispatch) {
          return {
            value: acceptanceRejected("IDEMPOTENCY_CONFLICT", "dispatch_id_rebound"),
            changed: false,
          };
        }
        if (draft.dispatches.length >= this.maxDispatchRecords) {
          return {
            value: acceptanceRejected("DISPATCH_CAPACITY_EXHAUSTED", "durable_dispatch_capacity_exhausted"),
            changed: false,
          };
        }
        const record: RecoveryDispatchRecord = {
          dispatchId: body.dispatchId,
          idempotencyKey: body.idempotencyKey,
          fingerprint,
          body: structuredClone(body),
          status: "queued",
          attempts: 0,
          attemptId: null,
          reason: draft.connection.state === "online" ? null : "worker_offline",
          terminal: null,
          updatedAt: now,
        };
        draft.dispatches.push(record);
        return { value: { ok: true, duplicate: false, dispatch: viewRecord(record) }, changed: true };
      });
    } catch {
      return acceptanceRejected("PERSISTENCE_FAILED", "dispatch_checkpoint_failed");
    }

    if (accepted.ok) {
      await this.drain();
      const current = this.inspect().dispatches.find((record) => record.dispatchId === body.dispatchId);
      if (current) return { ok: true, duplicate: accepted.duplicate, dispatch: current };
    }
    return accepted;
  }

  async observe(input: unknown): Promise<RecoveryObservationResult> {
    let validation: ReturnType<typeof validateWorkerProtocolMessage>;
    try {
      validation = validateWorkerProtocolMessage(
        input,
        await this.configuration.validationContext(input),
      );
    } catch {
      return observationRejected("PROTOCOL_REJECTED", "liveness_validation_boundary_failed");
    }
    if (!validation.ok) {
      return {
        ok: false,
        code: "PROTOCOL_REJECTED",
        detail: "worker_protocol_message_rejected",
        protocolCode: validation.code,
      };
    }
    if (validation.message.messageType !== "worker.hello" && validation.message.messageType !== "worker.heartbeat") {
      return observationRejected("MESSAGE_NOT_WORKER_LIVENESS", "worker_hello_or_heartbeat_required");
    }
    if (validation.message.sender.id !== this.configuration.workerId) {
      return observationRejected("WORKER_ID_MISMATCH", "liveness_sender_worker_mismatch");
    }

    try {
      if (validation.message.messageType === "worker.hello") {
        const hello = validation.message.body as WorkerHelloBody;
        await this.mutate((draft, now) => {
          if (draft.connection.workerSessionId !== null && draft.connection.workerSessionId !== hello.workerSessionId) {
            blockRunning(draft, "worker_session_replaced_during_execution", now);
          }
          if (
            draft.connection.state === "online"
            && draft.connection.workerSessionId === hello.workerSessionId
          ) return { value: undefined, changed: false };
          draft.connection = {
            state: "connecting",
            workerSessionId: hello.workerSessionId,
            leaseExpiresAt: null,
            reason: "worker_hello_accepted",
            lastSeenAt: now,
          };
          return { value: undefined, changed: true };
        });
      } else {
        const heartbeat = validation.message.body as WorkerHeartbeatBody;
        const nowMs = trustedNowMs(this.configuration.clock);
        if (Date.parse(heartbeat.leaseExpiresAt) <= nowMs) {
          return observationRejected("HEARTBEAT_LEASE_EXPIRED", "heartbeat_lease_not_in_future");
        }
        let rejected: RecoveryObservationResult | null = null;
        await this.mutate((draft, now) => {
          if (draft.connection.workerSessionId !== heartbeat.workerSessionId) {
            rejected = observationRejected("WORKER_SESSION_MISMATCH", "heartbeat_session_not_announced");
            return { value: undefined, changed: false };
          }
          const conflicting = heartbeat.runningDispatchIds.find((dispatchId) => {
            const record = draft.dispatches.find((item) => item.dispatchId === dispatchId);
            return !record || record.status !== "running";
          });
          if (conflicting) {
            rejected = observationRejected("HEARTBEAT_STATE_CONFLICT", "heartbeat_reports_unknown_running_dispatch");
            return { value: undefined, changed: false };
          }
          draft.connection = {
            state: "online",
            workerSessionId: heartbeat.workerSessionId,
            leaseExpiresAt: heartbeat.leaseExpiresAt,
            reason: `heartbeat_${heartbeat.status}`,
            lastSeenAt: now,
          };
          return { value: undefined, changed: true };
        });
        if (rejected) return rejected;
        await this.drain();
      }
    } catch {
      return observationRejected("PERSISTENCE_FAILED", "liveness_checkpoint_failed");
    }
    return { ok: true, view: this.inspect() };
  }

  async disconnect(reason: string): Promise<WorkerRecoveryView> {
    if (!isSafeReason(reason)) throw new Error("worker_disconnect_reason_invalid");
    await this.mutate((draft, now) => {
      const changed = draft.connection.state !== "offline"
        || draft.connection.reason !== reason
        || draft.dispatches.some((record) => record.status === "running");
      blockRunning(draft, "worker_disconnected_during_execution", now);
      draft.connection = {
        state: "offline",
        workerSessionId: null,
        leaseExpiresAt: null,
        reason,
        lastSeenAt: draft.connection.lastSeenAt,
      };
      return { value: undefined, changed };
    });
    return this.inspect();
  }

  async sweepLiveness(): Promise<WorkerRecoveryView> {
    await this.mutate((draft, now) => {
      if (!connectionLeaseExpired(draft.connection, Date.parse(now))) {
        return { value: undefined, changed: false };
      }
      blockRunning(draft, "heartbeat_lease_expired_during_execution", now);
      draft.connection = {
        state: "offline",
        workerSessionId: null,
        leaseExpiresAt: null,
        reason: "heartbeat_lease_expired",
        lastSeenAt: draft.connection.lastSeenAt,
      };
      return { value: undefined, changed: true };
    });
    return this.inspect();
  }

  async drain(): Promise<void> {
    if (this.drainOperation) return await this.drainOperation;
    this.drainOperation = this.drainInternal().finally(() => {
      this.drainOperation = null;
    });
    return await this.drainOperation;
  }

  inspect(): WorkerRecoveryView {
    const nowMs = trustedNowMs(this.configuration.clock);
    const expired = connectionLeaseExpired(this.state.connection, nowMs);
    const connection: RecoveryConnectionState = expired
      ? {
          state: "offline",
          workerSessionId: null,
          leaseExpiresAt: null,
          reason: "heartbeat_lease_expired",
          lastSeenAt: this.state.connection.lastSeenAt,
        }
      : this.state.connection;
    return deepFreeze({
      workerId: this.state.workerId,
      connectivity: connection.state,
      workerSessionId: connection.workerSessionId,
      leaseExpiresAt: connection.leaseExpiresAt,
      connectivityReason: connection.reason,
      lastSeenAt: connection.lastSeenAt,
      revision: this.state.revision,
      dispatches: this.state.dispatches.map(viewRecord),
    });
  }

  private async recoverAfterProcessRestart(): Promise<void> {
    await this.mutate((draft, now) => {
      let changed = false;
      for (const record of draft.dispatches) {
        if (record.status !== "running") continue;
        record.status = "blocked";
        record.attemptId = null;
        record.reason = "execution_outcome_unknown_after_restart";
        record.terminal = null;
        record.updatedAt = now;
        changed = true;
      }
      if (draft.connection.state !== "offline") {
        draft.connection = {
          state: "offline",
          workerSessionId: null,
          leaseExpiresAt: null,
          reason: "coordinator_restarted",
          lastSeenAt: draft.connection.lastSeenAt,
        };
        changed = true;
      }
      return { value: undefined, changed };
    });
  }

  private async drainInternal(): Promise<void> {
    while (true) {
      const claimed = await this.claimNext();
      if (!claimed) return;
      let result: AuthenticatedDispatchResult;
      try {
        result = await this.configuration.attempt({
          attemptId: claimed.attemptId,
          workerSessionId: claimed.workerSessionId,
          body: structuredClone(claimed.body),
        });
      } catch {
        await this.blockUnknownAttempt(claimed, "attempt_outcome_unknown");
        return;
      }
      if (!validAttemptResult(result, claimed.dispatchId)) {
        await this.blockUnknownAttempt(claimed, "attempt_result_invalid");
        return;
      }
      const keepDraining = await this.settleAttempt(claimed, result);
      if (!keepDraining) return;
    }
  }

  private async claimNext(): Promise<ClaimedDispatch | null> {
    return await this.mutate((draft, now) => {
      let changed = false;
      if (connectionLeaseExpired(draft.connection, Date.parse(now))) {
        blockRunning(draft, "heartbeat_lease_expired_during_execution", now);
        draft.connection = {
          state: "offline",
          workerSessionId: null,
          leaseExpiresAt: null,
          reason: "heartbeat_lease_expired",
          lastSeenAt: draft.connection.lastSeenAt,
        };
        changed = true;
      }
      if (draft.connection.state !== "online" || draft.connection.workerSessionId === null) {
        return { value: null, changed };
      }
      const record = draft.dispatches.find((item) => item.status === "queued");
      if (!record) return { value: null, changed };
      const attemptId = randomUUID();
      record.status = "running";
      record.attempts += 1;
      record.attemptId = attemptId;
      record.reason = null;
      record.terminal = null;
      record.updatedAt = now;
      return {
        value: {
          dispatchId: record.dispatchId,
          attemptId,
          workerSessionId: draft.connection.workerSessionId,
          body: structuredClone(record.body),
        },
        changed: true,
      };
    });
  }

  private async settleAttempt(
    claimed: ClaimedDispatch,
    result: AuthenticatedDispatchResult,
  ): Promise<boolean> {
    return await this.mutate((draft, now) => {
      const record = draft.dispatches.find((item) => item.dispatchId === claimed.dispatchId);
      if (!record || record.status !== "running" || record.attemptId !== claimed.attemptId) {
        return { value: false, changed: false };
      }
      record.attemptId = null;
      record.updatedAt = now;
      if (result.ok) {
        record.status = "completed";
        record.reason = null;
        record.terminal = summarize(result);
        return { value: true, changed: true };
      }
      if (retryableWithoutEffect.has(result.code)) {
        record.status = "queued";
        record.reason = `waiting:${result.code.toLowerCase()}`;
        record.terminal = null;
        if (result.code === "WORKER_NOT_READY") {
          draft.connection = {
            state: "offline",
            workerSessionId: null,
            leaseExpiresAt: null,
            reason: "worker_refused_not_ready",
            lastSeenAt: draft.connection.lastSeenAt,
          };
        }
        return { value: false, changed: true };
      }
      record.status = terminalExecutionFailures.has(result.code) ? "failed" : "blocked";
      record.reason = `dispatch_rejected:${result.code.toLowerCase()}`;
      record.terminal = summarize(result);
      return { value: true, changed: true };
    });
  }

  private async blockUnknownAttempt(claimed: ClaimedDispatch, reason: string): Promise<void> {
    await this.mutate((draft, now) => {
      const record = draft.dispatches.find((item) => item.dispatchId === claimed.dispatchId);
      if (!record || record.status !== "running" || record.attemptId !== claimed.attemptId) {
        return { value: undefined, changed: false };
      }
      record.status = "blocked";
      record.attemptId = null;
      record.reason = reason;
      record.terminal = null;
      record.updatedAt = now;
      draft.connection = {
        state: "offline",
        workerSessionId: null,
        leaseExpiresAt: null,
        reason: "attempt_transport_outcome_unknown",
        lastSeenAt: draft.connection.lastSeenAt,
      };
      return { value: undefined, changed: true };
    });
  }

  private async mutate<T>(
    operation: (draft: RecoveryState, now: string) => MutationResult<T>,
  ): Promise<T> {
    return await this.exclusive(async () => {
      const draft = structuredClone(this.state);
      const now = trustedNow(this.configuration.clock);
      const mutation = operation(draft, now);
      if (mutation.changed) {
        draft.revision += 1;
        draft.updatedAt = now;
        await this.store.save(draft);
        this.state = draft;
      }
      return mutation.value;
    });
  }

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const queued = this.mutationTail.then(operation, operation);
    this.mutationTail = queued.then(() => undefined, () => undefined);
    return await queued;
  }
}

class AtomicWorkerRecoveryStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(workerId: string, maximum: number): Promise<RecoveryState | null> {
    let raw: string;
    try {
      const entry = await lstat(this.filePath);
      if (entry.isSymbolicLink() || !entry.isFile()) throw new Error("worker_recovery_snapshot_file_invalid");
      raw = await readFile(this.filePath, "utf8");
    } catch (error) {
      if (isNotFound(error)) return null;
      throw sanitizeStoreError(error, "worker_recovery_snapshot_read_failed");
    }
    if (Buffer.byteLength(raw, "utf8") > maxRecoverySnapshotBytes) {
      throw new Error("worker_recovery_snapshot_too_large");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("worker_recovery_snapshot_invalid_json");
    }
    if (!validPersistedState(parsed, workerId, maximum)) {
      throw new Error("worker_recovery_snapshot_invalid");
    }
    const { checksum: _checksum, ...state } = parsed;
    return state;
  }

  async save(state: RecoveryState): Promise<void> {
    const checksum = canonicalSha256(state);
    const serialized = `${JSON.stringify({ ...state, checksum })}\n`;
    if (Buffer.byteLength(serialized, "utf8") > maxRecoverySnapshotBytes) {
      throw new Error("worker_recovery_snapshot_too_large");
    }
    const temp = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    let handle: Awaited<ReturnType<typeof open>> | null = null;
    try {
      try {
        const existing = await lstat(this.filePath);
        if (existing.isSymbolicLink() || !existing.isFile()) {
          throw new Error("worker_recovery_snapshot_file_invalid");
        }
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
      handle = await open(temp, "wx", 0o600);
      await handle.writeFile(serialized, "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      await rename(temp, this.filePath);
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined);
      throw sanitizeStoreError(error, "worker_recovery_snapshot_write_failed");
    }
  }
}

function initialState(workerId: string, now: string): RecoveryState {
  return {
    format: recoveryFormat,
    workerId,
    revision: 0,
    updatedAt: now,
    connection: {
      state: "offline",
      workerSessionId: null,
      leaseExpiresAt: null,
      reason: "not_connected",
      lastSeenAt: null,
    },
    dispatches: [],
  };
}

function viewRecord(record: RecoveryDispatchRecord): RecoveryDispatchView {
  return deepFreeze({
    dispatchId: record.dispatchId,
    idempotencyKey: record.idempotencyKey,
    contractId: record.body.contractId,
    stepId: record.body.stepId,
    targetId: record.body.targetId,
    kind: record.body.kind,
    status: record.status,
    attempts: record.attempts,
    reason: record.reason,
    terminal: record.terminal ? { ...record.terminal } : null,
    updatedAt: record.updatedAt,
  });
}

function summarize(result: AuthenticatedDispatchResult): RecoveryTerminalSummary {
  if (!result.ok) {
    return {
      ok: false,
      duplicate: result.duplicate,
      status: null,
      exitCode: null,
      timedOut: null,
      rejectionCode: result.code,
    };
  }
  return {
    ok: true,
    duplicate: result.duplicate,
    status: result.execution.status,
    exitCode: result.execution.exitCode,
    timedOut: result.execution.timedOut,
    rejectionCode: null,
  };
}

function blockRunning(state: RecoveryState, reason: string, now: string): void {
  for (const record of state.dispatches) {
    if (record.status !== "running") continue;
    record.status = "blocked";
    record.attemptId = null;
    record.reason = reason;
    record.terminal = null;
    record.updatedAt = now;
  }
}

function connectionLeaseExpired(connection: RecoveryConnectionState, nowMs: number): boolean {
  return connection.state === "online"
    && connection.leaseExpiresAt !== null
    && Date.parse(connection.leaseExpiresAt) <= nowMs;
}

function validAttemptResult(value: unknown, dispatchId: string): value is AuthenticatedDispatchResult {
  if (!isDataRecord(value) || typeof value.ok !== "boolean" || typeof value.duplicate !== "boolean") return false;
  if (value.ok === false) {
    if (!onlyKeys(value, ["ok", "duplicate", "code", "detail", "protocolCode"])) return false;
    return isSafeReason(value.code) && isSafeText(value.detail, 1_024)
      && (value.protocolCode === undefined || isSafeReason(value.protocolCode));
  }
  if (exactKeys(value, ["ok", "duplicate", "execution"]) !== null || !isDataRecord(value.execution)) return false;
  const execution = value.execution;
  return execution.dispatchId === dispatchId
    && isSafeReason(execution.idempotencyKey)
    && (execution.status === "completed" || execution.status === "failed" || execution.status === "timed_out")
    && (execution.exitCode === null || nonNegativeSafeInteger(execution.exitCode))
    && typeof execution.timedOut === "boolean";
}

function validPersistedState(value: unknown, workerId: string, maximum: number): value is PersistedRecoveryState {
  if (!isDataRecord(value) || exactKeys(value, [
    "format", "workerId", "revision", "updatedAt", "connection", "dispatches", "checksum",
  ]) !== null) return false;
  if (value.format !== recoveryFormat || value.workerId !== workerId || !isIdentifier(value.workerId)) return false;
  if (!nonNegativeSafeInteger(value.revision) || !isTimestamp(value.updatedAt) || !isSha256(value.checksum)) return false;
  if (!validConnection(value.connection)) return false;
  if (!Array.isArray(value.dispatches) || value.dispatches.length > maximum) return false;
  if (!value.dispatches.every(validDispatchRecord)) return false;
  const dispatchIds = value.dispatches.map((record) => record.dispatchId);
  const idempotencyKeys = value.dispatches.map((record) => record.idempotencyKey);
  if (new Set(dispatchIds).size !== dispatchIds.length || new Set(idempotencyKeys).size !== idempotencyKeys.length) return false;
  const { checksum, ...state } = value;
  return canonicalSha256(state) === checksum;
}

function validConnection(value: unknown): value is RecoveryConnectionState {
  if (!isDataRecord(value) || exactKeys(value, [
    "state", "workerSessionId", "leaseExpiresAt", "reason", "lastSeenAt",
  ]) !== null) return false;
  if (value.state !== "offline" && value.state !== "connecting" && value.state !== "online") return false;
  if (!isSafeReason(value.reason) || (value.lastSeenAt !== null && !isTimestamp(value.lastSeenAt))) return false;
  if (value.state === "offline") return value.workerSessionId === null && value.leaseExpiresAt === null;
  if (!isIdentifier(value.workerSessionId)) return false;
  return value.state === "connecting"
    ? value.leaseExpiresAt === null
    : isTimestamp(value.leaseExpiresAt);
}

function validDispatchRecord(value: unknown): value is RecoveryDispatchRecord {
  if (!isDataRecord(value) || exactKeys(value, [
    "dispatchId", "idempotencyKey", "fingerprint", "body", "status", "attempts",
    "attemptId", "reason", "terminal", "updatedAt",
  ]) !== null) return false;
  if (!isIdentifier(value.dispatchId) || !isIdentifier(value.idempotencyKey) || !isSha256(value.fingerprint)) return false;
  if (!isControlDispatchBody(value.body)) return false;
  if (value.dispatchId !== value.body.dispatchId || value.idempotencyKey !== value.body.idempotencyKey) return false;
  if (canonicalSha256(value.body) !== value.fingerprint) return false;
  if (!(["queued", "running", "completed", "failed", "blocked"] as unknown[]).includes(value.status)) return false;
  if (!nonNegativeSafeInteger(value.attempts) || value.attempts > 1_000_000 || !isTimestamp(value.updatedAt)) return false;
  if (value.reason !== null && !isSafeReason(value.reason)) return false;
  if (value.terminal !== null && !validTerminalSummary(value.terminal)) return false;
  if (value.status === "running") return isIdentifier(value.attemptId) && value.terminal === null;
  if (value.attemptId !== null) return false;
  if (value.status === "completed") return value.terminal?.ok === true;
  if (value.status === "failed") return value.terminal?.ok === false;
  return value.terminal === null || value.status === "blocked";
}

function validTerminalSummary(value: unknown): value is RecoveryTerminalSummary {
  if (!isDataRecord(value) || exactKeys(value, [
    "ok", "duplicate", "status", "exitCode", "timedOut", "rejectionCode",
  ]) !== null) return false;
  if (typeof value.ok !== "boolean" || typeof value.duplicate !== "boolean") return false;
  if (value.ok) {
    return (value.status === "completed" || value.status === "failed" || value.status === "timed_out")
      && (value.exitCode === null || nonNegativeSafeInteger(value.exitCode))
      && typeof value.timedOut === "boolean"
      && value.rejectionCode === null;
  }
  return value.status === null
    && value.exitCode === null
    && value.timedOut === null
    && isSafeReason(value.rejectionCode);
}

function assertConfiguration(configuration: WorkerRecoveryConfiguration): void {
  if (!isDataRecord(configuration)) throw new Error("worker_recovery_configuration_invalid");
  if (!onlyKeys(configuration, ["workerId", "stateRoot", "validationContext", "attempt", "clock", "maxDispatchRecords"])) {
    throw new Error("worker_recovery_configuration_unknown_field");
  }
  if (!isIdentifier(configuration.workerId)) throw new Error("worker_recovery_worker_id_invalid");
  if (typeof configuration.stateRoot !== "string" || !isAbsolute(configuration.stateRoot)) {
    throw new Error("worker_recovery_state_root_invalid");
  }
  if (!containsMorrowSegment(resolve(configuration.stateRoot))) {
    throw new Error("worker_recovery_state_root_requires_morrow_segment");
  }
  if (typeof configuration.validationContext !== "function" || typeof configuration.attempt !== "function") {
    throw new Error("worker_recovery_dependencies_invalid");
  }
  if (configuration.clock !== undefined && typeof configuration.clock !== "function") {
    throw new Error("worker_recovery_clock_invalid");
  }
  const maximum = configuration.maxDispatchRecords ?? defaultMaxDispatchRecords;
  if (!positiveSafeInteger(maximum) || maximum > absoluteMaxDispatchRecords) {
    throw new Error("worker_recovery_capacity_invalid");
  }
}

async function prepareStateRoot(requestedRoot: string): Promise<string> {
  const root = resolve(requestedRoot);
  await assertNoSymbolicLinkAncestors(root);
  await mkdir(root, { recursive: true });
  const entry = await lstat(root);
  if (entry.isSymbolicLink() || !entry.isDirectory()) throw new Error("worker_recovery_state_root_invalid");
  const canonical = await realpath(root);
  if (!containsMorrowSegment(canonical)) throw new Error("worker_recovery_state_root_requires_morrow_segment");
  return canonical;
}

async function assertNoSymbolicLinkAncestors(path: string): Promise<void> {
  const root = parse(path).root;
  const segments = relative(root, path).split(/[\\/]+/).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = join(current, segment);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) throw new Error("worker_recovery_symbolic_ancestor_refused");
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }
  }
}

function trustedNow(clock: WorkerRecoveryConfiguration["clock"]): string {
  const value = clock ? clock() : new Date();
  const milliseconds = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error("worker_recovery_clock_invalid");
  return new Date(milliseconds).toISOString();
}

function trustedNowMs(clock: WorkerRecoveryConfiguration["clock"]): number {
  return Date.parse(trustedNow(clock));
}

function acceptanceRejected(code: RecoveryAcceptanceCode, detail: string): RecoveryAcceptanceResult {
  return deepFreeze({ ok: false, code, detail });
}

function observationRejected(code: RecoveryObservationCode, detail: string): RecoveryObservationResult {
  return deepFreeze({ ok: false, code, detail });
}

function canonicalSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value)), "utf8").digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) output[key] = canonicalize((value as Record<string, unknown>)[key]);
    return output;
  }
  return value;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): string | null {
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string")) return "keys_invalid";
  if (actual.length !== expected.length || expected.some((key) => !Object.hasOwn(value, key))) return "keys_invalid";
  return null;
}

function onlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Reflect.ownKeys(value).every((key) => typeof key === "string" && expected.includes(key));
}

function isDataRecord(value: unknown): value is Record<string, any> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== "string") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && descriptor.enumerable === true && "value" in descriptor;
  });
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value);
}

function isSafeReason(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 512
    && /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value);
}

function isSafeText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= maximum && !value.includes("\0");
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function positiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function containsMorrowSegment(path: string): boolean {
  return path.split(/[\\/]+/).some((segment) => segment.toLowerCase() === ".morrow");
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function sanitizeStoreError(error: unknown, fallback: string): Error {
  if (error instanceof Error && error.message.startsWith("worker_recovery_")) return error;
  return new Error(fallback);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

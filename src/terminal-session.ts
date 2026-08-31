import { realpath, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { RuntimeAccessMode, RuntimeInvocation, RuntimeResult } from "./runtime-adapter.ts";
import {
  ProcessPipesTerminalBackend,
  resolveTerminalPresentation,
  validateTerminalBackendDescriptor,
  type TerminalBackend,
  type TerminalBackendDescriptor,
  type TerminalBackendSession,
  type TerminalCapabilities,
  type TerminalInterrupt,
  type TerminalPresentation,
  type TerminalProtocol,
} from "./terminal-backend.ts";

const PROVEN_WINDOWS_CONPTY_MAX_CONCURRENT_SESSIONS = 2;

export type {
  TerminalBackend,
  TerminalBackendDescriptor,
  TerminalBackendKind,
  TerminalCapabilities,
  TerminalInterrupt,
  TerminalPresentation,
  TerminalPresentationMode,
  TerminalProtocol,
} from "./terminal-backend.ts";
export type TerminalSessionStatus =
  | "starting"
  | "running"
  | "completed"
  | "failed"
  | "timed_out"
  | "stopped";

export interface AgentWorkspaceBinding {
  workspaceId: string;
  contractId: string;
  roleId: string;
  root: string;
}

export interface TerminalSessionRequest {
  terminalSessionId: string;
  agentInstanceId: string;
  contractId: string;
  roleId: string;
  runtimeId: string;
  accessMode: RuntimeAccessMode;
  workspaceId: string;
  workspace: AgentWorkspaceBinding;
  command: string;
  args: string[];
  sensitiveArgIndexes?: number[];
  env?: Record<string, string>;
  timeoutMs?: number;
}

interface TerminalEventBase {
  sequence: number;
  occurredAt: string;
  terminalSessionId: string;
  agentInstanceId: string;
  contractId: string;
  roleId: string;
  runtimeId: string;
  accessMode: RuntimeAccessMode;
  workspaceId: string;
}

export type TerminalSessionEvent =
  | (TerminalEventBase & {
      type: "TERMINAL_SESSION_STARTED";
      payload: {
        pid: number | null;
        cwd: string;
        command: string;
        args: string[];
        backend: TerminalBackendDescriptor["kind"];
        backendImplementationId: string;
        terminalProtocol: TerminalProtocol;
        capabilities: TerminalCapabilities;
        presentation: TerminalPresentation;
      };
    })
  | (TerminalEventBase & {
      type: "TERMINAL_OUTPUT";
      payload: { stream: "stdout" | "stderr" | "terminal"; data: string };
    })
  | (TerminalEventBase & {
      type: "TERMINAL_INPUT_WRITTEN";
      payload: { bytes: number };
    })
  | (TerminalEventBase & {
      type: "TERMINAL_INPUT_ENDED";
      payload: Record<string, never>;
    })
  | (TerminalEventBase & {
      type: "TERMINAL_RESIZED";
      payload: { columns: number; rows: number };
    })
  | (TerminalEventBase & {
      type: "TERMINAL_INTERRUPT_REQUESTED";
      payload: { kind: TerminalInterrupt };
    })
  | (TerminalEventBase & {
      type: "TERMINAL_SESSION_EXITED";
      payload: {
        exitCode: number | null;
        signal: NodeJS.Signals | null;
        timedOut: boolean;
        stopped: boolean;
        durationMs: number;
      };
    })
  | (TerminalEventBase & {
      type: "TERMINAL_SESSION_FAILED";
      payload: { error: string; durationMs: number };
    });

export interface TerminalSessionSnapshot {
  terminalSessionId: string;
  agentInstanceId: string;
  contractId: string;
  roleId: string;
  runtimeId: string;
  accessMode: RuntimeAccessMode;
  workspaceId: string;
  workspaceRoot: string;
  backend: TerminalBackendDescriptor["kind"];
  backendImplementationId: string;
  terminalProtocol: TerminalProtocol;
  capabilities: TerminalCapabilities;
  presentation: TerminalPresentation;
  status: TerminalSessionStatus;
  pid: number | null;
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stopped: boolean;
  historyTruncated: boolean;
}

export interface TerminalSessionResult extends TerminalSessionSnapshot {
  durationMs: number;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface TerminalSessionHandle {
  terminalSessionId: string;
  completion: Promise<TerminalSessionResult>;
}

export interface ManagedTerminalInvocation extends Omit<RuntimeInvocation, "cwd"> {
  terminalSessionId: string;
  agentInstanceId: string;
  contractId: string;
  roleId: string;
  workspaceId: string;
  workspace: AgentWorkspaceBinding;
  sensitiveArgIndexes?: number[];
}

export interface ManagedTerminalResult extends RuntimeResult {
  terminalSessionId: string;
  agentInstanceId: string;
  contractId: string;
  roleId: string;
  workspaceId: string;
}

export type TerminalEventListener = (event: TerminalSessionEvent) => void;

interface SessionRecord {
  request: TerminalSessionRequest;
  workspaceRoot: string;
  backendSession: TerminalBackendSession;
  backendDescriptor: TerminalBackendDescriptor;
  status: TerminalSessionStatus;
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stopped: boolean;
  settled: boolean;
  historyTruncated: boolean;
  events: TerminalSessionEvent[];
  stdout: string;
  stderr: string;
  error?: string;
  timer: NodeJS.Timeout | null;
  resolveCompletion: (result: TerminalSessionResult) => void;
  completion: Promise<TerminalSessionResult>;
}

export class TerminalSessionManager {
  private readonly managedWorkspaceRoot: string;
  private readonly maxEventsPerSession: number;
  private readonly maxConcurrentSessions: number;
  private readonly backend: TerminalBackend;
  private readonly backendDescriptor: TerminalBackendDescriptor;
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly activeAgentInstances = new Map<string, string>();
  private readonly activeWorkspaceRoots = new Map<string, string>();
  private readonly listeners = new Set<TerminalEventListener>();
  private sequence = 0;

  constructor(
    managedWorkspaceRoot: string,
    options: {
      maxEventsPerSession?: number;
      maxConcurrentSessions?: number;
      backend?: TerminalBackend;
    } = {},
  ) {
    this.managedWorkspaceRoot = resolve(managedWorkspaceRoot);
    this.backend = options.backend ?? new ProcessPipesTerminalBackend();
    this.backendDescriptor = validateTerminalBackendDescriptor(this.backend.descriptor);
    this.maxEventsPerSession = options.maxEventsPerSession ?? 5_000;
    this.maxConcurrentSessions = options.maxConcurrentSessions
      ?? (this.backendDescriptor.kind === "windows-conpty"
        ? PROVEN_WINDOWS_CONPTY_MAX_CONCURRENT_SESSIONS
        : Number.MAX_SAFE_INTEGER);
    if (!Number.isInteger(this.maxEventsPerSession) || this.maxEventsPerSession <= 0) {
      throw new Error("max_events_per_session_must_be_positive");
    }
    if (!Number.isInteger(this.maxConcurrentSessions) || this.maxConcurrentSessions <= 0) {
      throw new Error("max_concurrent_sessions_must_be_positive");
    }
    if (
      this.backendDescriptor.kind === "windows-conpty"
      && this.maxConcurrentSessions > PROVEN_WINDOWS_CONPTY_MAX_CONCURRENT_SESSIONS
    ) {
      throw new Error("windows_conpty_max_concurrent_sessions_exceeded");
    }
  }

  subscribe(listener: TerminalEventListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  descriptor(): TerminalBackendDescriptor {
    return this.backendDescriptor;
  }

  async start(request: TerminalSessionRequest): Promise<TerminalSessionHandle> {
    this.assertIdentity(request);
    request = detachTerminalSessionRequest(request);
    if (this.sessions.has(request.terminalSessionId)) {
      throw new Error("terminal_session_id_already_exists");
    }
    if (this.activeAgentInstances.has(request.agentInstanceId)) {
      throw new Error("agent_instance_already_has_active_terminal");
    }

    const workspaceRoot = await this.resolveManagedWorkspace(request);
    // Filesystem validation yields. Recheck logical identities after it so two
    // concurrent starts cannot both cross the pre-await collision gate.
    if (this.sessions.has(request.terminalSessionId)) {
      throw new Error("terminal_session_id_already_exists");
    }
    if (this.activeAgentInstances.has(request.agentInstanceId)) {
      throw new Error("agent_instance_already_has_active_terminal");
    }
    if (this.activeWorkspaceRoots.has(workspaceRoot)) {
      throw new Error("workspace_already_in_use");
    }
    if (this.activeAgentInstances.size >= this.maxConcurrentSessions) {
      throw new Error("terminal_session_capacity_exhausted");
    }

    let resolveCompletion!: (result: TerminalSessionResult) => void;
    const completion = new Promise<TerminalSessionResult>((resolvePromise) => {
      resolveCompletion = resolvePromise;
    });

    const backendSession = this.backend.create({
      command: request.command,
      args: [...request.args],
      cwd: workspaceRoot,
      // A managed terminal must not inherit the operator process environment
      // implicitly. Runtimes receive only the environment resolved by the
      // governed dispatch; an omitted environment is intentionally empty.
      env: request.env ? { ...request.env } : {},
    });
    let actualDescriptor: TerminalBackendDescriptor;
    try {
      actualDescriptor = validateTerminalBackendDescriptor(backendSession.descriptor);
    } catch {
      try {
        backendSession.stop(true);
      } catch {
        // The invalid descriptor remains the authoritative refusal.
      }
      throw new Error("terminal_backend_session_descriptor_invalid");
    }
    if (
      actualDescriptor.kind !== this.backendDescriptor.kind
      || actualDescriptor.implementationId !== this.backendDescriptor.implementationId
      || actualDescriptor.protocol !== this.backendDescriptor.protocol
      || !sameTerminalCapabilities(
        actualDescriptor.capabilities,
        this.backendDescriptor.capabilities,
      )
    ) {
      try {
        backendSession.stop(true);
      } catch {
        // The descriptor mismatch remains the authoritative refusal.
      }
      throw new Error("terminal_backend_descriptor_changed_for_session");
    }

    const record: SessionRecord = {
      request,
      workspaceRoot,
      backendSession,
      backendDescriptor: actualDescriptor,
      status: "starting",
      startedAt: new Date().toISOString(),
      endedAt: null,
      exitCode: null,
      signal: null,
      timedOut: false,
      stopped: false,
      settled: false,
      historyTruncated: false,
      events: [],
      stdout: "",
      stderr: "",
      timer: null,
      resolveCompletion,
      completion,
    };

    this.sessions.set(request.terminalSessionId, record);
    this.activeAgentInstances.set(request.agentInstanceId, request.terminalSessionId);
    this.activeWorkspaceRoots.set(workspaceRoot, request.terminalSessionId);
    try {
      this.attach(record);
      backendSession.start();
    } catch {
      this.failAndStop(record, "terminal_backend_start_failed");
    }

    return { terminalSessionId: request.terminalSessionId, completion };
  }

  list(): TerminalSessionSnapshot[] {
    return [...this.sessions.values()].map((record) => this.snapshotRecord(record));
  }

  snapshot(terminalSessionId: string): TerminalSessionSnapshot {
    return this.snapshotRecord(this.requireSession(terminalSessionId));
  }

  history(terminalSessionId: string): TerminalSessionEvent[] {
    return [...this.requireSession(terminalSessionId).events];
  }

  wait(terminalSessionId: string): Promise<TerminalSessionResult> {
    return this.requireSession(terminalSessionId).completion;
  }

  async write(terminalSessionId: string, data: string): Promise<void> {
    const record = this.requireWritableSession(terminalSessionId);
    const accepted = record.backendSession.write(data);
    this.emit(record, "TERMINAL_INPUT_WRITTEN", { bytes: Buffer.byteLength(data, "utf8") });
    if (!accepted) await record.backendSession.waitForDrain();
  }

  endInput(terminalSessionId: string): void {
    const record = this.requireWritableSession(terminalSessionId);
    record.backendSession.endInput();
    this.emit(record, "TERMINAL_INPUT_ENDED", {});
  }

  resize(terminalSessionId: string, columns: number, rows: number): void {
    const record = this.requireSession(terminalSessionId);
    if (!this.isActive(record)) throw new Error("terminal_session_not_active");
    if (
      !Number.isInteger(columns)
      || !Number.isInteger(rows)
      || columns <= 0
      || rows <= 0
      || columns > 32_767
      || rows > 32_767
    ) {
      throw new Error("terminal_dimensions_invalid");
    }
    if (!record.backendDescriptor.capabilities.resize) {
      throw new Error("terminal_resize_not_supported");
    }
    record.backendSession.resize(columns, rows);
    this.emit(record, "TERMINAL_RESIZED", { columns, rows });
  }

  interrupt(terminalSessionId: string, kind: TerminalInterrupt): void {
    const record = this.requireSession(terminalSessionId);
    if (!this.isActive(record)) throw new Error("terminal_session_not_active");
    if (kind !== "ctrl-c" && kind !== "ctrl-break") {
      throw new Error("terminal_interrupt_kind_invalid");
    }
    if (!record.backendDescriptor.capabilities.signals) {
      throw new Error("terminal_interrupt_not_supported");
    }
    record.backendSession.interrupt(kind);
    this.emit(record, "TERMINAL_INTERRUPT_REQUESTED", { kind });
  }

  stop(terminalSessionId: string): boolean {
    const record = this.requireSession(terminalSessionId);
    if (!this.isActive(record)) return false;
    record.stopped = true;
    return record.backendSession.stop(false);
  }

  private attach(record: SessionRecord): void {
    const { backendSession, request } = record;

    backendSession.onStarted(() => {
      if (record.status !== "starting") {
        this.failAndStop(record, "terminal_backend_duplicate_start");
        return;
      }
      record.status = "running";
      record.startedAt = new Date().toISOString();
      this.emit(record, "TERMINAL_SESSION_STARTED", {
        pid: backendSession.pid,
        cwd: record.workspaceRoot,
        command: request.command,
        args: redactSensitiveArgs(request.args, request.sensitiveArgIndexes),
        backend: record.backendDescriptor.kind,
        backendImplementationId: record.backendDescriptor.implementationId,
        terminalProtocol: record.backendDescriptor.protocol,
        capabilities: record.backendDescriptor.capabilities,
        presentation: resolveTerminalPresentation(record.backendDescriptor),
      });

      if (request.timeoutMs !== undefined) {
        record.timer = setTimeout(() => {
          record.timedOut = true;
          backendSession.stop(true);
        }, request.timeoutMs);
      }
    });

    backendSession.onOutput((stream, chunk) => {
      if (!isTerminalOutputAllowed(record.backendDescriptor, stream) || typeof chunk !== "string") {
        this.failAndStop(record, "terminal_backend_output_protocol_violation");
        return;
      }
      if (stream === "stderr") record.stderr += chunk;
      else record.stdout += chunk;
      this.emit(record, "TERMINAL_OUTPUT", { stream, data: chunk });
    });

    backendSession.onError((error) => {
      this.failAndStop(
        record,
        error instanceof Error ? error.message : "terminal_backend_error",
      );
    });

    backendSession.onExit(({ exitCode, signal }) => {
      if (record.settled) return;
      if (record.status === "starting" && !record.stopped && !record.timedOut) {
        this.fail(record, "terminal_backend_exit_before_start");
        return;
      }
      record.exitCode = exitCode;
      record.signal = signal;
      record.endedAt = new Date().toISOString();
      record.status = record.error
        ? "failed"
        : record.timedOut
          ? "timed_out"
          : record.stopped
            ? "stopped"
            : exitCode === 0
              ? "completed"
              : "failed";
      this.emit(record, "TERMINAL_SESSION_EXITED", {
        exitCode,
        signal,
        timedOut: record.timedOut,
        stopped: record.stopped,
        durationMs: this.duration(record),
      });
      this.settle(record);
    });
  }

  private async resolveManagedWorkspace(request: TerminalSessionRequest): Promise<string> {
    const { workspace } = request;
    if (
      workspace.workspaceId !== request.workspaceId ||
      workspace.contractId !== request.contractId ||
      workspace.roleId !== request.roleId
    ) {
      throw new Error("terminal_workspace_binding_mismatch");
    }

    const managedRoot = await realpath(this.managedWorkspaceRoot);
    const expectedRoot = resolve(managedRoot, request.contractId, workspace.workspaceId);
    const workspaceRoot = await realpath(workspace.root);
    const workspaceStat = await stat(workspaceRoot);
    if (!workspaceStat.isDirectory()) throw new Error("terminal_workspace_not_directory");

    const rel = relative(managedRoot, workspaceRoot);
    if (
      rel === "" ||
      rel.startsWith("..") ||
      resolve(managedRoot, rel) !== workspaceRoot ||
      !samePath(expectedRoot, workspaceRoot)
    ) {
      throw new Error("terminal_workspace_outside_managed_root");
    }

    return workspaceRoot;
  }

  private assertIdentity(request: TerminalSessionRequest): void {
    for (const [label, value] of [
      ["terminal_session_id", request.terminalSessionId],
      ["agent_instance_id", request.agentInstanceId],
      ["contract_id", request.contractId],
      ["role_id", request.roleId],
      ["runtime_id", request.runtimeId],
      ["workspace_id", request.workspaceId],
    ] as const) {
      if (!value || value === "." || value === ".." || value.includes("/") || value.includes("\\") || value.includes("\0")) {
        throw new Error(`invalid_${label}`);
      }
    }
    if (!request.command) throw new Error("terminal_command_required");
    validateSensitiveArgIndexes(request.args, request.sensitiveArgIndexes);
    if (request.timeoutMs !== undefined && request.timeoutMs <= 0) {
      throw new Error("terminal_timeout_must_be_positive");
    }
  }

  private requireSession(terminalSessionId: string): SessionRecord {
    const record = this.sessions.get(terminalSessionId);
    if (!record) throw new Error("terminal_session_not_found");
    return record;
  }

  private requireWritableSession(terminalSessionId: string): SessionRecord {
    const record = this.requireSession(terminalSessionId);
    if (!this.isActive(record) || record.backendSession.inputClosed) {
      throw new Error("terminal_input_closed");
    }
    return record;
  }

  private isActive(record: SessionRecord): boolean {
    return record.status === "starting" || record.status === "running";
  }

  private emit(record: SessionRecord, type: TerminalSessionEvent["type"], payload: unknown): void {
    const event = {
      sequence: ++this.sequence,
      occurredAt: new Date().toISOString(),
      terminalSessionId: record.request.terminalSessionId,
      agentInstanceId: record.request.agentInstanceId,
      contractId: record.request.contractId,
      roleId: record.request.roleId,
      runtimeId: record.request.runtimeId,
      accessMode: record.request.accessMode,
      workspaceId: record.request.workspace.workspaceId,
      type,
      payload,
    } as TerminalSessionEvent;

    record.events.push(event);
    if (record.events.length > this.maxEventsPerSession) {
      record.events.shift();
      record.historyTruncated = true;
    }

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Observability consumers cannot interrupt the managed process.
      }
    }
  }

  private settle(record: SessionRecord): void {
    if (record.settled) return;
    record.settled = true;
    if (record.timer) clearTimeout(record.timer);
    this.activeAgentInstances.delete(record.request.agentInstanceId);
    this.activeWorkspaceRoots.delete(record.workspaceRoot);
    record.resolveCompletion({
      ...this.snapshotRecord(record),
      durationMs: this.duration(record),
      stdout: record.stdout,
      stderr: record.stderr,
      error: record.error,
    });
  }

  private fail(record: SessionRecord, error: string): void {
    if (record.settled) return;
    this.markFailed(record, error);
    this.settle(record);
  }

  private markFailed(record: SessionRecord, error: string): void {
    if (record.settled || record.error) return;
    record.error = error;
    record.status = "failed";
    record.endedAt = new Date().toISOString();
    this.emit(record, "TERMINAL_SESSION_FAILED", {
      error,
      durationMs: this.duration(record),
    });
  }

  private failAndStop(record: SessionRecord, error: string): void {
    this.markFailed(record, error);
    let stopAccepted = false;
    try {
      stopAccepted = record.backendSession.stop(true);
    } catch {
      // The protocol violation remains the authoritative failure.
    }
    if (!stopAccepted && !record.settled) this.settle(record);
  }

  private snapshotRecord(record: SessionRecord): TerminalSessionSnapshot {
    return {
      terminalSessionId: record.request.terminalSessionId,
      agentInstanceId: record.request.agentInstanceId,
      contractId: record.request.contractId,
      roleId: record.request.roleId,
      runtimeId: record.request.runtimeId,
      accessMode: record.request.accessMode,
      workspaceId: record.request.workspace.workspaceId,
      workspaceRoot: record.workspaceRoot,
      backend: record.backendDescriptor.kind,
      backendImplementationId: record.backendDescriptor.implementationId,
      terminalProtocol: record.backendDescriptor.protocol,
      capabilities: record.backendDescriptor.capabilities,
      presentation: resolveTerminalPresentation(record.backendDescriptor),
      status: record.status,
      pid: record.backendSession.pid,
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      exitCode: record.exitCode,
      signal: record.signal,
      timedOut: record.timedOut,
      stopped: record.stopped,
      historyTruncated: record.historyTruncated,
    };
  }

  private duration(record: SessionRecord): number {
    const end = record.endedAt ? Date.parse(record.endedAt) : Date.now();
    return Math.max(0, end - Date.parse(record.startedAt));
  }
}

function sameTerminalCapabilities(
  left: TerminalCapabilities,
  right: TerminalCapabilities,
): boolean {
  return left.tty === right.tty
    && left.interactive === right.interactive
    && left.resize === right.resize
    && left.signals === right.signals
    && left.utf8 === right.utf8
    && left.exitStatus === right.exitStatus;
}

function isTerminalOutputAllowed(
  descriptor: TerminalBackendDescriptor,
  stream: unknown,
): stream is "stdout" | "stderr" | "terminal" {
  if (descriptor.protocol === "conpty-vt") return stream === "terminal";
  return stream === "stdout" || stream === "stderr";
}

export class ManagedTerminalRuntimeAdapter {
  private readonly terminals: TerminalSessionManager;

  constructor(terminals: TerminalSessionManager) {
    this.terminals = terminals;
  }

  async invoke(input: ManagedTerminalInvocation): Promise<ManagedTerminalResult> {
    const handle = await this.terminals.start({
      terminalSessionId: input.terminalSessionId,
      agentInstanceId: input.agentInstanceId,
      contractId: input.contractId,
      roleId: input.roleId,
      runtimeId: input.runtimeId,
      accessMode: input.accessMode,
      workspaceId: input.workspaceId,
      workspace: input.workspace,
      command: input.command,
      args: input.args,
      sensitiveArgIndexes: input.sensitiveArgIndexes,
      env: input.env,
      timeoutMs: input.timeoutMs,
    });

    if (input.prompt) await this.terminals.write(input.terminalSessionId, input.prompt);
    this.terminals.endInput(input.terminalSessionId);
    const result = await handle.completion;

    return {
      invocationId: input.invocationId,
      runtimeId: input.runtimeId,
      accessMode: input.accessMode,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      durationMs: result.durationMs,
      stdout: result.stdout,
      stderr: result.stderr,
      terminalSessionId: input.terminalSessionId,
      agentInstanceId: input.agentInstanceId,
      contractId: input.contractId,
      roleId: input.roleId,
      workspaceId: input.workspaceId,
    };
  }
}

function samePath(left: string, right: string): boolean {
  if (process.platform === "win32") return left.toLowerCase() === right.toLowerCase();
  return left === right;
}

function validateSensitiveArgIndexes(args: readonly string[], indexes: readonly number[] | undefined): void {
  if (indexes === undefined) return;
  if (new Set(indexes).size !== indexes.length) throw new Error("terminal_sensitive_arg_indexes_invalid");
  if (indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= args.length)) {
    throw new Error("terminal_sensitive_arg_indexes_invalid");
  }

}

function redactSensitiveArgs(args: readonly string[], indexes: readonly number[] | undefined): string[] {
  if (indexes === undefined || indexes.length === 0) return [...args];
  const sensitive = new Set(indexes);
  return args.map((arg, index) => sensitive.has(index) ? "[REDACTED]" : arg);
}

function detachTerminalSessionRequest(request: TerminalSessionRequest): TerminalSessionRequest {
  return {
    ...request,
    workspace: { ...request.workspace },
    args: [...request.args],
    sensitiveArgIndexes: request.sensitiveArgIndexes === undefined
      ? undefined
      : [...request.sensitiveArgIndexes],
    env: request.env === undefined ? undefined : { ...request.env },
  };
}

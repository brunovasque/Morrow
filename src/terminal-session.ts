import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { RuntimeAccessMode, RuntimeInvocation, RuntimeResult } from "./runtime-adapter.ts";

export type TerminalBackendKind = "process-pipes" | "pty";
export type TerminalSessionStatus =
  | "starting"
  | "running"
  | "completed"
  | "failed"
  | "timed_out"
  | "stopped";

export interface TerminalCapabilities {
  tty: boolean;
  interactive: boolean;
  resize: boolean;
}

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
        pid: number;
        cwd: string;
        command: string;
        args: string[];
        backend: TerminalBackendKind;
        capabilities: TerminalCapabilities;
      };
    })
  | (TerminalEventBase & {
      type: "TERMINAL_OUTPUT";
      payload: { stream: "stdout" | "stderr"; data: string };
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
  backend: TerminalBackendKind;
  capabilities: TerminalCapabilities;
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
  child: ChildProcessWithoutNullStreams;
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

const PROCESS_CAPABILITIES: TerminalCapabilities = Object.freeze({
  tty: false,
  interactive: true,
  resize: false,
});

export class TerminalSessionManager {
  private readonly managedWorkspaceRoot: string;
  private readonly maxEventsPerSession: number;
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly activeAgentInstances = new Map<string, string>();
  private readonly activeWorkspaceRoots = new Map<string, string>();
  private readonly listeners = new Set<TerminalEventListener>();
  private sequence = 0;

  constructor(managedWorkspaceRoot: string, options: { maxEventsPerSession?: number } = {}) {
    this.managedWorkspaceRoot = resolve(managedWorkspaceRoot);
    this.maxEventsPerSession = options.maxEventsPerSession ?? 5_000;
    if (!Number.isInteger(this.maxEventsPerSession) || this.maxEventsPerSession <= 0) {
      throw new Error("max_events_per_session_must_be_positive");
    }
  }

  subscribe(listener: TerminalEventListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  async start(request: TerminalSessionRequest): Promise<TerminalSessionHandle> {
    this.assertIdentity(request);
    if (this.sessions.has(request.terminalSessionId)) {
      throw new Error("terminal_session_id_already_exists");
    }
    if (this.activeAgentInstances.has(request.agentInstanceId)) {
      throw new Error("agent_instance_already_has_active_terminal");
    }

    const workspaceRoot = await this.resolveManagedWorkspace(request);
    if (this.activeWorkspaceRoots.has(workspaceRoot)) {
      throw new Error("workspace_already_in_use");
    }

    let resolveCompletion!: (result: TerminalSessionResult) => void;
    const completion = new Promise<TerminalSessionResult>((resolvePromise) => {
      resolveCompletion = resolvePromise;
    });

    const child = spawn(request.command, request.args, {
      cwd: workspaceRoot,
      env: request.env ? { ...process.env, ...request.env } : process.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const record: SessionRecord = {
      request,
      workspaceRoot,
      child,
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
    this.attach(record);

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
    const accepted = record.child.stdin.write(data, "utf8");
    this.emit(record, "TERMINAL_INPUT_WRITTEN", { bytes: Buffer.byteLength(data, "utf8") });
    if (!accepted) {
      await new Promise<void>((resolvePromise, reject) => {
        record.child.stdin.once("drain", resolvePromise);
        record.child.stdin.once("error", reject);
      });
    }
  }

  endInput(terminalSessionId: string): void {
    const record = this.requireWritableSession(terminalSessionId);
    record.child.stdin.end();
    this.emit(record, "TERMINAL_INPUT_ENDED", {});
  }

  stop(terminalSessionId: string): boolean {
    const record = this.requireSession(terminalSessionId);
    if (!this.isActive(record)) return false;
    record.stopped = true;
    return record.child.kill("SIGTERM");
  }

  private attach(record: SessionRecord): void {
    const { child, request } = record;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.once("spawn", () => {
      record.status = "running";
      record.startedAt = new Date().toISOString();
      this.emit(record, "TERMINAL_SESSION_STARTED", {
        pid: child.pid!,
        cwd: record.workspaceRoot,
        command: request.command,
        args: [...request.args],
        backend: "process-pipes",
        capabilities: PROCESS_CAPABILITIES,
      });

      if (request.timeoutMs !== undefined) {
        record.timer = setTimeout(() => {
          record.timedOut = true;
          child.kill("SIGKILL");
        }, request.timeoutMs);
      }
    });

    child.stdout.on("data", (chunk: string) => {
      record.stdout += chunk;
      this.emit(record, "TERMINAL_OUTPUT", { stream: "stdout", data: chunk });
    });
    child.stderr.on("data", (chunk: string) => {
      record.stderr += chunk;
      this.emit(record, "TERMINAL_OUTPUT", { stream: "stderr", data: chunk });
    });

    child.once("error", (error) => {
      if (record.settled) return;
      record.error = error.message;
      record.status = "failed";
      record.endedAt = new Date().toISOString();
      this.emit(record, "TERMINAL_SESSION_FAILED", {
        error: error.message,
        durationMs: this.duration(record),
      });
      this.settle(record);
    });

    child.once("close", (exitCode, signal) => {
      if (record.settled) return;
      record.exitCode = exitCode;
      record.signal = signal;
      record.endedAt = new Date().toISOString();
      record.status = record.timedOut
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
    if (!this.isActive(record) || record.child.stdin.destroyed || record.child.stdin.writableEnded) {
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
      backend: "process-pipes",
      capabilities: PROCESS_CAPABILITIES,
      status: record.status,
      pid: record.child.pid ?? null,
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

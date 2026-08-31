import { fork as forkProcess, spawn as spawnProcess, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { release } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as pty from "node-pty";
import type {
  TerminalBackend,
  TerminalBackendDescriptor,
  TerminalBackendExit,
  TerminalBackendSession,
  TerminalBackendSpawnRequest,
  TerminalInterrupt,
  TerminalOutputStream,
} from "./terminal-backend.ts";

const REQUIRED_NODE_PTY_VERSION = "1.1.0";
const MINIMUM_WINDOWS_BUILD = 18_309;
const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../scripts");
const DEFAULT_CONTROL_HELPER = resolve(SCRIPT_ROOT, "windows-console-control.ps1");
const DEFAULT_JOB_CONTROLLER = resolve(SCRIPT_ROOT, "windows-job-controller.ps1");
const DEFAULT_LAUNCHER = resolve(SCRIPT_ROOT, "windows-conpty-launcher.mjs");
const DEFAULT_SESSION_HOST = resolve(dirname(fileURLToPath(import.meta.url)), "windows-conpty-native-host.ts");
const SYSTEM_POWERSHELL = resolveWindowsPowerShellPath();
const MAX_WINDOWS_CONPTY_LAUNCH_SPEC_LENGTH = 24_000;

export function encodeWindowsConptyLaunchSpec(command: string, args: readonly string[]): string {
  const encoded = Buffer.from(JSON.stringify({ command, args }), "utf8").toString("base64url");
  if (encoded.length > MAX_WINDOWS_CONPTY_LAUNCH_SPEC_LENGTH) {
    throw new Error("terminal_launch_spec_too_large");
  }
  return encoded;
}

const WINDOWS_CONPTY_DESCRIPTOR: TerminalBackendDescriptor = Object.freeze({
  kind: "windows-conpty",
  implementationId: "node-pty-1.1.0-system-conpty-job-process-host-v3",
  protocol: "conpty-vt",
  capabilities: Object.freeze({
    tty: true,
    interactive: true,
    resize: true,
    signals: true,
    utf8: true,
    exitStatus: true,
  }),
});

export interface WindowsConptySupport {
  available: boolean;
  platform: NodeJS.Platform;
  arch: string;
  windowsBuild: number | null;
  nodePtyVersion: string | null;
  reasons: readonly string[];
}

interface NodePtyInternals {
  _agent?: {
    inSocket?: {
      destroyed: boolean;
      writableEnded: boolean;
      write(data: string): boolean;
      end(): void;
      once(event: "drain", listener: () => void): unknown;
      once(event: "error", listener: (error: Error) => void): unknown;
      off(event: "drain", listener: () => void): unknown;
      off(event: "error", listener: (error: Error) => void): unknown;
    };
    _conoutSocketWorker?: {
      dispose(): void;
      _worker?: { terminate(): Promise<number> };
    };
  };
  on?: (event: "error", listener: (error: Error) => void) => unknown;
}

export function inspectWindowsConptySupport(
  input: {
    platform?: NodeJS.Platform;
    arch?: string;
    release?: string;
    nodePtyVersion?: string | null;
  } = {},
): WindowsConptySupport {
  const platform = input.platform ?? process.platform;
  const arch = input.arch ?? process.arch;
  const osRelease = input.release ?? release();
  const windowsBuild = parseWindowsBuild(osRelease);
  const nodePtyVersion = input.nodePtyVersion === undefined
    ? readInstalledNodePtyVersion()
    : input.nodePtyVersion;
  const reasons: string[] = [];
  if (platform !== "win32") reasons.push(`platform_unsupported:${platform}`);
  if (arch !== "x64") reasons.push(`architecture_unsupported:${arch}`);
  if (windowsBuild === null || windowsBuild < MINIMUM_WINDOWS_BUILD) {
    reasons.push(`windows_build_unsupported:${windowsBuild ?? "unknown"}`);
  }
  if (nodePtyVersion !== REQUIRED_NODE_PTY_VERSION) {
    reasons.push(`node_pty_version_unsupported:${nodePtyVersion ?? "missing"}`);
  }
  return Object.freeze({
    available: reasons.length === 0,
    platform,
    arch,
    windowsBuild,
    nodePtyVersion,
    reasons: Object.freeze(reasons),
  });
}

export class WindowsConptyTerminalBackend implements TerminalBackend {
  readonly descriptor = WINDOWS_CONPTY_DESCRIPTOR;

  constructor() {
    assertWindowsConptyRuntime();
  }

  create(request: Parameters<TerminalBackend["create"]>[0]): TerminalBackendSession {
    return new WindowsConptyHostSession(request, this.descriptor, DEFAULT_SESSION_HOST);
  }
}

function assertWindowsConptyRuntime(): void {
  const support = inspectWindowsConptySupport();
  if (!support.available) {
    throw new Error(`windows_conpty_backend_unavailable:${support.reasons.join(",")}`);
  }
  for (const [label, path] of [
    ["control_helper", DEFAULT_CONTROL_HELPER],
    ["job_controller", DEFAULT_JOB_CONTROLLER],
    ["launcher", DEFAULT_LAUNCHER],
    ["session_host", DEFAULT_SESSION_HOST],
    ["system_powershell", SYSTEM_POWERSHELL],
  ] as const) {
    if (!existsSync(path)) throw new Error(`windows_conpty_${label}_missing`);
  }
}

export function createNativeWindowsConptyTerminalSession(
  request: TerminalBackendSpawnRequest,
): TerminalBackendSession {
  if (
    !process.connected
    || resolve(process.argv[1] ?? "") !== DEFAULT_SESSION_HOST
  ) {
    throw new Error("windows_conpty_native_session_requires_isolated_host");
  }
  assertWindowsConptyRuntime();
  return new NativeWindowsConptyTerminalSession(request, WINDOWS_CONPTY_DESCRIPTOR, {
    controlHelperPath: DEFAULT_CONTROL_HELPER,
    jobControllerPath: DEFAULT_JOB_CONTROLLER,
    launcherPath: DEFAULT_LAUNCHER,
    powershellCommand: SYSTEM_POWERSHELL,
  });
}

export type WindowsConptyHostCommand =
  | { type: "initialize"; request: TerminalBackendSpawnRequest }
  | { type: "write"; writeId: number; data: string }
  | { type: "end-input" }
  | { type: "resize"; columns: number; rows: number }
  | { type: "interrupt"; kind: TerminalInterrupt }
  | { type: "stop"; force: boolean };

export type WindowsConptyHostEvent =
  | { type: "started"; pid: number; hostPid: number }
  | { type: "output"; stream: TerminalOutputStream; data: string }
  | { type: "write-complete"; writeId: number }
  | { type: "error"; error: string }
  | { type: "exit"; exitCode: number | null; signal: NodeJS.Signals | null };

class WindowsConptyHostSession implements TerminalBackendSession {
  readonly descriptor: TerminalBackendDescriptor;
  private readonly request: TerminalBackendSpawnRequest;
  private readonly hostPath: string;
  private host: ChildProcess | null = null;
  private terminalPid: number | null = null;
  private nativeHostPid: number | null = null;
  private started = false;
  private closedInput = false;
  private exited = false;
  private pendingExit: TerminalBackendExit | null = null;
  private hostStderr = "";
  private nextWriteId = 0;
  private lastDrain: Promise<void> = Promise.resolve();
  private readonly writeAcks = new Map<number, {
    resolve: () => void;
    reject: (error: Error) => void;
  }>();
  private readonly startedListeners: Array<() => void> = [];
  private readonly outputListeners: Array<(stream: TerminalOutputStream, data: string) => void> = [];
  private readonly errorListeners: Array<(error: Error) => void> = [];
  private readonly exitListeners: Array<(result: TerminalBackendExit) => void> = [];

  constructor(
    request: TerminalBackendSpawnRequest,
    descriptor: TerminalBackendDescriptor,
    hostPath: string,
  ) {
    this.request = {
      command: request.command,
      args: [...request.args],
      cwd: request.cwd,
      env: { ...request.env },
    };
    this.descriptor = descriptor;
    this.hostPath = hostPath;
  }

  get pid(): number | null { return this.terminalPid; }
  get isolationProcessId(): number | null { return this.nativeHostPid; }
  get inputClosed(): boolean { return this.closedInput || this.exited; }

  start(): void {
    if (this.started) throw new Error("terminal_backend_session_already_started");
    this.started = true;
    const host = forkProcess(this.hostPath, [], {
      cwd: this.request.cwd,
      env: helperEnvironment(),
      execArgv: ["--experimental-strip-types"],
      serialization: "json",
      stdio: ["ignore", "ignore", "pipe", "ipc"],
      windowsHide: true,
    });
    this.host = host;
    host.stderr?.setEncoding("utf8");
    host.stderr?.on("data", (chunk: string) => {
      this.hostStderr = (this.hostStderr + chunk).slice(-4_096);
    });
    host.on("message", (message) => this.handleHostMessage(message));
    host.once("error", (error) => this.emitError(new Error("terminal_conpty_host_process_error", { cause: error })));
    host.once("close", (exitCode, signal) => this.handleHostClose(exitCode, signal));
    if (!this.sendHost({ type: "initialize", request: this.request })) {
      this.emitError(new Error("terminal_conpty_host_initialize_backpressure"));
    }
  }

  onStarted(listener: () => void): void { this.assertRegistrationOpen(); this.startedListeners.push(listener); }
  onOutput(listener: (stream: TerminalOutputStream, data: string) => void): void { this.assertRegistrationOpen(); this.outputListeners.push(listener); }
  onError(listener: (error: Error) => void): void { this.assertRegistrationOpen(); this.errorListeners.push(listener); }
  onExit(listener: (result: TerminalBackendExit) => void): void { this.assertRegistrationOpen(); this.exitListeners.push(listener); }

  write(data: string): boolean {
    if (this.inputClosed) throw new Error("terminal_input_closed");
    const writeId = ++this.nextWriteId;
    this.lastDrain = new Promise<void>((resolvePromise, reject) => {
      this.writeAcks.set(writeId, { resolve: resolvePromise, reject });
    });
    if (!this.sendHost({ type: "write", writeId, data })) {
      const ack = this.writeAcks.get(writeId);
      this.writeAcks.delete(writeId);
      ack?.reject(new Error("terminal_conpty_host_write_backpressure"));
    }
    // The manager waits until the native host confirms its own input drain.
    return false;
  }

  waitForDrain(): Promise<void> { return this.lastDrain; }

  endInput(): void {
    if (this.inputClosed) return;
    this.closedInput = true;
    this.sendHostOrThrow({ type: "end-input" });
  }

  resize(columns: number, rows: number): void {
    this.sendHostOrThrow({ type: "resize", columns, rows });
  }

  interrupt(kind: TerminalInterrupt): void {
    this.sendHostOrThrow({ type: "interrupt", kind });
  }

  stop(force: boolean): boolean {
    if (!this.host || this.exited) return false;
    this.closedInput = true;
    if (this.pendingExit) return true;
    return this.sendHost({ type: "stop", force });
  }

  private handleHostMessage(value: unknown): void {
    const message = parseWindowsConptyHostEvent(value);
    if (!message) {
      this.emitError(new Error("terminal_conpty_host_protocol_invalid"));
      this.stop(true);
      return;
    }
    if (message.type === "started") {
      if (this.terminalPid !== null || this.nativeHostPid !== null) {
        this.emitError(new Error("terminal_conpty_host_duplicate_start"));
        this.stop(true);
        return;
      }
      if (message.hostPid !== this.host?.pid || message.pid === message.hostPid) {
        this.emitError(new Error("terminal_conpty_host_pid_mismatch"));
        this.stop(true);
        return;
      }
      this.terminalPid = message.pid;
      this.nativeHostPid = message.hostPid;
      for (const listener of this.startedListeners) listener();
      return;
    }
    if (message.type === "output") {
      for (const listener of this.outputListeners) listener(message.stream, message.data);
      return;
    }
    if (message.type === "write-complete") {
      const ack = this.writeAcks.get(message.writeId);
      if (!ack) {
        this.emitError(new Error("terminal_conpty_host_write_ack_unknown"));
        this.stop(true);
        return;
      }
      this.writeAcks.delete(message.writeId);
      ack.resolve();
      return;
    }
    if (message.type === "error") {
      this.emitError(new Error(message.error));
      return;
    }
    this.pendingExit = { exitCode: message.exitCode, signal: message.signal };
    this.closedInput = true;
  }

  private handleHostClose(exitCode: number | null, signal: NodeJS.Signals | null): void {
    if (this.exited) return;
    this.exited = true;
    this.closedInput = true;
    const pendingError = new Error("terminal_conpty_host_closed_before_write_ack");
    for (const ack of this.writeAcks.values()) ack.reject(pendingError);
    this.writeAcks.clear();
    const terminalExit = this.pendingExit;
    if (!terminalExit) {
      const stderr = this.hostStderr.trim().replaceAll(/\s+/g, " ").slice(-1_024);
      this.emitError(new Error(`terminal_conpty_host_exited:${exitCode ?? "null"}:${signal ?? "null"}${stderr ? `:${stderr}` : ""}`));
    }
    const result = terminalExit ?? { exitCode: exitCode ?? 1, signal };
    for (const listener of this.exitListeners) listener(result);
  }

  private sendHost(command: WindowsConptyHostCommand): boolean {
    const host = this.host;
    if (!host?.connected) return false;
    try {
      host.send(command, (error) => {
        if (error) this.emitError(new Error("terminal_conpty_host_send_failed", { cause: error }));
      });
      return true;
    } catch (error) {
      this.emitError(new Error("terminal_conpty_host_send_failed", { cause: asError(error) }));
      return false;
    }
  }

  private sendHostOrThrow(command: WindowsConptyHostCommand): void {
    if (!this.sendHost(command)) throw new Error("terminal_conpty_host_not_writable");
  }

  private emitError(error: Error): void { for (const listener of this.errorListeners) listener(error); }
  private assertRegistrationOpen(): void { if (this.started) throw new Error("terminal_backend_listener_registration_closed"); }
}

class NativeWindowsConptyTerminalSession implements TerminalBackendSession {
  readonly descriptor: TerminalBackendDescriptor;
  private readonly request: Parameters<TerminalBackend["create"]>[0];
  private readonly options: {
    controlHelperPath: string;
    jobControllerPath: string;
    launcherPath: string;
    powershellCommand: string;
  };
  private readonly releasePath: string;
  private terminal: pty.IPty | null = null;
  private jobController: ChildProcess | null = null;
  private jobReady = false;
  private expectedJobControllerExit = false;
  private startupTimer: NodeJS.Timeout | null = null;
  private started = false;
  private closedInput = false;
  private exitFinalizing = false;
  private exited = false;
  private readonly controlHelpers = new Set<ChildProcess>();
  private readonly startedListeners: Array<() => void> = [];
  private readonly outputListeners: Array<(stream: TerminalOutputStream, data: string) => void> = [];
  private readonly errorListeners: Array<(error: Error) => void> = [];
  private readonly exitListeners: Array<(result: TerminalBackendExit) => void> = [];

  constructor(
    request: Parameters<TerminalBackend["create"]>[0],
    descriptor: TerminalBackendDescriptor,
    options: {
      controlHelperPath: string;
      jobControllerPath: string;
      launcherPath: string;
      powershellCommand: string;
    },
  ) {
    this.request = { command: request.command, args: [...request.args], cwd: request.cwd, env: { ...request.env } };
    this.descriptor = descriptor;
    this.options = options;
    this.releasePath = resolve(request.cwd, `.morrow-conpty-release-${randomUUID()}`);
  }

  get pid(): number | null { return this.terminal?.pid ?? null; }
  get inputClosed(): boolean { return this.closedInput || this.exited; }

  start(): void {
    if (this.started) throw new Error("terminal_backend_session_already_started");
    this.started = true;
    const encodedSpec = encodeWindowsConptyLaunchSpec(this.request.command, this.request.args);
    const terminal = pty.spawn(process.execPath, [this.options.launcherPath, this.releasePath, encodedSpec], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: this.request.cwd,
      env: this.request.env,
      useConpty: true,
      useConptyDll: false,
    });
    const internals = terminal as pty.IPty & NodePtyInternals;
    this.terminal = terminal;
    // Register lifecycle observers immediately after spawn. Any compatibility
    // refusal below can then still confirm physical exit and release the
    // manager's workspace reservation instead of hanging after a partial start.
    terminal.onData((data) => {
      for (const listener of this.outputListeners) listener("terminal", data);
    });
    terminal.onExit((event) => this.handleTerminalExit(terminal, event.exitCode));
    internals.on?.("error", (error) => this.emitError(error));
    if (typeof internals._agent?.inSocket?.write !== "function"
      || typeof internals._agent?.inSocket?.end !== "function"
      || typeof internals._agent?.inSocket?.once !== "function"
      || typeof internals._agent?.inSocket?.off !== "function"
      || typeof internals._agent?._conoutSocketWorker?.dispose !== "function"
      || typeof internals._agent?._conoutSocketWorker?._worker?.terminate !== "function") {
      this.closedInput = true;
      try { process.kill(terminal.pid); } catch { /* compatibility refusal remains authoritative */ }
      throw new Error("node_pty_1_1_0_compatibility_hook_unavailable");
    }
    this.startJobController(terminal.pid);
  }

  onStarted(listener: () => void): void { this.assertRegistrationOpen(); this.startedListeners.push(listener); }
  onOutput(listener: (stream: TerminalOutputStream, data: string) => void): void { this.assertRegistrationOpen(); this.outputListeners.push(listener); }
  onError(listener: (error: Error) => void): void { this.assertRegistrationOpen(); this.errorListeners.push(listener); }
  onExit(listener: (result: TerminalBackendExit) => void): void { this.assertRegistrationOpen(); this.exitListeners.push(listener); }

  write(data: string): boolean {
    if (this.closedInput) throw new Error("terminal_input_closed");
    return this.requireInputSocket().write(data);
  }
  waitForDrain(): Promise<void> {
    const input = this.requireInputSocket();
    return new Promise<void>((resolvePromise, reject) => {
      const onDrain = () => {
        input.off("error", onError);
        resolvePromise();
      };
      const onError = (error: Error) => {
        input.off("drain", onDrain);
        reject(error);
      };
      input.once("drain", onDrain);
      input.once("error", onError);
    });
  }
  endInput(): void {
    if (this.closedInput) return;
    this.requireInputSocket().end();
    this.closedInput = true;
  }
  resize(columns: number, rows: number): void { this.requireTerminal().resize(columns, rows); }
  interrupt(kind: TerminalInterrupt): void {
    if (kind === "ctrl-c") { this.requireInputSocket().write("\x03"); return; }
    if (kind !== "ctrl-break") throw new Error("terminal_interrupt_kind_invalid");
    this.startControlHelper();
  }
  stop(_force: boolean): boolean {
    if (!this.terminal || this.exited) return false;
    this.closedInput = true;
    if (this.exitFinalizing) return true;
    this.expectedJobControllerExit = true;
    if (this.jobController?.stdin?.writable) {
      this.jobController.stdin.end("stop\n");
      return true;
    }
    try { process.kill(this.terminal.pid); return true; }
    catch (error) {
      this.emitError(new Error("terminal_stop_failed", { cause: asError(error) }));
      return false;
    }
  }

  private startJobController(pid: number): void {
    const controller = spawnProcess(this.options.powershellCommand, [
      "-NoLogo", "-NoProfile", "-NonInteractive", "-File", this.options.jobControllerPath, String(pid),
    ], {
      cwd: this.request.cwd, env: helperEnvironment(), shell: false, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
    });
    this.jobController = controller;
    let stdout = "";
    let stderr = "";
    controller.stdout?.setEncoding("utf8");
    controller.stderr?.setEncoding("utf8");
    controller.stdout?.on("data", (chunk: string) => {
      stdout = (stdout + chunk).slice(-4_096);
      if (!this.jobReady && stdout.includes("MORROW_JOB_READY")) this.releaseManagedProcess();
    });
    controller.stderr?.on("data", (chunk: string) => { stderr = (stderr + chunk).slice(-4_096); });
    controller.once("error", (error) => this.failJobController("spawn", error));
    controller.once("close", (exitCode) => {
      this.jobController = null;
      if (!this.expectedJobControllerExit && !this.exited) {
        this.failJobController(`exit:${exitCode}:${stderr.trim()}`);
      }
    });
    this.startupTimer = setTimeout(() => this.failJobController("startup_timeout"), 5_000);
  }

  private releaseManagedProcess(): void {
    if (this.jobReady || this.exited || this.expectedJobControllerExit) return;
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.startupTimer = null;
    try {
      writeFileSync(this.releasePath, "", { flag: "wx" });
    } catch (error) {
      this.failJobController("release_failed", error);
      return;
    }
    this.jobReady = true;
    for (const listener of this.startedListeners) listener();
  }

  private failJobController(reason: string, cause?: unknown): void {
    if (this.expectedJobControllerExit || this.exited) return;
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.startupTimer = null;
    this.expectedJobControllerExit = true;
    this.jobController?.stdin?.end();
    if (!this.jobReady && this.terminal) {
      try { process.kill(this.terminal.pid); } catch { /* terminal exit reports liveness */ }
    }
    this.emitError(new Error(`terminal_job_controller_failed:${reason}`, cause === undefined ? undefined : { cause: asError(cause) }));
  }

  private startControlHelper(): void {
    const helper = spawnProcess(this.options.powershellCommand, [
      "-NoLogo", "-NoProfile", "-NonInteractive", "-File", this.options.controlHelperPath,
      String(this.requireTerminal().pid), "1",
    ], {
      cwd: this.request.cwd, env: helperEnvironment(), shell: false, stdio: ["ignore", "ignore", "pipe"], windowsHide: true,
    });
    this.controlHelpers.add(helper);
    let stderr = "";
    helper.stderr?.setEncoding("utf8");
    helper.stderr?.on("data", (chunk: string) => { stderr = (stderr + chunk).slice(-4_096); });
    helper.once("error", (error) => {
      this.controlHelpers.delete(helper);
      this.emitError(new Error("terminal_ctrl_break_helper_failed", { cause: error }));
    });
    helper.once("close", (exitCode) => {
      this.controlHelpers.delete(helper);
      if (exitCode !== 0 && !this.exited && !this.exitFinalizing) {
        this.emitError(new Error(`terminal_ctrl_break_helper_failed:${exitCode}:${stderr.trim()}`));
      }
    });
  }

  private handleTerminalExit(terminal: pty.IPty, exitCode: number): void {
    if (this.exited || this.exitFinalizing) return;
    this.exitFinalizing = true;
    this.closedInput = true;
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.startupTimer = null;
    rmSync(this.releasePath, { force: true });
    this.expectedJobControllerExit = true;
    const controller = this.jobController;
    const helpers = [...this.controlHelpers];
    const childCleanup = [controller, ...helpers]
      .filter((child): child is ChildProcess => child !== null)
      .map((child) => waitForChildExit(child));
    controller?.stdin?.end("close\n");
    for (const helper of helpers) helper.kill();
    this.controlHelpers.clear();
    void this.finalizeTerminalExit(terminal, exitCode, childCleanup);
  }

  private async finalizeTerminalExit(
    terminal: pty.IPty,
    exitCode: number,
    childCleanup: readonly Promise<void>[],
  ): Promise<void> {
    const cleanup = await Promise.allSettled([
      this.terminateNaturalExitWorker(terminal),
      ...childCleanup,
    ]);
    const failed = cleanup.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failed) {
      this.emitError(new Error("terminal_conpty_cleanup_failed", { cause: asError(failed.reason) }));
    }
    this.exited = true;
    this.exitFinalizing = false;
    for (const listener of this.exitListeners) listener({ exitCode, signal: null });
  }

  private async terminateNaturalExitWorker(terminal: pty.IPty): Promise<void> {
    const worker = (terminal as pty.IPty & NodePtyInternals)._agent?._conoutSocketWorker;
    if (typeof worker?._worker?.terminate !== "function") {
      throw new Error("terminal_conpty_cleanup_hook_unavailable");
    }
    // The public exit arrives only after node-pty's output-socket flush. Wait
    // for the residual worker handle before confirming exit to the manager.
    await worker._worker.terminate();
  }
  private emitError(error: Error): void { for (const listener of this.errorListeners) listener(error); }
  private assertRegistrationOpen(): void { if (this.started) throw new Error("terminal_backend_listener_registration_closed"); }
  private requireTerminal(): pty.IPty {
    if (!this.terminal) throw new Error("terminal_backend_session_not_started");
    return this.terminal;
  }
  private requireInputSocket(): NonNullable<NonNullable<NodePtyInternals["_agent"]>["inSocket"]> {
    const input = (this.requireTerminal() as pty.IPty & NodePtyInternals)._agent?.inSocket;
    if (!input || input.destroyed || input.writableEnded) throw new Error("terminal_input_closed");
    return input;
  }
}

function parseWindowsBuild(osRelease: string): number | null {
  const value = Number.parseInt(osRelease.split(".").at(-1) ?? "", 10);
  return Number.isInteger(value) ? value : null;
}
function readInstalledNodePtyVersion(): string | null {
  try {
    const packagePath = resolve(dirname(fileURLToPath(import.meta.url)), "../node_modules/node-pty/package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { version?: unknown };
    return typeof packageJson.version === "string" ? packageJson.version : null;
  } catch { return null; }
}
function asError(value: unknown): Error { return value instanceof Error ? value : new Error(String(value)); }

function waitForChildExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise<void>((resolvePromise) => child.once("close", () => resolvePromise()));
}

function parseWindowsConptyHostEvent(value: unknown): WindowsConptyHostEvent | null {
  if (!isPlainDataRecord(value)) return null;
  const event = value;
  if (event.type === "started") {
    return hasExactOwnDataKeys(event, ["type", "pid", "hostPid"])
      && Number.isSafeInteger(event.pid) && (event.pid as number) > 0
      && Number.isSafeInteger(event.hostPid) && (event.hostPid as number) > 0
      ? { type: "started", pid: event.pid as number, hostPid: event.hostPid as number }
      : null;
  }
  if (event.type === "output") {
    return hasExactOwnDataKeys(event, ["type", "stream", "data"])
      && (event.stream === "terminal" || event.stream === "stdout" || event.stream === "stderr")
      && typeof event.data === "string"
      ? { type: "output", stream: event.stream, data: event.data }
      : null;
  }
  if (event.type === "write-complete") {
    return hasExactOwnDataKeys(event, ["type", "writeId"])
      && Number.isSafeInteger(event.writeId) && (event.writeId as number) > 0
      ? { type: "write-complete", writeId: event.writeId as number }
      : null;
  }
  if (event.type === "error") {
    return hasExactOwnDataKeys(event, ["type", "error"])
      && typeof event.error === "string" && event.error.length > 0 && event.error.length <= 4_096
      ? { type: "error", error: event.error }
      : null;
  }
  if (event.type === "exit") {
    if (!hasExactOwnDataKeys(event, ["type", "exitCode", "signal"])) return null;
    const validExitCode = event.exitCode === null || Number.isInteger(event.exitCode);
    const validSignal = event.signal === null || (typeof event.signal === "string" && /^SIG[A-Z0-9]+$/.test(event.signal));
    return validExitCode && validSignal
      ? {
          type: "exit",
          exitCode: event.exitCode as number | null,
          signal: event.signal as NodeJS.Signals | null,
        }
      : null;
  }
  return null;
}

function isPlainDataRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnDataKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  if (keys.length !== expected.length || keys.some((key) => typeof key !== "string" || !expected.includes(key))) {
    return false;
  }
  return expected.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor;
  });
}

export function resolveWindowsPowerShellPath(
  systemRoot = process.env.SystemRoot ?? process.env.WINDIR ?? "C:\\Windows",
): string {
  const trustedRoot = isAbsolute(systemRoot) ? systemRoot : "C:\\Windows";
  // Do not search PATH: a user/workspace shim must never become the controller
  // that owns Job Object and console-control capabilities.
  return resolve(trustedRoot, "System32/WindowsPowerShell/v1.0/powershell.exe");
}

function helperEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP"] as const) {
    const value = process.env[key];
    if (value !== undefined) environment[key] = value;
  }
  return environment;
}

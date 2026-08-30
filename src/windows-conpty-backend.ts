import { execFileSync, spawn as spawnProcess, type ChildProcess } from "node:child_process";
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
  TerminalInterrupt,
  TerminalOutputStream,
} from "./terminal-backend.ts";

const REQUIRED_NODE_PTY_VERSION = "1.1.0";
const MINIMUM_WINDOWS_BUILD = 18_309;
const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../scripts");
const DEFAULT_CONTROL_HELPER = resolve(SCRIPT_ROOT, "windows-console-control.ps1");
const DEFAULT_JOB_CONTROLLER = resolve(SCRIPT_ROOT, "windows-job-controller.ps1");
const DEFAULT_LAUNCHER = resolve(SCRIPT_ROOT, "windows-conpty-launcher.mjs");
const SYSTEM_POWERSHELL = resolveSystemPowerShell();

const WINDOWS_CONPTY_DESCRIPTOR: TerminalBackendDescriptor = Object.freeze({
  kind: "windows-conpty",
  implementationId: "node-pty-1.1.0-system-conpty-job-v1",
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
    _conoutSocketWorker?: { dispose(): void };
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
    const support = inspectWindowsConptySupport();
    if (!support.available) {
      throw new Error(`windows_conpty_backend_unavailable:${support.reasons.join(",")}`);
    }
    for (const [label, path] of [
      ["control_helper", DEFAULT_CONTROL_HELPER],
      ["job_controller", DEFAULT_JOB_CONTROLLER],
      ["launcher", DEFAULT_LAUNCHER],
      ["system_powershell", SYSTEM_POWERSHELL],
    ] as const) {
      if (!existsSync(path)) throw new Error(`windows_conpty_${label}_missing`);
    }
  }

  create(request: Parameters<TerminalBackend["create"]>[0]): TerminalBackendSession {
    return new WindowsConptyTerminalSession(request, this.descriptor, {
      controlHelperPath: DEFAULT_CONTROL_HELPER,
      jobControllerPath: DEFAULT_JOB_CONTROLLER,
      launcherPath: DEFAULT_LAUNCHER,
      powershellCommand: SYSTEM_POWERSHELL,
    });
  }
}

class WindowsConptyTerminalSession implements TerminalBackendSession {
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
    const encodedSpec = Buffer.from(JSON.stringify({ command: this.request.command, args: this.request.args }), "utf8").toString("base64url");
    if (encodedSpec.length > 24_000) throw new Error("terminal_launch_spec_too_large");
    const terminal = pty.spawn(process.execPath, [this.options.launcherPath, this.releasePath, encodedSpec], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: this.request.cwd,
      env: this.request.env,
      useConpty: true,
      useConptyDll: false,
    });
    this.terminal = terminal;
    const internals = terminal as pty.IPty & NodePtyInternals;
    if (typeof internals._agent?.inSocket?.write !== "function"
      || typeof internals._agent?.inSocket?.end !== "function"
      || typeof internals._agent?.inSocket?.once !== "function"
      || typeof internals._agent?.inSocket?.off !== "function"
      || typeof internals._agent?._conoutSocketWorker?.dispose !== "function") {
      try { process.kill(terminal.pid); } catch { /* compatibility refusal remains authoritative */ }
      throw new Error("node_pty_1_1_0_compatibility_hook_unavailable");
    }
    terminal.onData((data) => {
      for (const listener of this.outputListeners) listener("terminal", data);
    });
    terminal.onExit((event) => this.handleTerminalExit(terminal, event.exitCode));
    internals.on?.("error", (error) => this.emitError(error));
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
      if (exitCode !== 0 && !this.exited) {
        this.emitError(new Error(`terminal_ctrl_break_helper_failed:${exitCode}:${stderr.trim()}`));
      }
    });
  }

  private handleTerminalExit(terminal: pty.IPty, exitCode: number): void {
    this.exited = true;
    this.closedInput = true;
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.startupTimer = null;
    rmSync(this.releasePath, { force: true });
    this.expectedJobControllerExit = true;
    this.jobController?.stdin?.end("close\n");
    for (const helper of this.controlHelpers) helper.kill();
    this.controlHelpers.clear();
    this.disposeNaturalExitWorker(terminal);
    for (const listener of this.exitListeners) listener({ exitCode, signal: null });
  }

  private disposeNaturalExitWorker(terminal: pty.IPty): void {
    try { (terminal as pty.IPty & NodePtyInternals)._agent!._conoutSocketWorker!.dispose(); }
    catch (error) { this.emitError(new Error("terminal_conpty_cleanup_failed", { cause: asError(error) })); }
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

function resolveSystemPowerShell(): string {
  const conventional = resolve(process.env.ProgramFiles ?? "C:\\Program Files", "PowerShell/7/pwsh.exe");
  if (existsSync(conventional)) return conventional;
  try {
    const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
    const where = resolve(systemRoot, "System32/where.exe");
    const output = execFileSync(where, ["pwsh.exe"], {
      cwd: systemRoot,
      env: helperEnvironment(true),
      encoding: "utf8",
      windowsHide: true,
    });
    const candidate = output.split(/\r?\n/).map((line) => line.trim())
      .find((line) => isAbsolute(line) && existsSync(line));
    if (candidate) return candidate;
  } catch {
    // Constructor reports one stable unavailable reason below.
  }
  return conventional;
}

function helperEnvironment(includePath = false): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP", "ComSpec", "PATHEXT"] as const) {
    const value = process.env[key];
    if (value !== undefined) environment[key] = value;
  }
  if (includePath) {
    const pathValue = process.env.Path ?? process.env.PATH;
    if (pathValue !== undefined) environment.Path = pathValue;
  }
  return environment;
}

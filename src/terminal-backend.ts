import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export type TerminalBackendKind = "process-pipes" | "windows-conpty";
export type TerminalProtocol = "separate-pipes" | "conpty-vt";
export type TerminalOutputStream = "stdout" | "stderr" | "terminal";
export type TerminalInterrupt = "ctrl-c" | "ctrl-break";
export type TerminalPresentationMode = "process-output" | "full-terminal";

export interface TerminalCapabilities {
  tty: boolean;
  interactive: boolean;
  resize: boolean;
  signals: boolean;
  utf8: boolean;
  exitStatus: boolean;
}

export interface TerminalBackendDescriptor {
  kind: TerminalBackendKind;
  implementationId: string;
  protocol: TerminalProtocol;
  capabilities: TerminalCapabilities;
}

export interface TerminalPresentation {
  mode: TerminalPresentationMode;
  fullTerminal: boolean;
  missing: readonly string[];
}

export interface TerminalBackendSpawnRequest {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface TerminalBackendExit {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

export interface TerminalBackendSession {
  readonly descriptor: TerminalBackendDescriptor;
  readonly pid: number | null;
  /** Process that owns native terminal state when isolation requires one. */
  readonly isolationProcessId?: number | null;
  readonly inputClosed: boolean;
  /** Starts execution only after every observer below has been registered. */
  start(): void;
  /** Registration must not invoke listeners before start(). */
  onStarted(listener: () => void): void;
  onOutput(listener: (stream: TerminalOutputStream, data: string) => void): void;
  onError(listener: (error: Error) => void): void;
  onExit(listener: (result: TerminalBackendExit) => void): void;
  write(data: string): boolean;
  waitForDrain(): Promise<void>;
  endInput(): void;
  resize(columns: number, rows: number): void;
  interrupt(kind: TerminalInterrupt): void;
  stop(force: boolean): boolean;
}

export interface TerminalBackend {
  readonly descriptor: TerminalBackendDescriptor;
  /** Creates an inert session. Implementations must not spawn from create(). */
  create(request: TerminalBackendSpawnRequest): TerminalBackendSession;
}

const PROCESS_PIPES_DESCRIPTOR = freezeDescriptor({
  kind: "process-pipes",
  implementationId: "node-child-process-pipes-v1",
  protocol: "separate-pipes",
  capabilities: {
    tty: false,
    interactive: true,
    resize: false,
    signals: false,
    utf8: true,
    exitStatus: true,
  },
});

export class ProcessPipesTerminalBackend implements TerminalBackend {
  readonly descriptor = PROCESS_PIPES_DESCRIPTOR;

  create(request: TerminalBackendSpawnRequest): TerminalBackendSession {
    return new ProcessPipesTerminalSession(request, this.descriptor);
  }
}

class ProcessPipesTerminalSession implements TerminalBackendSession {
  private readonly request: TerminalBackendSpawnRequest;
  private child: ChildProcessWithoutNullStreams | null = null;
  private started = false;
  private readonly startedListeners: Array<() => void> = [];
  private readonly outputListeners: Array<(stream: TerminalOutputStream, data: string) => void> = [];
  private readonly errorListeners: Array<(error: Error) => void> = [];
  private readonly exitListeners: Array<(result: TerminalBackendExit) => void> = [];
  readonly descriptor: TerminalBackendDescriptor;

  constructor(request: TerminalBackendSpawnRequest, descriptor: TerminalBackendDescriptor) {
    this.request = {
      command: request.command,
      args: [...request.args],
      cwd: request.cwd,
      env: { ...request.env },
    };
    this.descriptor = descriptor;
  }

  get pid(): number | null {
    return this.child?.pid ?? null;
  }

  get inputClosed(): boolean {
    if (!this.started) return false;
    return !this.child || this.child.stdin.destroyed || this.child.stdin.writableEnded;
  }

  start(): void {
    if (this.started) throw new Error("terminal_backend_session_already_started");
    this.started = true;
    const child = spawn(this.request.command, this.request.args, {
      cwd: this.request.cwd,
      env: this.request.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.once("spawn", () => {
      for (const listener of this.startedListeners) listener();
    });
    child.stdout.on("data", (chunk: string) => {
      for (const listener of this.outputListeners) listener("stdout", chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      for (const listener of this.outputListeners) listener("stderr", chunk);
    });
    child.once("error", (error) => {
      for (const listener of this.errorListeners) listener(error);
    });
    child.once("close", (exitCode, signal) => {
      for (const listener of this.exitListeners) listener({ exitCode, signal });
    });
  }

  onStarted(listener: () => void): void {
    this.assertRegistrationOpen();
    this.startedListeners.push(listener);
  }

  onOutput(listener: (stream: TerminalOutputStream, data: string) => void): void {
    this.assertRegistrationOpen();
    this.outputListeners.push(listener);
  }

  onError(listener: (error: Error) => void): void {
    this.assertRegistrationOpen();
    this.errorListeners.push(listener);
  }

  onExit(listener: (result: TerminalBackendExit) => void): void {
    this.assertRegistrationOpen();
    this.exitListeners.push(listener);
  }

  write(data: string): boolean {
    return this.requireChild().stdin.write(data, "utf8");
  }

  waitForDrain(): Promise<void> {
    const child = this.requireChild();
    return new Promise<void>((resolvePromise, reject) => {
      const onDrain = () => {
        child.stdin.off("error", onError);
        resolvePromise();
      };
      const onError = (error: Error) => {
        child.stdin.off("drain", onDrain);
        reject(error);
      };
      child.stdin.once("drain", onDrain);
      child.stdin.once("error", onError);
    });
  }

  endInput(): void {
    this.requireChild().stdin.end();
  }

  resize(_columns: number, _rows: number): void {
    throw new Error("terminal_resize_not_supported");
  }

  interrupt(_kind: TerminalInterrupt): void {
    throw new Error("terminal_interrupt_not_supported");
  }

  stop(force: boolean): boolean {
    if (!this.child) return false;
    return this.child.kill(force ? "SIGKILL" : "SIGTERM");
  }

  private assertRegistrationOpen(): void {
    if (this.started) throw new Error("terminal_backend_listener_registration_closed");
  }

  private requireChild(): ChildProcessWithoutNullStreams {
    if (!this.child) throw new Error("terminal_backend_session_not_started");
    return this.child;
  }
}

export function validateTerminalBackendDescriptor(
  input: TerminalBackendDescriptor,
): TerminalBackendDescriptor {
  if (!input || typeof input !== "object") throw new Error("terminal_backend_descriptor_required");
  assertPlainDataRecord(
    input as unknown as Record<string, unknown>,
    ["kind", "implementationId", "protocol", "capabilities"],
    "terminal_backend_descriptor",
  );
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(input.implementationId)) {
    throw new Error("terminal_backend_implementation_id_invalid");
  }

  const capabilities = input.capabilities;
  if (!capabilities || typeof capabilities !== "object") {
    throw new Error("terminal_backend_capabilities_required");
  }
  assertPlainDataRecord(
    capabilities as unknown as Record<string, unknown>,
    ["tty", "interactive", "resize", "signals", "utf8", "exitStatus"],
    "terminal_backend_capabilities",
  );
  for (const key of ["tty", "interactive", "resize", "signals", "utf8", "exitStatus"] as const) {
    if (typeof capabilities[key] !== "boolean") {
      throw new Error(`terminal_backend_capability_invalid:${key}`);
    }
  }

  if (input.kind === "process-pipes") {
    if (
      input.protocol !== "separate-pipes"
      || capabilities.tty
      || !capabilities.interactive
      || capabilities.resize
      || capabilities.signals
      || !capabilities.utf8
      || !capabilities.exitStatus
    ) {
      throw new Error("process_pipes_capabilities_inconsistent");
    }
  } else if (input.kind === "windows-conpty") {
    if (input.protocol !== "conpty-vt") {
      throw new Error("windows_conpty_protocol_inconsistent");
    }
  } else {
    throw new Error("terminal_backend_kind_unknown");
  }

  return freezeDescriptor(input);
}

export function resolveTerminalPresentation(
  input: TerminalBackendDescriptor,
): TerminalPresentation {
  const descriptor = validateTerminalBackendDescriptor(input);
  const missing: string[] = [];
  if (descriptor.kind !== "windows-conpty") missing.push("backend:windows-conpty");
  if (descriptor.protocol !== "conpty-vt") missing.push("protocol:conpty-vt");
  for (const key of ["tty", "interactive", "resize", "signals", "utf8", "exitStatus"] as const) {
    if (!descriptor.capabilities[key]) missing.push(`capability:${key}`);
  }

  const fullTerminal = missing.length === 0;
  return Object.freeze({
    mode: fullTerminal ? "full-terminal" : "process-output",
    fullTerminal,
    missing: Object.freeze([...missing]),
  });
}

export function assertTerminalPresentationAllowed(
  descriptor: TerminalBackendDescriptor,
  requested: TerminalPresentationMode,
): void {
  if (requested !== "process-output" && requested !== "full-terminal") {
    throw new Error("terminal_presentation_mode_unknown");
  }
  const presentation = resolveTerminalPresentation(descriptor);
  if (requested === "process-output") return;
  if (!presentation.fullTerminal) {
    throw new Error(`terminal_full_presentation_not_supported:${presentation.missing.join(",")}`);
  }
}

function freezeDescriptor(input: TerminalBackendDescriptor): TerminalBackendDescriptor {
  return Object.freeze({
    kind: input.kind,
    implementationId: input.implementationId,
    protocol: input.protocol,
    capabilities: Object.freeze({
      tty: input.capabilities.tty,
      interactive: input.capabilities.interactive,
      resize: input.capabilities.resize,
      signals: input.capabilities.signals,
      utf8: input.capabilities.utf8,
      exitStatus: input.capabilities.exitStatus,
    }),
  });
}

function assertPlainDataRecord(
  input: Record<string, unknown>,
  expectedKeys: readonly string[],
  label: string,
): void {
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label}_prototype_invalid`);
  }

  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== expectedKeys.length
    || keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    throw new Error(`${label}_fields_invalid`);
  }

  const descriptors = Object.getOwnPropertyDescriptors(input);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set) {
      throw new Error(`${label}_accessor_invalid`);
    }
  }
}

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
  readonly inputClosed: boolean;
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
  spawn(request: TerminalBackendSpawnRequest): TerminalBackendSession;
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

  spawn(request: TerminalBackendSpawnRequest): TerminalBackendSession {
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      env: request.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return new ProcessPipesTerminalSession(child, this.descriptor);
  }
}

class ProcessPipesTerminalSession implements TerminalBackendSession {
  private readonly child: ChildProcessWithoutNullStreams;
  readonly descriptor: TerminalBackendDescriptor;

  constructor(child: ChildProcessWithoutNullStreams, descriptor: TerminalBackendDescriptor) {
    this.child = child;
    this.descriptor = descriptor;
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
  }

  get pid(): number | null {
    return this.child.pid ?? null;
  }

  get inputClosed(): boolean {
    return this.child.stdin.destroyed || this.child.stdin.writableEnded;
  }

  onStarted(listener: () => void): void {
    this.child.once("spawn", listener);
  }

  onOutput(listener: (stream: TerminalOutputStream, data: string) => void): void {
    this.child.stdout.on("data", (chunk: string) => listener("stdout", chunk));
    this.child.stderr.on("data", (chunk: string) => listener("stderr", chunk));
  }

  onError(listener: (error: Error) => void): void {
    this.child.once("error", listener);
  }

  onExit(listener: (result: TerminalBackendExit) => void): void {
    this.child.once("close", (exitCode, signal) => listener({ exitCode, signal }));
  }

  write(data: string): boolean {
    return this.child.stdin.write(data, "utf8");
  }

  waitForDrain(): Promise<void> {
    return new Promise<void>((resolvePromise, reject) => {
      const onDrain = () => {
        this.child.stdin.off("error", onError);
        resolvePromise();
      };
      const onError = (error: Error) => {
        this.child.stdin.off("drain", onDrain);
        reject(error);
      };
      this.child.stdin.once("drain", onDrain);
      this.child.stdin.once("error", onError);
    });
  }

  endInput(): void {
    this.child.stdin.end();
  }

  resize(_columns: number, _rows: number): void {
    throw new Error("terminal_resize_not_supported");
  }

  interrupt(_kind: TerminalInterrupt): void {
    throw new Error("terminal_interrupt_not_supported");
  }

  stop(force: boolean): boolean {
    return this.child.kill(force ? "SIGKILL" : "SIGTERM");
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

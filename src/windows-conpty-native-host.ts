import type { TerminalBackendSession, TerminalBackendSpawnRequest } from "./terminal-backend.ts";
import {
  createNativeWindowsConptyTerminalSession,
  type WindowsConptyHostCommand,
  type WindowsConptyHostEvent,
} from "./windows-conpty-backend.ts";

if (!process.connected || typeof process.send !== "function") {
  throw new Error("terminal_conpty_native_host_requires_ipc");
}

let session: TerminalBackendSession | null = null;
let initialized = false;
let closing = false;
let commandQueue = Promise.resolve();
let writeQueue = Promise.resolve();
let eventQueue = Promise.resolve();

process.on("message", (value) => {
  commandQueue = commandQueue
    .then(() => handleCommand(parseCommand(value)))
    .catch((error) => failHost(asError(error)));
});

process.once("disconnect", () => {
  if (closing) return;
  closing = true;
  try { session?.stop(true); } catch { /* parent loss still closes the host */ }
  scheduleForcedExit();
});

async function handleCommand(command: WindowsConptyHostCommand): Promise<void> {
  if (command.type === "initialize") {
    if (initialized) throw new Error("terminal_conpty_native_host_duplicate_initialize");
    initialized = true;
    session = createNativeWindowsConptyTerminalSession(command.request);
    session.onStarted(() => {
      const pid = session?.pid;
      if (!Number.isInteger(pid) || (pid ?? 0) <= 0) {
        void failHost(new Error("terminal_conpty_native_host_pid_invalid"));
        return;
      }
      queueEvent({ type: "started", pid: pid!, hostPid: process.pid });
    });
    session.onOutput((stream, data) => queueEvent({ type: "output", stream, data }));
    session.onError((error) => queueEvent({ type: "error", error: error.message }));
    session.onExit(({ exitCode, signal }) => closeHost({ type: "exit", exitCode, signal }));
    session.start();
    return;
  }

  const active = session;
  if (!active) throw new Error("terminal_conpty_native_host_not_initialized");
  if (command.type === "write") {
    writeQueue = writeQueue
      .then(async () => {
        if (!active.write(command.data)) await active.waitForDrain();
        queueEvent({ type: "write-complete", writeId: command.writeId });
      })
      .catch((error) => failHost(asError(error)));
    return;
  }
  if (command.type === "end-input") {
    active.endInput();
    return;
  }
  if (command.type === "resize") {
    active.resize(command.columns, command.rows);
    return;
  }
  if (command.type === "interrupt") {
    active.interrupt(command.kind);
    return;
  }
  if (!active.stop(command.force)) {
    throw new Error("terminal_conpty_native_host_stop_refused");
  }
}

function queueEvent(event: WindowsConptyHostEvent): void {
  eventQueue = eventQueue.then(() => sendEvent(event));
  eventQueue.catch(() => {
    if (!closing) {
      closing = true;
      try { session?.stop(true); } catch { /* IPC failure closes the process below */ }
      scheduleForcedExit();
    }
  });
}

function sendEvent(event: WindowsConptyHostEvent): Promise<void> {
  return new Promise<void>((resolvePromise, reject) => {
    if (!process.connected || typeof process.send !== "function") {
      reject(new Error("terminal_conpty_native_host_ipc_closed"));
      return;
    }
    process.send(event, (error) => error ? reject(error) : resolvePromise());
  });
}

function closeHost(event: Extract<WindowsConptyHostEvent, { type: "exit" }>): void {
  if (closing) return;
  closing = true;
  queueEvent(event);
  void eventQueue.then(
    () => disconnectHost(0),
    () => disconnectHost(1),
  );
}

function failHost(error: Error): void {
  if (closing) return;
  queueEvent({ type: "error", error: error.message });
  const stopAccepted = (() => {
    try { return session?.stop(true) ?? false; } catch { return false; }
  })();
  if (stopAccepted) {
    scheduleForcedExit();
    return;
  }
  closing = true;
  void eventQueue.then(
    () => disconnectHost(1),
    () => disconnectHost(1),
  );
}

function disconnectHost(exitCode: number): void {
  process.exitCode = exitCode;
  if (process.connected) process.disconnect();
}

function parseCommand(value: unknown): WindowsConptyHostCommand {
  if (!isPlainDataRecord(value) || typeof value.type !== "string") {
    throw new Error("terminal_conpty_native_host_command_invalid");
  }
  if (value.type === "initialize") {
    assertExactOwnDataKeys(value, ["type", "request"]);
    return { type: "initialize", request: parseSpawnRequest(value.request) };
  }
  if (value.type === "write") {
    assertExactOwnDataKeys(value, ["type", "writeId", "data"]);
    if (!Number.isSafeInteger(value.writeId) || (value.writeId as number) <= 0 || typeof value.data !== "string") {
      throw new Error("terminal_conpty_native_host_command_invalid");
    }
    return { type: "write", writeId: value.writeId as number, data: value.data };
  }
  if (value.type === "end-input") {
    assertExactOwnDataKeys(value, ["type"]);
    return { type: "end-input" };
  }
  if (value.type === "resize") {
    assertExactOwnDataKeys(value, ["type", "columns", "rows"]);
    if (!Number.isInteger(value.columns) || !Number.isInteger(value.rows)) {
      throw new Error("terminal_conpty_native_host_command_invalid");
    }
    return { type: "resize", columns: value.columns as number, rows: value.rows as number };
  }
  if (value.type === "interrupt") {
    assertExactOwnDataKeys(value, ["type", "kind"]);
    if (value.kind !== "ctrl-c" && value.kind !== "ctrl-break") {
      throw new Error("terminal_conpty_native_host_command_invalid");
    }
    return { type: "interrupt", kind: value.kind };
  }
  if (value.type === "stop") {
    assertExactOwnDataKeys(value, ["type", "force"]);
    if (typeof value.force !== "boolean") throw new Error("terminal_conpty_native_host_command_invalid");
    return { type: "stop", force: value.force };
  }
  throw new Error("terminal_conpty_native_host_command_invalid");
}

function parseSpawnRequest(value: unknown): TerminalBackendSpawnRequest {
  if (
    !isPlainDataRecord(value)
    || !hasExactOwnDataKeys(value, ["command", "args", "cwd", "env"])
    || typeof value.command !== "string"
    || !Array.isArray(value.args)
    || value.args.some((argument) => typeof argument !== "string")
    || typeof value.cwd !== "string"
    || !isPlainDataRecord(value.env)
    || Object.values(value.env).some((entry) => typeof entry !== "string")
  ) {
    throw new Error("terminal_conpty_native_host_request_invalid");
  }
  return {
    command: value.command,
    args: [...value.args] as string[],
    cwd: value.cwd,
    env: { ...value.env } as NodeJS.ProcessEnv,
  };
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

function assertExactOwnDataKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  if (!hasExactOwnDataKeys(value, expected)) {
    throw new Error("terminal_conpty_native_host_command_invalid");
  }
}

function scheduleForcedExit(): void {
  const timer = setTimeout(() => process.exit(1), 5_000);
  timer.unref();
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

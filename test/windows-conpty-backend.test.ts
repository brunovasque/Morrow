import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveTerminalPresentation } from "../src/terminal-backend.ts";
import { TerminalSessionManager, type TerminalSessionEvent } from "../src/terminal-session.ts";
import {
  createNativeWindowsConptyTerminalSession,
  inspectWindowsConptySupport,
  resolveWindowsPowerShellPath,
  WindowsConptyTerminalBackend,
} from "../src/windows-conpty-backend.ts";
import { LocalWorkspaceManager } from "../src/workspace-manager.ts";

const windowsConptyAvailable = inspectWindowsConptySupport().available;

test("native ConPTY session refuses use outside its isolated host entrypoint", () => {
  assert.throws(() => createNativeWindowsConptyTerminalSession({
    command: process.execPath,
    args: [],
    cwd: process.cwd(),
    env: {},
  }), /windows_conpty_native_session_requires_isolated_host/);
});

async function controlledWindowsEnvironment(workspaceRoot: string): Promise<Record<string, string>> {
  const profileRoot = join(workspaceRoot, ".morrow-test-profile");
  const appData = join(profileRoot, "AppData", "Roaming");
  const localAppData = join(profileRoot, "AppData", "Local");
  await mkdir(appData, { recursive: true });
  await mkdir(localAppData, { recursive: true });
  const environment: Record<string, string> = {
    HOME: profileRoot,
    USERPROFILE: profileRoot,
    APPDATA: appData,
    LOCALAPPDATA: localAppData,
    POWERSHELL_TELEMETRY_OPTOUT: "1",
  };
  for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP"] as const) {
    const value = process.env[key];
    if (value !== undefined) environment[key] = value;
  }
  environment.PSModulePath = resolve(
    environment.SystemRoot ?? environment.WINDIR ?? "C:\\Windows",
    "System32/WindowsPowerShell/v1.0/Modules",
  );
  return environment;
}

test("ConPTY support gate refuses platform, architecture, build and package drift", () => {
  const support = inspectWindowsConptySupport({
    platform: "linux",
    arch: "arm64",
    release: "10.0.17763",
    nodePtyVersion: "1.2.0-beta.15",
  });

  assert.equal(support.available, false);
  assert.deepEqual(support.reasons, [
    "platform_unsupported:linux",
    "architecture_unsupported:arm64",
    "windows_build_unsupported:17763",
    "node_pty_version_unsupported:1.2.0-beta.15",
  ]);
  assert.equal(Object.isFrozen(support), true);
  assert.equal(Object.isFrozen(support.reasons), true);
});

test("Windows ConPTY refuses concurrency above the measured MVO capacity", {
  skip: !windowsConptyAvailable,
}, () => {
  assert.throws(() => new TerminalSessionManager(join(tmpdir(), "morrow-unproven-conpty-capacity"), {
    backend: new WindowsConptyTerminalBackend(),
    maxConcurrentSessions: 3,
  }), /windows_conpty_max_concurrent_sessions_exceeded/);
});

test("simultaneous ConPTY exits use distinct native host processes", {
  skip: !windowsConptyAvailable,
  timeout: 20_000,
}, async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-conpty-host-isolation-"));
  const workspaceRoot = join(root, "managed-workspaces");
  const workspaces = new LocalWorkspaceManager(workspaceRoot);
  const firstWorkspace = await workspaces.create({ workspaceId: "W1", contractId: "C1", roleId: "executor" });
  const secondWorkspace = await workspaces.create({ workspaceId: "W2", contractId: "C1", roleId: "reviewer" });
  const terminals = new TerminalSessionManager(workspaceRoot, { backend: new WindowsConptyTerminalBackend() });
  const startEvents: Array<Extract<TerminalSessionEvent, { type: "TERMINAL_SESSION_STARTED" }>> = [];
  terminals.subscribe((event) => {
    if (event.type === "TERMINAL_SESSION_STARTED") startEvents.push(event);
  });
  const childScript = [
    "process.stdin.setEncoding('utf8')",
    "process.stdout.write('__MORROW_HOST_READY__\\n')",
    "process.stdin.once('data',()=>{process.stdout.write('__MORROW_HOST_EXIT__\\n');process.exit(0)})",
  ].join(";");
  const start = async (suffix: string, workspace: typeof firstWorkspace) => terminals.start({
    terminalSessionId: `T-${suffix}`,
    agentInstanceId: `A-${suffix}`,
    contractId: "C1",
    roleId: suffix === "one" ? "executor" : "reviewer",
    runtimeId: "native-host-isolation",
    accessMode: "local",
    workspaceId: workspace.workspaceId,
    workspace,
    command: process.execPath,
    args: ["-e", childScript],
    env: await controlledWindowsEnvironment(workspace.root),
    timeoutMs: 10_000,
  });
  const [first, second] = await Promise.all([
    start("one", firstWorkspace),
    start("two", secondWorkspace),
  ]);

  await Promise.all([
    terminals.write(first.terminalSessionId, "exit-now\r"),
    terminals.write(second.terminalSessionId, "exit-now\r"),
  ]);
  const results = await Promise.all([first.completion, second.completion]);

  assert.deepEqual(results.map((result) => result.status), ["completed", "completed"]);
  assert.equal(results.every((result) => result.stdout.includes("__MORROW_HOST_EXIT__")), true);
  assert.equal(startEvents.length, 2);
  const terminalPids = startEvents.map((event) => event.payload.pid);
  const hostPids = startEvents.map((event) => event.payload.backendHostPid);
  assert.equal(new Set(terminalPids).size, 2);
  assert.equal(new Set(hostPids).size, 2);
  assert.equal(hostPids.every((pid) => pid !== null && pid !== process.pid && !terminalPids.includes(pid)), true);
  assert.equal([...terminalPids, ...hostPids].every((pid) => pid !== null && !processIsAlive(pid)), true);
});

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test("native host termination is contained to its managed ConPTY tree", {
  skip: !windowsConptyAvailable,
  timeout: 20_000,
}, async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-conpty-host-crash-"));
  const workspaceRoot = join(root, "managed-workspaces");
  const workspaces = new LocalWorkspaceManager(workspaceRoot);
  const workspace = await workspaces.create({ workspaceId: "W1", contractId: "C1", roleId: "executor" });
  const terminals = new TerminalSessionManager(workspaceRoot, { backend: new WindowsConptyTerminalBackend() });
  let output = "";
  let startEvent: Extract<TerminalSessionEvent, { type: "TERMINAL_SESSION_STARTED" }> | null = null;
  terminals.subscribe((event) => {
    if (event.type === "TERMINAL_OUTPUT") output += event.payload.data;
    if (event.type === "TERMINAL_SESSION_STARTED") startEvent = event;
  });
  const childScript = [
    "const {spawn}=require('node:child_process')",
    "const child=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:'ignore',windowsHide:true})",
    "process.stdout.write('__MORROW_CRASH_TREE_'+child.pid+'__\\n')",
    "setInterval(()=>{},60000)",
  ].join(";");
  const handle = await terminals.start({
    terminalSessionId: "T-crash",
    agentInstanceId: "A-crash",
    contractId: "C1",
    roleId: "executor",
    runtimeId: "native-host-crash-containment",
    accessMode: "local",
    workspaceId: workspace.workspaceId,
    workspace,
    command: process.execPath,
    args: ["-e", childScript],
    env: await controlledWindowsEnvironment(workspace.root),
    timeoutMs: 15_000,
  });
  const markerDeadline = Date.now() + 8_000;
  while (!/__MORROW_CRASH_TREE_(\d+)__/.test(output)) {
    if (Date.now() >= markerDeadline) throw new Error(`host_crash_marker_timeout:${JSON.stringify(output)}`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  const descendantPid = Number.parseInt(output.match(/__MORROW_CRASH_TREE_(\d+)__/)![1], 10);
  assert.ok(startEvent);
  const terminalPid = startEvent.payload.pid;
  const hostPid = startEvent.payload.backendHostPid;
  assert.ok(terminalPid && hostPid);
  process.kill(hostPid);

  const result = await handle.completion;
  assert.equal(result.status, "failed");
  assert.match(result.error ?? "", /terminal_conpty_host_exited/);
  const cleanupDeadline = Date.now() + 5_000;
  while ([terminalPid, hostPid, descendantPid].some(processIsAlive) && Date.now() < cleanupDeadline) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  assert.equal([terminalPid, hostPid, descendantPid].every((pid) => !processIsAlive(pid)), true);
});

test("real Windows ConPTY preserves state, terminal bytes, resize and both interrupts", {
  skip: !windowsConptyAvailable,
  timeout: 30_000,
}, async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-real-conpty-"));
  const workspaceRoot = join(root, "managed-workspaces");
  const workspaces = new LocalWorkspaceManager(workspaceRoot);
  const workspace = await workspaces.create({
    workspaceId: "W1",
    contractId: "C1",
    roleId: "executor",
  });
  const signalSource = join(workspace.root, "signal-fixture.cs");
  const signalExecutable = join(workspace.root, "signal-fixture.exe");
  const powershellPath = resolveWindowsPowerShellPath();
  const environment = await controlledWindowsEnvironment(workspace.root);
  await writeFile(signalSource, String.raw`
using System;
using System.Threading;
public static class MorrowSignalProbe
{
    private static readonly ManualResetEvent Received = new ManualResetEvent(false);
    public static int Main()
    {
        Console.CancelKeyPress += OnCancel;
        Console.WriteLine("__MORROW_SIGNAL_READY__");
        if (!Received.WaitOne(8000)) return 2;
        Console.CancelKeyPress -= OnCancel;
        return 0;
    }
    private static void OnCancel(object sender, ConsoleCancelEventArgs eventArgs)
    {
        Console.WriteLine("__MORROW_SIGNAL_{0}__", eventArgs.SpecialKey);
        eventArgs.Cancel = true;
        Received.Set();
    }
}
`, "utf8");
  const escapedSource = signalSource.replaceAll("'", "''");
  const escapedExecutable = signalExecutable.replaceAll("'", "''");
  await new Promise<void>((resolvePromise, reject) => {
    execFile(
      powershellPath,
      [
        "-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
        `Add-Type -Path '${escapedSource}' -OutputAssembly '${escapedExecutable}' -OutputType ConsoleApplication`,
      ],
      { cwd: workspace.root, env: environment, windowsHide: true },
      (error, _stdout, stderr) => error
        ? reject(new Error(`signal_fixture_compile_failed:${stderr}`, { cause: error }))
        : resolvePromise(),
    );
  });

  const backend = new WindowsConptyTerminalBackend();
  assert.deepEqual(resolveTerminalPresentation(backend.descriptor), {
    mode: "full-terminal",
    fullTerminal: true,
    missing: [],
  });
  assert.equal(
    backend.descriptor.implementationId,
    "node-pty-1.1.0-system-conpty-job-process-host-v3",
  );

  const terminals = new TerminalSessionManager(workspaceRoot, { backend });
  const events: TerminalSessionEvent[] = [];
  let output = "";
  terminals.subscribe((event) => {
    events.push(event);
    if (event.type === "TERMINAL_OUTPUT") output += event.payload.data;
  });
  const handle = await terminals.start({
    terminalSessionId: "T1",
    agentInstanceId: "A1",
    contractId: "C1",
    roleId: "executor",
    runtimeId: "powershell-conpty",
    accessMode: "local",
    workspaceId: "W1",
    workspace,
    command: powershellPath,
    args: ["-NoLogo", "-NoProfile", "-NoExit"],
    env: environment,
    timeoutMs: 25_000,
  });

  const markerCount = (marker: string) => output.split(marker).length - 1;
  const waitForCount = async (marker: string, expected: number, timeoutMs = 8_000) => {
    const deadline = Date.now() + timeoutMs;
    while (markerCount(marker) < expected) {
      if (Date.now() >= deadline) {
        throw new Error(`marker_timeout:${marker}:${expected}:${JSON.stringify(output.slice(-1_000))}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
  const line = (command: string) => terminals.write("T1", `${command}\r`);

  try {
    await line("$morrowState = 'estado-á-ç'; [Console]::WriteLine('__MORROW_STATE_SET__')");
    await waitForCount("__MORROW_STATE_SET__", 1);
    await line("[Console]::WriteLine('__MORROW_STATE_' + $morrowState + '__')");
    await waitForCount("__MORROW_STATE_estado-á-ç__", 1);

    await line("[Console]::Write([char]27 + '[31m__MORROW_VT__' + [char]27 + '[0m')");
    const vtDeadline = Date.now() + 8_000;
    while (!/\u001b\[31m(?:\r\n)?__MORROW_VT__/.test(output)) {
      if (Date.now() >= vtDeadline) {
        throw new Error(`vt_marker_timeout:${JSON.stringify(output.slice(-1_000))}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    terminals.resize("T1", 101, 37);
    await line("[Console]::WriteLine('__MORROW_SIZE_' + [Console]::WindowWidth + 'x' + [Console]::WindowHeight + '__')");
    await waitForCount("__MORROW_SIZE_101x37__", 1);

    await line("[Console]::WriteLine('__MORROW_DRAINED_TAIL__'); exit 7");
    const result = await handle.completion;

    assert.equal(result.status, "failed");
    assert.equal(result.exitCode, 7);
    assert.equal(result.backend, "windows-conpty");
    assert.equal(result.terminalProtocol, "conpty-vt");
    assert.equal(result.presentation.mode, "full-terminal");
    assert.ok(result.stdout.includes("__MORROW_DRAINED_TAIL__"));
    assert.equal(result.stderr, "");
    assert.equal(events.some((event) => event.type === "TERMINAL_SESSION_FAILED"), false);
    assert.equal(
      events.filter((event) => event.type === "TERMINAL_OUTPUT")
        .every((event) => event.type === "TERMINAL_OUTPUT" && event.payload.stream === "terminal"),
      true,
    );

    const runSignalProbe = async (kind: "ctrl-c" | "ctrl-break", suffix: string, marker: string) => {
      const readyCount = markerCount("__MORROW_SIGNAL_READY__");
      const signalHandle = await terminals.start({
        terminalSessionId: `T-signal-${suffix}`,
        agentInstanceId: `A-signal-${suffix}`,
        contractId: "C1",
        roleId: "executor",
        runtimeId: "signal-conpty",
        accessMode: "local",
        workspaceId: "W1",
        workspace,
        command: signalExecutable,
        args: [],
        env: environment,
        timeoutMs: 10_000,
      });
      try {
        await waitForCount("__MORROW_SIGNAL_READY__", readyCount + 1);
        terminals.interrupt(signalHandle.terminalSessionId, kind);
        await waitForCount(marker, 1);
        const signalResult = await signalHandle.completion;
        assert.equal(signalResult.status, "completed");
        assert.equal(signalResult.exitCode, 0);
      } finally {
        terminals.stop(signalHandle.terminalSessionId);
      }
    };

    await runSignalProbe("ctrl-c", "ctrl-c", "__MORROW_SIGNAL_ControlC__");
    await runSignalProbe("ctrl-break", "ctrl-break", "__MORROW_SIGNAL_ControlBreak__");
    assert.deepEqual(
      events.filter((event) => event.type === "TERMINAL_INTERRUPT_REQUESTED")
        .map((event) => event.type === "TERMINAL_INTERRUPT_REQUESTED" && event.payload.kind),
      ["ctrl-c", "ctrl-break"],
    );
    const startEvents = events.filter((event) => event.type === "TERMINAL_SESSION_STARTED");
    assert.equal(startEvents.length, 3);
    assert.equal(startEvents.every((event) => (
      event.type === "TERMINAL_SESSION_STARTED"
      && Number.isInteger(event.payload.backendHostPid)
      && (event.payload.backendHostPid ?? 0) > 0
      && event.payload.backendHostPid !== event.payload.pid
    )), true);
  } finally {
    terminals.stop(handle.terminalSessionId);
  }
});

test("ConPTY child exits after natural drainage and forced stop without a live worker handle", {
  skip: !windowsConptyAvailable,
  timeout: 20_000,
}, async () => {
  const fixturePath = fileURLToPath(new URL("./fixtures/windows-conpty-lifecycle-child.ts", import.meta.url));
  const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(
      process.execPath,
      ["--experimental-strip-types", fixturePath],
      { cwd: process.cwd(), timeout: 12_000, windowsHide: true },
      (error, stdout, stderr) => error ? reject(new Error(`conpty_lifecycle_child_failed:${stderr}`, { cause: error })) : resolve({ stdout, stderr }),
    );
  });
  const proof = JSON.parse(result.stdout.trim()) as {
    naturalExitCode: number;
    drainedTail: boolean;
    drainedBytes: number;
    stoppedPid: number;
    descendantPid: number;
  };
  assert.equal(result.stderr, "");
  assert.equal(proof.naturalExitCode, 7);
  assert.equal(proof.drainedTail, true);
  assert.equal(proof.drainedBytes, 512 * 1_024);
  assert.ok(proof.stoppedPid > 0);
  assert.ok(proof.descendantPid > 0);
  const descendantAlive = await new Promise<boolean>((resolve, reject) => {
    execFile(
      "pwsh.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", `(Get-Process -Id ${proof.descendantPid} -ErrorAction SilentlyContinue) -ne $null`],
      { windowsHide: true },
      (error, stdout, stderr) => error ? reject(new Error(`descendant_liveness_probe_failed:${stderr}`, { cause: error })) : resolve(stdout.trim() === "True"),
    );
  });
  assert.equal(descendantAlive, false);
});

test("ConPTY accepts input before a silent child emits its first byte", {
  skip: !windowsConptyAvailable,
  timeout: 15_000,
}, async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-silent-conpty-"));
  const workspaceRoot = join(root, "managed-workspaces");
  const workspaces = new LocalWorkspaceManager(workspaceRoot);
  const workspace = await workspaces.create({ workspaceId: "W1", contractId: "C1", roleId: "executor" });
  const terminals = new TerminalSessionManager(workspaceRoot, { backend: new WindowsConptyTerminalBackend() });
  const handle = await terminals.start({
    terminalSessionId: "T-silent",
    agentInstanceId: "A-silent",
    contractId: "C1",
    roleId: "executor",
    runtimeId: "silent-node-conpty",
    accessMode: "local",
    workspaceId: "W1",
    workspace,
    command: process.execPath,
    args: ["-e", "process.stdin.setEncoding('utf8');process.stdin.once('data',d=>{process.stdout.write('__SILENT_INPUT_'+d.trim()+'__');process.exit(0)})"],
    env: await controlledWindowsEnvironment(workspace.root),
    timeoutMs: 10_000,
  });
  await terminals.write(handle.terminalSessionId, "arrived-before-output\r");
  const result = await handle.completion;
  assert.equal(result.status, "completed");
  assert.ok(result.stdout.includes("__SILENT_INPUT_arrived-before-output__"));
});

test("an immediate stop cannot release the governed command during startup", {
  skip: !windowsConptyAvailable,
  timeout: 15_000,
}, async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-stopped-startup-conpty-"));
  const workspaceRoot = join(root, "managed-workspaces");
  const workspaces = new LocalWorkspaceManager(workspaceRoot);
  const workspace = await workspaces.create({ workspaceId: "W1", contractId: "C1", roleId: "executor" });
  const terminals = new TerminalSessionManager(workspaceRoot, { backend: new WindowsConptyTerminalBackend() });
  const handle = await terminals.start({
    terminalSessionId: "T-stop-startup",
    agentInstanceId: "A-stop-startup",
    contractId: "C1",
    roleId: "executor",
    runtimeId: "stopped-startup-conpty",
    accessMode: "local",
    workspaceId: "W1",
    workspace,
    command: process.execPath,
    args: ["-e", "process.stdout.write('__COMMAND_MUST_NOT_RUN__')"],
    env: await controlledWindowsEnvironment(workspace.root),
    timeoutMs: 10_000,
  });
  assert.equal(terminals.stop(handle.terminalSessionId), true);
  const result = await handle.completion;
  assert.equal(result.status, "stopped");
  assert.equal(result.stdout.includes("__COMMAND_MUST_NOT_RUN__"), false);
});

test("real Windows ConPTY multiplexes sessions and cleans timeout, cancel and descendants", {
  skip: !windowsConptyAvailable,
  timeout: 45_000,
}, async () => {
  const probePath = fileURLToPath(new URL("../src/probes/conpty-multiplex.ts", import.meta.url));
  const result = await new Promise<{ stdout: string; stderr: string }>((resolvePromise, reject) => {
    execFile(
      process.execPath,
      ["--experimental-strip-types", probePath],
      { cwd: process.cwd(), timeout: 40_000, windowsHide: true },
      (error, stdout, stderr) => error
        ? reject(new Error(`conpty_multiplex_probe_failed:${stderr}`, { cause: error }))
        : resolvePromise({ stdout, stderr }),
    );
  });
  assert.equal(result.stderr, "");
  const proof = JSON.parse(result.stdout.trim()) as {
    ok: boolean;
    rounds: number;
    sessions: number;
    completed: number;
    timedOut: number;
    stopped: number;
    collisionRefusals: number;
    distinctRootPids: number;
    distinctDescendantPids: number;
    distinctNativeHostPids: number;
    identityBoundEvents: number;
    inputIsolation: boolean;
    noOrphans: boolean;
    fixtureRemoved: boolean;
  };
  assert.deepEqual(proof, {
    ok: true,
    rounds: 3,
    sessions: 12,
    completed: 6,
    timedOut: 3,
    stopped: 3,
    collisionRefusals: 12,
    distinctRootPids: 12,
    distinctDescendantPids: 12,
    distinctNativeHostPids: 12,
    identityBoundEvents: proof.identityBoundEvents,
    inputIsolation: true,
    noOrphans: true,
    fixtureRemoved: true,
  });
  assert.ok(proof.identityBoundEvents >= 48);
});

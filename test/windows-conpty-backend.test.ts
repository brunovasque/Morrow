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
  inspectWindowsConptySupport,
  resolveWindowsPowerShellPath,
  WindowsConptyTerminalBackend,
} from "../src/windows-conpty-backend.ts";
import { LocalWorkspaceManager } from "../src/workspace-manager.ts";

const windowsConptyAvailable = inspectWindowsConptySupport().available;

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

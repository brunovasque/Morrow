import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveTerminalPresentation } from "../src/terminal-backend.ts";
import { TerminalSessionManager, type TerminalSessionEvent } from "../src/terminal-session.ts";
import {
  inspectWindowsConptySupport,
  WindowsConptyTerminalBackend,
} from "../src/windows-conpty-backend.ts";
import { LocalWorkspaceManager } from "../src/workspace-manager.ts";

const windowsConptyAvailable = inspectWindowsConptySupport().available;

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
  const signalFixture = join(workspace.root, "signal-fixture.ps1");
  await writeFile(signalFixture, String.raw`
Add-Type -TypeDefinition @'
using System;
using System.Threading;
public static class MorrowSignalProbe
{
    private static volatile bool _received;
    public static void Run()
    {
        _received = false;
        Console.CancelKeyPress += OnCancel;
        Console.WriteLine("__MORROW_SIGNAL_READY__");
        while (!_received) Thread.Sleep(20);
        Console.CancelKeyPress -= OnCancel;
    }
    private static void OnCancel(object sender, ConsoleCancelEventArgs eventArgs)
    {
        Console.WriteLine("__MORROW_SIGNAL_{0}__", eventArgs.SpecialKey);
        eventArgs.Cancel = true;
        _received = true;
    }
}
'@
[MorrowSignalProbe]::Run()
`, "utf8");

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
    command: "pwsh.exe",
    args: ["-NoLogo", "-NoProfile", "-NoExit"],
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
    await waitForCount("\u001b[31m\r\n__MORROW_VT__", 1);

    terminals.resize("T1", 101, 37);
    await line("[Console]::WriteLine('__MORROW_SIZE_' + [Console]::WindowWidth + 'x' + [Console]::WindowHeight + '__')");
    await waitForCount("__MORROW_SIZE_101x37__", 1);

    const escapedFixture = signalFixture.replaceAll("'", "''");
    await line(`& pwsh.exe -NoLogo -NoProfile -File '${escapedFixture}'`);
    await waitForCount("__MORROW_SIGNAL_READY__", 1);
    terminals.interrupt("T1", "ctrl-c");
    await waitForCount("__MORROW_SIGNAL_ControlC__", 1);

    await new Promise((resolve) => setTimeout(resolve, 150));
    await line(`& pwsh.exe -NoLogo -NoProfile -File '${escapedFixture}'`);
    await waitForCount("__MORROW_SIGNAL_READY__", 2);
    terminals.interrupt("T1", "ctrl-break");
    await waitForCount("__MORROW_SIGNAL_ControlBreak__", 1);

    await new Promise((resolve) => setTimeout(resolve, 300));
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
    stoppedPid: number;
    descendantPid: number;
  };
  assert.equal(result.stderr, "");
  assert.equal(proof.naturalExitCode, 7);
  assert.equal(proof.drainedTail, true);
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
    timeoutMs: 10_000,
  });
  await terminals.write(handle.terminalSessionId, "arrived-before-output\r");
  const result = await handle.completion;
  assert.equal(result.status, "completed");
  assert.ok(result.stdout.includes("__SILENT_INPUT_arrived-before-output__"));
});

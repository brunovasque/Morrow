import { WindowsConptyTerminalBackend } from "../../src/windows-conpty-backend.ts";

const backend = new WindowsConptyTerminalBackend();

async function runNaturalExit(): Promise<{ exitCode: number | null; output: string }> {
  const session = backend.create({
    command: "pwsh.exe",
    args: [
      "-NoLogo",
      "-NoProfile",
      "-Command",
      "[Console]::WriteLine('__MORROW_CHILD_DRAINED__'); exit 7",
    ],
    cwd: process.cwd(),
    env: process.env,
  });
  let output = "";
  let cleanupError: Error | undefined;
  const exited = new Promise<{ exitCode: number | null }>((resolve) => {
    session.onStarted(() => {});
    session.onOutput((_stream, data) => { output += data; });
    session.onError((error) => { cleanupError = error; });
    session.onExit(({ exitCode }) => resolve({ exitCode }));
  });
  session.start();
  const result = await exited;
  if (cleanupError) throw cleanupError;
  return { ...result, output };
}

async function runForcedStop(): Promise<{ pid: number | null; descendantPid: number }> {
  const session = backend.create({
    command: "pwsh.exe",
    args: ["-NoLogo", "-NoProfile", "-NoExit"],
    cwd: process.cwd(),
    env: process.env,
  });
  let pid: number | null = null;
  let output = "";
  const started = new Promise<void>((resolve) => {
    session.onStarted(() => {
      pid = session.pid;
      resolve();
    });
    session.onOutput((_stream, data) => { output += data; });
    session.onError((error) => { throw error; });
  });
  const exited = new Promise<void>((resolve) => session.onExit(() => resolve()));
  session.start();
  await started;
  session.write("$child = Start-Process pwsh.exe -ArgumentList '-NoLogo','-NoProfile','-Command','Start-Sleep -Seconds 60' -NoNewWindow -PassThru; [Console]::WriteLine('__MORROW_DESCENDANT_' + $child.Id + '__')\r");
  const deadline = Date.now() + 5_000;
  let match: RegExpMatchArray | null = null;
  while (!(match = output.match(/__MORROW_DESCENDANT_(\d+)__/))) {
    if (Date.now() >= deadline) throw new Error(`conpty_descendant_marker_timeout:${output.slice(-500)}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (!session.stop(true)) throw new Error("conpty_force_stop_refused");
  await exited;
  return { pid, descendantPid: Number.parseInt(match[1], 10) };
}

const natural = await runNaturalExit();
if (natural.exitCode !== 7 || !natural.output.includes("__MORROW_CHILD_DRAINED__")) {
  throw new Error(`conpty_natural_exit_failed:${JSON.stringify(natural)}`);
}
const stopped = await runForcedStop();

process.stdout.write(JSON.stringify({
  naturalExitCode: natural.exitCode,
  drainedTail: true,
  stoppedPid: stopped.pid,
  descendantPid: stopped.descendantPid,
}) + "\n");

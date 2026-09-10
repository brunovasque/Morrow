import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { WindowsConptyTerminalBackend } from "../../src/windows-conpty-backend.ts";

const backend = new WindowsConptyTerminalBackend();
const fixtureRoot = await mkdtemp(join(tmpdir(), "morrow-conpty-lifecycle-"));
const workspaceRoot = join(fixtureRoot, "workspace");
await mkdir(workspaceRoot, { recursive: true });

const environment: NodeJS.ProcessEnv = {
  HOME: join(workspaceRoot, ".morrow-test-profile"),
  USERPROFILE: join(workspaceRoot, ".morrow-test-profile"),
  APPDATA: join(workspaceRoot, ".morrow-test-profile", "AppData", "Roaming"),
  LOCALAPPDATA: join(workspaceRoot, ".morrow-test-profile", "AppData", "Local"),
};
for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP"] as const) {
  const value = process.env[key];
  if (value !== undefined) environment[key] = value;
}
environment.PSModulePath = resolve(
  environment.SystemRoot ?? environment.WINDIR ?? "C:\\Windows",
  "System32/WindowsPowerShell/v1.0/Modules",
);

async function runNaturalExit(): Promise<{ exitCode: number | null; output: string }> {
  const tailBytes = 512 * 1_024;
  const session = backend.create({
    command: process.execPath,
    args: [
      "-e",
      `process.stdout.write("~".repeat(${tailBytes})+"__MORROW_CHILD_DRAINED__");process.exitCode=7`,
    ],
    cwd: workspaceRoot,
    env: environment,
  });
  let output = "";
  let cleanupError: Error | undefined;
  const exited = new Promise<{ exitCode: number | null }>((resolvePromise) => {
    session.onStarted(() => {});
    session.onOutput((_stream, data) => { output += data; });
    session.onError((error) => { cleanupError = error; });
    session.onExit(({ exitCode }) => resolvePromise({ exitCode }));
  });
  session.start();
  const result = await exited;
  if (cleanupError) throw cleanupError;
  return { ...result, output };
}

async function runForcedStop(): Promise<{ pid: number | null; descendantPid: number }> {
  const descendantScript = "setTimeout(()=>{},60000)";
  const rootScript = [
    "const {spawn}=require('node:child_process')",
    `const child=spawn(process.execPath,['-e',${JSON.stringify(descendantScript)}],{stdio:'ignore',windowsHide:true})`,
    "process.stdout.write('__MORROW_DESCENDANT_'+child.pid+'__')",
    "setTimeout(()=>{},60000)",
  ].join(";");
  const session = backend.create({
    command: process.execPath,
    args: ["-e", rootScript],
    cwd: workspaceRoot,
    env: environment,
  });
  let pid: number | null = null;
  let output = "";
  let sessionError: Error | undefined;
  const started = new Promise<void>((resolvePromise) => {
    session.onStarted(() => {
      pid = session.pid;
      resolvePromise();
    });
    session.onOutput((_stream, data) => { output += data; });
    session.onError((error) => { sessionError = error; });
  });
  const exited = new Promise<void>((resolvePromise) => session.onExit(() => resolvePromise()));
  session.start();
  await started;
  const deadline = Date.now() + 5_000;
  let match: RegExpMatchArray | null = null;
  while (!(match = output.match(/__MORROW_DESCENDANT_(\d+)__/))) {
    if (sessionError) throw sessionError;
    if (Date.now() >= deadline) throw new Error(`conpty_descendant_marker_timeout:${output.slice(-500)}`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  if (!session.stop(true)) throw new Error("conpty_force_stop_refused");
  await exited;
  if (sessionError) throw sessionError;
  return { pid, descendantPid: Number.parseInt(match[1], 10) };
}

try {
  const natural = await runNaturalExit();
  const expectedTailBytes = 512 * 1_024;
  if (
    natural.exitCode !== 7
    || !natural.output.includes("__MORROW_CHILD_DRAINED__")
    || natural.output.split("~").length - 1 !== expectedTailBytes
  ) {
    throw new Error(`conpty_natural_exit_failed:${JSON.stringify({
      exitCode: natural.exitCode,
      outputLength: natural.output.length,
      drainedTail: natural.output.includes("__MORROW_CHILD_DRAINED__"),
    })}`);
  }
  const stopped = await runForcedStop();

  process.stdout.write(JSON.stringify({
    naturalExitCode: natural.exitCode,
    drainedTail: true,
    drainedBytes: natural.output.split("~").length - 1,
    stoppedPid: stopped.pid,
    descendantPid: stopped.descendantPid,
  }) + "\n");
} finally {
  const tempRoot = resolve(tmpdir());
  const fixturePath = resolve(fixtureRoot);
  const rel = relative(tempRoot, fixturePath);
  if (!isAbsolute(tempRoot) || rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("conpty_fixture_cleanup_scope_invalid");
  }
  await rm(fixturePath, { recursive: true, force: true });
}

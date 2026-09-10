import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildCodexConptyReadOnlyArgs,
  buildCodexQuotaTerminalEnvironment,
  CodexQuotaConptyAdapter,
  normalizeCodexTerminalText,
} from "../src/codex-conpty-adapter.ts";
import { TerminalSessionManager, type TerminalSessionEvent } from "../src/terminal-session.ts";
import { WindowsConptyTerminalBackend } from "../src/windows-conpty-backend.ts";
import { LocalWorkspaceManager } from "../src/workspace-manager.ts";

async function fixture(
  authenticated = true,
  authenticationText = authenticated ? "Logged in using ChatGPT\n" : "Not logged in\n",
  authenticationExitCode = authenticated ? 0 : 1,
) {
  const root = await mkdtemp(join(tmpdir(), "morrow-codex-conpty-fixture-"));
  const managedRoot = join(root, "managed-workspaces");
  const shimRoot = join(root, "shim");
  const scriptRoot = join(shimRoot, "node_modules", "fixture", "bin");
  await mkdir(scriptRoot, { recursive: true });
  const script = join(scriptRoot, "codex-fixture.js");
  await writeFile(script, `
const args = process.argv.slice(2);
if (args[0] === "login" && args[1] === "status") {
  process.stdout.write(${JSON.stringify(authenticationText)});
  process.exit(${authenticationExitCode});
}
if (args[0] !== "exec") process.exit(9);
if (args.at(-2) !== "--") process.exit(8);
const prompt = args.at(-1);
{
  process.stdout.write([
    "OpenAI Codex vOpenAI Codex v0.0.0-fixture",
    "--------",
    "workdir: " + process.cwd(),
    "model: gpt-fixture",
    "provider: openai",
    "approval: never",
    "sandbox: read-only",
    "reasoning effort: high",
    "canary: " + (process.env.MORROW_SECRET_CANARY ?? "absent"),
    "--------",
    "user",
    "prompt: " + prompt,
    "__MORROW_CODEX_EARLY__",
  ].join("\\n"));
  setTimeout(() => process.stdout.write("\\nprovider: hostile-output-must-not-override-header\\n__MORROW_CODEX_DONE__\\n"), 100);
}
`, "utf8");
  await writeFile(
    join(shimRoot, "codex-fixture.cmd"),
    '@ECHO off\r\n"%~dp0\\node_modules\\fixture\\bin\\codex-fixture.js" %*\r\n',
    "utf8",
  );
  const workspaces = new LocalWorkspaceManager(managedRoot);
  const workspace = await workspaces.create({
    workspaceId: "W-codex",
    contractId: "C-codex",
    roleId: "executor",
  });
  const environment: NodeJS.ProcessEnv = {
    Path: shimRoot,
    MORROW_SECRET_CANARY: "operator-secret-must-not-cross",
    HOME: join(root, "controlled-profile"),
    USERPROFILE: join(root, "controlled-profile"),
    APPDATA: join(root, "controlled-profile", "AppData", "Roaming"),
    LOCALAPPDATA: join(root, "controlled-profile", "AppData", "Local"),
  };
  for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP"] as const) {
    const value = process.env[key];
    if (value !== undefined) environment[key] = value;
  }
  return { root, managedRoot, workspace, environment };
}

test("builds a fixed read-only redacted transport and a minimal quota environment", () => {
  assert.deepEqual(buildCodexConptyReadOnlyArgs("controlled-prompt"), [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--",
    "controlled-prompt",
  ]);
  const environment = buildCodexQuotaTerminalEnvironment({
    Path: "controlled-path",
    USERPROFILE: "controlled-profile",
    MORROW_SECRET_CANARY: "must-not-cross",
  });
  assert.deepEqual(environment, {
    USERPROFILE: "controlled-profile",
    Path: "controlled-path",
    NO_COLOR: "1",
  });
  assert.throws(
    () => buildCodexQuotaTerminalEnvironment({ OPENAI_API_KEY: "forbidden" }),
    /codex_quota_environment_unsafe:OPENAI_API_KEY/,
  );
  assert.throws(
    () => buildCodexQuotaTerminalEnvironment({ openai_base_url: "https://forbidden.invalid" }),
    /codex_quota_environment_unsafe:OPENAI_BASE_URL/,
  );
  assert.equal(
    normalizeCodexTerminalText("workdir: C:\\controlled\\long\r\n\\workspace\u001b[0m")
      .replace(/\s/g, ""),
    "workdir:C:\\controlled\\long\\workspace",
  );
});

test("runs a quota fixture through managed ConPTY with live output and bound metadata", async () => {
  const { root, managedRoot, workspace, environment } = await fixture();
  try {
    const terminals = new TerminalSessionManager(managedRoot, {
      backend: new WindowsConptyTerminalBackend(),
    });
    const adapter = new CodexQuotaConptyAdapter(terminals, {
      command: "codex-fixture",
      environment,
    });
    environment.Path = join(root, "mutated-path-must-not-rebind-runtime");
    environment.OPENAI_API_KEY = "late-mutation-must-not-cross";
    const events: TerminalSessionEvent[] = [];
    let resolveEarly!: () => void;
    const earlyOutput = new Promise<void>((resolvePromise) => { resolveEarly = resolvePromise; });
    terminals.subscribe((event) => {
      events.push(event);
      if (
        event.terminalSessionId === "T-codex"
        && event.type === "TERMINAL_OUTPUT"
        && event.payload.data.includes("__MORROW_CODEX_EARLY__")
      ) resolveEarly();
    });
    let settled = false;
    const mutableInvocation = {
      invocationId: "I-codex",
      terminalSessionId: "T-codex",
      agentInstanceId: "A-codex",
      contractId: "C-codex",
      roleId: "executor",
      runtimeId: "codex-fixture-runtime",
      workspaceId: "W-codex",
      workspace,
      prompt: "MORROW_PROMPT_NOT_IN_START_EVENT",
      timeoutMs: 10_000,
    };
    const invocation = adapter.invoke(mutableInvocation).finally(() => { settled = true; });
    mutableInvocation.terminalSessionId = "T-mutated-must-not-rebind";
    mutableInvocation.agentInstanceId = "A-mutated-must-not-rebind";
    mutableInvocation.workspaceId = "W-mutated-must-not-rebind";
    mutableInvocation.prompt = "MUTATED_PROMPT_MUST_NOT_REACH_PROCESS";

    await earlyOutput;
    assert.equal(settled, false);
    const result = await invocation;
    assert.equal(result.exitCode, 0);
    assert.equal(result.timedOut, false);
    assert.equal(result.accessMode, "quota-session");
    assert.equal(result.runtimeId, "codex-fixture-runtime");
    assert.equal(result.model, "gpt-fixture");
    assert.equal(result.provider, "openai");
    assert.equal(result.approval, "never");
    assert.equal(result.sandbox, "read-only");
    assert.equal(result.reasoningEffort, "high");
    assert.equal(result.cliVersion, "0.0.0-fixture");
    assert.equal(result.backend, "windows-conpty");
    assert.equal(result.terminalProtocol, "conpty-vt");
    assert.equal(result.presentation.fullTerminal, true);
    assert.equal(result.terminalSessionId, "T-codex");
    assert.equal(result.agentInstanceId, "A-codex");
    assert.equal(result.workspaceId, workspace.workspaceId);
    assert.match(result.stdout, /MORROW_PROMPT_NOT_IN_START_EVENT/);
    assert.doesNotMatch(result.stdout, /MUTATED_PROMPT_MUST_NOT_REACH_PROCESS/);
    assert.match(result.stdout, /canary: absent/);
    assert.match(result.stdout, /__MORROW_CODEX_DONE__/);
    assert.ok(events.some((event) => event.terminalSessionId === "T-codex-auth"));
    const startEvent = events.find((event) => (
      event.terminalSessionId === "T-codex" && event.type === "TERMINAL_SESSION_STARTED"
    ));
    assert.ok(startEvent);
    assert.equal(JSON.stringify(startEvent).includes("MORROW_PROMPT_NOT_IN_START_EVENT"), false);
    assert.ok(startEvent.type === "TERMINAL_SESSION_STARTED");
    assert.equal(startEvent.payload.args.at(-1), "[REDACTED]");
    assert.equal(events.some((event) => (
      event.terminalSessionId === "T-codex" && event.type === "TERMINAL_INPUT_WRITTEN"
    )), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses API environment before opening a terminal", async () => {
  const { root, managedRoot, workspace } = await fixture();
  try {
    const terminals = new TerminalSessionManager(managedRoot, {
      backend: new WindowsConptyTerminalBackend(),
    });
    assert.throws(() => new CodexQuotaConptyAdapter(terminals, {
      command: "codex-fixture",
      environment: { OPENAI_API_KEY: "forbidden" },
    }), /codex_quota_environment_unsafe:OPENAI_API_KEY/);
    assert.equal(terminals.list().length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses a prompt that cannot fit the ConPTY launch envelope before authentication", async () => {
  const { root, managedRoot, workspace, environment } = await fixture();
  try {
    const terminals = new TerminalSessionManager(managedRoot, {
      backend: new WindowsConptyTerminalBackend(),
    });
    const adapter = new CodexQuotaConptyAdapter(terminals, {
      command: "codex-fixture",
      environment,
    });
    await assert.rejects(adapter.invoke({
      invocationId: "I-oversized",
      terminalSessionId: "T-oversized",
      agentInstanceId: "A-oversized",
      contractId: "C-codex",
      roleId: "executor",
      runtimeId: "codex-fixture-runtime",
      workspaceId: "W-codex",
      workspace,
      prompt: "x".repeat(30_000),
      timeoutMs: 10_000,
    }), /terminal_launch_spec_too_large/);
    assert.equal(terminals.list().length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses missing or negatively worded ChatGPT authentication before the agent invocation", async () => {
  const { root, managedRoot, workspace, environment } = await fixture(
    false,
    "Not logged in using ChatGPT\n",
    0,
  );
  try {
    const terminals = new TerminalSessionManager(managedRoot, {
      backend: new WindowsConptyTerminalBackend(),
    });
    const adapter = new CodexQuotaConptyAdapter(terminals, {
      command: "codex-fixture",
      environment,
    });
    await assert.rejects(adapter.invoke({
      invocationId: "I-auth",
      terminalSessionId: "T-auth",
      agentInstanceId: "A-auth",
      contractId: "C-codex",
      roleId: "executor",
      runtimeId: "codex-fixture-runtime",
      workspaceId: "W-codex",
      workspace,
      prompt: "must not run",
      timeoutMs: 10_000,
    }), /codex_quota_auth_not_confirmed/);
    assert.equal(terminals.list().some((session) => session.terminalSessionId === "T-auth"), false);
    assert.equal(terminals.list().some((session) => session.terminalSessionId === "T-auth-auth"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses to promote a process-pipes transport to Codex terminal", async () => {
  const { root, managedRoot, workspace, environment } = await fixture();
  try {
    const terminals = new TerminalSessionManager(managedRoot);
    assert.throws(() => new CodexQuotaConptyAdapter(terminals, {
      command: "codex-fixture",
      environment,
    }), /codex_quota_conpty_backend_required/);
    assert.equal(terminals.list().length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

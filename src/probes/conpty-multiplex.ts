import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TerminalSessionManager,
  type AgentWorkspaceBinding,
  type TerminalSessionEvent,
  type TerminalSessionRequest,
  type TerminalSessionResult,
} from "../terminal-session.ts";
import { WindowsConptyTerminalBackend } from "../windows-conpty-backend.ts";
import { LocalWorkspaceManager } from "../workspace-manager.ts";

const SOAK_ROUNDS = 3;
const probeTempRoot = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
  ".morrow-test-tmp",
);
await mkdir(probeTempRoot, { recursive: true });
const fixtureRoot = await mkdtemp(join(probeTempRoot, "morrow-conpty-multiplex-"));
const managedRoot = join(fixtureRoot, "managed-workspaces");
const workspaces = new LocalWorkspaceManager(managedRoot);
const terminals = new TerminalSessionManager(managedRoot, {
  backend: new WindowsConptyTerminalBackend(),
});
let currentStage = "initializing";
const hardDeadline = setTimeout(() => {
  for (const session of terminals.list()) {
    if (session.status !== "starting" && session.status !== "running") continue;
    try { terminals.stop(session.terminalSessionId); } catch { /* best-effort probe cleanup */ }
  }
  process.stderr.write(`conpty_soak_hard_timeout:${currentStage}\n`);
  setTimeout(() => process.exit(1), 2_000);
}, 32_000);
const outputs = new Map<string, string>();
const identities = new Map<string, {
  agentInstanceId: string;
  roleId: string;
  runtimeId: string;
  workspaceId: string;
}>();
const events: TerminalSessionEvent[] = [];
terminals.subscribe((event) => {
  events.push(event);
  if (event.type === "TERMINAL_OUTPUT") {
    outputs.set(
      event.terminalSessionId,
      `${outputs.get(event.terminalSessionId) ?? ""}${event.payload.data}`,
    );
  }
});

const childScript = [
  "const {spawn}=require('node:child_process')",
  "const label=process.argv[1]",
  "const mode=process.argv[2]",
  "const child=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:'ignore',windowsHide:true})",
  "process.stdout.write('__MORROW_SOAK_READY_'+label+'_'+child.pid+'__\\n')",
  "if(mode==='input'){process.stdin.setEncoding('utf8');process.stdin.once('data',d=>{process.stdout.write('__MORROW_SOAK_ACK_'+label+'_'+d.trim()+'__\\n');setTimeout(()=>process.exit(0),25)})}",
  "setInterval(()=>{},60000)",
].join(";");

let fixtureRemoved = false;
try {
  const allResults: TerminalSessionResult[] = [];
  const descendantPids: number[] = [];
  let collisionRefusals = 0;

  for (let round = 1; round <= SOAK_ROUNDS; round += 1) {
    currentStage = `round:${round}:prepare`;
    const definitions = [
      { suffix: "input-a", roleId: "executor", mode: "input", timeoutMs: 10_000 },
      { suffix: "input-b", roleId: "reviewer", mode: "input", timeoutMs: 10_000 },
      { suffix: "timeout", roleId: "diagnostician", mode: "timeout", timeoutMs: 2_500 },
      { suffix: "cancel", roleId: "auditor", mode: "cancel", timeoutMs: 10_000 },
    ] as const;
    const prepared: Array<{
      request: TerminalSessionRequest;
      workspace: AgentWorkspaceBinding;
      mode: typeof definitions[number]["mode"];
      label: string;
    }> = [];

    for (const definition of definitions) {
      const label = `R${round}-${definition.suffix}`;
      const workspaceId = `W-${label}`;
      const workspace = await workspaces.create({
        workspaceId,
        contractId: "MORROW-MVO-001",
        roleId: definition.roleId,
      });
      const request = await buildRequest({
        label,
        roleId: definition.roleId,
        mode: definition.mode,
        timeoutMs: definition.timeoutMs,
        workspace,
      });
      identities.set(request.terminalSessionId, {
        agentInstanceId: request.agentInstanceId,
        roleId: request.roleId,
        runtimeId: request.runtimeId,
        workspaceId: request.workspaceId,
      });
      prepared.push({ request, workspace, mode: definition.mode, label });
    }

    currentStage = `round:${round}:input-start`;
    const inputHandles = await Promise.all(
      prepared.slice(0, 2).map(({ request }) => terminals.start(request)),
    );
    if (activeSessionCount() !== 2) {
      throw new Error(`conpty_soak_active_count_invalid:${round}`);
    }

    const scratch = await workspaces.create({
      workspaceId: `W-R${round}-collision`,
      contractId: "MORROW-MVO-001",
      roleId: "executor",
    });
    const scratchRequest = await buildRequest({
      label: `R${round}-collision`,
      roleId: "executor",
      mode: "cancel",
      timeoutMs: 10_000,
      workspace: scratch,
    });
    await expectStartRejection(terminals, {
      ...scratchRequest,
      terminalSessionId: prepared[0].request.terminalSessionId,
    }, "terminal_session_id_already_exists");
    collisionRefusals += 1;
    await expectStartRejection(terminals, {
      ...scratchRequest,
      terminalSessionId: `${scratchRequest.terminalSessionId}-agent`,
      agentInstanceId: prepared[0].request.agentInstanceId,
    }, "agent_instance_already_has_active_terminal");
    collisionRefusals += 1;
    await expectStartRejection(terminals, {
      ...prepared[0].request,
      terminalSessionId: `${scratchRequest.terminalSessionId}-workspace`,
      agentInstanceId: `${scratchRequest.agentInstanceId}-workspace`,
    }, "workspace_already_in_use");
    collisionRefusals += 1;
    await expectStartRejection(
      terminals,
      scratchRequest,
      "terminal_session_capacity_exhausted",
    );
    collisionRefusals += 1;

    currentStage = `round:${round}:input-ready`;
    await waitForReady(prepared.slice(0, 2).map(({ request }) => request.terminalSessionId));
    const firstToken = `ONLY-A-${round}`;
    const secondToken = `ONLY-B-${round}`;
    await Promise.all([
      terminals.write(inputHandles[0].terminalSessionId, `${firstToken}\r`),
      terminals.write(inputHandles[1].terminalSessionId, `${secondToken}\r`),
    ]);
    currentStage = `round:${round}:input-completion`;
    const inputResults = await Promise.all(inputHandles.map((handle) => handle.completion));

    currentStage = `round:${round}:control-start`;
    const terminalHandles = await Promise.all(
      prepared.slice(2).map(({ request }) => terminals.start(request)),
    );
    if (activeSessionCount() !== 2) {
      throw new Error(`conpty_soak_control_active_count_invalid:${round}`);
    }
    currentStage = `round:${round}:control-ready`;
    await waitForReady(prepared.slice(2).map(({ request }) => request.terminalSessionId));
    if (!terminals.stop(terminalHandles[1].terminalSessionId)) {
      throw new Error(`conpty_soak_cancel_refused:${round}`);
    }
    currentStage = `round:${round}:control-completion`;
    const terminalResults = await Promise.all(terminalHandles.map((handle) => handle.completion));

    const handles = [...inputHandles, ...terminalHandles];
    const results = [...inputResults, ...terminalResults];
    allResults.push(...results);
    assertResult(results[0], "completed", false, false);
    assertResult(results[1], "completed", false, false);
    assertResult(results[2], "timed_out", true, false);
    assertResult(results[3], "stopped", false, true);

    const firstOutput = outputs.get(handles[0].terminalSessionId) ?? "";
    const secondOutput = outputs.get(handles[1].terminalSessionId) ?? "";
    const timeoutOutput = outputs.get(handles[2].terminalSessionId) ?? "";
    const cancelOutput = outputs.get(handles[3].terminalSessionId) ?? "";
    if (!firstOutput.includes(`__MORROW_SOAK_ACK_${prepared[0].label}_${firstToken}__`)) {
      throw new Error(`conpty_soak_first_input_missing:${round}`);
    }
    if (!secondOutput.includes(`__MORROW_SOAK_ACK_${prepared[1].label}_${secondToken}__`)) {
      throw new Error(`conpty_soak_second_input_missing:${round}`);
    }
    if (
      firstOutput.includes(secondToken)
      || secondOutput.includes(firstToken)
      || timeoutOutput.includes(firstToken)
      || timeoutOutput.includes(secondToken)
      || cancelOutput.includes(firstToken)
      || cancelOutput.includes(secondToken)
    ) {
      throw new Error(`conpty_soak_input_crossed_session:${round}`);
    }

    for (const { request, label } of prepared) {
      const output = outputs.get(request.terminalSessionId) ?? "";
      const match = output.match(new RegExp(`__MORROW_SOAK_READY_${label}_(\\d+)__`));
      if (!match) throw new Error(`conpty_soak_descendant_marker_missing:${label}`);
      descendantPids.push(Number.parseInt(match[1], 10));
    }
  }

  currentStage = "validate-evidence";
  for (const event of events) {
    const expected = identities.get(event.terminalSessionId);
    if (!expected) throw new Error(`conpty_soak_unbound_event:${event.terminalSessionId}`);
    if (
      event.agentInstanceId !== expected.agentInstanceId
      || event.roleId !== expected.roleId
      || event.runtimeId !== expected.runtimeId
      || event.workspaceId !== expected.workspaceId
    ) {
      throw new Error(`conpty_soak_identity_drift:${event.terminalSessionId}`);
    }
  }

  const rootPids = allResults.map((result) => result.pid).filter((pid): pid is number => pid !== null);
  const nativeHostPids = events
    .filter((event) => event.type === "TERMINAL_SESSION_STARTED")
    .map((event) => event.type === "TERMINAL_SESSION_STARTED" ? event.payload.backendHostPid : null)
    .filter((pid): pid is number => pid !== null);
  if (new Set(rootPids).size !== SOAK_ROUNDS * 4) throw new Error("conpty_soak_root_pid_collision");
  if (new Set(descendantPids).size !== SOAK_ROUNDS * 4) throw new Error("conpty_soak_descendant_pid_collision");
  if (new Set(nativeHostPids).size !== SOAK_ROUNDS * 4) throw new Error("conpty_soak_native_host_pid_collision");
  if (nativeHostPids.some((pid) => pid === process.pid || rootPids.includes(pid))) {
    throw new Error("conpty_soak_native_host_not_isolated");
  }
  const livePids = [...rootPids, ...descendantPids].filter(processIsAlive);
  if (livePids.length > 0) throw new Error(`conpty_soak_orphan_process:${livePids.join(",")}`);

  currentStage = "remove-fixture";
  assertFixtureCleanupScope(fixtureRoot);
  await rm(fixtureRoot, { recursive: true, force: false });
  fixtureRemoved = true;
  const report = {
    ok: true,
    rounds: SOAK_ROUNDS,
    sessions: allResults.length,
    completed: allResults.filter((result) => result.status === "completed").length,
    timedOut: allResults.filter((result) => result.status === "timed_out").length,
    stopped: allResults.filter((result) => result.status === "stopped").length,
    collisionRefusals,
    distinctRootPids: new Set(rootPids).size,
    distinctDescendantPids: new Set(descendantPids).size,
    distinctNativeHostPids: new Set(nativeHostPids).size,
    identityBoundEvents: events.length,
    inputIsolation: true,
    noOrphans: true,
    fixtureRemoved: true,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  try {
    if (!fixtureRemoved) {
      assertFixtureCleanupScope(fixtureRoot);
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  } finally {
    clearTimeout(hardDeadline);
  }
}

async function buildRequest(input: {
  label: string;
  roleId: string;
  mode: "input" | "timeout" | "cancel";
  timeoutMs: number;
  workspace: AgentWorkspaceBinding;
}): Promise<TerminalSessionRequest> {
  return {
    terminalSessionId: `T-${input.label}`,
    agentInstanceId: `A-${input.label}`,
    contractId: "MORROW-MVO-001",
    roleId: input.roleId,
    runtimeId: "node-conpty-soak",
    accessMode: "local",
    workspaceId: input.workspace.workspaceId,
    workspace: input.workspace,
    command: process.execPath,
    args: ["-e", childScript, input.label, input.mode],
    env: await controlledWindowsEnvironment(input.workspace.root),
    timeoutMs: input.timeoutMs,
  };
}

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
  };
  for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP"] as const) {
    const value = process.env[key];
    if (value !== undefined) environment[key] = value;
  }
  return environment;
}

async function expectStartRejection(
  manager: TerminalSessionManager,
  request: TerminalSessionRequest,
  expected: string,
): Promise<void> {
  try {
    const unexpected = await manager.start(request);
    manager.stop(unexpected.terminalSessionId);
    await unexpected.completion;
    throw new Error(`conpty_soak_collision_accepted:${expected}`);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== expected) throw error;
  }
}

async function waitForReady(terminalSessionIds: readonly string[]): Promise<void> {
  const deadline = Date.now() + 8_000;
  while (terminalSessionIds.some((terminalSessionId) => (
    !(outputs.get(terminalSessionId) ?? "").includes("__MORROW_SOAK_READY_")
  ))) {
    if (Date.now() >= deadline) {
      throw new Error(`conpty_soak_ready_timeout:${terminalSessionIds.join(",")}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
}

function activeSessionCount(): number {
  return terminals.list().filter(
    (session) => session.status === "starting" || session.status === "running",
  ).length;
}

function assertResult(
  result: TerminalSessionResult,
  status: TerminalSessionResult["status"],
  timedOut: boolean,
  stopped: boolean,
): void {
  if (
    result.status !== status
    || result.timedOut !== timedOut
    || result.stopped !== stopped
    || result.backend !== "windows-conpty"
    || result.terminalProtocol !== "conpty-vt"
    || !result.presentation.fullTerminal
  ) {
    throw new Error(`conpty_soak_result_invalid:${JSON.stringify({
      terminalSessionId: result.terminalSessionId,
      status: result.status,
      timedOut: result.timedOut,
      stopped: result.stopped,
      backend: result.backend,
      terminalProtocol: result.terminalProtocol,
    })}`);
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function assertFixtureCleanupScope(path: string): void {
  const tempRoot = resolve(probeTempRoot);
  const fixturePath = resolve(path);
  const rel = relative(tempRoot, fixturePath);
  if (!isAbsolute(tempRoot) || rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("conpty_soak_cleanup_scope_invalid");
  }
}

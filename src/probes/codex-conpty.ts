import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodexQuotaConptyAdapter, normalizeCodexTerminalText } from "../codex-conpty-adapter.ts";
import { TerminalSessionManager } from "../terminal-session.ts";
import { WindowsConptyTerminalBackend } from "../windows-conpty-backend.ts";
import { LocalWorkspaceManager } from "../workspace-manager.ts";

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

const root = await mkdtemp(join(tmpdir(), "morrow-codex-conpty-"));
const managedRoot = join(root, "managed-workspaces");
const workspaces = new LocalWorkspaceManager(managedRoot);
const workspace = await workspaces.create({
  workspaceId: "W-probe",
  contractId: "MORROW-MVO-001",
  roleId: "executor",
});
const sentinel = join(workspace.root, "sentinel.txt");
const sentinelContent = "MORROW_SENTINEL_ORIGINAL\n";
await writeFile(sentinel, sentinelContent, "utf8");

try {
  const beforeFiles = await readdir(workspace.root);
  const beforeHash = sha256(await readFile(sentinel));
  const terminals = new TerminalSessionManager(managedRoot, {
    backend: new WindowsConptyTerminalBackend(),
  });
  const adapter = new CodexQuotaConptyAdapter(terminals);
  let outputEvents = 0;
  let invocationSettled = false;
  let liveOutputBeforeCompletion = false;
  terminals.subscribe((event) => {
    if (event.terminalSessionId === "T-probe" && event.type === "TERMINAL_OUTPUT") {
      outputEvents += 1;
      if (!invocationSettled) liveOutputBeforeCompletion = true;
    }
  });

  const result = await adapter.invoke({
    invocationId: `codex-conpty-probe-${Date.now()}`,
    terminalSessionId: "T-probe",
    agentInstanceId: "A-probe",
    contractId: "MORROW-MVO-001",
    roleId: "executor",
    runtimeId: "codex-cli-quota",
    workspaceId: workspace.workspaceId,
    workspace,
    prompt: "Responda exatamente: MORROW_CODEX_CONPTY_OK",
    timeoutMs: 120_000,
  }).finally(() => { invocationSettled = true; });
  const afterFiles = await readdir(workspace.root);
  const afterContent = await readFile(sentinel, "utf8");
  const afterHash = sha256(Buffer.from(afterContent, "utf8"));
  const normalizedOutput = normalizeCodexTerminalText(`${result.stdout}\n${result.stderr}`);
  const compactOutput = normalizedOutput.replace(/\s/g, "").toLowerCase();
  const compactWorkdir = `workdir:${workspace.root}`.replace(/\s/g, "").toLowerCase();
  const cwdBound = compactOutput.includes(compactWorkdir);
  const replyMarkerCount = normalizedOutput.match(/MORROW_CODEX_CONPTY_OK/g)?.length ?? 0;
  const exactReply = replyMarkerCount >= 2;
  const report = {
    ok: result.exitCode === 0
      && !result.timedOut
      && exactReply
      && beforeHash === afterHash
      && JSON.stringify(beforeFiles.sort()) === JSON.stringify(afterFiles.sort())
      && afterContent === sentinelContent
      && outputEvents > 0
      && liveOutputBeforeCompletion
      && cwdBound,
    accessMode: result.accessMode,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    model: result.model,
    provider: result.provider,
    approval: result.approval,
    sandbox: result.sandbox,
    reasoningEffort: result.reasoningEffort,
    cliVersion: result.cliVersion,
    backend: result.backend,
    terminalProtocol: result.terminalProtocol,
    fullTerminal: result.presentation.fullTerminal,
    terminalSessionId: result.terminalSessionId,
    agentInstanceId: result.agentInstanceId,
    workspaceId: result.workspaceId,
    outputEvents,
    liveOutputBeforeCompletion,
    cwdBound,
    exactReply,
    noMutation: beforeHash === afterHash
      && JSON.stringify(beforeFiles.sort()) === JSON.stringify(afterFiles.sort())
      && afterContent === sentinelContent,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} finally {
  await rm(root, { recursive: true, force: true });
}

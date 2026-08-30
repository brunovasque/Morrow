import type { CodexQuotaResult } from "./codex-quota-adapter.ts";
import { assertCodexQuotaEnvironment } from "./codex-quota-adapter.ts";
import {
  ManagedTerminalRuntimeAdapter,
  TerminalSessionManager,
  type AgentWorkspaceBinding,
  type TerminalBackendDescriptor,
  type TerminalPresentation,
  type TerminalProtocol,
} from "./terminal-session.ts";
import { resolveWindowsNpmCommand } from "./windows-npm-shim.ts";

const AUTHENTICATION_TIMEOUT_MS = 30_000;
const MANAGED_ENVIRONMENT_KEYS = [
  "SystemRoot",
  "WINDIR",
  "TEMP",
  "TMP",
  "ComSpec",
  "PATHEXT",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "ProgramData",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "HOME",
  "APPDATA",
  "LOCALAPPDATA",
  "CODEX_HOME",
] as const;

export interface CodexConptyInvocation {
  invocationId: string;
  terminalSessionId: string;
  agentInstanceId: string;
  contractId: string;
  roleId: string;
  runtimeId: string;
  workspaceId: string;
  workspace: AgentWorkspaceBinding;
  prompt: string;
  timeoutMs: number;
}

export interface CodexQuotaConptyAdapterOptions {
  command?: string;
  environment?: NodeJS.ProcessEnv;
}

export type CodexConptyResult = Omit<
  CodexQuotaResult,
  "model" | "provider" | "approval" | "sandbox" | "reasoningEffort"
> & {
  model: string;
  provider: string;
  approval: string;
  sandbox: string;
  reasoningEffort: string;
  cliVersion: string;
  terminalSessionId: string;
  authTerminalSessionId: string;
  agentInstanceId: string;
  contractId: string;
  roleId: string;
  workspaceId: string;
  backend: TerminalBackendDescriptor["kind"];
  backendImplementationId: string;
  terminalProtocol: TerminalProtocol;
  presentation: TerminalPresentation;
};

export function buildCodexQuotaTerminalEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  assertCodexQuotaEnvironment(source);
  const environment: Record<string, string> = {};
  for (const key of MANAGED_ENVIRONMENT_KEYS) {
    const value = source[key];
    if (typeof value === "string") environment[key] = value;
  }
  const pathValue = source.Path ?? source.PATH ?? source.path;
  if (typeof pathValue === "string") environment.Path = pathValue;
  environment.NO_COLOR = "1";
  return environment;
}

export function buildCodexConptyReadOnlyArgs(prompt: string): string[] {
  return [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    prompt,
  ];
}

export class CodexQuotaConptyAdapter {
  private readonly terminals: TerminalSessionManager;
  private readonly transport: ManagedTerminalRuntimeAdapter;
  private readonly command: string;
  private readonly environment: Record<string, string>;

  constructor(
    terminals: TerminalSessionManager,
    options: CodexQuotaConptyAdapterOptions = {},
  ) {
    this.terminals = terminals;
    this.transport = new ManagedTerminalRuntimeAdapter(terminals);
    assertFullConptyDescriptor(terminals.descriptor());
    this.command = options.command ?? "codex";
    this.environment = buildCodexQuotaTerminalEnvironment(options.environment ?? process.env);
  }

  async invoke(input: CodexConptyInvocation): Promise<CodexConptyResult> {
    input = detachCodexConptyInvocation(input);
    if (!input.prompt) throw new Error("codex_quota_prompt_required");
    if (!Number.isFinite(input.timeoutMs) || input.timeoutMs <= 0) {
      throw new Error("codex_quota_timeout_invalid");
    }
    const resolved = await resolveWindowsNpmCommand(this.command, this.environment);
    const authTerminalSessionId = `${input.terminalSessionId}-auth`;

    const auth = await this.transport.invoke({
      invocationId: `${input.invocationId}-auth`,
      terminalSessionId: authTerminalSessionId,
      agentInstanceId: input.agentInstanceId,
      contractId: input.contractId,
      roleId: input.roleId,
      workspaceId: input.workspaceId,
      workspace: input.workspace,
      runtimeId: input.runtimeId,
      accessMode: "quota-session",
      command: resolved.command,
      args: [...resolved.prefixArgs, "login", "status"],
      prompt: "",
      timeoutMs: Math.min(input.timeoutMs, AUTHENTICATION_TIMEOUT_MS),
      env: this.environment,
    });
    const authSnapshot = this.terminals.snapshot(authTerminalSessionId);
    assertFullConpty(authSnapshot);
    if (
      auth.exitCode !== 0
      || auth.timedOut
      || !/Logged in using ChatGPT/i.test(normalizeCodexTerminalText(`${auth.stdout}\n${auth.stderr}`))
    ) {
      throw new Error("codex_quota_auth_not_confirmed");
    }

    const invocationArgs = [...resolved.prefixArgs, ...buildCodexConptyReadOnlyArgs(input.prompt)];
    const result = await this.transport.invoke({
      invocationId: input.invocationId,
      terminalSessionId: input.terminalSessionId,
      agentInstanceId: input.agentInstanceId,
      contractId: input.contractId,
      roleId: input.roleId,
      workspaceId: input.workspaceId,
      workspace: input.workspace,
      runtimeId: input.runtimeId,
      accessMode: "quota-session",
      command: resolved.command,
      args: invocationArgs,
      sensitiveArgIndexes: [invocationArgs.length - 1],
      // The measured CLI transport requires the prompt as its final argument
      // under ConPTY. The manager redacts that exact index before emitting the
      // structured start event.
      prompt: "",
      timeoutMs: input.timeoutMs,
      env: this.environment,
    });
    const snapshot = this.terminals.snapshot(input.terminalSessionId);
    assertFullConpty(snapshot);
    const metadata = requireCodexMetadata(`${result.stdout}\n${result.stderr}`);

    return {
      ...result,
      ...metadata,
      authTerminalSessionId,
      backend: snapshot.backend,
      backendImplementationId: snapshot.backendImplementationId,
      terminalProtocol: snapshot.terminalProtocol,
      presentation: snapshot.presentation,
    };
  }
}

function detachCodexConptyInvocation(input: CodexConptyInvocation): CodexConptyInvocation {
  return {
    ...input,
    workspace: { ...input.workspace },
  };
}

function assertFullConpty(snapshot: ReturnType<TerminalSessionManager["snapshot"]>): void {
  assertFullConptyDescriptor({
    kind: snapshot.backend,
    implementationId: snapshot.backendImplementationId,
    protocol: snapshot.terminalProtocol,
    capabilities: snapshot.capabilities,
  });
  if (!snapshot.presentation.fullTerminal) throw new Error("codex_quota_conpty_backend_required");
}

function assertFullConptyDescriptor(descriptor: TerminalBackendDescriptor): void {
  if (
    descriptor.kind !== "windows-conpty"
    || descriptor.protocol !== "conpty-vt"
    || !descriptor.capabilities.tty
    || !descriptor.capabilities.interactive
    || !descriptor.capabilities.resize
    || !descriptor.capabilities.signals
    || !descriptor.capabilities.utf8
    || !descriptor.capabilities.exitStatus
  ) throw new Error("codex_quota_conpty_backend_required");
}

function requireCodexMetadata(text: string): {
  model: string;
  provider: string;
  approval: string;
  sandbox: string;
  reasoningEffort: string;
  cliVersion: string;
} {
  const normalized = normalizeCodexTerminalText(text);
  const banner = /OpenAI Codex v(\d+\.\d+\.\d+(?:[-+][^\s]+)?)/.exec(normalized);
  if (!banner || banner.index === undefined) throw new Error("codex_quota_header_missing");
  const firstDivider = normalized.indexOf("--------", banner.index + banner[0].length);
  const headerStart = firstDivider === -1 ? -1 : firstDivider + "--------".length;
  const headerEnd = headerStart === -1 ? -1 : normalized.indexOf("--------", headerStart);
  if (headerStart === -1 || headerEnd === -1) throw new Error("codex_quota_header_incomplete");
  const header = normalized.slice(headerStart, headerEnd);
  const metadata = {
    model: extract("model", header),
    provider: extract("provider", header),
    approval: extract("approval", header),
    sandbox: extract("sandbox", header),
    reasoningEffort: extract("reasoning effort", header),
    cliVersion: banner[1],
  };
  const missing = Object.entries(metadata)
    .filter((entry) => entry[1] === undefined)
    .map((entry) => entry[0]);
  if (missing.length > 0) throw new Error(`codex_quota_metadata_incomplete:${missing.join(",")}`);
  if (metadata.provider !== "openai") throw new Error("codex_quota_provider_unexpected");
  if (metadata.approval !== "never") throw new Error("codex_quota_approval_unexpected");
  if (metadata.sandbox !== "read-only") throw new Error("codex_quota_sandbox_unexpected");
  return metadata as {
    model: string;
    provider: string;
    approval: string;
    sandbox: string;
    reasoningEffort: string;
    cliVersion: string;
  };
}

function extract(label: string, text: string): string | undefined {
  const match = text.match(new RegExp(`^${label}:\\s*(.+)$`, "mi"));
  return match?.[1]?.trim();
}

export function normalizeCodexTerminalText(text: string): string {
  return text
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replaceAll("\r", "");
}

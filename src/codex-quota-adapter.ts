import { spawn } from "node:child_process";
import { ProcessRuntimeAdapter, type RuntimeResult } from "./runtime-adapter.ts";
import { resolveWindowsNpmCommand } from "./windows-npm-shim.ts";

export type CodexSandbox = "read-only";

export interface CodexQuotaInvocation {
  invocationId: string;
  prompt: string;
  cwd: string;
  timeoutMs: number;
  sandbox?: CodexSandbox;
  command?: string;
  env?: NodeJS.ProcessEnv;
}

export interface CodexQuotaResult extends RuntimeResult {
  model?: string;
  provider?: string;
  approval?: string;
  sandbox?: string;
  reasoningEffort?: string;
}

const forbiddenApiEnvironment = [
  "OPENAI_API_KEY",
  "CODEX_API_KEY",
  "OPENAI_BASE_URL",
] as const;

export function assertCodexQuotaEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  const present = forbiddenApiEnvironment.filter((key) => Boolean(env[key]));
  if (present.length > 0) {
    throw new Error(`codex_quota_environment_unsafe:${present.join(",")}`);
  }
}

export function buildCodexReadOnlyArgs(prompt: string): string[] {
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

async function capture(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const resolved = await resolveWindowsNpmCommand(command, env);
  return await new Promise((resolve, reject) => {
    const child = spawn(resolved.command, [...resolved.prefixArgs, ...args], {
      cwd,
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function extract(label: string, text: string): string | undefined {
  const match = text.match(new RegExp(`^${label}:\\s*(.+)$`, "mi"));
  return match?.[1]?.trim();
}

export class CodexQuotaSessionAdapter {
  private readonly processAdapter = new ProcessRuntimeAdapter();

  async assertAuthenticated(input: Pick<CodexQuotaInvocation, "cwd" | "command" | "env">): Promise<void> {
    const env = input.env ?? process.env;
    assertCodexQuotaEnvironment(env);
    const command = input.command ?? "codex";
    const status = await capture(command, ["login", "status"], input.cwd, env);
    const combined = `${status.stdout}\n${status.stderr}`;
    if (status.code !== 0 || !/Logged in using ChatGPT/i.test(combined)) {
      throw new Error("codex_quota_auth_not_confirmed");
    }
  }

  async invoke(input: CodexQuotaInvocation): Promise<CodexQuotaResult> {
    const env = input.env ?? process.env;
    await this.assertAuthenticated(input);

    const command = input.command ?? "codex";
    const resolved = await resolveWindowsNpmCommand(command, env);
    const args = [...resolved.prefixArgs, ...buildCodexReadOnlyArgs(input.prompt)];
    const result = await this.processAdapter.invoke({
      invocationId: input.invocationId,
      runtimeId: "codex-cli",
      accessMode: "quota-session",
      command: resolved.command,
      args,
      // Prompt travels as an explicit exec argument because stdin transport is not promoted for Codex V0.
      prompt: "",
      cwd: input.cwd,
      timeoutMs: input.timeoutMs,
      env: Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
    });

    const metadataText = `${result.stdout}\n${result.stderr}`;
    return {
      ...result,
      model: extract("model", metadataText),
      provider: extract("provider", metadataText),
      approval: extract("approval", metadataText),
      sandbox: extract("sandbox", metadataText),
      reasoningEffort: extract("reasoning effort", metadataText),
    };
  }
}

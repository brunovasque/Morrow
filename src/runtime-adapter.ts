import { spawn } from "node:child_process";

export type RuntimeAccessMode = "quota-session" | "api" | "local";

export interface RuntimeInvocation {
  invocationId: string;
  runtimeId: string;
  accessMode: RuntimeAccessMode;
  command: string;
  args: string[];
  prompt: string;
  cwd: string;
  timeoutMs: number;
  env?: Record<string, string>;
}

export interface RuntimeResult {
  invocationId: string;
  runtimeId: string;
  accessMode: RuntimeAccessMode;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
}

export interface RuntimeAdapter {
  invoke(input: RuntimeInvocation): Promise<RuntimeResult>;
}

export class ProcessRuntimeAdapter implements RuntimeAdapter {
  async invoke(input: RuntimeInvocation): Promise<RuntimeResult> {
    const startedAt = Date.now();

    return await new Promise<RuntimeResult>((resolve, reject) => {
      const child = spawn(input.command, input.args, {
        cwd: input.cwd,
        env: input.env ? { ...process.env, ...input.env } : process.env,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, input.timeoutMs);

      child.once("error", (error) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        reject(error);
      });

      child.once("close", (code) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        resolve({
          invocationId: input.invocationId,
          runtimeId: input.runtimeId,
          accessMode: input.accessMode,
          exitCode: code,
          timedOut,
          durationMs: Date.now() - startedAt,
          stdout,
          stderr,
        });
      });

      child.stdin.end(input.prompt);
    });
  }
}

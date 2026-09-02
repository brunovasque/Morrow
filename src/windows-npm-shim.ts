import { access, readFile } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";

export interface ResolvedCommand {
  command: string;
  prefixArgs: string[];
}

export function parseNodeScriptFromNpmCmdShim(content: string, shimPath: string): string | null {
  // npm-generated Windows shims normally reference a script relative to the shim
  // using either %~dp0 (cmd-expanded drive/path) or %dp0% variants.
  // We intentionally extract only a relative .js target and never execute cmd content.
  const normalized = content.replace(/\r\n/g, "\n");
  const patterns = [
    /(?:"?%~dp0)([^"\r\n]*?\.js)"?/i,
    /(?:"?%dp0%)([^"\r\n]*?\.js)"?/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const relative = match[1].replace(/^[\\/]+/, "");
    return resolve(dirname(shimPath), relative);
  }

  return null;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findOnPath(command: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  if (isAbsolute(command) || /[\\/]/.test(command)) {
    const candidates = command.toLowerCase().endsWith(".cmd") ? [command] : [command, `${command}.cmd`];
    for (const candidate of candidates) {
      if (await exists(candidate)) return candidate;
    }
    return null;
  }

  const pathValue = env.PATH ?? env.Path ?? env.path ?? "";
  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    const candidate = join(directory, command.toLowerCase().endsWith(".cmd") ? command : `${command}.cmd`);
    if (await exists(candidate)) return candidate;
  }
  return null;
}

export async function resolveWindowsNpmCommand(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<ResolvedCommand> {
  if (platform !== "win32") return { command, prefixArgs: [] };

  const shimPath = await findOnPath(command, env);
  if (!shimPath) throw new Error(`windows_npm_shim_not_found:${command}`);

  if (!shimPath.toLowerCase().endsWith(".cmd")) {
    return { command: shimPath, prefixArgs: [] };
  }

  const content = await readFile(shimPath, "utf8");
  const script = parseNodeScriptFromNpmCmdShim(content, shimPath);
  if (!script || !(await exists(script))) {
    throw new Error(`windows_npm_shim_unresolved:${command}`);
  }

  return { command: process.execPath, prefixArgs: [script] };
}

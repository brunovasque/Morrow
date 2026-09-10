import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseNodeScriptFromNpmCmdShim, resolveWindowsNpmCommand } from "../src/windows-npm-shim.ts";

test("parses only npm-style node script target from cmd shim", () => {
  const shimPath = "C:\\Users\\test\\AppData\\Roaming\\npm\\codex.cmd";
  const content = '@ECHO off\r\n"%~dp0\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n';
  const parsed = parseNodeScriptFromNpmCmdShim(content, shimPath);
  assert.ok(parsed?.endsWith("node_modules\\@openai\\codex\\bin\\codex.js"));
});

test("rejects arbitrary cmd content that is not an npm node shim", () => {
  const parsed = parseNodeScriptFromNpmCmdShim("@echo off\r\ndel C:\\important.txt\r\n", "C:\\tmp\\codex.cmd");
  assert.equal(parsed, null);
});

test("resolves a simulated Windows npm shim to node plus script without shell", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-shim-"));
  const scriptDir = join(root, "node_modules", "@openai", "codex", "bin");
  await mkdir(scriptDir, { recursive: true });
  const script = join(scriptDir, "codex.js");
  await writeFile(script, "console.log('ok')", "utf8");
  await writeFile(join(root, "codex.cmd"), '@ECHO off\r\n"%~dp0\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n', "utf8");

  const resolved = await resolveWindowsNpmCommand("codex", { PATH: root }, "win32");
  assert.equal(resolved.command, process.execPath);
  assert.deepEqual(resolved.prefixArgs, [script]);
});

import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import process from "node:process";

if (process.platform !== "win32" || process.argv.length !== 4) {
  throw new Error("morrow_conpty_launcher_invocation_invalid");
}

const releasePath = process.argv[2];
const spec = JSON.parse(Buffer.from(process.argv[3], "base64url").toString("utf8"));
if (!spec || typeof spec !== "object" || Object.keys(spec).sort().join(",") !== "args,command"
  || typeof spec.command !== "string" || !spec.command || !Array.isArray(spec.args)
  || spec.args.some((arg) => typeof arg !== "string")) {
  throw new Error("morrow_conpty_launcher_spec_invalid");
}

const deadline = Date.now() + 10_000;
while (!existsSync(releasePath)) {
  if (Date.now() >= deadline) throw new Error("morrow_conpty_launcher_release_timeout");
  await new Promise((resolve) => setTimeout(resolve, 10));
}
rmSync(releasePath, { force: true });

const ignoreInterrupt = () => {};
process.on("SIGINT", ignoreInterrupt);
process.on("SIGBREAK", ignoreInterrupt);
const child = spawn(spec.command, spec.args, {
  cwd: process.cwd(), env: process.env, shell: false, stdio: "inherit", windowsHide: true,
});
const result = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (exitCode, signal) => resolve({ exitCode, signal }));
});
process.off("SIGINT", ignoreInterrupt);
process.off("SIGBREAK", ignoreInterrupt);
process.exitCode = result.exitCode ?? 1;

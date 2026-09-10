import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodexQuotaSessionAdapter } from "../codex-quota-adapter.ts";

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

const root = await mkdtemp(join(tmpdir(), "morrow-codex-quota-"));
const sentinel = join(root, "sentinel.txt");
const sentinelContent = "MORROW_SENTINEL_ORIGINAL\n";
await writeFile(sentinel, sentinelContent, "utf8");

try {
  const beforeFiles = await readdir(root);
  const beforeHash = sha256(await readFile(sentinel));

  const adapter = new CodexQuotaSessionAdapter();
  const result = await adapter.invoke({
    invocationId: `codex-quota-probe-${Date.now()}`,
    prompt: "Responda exatamente: MORROW_CODEX_QUOTA_OK",
    cwd: root,
    timeoutMs: 120_000,
  });

  const afterFiles = await readdir(root);
  const afterContent = await readFile(sentinel, "utf8");
  const afterHash = sha256(Buffer.from(afterContent, "utf8"));
  const exactReply = /MORROW_CODEX_QUOTA_OK/.test(`${result.stdout}\n${result.stderr}`);
  const noMutation = beforeHash === afterHash && JSON.stringify(beforeFiles.sort()) === JSON.stringify(afterFiles.sort()) && afterContent === sentinelContent;

  const report = {
    ok: result.exitCode === 0 && !result.timedOut && exactReply && noMutation,
    accessMode: result.accessMode,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    model: result.model ?? null,
    provider: result.provider ?? null,
    approval: result.approval ?? null,
    sandbox: result.sandbox ?? null,
    reasoningEffort: result.reasoningEffort ?? null,
    exactReply,
    noMutation,
    beforeHash,
    afterHash,
    filesBefore: beforeFiles,
    filesAfter: afterFiles,
    stderrTail: result.stderr.slice(-1200),
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} finally {
  await rm(root, { recursive: true, force: true });
}

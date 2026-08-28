import assert from "node:assert/strict";
import test from "node:test";
import { assertCodexQuotaEnvironment, buildCodexReadOnlyArgs } from "../src/codex-quota-adapter.ts";

test("codex quota adapter refuses API-bearing environments", () => {
  assert.throws(
    () => assertCodexQuotaEnvironment({ OPENAI_API_KEY: "present" }),
    /codex_quota_environment_unsafe:OPENAI_API_KEY/,
  );
});

test("codex quota adapter accepts environment without API override", () => {
  assert.doesNotThrow(() => assertCodexQuotaEnvironment({ PATH: "x" }));
});

test("codex read-only args preserve measured V0 transport and fences", () => {
  const args = buildCodexReadOnlyArgs("MORROW_CODEX_QUOTA_OK");
  assert.deepEqual(args, [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "MORROW_CODEX_QUOTA_OK",
  ]);
});

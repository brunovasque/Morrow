import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  readContractPackage,
  reconcileContractPackage,
  type ContractPackage,
  type GitSnapshot,
} from "../src/contract-reconciler.ts";

const cleanGit: GitSnapshot = {
  branch: "mvo/p0-pr03-contract-reconciler",
  head: "candidate",
  clean: true,
  baselineIsAncestor: true,
};

function contractPackage(overrides: Partial<ContractPackage> = {}): ContractPackage {
  return {
    contractId: "MORROW-MVO-001",
    contractState: "READY_FOR_EXECUTION",
    contractAcceptanceIds: ["AC-01", "AC-02"],
    activePrId: "P0-PR03",
    nextAuthorizedAction: "START_P0_PR03_RECONCILER",
    expectedBranchPrefix: "mvo/p0-pr03-",
    baselineSha: "baseline",
    prs: [
      { id: "P0-PR01", status: "PROVEN", dependencies: [] },
      { id: "P0-PR02", status: "PROVEN", dependencies: ["P0-PR01"] },
      { id: "P0-PR03", status: "READY", dependencies: ["P0-PR02"] },
      { id: "P1-PR01", status: "HISTORICAL_BASELINE", dependencies: [] },
      { id: "P2-PR01", status: "PENDING", dependencies: ["P0-PR03", "P1"] },
    ],
    evidencePrIds: ["P0-PR01", "P0-PR02", "P1-PR01"],
    mapPhaseIds: ["P0", "P1", "P2"],
    traceabilityAcceptanceIds: ["AC-01", "AC-02"],
    traceabilityState: "COMPLETE",
    independentReviewState: "COMPLETE",
    ownerAcceptanceState: "APPROVED",
    blockingQuestionCount: 0,
    ...overrides,
  };
}

test("reconciler returns the exact authorized action for a clean, ready package", () => {
  const result = reconcileContractPackage(contractPackage(), cleanGit);

  assert.equal(result.allowed, true);
  assert.equal(result.state, "READY_FOR_EXECUTION");
  assert.equal(result.nextPrId, "P0-PR03");
  assert.equal(result.nextAuthorizedAction, "START_P0_PR03_RECONCILER");
});

test("reconciler blocks a live action that diverges from the ready PR", () => {
  const result = reconcileContractPackage(
    contractPackage({ nextAuthorizedAction: "START_P2_PR01" }),
    cleanGit,
  );

  assert.equal(result.allowed, false);
  assert.equal(result.state, "BLOCKED_STATE_DIVERGENCE");
  assert.match(result.reasons.join("|"), /live_action_mismatch/);
});

test("reconciler blocks missing dependencies, dirty Git and branch mismatch", () => {
  const result = reconcileContractPackage(
    contractPackage({
      prs: [
        { id: "P0-PR01", status: "PROVEN", dependencies: [] },
        { id: "P0-PR02", status: "PENDING", dependencies: ["P0-PR01"] },
        { id: "P0-PR03", status: "READY", dependencies: ["P0-PR02"] },
      ],
      evidencePrIds: ["P0-PR01"],
    }),
    { ...cleanGit, branch: "phase-2/runtime-v0", clean: false },
  );

  assert.equal(result.allowed, false);
  assert.match(result.reasons.join("|"), /active_pr_dependencies_not_proven/);
  assert.match(result.reasons.join("|"), /git_worktree_dirty/);
  assert.match(result.reasons.join("|"), /git_branch_mismatch/);
});

test("reconciler blocks duplicate PR identifiers in the package", () => {
  const result = reconcileContractPackage(
    contractPackage({
      prs: [
        { id: "P0-PR01", status: "PROVEN", dependencies: [] },
        { id: "P0-PR03", status: "READY", dependencies: ["P0-PR01"] },
        { id: "P0-PR03", status: "PENDING", dependencies: ["P0-PR01"] },
      ],
    }),
    cleanGit,
  );

  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("duplicate_pr_id"));
});

test("reconciler blocks stale contract control documents", () => {
  const result = reconcileContractPackage(
    contractPackage({
      mapPhaseIds: ["P0", "P1"],
      traceabilityAcceptanceIds: ["AC-01", "AC-99"],
      independentReviewState: "PENDING",
      ownerAcceptanceState: "PENDING",
      blockingQuestionCount: 1,
    }),
    cleanGit,
  );

  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("pr_phase_missing_from_map:P2"));
  assert.ok(result.reasons.includes("acceptance_missing_from_traceability:AC-02"));
  assert.ok(result.reasons.includes("traceability_acceptance_unknown:AC-99"));
  assert.ok(result.reasons.includes("independent_review_not_complete:PENDING"));
  assert.ok(result.reasons.includes("owner_acceptance_not_approved:PENDING"));
  assert.ok(result.reasons.includes("blocking_questions_open:1"));
});

test("reconciler advances to P2 only after all P1 baseline units and P0 are proven", () => {
  const result = reconcileContractPackage(
    contractPackage({
      activePrId: "P2-PR01",
      nextAuthorizedAction: "START_P2_PR01",
      expectedBranchPrefix: null,
      prs: [
        { id: "P0-PR01", status: "PROVEN", dependencies: [] },
        { id: "P0-PR02", status: "PROVEN", dependencies: ["P0-PR01"] },
        { id: "P0-PR03", status: "PROVEN", dependencies: ["P0-PR02"] },
        { id: "P1-PR01", status: "HISTORICAL_BASELINE", dependencies: [] },
        { id: "P1-PR02", status: "HISTORICAL_BASELINE", dependencies: [] },
        { id: "P2-PR01", status: "PENDING", dependencies: ["P0-PR03", "P1"] },
      ],
      evidencePrIds: ["P0-PR01", "P0-PR02", "P0-PR03", "P1-PR01", "P1-PR02"],
    }),
    cleanGit,
  );

  assert.equal(result.allowed, true);
  assert.equal(result.nextPrId, "P2-PR01");
  assert.equal(result.nextAuthorizedAction, "START_P2_PR01");
});

test("package reader refuses missing status fields and reads a valid package", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-contract-package-"));
  const packageRoot = join(root, "contracts", "morrow-minimum-operable-v0");
  await mkdir(packageRoot, { recursive: true });

  await Promise.all([
    writeFile(join(packageRoot, "CONTRACT.md"), "- `contract_id`: `C1`\n", "utf8"),
    writeFile(join(packageRoot, "LIVE_STATUS.md"), [
      "- `active_pr_id`: `P0-PR03`",
      "- `next_authorized_action`: `START_P0_PR03_RECONCILER`",
      "- `proven_baseline_sha`: `baseline`",
    ].join("\n"), "utf8"),
    writeFile(join(packageRoot, "PRS.md"), [
      "| `P0-PR01` | `PROVEN` | baseline | objective | proof |",
      "| `P0-PR03` | `READY` | P0-PR01 | objective | proof |",
    ].join("\n"), "utf8"),
    writeFile(join(packageRoot, "EVIDENCE.md"), "| `P0-PR01` | proof |\n", "utf8"),
    writeFile(join(packageRoot, "MAP.md"), "| `P0` | phase |\n", "utf8"),
    writeFile(join(packageRoot, "TRACEABILITY.md"), [
      "- `traceability_state`: `COMPLETE`",
      "- `independent_review_state`: `COMPLETE`",
      "- `owner_acceptance_state`: `APPROVED`",
    ].join("\n"), "utf8"),
    writeFile(join(packageRoot, "QUESTIONS.md"), "- `blocking_question_count`: `0`\n", "utf8"),
  ]);

  await assert.rejects(() => readContractPackage(root), /contract_package_missing:contract_state/);

  await writeFile(join(packageRoot, "LIVE_STATUS.md"), [
    "- `contract_state`: `READY_FOR_EXECUTION`",
    "- `active_pr_id`: `P0-PR03`",
    "- `next_authorized_action`: `START_P0_PR03_RECONCILER`",
    "- `proven_baseline_sha`: `baseline`",
  ].join("\n"), "utf8");

  const parsed = await readContractPackage(root);
  assert.equal(parsed.contractId, "C1");
  assert.equal(parsed.prs.length, 2);
  assert.deepEqual(parsed.prs[1].dependencies, ["P0-PR01"]);
});

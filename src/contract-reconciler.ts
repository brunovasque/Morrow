import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type ContractPrStatus =
  | "HISTORICAL_BASELINE"
  | "READY_FOR_OWNER_REVIEW"
  | "BLOCKED"
  | "PENDING"
  | "READY"
  | "RUNNING"
  | "PROVEN"
  | "REJECTED"
  | "SUPERSEDED";

export interface ContractPr {
  id: string;
  status: ContractPrStatus;
  dependencies: string[];
}

export interface ContractPackage {
  contractId: string;
  contractState: string;
  activePrId: string;
  nextAuthorizedAction: string;
  expectedBranchPrefix: string | null;
  baselineSha: string;
  prs: ContractPr[];
  evidencePrIds: string[];
}

export interface GitSnapshot {
  branch: string;
  head: string;
  clean: boolean;
  baselineIsAncestor: boolean;
}

export interface ReconciliationResult {
  allowed: boolean;
  state: "READY_FOR_EXECUTION" | "BLOCKED_STATE_DIVERGENCE";
  nextPrId: string | null;
  nextAuthorizedAction: string | null;
  reasons: string[];
}

const runnableStatuses = new Set<ContractPrStatus>(["READY", "RUNNING", "PENDING"]);
const provenStatuses = new Set<ContractPrStatus>(["PROVEN", "HISTORICAL_BASELINE"]);

export async function readContractPackage(repositoryRoot: string): Promise<ContractPackage> {
  const packageRoot = resolve(repositoryRoot, "contracts", "morrow-minimum-operable-v0");
  const [contract, liveStatus, prs, evidence] = await Promise.all([
    readFile(resolve(packageRoot, "CONTRACT.md"), "utf8"),
    readFile(resolve(packageRoot, "LIVE_STATUS.md"), "utf8"),
    readFile(resolve(packageRoot, "PRS.md"), "utf8"),
    readFile(resolve(packageRoot, "EVIDENCE.md"), "utf8"),
  ]);

  return {
    contractId: requiredMarkdownValue(contract, "contract_id"),
    contractState: requiredMarkdownValue(liveStatus, "contract_state"),
    activePrId: requiredMarkdownValue(liveStatus, "active_pr_id"),
    nextAuthorizedAction: requiredMarkdownValue(liveStatus, "next_authorized_action"),
    expectedBranchPrefix: optionalMarkdownValue(liveStatus, "expected_branch_prefix"),
    baselineSha: requiredMarkdownValue(liveStatus, "proven_baseline_sha"),
    prs: parsePrs(prs),
    evidencePrIds: unique([...evidence.matchAll(/\|\s*`(P\d-PR\d{2})`\s*\|/g)].map((match) => match[1])),
  };
}

export async function captureGitSnapshot(
  repositoryRoot: string,
  baselineSha: string,
): Promise<GitSnapshot> {
  const [branch, head, status] = await Promise.all([
    git(repositoryRoot, ["branch", "--show-current"]),
    git(repositoryRoot, ["rev-parse", "HEAD"]),
    git(repositoryRoot, ["status", "--porcelain"]),
  ]);

  const baselineIsAncestor = await gitSucceeds(repositoryRoot, [
    "merge-base",
    "--is-ancestor",
    baselineSha,
    "HEAD",
  ]);

  return { branch, head, clean: status === "", baselineIsAncestor };
}

export async function reconcileRepository(repositoryRoot: string): Promise<ReconciliationResult> {
  const contractPackage = await readContractPackage(repositoryRoot);
  const gitSnapshot = await captureGitSnapshot(repositoryRoot, contractPackage.baselineSha);
  return reconcileContractPackage(contractPackage, gitSnapshot);
}

export function reconcileContractPackage(
  contractPackage: ContractPackage,
  gitSnapshot: GitSnapshot,
): ReconciliationResult {
  const reasons: string[] = [];
  const prById = new Map(contractPackage.prs.map((pr) => [pr.id, pr]));

  if (contractPackage.contractState !== "READY_FOR_EXECUTION") {
    reasons.push(`contract_not_ready:${contractPackage.contractState}`);
  }

  if (contractPackage.prs.length === 0) reasons.push("pr_plan_empty");
  if (new Set(contractPackage.prs.map((pr) => pr.id)).size !== contractPackage.prs.length) {
    reasons.push("duplicate_pr_id");
  }
  if (!prById.has(contractPackage.activePrId)) {
    reasons.push(`live_active_pr_unknown:${contractPackage.activePrId}`);
  }

  for (const pr of contractPackage.prs.filter((item) => provenStatuses.has(item.status))) {
    if (!contractPackage.evidencePrIds.includes(pr.id)) {
      reasons.push(`proven_pr_missing_evidence:${pr.id}`);
    }
  }

  if (!gitSnapshot.clean) reasons.push("git_worktree_dirty");
  if (!gitSnapshot.baselineIsAncestor) reasons.push("baseline_not_ancestor_of_head");
  if (
    contractPackage.expectedBranchPrefix !== null
    && !gitSnapshot.branch.startsWith(contractPackage.expectedBranchPrefix)
  ) {
    reasons.push(`git_branch_mismatch:${gitSnapshot.branch}`);
  }

  const activePr = prById.get(contractPackage.activePrId);
  const nextPr = activePr && runnableStatuses.has(activePr.status) && dependenciesProven(activePr, prById)
    ? activePr
    : contractPackage.prs.find((pr) => runnableStatuses.has(pr.status) && dependenciesProven(pr, prById));

  if (!nextPr) {
    reasons.push("no_runnable_pr");
    return blocked(reasons);
  }

  if (activePr && !dependenciesProven(activePr, prById)) {
    reasons.push(`active_pr_dependencies_not_proven:${activePr.id}`);
  }

  const expectedAction = actionFor(nextPr.id);
  if (contractPackage.nextAuthorizedAction !== expectedAction) {
    reasons.push(
      `live_action_mismatch:expected=${expectedAction},actual=${contractPackage.nextAuthorizedAction}`,
    );
  }

  if (reasons.length > 0) return blocked(reasons, nextPr.id, expectedAction);

  return {
    allowed: true,
    state: "READY_FOR_EXECUTION",
    nextPrId: nextPr.id,
    nextAuthorizedAction: expectedAction,
    reasons: [],
  };
}

function parsePrs(markdown: string): ContractPr[] {
  const parsed: ContractPr[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\|\s*`(P\d-PR\d{2})`\s*\|\s*`([A-Z_]+)`\s*\|\s*([^|]+)\|/);
    if (!match) continue;

    const status = match[2] as ContractPrStatus;
    if (!isContractPrStatus(status)) throw new Error(`unknown_pr_status:${status}`);

    parsed.push({
      id: match[1],
      status,
      dependencies: parseDependencies(match[3]),
    });
  }

  return parsed;
}

function parseDependencies(cell: string): string[] {
  return unique([...cell.matchAll(/\bP\d(?:-PR\d{2})?\b/g)].map((match) => match[0]));
}

function dependenciesProven(pr: ContractPr, prById: Map<string, ContractPr>): boolean {
  return pr.dependencies.every((dependency) => {
    if (/^P\d$/.test(dependency)) {
      const phasePrs = [...prById.values()].filter((candidate) => candidate.id.startsWith(`${dependency}-`));
      return phasePrs.length > 0 && phasePrs.every((candidate) => provenStatuses.has(candidate.status));
    }

    const dependencyPr = prById.get(dependency);
    return dependencyPr !== undefined && provenStatuses.has(dependencyPr.status);
  });
}

function actionFor(prId: string): string {
  if (prId === "P0-PR03") return "START_P0_PR03_RECONCILER";
  return `START_${prId.replaceAll("-", "_")}`;
}

function blocked(
  reasons: string[],
  nextPrId: string | null = null,
  nextAuthorizedAction: string | null = null,
): ReconciliationResult {
  return {
    allowed: false,
    state: "BLOCKED_STATE_DIVERGENCE",
    nextPrId,
    nextAuthorizedAction,
    reasons,
  };
}

function requiredMarkdownValue(markdown: string, key: string): string {
  const value = optionalMarkdownValue(markdown, key);
  if (value === null || value === "") throw new Error(`contract_package_missing:${key}`);
  return value;
}

function optionalMarkdownValue(markdown: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp("^- `" + escaped + "`: `([^`]+)`", "m"));
  return match?.[1] ?? null;
}

function isContractPrStatus(value: string): value is ContractPrStatus {
  return [
    "HISTORICAL_BASELINE",
    "READY_FOR_OWNER_REVIEW",
    "BLOCKED",
    "PENDING",
    "READY",
    "RUNNING",
    "PROVEN",
    "REJECTED",
    "SUPERSEDED",
  ].includes(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

async function git(repositoryRoot: string, args: string[]): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn("git", args, { cwd: repositoryRoot, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `git_exit_${code}`));
    });
  });
}

async function gitSucceeds(repositoryRoot: string, args: string[]): Promise<boolean> {
  try {
    await git(repositoryRoot, args);
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await reconcileRepository(process.cwd());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.allowed) process.exitCode = 1;
}

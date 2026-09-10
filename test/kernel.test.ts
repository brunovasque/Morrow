import assert from "node:assert/strict";
import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JsonlEventLog } from "../src/event-log.ts";
import { MorrowKernel } from "../src/kernel.ts";
import { ProcessRuntimeAdapter } from "../src/runtime-adapter.ts";
import type { ContextManifest } from "../src/types.ts";
import { LocalWorkspaceManager } from "../src/workspace-manager.ts";

async function harness() {
  const root = await mkdtemp(join(tmpdir(), "morrow-test-"));
  const file = join(root, "events.jsonl");
  return { root, file, kernel: new MorrowKernel(new JsonlEventLog(file)) };
}

const kernelActor = { kind: "kernel" as const, id: "test-kernel" };

async function seed(kernel: MorrowKernel, contractId = "C1") {
  await kernel.emit({
    contractId,
    type: "CONTRACT_REGISTERED",
    actor: kernelActor,
    payload: { destinationHash: "dest-v1" },
  });
  await kernel.emit({
    contractId,
    type: "OBJECTIVE_ACTIVATED",
    actor: kernelActor,
    payload: { objective: "deliver objective", stepId: "S1", routeNode: "EXECUTION" },
  });
}

function manifest(overrides: Partial<ContextManifest> = {}): ContextManifest {
  return {
    contractId: "C1",
    contractHash: "contract-hash",
    stepId: "S1",
    objective: "deliver objective",
    roleId: "executor",
    roleSpecHash: "role-hash",
    allowedArtifacts: ["src/**"],
    readScope: ["src/**", "test/**"],
    completionCriteria: ["observable result passes"],
    requiredRegressionChecks: ["baseline"],
    resolvedOwnerDecisions: [],
    openOwnerDecisions: [],
    promotedMemoryRefs: [],
    skills: [],
    requiredCapabilities: ["repo.write"],
    availableCapabilities: ["repo.write"],
    ...overrides,
  };
}

test("PRE_DISPATCH accepts only the active contract step and objective", async () => {
  const { kernel } = await harness();
  await seed(kernel);

  const accepted = await kernel.preDispatch(manifest());
  assert.equal(accepted.allowed, true);

  const staleStep = await kernel.preDispatch(manifest({ stepId: "S2" }));
  assert.equal(staleStep.allowed, false);
  assert.ok(staleStep.reasons.includes("active_step_mismatch"));

  const staleObjective = await kernel.preDispatch(manifest({ objective: "different destination" }));
  assert.equal(staleObjective.allowed, false);
  assert.ok(staleObjective.reasons.includes("active_objective_mismatch"));
});

test("rehydrates live contract state from append-only events", async () => {
  const { file, kernel } = await harness();
  await seed(kernel);
  await kernel.emit({
    contractId: "C1",
    type: "OWNER_DECISION_RECORDED",
    actor: { kind: "human", id: "owner" },
    payload: { key: "deploy", value: "preview-only" },
  });

  const restarted = new MorrowKernel(new JsonlEventLog(file));
  const state = await restarted.state("C1");
  assert.equal(state.destinationHash, "dest-v1");
  assert.equal(state.activeObjective, "deliver objective");
  assert.equal(state.decisions.deploy, "preview-only");
});

test("PRE_DISPATCH refuses incomplete or blocked work before an agent is called", async () => {
  const { kernel } = await harness();
  await seed(kernel);

  const missingCapability = await kernel.preDispatch(
    manifest({ availableCapabilities: [] }),
  );
  assert.equal(missingCapability.allowed, false);
  assert.match(missingCapability.reasons.join("|"), /capability_missing/);

  await kernel.emit({
    contractId: "C1",
    type: "BLOCKER_OPENED",
    actor: kernelActor,
    payload: { kind: "OWNER_DECISION", reason: "destination authority required" },
  });
  const blocked = await kernel.preDispatch(manifest());
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reasons.includes("contract_blocked"));
});

test("execution graph can loop review -> diagnostic -> execution -> review without phase lock", async () => {
  const { kernel } = await harness();
  await seed(kernel);

  for (const [actor, to] of [
    ["executor", "REVIEW"],
    ["reviewer", "DIAGNOSTIC"],
    ["diagnostician", "EXECUTION"],
    ["executor", "REVIEW"],
    ["reviewer", "AUDIT"],
    ["auditor", "EXECUTION"],
    ["executor", "AUDIT"],
  ] as const) {
    await kernel.emit({
      contractId: "C1",
      type: "ROUTE_MOVED",
      actor: { kind: "agent", id: actor },
      payload: { to },
    });
  }

  assert.equal((await kernel.state("C1")).routeNode, "AUDIT");
});

test("meeting can open from review and return to any valid route chosen by governance", async () => {
  const { kernel } = await harness();
  await seed(kernel);
  await kernel.emit({
    contractId: "C1",
    type: "ROUTE_MOVED",
    actor: { kind: "agent", id: "executor" },
    payload: { to: "REVIEW" },
  });
  await kernel.emit({
    contractId: "C1",
    type: "MEETING_OPENED",
    actor: { kind: "agent", id: "reviewer" },
    payload: {
      meetingId: "M1",
      question: "is the diagnostic evidence sufficient?",
      participants: ["reviewer", "diagnostician", "orchestrator"],
    },
  });
  assert.equal((await kernel.state("C1")).openMeeting?.meetingId, "M1");

  await kernel.emit({
    contractId: "C1",
    type: "MEETING_RESOLVED",
    actor: { kind: "agent", id: "orchestrator" },
    payload: { outcome: "DIAGNOSTIC_REQUIRED" },
  });
  await kernel.emit({
    contractId: "C1",
    type: "ROUTE_MOVED",
    actor: { kind: "agent", id: "orchestrator" },
    payload: { to: "DIAGNOSTIC" },
  });

  const state = await kernel.state("C1");
  assert.equal(state.openMeeting, null);
  assert.equal(state.routeNode, "DIAGNOSTIC");
});

test("changing a covered surface invalidates earlier evidence instead of keeping a false green", async () => {
  const { kernel } = await harness();
  await seed(kernel);
  await kernel.emit({
    contractId: "C1",
    type: "EVIDENCE_RECORDED",
    actor: { kind: "agent", id: "auditor" },
    payload: {
      evidenceId: "E1",
      kind: "regression",
      surfaces: ["auth", "checkout"],
    },
  });
  assert.equal((await kernel.state("C1")).evidence.E1.status, "fresh");

  await kernel.emit({
    contractId: "C1",
    type: "SURFACE_CHANGED",
    actor: { kind: "agent", id: "executor" },
    payload: { surfaces: ["auth"] },
  });
  assert.equal((await kernel.state("C1")).evidence.E1.status, "stale");
});

test("local workspace manager isolates ephemeral workspaces under managed root", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-workspaces-"));
  const manager = new LocalWorkspaceManager(root);
  const workspace = await manager.create({
    workspaceId: "W1",
    contractId: "C1",
    roleId: "executor",
  });
  await access(workspace.root);
  assert.match(workspace.root, /C1/);
  assert.match(workspace.root, /W1/);
  await manager.destroy(workspace);
  await assert.rejects(access(workspace.root));
});

test("process runtime adapter passes prompt through stdin without provider coupling", async () => {
  const adapter = new ProcessRuntimeAdapter();
  const result = await adapter.invoke({
    invocationId: "I1",
    runtimeId: "fake-quota-runtime",
    accessMode: "quota-session",
    command: process.execPath,
    args: ["-e", "process.stdin.setEncoding('utf8'); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>process.stdout.write('ACK:'+d))"],
    prompt: "hello-runtime",
    cwd: process.cwd(),
    timeoutMs: 2000,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.timedOut, false);
  assert.equal(result.stdout, "ACK:hello-runtime");
  assert.equal(result.accessMode, "quota-session");
});

test("process runtime adapter enforces timeout mechanically", async () => {
  const adapter = new ProcessRuntimeAdapter();
  const result = await adapter.invoke({
    invocationId: "I2",
    runtimeId: "fake-runtime",
    accessMode: "local",
    command: process.execPath,
    args: ["-e", "setTimeout(()=>{}, 5000)"],
    prompt: "",
    cwd: process.cwd(),
    timeoutMs: 50,
  });

  assert.equal(result.timedOut, true);
});

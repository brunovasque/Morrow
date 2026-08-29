import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  AuthenticatedDispatchService,
  PowerShellProcessExecutor,
  WorkSpecRegistry,
  canonicalSha256,
  type AgentExecutionRequest,
  type AgentExecutionResult,
  type AgentWorkSpec,
  type DeterministicProcessExecutor,
  type GovernedAgentExecutor,
  type GovernedWorkSpec,
  type ProcessExecutionResult,
} from "../src/authenticated-dispatch.ts";
import {
  CapabilityRegistry,
  GovernanceResolver,
  RoleRegistry,
  SecretPolicyRegistry,
  SkillRegistry,
  TargetRegistry,
  type CapabilitySpec,
  type RegistryRef,
  type RoleSpec,
} from "../src/governance-registries.ts";
import { LocalWorkerService } from "../src/local-worker-service.ts";
import { FileLockManager } from "../src/lock-manager.ts";
import { evaluatePreDispatch } from "../src/pre-dispatch.ts";
import {
  AccessPolicyRegistry,
  BudgetGuard,
  ModelProfileRegistry,
  QuotaGuard,
  RoutingPolicyRegistry,
  RoutingResolver,
  RuntimeRegistry,
  type AccessMode,
  type BudgetPolicySpec,
  type QuotaPoolSpec,
} from "../src/routing-guards.ts";
import { ManagedTerminalRuntimeAdapter, TerminalSessionManager } from "../src/terminal-session.ts";
import type { ContextManifest, LiveContractState } from "../src/types.ts";
import {
  WORKER_PROTOCOL_ID,
  WORKER_PROTOCOL_VERSION,
  type WorkerProtocolMessage,
  type WorkerProtocolPeer,
  type WorkerProtocolValidationContext,
} from "../src/worker-protocol.ts";
import { LocalWorkspaceManager } from "../src/workspace-manager.ts";

const contractId = "contract-fixture";
const stepId = "P2-PR05";
const targetId = "fixture-target";
const now = "2026-08-29T12:00:00.000Z";
const roleRef = ref("executor");
const skillRef = ref("dispatch-fixture");
const secretPolicyRef = ref("secrets-none");
const routingPolicyRef = ref("routing-global");
const accessPolicyRef = ref("access-fixture");
const runtimeRef = ref("runtime-fixture");
const modelProfileRef = ref("profile-fixture");
const modelRef = ref("model-fixture");
const quotaPoolRef = ref("quota-fixture");
const budgetPolicyRef = ref("budget-fixture");
const controlPeer: WorkerProtocolPeer = { kind: "control-plane", id: "control-main", instanceId: "control-instance-1" };
const workerPeer: WorkerProtocolPeer = { kind: "worker", id: "worker-local-1", instanceId: "worker-instance-1" };

interface HarnessOptions {
  kind?: "process" | "agent";
  accessMode?: AccessMode;
  processExecutor?: DeterministicProcessExecutor;
  agentExecutor?: GovernedAgentExecutor;
  blocked?: boolean;
  quotaBlocked?: boolean;
  budgetBlocked?: boolean;
  specTargetId?: string;
}

interface Harness {
  service: AuthenticatedDispatchService;
  worker: LocalWorkerService;
  root: string;
  workspaceRoot: string;
  workspacePath: string;
  locks: FileLockManager;
  quota: QuotaGuard;
  budget: BudgetGuard;
  reference: { artifactId: string; sha256: string };
  message(overrides?: Partial<WorkerProtocolMessage["body"]>): WorkerProtocolMessage;
}

function ref(id: string, version = "1.0.0"): RegistryRef {
  return { id, version };
}

function okProcess(stdout = "fixture-ok"): ProcessExecutionResult {
  return { exitCode: 0, timedOut: false, durationMs: 1, stdout, stderr: "" };
}

function okAgent(stdout = "fixture-agent-ok"): AgentExecutionResult {
  return { ...okProcess(stdout), quotaConsumedUnits: null, actualCostMinor: null };
}

async function buildHarness(t: { after(callback: () => void | Promise<void>): void }, options: HarnessOptions = {}): Promise<Harness> {
  const kind = options.kind ?? "process";
  const accessMode = options.accessMode ?? "local";
  const capabilityRef = ref(kind === "process" ? "process.spawn.scoped" : "agent.runtime.scoped");
  const capabilityKind: CapabilitySpec["kind"] = kind === "process" ? "process" : "agent-runtime";
  const root = await mkdtemp(join(tmpdir(), "morrow-p2-pr05-"));
  const managedRoot = join(root, ".morrow", "worker");
  const operatorRoot = join(root, "operator-owned");
  const worker = new LocalWorkerService({
    workerId: "worker-local-1",
    managedRoot,
    operatorOwnedRoots: [operatorRoot],
    supportedProtocolVersions: [WORKER_PROTOCOL_VERSION],
    dispatchEnabled: true,
  });
  const workerStatus = await worker.start();
  assert.equal(workerStatus.state, "ready");
  assert.ok(workerStatus.layout);
  const layout = workerStatus.layout!;
  t.after(async () => {
    await worker.stop();
    await rm(root, { recursive: true, force: true });
  });

  const role: RoleSpec = {
    roleId: roleRef.id,
    version: roleRef.version,
    allowedSkills: [skillRef],
    allowedCapabilities: [capabilityRef],
    requiredCapabilities: [capabilityRef],
    enabled: true,
  };
  const manifest: ContextManifest = {
    contractId,
    contractHash: "a".repeat(64),
    stepId,
    objective: "Prove authenticated dispatch without external targets.",
    roleId: roleRef.id,
    roleSpecHash: canonicalSha256(role),
    allowedArtifacts: [kind === "process" ? "powershell-fixture" : "agent-fixture"],
    readScope: ["fixture-only"],
    completionCriteria: ["isolated execution completed"],
    requiredRegressionChecks: ["npm-test"],
    resolvedOwnerDecisions: ["fixture-approved"],
    openOwnerDecisions: [],
    promotedMemoryRefs: [],
    skills: [skillRef],
    requiredCapabilities: [capabilityRef.id],
    availableCapabilities: [capabilityRef.id],
  };
  const quotaPlan = accessMode === "quota-session" ? { units: 10, priority: "standard" as const } : null;
  const budgetPlan = accessMode === "api" ? { currency: "USD", amountMinor: 50 } : null;
  const spec: GovernedWorkSpec = kind === "process"
    ? {
        kind,
        artifactId: "powershell-fixture",
        targetId: options.specTargetId ?? targetId,
        authority: { role: roleRef, skills: [skillRef], capabilities: [capabilityRef], secretRequests: [] },
        contextManifest: manifest,
        script: "$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); Write-Output ('PROCESS_OK|' + (Get-Location).Path)",
      }
    : {
        kind,
        artifactId: "agent-fixture",
        targetId: options.specTargetId ?? targetId,
        authority: { role: roleRef, skills: [skillRef], capabilities: [capabilityRef], secretRequests: [] },
        contextManifest: manifest,
        prompt: "AGENT_FIXTURE_PROMPT",
        routingPolicies: { globalPolicy: routingPolicyRef },
        quota: quotaPlan,
        budget: budgetPlan,
      } satisfies AgentWorkSpec;
  const workSpecs = new WorkSpecRegistry([spec]);
  const reference = workSpecs.reference(spec.artifactId)!;

  const governance = new GovernanceResolver({
    targets: new TargetRegistry([{
      targetId,
      descriptorVersion: "1.0.0",
      repositoryLocatorRef: "repository.fixture-only",
      baseRef: "refs/heads/main",
      writeMode: "branch-only",
      allowedPaths: ["fixture/**"],
      forbiddenPaths: ["external/**"],
      requiredChecks: ["npm-test"],
      regressionProfileId: "regression.fixture",
      secretPolicy: secretPolicyRef,
      deploymentPolicyId: "deploy.none",
      rollbackPolicyId: "rollback.fixture",
      ownerPolicyId: "owner.fixture",
      allowedRoles: [roleRef],
      allowedSkills: [skillRef],
      allowedCapabilities: [capabilityRef],
      enabled: true,
    }]),
    roles: new RoleRegistry([role]),
    skills: new SkillRegistry([{
      skillId: skillRef.id,
      version: skillRef.version,
      allowedRoles: [roleRef],
      requiredCapabilities: [capabilityRef],
      enabled: true,
    }]),
    capabilities: new CapabilityRegistry([{
      capabilityId: capabilityRef.id,
      version: capabilityRef.version,
      kind: capabilityKind,
      risk: "medium",
      enabled: true,
    }]),
    secretPolicies: new SecretPolicyRegistry([{
      policyId: secretPolicyRef.id,
      version: secretPolicyRef.version,
      rules: [],
      enabled: true,
    }]),
  });

  const runtimeQuotaPool = accessMode === "quota-session" ? quotaPoolRef : null;
  const selection = {
    controlMode: "manual" as const,
    accessPolicy: accessPolicyRef,
    accessMode,
    runtime: runtimeRef,
    modelProfile: modelProfileRef,
    model: modelRef,
    effort: "high" as const,
    ...(accessMode === "api" ? { budgetPolicy: budgetPolicyRef, maxInvocationCostMinor: 100 } : {}),
  };
  const routing = new RoutingResolver({
    accessPolicies: new AccessPolicyRegistry([{
      policyId: accessPolicyRef.id,
      version: accessPolicyRef.version,
      allowedModes: [accessMode],
      preferredMode: accessMode,
      apiFallbackAllowed: accessMode === "api",
      enabled: true,
    }]),
    modelProfiles: new ModelProfileRegistry([{
      profileId: modelProfileRef.id,
      version: modelProfileRef.version,
      requiredCapabilities: ["fixture-capability"],
      enabled: true,
    }]),
    runtimes: new RuntimeRegistry([{
      runtimeId: runtimeRef.id,
      version: runtimeRef.version,
      providerId: "fixture-provider",
      accessMode,
      quotaPool: runtimeQuotaPool,
      models: [{
        modelId: modelRef.id,
        version: modelRef.version,
        supportedProfiles: [modelProfileRef],
        supportedEfforts: ["high"],
        capabilities: ["fixture-capability"],
        enabled: true,
      }],
      enabled: true,
    }]),
    routingPolicies: new RoutingPolicyRegistry([{
      policyId: routingPolicyRef.id,
      version: routingPolicyRef.version,
      scope: "global",
      scopeId: "global",
      selection,
      enabled: true,
    }]),
  });

  const quotaSpec: QuotaPoolSpec = {
    poolId: quotaPoolRef.id,
    version: quotaPoolRef.version,
    concurrencyLimit: 1,
    quota: {
      measurable: true,
      unit: "fixture-unit",
      remainingUnits: options.quotaBlocked ? 10 : 100,
      reserveUnits: options.quotaBlocked ? 10 : 0,
      observedAt: "2026-08-29T11:59:00.000Z",
      resetAt: "2026-08-29T13:00:00.000Z",
    },
    enabled: true,
  };
  const budgetSpec: BudgetPolicySpec = {
    policyId: budgetPolicyRef.id,
    version: budgetPolicyRef.version,
    currency: "USD",
    periodId: "2026-08",
    limits: options.budgetBlocked
      ? { invocationMinor: 25, stepMinor: 25, contractMinor: 25, providerMinor: 25, periodMinor: 25 }
      : { invocationMinor: 100, stepMinor: 200, contractMinor: 300, providerMinor: 300, periodMinor: 500 },
    enabled: true,
  };
  const quota = new QuotaGuard(accessMode === "quota-session" ? [quotaSpec] : [], () => now);
  const budget = new BudgetGuard(accessMode === "api" ? [budgetSpec] : []);
  const locks = new FileLockManager(join(layout.stateRoot, "locks"));
  const workspaceId = `workspace-${kind}-${accessMode}`;
  const workspacePath = join(layout.workspaceRoot, contractId, workspaceId);
  const state: LiveContractState = {
    contractId,
    destinationHash: "a".repeat(64),
    activeObjective: manifest.objective,
    activeStepId: stepId,
    routeNode: "AUTHENTICATED_DISPATCH_AND_EXECUTION",
    blockers: options.blocked ? [{ kind: "fixture", reason: "blocked" }] : [],
    openMeeting: null,
    decisions: {},
    debts: [],
    evidence: {},
    lastEventId: null,
  };
  const requiredScopes = [
    "message:control.dispatch",
    "dispatch:create",
    `contract:${contractId}`,
    `step:${stepId}`,
    `target:${targetId}`,
    `capability:${capabilityRef.id}`,
  ];
  const validationContext = (): WorkerProtocolValidationContext => ({
    now,
    supportedVersions: [WORKER_PROTOCOL_VERSION],
    authenticatedPeer: controlPeer,
    localPeer: workerPeer,
    verifiedCredentialId: "control-credential-1",
    verifiedAuthorization: {
      decisionId: "authorization-decision-1",
      scopes: requiredScopes,
      expiresAt: "2026-08-29T12:05:00.000Z",
    },
    authorizedMessageTypes: ["control.dispatch"],
    seenMessageIds: new Set(),
    seenNonces: new Set(),
  });
  const service = new AuthenticatedDispatchService({
    validationContext,
    workerReady: () => worker.status().dispatchAccepted,
    workSpecs,
    governance,
    routing,
    quota,
    budget,
    locks,
    workspaces: new LocalWorkspaceManager(layout.workspaceRoot),
    preDispatch: (input) => evaluatePreDispatch(input, state),
    processExecutor: options.processExecutor ?? { execute: async () => okProcess() },
    agentExecutor: options.agentExecutor ?? { execute: async () => okAgent() },
  });

  let sequence = 10;
  function message(overrides: Partial<WorkerProtocolMessage["body"]> = {}): WorkerProtocolMessage {
    sequence += 1;
    const body = {
      dispatchId: `dispatch-${kind}-${accessMode}`,
      idempotencyKey: `effect-${kind}-${accessMode}`,
      contractId,
      stepId,
      targetId,
      kind,
      workSpec: reference,
      workspace: { workspaceId, isolation: "dedicated" as const },
      requiredCapabilities: [capabilityRef.id],
      timeoutMs: 10_000,
      ...overrides,
    } as WorkerProtocolMessage["body"];
    return {
      protocol: WORKER_PROTOCOL_ID,
      protocolVersion: WORKER_PROTOCOL_VERSION,
      messageId: `message-${kind}-${accessMode}-${sequence}`,
      messageType: "control.dispatch",
      sender: controlPeer,
      recipient: workerPeer,
      issuedAt: "2026-08-29T11:59:30.000Z",
      expiresAt: "2026-08-29T12:01:00.000Z",
      sequence,
      correlationId: `correlation-${kind}-${accessMode}`,
      security: {
        scheme: "transport-bound-v1",
        credentialId: "control-credential-1",
        nonce: `nonce-${kind}-${accessMode}-${sequence}-1234567890`,
        proof: "verified-proof-material-control",
      },
      authorization: {
        decisionId: "authorization-decision-1",
        scopes: requiredScopes,
        expiresAt: "2026-08-29T12:05:00.000Z",
      },
      body,
    };
  }

  return { service, worker, root, workspaceRoot: layout.workspaceRoot, workspacePath, locks, quota, budget, reference, message };
}

test("executes a registered immutable PowerShell work spec in a dedicated worker workspace", async (t) => {
  assert.equal(process.platform, "win32", "P2-PR05 PowerShell proof requires Windows");
  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  const environment = Object.fromEntries(
    ["SystemRoot", "WINDIR", "TEMP", "TMP"].flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key] as string]]),
  );
  const executor = new PowerShellProcessExecutor({
    executablePath: join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    environment,
  });
  const harness = await buildHarness(t, { kind: "process", processExecutor: executor });
  const result = await harness.service.dispatch(harness.message());

  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.equal(result.execution.status, "completed");
  assert.match(result.execution.stdout, /PROCESS_OK\|/);
  assert.equal(result.execution.workspaceRoot, harness.workspacePath);
  assert.match(result.execution.stdout.toLowerCase(), new RegExp(escapeRegex(harness.workspacePath.toLowerCase())));
  await assert.rejects(access(harness.workspacePath));
});

test("creates a governed AgentInstance and runs it through an isolated process-backed agent boundary", async (t) => {
  let observed: AgentExecutionRequest | null = null;
  let adapter: ManagedTerminalRuntimeAdapter | null = null;
  const agentExecutor: GovernedAgentExecutor = {
    async execute(request) {
      observed = request;
      assert.ok(adapter);
      const result = await adapter!.invoke({
        invocationId: request.instance.invocationId,
        terminalSessionId: `terminal-${request.instance.agentInstanceId}`,
        agentInstanceId: request.instance.agentInstanceId,
        contractId: request.instance.contractId,
        roleId: request.instance.roleId,
        runtimeId: request.instance.runtimeId,
        accessMode: request.instance.accessMode,
        workspaceId: request.workspace.workspaceId,
        workspace: request.workspace,
        command: process.execPath,
        args: ["-e", "process.stdin.setEncoding('utf8');let p='';process.stdin.on('data',d=>p+=d);process.stdin.on('end',()=>console.log('AGENT_OK|'+process.cwd()+'|'+p))"],
        prompt: request.prompt,
        timeoutMs: request.timeoutMs,
      });
      return {
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        durationMs: result.durationMs,
        stdout: result.stdout,
        stderr: result.stderr,
        quotaConsumedUnits: null,
        actualCostMinor: null,
      };
    },
  };
  const harness = await buildHarness(t, { kind: "agent", agentExecutor });
  adapter = new ManagedTerminalRuntimeAdapter(new TerminalSessionManager(harness.workspaceRoot));
  const result = await harness.service.dispatch(harness.message());

  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.equal(result.execution.status, "completed");
  assert.match(result.execution.stdout, /AGENT_OK\|/);
  assert.match(result.execution.stdout, /AGENT_FIXTURE_PROMPT/);
  assert.ok(observed);
  assert.equal(observed!.instance.workspaceId, result.execution.workspaceId);
  assert.equal(observed!.workspace.root, harness.workspacePath);
  assert.equal(result.execution.agentInstance?.terminalSessionId, null);
  assert.equal(result.execution.routing?.accessMode, "local");
  await assert.rejects(access(harness.workspacePath));
});

test("refuses unauthenticated, unregistered, mutable and pre-dispatch-blocked work before execution", async (t) => {
  let executions = 0;
  const processExecutor: DeterministicProcessExecutor = { execute: async () => { executions += 1; return okProcess(); } };
  const invalidAuth = await buildHarness(t, { processExecutor });
  const badCredential = invalidAuth.message();
  badCredential.security.credentialId = "unverified-credential";
  assert.equal((await invalidAuth.service.dispatch(badCredential) as { code: string }).code, "PROTOCOL_REJECTED");

  const badHash = invalidAuth.message({ workSpec: { artifactId: invalidAuth.reference.artifactId, sha256: "f".repeat(64) } } as never);
  assert.equal((await invalidAuth.service.dispatch(badHash) as { code: string }).code, "WORK_SPEC_NOT_FOUND");

  const rawScript = invalidAuth.message();
  (rawScript.body as unknown as Record<string, unknown>).script = "Write-Output 'not-authorized'";
  assert.equal((await invalidAuth.service.dispatch(rawScript) as { code: string }).code, "PROTOCOL_REJECTED");

  const blocked = await buildHarness(t, { processExecutor, blocked: true });
  assert.equal((await blocked.service.dispatch(blocked.message()) as { code: string }).code, "PRE_DISPATCH_BLOCKED");

  const reboundTarget = await buildHarness(t, { processExecutor, specTargetId: "other-target" });
  const targetResult = await reboundTarget.service.dispatch(reboundTarget.message());
  assert.equal(targetResult.ok, false);
  if (!targetResult.ok) {
    assert.equal(targetResult.code, "WORK_SPEC_BINDING_MISMATCH");
    assert.equal(targetResult.detail, "work_spec_target_mismatch");
  }
  assert.equal(executions, 0);
});

test("accepts new effects only while the Local Worker is ready", async (t) => {
  let executions = 0;
  const harness = await buildHarness(t, {
    processExecutor: { execute: async () => { executions += 1; return okProcess(); } },
  });
  await harness.worker.stop();
  const result = await harness.service.dispatch(harness.message());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "WORKER_NOT_READY");
  assert.equal(executions, 0);
});

test("shares one concurrent idempotent effect and refuses rebinding", async (t) => {
  let executions = 0;
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  const harness = await buildHarness(t, {
    processExecutor: {
      execute: async () => {
        executions += 1;
        await wait;
        return okProcess();
      },
    },
  });
  const message = harness.message();
  const first = harness.service.dispatch(message);
  const duplicate = harness.service.dispatch(structuredClone(message));
  release();
  const [firstResult, duplicateResult] = await Promise.all([first, duplicate]);
  assert.equal(firstResult.ok, true);
  assert.equal(duplicateResult.ok, true);
  assert.equal(firstResult.duplicate, false);
  assert.equal(duplicateResult.duplicate, true);
  assert.equal(executions, 1);

  await harness.worker.stop();
  const afterStop = await harness.service.dispatch(structuredClone(message));
  assert.equal(afterStop.ok, true);
  assert.equal(afterStop.duplicate, true);

  const rebound = harness.message({
    idempotencyKey: (message.body as { idempotencyKey: string }).idempotencyKey,
    dispatchId: "different-dispatch-id",
  } as never);
  const reboundResult = await harness.service.dispatch(rebound);
  assert.equal(reboundResult.ok, false);
  if (!reboundResult.ok) assert.equal(reboundResult.code, "IDEMPOTENCY_CONFLICT");
});

test("refuses target lock contention without creating a workspace", async (t) => {
  let executions = 0;
  const harness = await buildHarness(t, {
    processExecutor: { execute: async () => { executions += 1; return okProcess(); } },
  });
  assert.equal((await harness.locks.acquire(`target:${targetId}`, "other-owner", 60_000)).acquired, true);
  const result = await harness.service.dispatch(harness.message());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "LOCK_UNAVAILABLE");
  assert.equal(executions, 0);
  await assert.rejects(access(harness.workspacePath));
  assert.equal(await harness.locks.release(`target:${targetId}`, "other-owner"), true);
});

test("routes quota and API agent work through their deterministic guards", async (t) => {
  let agentExecutions = 0;
  const agentExecutor: GovernedAgentExecutor = { execute: async () => { agentExecutions += 1; return okAgent(); } };
  const quota = await buildHarness(t, { kind: "agent", accessMode: "quota-session", quotaBlocked: true, agentExecutor });
  const quotaResult = await quota.service.dispatch(quota.message());
  assert.equal(quotaResult.ok, false);
  if (!quotaResult.ok) assert.equal(quotaResult.code, "QUOTA_REJECTED");

  const budget = await buildHarness(t, { kind: "agent", accessMode: "api", budgetBlocked: true, agentExecutor });
  const budgetResult = await budget.service.dispatch(budget.message());
  assert.equal(budgetResult.ok, false);
  if (!budgetResult.ok) assert.equal(budgetResult.code, "BUDGET_REJECTED");
  assert.equal(agentExecutions, 0);
});

test("treats malformed agent settlement as execution failure and consumes the conservative reservation", async (t) => {
  const malformedExecutor: GovernedAgentExecutor = {
    execute: async () => ({ ...okAgent(), quotaConsumedUnits: -1 }),
  };
  const harness = await buildHarness(t, { kind: "agent", accessMode: "quota-session", agentExecutor: malformedExecutor });
  const result = await harness.service.dispatch(harness.message());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "EXECUTION_FAILED");
  const state = harness.quota.inspect(quotaPoolRef);
  assert.equal(state?.activeReservations, 0);
  assert.equal(state?.quota.measurable, true);
  if (state?.quota.measurable) assert.equal(state.quota.availableUnits, 90);

  const excessive = await buildHarness(t, {
    kind: "agent",
    accessMode: "quota-session",
    agentExecutor: { execute: async () => ({ ...okAgent(), quotaConsumedUnits: 11 }) },
  });
  const excessiveResult = await excessive.service.dispatch(excessive.message());
  assert.equal(excessiveResult.ok, false);
  if (!excessiveResult.ok) assert.equal(excessiveResult.code, "EXECUTION_FAILED");
  const excessiveState = excessive.quota.inspect(quotaPoolRef);
  assert.equal(excessiveState?.activeReservations, 0);
  if (excessiveState?.quota.measurable) assert.equal(excessiveState.quota.availableUnits, 90);
});

test("cleans workspace and lock after executor failure and keeps the failed effect idempotent", async (t) => {
  let executions = 0;
  const harness = await buildHarness(t, {
    processExecutor: {
      execute: async () => {
        executions += 1;
        throw new Error("sensitive executor detail must not cross boundary");
      },
    },
  });
  const message = harness.message();
  const first = await harness.service.dispatch(message);
  assert.equal(first.ok, false);
  if (!first.ok) {
    assert.equal(first.code, "EXECUTION_FAILED");
    assert.equal(first.detail, "executor_boundary_failed");
  }
  await assert.rejects(access(harness.workspacePath));
  const probe = await harness.locks.acquire(`target:${targetId}`, "cleanup-probe", 10_000);
  assert.equal(probe.acquired, true);
  assert.equal(await harness.locks.release(`target:${targetId}`, "cleanup-probe"), true);

  const duplicate = await harness.service.dispatch(structuredClone(message));
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(executions, 1);
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

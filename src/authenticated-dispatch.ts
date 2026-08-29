import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";
import type { AgentInstance } from "./agent-instance.ts";
import type {
  GovernanceResolver,
  RegistryRef,
  ResolvedWorkAuthority,
  SecretAccessRequest,
} from "./governance-registries.ts";
import type { LockResult } from "./lock-manager.ts";
import type {
  BudgetGuard,
  EffectiveRoutingConfiguration,
  QuotaGuard,
  QuotaPriority,
  RoutingResolver,
} from "./routing-guards.ts";
import type { ContextManifest, GateDecision } from "./types.ts";
import type {
  ControlDispatchBody,
  WorkerProtocolMessage,
  WorkerProtocolValidationContext,
  WorkerProtocolRejectionCode,
} from "./worker-protocol.ts";
import { validateWorkerProtocolMessage } from "./worker-protocol.ts";
import type { WorkspaceDescriptor } from "./workspace-manager.ts";

export interface WorkAuthoritySpec {
  role: RegistryRef;
  skills: RegistryRef[];
  capabilities: RegistryRef[];
  secretRequests: SecretAccessRequest[];
}

export interface RoutingPolicySelection {
  globalPolicy: RegistryRef;
  targetPolicy?: RegistryRef;
  contractPolicy?: RegistryRef;
  invocationPolicy?: RegistryRef;
}

export interface AgentQuotaPlan {
  units: number;
  priority: QuotaPriority;
}

export interface AgentBudgetPlan {
  currency: string;
  amountMinor: number;
}

interface WorkSpecBase {
  artifactId: string;
  targetId: string;
  authority: WorkAuthoritySpec;
  contextManifest: ContextManifest;
}

export interface PowerShellWorkSpec extends WorkSpecBase {
  kind: "process";
  script: string;
}

export interface AgentWorkSpec extends WorkSpecBase {
  kind: "agent";
  prompt: string;
  routingPolicies: RoutingPolicySelection;
  quota: AgentQuotaPlan | null;
  budget: AgentBudgetPlan | null;
}

export type GovernedWorkSpec = PowerShellWorkSpec | AgentWorkSpec;

export interface WorkSpecReference {
  artifactId: string;
  sha256: string;
}

interface RegisteredWorkSpec {
  reference: WorkSpecReference;
  spec: GovernedWorkSpec;
}

export class WorkSpecRegistry {
  private readonly entries: ReadonlyMap<string, RegisteredWorkSpec>;

  constructor(specs: readonly GovernedWorkSpec[]) {
    try {
      if (!Array.isArray(specs) || specs.length < 1 || specs.length > 512) {
        throw new WorkSpecValidationError("work_spec_registry_invalid");
      }
      const entries = new Map<string, RegisteredWorkSpec>();
      for (const raw of specs) {
        if (!validWorkSpec(raw)) throw new WorkSpecValidationError("work_spec_invalid");
        const spec = deepFreeze(structuredClone(raw));
        if (entries.has(spec.artifactId)) throw new WorkSpecValidationError("work_spec_duplicate");
        const reference = deepFreeze({
          artifactId: spec.artifactId,
          sha256: canonicalSha256(spec),
        });
        entries.set(spec.artifactId, deepFreeze({ reference, spec }));
      }
      this.entries = entries;
    } catch (error) {
      if (error instanceof WorkSpecValidationError) throw new Error(error.message);
      throw new Error("work_spec_invalid");
    }
  }

  reference(artifactId: string): WorkSpecReference | null {
    if (!isIdentifier(artifactId)) return null;
    return this.entries.get(artifactId)?.reference ?? null;
  }

  resolve(reference: WorkSpecReference): GovernedWorkSpec | null {
    if (!validWorkSpecReference(reference)) return null;
    const registered = this.entries.get(reference.artifactId);
    if (!registered || registered.reference.sha256 !== reference.sha256.toLowerCase()) return null;
    return registered.spec;
  }
}

export interface DispatchLockManager {
  acquire(resourceId: string, ownerId: string, ttlMs: number): Promise<LockResult>;
  release(resourceId: string, ownerId: string): Promise<boolean>;
}

export interface DispatchWorkspaceManager {
  create(params: { workspaceId: string; contractId: string; roleId: string }): Promise<WorkspaceDescriptor>;
  destroy(workspace: WorkspaceDescriptor): Promise<void>;
}

export type DispatchValidationContextProvider = (
  input: unknown,
) => WorkerProtocolValidationContext | Promise<WorkerProtocolValidationContext>;

export type DispatchPreflight = (manifest: ContextManifest) => GateDecision | Promise<GateDecision>;

export interface ProcessExecutionRequest {
  dispatchId: string;
  contractId: string;
  stepId: string;
  targetId: string;
  workspace: WorkspaceDescriptor;
  script: string;
  timeoutMs: number;
}

export interface ProcessExecutionResult {
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
}

export interface DeterministicProcessExecutor {
  execute(request: ProcessExecutionRequest): Promise<ProcessExecutionResult>;
}

export interface AgentExecutionRequest {
  instance: AgentInstance;
  authority: ResolvedWorkAuthority;
  routing: EffectiveRoutingConfiguration;
  workspace: WorkspaceDescriptor;
  prompt: string;
  timeoutMs: number;
}

export interface AgentExecutionResult extends ProcessExecutionResult {
  quotaConsumedUnits: number | null;
  actualCostMinor: number | null;
}

export interface GovernedAgentExecutor {
  execute(request: AgentExecutionRequest): Promise<AgentExecutionResult>;
}

export interface PowerShellExecutorConfiguration {
  executablePath: string;
  environment: Record<string, string>;
}

export class PowerShellProcessExecutor implements DeterministicProcessExecutor {
  private readonly configuration: PowerShellExecutorConfiguration;

  constructor(configuration: PowerShellExecutorConfiguration) {
    if (!validPowerShellConfiguration(configuration)) throw new Error("powershell_executor_configuration_invalid");
    this.configuration = deepFreeze(structuredClone(configuration));
  }

  async execute(request: ProcessExecutionRequest): Promise<ProcessExecutionResult> {
    const startedAt = Date.now();
    return await new Promise<ProcessExecutionResult>((resolvePromise, reject) => {
      const child = spawn(
        this.configuration.executablePath,
        ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "-"],
        {
          cwd: request.workspace.root,
          env: { ...this.configuration.environment },
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        },
      );
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;
      let outputLimitExceeded = false;
      let inputFailed = false;
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      const capture = (stream: "stdout" | "stderr", chunk: string): void => {
        if (outputLimitExceeded) return;
        if ((stream === "stdout" ? stdout.length : stderr.length) + chunk.length > maxCapturedOutputCharacters) {
          outputLimitExceeded = true;
          child.kill("SIGKILL");
          return;
        }
        if (stream === "stdout") stdout += chunk;
        else stderr += chunk;
      };
      child.stdout.on("data", (chunk) => { capture("stdout", chunk); });
      child.stderr.on("data", (chunk) => { capture("stderr", chunk); });
      child.stdin.once("error", () => {
        if (settled) return;
        inputFailed = true;
        child.kill("SIGKILL");
      });
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, request.timeoutMs);
      child.once("error", (error) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        reject(error);
      });
      child.once("close", (exitCode) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        if (outputLimitExceeded || inputFailed) {
          reject(new Error(outputLimitExceeded ? "powershell_output_limit_exceeded" : "powershell_input_failed"));
          return;
        }
        resolvePromise(deepFreeze({
          exitCode,
          timedOut,
          durationMs: Math.max(0, Date.now() - startedAt),
          stdout,
          stderr,
        }));
      });
      child.stdin.end(request.script, "utf8");
    });
  }
}

export type DispatchRejectionCode =
  | "PROTOCOL_REJECTED"
  | "MESSAGE_NOT_DISPATCH"
  | "IDEMPOTENCY_CONFLICT"
  | "IDEMPOTENCY_CAPACITY_EXHAUSTED"
  | "WORKER_NOT_READY"
  | "WORK_SPEC_NOT_FOUND"
  | "WORK_SPEC_KIND_MISMATCH"
  | "WORK_SPEC_BINDING_MISMATCH"
  | "PRE_DISPATCH_BLOCKED"
  | "AUTHORITY_REJECTED"
  | "SECRET_EXECUTION_NOT_SUPPORTED"
  | "ROUTING_REJECTED"
  | "RESOURCE_PLAN_INVALID"
  | "LOCK_UNAVAILABLE"
  | "WORKSPACE_REJECTED"
  | "QUOTA_REJECTED"
  | "BUDGET_REJECTED"
  | "EXECUTION_FAILED"
  | "RESOURCE_SETTLEMENT_FAILED"
  | "CLEANUP_FAILED"
  | "INTERNAL_BOUNDARY_FAILED";

export interface DispatchExecutionSummary {
  dispatchId: string;
  idempotencyKey: string;
  kind: "process" | "agent";
  status: "completed" | "failed" | "timed_out";
  workspaceId: string;
  workspaceRoot: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  agentInstance: AgentInstance | null;
  routing: EffectiveRoutingConfiguration | null;
}

export type AuthenticatedDispatchResult =
  | {
    ok: true;
    duplicate: boolean;
    execution: DispatchExecutionSummary;
  }
  | {
    ok: false;
    duplicate: boolean;
    code: DispatchRejectionCode;
    detail: string;
    protocolCode?: WorkerProtocolRejectionCode;
  };

export interface AuthenticatedDispatchDependencies {
  validationContext: DispatchValidationContextProvider;
  workerReady: () => boolean;
  workSpecs: WorkSpecRegistry;
  governance: GovernanceResolver;
  routing: RoutingResolver;
  quota: QuotaGuard;
  budget: BudgetGuard;
  locks: DispatchLockManager;
  workspaces: DispatchWorkspaceManager;
  preDispatch: DispatchPreflight;
  processExecutor: DeterministicProcessExecutor;
  agentExecutor: GovernedAgentExecutor;
  maxInMemoryDispatchRecords?: number;
}

interface DispatchRecord {
  fingerprint: string;
  dispatchId: string;
  operation: Promise<AuthenticatedDispatchResult>;
}

interface ResourceReservationState {
  quota: { reservationId: string; ownerId: string; units: number } | null;
  budget: { reservationId: string; ownerId: string; amountMinor: number } | null;
}

export class AuthenticatedDispatchService {
  private readonly dependencies: AuthenticatedDispatchDependencies;
  private readonly idempotency = new Map<string, DispatchRecord>();
  private readonly dispatchIds = new Map<string, string>();
  private readonly maxInMemoryDispatchRecords: number;

  constructor(dependencies: AuthenticatedDispatchDependencies) {
    const maximum = dependencies.maxInMemoryDispatchRecords ?? defaultMaxInMemoryDispatchRecords;
    if (!positiveSafeInteger(maximum) || maximum > absoluteMaxInMemoryDispatchRecords) {
      throw new Error("authenticated_dispatch_capacity_invalid");
    }
    this.dependencies = dependencies;
    this.maxInMemoryDispatchRecords = maximum;
  }

  async dispatch(input: unknown): Promise<AuthenticatedDispatchResult> {
    let context: WorkerProtocolValidationContext;
    try {
      context = await this.dependencies.validationContext(input);
    } catch {
      return rejected("INTERNAL_BOUNDARY_FAILED", "validation_context_unavailable");
    }

    let validation: ReturnType<typeof validateWorkerProtocolMessage>;
    try {
      validation = validateWorkerProtocolMessage(input, context);
    } catch {
      return rejected("PROTOCOL_REJECTED", "protocol_validation_failed");
    }
    if (!validation.ok) {
      return {
        ok: false,
        duplicate: false,
        code: "PROTOCOL_REJECTED",
        detail: "worker_protocol_message_rejected",
        protocolCode: validation.code,
      };
    }
    if (validation.message.messageType !== "control.dispatch") {
      return rejected("MESSAGE_NOT_DISPATCH", "control_dispatch_required");
    }

    const message = validation.message as WorkerProtocolMessage & { body: ControlDispatchBody };
    const body = message.body;
    const fingerprint = canonicalSha256(body);
    const existing = this.idempotency.get(body.idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint || existing.dispatchId !== body.dispatchId) {
        return rejected("IDEMPOTENCY_CONFLICT", "idempotency_key_rebound");
      }
      const result = await existing.operation;
      return withDuplicate(result);
    }
    const existingKey = this.dispatchIds.get(body.dispatchId);
    if (existingKey && existingKey !== body.idempotencyKey) {
      return rejected("IDEMPOTENCY_CONFLICT", "dispatch_id_rebound");
    }
    if (this.idempotency.size >= this.maxInMemoryDispatchRecords) {
      return rejected("IDEMPOTENCY_CAPACITY_EXHAUSTED", "in_memory_dispatch_capacity_exhausted");
    }

    try {
      if (this.dependencies.workerReady() !== true) {
        return rejected("WORKER_NOT_READY", "local_worker_not_ready");
      }
    } catch {
      return rejected("WORKER_NOT_READY", "local_worker_readiness_unavailable");
    }

    const operation = this.execute(body);
    this.dispatchIds.set(body.dispatchId, body.idempotencyKey);
    this.idempotency.set(body.idempotencyKey, { fingerprint, dispatchId: body.dispatchId, operation });
    return await operation;
  }

  private async execute(body: ControlDispatchBody): Promise<AuthenticatedDispatchResult> {
    const spec = this.dependencies.workSpecs.resolve(body.workSpec);
    if (!spec) return rejected("WORK_SPEC_NOT_FOUND", "work_spec_reference_not_registered");
    if (spec.kind !== body.kind) return rejected("WORK_SPEC_KIND_MISMATCH", "dispatch_kind_does_not_match_work_spec");

    const bindingError = workSpecBindingError(spec, body);
    if (bindingError) return rejected("WORK_SPEC_BINDING_MISMATCH", bindingError);

    let authorityResult: ReturnType<GovernanceResolver["resolve"]>;
    try {
      authorityResult = this.dependencies.governance.resolve({
        contractId: body.contractId,
        stepId: body.stepId,
        targetId: body.targetId,
        role: spec.authority.role,
        skills: spec.authority.skills,
        capabilities: spec.authority.capabilities,
        secretRequests: spec.authority.secretRequests,
      });
    } catch {
      return rejected("AUTHORITY_REJECTED", "governance_resolver_failed");
    }
    if (!authorityResult.ok) return rejected("AUTHORITY_REJECTED", authorityResult.code);
    const authority = authorityResult.authority;
    if (authority.secretAccess.length > 0) {
      return rejected("SECRET_EXECUTION_NOT_SUPPORTED", "p2_pr05_refuses_secret_delivery");
    }
    const requiredKind = spec.kind === "process" ? "process" : "agent-runtime";
    if (!authority.capabilities.some((capability) => capability.kind === requiredKind)) {
      return rejected("AUTHORITY_REJECTED", `required_capability_kind_missing:${requiredKind}`);
    }
    if (canonicalSha256(authority.role) !== spec.contextManifest.roleSpecHash) {
      return rejected("WORK_SPEC_BINDING_MISMATCH", "role_spec_hash_mismatch");
    }

    let gate: GateDecision;
    try {
      gate = await this.dependencies.preDispatch(spec.contextManifest);
    } catch {
      return rejected("PRE_DISPATCH_BLOCKED", "pre_dispatch_gate_failed");
    }
    if (!validGateDecision(gate) || !gate.allowed) {
      return rejected("PRE_DISPATCH_BLOCKED", validGateDecision(gate) ? gate.reasons.join(",") : "pre_dispatch_result_invalid");
    }

    let routing: EffectiveRoutingConfiguration | null = null;
    if (spec.kind === "agent") {
      let routingResult: ReturnType<RoutingResolver["resolve"]>;
      try {
        routingResult = this.dependencies.routing.resolve({
          invocationId: body.dispatchId,
          contractId: body.contractId,
          targetId: body.targetId,
          ...spec.routingPolicies,
        });
      } catch {
        return rejected("ROUTING_REJECTED", "routing_resolver_failed");
      }
      if (!routingResult.ok) return rejected("ROUTING_REJECTED", routingResult.code);
      routing = routingResult.configuration;
      const resourceError = agentResourcePlanError(spec, routing);
      if (resourceError) return rejected("RESOURCE_PLAN_INVALID", resourceError);
    }

    const lockResourceId = `target:${body.targetId}`;
    let lock: LockResult;
    try {
      lock = await this.dependencies.locks.acquire(lockResourceId, body.dispatchId, body.timeoutMs + lockCleanupGraceMs);
    } catch {
      return rejected("INTERNAL_BOUNDARY_FAILED", "lock_acquire_failed");
    }
    if (!lock.acquired) return rejected("LOCK_UNAVAILABLE", "target_lock_held");

    let workspace: WorkspaceDescriptor;
    try {
      workspace = await this.dependencies.workspaces.create({
        workspaceId: body.workspace.workspaceId,
        contractId: body.contractId,
        roleId: authority.role.roleId,
      });
    } catch {
      const releaseFailed = !(await safeReleaseLock(this.dependencies.locks, lockResourceId, body.dispatchId));
      return releaseFailed
        ? rejected("CLEANUP_FAILED", "workspace_create_and_lock_release_failed")
        : rejected("WORKSPACE_REJECTED", "managed_workspace_create_failed");
    }

    const reservations: ResourceReservationState = { quota: null, budget: null };
    if (spec.kind === "agent" && routing) {
      let reserved: AuthenticatedDispatchResult | null;
      try {
        reserved = this.reserveAgentResources(spec, routing, body, reservations);
      } catch {
        const cleanupOk = await this.cleanup(workspace, lockResourceId, body.dispatchId);
        return cleanupOk
          ? rejected("INTERNAL_BOUNDARY_FAILED", "resource_guard_failed")
          : rejected("CLEANUP_FAILED", "resource_guard_and_cleanup_failed");
      }
      if (reserved) {
        const cleanupOk = await this.cleanup(workspace, lockResourceId, body.dispatchId);
        return cleanupOk ? reserved : rejected("CLEANUP_FAILED", "resource_rejection_cleanup_failed");
      }
    }

    let executionResult: ProcessExecutionResult | AgentExecutionResult;
    let agentInstance: AgentInstance | null = null;
    let executorThrew = false;
    try {
      if (spec.kind === "process") {
        executionResult = await this.dependencies.processExecutor.execute({
          dispatchId: body.dispatchId,
          contractId: body.contractId,
          stepId: body.stepId,
          targetId: body.targetId,
          workspace,
          script: spec.script,
          timeoutMs: body.timeoutMs,
        });
      } else {
        agentInstance = deepFreeze({
          agentInstanceId: body.dispatchId,
          invocationId: body.dispatchId,
          terminalSessionId: null,
          roleId: authority.role.roleId,
          contractId: body.contractId,
          stepId: body.stepId,
          targetId: body.targetId,
          workspaceId: body.workspace.workspaceId,
          runtimeId: routing!.runtime.id,
          modelProfile: `${routing!.modelProfile.id}@${routing!.modelProfile.version}`,
          accessMode: routing!.accessMode,
          effort: routing!.effort,
          contextManifest: spec.contextManifest,
        });
        executionResult = await this.dependencies.agentExecutor.execute({
          instance: agentInstance,
          authority,
          routing: routing!,
          workspace,
          prompt: spec.prompt,
          timeoutMs: body.timeoutMs,
        });
      }
    } catch {
      executorThrew = true;
      executionResult = {
        exitCode: null,
        timedOut: false,
        durationMs: 0,
        stdout: "",
        stderr: "",
        ...(spec.kind === "agent" ? { quotaConsumedUnits: null, actualCostMinor: null } : {}),
      } as ProcessExecutionResult | AgentExecutionResult;
    }

    const executionResultValid = spec.kind === "process"
      ? validProcessExecutionResult(executionResult)
      : validAgentExecutionResult(executionResult) && validAgentSettlement(executionResult, reservations);
    let settlementOk = false;
    try {
      settlementOk = this.settleAgentResources(
        spec,
        executionResult,
        reservations,
        executorThrew || !executionResultValid,
      );
    } catch {
      settlementOk = false;
    }
    const cleanupOk = await this.cleanup(workspace, lockResourceId, body.dispatchId);
    if (!settlementOk) return rejected("RESOURCE_SETTLEMENT_FAILED", "agent_resource_settlement_rejected");
    if (!cleanupOk) return rejected("CLEANUP_FAILED", "workspace_or_lock_cleanup_failed");
    if (executorThrew || !executionResultValid) {
      return rejected("EXECUTION_FAILED", "executor_boundary_failed");
    }

    const status = executionResult.timedOut
      ? "timed_out"
      : executionResult.exitCode === 0
        ? "completed"
        : "failed";
    const execution = deepFreeze({
      dispatchId: body.dispatchId,
      idempotencyKey: body.idempotencyKey,
      kind: body.kind,
      status,
      workspaceId: workspace.workspaceId,
      workspaceRoot: workspace.root,
      exitCode: executionResult.exitCode,
      timedOut: executionResult.timedOut,
      durationMs: executionResult.durationMs,
      stdout: executionResult.stdout,
      stderr: executionResult.stderr,
      agentInstance,
      routing,
    });
    return { ok: true, duplicate: false, execution };
  }

  private reserveAgentResources(
    spec: AgentWorkSpec,
    routing: EffectiveRoutingConfiguration,
    body: ControlDispatchBody,
    state: ResourceReservationState,
  ): AuthenticatedDispatchResult | null {
    if (routing.accessMode === "quota-session") {
      const quota = this.dependencies.quota.reserve({
        reservationId: body.dispatchId,
        ownerId: body.dispatchId,
        pool: routing.quotaPool,
        units: spec.quota!.units,
        priority: spec.quota!.priority,
      });
      if (!quota.ok) return rejected("QUOTA_REJECTED", quota.code);
      state.quota = { reservationId: body.dispatchId, ownerId: body.dispatchId, units: spec.quota!.units };
    }
    if (routing.accessMode === "api") {
      const budget = this.dependencies.budget.reserve({
        reservationId: body.dispatchId,
        ownerId: body.dispatchId,
        policy: routing.budgetPolicy,
        contractId: body.contractId,
        stepId: body.stepId,
        invocationId: body.dispatchId,
        providerId: routing.providerId,
        currency: spec.budget!.currency,
        amountMinor: spec.budget!.amountMinor,
      });
      if (!budget.ok) return rejected("BUDGET_REJECTED", budget.code);
      state.budget = { reservationId: body.dispatchId, ownerId: body.dispatchId, amountMinor: spec.budget!.amountMinor };
    }
    return null;
  }

  private settleAgentResources(
    spec: GovernedWorkSpec,
    result: ProcessExecutionResult | AgentExecutionResult,
    state: ResourceReservationState,
    settleConservatively: boolean,
  ): boolean {
    if (spec.kind !== "agent") return true;
    let ok = true;
    const agentResult = result as AgentExecutionResult;
    if (state.quota) {
      const consumed = settleConservatively || agentResult.quotaConsumedUnits === null
        ? state.quota.units
        : agentResult.quotaConsumedUnits;
      ok = this.dependencies.quota.complete(state.quota.reservationId, state.quota.ownerId, consumed).ok && ok;
    }
    if (state.budget) {
      const actual = settleConservatively || agentResult.actualCostMinor === null
        ? state.budget.amountMinor
        : agentResult.actualCostMinor;
      ok = this.dependencies.budget.commit(state.budget.reservationId, state.budget.ownerId, actual).ok && ok;
    }
    return ok;
  }

  private async cleanup(workspace: WorkspaceDescriptor, lockResourceId: string, ownerId: string): Promise<boolean> {
    let ok = true;
    try {
      await this.dependencies.workspaces.destroy(workspace);
    } catch {
      ok = false;
    }
    if (!(await safeReleaseLock(this.dependencies.locks, lockResourceId, ownerId))) ok = false;
    return ok;
  }
}

function workSpecBindingError(spec: GovernedWorkSpec, body: ControlDispatchBody): string | null {
  const manifest = spec.contextManifest;
  if (spec.targetId !== body.targetId) return "work_spec_target_mismatch";
  if (manifest.contractId !== body.contractId) return "manifest_contract_mismatch";
  if (manifest.stepId !== body.stepId) return "manifest_step_mismatch";
  if (manifest.roleId !== spec.authority.role.id) return "manifest_role_mismatch";
  if (!manifest.allowedArtifacts.includes(spec.artifactId)) return "work_spec_artifact_not_allowed";
  const capabilityIds = spec.authority.capabilities.map((capability) => capability.id);
  if (!sameStringSet(capabilityIds, body.requiredCapabilities)) return "dispatch_capabilities_mismatch";
  if (!sameStringSet(manifest.requiredCapabilities, capabilityIds)) return "manifest_required_capabilities_mismatch";
  if (!sameStringSet(manifest.availableCapabilities, capabilityIds)) return "manifest_available_capabilities_mismatch";
  if (!sameRefs(spec.authority.skills, manifest.skills)) return "manifest_skills_mismatch";
  return null;
}

function agentResourcePlanError(spec: AgentWorkSpec, routing: EffectiveRoutingConfiguration): string | null {
  if (routing.accessMode === "quota-session") {
    if (!spec.quota || spec.budget !== null || !routing.quotaPool) return "quota_route_requires_quota_only";
  } else if (routing.accessMode === "api") {
    if (spec.quota !== null || !spec.budget || !routing.budgetPolicy || routing.maxInvocationCostMinor === null) {
      return "api_route_requires_budget_only";
    }
    if (spec.budget.amountMinor > routing.maxInvocationCostMinor) return "api_amount_exceeds_routing_ceiling";
  } else if (spec.quota !== null || spec.budget !== null) {
    return "local_route_refuses_quota_and_budget";
  }
  return null;
}

function validWorkSpec(value: unknown): value is GovernedWorkSpec {
  if (!isDataRecord(value)) return false;
  const baseKeys = ["artifactId", "targetId", "kind", "authority", "contextManifest"];
  const expected = value.kind === "process"
    ? [...baseKeys, "script"]
    : value.kind === "agent"
      ? [...baseKeys, "prompt", "routingPolicies", "quota", "budget"]
      : [];
  if (expected.length === 0 || exactKeys(value, expected) !== null) return false;
  if (!isIdentifier(value.artifactId) || !isIdentifier(value.targetId) || !validAuthoritySpec(value.authority) || !validContextManifest(value.contextManifest)) return false;
  if (value.kind === "process") {
    return typeof value.script === "string" && value.script.length >= 1 && value.script.length <= 131_072 && !value.script.includes("\0");
  }
  return isSafeText(value.prompt, 131_072)
    && validRoutingPolicies(value.routingPolicies)
    && (value.quota === null || validQuotaPlan(value.quota))
    && (value.budget === null || validBudgetPlan(value.budget));
}

function validAuthoritySpec(value: unknown): value is WorkAuthoritySpec {
  return isDataRecord(value)
    && exactKeys(value, ["role", "skills", "capabilities", "secretRequests"]) === null
    && validRef(value.role)
    && uniqueRefs(value.skills, 1, 64)
    && uniqueRefs(value.capabilities, 1, 128)
    && Array.isArray(value.secretRequests)
    && value.secretRequests.length <= 32
    && value.secretRequests.every(validSecretRequest);
}

function validSecretRequest(value: unknown): value is SecretAccessRequest {
  return isDataRecord(value)
    && exactKeys(value, ["secretRef", "purpose", "consumer", "capability"]) === null
    && isIdentifier(value.secretRef)
    && isIdentifier(value.purpose)
    && isDataRecord(value.consumer)
    && exactKeys(value.consumer, ["kind", "id"]) === null
    && (["runtime", "connector", "tool"] as unknown[]).includes(value.consumer.kind)
    && isIdentifier(value.consumer.id)
    && validRef(value.capability);
}

function validRoutingPolicies(value: unknown): value is RoutingPolicySelection {
  if (!isDataRecord(value) || !onlyKeys(value, ["globalPolicy", "targetPolicy", "contractPolicy", "invocationPolicy"])) return false;
  if (!validRef(value.globalPolicy)) return false;
  return ["targetPolicy", "contractPolicy", "invocationPolicy"].every((key) => value[key] === undefined || validRef(value[key]));
}

function validQuotaPlan(value: unknown): value is AgentQuotaPlan {
  return isDataRecord(value)
    && exactKeys(value, ["units", "priority"]) === null
    && positiveSafeInteger(value.units)
    && (value.priority === "standard" || value.priority === "critical");
}

function validBudgetPlan(value: unknown): value is AgentBudgetPlan {
  return isDataRecord(value)
    && exactKeys(value, ["currency", "amountMinor"]) === null
    && typeof value.currency === "string"
    && /^[A-Z]{3}$/.test(value.currency)
    && positiveSafeInteger(value.amountMinor);
}

function validContextManifest(value: unknown): value is ContextManifest {
  if (!isDataRecord(value) || exactKeys(value, [
    "contractId", "contractHash", "stepId", "objective", "roleId", "roleSpecHash",
    "allowedArtifacts", "readScope", "completionCriteria", "requiredRegressionChecks",
    "resolvedOwnerDecisions", "openOwnerDecisions", "promotedMemoryRefs", "skills",
    "requiredCapabilities", "availableCapabilities",
  ]) !== null) return false;
  return isIdentifier(value.contractId)
    && isSha256(value.contractHash)
    && isIdentifier(value.stepId)
    && isSafeText(value.objective, 16_384)
    && isIdentifier(value.roleId)
    && isSha256(value.roleSpecHash)
    && uniqueSafeTextArray(value.allowedArtifacts, 1, 256, 512)
    && uniqueSafeTextArray(value.readScope, 0, 256, 2_048)
    && uniqueSafeTextArray(value.completionCriteria, 1, 128, 2_048)
    && uniqueSafeTextArray(value.requiredRegressionChecks, 0, 128, 512)
    && uniqueSafeTextArray(value.resolvedOwnerDecisions, 0, 128, 512)
    && uniqueSafeTextArray(value.openOwnerDecisions, 0, 128, 512)
    && uniqueSafeTextArray(value.promotedMemoryRefs, 0, 128, 512)
    && uniqueRefs(value.skills, 1, 64)
    && uniqueIdentifiers(value.requiredCapabilities, 1, 128)
    && uniqueIdentifiers(value.availableCapabilities, 1, 128);
}

function validWorkSpecReference(value: unknown): value is WorkSpecReference {
  return isDataRecord(value)
    && exactKeys(value, ["artifactId", "sha256"]) === null
    && isIdentifier(value.artifactId)
    && isSha256(value.sha256);
}

function validPowerShellConfiguration(value: unknown): value is PowerShellExecutorConfiguration {
  if (!isDataRecord(value) || exactKeys(value, ["executablePath", "environment"]) !== null) return false;
  if (typeof value.executablePath !== "string" || !isAbsolute(value.executablePath)) return false;
  if (!isDataRecord(value.environment) || Object.keys(value.environment).length > 64) return false;
  return Object.entries(value.environment).every(([key, item]) => (
    /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key)
    && !/(token|secret|password|credential|api[_-]?key)/i.test(key)
    && typeof item === "string"
    && item.length <= 8_192
    && !item.includes("\0")
  ));
}

function validGateDecision(value: unknown): value is GateDecision {
  return isDataRecord(value)
    && exactKeys(value, ["allowed", "reasons"]) === null
    && typeof value.allowed === "boolean"
    && uniqueSafeTextArray(value.reasons, 0, 128, 512);
}

function validProcessExecutionResult(value: unknown): value is ProcessExecutionResult {
  if (!isDataRecord(value) || !onlyKeys(value, [
    "exitCode", "timedOut", "durationMs", "stdout", "stderr", "quotaConsumedUnits", "actualCostMinor",
  ])) return false;
  return (value.exitCode === null || nonNegativeSafeInteger(value.exitCode))
    && typeof value.timedOut === "boolean"
    && nonNegativeSafeInteger(value.durationMs)
    && typeof value.stdout === "string"
    && typeof value.stderr === "string"
    && value.stdout.length <= maxCapturedOutputCharacters
    && value.stderr.length <= maxCapturedOutputCharacters;
}

function validAgentExecutionResult(value: unknown): value is AgentExecutionResult {
  return validProcessExecutionResult(value)
    && isDataRecord(value)
    && Object.prototype.hasOwnProperty.call(value, "quotaConsumedUnits")
    && Object.prototype.hasOwnProperty.call(value, "actualCostMinor")
    && (value.quotaConsumedUnits === null || nonNegativeSafeInteger(value.quotaConsumedUnits))
    && (value.actualCostMinor === null || nonNegativeSafeInteger(value.actualCostMinor));
}

function validAgentSettlement(value: AgentExecutionResult, state: ResourceReservationState): boolean {
  return (value.quotaConsumedUnits === null || (state.quota !== null && value.quotaConsumedUnits <= state.quota.units))
    && (value.actualCostMinor === null || (state.budget !== null && value.actualCostMinor <= state.budget.amountMinor));
}

function rejected(code: DispatchRejectionCode, detail: string): AuthenticatedDispatchResult {
  return deepFreeze({ ok: false, duplicate: false, code, detail });
}

function withDuplicate(result: AuthenticatedDispatchResult): AuthenticatedDispatchResult {
  return deepFreeze({ ...result, duplicate: true });
}

async function safeReleaseLock(locks: DispatchLockManager, resourceId: string, ownerId: string): Promise<boolean> {
  try {
    return await locks.release(resourceId, ownerId);
  } catch {
    return false;
  }
}

export function canonicalSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value)), "utf8").digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) output[key] = canonicalize((value as Record<string, unknown>)[key]);
    return output;
  }
  return value;
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((item, index) => item === rightSorted[index]);
}

function sameRefs(left: readonly RegistryRef[], right: readonly RegistryRef[]): boolean {
  return sameStringSet(left.map(refKey), right.map(refKey));
}

function refKey(ref: RegistryRef): string {
  return `${ref.id}@${ref.version}`;
}

function validRef(value: unknown): value is RegistryRef {
  return isDataRecord(value)
    && exactKeys(value, ["id", "version"]) === null
    && isIdentifier(value.id)
    && typeof value.version === "string"
    && /^\d+\.\d+\.\d+$/.test(value.version);
}

function uniqueRefs(value: unknown, min: number, max: number): value is RegistryRef[] {
  return Array.isArray(value)
    && value.length >= min
    && value.length <= max
    && value.every(validRef)
    && new Set(value.map(refKey)).size === value.length;
}

function uniqueIdentifiers(value: unknown, min: number, max: number): value is string[] {
  return Array.isArray(value)
    && value.length >= min
    && value.length <= max
    && value.every(isIdentifier)
    && new Set(value).size === value.length;
}

function uniqueSafeTextArray(value: unknown, min: number, max: number, maxLength: number): value is string[] {
  return Array.isArray(value)
    && value.length >= min
    && value.length <= max
    && value.every((item) => isSafeText(item, maxLength))
    && new Set(value).size === value.length;
}

function isDataRecord(value: unknown): value is Record<string, any> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== "string") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && descriptor.enumerable === true && "value" in descriptor;
  });
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): string | null {
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string")) return "keys_invalid";
  if (actual.length !== expected.length || expected.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) return "keys_invalid";
  return null;
}

function onlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Reflect.ownKeys(value).every((key) => typeof key === "string" && expected.includes(key));
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isSafeText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= maxLength && !value.includes("\0");
}

function positiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

class WorkSpecValidationError extends Error {}

const maxCapturedOutputCharacters = 16_777_216;
const lockCleanupGraceMs = 60_000;
const defaultMaxInMemoryDispatchRecords = 4_096;
const absoluteMaxInMemoryDispatchRecords = 65_536;

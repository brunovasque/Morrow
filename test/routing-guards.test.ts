import assert from "node:assert/strict";
import test from "node:test";
import {
  AccessPolicyRegistry,
  BudgetGuard,
  ModelProfileRegistry,
  QuotaGuard,
  RoutingPolicyRegistry,
  RoutingResolver,
  RuntimeRegistry,
  type AccessPolicySpec,
  type BudgetPolicySpec,
  type ModelProfileSpec,
  type QuotaPoolSpec,
  type RoutingPolicySpec,
  type RoutingResolutionRequest,
  type RuntimeSpec,
} from "../src/routing-guards.ts";
import type { RegistryRef } from "../src/governance-registries.ts";

const ref = (id: string, version = "1.0.0"): RegistryRef => ({ id, version });
const accessRef = ref("quota-first");
const profileRef = ref("coding-high");
const runtimeRef = ref("runtime-quota-a");
const modelRef = ref("model-sol");
const poolRef = ref("quota-pool-a");
const budgetRef = ref("budget-default");

function accessPolicy(overrides: Partial<AccessPolicySpec> = {}): AccessPolicySpec {
  return {
    policyId: "quota-first",
    version: "1.0.0",
    allowedModes: ["quota-session", "api"],
    preferredMode: "quota-session",
    apiFallbackAllowed: false,
    enabled: true,
    ...overrides,
  };
}

function profile(overrides: Partial<ModelProfileSpec> = {}): ModelProfileSpec {
  return {
    profileId: "coding-high",
    version: "1.0.0",
    requiredCapabilities: ["coding", "tool-use"],
    enabled: true,
    ...overrides,
  };
}

function runtime(overrides: Partial<RuntimeSpec> = {}): RuntimeSpec {
  return {
    runtimeId: "runtime-quota-a",
    version: "1.0.0",
    providerId: "provider-a",
    accessMode: "quota-session",
    quotaPool: poolRef,
    models: [{
      modelId: "model-sol",
      version: "1.0.0",
      supportedProfiles: [profileRef],
      supportedEfforts: ["medium", "high", "xhigh"],
      capabilities: ["coding", "tool-use"],
      enabled: true,
    }],
    enabled: true,
    ...overrides,
  };
}

function globalPolicy(overrides: Partial<RoutingPolicySpec["selection"]> = {}): RoutingPolicySpec {
  return {
    policyId: "routing-global",
    version: "1.0.0",
    scope: "global",
    scopeId: "global",
    selection: {
      controlMode: "manual",
      accessPolicy: accessRef,
      accessMode: "quota-session",
      runtime: runtimeRef,
      modelProfile: profileRef,
      model: modelRef,
      effort: "medium",
      ...overrides,
    },
    enabled: true,
  };
}

function routingRequest(overrides: Partial<RoutingResolutionRequest> = {}): RoutingResolutionRequest {
  return {
    invocationId: "invocation-1",
    contractId: "contract-1",
    targetId: "target-1",
    globalPolicy: ref("routing-global"),
    ...overrides,
  };
}

function resolver(input: {
  accessPolicies?: AccessPolicySpec[];
  profiles?: ModelProfileSpec[];
  runtimes?: RuntimeSpec[];
  policies?: RoutingPolicySpec[];
} = {}): RoutingResolver {
  return new RoutingResolver({
    accessPolicies: new AccessPolicyRegistry(input.accessPolicies ?? [accessPolicy()]),
    modelProfiles: new ModelProfileRegistry(input.profiles ?? [profile()]),
    runtimes: new RuntimeRegistry(input.runtimes ?? [runtime()]),
    routingPolicies: new RoutingPolicyRegistry(input.policies ?? [globalPolicy()]),
  });
}

function expectRoutingRejected(result: ReturnType<RoutingResolver["resolve"]>, code: string): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, code);
}

test("routing resolves global -> target -> contract -> invocation precedence with field provenance", () => {
  const policies: RoutingPolicySpec[] = [
    globalPolicy(),
    { policyId: "routing-target", version: "1.0.0", scope: "target", scopeId: "target-1", selection: { effort: "high" }, enabled: true },
    { policyId: "routing-contract", version: "1.0.0", scope: "contract", scopeId: "contract-1", selection: { controlMode: "assisted", effort: "xhigh" }, enabled: true },
    { policyId: "routing-invocation", version: "1.0.0", scope: "invocation", scopeId: "invocation-1", selection: { effort: "high" }, enabled: true },
  ];
  const result = resolver({ policies }).resolve(routingRequest({
    targetPolicy: ref("routing-target"),
    contractPolicy: ref("routing-contract"),
    invocationPolicy: ref("routing-invocation"),
  }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.configuration.effort, "high");
  assert.equal(result.configuration.controlMode, "assisted");
  assert.deepEqual(result.configuration.sources.effort?.policy, ref("routing-invocation"));
  assert.deepEqual(result.configuration.sources.controlMode?.policy, ref("routing-contract"));
  assert.deepEqual(result.configuration.sources.runtime?.policy, ref("routing-global"));
  assert.deepEqual(result.configuration.appliedPolicies.map((item) => item.scope), ["global", "target", "contract", "invocation"]);
  assert.equal(Object.isFrozen(result.configuration), true);
  assert.equal(Object.isFrozen(result.configuration.sources), true);
});

test("routing refuses wrong scope binding, disabled policy and missing exact version", () => {
  const wrongScope: RoutingPolicySpec = {
    policyId: "routing-target",
    version: "1.0.0",
    scope: "target",
    scopeId: "different-target",
    selection: { effort: "high" },
    enabled: true,
  };
  expectRoutingRejected(
    resolver({ policies: [globalPolicy(), wrongScope] }).resolve(routingRequest({ targetPolicy: ref("routing-target") })),
    "POLICY_SCOPE_MISMATCH",
  );
  expectRoutingRejected(
    resolver({ policies: [globalPolicy(), { ...wrongScope, scopeId: "target-1", enabled: false }] })
      .resolve(routingRequest({ targetPolicy: ref("routing-target") })),
    "POLICY_DISABLED",
  );
  expectRoutingRejected(resolver().resolve(routingRequest({ globalPolicy: ref("routing-global", "2.0.0") })), "POLICY_NOT_FOUND");
});

test("routing refuses unsupported effort instead of silently downgrading", () => {
  const result = resolver({ policies: [globalPolicy({ effort: "low" })] }).resolve(routingRequest());
  expectRoutingRejected(result, "MODEL_EFFORT_UNSUPPORTED");
});

test("routing binds the configured runtime and never searches another runtime for a model", () => {
  const selected = runtime({ models: [{
    modelId: "different-model",
    version: "1.0.0",
    supportedProfiles: [profileRef],
    supportedEfforts: ["medium"],
    capabilities: ["coding", "tool-use"],
    enabled: true,
  }] });
  const alternative = runtime({ runtimeId: "runtime-quota-b" });
  expectRoutingRejected(resolver({ runtimes: [selected, alternative] }).resolve(routingRequest()), "MODEL_NOT_FOUND");
});

test("routing refuses model profile and capability mismatches", () => {
  const unsupportedProfile = runtime({ models: [{
    ...runtime().models[0],
    supportedProfiles: [ref("other-profile")],
  }] });
  expectRoutingRejected(resolver({ runtimes: [unsupportedProfile] }).resolve(routingRequest()), "MODEL_PROFILE_UNSUPPORTED");

  const capabilityMissing = runtime({ models: [{ ...runtime().models[0], capabilities: ["coding"] }] });
  expectRoutingRejected(resolver({ runtimes: [capabilityMissing] }).resolve(routingRequest()), "MODEL_CAPABILITY_MISSING");
});

test("API fallback requires explicit authorization and an explicit positive budget", () => {
  const apiRuntime = runtime({ runtimeId: "runtime-api-a", accessMode: "api", quotaPool: null });
  const apiPolicy = globalPolicy({ accessMode: "api", runtime: ref("runtime-api-a") });
  expectRoutingRejected(resolver({ runtimes: [apiRuntime], policies: [apiPolicy] }).resolve(routingRequest()), "API_FALLBACK_NOT_AUTHORIZED");

  const fallbackAllowed = accessPolicy({ apiFallbackAllowed: true });
  expectRoutingRejected(
    resolver({ accessPolicies: [fallbackAllowed], runtimes: [apiRuntime], policies: [apiPolicy] }).resolve(routingRequest()),
    "API_BUDGET_REQUIRED",
  );

  const authorized = globalPolicy({
    accessMode: "api",
    runtime: ref("runtime-api-a"),
    budgetPolicy: budgetRef,
    maxInvocationCostMinor: 250,
  });
  const result = resolver({ accessPolicies: [fallbackAllowed], runtimes: [apiRuntime], policies: [authorized] }).resolve(routingRequest());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.configuration.budgetPolicy, budgetRef);
    assert.equal(result.configuration.maxInvocationCostMinor, 250);
  }
});

test("strict routing input rejects extra command/credential fields, accessors and hostile proxies", () => {
  expectRoutingRejected(resolver().resolve({ ...routingRequest(), command: "powershell.exe" }), "INVALID_REQUEST");
  expectRoutingRejected(resolver().resolve({ ...routingRequest(), token: "must-not-pass" }), "INVALID_REQUEST");
  const accessor = { ...routingRequest(), get targetId() { return "target-1"; } };
  expectRoutingRejected(resolver().resolve(accessor), "INVALID_REQUEST");
  const hidden = routingRequest() as RoutingResolutionRequest & { command?: string };
  Object.defineProperty(hidden, "command", { value: "powershell.exe", enumerable: false });
  expectRoutingRejected(resolver().resolve(hidden), "INVALID_REQUEST");
  const withSymbol = routingRequest() as RoutingResolutionRequest & { [key: symbol]: string };
  withSymbol[Symbol("credential")] = "hidden";
  expectRoutingRejected(resolver().resolve(withSymbol), "INVALID_REQUEST");
  const hostile = new Proxy(routingRequest(), { ownKeys() { throw new Error("secret-details"); } });
  const rejected = resolver().resolve(hostile);
  expectRoutingRejected(rejected, "INVALID_REQUEST");
  if (!rejected.ok) assert.equal(rejected.detail.includes("secret-details"), false);
});

test("routing registries detach and freeze configuration snapshots", () => {
  const source = runtime();
  const registry = new RuntimeRegistry([source]);
  source.providerId = "mutated-provider";
  source.models[0].supportedEfforts.push("low");
  const resolved = registry.resolve(runtimeRef);
  assert.ok(resolved);
  assert.equal(resolved.providerId, "provider-a");
  assert.deepEqual(resolved.models[0].supportedEfforts, ["medium", "high", "xhigh"]);
  assert.equal(Object.isFrozen(resolved.models[0].supportedEfforts), true);
});

function measuredPool(overrides: Partial<QuotaPoolSpec> = {}): QuotaPoolSpec {
  return {
    poolId: "quota-pool-a",
    version: "1.0.0",
    concurrencyLimit: 2,
    quota: {
      measurable: true,
      unit: "invocation-unit",
      remainingUnits: 10,
      reserveUnits: 3,
      observedAt: "2026-08-29T10:00:00.000Z",
      resetAt: "2026-08-29T12:00:00.000Z",
    },
    enabled: true,
    ...overrides,
  };
}

const fixedClock = (): string => "2026-08-29T11:00:00.000Z";

test("Quota Guard preserves the critical reserve and permits an explicitly critical reservation", () => {
  const guard = new QuotaGuard([measuredPool()], fixedClock);
  const standard = guard.reserve({ reservationId: "quota-1", ownerId: "worker-1", pool: poolRef, units: 7, priority: "standard" });
  assert.equal(standard.ok, true);
  const blocked = guard.reserve({ reservationId: "quota-2", ownerId: "worker-2", pool: poolRef, units: 1, priority: "standard" });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "QUOTA_EXHAUSTED");
  const critical = guard.reserve({ reservationId: "quota-3", ownerId: "worker-3", pool: poolRef, units: 1, priority: "critical" });
  assert.equal(critical.ok, true);
  assert.equal(guard.inspect(poolRef)?.quota.measurable, true);
  const state = guard.inspect(poolRef);
  if (state?.quota.measurable) assert.equal(state.quota.availableUnits, 2);
});

test("Quota Guard enforces concurrency without selecting another pool", () => {
  const pool = measuredPool({ concurrencyLimit: 1, quota: { measurable: false } });
  const guard = new QuotaGuard([pool], fixedClock);
  assert.equal(guard.reserve({ reservationId: "quota-1", ownerId: "worker-1", pool: poolRef, units: 1, priority: "standard" }).ok, true);
  const blocked = guard.reserve({ reservationId: "quota-2", ownerId: "worker-2", pool: poolRef, units: 1, priority: "critical" });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "CONCURRENCY_EXHAUSTED");
});

test("Quota Guard is idempotent, rejects key rebinding and foreign release", () => {
  const guard = new QuotaGuard([measuredPool()], fixedClock);
  const request = { reservationId: "quota-1", ownerId: "worker-1", pool: poolRef, units: 2, priority: "standard" as const };
  const first = guard.reserve(request);
  const repeated = guard.reserve({ priority: "standard", units: 2, pool: { version: "1.0.0", id: "quota-pool-a" }, ownerId: "worker-1", reservationId: "quota-1" });
  assert.deepEqual(repeated, first);
  const rebound = guard.reserve({ ...request, units: 3 });
  assert.equal(rebound.ok, false);
  if (!rebound.ok) assert.equal(rebound.code, "IDEMPOTENCY_CONFLICT");
  const foreign = guard.release("quota-1", "worker-2");
  assert.equal(foreign.ok, false);
  if (!foreign.ok) assert.equal(foreign.code, "OWNER_MISMATCH");
});

test("Quota Guard settlement returns unused measured units and is mechanically idempotent", () => {
  const guard = new QuotaGuard([measuredPool()], fixedClock);
  guard.reserve({ reservationId: "quota-1", ownerId: "worker-1", pool: poolRef, units: 4, priority: "standard" });
  const completed = guard.complete("quota-1", "worker-1", 2);
  assert.equal(completed.ok, true);
  if (completed.ok) assert.equal(completed.reservation.status, "completed");
  assert.deepEqual(guard.complete("quota-1", "worker-1", 2), completed);
  const conflictingReplay = guard.complete("quota-1", "worker-1", 1);
  assert.equal(conflictingReplay.ok, false);
  if (!conflictingReplay.ok) assert.equal(conflictingReplay.code, "IDEMPOTENCY_CONFLICT");
  const releaseAfterComplete = guard.release("quota-1", "worker-1");
  assert.equal(releaseAfterComplete.ok, false);
  if (!releaseAfterComplete.ok) assert.equal(releaseAfterComplete.code, "IDEMPOTENCY_CONFLICT");
  const state = guard.inspect(poolRef);
  if (state?.quota.measurable) assert.equal(state.quota.availableUnits, 8);
  assert.equal(state?.activeReservations, 0);
});

test("Quota Guard never invents remaining/reset data for an unmeasurable provider", () => {
  const guard = new QuotaGuard([measuredPool({ quota: { measurable: false } })], fixedClock);
  const state = guard.inspect(poolRef);
  assert.deepEqual(state?.quota, { measurable: false });
  assert.equal("remainingUnits" in (state?.quota ?? {}), false);
  assert.equal("resetAt" in (state?.quota ?? {}), false);
});

test("Quota Guard uses its trusted clock and blocks a stale snapshot", () => {
  const guard = new QuotaGuard([measuredPool()], () => "2026-08-29T12:00:00.000Z");
  const result = guard.reserve({ reservationId: "quota-1", ownerId: "worker-1", pool: poolRef, units: 1, priority: "critical" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "QUOTA_SNAPSHOT_STALE");
});

test("Quota Guard blocks a snapshot whose observation is in the trusted clock future", () => {
  const guard = new QuotaGuard([measuredPool()], () => "2026-08-29T09:59:59.999Z");
  const result = guard.reserve({ reservationId: "quota-1", ownerId: "worker-1", pool: poolRef, units: 1, priority: "critical" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "QUOTA_SNAPSHOT_STALE");
});

test("Quota Guard converts a failing trusted clock into a sanitized block", () => {
  const guard = new QuotaGuard([measuredPool()], () => { throw new Error("clock-internal-detail"); });
  const result = guard.reserve({ reservationId: "quota-1", ownerId: "worker-1", pool: poolRef, units: 1, priority: "critical" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "QUOTA_SNAPSHOT_STALE");
    assert.equal(result.detail.includes("clock-internal-detail"), false);
  }
});

function budgetPolicy(overrides: Partial<BudgetPolicySpec> = {}): BudgetPolicySpec {
  return {
    policyId: "budget-default",
    version: "1.0.0",
    currency: "USD",
    periodId: "2026-08",
    limits: {
      invocationMinor: 500,
      stepMinor: 700,
      contractMinor: 900,
      providerMinor: 1_000,
      periodMinor: 1_200,
    },
    enabled: true,
    ...overrides,
  };
}

function budgetRequest(id: string, amountMinor: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    reservationId: id,
    ownerId: `owner-${id}`,
    policy: budgetRef,
    contractId: "contract-1",
    stepId: "step-1",
    invocationId: `invocation-${id}`,
    providerId: "provider-a",
    currency: "USD",
    amountMinor,
    ...overrides,
  };
}

test("Budget Guard reserves exact minor units and prevents concurrent step oversubscription", () => {
  const guard = new BudgetGuard([budgetPolicy()]);
  assert.equal(guard.reserve(budgetRequest("1", 400)).ok, true);
  const blocked = guard.reserve(budgetRequest("2", 400));
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "STEP_LIMIT_EXCEEDED");
  assert.deepEqual(guard.inspect(budgetRef, "step", "contract-1/step-1"), { reserved: 400, committed: 0 });
});

test("Budget Guard enforces invocation, contract, provider and period ceilings", () => {
  const guard = new BudgetGuard([budgetPolicy()]);
  const invocation = guard.reserve(budgetRequest("too-large", 501));
  assert.equal(invocation.ok, false);
  if (!invocation.ok) assert.equal(invocation.code, "INVOCATION_LIMIT_EXCEEDED");

  assert.equal(guard.reserve(budgetRequest("invocation-a", 300, { invocationId: "shared-invocation" })).ok, true);
  const aggregateInvocation = guard.reserve(budgetRequest("invocation-b", 201, { invocationId: "shared-invocation", stepId: "step-2" }));
  assert.equal(aggregateInvocation.ok, false);
  if (!aggregateInvocation.ok) assert.equal(aggregateInvocation.code, "INVOCATION_LIMIT_EXCEEDED");

  const contractGuard = new BudgetGuard([budgetPolicy()]);
  assert.equal(contractGuard.reserve(budgetRequest("1", 450)).ok, true);
  const contract = contractGuard.reserve(budgetRequest("2", 451, { stepId: "step-2" }));
  assert.equal(contract.ok, false);
  if (!contract.ok) assert.equal(contract.code, "CONTRACT_LIMIT_EXCEEDED");

  const providerGuard = new BudgetGuard([budgetPolicy({ limits: { invocationMinor: 500, stepMinor: 500, contractMinor: 600, providerMinor: 700, periodMinor: 1_200 } })]);
  assert.equal(providerGuard.reserve(budgetRequest("3", 400)).ok, true);
  const provider = providerGuard.reserve(budgetRequest("4", 350, { contractId: "contract-2", stepId: "step-2" }));
  assert.equal(provider.ok, false);
  if (!provider.ok) assert.equal(provider.code, "PROVIDER_LIMIT_EXCEEDED");

  const periodGuard = new BudgetGuard([budgetPolicy({ limits: { invocationMinor: 500, stepMinor: 500, contractMinor: 500, providerMinor: 700, periodMinor: 900 } })]);
  assert.equal(periodGuard.reserve(budgetRequest("5", 500)).ok, true);
  const period = periodGuard.reserve(budgetRequest("6", 450, { contractId: "contract-2", stepId: "step-2", providerId: "provider-b" }));
  assert.equal(period.ok, false);
  if (!period.ok) assert.equal(period.code, "PERIOD_LIMIT_EXCEEDED");
});

test("Budget Guard commit converts reserved to actual and release restores only reservation", () => {
  const guard = new BudgetGuard([budgetPolicy()]);
  const first = budgetRequest("1", 400);
  const second = budgetRequest("2", 200, { stepId: "step-2" });
  guard.reserve(first);
  guard.reserve(second);
  const committed = guard.commit("1", "owner-1", 250);
  assert.equal(committed.ok, true);
  if (committed.ok) assert.equal(committed.reservation.committedMinor, 250);
  assert.deepEqual(guard.commit("1", "owner-1", 250), committed);
  const conflictingReplay = guard.commit("1", "owner-1", 249);
  assert.equal(conflictingReplay.ok, false);
  if (!conflictingReplay.ok) assert.equal(conflictingReplay.code, "IDEMPOTENCY_CONFLICT");
  const releaseAfterCommit = guard.release("1", "owner-1");
  assert.equal(releaseAfterCommit.ok, false);
  if (!releaseAfterCommit.ok) assert.equal(releaseAfterCommit.code, "IDEMPOTENCY_CONFLICT");
  const released = guard.release("2", "owner-2");
  assert.equal(released.ok, true);
  assert.deepEqual(guard.inspect(budgetRef, "contract", "contract-1"), { reserved: 0, committed: 250 });
});

test("Budget Guard is idempotent and refuses rebinding, foreign ownership and excess commit", () => {
  const guard = new BudgetGuard([budgetPolicy()]);
  const request = budgetRequest("1", 300);
  const first = guard.reserve(request);
  assert.deepEqual(guard.reserve({
    amountMinor: 300,
    currency: "USD",
    providerId: "provider-a",
    invocationId: "invocation-1",
    stepId: "step-1",
    contractId: "contract-1",
    policy: { version: "1.0.0", id: "budget-default" },
    ownerId: "owner-1",
    reservationId: "1",
  }), first);
  const rebound = guard.reserve({ ...request, amountMinor: 301 });
  assert.equal(rebound.ok, false);
  if (!rebound.ok) assert.equal(rebound.code, "IDEMPOTENCY_CONFLICT");
  const foreign = guard.release("1", "other-owner");
  assert.equal(foreign.ok, false);
  if (!foreign.ok) assert.equal(foreign.code, "OWNER_MISMATCH");
  const excess = guard.commit("1", "owner-1", 301);
  assert.equal(excess.ok, false);
  if (!excess.ok) assert.equal(excess.code, "COMMIT_EXCEEDS_RESERVATION");
});

test("Budget Guard refuses currency mismatch, fractional money, extra fields and hostile input", () => {
  const guard = new BudgetGuard([budgetPolicy()]);
  const currency = guard.reserve(budgetRequest("1", 100, { currency: "BRL" }));
  assert.equal(currency.ok, false);
  if (!currency.ok) assert.equal(currency.code, "CURRENCY_MISMATCH");
  const fractional = guard.reserve(budgetRequest("2", 1.5));
  assert.equal(fractional.ok, false);
  if (!fractional.ok) assert.equal(fractional.code, "INVALID_REQUEST");
  const extra = guard.reserve({ ...budgetRequest("3", 100), token: "must-not-pass" });
  assert.equal(extra.ok, false);
  if (!extra.ok) assert.equal(extra.code, "INVALID_REQUEST");
  const hostile = new Proxy(budgetRequest("4", 100), { ownKeys() { throw new Error("budget-secret"); } });
  const rejected = guard.reserve(hostile);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) {
    assert.equal(rejected.code, "INVALID_REQUEST");
    assert.equal(rejected.detail.includes("budget-secret"), false);
  }
});

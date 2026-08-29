import type { RegistryRef } from "./governance-registries.ts";

export type AccessMode = "quota-session" | "api" | "local";
export type RoutingControlMode = "manual" | "assisted" | "automatic";
export type RoutingScope = "global" | "target" | "contract" | "invocation";
export type ModelEffort = "low" | "medium" | "high" | "xhigh" | "provider-default";
export type QuotaPriority = "standard" | "critical";

export interface AccessPolicySpec {
  policyId: string;
  version: string;
  allowedModes: AccessMode[];
  preferredMode: AccessMode;
  apiFallbackAllowed: boolean;
  enabled: boolean;
}

export interface ModelProfileSpec {
  profileId: string;
  version: string;
  requiredCapabilities: string[];
  enabled: boolean;
}

export interface RuntimeModelSpec {
  modelId: string;
  version: string;
  supportedProfiles: RegistryRef[];
  supportedEfforts: ModelEffort[];
  capabilities: string[];
  enabled: boolean;
}

export interface RuntimeSpec {
  runtimeId: string;
  version: string;
  providerId: string;
  accessMode: AccessMode;
  quotaPool: RegistryRef | null;
  models: RuntimeModelSpec[];
  enabled: boolean;
}

export interface RoutingSelection {
  controlMode?: RoutingControlMode;
  accessPolicy?: RegistryRef;
  accessMode?: AccessMode;
  runtime?: RegistryRef;
  modelProfile?: RegistryRef;
  model?: RegistryRef;
  effort?: ModelEffort;
  budgetPolicy?: RegistryRef;
  maxInvocationCostMinor?: number;
}

export interface RoutingPolicySpec {
  policyId: string;
  version: string;
  scope: RoutingScope;
  scopeId: string;
  selection: RoutingSelection;
  enabled: boolean;
}

export interface RoutingResolutionRequest {
  invocationId: string;
  contractId: string;
  targetId: string;
  globalPolicy: RegistryRef;
  targetPolicy?: RegistryRef;
  contractPolicy?: RegistryRef;
  invocationPolicy?: RegistryRef;
}

export type EffectiveRoutingField =
  | "controlMode"
  | "accessPolicy"
  | "accessMode"
  | "runtime"
  | "modelProfile"
  | "model"
  | "effort"
  | "budgetPolicy"
  | "maxInvocationCostMinor";

export interface RoutingFieldSource {
  policy: RegistryRef;
  scope: RoutingScope;
  scopeId: string;
}

export interface AppliedRoutingPolicy extends RoutingFieldSource {
  fields: EffectiveRoutingField[];
}

export interface EffectiveRoutingConfiguration {
  invocationId: string;
  contractId: string;
  targetId: string;
  controlMode: RoutingControlMode;
  accessPolicy: RegistryRef;
  accessMode: AccessMode;
  runtime: RegistryRef;
  providerId: string;
  modelProfile: RegistryRef;
  model: RegistryRef;
  effort: ModelEffort;
  quotaPool: RegistryRef | null;
  budgetPolicy: RegistryRef | null;
  maxInvocationCostMinor: number | null;
  sources: Record<EffectiveRoutingField, RoutingFieldSource | null>;
  appliedPolicies: AppliedRoutingPolicy[];
}

export type RoutingRejectionCode =
  | "INVALID_REQUEST"
  | "POLICY_NOT_FOUND"
  | "POLICY_DISABLED"
  | "POLICY_SCOPE_MISMATCH"
  | "EFFECTIVE_CONFIGURATION_INCOMPLETE"
  | "ACCESS_POLICY_NOT_FOUND"
  | "ACCESS_POLICY_DISABLED"
  | "ACCESS_MODE_NOT_ALLOWED"
  | "API_FALLBACK_NOT_AUTHORIZED"
  | "API_BUDGET_REQUIRED"
  | "RUNTIME_NOT_FOUND"
  | "RUNTIME_DISABLED"
  | "RUNTIME_ACCESS_MODE_MISMATCH"
  | "QUOTA_POOL_REQUIRED"
  | "MODEL_PROFILE_NOT_FOUND"
  | "MODEL_PROFILE_DISABLED"
  | "MODEL_NOT_FOUND"
  | "MODEL_DISABLED"
  | "MODEL_PROFILE_UNSUPPORTED"
  | "MODEL_CAPABILITY_MISSING"
  | "MODEL_EFFORT_UNSUPPORTED";

export type RoutingResolutionResult =
  | { ok: true; configuration: EffectiveRoutingConfiguration }
  | { ok: false; code: RoutingRejectionCode; detail: string };

export class AccessPolicyRegistry {
  private readonly entries: ReadonlyMap<string, AccessPolicySpec>;

  constructor(specs: readonly AccessPolicySpec[]) {
    this.entries = buildRegistry(specs, validAccessPolicy, (item) => refKey({ id: item.policyId, version: item.version }), "access_policy");
  }

  resolve(ref: RegistryRef): AccessPolicySpec | null {
    return validRef(ref) ? this.entries.get(refKey(ref)) ?? null : null;
  }
}

export class ModelProfileRegistry {
  private readonly entries: ReadonlyMap<string, ModelProfileSpec>;

  constructor(specs: readonly ModelProfileSpec[]) {
    this.entries = buildRegistry(specs, validModelProfile, (item) => refKey({ id: item.profileId, version: item.version }), "model_profile");
  }

  resolve(ref: RegistryRef): ModelProfileSpec | null {
    return validRef(ref) ? this.entries.get(refKey(ref)) ?? null : null;
  }
}

export class RuntimeRegistry {
  private readonly entries: ReadonlyMap<string, RuntimeSpec>;

  constructor(specs: readonly RuntimeSpec[]) {
    this.entries = buildRegistry(specs, validRuntime, (item) => refKey({ id: item.runtimeId, version: item.version }), "runtime");
  }

  resolve(ref: RegistryRef): RuntimeSpec | null {
    return validRef(ref) ? this.entries.get(refKey(ref)) ?? null : null;
  }
}

export class RoutingPolicyRegistry {
  private readonly entries: ReadonlyMap<string, RoutingPolicySpec>;

  constructor(specs: readonly RoutingPolicySpec[]) {
    this.entries = buildRegistry(specs, validRoutingPolicy, (item) => refKey({ id: item.policyId, version: item.version }), "routing_policy");
  }

  resolve(ref: RegistryRef): RoutingPolicySpec | null {
    return validRef(ref) ? this.entries.get(refKey(ref)) ?? null : null;
  }
}

export interface RoutingRegistries {
  accessPolicies: AccessPolicyRegistry;
  modelProfiles: ModelProfileRegistry;
  runtimes: RuntimeRegistry;
  routingPolicies: RoutingPolicyRegistry;
}

const routingFields: EffectiveRoutingField[] = [
  "controlMode",
  "accessPolicy",
  "accessMode",
  "runtime",
  "modelProfile",
  "model",
  "effort",
  "budgetPolicy",
  "maxInvocationCostMinor",
];

export class RoutingResolver {
  private readonly registries: RoutingRegistries;

  constructor(registries: RoutingRegistries) {
    this.registries = registries;
  }

  resolve(input: unknown): RoutingResolutionResult {
    let request: RoutingResolutionRequest | null = null;
    try {
      request = parseRoutingRequest(input);
    } catch {
      return routingReject("INVALID_REQUEST", "routing_request_invalid");
    }
    if (!request) return routingReject("INVALID_REQUEST", "routing_request_invalid");

    const requestedPolicies: Array<{ ref: RegistryRef; scope: RoutingScope; scopeId: string }> = [
      { ref: request.globalPolicy, scope: "global", scopeId: "global" },
    ];
    if (request.targetPolicy) requestedPolicies.push({ ref: request.targetPolicy, scope: "target", scopeId: request.targetId });
    if (request.contractPolicy) requestedPolicies.push({ ref: request.contractPolicy, scope: "contract", scopeId: request.contractId });
    if (request.invocationPolicy) requestedPolicies.push({ ref: request.invocationPolicy, scope: "invocation", scopeId: request.invocationId });

    const effective: RoutingSelection = {};
    const sources = Object.fromEntries(routingFields.map((field) => [field, null])) as Record<EffectiveRoutingField, RoutingFieldSource | null>;
    const appliedPolicies: AppliedRoutingPolicy[] = [];

    for (const requested of requestedPolicies) {
      const policy = this.registries.routingPolicies.resolve(requested.ref);
      if (!policy) return routingReject("POLICY_NOT_FOUND", refKey(requested.ref));
      if (!policy.enabled) return routingReject("POLICY_DISABLED", refKey(requested.ref));
      if (policy.scope !== requested.scope || policy.scopeId !== requested.scopeId) {
        return routingReject("POLICY_SCOPE_MISMATCH", refKey(requested.ref));
      }
      const source = deepFreeze({ policy: { ...requested.ref }, scope: policy.scope, scopeId: policy.scopeId });
      const fields = Object.keys(policy.selection) as EffectiveRoutingField[];
      for (const field of fields) {
        (effective as Record<string, unknown>)[field] = structuredClone(policy.selection[field]);
        sources[field] = source;
      }
      appliedPolicies.push(deepFreeze({ ...source, fields: [...fields] }));
    }

    const requiredFields: Array<keyof RoutingSelection> = [
      "controlMode", "accessPolicy", "accessMode", "runtime", "modelProfile", "model", "effort",
    ];
    const missing = requiredFields.find((field) => effective[field] === undefined);
    if (missing) return routingReject("EFFECTIVE_CONFIGURATION_INCOMPLETE", missing);

    const accessPolicy = this.registries.accessPolicies.resolve(effective.accessPolicy as RegistryRef);
    if (!accessPolicy) return routingReject("ACCESS_POLICY_NOT_FOUND", refKey(effective.accessPolicy as RegistryRef));
    if (!accessPolicy.enabled) return routingReject("ACCESS_POLICY_DISABLED", refKey(effective.accessPolicy as RegistryRef));
    const accessMode = effective.accessMode as AccessMode;
    if (!accessPolicy.allowedModes.includes(accessMode)) return routingReject("ACCESS_MODE_NOT_ALLOWED", accessMode);
    if (accessMode === "api" && accessPolicy.preferredMode !== "api" && !accessPolicy.apiFallbackAllowed) {
      return routingReject("API_FALLBACK_NOT_AUTHORIZED", refKey(effective.accessPolicy as RegistryRef));
    }
    if (accessMode === "api" && (!effective.budgetPolicy || !positiveSafeInteger(effective.maxInvocationCostMinor))) {
      return routingReject("API_BUDGET_REQUIRED", "api_requires_budget_policy_and_max_cost");
    }

    const runtime = this.registries.runtimes.resolve(effective.runtime as RegistryRef);
    if (!runtime) return routingReject("RUNTIME_NOT_FOUND", refKey(effective.runtime as RegistryRef));
    if (!runtime.enabled) return routingReject("RUNTIME_DISABLED", refKey(effective.runtime as RegistryRef));
    if (runtime.accessMode !== accessMode) return routingReject("RUNTIME_ACCESS_MODE_MISMATCH", refKey(effective.runtime as RegistryRef));
    if (accessMode === "quota-session" && runtime.quotaPool === null) {
      return routingReject("QUOTA_POOL_REQUIRED", refKey(effective.runtime as RegistryRef));
    }

    const modelProfile = this.registries.modelProfiles.resolve(effective.modelProfile as RegistryRef);
    if (!modelProfile) return routingReject("MODEL_PROFILE_NOT_FOUND", refKey(effective.modelProfile as RegistryRef));
    if (!modelProfile.enabled) return routingReject("MODEL_PROFILE_DISABLED", refKey(effective.modelProfile as RegistryRef));
    const modelRef = effective.model as RegistryRef;
    const model = runtime.models.find((item) => item.modelId === modelRef.id && item.version === modelRef.version);
    if (!model) return routingReject("MODEL_NOT_FOUND", `${refKey(effective.runtime as RegistryRef)}:${refKey(modelRef)}`);
    if (!model.enabled) return routingReject("MODEL_DISABLED", refKey(modelRef));
    if (!hasRef(model.supportedProfiles, effective.modelProfile as RegistryRef)) {
      return routingReject("MODEL_PROFILE_UNSUPPORTED", `${refKey(modelRef)}:${refKey(effective.modelProfile as RegistryRef)}`);
    }
    const missingCapability = modelProfile.requiredCapabilities.find((capability) => !model.capabilities.includes(capability));
    if (missingCapability) return routingReject("MODEL_CAPABILITY_MISSING", missingCapability);
    if (!model.supportedEfforts.includes(effective.effort as ModelEffort)) {
      return routingReject("MODEL_EFFORT_UNSUPPORTED", `${refKey(modelRef)}:${String(effective.effort)}`);
    }

    const configuration = deepFreeze({
      invocationId: request.invocationId,
      contractId: request.contractId,
      targetId: request.targetId,
      controlMode: effective.controlMode as RoutingControlMode,
      accessPolicy: { ...(effective.accessPolicy as RegistryRef) },
      accessMode,
      runtime: { ...(effective.runtime as RegistryRef) },
      providerId: runtime.providerId,
      modelProfile: { ...(effective.modelProfile as RegistryRef) },
      model: { ...modelRef },
      effort: effective.effort as ModelEffort,
      quotaPool: runtime.quotaPool ? { ...runtime.quotaPool } : null,
      budgetPolicy: effective.budgetPolicy ? { ...effective.budgetPolicy } : null,
      maxInvocationCostMinor: effective.maxInvocationCostMinor ?? null,
      sources,
      appliedPolicies,
    });
    return { ok: true, configuration };
  }
}

export interface UnmeasurableQuota {
  measurable: false;
}

export interface MeasurableQuota {
  measurable: true;
  unit: string;
  remainingUnits: number;
  reserveUnits: number;
  observedAt: string;
  resetAt: string;
}

export interface QuotaPoolSpec {
  poolId: string;
  version: string;
  concurrencyLimit: number;
  quota: UnmeasurableQuota | MeasurableQuota;
  enabled: boolean;
}

export interface QuotaReservationRequest {
  reservationId: string;
  ownerId: string;
  pool: RegistryRef;
  units: number;
  priority: QuotaPriority;
}

export interface QuotaReservation {
  reservationId: string;
  ownerId: string;
  pool: RegistryRef;
  units: number;
  priority: QuotaPriority;
  status: "active" | "completed" | "released";
}

export interface QuotaPoolState {
  pool: RegistryRef;
  concurrencyLimit: number;
  activeReservations: number;
  quota: UnmeasurableQuota | (MeasurableQuota & { availableUnits: number });
}

export type QuotaGuardResult =
  | { ok: true; reservation: QuotaReservation }
  | { ok: false; code: "INVALID_REQUEST" | "POOL_NOT_FOUND" | "POOL_DISABLED" | "CONCURRENCY_EXHAUSTED" | "QUOTA_SNAPSHOT_STALE" | "QUOTA_EXHAUSTED" | "IDEMPOTENCY_CONFLICT" | "RESERVATION_NOT_FOUND" | "OWNER_MISMATCH" | "SETTLEMENT_EXCEEDS_RESERVATION"; detail: string };

interface QuotaRecord {
  fingerprint: string;
  reservation: QuotaReservation;
  settlement: string | null;
}

interface MutableQuotaPool {
  spec: QuotaPoolSpec;
  availableUnits: number | null;
  active: Set<string>;
}

export type GuardClock = () => string | number | Date;

export class QuotaGuard {
  private readonly pools: ReadonlyMap<string, MutableQuotaPool>;
  private readonly records = new Map<string, QuotaRecord>();
  private readonly clock: GuardClock;

  constructor(specs: readonly QuotaPoolSpec[], clock: GuardClock = () => Date.now()) {
    const registry = buildRegistry(specs, validQuotaPool, (item) => refKey({ id: item.poolId, version: item.version }), "quota_pool");
    this.pools = new Map([...registry].map(([key, spec]) => [key, {
      spec,
      availableUnits: spec.quota.measurable ? spec.quota.remainingUnits : null,
      active: new Set<string>(),
    }]));
    this.clock = clock;
  }

  reserve(input: unknown): QuotaGuardResult {
    let request: QuotaReservationRequest | null = null;
    try {
      request = parseQuotaRequest(input);
    } catch {
      return quotaReject("INVALID_REQUEST", "quota_reservation_request_invalid");
    }
    if (!request) return quotaReject("INVALID_REQUEST", "quota_reservation_request_invalid");
    const fingerprint = canonicalFingerprint(request);
    const existing = this.records.get(request.reservationId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) return quotaReject("IDEMPOTENCY_CONFLICT", request.reservationId);
      return { ok: true, reservation: existing.reservation };
    }
    const pool = this.pools.get(refKey(request.pool));
    if (!pool) return quotaReject("POOL_NOT_FOUND", refKey(request.pool));
    if (!pool.spec.enabled) return quotaReject("POOL_DISABLED", refKey(request.pool));
    if (pool.active.size >= pool.spec.concurrencyLimit) return quotaReject("CONCURRENCY_EXHAUSTED", refKey(request.pool));
    if (pool.spec.quota.measurable) {
      let now: number | null = null;
      try {
        now = contextTime(this.clock());
      } catch {
        return quotaReject("QUOTA_SNAPSHOT_STALE", refKey(request.pool));
      }
      const observedAt = contextTime(pool.spec.quota.observedAt);
      const resetAt = contextTime(pool.spec.quota.resetAt);
      if (now === null || observedAt === null || resetAt === null || now < observedAt || now >= resetAt) {
        return quotaReject("QUOTA_SNAPSHOT_STALE", refKey(request.pool));
      }
      const available = pool.availableUnits as number;
      const floor = request.priority === "critical" ? 0 : pool.spec.quota.reserveUnits;
      if (available - request.units < floor) return quotaReject("QUOTA_EXHAUSTED", refKey(request.pool));
      pool.availableUnits = available - request.units;
    }
    const reservation = deepFreeze({ ...request, pool: { ...request.pool }, status: "active" as const });
    pool.active.add(request.reservationId);
    this.records.set(request.reservationId, { fingerprint, reservation, settlement: null });
    return { ok: true, reservation };
  }

  complete(reservationId: string, ownerId: string, consumedUnits: number): QuotaGuardResult {
    if (!isIdentifier(reservationId) || !isIdentifier(ownerId) || !nonNegativeSafeInteger(consumedUnits)) {
      return quotaReject("INVALID_REQUEST", "quota_settlement_invalid");
    }
    const record = this.records.get(reservationId);
    if (!record) return quotaReject("RESERVATION_NOT_FOUND", reservationId);
    if (record.reservation.ownerId !== ownerId) return quotaReject("OWNER_MISMATCH", reservationId);
    const settlement = `complete:${consumedUnits}`;
    if (record.reservation.status !== "active") {
      return record.settlement === settlement
        ? { ok: true, reservation: record.reservation }
        : quotaReject("IDEMPOTENCY_CONFLICT", reservationId);
    }
    if (consumedUnits > record.reservation.units) return quotaReject("SETTLEMENT_EXCEEDS_RESERVATION", reservationId);
    const pool = this.pools.get(refKey(record.reservation.pool)) as MutableQuotaPool;
    if (pool.availableUnits !== null) pool.availableUnits += record.reservation.units - consumedUnits;
    pool.active.delete(reservationId);
    record.reservation = deepFreeze({ ...record.reservation, status: "completed" as const });
    record.settlement = settlement;
    return { ok: true, reservation: record.reservation };
  }

  release(reservationId: string, ownerId: string): QuotaGuardResult {
    if (!isIdentifier(reservationId) || !isIdentifier(ownerId)) return quotaReject("INVALID_REQUEST", "quota_release_invalid");
    const record = this.records.get(reservationId);
    if (!record) return quotaReject("RESERVATION_NOT_FOUND", reservationId);
    if (record.reservation.ownerId !== ownerId) return quotaReject("OWNER_MISMATCH", reservationId);
    if (record.reservation.status !== "active") {
      return record.settlement === "release"
        ? { ok: true, reservation: record.reservation }
        : quotaReject("IDEMPOTENCY_CONFLICT", reservationId);
    }
    const pool = this.pools.get(refKey(record.reservation.pool)) as MutableQuotaPool;
    if (pool.availableUnits !== null) pool.availableUnits += record.reservation.units;
    pool.active.delete(reservationId);
    record.reservation = deepFreeze({ ...record.reservation, status: "released" as const });
    record.settlement = "release";
    return { ok: true, reservation: record.reservation };
  }

  inspect(poolRef: RegistryRef): QuotaPoolState | null {
    if (!validRef(poolRef)) return null;
    const pool = this.pools.get(refKey(poolRef));
    if (!pool) return null;
    const quota = pool.spec.quota.measurable
      ? { ...pool.spec.quota, availableUnits: pool.availableUnits as number }
      : { measurable: false as const };
    return deepFreeze({
      pool: { ...poolRef },
      concurrencyLimit: pool.spec.concurrencyLimit,
      activeReservations: pool.active.size,
      quota,
    });
  }
}

export interface BudgetLimits {
  invocationMinor: number;
  stepMinor: number;
  contractMinor: number;
  providerMinor: number;
  periodMinor: number;
}

export interface BudgetPolicySpec {
  policyId: string;
  version: string;
  currency: string;
  periodId: string;
  limits: BudgetLimits;
  enabled: boolean;
}

export interface BudgetReservationRequest {
  reservationId: string;
  ownerId: string;
  policy: RegistryRef;
  contractId: string;
  stepId: string;
  invocationId: string;
  providerId: string;
  currency: string;
  amountMinor: number;
}

export interface BudgetReservation extends BudgetReservationRequest {
  status: "active" | "committed" | "released";
  committedMinor: number;
}

export type BudgetGuardResult =
  | { ok: true; reservation: BudgetReservation }
  | { ok: false; code: "INVALID_REQUEST" | "POLICY_NOT_FOUND" | "POLICY_DISABLED" | "CURRENCY_MISMATCH" | "INVOCATION_LIMIT_EXCEEDED" | "STEP_LIMIT_EXCEEDED" | "CONTRACT_LIMIT_EXCEEDED" | "PROVIDER_LIMIT_EXCEEDED" | "PERIOD_LIMIT_EXCEEDED" | "IDEMPOTENCY_CONFLICT" | "RESERVATION_NOT_FOUND" | "OWNER_MISMATCH" | "COMMIT_EXCEEDS_RESERVATION"; detail: string };

interface BudgetRecord {
  fingerprint: string;
  reservation: BudgetReservation;
  settlement: string | null;
}

interface BudgetTotals {
  reserved: number;
  committed: number;
}

export type BudgetDimension = "invocation" | "step" | "contract" | "provider" | "period";

export class BudgetGuard {
  private readonly policies: ReadonlyMap<string, BudgetPolicySpec>;
  private readonly records = new Map<string, BudgetRecord>();
  private readonly totals = new Map<string, BudgetTotals>();

  constructor(specs: readonly BudgetPolicySpec[]) {
    this.policies = buildRegistry(specs, validBudgetPolicy, (item) => refKey({ id: item.policyId, version: item.version }), "budget_policy");
  }

  reserve(input: unknown): BudgetGuardResult {
    let request: BudgetReservationRequest | null = null;
    try {
      request = parseBudgetRequest(input);
    } catch {
      return budgetReject("INVALID_REQUEST", "budget_reservation_request_invalid");
    }
    if (!request) return budgetReject("INVALID_REQUEST", "budget_reservation_request_invalid");
    const fingerprint = canonicalFingerprint(request);
    const existing = this.records.get(request.reservationId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) return budgetReject("IDEMPOTENCY_CONFLICT", request.reservationId);
      return { ok: true, reservation: existing.reservation };
    }
    const policy = this.policies.get(refKey(request.policy));
    if (!policy) return budgetReject("POLICY_NOT_FOUND", refKey(request.policy));
    if (!policy.enabled) return budgetReject("POLICY_DISABLED", refKey(request.policy));
    if (policy.currency !== request.currency) return budgetReject("CURRENCY_MISMATCH", request.currency);
    const keys = budgetKeys(policy, request);
    const checks: Array<[string, number, BudgetRejectionCode]> = [
      [keys.invocation, policy.limits.invocationMinor, "INVOCATION_LIMIT_EXCEEDED"],
      [keys.step, policy.limits.stepMinor, "STEP_LIMIT_EXCEEDED"],
      [keys.contract, policy.limits.contractMinor, "CONTRACT_LIMIT_EXCEEDED"],
      [keys.provider, policy.limits.providerMinor, "PROVIDER_LIMIT_EXCEEDED"],
      [keys.period, policy.limits.periodMinor, "PERIOD_LIMIT_EXCEEDED"],
    ];
    for (const [key, limit, code] of checks) {
      const total = this.totals.get(key) ?? { reserved: 0, committed: 0 };
      if (total.reserved + total.committed + request.amountMinor > limit) {
        return budgetReject(code, key);
      }
    }
    for (const key of Object.values(keys)) this.addReserved(key, request.amountMinor);
    const reservation = deepFreeze({ ...request, policy: { ...request.policy }, status: "active" as const, committedMinor: 0 });
    this.records.set(request.reservationId, { fingerprint, reservation, settlement: null });
    return { ok: true, reservation };
  }

  commit(reservationId: string, ownerId: string, actualMinor: number): BudgetGuardResult {
    if (!isIdentifier(reservationId) || !isIdentifier(ownerId) || !nonNegativeSafeInteger(actualMinor)) {
      return budgetReject("INVALID_REQUEST", "budget_commit_invalid");
    }
    const record = this.records.get(reservationId);
    if (!record) return budgetReject("RESERVATION_NOT_FOUND", reservationId);
    if (record.reservation.ownerId !== ownerId) return budgetReject("OWNER_MISMATCH", reservationId);
    const settlement = `commit:${actualMinor}`;
    if (record.reservation.status !== "active") {
      return record.settlement === settlement
        ? { ok: true, reservation: record.reservation }
        : budgetReject("IDEMPOTENCY_CONFLICT", reservationId);
    }
    if (actualMinor > record.reservation.amountMinor) return budgetReject("COMMIT_EXCEEDS_RESERVATION", reservationId);
    const policy = this.policies.get(refKey(record.reservation.policy)) as BudgetPolicySpec;
    for (const key of Object.values(budgetKeys(policy, record.reservation))) {
      this.moveReservedToCommitted(key, record.reservation.amountMinor, actualMinor);
    }
    record.reservation = deepFreeze({ ...record.reservation, status: "committed" as const, committedMinor: actualMinor });
    record.settlement = settlement;
    return { ok: true, reservation: record.reservation };
  }

  release(reservationId: string, ownerId: string): BudgetGuardResult {
    if (!isIdentifier(reservationId) || !isIdentifier(ownerId)) return budgetReject("INVALID_REQUEST", "budget_release_invalid");
    const record = this.records.get(reservationId);
    if (!record) return budgetReject("RESERVATION_NOT_FOUND", reservationId);
    if (record.reservation.ownerId !== ownerId) return budgetReject("OWNER_MISMATCH", reservationId);
    if (record.reservation.status !== "active") {
      return record.settlement === "release"
        ? { ok: true, reservation: record.reservation }
        : budgetReject("IDEMPOTENCY_CONFLICT", reservationId);
    }
    const policy = this.policies.get(refKey(record.reservation.policy)) as BudgetPolicySpec;
    for (const key of Object.values(budgetKeys(policy, record.reservation))) this.addReserved(key, -record.reservation.amountMinor);
    record.reservation = deepFreeze({ ...record.reservation, status: "released" as const, committedMinor: 0 });
    record.settlement = "release";
    return { ok: true, reservation: record.reservation };
  }

  inspect(policyRef: RegistryRef, dimension: BudgetDimension, dimensionIds: readonly string[]): BudgetTotals | null {
    const expectedIds = dimension === "step" ? 2 : 1;
    if (!validRef(policyRef) || !Array.isArray(dimensionIds) || dimensionIds.length !== expectedIds || !dimensionIds.every(isIdentifier)) return null;
    const policy = this.policies.get(refKey(policyRef));
    if (!policy) return null;
    const key = budgetDimensionKey(refKey(policyRef), dimension, dimensionIds);
    return deepFreeze({ ...(this.totals.get(key) ?? { reserved: 0, committed: 0 }) });
  }

  private addReserved(key: string, amount: number): void {
    const total = this.totals.get(key) ?? { reserved: 0, committed: 0 };
    total.reserved += amount;
    this.totals.set(key, total);
  }

  private moveReservedToCommitted(key: string, reserved: number, committed: number): void {
    const total = this.totals.get(key) as BudgetTotals;
    total.reserved -= reserved;
    total.committed += committed;
  }
}

function budgetKeys(policy: BudgetPolicySpec, request: Pick<BudgetReservationRequest, "contractId" | "stepId" | "invocationId" | "providerId">): Record<"invocation" | "step" | "contract" | "provider" | "period", string> {
  const prefix = refKey({ id: policy.policyId, version: policy.version });
  return {
    invocation: budgetDimensionKey(prefix, "invocation", [request.invocationId]),
    step: budgetDimensionKey(prefix, "step", [request.contractId, request.stepId]),
    contract: budgetDimensionKey(prefix, "contract", [request.contractId]),
    provider: budgetDimensionKey(prefix, "provider", [request.providerId]),
    period: budgetDimensionKey(prefix, "period", [policy.periodId]),
  };
}

function budgetDimensionKey(policyKey: string, dimension: BudgetDimension, ids: readonly string[]): string {
  return JSON.stringify([policyKey, dimension, ...ids]);
}

function parseRoutingRequest(value: unknown): RoutingResolutionRequest | null {
  if (!isDataRecord(value) || !hasOnlyKeys(value, ["invocationId", "contractId", "targetId", "globalPolicy", "targetPolicy", "contractPolicy", "invocationPolicy"])) return null;
  if (!isIdentifier(value.invocationId) || !isIdentifier(value.contractId) || !isIdentifier(value.targetId) || !validRef(value.globalPolicy)) return null;
  for (const key of ["targetPolicy", "contractPolicy", "invocationPolicy"] as const) {
    if (value[key] !== undefined && !validRef(value[key])) return null;
  }
  return deepFreeze(structuredClone(value)) as unknown as RoutingResolutionRequest;
}

function parseQuotaRequest(value: unknown): QuotaReservationRequest | null {
  if (!isDataRecord(value) || exactKeys(value, ["reservationId", "ownerId", "pool", "units", "priority"]) !== null) return null;
  if (!isIdentifier(value.reservationId) || !isIdentifier(value.ownerId) || !validRef(value.pool) || !positiveSafeInteger(value.units)) return null;
  if (!(value.priority === "standard" || value.priority === "critical")) return null;
  return deepFreeze(structuredClone(value)) as unknown as QuotaReservationRequest;
}

function parseBudgetRequest(value: unknown): BudgetReservationRequest | null {
  if (!isDataRecord(value) || exactKeys(value, ["reservationId", "ownerId", "policy", "contractId", "stepId", "invocationId", "providerId", "currency", "amountMinor"]) !== null) return null;
  if (!isIdentifier(value.reservationId) || !isIdentifier(value.ownerId) || !validRef(value.policy)
    || !isIdentifier(value.contractId) || !isIdentifier(value.stepId) || !isIdentifier(value.invocationId)
    || !isIdentifier(value.providerId) || !validCurrency(value.currency) || !positiveSafeInteger(value.amountMinor)) return null;
  return deepFreeze(structuredClone(value)) as unknown as BudgetReservationRequest;
}

function validAccessPolicy(value: unknown): value is AccessPolicySpec {
  return isDataRecord(value)
    && exactKeys(value, ["policyId", "version", "allowedModes", "preferredMode", "apiFallbackAllowed", "enabled"]) === null
    && isIdentifier(value.policyId) && isVersion(value.version)
    && uniqueEnumArray(value.allowedModes, ["quota-session", "api", "local"], 1, 3)
    && isAccessMode(value.preferredMode) && (value.allowedModes as unknown[]).includes(value.preferredMode)
    && typeof value.apiFallbackAllowed === "boolean" && typeof value.enabled === "boolean";
}

function validModelProfile(value: unknown): value is ModelProfileSpec {
  return isDataRecord(value)
    && exactKeys(value, ["profileId", "version", "requiredCapabilities", "enabled"]) === null
    && isIdentifier(value.profileId) && isVersion(value.version)
    && uniqueIdentifierArray(value.requiredCapabilities, 1, 64)
    && typeof value.enabled === "boolean";
}

function validRuntime(value: unknown): value is RuntimeSpec {
  if (!isDataRecord(value) || exactKeys(value, ["runtimeId", "version", "providerId", "accessMode", "quotaPool", "models", "enabled"]) !== null) return false;
  if (!isIdentifier(value.runtimeId) || !isVersion(value.version) || !isIdentifier(value.providerId) || !isAccessMode(value.accessMode)
    || !(value.quotaPool === null || validRef(value.quotaPool)) || !Array.isArray(value.models) || value.models.length < 1 || value.models.length > 128
    || typeof value.enabled !== "boolean") return false;
  if (value.accessMode === "quota-session" && value.quotaPool === null) return false;
  if (value.accessMode !== "quota-session" && value.quotaPool !== null) return false;
  const keys = new Set<string>();
  for (const model of value.models) {
    if (!validRuntimeModel(model)) return false;
    const key = refKey({ id: model.modelId, version: model.version });
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return true;
}

function validRuntimeModel(value: unknown): value is RuntimeModelSpec {
  return isDataRecord(value)
    && exactKeys(value, ["modelId", "version", "supportedProfiles", "supportedEfforts", "capabilities", "enabled"]) === null
    && isIdentifier(value.modelId) && isVersion(value.version)
    && uniqueRefArray(value.supportedProfiles, 1, 64)
    && uniqueEnumArray(value.supportedEfforts, ["low", "medium", "high", "xhigh", "provider-default"], 1, 5)
    && uniqueIdentifierArray(value.capabilities, 1, 128)
    && typeof value.enabled === "boolean";
}

function validRoutingPolicy(value: unknown): value is RoutingPolicySpec {
  if (!isDataRecord(value) || exactKeys(value, ["policyId", "version", "scope", "scopeId", "selection", "enabled"]) !== null) return false;
  if (!isIdentifier(value.policyId) || !isVersion(value.version) || !isRoutingScope(value.scope) || !isIdentifier(value.scopeId)
    || !validRoutingSelection(value.selection) || typeof value.enabled !== "boolean") return false;
  if (value.scope === "global" && value.scopeId !== "global") return false;
  if (value.scope === "global") {
    const required = ["controlMode", "accessPolicy", "accessMode", "runtime", "modelProfile", "model", "effort"];
    if (required.some((key) => !(key in value.selection))) return false;
  }
  return true;
}

function validRoutingSelection(value: unknown): value is RoutingSelection {
  if (!isDataRecord(value) || !hasOnlyKeys(value, routingFields) || Object.keys(value).length === 0) return false;
  if (value.controlMode !== undefined && !(["manual", "assisted", "automatic"] as unknown[]).includes(value.controlMode)) return false;
  if (value.accessPolicy !== undefined && !validRef(value.accessPolicy)) return false;
  if (value.accessMode !== undefined && !isAccessMode(value.accessMode)) return false;
  if (value.runtime !== undefined && !validRef(value.runtime)) return false;
  if (value.modelProfile !== undefined && !validRef(value.modelProfile)) return false;
  if (value.model !== undefined && !validRef(value.model)) return false;
  if (value.effort !== undefined && !(["low", "medium", "high", "xhigh", "provider-default"] as unknown[]).includes(value.effort)) return false;
  if (value.budgetPolicy !== undefined && !validRef(value.budgetPolicy)) return false;
  if (value.maxInvocationCostMinor !== undefined && !positiveSafeInteger(value.maxInvocationCostMinor)) return false;
  return true;
}

function validQuotaPool(value: unknown): value is QuotaPoolSpec {
  if (!isDataRecord(value) || exactKeys(value, ["poolId", "version", "concurrencyLimit", "quota", "enabled"]) !== null) return false;
  if (!isIdentifier(value.poolId) || !isVersion(value.version) || !positiveSafeInteger(value.concurrencyLimit) || typeof value.enabled !== "boolean") return false;
  if (!isDataRecord(value.quota) || typeof value.quota.measurable !== "boolean") return false;
  if (value.quota.measurable === false) return exactKeys(value.quota, ["measurable"]) === null;
  return exactKeys(value.quota, ["measurable", "unit", "remainingUnits", "reserveUnits", "observedAt", "resetAt"]) === null
    && isIdentifier(value.quota.unit) && nonNegativeSafeInteger(value.quota.remainingUnits)
    && nonNegativeSafeInteger(value.quota.reserveUnits) && value.quota.reserveUnits <= value.quota.remainingUnits
    && canonicalTimestamp(value.quota.observedAt) && canonicalTimestamp(value.quota.resetAt)
    && Date.parse(value.quota.observedAt) < Date.parse(value.quota.resetAt);
}

function validBudgetPolicy(value: unknown): value is BudgetPolicySpec {
  return isDataRecord(value)
    && exactKeys(value, ["policyId", "version", "currency", "periodId", "limits", "enabled"]) === null
    && isIdentifier(value.policyId) && isVersion(value.version) && validCurrency(value.currency) && isIdentifier(value.periodId)
    && isDataRecord(value.limits) && exactKeys(value.limits, ["invocationMinor", "stepMinor", "contractMinor", "providerMinor", "periodMinor"]) === null
    && positiveSafeInteger(value.limits.invocationMinor) && positiveSafeInteger(value.limits.stepMinor)
    && positiveSafeInteger(value.limits.contractMinor) && positiveSafeInteger(value.limits.providerMinor)
    && positiveSafeInteger(value.limits.periodMinor)
    && value.limits.invocationMinor <= value.limits.stepMinor
    && value.limits.stepMinor <= value.limits.contractMinor
    && value.limits.invocationMinor <= value.limits.providerMinor
    && value.limits.contractMinor <= value.limits.periodMinor
    && value.limits.providerMinor <= value.limits.periodMinor
    && typeof value.enabled === "boolean";
}

function buildRegistry<T>(values: readonly T[], validator: (value: unknown) => value is T, keyOf: (value: T) => string, label: string): ReadonlyMap<string, T> {
  try {
    if (!Array.isArray(values) || values.length > 512) throw new Error(`${label}_registry_invalid`);
    const entries = new Map<string, T>();
    for (const raw of values) {
      if (!validator(raw)) throw new Error(`${label}_descriptor_invalid`);
      const snapshot = deepFreeze(structuredClone(raw));
      const key = keyOf(snapshot);
      if (entries.has(key)) throw new Error(`${label}_registry_duplicate`);
      entries.set(key, snapshot);
    }
    return entries;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${label}_`)) throw error;
    throw new Error(`${label}_descriptor_invalid`);
  }
}

function routingReject(code: RoutingRejectionCode, detail: string): RoutingResolutionResult {
  return { ok: false, code, detail };
}

function quotaReject(code: Exclude<QuotaGuardResult, { ok: true }>["code"], detail: string): QuotaGuardResult {
  return { ok: false, code, detail };
}

type BudgetRejectionCode = Exclude<BudgetGuardResult, { ok: true }>["code"];

function budgetReject(code: BudgetRejectionCode, detail: string): BudgetGuardResult {
  return { ok: false, code, detail };
}

function refKey(ref: RegistryRef): string {
  return `${ref.id}@${ref.version}`;
}

function hasRef(refs: readonly RegistryRef[], target: RegistryRef): boolean {
  return refs.some((ref) => ref.id === target.id && ref.version === target.version);
}

function validRef(value: unknown): value is RegistryRef {
  return isDataRecord(value) && exactKeys(value, ["id", "version"]) === null && isIdentifier(value.id) && isVersion(value.version);
}

function uniqueRefArray(value: unknown, min: number, max: number): value is RegistryRef[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) return false;
  const keys = new Set<string>();
  for (const item of value) {
    if (!validRef(item)) return false;
    const key = refKey(item);
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return true;
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

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Reflect.ownKeys(value).every((key) => typeof key === "string" && allowed.includes(key));
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value);
}

function isVersion(value: unknown): value is string {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);
}

function validCurrency(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function contextTime(value: string | number | Date): number | null {
  const parsed = value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

function isAccessMode(value: unknown): value is AccessMode {
  return value === "quota-session" || value === "api" || value === "local";
}

function isRoutingScope(value: unknown): value is RoutingScope {
  return value === "global" || value === "target" || value === "contract" || value === "invocation";
}

function positiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function uniqueIdentifierArray(value: unknown, min: number, max: number): value is string[] {
  return Array.isArray(value) && value.length >= min && value.length <= max
    && value.every(isIdentifier) && new Set(value).size === value.length;
}

function uniqueEnumArray(value: unknown, allowed: readonly string[], min: number, max: number): boolean {
  return Array.isArray(value) && value.length >= min && value.length <= max
    && value.every((item) => allowed.includes(item)) && new Set(value).size === value.length;
}

function canonicalFingerprint(value: unknown): string {
  return JSON.stringify(canonicalize(value));
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

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

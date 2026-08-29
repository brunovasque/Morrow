import assert from "node:assert/strict";
import test from "node:test";
import {
  CapabilityRegistry,
  GovernanceResolver,
  RoleRegistry,
  SecretBrokerBoundary,
  SecretPolicyRegistry,
  SkillRegistry,
  TargetRegistry,
  type CapabilitySpec,
  type GovernanceRegistries,
  type RegistryRef,
  type RoleSpec,
  type SecretPolicySpec,
  type SkillSpec,
  type TargetDescriptor,
  type WorkAuthorityRequest,
  type WorkAuthorityResult,
} from "../src/governance-registries.ts";

const roleRef = ref("executor", "1.0.0");
const skillRef = ref("typescript-change", "1.0.0");
const readRef = ref("repository.read", "1.0.0");
const writeRef = ref("repository.write", "1.0.0");
const secretRef = ref("secret.consume", "1.0.0");
const policyRef = ref("target-secrets", "1.0.0");
const fixedBrokerClock = () => "2026-08-28T12:00:00.000Z";

function ref(id: string, version: string): RegistryRef {
  return { id, version };
}

function target(overrides: Partial<TargetDescriptor> = {}): TargetDescriptor {
  return {
    targetId: "fixture-repository",
    descriptorVersion: "1.0.0",
    repositoryLocatorRef: "repository.fixture-local",
    baseRef: "refs/heads/main",
    writeMode: "pr-only",
    allowedPaths: ["src/**", "test/**"],
    forbiddenPaths: ["private/**"],
    requiredChecks: ["unit-tests"],
    regressionProfileId: "regression.fixture",
    secretPolicy: policyRef,
    deploymentPolicyId: "deploy.none",
    rollbackPolicyId: "rollback.git",
    ownerPolicyId: "owner.fixture",
    allowedRoles: [roleRef],
    allowedSkills: [skillRef],
    allowedCapabilities: [readRef, writeRef, secretRef],
    enabled: true,
    ...overrides,
  };
}

function role(overrides: Partial<RoleSpec> = {}): RoleSpec {
  return {
    roleId: roleRef.id,
    version: roleRef.version,
    allowedSkills: [skillRef],
    allowedCapabilities: [readRef, writeRef, secretRef],
    requiredCapabilities: [readRef, writeRef],
    enabled: true,
    ...overrides,
  };
}

function skill(overrides: Partial<SkillSpec> = {}): SkillSpec {
  return {
    skillId: skillRef.id,
    version: skillRef.version,
    allowedRoles: [roleRef],
    requiredCapabilities: [readRef, writeRef],
    enabled: true,
    ...overrides,
  };
}

function capability(
  capabilityRef: RegistryRef,
  kind: CapabilitySpec["kind"],
  overrides: Partial<CapabilitySpec> = {},
): CapabilitySpec {
  return {
    capabilityId: capabilityRef.id,
    version: capabilityRef.version,
    kind,
    risk: kind === "secret-use" ? "high" : "medium",
    enabled: true,
    ...overrides,
  };
}

function policy(overrides: Partial<SecretPolicySpec> = {}): SecretPolicySpec {
  return {
    policyId: policyRef.id,
    version: policyRef.version,
    rules: [{
      secretRef: "github.fixture",
      purpose: "repository-auth",
      consumer: { kind: "connector", id: "git-adapter" },
      capability: secretRef,
      delivery: "opaque-handle",
    }],
    enabled: true,
    ...overrides,
  };
}

function registries(overrides: Partial<{
  targets: TargetDescriptor[];
  roles: RoleSpec[];
  skills: SkillSpec[];
  capabilities: CapabilitySpec[];
  policies: SecretPolicySpec[];
}> = {}): GovernanceRegistries {
  return {
    targets: new TargetRegistry(overrides.targets ?? [target()]),
    roles: new RoleRegistry(overrides.roles ?? [role()]),
    skills: new SkillRegistry(overrides.skills ?? [skill()]),
    capabilities: new CapabilityRegistry(overrides.capabilities ?? [
      capability(readRef, "repository-read"),
      capability(writeRef, "repository-write"),
      capability(secretRef, "secret-use"),
    ]),
    secretPolicies: new SecretPolicyRegistry(overrides.policies ?? [policy()]),
  };
}

function request(overrides: Partial<WorkAuthorityRequest> = {}): WorkAuthorityRequest {
  return {
    contractId: "contract-fixture",
    stepId: "step-1",
    targetId: "fixture-repository",
    role: roleRef,
    skills: [skillRef],
    capabilities: [readRef, writeRef, secretRef],
    secretRequests: [{
      secretRef: "github.fixture",
      purpose: "repository-auth",
      consumer: { kind: "connector", id: "git-adapter" },
      capability: secretRef,
    }],
    ...overrides,
  };
}

function expectRejected(result: WorkAuthorityResult, code: string): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, code);
}

test("resolves exact target, role, skill, capabilities and opaque secret access", () => {
  const resolver = new GovernanceResolver(registries());
  const result = resolver.resolve(request());

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.authority.target.targetId, "fixture-repository");
  assert.equal(result.authority.role.roleId, "executor");
  assert.deepEqual(result.authority.skills.map((item) => item.skillId), ["typescript-change"]);
  assert.deepEqual(
    result.authority.capabilities.map((item) => item.capabilityId),
    ["repository.read", "repository.write", "secret.consume"],
  );
  assert.equal(result.authority.secretAccess[0].delivery, "opaque-handle");
  assert.equal("value" in result.authority.secretAccess[0], false);
  assert.equal("token" in result.authority.secretAccess[0], false);
  assert.equal(Object.isFrozen(result.authority), true);
  assert.equal(Object.isFrozen(result.authority.target), true);
});

test("does not infer a target and refuses unknown or disabled targets", () => {
  const resolver = new GovernanceResolver(registries());
  expectRejected(resolver.resolve({ ...request(), targetId: "" }), "INVALID_REQUEST");
  expectRejected(resolver.resolve(request({ targetId: "not-registered" })), "TARGET_NOT_FOUND");

  const disabled = new GovernanceResolver(registries({ targets: [target({ enabled: false })] }));
  expectRejected(disabled.resolve(request()), "TARGET_DISABLED");
});

test("requires an exact enabled role that the target explicitly allows", () => {
  const resolver = new GovernanceResolver(registries());
  expectRejected(resolver.resolve(request({ role: ref("reviewer", "1.0.0") })), "ROLE_NOT_FOUND");
  expectRejected(resolver.resolve(request({ role: ref("executor", "2.0.0") })), "ROLE_NOT_FOUND");

  const disabled = new GovernanceResolver(registries({ roles: [role({ enabled: false })] }));
  expectRejected(disabled.resolve(request()), "ROLE_DISABLED");

  const forbidden = new GovernanceResolver(registries({
    targets: [target({ allowedRoles: [ref("reviewer", "1.0.0")] })],
  }));
  expectRejected(forbidden.resolve(request()), "ROLE_NOT_ALLOWED");
});

test("requires at least one exact skill allowed by target, role and skill policy", () => {
  const resolver = new GovernanceResolver(registries());
  expectRejected(resolver.resolve(request({ skills: [] })), "INVALID_REQUEST");
  expectRejected(resolver.resolve(request({ skills: [ref("unknown-skill", "1.0.0")] })), "SKILL_NOT_FOUND");

  const targetDenied = new GovernanceResolver(registries({
    targets: [target({ allowedSkills: [ref("review", "1.0.0")] })],
  }));
  expectRejected(targetDenied.resolve(request()), "SKILL_NOT_ALLOWED");

  const roleDenied = new GovernanceResolver(registries({
    roles: [role({ allowedSkills: [ref("review", "1.0.0")] })],
  }));
  expectRejected(roleDenied.resolve(request()), "SKILL_NOT_ALLOWED");

  const skillDenied = new GovernanceResolver(registries({
    skills: [skill({ allowedRoles: [ref("reviewer", "1.0.0")] })],
  }));
  expectRejected(skillDenied.resolve(request()), "SKILL_NOT_ALLOWED");

  const disabled = new GovernanceResolver(registries({ skills: [skill({ enabled: false })] }));
  expectRejected(disabled.resolve(request()), "SKILL_DISABLED");
});

test("requires exact capabilities across registry, target, role and required sets", () => {
  const resolver = new GovernanceResolver(registries());
  expectRejected(resolver.resolve(request({ capabilities: [] })), "INVALID_REQUEST");
  expectRejected(
    resolver.resolve(request({ capabilities: [readRef, writeRef, ref("missing", "1.0.0")] })),
    "CAPABILITY_NOT_FOUND",
  );
  expectRejected(resolver.resolve(request({ capabilities: [readRef, secretRef] })), "ROLE_REQUIRED_CAPABILITY_MISSING");

  const targetDenied = new GovernanceResolver(registries({
    targets: [target({ allowedCapabilities: [readRef, secretRef] })],
  }));
  expectRejected(targetDenied.resolve(request()), "CAPABILITY_NOT_ALLOWED");

  const disabled = new GovernanceResolver(registries({
    capabilities: [
      capability(readRef, "repository-read"),
      capability(writeRef, "repository-write", { enabled: false }),
      capability(secretRef, "secret-use"),
    ],
  }));
  expectRejected(disabled.resolve(request()), "CAPABILITY_DISABLED");
});

test("requires every skill capability in the resolved request", () => {
  const extraRef = ref("test.execute", "1.0.0");
  const resolver = new GovernanceResolver(registries({
    targets: [target({ allowedCapabilities: [readRef, writeRef, secretRef, extraRef] })],
    roles: [role({ allowedCapabilities: [readRef, writeRef, secretRef, extraRef] })],
    skills: [skill({ requiredCapabilities: [readRef, writeRef, extraRef] })],
    capabilities: [
      capability(readRef, "repository-read"),
      capability(writeRef, "repository-write"),
      capability(secretRef, "secret-use"),
      capability(extraRef, "process"),
    ],
  }));
  expectRejected(resolver.resolve(request()), "SKILL_REQUIRED_CAPABILITY_MISSING");
});

test("requires a registered enabled secret policy even when no secret is requested", () => {
  const missing = new GovernanceResolver(registries({ policies: [] }));
  expectRejected(missing.resolve(request({ secretRequests: [] })), "SECRET_POLICY_NOT_FOUND");

  const disabled = new GovernanceResolver(registries({ policies: [policy({ enabled: false })] }));
  expectRejected(disabled.resolve(request({ secretRequests: [] })), "SECRET_POLICY_DISABLED");
});

test("denies secret requests unless policy, purpose, consumer and secret capability all match", () => {
  const resolver = new GovernanceResolver(registries());
  for (const changed of [
    { secretRef: "github.other" },
    { purpose: "deploy-production" },
    { consumer: { kind: "runtime" as const, id: "agent" } },
    { capability: writeRef },
  ]) {
    const original = request().secretRequests[0];
    expectRejected(
      resolver.resolve(request({ secretRequests: [{ ...original, ...changed }] })),
      "SECRET_REQUEST_DENIED",
    );
  }
});

test("Secret Broker accepts only resolver-issued access and returns a short-lived opaque handle", async () => {
  const resolver = new GovernanceResolver(registries());
  const resolved = resolver.resolve(request());
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;

  const broker = new SecretBrokerBoundary(resolver, async () => ({
    handleId: "handle-1",
    consumer: { kind: "connector", id: "git-adapter" },
    delivery: "opaque-handle",
    expiresAt: "2026-08-28T12:01:00.000Z",
  }), fixedBrokerClock);
  const issued = await broker.issue(resolved.authority.secretAccess[0]);
  assert.equal(issued.ok, true);
  if (!issued.ok) return;
  assert.equal(issued.handle.handleId, "handle-1");
  assert.equal("secretRef" in issued.handle, false);
  assert.equal("value" in issued.handle, false);
  assert.equal(Object.isFrozen(issued.handle), true);
});

test("Secret Broker makes concurrent retries idempotent for one resolved approval", async () => {
  const resolver = new GovernanceResolver(registries());
  const resolved = resolver.resolve(request());
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  let calls = 0;
  const broker = new SecretBrokerBoundary(resolver, async (approved) => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return {
      handleId: "handle-idempotent",
      consumer: approved.consumer,
      delivery: "opaque-handle",
      expiresAt: "2026-08-28T12:01:00.000Z",
    };
  }, fixedBrokerClock);

  const [first, retry] = await Promise.all([
    broker.issue(resolved.authority.secretAccess[0]),
    broker.issue(resolved.authority.secretAccess[0]),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(retry, first);
});

test("Secret Broker refuses one handle id being rebound to another approval", async () => {
  const resolver = new GovernanceResolver(registries());
  const firstResolution = resolver.resolve(request());
  const secondResolution = resolver.resolve(request({ stepId: "step-2" }));
  assert.equal(firstResolution.ok, true);
  assert.equal(secondResolution.ok, true);
  if (!firstResolution.ok || !secondResolution.ok) return;
  const broker = new SecretBrokerBoundary(resolver, async (approved) => ({
    handleId: "handle-must-be-unique",
    consumer: approved.consumer,
    delivery: "opaque-handle",
    expiresAt: "2026-08-28T12:01:00.000Z",
  }), fixedBrokerClock);

  const first = await broker.issue(firstResolution.authority.secretAccess[0]);
  const rebound = await broker.issue(secondResolution.authority.secretAccess[0]);
  assert.equal(first.ok, true);
  assert.equal(rebound.ok, false);
  if (!rebound.ok) assert.equal(rebound.detail, "secret_handle_id_reused");
});

test("Secret Broker rejects structurally forged access without calling the issuer", async () => {
  const resolver = new GovernanceResolver(registries());
  let calls = 0;
  const broker = new SecretBrokerBoundary(resolver, async () => {
    calls += 1;
    return {};
  });
  const forged = {
    contractId: "contract-fixture",
    stepId: "step-1",
    targetId: "fixture-repository",
    role: roleRef,
    policy: policyRef,
    secretRef: "github.fixture",
    purpose: "repository-auth",
    consumer: { kind: "connector", id: "git-adapter" },
    capability: secretRef,
    delivery: "opaque-handle",
  };
  const result = await broker.issue(forged);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "SECRET_ACCESS_NOT_RESOLVED");
  assert.equal(calls, 0);
});

test("Secret Broker rejects material, wrong consumers, long leases and sanitized issuer failures", async () => {
  const resolver = new GovernanceResolver(registries());
  const resolved = resolver.resolve(request());
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  const approved = resolved.authority.secretAccess[0];

  const withMaterial = new SecretBrokerBoundary(resolver, async () => ({
    handleId: "handle-1",
    consumer: approved.consumer,
    delivery: "opaque-handle",
    expiresAt: "2026-08-28T12:01:00.000Z",
    token: "must-not-cross-boundary",
  }), fixedBrokerClock);
  const materialResult = await withMaterial.issue(approved);
  assert.equal(materialResult.ok, false);
  if (!materialResult.ok) assert.equal(materialResult.code, "SECRET_HANDLE_INVALID");

  const wrongConsumer = new SecretBrokerBoundary(resolver, async () => ({
    handleId: "handle-1",
    consumer: { kind: "runtime", id: "other" },
    delivery: "opaque-handle",
    expiresAt: "2026-08-28T12:01:00.000Z",
  }), fixedBrokerClock);
  assert.equal((await wrongConsumer.issue(approved)).ok, false);

  const longLease = new SecretBrokerBoundary(resolver, async () => ({
    handleId: "handle-1",
    consumer: approved.consumer,
    delivery: "opaque-handle",
    expiresAt: "2026-08-28T12:10:00.000Z",
  }), fixedBrokerClock);
  assert.equal((await longLease.issue(approved)).ok, false);

  const expired = new SecretBrokerBoundary(resolver, async () => ({
    handleId: "handle-expired",
    consumer: approved.consumer,
    delivery: "opaque-handle",
    expiresAt: "2026-08-28T11:59:59.999Z",
  }), fixedBrokerClock);
  assert.equal((await expired.issue(approved)).ok, false);

  const failing = new SecretBrokerBoundary(resolver, async () => {
    throw new Error("credential-value-must-not-leak");
  });
  const failure = await failing.issue(approved);
  assert.equal(failure.ok, false);
  if (!failure.ok) {
    assert.equal(failure.code, "SECRET_BROKER_UNAVAILABLE");
    assert.equal(failure.detail.includes("credential-value"), false);
  }
});

test("strict request refuses command, credential material, duplicate refs and prototype input", () => {
  const resolver = new GovernanceResolver(registries());
  expectRejected(resolver.resolve({ ...request(), command: "powershell.exe" }), "INVALID_REQUEST");
  expectRejected(resolver.resolve({ ...request(), token: "secret" }), "INVALID_REQUEST");
  expectRejected(
    resolver.resolve(request({ capabilities: [readRef, readRef, writeRef] })),
    "INVALID_REQUEST",
  );
  expectRejected(
    resolver.resolve(request({ capabilities: [readRef, ref(readRef.id, "2.0.0"), writeRef] })),
    "INVALID_REQUEST",
  );
  const inherited = Object.create({ targetId: "fixture-repository" });
  Object.assign(inherited, request());
  expectRejected(resolver.resolve(inherited), "INVALID_REQUEST");

  const hostile = new Proxy(request(), {
    ownKeys() { throw new Error("untrusted-request-details"); },
  });
  const hostileResult = resolver.resolve(hostile);
  expectRejected(hostileResult, "INVALID_REQUEST");
  if (!hostileResult.ok) assert.equal(hostileResult.detail.includes("untrusted-request-details"), false);
});

test("registries reject duplicates, unsafe target paths, accessors and inconsistent roles", () => {
  assert.throws(() => new TargetRegistry([target(), target()]), /target_registry_duplicate/);
  assert.throws(
    () => new TargetRegistry([target({ allowedPaths: ["../external/**"] })]),
    /target_descriptor_invalid/,
  );
  assert.throws(
    () => new RoleRegistry([role({ requiredCapabilities: [ref("deploy", "1.0.0")] })]),
    /role_descriptor_invalid/,
  );
  const accessor = {
    ...capability(readRef, "repository-read"),
    get enabled() { return true; },
  };
  assert.throws(() => new CapabilityRegistry([accessor]), /capability_descriptor_invalid/);
  const hostile = new Proxy(target(), {
    ownKeys() { throw new Error("registry-hostile-proxy"); },
  });
  assert.throws(() => new TargetRegistry([hostile]), /target_descriptor_invalid/);
});

test("Secret Broker converts hostile issuer objects into a sanitized rejection", async () => {
  const resolver = new GovernanceResolver(registries());
  const resolved = resolver.resolve(request());
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  const hostile = new Proxy({}, {
    ownKeys() { throw new Error("issuer-secret-details"); },
  });
  const broker = new SecretBrokerBoundary(resolver, async () => hostile);
  const result = await broker.issue(resolved.authority.secretAccess[0]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "SECRET_HANDLE_INVALID");
    assert.equal(result.detail.includes("issuer-secret-details"), false);
  }
});

test("registry snapshots are detached and frozen against later configuration mutation", () => {
  const descriptor = target();
  const registry = new TargetRegistry([descriptor]);
  descriptor.allowedPaths.push("operator-project/**");
  descriptor.targetId = "mutated";

  const resolved = registry.resolve("fixture-repository");
  assert.ok(resolved);
  assert.deepEqual(resolved.allowedPaths, ["src/**", "test/**"]);
  assert.equal(Object.isFrozen(resolved), true);
  assert.equal(Object.isFrozen(resolved.allowedPaths), true);
  assert.equal(registry.resolve("mutated"), null);
});

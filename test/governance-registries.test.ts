import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  CapabilityRegistry,
  GovernanceResolver,
  PersistentEventLogAuthority,
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
import { WorkerPrivateStateRoot } from "../src/worker-private-state.ts";

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

test("Secret Broker owns a persistent opaque Event Log authority and authenticates the external head", async (t) => {
  const parent = join(process.cwd(), ".morrow-test-tmp");
  const authorityRoot = await mkdtemp(join(parent, "authority-"));
  t.after(async () => await rm(authorityRoot, { recursive: true, force: true }));
  const eventLogId = "a".repeat(64);
  const streamIdentity = createHash("sha256").update(`morrow.event-log/stream/v1|${eventLogId}`, "utf8").digest("hex");
  const streamId = createHash("sha256").update(`${streamIdentity}|contract-fixture`, "utf8").digest("hex");
  const privateRoot = WorkerPrivateStateRoot.bootstrap({ workerId: "fixture-worker", privateRoot: authorityRoot, managedRoots: [] });
  const authority = new PersistentEventLogAuthority(privateRoot, "authority-one");
  const authorityCapability = authority.capability(eventLogId);
  const capability = authorityCapability.bindStream("contract-fixture", streamId);
  const prepared = {
    authorityRef: "authority-one",
    eventLogId,
    contractId: "contract-fixture",
    streamId,
    generation: 1,
    sequence: 1,
    eventTag: "c".repeat(64),
    phase: "prepared" as const,
    expectedPrevious: null,
  };
  await capability.prepareHead(prepared, null);
  await capability.commitHead({ ...prepared, phase: "committed" }, null);
  const anchors = await authorityCapability.readAnchors();
  assert.equal(anchors.length, 1);
  assert.equal(anchors[0]!.phase, "committed");
  const state = await readFile(join(authorityRoot, "event-log-authority", eventLogId + ".head.journal"), "utf8");
  const key = await readFile(join(authorityRoot, "event-log-authority", "event-log-authority-v4.key"), "hex");
  assert.equal(state.includes(key), false);
  assert.equal("key" in capability, false);
  await assert.rejects(
    capability.prepareHead({ ...prepared, sequence: 2, generation: 2 }, null),
    /event_log_anchor_cas_conflict/,
  );

  await writeFile(join(authorityRoot, "event-log-authority", "event-log-authority-v4.key"), Buffer.alloc(31));
  await assert.rejects(
    new PersistentEventLogAuthority(privateRoot, "authority-one").capability(eventLogId).readAnchors(),
    /(?:event_log_(anchor_(invalid|auth_invalid)|authority_(unavailable|binding_invalid))|worker_private_state_unowned)/,
  );
  await writeFile(join(authorityRoot, "event-log-authority", "event-log-authority-v4.key"), Buffer.alloc(32, 4));
  await assert.rejects(
    new PersistentEventLogAuthority(privateRoot, "authority-one").capability(eventLogId).readAnchors(),
    /(?:event_log_(anchor_(invalid|auth_invalid)|authority_(unavailable|binding_invalid))|worker_private_state_unowned)/,
  );
  const otherRoot = await mkdtemp(join(parent, "authority-other-"));
  t.after(async () => await rm(otherRoot, { recursive: true, force: true }));
  await mkdir(join(otherRoot, "event-log-authority"), { recursive: true });
  await writeFile(join(otherRoot, "event-log-authority", eventLogId + ".head.journal"), state, "utf8");
  const otherPrivateRoot = WorkerPrivateStateRoot.bootstrap({ workerId: "other-worker", privateRoot: otherRoot, managedRoots: [] });
  await assert.rejects(
    new PersistentEventLogAuthority(otherPrivateRoot, "authority-other").capability(eventLogId).readAnchors(),
    /(?:event_log_(anchor_(invalid|auth_invalid)|authority_(unavailable|binding_invalid))|worker_private_state_unowned)/,
  );
});

test("two independent processes bootstrap one Event Log authority without a raw race error", async (t) => {
  const parent = join(process.cwd(), ".morrow-test-tmp");
  const privateRootPath = await mkdtemp(join(parent, "bootstrap-race-"));
  t.after(async () => await rm(privateRootPath, { recursive: true, force: true }));
  const root = WorkerPrivateStateRoot.bootstrap({ workerId: "bootstrap-race-worker", privateRoot: privateRootPath, managedRoots: [] });
  await root.ensure();
  const eventLogId = "e".repeat(64);
  const contractId = "bootstrap-race-contract";
  const streamIdentity = createHash("sha256").update(`morrow.event-log/stream/v1|${eventLogId}`, "utf8").digest("hex");
  const streamId = createHash("sha256").update(`${streamIdentity}|${contractId}`, "utf8").digest("hex");
  const workerPrivateStateUrl = new URL("../src/worker-private-state.ts", import.meta.url).href;
  const authorityUrl = new URL("../src/governance-registries.ts", import.meta.url).href;
  const childSource = `
    import { WorkerPrivateStateRoot } from ${JSON.stringify(workerPrivateStateUrl)};
    import { PersistentEventLogAuthority } from ${JSON.stringify(authorityUrl)};
    const root = WorkerPrivateStateRoot.bootstrap({ workerId: "bootstrap-race-worker", privateRoot: process.argv[1], managedRoots: [] });
    try {
      const eventLogId = process.argv[2];
      const streamId = process.argv[3];
      const capability = new PersistentEventLogAuthority(root, "bootstrap-race-authority").capability(eventLogId);
      await capability.bindStream("bootstrap-race-contract", streamId);
      await capability.readAnchors();
      process.stdout.write("ok\\n");
    } catch (error) {
      process.stdout.write((error instanceof Error ? error.message : "bootstrap_failed") + "\\n");
      process.exitCode = 1;
    }
  `;
  const run = () => new Promise<{ code: number | null; stdout: string; stderr: string }>((resolveProcess) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", childSource, privateRootPath, eventLogId, streamId], {
      cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("close", (code) => resolveProcess({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
  const results = await Promise.all(Array.from({ length: 8 }, run));
  assert.deepEqual(results.map((result) => result.code), Array(8).fill(0));
  assert.deepEqual(results.map((result) => result.stdout), Array(8).fill("ok"));
  assert.equal(results.some((result) => result.stderr.includes("ReferenceError")), false);
  const authorityFiles = await (await import("node:fs/promises")).readdir(join(privateRootPath, "event-log-authority"));
  assert.equal(authorityFiles.filter((name) => name === "event-log-authority-v4.key").length, 1);
  assert.equal(authorityFiles.filter((name) => name === `${eventLogId}.binding.json`).length, 1);
  const restarted = new PersistentEventLogAuthority(root, "bootstrap-race-authority").capability(eventLogId);
  assert.equal((await restarted.readAnchors()).length, 0);
});

test("WorkerPrivateStateRoot is bootstrap-only, outside managed roots, stable, and junction-safe", async (t) => {
  const parent = join(process.cwd(), ".morrow-test-tmp");
  const root = await mkdtemp(join(parent, "private-state-"));
  t.after(async () => await rm(root, { recursive: true, force: true }));
  const managed = join(root, "managed");
  const privateRoot = join(root, "private");
  await mkdir(managed, { recursive: true });
  const state = WorkerPrivateStateRoot.bootstrap({ workerId: "stable-worker", privateRoot, managedRoots: [managed] });
  const first = await state.ensure();
  const second = await WorkerPrivateStateRoot.bootstrap({ workerId: "stable-worker", privateRoot, managedRoots: [managed] }).ensure();
  assert.equal(first.installationId, second.installationId);
  await assert.rejects(
    WorkerPrivateStateRoot.bootstrap({ workerId: "stable-worker", privateRoot: join(managed, "private"), managedRoots: [managed] }).ensure(),
    /worker_private_state_inside_managed_root/,
  );
  const junction = join(root, "junction");
  await symlink(privateRoot, junction, "junction");
  await assert.rejects(
    WorkerPrivateStateRoot.bootstrap({ workerId: "stable-worker", privateRoot: join(junction, "child"), managedRoots: [] }).ensure(),
    /worker_private_state_path_unsafe/,
  );
  assert.throws(() => new PersistentEventLogAuthority(privateRoot as never), /event_log_authority_private_root_required/);
});

test("Event Log capability is narrow and cannot cross contract or stream bindings", async (t) => {
  const parent = join(process.cwd(), ".morrow-test-tmp");
  const privateRootPath = await mkdtemp(join(parent, "capability-"));
  t.after(async () => await rm(privateRootPath, { recursive: true, force: true }));
  const privateRoot = WorkerPrivateStateRoot.bootstrap({ workerId: "capability-worker", privateRoot: privateRootPath, managedRoots: [] });
  const eventLogId = "d".repeat(64);
  const authority = new PersistentEventLogAuthority(privateRoot, "authority-capability");
  const rootCapability = authority.capability(eventLogId);
  assert.equal("authenticateEvent" in rootCapability, false);
  assert.equal("verifyEvent" in rootCapability, false);
  const identity = createHash("sha256").update(`morrow.event-log/stream/v1|${eventLogId}`, "utf8").digest("hex");
  const streamId = createHash("sha256").update(`${identity}|contract-a`, "utf8").digest("hex");
  assert.throws(() => rootCapability.bindStream("contract-b", streamId), /event_log_stream_binding_invalid/);
  const stream = rootCapability.bindStream("contract-a", streamId);
  assert.equal("authenticateEvent" in stream, false);
  assert.equal("domain" in stream, false);
  const item = {
    eventId: "capability-event",
    contractId: "contract-a",
    type: "STEP",
    occurredAt: "2026-09-01T12:00:00.000Z",
    actor: { kind: "kernel", id: "kernel" },
    payload: { ok: true },
    schemaVersion: "0.1",
  };
  const record = { format: "morrow.event-log/4", eventLogId, streamId, contractId: "contract-a", sequence: 1, eventId: item.eventId, previousAuthenticatedTag: "0".repeat(64), event: item };
  const tag = await stream.authenticateRecord(record);
  assert.equal(await stream.verifyRecord(record, tag), true);
  await assert.rejects(stream.authenticateRecord({ ...record, contractId: "contract-b", event: { ...item, contractId: "contract-b" } }), /event_log_record_invalid/);
});

test("WorkerPrivateStateRoot recovers only a bound stale endpoint lock, never PID-only state", async (t) => {
  const parent = join(process.cwd(), ".morrow-test-tmp");
  const privateRootPath = await mkdtemp(join(parent, "lock-"));
  t.after(async () => await rm(privateRootPath, { recursive: true, force: true }));
  const root = WorkerPrivateStateRoot.bootstrap({ workerId: "lock-worker", privateRoot: privateRootPath, managedRoots: [] });
  const marker = await root.ensure();
  const authorityRef = "lock-authority";
  const eventLogId = "f".repeat(64);
  const lockPath = join(privateRootPath, "locks", `${authorityRef}-${eventLogId}-event-log-anchor.lock`);
  await mkdir(lockPath, { recursive: true });
  await writeFile(join(lockPath, "lease.json"), `${JSON.stringify({
    format: "morrow.worker-private-lock/v1", authorityRef, eventLogId, ownerId: randomUUID(),
    instanceId: marker.installationId, processId: process.pid, endpointPort: 65_000,
  })}\n`, "utf8");
  const lock = await root.acquireExclusive(authorityRef, eventLogId);
  await lock.release();
  const legacyPath = join(privateRootPath, "locks", `${authorityRef}-${eventLogId}-event-log-anchor.lock`);
  await mkdir(legacyPath, { recursive: true });
  await writeFile(join(legacyPath, "lease.json"), `${JSON.stringify({
    format: "morrow.worker-private-lock/v1", authorityRef, eventLogId, ownerId: randomUUID(),
    processId: process.pid, endpointPort: 65_000,
  })}\n`, "utf8");
  await assert.rejects(root.acquireExclusive(authorityRef, eventLogId), /worker_private_state_lock_invalid/);
});

test("an authority cannot rebootstrap after its external history loses the key", async (t) => {
  const parent = join(process.cwd(), ".morrow-test-tmp");
  const privateRootPath = await mkdtemp(join(parent, "rebootstrap-"));
  t.after(async () => await rm(privateRootPath, { recursive: true, force: true }));
  const privateRoot = WorkerPrivateStateRoot.bootstrap({ workerId: "rebootstrap-worker", privateRoot: privateRootPath, managedRoots: [] });
  const eventLogId = "1".repeat(64);
  const streamIdentity = createHash("sha256").update(`morrow.event-log/stream/v1|${eventLogId}`, "utf8").digest("hex");
  const streamId = createHash("sha256").update(`${streamIdentity}|contract-rebootstrap`, "utf8").digest("hex");
  const authority = new PersistentEventLogAuthority(privateRoot, "rebootstrap-authority");
  const rootCapability = authority.capability(eventLogId);
  const stream = rootCapability.bindStream("contract-rebootstrap", streamId);
  const anchor = { authorityRef: "rebootstrap-authority", eventLogId, contractId: "contract-rebootstrap", streamId, generation: 1, sequence: 1, eventTag: "2".repeat(64), phase: "prepared" as const, expectedPrevious: null };
  await stream.prepareHead(anchor, null);
  await stream.commitHead({ ...anchor, phase: "committed" }, null);
  await unlink(join(privateRootPath, "event-log-authority", "event-log-authority-v4.key"));
  await assert.rejects(new PersistentEventLogAuthority(privateRoot, "rebootstrap-authority").capability(eventLogId).readAnchors(), /event_log_authority_(unavailable|rebootstrap_denied)/);
});

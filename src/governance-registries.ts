import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface RegistryRef {
  id: string;
  version: string;
}

export type TargetWriteMode = "read-only" | "branch-only" | "pr-only" | "governed-deploy";
export type CapabilityKind =
  | "repository-read"
  | "repository-write"
  | "process"
  | "agent-runtime"
  | "secret-use"
  | "connector";
export type CapabilityRisk = "low" | "medium" | "high" | "critical";
export type SecretConsumerKind = "runtime" | "connector" | "tool";

export interface TargetDescriptor {
  targetId: string;
  descriptorVersion: string;
  repositoryLocatorRef: string;
  baseRef: string;
  writeMode: TargetWriteMode;
  allowedPaths: string[];
  forbiddenPaths: string[];
  requiredChecks: string[];
  regressionProfileId: string;
  secretPolicy: RegistryRef;
  deploymentPolicyId: string;
  rollbackPolicyId: string;
  ownerPolicyId: string;
  allowedRoles: RegistryRef[];
  allowedSkills: RegistryRef[];
  allowedCapabilities: RegistryRef[];
  enabled: boolean;
}

export interface RoleSpec {
  roleId: string;
  version: string;
  allowedSkills: RegistryRef[];
  allowedCapabilities: RegistryRef[];
  requiredCapabilities: RegistryRef[];
  enabled: boolean;
}

export interface SkillSpec {
  skillId: string;
  version: string;
  allowedRoles: RegistryRef[];
  requiredCapabilities: RegistryRef[];
  enabled: boolean;
}

export interface CapabilitySpec {
  capabilityId: string;
  version: string;
  kind: CapabilityKind;
  risk: CapabilityRisk;
  enabled: boolean;
}

export interface SecretConsumer {
  kind: SecretConsumerKind;
  id: string;
}

export interface SecretPolicyRule {
  secretRef: string;
  purpose: string;
  consumer: SecretConsumer;
  capability: RegistryRef;
  delivery: "opaque-handle";
}

export interface SecretPolicySpec {
  policyId: string;
  version: string;
  rules: SecretPolicyRule[];
  enabled: boolean;
}

export interface SecretAccessRequest {
  secretRef: string;
  purpose: string;
  consumer: SecretConsumer;
  capability: RegistryRef;
}

export interface WorkAuthorityRequest {
  contractId: string;
  stepId: string;
  targetId: string;
  role: RegistryRef;
  skills: RegistryRef[];
  capabilities: RegistryRef[];
  secretRequests: SecretAccessRequest[];
}

export interface ResolvedSecretAccess {
  contractId: string;
  stepId: string;
  targetId: string;
  role: RegistryRef;
  policy: RegistryRef;
  secretRef: string;
  purpose: string;
  consumer: SecretConsumer;
  capability: RegistryRef;
  delivery: "opaque-handle";
}

export interface ResolvedWorkAuthority {
  contractId: string;
  stepId: string;
  target: TargetDescriptor;
  role: RoleSpec;
  skills: SkillSpec[];
  capabilities: CapabilitySpec[];
  secretAccess: ResolvedSecretAccess[];
}

export type WorkAuthorityRejectionCode =
  | "INVALID_REQUEST"
  | "TARGET_NOT_FOUND"
  | "TARGET_DISABLED"
  | "ROLE_NOT_FOUND"
  | "ROLE_DISABLED"
  | "ROLE_NOT_ALLOWED"
  | "SKILL_NOT_FOUND"
  | "SKILL_DISABLED"
  | "SKILL_NOT_ALLOWED"
  | "SKILL_REQUIRED_CAPABILITY_MISSING"
  | "ROLE_REQUIRED_CAPABILITY_MISSING"
  | "CAPABILITY_NOT_FOUND"
  | "CAPABILITY_DISABLED"
  | "CAPABILITY_NOT_ALLOWED"
  | "SECRET_POLICY_NOT_FOUND"
  | "SECRET_POLICY_DISABLED"
  | "SECRET_REQUEST_DENIED";

export type WorkAuthorityResult =
  | { ok: true; authority: ResolvedWorkAuthority }
  | { ok: false; code: WorkAuthorityRejectionCode; detail: string };

export interface SecretHandle {
  handleId: string;
  consumer: SecretConsumer;
  delivery: "opaque-handle";
  expiresAt: string;
}

export type SecretHandleIssuer = (approved: ResolvedSecretAccess) => Promise<unknown>;
export type SecretBrokerClock = () => string | number | Date;

export type SecretBrokerResult =
  | { ok: true; handle: SecretHandle }
  | {
    ok: false;
    code:
      | "SECRET_ACCESS_NOT_RESOLVED"
      | "SECRET_BROKER_UNAVAILABLE"
      | "SECRET_HANDLE_INVALID";
    detail: string;
  };

export interface EventLogHeadAnchor {
  authorityRef: string;
  eventLogId: string;
  contractId: string;
  streamId: string;
  generation: number;
  sequence: number;
  eventTag: string;
  phase: "prepared" | "committed";
  expectedPrevious: { generation: number; sequence: number; eventTag: string } | null;
}

export interface EventLogAuthorityCapability {
  readonly authorityRef: string;
  readonly eventLogId: string;
  authenticateEvent(domain: string): Promise<string>;
  verifyEvent(domain: string, tag: string): Promise<boolean>;
  readAnchors(): Promise<readonly EventLogHeadAnchor[]>;
  prepareHead(anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null): Promise<void>;
  commitHead(anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null): Promise<void>;
  abortHead(anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null): Promise<void>;
}

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const versionPattern = /^\d+\.\d+\.\d+$/;
const canonicalTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const maxSecretHandleTtlMs = 300_000;

export class TargetRegistry {
  private readonly entries: ReadonlyMap<string, TargetDescriptor>;

  constructor(descriptors: readonly TargetDescriptor[]) {
    this.entries = buildRegistry(descriptors, validateTargetDescriptor, (item) => item.targetId, "target");
  }

  resolve(targetId: string): TargetDescriptor | null {
    if (!isIdentifier(targetId)) return null;
    return this.entries.get(targetId) ?? null;
  }
}

export class RoleRegistry {
  private readonly entries: ReadonlyMap<string, RoleSpec>;

  constructor(specs: readonly RoleSpec[]) {
    this.entries = buildRegistry(specs, validateRoleSpec, (item) => refKey({ id: item.roleId, version: item.version }), "role");
  }

  resolve(ref: RegistryRef): RoleSpec | null {
    return validRef(ref) ? this.entries.get(refKey(ref)) ?? null : null;
  }
}

export class SkillRegistry {
  private readonly entries: ReadonlyMap<string, SkillSpec>;

  constructor(specs: readonly SkillSpec[]) {
    this.entries = buildRegistry(specs, validateSkillSpec, (item) => refKey({ id: item.skillId, version: item.version }), "skill");
  }

  resolve(ref: RegistryRef): SkillSpec | null {
    return validRef(ref) ? this.entries.get(refKey(ref)) ?? null : null;
  }
}

export class CapabilityRegistry {
  private readonly entries: ReadonlyMap<string, CapabilitySpec>;

  constructor(specs: readonly CapabilitySpec[]) {
    this.entries = buildRegistry(
      specs,
      validateCapabilitySpec,
      (item) => refKey({ id: item.capabilityId, version: item.version }),
      "capability",
    );
  }

  resolve(ref: RegistryRef): CapabilitySpec | null {
    return validRef(ref) ? this.entries.get(refKey(ref)) ?? null : null;
  }
}

export class SecretPolicyRegistry {
  private readonly entries: ReadonlyMap<string, SecretPolicySpec>;

  constructor(specs: readonly SecretPolicySpec[]) {
    this.entries = buildRegistry(
      specs,
      validateSecretPolicySpec,
      (item) => refKey({ id: item.policyId, version: item.version }),
      "secret_policy",
    );
  }

  resolve(ref: RegistryRef): SecretPolicySpec | null {
    return validRef(ref) ? this.entries.get(refKey(ref)) ?? null : null;
  }
}

export interface GovernanceRegistries {
  targets: TargetRegistry;
  roles: RoleRegistry;
  skills: SkillRegistry;
  capabilities: CapabilityRegistry;
  secretPolicies: SecretPolicyRegistry;
}

export class GovernanceResolver {
  private readonly approvedSecretAccess = new WeakSet<object>();
  private readonly registries: GovernanceRegistries;

  constructor(registries: GovernanceRegistries) {
    this.registries = registries;
  }

  resolve(input: unknown): WorkAuthorityResult {
    let request: WorkAuthorityRequest | null = null;
    try {
      request = parseWorkAuthorityRequest(input);
    } catch {
      return reject("INVALID_REQUEST", "work_authority_request_invalid");
    }
    if (!request) return reject("INVALID_REQUEST", "work_authority_request_invalid");

    const target = this.registries.targets.resolve(request.targetId);
    if (!target) return reject("TARGET_NOT_FOUND", request.targetId);
    if (!target.enabled) return reject("TARGET_DISABLED", request.targetId);

    const role = this.registries.roles.resolve(request.role);
    if (!role) return reject("ROLE_NOT_FOUND", refKey(request.role));
    if (!role.enabled) return reject("ROLE_DISABLED", refKey(request.role));
    if (!hasRef(target.allowedRoles, request.role)) return reject("ROLE_NOT_ALLOWED", refKey(request.role));

    const capabilities: CapabilitySpec[] = [];
    for (const capabilityRef of request.capabilities) {
      const capability = this.registries.capabilities.resolve(capabilityRef);
      if (!capability) return reject("CAPABILITY_NOT_FOUND", refKey(capabilityRef));
      if (!capability.enabled) return reject("CAPABILITY_DISABLED", refKey(capabilityRef));
      if (!hasRef(target.allowedCapabilities, capabilityRef) || !hasRef(role.allowedCapabilities, capabilityRef)) {
        return reject("CAPABILITY_NOT_ALLOWED", refKey(capabilityRef));
      }
      capabilities.push(capability);
    }

    const missingRoleCapability = role.requiredCapabilities.find((ref) => !hasRef(request.capabilities, ref));
    if (missingRoleCapability) {
      return reject("ROLE_REQUIRED_CAPABILITY_MISSING", refKey(missingRoleCapability));
    }

    const skills: SkillSpec[] = [];
    for (const skillRef of request.skills) {
      const skill = this.registries.skills.resolve(skillRef);
      if (!skill) return reject("SKILL_NOT_FOUND", refKey(skillRef));
      if (!skill.enabled) return reject("SKILL_DISABLED", refKey(skillRef));
      if (
        !hasRef(target.allowedSkills, skillRef)
        || !hasRef(role.allowedSkills, skillRef)
        || !hasRef(skill.allowedRoles, request.role)
      ) {
        return reject("SKILL_NOT_ALLOWED", refKey(skillRef));
      }
      const missingSkillCapability = skill.requiredCapabilities.find(
        (ref) => !hasRef(request.capabilities, ref),
      );
      if (missingSkillCapability) {
        return reject("SKILL_REQUIRED_CAPABILITY_MISSING", `${refKey(skillRef)}:${refKey(missingSkillCapability)}`);
      }
      skills.push(skill);
    }

    const secretPolicy = this.registries.secretPolicies.resolve(target.secretPolicy);
    if (!secretPolicy) return reject("SECRET_POLICY_NOT_FOUND", refKey(target.secretPolicy));
    if (!secretPolicy.enabled) return reject("SECRET_POLICY_DISABLED", refKey(target.secretPolicy));

    const secretAccess: ResolvedSecretAccess[] = [];
    for (const secretRequest of request.secretRequests) {
      const capability = this.registries.capabilities.resolve(secretRequest.capability);
      if (!capability || capability.kind !== "secret-use" || !hasRef(request.capabilities, secretRequest.capability)) {
        return reject("SECRET_REQUEST_DENIED", "secret_capability_not_resolved");
      }
      const allowed = secretPolicy.rules.some((rule) => sameSecretRule(rule, secretRequest));
      if (!allowed) return reject("SECRET_REQUEST_DENIED", "secret_policy_rule_not_found");

      const approval = deepFreeze({
        contractId: request.contractId,
        stepId: request.stepId,
        targetId: request.targetId,
        role: { ...request.role },
        policy: { ...target.secretPolicy },
        secretRef: secretRequest.secretRef,
        purpose: secretRequest.purpose,
        consumer: { ...secretRequest.consumer },
        capability: { ...secretRequest.capability },
        delivery: "opaque-handle" as const,
      });
      this.approvedSecretAccess.add(approval);
      secretAccess.push(approval);
    }

    return {
      ok: true,
      authority: deepFreeze({
        contractId: request.contractId,
        stepId: request.stepId,
        target,
        role,
        skills,
        capabilities,
        secretAccess,
      }),
    };
  }

  isResolvedSecretAccess(value: unknown): value is ResolvedSecretAccess {
    return typeof value === "object" && value !== null && this.approvedSecretAccess.has(value);
  }
}

export class SecretBrokerBoundary {
  private readonly resolver: GovernanceResolver;
  private readonly issuer: SecretHandleIssuer;
  private readonly clock: SecretBrokerClock;
  private readonly issuances = new WeakMap<object, Promise<SecretBrokerResult>>();
  private readonly issuedHandleOwners = new Map<string, ResolvedSecretAccess>();

  constructor(
    resolver: GovernanceResolver,
    issuer: SecretHandleIssuer,
    clock: SecretBrokerClock = () => Date.now(),
  ) {
    this.resolver = resolver;
    this.issuer = issuer;
    this.clock = clock;
  }

  async issue(approved: unknown): Promise<SecretBrokerResult> {
    if (!this.resolver.isResolvedSecretAccess(approved)) {
      return { ok: false, code: "SECRET_ACCESS_NOT_RESOLVED", detail: "secret_access_requires_resolver_output" };
    }

    const existing = this.issuances.get(approved);
    if (existing) return existing;
    const issuance = this.issueOnce(approved);
    this.issuances.set(approved, issuance);
    return issuance;
  }

  /**
   * Issues only the opaque Event Log capability. The authority material stays
   * in the broker-owned store and is never returned to the consumer.
   */
  eventLogAuthority(
    storageRoot: string,
    eventLogId: string,
    authorityRef = "morrow.event-log-root",
  ): EventLogAuthorityCapability {
    return new PersistentEventLogAuthority(storageRoot, authorityRef).capability(eventLogId);
  }

  private async issueOnce(approved: ResolvedSecretAccess): Promise<SecretBrokerResult> {
    let issued: unknown;
    try {
      issued = await this.issuer(approved);
    } catch {
      return { ok: false, code: "SECRET_BROKER_UNAVAILABLE", detail: "secret_handle_issuer_failed" };
    }

    let handle: SecretHandle | null = null;
    try {
      handle = parseSecretHandle(issued, approved, this.clock());
    } catch {
      return { ok: false, code: "SECRET_HANDLE_INVALID", detail: "secret_handle_contract_invalid" };
    }
    if (!handle) return { ok: false, code: "SECRET_HANDLE_INVALID", detail: "secret_handle_contract_invalid" };
    const owner = this.issuedHandleOwners.get(handle.handleId);
    if (owner && owner !== approved) {
      return { ok: false, code: "SECRET_HANDLE_INVALID", detail: "secret_handle_id_reused" };
    }
    this.issuedHandleOwners.set(handle.handleId, approved);
    return { ok: true, handle };
  }
}

const eventLogHeadFormat = "morrow.event-log-head/1" as const;
const eventLogAuthorityKeyBytes = 32;
const eventLogTagPattern = /^[0-9a-f]{64}$/u;
const defaultEventLogAuthorityRoot = join(resolve(process.cwd()), "private", "morrow-event-authority-v1");
const defaultEventLogAuthorities = new Map<string, PersistentEventLogAuthority>();

interface StoredEventLogHeadState {
  format: typeof eventLogHeadFormat;
  authorityRef: string;
  eventLogId: string;
  anchors: Array<EventLogHeadAnchor & { authorityTag: string }>;
}

export class PersistentEventLogAuthority {
  private readonly storageRoot: string;
  private readonly authorityRef: string;
  private readonly keyPath: string;
  private readonly mutationTail: { current: Promise<void> } = { current: Promise.resolve() };
  private authorityKey: Buffer | null = null;

  constructor(storageRoot: string, authorityRef = "morrow.event-log-root") {
    this.storageRoot = resolve(storageRoot);
    this.authorityRef = authorityRef;
    this.keyPath = join(this.storageRoot, "event-log-authority-v1.key");
  }

  capability(eventLogId: string): EventLogAuthorityCapability {
    if (!eventLogTagPattern.test(eventLogId)) throw new Error("event_log_authority_binding_invalid");
    const authority = this;
    return Object.freeze({
      authorityRef: this.authorityRef,
      eventLogId,
      authenticateEvent: async (domain: string) => await authority.authenticateEvent(domain),
      verifyEvent: async (domain: string, tag: string) => await authority.verifyEvent(domain, tag),
      readAnchors: async () => await authority.readAnchors(eventLogId),
      prepareHead: async (anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null) => {
        await authority.prepareHead(eventLogId, anchor, expectedPrevious);
      },
      commitHead: async (anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null) => {
        await authority.commitHead(eventLogId, anchor, expectedPrevious);
      },
      abortHead: async (anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null) => {
        await authority.abortHead(eventLogId, anchor, expectedPrevious);
      },
    });
  }

  private async authenticateEvent(domain: string): Promise<string> {
    return createHmac("sha256", await this.loadAuthorityKey())
      .update(`morrow.event-log/auth/v4|${domain}`, "utf8")
      .digest("hex");
  }

  private async verifyEvent(domain: string, tag: string): Promise<boolean> {
    if (!eventLogTagPattern.test(tag)) return false;
    try {
      const expected = createHmac("sha256", await this.loadAuthorityKey(false))
        .update(`morrow.event-log/auth/v4|${domain}`, "utf8")
        .digest("hex");
      return constantTimeHexEqual(expected, tag);
    } catch {
      return false;
    }
  }

  private async readAnchors(eventLogId: string): Promise<readonly EventLogHeadAnchor[]> {
    const state = await this.readHeadState(eventLogId);
    return state.anchors.map(({ authorityTag: _authorityTag, ...anchor }) => structuredClone(anchor));
  }

  private async prepareHead(eventLogId: string, anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null): Promise<void> {
    await this.withMutation(async () => {
      const state = await this.readHeadState(eventLogId);
      const current = findAnchor(state.anchors, anchor);
      assertAnchorBinding(anchor, this.authorityRef, eventLogId);
      assertExpectedPrevious(current, expectedPrevious);
      if (anchor.phase !== "prepared" || !eventLogTagPattern.test(anchor.eventTag)
        || anchor.sequence !== (expectedPrevious?.sequence ?? 0) + 1
        || anchor.generation !== (expectedPrevious?.generation ?? 0) + 1
        || !sameAnchorSummary(anchor.expectedPrevious, expectedPrevious)) {
        throw new Error("event_log_anchor_transition_invalid");
      }
      if (current?.phase === "prepared") throw new Error("event_log_anchor_prepared");
      state.anchors = replaceAnchor(state.anchors, await this.withAuthorityTag(anchor));
      await this.writeHeadState(eventLogId, state);
    });
  }

  private async commitHead(eventLogId: string, anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null): Promise<void> {
    await this.withMutation(async () => {
      const state = await this.readHeadState(eventLogId);
      const current = findAnchor(state.anchors, anchor);
      assertAnchorBinding(anchor, this.authorityRef, eventLogId);
      if (!current || current.phase !== "prepared" || anchor.phase !== "committed"
        || !sameAnchorSummary(current, anchor) || !sameAnchorSummary(current.expectedPrevious, expectedPrevious)
        || !sameAnchorSummary(anchor.expectedPrevious, expectedPrevious)) {
        throw new Error("event_log_anchor_commit_invalid");
      }
      state.anchors = replaceAnchor(state.anchors, await this.withAuthorityTag(anchor));
      await this.writeHeadState(eventLogId, state);
    });
  }

  private async abortHead(eventLogId: string, anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null): Promise<void> {
    await this.withMutation(async () => {
      const state = await this.readHeadState(eventLogId);
      const current = findAnchor(state.anchors, anchor);
      assertAnchorBinding(anchor, this.authorityRef, eventLogId);
      if (!current || current.phase !== "prepared" || !sameAnchorSummary(current, anchor)
        || !sameAnchorSummary(anchor.expectedPrevious, expectedPrevious)) {
        throw new Error("event_log_anchor_abort_invalid");
      }
      if (!expectedPrevious) {
        state.anchors = state.anchors.filter((item) => !sameAnchorKey(item, anchor));
      } else {
        const restored: EventLogHeadAnchor = {
          ...anchor,
          generation: expectedPrevious.generation,
          sequence: expectedPrevious.sequence,
          eventTag: expectedPrevious.eventTag,
          phase: "committed",
          expectedPrevious: null,
        };
        state.anchors = replaceAnchor(state.anchors, await this.withAuthorityTag(restored));
      }
      await this.writeHeadState(eventLogId, state);
    });
  }

  private async readHeadState(eventLogId: string): Promise<StoredEventLogHeadState> {
    const path = join(this.storageRoot, `${eventLogId}.head.json`);
    let value: unknown;
    try {
      value = JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { format: eventLogHeadFormat, authorityRef: this.authorityRef, eventLogId, anchors: [] };
      }
      throw new Error("event_log_anchor_invalid");
    }
    if (!isDataRecord(value) || exactKeys(value, ["format", "authorityRef", "eventLogId", "anchors"])
      || value.format !== eventLogHeadFormat || value.authorityRef !== this.authorityRef || value.eventLogId !== eventLogId
      || !Array.isArray(value.anchors)) throw new Error("event_log_anchor_invalid");
    const anchors: Array<EventLogHeadAnchor & { authorityTag: string }> = [];
    for (const raw of value.anchors) {
      const anchor = parseStoredAnchor(raw, this.authorityRef, eventLogId);
      if (anchors.some((item) => sameAnchorKey(item, anchor))) throw new Error("event_log_anchor_duplicate");
      if (!await this.verifyHeadTag(anchor, raw.authorityTag)) throw new Error("event_log_anchor_auth_invalid");
      anchors.push({ ...anchor, authorityTag: raw.authorityTag });
    }
    return { format: eventLogHeadFormat, authorityRef: this.authorityRef, eventLogId, anchors };
  }

  private async writeHeadState(eventLogId: string, state: StoredEventLogHeadState): Promise<void> {
    await mkdir(this.storageRoot, { recursive: true });
    const path = join(this.storageRoot, `${eventLogId}.head.json`);
    const temp = `${path}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      await writeFile(temp, `${JSON.stringify(state)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await rename(temp, path);
    } catch {
      await unlink(temp).catch(() => undefined);
      throw new Error("event_log_anchor_write_failed");
    }
  }

  private async withAuthorityTag(anchor: EventLogHeadAnchor): Promise<EventLogHeadAnchor & { authorityTag: string }> {
    return { ...anchor, authorityTag: await this.authorityTag(anchor) };
  }

  private async authorityTag(anchor: EventLogHeadAnchor, createIfMissing = true): Promise<string> {
    return createHmac("sha256", await this.loadAuthorityKey(createIfMissing))
      .update(`morrow.event-log/head/v1|${JSON.stringify({
        authorityRef: anchor.authorityRef,
        eventLogId: anchor.eventLogId,
        contractId: anchor.contractId,
        streamId: anchor.streamId,
        generation: anchor.generation,
        sequence: anchor.sequence,
        eventTag: anchor.eventTag,
        phase: anchor.phase,
        expectedPrevious: anchor.expectedPrevious,
      })}`, "utf8")
      .digest("hex");
  }

  private async verifyHeadTag(anchor: EventLogHeadAnchor, tag: string): Promise<boolean> {
    if (!eventLogTagPattern.test(tag)) return false;
    try {
      return constantTimeHexEqual(await this.authorityTag(anchor, false), tag);
    } catch {
      return false;
    }
  }

  private async loadAuthorityKey(createIfMissing = true): Promise<Buffer> {
    if (this.authorityKey) return Buffer.from(this.authorityKey);
    if (!createIfMissing) return await readKeyFile(this.keyPath);
    await mkdir(this.storageRoot, { recursive: true });
    try {
      this.authorityKey = await readKeyFile(this.keyPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      try {
        await writeFile(this.keyPath, randomBytes(eventLogAuthorityKeyBytes), { flag: "wx", mode: 0o600 });
      } catch (createError) {
        if ((createError as NodeJS.ErrnoException).code !== "EEXIST") throw new Error("event_log_authority_unavailable");
      }
      this.authorityKey = await readKeyFile(this.keyPath);
    }
    return Buffer.from(this.authorityKey);
  }

  private async withMutation<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.mutationTail.current;
    let release: () => void = () => undefined;
    this.mutationTail.current = new Promise<void>((resolvePromise) => { release = resolvePromise; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

export function defaultEventLogAuthority(eventLogId: string): EventLogAuthorityCapability {
  let authority = defaultEventLogAuthorities.get(defaultEventLogAuthorityRoot);
  if (!authority) {
    authority = new PersistentEventLogAuthority(defaultEventLogAuthorityRoot);
    defaultEventLogAuthorities.set(defaultEventLogAuthorityRoot, authority);
  }
  return authority.capability(eventLogId);
}

function assertAnchorBinding(anchor: EventLogHeadAnchor, authorityRef: string, eventLogId: string): void {
  if (anchor.authorityRef !== authorityRef || anchor.eventLogId !== eventLogId
    || !isIdentifier(anchor.contractId) || !eventLogTagPattern.test(anchor.streamId)) {
    throw new Error("event_log_anchor_binding_invalid");
  }
}

function assertExpectedPrevious(current: EventLogHeadAnchor | null, expectedPrevious: EventLogHeadAnchor | null): void {
  if ((current === null) !== (expectedPrevious === null)
    || (current && expectedPrevious && !sameAnchorSummary(current, expectedPrevious))) {
    throw new Error("event_log_anchor_cas_conflict");
  }
}

function parseStoredAnchor(value: unknown, authorityRef: string, eventLogId: string): EventLogHeadAnchor & { authorityTag: string } {
  if (!isDataRecord(value) || exactKeys(value, ["authorityRef", "eventLogId", "contractId", "streamId", "generation", "sequence", "eventTag", "phase", "expectedPrevious", "authorityTag"])) {
    throw new Error("event_log_anchor_invalid");
  }
  if (value.authorityRef !== authorityRef || value.eventLogId !== eventLogId
    || typeof value.contractId !== "string" || typeof value.streamId !== "string"
    || !isIdentifier(value.contractId) || !eventLogTagPattern.test(value.streamId)
    || !Number.isSafeInteger(value.generation) || value.generation < 1
    || !Number.isSafeInteger(value.sequence) || value.sequence < 1
    || !eventLogTagPattern.test(value.eventTag)
    || (value.phase !== "prepared" && value.phase !== "committed")
    || (value.expectedPrevious !== null && (!isDataRecord(value.expectedPrevious)
      || exactKeys(value.expectedPrevious, ["generation", "sequence", "eventTag"])
      || !Number.isSafeInteger(value.expectedPrevious.generation) || value.expectedPrevious.generation < 1
      || !Number.isSafeInteger(value.expectedPrevious.sequence) || value.expectedPrevious.sequence < 1
      || !eventLogTagPattern.test(value.expectedPrevious.eventTag)))
    || !eventLogTagPattern.test(value.authorityTag)) throw new Error("event_log_anchor_invalid");
  return {
    authorityRef: value.authorityRef,
    eventLogId: value.eventLogId,
    contractId: value.contractId,
    streamId: value.streamId,
    generation: value.generation,
    sequence: value.sequence,
    eventTag: value.eventTag,
    phase: value.phase,
    expectedPrevious: value.expectedPrevious,
    authorityTag: value.authorityTag,
  };
}

function findAnchor(anchors: readonly EventLogHeadAnchor[], target: EventLogHeadAnchor): EventLogHeadAnchor | null {
  return anchors.find((item) => sameAnchorKey(item, target)) ?? null;
}

function replaceAnchor(anchors: readonly (EventLogHeadAnchor & { authorityTag: string })[], replacement: EventLogHeadAnchor & { authorityTag: string }): Array<EventLogHeadAnchor & { authorityTag: string }> {
  return [...anchors.filter((item) => !sameAnchorKey(item, replacement)), replacement];
}

function sameAnchorKey(left: EventLogHeadAnchor, right: EventLogHeadAnchor): boolean {
  return left.contractId === right.contractId && left.streamId === right.streamId;
}

function sameAnchorSummary(left: EventLogHeadAnchor | { generation: number; sequence: number; eventTag: string } | null, right: EventLogHeadAnchor | { generation: number; sequence: number; eventTag: string } | null): boolean {
  if (left === null || right === null) return left === right;
  return left.generation === right.generation && left.sequence === right.sequence
    && constantTimeHexEqual(left.eventTag, right.eventTag);
}

async function readKeyFile(path: string): Promise<Buffer> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.isSymbolicLink() || before.size !== eventLogAuthorityKeyBytes) throw new Error("event_log_authority_key_invalid");
    const key = await handle.readFile();
    const after = await handle.stat();
    const pathAfter = await lstat(path);
    if (!after.isFile() || after.isSymbolicLink() || key.length !== eventLogAuthorityKeyBytes
      || !sameFileMetadata(before, after) || !sameFileMetadata(before, pathAfter)) throw new Error("event_log_authority_key_invalid");
    return key;
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function sameFileMetadata(left: { dev: number; ino: number; size: number; mtimeMs: number }, right: { dev: number; ino: number; size: number; mtimeMs: number }): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.mtimeMs === right.mtimeMs;
}

function constantTimeHexEqual(expected: string, actual: string): boolean {
  if (!eventLogTagPattern.test(expected) || !eventLogTagPattern.test(actual)) return false;
  const expectedBytes = Buffer.from(expected, "hex");
  const actualBytes = Buffer.from(actual, "hex");
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

function parseWorkAuthorityRequest(value: unknown): WorkAuthorityRequest | null {
  if (!isDataRecord(value) || exactKeys(value, [
    "contractId",
    "stepId",
    "targetId",
    "role",
    "skills",
    "capabilities",
    "secretRequests",
  ])) return null;
  if (!isIdentifier(value.contractId) || !isIdentifier(value.stepId) || !isIdentifier(value.targetId)) return null;
  if (!validRef(value.role)) return null;
  if (!isUniqueRefSelection(value.skills, 1, 64) || !isUniqueRefSelection(value.capabilities, 1, 128)) return null;
  if (!Array.isArray(value.secretRequests) || value.secretRequests.length > 32) return null;
  const secretRequests = value.secretRequests.map(parseSecretRequest);
  if (secretRequests.some((item) => item === null)) return null;
  const requestKeys = new Set<string>();
  for (const item of secretRequests as SecretAccessRequest[]) {
    const key = `${item.secretRef}|${item.purpose}|${item.consumer.kind}|${item.consumer.id}`;
    if (requestKeys.has(key)) return null;
    requestKeys.add(key);
  }
  return deepFreeze(structuredClone(value)) as unknown as WorkAuthorityRequest;
}

function parseSecretRequest(value: unknown): SecretAccessRequest | null {
  if (!isDataRecord(value) || exactKeys(value, ["secretRef", "purpose", "consumer", "capability"])) return null;
  if (!isIdentifier(value.secretRef) || !isIdentifier(value.purpose) || !validConsumer(value.consumer) || !validRef(value.capability)) {
    return null;
  }
  return value as unknown as SecretAccessRequest;
}

function parseSecretHandle(value: unknown, approved: ResolvedSecretAccess, now: string | number | Date): SecretHandle | null {
  if (!isDataRecord(value) || exactKeys(value, ["handleId", "consumer", "delivery", "expiresAt"])) return null;
  if (!isIdentifier(value.handleId) || !validConsumer(value.consumer) || value.delivery !== "opaque-handle") return null;
  if (!sameConsumer(value.consumer, approved.consumer)) return null;
  const expiresAt = parseTimestamp(value.expiresAt);
  const currentTime = parseContextTime(now);
  if (expiresAt === null || currentTime === null || expiresAt <= currentTime || expiresAt - currentTime > maxSecretHandleTtlMs) {
    return null;
  }
  return deepFreeze(structuredClone(value)) as unknown as SecretHandle;
}

function validateTargetDescriptor(value: unknown): value is TargetDescriptor {
  if (!isDataRecord(value) || exactKeys(value, [
    "targetId",
    "descriptorVersion",
    "repositoryLocatorRef",
    "baseRef",
    "writeMode",
    "allowedPaths",
    "forbiddenPaths",
    "requiredChecks",
    "regressionProfileId",
    "secretPolicy",
    "deploymentPolicyId",
    "rollbackPolicyId",
    "ownerPolicyId",
    "allowedRoles",
    "allowedSkills",
    "allowedCapabilities",
    "enabled",
  ])) return false;
  return isIdentifier(value.targetId)
    && isVersion(value.descriptorVersion)
    && isIdentifier(value.repositoryLocatorRef)
    && isSafeText(value.baseRef, 256)
    && (["read-only", "branch-only", "pr-only", "governed-deploy"] as unknown[]).includes(value.writeMode)
    && isUniquePathPolicyArray(value.allowedPaths, 1, 256)
    && isUniquePathPolicyArray(value.forbiddenPaths, 0, 256)
    && isUniqueIdentifierArray(value.requiredChecks, 0, 128)
    && isIdentifier(value.regressionProfileId)
    && validRef(value.secretPolicy)
    && isIdentifier(value.deploymentPolicyId)
    && isIdentifier(value.rollbackPolicyId)
    && isIdentifier(value.ownerPolicyId)
    && isUniqueRefArray(value.allowedRoles, 1, 128)
    && isUniqueRefArray(value.allowedSkills, 1, 128)
    && isUniqueRefArray(value.allowedCapabilities, 1, 256)
    && typeof value.enabled === "boolean";
}

function validateRoleSpec(value: unknown): value is RoleSpec {
  if (!isDataRecord(value) || exactKeys(value, [
    "roleId",
    "version",
    "allowedSkills",
    "allowedCapabilities",
    "requiredCapabilities",
    "enabled",
  ])) return false;
  return isIdentifier(value.roleId)
    && isVersion(value.version)
    && isUniqueRefArray(value.allowedSkills, 1, 128)
    && isUniqueRefArray(value.allowedCapabilities, 1, 256)
    && isUniqueRefArray(value.requiredCapabilities, 1, 128)
    && (value.requiredCapabilities as RegistryRef[]).every((ref) => hasRef(value.allowedCapabilities as RegistryRef[], ref))
    && typeof value.enabled === "boolean";
}

function validateSkillSpec(value: unknown): value is SkillSpec {
  if (!isDataRecord(value) || exactKeys(value, [
    "skillId",
    "version",
    "allowedRoles",
    "requiredCapabilities",
    "enabled",
  ])) return false;
  return isIdentifier(value.skillId)
    && isVersion(value.version)
    && isUniqueRefArray(value.allowedRoles, 1, 128)
    && isUniqueRefArray(value.requiredCapabilities, 1, 128)
    && typeof value.enabled === "boolean";
}

function validateCapabilitySpec(value: unknown): value is CapabilitySpec {
  if (!isDataRecord(value) || exactKeys(value, ["capabilityId", "version", "kind", "risk", "enabled"])) return false;
  return isIdentifier(value.capabilityId)
    && isVersion(value.version)
    && (["repository-read", "repository-write", "process", "agent-runtime", "secret-use", "connector"] as unknown[]).includes(value.kind)
    && (["low", "medium", "high", "critical"] as unknown[]).includes(value.risk)
    && typeof value.enabled === "boolean";
}

function validateSecretPolicySpec(value: unknown): value is SecretPolicySpec {
  if (!isDataRecord(value) || exactKeys(value, ["policyId", "version", "rules", "enabled"])) return false;
  if (!isIdentifier(value.policyId) || !isVersion(value.version) || !Array.isArray(value.rules) || value.rules.length > 128) {
    return false;
  }
  const keys = new Set<string>();
  for (const rule of value.rules) {
    if (!validSecretRule(rule)) return false;
    const key = `${rule.secretRef}|${rule.purpose}|${rule.consumer.kind}|${rule.consumer.id}`;
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return typeof value.enabled === "boolean";
}

function validSecretRule(value: unknown): value is SecretPolicyRule {
  return isDataRecord(value)
    && exactKeys(value, ["secretRef", "purpose", "consumer", "capability", "delivery"]) === null
    && isIdentifier(value.secretRef)
    && isIdentifier(value.purpose)
    && validConsumer(value.consumer)
    && validRef(value.capability)
    && value.delivery === "opaque-handle";
}

function validConsumer(value: unknown): value is SecretConsumer {
  return isDataRecord(value)
    && exactKeys(value, ["kind", "id"]) === null
    && (["runtime", "connector", "tool"] as unknown[]).includes(value.kind)
    && isIdentifier(value.id);
}

function validRef(value: unknown): value is RegistryRef {
  return isDataRecord(value)
    && exactKeys(value, ["id", "version"]) === null
    && isIdentifier(value.id)
    && isVersion(value.version);
}

function buildRegistry<T>(
  values: readonly T[],
  validator: (value: unknown) => value is T,
  keyOf: (value: T) => string,
  name: string,
): ReadonlyMap<string, T> {
  if (!Array.isArray(values) || values.length > 4_096) throw new Error(`${name}_registry_invalid`);
  const entries = new Map<string, T>();
  for (const raw of values) {
    let valid = false;
    try {
      valid = validator(raw);
    } catch {
      valid = false;
    }
    if (!valid) throw new Error(`${name}_descriptor_invalid`);
    let value: T;
    try {
      value = deepFreeze(structuredClone(raw));
    } catch {
      throw new Error(`${name}_descriptor_invalid`);
    }
    const key = keyOf(value);
    if (entries.has(key)) throw new Error(`${name}_registry_duplicate:${key}`);
    entries.set(key, value);
  }
  return entries;
}

function isDataRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(
    (descriptor) => "value" in descriptor && descriptor.get === undefined && descriptor.set === undefined,
  );
}

function exactKeys(value: Record<string, unknown>, required: readonly string[]): string | null {
  for (const key of required) if (!Object.hasOwn(value, key)) return `missing_field:${key}`;
  const allowed = new Set(required);
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  return unknown ? `unknown_field:${unknown}` : null;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifierPattern.test(value);
}

function isVersion(value: unknown): value is string {
  return typeof value === "string" && versionPattern.test(value);
}

function isSafeText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && !/[\0\r\n]/.test(value);
}

function isSafePathPolicy(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512 || value.includes("\\") || value.startsWith("/")) {
    return false;
  }
  if (/^[A-Za-z]:/.test(value) || value.includes("\0")) return false;
  return !value.split("/").some((segment) => segment === "..");
}

function isUniquePathPolicyArray(value: unknown, min: number, max: number): value is string[] {
  return Array.isArray(value)
    && value.length >= min
    && value.length <= max
    && value.every(isSafePathPolicy)
    && new Set(value).size === value.length;
}

function isUniqueIdentifierArray(value: unknown, min: number, max: number): value is string[] {
  return Array.isArray(value)
    && value.length >= min
    && value.length <= max
    && value.every(isIdentifier)
    && new Set(value).size === value.length;
}

function isUniqueRefArray(value: unknown, min: number, max: number): value is RegistryRef[] {
  return Array.isArray(value)
    && value.length >= min
    && value.length <= max
    && value.every(validRef)
    && new Set(value.map(refKey)).size === value.length;
}

function isUniqueRefSelection(value: unknown, min: number, max: number): value is RegistryRef[] {
  return isUniqueRefArray(value, min, max)
    && new Set(value.map((item) => item.id)).size === value.length;
}

function hasRef(values: readonly RegistryRef[], expected: RegistryRef): boolean {
  return values.some((value) => sameRef(value, expected));
}

function sameRef(left: RegistryRef, right: RegistryRef): boolean {
  return left.id === right.id && left.version === right.version;
}

function refKey(ref: RegistryRef): string {
  return `${ref.id}@${ref.version}`;
}

function sameConsumer(left: SecretConsumer, right: SecretConsumer): boolean {
  return left.kind === right.kind && left.id === right.id;
}

function sameSecretRule(rule: SecretPolicyRule, request: SecretAccessRequest): boolean {
  return rule.secretRef === request.secretRef
    && rule.purpose === request.purpose
    && sameConsumer(rule.consumer, request.consumer)
    && sameRef(rule.capability, request.capability)
    && rule.delivery === "opaque-handle";
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !canonicalTimestampPattern.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function parseContextTime(value: string | number | Date): number | null {
  const parsed = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function reject(code: WorkAuthorityRejectionCode, detail: string): WorkAuthorityResult {
  return { ok: false, code, detail };
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

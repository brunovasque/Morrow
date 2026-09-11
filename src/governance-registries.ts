import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  defaultWorkerPrivateStateRoot,
  WorkerPrivateStateRoot,
} from "./worker-private-state.ts";

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

export interface EventLogRecord {
  format: string;
  eventLogId: string;
  streamId: string;
  contractId: string;
  sequence: number;
  eventId: string;
  previousAuthenticatedTag: string;
  event: unknown;
}

export interface EventLogStreamCapability {
  readonly authorityRef: string;
  readonly eventLogId: string;
  readonly epoch: string;
  readonly contractId: string;
  readonly streamId: string;
  authenticateRecord(record: EventLogRecord): Promise<string>;
  verifyRecord(record: EventLogRecord, tag: string): Promise<boolean>;
  prepareHead(anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null): Promise<void>;
  commitHead(anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null): Promise<void>;
  abortHead(anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null): Promise<void>;
}

export interface EventLogAuthorityCapability {
  readonly authorityRef: string;
  readonly eventLogId: string;
  readonly epoch: string;
  readAnchors(): Promise<readonly EventLogHeadAnchor[]>;
  bindStream(contractId: string, streamId: string): EventLogStreamCapability;
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
    privateStateRoot: WorkerPrivateStateRoot,
    eventLogId: string,
    authorityRef = "morrow.event-log-root",
  ): EventLogAuthorityCapability {
    return new PersistentEventLogAuthority(privateStateRoot, authorityRef).capability(eventLogId);
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

const eventLogAuthorityKeyBytes = 32;
const eventLogTagPattern = /^[0-9a-f]{64}$/u;
const eventLogJournalFormat = "morrow.event-log-head-journal/1" as const;
const eventLogBindingFormat = "morrow.event-log-authority-binding/1" as const;
const zeroJournalTag = "0".repeat(64);
const eventLogAuthDomain = "morrow.event-log/auth/v4" as const;
const eventLogHeadDomain = "morrow.event-log/head/v1" as const;
const eventLogBindingDomain = "morrow.event-log/binding/v1" as const;
const maximumJournalRecordBytes = 65_536;
const defaultEventLogAuthorities = new Map<string, PersistentEventLogAuthority>();

interface StoredHeadState {
  anchors: Array<EventLogHeadAnchor>;
  tailTag: string;
}

interface JournalRecord {
  format: typeof eventLogJournalFormat;
  kind: "PREPARE" | "COMMIT" | "ABORT";
  authorityRef: string;
  eventLogId: string;
  contractId: string;
  streamId: string;
  generation: number;
  sequence: number;
  eventTag: string;
  phase: "prepared" | "committed";
  expectedPrevious: { generation: number; sequence: number; eventTag: string } | null;
  previousJournalTag: string;
  journalTag: string;
}

interface AuthorityBinding {
  format: typeof eventLogBindingFormat;
  authorityRef: string;
  eventLogId: string;
  historyStarted: boolean;
  bindingTag: string;
}

export class PersistentEventLogAuthority {
  private readonly privateStateRoot: WorkerPrivateStateRoot;
  private readonly authorityRef: string;
  private readonly authorityRoot: string;
  private readonly keyPath: string;
  private readonly epoch: string;
  private authorityKey: Buffer | null = null;

  constructor(privateStateRoot: WorkerPrivateStateRoot, authorityRef = "morrow.event-log-root") {
    if (!(privateStateRoot instanceof WorkerPrivateStateRoot)) throw new Error("event_log_authority_private_root_required");
    this.privateStateRoot = privateStateRoot;
    this.authorityRef = authorityRef;
    this.authorityRoot = join(privateStateRoot.privateRoot, "event-log-authority");
    this.keyPath = join(this.authorityRoot, "event-log-authority-v4.key");
    this.epoch = createHash("sha256")
      .update(`morrow.event-log/epoch/v1|${privateStateRoot.workerId}|${privateStateRoot.privateRoot}|${authorityRef}`, "utf8")
      .digest("hex");
  }

  capability(eventLogId: string): EventLogAuthorityCapability {
    if (!eventLogTagPattern.test(eventLogId)) throw new Error("event_log_authority_binding_invalid");
    const authority = this;
    return Object.freeze({
      authorityRef: this.authorityRef,
      eventLogId,
      epoch: this.epoch,
      readAnchors: async () => await authority.readAnchors(eventLogId),
      bindStream: (contractId: string, streamId: string) => authority.bindStream(eventLogId, contractId, streamId),
    });
  }

  private bindStream(eventLogId: string, contractId: string, streamId: string): EventLogStreamCapability {
    if (!isIdentifier(contractId) || streamId !== eventStreamIdFor(eventLogId, contractId)) throw new Error("event_log_stream_binding_invalid");
    const authority = this;
    return Object.freeze({
      authorityRef: this.authorityRef,
      eventLogId,
      epoch: this.epoch,
      contractId,
      streamId,
      authenticateRecord: async (record: EventLogRecord) => await authority.authenticateRecord(eventLogId, contractId, streamId, record),
      verifyRecord: async (record: EventLogRecord, tag: string) => await authority.verifyRecord(eventLogId, contractId, streamId, record, tag),
      prepareHead: async (anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null) => {
        await authority.prepareHead(eventLogId, contractId, streamId, anchor, expectedPrevious);
      },
      commitHead: async (anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null) => {
        await authority.commitHead(eventLogId, contractId, streamId, anchor, expectedPrevious);
      },
      abortHead: async (anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null) => {
        await authority.abortHead(eventLogId, contractId, streamId, anchor, expectedPrevious);
      },
    });
  }

  private async authenticateRecord(eventLogId: string, contractId: string, streamId: string, record: EventLogRecord): Promise<string> {
    assertRecordBinding(record, eventLogId, contractId, streamId);
    return hmacHex(await this.loadAuthorityKey(), eventLogAuthDomain, canonicalRecord(record));
  }

  private async verifyRecord(eventLogId: string, contractId: string, streamId: string, record: EventLogRecord, tag: string): Promise<boolean> {
    if (!eventLogTagPattern.test(tag)) return false;
    try {
      assertRecordBinding(record, eventLogId, contractId, streamId);
      return constantTimeHexEqual(await this.authenticateRecord(eventLogId, contractId, streamId, record), tag);
    } catch {
      return false;
    }
  }

  private async readAnchors(eventLogId: string): Promise<readonly EventLogHeadAnchor[]> {
    const state = await this.readHeadState(eventLogId);
    return state.anchors.map((anchor) => structuredClone(anchor));
  }

  private async prepareHead(eventLogId: string, contractId: string, streamId: string, anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null): Promise<void> {
    await this.withMutation(eventLogId, async (state) => {
      assertAnchorBinding(anchor, this.authorityRef, eventLogId, contractId, streamId);
      const current = findAnchor(state.anchors, anchor);
      if (current?.phase === "prepared") throw new Error("event_log_anchor_cas_conflict");
      assertExpectedPrevious(current?.phase === "committed" ? current : null, expectedPrevious);
      if (anchor.phase !== "prepared" || !eventLogTagPattern.test(anchor.eventTag)
        || anchor.sequence !== (expectedPrevious?.sequence ?? 0) + 1
        || anchor.generation !== (expectedPrevious?.generation ?? 0) + 1
        || !sameAnchorSummary(anchor.expectedPrevious, expectedPrevious)) {
        throw new Error("event_log_anchor_transition_invalid");
      }
      await this.appendJournal(eventLogId, {
        kind: "PREPARE", anchor, expectedPrevious, previousJournalTag: state.tailTag,
      });
    });
  }

  private async commitHead(eventLogId: string, contractId: string, streamId: string, anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null): Promise<void> {
    await this.withMutation(eventLogId, async (state) => {
      assertAnchorBinding(anchor, this.authorityRef, eventLogId, contractId, streamId);
      const current = findAnchor(state.anchors, anchor);
      if (!current || current.phase !== "prepared" || anchor.phase !== "committed"
        || !sameAnchorSummary(current, anchor) || !sameAnchorSummary(current.expectedPrevious, expectedPrevious)
        || !sameAnchorSummary(anchor.expectedPrevious, expectedPrevious)) throw new Error("event_log_anchor_commit_invalid");
      await this.appendJournal(eventLogId, {
        kind: "COMMIT", anchor, expectedPrevious, previousJournalTag: state.tailTag,
      });
    });
  }

  private async abortHead(eventLogId: string, contractId: string, streamId: string, anchor: EventLogHeadAnchor, expectedPrevious: EventLogHeadAnchor | null): Promise<void> {
    await this.withMutation(eventLogId, async (state) => {
      assertAnchorBinding(anchor, this.authorityRef, eventLogId, contractId, streamId);
      const current = findAnchor(state.anchors, anchor);
      if (!current || current.phase !== "prepared" || !sameAnchorSummary(current, anchor)
        || !sameAnchorSummary(anchor.expectedPrevious, expectedPrevious)) throw new Error("event_log_anchor_abort_invalid");
      await this.appendJournal(eventLogId, {
        kind: "ABORT", anchor, expectedPrevious, previousJournalTag: state.tailTag,
      });
    });
  }

  private async readHeadState(eventLogId: string): Promise<StoredHeadState> {
    await this.ensureAuthorityBinding(eventLogId);
    const path = this.journalPath(eventLogId);
    let text: string;
    try {
      const pathBefore = await lstat(path);
      if (!pathBefore.isFile() || pathBefore.isSymbolicLink()) throw new Error("event_log_anchor_path_unsafe");
      const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const before = await handle.stat();
        if (!before.isFile() || before.isSymbolicLink() || before.dev !== pathBefore.dev || before.ino !== pathBefore.ino || before.size > 16 * 1024 * 1024) throw new Error("event_log_anchor_invalid");
        text = await handle.readFile("utf8");
        const after = await handle.stat();
        const pathAfter = await lstat(path);
        if (before.dev !== after.dev || before.ino !== after.ino || pathAfter.dev !== after.dev || pathAfter.ino !== after.ino
          || Buffer.byteLength(text, "utf8") !== before.size) throw new Error("event_log_anchor_invalid");
      } finally { await handle.close().catch(() => undefined); }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const binding = await this.readBinding(eventLogId);
        if (binding.historyStarted) throw new Error("event_log_anchor_invalid");
        return { anchors: [], tailTag: zeroJournalTag };
      }
      if (error instanceof Error && error.message === "event_log_anchor_invalid") throw error;
      throw new Error("event_log_anchor_invalid");
    }
    if (!text.endsWith("\n")) throw new Error("event_log_anchor_journal_partial");
    const anchors: Array<EventLogHeadAnchor> = [];
    let tailTag = zeroJournalTag;
    for (const line of text.split("\n").slice(0, -1)) {
      if (Buffer.byteLength(line, "utf8") > maximumJournalRecordBytes) throw new Error("event_log_anchor_record_too_large");
      let value: unknown;
      try { value = JSON.parse(line); } catch { throw new Error("event_log_anchor_journal_invalid"); }
      const record = parseJournalRecord(value, this.authorityRef, eventLogId);
      if (record.previousJournalTag !== tailTag || !await this.verifyJournalRecord(record)) throw new Error("event_log_anchor_auth_invalid");
      applyJournalRecord(anchors, record);
      tailTag = record.journalTag;
    }
    const binding = await this.readBinding(eventLogId);
    if (!binding.historyStarted) throw new Error("event_log_anchor_invalid");
    return { anchors, tailTag };
  }

  private async appendJournal(eventLogId: string, input: { kind: JournalRecord["kind"]; anchor: EventLogHeadAnchor; expectedPrevious: EventLogHeadAnchor | null; previousJournalTag: string }): Promise<void> {
    const recordBase = {
      format: eventLogJournalFormat,
      kind: input.kind,
      authorityRef: this.authorityRef,
      eventLogId,
      contractId: input.anchor.contractId,
      streamId: input.anchor.streamId,
      generation: input.anchor.generation,
      sequence: input.anchor.sequence,
      eventTag: input.anchor.eventTag,
      phase: input.anchor.phase,
      expectedPrevious: input.expectedPrevious ? summaryOf(input.expectedPrevious) : null,
      previousJournalTag: input.previousJournalTag,
    } as const;
    const record: JournalRecord = { ...recordBase, journalTag: await hmacHex(await this.loadAuthorityKey(), eventLogHeadDomain, canonicalJournal(recordBase)) };
    const line = `${JSON.stringify(record)}\n`;
    if (Buffer.byteLength(line, "utf8") > maximumJournalRecordBytes) throw new Error("event_log_anchor_record_too_large");
    await this.ensureBindingHistoryStarted(eventLogId);
    const path = this.journalPath(eventLogId);
    const pathBefore = await lstat(path).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new Error("event_log_anchor_path_unsafe");
    });
    if (pathBefore && (!pathBefore.isFile() || pathBefore.isSymbolicLink())) throw new Error("event_log_anchor_path_unsafe");
    const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
      const before = await handle.stat();
      if (!before.isFile() || before.isSymbolicLink()) throw new Error("event_log_anchor_write_failed");
      if (pathBefore && (pathBefore.dev !== before.dev || pathBefore.ino !== before.ino)) throw new Error("event_log_anchor_path_race");
      const written = await handle.write(line, undefined, "utf8");
      if (written.bytesWritten !== Buffer.byteLength(line, "utf8")) throw new Error("event_log_anchor_write_failed");
      await handle.sync();
      const after = await handle.stat();
      const pathAfter = await lstat(path);
      if (before.dev !== after.dev || before.ino !== after.ino || pathAfter.dev !== after.dev || pathAfter.ino !== after.ino
        || after.size !== before.size + written.bytesWritten) throw new Error("event_log_anchor_write_failed");
    } finally { await handle.close().catch(() => undefined); }
  }

  private async verifyJournalRecord(record: JournalRecord): Promise<boolean> {
    try {
      return constantTimeHexEqual(record.journalTag, await hmacHex(await this.loadAuthorityKey(false), eventLogHeadDomain, canonicalJournal(recordWithoutTag(record))));
    } catch { return false; }
  }

  private async ensureAuthorityBinding(eventLogId: string): Promise<AuthorityBinding> {
    await this.privateStateRoot.ensure();
    await mkdir(this.authorityRoot, { recursive: true });
    const bindingPath = this.bindingPath(eventLogId);
    try { return await this.readBinding(eventLogId); } catch (error) {
      if (!(error instanceof Error) || error.message !== "event_log_authority_binding_missing") throw error;
    }
    const key = await this.loadAuthorityKey(true);
    const binding: AuthorityBinding = {
      format: eventLogBindingFormat, authorityRef: this.authorityRef, eventLogId, historyStarted: false,
      bindingTag: await hmacHex(key, eventLogBindingDomain, canonicalBinding({ format: eventLogBindingFormat, authorityRef: this.authorityRef, eventLogId, historyStarted: false })),
    };
    try { await writeFile(bindingPath, `${JSON.stringify(binding)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 }); }
    catch (createError) {
      if (!isAlreadyExists(createError)) throw new Error("event_log_authority_binding_failed");
      return await this.readBinding(eventLogId);
    }
    return binding;
  }

  private async readBinding(eventLogId: string): Promise<AuthorityBinding> {
    const path = this.bindingPath(eventLogId);
    let value: unknown;
    try { value = JSON.parse(await readFile(path, "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("event_log_authority_binding_missing"); throw new Error("event_log_authority_binding_invalid"); }
    if (!isDataRecord(value) || exactKeys(value, ["format", "authorityRef", "eventLogId", "historyStarted", "bindingTag"])
      || value.format !== eventLogBindingFormat || value.authorityRef !== this.authorityRef || value.eventLogId !== eventLogId
      || typeof value.historyStarted !== "boolean" || !eventLogTagPattern.test(value.bindingTag)
      || !constantTimeHexEqual(value.bindingTag, await hmacHex(await this.loadAuthorityKey(false), eventLogBindingDomain, canonicalBinding({ format: eventLogBindingFormat, authorityRef: this.authorityRef, eventLogId, historyStarted: value.historyStarted })))) {
      throw new Error("event_log_authority_binding_invalid");
    }
    return value as unknown as AuthorityBinding;
  }

  private async ensureBindingHistoryStarted(eventLogId: string): Promise<void> {
    const binding = await this.readBinding(eventLogId);
    if (binding.historyStarted) return;
    const key = await this.loadAuthorityKey(false);
    const next: AuthorityBinding = { ...binding, historyStarted: true, bindingTag: await hmacHex(key, eventLogBindingDomain, canonicalBinding({ format: eventLogBindingFormat, authorityRef: this.authorityRef, eventLogId, historyStarted: true })) };
    const bindingPath = this.bindingPath(eventLogId);
    const beforePath = await lstat(bindingPath);
    if (!beforePath.isFile() || beforePath.isSymbolicLink()) throw new Error("event_log_authority_binding_invalid");
    const handle = await open(bindingPath, constants.O_WRONLY);
    try {
      const line = `${JSON.stringify(next)}\n`;
      await handle.truncate(0);
      const written = await handle.write(line, 0, "utf8");
      if (written.bytesWritten !== Buffer.byteLength(line, "utf8")) throw new Error("event_log_authority_binding_failed");
      await handle.sync();
      const afterPath = await lstat(bindingPath);
      if (beforePath.dev !== afterPath.dev || beforePath.ino !== afterPath.ino || afterPath.size !== Buffer.byteLength(line, "utf8")) {
        throw new Error("event_log_authority_binding_failed");
      }
    } finally { await handle.close().catch(() => undefined); }
  }

  private journalPath(eventLogId: string): string { return join(this.authorityRoot, `${eventLogId}.head.journal`); }
  private bindingPath(eventLogId: string): string { return join(this.authorityRoot, `${eventLogId}.binding.json`); }

  private async loadAuthorityKey(createIfMissing = true): Promise<Buffer> {
    if (this.authorityKey) return Buffer.from(this.authorityKey);
    await this.privateStateRoot.ensure();
    await mkdir(this.authorityRoot, { recursive: true });
    try { this.authorityKey = await readKeyFile(this.keyPath); }
    catch (error) {
      if (!createIfMissing || (error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("event_log_authority_unavailable");
      const entries = await (await import("node:fs/promises")).readdir(this.authorityRoot);
      if (entries.some((entry) => entry.endsWith(".binding.json") || entry.endsWith(".head.journal"))) throw new Error("event_log_authority_rebootstrap_denied");
      try { await writeFile(this.keyPath, randomBytes(eventLogAuthorityKeyBytes), { flag: "wx", mode: 0o600 }); }
      catch (createError) { if (!isAlreadyExists(createError)) throw new Error("event_log_authority_unavailable"); }
      this.authorityKey = await readKeyFile(this.keyPath);
    }
    return Buffer.from(this.authorityKey);
  }

  private async withMutation<T>(eventLogId: string, operation: (state: StoredHeadState) => Promise<T>): Promise<T> {
    const lock = await this.privateStateRoot.acquireExclusive(this.authorityRef, eventLogId);
    try { return await operation(await this.readHeadState(eventLogId)); }
    finally { await lock.release(); }
  }
}

export function defaultEventLogAuthority(eventLogId: string): EventLogAuthorityCapability {
  const root = defaultWorkerPrivateStateRoot();
  const key = root.privateRoot;
  let authority = defaultEventLogAuthorities.get(key);
  if (!authority) { authority = new PersistentEventLogAuthority(root); defaultEventLogAuthorities.set(key, authority); }
  return authority.capability(eventLogId);
}

function assertAnchorBinding(anchor: EventLogHeadAnchor, authorityRef: string, eventLogId: string, contractId: string, streamId: string): void {
  if (anchor.authorityRef !== authorityRef || anchor.eventLogId !== eventLogId
    || anchor.contractId !== contractId || anchor.streamId !== streamId
    || !isIdentifier(anchor.contractId) || !eventLogTagPattern.test(anchor.streamId)) {
    throw new Error("event_log_anchor_binding_invalid");
  }
}

function assertRecordBinding(record: EventLogRecord, eventLogId: string, contractId: string, streamId: string): void {
  if (!isDataRecord(record) || exactKeys(record, [
    "format", "eventLogId", "streamId", "contractId", "sequence", "eventId", "previousAuthenticatedTag", "event",
  ]) || record.format !== "morrow.event-log/4" || record.eventLogId !== eventLogId || record.streamId !== streamId
    || record.contractId !== contractId || !Number.isSafeInteger(record.sequence) || record.sequence < 1
    || typeof record.eventId !== "string" || !isIdentifier(record.eventId)
    || !eventLogTagPattern.test(record.previousAuthenticatedTag)
    || !isDataRecord(record.event) || record.event.eventId !== record.eventId || record.event.contractId !== contractId) {
    throw new Error("event_log_record_invalid");
  }
}

function eventStreamIdFor(eventLogId: string, contractId: string): string {
  const streamIdentity = createHash("sha256").update(`morrow.event-log/stream/v1|${eventLogId}`, "utf8").digest("hex");
  return createHash("sha256").update(`${streamIdentity}|${contractId}`, "utf8").digest("hex");
}

function assertExpectedPrevious(current: EventLogHeadAnchor | null, expectedPrevious: EventLogHeadAnchor | null): void {
  if ((current === null) !== (expectedPrevious === null)
    || (current && expectedPrevious && !sameAnchorSummary(current, expectedPrevious))) {
    throw new Error("event_log_anchor_cas_conflict");
  }
}

function parseJournalRecord(value: unknown, authorityRef: string, eventLogId: string): JournalRecord {
  if (!isDataRecord(value) || exactKeys(value, [
    "format", "kind", "authorityRef", "eventLogId", "contractId", "streamId", "generation", "sequence",
    "eventTag", "phase", "expectedPrevious", "previousJournalTag", "journalTag",
  ])) {
    throw new Error("event_log_anchor_invalid");
  }
  if (value.format !== eventLogJournalFormat
    || value.authorityRef !== authorityRef || value.eventLogId !== eventLogId
    || (value.kind !== "PREPARE" && value.kind !== "COMMIT" && value.kind !== "ABORT")
    || typeof value.contractId !== "string" || typeof value.streamId !== "string"
    || !isIdentifier(value.contractId) || value.streamId !== eventStreamIdFor(eventLogId, value.contractId)
    || !Number.isSafeInteger(value.generation) || value.generation < 1
    || !Number.isSafeInteger(value.sequence) || value.sequence < 1
    || !eventLogTagPattern.test(value.eventTag)
    || ((value.kind === "COMMIT") !== (value.phase === "committed"))
    || ((value.kind !== "COMMIT") !== (value.phase === "prepared"))
    || (value.expectedPrevious !== null && (!isDataRecord(value.expectedPrevious)
      || exactKeys(value.expectedPrevious, ["generation", "sequence", "eventTag"])
      || !Number.isSafeInteger(value.expectedPrevious.generation) || value.expectedPrevious.generation < 1
      || !Number.isSafeInteger(value.expectedPrevious.sequence) || value.expectedPrevious.sequence < 1
      || !eventLogTagPattern.test(value.expectedPrevious.eventTag)))
    || !eventLogTagPattern.test(value.previousJournalTag)
    || !eventLogTagPattern.test(value.journalTag)) throw new Error("event_log_anchor_invalid");
  return {
    format: eventLogJournalFormat,
    kind: value.kind,
    authorityRef: value.authorityRef,
    eventLogId: value.eventLogId,
    contractId: value.contractId,
    streamId: value.streamId,
    generation: value.generation,
    sequence: value.sequence,
    eventTag: value.eventTag,
    phase: value.phase,
    expectedPrevious: value.expectedPrevious,
    previousJournalTag: value.previousJournalTag,
    journalTag: value.journalTag,
  };
}

function applyJournalRecord(anchors: Array<EventLogHeadAnchor>, record: JournalRecord): void {
  const next = anchorFromJournal(record);
  const index = anchors.findIndex((item) => sameAnchorKey(item, next));
  const current = index < 0 ? null : anchors[index]!;
  if (record.kind === "PREPARE") {
    if (current?.phase === "prepared"
      || !sameAnchorSummary(current?.phase === "committed" ? current : null, record.expectedPrevious)
      || record.sequence !== (record.expectedPrevious?.sequence ?? 0) + 1
      || record.generation !== (record.expectedPrevious?.generation ?? 0) + 1) {
      throw new Error("event_log_anchor_transition_invalid");
    }
    if (current) anchors[index] = next;
    else anchors.push(next);
    return;
  }
  if (!current || current.phase !== "prepared" || !sameAnchorSummary(current, next)
    || !sameAnchorSummary(current.expectedPrevious, record.expectedPrevious)) {
    throw new Error("event_log_anchor_transition_invalid");
  }
  if (record.kind === "COMMIT") {
    anchors[index] = { ...next, phase: "committed" };
    return;
  }
  if (record.expectedPrevious === null) anchors.splice(index, 1);
  else anchors[index] = {
    ...next,
    generation: record.expectedPrevious.generation,
    sequence: record.expectedPrevious.sequence,
    eventTag: record.expectedPrevious.eventTag,
    phase: "committed",
    expectedPrevious: null,
  };
}

function anchorFromJournal(record: JournalRecord): EventLogHeadAnchor {
  return {
    authorityRef: record.authorityRef,
    eventLogId: record.eventLogId,
    contractId: record.contractId,
    streamId: record.streamId,
    generation: record.generation,
    sequence: record.sequence,
    eventTag: record.eventTag,
    phase: record.phase,
    expectedPrevious: record.expectedPrevious,
  };
}

function summaryOf(anchor: EventLogHeadAnchor): { generation: number; sequence: number; eventTag: string } {
  return { generation: anchor.generation, sequence: anchor.sequence, eventTag: anchor.eventTag };
}

function recordWithoutTag(record: JournalRecord): Omit<JournalRecord, "journalTag"> {
  const { journalTag: _journalTag, ...withoutTag } = record;
  return withoutTag;
}

function canonicalRecord(record: EventLogRecord): string {
  return canonicalize({
    format: record.format,
    eventLogId: record.eventLogId,
    streamId: record.streamId,
    contractId: record.contractId,
    sequence: record.sequence,
    eventId: record.eventId,
    previousAuthenticatedTag: record.previousAuthenticatedTag,
    event: record.event,
  });
}

function canonicalJournal(record: Omit<JournalRecord, "journalTag">): string {
  return canonicalize({
    format: record.format,
    kind: record.kind,
    authorityRef: record.authorityRef,
    eventLogId: record.eventLogId,
    contractId: record.contractId,
    streamId: record.streamId,
    generation: record.generation,
    sequence: record.sequence,
    eventTag: record.eventTag,
    phase: record.phase,
    expectedPrevious: record.expectedPrevious,
    previousJournalTag: record.previousJournalTag,
  });
}

function canonicalBinding(binding: Omit<AuthorityBinding, "bindingTag">): string {
  return canonicalize({
    format: binding.format,
    authorityRef: binding.authorityRef,
    eventLogId: binding.eventLogId,
    historyStarted: binding.historyStarted,
  });
}

function canonicalize(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  if (isDataRecord(value)) {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  throw new Error("event_log_canonicalization_invalid");
}

function hmacHex(key: Buffer, domain: string, value: string): string {
  return createHmac("sha256", key).update(domain, "utf8").update(Buffer.from([0])).update(value, "utf8").digest("hex");
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

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
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

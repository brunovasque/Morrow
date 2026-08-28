export const WORKER_PROTOCOL_ID = "morrow.worker-control" as const;
export const WORKER_PROTOCOL_VERSION = "1.0" as const;
export const WORKER_PROTOCOL_MAX_MESSAGE_BYTES = 262_144 as const;
export const WORKER_PROTOCOL_MESSAGE_TYPES = [
  "worker.hello",
  "worker.heartbeat",
  "control.dispatch",
  "worker.ack",
  "control.cancel",
  "worker.reject",
] as const;

export type WorkerProtocolMessageType = typeof WORKER_PROTOCOL_MESSAGE_TYPES[number];
export type WorkerPeerKind = "control-plane" | "worker";

export interface WorkerProtocolPeer {
  kind: WorkerPeerKind;
  id: string;
  instanceId: string;
}

export interface WorkerProtocolSecurity {
  scheme: "transport-bound-v1";
  credentialId: string;
  nonce: string;
  proof: string;
}

export interface WorkerProtocolAuthorization {
  decisionId: string;
  scopes: string[];
  expiresAt: string;
}

export interface WorkerHelloBody {
  workerSessionId: string;
  hostId: string;
  platform: "windows";
  agentVersion: string;
  supportedProtocolVersions: string[];
  capabilities: Array<{ id: string; version: string }>;
  startedAt: string;
}

export interface WorkerHeartbeatBody {
  workerSessionId: string;
  status: "ready" | "busy" | "draining";
  observedAt: string;
  leaseExpiresAt: string;
  runningDispatchIds: string[];
}

export interface ControlDispatchBody {
  dispatchId: string;
  idempotencyKey: string;
  contractId: string;
  stepId: string;
  targetId: string;
  kind: "process" | "agent";
  workSpec: { artifactId: string; sha256: string };
  workspace: { workspaceId: string; isolation: "dedicated" };
  requiredCapabilities: string[];
  timeoutMs: number;
}

export interface WorkerAckBody {
  ackedMessageId: string;
  disposition: "accepted" | "duplicate" | "rejected";
  dispatchId?: string;
  reasonCode?: string;
}

export interface ControlCancelBody {
  dispatchId: string;
  idempotencyKey: string;
  mode: "graceful" | "force-after-timeout";
  reasonCode: "operator_requested" | "contract_blocked" | "timeout" | "superseded" | "shutdown";
  gracePeriodMs: number;
}

export interface WorkerRejectBody {
  rejectedMessageId: string;
  code: WorkerProtocolRejectionCode;
  retryable: boolean;
  supportedProtocolVersions?: string[];
}

export type WorkerProtocolBody =
  | WorkerHelloBody
  | WorkerHeartbeatBody
  | ControlDispatchBody
  | WorkerAckBody
  | ControlCancelBody
  | WorkerRejectBody;

export interface WorkerProtocolMessage {
  protocol: typeof WORKER_PROTOCOL_ID;
  protocolVersion: string;
  messageId: string;
  messageType: WorkerProtocolMessageType;
  sender: WorkerProtocolPeer;
  recipient: WorkerProtocolPeer;
  issuedAt: string;
  expiresAt: string;
  sequence: number;
  correlationId: string;
  security: WorkerProtocolSecurity;
  authorization?: WorkerProtocolAuthorization;
  body: WorkerProtocolBody;
}

export type WorkerProtocolRejectionCode =
  | "INVALID_ENVELOPE"
  | "UNSUPPORTED_PROTOCOL"
  | "UNAUTHENTICATED"
  | "IDENTITY_MISMATCH"
  | "INVALID_DIRECTION"
  | "UNAUTHORIZED_MESSAGE_TYPE"
  | "AUTHORIZATION_REQUIRED"
  | "AUTHORIZATION_MISMATCH"
  | "MESSAGE_EXPIRED"
  | "MESSAGE_FROM_FUTURE"
  | "TTL_EXCEEDED"
  | "REPLAY_DETECTED"
  | "OUT_OF_ORDER"
  | "INVALID_BODY";

export interface VerifiedWorkerAuthorization {
  decisionId: string;
  scopes: readonly string[];
  expiresAt: string;
}

export interface WorkerProtocolValidationContext {
  now: string | number | Date;
  supportedVersions: readonly string[];
  authenticatedPeer: WorkerProtocolPeer | null;
  localPeer: WorkerProtocolPeer;
  verifiedCredentialId: string | null;
  verifiedAuthorization?: VerifiedWorkerAuthorization | null;
  authorizedMessageTypes: readonly WorkerProtocolMessageType[];
  seenMessageIds?: ReadonlySet<string>;
  seenNonces?: ReadonlySet<string>;
  lastAcceptedSequence?: number;
  maxClockSkewMs?: number;
  maxTtlMs?: number;
}

export type WorkerProtocolValidationResult =
  | { ok: true; message: WorkerProtocolMessage; requiredScopes: string[] }
  | { ok: false; code: WorkerProtocolRejectionCode; detail: string };

export type WorkerProtocolNegotiationResult =
  | { ok: true; version: string }
  | { ok: false; reason: "invalid_version" | "no_common_version" };

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const protocolVersionPattern = /^\d+\.\d+$/;
const componentVersionPattern = /^\d+\.\d+\.\d+$/;
const sha256Pattern = /^[a-f0-9]{64}$/i;
const canonicalTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const defaultMaxClockSkewMs = 30_000;
const defaultMaxTtlMs = 300_000;
const maxHeartbeatLeaseMs = 120_000;

const controlMessageTypes = new Set<WorkerProtocolMessageType>([
  "control.dispatch",
  "control.cancel",
]);

export function negotiateWorkerProtocolVersion(
  localVersions: readonly string[],
  remoteVersions: readonly string[],
): WorkerProtocolNegotiationResult {
  if (
    localVersions.length === 0
    || remoteVersions.length === 0
    || [...localVersions, ...remoteVersions].some((version) => !protocolVersionPattern.test(version))
  ) {
    return { ok: false, reason: "invalid_version" };
  }

  const remote = new Set(remoteVersions);
  const common = [...new Set(localVersions)]
    .filter((version) => remote.has(version))
    .sort(compareProtocolVersions)
    .reverse();

  return common[0]
    ? { ok: true, version: common[0] }
    : { ok: false, reason: "no_common_version" };
}

export function validateWorkerProtocolMessage(
  input: unknown,
  context: WorkerProtocolValidationContext,
): WorkerProtocolValidationResult {
  if (!isRecord(input)) return rejection("INVALID_ENVELOPE", "message_must_be_object");

  const keyError = exactKeys(input, [
    "protocol",
    "protocolVersion",
    "messageId",
    "messageType",
    "sender",
    "recipient",
    "issuedAt",
    "expiresAt",
    "sequence",
    "correlationId",
    "security",
    "body",
  ], ["authorization"]);
  if (keyError) return rejection("INVALID_ENVELOPE", keyError);

  if (input.protocol !== WORKER_PROTOCOL_ID) {
    return rejection("UNSUPPORTED_PROTOCOL", "protocol_id_not_supported");
  }
  if (typeof input.protocolVersion !== "string" || !protocolVersionPattern.test(input.protocolVersion)) {
    return rejection("INVALID_ENVELOPE", "protocol_version_invalid");
  }
  if (!context.supportedVersions.includes(input.protocolVersion)) {
    return rejection("UNSUPPORTED_PROTOCOL", `version_not_supported:${input.protocolVersion}`);
  }
  if (!isMessageType(input.messageType)) {
    return rejection("INVALID_ENVELOPE", "message_type_invalid");
  }
  if (!isIdentifier(input.messageId) || !isIdentifier(input.correlationId)) {
    return rejection("INVALID_ENVELOPE", "message_or_correlation_id_invalid");
  }
  if (!Number.isSafeInteger(input.sequence) || (input.sequence as number) < 0) {
    return rejection("INVALID_ENVELOPE", "sequence_invalid");
  }

  const sender = parsePeer(input.sender);
  const recipient = parsePeer(input.recipient);
  if (!sender || !recipient) return rejection("INVALID_ENVELOPE", "peer_identity_invalid");
  if (!directionIsValid(input.messageType, sender, recipient)) {
    return rejection("INVALID_DIRECTION", `${sender.kind}->${recipient.kind}:${input.messageType}`);
  }

  const issuedAt = parseTimestamp(input.issuedAt);
  const expiresAt = parseTimestamp(input.expiresAt);
  const now = parseContextTime(context.now);
  if (issuedAt === null || expiresAt === null || now === null || expiresAt <= issuedAt) {
    return rejection("INVALID_ENVELOPE", "message_time_window_invalid");
  }
  if (expiresAt - issuedAt > (context.maxTtlMs ?? defaultMaxTtlMs)) {
    return rejection("TTL_EXCEEDED", "message_ttl_too_large");
  }
  if (issuedAt > now + (context.maxClockSkewMs ?? defaultMaxClockSkewMs)) {
    return rejection("MESSAGE_FROM_FUTURE", "issued_at_exceeds_clock_skew");
  }
  if (expiresAt <= now) return rejection("MESSAGE_EXPIRED", "message_expired");

  const security = parseSecurity(input.security);
  if (!security) return rejection("INVALID_ENVELOPE", "security_proof_invalid");
  if (context.authenticatedPeer === null || context.verifiedCredentialId === null) {
    return rejection("UNAUTHENTICATED", "transport_proof_not_verified");
  }
  if (!samePeer(sender, context.authenticatedPeer) || !samePeer(recipient, context.localPeer)) {
    return rejection("IDENTITY_MISMATCH", "message_peer_not_bound_to_transport");
  }
  if (security.credentialId !== context.verifiedCredentialId) {
    return rejection("IDENTITY_MISMATCH", "credential_not_bound_to_transport");
  }
  if (!context.authorizedMessageTypes.includes(input.messageType)) {
    return rejection("UNAUTHORIZED_MESSAGE_TYPE", input.messageType);
  }
  if (
    context.seenMessageIds?.has(input.messageId)
    || context.seenNonces?.has(security.nonce)
  ) {
    return rejection("REPLAY_DETECTED", "message_id_or_nonce_already_seen");
  }
  if (context.lastAcceptedSequence !== undefined && input.sequence <= context.lastAcceptedSequence) {
    return rejection("OUT_OF_ORDER", "sequence_not_greater_than_last_accepted");
  }

  const bodyError = validateBody(input.messageType, input.body);
  if (bodyError) return rejection("INVALID_BODY", bodyError);
  if (input.messageType === "worker.hello") {
    const hello = input.body as unknown as WorkerHelloBody;
    if (!hello.supportedProtocolVersions.includes(input.protocolVersion)) {
      return rejection("INVALID_BODY", "hello_does_not_advertise_envelope_version");
    }
    const startedAt = parseTimestamp(hello.startedAt)!;
    if (startedAt > issuedAt) return rejection("INVALID_BODY", "hello_started_after_message");
  }
  if (input.messageType === "worker.heartbeat") {
    const heartbeat = input.body as unknown as WorkerHeartbeatBody;
    const observedAt = parseTimestamp(heartbeat.observedAt)!;
    if (Math.abs(issuedAt - observedAt) > (context.maxClockSkewMs ?? defaultMaxClockSkewMs)) {
      return rejection("INVALID_BODY", "heartbeat_observation_not_current");
    }
  }

  const requiredScopes = scopesFor(input.messageType, input.body as WorkerProtocolBody);
  if (controlMessageTypes.has(input.messageType)) {
    const authorization = parseAuthorization(input.authorization);
    if (!authorization) return rejection("AUTHORIZATION_REQUIRED", "authorization_missing_or_invalid");

    const verified = context.verifiedAuthorization;
    if (!verified) return rejection("AUTHORIZATION_REQUIRED", "authorization_not_verified");
    if (
      authorization.decisionId !== verified.decisionId
      || authorization.expiresAt !== verified.expiresAt
      || !sameStringSet(authorization.scopes, verified.scopes)
    ) {
      return rejection("AUTHORIZATION_MISMATCH", "authorization_not_bound_to_policy_decision");
    }

    const authorizationExpiry = parseTimestamp(authorization.expiresAt);
    if (authorizationExpiry === null || authorizationExpiry < expiresAt || authorizationExpiry <= now) {
      return rejection("AUTHORIZATION_MISMATCH", "authorization_expired_before_message");
    }
    const missingScope = requiredScopes.find((scope) => !authorization.scopes.includes(scope));
    if (missingScope) return rejection("AUTHORIZATION_MISMATCH", `scope_missing:${missingScope}`);
  } else if (input.authorization !== undefined) {
    return rejection("INVALID_ENVELOPE", "authorization_not_allowed_for_worker_message");
  }

  return {
    ok: true,
    message: deepFreeze(structuredClone(input)) as unknown as WorkerProtocolMessage,
    requiredScopes,
  };
}

function validateBody(type: WorkerProtocolMessageType, value: unknown): string | null {
  if (!isRecord(value)) return "body_must_be_object";

  if (type === "worker.hello") {
    const keys = exactKeys(value, [
      "workerSessionId",
      "hostId",
      "platform",
      "agentVersion",
      "supportedProtocolVersions",
      "capabilities",
      "startedAt",
    ]);
    if (keys) return keys;
    if (!isIdentifier(value.workerSessionId) || !isIdentifier(value.hostId)) return "hello_identity_invalid";
    if (value.platform !== "windows") return "hello_platform_invalid";
    if (typeof value.agentVersion !== "string" || !componentVersionPattern.test(value.agentVersion)) {
      return "hello_agent_version_invalid";
    }
    if (!isUniqueStringArray(value.supportedProtocolVersions, protocolVersionPattern, 1, 16)) {
      return "hello_protocol_versions_invalid";
    }
    if (!Array.isArray(value.capabilities) || value.capabilities.length < 1 || value.capabilities.length > 128) {
      return "hello_capabilities_invalid";
    }
    const capabilityIds = new Set<string>();
    for (const item of value.capabilities) {
      if (!isRecord(item) || exactKeys(item, ["id", "version"])) return "hello_capability_invalid";
      if (!isIdentifier(item.id) || typeof item.version !== "string" || !componentVersionPattern.test(item.version)) {
        return "hello_capability_invalid";
      }
      if (capabilityIds.has(item.id)) return "hello_capability_duplicate";
      capabilityIds.add(item.id);
    }
    if (parseTimestamp(value.startedAt) === null) return "hello_started_at_invalid";
    return null;
  }

  if (type === "worker.heartbeat") {
    const keys = exactKeys(value, [
      "workerSessionId",
      "status",
      "observedAt",
      "leaseExpiresAt",
      "runningDispatchIds",
    ]);
    if (keys) return keys;
    if (!isIdentifier(value.workerSessionId)) return "heartbeat_session_invalid";
    if (!(["ready", "busy", "draining"] as unknown[]).includes(value.status)) return "heartbeat_status_invalid";
    const observedAt = parseTimestamp(value.observedAt);
    const leaseExpiresAt = parseTimestamp(value.leaseExpiresAt);
    if (
      observedAt === null
      || leaseExpiresAt === null
      || leaseExpiresAt <= observedAt
      || leaseExpiresAt - observedAt > maxHeartbeatLeaseMs
    ) {
      return "heartbeat_lease_invalid";
    }
    if (!isUniqueStringArray(value.runningDispatchIds, identifierPattern, 0, 128)) {
      return "heartbeat_dispatch_ids_invalid";
    }
    return null;
  }

  if (type === "control.dispatch") {
    const keys = exactKeys(value, [
      "dispatchId",
      "idempotencyKey",
      "contractId",
      "stepId",
      "targetId",
      "kind",
      "workSpec",
      "workspace",
      "requiredCapabilities",
      "timeoutMs",
    ]);
    if (keys) return keys;
    if (
      !isIdentifier(value.dispatchId)
      || !isIdentifier(value.idempotencyKey)
      || !isIdentifier(value.contractId)
      || !isIdentifier(value.stepId)
      || !isIdentifier(value.targetId)
    ) return "dispatch_identity_invalid";
    if (value.kind !== "process" && value.kind !== "agent") return "dispatch_kind_invalid";
    if (!isRecord(value.workSpec) || exactKeys(value.workSpec, ["artifactId", "sha256"])) {
      return "dispatch_work_spec_invalid";
    }
    if (!isIdentifier(value.workSpec.artifactId) || typeof value.workSpec.sha256 !== "string" || !sha256Pattern.test(value.workSpec.sha256)) {
      return "dispatch_work_spec_invalid";
    }
    if (!isRecord(value.workspace) || exactKeys(value.workspace, ["workspaceId", "isolation"])) {
      return "dispatch_workspace_invalid";
    }
    if (!isIdentifier(value.workspace.workspaceId) || value.workspace.isolation !== "dedicated") {
      return "dispatch_workspace_invalid";
    }
    if (!isUniqueStringArray(value.requiredCapabilities, identifierPattern, 1, 128)) {
      return "dispatch_capabilities_invalid";
    }
    if (!Number.isSafeInteger(value.timeoutMs) || (value.timeoutMs as number) < 1 || (value.timeoutMs as number) > 86_400_000) {
      return "dispatch_timeout_invalid";
    }
    return null;
  }

  if (type === "worker.ack") {
    const keys = exactKeys(value, ["ackedMessageId", "disposition"], ["dispatchId", "reasonCode"]);
    if (keys) return keys;
    if (!isIdentifier(value.ackedMessageId)) return "ack_message_id_invalid";
    if (!(["accepted", "duplicate", "rejected"] as unknown[]).includes(value.disposition)) {
      return "ack_disposition_invalid";
    }
    if (value.dispatchId !== undefined && !isIdentifier(value.dispatchId)) return "ack_dispatch_id_invalid";
    if (value.disposition === "rejected" && !isIdentifier(value.reasonCode)) return "ack_reason_required";
    if (value.reasonCode !== undefined && !isIdentifier(value.reasonCode)) return "ack_reason_invalid";
    return null;
  }

  if (type === "control.cancel") {
    const keys = exactKeys(value, ["dispatchId", "idempotencyKey", "mode", "reasonCode", "gracePeriodMs"]);
    if (keys) return keys;
    if (!isIdentifier(value.dispatchId) || !isIdentifier(value.idempotencyKey)) return "cancel_identity_invalid";
    if (value.mode !== "graceful" && value.mode !== "force-after-timeout") return "cancel_mode_invalid";
    if (!( ["operator_requested", "contract_blocked", "timeout", "superseded", "shutdown"] as unknown[]).includes(value.reasonCode)) {
      return "cancel_reason_invalid";
    }
    if (!Number.isSafeInteger(value.gracePeriodMs) || (value.gracePeriodMs as number) < 0 || (value.gracePeriodMs as number) > 300_000) {
      return "cancel_grace_period_invalid";
    }
    return null;
  }

  const keys = exactKeys(value, ["rejectedMessageId", "code", "retryable"], ["supportedProtocolVersions"]);
  if (keys) return keys;
  if (!isIdentifier(value.rejectedMessageId) || !isRejectionCode(value.code) || typeof value.retryable !== "boolean") {
    return "reject_body_invalid";
  }
  if (
    value.supportedProtocolVersions !== undefined
    && !isUniqueStringArray(value.supportedProtocolVersions, protocolVersionPattern, 1, 16)
  ) return "reject_supported_versions_invalid";
  return null;
}

function scopesFor(type: WorkerProtocolMessageType, body: WorkerProtocolBody): string[] {
  if (type === "control.dispatch") {
    const dispatch = body as ControlDispatchBody;
    return [
      "message:control.dispatch",
      "dispatch:create",
      `contract:${dispatch.contractId}`,
      `step:${dispatch.stepId}`,
      `target:${dispatch.targetId}`,
      ...dispatch.requiredCapabilities.map((capability) => `capability:${capability}`),
    ];
  }
  if (type === "control.cancel") {
    const cancel = body as ControlCancelBody;
    return ["message:control.cancel", "dispatch:cancel", `dispatch:${cancel.dispatchId}`];
  }
  return [`message:${type}`];
}

function parsePeer(value: unknown): WorkerProtocolPeer | null {
  if (!isRecord(value) || exactKeys(value, ["kind", "id", "instanceId"])) return null;
  if ((value.kind !== "control-plane" && value.kind !== "worker") || !isIdentifier(value.id) || !isIdentifier(value.instanceId)) {
    return null;
  }
  return value as unknown as WorkerProtocolPeer;
}

function parseSecurity(value: unknown): WorkerProtocolSecurity | null {
  if (!isRecord(value) || exactKeys(value, ["scheme", "credentialId", "nonce", "proof"])) return null;
  if (
    value.scheme !== "transport-bound-v1"
    || !isIdentifier(value.credentialId)
    || typeof value.nonce !== "string"
    || value.nonce.length < 16
    || value.nonce.length > 256
    || typeof value.proof !== "string"
    || value.proof.length < 16
    || value.proof.length > 4096
  ) return null;
  return value as unknown as WorkerProtocolSecurity;
}

function parseAuthorization(value: unknown): WorkerProtocolAuthorization | null {
  if (!isRecord(value) || exactKeys(value, ["decisionId", "scopes", "expiresAt"])) return null;
  if (
    !isIdentifier(value.decisionId)
    || !isUniqueStringArray(value.scopes, identifierPattern, 1, 256)
    || parseTimestamp(value.expiresAt) === null
  ) return null;
  return value as unknown as WorkerProtocolAuthorization;
}

function directionIsValid(
  type: WorkerProtocolMessageType,
  sender: WorkerProtocolPeer,
  recipient: WorkerProtocolPeer,
): boolean {
  return controlMessageTypes.has(type)
    ? sender.kind === "control-plane" && recipient.kind === "worker"
    : sender.kind === "worker" && recipient.kind === "control-plane";
}

function samePeer(left: WorkerProtocolPeer, right: WorkerProtocolPeer): boolean {
  return left.kind === right.kind && left.id === right.id && left.instanceId === right.instanceId;
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): string | null {
  for (const key of required) if (!Object.hasOwn(value, key)) return `missing_field:${key}`;
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  return unknown ? `unknown_field:${unknown}` : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifierPattern.test(value);
}

function isUniqueStringArray(
  value: unknown,
  pattern: RegExp,
  min: number,
  max: number,
): value is string[] {
  return Array.isArray(value)
    && value.length >= min
    && value.length <= max
    && value.every((item) => typeof item === "string" && pattern.test(item))
    && new Set(value).size === value.length;
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

function isMessageType(value: unknown): value is WorkerProtocolMessageType {
  return typeof value === "string" && (WORKER_PROTOCOL_MESSAGE_TYPES as readonly string[]).includes(value);
}

function isRejectionCode(value: unknown): value is WorkerProtocolRejectionCode {
  return typeof value === "string" && [
    "INVALID_ENVELOPE",
    "UNSUPPORTED_PROTOCOL",
    "UNAUTHENTICATED",
    "IDENTITY_MISMATCH",
    "INVALID_DIRECTION",
    "UNAUTHORIZED_MESSAGE_TYPE",
    "AUTHORIZATION_REQUIRED",
    "AUTHORIZATION_MISMATCH",
    "MESSAGE_EXPIRED",
    "MESSAGE_FROM_FUTURE",
    "TTL_EXCEEDED",
    "REPLAY_DETECTED",
    "OUT_OF_ORDER",
    "INVALID_BODY",
  ].includes(value);
}

function compareProtocolVersions(left: string, right: string): number {
  const [leftMajor, leftMinor] = left.split(".").map(Number);
  const [rightMajor, rightMinor] = right.split(".").map(Number);
  return leftMajor - rightMajor || leftMinor - rightMinor;
}

function rejection(code: WorkerProtocolRejectionCode, detail: string): WorkerProtocolValidationResult {
  return { ok: false, code, detail };
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

import type { Actor } from "./types.ts";

export const LIVE_ACTIVITY_SCHEMA_ID = "morrow.live-activity" as const;
export const LIVE_ACTIVITY_SCHEMA_VERSION = "1.0" as const;
export const LIVE_ACTIVITY_MAX_EVENTS = 100_000 as const;

export const LIVE_ACTIVITY_STATES = [
  "dispatch",
  "gate",
  "tool",
  "process",
  "waiting-lock",
  "waiting-quota",
  "waiting-owner",
  "blocked",
  "failed",
  "done",
] as const;

export const LIVE_ACTIVITY_SOURCE_KINDS = [
  "orchestrator",
  "gate",
  "tool",
  "process",
  "lock",
  "quota",
  "owner",
  "kernel",
] as const;

export type LiveActivityState = typeof LIVE_ACTIVITY_STATES[number];
export type LiveActivitySourceKind = typeof LIVE_ACTIVITY_SOURCE_KINDS[number];

export interface LiveActivityIdentity {
  activityId: string;
  correlationId: string;
  contractId: string;
  stepId: string;
  agentInstanceId: string | null;
  terminalSessionId: string | null;
  workspaceId: string | null;
}

export interface LiveActivityTransition {
  from: LiveActivityState | null;
  to: LiveActivityState;
  reasonCode: string;
  sourceKind: LiveActivitySourceKind;
  sourceId: string;
}

export interface LiveActivityEvent {
  schema: typeof LIVE_ACTIVITY_SCHEMA_ID;
  schemaVersion: typeof LIVE_ACTIVITY_SCHEMA_VERSION;
  eventId: string;
  causationId: string | null;
  sequence: number;
  occurredAt: string;
  actor: Actor;
  identity: LiveActivityIdentity;
  transition: LiveActivityTransition;
}

export interface LiveActivityFeedEntry {
  eventId: string;
  causationId: string | null;
  sequence: number;
  occurredAt: string;
  activityId: string;
  correlationId: string;
  contractId: string;
  stepId: string;
  agentInstanceId: string | null;
  terminalSessionId: string | null;
  workspaceId: string | null;
  state: LiveActivityState;
  reasonCode: string;
  sourceKind: LiveActivitySourceKind;
  sourceId: string;
  actor: Actor;
}

export interface LiveActivitySnapshot {
  identity: LiveActivityIdentity;
  state: LiveActivityState;
  lastEventId: string;
  lastSequence: number;
  occurredAt: string;
  terminal: boolean;
}

export interface LiveActivityProjection {
  schemaVersion: typeof LIVE_ACTIVITY_SCHEMA_VERSION;
  contractId: string;
  lastSequence: number;
  entries: readonly LiveActivityFeedEntry[];
  activities: readonly LiveActivitySnapshot[];
}

export type LiveActivityValidationCode =
  | "INVALID_EVENT"
  | "UNSUPPORTED_SCHEMA";

export type LiveActivityProjectionCode =
  | LiveActivityValidationCode
  | "CONTRACT_MISMATCH"
  | "DUPLICATE_EVENT"
  | "OUT_OF_ORDER"
  | "CAUSATION_MISMATCH"
  | "IDENTITY_MISMATCH"
  | "STATE_MISMATCH"
  | "INVALID_TRANSITION"
  | "TERMINAL_STATE";

export type LiveActivityValidationResult =
  | { ok: true; event: LiveActivityEvent }
  | { ok: false; code: LiveActivityValidationCode; detail: string };

export type LiveActivityProjectionResult =
  | { ok: true; projection: LiveActivityProjection }
  | { ok: false; code: LiveActivityProjectionCode; detail: string; eventIndex: number };

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const canonicalTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const terminalStates = new Set<LiveActivityState>(["blocked", "failed", "done"]);
const activeStates = new Set<LiveActivityState>([
  "dispatch",
  "gate",
  "tool",
  "process",
  "waiting-lock",
  "waiting-quota",
  "waiting-owner",
]);

export function validateLiveActivityEvent(input: unknown): LiveActivityValidationResult {
  try {
    return validateLiveActivityEventUnchecked(input);
  } catch {
    return invalid("event_inspection_failed");
  }
}

function validateLiveActivityEventUnchecked(input: unknown): LiveActivityValidationResult {
  if (!isPlainDataRecord(input)) return invalid("event_must_be_plain_object");
  if (!hasExactDataKeys(input, [
    "schema",
    "schemaVersion",
    "eventId",
    "causationId",
    "sequence",
    "occurredAt",
    "actor",
    "identity",
    "transition",
  ])) return invalid("event_fields_invalid");

  if (input.schema !== LIVE_ACTIVITY_SCHEMA_ID || input.schemaVersion !== LIVE_ACTIVITY_SCHEMA_VERSION) {
    return { ok: false, code: "UNSUPPORTED_SCHEMA", detail: "live_activity_schema_not_supported" };
  }
  if (!isIdentifier(input.eventId)) return invalid("event_id_invalid");
  if (!isNullableIdentifier(input.causationId)) return invalid("event_causation_id_invalid");
  if (!Number.isSafeInteger(input.sequence) || (input.sequence as number) <= 0) {
    return invalid("event_sequence_invalid");
  }
  if (!isCanonicalTimestamp(input.occurredAt)) return invalid("event_timestamp_invalid");

  const actor = parseActor(input.actor);
  const identity = parseIdentity(input.identity);
  const transition = parseTransition(input.transition);
  if (!actor) return invalid("event_actor_invalid");
  if (!identity) return invalid("event_identity_invalid");
  if (!transition) return invalid("event_transition_invalid");

  return {
    ok: true,
    event: deepFreeze({
      schema: LIVE_ACTIVITY_SCHEMA_ID,
      schemaVersion: LIVE_ACTIVITY_SCHEMA_VERSION,
      eventId: input.eventId,
      causationId: input.causationId,
      sequence: input.sequence as number,
      occurredAt: input.occurredAt as string,
      actor,
      identity,
      transition,
    }),
  };
}

export function projectContractLiveActivity(
  contractId: string,
  inputs: readonly unknown[],
): LiveActivityProjectionResult {
  try {
    return projectContractLiveActivityUnchecked(contractId, inputs);
  } catch {
    return projectionFailure("INVALID_EVENT", "event_collection_inspection_failed", 0);
  }
}

function projectContractLiveActivityUnchecked(
  contractId: string,
  inputs: readonly unknown[],
): LiveActivityProjectionResult {
  if (!isIdentifier(contractId)) {
    return projectionFailure("INVALID_EVENT", "contract_id_invalid", 0);
  }
  if (!Array.isArray(inputs) || inputs.length > LIVE_ACTIVITY_MAX_EVENTS) {
    return projectionFailure("INVALID_EVENT", "event_collection_invalid", 0);
  }

  const entries: LiveActivityFeedEntry[] = [];
  const snapshots = new Map<string, LiveActivitySnapshot>();
  const seenEventIds = new Set<string>();
  let previousOccurredAt = -1;

  for (let index = 0; index < inputs.length; index += 1) {
    const input = readDataArrayElement(inputs, index);
    if (!input.ok) return projectionFailure("INVALID_EVENT", input.detail, index);
    const validation = validateLiveActivityEvent(input.value);
    if (!validation.ok) return projectionFailure(validation.code, validation.detail, index);
    const event = validation.event;

    if (event.identity.contractId !== contractId) {
      return projectionFailure("CONTRACT_MISMATCH", "event_contract_mismatch", index);
    }
    if (seenEventIds.has(event.eventId)) {
      return projectionFailure("DUPLICATE_EVENT", "event_id_already_seen", index);
    }
    const expectedSequence = index + 1;
    if (event.sequence !== expectedSequence) {
      return projectionFailure("OUT_OF_ORDER", `event_sequence_expected:${expectedSequence}`, index);
    }
    const occurredAt = Date.parse(event.occurredAt);
    if (occurredAt < previousOccurredAt) {
      return projectionFailure("OUT_OF_ORDER", "event_timestamp_moved_backwards", index);
    }

    const previous = snapshots.get(event.identity.activityId);
    if (previous && !sameIdentity(previous.identity, event.identity)) {
      return projectionFailure("IDENTITY_MISMATCH", "activity_identity_changed", index);
    }
    if ((previous?.state ?? null) !== event.transition.from) {
      return projectionFailure("STATE_MISMATCH", "transition_from_does_not_match_projection", index);
    }
    if (event.causationId !== (previous?.lastEventId ?? null)) {
      return projectionFailure("CAUSATION_MISMATCH", "event_causation_does_not_match_activity_head", index);
    }
    if (previous?.terminal) {
      return projectionFailure("TERMINAL_STATE", "terminal_activity_cannot_transition", index);
    }
    if (!transitionIsAllowed(event.transition.from, event.transition.to)) {
      return projectionFailure("INVALID_TRANSITION", "live_activity_transition_not_allowed", index);
    }

    seenEventIds.add(event.eventId);
    previousOccurredAt = occurredAt;
    const identity = cloneIdentity(event.identity);
    entries.push(deepFreeze({
      eventId: event.eventId,
      causationId: event.causationId,
      sequence: event.sequence,
      occurredAt: event.occurredAt,
      ...identity,
      state: event.transition.to,
      reasonCode: event.transition.reasonCode,
      sourceKind: event.transition.sourceKind,
      sourceId: event.transition.sourceId,
      actor: { ...event.actor },
    }));
    snapshots.set(event.identity.activityId, deepFreeze({
      identity,
      state: event.transition.to,
      lastEventId: event.eventId,
      lastSequence: event.sequence,
      occurredAt: event.occurredAt,
      terminal: terminalStates.has(event.transition.to),
    }));
  }

  return {
    ok: true,
    projection: deepFreeze({
      schemaVersion: LIVE_ACTIVITY_SCHEMA_VERSION,
      contractId,
      lastSequence: inputs.length,
      entries: [...entries],
      activities: [...snapshots.values()],
    }),
  };
}

function readDataArrayElement(
  values: readonly unknown[],
  index: number,
): { ok: true; value: unknown } | { ok: false; detail: string } {
  const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
  return descriptor !== undefined && "value" in descriptor
    ? { ok: true, value: descriptor.value }
    : { ok: false, detail: "event_collection_element_not_data" };
}

function parseActor(input: unknown): Actor | null {
  if (!isPlainDataRecord(input) || !hasExactDataKeys(input, ["kind", "id"])) return null;
  if ((input.kind !== "human" && input.kind !== "agent" && input.kind !== "kernel") || !isIdentifier(input.id)) {
    return null;
  }
  return { kind: input.kind, id: input.id };
}

function parseIdentity(input: unknown): LiveActivityIdentity | null {
  if (!isPlainDataRecord(input) || !hasExactDataKeys(input, [
    "activityId",
    "correlationId",
    "contractId",
    "stepId",
    "agentInstanceId",
    "terminalSessionId",
    "workspaceId",
  ])) return null;
  if (
    !isIdentifier(input.activityId)
    || !isIdentifier(input.correlationId)
    || !isIdentifier(input.contractId)
    || !isIdentifier(input.stepId)
    || !isNullableIdentifier(input.agentInstanceId)
    || !isNullableIdentifier(input.terminalSessionId)
    || !isNullableIdentifier(input.workspaceId)
  ) return null;
  return {
    activityId: input.activityId,
    correlationId: input.correlationId,
    contractId: input.contractId,
    stepId: input.stepId,
    agentInstanceId: input.agentInstanceId,
    terminalSessionId: input.terminalSessionId,
    workspaceId: input.workspaceId,
  };
}

function parseTransition(input: unknown): LiveActivityTransition | null {
  if (!isPlainDataRecord(input) || !hasExactDataKeys(input, [
    "from",
    "to",
    "reasonCode",
    "sourceKind",
    "sourceId",
  ])) return null;
  if (
    !(input.from === null || isLiveActivityState(input.from))
    || !isLiveActivityState(input.to)
    || !isIdentifier(input.reasonCode)
    || !isLiveActivitySourceKind(input.sourceKind)
    || !isIdentifier(input.sourceId)
    || !sourceMatchesState(input.sourceKind, input.to)
  ) return null;
  return {
    from: input.from,
    to: input.to,
    reasonCode: input.reasonCode,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
  };
}

function transitionIsAllowed(from: LiveActivityState | null, to: LiveActivityState): boolean {
  if (from === null) return to === "dispatch";
  if (!activeStates.has(from) || to === "dispatch") return false;
  return true;
}

function sourceMatchesState(source: LiveActivitySourceKind, state: LiveActivityState): boolean {
  const allowed: Record<LiveActivityState, readonly LiveActivitySourceKind[]> = {
    dispatch: ["orchestrator", "kernel"],
    gate: ["gate", "kernel"],
    tool: ["tool"],
    process: ["process"],
    "waiting-lock": ["lock"],
    "waiting-quota": ["quota"],
    "waiting-owner": ["owner"],
    blocked: ["orchestrator", "gate", "lock", "quota", "owner", "kernel"],
    failed: ["gate", "tool", "process", "kernel"],
    done: ["orchestrator", "tool", "process", "kernel"],
  };
  return allowed[state].includes(source);
}

function sameIdentity(left: LiveActivityIdentity, right: LiveActivityIdentity): boolean {
  return left.activityId === right.activityId
    && left.correlationId === right.correlationId
    && left.contractId === right.contractId
    && left.stepId === right.stepId
    && left.agentInstanceId === right.agentInstanceId
    && left.terminalSessionId === right.terminalSessionId
    && left.workspaceId === right.workspaceId;
}

function cloneIdentity(identity: LiveActivityIdentity): LiveActivityIdentity {
  return { ...identity };
}

function isLiveActivityState(value: unknown): value is LiveActivityState {
  return typeof value === "string" && (LIVE_ACTIVITY_STATES as readonly string[]).includes(value);
}

function isLiveActivitySourceKind(value: unknown): value is LiveActivitySourceKind {
  return typeof value === "string" && (LIVE_ACTIVITY_SOURCE_KINDS as readonly string[]).includes(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifierPattern.test(value);
}

function isNullableIdentifier(value: unknown): value is string | null {
  return value === null || isIdentifier(value);
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !canonicalTimestampPattern.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isPlainDataRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactDataKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  if (keys.length !== expected.length || keys.some((key) => typeof key !== "string" || !expected.includes(key))) {
    return false;
  }
  return expected.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor;
  });
}

function invalid(detail: string): LiveActivityValidationResult {
  return { ok: false, code: "INVALID_EVENT", detail };
}

function projectionFailure(
  code: LiveActivityProjectionCode,
  detail: string,
  eventIndex: number,
): LiveActivityProjectionResult {
  return { ok: false, code, detail, eventIndex };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

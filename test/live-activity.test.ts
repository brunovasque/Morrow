import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  LIVE_ACTIVITY_SCHEMA_ID,
  LIVE_ACTIVITY_SCHEMA_VERSION,
  LIVE_ACTIVITY_SOURCE_KINDS,
  LIVE_ACTIVITY_STATES,
  projectContractLiveActivity,
  validateLiveActivityEvent,
  type LiveActivityEvent,
  type LiveActivityProjectionCode,
  type LiveActivitySourceKind,
  type LiveActivityState,
} from "../src/live-activity.ts";

const baseTime = Date.parse("2026-08-31T12:00:00.000Z");

function activityEvent(input: {
  sequence: number;
  activityId?: string;
  contractId?: string;
  from: LiveActivityState | null;
  to: LiveActivityState;
  sourceKind?: LiveActivitySourceKind;
  eventId?: string;
  occurredAt?: string;
}): LiveActivityEvent {
  const activityId = input.activityId ?? "activity-1";
  return {
    schema: LIVE_ACTIVITY_SCHEMA_ID,
    schemaVersion: LIVE_ACTIVITY_SCHEMA_VERSION,
    eventId: input.eventId ?? `event-${input.sequence}`,
    causationId: input.from === null ? null : `event-${input.sequence - 1}`,
    sequence: input.sequence,
    occurredAt: input.occurredAt ?? new Date(baseTime + input.sequence * 1_000).toISOString(),
    actor: { kind: "kernel", id: "morrow-kernel" },
    identity: {
      activityId,
      correlationId: `correlation-${activityId}`,
      contractId: input.contractId ?? "C1",
      stepId: "P4-PR01",
      agentInstanceId: activityId === "activity-1" ? "agent-1" : null,
      terminalSessionId: activityId === "activity-1" ? "terminal-1" : null,
      workspaceId: activityId === "activity-1" ? "workspace-1" : null,
    },
    transition: {
      from: input.from,
      to: input.to,
      reasonCode: `reason-${input.to}`,
      sourceKind: input.sourceKind ?? sourceForState(input.to),
      sourceId: `source-${input.sequence}`,
    },
  };
}

function sourceForState(state: LiveActivityState): LiveActivitySourceKind {
  if (state === "gate" || state === "blocked") return "gate";
  if (state === "tool") return "tool";
  if (state === "process" || state === "failed" || state === "done") return "process";
  if (state === "waiting-lock") return "lock";
  if (state === "waiting-quota") return "quota";
  if (state === "waiting-owner") return "owner";
  return "orchestrator";
}

function expectProjectionFailure(
  events: readonly unknown[],
  code: LiveActivityProjectionCode,
  eventIndex: number,
): void {
  const result = projectContractLiveActivity("C1", events);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, code);
  assert.equal(result.eventIndex, eventIndex);
}

test("live activity JSON schema and executable constants stay aligned", async () => {
  const schema = JSON.parse(await readFile(
    join(process.cwd(), "schema", "live-activity.v1.schema.json"),
    "utf8",
  ));

  assert.equal(schema.properties.schema.const, LIVE_ACTIVITY_SCHEMA_ID);
  assert.equal(schema.properties.schemaVersion.const, LIVE_ACTIVITY_SCHEMA_VERSION);
  assert.deepEqual(schema.$defs.state.enum, [...LIVE_ACTIVITY_STATES]);
  assert.deepEqual(schema.properties.transition.properties.sourceKind.enum, [...LIVE_ACTIVITY_SOURCE_KINDS]);
  assert.equal(schema.additionalProperties, false);
});

test("projects every required live feed state only from canonical events", () => {
  const events = [
    activityEvent({ sequence: 1, from: null, to: "dispatch" }),
    activityEvent({ sequence: 2, from: "dispatch", to: "gate" }),
    activityEvent({ sequence: 3, from: "gate", to: "waiting-lock" }),
    activityEvent({ sequence: 4, from: "waiting-lock", to: "process" }),
    activityEvent({ sequence: 5, from: "process", to: "tool" }),
    activityEvent({ sequence: 6, from: "tool", to: "waiting-quota" }),
    activityEvent({ sequence: 7, from: "waiting-quota", to: "process" }),
    activityEvent({ sequence: 8, from: "process", to: "done" }),
    activityEvent({ sequence: 9, activityId: "activity-2", from: null, to: "dispatch" }),
    activityEvent({ sequence: 10, activityId: "activity-2", from: "dispatch", to: "waiting-owner" }),
    activityEvent({ sequence: 11, activityId: "activity-2", from: "waiting-owner", to: "blocked" }),
    activityEvent({ sequence: 12, activityId: "activity-3", from: null, to: "dispatch" }),
    activityEvent({ sequence: 13, activityId: "activity-3", from: "dispatch", to: "process" }),
    activityEvent({ sequence: 14, activityId: "activity-3", from: "process", to: "failed" }),
  ];

  const result = projectContractLiveActivity("C1", events);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    new Set(result.projection.entries.map((entry) => entry.state)),
    new Set(LIVE_ACTIVITY_STATES),
  );
  assert.equal(result.projection.lastSequence, 14);
  assert.deepEqual(
    result.projection.activities.map((activity) => [activity.identity.activityId, activity.state, activity.terminal]),
    [
      ["activity-1", "done", true],
      ["activity-2", "blocked", true],
      ["activity-3", "failed", true],
    ],
  );
  assert.equal(result.projection.entries[0].agentInstanceId, "agent-1");
  assert.equal(result.projection.entries[0].terminalSessionId, "terminal-1");
  assert.equal(result.projection.entries[0].workspaceId, "workspace-1");
});

test("does not fabricate activity when no event exists", () => {
  const result = projectContractLiveActivity("C1", []);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.projection.entries, []);
  assert.deepEqual(result.projection.activities, []);
  assert.equal(result.projection.lastSequence, 0);
});

test("validated events and projections are detached and deeply frozen", () => {
  const input = activityEvent({ sequence: 1, from: null, to: "dispatch" });
  const validation = validateLiveActivityEvent(input);
  assert.equal(validation.ok, true);
  if (!validation.ok) return;
  input.identity.activityId = "mutated";
  assert.equal(validation.event.identity.activityId, "activity-1");
  assert.equal(Object.isFrozen(validation.event), true);
  assert.equal(Object.isFrozen(validation.event.identity), true);
  assert.equal(Object.isFrozen(validation.event.transition), true);

  const projection = projectContractLiveActivity("C1", [validation.event]);
  assert.equal(projection.ok, true);
  if (!projection.ok) return;
  assert.equal(Object.isFrozen(projection.projection), true);
  assert.equal(Object.isFrozen(projection.projection.entries), true);
  assert.equal(Object.isFrozen(projection.projection.entries[0].actor), true);
  assert.equal(Object.isFrozen(projection.projection.activities[0].identity), true);
});

test("rejects schema drift, extra fields, accessors and inherited events", () => {
  const schemaDrift = { ...activityEvent({ sequence: 1, from: null, to: "dispatch" }), schemaVersion: "2.0" };
  assert.deepEqual(validateLiveActivityEvent(schemaDrift), {
    ok: false,
    code: "UNSUPPORTED_SCHEMA",
    detail: "live_activity_schema_not_supported",
  });

  const extra = { ...activityEvent({ sequence: 1, from: null, to: "dispatch" }), summary: "invented activity" };
  assert.equal(validateLiveActivityEvent(extra).ok, false);

  let getterCalls = 0;
  const accessorActor = { kind: "kernel" } as Record<string, unknown>;
  Object.defineProperty(accessorActor, "id", {
    enumerable: true,
    get: () => {
      getterCalls += 1;
      return "morrow-kernel";
    },
  });
  const accessor = { ...activityEvent({ sequence: 1, from: null, to: "dispatch" }), actor: accessorActor };
  assert.equal(validateLiveActivityEvent(accessor).ok, false);
  assert.equal(getterCalls, 0);

  const inherited = Object.create(activityEvent({ sequence: 1, from: null, to: "dispatch" }));
  assert.equal(validateLiveActivityEvent(inherited).ok, false);

  const hostile = new Proxy({}, {
    getPrototypeOf: () => { throw new Error("hostile_proxy_detail_must_not_escape"); },
  });
  assert.deepEqual(validateLiveActivityEvent(hostile), {
    ok: false,
    code: "INVALID_EVENT",
    detail: "event_inspection_failed",
  });
  assert.deepEqual(projectContractLiveActivity("C1", new Proxy([], {
    get: () => { throw new Error("hostile_collection_detail_must_not_escape"); },
  })), {
    ok: false,
    code: "INVALID_EVENT",
    detail: "event_collection_inspection_failed",
    eventIndex: 0,
  });
});

test("binds mechanical source kinds to the visible state category", () => {
  const mismatch = activityEvent({
    sequence: 1,
    from: null,
    to: "waiting-quota",
    sourceKind: "process",
  });
  assert.deepEqual(validateLiveActivityEvent(mismatch), {
    ok: false,
    code: "INVALID_EVENT",
    detail: "event_transition_invalid",
  });
});

test("rejects gaps, duplicates, backward time and cross-contract events", () => {
  const first = activityEvent({ sequence: 1, from: null, to: "dispatch" });
  expectProjectionFailure([
    first,
    activityEvent({ sequence: 3, from: "dispatch", to: "gate" }),
  ], "OUT_OF_ORDER", 1);
  expectProjectionFailure([
    first,
    activityEvent({ sequence: 2, eventId: first.eventId, from: "dispatch", to: "gate" }),
  ], "DUPLICATE_EVENT", 1);
  expectProjectionFailure([
    first,
    activityEvent({
      sequence: 2,
      from: "dispatch",
      to: "gate",
      occurredAt: new Date(baseTime).toISOString(),
    }),
  ], "OUT_OF_ORDER", 1);
  expectProjectionFailure([
    activityEvent({ sequence: 1, contractId: "C2", from: null, to: "dispatch" }),
  ], "CONTRACT_MISMATCH", 0);
});

test("rejects identity drift, stale from-state and transitions after terminal state", () => {
  const first = activityEvent({ sequence: 1, from: null, to: "dispatch" });
  const identityDrift = activityEvent({ sequence: 2, from: "dispatch", to: "process" });
  identityDrift.identity.workspaceId = "workspace-other";
  expectProjectionFailure([first, identityDrift], "IDENTITY_MISMATCH", 1);

  expectProjectionFailure([
    first,
    activityEvent({ sequence: 2, from: "gate", to: "process" }),
  ], "STATE_MISMATCH", 1);
  const brokenCausation = activityEvent({ sequence: 2, from: "dispatch", to: "process" });
  brokenCausation.causationId = "event-other";
  expectProjectionFailure([first, brokenCausation], "CAUSATION_MISMATCH", 1);
  expectProjectionFailure([
    activityEvent({ sequence: 1, from: null, to: "gate" }),
  ], "INVALID_TRANSITION", 0);
  expectProjectionFailure([
    first,
    activityEvent({ sequence: 2, from: "dispatch", to: "done" }),
    activityEvent({ sequence: 3, from: "done", to: "process" }),
  ], "TERMINAL_STATE", 2);
});

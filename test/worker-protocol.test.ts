import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  WORKER_PROTOCOL_ID,
  WORKER_PROTOCOL_MAX_MESSAGE_BYTES,
  WORKER_PROTOCOL_MESSAGE_TYPES,
  WORKER_PROTOCOL_VERSION,
  negotiateWorkerProtocolVersion,
  validateWorkerProtocolMessage,
  type WorkerProtocolMessage,
  type WorkerProtocolPeer,
  type WorkerProtocolValidationContext,
} from "../src/worker-protocol.ts";

const now = "2026-08-28T20:00:00.000Z";
const worker: WorkerProtocolPeer = { kind: "worker", id: "worker-local-1", instanceId: "worker-instance-1" };
const control: WorkerProtocolPeer = { kind: "control-plane", id: "control-main", instanceId: "control-instance-1" };

function workerMessage(
  messageType: "worker.hello" | "worker.heartbeat" | "worker.ack" | "worker.reject" = "worker.hello",
): WorkerProtocolMessage {
  const bodies = {
    "worker.hello": {
      workerSessionId: "worker-session-1",
      hostId: "windows-host-1",
      platform: "windows",
      agentVersion: "0.1.0",
      supportedProtocolVersions: ["1.0"],
      capabilities: [
        { id: "process.spawn.scoped", version: "1.0.0" },
        { id: "workspace.dedicated", version: "1.0.0" },
      ],
      startedAt: "2026-08-28T19:55:00.000Z",
    },
    "worker.heartbeat": {
      workerSessionId: "worker-session-1",
      status: "busy",
      observedAt: "2026-08-28T19:59:50.000Z",
      leaseExpiresAt: "2026-08-28T20:00:20.000Z",
      runningDispatchIds: ["dispatch-1"],
    },
    "worker.ack": {
      ackedMessageId: "control-message-1",
      disposition: "accepted",
      dispatchId: "dispatch-1",
    },
    "worker.reject": {
      rejectedMessageId: "control-message-1",
      code: "INVALID_BODY",
      retryable: false,
    },
  } as const;

  return {
    protocol: WORKER_PROTOCOL_ID,
    protocolVersion: WORKER_PROTOCOL_VERSION,
    messageId: `message-${messageType.replace(".", "-")}`,
    messageType,
    sender: worker,
    recipient: control,
    issuedAt: "2026-08-28T19:59:30.000Z",
    expiresAt: "2026-08-28T20:01:00.000Z",
    sequence: 1,
    correlationId: "correlation-1",
    security: {
      scheme: "transport-bound-v1",
      credentialId: "worker-credential-1",
      nonce: `nonce-${messageType}-1234567890`,
      proof: "verified-proof-material-1",
    },
    body: structuredClone(bodies[messageType]),
  } as WorkerProtocolMessage;
}

function dispatchMessage(): WorkerProtocolMessage {
  const requiredCapabilities = ["process.spawn.scoped", "workspace.dedicated"];
  const scopes = [
    "message:control.dispatch",
    "dispatch:create",
    "contract:MORROW-MVO-001",
    "step:P2-PR01",
    "target:morrow-core",
    ...requiredCapabilities.map((capability) => `capability:${capability}`),
  ];

  return {
    protocol: WORKER_PROTOCOL_ID,
    protocolVersion: WORKER_PROTOCOL_VERSION,
    messageId: "control-message-1",
    messageType: "control.dispatch",
    sender: control,
    recipient: worker,
    issuedAt: "2026-08-28T19:59:30.000Z",
    expiresAt: "2026-08-28T20:01:00.000Z",
    sequence: 8,
    correlationId: "correlation-1",
    security: {
      scheme: "transport-bound-v1",
      credentialId: "control-credential-1",
      nonce: "nonce-control-dispatch-123456",
      proof: "verified-proof-material-control",
    },
    authorization: {
      decisionId: "authorization-decision-1",
      scopes,
      expiresAt: "2026-08-28T20:02:00.000Z",
    },
    body: {
      dispatchId: "dispatch-1",
      idempotencyKey: "dispatch-effect-1",
      contractId: "MORROW-MVO-001",
      stepId: "P2-PR01",
      targetId: "morrow-core",
      kind: "process",
      workSpec: {
        artifactId: "work-spec-1",
        sha256: "a".repeat(64),
      },
      workspace: {
        workspaceId: "workspace-contract-1-agent-1",
        isolation: "dedicated",
      },
      requiredCapabilities,
      timeoutMs: 60_000,
    },
  };
}

function cancelMessage(): WorkerProtocolMessage {
  const message = dispatchMessage();
  const scopes = ["message:control.cancel", "dispatch:cancel", "dispatch:dispatch-1"];
  return {
    ...message,
    messageId: "cancel-message-1",
    messageType: "control.cancel",
    security: { ...message.security, nonce: "nonce-control-cancel-12345678" },
    authorization: {
      decisionId: "cancel-decision-1",
      scopes,
      expiresAt: "2026-08-28T20:02:00.000Z",
    },
    body: {
      dispatchId: "dispatch-1",
      idempotencyKey: "cancel-effect-1",
      mode: "force-after-timeout",
      reasonCode: "operator_requested",
      gracePeriodMs: 5_000,
    },
  };
}

function validationContext(message: WorkerProtocolMessage): WorkerProtocolValidationContext {
  return {
    now,
    supportedVersions: ["1.0"],
    authenticatedPeer: message.sender,
    localPeer: message.recipient,
    verifiedCredentialId: message.security.credentialId,
    verifiedAuthorization: message.authorization
      ? {
          decisionId: message.authorization.decisionId,
          scopes: message.authorization.scopes,
          expiresAt: message.authorization.expiresAt,
        }
      : null,
    authorizedMessageTypes: [...WORKER_PROTOCOL_MESSAGE_TYPES],
    seenMessageIds: new Set(),
    seenNonces: new Set(),
  };
}

test("worker protocol schema and executable constants stay aligned", async () => {
  const schema = JSON.parse(await readFile(join(process.cwd(), "schema", "worker-control.v1.schema.json"), "utf8"));

  assert.equal(schema.properties.protocol.const, WORKER_PROTOCOL_ID);
  assert.equal(schema.properties.protocolVersion.const, WORKER_PROTOCOL_VERSION);
  assert.deepEqual(schema.properties.messageType.enum, [...WORKER_PROTOCOL_MESSAGE_TYPES]);
  assert.equal(WORKER_PROTOCOL_MAX_MESSAGE_BYTES, 262_144);
});

test("protocol negotiation chooses only the highest exact common version", () => {
  assert.deepEqual(
    negotiateWorkerProtocolVersion(["1.0", "1.1", "2.0"], ["1.0", "1.1"]),
    { ok: true, version: "1.1" },
  );
  assert.deepEqual(
    negotiateWorkerProtocolVersion(["1.0"], ["1.1"]),
    { ok: false, reason: "no_common_version" },
  );
  assert.deepEqual(
    negotiateWorkerProtocolVersion(["v1"], ["1.0"]),
    { ok: false, reason: "invalid_version" },
  );
});

test("accepts an authenticated worker hello with explicit capabilities", () => {
  const message = workerMessage();
  const result = validateWorkerProtocolMessage(message, validationContext(message));

  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.requiredScopes, ["message:worker.hello"]);
});

test("accepted messages are detached and frozen after validation", () => {
  const message = workerMessage();
  const result = validateWorkerProtocolMessage(message, validationContext(message));
  assert.equal(result.ok, true);
  if (!result.ok) return;

  (message.body as { hostId: string }).hostId = "mutated-host";
  assert.equal((result.message.body as { hostId: string }).hostId, "windows-host-1");
  assert.equal(Object.isFrozen(result.message), true);
  assert.equal(Object.isFrozen(result.message.body), true);
});

test("rejects every missing required envelope field", () => {
  const required = [
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
  ];

  for (const field of required) {
    const message = workerMessage() as unknown as Record<string, unknown>;
    delete message[field];
    const result = validateWorkerProtocolMessage(message, validationContext(workerMessage()));
    assert.deepEqual(result, {
      ok: false,
      code: "INVALID_ENVELOPE",
      detail: `missing_field:${field}`,
    });
  }
});

test("accepts a dispatch only when authorization covers contract, step, target and capabilities", () => {
  const message = dispatchMessage();
  const result = validateWorkerProtocolMessage(message, validationContext(message));

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.requiredScopes.includes("contract:MORROW-MVO-001"));
    assert.ok(result.requiredScopes.includes("capability:process.spawn.scoped"));
  }
});

test("rejects raw commands and other undeclared dispatch fields", () => {
  const message = dispatchMessage() as WorkerProtocolMessage & { body: Record<string, unknown> };
  message.body.rawCommand = "powershell -Command Get-ChildItem";
  const result = validateWorkerProtocolMessage(message, validationContext(message));

  assert.deepEqual(result, { ok: false, code: "INVALID_BODY", detail: "unknown_field:rawCommand" });
});

test("rejects dispatch when a required capability scope is absent", () => {
  const message = dispatchMessage();
  message.authorization!.scopes = message.authorization!.scopes.filter(
    (scope) => scope !== "capability:workspace.dedicated",
  );
  const context = validationContext(message);
  const result = validateWorkerProtocolMessage(message, context);

  assert.deepEqual(result, {
    ok: false,
    code: "AUTHORIZATION_MISMATCH",
    detail: "scope_missing:capability:workspace.dedicated",
  });
});

test("rejects unauthenticated senders and identities not bound to the transport", () => {
  const message = workerMessage();
  const unauthenticated = validationContext(message);
  unauthenticated.authenticatedPeer = null;
  unauthenticated.verifiedCredentialId = null;
  assert.equal(validateWorkerProtocolMessage(message, unauthenticated).ok, false);

  const wrongPeer = validationContext(message);
  wrongPeer.authenticatedPeer = { ...worker, instanceId: "other-instance" };
  const result = validateWorkerProtocolMessage(message, wrongPeer);
  assert.deepEqual(result, {
    ok: false,
    code: "IDENTITY_MISMATCH",
    detail: "message_peer_not_bound_to_transport",
  });
});

test("rejects unsupported versions and reversed message direction", () => {
  const unsupported = workerMessage();
  unsupported.protocolVersion = "2.0";
  assert.equal(validateWorkerProtocolMessage(unsupported, validationContext(unsupported)).ok, false);

  const reversed = workerMessage();
  reversed.sender = control;
  reversed.recipient = worker;
  const result = validateWorkerProtocolMessage(reversed, validationContext(reversed));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "INVALID_DIRECTION");
});

test("rejects expired, future, overlong and replayed envelopes", () => {
  const expired = workerMessage();
  expired.issuedAt = "2026-08-28T19:58:00.000Z";
  expired.expiresAt = "2026-08-28T19:59:00.000Z";
  assert.equal((validateWorkerProtocolMessage(expired, validationContext(expired)) as { code: string }).code, "MESSAGE_EXPIRED");

  const future = workerMessage();
  future.issuedAt = "2026-08-28T20:01:00.000Z";
  future.expiresAt = "2026-08-28T20:02:00.000Z";
  assert.equal((validateWorkerProtocolMessage(future, validationContext(future)) as { code: string }).code, "MESSAGE_FROM_FUTURE");

  const overlong = workerMessage();
  overlong.issuedAt = "2026-08-28T19:59:30.000Z";
  overlong.expiresAt = "2026-08-28T20:10:00.000Z";
  assert.equal((validateWorkerProtocolMessage(overlong, validationContext(overlong)) as { code: string }).code, "TTL_EXCEEDED");

  const replayed = workerMessage();
  const replayContext = validationContext(replayed);
  replayContext.seenMessageIds = new Set([replayed.messageId]);
  assert.equal((validateWorkerProtocolMessage(replayed, replayContext) as { code: string }).code, "REPLAY_DETECTED");

  const outOfOrder = workerMessage();
  const orderingContext = validationContext(outOfOrder);
  orderingContext.lastAcceptedSequence = outOfOrder.sequence;
  assert.equal((validateWorkerProtocolMessage(outOfOrder, orderingContext) as { code: string }).code, "OUT_OF_ORDER");
});

test("hello advertises its envelope version and cannot claim a future start", () => {
  const missingVersion = workerMessage();
  (missingVersion.body as { supportedProtocolVersions: string[] }).supportedProtocolVersions = ["2.0"];
  assert.equal(validateWorkerProtocolMessage(missingVersion, validationContext(missingVersion)).ok, false);

  const futureStart = workerMessage();
  (futureStart.body as { startedAt: string }).startedAt = "2026-08-28T20:00:00.000Z";
  const result = validateWorkerProtocolMessage(futureStart, validationContext(futureStart));
  assert.deepEqual(result, { ok: false, code: "INVALID_BODY", detail: "hello_started_after_message" });
});

test("heartbeat requires a forward lease and bounded unique dispatch ids", () => {
  const validHeartbeat = workerMessage("worker.heartbeat");
  assert.equal(validateWorkerProtocolMessage(validHeartbeat, validationContext(validHeartbeat)).ok, true);

  const heartbeat = workerMessage("worker.heartbeat");
  const body = heartbeat.body as { observedAt: string; leaseExpiresAt: string };
  body.leaseExpiresAt = body.observedAt;
  const result = validateWorkerProtocolMessage(heartbeat, validationContext(heartbeat));

  assert.deepEqual(result, { ok: false, code: "INVALID_BODY", detail: "heartbeat_lease_invalid" });

  const overlong = workerMessage("worker.heartbeat");
  const overlongBody = overlong.body as { observedAt: string; leaseExpiresAt: string };
  overlongBody.leaseExpiresAt = "2026-08-28T20:02:30.000Z";
  assert.equal(validateWorkerProtocolMessage(overlong, validationContext(overlong)).ok, false);
});

test("rejects inherited envelope fields instead of trusting object prototypes", () => {
  const message = workerMessage();
  const crafted = Object.create(message) as WorkerProtocolMessage;
  const result = validateWorkerProtocolMessage(crafted, validationContext(message));

  assert.deepEqual(result, { ok: false, code: "INVALID_ENVELOPE", detail: "message_must_be_object" });
});

test("cancel is accepted only with a verified dispatch-specific authorization", () => {
  const message = cancelMessage();
  assert.equal(validateWorkerProtocolMessage(message, validationContext(message)).ok, true);

  message.authorization!.scopes = message.authorization!.scopes.filter(
    (scope) => scope !== "dispatch:dispatch-1",
  );
  const result = validateWorkerProtocolMessage(message, validationContext(message));
  assert.deepEqual(result, {
    ok: false,
    code: "AUTHORIZATION_MISMATCH",
    detail: "scope_missing:dispatch:dispatch-1",
  });
});

test("worker ack and structured rejection validate without control authorization claims", () => {
  const ack = workerMessage("worker.ack");
  const reject = workerMessage("worker.reject");

  assert.equal(validateWorkerProtocolMessage(ack, validationContext(ack)).ok, true);
  assert.equal(validateWorkerProtocolMessage(reject, validationContext(reject)).ok, true);
});

import { open } from "node:fs/promises";
import { WorkerRecoveryCoordinator, type WorkerRecoveryAttemptRequest } from "../../src/worker-recovery.ts";
import {
  WORKER_PROTOCOL_ID,
  WORKER_PROTOCOL_VERSION,
  type WorkerProtocolMessage,
  type WorkerProtocolPeer,
  type WorkerProtocolValidationContext,
} from "../../src/worker-protocol.ts";

const mode = process.argv[2];
const stateRoot = process.argv[3];
const effectPath = process.argv[4];
const now = "2026-08-29T12:00:00.000Z";
const workerSessionId = `worker-session-${process.pid}`;
const worker: WorkerProtocolPeer = {
  kind: "worker",
  id: "worker-local-1",
  instanceId: `worker-instance-${process.pid}`,
};
const control: WorkerProtocolPeer = { kind: "control-plane", id: "control-main", instanceId: "control-instance-1" };

if (!mode || !stateRoot || !effectPath) throw new Error("worker_recovery_fixture_arguments_missing");

function dispatchMessage(): WorkerProtocolMessage {
  const requiredCapabilities = ["process.spawn.scoped", "workspace.dedicated"];
  const scopes = [
    "message:control.dispatch",
    "dispatch:create",
    "contract:MORROW-MVO-001",
    "step:P2-PR06",
    "target:morrow-core",
    ...requiredCapabilities.map((capability) => `capability:${capability}`),
  ];
  return {
    protocol: WORKER_PROTOCOL_ID,
    protocolVersion: WORKER_PROTOCOL_VERSION,
    messageId: "control-dispatch-fixture-1",
    messageType: "control.dispatch",
    sender: control,
    recipient: worker,
    issuedAt: "2026-08-29T11:59:50.000Z",
    expiresAt: "2026-08-29T12:01:00.000Z",
    sequence: 1,
    correlationId: "recovery-fixture-1",
    security: {
      scheme: "transport-bound-v1",
      credentialId: "control-credential-1",
      nonce: "recovery-dispatch-nonce-1234567890",
      proof: "fixture-security-proof-never-persist",
    },
    authorization: {
      decisionId: "recovery-authorization-1",
      scopes,
      expiresAt: "2026-08-29T12:02:00.000Z",
    },
    body: {
      dispatchId: "dispatch-recovery-1",
      idempotencyKey: "effect-recovery-1",
      contractId: "MORROW-MVO-001",
      stepId: "P2-PR06",
      targetId: "morrow-core",
      kind: "process",
      workSpec: { artifactId: "recovery-work-spec", sha256: "a".repeat(64) },
      workspace: { workspaceId: "workspace-recovery-1", isolation: "dedicated" },
      requiredCapabilities,
      timeoutMs: 60_000,
    },
  };
}

function workerMessage(messageType: "worker.hello" | "worker.heartbeat"): WorkerProtocolMessage {
  return {
    protocol: WORKER_PROTOCOL_ID,
    protocolVersion: WORKER_PROTOCOL_VERSION,
    messageId: `recovery-${messageType.replace(".", "-")}-${process.pid}`,
    messageType,
    sender: worker,
    recipient: control,
    issuedAt: "2026-08-29T11:59:50.000Z",
    expiresAt: "2026-08-29T12:01:00.000Z",
    sequence: messageType === "worker.hello" ? 1 : 2,
    correlationId: "recovery-fixture-1",
    security: {
      scheme: "transport-bound-v1",
      credentialId: "worker-credential-1",
      nonce: `recovery-${messageType.replace(".", "-")}-nonce-${process.pid}-1234567890`,
      proof: "fixture-worker-proof-never-persist",
    },
    body: messageType === "worker.hello"
      ? {
          workerSessionId,
          hostId: "windows-host-1",
          platform: "windows",
          agentVersion: "0.1.0",
          supportedProtocolVersions: [WORKER_PROTOCOL_VERSION],
          capabilities: [
            { id: "process.spawn.scoped", version: "1.0.0" },
            { id: "workspace.dedicated", version: "1.0.0" },
          ],
          startedAt: "2026-08-29T11:55:00.000Z",
        }
      : {
          workerSessionId,
          status: "ready",
          observedAt: "2026-08-29T11:59:55.000Z",
          leaseExpiresAt: "2026-08-29T12:01:00.000Z",
          runningDispatchIds: [],
        },
  } as WorkerProtocolMessage;
}

function validationContext(input: unknown): WorkerProtocolValidationContext {
  const message = input as WorkerProtocolMessage;
  return {
    now,
    supportedVersions: [WORKER_PROTOCOL_VERSION],
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
    authorizedMessageTypes: ["control.dispatch", "worker.hello", "worker.heartbeat"],
    seenMessageIds: new Set(),
    seenNonces: new Set(),
  };
}

async function executeEffect(request: WorkerRecoveryAttemptRequest) {
  const handle = await open(effectPath, "wx", 0o600);
  await handle.writeFile(`${request.body.dispatchId}\n`, "utf8");
  await handle.sync();
  await handle.close();
  if (mode === "crash-after-effect") process.exit(91);
  return {
    ok: true as const,
    duplicate: false,
    execution: {
      dispatchId: request.body.dispatchId,
      idempotencyKey: request.body.idempotencyKey,
      kind: request.body.kind,
      status: "completed" as const,
      workspaceId: request.body.workspace.workspaceId,
      workspaceRoot: "fixture-managed-workspace",
      exitCode: 0,
      timedOut: false,
      durationMs: 1,
      stdout: "fixture-output-never-persist",
      stderr: "",
      agentInstance: null,
      routing: null,
    },
  };
}

const coordinator = await WorkerRecoveryCoordinator.open({
  workerId: worker.id,
  stateRoot,
  validationContext,
  attempt: executeEffect,
  clock: () => now,
});

if (mode === "queue" || mode === "crash-after-effect") {
  const accepted = await coordinator.accept(dispatchMessage());
  if (!accepted.ok) throw new Error(`fixture_dispatch_rejected:${accepted.code}`);
}

if (mode === "drain" || mode === "crash-after-effect") {
  const hello = await coordinator.observe(workerMessage("worker.hello"));
  if (!hello.ok) throw new Error(`fixture_hello_rejected:${hello.code}`);
  const heartbeat = await coordinator.observe(workerMessage("worker.heartbeat"));
  if (!heartbeat.ok) throw new Error(`fixture_heartbeat_rejected:${heartbeat.code}`);
}

process.stdout.write(`${JSON.stringify(coordinator.inspect())}\n`);

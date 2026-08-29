import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import type { AuthenticatedDispatchResult } from "../src/authenticated-dispatch.ts";
import {
  WorkerRecoveryCoordinator,
  type WorkerRecoveryAttemptRequest,
} from "../src/worker-recovery.ts";
import {
  WORKER_PROTOCOL_ID,
  WORKER_PROTOCOL_VERSION,
  type WorkerProtocolMessage,
  type WorkerProtocolPeer,
  type WorkerProtocolValidationContext,
} from "../src/worker-protocol.ts";

const now = "2026-08-29T12:00:00.000Z";
const worker: WorkerProtocolPeer = { kind: "worker", id: "worker-local-1", instanceId: "worker-instance-1" };
const control: WorkerProtocolPeer = { kind: "control-plane", id: "control-main", instanceId: "control-instance-1" };

function dispatchMessage(suffix = "1", bodyOverrides: Record<string, unknown> = {}): WorkerProtocolMessage {
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
    messageId: `control-dispatch-${suffix}`,
    messageType: "control.dispatch",
    sender: control,
    recipient: worker,
    issuedAt: "2026-08-29T11:59:50.000Z",
    expiresAt: "2026-08-29T12:01:00.000Z",
    sequence: Number(suffix.replace(/\D/g, "")) || 1,
    correlationId: `recovery-${suffix}`,
    security: {
      scheme: "transport-bound-v1",
      credentialId: "control-credential-1",
      nonce: `control-dispatch-${suffix}-nonce-1234567890`,
      proof: "sensitive-control-proof-must-not-persist",
    },
    authorization: {
      decisionId: `recovery-authorization-${suffix}`,
      scopes,
      expiresAt: "2026-08-29T12:02:00.000Z",
    },
    body: {
      dispatchId: `dispatch-recovery-${suffix}`,
      idempotencyKey: `effect-recovery-${suffix}`,
      contractId: "MORROW-MVO-001",
      stepId: "P2-PR06",
      targetId: "morrow-core",
      kind: "process",
      workSpec: { artifactId: "recovery-work-spec", sha256: "a".repeat(64) },
      workspace: { workspaceId: `workspace-recovery-${suffix}`, isolation: "dedicated" },
      requiredCapabilities,
      timeoutMs: 60_000,
      ...bodyOverrides,
    },
  } as WorkerProtocolMessage;
}

function workerMessage(
  messageType: "worker.hello" | "worker.heartbeat",
  session = "worker-session-1",
  leaseExpiresAt = "2026-08-29T12:01:00.000Z",
): WorkerProtocolMessage {
  return {
    protocol: WORKER_PROTOCOL_ID,
    protocolVersion: WORKER_PROTOCOL_VERSION,
    messageId: `${messageType.replace(".", "-")}-${session}`,
    messageType,
    sender: worker,
    recipient: control,
    issuedAt: "2026-08-29T11:59:50.000Z",
    expiresAt: "2026-08-29T12:01:30.000Z",
    sequence: messageType === "worker.hello" ? 1 : 2,
    correlationId: `recovery-${session}`,
    security: {
      scheme: "transport-bound-v1",
      credentialId: "worker-credential-1",
      nonce: `${messageType.replace(".", "-")}-${session}-nonce-1234567890`,
      proof: "sensitive-worker-proof-must-not-persist",
    },
    body: messageType === "worker.hello"
      ? {
          workerSessionId: session,
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
          workerSessionId: session,
          status: "ready",
          observedAt: "2026-08-29T11:59:55.000Z",
          leaseExpiresAt,
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

function success(request: WorkerRecoveryAttemptRequest, stdout = "sensitive-execution-output") {
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
      stdout,
      stderr: "",
      agentInstance: null,
      routing: null,
    },
  };
}

async function makeRoot(t: { after(callback: () => void | Promise<void>): void }) {
  const root = await mkdtemp(join(tmpdir(), "morrow-p2-pr06-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, stateRoot: join(root, ".morrow", "recovery") };
}

async function openCoordinator(
  stateRoot: string,
  attempt: (request: WorkerRecoveryAttemptRequest) => Promise<AuthenticatedDispatchResult>,
  clock: () => string | number | Date = () => now,
  maxDispatchRecords?: number,
) {
  return await WorkerRecoveryCoordinator.open({
    workerId: worker.id,
    stateRoot,
    validationContext,
    attempt,
    clock,
    maxDispatchRecords,
  });
}

async function connect(coordinator: WorkerRecoveryCoordinator, session = "worker-session-1") {
  const hello = await coordinator.observe(workerMessage("worker.hello", session));
  assert.equal(hello.ok, true);
  assert.equal(coordinator.inspect().connectivity, "connecting");
  const heartbeat = await coordinator.observe(workerMessage("worker.heartbeat", session));
  assert.equal(heartbeat.ok, true);
}

test("queues governed work while offline and dispatches only after authenticated heartbeat", async (t) => {
  const { stateRoot } = await makeRoot(t);
  const attempts: string[] = [];
  const coordinator = await openCoordinator(stateRoot, async (request) => {
    attempts.push(request.attemptId);
    return success(request);
  });

  const accepted = await coordinator.accept(dispatchMessage());
  assert.equal(accepted.ok, true);
  assert.equal(attempts.length, 0);
  assert.equal(coordinator.inspect().dispatches[0]?.status, "queued");
  assert.equal(coordinator.inspect().dispatches[0]?.reason, "worker_offline");

  await connect(coordinator);
  assert.equal(attempts.length, 1);
  assert.equal(coordinator.inspect().connectivity, "online");
  assert.equal(coordinator.inspect().dispatches[0]?.status, "completed");
});

test("deduplicates a completed effect and rejects idempotency rebinding", async (t) => {
  const { stateRoot } = await makeRoot(t);
  let effects = 0;
  const coordinator = await openCoordinator(stateRoot, async (request) => {
    effects += 1;
    return success(request);
  });
  await connect(coordinator);

  const first = await coordinator.accept(dispatchMessage("1"));
  const duplicate = await coordinator.accept(dispatchMessage("2", {
    dispatchId: "dispatch-recovery-1",
    idempotencyKey: "effect-recovery-1",
    workspace: { workspaceId: "workspace-recovery-1", isolation: "dedicated" },
  }));
  const conflict = await coordinator.accept(dispatchMessage("3", {
    dispatchId: "dispatch-recovery-3",
    idempotencyKey: "effect-recovery-1",
  }));

  assert.equal(first.ok, true);
  assert.deepEqual(duplicate.ok && { duplicate: duplicate.duplicate, status: duplicate.dispatch.status }, {
    duplicate: true,
    status: "completed",
  });
  assert.deepEqual(conflict, { ok: false, code: "IDEMPOTENCY_CONFLICT", detail: "idempotency_key_rebound" });
  assert.equal(effects, 1);
});

test("expires heartbeat lease mechanically and keeps pending work out of execution", async (t) => {
  const { stateRoot } = await makeRoot(t);
  let current = Date.parse(now);
  let effects = 0;
  const coordinator = await openCoordinator(stateRoot, async (request) => {
    effects += 1;
    return success(request);
  }, () => current);
  await connect(coordinator);
  current = Date.parse("2026-08-29T12:01:01.000Z");

  const view = await coordinator.sweepLiveness();
  assert.equal(view.connectivity, "offline");
  assert.equal(view.connectivityReason, "heartbeat_lease_expired");
  const accepted = await coordinator.accept(dispatchMessage("lease"));
  assert.equal(accepted.ok, true);
  assert.equal(effects, 0);
  assert.equal(coordinator.inspect().dispatches[0]?.status, "queued");
});

test("persists only governed dispatch data and terminal summaries", async (t) => {
  const { stateRoot } = await makeRoot(t);
  const coordinator = await openCoordinator(stateRoot, async (request) => success(request));
  await connect(coordinator);
  await coordinator.accept(dispatchMessage());

  const raw = await readFile(join(stateRoot, "worker-recovery-v1.json"), "utf8");
  assert.match(raw, /dispatch-recovery-1/);
  assert.doesNotMatch(raw, /sensitive-control-proof/);
  assert.doesNotMatch(raw, /sensitive-worker-proof/);
  assert.doesNotMatch(raw, /sensitive-execution-output/);
  assert.doesNotMatch(raw, /authorization-decision/);
});

test("refuses corrupted durable state instead of guessing recovery", async (t) => {
  const { stateRoot } = await makeRoot(t);
  const coordinator = await openCoordinator(stateRoot, async (request) => success(request));
  await coordinator.accept(dispatchMessage());
  const snapshot = join(stateRoot, "worker-recovery-v1.json");
  const parsed = JSON.parse(await readFile(snapshot, "utf8"));
  parsed.dispatches[0].body.targetId = "tampered-target";
  await writeFile(snapshot, JSON.stringify(parsed), "utf8");
  await coordinator.close();

  await assert.rejects(
    openCoordinator(stateRoot, async (request) => success(request)),
    /worker_recovery_snapshot_invalid/,
  );
});

test("allows only one active coordinator to own a recovery root", async (t) => {
  const { stateRoot } = await makeRoot(t);
  const first = await openCoordinator(stateRoot, async (request) => success(request));
  await assert.rejects(
    openCoordinator(stateRoot, async (request) => success(request)),
    /worker_recovery_coordinator_already_active/,
  );
  await first.close();
  const replacement = await openCoordinator(stateRoot, async (request) => success(request));
  assert.equal(replacement.inspect().connectivity, "offline");
  await replacement.close();
});

test("enforces durable queue capacity without evicting idempotency history", async (t) => {
  const { stateRoot } = await makeRoot(t);
  const coordinator = await openCoordinator(stateRoot, async (request) => success(request), () => now, 1);
  assert.equal((await coordinator.accept(dispatchMessage("1"))).ok, true);
  assert.deepEqual(await coordinator.accept(dispatchMessage("2")), {
    ok: false,
    code: "DISPATCH_CAPACITY_EXHAUSTED",
    detail: "durable_dispatch_capacity_exhausted",
  });
});

test("retries only a declared no-effect rejection with the same idempotency key", async (t) => {
  const { stateRoot } = await makeRoot(t);
  const seenKeys: string[] = [];
  let attempts = 0;
  const coordinator = await openCoordinator(stateRoot, async (request) => {
    attempts += 1;
    seenKeys.push(request.body.idempotencyKey);
    if (attempts === 1) {
      return {
        ok: false,
        duplicate: false,
        code: "LOCK_UNAVAILABLE",
        detail: "fixture_lock_busy",
      };
    }
    return success(request);
  });
  await connect(coordinator);

  const accepted = await coordinator.accept(dispatchMessage());
  assert.equal(accepted.ok, true);
  assert.deepEqual(coordinator.inspect().dispatches.map(({ status, reason, attempts: count }) => ({
    status,
    reason,
    attempts: count,
  })), [{ status: "queued", reason: "waiting:lock_unavailable", attempts: 1 }]);
  await coordinator.drain();
  assert.deepEqual(seenKeys, ["effect-recovery-1", "effect-recovery-1"]);
  assert.equal(coordinator.inspect().dispatches[0]?.status, "completed");
  assert.equal(coordinator.inspect().dispatches[0]?.attempts, 2);
});

test("blocks an unknown attempt outcome and takes the worker offline", async (t) => {
  const { stateRoot } = await makeRoot(t);
  const coordinator = await openCoordinator(stateRoot, async () => {
    throw new Error("simulated_transport_loss_after_dispatch");
  });
  await connect(coordinator);

  const accepted = await coordinator.accept(dispatchMessage());
  assert.equal(accepted.ok, true);
  assert.equal(coordinator.inspect().connectivity, "offline");
  assert.deepEqual(coordinator.inspect().dispatches.map(({ status, reason }) => ({ status, reason })), [{
    status: "blocked",
    reason: "attempt_outcome_unknown",
  }]);
});

test("requires authenticated hello before heartbeat and refuses stale heartbeat lease", async (t) => {
  const { stateRoot } = await makeRoot(t);
  const coordinator = await openCoordinator(stateRoot, async (request) => success(request));

  const premature = await coordinator.observe(workerMessage("worker.heartbeat"));
  assert.deepEqual(premature, {
    ok: false,
    code: "WORKER_SESSION_MISMATCH",
    detail: "heartbeat_session_not_announced",
  });
  await coordinator.observe(workerMessage("worker.hello"));
  const stale = await coordinator.observe(workerMessage(
    "worker.heartbeat",
    "worker-session-1",
    "2026-08-29T12:00:00.000Z",
  ));
  assert.deepEqual(stale, {
    ok: false,
    code: "HEARTBEAT_LEASE_EXPIRED",
    detail: "heartbeat_lease_not_in_future",
  });
  assert.equal(coordinator.inspect().connectivity, "connecting");
});

interface ChildResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

async function runChild(mode: string, stateRoot: string, effectPath: string): Promise<ChildResult> {
  const fixture = join(process.cwd(), "test", "fixtures", "worker-recovery-child.ts");
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", fixture, mode, stateRoot, effectPath], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", rejectPromise);
    child.once("close", (code) => resolvePromise({ code, stdout, stderr }));
  });
}

test("process restart resumes queued work once and never repeats completed effect", async (t) => {
  const { root, stateRoot } = await makeRoot(t);
  const effectPath = join(root, "effect-once.txt");
  const queued = await runChild("queue", stateRoot, effectPath);
  assert.equal(queued.code, 0, queued.stderr);
  assert.equal(JSON.parse(queued.stdout).dispatches[0].status, "queued");

  const drained = await runChild("drain", stateRoot, effectPath);
  assert.equal(drained.code, 0, drained.stderr);
  assert.equal(JSON.parse(drained.stdout).dispatches[0].status, "completed");
  assert.equal(await readFile(effectPath, "utf8"), "dispatch-recovery-1\n");

  const reopened = await runChild("drain", stateRoot, effectPath);
  assert.equal(reopened.code, 0, reopened.stderr);
  assert.equal(JSON.parse(reopened.stdout).dispatches[0].status, "completed");
  assert.equal(await readFile(effectPath, "utf8"), "dispatch-recovery-1\n");
});

test("kill after effect blocks unknown outcome on restart without replay", async (t) => {
  const { root, stateRoot } = await makeRoot(t);
  const effectPath = join(root, "crash-effect.txt");
  const crashed = await runChild("crash-after-effect", stateRoot, effectPath);
  assert.equal(crashed.code, 91, crashed.stderr);
  assert.equal(await readFile(effectPath, "utf8"), "dispatch-recovery-1\n");

  let replayAttempts = 0;
  const reopened = await openCoordinator(stateRoot, async (request) => {
    replayAttempts += 1;
    return success(request);
  });
  assert.deepEqual(reopened.inspect().dispatches.map(({ status, reason, attempts }) => ({ status, reason, attempts })), [{
    status: "blocked",
    reason: "execution_outcome_unknown_after_restart",
    attempts: 1,
  }]);
  await connect(reopened, "worker-session-after-crash");
  assert.equal(replayAttempts, 0);
  assert.equal(await readFile(effectPath, "utf8"), "dispatch-recovery-1\n");

  const nextOnSameTarget = await reopened.accept(dispatchMessage("2"));
  assert.equal(nextOnSameTarget.ok, true);
  assert.equal(replayAttempts, 0);
  assert.deepEqual(reopened.inspect().dispatches.map(({ dispatchId, status, reason }) => ({
    dispatchId,
    status,
    reason,
  })), [
    {
      dispatchId: "dispatch-recovery-1",
      status: "blocked",
      reason: "execution_outcome_unknown_after_restart",
    },
    {
      dispatchId: "dispatch-recovery-2",
      status: "queued",
      reason: "target_blocked_by_unknown_outcome",
    },
  ]);
});

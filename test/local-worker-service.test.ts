import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  LocalWorkerService,
  type LocalWorkerServiceConfiguration,
} from "../src/local-worker-service.ts";

async function harness() {
  const root = await mkdtemp(join(tmpdir(), "morrow-local-worker-service-"));
  const managedRoot = join(root, ".morrow", "workers", "worker-local-1");
  const operatorRoot = join(root, "operator-project");
  await mkdir(operatorRoot, { recursive: true });
  return { root, managedRoot, operatorRoot };
}

function configuration(
  managedRoot: string,
  operatorOwnedRoots: string[] = [],
): LocalWorkerServiceConfiguration {
  return {
    workerId: "worker-local-1",
    managedRoot,
    operatorOwnedRoots,
    supportedProtocolVersions: ["1.0"],
  };
}

test("starts an isolated targetless worker and exposes a local diagnostic", async () => {
  const { managedRoot, operatorRoot } = await harness();
  await writeFile(join(operatorRoot, "operator-note.txt"), "untouched", "utf8");
  const worker = new LocalWorkerService(configuration(managedRoot, [operatorRoot]));

  assert.equal(worker.status().state, "stopped");
  const started = await worker.start();

  assert.equal(started.state, "ready");
  assert.equal(started.targetAccess, "none");
  assert.equal(started.dispatchAccepted, false);
  assert.ok(started.instanceId);
  assert.ok(started.layout?.managedRoot.endsWith("worker-local-1"));
  await access(started.layout!.workspaceRoot);
  await access(started.layout!.diagnosticsRoot);
  assert.equal(await readFile(join(operatorRoot, "operator-note.txt"), "utf8"), "untouched");

  const marker = JSON.parse(await readFile(join(started.layout!.managedRoot, ".morrow-local-worker-root.json"), "utf8"));
  assert.deepEqual(marker, { format: "morrow-local-worker-root/v1", workerId: "worker-local-1" });

  const diagnostic = await worker.diagnose();
  assert.equal(diagnostic.status.state, "ready");
  assert.ok(diagnostic.checks.every((check) => check.passed));
});

test("start and stop are idempotent and a new service instance can restart the owned root", async () => {
  const { managedRoot } = await harness();
  const first = new LocalWorkerService(configuration(managedRoot));
  const started = await first.start();
  const repeatedStart = await first.start();
  assert.equal(repeatedStart.instanceId, started.instanceId);

  const stopped = await first.stop();
  assert.equal(stopped.state, "stopped");
  assert.equal(stopped.instanceId, null);
  assert.equal((await first.stop()).state, "stopped");

  const restartedService = new LocalWorkerService(configuration(managedRoot));
  const restarted = await restartedService.start();
  assert.equal(restarted.state, "ready");
  assert.notEqual(restarted.instanceId, started.instanceId);
  await access(restarted.layout!.workspaceRoot);
});

test("accepts dispatch only while a trusted runtime attachment is live", async () => {
  const { managedRoot } = await harness();
  const worker = new LocalWorkerService(configuration(managedRoot));
  assert.throws(() => worker.attachAuthenticatedDispatch(), /worker_not_ready_for_dispatch_attachment/);
  await worker.start();
  assert.equal(worker.status().dispatchAccepted, false);

  const detach = worker.attachAuthenticatedDispatch();
  assert.equal(worker.status().dispatchAccepted, true);
  assert.throws(() => worker.attachAuthenticatedDispatch(), /worker_dispatch_already_attached/);
  detach();
  detach();
  assert.equal(worker.status().dispatchAccepted, false);

  worker.attachAuthenticatedDispatch();
  assert.equal(worker.status().dispatchAccepted, true);
  assert.equal((await worker.stop()).dispatchAccepted, false);
});

test("a stale detach handle cannot revoke a new post-restart attachment", async () => {
  const { managedRoot } = await harness();
  const worker = new LocalWorkerService(configuration(managedRoot));
  await worker.start();
  const staleDetach = worker.attachAuthenticatedDispatch();

  await worker.stop();
  await worker.start();
  const currentDetach = worker.attachAuthenticatedDispatch();
  staleDetach();
  assert.equal(worker.status().dispatchAccepted, true);

  currentDetach();
  assert.equal(worker.status().dispatchAccepted, false);
});

test("refuses roots outside .morrow, declared operator roots, and hidden target configuration", async () => {
  const { root, managedRoot, operatorRoot } = await harness();

  assert.throws(
    () => new LocalWorkerService(configuration(join(root, "workers", "worker-local-1"))),
    /worker_managed_root_requires_morrow_segment/,
  );
  assert.throws(
    () => new LocalWorkerService(configuration(managedRoot, [join(root, ".morrow")])),
    /worker_managed_root_overlaps_operator_root/,
  );
  assert.throws(
    () => new LocalWorkerService({
      ...configuration(managedRoot, [operatorRoot]),
      targetId: "external-target",
    } as LocalWorkerServiceConfiguration),
    /worker_configuration_unknown_field:targetId/,
  );
  assert.throws(
    () => new LocalWorkerService({
      ...configuration(managedRoot, [operatorRoot]),
      dispatchEnabled: true,
    } as LocalWorkerServiceConfiguration),
    /worker_configuration_unknown_field:dispatchEnabled/,
  );
});

test("refuses to adopt a nonempty or other-worker managed root", async () => {
  const { managedRoot } = await harness();
  await mkdir(managedRoot, { recursive: true });
  await writeFile(join(managedRoot, "operator-file.txt"), "do-not-adopt", "utf8");
  const unowned = new LocalWorkerService(configuration(managedRoot));
  await assert.rejects(unowned.start(), /worker_managed_root_unowned/);
  assert.equal(unowned.status().state, "failed");
  assert.equal(await readFile(join(managedRoot, "operator-file.txt"), "utf8"), "do-not-adopt");

  const { managedRoot: otherManagedRoot } = await harness();
  await mkdir(otherManagedRoot, { recursive: true });
  await writeFile(
    join(otherManagedRoot, ".morrow-local-worker-root.json"),
    JSON.stringify({ format: "morrow-local-worker-root/v1", workerId: "other-worker" }),
    "utf8",
  );
  const otherOwned = new LocalWorkerService(configuration(otherManagedRoot));
  await assert.rejects(otherOwned.start(), /worker_managed_root_owned_by_other_worker/);
});

test("refuses forged managed children instead of following files or links", async () => {
  const { managedRoot } = await harness();
  await mkdir(managedRoot, { recursive: true });
  await writeFile(
    join(managedRoot, ".morrow-local-worker-root.json"),
    JSON.stringify({ format: "morrow-local-worker-root/v1", workerId: "worker-local-1" }),
    "utf8",
  );
  await writeFile(join(managedRoot, "workspaces"), "not-a-directory", "utf8");

  const worker = new LocalWorkerService(configuration(managedRoot));
  await assert.rejects(worker.start(), /worker_managed_child_invalid:workspaces/);
  assert.equal(await readFile(join(managedRoot, "workspaces"), "utf8"), "not-a-directory");
});

test("refuses a symbolic .morrow ancestor before writing through it", async () => {
  const root = await mkdtemp(join(tmpdir(), "morrow-local-worker-symbolic-root-"));
  const externalRoot = join(root, "operator-owned-external-root");
  const symbolicMorrowRoot = join(root, ".morrow");
  await mkdir(externalRoot, { recursive: true });
  await symlink(externalRoot, symbolicMorrowRoot, process.platform === "win32" ? "junction" : "dir");

  const managedRoot = join(symbolicMorrowRoot, "workers", "worker-local-1");
  const worker = new LocalWorkerService(configuration(managedRoot));
  await assert.rejects(worker.start(), /worker_managed_root_symbolic_ancestor_refused/);
  await assert.rejects(access(join(externalRoot, "workers")), { code: "ENOENT" });
});

test("requires a unique protocol version set that includes the accepted worker protocol", async () => {
  const { managedRoot } = await harness();
  assert.throws(
    () => new LocalWorkerService({ ...configuration(managedRoot), supportedProtocolVersions: ["2.0"] }),
    /worker_protocol_versions_invalid/,
  );
  assert.throws(
    () => new LocalWorkerService({ ...configuration(managedRoot), supportedProtocolVersions: ["1.0", "1.0"] }),
    /worker_protocol_versions_invalid/,
  );
});

test("a Local Worker host process can stop and restart without receiving work", async () => {
  const { root, managedRoot } = await harness();
  const configurationPath = join(root, "worker-config.json");
  await writeFile(configurationPath, JSON.stringify(configuration(managedRoot)), "utf8");

  const first = await startHost(configurationPath);
  assert.equal(first.ready.status.state, "ready");
  assert.equal(first.ready.status.targetAccess, "none");
  assert.equal(first.ready.status.dispatchAccepted, false);
  const firstInstanceId = first.ready.status.instanceId;
  await first.stop();

  const second = await startHost(configurationPath);
  assert.equal(second.ready.status.state, "ready");
  assert.notEqual(second.ready.status.instanceId, firstInstanceId);
  await second.stop();
});

async function startHost(configurationPath: string): Promise<{
  ready: { event: string; status: { state: string; instanceId: string | null; targetAccess: string; dispatchAccepted: boolean } };
  stop(): Promise<void>;
}> {
  const hostPath = join(process.cwd(), "src", "local-worker-host.ts");
  const child = spawn(process.execPath, ["--experimental-strip-types", hostPath, configurationPath], {
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let stdout = "";
  let stderr = "";
  let settled = false;

  const ready = await new Promise<{
    event: string;
    status: { state: string; instanceId: string | null; targetAccess: string; dispatchAccepted: boolean };
  }>((resolveReady, rejectReady) => {
    const timeout = setTimeout(() => rejectReady(new Error(`worker_host_ready_timeout:${stderr}`)), 5_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const line = stdout.split(/\r?\n/).find((item) => item.trim() !== "");
      if (!line || settled) return;
      settled = true;
      clearTimeout(timeout);
      resolveReady(JSON.parse(line));
    });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      rejectReady(error);
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      rejectReady(new Error(`worker_host_exited_early:${code}:${stderr}`));
    });
  });

  return {
    ready,
    async stop(): Promise<void> {
      const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveExit) => {
        child.once("exit", (code, signal) => resolveExit({ code, signal }));
      });
      child.stdin.write("NOT_A_COMMAND\nSTOP\n");
      child.stdin.end();
      const result = await exit;
      assert.equal(result.code, 0);
      assert.equal(stdout.includes("LOCAL_WORKER_STOPPED"), true);
    },
  };
}

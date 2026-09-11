import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:net";
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, parse, relative, resolve, sep } from "node:path";

const privateRootFormat = "morrow.worker-private-state/v1" as const;
const lockFormat = "morrow.worker-private-lock/v1" as const;
const lockName = "event-log-anchor.lock";
const workerIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const installationRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const privateStateRegion = join(installationRoot, "private", "worker-installation");

export interface WorkerPrivateStateBootstrap {
  workerId: string;
  privateRoot: string;
  managedRoots: readonly string[];
}

interface PrivateRootMarker {
  format: typeof privateRootFormat;
  workerId: string;
  installationId: string;
}

interface PrivateLockRecord {
  format: typeof lockFormat;
  authorityRef: string;
  eventLogId: string;
  ownerId: string;
  instanceId: string;
  processId: number;
  endpointPort: number;
}

export interface WorkerPrivateStateLock {
  release(): Promise<void>;
}

export function isValidWorkerId(value: unknown): value is string {
  return typeof value === "string" && workerIdPattern.test(value);
}

export function assertValidWorkerId(value: unknown): asserts value is string {
  if (!isValidWorkerId(value)) throw new Error("worker_id_invalid");
}

export class WorkerPrivateStateRoot {
  readonly workerId: string;
  readonly privateRoot: string;
  private readonly managedRoots: readonly string[];
  private marker: PrivateRootMarker | null = null;

  private constructor(configuration: WorkerPrivateStateBootstrap) {
    this.workerId = configuration.workerId;
    this.privateRoot = resolve(configuration.privateRoot);
    this.managedRoots = Object.freeze(configuration.managedRoots.map((root) => resolve(root)));
  }

  static bootstrap(configuration: WorkerPrivateStateBootstrap): WorkerPrivateStateRoot {
    assertBootstrap(configuration);
    return new WorkerPrivateStateRoot(structuredClone(configuration));
  }

  /**
   * Production Local Worker construction. The location is installation-owned;
   * operational configuration can select the worker identity, but not a path.
   */
  static forWorker(workerId: string, managedRoots: readonly string[]): WorkerPrivateStateRoot {
    assertValidWorkerId(workerId);
    if (!Array.isArray(managedRoots)
      || managedRoots.some((root) => typeof root !== "string" || !isAbsolute(root))) {
      throw new Error("worker_private_state_bootstrap_invalid");
    }
    return WorkerPrivateStateRoot.bootstrap({
      workerId,
      privateRoot: join(privateStateRegion, workerId),
      managedRoots,
    });
  }

  static installationDefault(): WorkerPrivateStateRoot {
    return WorkerPrivateStateRoot.bootstrap({
      workerId: "local-worker-installation",
      privateRoot: privateStateRegion,
      managedRoots: [],
    });
  }

  async ensure(): Promise<PrivateRootMarker> {
    await assertPathSafe(this.privateRoot, this.managedRoots);
    await ensureDirectoryTree(this.privateRoot);
    await assertPathSafe(this.privateRoot, this.managedRoots);
    const markerPath = join(this.privateRoot, ".worker-private-state.json");
    let marker: PrivateRootMarker | null = null;
    try {
      const markerEntry = await lstat(markerPath);
      if (!markerEntry.isFile() || markerEntry.isSymbolicLink()) throw new Error("worker_private_state_marker_invalid");
      marker = parseMarker(JSON.parse(await readFile(markerPath, "utf8")), this.workerId);
    } catch (error) {
      if (!isNotFound(error)) throw new Error("worker_private_state_marker_invalid");
    }
    if (!marker) {
      const entries = await (await import("node:fs/promises")).readdir(this.privateRoot);
      if (entries.length > 0) {
        try {
          const markerEntry = await lstat(markerPath);
          if (!markerEntry.isFile() || markerEntry.isSymbolicLink()) throw new Error("worker_private_state_marker_invalid");
          marker = parseMarker(JSON.parse(await readFile(markerPath, "utf8")), this.workerId);
        } catch {
          throw new Error("worker_private_state_unowned");
        }
      }
    }
    if (!marker) {
      const candidate: PrivateRootMarker = {
        format: privateRootFormat,
        workerId: this.workerId,
        installationId: randomUUID(),
      };
      try {
        await writeFile(markerPath, JSON.stringify(candidate) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
        marker = candidate;
      } catch (error) {
        if (!isAlreadyExists(error)) throw new Error("worker_private_state_marker_failed");
        marker = parseMarker(JSON.parse(await readFile(markerPath, "utf8")), this.workerId);
      }
    }
    await assertPathSafe(this.privateRoot, this.managedRoots);
    await ensureDirectoryTree(join(this.privateRoot, "locks"));
    if (this.marker && this.marker.installationId !== marker.installationId) {
      throw new Error("worker_private_state_identity_changed");
    }
    this.marker = marker;
    return structuredClone(marker);
  }

  async acquireExclusive(authorityRef: string, eventLogId: string): Promise<WorkerPrivateStateLock> {
    const marker = await this.ensure();
    if (!identifierPattern.test(authorityRef) || !/^[0-9a-f]{64}$/u.test(eventLogId)) {
      throw new Error("worker_private_state_binding_invalid");
    }
    const lockPath = join(this.privateRoot, "locks", authorityRef + "-" + eventLogId + "-" + lockName);
    const endpoint = await listenEndpoint();
    const record: PrivateLockRecord = {
      format: lockFormat,
      authorityRef,
      eventLogId,
      ownerId: randomUUID(),
      instanceId: marker.installationId,
      processId: process.pid,
      endpointPort: endpoint.port,
    };
    try {
      await mkdir(lockPath);
    } catch (error) {
      await closeEndpoint(endpoint.server);
      if (!isAlreadyExists(error)) throw new Error("worker_private_state_lock_failed");
      const existing = await readPrivateLock(lockPath);
      if (existing.authorityRef !== authorityRef || existing.eventLogId !== eventLogId) {
        throw new Error("worker_private_state_lock_invalid");
      }
      if (await endpointIsAlive(existing.endpointPort)) {
        throw new Error("event_log_anchor_cas_conflict");
      }
      const stalePath = `${lockPath}.stale-${randomUUID()}`;
      try {
        await rename(lockPath, stalePath);
      } catch (recoveryError) {
        if (isAlreadyExists(recoveryError) || (recoveryError instanceof Error && "code" in recoveryError && recoveryError.code === "ENOENT")) {
          throw new Error("event_log_anchor_cas_conflict");
        }
        throw new Error("worker_private_state_lock_recovery_required");
      }
      await rm(stalePath, { recursive: true, force: false }).catch(() => {
        throw new Error("worker_private_state_lock_recovery_required");
      });
      return await this.acquireExclusive(authorityRef, eventLogId);
    }
    try {
      await writeFile(join(lockPath, "lease.json"), JSON.stringify(record) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
      return Object.freeze({
        release: async () => {
          const current = await readPrivateLock(lockPath);
          if (current.ownerId !== record.ownerId || current.instanceId !== record.instanceId) {
            throw new Error("worker_private_state_lock_owner_mismatch");
          }
          await closeEndpoint(endpoint.server);
          await unlink(join(lockPath, "lease.json"));
          await (await import("node:fs/promises")).rmdir(lockPath);
        },
      });
    } catch {
      await closeEndpoint(endpoint.server);
      throw new Error("worker_private_state_lock_failed");
    }
  }
}

export function defaultWorkerPrivateStateRoot(): WorkerPrivateStateRoot {
  return WorkerPrivateStateRoot.installationDefault();
}

/**
 * The installation-private region is reserved before any managed-root mkdir.
 * Keep this synchronous: the lexical reservation must happen before a path is
 * created, while the caller performs the existing canonical/reparse checks.
 */
export function assertManagedRootDisjointFromPrivateStateRegion(path: string): void {
  if (typeof path !== "string" || !isAbsolute(path) || pathsOverlap(path, privateStateRegion)) {
    throw new Error("worker_managed_root_overlaps_private_state_region");
  }
}

export function workerPrivateStateRegionPath(): string {
  return privateStateRegion;
}

async function ensureDirectoryTree(path: string): Promise<void> {
  const requested = resolve(path);
  const missing: string[] = [];
  let probe = requested;
  while (true) {
    try {
      await validateDirectory(probe);
      break;
    } catch (error) {
      if (!isNotFound(error)) throw new Error("worker_private_state_path_unsafe");
      const parent = dirname(probe);
      if (parent === probe) throw new Error("worker_private_state_path_unsafe");
      missing.push(probe);
      probe = parent;
    }
  }
  for (const child of missing.reverse()) {
    try {
      await mkdir(child);
    } catch (error) {
      if (!isAlreadyExists(error)) throw new Error("worker_private_state_path_unsafe");
    }
    await validateDirectory(child);
  }
}

async function assertPathSafe(path: string, managedRoots: readonly string[]): Promise<void> {
  const requested = resolve(path);
  for (const managedRoot of managedRoots) {
    if (pathsOverlap(requested, managedRoot)) throw new Error("worker_private_state_inside_managed_root");
  }
  let probe = requested;
  while (true) {
    try {
      await validateDirectory(probe);
      return;
    } catch (error) {
      if (!isNotFound(error)) throw new Error("worker_private_state_path_unsafe");
      const parent = dirname(probe);
      if (parent === probe) throw new Error("worker_private_state_path_unsafe");
      probe = parent;
    }
  }
}

async function validateDirectory(path: string): Promise<void> {
  const entry = await lstat(path);
  if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error("worker_private_state_path_unsafe");
  const canonical = await realpath(path);
  if (normalize(canonical) !== normalize(resolve(path))) throw new Error("worker_private_state_path_unsafe");
}

function parseMarker(value: unknown, workerId: string): PrivateRootMarker {
  if (!isDataRecord(value)
    || Object.keys(value).length !== 3
    || value.format !== privateRootFormat
    || value.workerId !== workerId
    || typeof value.installationId !== "string"
    || !identifierPattern.test(value.installationId)) {
    throw new Error("worker_private_state_marker_invalid");
  }
  return {
    format: privateRootFormat,
    workerId,
    installationId: value.installationId,
  };
}

async function readPrivateLock(lockPath: string): Promise<PrivateLockRecord> {
  let value: unknown;
  try {
    const lockEntry = await lstat(lockPath);
    const leaseEntry = await lstat(join(lockPath, "lease.json"));
    if (!lockEntry.isDirectory() || lockEntry.isSymbolicLink() || !leaseEntry.isFile() || leaseEntry.isSymbolicLink()) {
      throw new Error("worker_private_state_lock_invalid");
    }
    value = JSON.parse(await readFile(join(lockPath, "lease.json"), "utf8"));
  } catch {
    throw new Error("worker_private_state_lock_invalid");
  }
  if (!isDataRecord(value)
    || Object.keys(value).length !== 7
    || value.format !== lockFormat
    || typeof value.authorityRef !== "string"
    || typeof value.eventLogId !== "string"
    || typeof value.ownerId !== "string"
    || typeof value.instanceId !== "string"
    || !Number.isSafeInteger(value.processId)
    || !Number.isSafeInteger(value.endpointPort)
    || !identifierPattern.test(value.authorityRef)
    || !/^[0-9a-f]{64}$/u.test(value.eventLogId)
    || !identifierPattern.test(value.ownerId)
    || !identifierPattern.test(value.instanceId)
    || value.processId < 1
    || value.endpointPort < 1
    || value.endpointPort > 65_535) {
    throw new Error("worker_private_state_lock_invalid");
  }
  return value as unknown as PrivateLockRecord;
}

async function listenEndpoint(): Promise<{ server: Server; port: number }> {
  const server = createServer((socket) => socket.destroy());
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => resolvePromise());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await closeEndpoint(server);
    throw new Error("worker_private_state_endpoint_failed");
  }
  server.unref();
  return { server, port: address.port };
}

async function endpointIsAlive(port: number): Promise<boolean> {
  const { createConnection } = await import("node:net");
  return await new Promise<boolean>((resolvePromise) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const finish = (alive: boolean) => {
      socket.destroy();
      resolvePromise(alive);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(250, () => finish(false));
  });
}

async function closeEndpoint(server: Server): Promise<void> {
  server.closeAllConnections?.();
  await new Promise<void>((resolvePromise) => {
    server.close(() => resolvePromise());
  }).catch(() => undefined);
}

function assertBootstrap(configuration: WorkerPrivateStateBootstrap): void {
  if (!isDataRecord(configuration)
    || !isValidWorkerId(configuration.workerId)
    || typeof configuration.privateRoot !== "string"
    || !isAbsolute(configuration.privateRoot)
    || !Array.isArray(configuration.managedRoots)
    || configuration.managedRoots.some((root) => typeof root !== "string" || !isAbsolute(root))) {
    throw new Error("worker_private_state_bootstrap_invalid");
  }
}

function pathsOverlap(left: string, right: string): boolean {
  return isWithin(left, right) || isWithin(right, left);
}

function isWithin(candidate: string, root: string): boolean {
  const rel = relative(normalize(root), normalize(candidate));
  return rel === "" || (!rel.startsWith(".." + sep) && rel !== ".." && !isAbsolute(rel));
}

function normalize(path: string): string {
  const resolved = resolve(path);
  return process.platform === "win32" ? resolved.toLocaleLowerCase("en-US") : resolved;
}

function isAbsolute(path: string): boolean {
  return parse(path).root.length > 0;
}

function isDataRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

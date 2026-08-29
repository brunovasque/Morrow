import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { WORKER_PROTOCOL_VERSION } from "./worker-protocol.ts";

export type LocalWorkerServiceState = "stopped" | "starting" | "ready" | "stopping" | "failed";

export interface LocalWorkerServiceConfiguration {
  workerId: string;
  managedRoot: string;
  operatorOwnedRoots: string[];
  supportedProtocolVersions: string[];
  dispatchEnabled?: boolean;
}

export interface LocalWorkerLayout {
  managedRoot: string;
  stateRoot: string;
  workspaceRoot: string;
  diagnosticsRoot: string;
}

export interface LocalWorkerServiceStatus {
  workerId: string;
  instanceId: string | null;
  state: LocalWorkerServiceState;
  startedAt: string | null;
  stoppedAt: string | null;
  failure: string | null;
  layout: LocalWorkerLayout | null;
  targetAccess: "none";
  dispatchAccepted: boolean;
  supportedProtocolVersions: string[];
}

export interface LocalWorkerDiagnostic {
  status: LocalWorkerServiceStatus;
  checks: Array<{ id: string; passed: boolean; detail: string }>;
}

interface ManagedRootMarker {
  format: "morrow-local-worker-root/v1";
  workerId: string;
}

const markerName = ".morrow-local-worker-root.json";
const workerIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const protocolVersionPattern = /^\d+\.\d+$/;

export class LocalWorkerService {
  private readonly configuration: LocalWorkerServiceConfiguration;
  private state: LocalWorkerServiceState = "stopped";
  private instanceId: string | null = null;
  private startedAt: string | null = null;
  private stoppedAt: string | null = null;
  private failure: string | null = null;
  private layout: LocalWorkerLayout | null = null;
  private startOperation: Promise<LocalWorkerServiceStatus> | null = null;

  constructor(configuration: LocalWorkerServiceConfiguration) {
    assertConfiguration(configuration);
    this.configuration = deepFreeze(structuredClone(configuration));
  }

  async start(): Promise<LocalWorkerServiceStatus> {
    if (this.state === "ready") return this.status();
    if (this.startOperation) return this.startOperation;
    if (this.state === "stopping") throw new Error("worker_stop_in_progress");

    this.state = "starting";
    this.failure = null;
    this.startOperation = this.startInternal();
    try {
      return await this.startOperation;
    } finally {
      this.startOperation = null;
    }
  }

  async stop(): Promise<LocalWorkerServiceStatus> {
    if (this.state === "stopped") return this.status();
    if (this.state === "starting") throw new Error("worker_start_in_progress");

    this.state = "stopping";
    // P2-PR02 has no child process, dispatch or transport to terminate. Those resources are added only later.
    this.state = "stopped";
    this.stoppedAt = new Date().toISOString();
    this.instanceId = null;
    return this.status();
  }

  status(): LocalWorkerServiceStatus {
    return deepFreeze({
      workerId: this.configuration.workerId,
      instanceId: this.instanceId,
      state: this.state,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      failure: this.failure,
      layout: this.layout ? { ...this.layout } : null,
      targetAccess: "none" as const,
      dispatchAccepted: this.state === "ready" && this.configuration.dispatchEnabled === true,
      supportedProtocolVersions: [...this.configuration.supportedProtocolVersions],
    });
  }

  async diagnose(): Promise<LocalWorkerDiagnostic> {
    const checks: LocalWorkerDiagnostic["checks"] = [];
    const root = resolve(this.configuration.managedRoot);
    const operatorIsolated = !this.configuration.operatorOwnedRoots.some(
      (operatorRoot) => pathsOverlap(root, operatorRoot),
    );
    checks.push({
      id: "managed_root_name",
      passed: containsMorrowSegment(root),
      detail: containsMorrowSegment(root) ? "morrow_segment_present" : "morrow_segment_missing",
    });
    checks.push({
      id: "operator_isolation",
      passed: operatorIsolated,
      detail: operatorIsolated
        ? "managed_root_does_not_overlap_declared_operator_roots"
        : "worker_managed_root_overlaps_operator_root",
    });
    checks.push({
      id: "target_access",
      passed: true,
      detail: "target_access_none",
    });
    checks.push({
      id: "dispatch",
      passed: true,
      detail: this.configuration.dispatchEnabled === true
        ? "authenticated_dispatch_enabled_by_trusted_composition"
        : "dispatch_disabled",
    });

    try {
      const layout = await inspectOwnedLayout(root, this.configuration.workerId);
      checks.push({ id: "managed_root_marker", passed: true, detail: markerName });
      checks.push({ id: "managed_children", passed: true, detail: layout.workspaceRoot });
    } catch (error) {
      checks.push({
        id: "managed_root_marker",
        passed: false,
        detail: error instanceof Error ? error.message : "managed_root_inspection_failed",
      });
    }

    return deepFreeze({ status: this.status(), checks });
  }

  private async startInternal(): Promise<LocalWorkerServiceStatus> {
    try {
      const layout = await initializeOwnedLayout(this.configuration);
      this.layout = layout;
      this.instanceId = randomUUID();
      this.startedAt = new Date().toISOString();
      this.stoppedAt = null;
      this.state = "ready";
      return this.status();
    } catch (error) {
      this.state = "failed";
      this.failure = error instanceof Error ? error.message : "worker_start_failed";
      throw error;
    }
  }
}

async function initializeOwnedLayout(configuration: LocalWorkerServiceConfiguration): Promise<LocalWorkerLayout> {
  const requestedRoot = resolve(configuration.managedRoot);
  await assertNoSymbolicLinkAncestors(requestedRoot);
  await mkdir(requestedRoot, { recursive: true });
  const rootEntry = await lstat(requestedRoot);
  if (rootEntry.isSymbolicLink()) throw new Error("worker_managed_root_symlink_refused");

  const managedRoot = await realpath(requestedRoot);
  if (!containsMorrowSegment(managedRoot)) {
    throw new Error("worker_managed_root_canonical_path_requires_morrow_segment");
  }
  for (const operatorRoot of configuration.operatorOwnedRoots) {
    if (pathsOverlap(managedRoot, await resolvedPath(operatorRoot))) {
      throw new Error("worker_managed_root_overlaps_operator_root");
    }
  }

  await ensureManagedRootMarker(managedRoot, configuration.workerId);
  const stateRoot = await ensureManagedChild(managedRoot, "state");
  const workspaceRoot = await ensureManagedChild(managedRoot, "workspaces");
  const diagnosticsRoot = await ensureManagedChild(managedRoot, "diagnostics");
  return deepFreeze({ managedRoot, stateRoot, workspaceRoot, diagnosticsRoot });
}

async function assertNoSymbolicLinkAncestors(path: string): Promise<void> {
  const root = parse(path).root;
  const segments = relative(root, path).split(/[\\/]+/).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = join(current, segment);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) {
        throw new Error("worker_managed_root_symbolic_ancestor_refused");
      }
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }
  }
}

async function inspectOwnedLayout(root: string, workerId: string): Promise<LocalWorkerLayout> {
  const managedRoot = await realpath(root);
  await assertMarker(managedRoot, workerId);
  const stateRoot = await inspectManagedChild(managedRoot, "state");
  const workspaceRoot = await inspectManagedChild(managedRoot, "workspaces");
  const diagnosticsRoot = await inspectManagedChild(managedRoot, "diagnostics");
  return { managedRoot, stateRoot, workspaceRoot, diagnosticsRoot };
}

async function ensureManagedRootMarker(root: string, workerId: string): Promise<void> {
  const markerPath = join(root, markerName);
  try {
    await assertMarker(root, workerId);
    return;
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "worker_managed_root_marker_missing") throw error;
  }

  const entries = await readdir(root);
  if (entries.length > 0) throw new Error("worker_managed_root_unowned");
  const marker: ManagedRootMarker = { format: "morrow-local-worker-root/v1", workerId };
  try {
    await writeFile(markerPath, `${JSON.stringify(marker)}\n`, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
    await assertMarker(root, workerId);
  }
}

async function assertMarker(root: string, workerId: string): Promise<void> {
  const markerPath = join(root, markerName);
  try {
    const markerEntry = await lstat(markerPath);
    if (markerEntry.isSymbolicLink() || !markerEntry.isFile()) {
      throw new Error("worker_managed_root_marker_invalid");
    }
  } catch (error) {
    if (isNotFound(error)) throw new Error("worker_managed_root_marker_missing");
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(markerPath, "utf8"));
  } catch {
    throw new Error("worker_managed_root_marker_invalid");
  }
  if (!isMarker(parsed)) throw new Error("worker_managed_root_marker_invalid");
  if (parsed.workerId !== workerId) throw new Error("worker_managed_root_owned_by_other_worker");
}

async function ensureManagedChild(root: string, name: "state" | "workspaces" | "diagnostics"): Promise<string> {
  const child = join(root, name);
  try {
    await mkdir(child, { recursive: true });
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
  }
  return inspectManagedChild(root, name);
}

async function inspectManagedChild(root: string, name: "state" | "workspaces" | "diagnostics"): Promise<string> {
  const child = join(root, name);
  const entry = await lstat(child);
  if (entry.isSymbolicLink() || !entry.isDirectory()) throw new Error(`worker_managed_child_invalid:${name}`);
  const resolvedChild = await realpath(child);
  if (!isWithin(resolvedChild, root)) throw new Error(`worker_managed_child_outside_root:${name}`);
  return resolvedChild;
}

function assertConfiguration(configuration: LocalWorkerServiceConfiguration): void {
  if (!isPlainObject(configuration)) throw new Error("worker_configuration_invalid");
  const allowed = new Set(["workerId", "managedRoot", "operatorOwnedRoots", "supportedProtocolVersions", "dispatchEnabled"]);
  const unknown = Object.keys(configuration).find((key) => !allowed.has(key));
  if (unknown) throw new Error(`worker_configuration_unknown_field:${unknown}`);
  if (!workerIdPattern.test(configuration.workerId)) throw new Error("worker_id_invalid");
  if (configuration.dispatchEnabled !== undefined && typeof configuration.dispatchEnabled !== "boolean") {
    throw new Error("worker_dispatch_enabled_invalid");
  }
  if (typeof configuration.managedRoot !== "string" || !isAbsolute(configuration.managedRoot)) {
    throw new Error("worker_managed_root_must_be_absolute");
  }
  if (!containsMorrowSegment(resolve(configuration.managedRoot))) {
    throw new Error("worker_managed_root_requires_morrow_segment");
  }
  if (!Array.isArray(configuration.operatorOwnedRoots) || configuration.operatorOwnedRoots.some((root) => typeof root !== "string" || !isAbsolute(root))) {
    throw new Error("worker_operator_roots_invalid");
  }
  if (new Set(configuration.operatorOwnedRoots.map(normalizePath)).size !== configuration.operatorOwnedRoots.length) {
    throw new Error("worker_operator_roots_duplicate");
  }
  if (configuration.operatorOwnedRoots.some((root) => pathsOverlap(configuration.managedRoot, root))) {
    throw new Error("worker_managed_root_overlaps_operator_root");
  }
  if (
    !Array.isArray(configuration.supportedProtocolVersions)
    || configuration.supportedProtocolVersions.length === 0
    || configuration.supportedProtocolVersions.some((version) => typeof version !== "string" || !protocolVersionPattern.test(version))
    || new Set(configuration.supportedProtocolVersions).size !== configuration.supportedProtocolVersions.length
    || !configuration.supportedProtocolVersions.includes(WORKER_PROTOCOL_VERSION)
  ) {
    throw new Error("worker_protocol_versions_invalid");
  }
}

function containsMorrowSegment(path: string): boolean {
  return path.split(/[\\/]+/).some((segment) => segment.toLowerCase() === ".morrow");
}

function pathsOverlap(left: string, right: string): boolean {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  return isWithin(normalizedLeft, normalizedRight) || isWithin(normalizedRight, normalizedLeft);
}

function isWithin(candidate: string, root: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

function normalizePath(path: string): string {
  const resolved = resolve(path);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function resolvedPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if (isNotFound(error)) return resolve(path);
    throw error;
  }
}

function isMarker(value: unknown): value is ManagedRootMarker {
  return isPlainObject(value)
    && Object.keys(value).length === 2
    && value.format === "morrow-local-worker-root/v1"
    && typeof value.workerId === "string"
    && workerIdPattern.test(value.workerId);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

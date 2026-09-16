import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface LockLease {
  resourceId: string;
  ownerId: string;
  acquiredAt: string;
  expiresAt: string;
}

export interface LockResult {
  acquired: boolean;
  lease: LockLease;
}

export class FileLockManager {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private lockPath(resourceId: string): string {
    return join(this.root, encodeURIComponent(resourceId));
  }

  async acquire(resourceId: string, ownerId: string, ttlMs: number): Promise<LockResult> {
    if (ttlMs <= 0) throw new Error("lock_ttl_must_be_positive");
    await mkdir(this.root, { recursive: true });
    const path = this.lockPath(resourceId);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const now = Date.now();
      try {
        await mkdir(path);
        const lease: LockLease = {
          resourceId,
          ownerId,
          acquiredAt: new Date(now).toISOString(),
          expiresAt: new Date(now + ttlMs).toISOString(),
        };
        await writeFile(join(path, "lease.json"), JSON.stringify(lease), "utf8");
        return { acquired: true, lease };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const lease = await this.readLease(path);
        if (Date.parse(lease.expiresAt) > now) return { acquired: false, lease };
        await rm(path, { recursive: true, force: true });
      }
    }

    throw new Error("lock_acquire_race");
  }

  async release(resourceId: string, ownerId: string): Promise<boolean> {
    const path = this.lockPath(resourceId);
    let lease: LockLease;
    try {
      lease = await this.readLease(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }

    if (lease.ownerId !== ownerId) throw new Error("lock_owner_mismatch");
    await rm(path, { recursive: true, force: true });
    return true;
  }

  private async readLease(path: string): Promise<LockLease> {
    return JSON.parse(await readFile(join(path, "lease.json"), "utf8")) as LockLease;
  }
}

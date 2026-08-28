import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export type InvocationStatus = "planned" | "running" | "completed" | "failed" | "interrupted";

export interface InvocationCheckpoint {
  invocationId: string;
  contractId: string;
  roleId: string;
  workspaceId: string;
  runtimeId: string;
  status: InvocationStatus;
  contextManifestHash: string;
  updatedAt: string;
  resultRef?: string;
  error?: string;
}

export class JsonCheckpointStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async save(checkpoint: InvocationCheckpoint): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const path = this.pathFor(checkpoint.invocationId);
    const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, JSON.stringify(checkpoint, null, 2), "utf8");
    await rename(temp, path);
  }

  async load(invocationId: string): Promise<InvocationCheckpoint | null> {
    try {
      return JSON.parse(await readFile(this.pathFor(invocationId), "utf8")) as InvocationCheckpoint;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  private pathFor(invocationId: string): string {
    return join(this.root, `${encodeURIComponent(invocationId)}.json`);
  }
}

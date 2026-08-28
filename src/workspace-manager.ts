import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface WorkspaceDescriptor {
  workspaceId: string;
  root: string;
  contractId: string;
  roleId: string;
}

export class LocalWorkspaceManager {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async create(params: {
    workspaceId: string;
    contractId: string;
    roleId: string;
  }): Promise<WorkspaceDescriptor> {
    const contractRoot = resolve(this.root, params.contractId);
    await mkdir(contractRoot, { recursive: true });
    const root = resolve(contractRoot, params.workspaceId);
    await mkdir(root, { recursive: false });
    return { ...params, root };
  }

  async destroy(workspace: WorkspaceDescriptor): Promise<void> {
    const expectedPrefix = resolve(this.root) + "/";
    if (!workspace.root.startsWith(expectedPrefix)) {
      throw new Error("workspace_outside_managed_root");
    }
    await rm(workspace.root, { recursive: true, force: true });
  }

  pathFor(contractId: string, workspaceId: string): string {
    return join(resolve(this.root), contractId, workspaceId);
  }
}

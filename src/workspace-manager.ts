import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface WorkspaceDescriptor {
  workspaceId: string;
  root: string;
  contractId: string;
  roleId: string;
}

function assertSafeSegment(value: string, label: "contract_id" | "workspace_id"): void {
  if (
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("\0")
  ) {
    throw new Error(`invalid_${label}`);
  }
}

function sameResolvedPath(left: string, right: string): boolean {
  const resolvedLeft = resolve(left);
  const resolvedRight = resolve(right);

  if (process.platform === "win32") {
    return resolvedLeft.toLowerCase() === resolvedRight.toLowerCase();
  }

  return resolvedLeft === resolvedRight;
}

export class LocalWorkspaceManager {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async create(params: {
    workspaceId: string;
    contractId: string;
    roleId: string;
  }): Promise<WorkspaceDescriptor> {
    assertSafeSegment(params.contractId, "contract_id");
    assertSafeSegment(params.workspaceId, "workspace_id");

    const contractRoot = join(this.root, params.contractId);
    await mkdir(contractRoot, { recursive: true });
    const root = join(contractRoot, params.workspaceId);
    await mkdir(root, { recursive: false });
    return { ...params, root };
  }

  async destroy(workspace: WorkspaceDescriptor): Promise<void> {
    const expectedRoot = this.pathFor(workspace.contractId, workspace.workspaceId);

    if (!sameResolvedPath(workspace.root, expectedRoot)) {
      throw new Error("workspace_outside_managed_root");
    }

    await rm(expectedRoot, { recursive: true, force: true });
  }

  pathFor(contractId: string, workspaceId: string): string {
    assertSafeSegment(contractId, "contract_id");
    assertSafeSegment(workspaceId, "workspace_id");
    return join(this.root, contractId, workspaceId);
  }
}

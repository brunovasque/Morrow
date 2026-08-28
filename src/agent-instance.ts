import type { ContextManifest } from "./types.ts";

export type AccessMode = "quota-session" | "api" | "local";
export type Effort = "low" | "medium" | "high" | "xhigh" | "provider-default";

export interface AgentInstance {
  invocationId: string;
  roleId: string;
  contractId: string;
  stepId: string;
  targetId: string;
  workspaceId: string;
  runtimeId: string;
  modelProfile: string;
  accessMode: AccessMode;
  effort: Effort;
  contextManifest: ContextManifest;
}

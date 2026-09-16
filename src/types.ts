export type ActorKind = "human" | "agent" | "kernel";

export interface Actor {
  kind: ActorKind;
  id: string;
}

export interface MorrowEvent<T = unknown> {
  eventId: string;
  contractId: string;
  type: string;
  occurredAt: string;
  actor: Actor;
  payload: T;
  stepId?: string;
  causationId?: string;
  correlationId?: string;
  schemaVersion: "0.1";
}

export interface EvidenceRef {
  evidenceId: string;
  kind: string;
  surfaces: string[];
  status: "fresh" | "stale";
  recordedAt: string;
}

export interface MeetingState {
  meetingId: string;
  question: string;
  participants: string[];
  openedAt: string;
}

export interface LiveContractState {
  contractId: string;
  destinationHash: string | null;
  activeObjective: string | null;
  activeStepId: string | null;
  routeNode: string | null;
  blockers: Array<{ kind: string; reason: string }>;
  openMeeting: MeetingState | null;
  decisions: Record<string, string>;
  debts: string[];
  evidence: Record<string, EvidenceRef>;
  lastEventId: string | null;
}

export interface ContextManifest {
  contractId: string;
  contractHash: string;
  stepId: string;
  objective: string;
  roleId: string;
  roleSpecHash: string;
  allowedArtifacts: string[];
  readScope: string[];
  completionCriteria: string[];
  requiredRegressionChecks: string[];
  resolvedOwnerDecisions: string[];
  openOwnerDecisions: string[];
  promotedMemoryRefs: string[];
  skills: Array<{ id: string; version: string }>;
  requiredCapabilities: string[];
  availableCapabilities: string[];
}

export interface GateDecision {
  allowed: boolean;
  reasons: string[];
}

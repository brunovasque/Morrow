import type { LiveContractState, MorrowEvent } from "./types.ts";

export function emptyState(contractId: string): LiveContractState {
  return {
    contractId,
    destinationHash: null,
    activeObjective: null,
    activeStepId: null,
    routeNode: null,
    blockers: [],
    openMeeting: null,
    decisions: {},
    debts: [],
    evidence: {},
    lastEventId: null,
  };
}

export function materializeContractState(
  contractId: string,
  events: MorrowEvent[],
): LiveContractState {
  const state = emptyState(contractId);

  for (const event of events) {
    if (event.contractId !== contractId) continue;
    state.lastEventId = event.eventId;

    switch (event.type) {
      case "CONTRACT_REGISTERED": {
        const payload = event.payload as { destinationHash: string };
        state.destinationHash = payload.destinationHash;
        break;
      }
      case "OBJECTIVE_ACTIVATED": {
        const payload = event.payload as { objective: string; stepId: string; routeNode: string };
        state.activeObjective = payload.objective;
        state.activeStepId = payload.stepId;
        state.routeNode = payload.routeNode;
        break;
      }
      case "ROUTE_MOVED": {
        const payload = event.payload as { to: string };
        state.routeNode = payload.to;
        break;
      }
      case "BLOCKER_OPENED": {
        const payload = event.payload as { kind: string; reason: string };
        state.blockers.push(payload);
        break;
      }
      case "BLOCKER_RESOLVED": {
        const payload = event.payload as { kind: string };
        state.blockers = state.blockers.filter((item) => item.kind !== payload.kind);
        break;
      }
      case "MEETING_OPENED": {
        const payload = event.payload as {
          meetingId: string;
          question: string;
          participants: string[];
        };
        state.openMeeting = {
          ...payload,
          openedAt: event.occurredAt,
        };
        break;
      }
      case "MEETING_RESOLVED":
        state.openMeeting = null;
        break;
      case "OWNER_DECISION_RECORDED": {
        const payload = event.payload as { key: string; value: string };
        state.decisions[payload.key] = payload.value;
        break;
      }
      case "DEBT_RECORDED": {
        const payload = event.payload as { debtId: string };
        if (!state.debts.includes(payload.debtId)) state.debts.push(payload.debtId);
        break;
      }
      case "EVIDENCE_RECORDED": {
        const payload = event.payload as {
          evidenceId: string;
          kind: string;
          surfaces: string[];
        };
        state.evidence[payload.evidenceId] = {
          ...payload,
          status: "fresh",
          recordedAt: event.occurredAt,
        };
        break;
      }
      case "SURFACE_CHANGED": {
        const payload = event.payload as { surfaces: string[] };
        for (const evidence of Object.values(state.evidence)) {
          if (evidence.surfaces.some((surface) => payload.surfaces.includes(surface))) {
            evidence.status = "stale";
          }
        }
        break;
      }
    }
  }

  return state;
}

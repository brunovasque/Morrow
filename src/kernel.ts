import { randomUUID } from "node:crypto";
import type { EventLog } from "./event-log.ts";
import { materializeContractState } from "./live-state.ts";
import { evaluatePreDispatch } from "./pre-dispatch.ts";
import type { Actor, ContextManifest, GateDecision, LiveContractState, MorrowEvent } from "./types.ts";

export class MorrowKernel {
  private readonly eventLog: EventLog;

  constructor(eventLog: EventLog) {
    this.eventLog = eventLog;
  }

  async state(contractId: string): Promise<LiveContractState> {
    return materializeContractState(contractId, await this.eventLog.readContract(contractId));
  }

  async emit<T>(params: {
    contractId: string;
    type: string;
    actor: Actor;
    payload: T;
    stepId?: string;
    causationId?: string;
    correlationId?: string;
  }): Promise<MorrowEvent<T>> {
    const event: MorrowEvent<T> = {
      eventId: randomUUID(),
      contractId: params.contractId,
      type: params.type,
      occurredAt: new Date().toISOString(),
      actor: params.actor,
      payload: params.payload,
      stepId: params.stepId,
      causationId: params.causationId,
      correlationId: params.correlationId,
      schemaVersion: "0.1",
    };
    await this.eventLog.append(event);
    return event;
  }

  async preDispatch(manifest: ContextManifest): Promise<GateDecision> {
    return evaluatePreDispatch(manifest, await this.state(manifest.contractId));
  }
}

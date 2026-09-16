import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlEventLog } from "./event-log.ts";
import { MorrowKernel } from "./kernel.ts";

const root = await mkdtemp(join(tmpdir(), "morrow-demo-"));
const kernel = new MorrowKernel(new JsonlEventLog(join(root, "events.jsonl")));
const contractId = "demo-contract";
const kernelActor = { kind: "kernel" as const, id: "runtime-v0" };

await kernel.emit({
  contractId,
  type: "CONTRACT_REGISTERED",
  actor: kernelActor,
  payload: { destinationHash: "demo-destination-v1" },
});
await kernel.emit({
  contractId,
  type: "OBJECTIVE_ACTIVATED",
  actor: kernelActor,
  payload: { objective: "prove adaptive execution graph", stepId: "S1", routeNode: "EXECUTION" },
});
await kernel.emit({
  contractId,
  type: "ROUTE_MOVED",
  actor: { kind: "agent", id: "reviewer" },
  payload: { to: "DIAGNOSTIC", reason: "review found an unmeasured surface" },
});
await kernel.emit({
  contractId,
  type: "ROUTE_MOVED",
  actor: { kind: "agent", id: "orchestrator" },
  payload: { to: "EXECUTION", reason: "diagnostic clarified the cause" },
});

console.log(JSON.stringify(await kernel.state(contractId), null, 2));

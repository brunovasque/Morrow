import type { ContextManifest, GateDecision, LiveContractState } from "./types.ts";

const nonEmptyStringFields: Array<keyof ContextManifest> = [
  "contractId",
  "contractHash",
  "stepId",
  "objective",
  "roleId",
  "roleSpecHash",
];

export function evaluatePreDispatch(
  manifest: ContextManifest,
  state: LiveContractState,
): GateDecision {
  const reasons: string[] = [];

  for (const field of nonEmptyStringFields) {
    const value = manifest[field];
    if (typeof value !== "string" || value.trim() === "") {
      reasons.push(`missing:${String(field)}`);
    }
  }

  if (manifest.contractId !== state.contractId) reasons.push("contract_id_mismatch");
  if (state.blockers.length > 0) reasons.push("contract_blocked");
  if (manifest.openOwnerDecisions.length > 0) reasons.push("owner_decision_open");
  if (manifest.completionCriteria.length === 0) reasons.push("completion_criteria_empty");

  const unavailable = manifest.requiredCapabilities.filter(
    (capability) => !manifest.availableCapabilities.includes(capability),
  );
  if (unavailable.length > 0) reasons.push(`capability_missing:${unavailable.join(",")}`);

  return { allowed: reasons.length === 0, reasons };
}

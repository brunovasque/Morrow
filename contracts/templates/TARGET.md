# Target descriptor

## Identity

- target_id:
- target kind: `new-repository | existing-repository | service | workspace`
- repository locator: resolved by control plane; do not place secrets here
- base ref:
- pinned base SHA:

## Access policy

- write mode: `read-only | branch-only | pr-only | governed-deploy`
- allowed paths:
- forbidden paths:
- protected paths:
- required capabilities:

## Safety policy

- required checks:
- regression profile:
- security profile:
- secret profile:
- deployment policy:
- rollback policy:
- owner/escalation policy:

## Existing-system baseline

For an existing target, record:

- accepted behavior that must survive;
- known tests/proofs/gates;
- interfaces/consumers affected by likely changes;
- unsupported or unmeasured surfaces;
- current known debts that are explicitly outside the contract.

## Isolation

- workspace strategy:
- lock scope:
- branch naming policy:
- artifact/log scope:

The contract cannot start write execution until the target descriptor and its regression baseline pass CONTRACT_PREFLIGHT.

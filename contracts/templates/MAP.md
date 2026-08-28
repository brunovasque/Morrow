# Execution map

The contract declares the destination. This map declares the route. Route can change with recorded evidence; destination cannot change without owner authorization/new contract.

| step | objective | why this step exists | role(s) | method / how | inputs | outputs | prerequisites / resolved questions | skills / capabilities | regression surface | evidence required | completion gate |
|---|---|---|---|---|---|---|---|---|---|---|---|

## Map completeness rules

Before execution starts:

1. every contract deliverable must map to at least one step;
2. every selected role must have a reason and an explicit entry point;
3. every step must say what it produces and how completion is measured;
4. every prerequisite must point to a resolved question, evidence artifact or prior step;
5. every changed/affected accepted behavior must appear in `regression surface` or be explicitly marked `none` with reason;
6. no blocking owner decision may remain hidden inside a step;
7. the final step must include Acceptance and contract-close evidence when applicable.

Changing role/order/method is a route correction and must be recorded. Changing the observable objective is a destination change and requires owner authority.

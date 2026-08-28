# Target repository model

Morrow is a control plane. A contract may modify Morrow itself or any authorized target repository without embedding the Morrow kernel in that repository.

## Separation

- **control plane**: contracts, question rounds, execution maps, role dispatch, policy, memory, events, checkpoints and audit;
- **target repository**: the code/product being changed;
- **workspace**: an isolated checkout/sandbox of a target repository for one contract/step;
- **target adapter**: the narrow interface through which the kernel reads, branches, commits, tests and opens PRs against the target.

The target repository does not need to contain Morrow.

## Required target descriptor

A contract that touches an external repository resolves a target descriptor outside the LLM prompt with at least:

- `target_id`
- `repository_locator`
- `base_ref`
- `write_mode`: `read-only | branch-only | pr-only | governed-deploy`
- `allowed_paths`
- `forbidden_paths`
- `required_checks`
- `regression_profile`
- `secret_profile`
- `deployment_policy`
- `rollback_policy`
- `owner/escalation policy`

The public core may contain the schema. Real private target locators, credentials and proprietary policies may live in a private/local registry or secret-backed control store.

## Default write policy

For external targets the safe default is:

1. fetch exact base SHA;
2. create isolated workspace;
3. create contract-scoped branch;
4. execute only through declared capabilities;
5. run target-specific gates and regression profile;
6. Reviewer inspects the diff independently;
7. Auditor reruns/attacks evidence independently;
8. Acceptance checks the contracted observable result;
9. open/update PR in the target repository;
10. never write directly to the protected base branch.

Deploy is a separate governed capability, never implied by permission to edit code.

## Two important modes

### Build-new

The target can be an empty/new repository. Morrow bootstraps its structure from the approved contract and then develops it entirely through the same loop.

### Modify-existing

The target can be an existing production codebase. Morrow first discovers architecture, establishes accepted-behavior/regression baselines and respects target-specific invariants before any write dispatch.

## Memory boundary

Institutional learning belongs to Morrow, but target-private facts must keep tenant/project scope and provenance. A lesson learned in one target is not automatically promoted as global truth for another.

## Failure containment

A failure in a target workspace must not corrupt:

- the control plane;
- another target;
- another contract;
- the protected branch;
- the institutional memory.

Workspace isolation, locks, scoped credentials and append-only events enforce this mechanically.

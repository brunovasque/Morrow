# Contract questions / uncertainty register

The question round is a mandatory preflight artifact, not meeting notes.

## Pass 1 — independent questions by role

Every role selected for the contract reviews the objective independently and must return one of two outcomes:

- questions/assumptions/failure modes found; or
- `NO_BLOCKING_QUESTION_FOUND`, with the surfaces it actually reviewed.

| id | raised_by_role | category | question / assumption | evidence / why it matters | answer_source | status | answer | date |
|---|---|---|---|---|---|---|---|---|

`answer_source` is one of: `repository | diagnostic | promoted-memory | skill | external-authoritative-source | owner`.

## Resolution order

1. The Diagnostician answers questions that can be measured from the system/repository/environment.
2. Skills and promoted institutional memory may answer domain questions when their provenance/freshness is valid.
3. External authoritative sources may answer factual questions when the contract permits research.
4. Only questions that genuinely require owner intent/authority go to the owner.
5. An agent must not turn an owner question into its own decision.

## Pass 2 — adversarial completeness pass

After the first answers are incorporated, selected roles inspect the resolved set again and ask:

- What ambiguity remains?
- Which dependency/interface has not been discussed?
- Which failure mode can still change the destination?
- Which assumption is being treated as fact without evidence?
- What could cause a regression in already accepted behavior?
- What question would I likely ask after execution begins?

The preflight gate cannot open while a blocking question remains.

## Questions discovered during execution

Every new blocking question is appended here and classified:

- `PREFLIGHT_MISS`: the question was reasonably discoverable from information available during preflight;
- `EMERGENT_UNKNOWN`: it depends on new state, external change, newly exposed behavior or information unavailable during preflight.

A `PREFLIGHT_MISS` is a process defect and feeds the role error maps/retrospective. It does not get silently normalized as ordinary execution.

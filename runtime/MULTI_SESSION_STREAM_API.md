# Local Multi-Session Stream API — P4-PR04

Status: implementation candidate, provider-neutral local/process API.

`WorkerSessionStream` composes the existing `TerminalSessionManager`, the
P4-PR02 `StreamRedactor`, and the P4-PR03 authenticated `JsonlEventLog`. It
does not create a second terminal runtime and has no UI, network, or chat
dependency.

## Surface

- `open({ stateRoot, terminals, redaction, maxEventsPerSession? })` opens the
  durable local session-stream state and rehydrates every session log found
  below `stateRoot/sessions`.
- `list()` returns descriptors for all observed sessions, including immutable
  session/agent/contract/workspace identity, stream id, head, terminal state,
  liveness, and history status.
- `subscribe(sessionId, listener)` observes only that session. Subscribers may
  be attached before `start`; observer exceptions are isolated from persistence.
- `start(request)` starts one real terminal session through the existing local
  terminal manager and returns a completion promise that resolves only after
  the terminal completion events have been persisted in that session's queue.
- `replay(sessionId, cursor?, limit?)` reads only the selected session stream.
  The cursor is a continuity position, not authorization.
- `close()` stops observation and flushes redactor holdback for unfinished
  sessions; it does not stop a terminal process owned by the terminal manager.

## Identity and cursor rules

Each terminal session has its own durable JSONL event log and derived stream
identity. Public event ids are `${sessionId}:${sequence}` and sequences start
at one and increase strictly within that session. A cursor from another
session, malformed cursor, cursor above the durable head, or cursor below the
retained floor is reported as `invalid`, `future`, or `stale`; none silently
rewinds to the beginning. Transcript ordinals and Live Activity identities
remain separate from this event cursor.

## Live, replay, and restart

Live events are published only after their redacted payload has been appended
to the authenticated event log. Replays return the same redacted payloads in
cursor order. A restart reconstructs each session from its complete validated
log. A terminal log reopens with its terminal outcome; an unfinished log is
reported as `recoverable` and `offline`, never as completed or online merely
because the process restarted. A session can therefore be distinguished as
online, offline/recoverable, terminal, or failed.

The completion promise also waits for the terminal event to finish in the
session persistence queue. If that append fails, completion rejects with the
sanitized `worker_session_terminal_persistence_failed` error; it never returns
a successful terminal result without a durable terminal event. The in-memory
session becomes failed, while a later reopen correctly derives the non-terminal
`recoverable`/`offline` state from the events that actually exist.

The central proof uses two actual child processes in distinct managed
workspaces. Their live output, durable event ids, cursors, redaction, replay,
and post-restart descriptors remain isolated.

## Redaction and failure behavior

The same bounded `StreamRedactor` primitive protects command arguments and
stdout/stderr fragments before live publication and before persistence. Raw
secret text is not part of the public event or error payload. Malformed or
inconsistent persisted session events fail closed during rehydration/replay;
they are not converted into an empty or successful session.

The stream is intentionally local and provider-neutral. An HTTP/WebSocket
adapter is outside P4-PR04.

## Completion, identity and failure boundaries

Completion returns the terminal result only after its matching terminal state is durably recorded; stdout and stderr are redacted using the existing canonical policy, and backend error text is replaced by a stable error code. Closing observation before the terminal event rejects the stream completion, even if the underlying process exits successfully. An append failure makes the persistence gap sticky: subsequent terminal events are not committed and a reopen can only reconstruct the durable prefix.

Session identifiers retain their original spelling but reserve a case-folded key before asynchronous launch, including on Windows. A case alias cannot claim the same durable event-log authority or cursor, including after reopen. Transcript records are scoped to contract, terminal session and agent instance.

## Recovered lifecycle and native output boundaries

A live binding is admitted only in the current observation lifetime; a rehydrated ID is historical and cannot attach to any new manager process, even with the same canonical identity. A pending reservation cannot publish another manager invocation's events. Snapshots require the full canonical terminal/agent/contract/role/runtime/workspace/root identity and matching durable status. Duplicate START or EXIT is refused; replay is serialized with the persistence queue and rejects a head outside the observed lifecycle. Transcript reads are also scoped to the worker-session-stream step and writer.

Started arguments are inspected together as an argv context as well as individually by the canonical redactor. If any sensitive member, explicit placeholder, or cross-argument context is detected, the complete argument vector is replaced with redaction placeholders; non-sensitive vectors remain visible. Execution arguments are unchanged. Native ConPTY `terminal` is a distinct output channel, not a stdout alias, and retains its identity through holdback/flush, transcript and replay/reopen. The existing conservative VT fail-closed policy still applies.

## Invariant recovery boundaries

For an admitted observation lifetime, the bounded canonical redactor includes explicitly marked argument literals in the in-memory policy for stdout, stderr, native terminal output, and completion. The literals are not added to durable policy metadata. Raw terminal-manager access remains privileged, separate from the Worker public surface. An interrupted observation discards unresolved holdback rather than publishing a potentially sensitive prefix.

The case-folded reservation precedes the authenticated durable-history check and manager launch. Existing authority or inconsistent history fails closed before the Worker can start another process. Reopen also checks retained worker transcript identities against their event logs. Terminal events are detached and recursively immutable before observers receive them. A common semantic validator checks live and stored events; a common reducer derives durable state. A real launch failure may be the first failed event without a fabricated start. Public transcript records are limited to the records linked to committed worker events, and terminal snapshots and completion must agree with durable terminal facts.

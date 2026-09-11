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

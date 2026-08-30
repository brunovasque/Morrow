import assert from "node:assert/strict";
import test from "node:test";
import {
  ProcessPipesTerminalBackend,
  assertTerminalPresentationAllowed,
  resolveTerminalPresentation,
  validateTerminalBackendDescriptor,
  type TerminalBackendDescriptor,
} from "../src/terminal-backend.ts";

function conptyDescriptor(
  overrides: Partial<TerminalBackendDescriptor["capabilities"]> = {},
): TerminalBackendDescriptor {
  return {
    kind: "windows-conpty",
    implementationId: "node-pty-conpty-v1",
    protocol: "conpty-vt",
    capabilities: {
      tty: true,
      interactive: true,
      resize: true,
      signals: true,
      utf8: true,
      exitStatus: true,
      ...overrides,
    },
  };
}

test("process pipes are permanently classified as process output", () => {
  const backend = new ProcessPipesTerminalBackend();
  const presentation = resolveTerminalPresentation(backend.descriptor);

  assert.equal(presentation.mode, "process-output");
  assert.equal(presentation.fullTerminal, false);
  assert.ok(presentation.missing.includes("backend:windows-conpty"));
  assert.ok(presentation.missing.includes("capability:tty"));
  assert.throws(
    () => assertTerminalPresentationAllowed(backend.descriptor, "full-terminal"),
    /terminal_full_presentation_not_supported/,
  );
  assert.doesNotThrow(
    () => assertTerminalPresentationAllowed(backend.descriptor, "process-output"),
  );
});

test("full terminal presentation requires the exact ConPTY protocol and every capability", () => {
  const full = conptyDescriptor();
  assert.deepEqual(resolveTerminalPresentation(full), {
    mode: "full-terminal",
    fullTerminal: true,
    missing: [],
  });
  assert.doesNotThrow(() => assertTerminalPresentationAllowed(full, "full-terminal"));

  const withoutSignals = conptyDescriptor({ signals: false });
  assert.deepEqual(resolveTerminalPresentation(withoutSignals), {
    mode: "process-output",
    fullTerminal: false,
    missing: ["capability:signals"],
  });
  assert.throws(
    () => assertTerminalPresentationAllowed(withoutSignals, "full-terminal"),
    /capability:signals/,
  );
});

test("descriptor validation refuses a pipes backend that claims terminal powers", () => {
  assert.throws(
    () => validateTerminalBackendDescriptor({
      kind: "process-pipes",
      implementationId: "forged-pipes",
      protocol: "separate-pipes",
      capabilities: {
        tty: true,
        interactive: true,
        resize: true,
        signals: true,
        utf8: true,
        exitStatus: true,
      },
    }),
    /process_pipes_capabilities_inconsistent/,
  );
});

test("descriptor validation refuses extra fields and accessor-backed claims", () => {
  assert.throws(
    () => validateTerminalBackendDescriptor({
      ...conptyDescriptor(),
      hiddenFallback: "winpty",
    } as TerminalBackendDescriptor),
    /terminal_backend_descriptor_fields_invalid/,
  );

  const accessor = conptyDescriptor() as unknown as Record<string, unknown>;
  Object.defineProperty(accessor, "implementationId", { get: () => "forged" });
  assert.throws(
    () => validateTerminalBackendDescriptor(accessor as unknown as TerminalBackendDescriptor),
    /terminal_backend_descriptor_accessor_invalid/,
  );
});

test("presentation gate refuses unknown presentation modes", () => {
  assert.throws(
    () => assertTerminalPresentationAllowed(conptyDescriptor(), "terminal-ish" as "full-terminal"),
    /terminal_presentation_mode_unknown/,
  );
});

test("validated descriptors are detached and frozen", () => {
  const source = conptyDescriptor();
  const validated = validateTerminalBackendDescriptor(source);
  source.capabilities.tty = false;

  assert.equal(validated.capabilities.tty, true);
  assert.equal(Object.isFrozen(validated), true);
  assert.equal(Object.isFrozen(validated.capabilities), true);
});

// Test/probe-only Windows process identity checks; never used by runtime.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { resolveWindowsPowerShellPath } from "../windows-conpty-backend.ts";

export type ProcessIdentity = { pid: number; birth: string };
export type ProcessObservation = { pid: number; state: "absent" } | { pid: number; state: "live" | "exited"; birth: string };

function validPid(pid: unknown): pid is number {
  return typeof pid === "number" && Number.isSafeInteger(pid) && pid > 0;
}
function validBirth(birth: unknown): birth is string {
  return typeof birth === "string" && /^[1-9]\d{0,19}$/.test(birth);
}
export function identityKey(identity: ProcessIdentity): string {
  if (!validPid(identity.pid) || !validBirth(identity.birth)) throw new Error("process_identity_invalid");
  return identity.pid + ":" + identity.birth;
}
export function assertBirthWindow(identity: ProcessIdentity, beganMs: number, observedAt: string): void {
  identityKey(identity);
  // Windows creation time is in 100 ns ticks since 0001.
  const bornMs = Number((BigInt(identity.birth) - 621355968000000000n) / 10000n);
  const endMs = Date.parse(observedAt);
  if (!Number.isSafeInteger(beganMs) || !Number.isFinite(endMs) || !Number.isSafeInteger(bornMs)
    || bornMs < beganMs || bornMs > endMs) {
    throw new Error("process_identity_birth_outside_session:" + identityKey(identity));
  }
}
export function assertConcurrentIdentities(identities: readonly ProcessIdentity[]): void {
  const pids = new Set<number>();
  for (const identity of identities) {
    identityKey(identity);
    if (pids.has(identity.pid)) throw new Error("process_identity_concurrent_collision:" + identity.pid);
    pids.add(identity.pid);
  }
}
export function assertDistinctLifetimes(identities: readonly ProcessIdentity[]): void {
  const keys = identities.map(identityKey);
  if (new Set(keys).size !== keys.length) throw new Error("process_identity_lifetime_collision");
}
export function originalIsAlive(original: ProcessIdentity, observed: ProcessObservation | undefined): boolean {
  identityKey(original);
  if (!observed || observed.pid !== original.pid) throw new Error("process_identity_unknown:" + original.pid);
  if (observed.state === "absent") return false;
  if ((observed.state !== "live" && observed.state !== "exited") || !validBirth(observed.birth)) {
    throw new Error("process_identity_unknown:" + original.pid);
  }
  if (observed.birth === original.birth) return observed.state === "live";
  if (BigInt(observed.birth) <= BigInt(original.birth)) throw new Error("process_identity_birth_regression:" + original.pid);
  return false;
}
export function assertOriginalsExited(originals: readonly ProcessIdentity[], observations: readonly ProcessObservation[]): void {
  const map = new Map(observations.map(row => [row.pid, row]));
  if (map.size !== observations.length) throw new Error("process_identity_duplicate_observation");
  for (const original of originals) {
    if (originalIsAlive(original, map.get(original.pid))) throw new Error("process_identity_survived:" + identityKey(original));
  }
}

// Acquire the Windows Process handle only for the identity query; dispose it
// immediately so the diagnostic does not prevent normal PID recycling.
const observer = "$ErrorActionPreference='Stop'\nwhile ($null -ne ($line=[Console]::ReadLine())) {\n  try {\n    $ids=ConvertFrom-Json -InputObject $line\n    $result=@(foreach ($id in $ids) {\n      $p=$null\n      try {\n        try { $p=[System.Diagnostics.Process]::GetProcessById([int]$id) }\n        catch [System.ArgumentException] {\n          [pscustomobject]@{pid=[int]$id;state='absent'}; continue\n        }\n        $null=$p.Handle\n        $birth=$p.StartTime.ToUniversalTime().Ticks.ToString([Globalization.CultureInfo]::InvariantCulture)\n        $state=if($p.HasExited){'exited'}else{'live'}\n        [pscustomobject]@{pid=[int]$id;state=$state;birth=$birth}\n      } finally { if($null -ne $p){$p.Dispose()} }\n    })\n    [Console]::WriteLine((ConvertTo-Json -InputObject @($result) -Compress))\n  } catch {\n    [Console]::WriteLine((ConvertTo-Json -InputObject @{error=$_.Exception.Message} -Compress))\n  }\n}";

export class WindowsProcessIdentityProbe {
  private readonly child = spawn(resolveWindowsPowerShellPath(), [
    "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(observer, "utf16le").toString("base64"),
  ], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  private readonly lines = createInterface({ input: this.child.stdout })[Symbol.asyncIterator]();
  private readonly done: Promise<void>;
  private problem: Error | undefined;
  private busy = false;

  constructor() {
    this.done = new Promise(resolve => this.child.once("close", () => resolve()));
    this.child.on("error", error => { this.problem = error; });
    this.child.stdin.on("error", error => { this.problem = error; });
    this.child.stderr.resume();
  }

  async observe(pids: readonly number[]): Promise<ProcessObservation[]> {
    const unique = [...new Set(pids)];
    if (!unique.length || !unique.every(validPid) || this.busy || this.problem) throw new Error("process_identity_observer_unavailable");
    this.busy = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      this.child.stdin.write(JSON.stringify(unique) + "\n");
      const line = await Promise.race([
        this.lines.next(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("process_identity_observer_timeout")), 3000); }),
      ]);
      if (line.done || this.problem) throw new Error("process_identity_observer_closed");
      const rows: unknown = JSON.parse(line.value);
      if (!Array.isArray(rows) || rows.length !== unique.length) throw new Error("process_identity_observation_failed:" + JSON.stringify(rows));
      const found = new Set<number>();
      for (const row of rows) {
        if (!row || !unique.includes(row.pid) || found.has(row.pid)
          || (row.state !== "absent" && ((row.state !== "live" && row.state !== "exited") || !validBirth(row.birth)))) {
          throw new Error("process_identity_observation_invalid");
        }
        found.add(row.pid);
      }
      return rows as ProcessObservation[];
    } catch (error) {
      this.problem = error instanceof Error ? error : new Error(String(error));
      throw this.problem;
    } finally {
      if (timer) clearTimeout(timer);
      this.busy = false;
    }
  }

  async capture(pids: readonly (number | null)[]): Promise<ProcessIdentity[]> {
    if (!pids.every(validPid)) throw new Error("process_identity_missing_pid");
    if (new Set(pids).size !== pids.length) throw new Error("process_identity_concurrent_collision");
    const rows = await this.observe(pids);
    return pids.map(pid => {
      const row = rows.find(row => row.pid === pid);
      if (!row || row.state !== "live") throw new Error("process_identity_not_live:" + pid);
      return { pid, birth: row.birth };
    });
  }

  async alive(originals: readonly ProcessIdentity[]): Promise<boolean[]> {
    const observed = await this.observe(originals.map(x => x.pid));
    return originals.map(x => originalIsAlive(x, observed.find(y => y.pid === x.pid)));
  }
  async assertExited(originals: readonly ProcessIdentity[]): Promise<void> {
    assertOriginalsExited(originals, await this.observe(originals.map(x => x.pid)));
  }
  async close(): Promise<void> {
    this.child.stdin.end();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([this.done, new Promise<void>(resolve => {
        timer = setTimeout(() => { this.child.kill(); resolve(); }, 2000);
      })]);
    } finally { if (timer) clearTimeout(timer); }
    await this.done;
  }
}

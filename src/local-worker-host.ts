import { readFile } from "node:fs/promises";
import { LocalWorkerService, type LocalWorkerServiceConfiguration } from "./local-worker-service.ts";

if (process.argv.length !== 3) {
  process.stderr.write("local_worker_host_requires_one_configuration_file\n");
  process.exitCode = 64;
} else {
  try {
    const configuration = JSON.parse(
      await readFile(process.argv[2], "utf8"),
    ) as LocalWorkerServiceConfiguration;
    const worker = new LocalWorkerService(configuration);
    const ready = await worker.start();
    emit("LOCAL_WORKER_READY", ready);

    await waitForShutdownSignal();
    const stopped = await worker.stop();
    emit("LOCAL_WORKER_STOPPED", stopped);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "local_worker_host_failed"}\n`);
    process.exitCode = 1;
  }
}

function emit(event: "LOCAL_WORKER_READY" | "LOCAL_WORKER_STOPPED", status: unknown): void {
  process.stdout.write(`${JSON.stringify({ event, status })}\n`);
}

async function waitForShutdownSignal(): Promise<void> {
  await new Promise<void>((resolveSignal) => {
    process.once("SIGINT", resolveSignal);
    process.once("SIGTERM", resolveSignal);
    process.stdin.setEncoding("utf8");
    let pending = "";
    process.stdin.on("data", (data: string) => {
      pending += data;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      if (lines.some((line) => line === "STOP")) resolveSignal();
    });
    process.stdin.resume();
  });
}

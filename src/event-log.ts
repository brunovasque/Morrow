import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MorrowEvent } from "./types.ts";

export interface EventLog {
  append(event: MorrowEvent): Promise<void>;
  readAll(): Promise<MorrowEvent[]>;
  readContract(contractId: string): Promise<MorrowEvent[]>;
}

export class JsonlEventLog implements EventLog {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async append(event: MorrowEvent): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify(event)}\n`, "utf8");
  }

  async readAll(): Promise<MorrowEvent[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as MorrowEvent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async readContract(contractId: string): Promise<MorrowEvent[]> {
    return (await this.readAll()).filter((event) => event.contractId === contractId);
  }
}

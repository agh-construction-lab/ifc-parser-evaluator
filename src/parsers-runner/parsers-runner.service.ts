import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";

type ParserRunResult = {
  name: string;
  errors: Array<string>;
  // signal: NodeJS.Signals | null;
  durationMs: number;
  // stdout: string;
  // stderr: string;
};

function getEmptyResult(name: string): ParserRunResult {
  return {
    name,
    errors: ["Parser not found"],
    durationMs: 0,
    // errors: ["Parser not found"],
    // signal: null,
    // stdout: "",
    // stderr: "",
  };
}

const TIMEOUT_MS = 10 * 60_000; // 10 min

@Injectable()
export class ParsersRunnerService {
  private readonly logger = new Logger(ParsersRunnerService.name);

  async runAll(parsers: ReadonlyArray<string>, ifcFiles: Array<string>) {
    const results: Array<ParserRunResult> = [];

    for (const parser of parsers) {
      this.logger.log(`Starting parser "${parser}"`);
      const res = await this.runOne({ parser, ifcFiles });
      results.push(res);
    }

    return results;
  }

  private async runOne(params: {
    parser: string;
    ifcFiles: Array<string>;
  }): Promise<ParserRunResult> {
    const { parser, ifcFiles } = params;
    const dir = path.resolve(process.cwd(), "_external", parser);
    const script = path.join(dir, "run.sh");

    const doesParserExist = await fs
      .access(dir)
      .then(() => true)
      .catch(() => false);

    if (!doesParserExist) {
      return getEmptyResult(dir);
    }

    if (ifcFiles.length === 0) {
      throw new Error("Nie podano żadnych plików IFC.");
    }

    const started = Date.now();
    const child = spawn("bash", [script, ...ifcFiles], {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (buffer: Buffer) => (stdout += buffer.toString()));
    child.stderr?.on("data", (buffer: Buffer) => (stderr += buffer.toString()));

    const exit = await new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve) => {
      const timer = setTimeout(() => {
        stderr += `\n[timeout] Killed after ${TIMEOUT_MS}ms\n`;
        child.kill("SIGKILL");
      }, TIMEOUT_MS);

      child.on("close", (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal });
      });
    });

    const durationMs = Date.now() - started;
    const ok = exit.code === 0;

    return {
      name: parser,
      errors: ok ? [] : [`Process exited with code ${exit.code}`],
      durationMs,
      // exitCode: exit.code,
      // signal: exit.signal,
      // stdout,
      // stderr,
    };
  }
}

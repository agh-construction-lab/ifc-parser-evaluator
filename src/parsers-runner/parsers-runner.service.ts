import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";

type ParsersRunInput = {
  parsers: ReadonlyArray<string>;
  ifcFiles: Array<string>;
  outputDir: string;
};

type ParserRunProps = {
  parser: string;
} & Pick<ParsersRunInput, "ifcFiles" | "outputDir">;

type ParserRunResult = {
  name: string;
  errors: Array<string>;
  durationMs: number;
};

function getEmptyResult(name: string): ParserRunResult {
  return {
    name,
    errors: ["Parser not found"],
    durationMs: 0,
  };
}

const TIMEOUT_MS = 10 * 60_000; // 10 min

@Injectable()
export class ParsersRunnerService {
  private readonly logger = new Logger(ParsersRunnerService.name);

  async runAll(props: ParsersRunInput): Promise<Array<ParserRunResult>> {
    const { parsers, ifcFiles, outputDir } = props;
    const results: Array<ParserRunResult> = [];

    for (const parser of parsers) {
      this.logger.log(`Starting parser "${parser}"`);
      const res = await this.runOne({ parser, ifcFiles, outputDir });
      results.push(res);
    }

    return results;
  }

  private async runOne(params: ParserRunProps): Promise<ParserRunResult> {
    const { parser, ifcFiles, outputDir } = params;
    const dir = path.resolve(process.cwd(), "_external", parser);
    const scriptName =
      process.env["PARSERS_LOCAL"] === "true" ? "run-local.sh" : "run.sh";
    const scriptPath = path.join(dir, scriptName);

    const doesParserExist = await fs
      .access(scriptPath)
      .then(() => true)
      .catch(() => false);

    if (!doesParserExist) {
      return getEmptyResult(dir);
    }

    if (ifcFiles.length === 0) {
      throw new Error("Nie podano żadnych plików IFC.");
    }

    const started = Date.now();

    const child = spawn(
      "bash",
      [scriptPath, JSON.stringify(ifcFiles), `${outputDir}/${parser}`],
      {
        cwd: dir,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      },
    );

    child.stdout?.on("data", (buffer: Buffer) => {
      const text = buffer.toString();
      process.stdout.write(text);
    });
    child.stderr?.on("data", (buffer: Buffer) => {
      const text = buffer.toString();
      process.stderr.write(text);
    });

    const exit = await new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
      }, TIMEOUT_MS);

      child.on("close", (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal });
      });
    });

    const durationMs = Date.now() - started;
    const hasError = exit.code !== 0;

    return {
      name: parser,
      errors: hasError ? [`Process exited with code ${exit.code}`] : [],
      durationMs,
    };
  }
}

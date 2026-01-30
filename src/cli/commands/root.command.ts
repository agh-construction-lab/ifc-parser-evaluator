import { CommandRunner, RootCommand } from "nest-commander";
import { ExecuteParsersCommand } from "./execute-parsers.command";
import path from "path";

const PARSERS = ["web-ifc-0.0.68", "ifcopenshell-0.8.4"];
const IFC_FILES = ["_ifc-input/primitives/primitive-beam.ifc"].map((p) =>
  path.resolve(process.cwd(), p),
);

// const EXPERIMENT_ID = "2026-01-30__10-26-00";
const EXPERIMENT_ID = new Date()
  .toISOString()
  .replace(/:/g, "-")
  .replace("T", "__")
  .split(".")[0];

const OUTPUT_DIR = path.resolve(process.cwd(), `_ifc-output/${EXPERIMENT_ID}`);

@RootCommand({
  name: "ifc-parser-evaluator",
  description: "Default command",
})
export class AppRootCommand extends CommandRunner {
  constructor(private readonly rootCommand: ExecuteParsersCommand) {
    super();
  }

  async run(args: Array<string>): Promise<void> {
    await this.rootCommand.run(args, {
      parsers: PARSERS,
      ifcFiles: IFC_FILES,
      outputDir: OUTPUT_DIR,
    });
  }
}

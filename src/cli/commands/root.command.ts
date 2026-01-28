import { CommandRunner, RootCommand } from "nest-commander";
import { ExecuteParsersCommand } from "./execute-parsers.command";

const PARSERS = ["A", "B", "C"];
const IFC_FILES = ["example1.ifc", "example2.ifc"];

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
    });
  }
}

import { Command, CommandRunner } from "nest-commander";
import { ParsersRunnerService } from "../../parsers-runner/parsers-runner.service";
import { Logger } from "@nestjs/common";

type Props = {
  parsers: Array<string>;
  ifcFiles: Array<string>;
  outputDir: string;
};

@Command({
  name: "execute-parsers",
  description: "Executes all parsers on the given IFC files",
  arguments: "<ifcFiles...>",
})
class ExecuteParsersCommand extends CommandRunner {
  private readonly logger = new Logger(ExecuteParsersCommand.name);

  constructor(private readonly parsersRunnerService: ParsersRunnerService) {
    super();
  }

  async run(args: Array<string>, props: Props): Promise<void> {
    this.logger.log("Running parsers...");
    const results = await this.parsersRunnerService.runAll(props);

    for (const parsingResult of results) {
      const { name, errors, durationMs } = parsingResult;

      if (errors.length === 0) {
        this.logger.log(
          `Parser "${name}" completed successfully in ${durationMs}ms`,
        );
      } else {
        errors.forEach((err) =>
          this.logger.error(`Parser "${name}" error: ${err}`),
        );
      }
    }

    this.logger.log("All parsers executed successfully!");
  }
}

export type { Props as ExecuteParsersCommandProps };
export { ExecuteParsersCommand };

import { Command, CommandRunner } from "nest-commander";
import { ParsersRunnerService } from "../../parsers-runner/parsers-runner.service";
import { Logger } from "@nestjs/common";
import { GeometryRendererService } from "src/geometry-renderer/geometry-renderer.service";
import { ResultsComparerService } from "src/results-comparer/results-comparer.service";

type Props = {
  parsers: Array<string>;
  ifcFiles: Array<string>;
};

@Command({
  name: "execute-parsers",
  description: "Executes all parsers on the given IFC files",
  arguments: "<ifcFiles...>",
})
class ExecuteParsersCommand extends CommandRunner {
  private readonly logger = new Logger(ExecuteParsersCommand.name);

  constructor(
    private readonly parsersRunnerService: ParsersRunnerService,
    private readonly geometryRendererService: GeometryRendererService,
    private readonly resultsComparerService: ResultsComparerService,
  ) {
    super();
  }

  async run(args: Array<string>, { parsers, ifcFiles }: Props): Promise<void> {
    const results = await this.parsersRunnerService.runAll(parsers, ifcFiles);

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

    this.geometryRendererService.runServer();
    await this.resultsComparerService.compareResults(
      "results/web-ifc",
      "results/ifc-open-shell",
    );

    // for (const r of results) {
    //   console.log(
    //     `\n=== ${r.id} (${r.ok ? "OK" : "FAIL"}) ${r.durationMs}ms ===`,
    //   );
    //   if (r.stdout.trim()) console.log(r.stdout.trim());
    //   if (r.stderr.trim()) console.error(r.stderr.trim());
    // }

    // // if any parser failed, set exit code to 1
    // if (results.some((r) => !r.ok)) {
    //   process.exitCode = 1;
    // }
  }
}

export type { Props as ExecuteParsersCommandProps };
export { ExecuteParsersCommand };

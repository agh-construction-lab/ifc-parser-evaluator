import { Command, CommandRunner } from "nest-commander";
import { ParsersRunnerService } from "../../parsers-runner/parsers-runner.service";
import { Logger } from "@nestjs/common";
import { GeometryRendererService } from "src/geometry-renderer/geometry-renderer.service";
import { WebBrowserService } from "src/results-comparer/services/web-browser.service";
import * as path from "path";
import * as fs from "fs";

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

  constructor(
    private readonly parsersRunnerService: ParsersRunnerService,
    private readonly geometryRendererService: GeometryRendererService,
    private readonly webBrowserService: WebBrowserService,
  ) {
    super();
  }

  async run(args: Array<string>, props: Props): Promise<void> {
    const { parsers, ifcFiles, outputDir } = props;

    // Step 1: Run all parsers
    this.logger.log("Step 1: Running parsers...");
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

    // Step 2: Start geometry renderer server
    this.logger.log("Step 2: Starting geometry renderer server...");
    const server = await this.geometryRendererService.runServer();
    const serverUrl = this.geometryRendererService.getServerUrl();

    try {
      // Step 3: Initialize headless browser
      this.logger.log("Step 3: Initializing headless browser...");
      await this.webBrowserService.init(serverUrl);

      // Step 4: Generate screenshots for each result file
      this.logger.log("Step 4: Generating screenshots...");
      const resultFiles = this.findResultFiles(outputDir, parsers, ifcFiles);

      for (const resultFile of resultFiles) {
        await this.webBrowserService.prepareResultImages(resultFile);
      }

      this.logger.log(
        `Generated screenshots for ${resultFiles.length} result files`,
      );
    } finally {
      // Cleanup
      await this.webBrowserService.kill();
      await server.kill();
    }

    this.logger.log("Pipeline completed successfully!");
  }

  /**
   * Find all result JSON files in the output directory
   */
  private findResultFiles(
    outputDir: string,
    parsers: Array<string>,
    ifcFiles: Array<string>,
  ): Array<string> {
    const resultFiles: Array<string> = [];

    for (const parser of parsers) {
      for (const ifcFile of ifcFiles) {
        const ifcFileName = path.basename(ifcFile, ".ifc");
        const resultFilePath = path.join(
          outputDir,
          parser,
          ifcFileName,
          `${ifcFileName}.json`,
        );

        if (fs.existsSync(resultFilePath)) {
          resultFiles.push(resultFilePath);
        } else {
          this.logger.warn(`Result file not found: ${resultFilePath}`);
        }
      }
    }

    return resultFiles;
  }
}

export type { Props as ExecuteParsersCommandProps };
export { ExecuteParsersCommand };

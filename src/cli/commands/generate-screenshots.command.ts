import { Command, CommandRunner } from "nest-commander";
import { Logger } from "@nestjs/common";
import { GeometryRendererService } from "src/geometry-renderer/geometry-renderer.service";
import { WebBrowserService } from "src/geometry-renderer/web-browser.service";
import * as path from "path";
import * as fs from "fs";

type Props = {
  parsers: Array<string>;
  ifcFiles: Array<string>;
  outputDir: string;
};

@Command({
  name: "generate-screenshots",
  description:
    "Generates screenshots for parsed IFC results using headless browser",
  arguments: "<ifcFiles...>",
})
class GenerateScreenshotsCommand extends CommandRunner {
  private readonly logger = new Logger(GenerateScreenshotsCommand.name);

  constructor(
    private readonly geometryRendererService: GeometryRendererService,
    private readonly webBrowserService: WebBrowserService,
  ) {
    super();
  }

  async run(args: Array<string>, props: Props): Promise<void> {
    const { parsers, ifcFiles, outputDir } = props;

    // Start geometry renderer server
    this.logger.log("Starting geometry renderer server...");
    const server = await this.geometryRendererService.runServer();
    const serverUrl = this.geometryRendererService.getServerUrl();

    try {
      // Initialize headless browser
      this.logger.log("Initializing headless browser...");
      await this.webBrowserService.init(serverUrl);

      // Generate screenshots for each result file
      this.logger.log("Generating screenshots...");
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

    this.logger.log("Screenshots generation completed!");
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

export type { Props as GenerateScreenshotsCommandProps };
export { GenerateScreenshotsCommand };

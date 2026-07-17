import { Command, CommandRunner } from "nest-commander";
import { Logger } from "@nestjs/common";
import { GeometryRendererService } from "src/geometry-renderer/geometry-renderer.service";
import { WebBrowserService } from "src/geometry-renderer/web-browser.service";
import { computeRenderFrames } from "src/geometry-renderer/bbox.utils";
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

    this.logger.log("Starting geometry renderer server...");
    const server = await this.geometryRendererService.runServer();
    const serverUrl = this.geometryRendererService.getServerUrl();

    try {
      this.logger.log("Initializing headless browser...");
      await this.webBrowserService.init(serverUrl);

      // Group result JSONs by IFC file. Each parser-output gets its own local
      // bbox (for centering on screen) plus a shared frustum size across all
      // parsers of the same IFC file (so every render lands at the same zoom).
      // See computeRenderFrames doc for the rationale.
      const resultFilesByIfc = this.groupResultFilesByIfc(
        outputDir,
        parsers,
        ifcFiles,
      );

      this.logger.log("Generating screenshots...");
      let totalRendered = 0;

      for (const [ifcFileName, jsonFiles] of resultFilesByIfc) {
        const frames = computeRenderFrames(jsonFiles);
        if (frames.size === 0) {
          this.logger.warn(
            `No geometry across any parser for ${ifcFileName} — skipping render`,
          );
          continue;
        }

        for (const jsonFile of jsonFiles) {
          const frame = frames.get(jsonFile);
          if (!frame) {
            this.logger.warn(
              `No geometry in ${jsonFile} — skipping render`,
            );
            continue;
          }
          await this.webBrowserService.setRenderFrame(frame);
          await this.webBrowserService.prepareResultImages(jsonFile);
          totalRendered++;
        }
      }

      this.logger.log(
        `Generated screenshots for ${totalRendered} result files`,
      );
    } finally {
      await this.webBrowserService.kill();
      await server.kill();
    }

    this.logger.log("Screenshots generation completed!");
  }

  /**
   * Group result JSON file paths by their IFC file name. Order within each
   * group follows the input `parsers` order. Files that don't exist on disk
   * are skipped (with a warning) but don't break the grouping.
   */
  private groupResultFilesByIfc(
    outputDir: string,
    parsers: Array<string>,
    ifcFiles: Array<string>,
  ): Map<string, Array<string>> {
    const grouped = new Map<string, Array<string>>();

    for (const ifcFile of ifcFiles) {
      const ifcFileName = path.basename(ifcFile, ".ifc");
      const jsonFiles: Array<string> = [];

      for (const parser of parsers) {
        const resultFilePath = path.join(
          outputDir,
          parser,
          ifcFileName,
          `${ifcFileName}.json`,
        );

        if (fs.existsSync(resultFilePath)) {
          jsonFiles.push(resultFilePath);
        } else {
          this.logger.warn(`Result file not found: ${resultFilePath}`);
        }
      }

      if (jsonFiles.length > 0) {
        grouped.set(ifcFileName, jsonFiles);
      }
    }

    return grouped;
  }
}

export type { Props as GenerateScreenshotsCommandProps };
export { GenerateScreenshotsCommand };

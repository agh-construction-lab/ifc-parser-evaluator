import { Command, CommandRunner } from "nest-commander";
import { Logger } from "@nestjs/common";
import { ImageComparerService } from "src/results-comparer/services/image-comparer.service";
import { ComparisonResult } from "src/results-comparer/types/comparison.types";
import { RENDER_VIEWS } from "src/geometry-renderer/web-browser.service";
import * as path from "path";

type Props = {
  parsers: Array<string>;
  ifcFiles: Array<string>;
  outputDir: string;
  comparisons: Array<ComparisonResult>;
};

@Command({
  name: "compare-images",
  description: "Compares rendered screenshots and generates diff images",
  arguments: "<ifcFiles...>",
})
class CompareImagesCommand extends CommandRunner {
  private readonly logger = new Logger(CompareImagesCommand.name);

  constructor(private readonly imageComparerService: ImageComparerService) {
    super();
  }

  run(args: Array<string>, props: Props): Promise<void> {
    const { parsers, ifcFiles, outputDir, comparisons } = props;

    this.logger.log("Comparing images...");
    this.compareImages(outputDir, parsers, ifcFiles, comparisons);

    this.logger.log("Image comparison completed!");
    return Promise.resolve();
  }

  private compareImages(
    outputDir: string,
    parsers: Array<string>,
    ifcFiles: Array<string>,
    comparisons: Array<ComparisonResult>,
  ): void {
    void parsers;

    for (const ifcFile of ifcFiles) {
      const ifcFileName = path.basename(ifcFile, ".ifc");

      const comparison = comparisons.find((c) => c.ifcFileName === ifcFileName);
      if (!comparison) {
        this.logger.warn(`No comparison found for ${ifcFileName}`);
        continue;
      }

      const diffOutputDir = path.join(outputDir, "_comparison", ifcFileName);
      const parserResults = comparison.parsers.map((parser) => ({
        parserId: parser.parserId,
        parserName: parser.parserName,
        parserVersion: parser.parserVersion,
        resultDir: path.dirname(parser.outputFilePath),
      }));

      comparison.images = this.imageComparerService.buildPairwiseComparisons(
        parserResults,
        diffOutputDir,
        [...RENDER_VIEWS],
      );

      this.logger.log(`Compared images for: ${ifcFileName}`);
    }
  }
}

export type { Props as CompareImagesCommandProps };
export { CompareImagesCommand };

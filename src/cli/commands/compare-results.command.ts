import { Command, CommandRunner } from "nest-commander";
import { Logger } from "@nestjs/common";
import { ComparisonService } from "src/results-comparer/services/comparison.service";
import { ComparisonResult } from "src/results-comparer/types/comparison.types";
import * as path from "path";
import * as fs from "fs";

type Props = {
  parsers: Array<string>;
  ifcFiles: Array<string>;
  outputDir: string;
};

@Command({
  name: "compare-results",
  description: "Compares parser JSON outputs",
  arguments: "<ifcFiles...>",
})
class CompareResultsCommand extends CommandRunner {
  private readonly logger = new Logger(CompareResultsCommand.name);
  private lastComparisons: Array<ComparisonResult> = [];

  constructor(private readonly comparisonService: ComparisonService) {
    super();
  }

  run(args: Array<string>, props: Props): Promise<void> {
    const { parsers, ifcFiles, outputDir } = props;

    this.logger.log("Comparing JSON results...");
    this.lastComparisons = this.compareResults(outputDir, parsers, ifcFiles);

    this.logger.log(`Compared ${this.lastComparisons.length} IFC files`);
    return Promise.resolve();
  }

  /**
   * Get the comparisons from the last run
   */
  getLastComparisons(): Array<ComparisonResult> {
    return this.lastComparisons;
  }

  /**
   * Compare results across parsers for each IFC file
   */
  private compareResults(
    outputDir: string,
    parsers: Array<string>,
    ifcFiles: Array<string>,
  ): Array<ComparisonResult> {
    const comparisons: Array<ComparisonResult> = [];

    for (const ifcFile of ifcFiles) {
      const ifcFileName = path.basename(ifcFile, ".ifc");

      // Collect result file paths for all parsers
      const parserOutputPaths = parsers
        .map((parser) =>
          path.join(outputDir, parser, ifcFileName, `${ifcFileName}.json`),
        )
        .filter((p) => fs.existsSync(p));

      if (parserOutputPaths.length < 2) {
        this.logger.warn(
          `Skipping comparison for ${ifcFileName}: need at least 2 parser results`,
        );
        continue;
      }

      // Compare data
      const comparison = this.comparisonService.compareParserOutputs(
        ifcFileName,
        parserOutputPaths,
      );

      comparisons.push(comparison);
      this.logger.log(`Compared JSON results for: ${ifcFileName}`);
    }

    return comparisons;
  }
}

export type { Props as CompareResultsCommandProps };
export { CompareResultsCommand };

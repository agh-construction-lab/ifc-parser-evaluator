import { CommandRunner, RootCommand } from "nest-commander";
import { ExecuteParsersCommand } from "./execute-parsers.command";
import { GenerateScreenshotsCommand } from "./generate-screenshots.command";
import { CompareResultsCommand } from "./compare-results.command";
import { CompareImagesCommand } from "./compare-images.command";
import { GenerateReportCommand } from "./generate-report.command";
import { Logger } from "@nestjs/common";
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
  description: "Default command - orchestrates the full IFC parsing pipeline",
})
export class AppRootCommand extends CommandRunner {
  private readonly logger = new Logger(AppRootCommand.name);

  constructor(
    private readonly executeParsersCommand: ExecuteParsersCommand,
    private readonly generateScreenshotsCommand: GenerateScreenshotsCommand,
    private readonly compareResultsCommand: CompareResultsCommand,
    private readonly compareImagesCommand: CompareImagesCommand,
    private readonly generateReportCommand: GenerateReportCommand,
  ) {
    super();
  }

  async run(args: Array<string>): Promise<void> {
    const props = {
      parsers: PARSERS,
      ifcFiles: IFC_FILES,
      outputDir: OUTPUT_DIR,
    };

    // Step 1: Execute parsers
    this.logger.log("Step 1: Executing parsers...");
    await this.executeParsersCommand.run(args, props);

    // Step 2: Generate screenshots
    this.logger.log("Step 2: Generating screenshots...");
    await this.generateScreenshotsCommand.run(args, props);

    // Step 3: Compare JSON results
    this.logger.log("Step 3: Comparing JSON results...");
    await this.compareResultsCommand.run(args, props);
    const comparisons = this.compareResultsCommand.getLastComparisons();

    // Step 4: Compare images
    this.logger.log("Step 4: Comparing images...");
    await this.compareImagesCommand.run(args, { ...props, comparisons });

    // Step 5: Generate report
    this.logger.log("Step 5: Generating report...");
    await this.generateReportCommand.run(args, {
      outputDir: OUTPUT_DIR,
      comparisons,
    });

    this.logger.log("Pipeline completed successfully!");
  }
}

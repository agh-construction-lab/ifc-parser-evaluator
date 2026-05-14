import { CommandRunner, RootCommand } from "nest-commander";
import { ExecuteParsersCommand } from "./execute-parsers.command";
import { GenerateScreenshotsCommand } from "./generate-screenshots.command";
import { CompareResultsCommand } from "./compare-results.command";
import { CompareImagesCommand } from "./compare-images.command";
import { GenerateReportCommand } from "./generate-report.command";
import { Logger } from "@nestjs/common";
import path from "path";

const PARSERS = ["web-ifc-0.0.68", "ifcopenshell-0.8.4", "ifc-lite-2.1.3"];
const IFC_FILES = [
  "_ifc-input/agh/IDS_B_LOD1.ifc",
  "_ifc-input/agh/IDS_B_LOD2_ARCH.ifc",
  "_ifc-input/agh/IDS_B_LOD2_STRU.ifc",
  "_ifc-input/agh/IDS_B_LOD3_ARCH.ifc",
  "_ifc-input/agh/IDS_B_LOD3_STRU.ifc",
  "_ifc-input/agh/IDS_B_LOD4_ARCH.ifc",
  "_ifc-input/agh/IDS_B_LOD4_STRU.ifc",
  "_ifc-input/agh/IDSB-AGH-ELE-CZEREMCHA-3D.ifc",
  "_ifc-input/agh/IDSB-AGH-HVAC-CZEREMCHA-3D.ifc",
  "_ifc-input/agh/IDSI-AGH-ARC-CZEREMCHA-3D.ifc",
  "_ifc-input/agh/K-PSA-0001-AGH-PKO-PW-353-014+250-014+550-XX-TOR-MKO-00001.ifc",
  "_ifc-input/agh/K-PSA-0001-AGH-PKO-PW-353-014+250-014+550-XX-TOR-MKO-00002.ifc",

  "_ifc-input/primitives/primitive-beam.ifc",
  "_ifc-input/primitives/primitive-column.ifc",
  "_ifc-input/primitives/primitive-door.ifc",
  "_ifc-input/primitives/primitive-duct.ifc",
  "_ifc-input/primitives/primitive-slab.ifc",
  "_ifc-input/primitives/primitive-wall.ifc",

  // "_ifc-input/others/AC-20-Smiley-West-10-Bldg.ifc",
].map((p) => path.resolve(process.cwd(), p));

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

import { Command, CommandRunner } from "nest-commander";
import { Logger } from "@nestjs/common";
import { ReportGeneratorService } from "src/results-comparer/services/report-generator.service";
import { ComparisonResult } from "src/results-comparer/types/comparison.types";
import * as path from "path";

type Props = {
  outputDir: string;
  comparisons: Array<ComparisonResult>;
};

@Command({
  name: "generate-report",
  description: "Generates HTML and JSON comparison reports",
})
class GenerateReportCommand extends CommandRunner {
  private readonly logger = new Logger(GenerateReportCommand.name);

  constructor(private readonly reportGeneratorService: ReportGeneratorService) {
    super();
  }

  async run(args: Array<string>, props: Props): Promise<void> {
    const { outputDir, comparisons } = props;

    this.logger.log("Generating reports...");

    const comparisonDir = path.join(outputDir, "_comparison");
    const reportLinks: Array<{ name: string; path: string }> = [];

    // Generate per-file reports
    for (const comparison of comparisons) {
      const fileOutputDir = path.join(comparisonDir, comparison.ifcFileName);

      const report = this.reportGeneratorService.generateReport(
        [comparison],
        fileOutputDir,
      );

      const reportJsonPath = path.join(fileOutputDir, "comparison-report.json");
      const reportHtmlPath = path.join(fileOutputDir, "comparison-report.html");

      this.reportGeneratorService.saveReportJson(report, reportJsonPath);
      this.reportGeneratorService.generateHtmlReport(report, reportHtmlPath);

      reportLinks.push({
        name: comparison.ifcFileName,
        path: `_comparison/${comparison.ifcFileName}/comparison-report.html`,
      });

      this.logger.log(`Report saved: ${reportHtmlPath}`);
    }

    // Generate index.html with links to all reports
    const indexPath = path.join(outputDir, "index.html");
    this.reportGeneratorService.generateIndexHtml(reportLinks, indexPath);
    this.logger.log(`Index saved: ${indexPath}`);

    this.logger.log("Report generation completed!");

    return Promise.resolve();
  }
}

export type { Props as GenerateReportCommandProps };
export { GenerateReportCommand };

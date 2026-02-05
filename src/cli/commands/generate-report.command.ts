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

    this.logger.log("Generating report...");

    const report = this.reportGeneratorService.generateReport(
      comparisons,
      outputDir,
    );

    const reportJsonPath = path.join(outputDir, "comparison-report.json");
    const reportHtmlPath = path.join(outputDir, "comparison-report.html");

    this.reportGeneratorService.saveReportJson(report, reportJsonPath);
    this.reportGeneratorService.generateHtmlReport(report, reportHtmlPath);

    this.logger.log(`Report saved: ${reportHtmlPath}`);
    this.logger.log("Report generation completed!");

    return Promise.resolve();
  }
}

export type { Props as GenerateReportCommandProps };
export { GenerateReportCommand };

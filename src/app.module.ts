import { Module } from "@nestjs/common";
import { AppRootCommand } from "./cli/commands/root.command";
import { ExecuteParsersCommand } from "./cli/commands/execute-parsers.command";
import { GenerateScreenshotsCommand } from "./cli/commands/generate-screenshots.command";
import { CompareResultsCommand } from "./cli/commands/compare-results.command";
import { CompareImagesCommand } from "./cli/commands/compare-images.command";
import { GenerateReportCommand } from "./cli/commands/generate-report.command";
import { ParsersRunnerService } from "./parsers-runner/parsers-runner.service";
import { GeometryRendererModule } from "./geometry-renderer/geometry-renderer.module";
import { ResultsComparerModule } from "./results-comparer/results-comparer.module";

@Module({
  imports: [GeometryRendererModule, ResultsComparerModule],
  providers: [
    AppRootCommand,
    ExecuteParsersCommand,
    GenerateScreenshotsCommand,
    CompareResultsCommand,
    CompareImagesCommand,
    GenerateReportCommand,
    ParsersRunnerService,
  ],
})
export class AppModule {}

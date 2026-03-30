import { Module } from "@nestjs/common";
import { AppRootCommand } from "./cli/commands/root.command";
import { ExecuteParsersCommand } from "./cli/commands/execute-parsers.command";
import { GenerateScreenshotsCommand } from "./cli/commands/generate-screenshots.command";
import { CompareResultsCommand } from "./cli/commands/compare-results.command";
import { CompareImagesCommand } from "./cli/commands/compare-images.command";
import { GenerateReportCommand } from "./cli/commands/generate-report.command";
import { ParsersRunnerModule } from "./parsers-runner/parsers-runner.module";
import { GeometryRendererModule } from "./geometry-renderer/geometry-renderer.module";
import { ResultsComparerModule } from "./results-comparer/results-comparer.module";

@Module({
  // `imports` - list of NestJS modules
  imports: [ParsersRunnerModule, GeometryRendererModule, ResultsComparerModule],

  // `providers` - list of classes registered in DI container
  providers: [
    AppRootCommand, // This command is executed when the CLI is run without any subcommands
    ExecuteParsersCommand,
    GenerateScreenshotsCommand,
    CompareResultsCommand,
    CompareImagesCommand,
    GenerateReportCommand,
  ],
})
export class AppModule {}

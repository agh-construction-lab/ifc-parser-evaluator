import { Module } from "@nestjs/common";
import { AppRootCommand } from "./cli/commands/root.command";
import { ExecuteParsersCommand } from "./cli/commands/execute-parsers.command";
import { ParsersRunnerService } from "./parsers-runner/parsers-runner.service";
import { GeometryRendererModule } from "./geometry-renderer/geometry-renderer.module";
import { ResultsComparerModule } from "./results-comparer/results-comparer.module";

@Module({
  imports: [GeometryRendererModule, ResultsComparerModule],
  providers: [AppRootCommand, ExecuteParsersCommand, ParsersRunnerService],
})
export class AppModule {}

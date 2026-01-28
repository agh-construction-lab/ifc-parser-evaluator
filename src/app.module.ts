import { Module } from "@nestjs/common";
import { AppRootCommand } from "./cli/commands/root.command";
import { ExecuteParsersCommand } from "./cli/commands/execute-parsers.command";
import { ParsersRunnerService } from "./parsers-runner/parsers-runner.service";

@Module({
  providers: [AppRootCommand, ExecuteParsersCommand, ParsersRunnerService],
})
export class AppModule {}

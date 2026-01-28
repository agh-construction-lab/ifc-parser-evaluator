import { Module } from "@nestjs/common";
import { ParsersRunnerService } from "./parsers-runner.service";

@Module({
  providers: [ParsersRunnerService],
  exports: [ParsersRunnerService],
})
class ParsersRunnerModule {}

export { ParsersRunnerModule };

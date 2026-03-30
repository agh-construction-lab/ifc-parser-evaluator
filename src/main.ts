import { CommandFactory } from "nest-commander";
import { AppModule } from "./app.module";

async function bootstrap() {
  await CommandFactory.run(AppModule, { logger: ["log", "error", "warn"] });
}

bootstrap().catch((error) => {
  console.error("Error starting the application:", error);
  process.exit(1);
});

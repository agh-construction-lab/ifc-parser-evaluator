import { execSync } from "child_process";

const executeCommand = (commands: Array<string>) => {
  const command = commands.join(" && ");

  console.log(`[execute] ${command}`);

  const stdout = execSync(command, {
    encoding: "utf-8",
    maxBuffer: 9999999999,
  });

  console.log(stdout);

  console.log("[execute] Finished");
};

export { executeCommand };

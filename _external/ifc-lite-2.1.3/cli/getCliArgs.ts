import { parseArgs } from "util";

function getCliArgs() {
  const {
    values: { ifcFiles = "[]", outputDir = "_output-data/ifc-lite" },
  } = parseArgs({
    options: {
      ifcFiles: {
        type: "string",
        alias: "i",
      },
      outputDir: {
        type: "string",
        alias: "o",
      },
    },
  });

  return {
    ifcFiles: JSON.parse(ifcFiles) as Array<string>,
    outputDir,
  };
}

export { getCliArgs };

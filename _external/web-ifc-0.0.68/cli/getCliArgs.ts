import { parseArgs } from "util";

function getCliArgs() {
  const {
    values: { ifcFiles = "[]", outputDir = "_output-data/web-ifc" },
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

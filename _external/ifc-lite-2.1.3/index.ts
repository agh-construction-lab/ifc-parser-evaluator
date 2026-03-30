import fs from "fs";
import { IfcParser } from "@ifc-lite/parser";

import { getCliArgs } from "./cli/getCliArgs.ts";
import { Tree } from "./entities/tree.ts";
import { getAmounts } from "./utils/getAmounts.ts";
import { getGeometryData } from "./utils/getGeometryData.ts";
import type { ParserOutput, SpatialNode } from "./types.ts";

const PARSER_NAME = "ifc-lite";
const PARSER_VERSION = "2.1.3";

function countNodes(nodes: Array<SpatialNode>): number {
  let count = nodes.length;
  for (const node of nodes) {
    count += countNodes(node.children);
  }
  return count;
}

const { ifcFiles, outputDir } = getCliArgs();

for (const filePath of ifcFiles) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`IFC file does not exist: ${filePath}`);
  }
}

const LOG_PREFIX = `[${PARSER_NAME}]`;

const parser = new IfcParser();

for (const filePath of ifcFiles) {
  const startTime = Date.now();
  const sourceFile = filePath.split("/").pop() ?? "unknown.ifc";

  console.log("");
  console.log(LOG_PREFIX, "Processing:", sourceFile);
  console.log("");

  const ifcData = fs.readFileSync(filePath);
  const store = await parser.parseColumnar(ifcData.buffer);

  // Schema
  const schemaVersion = store.schemaVersion;
  console.log(LOG_PREFIX, "Schema:", schemaVersion);

  // All types
  const { amountTotal, amountsByType } = getAmounts(store);
  console.log(LOG_PREFIX, "Total entities:", amountTotal);

  console.log("");

  // Tree
  console.log(LOG_PREFIX, "Building spatial tree...");
  const tree = new Tree(store);
  const spatialTree = tree.getSpatialTree();
  console.log(LOG_PREFIX, "Spatial tree nodes:", countNodes(spatialTree));

  console.log("");

  // Geometry
  console.log(LOG_PREFIX, "Extracting geometries...");
  const ifcContent = ifcData.toString("utf-8");
  const geometries = getGeometryData(ifcContent, store);
  console.log(LOG_PREFIX, "Geometries extracted:", Object.keys(geometries).length);

  const processingTimeMs = Date.now() - startTime;

  const ifcFileName = filePath.split("/").pop() ?? "output";
  const baseName = ifcFileName.replace(".ifc", "");
  const outputDirectoryPath = `${outputDir}/${baseName}`;
  const outputFilePath = `${outputDirectoryPath}/${baseName}.json`;

  fs.mkdirSync(outputDirectoryPath, { recursive: true });

  const result: ParserOutput = {
    metadata: {
      parserName: PARSER_NAME,
      parserVersion: PARSER_VERSION,
      sourceFile,
      schemaVersion,
      processedAt: new Date().toISOString(),
      processingTimeMs,
    },
    summary: {
      totalEntityCount: amountTotal,
      entityCountByType: amountsByType,
    },
    spatialTree,
    geometries,
  };

  fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 4));

  console.log("");
  console.log(LOG_PREFIX, "Completed in", processingTimeMs, "ms");
  console.log(LOG_PREFIX, "Output:", outputFilePath);
  console.log("");
}

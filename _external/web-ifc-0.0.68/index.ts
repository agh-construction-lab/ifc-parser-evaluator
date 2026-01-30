import fs from "fs";
import {
  FILE_SCHEMA,
  IfcAPI,
  IFCBUILDINGELEMENT,
  IFCBUILTELEMENT,
  IFCOPENINGELEMENT,
  IFCOPENINGSTANDARDCASE,
  IFCPRODUCT,
  IFCSPACE,
} from "web-ifc";

import { getCliArgs } from "./cli/getCliArgs.ts";
import { Tree } from "./entities/tree.ts";
import { getAmounts } from "./utils/getAmounts.ts";
import { getGeometryData } from "./utils/getGeometryData.ts";
import { ParserOutput, SpatialNode } from "./types.ts";

const PARSER_NAME = "web-ifc";

function countNodes(nodes: Array<SpatialNode>): number {
  let count = nodes.length;
  for (const node of nodes) {
    count += countNodes(node.children);
  }
  return count;
}
const PARSER_VERSION = "0.0.68";

const { ifcFiles, outputDir } = getCliArgs();

for (const filePath of ifcFiles) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`IFC file does not exist: ${filePath}`);
  }
}

const ifcApi = new IfcAPI();
await ifcApi.Init();

const LOG_PREFIX = `[${PARSER_NAME}]`;

for (const filePath of ifcFiles) {
  const startTime = Date.now();
  const sourceFile = filePath.split("/").pop() ?? "unknown.ifc";
  
  console.log("");
  console.log(LOG_PREFIX, "Processing:", sourceFile);
  console.log("");

  const ifcData = fs.readFileSync(filePath);
  const modelID = ifcApi.OpenModel(ifcData, { COORDINATE_TO_ORIGIN: false });

  // Schema
  const headerLine = ifcApi.GetHeaderLine(modelID, FILE_SCHEMA) as {
    arguments: Array<Array<{ value: string }>>;
  };
  const schemaName = headerLine.arguments[0][0].value;
  console.log(LOG_PREFIX, "Schema:", schemaName);

  // All types
  const { amountTotal, amountsByType } = getAmounts(modelID, ifcApi);
  console.log(LOG_PREFIX, "Total entities:", amountTotal);

  // IfcProduct
  const products = ifcApi.GetLineIDsWithType(modelID, IFCPRODUCT, true);

  const skipTypes = [IFCSPACE, IFCOPENINGELEMENT, IFCOPENINGSTANDARDCASE];
  const productsWithoutSkipTypes: Array<number> = [];
  for (let i = 0; i < products.size(); i++) {
    const id = products.get(i);
    const type = ifcApi.GetLineType(modelID, id) as number;
    if (!skipTypes.includes(type)) {
      productsWithoutSkipTypes.push(id);
    }
  }
  // ###

  // IfcBuildingElement
  let elements;
  if (schemaName.includes("IFC4X3")) {
    elements = ifcApi.GetLineIDsWithType(modelID, IFCBUILTELEMENT, true);
  } else {
    elements = ifcApi.GetLineIDsWithType(modelID, IFCBUILDINGELEMENT, true);
  }
  // ###

  // Tree
  console.log(LOG_PREFIX, "Building spatial tree...");
  const tree = new Tree(ifcApi, modelID);
  await tree.init();
  const spatialTree = tree.getSpatialTree();
  console.log(LOG_PREFIX, "Spatial tree nodes:", countNodes(spatialTree));
  // ###

  console.log("");

  // Geometry
  console.log(LOG_PREFIX, "Extracting geometries...");
  const geometries = getGeometryData(ifcApi, modelID);
  console.log(LOG_PREFIX, "Geometries extracted:", Object.keys(geometries).length);
  // ###

  const processingTimeMs = Date.now() - startTime;

  const ifcFileName = filePath.split("/").pop() ?? "output";
  const outputFilePath = `${outputDir}/${ifcFileName}`.replace(".ifc", ".json");
  const outputFileName = outputFilePath.split("/").pop() ?? "";
  const outputDirectoryPath = outputFilePath.replace(outputFileName, "");

  fs.mkdirSync(outputDirectoryPath, { recursive: true });

  const result: ParserOutput = {
    metadata: {
      parserName: PARSER_NAME,
      parserVersion: PARSER_VERSION,
      sourceFile,
      schemaVersion: schemaName,
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

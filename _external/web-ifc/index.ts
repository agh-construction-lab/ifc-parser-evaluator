import fs from "fs";
import path from "path";
import { FILE_SCHEMA, IfcAPI, IFCBUILDINGELEMENT, IFCBUILTELEMENT, IFCOPENINGELEMENT, IFCOPENINGSTANDARDCASE, IFCPRODUCT, IFCSPACE } from "web-ifc";
import { parseArgs } from "util";

import { Tree } from "./tree.ts";
import { getAmounts } from "./utils/getAmounts.ts";
import { getGeometryData } from "./utils/getGeometryData.ts";

const outputDirectory = path.join("_output-data", "web-ifc");
const {
  values: { ifcFiles = "" },
} = parseArgs({
  options: {
    ifcFiles: {
      type: "string",
      alias: "i",
    },
  },
});

const ifcFilesArray = ifcFiles.split(",");
const ifcApi = new IfcAPI();

await ifcApi.Init();

type ResultData = {
  amountTotal: number;
  amountsByType: Record<string, number>;
  treeData: any;
  geometryData: Record<
    string,
    { positions: Array<number>; normals: Array<number>; indexes: Array<number> }
  >;
};

for (const filePath of ifcFilesArray) {
  console.log("[web-ifc]", "Processing:", filePath);

  const ifcData = fs.readFileSync(filePath);
  const modelID = ifcApi.OpenModel(ifcData, { COORDINATE_TO_ORIGIN: false });

  // All types
  const { amountTotal, amountsByType } = getAmounts(modelID, ifcApi);
  console.log("Amount of all entities: ", amountTotal);

  // IfcProduct
  const products = ifcApi.GetLineIDsWithType(modelID, IFCPRODUCT, true);
  console.log("Amount of IfcProduct entities: ", products.size());

  const skipTypes = [IFCSPACE, IFCOPENINGELEMENT, IFCOPENINGSTANDARDCASE];
  const productsWithoutSkipTypes: Array<number> = [];
  for (let i = 0; i < products.size(); i++) {
    const id = products.get(i);
    const type = ifcApi.GetLineType(modelID, id);
    if (!skipTypes.includes(type)) {
      productsWithoutSkipTypes.push(id);
    }
  }

  console.log(
    "Amount of IfcProduct entities without [IfcSpace, IfcOpeningElement, IfcOpeningStandardCase]: ",
    productsWithoutSkipTypes.length,
  );
  // ###

  console.log("");

  // IfcBuildingElement

  let schemaName = ifcApi.GetHeaderLine(modelID, FILE_SCHEMA).arguments[0][0].value;

  let elements;

  console.log("Schema name: ", schemaName);
  if (schemaName.includes("IFC4X3")) {
    elements = ifcApi.GetLineIDsWithType(modelID, IFCBUILTELEMENT, true); // 1272
  } else {
    elements = ifcApi.GetLineIDsWithType(modelID, IFCBUILDINGELEMENT, true); // 1272
  }
  console.log("Amount of IfcBuildingElement entities: ", elements.size());
  // ###

  console.log("");

  // Tree
  const tree = new Tree(ifcApi, modelID);
  await tree.init();
  const treeData = tree.getGroupedByType();
  // ###

  // Geometry
  const geometryData = getGeometryData(ifcApi, modelID);
  // ###


  const outputFilePath = filePath
    .replace("_input-data", outputDirectory)
    .replace(".ifc", ".json");
  const outputFileName = outputFilePath.split("/").pop() ?? "";
  const outputDirectoryPath = outputFilePath.replace(outputFileName, "");

  fs.mkdirSync(outputDirectoryPath, { recursive: true });

  const result: ResultData = {
    amountTotal,
    amountsByType,
    treeData,
    geometryData,
  };

  fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 4));
}


import fs from "fs";
import path from "path";
import { getAbsolutePath } from "../core/pathUtils.ts";

import { runServer } from "../geometry-renderer/server/index.ts";
import { WebBrowser, renderViews } from "./web-browser/WebBrowser.ts"

import { ImageComparer } from "./entities/ImageComparer.ts";
import { getAmountsDifferences, getTreeDifferences } from "./results.ts";
import { CORRECT, INCORRECT } from "./constants.ts";
import { ResultsFile } from "./entities/ResultsFile.ts";
import { getNumberOfUniqueVertices } from "./utils/getAmountOfUniqueVertices.ts";


const RESULTS_DIRECTORY = getAbsolutePath("./_output-data/");
const GEOMETRIES_RESULTS_DIRECTORY = getAbsolutePath("./_output-data/geometries/");
const IMAGES_DIFF_DIRECTORY_PATH = getAbsolutePath("./_output-data/pixel-wise-differences/");

const imageComparer = new ImageComparer();

async function compareResults() {
  console.log("Comparing results");

  const server = await runServer();
  const webBrowser = new WebBrowser();
  await webBrowser.init();

  const rootResults = new ResultsFile<[string, string, string, string]>({
    filePath: path.join(RESULTS_DIRECTORY, "results.csv"),
  })

  const webIfc__resultsDirectory = getAbsolutePath("./_output-data/web-ifc");
  const webIfc__results = fs
    .readdirSync(webIfc__resultsDirectory, { recursive: true, encoding: "utf-8" })
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(webIfc__resultsDirectory, file));

  const ifcOpenShell__resultsDirectory = getAbsolutePath("./_output-data/ifcopenshell");
  const ifcOpenShell__results = fs
    .readdirSync(ifcOpenShell__resultsDirectory, { recursive: true, encoding: "utf-8" })
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(ifcOpenShell__resultsDirectory, file));

  console.log("");

  for (let i = 0; i < webIfc__results.length; i++) {
    const resultName = path.basename(webIfc__results[i], ".json");
    console.log("Analyzing:", resultName);
    rootResults.addRow([`### ${resultName}`, "", "", ""]);

    const webIfc__filePath = webIfc__results[i];
    const ifcOpenShell__filePath = ifcOpenShell__results[i];

    await webBrowser.prepareResultImages(webIfc__filePath);
    await webBrowser.prepareResultImages(ifcOpenShell__filePath);

    const webIfc__resultsData = JSON.parse(fs.readFileSync(webIfc__filePath, { encoding: "utf-8" }));
    const ifcOpenShell__resultsData = JSON.parse(fs.readFileSync(ifcOpenShell__filePath, { encoding: "utf-8" }));

    // DATA COMPARISON
    const statusAmountTotal = webIfc__resultsData.amountTotal === ifcOpenShell__resultsData.amountTotal ? CORRECT : INCORRECT;
    rootResults.addRow(["Amount of elements", statusAmountTotal, ifcOpenShell__resultsData.amountTotal, ifcOpenShell__resultsData.amountTotal]);


    const ifcJs__amountOfTypes = Object.keys(webIfc__resultsData.amountsByType).length;
    const ifcOpenShell__amountOfTypes = Object.keys(ifcOpenShell__resultsData.amountsByType).length;
    const statusAmountOfTypes = ifcJs__amountOfTypes === ifcOpenShell__amountOfTypes ? CORRECT : INCORRECT;
    rootResults.addRow(["Amount of types", statusAmountOfTypes, ifcJs__amountOfTypes.toString(), ifcOpenShell__amountOfTypes.toString()]);

    const amountsDifferences = getAmountsDifferences(webIfc__resultsData.amountsByType, ifcOpenShell__resultsData.amountsByType);
    const areAmountsByTypeEqual = Object.keys(amountsDifferences).length === 0;
    const statusAmountsByType = areAmountsByTypeEqual ? CORRECT : INCORRECT;
    rootResults.addRow(["Amounts by type", statusAmountsByType, "", ""]);

    if (areAmountsByTypeEqual === false) {
      console.log("Amounts differences:", amountsDifferences);
    }

    /**
     * SPATICAL TREE
     */
    const treesDifferences = getTreeDifferences(webIfc__resultsData.treeData, ifcOpenShell__resultsData.treeData);
    const areTreesEqual = Object.keys(treesDifferences).length === 0;
    const statusTree = areTreesEqual ? CORRECT : INCORRECT;
    rootResults.addRow(["Elements tree", statusTree, "", ""]);

    if (areTreesEqual === false) {
      const keys = Object.keys(treesDifferences);
      const values = Object.values(treesDifferences);

      values.forEach((difference, i) => {
        const uriJson = encodeURIComponent(JSON.stringify(difference));
        rootResults.addRow([
          "",
          `${keys[i]}`,
          `<a href="https://stryczek.pl/json/?input=${uriJson}" target="_blank">open</a>`,
          "",
        ]);

        //     console.log(keys[i])
        //     if (keys[i].includes("properties")) {
        //         // @ts-expect-error
        //         console.log(difference.ifcJsValue.propertySets);
        //         // @ts-expect-error
        //         console.log(difference.ifcOpenShellValue.propertySets);
        //     } else if (keys[i].includes("quantities")) {
        //         // @ts-expect-error
        //         console.log(difference.ifcJsValue.quantitySets);
        //         // @ts-expect-error
        //         console.log(difference.ifcOpenShellValue.quantitySets);
        //     } else {
        //         console.log(difference.ifcJsValue);
        //         console.log(difference.ifcOpenShellValue);
        //     }
      });
    }

    const webIfc__GeometryIds = Object.keys(webIfc__resultsData.geometryData);
    const ifcOpenShell__GeometryIds = Object.keys(ifcOpenShell__resultsData.geometryData);

    const areAmountsOfGeometriesEqual = webIfc__GeometryIds.length === ifcOpenShell__GeometryIds.length;
    const statusAmountsOfGeometriesEqual = areAmountsOfGeometriesEqual ? CORRECT : INCORRECT;
    rootResults.addRow(["Geometry amount", statusAmountsOfGeometriesEqual, webIfc__GeometryIds.length.toString(), ifcOpenShell__GeometryIds.length.toString()]);

    const geometryResults = new ResultsFile<[string, string, string, string]>({
      filePath: path.join(GEOMETRIES_RESULTS_DIRECTORY, `${resultName}-geometries.csv`),
    });

    let ifcOpenShell__numberOfTotalVertices = 0;
    let webIfc__numberOfTotalVertices = 0;
    let ifcOpenShell__numberOfTotalUniqueVertices = 0;
    let webIfc__numberOfTotalUniqueVertices = 0;

    for (const geometryId of webIfc__GeometryIds) {
      const webIfc__geometry = webIfc__resultsData.geometryData[geometryId];
      const ifcOpenShell__geometry = ifcOpenShell__resultsData.geometryData[geometryId];

      if (ifcOpenShell__geometry === undefined) {
        throw new Error(`Geometry with ID ${geometryId} not found in IfcOpenShell results`);
      }

      geometryResults.addRow([
        geometryId,
        webIfc__geometry.ifcClass,
        webIfc__geometry.positions.length,
        ifcOpenShell__geometry.positions.length,
      ]);

      ifcOpenShell__numberOfTotalVertices += ifcOpenShell__geometry.positions.length;
      webIfc__numberOfTotalVertices += webIfc__geometry.positions.length;

      const numberOfPositions__areEqual = webIfc__geometry.positions.length === ifcOpenShell__geometry.positions.length;
      const numberOfPositions__status = numberOfPositions__areEqual ? CORRECT : INCORRECT;
      console.log(`Geometry ${geometryId} - Number of positions: ${numberOfPositions__status}`);

      const webIfc__numberOfUniqueVertices = getNumberOfUniqueVertices({ vertexData: webIfc__geometry.positions });
      const ifcOpenShell__numberOfUniqueVertices = getNumberOfUniqueVertices({ vertexData: ifcOpenShell__geometry.positions })

      const numberOfUniqueVertices__areEqual = webIfc__numberOfUniqueVertices === ifcOpenShell__numberOfUniqueVertices;
      const numberOfUniqueVertices__status = numberOfUniqueVertices__areEqual ? CORRECT : INCORRECT;
      console.log(`Geometry ${geometryId} - Number of unique vertices: ${numberOfUniqueVertices__status}`);

      if (numberOfUniqueVertices__areEqual === false) {
        console.log(`Geometry ${geometryId} - Number of unique vertices: webIfc=${webIfc__numberOfUniqueVertices}, ifcOpenShell=${ifcOpenShell__numberOfUniqueVertices}`);
        // console.log(webIfc__geometry.positions)
        // console.log()
        // console.log(ifcOpenShell__geometry.positions)
        console.log()
      }
      webIfc__numberOfTotalUniqueVertices += webIfc__numberOfUniqueVertices;
      ifcOpenShell__numberOfTotalUniqueVertices += ifcOpenShell__numberOfUniqueVertices
    }

    geometryResults.save();


    rootResults.addRow(["Number of total vertices",
      webIfc__numberOfTotalVertices === ifcOpenShell__numberOfTotalVertices ? CORRECT : INCORRECT,
      webIfc__numberOfTotalVertices.toString(), ifcOpenShell__numberOfTotalVertices.toString()]);
    rootResults.addRow([
      "Number of total unique vertices",
      webIfc__numberOfTotalUniqueVertices === ifcOpenShell__numberOfTotalUniqueVertices ? CORRECT : INCORRECT,
      webIfc__numberOfTotalUniqueVertices.toString(), ifcOpenShell__numberOfTotalUniqueVertices.toString()]);

    console.log(`[${resultName}] Comparing images`);
    const webIfcImages = webBrowser.getImagesPaths(webIfc__filePath);
    const ifcOpenShell_images = webBrowser.getImagesPaths(ifcOpenShell__filePath);

    rootResults.addRow(["Images", "", "", ""]);
    renderViews.forEach(async (renderView, index) => {
      const webIfc__ImagePath = webIfcImages[index];
      const ifcOpenShell__imagePath = ifcOpenShell_images[index];

      await imageComparer.createDifferenceMap(
        webIfc__ImagePath,
        ifcOpenShell__imagePath,
        path.join(IMAGES_DIFF_DIRECTORY_PATH, `${resultName}_${renderView}.png`)
      );
    });

    rootResults.addRow(["", "", "", ""]);
  }

  rootResults.save();

  console.log("Finished comparing results");

  await webBrowser.kill();
  await server.kill();
}

export { compareResults }

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { PNG } from "pngjs";

jest.mock("pixelmatch", () => ({
  __esModule: true,
  default: jest.fn(() => 0),
}));

import { ImageComparerService } from "./image-comparer.service";
import {
  getCanonicalParserPairKey,
  getParserPairDirectoryName,
} from "../utils/parser-ids";

function writeSolidPng(
  outputPath: string,
  rgba: [number, number, number, number],
): void {
  const image = new PNG({ width: 2, height: 2 });

  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = rgba[0];
    image.data[i + 1] = rgba[1];
    image.data[i + 2] = rgba[2];
    image.data[i + 3] = rgba[3];
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, PNG.sync.write(image));
}

describe("ImageComparerService", () => {
  let service: ImageComparerService;
  let tempDir: string;

  beforeEach(() => {
    service = new ImageComparerService();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ifc-image-comparer-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("builds pairwise comparisons for every unique parser pair", () => {
    const parserA = {
      parserId: "web-ifc@0.0.68",
      parserName: "web-ifc",
      parserVersion: "0.0.68",
      resultDir: path.join(tempDir, "web-ifc-0.0.68", "Sample"),
    };
    const parserB = {
      parserId: "ifc-lite@2.1.3",
      parserName: "ifc-lite",
      parserVersion: "2.1.3",
      resultDir: path.join(tempDir, "ifc-lite-2.1.3", "Sample"),
    };
    const parserC = {
      parserId: "ifcopenshell@0.8.4",
      parserName: "ifcopenshell",
      parserVersion: "0.8.4",
      resultDir: path.join(tempDir, "ifcopenshell-0.8.4", "Sample"),
    };

    writeSolidPng(path.join(parserA.resultDir, "front.png"), [255, 0, 0, 255]);
    writeSolidPng(path.join(parserB.resultDir, "front.png"), [0, 255, 0, 255]);
    writeSolidPng(path.join(parserC.resultDir, "front.png"), [0, 0, 255, 255]);

    const comparison = service.buildPairwiseComparisons(
      [parserA, parserB, parserC],
      path.join(tempDir, "_comparison", "Sample"),
      ["front"],
    );

    expect(comparison.defaultLeftParserId).toBe(parserA.parserId);
    expect(comparison.defaultRightParserId).toBe(parserB.parserId);
    expect(comparison.parserOptions).toHaveLength(3);
    expect(comparison.views).toHaveLength(1);

    const pairComparisons = comparison.pairComparisons ?? [];
    expect(pairComparisons).toHaveLength(3);
    expect(new Set(pairComparisons.map((pair) => pair.pairKey)).size).toBe(3);
    expect(pairComparisons[0]?.views).toEqual(comparison.views);

    const expectedPairKeys = new Set([
      getCanonicalParserPairKey(parserA.parserId, parserB.parserId),
      getCanonicalParserPairKey(parserA.parserId, parserC.parserId),
      getCanonicalParserPairKey(parserB.parserId, parserC.parserId),
    ]);
    expect(new Set(pairComparisons.map((pair) => pair.pairKey))).toEqual(
      expectedPairKeys,
    );

    const diffPaths = pairComparisons.map((pair) => pair.views[0]?.diffImagePath);
    expect(diffPaths).toHaveLength(3);
    expect(new Set(diffPaths).size).toBe(3);
    expect(diffPaths).toContain(
      path.join(
        tempDir,
        "_comparison",
        "Sample",
        getParserPairDirectoryName(parserA.parserId, parserB.parserId),
        "front-diff.png",
      ),
    );
  });
});

import { ComparisonResult, ImageViewComparison } from "../types/comparison.types";
import { ReportGeneratorService } from "./report-generator.service";
import { getCanonicalParserPairKey } from "../utils/parser-ids";

function createImageViewComparison(
  parserDirA: string,
  parserDirB: string,
  diffDir: string,
  viewName: string,
  pixelDiffPercentage: number,
): ImageViewComparison {
  return {
    viewName,
    imagePaths: [
      `/tmp/output/${parserDirA}/Sample/${viewName}.png`,
      `/tmp/output/${parserDirB}/Sample/${viewName}.png`,
    ],
    diffImagePath: `/tmp/output/_comparison/Sample/${diffDir}/${viewName}-diff.png`,
    pixelDiffCount: Math.round(pixelDiffPercentage * 10),
    pixelDiffPercentage,
    match: pixelDiffPercentage < 1,
  };
}

describe("ReportGeneratorService", () => {
  it("builds a visual comparison model with selectable parser pairs", () => {
    const service = new ReportGeneratorService();
    const parserA = {
      parserId: "web-ifc@0.0.68",
      parserName: "web-ifc",
      parserVersion: "0.0.68",
      processingTimeMs: 100,
      outputFilePath: "/tmp/output/web-ifc-0.0.68/Sample/Sample.json",
    };
    const parserB = {
      parserId: "ifc-lite@2.1.3",
      parserName: "ifc-lite",
      parserVersion: "2.1.3",
      processingTimeMs: 120,
      outputFilePath: "/tmp/output/ifc-lite-2.1.3/Sample/Sample.json",
    };
    const parserC = {
      parserId: "ifcopenshell@0.8.4",
      parserName: "ifcopenshell",
      parserVersion: "0.8.4",
      processingTimeMs: 140,
      outputFilePath: "/tmp/output/ifcopenshell-0.8.4/Sample/Sample.json",
    };

    const comparison: ComparisonResult = {
      ifcFileName: "Sample",
      timestamp: "2026-03-30T20:07:46.000Z",
      parsers: [parserA, parserB, parserC],
      metadata: {
        schemaVersionMatch: true,
        schemaVersions: ["IFC4", "IFC4", "IFC4"],
      },
      summary: {
        totalEntityCountMatch: true,
        totalEntityCounts: [10, 10, 10],
        typeCountMatch: true,
        typeCounts: [2, 2, 2],
        entityCountByType: [],
      },
      spatialTree: {
        nodeCountMatch: true,
        nodeCounts: [3, 3, 3],
        differences: [],
      },
      geometry: {
        entityCountMatch: true,
        entityCounts: [5, 5, 5],
        totalVertexCountMatch: true,
        totalVertexCounts: [100, 100, 100],
        totalTriangleCountMatch: true,
        totalTriangleCounts: [50, 50, 50],
        uniqueVertexCountMatch: true,
        uniqueVertexCounts: [80, 80, 80],
        totalLineVertexCountMatch: true,
        totalLineVertexCounts: [0, 0, 0],
        totalLineSegmentCountMatch: true,
        totalLineSegmentCounts: [0, 0, 0],
        matrixMatch: true,
        entities: [],
      },
      images: {
        views: [
          createImageViewComparison(
            "web-ifc-0.0.68",
            "ifc-lite-2.1.3",
            "ifc-lite-2-1-3__web-ifc-0-0-68",
            "front",
            0,
          ),
          createImageViewComparison(
            "web-ifc-0.0.68",
            "ifc-lite-2.1.3",
            "ifc-lite-2-1-3__web-ifc-0-0-68",
            "top",
            0.2,
          ),
        ],
        parserOptions: [
          {
            parserId: parserA.parserId,
            parserName: parserA.parserName,
            parserVersion: parserA.parserVersion,
          },
          {
            parserId: parserB.parserId,
            parserName: parserB.parserName,
            parserVersion: parserB.parserVersion,
          },
          {
            parserId: parserC.parserId,
            parserName: parserC.parserName,
            parserVersion: parserC.parserVersion,
          },
        ],
        defaultLeftParserId: parserA.parserId,
        defaultRightParserId: parserB.parserId,
        pairComparisons: [
          {
            pairKey: getCanonicalParserPairKey(parserA.parserId, parserB.parserId),
            parserIds: [parserA.parserId, parserB.parserId],
            views: [
              createImageViewComparison(
                "web-ifc-0.0.68",
                "ifc-lite-2.1.3",
                "ifc-lite-2-1-3__web-ifc-0-0-68",
                "front",
                0,
              ),
              createImageViewComparison(
                "web-ifc-0.0.68",
                "ifc-lite-2.1.3",
                "ifc-lite-2-1-3__web-ifc-0-0-68",
                "top",
                0.2,
              ),
            ],
          },
          {
            pairKey: getCanonicalParserPairKey(parserA.parserId, parserC.parserId),
            parserIds: [parserA.parserId, parserC.parserId],
            views: [
              createImageViewComparison(
                "web-ifc-0.0.68",
                "ifcopenshell-0.8.4",
                "ifcopenshell-0-8-4__web-ifc-0-0-68",
                "front",
                0.4,
              ),
              createImageViewComparison(
                "web-ifc-0.0.68",
                "ifcopenshell-0.8.4",
                "ifcopenshell-0-8-4__web-ifc-0-0-68",
                "top",
                1.5,
              ),
            ],
          },
          {
            pairKey: getCanonicalParserPairKey(parserB.parserId, parserC.parserId),
            parserIds: [parserB.parserId, parserC.parserId],
            views: [
              createImageViewComparison(
                "ifc-lite-2.1.3",
                "ifcopenshell-0.8.4",
                "ifc-lite-2-1-3__ifcopenshell-0-8-4",
                "front",
                0.7,
              ),
              createImageViewComparison(
                "ifc-lite-2.1.3",
                "ifcopenshell-0.8.4",
                "ifc-lite-2-1-3__ifcopenshell-0-8-4",
                "top",
                0.1,
              ),
            ],
          },
        ],
      },
    };

    const model = service.buildVisualComparisonModel(comparison);

    expect(model).not.toBeNull();
    if (!model) {
      return;
    }

    expect(model.parserOptions).toHaveLength(3);
    expect(model.defaultLeftParserId).toBe(parserA.parserId);
    expect(model.defaultRightParserId).toBe(parserB.parserId);
    expect(model.parserOptions[0]?.label).toBe("web-ifc 0.0.68");
    expect(model.views).toHaveLength(2);

    const frontView = model.views.find((view) => view.viewName === "front");
    expect(frontView).toBeDefined();

    const frontPairs = JSON.parse(frontView?.pairsJson ?? "{}");
    expect(frontPairs[parserA.parserId][parserB.parserId].imageAPath).toBe(
      "../../web-ifc-0.0.68/Sample/front.png",
    );
    expect(frontPairs[parserA.parserId][parserB.parserId].imageBPath).toBe(
      "../../ifc-lite-2.1.3/Sample/front.png",
    );
    expect(frontPairs[parserB.parserId][parserA.parserId].imageAPath).toBe(
      "../../ifc-lite-2.1.3/Sample/front.png",
    );
    expect(frontPairs[parserA.parserId][parserC.parserId]).toBeDefined();
    expect(frontPairs[parserB.parserId][parserC.parserId]).toBeDefined();
    expect(frontPairs[parserA.parserId][parserB.parserId].diffImagePath).toBe(
      "ifc-lite-2-1-3__web-ifc-0-0-68/front-diff.png",
    );
    expect(frontView?.defaultLeftLabel).toBe("web-ifc 0.0.68");
    expect(frontView?.defaultRightLabel).toBe("ifc-lite 2.1.3");
  });
});

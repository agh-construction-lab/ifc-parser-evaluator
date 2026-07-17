import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import * as Handlebars from "handlebars";
import {
  ComparisonReport,
  ComparisonResult,
  ImageViewComparison,
  ReportSummary,
} from "../types/comparison.types";
import { getParserLabel } from "../utils/parser-ids";

type VisualComparisonPairAsset = {
  diffImagePath: string;
  diffPercentage: string;
  imageAPath: string;
  imageBPath: string;
  leftLabel: string;
  matchClass: string;
  rightLabel: string;
  spheresDiffImagePath: string;
  spheresDiffPercentage: string;
  spheresImageAPath: string;
  spheresImageBPath: string;
  spheresMatchClass: string;
};

type VisualComparisonViewModel = {
  defaultDiffImagePath: string;
  defaultDiffPercentage: string;
  defaultImageAPath: string;
  defaultImageBPath: string;
  defaultLeftLabel: string;
  defaultMatchClass: string;
  defaultRightLabel: string;
  defaultSpheresDiffImagePath: string;
  defaultSpheresDiffPercentage: string;
  defaultSpheresImageAPath: string;
  defaultSpheresImageBPath: string;
  defaultSpheresMatchClass: string;
  onionId: string;
  pairsJson: string;
  viewId: string;
  viewName: string;
};

export type VisualComparisonModel = {
  defaultLeftParserId: string;
  defaultRightParserId: string;
  parserOptions: Array<{
    isDefaultLeft: boolean;
    isDefaultRight: boolean;
    label: string;
    parserId: string;
  }>;
  views: Array<VisualComparisonViewModel>;
};

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);
  private readonly templatesDir = path.join(__dirname, "../templates");

  constructor() {
    this.registerHandlebarsHelpers();
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHandlebarsHelpers(): void {
    Handlebars.registerHelper("formatNumber", (value: number) => {
      return value?.toLocaleString() ?? "0";
    });
  }

  /**
   * Load and compile a Handlebars template
   */
  private loadTemplate(name: string): Handlebars.TemplateDelegate {
    const templatePath = path.join(this.templatesDir, name);
    const templateContent = fs.readFileSync(templatePath, "utf-8");
    return Handlebars.compile(templateContent);
  }

  /**
   * Load a raw file (CSS, JS) without compiling
   */
  private loadRawFile(name: string): string {
    const filePath = path.join(this.templatesDir, name);
    return fs.readFileSync(filePath, "utf-8");
  }

  /**
   * Generate full comparison report
   */
  generateReport(
    comparisons: Array<ComparisonResult>,
    outputDirectory: string,
  ): ComparisonReport {
    const report: ComparisonReport = {
      generatedAt: new Date().toISOString(),
      outputDirectory,
      comparisons,
      summary: this.calculateSummary(comparisons),
    };

    return report;
  }

  /**
   * Calculate overall summary metrics
   */
  private calculateSummary(
    comparisons: Array<ComparisonResult>,
  ): ReportSummary {
    const parsersCompared = [
      ...new Set(
        comparisons.flatMap((c) =>
          c.parsers.map((p) => `${p.parserName} ${p.parserVersion}`),
        ),
      ),
    ];

    const totalFiles = comparisons.length;

    let metadataMatches = 0;
    let summaryMatches = 0;
    let treeMatches = 0;
    let matrixMatches = 0;

    // Geometry: count matching criteria (entity, totalVertex, uniqueVertex, triangles, lineVertex, lineSegments)
    let geometryCriteriaMatched = 0;
    const geometryCriteriaTotal = totalFiles * 6; // 6 criteria per file

    // Images: collect all pixel diff percentages for average
    let totalPixelDiffSum = 0;
    let totalViewCount = 0;

    for (const comparison of comparisons) {
      if (comparison.metadata.schemaVersionMatch) metadataMatches++;
      if (
        comparison.summary.totalEntityCountMatch &&
        comparison.summary.typeCountMatch
      )
        summaryMatches++;
      if (comparison.spatialTree.nodeCountMatch) treeMatches++;

      // Geometry: count individual criteria matches
      if (comparison.geometry.entityCountMatch) geometryCriteriaMatched++;
      if (comparison.geometry.totalVertexCountMatch) geometryCriteriaMatched++;
      if (comparison.geometry.uniqueVertexCountMatch) geometryCriteriaMatched++;
      if (comparison.geometry.totalTriangleCountMatch) geometryCriteriaMatched++;
      if (comparison.geometry.totalLineVertexCountMatch) geometryCriteriaMatched++;
      if (comparison.geometry.totalLineSegmentCountMatch) geometryCriteriaMatched++;

      // Matrix: separate metric
      if (comparison.geometry.matrixMatch) matrixMatches++;

      // Images: sum up pixel diff percentages for average
      for (const view of comparison.images.views) {
        totalPixelDiffSum += view.pixelDiffPercentage;
        totalViewCount++;
      }
    }

    const averagePixelDiff =
      totalViewCount > 0 ? totalPixelDiffSum / totalViewCount : 0;

    return {
      totalFiles,
      parsersCompared,
      overallMetrics: {
        metadataMatchRate: totalFiles > 0 ? metadataMatches / totalFiles : 0,
        summaryMatchRate: totalFiles > 0 ? summaryMatches / totalFiles : 0,
        treeMatchRate: totalFiles > 0 ? treeMatches / totalFiles : 0,
        geometryMatchRate:
          geometryCriteriaTotal > 0
            ? geometryCriteriaMatched / geometryCriteriaTotal
            : 0,
        matrixMatchRate: totalFiles > 0 ? matrixMatches / totalFiles : 0,
        imageMatchRate: (100 - averagePixelDiff) / 100, // Convert to 0-1 rate
        averagePixelDiff,
      },
    };
  }

  /**
   * Save report as JSON
   */
  saveReportJson(report: ComparisonReport, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    this.logger.log(`Report JSON saved: ${outputPath}`);
  }

  /**
   * Generate HTML report with charts
   */
  generateHtmlReport(report: ComparisonReport, outputPath: string): void {
    const html = this.buildHtmlReport(report);

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, html);
    this.logger.log(`HTML report saved: ${outputPath}`);
  }

  /**
   * Build HTML report content using Handlebars
   */
  private buildHtmlReport(report: ComparisonReport): string {
    const { summary, comparisons, generatedAt, outputDirectory } = report;

    // Load templates
    const mainTemplate = this.loadTemplate("report.html.hbs");
    const fileComparisonTemplate = this.loadTemplate(
      "file-comparison.html.hbs",
    );
    const cssContent = this.loadRawFile("report.css");
    const jsContent = this.loadRawFile("report.js");

    // Processing time data
    const processingTimeData = comparisons.flatMap((c) =>
      c.parsers.map((p) => ({
        file: c.ifcFileName,
        parser: `${p.parserName}`,
        time: p.processingTimeMs,
      })),
    );

    // Vertex count data (total)
    const vertexData = comparisons.map((c) => ({
      file: c.ifcFileName,
      counts: c.geometry.totalVertexCounts,
      parsers: c.parsers.map((p) => p.parserName),
    }));

    // Unique vertex count data
    const uniqueVertexData = comparisons.map((c) => ({
      file: c.ifcFileName,
      counts: c.geometry.uniqueVertexCounts,
      parsers: c.parsers.map((p) => p.parserName),
    }));

    // Triangle count data
    const triangleData = comparisons.map((c) => ({
      file: c.ifcFileName,
      counts: c.geometry.totalTriangleCounts,
      parsers: c.parsers.map((p) => p.parserName),
    }));

    // Group vertices by IFC class
    const vertexByClassData = this.groupVerticesByClass(comparisons);

    // Build report data for charts
    const reportData = JSON.stringify({
      processingTimeData,
      vertexData,
      uniqueVertexData,
      triangleData,
      vertexByClassData,
    });

    // Helper for match color
    const getMatchColor = (rate: number) =>
      rate === 1 ? "var(--accent-green)" : "var(--accent-orange)";

    // Build file comparisons HTML using Handlebars
    const fileComparisonsHtml = comparisons
      .map((c) => this.buildFileComparisonHtml(c, fileComparisonTemplate))
      .join("\n");

    // Render main template
    return mainTemplate({
      styles: cssContent,
      scripts: jsContent,
      reportData,
      generatedAt: new Date(generatedAt).toLocaleString(),
      parsersCompared: summary.parsersCompared.join(", "),
      totalFiles: summary.totalFiles,
      fileName: comparisons[0]?.ifcFileName || "Unknown",
      outputDirectory,
      metadataMatchColor: getMatchColor(
        summary.overallMetrics.metadataMatchRate,
      ),
      metadataMatchRate: (
        summary.overallMetrics.metadataMatchRate * 100
      ).toFixed(2),
      summaryMatchColor: getMatchColor(summary.overallMetrics.summaryMatchRate),
      summaryMatchRate: (summary.overallMetrics.summaryMatchRate * 100).toFixed(
        2,
      ),
      geometryMatchColor: getMatchColor(
        summary.overallMetrics.geometryMatchRate,
      ),
      geometryMatchRate: (
        summary.overallMetrics.geometryMatchRate * 100
      ).toFixed(2),
      matrixMatchColor: getMatchColor(summary.overallMetrics.matrixMatchRate),
      matrixMatchRate: (summary.overallMetrics.matrixMatchRate * 100).toFixed(2),
      imageMatchColor: getMatchColor(summary.overallMetrics.imageMatchRate),
      imageMatchRate: (summary.overallMetrics.imageMatchRate * 100).toFixed(2),
      averagePixelDiff: summary.overallMetrics.averagePixelDiff.toFixed(3),
      comparisons: fileComparisonsHtml,
    });
  }

  buildVisualComparisonModel(
    comparison: ComparisonResult,
  ): VisualComparisonModel | null {
    const parserOptions =
      comparison.images.parserOptions && comparison.images.parserOptions.length > 0
        ? comparison.images.parserOptions
        : comparison.parsers.map((parser) => ({
            parserId: parser.parserId,
            parserName: parser.parserName,
            parserVersion: parser.parserVersion,
          }));

    if (parserOptions.length < 2) {
      return null;
    }

    const defaultLeftParserId =
      comparison.images.defaultLeftParserId ?? parserOptions[0]?.parserId;
    const defaultRightParserId =
      comparison.images.defaultRightParserId ?? parserOptions[1]?.parserId;

    if (!defaultLeftParserId || !defaultRightParserId) {
      return null;
    }

    const pairComparisons =
      comparison.images.pairComparisons && comparison.images.pairComparisons.length > 0
        ? comparison.images.pairComparisons
        : [
            {
              pairKey: `${defaultLeftParserId}__${defaultRightParserId}`,
              parserIds: [defaultLeftParserId, defaultRightParserId] as [
                string,
                string,
              ],
              views: comparison.images.views,
            },
          ];

    const parserLabelById = new Map(
      parserOptions.map((parser) => [parser.parserId, getParserLabel(parser)]),
    );
    const viewNames = [
      ...new Set(pairComparisons.flatMap((pair) => pair.views.map((v) => v.viewName))),
    ];

    const views = viewNames.map((viewName) => {
      const orderedPairs: Record<
        string,
        Record<string, VisualComparisonPairAsset>
      > = {};

      for (const pairComparison of pairComparisons) {
        const pairView =
          pairComparison.views.find((view) => view.viewName === viewName) ??
          this.createMissingImageViewComparison(viewName);
        const [parserIdA, parserIdB] = pairComparison.parserIds;

        orderedPairs[parserIdA] ??= {};
        orderedPairs[parserIdB] ??= {};
        orderedPairs[parserIdA][parserIdB] = this.buildVisualComparisonPairAsset(
          comparison,
          pairView,
          pairComparison.parserIds,
          parserIdA,
          parserIdB,
          parserLabelById,
        );
        orderedPairs[parserIdB][parserIdA] = this.buildVisualComparisonPairAsset(
          comparison,
          pairView,
          pairComparison.parserIds,
          parserIdB,
          parserIdA,
          parserLabelById,
        );
      }

      const defaultPair =
        orderedPairs[defaultLeftParserId]?.[defaultRightParserId] ??
        this.createEmptyVisualComparisonPairAsset(
          defaultLeftParserId,
          defaultRightParserId,
          parserLabelById,
        );

      return {
        defaultDiffImagePath: defaultPair.diffImagePath,
        defaultDiffPercentage: defaultPair.diffPercentage,
        defaultImageAPath: defaultPair.imageAPath,
        defaultImageBPath: defaultPair.imageBPath,
        defaultLeftLabel: defaultPair.leftLabel,
        defaultMatchClass: defaultPair.matchClass,
        defaultRightLabel: defaultPair.rightLabel,
        defaultSpheresDiffImagePath: defaultPair.spheresDiffImagePath,
        defaultSpheresDiffPercentage: defaultPair.spheresDiffPercentage,
        defaultSpheresImageAPath: defaultPair.spheresImageAPath,
        defaultSpheresImageBPath: defaultPair.spheresImageBPath,
        defaultSpheresMatchClass: defaultPair.spheresMatchClass,
        onionId: this.toDomId(
          `onion-${comparison.ifcFileName}-${defaultLeftParserId}-${defaultRightParserId}-${viewName}`,
        ),
        pairsJson: JSON.stringify(orderedPairs),
        viewId: this.toDomId(`view-${comparison.ifcFileName}-${viewName}`),
        viewName,
      };
    });

    return {
      defaultLeftParserId,
      defaultRightParserId,
      parserOptions: parserOptions.map((parser) => ({
        isDefaultLeft: parser.parserId === defaultLeftParserId,
        isDefaultRight: parser.parserId === defaultRightParserId,
        label: getParserLabel(parser),
        parserId: parser.parserId,
      })),
      views,
    };
  }

  private buildVisualComparisonPairAsset(
    comparison: ComparisonResult,
    pairView: ImageViewComparison,
    pairParserIds: [string, string],
    leftParserId: string,
    rightParserId: string,
    parserLabelById: Map<string, string>,
  ): VisualComparisonPairAsset {
    const isReversed =
      pairParserIds[0] !== leftParserId || pairParserIds[1] !== rightParserId;
    const imagePaths = isReversed
      ? [pairView.imagePaths[1] ?? "", pairView.imagePaths[0] ?? ""]
      : [pairView.imagePaths[0] ?? "", pairView.imagePaths[1] ?? ""];

    const spheresPaths = pairView.spheresImagePaths ?? ["", ""];
    const orderedSpheresPaths = isReversed
      ? [spheresPaths[1] ?? "", spheresPaths[0] ?? ""]
      : [spheresPaths[0] ?? "", spheresPaths[1] ?? ""];
    const spheresPixelDiffPercentage = pairView.spheresPixelDiffPercentage;

    return {
      diffImagePath: this.toRelativeDiffImagePath(
        pairView.diffImagePath,
        comparison.ifcFileName,
      ),
      diffPercentage:
        pairView.pixelDiffPercentage >= 0
          ? `${pairView.pixelDiffPercentage.toFixed(2)}%`
          : "N/A",
      imageAPath: this.toRelativeParserImagePath(imagePaths[0], comparison),
      imageBPath: this.toRelativeParserImagePath(imagePaths[1], comparison),
      leftLabel:
        parserLabelById.get(leftParserId) ?? leftParserId ?? "Left parser",
      matchClass: this.getImageMatchClass(pairView.pixelDiffPercentage),
      rightLabel:
        parserLabelById.get(rightParserId) ?? rightParserId ?? "Right parser",
      spheresDiffImagePath: this.toRelativeDiffImagePath(
        pairView.spheresDiffImagePath,
        comparison.ifcFileName,
      ),
      spheresDiffPercentage:
        spheresPixelDiffPercentage !== undefined &&
        spheresPixelDiffPercentage >= 0
          ? `${spheresPixelDiffPercentage.toFixed(2)}%`
          : "N/A",
      spheresImageAPath: this.toRelativeParserImagePath(
        orderedSpheresPaths[0],
        comparison,
      ),
      spheresImageBPath: this.toRelativeParserImagePath(
        orderedSpheresPaths[1],
        comparison,
      ),
      spheresMatchClass: this.getImageMatchClass(
        spheresPixelDiffPercentage ?? -1,
      ),
    };
  }

  private createEmptyVisualComparisonPairAsset(
    leftParserId: string,
    rightParserId: string,
    parserLabelById: Map<string, string>,
  ): VisualComparisonPairAsset {
    return {
      diffImagePath: "",
      diffPercentage: "N/A",
      imageAPath: "",
      imageBPath: "",
      leftLabel: parserLabelById.get(leftParserId) ?? leftParserId,
      matchClass: "no",
      rightLabel: parserLabelById.get(rightParserId) ?? rightParserId,
      spheresDiffImagePath: "",
      spheresDiffPercentage: "N/A",
      spheresImageAPath: "",
      spheresImageBPath: "",
      spheresMatchClass: "no",
    };
  }

  private createMissingImageViewComparison(viewName: string): ImageViewComparison {
    return {
      viewName,
      imagePaths: ["", ""],
      pixelDiffCount: -1,
      pixelDiffPercentage: -1,
      match: false,
    };
  }

  private getImageMatchClass(pixelDiffPercentage: number): string {
    if (pixelDiffPercentage === 0) {
      return "yes";
    }

    if (pixelDiffPercentage > 0 && pixelDiffPercentage <= 0.5) {
      return "warning";
    }

    return "no";
  }

  private toDomId(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
  }

  private toRelativeDiffImagePath(
    diffImagePath: string | undefined,
    ifcFileName: string,
  ): string {
    if (!diffImagePath) {
      return "";
    }

    const diffParentDir = path.basename(path.dirname(diffImagePath));
    if (diffParentDir === ifcFileName) {
      return path.basename(diffImagePath);
    }

    return `${diffParentDir}/${path.basename(diffImagePath)}`;
  }

  private toRelativeParserImagePath(
    imagePath: string | undefined,
    comparison: ComparisonResult,
  ): string {
    if (!imagePath) {
      return "";
    }

    const parserDirName = path.basename(path.dirname(path.dirname(imagePath)));
    return `../../${parserDirName}/${comparison.ifcFileName}/${path.basename(imagePath)}`;
  }

  /**
   * Build HTML for a single file comparison using Handlebars
   */
  private buildFileComparisonHtml(
    comparison: ComparisonResult,
    template: Handlebars.TemplateDelegate,
  ): string {
    const summaryMatch =
      comparison.summary.totalEntityCountMatch &&
      comparison.summary.typeCountMatch;
    // Count geometry criteria matches (out of 6)
    const geometryCriteriaCount = [
      comparison.geometry.entityCountMatch,
      comparison.geometry.totalVertexCountMatch,
      comparison.geometry.uniqueVertexCountMatch,
      comparison.geometry.totalTriangleCountMatch,
      comparison.geometry.totalLineVertexCountMatch,
      comparison.geometry.totalLineSegmentCountMatch,
    ].filter(Boolean).length;
    const geometryMatch = geometryCriteriaCount === 6;
    const imagesMatch = comparison.images.views.every((v) => v.match);
    const visualComparison = this.buildVisualComparisonModel(comparison);

    return template({
      ifcFileName: comparison.ifcFileName,
      schemaMatchClass: comparison.metadata.schemaVersionMatch
        ? "match"
        : "mismatch",
      schemaMatchIcon: comparison.metadata.schemaVersionMatch ? "✓" : "✗",
      metadata: comparison.metadata,
      schemaVersionMatchClass: comparison.metadata.schemaVersionMatch
        ? "yes"
        : "no",
      summaryMatchClass: summaryMatch ? "match" : "mismatch",
      summaryMatchIcon: summaryMatch ? "✓" : "✗",
      geometryMatchClass: geometryMatch ? "match" : "mismatch",
      geometryMatchIcon: geometryMatch ? "✓" : "✗",
      matrixMatchClass: comparison.geometry.matrixMatch ? "match" : "mismatch",
      matrixMatchIcon: comparison.geometry.matrixMatch ? "✓" : "✗",
      imagesMatchClass: imagesMatch ? "match" : "mismatch",
      imagesMatchIcon: imagesMatch ? "✓" : "✗",
      parsers: comparison.parsers,
      summary: comparison.summary,
      geometry: comparison.geometry,
      totalEntityMatchClass: comparison.summary.totalEntityCountMatch
        ? "yes"
        : "no",
      typeCountMatchClass: comparison.summary.typeCountMatch ? "yes" : "no",
      geometryEntityMatchClass: comparison.geometry.entityCountMatch
        ? "yes"
        : "no",
      totalVertexMatchClass: comparison.geometry.totalVertexCountMatch
        ? "yes"
        : "no",
      totalTriangleMatchClass: comparison.geometry.totalTriangleCountMatch
        ? "yes"
        : "no",
      uniqueVertexMatchClass: comparison.geometry.uniqueVertexCountMatch
        ? "yes"
        : "no",
      totalLineVertexMatchClass: comparison.geometry.totalLineVertexCountMatch
        ? "yes"
        : "no",
      totalLineSegmentMatchClass: comparison.geometry.totalLineSegmentCountMatch
        ? "yes"
        : "no",
      hasImages: visualComparison !== null,
      visualComparison,
      hasMatrixData: comparison.geometry.entities.length > 0,
      matrixEntities: comparison.geometry.entities.map((entity) => ({
        globalId: entity.globalId,
        ifcClass: entity.ifcClass,
        matchClass: entity.matrixMatch ? "yes" : "no",
        parserMatrices: entity.matrices.map((matrix, i) => ({
          parserName: comparison.parsers[i]?.parserName || `Parser ${i + 1}`,
          rows: matrix
            ? [
                matrix.slice(0, 4).map((v) => v.toFixed(4)),
                matrix.slice(4, 8).map((v) => v.toFixed(4)),
                matrix.slice(8, 12).map((v) => v.toFixed(4)),
                matrix.slice(12, 16).map((v) => v.toFixed(4)),
              ]
            : [["N/A"]],
        })),
      })),
    });
  }

  /**
   * Generate index.html with links to all file reports
   */
  generateIndexHtml(
    reportLinks: Array<{ name: string; path: string }>,
    outputPath: string,
  ): void {
    const template = this.loadTemplate("index.html.hbs");
    const cssContent = this.loadRawFile("report.css");

    const html = template({
      styles: cssContent,
      generatedAt: new Date().toLocaleString(),
      totalFiles: reportLinks.length,
      reports: reportLinks,
    });

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, html);
    this.logger.log(`Index HTML saved: ${outputPath}`);
  }

  /**
   * Group vertex counts by IFC class for per-class charts
   */
  private groupVerticesByClass(comparisons: Array<ComparisonResult>) {
    const classMap: Record<
      string,
      {
        ifcClass: string;
        vertexCounts: number[];
        uniqueVertexCounts: number[];
        parsers: string[];
      }
    > = {};

    for (const comparison of comparisons) {
      const parsers = comparison.parsers.map((p) => p.parserName);

      for (const entity of comparison.geometry.entities) {
        if (!classMap[entity.ifcClass]) {
          classMap[entity.ifcClass] = {
            ifcClass: entity.ifcClass,
            vertexCounts: parsers.map(() => 0),
            uniqueVertexCounts: parsers.map(() => 0),
            parsers,
          };
        }
        entity.vertexCounts.forEach((count, i) => {
          classMap[entity.ifcClass].vertexCounts[i] += count;
        });
        entity.uniqueVertexCounts.forEach((count, i) => {
          classMap[entity.ifcClass].uniqueVertexCounts[i] += count;
        });
      }
    }

    // Separate classes with and without geometry
    const withGeometry = Object.values(classMap).filter((c) =>
      c.vertexCounts.some((v) => v > 0),
    );
    const withoutGeometry = Object.values(classMap).filter((c) =>
      c.vertexCounts.every((v) => v === 0),
    );

    return { withGeometry, withoutGeometry };
  }
}

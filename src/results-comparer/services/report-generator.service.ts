import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import * as Handlebars from "handlebars";
import {
  ComparisonReport,
  ComparisonResult,
  ReportSummary,
} from "../types/comparison.types";

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

    // Geometry: count matching criteria (entity, totalVertex, uniqueVertex, triangles)
    let geometryCriteriaMatched = 0;
    const geometryCriteriaTotal = totalFiles * 4; // 4 criteria per file

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

    // Prepare chart data
    const matchRateData = {
      labels: ["Metadata", "Summary", "Tree", "Geometry", "Matrix", "Images"],
      values: [
        summary.overallMetrics.metadataMatchRate * 100,
        summary.overallMetrics.summaryMatchRate * 100,
        summary.overallMetrics.treeMatchRate * 100,
        summary.overallMetrics.geometryMatchRate * 100,
        summary.overallMetrics.matrixMatchRate * 100,
        summary.overallMetrics.imageMatchRate * 100,
      ],
    };

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
      matchRateData,
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
      ).toFixed(0),
      summaryMatchColor: getMatchColor(summary.overallMetrics.summaryMatchRate),
      summaryMatchRate: (summary.overallMetrics.summaryMatchRate * 100).toFixed(
        0,
      ),
      geometryMatchColor: getMatchColor(
        summary.overallMetrics.geometryMatchRate,
      ),
      geometryMatchRate: (
        summary.overallMetrics.geometryMatchRate * 100
      ).toFixed(0),
      matrixMatchColor: getMatchColor(summary.overallMetrics.matrixMatchRate),
      matrixMatchRate: (summary.overallMetrics.matrixMatchRate * 100).toFixed(0),
      imageMatchColor: getMatchColor(summary.overallMetrics.imageMatchRate),
      imageMatchRate: (summary.overallMetrics.imageMatchRate * 100).toFixed(0),
      averagePixelDiff: summary.overallMetrics.averagePixelDiff.toFixed(3),
      comparisons: fileComparisonsHtml,
    });
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
    // Count geometry criteria matches (out of 4)
    const geometryCriteriaCount = [
      comparison.geometry.entityCountMatch,
      comparison.geometry.totalVertexCountMatch,
      comparison.geometry.uniqueVertexCountMatch,
      comparison.geometry.totalTriangleCountMatch,
    ].filter(Boolean).length;
    const geometryMatch = geometryCriteriaCount === 4;
    const imagesMatch = comparison.images.views.every((v) => v.match);

    // Prepare view data for images
    // Convert absolute paths to relative paths (relative to report location in _comparison/{fileName}/)
    const views = comparison.images.views.map((v, i) => {
      // Parser images are at ../../{parser}/{fileName}/{view}.png
      // Diff images are in the same folder as the report
      const imageAPath = v.imagePaths[0]
        ? `../../${comparison.parsers[0]?.parserName}/${comparison.ifcFileName}/${path.basename(v.imagePaths[0])}`
        : "";
      const imageBPath = v.imagePaths[1]
        ? `../../${comparison.parsers[1]?.parserName}/${comparison.ifcFileName}/${path.basename(v.imagePaths[1])}`
        : "";
      const diffImagePath = v.diffImagePath
        ? path.basename(v.diffImagePath)
        : "";

      return {
        viewId: `${v.viewName}-${comparison.ifcFileName}`,
        viewName: v.viewName,
        matchClass: v.match ? "yes" : "no",
        parserAName: comparison.parsers[0]?.parserName || "Parser A",
        parserBName: comparison.parsers[1]?.parserName || "Parser B",
        imageAPath,
        imageBPath,
        diffPercentage:
          v.pixelDiffPercentage >= 0
            ? v.pixelDiffPercentage.toFixed(2) + "%"
            : "N/A",
        diffImagePath,
        onionId: `onion-${v.viewName}-${comparison.ifcFileName}`,
        isFirst: i === 0,
      };
    });

    return template({
      ifcFileName: comparison.ifcFileName,
      schemaMatchClass: comparison.metadata.schemaVersionMatch
        ? "match"
        : "mismatch",
      schemaMatchIcon: comparison.metadata.schemaVersionMatch ? "✓" : "✗",
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
      hasImages: comparison.images.views.length > 0,
      views,
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

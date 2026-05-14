import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import {
  ComparisonResult,
  GeometryEntityComparison,
  ParserComparisonData,
} from "../types/comparison.types";

const CHART_WIDTH = 1600;
const CHART_HEIGHT = 900;

// Note: comparison.ifcFileName is the basename without ".ifc" extension
// (set in compare-results.command.ts via path.basename(ifcFile, ".ifc")).
// Per-instance distribution charts are emitted for each of these sub-models
// (×each class in DISTRIBUTION_CLASSES) when present in the comparisons set.
const DISTRIBUTION_SUB_MODELS: ReadonlyArray<string> = [
  "IDS_B_LOD1",
  "IDS_B_LOD2_ARCH",
  "IDS_B_LOD2_STRU",
  "IDS_B_LOD3_ARCH",
  "IDS_B_LOD3_STRU",
  "IDS_B_LOD4_ARCH",
  "IDS_B_LOD4_STRU",
];

// Matplotlib default tab10 palette — keeps style consistent with reference image
const PARSER_COLORS: Record<string, string> = {
  "web-ifc": "#1f77b4",
  ifcopenshell: "#ff7f0e",
  "ifc-lite": "#2ca02c",
};

const DEFAULT_COLOR = "#7f7f7f";

const DISTRIBUTION_CLASSES = ["IfcWall", "IfcBeam"] as const;

@Injectable()
export class ChartExportService {
  private readonly logger = new Logger(ChartExportService.name);
  private readonly canvas: ChartJSNodeCanvas;

  constructor() {
    this.canvas = new ChartJSNodeCanvas({
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      backgroundColour: "white",
      plugins: {
        modern: [ChartDataLabels],
      },
    });
  }

  /**
   * Render publication-ready PNG charts to <outputDirectory>/_charts/.
   *
   * Naming convention: <chart-type>__[<ifcClass>__]<scope>.png
   *   "chart-type" identifies the chart kind.
   *   "ifcClass" is included only for class-specific charts.
   *   "scope" identifies the IFC file the chart covers.
   *   `__` separates each major part.
   *
   * Per-file class breakdown — one chart per IFC file:
   *  - vertex-totals__<ifc-file-basename>.png
   *    X-axis: IFC classes present in the file; Y-axis: total vertices; 3 parser series
   *
   * Per-instance distribution charts (bar) — one per (sub-model × class):
   *  - vertex-distribution__<ifcClass>__<ifc-file-basename>.png
   *    e.g. vertex-distribution__ifcWall__IDS_B_LOD1.png
   *
   * Vertex-count grouping charts (grouped bar) — one per (sub-model × class):
   *  - vertex-grouping__<ifcClass>__<ifc-file-basename>.png
   *    e.g. vertex-grouping__ifcBeam__IDS_B_LOD3_STRU.png
   *    X-axis: vertex-count groups labelled "Group N (M×)" where M is the number of
   *    entities sharing the same per-parser vertex-count tuple.
   *    Bars (3 per group, one per parser, color-coded): vertex count for that parser.
   *
   * Empty slots (missing sub-model file, no entities of class) are skipped with warnings.
   */
  async generatePublicationCharts(
    comparisons: Array<ComparisonResult>,
    outputDirectory: string,
  ): Promise<void> {
    const chartsDir = path.join(outputDirectory, "_charts");
    fs.mkdirSync(chartsDir, { recursive: true });

    const parserOrder = this.getParserOrder(comparisons);
    if (parserOrder.length === 0) {
      this.logger.warn(
        "No comparisons available — skipping publication charts",
      );
      return;
    }

    const cmpByName = this.indexByFileName(comparisons);

    // === Per-file vertex totals broken down by IFC class (one per comparison) ===
    for (const cmp of comparisons) {
      await this.renderFileClassBreakdown(cmp, parserOrder, chartsDir);
    }

    // === Per-instance distribution charts — one per sub-model × class ===
    for (const fileBaseName of DISTRIBUTION_SUB_MODELS) {
      for (const ifcClass of DISTRIBUTION_CLASSES) {
        const fileName = `vertex-distribution__${toClassFilenamePart(ifcClass)}__${fileBaseName}.png`;
        await this.renderInstanceDistribution(
          fileBaseName,
          ifcClass,
          fileName,
          cmpByName,
          parserOrder,
          chartsDir,
        );
      }
    }

    // === Pie charts: grouping by per-parser vertex-count signature ===
    for (const fileBaseName of DISTRIBUTION_SUB_MODELS) {
      for (const ifcClass of DISTRIBUTION_CLASSES) {
        const fileName = `vertex-grouping__${toClassFilenamePart(ifcClass)}__${fileBaseName}.png`;
        await this.renderVertexGrouping(
          fileBaseName,
          ifcClass,
          fileName,
          cmpByName,
          parserOrder,
          chartsDir,
        );
      }
    }

    this.logger.log(`Publication charts written to ${chartsDir}`);
  }

  // === Per-file: vertex totals broken down by IFC class ===

  private async renderFileClassBreakdown(
    cmp: ComparisonResult,
    parserOrder: Array<ParserComparisonData>,
    chartsDir: string,
  ): Promise<void> {
    // Collect distinct IFC classes present in this file's geometry.
    const classes = new Set<string>();
    for (const e of cmp.geometry.entities) {
      classes.add(e.ifcClass);
    }
    if (classes.size === 0) {
      this.logger.warn(
        `No geometry entities in ${cmp.ifcFileName} — skipping vertex totals chart`,
      );
      return;
    }

    const sortedClasses = Array.from(classes).sort();

    const datasets = parserOrder.map((parser, parserIdx) => ({
      label: parser.parserName,
      backgroundColor: PARSER_COLORS[parser.parserName] ?? DEFAULT_COLOR,
      data: sortedClasses.map((cls) =>
        sumVerticesForClass(cmp.geometry.entities, cls, parserIdx),
      ),
    }));

    const config: ChartConfiguration = this.buildBarConfig({
      title: `${cmp.ifcFileName}.ifc — vertex totals by class`,
      labels: sortedClasses,
      datasets,
      xAxisTitle: "IFC Class",
      rotateXLabels: sortedClasses.length > 6,
    });

    await this.renderToFile(
      config,
      path.join(chartsDir, `vertex-totals__${cmp.ifcFileName}.png`),
    );
  }

  // === Per-instance distribution: one chart per sub-model × class ===

  private async renderInstanceDistribution(
    fileBaseName: string,
    ifcClass: string,
    fileName: string,
    cmpByName: Map<string, ComparisonResult>,
    parserOrder: Array<ParserComparisonData>,
    chartsDir: string,
  ): Promise<void> {
    const cmp = cmpByName.get(fileBaseName);
    if (!cmp) {
      this.logger.warn(
        `${fileBaseName} not present in comparisons — skipping ${ifcClass} distribution chart`,
      );
      return;
    }

    const entities = cmp.geometry.entities.filter(
      (e) => e.ifcClass === ifcClass,
    );
    if (entities.length === 0) {
      this.logger.warn(
        `No ${ifcClass} entities in ${fileBaseName} — skipping distribution chart`,
      );
      return;
    }

    const labels = entities.map((e) => e.globalId);
    const datasets = parserOrder.map((parser, parserIdx) => ({
      label: parser.parserName,
      backgroundColor: PARSER_COLORS[parser.parserName] ?? DEFAULT_COLOR,
      data: entities.map((e) => e.vertexCounts[parserIdx] ?? 0),
    }));

    const config: ChartConfiguration = this.buildBarConfig({
      title: `${fileBaseName}.ifc — ${ifcClass}`,
      labels,
      datasets,
      xAxisTitle: "GlobalId",
      rotateXLabels: true,
    });

    await this.renderToFile(config, path.join(chartsDir, fileName));
  }

  // === Grouped bar: entities of a class grouped by per-parser vertex-count signature ===

  private async renderVertexGrouping(
    fileBaseName: string,
    ifcClass: string,
    fileName: string,
    cmpByName: Map<string, ComparisonResult>,
    parserOrder: Array<ParserComparisonData>,
    chartsDir: string,
  ): Promise<void> {
    const cmp = cmpByName.get(fileBaseName);
    if (!cmp) {
      this.logger.warn(
        `${fileBaseName} not present in comparisons — skipping ${ifcClass} grouping chart`,
      );
      return;
    }

    const entities = cmp.geometry.entities.filter(
      (e) => e.ifcClass === ifcClass,
    );
    if (entities.length === 0) {
      this.logger.warn(
        `No ${ifcClass} entities in ${fileBaseName} — skipping grouping chart`,
      );
      return;
    }

    // Group entities by the tuple of per-parser vertex counts.
    // groupKey -> { vertexCountsPerParser: number[], instanceCount: number }
    const groups = new Map<
      string,
      { vertexCountsPerParser: Array<number>; instanceCount: number }
    >();
    for (const e of entities) {
      const vertexCountsPerParser = parserOrder.map(
        (_, idx) => e.vertexCounts[idx] ?? 0,
      );
      const key = vertexCountsPerParser.join("/");
      const existing = groups.get(key);
      if (existing) {
        existing.instanceCount += 1;
      } else {
        groups.set(key, { vertexCountsPerParser, instanceCount: 1 });
      }
    }

    // Sort groups by instance count descending.
    const sortedGroups = Array.from(groups.values()).sort(
      (a, b) => b.instanceCount - a.instanceCount,
    );

    // X-axis labels: "Group N (M×)"
    const labels = sortedGroups.map(
      (g, i) => `Group ${i + 1} (${g.instanceCount}×)`,
    );

    // One dataset per parser; each dataset has one value per group (the vertex count for that parser in that group).
    const datasets = parserOrder.map((parser, parserIdx) => ({
      label: parser.parserName,
      backgroundColor: PARSER_COLORS[parser.parserName] ?? DEFAULT_COLOR,
      data: sortedGroups.map((g) => g.vertexCountsPerParser[parserIdx] ?? 0),
    }));

    const config: ChartConfiguration = this.buildBarConfig({
      title: `${fileBaseName}.ifc — ${ifcClass} (vertex-count grouping)`,
      labels,
      datasets,
      xAxisTitle: "Vertex-count group",
    });

    await this.renderToFile(config, path.join(chartsDir, fileName));
  }

  // === Helpers ===

  private buildBarConfig(opts: {
    title: string;
    labels: Array<string>;
    datasets: Array<{
      label: string;
      backgroundColor: string;
      data: Array<number>;
    }>;
    xAxisTitle: string;
    rotateXLabels?: boolean;
  }): ChartConfiguration {
    return {
      type: "bar",
      data: {
        labels: opts.labels,
        datasets: opts.datasets,
      },
      options: {
        responsive: false,
        layout: { padding: { top: 32, right: 24, bottom: 12, left: 12 } },
        plugins: {
          title: {
            display: true,
            text: opts.title,
            font: { size: 28, weight: "bold" },
            padding: { top: 12, bottom: 24 },
          },
          legend: {
            position: "top",
            align: "end",
            labels: { font: { size: 20 } },
          },
          datalabels: {
            anchor: "end",
            align: "top",
            color: "#333",
            font: { size: 16 },
            formatter: (value: number) => (value > 0 ? value : ""),
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: opts.xAxisTitle,
              font: { size: 20 },
              padding: { top: 12 },
            },
            ticks: {
              maxRotation: opts.rotateXLabels ? 90 : 0,
              minRotation: opts.rotateXLabels ? 90 : 0,
              font: { size: opts.rotateXLabels ? 14 : 18 },
              autoSkip: false,
            },
            grid: { display: false },
          },
          y: {
            title: {
              display: true,
              text: "Amount of vertices",
              font: { size: 20 },
              padding: { bottom: 12 },
            },
            beginAtZero: true,
            ticks: { font: { size: 18 } },
          },
        },
      },
    };
  }

  private async renderToFile(
    config: ChartConfiguration,
    filePath: string,
  ): Promise<void> {
    const buffer = await this.canvas.renderToBuffer(config, "image/png");
    fs.writeFileSync(filePath, buffer);
    this.logger.log(`  wrote ${path.basename(filePath)}`);
  }

  private indexByFileName(
    comparisons: Array<ComparisonResult>,
  ): Map<string, ComparisonResult> {
    const map = new Map<string, ComparisonResult>();
    for (const c of comparisons) map.set(c.ifcFileName, c);
    return map;
  }

  private getParserOrder(
    comparisons: Array<ComparisonResult>,
  ): Array<ParserComparisonData> {
    const first = comparisons.find((c) => c.parsers.length > 0);
    return first ? first.parsers : [];
  }
}

function sumVerticesForClass(
  entities: Array<GeometryEntityComparison>,
  ifcClass: string,
  parserIdx: number,
): number {
  let total = 0;
  for (const e of entities) {
    if (e.ifcClass === ifcClass) {
      total += e.vertexCounts[parserIdx] ?? 0;
    }
  }
  return total;
}

// "IfcWall" -> "ifcWall" — lowercase the leading "I" while preserving the rest.
function toClassFilenamePart(ifcClass: string): string {
  if (ifcClass.length === 0) return ifcClass;
  return ifcClass.charAt(0).toLowerCase() + ifcClass.slice(1);
}

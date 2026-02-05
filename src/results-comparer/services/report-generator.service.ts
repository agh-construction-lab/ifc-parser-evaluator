import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import {
  ComparisonReport,
  ComparisonResult,
  ReportSummary,
} from "../types/comparison.types";

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

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
    let geometryMatches = 0;
    let imageMatches = 0;

    for (const comparison of comparisons) {
      if (comparison.metadata.schemaVersionMatch) metadataMatches++;
      if (
        comparison.summary.totalEntityCountMatch &&
        comparison.summary.typeCountMatch
      )
        summaryMatches++;
      if (comparison.spatialTree.nodeCountMatch) treeMatches++;
      if (
        comparison.geometry.entityCountMatch &&
        comparison.geometry.totalVertexCountMatch
      )
        geometryMatches++;

      const imageMatchCount = comparison.images.views.filter(
        (v) => v.match,
      ).length;
      if (imageMatchCount === comparison.images.views.length) imageMatches++;
    }

    return {
      totalFiles,
      parsersCompared,
      overallMetrics: {
        metadataMatchRate: totalFiles > 0 ? metadataMatches / totalFiles : 0,
        summaryMatchRate: totalFiles > 0 ? summaryMatches / totalFiles : 0,
        treeMatchRate: totalFiles > 0 ? treeMatches / totalFiles : 0,
        geometryMatchRate: totalFiles > 0 ? geometryMatches / totalFiles : 0,
        imageMatchRate: totalFiles > 0 ? imageMatches / totalFiles : 0,
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
   * Build HTML report content
   */
  private buildHtmlReport(report: ComparisonReport): string {
    const { summary, comparisons, generatedAt, outputDirectory } = report;

    // Prepare chart data
    const matchRateData = {
      labels: ["Metadata", "Summary", "Tree", "Geometry", "Images"],
      values: [
        summary.overallMetrics.metadataMatchRate * 100,
        summary.overallMetrics.summaryMatchRate * 100,
        summary.overallMetrics.treeMatchRate * 100,
        summary.overallMetrics.geometryMatchRate * 100,
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

    // Vertex count data
    const vertexData = comparisons.map((c) => ({
      file: c.ifcFileName,
      counts: c.geometry.totalVertexCounts,
      parsers: c.parsers.map((p) => p.parserName),
    }));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IFC Parser Comparison Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #21262d;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --accent-green: #3fb950;
      --accent-red: #f85149;
      --accent-blue: #58a6ff;
      --accent-purple: #a371f7;
      --accent-orange: #d29922;
      --border-color: #30363d;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 2rem;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    h1 {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .meta {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .summary-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.25rem;
    }

    .summary-card h3 {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--text-secondary);
      margin-bottom: 0.5rem;
    }

    .summary-card .value {
      font-size: 2rem;
      font-weight: 600;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .chart-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.5rem;
    }

    .chart-card h2 {
      font-size: 1rem;
      margin-bottom: 1rem;
      color: var(--text-primary);
    }

    .chart-container {
      position: relative;
      height: 300px;
    }

    .comparison-section {
      margin-bottom: 2rem;
    }

    .comparison-section h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border-color);
    }

    .file-comparison {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 1rem;
      overflow: hidden;
    }

    .file-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      background: var(--bg-tertiary);
      cursor: pointer;
    }

    .file-header:hover {
      background: #2d333b;
    }

    .file-name {
      font-weight: 600;
      font-size: 1rem;
    }

    .file-stats {
      display: flex;
      gap: 1rem;
    }

    .stat-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .stat-badge.match {
      background: rgba(63, 185, 80, 0.15);
      color: var(--accent-green);
    }

    .stat-badge.mismatch {
      background: rgba(248, 81, 73, 0.15);
      color: var(--accent-red);
    }

    .file-details {
      padding: 1.25rem;
      display: none;
    }

    .file-details.open {
      display: block;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    th, td {
      text-align: left;
      padding: 0.75rem;
      border-bottom: 1px solid var(--border-color);
    }

    th {
      color: var(--text-secondary);
      font-weight: 500;
      text-transform: uppercase;
      font-size: 0.75rem;
    }

    .match-icon {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 0.5rem;
    }

    .match-icon.yes {
      background: var(--accent-green);
    }

    .match-icon.no {
      background: var(--accent-red);
    }

    .images-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .image-card {
      background: var(--bg-tertiary);
      border-radius: 6px;
      padding: 0.75rem;
      text-align: center;
    }

    .image-card img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }

    .image-card .label {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .collapsible-toggle {
      background: none;
      border: none;
      color: var(--accent-blue);
      cursor: pointer;
      font-size: 0.875rem;
    }

    footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
      color: var(--text-secondary);
      font-size: 0.75rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🏗️ IFC Parser Comparison Report</h1>
      <p class="meta">
        Generated: ${new Date(generatedAt).toLocaleString()} | 
        Parsers: ${summary.parsersCompared.join(", ")} |
        Files: ${summary.totalFiles}
      </p>
    </header>

    <section class="summary-grid">
      <div class="summary-card">
        <h3>Files Compared</h3>
        <div class="value">${summary.totalFiles}</div>
      </div>
      <div class="summary-card">
        <h3>Metadata Match</h3>
        <div class="value" style="color: ${summary.overallMetrics.metadataMatchRate === 1 ? "var(--accent-green)" : "var(--accent-orange)"}">
          ${(summary.overallMetrics.metadataMatchRate * 100).toFixed(0)}%
        </div>
      </div>
      <div class="summary-card">
        <h3>Summary Match</h3>
        <div class="value" style="color: ${summary.overallMetrics.summaryMatchRate === 1 ? "var(--accent-green)" : "var(--accent-orange)"}">
          ${(summary.overallMetrics.summaryMatchRate * 100).toFixed(0)}%
        </div>
      </div>
      <div class="summary-card">
        <h3>Geometry Match</h3>
        <div class="value" style="color: ${summary.overallMetrics.geometryMatchRate === 1 ? "var(--accent-green)" : "var(--accent-orange)"}">
          ${(summary.overallMetrics.geometryMatchRate * 100).toFixed(0)}%
        </div>
      </div>
      <div class="summary-card">
        <h3>Image Match</h3>
        <div class="value" style="color: ${summary.overallMetrics.imageMatchRate === 1 ? "var(--accent-green)" : "var(--accent-orange)"}">
          ${(summary.overallMetrics.imageMatchRate * 100).toFixed(0)}%
        </div>
      </div>
    </section>

    <section class="charts-grid">
      <div class="chart-card">
        <h2>Match Rate by Category</h2>
        <div class="chart-container">
          <canvas id="matchRateChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <h2>Processing Time (ms)</h2>
        <div class="chart-container">
          <canvas id="processingTimeChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <h2>Vertex Count Comparison</h2>
        <div class="chart-container">
          <canvas id="vertexChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <h2>Triangle Count Comparison</h2>
        <div class="chart-container">
          <canvas id="triangleChart"></canvas>
        </div>
      </div>
    </section>

    <section class="comparison-section">
      <h2>Detailed Comparisons</h2>
      ${comparisons.map((c) => this.buildFileComparisonHtml(c)).join("\n")}
    </section>

    <footer>
      <p>IFC Parser Evaluator | Generated from: ${outputDirectory}</p>
    </footer>
  </div>

  <script>
    // Chart.js configuration
    Chart.defaults.color = '#8b949e';
    Chart.defaults.borderColor = '#30363d';

    // Match Rate Chart
    new Chart(document.getElementById('matchRateChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(matchRateData.labels)},
        datasets: [{
          data: ${JSON.stringify(matchRateData.values)},
          backgroundColor: ${JSON.stringify(matchRateData.values.map((v) => (v === 100 ? "#3fb950" : v >= 50 ? "#d29922" : "#f85149")))},
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { callback: v => v + '%' }
          }
        }
      }
    });

    // Processing Time Chart
    const processingData = ${JSON.stringify(processingTimeData)};
    const files = [...new Set(processingData.map(d => d.file))];
    const parsers = [...new Set(processingData.map(d => d.parser))];
    
    new Chart(document.getElementById('processingTimeChart'), {
      type: 'bar',
      data: {
        labels: files,
        datasets: parsers.map((parser, i) => ({
          label: parser,
          data: files.map(f => processingData.find(d => d.file === f && d.parser === parser)?.time || 0),
          backgroundColor: i === 0 ? '#58a6ff' : '#a371f7',
          borderRadius: 4,
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: v => v + 'ms' }
          }
        }
      }
    });

    // Vertex Count Chart
    const vertexData = ${JSON.stringify(vertexData)};
    new Chart(document.getElementById('vertexChart'), {
      type: 'bar',
      data: {
        labels: vertexData.map(d => d.file),
        datasets: vertexData[0]?.parsers.map((parser, i) => ({
          label: parser,
          data: vertexData.map(d => d.counts[i] || 0),
          backgroundColor: i === 0 ? '#58a6ff' : '#a371f7',
          borderRadius: 4,
        })) || []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });

    // Triangle Count Chart
    const triangleData = ${JSON.stringify(
      comparisons.map((c) => ({
        file: c.ifcFileName,
        counts: c.geometry.totalTriangleCounts,
        parsers: c.parsers.map((p) => p.parserName),
      })),
    )};
    new Chart(document.getElementById('triangleChart'), {
      type: 'bar',
      data: {
        labels: triangleData.map(d => d.file),
        datasets: triangleData[0]?.parsers.map((parser, i) => ({
          label: parser,
          data: triangleData.map(d => d.counts[i] || 0),
          backgroundColor: i === 0 ? '#58a6ff' : '#a371f7',
          borderRadius: 4,
        })) || []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });

    // Toggle file details
    document.querySelectorAll('.file-header').forEach(header => {
      header.addEventListener('click', () => {
        const details = header.nextElementSibling;
        details.classList.toggle('open');
      });
    });
  </script>
</body>
</html>`;
  }

  /**
   * Build HTML for a single file comparison
   */
  private buildFileComparisonHtml(comparison: ComparisonResult): string {
    const summaryMatch =
      comparison.summary.totalEntityCountMatch &&
      comparison.summary.typeCountMatch;
    const geometryMatch =
      comparison.geometry.entityCountMatch &&
      comparison.geometry.totalVertexCountMatch;
    const imagesMatch = comparison.images.views.every((v) => v.match);

    return `
      <div class="file-comparison">
        <div class="file-header">
          <span class="file-name">📄 ${comparison.ifcFileName}</span>
          <div class="file-stats">
            <span class="stat-badge ${comparison.metadata.schemaVersionMatch ? "match" : "mismatch"}">
              Schema ${comparison.metadata.schemaVersionMatch ? "✓" : "✗"}
            </span>
            <span class="stat-badge ${summaryMatch ? "match" : "mismatch"}">
              Summary ${summaryMatch ? "✓" : "✗"}
            </span>
            <span class="stat-badge ${geometryMatch ? "match" : "mismatch"}">
              Geometry ${geometryMatch ? "✓" : "✗"}
            </span>
            <span class="stat-badge ${imagesMatch ? "match" : "mismatch"}">
              Images ${imagesMatch ? "✓" : "✗"}
            </span>
          </div>
        </div>
        <div class="file-details">
          <h4>Processing Time</h4>
          <table>
            <thead>
              <tr>
                <th>Parser</th>
                <th>Version</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              ${comparison.parsers
                .map(
                  (p) => `
                <tr>
                  <td>${p.parserName}</td>
                  <td>${p.parserVersion}</td>
                  <td>${p.processingTimeMs} ms</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>

          <h4 style="margin-top: 1rem;">Summary Comparison</h4>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                ${comparison.parsers.map((p) => `<th>${p.parserName}</th>`).join("")}
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Entities</td>
                ${comparison.summary.totalEntityCounts.map((c) => `<td>${c}</td>`).join("")}
                <td><span class="match-icon ${comparison.summary.totalEntityCountMatch ? "yes" : "no"}"></span></td>
              </tr>
              <tr>
                <td>Type Count</td>
                ${comparison.summary.typeCounts.map((c) => `<td>${c}</td>`).join("")}
                <td><span class="match-icon ${comparison.summary.typeCountMatch ? "yes" : "no"}"></span></td>
              </tr>
            </tbody>
          </table>

          <h4 style="margin-top: 1rem;">Geometry Comparison</h4>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                ${comparison.parsers.map((p) => `<th>${p.parserName}</th>`).join("")}
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Geometry Entities</td>
                ${comparison.geometry.entityCounts.map((c) => `<td>${c}</td>`).join("")}
                <td><span class="match-icon ${comparison.geometry.entityCountMatch ? "yes" : "no"}"></span></td>
              </tr>
              <tr>
                <td>Total Vertices</td>
                ${comparison.geometry.totalVertexCounts.map((c) => `<td>${c.toLocaleString()}</td>`).join("")}
                <td><span class="match-icon ${comparison.geometry.totalVertexCountMatch ? "yes" : "no"}"></span></td>
              </tr>
              <tr>
                <td>Total Triangles</td>
                ${comparison.geometry.totalTriangleCounts.map((c) => `<td>${c.toLocaleString()}</td>`).join("")}
                <td><span class="match-icon ${comparison.geometry.totalTriangleCountMatch ? "yes" : "no"}"></span></td>
              </tr>
              <tr>
                <td>Unique Vertices</td>
                ${comparison.geometry.uniqueVertexCounts.map((c) => `<td>${c.toLocaleString()}</td>`).join("")}
                <td><span class="match-icon ${comparison.geometry.uniqueVertexCountMatch ? "yes" : "no"}"></span></td>
              </tr>
            </tbody>
          </table>

          ${
            comparison.images.views.length > 0
              ? `
            <h4 style="margin-top: 1rem;">Image Comparison</h4>
            <table>
              <thead>
                <tr>
                  <th>View</th>
                  <th>Pixel Diff</th>
                  <th>Diff %</th>
                  <th>Match</th>
                </tr>
              </thead>
              <tbody>
                ${comparison.images.views
                  .map(
                    (v) => `
                  <tr>
                    <td>${v.viewName}</td>
                    <td>${v.pixelDiffCount >= 0 ? v.pixelDiffCount.toLocaleString() : "N/A"}</td>
                    <td>${v.pixelDiffPercentage >= 0 ? v.pixelDiffPercentage.toFixed(2) + "%" : "N/A"}</td>
                    <td><span class="match-icon ${v.match ? "yes" : "no"}"></span></td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          `
              : ""
          }
        </div>
      </div>
    `;
  }
}

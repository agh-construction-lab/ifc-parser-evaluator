import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import {
  ComparisonResult,
  EntityTypeComparison,
  GeometryComparison,
  GeometryEntityComparison,
  MetadataComparison,
  ParserComparisonData,
  ParserOutput,
  SpatialTreeNode,
  SummaryComparison,
  TreeComparison,
  TreeDifference,
} from "../types/comparison.types";

const NUMERIC_PRECISION = 5;

@Injectable()
export class ComparisonService {
  private readonly logger = new Logger(ComparisonService.name);

  /**
   * Compare parser outputs for a single IFC file
   */
  compareParserOutputs(
    ifcFileName: string,
    parserOutputPaths: Array<string>,
  ): ComparisonResult {
    this.logger.log(`Comparing results for: ${ifcFileName}`);

    const outputs = parserOutputPaths.map((filePath) => {
      const content = fs.readFileSync(filePath, { encoding: "utf-8" });
      return {
        filePath,
        data: JSON.parse(content) as ParserOutput,
      };
    });

    const parsers: Array<ParserComparisonData> = outputs.map((o) => ({
      parserName: o.data.metadata.parserName,
      parserVersion: o.data.metadata.parserVersion,
      processingTimeMs: o.data.metadata.processingTimeMs,
      outputFilePath: o.filePath,
    }));

    return {
      ifcFileName,
      timestamp: new Date().toISOString(),
      parsers,
      metadata: this.compareMetadata(outputs.map((o) => o.data)),
      summary: this.compareSummary(outputs.map((o) => o.data)),
      spatialTree: this.compareSpatialTree(outputs.map((o) => o.data)),
      geometry: this.compareGeometry(outputs.map((o) => o.data)),
      images: { views: [] }, // Will be filled by image comparer
    };
  }

  /**
   * Compare metadata across parsers
   */
  private compareMetadata(outputs: Array<ParserOutput>): MetadataComparison {
    const schemaVersions = outputs.map((o) => o.metadata.schemaVersion);
    const schemaVersionMatch = schemaVersions.every(
      (v) => v === schemaVersions[0],
    );

    return {
      schemaVersionMatch,
      schemaVersions,
    };
  }

  /**
   * Compare summary data across parsers
   */
  private compareSummary(outputs: Array<ParserOutput>): SummaryComparison {
    const totalEntityCounts = outputs.map((o) => o.summary.totalEntityCount);
    const totalEntityCountMatch = totalEntityCounts.every(
      (c) => c === totalEntityCounts[0],
    );

    // Collect all unique types across all parsers
    const allTypes = new Set<string>();
    outputs.forEach((o) => {
      Object.keys(o.summary.entityCountByType).forEach((type) =>
        allTypes.add(type.toUpperCase()),
      );
    });

    const entityCountByType: Array<EntityTypeComparison> = Array.from(allTypes)
      .sort()
      .map((type) => {
        const counts = outputs.map((o) => {
          // Case-insensitive lookup
          const key = Object.keys(o.summary.entityCountByType).find(
            (k) => k.toUpperCase() === type,
          );
          return key ? o.summary.entityCountByType[key] : 0;
        });

        return {
          type,
          counts,
          match: counts.every((c) => c === counts[0]),
        };
      });

    const typeCounts = outputs.map(
      (o) => Object.keys(o.summary.entityCountByType).length,
    );
    const typeCountMatch = typeCounts.every((c) => c === typeCounts[0]);

    return {
      totalEntityCountMatch,
      totalEntityCounts,
      typeCountMatch,
      typeCounts,
      entityCountByType,
    };
  }

  /**
   * Compare spatial trees across parsers
   */
  private compareSpatialTree(outputs: Array<ParserOutput>): TreeComparison {
    const nodeCounts = outputs.map((o) => this.countTreeNodes(o.spatialTree));
    const nodeCountMatch = nodeCounts.every((c) => c === nodeCounts[0]);

    const differences: Array<TreeDifference> = [];

    if (outputs.length >= 2) {
      this.findTreeDifferences(
        outputs[0].spatialTree,
        outputs[1].spatialTree,
        "",
        differences,
      );
    }

    return {
      nodeCountMatch,
      nodeCounts,
      differences,
    };
  }

  /**
   * Count nodes in spatial tree recursively
   */
  private countTreeNodes(nodes: Array<SpatialTreeNode> | undefined): number {
    if (!nodes || !Array.isArray(nodes)) return 0;

    let count = nodes.length;
    for (const node of nodes) {
      if (node.children && Array.isArray(node.children)) {
        count += this.countTreeNodes(node.children);
      }
    }
    return count;
  }

  /**
   * Find differences between two spatial trees
   */
  private findTreeDifferences(
    nodesA: Array<SpatialTreeNode> | undefined,
    nodesB: Array<SpatialTreeNode> | undefined,
    path: string,
    differences: Array<TreeDifference>,
  ): void {
    if (!nodesA || !Array.isArray(nodesA)) return;
    if (!nodesB || !Array.isArray(nodesB)) {
      differences.push({
        path,
        reason: "Second tree is missing or invalid",
        values: [nodesA.length, null],
      });
      return;
    }

    for (let i = 0; i < nodesA.length; i++) {
      const nodeA = nodesA[i];
      const nodeB = nodesB.find((n) => n.globalId === nodeA.globalId);

      if (!nodeB) {
        differences.push({
          path: `${path}[${i}]`,
          reason: "Node not found in second tree",
          values: [nodeA.globalId, null],
        });
        continue;
      }

      // Compare node properties
      if (nodeA.type?.toUpperCase() !== nodeB.type?.toUpperCase()) {
        differences.push({
          path: `${path}[${i}].type`,
          reason: "Type mismatch",
          values: [nodeA.type, nodeB.type],
        });
      }

      if (nodeA.name !== nodeB.name) {
        differences.push({
          path: `${path}[${i}].name`,
          reason: "Name mismatch",
          values: [nodeA.name, nodeB.name],
        });
      }

      // Compare children recursively
      if (nodeA.children || nodeB.children) {
        this.findTreeDifferences(
          nodeA.children,
          nodeB.children,
          `${path}[${i}].children`,
          differences,
        );
      }
    }
  }

  /**
   * Compare geometry data across parsers
   */
  private compareGeometry(outputs: Array<ParserOutput>): GeometryComparison {
    const entityCounts = outputs.map((o) => Object.keys(o.geometries).length);
    const entityCountMatch = entityCounts.every((c) => c === entityCounts[0]);

    // Collect all geometry IDs
    const allGeometryIds = new Set<string>();
    outputs.forEach((o) => {
      Object.keys(o.geometries).forEach((id) => allGeometryIds.add(id));
    });

    const totalVertexCounts = outputs.map(() => 0);
    const totalTriangleCounts = outputs.map(() => 0);
    const uniqueVertexCounts = outputs.map(() => 0);

    const entities: Array<GeometryEntityComparison> = [];

    for (const globalId of allGeometryIds) {
      const geometries = outputs.map((o) => o.geometries[globalId]);

      const vertexCounts = geometries.map((g) =>
        g?.mesh?.positions ? g.mesh.positions.length / 3 : 0,
      );
      const triangleCounts = geometries.map((g) =>
        g?.mesh?.indices ? g.mesh.indices.length / 3 : 0,
      );

      // Update totals
      vertexCounts.forEach((c, i) => {
        totalVertexCounts[i] += c;
      });
      triangleCounts.forEach((c, i) => {
        totalTriangleCounts[i] += c;
      });

      // Count unique vertices
      geometries.forEach((g, i) => {
        if (g?.mesh?.positions) {
          uniqueVertexCounts[i] += this.countUniqueVertices(g.mesh.positions);
        }
      });

      const ifcClass = geometries.find((g) => g)?.ifcClass || "Unknown";

      entities.push({
        globalId,
        ifcClass,
        vertexCounts,
        triangleCounts,
        vertexMatch: vertexCounts.every((c) => c === vertexCounts[0]),
        triangleMatch: triangleCounts.every((c) => c === triangleCounts[0]),
      });
    }

    return {
      entityCountMatch,
      entityCounts,
      totalVertexCountMatch: totalVertexCounts.every(
        (c) => c === totalVertexCounts[0],
      ),
      totalVertexCounts,
      totalTriangleCountMatch: totalTriangleCounts.every(
        (c) => c === totalTriangleCounts[0],
      ),
      totalTriangleCounts,
      uniqueVertexCountMatch: uniqueVertexCounts.every(
        (c) => c === uniqueVertexCounts[0],
      ),
      uniqueVertexCounts,
      entities,
    };
  }

  /**
   * Count unique vertices from position array
   */
  private countUniqueVertices(positions: Array<number>): number {
    const seen = new Set<string>();

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i].toFixed(NUMERIC_PRECISION);
      const y = positions[i + 1].toFixed(NUMERIC_PRECISION);
      const z = positions[i + 2].toFixed(NUMERIC_PRECISION);
      seen.add(`${x},${y},${z}`);
    }

    return seen.size;
  }
}

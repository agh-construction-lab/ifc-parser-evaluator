/**
 * Types for parser output comparison
 */

// Parser output structure (from docs/output-schema.json)
export interface ParserOutput {
  metadata: {
    parserName: string;
    parserVersion: string;
    sourceFile: string;
    schemaVersion: string;
    processedAt: string;
    processingTimeMs: number;
  };
  summary: {
    totalEntityCount: number;
    entityCountByType: Record<string, number>;
  };
  spatialTree: Array<SpatialTreeNode>;
  geometries: Record<string, GeometryEntry>;
}

export interface SpatialTreeNode {
  expressId: number;
  globalId: string;
  ifcClass?: string;
  type?: string;
  name: string;
  properties?: Record<string, unknown>;
  quantities?: Record<string, unknown>;
  children?: Array<SpatialTreeNode>;
}

export interface GeometryEntry {
  ifcClass: string;
  matrix?: Array<number>;
  mesh: {
    positions: Array<number>;
    normals: Array<number>;
    indices: Array<number>;
  };
}

// Comparison result types
export interface ComparisonResult {
  ifcFileName: string;
  timestamp: string;
  parsers: Array<ParserComparisonData>;
  metadata: MetadataComparison;
  summary: SummaryComparison;
  spatialTree: TreeComparison;
  geometry: GeometryComparison;
  images: ImageComparison;
}

export interface ParserComparisonData {
  parserName: string;
  parserVersion: string;
  processingTimeMs: number;
  outputFilePath: string;
}

export interface MetadataComparison {
  schemaVersionMatch: boolean;
  schemaVersions: Array<string>;
}

export interface SummaryComparison {
  totalEntityCountMatch: boolean;
  totalEntityCounts: Array<number>;
  typeCountMatch: boolean;
  typeCounts: Array<number>;
  entityCountByType: Array<EntityTypeComparison>;
}

export interface EntityTypeComparison {
  type: string;
  counts: Array<number>;
  match: boolean;
}

export interface TreeComparison {
  nodeCountMatch: boolean;
  nodeCounts: Array<number>;
  differences: Array<TreeDifference>;
}

export interface TreeDifference {
  path: string;
  reason: string;
  values: Array<unknown>;
}

export interface GeometryComparison {
  entityCountMatch: boolean;
  entityCounts: Array<number>;
  totalVertexCountMatch: boolean;
  totalVertexCounts: Array<number>;
  totalTriangleCountMatch: boolean;
  totalTriangleCounts: Array<number>;
  uniqueVertexCountMatch: boolean;
  uniqueVertexCounts: Array<number>;
  matrixMatch: boolean;
  entities: Array<GeometryEntityComparison>;
}

export interface GeometryEntityComparison {
  globalId: string;
  ifcClass: string;
  vertexCounts: Array<number>;
  uniqueVertexCounts: Array<number>;
  triangleCounts: Array<number>;
  vertexMatch: boolean;
  uniqueVertexMatch: boolean;
  triangleMatch: boolean;
  matrixMatch: boolean;
  matrices: Array<Array<number> | undefined>;
}

export interface ImageComparison {
  views: Array<ImageViewComparison>;
}

export interface ImageViewComparison {
  viewName: string;
  imagePaths: Array<string>;
  diffImagePath?: string;
  pixelDiffCount: number;
  pixelDiffPercentage: number;
  match: boolean;
}

// Report output
export interface ComparisonReport {
  generatedAt: string;
  outputDirectory: string;
  comparisons: Array<ComparisonResult>;
  summary: ReportSummary;
}

export interface ReportSummary {
  totalFiles: number;
  parsersCompared: Array<string>;
  overallMetrics: {
    metadataMatchRate: number;
    summaryMatchRate: number;
    treeMatchRate: number;
    geometryMatchRate: number;
    matrixMatchRate: number;
    imageMatchRate: number;
    averagePixelDiff: number;
  };
}

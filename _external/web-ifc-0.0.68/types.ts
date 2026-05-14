export type IfcLine = {
  expressID: number;
  GlobalId: { value: string };
  Name?: { value: string };
  constructor: { name: string };
};

export type IfcPropertySet = {
  Name: { value: string };
  HasProperties?: Array<{
    Name: { value: string };
    NominalValue?: { value: string | number };
  }>;
  Quantities?: Array<{
    Name: { value: string };
    LengthValue?: { value: number };
    AreaValue?: { value: number };
    VolumeValue?: { value: number };
    CountValue?: { value: number };
  }>;
};

// === Output Schema Types (v2.0.0) ===

export type Metadata = {
  parserName: string;
  parserVersion: string;
  sourceFile: string;
  schemaVersion: string;
  processedAt: string;
  processingTimeMs?: number;
};

export type Summary = {
  totalEntityCount: number;
  entityCountByType: Record<string, number>;
};

export type SpatialNode = {
  expressId: number;
  globalId: string;
  ifcClass: string;
  name: string | null;
  properties: Record<string, Record<string, string | number | boolean | null>>;
  quantities: Record<string, Record<string, number>>;
  children: Array<SpatialNode>;
};

export type GeometryEntry = {
  ifcClass: string;
  matrix: Array<number>;
  mesh?: {
    positions: Array<number>;
    normals: Array<number>;
    indices: Array<number>;
  };
  lines?: {
    positions: Array<number>;
    indices: Array<number>;
  };
};

export type ParserOutput = {
  metadata: Metadata;
  summary: Summary;
  spatialTree: Array<SpatialNode>;
  geometries: Record<string, GeometryEntry>;
};

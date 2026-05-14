# IFC Parser Output Format Specification

## Version 2.0.0

## Overview

This specification defines a standardized JSON output format for IFC parser evaluation. All parsers participating in the evaluation must produce output conforming to this schema to enable accurate comparison of parsing results.

## Design Principles

1. **Consistency** - Identical naming conventions across all parsers
2. **Completeness** - Include metadata for reproducibility
3. **Comparability** - Structure data to facilitate automated comparison
4. **Clarity** - Use descriptive, unambiguous field names

## Schema Reference

The formal JSON Schema is available at: [output-schema.json](./output-schema.json)

## Structure

```
{
  "metadata": { ... },      // Parsing context and timing
  "summary": { ... },       // Entity statistics
  "spatialTree": [ ... ],   // Hierarchical structure with properties
  "geometries": { ... }     // Mesh data indexed by GlobalId
}
```

## Field Specifications

### 1. Metadata

Contains information about the parsing process for reproducibility.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parserName` | string | ✓ | Library name (e.g., "web-ifc", "ifcopenshell") |
| `parserVersion` | string | ✓ | Library version (e.g., "0.0.68") |
| `sourceFile` | string | ✓ | Input filename (e.g., "model.ifc") |
| `schemaVersion` | string | ✓ | IFC schema (IFC2X3, IFC4, IFC4X3, etc.) |
| `processedAt` | string | ✓ | ISO 8601 timestamp |
| `processingTimeMs` | integer | | Processing duration in milliseconds |

### 2. Summary

Aggregate statistics about parsed entities.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `totalEntityCount` | integer | ✓ | Total IFC entities |
| `entityCountByType` | object | ✓ | Count per IFC type |

### 3. Spatial Tree

Array of spatial hierarchy nodes starting from IfcProject.

#### Node Properties

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `expressId` | integer | ✓ | STEP file line number |
| `globalId` | string | ✓ | 22-char IFC GlobalId |
| `ifcClass` | string | ✓ | IFC type (e.g., "IfcBeam") |
| `name` | string\|null | | Entity name |
| `properties` | object | | Nested: pset → property → value |
| `quantities` | object | | Nested: qset → quantity → value |
| `children` | array | ✓ | Child nodes |

### 4. Geometries

Object mapping GlobalId to geometry data.

#### Geometry Entry

Each entry MUST contain `ifcClass` and `matrix`, plus **at least one** of `mesh` (triangulated body) or `lines` (polyline / line segments). Entities without renderable geometry should be omitted from `geometries` entirely.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ifcClass` | string | ✓ | IFC type |
| `matrix` | number[16] | ✓ | 4x4 transformation matrix (column-major, flat array) |
| `mesh` | object | — | Triangulated solid body. Present for IFCs with solid representation. |
| `lines` | object | — | Polyline / line segments. Present for IFCs with curve-based representation (e.g., IFC 4.3 `IfcAlignment*`). |

#### `mesh` sub-object (triangulated body)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mesh.positions` | number[] | ✓ | Flat vertex positions [x,y,z,...] |
| `mesh.normals` | number[] | ✓ | Flat vertex normals [nx,ny,nz,...] |
| `mesh.indices` | integer[] | ✓ | Triangle indices as **triplets** [i1,i2,i3, i4,i5,i6, ...] |

#### `lines` sub-object (polyline / line segments)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `lines.positions` | number[] | ✓ | Flat vertex positions [x,y,z,...] |
| `lines.indices` | integer[] | ✓ | Line segment indices as **pairs** [a1,b1, a2,b2, ...] — each pair defines one segment between two vertex indices |

No `normals` in `lines` — line segments do not have surface orientation.

**Note on matrix field**:
- If positions are in world coordinates (transforms baked in), matrix will be identity `[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]`
- If positions are in local coordinates, matrix contains the transform to apply

## Naming Conventions

| Convention | Example | Notes |
|------------|---------|-------|
| camelCase | `expressId`, `ifcClass` | All field names |
| IFC prefix preserved | `IfcBeam`, `IfcWall` | Type names keep original casing |
| Plural for collections | `geometries`, `children` | Arrays and objects with multiple items |
| No abbreviations | `properties` not `props` | Except well-known: Id, IFC |

## Coordinate System

All geometry coordinates MUST be in:
- **Units**: Meters
- **Axis**: Z-up (convert from Y-up if necessary)
- **Origin**: As defined in IFC file (do not transform to origin)

## Example Output

```json
{
  "metadata": {
    "parserName": "web-ifc",
    "parserVersion": "0.0.68",
    "sourceFile": "primitive-beam.ifc",
    "schemaVersion": "IFC4",
    "processedAt": "2026-01-30T11:00:18.000Z",
    "processingTimeMs": 245
  },
  "summary": {
    "totalEntityCount": 80,
    "entityCountByType": {
      "IfcBeam": 1,
      "IfcBuildingStorey": 1,
      "IfcProject": 1,
      "IfcPropertySingleValue": 12
    }
  },
  "spatialTree": [
    {
      "expressId": 1,
      "globalId": "0aHAFMjLD6AhFkoERY_Add",
      "ifcClass": "IfcProject",
      "name": "Default Project",
      "properties": {},
      "quantities": {},
      "children": [
        {
          "expressId": 42,
          "globalId": "1wAj3wHL54xhjO$WTvPsOr",
          "ifcClass": "IfcSite",
          "name": "Default Site",
          "properties": {},
          "quantities": {},
          "children": []
        }
      ]
    }
  ],
  "geometries": {
    "0lPB5HLj91MgrRjJLNzreW": {
      "ifcClass": "IfcBeam",
      "mesh": {
        "positions": [0, 0, 0, 1, 0, 0, 1, 1, 0],
        "normals": [0, 0, 1, 0, 0, 1, 0, 0, 1],
        "indices": [0, 1, 2]
      },
      "matrix": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    },
    "3bnbm1o6L2YRA2rXgIN4Hr": {
      "ifcClass": "IfcAlignment",
      "lines": {
        "positions": [0, 0, 0, 10, 0, 0, 20, 1, 0, 30, 3, 0],
        "indices": [0, 1, 1, 2, 2, 3]
      },
      "matrix": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    }
  }
}
```

## Validation

Parsers SHOULD validate their output against the JSON Schema before writing.

```bash
# Using ajv-cli
npx ajv validate -s docs/output-schema.json -d output.json
```

## Changelog

### 2.0.0 (2026-05-13)
- **Breaking:** `GeometryEntry.mesh` is now optional. Each entry must have at least one of `mesh` / `lines`.
- Added `GeometryEntry.lines` for polyline / curve-based representations (e.g., IFC 4.3 `IfcAlignment*`). Indices are pairs (`[a,b, a,b, ...]`), defining one line segment per pair. No `normals`.
- Entities without any renderable geometry must be omitted from `geometries` (previously they could appear with empty `mesh.indices`).
- Motivation: IFC 4.3 alignment / linear positioning encodings are curves, not triangulated bodies. Forcing them into `mesh` produced misleading outputs (empty `indices`, hidden parser disagreements). The new schema makes line-based vs body-based representations explicit and independently measurable.

### 1.0.0 (2026-01-30)
- Initial specification
- Defined metadata, summary, spatialTree, geometries structure
- Established naming conventions and coordinate system requirements

import * as fs from "fs";

export type BoundingBox = {
  min: [number, number, number];
  max: [number, number, number];
};

/**
 * Per-file render frame used when rasterizing parser geometry to PNG.
 *
 * `localBbox` is that parser-output's own bounding box (used by the renderer for
 * centering the geometry on screen). `frustumSize` is a scalar shared across all
 * parsers of the same IFC file (the max of all parsers' bbox extents) — used by
 * the renderer for camera frustum sizing so every parser ends up at the same
 * zoom level.
 *
 * This split exists because parsers disagree on how much of the IFC coordination
 * is baked into geometry (e.g. web-ifc/ifc-lite bake the georeferencing
 * translation while ifcopenshell does not). A single union bbox across parsers
 * would then span 8 km of empty space for georeferenced models and reduce every
 * object to a 1-pixel speck. Per-parser centering + shared zoom keeps each
 * render legible while preserving meaningful image-to-image comparison of
 * shape/scale within the same IFC file.
 */
export type RenderFrame = {
  localBbox: BoundingBox;
  frustumSize: number;
};

// Apply a column-major 4x4 transform (as stored in `matrix` per OUTPUT_FORMAT.md)
// to a vec3, returning [x, y, z]. Treats v as a point (w=1).
function applyMatrix4(
  matrix: Array<number>,
  vx: number,
  vy: number,
  vz: number,
): [number, number, number] {
  const m = matrix;
  return [
    m[0] * vx + m[4] * vy + m[8] * vz + m[12],
    m[1] * vx + m[5] * vy + m[9] * vz + m[13],
    m[2] * vx + m[6] * vy + m[10] * vz + m[14],
  ];
}

function scanPositionsBbox(jsonFilePath: string): BoundingBox | null {
  if (!fs.existsSync(jsonFilePath)) return null;

  const data = JSON.parse(fs.readFileSync(jsonFilePath, "utf-8")) as {
    geometries?: Record<
      string,
      {
        mesh?: { positions?: Array<number> };
        lines?: { positions?: Array<number> };
        matrix?: Array<number>;
      }
    >;
  };

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let hasAny = false;

  const geometries = data.geometries ?? {};
  for (const id of Object.keys(geometries)) {
    const entry = geometries[id];
    const matrix =
      entry.matrix && entry.matrix.length === 16 ? entry.matrix : null;
    const arrays: Array<Array<number> | undefined> = [
      entry.mesh?.positions,
      entry.lines?.positions,
    ];

    for (const positions of arrays) {
      if (!positions) continue;
      for (let i = 0; i + 2 < positions.length; i += 3) {
        // Matrix must be applied: some parsers bake the entity transform into
        // mesh.positions (web-ifc, ifc-lite — matrix is identity in that case)
        // while others keep positions in local space and ship per-entity matrix
        // (ifcopenshell). The renderer applies the matrix, so the bbox must
        // match world space too.
        const [x, y, z] = matrix
          ? applyMatrix4(matrix, positions[i], positions[i + 1], positions[i + 2])
          : [positions[i], positions[i + 1], positions[i + 2]];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
        hasAny = true;
      }
    }
  }

  if (!hasAny) return null;
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

function bboxMaxExtent(bbox: BoundingBox): number {
  return Math.max(
    bbox.max[0] - bbox.min[0],
    bbox.max[1] - bbox.min[1],
    bbox.max[2] - bbox.min[2],
  );
}

/**
 * For each parser-output JSON belonging to the same IFC file, compute a render
 * frame: its own bbox + a shared frustum size (the largest extent observed
 * across all the parsers' outputs).
 *
 * Inputs with no geometry are skipped. Returns an empty map if none of the
 * provided files contain any geometry.
 */
export function computeRenderFrames(
  jsonFilePaths: Array<string>,
): Map<string, RenderFrame> {
  const perFileBboxes = new Map<string, BoundingBox>();

  for (const filePath of jsonFilePaths) {
    const bbox = scanPositionsBbox(filePath);
    if (bbox !== null) {
      perFileBboxes.set(filePath, bbox);
    }
  }

  if (perFileBboxes.size === 0) return new Map();

  let frustumSize = 0;
  for (const bbox of perFileBboxes.values()) {
    const extent = bboxMaxExtent(bbox);
    if (extent > frustumSize) frustumSize = extent;
  }

  const frames = new Map<string, RenderFrame>();
  for (const [filePath, localBbox] of perFileBboxes) {
    frames.set(filePath, { localBbox, frustumSize });
  }
  return frames;
}

import * as fs from "fs";

export type BoundingBox = {
  min: [number, number, number];
  max: [number, number, number];
};

/**
 * Compute union bounding box across multiple parser JSON outputs for the same IFC file.
 *
 * Used by the screenshot stage so that all parsers' renders of the same IFC file
 * share an identical camera frustum and centering — making pixel-by-pixel comparison
 * meaningful even when parsers disagree on which entities to include (e.g., when
 * one parser produces alignment polylines and another does not).
 *
 * Scans `mesh.positions` and `lines.positions` from every geometry entry.
 * Returns null if no geometry was found across any of the inputs.
 */
export function computeUnionBoundingBox(
  jsonFilePaths: Array<string>,
): BoundingBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let hasAny = false;

  for (const filePath of jsonFilePaths) {
    if (!fs.existsSync(filePath)) continue;

    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
      geometries?: Record<
        string,
        {
          mesh?: { positions?: Array<number> };
          lines?: { positions?: Array<number> };
        }
      >;
    };

    const geometries = data.geometries ?? {};
    for (const id of Object.keys(geometries)) {
      const entry = geometries[id];
      const arrays: Array<Array<number> | undefined> = [
        entry.mesh?.positions,
        entry.lines?.positions,
      ];

      for (const positions of arrays) {
        if (!positions) continue;
        for (let i = 0; i + 2 < positions.length; i += 3) {
          const x = positions[i];
          const y = positions[i + 1];
          const z = positions[i + 2];
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
  }

  if (!hasAny) return null;
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { initSync, IfcAPI } from "@ifc-lite/wasm";
import { extractEntityAttributesOnDemand } from "@ifc-lite/parser";
import type { IfcDataStore } from "@ifc-lite/parser";
import type { GeometryEntry } from "../types.ts";

const SKIP_TYPES = new Set(["IfcOpeningElement", "IfcSpace"]);

let wasmInitialized = false;

function ensureWasmInitialized() {
  if (wasmInitialized) return;

  const wasmEntryDir = path.dirname(
    fileURLToPath(import.meta.resolve("@ifc-lite/wasm")),
  );
  const wasmPath = path.join(wasmEntryDir, "ifc-lite_bg.wasm");
  const wasmBuffer = fs.readFileSync(wasmPath);

  initSync({ module: wasmBuffer.buffer });
  wasmInitialized = true;
}

const getGeometryData = (
  ifcContent: string,
  store: IfcDataStore,
): Record<string, GeometryEntry> => {
  const geometries: Record<string, GeometryEntry> = {};

  ensureWasmInitialized();

  const api = new IfcAPI();
  const collection = api.parseMeshes(ifcContent);

  // Group meshes by expressId (multiple meshes per entity possible)
  const meshesByExpressId = new Map<
    number,
    Array<{
      positions: Float32Array;
      normals: Float32Array;
      indices: Uint32Array;
      ifcType: string;
    }>
  >();

  for (let i = 0; i < collection.length; i++) {
    const mesh = collection.get(i);
    if (!mesh) continue;

    const expressId = mesh.expressId;
    const ifcType = mesh.ifcType;
    const positions = mesh.positions;
    const normals = mesh.normals;
    const indices = mesh.indices;

    const entry = { positions, normals, indices, ifcType };
    const existing = meshesByExpressId.get(expressId);
    if (existing) {
      existing.push(entry);
    } else {
      meshesByExpressId.set(expressId, [entry]);
    }
  }

  for (const [expressId, meshes] of meshesByExpressId) {
    const ifcType = meshes[0].ifcType;
    if (SKIP_TYPES.has(ifcType)) continue;

    let globalId = "";
    try {
      const attrs = extractEntityAttributesOnDemand(store, expressId);
      globalId = attrs.globalId ?? "";
    } catch {
      continue;
    }

    if (!globalId) continue;

    let positions: number[];
    let normals: number[];
    let indices: number[];

    if (meshes.length === 1) {
      positions = [...meshes[0].positions];
      normals = [...meshes[0].normals];
      indices = [...meshes[0].indices];
    } else {
      positions = [];
      normals = [];
      indices = [];
      let vertexOffset = 0;

      for (const mesh of meshes) {
        for (let i = 0; i < mesh.positions.length; i++) {
          positions.push(mesh.positions[i]);
        }
        for (let i = 0; i < mesh.normals.length; i++) {
          normals.push(mesh.normals[i]);
        }
        for (let i = 0; i < mesh.indices.length; i++) {
          indices.push(mesh.indices[i] + vertexOffset);
        }
        vertexOffset += mesh.positions.length / 3;
      }
    }

    // Identity matrix - transforms are baked into vertex positions by WASM
    const identityMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    geometries[globalId] = {
      ifcClass: ifcType,
      matrix: identityMatrix,
      mesh: { positions, normals, indices },
    };
  }

  collection.free();

  return geometries;
};

export { getGeometryData };

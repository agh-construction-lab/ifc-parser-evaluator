import * as THREE from "three";

import { IfcAPI, LogLevel, type FlatMesh } from "web-ifc";

import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { yUP_TO_zUP_MATRIX } from "../constants/matrices.ts";
import { IfcLine, GeometryEntry } from "../types.ts";

const DEFAULT_MATERIAL = new THREE.MeshPhongMaterial({
  color: new THREE.Color("#000000"),
  side: THREE.DoubleSide,
  vertexColors: true,
});

const getGeometryData = (ifcApi: IfcAPI, modelID: number) => {
  const geometries: Record<string, GeometryEntry> = {};
  const threeGeometries: Array<THREE.BufferGeometry> = [];

  ifcApi.SetLogLevel(LogLevel.LOG_LEVEL_OFF);
  ifcApi.StreamAllMeshes(modelID, (mesh: FlatMesh) => {
    const placedGeometries = mesh.geometries;
    const amountOfPlacedGeometries = placedGeometries.size();

    const line = ifcApi.GetLine(modelID, mesh.expressID) as IfcLine;
    const typeCode = ifcApi.GetLineType(modelID, mesh.expressID) as number;
    const typeName = ifcApi.GetNameFromTypeCode(typeCode);
    const globalId = line.GlobalId.value;
    const type = line.constructor.name;

    if (type !== "IfcOpeningElement" && type !== "IfcSpace") {
      const entityGeometies: Array<THREE.BufferGeometry> = [];

      for (let i = 0; i < amountOfPlacedGeometries; i++) {
        const placedGeometry = placedGeometries.get(i);
        const placedGeometryMatrix = placedGeometry.flatTransformation;
        const geometry = ifcApi.GetGeometry(
          modelID,
          placedGeometry.geometryExpressID,
        );
        const verticesData = ifcApi.GetVertexArray(
          geometry.GetVertexData(),
          geometry.GetVertexDataSize(),
        );
        const indexes = ifcApi.GetIndexArray(
          geometry.GetIndexData(),
          geometry.GetIndexDataSize(),
        );

        const positions = new Float32Array(verticesData.length / 2);
        const normals = new Float32Array(verticesData.length / 2);

        // console.log("verticesData", verticesData.join(", "));

        for (let i = 0; i < verticesData.length; i += 6) {
          positions[i / 2 + 0] = verticesData[i + 0];
          positions[i / 2 + 1] = verticesData[i + 1];
          positions[i / 2 + 2] = verticesData[i + 2];

          normals[i / 2 + 0] = verticesData[i + 3];
          normals[i / 2 + 1] = verticesData[i + 4];
          normals[i / 2 + 2] = verticesData[i + 5];
        }

        // console.log("Positions", positions.join(", "), positions.length);

        const meshGeometry = new THREE.BufferGeometry();
        meshGeometry.setAttribute(
          "position",
          new THREE.BufferAttribute(positions, 3),
        );
        meshGeometry.setAttribute(
          "normal",
          new THREE.BufferAttribute(normals, 3),
        );
        meshGeometry.setIndex(new THREE.BufferAttribute(indexes, 1));

        const mat = new THREE.Matrix4();
        mat.fromArray(placedGeometryMatrix);
        meshGeometry.applyMatrix4(mat);
        meshGeometry.applyMatrix4(yUP_TO_zUP_MATRIX);

        // const mesh = new THREE.Mesh(meshGeometry, DEFAULT_MATERIAL);
        // mesh.matrix = mat
        // mesh.matrixAutoUpdate = false;
        // meshes.push(mesh);
        // let geom = mesh.geometry.applyMatrix4(mesh.matrix);
        // threeGeometry.push(mesh.geometry);
        threeGeometries.push(meshGeometry);
        entityGeometies.push(meshGeometry);
      }

      const entityMergedGeometry = mergeGeometries(entityGeometies);
      const entityMergedMesh = new THREE.Mesh(
        entityMergedGeometry,
        DEFAULT_MATERIAL,
      );

      const positions = entityMergedMesh.geometry.attributes.position;
      const normals = entityMergedMesh.geometry.attributes.normal;
      const indexes = entityMergedMesh.geometry.getIndex();

      if (indexes == null) {
        throw new Error("Indexes are null");
      }

      // console.log("positions", positions.array.join(", "));
      // console.log("normals", normals.array.join(", "));
      // console.log("indexes", indexes.array.join(", "));

      // console.log("Amount of vertex positions", positions.count, `(array: ${positions.array.length})`);
      // console.log("Amount of vertex normals", normals.count, `(array: ${normals.array.length})`);
      // console.log("Amount of vertex indexes", indexes.count, `(array: ${indexes.array.length})`);

      const entityGeometryData = {
        positions: positions.array,
        normals: normals.array,
        indices: indexes.array,
      };

      // Identity matrix since transforms are baked into vertex positions
      const identityMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

      geometries[globalId] = {
        ifcClass: typeName,
        mesh: {
          positions: [...entityGeometryData.positions],
          normals: [...entityGeometryData.normals],
          indices: [...entityGeometryData.indices],
        },
        matrix: identityMatrix,
      };
    }
  });

  // === Second pass: alignments (IFC 4.3 curve-based geometry) ===
  // `StreamAllMeshes` only returns triangulated bodies. IFC 4.3 alignment entities
  // (IfcAlignment, IfcAlignmentHorizontal/Vertical, IfcCompositeCurve, ...) require
  // a separate API: ifcApi.GetAllAlignments(modelID).
  //
  // Note: web-ifc's .d.ts is out-of-date for this method. The actual runtime shape
  // (per node_modules/web-ifc/web-ifc-api-node.js:73679-73789) is:
  //   Array<{
  //     FlatCoordinationMatrix: number[16],
  //     horizontal: Array<{ points: Array<{x,y}>, data: string[] }>,   // lowercase, no .curves wrapper
  //     vertical:   Array<{ points: Array<{x,y}>, data: string[] }>,
  //     curve3D:    Array<{ points: Array<{x,y,z}> }>                  // already combines hor+ver into 3D
  //   }>
  // We prefer `curve3D` (proper 3D stationing already done by web-ifc internally) and
  // fall back to `horizontal` at z=0 if curve3D is empty (alignment without vertical profile).
  type WebIfcAlignment = {
    FlatCoordinationMatrix?: Array<number>;
    horizontal?: Array<{ points: Array<{ x: number; y: number; z?: number }> }>;
    vertical?: Array<{ points: Array<{ x: number; y: number; z?: number }> }>;
    curve3D?: Array<{ points: Array<{ x: number; y: number; z: number }> }>;
  };

  try {
    const alignments = ifcApi.GetAllAlignments(modelID) as
      | Array<WebIfcAlignment>
      | undefined;

    if (alignments && Array.isArray(alignments)) {
      const identityMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

      for (let aIdx = 0; aIdx < alignments.length; aIdx++) {
        const alignment = alignments[aIdx];

        // Prefer 3D curves (horizontal+vertical combined), fall back to horizontal only
        const curves =
          alignment.curve3D && alignment.curve3D.length > 0
            ? alignment.curve3D
            : (alignment.horizontal ?? []);

        const flatPositions: Array<number> = [];
        const indices: Array<number> = [];

        for (const curve of curves) {
          const startVertexIdx = flatPositions.length / 3;
          for (const pt of curve.points) {
            flatPositions.push(pt.x, pt.y, pt.z ?? 0);
          }
          for (let i = 0; i < curve.points.length - 1; i++) {
            indices.push(startVertexIdx + i, startVertexIdx + i + 1);
          }
        }

        if (flatPositions.length === 0 || indices.length === 0) continue;

        // Apply optional FlatCoordinationMatrix, then yUP -> zUP
        const buf = new Float32Array(flatPositions);
        const tempGeometry = new THREE.BufferGeometry();
        tempGeometry.setAttribute("position", new THREE.BufferAttribute(buf, 3));

        if (
          alignment.FlatCoordinationMatrix &&
          alignment.FlatCoordinationMatrix.length === 16
        ) {
          tempGeometry.applyMatrix4(
            new THREE.Matrix4().fromArray(alignment.FlatCoordinationMatrix),
          );
        }
        tempGeometry.applyMatrix4(yUP_TO_zUP_MATRIX);

        const transformedPositions = Array.from(
          tempGeometry.getAttribute("position").array as Float32Array,
        );

        // GetAllAlignments doesn't expose expressID/GlobalId per alignment.
        // Use a synthetic key so this entity is addressable in the geometries map.
        const syntheticKey = `_alignment_${aIdx}`;

        geometries[syntheticKey] = {
          ifcClass: "IfcAlignment",
          matrix: identityMatrix,
          lines: {
            positions: transformedPositions,
            indices,
          },
        };
      }
    }
  } catch (err) {
    // GetAllAlignments may throw for pre-IFC4X3 schemas — non-fatal.
    console.warn("GetAllAlignments threw — likely non-IFC4X3 model:", err);
  }

  ifcApi.SetLogLevel(LogLevel.LOG_LEVEL_DEBUG);

  return geometries;
};

export { getGeometryData };

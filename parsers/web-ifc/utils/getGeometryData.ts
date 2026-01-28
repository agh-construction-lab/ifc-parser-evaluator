import * as THREE from "three";
import { IfcAPI, LogLevel, type FlatMesh } from "web-ifc";

import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";


const DEFAULT_MATERIAL = new THREE.MeshPhongMaterial({
  color: new THREE.Color("#000000"),
  side: THREE.DoubleSide,
  vertexColors: true,
});

const getGeometryData = (ifcApi: IfcAPI, modelID: number) => {
  const geometryData: Record<
    string,
    {
      ifcClass: string;
      positions: Array<number>;
      normals: Array<number>;
      indexes: Array<number>;
    }
  > = {};
  const threeGeometries: Array<THREE.BufferGeometry> = [];

  ifcApi.SetLogLevel(LogLevel.LOG_LEVEL_OFF);
  ifcApi.StreamAllMeshes(modelID, (mesh: FlatMesh) => {
    const placedGeometries = mesh.geometries;
    const amountOfPlacedGeometries = placedGeometries.size();

    const line = ifcApi.GetLine(modelID, mesh.expressID);
    const typeCode = ifcApi.GetLineType(modelID, mesh.expressID);
    const typeName = ifcApi.GetNameFromTypeCode(typeCode);
    const globalId = line.GlobalId.value;
    const name = line.Name?.value;
    const type = line.constructor.name;

    console.log(
      `Porcessing geometry: #${line.expressID} ${typeName} "${name}" (${globalId})`,
    );

    if (type !== "IfcOpeningElement" && type !== "IfcSpace") {
      console.log(
        globalId,
        typeName,
        "has",
        amountOfPlacedGeometries,
        "geometries",
      );

      // const placedGeometryVertices = [];
      // const placedGeometryNormals = [];
      // const placedGeometryIndexes = [];

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

        let positions = new Float32Array(verticesData.length / 2);
        let normals = new Float32Array(verticesData.length / 2);

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

        const zUP_TO_yUP_MATRIX = new THREE.Matrix4().fromArray([
          1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1,
        ]);
        const yUP_TO_zUP_MATRIX = new THREE.Matrix4().fromArray([
          1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1,
        ]);

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
        indexes: indexes.array,
      };

      geometryData[globalId] = {
        ifcClass: typeName,
        positions: [...entityGeometryData.positions],
        normals: [...entityGeometryData.normals],
        indexes: [...entityGeometryData.indexes],
      };
    }
  });

  ifcApi.SetLogLevel(LogLevel.LOG_LEVEL_DEBUG);

  console.log("");

  console.log("Entites geometries:", Object.keys(geometryData).length);

  for (const [key, value] of Object.entries(geometryData)) {
    // console.log(`${key}: { positions: ${value.positions.length}, normals: ${value.normals.length}, indexes: ${value.indexes.length} }`);
  }

  console.log("");

  // console.log("Merging all geometries")
  // const combinedGeometry = mergeGeometries(threeGeometries);

  // if (combinedGeometry) {
  //     const mergedMesh = new THREE.Mesh(combinedGeometry, DEFAULT_MATERIAL);
  //     // mergedMesh.geometry = mergeVertices(mergedMesh.geometry);

  //     const positions = mergedMesh.geometry.attributes.position;
  //     const normals = mergedMesh.geometry.attributes.normal;
  //     const indexes = mergedMesh.geometry.getIndex();

  //     if (indexes == null) {
  //         throw new Error("Indexes are null");
  //     }

  //     console.log("Amount of vertex positions", positions.count, `(array: ${positions.array.length})`);
  //     console.log("Amount of vertex normals", normals.count, `(array: ${normals.array.length})`);
  //     console.log("Amount of vertex indexes", indexes.count, `(array: ${indexes.array.length})`);
  // }

  return geometryData;
};

export { getGeometryData };

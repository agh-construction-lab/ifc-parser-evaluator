import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';

import { MeshLineGeometry, MeshLineMaterial } from 'meshline'

import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';

const BACKGROUND_COLOR = "#1a1a1a";
const canvas = document.querySelector('#three-app-canvas');
const renderStatsContainer = document.querySelector('#render-stats');

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const height = window.innerHeight;
const width = window.innerWidth;

const camera = new THREE.OrthographicCamera(
  width / - 2,
  width / 2,
  height / 2,
  height / - 2,
  1,
  9999
);

const CAMERA_POSITION_FRONT = [0, 0, 1000];
const CAMERA_POSITION_LEFT = [-1000, 0, 0];
const CAMERA_POSITION_RIGHT = [1000, 0, 0];
const CAMERA_POSITION_TOP = [0, 1000, 0];
const CAMERA_POSITION_PERSPECTIVE = [1000, 1000, 1000];

camera.position.set(...CAMERA_POSITION_PERSPECTIVE);
camera.lookAt(0, 0, 0);

const scene = new THREE.Scene();
scene.background = new THREE.Color(BACKGROUND_COLOR);

const ambientLight = new THREE.AmbientLight("#606060", 3);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight("#ffffff", 3);
directionalLight.position.set(1, 0.75, 0.5).normalize();
scene.add(directionalLight);

const gridHelperXY = new THREE.GridHelper(100, 100);
gridHelperXY.rotation.set(Math.PI / 2, 0, 0);
gridHelperXY.visible = false;
scene.add(gridHelperXY);

const gridHelperYZ = new THREE.GridHelper(100, 100);
gridHelperYZ.rotation.set(0, 0, Math.PI / 2);
gridHelperYZ.visible = false;
scene.add(gridHelperYZ);

const gridHelperXZ = new THREE.GridHelper(100, 100);
gridHelperXZ.rotation.set(0, Math.PI / 2, 0);
gridHelperXZ.visible = false;
scene.add(gridHelperXZ);

const update = () => {
  requestAnimationFrame(update);
  renderer.render(scene, camera);
}

update();

let currentMesh = null;

window.setView = (view) => {
  switch (view) {
    case "front":
      camera.position.set(...CAMERA_POSITION_FRONT);
      gridHelperXY.visible = true;
      gridHelperYZ.visible = false;
      gridHelperXZ.visible = false;
      break;

    case "left":
      camera.position.set(...CAMERA_POSITION_LEFT);
      gridHelperXY.visible = false;
      gridHelperYZ.visible = true;
      gridHelperXZ.visible = false;
      break;

    case "right":
      camera.position.set(...CAMERA_POSITION_RIGHT);
      gridHelperXY.visible = false;
      gridHelperYZ.visible = true;
      gridHelperXZ.visible = false;
      break;

    case "top":
      camera.position.set(...CAMERA_POSITION_TOP);
      gridHelperXY.visible = false;
      gridHelperYZ.visible = false;
      gridHelperXZ.visible = true;
      break;

    case "perspective":
      camera.position.set(...CAMERA_POSITION_PERSPECTIVE);
      gridHelperXY.visible = false;
      gridHelperYZ.visible = false;
      gridHelperXZ.visible = true;
      break;
  }

  const distance = 4;
  const fovInRadians = 45 * Math.PI / 180;
  const verticalSize = 2 * distance * Math.tan(fovInRadians / 2);
  const aspect = 1;
  camera.top = +verticalSize / 2;
  camera.bottom = -verticalSize / 2;
  camera.right = (verticalSize * aspect) / 2;
  camera.left = -(verticalSize * aspect) / 2;

  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);

  update();
}

window.addMesh = (ifcData) => {
  if (currentMesh !== null) {
    scene.remove(currentMesh);
  }

  let objectGeometry = null;

  const entityKeys = Object.keys(ifcData);

  for (let i = 0; i < entityKeys.length; i++) {
    const key = entityKeys[i];
    const data = ifcData[key];

    const verticesLimit = 999_999_999;
    const positions = data.positions.slice(0, 3 * verticesLimit);
    const normals = data.normals.slice(0, 3 * verticesLimit);
    const indexes = data.indexes.slice(0, verticesLimit);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indexes);

    const m = data.matrix;

    if (m !== undefined) {
      const transformMatrix = new THREE.Matrix4().fromArray(m);
      geometry.applyMatrix4(transformMatrix);
    }


    if (objectGeometry === null) {
      objectGeometry = geometry;
    } else {
      objectGeometry = BufferGeometryUtils.mergeGeometries(
        [objectGeometry, geometry],
        false
      );
    }
  }

  if (objectGeometry !== null) {
    objectGeometry.center();

    function createThickWireframe(objectGeometry) {
      const posAttr = objectGeometry.getAttribute('position');
      const idxAttr = objectGeometry.getIndex();

      // 1) Zbuduj tablicę „edgeIndices” tak, by odwzorować każde triangle-edge raz:
      const edgeIndices = [];
      if (idxAttr) {
        const idx = idxAttr.array;
        for (let i = 0; i < idx.length; i += 3) {
          const a = idx[i], b = idx[i + 1], c = idx[i + 2];
          edgeIndices.push(a, b, b, c, c, a);
        }
      } else {
        // non-indexed: każdy 3-wierzchołkowy trójkąt ma pozycje 0-1-2, 3-4-5, …
        for (let i = 0; i < posAttr.count; i += 3) {
          edgeIndices.push(i, i + 1, i + 1, i + 2, i + 2, i);
        }
      }

      // 2) Rozwiń je do jednej płaskiej tablicy XYZ dla LineSegmentsGeometry:
      const positions = [];

      for (let ei of edgeIndices) {
        positions.push(
          posAttr.getX(ei),
          posAttr.getY(ei),
          posAttr.getZ(ei),
        );
      }

      const segGeo = new LineSegmentsGeometry();
      segGeo.setPositions(positions);

      const mat = new LineMaterial({
        color: 0xffffff,
        linewidth: 5,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      });
      mat.resolution.set(window.innerWidth, window.innerHeight);

      let vertexPositions;
      if (idxAttr) {
        vertexPositions = Array.from(posAttr.array);
      } else {
        vertexPositions = [];
        for (let i = 0; i < posAttr.count; i += 3) {
          // bierze punkty i, i+1, i+2
          for (let k = 0; k < 3; k++) {
            vertexPositions.push(
              posAttr.getX(i + k),
              posAttr.getY(i + k),
              posAttr.getZ(i + k),
            );
          }
        }
      }


      const vertices = new Map();

      for (let i = 0; i < vertexPositions.length; i += 3) {
        const key = `${vertexPositions[i]},${vertexPositions[i + 1]},${vertexPositions[i + 2]}`;

        if (!vertices.has(key)) {
          vertices.set(key, 0);
        } else {
          vertices.set(key, vertices.get(key) + 1);
        }
      }


      const points = new THREE.Group();

      for (let [key, count] of vertices) {
        const [x, y, z] = key.split(',').map(Number);
        const pointGeometry = new THREE.SphereGeometry(0.01, 8, 8);
        const pointMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.5,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const pointMesh = new THREE.Mesh(pointGeometry, pointMaterial);
        pointMesh.position.set(x, y, z);
        pointMesh.scale.setScalar((count * count) * 0.5);
        points.add(pointMesh);
      }

      const wire = new LineSegments2(segGeo, mat);
      wire.add(points);
      return wire;
    }

    const mesh = createThickWireframe(objectGeometry);


    scene.add(mesh);
    currentMesh = mesh;
    currentMesh.updateMatrixWorld(true);

    currentMesh.rotation.set(
      THREE.MathUtils.degToRad(-90),
      0,
      THREE.MathUtils.degToRad(90),
    );
    currentMesh.updateMatrixWorld(true);
  }

  update();
}

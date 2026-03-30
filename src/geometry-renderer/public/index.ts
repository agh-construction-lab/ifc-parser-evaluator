import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

type GeometryEntry = {
  ifcClass?: string;
  mesh?: {
    positions?: number[];
    normals?: number[];
    indices?: number[];
  };
  positions?: number[];
  normals?: number[];
  indices?: number[];
  indexes?: number[];
  matrix?: number[];
}

declare global {
  interface Window {
    setView: (view: string) => void;
    addMesh: (geometriesData: Record<string, GeometryEntry>) => void;
    loadSampleGeometry: () => void;
  }
}

const BACKGROUND_COLOR = "#1a1a1a";

const CAMERA_POSITIONS: Record<string, [number, number, number]> = {
  front: [0, 0, 1000],
  left: [-1000, 0, 0],
  right: [1000, 0, 0],
  top: [0, 1000, 0],
  perspective: [1000, 1000, 1000],
};

// === Setup ===
const canvas = document.getElementById('canvas');
const entityCountEl = document.getElementById('entity-count');
const vertexCountEl = document.getElementById('vertex-count');
const triangleCountEl = document.getElementById('triangle-count');

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// Camera
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 10;
const camera = new THREE.OrthographicCamera(
  -frustumSize * aspect / 2,
  frustumSize * aspect / 2,
  frustumSize / 2,
  -frustumSize / 2,
  0.1,
  10000
);
camera.position.set(...CAMERA_POSITIONS.perspective);
camera.lookAt(0, 0, 0);

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(BACKGROUND_COLOR);

// Lights
const ambientLight = new THREE.AmbientLight("#606060", 3);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight("#ffffff", 3);
directionalLight.position.set(1, 0.75, 0.5).normalize();
scene.add(directionalLight);

// Grid helpers
const gridHelpers = {
  xy: createGridHelper(Math.PI / 2, 0, 0),
  yz: createGridHelper(0, 0, Math.PI / 2),
  xz: createGridHelper(0, 0, 0),
};

function createGridHelper(rotX, rotY, rotZ) {
  const grid = new THREE.GridHelper(100, 100, 0x444444, 0x333333);
  grid.rotation.set(rotX, rotY, rotZ);
  grid.visible = false;
  scene.add(grid);
  return grid;
}

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// === State ===
let currentMesh = null;
let animationId = null;

// === Animation Loop ===
function animate() {
  animationId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// === Resize Handler ===
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;

  camera.left = -frustumSize * aspect / 2;
  camera.right = frustumSize * aspect / 2;
  camera.top = frustumSize / 2;
  camera.bottom = -frustumSize / 2;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
});

// === View Control ===
window.setView = function (view) {
  const position = CAMERA_POSITIONS[view];
  if (!position) return;

  camera.position.set(...position);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  // Update grid visibility
  Object.values(gridHelpers).forEach(g => g.visible = false);

  switch (view) {
    case 'front':
      gridHelpers.xy.visible = true;
      break;
    case 'left':
    case 'right':
      gridHelpers.yz.visible = true;
      break;
    case 'top':
    case 'perspective':
      gridHelpers.xz.visible = true;
      break;
  }

  camera.zoom = 2;
};

// === Mesh Loading ===
window.addMesh = function (geometriesData) {
  // Remove previous mesh
  if (currentMesh !== null) {
    scene.remove(currentMesh);
    currentMesh = null;
  }

  const entityKeys = Object.keys(geometriesData);
  if (entityKeys.length === 0) return;

  let combinedGeometry = null;
  let totalVertices = 0;
  let totalTriangles = 0;

  for (const globalId of entityKeys) {
    const entry = geometriesData[globalId];

    // Support both old format (positions/normals/indexes) and new format (mesh.positions/mesh.normals/mesh.indices)
    const positions = entry.mesh?.positions ?? entry.positions;
    const normals = entry.mesh?.normals ?? entry.normals;
    const indices = entry.mesh?.indices ?? entry.indexes ?? entry.indices;
    const matrix = entry.matrix;

    if (!positions || !normals || !indices) {
      console.warn(`Skipping entity ${globalId}: missing geometry data`);
      continue;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);

    // Apply transformation matrix if present
    if (matrix && matrix.length === 16) {
      const transformMatrix = new THREE.Matrix4().fromArray(matrix);
      geometry.applyMatrix4(transformMatrix);
    }

    totalVertices += positions.length / 3;
    totalTriangles += indices.length / 3;

    if (combinedGeometry === null) {
      combinedGeometry = geometry;
    } else {
      combinedGeometry = BufferGeometryUtils.mergeGeometries([combinedGeometry, geometry], false);
    }
  }

  if (combinedGeometry === null) return;

  // Center geometry
  combinedGeometry.computeBoundingBox();
  combinedGeometry.center();

  // Create wireframe visualization
  const wireframe = createWireframe(combinedGeometry);

  // Apply rotation to convert coordinate system (Y-up to Z-up viewing)
  wireframe.rotation.set(
    THREE.MathUtils.degToRad(-90),
    0,
    THREE.MathUtils.degToRad(90)
  );

  scene.add(wireframe);
  currentMesh = wireframe;

  // Fit camera to object
  fitCameraToObject(combinedGeometry);

  // Update stats
  entityCountEl.textContent = String(entityKeys.length);
  vertexCountEl.textContent = totalVertices.toLocaleString();
  triangleCountEl.textContent = totalTriangles.toLocaleString();
};

// === Wireframe Creation ===
function createWireframe(geometry) {
  const group = new THREE.Group();

  // Extract edge positions
  const posAttr = geometry.getAttribute('position');
  const idxAttr = geometry.getIndex();
  const edgePositions = [];

  if (idxAttr) {
    const idx = idxAttr.array;
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      // Add edges: a-b, b-c, c-a
      [a, b, b, c, c, a].forEach(vi => {
        edgePositions.push(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi));
      });
    }
  } else {
    for (let i = 0; i < posAttr.count; i += 3) {
      for (const [j, k] of [[0, 1], [1, 2], [2, 0]]) {
        edgePositions.push(
          posAttr.getX(i + j), posAttr.getY(i + j), posAttr.getZ(i + j),
          posAttr.getX(i + k), posAttr.getY(i + k), posAttr.getZ(i + k)
        );
      }
    }
  }

  // Create line segments
  const lineGeometry = new LineSegmentsGeometry();
  lineGeometry.setPositions(edgePositions);

  const lineMaterial = new LineMaterial({
    color: 0xffffff,
    linewidth: 3,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
  lineMaterial.resolution.set(window.innerWidth, window.innerHeight);

  const lines = new LineSegments2(lineGeometry, lineMaterial);
  group.add(lines);

  // Create vertex points
  const vertices = extractUniqueVertices(posAttr, idxAttr);
  const pointsGroup = createVertexPoints(vertices);
  group.add(pointsGroup);

  return group;
}

function extractUniqueVertices(posAttr, idxAttr) {
  const vertices = new Map();
  const positions = idxAttr ? Array.from(posAttr.array) : [];

  if (!idxAttr) {
    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    }
  }

  for (let i = 0; i < positions.length; i += 3) {
    const key = `${positions[i]},${positions[i + 1]},${positions[i + 2]}`;
    vertices.set(key, (vertices.get(key) || 0) + 1);
  }

  return vertices;
}

function createVertexPoints(vertices) {
  const group = new THREE.Group();
  const pointGeometry = new THREE.SphereGeometry(0.01, 6, 6);
  const pointMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  for (const [key, count] of vertices) {
    const [x, y, z] = key.split(',').map(Number);
    const point = new THREE.Mesh(pointGeometry, pointMaterial);
    point.position.set(x, y, z);
    point.scale.setScalar(Math.max(1, count * 0.5));
    group.add(point);
  }

  return group;
}

// === Camera Fitting ===
function fitCameraToObject(geometry) {
  geometry.computeBoundingBox();
  const boundingBox = geometry.boundingBox;
  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const padding = 1.5;

  // Update orthographic camera frustum
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -maxDim * padding * aspect / 2;
  camera.right = maxDim * padding * aspect / 2;
  camera.top = maxDim * padding / 2;
  camera.bottom = -maxDim * padding / 2;
  camera.updateProjectionMatrix();

  // Reset controls target to center
  controls.target.set(0, 0, 0);
  controls.update();
}

// === Debug: Load sample geometry ===
window.loadSampleGeometry = function () {
  // Simple cube geometry for testing
  const size = 1;
  const positions = [
    // Front face
    -size, -size, size, size, -size, size, size, size, size,
    -size, -size, size, size, size, size, -size, size, size,
    // Back face
    -size, -size, -size, -size, size, -size, size, size, -size,
    -size, -size, -size, size, size, -size, size, -size, -size,
    // Top face
    -size, size, -size, -size, size, size, size, size, size,
    -size, size, -size, size, size, size, size, size, -size,
    // Bottom face
    -size, -size, -size, size, -size, -size, size, -size, size,
    -size, -size, -size, size, -size, size, -size, -size, size,
    // Right face
    size, -size, -size, size, size, -size, size, size, size,
    size, -size, -size, size, size, size, size, -size, size,
    // Left face
    -size, -size, -size, -size, -size, size, -size, size, size,
    -size, -size, -size, -size, size, size, -size, size, -size,
  ];

  const normals = [];
  const faceNormals = [
    [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]
  ];
  for (const normal of faceNormals) {
    for (let i = 0; i < 6; i++) normals.push(...normal);
  }

  const indices = Array.from({ length: 36 }, (_, i) => i);

  window.addMesh({
    'sample-cube': {
      ifcClass: 'IfcBuildingElementProxy',
      mesh: { positions, normals, indices },
      matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    }
  });
};

console.log('Geometry Renderer initialized');
console.log('Call window.addMesh(geometriesData) to load geometry');
console.log('Call window.loadSampleGeometry() to load a test cube');

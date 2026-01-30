import * as THREE from "three";

const zUP_TO_yUP_MATRIX = new THREE.Matrix4().fromArray([
  1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1,
]);

const yUP_TO_zUP_MATRIX = new THREE.Matrix4().fromArray([
  1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1,
]);

export { zUP_TO_yUP_MATRIX, yUP_TO_zUP_MATRIX };

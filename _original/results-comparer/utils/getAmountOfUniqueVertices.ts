function roundToDecimalPlaces(value: number, places: number): number {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}

function getNumberOfUniqueVertices({ vertexData }: { vertexData: Array<number> }): number {
  // vertexData is a flat array of vertex positions, e.g. [x1, y1, z1, x2, y2, z2, ...]
  const uniqueVertices = new Set<string>();

  for (let i = 0; i < vertexData.length; i += 3) {
    const x = roundToDecimalPlaces(vertexData[i], 8);
    const y = roundToDecimalPlaces(vertexData[i + 1], 8);
    const z = roundToDecimalPlaces(vertexData[i + 2], 8);

    const vertex = `${x},${y},${z}`;
    uniqueVertices.add(vertex);
  }

  return uniqueVertices.size;
}

export { getNumberOfUniqueVertices };

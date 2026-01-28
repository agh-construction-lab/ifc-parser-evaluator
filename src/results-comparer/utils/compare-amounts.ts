export type Differences = Record<
  string,
  {
    reason: string;
    webIfcValue: unknown;
    ifcOpenShellValue: unknown;
  }
>;

/**
 * Compare amounts between two parsers' results
 */
export function getAmountsDifferences(
  objectA: Record<string, number>,
  objectB: Record<string, number>,
): Differences {
  const differences: Differences = {};

  const upperCaseObjectA = normalizeKeys(objectA);
  const upperCaseObjectB = normalizeKeys(objectB);

  for (const key of Object.keys(upperCaseObjectA)) {
    const valueA = upperCaseObjectA[key];
    const valueB = upperCaseObjectB[key];

    if (valueA !== valueB) {
      differences[key] = {
        reason: "Amounts differ",
        webIfcValue: valueA,
        ifcOpenShellValue: valueB,
      };
    }
  }

  return differences;
}

function normalizeKeys(obj: Record<string, number>): Record<string, number> {
  return Object.keys(obj).reduce(
    (acc, key) => {
      acc[key.toUpperCase()] = obj[key];
      return acc;
    },
    {} as Record<string, number>,
  );
}

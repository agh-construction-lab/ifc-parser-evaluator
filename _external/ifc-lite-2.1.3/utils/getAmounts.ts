import { IFC_ENTITY_NAMES } from "@ifc-lite/data";
import type { IfcDataStore } from "@ifc-lite/parser";

function toIfcClassName(uppercase: string): string {
  return IFC_ENTITY_NAMES[uppercase] ?? uppercase;
}

const getAmounts = (store: IfcDataStore) => {
  const amountsByType: Record<string, number> = {};

  const entries = [...store.entityIndex.byType.entries()]
    .map(([key, ids]) => [toIfcClassName(key), ids.length] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [typeName, count] of entries) {
    amountsByType[typeName] = count;
  }

  const amountTotal = Object.values(amountsByType).reduce((a, b) => a + b, 0);

  return { amountTotal, amountsByType };
};

export { getAmounts };

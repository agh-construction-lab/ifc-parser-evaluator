import { IfcTypeEnumToString, IFC_ENTITY_NAMES } from "@ifc-lite/data";
import type { SpatialNode as IfcLiteSpatialNode } from "@ifc-lite/data";
import type { IfcDataStore } from "@ifc-lite/parser";
import {
  extractEntityAttributesOnDemand,
  extractPropertiesOnDemand,
  extractQuantitiesOnDemand,
} from "@ifc-lite/parser";
import type { SpatialNode } from "../types.ts";

class Tree {
  private store: IfcDataStore;

  constructor(store: IfcDataStore) {
    this.store = store;
  }

  getSpatialTree(): Array<SpatialNode> {
    const hierarchy = this.store.spatialHierarchy;
    if (!hierarchy) {
      throw new Error("No spatial hierarchy found");
    }
    return [this.convertNode(hierarchy.project)];
  }

  private convertNode(node: IfcLiteSpatialNode): SpatialNode {
    const ifcClass = IfcTypeEnumToString(node.type);

    let globalId = "";
    try {
      const attrs = extractEntityAttributesOnDemand(this.store, node.expressId);
      globalId = attrs.globalId ?? "";
    } catch {
      // Entity may not have attributes
    }

    const properties = this.extractProperties(node.expressId);
    const quantities = this.extractQuantities(node.expressId);

    // Spatial children (sub-containers)
    const children: Array<SpatialNode> = node.children.map((child) =>
      this.convertNode(child),
    );

    // Contained elements -> also added as children
    for (const elementId of node.elements) {
      children.push(this.buildElementNode(elementId));
    }

    return {
      expressId: node.expressId,
      globalId,
      ifcClass,
      name: node.name || null,
      properties,
      quantities,
      children,
    };
  }

  private buildElementNode(expressId: number): SpatialNode {
    const entityRef = this.store.entityIndex.byId.get(expressId);
    const rawType = entityRef?.type ?? "Unknown";
    const ifcClass = IFC_ENTITY_NAMES[rawType] ?? rawType;

    let globalId = "";
    let name: string | null = null;
    try {
      const attrs = extractEntityAttributesOnDemand(this.store, expressId);
      globalId = attrs.globalId ?? "";
      name = attrs.name || null;
    } catch {
      // Entity may not have attributes
    }

    const properties = this.extractProperties(expressId);
    const quantities = this.extractQuantities(expressId);

    return {
      expressId,
      globalId,
      ifcClass,
      name,
      properties,
      quantities,
      children: [],
    };
  }

  private extractProperties(
    expressId: number,
  ): Record<string, Record<string, string | number | boolean | null>> {
    const result: Record<
      string,
      Record<string, string | number | boolean | null>
    > = {};

    try {
      const pSets = extractPropertiesOnDemand(this.store, expressId);
      for (const pSet of pSets) {
        const pSetName = pSet.name;
        result[pSetName] = result[pSetName] ?? {};
        for (const prop of pSet.properties) {
          const value = prop.value;
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean" ||
            value === null
          ) {
            result[pSetName][prop.name] = value;
          }
        }
      }
    } catch {
      // Properties may not be available
    }

    return result;
  }

  private extractQuantities(
    expressId: number,
  ): Record<string, Record<string, number>> {
    const result: Record<string, Record<string, number>> = {};

    try {
      const qSets = extractQuantitiesOnDemand(this.store, expressId);
      for (const qSet of qSets) {
        const qSetName = qSet.name;
        result[qSetName] = result[qSetName] ?? {};
        for (const quant of qSet.quantities) {
          result[qSetName][quant.name] = quant.value;
        }
      }
    } catch {
      // Quantities may not be available
    }

    return result;
  }
}

export { Tree };

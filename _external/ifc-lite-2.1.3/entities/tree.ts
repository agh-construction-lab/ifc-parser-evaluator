import {
  IfcTypeEnumToString,
  IFC_ENTITY_NAMES,
  RelationshipType,
} from "@ifc-lite/data";
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
    const visited = new Set<number>();
    return [this.convertNode(hierarchy.project, visited)];
  }

  private convertNode(
    node: IfcLiteSpatialNode,
    visited: Set<number>,
  ): SpatialNode {
    visited.add(node.expressId);

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

    // Spatial sub-containers (Site/Building/Storey/Space) — already filtered by the library.
    const children: Array<SpatialNode> = [];
    for (const child of node.children) {
      if (visited.has(child.expressId)) continue;
      children.push(this.convertNode(child, visited));
    }

    // Directly contained elements via IfcRelContainedInSpatialStructure.
    for (const elementId of node.elements) {
      if (visited.has(elementId)) continue;
      children.push(this.buildElementNode(elementId, visited));
    }

    // Non-spatial aggregations (e.g. IfcProject -> IfcRailway in IFC4.3 infrastructure files).
    // The library's spatial-hierarchy-builder filters Aggregates to spatial-structure types only,
    // so anything else is missing — pull it in here.
    for (const aggregatedId of this.getAggregatedChildren(node.expressId)) {
      if (visited.has(aggregatedId)) continue;
      children.push(this.buildElementNode(aggregatedId, visited));
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

  private buildElementNode(
    expressId: number,
    visited: Set<number>,
  ): SpatialNode {
    visited.add(expressId);

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

    // Follow IfcRelAggregates to pick up decomposed parts:
    // IfcRoof -> IfcSlab, IfcCurtainWall -> IfcMember/IfcPlate, IfcStair -> IfcStairFlight,
    // IfcRailwayPart -> IfcRailwayPart, etc.
    const children: Array<SpatialNode> = [];
    for (const childId of this.getAggregatedChildren(expressId)) {
      if (visited.has(childId)) continue;
      children.push(this.buildElementNode(childId, visited));
    }

    // Follow IfcRelContainedInSpatialStructure as well — needed for spatial-structure types
    // outside the library's {Site/Building/Storey/Space} filter (e.g. IfcRailway in IFC4.3
    // infrastructure files contains IfcAlignment via this relation, and IfcRailwayPart
    // contains IfcTrackElement/IfcEarthworksFill).
    // Non-spatial-structure entities return an empty list here, so no risk of noise.
    for (const childId of this.getContainedElements(expressId)) {
      if (visited.has(childId)) continue;
      children.push(this.buildElementNode(childId, visited));
    }

    return {
      expressId,
      globalId,
      ifcClass,
      name,
      properties,
      quantities,
      children,
    };
  }

  private getAggregatedChildren(expressId: number): Array<number> {
    return this.store.relationships.getRelated(
      expressId,
      RelationshipType.Aggregates,
      "forward",
    );
  }

  private getContainedElements(expressId: number): Array<number> {
    return this.store.relationships.getRelated(
      expressId,
      RelationshipType.ContainsElements,
      "forward",
    );
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

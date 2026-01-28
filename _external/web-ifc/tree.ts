// import ifcopenshell
// import json

import { IfcAPI, IFCOBJECTDEFINITION, IFCPRODUCT, IFCPROJECT } from "web-ifc";

const LEVEL_INDICATOR = "- ";
const SET_INDICATOR = "| ";
const VALUE_INDICATOR = "> ";

type Node = {
  expressID: number;
  type: string;
  children: Node[];
};

type NodeData = {
  expressID: number;
  type: string;
  name: string;
  globalId: string;
  children: Array<NodeData>;
  propertySets: Record<string, Record<string, string | number>>;
  quantitySets: Record<string, Record<string, string | number>>;
};

class Tree {
  ifcApi: IfcAPI;
  modelID: number;
  root: Node | undefined;
  project: NodeData | undefined;

  constructor(ifcApi: IfcAPI, modelID: number) {
    this.ifcApi = ifcApi;
    this.modelID = modelID;
  }

  async init() {
    this.root = await this.ifcApi.properties.getSpatialStructure(
      this.modelID,
      true,
    );
    this.project = await this.parseTree(true, true);
  }

  async parseTree(
    includeProperties: boolean = false,
    includeQuantities: boolean = false,
  ): Promise<NodeData | undefined> {
    if (!this.root) {
      return;
    }

    return await this.parseNode(
      this.root,
      includeProperties,
      includeQuantities,
    );
  }

  async parseNode(
    node: Node,
    includeProperties: boolean,
    includeQuantities: boolean,
  ): Promise<NodeData> {
    const { expressID, type, children } = node;
    const entity = this.ifcApi.GetLine(this.modelID, expressID);

    const globalId = entity.GlobalId.value;
    const name = entity.Name?.value ?? null;

    const data: NodeData = {
      expressID,
      type,
      name,
      globalId,
      children: [],
      propertySets: {},
      quantitySets: {},
    };

    if (includeProperties || includeQuantities) {
      const pSets = await this.ifcApi.properties.getPropertySets(
        this.modelID,
        expressID,
        true,
      );
      for (const pSet of pSets) {
        const pSetName = pSet.Name.value;

        if (includeProperties && pSet.HasProperties) {
          const props = pSet.HasProperties ?? [];
          for (const prop of props) {
            if (prop.NominalValue) {
              const propName = prop.Name.value;
              const propValue = prop.NominalValue.value;
              data.propertySets[pSetName] = data.propertySets[pSetName] ?? {};
              data.propertySets[pSetName][propName] = propValue;
            }
          }
        }

        if (includeQuantities && pSet.Quantities) {
          const quants = pSet.Quantities ?? [];
          for (const quant of quants) {
            const quantName = quant.Name.value;
            const quantValue = quant.LengthValue
              ? quant.LengthValue.value
              : quant.AreaValue
                ? quant.AreaValue.value
                : quant.VolumeValue
                  ? quant.VolumeValue.value
                  : quant.CountValue
                    ? quant.CountValue.value
                    : quant.CountValue;
            data.quantitySets[pSetName] = data.quantitySets[pSetName] ?? {};
            data.quantitySets[pSetName][quantName] = quantValue;
          }
        }
      }
    }

    for (const child of children) {
      data.children.push(
        await this.parseNode(child, includeProperties, includeQuantities),
      );
    }

    return data;
  }

  getGroupedByType() {
    if (!this.project) {
      throw new Error("Project not found");
    }

    return {
      IFCPROJECT: [this.getNodeDataWithGroupedChildren(this.project)],
    };
  }

  getNodeDataWithGroupedChildren(node: NodeData) {
    const { children, ...data } = node;

    const groupedChildren: Record<string, Array<any>> = {};

    for (const child of children) {
      if (!groupedChildren[child.type]) {
        groupedChildren[child.type] = [];
      }

      groupedChildren[child.type].push(
        this.getNodeDataWithGroupedChildren(child),
      );
    }

    return {
      ...data,
      children: groupedChildren,
    };
  }
}

export { Tree };

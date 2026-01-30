import { IfcLine, IfcPropertySet, SpatialNode } from "../types.ts";
import { IfcAPI } from "web-ifc";

type Node = {
  expressID: number;
  type: string;
  children: Array<Node>;
};

class Tree {
  ifcApi: IfcAPI;
  modelID: number;
  root: Node | undefined;
  project: SpatialNode | undefined;

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
  ): Promise<SpatialNode | undefined> {
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
  ): Promise<SpatialNode> {
    const { expressID, type, children } = node;
    const entity = this.ifcApi.GetLine(this.modelID, expressID) as IfcLine;

    const globalId = entity.GlobalId.value;
    const name = entity.Name?.value ?? null;

    const data: SpatialNode = {
      expressId: expressID,
      globalId,
      ifcClass: type,
      name,
      properties: {},
      quantities: {},
      children: [],
    };

    if (includeProperties || includeQuantities) {
      const pSets = (await this.ifcApi.properties.getPropertySets(
        this.modelID,
        expressID,
        true,
      )) as Array<IfcPropertySet>;
      for (const pSet of pSets) {
        const pSetName = pSet.Name.value;

        if (includeProperties && pSet.HasProperties) {
          const props = pSet.HasProperties ?? [];
          for (const prop of props) {
            if (prop.NominalValue) {
              const propName = prop.Name.value;
              const propValue = prop.NominalValue.value;
              data.properties[pSetName] = data.properties[pSetName] ?? {};
              data.properties[pSetName][propName] = propValue;
            }
          }
        }

        if (includeQuantities && pSet.Quantities) {
          const quants = pSet.Quantities ?? [];
          for (const quant of quants) {
            const quantName = quant.Name.value;
            const quantValue =
              quant.LengthValue?.value ??
              quant.AreaValue?.value ??
              quant.VolumeValue?.value ??
              quant.CountValue?.value;

            if (quantValue !== undefined) {
              data.quantities[pSetName] = data.quantities[pSetName] ?? {};
              data.quantities[pSetName][quantName] = quantValue;
            }
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

  getSpatialTree(): Array<SpatialNode> {
    if (!this.project) {
      throw new Error("Project not found");
    }
    return [this.project];
  }
}

export { Tree };

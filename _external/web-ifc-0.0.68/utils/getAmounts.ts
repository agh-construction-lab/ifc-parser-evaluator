import type { IfcAPI } from "web-ifc";

const getAmounts = (modelID: number, ifcApi: IfcAPI) => {
  const allModelTypes = ifcApi.GetAllTypesOfModel(modelID);

  const amountsByType = allModelTypes
    .sort((a, b) => (a.typeName > b.typeName ? 1 : -1))
    .reduce(
      (acc, type) => {
        const { typeID, typeName } = type;
        const count = ifcApi.GetLineIDsWithType(modelID, typeID).size();
        acc[typeName] = count;

        return acc;
      },
      {} as Record<string, number>,
    );

  const amountTotal = Object.values(amountsByType).reduce((a, b) => a + b, 0);

  return {
    amountTotal,
    amountsByType,
  };
};

export { getAmounts };

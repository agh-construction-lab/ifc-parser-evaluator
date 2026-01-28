import { PROPS_ROUND_TO, PROPS_SKIP } from "./constants.ts";

export type Differences = Record<
  string,
  {
    reason: string;
    ifcJsValue: unknown;
    ifcOpenShellValue: unknown;
  }
>;

export const getAmountsDifferences = (
  objectA: Record<string, number>,
  ObjectB: Record<string, number>,
) => {
  const differences = {} as Differences;

  const upperCaseObjectA = Object.keys(objectA).reduce(
    (acc, key) => {
      acc[key.toUpperCase()] = objectA[key];
      return acc;
    },
    {} as Record<string, number>,
  );

  const upperCaseObjectB = Object.keys(ObjectB).reduce(
    (acc, key) => {
      acc[key.toUpperCase()] = ObjectB[key];
      return acc;
    },
    {} as Record<string, number>,
  );

  const keysA = Object.keys(upperCaseObjectA);

  for (const key of keysA) {
    const valueA = upperCaseObjectA[key];
    const valueB = upperCaseObjectB[key];

    if (valueA !== valueB) {
      differences[key] = {
        reason: "Amounts differ",
        ifcJsValue: valueA,
        ifcOpenShellValue: valueB,
      };
    }
  }

  return differences;
};

export const getObjectDiff = (objectA: any, objectB: any) => {
  const differences = {} as Differences;

  if (objectA === undefined && objectB === undefined) {
    return {};
  }

  const upperCaseObjectA = Object.keys(objectA).reduce(
    (acc, key) => {
      acc[key.toUpperCase()] = objectA[key];
      return acc;
    },
    {} as Record<string, any>,
  );

  const upperCaseObjectB = Object.keys(objectB).reduce(
    (acc, key) => {
      acc[key.toUpperCase()] = objectB[key];
      return acc;
    },
    {} as Record<string, any>,
  );

  const keysA = Object.keys(upperCaseObjectA);

  for (const key of keysA) {
    const valueA = upperCaseObjectA[key];
    const valueB = upperCaseObjectB[key];

    if (PROPS_SKIP.includes(key)) {
      continue;
    }

    if (typeof valueA !== typeof valueB) {
      differences[key] = {
        reason: "Types differ",
        ifcJsValue: valueA,
        ifcOpenShellValue: valueB,
      };
    } else if (typeof valueA === "number") {
      if (valueA.toFixed(PROPS_ROUND_TO) !== valueB.toFixed(PROPS_ROUND_TO)) {
        differences[key] = {
          reason: "Numbers differ",
          ifcJsValue: valueA,
          ifcOpenShellValue: valueB,
        };
      }
    } else {
      if (valueA !== valueB) {
        differences[key] = {
          reason: "Values differ",
          ifcJsValue: valueA,
          ifcOpenShellValue: valueB,
        };
      }
    }
  }

  return differences;
};

export const getPropertiesDifferences = (setA: any, setB: any) => {
  if (setA === undefined && setB === undefined) {
    return {};
  }

  const keysA = Object.keys(setA);
  const keysB = Object.keys(setB);

  const differences = {} as Differences;

  for (const key of keysA) {
    const valueA = setA[key] ?? {};
    const valueB = setB[key] ?? {};

    const valueDifferences = getObjectDiff(valueA, valueB);

    if (Object.keys(valueDifferences).length > 0) {
      differences[key] = {
        reason: "Values differ",
        ifcJsValue: valueA,
        ifcOpenShellValue: valueB,
      };
    }
  }

  for (const key of keysB) {
    const valueA = setA[key] ?? {};
    const valueB = setB[key] ?? {};

    const valueDifferences = getObjectDiff(valueA, valueB);

    if (Object.keys(valueDifferences).length > 0) {
      if (differences[key] !== undefined) {
        differences[key] = {
          reason: "Values differ",
          ifcJsValue: valueA,
          ifcOpenShellValue: valueB,
        };
      }
    }
  }

  return differences;
};

export const getTreeDifferences = (
  nodeA: any,
  nodeB: any,
  parentPath: string = "",
) => {
  let differences = {} as Differences;

  const upperCaseTreeA = Object.keys(nodeA).reduce(
    (acc, key) => {
      acc[key.toUpperCase()] = nodeA[key];
      return acc;
    },
    {} as Record<string, any>,
  );

  const upperCaseTreeB = Object.keys(nodeB).reduce(
    (acc, key) => {
      acc[key.toUpperCase()] = nodeB[key];
      return acc;
    },
    {} as Record<string, any>,
  );

  const keysA = Object.keys(upperCaseTreeA);

  for (const key of keysA) {
    const entitiesA = upperCaseTreeA[key];
    const entitiesB = upperCaseTreeB[key];

    for (const entityA of entitiesA) {
      const indexA = entitiesA.indexOf(entityA);
      const entityB = entitiesB.find(
        (entity: any) => entity.expressID === entityA.expressID,
      );

      if (entityB === undefined) {
        console.log("NOT FOUND");
      } else {
        // We are comparing by expressID
        // const isExpressIdDifferent = entityA.expressID !== entityA.expressID;
        const isTypeDifferent =
          entityA.type.toUpperCase() !== entityB.type.toUpperCase();
        const isNameDifferent = entityA.name !== entityB.name;
        const isGlobalIdDifferent = entityA.globalId !== entityB.globalId;

        const propertiesDifferences = getPropertiesDifferences(
          entityA.propertySets,
          entityB.propertySets,
        );
        const arePropertiesDifferent =
          Object.keys(propertiesDifferences).length > 0;

        const quantitiesDifferences = getPropertiesDifferences(
          entityA.quantitySets,
          entityB.quantitySets,
        );
        const areQuantitiesDifferent =
          Object.keys(quantitiesDifferences).length > 0;

        const differenceField = isTypeDifferent
          ? "type"
          : isNameDifferent
            ? "name"
            : isGlobalIdDifferent
              ? "globalId"
              : arePropertiesDifferent
                ? "properties"
                : areQuantitiesDifferent
                  ? "quantities"
                  : undefined;

        const areDifferent = differenceField !== undefined;

        const entityPath = `${parentPath}[${key}][${indexA}]`;
        const { children: childrenA, ...restA } = entityA;
        const { children: childrenB, ...restB } = entityB;

        if (areDifferent) {
          const differencePath = `${entityPath}.${differenceField}`;
          differences[differencePath] = {
            reason: "Values differ",
            ifcJsValue: restA,
            ifcOpenShellValue: restB,
          };
        }

        differences = {
          ...differences,
          ...getTreeDifferences(childrenA, childrenB, `${entityPath}.children`),
        };
      }
    }
  }

  return differences;
};

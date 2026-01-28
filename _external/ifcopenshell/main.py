import json
import os
import sys
import ifcopenshell

from entities.tree import Tree
from utils.geometry import get_geometry_data

ifc_files_paths =  sys.argv[1].split(",")

print()

for path in ifc_files_paths:
  print("Processing", path)
    
  # loading
  ifc_file = ifcopenshell.open(path)
  # ###

  # All types
  amount_by_type = {}
  types = sorted(ifc_file.wrapped_data.types())

  for t in types:
    elements_of_type = ifc_file.wrapped_data.by_type_excl_subtypes(t)
    amount_by_type[t] = len(elements_of_type)

  total_amount = sum(amount_by_type.values())

  print("Amount of all entities: ", total_amount)

  for t in amount_by_type:
    print("Amount of", t, ":", amount_by_type[t])
  # ###

  print("")

  # IfcProduct
  products = ifc_file.by_type("IfcProduct")
  print("Amount of IfcProduct entities: ", len(products))

  skip_types = ["IfcSpace", "IfcOpeningElement", "IfcOpeningStandardCase"]
  products_without_skip_types = []
  for i in range(len(products)):
    entity = products[i]
    type = entity.is_a()

    if not type in skip_types:
      products_without_skip_types.append(id)
    
  print("Amount of IfcProduct entities without [IfcSpace, IfcOpeningElement, IfcOpeningStandardCase]: ", len(products_without_skip_types))
  # ###

  print("")

  print("schema: ", ifc_file.schema)

  # IfcBuildingElement
  if ifc_file.schema == "IFC4X3":
    elements = ifc_file.by_type("IfcBuiltElement")
  else:
    elements = ifc_file.by_type("IfcBuildingElement")
  
  print("Amount of IfcBuildingElement entities: ", len(elements))
  # ###

  print("")

  # Tree
  ifc_tree = Tree(ifc_file)
  tree_data = ifc_tree.get_grouped_by_type()

  # ###

  # Geometry
  geometry_data = get_geometry_data(ifc_file)

  output_directory = os.path.join("_output-data", "ifcopenshell")
  output_file_path = path.replace("_input-data", output_directory).replace(".ifc", ".json")
  output_file_name = output_file_path.split("/").pop() or ""
  output_directory_path = output_file_path.replace(output_file_name, "")

  os.makedirs(output_directory_path, exist_ok=True)

  result = {
      "amountTotal": total_amount,
      "amountsByType": amount_by_type,
      "treeData": tree_data,
      "geometryData": geometry_data
  }

  with open(output_file_path, "w") as json_file:
    json.dump(result, json_file, indent=4)

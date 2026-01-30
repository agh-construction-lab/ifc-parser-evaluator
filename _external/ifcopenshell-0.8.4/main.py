import argparse
import json
import os
import time
from datetime import datetime, timezone
import ifcopenshell

from entities.tree import Tree
from utils.geometry import get_geometry_data

PARSER_NAME = "ifcopenshell"
PARSER_VERSION = "0.8.4"

parser = argparse.ArgumentParser()
parser.add_argument("--ifcFiles", type=str, required=True)
parser.add_argument("--outputDir", type=str, default="_output-data/ifcopenshell")
args = parser.parse_args()

ifc_files_paths = json.loads(args.ifcFiles)
output_directory = args.outputDir

LOG_PREFIX = f"[{PARSER_NAME}]"

def count_nodes(nodes):
    count = len(nodes)
    for node in nodes:
        count += count_nodes(node.get("children", []))
    return count

for path in ifc_files_paths:
  start_time = time.time()
  source_file = os.path.basename(path)
  
  print("")
  print(LOG_PREFIX, "Processing:", source_file)
  print("")
    
  # loading
  ifc_file = ifcopenshell.open(path)
  # ###

  # Schema
  print(LOG_PREFIX, "Schema:", ifc_file.schema)

  # All types
  amount_by_type = {}
  types = sorted(ifc_file.wrapped_data.types())

  for t in types:
    elements_of_type = ifc_file.wrapped_data.by_type_excl_subtypes(t)
    amount_by_type[t] = len(elements_of_type)

  total_amount = sum(amount_by_type.values())
  print(LOG_PREFIX, "Total entities:", total_amount)
  # ###

  print("")

  # Tree
  print(LOG_PREFIX, "Building spatial tree...")
  ifc_tree = Tree(ifc_file)
  spatial_tree = ifc_tree.get_spatial_tree()
  print(LOG_PREFIX, "Spatial tree nodes:", count_nodes(spatial_tree))
  # ###

  print("")

  # Geometry
  print(LOG_PREFIX, "Extracting geometries...")
  geometries = get_geometry_data(ifc_file)
  print(LOG_PREFIX, "Geometries extracted:", len(geometries))

  # Calculate processing time
  processing_time_ms = int((time.time() - start_time) * 1000)

  # saving results
  base_name = os.path.basename(path).replace(".ifc", "")
  output_subdir = os.path.join(output_directory, base_name)
  output_file_path = os.path.join(output_subdir, f"{base_name}.json")
  os.makedirs(output_subdir, exist_ok=True)

  result = {
      "metadata": {
          "parserName": PARSER_NAME,
          "parserVersion": PARSER_VERSION,
          "sourceFile": source_file,
          "schemaVersion": ifc_file.schema,
          "processedAt": datetime.now(timezone.utc).isoformat(),
          "processingTimeMs": processing_time_ms,
      },
      "summary": {
          "totalEntityCount": total_amount,
          "entityCountByType": amount_by_type,
      },
      "spatialTree": spatial_tree,
      "geometries": geometries,
  }

  with open(output_file_path, "w") as json_file:
    json.dump(result, json_file, indent=4)

  print("")
  print(LOG_PREFIX, "Completed in", processing_time_ms, "ms")
  print(LOG_PREFIX, "Output:", output_file_path)
  print("")

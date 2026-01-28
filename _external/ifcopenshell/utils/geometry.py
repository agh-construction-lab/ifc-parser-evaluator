import ifcopenshell
import ifcopenshell.util.unit
from ifcopenshell import geom

import multiprocessing

settings = ifcopenshell.geom.settings()
settings.set(settings.WELD_VERTICES, False)  # false = generate normals

# MESHER_LINEAR_DEFLECTION = 0.001
# MESHER_ANGULAR_DEFLECTION = 0.5
# REORIENT_SHELLS = False
# LENGTH_UNIT = 1.0
# ANGLE_UNIT = 1.0
# PRECISION = 1e-05
# DIMENSIONALITY = 1
# LAYERSET_FIRST = False
# DISABLE_BOOLEAN_RESULT = False
# NO_WIRE_INTERSECTION_CHECK = False
# NO_WIRE_INTERSECTION_TOLERANCE = 0.0
# PRECISION_FACTOR = 1.0
# DEBUG = False
# BOOLEAN_ATTEMPT_2D = True
# SURFACE_COLOUR = False
# WELD_VERTICES = False
# USE_WORLD_COORDS = False
# UNIFY_SHAPES = False
# USE_MATERIAL_NAMES = False
# CONVERT_BACK_UNITS = False
# CONTEXT_IDS = -
# CONTEXT_TYPES = -
# CONTEXT_IDENTIFIERS = -
# ITERATOR_OUTPUT = 0
# DISABLE_OPENING_SUBTRACTIONS = False
# APPLY_DEFAULT_MATERIALS = True
# NO_NORMALS = False
# GENERATE_UVS = False
# ENABLE_LAYERSET_SLICING = False
# ELEMENT_HIERARCHY = False
# VALIDATE = False
# EDGE_ARROWS = False
# BUILDING_LOCAL_PLACEMENT = False
# SITE_LOCAL_PLACEMENT = False
# FORCE_SPACE_TRANSPARENCY = -
# CIRCLE_SEGMENTS = 16
# KEEP_BOUNDING_BOXES = False
# FUNCTION_STEP_TYPE = 0
# FUNCTION_STEP_PARAM = 0.5
# NO_PARALLEL_MAPPING = False
# MODEL_OFFSET = ()
# MODEL_ROTATION = ()
# TRIANGULATION_TYPE = 0,
# USE_PYTHON_OPENCASCADE = False

# settings.set(settings.USE_PYTHON_OPENCASCADE, True)
settings.set(settings.CONVERT_BACK_UNITS, True)


def get_geometry_data(ifc_file: ifcopenshell.file):
    geometry_data = {}
    iterator = ifcopenshell.geom.iterator(settings, ifc_file, multiprocessing.cpu_count())
    
    unit_scale = ifcopenshell.util.unit.calculate_unit_scale(ifc_file)

    if iterator.initialize():
        while True:
            shape = iterator.get()
            # matrix = shape.transformation.matrix
            matrix = list(shape.transformation.matrix) # tuple can't be modified
            faces = shape.geometry.faces
            edges = shape.geometry.edges
            # verts = shape.geometry.verts
            verts = list(shape.geometry.verts) # tuple can't be modified
            # normals = shape.geometry.normals
            normals = list(shape.geometry.normals) # tuple can't be modified
            materials = shape.geometry.materials
            material_ids = shape.geometry.material_ids

            id = shape.id
            entity = ifc_file.by_id(id)
            type_name = entity.is_a()
            global_id = entity.GlobalId
            
            if type_name in ("IfcOpeningElement", "IfcSpace"):
                if not iterator.next():
                    break
                continue

            if unit_scale != 1.0:
                for i in range(0, len(verts), 3):
                    verts[i]   *= unit_scale  # x
                    verts[i+1] *= unit_scale  # y
                    verts[i+2] *= unit_scale  # z

                # matrix[12] *= unit_scale
                # matrix[13] *= unit_scale
                # matrix[14] *= unit_scale
                
            # Documentation needed
            material_ids_mapping = {}
            for idx, material_id in enumerate(material_ids):
                if material_id not in material_ids_mapping:
                    material_ids_mapping[material_id] = []
                material_ids_mapping[material_id].append(idx)

            offset = 0;
            if -1 in material_ids_mapping:
                # Add default material to materials (materials.unshift)
                # Emulating three.js material
                materials = materials + (0,)
                offset = 1
                
            for material_index in range(len(materials)):
                material = materials[material_index]
                map_index = material_index - offset
                mapping_item = material_ids_mapping[map_index]
                
                indexes = []
                if len(faces) == 0:
                  continue

                for i in mapping_item:
                    indexes.extend([faces[3 * i + 0], faces[3 * i + 1], faces[3 * i + 2]])

            # print("Positions", ", ".join(map(str,verts)))
            # print("Normals", ", ".join(map(str,normals)))
            # print("Indexes", ", ".join(map(str,indexes)))

            # def convert_indexed_to_unindexed(vertices_flat, indices):
            #     unindexed = []
            #     for i in indices:
            #         unindexed.extend(vertices_flat[3*i : 3*i+3])
            #     return unindexed
            # unindexed = list(map(float,convert_indexed_to_unindexed(verts, indexes)));
            # print(unindexed, len(unindexed))

            geometry_data[global_id] = {
                "ifcClass": type_name,
                "positions": verts,
                "normals": normals,
                "indexes": indexes,
                "matrix": matrix,
            }

            if not iterator.next():
                break

    print("")

    print("Entites geometries: " + str(len(geometry_data)))
    # print("Entites geometries:")
    # for global_id in geometry_data:
    #     data = geometry_data[global_id]

    #     print(f"{global_id}:" + " { " + f"positions: {len(data['positions'])}, " + f"normals: {len(data['normals'])}, " + f"indexes: {len(data['indexes'])}" + " }")

    print("");
    return geometry_data

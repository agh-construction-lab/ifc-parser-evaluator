import ifcopenshell
import json

LEVEL_INDICATOR = "- "
SET_INDICATOR = "| "
VALUE_INDICATOR = "> "

class PropertySet:
    name = None
    properties = []

    def __init__(self, property_set_entity):
        self.name = property_set_entity.Name
        self.properties = []

        for prop in property_set_entity.HasProperties:
            if prop.is_a("IfcPropertySingleValue"):
                self.properties.append(
                    {"name": prop.Name, "value": "--" if prop.NominalValue is None else prop.NominalValue.wrappedValue}
                )

    def __str__(self):
        return f'PropertySet "{self.name}":'


class QuantitySet:
    name = None
    quantities = []

    def __init__(self, quantity_set_entity):
        self.name = quantity_set_entity.Name
        self.quantities = []

        for quantity in quantity_set_entity.Quantities:
            if quantity.is_a("IfcQuantityLength"):
                self.quantities.append(
                    {"name": quantity.Name, "value": quantity.LengthValue}
                )
            elif quantity.is_a("IfcQuantityArea"):
                self.quantities.append(
                    {"name": quantity.Name, "value": quantity.AreaValue}
                )
            elif quantity.is_a("IfcQuantityVolume"):
                self.quantities.append(
                    {"name": quantity.Name, "value": quantity.VolumeValue}
                )
            elif quantity.is_a("IfcQuantityCount"):
                self.quantities.append(
                    {"name": quantity.Name, "value": quantity.CountValue}
                )
            else:
                self.quantities.append({"name": quantity.Name, "value": None})

    def __str__(self):
        return f'QuantitySet "{self.name}":'


class Node:
    id = None
    name = None
    type = None
    global_id = None
    children = []
    property_sets = []
    quantity_sets = []

    def __init__(self, id, name, type, global_id):
        self.id = id
        self.name = name
        self.type = type
        self.global_id = global_id
        self.children = []
        self.property_sets = []
        self.quantity_sets = []

    def __str__(self):
        return f'#{self.id} = {self.type} "{self.name}" ({self.global_id})'


class Tree:
    ifc_file = None
    root = None
    project = None

    def __init__(self, ifc_file: ifcopenshell.file):
        self.ifc_file = ifc_file

        projects = ifc_file.by_type("IfcProject")

        # TODO: Unify with JS version
        self.root = Node(-1, "root", "root", "root")
        for project in projects:
            node = self.create_tree(project)
            self.root.children.append(node)
            self.project = node

    def create_tree(self, entity: ifcopenshell.entity_instance, level=0):
        id = entity.id()
        name = entity.Name
        type = entity.is_a()
        global_id = entity.GlobalId

        node = Node(id, name, type, global_id)

        # follow Property Relation
        for definition in entity.IsDefinedBy:
            # https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD1/HTML/schema/ifckernel/lexical/ifcreldefinesbyproperties.htm
            if definition.is_a("IfcRelDefinesByProperties"):
                related_data = definition.RelatingPropertyDefinition
                # the individual properties/quantities
                # https://standards.buildingsmart.org/IFC/DEV/IFC4_2/FINAL/HTML/schema/ifckernel/lexical/ifcpropertyset.htm
                if related_data.is_a("IfcPropertySet"):
                    property_set = PropertySet(related_data)
                    node.property_sets.append(property_set)
                # https://standards.buildingsmart.org/IFC/DEV/IFC4_2/FINAL/HTML/schema/ifckernel/lexical/ifcpropertyset.htm
                elif related_data.is_a("IfcElementQuantity"):
                    quantity_set = QuantitySet(related_data)
                    node.quantity_sets.append(quantity_set)
            # https://standards.buildingsmart.org/IFC/DEV/IFC4_2/FINAL/HTML/schema/ifckernel/lexical/ifcreldefinesbytype.htm
            if definition.is_a("IfcRelDefinesByType"):
                # raise Exception("IfcRelDefinesByType not implemented - should I worry?")
                print("IfcRelDefinesByType not implemented - should I worry?")
                print(definition.RelatingType.Name + " " + definition.RelatingType.is_a())

        # follow Spatial relation
        # https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD1/HTML/schema/ifcproductextension/lexical/ifcspatialstructureelement.htm
        # IfcSite | IfcBuilding | IfcBuildingStorey | IfcSpace
        if entity.is_a("IfcSpatialStructureElement"):
            for relation in entity.ContainsElements:
                relatedElements = relation.RelatedElements
                for child in relatedElements:
                    childNode = self.create_tree(child, level + 1)
                    node.children.append(childNode)

        # follow Aggregation Relation
        # https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD1/HTML/
        # IfcContext | IfcObject | IfcTypeObject
        if entity.is_a("IfcObjectDefinition"):
            for relation in entity.IsDecomposedBy:
                relatedObjects = relation.RelatedObjects
                for child in relatedObjects:
                    childNode = self.create_tree(child, level + 1)
                    node.children.append(childNode)

        return node

    def print_tree(self, print_properties=True, print_quantities=True):
        self.print_node(self.root, print_properties, print_quantities, 0)

    def print_node(
        self, node: Node, print_properties=True, print_quantities=True, level=0
    ):
        if node.id < 0:
            for child in node.children:
                self.print_node(child, print_properties, print_quantities, level)
            return

        print(f"{LEVEL_INDICATOR * level}{node}")

        if print_properties is True:
            for property_set in node.property_sets:
                print(f"{LEVEL_INDICATOR * (level+ 1)}{SET_INDICATOR}{property_set}")
                for property in property_set.properties:
                    property_str = f"{property['name']} = {property['value']}"
                    print(
                        f"{LEVEL_INDICATOR * (level+ 2)}{VALUE_INDICATOR}{property_str}"
                    )

        if print_quantities is True:
            for quantity_set in node.quantity_sets:
                print(f"{LEVEL_INDICATOR * (level+ 1)}{SET_INDICATOR}{quantity_set}")
                for quantity in quantity_set.quantities:
                    quantity_str = f"{quantity['name']} = {quantity['value']}"
                    print(
                        f"{LEVEL_INDICATOR * (level+ 2)}{VALUE_INDICATOR}{quantity_str}"
                    )

        for child in node.children:
            self.print_node(child, print_properties, print_quantities, level + 1)

    def print_grouped_tree(self, print_properties=True, print_quantities=True):
        self.print_grouped_node(self.root, print_properties, print_quantities, 0)

    def print_grouped_node(
        self, node: Node, print_properties=True, print_quantities=True, level=0
    ):
        if print_properties is True:
            for property_set in node.property_sets:
                print(f"{LEVEL_INDICATOR * (level+ 1)}{SET_INDICATOR}{property_set}")
                for property in property_set.properties:
                    property_str = f"{property['name']} = {property['value']}"
                    print(
                        f"{LEVEL_INDICATOR * (level+ 2)}{VALUE_INDICATOR}{property_str}"
                    )

        if print_quantities is True:
            for quantity_set in node.quantity_sets:
                print(f"{LEVEL_INDICATOR * (level+ 1)}{SET_INDICATOR}{quantity_set}")
                for quantity in quantity_set.quantities:
                    quantity_str = f"{quantity['name']} = {quantity['value']}"
                    print(
                        f"{LEVEL_INDICATOR * (level+ 2)}{VALUE_INDICATOR}{quantity_str}"
                    )

        grouped_children = {}
        for child in node.children:
            if child.type not in grouped_children:
                grouped_children[child.type] = []
            grouped_children[child.type].append(child)

        for type, children in grouped_children.items():
            print(f"{LEVEL_INDICATOR * (level + 1)}{type}")
            for child in children:
                print(f"{LEVEL_INDICATOR * (level + 1)}{child}")
                self.print_grouped_node(
                    child, print_properties, print_quantities, level + 2
                )

    def get_grouped_by_type(self):
        return {
            "IfcProject": [self.get_node_data_with_grouped_children(self.project)],
        }
    
    def get_spatial_tree(self):
        """Returns spatial tree in standardized format (v1.0.0)"""
        return [self._node_to_spatial_format(self.project)]
    
    def _node_to_spatial_format(self, node):
        """Convert node to standardized spatial format"""
        properties = {}
        quantities = {}

        for property_set in node.property_sets:
            properties[property_set.name] = {}
            for prop in property_set.properties:
                properties[property_set.name][prop["name"]] = prop["value"]

        for quantity_set in node.quantity_sets:
            quantities[quantity_set.name] = {}
            for quant in quantity_set.quantities:
                quantities[quantity_set.name][quant["name"]] = quant["value"]

        return {
            "expressId": node.id,
            "globalId": node.global_id,
            "ifcClass": node.type,
            "name": node.name,
            "properties": properties,
            "quantities": quantities,
            "children": [self._node_to_spatial_format(child) for child in node.children],
        }
    
    def get_node_data_with_grouped_children(self, node):
        grouped_children = {}

        for child in node.children:
            if child.type not in grouped_children:
                grouped_children[child.type] = []
            grouped_children[child.type].append(self.get_node_data_with_grouped_children(child))

    

        data = {
            "expressID": node.id,
            "type": node.type,
            "name": node.name,
            "globalId": node.global_id,
            "children": grouped_children,
            "propertySets": {},
            "quantitySets": {},
        }

        if len(node.property_sets) > 0:
            for property_set in node.property_sets:
                data["propertySets"][property_set.name] = {}
                for property in property_set.properties:
                    data["propertySets"][property_set.name][property["name"]] = property["value"]

        if len(node.quantity_sets) > 0:
            for quantity_set in node.quantity_sets:
                data["quantitySets"][quantity_set.name] = {}
                for quantity in quantity_set.quantities:
                    data["quantitySets"][quantity_set.name][quantity["name"]] = quantity["value"]

        return data
    

    # getNodeDataWithGroupedChildren(node: NodeData) {
    #     const { children, ...data } = node;

    #     const groupedChildren: Record<string, Array<any>> = {};

    #     for (const child of children) {
    #         if (!groupedChildren[child.type]) {
    #             groupedChildren[child.type] = [];
    #         }

    #         groupedChildren[child.type].push(this.getNodeDataWithGroupedChildren(child));
    #     }

    #     return {
    #         ...data,
    #         children: groupedChildren,
    #     }
    # }
    
    def get_as_json(self):
        return json.dumps(self.to_json(self.root), indent=4)

    def to_json(self, node):
        if node.id < 0:
            return [self.to_json(child) for child in node.children]

        return {
            "id": node.id,
            "name": node.name,
            "type": node.type,
            "global_id": node.global_id,
            "property_sets": [
                property_set.__dict__ for property_set in node.property_sets
            ],
            "quantity_sets": [
                quantity_set.__dict__ for quantity_set in node.quantity_sets
            ],
            "children": [self.to_json(child) for child in node.children],
        }

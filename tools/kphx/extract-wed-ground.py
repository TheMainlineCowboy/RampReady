#!/usr/bin/env python3
import argparse, hashlib, json, xml.etree.ElementTree as ET
from pathlib import Path

GROUND_CLASSES = (
    "WED_PolygonPlacement",
    "WED_LinePlacement",
    "WED_DrapedOrthophoto",
    "WED_Taxiway",
    "WED_Runway",
)

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def attrs(element):
    return dict(element.attrib) if element is not None else None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("wed_xml")
    parser.add_argument("output_json")
    args = parser.parse_args()

    source = Path(args.wed_xml)
    root = ET.parse(source).getroot()
    objects = root.findall(".//object")
    by_id = {int(obj.attrib["id"]): obj for obj in objects}

    def child_ids(obj):
        children = obj.find("children")
        return [int(child.attrib["id"]) for child in children.findall("child")] if children is not None else []

    def hierarchy(obj):
        return attrs(obj.find("hierarchy")) or {}

    def point_record(obj):
        point = obj.find("point")
        if point is None:
            return None
        record = {
            "wedObjectId": int(obj.attrib["id"]),
            "class": obj.attrib["class"],
            "point": attrs(point),
        }
        texture = obj.find("texture_node")
        if texture is not None:
            record["textureNode"] = attrs(texture)
        markings = obj.find("markings")
        if markings is not None:
            record["markings"] = attrs(markings)
        return record

    def chain_record(object_id):
        obj = by_id[object_id]
        record = {
            "wedObjectId": int(obj.attrib["id"]),
            "class": obj.attrib["class"],
            "name": hierarchy(obj).get("name", ""),
        }
        direct = []
        nested = []
        for child_id in child_ids(obj):
            child = by_id[child_id]
            point = point_record(child)
            if point is not None:
                direct.append(point)
            else:
                nested.append(chain_record(child_id))
        if direct:
            record["nodes"] = direct
        if nested:
            record["children"] = nested
        return record

    definition_tags = {
        "WED_PolygonPlacement": "polygon_placement",
        "WED_LinePlacement": "line_placement",
        "WED_DrapedOrthophoto": "draped_orthophoto",
        "WED_Taxiway": "taxiway",
        "WED_Runway": "runway",
    }

    def placement_record(obj):
        klass = obj.attrib["class"]
        record = {
            "wedObjectId": int(obj.attrib["id"]),
            "class": klass,
            "parentId": int(obj.attrib.get("parent_id", "0")),
            "hierarchy": hierarchy(obj),
            "definition": attrs(obj.find(definition_tags[klass])) or {},
            "geometry": [chain_record(child_id) for child_id in child_ids(obj)],
        }
        if klass == "WED_Runway":
            line = obj.find("line")
            if line is not None:
                record["line"] = attrs(line)
        return record

    grouped = {
        klass: [placement_record(obj) for obj in objects if obj.attrib["class"] == klass]
        for klass in GROUND_CLASSES
    }
    payload = {
        "schemaVersion": 1,
        "authority": "KPHX-1.75.1-earth.wed.xml-ground",
        "source": {"bytes": source.stat().st_size, "sha256": sha256(source)},
        "counts": {klass: len(items) for klass, items in grouped.items()},
        "placements": grouped,
    }
    output = Path(args.output_json)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(output),
        "bytes": output.stat().st_size,
        "sha256": sha256(output),
        "counts": payload["counts"],
    }, indent=2))

if __name__ == "__main__":
    main()

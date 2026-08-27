#!/usr/bin/env python3
import argparse
import hashlib
import json
import xml.etree.ElementTree as ET
from pathlib import Path

JETWAY_RESOURCE_TOKEN = "/Jetways/"


def source_identity(path: Path):
    data = path.read_bytes()
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def extract(source: Path):
    objects = {}
    for _event, element in ET.iterparse(source, events=("end",)):
        if element.tag != "object":
            continue
        cls = element.attrib.get("class")
        if cls not in {"WED_FacadePlacement", "WED_FacadeRing", "WED_FacadeNode"}:
            element.clear()
            continue
        record = {
            "class": cls,
            "id": int(element.attrib["id"]),
            "parentId": int(element.attrib.get("parent_id", "0")),
        }
        children = element.find("children")
        record["children"] = [int(child.attrib["id"]) for child in children.findall("child")] if children is not None else []
        hierarchy = element.find("hierarchy")
        if hierarchy is not None:
            record["name"] = hierarchy.attrib.get("name", "")
        placement = element.find("facade_placement")
        if placement is not None:
            record["placement"] = dict(placement.attrib)
        point = element.find("point")
        if point is not None:
            record["point"] = dict(point.attrib)
        facade_node = element.find("facade_node")
        if facade_node is not None:
            record["facadeNode"] = dict(facade_node.attrib)
        objects[record["id"]] = record
        element.clear()

    placements = []
    for object_id in sorted(objects):
        obj = objects[object_id]
        if obj["class"] != "WED_FacadePlacement":
            continue
        placement = obj.get("placement", {})
        resource = placement.get("resource", "")
        if JETWAY_RESOURCE_TOKEN not in resource:
            continue

        rings = []
        for ring_id in obj["children"]:
            ring = objects.get(ring_id)
            if not ring or ring["class"] != "WED_FacadeRing":
                raise RuntimeError(f"jetway facade {object_id}: missing WED_FacadeRing child {ring_id}")
            nodes = []
            for node_id in ring["children"]:
                node = objects.get(node_id)
                if not node or node["class"] != "WED_FacadeNode":
                    raise RuntimeError(f"jetway facade {object_id}: missing WED_FacadeNode child {node_id}")
                point = node.get("point", {})
                required = (
                    "latitude", "longitude", "split",
                    "ctrl_latitude_lo", "ctrl_longitude_lo",
                    "ctrl_latitude_hi", "ctrl_longitude_hi",
                )
                missing = [key for key in required if key not in point]
                if missing:
                    raise RuntimeError(f"jetway node {node_id}: missing point attributes {missing}")
                nodes.append({
                    "wedObjectId": node_id,
                    "latitude": point["latitude"],
                    "longitude": point["longitude"],
                    "split": point["split"],
                    "ctrlLatitudeLo": point["ctrl_latitude_lo"],
                    "ctrlLongitudeLo": point["ctrl_longitude_lo"],
                    "ctrlLatitudeHi": point["ctrl_latitude_hi"],
                    "ctrlLongitudeHi": point["ctrl_longitude_hi"],
                    "wallType": node.get("facadeNode", {}).get("wall_type", ""),
                })
            rings.append({"wedObjectId": ring_id, "nodes": nodes})

        placements.append({
            "wedObjectId": object_id,
            "name": obj.get("name", ""),
            "resource": resource,
            "height": placement.get("height", ""),
            "pickWalls": placement.get("pick_walls", ""),
            "showLevel": placement.get("show_level", ""),
            "rings": rings,
        })

    if not placements:
        raise RuntimeError("no WED jetway facade placements found")
    return placements


def main():
    parser = argparse.ArgumentParser(description="Extract exact X-Plane WED jetway facade placements into deterministic JSON.")
    parser.add_argument("source")
    parser.add_argument("output")
    args = parser.parse_args()
    source = Path(args.source)
    output = Path(args.output)

    placements = extract(source)
    payload = {
        "schemaVersion": 1,
        "authority": "KPHX-1.75.1-earth.wed.xml",
        "source": source_identity(source),
        "jetwayFacadeCount": len(placements),
        "placements": placements,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Extracted {len(placements)} exact WED jetway facade placements to {output}")


if __name__ == "__main__":
    main()

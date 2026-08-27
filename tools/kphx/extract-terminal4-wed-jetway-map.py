#!/usr/bin/env python3
import argparse, hashlib, json, math, re, xml.etree.ElementTree as ET
from pathlib import Path

EARTH_RADIUS_METERS = 6378137.0
MAX_RAMP_TO_FACADE_METERS = 15.0

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def hierarchy_name(obj):
    h = obj.find("hierarchy")
    return h.attrib.get("name", "") if h is not None else ""

def child_ids(obj):
    children = obj.find("children")
    return [int(c.attrib["id"]) for c in children.findall("child")] if children is not None else []

def principal_axis_endpoints(points):
    cx = sum(x for x, z in points) / len(points)
    cz = sum(z for x, z in points) / len(points)
    cxx = sum((x-cx)**2 for x, z in points) / len(points)
    czz = sum((z-cz)**2 for x, z in points) / len(points)
    cxz = sum((x-cx)*(z-cz) for x, z in points) / len(points)
    theta = 0.5 * math.atan2(2.0 * cxz, cxx - czz)
    ax, az = math.cos(theta), math.sin(theta)
    projections = [(x-cx)*ax + (z-cz)*az for x, z in points]
    low, high = min(projections), max(projections)
    return (cx + ax*low, cz + az*low), (cx + ax*high, cz + az*high)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("wed_xml")
    parser.add_argument("output_json")
    args = parser.parse_args()
    source = Path(args.wed_xml)
    root = ET.parse(source).getroot()
    objects = root.findall(".//object")
    by_id = {int(obj.attrib["id"]): obj for obj in objects}

    ramps = []
    facades = []
    for obj in objects:
        klass = obj.attrib.get("class", "")
        if klass == "WED_RampPosition":
            point = obj.find("point")
            if point is not None and hierarchy_name(obj).startswith("T4 Gate "):
                ramps.append({
                    "wedObjectId": int(obj.attrib["id"]),
                    "name": hierarchy_name(obj),
                    "latitude": float(point.attrib["latitude"]),
                    "longitude": float(point.attrib["longitude"]),
                    "headingDegrees": float(point.attrib.get("heading", "0")),
                })
        elif klass == "WED_FacadePlacement":
            definition = obj.find("facade_placement")
            resource = definition.attrib.get("resource", "") if definition is not None else ""
            name = hierarchy_name(obj)
            if "jetway" not in (name + " " + resource).lower():
                continue
            nodes = []
            def walk(object_id):
                child = by_id[object_id]
                point = child.find("point")
                if point is not None:
                    nodes.append({
                        "wedObjectId": int(child.attrib["id"]),
                        "latitude": float(point.attrib["latitude"]),
                        "longitude": float(point.attrib["longitude"]),
                    })
                    return
                for nested in child_ids(child):
                    walk(nested)
            for child_id in child_ids(obj):
                walk(child_id)
            if nodes:
                facades.append({
                    "wedObjectId": int(obj.attrib["id"]),
                    "resource": resource,
                    "nodes": nodes,
                })

    a1 = next(ramp for ramp in ramps if ramp["name"] == "T4 Gate A1")
    lat0 = math.radians(a1["latitude"])
    def source_local(latitude, longitude):
        east = math.radians(longitude-a1["longitude"]) * EARTH_RADIUS_METERS * math.cos(lat0)
        north = math.radians(latitude-a1["latitude"]) * EARTH_RADIUS_METERS
        return east, -north
    def distance(a, b):
        ax, az = source_local(a["latitude"], a["longitude"])
        bx, bz = source_local(b["latitude"], b["longitude"])
        return math.hypot(ax-bx, az-bz)

    nearest = []
    for ramp in ramps:
        best = min((min(distance(ramp, node) for node in facade["nodes"]), facade) for facade in facades)
        if best[0] <= MAX_RAMP_TO_FACADE_METERS:
            nearest.append((ramp, best[0], best[1]))

    by_facade = {}
    for ramp, gap, facade in nearest:
        existing = by_facade.get(facade["wedObjectId"])
        if existing is None or gap < existing[1]:
            by_facade[facade["wedObjectId"]] = (ramp, gap, facade)

    placements = []
    for ramp, gap, facade in by_facade.values():
        points = [source_local(node["latitude"], node["longitude"]) for node in facade["nodes"]]
        low, high = principal_axis_endpoints(points)
        ramp_local = source_local(ramp["latitude"], ramp["longitude"])
        low_distance = math.hypot(low[0]-ramp_local[0], low[1]-ramp_local[1])
        high_distance = math.hypot(high[0]-ramp_local[0], high[1]-ramp_local[1])
        cab, rotunda = (low, high) if low_distance <= high_distance else (high, low)
        dx, dz = cab[0]-rotunda[0], cab[1]-rotunda[1]
        span = math.hypot(dx, dz)
        placements.append({
            "gate": ramp["name"].removeprefix("T4 Gate "),
            "rampWedObjectId": ramp["wedObjectId"],
            "facadeWedObjectId": facade["wedObjectId"],
            "facadeNodeCount": len(facade["nodes"]),
            "rampToFacadeMeters": round(gap, 6),
            "x": round(rotunda[0], 6),
            "z": round(rotunda[1], 6),
            "yawRadians": round(math.atan2(dx, dz), 9),
            "bridgeEnd": round(span, 6),
            "aircraftDoorDistance": round(span, 6),
            "aircraftContactClearanceMeters": 0,
            "skipGeneratedTerminalConnector": True,
            "sourceAxis": {
                "rotunda": [round(rotunda[0], 6), round(rotunda[1], 6)],
                "cab": [round(cab[0], 6), round(cab[1], 6)],
            },
        })
    def gate_key(item):
        match = re.match(r"([A-Z]+)(\d+)(.*)", item["gate"])
        return (match.group(1), int(match.group(2)), match.group(3)) if match else (item["gate"], 0, "")
    placements.sort(key=gate_key)

    payload = {
        "schemaVersion": 1,
        "authority": "KPHX-1.75.1-earth.wed.xml-terminal4-jetway-ramp-association-v1",
        "source": {"bytes": source.stat().st_size, "sha256": sha256(source)},
        "origin": {
            "gate": "A1",
            "latitude": a1["latitude"],
            "longitude": a1["longitude"],
            "headingDegrees": a1["headingDegrees"],
        },
        "association": {
            "maximumRampToFacadeMeters": MAX_RAMP_TO_FACADE_METERS,
            "rule": "nearest-facade-per-T4-ramp-then-closest-ramp-wins-shared-facade",
        },
        "jetwayCount": len(placements),
        "placements": placements,
    }
    output = Path(args.output_json)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(output),
        "bytes": output.stat().st_size,
        "sha256": sha256(output),
        "jetwayCount": len(placements),
        "a1FacadeWedObjectId": next(p["facadeWedObjectId"] for p in placements if p["gate"] == "A1"),
        "a1NodeCount": next(p["facadeNodeCount"] for p in placements if p["gate"] == "A1"),
    }, indent=2))
if __name__ == "__main__":
    main()

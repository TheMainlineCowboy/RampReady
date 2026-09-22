#!/usr/bin/env python3
import argparse
import hashlib
import json
import math
from pathlib import Path

EARTH_RADIUS_METERS = 6378137.0
A1_LATITUDE = 33.436530675
A1_LONGITUDE = -111.998921221
A1_BROWSER_Z = 6.2

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def parse_facade(path):
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    objects = []
    segments = {}
    walls = []
    ring = True
    textures = {}
    normal_metalness = False

    current_segment = None
    current_mesh = None
    flat_segment = False
    current_wall = None

    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        op = parts[0]

        if op == "RING":
            ring = parts[1] != "0"
        elif op == "TEXTURE":
            textures["albedo"] = " ".join(parts[1:])
        elif op == "TEXTURE_LIT":
            textures["lit"] = " ".join(parts[1:])
        elif op == "TEXTURE_NORMAL":
            maybe_scale = float(parts[1])
            textures["normalScale"] = maybe_scale
            textures["normal"] = " ".join(parts[2:])
        elif op == "NORMAL_METALNESS":
            normal_metalness = True
        elif op == "OBJ":
            objects.append(" ".join(parts[1:]))
        elif op == "SEGMENT":
            idx = int(parts[1])
            current_segment = {
                "index": idx,
                "meshes": [],
                "attachments": [],
            }
            segments[idx] = current_segment
            current_mesh = None
            flat_segment = True
            current_wall = None
        elif op == "SEGMENT_CURVED":
            current_segment = None
            current_mesh = None
            flat_segment = False
            current_wall = None
        elif op == "MESH" and flat_segment and current_segment is not None:
            current_mesh = {
                "group": int(parts[1]),
                "farLod": float(parts[2]),
                "cuts": int(parts[3]),
                "declaredVertexCount": int(parts[4]),
                "declaredIndexCount": int(parts[5]),
                "vertices": [],
                "indices": [],
            }
            current_segment["meshes"].append(current_mesh)
        elif op == "VERTEX" and flat_segment and current_mesh is not None:
            values = [float(v) for v in parts[1:9]]
            current_mesh["vertices"].append(values)
        elif op == "IDX" and flat_segment and current_mesh is not None:
            current_mesh["indices"].extend(int(v) for v in parts[1:])
        elif op in ("ATTACH_GRADED", "ATTACH_DRAPED") and flat_segment and current_segment is not None:
            current_segment["attachments"].append({
                "kind": op,
                "objectIndex": int(parts[1]),
                "x": float(parts[2]),
                "y": float(parts[3]),
                "z": float(parts[4]),
                "headingDegrees": float(parts[5]),
            })
        elif op == "WALL":
            current_segment = None
            current_mesh = None
            flat_segment = False
            current_wall = {
                "index": len(walls),
                "minimumWidth": float(parts[1]),
                "maximumWidth": float(parts[2]),
                "minimumHeading": float(parts[3]),
                "maximumHeading": float(parts[4]),
                "name": " ".join(parts[5:]) if len(parts) > 5 else f"Wall_{len(walls)}",
                "spellings": [],
            }
            walls.append(current_wall)
        elif op == "SPELLING" and current_wall is not None:
            current_wall["spellings"].append([int(v) for v in parts[1:]])

    for idx, segment in segments.items():
        z_values = [
            vertex[2]
            for mesh in segment["meshes"]
            for vertex in mesh["vertices"]
        ]
        if not z_values:
            raise RuntimeError(f"flat segment {idx} has no vertices")
        segment["nominalLengthMeters"] = max(z_values) - min(z_values)
        if not segment["nominalLengthMeters"] > 0:
            raise RuntimeError(f"flat segment {idx} has invalid nominal length")
        for mesh in segment["meshes"]:
            if len(mesh["vertices"]) != mesh["declaredVertexCount"]:
                raise RuntimeError(f"segment {idx} mesh vertex count mismatch")
            if len(mesh["indices"]) != mesh["declaredIndexCount"]:
                raise RuntimeError(f"segment {idx} mesh index count mismatch")

    if not objects or not segments or not walls:
        raise RuntimeError("facade source is incomplete")

    return {
        "ring": ring,
        "objects": objects,
        "segments": segments,
        "walls": walls,
        "textures": textures,
        "normalMetalness": normal_metalness,
    }

def browser_position(latitude, longitude):
    lat0 = math.radians(A1_LATITUDE)
    east = math.radians(longitude - A1_LONGITUDE) * EARTH_RADIUS_METERS * math.cos(lat0)
    north = math.radians(latitude - A1_LATITUDE) * EARTH_RADIUS_METERS
    return [-north, 0.0, -east + A1_BROWSER_Z]

def spelling_nominal_length(spelling, segments):
    return sum(segments[index]["nominalLengthMeters"] for index in spelling)

def choose_spelling(edge_length, wall, segments):
    candidates = []
    for source_order, spelling in enumerate(wall["spellings"]):
        nominal = spelling_nominal_length(spelling, segments)
        candidates.append((nominal, source_order, spelling))

    if not candidates:
        raise RuntimeError(f"wall {wall['index']} has no spellings")

    candidates_by_length = sorted(candidates, key=lambda item: (item[0], item[1]))
    smallest = candidates_by_length[0]
    longest = candidates_by_length[-1]

    if edge_length < smallest[0]:
        nominal, source_order, spelling = smallest
        repeat_count = 1
    elif edge_length <= longest[0]:
        nominal, source_order, spelling = min(
            candidates,
            key=lambda item: (abs(edge_length - item[0]), item[1]),
        )
        repeat_count = 1
    else:
        nominal, source_order, base_spelling = longest
        repeat_count = max(2, round(edge_length / nominal))
        spelling = base_spelling * repeat_count
        nominal *= repeat_count

    return {
        "sourceSpellingIndex": source_order,
        "repeatCount": repeat_count,
        "segments": spelling,
        "nominalLengthMeters": nominal,
        "stretchScale": edge_length / nominal,
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fac", required=True)
    parser.add_argument("--wed-json", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--wed-object-id", type=int, required=True)
    args = parser.parse_args()

    fac = parse_facade(args.fac)
    wed = json.loads(Path(args.wed_json).read_text(encoding="utf-8"))
    placement = next(
        (item for item in wed.get("placements", []) if int(item.get("wedObjectId", -1)) == args.wed_object_id),
        None,
    )
    if placement is None:
        raise RuntimeError(f"WED facade {args.wed_object_id} not found")
    if placement.get("resource") != "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac":
        raise RuntimeError(f"unexpected facade resource: {placement.get('resource')}")
    if str(placement.get("pickWalls")) != "1":
        raise RuntimeError("exact wall picking is not enabled")

    rings = placement.get("rings") or []
    if len(rings) != 1:
        raise RuntimeError(f"expected one facade ring, got {len(rings)}")
    nodes = rings[0].get("nodes") or []
    if len(nodes) < 2:
        raise RuntimeError("facade ring has fewer than two nodes")

    parsed_nodes = []
    for node in nodes:
        wall_type = node.get("wallType")
        if not wall_type or not wall_type.startswith("Wall "):
            raise RuntimeError(f"invalid explicit wall type: {wall_type}")
        wall_index = int(wall_type.split()[-1]) - 1
        if wall_index < 0 or wall_index >= len(fac["walls"]):
            raise RuntimeError(f"wall type {wall_type} is outside facade wall table")
        latitude = float(node["latitude"])
        longitude = float(node["longitude"])
        parsed_nodes.append({
            "wedObjectId": int(node["wedObjectId"]),
            "latitude": latitude,
            "longitude": longitude,
            "wallType": wall_type,
            "wallIndex": wall_index,
            "browserPosition": browser_position(latitude, longitude),
            "split": str(node.get("split", "0")),
            "ctrlLatitudeLo": float(node.get("ctrlLatitudeLo", 0)),
            "ctrlLongitudeLo": float(node.get("ctrlLongitudeLo", 0)),
            "ctrlLatitudeHi": float(node.get("ctrlLatitudeHi", 0)),
            "ctrlLongitudeHi": float(node.get("ctrlLongitudeHi", 0)),
        })

    edge_count = len(parsed_nodes) if fac["ring"] else len(parsed_nodes) - 1
    edges = []
    for index in range(edge_count):
        start = parsed_nodes[index]
        end = parsed_nodes[(index + 1) % len(parsed_nodes)]
        dx = end["browserPosition"][0] - start["browserPosition"][0]
        dz = end["browserPosition"][2] - start["browserPosition"][2]
        edge_length = math.hypot(dx, dz)
        wall = fac["walls"][start["wallIndex"]]
        selection = choose_spelling(edge_length, wall, fac["segments"])
        cumulative_nominal = 0.0
        instances = []
        for segment_index in selection["segments"]:
            segment = fac["segments"][segment_index]
            instances.append({
                "segmentIndex": segment_index,
                "nominalOffsetMeters": cumulative_nominal,
                "scaledOffsetMeters": cumulative_nominal * selection["stretchScale"],
                "nominalLengthMeters": segment["nominalLengthMeters"],
                "stretchScale": selection["stretchScale"],
                "meshes": segment["meshes"],
                "attachments": [
                    {
                        **attachment,
                        "objectFile": fac["objects"][attachment["objectIndex"]],
                    }
                    for attachment in segment["attachments"]
                ],
            })
            cumulative_nominal += segment["nominalLengthMeters"]

        edges.append({
            "index": index,
            "startNodeId": start["wedObjectId"],
            "endNodeId": end["wedObjectId"],
            "startBrowserPosition": start["browserPosition"],
            "endBrowserPosition": end["browserPosition"],
            "lengthMeters": edge_length,
            "wallType": start["wallType"],
            "wallIndex": start["wallIndex"],
            "wallName": wall["name"],
            "sourceSpellingIndex": selection["sourceSpellingIndex"],
            "repeatCount": selection["repeatCount"],
            "spelling": selection["segments"],
            "nominalLengthMeters": selection["nominalLengthMeters"],
            "stretchScale": selection["stretchScale"],
            "segments": instances,
        })

    output = {
        "schemaVersion": 1,
        "authority": "XP11-stock-jetway_1_solid.fac-plus-KPHX-1.75.1-explicit-WED-wall-selection",
        "selectionPolicy": "explicit-WED-wall-index;closest-authored-spelling-by-nominal-length;source-order-tie;repeat-longest-only-beyond-longest",
        "coordinateAuthority": "A1-flat-earth-source-frame-R6378137",
        "source": {
            "facadePath": str(args.fac),
            "facadeSha256": sha256(args.fac),
            "wedJsonPath": str(args.wed_json),
            "wedJsonSha256": sha256(args.wed_json),
            "resource": placement["resource"],
            "wedObjectId": int(placement["wedObjectId"]),
            "heightMeters": float(placement["height"]),
            "pickWalls": int(placement["pickWalls"]),
            "facadeRingMode": 1 if fac["ring"] else 0,
            "nodeCount": len(parsed_nodes),
            "edgeCount": edge_count,
        },
        "textures": fac["textures"],
        "normalMetalness": fac["normalMetalness"],
        "objects": fac["objects"],
        "nodes": parsed_nodes,
        "edges": edges,
    }

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "wedObjectId": output["source"]["wedObjectId"],
        "ringMode": output["source"]["facadeRingMode"],
        "nodeCount": len(parsed_nodes),
        "edgeCount": len(edges),
        "walls": [edge["wallName"] for edge in edges],
        "spellings": [edge["spelling"] for edge in edges],
        "lengths": [round(edge["lengthMeters"], 6) for edge in edges],
        "scales": [round(edge["stretchScale"], 6) for edge in edges],
    }, indent=2))

if __name__ == "__main__":
    main()

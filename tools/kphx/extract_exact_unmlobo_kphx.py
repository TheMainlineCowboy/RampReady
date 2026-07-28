#!/usr/bin/env python3
"""Extract source-authored browser assets from unmlobo KPHX 1.8.1.

This tool never invents terminal, jetway, or ground geometry. It extracts only data
physically present in the supplied package and records every unresolved simulator
base-asset dependency so a procedural stand-in cannot be mistaken for source art.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import struct
import uuid
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path

EXPECTED_ARCHIVE_SHA256 = "d118f396081b5faabc81daf3786a0c56e3c0f7b4c9b7d6cbe7ce13c10efe05bc"
EXPECTED_AIRPORT_BGL_SHA256 = "1ea4978b5a89ecf5efebe522c9837e9d89de6f7a45dc4e99bfe161a8343ed2a2"
PACKAGE_MODEL_GUID = "ab6fb835-1387-4823-94cb-48737a060f0c"
A1 = {"gate": "A1", "longitude": -111.99876129627228, "latitude": 33.436546325683594, "headingDegrees": 270.4908752441406}
EARTH_RADIUS_METERS = 6378137.0


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def lon_deg(raw: int) -> float:
    return raw * (360.0 / (3 * 0x10000000)) - 180.0


def lat_deg(raw: int) -> float:
    return 90.0 - raw * (180.0 / (2 * 0x10000000))


def to_a1_scene(longitude: float, latitude: float) -> list[float]:
    lat0 = math.radians(A1["latitude"])
    east = math.radians(longitude - A1["longitude"]) * EARTH_RADIUS_METERS * math.cos(lat0)
    north = math.radians(latitude - A1["latitude"]) * EARTH_RADIUS_METERS
    return [north, east]


def unpack_archive(archive: Path, work: Path) -> Path:
    if sha256(archive) != EXPECTED_ARCHIVE_SHA256:
        raise ValueError("Uploaded KPHX archive SHA-256 does not match the accepted 1.8.1 source")
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    with zipfile.ZipFile(archive) as package:
        package.extractall(work)
    root = work / "unmlobo-kphx"
    if not (root / "manifest.json").is_file():
        raise ValueError("unmlobo-kphx package root is missing")
    return root


def airport_children(data: bytes) -> tuple[dict, list[tuple[int, int, int]]]:
    u16 = lambda o: struct.unpack_from("<H", data, o)[0]
    u32 = lambda o: struct.unpack_from("<I", data, o)[0]
    if u32(0) != 0x19920201 or u32(4) != 0x38:
        raise ValueError("Airport source is not an FSX/MSFS BGL")
    sections = []
    for index in range(u32(0x14)):
        o = 0x38 + index * 20
        section_type, flags, count, offset, byte_count = [u32(o + n) for n in (0, 4, 8, 12, 16)]
        subsection_size = ((flags & 0x10000) | 0x40000) >> 14
        sections.append({"type": section_type, "flags": flags, "count": count, "offset": offset, "bytes": byte_count, "subsectionSize": subsection_size})
    airport_section = next((entry for entry in sections if entry["type"] == 3), None)
    if not airport_section:
        raise ValueError("Airport section 0x03 is missing")
    subsection = airport_section["offset"]
    data_offset = u32(subsection + 8)
    record_size = u32(data_offset + 2)
    if u16(data_offset) != 0x56:
        raise ValueError("KPHX airport record 0x56 is missing")
    origin = {
        "longitude": lon_deg(u32(data_offset + 0x0C)),
        "latitude": lat_deg(u32(data_offset + 0x10)),
        "altitudeMeters": u32(data_offset + 0x14) / 1000.0,
    }
    cursor = data_offset + 0x44
    end = data_offset + record_size
    children = []
    while cursor + 6 <= end:
        record_type = u16(cursor)
        size = u32(cursor + 2)
        if size < 6 or cursor + size > end:
            raise ValueError(f"Invalid airport child record at 0x{cursor:x}")
        children.append((cursor, record_type, size))
        cursor += size
    if cursor != end:
        raise ValueError("Airport child records do not end on the airport boundary")
    return origin, children


def parse_materials(package_root: Path) -> tuple[dict[str, dict], list[dict]]:
    library = ET.parse(package_root / "MaterialLibs/KPHX-Materials/Library.xml").getroot()
    by_guid: dict[str, dict] = {}
    rows = []
    for element in library.findall("Material"):
        texture = element.find("./TextureList/Texture")
        entry = {
            "guid": element.attrib["Guid"].strip("{}").lower(),
            "name": element.attrib["Name"],
            "surfaceType": element.attrib.get("SurfaceType"),
            "blendMode": element.attrib.get("BlendMode"),
            "texture": texture.attrib.get("FileName") if texture is not None else None,
        }
        by_guid[entry["guid"]] = entry
        rows.append(entry)
    if len(rows) != 86:
        raise ValueError(f"Expected 86 custom materials, found {len(rows)}")
    return by_guid, rows


def parse_airport(data: bytes, children: list[tuple[int, int, int]], material_by_guid: dict[str, dict]) -> dict:
    u16 = lambda o: struct.unpack_from("<H", data, o)[0]
    u32 = lambda o: struct.unpack_from("<I", data, o)[0]
    aprons = []
    painted_lines = []
    jetways = []
    for offset, record_type, size in children:
        if record_type == 0xD0:
            material_guid = str(uuid.UUID(bytes_le=data[offset + 12:offset + 28]))
            vertex_count, triangle_count = struct.unpack_from("<HH", data, offset + 48)
            layout_padding = size - (52 + vertex_count * 8 + triangle_count * 6)
            if layout_padding not in (0, 2):
                raise ValueError(f"Unsupported apron record padding: {layout_padding}")
            cursor = offset + 52 + layout_padding
            vertices = []
            for _ in range(vertex_count):
                longitude, latitude = lon_deg(u32(cursor)), lat_deg(u32(cursor + 4))
                vertices.append({"scene": to_a1_scene(longitude, latitude), "longitude": longitude, "latitude": latitude})
                cursor += 8
            triangles = []
            for _ in range(triangle_count):
                triangles.append(list(struct.unpack_from("<HHH", data, cursor)))
                cursor += 6
            if cursor != offset + size:
                raise ValueError("Apron record layout drifted")
            aprons.append({
                "sourceOffset": offset,
                "materialGuid": material_guid,
                "customMaterial": material_by_guid.get(material_guid),
                "colorBytes": list(data[offset + 8:offset + 12]),
                "flags": u16(offset + 6),
                "parameters": list(struct.unpack_from("<5f", data, offset + 28)),
                "vertices": vertices,
                "triangles": triangles,
            })
        elif record_type == 0xCF:
            style = u16(offset + 6)
            point_count = u16(offset + 8)
            cursor = offset + 28
            points = []
            for _ in range(point_count):
                longitude, latitude = lon_deg(u32(cursor)), lat_deg(u32(cursor + 4))
                points.append({"scene": to_a1_scene(longitude, latitude), "longitude": longitude, "latitude": latitude})
                cursor += 8
            if cursor != offset + size:
                raise ValueError("Painted-line record layout drifted")
            painted_lines.append({"sourceOffset": offset, "styleRaw": style, "points": points})
        elif record_type == 0xDE:
            jetways.append({"sourceOffset": offset, "recordHex": data[offset:offset + size].hex(), "containsAsoJetway": b"ASO_Jetway" in data[offset:offset + size]})
    return {"aprons": aprons, "paintedLines": painted_lines, "jetways": jetways}


def parse_library_objects(data: bytes) -> list[dict]:
    u16 = lambda o: struct.unpack_from("<H", data, o)[0]
    u32 = lambda o: struct.unpack_from("<I", data, o)[0]
    placements = []
    for index in range(u32(0x14)):
        o = 0x38 + index * 20
        section_type, flags, subsection_count, subsection_offset = u32(o), u32(o + 4), u32(o + 8), u32(o + 12)
        if section_type != 0x25:
            continue
        subsection_size = ((flags & 0x10000) | 0x40000) >> 14
        for subsection_index in range(subsection_count):
            s = subsection_offset + subsection_index * subsection_size
            record_count, data_offset, data_bytes = u32(s + 4), u32(s + 8), u32(s + 12)
            cursor = data_offset
            end = data_offset + data_bytes
            for _ in range(record_count):
                record_type = u16(cursor)
                size = u16(cursor + 2)
                if size < 4 or cursor + size > end:
                    raise ValueError("Invalid scenery object record")
                if record_type == 11 and size == 64:
                    longitude, latitude = lon_deg(u32(cursor + 4)), lat_deg(u32(cursor + 8))
                    heading_raw = struct.unpack_from("<h", data, cursor + 22)[0]
                    placements.append({
                        "sourceOffset": cursor,
                        "longitude": longitude,
                        "latitude": latitude,
                        "scene": to_a1_scene(longitude, latitude),
                        "headingDegrees": (heading_raw / 65536.0 * 360.0) % 360.0,
                        "guid": str(uuid.UUID(bytes_le=data[cursor + 44:cursor + 60])),
                        "scale": struct.unpack_from("<f", data, cursor + 60)[0],
                    })
                cursor += size
            if cursor != end:
                raise ValueError("Scenery object subsection boundary drifted")
    return placements


def extract_model_library(package_root: Path, output: Path) -> dict:
    source = package_root / "scenery/kphx/KPHX-ModelLib/KPHX-ModelLib.BGL"
    data = source.read_bytes()
    offset = data.find(b"glTF")
    if offset < 0:
        raise ValueError("Embedded GLB is missing from the package model library")
    length = struct.unpack_from("<I", data, offset + 8)[0]
    glb = data[offset:offset + length]
    if len(glb) != 26568 or glb[:4] != b"glTF":
        raise ValueError("Embedded KPHX-D-2 GLB identity drifted")
    model_dir = output / "models"
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "KPHX-D-2.glb"
    model_path.write_bytes(glb)
    return {"name": "KPHX-D-2", "guid": PACKAGE_MODEL_GUID, "bytes": len(glb), "sha256": hashlib.sha256(glb).hexdigest(), "path": "models/KPHX-D-2.glb"}


def convert_textures(package_root: Path, output: Path) -> list[dict]:
    try:
        from PIL import Image
    except ImportError as error:
        raise RuntimeError("Pillow is required to convert DDS textures losslessly") from error
    texture_dir = output / "textures"
    texture_dir.mkdir(parents=True, exist_ok=True)
    converted = []
    for source in sorted(package_root.rglob("*.DDS")):
        relative_name = source.name[:-4] + ".webp"
        target = texture_dir / relative_name
        image = Image.open(source).convert("RGBA")
        image.save(target, "WEBP", lossless=True, method=6)
        converted.append({"source": str(source.relative_to(package_root)).replace("\\", "/"), "path": f"textures/{relative_name}", "width": image.width, "height": image.height, "bytes": target.stat().st_size, "sha256": sha256(target)})
    if len(converted) != 87:
        raise ValueError(f"Expected 87 DDS textures, converted {len(converted)}")
    return converted


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--work", type=Path, default=Path(".cache/unmlobo-kphx-source"))
    args = parser.parse_args()
    package_root = unpack_archive(args.archive.resolve(), args.work.resolve())
    airport_bgl = package_root / "scenery/world/scenery/kphx-airport.bgl"
    if sha256(airport_bgl) != EXPECTED_AIRPORT_BGL_SHA256:
        raise ValueError("Airport BGL SHA-256 mismatch")
    data = airport_bgl.read_bytes()
    origin, children = airport_children(data)
    material_by_guid, materials = parse_materials(package_root)
    airport = parse_airport(data, children, material_by_guid)
    placements = parse_library_objects(data)
    output = args.output.resolve()
    shutil.rmtree(output, ignore_errors=True)
    output.mkdir(parents=True)
    model = extract_model_library(package_root, output)
    textures = convert_textures(package_root, output)
    guid_counts = Counter(entry["guid"] for entry in placements)
    source_data = {
        "schemaVersion": 1,
        "coordinateFrame": "A1-local; X=north, Y=up, Z=east",
        "anchor": A1,
        "origin": origin,
        "airport": airport,
        "libraryObjectPlacements": placements,
        "materials": materials,
    }
    source_data_path = output / "source-data.json"
    source_data_path.write_text(json.dumps(source_data, separators=(",", ":")) + "\n", encoding="utf8")
    manifest = {
        "schemaVersion": 1,
        "sourceArchiveSha256": EXPECTED_ARCHIVE_SHA256,
        "airportBglSha256": EXPECTED_AIRPORT_BGL_SHA256,
        "counts": {
            "apronPolygons": len(airport["aprons"]),
            "paintedLines": len(airport["paintedLines"]),
            "jetways": len(airport["jetways"]),
            "libraryObjectPlacements": len(placements),
            "customMaterials": len(materials),
            "textures": len(textures),
            "embeddedModels": 1,
        },
        "model": model,
        "textures": textures,
        "unresolvedBaseSimulatorGuids": [{"guid": guid, "placementCount": count} for guid, count in sorted(guid_counts.items()) if guid != PACKAGE_MODEL_GUID],
        "sourceData": {"path": "source-data.json", "bytes": source_data_path.stat().st_size, "sha256": sha256(source_data_path)},
        "fidelity": {
            "proceduralReplacementAllowed": False,
            "completeSimulatorVisual": False,
            "reason": "The supplied enhancement package references default MSFS airport buildings, stock jetways and stock library objects that are not embedded in the archive.",
        },
    }
    (output / "source-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"output": str(output), "counts": manifest["counts"], "unresolvedBaseSimulatorGuids": len(manifest["unresolvedBaseSimulatorGuids"])}, indent=2))


if __name__ == "__main__":
    main()

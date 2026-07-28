#!/usr/bin/env python3
"""Translate the exact unmlobo KPHX 1.8.1 airport source into browser assets.

No terminal, jetway, apron, painted-line, or material geometry is invented here.
The translator preserves the compiled airport's A1-local positions, polygon
triangles, painted-line paths, record colors, custom material textures, and
source ordering. Simulator library objects that are not embedded in the source
archive remain unresolved rather than being replaced with guessed geometry.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import struct
import tempfile
import uuid
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image

EXPECTED_ARCHIVE_SHA256 = "d118f396081b5faabc81daf3786a0c56e3c0f7b4c9b7d6cbe7ce13c10efe05bc"
EXPECTED_BGL_SHA256 = "1ea4978b5a89ecf5efebe522c9837e9d89de6f7a45dc4e99bfe161a8343ed2a2"
A1_LONGITUDE = -111.99876129627228
A1_LATITUDE = 33.436546325683594
A1_HEADING = 270.4908752441406
EARTH_RADIUS_METERS = 6_378_137.0


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def longitude_degrees(raw: int) -> float:
    return raw * (360.0 / (3 * 0x10000000)) - 180.0


def latitude_degrees(raw: int) -> float:
    return 90.0 - raw * (180.0 / (2 * 0x10000000))


def scene_position(longitude: float, latitude: float) -> list[float]:
    east = math.radians(longitude - A1_LONGITUDE) * EARTH_RADIUS_METERS * math.cos(math.radians(A1_LATITUDE))
    north = math.radians(latitude - A1_LATITUDE) * EARTH_RADIUS_METERS
    return [north, east]


def extract_package(archive: Path, work: Path) -> Path:
    if sha256_file(archive) != EXPECTED_ARCHIVE_SHA256:
        raise RuntimeError("The downloaded archive is not the accepted unmlobo KPHX 1.8.1 package")
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    with zipfile.ZipFile(archive) as source:
        source.extractall(work)
    candidates = [path.parent for path in work.rglob("manifest.json") if (path.parent / "scenery/world/scenery/kphx-airport.bgl").is_file()]
    if len(candidates) != 1:
        raise RuntimeError(f"Expected one unmlobo package root, found {len(candidates)}")
    return candidates[0]


def parse_materials(root: Path) -> tuple[list[dict], dict[str, dict]]:
    library = ET.parse(root / "MaterialLibs/KPHX-Materials/Library.xml").getroot()
    materials = []
    by_guid = {}
    for material in library.findall("Material"):
        texture = material.find("./TextureList/Texture")
        entry = {
            "guid": material.attrib["Guid"].strip("{}").lower(),
            "name": material.attrib["Name"],
            "surfaceType": material.attrib.get("SurfaceType"),
            "blendMode": material.attrib.get("BlendMode"),
            "texture": texture.attrib.get("FileName") if texture is not None else None,
        }
        materials.append(entry)
        by_guid[entry["guid"]] = entry
    if len(materials) != 86:
        raise RuntimeError(f"Expected 86 source materials, found {len(materials)}")
    return materials, by_guid


def parse_airport(root: Path, material_by_guid: dict[str, dict]) -> dict:
    source = root / "scenery/world/scenery/kphx-airport.bgl"
    data = source.read_bytes()
    if sha256_bytes(data) != EXPECTED_BGL_SHA256:
        raise RuntimeError("KPHX airport BGL identity mismatch")
    u8 = lambda offset: data[offset]
    u16 = lambda offset: struct.unpack_from("<H", data, offset)[0]
    u32 = lambda offset: struct.unpack_from("<I", data, offset)[0]
    f32 = lambda offset: struct.unpack_from("<f", data, offset)[0]
    if u32(0) != 0x19920201 or u32(4) != 0x38:
        raise RuntimeError("KPHX source is not an FSX/MSFS BGL")

    sections = []
    for index in range(u32(0x14)):
        offset = 0x38 + index * 20
        section_type, flags, count, subsection_offset, byte_count = [u32(offset + add) for add in (0, 4, 8, 12, 16)]
        subsection_size = ((flags & 0x10000) | 0x40000) >> 14
        sections.append({
            "type": section_type,
            "flags": flags,
            "count": count,
            "offset": subsection_offset,
            "bytes": byte_count,
            "subsectionSize": subsection_size,
        })

    airport_section = next((entry for entry in sections if entry["type"] == 3), None)
    if not airport_section:
        raise RuntimeError("KPHX airport section is missing")
    subsection = airport_section["offset"]
    airport_offset = u32(subsection + 8)
    airport_size = u32(airport_offset + 2)
    if u16(airport_offset) != 0x56:
        raise RuntimeError("KPHX airport record is missing")

    children = []
    cursor = airport_offset + 0x44
    airport_end = airport_offset + airport_size
    while cursor + 6 <= airport_end:
        record_type = u16(cursor)
        size = u32(cursor + 2)
        if size < 6 or cursor + size > airport_end:
            raise RuntimeError(f"Invalid KPHX child record at 0x{cursor:x}")
        children.append((cursor, record_type, size))
        cursor += size
    if cursor != airport_end:
        raise RuntimeError("KPHX airport child boundary drifted")

    aprons = []
    painted_lines = []
    jetways = []
    for offset, record_type, size in children:
        if record_type == 0xD0:
            material_guid = str(uuid.UUID(bytes_le=data[offset + 12:offset + 28]))
            vertex_count, triangle_count = struct.unpack_from("<HH", data, offset + 48)
            trailing_padding = size - (52 + vertex_count * 8 + triangle_count * 6)
            if trailing_padding not in (0, 2):
                raise RuntimeError(f"Unsupported apron padding {trailing_padding}")
            pointer = offset + 52
            vertices = []
            for _ in range(vertex_count):
                longitude = longitude_degrees(u32(pointer))
                latitude = latitude_degrees(u32(pointer + 4))
                vertices.append(scene_position(longitude, latitude))
                pointer += 8
            triangles = []
            for _ in range(triangle_count):
                triangles.append(list(struct.unpack_from("<HHH", data, pointer)))
                pointer += 6
            if pointer + trailing_padding != offset + size:
                raise RuntimeError("Apron geometry did not consume its exact source record")
            aprons.append({
                "sourceOffset": offset,
                "materialGuid": material_guid,
                "material": material_by_guid.get(material_guid),
                "flags": u16(offset + 6),
                "colorBytes": list(data[offset + 8:offset + 12]),
                "parameters": list(struct.unpack_from("<5f", data, offset + 28)),
                "vertices": vertices,
                "triangles": triangles,
            })
        elif record_type == 0xCF:
            style = u8(offset + 6)
            true_angle = u8(offset + 7)
            point_count = u32(offset + 8)
            surface_guid = str(uuid.UUID(bytes_le=data[offset + 12:offset + 28]))
            pointer = offset + 28
            points = []
            for _ in range(point_count):
                longitude = longitude_degrees(u32(pointer))
                latitude = latitude_degrees(u32(pointer + 4))
                points.append(scene_position(longitude, latitude))
                pointer += 8
            if pointer != offset + size:
                raise RuntimeError("Painted-line path did not consume its exact source record")
            painted_lines.append({
                "sourceOffset": offset,
                "styleRaw": style,
                "trueAngle": true_angle,
                "surfaceGuid": surface_guid,
                "points": points,
            })
        elif record_type == 0xDE:
            jetways.append({
                "sourceOffset": offset,
                "recordHex": data[offset:offset + size].hex(),
                "containsAsoJetway": b"ASO_Jetway" in data[offset:offset + size],
            })

    placements = []
    for section in sections:
        if section["type"] != 0x25:
            continue
        for subsection_index in range(section["count"]):
            subsection_offset = section["offset"] + subsection_index * section["subsectionSize"]
            record_count = u32(subsection_offset + 4)
            data_offset = u32(subsection_offset + 8)
            data_bytes = u32(subsection_offset + 12)
            pointer = data_offset
            end = data_offset + data_bytes
            for _ in range(record_count):
                record_type = u16(pointer)
                size = u16(pointer + 2)
                if size < 4 or pointer + size > end:
                    raise RuntimeError("Invalid KPHX scenery-object record")
                if record_type == 11 and size == 64:
                    longitude = longitude_degrees(u32(pointer + 4))
                    latitude = latitude_degrees(u32(pointer + 8))
                    heading_raw = struct.unpack_from("<h", data, pointer + 22)[0]
                    placements.append({
                        "sourceOffset": pointer,
                        "scene": scene_position(longitude, latitude),
                        "longitude": longitude,
                        "latitude": latitude,
                        "headingDegrees": (heading_raw / 65536.0 * 360.0) % 360.0,
                        "guid": str(uuid.UUID(bytes_le=data[pointer + 44:pointer + 60])),
                        "scale": f32(pointer + 60),
                    })
                pointer += size
            if pointer != end:
                raise RuntimeError("KPHX scenery-object subsection boundary drifted")

    if (len(aprons), len(painted_lines), len(jetways), len(placements)) != (927, 1184, 112, 364):
        raise RuntimeError(f"KPHX source counts drifted: {len(aprons)}/{len(painted_lines)}/{len(jetways)}/{len(placements)}")
    return {
        "aprons": aprons,
        "paintedLines": painted_lines,
        "jetways": jetways,
        "libraryObjectPlacements": placements,
        "recordCounts": dict(Counter(hex(record_type) for _, record_type, _ in children)),
    }


def build_assets(root: Path, output: Path, materials: list[dict], airport: dict) -> dict:
    shutil.rmtree(output, ignore_errors=True)
    output.mkdir(parents=True)

    source_materials = sorted((material for material in materials if material.get("texture")), key=lambda item: item["guid"])
    columns, rows, cell, padding = 11, 8, 1028, 2
    atlas = Image.new("RGBA", (columns * cell, rows * cell), (0, 0, 0, 0))
    atlas_rect = {}
    for index, material in enumerate(source_materials):
        source = next(root.rglob(material["texture"]))
        image = Image.open(source).convert("RGBA")
        if image.size != (1024, 1024):
            raise RuntimeError(f"Unexpected source material dimensions {image.size}: {source}")
        column, row = index % columns, index // columns
        x, y = column * cell + padding, row * cell + padding
        atlas.paste(image, (x, y))
        atlas.paste(image.crop((0, 0, 1, 1024)).resize((padding, 1024)), (x - padding, y))
        atlas.paste(image.crop((1023, 0, 1024, 1024)).resize((padding, 1024)), (x + 1024, y))
        atlas.paste(image.crop((0, 0, 1024, 1)).resize((1024, padding)), (x, y - padding))
        atlas.paste(image.crop((0, 1023, 1024, 1024)).resize((1024, padding)), (x, y + 1024))
        atlas_rect[material["guid"]] = (x / atlas.width, y / atlas.height, 1024 / atlas.width, 1024 / atlas.height)
    atlas_path = output / "kphx-v181-material-atlas.webp"
    atlas.save(atlas_path, "WEBP", lossless=True, method=6)

    binary = bytearray()
    buffer_views = []
    accessors = []

    def align(alignment: int = 4) -> None:
        while len(binary) % alignment:
            binary.append(0)

    def add_view(raw: bytes, target: int | None = None) -> int:
        align()
        offset = len(binary)
        binary.extend(raw)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(raw)}
        if target:
            view["target"] = target
        buffer_views.append(view)
        return len(buffer_views) - 1

    def add_accessor(values: list, component_type: int, type_name: str, target: int | None = None, minimum=None, maximum=None) -> int:
        format_code = {5126: "f", 5125: "I", 5123: "H"}[component_type]
        raw = struct.pack("<" + format_code * len(values), *values)
        components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[type_name]
        accessor = {
            "bufferView": add_view(raw, target),
            "componentType": component_type,
            "count": len(values) // components,
            "type": type_name,
        }
        if minimum is not None:
            accessor["min"] = minimum
        if maximum is not None:
            accessor["max"] = maximum
        accessors.append(accessor)
        return len(accessors) - 1

    gltf_materials = []
    material_indices = {}

    def color_material(key: str, rgba: tuple[int, int, int, int], roughness: float = 0.93) -> int:
        if key in material_indices:
            return material_indices[key]
        red, green, blue, alpha = (value / 255.0 for value in rgba)
        material = {
            "name": key,
            "pbrMetallicRoughness": {
                "baseColorFactor": [red, green, blue, alpha],
                "metallicFactor": 0,
                "roughnessFactor": roughness,
            },
            "doubleSided": True,
            "extensions": {"KHR_materials_unlit": {}},
        }
        if alpha < 0.999:
            material["alphaMode"] = "BLEND"
        gltf_materials.append(material)
        material_indices[key] = len(gltf_materials) - 1
        return material_indices[key]

    def texture_material(material: dict) -> int:
        key = "texture:" + material["guid"]
        if key in material_indices:
            return material_indices[key]
        gltf_materials.append({
            "name": material["name"],
            "pbrMetallicRoughness": {
                "baseColorFactor": [1, 1, 1, 1],
                "baseColorTexture": {"index": 0},
                "metallicFactor": 0,
                "roughnessFactor": 0.86,
            },
            "alphaMode": "BLEND",
            "doubleSided": True,
            "extensions": {"KHR_materials_unlit": {}},
        })
        material_indices[key] = len(gltf_materials) - 1
        return material_indices[key]

    buckets = defaultdict(lambda: {"positions": [], "uvs": [], "indices": [], "name": ""})

    def add_polygon(apron: dict, y: float) -> None:
        vertices = apron["vertices"]
        triangles = apron["triangles"]
        material = apron.get("material")
        if material:
            material_index = texture_material(material)
            heading = apron["parameters"][1]
            cosine, sine = math.cos(-heading), math.sin(-heading)
            rotated = [(vertex[0] * cosine - vertex[1] * sine, vertex[0] * sine + vertex[1] * cosine) for vertex in vertices]
            minimum_u = min(value[0] for value in rotated)
            maximum_u = max(value[0] for value in rotated)
            minimum_v = min(value[1] for value in rotated)
            maximum_v = max(value[1] for value in rotated)
            delta_u = max(maximum_u - minimum_u, 1e-4)
            delta_v = max(maximum_v - minimum_v, 1e-4)
            atlas_u, atlas_v, atlas_width, atlas_height = atlas_rect[material["guid"]]
            uvs = [
                (atlas_u + ((u - minimum_u) / delta_u) * atlas_width, 1 - (atlas_v + ((v - minimum_v) / delta_v) * atlas_height))
                for u, v in rotated
            ]
            name = material["name"]
        else:
            rgba = tuple(apron.get("colorBytes", [105, 105, 105, 255]))
            if rgba[3] == 0:
                return
            material_index = color_material(f"surface:{apron['materialGuid']}:{'-'.join(map(str, rgba))}", rgba, 0.97)
            uvs = [(0.0, 0.0) for _ in vertices]
            name = "SourceSurface"
        bucket = buckets[material_index]
        base = len(bucket["positions"]) // 3
        bucket["name"] = name
        for (x, z), (u, v) in zip(vertices, uvs):
            bucket["positions"].extend((float(x), float(y), float(z)))
            bucket["uvs"].extend((float(u), float(v)))
        for triangle in triangles:
            if len(set(triangle)) < 3 or any(index >= len(vertices) for index in triangle):
                continue
            bucket["indices"].extend((base + triangle[0], base + triangle[1], base + triangle[2]))

    for apron in airport["aprons"]:
        if not apron.get("material"):
            add_polygon(apron, 0.006)
    for apron in airport["aprons"]:
        if apron.get("material"):
            priority = max(0.0, float(apron["parameters"][3] or 0.0))
            add_polygon(apron, 0.035 + priority * 3.0)

    palette = {
        "yellow": (248, 198, 0, 255),
        "white": (238, 238, 229, 255),
        "red": (208, 35, 38, 255),
    }
    line_materials = {}

    def line_material(color: str, width: float) -> int:
        key = (color, width)
        if key not in line_materials:
            line_materials[key] = color_material(f"line:{color}:{width}", palette[color], 0.9)
        return line_materials[key]

    def style_info(style: int):
        base = style - 21 if 21 <= style <= 41 else style
        if base == 13:
            return "white", 0.45, False, "single"
        if base in (14, 15):
            return "red", 0.45 if base == 14 else 0.14, False, "single"
        if base in (9, 10, 11):
            return "white", 0.14, base in (9, 11), "single"
        if base == 7:
            return "yellow", 0.16, True, "single"
        if base in (6, 16, 17):
            return "yellow", 0.16, False, "single"
        if base in (18, 19):
            return "yellow", 0.22, False, "single"
        if base == 20:
            return "yellow", 0.16, False, "enhanced"
        if base in (1, 2, 3, 4, 8):
            return "yellow", 0.18, False, "hold"
        if base == 5:
            return "yellow", 0.18, False, "ils"
        if base == 12:
            return "yellow", 0.45, False, "single"
        return "yellow", 0.16, False, "single"

    def emit_quad(material_index: int, start, end, width: float, y: float = 0.085) -> None:
        x0, z0 = start
        x1, z1 = end
        delta_x, delta_z = x1 - x0, z1 - z0
        length = math.hypot(delta_x, delta_z)
        if length < 1e-5:
            return
        normal_x = -delta_z / length * width / 2
        normal_z = delta_x / length * width / 2
        bucket = buckets[material_index]
        base = len(bucket["positions"]) // 3
        bucket["name"] = "SourcePaintedLines"
        bucket["positions"].extend((
            x0 + normal_x, y, z0 + normal_z,
            x0 - normal_x, y, z0 - normal_z,
            x1 - normal_x, y, z1 - normal_z,
            x1 + normal_x, y, z1 + normal_z,
        ))
        bucket["uvs"].extend((0, 0, 0, 1, 1, 1, 1, 0))
        bucket["indices"].extend((base, base + 1, base + 2, base, base + 2, base + 3))

    def dash_segments(start, end, on: float = 2.5, off: float = 2.5):
        x0, z0 = start
        x1, z1 = end
        delta_x, delta_z = x1 - x0, z1 - z0
        length = math.hypot(delta_x, delta_z)
        if length < 1e-5:
            return []
        unit_x, unit_z = delta_x / length, delta_z / length
        result = []
        cursor = 0.0
        while cursor < length:
            segment_end = min(cursor + on, length)
            result.append(((x0 + unit_x * cursor, z0 + unit_z * cursor), (x0 + unit_x * segment_end, z0 + unit_z * segment_end)))
            cursor += on + off
        return result

    def offset_segment(start, end, offset: float):
        x0, z0 = start
        x1, z1 = end
        delta_x, delta_z = x1 - x0, z1 - z0
        length = math.hypot(delta_x, delta_z)
        if length < 1e-5:
            return start, end
        normal_x, normal_z = -delta_z / length * offset, delta_x / length * offset
        return (x0 + normal_x, z0 + normal_z), (x1 + normal_x, z1 + normal_z)

    for line in airport["paintedLines"]:
        style = int(line["styleRaw"])
        color, width, dashed, recipe = style_info(style)
        material_index = line_material(color, width)
        for start, end in zip(line["points"], line["points"][1:]):
            if recipe == "single":
                for segment_start, segment_end in (dash_segments(start, end) if dashed else [(start, end)]):
                    emit_quad(material_index, segment_start, segment_end, width)
            elif recipe == "enhanced":
                for offset in (-0.34, 0.0, 0.34):
                    segment_start, segment_end = offset_segment(start, end, offset)
                    emit_quad(material_index, segment_start, segment_end, width if offset == 0 else width * 0.75)
            else:
                separation = 0.48 if recipe == "hold" else 0.72
                segment_start, segment_end = offset_segment(start, end, -separation / 2)
                emit_quad(material_index, segment_start, segment_end, width)
                segment_start, segment_end = offset_segment(start, end, separation / 2)
                for dash_start, dash_end in dash_segments(segment_start, segment_end, 0.75, 0.55):
                    emit_quad(material_index, dash_start, dash_end, width)

    primitives = []
    for material_index, bucket in sorted(buckets.items()):
        if not bucket["indices"]:
            continue
        positions = bucket["positions"]
        indices = bucket["indices"]
        if max(indices) >= 65536:
            raise RuntimeError("A KPHX source primitive exceeded uint16 index range")
        xs, ys, zs = positions[0::3], positions[1::3], positions[2::3]
        position_accessor = add_accessor(positions, 5126, "VEC3", 34962, [min(xs), min(ys), min(zs)], [max(xs), max(ys), max(zs)])
        attributes = {"POSITION": position_accessor}
        if gltf_materials[material_index].get("pbrMetallicRoughness", {}).get("baseColorTexture"):
            uvs = bucket["uvs"]
            attributes["TEXCOORD_0"] = add_accessor(uvs, 5126, "VEC2", 34962, [min(uvs[0::2]), min(uvs[1::2])], [max(uvs[0::2]), max(uvs[1::2])])
        index_accessor = add_accessor(indices, 5123, "SCALAR", 34963, [min(indices)], [max(indices)])
        primitives.append({
            "attributes": attributes,
            "indices": index_accessor,
            "material": material_index,
            "mode": 4,
            "extras": {"sourceLayer": bucket["name"]},
        })

    gltf = {
        "asset": {"version": "2.0", "generator": "RampReady exact unmlobo KPHX 1.8.1 source translator"},
        "extensionsUsed": ["EXT_texture_webp", "KHR_materials_unlit"],
        "extensionsRequired": ["EXT_texture_webp"],
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{
            "name": "PHX_KPHX_Unmlobo_v181_ExactGround",
            "mesh": 0,
            "extras": {
                "source": "unmlobo-kphx1-8-1_Mu9aq.zip",
                "anchor": "A1",
                "coordinateFrame": "A1-local X=north Z=east",
                "apronRecords": 927,
                "paintedLines": 1184,
                "proceduralReplacement": False,
            },
        }],
        "meshes": [{"name": "KPHX_v181_SourceGroundAndMarkings", "primitives": primitives}],
        "materials": gltf_materials,
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"name": "KPHX_v181_ExactMaterialAtlas", "mimeType": "image/webp", "uri": atlas_path.name}],
        "textures": [{"sampler": 0, "extensions": {"EXT_texture_webp": {"source": 0}}}],
        "buffers": [{"uri": "kphx-v181-exact.bin", "byteLength": len(binary)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
    }
    gltf_path = output / "kphx-v181-exact.gltf"
    bin_path = output / "kphx-v181-exact.bin"
    gltf_path.write_text(json.dumps(gltf, separators=(",", ":")) + "\n", encoding="utf8")
    bin_path.write_bytes(binary)

    placement_counts = Counter(entry["guid"] for entry in airport["libraryObjectPlacements"])
    report = {
        "schemaVersion": 1,
        "sourceArchive": "unmlobo-kphx1-8-1_Mu9aq.zip",
        "sourceArchiveSha256": EXPECTED_ARCHIVE_SHA256,
        "airportBglSha256": EXPECTED_BGL_SHA256,
        "coordinateFrame": "A1-local; X=north, Y=up, Z=east",
        "anchor": {"gate": "A1", "longitude": A1_LONGITUDE, "latitude": A1_LATITUDE, "headingDegrees": A1_HEADING},
        "counts": {
            "sourceAprons": len(airport["aprons"]),
            "sourcePaintedLines": len(airport["paintedLines"]),
            "sourceJetways": len(airport["jetways"]),
            "sourceLibraryObjectPlacements": len(airport["libraryObjectPlacements"]),
            "sourceMaterials": len(materials),
            "atlasTextures": len(source_materials),
            "gltfMaterials": len(gltf_materials),
            "primitives": len(primitives),
            "vertices": sum(len(bucket["positions"]) // 3 for bucket in buckets.values()),
            "triangles": sum(len(bucket["indices"]) // 3 for bucket in buckets.values()),
        },
        "unresolvedBaseSimulatorObjects": [
            {"guid": guid, "placementCount": count}
            for guid, count in sorted(placement_counts.items())
            if guid != "ab6fb835-1387-4823-94cb-48737a060f0c"
        ],
        "outputs": {
            "gltf": {"path": gltf_path.name, "bytes": gltf_path.stat().st_size, "sha256": sha256_file(gltf_path)},
            "bin": {"path": bin_path.name, "bytes": bin_path.stat().st_size, "sha256": sha256_file(bin_path)},
            "atlas": {"path": atlas_path.name, "bytes": atlas_path.stat().st_size, "sha256": sha256_file(atlas_path)},
        },
        "proceduralReplacement": False,
    }
    (output / "exact-ground-manifest.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("output", type=Path)
    arguments = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="rampready-kphx-") as temporary:
        root = extract_package(arguments.archive.resolve(), Path(temporary))
        materials, material_by_guid = parse_materials(root)
        airport = parse_airport(root, material_by_guid)
        report = build_assets(root, arguments.output.resolve(), materials, airport)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

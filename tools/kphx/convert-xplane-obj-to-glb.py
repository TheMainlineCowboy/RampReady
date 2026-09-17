#!/usr/bin/env python3
"""Deterministically convert an X-Plane OBJ8 mesh plus day/LIT DDS textures to GLB.

This tool preserves authored vertex positions, normals, UVs, index order, and texture pixels.
It is intentionally a source-ingest tool, not part of the browser runtime.
"""
import argparse, hashlib, json, struct
from io import BytesIO
from pathlib import Path
from PIL import Image


def align4(data: bytearray):
    while len(data) % 4:
        data.append(0)


def pack_f32(values):
    return struct.pack(f"<{len(values)}f", *values)


def pack_u16(values):
    return struct.pack(f"<{len(values)}H", *values)


def minmax(values, stride):
    rows = [values[i:i + stride] for i in range(0, len(values), stride)]
    return ([min(row[j] for row in rows) for j in range(stride)],
            [max(row[j] for row in rows) for j in range(stride)])


def identity(path: Path):
    payload = path.read_bytes()
    return {"bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}


def png_bytes(path: Path):
    image = Image.open(path).convert("RGBA")
    out = BytesIO()
    image.save(out, format="PNG", compress_level=1)
    return out.getvalue(), image.size


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("obj")
    parser.add_argument("day_dds")
    parser.add_argument("lit_dds")
    parser.add_argument("out")
    args = parser.parse_args()

    obj = Path(args.obj)
    day = Path(args.day_dds)
    lit = Path(args.lit_dds)
    out = Path(args.out)

    lines = obj.read_bytes().decode("utf-8", errors="strict").splitlines()
    point_counts = None
    positions, normals, uvs, indices, draws = [], [], [], [], []

    for line in lines:
        if not line:
            continue
        token = line.split()
        if token[0] == "POINT_COUNTS":
            point_counts = list(map(int, token[1:5]))
        elif token[0] == "VT":
            values = list(map(float, token[1:9]))
            positions += values[:3]
            normals += values[3:6]
            uvs += values[6:8]
        elif token[0] == "IDX10":
            indices += list(map(int, token[1:]))
        elif token[0] == "IDX":
            indices.append(int(token[1]))
        elif token[0] == "TRIS":
            draws.append(tuple(map(int, token[1:3])))

    if point_counts is None:
        raise SystemExit("POINT_COUNTS missing")
    if len(positions) // 3 != point_counts[0]:
        raise SystemExit("authored vertex count mismatch")
    if len(indices) != point_counts[3]:
        raise SystemExit("authored index count mismatch")
    if max(indices) >= len(positions) // 3:
        raise SystemExit("authored index outside vertex buffer")
    if sum(count for _, count in draws) != len(indices):
        raise SystemExit("TRIS ranges do not cover the authored index buffer")
    if max(indices) > 65535:
        raise SystemExit("v1 converter requires uint16 indices")

    day_png, day_size = png_bytes(day)
    lit_png, lit_size = png_bytes(lit)
    binary = bytearray()
    views = []

    def add(payload, target=None):
        align4(binary)
        offset = len(binary)
        binary.extend(payload)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(payload)}
        if target:
            view["target"] = target
        views.append(view)
        return len(views) - 1

    pos_view = add(pack_f32(positions), 34962)
    normal_view = add(pack_f32(normals), 34962)
    uv_view = add(pack_f32(uvs), 34962)
    index_view = add(pack_u16(indices), 34963)
    day_view = add(day_png)
    lit_view = add(lit_png)

    position_min, position_max = minmax(positions, 3)
    normal_min, normal_max = minmax(normals, 3)
    uv_min, uv_max = minmax(uvs, 2)

    accessors = [
        {"bufferView": pos_view, "componentType": 5126, "count": len(positions) // 3, "type": "VEC3", "min": position_min, "max": position_max},
        {"bufferView": normal_view, "componentType": 5126, "count": len(normals) // 3, "type": "VEC3", "min": normal_min, "max": normal_max},
        {"bufferView": uv_view, "componentType": 5126, "count": len(uvs) // 2, "type": "VEC2", "min": uv_min, "max": uv_max},
        {"bufferView": index_view, "componentType": 5123, "count": len(indices), "type": "SCALAR", "min": [min(indices)], "max": [max(indices)]},
    ]

    gltf = {
        "asset": {"version": "2.0", "generator": "RampReady exact X-Plane OBJ8 importer v1"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": obj.stem}],
        "meshes": [{"name": obj.stem, "primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2}, "indices": 3, "material": 0, "mode": 4}]}],
        "materials": [{"name": "xplane-authored", "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 1.0}, "emissiveTexture": {"index": 1}, "emissiveFactor": [1, 1, 1], "doubleSided": False, "alphaMode": "MASK", "alphaCutoff": 0.5}],
        "textures": [{"source": 0}, {"source": 1}],
        "images": [{"bufferView": day_view, "mimeType": "image/png", "name": day.stem}, {"bufferView": lit_view, "mimeType": "image/png", "name": lit.stem}],
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(binary)}],
        "extras": {"sourceAuthority": "exact-kphx-xplane-obj8", "source": {"obj": identity(obj), "dayTexture": identity(day), "litTexture": identity(lit)}, "pointCounts": point_counts, "drawRanges": draws, "decodedTextureSizes": [day_size, lit_size]},
    }

    json_chunk = json.dumps(gltf, separators=(",", ":")).encode()
    json_chunk += b" " * ((4 - len(json_chunk) % 4) % 4)
    align4(binary)
    total = 12 + 8 + len(json_chunk) + 8 + len(binary)
    glb = bytearray(b"glTF" + struct.pack("<II", 2, total) + struct.pack("<II", len(json_chunk), 0x4E4F534A) + json_chunk + struct.pack("<II", len(binary), 0x004E4942) + binary)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(glb)
    print(json.dumps({"out": str(out), "bytes": len(glb), "sha256": hashlib.sha256(glb).hexdigest(), "vertices": len(positions) // 3, "indices": len(indices), "drawRanges": len(draws)}, indent=2))


if __name__ == "__main__":
    main()

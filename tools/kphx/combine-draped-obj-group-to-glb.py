#!/usr/bin/env python3
import argparse, hashlib, json, struct
from io import BytesIO
from pathlib import Path
from PIL import Image


def align4(data):
    while len(data) % 4:
        data.append(0)


def identity(path):
    raw = path.read_bytes()
    return {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}


def minmax(values, stride):
    rows = [values[i:i + stride] for i in range(0, len(values), stride)]
    return (
        [min(row[j] for row in rows) for j in range(stride)],
        [max(row[j] for row in rows) for j in range(stride)],
    )


def parse_obj(path, texture_stem, resource_prefix):
    positions, normals, uvs, indices, draws = [], [], [], [], []
    point_counts = None
    texture_ref = None
    for line in path.read_bytes().decode("utf-8", errors="strict").splitlines():
        if not line:
            continue
        token = line.split()
        head = token[0]
        if head == "POINT_COUNTS":
            point_counts = list(map(int, token[1:5]))
        elif head == "TEXTURE_DRAPED":
            texture_ref = " ".join(token[1:])
        elif head == "VT":
            vertex = list(map(float, token[1:9]))
            positions += vertex[:3]
            normals += vertex[3:6]
            uvs += vertex[6:8]
        elif head == "IDX10":
            indices += list(map(int, token[1:]))
        elif head == "IDX":
            indices.append(int(token[1]))
        elif head == "TRIS":
            draws.append(tuple(map(int, token[1:3])))
    if point_counts is None:
        raise SystemExit(f"{path}: POINT_COUNTS missing")
    if len(positions) // 3 != point_counts[0] or len(indices) != point_counts[3]:
        raise SystemExit(f"{path}: authored point-count mismatch")
    if max(indices) >= len(positions) // 3 or max(indices) > 65535:
        raise SystemExit(f"{path}: index range unsupported")
    if sum(count for _, count in draws) != len(indices):
        raise SystemExit(f"{path}: TRIS ranges do not cover index buffer")
    if not texture_ref or Path(texture_ref.replace("\\", "/")).stem.lower() != texture_stem.lower():
        raise SystemExit(f"{path}: TEXTURE_DRAPED mismatch: {texture_ref}")
    source = identity(path)
    source.update({
        "resource": f"{resource_prefix.rstrip('/')}/{path.stem}.obj",
        "vertices": point_counts[0],
        "indices": point_counts[3],
        "drawRanges": len(draws),
    })
    return source, (positions, normals, uvs, indices, draws, texture_ref)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--texture", required=True)
    parser.add_argument("--resource-prefix", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("objects", nargs="+")
    args = parser.parse_args()

    texture_path = Path(args.texture)
    object_paths = [Path(value) for value in args.objects]
    source_meshes = {}
    parsed = {}
    for path in object_paths:
        source, geometry = parse_obj(path, texture_path.stem, args.resource_prefix)
        source_meshes[path.stem] = source
        parsed[path.stem] = geometry

    image = Image.open(texture_path).convert("RGBA")
    image_output = BytesIO()
    image.save(image_output, format="PNG", compress_level=1)
    image_bytes = image_output.getvalue()
    texture_identity = identity(texture_path)
    texture_identity.update({"width": image.width, "height": image.height})

    binary = bytearray()
    views, accessors, meshes, nodes = [], [], [], []

    def add_view(payload, target=None):
        align4(binary)
        offset = len(binary)
        binary.extend(payload)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(payload)}
        if target:
            view["target"] = target
        views.append(view)
        return len(views) - 1

    for path in object_paths:
        name = path.stem
        positions, normals, uvs, indices, draws, _ = parsed[name]
        pos_view = add_view(struct.pack(f"<{len(positions)}f", *positions), 34962)
        normal_view = add_view(struct.pack(f"<{len(normals)}f", *normals), 34962)
        uv_view = add_view(struct.pack(f"<{len(uvs)}f", *uvs), 34962)
        index_view = add_view(struct.pack(f"<{len(indices)}H", *indices), 34963)
        pos_min, pos_max = minmax(positions, 3)
        normal_min, normal_max = minmax(normals, 3)
        uv_min, uv_max = minmax(uvs, 2)
        base = len(accessors)
        accessors += [
            {"bufferView": pos_view, "componentType": 5126, "count": len(positions) // 3, "type": "VEC3", "min": pos_min, "max": pos_max},
            {"bufferView": normal_view, "componentType": 5126, "count": len(normals) // 3, "type": "VEC3", "min": normal_min, "max": normal_max},
            {"bufferView": uv_view, "componentType": 5126, "count": len(uvs) // 2, "type": "VEC2", "min": uv_min, "max": uv_max},
            {"bufferView": index_view, "componentType": 5123, "count": len(indices), "type": "SCALAR", "min": [min(indices)], "max": [max(indices)]},
        ]
        meshes.append({
            "name": name,
            "primitives": [{"attributes": {"POSITION": base, "NORMAL": base + 1, "TEXCOORD_0": base + 2}, "indices": base + 3, "material": 0, "mode": 4}],
            "extras": {"source": source_meshes[name]},
        })
        nodes.append({"mesh": len(meshes) - 1, "name": name})

    image_view = add_view(image_bytes)
    gltf = {
        "asset": {"version": "2.0", "generator": "RampReady exact X-Plane draped OBJ8 group importer v1"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": [{
            "name": f"{texture_path.stem} exact draped atlas",
            "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 1.0},
            "alphaMode": "BLEND",
            "doubleSided": True,
        }],
        "textures": [{"source": 0}],
        "images": [{"bufferView": image_view, "mimeType": "image/png", "name": texture_path.stem}],
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(binary)}],
        "extras": {
            "sourceAuthority": "exact-kphx-xplane-draped-obj8",
            "texture": texture_identity,
            "sourceMeshOrder": [source_meshes[path.stem]["resource"] for path in object_paths],
            "sourceMeshes": source_meshes,
            "xplaneLayerGroup": "draped markings +4",
        },
    }

    json_chunk = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_chunk += b" " * ((4 - len(json_chunk) % 4) % 4)
    align4(binary)
    total = 12 + 8 + len(json_chunk) + 8 + len(binary)
    glb = bytearray(
        b"glTF"
        + struct.pack("<II", 2, total)
        + struct.pack("<II", len(json_chunk), 0x4E4F534A)
        + json_chunk
        + struct.pack("<II", len(binary), 0x004E4942)
        + binary
    )
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(glb)
    print(json.dumps({
        "out": str(out),
        "bytes": len(glb),
        "sha256": hashlib.sha256(glb).hexdigest(),
        "meshCount": len(meshes),
        "sourceMeshBytes": sum(entry["bytes"] for entry in source_meshes.values()),
        "texture": texture_identity,
    }, indent=2))


if __name__ == "__main__":
    main()

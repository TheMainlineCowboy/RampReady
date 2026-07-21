#!/usr/bin/env python3
"""Apply deterministic livery corrections to the CRJ700 build source.

The base builder is kept readable while this patch captures the exact fixes that
must be applied before export: opaque-white texture factors, outward-facing decal
normals, glTF-correct vertical UV orientation, lower fuselage title placement,
and a swept full-fin American tail treatment.
"""
from __future__ import annotations

from pathlib import Path


path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

# Trimesh interprets integer [1,1,1,1] as 8-bit color and exports 1/255 opacity.
# Force floating-point white so the livery is actually visible in Three.js.
source = source.replace(
    "baseColorFactor=[1, 1, 1, 1]",
    "baseColorFactor=[1.0, 1.0, 1.0, 1.0]",
)

# glTF/Pillow vertical orientation: generated decals were vertically inverted.
source = source.replace(
    "uv.append((1.0 - u if mirror_uv else u, 1.0 - v))",
    "uv.append((1.0 - u if mirror_uv else u, v))",
)

# The curved fuselage decals were wound inward, so the visible side was the
# mirrored back face. Reverse the winding for outward normals.
source = source.replace(
    "faces.extend([(a, c, d), (a, d, b)] if side > 0 else [(a, d, c), (a, b, d)])\n"
    "    material = PBRMaterial(name=name, baseColorTexture=texture, baseColorFactor=[1.0, 1.0, 1.0, 1.0],\n"
    "                           metallicFactor=0.05, roughnessFactor=0.34",
    "faces.extend([(a, d, c), (a, b, d)] if side > 0 else [(a, c, d), (a, d, b)])\n"
    "    material = PBRMaterial(name=name, baseColorTexture=texture, baseColorFactor=[1.0, 1.0, 1.0, 1.0],\n"
    "                           metallicFactor=0.05, roughnessFactor=0.34",
)

start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + '''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 1800, 2200
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    colors = [
        (18, 55, 104, 255), (235, 236, 238, 255), (190, 30, 45, 255),
        (238, 239, 240, 255), (24, 78, 132, 255), (228, 230, 232, 255),
        (190, 30, 45, 255), (239, 240, 241, 255), (22, 65, 116, 255),
        (229, 231, 233, 255), (190, 30, 45, 255), (240, 241, 242, 255),
        (22, 62, 112, 255),
    ]
    stripe_h = height / len(colors)
    slant = 180
    for index, color in enumerate(colors):
        y0 = index * stripe_h
        y1 = (index + 1) * stripe_h + 4
        draw.polygon([(-300, y0 + slant), (width + 300, y0 - slant),
                      (width + 300, y1 - slant), (-300, y1 + slant)], fill=color)
    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

start = source.index("def flat_tail_decal(")
end = source.index("\n\ndef add_livery", start)
source = source[:start] + '''def flat_tail_decal(texture: Image.Image, name: str, side: int, z_front: float, z_rear: float,
                     y_bottom: float, y_top: float, x_offset: float, mirror_uv: bool) -> trimesh.Trimesh:
    nz, ny = 28, 32
    vertices, uv = [], []
    for row in range(ny + 1):
        v = row / ny
        y = y_bottom + (y_top - y_bottom) * v
        # The CRJ700 fin sweeps aft and narrows toward the cap.
        row_front = z_front - 3.05 * v
        row_rear = z_rear - 1.25 * v
        x = side * (x_offset * (1.0 - 0.18 * v) + 0.018)
        for column in range(nz + 1):
            u = column / nz
            vertices.append((x, y, row_front + (row_rear - row_front) * u))
            uv.append((1.0 - u if mirror_uv else u, v))
    faces = []
    columns = nz + 1
    for row in range(ny):
        for column in range(nz):
            a = row * columns + column
            b, c, d = a + 1, (row + 1) * columns + column, (row + 1) * columns + column + 1
            faces.extend([(a, d, c), (a, b, d)] if side > 0 else [(a, c, d), (a, d, b)])
    material = PBRMaterial(name=name, baseColorTexture=texture,
                           baseColorFactor=[1.0, 1.0, 1.0, 1.0],
                           metallicFactor=0.08, roughnessFactor=0.31,
                           alphaMode="MASK", alphaCutoff=0.05, doubleSided=False)
    mesh = trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces), process=False)
    mesh.visual = TextureVisuals(uv=np.asarray(uv), material=material)
    return mesh
''' + source[end:]

source = source.replace(
    "title_z_nose, title_z_tail = maximum[2] - 5.0, maximum[2] - 13.0",
    "title_z_nose, title_z_tail = maximum[2] - 4.35, maximum[2] - 13.35",
)
source = source.replace(
    "center_y + 0.12, radius_x, 1.00, mirror_uv=mirror_uv",
    "center_y - 0.70, radius_x, 0.92, mirror_uv=mirror_uv",
)
source = source.replace(
    "center_y + 0.05, radius_x, 0.42, 24, 8, mirror_uv=mirror_uv",
    "center_y - 0.48, radius_x, 0.34, 24, 8, mirror_uv=mirror_uv",
)
source = source.replace(
    "mesh = flat_tail_decal(texture, f\"Tail_Livery_{label}\", side, minimum[2] + 0.10,\n"
    "                               minimum[2] + 4.25, minimum[1] + 4.05, maximum[1] - 0.05,\n"
    "                               0.18, mirror_uv)",
    "mesh = flat_tail_decal(texture, f\"Tail_Livery_{label}\", side, minimum[2] + 6.80,\n"
    "                               minimum[2] + 1.55, minimum[1] + 3.60, maximum[1] - 0.08,\n"
    "                               0.165, mirror_uv)",
)

path.write_text(source, encoding="utf-8")
print("Applied visible, upright, outward-facing American Eagle livery corrections")

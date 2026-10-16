#!/usr/bin/env python3
"""Apply deterministic American Eagle livery corrections before CRJ700 export.

This patch keeps the base builder readable while enforcing the visible corrections
required by the supplied multi-angle references: fully opaque texture factors,
outward-facing decal normals, glTF-correct UV orientation, accurate title placement,
a cleaner American flight-symbol mark, and the modern split red/blue tail treatment.
"""
from __future__ import annotations

from pathlib import Path


path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

# Trimesh interprets integer [1,1,1,1] as 8-bit color and exports 1/255 opacity.
source = source.replace(
    "baseColorFactor=[1, 1, 1, 1]",
    "baseColorFactor=[1.0, 1.0, 1.0, 1.0]",
)

# glTF/Pillow vertical orientation.
source = source.replace(
    "uv.append((1.0 - u if mirror_uv else u, 1.0 - v))",
    "uv.append((1.0 - u if mirror_uv else u, v))",
)

# Curved fuselage decals must face outward, not expose mirrored back faces.
source = source.replace(
    "faces.extend([(a, c, d), (a, d, b)] if side > 0 else [(a, d, c), (a, b, d)])\n"
    "    material = PBRMaterial(name=name, baseColorTexture=texture, baseColorFactor=[1.0, 1.0, 1.0, 1.0],\n"
    "                           metallicFactor=0.05, roughnessFactor=0.34",
    "faces.extend([(a, d, c), (a, b, d)] if side > 0 else [(a, c, d), (a, d, b)])\n"
    "    material = PBRMaterial(name=name, baseColorTexture=texture, baseColorFactor=[1.0, 1.0, 1.0, 1.0],\n"
    "                           metallicFactor=0.05, roughnessFactor=0.34",
)

# Replace the placeholder two-block icon with a cleaner reconstruction of the
# modern American flight symbol: blue upper feather, white negative-space eagle,
# and red lower feather. Keep the wordmark compact and slightly italic.
start = source.index("def create_wordmark_texture(")
end = source.index("\n\ndef create_registration_texture", start)
source = source[:start] + '''def create_wordmark_texture(path: Path, mirrored: bool = False) -> Image.Image:
    image = Image.new("RGBA", (2600, 520), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Blue upper feather: slim, swept, and pointed forward.
    draw.polygon([(52, 104), (250, 104), (190, 166), (82, 220), (18, 220)],
                 fill=(17, 96, 157, 255))
    # Red lower feather, separated by a deliberate white eagle-shaped channel.
    draw.polygon([(88, 258), (286, 258), (205, 336), (118, 426), (18, 426)],
                 fill=(190, 31, 46, 255))
    # White negative-space eagle notch, matching the reference silhouette.
    draw.polygon([(86, 220), (198, 166), (160, 234), (244, 234),
                  (188, 278), (94, 278), (36, 326), (72, 252)],
                 fill=(255, 255, 255, 255))

    word_font = font(224)
    draw.text((318, 92), "American Eagle", font=word_font,
              fill=(67, 70, 73, 255), stroke_width=1)
    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Build the modern split-color tail: narrow blue/silver diagonal feathers on the
# forward half and red/silver feathers on the aft half, with a clean white center
# separation. This matches the uploaded references far better than full-width bands.
start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + '''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2000, 2400
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    silver = (231, 233, 235, 255)
    blue = (20, 69, 120, 255)
    red = (192, 31, 46, 255)
    white = (246, 247, 248, 255)

    # Base silver fin.
    draw.rectangle((0, 0, width, height), fill=silver)

    band_h = 142
    slant = 255
    center = width * 0.52
    overlap = 16
    for index in range(15):
        y0 = index * band_h - 55
        y1 = y0 + band_h * 0.58
        shift = (index % 2) * 10

        # Forward/left blue feather segment.
        draw.polygon([
            (-220, y0 + slant + shift),
            (center + 55, y0 - 15 + shift),
            (center - 15, y1 - 15 + shift),
            (-220, y1 + slant + overlap + shift),
        ], fill=blue)

        # Aft/right red feather segment.
        draw.polygon([
            (center - 5, y0 - 15 + shift),
            (width + 260, y0 - slant + shift),
            (width + 260, y1 - slant + overlap + shift),
            (center + 68, y1 - 15 + shift),
        ], fill=red)

    # Narrow white eagle-shaped center channel separating red and blue fields.
    draw.polygon([
        (center - 30, -80), (center + 105, -80),
        (center + 32, height + 80), (center - 115, height + 80)
    ], fill=white)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Use a swept fin-following decal surface.
start = source.index("def flat_tail_decal(")
end = source.index("\n\ndef add_livery", start)
source = source[:start] + '''def flat_tail_decal(texture: Image.Image, name: str, side: int, z_front: float, z_rear: float,
                      y_bottom: float, y_top: float, x_offset: float, mirror_uv: bool) -> trimesh.Trimesh:
    nz, ny = 32, 38
    vertices, uv = [], []
    for row in range(ny + 1):
        v = row / ny
        y = y_bottom + (y_top - y_bottom) * v
        row_front = z_front - 3.10 * v
        row_rear = z_rear - 1.30 * v
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
                           metallicFactor=0.08, roughnessFactor=0.30,
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
    "center_y - 0.66, radius_x, 0.90, mirror_uv=mirror_uv",
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
print("Applied refined American symbol and split red/blue tail livery corrections")

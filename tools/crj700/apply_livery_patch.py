#!/usr/bin/env python3
"""Apply reference-matched American Eagle livery corrections before CRJ700 export.

This patch enforces visible textures, outward-facing decals, readable two-sided
branding, a slender modern American flight symbol, accurate title placement,
and the split blue/red feather treatment visible in the supplied reference set.
"""
from __future__ import annotations

from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

source = source.replace(
    "baseColorFactor=[1, 1, 1, 1]",
    "baseColorFactor=[1.0, 1.0, 1.0, 1.0]",
)
source = source.replace(
    "uv.append((1.0 - u if mirror_uv else u, 1.0 - v))",
    "uv.append((1.0 - u if mirror_uv else u, v))",
)
source = source.replace(
    "faces.extend([(a, c, d), (a, d, b)] if side > 0 else [(a, d, c), (a, b, d)])\n"
    "    material = PBRMaterial(name=name, baseColorTexture=texture, baseColorFactor=[1.0, 1.0, 1.0, 1.0],\n"
    "                           metallicFactor=0.05, roughnessFactor=0.34",
    "faces.extend([(a, d, c), (a, b, d)] if side > 0 else [(a, c, d), (a, d, b)])\n"
    "    material = PBRMaterial(name=name, baseColorTexture=texture, baseColorFactor=[1.0, 1.0, 1.0, 1.0],\n"
    "                           metallicFactor=0.05, roughnessFactor=0.34",
)

# Create readable artwork independently for each side. The mark is deliberately
# narrow and swept, matching the reference aircraft rather than a block icon.
start = source.index("def create_wordmark_texture(")
end = source.index("\n\ndef create_tail_texture", start)
source = source[:start] + '''def _draw_flight_symbol(draw: ImageDraw.ImageDraw, x: float, y: float, scale: float = 1.0) -> None:
    blue = (23, 111, 176, 255)
    red = (194, 31, 47, 255)
    # Upper blue feather: narrow leading edge, swept shoulder and pointed tail.
    draw.polygon([
        (x + 72 * scale, y + 8 * scale),
        (x + 196 * scale, y + 8 * scale),
        (x + 143 * scale, y + 65 * scale),
        (x + 82 * scale, y + 118 * scale),
        (x + 18 * scale, y + 118 * scale),
    ], fill=blue)
    # Lower red feather with a larger downward sweep.
    draw.polygon([
        (x + 93 * scale, y + 154 * scale),
        (x + 225 * scale, y + 154 * scale),
        (x + 163 * scale, y + 221 * scale),
        (x + 91 * scale, y + 307 * scale),
        (x + 15 * scale, y + 307 * scale),
    ], fill=red)
    # Crisp white negative-space eagle channel between the two feathers.
    draw.polygon([
        (x + 83 * scale, y + 118 * scale),
        (x + 154 * scale, y + 65 * scale),
        (x + 132 * scale, y + 126 * scale),
        (x + 198 * scale, y + 126 * scale),
        (x + 150 * scale, y + 160 * scale),
        (x + 90 * scale, y + 160 * scale),
        (x + 39 * scale, y + 202 * scale),
        (x + 67 * scale, y + 143 * scale),
    ], fill=(255, 255, 255, 255))


def create_wordmark_texture(path: Path, mirrored: bool = False) -> Image.Image:
    image = Image.new("RGBA", (2700, 520), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    title_font = font(224)
    if mirrored:
        draw.text((30, 92), "American Eagle", font=title_font,
                  fill=(67, 70, 73, 255), stroke_width=1)
        _draw_flight_symbol(draw, 2370, 104, 1.0)
    else:
        _draw_flight_symbol(draw, 22, 104, 1.0)
        draw.text((286, 92), "American Eagle", font=title_font,
                  fill=(67, 70, 73, 255), stroke_width=1)
    image.save(path)
    return image


def _draw_us_flag(draw: ImageDraw.ImageDraw, x: float, y: float, width: float, height: float) -> None:
    draw.rectangle((x, y, x + width, y + height), fill=(245, 245, 245, 255))
    stripe_height = height / 13
    for index in range(13):
        if index % 2 == 0:
            draw.rectangle((x, y + index * stripe_height,
                            x + width, y + (index + 1) * stripe_height),
                           fill=(181, 30, 45, 255))
    draw.rectangle((x, y, x + width * 0.42, y + stripe_height * 7),
                   fill=(25, 55, 105, 255))


def create_registration_texture(path: Path, mirrored: bool = False) -> Image.Image:
    image = Image.new("RGBA", (1000, 240), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    reg_font = font(125)
    if mirrored:
        draw.text((35, 34), "N466AW", font=reg_font, fill=(62, 67, 72, 255))
        _draw_us_flag(draw, 755, 62, 190, 108)
    else:
        _draw_us_flag(draw, 35, 62, 190, 108)
        draw.text((270, 34), "N466AW", font=reg_font, fill=(62, 67, 72, 255))
    image.save(path)
    return image
''' + source[end:]

# Reference tail: silver base, blue feathers on the forward half, red feathers
# on the aft half, separated by a narrow irregular white channel. The bands are
# numerous, slim and diagonal rather than full-width alternating stripes.
start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + '''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2200, 2600
    image = Image.new("RGBA", (width, height), (232, 234, 236, 255))
    draw = ImageDraw.Draw(image)
    blue = (20, 69, 120, 255)
    red = (192, 31, 46, 255)
    white = (247, 248, 249, 255)
    center = width * 0.515
    band_pitch = 178
    band_thickness = 92
    slant = 270

    for index in range(16):
        y0 = index * band_pitch - 130
        y1 = y0 + band_thickness
        # Forward blue feather segments.
        draw.polygon([
            (-260, y0 + slant),
            (center + 36, y0 - 10),
            (center - 12, y1 - 10),
            (-260, y1 + slant),
        ], fill=blue)
        # Aft red feather segments.
        draw.polygon([
            (center + 8, y0 - 10),
            (width + 280, y0 - slant),
            (width + 280, y1 - slant),
            (center + 62, y1 - 10),
        ], fill=red)

    # Slightly swept white separator/eagle channel.
    draw.polygon([
        (center - 34, -100), (center + 96, -100),
        (center + 30, height + 100), (center - 122, height + 100)
    ], fill=white)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

start = source.index("def flat_tail_decal(")
end = source.index("\n\ndef add_livery", start)
source = source[:start] + '''def flat_tail_decal(texture: Image.Image, name: str, side: int, z_front: float, z_rear: float,
                      y_bottom: float, y_top: float, x_offset: float, mirror_uv: bool) -> trimesh.Trimesh:
    nz, ny = 34, 42
    vertices, uv = [], []
    for row in range(ny + 1):
        v = row / ny
        y = y_bottom + (y_top - y_bottom) * v
        row_front = z_front - 3.15 * v
        row_rear = z_rear - 1.28 * v
        x = side * (x_offset * (1.0 - 0.17 * v) + 0.018)
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
                           metallicFactor=0.08, roughnessFactor=0.29,
                           alphaMode="OPAQUE", doubleSided=False)
    mesh = trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces), process=False)
    mesh.visual = TextureVisuals(uv=np.asarray(uv), material=material)
    return mesh
''' + source[end:]

source = source.replace(
    "title_z_nose, title_z_tail = maximum[2] - 5.0, maximum[2] - 13.0",
    "title_z_nose, title_z_tail = maximum[2] - 4.20, maximum[2] - 13.55",
)
source = source.replace(
    "center_y + 0.12, radius_x, 1.00, mirror_uv=mirror_uv",
    "center_y - 0.64, radius_x, 0.88, mirror_uv=mirror_uv",
)
source = source.replace(
    "center_y + 0.05, radius_x, 0.42, 24, 8, mirror_uv=mirror_uv",
    "center_y - 0.50, radius_x, 0.33, 24, 8, mirror_uv=mirror_uv",
)
source = source.replace(
    "mesh = flat_tail_decal(texture, f\"Tail_Livery_{label}\", side, minimum[2] + 0.10,\n"
    "                               minimum[2] + 4.25, minimum[1] + 4.05, maximum[1] - 0.05,\n"
    "                               0.18, mirror_uv)",
    "mesh = flat_tail_decal(texture, f\"Tail_Livery_{label}\", side, minimum[2] + 6.84,\n"
    "                               minimum[2] + 1.48, minimum[1] + 3.58, maximum[1] - 0.08,\n"
    "                               0.166, mirror_uv)",
)

path.write_text(source, encoding="utf-8")
print("Applied reference-matched American symbol and split feather tail livery")

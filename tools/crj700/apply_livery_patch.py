#!/usr/bin/env python3
"""Apply reference-matched American Eagle livery corrections before CRJ700 export.

This patch enforces visible textures, outward-facing decals, readable two-sided
branding, a slender modern American flight symbol, accurate title placement,
and the blue-left/red-right striped tail visible in the supplied reference set.
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

# Draw the modern American flight symbol as two slender swept feathers with a
# transparent white channel between them. This avoids the prior chunky block icon.
start = source.index("def create_wordmark_texture(")
end = source.index("\n\ndef create_tail_texture", start)
source = source[:start] + '''def _draw_flight_symbol(draw: ImageDraw.ImageDraw, x: float, y: float, scale: float = 1.0) -> None:
    blue = (17, 103, 166, 255)
    red = (194, 31, 47, 255)
    # Upper feather: slim leading edge, broad swept shoulder, pointed trailing tip.
    draw.polygon([
        (x + 54 * scale, y + 6 * scale),
        (x + 201 * scale, y + 6 * scale),
        (x + 157 * scale, y + 48 * scale),
        (x + 102 * scale, y + 98 * scale),
        (x + 18 * scale, y + 98 * scale),
    ], fill=blue)
    # Lower feather sits below with a clean open channel rather than a painted notch.
    draw.polygon([
        (x + 76 * scale, y + 136 * scale),
        (x + 224 * scale, y + 136 * scale),
        (x + 171 * scale, y + 190 * scale),
        (x + 112 * scale, y + 272 * scale),
        (x + 15 * scale, y + 272 * scale),
    ], fill=red)


def create_wordmark_texture(path: Path, mirrored: bool = False) -> Image.Image:
    image = Image.new("RGBA", (2800, 520), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    title_font = font(224)
    if mirrored:
        draw.text((30, 92), "American Eagle", font=title_font,
                  fill=(67, 70, 73, 255), stroke_width=1)
        _draw_flight_symbol(draw, 2450, 112, 0.96)
    else:
        _draw_flight_symbol(draw, 22, 112, 0.96)
        draw.text((270, 92), "American Eagle", font=title_font,
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

# Reference tail: narrow diagonal bands spanning each half of the fin. Blue bands
# occupy the forward half and red bands the aft half; silver bands alternate between
# them. The center division is narrow, not the oversized white wedge from the prior pass.
start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + '''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2400, 2800
    silver = (224, 227, 230, 255)
    white = (244, 245, 246, 255)
    blue = (22, 74, 126, 255)
    red = (194, 31, 47, 255)
    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)
    center = width * 0.505
    pitch = 218
    thickness = 112
    slant = 255

    # Alternate colored and bright-silver bands, matching the striped rhythm in the
    # supplied side and rear references. Colored bands are continuous up each half.
    for index in range(14):
        y0 = index * pitch - 165
        y1 = y0 + thickness
        shift = 18 * (index % 2)
        draw.polygon([
            (-300, y0 + slant + shift),
            (center + 18, y0 - 8 + shift),
            (center + 18, y1 - 8 + shift),
            (-300, y1 + slant + shift),
        ], fill=blue)
        draw.polygon([
            (center - 18, y0 - 8 + shift),
            (width + 300, y0 - slant + shift),
            (width + 300, y1 - slant + shift),
            (center - 18, y1 - 8 + shift),
        ], fill=red)

    # Narrow swept white separator down the fin center.
    draw.polygon([
        (center - 12, -100), (center + 20, -100),
        (center + 8, height + 100), (center - 30, height + 100)
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
    nz, ny = 40, 48
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
                           metallicFactor=0.10, roughnessFactor=0.27,
                           alphaMode="OPAQUE", doubleSided=False)
    mesh = trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces), process=False)
    mesh.visual = TextureVisuals(uv=np.asarray(uv), material=material)
    return mesh
''' + source[end:]

source = source.replace(
    "title_z_nose, title_z_tail = maximum[2] - 5.0, maximum[2] - 13.0",
    "title_z_nose, title_z_tail = maximum[2] - 4.15, maximum[2] - 13.65",
)
source = source.replace(
    "center_y + 0.12, radius_x, 1.00, mirror_uv=mirror_uv",
    "center_y - 0.62, radius_x, 0.86, mirror_uv=mirror_uv",
)
source = source.replace(
    "center_y + 0.05, radius_x, 0.42, 24, 8, mirror_uv=mirror_uv",
    "center_y - 0.50, radius_x, 0.32, 24, 8, mirror_uv=mirror_uv",
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
print("Applied refined American symbol and blue-left/red-right tail bands")

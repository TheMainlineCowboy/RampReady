#!/usr/bin/env python3
"""Apply reference-matched American Eagle livery corrections before CRJ700 export.

This patch is intentionally deterministic. It replaces the placeholder branding with
reference-driven vector textures, adds the missing aft-fuselage red sweep, improves
fin wrapping, and preserves readable two-sided decals in the exported GLB.
"""
from __future__ import annotations

from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

# Trimesh treats integer [1, 1, 1, 1] as 8-bit color and exports near-transparent
# materials. Use floating-point factors so every livery texture remains fully visible.
source = source.replace(
    "baseColorFactor=[1, 1, 1, 1]",
    "baseColorFactor=[1.0, 1.0, 1.0, 1.0]",
)

# Generated PIL textures use top-left image coordinates; export them upright in glTF.
source = source.replace(
    "uv.append((1.0 - u if mirror_uv else u, 1.0 - v))",
    "uv.append((1.0 - u if mirror_uv else u, v))",
)

# Curved side decals must face outward rather than exposing mirrored back faces.
source = source.replace(
    "faces.extend([(a, c, d), (a, d, b)] if side > 0 else [(a, d, c), (a, b, d)])\n"
    "    material = PBRMaterial(name=name, baseColorTexture=texture, baseColorFactor=[1.0, 1.0, 1.0, 1.0],\n"
    "                           metallicFactor=0.05, roughnessFactor=0.34",
    "faces.extend([(a, d, c), (a, b, d)] if side > 0 else [(a, c, d), (a, d, b)])\n"
    "    material = PBRMaterial(name=name, baseColorTexture=texture, baseColorFactor=[1.0, 1.0, 1.0, 1.0],\n"
    "                           metallicFactor=0.05, roughnessFactor=0.34",
)

# Replace the wordmark, flight symbol, registration, and flag generators.
start = source.index("def create_wordmark_texture(")
end = source.index("\n\ndef create_tail_texture", start)
source = source[:start] + '''def _italic_title_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Oblique.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Italic.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return font(size)


def _draw_flight_symbol(draw: ImageDraw.ImageDraw, x: float, y: float, scale: float = 1.0) -> None:
    """Reference-driven reconstruction of the modern American flight symbol."""
    blue = (15, 104, 170, 255)
    red = (196, 30, 48, 255)

    # Upper blue feather: swept shoulder, tapered inner edge, pointed trailing tip.
    draw.polygon([
        (x + 36 * scale, y + 14 * scale),
        (x + 238 * scale, y + 14 * scale),
        (x + 202 * scale, y + 46 * scale),
        (x + 166 * scale, y + 78 * scale),
        (x + 136 * scale, y + 116 * scale),
        (x + 88 * scale, y + 148 * scale),
        (x + 12 * scale, y + 148 * scale),
        (x + 42 * scale, y + 108 * scale),
        (x + 76 * scale, y + 78 * scale),
        (x + 104 * scale, y + 46 * scale),
    ], fill=blue)

    # Lower red feather. The transparent gap between the two polygons forms the
    # white eagle channel visible on the real mark instead of a chunky painted block.
    draw.polygon([
        (x + 74 * scale, y + 182 * scale),
        (x + 136 * scale, y + 182 * scale),
        (x + 164 * scale, y + 210 * scale),
        (x + 238 * scale, y + 210 * scale),
        (x + 204 * scale, y + 246 * scale),
        (x + 174 * scale, y + 286 * scale),
        (x + 140 * scale, y + 334 * scale),
        (x + 14 * scale, y + 334 * scale),
        (x + 54 * scale, y + 286 * scale),
        (x + 88 * scale, y + 244 * scale),
        (x + 112 * scale, y + 210 * scale),
    ], fill=red)


def create_wordmark_texture(path: Path, mirrored: bool = False) -> Image.Image:
    image = Image.new("RGBA", (3200, 580), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    title_font = _italic_title_font(238)
    title_color = (70, 73, 76, 255)
    if mirrored:
        draw.text((44, 112), "American Eagle", font=title_font, fill=title_color,
                  stroke_width=1)
        _draw_flight_symbol(draw, 2870, 108, 0.92)
    else:
        _draw_flight_symbol(draw, 24, 108, 0.92)
        draw.text((292, 112), "American Eagle", font=title_font, fill=title_color,
                  stroke_width=1)
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
    image = Image.new("RGBA", (1200, 260), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    reg_font = _italic_title_font(126)
    if mirrored:
        draw.text((36, 42), "N466AW", font=reg_font, fill=(62, 67, 72, 255))
        _draw_us_flag(draw, 930, 66, 210, 112)
    else:
        _draw_us_flag(draw, 40, 66, 210, 112)
        draw.text((300, 42), "N466AW", font=reg_font, fill=(62, 67, 72, 255))
    image.save(path)
    return image


def create_aft_sweep_texture(path: Path, mirrored: bool = False) -> Image.Image:
    """Transparent red tailcone bands visible in the supplied rear-quarter references."""
    width, height = 2400, 900
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    red = (197, 30, 46, 255)
    deep_red = (177, 25, 39, 255)

    # Upper wedge grows toward the tail root.
    draw.polygon([
        (220, 250), (760, 226), (width, 70), (width, 330), (980, 420), (420, 382)
    ], fill=red)
    # Lower longitudinal band and dark lower edge.
    draw.polygon([
        (0, 590), (width, 410), (width, 690), (0, 770)
    ], fill=red)
    draw.polygon([
        (0, 748), (width, 650), (width, 752), (0, 842)
    ], fill=deep_red)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Rebuild the fin texture. Colored feathers terminate around a stepped silver eagle
# channel rather than meeting at the incorrect straight white divider used previously.
start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + '''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2600, 3000
    silver = (222, 225, 228, 255)
    bright_silver = (239, 240, 241, 255)
    blue = (18, 67, 119, 255)
    red = (194, 31, 47, 255)
    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)
    center = width * 0.51
    pitch = 232
    thickness = 116
    slant = 300

    for index in range(14):
        y0 = index * pitch - 180
        y1 = y0 + thickness
        tip = 118 if index % 2 == 0 else 72

        # Blue forward feather with a pointed inner tip.
        draw.polygon([
            (-340, y0 + slant),
            (center + tip, y0 - 10),
            (center - 42, y1 + 12),
            (-340, y1 + slant),
        ], fill=blue)

        # Red aft feather. Its inner edge is offset from the blue feather so the
        # remaining silver gap forms the stepped eagle silhouette.
        draw.polygon([
            (center + 42, y0 + 10),
            (width + 340, y0 - slant),
            (width + 340, y1 - slant),
            (center - tip, y1 - 12),
        ], fill=red)

    # Reference-shaped silver/white negative-space eagle channel. The alternating
    # bends keep it narrow while avoiding the prior ruler-straight center stripe.
    channel = [
        (center - 54, -120), (center + 54, -120),
        (center + 112, 240), (center + 18, 505),
        (center + 104, 770), (center + 8, 1035),
        (center + 96, 1300), (center - 2, 1565),
        (center + 84, 1830), (center - 14, 2095),
        (center + 72, 2360), (center - 24, 2630),
        (center + 54, 3120), (center - 78, 3120),
        (center - 146, 2630), (center - 66, 2360),
        (center - 158, 2095), (center - 76, 1830),
        (center - 170, 1565), (center - 88, 1300),
        (center - 180, 1035), (center - 98, 770),
        (center - 188, 505), (center - 106, 240),
    ]
    draw.polygon(channel, fill=bright_silver)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Use a denser swept fin-following decal surface.
start = source.index("def flat_tail_decal(")
end = source.index("\n\ndef add_livery", start)
source = source[:start] + '''def flat_tail_decal(texture: Image.Image, name: str, side: int, z_front: float, z_rear: float,
                        y_bottom: float, y_top: float, x_offset: float, mirror_uv: bool) -> trimesh.Trimesh:
    nz, ny = 52, 60
    vertices, uv = [], []
    for row in range(ny + 1):
        v = row / ny
        y = y_bottom + (y_top - y_bottom) * v
        row_front = z_front - 3.22 * v
        row_rear = z_rear - 1.24 * v
        x = side * (x_offset * (1.0 - 0.16 * v) + 0.016)
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
                           metallicFactor=0.12, roughnessFactor=0.25,
                           alphaMode="OPAQUE", doubleSided=False)
    mesh = trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces), process=False)
    mesh.visual = TextureVisuals(uv=np.asarray(uv), material=material)
    return mesh


def tapered_curved_decal_mesh(texture: Image.Image, name: str, side: int,
                              z_nose: float, z_tail: float, center_y: float,
                              radius_nose: float, radius_tail: float, height: float,
                              horizontal_segments: int = 64, vertical_segments: int = 18,
                              offset: float = 0.022, mirror_uv: bool = False) -> trimesh.Trimesh:
    """Curve an aft-fuselage decal around a tapering tailcone."""
    vertices, uv = [], []
    for row in range(vertical_segments + 1):
        v = row / vertical_segments
        dy_fraction = v - 0.5
        for column in range(horizontal_segments + 1):
            u = column / horizontal_segments
            radius = radius_nose + (radius_tail - radius_nose) * u
            dy = dy_fraction * height * (0.96 - 0.18 * u)
            normalized = np.clip(dy / max(radius * 0.96, 1e-6), -0.84, 0.84)
            lateral = radius * math.sqrt(max(0.0, 1.0 - normalized * normalized))
            x = side * (lateral + offset)
            y = center_y + dy + 0.10 * u
            z = z_nose + (z_tail - z_nose) * u
            vertices.append((x, y, z))
            uv.append((1.0 - u if mirror_uv else u, v))
    faces = []
    columns = horizontal_segments + 1
    for row in range(vertical_segments):
        for column in range(horizontal_segments):
            a = row * columns + column
            b, c, d = a + 1, (row + 1) * columns + column, (row + 1) * columns + column + 1
            faces.extend([(a, d, c), (a, b, d)] if side > 0 else [(a, c, d), (a, d, b)])
    material = PBRMaterial(name=name, baseColorTexture=texture,
                           baseColorFactor=[1.0, 1.0, 1.0, 1.0],
                           metallicFactor=0.08, roughnessFactor=0.30,
                           alphaMode="MASK", alphaCutoff=0.04, doubleSided=False)
    mesh = trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces), process=False)
    mesh.visual = TextureVisuals(uv=np.asarray(uv), material=material)
    return mesh
''' + source[end:]

# Title, registration, and fin placement from the supplied side references.
source = source.replace(
    "title_z_nose, title_z_tail = maximum[2] - 5.0, maximum[2] - 13.0",
    "title_z_nose, title_z_tail = maximum[2] - 3.95, maximum[2] - 14.05",
)
source = source.replace(
    "center_y + 0.12, radius_x, 1.00, mirror_uv=mirror_uv",
    "center_y - 0.48, radius_x, 1.08, 64, 16, mirror_uv=mirror_uv",
)
source = source.replace(
    "center_y + 0.05, radius_x, 0.42, 24, 8, mirror_uv=mirror_uv",
    "center_y - 0.45, radius_x, 0.34, 32, 10, mirror_uv=mirror_uv",
)
source = source.replace(
    "mesh = flat_tail_decal(texture, f\"Tail_Livery_{label}\", side, minimum[2] + 0.10,\n"
    "                               minimum[2] + 4.25, minimum[1] + 4.05, maximum[1] - 0.05,\n"
    "                               0.18, mirror_uv)",
    "mesh = flat_tail_decal(texture, f\"Tail_Livery_{label}\", side, minimum[2] + 6.95,\n"
    "                               minimum[2] + 1.28, minimum[1] + 3.34, maximum[1] - 0.08,\n"
    "                               0.172, mirror_uv)",
)

# Create the aft-sweep textures alongside the existing title/registration/tail textures.
source = source.replace(
    "tail_mirror = create_tail_texture(livery_dir / \"american_tail_mirrored.png\", True)\n",
    "tail_mirror = create_tail_texture(livery_dir / \"american_tail_mirrored.png\", True)\n"
    "    aft_sweep = create_aft_sweep_texture(livery_dir / \"american_aft_sweep.png\")\n"
    "    aft_sweep_mirror = create_aft_sweep_texture(livery_dir / \"american_aft_sweep_mirrored.png\", True)\n",
)

# Insert the missing red tailcone treatment at the end of add_livery().
insert_at = source.index("\n\ndef uv_sphere")
aft_code = '''

    for side, texture, mirror_uv, label in [
        (1, aft_sweep, False, "Right"),
        (-1, aft_sweep_mirror, True, "Left"),
    ]:
        mesh = tapered_curved_decal_mesh(
            texture, f"Aft_Sweep_{label}", side,
            minimum[2] + 8.15, minimum[2] + 0.72,
            center_y - 0.20, radius_x * 0.93, 0.50, 1.48,
            mirror_uv=mirror_uv,
        )
        scene.add_geometry(mesh, geom_name=f"Aft_Sweep_{label}", node_name=f"Aft_Sweep_{label}")
'''
source = source[:insert_at] + aft_code + source[insert_at:]

path.write_text(source, encoding="utf-8")
print("Applied reference-driven American symbol, stepped tail feathers, and aft-fuselage sweep")

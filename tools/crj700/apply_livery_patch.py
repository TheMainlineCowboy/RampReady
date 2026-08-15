#!/usr/bin/env python3
"""Apply reference-matched American Eagle livery corrections before CRJ700 export."""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

source = source.replace("baseColorFactor=[1, 1, 1, 1]", "baseColorFactor=[1.0, 1.0, 1.0, 1.0]")
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
    blue = (15, 104, 170, 255)
    red = (196, 30, 48, 255)
    draw.polygon([
        (x + 34*scale, y + 18*scale), (x + 222*scale, y + 18*scale),
        (x + 190*scale, y + 48*scale), (x + 158*scale, y + 78*scale),
        (x + 126*scale, y + 112*scale), (x + 82*scale, y + 146*scale),
        (x + 14*scale, y + 146*scale), (x + 44*scale, y + 106*scale),
        (x + 72*scale, y + 78*scale), (x + 98*scale, y + 48*scale),
    ], fill=blue)
    draw.polygon([
        (x + 70*scale, y + 184*scale), (x + 132*scale, y + 184*scale),
        (x + 160*scale, y + 210*scale), (x + 224*scale, y + 210*scale),
        (x + 192*scale, y + 246*scale), (x + 164*scale, y + 284*scale),
        (x + 132*scale, y + 326*scale), (x + 16*scale, y + 326*scale),
        (x + 52*scale, y + 284*scale), (x + 82*scale, y + 244*scale),
        (x + 106*scale, y + 210*scale),
    ], fill=red)


def create_wordmark_texture(path: Path, mirrored: bool = False) -> Image.Image:
    image = Image.new("RGBA", (3200, 580), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    title_font = _italic_title_font(238)
    color = (70, 73, 76, 255)
    if mirrored:
        draw.text((44, 112), "American Eagle", font=title_font, fill=color, stroke_width=1)
        _draw_flight_symbol(draw, 2910, 116, 0.80)
    else:
        _draw_flight_symbol(draw, 28, 116, 0.80)
        draw.text((246, 112), "American Eagle", font=title_font, fill=color, stroke_width=1)
    image.save(path)
    return image


def _draw_us_flag(draw: ImageDraw.ImageDraw, x: float, y: float, width: float, height: float) -> None:
    draw.rectangle((x, y, x + width, y + height), fill=(245, 245, 245, 255))
    stripe = height / 13
    for index in range(13):
        if index % 2 == 0:
            draw.rectangle((x, y + index*stripe, x + width, y + (index + 1)*stripe), fill=(181, 30, 45, 255))
    draw.rectangle((x, y, x + width*0.42, y + stripe*7), fill=(25, 55, 105, 255))


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
    width, height = 2200, 760
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    red = (197, 30, 46, 255)
    draw.polygon([(360,250),(760,220),(width,52),(width,270),(980,372),(520,348)], fill=red)
    draw.polygon([(0,520),(width,370),(width,585),(0,650)], fill=red)
    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + '''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2600, 3000
    silver = (222, 225, 228, 255)
    bright = (239, 240, 241, 255)
    blue = (18, 67, 119, 255)
    red = (194, 31, 47, 255)
    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)
    center = width * 0.51
    pitch, thickness, slant = 360, 156, 320
    for index in range(9):
        y0 = index*pitch - 180
        y1 = y0 + thickness
        tip = 76 if index % 2 == 0 else 52
        draw.polygon([(-360,y0+slant),(center+tip,y0-6),(center-28,y1+10),(-360,y1+slant)], fill=blue)
        draw.polygon([(center+28,y0+8),(width+360,y0-slant),(width+360,y1-slant),(center-tip,y1-10)], fill=red)
    channel = [
        (center-24,-120),(center+28,-120),(center+52,380),(center+2,720),
        (center+44,1060),(center-4,1400),(center+38,1740),(center-10,2080),
        (center+32,2420),(center-18,3120),(center-62,3120),(center-86,2420),
        (center-42,2080),(center-92,1740),(center-48,1400),(center-98,1060),
        (center-54,720),(center-102,380),
    ]
    draw.polygon(channel, fill=bright)
    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

start = source.index("def flat_tail_decal(")
end = source.index("\n\ndef add_livery", start)
source = source[:start] + '''def flat_tail_decal(texture: Image.Image, name: str, side: int, z_front: float, z_rear: float,
                        y_bottom: float, y_top: float, x_offset: float, mirror_uv: bool) -> trimesh.Trimesh:
    nz, ny = 52, 60
    vertices, uv = [], []
    for row in range(ny + 1):
        v = row / ny
        y = y_bottom + (y_top - y_bottom)*v
        row_front = z_front - 3.22*v
        row_rear = z_rear - 1.24*v
        x = side*(x_offset*(1.0 - 0.16*v) + 0.016)
        for column in range(nz + 1):
            u = column / nz
            vertices.append((x, y, row_front + (row_rear - row_front)*u))
            uv.append((1.0 - u if mirror_uv else u, v))
    faces = []
    columns = nz + 1
    for row in range(ny):
        for column in range(nz):
            a = row*columns + column
            b, c, d = a + 1, (row + 1)*columns + column, (row + 1)*columns + column + 1
            faces.extend([(a,d,c),(a,b,d)] if side > 0 else [(a,c,d),(a,d,b)])
    material = PBRMaterial(name=name, baseColorTexture=texture,
                           baseColorFactor=[1.0,1.0,1.0,1.0], metallicFactor=0.12,
                           roughnessFactor=0.25, alphaMode="OPAQUE", doubleSided=False)
    mesh = trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces), process=False)
    mesh.visual = TextureVisuals(uv=np.asarray(uv), material=material)
    return mesh


def tapered_curved_decal_mesh(texture: Image.Image, name: str, side: int,
                              z_nose: float, z_tail: float, center_y: float,
                              radius_nose: float, radius_tail: float, height: float,
                              horizontal_segments: int = 64, vertical_segments: int = 18,
                              offset: float = 0.014, mirror_uv: bool = False) -> trimesh.Trimesh:
    vertices, uv = [], []
    for row in range(vertical_segments + 1):
        v = row / vertical_segments
        dy_fraction = v - 0.5
        for column in range(horizontal_segments + 1):
            u = column / horizontal_segments
            radius = radius_nose + (radius_tail - radius_nose)*u
            dy = dy_fraction*height*(0.96 - 0.18*u)
            normalized = np.clip(dy / max(radius*0.96, 1e-6), -0.84, 0.84)
            lateral = radius*math.sqrt(max(0.0, 1.0 - normalized*normalized))
            vertices.append((side*(lateral + offset), center_y + dy + 0.08*u,
                             z_nose + (z_tail - z_nose)*u))
            uv.append((1.0 - u if mirror_uv else u, v))
    faces = []
    columns = horizontal_segments + 1
    for row in range(vertical_segments):
        for column in range(horizontal_segments):
            a = row*columns + column
            b, c, d = a + 1, (row + 1)*columns + column, (row + 1)*columns + column + 1
            faces.extend([(a,d,c),(a,b,d)] if side > 0 else [(a,c,d),(a,d,b)])
    material = PBRMaterial(name=name, baseColorTexture=texture,
                           baseColorFactor=[1.0,1.0,1.0,1.0], metallicFactor=0.08,
                           roughnessFactor=0.30, alphaMode="MASK", alphaCutoff=0.04,
                           doubleSided=False)
    mesh = trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces), process=False)
    mesh.visual = TextureVisuals(uv=np.asarray(uv), material=material)
    return mesh
''' + source[end:]

source = source.replace(
    "title_z_nose, title_z_tail = maximum[2] - 5.0, maximum[2] - 13.0",
    "title_z_nose, title_z_tail = maximum[2] - 3.85, maximum[2] - 14.35",
)
source = source.replace(
    "center_y + 0.12, radius_x, 1.00, mirror_uv=mirror_uv",
    "center_y - 0.45, radius_x, 1.18, 64, 16, mirror_uv=mirror_uv",
)
source = source.replace(
    "center_y + 0.05, radius_x, 0.42, 24, 8, mirror_uv=mirror_uv",
    "center_y - 0.45, radius_x, 0.34, 32, 10, mirror_uv=mirror_uv",
)
source = source.replace(
    "mesh = flat_tail_decal(texture, f\"Tail_Livery_{label}\", side, minimum[2] + 0.10,\n"
    "                               minimum[2] + 4.25, minimum[1] + 4.05, maximum[1] - 0.05,\n"
    "                               0.18, mirror_uv)",
    "mesh = flat_tail_decal(texture, f\"Tail_Livery_{label}\", side, minimum[2] + 6.25,\n"
    "                               minimum[2] + 1.55, minimum[1] + 3.52, maximum[1] - 0.08,\n"
    "                               0.172, mirror_uv)",
)
source = source.replace(
    "tail_mirror = create_tail_texture(livery_dir / \"american_tail_mirrored.png\", True)\n",
    "tail_mirror = create_tail_texture(livery_dir / \"american_tail_mirrored.png\", True)\n"
    "    aft_sweep = create_aft_sweep_texture(livery_dir / \"american_aft_sweep.png\")\n"
    "    aft_sweep_mirror = create_aft_sweep_texture(livery_dir / \"american_aft_sweep_mirrored.png\", True)\n",
)

insert_at = source.index("\n\ndef uv_sphere")
aft_code = '''

    for side, texture, mirror_uv, label in [
        (1, aft_sweep, False, "Right"),
        (-1, aft_sweep_mirror, True, "Left"),
    ]:
        mesh = tapered_curved_decal_mesh(
            texture, f"Aft_Sweep_{label}", side,
            minimum[2] + 5.85, minimum[2] + 0.88,
            center_y + 0.02, radius_x*0.80, 0.34, 0.92,
            mirror_uv=mirror_uv,
        )
        scene.add_geometry(mesh, geom_name=f"Aft_Sweep_{label}", node_name=f"Aft_Sweep_{label}")
'''
source = source[:insert_at] + aft_code + source[insert_at:]

path.write_text(source, encoding="utf-8")
print("Applied refined American symbol, nine-band tail, and compact aft sweep")

#!/usr/bin/env python3
"""V19: final reference-driven American tail spacing and sweep correction.

V18 is physically mapped to the real fin and rudder, but its exported side view remains
too dense and too shallow. This pass keeps the same embedded UV workflow while using
fewer, broader flag feathers, wider polished-silver gaps, and substantially stronger
texture-space rise so the actual GLB reads like the supplied American Eagle references.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + r'''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 3000, 3400
    silver = (207, 212, 217, 255)
    bright_silver = (239, 240, 241, 255)
    red = (193, 30, 47, 255)
    blue = (20, 73, 128, 255)
    navy = (13, 47, 91, 255)

    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)

    # The fin UVs flatten diagonal artwork in the exported GLB. A deliberately large
    # texture-space rise produces the reference-like sweep in the rendered side view.
    rise = 3400
    pitch = 430
    thickness = 165
    start_y = -2050
    colors = [navy, red, blue, red, navy, red, blue, red, navy]

    for index, color in enumerate(colors):
        y0 = start_y + index * pitch
        y1 = y0 + thickness
        draw.polygon([
            (-1000, y0 + rise),
            (width + 1000, y0 - rise),
            (width + 1000, y1 - rise),
            (-1000, y1 + rise),
        ], fill=color)

        # Reference aircraft retain a clearly visible polished silver interval between
        # colored feathers. Keep this wider than v18 instead of producing a barcode.
        sy0 = y1 + 52
        sy1 = sy0 + 76
        draw.polygon([
            (-1000, sy0 + rise),
            (width + 1000, sy0 - rise),
            (width + 1000, sy1 - rise),
            (-1000, sy1 + rise),
        ], fill=bright_silver)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Preserve a polished painted-metal response on the actual fin and rudder materials.
source = source.replace(
    'metallicFactor=0.58,\n            roughnessFactor=0.16,',
    'metallicFactor=0.62,\n            roughnessFactor=0.15,',
)

path.write_text(source, encoding="utf-8")
print("Applied v19 final tail sweep and polished-silver spacing correction")

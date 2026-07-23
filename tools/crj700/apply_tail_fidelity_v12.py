#!/usr/bin/env python3
"""High-fidelity American Eagle tail treatment for the actual CRJ700 fin and rudder.

Runs after v11. The texture is mapped only to the real stabilizer/rudder geometry by the
existing shared UV pass. This replaces the coarse full-width bars with a denser abstract
American-flag pattern: tapered red and blue diagonal feathers separated by exposed polished
metal, with clean trailing-edge termination and no support/decal geometry.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")
start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)

replacement = r'''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 3200, 3600
    silver = (202, 207, 212, 255)
    highlight = (238, 240, 242, 255)
    red = (184, 25, 44, 255)
    blue = (20, 63, 112, 255)
    deep_blue = (13, 42, 79, 255)
    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)

    # Dense modern-American flag rhythm. Each feather tapers toward the fin leading edge,
    # broadens toward the rudder, and sweeps upward aft. Metallic gaps remain visible as
    # part of the aircraft skin rather than being painted white rectangles.
    count = 15
    pitch = 235
    thickness = 112
    sweep = 520
    for index in range(count):
        center = 160 + index * pitch
        y0 = center - thickness / 2
        y1 = center + thickness / 2
        # Alternating red and blue with subtle darker-blue cadence, matching the modern
        # tail's layered flag appearance rather than simple two-color zebra bars.
        color = red if index % 2 == 0 else (deep_blue if index % 4 == 3 else blue)
        lead_x = 210 + index * 34
        trail_x = width + 180
        taper = 190
        draw.polygon([
            (lead_x, y0 + sweep),
            (trail_x, y0 - sweep),
            (trail_x, y1 - sweep),
            (lead_x + taper, y1 + sweep),
        ], fill=color)

        # Fine polished separator accent below each colored feather. It follows the same
        # taper and sweep, avoiding the broad white bars visible in previous artifacts.
        sy0 = y1 + 28
        sy1 = sy0 + 20
        draw.polygon([
            (lead_x + 35, sy0 + sweep),
            (trail_x, sy0 - sweep),
            (trail_x, sy1 - sweep),
            (lead_x + taper + 35, sy1 + sweep),
        ], fill=highlight)

    # Dark polished cap at the upper tip, kept narrow so it follows the reference fin cap.
    draw.polygon([(1180, 0), (width, 0), (width, 105), (1110, 225)], fill=deep_blue)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
'''
source = source[:start] + replacement + source[end:]

# Tail paint should respond like polished aircraft finish, not matte signage.
source = source.replace(
    'metallicFactor=0.10,\n            roughnessFactor=0.27,',
    'metallicFactor=0.42,\n            roughnessFactor=0.24,'
)

path.write_text(source, encoding="utf-8")
print("Applied v12 tapered modern-American flag tail directly to real fin/rudder UVs")

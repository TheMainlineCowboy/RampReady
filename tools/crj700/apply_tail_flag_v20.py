#!/usr/bin/env python3
"""V20: full-fin American tail coverage and spacing correction.

V19 produced acceptable diagonal direction but only intersected the upper portion of the
physical fin. This pass generates enough alternating red/blue feathers to cover the entire
UV domain, keeps polished aluminum gaps, and retains direct mapping to the real fin/rudder.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + r'''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 3200, 3600
    silver = (203, 208, 214, 255)
    bright_silver = (240, 241, 242, 255)
    red = (194, 30, 47, 255)
    blue = (22, 79, 137, 255)
    navy = (13, 48, 91, 255)

    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)

    # The exported fin UVs compress diagonal artwork. Draw a complete repeating field
    # from well above to well below the texture so every point on the real fin and rudder
    # receives the red/blue American flag rhythm instead of leaving a blank lower panel.
    rise = 3150
    pitch = 410
    thickness = 190
    gap = pitch - thickness
    colors = [navy, red, blue, red]

    index = 0
    base = -rise - pitch
    while base < height + rise + pitch:
        color = colors[index % len(colors)]
        y0 = base
        y1 = y0 + thickness
        draw.polygon([
            (-1200, y0 + rise),
            (width + 1200, y0 - rise),
            (width + 1200, y1 - rise),
            (-1200, y1 + rise),
        ], fill=color)

        # A polished-metal separator follows each feather at the same sweep. This is
        # deliberately wide enough to remain visible at ramp distance without reading
        # as a dense barcode.
        sy0 = y1 + max(24, gap * 0.24)
        sy1 = sy0 + max(58, gap * 0.34)
        draw.polygon([
            (-1200, sy0 + rise),
            (width + 1200, sy0 - rise),
            (width + 1200, sy1 - rise),
            (-1200, sy1 + rise),
        ], fill=bright_silver)
        base += pitch
        index += 1

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Preserve a polished painted-metal response on the actual fin and rudder.
source = source.replace(
    'metallicFactor=0.62,\n            roughnessFactor=0.15,',
    'metallicFactor=0.66,\n            roughnessFactor=0.14,',
)

path.write_text(source, encoding="utf-8")
print("Applied v20 full-fin American tail coverage and spacing correction")

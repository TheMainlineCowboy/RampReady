#!/usr/bin/env python3
"""Reference-alignment pass for the actual American Eagle CRJ700 GLB.

Corrects defects visible in commit 8120763's direct Three.js artifact:
- forward flight symbol was oversized and sat across the passenger door;
- title panel was too tall and too far forward;
- tail feather pixels still reached the edge of the support surface at the root.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

# Rebuild the title texture with a reference-sized symbol and tighter wordmark spacing.
start = source.index("def create_wordmark_texture(")
end = source.index("\n\ndef _draw_us_flag", start)
source = source[:start] + '''def create_wordmark_texture(path: Path, mirrored: bool = False) -> Image.Image:
    image = Image.new("RGBA", (3000, 560), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    title_font = _italic_title_font(246)
    title_color = (69, 72, 75, 255)
    symbol_scale = 0.76
    if mirrored:
        draw.text((42, 120), "American Eagle", font=title_font,
                  fill=title_color, stroke_width=1)
        _draw_flight_symbol(draw, 2745, 106, symbol_scale)
    else:
        _draw_flight_symbol(draw, 24, 106, symbol_scale)
        draw.text((252, 120), "American Eagle", font=title_font,
                  fill=title_color, stroke_width=1)
    image.save(path)
    return image
''' + source[end:]

# Replace the fin texture with a strictly clipped trapezoid.  The transparent inset
# prevents colored pixels from projecting past the physical leading/trailing edges.
start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + '''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2600, 3000
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    paint = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(paint)
    blue = (18, 68, 120, 255)
    red = (194, 31, 47, 255)
    dark_cap = (50, 52, 55, 255)

    # Seven broad feather rows with metallic gaps supplied by the real fin material.
    centers = [360, 760, 1160, 1560, 1960, 2360, 2760]
    thickness = 150
    slant = 105
    for center_y in centers:
        y0, y1 = center_y - thickness/2, center_y + thickness/2
        split = width * (0.47 + 0.11 * (center_y / height))
        gap = 44
        draw.polygon([(-180, y0 + slant), (split-gap, y0-8),
                      (split-gap-42, y1+10), (-180, y1+slant)], fill=red)
        draw.polygon([(split+gap+42, y0-10), (width+180, y0-slant),
                      (width+180, y1-slant), (split+gap, y1+8)], fill=blue)
    draw.polygon([(360, 95), (2220, 95), (2140, 250), (430, 320)], fill=dark_cap)

    # Conservative fin silhouette in texture space, inset on every edge.
    mask = Image.new("L", (width, height), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.polygon([
        (615, 260),   # top leading edge
        (2065, 210),  # top trailing edge
        (2350, 2860), # root trailing edge
        (300, 2860),  # root leading edge
    ], fill=255)
    # Slight blur-free inset is deliberate: no antialias fringe or floating slivers.
    paint.putalpha(Image.composite(paint.getchannel("A"), Image.new("L", (width, height), 0), mask))
    image.alpha_composite(paint)
    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Move the title aft of the forward door and reduce panel height to match the reference.
source = source.replace(
    "title_z_nose, title_z_tail = maximum[2] - 3.85, maximum[2] - 14.35",
    "title_z_nose, title_z_tail = maximum[2] - 5.05, maximum[2] - 14.65",
)
source = source.replace(
    "center_y - 0.45, radius_x, 1.18, 64, 16, mirror_uv=mirror_uv",
    "center_y - 0.48, radius_x, 0.96, 64, 16, mirror_uv=mirror_uv",
)

path.write_text(source, encoding="utf-8")
print("Applied v6 reference alignment: smaller symbol, aft title, clipped fin feathers")

#!/usr/bin/env python3
"""Final reference-driven refinement pass for the American Eagle CRJ700.

Runs after apply_livery_patch.py and replaces only the remaining inaccurate
flight-symbol and vertical-fin generators. The uploaded references show a narrow,
swept two-feather American mark and alternating full-fin diagonal bands rather
than an artificial red/blue split with a center wedge.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

# Refine the forward flight symbol while preserving the existing italic wordmark,
# registration, flag, and aft-fuselage sweep implementations.
start = source.index("def _draw_flight_symbol(")
end = source.index("\n\ndef create_wordmark_texture", start)
source = source[:start] + '''def _draw_flight_symbol(draw: ImageDraw.ImageDraw, x: float, y: float, scale: float = 1.0) -> None:
    """Slender modern American flight symbol reconstructed from supplied references."""
    blue = (20, 105, 169, 255)
    red = (196, 30, 48, 255)

    # Upper feather: compact root, long swept upper edge, narrow pointed lower tip.
    draw.polygon([
        (x + 34 * scale, y + 18 * scale),
        (x + 238 * scale, y + 18 * scale),
        (x + 202 * scale, y + 49 * scale),
        (x + 166 * scale, y + 78 * scale),
        (x + 126 * scale, y + 112 * scale),
        (x + 82 * scale, y + 145 * scale),
        (x + 12 * scale, y + 145 * scale),
        (x + 43 * scale, y + 105 * scale),
        (x + 72 * scale, y + 76 * scale),
        (x + 101 * scale, y + 47 * scale),
    ], fill=blue)

    # Lower feather: offset downward with transparent negative space between feathers.
    draw.polygon([
        (x + 72 * scale, y + 186 * scale),
        (x + 134 * scale, y + 186 * scale),
        (x + 164 * scale, y + 214 * scale),
        (x + 238 * scale, y + 214 * scale),
        (x + 204 * scale, y + 248 * scale),
        (x + 172 * scale, y + 286 * scale),
        (x + 138 * scale, y + 330 * scale),
        (x + 14 * scale, y + 330 * scale),
        (x + 52 * scale, y + 286 * scale),
        (x + 84 * scale, y + 246 * scale),
        (x + 108 * scale, y + 214 * scale),
    ], fill=red)
''' + source[end:]

# Replace the previous split-field fin with full-width alternating diagonal bands.
# This matches the repeated rear-quarter references: dark cap, then red/silver/blue
# bands crossing the entire fin at a consistent sweep angle.
start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + '''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2600, 3000
    silver = (223, 226, 229, 255)
    bright_silver = (239, 240, 241, 255)
    navy = (20, 56, 101, 255)
    blue = (27, 86, 143, 255)
    red = (193, 31, 47, 255)
    dark_cap = (42, 44, 47, 255)

    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)

    # Top cap beneath the horizontal stabilizer.
    draw.polygon([(0, 0), (width, 0), (width, 240), (0, 420)], fill=dark_cap)

    # Reference stripe rhythm from top to bottom. Silver bands remain exposed between
    # colored feathers and preserve the polished-metal appearance of the real tail.
    colors = [red, bright_silver, blue, bright_silver, red, bright_silver,
              navy, bright_silver, red, bright_silver, blue, bright_silver,
              red, bright_silver, navy]
    pitch = 186
    thickness = 102
    slant = 325
    start_y = 160
    for index, color in enumerate(colors):
        y0 = start_y + index * pitch
        y1 = y0 + thickness
        draw.polygon([
            (-420, y0 + slant),
            (width + 420, y0 - slant),
            (width + 420, y1 - slant),
            (-420, y1 + slant),
        ], fill=color)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

path.write_text(source, encoding="utf-8")
print("Applied final reference-matched flight symbol and full-width tail bands")

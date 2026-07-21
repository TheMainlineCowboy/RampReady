#!/usr/bin/env python3
"""Final side-orientation and tail-pattern correction for the real CRJ700 GLB.

Runs after v10. It fixes the still-mirrored port-side wordmark by pre-flipping the
texture while keeping the physical UV direction unchanged, moves the titles clear
of the forward entry door, and replaces the nearly horizontal tail bars with a
more strongly swept modern American red/silver/blue stripe sequence mapped directly
onto the real fin and rudder geometry.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

# The port mesh's geometry-derived U direction is opposite the starboard mesh. Use
# a pre-flipped image on port, but do not also mirror the UVs.
start = source.index("def create_wordmark_texture(")
end = source.index("\n\ndef _draw_us_flag", start)
block = source[start:end]
block = block.replace(
    "    image.save(path)\n    return image",
    "    if mirrored:\n        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)\n    image.save(path)\n    return image",
)
source = source[:start] + block + source[end:]

start = source.index("def create_registration_texture(")
end = source.index("\n\ndef create_aft_sweep_texture", start)
block = source[start:end]
if "if mirrored:" not in block:
    block = block.replace(
        "    image.save(path)\n    return image",
        "    if mirrored:\n        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)\n    image.save(path)\n    return image",
    )
source = source[:start] + block + source[end:]

source = source.replace(
    'for side, texture, mirror_uv, label in [(1, word, False, "Right"), (-1, word, False, "Left")]:',
    'for side, texture, mirror_uv, label in [(1, word, False, "Right"), (-1, word_mirror, False, "Left")]:',
)
source = source.replace(
    'for side, texture, mirror_uv, label in [(1, registration, False, "Right"), (-1, registration, False, "Left")]:',
    'for side, texture, mirror_uv, label in [(1, registration, False, "Right"), (-1, registration_mirror, False, "Left")]:',
)

# Keep the complete logo/title panel aft of the forward entry door.
source = source.replace(
    'title_z_nose, title_z_tail = maximum[2] - 4.55, maximum[2] - 14.15',
    'title_z_nose, title_z_tail = maximum[2] - 5.35, maximum[2] - 14.20',
)
source = source.replace(
    'center_y - 0.52, radius_x, 0.96, 64, 16, mirror_uv=mirror_uv',
    'center_y - 0.50, radius_x, 0.88, 72, 16, mirror_uv=mirror_uv',
)

# Rebuild the embedded fin texture as a strongly swept alternating sequence. The
# mesh boundary itself clips the paint, so there is no floating support geometry.
start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + r'''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2600, 3000
    silver = (215, 219, 223, 255)
    bright = (238, 239, 240, 255)
    red = (194, 31, 47, 255)
    blue = (18, 68, 120, 255)
    navy = (14, 48, 91, 255)
    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)

    # Modern American tail rhythm: alternating colored feathers and metallic gaps,
    # swept sharply upward toward the trailing edge. Twelve colored bands provide
    # the dense but readable pattern visible in the supplied side/rear references.
    colors = [red, blue, red, navy, red, blue, red, navy, red, blue, red, navy]
    pitch = 248
    thickness = 112
    slant = 430
    start_y = -150
    for index, color in enumerate(colors):
        y0 = start_y + index * pitch
        y1 = y0 + thickness
        draw.polygon([
            (-500, y0 + slant),
            (width + 500, y0 - slant),
            (width + 500, y1 - slant),
            (-500, y1 + slant),
        ], fill=color)
        # Narrow bright metallic separator directly below every colored feather.
        sy0 = y1 + 34
        sy1 = sy0 + 34
        draw.polygon([
            (-500, sy0 + slant),
            (width + 500, sy0 - slant),
            (width + 500, sy1 - slant),
            (-500, sy1 + slant),
        ], fill=bright)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

path.write_text(source, encoding="utf-8")
print("Applied v11: readable port branding, door clearance, swept American tail stripes")

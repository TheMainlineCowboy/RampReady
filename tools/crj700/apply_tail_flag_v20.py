#!/usr/bin/env python3
"""Final consolidated tail texture stage.

Replace the earlier repeating stripe field with a finite, tapered American Eagle
flight-symbol layout mapped directly onto the real fin and rudder UV material.
The decal background and inter-feather gaps remain transparent so the actual
metallic fin is visible and the overlay cannot create a floating rectangular panel.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + r'''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 3200, 3600
    transparent = (0, 0, 0, 0)
    red = (190, 28, 46, 255)
    blue = (25, 79, 139, 255)
    navy = (17, 48, 89, 255)

    # The real fin material supplies the polished metallic silver.  Keeping the
    # decal transparent everywhere except the colored feathers prevents the old
    # opaque rectangular "billboard" from showing beyond the fin/rudder silhouette.
    image = Image.new("RGBA", (width, height), transparent)
    draw = ImageDraw.Draw(image)

    # Finite broad, tapered feathers.  The source fin UVs shear and compress the
    # artwork, so polygons intentionally overscan the texture edges.
    feathers = [
        # (center_y, thickness_left, thickness_right, color)
        (-430, 150, 270, navy),
        (  10, 165, 290, red),
        ( 470, 175, 305, blue),
        ( 950, 185, 320, red),
        (1450, 195, 335, blue),
        (1970, 205, 350, red),
        (2510, 215, 365, blue),
        (3070, 225, 380, red),
        (3650, 235, 395, blue),
    ]

    sweep = 2380
    left_x = -900
    right_x = width + 1000

    for center, left_thickness, right_thickness, color in feathers:
        left_center = center + sweep
        right_center = center - sweep
        draw.polygon([
            (left_x, left_center - left_thickness),
            (right_x, right_center - right_thickness),
            (right_x, right_center + right_thickness),
            (left_x, left_center + left_thickness),
        ], fill=color)

        # Cut a transparent gap after each feather.  The underlying polished fin,
        # rather than an opaque white texture, becomes the separator.
        separator_left = max(46, int(left_thickness * 0.34))
        separator_right = max(72, int(right_thickness * 0.34))
        draw.polygon([
            (left_x, left_center + left_thickness + 34),
            (right_x, right_center + right_thickness + 40),
            (right_x, right_center + right_thickness + 40 + separator_right),
            (left_x, left_center + left_thickness + 34 + separator_left),
        ], fill=transparent)

    # Mirror once at texture generation time; do not double-mirror decal geometry.
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
print("Applied transparent consolidated American Eagle tail texture")

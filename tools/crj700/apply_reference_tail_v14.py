#!/usr/bin/env python3
"""Final reference-driven American Eagle CRJ700 tail correction.

Replaces the upper-blue/lower-red horizontal-band result with the actual modern
American flag treatment: broad, continuous diagonal red/white/blue bands swept
across the full physical fin and rudder. It also removes the inaccurate floating
aft-fuselage red wedges visible in v13 QA.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + r'''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 3200, 3200
    silver = (218, 222, 226, 255)
    bright = (244, 245, 246, 255)
    red = (193, 31, 47, 255)
    blue = (19, 66, 116, 255)
    navy = (13, 47, 88, 255)

    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)

    # True modern American tail rhythm: alternating red, white/silver and blue
    # diagonal bands spanning the full fin. The steep rise across chord is required
    # because U maps along the fin chord and V maps vertically on the real geometry.
    colors = [navy, bright, blue, bright, red, bright, red, bright,
              blue, bright, red, bright, navy, bright, red]
    pitch = 315
    thickness = 175
    rise = 1500
    start_y = -620
    for index, color in enumerate(colors):
        y0 = start_y + index * pitch
        y1 = y0 + thickness
        draw.polygon([
            (-900, y0 + rise),
            (width + 900, y0 - rise),
            (width + 900, y1 - rise),
            (-900, y1 + rise),
        ], fill=color)

    # Keep a narrow dark leading cap beneath the horizontal stabilizer only.
    draw.polygon([(0, 0), (width, 0), (width, 90), (0, 170)], fill=(42, 45, 49, 255))

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Remove the visibly incorrect floating red tailcone wedges from the exported GLB.
# The real reference aircraft's identity is carried by the fin treatment; these
# procedural overlays were not conforming to the fuselage and must not ship.
needle = '''    aft = create_aft_sweep_texture(livery_dir / "american_aft_sweep.png")
    aft_mirror = create_aft_sweep_texture(livery_dir / "american_aft_sweep_mirrored.png", True)
'''
source = source.replace(needle, '')

# Remove the corresponding scene-add loop regardless of its exact tuned dimensions.
loop_start = source.find('    for side, texture, mirror_uv, label in [(1, aft, False, "Right"), (-1, aft_mirror, True, "Left")]:')
if loop_start != -1:
    next_def = source.find('\n\ndef ', loop_start)
    if next_def == -1:
        next_def = source.find('\n\n    ', loop_start + 8)
    if next_def != -1:
        source = source[:loop_start] + source[next_def:]

# Tail is painted aluminum, not plastic.
source = source.replace(
    'metallicFactor=0.30,\n            roughnessFactor=0.21,',
    'metallicFactor=0.38,\n            roughnessFactor=0.19,',
)

path.write_text(source, encoding="utf-8")
print("Applied v14 true diagonal American tail and removed floating aft wedges")

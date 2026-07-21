#!/usr/bin/env python3
"""Reference cleanup for the actual American Eagle CRJ700 GLB.

Runs after v9. Corrects the side-dependent title/registration ordering, refines the
forward flight symbol, tightens title placement, removes the oversized tailcone rails,
and strengthens the polished-metal PBR response without adding support geometry.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

# Draw the same nose-first composition for both physical sides. UVs already run from
# nose to tail on both curved decal meshes, so a second image/UV mirror reverses the
# symbol and wordmark order on the left side.
start = source.index("def create_wordmark_texture(")
end = source.index("\n\ndef _draw_us_flag", start)
source = source[:start] + r'''def create_wordmark_texture(path: Path, mirrored: bool = False) -> Image.Image:
    image = Image.new("RGBA", (3200, 600), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    title_font = _italic_title_font(246)
    title_color = (66, 69, 72, 255)

    # Modern American flight symbol: compact blue upper feather, red lower feather,
    # and a clean transparent eagle channel between them.
    blue = (15, 103, 169, 255)
    red = (196, 30, 48, 255)
    x, y, s = 42, 102, 0.92
    draw.polygon([
        (x+38*s,y+18*s),(x+250*s,y+18*s),(x+213*s,y+53*s),
        (x+174*s,y+91*s),(x+132*s,y+130*s),(x+82*s,y+168*s),
        (x+12*s,y+168*s),(x+46*s,y+124*s),(x+78*s,y+87*s),
        (x+108*s,y+52*s)
    ], fill=blue)
    draw.polygon([
        (x+80*s,y+214*s),(x+146*s,y+214*s),(x+180*s,y+244*s),
        (x+252*s,y+244*s),(x+216*s,y+282*s),(x+182*s,y+326*s),
        (x+144*s,y+374*s),(x+14*s,y+374*s),(x+58*s,y+326*s),
        (x+92*s,y+280*s),(x+120*s,y+244*s)
    ], fill=red)
    draw.text((330, 132), "American Eagle", font=title_font,
              fill=title_color, stroke_width=1)
    image.save(path)
    return image
''' + source[end:]

# The same texture and same U direction are correct on both physical sides. Face
# winding is already handled separately by curved_decal_mesh.
source = source.replace(
    'for side, texture, mirror_uv, label in [(1, word, False, "Right"), (-1, word_mirror, True, "Left")]:',
    'for side, texture, mirror_uv, label in [(1, word, False, "Right"), (-1, word, False, "Left")]:',
)
source = source.replace(
    'for side, texture, mirror_uv, label in [(1, registration, False, "Right"), (-1, registration_mirror, True, "Left")]:',
    'for side, texture, mirror_uv, label in [(1, registration, False, "Right"), (-1, registration, False, "Left")]:',
)

# Keep the title fully aft of the forward entry door and closer to the real vertical
# position beneath the window belt.
source = source.replace(
    'title_z_nose, title_z_tail = maximum[2] - 3.85, maximum[2] - 14.35',
    'title_z_nose, title_z_tail = maximum[2] - 4.55, maximum[2] - 14.15',
)
source = source.replace(
    'center_y - 0.45, radius_x, 1.18, 64, 16, mirror_uv=mirror_uv',
    'center_y - 0.52, radius_x, 0.96, 64, 16, mirror_uv=mirror_uv',
)

# Remove the two long red tailcone rails. Retain only the compact root wedge that is
# visible immediately forward of the fin in the supplied references.
start = source.index("def create_aft_sweep_texture(")
end = source.index("\n\ndef create_tail_texture", start)
source = source[:start] + r'''def create_aft_sweep_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 2200, 720
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    red = (197, 30, 46, 255)
    draw.polygon([
        (1160, 250), (width, 72), (width, 250),
        (1640, 340), (1080, 330)
    ], fill=red)
    image.save(path)
    return image
''' + source[end:]

# Stronger but still believable polished-aluminum response.
source = source.replace(
    'silver = make_material("American Eagle metallic silver", (0.70, 0.73, 0.77, 1.0), 0.72, 0.18)',
    'silver = make_material("American Eagle metallic silver", (0.68, 0.71, 0.75, 1.0), 0.78, 0.16)',
)
source = source.replace(
    'silver_light = make_material("Painted silver", (0.80, 0.82, 0.85, 1.0), 0.58, 0.23)',
    'silver_light = make_material("Painted silver", (0.77, 0.79, 0.82, 1.0), 0.62, 0.21)',
)

path.write_text(source, encoding="utf-8")
print("Applied v10 reference cleanup: side-correct branding, compact tailcone, polished metal")

#!/usr/bin/env python3
"""Steepen and clean the real American Airlines tail treatment.

V16 finally placed blue on the physical leading half and red on the rudder half, but
visual QA still showed near-horizontal zebra bars and inherited source paint on the
horizontal stabilizer. This pass uses fewer, broader, sharply swept paired feathers,
removes the false dark cap, and forces the horizontal tail/elevators back to metallic
silver so only the vertical fin carries the flag treatment.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + r'''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 3600, 3600
    silver = (205, 211, 217, 255)
    bright = (242, 243, 244, 255)
    red = (191, 29, 47, 255)
    blue = (22, 76, 132, 255)
    navy = (12, 49, 91, 255)

    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)

    # Eight broad paired feathers. A much larger vertical rise is required because the
    # real fin UV frame compresses texture slope in the final side render.
    rows = [260, 690, 1120, 1550, 1980, 2410, 2840, 3270]
    thickness = 190
    rise = 1050
    for index, center_y in enumerate(rows):
        y0 = center_y - thickness / 2
        y1 = center_y + thickness / 2

        # The center boundary moves slightly aft toward the root, as on the references.
        fraction = 0.49 + 0.055 * (center_y / height)
        split_top = width * fraction
        split_bottom = split_top - 90
        channel = 56

        # Aft/rudder red feather, tapered toward the metallic eagle channel.
        draw.polygon([
            (-720, y0 + rise),
            (split_top - channel, y0 - 26),
            (split_bottom - channel - 90, y1 + 30),
            (-720, y1 + rise),
        ], fill=red)

        # Forward/leading-edge blue feather. Alternate navy rows create the proper
        # red-white-blue rhythm without turning the tail into equal-width zebra bars.
        blue_color = navy if index in (0, 3, 6) else blue
        draw.polygon([
            (split_top + channel + 90, y0 - 30),
            (width + 720, y0 - rise),
            (width + 720, y1 - rise),
            (split_bottom + channel, y1 + 26),
        ], fill=blue_color)

        # Exposed polished-metal separator following the same steep sweep.
        sy0 = y1 + 38
        sy1 = sy0 + 42
        draw.polygon([
            (-700, sy0 + rise),
            (width + 700, sy0 - rise),
            (width + 700, sy1 - rise),
            (-700, sy1 + rise),
        ], fill=bright)

    # Narrow swept metallic channel between the red and blue fields.
    left, right = [], []
    for step in range(15):
        y = -220 + step * 290
        clamped = max(0.0, min(1.0, y / height))
        x = width * (0.49 + 0.055 * clamped)
        left.append((x - 34, y))
        right.append((x + 34, y))
    draw.polygon(left + list(reversed(right)), fill=bright)

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# The source model carries legacy livery texture fragments on the horizontal tail.
# Force those meshes to polished silver before the generic "preserve texture" branch.
needle = '''        current = getattr(mesh.visual, "material", None)\n        has_texture = current is not None and getattr(current, "baseColorTexture", None) is not None\n        if has_texture:\n'''
replacement = '''        current = getattr(mesh.visual, "material", None)\n        has_texture = current is not None and getattr(current, "baseColorTexture", None) is not None\n        if any(word in lower_name for word in ["hstab", "horizontal_stabilizer", "elevator"]):\n            mesh.visual = TextureVisuals(material=silver)\n            continue\n        if has_texture:\n'''
if needle not in source:
    raise RuntimeError("Could not locate standardize_materials texture-preservation branch")
source = source.replace(needle, replacement, 1)

# Final embedded-fin material response.
source = source.replace(
    'metallicFactor=0.48,\n            roughnessFactor=0.16,',
    'metallicFactor=0.52,\n            roughnessFactor=0.15,',
)

path.write_text(source, encoding="utf-8")
print("Applied v17: steep paired tail feathers and clean metallic horizontal tail")

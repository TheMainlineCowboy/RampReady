#!/usr/bin/env python3
"""Reference-driven American Airlines tail treatment for the real CRJ700 fin.

V15 was physically stable but still read as blue-over-red zebra striping. The supplied
references show the modern American tail as paired diagonal feathers: blue concentrated
on the forward half of the fin, red on the aft half, separated by a narrow swept metallic
channel. This pass keeps the artwork on the actual stabilizer and rudder UVs.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

start = source.index("def create_tail_texture(")
end = source.index("\n\ndef curved_decal_mesh", start)
source = source[:start] + r'''def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 3600, 3600
    silver = (208, 214, 220, 255)
    bright = (241, 243, 245, 255)
    red = (194, 30, 48, 255)
    blue = (20, 73, 128, 255)
    navy = (11, 48, 91, 255)

    image = Image.new("RGBA", (width, height), silver)
    draw = ImageDraw.Draw(image)

    # Geometry-derived U follows the fin fore/aft axis. On the exported CRJ700 the
    # forward/leading half is the right side of this texture; the aft/rudder half is left.
    # The center boundary sweeps slightly aft as it descends, matching the references.
    rows = [250, 610, 970, 1330, 1690, 2050, 2410, 2770, 3130, 3450]
    thickness = 150
    rise = 330
    for index, center_y in enumerate(rows):
        y0 = center_y - thickness / 2
        y1 = center_y + thickness / 2
        split_top = width * (0.46 + 0.055 * (center_y / height))
        split_bottom = split_top - 64
        channel = 42

        # Aft red feather, tapered to the swept center channel.
        draw.polygon([
            (-260, y0 + rise),
            (split_top - channel, y0 - 8),
            (split_bottom - channel - 48, y1 + 12),
            (-260, y1 + rise),
        ], fill=red)

        # Forward blue feather. Darker navy rows add the real flag rhythm without
        # creating broad artificial blocks.
        blue_color = navy if index in (0, 4, 8) else blue
        draw.polygon([
            (split_top + channel + 48, y0 - 12),
            (width + 260, y0 - rise),
            (width + 260, y1 - rise),
            (split_bottom + channel, y1 + 8),
        ], fill=blue_color)

        # Fine bright-metal highlight below each paired feather row.
        sy = y1 + 30
        draw.line([(-180, sy + rise), (width + 180, sy - rise)], fill=bright, width=32)

    # A narrow swept metallic/eagle channel between red and blue fields.
    channel_points = []
    for step in range(13):
        y = -120 + step * 320
        x = width * (0.46 + 0.055 * max(0.0, min(1.0, y / height)))
        channel_points.append((x - 24, y))
    for step in reversed(range(13)):
        y = -120 + step * 320
        x = width * (0.46 + 0.055 * max(0.0, min(1.0, y / height)))
        channel_points.append((x + 24, y))
    draw.polygon(channel_points, fill=bright)

    # Dark aerodynamic cap immediately below the horizontal stabilizer.
    draw.polygon([(0, 0), (width, 0), (width, 72), (0, 140)], fill=(39, 43, 47, 255))

    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image
''' + source[end:]

# Final metallic response for the embedded stabilizer/rudder material.
source = source.replace(
    'metallicFactor=0.44,\n            roughnessFactor=0.17,',
    'metallicFactor=0.48,\n            roughnessFactor=0.16,',
)

path.write_text(source, encoding="utf-8")
print("Applied v16 split American tail: forward blue, aft red, swept metallic channel")

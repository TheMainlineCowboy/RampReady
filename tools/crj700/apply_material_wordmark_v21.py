#!/usr/bin/env python3
"""Reference correction v21: polished silver response and side-only title mapping.

The real-GLB QA showed that the source airframe textures were bypassing the
standard silver material and stayed nearly white. It also showed the American
Eagle title wrapping under the belly because its curved decal was centered too
low. This patch tints only textured exterior airframe groups toward polished
aluminum, while preserving glass/tires/gear, and raises/tightens the title to the
true fuselage side band.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

replacements = {
    'silver = make_material("American Eagle metallic silver", (0.78, 0.80, 0.82, 1.0), 0.46, 0.29)':
        'silver = make_material("American Eagle polished metallic silver", (0.64, 0.68, 0.73, 1.0), 0.70, 0.22)',
    'silver_light = make_material("Painted silver", (0.88, 0.89, 0.90, 1.0), 0.32, 0.34)':
        'silver_light = make_material("Painted silver", (0.75, 0.79, 0.84, 1.0), 0.46, 0.28)',
    'center_y - 0.48, radius_x, 0.96, 64, 16, mirror_uv=mirror_uv)':
        'center_y + 0.16, radius_x, 0.54, 64, 12, mirror_uv=mirror_uv)',
    '''        if has_texture:\n            try:\n                current.metallicFactor = 0.30\n                current.roughnessFactor = 0.34\n            except Exception:\n                pass\n            continue''':
        '''        if has_texture:\n            try:\n                exterior = any(word in lower_name for word in [\n                    "fuselage", "belly", "wing", "vstab", "hstab", "rudder",\n                    "elevator", "aileron", "flap", "spoiler", "door", "nacelle"\n                ])\n                excluded = any(word in lower_name for word in [\n                    "window", "glass", "windscreen", "windshield", "tire",\n                    "tyre", "gear", "fan", "intake", "exhaust", "nozzle"\n                ])\n                if exterior and not excluded:\n                    current.baseColorFactor = [0.68, 0.72, 0.77, 1.0]\n                    current.metallicFactor = 0.58\n                    current.roughnessFactor = 0.25\n                else:\n                    current.metallicFactor = 0.30\n                    current.roughnessFactor = 0.34\n            except Exception:\n                pass\n            continue''',
}

for old, new in replacements.items():
    if old not in source:
        raise SystemExit(f"Expected source fragment not found: {old}")
    source = source.replace(old, new, 1)

path.write_text(source, encoding="utf-8")
print("Applied v21 polished exterior tint and raised side-only American Eagle titles")

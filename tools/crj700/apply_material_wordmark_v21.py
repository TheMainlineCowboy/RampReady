#!/usr/bin/env python3
"""Reference correction v21: polished silver response and tighter title mapping.

The prior real-GLB QA showed two high-impact defects: the airframe rendered nearly
white instead of polished metallic silver, and the title decal wrapped too far down
the fuselage and became visible from the underside. This patch changes the actual
PBR material values and reduces the title decal's vertical span.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

replacements = {
    'silver = make_material("American Eagle metallic silver", (0.78, 0.80, 0.82, 1.0), 0.46, 0.29)':
        'silver = make_material("American Eagle polished metallic silver", (0.63, 0.66, 0.70, 1.0), 0.72, 0.20)',
    'silver_light = make_material("Painted silver", (0.88, 0.89, 0.90, 1.0), 0.32, 0.34)':
        'silver_light = make_material("Painted silver", (0.74, 0.77, 0.81, 1.0), 0.48, 0.27)',
    'center_y - 0.48, radius_x, 0.96, 64, 16, mirror_uv=mirror_uv)':
        'center_y - 0.39, radius_x, 0.72, 64, 14, mirror_uv=mirror_uv)',
}

for old, new in replacements.items():
    if old not in source:
        raise SystemExit(f"Expected source fragment not found: {old}")
    source = source.replace(old, new, 1)

path.write_text(source, encoding="utf-8")
print("Applied v21 polished silver materials and constrained American Eagle title mapping")

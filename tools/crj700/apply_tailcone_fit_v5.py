#!/usr/bin/env python3
"""Fit the red aft-fuselage sweep to the measured CRJ700 tailcone envelope.

The previous visual QA showed the texture correctly but its support mesh used the
full fuselage radius, leaving the two red elements floating as rails. This pass uses
actual cross-section radii measured from the exported fuselage near z=-11..-12.7 m.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

source = source.replace(
    "minimum[2] + 4.65, minimum[2] + 1.48,",
    "minimum[2] + 4.55, minimum[2] + 2.55,",
)
source = source.replace(
    "center_y + 0.18, radius_x*0.72, 0.16, 1.18,",
    "center_y - 0.02, radius_x*0.30, 0.16, 1.05,",
)

path.write_text(source, encoding="utf-8")
print("Fitted aft sweep to measured tailcone radii and physical fuselage length")

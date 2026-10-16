#!/usr/bin/env python3
"""Paint the American tail directly onto the actual fin and rudder geometry.

The previous decal support surfaces still produced detached red/blue blades in direct
Three.js side and tail-close views. This pass removes those support meshes entirely
and assigns the feather treatment to the real vertical-stabilizer and rudder faces,
so paint can never extend beyond the aircraft geometry.
"""
from pathlib import Path

path = Path("tools/crj700/build_accurate_crj700.py")
source = path.read_text(encoding="utf-8")

# Add a deterministic face-color treatment on the real fin/rudder geometry.
insert_at = source.index("\ndef add_livery(")
helper = r'''

def apply_embedded_tail_livery(scene: trimesh.Scene) -> None:
    """Apply reference-spaced red/blue feathers to actual fin and rudder faces."""
    silver = np.array([222, 225, 228, 255], dtype=np.uint8)
    bright = np.array([239, 240, 241, 255], dtype=np.uint8)
    red = np.array([194, 31, 47, 255], dtype=np.uint8)
    blue = np.array([18, 68, 120, 255], dtype=np.uint8)
    dark_cap = np.array([48, 50, 53, 255], dtype=np.uint8)

    matched = 0
    for name, mesh in scene.geometry.items():
        lower = name.lower()
        if "vstab" not in lower and "rudder" not in lower:
            continue
        if "wire" in lower:
            continue

        centers = mesh.triangles_center
        bounds = mesh.bounds
        y_min, y_max = bounds[0, 1], bounds[1, 1]
        z_min, z_max = bounds[0, 2], bounds[1, 2]
        y_span = max(y_max - y_min, 1e-6)
        z_span = max(z_max - z_min, 1e-6)
        colors = np.repeat(silver[None, :], len(mesh.faces), axis=0)

        y_norm = np.clip((centers[:, 1] - y_min) / y_span, 0.0, 1.0)
        z_norm = np.clip((centers[:, 2] - z_min) / z_span, 0.0, 1.0)

        # Seven broad diagonal feather rows with generous exposed-metal gaps.
        phase = np.mod(y_norm * 7.0 + z_norm * 0.42 + 0.10, 1.0)
        colored = phase < 0.34

        # The reference has red on the aft portion and blue on the forward portion;
        # the dividing line sweeps aft toward the fin root.
        split = 0.48 + 0.14 * (1.0 - y_norm)
        red_faces = colored & (z_norm < split)
        blue_faces = colored & ~red_faces
        colors[red_faces] = red
        colors[blue_faces] = blue

        # Slightly brighter metallic separators and a restrained dark cap.
        separator = (phase >= 0.34) & (phase < 0.48)
        colors[separator] = bright
        colors[y_norm > 0.92] = dark_cap

        mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, face_colors=colors)
        matched += 1

    if matched < 2:
        raise RuntimeError(f"Expected fin and rudder geometry, painted only {matched} meshes")
'''
source = source[:insert_at] + helper + source[insert_at:]

# Remove the detached tail-decal support meshes and paint the actual geometry instead.
old = '''    for side, texture, mirror_uv, label in [(1, tail, False, "Right"), (-1, tail_mirror, True, "Left")]:
        mesh = flat_tail_decal(texture, f"Tail_Livery_{label}", side, minimum[2] + 6.25,
                               minimum[2] + 1.55, minimum[1] + 3.52, maximum[1] - 0.08,
                               0.172, mirror_uv)
        scene.add_geometry(mesh, geom_name=f"Tail_Livery_{label}", node_name=f"Tail_Livery_{label}")
'''
if old not in source:
    raise RuntimeError("Could not locate tail decal insertion block")
source = source.replace(old, '''    apply_embedded_tail_livery(scene)
''')

path.write_text(source, encoding="utf-8")
print("Applied v8 embedded tail livery directly to actual fin and rudder geometry")

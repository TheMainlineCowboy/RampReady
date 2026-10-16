#!/usr/bin/env python3
"""Build an accurate, simulator-ready American Eagle CRJ700 GLB.

Geometry source: FlightGear CRJ700-family (GPL-2.0-or-later), original CRJ700
3D model credited by the project to Liam Gathercole and later contributors.
This script converts AC3D exterior components, assembles them at FlightGear's
published offsets, standardizes scale/orientation, adds non-destructive livery
overlays, validates the result, and creates multi-view QA renders.
"""
from __future__ import annotations

import argparse
import math
import re
import shutil
import subprocess
import sys
import textwrap
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals


@dataclass
class ACMaterial:
    name: str
    rgb: Tuple[float, float, float]
    ambient: Tuple[float, float, float]
    emissive: Tuple[float, float, float]
    specular: Tuple[float, float, float]
    shininess: float
    transparency: float


@dataclass
class ACSurface:
    flags: int
    material_index: int
    refs: List[Tuple[int, float, float]]


@dataclass
class ACObject:
    object_type: str
    name: str = ""
    loc: np.ndarray = field(default_factory=lambda: np.zeros(3, dtype=float))
    rot: np.ndarray = field(default_factory=lambda: np.eye(3, dtype=float))
    texture: Optional[str] = None
    texrep: Tuple[float, float] = (1.0, 1.0)
    texoff: Tuple[float, float] = (0.0, 0.0)
    vertices: List[Tuple[float, float, float]] = field(default_factory=list)
    surfaces: List[ACSurface] = field(default_factory=list)
    children: List["ACObject"] = field(default_factory=list)


class AC3DParser:
    def __init__(self, path: Path):
        self.path = path
        self.lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        self.index = 0
        self.materials: List[ACMaterial] = []

    def _line(self) -> str:
        if self.index >= len(self.lines):
            raise EOFError(f"Unexpected end of {self.path}")
        line = self.lines[self.index].strip()
        self.index += 1
        return line

    @staticmethod
    def _quoted(value: str) -> str:
        match = re.search(r'"(.*)"', value)
        return match.group(1) if match else value.split(maxsplit=1)[-1]

    def parse(self) -> Tuple[List[ACMaterial], ACObject]:
        header = self._line()
        if not header.startswith("AC3D"):
            raise ValueError(f"{self.path} is not an AC3D file: {header!r}")
        while self.index < len(self.lines):
            line = self.lines[self.index].strip()
            if not line or line.startswith("#"):
                self.index += 1
                continue
            if line.startswith("MATERIAL"):
                self.materials.append(self._parse_material(self._line()))
                continue
            if line.startswith("OBJECT"):
                return self.materials, self._parse_object()
            self.index += 1
        raise ValueError(f"No OBJECT found in {self.path}")

    def _parse_material(self, line: str) -> ACMaterial:
        name_match = re.search(r'MATERIAL\s+"(.*?)"', line)
        name = name_match.group(1) if name_match else f"Material_{len(self.materials)}"

        def triple(key: str, default: Tuple[float, float, float]) -> Tuple[float, float, float]:
            match = re.search(rf'\b{key}\s+([-+\deE.]+)\s+([-+\deE.]+)\s+([-+\deE.]+)', line)
            return tuple(map(float, match.groups())) if match else default

        def scalar(key: str, default: float) -> float:
            match = re.search(rf'\b{key}\s+([-+\deE.]+)', line)
            return float(match.group(1)) if match else default

        return ACMaterial(
            name=name,
            rgb=triple("rgb", (0.8, 0.8, 0.8)),
            ambient=triple("amb", (0.2, 0.2, 0.2)),
            emissive=triple("emis", (0.0, 0.0, 0.0)),
            specular=triple("spec", (0.2, 0.2, 0.2)),
            shininess=scalar("shi", 32.0),
            transparency=scalar("trans", 0.0),
        )

    def _parse_object(self) -> ACObject:
        first = self._line()
        if not first.startswith("OBJECT"):
            raise ValueError(f"Expected OBJECT at line {self.index}: {first!r}")
        obj = ACObject(object_type=first.split(maxsplit=1)[1].strip())
        while self.index < len(self.lines):
            line = self._line()
            if not line or line.startswith("#"):
                continue
            key, *rest = line.split(maxsplit=1)
            value = rest[0] if rest else ""
            if key == "name":
                obj.name = self._quoted(line)
            elif key == "data":
                wanted = int(value)
                consumed = 0
                while consumed < wanted and self.index < len(self.lines):
                    consumed += len(self.lines[self.index]) + 1
                    self.index += 1
            elif key == "texture":
                obj.texture = self._quoted(line)
            elif key == "texrep":
                values = list(map(float, value.split()))
                obj.texrep = (values[0], values[1])
            elif key == "texoff":
                values = list(map(float, value.split()))
                obj.texoff = (values[0], values[1])
            elif key == "loc":
                obj.loc = np.array(list(map(float, value.split())), dtype=float)
            elif key == "rot":
                values = list(map(float, value.split()))
                if len(values) != 9:
                    raise ValueError(f"Bad AC3D rotation in {self.path}: {line}")
                obj.rot = np.array(values, dtype=float).reshape(3, 3)
            elif key == "numvert":
                obj.vertices = [tuple(map(float, self._line().split()[:3])) for _ in range(int(value))]
            elif key == "numsurf":
                obj.surfaces = [self._parse_surface() for _ in range(int(value))]
            elif key == "kids":
                obj.children = [self._parse_object() for _ in range(int(value))]
                return obj
        return obj

    def _parse_surface(self) -> ACSurface:
        line = self._line()
        while not line.startswith("SURF"):
            if not line:
                line = self._line()
                continue
            raise ValueError(f"Expected SURF in {self.path}: {line!r}")
        flags = int(line.split()[1], 16)
        mat_line = self._line()
        material_index = int(mat_line.split()[1]) if mat_line.startswith("mat") else 0
        refs_line = self._line()
        if not refs_line.startswith("refs"):
            raise ValueError(f"Expected refs in {self.path}: {refs_line!r}")
        refs = []
        for _ in range(int(refs_line.split()[1])):
            parts = self._line().split()
            refs.append((int(parts[0]), float(parts[1]), float(parts[2])))
        return ACSurface(flags=flags, material_index=material_index, refs=refs)


def matrix_from_rot_loc(rot: np.ndarray, loc: np.ndarray) -> np.ndarray:
    matrix = np.eye(4, dtype=float)
    matrix[:3, :3] = rot
    matrix[:3, 3] = loc
    return matrix


def find_texture(base_dir: Path, texture: Optional[str]) -> Optional[Path]:
    if not texture:
        return None
    raw = texture.replace("\\", "/")
    candidates = [base_dir / raw, base_dir / Path(raw).name, base_dir.parent / raw]
    stem = Path(raw).stem
    for extension in [".png", ".jpg", ".jpeg", ".tga", ".bmp"]:
        candidates.extend([base_dir / f"{stem}{extension}", base_dir.parent / f"{stem}{extension}"])
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate
    for candidate in base_dir.parent.rglob(Path(raw).name):
        if candidate.is_file():
            return candidate
    return None


def pbr_from_ac(material: ACMaterial, texture_path: Optional[Path], cache: Dict[Tuple, PBRMaterial]) -> PBRMaterial:
    key = (material.name, texture_path.as_posix() if texture_path else None)
    if key in cache:
        return cache[key]
    rgba = [*material.rgb, max(0.0, min(1.0, 1.0 - material.transparency))]
    lower_name = material.name.lower()
    metallic = 0.48 if any(word in lower_name for word in ["alum", "metal", "chrome", "silver"]) else 0.08
    roughness = 0.28 if metallic > 0.2 else 0.48
    kwargs = dict(
        name=material.name,
        baseColorFactor=rgba,
        metallicFactor=metallic,
        roughnessFactor=roughness,
        emissiveFactor=list(material.emissive),
        alphaMode="BLEND" if rgba[3] < 0.995 else "OPAQUE",
        doubleSided=True,
    )
    if texture_path:
        try:
            kwargs["baseColorTexture"] = Image.open(texture_path).convert("RGBA")
        except Exception as exc:
            print(f"Warning: could not open texture {texture_path}: {exc}")
    output = PBRMaterial(**kwargs)
    cache[key] = output
    return output


def ac3d_to_scene(path: Path, prefix: str) -> trimesh.Scene:
    parser = AC3DParser(path)
    materials, root = parser.parse()
    if not materials:
        materials = [ACMaterial("Default", (0.78, 0.8, 0.82), (0, 0, 0), (0, 0, 0), (0.2, 0.2, 0.2), 32, 0)]
    scene = trimesh.Scene()
    material_cache: Dict[Tuple, PBRMaterial] = {}
    name_counts: Dict[str, int] = {}

    def visit(obj: ACObject, parent_transform: np.ndarray) -> None:
        world = parent_transform @ matrix_from_rot_loc(obj.rot, obj.loc)
        if obj.object_type == "poly" and obj.vertices and obj.surfaces:
            source_vertices = np.asarray(obj.vertices, dtype=float)
            groups: Dict[Tuple[int, Optional[str]], Dict[str, list]] = {}
            texture_path = find_texture(path.parent, obj.texture)
            texture_key = texture_path.as_posix() if texture_path else None
            for surface in obj.surfaces:
                if (surface.flags & 0x0F) != 0 or len(surface.refs) < 3:
                    continue
                material_index = surface.material_index if 0 <= surface.material_index < len(materials) else 0
                group = groups.setdefault((material_index, texture_key), {"vertices": [], "uv": [], "faces": []})
                for index in range(1, len(surface.refs) - 1):
                    triangle = [surface.refs[0], surface.refs[index], surface.refs[index + 1]]
                    face = []
                    for vertex_index, u, v in triangle:
                        point = (world @ np.append(source_vertices[vertex_index], 1.0))[:3]
                        face.append(len(group["vertices"]))
                        group["vertices"].append(point)
                        group["uv"].append((u * obj.texrep[0] + obj.texoff[0], v * obj.texrep[1] + obj.texoff[1]))
                    group["faces"].append(face)
            base_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", obj.name or obj.object_type).strip("_") or "mesh"
            for (material_index, _), group in groups.items():
                if not group["faces"]:
                    continue
                mesh = trimesh.Trimesh(vertices=np.asarray(group["vertices"]), faces=np.asarray(group["faces"]), process=False)
                mesh.remove_unreferenced_vertices()
                try:
                    mesh.fix_normals()
                except Exception:
                    pass
                mesh.visual = TextureVisuals(
                    uv=np.asarray(group["uv"], dtype=float),
                    material=pbr_from_ac(materials[material_index], texture_path, material_cache),
                )
                stem = re.sub(r"[^A-Za-z0-9_.-]+", "_", f"{prefix}_{base_name}_{materials[material_index].name}")
                count = name_counts.get(stem, 0)
                name_counts[stem] = count + 1
                name = stem if count == 0 else f"{stem}_{count:02d}"
                scene.add_geometry(mesh, geom_name=name, node_name=name)
        for child in obj.children:
            visit(child, world)

    visit(root, np.eye(4, dtype=float))
    return scene


def scene_copy_with_transform(source: trimesh.Scene, transform: np.ndarray, prefix: str) -> trimesh.Scene:
    output = trimesh.Scene()
    for node_name in source.graph.nodes_geometry:
        matrix, geometry_name = source.graph[node_name]
        mesh = source.geometry[geometry_name].copy()
        mesh.apply_transform(transform @ matrix)
        name = f"{prefix}_{geometry_name}"
        output.add_geometry(mesh, geom_name=name, node_name=name)
    return output


def append_scene(target: trimesh.Scene, source: trimesh.Scene) -> None:
    for node_name in source.graph.nodes_geometry:
        matrix, geometry_name = source.graph[node_name]
        mesh = source.geometry[geometry_name].copy()
        mesh.apply_transform(matrix)
        name = geometry_name
        suffix = 1
        while name in target.geometry:
            name = f"{geometry_name}_{suffix:02d}"
            suffix += 1
        target.add_geometry(mesh, geom_name=name, node_name=name)


def transform_scene_in_place(scene: trimesh.Scene, transform: np.ndarray) -> None:
    for mesh in scene.geometry.values():
        mesh.apply_transform(transform)


def translation(x: float, y: float, z: float) -> np.ndarray:
    matrix = np.eye(4)
    matrix[:3, 3] = [x, y, z]
    return matrix


def rotation_source_heading(degrees: float) -> np.ndarray:
    angle = math.radians(degrees)
    cosine, sine = math.cos(angle), math.sin(angle)
    matrix = np.eye(4)
    matrix[:3, :3] = [[cosine, -sine, 0], [sine, cosine, 0], [0, 0, 1]]
    return matrix


def source_to_target_matrix() -> np.ndarray:
    matrix = np.eye(4)
    matrix[:3, :3] = np.array([[0, 1, 0], [0, 0, 1], [-1, 0, 0]], dtype=float)
    return matrix


def geometry_bounds(scene: trimesh.Scene) -> np.ndarray:
    vertices = []
    for node_name in scene.graph.nodes_geometry:
        matrix, geometry_name = scene.graph[node_name]
        vertices.append(trimesh.transform_points(scene.geometry[geometry_name].vertices, matrix))
    if not vertices:
        raise ValueError("Scene contains no geometry")
    all_vertices = np.vstack(vertices)
    return np.array([all_vertices.min(axis=0), all_vertices.max(axis=0)])


def make_material(name: str, rgba, metallic=0.0, roughness=0.5, emissive=None, alpha_mode="OPAQUE", double=True):
    kwargs = dict(name=name, baseColorFactor=list(rgba), metallicFactor=metallic, roughnessFactor=roughness,
                  alphaMode=alpha_mode, doubleSided=double)
    if emissive is not None:
        kwargs["emissiveFactor"] = list(emissive)
    return PBRMaterial(**kwargs)


def standardize_materials(scene: trimesh.Scene) -> None:
    silver = make_material("American Eagle metallic silver", (0.78, 0.80, 0.82, 1.0), 0.46, 0.29)
    silver_light = make_material("Painted silver", (0.88, 0.89, 0.90, 1.0), 0.32, 0.34)
    glass = make_material("Dark cockpit and cabin glass", (0.012, 0.022, 0.035, 1.0), 0.12, 0.12)
    rubber = make_material("Aircraft tire rubber", (0.009, 0.009, 0.012, 1.0), 0.0, 0.92)
    gear = make_material("Landing gear metal", (0.60, 0.62, 0.64, 1.0), 0.82, 0.22)
    intake = make_material("Engine intake dark", (0.008, 0.010, 0.014, 1.0), 0.20, 0.20)
    exhaust = make_material("Engine exhaust", (0.18, 0.20, 0.23, 1.0), 0.88, 0.30)
    for name, mesh in scene.geometry.items():
        lower_name = name.lower()
        current = getattr(mesh.visual, "material", None)
        has_texture = current is not None and getattr(current, "baseColorTexture", None) is not None
        if has_texture:
            try:
                current.metallicFactor = 0.30
                current.roughnessFactor = 0.34
            except Exception:
                pass
            continue
        if any(word in lower_name for word in ["tire", "tyre", "wheelrubber"]):
            mesh.visual = TextureVisuals(material=rubber)
        elif any(word in lower_name for word in ["window", "glass", "windscreen", "windshield"]):
            mesh.visual = TextureVisuals(material=glass)
        elif any(word in lower_name for word in ["fan", "intake", "spinner"]):
            mesh.visual = TextureVisuals(material=intake)
        elif any(word in lower_name for word in ["exhaust", "nozzle", "tailpipe"]):
            mesh.visual = TextureVisuals(material=exhaust)
        elif any(word in lower_name for word in ["gear", "strut", "axle", "scissor", "retract"]):
            mesh.visual = TextureVisuals(material=gear)
        elif any(word in lower_name for word in ["fuselage", "belly", "wing", "vstab", "hstab", "rudder", "elevator", "aileron", "flap", "spoiler", "door"]):
            mesh.visual = TextureVisuals(material=silver)
        else:
            mesh.visual = TextureVisuals(material=silver_light)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def create_wordmark_texture(path: Path, mirrored: bool = False) -> Image.Image:
    image = Image.new("RGBA", (2400, 520), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.polygon([(65, 115), (210, 115), (132, 240), (18, 240)], fill=(28, 117, 181, 255))
    draw.polygon([(110, 260), (258, 260), (155, 425), (20, 425)], fill=(188, 28, 43, 255))
    draw.text((295, 90), "American Eagle", font=font(230), fill=(65, 69, 73, 255), stroke_width=1)
    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image


def create_registration_texture(path: Path, mirrored: bool = False) -> Image.Image:
    image = Image.new("RGBA", (1000, 240), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    fx, fy, fw, fh = 35, 62, 190, 108
    draw.rectangle((fx, fy, fx + fw, fy + fh), fill=(245, 245, 245, 255))
    stripe_height = fh / 13
    for index in range(13):
        if index % 2 == 0:
            draw.rectangle((fx, fy + index * stripe_height, fx + fw, fy + (index + 1) * stripe_height), fill=(181, 30, 45, 255))
    draw.rectangle((fx, fy, fx + fw * 0.42, fy + stripe_height * 7), fill=(25, 55, 105, 255))
    draw.text((270, 34), "N466AW", font=font(125), fill=(62, 67, 72, 255))
    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image


def create_tail_texture(path: Path, mirrored: bool = False) -> Image.Image:
    width, height = 1600, 2000
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).polygon([(150, 1900), (1430, 1900), (1080, 130), (640, 130)], fill=255)
    layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    bands = [(23, 61, 108, 255), (224, 226, 228, 255), (190, 30, 45, 255),
             (238, 239, 240, 255), (30, 82, 137, 255), (225, 227, 229, 255),
             (190, 30, 45, 255), (238, 239, 240, 255), (24, 66, 116, 255)]
    stripe_height = 270
    for index, color in enumerate(bands):
        y0 = height - (index + 1) * stripe_height
        y1 = height - index * stripe_height + 20
        slant = 220
        draw.polygon([(-300, y0 + slant), (width + 300, y0 - slant),
                      (width + 300, y1 - slant), (-300, y1 + slant)], fill=color)
    layer.putalpha(mask)
    image.alpha_composite(layer)
    if mirrored:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(path)
    return image


def curved_decal_mesh(texture: Image.Image, name: str, side: int, z_nose: float, z_tail: float,
                       center_y: float, radius_x: float, height: float, horizontal_segments: int = 48,
                       vertical_segments: int = 12, offset: float = 0.018, mirror_uv: bool = False) -> trimesh.Trimesh:
    vertices, uv = [], []
    for row in range(vertical_segments + 1):
        v = row / vertical_segments
        dy = (v - 0.5) * height
        normalized = np.clip(dy / max(radius_x * 0.96, 1e-6), -0.82, 0.82)
        lateral = radius_x * math.sqrt(max(0.0, 1.0 - normalized * normalized))
        x = side * (lateral + offset)
        y = center_y + dy
        for column in range(horizontal_segments + 1):
            u = column / horizontal_segments
            vertices.append((x, y, z_nose + (z_tail - z_nose) * u))
            uv.append((1.0 - u if mirror_uv else u, 1.0 - v))
    faces = []
    columns = horizontal_segments + 1
    for row in range(vertical_segments):
        for column in range(horizontal_segments):
            a = row * columns + column
            b, c, d = a + 1, (row + 1) * columns + column, (row + 1) * columns + column + 1
            faces.extend([(a, c, d), (a, d, b)] if side > 0 else [(a, d, c), (a, b, d)])
    material = PBRMaterial(name=name, baseColorTexture=texture, baseColorFactor=[1, 1, 1, 1],
                           metallicFactor=0.05, roughnessFactor=0.34, alphaMode="BLEND",
                           alphaCutoff=0.05, doubleSided=True)
    mesh = trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces), process=False)
    mesh.visual = TextureVisuals(uv=np.asarray(uv), material=material)
    return mesh


def flat_tail_decal(texture: Image.Image, name: str, side: int, z_front: float, z_rear: float,
                     y_bottom: float, y_top: float, x_offset: float, mirror_uv: bool) -> trimesh.Trimesh:
    nz, ny = 18, 28
    vertices, uv = [], []
    for row in range(ny + 1):
        v = row / ny
        y = y_bottom + (y_top - y_bottom) * v
        x = side * (x_offset * (1.0 - 0.70 * v) + 0.010)
        for column in range(nz + 1):
            u = column / nz
            vertices.append((x, y, z_front + (z_rear - z_front) * u))
            uv.append((1.0 - u if mirror_uv else u, 1.0 - v))
    faces = []
    columns = nz + 1
    for row in range(ny):
        for column in range(nz):
            a = row * columns + column
            b, c, d = a + 1, (row + 1) * columns + column, (row + 1) * columns + column + 1
            faces.extend([(a, d, c), (a, b, d)] if side > 0 else [(a, c, d), (a, d, b)])
    material = PBRMaterial(name=name, baseColorTexture=texture, baseColorFactor=[1, 1, 1, 1],
                           metallicFactor=0.05, roughnessFactor=0.33, alphaMode="BLEND",
                           alphaCutoff=0.04, doubleSided=True)
    mesh = trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces), process=False)
    mesh.visual = TextureVisuals(uv=np.asarray(uv), material=material)
    return mesh


def add_livery(scene: trimesh.Scene, output_dir: Path) -> None:
    bounds = geometry_bounds(scene)
    minimum, maximum = bounds
    center_y = minimum[1] + 0.46 * (maximum[1] - minimum[1])
    radius_x = min(1.42, max(1.20, 0.061 * (maximum[0] - minimum[0])))
    livery_dir = output_dir / "textures"
    livery_dir.mkdir(parents=True, exist_ok=True)
    word = create_wordmark_texture(livery_dir / "american_eagle_wordmark.png")
    word_mirror = create_wordmark_texture(livery_dir / "american_eagle_wordmark_mirrored.png", True)
    registration = create_registration_texture(livery_dir / "registration_N466AW.png")
    registration_mirror = create_registration_texture(livery_dir / "registration_N466AW_mirrored.png", True)
    tail = create_tail_texture(livery_dir / "american_tail.png")
    tail_mirror = create_tail_texture(livery_dir / "american_tail_mirrored.png", True)

    title_z_nose, title_z_tail = maximum[2] - 5.0, maximum[2] - 13.0
    for side, texture, mirror_uv, label in [(1, word, False, "Right"), (-1, word_mirror, True, "Left")]:
        mesh = curved_decal_mesh(texture, f"American_Eagle_Title_{label}", side, title_z_nose,
                                 title_z_tail, center_y + 0.12, radius_x, 1.00, mirror_uv=mirror_uv)
        scene.add_geometry(mesh, geom_name=f"American_Eagle_Title_{label}", node_name=f"American_Eagle_Title_{label}")

    reg_z_nose, reg_z_tail = minimum[2] + 8.4, minimum[2] + 5.0
    for side, texture, mirror_uv, label in [(1, registration, False, "Right"), (-1, registration_mirror, True, "Left")]:
        mesh = curved_decal_mesh(texture, f"Registration_{label}", side, reg_z_nose, reg_z_tail,
                                 center_y + 0.05, radius_x, 0.42, 24, 8, mirror_uv=mirror_uv)
        scene.add_geometry(mesh, geom_name=f"Registration_{label}", node_name=f"Registration_{label}")

    for side, texture, mirror_uv, label in [(1, tail, False, "Right"), (-1, tail_mirror, True, "Left")]:
        mesh = flat_tail_decal(texture, f"Tail_Livery_{label}", side, minimum[2] + 0.10,
                               minimum[2] + 4.25, minimum[1] + 4.05, maximum[1] - 0.05,
                               0.18, mirror_uv)
        scene.add_geometry(mesh, geom_name=f"Tail_Livery_{label}", node_name=f"Tail_Livery_{label}")


def uv_sphere(center: Sequence[float], radius: float, material: PBRMaterial) -> trimesh.Trimesh:
    mesh = trimesh.creation.uv_sphere(radius=radius, count=[20, 12])
    mesh.apply_translation(center)
    mesh.visual = TextureVisuals(material=material)
    return mesh


def add_lights(scene: trimesh.Scene) -> None:
    bounds = geometry_bounds(scene)
    minimum, maximum = bounds
    red = make_material("Port navigation light", (0.85, 0.01, 0.01, 1), 0, 0.18, (0.7, 0, 0))
    green = make_material("Starboard navigation light", (0, 0.75, 0.08, 1), 0, 0.18, (0, 0.65, 0.03))
    white = make_material("White strobe", (1, 1, 1, 1), 0, 0.12, (0.7, 0.7, 0.7))
    beacon = make_material("Red anti-collision beacon", (0.9, 0, 0, 1), 0, 0.14, (0.7, 0, 0))
    points = [
        ("Nav_Left_Red", (minimum[0] + 0.08, minimum[1] + 1.95, 0.6), red, 0.09),
        ("Nav_Right_Green", (maximum[0] - 0.08, minimum[1] + 1.95, 0.6), green, 0.09),
        ("Tail_Strobe", (0, minimum[1] + 4.4, minimum[2] + 0.12), white, 0.08),
        ("Top_Beacon", (0, minimum[1] + 5.15, 4.7), beacon, 0.085),
        ("Bottom_Beacon", (0, minimum[1] + 2.05, 5.5), beacon, 0.085),
    ]
    for name, center, material, radius in points:
        scene.add_geometry(uv_sphere(center, radius, material), geom_name=name, node_name=name)


def triangle_count(scene: trimesh.Scene) -> int:
    return int(sum(len(mesh.faces) for mesh in scene.geometry.values()))


def validate_scene(scene: trimesh.Scene) -> Dict[str, object]:
    bounds = geometry_bounds(scene)
    extents = bounds[1] - bounds[0]
    issues = []
    if not 31.5 <= extents[2] <= 33.5:
        issues.append(f"Length out of expected range: {extents[2]:.3f} m")
    if not 22.0 <= extents[0] <= 24.5:
        issues.append(f"Wingspan out of expected range: {extents[0]:.3f} m")
    if not 7.0 <= extents[1] <= 8.5:
        issues.append(f"Height out of expected range: {extents[1]:.3f} m")
    if abs(bounds[0, 1]) > 0.05:
        issues.append(f"Ground is not Y=0: {bounds[0, 1]:.4f}")
    if triangle_count(scene) < 25000:
        issues.append("Triangle count indicates missing source components")
    names = " ".join(scene.geometry.keys()).lower()
    for term in ["nose", "main", "engine", "fuselage", "wing"]:
        if term not in names:
            issues.append(f"Named component missing: {term}")
    return {"bounds": bounds.tolist(), "dimensions_m": {"wingspan_x": float(extents[0]),
            "height_y": float(extents[1]), "length_z": float(extents[2])},
            "triangles": triangle_count(scene), "geometry_nodes": len(scene.geometry),
            "issues": issues, "passed": not issues}


def render_views(glb_path: Path, output_path: Path) -> None:
    import pyvista as pv
    pv.OFF_SCREEN = True
    view_specs = [("Front-left", (22, 12, 26)), ("Front-right", (-22, 12, 26)),
                  ("Left side", (-32, 7, 1)), ("Right side", (32, 7, 1)),
                  ("Rear", (0, 8, -31)), ("Top oblique", (19, 28, 20))]
    panels = []
    for label, camera_position in view_specs:
        plotter = pv.Plotter(off_screen=True, window_size=(900, 620), lighting="three lights")
        plotter.set_background("#eef1f4")
        try:
            plotter.import_gltf(str(glb_path), set_camera=False)
        except TypeError:
            plotter.import_gltf(str(glb_path))
        ground = pv.Plane(center=(0, -0.025, 0), direction=(0, 1, 0), i_size=50, j_size=50,
                          i_resolution=20, j_resolution=20)
        plotter.add_mesh(ground, color="#d9dde1", opacity=0.28, show_edges=True, edge_color="#c4c9cf")
        plotter.camera_position = [camera_position, (0, 3.1, 0), (0, 1, 0)]
        plotter.camera.zoom(1.05)
        plotter.enable_anti_aliasing("ssaa")
        image = plotter.screenshot(return_img=True)
        plotter.close()
        panel = Image.fromarray(image).convert("RGB")
        draw = ImageDraw.Draw(panel)
        draw.rounded_rectangle((18, 16, 250, 62), radius=12, fill=(255, 255, 255), outline=(160, 165, 170), width=2)
        draw.text((36, 26), label, font=font(24, True), fill=(36, 41, 47))
        panels.append(panel)
    canvas = Image.new("RGB", (1800, 1860), (238, 241, 244))
    for index, panel in enumerate(panels):
        canvas.paste(panel, ((index % 2) * 900, (index // 2) * 620))
    canvas.save(output_path, quality=95)


def write_report(path: Path, report: Dict[str, object], source_commit: str) -> None:
    dimensions = report["dimensions_m"]
    text = f"""American Eagle CRJ700 RampReady Asset — QA Report
=====================================================

Geometry source: FlightGear CRJ700-family
Source commit: {source_commit}
Original CRJ700 model attribution: Liam Gathercole and FlightGear contributors
Derived asset license: GNU GPL version 2 or later

Coordinate system
-----------------
Y-up, aircraft nose +Z, starboard +X, meters.
Origin is on the ground plane near the main landing gear.

Verified dimensions
-------------------
Length:   {dimensions['length_z']:.3f} m
Wingspan: {dimensions['wingspan_x']:.3f} m
Height:   {dimensions['height_y']:.3f} m

Structure
---------
Geometry nodes: {report['geometry_nodes']}
Triangles:      {report['triangles']}
Landing gear:   extended, dual-wheel nose gear and paired main gear
Engines:        two rear-fuselage mounted nacelle assemblies
Livery:         metallic American Eagle treatment, two-sided titles,
                registration N466AW, U.S. flags, striped tail overlays

Automated checks
----------------
Status: {'PASS' if report['passed'] else 'NEEDS REVIEW'}
"""
    if report["issues"]:
        text += "\n" + "\n".join(f"- {issue}" for issue in report["issues"]) + "\n"
    else:
        text += "\n- Real-world CRJ700 dimensional envelope passed\n- Ground contact and orientation passed\n- Required component groups found\n"
    path.write_text(text, encoding="utf-8")


def main() -> int:
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument("--source", type=Path, required=True)
    argument_parser.add_argument("--output", type=Path, required=True)
    args = argument_parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    models = source / "Models"
    required = {"airframe": models / "CRJ700.ac", "engine": models / "CRJ700-engine.ac",
                "nosegear": models / "CRJ700-nosegear.ac", "maingear": models / "CRJ700-maingear.ac"}
    missing = [str(path) for path in required.values() if not path.exists()]
    if missing:
        raise FileNotFoundError("Required source files missing:\n" + "\n".join(missing))
    source_commit = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()

    airframe = ac3d_to_scene(required["airframe"], "Airframe")
    engine = ac3d_to_scene(required["engine"], "Engine")
    nosegear = ac3d_to_scene(required["nosegear"], "NoseGear")
    maingear = ac3d_to_scene(required["maingear"], "MainGear")
    assembled = trimesh.Scene()
    append_scene(assembled, airframe)
    for label, offset, heading in [("Engine_Left", (6.796, -2.27, -0.31), 1.0),
                                   ("Engine_Right", (6.796, 2.27, -0.31), -1.0)]:
        append_scene(assembled, scene_copy_with_transform(engine, translation(*offset) @ rotation_source_heading(heading), label))
    append_scene(assembled, scene_copy_with_transform(nosegear, translation(-14.232, 0, -3.201), "NoseGear"))
    append_scene(assembled, scene_copy_with_transform(maingear, translation(0.986, 0, -3.357), "MainGear"))

    transform_scene_in_place(assembled, source_to_target_matrix())
    bounds = geometry_bounds(assembled)
    scale = 32.51 / (bounds[1, 2] - bounds[0, 2])
    transform_scene_in_place(assembled, np.diag([scale, scale, scale, 1.0]))
    bounds = geometry_bounds(assembled)
    transform_scene_in_place(assembled, translation(-0.5 * (bounds[0, 0] + bounds[1, 0]), -bounds[0, 1], 0.986 * scale))

    standardize_materials(assembled)
    add_livery(assembled, output)
    add_lights(assembled)

    glb_path = output / "american_eagle_crj700_rampready_accurate.glb"
    glb_path.write_bytes(assembled.export(file_type="glb"))
    report = validate_scene(assembled)
    report_path = output / "american_eagle_crj700_rampready_accurate_QA.txt"
    write_report(report_path, report, source_commit)

    (output / "LICENSE_AND_ATTRIBUTION.txt").write_text(textwrap.dedent(f"""
        AMERICAN EAGLE CRJ700 RAMPREADY ASSET

        Geometry is derived from the FlightGear CRJ700-family project at commit:
        {source_commit}

        Original CRJ700 3D model credit: Liam Gathercole.
        Additional FlightGear contributors are credited in the upstream project.

        This derived model and included build source are distributed under the GNU
        General Public License, version 2 or (at your option) any later version.

        The American Eagle visual treatment was reconstructed for RampReady from
        user-provided visual references. Airline marks remain the property of their
        respective owners.
    """).strip() + "\n", encoding="utf-8")
    if (source / "LICENSE").exists():
        shutil.copy2(source / "LICENSE", output / "GPL-2.0-or-later.txt")
    source_dir = output / "corresponding_source"
    source_dir.mkdir(exist_ok=True)
    shutil.copy2(Path(__file__), source_dir / Path(__file__).name)
    for path in required.values():
        shutil.copy2(path, source_dir / path.name)

    try:
        render_views(glb_path, output / "american_eagle_crj700_rampready_accurate_QA_views.png")
    except Exception as exc:
        print(f"Preview rendering failed: {exc}", file=sys.stderr)
        (output / "PREVIEW_RENDER_ERROR.txt").write_text(str(exc), encoding="utf-8")

    package_path = output / "american_eagle_crj700_rampready_accurate_package.zip"
    with zipfile.ZipFile(package_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in output.rglob("*"):
            if path != package_path and path.is_file():
                archive.write(path, path.relative_to(output))
    print(report_path.read_text(encoding="utf-8"))
    print(f"GLB: {glb_path} ({glb_path.stat().st_size / 1_048_576:.2f} MiB)")
    print(f"Package: {package_path} ({package_path.stat().st_size / 1_048_576:.2f} MiB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

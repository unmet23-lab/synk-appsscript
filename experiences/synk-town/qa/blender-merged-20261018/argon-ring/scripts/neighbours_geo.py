import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, Euler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.path.join(ROOT, "prev", "scripts") not in sys.path:
    sys.path.insert(0, os.path.join(ROOT, "prev", "scripts"))
if os.path.join(ROOT, "scripts") not in sys.path:
    sys.path.insert(0, os.path.join(ROOT, "scripts"))

import geo_builder
from geo_builder import (
    TAU,
    make_rng,
    srgb_to_linear,
    hex_to_linear,
    lerp_color,
    t2b,
)

# Atlas groups contract: up to 2 groups, excluding 'neighbours_glass'
ATLAS_GROUPS = {
    'neighbours_wall': 'neighbours_wall',
    'neighbours_timber': 'neighbours_wall',
    'neighbours_yard': 'neighbours_wall',
    'neighbours_roof': 'neighbours_roof',
}

BASE_FLOOR_Y = 0.075  # TOWN_LAYOUT.ground.rootY (0.20) + localY (-0.125)

HOUSES = [
    {'id': 'neighbour-0', 'x': -16.6, 'z': -16.3, 'width': 4.032, 'depth': 2.275, 'height': 1.9844, 'yaw': 0.16,  'style': 0, 'paint': '#e8ece6', 'yardFrontMargin': 2.0},
    {'id': 'neighbour-1', 'x': -10.0, 'z': -16.0, 'width': 2.688, 'depth': 2.997, 'height': 2.5984, 'yaw': -0.06, 'style': 1, 'paint': '#f1f2ec', 'yardFrontMargin': 2.0},
    {'id': 'neighbour-2', 'x': -4.7,  'z': -16.7, 'width': 3.0,   'depth': 2.568, 'height': 1.9364, 'yaw': -0.17, 'style': 2, 'paint': '#e7ede6', 'yardFrontMargin': 2.0},
    {'id': 'neighbour-3', 'x': 5.4,   'z': -16.6, 'width': 3.808, 'depth': 2.366, 'height': 2.0828, 'yaw': 0.12,  'style': 0, 'paint': '#ecefe9', 'yardFrontMargin': 2.0},
    {'id': 'neighbour-4', 'x': 12.2,  'z': -16.4, 'width': 3.192, 'depth': 3.108, 'height': 2.6432, 'yaw': -0.11, 'style': 1, 'paint': '#eef1eb', 'yardFrontMargin': 2.0},
    {'id': 'neighbour-5', 'x': 17.4,  'z': -17.6, 'width': 3.2,   'depth': 2.889, 'height': 2.0116, 'yaw': -0.26, 'style': 2, 'paint': '#e5ebe4', 'yardFrontMargin': 2.0},
    {'id': 'neighbour-6', 'x': -12.9, 'z': -21.1, 'width': 3.808, 'depth': 2.548, 'height': 1.7876, 'yaw': 0.04,  'style': 0, 'paint': '#f0f1eb', 'yardFrontMargin': 1.24},
    {'id': 'neighbour-7', 'x': 8.9,   'z': -21.1, 'width': 2.688, 'depth': 2.886, 'height': 2.3968, 'yaw': -0.07, 'style': 1, 'paint': '#ebeee7', 'yardFrontMargin': 1.24},
]


def rgba_linear(hex_str, a=1.0):
    r, g, b = hex_to_linear(hex_str)
    return (r, g, b, a)


def scale_color(col, factor):
    return (
        max(0.0, min(1.0, col[0] * factor)),
        max(0.0, min(1.0, col[1] * factor)),
        max(0.0, min(1.0, col[2] * factor)),
    )


def neighbour_height(x, z, style=0):
    """Exact port of day-environment.mjs neighbourHeight(x, z, style=0)."""
    if style == 1:
        return 0.69 - 0.56 * (x + 0.5) + 0.055 * ((abs(z) * 2.0) ** 5.0)
    if style == 2:
        return 0.21 + 0.43 * math.cos(x * math.pi) + 0.09 * ((abs(x) * 2.0) ** 7.0) + 0.05 * ((abs(z) * 2.0) ** 5.0)
    return 0.64 - 0.57 * math.sin(abs(x) * math.pi) + 0.13 * ((abs(x) * 2.0) ** 7.0) + 0.04 * ((abs(z) * 2.0) ** 5.0)


def _new_neighbours_mat(name):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (650, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (340, 0)
    bsdf.inputs["Metallic"].default_value = 0.0
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat, nt, bsdf


def _world_mapping(nt, scale=(1.0, 1.0, 1.0)):
    geom = nt.nodes.new("ShaderNodeNewGeometry")
    geom.location = (-950, 0)
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.location = (-740, 0)
    mapping.inputs["Scale"].default_value = scale
    nt.links.new(geom.outputs["Position"], mapping.inputs["Vector"])
    return geom, mapping


def _vcol_multiply(nt, base_socket, loc=(-160, 180)):
    vcol = nt.nodes.new("ShaderNodeVertexColor")
    vcol.layer_name = "Color"
    vcol.location = (loc[0] - 220, loc[1])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs["Factor"].default_value = 1.0
    mix.location = loc
    nt.links.new(base_socket, mix.inputs[6])
    nt.links.new(vcol.outputs["Color"], mix.inputs[7])
    return mix.outputs[2]


def _bump_node(nt, bsdf, height_socket, strength=0.07, distance=0.004):
    bump = nt.nodes.new("ShaderNodeBump")
    bump.location = (100, -180)
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    nt.links.new(height_socket, bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return bump


def ensure_neighbours_materials(mats):
    """
    Creates procedural materials prefixed with 'neighbours_' and adds them to `mats`.
    All bake materials have Principled BSDF Metallic = 0.0 and support vertex Color multiplication.
    """
    # 1. neighbours_plaster: Textured lime stucco/plaster with trowel waves + fine sand grain * vertex Color
    mat, nt, bsdf = _new_neighbours_mat("neighbours_plaster")
    bsdf.inputs["Roughness"].default_value = 0.94
    _, mapping = _world_mapping(nt, scale=(4.5, 4.5, 4.5))

    n_broad = nt.nodes.new("ShaderNodeTexNoise")
    n_broad.location = (-500, 120)
    n_broad.inputs["Scale"].default_value = 3.4
    n_broad.inputs["Detail"].default_value = 4.0
    n_broad.inputs["Roughness"].default_value = 0.62
    nt.links.new(mapping.outputs["Vector"], n_broad.inputs["Vector"])

    n_fine = nt.nodes.new("ShaderNodeTexNoise")
    n_fine.location = (-500, -120)
    n_fine.inputs["Scale"].default_value = 24.0
    n_fine.inputs["Detail"].default_value = 6.0
    n_fine.inputs["Roughness"].default_value = 0.78
    nt.links.new(mapping.outputs["Vector"], n_fine.inputs["Vector"])

    mix_h = nt.nodes.new("ShaderNodeMix")
    mix_h.data_type = 'FLOAT'
    mix_h.location = (-320, -40)
    mix_h.inputs["Factor"].default_value = 0.44
    nt.links.new(n_broad.outputs["Fac"], mix_h.inputs[2])
    nt.links.new(n_fine.outputs["Fac"], mix_h.inputs[3])

    col_pl = nt.nodes.new("ShaderNodeMix")
    col_pl.data_type = 'RGBA'
    col_pl.location = (-340, 180)
    col_pl.inputs[6].default_value = (0.955, 0.958, 0.952, 1.0)
    col_pl.inputs[7].default_value = (1.030, 1.030, 1.026, 1.0)
    nt.links.new(mix_h.outputs[0], col_pl.inputs["Factor"])

    final_pl = _vcol_multiply(nt, col_pl.outputs[2])
    nt.links.new(final_pl, bsdf.inputs["Base Color"])
    _bump_node(nt, bsdf, mix_h.outputs[0], strength=0.07, distance=0.004)
    mats['neighbours_plaster'] = mat

    # 2. neighbours_roof_slate: Deep blue-slate roof tiles (#344b64) with fine slate grain * vertex Color
    mat, nt, bsdf = _new_neighbours_mat("neighbours_roof_slate")
    bsdf.inputs["Roughness"].default_value = 0.76
    _, mapping = _world_mapping(nt, scale=(6.0, 6.0, 6.0))

    n_slate = nt.nodes.new("ShaderNodeTexNoise")
    n_slate.location = (-500, 80)
    n_slate.inputs["Scale"].default_value = 12.0
    n_slate.inputs["Detail"].default_value = 5.0
    n_slate.inputs["Roughness"].default_value = 0.65
    nt.links.new(mapping.outputs["Vector"], n_slate.inputs["Vector"])

    w_slate = nt.nodes.new("ShaderNodeTexWave")
    w_slate.location = (-500, -140)
    w_slate.wave_type = 'BANDS'
    w_slate.bands_direction = 'Z'
    w_slate.inputs["Scale"].default_value = 8.0
    w_slate.inputs["Distortion"].default_value = 1.8
    w_slate.inputs["Detail"].default_value = 3.0
    nt.links.new(mapping.outputs["Vector"], w_slate.inputs["Vector"])

    mix_s = nt.nodes.new("ShaderNodeMix")
    mix_s.data_type = 'FLOAT'
    mix_s.location = (-320, -40)
    mix_s.inputs["Factor"].default_value = 0.30
    nt.links.new(n_slate.outputs["Fac"], mix_s.inputs[2])
    nt.links.new(w_slate.outputs["Fac"], mix_s.inputs[3])

    col_rf = nt.nodes.new("ShaderNodeMix")
    col_rf.data_type = 'RGBA'
    col_rf.location = (-340, 180)
    col_rf.inputs[6].default_value = rgba_linear("#2d4259")
    col_rf.inputs[7].default_value = rgba_linear("#3d5570")
    nt.links.new(mix_s.outputs[0], col_rf.inputs["Factor"])

    final_rf = _vcol_multiply(nt, col_rf.outputs[2])
    nt.links.new(final_rf, bsdf.inputs["Base Color"])
    _bump_node(nt, bsdf, mix_s.outputs[0], strength=0.06, distance=0.0035)
    mats['neighbours_roof_slate'] = mat

    # 3. neighbours_wood: Warm natural oak timber (#be9a6b .. #ceb083) * vertex Color
    mat, nt, bsdf = _new_neighbours_mat("neighbours_wood")
    bsdf.inputs["Roughness"].default_value = 0.85
    _, mapping = _world_mapping(nt, scale=(2.2, 2.2, 7.0))

    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.location = (-500, 100)
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'X'
    wave.inputs["Scale"].default_value = 3.6
    wave.inputs["Distortion"].default_value = 4.2
    wave.inputs["Detail"].default_value = 3.0
    nt.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.location = (-500, -120)
    noise.inputs["Scale"].default_value = 16.0
    noise.inputs["Detail"].default_value = 4.0
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    mix_w = nt.nodes.new("ShaderNodeMix")
    mix_w.data_type = 'FLOAT'
    mix_w.location = (-320, -20)
    mix_w.inputs["Factor"].default_value = 0.55
    nt.links.new(wave.outputs["Fac"], mix_w.inputs[2])
    nt.links.new(noise.outputs["Fac"], mix_w.inputs[3])

    col_wd = nt.nodes.new("ShaderNodeMix")
    col_wd.data_type = 'RGBA'
    col_wd.location = (-340, 180)
    col_wd.inputs[6].default_value = rgba_linear("#be9a6a")
    col_wd.inputs[7].default_value = rgba_linear("#cfb285")
    nt.links.new(mix_w.outputs[0], col_wd.inputs["Factor"])

    final_wd = _vcol_multiply(nt, col_wd.outputs[2])
    nt.links.new(final_wd, bsdf.inputs["Base Color"])
    _bump_node(nt, bsdf, mix_w.outputs[0], strength=0.045, distance=0.003)
    mats['neighbours_wood'] = mat

    # 4. neighbours_dark_wood: Aged structural walnut timber (#6a5742 .. #7c6850) * vertex Color
    mat, nt, bsdf = _new_neighbours_mat("neighbours_dark_wood")
    bsdf.inputs["Roughness"].default_value = 0.87
    _, mapping = _world_mapping(nt, scale=(2.2, 2.2, 7.0))

    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.location = (-500, 100)
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'X'
    wave.inputs["Scale"].default_value = 3.8
    wave.inputs["Distortion"].default_value = 4.0
    wave.inputs["Detail"].default_value = 3.0
    nt.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])

    noise_dw = nt.nodes.new("ShaderNodeTexNoise")
    noise_dw.location = (-500, -120)
    noise_dw.inputs["Scale"].default_value = 15.0
    noise_dw.inputs["Detail"].default_value = 4.0
    nt.links.new(mapping.outputs["Vector"], noise_dw.inputs["Vector"])

    mix_dw = nt.nodes.new("ShaderNodeMix")
    mix_dw.data_type = 'FLOAT'
    mix_dw.location = (-320, -20)
    mix_dw.inputs["Factor"].default_value = 0.55
    nt.links.new(wave.outputs["Fac"], mix_dw.inputs[2])
    nt.links.new(noise_dw.outputs["Fac"], mix_dw.inputs[3])

    col_dw = nt.nodes.new("ShaderNodeMix")
    col_dw.data_type = 'RGBA'
    col_dw.location = (-340, 180)
    col_dw.inputs[6].default_value = rgba_linear("#685540")
    col_dw.inputs[7].default_value = rgba_linear("#7b6750")
    nt.links.new(mix_dw.outputs[0], col_dw.inputs["Factor"])

    final_dw = _vcol_multiply(nt, col_dw.outputs[2])
    nt.links.new(final_dw, bsdf.inputs["Base Color"])
    _bump_node(nt, bsdf, mix_dw.outputs[0], strength=0.05, distance=0.003)
    mats['neighbours_dark_wood'] = mat

    # 5. neighbours_shutters: Sage-grey painted wood (#d1d9d3 .. #e0e7e1) * vertex Color
    mat, nt, bsdf = _new_neighbours_mat("neighbours_shutters")
    bsdf.inputs["Roughness"].default_value = 0.83
    _, mapping = _world_mapping(nt, scale=(2.5, 2.5, 8.0))

    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.location = (-500, 60)
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'X'
    wave.inputs["Scale"].default_value = 4.2
    wave.inputs["Distortion"].default_value = 3.2
    nt.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])

    col_sh = nt.nodes.new("ShaderNodeMix")
    col_sh.data_type = 'RGBA'
    col_sh.location = (-340, 180)
    col_sh.inputs[6].default_value = rgba_linear("#d0d8d2")
    col_sh.inputs[7].default_value = rgba_linear("#e0e7e1")
    nt.links.new(wave.outputs["Fac"], col_sh.inputs["Factor"])

    final_sh = _vcol_multiply(nt, col_sh.outputs[2])
    nt.links.new(final_sh, bsdf.inputs["Base Color"])
    _bump_node(nt, bsdf, wave.outputs["Fac"], strength=0.04, distance=0.0025)
    mats['neighbours_shutters'] = mat

    # 6. neighbours_stone: Dressed limestone base & coping (#e6eae4 .. #f4f7f2) * vertex Color
    mat, nt, bsdf = _new_neighbours_mat("neighbours_stone")
    bsdf.inputs["Roughness"].default_value = 0.91
    _, mapping = _world_mapping(nt, scale=(5.5, 5.5, 5.5))

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.location = (-500, 60)
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 5.0
    noise.inputs["Roughness"].default_value = 0.62
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    col_st = nt.nodes.new("ShaderNodeMix")
    col_st.data_type = 'RGBA'
    col_st.location = (-340, 180)
    col_st.inputs[6].default_value = rgba_linear("#e5e9e3")
    col_st.inputs[7].default_value = rgba_linear("#f3f6f0")
    nt.links.new(noise.outputs["Fac"], col_st.inputs["Factor"])

    final_st = _vcol_multiply(nt, col_st.outputs[2])
    nt.links.new(final_st, bsdf.inputs["Base Color"])
    _bump_node(nt, bsdf, noise.outputs["Fac"], strength=0.07, distance=0.004)
    mats['neighbours_stone'] = mat

    # 7. neighbours_paving: Courtyard & step limestone paving (#e5e8e3 .. #f2f4f0) * vertex Color
    mat, nt, bsdf = _new_neighbours_mat("neighbours_paving")
    bsdf.inputs["Roughness"].default_value = 0.90
    _, mapping = _world_mapping(nt, scale=(4.0, 4.0, 4.0))

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.location = (-500, 60)
    noise.inputs["Scale"].default_value = 7.5
    noise.inputs["Detail"].default_value = 4.0
    noise.inputs["Roughness"].default_value = 0.55
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    col_pv = nt.nodes.new("ShaderNodeMix")
    col_pv.data_type = 'RGBA'
    col_pv.location = (-340, 180)
    col_pv.inputs[6].default_value = rgba_linear("#e5e8e3")
    col_pv.inputs[7].default_value = rgba_linear("#f2f4f0")
    nt.links.new(noise.outputs["Fac"], col_pv.inputs["Factor"])

    final_pv = _vcol_multiply(nt, col_pv.outputs[2])
    nt.links.new(final_pv, bsdf.inputs["Base Color"])
    _bump_node(nt, bsdf, noise.outputs["Fac"], strength=0.05, distance=0.003)
    mats['neighbours_paving'] = mat

    # 8. neighbours_gravel: Compacted river gravel path (#cfc5b1 .. #e1d7c3, mean #d8ceba) * vertex Color
    mat, nt, bsdf = _new_neighbours_mat("neighbours_gravel")
    bsdf.inputs["Roughness"].default_value = 0.95
    _, mapping = _world_mapping(nt, scale=(10.0, 10.0, 10.0))

    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.location = (-520, 100)
    vor.inputs["Scale"].default_value = 16.0
    vor.inputs["Randomness"].default_value = 0.85
    nt.links.new(mapping.outputs["Vector"], vor.inputs["Vector"])

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.location = (-520, -120)
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 4.0
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    mix_g = nt.nodes.new("ShaderNodeMix")
    mix_g.data_type = 'FLOAT'
    mix_g.location = (-320, -20)
    mix_g.inputs["Factor"].default_value = 0.5
    nt.links.new(vor.outputs["Distance"], mix_g.inputs[2])
    nt.links.new(noise.outputs["Fac"], mix_g.inputs[3])

    col_gr = nt.nodes.new("ShaderNodeMix")
    col_gr.data_type = 'RGBA'
    col_gr.location = (-340, 180)
    col_gr.inputs[6].default_value = rgba_linear("#cfc5b1")
    col_gr.inputs[7].default_value = rgba_linear("#e1d7c3")
    nt.links.new(mix_g.outputs[0], col_gr.inputs["Factor"])

    final_gr = _vcol_multiply(nt, col_gr.outputs[2])
    nt.links.new(final_gr, bsdf.inputs["Base Color"])
    _bump_node(nt, bsdf, mix_g.outputs[0], strength=0.085, distance=0.0045)
    mats['neighbours_gravel'] = mat

    return mats


class WorldMeshCollector:
    """
    Collects geometry from multiple rotated neighbour houses directly into Blender world space
    with zero object transforms, preserving per-face smoothness and vertex colors.
    """
    def __init__(self, name):
        self.name = name
        self.verts = []
        self.faces = []
        self.mat_ids = []
        self.face_colors = []
        self.face_smooth = []
        self.materials = []
        self.mat_map = {}

    def get_mat_index(self, mat):
        if mat.name not in self.mat_map:
            self.mat_map[mat.name] = len(self.materials)
            self.materials.append(mat)
        return self.mat_map[mat.name]

    def add_house_mesh(self, house, local_verts, faces, mat, color=(1.0, 1.0, 1.0), vert_colors=None, face_smooth_list=None):
        hx = house['x']
        hz = house['z']
        yaw = house['yaw']
        cos_y = math.cos(yaw)
        sin_y = math.sin(yaw)

        offset_idx = len(self.verts)
        for lx, ly, lz in local_verts:
            wx = hx + lx * cos_y + lz * sin_y
            wy = BASE_FLOOR_Y + ly
            wz = hz - lx * sin_y + lz * cos_y
            self.verts.append(t2b(wx, wy, wz))

        m_idx = self.get_mat_index(mat)
        for idx_f, f in enumerate(faces):
            if len(f) < 3:
                continue
            self.faces.append(tuple(offset_idx + i for i in f))
            self.mat_ids.append(m_idx)
            if vert_colors is not None:
                self.face_colors.append([vert_colors[i] for i in f])
            else:
                self.face_colors.append([color for _ in f])
            if face_smooth_list is not None:
                self.face_smooth.append(bool(face_smooth_list[idx_f]))
            else:
                self.face_smooth.append(True)

    def add_beveled_box(self, house, center, size, mat, rot_euler=(0.0, 0.0, 0.0), bevel=0.006, segments=1, color=(1.0, 1.0, 1.0), vcol_fn=None):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        sx, sy, sz = size
        for v in bm.verts:
            v.co.x *= sx
            v.co.y *= sy
            v.co.z *= sz
        if bevel > 0.0 and segments > 0:
            max_b = min(sx, sy, sz) * 0.34
            actual_b = min(bevel, max_b)
            if actual_b > 0.0003:
                bmesh.ops.bevel(bm, geom=bm.edges[:], offset=actual_b, segments=segments, profile=0.5, affect='EDGES')
        bm.normal_update()

        has_rot = (abs(rot_euler[0]) > 1e-6 or abs(rot_euler[1]) > 1e-6 or abs(rot_euler[2]) > 1e-6)
        rot_mat = Euler(rot_euler, 'XYZ').to_matrix().to_4x4() if has_rot else None
        cx, cy, cz = center

        local_verts = []
        vert_colors = [] if vcol_fn is not None else None
        for v in bm.verts:
            p = (rot_mat @ v.co) if rot_mat else v.co
            lx, ly, lz = p.x + cx, p.y + cy, p.z + cz
            local_verts.append((lx, ly, lz))
            if vcol_fn is not None:
                vert_colors.append(vcol_fn(lx, ly, lz, v.co.x, v.co.y, v.co.z))

        bm.verts.ensure_lookup_table()
        faces = []
        smooth_flags = []
        for f in bm.faces:
            faces.append([v.index for v in f.verts])
            n = f.normal
            is_main_axis = (abs(n.x) > 0.995 or abs(n.y) > 0.995 or abs(n.z) > 0.995)
            smooth_flags.append(not is_main_axis)
        bm.free()
        self.add_house_mesh(house, local_verts, faces, mat, color=color, vert_colors=vert_colors, face_smooth_list=smooth_flags)

    def add_chamfer_plank(self, house, center, size, mat, chamfer=0.0035, axis='Z', color=(1.0, 1.0, 1.0)):
        """
        Builds a low-poly 9-face chamfered plank/block (18 tris instead of 44 tris):
        The outward face along `axis` ('Z' for front wall planks/battens, 'Y' for horizontal slabs/coping/deck planks)
        has a crisp 4-edge chamfer bevel while the recessed back face stays clean.
        """
        cx, cy, cz = center
        sx, sy, sz = size
        hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
        c = min(chamfer, min(sx, sy, sz) * 0.35)

        if axis == 'Z':
            ix, iy = max(0.001, hx - c), max(0.001, hy - c)
            z_back, z_mid, z_front = -hz, hz - c, hz
            verts = [
                # 0..3: back rectangle
                (-hx, -hy, z_back), (hx, -hy, z_back), (hx, hy, z_back), (-hx, hy, z_back),
                # 4..7: outer front-mid ring
                (-hx, -hy, z_mid), (hx, -hy, z_mid), (hx, hy, z_mid), (-hx, hy, z_mid),
                # 8..11: chamfered front face
                (-ix, -iy, z_front), (ix, -iy, z_front), (ix, iy, z_front), (-ix, iy, z_front),
            ]
        else:
            # axis == 'Y' (upward chamfered slab/plank/coping stone)
            ix, iz = max(0.001, hx - c), max(0.001, hz - c)
            y_bot, y_mid, y_top = -hy, hy - c, hy
            verts = [
                # 0..3: bottom rectangle (CCW looking from -Y)
                (-hx, y_bot, -hz), (hx, y_bot, -hz), (hx, y_bot, hz), (-hx, y_bot, hz),
                # 4..7: mid ring
                (-hx, y_mid, -hz), (hx, y_mid, -hz), (hx, y_mid, hz), (-hx, y_mid, hz),
                # 8..11: top chamfered face
                (-ix, y_top, -iz), (ix, y_top, -iz), (ix, y_top, iz), (-ix, y_top, iz),
            ]

        local_verts = [(cx + vx, cy + vy, cz + vz) for vx, vy, vz in verts]
        if axis == 'Z':
            faces = [
                # Side walls
                (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
                # Chamfer bevel ring
                (4, 5, 9, 8), (5, 6, 10, 9), (6, 7, 11, 10), (7, 4, 8, 11),
                # Front flat face
                (8, 9, 10, 11),
            ]
        else:
            faces = [
                # Side walls (outward normals)
                (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0),
                # Chamfer bevel ring
                (4, 8, 9, 5), (5, 9, 10, 6), (6, 10, 11, 7), (7, 11, 8, 4),
                # Top flat face
                (8, 11, 10, 9),
            ]
        smooth_flags = [False, False, False, False, True, True, True, True, False]
        self.add_house_mesh(house, local_verts, faces, mat, color=color, face_smooth_list=smooth_flags)

    def add_open_frame(self, house, center, width, height, depth, frame_w, mat, bevel=0.005, segments=1, color=(1.0, 1.0, 1.0), orient='Z'):
        """
        Builds a 4-piece mortised picture-frame around an opening (top lintel, bottom sill-rail, left & right jambs)
        so windows and doors have authentic recessed depth.
        """
        cx, cy, cz = center
        if orient == 'Z':
            self.add_beveled_box(house, (cx, cy + (height - frame_w) * 0.5, cz), (width, frame_w, depth),
                                 mat, bevel=bevel, segments=segments, color=color)
            self.add_beveled_box(house, (cx, cy - (height - frame_w) * 0.5, cz), (width, frame_w, depth),
                                 mat, bevel=bevel, segments=segments, color=color)
            inner_h = max(0.02, height - frame_w * 1.92)
            for s in (-1, 1):
                self.add_beveled_box(house, (cx + s * (width - frame_w) * 0.5, cy, cz), (frame_w, inner_h, depth * 0.96),
                                     mat, bevel=bevel, segments=segments, color=scale_color(color, 0.97))
        else:
            self.add_beveled_box(house, (cx, cy + (height - frame_w) * 0.5, cz), (depth, frame_w, width),
                                 mat, bevel=bevel, segments=segments, color=color)
            self.add_beveled_box(house, (cx, cy - (height - frame_w) * 0.5, cz), (depth, frame_w, width),
                                 mat, bevel=bevel, segments=segments, color=color)
            inner_h = max(0.02, height - frame_w * 1.92)
            for s in (-1, 1):
                self.add_beveled_box(house, (cx, cy, cz + s * (width - frame_w) * 0.5), (depth * 0.96, inner_h, frame_w),
                                     mat, bevel=bevel, segments=segments, color=scale_color(color, 0.97))

    def build_object(self, shade_smooth=True):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.verts, [], self.faces)
        for mat in self.materials:
            mesh.materials.append(mat)
        for i, poly in enumerate(mesh.polygons):
            poly.material_index = self.mat_ids[i]
            poly.use_smooth = self.face_smooth[i] if (shade_smooth and i < len(self.face_smooth)) else shade_smooth

        ca = mesh.color_attributes.new(name="Color", type='BYTE_COLOR', domain='CORNER')
        for poly_idx, poly in enumerate(mesh.polygons):
            f_cols = self.face_colors[poly_idx]
            for k, loop_idx in enumerate(poly.loop_indices):
                c = f_cols[k] if k < len(f_cols) else f_cols[0]
                ca.data[loop_idx].color = (c[0], c[1], c[2], 1.0)

        mesh.update()
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.collection.objects.link(obj)

        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        return obj


def _build_curved_roof_shell(mc, house, style, center, scale, mat, rot_y_90=False, nx=20, nz=6,
                             add_ribs=True, n_u_ribs=11, n_v_ribs=7, add_ridge=True, add_bargeboards=True, mat_dark=None):
    """
    Builds a curved roof shell matching neighbourRoofGeometry(style) with:
    - Smooth double-layered roof slab (exact thickness 0.065 * sy)
    - Standing-seam ribs along the slope & purlin courses across the roof following exact curvature
    - Sculpted ridge beam with tiled segments
    - Proportional darkWood gable bargeboard trim along the front/back curved edges
    """
    cx, cy, cz = center
    sx, sy, sz = scale
    layer_drop = 0.065

    def local_pt(u, v, extra_y=0.0):
        h_val = neighbour_height(u, v, style)
        px = u * sx
        py = h_val * sy + extra_y
        pz = v * sz
        if rot_y_90:
            return (cx + pz, cy + py, cz - px)
        return (cx + px, cy + py, cz + pz)

    # 1. Main roof slab shell
    r_verts = []
    r_vcols = []
    for layer in range(2):
        dy = -layer * layer_drop * sy
        for ix in range(nx + 1):
            u = ix / nx - 0.5
            slope_shade = 1.02 - 0.06 * abs(u) - (0.08 if layer == 1 else 0.0)
            c_vert = (slope_shade, slope_shade, slope_shade)
            for iz in range(nz + 1):
                v = iz / nz - 0.5
                r_verts.append(local_pt(u, v, dy))
                r_vcols.append(c_vert)

    stride = nz + 1
    offset = (nx + 1) * stride
    r_faces = []
    r_smooth = []
    for ix in range(nx):
        for iz in range(nz):
            k = ix * stride + iz
            r_faces.append((k, k + 1, k + stride + 1, k + stride))
            r_smooth.append(True)
            r_faces.append((k + offset, k + stride + offset, k + stride + 1 + offset, k + 1 + offset))
            r_smooth.append(True)

    for i in range(nx):
        a, b = i * stride, (i + 1) * stride
        r_faces.append((a, b, b + offset, a + offset))
        r_smooth.append(False)
        a2, b2 = (i + 1) * stride + nz, i * stride + nz
        r_faces.append((a2, b2, b2 + offset, a2 + offset))
        r_smooth.append(False)

    for i in range(nz):
        a, b = i + 1, i
        r_faces.append((a, b, b + offset, a + offset))
        r_smooth.append(False)
        a2, b2 = nx * stride + i, nx * stride + i + 1
        r_faces.append((a2, b2, b2 + offset, a2 + offset))
        r_smooth.append(False)

    mc.add_house_mesh(house, r_verts, r_faces, mat, vert_colors=r_vcols, face_smooth_list=r_smooth)

    # 2. Curved purlin courses along v (matching the 11 v20 roof courses at u = j/10 - 0.5, curved along v)
    if add_ribs and n_u_ribs > 0:
        rib_hw_bot = 0.021 / sx
        rib_hw_top = 0.012 / sx
        rib_h = 0.028 * min(1.0, sy / 1.0)
        segs_v = max(4, nz - 1)
        for j in range(n_u_ribs):
            u_c = j / max(1, n_u_ribs - 1) - 0.5
            u0_b = max(-0.5, u_c - rib_hw_bot)
            u1_b = min(0.5, u_c + rib_hw_bot)
            u0_t = max(-0.5, u_c - rib_hw_top)
            u1_t = min(0.5, u_c + rib_hw_top)
            tint = (0.95, 0.96, 0.98) if (j % 2 == 0) else (1.03, 1.03, 1.04)

            rv = []
            for iv in range(segs_v + 1):
                v = iv / segs_v - 0.5
                rv.append(local_pt(u0_b, v, -0.002))
                rv.append(local_pt(u0_t, v, rib_h))
                rv.append(local_pt(u1_t, v, rib_h))
                rv.append(local_pt(u1_b, v, -0.002))
            rf = []
            rs = []
            for iv in range(segs_v):
                b0 = iv * 4
                b1 = (iv + 1) * 4
                rf.append((b0 + 0, b1 + 0, b1 + 1, b0 + 1))
                rf.append((b0 + 1, b1 + 1, b1 + 2, b0 + 2))
                rf.append((b0 + 2, b1 + 2, b1 + 3, b0 + 3))
                rs.extend([True, True, True])
            rf.append((0, 1, 2, 3))
            lb = segs_v * 4
            rf.append((lb + 3, lb + 2, lb + 1, lb + 0))
            rs.extend([False, False])
            mc.add_house_mesh(house, rv, rf, mat, color=tint, face_smooth_list=rs)

    # 3. Standing-seam slate ribs running down the slope (along u, spaced across v)
    if add_ribs and n_v_ribs > 0:
        seam_hw_bot = 0.015 / sz
        seam_hw_top = 0.008 / sz
        seam_h = 0.022 * min(1.0, sy / 1.0)
        segs_u = max(8, nx // 2)
        for k in range(n_v_ribs):
            v_c = -0.46 + 0.92 * (k / max(1, n_v_ribs - 1))
            v0_b = v_c - seam_hw_bot
            v1_b = v_c + seam_hw_bot
            v0_t = v_c - seam_hw_top
            v1_t = v_c + seam_hw_top
            tint = (1.04, 1.04, 1.05) if (k % 2 == 0) else (0.96, 0.97, 0.98)

            sv = []
            for iu in range(segs_u + 1):
                u = iu / segs_u - 0.5
                sv.append(local_pt(u, v0_b, -0.001))
                sv.append(local_pt(u, v0_t, seam_h))
                sv.append(local_pt(u, v1_t, seam_h))
                sv.append(local_pt(u, v1_b, -0.001))
            sf = []
            ss = []
            for iu in range(segs_u):
                b0 = iu * 4
                b1 = (iu + 1) * 4
                sf.append((b0 + 0, b0 + 1, b1 + 1, b1 + 0))
                sf.append((b0 + 1, b0 + 2, b1 + 2, b1 + 1))
                sf.append((b0 + 2, b0 + 3, b1 + 3, b1 + 2))
                ss.extend([True, True, True])
            sf.append((3, 2, 1, 0))
            lb = segs_u * 4
            sf.append((lb + 0, lb + 1, lb + 2, lb + 3))
            ss.extend([False, False])
            mc.add_house_mesh(house, sv, sf, mat, color=tint, face_smooth_list=ss)

    # 4. Sculpted curved ridge beam & ridge cap tiles
    if add_ridge:
        ridge_u = -0.49 if style == 1 else 0.0
        rw_bot = (0.070 if sy > 1.0 else 0.052) / sx
        rw_top = (0.046 if sy > 1.0 else 0.034) / sx
        rh_top = 0.084 if sy > 1.0 else 0.052
        rh_bot = -0.024
        v_ext = (sz + 0.08) / (2.0 * sz)
        segs_r = max(5, nz)
        rv = []
        for iv in range(segs_r + 1):
            v = -v_ext + 2.0 * v_ext * (iv / segs_r)
            v_clamped = max(-0.5, min(0.5, v))
            h_val = neighbour_height(ridge_u, v_clamped, style)
            for u_off, y_off in ((-rw_bot, rh_bot), (-rw_top, rh_top), (rw_top, rh_top), (rw_bot, rh_bot)):
                px = (ridge_u + u_off) * sx
                py = h_val * sy + y_off
                pz = v * sz
                if rot_y_90:
                    rv.append((cx + pz, cy + py, cz - px))
                else:
                    rv.append((cx + px, cy + py, cz + pz))
        rf = []
        rs = []
        for iv in range(segs_r):
            b0 = iv * 4
            b1 = (iv + 1) * 4
            rf.append((b0 + 0, b1 + 0, b1 + 1, b0 + 1))
            rf.append((b0 + 1, b1 + 1, b1 + 2, b0 + 2))
            rf.append((b0 + 2, b1 + 2, b1 + 3, b0 + 3))
            rf.append((b0 + 3, b1 + 3, b1 + 0, b0 + 0))
            rs.extend([True, False, True, False])
        rf.append((0, 1, 2, 3))
        lb = segs_r * 4
        rf.append((lb + 3, lb + 2, lb + 1, lb + 0))
        rs.extend([False, False])
        mc.add_house_mesh(house, rv, rf, mat, color=(0.92, 0.94, 0.97), face_smooth_list=rs)

    # 5. Gable bargeboards (darkWood trim under the front & back roof edges, scaled to roof thickness)
    if add_bargeboards and mat_dark is not None:
        segs_b = max(8, nx // 2)
        bw = 0.030 / sz
        bh_top = -0.012 * (sy / 1.24)
        bh_bot = -0.088 * (sy / 1.24)
        for side_v in (-1, 1):
            v_out = side_v * 0.495
            v_in = side_v * (0.495 - bw)
            bv = []
            for iu in range(segs_b + 1):
                u = iu / segs_b - 0.5
                bv.append(local_pt(u, v_in, bh_bot))
                bv.append(local_pt(u, v_in, bh_top))
                bv.append(local_pt(u, v_out, bh_top))
                bv.append(local_pt(u, v_out, bh_bot))
            bf = []
            bs = []
            for iu in range(segs_b):
                b0 = iu * 4
                b1 = (iu + 1) * 4
                for r in range(4):
                    nr = (r + 1) % 4
                    if side_v > 0:
                        bf.append((b0 + r, b0 + nr, b1 + nr, b1 + r))
                    else:
                        bf.append((b0 + nr, b0 + r, b1 + r, b1 + nr))
                    bs.append(r in (1, 3))
            mc.add_house_mesh(house, bv, bf, mat_dark, face_smooth_list=bs)


def _build_gable_wall(mc, house, w, d, h, style, side, mat, base_col):
    """
    Builds a solid 3D extruded gable wall (thickness 0.042m) matching neighbourGable(w, d, style, side),
    tucking cleanly into the roof slab with zero gap under the ridge.
    """
    segs = 20
    z_front = side * (d * 0.5 + 0.016)
    z_back = side * (d * 0.5 - 0.026)
    y_base = h - 0.13
    z_norm = side * d / (2.0 * (d + 0.69))

    verts = []
    vcols = []
    for z_plane in (z_front, z_back):
        for i in range(segs + 1):
            lx = -w * 0.5 + w * (i / segs)
            u = lx / (w + 0.78)
            top_y = y_base + max(0.01, neighbour_height(u, z_norm, style) * 1.24 - 0.052)
            verts.append((lx, y_base, z_plane))
            verts.append((lx, top_y, z_plane))
            vcols.append(scale_color(base_col, 0.99))
            vcols.append(scale_color(base_col, 0.96))

    stride = (segs + 1) * 2
    faces = []
    smooth = []
    for i in range(segs):
        k = i * 2
        kb = stride + k
        if side > 0:
            faces.append((k, k + 2, k + 3, k + 1))
            faces.append((kb + 1, kb + 3, kb + 2, kb))
            faces.append((k + 1, k + 3, kb + 3, kb + 1))
        else:
            faces.append((k + 1, k + 3, k + 2, k))
            faces.append((kb, kb + 2, kb + 3, kb + 1))
            faces.append((kb + 1, kb + 3, k + 3, k + 1))
        smooth.extend([False, False, True])

    mc.add_house_mesh(house, verts, faces, mat, vert_colors=vcols, face_smooth_list=smooth)


def _build_stone_foundation(mc, house, w, d, mat_stone, rng):
    """
    Builds the house stone foundation at local (0, -0.12, 0), outer envelope (w + 0.36, 0.40, d + 0.35),
    with a recessed mortar-toned core and dressed stone blocks along front, back, and sides.
    """
    base_col = hex_to_linear('#c7cec4')
    core_col = scale_color(base_col, 0.88)
    total_w = w + 0.36
    total_d = d + 0.35

    # Core foundation block
    mc.add_beveled_box(house, (0.0, -0.122, 0.0), (total_w - 0.016, 0.394, total_d - 0.016),
                       mat_stone, bevel=0.008, segments=1, color=core_col)

    # Dressed perimeter ashlar stones along top & upper skirt (y in [-0.08, +0.08], center y=0.0, height=0.16)
    n_front = 6
    block_d = 0.14
    span_x = total_w - block_d * 2.0
    bw_x = span_x / n_front
    for sign_z in (-1, 1):
        zz = sign_z * (total_d * 0.5 - block_d * 0.5)
        n_cur = n_front if sign_z > 0 else 3
        bw_cur = span_x / n_cur
        for i in range(n_cur):
            xx = -span_x * 0.5 + (i + 0.5) * bw_cur
            c_blk = scale_color(base_col, 0.96 + rng() * 0.08)
            mc.add_chamfer_plank(house, (xx, 0.0, zz), (bw_cur - 0.008, 0.16, block_d),
                                 mat_stone, chamfer=0.006, axis='Y', color=c_blk)

    n_side = 4
    bw_z = total_d / n_side
    for sign_x in (-1, 1):
        xx = sign_x * (total_w * 0.5 - block_d * 0.5)
        for j in range(n_side):
            zz = -total_d * 0.5 + (j + 0.5) * bw_z
            c_blk = scale_color(base_col, 0.96 + rng() * 0.08)
            mc.add_chamfer_plank(house, (xx, 0.0, zz), (block_d, 0.16, bw_z - 0.008),
                                 mat_stone, chamfer=0.006, axis='Y', color=c_blk)


def build_all_neighbours_meshes(mats):
    """
    Contract entrypoint: builds all 8 outer-ring neighbour houses and their yards.
    Returns {'neighbours_<part>': bpy.types.Object} with glass in 'neighbours_glass'.
    """
    ensure_neighbours_materials(mats)
    rng = make_rng(20261018)

    mc_wall = WorldMeshCollector("neighbours_wall")
    mc_timber = WorldMeshCollector("neighbours_timber")
    mc_yard = WorldMeshCollector("neighbours_yard")
    mc_roof = WorldMeshCollector("neighbours_roof")
    mc_glass = WorldMeshCollector("neighbours_glass")

    mat_plaster = mats['neighbours_plaster']
    mat_stone = mats['neighbours_stone']
    mat_paving = mats['neighbours_paving']
    mat_gravel = mats['neighbours_gravel']
    mat_wood = mats['neighbours_wood']
    mat_dark_wood = mats['neighbours_dark_wood']
    mat_shutters = mats['neighbours_shutters']
    mat_roof = mats['neighbours_roof_slate']
    mat_glass_back = mats['proc_glass_backing']
    mat_mortar = mats['proc_mortar']
    mat_glass = mats['live_glass']

    c_fence_plaster = hex_to_linear('#e9ece5')
    c_fence_stone_base = hex_to_linear('#c5cfc0')
    c_sill_stone = hex_to_linear('#d6ddd2')
    c_paving_tint = hex_to_linear('#e8ece6')
    c_chimney_plaster = hex_to_linear('#cbd3c7')
    c_white = (1.0, 1.0, 1.0)

    for h_idx, house in enumerate(HOUSES):
        w = house['width']
        d = house['depth']
        h = house['height']
        style = house['style']
        yard_margin = house['yardFrontMargin']
        c_paint = hex_to_linear(house['paint'])

        # ------------------------------------------------------------------
        # 1. STONE FOUNDATION & MAIN / PANTRY PLASTER WALLS
        # ------------------------------------------------------------------
        _build_stone_foundation(mc_wall, house, w, d, mat_stone, rng)

        def wall_vcol(lx, ly, lz, ux, uy, uz, base_c=c_paint, full_h=h):
            t_y = max(0.0, min(1.0, ly / max(0.5, full_h)))
            f = 0.965 + 0.05 * math.sin(t_y * math.pi)
            return scale_color(base_c, f)

        # Main house body wall (exact collision footprint: w x h x d at (0, h/2, 0))
        mc_wall.add_beveled_box(house, (0.0, h * 0.5, 0.0), (w, h, d),
                                mat_plaster, bevel=0.014, segments=2, color=c_paint, vcol_fn=wall_vcol)
        # Subtle lower plaster plinth band
        mc_wall.add_beveled_box(house, (0.0, 0.095, 0.0), (w + 0.014, 0.17, d + 0.014),
                                mat_plaster, bevel=0.006, segments=1, color=scale_color(c_paint, 0.95))

        # Style 2 pantry wall (exact collision footprint: 1.22 x 1.30 x d*0.74 at (w/2 - 0.23, 0.65, -d*0.14))
        if style == 2:
            sx_p = w * 0.5 - 0.23
            sz_p = -d * 0.14
            sd_p = d * 0.74
            mc_wall.add_beveled_box(house, (sx_p, 0.65, sz_p), (1.22, 1.30, sd_p),
                                    mat_plaster, bevel=0.012, segments=2, color=c_paint,
                                    vcol_fn=lambda lx, ly, lz, ux, uy, uz: wall_vcol(lx, ly, lz, ux, uy, uz, c_paint, 1.30))
            # Pantry gable infill under rotated pantry roof
            p_segs = 10
            px_front = sx_p + 0.61
            px_back = sx_p + 0.57
            pv_verts = []
            for x_pl in (px_front, px_back):
                for ip in range(p_segs + 1):
                    lz_p = sz_p - sd_p * 0.5 + sd_p * (ip / p_segs)
                    u_p = -(lz_p - sz_p) / 1.68
                    v_p = (x_pl - sx_p) / (sd_p + 0.44)
                    top_py = max(1.25, 1.23 + neighbour_height(u_p, v_p, 0) * 0.82 - 0.04)
                    pv_verts.append((x_pl, 1.24, lz_p))
                    pv_verts.append((x_pl, top_py, lz_p))
            pv_stride = (p_segs + 1) * 2
            pv_faces = []
            for ip in range(p_segs):
                k = ip * 2
                kb = pv_stride + k
                pv_faces.append((k + 1, k + 3, k + 2, k))
                pv_faces.append((kb, kb + 2, kb + 3, kb + 1))
            mc_wall.add_house_mesh(house, pv_verts, pv_faces, mat_plaster, color=scale_color(c_paint, 0.98))

        # Front & back gable walls
        for side in (-1, 1):
            _build_gable_wall(mc_wall, house, w, d, h, style, side, mat_plaster, c_paint)

        # ------------------------------------------------------------------
        # 2. GARDEN FENCES (exact layout.mjs groundParts positions & sizes)
        # ------------------------------------------------------------------
        gate_clear = 1.8
        front_w = w + 0.78
        seg_w = (front_w - gate_clear) * 0.5
        front_z = d * 0.5 + yard_margin
        side_d = d + yard_margin + 0.30
        side_z = (yard_margin - 0.30) * 0.5

        for sign in (-1, 1):
            fx = sign * (gate_clear + seg_w) * 0.5
            if style == 1:
                # Wood picket front fence on segmented dressed stone curb
                n_curb = 2
                cw = seg_w / n_curb
                for ic in range(n_curb):
                    cxx = fx - seg_w * 0.5 + (ic + 0.5) * cw
                    mc_wall.add_chamfer_plank(house, (cxx, 0.07, front_z), (cw - 0.005, 0.14, 0.22),
                                              mat_stone, chamfer=0.006, axis='Y',
                                              color=scale_color(c_fence_stone_base, 0.96 + rng() * 0.08))
                # 2 horizontal wood rails
                for ry in (0.22, 0.44):
                    mc_timber.add_beveled_box(house, (fx, ry, front_z), (seg_w, 0.055, 0.065),
                                              mat_wood, bevel=0.004, segments=1, color=(0.97, 0.97, 0.97))
                # 7 vertical wood pickets with plank-to-plank tone variation
                for j in range(7):
                    px = fx - seg_w * 0.46 + j * seg_w * 0.153
                    p_tint = scale_color(c_white, 0.94 + rng() * 0.11)
                    mc_timber.add_beveled_box(house, (px, 0.25, front_z), (0.055, 0.50, 0.065),
                                              mat_wood, bevel=0.005, segments=1, color=p_tint)
            else:
                # Plaster front fence wall + segmented stone coping slabs
                mc_wall.add_beveled_box(house, (fx, 0.035, front_z), (seg_w - 0.01, 0.07, 0.17),
                                        mat_stone, bevel=0.004, segments=1, color=c_fence_stone_base)
                mc_wall.add_beveled_box(house, (fx, 0.21, front_z), (seg_w, 0.42, 0.13),
                                        mat_plaster, bevel=0.008, segments=1, color=c_fence_plaster)
                n_cap = 2
                cap_w = seg_w / n_cap
                for ic in range(n_cap):
                    cxx = fx - seg_w * 0.5 + (ic + 0.5) * cap_w
                    c_cap = scale_color(c_white, 0.96 + rng() * 0.07)
                    mc_wall.add_chamfer_plank(house, (cxx, 0.46, front_z), (cap_w - 0.005, 0.08, 0.22),
                                              mat_stone, chamfer=0.006, axis='Y', color=c_cap)

            # Side fence (always plaster wall + stone coping cap)
            sx_f = sign * (w * 0.5 + 0.39)
            mc_wall.add_beveled_box(house, (sx_f, 0.035, side_z), (0.17, 0.07, side_d - 0.01),
                                    mat_stone, bevel=0.004, segments=1, color=c_fence_stone_base)
            mc_wall.add_beveled_box(house, (sx_f, 0.21, side_z), (0.13, 0.42, side_d),
                                    mat_plaster, bevel=0.008, segments=1, color=c_fence_plaster)
            n_scap = 4
            scap_d = side_d / n_scap
            for ic in range(n_scap):
                czz = side_z - side_d * 0.5 + (ic + 0.5) * scap_d
                c_cap = scale_color(c_white, 0.96 + rng() * 0.07)
                mc_wall.add_chamfer_plank(house, (sx_f, 0.46, czz), (0.22, 0.08, scap_d - 0.006),
                                          mat_stone, chamfer=0.006, axis='Y', color=c_cap)

        # ------------------------------------------------------------------
        # 3. MAIN ROOF, EAVES, CORNER POSTS & WALL PLATES
        # ------------------------------------------------------------------
        _build_curved_roof_shell(
            mc_roof, house, style,
            center=(0.0, h - 0.13, 0.0),
            scale=(w + 0.78, 1.24, d + 0.69),
            mat=mat_roof,
            rot_y_90=False,
            nx=20, nz=6,
            add_ribs=True, n_u_ribs=11, n_v_ribs=7,
            add_ridge=True,
            add_bargeboards=True,
            mat_dark=mat_dark_wood,
        )

        for side in (-1, 1):
            # Eave fascia beams (darkWood)
            mc_roof.add_beveled_box(house, (side * (w + 0.70) * 0.5, h + 0.085, 0.0), (0.09, 0.10, d + 0.70),
                                    mat_dark_wood, bevel=0.006, segments=1)
            # Front & back corner timber posts
            mc_timber.add_beveled_box(house, (side * (w * 0.5 - 0.07), h * 0.5, d * 0.5 + 0.035), (0.12, h, 0.11),
                                      mat_wood, bevel=0.006, segments=1)
            mc_timber.add_beveled_box(house, (side * (w * 0.5 - 0.07), h * 0.5, -d * 0.5 - 0.020), (0.11, h, 0.08),
                                      mat_wood, bevel=0.005, segments=1, color=(0.95, 0.95, 0.95))

        # Front & back top wall plates (darkWood)
        for sign in (-1, 1):
            mc_timber.add_beveled_box(house, (0.0, h - 0.04, sign * d * 0.5), (w + 0.02, 0.14, 0.10),
                                      mat_dark_wood, bevel=0.006, segments=1)

        # ------------------------------------------------------------------
        # 4. FRONT DOOR (with tongue-and-groove vertical planks & battens)
        # ------------------------------------------------------------------
        mc_timber.add_open_frame(house, (0.0, 0.80, d * 0.5 + 0.032), 0.70, 1.60, 0.07, 0.078,
                                 mat_dark_wood, bevel=0.005, segments=1, orient='Z')
        # Recessed dark backing plate
        mc_timber.add_beveled_box(house, (0.0, 0.80, d * 0.5 + 0.064), (0.54, 1.42, 0.014),
                                  mat_dark_wood, bevel=0.0, segments=0, color=(0.82, 0.80, 0.78))
        # 5 vertical tongue-and-groove door planks at z = d/2 + 0.076, total width 0.55, height 1.43
        door_mat = mat_shutters if style == 1 else mat_wood
        n_dplanks = 5
        dp_w = 0.55 / n_dplanks
        for ip in range(n_dplanks):
            px = -0.275 + (ip + 0.5) * dp_w
            p_col = (0.96, 0.96, 0.96) if (ip % 2 == 0) else (1.03, 1.03, 1.03)
            mc_timber.add_chamfer_plank(house, (px, 0.80, d * 0.5 + 0.076), (dp_w - 0.0025, 1.43, 0.024),
                                        door_mat, chamfer=0.0035, axis='Z', color=p_col)
        # 3 horizontal door battens / ledge rails & handle latch
        for ry in (0.28, 0.80, 1.32):
            mc_timber.add_chamfer_plank(house, (0.0, ry, d * 0.5 + 0.091), (0.51, 0.038, 0.016),
                                        mat_dark_wood, chamfer=0.003, axis='Z')
        mc_timber.add_beveled_box(house, (0.20, 0.74, d * 0.5 + 0.098), (0.024, 0.095, 0.022),
                                  mat_dark_wood, bevel=0.003, segments=1, color=(0.75, 0.72, 0.68))

        # ------------------------------------------------------------------
        # 5. FRONT WINDOWS (x2) & SIDE WINDOWS (x2)
        # ------------------------------------------------------------------
        for side in (-1, 1):
            wx = side * w * 0.29
            # Front window outer darkWood frame at (wx, 1.26, d/2 + 0.027), size (0.80, 0.94, 0.12)
            mc_timber.add_open_frame(house, (wx, 1.26, d * 0.5 + 0.027), 0.80, 0.94, 0.12, 0.082,
                                     mat_dark_wood, bevel=0.006, segments=1, orient='Z')
            # Glass backing & glass pane
            mc_wall.add_beveled_box(house, (wx, 1.26, d * 0.5 + 0.094), (0.64, 0.78, 0.025),
                                    mat_glass_back, bevel=0.0, segments=0)
            mc_glass.add_beveled_box(house, (wx, 1.26, d * 0.5 + 0.126), (0.64, 0.78, 0.008),
                                     mat_glass, bevel=0.0, segments=0)
            # Inner wood sash border + 2 vertical mullions + 1 horizontal transom
            for sy_s in (-0.395, 0.395):
                mc_timber.add_chamfer_plank(house, (wx, 1.26 + sy_s, d * 0.5 + 0.132), (0.66, 0.026, 0.028),
                                            mat_wood, chamfer=0.003, axis='Z')
            for sx_s in (-0.317, 0.317):
                mc_timber.add_chamfer_plank(house, (wx + sx_s, 1.26, d * 0.5 + 0.132), (0.026, 0.764, 0.028),
                                            mat_wood, chamfer=0.003, axis='Z')
            for u_m in (-0.18, 0.18):
                mc_timber.add_chamfer_plank(house, (wx + u_m, 1.26, d * 0.5 + 0.137), (0.025, 0.80, 0.034),
                                            mat_wood, chamfer=0.003, axis='Z')
            mc_timber.add_chamfer_plank(house, (wx, 1.25, d * 0.5 + 0.140), (0.66, 0.034, 0.036),
                                        mat_wood, chamfer=0.003, axis='Z')

            # Dressed stone sill at (wx, 0.76, d/2 + 0.08), size (0.90, 0.11, 0.25) in 3 blocks
            sill_w = 0.90 / 3.0
            for is_blk in range(3):
                sxx = wx - 0.45 + (is_blk + 0.5) * sill_w
                mc_wall.add_beveled_box(house, (sxx, 0.76, d * 0.5 + 0.08), (sill_w - 0.004, 0.11, 0.25),
                                        mat_stone, bevel=0.006, segments=1,
                                        color=scale_color(c_sill_stone, 0.97 + (is_blk % 2) * 0.04))

            # Exterior shutter at (wx + side * 0.54, 1.26, d/2 + 0.073), size (0.23, 0.96, 0.035)
            sh_x = wx + side * 0.54
            mc_timber.add_beveled_box(house, (sh_x, 1.26, d * 0.5 + 0.062), (0.215, 0.94, 0.012),
                                      mat_dark_wood, bevel=0.0, segments=0)
            n_sh_planks = 3
            shp_w = 0.23 / n_sh_planks
            for isp in range(n_sh_planks):
                spx = sh_x - 0.115 + (isp + 0.5) * shp_w
                sh_col = (0.97, 0.98, 0.97) if (isp % 2 == 0) else (1.03, 1.03, 1.03)
                mc_timber.add_chamfer_plank(house, (spx, 1.26, d * 0.5 + 0.074), (shp_w - 0.002, 0.96, 0.032),
                                            mat_shutters, chamfer=0.0035, axis='Z', color=sh_col)
            for j in range(3):
                mc_timber.add_chamfer_plank(house, (sh_x, 1.00 + j * 0.26, d * 0.5 + 0.101), (0.215, 0.025, 0.030),
                                            mat_shutters, chamfer=0.003, axis='Z', color=(0.94, 0.95, 0.94))

            # Side window at (side * (w/2 + 0.026), 1.20, 0), size (0.10, 0.85, 0.88)
            sw_x = side * (w * 0.5 + 0.026)
            mc_timber.add_open_frame(house, (sw_x, 1.20, 0.0), 0.88, 0.85, 0.10, 0.085,
                                     mat_dark_wood, bevel=0.005, segments=1, orient='X')
            mc_wall.add_beveled_box(house, (side * (w * 0.5 + 0.083), 1.20, 0.0), (0.020, 0.66, 0.71),
                                    mat_glass_back, bevel=0.0, segments=0)
            mc_glass.add_beveled_box(house, (side * (w * 0.5 + 0.099), 1.20, 0.0), (0.008, 0.66, 0.71),
                                     mat_glass, bevel=0.0, segments=0)
            for v_m in (-0.22, 0.22):
                mc_timber.add_beveled_box(house, (side * (w * 0.5 + 0.105), 1.20, v_m), (0.023, 0.69, 0.022),
                                          mat_wood, bevel=0.003, segments=1)
            mc_timber.add_beveled_box(house, (side * (w * 0.5 + 0.105), 1.20, 0.0), (0.023, 0.024, 0.73),
                                      mat_wood, bevel=0.003, segments=1)

        # ------------------------------------------------------------------
        # 6. FRONT PAVING PAD & YARD GRAVEL PATH
        # ------------------------------------------------------------------
        pad_z = d * 0.5 + 0.40
        mc_yard.add_beveled_box(house, (0.0, 0.018, pad_z), (0.85, 0.064, 0.78),
                                mat_mortar, bevel=0.0, segments=0)
        for ix_p in range(2):
            for iz_p in range(2):
                px = -0.2175 + ix_p * 0.435
                pz = pad_z - 0.20 + iz_p * 0.40
                c_pv = scale_color(c_paving_tint, 0.97 + rng() * 0.05)
                mc_yard.add_chamfer_plank(house, (px, 0.025, pz), (0.427, 0.08, 0.392),
                                          mat_paving, chamfer=0.005, axis='Y', color=c_pv)

        # Yard gravel path at (0, 0.009, d/2 + (yardFrontMargin + 0.4)/2), size (1.40, 0.014, yardFrontMargin - 0.25)
        grav_z = d * 0.5 + (yard_margin + 0.40) * 0.5
        grav_d = yard_margin - 0.25
        grav_w = 1.40
        gnx, gnz = 5, 6
        g_verts = []
        g_vcols = []
        for layer in range(2):
            for ix in range(gnx + 1):
                u = ix / gnx - 0.5
                edge_taper = max(0.0, 1.0 - (abs(u) * 1.92) ** 4.0)
                for iz in range(gnz + 1):
                    v = iz / gnz - 0.5
                    gx = u * grav_w
                    gz = grav_z + v * grav_d
                    if layer == 0:
                        gy = 0.002 + 0.0145 * edge_taper + 0.002 * math.cos(u * math.pi)
                    else:
                        gy = 0.001
                    g_verts.append((gx, gy, gz))
                    shade = 0.95 + 0.07 * edge_taper + (rng() - 0.5) * 0.04
                    g_vcols.append((shade, shade, shade))
        g_stride = gnz + 1
        g_off = (gnx + 1) * g_stride
        g_faces = []
        for ix in range(gnx):
            for iz in range(gnz):
                k = ix * g_stride + iz
                g_faces.append((k, k + 1, k + g_stride + 1, k + g_stride))
                g_faces.append((k + g_off, k + g_stride + g_off, k + g_stride + 1 + g_off, k + 1 + g_off))
        for i in range(gnx):
            a, b = i * g_stride, (i + 1) * g_stride
            g_faces.append((a, b, b + g_off, a + g_off))
            a2, b2 = (i + 1) * g_stride + gnz, i * g_stride + gnz
            g_faces.append((a2, b2, b2 + g_off, a2 + g_off))
        for i in range(gnz):
            a, b = i + 1, i
            g_faces.append((a, b, b + g_off, a + g_off))
            a2, b2 = gnx * g_stride + i, gnx * g_stride + i + 1
            g_faces.append((a2, b2, b2 + g_off, a2 + g_off))
        mc_yard.add_house_mesh(house, g_verts, g_faces, mat_gravel, vert_colors=g_vcols)

        # ------------------------------------------------------------------
        # 7. STYLE-SPECIFIC ARCHITECTURE (style 0, 1, 2)
        # ------------------------------------------------------------------
        if style == 0:
            # Porch roof at (0, 1.91, d/2 + 0.33), scale (w*0.72, 0.53, 1.10)
            _build_curved_roof_shell(
                mc_roof, house, 0,
                center=(0.0, 1.91, d * 0.5 + 0.33),
                scale=(w * 0.72, 0.53, 1.10),
                mat=mat_roof,
                rot_y_90=False,
                nx=14, nz=4,
                add_ribs=True, n_u_ribs=5, n_v_ribs=5,
                add_ridge=True,
                add_bargeboards=True,
                mat_dark=mat_dark_wood,
            )
            # Porch posts & stone bases (matching v20 + engaged wall pilasters at z = d/2 + 0.025)
            for side in (-1, 1):
                mc_timber.add_beveled_box(house, (side * w * 0.27, 0.97, d * 0.5 - 0.09), (0.073, 1.91, 0.073),
                                          mat_wood, bevel=0.004, segments=1)
                mc_wall.add_beveled_box(house, (side * w * 0.27, 0.14, d * 0.5 - 0.09), (0.16, 0.29, 0.16),
                                        mat_stone, bevel=0.005, segments=1)
                # Engaged porch wall pilasters flanking the door at x = side * 0.40, z = d/2 + 0.025
                mc_timber.add_beveled_box(house, (side * 0.40, 1.10, d * 0.5 + 0.025), (0.068, 1.66, 0.055),
                                          mat_wood, bevel=0.004, segments=1)
                mc_wall.add_beveled_box(house, (side * 0.40, 0.18, d * 0.5 + 0.030), (0.11, 0.24, 0.08),
                                        mat_stone, bevel=0.005, segments=1)

            # Porch front beam (darkWood)
            mc_roof.add_beveled_box(house, (0.0, 1.94, d * 0.5 + 0.69), (w * 0.62, 0.085, 0.085),
                                    mat_dark_wood, bevel=0.006, segments=1)

            # Porch deck: darkWood subfloor joists + 6 beveled wood planks
            # Sized +3mm outside v20_live.glb's legacy floor planks so zero coplanar Z-fighting occurs
            mc_timber.add_beveled_box(house, (0.0, 0.248, d * 0.5 + 0.65), (w * 0.61, 0.036, 0.58),
                                      mat_dark_wood, bevel=0.003, segments=1)
            for j in range(6):
                px = -w * 0.27 + j * w * 0.108
                p_col = scale_color(c_white, 0.96 + (j % 2) * 0.06)
                mc_timber.add_beveled_box(house, (px, 0.29, d * 0.5 + 0.65), (w * 0.095 + 0.006, 0.061, 0.626),
                                          mat_wood, bevel=0.0025, segments=1, color=p_col)

            # 2 front paving steps at [[d/2 + 1.24, 0.0525], [d/2 + 0.99, 0.160]], size [1.20, 0.085, 0.34]
            for sz_step, sy_step in ((d * 0.5 + 1.24, 0.0525), (d * 0.5 + 0.99, 0.160)):
                mc_yard.add_beveled_box(house, (0.0, sy_step - 0.006, sz_step), (1.17, 0.072, 0.31),
                                        mat_mortar, bevel=0.0, segments=0)
                n_st_slabs = 3
                st_w = 1.20 / n_st_slabs
                for is_st in range(n_st_slabs):
                    st_x = -0.60 + (is_st + 0.5) * st_w
                    c_st = scale_color(c_paving_tint, 0.97 + rng() * 0.05)
                    mc_yard.add_chamfer_plank(house, (st_x, sy_step, sz_step), (st_w - 0.005, 0.085, 0.34),
                                              mat_paving, chamfer=0.005, axis='Y', color=c_st)

            # Chimney at (w*0.30, h+0.41, -d*0.21), size (0.30, 0.99, 0.33) + slate cap
            ch_x, ch_z = w * 0.30, -d * 0.21
            mc_roof.add_beveled_box(house, (ch_x, h + 0.41, ch_z), (0.30, 0.99, 0.33),
                                    mat_plaster, bevel=0.010, segments=2, color=c_chimney_plaster)
            roof_y_ch = (h - 0.13) + neighbour_height(ch_x / (w + 0.78), ch_z / (d + 0.69), 0) * 1.24
            mc_roof.add_beveled_box(house, (ch_x, roof_y_ch + 0.02, ch_z), (0.36, 0.055, 0.39),
                                    mat_roof, bevel=0.006, segments=1)
            mc_roof.add_beveled_box(house, (ch_x, h + 0.84, ch_z), (0.33, 0.04, 0.36),
                                    mat_stone, bevel=0.005, segments=1, color=c_chimney_plaster)
            mc_roof.add_beveled_box(house, (ch_x, h + 0.93, ch_z), (0.41, 0.11, 0.43),
                                    mat_roof, bevel=0.008, segments=2)

        elif style == 1:
            # High clerestory window at (-w*0.18, h-0.20, d/2+0.04), size (1.00, 0.31, 0.09)
            hw_x, hw_y = -w * 0.18, h - 0.20
            mc_timber.add_open_frame(house, (hw_x, hw_y, d * 0.5 + 0.04), 1.00, 0.31, 0.09, 0.055,
                                     mat_dark_wood, bevel=0.005, segments=1, orient='Z')
            mc_wall.add_beveled_box(house, (hw_x, hw_y, d * 0.5 + 0.092), (0.86, 0.21, 0.018),
                                    mat_glass_back, bevel=0.0, segments=0)
            mc_glass.add_beveled_box(house, (hw_x, hw_y, d * 0.5 + 0.110), (0.86, 0.21, 0.008),
                                     mat_glass, bevel=0.0, segments=0)
            for u_hm in (-0.28, 0.28):
                mc_timber.add_chamfer_plank(house, (hw_x + u_hm, hw_y, d * 0.5 + 0.114), (0.022, 0.22, 0.020),
                                            mat_wood, chamfer=0.003, axis='Z')

        else:
            # Style 2: Pantry roof at (w/2 - 0.23, 1.23, -d*0.14), scale (1.68, 0.82, d*0.74 + 0.44), rot_y = pi/2
            sx_p = w * 0.5 - 0.23
            _build_curved_roof_shell(
                mc_roof, house, 0,
                center=(sx_p, 1.23, -d * 0.14),
                scale=(1.68, 0.82, d * 0.74 + 0.44),
                mat=mat_roof,
                rot_y_90=True,
                nx=14, nz=4,
                add_ribs=True, n_u_ribs=5, n_v_ribs=5,
                add_ridge=True,
                add_bargeboards=True,
                mat_dark=mat_dark_wood,
            )
            # Pantry small shuttered hatch/door at (sx_p, 0.83, d*0.235)
            mc_timber.add_open_frame(house, (sx_p, 0.83, d * 0.235), 0.49, 0.61, 0.069, 0.055,
                                     mat_dark_wood, bevel=0.004, segments=1, orient='Z')
            mc_timber.add_beveled_box(house, (sx_p, 0.83, d * 0.235 + 0.036), (0.38, 0.48, 0.012),
                                      mat_dark_wood, bevel=0.0, segments=0)
            n_p_planks = 3
            pp_w = 0.39 / n_p_planks
            for ipp in range(n_p_planks):
                ppx = sx_p - 0.195 + (ipp + 0.5) * pp_w
                p_col = (0.97, 0.98, 0.97) if (ipp % 2 == 0) else (1.03, 1.03, 1.03)
                mc_timber.add_chamfer_plank(house, (ppx, 0.83, d * 0.235 + 0.045), (pp_w - 0.002, 0.49, 0.025),
                                            mat_shutters, chamfer=0.003, axis='Z', color=p_col)
            for ry_p in (0.68, 0.98):
                mc_timber.add_chamfer_plank(house, (sx_p, ry_p, d * 0.235 + 0.060), (0.36, 0.024, 0.014),
                                            mat_shutters, chamfer=0.002, axis='Z', color=(0.93, 0.94, 0.93))

            # 9 vertical front wainscot/board-fence planks + top/bottom horizontal rails
            for ry_w in (0.14, 0.64):
                mc_timber.add_chamfer_plank(house, (0.0, ry_w, d * 0.5 + 0.028), (w * 0.92, 0.036, 0.028),
                                            mat_dark_wood, chamfer=0.003, axis='Z')
            for j in range(9):
                bx = -w * 0.42 + j * w * 0.105
                b_col = scale_color(c_white, 0.95 + rng() * 0.10)
                mc_timber.add_chamfer_plank(house, (bx, 0.39, d * 0.5 + 0.043), (w * 0.089, 0.59, 0.038),
                                            mat_wood, chamfer=0.004, axis='Z', color=b_col)

    objs = {
        'neighbours_wall': mc_wall.build_object(shade_smooth=True),
        'neighbours_timber': mc_timber.build_object(shade_smooth=True),
        'neighbours_yard': mc_yard.build_object(shade_smooth=True),
        'neighbours_roof': mc_roof.build_object(shade_smooth=True),
        'neighbours_glass': mc_glass.build_object(shade_smooth=True),
    }
    return objs

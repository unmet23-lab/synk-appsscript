import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Quaternion, Euler

import mat_builder

TAU = math.pi * 2.0
GH_Z_OFFSET = -6.0  # PLACES['greenhouse'] = [0, -6]


def make_rng(seed):
    s = seed & 0xFFFFFFFF

    def rng():
        nonlocal s
        s = (1664525 * s + 1013904223) & 0xFFFFFFFF
        return s / 4294967296.0

    return rng


def srgb_to_linear(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(hex_str):
    h = hex_str.lstrip('#')
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b))


def lerp_color(c1, c2, t):
    t = max(0.0, min(1.0, t))
    return (
        c1[0] + (c2[0] - c1[0]) * t,
        c1[1] + (c2[1] - c1[1]) * t,
        c1[2] + (c2[2] - c1[2]) * t,
    )


def t2b(tx, ty, tz):
    """Town (x, y, z) -> Blender (x, -z, y)"""
    return Vector((tx, -tz, ty))


class MeshCollector:
    """Collects geometry in Town world coordinates and builds a Blender Mesh Object."""

    def __init__(self, name):
        self.name = name
        self.verts = []
        self.faces = []
        self.mat_ids = []
        self.face_colors = []
        self.materials = []
        self.mat_map = {}

    def get_mat_index(self, mat):
        if mat.name not in self.mat_map:
            self.mat_map[mat.name] = len(self.materials)
            self.materials.append(mat)
        return self.mat_map[mat.name]

    def add_town_mesh(self, town_verts, faces, mat, color=(1.0, 1.0, 1.0), vert_colors=None):
        offset = len(self.verts)
        for tx, ty, tz in town_verts:
            self.verts.append(t2b(tx, ty, tz))
        m_idx = self.get_mat_index(mat)
        for f in faces:
            if len(f) < 3:
                continue
            self.faces.append(tuple(offset + i for i in f))
            self.mat_ids.append(m_idx)
            if vert_colors is not None:
                self.face_colors.append([vert_colors[i] for i in f])
            else:
                self.face_colors.append([color for _ in f])

    def add_beveled_box(
        self,
        center,
        size,
        mat,
        rot_euler=(0.0, 0.0, 0.0),
        bevel=0.006,
        segments=2,
        color=(1.0, 1.0, 1.0),
        parent_center=None,
        parent_rot=(0.0, 0.0, 0.0),
    ):
        """
        Adds a beveled box in Town coordinates.
        If parent_center / parent_rot are given, `center` and `rot_euler` are local to that parent group.
        """
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        sx, sy, sz = size
        for v in bm.verts:
            v.co.x *= sx
            v.co.y *= sy
            v.co.z *= sz
        if bevel > 0.0:
            max_b = min(sx, sy, sz) * 0.35
            actual_b = min(bevel, max_b)
            if actual_b > 0.0004:
                bmesh.ops.bevel(
                    bm,
                    geom=bm.edges[:],
                    offset=actual_b,
                    segments=segments,
                    profile=0.5,
                    affect='EDGES',
                )
        eul = Euler(rot_euler, 'XYZ')
        rot_mat = eul.to_matrix().to_4x4()
        cx, cy, cz = center

        if parent_center is not None:
            p_eul = Euler(parent_rot, 'XYZ')
            p_mat = p_eul.to_matrix().to_4x4()
            px, py, pz = parent_center
        else:
            p_mat = None

        town_verts = []
        for v in bm.verts:
            p = rot_mat @ v.co + Vector((cx, cy, cz))
            if p_mat is not None:
                p = (p_mat @ p) + Vector((px, py, pz))
            town_verts.append((p.x, p.y, p.z))

        bm.verts.ensure_lookup_table()
        faces = [[v.index for v in f.verts] for f in bm.faces]
        bm.free()
        self.add_town_mesh(town_verts, faces, mat, color=color)

    def add_cylinder_between(self, a, b, radius_a, radius_b, mat, sides=12, cap=True, color=(1.0, 1.0, 1.0)):
        va = Vector(a)
        vb = Vector(b)
        diff = vb - va
        length = diff.length
        if length < 1e-6:
            return
        up = Vector((0, 1, 0))
        direction = diff.normalized()
        quat = up.rotation_difference(direction)
        rot_mat = quat.to_matrix().to_4x4()
        mid = (va + vb) * 0.5

        town_verts = []
        for y_local, r in [(-length * 0.5, radius_a), (length * 0.5, radius_b)]:
            for i in range(sides):
                ang = i * TAU / sides
                local_p = Vector((math.cos(ang) * r, y_local, math.sin(ang) * r))
                wp = mid + (rot_mat @ local_p)
                town_verts.append((wp.x, wp.y, wp.z))
        faces = []
        for i in range(sides):
            ni = (i + 1) % sides
            faces.append((i, i + sides, ni + sides, ni))
        if cap and radius_a > 1e-5:
            faces.append(tuple(range(sides)))
        if cap and radius_b > 1e-5:
            faces.append(tuple(sides + i for i in reversed(range(sides))))
        self.add_town_mesh(town_verts, faces, mat, color=color)

    def add_catmull_tube(self, points, r_start, r_end, mat, segs=18, sides=10, cap=True, color=(1.0, 1.0, 1.0)):
        pts = [Vector(p) for p in points]
        n = len(pts)
        if n < 2:
            return

        def eval_catmull(t_global):
            scaled = t_global * (n - 1)
            idx = min(int(math.floor(scaled)), n - 2)
            t = scaled - idx
            p0 = pts[max(0, idx - 1)]
            p1 = pts[idx]
            p2 = pts[idx + 1]
            p3 = pts[min(n - 1, idx + 2)]
            t2 = t * t
            t3 = t2 * t
            return 0.5 * (
                (2.0 * p1)
                + (-p0 + p2) * t
                + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
                + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
            )

        samples = [eval_catmull(i / segs) for i in range(segs + 1)]
        town_verts = []
        up = Vector((0, 1, 0))
        for i, center in enumerate(samples):
            t_frac = i / segs
            if i == 0:
                tang = (samples[1] - samples[0]).normalized()
            elif i == segs:
                tang = (samples[segs] - samples[segs - 1]).normalized()
            else:
                tang = (samples[i + 1] - samples[i - 1]).normalized()
            ref = Vector((1, 0, 0)) if abs(tang.y) > 0.95 else up
            axis1 = tang.cross(ref).normalized()
            axis2 = axis1.cross(tang).normalized()
            r = r_start + (r_end - r_start) * t_frac
            for j in range(sides):
                ang = j * TAU / sides
                v = center + axis1 * (math.cos(ang) * r) + axis2 * (math.sin(ang) * r)
                town_verts.append((v.x, v.y, v.z))
        faces = []
        for i in range(segs):
            for j in range(sides):
                nj = (j + 1) % sides
                a = i * sides + j
                b = i * sides + nj
                c = (i + 1) * sides + nj
                d = (i + 1) * sides + j
                faces.append((a, d, c, b))
        if cap:
            faces.append(tuple(range(sides)))
            faces.append(tuple(segs * sides + j for j in reversed(range(sides))))
        self.add_town_mesh(town_verts, faces, mat, color=color)

    def build_object(self, shade_smooth=True):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.verts, [], self.faces)
        for mat in self.materials:
            mesh.materials.append(mat)
        for i, poly in enumerate(mesh.polygons):
            poly.material_index = self.mat_ids[i]
            poly.use_smooth = shade_smooth

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
        mesh.validate(verbose=False)
        mesh.update()
        return obj


def build_greenhouse_materials():
    """Builds procedural materials and adds greenhouse-tuned variants matching v20 colors."""
    mats = mat_builder.build_procedural_materials()

    # 1. proc_gh_paving: Matches v20 greenhouse maru (#eef0ed base * vertex tint #f0ede4..#d4d5ca)
    mat, nt, bsdf = mat_builder._new_proc_mat("proc_gh_paving")
    bsdf.inputs["Roughness"].default_value = 0.90
    _, mapping = mat_builder._add_world_coord(nt, scale=(3.5, 3.5, 3.5))
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 7.5
    noise.inputs["Detail"].default_value = 4.0
    noise.inputs["Roughness"].default_value = 0.55
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    col_pv = nt.nodes.new("ShaderNodeMix")
    col_pv.data_type = 'RGBA'
    col_pv.inputs[6].default_value = mat_builder.rgba_linear("#e3e6e2")
    col_pv.inputs[7].default_value = mat_builder.rgba_linear("#f0f2ef")
    nt.links.new(noise.outputs["Fac"], col_pv.inputs["Factor"])
    final_col = mat_builder._add_vertex_color_multiply(nt, col_pv.outputs[2])
    nt.links.new(final_col, bsdf.inputs["Base Color"])
    mat_builder._add_bump(nt, bsdf, noise.outputs["Fac"], strength=0.04, distance=0.003)
    mats['proc_gh_paving'] = mat

    # 2. proc_gh_metal: Matches v20 metal (#46564d dark sage-pewter eaves gutter)
    mat, nt, bsdf = mat_builder._new_proc_mat("proc_gh_metal")
    bsdf.inputs["Roughness"].default_value = 0.46
    _, mapping = mat_builder._add_world_coord(nt, scale=(8.0, 8.0, 8.0))
    noise_m = nt.nodes.new("ShaderNodeTexNoise")
    noise_m.inputs["Scale"].default_value = 12.0
    noise_m.inputs["Detail"].default_value = 3.0
    nt.links.new(mapping.outputs["Vector"], noise_m.inputs["Vector"])
    col_m = nt.nodes.new("ShaderNodeMix")
    col_m.data_type = 'RGBA'
    col_m.inputs[6].default_value = mat_builder.rgba_linear("#3f4e46")
    col_m.inputs[7].default_value = mat_builder.rgba_linear("#4d5e55")
    nt.links.new(noise_m.outputs["Fac"], col_m.inputs["Factor"])
    nt.links.new(col_m.outputs[2], bsdf.inputs["Base Color"])
    mat_builder._add_bump(nt, bsdf, noise_m.outputs["Fac"], strength=0.03, distance=0.002)
    mats['proc_gh_metal'] = mat

    # 3. proc_gh_soil: Rich dark potting soil matching v20 soil (#66553e)
    mat, nt, bsdf = mat_builder._new_proc_mat("proc_gh_soil")
    bsdf.inputs["Roughness"].default_value = 0.96
    _, mapping = mat_builder._add_world_coord(nt, scale=(14.0, 14.0, 14.0))
    noise_s = nt.nodes.new("ShaderNodeTexNoise")
    noise_s.inputs["Scale"].default_value = 16.0
    noise_s.inputs["Detail"].default_value = 5.0
    nt.links.new(mapping.outputs["Vector"], noise_s.inputs["Vector"])
    col_s = nt.nodes.new("ShaderNodeMix")
    col_s.data_type = 'RGBA'
    col_s.inputs[6].default_value = mat_builder.rgba_linear("#5c4c37")
    col_s.inputs[7].default_value = mat_builder.rgba_linear("#6f5d45")
    nt.links.new(noise_s.outputs["Fac"], col_s.inputs["Factor"])
    final_col = mat_builder._add_vertex_color_multiply(nt, col_s.outputs[2])
    nt.links.new(final_col, bsdf.inputs["Base Color"])
    mat_builder._add_bump(nt, bsdf, noise_s.outputs["Fac"], strength=0.09, distance=0.005)
    mats['proc_gh_soil'] = mat

    # 4. proc_gh_frame: Deep slate-navy iron frame matching v20 metallic #3c4b57 appearance
    mat, nt, bsdf = mat_builder._new_proc_mat("proc_gh_frame")
    bsdf.inputs["Roughness"].default_value = 0.50
    _, mapping = mat_builder._add_world_coord(nt, scale=(8.0, 8.0, 8.0))
    noise_f = nt.nodes.new("ShaderNodeTexNoise")
    noise_f.inputs["Scale"].default_value = 14.0
    noise_f.inputs["Detail"].default_value = 3.0
    nt.links.new(mapping.outputs["Vector"], noise_f.inputs["Vector"])
    col_f = nt.nodes.new("ShaderNodeMix")
    col_f.data_type = 'RGBA'
    col_f.inputs[6].default_value = mat_builder.rgba_linear("#253440")
    col_f.inputs[7].default_value = mat_builder.rgba_linear("#334452")
    nt.links.new(noise_f.outputs["Fac"], col_f.inputs["Factor"])
    final_col = mat_builder._add_vertex_color_multiply(nt, col_f.outputs[2])
    nt.links.new(final_col, bsdf.inputs["Base Color"])
    mat_builder._add_bump(nt, bsdf, noise_f.outputs["Fac"], strength=0.04, distance=0.002)
    mats['proc_gh_frame'] = mat

    return mats


def build_greenhouse_maru(mats):
    """
    Builds `greenhouse_maru`:
    - Mortar deck base at (0, -0.036, -6.85), size (4.6, 0.20, 4.2)
    - Recessed mortar joint bed beneath stone slabs
    - 15 rows of dressed stone-plank courses with subtle staggered joints and beveled edges
      Top surface is strictly at y = 0.1295, spanning x in [-2.275, 2.275], z in [-8.871, -4.773].
    """
    mc = MeshCollector("greenhouse_maru")

    # 1. Mortar base deck
    mc.add_beveled_box(
        (0.0, -0.036, -0.85 + GH_Z_OFFSET),
        (4.60, 0.20, 4.20),
        mats['proc_mortar'],
        bevel=0.008,
        segments=2,
    )

    # 2. Recessed mortar shadow bed under slab seams (y = 0.064..0.082)
    mc.add_beveled_box(
        (0.0, 0.073, -0.822 + GH_Z_OFFSET),
        (4.48, 0.018, 4.08),
        mats['proc_mortar'],
        bevel=0.003,
        segments=1,
        color=(0.68, 0.67, 0.64),
    )

    # 3. 15 rows of dressed stone planks (exact v20 footprint and seeded tints)
    rng = make_rng(81026)
    # Advance RNG for home, cafe, workshop maru (15 rows each = 45 calls) so greenhouse gets exact v20 sequence
    for _ in range(45):
        rng()
    c_light = hex_to_linear('#f0ede4')
    c_warm = hex_to_linear('#d4d5ca')

    x_min, x_max = -2.275, 2.275
    seam_gap = 0.0035

    for iz in range(15):
        t_val = rng() * 0.15
        row_col = lerp_color(c_light, c_warm, t_val)
        z_c = -2.74 + iz * 0.274 + GH_Z_OFFSET

        # Staggered ashlar/plank joints along X while keeping exact outer bounds [-2.275, 2.275]
        if iz % 3 == 0:
            splits = [x_min, -0.62, 0.88, x_max]
        elif iz % 3 == 1:
            splits = [x_min, -0.95, 0.52, x_max]
        else:
            splits = [x_min, -0.24, 1.12, x_max]

        for seg_idx in range(len(splits) - 1):
            x0 = splits[seg_idx] + (0.0 if seg_idx == 0 else seam_gap * 0.5)
            x1 = splits[seg_idx + 1] - (0.0 if seg_idx == len(splits) - 2 else seam_gap * 0.5)
            seg_w = x1 - x0
            seg_cx = (x0 + x1) * 0.5
            dt = ((seg_idx - 1) * 0.018)
            seg_col = lerp_color(c_light, c_warm, max(0.0, min(0.18, t_val + dt)))
            # Center y = 0.102, height = 0.055 -> top is 0.102 + 0.0275 = 0.1295
            mc.add_beveled_box(
                (seg_cx, 0.102, z_c),
                (seg_w, 0.055, 0.262),
                mats['proc_gh_paving'],
                bevel=0.004,
                segments=2,
                color=seg_col,
            )

    return mc.build_object(shade_smooth=True)


def build_greenhouse_curb(mats):
    """
    Builds `greenhouse_curb`:
    - Side darkWood border timbers at x = +-2.25, y = 0.102, z = -6.82, size (0.075, 0.055, 4.12)
    - Front dressed stone step apron at (0, 0.006, -4.80), size (4.54, 0.24, 0.075) split into 5 stone blocks
    """
    mc = MeshCollector("greenhouse_curb")

    # 1. Side darkWood border timbers (split into 2 scarf-jointed lengths per side)
    for sx in (-2.25, 2.25):
        z_mid = -0.82 + GH_Z_OFFSET
        z_start = z_mid - 2.06
        z_end = z_mid + 2.06
        z_joint = z_mid + (0.18 if sx > 0 else -0.18)
        for z0, z1, c_mult in [(z_start, z_joint - 0.002, (1.0, 1.0, 1.0)), (z_joint + 0.002, z_end, (0.95, 0.95, 0.94))]:
            mc.add_beveled_box(
                (sx, 0.102, (z0 + z1) * 0.5),
                (0.075, 0.055, z1 - z0),
                mats['proc_dark_wood'],
                bevel=0.0045,
                segments=2,
                color=c_mult,
            )

    # 2. Front stone curb at (0, 0.006, 1.20 + GH_Z_OFFSET), total size (4.54, 0.24, 0.075)
    z_curb = 1.20 + GH_Z_OFFSET
    # Inner mortar core for stone joints
    mc.add_beveled_box(
        (0.0, 0.006, z_curb),
        (4.52, 0.228, 0.065),
        mats['proc_mortar'],
        bevel=0.003,
        segments=1,
    )
    n_stones = 5
    total_w = 4.54
    stone_gap = 0.004
    block_w = (total_w - stone_gap * (n_stones - 1)) / n_stones
    stone_tints = [
        (1.00, 1.00, 0.99),
        (0.96, 0.97, 0.96),
        (1.01, 1.00, 0.98),
        (0.97, 0.98, 0.97),
        (0.99, 0.99, 0.98),
    ]
    for i in range(n_stones):
        bx = -total_w * 0.5 + block_w * 0.5 + i * (block_w + stone_gap)
        mc.add_beveled_box(
            (bx, 0.006, z_curb),
            (block_w, 0.24, 0.075),
            mats['proc_stone'],
            bevel=0.0065,
            segments=2,
            color=stone_tints[i],
        )

    return mc.build_object(shade_smooth=True)


def build_greenhouse_sill(mats):
    """
    Builds `greenhouse_sill`:
    - Three-wall timber sills at y = 0.18 (rear at z = -7.90, left/right at x = +-1.90)
    - History hanger on right wall at (1.66, 1.10, -6.52)
    """
    mc = MeshCollector("greenhouse_sill")

    # 1. Rear wall timber sill: center (0, 0.18, -7.90), size (3.86, 0.13, 0.065)
    z_rear = -1.90 + GH_Z_OFFSET
    mc.add_beveled_box(
        (0.0, 0.174, z_rear),
        (3.86, 0.118, 0.065),
        mats['proc_wood'],
        bevel=0.005,
        segments=2,
    )
    # Upper weather-drip sill cap (reaches exact top y = 0.245)
    mc.add_beveled_box(
        (0.0, 0.238, z_rear),
        (3.868, 0.014, 0.073),
        mats['proc_wood'],
        bevel=0.003,
        segments=2,
        color=(0.95, 0.93, 0.90),
    )

    # 2. Left & right wall timber sills: center (+-1.90, 0.18, -6.70), size (0.065, 0.13, 2.64)
    z_side = -0.70 + GH_Z_OFFSET
    for sx in (-1.90, 1.90):
        mc.add_beveled_box(
            (sx, 0.174, z_side),
            (0.065, 0.118, 2.64),
            mats['proc_wood'],
            bevel=0.005,
            segments=2,
        )
        mc.add_beveled_box(
            (sx, 0.238, z_side),
            (0.073, 0.014, 2.648),
            mats['proc_wood'],
            bevel=0.003,
            segments=2,
            color=(0.95, 0.93, 0.90),
        )

    # 3. History hanger: anchor (1.66, 1.10, -0.52 + GH_Z_OFFSET), top = 1.325, mountY = 1.485
    hx, hy, hz = 1.66, 1.10, -0.52 + GH_Z_OFFSET
    top_y = hy + 0.225
    mount_y = top_y + 0.16
    # Support rod from x = 1.88 to x = 1.66
    mc.add_cylinder_between(
        (1.88, mount_y, hz),
        (hx, mount_y, hz),
        0.012,
        0.012,
        mats['proc_dark_wood'],
        sides=12,
        cap=True,
    )
    # Small mounting collar at the greenhouse frame post
    mc.add_beveled_box(
        (1.875, mount_y, hz),
        (0.016, 0.036, 0.036),
        mats['proc_dark_wood'],
        bevel=0.003,
        segments=1,
    )
    # Horizontal wooden hanger bar
    mc.add_beveled_box(
        (hx, mount_y, hz),
        (0.38, 0.027, 0.032),
        mats['proc_wood'],
        bevel=0.004,
        segments=2,
    )
    # Two hanging cotton cords
    for side in (-1, 1):
        cx = hx + side * 0.13
        mc.add_cylinder_between(
            (cx, mount_y, hz),
            (cx, top_y + 0.012, hz),
            0.0045,
            0.0045,
            mats['proc_cotton_white'],
            sides=8,
            cap=True,
        )

    return mc.build_object(shade_smooth=True)


def build_greenhouse_frame(mats):
    """
    Builds `greenhouse_frame`:
    - Dark blue-slate steel structure of the 3 walls, open front header, and pitched gable roof
    - Includes structural T-ribs, base shoe plates, glazing beads, and upper corner gusset plates
    """
    mc = MeshCollector("greenhouse_frame")
    fmat = mats['proc_gh_frame']

    eave = 2.60
    ridge = 3.06
    post_centre = (eave + 0.08) * 0.5  # 1.34
    post_height = eave - 0.08          # 2.52
    z_rear = -1.90 + GH_Z_OFFSET
    z_side = -0.70 + GH_Z_OFFSET
    z_front = 0.60 + GH_Z_OFFSET

    # 1. Rear wall vertical mullions (7 posts) + glazing T-ribs + base shoes
    for i in range(7):
        px = -1.91 + i * 0.64 if i < 6 else 1.91
        mc.add_beveled_box(
            (px, post_centre, z_rear),
            (0.035, post_height, 0.055),
            fmat,
            bevel=0.004,
            segments=2,
        )
        # Exterior/interior spine T-rib
        mc.add_beveled_box(
            (px, post_centre, z_rear),
            (0.015, post_height - 0.02, 0.067),
            fmat,
            bevel=0.0025,
            segments=1,
            color=(0.92, 0.93, 0.95),
        )
        # Sill mounting shoe plate at y = 0.252
        mc.add_beveled_box(
            (px, 0.252, z_rear),
            (0.052, 0.016, 0.068),
            fmat,
            bevel=0.0025,
            segments=1,
        )

    # Rear wall horizontal rails at y = 0.20, 1.40, 2.60
    for ry in (0.20, 1.40, eave):
        mc.add_beveled_box(
            (0.0, ry, z_rear),
            (3.86, 0.055, 0.055),
            fmat,
            bevel=0.004,
            segments=2,
        )
        mc.add_beveled_box(
            (0.0, ry, z_rear),
            (3.864, 0.022, 0.065),
            fmat,
            bevel=0.0025,
            segments=1,
            color=(0.93, 0.94, 0.96),
        )

    # 2. Left and right side walls (x = +-1.90)
    for sx in (-1.90, 1.90):
        for i in range(4):
            pz = -2.00 + i * 0.65 + GH_Z_OFFSET
            mc.add_beveled_box(
                (sx, post_centre, pz),
                (0.055, post_height, 0.035),
                fmat,
                bevel=0.004,
                segments=2,
            )
            mc.add_beveled_box(
                (sx, post_centre, pz),
                (0.067, post_height - 0.02, 0.015),
                fmat,
                bevel=0.0025,
                segments=1,
                color=(0.92, 0.93, 0.95),
            )
            mc.add_beveled_box(
                (sx, 0.252, pz),
                (0.068, 0.016, 0.052),
                fmat,
                bevel=0.0025,
                segments=1,
            )

        # Front corner post at z = 0.60 + GH_Z_OFFSET
        mc.add_beveled_box(
            (sx, post_centre, z_front),
            (0.055, post_height, 0.055),
            fmat,
            bevel=0.0045,
            segments=2,
        )
        mc.add_beveled_box(
            (sx, 0.142, z_front),
            (0.074, 0.026, 0.074),
            fmat,
            bevel=0.003,
            segments=1,
        )

        # Side horizontal rails at y = 0.20, 1.40, 2.60
        for ry in (0.20, 1.40, eave):
            mc.add_beveled_box(
                (sx, ry, z_side),
                (0.060, 0.045, 2.64),
                fmat,
                bevel=0.004,
                segments=2,
            )
            mc.add_beveled_box(
                (sx, ry, z_side),
                (0.068, 0.020, 2.644),
                fmat,
                bevel=0.0025,
                segments=1,
                color=(0.93, 0.94, 0.96),
            )

    # 3. Open front header beam at (0, eave, 0.60 + GH_Z_OFFSET) + high corner brackets (above 2.40m)
    mc.add_beveled_box(
        (0.0, eave, z_front),
        (3.86, 0.075, 0.070),
        fmat,
        bevel=0.005,
        segments=2,
    )
    mc.add_beveled_box(
        (0.0, eave, z_front),
        (3.868, 0.028, 0.080),
        fmat,
        bevel=0.003,
        segments=1,
        color=(0.92, 0.93, 0.95),
    )
    # Upper corner knee braces at front portal (strictly y >= 2.38m, well above 2.1m clearance)
    for sx in (-1.90, 1.90):
        inward = -1.0 if sx > 0 else 1.0
        mc.add_cylinder_between(
            (sx + inward * 0.02, 2.40, z_front),
            (sx + inward * 0.20, eave - 0.02, z_front),
            0.014,
            0.014,
            fmat,
            sides=8,
            cap=True,
        )

    # 4. Pitched gable roof framing
    roof_span = math.hypot(1.90, ridge - eave)
    roof_angle = math.atan2(ridge - eave, 1.90)

    for sign in (-1, 1):
        p_center = (sign * 0.95, (eave + ridge) * 0.5, z_side)
        p_rot = (0.0, 0.0, -sign * roof_angle)

        # 5 sloped rafters per side
        for i in range(5):
            rz = -1.30 + i * 0.65
            mc.add_beveled_box(
                (0.0, 0.02, rz),
                (roof_span + 0.04, 0.043, 0.038),
                fmat,
                bevel=0.0035,
                segments=2,
                parent_center=p_center,
                parent_rot=p_rot,
            )
            # Upper rafter cap bar
            mc.add_beveled_box(
                (0.0, 0.044, rz),
                (roof_span + 0.044, 0.012, 0.050),
                fmat,
                bevel=0.002,
                segments=1,
                color=(0.91, 0.93, 0.95),
                parent_center=p_center,
                parent_rot=p_rot,
            )

        # 3 longitudinal roof purlins per side
        for lx in (-roof_span * 0.5, 0.0, roof_span * 0.5):
            mc.add_beveled_box(
                (lx, 0.02, 0.0),
                (0.039, 0.043, 2.70),
                fmat,
                bevel=0.0035,
                segments=2,
                parent_center=p_center,
                parent_rot=p_rot,
            )

    # 5. Central ridge beam + decorative ridge crest cap
    mc.add_beveled_box(
        (0.0, ridge + 0.018, z_side),
        (0.075, 0.090, 2.77),
        fmat,
        bevel=0.005,
        segments=2,
    )
    mc.add_beveled_box(
        (0.0, ridge + 0.068, z_side),
        (0.092, 0.018, 2.79),
        fmat,
        bevel=0.003,
        segments=1,
        color=(0.90, 0.92, 0.94),
    )

    return mc.build_object(shade_smooth=True)


def build_greenhouse_metal(mats):
    """
    Builds `greenhouse_metal`:
    - Eaves rain gutters & vent trim at x = +-1.97, y = 2.56, z = -6.70, size (0.095, 0.070, 2.79)
      Crafted with a recessed trough channel, outer lip, end caps, and 5 support straps per side.
    """
    mc = MeshCollector("greenhouse_metal")
    mmat = mats['proc_gh_metal']
    z_side = -0.70 + GH_Z_OFFSET
    y_g = 2.60 - 0.04  # 2.56

    for sx in (-1.97, 1.97):
        # Bottom & lower body of the gutter trough
        mc.add_beveled_box(
            (sx, y_g - 0.014, z_side),
            (0.095, 0.042, 2.79),
            mmat,
            bevel=0.004,
            segments=2,
        )
        # Inner and outer upper lips forming a true gutter channel
        for lip_side in (-1, 1):
            mc.add_beveled_box(
                (sx + lip_side * 0.036, y_g + 0.018, z_side),
                (0.023, 0.034, 2.79),
                mmat,
                bevel=0.003,
                segments=2,
            )
        # Front and back gutter end-caps
        for end_z in (z_side - 1.385, z_side + 1.385):
            mc.add_beveled_box(
                (sx, y_g, end_z),
                (0.095, 0.070, 0.020),
                mmat,
                bevel=0.003,
                segments=1,
            )
        # 5 support bracket straps aligned with roof rafters
        for i in range(5):
            bz = -2.00 + i * 0.65 + GH_Z_OFFSET
            mc.add_beveled_box(
                (sx, y_g - 0.002, bz),
                (0.103, 0.074, 0.024),
                mmat,
                bevel=0.0025,
                segments=1,
                color=(0.90, 0.92, 0.90),
            )

    return mc.build_object(shade_smooth=True)


def build_greenhouse_planter(mats):
    """
    Builds `greenhouse_planter`:
    - Two wooden raised planting beds at x in (-1.25, 1.15), y = 0.245, z = -6.67, size (0.88, 0.35, 1.85)
      Constructed with 3 horizontal plank courses, corner stiles, and mitered top rim moldings
    - Right bed climbing trellis at x = 1.45 (2 vertical posts + 3 horizontal crossbars)
    """
    mc = MeshCollector("greenhouse_planter")
    wmat = mats['proc_wood']
    z_bed = -0.67 + GH_Z_OFFSET

    plank_tints = [
        (1.00, 0.99, 0.97),
        (0.95, 0.93, 0.90),
        (0.98, 0.96, 0.93),
    ]

    for bx in (-1.25, 1.15):
        # Dark recessed shadow core inside plank seams
        mc.add_beveled_box(
            (bx, 0.245, z_bed),
            (0.854, 0.340, 1.824),
            mats['proc_dark_wood'],
            bevel=0.003,
            segments=1,
            color=(0.55, 0.50, 0.44),
        )

        # 3 horizontal plank courses around the 0.88 x 0.35 x 1.85 body (y: 0.070 .. 0.420)
        course_h = 0.112
        for c_idx in range(3):
            cy = 0.070 + course_h * 0.5 + c_idx * 0.118
            col = plank_tints[c_idx]
            # Left & right long plank sides
            for side in (-1, 1):
                mc.add_beveled_box(
                    (bx + side * 0.424, cy, z_bed),
                    (0.032, course_h, 1.848),
                    wmat,
                    bevel=0.004,
                    segments=2,
                    color=col,
                )
            # Front & back short plank ends
            for z_dir in (-1, 1):
                mc.add_beveled_box(
                    (bx, cy, z_bed + z_dir * 0.909),
                    (0.848, course_h, 0.032),
                    wmat,
                    bevel=0.004,
                    segments=2,
                    color=col,
                )

        # 4 corner vertical stiles flush with outer 0.88 x 1.85 footprint
        for sx in (-1, 1):
            for sz in (-1, 1):
                mc.add_beveled_box(
                    (bx + sx * 0.418, 0.245, z_bed + sz * 0.903),
                    (0.044, 0.350, 0.044),
                    wmat,
                    bevel=0.0045,
                    segments=2,
                    color=(0.93, 0.90, 0.86),
                )

        # Top side rim ledges: (bx +- 0.397, 0.437, z_bed), size (0.086, 0.065, 1.90)
        for side in (-1, 1):
            mc.add_beveled_box(
                (bx + side * 0.397, 0.437, z_bed),
                (0.086, 0.065, 1.90),
                wmat,
                bevel=0.005,
                segments=2,
            )

        # Top front/back rim ledges: (bx, 0.437, -1.62 / 0.28 + GH_Z_OFFSET), size (0.90, 0.065, 0.080)
        for lz in (-1.62, 0.28):
            mc.add_beveled_box(
                (bx, 0.437, lz + GH_Z_OFFSET),
                (0.90, 0.065, 0.080),
                wmat,
                bevel=0.005,
                segments=2,
            )

        # Right bed climbing trellis (x > 0 -> bx = 1.15, trellis at x = 1.45)
        if bx > 0:
            tx = bx + 0.30
            for lz in (-1.46, 0.16):
                tz = lz + GH_Z_OFFSET
                mc.add_beveled_box(
                    (tx, 1.08, tz),
                    (0.045, 1.36, 0.045),
                    wmat,
                    bevel=0.0045,
                    segments=2,
                )
                # Subtle pyramid cap on top of each trellis post
                mc.add_beveled_box(
                    (tx, 1.766, tz),
                    (0.051, 0.016, 0.051),
                    wmat,
                    bevel=0.003,
                    segments=1,
                    color=(0.94, 0.91, 0.88),
                )
            for ty in (0.83, 1.29, 1.71):
                mc.add_beveled_box(
                    (tx, ty, -0.65 + GH_Z_OFFSET),
                    (0.040, 0.038, 1.68),
                    wmat,
                    bevel=0.004,
                    segments=2,
                    color=(0.97, 0.95, 0.92),
                )

    return mc.build_object(shade_smooth=True)


def build_greenhouse_soil(mats):
    """
    Builds `greenhouse_soil`:
    - Subdivided organic garden soil beds at (x, 0.424, -6.67), size (0.77, 0.024, 1.74)
      with gentle mounds around the 3 crop stems in each bed.
    """
    mc = MeshCollector("greenhouse_soil")
    smat = mats['proc_gh_soil']
    z_bed = -0.67 + GH_Z_OFFSET
    w_x, w_z = 0.77, 1.74
    nx, nz = 14, 28
    crop_zs = [-1.27 + i * 0.60 + GH_Z_OFFSET for i in range(3)]

    for bx in (-1.25, 1.15):
        verts = []
        vcols = []
        for j in range(nz + 1):
            vz = j / nz
            zz = z_bed + (vz - 0.5) * w_z
            edge_z = math.sin(vz * math.pi)
            for i in range(nx + 1):
                ux = i / nx
                xx = bx + (ux - 0.5) * w_x
                edge_x = math.sin(ux * math.pi)
                edge_f = (edge_x * edge_z) ** 0.65

                # Gentle mounding around each of the 3 plant stems
                mound = 0.0
                for cz in crop_zs:
                    d2 = ((xx - bx) / 0.22) ** 2 + ((zz - cz) / 0.24) ** 2
                    mound += 0.012 * math.exp(-d2)

                ripples = 0.0025 * math.sin(xx * 24.0 + zz * 17.0) * math.cos(zz * 29.0 - xx * 13.0)
                yy = 0.428 + edge_f * (0.008 + mound + ripples)
                verts.append((xx, yy, zz))

                shade = 0.86 + 0.16 * edge_f - 0.06 * (mound / 0.012)
                vcols.append((shade, shade * 0.99, shade * 0.97))

        faces = []
        stride = nx + 1
        for j in range(nz):
            for i in range(nx):
                k = j * stride + i
                faces.append((k, k + stride, k + stride + 1, k + 1))

        # Add a solid bottom skirt so the soil bed is a closed volume
        mc.add_town_mesh(verts, faces, smat, vert_colors=vcols)
        mc.add_beveled_box(
            (bx, 0.418, z_bed),
            (0.77, 0.016, 1.74),
            smat,
            bevel=0.002,
            segments=1,
        )

    return mc.build_object(shade_smooth=True)


def build_greenhouse_crops(mats):
    """
    Builds `greenhouse_crops`:
    - 6 botanical crop plants (3 bush crops in left bed, 3 climbing crops in right bed)
      matching `greenhouseCrop` in `ref-code/day-environment.mjs` lines 767 & 781-791.
    - Thickened double-sided botanical leaves with central midrib arch and petioles.
    """
    mc = MeshCollector("greenhouse_crops")

    # Prebuild double-sided volumetric leaf geometry matching leafGeometry(6, 4)
    rows, cols = 6, 4
    leaf_local_v = []
    for layer in range(2):
        # layer 0 = top surface (+Z in leaf local), layer 1 = bottom surface (-Z in leaf local)
        dz_sign = 1.0 if layer == 0 else -1.0
        for j in range(rows + 1):
            v = j / rows
            for i in range(cols + 1):
                u = (i / cols) * 2.0 - 1.0
                w = (math.sin(v * math.pi) ** 0.74) * (1.15 - 0.31 * v)
                # Keep >= 1.2mm separation everywhere so top and bottom never merge or degenerate
                thick = 0.0012 + 0.0022 * (1.0 - 0.65 * (u * u)) * math.sin(v * math.pi)
                lx = u * 0.22 * w * (1.0 + u * 0.075) + math.sin(v * math.pi) * 0.018
                ly = v + abs(u) * math.sin(v * math.pi) * 0.025
                lz = (
                    math.sin(v * math.pi) * (0.10 - 0.075 * u * u)
                    + v * v * 0.065
                    + math.sin(v * 9.0 + u * 1.3) * 0.012 * u * u * w
                    + dz_sign * thick
                )
                leaf_local_v.append((lx, ly, lz, v))

    l_stride = cols + 1
    l_off = (rows + 1) * l_stride
    leaf_local_f = []
    for j in range(rows):
        for i in range(cols):
            k = j * l_stride + i
            # Top surface
            leaf_local_f.append((k, k + 1, k + l_stride + 1, k + l_stride))
            # Bottom surface (reversed winding so outward normal points opposite)
            leaf_local_f.append((k + l_off, k + l_stride + l_off, k + l_stride + 1 + l_off, k + 1 + l_off))

    for bx in (-1.25, 1.15):
        climbing = bx > 0
        for i in range(3):
            lz = -1.27 + i * 0.60
            wz = lz + GH_Z_OFFSET
            seed = 510 + i + (20 if climbing else 0)
            rng = make_rng(seed)

            base = 0.429
            height = 1.22 if climbing else 0.74
            lean = 0.19 if climbing else 0.015
            r_stem = 0.011 if climbing else 0.014

            # Smooth organic main stem from (bx, base, wz) to (bx + lean, base + height, wz)
            stem_pts = []
            for s_idx in range(6):
                st = s_idx / 5.0
                # Gentle natural S-bow while keeping endpoints exact
                bow_x = math.sin(st * math.pi) * (0.012 if climbing else 0.005)
                bow_z = math.sin(st * TAU) * 0.006 * (1.0 if i % 2 == 0 else -1.0)
                stem_pts.append((bx + lean * st + bow_x, base + height * st, wz + bow_z))
            mc.add_catmull_tube(
                stem_pts,
                r_stem * 1.08,
                r_stem * 0.68,
                mats['proc_stem'],
                segs=14,
                sides=10,
                cap=True,
            )

            c_start = hex_to_linear('#497147' if climbing else '#5f8351')
            c_end = hex_to_linear('#91a86c')

            for row in range(5):
                for side in (-1, 1):
                    t = 0.16 + row * 0.16
                    ly = base + height * t
                    angle = side * (0.76 + (row % 2) * 0.33) + (0.36 if (row % 2 == 1) else -0.18)
                    direction = Vector((
                        math.sin(angle),
                        0.38 if climbing else 0.47,
                        math.cos(angle) * 0.58,
                    )).normalized()
                    q = Vector((0.0, 1.0, 0.0)).rotation_difference(direction)
                    rot_mat = q.to_matrix().to_4x4()

                    length = 0.25 + rng() * 0.035
                    base_col = lerp_color(c_start, c_end, rng() * 0.48)

                    stem_x = bx + lean * t + math.sin(t * math.pi) * (0.012 if climbing else 0.005)
                    stem_z = wz + math.sin(t * TAU) * 0.006 * (1.0 if i % 2 == 0 else -1.0)
                    origin = Vector((stem_x, ly, short_petiole_z := stem_z))

                    # Short petiole twig connecting stem to leaf base
                    pet_end = origin + direction * 0.028
                    mc.add_cylinder_between(
                        (origin.x, origin.y, origin.z),
                        (pet_end.x, pet_end.y, pet_end.z),
                        0.0045,
                        0.0032,
                        mats['proc_stem'],
                        sides=6,
                        cap=False,
                    )

                    sc = Vector((0.58, length, 0.58))
                    tv = []
                    vcols = []
                    for lx, lyy, lzz, v_param in leaf_local_v:
                        p = rot_mat @ Vector((lx * sc.x, lyy * sc.y, lzz * sc.z))
                        tv.append((origin.x + p.x, origin.y + p.y, origin.z + p.z))
                        # Subtle botanical gradient from base to leaf tip
                        g_fac = 0.90 + 0.18 * v_param
                        vcols.append((
                            min(1.0, base_col[0] * g_fac),
                            min(1.0, base_col[1] * g_fac),
                            min(1.0, base_col[2] * g_fac),
                        ))
                    mc.add_town_mesh(tv, leaf_local_f, mats['proc_foliage'], vert_colors=vcols)

    return mc.build_object(shade_smooth=True)


def build_greenhouse_labels(mats):
    """
    Builds `greenhouse_labels`:
    - 6 white botanical plant markers next to each crop at (x + 0.27, 0.57, -1.27 + i * 0.60 + GH_Z_OFFSET),
      size (0.035, 0.26, 0.023), rotation (0.10, 0, 0)
    """
    mc = MeshCollector("greenhouse_labels")
    pmat = mats['proc_paper']

    for bx in (-1.25, 1.15):
        for i in range(3):
            wz = -1.27 + i * 0.60 + GH_Z_OFFSET
            # Main marker stake & plaque
            mc.add_beveled_box(
                (bx + 0.27, 0.57, wz),
                (0.035, 0.26, 0.023),
                pmat,
                rot_euler=(0.10, 0.0, 0.0),
                bevel=0.0035,
                segments=2,
            )

    return mc.build_object(shade_smooth=True)


def build_greenhouse_glass(mats):
    """
    Builds `greenhouse_glass`:
    - 6 rear wall glass panes, 8 side wall glass panes, and 2 pitched roof glass panes
    - Uses `live_glass` material (excluded from lightmap baking)
    """
    mc = MeshCollector("greenhouse_glass")
    gmat = mats['live_glass']

    eave = 2.60
    ridge = 3.06
    z_rear = -1.90 + GH_Z_OFFSET
    z_side = -0.70 + GH_Z_OFFSET

    # 1. Rear wall panes (6 panes)
    for i in range(6):
        mc.add_beveled_box(
            (-1.60 + i * 0.64, 1.40, z_rear),
            (0.606, 2.34, 0.025),
            gmat,
            bevel=0.0,
        )

    # 2. Left & right side wall panes (4 panes per side)
    for sx in (-1.90, 1.90):
        for i in range(4):
            mc.add_beveled_box(
                (sx, 1.40, -1.675 + i * 0.65 + GH_Z_OFFSET),
                (0.025, 2.34, 0.61),
                gmat,
                bevel=0.0,
            )

    # 3. Pitched roof panes (2 panes)
    roof_span = math.hypot(1.90, ridge - eave)
    roof_angle = math.atan2(ridge - eave, 1.90)
    for sign in (-1, 1):
        p_center = (sign * 0.95, (eave + ridge) * 0.5, z_side)
        p_rot = (0.0, 0.0, -sign * roof_angle)
        mc.add_beveled_box(
            (0.0, 0.0, 0.0),
            (roof_span, 0.024, 2.67),
            gmat,
            bevel=0.0,
            parent_center=p_center,
            parent_rot=p_rot,
        )

    return mc.build_object(shade_smooth=True)


def build_all_greenhouse_meshes(mats):
    """Builds and returns all 9 greenhouse mesh objects in a dict."""
    objs = {
        'greenhouse_maru': build_greenhouse_maru(mats),
        'greenhouse_curb': build_greenhouse_curb(mats),
        'greenhouse_sill': build_greenhouse_sill(mats),
        'greenhouse_frame': build_greenhouse_frame(mats),
        'greenhouse_metal': build_greenhouse_metal(mats),
        'greenhouse_planter': build_greenhouse_planter(mats),
        'greenhouse_soil': build_greenhouse_soil(mats),
        'greenhouse_crops': build_greenhouse_crops(mats),
        'greenhouse_labels': build_greenhouse_labels(mats),
        'greenhouse_glass': build_greenhouse_glass(mats),
    }
    return objs

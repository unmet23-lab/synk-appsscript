import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, Euler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "prev", "scripts"))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import geo_builder
from geo_builder import (
    TAU,
    make_rng,
    hex_to_linear,
    lerp_color,
    smoothstep,
    t2b,
    eval_cubic_bezier_2d,
    eval_catmull_2d,
    sample_curve_z_at_x,
    terrain_color_linear,
    MeshCollector,
)


def is_under_building_maru(tx, tz, margin=0.06):
    """
    Returns True if Town (tx, tz) is strictly inside one of the 4 building maru footprints
    shrunk by `margin` meters so the ground still tucks cleanly under the maru edge.
    Maru bounds relative to place center (cx, cz):
      x in [-2.275, 2.275], z in [-2.871, 1.227]
    """
    hx = 2.275 - margin
    z_min = -2.871 + margin
    z_max = 1.227 - margin
    for cx, cz in ((-6.0, 0.0), (0.0, 0.0), (6.0, 0.0), (0.0, -6.0)):
        if abs(tx - cx) < hx and (cz + z_min) < tz < (cz + z_max):
            return True
    return False


def maru_depression(tx, tz):
    """Smoothly depresses vertices that tuck under a building maru apron."""
    dep = 0.0
    for cx, cz in ((-6.0, 0.0), (0.0, 0.0), (6.0, 0.0), (0.0, -6.0)):
        dx = 2.25 - abs(tx - cx)
        dz1 = tz - (cz - 2.85)
        dz2 = (cz + 1.20) - tz
        if dx > 0.0 and dz1 > 0.0 and dz2 > 0.0:
            fx = min(1.0, dx / 0.08)
            fz = min(1.0, min(dz1, dz2) / 0.08)
            dep = max(dep, 0.028 * fx * fz)
    return dep


def get_court_boundary_funcs():
    north_pts = []
    for seg in [
        ((-9.45, 1.12), (-9.40, 0.42), (-7.28, 0.39), (-6.22, 0.48)),
        ((-6.22, 0.48), (-4.06, 0.62), (-2.80, 0.73), (-0.42, 0.60)),
        ((-0.42, 0.60), (2.21, 0.44), (4.37, 0.55), (6.13, 0.50)),
        ((6.13, 0.50), (8.61, 0.31), (9.40, 0.72), (9.48, 1.37)),
    ]:
        for i in range(50):
            north_pts.append(eval_cubic_bezier_2d(*seg, i / 50.0))
    north_pts.append((9.48, 1.37))
    court_north_z = sample_curve_z_at_x(north_pts)

    south_pts = []
    for seg in [
        ((9.40, 4.10), (9.21, 4.86), (7.30, 5.01), (5.74, 4.94)),
        ((5.74, 4.94), (3.32, 4.81), (2.33, 5.13), (0.12, 5.18)),
        ((0.12, 5.18), (-2.51, 5.23), (-3.89, 4.83), (-6.16, 4.92)),
        ((-6.16, 4.92), (-8.82, 5.09), (-9.42, 4.83), (-9.48, 4.10)),
    ]:
        for i in range(50):
            south_pts.append(eval_cubic_bezier_2d(*seg, i / 50.0))
    south_pts.append((-9.48, 4.10))
    court_south_z = sample_curve_z_at_x(south_pts)

    def west_bound_x(z):
        t = max(0.0, min(1.0, (z - 1.12) / (4.10 - 1.12)))
        return -9.45 + (-9.48 - (-9.45)) * t

    def east_bound_x(z):
        t = max(0.0, min(1.0, (z - 1.37) / (4.10 - 1.37)))
        return 9.48 + (9.40 - 9.48) * t

    def court_depression(tx, tz):
        """Depresses paths/gravel that tuck under the stone court (y=0.103) so they never poke through."""
        xmin = west_bound_x(tz)
        xmax = east_bound_x(tz)
        if xmin < tx < xmax:
            zn = court_north_z(tx)
            zs = court_south_z(tx)
            if zn < tz < zs:
                dx = min(tx - xmin, xmax - tx)
                dz = min(tz - zn, zs - tz)
                f = min(1.0, min(dx, dz) / 0.12)
                return 0.012 * f
        return 0.0

    return court_north_z, court_south_z, west_bound_x, east_bound_x, court_depression


def build_court_and_mortar_and_curb(mats):
    """
    Builds:
      - `ground_court`: Sculpted limestone flagstone courtyard across the full v20 court shape
      - `ground_mortar`: Recessed mortar joints between flagstones + the 3 v20 arc joint courses
      - `ground_curb`: North and south dressed stone border curbs (`courtBorder`)
    """
    mc_court = MeshCollector("ground_court")
    mc_mortar = MeshCollector("ground_mortar")
    mc_curb = MeshCollector("ground_curb")

    court_north_z, court_south_z, west_bound_x, east_bound_x, _ = get_court_boundary_funcs()

    course_ctrl_raw = [
        [(-9.46, 1.68), (-9.08, 1.61), (-6.53, 1.35), (-3.4, 1.69), (0, 1.48), (3.4, 1.65), (6.4, 1.41), (9.11, 1.76), (9.46, 1.82)],
        [(-9.47, 2.58), (-9.17, 2.50), (-6.62, 2.34), (-3.30, 2.64), (0, 2.56), (3.41, 2.49), (6.47, 2.43), (9.15, 2.69), (9.45, 2.75)],
        [(-9.47, 3.42), (-8.85, 3.36), (-6.31, 3.30), (-3.21, 3.40), (0, 3.60), (3.03, 3.38), (6.41, 3.29), (8.95, 3.45), (9.43, 3.52)],
    ]
    course_funcs = []
    for ctrl in course_ctrl_raw:
        c_pts = [eval_catmull_2d(ctrl, i / 160.0) for i in range(161)]
        course_funcs.append(sample_curve_z_at_x(c_pts))

    def course4_z(x):
        return 0.52 * course_funcs[2](x) + 0.48 * court_south_z(x)

    all_courses = [court_north_z, course_funcs[0], course_funcs[1], course_funcs[2], course4_z, court_south_z]

    slab_rng = make_rng(4021)
    for c_idx in range(len(all_courses) - 1):
        z_top_fn = all_courses[c_idx]
        z_bot_fn = all_courses[c_idx + 1]
        num_slabs = 18 if (c_idx % 2 == 0) else 19
        u_splits = [0.0]
        for s in range(1, num_slabs):
            base_u = s / num_slabs
            jitter = (slab_rng() - 0.5) * (0.08 / num_slabs)
            u_splits.append(base_u + jitter)
        u_splits.append(1.0)

        for s in range(num_slabs):
            u_left = u_splits[s]
            u_right = u_splits[s + 1]
            tone = 1.0 + (slab_rng() - 0.5) * 0.032
            slab_col = (min(1.0, tone), min(1.0, tone), min(1.0, tone * 0.994))

            u_steps = [0.0, 0.018, 0.045, 0.28, 0.5, 0.72, 0.955, 0.982, 1.0]
            v_steps = [0.0, 0.022, 0.055, 0.3, 0.5, 0.7, 0.945, 0.978, 1.0]
            s_verts = []
            for vj, vf in enumerate(v_steps):
                for ui, uf in enumerate(u_steps):
                    u_glob = u_left + (u_right - u_left) * uf
                    x_ref = -9.46 + 18.92 * u_glob
                    zt = z_top_fn(x_ref)
                    zb = z_bot_fn(x_ref)
                    zz = zt + (zb - zt) * vf
                    x_min = west_bound_x(zz)
                    x_max = east_bound_x(zz)
                    xx = x_min + (x_max - x_min) * u_glob

                    at_left_joint = (s > 0) and (ui <= 1)
                    at_right_joint = (s < num_slabs - 1) and (ui >= len(u_steps) - 2)
                    at_top_joint = (c_idx > 0) and (vj <= 1)
                    at_bot_joint = (c_idx < len(all_courses) - 2) and (vj >= len(v_steps) - 2)
                    at_outer_edge = (
                        (s == 0 and ui == 0)
                        or (s == num_slabs - 1 and ui == len(u_steps) - 1)
                        or (c_idx == 0 and vj == 0)
                        or (c_idx == len(all_courses) - 2 and vj == len(v_steps) - 1)
                    )

                    if at_outer_edge:
                        yy = 0.1018
                    elif at_left_joint or at_right_joint or at_top_joint or at_bot_joint:
                        yy = 0.1008
                    else:
                        yy = 0.1030

                    yy -= maru_depression(xx, zz)
                    s_verts.append((xx, yy, zz))

            u_len = len(u_steps)
            paving_faces = []
            mortar_faces = []
            for vj in range(len(v_steps) - 1):
                for ui in range(len(u_steps) - 1):
                    k = vj * u_len + ui
                    cx_f = 0.25 * (s_verts[k][0] + s_verts[k+1][0] + s_verts[k+u_len][0] + s_verts[k+u_len+1][0])
                    cz_f = 0.25 * (s_verts[k][2] + s_verts[k+1][2] + s_verts[k+u_len][2] + s_verts[k+u_len+1][2])
                    if is_under_building_maru(cx_f, cz_f, margin=0.06):
                        continue
                    quad = (k, k + u_len, k + u_len + 1, k + 1)
                    is_mortar = (
                        (s > 0 and ui == 0)
                        or (s < num_slabs - 1 and ui == len(u_steps) - 2)
                        or (c_idx > 0 and vj == 0)
                        or (c_idx < len(all_courses) - 2 and vj == len(v_steps) - 2)
                    )
                    if is_mortar:
                        mortar_faces.append(quad)
                    else:
                        paving_faces.append(quad)
            mc_court.add_town_mesh(s_verts, paving_faces, mats["proc_paving"], color=slab_col)
            if mortar_faces:
                mc_mortar.add_town_mesh(s_verts, mortar_faces, mats["proc_mortar"])

    # Also add the 3 primary v20 mortar course ribbons (lines 851-855)
    v20_mortar_ctrls = [
        [(-9.08, 1.61), (-6.53, 1.35), (-3.4, 1.69), (0, 1.48), (3.4, 1.65), (6.4, 1.41), (9.11, 1.76)],
        [(-9.17, 2.50), (-6.62, 2.34), (-3.30, 2.64), (0, 2.56), (3.41, 2.49), (6.47, 2.43), (9.15, 2.69)],
        [(-8.85, 3.36), (-6.31, 3.30), (-3.21, 3.40), (0, 3.60), (3.03, 3.38), (6.41, 3.29), (8.95, 3.45)],
    ]
    for ctrl in v20_mortar_ctrls:
        nx_m = 120
        m_verts = []
        for i in range(nx_m + 1):
            t = i / nx_m
            xx, zz = eval_catmull_2d(ctrl, t)
            yy = 0.1032 - maru_depression(xx, zz)
            m_verts.append((xx, yy, zz - 0.008))
            m_verts.append((xx, yy, zz + 0.008))
        m_faces = []
        for i in range(nx_m):
            k = i * 2
            m_faces.append((k, k + 1, k + 3, k + 2))
        mc_mortar.add_town_mesh(m_verts, m_faces, mats["proc_mortar"])

    # 2. North & South stone border curbs (lines 865-867)
    border_ctrls = [
        [(-9.39, 1.10), (-9.05, 0.62), (-6.20, 0.52), (-3.20, 0.70), (0, 0.62), (3.25, 0.58), (6.20, 0.54), (9.10, 0.79), (9.43, 1.34)],
        [(-9.28, 4.53), (-6.43, 4.96), (-3.48, 4.93), (0, 5.17), (3.32, 4.97), (6.37, 4.97), (9.23, 4.53)],
    ]
    curb_cross = [(-0.068, 0.095), (-0.055, 0.1036), (0.055, 0.1036), (0.068, 0.095)]
    c_len = len(curb_cross)
    for b_idx, ctrl in enumerate(border_ctrls):
        nx_b = 140
        b_samples = [eval_catmull_2d(ctrl, i / nx_b) for i in range(nx_b + 1)]
        b_verts = []
        for i, (px, pz) in enumerate(b_samples):
            if i == 0:
                tx_d, tz_d = b_samples[1][0] - px, b_samples[1][1] - pz
            elif i == nx_b:
                tx_d, tz_d = px - b_samples[nx_b - 1][0], pz - b_samples[nx_b - 1][1]
            else:
                tx_d, tz_d = b_samples[i + 1][0] - b_samples[i - 1][0], b_samples[i + 1][1] - b_samples[i - 1][1]
            t_len = math.hypot(tx_d, tz_d) or 1.0
            tx_d /= t_len
            tz_d /= t_len
            joint_dip = 0.0020 if (i % 4 == 0 and 0 < i < nx_b) else 0.0
            for off, yy in curb_cross:
                vx = px - tz_d * off
                vz = pz + tx_d * off
                vy = yy - joint_dip - maru_depression(vx, vz)
                b_verts.append((vx, vy, vz))
        b_faces = []
        for i in range(nx_b):
            mx = 0.5 * (b_samples[i][0] + b_samples[i + 1][0])
            mz = 0.5 * (b_samples[i][1] + b_samples[i + 1][1])
            if b_idx == 0 and is_under_building_maru(mx, mz, margin=0.04):
                continue
            for c in range(c_len - 1):
                k = i * c_len + c
                b_faces.append((k, k + 1, k + c_len + 1, k + c_len))
        mc_curb.add_town_mesh(b_verts, b_faces, mats["proc_stone"])

    obj_court = mc_court.build_object()
    obj_mortar = mc_mortar.build_object()
    obj_curb = mc_curb.build_object()
    return obj_court, obj_mortar, obj_curb


def build_paths_and_gravel(mats):
    """
    Builds:
      - `ground_path`: The garden leisureCircuit path (width 1.70m, paving material)
      - `ground_stepping`: Sculpted stepping stones along the greenhouse approach
      - `ground_gravel`: Central approach gravel ribbon, south promenade gravel ribbon,
                         south gravel shoulder, and the 3 back-street gravel segments
                         that meet `v20_live.glb` seamlessly at the core boundary.
    """
    mc_path = MeshCollector("ground_path")
    mc_stepping = MeshCollector("ground_stepping")
    mc_gravel = MeshCollector("ground_gravel")

    _, _, _, _, court_depression = get_court_boundary_funcs()

    def add_sculpted_ribbon(mc, points, width, mat, top_y, segs=140, uniform_width=False, course_grooves=False, skip_maru=False):
        samples = [eval_catmull_2d(points, i / segs) for i in range(segs + 1)]
        edge_y = top_y - 0.0032
        cross = [
            (-0.50, edge_y),
            (-0.46, top_y - 0.0010),
            (-0.20, top_y),
            (0.0, top_y),
            (0.20, top_y),
            (0.46, top_y - 0.0010),
            (0.50, edge_y),
        ]
        stride = len(cross)
        r_verts = []
        p0x, p0z = points[0][0], points[0][1]
        for i, (px, pz) in enumerate(samples):
            t = i / segs
            if i == 0:
                vx, vz = samples[1][0] - px, samples[1][1] - pz
            elif i == segs:
                vx, vz = px - samples[segs - 1][0], pz - samples[segs - 1][1]
            else:
                vx, vz = samples[i + 1][0] - samples[i - 1][0], samples[i + 1][1] - samples[i - 1][1]
            vlen = math.hypot(vx, vz) or 1.0
            vx /= vlen
            vz /= vlen
            if uniform_width:
                lw = width
            else:
                lw = width * (1.0 + math.sin(t * TAU + p0x * 0.11) * 0.065 + math.sin(t * TAU * 2.0 + p0z) * 0.035)
            dip = 0.0015 if (course_grooves and (i % 3 == 0) and 0 < i < segs) else 0.0
            for s_frac, yy in cross:
                wx = px - vz * lw * s_frac
                wz = pz + vx * lw * s_frac
                wy = (yy - dip if abs(s_frac) < 0.48 else yy) - court_depression(wx, wz) - (maru_depression(wx, wz) if skip_maru else 0.0)
                r_verts.append((wx, wy, wz))
        r_faces = []
        for i in range(segs):
            mx = 0.5 * (samples[i][0] + samples[i + 1][0])
            mz = 0.5 * (samples[i][1] + samples[i + 1][1])
            if skip_maru and is_under_building_maru(mx, mz, margin=0.08):
                continue
            for j in range(stride - 1):
                k = i * stride + j
                r_faces.append((k, k + 1, k + stride + 1, k + stride))
        mc.add_town_mesh(r_verts, r_faces, mat)

    # 1. Leisure circuit path (day-environment.mjs lines 870-871)
    leisure_circuit = [
        (-8.85, 3.1), (-10.5, 0.0), (-10.4, -4.8), (-9.2, -8.8),
        (-5.3, -9.8), (0.0, -9.9), (6.3, -9.8), (10.4, -7.9),
        (10.55, -2.4), (10.4, 1.2), (8.9, 3.9),
    ]
    add_sculpted_ribbon(mc_path, leisure_circuit, 1.70, mats["proc_paving"], top_y=0.101, segs=160, course_grooves=True)

    # 2. Stepping stones on the greenhouse approach (day-environment.mjs lines 859-863)
    for iz in range(8):
        sz = -6.71 + iz * 0.96
        if -8.60 < sz < -5.15 or -2.50 < sz < 1.10:
            continue
        for side in (-1, 1):
            sx = side * (0.59 + (iz % 2) * 0.11)
            yaw = (0.13 if (iz % 2) else -0.10) * side
            tint = hex_to_linear("#e4e8dd" if (iz % 3) else "#d4dccc")
            bm = bmesh.new()
            bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
            for v in bm.verts:
                x, y, z = v.co.x, v.co.y, v.co.z
                r_mod = 1.0 + math.sin(x * 7.0 + z * 4.0) * 0.043 + math.cos(y * 9.0 - x * 2.0) * 0.036
                y_flat = y * 0.65 if y > 0.15 else y
                v.co.x = x * r_mod * 0.67
                v.co.y = y_flat * r_mod * 0.026
                v.co.z = z * r_mod * 0.46
            rot = Euler((0.0, yaw, 0.0), "XYZ").to_matrix().to_4x4()
            s_verts = []
            for v in bm.verts:
                p = rot @ v.co
                wx, wy, wz = sx + p.x, 0.098 + p.y, sz + p.z
                wy -= maru_depression(wx, wz)
                s_verts.append((wx, wy, wz))
            bm.verts.ensure_lookup_table()
            s_faces = [[v.index for v in f.verts] for f in bm.faces]
            bm.free()
            mc_stepping.add_town_mesh(s_verts, s_faces, mats["proc_paving"], color=tint)

    # 3. Gravel ribbons inside the district:
    gravel_approach = [(0.0, 1.5), (0.04, -0.6), (-0.11, -2.6), (0.04, -4.5), (0.0, -6.85)]
    add_sculpted_ribbon(mc_gravel, gravel_approach, 3.54, mats["proc_gravel"], top_y=0.089, segs=96, skip_maru=True)

    south_loop = [(-9.2, 3.0), (-9.0, 5.3), (-4.5, 6.0), (0.0, 6.12), (4.8, 5.92), (9.0, 5.3), (9.2, 3.0)]
    add_sculpted_ribbon(mc_gravel, south_loop, 1.35, mats["proc_gravel"], top_y=0.100, segs=120)

    south_shoulder = [(-9.1, 5.19), (-6.3, 5.22), (-3.0, 5.25), (0.0, 5.18), (3.3, 5.24), (6.4, 5.21), (9.1, 5.19)]
    add_sculpted_ribbon(mc_gravel, south_shoulder, 0.30, mats["proc_gravel"], top_y=0.099, segs=96)

    obj_path = mc_path.build_object()
    obj_stepping = mc_stepping.build_object()
    return obj_path, obj_stepping, mc_gravel


def build_reference_matched_parts(mats, mc_gravel):
    ref_path = os.path.join(ROOT, "reference", "v20_town_ground.glb")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=ref_path)
    ref_objs = {o.name: o for o in bpy.data.objects if o not in before and o.type == "MESH"}

    def in_core_centroid(verts_co):
        cx = sum(v.x for v in verts_co) / len(verts_co)
        cz = sum(-v.y for v in verts_co) / len(verts_co)
        return (-13.6 <= cx <= 13.6) and (-12.2 <= cz <= 8.7)

    # --- 1. Back-street gravel segments from `gravel_d8ceba_r98_m0` ---
    ref_gravel = next(o for k, o in ref_objs.items() if k.startswith("gravel_"))
    me_g = ref_gravel.data
    bm_g = bmesh.new()
    bm_g.from_mesh(me_g)
    bmesh.ops.remove_doubles(bm_g, verts=bm_g.verts, dist=0.0005)
    del_faces = [f for f in bm_g.faces if not all(-v.co.y < -8.0 for v in f.verts)]
    if del_faces:
        bmesh.ops.delete(bm_g, geom=del_faces, context="FACES")
    unused_v = [v for v in bm_g.verts if not v.link_faces]
    if unused_v:
        bmesh.ops.delete(bm_g, geom=unused_v, context="VERTS")

    cin_verts = set()
    for f in bm_g.faces:
        if in_core_centroid([v.co for v in f.verts]):
            for v in f.verts:
                cin_verts.add(v.index)
    for v in bm_g.verts:
        if v.index not in cin_verts:
            v.co.z -= 0.0004

    bm_g.verts.ensure_lookup_table()
    g_town_verts = [(v.co.x, v.co.z, -v.co.y) for v in bm_g.verts]
    g_faces = [[v.index for v in f.verts] for f in bm_g.faces]
    bm_g.free()
    mc_gravel.add_town_mesh(g_town_verts, g_faces, mats["proc_gravel"])
    obj_gravel = mc_gravel.build_object()

    # --- 2. 127 organic stones from `stone_ffffff_r100_m0_x2` -> `ground_stones` ---
    ref_stone = next(o for k, o in ref_objs.items() if k.startswith("stone_"))
    me_s = ref_stone.data
    vcol_s = {}
    if len(me_s.color_attributes) > 0:
        ca = me_s.color_attributes[0]
        for poly in me_s.polygons:
            for vi, li in zip(poly.vertices, poly.loop_indices):
                c = ca.data[li].color
                vcol_s[vi] = (c[0], c[1], c[2])

    bm_s = bmesh.new()
    bm_s.from_mesh(me_s)
    col_layer_s = bm_s.verts.layers.float_vector.new("vcol")
    for v in bm_s.verts:
        v[col_layer_s] = vcol_s.get(v.index, (1.0, 1.0, 1.0))
    bmesh.ops.remove_doubles(bm_s, verts=bm_s.verts, dist=0.0005)
    bm_s.verts.ensure_lookup_table()

    visited = set()
    curb_verts = []
    for v in bm_s.verts:
        if v.index in visited:
            continue
        comp = []
        stack = [v]
        visited.add(v.index)
        while stack:
            curr = stack.pop()
            comp.append(curr)
            for e in curr.link_edges:
                other = e.other_vert(curr)
                if other.index not in visited:
                    visited.add(other.index)
                    stack.append(other)
        if len(comp) > 40:
            curb_verts.extend(comp)
    if curb_verts:
        bmesh.ops.delete(bm_s, geom=curb_verts, context="VERTS")

    bmesh.ops.subdivide_edges(
        bm_s,
        edges=bm_s.edges[:],
        cuts=1,
        use_grid_fill=True,
        smooth=0.38,
    )
    bm_s.verts.ensure_lookup_table()
    for v in bm_s.verts:
        c = v[col_layer_s]
        if c[0] == 0.0 and c[1] == 0.0 and c[2] == 0.0:
            nbs = [e.other_vert(v)[col_layer_s] for e in v.link_edges if sum(e.other_vert(v)[col_layer_s]) > 0.01]
            if nbs:
                v[col_layer_s] = (
                    sum(x[0] for x in nbs) / len(nbs),
                    sum(x[1] for x in nbs) / len(nbs),
                    sum(x[2] for x in nbs) / len(nbs),
                )
            else:
                v[col_layer_s] = (0.8, 0.8, 0.78)
    bmesh.ops.triangulate(bm_s, faces=bm_s.faces[:])
    bm_s.verts.ensure_lookup_table()

    mc_stones = MeshCollector("ground_stones")
    s_town_verts = [(v.co.x, v.co.z, -v.co.y) for v in bm_s.verts]
    s_vcols = [tuple(v[col_layer_s]) for v in bm_s.verts]
    s_faces = [[v.index for v in f.verts] for f in bm_s.faces]
    bm_s.free()
    mc_stones.add_town_mesh(s_town_verts, s_faces, mats["proc_stone"], vert_colors=s_vcols)
    obj_stones = mc_stones.build_object()

    # --- 3. 16 soilPocket patches from `gardenSoil_ffffff_r100_m0_x0` -> `ground_soil` ---
    ref_soil = next(o for k, o in ref_objs.items() if k.startswith("gardenSoil_"))
    me_so = ref_soil.data
    vcol_so = {}
    if len(me_so.color_attributes) > 0:
        ca = me_so.color_attributes[0]
        for poly in me_so.polygons:
            for vi, li in zip(poly.vertices, poly.loop_indices):
                c = ca.data[li].color
                vcol_so[vi] = (c[0], c[1], c[2])

    bm_so = bmesh.new()
    bm_so.from_mesh(me_so)
    col_layer_so = bm_so.verts.layers.float_vector.new("vcol")
    for v in bm_so.verts:
        v[col_layer_so] = vcol_so.get(v.index, (0.5, 0.45, 0.35))
    bmesh.ops.remove_doubles(bm_so, verts=bm_so.verts, dist=0.0005)
    bm_so.verts.ensure_lookup_table()

    cin_verts_so = set()
    for f in bm_so.faces:
        if in_core_centroid([v.co for v in f.verts]):
            for v in f.verts:
                cin_verts_so.add(v.index)
    for v in bm_so.verts:
        if v.index not in cin_verts_so:
            v.co.z -= 0.0005

    mc_soil = MeshCollector("ground_soil")
    so_town_verts = [(v.co.x, v.co.z, -v.co.y) for v in bm_so.verts]
    so_vcols = [tuple(v[col_layer_so]) for v in bm_so.verts]
    so_faces = [[v.index for v in f.verts] for f in bm_so.faces]
    bm_so.free()
    mc_soil.add_town_mesh(so_town_verts, so_faces, mats["proc_soil_vcol"], vert_colors=so_vcols)
    obj_soil = mc_soil.build_object()

    # --- 4. Lawn terrain from `terrainMaterial_ffffff_r100_m0_x0` -> `ground_lawn` ---
    ref_lawn = next(o for k, o in ref_objs.items() if k.startswith("terrainMaterial_"))
    me_l = ref_lawn.data
    bm_l = bmesh.new()
    bm_l.from_mesh(me_l)
    bmesh.ops.remove_doubles(bm_l, verts=bm_l.verts, dist=0.0005)
    bm_l.verts.ensure_lookup_table()

    cin_verts_l = set()
    for f in bm_l.faces:
        if in_core_centroid([v.co for v in f.verts]):
            for v in f.verts:
                cin_verts_l.add(v.index)
    for v in bm_l.verts:
        if v.index not in cin_verts_l:
            v.co.z = 0.0744
        else:
            v.co.z = 0.0750

    bmesh.ops.subdivide_edges(bm_l, edges=bm_l.edges[:], cuts=3, use_grid_fill=True)
    bmesh.ops.triangulate(bm_l, faces=bm_l.faces[:])

    del_lawn = []
    for f in bm_l.faces:
        c = f.calc_center_median()
        tx, tz = c.x, -c.y
        if is_under_building_maru(tx, tz, margin=0.14):
            del_lawn.append(f)
        elif abs(tx) < 9.15 and 0.90 < tz < 4.65:
            del_lawn.append(f)
    if del_lawn:
        bmesh.ops.delete(bm_l, geom=del_lawn, context="FACES")
    unused_lv = [v for v in bm_l.verts if not v.link_faces]
    if unused_lv:
        bmesh.ops.delete(bm_l, geom=unused_lv, context="VERTS")

    bm_l.verts.ensure_lookup_table()
    mc_lawn = MeshCollector("ground_lawn")
    l_town_verts = [(v.co.x, v.co.z, -v.co.y) for v in bm_l.verts]
    l_vcols = [terrain_color_linear(v.co.x, -v.co.y) for v in bm_l.verts]
    l_faces = [[v.index for v in f.verts] for f in bm_l.faces]
    bm_l.free()
    mc_lawn.add_town_mesh(l_town_verts, l_faces, mats["proc_lawn"], vert_colors=l_vcols)
    obj_lawn = mc_lawn.build_object()

    for ro in ref_objs.values():
        me_tmp = ro.data
        bpy.data.objects.remove(ro, do_unlink=True)
        if me_tmp and me_tmp.users == 0:
            bpy.data.meshes.remove(me_tmp)

    return obj_gravel, obj_stones, obj_soil, obj_lawn


def tune_ground_procedural_materials(mats):
    map0_path = os.path.join(ROOT, "reference", "map_0.png")
    img_map0 = bpy.data.images.load(map0_path, check_existing=True)
    img_map0.colorspace_settings.name = "sRGB"

    def attach_world_grass_map(mat_name, bump_strength=0.03):
        mat = mats[mat_name]
        nt = mat.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        out.location = (700, 0)
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        bsdf.location = (420, 0)
        bsdf.inputs["Roughness"].default_value = 0.98 if mat_name == "proc_lawn" else 0.96
        bsdf.inputs["Metallic"].default_value = 0.0
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

        geom = nt.nodes.new("ShaderNodeNewGeometry")
        geom.location = (-900, -100)
        mapping = nt.nodes.new("ShaderNodeMapping")
        mapping.location = (-680, -100)
        mapping.inputs["Location"].default_value = (12.0, 9.288889, 0.0)
        mapping.inputs["Scale"].default_value = (0.24, 22.0 / 90.0, 1.0)
        nt.links.new(geom.outputs["Position"], mapping.inputs["Vector"])

        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.location = (-420, -100)
        tex.image = img_map0
        tex.extension = "REPEAT"
        nt.links.new(mapping.outputs["Vector"], tex.inputs["Vector"])

        vcol = nt.nodes.new("ShaderNodeVertexColor")
        vcol.layer_name = "Color"
        vcol.location = (-420, 160)

        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.location = (-100, 80)
        nt.links.new(vcol.outputs["Color"], mix.inputs[6])
        nt.links.new(tex.outputs["Color"], mix.inputs[7])
        nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])

        bump = nt.nodes.new("ShaderNodeBump")
        bump.location = (160, -180)
        bump.inputs["Strength"].default_value = bump_strength
        bump.inputs["Distance"].default_value = 0.003
        nt.links.new(tex.outputs["Color"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    attach_world_grass_map("proc_lawn", bump_strength=0.035)
    attach_world_grass_map("proc_soil_vcol", bump_strength=0.055)

    mat_g = mats["proc_gravel"]
    for n in mat_g.node_tree.nodes:
        if n.type == "MIX" and n.data_type == "RGBA":
            n.inputs[6].default_value = (*hex_to_linear("#d1c7b3"), 1.0)
            n.inputs[7].default_value = (*hex_to_linear("#dfd5c1"), 1.0)

    mat_m = mats["proc_mortar"]
    for n in mat_m.node_tree.nodes:
        if n.type == "MIX" and n.data_type == "RGBA":
            n.inputs[6].default_value = (*hex_to_linear("#b2b8af"), 1.0)
            n.inputs[7].default_value = (*hex_to_linear("#bec4bb"), 1.0)


def build_all_ground_meshes(mats):
    tune_ground_procedural_materials(mats)
    obj_court, obj_mortar, obj_curb = build_court_and_mortar_and_curb(mats)
    obj_path, obj_stepping, mc_gravel = build_paths_and_gravel(mats)
    obj_gravel, obj_stones, obj_soil, obj_lawn = build_reference_matched_parts(mats, mc_gravel)

    return {
        "ground_court": obj_court,
        "ground_mortar": obj_mortar,
        "ground_curb": obj_curb,
        "ground_path": obj_path,
        "ground_stepping": obj_stepping,
        "ground_gravel": obj_gravel,
        "ground_stones": obj_stones,
        "ground_soil": obj_soil,
        "ground_lawn": obj_lawn,
    }

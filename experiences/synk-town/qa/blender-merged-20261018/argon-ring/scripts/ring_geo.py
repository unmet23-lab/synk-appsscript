import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

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
    terrain_color_linear,
    MeshCollector,
)

# Two bake atlas groups (excluding glass, none used in ring ground):
# 1. 'ring_lawn': outer ring grass terrain
# 2. 'ring_paths': outer ring gravel streets/lanes + perimeter paving loop
ATLAS_GROUPS = {
    "ring_lawn": "ring_lawn",
    "ring_gravel": "ring_paths",
    "ring_paving": "ring_paths",
}

OUTER_MIN_X = -22.6
OUTER_MAX_X = 22.6
OUTER_MIN_Z = -25.4
OUTER_MAX_Z = 9.6

INNER_MIN_X = -13.6
INNER_MAX_X = 13.6
INNER_MIN_Z = -12.2
INNER_MAX_Z = 8.7


def threejs_catmull_rom_2d(points, t):
    """
    Exact port of THREE.CatmullRomCurve3(points, false, 'centripetal').getPoint(t)
    in Town 2D (x, z) coordinates.
    """
    l = len(points)
    p = (l - 1) * max(0.0, min(1.0, t))
    int_point = int(math.floor(p))
    weight = p - int_point
    if weight == 0.0 and int_point == l - 1:
        int_point = l - 2
        weight = 1.0

    p1 = points[int_point]
    p2 = points[int_point + 1]
    if int_point > 0:
        p0 = points[int_point - 1]
    else:
        p0 = (p1[0] + (p1[0] - p2[0]), p1[1] + (p1[1] - p2[1]))
    if int_point + 2 < l:
        p3 = points[int_point + 2]
    else:
        p3 = (p2[0] + (p2[0] - p1[0]), p2[1] + (p2[1] - p1[1]))

    def calc_poly(v0, v1, v2, v3, dt0, dt1, dt2, w):
        t1 = (v1 - v0) / dt0 - (v2 - v0) / (dt0 + dt1) + (v2 - v1) / dt1
        t2 = (v2 - v1) / dt1 - (v3 - v1) / (dt1 + dt2) + (v3 - v2) / dt2
        t1 *= dt1
        t2 *= dt1
        c0 = v1
        c1 = t1
        c2 = -3.0 * v1 + 3.0 * v2 - 2.0 * t1 - t2
        c3 = 2.0 * v1 - 2.0 * v2 + t1 + t2
        w2 = w * w
        w3 = w2 * w
        return c0 + c1 * w + c2 * w2 + c3 * w3

    def dist_sq(a, b):
        return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2

    dt0 = (dist_sq(p0, p1)) ** 0.25
    dt1 = (dist_sq(p1, p2)) ** 0.25
    dt2 = (dist_sq(p2, p3)) ** 0.25
    if dt1 < 1e-4:
        dt1 = 1.0
    if dt0 < 1e-4:
        dt0 = dt1
    if dt2 < 1e-4:
        dt2 = dt1

    x = calc_poly(p0[0], p1[0], p2[0], p3[0], dt0, dt1, dt2, weight)
    z = calc_poly(p0[1], p1[1], p2[1], p3[1], dt0, dt1, dt2, weight)
    return (x, z)


def threejs_catmull_tangent_2d(points, t):
    """Exact port of THREE.Curve.getTangent(t) using delta = 0.0001."""
    delta = 0.0001
    t1 = max(0.0, t - delta)
    t2 = min(1.0, t + delta)
    p1 = threejs_catmull_rom_2d(points, t1)
    p2 = threejs_catmull_rom_2d(points, t2)
    dx = p2[0] - p1[0]
    dz = p2[1] - p1[1]
    length = math.hypot(dx, dz) or 1.0
    return (dx / length, dz / length)


def tune_ring_procedural_materials(mats):
    """
    Matches `scripts/ground_geo.py`'s `tune_ground_procedural_materials(mats)`
    using module-level `ROOT` so inner and outer ground share identical world-mapped
    grass texture, bump, and gravel/mortar palettes across the boundary seam.
    """
    map0_path = os.path.join(ROOT, "reference", "map_0.png")
    img_map0 = bpy.data.images.load(map0_path, check_existing=True)
    img_map0.colorspace_settings.name = "sRGB"

    def attach_world_grass_map(mat_name, bump_strength=0.03):
        if mat_name not in mats:
            return
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

    if "proc_gravel" in mats:
        mat_g = mats["proc_gravel"]
        for n in mat_g.node_tree.nodes:
            if n.type == "MIX" and n.data_type == "RGBA":
                n.inputs[6].default_value = (*hex_to_linear("#d1c7b3"), 1.0)
                n.inputs[7].default_value = (*hex_to_linear("#dfd5c1"), 1.0)

    if "proc_mortar" in mats:
        mat_m = mats["proc_mortar"]
        for n in mat_m.node_tree.nodes:
            if n.type == "MIX" and n.data_type == "RGBA":
                n.inputs[6].default_value = (*hex_to_linear("#b2b8af"), 1.0)
                n.inputs[7].default_value = (*hex_to_linear("#bec4bb"), 1.0)


def ring_terrain_world_y(tx, tz):
    """
    World Y of terrain inside flatBounds [-22.6, 22.6] x [-25.4, 9.6] is 0.0750
    (rootY 0.20 + terrainHeight -0.125).
    Near the inner core boundary [-13.6, 13.6] x [-12.2, 8.7], `v20_town_ground.glb`
    and `ground_geo.py` have a 1-cell apron extending to [-14.5333, 14.5333] x [-14.5, 9.6]
    at y = 0.0744..0.0750. Adding a 0.18mm (0.00018m) micro-lift within that apron zone
    eliminates Cycles coplanar ray-tracing Z-fighting while remaining flush to 0.0750
    at the outer boundary.
    """
    base_y = 0.0750
    if -14.8 < tx < 14.8 and -14.8 < tz <= 9.6:
        fx = 1.0 - smoothstep(abs(tx), 14.2, 14.75)
        fz_n = 1.0 - smoothstep(-tz, 14.1, 14.75)
        fz_s = 1.0 - smoothstep(tz, 9.48, 9.60)
        lift = 0.00018 * fx * fz_n * (0.35 + 0.65 * fz_s)
        return base_y + lift
    return base_y


def build_ring_lawn(mats):
    """
    Builds `ring_lawn` covering the exact ring:
      outer rectangle: x in [-22.6, 22.6], z in [-25.4, 9.6]
      minus inner rectangle: x in [-13.6, 13.6], z in [-12.2, 8.7]
    Grid lines include all `v20_live.glb` inner boundary vertices plus the exact
    inner cut lines (x = +-13.6, z = -12.2, 8.7), subdivided 4x per cell to match
    `ground_geo.py`'s mesh density.
    """
    mc = MeshCollector("ring_lawn")

    base_xs = sorted([
        -22.6, -22.133333333333333, -19.6, -17.066666666666666, -14.533333333333333,
        -13.6,
        -12.0, -10.8, -9.6, -8.4, -7.2, -6.0, -4.8, -3.6, -2.4, -1.2, 0.0,
        1.2, 2.4, 3.6, 4.8, 6.0, 7.2, 8.4, 9.6, 10.8, 12.0,
        13.6,
        14.533333333333333, 17.066666666666666, 19.6, 22.133333333333333, 22.6,
    ])
    base_zs = sorted([
        -25.4, -24.5, -22.0, -19.5, -17.0, -14.5,
        -12.2,
        -12.0, -10.88888888888889, -9.777777777777779, -8.666666666666666,
        -7.555555555555555, -6.444444444444445, -5.333333333333333, -4.222222222222222,
        -3.111111111111111, -2.0, -0.8888888888888888, 0.2222222222222222,
        1.3333333333333333, 2.4444444444444446, 3.5555555555555554, 4.666666666666667,
        5.777777777777778, 6.888888888888889, 8.0,
        8.7,
        9.6,
    ])

    def subdivide_axis(coords, sub=4):
        out = [coords[0]]
        for i in range(len(coords) - 1):
            a, b = coords[i], coords[i + 1]
            span = b - a
            steps = 2 if span < 0.85 else sub
            for s in range(1, steps + 1):
                out.append(a + span * (s / steps))
        return out

    xs = subdivide_axis(base_xs, sub=4)
    zs = subdivide_axis(base_zs, sub=4)

    nx = len(xs) - 1
    nz = len(zs) - 1
    stride = nx + 1

    verts = []
    vcols = []
    for z in zs:
        for x in xs:
            y = ring_terrain_world_y(x, z)
            verts.append((x, y, z))
            vcols.append(terrain_color_linear(x, z))

    faces = []
    for iz in range(nz):
        z_mid = 0.5 * (zs[iz] + zs[iz + 1])
        in_z = (INNER_MIN_Z < z_mid < INNER_MAX_Z)
        for ix in range(nx):
            x_mid = 0.5 * (xs[ix] + xs[ix + 1])
            if in_z and (INNER_MIN_X < x_mid < INNER_MAX_X):
                continue
            k = iz * stride + ix
            faces.append((k, k + stride, k + stride + 1, k + 1))

    mc.add_town_mesh(verts, faces, mats["proc_lawn"], vert_colors=vcols)
    return mc.build_object(shade_smooth=True)


def _clip_poly_halfplane(poly, fn):
    """
    Sutherland-Hodgman clip of a 3D Town polygon `[(x, y, z, r, g, b), ...]`
    against half-plane `fn(p) >= 0`.
    """
    if not poly:
        return []
    out = []
    n = len(poly)
    for i in range(n):
        a = poly[i]
        b = poly[(i + 1) % n]
        da = fn(a)
        db = fn(b)
        if da >= -1e-9:
            out.append(a)
            if db < -1e-9:
                t = da / (da - db)
                out.append(tuple(a[k] + (b[k] - a[k]) * t for k in range(len(a))))
        elif db >= -1e-9:
            t = da / (da - db)
            out.append(tuple(a[k] + (b[k] - a[k]) * t for k in range(len(a))))
    return out


def _poly_area_xz(poly):
    if len(poly) < 3:
        return 0.0
    area = 0.0
    for i in range(len(poly)):
        x0, z0 = poly[i][0], poly[i][2]
        x1, z1 = poly[(i + 1) % len(poly)][0], poly[(i + 1) % len(poly)][2]
        area += x0 * z1 - x1 * z0
    return abs(area) * 0.5


def _clip_quad_by_mode(quad, clip_mode):
    """
    Clips a quad against the inner core rectangle boundary according to `clip_mode`:
      - 'east_west': keeps x <= -13.6 or x >= 13.6 (for `neighbour-main-street`)
      - 'north':     keeps z <= -12.2 (for `back-gate-lane-left` and `back-gate-lane-right`)
      - None:        keeps the quad unclipped
    """
    if not clip_mode:
        return [quad]
    if clip_mode == "east_west":
        regions = [
            [lambda p: INNER_MIN_X - p[0]],
            [lambda p: p[0] - INNER_MAX_X],
        ]
    elif clip_mode == "north":
        regions = [
            [lambda p: INNER_MIN_Z - p[2]],
        ]
    else:
        regions = [
            [lambda p: INNER_MIN_X - p[0]],
            [lambda p: p[0] - INNER_MAX_X],
            [lambda p: p[0] - INNER_MIN_X, lambda p: INNER_MAX_X - p[0], lambda p: INNER_MIN_Z - p[2]],
            [lambda p: p[0] - INNER_MIN_X, lambda p: INNER_MAX_X - p[0], lambda p: p[2] - INNER_MAX_Z],
        ]

    result_polys = []
    for constraints in regions:
        poly = quad
        for fn in constraints:
            poly = _clip_poly_halfplane(poly, fn)
            if len(poly) < 3:
                break
        if len(poly) >= 3 and _poly_area_xz(poly) > 1e-7:
            result_polys.append(poly)
    return result_polys


def _build_gravel_ribbon_mesh(points, width, top_y=0.0990, segs=192, clip_mode=None):
    """
    Constructs a sculpted gravel path ribbon along `points` using exact Three.js
    centripetal CatmullRomCurve3 evaluation, with grounded edge bevel skirts down to
    y = 0.0748m and a flat 0.0990m transition at the inner core boundary seam.
    """
    cross_offsets = [
        (-0.510, -0.0242),
        (-0.500, -0.0032),
        (-0.460, -0.0010),
        (-0.200, 0.0000),
        (0.000, 0.0003),
        (0.200, 0.0000),
        (0.460, -0.0010),
        (0.500, -0.0032),
        (0.510, -0.0242),
    ]
    stride = len(cross_offsets)

    grid_pts = []
    for i in range(segs + 1):
        t = i / segs
        px, pz = threejs_catmull_rom_2d(points, t)
        vx, vz = threejs_catmull_tangent_2d(points, t)

        # Taper the very outer end cap (within 2cm of t=0 or t=1 when outside the core)
        end_drop = 0.0
        if i == 0 or i == segs:
            if not (-13.0 < px < 13.0 and -12.0 < pz < 8.5):
                end_drop = -0.0210

        row = []
        for s_frac, edge_drop in cross_offsets:
            wx = px - vz * width * s_frac
            wz = pz + vx * width * s_frac

            if clip_mode == "east_west":
                d_core = max(abs(wx) - INNER_MAX_X, 0.0)
            elif clip_mode == "north":
                d_core = max(INNER_MIN_Z - wz, 0.0)
            else:
                d_core = 10.0

            if abs(s_frac) > 0.505:
                # Outer grounded skirt edge always tucks into the lawn at y = 0.0748
                wy = 0.0748
            else:
                bevel_blend = smoothstep(d_core, 0.10, 0.50)
                apron_lift = 0.00022 * (1.0 - smoothstep(d_core, 0.45, 0.95))
                wy = top_y + apron_lift + edge_drop * bevel_blend + end_drop

            row.append((wx, wy, wz, 1.0, 1.0, 1.0))
        grid_pts.append(row)

    town_verts = []
    vcols = []
    faces = []

    for i in range(segs):
        for j in range(stride - 1):
            quad = [
                grid_pts[i][j],
                grid_pts[i][j + 1],
                grid_pts[i + 1][j + 1],
                grid_pts[i + 1][j],
            ]
            for poly in _clip_quad_by_mode(quad, clip_mode):
                base_idx = len(town_verts)
                for pt in poly:
                    town_verts.append((pt[0], pt[1], pt[2]))
                    vcols.append((pt[3], pt[4], pt[5]))
                faces.append(tuple(base_idx + k for k in range(len(poly))))

    return town_verts, vcols, faces


def _build_paving_loop_mesh(points, width, top_y=0.0990, num_slabs=54):
    """
    Constructs the `neighbour-perimeter-loop` (width 1.5m, paving) as a sculpted
    limestone flagstone promenade with subtle per-course stone tone variation,
    recessed transverse mortar grooves, and grounded bevel edges down to y = 0.0748m.
    """
    cross_offsets = [
        (-0.512, -0.0242),
        (-0.500, -0.0034),
        (-0.465, -0.0010),
        (-0.220, 0.0000),
        (0.000, 0.0004),
        (0.220, 0.0000),
        (0.465, -0.0010),
        (0.500, -0.0034),
        (0.512, -0.0242),
    ]
    stride = len(cross_offsets)
    rng = make_rng(7301)

    # Build longitudinal parameter steps with subtle joint grooves between flagstone courses
    v_steps_local = [0.0, 0.024, 0.060, 0.500, 0.940, 0.976, 1.0]
    town_verts = []
    vcols = []
    faces = []

    for s_idx in range(num_slabs):
        t0 = s_idx / num_slabs
        t1 = (s_idx + 1) / num_slabs
        tone = 1.0 + (rng() - 0.5) * 0.030
        slab_col = (min(1.0, tone), min(1.0, tone), min(1.0, tone * 0.994))
        joint_col = (tone * 0.94, tone * 0.94, tone * 0.935)

        slab_grid = []
        for vj, vf in enumerate(v_steps_local):
            t = t0 + (t1 - t0) * vf
            px, pz = threejs_catmull_rom_2d(points, t)
            vx, vz = threejs_catmull_tangent_2d(points, t)

            is_joint = (s_idx > 0 and vj <= 1) or (s_idx < num_slabs - 1 and vj >= len(v_steps_local) - 2)
            is_end_cap = (s_idx == 0 and vj == 0) or (s_idx == num_slabs - 1 and vj == len(v_steps_local) - 1)
            joint_dip = -0.0022 if is_joint else 0.0
            end_drop = -0.0210 if is_end_cap else 0.0
            row_col = joint_col if is_joint else slab_col

            row = []
            for s_frac, edge_drop in cross_offsets:
                wx = px - vz * width * s_frac
                wz = pz + vx * width * s_frac
                if abs(s_frac) > 0.505:
                    wy = 0.0748
                else:
                    wy = top_y + edge_drop + (joint_dip if abs(s_frac) <= 0.47 else 0.0) + end_drop
                row.append((wx, wy, wz, row_col[0], row_col[1], row_col[2]))
            slab_grid.append(row)

        for vj in range(len(v_steps_local) - 1):
            for ui in range(stride - 1):
                p0 = slab_grid[vj][ui]
                p1 = slab_grid[vj][ui + 1]
                p2 = slab_grid[vj + 1][ui + 1]
                p3 = slab_grid[vj + 1][ui]
                base_idx = len(town_verts)
                for pt in (p0, p1, p2, p3):
                    town_verts.append((pt[0], pt[1], pt[2]))
                    vcols.append((pt[3], pt[4], pt[5]))
                faces.append((base_idx, base_idx + 1, base_idx + 2, base_idx + 3))

    return town_verts, vcols, faces


def build_ring_paths(mats):
    """
    Builds:
      - `ring_gravel`:
          * `neighbour-main-street` (width 2.3, gravel, lift 0.024) clipped at x = +-13.6
          * `back-gate-lane-left` (width 1.4, gravel, lift 0.024) clipped at z = -12.2
          * `back-gate-lane-right` (width 1.4, gravel, lift 0.024) clipped at z = -12.2
      - `ring_paving`:
          * `neighbour-perimeter-loop` (width 1.5, paving, lift 0.024)
    """
    mc_gravel = MeshCollector("ring_gravel")
    mc_paving = MeshCollector("ring_paving")

    gravel_paths = [
        (
            "neighbour-main-street",
            2.3,
            [
                (-20.0, -11.5), (-17.0, -10.95), (-12.6, -10.3), (-8.5, -10.25),
                (-3.0, -10.6), (1.0, -10.65), (5.5, -11.0), (10.0, -10.6),
                (15.6, -11.6), (20.7, -12.8),
            ],
            "east_west",
        ),
        (
            "back-gate-lane-left",
            1.4,
            [(-12.8, -11.0), (-12.85, -16.5), (-12.8, -18.59)],
            "north",
        ),
        (
            "back-gate-lane-right",
            1.4,
            [(8.9, -11.3), (8.9, -16.4), (8.71, -18.42)],
            "north",
        ),
    ]

    for _pid, width, pts, clip_mode in gravel_paths:
        tv, vc, tf = _build_gravel_ribbon_mesh(pts, width, top_y=0.0990, segs=192, clip_mode=clip_mode)
        mc_gravel.add_town_mesh(tv, tf, mats["proc_gravel"], vert_colors=vc)

    loop_pts = [
        (-20.8, -12.5), (-20.5, -18.0), (-18.0, -22.9), (-13.0, -23.9),
        (0.0, -23.9), (13.5, -23.9), (19.5, -21.0), (21.15, -17.5), (21.2, -13.8),
    ]
    tv_p, vc_p, tf_p = _build_paving_loop_mesh(loop_pts, 1.5, top_y=0.0990, num_slabs=54)
    mc_paving.add_town_mesh(tv_p, tf_p, mats["proc_paving"], vert_colors=vc_p)

    obj_gravel = mc_gravel.build_object(shade_smooth=True)
    obj_paving = mc_paving.build_object(shade_smooth=True)
    return obj_gravel, obj_paving


def build_all_ring_meshes(mats):
    tune_ring_procedural_materials(mats)
    obj_lawn = build_ring_lawn(mats)
    obj_gravel, obj_paving = build_ring_paths(mats)
    return {
        "ring_lawn": obj_lawn,
        "ring_gravel": obj_gravel,
        "ring_paving": obj_paving,
    }

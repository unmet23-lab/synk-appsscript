import argparse
import math
import os
import sys
import time

import bmesh
import bpy
from mathutils import Matrix, Vector
import numpy as np


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []

    p = argparse.ArgumentParser(description="Procedural needle-felted cube mascot")
    p.add_argument("--out", type=str, default=".")
    p.add_argument("--name", type=str, default="felt_cube.png")
    p.add_argument("--res", type=int, default=1024)
    p.add_argument("--samples", type=int, default=160)
    p.add_argument("--yaw", type=float, default=21.0)
    p.add_argument("--pitch", type=float, default=17.0)
    p.add_argument("--roll", type=float, default=0.0)
    p.add_argument("--morph", type=float, default=0.0)
    p.add_argument("--squash", type=float, default=1.0)
    p.add_argument("--eyes", type=str, choices=["dot", "pill", "none"], default="dot")
    p.add_argument("--patch", type=int, default=1)
    p.add_argument("--blink", type=float, default=0.0)
    p.add_argument("--gaze-x", dest="gaze_x", type=float, default=0.0)
    p.add_argument("--gaze-y", dest="gaze_y", type=float, default=0.0)
    p.add_argument("--body", type=str, default="3A2F2A")
    p.add_argument("--eye", type=str, default="F1E6CF")
    p.add_argument("--accent", type=str, default="F96859")
    p.add_argument("--bg", type=str, default="000000")
    p.add_argument("--transparent", type=int, default=0)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--save-blend", dest="save_blend", type=str, default=None)
    return p.parse_args(argv)


def srgb_hex_to_linear(hex_str):
    h = hex_str.strip().lstrip("#")
    if len(h) != 6:
        raise ValueError(f"Invalid hex color: {hex_str}")
    rgb = [int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return tuple(lin)


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll_name in ("meshes", "materials", "lights", "cameras", "curves", "hair_curves"):
        coll = getattr(bpy.data, coll_name, None)
        if coll is not None:
            for block in list(coll):
                coll.remove(block)


def tangents_from_normals(normals):
    up = np.where(
        np.abs(normals[:, 2:3]) < 0.9,
        np.array([[0.0, 0.0, 1.0]]),
        np.array([[1.0, 0.0, 0.0]]),
    )
    t1 = np.cross(up, normals)
    t1 /= np.maximum(np.linalg.norm(t1, axis=1, keepdims=True), 1e-8)
    t2 = np.cross(normals, t1)
    t2 /= np.maximum(np.linalg.norm(t2, axis=1, keepdims=True), 1e-8)
    return t1, t2


def sd_triangle_2d(px, pz, p0, p1, p2):
    pts = [(p0, p1), (p1, p2), (p2, p0)]
    min_d2 = np.full_like(px, 1e9, dtype=np.float64)
    inside = np.ones_like(px, dtype=bool)
    for (ax, az), (bx, bz) in pts:
        ex, ez = bx - ax, bz - az
        vx, vz = px - ax, pz - az
        ee = max(ex * ex + ez * ez, 1e-12)
        h = np.clip((vx * ex + vz * ez) / ee, 0.0, 1.0)
        dx = vx - ex * h
        dz = vz - ez * h
        min_d2 = np.minimum(min_d2, dx * dx + dz * dz)
        cross = ex * vz - ez * vx
        inside &= cross >= 0.0
    sign = np.where(inside, -1.0, 1.0)
    return sign * np.sqrt(np.maximum(min_d2, 0.0))


class OrganicField:
    def __init__(self, seed):
        rng = np.random.default_rng(seed + 1009)
        dirs_low = rng.normal(size=(12, 3))
        dirs_low /= np.linalg.norm(dirs_low, axis=1, keepdims=True)
        self.k_low = dirs_low * rng.uniform(1.5, 3.1, size=(12, 1))
        self.p_low = rng.uniform(0.0, 2.0 * math.pi, size=(1, 12))
        self.a_low = rng.uniform(0.0020, 0.0042, size=(12,))

        dirs_mid = rng.normal(size=(12, 3))
        dirs_mid /= np.linalg.norm(dirs_mid, axis=1, keepdims=True)
        self.k_mid = dirs_mid * rng.uniform(4.8, 8.8, size=(12, 1))
        self.p_mid = rng.uniform(0.0, 2.0 * math.pi, size=(1, 12))
        self.a_mid = rng.uniform(0.0007, 0.0016, size=(12,))

        dirs_2d = rng.normal(size=(8, 2))
        dirs_2d /= np.linalg.norm(dirs_2d, axis=1, keepdims=True)
        self.k_edge = dirs_2d * rng.uniform(12.0, 26.0, size=(8, 1))
        self.p_edge = rng.uniform(0.0, 2.0 * math.pi, size=(1, 8))
        self.a_edge = rng.uniform(0.0008, 0.0018, size=(8,))

    def eval_3d(self, pts):
        low = np.sin(pts @ self.k_low.T + self.p_low) @ self.a_low
        mid = np.sin(pts @ self.k_mid.T + self.p_mid) @ self.a_mid
        return low + mid

    def eval_2d(self, x, z):
        pts2 = np.stack([x, z], axis=-1)
        return np.sin(pts2 @ self.k_edge.T + self.p_edge) @ self.a_edge


class FeltSurface:
    def __init__(self, args, field):
        self.args = args
        self.field = field
        self.r_bevel = 0.33
        self.core = 1.0 - self.r_bevel
        self.sphere_r = 1.214
        self.morph = float(np.clip(args.morph, 0.0, 1.0))
        self.sz = float(np.clip(args.squash, 0.5, 2.0))
        self.sxy = 1.0 / math.sqrt(self.sz)
        self.blink = float(np.clip(args.blink, 0.0, 1.0))
        self.v_scale = max(0.10, 1.0 - 0.90 * self.blink)
        self.gx = float(np.clip(args.gaze_x, -1.0, 1.0)) * 0.09
        self.gz = float(np.clip(args.gaze_y, -1.0, 1.0)) * 0.09
        self.eye_centers = [(-0.41 + self.gx, -0.14 + self.gz), (0.41 + self.gx, -0.14 + self.gz)]

        rng = np.random.default_rng(args.seed + 307)
        self.knot_centers = []
        for cx, cz in self.eye_centers:
            knots = []
            for row in (-2, -1, 0, 1, 2):
                end_taper = 0.90 if abs(row) == 2 else 1.0
                for col in (-0.5, 0.5):
                    jx = rng.uniform(-0.0018, 0.0018)
                    jz = rng.uniform(-0.0018, 0.0018)
                    kx = cx + col * 0.09 * end_taper + jx
                    kz = cz + (row * 0.09) * self.v_scale + jz
                    knots.append((kx, kz))
            self.knot_centers.append(knots)

        p_a = (0.35, 0.72)
        p_c = (0.72, 0.42)
        p_b = (0.86, 0.92)
        gx_t = (p_a[0] + p_b[0] + p_c[0]) / 3.0
        gz_t = (p_a[1] + p_b[1] + p_c[1]) / 3.0
        self.patch_center = (gx_t, gz_t)
        shrink = 0.86
        self.patch_tri_inner = [
            (gx_t + shrink * (vx - gx_t), gz_t + shrink * (vz - gz_t))
            for (vx, vz) in (p_a, p_c, p_b)
        ]
        self.patch_round = 0.022

    def front_xz_to_u(self, x, z):
        c = self.core
        ux = np.where(np.abs(x) <= c, x, np.sign(x) * (c + (np.abs(x) - c) * 1.18))
        uz = np.where(np.abs(z) <= c, z, np.sign(z) * (c + (np.abs(z) - c) * 1.18))
        ux = np.clip(ux, -0.996, 0.996)
        uz = np.clip(uz, -0.996, 0.996)
        return np.stack([ux, np.full_like(ux, -1.0), uz], axis=-1)

    def front_u_to_xz(self, ux, uz):
        c = self.core
        x = np.where(np.abs(ux) <= c, ux, np.sign(ux) * (c + (np.abs(ux) - c) / 1.18))
        z = np.where(np.abs(uz) <= c, uz, np.sign(uz) * (c + (np.abs(uz) - c) / 1.18))
        return x, z

    def eye_sdf(self, x, z):
        if self.args.eyes == "none":
            return np.full_like(x, 10.0, dtype=np.float64)
        wob = 0.45 * self.field.eval_2d(x * 1.7, z * 1.7)
        if self.args.eyes == "dot":
            rx = 0.033
            rz = 0.033 * max(0.24, self.v_scale)
            scale_r = min(rx, rz)
            d_min = np.full_like(x, 10.0, dtype=np.float64)
            for knots in self.knot_centers:
                for kx, kz in knots:
                    q = np.hypot((x - kx) / rx, (z - kz) / rz) - 1.0
                    d_min = np.minimum(d_min, q * scale_r)
            return d_min + wob
        a = 0.055
        half_h = 0.15 * self.v_scale
        d_min = np.full_like(x, 10.0, dtype=np.float64)
        for cx, cz in self.eye_centers:
            if half_h >= a:
                seg = half_h - a
                dz = np.maximum(np.abs(z - cz) - seg, 0.0)
                d = np.hypot(x - cx, dz) - a
            else:
                seg_x = a - half_h
                r_cap = max(0.008, half_h)
                dx = np.maximum(np.abs(x - cx) - seg_x, 0.0)
                d = np.hypot(dx, z - cz) - r_cap
            d_min = np.minimum(d_min, d)
        return d_min + wob

    def patch_sdf(self, x, z):
        if not self.args.patch:
            return np.full_like(x, 10.0, dtype=np.float64)
        p0, p1, p2 = self.patch_tri_inner
        raw = sd_triangle_2d(x, z, p0, p1, p2) - self.patch_round
        wob = self.field.eval_2d(x, z)
        return raw + wob

    def eval_points_and_normals(self, u_in, apply_dimples=True):
        u = np.asarray(u_in, dtype=np.float64)
        m = np.maximum(np.max(np.abs(u), axis=1, keepdims=True), 1e-8)
        u = u / m
        k = np.clip(u, -self.core, self.core)
        diff = u - k
        diff_len = np.maximum(np.linalg.norm(diff, axis=1, keepdims=True), 1e-8)
        n_rbox = diff / diff_len
        p_rbox = k + self.r_bevel * n_rbox

        r2 = np.maximum(np.sum(p_rbox * p_rbox, axis=1, keepdims=True), 1e-8)
        r4_sum = np.sum(p_rbox ** 4, axis=1, keepdims=True)
        flatness = np.clip((r4_sum / (r2 * r2) - 1.0 / 3.0) * 1.5, 0.0, 1.0)
        p_rbox = p_rbox + (0.042 * flatness) * n_rbox

        d_unit = p_rbox / np.maximum(np.linalg.norm(p_rbox, axis=1, keepdims=True), 1e-8)
        p_sph = self.sphere_r * d_unit
        t = self.morph * self.morph * (3.0 - 2.0 * self.morph)
        p_base = (1.0 - t) * p_rbox + t * p_sph
        n_base = (1.0 - t) * n_rbox + t * d_unit
        n_base /= np.maximum(np.linalg.norm(n_base, axis=1, keepdims=True), 1e-8)

        disp = self.field.eval_3d(p_base)
        if apply_dimples and self.args.eyes != "none":
            front_mask = u[:, 1] < -0.96
            if np.any(front_mask):
                fx, fz = self.front_u_to_xz(u[front_mask, 0], u[front_mask, 2])
                de = self.eye_sdf(fx, fz)
                dimple = -0.005 * np.exp(-((np.maximum(de, -0.01) / 0.022) ** 2))
                disp[front_mask] += dimple

        p_base = p_base + disp[:, None] * n_base
        scale_p = np.array([[self.sxy, self.sxy, self.sz]])
        scale_n = np.array([[1.0 / self.sxy, 1.0 / self.sxy, 1.0 / self.sz]])
        p_out = p_base * scale_p
        n_out = n_base * scale_n
        n_out /= np.maximum(np.linalg.norm(n_out, axis=1, keepdims=True), 1e-8)
        return p_out, n_out

    def project_3d_to_surface(self, pts):
        inv_scale = np.array([[1.0 / self.sxy, 1.0 / self.sxy, 1.0 / self.sz]])
        unsq = pts * inv_scale
        return self.eval_points_and_normals(unsq, apply_dimples=True)


def face_uv_to_cube_u(face_idx, u1, u2):
    ones = np.ones_like(u1)
    if face_idx == 0:
        return np.stack([u1, -ones, u2], axis=-1)
    if face_idx == 1:
        return np.stack([-u1, ones, u2], axis=-1)
    if face_idx == 2:
        return np.stack([ones, u1, u2], axis=-1)
    if face_idx == 3:
        return np.stack([-ones, -u1, u2], axis=-1)
    if face_idx == 4:
        return np.stack([u1, u2, ones], axis=-1)
    return np.stack([u1, -u2, -ones], axis=-1)


def create_mesh_object(name, verts, faces, material, parent, weld_dist=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts.tolist(), [], faces)
    mesh.update()
    if weld_dist is not None:
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld_dist)
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
    mesh.polygons.foreach_set("use_smooth", np.ones(len(mesh.polygons), dtype=bool))
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def build_body_mesh(surface, material, parent, grid_n=56):
    lin = np.linspace(-1.0, 1.0, grid_n + 1)
    g1, g2 = np.meshgrid(lin, lin, indexing="ij")
    u1 = g1.ravel()
    u2 = g2.ravel()
    all_verts = []
    all_faces = []
    stride = grid_n + 1
    for f_idx in range(6):
        u_cube = face_uv_to_cube_u(f_idx, u1, u2)
        pts, _ = surface.eval_points_and_normals(u_cube, apply_dimples=True)
        base = len(all_verts)
        all_verts.extend(pts)
        for i in range(grid_n):
            for j in range(grid_n):
                v0 = base + i * stride + j
                v1 = base + (i + 1) * stride + j
                v2 = base + (i + 1) * stride + (j + 1)
                v3 = base + i * stride + (j + 1)
                all_faces.append((v0, v1, v2, v3))
    return create_mesh_object("FeltBody", np.asarray(all_verts), all_faces, material, parent, weld_dist=1e-5)


def build_polar_patch_data(center_xz, sdf_func, surface, height, bevel_w, n_ang=96, n_rad=14, max_r=0.45):
    cx, cz = center_xz
    angles = np.linspace(0.0, 2.0 * math.pi, n_ang, endpoint=False)
    dx = np.cos(angles)
    dz = np.sin(angles)
    lo = np.zeros(n_ang, dtype=np.float64)
    hi = np.full(n_ang, max_r, dtype=np.float64)
    for _ in range(16):
        mid = 0.5 * (lo + hi)
        val = sdf_func(cx + mid * dx, cz + mid * dz)
        inside = val <= 0.0
        lo = np.where(inside, mid, lo)
        hi = np.where(inside, hi, mid)
    r_edge = 0.5 * (lo + hi)

    u_c = surface.front_xz_to_u(np.array([cx]), np.array([cz]))
    p_c, n_c = surface.eval_points_and_normals(u_c, apply_dimples=False)
    verts = [p_c[0] + height * n_c[0]]

    s_vals = list(np.linspace(1.0 / n_rad, 1.0, n_rad)) + [1.02]
    for idx_r, s in enumerate(s_vals):
        rx = cx + (r_edge * s) * dx
        rz = cz + (r_edge * s) * dz
        u_ring = surface.front_xz_to_u(rx, rz)
        p_ring, n_ring = surface.eval_points_and_normals(u_ring, apply_dimples=False)
        if idx_r == len(s_vals) - 1:
            lift = np.full((n_ang, 1), -0.005)
        else:
            dist_in = np.maximum((1.0 - s) * r_edge, 0.0)
            t = np.clip(dist_in / max(bevel_w, 1e-5), 0.0, 1.0)
            smooth = t * t * (3.0 - 2.0 * t)
            lift = (height * smooth)[:, None]
        verts.extend(p_ring + lift * n_ring)

    faces = []
    for j in range(n_ang):
        jn = (j + 1) % n_ang
        faces.append((0, 1 + j, 1 + jn))
    for r_i in range(len(s_vals) - 1):
        b0 = 1 + r_i * n_ang
        b1 = 1 + (r_i + 1) * n_ang
        for j in range(n_ang):
            jn = (j + 1) % n_ang
            faces.append((b0 + j, b1 + j, b1 + jn, b0 + jn))

    verts_arr = np.asarray(verts, dtype=np.float64)
    v0, v1, v2 = verts_arr[faces[0][0]], verts_arr[faces[0][1]], verts_arr[faces[0][2]]
    tri_n = np.cross(v1 - v0, v2 - v0)
    if np.dot(tri_n, n_c[0]) < 0.0:
        faces = [tuple(reversed(f)) for f in faces]
    return verts_arr, faces


def build_patch_mesh(surface, material, parent):
    if not surface.args.patch:
        return None
    verts, faces = build_polar_patch_data(
        surface.patch_center,
        surface.patch_sdf,
        surface,
        height=0.011,
        bevel_w=0.024,
        n_ang=128,
        n_rad=16,
        max_r=0.42,
    )
    return create_mesh_object("FeltPatch", verts, faces, material, parent)


def build_eyes_mesh(surface, material, parent):
    if surface.args.eyes == "none":
        return None
    all_verts = []
    all_faces = []
    if surface.args.eyes == "dot":
        rx = 0.033
        rz = 0.033 * max(0.24, surface.v_scale)
        scale_r = min(rx, rz)
        for knots in surface.knot_centers:
            for kx, kz in knots:
                def knot_sdf(x, z, _kx=kx, _kz=kz):
                    wob = 0.35 * surface.field.eval_2d(x * 1.7, z * 1.7)
                    return (np.hypot((x - _kx) / rx, (z - _kz) / rz) - 1.0) * scale_r + wob

                v_part, f_part = build_polar_patch_data(
                    (kx, kz),
                    knot_sdf,
                    surface,
                    height=0.012,
                    bevel_w=0.022,
                    n_ang=28,
                    n_rad=6,
                    max_r=0.06,
                )
                offset = len(all_verts)
                all_verts.extend(v_part)
                all_faces.extend([tuple(idx + offset for idx in f) for f in f_part])
    else:
        a = 0.055
        half_h = 0.15 * surface.v_scale
        for cx, cz in surface.eye_centers:
            def pill_one_sdf(x, z, _cx=cx, _cz=cz):
                wob = 0.45 * surface.field.eval_2d(x * 1.7, z * 1.7)
                if half_h >= a:
                    seg = half_h - a
                    dz = np.maximum(np.abs(z - _cz) - seg, 0.0)
                    return np.hypot(x - _cx, dz) - a + wob
                seg_x = a - half_h
                r_cap = max(0.008, half_h)
                dx = np.maximum(np.abs(x - _cx) - seg_x, 0.0)
                return np.hypot(dx, z - _cz) - r_cap + wob

            v_part, f_part = build_polar_patch_data(
                (cx, cz),
                pill_one_sdf,
                surface,
                height=0.012,
                bevel_w=0.026,
                n_ang=72,
                n_rad=10,
                max_r=0.22,
            )
            offset = len(all_verts)
            all_verts.extend(v_part)
            all_faces.extend([tuple(idx + offset for idx in f) for f in f_part])

    return create_mesh_object("FeltEyes", np.asarray(all_verts), all_faces, material, parent)


def create_curves_object(name, positions, radii, material, parent):
    if positions.shape[0] == 0:
        return None
    n_strands, k_pts, _ = positions.shape
    hair_coll = getattr(bpy.data, "hair_curves", None)
    if hair_coll is None:
        raise RuntimeError("bpy.data.hair_curves is unavailable in this Blender version")
    curves_data = hair_coll.new(name)
    curves_data.add_curves([int(k_pts)] * int(n_strands))

    flat_pos = np.ascontiguousarray(positions, dtype=np.float32).ravel()
    flat_rad = np.ascontiguousarray(radii, dtype=np.float32).ravel()
    curves_data.points.foreach_set("position", flat_pos)
    if "radius" not in curves_data.attributes:
        curves_data.attributes.new(name="radius", type="FLOAT", domain="POINT")
    curves_data.attributes["radius"].data.foreach_set("value", flat_rad)

    if hasattr(curves_data, "set_types"):
        try:
            curves_data.set_types("CATMULL_ROM")
        except Exception:
            pass

    curves_data.materials.append(material)
    obj = bpy.data.objects.new(name, curves_data)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def stratified_cube_roots(surface, rng, n_per_side, margin_clear=0.003):
    u_list = []
    step = 2.0 / n_per_side
    ij = np.arange(n_per_side, dtype=np.float64)
    gi, gj = np.meshgrid(ij, ij, indexing="ij")
    gi = gi.ravel()
    gj = gj.ravel()
    for f_idx in range(6):
        u1 = -1.0 + (gi + rng.uniform(0.05, 0.95, size=gi.shape)) * step
        u2 = -1.0 + (gj + rng.uniform(0.05, 0.95, size=gj.shape)) * step
        u_cube = face_uv_to_cube_u(f_idx, u1, u2)
        if f_idx == 0:
            fx, fz = surface.front_u_to_xz(u_cube[:, 0], u_cube[:, 2])
            keep = (surface.eye_sdf(fx, fz) >= margin_clear) & (
                surface.patch_sdf(fx, fz) >= margin_clear
            )
            u_cube = u_cube[keep]
        u_list.append(u_cube)
    return np.concatenate(u_list, axis=0)


def build_body_wool_layer(surface, rng, u_roots, is_halo=False):
    n = u_roots.shape[0]
    k_pts = 7
    p0, n0 = surface.eval_points_and_normals(u_roots, apply_dimples=True)
    t1, t2 = tangents_from_normals(n0)

    theta = rng.uniform(0.0, 2.0 * math.pi, size=n)
    front_near = u_roots[:, 1] < -0.92
    if np.any(front_near):
        fx, fz = surface.front_u_to_xz(u_roots[front_near, 0], u_roots[front_near, 2])
        d_comb = np.minimum(surface.eye_sdf(fx, fz), surface.patch_sdf(fx, fz))
        border = d_comb < 0.085
        if np.any(border):
            idx_b = np.where(front_near)[0][border]
            bx, bz = fx[border], fz[border]
            eps = 0.003
            gx = np.minimum(surface.eye_sdf(bx + eps, bz), surface.patch_sdf(bx + eps, bz)) - d_comb[border]
            gz = np.minimum(surface.eye_sdf(bx, bz + eps), surface.patch_sdf(bx, bz + eps)) - d_comb[border]
            gn = np.maximum(np.hypot(gx, gz), 1e-8)
            gx, gz = gx / gn, gz / gn
            dir_init = np.cos(theta[idx_b, None]) * t1[idx_b] + np.sin(theta[idx_b, None]) * t2[idx_b]
            dot_in = dir_init[:, 0] * gx + dir_init[:, 2] * gz
            flip = dot_in < 0.15
            theta[idx_b[flip]] += math.pi

    if not is_halo:
        lengths = rng.uniform(0.034, 0.074, size=n)
        omega = rng.normal(0.0, 0.44, size=n)
        crimp_amp = rng.uniform(0.22, 0.56, size=n)
        crimp_freq = rng.uniform(0.95, 1.85, size=n)
        crimp_phase = rng.uniform(0.0, 2.0 * math.pi, size=n)
        h_arch = rng.uniform(0.003, 0.015, size=n)
        fuzz_pick = rng.random(size=n) < 0.26
        h_tip = np.where(fuzz_pick, rng.uniform(0.015, 0.036, size=n), rng.uniform(0.001, 0.013, size=n))
        r_base = rng.uniform(0.0022, 0.0031, size=(n, 1))
        taper = np.array([[0.78, 1.00, 1.00, 0.96, 0.86, 0.58, 0.26]])
    else:
        flyaway = rng.random(size=n) < 0.18
        lengths = np.where(flyaway, rng.uniform(0.14, 0.24, size=n), rng.uniform(0.10, 0.18, size=n))
        omega = rng.normal(0.0, 0.28, size=n)
        crimp_amp = rng.uniform(0.14, 0.34, size=n)
        crimp_freq = rng.uniform(0.70, 1.30, size=n)
        crimp_phase = rng.uniform(0.0, 2.0 * math.pi, size=n)
        h_arch = np.where(flyaway, rng.uniform(0.018, 0.048, size=n), rng.uniform(0.012, 0.032, size=n))
        h_tip = np.where(flyaway, rng.uniform(0.060, 0.138, size=n), rng.uniform(0.022, 0.064, size=n))
        r_base = rng.uniform(0.0016, 0.0023, size=(n, 1))
        taper = np.array([[0.82, 1.00, 0.95, 0.86, 0.72, 0.46, 0.20]])

    positions = np.zeros((n, k_pts, 3), dtype=np.float64)
    positions[:, 0, :] = p0 - 0.002 * n0
    p_surf = p0.copy()
    n_surf = n0.copy()
    ds = lengths / (k_pts - 1)

    for step_i in range(1, k_pts):
        t_frac = step_i / (k_pts - 1)
        theta = (
            theta
            + omega
            + crimp_amp * np.sin(crimp_phase + step_i * crimp_freq)
            + rng.normal(0.0, 0.13, size=n)
        )
        t1_s, t2_s = tangents_from_normals(n_surf)
        dir_tan = np.cos(theta[:, None]) * t1_s + np.sin(theta[:, None]) * t2_s
        loft = h_arch * math.sin(math.pi * (t_frac ** 0.85)) + h_tip * (t_frac ** 1.35)
        horiz_scale = np.sqrt(np.clip(1.0 - (loft / np.maximum(lengths, 1e-4)) ** 2 * 0.35, 0.35, 1.0))
        q_next = p_surf + (ds * horiz_scale)[:, None] * dir_tan
        p_cand, n_cand = surface.project_3d_to_surface(q_next)

        inv_sxy = 1.0 / surface.sxy
        inv_sz = 1.0 / surface.sz
        front_chk = p_cand[:, 1] * inv_sxy < -0.78
        if np.any(front_chk):
            cx = p_cand[front_chk, 0] * inv_sxy
            cz = p_cand[front_chk, 2] * inv_sz
            invade = (surface.eye_sdf(cx, cz) < 0.002) | (surface.patch_sdf(cx, cz) < 0.002)
            if np.any(invade):
                bad_idx = np.where(front_chk)[0][invade]
                p_cand[bad_idx] = p_surf[bad_idx]
                n_cand[bad_idx] = n_surf[bad_idx]
                theta[bad_idx] += 1.4

        p_surf = p_cand
        n_surf = n_cand
        positions[:, step_i, :] = p_surf + loft[:, None] * n_surf

    radii = r_base * taper
    return positions, radii


def build_feature_wool(surface, rng, box_bounds, grid_res, sdf_func, surf_lift, len_range, rad_range, bleed_max):
    xmin, xmax, zmin, zmax = box_bounds
    ij = np.arange(grid_res, dtype=np.float64)
    gi, gj = np.meshgrid(ij, ij, indexing="ij")
    gi = gi.ravel()
    gj = gj.ravel()
    rx = xmin + (gi + rng.uniform(0.05, 0.95, size=gi.shape)) * ((xmax - xmin) / grid_res)
    rz = zmin + (gj + rng.uniform(0.05, 0.95, size=gj.shape)) * ((zmax - zmin) / grid_res)

    d0 = sdf_func(rx, rz)
    keep = d0 <= -0.0012
    rx, rz = rx[keep], rz[keep]
    n = rx.shape[0]
    if n == 0:
        return np.zeros((0, 6, 3)), np.zeros((0, 6))

    k_pts = 6
    lengths = rng.uniform(len_range[0], len_range[1], size=n)
    theta = rng.uniform(0.0, 2.0 * math.pi, size=n)
    omega = rng.normal(0.0, 0.52, size=n)
    h_arch = rng.uniform(0.0018, 0.0075, size=n)
    h_tip = rng.uniform(0.0010, 0.0085, size=n)

    positions = np.zeros((n, k_pts, 3), dtype=np.float64)
    u0 = surface.front_xz_to_u(rx, rz)
    p0, n0 = surface.eval_points_and_normals(u0, apply_dimples=False)
    positions[:, 0, :] = p0 + (surf_lift - 0.0015) * n0

    px, pz = rx.copy(), rz.copy()
    ds = lengths / (k_pts - 1)
    for step_i in range(1, k_pts):
        t_frac = step_i / (k_pts - 1)
        theta = theta + omega + rng.normal(0.0, 0.18, size=n)
        nx = px + ds * np.cos(theta)
        nz = pz + ds * np.sin(theta)
        d_next = sdf_func(nx, nz)
        over = d_next > bleed_max
        if np.any(over):
            nx[over] = px[over] - 0.35 * ds[over] * np.cos(theta[over])
            nz[over] = pz[over] - 0.35 * ds[over] * np.sin(theta[over])
            theta[over] += 1.6
        px, pz = nx, nz
        u_s = surface.front_xz_to_u(px, pz)
        p_s, n_s = surface.eval_points_and_normals(u_s, apply_dimples=False)
        loft = surf_lift + h_arch * math.sin(math.pi * t_frac) + h_tip * t_frac
        positions[:, step_i, :] = p_s + loft[:, None] * n_s

    r_base = rng.uniform(rad_range[0], rad_range[1], size=(n, 1))
    taper = np.array([[0.80, 1.00, 0.98, 0.88, 0.62, 0.28]])
    return positions, r_base * taper


def set_socket(node, candidates, value):
    for name in candidates:
        if name in node.inputs:
            node.inputs[name].default_value = value
            return True
    return False


def build_wool_surface_material(name, base_rgb, dark_scale=0.62):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tex_coord = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    bump = nt.nodes.new("ShaderNodeBump")
    mix_col = nt.nodes.new("ShaderNodeMix")
    mix_col.data_type = "RGBA"

    noise.inputs["Scale"].default_value = 95.0
    noise.inputs["Detail"].default_value = 6.0
    noise.inputs["Roughness"].default_value = 0.75
    bump.inputs["Strength"].default_value = 0.32
    bump.inputs["Distance"].default_value = 0.008

    c_dark = tuple(min(1.0, c * dark_scale) for c in base_rgb) + (1.0,)
    c_mid = tuple(min(1.0, c * (dark_scale * 1.35)) for c in base_rgb) + (1.0,)
    mix_col.inputs["A"].default_value = c_dark
    mix_col.inputs["B"].default_value = c_mid

    set_socket(bsdf, ["Roughness"], 0.95)
    set_socket(bsdf, ["Specular IOR Level", "Specular"], 0.08)
    set_socket(bsdf, ["Sheen Weight", "Sheen"], 0.35)
    set_socket(bsdf, ["Sheen Roughness"], 0.85)

    nt.links.new(tex_coord.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], mix_col.inputs["Factor"])
    nt.links.new(mix_col.outputs["Result"], bsdf.inputs["Base Color"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def build_wool_hair_material(name, base_rgb, gain_low, gain_high, matte_mix=0.22):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    hair_info = nt.nodes.new("ShaderNodeHairInfo")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    tip_mix = nt.nodes.new("ShaderNodeMix")
    tip_mix.data_type = "RGBA"
    hair_bsdf = nt.nodes.new("ShaderNodeBsdfHairPrincipled")
    matte_bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    mix_shader = nt.nodes.new("ShaderNodeMixShader")

    if hasattr(hair_bsdf, "parametrization"):
        try:
            hair_bsdf.parametrization = "DIRECT_COLORING"
        except Exception:
            pass

    c_lo = tuple(min(1.0, c * gain_low) for c in base_rgb) + (1.0,)
    c_hi = tuple(min(1.0, c * gain_high) for c in base_rgb) + (1.0,)
    c_tip = tuple(min(1.0, c * (gain_high * 1.12)) for c in base_rgb) + (1.0,)

    elems = ramp.color_ramp.elements
    elems[0].position = 0.0
    elems[0].color = c_lo
    elems[1].position = 1.0
    elems[1].color = c_hi

    tip_mix.inputs["B"].default_value = c_tip
    nt.links.new(hair_info.outputs["Random"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], tip_mix.inputs["A"])
    nt.links.new(hair_info.outputs["Intercept"], tip_mix.inputs["Factor"])

    set_socket(hair_bsdf, ["Roughness"], 0.68)
    set_socket(hair_bsdf, ["Radial Roughness"], 0.76)
    set_socket(hair_bsdf, ["Coat"], 0.0)
    set_socket(hair_bsdf, ["IOR"], 1.47)
    set_socket(hair_bsdf, ["Random Roughness"], 0.18)
    if "Color" in hair_bsdf.inputs:
        nt.links.new(tip_mix.outputs["Result"], hair_bsdf.inputs["Color"])

    set_socket(matte_bsdf, ["Roughness"], 0.93)
    set_socket(matte_bsdf, ["Specular IOR Level", "Specular"], 0.05)
    set_socket(matte_bsdf, ["Sheen Weight", "Sheen"], 0.40)
    nt.links.new(tip_mix.outputs["Result"], matte_bsdf.inputs["Base Color"])

    mix_shader.inputs["Fac"].default_value = matte_mix
    nt.links.new(hair_bsdf.outputs["BSDF"], mix_shader.inputs[1])
    nt.links.new(matte_bsdf.outputs["BSDF"], mix_shader.inputs[2])
    nt.links.new(mix_shader.outputs["Shader"], out.inputs["Surface"])
    return mat


def add_area_light(name, location, target, energy, size, color):
    light_data = bpy.data.lights.new(name=name, type="AREA")
    light_data.energy = energy
    light_data.shape = "DISK" if hasattr(light_data, "shape") else "SQUARE"
    light_data.size = size
    light_data.color = color
    if hasattr(light_data, "spread"):
        light_data.spread = math.radians(150.0)
    obj = bpy.data.objects.new(name, light_data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = Vector(location)
    direction = (Vector(target) - Vector(location)).normalized()
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return obj


def setup_camera_and_lighting(scene, bg_rgb, transparent):
    world = bpy.data.worlds.new("FeltWorld") if scene.world is None else scene.world
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    w_out = nt.nodes.new("ShaderNodeOutputWorld")
    bg_cam = nt.nodes.new("ShaderNodeBackground")
    bg_dark = nt.nodes.new("ShaderNodeBackground")
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")

    bg_cam.inputs["Color"].default_value = bg_rgb + (1.0,)
    bg_cam.inputs["Strength"].default_value = 1.0
    bg_dark.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    bg_dark.inputs["Strength"].default_value = 0.0
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(bg_dark.outputs["Background"], mix.inputs[1])
    nt.links.new(bg_cam.outputs["Background"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], w_out.inputs["Surface"])

    scene.render.film_transparent = bool(transparent)

    cam_data = bpy.data.cameras.new("MainCamera")
    cam_data.lens = 85.0
    cam_data.sensor_width = 36.0
    cam_obj = bpy.data.objects.new("MainCamera", cam_data)
    scene.collection.objects.link(cam_obj)
    cam_obj.location = Vector((0.0, -9.2, 0.0))
    cam_obj.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    scene.camera = cam_obj

    add_area_light("KeyLight", (-3.6, -4.2, 4.9), (0.0, 0.0, 0.05), 690.0, 5.2, (1.0, 0.985, 0.965))
    add_area_light("SoftFill", (-0.9, -6.2, 2.1), (0.0, 0.0, 0.0), 105.0, 5.6, (0.98, 0.98, 1.0))
    add_area_light("RimBackLeft", (-3.2, 4.6, 2.8), (0.0, 0.0, 0.0), 210.0, 4.4, (1.0, 0.96, 0.90))
    add_area_light("RimBackRight", (3.6, 4.8, -0.5), (0.0, 0.0, 0.0), 165.0, 4.4, (1.0, 0.96, 0.91))


def configure_render(scene, args, out_path):
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = int(args.res)
    scene.render.resolution_y = int(args.res)
    scene.render.resolution_percentage = 100
    scene.render.filepath = out_path
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA" if args.transparent else "RGB"
    scene.render.image_settings.color_depth = "8"

    if hasattr(scene.render, "hair_type"):
        scene.render.hair_type = "STRAND"
    if hasattr(scene.render, "hair_subdivisions"):
        scene.render.hair_subdivisions = 2

    gpu_ok = False
    if "cycles" in bpy.context.preferences.addons:
        cprefs = bpy.context.preferences.addons["cycles"].preferences
        for dev_type in ("OPTIX", "CUDA"):
            try:
                cprefs.compute_device_type = dev_type
                if hasattr(cprefs, "refresh_devices"):
                    cprefs.refresh_devices()
                elif hasattr(cprefs, "get_devices"):
                    cprefs.get_devices()
                matched = [d for d in cprefs.devices if d.type == dev_type]
                if matched:
                    for d in cprefs.devices:
                        d.use = d.type == dev_type
                    scene.cycles.device = "GPU"
                    gpu_ok = True
                    break
            except Exception:
                continue
    if not gpu_ok:
        scene.cycles.device = "CPU"

    scene.cycles.samples = int(args.samples)
    if hasattr(scene.cycles, "use_adaptive_sampling"):
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = 0.012
    scene.cycles.use_denoising = True
    if hasattr(scene.cycles, "denoiser"):
        for dn in ("OPENIMAGEDENOISE", "OPTIX"):
            try:
                scene.cycles.denoiser = dn
                break
            except Exception:
                continue
    if hasattr(scene.cycles, "denoising_input_passes"):
        try:
            scene.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
        except Exception:
            pass

    scene.cycles.max_bounces = 10
    scene.cycles.diffuse_bounces = 6
    scene.cycles.glossy_bounces = 6
    scene.cycles.transmission_bounces = 8
    scene.cycles.transparent_max_bounces = 8

    vs = scene.view_settings
    for vt in ("Khronos PBR Neutral", "Standard"):
        try:
            vs.view_transform = vt
            break
        except Exception:
            continue
    if hasattr(vs, "look"):
        try:
            vs.look = "None"
        except Exception:
            pass
    vs.exposure = 0.0
    vs.gamma = 1.0


def main():
    t_start = time.perf_counter()
    args = parse_args()

    out_dir = os.path.abspath(args.out)
    os.makedirs(out_dir, exist_ok=True)
    fname = args.name if args.name.lower().endswith(".png") else f"{args.name}.png"
    out_path = os.path.join(out_dir, fname)

    body_rgb = srgb_hex_to_linear(args.body)
    eye_rgb = srgb_hex_to_linear(args.eye)
    accent_rgb = srgb_hex_to_linear(args.accent)
    bg_rgb = srgb_hex_to_linear(args.bg)

    clear_scene()
    scene = bpy.context.scene

    rig = bpy.data.objects.new("CubeRig", None)
    scene.collection.objects.link(rig)

    field = OrganicField(args.seed)
    surface = FeltSurface(args, field)

    mat_body_surf = build_wool_surface_material("MatBodySurf", body_rgb, dark_scale=0.56)
    mat_body_wool = build_wool_hair_material("MatBodyWool", body_rgb, gain_low=1.05, gain_high=1.95, matte_mix=0.20)
    mat_body_halo = build_wool_hair_material("MatBodyHalo", body_rgb, gain_low=1.30, gain_high=2.15, matte_mix=0.15)
    mat_eye_surf = build_wool_surface_material("MatEyeSurf", eye_rgb, dark_scale=0.88)
    mat_eye_wool = build_wool_hair_material("MatEyeWool", eye_rgb, gain_low=0.96, gain_high=1.08, matte_mix=0.35)
    mat_patch_surf = build_wool_surface_material("MatPatchSurf", accent_rgb, dark_scale=0.86)
    mat_patch_wool = build_wool_hair_material("MatPatchWool", accent_rgb, gain_low=0.95, gain_high=1.08, matte_mix=0.32)

    build_body_mesh(surface, mat_body_surf, rig, grid_n=56)
    build_patch_mesh(surface, mat_patch_surf, rig)
    build_eyes_mesh(surface, mat_eye_surf, rig)

    rng_base = np.random.default_rng(args.seed + 5003)
    u_base = stratified_cube_roots(surface, rng_base, n_per_side=110, margin_clear=0.003)
    pos_base, rad_base = build_body_wool_layer(surface, rng_base, u_base, is_halo=False)
    create_curves_object("WoolBodyDense", pos_base, rad_base, mat_body_wool, rig)

    rng_halo = np.random.default_rng(args.seed + 7001)
    u_halo = stratified_cube_roots(surface, rng_halo, n_per_side=21, margin_clear=0.006)
    pos_halo, rad_halo = build_body_wool_layer(surface, rng_halo, u_halo, is_halo=True)
    create_curves_object("WoolBodyHalo", pos_halo, rad_halo, mat_body_halo, rig)

    if args.patch:
        rng_patch = np.random.default_rng(args.seed + 9011)
        pos_p, rad_p = build_feature_wool(
            surface,
            rng_patch,
            box_bounds=(0.31, 0.90, 0.38, 0.96),
            grid_res=145,
            sdf_func=surface.patch_sdf,
            surf_lift=0.011,
            len_range=(0.020, 0.042),
            rad_range=(0.0017, 0.0023),
            bleed_max=0.002,
        )
        create_curves_object("WoolPatch", pos_p, rad_p, mat_patch_wool, rig)

    if args.eyes != "none":
        rng_eye = np.random.default_rng(args.seed + 11003)
        bleed = 0.006 if args.eyes == "dot" else 0.011
        eye_pos_list, eye_rad_list = [], []
        for cx, cz in surface.eye_centers:
            pos_e, rad_e = build_feature_wool(
                surface,
                rng_eye,
                box_bounds=(cx - 0.14, cx + 0.14, cz - 0.26, cz + 0.26),
                grid_res=82,
                sdf_func=surface.eye_sdf,
                surf_lift=0.012,
                len_range=(0.015, 0.031),
                rad_range=(0.0016, 0.0022),
                bleed_max=bleed,
            )
            if pos_e.shape[0] > 0:
                eye_pos_list.append(pos_e)
                eye_rad_list.append(rad_e)
        if eye_pos_list:
            create_curves_object(
                "WoolEyes",
                np.concatenate(eye_pos_list, axis=0),
                np.concatenate(eye_rad_list, axis=0),
                mat_eye_wool,
                rig,
            )

    rot_z = Matrix.Rotation(-math.radians(args.yaw), 4, "Z")
    rot_x = Matrix.Rotation(math.radians(args.pitch), 4, "X")
    rot_y = Matrix.Rotation(math.radians(args.roll), 4, "Y")
    rig.matrix_world = rot_y @ rot_x @ rot_z

    setup_camera_and_lighting(scene, bg_rgb, args.transparent)
    configure_render(scene, args, out_path)

    if args.save_blend:
        blend_path = os.path.abspath(args.save_blend)
        os.makedirs(os.path.dirname(blend_path) or ".", exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=blend_path)

    bpy.ops.render.render(write_still=True)
    elapsed = time.perf_counter() - t_start
    print(f"RENDER_DONE {out_path} {elapsed:.2f}", flush=True)


if __name__ == "__main__":
    main()

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
    p.add_argument("--yaw", type=float, default=13.5)
    p.add_argument("--pitch", type=float, default=12.5)
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


def deepen_wool_chroma(lin_rgb, power=1.30):
    m = max(max(lin_rgb), 1e-6)
    return tuple(((c / m) ** power) * m for c in lin_rgb)


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll_name in ("meshes", "materials", "lights", "cameras", "curves", "hair_curves"):
        coll = getattr(bpy.data, coll_name, None)
        if coll is not None:
            for block in list(coll):
                coll.remove(block)


def make_tangent_basis(normals):
    up = np.where(
        np.abs(normals[:, 2:3]) < 0.9,
        np.array([[0.0, 0.0, 1.0]]),
        np.array([[1.0, 0.0, 0.0]]),
    )
    e1 = np.cross(up, normals)
    e1 /= np.maximum(np.linalg.norm(e1, axis=1, keepdims=True), 1e-8)
    e2 = np.cross(normals, e1)
    e2 /= np.maximum(np.linalg.norm(e2, axis=1, keepdims=True), 1e-8)
    return e1, e2


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
        self.k_low = dirs_low * rng.uniform(1.4, 2.8, size=(12, 1))
        self.p_low = rng.uniform(0.0, 2.0 * math.pi, size=(1, 12))
        self.a_low = rng.uniform(0.0016, 0.0034, size=(12,))

        dirs_mid = rng.normal(size=(12, 3))
        dirs_mid /= np.linalg.norm(dirs_mid, axis=1, keepdims=True)
        self.k_mid = dirs_mid * rng.uniform(4.5, 8.2, size=(12, 1))
        self.p_mid = rng.uniform(0.0, 2.0 * math.pi, size=(1, 12))
        self.a_mid = rng.uniform(0.0005, 0.0012, size=(12,))

        dirs_2d = rng.normal(size=(8, 2))
        dirs_2d /= np.linalg.norm(dirs_2d, axis=1, keepdims=True)
        self.k_edge = dirs_2d * rng.uniform(10.0, 22.0, size=(8, 1))
        self.p_edge = rng.uniform(0.0, 2.0 * math.pi, size=(1, 8))
        self.a_edge = rng.uniform(0.0006, 0.0014, size=(8,))

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
        self.r_bevel = 0.26
        self.core = 1.0 - self.r_bevel
        self.sphere_r = 1.225
        self.morph = float(np.clip(args.morph, 0.0, 1.0))
        self.sz = float(np.clip(args.squash, 0.5, 2.0))
        self.sxy = 1.0 / math.sqrt(self.sz)
        self.blink = float(np.clip(args.blink, 0.0, 1.0))
        self.v_scale = max(0.10, 1.0 - 0.90 * self.blink)
        self.gx = float(np.clip(args.gaze_x, -1.0, 1.0)) * 0.09
        self.gz = float(np.clip(args.gaze_y, -1.0, 1.0)) * 0.09
        self.eye_centers = [(-0.40 + self.gx, -0.14 + self.gz), (0.40 + self.gx, -0.14 + self.gz)]

        rng = np.random.default_rng(args.seed + 307)
        self.knot_rx = 0.044
        self.knot_rz = 0.044 * max(0.24, self.v_scale)
        self.knot_height = 0.022
        self.knot_centers = []
        for cx, cz in self.eye_centers:
            knots = []
            for row in (-2, -1, 0, 1, 2):
                end_taper = 0.95 if abs(row) == 2 else 1.0
                for col in (-0.5, 0.5):
                    jx = rng.uniform(-0.0007, 0.0007)
                    jz = rng.uniform(-0.0007, 0.0007)
                    kx = cx + col * 0.10 * end_taper + jx
                    kz = cz + (row * 0.10) * self.v_scale + jz
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
        self.patch_height = 0.0045
        self.patch_bevel = 0.055

    def front_xz_to_u(self, x, z):
        c = self.core
        ux = np.where(np.abs(x) <= c, x, np.sign(x) * (c + (np.abs(x) - c) * 1.12))
        uz = np.where(np.abs(z) <= c, z, np.sign(z) * (c + (np.abs(z) - c) * 1.12))
        ux = np.clip(ux, -0.997, 0.997)
        uz = np.clip(uz, -0.997, 0.997)
        return np.stack([ux, np.full_like(ux, -1.0), uz], axis=-1)

    def eye_sdf(self, x, z):
        if self.args.eyes == "none":
            return np.full_like(x, 10.0, dtype=np.float64)
        if self.args.eyes == "dot":
            rx, rz = self.knot_rx, self.knot_rz
            scale_r = min(rx, rz)
            d_min = np.full_like(x, 10.0, dtype=np.float64)
            for knots in self.knot_centers:
                for kx, kz in knots:
                    q = np.hypot((x - kx) / rx, (z - kz) / rz) - 1.0
                    d_min = np.minimum(d_min, q * scale_r)
            return d_min
        a = 0.055
        half_h = 0.15 * self.v_scale
        wob = 0.25 * self.field.eval_2d(x * 1.5, z * 1.5)
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

    def eye_lift(self, x, z):
        if self.args.eyes == "none":
            return np.zeros_like(x, dtype=np.float64)
        if self.args.eyes == "dot":
            rx, rz = self.knot_rx, self.knot_rz
            h_max = np.zeros_like(x, dtype=np.float64)
            for knots in self.knot_centers:
                for kx, kz in knots:
                    r2 = ((x - kx) / rx) ** 2 + ((z - kz) / rz) ** 2
                    h = np.where(r2 < 1.0, self.knot_height * (np.maximum(1.0 - r2, 0.0) ** 0.62), 0.0)
                    h_max = np.maximum(h_max, h)
            return h_max
        d = self.eye_sdf(x, z)
        t = np.clip(-d / 0.032, 0.0, 1.0)
        return 0.016 * (t * t * (3.0 - 2.0 * t))

    def patch_sdf(self, x, z):
        if not self.args.patch:
            return np.full_like(x, 10.0, dtype=np.float64)
        p0, p1, p2 = self.patch_tri_inner
        raw = sd_triangle_2d(x, z, p0, p1, p2) - self.patch_round
        wob = 0.75 * self.field.eval_2d(x, z)
        return raw + wob

    def patch_lift(self, x, z):
        d = self.patch_sdf(x, z)
        t = np.clip(-d / self.patch_bevel, 0.0, 1.0)
        return self.patch_height * (t * t * (3.0 - 2.0 * t))

    def _eval_from_rbox(self, p_rbox, n_rbox, apply_dimples=True):
        r2 = np.maximum(np.sum(p_rbox * p_rbox, axis=1, keepdims=True), 1e-8)
        r4_sum = np.sum(p_rbox ** 4, axis=1, keepdims=True)
        flatness = np.clip((r4_sum / (r2 * r2) - 1.0 / 3.0) * 1.5, 0.0, 1.0)
        p_bulged = p_rbox + (0.026 * flatness) * n_rbox

        d_unit = p_bulged / np.maximum(np.linalg.norm(p_bulged, axis=1, keepdims=True), 1e-8)
        p_sph = self.sphere_r * d_unit
        t = self.morph * self.morph * (3.0 - 2.0 * self.morph)
        p_base = (1.0 - t) * p_bulged + t * p_sph
        n_base = (1.0 - t) * n_rbox + t * d_unit
        n_base /= np.maximum(np.linalg.norm(n_base, axis=1, keepdims=True), 1e-8)

        disp = self.field.eval_3d(p_base)
        if apply_dimples and self.args.eyes != "none":
            front_mask = n_rbox[:, 1] < -0.85
            if np.any(front_mask):
                fx = p_rbox[front_mask, 0]
                fz = p_rbox[front_mask, 2]
                de = self.eye_sdf(fx, fz)
                dimple = -0.004 * np.exp(-((np.maximum(de, -0.008) / 0.018) ** 2))
                disp[front_mask] += dimple

        p_base = p_base + disp[:, None] * n_base
        scale_p = np.array([[self.sxy, self.sxy, self.sz]])
        scale_n = np.array([[1.0 / self.sxy, 1.0 / self.sxy, 1.0 / self.sz]])
        p_out = p_base * scale_p
        n_out = n_base * scale_n
        n_out /= np.maximum(np.linalg.norm(n_out, axis=1, keepdims=True), 1e-8)
        return p_out, n_out

    def eval_from_cube_u(self, u_in, apply_dimples=True):
        u = np.asarray(u_in, dtype=np.float64)
        m = np.maximum(np.max(np.abs(u), axis=1, keepdims=True), 1e-8)
        u = u / m
        k = np.clip(u, -self.core, self.core)
        diff = u - k
        n_rbox = diff / np.maximum(np.linalg.norm(diff, axis=1, keepdims=True), 1e-8)
        p_rbox = k + self.r_bevel * n_rbox
        return self._eval_from_rbox(p_rbox, n_rbox, apply_dimples=apply_dimples)

    def closest_on_body(self, pts, apply_dimples=True):
        q = pts * np.array([[1.0 / self.sxy, 1.0 / self.sxy, 1.0 / self.sz]])
        k = np.clip(q, -self.core, self.core)
        diff = q - k
        d_len = np.linalg.norm(diff, axis=1, keepdims=True)
        fallback = q / np.maximum(np.linalg.norm(q, axis=1, keepdims=True), 1e-8)
        n_rbox = np.where(d_len > 1e-6, diff / np.maximum(d_len, 1e-8), fallback)
        p_rbox = k + self.r_bevel * n_rbox
        return self._eval_from_rbox(p_rbox, n_rbox, apply_dimples=apply_dimples)


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


def build_body_mesh_and_sampler(surface, material, parent, grid_n=68):
    lin = np.linspace(-1.0, 1.0, grid_n + 1)
    g1, g2 = np.meshgrid(lin, lin, indexing="ij")
    u1, u2 = g1.ravel(), g2.ravel()

    surf_pts = []
    surf_nrms = []
    mesh_verts = []
    quad_faces = []
    tri_indices = []
    stride = grid_n + 1

    for f_idx in range(6):
        u_cube = face_uv_to_cube_u(f_idx, u1, u2)
        pts, nrms = surface.eval_from_cube_u(u_cube, apply_dimples=True)
        base = len(surf_pts)
        surf_pts.extend(pts)
        surf_nrms.extend(nrms)
        mesh_verts.extend(pts - 0.0015 * nrms)
        for i in range(grid_n):
            for j in range(grid_n):
                v0 = base + i * stride + j
                v1 = base + (i + 1) * stride + j
                v2 = base + (i + 1) * stride + (j + 1)
                v3 = base + i * stride + (j + 1)
                quad_faces.append((v0, v1, v2, v3))
                tri_indices.append((v0, v1, v2))
                tri_indices.append((v0, v2, v3))

    obj = create_mesh_object(
        "FeltBody", np.asarray(mesh_verts), quad_faces, material, parent, weld_dist=1e-5
    )
    pts_arr = np.asarray(surf_pts, dtype=np.float64)
    nrms_arr = np.asarray(surf_nrms, dtype=np.float64)
    tris = np.asarray(tri_indices, dtype=np.int32)
    v0 = pts_arr[tris[:, 0]]
    v1 = pts_arr[tris[:, 1]]
    v2 = pts_arr[tris[:, 2]]
    areas = 0.5 * np.linalg.norm(np.cross(v1 - v0, v2 - v0), axis=1)
    cdf = np.cumsum(areas) / np.sum(areas)
    return obj, (pts_arr, nrms_arr, tris, cdf)


def sample_body_roots(sampler_data, surface, rng, n_samples, clear_eye=-0.001, clear_patch=-0.003):
    pts_arr, nrms_arr, tris, cdf = sampler_data
    u_strat = (np.arange(n_samples, dtype=np.float64) + rng.uniform(0.0, 1.0, size=n_samples)) / n_samples
    t_idx = np.clip(np.searchsorted(cdf, u_strat), 0, len(tris) - 1)
    t_verts = tris[t_idx]

    r1 = np.sqrt(rng.uniform(0.0, 1.0, size=n_samples))
    r2 = rng.uniform(0.0, 1.0, size=n_samples)
    w0 = (1.0 - r1)[:, None]
    w1 = (r1 * (1.0 - r2))[:, None]
    w2 = (r1 * r2)[:, None]

    p0 = w0 * pts_arr[t_verts[:, 0]] + w1 * pts_arr[t_verts[:, 1]] + w2 * pts_arr[t_verts[:, 2]]
    n0 = w0 * nrms_arr[t_verts[:, 0]] + w1 * nrms_arr[t_verts[:, 1]] + w2 * nrms_arr[t_verts[:, 2]]
    n0 /= np.maximum(np.linalg.norm(n0, axis=1, keepdims=True), 1e-8)

    unsq_x = p0[:, 0] / surface.sxy
    unsq_y = p0[:, 1] / surface.sxy
    unsq_z = p0[:, 2] / surface.sz
    front = unsq_y < -0.70
    if np.any(front):
        fx, fz = unsq_x[front], unsq_z[front]
        bad = (surface.eye_sdf(fx, fz) < clear_eye) | (surface.patch_sdf(fx, fz) < clear_patch)
        keep = np.ones(n_samples, dtype=bool)
        keep[np.where(front)[0][bad]] = False
        p0, n0 = p0[keep], n0[keep]
    return p0, n0


def build_polar_patch_data(center_xz, sdf_func, surface, height, bevel_w, profile="bevel", n_ang=96, n_rad=14, max_r=0.45):
    cx, cz = center_xz
    angles = np.linspace(0.0, 2.0 * math.pi, n_ang, endpoint=False)
    dx, dz = np.cos(angles), np.sin(angles)
    lo = np.zeros(n_ang, dtype=np.float64)
    hi = np.full(n_ang, max_r, dtype=np.float64)
    for _ in range(16):
        mid = 0.5 * (lo + hi)
        inside = sdf_func(cx + mid * dx, cz + mid * dz) <= 0.0
        lo = np.where(inside, mid, lo)
        hi = np.where(inside, hi, mid)
    r_edge = 0.5 * (lo + hi)

    u_c = surface.front_xz_to_u(np.array([cx]), np.array([cz]))
    p_c, n_c = surface.eval_from_cube_u(u_c, apply_dimples=False)
    verts = [p_c[0] + height * n_c[0]]

    s_vals = list(np.linspace(1.0 / n_rad, 1.0, n_rad)) + [1.03]
    for idx_r, s in enumerate(s_vals):
        rx = cx + (r_edge * s) * dx
        rz = cz + (r_edge * s) * dz
        u_ring = surface.front_xz_to_u(rx, rz)
        p_ring, n_ring = surface.eval_from_cube_u(u_ring, apply_dimples=False)
        if idx_r == len(s_vals) - 1:
            lift = np.full((n_ang, 1), -0.004)
        elif profile == "dome":
            lift = np.full((n_ang, 1), height * (max(1.0 - s * s, 0.0) ** 0.62))
        else:
            dist_in = np.maximum((1.0 - s) * r_edge, 0.0)
            t = np.clip(dist_in / max(bevel_w, 1e-5), 0.0, 1.0)
            lift = (height * (t * t * (3.0 - 2.0 * t)))[:, None]
        verts.extend(p_ring + lift * n_ring)

    faces = []
    for j in range(n_ang):
        faces.append((0, 1 + j, 1 + (j + 1) % n_ang))
    for r_i in range(len(s_vals) - 1):
        b0 = 1 + r_i * n_ang
        b1 = 1 + (r_i + 1) * n_ang
        for j in range(n_ang):
            jn = (j + 1) % n_ang
            faces.append((b0 + j, b1 + j, b1 + jn, b0 + jn))

    verts_arr = np.asarray(verts, dtype=np.float64)
    v0, v1, v2 = verts_arr[faces[0][0]], verts_arr[faces[0][1]], verts_arr[faces[0][2]]
    if np.dot(np.cross(v1 - v0, v2 - v0), n_c[0]) < 0.0:
        faces = [tuple(reversed(f)) for f in faces]
    return verts_arr, faces


def build_patch_mesh(surface, material, parent):
    if not surface.args.patch:
        return None
    verts, faces = build_polar_patch_data(
        surface.patch_center,
        surface.patch_sdf,
        surface,
        height=surface.patch_height,
        bevel_w=surface.patch_bevel,
        profile="bevel",
        n_ang=136,
        n_rad=18,
        max_r=0.42,
    )
    return create_mesh_object("FeltPatch", verts, faces, material, parent)


def build_eyes_mesh(surface, material, parent):
    if surface.args.eyes == "none":
        return None
    all_verts, all_faces = [], []
    if surface.args.eyes == "dot":
        rx, rz = surface.knot_rx, surface.knot_rz
        scale_r = min(rx, rz)
        for knots in surface.knot_centers:
            for kx, kz in knots:
                def knot_sdf(x, z, _kx=kx, _kz=kz):
                    return (np.hypot((x - _kx) / rx, (z - _kz) / rz) - 1.0) * scale_r

                v_part, f_part = build_polar_patch_data(
                    (kx, kz),
                    knot_sdf,
                    surface,
                    height=surface.knot_height,
                    bevel_w=0.02,
                    profile="dome",
                    n_ang=32,
                    n_rad=8,
                    max_r=0.07,
                )
                off = len(all_verts)
                all_verts.extend(v_part)
                all_faces.extend([tuple(idx + off for idx in f) for f in f_part])
    else:
        a = 0.055
        half_h = 0.15 * surface.v_scale
        for cx, cz in surface.eye_centers:
            def pill_one_sdf(x, z, _cx=cx, _cz=cz):
                wob = 0.25 * surface.field.eval_2d(x * 1.5, z * 1.5)
                if half_h >= a:
                    seg = half_h - a
                    return np.hypot(x - _cx, np.maximum(np.abs(z - _cz) - seg, 0.0)) - a + wob
                seg_x = a - half_h
                r_cap = max(0.008, half_h)
                return np.hypot(np.maximum(np.abs(x - _cx) - seg_x, 0.0), z - _cz) - r_cap + wob

            v_part, f_part = build_polar_patch_data(
                (cx, cz),
                pill_one_sdf,
                surface,
                height=0.016,
                bevel_w=0.032,
                profile="bevel",
                n_ang=80,
                n_rad=12,
                max_r=0.22,
            )
            off = len(all_verts)
            all_verts.extend(v_part)
            all_faces.extend([tuple(idx + off for idx in f) for f in f_part])

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

    curves_data.points.foreach_set("position", np.ascontiguousarray(positions, dtype=np.float32).ravel())
    if "radius" not in curves_data.attributes:
        curves_data.attributes.new(name="radius", type="FLOAT", domain="POINT")
    curves_data.attributes["radius"].data.foreach_set(
        "value", np.ascontiguousarray(radii, dtype=np.float32).ravel()
    )

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


def trace_body_strands(surface, rng, p0, n0, mode="mat"):
    n = p0.shape[0]
    k_pts = 5
    e1, e2 = make_tangent_basis(n0)
    ang0 = rng.uniform(0.0, 2.0 * math.pi, size=n)
    d_vec = np.cos(ang0)[:, None] * e1 + np.sin(ang0)[:, None] * e2

    if mode == "mat":
        lengths = rng.uniform(0.030, 0.070, size=n)
        turn_step = rng.uniform(-0.42, 0.42, size=n)
        turn_acc = rng.normal(0.0, 0.09, size=n)
        h_layer = rng.uniform(0.0010, 0.0075, size=n)
        h_arch = rng.uniform(0.0010, 0.0055, size=n)
        r_base = rng.uniform(0.0013, 0.0019, size=(n, 1))
        taper = np.array([[0.82, 1.00, 0.96, 0.78, 0.34]])
        horiz_ds = lengths / (k_pts - 1)
    elif mode == "fuzz":
        lengths = rng.uniform(0.034, 0.062, size=n)
        turn_step = rng.uniform(-0.36, 0.36, size=n)
        turn_acc = rng.normal(0.0, 0.08, size=n)
        h_top = rng.uniform(0.018, 0.040, size=n)
        horiz_len = np.sqrt(np.maximum(lengths * lengths - h_top * h_top * 0.75, (0.45 * lengths) ** 2))
        horiz_ds = horiz_len / (k_pts - 1)
        r_base = rng.uniform(0.0010, 0.0014, size=(n, 1))
        taper = np.array([[0.85, 1.00, 0.90, 0.64, 0.24]])
    else:
        lengths = rng.uniform(0.055, 0.115, size=n)
        turn_step = rng.uniform(-0.32, 0.32, size=n)
        turn_acc = rng.normal(0.0, 0.10, size=n)
        h_top = rng.uniform(0.030, 0.068, size=n)
        horiz_len = np.sqrt(np.maximum(lengths * lengths - h_top * h_top * 0.7, (0.50 * lengths) ** 2))
        horiz_ds = horiz_len / (k_pts - 1)
        r_base = rng.uniform(0.0008, 0.0012, size=(n, 1))
        taper = np.array([[0.85, 1.00, 0.88, 0.58, 0.18]])

    positions = np.zeros((n, k_pts, 3), dtype=np.float64)
    positions[:, 0, :] = p0 - 0.0020 * n0
    p_surf = p0.copy()
    n_surf = n0.copy()
    inv_sxy = 1.0 / surface.sxy
    inv_sz = 1.0 / surface.sz

    for step_i in range(1, k_pts):
        t_frac = step_i / (k_pts - 1)
        q_next = p_surf + horiz_ds[:, None] * d_vec
        p_cand, n_cand = surface.closest_on_body(q_next, apply_dimples=True)

        front_chk = p_cand[:, 1] * inv_sxy < -0.72
        if np.any(front_chk):
            cx = p_cand[front_chk, 0] * inv_sxy
            cz = p_cand[front_chk, 2] * inv_sz
            invade = (surface.eye_sdf(cx, cz) < -0.001) | (surface.patch_sdf(cx, cz) < -0.004)
            if np.any(invade):
                bad = np.where(front_chk)[0][invade]
                p_cand[bad] = p_surf[bad]
                n_cand[bad] = n_surf[bad]
                d_vec[bad] = -d_vec[bad]

        p_surf, n_surf = p_cand, n_cand
        d_vec = d_vec - np.sum(d_vec * n_surf, axis=1, keepdims=True) * n_surf
        d_vec /= np.maximum(np.linalg.norm(d_vec, axis=1, keepdims=True), 1e-8)
        d_perp = np.cross(n_surf, d_vec)
        d_ang = turn_step + step_i * turn_acc + rng.normal(0.0, 0.09, size=n)
        d_vec = np.cos(d_ang)[:, None] * d_vec + np.sin(d_ang)[:, None] * d_perp

        if mode == "mat":
            loft = h_layer * (t_frac ** 0.4) + h_arch * math.sin(math.pi * t_frac)
        else:
            loft = h_top * math.sin(0.5 * math.pi * (t_frac ** 0.85))
        positions[:, step_i, :] = p_surf + loft[:, None] * n_surf

    return positions, r_base * taper


def build_feature_wool(surface, rng, box_bounds, grid_res, sdf_func, lift_func, len_range, rad_range, loft_range, bleed_max):
    xmin, xmax, zmin, zmax = box_bounds
    ij = np.arange(grid_res, dtype=np.float64)
    gi, gj = np.meshgrid(ij, ij, indexing="ij")
    gi, gj = gi.ravel(), gj.ravel()
    rx = xmin + (gi + rng.uniform(0.05, 0.95, size=gi.shape)) * ((xmax - xmin) / grid_res)
    rz = zmin + (gj + rng.uniform(0.05, 0.95, size=gj.shape)) * ((zmax - zmin) / grid_res)

    keep = sdf_func(rx, rz) <= -0.0006
    rx, rz = rx[keep], rz[keep]
    n = rx.shape[0]
    if n == 0:
        return np.zeros((0, 5, 3)), np.zeros((0, 5))

    k_pts = 5
    lengths = rng.uniform(len_range[0], len_range[1], size=n)
    theta = rng.uniform(0.0, 2.0 * math.pi, size=n)
    turn = rng.uniform(-0.45, 0.45, size=n)
    h_arch = rng.uniform(loft_range[0], loft_range[1], size=n)

    positions = np.zeros((n, k_pts, 3), dtype=np.float64)
    u0 = surface.front_xz_to_u(rx, rz)
    p0, n0 = surface.eval_from_cube_u(u0, apply_dimples=False)
    base_h0 = lift_func(rx, rz)
    positions[:, 0, :] = p0 + (base_h0 - 0.0012)[:, None] * n0

    px, pz = rx.copy(), rz.copy()
    ds = lengths / (k_pts - 1)
    for step_i in range(1, k_pts):
        t_frac = step_i / (k_pts - 1)
        theta = theta + turn + rng.normal(0.0, 0.12, size=n)
        nx = px + ds * np.cos(theta)
        nz = pz + ds * np.sin(theta)
        over = sdf_func(nx, nz) > bleed_max
        if np.any(over):
            nx[over] = px[over]
            nz[over] = pz[over]
            theta[over] += 1.8
        px, pz = nx, nz
        u_s = surface.front_xz_to_u(px, pz)
        p_s, n_s = surface.eval_from_cube_u(u_s, apply_dimples=False)
        loft = lift_func(px, pz) + h_arch * math.sin(math.pi * (t_frac ** 0.75))
        positions[:, step_i, :] = p_s + loft[:, None] * n_s

    r_base = rng.uniform(rad_range[0], rad_range[1], size=(n, 1))
    taper = np.array([[0.82, 1.00, 0.94, 0.72, 0.30]])
    return positions, r_base * taper


def set_socket(node, candidates, value):
    for name in candidates:
        if name in node.inputs:
            node.inputs[name].default_value = value
            return True
    return False


def build_felt_base_material(name, base_rgb, dark_scale=0.95, rich_scale=1.35, bump_strength=0.55):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    tex_coord = nt.nodes.new("ShaderNodeTexCoord")
    noise_fine = nt.nodes.new("ShaderNodeTexNoise")
    noise_coarse = nt.nodes.new("ShaderNodeTexNoise")
    bump = nt.nodes.new("ShaderNodeBump")
    mix_col = nt.nodes.new("ShaderNodeMix")
    mix_col.data_type = "RGBA"

    noise_fine.inputs["Scale"].default_value = 180.0
    noise_fine.inputs["Detail"].default_value = 8.0
    noise_fine.inputs["Roughness"].default_value = 0.80
    noise_coarse.inputs["Scale"].default_value = 42.0
    noise_coarse.inputs["Detail"].default_value = 4.0

    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = 0.006
    diff.inputs["Roughness"].default_value = 0.90

    c_lo = tuple(min(1.0, c * dark_scale) for c in base_rgb) + (1.0,)
    c_hi = tuple(min(1.0, c * rich_scale) for c in base_rgb) + (1.0,)
    mix_col.inputs["A"].default_value = c_lo
    mix_col.inputs["B"].default_value = c_hi

    nt.links.new(tex_coord.outputs["Object"], noise_fine.inputs["Vector"])
    nt.links.new(tex_coord.outputs["Object"], noise_coarse.inputs["Vector"])
    nt.links.new(noise_coarse.outputs["Fac"], mix_col.inputs["Factor"])
    nt.links.new(mix_col.outputs["Result"], diff.inputs["Color"])
    nt.links.new(noise_fine.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], diff.inputs["Normal"])
    nt.links.new(diff.outputs["BSDF"], out.inputs["Surface"])
    return mat


def build_wool_fiber_material(name, base_rgb, stops, hair_weight=0.28, trans_weight=0.18):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    hair_info = nt.nodes.new("ShaderNodeHairInfo")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    diff_bsdf = nt.nodes.new("ShaderNodeBsdfDiffuse")
    trans_bsdf = nt.nodes.new("ShaderNodeBsdfTranslucent")
    hair_bsdf = nt.nodes.new("ShaderNodeBsdfHairPrincipled")
    mix_dt = nt.nodes.new("ShaderNodeMixShader")
    mix_final = nt.nodes.new("ShaderNodeMixShader")

    if hasattr(hair_bsdf, "parametrization"):
        try:
            hair_bsdf.parametrization = "DIRECT_COLORING"
        except Exception:
            pass

    cr = ramp.color_ramp
    cr.interpolation = "LINEAR"
    while len(cr.elements) > 2:
        cr.elements.remove(cr.elements[-1])
    for idx, (pos, gain) in enumerate(stops):
        elem = cr.elements[idx] if idx < len(cr.elements) else cr.elements.new(pos)
        elem.position = pos
        elem.color = tuple(min(1.0, c * gain) for c in base_rgb) + (1.0,)

    nt.links.new(hair_info.outputs["Random"], ramp.inputs["Fac"])

    diff_bsdf.inputs["Roughness"].default_value = 0.88
    nt.links.new(ramp.outputs["Color"], diff_bsdf.inputs["Color"])
    nt.links.new(ramp.outputs["Color"], trans_bsdf.inputs["Color"])

    set_socket(hair_bsdf, ["Roughness"], 0.82)
    set_socket(hair_bsdf, ["Radial Roughness"], 0.88)
    set_socket(hair_bsdf, ["Coat"], 0.0)
    set_socket(hair_bsdf, ["IOR"], 1.36)
    set_socket(hair_bsdf, ["Random Roughness"], 0.20)
    if "Color" in hair_bsdf.inputs:
        nt.links.new(ramp.outputs["Color"], hair_bsdf.inputs["Color"])

    mix_dt.inputs["Fac"].default_value = trans_weight
    nt.links.new(diff_bsdf.outputs["BSDF"], mix_dt.inputs[1])
    nt.links.new(trans_bsdf.outputs["BSDF"], mix_dt.inputs[2])

    mix_final.inputs["Fac"].default_value = hair_weight
    nt.links.new(mix_dt.outputs["Shader"], mix_final.inputs[1])
    nt.links.new(hair_bsdf.outputs["BSDF"], mix_final.inputs[2])
    nt.links.new(mix_final.outputs["Shader"], out.inputs["Surface"])
    return mat


def add_area_light(name, location, target, energy, size, color):
    light_data = bpy.data.lights.new(name=name, type="AREA")
    light_data.energy = energy
    light_data.shape = "DISK" if hasattr(light_data, "shape") else "SQUARE"
    light_data.size = size
    light_data.color = color
    if hasattr(light_data, "spread"):
        light_data.spread = math.radians(155.0)
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
    cam_obj.location = Vector((0.0, -8.55, 0.0))
    cam_obj.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    scene.camera = cam_obj

    add_area_light("KeyLight", (-3.5, -4.4, 5.0), (0.0, 0.0, 0.05), 670.0, 5.4, (1.0, 0.975, 0.945))
    add_area_light("SoftFill", (-0.8, -6.2, 2.0), (0.0, 0.0, 0.0), 95.0, 5.8, (1.0, 0.97, 0.94))
    add_area_light("RimBackLeft", (-3.0, 4.4, 2.6), (0.0, 0.0, 0.0), 175.0, 4.6, (1.0, 0.95, 0.89))
    add_area_light("RimBackRight", (3.5, 4.2, 0.1), (0.0, 0.0, 0.0), 145.0, 4.6, (1.0, 0.95, 0.89))


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
    scene.cycles.glossy_bounces = 4
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

    body_rgb = deepen_wool_chroma(srgb_hex_to_linear(args.body), power=1.30)
    eye_rgb = srgb_hex_to_linear(args.eye)
    accent_rgb = srgb_hex_to_linear(args.accent)
    bg_rgb = srgb_hex_to_linear(args.bg)

    clear_scene()
    scene = bpy.context.scene

    rig = bpy.data.objects.new("CubeRig", None)
    scene.collection.objects.link(rig)

    field = OrganicField(args.seed)
    surface = FeltSurface(args, field)

    body_stops = [(0.0, 0.90), (0.45, 1.32), (0.78, 1.82), (0.93, 2.42), (1.0, 3.00)]
    fuzz_stops = [(0.0, 1.15), (0.55, 1.65), (0.88, 2.25), (1.0, 2.85)]
    feat_stops = [(0.0, 0.94), (0.60, 1.02), (1.0, 1.10)]

    mat_body_surf = build_felt_base_material("MatBodySurf", body_rgb, dark_scale=0.95, rich_scale=1.38, bump_strength=0.65)
    mat_body_mat = build_wool_fiber_material("MatBodyMat", body_rgb, body_stops, hair_weight=0.25, trans_weight=0.16)
    mat_body_fuzz = build_wool_fiber_material("MatBodyFuzz", body_rgb, fuzz_stops, hair_weight=0.34, trans_weight=0.24)
    mat_eye_surf = build_felt_base_material("MatEyeSurf", eye_rgb, dark_scale=0.92, rich_scale=1.02, bump_strength=0.14)
    mat_eye_wool = build_wool_fiber_material("MatEyeWool", eye_rgb, feat_stops, hair_weight=0.22, trans_weight=0.18)
    mat_patch_surf = build_felt_base_material("MatPatchSurf", accent_rgb, dark_scale=0.90, rich_scale=1.03, bump_strength=0.28)
    mat_patch_wool = build_wool_fiber_material("MatPatchWool", accent_rgb, feat_stops, hair_weight=0.22, trans_weight=0.15)

    _, sampler_data = build_body_mesh_and_sampler(surface, mat_body_surf, rig, grid_n=68)
    build_patch_mesh(surface, mat_patch_surf, rig)
    build_eyes_mesh(surface, mat_eye_surf, rig)

    rng_mat = np.random.default_rng(args.seed + 5003)
    p_mat, n_mat = sample_body_roots(sampler_data, surface, rng_mat, n_samples=168000)
    pos_mat, rad_mat = trace_body_strands(surface, rng_mat, p_mat, n_mat, mode="mat")
    create_curves_object("WoolBodyMat", pos_mat, rad_mat, mat_body_mat, rig)

    rng_fuzz = np.random.default_rng(args.seed + 7001)
    p_fuzz, n_fuzz = sample_body_roots(sampler_data, surface, rng_fuzz, n_samples=48000)
    pos_fuzz, rad_fuzz = trace_body_strands(surface, rng_fuzz, p_fuzz, n_fuzz, mode="fuzz")
    create_curves_object("WoolBodyFuzz", pos_fuzz, rad_fuzz, mat_body_fuzz, rig)

    rng_wisp = np.random.default_rng(args.seed + 8101)
    p_wisp, n_wisp = sample_body_roots(sampler_data, surface, rng_wisp, n_samples=380, clear_eye=0.02, clear_patch=0.02)
    pos_wisp, rad_wisp = trace_body_strands(surface, rng_wisp, p_wisp, n_wisp, mode="wisp")
    create_curves_object("WoolBodyWisps", pos_wisp, rad_wisp, mat_body_fuzz, rig)

    if args.patch:
        rng_patch = np.random.default_rng(args.seed + 9011)
        pos_p, rad_p = build_feature_wool(
            surface,
            rng_patch,
            box_bounds=(0.32, 0.89, 0.39, 0.95),
            grid_res=225,
            sdf_func=surface.patch_sdf,
            lift_func=surface.patch_lift,
            len_range=(0.016, 0.034),
            rad_range=(0.0009, 0.0013),
            loft_range=(0.0008, 0.0032),
            bleed_max=0.005,
        )
        create_curves_object("WoolPatch", pos_p, rad_p, mat_patch_wool, rig)

    if args.eyes != "none":
        rng_eye = np.random.default_rng(args.seed + 11003)
        bleed = 0.0045 if args.eyes == "dot" else 0.009
        eye_pos_list, eye_rad_list = [], []
        for cx, cz in surface.eye_centers:
            pos_e, rad_e = build_feature_wool(
                surface,
                rng_eye,
                box_bounds=(cx - 0.14, cx + 0.14, cz - 0.28, cz + 0.28),
                grid_res=115,
                sdf_func=surface.eye_sdf,
                lift_func=surface.eye_lift,
                len_range=(0.010, 0.020),
                rad_range=(0.0008, 0.0012),
                loft_range=(0.0006, 0.0022),
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

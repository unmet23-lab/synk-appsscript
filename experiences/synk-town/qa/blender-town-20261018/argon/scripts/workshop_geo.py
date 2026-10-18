import bpy
import bmesh
import math
from mathutils import Vector, Euler

TAU = math.pi * 2.0
OX = 6.0
OZ = 0.0

# Exact linear RGB slab tints extracted from reference/v20_workshop.glb (paving_eef0ed_r100_m0)
WORKSHOP_MARU_SLAB_TINTS = [
    (0.8549926, 0.8307699, 0.7605245),
    (0.8468732, 0.8227857, 0.7529422),
    (0.8631572, 0.8387990, 0.7681512),
    (0.8468732, 0.8227857, 0.7529422),
    (0.8468732, 0.8307699, 0.7529422),
    (0.8549926, 0.8307699, 0.7605245),
    (0.8631572, 0.8387990, 0.7681512),
    (0.8468732, 0.8307699, 0.7529422),
    (0.8631572, 0.8387990, 0.7681512),
    (0.8549926, 0.8307699, 0.7605245),
    (0.8468732, 0.8307699, 0.7605245),
    (0.8549926, 0.8307699, 0.7605245),
    (0.8631572, 0.8387990, 0.7681512),
    (0.8387990, 0.8227857, 0.7454042),
    (0.8631572, 0.8387990, 0.7681512),
]


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


def scale_color(c, s):
    return (
        max(0.0, min(1.0, c[0] * s)),
        max(0.0, min(1.0, c[1] * s)),
        max(0.0, min(1.0, c[2] * s)),
    )


def L(lx, ly, lz):
    """Converts workshop-local Town coordinates (lx, ly, lz) to world Town coordinates (lx + 6, ly, lz)."""
    return (lx + OX, ly, lz + OZ)


def t2b(tx, ty, tz):
    """Town world (x, y, z) -> Blender world (x, -z, y)"""
    return Vector((tx, -tz, ty))


def workshop_roof_height(lx, lz, width=4.88):
    """Exact port of day-environment.mjs workshopRoofHeight(x, z, width=4.88)."""
    u = lx / (width * 0.5)
    front = (lz + 3.04) / 2.45
    return 3.48 - 0.48 * (u + 1.0) * 0.5 + 0.08 * math.sin(front * math.pi) + 0.085 * (abs(u) ** 6.0)


def rounded_rect_points(cx, cy, w, h, r, segs_per_corner=8):
    """Returns CCW list of (x, y) points for a rounded rectangle in local XY."""
    r = min(r, w * 0.49, h * 0.49)
    corners = [
        (cx + w * 0.5 - r, cy - h * 0.5 + r, -math.pi * 0.5, 0.0),
        (cx + w * 0.5 - r, cy + h * 0.5 - r, 0.0, math.pi * 0.5),
        (cx - w * 0.5 + r, cy + h * 0.5 - r, math.pi * 0.5, math.pi),
        (cx - w * 0.5 + r, cy - h * 0.5 + r, math.pi, math.pi * 1.5),
    ]
    pts = []
    for ox, oy, a0, a1 in corners:
        for i in range(segs_per_corner + 1):
            a = a0 + (a1 - a0) * (i / segs_per_corner)
            pts.append((ox + math.cos(a) * r, oy + math.sin(a) * r))
    clean = []
    for p in pts:
        if not clean or math.hypot(p[0] - clean[-1][0], p[1] - clean[-1][1]) > 1e-5:
            clean.append(p)
    if len(clean) > 1 and math.hypot(clean[0][0] - clean[-1][0], clean[0][1] - clean[-1][1]) <= 1e-5:
        clean.pop()
    return clean


class MeshCollector:
    """Collects geometry in Town world coordinates and builds a Blender Mesh Object in world space."""
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

    def add_local_mesh(self, local_verts, faces, mat, color=(1.0, 1.0, 1.0), vert_colors=None):
        town_verts = [L(lx, ly, lz) for (lx, ly, lz) in local_verts]
        self.add_town_mesh(town_verts, faces, mat, color=color, vert_colors=vert_colors)

    def add_beveled_box(self, local_center, size, mat, rot_euler=(0.0, 0.0, 0.0), bevel=0.008, segments=2, color=(1.0, 1.0, 1.0)):
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
            if actual_b > 0.0005:
                bmesh.ops.bevel(bm, geom=bm.edges[:], offset=actual_b, segments=segments, profile=0.5, affect='EDGES')
        eul = Euler(rot_euler, 'XYZ')
        rot_mat = eul.to_matrix().to_4x4()
        cx, cy, cz = L(*local_center)
        town_verts = []
        for v in bm.verts:
            p = rot_mat @ v.co
            town_verts.append((p.x + cx, p.y + cy, p.z + cz))
        bm.verts.ensure_lookup_table()
        faces = [[v.index for v in f.verts] for f in bm.faces]
        bm.free()
        self.add_town_mesh(town_verts, faces, mat, color=color)

    def add_cylinder_between(self, local_a, local_b, radius_a, radius_b, mat, sides=12, cap=True, color=(1.0, 1.0, 1.0)):
        va = Vector(L(*local_a))
        vb = Vector(L(*local_b))
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

    def add_beam(self, local_a, local_b, width, mat, profile='cyl', segs=10, color=(1.0, 1.0, 1.0)):
        va = Vector(local_a)
        vb = Vector(local_b)
        diff = vb - va
        length = diff.length
        if length < 1e-6:
            return
        if profile == 'box':
            up = Vector((0, 1, 0))
            quat = up.rotation_difference(diff.normalized())
            eul = quat.to_euler('XYZ')
            mid = (va + vb) * 0.5
            self.add_beveled_box((mid.x, mid.y, mid.z), (width, length, width), mat,
                                 rot_euler=(eul.x, eul.y, eul.z), bevel=min(0.005, width * 0.2), segments=2, color=color)
        else:
            self.add_cylinder_between(local_a, local_b, width * 0.5, width * 0.5, mat, sides=segs, cap=True, color=color)

    def add_curved_tube(self, local_points, radius, mat, tubular_segs=24, radial_segs=8, cap=True, color=(1.0, 1.0, 1.0)):
        pts = [Vector(L(*p)) for p in local_points]
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

        samples = [eval_catmull(i / tubular_segs) for i in range(tubular_segs + 1)]
        town_verts = []
        up = Vector((0, 1, 0))
        for i, center in enumerate(samples):
            if i == 0:
                tang = (samples[1] - samples[0]).normalized()
            elif i == tubular_segs:
                tang = (samples[tubular_segs] - samples[tubular_segs - 1]).normalized()
            else:
                tang = (samples[i + 1] - samples[i - 1]).normalized()
            ref = Vector((1, 0, 0)) if abs(tang.y) > 0.95 else up
            axis1 = tang.cross(ref).normalized()
            axis2 = axis1.cross(tang).normalized()
            for j in range(radial_segs):
                ang = j * TAU / radial_segs
                v = center + axis1 * (math.cos(ang) * radius) + axis2 * (math.sin(ang) * radius)
                town_verts.append((v.x, v.y, v.z))
        faces = []
        for i in range(tubular_segs):
            for j in range(radial_segs):
                nj = (j + 1) % radial_segs
                a = i * radial_segs + j
                b = i * radial_segs + nj
                c = (i + 1) * radial_segs + nj
                d = (i + 1) * radial_segs + j
                faces.append((a, d, c, b))
        if cap:
            faces.append(tuple(range(radial_segs)))
            faces.append(tuple(tubular_segs * radial_segs + j for j in reversed(range(radial_segs))))
        self.add_town_mesh(town_verts, faces, mat, color=color)

    def add_cylinder(self, local_center, r_top, r_bot, height, mat, segs=24, rot_euler=(0.0, 0.0, 0.0), bevel=0.003, color=(1.0, 1.0, 1.0)):
        cx, cy, cz = L(*local_center)
        eul = Euler(rot_euler, 'XYZ')
        rot_mat = eul.to_matrix().to_4x4()
        hh = height * 0.5
        b = min(bevel, hh * 0.35, min(r_top, r_bot) * 0.35)
        if b > 0.0005:
            rings = [
                (0.0, -hh),
                (max(0.0, r_bot - b), -hh),
                (r_bot, -hh + b),
                (r_top, hh - b),
                (max(0.0, r_top - b), hh),
                (0.0, hh),
            ]
        else:
            rings = [(0.0, -hh), (r_bot, -hh), (r_top, hh), (0.0, hh)]
        town_verts = []
        for r_val, yl in rings:
            for i in range(segs):
                ang = i * TAU / segs
                p = rot_mat @ Vector((math.sin(ang) * r_val, yl, math.cos(ang) * r_val))
                town_verts.append((cx + p.x, cy + p.y, cz + p.z))
        faces = []
        for row in range(len(rings) - 1):
            for i in range(segs):
                ni = (i + 1) % segs
                a = row * segs + i
                b_idx = row * segs + ni
                c = (row + 1) * segs + ni
                d = (row + 1) * segs + i
                faces.append((a, b_idx, c, d))
        self.add_town_mesh(town_verts, faces, mat, color=color)

    def add_torus(self, local_center, major_r, minor_r, mat, major_segs=28, minor_segs=10, rot_euler=(0.0, 0.0, 0.0), color=(1.0, 1.0, 1.0)):
        cx, cy, cz = L(*local_center)
        eul = Euler(rot_euler, 'XYZ')
        rot_mat = eul.to_matrix().to_4x4()
        town_verts = []
        for i in range(major_segs):
            u = i * TAU / major_segs
            cu, su = math.cos(u), math.sin(u)
            for j in range(minor_segs):
                v = j * TAU / minor_segs
                cv, sv = math.cos(v), math.sin(v)
                lx = (major_r + minor_r * cv) * cu
                ly = (major_r + minor_r * cv) * su
                lz = minor_r * sv
                p = rot_mat @ Vector((lx, ly, lz))
                town_verts.append((cx + p.x, cy + p.y, cz + p.z))
        faces = []
        for i in range(major_segs):
            ni = (i + 1) % major_segs
            for j in range(minor_segs):
                nj = (j + 1) % minor_segs
                a = i * minor_segs + j
                b = ni * minor_segs + j
                c = ni * minor_segs + nj
                d = i * minor_segs + nj
                faces.append((a, b, c, d))
        self.add_town_mesh(town_verts, faces, mat, color=color)

    def add_ellipsoid(self, local_center, scale, mat, subdivisions=2, color=(1.0, 1.0, 1.0)):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1.0)
        cx, cy, cz = L(*local_center)
        sx, sy, sz = scale
        town_verts = [(cx + v.co.x * sx, cy + v.co.y * sy, cz + v.co.z * sz) for v in bm.verts]
        bm.verts.ensure_lookup_table()
        faces = [[v.index for v in f.verts] for f in bm.faces]
        bm.free()
        self.add_town_mesh(town_verts, faces, mat, color=color)

    def add_rounded_frame(self, cx, cy, outer_w, outer_h, outer_r, inner_w, inner_h, inner_r, z0, z1, mat, bevel=0.012, segs_per_corner=8):
        """Builds a beveled extruded rounded-rectangle frame in local coordinates with flat-normal support rings."""
        outer_pts = rounded_rect_points(cx, cy, outer_w, outer_h, outer_r, segs_per_corner=segs_per_corner)
        inner_pts = rounded_rect_points(cx, cy, inner_w, inner_h, inner_r, segs_per_corner=segs_per_corner)
        n_f = len(outer_pts)
        fb = min(bevel, abs(z1 - z0) * 0.35)
        f_verts = []
        for i in range(n_f):
            ox, oy = outer_pts[i]
            ix, iy = inner_pts[i]
            dx, dy = ox - ix, oy - iy
            d_len = max(1e-6, math.hypot(dx, dy))
            ux, uy = dx / d_len, dy / d_len
            b_step = min(fb, d_len * 0.22)
            s_step = min(fb * 2.0, d_len * 0.42)
            ix_b, iy_b = ix + ux * b_step, iy + uy * b_step
            ix_s, iy_s = ix + ux * s_step, iy + uy * s_step
            ox_s, oy_s = ox - ux * s_step, oy - uy * s_step
            ox_b, oy_b = ox - ux * b_step, oy - uy * b_step
            f_verts.extend([
                (ix, iy, z1 - fb),
                (ix_b, iy_b, z1),
                (ix_s, iy_s, z1),
                (ox_s, oy_s, z1),
                (ox_b, oy_b, z1),
                (ox, oy, z1 - fb),
                (ox, oy, z0 + fb),
                (ox_b, oy_b, z0),
                (ox_s, oy_s, z0),
                (ix_s, iy_s, z0),
                (ix_b, iy_b, z0),
                (ix, iy, z0 + fb),
            ])
        f_faces = []
        for i in range(n_f):
            ni = (i + 1) % n_f
            b0, b1 = i * 12, ni * 12
            for r in range(12):
                nr = (r + 1) % 12
                f_faces.append((b0 + r, b0 + nr, b1 + nr, b1 + r))
        self.add_local_mesh(f_verts, f_faces, mat)

    def build_object(self, shade_smooth=True, recalc_normals=True):
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
        if recalc_normals:
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        return obj


def _add_wall_with_rounded_hole(mc, ox_min, ox_max, oy_min, top_y_fn, cx, cy, hw, hh, rr, z_back, z_front, bev, mat, segs_per_corner=8):
    """
    Builds a solid beveled wall in local [ox_min, ox_max] x [oy_min, top_y_fn(x)] x [z_back, z_front]
    with a rounded rectangular hole centered at (cx, cy) of half-size (hw, hh) and corner radius rr.
    """
    hole_pts = rounded_rect_points(cx, cy, hw * 2.0, hh * 2.0, rr, segs_per_corner=segs_per_corner)

    def ray_to_outer(dx, dy):
        t_candidates = []
        if dx > 1e-7:
            t_candidates.append((ox_max - cx) / dx)
        elif dx < -1e-7:
            t_candidates.append((ox_min - cx) / dx)
        if dy < -1e-7:
            t_candidates.append((oy_min - cy) / dy)
        elif dy > 1e-7:
            # Find intersection with top boundary y = top_y_fn(cx + dx * t)
            t_max = min(t_candidates) if t_candidates else 10.0
            # Check if at t_max, cy + dy * t_max >= top_y_fn(cx + dx * t_max)
            lo, hi = 0.0, t_max
            if cy + dy * hi >= top_y_fn(cx + dx * hi):
                for _ in range(22):
                    mid = 0.5 * (lo + hi)
                    if cy + dy * mid >= top_y_fn(cx + dx * mid):
                        hi = mid
                    else:
                        lo = mid
                t_candidates.append(0.5 * (lo + hi))
        t = min(t_candidates)
        return (cx + dx * t, cy + dy * t)

    def ray_to_rounded_rect(angle):
        dx, dy = math.cos(angle), math.sin(angle)
        t_box = []
        if abs(dx) > 1e-7:
            t_box.append((hw if dx > 0 else -hw) / dx)
        if abs(dy) > 1e-7:
            t_box.append((hh if dy > 0 else -hh) / dy)
        t = min(t_box)
        px, py = dx * t, dy * t
        ix, iy = hw - rr, hh - rr
        if abs(px) > ix and abs(py) > iy:
            sx = math.copysign(ix, px)
            sy = math.copysign(iy, py)
            b_val = dx * sx + dy * sy
            c_val = sx * sx + sy * sy - rr * rr
            disc = max(0.0, b_val * b_val - c_val)
            t = b_val + math.sqrt(disc)
            px, py = dx * t, dy * t
        return (cx + px, cy + py)

    angles = [math.atan2(hy - cy, hx - cx) for hx, hy in hole_pts]
    corners_outer = [
        (ox_max, oy_min),
        (ox_max, top_y_fn(ox_max)),
        (ox_min, top_y_fn(ox_min)),
        (ox_min, oy_min),
    ]
    for ox, oy in corners_outer:
        angles.append(math.atan2(oy - cy, ox - cx))
    # Also add samples along the top curve so curved/sloped tops are smoothly represented
    for i in range(1, 16):
        tx = ox_min + (ox_max - ox_min) * (i / 16.0)
        ty = top_y_fn(tx)
        angles.append(math.atan2(ty - cy, tx - cx))

    angles = sorted(angles)
    clean_angles = []
    for a in angles:
        if not clean_angles or abs(a - clean_angles[-1]) > 1e-4:
            clean_angles.append(a)
    if len(clean_angles) > 1 and abs((clean_angles[0] + TAU) - clean_angles[-1]) < 1e-4:
        clean_angles.pop()

    n_ring = len(clean_angles)
    w_verts = []
    for a in clean_angles:
        hx, hy = ray_to_rounded_rect(a)
        ox, oy = ray_to_outer(math.cos(a), math.sin(a))
        dx, dy = ox - hx, oy - hy
        d_len = max(1e-6, math.hypot(dx, dy))
        ux, uy = dx / d_len, dy / d_len
        b_step = min(bev, d_len * 0.22)
        s_step = min(bev * 2.2, d_len * 0.42)
        hx_b, hy_b = hx + ux * b_step, hy + uy * b_step
        hx_s, hy_s = hx + ux * s_step, hy + uy * s_step
        ox_s, oy_s = ox - ux * s_step, oy - uy * s_step
        ox_b, oy_b = ox - ux * b_step, oy - uy * b_step
        # 12 vertices per slice: extra coplanar support rings (hx_s, ox_s) lock face normals to pure +/-Z
        w_verts.extend([
            (hx, hy, z_front - bev),
            (hx_b, hy_b, z_front),
            (hx_s, hy_s, z_front),
            (ox_s, oy_s, z_front),
            (ox_b, oy_b, z_front),
            (ox, oy, z_front - bev),
            (ox, oy, z_back + bev),
            (ox_b, oy_b, z_back),
            (ox_s, oy_s, z_back),
            (hx_s, hy_s, z_back),
            (hx_b, hy_b, z_back),
            (hx, hy, z_back + bev),
        ])
    w_faces = []
    for i in range(n_ring):
        ni = (i + 1) % n_ring
        b0 = i * 12
        b1 = ni * 12
        for r in range(12):
            nr = (r + 1) % 12
            w_faces.append((b0 + r, b0 + nr, b1 + nr, b1 + r))
    mc.add_local_mesh(w_verts, w_faces, mat)


def build_workshop_maru(mats):
    """
    Builds workshop_maru:
    - Mortar deck foundation [0, -0.036, -0.85], [4.6, 0.20, 4.2]
    - Dark mortar joint bed underneath paving joints
    - 15 rows of dressed limestone paving slabs with staggered joints & bevels, top at exact y = 0.1295
    - Left & right darkWood edge timbers at sx = +-2.25
    - Front dressed stone curb at [0, 0.006, 1.20], [4.54, 0.24, 0.075]
    """
    mc = MeshCollector("workshop_maru")

    # 1. Foundation mortar deck (top at y = 0.064, right below the subfloor)
    mc.add_beveled_box((0.0, -0.036, -0.85), (4.60, 0.20, 4.20), mats['proc_mortar'], bevel=0.006, segments=2)

    # 2. Recessed mortar bed beneath paving joints (top at y = 0.074)
    mc.add_beveled_box((0.0, 0.069, -0.822), (4.48, 0.010, 4.08), mats['proc_mortar'],
                       bevel=0.002, segments=1, color=(0.55, 0.57, 0.54))

    # 3. 15 rows of limestone paving courses (each course divided into 3 staggered flagstones)
    # Exact envelope: x in [-2.275, 2.275], z in [-2.871, 1.227], top y = 0.102 + 0.0275 = 0.1295
    gap = 0.004
    for iz in range(15):
        z_c = -2.74 + iz * 0.274
        base_tint = WORKSHOP_MARU_SLAB_TINTS[iz]
        if iz % 2 == 0:
            splits = [-2.275, -0.74, 0.78, 2.275]
            scales = [0.992, 1.006, 0.996]
        else:
            splits = [-2.275, -0.36, 1.04, 2.275]
            scales = [1.005, 0.991, 1.003]
        for s_idx in range(3):
            x0 = splits[s_idx] + (0.0 if s_idx == 0 else gap * 0.5)
            x1 = splits[s_idx + 1] - (0.0 if s_idx == 2 else gap * 0.5)
            w_slab = x1 - x0
            cx_slab = 0.5 * (x0 + x1)
            slab_col = scale_color(base_tint, scales[s_idx])
            mc.add_beveled_box((cx_slab, 0.102, z_c), (w_slab, 0.055, 0.262),
                               mats['proc_paving'], bevel=0.0045, segments=2, color=slab_col)

    # 4. Side darkWood border timbers
    for sx in (-2.25, 2.25):
        mc.add_beveled_box((sx, 0.102, -0.82), (0.075, 0.055, 4.12),
                           mats['proc_dark_wood'], bevel=0.005, segments=2)

    # 5. Front dressed limestone curb (4 jointed blocks along [0, 0.006, 1.20], total [4.54, 0.24, 0.075])
    curb_splits = [-2.27, -1.13, 0.0, 1.13, 2.27]
    curb_tints = [(0.99, 0.99, 0.98), (1.01, 1.01, 1.00), (0.985, 0.99, 0.985), (1.005, 1.00, 0.995)]
    for i in range(4):
        x0 = curb_splits[i] + (0.0 if i == 0 else 0.002)
        x1 = curb_splits[i + 1] - (0.0 if i == 3 else 0.002)
        mc.add_beveled_box((0.5 * (x0 + x1), 0.006, 1.20), (x1 - x0, 0.24, 0.075),
                           mats['proc_stone'], bevel=0.007, segments=2, color=curb_tints[i])

    obj = mc.build_object(shade_smooth=True)
    # Remove unseen downward-facing underside polygons of slabs/foundation to maximize UV texel density on visible maru top
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    del_faces = [f for f in bm.faces if f.normal.z < -0.92]
    if del_faces:
        bmesh.ops.delete(bm, geom=del_faces, context='FACES')
        unused_v = [v for v in bm.verts if not v.link_faces]
        if unused_v:
            bmesh.ops.delete(bm, geom=unused_v, context='VERTS')
        bm.to_mesh(me)
        me.update()
    bm.free()
    return obj


def build_workshop_wall(mats):
    """
    Builds workshop_wall:
    - Rear plaster wall: local (0, 1.1, -2.0), width 3.85, thickness 0.25, height 2.20
      with window opening at (0.58, 1.28), size 2.08 x 1.58, r = 0.07
    - Front attic infill plaster panel at z = -1.98
    - Overhead roof lantern plaster walls (front with window hole + 2 side cheeks)
    - Window & roof-lantern interior backing (proc_glass_backing & proc_interior_plaster)
    - Front pier stone bases at (+-1.80, 0.23, -1.65), size (0.28, 0.38, 0.90)
    """
    mc = MeshCollector("workshop_wall")

    # 1. Rear plaster wall with rounded rectangular opening (0.58, 1.28, 2.08, 1.58, r=0.07)
    _add_wall_with_rounded_hole(
        mc,
        ox_min=-1.925, ox_max=1.925,
        oy_min=0.0, top_y_fn=lambda _x: 2.20,
        cx=0.58, cy=1.28,
        hw=1.04, hh=0.79, rr=0.07,
        z_back=-2.125, z_front=-1.875,
        bev=0.008,
        mat=mats['proc_workshop_plaster'],
        segs_per_corner=8
    )

    # 2. Attic infill panel at z in [-2.00, -1.96]
    n_attic = 32
    a_verts = []
    for z_a in (-1.96, -2.00):
        for i in range(n_attic + 1):
            xx = -1.925 + 3.85 * (i / n_attic)
            yy_top = workshop_roof_height(xx, -1.98) - 0.13
            a_verts.append((xx, 2.11, z_a))
            a_verts.append((xx, yy_top, z_a))
    a_faces = []
    stride_a = (n_attic + 1) * 2
    for i in range(n_attic):
        k = i * 2
        a_faces.append((k, k + 2, k + 3, k + 1))
        kb = stride_a + k
        a_faces.append((kb + 1, kb + 3, kb + 2, kb))
        a_faces.append((k + 1, k + 3, kb + 3, kb + 1))
        a_faces.append((k, kb, kb + 2, k + 2))
    a_faces.append((0, 1, stride_a + 1, stride_a))
    last_a = n_attic * 2
    a_faces.append((last_a, stride_a + last_a, stride_a + last_a + 1, last_a + 1))
    mc.add_local_mesh(a_verts, a_faces, mats['proc_workshop_plaster'])

    # 3. Roof lantern plaster box (workshopRoofLantern)
    # Front wall: left=-1.56, right=0.40, bottom=2.24, top=workshop_roof_height(x, -0.70)-0.13, z in [-0.755, -0.70]
    # Hole: (-0.58, 2.55), w=1.62, h=0.36, r=0.028
    _add_wall_with_rounded_hole(
        mc,
        ox_min=-1.56, ox_max=0.40,
        oy_min=2.24, top_y_fn=lambda x: workshop_roof_height(x, -0.70) - 0.13,
        cx=-0.58, cy=2.55,
        hw=0.81, hh=0.18, rr=0.028,
        z_back=-0.755, z_front=-0.70,
        bev=0.005,
        mat=mats['proc_workshop_plaster'],
        segs_per_corner=6
    )

    # Side walls of roof lantern: left x in [-1.56, -1.505], right x in [0.345, 0.40], z in [-1.98, -0.70]
    n_lz = 12
    for side in (-1, 1):
        x_out = -1.56 if side < 0 else 0.40
        x_in = x_out + (0.055 if side < 0 else -0.055)
        x0, x1 = min(x_out, x_in), max(x_out, x_in)
        s_verts = []
        for xv in (x1, x0):
            for i in range(n_lz + 1):
                zz = -1.98 + (-0.70 - (-1.98)) * (i / n_lz)
                yy_top = workshop_roof_height(x_out, zz) - 0.145
                s_verts.append((xv, 2.24, zz))
                s_verts.append((xv, yy_top, zz))
        s_faces = []
        stride_s = (n_lz + 1) * 2
        for i in range(n_lz):
            k = i * 2
            # +X face
            s_faces.append((k, k + 1, k + 3, k + 2))
            # -X face
            kb = stride_s + k
            s_faces.append((kb, kb + 2, kb + 3, kb + 1))
            # Bottom face
            s_faces.append((k, kb, kb + 2, k + 2))
            # Top face
            s_faces.append((k + 1, k + 3, kb + 3, kb + 1))
        # Front & back vertical caps
        s_faces.append((0, 1, stride_s + 1, stride_s))
        last = n_lz * 2
        s_faces.append((last, stride_s + last, stride_s + last + 1, last + 1))
        mc.add_local_mesh(s_verts, s_faces, mats['proc_workshop_plaster'])

    # 4. Main window interior warm plaster & dark glass backing
    mc.add_beveled_box((0.58, 1.28, -2.120), (2.055, 1.555, 0.005), mats['proc_glass_backing'], bevel=0.001, segments=1)
    mc.add_beveled_box((0.58, 1.315, -2.114), (2.08 * 0.82, 1.58 * 0.82, 0.006), mats['proc_interior_plaster'], bevel=0.001, segments=1)

    # Roof lantern dark glass backing at z = -0.875
    mc.add_beveled_box((-0.58, 2.55, -0.875), (1.61, 0.35, 0.006), mats['proc_glass_backing'], bevel=0.001, segments=1)

    # 5. Front pier dressed stone bases at (+-1.80, 0.23, -1.65), size (0.28, 0.38, 0.90)
    for side in (-1, 1):
        mc.add_beveled_box((side * 1.80, 0.23, -1.65), (0.28, 0.38, 0.90), mats['proc_stone'], bevel=0.014, segments=2)

    return mc.build_object(shade_smooth=True)


def build_workshop_timber(mats):
    """
    Builds workshop_timber:
    - Side darkWood piers, pier shoes, and front wood posts
    - Rear wall baseboard, front lower wainscoting (13 boards), reverse-side cladding (16 boards + rail)
    - Main window wood frame, interior sill, 2 interior shelves, darkWood mullions & transom, exterior sill
    - Roof lantern bottom trim, rounded window frame, and 2 darkWood mullions
    - Sliding door frame, sage-grey shutter door panel with vertical tongue-and-groove slats, 5 vertical & 3 horizontal rails
    - Roof curved fascia beams, attic tie beam, and 13 curved rafters
    - Wall tool rack bar & wooden tool handles
    - Shop identity wooden plaque & hammer emblem
    - History hanger support bar & cords
    """
    mc = MeshCollector("workshop_timber")

    # 1. Side piers, darkWood shoes, and front posts
    for side in (-1, 1):
        sx = side * 1.80
        pier_top = workshop_roof_height(sx, -1.65) - 0.145
        # Stone base top is y = 0.420; darkWood shoe sits on [0.4205, 0.4595]; pier sits on [0.460, pier_top]
        mc.add_beveled_box((sx, 0.440, -1.65), (0.285, 0.039, 0.90),
                           mats['proc_dark_wood'], bevel=0.004, segments=2)
        mc.add_beveled_box((sx, (pier_top + 0.460) * 0.5, -1.65), (0.25, pier_top - 0.460, 0.87),
                           mats['proc_dark_wood'], bevel=0.008, segments=2)
        front_top = workshop_roof_height(sx, -1.198) - 0.145
        mc.add_beveled_box((sx, (front_top + 0.325) * 0.5, -1.198), (0.145, front_top - 0.325, 0.085),
                           mats['proc_wood'], bevel=0.006, segments=2)

    # 2. Rear wall darkWood baseboard & front lower cladding (13 vertical boards)
    mc.add_beveled_box((0.0, 0.255, -1.822), (3.85, 0.25, 0.100),
                       mats['proc_dark_wood'], bevel=0.006, segments=2)
    for i in range(13):
        mat_b = mats['proc_wood'] if (i % 4 != 0) else mats['proc_dark_wood']
        mc.add_beveled_box((-1.56 + i * 0.27, 0.28, -1.750), (0.251, 0.30, 0.042),
                           mat_b, bevel=0.004, segments=2)

    # Reverse-side rear wall cladding (16 boards + horizontal darkWood rail)
    for i in range(16):
        mc.add_beveled_box((-1.65 + i * 0.22, 0.47, -2.151), (0.204, 0.52, 0.047),
                           mats['proc_wood'], bevel=0.004, segments=1)
    mc.add_beveled_box((0.0, 0.76, -2.17), (3.78, 0.084, 0.084),
                       mats['proc_dark_wood'], bevel=0.005, segments=2)

    # 3. Main window frame & trim (o.x=0.58, o.y=1.28, w=2.08, h=1.58, r=0.07)
    mc.add_rounded_frame(
        cx=0.58, cy=1.28,
        outer_w=2.08 + 0.19, outer_h=1.58 + 0.19, outer_r=0.07 + 0.08,
        inner_w=2.08 - 0.035, inner_h=1.58 - 0.035, inner_r=0.035,
        z0=-1.874, z1=-1.724,
        mat=mats['proc_wood'], bevel=0.012, segs_per_corner=8
    )
    # Window interior sill
    mc.add_beveled_box((0.58, 1.28 - 1.58 * 0.37, -2.076), (2.08 * 0.82, 0.053, 0.071),
                       mats['proc_dark_wood'], bevel=0.004, segments=2)
    # Window interior shelves
    for u in (-0.25, 0.18):
        mc.add_beveled_box((0.58 + u * 2.08, 1.28 - 1.58 * 0.20, -2.058), (2.08 * 0.20, 0.038, 0.052),
                           mats['proc_wood'], bevel=0.004, segments=2)
    # Window darkWood mullions & transom
    for u in (-0.34, 0.0, 0.34):
        mc.add_beveled_box((0.58 + u * 2.08, 1.28, -1.789), (0.039, 1.51, 0.082),
                           mats['proc_dark_wood'], bevel=0.004, segments=2)
    mc.add_beveled_box((0.58, 1.23, -1.778), (1.99, 0.042, 0.088),
                       mats['proc_dark_wood'], bevel=0.004, segments=2)
    # Window exterior sill
    mc.add_beveled_box((0.58, 1.28 - 0.79 - 0.092, -1.731), (2.08 + 0.30, 0.12, 0.28),
                       mats['proc_wood'], bevel=0.007, segments=2)

    # 4. Roof lantern wood trim & frame
    mc.add_beveled_box((-0.58, 2.224, (-0.70 + -1.98) * 0.5), (1.96, 0.030, 1.28),
                       mats['proc_wood'], bevel=0.004, segments=2)
    mc.add_rounded_frame(
        cx=-0.58, cy=2.55,
        outer_w=1.76, outer_h=0.50, outer_r=0.052,
        inner_w=1.62, inner_h=0.36, inner_r=0.028,
        z0=-0.699, z1=-0.625,
        mat=mats['proc_wood'], bevel=0.008, segs_per_corner=6
    )
    for lx in (-0.98, -0.18):
        mc.add_beveled_box((lx, 2.55, -0.660), (0.039, 0.35, 0.056),
                           mats['proc_dark_wood'], bevel=0.004, segments=2)

    # 5. Sliding door at doorX = -1.18, doorW = 0.64 (sits cleanly above maru y = 0.130)
    door_x, door_w = -1.18, 0.64
    # Door frame around the panel (left/right stiles + top header, non-overlapping with shutter panel)
    frame_w = door_w + 0.17  # 0.81
    stile_w = 0.085
    for side in (-1, 1):
        mc.add_beveled_box((door_x + side * (frame_w * 0.5 - stile_w * 0.5), 1.005, -1.822),
                           (stile_w, 1.75, 0.100), mats['proc_dark_wood'], bevel=0.005, segments=2)
    mc.add_beveled_box((door_x, 1.835, -1.822), (frame_w, 0.090, 0.100),
                       mats['proc_dark_wood'], bevel=0.005, segments=2)

    # Door panel (6 vertical tongue-and-groove shutter planks from z = -1.780 to -1.720)
    n_slats = 6
    slat_step = door_w / n_slats
    for i in range(n_slats):
        sx = door_x - door_w * 0.5 + (i + 0.5) * slat_step
        tint = (0.985, 0.99, 0.985) if (i % 2 == 0) else (1.01, 1.01, 1.01)
        mc.add_beveled_box((sx, 0.962, -1.750), (slat_step - 0.002, 1.664, 0.058),
                           mats['proc_shutters'], bevel=0.003, segments=2, color=tint)

    # Door darkWood stiles & rails mounted cleanly on the front face of the shutter planks (z in [-1.720, -1.688])
    for i in range(5):
        mc.add_beveled_box((door_x - door_w * 0.38 + i * door_w * 0.19, 1.19, -1.704), (0.024, 0.86, 0.030),
                           mats['proc_dark_wood'], bevel=0.003, segments=2)
    for dy in (0.47, 0.77, 1.61):
        mc.add_beveled_box((door_x, dy, -1.702), (door_w - 0.04, 0.043, 0.032),
                           mats['proc_dark_wood'], bevel=0.003, segments=2)

    # 6. Roof fascia, sub-fascia, attic tie beam, and 13 curved rafters
    width_r = 4.88
    near_r, far_r = -0.59, -3.04
    for z_f in (near_r + 0.025, far_r - 0.025):
        pts_dark = [(-width_r * 0.5 + i * width_r / 24.0, workshop_roof_height(-width_r * 0.5 + i * width_r / 24.0, z_f) - 0.06, z_f) for i in range(25)]
        pts_wood = [(x, y - 0.076, z) for (x, y, z) in pts_dark]
        mc.add_curved_tube(pts_dark, 0.075, mats['proc_dark_wood'], tubular_segs=28, radial_segs=10)
        mc.add_curved_tube(pts_wood, 0.023, mats['proc_wood'], tubular_segs=28, radial_segs=8)

    pts_tie = [(-1.92 + i * 3.84 / 20.0, workshop_roof_height(-1.92 + i * 3.84 / 20.0, -1.92) - 0.13, -1.81) for i in range(21)]
    mc.add_curved_tube(pts_tie, 0.042, mats['proc_wood'], tubular_segs=24, radial_segs=8)

    for i in range(13):
        rx = -1.85 + i * 3.70 / 12.0
        pts_rafter = [(rx, workshop_roof_height(rx, far_r + (near_r - far_r) * j / 7.0) - 0.145, far_r + (near_r - far_r) * j / 7.0) for j in range(8)]
        mc.add_curved_tube(pts_rafter, 0.017, mats['proc_wood'], tubular_segs=16, radial_segs=8)

    # 7. Wall tool rack bar & wooden tool handles (facadeCraft)
    mc.add_beveled_box((-1.26, 1.97, -1.70), (0.77, 0.068, 0.13),
                       mats['proc_dark_wood'], bevel=0.005, segments=2)
    for i in (0, 2):
        tx = -1.52 + i * 0.18
        mc.add_beveled_box((tx, 1.76, -1.659), (0.053, 0.32, 0.046),
                           mats['proc_wood'], bevel=0.004, segments=2)

    # 8. Shop identity wooden plaque & paper hammer icon (1.38, 1.92, -1.633)
    mc.add_cylinder((1.38, 1.92, -1.633), 0.165, 0.165, 0.043, mats['proc_wood'],
                    segs=32, rot_euler=(math.pi * 0.5, 0.0, 0.0), bevel=0.004)
    mc.add_beveled_box((1.38, 1.907, -1.59), (0.014, 0.126, 0.018),
                       mats['proc_paper'], rot_euler=(0.0, 0.0, -0.35), bevel=0.002, segments=1)
    mc.add_beveled_box((1.36, 1.956, -1.59), (0.091, 0.035, 0.023),
                       mats['proc_paper'], rot_euler=(0.0, 0.0, -0.35), bevel=0.002, segments=1)

    # 9. History hanger at (1.62, 1.04, -0.48)
    hx, hy, hz = 1.62, 1.04, -0.48
    top_h = hy + 0.225
    mount_y = top_h + 0.16
    mc.add_beam((hx, mount_y, -1.26), (hx, mount_y, hz), 0.013, mats['proc_dark_wood'], profile='cyl', segs=8)
    mc.add_beveled_box((hx, mount_y, hz), (0.38, 0.027, 0.032), mats['proc_wood'], bevel=0.003, segments=1)
    for side in (-1, 1):
        mc.add_beam((hx + side * 0.13, mount_y, hz), (hx + side * 0.13, top_h + 0.012, hz),
                    0.005, mats['proc_cotton_white'], profile='cyl', segs=6)

    return mc.build_object(shade_smooth=True)


def build_workshop_workbench(mats):
    """
    Builds workshop_workbench:
    - Workbench frame, 5 heavy top planks, 4 legs, lower shelf planks & crossbars
    - Stacked timber boards on top & lower shelf, wooden tool handle
    - Rolled white cotton fabric cylinder, wooden thread spool, vice wooden workpiece
    - Window flower box with rim molding & garden soil bed
    """
    mc = MeshCollector("workshop_workbench")

    # 1. Workbench frame & legs (non-intersecting contact boundaries)
    # Top planks: y in [0.644, 0.726] (center 0.685, height 0.082)
    # Under-frame: y in [0.5785, 0.6435] (center 0.611, height 0.065)
    mc.add_beveled_box((0.20, 0.611, -0.65), (2.04, 0.065, 0.76),
                       mats['proc_dark_wood'], bevel=0.005, segments=2)
    plank_tints = [
        (0.98, 0.97, 0.96),
        (1.02, 1.01, 1.00),
        (0.99, 0.99, 0.98),
        (1.03, 1.02, 1.00),
        (0.97, 0.97, 0.96),
    ]
    for i in range(5):
        mc.add_beveled_box((0.20, 0.685, -0.972 + i * 0.16), (2.08, 0.082, 0.149),
                           mats['proc_wood'], bevel=0.0055, segments=2, color=plank_tints[i])

    # Legs from maru top y = 0.130 to under-frame bottom y = 0.578
    for lx in (-0.64, 1.04):
        for lz in (-0.94, -0.37):
            mc.add_beveled_box((lx, 0.354, lz), (0.095, 0.448, 0.095),
                               mats['proc_wood'], bevel=0.006, segments=2)

    # Lower shelf planks: y in [0.210, 0.270] (center 0.240, height 0.060), spanning cleanly between legs
    for i in range(3):
        sz = -0.65 + (i - 1) * 0.178
        mc.add_beveled_box((0.20, 0.240, sz), (1.58, 0.060, 0.171),
                           mats['proc_wood'], bevel=0.0045, segments=2, color=plank_tints[i])

    # Side stretchers between front and back legs
    for lx in (-0.64, 1.04):
        mc.add_beveled_box((lx, 0.290, -0.655), (0.070, 0.080, 0.474),
                           mats['proc_dark_wood'], bevel=0.005, segments=2)

    # 2. Stacked boards & wooden tool handle on workbench (sitting cleanly above y = 0.726)
    for i in range(3):
        mc.add_beveled_box((0.52, 0.742 + i * 0.032, -0.88), (0.87, 0.031, 0.14),
                           mats['proc_wood'], rot_euler=(0.0, i * 0.055, 0.0), bevel=0.0035, segments=2,
                           color=plank_tints[(i + 1) % 5])

    mc.add_beveled_box((-0.48, 0.745, -0.50), (0.047, 0.037, 0.26),
                       mats['proc_wood'], rot_euler=(0.0, -0.45, 0.0), bevel=0.004, segments=2)

    for i in range(3):
        mc.add_beveled_box((-0.60 + i * 0.37, 0.2905, -0.63), (0.27, 0.04, 0.34),
                           mats['proc_wood'], rot_euler=(0.0, 0.05, 0.0), bevel=0.004, segments=2,
                           color=plank_tints[(i + 2) % 5])

    # 3. Workshop materials on workbench (fabric roll, wooden spool, vice wood block)
    mc.add_cylinder((-0.15, 0.7895, -0.60), 0.063, 0.063, 0.64, mats['proc_cotton_white'],
                    segs=24, rot_euler=(0.0, 0.0, math.pi * 0.5), bevel=0.004)
    mc.add_cylinder((-0.55, 0.805, -0.77), 0.070, 0.070, 0.128, mats['proc_wood'],
                    segs=24, bevel=0.002)
    for sy in (0.738, 0.880):
        mc.add_cylinder((-0.55, sy, -0.77), 0.085, 0.085, 0.022, mats['proc_wood'],
                        segs=24, bevel=0.003)
    mc.add_beveled_box((0.99, 0.8275, -0.42), (0.14, 0.065, 0.25),
                       mats['proc_wood'], bevel=0.004, segments=2)

    # 4. Window flower box at (0.58, 0.39, -1.65), size (1.80, 0.19, 0.26)
    mc.add_beveled_box((0.58, 0.39, -1.65), (1.80, 0.19, 0.24),
                       mats['proc_wood'], bevel=0.006, segments=2)
    # Soil bed on top of window box (y in [0.486, 0.500])
    mc.add_beveled_box((0.58, 0.493, -1.65), (1.68, 0.014, 0.19),
                       mats['proc_soil'], bevel=0.002, segments=1)

    return mc.build_object(shade_smooth=True)


def build_workshop_roof(mats):
    """
    Builds workshop_roof:
    - Asymmetric curved slate roof shell (width 4.88, z in [-3.04, -0.59], thickness 0.10)
    - 19 longitudinal standing-seam tile ribs (radius 0.012)
    - 7 overlapping horizontal ceramic tile courses
    """
    mc = MeshCollector("workshop_roof")
    width = 4.88
    far, near = -3.04, -0.59
    nx, nz = 40, 16
    thickness = 0.10

    # 1. Main curved roof shell
    r_verts = []
    for layer in range(2):
        for ix in range(nx + 1):
            for iz in range(nz + 1):
                x = -width * 0.5 + ix * width / nx
                z = far + iz * (near - far) / nz
                y = workshop_roof_height(x, z) - layer * thickness
                r_verts.append((x, y, z))
    stride = nz + 1
    offset = (nx + 1) * stride
    r_faces = []
    for ix in range(nx):
        for iz in range(nz):
            k = ix * stride + iz
            r_faces.append((k, k + 1, k + stride + 1, k + stride))
            r_faces.append((k + offset, k + stride + offset, k + stride + 1 + offset, k + 1 + offset))
    for i in range(nx):
        a, b = i * stride, (i + 1) * stride
        r_faces.append((a, b, b + offset, a + offset))
        a2, b2 = (i + 1) * stride + nz, i * stride + nz
        r_faces.append((a2, b2, b2 + offset, a2 + offset))
    for i in range(nz):
        a, b = i + 1, i
        r_faces.append((a, b, b + offset, a + offset))
        a2, b2 = nx * stride + i, nx * stride + i + 1
        r_faces.append((a2, b2, b2 + offset, a2 + offset))
    mc.add_local_mesh(r_verts, r_faces, mats['proc_roof_slate'])

    # 2. 19 longitudinal tile ribs
    for i in range(19):
        rx = -width * 0.5 + i * width / 18.0
        pts = [(rx, workshop_roof_height(rx, far + (near - far) * j / 7.0) + 0.018, far + (near - far) * j / 7.0) for j in range(8)]
        mc.add_curved_tube(pts, 0.012, mats['proc_roof_slate'], tubular_segs=20, radial_segs=8)

    # 3. 7 overlapping horizontal ceramic tile courses
    cols = 40
    courses = 7
    for row in range(courses):
        front_z = far + (row + 1) * (near - far) / courses
        back_z = front_z - 0.14
        c_verts = []
        for i in range(cols + 1):
            x = -width * 0.5 + i * width / cols
            rib_phase = abs(math.sin((i / cols) * 18.0 * math.pi)) * 0.0035
            for z_c, lift in ((back_z, 0.006), (front_z, 0.026 + rib_phase), (front_z + 0.013, 0.007)):
                c_verts.append((x, workshop_roof_height(x, z_c) + lift, z_c))
        c_faces = []
        for i in range(cols):
            for strip in range(2):
                k = i * 3 + strip
                c_faces.append((k, k + 1, k + 4, k + 3))
        mc.add_local_mesh(c_verts, c_faces, mats['proc_roof_slate'])

    return mc.build_object(shade_smooth=True, recalc_normals=False)


def build_workshop_metal(mats):
    """
    Builds workshop_metal:
    - Wall lantern bracket, caps (proc_metal), and warm butter globe (proc_butter) at x = -0.23
    - Front pier brass collars, sliding door brass knob, shop plaque brass ring (proc_brass)
    - Wall tool rack metal heads & metal shafts (proc_metal)
    - Workbench metal tool blade & bench vice assembly (proc_metal)
    """
    mc = MeshCollector("workshop_metal")

    # 1. Wall lantern at lx = -0.23
    lx = -0.23
    mc.add_beveled_box((lx, 1.74, -1.71), (0.11, 0.08, 0.25), mats['proc_metal'], bevel=0.004, segments=2)
    for ly in (1.46, 1.72):
        mc.add_beveled_box((lx, ly, -1.56), (0.17, 0.039, 0.17), mats['proc_metal'], bevel=0.004, segments=2)
    mc.add_ellipsoid((lx, 1.59, -1.56), (0.078, 0.136, 0.078), mats['proc_butter'], subdivisions=3)

    # 2. Front pier brass collars
    for side in (-1, 1):
        sx = side * 1.80
        front_top = workshop_roof_height(sx, -1.198) - 0.145
        for by in (0.50, front_top - 0.12):
            mc.add_beveled_box((sx, by, -1.20), (0.277, 0.058, 0.094), mats['proc_brass'], bevel=0.004, segments=2)

    # 3. Sliding door brass handle & shop plaque brass ring
    mc.add_ellipsoid((-1.18 + 0.64 * 0.30, 0.88, -1.674), (0.036, 0.036, 0.030), mats['proc_brass'], subdivisions=2)
    mc.add_torus((1.38, 1.92, -1.603), 0.145, 0.008, mats['proc_brass'], major_segs=32, minor_segs=8)

    # 4. Wall tool rack metal heads & odd-indexed shafts
    for i in range(4):
        tx = -1.52 + i * 0.18
        mc.add_beveled_box((tx, 1.84, -1.659), (0.135, 0.067, 0.051), mats['proc_metal'], bevel=0.004, segments=2)
        if i % 2 == 1:
            mc.add_beveled_box((tx, 1.76, -1.659), (0.053, 0.32, 0.046), mats['proc_metal'], bevel=0.004, segments=2)

    # 5. Workbench metal tool blade & vice
    mc.add_beveled_box((-0.51, 0.763, -0.60), (0.25, 0.032, 0.065),
                       mats['proc_metal'], rot_euler=(0.0, -0.45, 0.0), bevel=0.003, segments=2)

    mc.add_beveled_box((1.00, 0.76, -0.42), (0.36, 0.065, 0.22), mats['proc_metal'], bevel=0.005, segments=2)
    for vx in (0.88, 1.10):
        mc.add_beveled_box((vx, 0.846, -0.42), (0.08, 0.115, 0.20), mats['proc_metal'], bevel=0.004, segments=2)
    mc.add_beveled_box((1.18, 0.80, -0.42), (0.12, 0.025, 0.025), mats['proc_metal'], bevel=0.003, segments=2)
    mc.add_beveled_box((1.23, 0.80, -0.42), (0.018, 0.10, 0.018), mats['proc_metal'], bevel=0.002, segments=2)

    return mc.build_object(shade_smooth=True)


def build_workshop_foliage(mats):
    """
    Builds workshop_foliage:
    - 5 herb clusters in the window box at x = 0.58, y = 0.50, z = -1.64, width = 1.80
    - Includes stems, leaves (#496345 .. #a3ae69), yellow flower buds (#d9b771), and lavender petals (#b8a8c9)
    """
    mc = MeshCollector("workshop_foliage")
    rng = make_rng(81026 + 600)
    c_dark = hex_to_linear('#496345')
    c_light = hex_to_linear('#a3ae69')
    c_bud = hex_to_linear('#d9b771')
    c_bloom = hex_to_linear('#b8a8c9')

    def build_thick_leaf_template(rows, cols, width_scale=0.22, arch_z=0.10):
        verts = []
        for layer in range(2):
            dz_l = (0.5 - layer) * 0.004
            for j in range(rows + 1):
                v = j / rows
                for i in range(cols + 1):
                    u = (i / cols) * 2.0 - 1.0
                    w = (math.sin(v * math.pi) ** 0.74) * (1.15 - 0.31 * v)
                    lx = u * width_scale * w * (1.0 + u * 0.075) + math.sin(v * math.pi) * 0.018
                    ly = v + abs(u) * math.sin(v * math.pi) * 0.025
                    lz = math.sin(v * math.pi) * (arch_z - 0.075 * u * u) + v * v * 0.065 + dz_l
                    verts.append((lx, ly, lz))
        stride = cols + 1
        off = (rows + 1) * stride
        faces = []
        for j in range(rows):
            for i in range(cols):
                k = j * stride + i
                faces.append((k, k + 1, k + stride + 1, k + stride))
                faces.append((k + off, k + stride + off, k + stride + 1 + off, k + 1 + off))
        return verts, faces

    leaf_v, leaf_f = build_thick_leaf_template(4, 3, width_scale=0.22, arch_z=0.10)
    petal_v, petal_f = build_thick_leaf_template(3, 2, width_scale=0.26, arch_z=0.08)

    box_x, box_y, box_z, box_w = 0.58, 0.39, -1.64, 1.80
    scale = 0.50
    count = 7
    for b_idx in range(5):
        px = box_x - box_w * 0.37 + b_idx * box_w * 0.185
        py = box_y + 0.11
        pz = box_z
        for i in range(count):
            angle = i * 2.399 + rng()
            radius = math.sqrt(rng()) * 0.19 * scale
            h = (0.12 + rng() * 0.20) * scale
            sx = px + math.sin(angle) * radius
            sz = pz + math.cos(angle) * radius
            mc.add_beam((sx, py, sz), (sx, py + h, sz), 0.006 * scale, mats['proc_stem'], profile='cyl', segs=6)

            for j in range(3):
                rx = 0.88 + rng() * 0.52
                ry = angle + j * 2.2
                rot = Euler((rx, ry, 0.0), 'XYZ').to_matrix().to_4x4()
                sc = Vector((0.43 * scale, 0.20 * scale, 0.43 * scale))
                origin = Vector((sx, py + h * (0.25 + j * 0.25), sz))
                l_col = lerp_color(c_dark, c_light, rng())
                lv_list = []
                for lv in leaf_v:
                    p = rot @ Vector((lv[0] * sc.x, lv[1] * sc.y, lv[2] * sc.z))
                    lv_list.append((origin.x + p.x, origin.y + p.y, origin.z + p.z))
                mc.add_local_mesh(lv_list, leaf_f, mats['proc_foliage'], color=l_col)

            if i % 2 == 0:
                mc.add_ellipsoid((sx, py + h + 0.007, sz), (0.019 * scale, 0.020 * scale, 0.019 * scale),
                                 mats['proc_foliage'], subdivisions=1, color=c_bud)
                for j in range(5):
                    a = j / 5.0 * TAU
                    rot_p = Euler((1.23, a, 0.0), 'XYZ').to_matrix().to_4x4()
                    sc_p = Vector((0.12 * scale, 0.058 * scale, 0.12 * scale))
                    orig_p = Vector((sx + math.sin(a) * 0.005, py + h, sz + math.cos(a) * 0.005))
                    pv_list = []
                    for pv in petal_v:
                        p = rot_p @ Vector((pv[0] * sc_p.x, pv[1] * sc_p.y, pv[2] * sc_p.z))
                        pv_list.append((orig_p.x + p.x, orig_p.y + p.y, orig_p.z + p.z))
                    mc.add_local_mesh(pv_list, petal_f, mats['proc_foliage'], color=c_bloom)

    return mc.build_object(shade_smooth=True, recalc_normals=False)


def build_workshop_glass(mats):
    """
    Builds workshop_glass (live_glass, not baked):
    - Main window glass pane at local (0.58, 1.28, -1.976), size 2.055 x 1.555, r = 0.07
    - Roof lantern glass pane at local (-0.58, 2.55, -0.765), size 1.61 x 0.35, r = 0.027
    """
    mc = MeshCollector("workshop_glass")

    pts_main = rounded_rect_points(0.58, 1.28, 2.055, 1.555, 0.07, segs_per_corner=8)
    v_main = [(0.58, 1.28, -1.976)] + [(px, py, -1.976) for px, py in pts_main]
    f_main = [(0, 1 + i, 1 + (i + 1) % len(pts_main)) for i in range(len(pts_main))]
    mc.add_local_mesh(v_main, f_main, mats['live_glass'])

    pts_lan = rounded_rect_points(-0.58, 2.55, 1.61, 0.35, 0.027, segs_per_corner=6)
    v_lan = [(-0.58, 2.55, -0.765)] + [(px, py, -0.765) for px, py in pts_lan]
    f_lan = [(0, 1 + i, 1 + (i + 1) % len(pts_lan)) for i in range(len(pts_lan))]
    mc.add_local_mesh(v_lan, f_lan, mats['live_glass'])

    return mc.build_object(shade_smooth=True, recalc_normals=False)


def build_all_workshop_meshes(mats):
    return {
        'workshop_maru': build_workshop_maru(mats),
        'workshop_wall': build_workshop_wall(mats),
        'workshop_timber': build_workshop_timber(mats),
        'workshop_workbench': build_workshop_workbench(mats),
        'workshop_roof': build_workshop_roof(mats),
        'workshop_metal': build_workshop_metal(mats),
        'workshop_foliage': build_workshop_foliage(mats),
        'workshop_glass': build_workshop_glass(mats),
    }

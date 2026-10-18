import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix, Quaternion, Euler

TAU = math.pi * 2.0

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

def smoothstep(x, edge0, edge1):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)

def t2b(tx, ty, tz):
    """Town (x, y, z) -> Blender (x, -z, y)"""
    return Vector((tx, -tz, ty))

def t2b_tuple(tx, ty, tz):
    return (tx, -tz, ty)

def cafe_roof_height(x, z, width=5.26):
    u = x / (width * 0.5)
    front = (z + 3.04) / 2.39
    return 3.22 - 0.72 * (abs(u) ** 1.46) + 0.22 * (abs(u) ** 7.0) + 0.13 * (front ** 5.0)

def terrain_color_linear(x, z):
    """Exact port of day-environment.mjs terrainColor(x, z) in linear RGB"""
    outside = 0.0 # Inside district bounds [-3, 3] x [-3.4, 5.35], outside is 0
    patch = (0.50
             + 0.18 * math.sin(x * 0.33 + math.sin(z * 0.31) * 1.8)
             + 0.15 * math.cos(z * 0.54 - math.sin(x * 0.22))
             + 0.11 * math.sin(x * 1.12 + z * 0.57))
    def field(cx, cz, rx, rz):
        return math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2))
    meadow = max(field(-17, 1, 9.3, 8.5), field(17, -4, 8.5, 7), field(-5, 10, 10, 4), field(7, -18, 10, 5))
    grove = max(field(-10.5, -6.5, 3.8, 6), field(10.6, -8, 4.5, 5), field(-3, -13, 5.5, 3))
    c = hex_to_linear('#72956e')
    c = lerp_color(c, hex_to_linear('#a4b981'), patch * 0.62)
    c = lerp_color(c, hex_to_linear('#bdc38c'), meadow * 0.62)
    c = lerp_color(c, hex_to_linear('#5f887c'), grove * 0.41)
    c = lerp_color(c, hex_to_linear('#779a8b'), min(0.24, outside / 110.0))
    return c

class MeshCollector:
    """Collects geometry in Town coordinates and builds a Blender Mesh Object in world space."""
    def __init__(self, name):
        self.name = name
        self.verts = []   # list of Blender Vector (bx, by, bz)
        self.faces = []   # list of vertex index tuples
        self.mat_ids = [] # material slot index per face
        self.face_colors = [] # (r, g, b, a) linear color per face
        self.materials = []
        self.mat_map = {}

    def get_mat_index(self, mat):
        if mat.name not in self.mat_map:
            self.mat_map[mat.name] = len(self.materials)
            self.materials.append(mat)
        return self.mat_map[mat.name]

    def add_town_mesh(self, town_verts, faces, mat, color=(1.0, 1.0, 1.0), vert_colors=None):
        """
        town_verts: list of (tx, ty, tz)
        faces: list of index tuples
        color: uniform (r, g, b) linear color if vert_colors is None
        vert_colors: optional list of (r, g, b) per vertex in town_verts
        """
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
                # store per-corner colors
                self.face_colors.append([vert_colors[i] for i in f])
            else:
                self.face_colors.append([color for _ in f])

    def add_beveled_box(self, center, size, mat, rot_euler=(0.0, 0.0, 0.0), bevel=0.008, segments=2, color=(1.0, 1.0, 1.0)):
        """Adds a beveled box in Town coordinates: center=(tx,ty,tz), size=(sx,sy,sz), rot_euler=(rx,ry,rz) XYZ in Three.js."""
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
        # Three.js Euler XYZ rotation
        eul = Euler(rot_euler, 'XYZ')
        rot_mat = eul.to_matrix().to_4x4()
        cx, cy, cz = center
        town_verts = []
        for v in bm.verts:
            p = rot_mat @ v.co
            town_verts.append((p.x + cx, p.y + cy, p.z + cz))
        bm.verts.ensure_lookup_table()
        faces = [[v.index for v in f.verts] for f in bm.faces]
        bm.free()
        self.add_town_mesh(town_verts, faces, mat, color=color)

    def add_cylinder_between(self, a, b, radius_a, radius_b, mat, sides=12, cap=True, color=(1.0, 1.0, 1.0)):
        """Adds a cylinder/cone from Town point a to b."""
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
        for row, (y_local, r) in enumerate([(-length * 0.5, radius_a), (length * 0.5, radius_b)]):
            for i in range(sides):
                ang = i * TAU / sides
                local_p = Vector((math.cos(ang) * r, y_local, math.sin(ang) * r))
                wp = mid + (rot_mat @ local_p)
                town_verts.append((wp.x, wp.y, wp.z))
        faces = []
        for i in range(sides):
            ni = (i + 1) % sides
            # In Three.js (X right, Y up, Z front), angle from +X towards +Z is clockwise around +Y,
            # so outward normal requires (i, i + sides, ni + sides, ni)
            faces.append((i, i + sides, ni + sides, ni))
        if cap and radius_a > 1e-5:
            faces.append(tuple(range(sides)))
        if cap and radius_b > 1e-5:
            faces.append(tuple(sides + i for i in reversed(range(sides))))
        self.add_town_mesh(town_verts, faces, mat, color=color)

    def add_catmull_tube(self, points, radius, mat, segs=28, sides=10, cap=True, color=(1.0, 1.0, 1.0), arch_Mod=None):
        """Adds a smooth tube along Catmull-Rom spline in Town coordinates."""
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
            if i == 0:
                tang = (samples[1] - samples[0]).normalized()
            elif i == segs:
                tang = (samples[segs] - samples[segs - 1]).normalized()
            else:
                tang = (samples[i + 1] - samples[i - 1]).normalized()
            ref = Vector((1, 0, 0)) if abs(tang.y) > 0.95 else up
            axis1 = tang.cross(ref).normalized()
            axis2 = axis1.cross(tang).normalized()
            r = radius * (arch_Mod(i / segs) if arch_Mod else 1.0)
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

    def add_lathe(self, profile_2d, center, mat, segments=28, segs=None, scale=(1.0, 1.0, 1.0), color=(1.0, 1.0, 1.0)):
        """
        profile_2d: list of (r, y_local)
        center: (tx, ty, tz) in Town coordinates
        """
        if segs is not None:
            segments = segs
        cx, cy, cz = center
        sx, sy, sz = scale
        town_verts = []
        rows = len(profile_2d)
        for r, yl in profile_2d:
            for i in range(segments):
                ang = i * TAU / segments
                # In Three.js LatheGeometry, angle goes around Y
                vx = cx + math.sin(ang) * r * sx
                vy = cy + yl * sy
                vz = cz + math.cos(ang) * r * sz
                town_verts.append((vx, vy, vz))
        faces = []
        for row in range(rows - 1):
            for i in range(segments):
                ni = (i + 1) % segments
                a = row * segments + i
                b = row * segments + ni
                c = (row + 1) * segments + ni
                d = (row + 1) * segments + i
                faces.append((a, b, c, d))
        self.add_town_mesh(town_verts, faces, mat, color=color)

    def add_torus(self, center, major_r, minor_r, mat, maj_segs=28, min_segs=10, major_segs=None, minor_segs=None, rot_euler=(0.0, 0.0, 0.0), color=(1.0, 1.0, 1.0)):
        """Three.js TorusGeometry lies in XY plane by default."""
        if major_segs is not None:
            maj_segs = major_segs
        if minor_segs is not None:
            min_segs = minor_segs
        cx, cy, cz = center
        eul = Euler(rot_euler, 'XYZ')
        rot_mat = eul.to_matrix().to_4x4()
        town_verts = []
        for i in range(maj_segs):
            u = i * TAU / maj_segs
            cu, su = math.cos(u), math.sin(u)
            for j in range(min_segs):
                v = j * TAU / min_segs
                cv, sv = math.cos(v), math.sin(v)
                lx = (major_r + minor_r * cv) * cu
                ly = (major_r + minor_r * cv) * su
                lz = minor_r * sv
                p = rot_mat @ Vector((lx, ly, lz))
                town_verts.append((cx + p.x, cy + p.y, cz + p.z))
        faces = []
        for i in range(maj_segs):
            ni = (i + 1) % maj_segs
            for j in range(min_segs):
                nj = (j + 1) % min_segs
                a = i * min_segs + j
                b = ni * min_segs + j
                c = ni * min_segs + nj
                d = i * min_segs + nj
                faces.append((a, b, c, d))
        self.add_town_mesh(town_verts, faces, mat, color=color)

    def add_beam(self, a, b, width, mat, profile='cyl', segs=10, color=(1.0, 1.0, 1.0)):
        """Adds a beam between Town points a and b using either a beveled box or a cylinder."""
        va = Vector(a)
        vb = Vector(b)
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
            self.add_cylinder_between(a, b, width * 0.5, width * 0.5, mat, sides=segs, cap=True, color=color)

    def add_curved_tube(self, points, radius, mat, tubular_segs=24, radial_segs=8, cap=True, color=(1.0, 1.0, 1.0)):
        self.add_catmull_tube(points, radius, mat, segs=tubular_segs, sides=radial_segs, cap=cap, color=color)

    def add_cylinder(self, center, r_top, r_bot, height, mat, segs=24, rot_euler=(0.0, 0.0, 0.0), bevel=0.003, color=(1.0, 1.0, 1.0)):
        """Adds a cylinder (with optional top/bottom rim bevel) centered at center in Town coordinates."""
        cx, cy, cz = center
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

    def add_ellipsoid(self, center, scale, mat, subdivisions=2, color=(1.0, 1.0, 1.0)):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1.0)
        cx, cy, cz = center
        sx, sy, sz = scale
        town_verts = [(cx + v.co.x * sx, cy + v.co.y * sy, cz + v.co.z * sz) for v in bm.verts]
        bm.verts.ensure_lookup_table()
        faces = [[v.index for v in f.verts] for f in bm.faces]
        bm.free()
        self.add_town_mesh(town_verts, faces, mat, color=color)

    def build_object(self, shade_smooth=True, auto_smooth_deg=42.0):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.verts, [], self.faces)
        for mat in self.materials:
            mesh.materials.append(mat)
        for i, poly in enumerate(mesh.polygons):
            poly.material_index = self.mat_ids[i]
            poly.use_smooth = shade_smooth

        # Create Color attribute
        ca = mesh.color_attributes.new(name="Color", type='BYTE_COLOR', domain='CORNER')
        for poly_idx, poly in enumerate(mesh.polygons):
            f_cols = self.face_colors[poly_idx]
            for k, loop_idx in enumerate(poly.loop_indices):
                c = f_cols[k] if k < len(f_cols) else f_cols[0]
                ca.data[loop_idx].color = (c[0], c[1], c[2], 1.0)

        mesh.update()
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.collection.objects.link(obj)

        # Recalculate normals cleanly (except for custom double-sided sheets where normals are already oriented)
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        return obj

def eval_cubic_bezier_2d(p0, p1, p2, p3, t):
    u = 1.0 - t
    return (
        u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
        u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1],
    )

def eval_catmull_2d(pts, t_global):
    n = len(pts)
    scaled = max(0.0, min(1.0, t_global)) * (n - 1)
    idx = min(int(math.floor(scaled)), n - 2)
    t = scaled - idx
    p0 = pts[max(0, idx - 1)]
    p1 = pts[idx]
    p2 = pts[idx + 1]
    p3 = pts[min(n - 1, idx + 2)]
    t2 = t * t
    t3 = t2 * t
    x = 0.5 * ((2*p1[0]) + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3)
    z = 0.5 * ((2*p1[1]) + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
    return (x, z)

def eval_catmull_3d(pts, t_global):
    n = len(pts)
    if n == 1:
        return pts[0]
    scaled = max(0.0, min(1.0, t_global)) * (n - 1)
    idx = min(int(math.floor(scaled)), n - 2)
    t = scaled - idx
    p0 = pts[max(0, idx - 1)]
    p1 = pts[idx]
    p2 = pts[idx + 1]
    p3 = pts[min(n - 1, idx + 2)]
    t2 = t * t
    t3 = t2 * t
    x = 0.5 * ((2*p1[0]) + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3)
    y = 0.5 * ((2*p1[1]) + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
    z = 0.5 * ((2*p1[2]) + (-p0[2]+p2[2])*t + (2*p0[2]-5*p1[2]+4*p2[2]-p3[2])*t2 + (-p0[2]+3*p1[2]-3*p2[2]+p3[2])*t3)
    return (x, y, z)

def sample_curve_z_at_x(curve_pts):
    """Given a list of (x, z) sorted or unsorted along x, return a function z(x)."""
    sp = sorted(curve_pts, key=lambda p: p[0])
    def z_at_x(x):
        if x <= sp[0][0]:
            return sp[0][1]
        if x >= sp[-1][0]:
            return sp[-1][1]
        for i in range(len(sp) - 1):
            x0, z0 = sp[i]
            x1, z1 = sp[i + 1]
            if x0 <= x <= x1:
                if abs(x1 - x0) < 1e-8:
                    return z0
                return z0 + (z1 - z0) * (x - x0) / (x1 - x0)
        return sp[-1][1]
    return z_at_x

def rounded_rect_points(cx, cy, w, h, r, segs_per_corner=8):
    """Returns CCW list of (x, y) points for a rounded rectangle."""
    r = min(r, w * 0.49, h * 0.49)
    corners = [
        (cx + w*0.5 - r, cy - h*0.5 + r, -math.pi*0.5, 0.0),
        (cx + w*0.5 - r, cy + h*0.5 - r, 0.0, math.pi*0.5),
        (cx - w*0.5 + r, cy + h*0.5 - r, math.pi*0.5, math.pi),
        (cx - w*0.5 + r, cy - h*0.5 + r, math.pi, math.pi*1.5),
    ]
    pts = []
    for ox, oy, a0, a1 in corners:
        for i in range(segs_per_corner + 1):
            a = a0 + (a1 - a0) * (i / segs_per_corner)
            pts.append((ox + math.cos(a) * r, oy + math.sin(a) * r))
    return pts

def build_cafe_ground(mats):
    """
    Builds cafe_ground covering x in [-3.0, 3.0], z in [-3.4, 5.35] (Town coords)
    with seamless boundary height and color continuity, plus refined stone court slabs.
    """
    mc = MeshCollector("cafe_ground")

    # 1. Sample exact court north & south Bezier curves from day-environment.mjs (lines 837-841)
    north_pts = []
    for seg in [
        ((-9.45, 1.12), (-9.40, 0.42), (-7.28, 0.39), (-6.22, 0.48)),
        ((-6.22, 0.48), (-4.06, 0.62), (-2.80, 0.73), (-0.42, 0.60)),
        ((-0.42, 0.60), (2.21, 0.44), (4.37, 0.55), (6.13, 0.50)),
        ((6.13, 0.50), (8.61, 0.31), (9.40, 0.72), (9.48, 1.37)),
    ]:
        for i in range(40):
            north_pts.append(eval_cubic_bezier_2d(*seg, i / 40.0))
    north_pts.append((9.48, 1.37))
    court_north_z = sample_curve_z_at_x(north_pts)

    south_pts = []
    for seg in [
        ((9.40, 4.10), (9.21, 4.86), (7.30, 5.01), (5.74, 4.94)),
        ((5.74, 4.94), (3.32, 4.81), (2.33, 5.13), (0.12, 5.18)),
        ((0.12, 5.18), (-2.51, 5.23), (-3.89, 4.83), (-6.16, 4.92)),
        ((-6.16, 4.92), (-8.82, 5.09), (-9.42, 4.83), (-9.48, 4.10)),
    ]:
        for i in range(40):
            south_pts.append(eval_cubic_bezier_2d(*seg, i / 40.0))
    south_pts.append((-9.48, 4.10))
    court_south_z = sample_curve_z_at_x(south_pts)

    # Sample the 3 mortar course curves from day-environment.mjs (lines 849-853)
    course_ctrl = [
        [(-9.08,1.61),(-6.53,1.35),(-3.4,1.69),(0,1.48),(3.4,1.65),(6.4,1.41),(9.11,1.76)],
        [(-9.17,2.50),(-6.62,2.34),(-3.30,2.64),(0,2.56),(3.41,2.49),(6.47,2.43),(9.15,2.69)],
        [(-8.85,3.36),(-6.31,3.30),(-3.21,3.40),(0,3.60),(3.03,3.38),(6.41,3.29),(8.95,3.45)],
    ]
    course_funcs = []
    for ctrl in course_ctrl:
        c_pts = [eval_catmull_2d(ctrl, i / 120.0) for i in range(121)]
        course_funcs.append(sample_curve_z_at_x(c_pts))

    # Add a 4th subtle course curve at z ~ 4.32 between course 3 and south border
    def course4_z(x):
        return 0.52 * course_funcs[2](x) + 0.48 * court_south_z(x)

    all_courses = [court_north_z, course_funcs[0], course_funcs[1], course_funcs[2], course4_z, court_south_z]

    # 2. Lawn terrain base covering [-3.0, 3.0] x [-3.4, 5.35] at ty = 0.075
    # Skip triangles completely hidden deep under the stone court (z in [0.75, 4.95])
    # or deep under the maru deck (x in [-2.15, 2.15], z in [-2.80, 1.05])
    nx_lawn, nz_lawn = 36, 56
    xs = [-3.0 + 6.0 * i / nx_lawn for i in range(nx_lawn + 1)]
    zs = [-3.4 + 8.75 * j / nz_lawn for j in range(nz_lawn + 1)]
    lawn_verts = []
    lawn_colors = []
    for j, z in enumerate(zs):
        for i, x in enumerate(xs):
            lawn_verts.append((x, 0.075, z))
            lawn_colors.append(terrain_color_linear(x, z))
    lawn_faces = []
    stride = nx_lawn + 1
    for j in range(nz_lawn):
        z_mid = 0.5 * (zs[j] + zs[j + 1])
        for i in range(nx_lawn):
            x_mid = 0.5 * (xs[i] + xs[i + 1])
            # Skip if completely hidden under opaque court or maru deck
            if 0.80 < z_mid < 4.90:
                continue
            if abs(x_mid) < 2.10 and -2.75 < z_mid < 1.05:
                continue
            k = j * stride + i
            # Counter-clockwise when viewed from +Y (up): (k, k+stride, k+stride+1, k+1)
            lawn_faces.append((k, k + stride, k + stride + 1, k + 1))
    mc.add_town_mesh(lawn_verts, lawn_faces, mats['proc_lawn'], vert_colors=lawn_colors)

    # 3. North gravel path to greenhouse (z in [-3.4, 0.72], width 3.54, ty = 0.089)
    gravel_ctrl = [(0.0, 1.5), (0.04, -0.6), (-0.11, -2.6), (0.04, -4.5), (0.0, -6.85)]
    g_samples = [eval_catmull_2d(gravel_ctrl, i / 120.0) for i in range(121)]
    gravel_cx = sample_curve_z_at_x([(p[1], p[0]) for p in g_samples]) # z -> x_center

    nz_g, nx_g = 28, 20
    gz_list = [-3.4 + (0.72 - (-3.4)) * j / nz_g for j in range(nz_g + 1)]
    g_verts = []
    for j, gz in enumerate(gz_list):
        cx = gravel_cx(gz)
        # Match width modulation from day-environment.mjs groundRibbon
        # At north boundary z = -3.4, t is around 0.58
        t_approx = (1.5 - gz) / (1.5 - (-6.85))
        w = 3.54 * (1.0 + math.sin(t_approx * TAU) * 0.065 + math.sin(t_approx * TAU * 2.0 + 1.5) * 0.035)
        for i in range(nx_g + 1):
            u = i / nx_g - 0.5
            gx = max(-3.0, min(3.0, cx + u * w))
            # Softly feather the extreme left/right 4cm down to lawn height 0.075
            edge_d = min(0.5 - abs(u), 0.03) / 0.03
            gy = 0.075 + (0.089 - 0.075) * max(0.0, min(1.0, edge_d))
            g_verts.append((gx, gy, gz))
    g_faces = []
    g_stride = nx_g + 1
    for j in range(nz_g):
        z_mid = 0.5 * (gz_list[j] + gz_list[j + 1])
        for i in range(nx_g):
            u_mid = (i + 0.5) / nx_g - 0.5
            x_mid = u_mid * 3.54
            if abs(x_mid) < 2.12 and -2.80 < z_mid < 1.10:
                continue
            k = j * g_stride + i
            g_faces.append((k, k + g_stride, k + g_stride + 1, k + 1))
    mc.add_town_mesh(g_verts, g_faces, mats['proc_gravel'])

    # 4. Stepping stones on the north gravel path (matching v20 positions & heights)
    # In v20: iz = 0..7, z = -6.71 + iz * 0.96 -> iz=4 is z=-2.87, iz=5 is z=-1.91
    for iz in range(4, 8):
        sz = -6.71 + iz * 0.96
        if sz > -2.65:
            continue # inside maru
        for side in (-1, 1):
            sx = side * (0.59 + (iz % 2) * 0.11)
            yaw = (0.13 if (iz % 2) else -0.10) * side
            tint = hex_to_linear('#e4e8dd' if (iz % 3) else '#d4dccc')
            # Sculpted organic stepping stone
            bm = bmesh.new()
            bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
            for v in bm.verts:
                x, y, z = v.co.x, v.co.y, v.co.z
                r_mod = 1.0 + math.sin(x * 7.0 + z * 4.0) * 0.043 + math.cos(y * 9.0 - x * 2.0) * 0.036
                # Flatten top slightly for a pleasant stepping stone surface
                y_flat = y * 0.85 if y > 0.2 else y
                v.co.x = x * r_mod * 0.67
                v.co.y = y_flat * r_mod * 0.035
                v.co.z = z * r_mod * 0.46
            rot = Euler((0.0, yaw, 0.0), 'XYZ').to_matrix().to_4x4()
            s_verts = []
            for v in bm.verts:
                p = rot @ v.co
                s_verts.append((sx + p.x, 0.099 + p.y, sz + p.z))
            bm.verts.ensure_lookup_table()
            s_faces = [[v.index for v in f.verts] for f in bm.faces]
            bm.free()
            mc.add_town_mesh(s_verts, s_faces, mats['proc_paving'], color=tint)

    # 5. South gravel shoulders (z ~ 5.00 to 5.35, ty = 0.099)
    sg_ctrl1 = [(-9.2,3),(-9.0,5.3),(-4.5,6.0),(0,6.12),(4.8,5.92),(9.0,5.3),(9.2,3)]
    sg_ctrl2 = [(-9.1, 5.19), (-6.3, 5.22), (-3.0, 5.25), (0.0, 5.18), (3.3, 5.24), (6.4, 5.21), (9.1, 5.19)]
    sg_pts2 = [eval_catmull_2d(sg_ctrl2, i / 100.0) for i in range(101)]
    sg_center_z = sample_curve_z_at_x(sg_pts2)

    nx_sg, nz_sg = 36, 8
    sg_verts = []
    for j in range(nz_sg + 1):
        v_frac = j / nz_sg
        for i in range(nx_sg + 1):
            x = -3.0 + 6.0 * i / nx_sg
            z0 = court_south_z(x) - 0.05
            z1 = 5.35
            z = z0 + (z1 - z0) * v_frac
            # Smoothly meet 0.099 across the shoulder
            sg_verts.append((x, 0.099, z))
    sg_faces = []
    sg_stride = nx_sg + 1
    for j in range(nz_sg):
        for i in range(nx_sg):
            k = j * sg_stride + i
            sg_faces.append((k, k + sg_stride, k + sg_stride + 1, k + 1))
    mc.add_town_mesh(sg_verts, sg_faces, mats['proc_gravel'])

    # Small pebbles along the south gravel edge (z ~ 5.20..5.28)
    pebble_rng = make_rng(9102)
    for i in range(12):
        px = -2.75 + i * 0.48 + (pebble_rng() - 0.5) * 0.15
        pz = sg_center_z(px) + (pebble_rng() - 0.5) * 0.10
        rx = 0.028 + pebble_rng() * 0.022
        rz = 0.024 + pebble_rng() * 0.018
        col = hex_to_linear('#bcbca4' if (i % 3) else '#d8ceb8')
        mc.add_beveled_box((px, 0.098, pz), (rx*2, 0.018, rz*2), mats['proc_stone'],
                           rot_euler=(0.0, pebble_rng()*TAU, 0.0), bevel=0.006, segments=2, color=col)

    # 6. Main Limestone Court (ty = 0.103) with sculpted flagstone courses & mortar joints
    # Between all_courses[c_idx] and all_courses[c_idx+1] for c_idx in 0..4
    slab_rng = make_rng(4021)
    for c_idx in range(len(all_courses) - 1):
        z_top_fn = all_courses[c_idx]
        z_bot_fn = all_courses[c_idx + 1]
        # Number of flagstones across [-3.0, 3.0]: 6 or 7 staggered
        num_slabs = 6 if (c_idx % 2 == 0) else 7
        x_splits = [-3.0]
        for s in range(1, num_slabs):
            base_x = -3.0 + 6.0 * (s / num_slabs)
            jitter = (slab_rng() - 0.5) * 0.08
            x_splits.append(base_x + jitter)
        x_splits.append(3.0)

        for s in range(num_slabs):
            x_left = x_splits[s]
            x_right = x_splits[s + 1]
            # Subtle per-slab tint, fading to 1.0 near x = +-3.0 so boundary color is 100% seamless
            mid_x = 0.5 * (x_left + x_right)
            boundary_fade = smoothstep(3.0 - abs(mid_x), 0.0, 0.55)
            tone = 1.0 + (slab_rng() - 0.5) * 0.032 * boundary_fade
            slab_col = (min(1.0, tone), min(1.0, tone), min(1.0, tone * 0.995))

            # Build a grid for this slab with beveled edges at the joints
            # Along X: if s > 0, left edge has a 7mm mortar margin & 8mm bevel; if s == 0 (x=-3.0), flush!
            # Along Z: top and bottom edges have 7mm mortar margin & 8mm bevel
            u_steps = [0.0, 0.015, 0.04, 0.25, 0.5, 0.75, 0.96, 0.985, 1.0]
            v_steps = [0.0, 0.02, 0.05, 0.3, 0.5, 0.7, 0.95, 0.98, 1.0]
            s_verts = []
            for vj, vf in enumerate(v_steps):
                for ui, uf in enumerate(u_steps):
                    xx = x_left + (x_right - x_left) * uf
                    zt = z_top_fn(xx)
                    zb = z_bot_fn(xx)
                    zz = zt + (zb - zt) * vf
                    # Groove depth near slab edges (except at x = -3.0 and x = 3.0)
                    at_left_joint = (s > 0) and (ui <= 1)
                    at_right_joint = (s < num_slabs - 1) and (ui >= len(u_steps) - 2)
                    at_top_joint = (c_idx > 0) and (vj <= 1)
                    at_bot_joint = (c_idx < len(all_courses) - 2) and (vj >= len(v_steps) - 2)
                    edge_fade = smoothstep(3.0 - abs(xx), 0.0, 0.25)
                    if at_left_joint or at_right_joint or at_top_joint or at_bot_joint:
                        yy = 0.103 - 0.0022 * edge_fade
                    else:
                        yy = 0.103
                    if abs(xx) < 2.22 and -2.84 < zz < 1.18:
                        fx = min(1.0, (2.22 - abs(xx)) / 0.12)
                        fz = min(1.0, min(zz - (-2.84), 1.18 - zz) / 0.12)
                        yy -= 0.035 * fx * fz
                    s_verts.append((xx, yy, zz))

            u_len = len(u_steps)
            paving_faces = []
            mortar_faces = []
            for vj in range(len(v_steps) - 1):
                for ui in range(len(u_steps) - 1):
                    k = vj * u_len + ui
                    quad = (k, k + u_len, k + u_len + 1, k + 1)
                    is_mortar = (
                        (s > 0 and ui == 0) or
                        (s < num_slabs - 1 and ui == len(u_steps) - 2) or
                        (c_idx > 0 and vj == 0) or
                        (c_idx < len(all_courses) - 2 and vj == len(v_steps) - 2)
                    )
                    if is_mortar:
                        mortar_faces.append(quad)
                    else:
                        paving_faces.append(quad)
            mc.add_town_mesh(s_verts, paving_faces, mats['proc_paving'], color=slab_col)
            if mortar_faces:
                mc.add_town_mesh(s_verts, mortar_faces, mats['proc_mortar'])

    # Also add the 3 primary v20 mortar course ribbons at y = 0.1045..0.110 near the boundaries
    # so they match the exact 0.110 height of the v20 mortar ribbons at x = +-3.0
    for fn in course_funcs:
        nx_m = 40
        m_verts = []
        for i in range(nx_m + 1):
            xx = -3.0 + 6.0 * i / nx_m
            zz = fn(xx)
            # Slightly proud near x=+-3.0 (0.110) and flush-recessed (0.1032) in the middle
            edge_t = smoothstep(abs(xx), 2.4, 3.0)
            yy = 0.1032 + (0.110 - 0.1032) * edge_t
            m_verts.append((xx, yy, zz - 0.007))
            m_verts.append((xx, yy, zz + 0.007))
        m_faces = []
        for i in range(nx_m):
            k = i * 2
            m_faces.append((k, k + 1, k + 3, k + 2))
        mc.add_town_mesh(m_verts, m_faces, mats['proc_mortar'])

    # 7. North and South stone border curbs (courtBorder, width 0.13, ty = 0.097..0.104)
    border_ctrls = [
        [(-9.39,1.10),(-9.05,0.62),(-6.20,0.52),(-3.20,0.70),(0,0.62),(3.25,0.58),(6.20,0.54),(9.10,0.79),(9.43,1.34)],
        [(-9.28,4.53),(-6.43,4.96),(-3.48,4.93),(0,5.17),(3.32,4.97),(6.37,4.97),(9.23,4.53)],
    ]
    for b_idx, ctrl in enumerate(border_ctrls):
        b_pts = [eval_catmull_2d(ctrl, i / 140.0) for i in range(141)]
        b_fn = sample_curve_z_at_x(b_pts)
        nx_b = 48
        b_verts = []
        # Cross section: beveled stone curb ribbon
        cross = [(-0.065, 0.094), (-0.052, 0.1035), (0.052, 0.1035), (0.065, 0.094)]
        for i in range(nx_b + 1):
            xx = -3.0 + 6.0 * i / nx_b
            zz = b_fn(xx)
            for dz, yy in cross:
                b_verts.append((xx, yy, zz + dz))
        b_faces = []
        c_len = len(cross)
        for i in range(nx_b):
            # For north border, skip middle section under the maru apron (-2.24..2.24)
            xx_mid = -3.0 + 6.0 * (i + 0.5) / nx_b
            if b_idx == 0 and abs(xx_mid) < 2.22:
                continue
            for c in range(c_len - 1):
                k = i * c_len + c
                b_faces.append((k, k + 1, k + c_len + 1, k + c_len))
        mc.add_town_mesh(b_verts, b_faces, mats['proc_stone'])

    # 8. Grass blades on the side lawns (matching v20 positions from reference)
    grass_spots = [
        (2.80, -0.134, 0.115, 0.3, '#526c42'),
        (2.95, -0.250, 0.090, 1.1, '#687e4b'),
        (2.92, -0.120, 0.114, 2.2, '#5a7345'),
        (2.93, 0.048, 0.117, 0.8, '#758851'),
        (2.97, -0.211, 0.075, 1.7, '#607848'),
        (2.67, -0.209, 0.097, 2.9, '#6e834d'),
        (-2.92, -0.915, 0.061, 0.5, '#556f43'),
        (-2.92, -0.837, 0.082, 1.9, '#6b804c'),
        (-2.83, -0.823, 0.090, 2.5, '#7c8d53'),
        (-2.98, -1.148, 0.115, 1.2, '#587144'),
    ]
    for gx, gz, gh, gang, ghex in grass_spots:
        gcol = hex_to_linear(ghex)
        scale_y = gh / 0.080
        # 3-segment tapered grass blade with 3mm thickness (front layer +Z, back layer -Z)
        b_local = [
            # Front layer (z + 0.0018)
            (-0.010, 0.0, 0.0018), (0.010, 0.0, 0.0018),
            (-0.009, 0.035*scale_y, 0.0118), (0.008, 0.035*scale_y, 0.0118),
            (-0.005, 0.065*scale_y, 0.0268), (0.005, 0.065*scale_y, 0.0268),
            (0.0, 0.080*scale_y, 0.0495),
            # Back layer (z - 0.0018)
            (-0.010, 0.0, -0.0018), (0.010, 0.0, -0.0018),
            (-0.009, 0.035*scale_y, 0.0082), (0.008, 0.035*scale_y, 0.0082),
            (-0.005, 0.065*scale_y, 0.0232), (0.005, 0.065*scale_y, 0.0232),
            (0.0, 0.080*scale_y, 0.0465),
        ]
        rot = Euler((0.0, gang, 0.0), 'XYZ').to_matrix().to_4x4()
        gv = []
        for lx, ly, lz in b_local:
            p = rot @ Vector((lx, ly, lz))
            wx = max(-2.995, min(2.995, gx + p.x))
            gv.append((wx, 0.075 + p.y, gz + p.z))
        gf = [
            # Front (+Z normal)
            (0, 1, 3, 2), (2, 3, 5, 4), (4, 5, 6),
            # Back (-Z normal)
            (8, 7, 9, 10), (10, 9, 11, 12), (12, 11, 13),
        ]
        mc.add_town_mesh(gv, gf, mats['proc_lawn'], color=gcol)

    return mc.build_object(shade_smooth=True)


def build_cafe_maru(mats):
    """
    Builds cafe_maru:
    - Mortar deck base: center (0, -0.036, -0.85), size (4.6, 0.20, 4.2)
    - Dark wood subfloor plate under planks so plank seams show realistic dark shadow
    - 15 rows x 2 staggered beveled timber planks: top surface EXACTLY at y = 0.1295,
      x in [-2.275, 2.275], z in [-2.871, 1.227]
    - Left/right darkWood edge beams at x = +-2.25
    - Front darkWood step apron at z = 1.20
    """
    mc = MeshCollector("cafe_maru")

    # 1. Mortar base deck
    mc.add_beveled_box((0.0, -0.036, -0.85), (4.6, 0.20, 4.2), mats['proc_mortar'], bevel=0.008, segments=2)

    # 2. Dark subfloor plate right beneath the plank gaps (y = 0.064..0.082)
    mc.add_beveled_box((0.0, 0.073, -0.822), (4.48, 0.018, 4.08), mats['proc_dark_wood'],
                       bevel=0.003, segments=1, color=(0.45, 0.42, 0.38))

    # 3. 15 rows of staggered planks (exact v20 coordinates & seeded tints)
    rng = make_rng(81026)
    c_white = hex_to_linear('#ffffff')
    c_warm = hex_to_linear('#dad5c7')
    for iz in range(15):
        t_val = rng() * 0.16
        plank_col = lerp_color(c_white, c_warm, t_val)
        joint = 0.43 if (iz % 2 == 1) else -0.36
        left_w = joint + 2.275
        right_w = 2.275 - joint
        z_c = -2.74 + iz * 0.274
        # Center y = 0.102, height = 0.055 -> top is 0.102 + 0.0275 = 0.1295!
        mc.add_beveled_box((-2.275 + left_w * 0.5, 0.102, z_c), (left_w - 0.005, 0.055, 0.262),
                           mats['proc_wood'], bevel=0.0045, segments=2, color=plank_col)
        col_r = lerp_color(c_white, c_warm, (t_val + 0.04) % 0.16)
        mc.add_beveled_box((joint + right_w * 0.5, 0.102, z_c), (right_w - 0.005, 0.055, 0.262),
                           mats['proc_wood'], bevel=0.0045, segments=2, color=col_r)

    # 4. Side darkWood border timbers & front apron
    for sx in (-2.25, 2.25):
        mc.add_beveled_box((sx, 0.102, -0.82), (0.075, 0.055, 4.12), mats['proc_dark_wood'], bevel=0.005, segments=2)
    mc.add_beveled_box((0.0, 0.006, 1.20), (4.54, 0.24, 0.075), mats['proc_dark_wood'], bevel=0.006, segments=2)

    return mc.build_object(shade_smooth=True)


def build_cafe_wall(mats):
    """
    Builds cafe_wall:
    - Rear plaster wall: center (0, 1.1, -2.0), width 3.85, thickness 0.25 (z: -2.125..-1.875), height 2.2
      with large rounded-corner window opening at (0, 1.29), 3.12 x 1.52, r = 0.16
    - Front attic infill plaster panel at z = -1.98 (extruded 0.05m for solid depth)
    - Window interior warm plaster wall (#897b64) & dark glass backing (#433f36)
    - Front pier stone bases at (+-1.8, 0.23, -1.65), size (0.28, 0.38, 0.90) with dressed stone bevels
    """
    mc = MeshCollector("cafe_wall")

    # 1. Rear wall with rounded window opening and beveled edges
    hole_pts = rounded_rect_points(0.0, 1.29, 3.12, 1.52, 0.16, segs_per_corner=8)
    # Map each hole point (hx, hy) to the nearest point on the outer rectangle [-1.925, 1.925] x [0.0, 2.2]
    # Better yet: project radial rays from (0, 1.29) through each hole point to the outer rectangle [-1.925, 1.925] x [0.0, 2.2]!
    # Since (0, 1.29) is strictly inside both, every ray from (0, 1.29) through (hx, hy) hits the outer rectangle uniquely!
    # We also insert the 4 exact outer corners into the angular sequence so the outer boundary is 100% sharp & exact!
    cx, cy = 0.0, 1.29
    outer_w, outer_h = 3.85, 2.20
    ox_min, ox_max = -1.925, 1.925
    oy_min, oy_max = 0.0, 2.20

    def ray_to_outer(dx, dy):
        t_candidates = []
        if dx > 1e-7:
            t_candidates.append((ox_max - cx) / dx)
        elif dx < -1e-7:
            t_candidates.append((ox_min - cx) / dx)
        if dy > 1e-7:
            t_candidates.append((oy_max - cy) / dy)
        elif dy < -1e-7:
            t_candidates.append((oy_min - cy) / dy)
        t = min(t_candidates)
        return (cx + dx * t, cy + dy * t)

    def ray_to_rounded_rect(angle):
        dx, dy = math.cos(angle), math.sin(angle)
        # Find intersection with rounded rect (0, 1.29, 3.12, 1.52, 0.16)
        hw, hh, rr = 1.56, 0.76, 0.16
        t_box = []
        if abs(dx) > 1e-7:
            t_box.append((hw if dx > 0 else -hw) / dx)
        if abs(dy) > 1e-7:
            t_box.append((hh if dy > 0 else -hh) / dy)
        t = min(t_box)
        px, py = dx * t, dy * t
        # Check if inside corner region
        ix, iy = hw - rr, hh - rr
        if abs(px) > ix and abs(py) > iy:
            sx = math.copysign(ix, px)
            sy = math.copysign(iy, py)
            # Ray (dx*t, dy*t) intersect circle (x-sx)^2 + (y-sy)^2 = rr^2
            # t^2 - 2*t*(dx*sx + dy*sy) + (sx^2 + sy^2 - rr^2) = 0
            b_val = dx * sx + dy * sy
            c_val = sx * sx + sy * sy - rr * rr
            disc = max(0.0, b_val * b_val - c_val)
            t = b_val + math.sqrt(disc)
            px, py = dx * t, dy * t
        return (cx + px, cy + py)

    angles = []
    for hx, hy in hole_pts:
        angles.append(math.atan2(hy - cy, hx - cx))
    for ox, oy in [(ox_max, oy_min), (ox_max, oy_max), (ox_min, oy_max), (ox_min, oy_min)]:
        angles.append(math.atan2(oy - cy, ox - cx))
    # Deduplicate and sort angles in [-pi, pi]
    angles = sorted(angles)
    clean_angles = []
    for a in angles:
        if not clean_angles or abs(a - clean_angles[-1]) > 1e-4:
            clean_angles.append(a)
    if len(clean_angles) > 1 and abs((clean_angles[0] + TAU) - clean_angles[-1]) < 1e-4:
        clean_angles.pop()

    n_ring = len(clean_angles)
    # Create front and back faces + beveled inner/outer jambs across z in [-2.125, -1.875]
    z_back, z_front = -2.125, -1.875
    bev = 0.008
    # 4 rings on front and back:
    # ring 0: inner hole at z_back + bev .. z_front - bev
    # ring 1: inner hole beveled on face (expanded by bev) at z_back / z_front
    # ring 2: outer boundary inset by bev at z_back / z_front
    # ring 3: outer boundary at z_back + bev .. z_front - bev
    w_verts = []
    for a in clean_angles:
        hx, hy = ray_to_rounded_rect(a)
        ox, oy = ray_to_outer(math.cos(a), math.sin(a))
        # Subtle outward offset from hole for bevel
        nx_h, ny_h = math.cos(a), math.sin(a)
        hx_b, hy_b = hx + nx_h * bev, hy + ny_h * bev
        ox_b, oy_b = ox - nx_h * bev, oy - ny_h * bev
        # Store 8 vertices per angle slice:
        # 0: front inner jamb (z_front - bev)
        # 1: front inner face (z_front)
        # 2: front outer face (z_front)
        # 3: front outer edge (z_front - bev)
        # 4: back outer edge (z_back + bev)
        # 5: back outer face (z_back)
        # 6: back inner face (z_back)
        # 7: back inner jamb (z_back + bev)
        w_verts.extend([
            (hx, hy, z_front - bev),
            (hx_b, hy_b, z_front),
            (ox_b, oy_b, z_front),
            (ox, oy, z_front - bev),
            (ox, oy, z_back + bev),
            (ox_b, oy_b, z_back),
            (hx_b, hy_b, z_back),
            (hx, hy, z_back + bev),
        ])
    w_faces = []
    for i in range(n_ring):
        ni = (i + 1) % n_ring
        b0 = i * 8
        b1 = ni * 8
        for r in range(8):
            nr = (r + 1) % 8
            w_faces.append((b0 + r, b0 + nr, b1 + nr, b1 + r))
    mc.add_town_mesh(w_verts, w_faces, mats['proc_plaster'])

    # 2. Attic infill panel at z = -1.98 (thickness 0.04m: z in [-2.00, -1.96])
    n_attic = 32
    a_verts = []
    for z_a in (-1.96, -2.00):
        for i in range(n_attic + 1):
            xx = -1.925 + 3.85 * (i / n_attic)
            yy_top = cafe_roof_height(xx, -1.98) - 0.13
            a_verts.append((xx, 2.11, z_a))
            a_verts.append((xx, yy_top, z_a))
    a_faces = []
    stride_a = (n_attic + 1) * 2
    for i in range(n_attic):
        k = i * 2
        # Front face (+Z)
        a_faces.append((k, k + 2, k + 3, k + 1))
        # Back face (-Z)
        kb = stride_a + k
        a_faces.append((kb + 1, kb + 3, kb + 2, kb))
        # Top edge
        a_faces.append((k + 1, k + 3, kb + 3, kb + 1))
    mc.add_town_mesh(a_verts, a_faces, mats['proc_plaster'])

    # 3. Window interior warm plaster wall (#897b64) & dark glass backing (#433f36)
    # glassBacking at z = -2.120
    gb_pts = rounded_rect_points(0.0, 1.29, 3.095, 1.495, 0.16, segs_per_corner=7)
    gb_verts = [(0.0, 1.29, -2.120)] + [(px, py, -2.120) for px, py in gb_pts]
    gb_faces = [(0, 1 + i, 1 + (i + 1) % len(gb_pts)) for i in range(len(gb_pts))]
    mc.add_town_mesh(gb_verts, gb_faces, mats['proc_glass_backing'])

    # interiorPlaster at [0, 1.325, -2.114], size [2.558, 1.246, 0.006]
    mc.add_beveled_box((0.0, 1.325, -2.114), (2.558, 1.246, 0.006), mats['proc_interior_plaster'], bevel=0.001, segments=1)

    # 4. Front pier stone bases at (+-1.8, 0.23, -1.65), size (0.28, 0.38, 0.90)
    for side in (-1, 1):
        sx = side * 1.80
        mc.add_beveled_box((sx, 0.23, -1.65), (0.28, 0.38, 0.90), mats['proc_stone'], bevel=0.014, segments=2)

    return mc.build_object(shade_smooth=True)


def build_cafe_timber(mats):
    """
    Builds cafe_timber:
    - Open tea-room pier framing, darkWood shoes, front posts
    - Rear wall darkWood baseboard & reverse-side timber cladding
    - Rounded window wood frame, interior/exterior sills, darkWood mullions
    - Tea counter, generous front timber ledge, 3 broad counter posts
    - Recessed tea-room shelves
    - Roof fascia, sub-fascia, ridge beam, 13 curved rafters
    - Awning support struts, textile guide bars, history hanger, shop plaque & menu card
    """
    mc = MeshCollector("cafe_timber")

    # 1. Side pier framing & front posts
    for side in (-1, 1):
        sx = side * 1.80
        for z_p in (-2.032, -1.265):
            top = cafe_roof_height(sx, z_p) - 0.145
            mc.add_beveled_box((sx, (top + 0.405) * 0.5, z_p), (0.18, top - 0.405, 0.115),
                               mats['proc_wood'], bevel=0.007, segments=2)
        mc.add_beveled_box((sx, 0.58, -1.65), (0.18, 0.09, 0.87),
                           mats['proc_wood'], bevel=0.006, segments=2)
        p_a = (sx, cafe_roof_height(sx, -2.09) - 0.18, -2.09)
        p_b = (sx, cafe_roof_height(sx, -1.21) - 0.18, -1.21)
        mc.add_beam(p_a, p_b, 0.086, mats['proc_wood'], profile='box')

        # Dark timber shoe sitting on the stone pier base
        mc.add_beveled_box((sx, 0.431, -1.65), (0.285, 0.039, 0.90),
                           mats['proc_dark_wood'], bevel=0.004, segments=2)

        # Front post at z = -1.198
        front_top = cafe_roof_height(sx, -1.198) - 0.145
        mc.add_beveled_box((sx, (front_top + 0.325) * 0.5, -1.198), (0.145, front_top - 0.325, 0.085),
                           mats['proc_wood'], bevel=0.006, segments=2)

    # 2. Rear wall darkWood baseboard
    mc.add_beveled_box((0.0, 0.24, -1.824), (3.85, 0.25, 0.105),
                       mats['proc_dark_wood'], bevel=0.006, segments=2)

    # 3. Rounded window frame (outer 3.31 x 1.71 r=0.24, inner 3.085 x 1.485 r=0.125, z in [-1.912, -1.724])
    outer_pts = rounded_rect_points(0.0, 1.29, 3.31, 1.71, 0.24, segs_per_corner=8)
    inner_pts = rounded_rect_points(0.0, 1.29, 3.085, 1.485, 0.125, segs_per_corner=8)
    n_f = len(outer_pts)
    z0, z1 = -1.912, -1.724
    fb = 0.014
    f_verts = []
    for i in range(n_f):
        ox, oy = outer_pts[i]
        ix, iy = inner_pts[i]
        # Direction from inner to outer
        dx, dy = ox - ix, oy - iy
        d_len = max(1e-6, math.hypot(dx, dy))
        ux, uy = dx / d_len, dy / d_len
        ix_b, iy_b = ix + ux * fb, iy + uy * fb
        ox_b, oy_b = ox - ux * fb, oy - uy * fb
        f_verts.extend([
            (ix, iy, z1 - fb),
            (ix_b, iy_b, z1),
            (ox_b, oy_b, z1),
            (ox, oy, z1 - fb),
            (ox, oy, z0 + fb),
            (ox_b, oy_b, z0),
            (ix_b, iy_b, z0),
            (ix, iy, z0 + fb),
        ])
    f_faces = []
    for i in range(n_f):
        ni = (i + 1) % n_f
        b0, b1 = i * 8, ni * 8
        for r in range(8):
            nr = (r + 1) % 8
            f_faces.append((b0 + r, b0 + nr, b1 + nr, b1 + r))
    mc.add_town_mesh(f_verts, f_faces, mats['proc_wood'])

    # Window interior sill, mullions, transom, exterior sill
    mc.add_beveled_box((0.0, 0.7276, -2.076), (2.5584, 0.053, 0.071),
                       mats['proc_dark_wood'], bevel=0.004, segments=2)
    for u in (-0.38, 0.0, 0.38):
        mc.add_beveled_box((u * 3.12, 1.29, -1.789), (0.047, 1.45, 0.082),
                           mats['proc_dark_wood'], bevel=0.004, segments=2)
    mc.add_beveled_box((0.0, 1.24, -1.778), (3.03, 0.042, 0.088),
                       mats['proc_dark_wood'], bevel=0.004, segments=2)
    mc.add_beveled_box((0.0, 0.438, -1.731), (3.42, 0.12, 0.31),
                       mats['proc_wood'], bevel=0.007, segments=2)

    # 4. Tea counter, generous front ledge, and 3 broad vertical posts
    mc.add_beveled_box((0.0, 0.53, -1.69), (3.31, 0.14, 0.32),
                       mats['proc_wood'], bevel=0.007, segments=2)
    mc.add_beveled_box((0.14, 0.54, -1.57), (3.18, 0.13, 0.36),
                       mats['proc_wood'], bevel=0.007, segments=2)
    for px in (-1.62, 0.0, 1.62):
        mc.add_beveled_box((px, 1.29, -1.701), (0.092, 1.62, 0.145),
                           mats['proc_wood'], bevel=0.006, segments=2)

    # 5. Reverse-side rear wall cladding
    for i in range(16):
        mc.add_beveled_box((-1.65 + i * 0.22, 0.47, -2.151), (0.204, 0.52, 0.047),
                           mats['proc_wood'], bevel=0.004, segments=1)
    mc.add_beveled_box((0.0, 0.76, -2.17), (3.78, 0.084, 0.084),
                       mats['proc_dark_wood'], bevel=0.005, segments=2)

    # 6. Recessed tea-room shelves
    for sy in (0.88, 1.43):
        mc.add_beveled_box((0.0, sy, -2.060), (1.68, 0.053, 0.110),
                           mats['proc_wood'], bevel=0.004, segments=2)
    for sx in (-0.81, 0.81):
        mc.add_beveled_box((sx, 1.15, -2.077), (0.055, 0.64, 0.065),
                           mats['proc_wood'], bevel=0.004, segments=2)

    # 7. Roof timber fascia, sub-fascia, attic tie beam, and 13 curved rafters
    width_r = 5.26
    near_r, far_r = -0.65, -3.04
    for z_f in (near_r + 0.025, far_r - 0.025):
        pts_dark = [(-width_r * 0.5 + i * width_r / 24.0, cafe_roof_height(-width_r * 0.5 + i * width_r / 24.0, z_f) - 0.06, z_f) for i in range(25)]
        pts_wood = [(x, y - 0.076, z) for (x, y, z) in pts_dark]
        mc.add_curved_tube(pts_dark, 0.075, mats['proc_dark_wood'], tubular_segs=28, radial_segs=10)
        mc.add_curved_tube(pts_wood, 0.023, mats['proc_wood'], tubular_segs=28, radial_segs=8)

    pts_tie = [(-1.92 + i * 3.84 / 20.0, cafe_roof_height(-1.92 + i * 3.84 / 20.0, -1.92) - 0.13, -1.81) for i in range(21)]
    mc.add_curved_tube(pts_tie, 0.042, mats['proc_wood'], tubular_segs=24, radial_segs=8)

    for i in range(13):
        rx = -1.85 + i * 3.70 / 12.0
        pts_rafter = [(rx, cafe_roof_height(rx, far_r + (near_r - far_r) * j / 7.0) - 0.145, far_r + (near_r - far_r) * j / 7.0) for j in range(8)]
        mc.add_curved_tube(pts_rafter, 0.017, mats['proc_wood'], tubular_segs=16, radial_segs=8)

    # 8. Awning support struts & front curved bar
    width_a = 3.12
    near_a, far_a, front_y = -1.04, -1.80, 2.59
    for side in (-1, 1):
        ax = side * width_a * 0.5
        mc.add_beam((side * 1.80, 2.02, -1.65), (ax, 2.64, far_a), 0.024, mats['proc_dark_wood'], profile='cyl', segs=10)
        mc.add_beam((ax, 2.64, far_a), (ax, front_y, near_a), 0.018, mats['proc_dark_wood'], profile='cyl', segs=10)
    pts_abar = [((i / 30.0 - 0.5) * width_a, front_y + math.sin((i / 30.0) * math.pi) * 0.08 - 0.012, near_a - 0.009) for i in range(31)]
    mc.add_curved_tube(pts_abar, 0.019, mats['proc_dark_wood'], tubular_segs=28, radial_segs=8)

    # 9. Textile guide bars (-1.80, 1.25, -1.17) & History hanger (1.73, 1.02, -0.52)
    mc.add_beveled_box((-1.80, 1.25 + 0.38, -1.17), (0.48, 0.030, 0.035), mats['proc_wood'], bevel=0.003, segments=1)
    mc.add_beveled_box((-1.80, 1.25 - 0.37, -1.17), (0.42, 0.024, 0.030), mats['proc_wood'], bevel=0.003, segments=1)

    hx, hy, hz = 1.73, 1.02, -0.52
    mount_y = hy + 0.225 + 0.16
    mc.add_beam((hx, mount_y, -1.26), (hx, mount_y, hz), 0.013, mats['proc_dark_wood'], profile='cyl', segs=8)
    mc.add_beveled_box((hx, mount_y, hz), (0.38, 0.027, 0.032), mats['proc_wood'], bevel=0.003, segments=1)

    # 10. Shop identity wooden plaque & cup icon (1.38, 1.92, -1.633)
    mc.add_cylinder((1.38, 1.92, -1.633), 0.165, 0.165, 0.043, mats['proc_wood'],
                    segs=32, rot_euler=(math.pi * 0.5, 0.0, 0.0), bevel=0.004)
    mc.add_beveled_box((1.376, 1.91, -1.59), (0.105, 0.081, 0.013), mats['proc_paper'], bevel=0.002, segments=1)
    mc.add_torus((1.44, 1.913, -1.59), 0.027, 0.007, mats['proc_paper'], major_segs=18, minor_segs=8)
    mc.add_beveled_box((1.38, 1.858, -1.59), (0.14, 0.009, 0.012), mats['proc_paper'], bevel=0.002, segments=1)

    # 11. Menu card on tea table
    mc.add_beveled_box((1.14 - 0.24, 0.732 + 0.018, -0.33), (0.13, 0.018, 0.19),
                       mats['proc_paper'], rot_euler=(0.0, -0.2, 0.0), bevel=0.003, segments=1)

    return mc.build_object(shade_smooth=True)


def build_cafe_roof(mats):
    """
    Builds cafe_roof:
    - Thick curved dark blue-grey roof shell (width 5.26, z in [-3.04, -0.65], thickness 0.10)
    - 19 longitudinal standing-seam tile ribs (radius 0.012)
    - 7 overlapping horizontal ceramic tile courses with crisp front steps
    """
    mc = MeshCollector("cafe_roof")
    width = 5.26
    far, near = -3.04, -0.65
    nx, nz = 40, 16
    thickness = 0.10

    # 1. Main curved roof shell with subtle edge bevel rows
    r_verts = []
    for layer in range(2):
        for ix in range(nx + 1):
            for iz in range(nz + 1):
                x = -width * 0.5 + ix * width / nx
                z = far + iz * (near - far) / nz
                y = cafe_roof_height(x, z) - layer * thickness
                r_verts.append((x, y, z))
    stride = nz + 1
    offset = (nx + 1) * stride
    r_faces = []
    for ix in range(nx):
        for iz in range(nz):
            k = ix * stride + iz
            # Top surface
            r_faces.append((k, k + 1, k + stride + 1, k + stride))
            # Bottom surface
            r_faces.append((k + offset, k + stride + offset, k + stride + 1 + offset, k + 1 + offset))
    # Side edges
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
    mc.add_town_mesh(r_verts, r_faces, mats['proc_roof_slate'])

    # 2. 19 longitudinal tile ribs
    for i in range(19):
        rx = -width * 0.5 + i * width / 18.0
        pts = [(rx, cafe_roof_height(rx, far + (near - far) * j / 7.0) + 0.018, far + (near - far) * j / 7.0) for j in range(8)]
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
            # Slight undulating tile wave across each course between the 18 rib bays
            rib_phase = abs(math.sin((i / cols) * 18.0 * math.pi)) * 0.0035
            for z_c, lift in ((back_z, 0.006), (front_z, 0.026 + rib_phase), (front_z + 0.013, 0.007)):
                c_verts.append((x, cafe_roof_height(x, z_c) + lift, z_c))
        c_faces = []
        for i in range(cols):
            for strip in range(2):
                k = i * 3 + strip
                c_faces.append((k, k + 1, k + 4, k + 3))
        mc.add_town_mesh(c_verts, c_faces, mats['proc_roof_slate'])

    return mc.build_object(shade_smooth=True)


def build_cafe_awning(mats):
    """
    Builds cafe_awning:
    - Broad suspended cotton awning with double-sided thickness & realistic drape folds
    - Double-wave Mongle front hem + lapis trim cord
    - Left & right woven cloth side screens
    - Window interior folded curtains
    - Lapis textile guide banner + stitched embroidery + history hanger cords
    """
    mc = MeshCollector("cafe_awning")

    # 1. Suspended cotton awning (thick shell so top & bottom have independent UVs)
    cols, rows = 44, 14
    width = 3.12
    near_z, far_z, front_y = -1.04, -1.80, 2.59
    thick = 0.007
    aw_verts = []
    for layer in range(2):
        dy = -layer * thick
        for j in range(rows + 1):
            v = j / rows
            for i in range(cols + 1):
                u = i / cols
                transverse_arch = math.sin(u * math.pi)
                # Subtle fabric drape ripples between support ribs
                ripple = math.sin(u * math.pi * 6.0) * math.sin(v * math.pi) * 0.0045
                x = (u - 0.5) * width
                y = 2.64 - v * 0.05 + transverse_arch * (0.14 - v * 0.06) - math.sin(v * math.pi) * 0.055 + ripple + dy
                z = far_z + v * (near_z - far_z)
                aw_verts.append((x, y, z))
    stride = cols + 1
    offset = (rows + 1) * stride
    aw_faces = []
    for j in range(rows):
        for i in range(cols):
            n = j * stride + i
            aw_faces.append((n, n + stride, n + stride + 1, n + 1))
            aw_faces.append((n + offset, n + 1 + offset, n + stride + 1 + offset, n + stride + offset))
    # Stitch outer rim of awning
    for i in range(cols):
        aw_faces.append((i, i + 1, i + 1 + offset, i + offset))
        b = rows * stride + i
        aw_faces.append((b + 1, b, b + offset, b + 1 + offset))
    for j in range(rows):
        l0 = j * stride
        aw_faces.append((l0 + stride, l0, l0 + offset, l0 + stride + offset))
        r0 = j * stride + cols
        aw_faces.append((r0, r0 + stride, r0 + stride + offset, r0 + offset))
    mc.add_town_mesh(aw_verts, aw_faces, mats['proc_cotton_white'])

    # 2. Front Mongle double-wave hem (thickened ribbon) + lapis trim cord
    steps = 64
    hem_verts = []
    for layer in range(2):
        dz = -layer * 0.006
        for i in range(steps + 1):
            u = i / steps
            x = (u - 0.5) * width
            top_y = front_y + math.sin(u * math.pi) * 0.08
            bot_y = 2.555 + math.cos(u * TAU * 2.0) * 0.025
            hem_verts.append((x, top_y, near_z + dz))
            hem_verts.append((x, bot_y, near_z + 0.027 + dz))
    hem_offset = (steps + 1) * 2
    hem_faces = []
    for i in range(steps):
        k = i * 2
        hem_faces.append((k, k + 1, k + 3, k + 2))
        hem_faces.append((k + hem_offset, k + 2 + hem_offset, k + 3 + hem_offset, k + 1 + hem_offset))
        # Bottom wave rim
        hem_faces.append((k + 1, k + 1 + hem_offset, k + 3 + hem_offset, k + 3))
    mc.add_town_mesh(hem_verts, hem_faces, mats['proc_cotton_white'])

    pts_lapis_cord = [((i / 48.0 - 0.5) * width, 2.555 + math.cos((i / 48.0) * TAU * 2.0) * 0.025, near_z + 0.031) for i in range(49)]
    mc.add_curved_tube(pts_lapis_cord, 0.007, mats['proc_cotton_lapis'], tubular_segs=48, radial_segs=8)

    # 3. Side woven cloth screens (cafeSideScreen)
    for side in (-1, 1):
        pier_top = cafe_roof_height(side * 1.80, -1.65) - 0.145
        top_s = pier_top - 0.065
        bot_s = 0.65
        h_s = top_s - bot_s
        cy_s = 0.5 * (top_s + bot_s)
        nx_s, ny_s = 12, 12
        sc_verts = []
        for layer in range(2):
            dx_layer = (0.5 - layer) * 0.006 * side
            for jy in range(ny_s + 1):
                vy = (jy / ny_s - 0.5)
                for ix in range(nx_s + 1):
                    ux = (ix / nx_s - 0.5) * 0.68
                    wave = math.sin(ux * math.pi * 9.0) * 0.023 + math.cos(vy * math.pi) * 0.009
                    # Rotated by side * pi/2 around Y: local X maps to -side * Z, local Z maps to side * X
                    wx = side * 1.80 + side * wave + dx_layer
                    wy = cy_s + vy * h_s
                    wz = -1.65 - side * ux
                    sc_verts.append((wx, wy, wz))
        s_stride = nx_s + 1
        s_off = (ny_s + 1) * s_stride
        sc_faces = []
        for jy in range(ny_s):
            for ix in range(nx_s):
                k = jy * s_stride + ix
                if side > 0:
                    sc_faces.append((k, k + 1, k + s_stride + 1, k + s_stride))
                    sc_faces.append((k + s_off, k + s_stride + s_off, k + s_stride + 1 + s_off, k + 1 + s_off))
                else:
                    sc_faces.append((k, k + s_stride, k + s_stride + 1, k + 1))
                    sc_faces.append((k + s_off, k + 1 + s_off, k + s_stride + 1 + s_off, k + s_stride + s_off))
        mc.add_town_mesh(sc_verts, sc_faces, mats['proc_cotton_white'])

    # 4. Window interior folded curtains
    w_o, h_o = 3.12, 1.52
    for side in (-1, 1):
        cx_c = side * w_o * 0.35
        cy_c = 1.29
        cz_c = -2.054
        cw = w_o * 0.105
        ch = h_o * 0.84
        nx_c, ny_c = 10, 8
        c_verts = []
        for layer in range(2):
            dz_l = (0.5 - layer) * 0.005
            for jy in range(ny_c + 1):
                yy = (jy / ny_c - 0.5) * ch
                for ix in range(nx_c + 1):
                    xx = (ix / nx_c - 0.5) * cw
                    px = xx * (1.0 + 0.14 * math.cos(yy * 4.0))
                    pz = math.sin(xx * 58.0) * 0.021 + dz_l
                    c_verts.append((cx_c + px, cy_c + yy, cz_c + pz))
        c_stride = nx_c + 1
        c_off = (ny_c + 1) * c_stride
        c_faces = []
        for jy in range(ny_c):
            for ix in range(nx_c):
                k = jy * c_stride + ix
                c_faces.append((k, k + 1, k + c_stride + 1, k + c_stride))
                c_faces.append((k + c_off, k + c_stride + c_off, k + c_stride + 1 + c_off, k + 1 + c_off))
        mc.add_town_mesh(c_verts, c_faces, mats['proc_cotton_white'])

    # 5. Lapis textile guide banner (-1.80, 1.25, -1.17) + stitched embroidery
    gx, gy, gz = -1.80, 1.25, -1.17
    gw, gh = 0.42, 0.74
    nx_g, ny_g = 8, 14
    g_verts = []
    for layer in range(2):
        dz_g = (0.5 - layer) * 0.006
        for jy in range(ny_g + 1):
            yy = (jy / ny_g - 0.5) * gh
            for ix in range(nx_g + 1):
                xx = (ix / nx_g - 0.5) * gw
                zz = math.sin((yy + 0.37) * 6.3) * 0.013 + dz_g
                g_verts.append((gx + xx, gy + yy, gz + zz))
    g_stride = nx_g + 1
    g_off = (ny_g + 1) * g_stride
    g_faces = []
    for jy in range(ny_g):
        for ix in range(nx_g):
            k = jy * g_stride + ix
            g_faces.append((k, k + 1, k + g_stride + 1, k + g_stride))
            g_faces.append((k + g_off, k + g_stride + g_off, k + g_stride + 1 + g_off, k + 1 + g_off))
    mc.add_town_mesh(g_verts, g_faces, mats['proc_cotton_lapis'])

    # Stitched embroidery on the lapis guide banner
    emb_paths = [
        [(gx - 0.11, gy + 0.055, gz + 0.018), (gx + 0.11, gy + 0.055, gz + 0.018)],
        [(gx + 0.04, gy + 0.125, gz + 0.018), (gx + 0.11, gy + 0.055, gz + 0.018), (gx + 0.04, gy - 0.015, gz + 0.018)],
        [(gx - 0.14, gy - 0.25, gz + 0.018), (gx + 0.14, gy - 0.25, gz + 0.018)],
    ]
    for path in emb_paths:
        # Subdivide into stitches like v20 stitchedEmbroidery
        total_len = sum(math.dist(path[i], path[i + 1]) for i in range(len(path) - 1))
        steps_e = max(1, math.ceil(total_len / 0.043))
        for s in range(steps_e):
            t0 = s / steps_e
            t1 = (s + 0.72) / steps_e
            tm = 0.5 * (t0 + t1)
            p0 = eval_catmull_3d(path, t0)
            pm = eval_catmull_3d(path, tm)
            p1 = eval_catmull_3d(path, t1)
            pm = (pm[0], pm[1], pm[2] + 0.002)
            mc.add_curved_tube([p0, pm, p1], 0.0045, mats['proc_paper'], tubular_segs=4, radial_segs=6)

    # 6. History hanger cords (1.73, 1.02, -0.52)
    hx, hy, hz = 1.73, 1.02, -0.52
    top_h = hy + 0.225
    mount_y = top_h + 0.16
    for side in (-1, 1):
        mc.add_beam((hx + side * 0.13, mount_y, hz), (hx + side * 0.13, top_h + 0.012, hz),
                    0.005, mats['proc_cotton_white'], profile='cyl', segs=6)

    return mc.build_object(shade_smooth=True)


def build_cafe_ceramic(mats):
    """
    Builds cafe_ceramic:
    - Round white ceramic tea table top at (1.05, 0.68, -0.30), top y = 0.726, radius 0.567
    - Tea set at (1.14, 0.732, -0.33): saucer, cup, tea surface, handle
    - Table teapot at (0.85, 0.740, -0.34): coaster, teapot body, lid, finial, spout, handle
    - 2 shelf cups at (+-0.46, 0.907, -2.061)
    - 2 counter ceramic vessels at (-1.10, -0.83)
    - 2 hanging ceramic planters at (-1.67, 1.62)
    """
    mc = MeshCollector("cafe_ceramic")

    # 1. Tea table top
    top_profile = [
        (0.0, -0.045), (0.52, -0.045), (0.558, -0.033), (0.567, -0.012),
        (0.565, 0.018), (0.551, 0.040), (0.522, 0.046), (0.0, 0.046)
    ]
    mc.add_lathe(top_profile, (1.05, 0.68, -0.30), mats['proc_ceramic'], segs=40)

    # 2. Tea set at (1.14, 0.732, -0.33)
    tx, ty, tz = 1.14, 0.732, -0.33
    mc.add_cylinder((tx, ty, tz), 0.095, 0.095, 0.018, mats['proc_ceramic'], segs=24, bevel=0.003)
    cup_profile = [
        (0.0, 0.0), (0.075, 0.0), (0.082, 0.010), (0.095, 0.137),
        (0.096, 0.145), (0.084, 0.145), (0.083, 0.135), (0.072, 0.020), (0.0, 0.020)
    ]
    mc.add_lathe(cup_profile, (tx, ty + 0.008, tz), mats['proc_ceramic'], segs=24)
    mc.add_cylinder((tx, ty + 0.141, tz), 0.084, 0.084, 0.006, mats['proc_tea'], segs=20, bevel=0.001)
    mc.add_torus((tx + 0.093, ty + 0.087, tz), 0.045, 0.014, mats['proc_ceramic'], major_segs=18, minor_segs=8)

    # 3. Table teapot at (0.85, 0.740, -0.34)
    px, py, pz = 0.85, 0.740, -0.34
    mc.add_cylinder((px, py - 0.007, pz), 0.0745, 0.0745, 0.014, mats['proc_ceramic'], segs=24, bevel=0.002)
    pot_profile = [
        (0.0, 0.0), (0.075, 0.0), (0.110, 0.035), (0.119, 0.105),
        (0.105, 0.170), (0.073, 0.183), (0.074, 0.170), (0.106, 0.103),
        (0.085, 0.040), (0.0, 0.036)
    ]
    mc.add_lathe(pot_profile, (px, py, pz), mats['proc_ceramic'], segs=28)
    mc.add_ellipsoid((px, py + 0.190, pz), (0.078, 0.018, 0.078), mats['proc_ceramic'], subdivisions=2)
    mc.add_ellipsoid((px, py + 0.228, pz), (0.019, 0.019, 0.019), mats['proc_ceramic'], subdivisions=2)
    mc.add_curved_tube([(px - 0.073, py + 0.100, pz), (px - 0.163, py + 0.146, pz), (px - 0.214, py + 0.205, pz)],
                       0.020, mats['proc_ceramic'], tubular_segs=12, radial_segs=8)
    mc.add_curved_tube([(px + 0.088, py + 0.136, pz), (px + 0.150, py + 0.110, pz), (px + 0.158, py + 0.055, pz), (px + 0.082, py + 0.047, pz)],
                       0.012, mats['proc_ceramic'], tubular_segs=14, radial_segs=8)

    # 4. Shelf cups at (+-0.46, 0.907, -2.061)
    shelf_cup_profile = [
        (0.0, 0.0), (0.036, 0.0), (0.050, 0.008), (0.060, 0.077),
        (0.053, 0.081), (0.046, 0.016), (0.0, 0.016)
    ]
    for sx in (-0.46, 0.46):
        mc.add_lathe(shelf_cup_profile, (sx, 0.907, -2.061), mats['proc_ceramic'], segs=18, scale=(1.0, 1.0, 0.70))

    # 5. Counter ceramic vessels at (-1.10, -0.83)
    for vx in (-1.10, -0.83):
        mc.add_ellipsoid((vx, 0.72, -1.52), (0.115, 0.13, 0.09), mats['proc_ceramic'], subdivisions=2)

    # 6. Hanging ceramic planters at (-1.67, 1.62)
    for hx in (-1.67, 1.62):
        mc.add_ellipsoid((hx, 1.66, -1.47), (0.145, 0.12, 0.13), mats['proc_ceramic'], subdivisions=2)

    return mc.build_object(shade_smooth=True)


def build_cafe_metal_lantern(mats):
    """
    Builds cafe_metal_lantern:
    - Tea table pedestal & 3 tripod feet (proc_metal)
    - Wall lantern bracket, top/bottom caps (proc_metal), and warm butter globe (proc_butter)
    - Hanging planter wires (proc_metal)
    - Front pier brass collars & shop plaque brass ring (proc_brass)
    """
    mc = MeshCollector("cafe_metal_lantern")

    # 1. Tea table pedestal & tripod feet
    mc.add_cylinder((1.05, 0.37, -0.30), 0.115, 0.21, 0.55, mats['proc_metal'], segs=24, bevel=0.004)
    for a in (0.0, TAU / 3.0, TAU * 2.0 / 3.0):
        fx = 1.05 + math.sin(a) * 0.16
        fz = -0.30 + math.cos(a) * 0.16
        mc.add_beveled_box((fx, 0.15, fz), (0.055, 0.08, 0.42), mats['proc_metal'],
                           rot_euler=(0.0, a, 0.0), bevel=0.005, segments=2)

    # 2. Wall lantern at x = -1.47
    lx = -1.47
    mc.add_beveled_box((lx, 1.74, -1.71), (0.11, 0.08, 0.25), mats['proc_metal'], bevel=0.004, segments=2)
    for ly in (1.46, 1.72):
        mc.add_beveled_box((lx, ly, -1.56), (0.17, 0.039, 0.17), mats['proc_metal'], bevel=0.004, segments=2)
    mc.add_ellipsoid((lx, 1.59, -1.56), (0.078, 0.136, 0.078), mats['proc_butter'], subdivisions=3)

    # 3. Hanging planter wires at x in (-1.67, 1.62)
    for hx in (-1.67, 1.62):
        mc.add_beam((hx, 2.19, -1.47), (hx, 1.78, -1.47), 0.007, mats['proc_metal'], profile='cyl', segs=8)

    # 4. Front pier brass collars & shop plaque brass ring
    for side in (-1, 1):
        sx = side * 1.80
        front_top = cafe_roof_height(sx, -1.198) - 0.145
        for by in (0.50, front_top - 0.12):
            mc.add_beveled_box((sx, by, -1.20), (0.277, 0.058, 0.094), mats['proc_brass'], bevel=0.004, segments=2)

    mc.add_torus((1.38, 1.92, -1.603), 0.145, 0.008, mats['proc_brass'], major_segs=32, minor_segs=8)

    return mc.build_object(shade_smooth=True)


def build_cafe_foliage(mats):
    """
    Builds cafe_foliage:
    - Hanging planter herbs at (-1.67, 1.76, -1.47) and (1.62, 1.76, -1.47)
    """
    mc = MeshCollector("cafe_foliage")
    rng = make_rng(77123)
    c_dark = hex_to_linear('#496345')
    c_light = hex_to_linear('#a3ae69')

    # Prebuild canonical botanical leaf mesh (matching v20 leafGeometry, thickened slightly)
    rows, cols = 5, 4
    leaf_local_v = []
    for layer in range(2):
        dz_l = (0.5 - layer) * 0.004
        for j in range(rows + 1):
            v = j / rows
            for i in range(cols + 1):
                u = (i / cols) * 2.0 - 1.0
                w = (math.sin(v * math.pi) ** 0.74) * (1.15 - 0.31 * v)
                lx = u * 0.22 * w * (1.0 + u * 0.075) + math.sin(v * math.pi) * 0.018
                ly = v + abs(u) * math.sin(v * math.pi) * 0.025
                lz = math.sin(v * math.pi) * (0.10 - 0.075 * u * u) + v * v * 0.065 + dz_l
                leaf_local_v.append((lx, ly, lz))
    l_stride = cols + 1
    l_off = (rows + 1) * l_stride
    leaf_local_f = []
    for j in range(rows):
        for i in range(cols):
            k = j * l_stride + i
            leaf_local_f.append((k, k + 1, k + l_stride + 1, k + l_stride))
            leaf_local_f.append((k + l_off, k + l_stride + l_off, k + l_stride + 1 + l_off, k + 1 + l_off))

    scale = 0.53
    count = 7
    for px in (-1.67, 1.62):
        py, pz = 1.76, -1.47
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
                tv = []
                for lv in leaf_local_v:
                    p = rot @ Vector((lv[0] * sc.x, lv[1] * sc.y, lv[2] * sc.z))
                    tv.append((origin.x + p.x, origin.y + p.y, origin.z + p.z))
                mc.add_town_mesh(tv, leaf_local_f, mats['proc_foliage'], color=l_col)

    return mc.build_object(shade_smooth=True)


def build_cafe_glass(mats):
    """
    Builds cafe_glass:
    - Rounded-corner window glass pane at (0.0, 1.29, -1.976), size 3.095 x 1.495, r = 0.16
    - Uses live_glass material (no lightmap bake)
    """
    mc = MeshCollector("cafe_glass")
    pts = rounded_rect_points(0.0, 1.29, 3.095, 1.495, 0.16, segs_per_corner=8)
    verts = [(0.0, 1.29, -1.976)] + [(px, py, -1.976) for px, py in pts]
    faces = [(0, 1 + i, 1 + (i + 1) % len(pts)) for i in range(len(pts))]
    mc.add_town_mesh(verts, faces, mats['live_glass'])
    return mc.build_object(shade_smooth=True)


def build_all_cafe_meshes(mats):
    """Builds and returns all 10 cafe district objects in a dict."""
    objs = {
        'cafe_ground': build_cafe_ground(mats),
        'cafe_maru': build_cafe_maru(mats),
        'cafe_wall': build_cafe_wall(mats),
        'cafe_timber': build_cafe_timber(mats),
        'cafe_roof': build_cafe_roof(mats),
        'cafe_awning': build_cafe_awning(mats),
        'cafe_ceramic': build_cafe_ceramic(mats),
        'cafe_metal_lantern': build_cafe_metal_lantern(mats),
        'cafe_foliage': build_cafe_foliage(mats),
        'cafe_glass': build_cafe_glass(mats),
    }
    return objs

import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Quaternion, Euler

TAU = math.pi * 2.0
HOME_OFFSET = (-6.0, 0.0, 0.0)


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


def rgba_linear(hex_str, a=1.0):
    r, g, b = hex_to_linear(hex_str)
    return (r, g, b, a)


def lerp_color(c1, c2, t):
    t = max(0.0, min(1.0, t))
    return (
        c1[0] + (c2[0] - c1[0]) * t,
        c1[1] + (c2[1] - c1[1]) * t,
        c1[2] + (c2[2] - c1[2]) * t,
    )


def t2b(tx, ty, tz):
    """Town world (x, y, z) -> Blender world (x, -z, y)"""
    return Vector((tx, -tz, ty))


def home_roof_height(x, z, width=4.70):
    """Exact port of day-environment.mjs homeRoofHeight(x, z, width=4.70) in local home coordinates."""
    u = x / (width * 0.5)
    front = (z + 3.04) / 2.30
    return (
        3.12
        - 0.81 * (abs(u - 0.06) ** 1.26)
        + 0.19 * (abs(u) ** 6.0)
        + 0.105 * (front ** 4.0)
        - 0.085 * math.sin(front * math.pi)
    )


def home_small_roof_height(x, z):
    """Exact port of reading-bay smallHeight(x, z) in local home coordinates (smallCentre=0.72, smallWidth=2.08)."""
    small_centre = 0.72
    return (
        2.36
        - 0.24 * abs((x - small_centre) / 1.04)
        + 0.075 * (((z + 1.78) / 1.42) ** 2.0)
    )


def rounded_rect_points(cx, cy, w, h, r, segs_per_corner=12):
    """Returns CCW list of (x, y) points for a rounded rectangle."""
    r = min(r, w * 0.495, h * 0.495)
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
    return pts


def tune_home_materials(mats):
    """
    Refines procedural material colors in memory for town-home so they match
    v20_home.glb & screens/v20-1280x900-home-close.png accurately.
    """
    # 1. Home maru paving: bright warm-pale limestone (#e4e6e2 .. #eef0ec) multiplied by vertex tint
    mat_pv = mats.get('proc_paving')
    if mat_pv and mat_pv.use_nodes:
        for n in mat_pv.node_tree.nodes:
            if n.type == 'MIX' and n.data_type == 'RGBA' and n.blend_type == 'MIX':
                n.inputs[6].default_value = rgba_linear("#e2e5e0")
                n.inputs[7].default_value = rgba_linear("#eef0ec")

    # 2. Roof slate: deep slate-blue (#344b64 -> #2e435a .. #3b536e)
    mat_rf = mats.get('proc_roof_slate')
    if mat_rf and mat_rf.use_nodes:
        for n in mat_rf.node_tree.nodes:
            if n.type == 'MIX' and n.data_type == 'RGBA':
                n.inputs[6].default_value = rgba_linear("#2e435a")
                n.inputs[7].default_value = rgba_linear("#3b536e")

    # 3. Coral enamel mailbox & book cover (#f96859 -> #ed6253 .. #fa7062)
    mat_co = mats.get('proc_coral')
    if mat_co and mat_co.use_nodes:
        for n in mat_co.node_tree.nodes:
            if n.type == 'MIX' and n.data_type == 'RGBA':
                n.inputs[6].default_value = rgba_linear("#ed6253")
                n.inputs[7].default_value = rgba_linear("#fa7062")

    # 4. Dark green-slate iron for bench legs & wall lantern (#46564d darkened slightly for diffuse bake)
    mat_mt = mats.get('proc_metal')
    if mat_mt and mat_mt.use_nodes:
        bsdf = next((n for n in mat_mt.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            bsdf.inputs["Base Color"].default_value = rgba_linear("#394840")
            bsdf.inputs["Roughness"].default_value = 0.42

    # 5. Warm golden lantern globe (#f5c445)
    mat_bu = mats.get('proc_butter')
    if mat_bu and mat_bu.use_nodes:
        bsdf = next((n for n in mat_bu.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            bsdf.inputs["Base Color"].default_value = rgba_linear("#f5c84c")
            bsdf.inputs["Roughness"].default_value = 0.35

    # 6. Shaded interior plaster behind window (#625849 .. #6e6353) so books & mullions stand out clearly
    mat_ip = mats.get('proc_interior_plaster')
    if mat_ip and mat_ip.use_nodes:
        for n in mat_ip.node_tree.nodes:
            if n.type == 'MIX' and n.data_type == 'RGBA':
                n.inputs[6].default_value = rgba_linear("#625849")
                n.inputs[7].default_value = rgba_linear("#6e6353")

    # 7. Flowers material (uses vertex Color for petal/bud colors)
    if 'proc_flowers' not in mats:
        mat_fl = bpy.data.materials.new(name="proc_flowers")
        mat_fl.use_nodes = True
        nt = mat_fl.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        bsdf.inputs["Roughness"].default_value = 0.77
        bsdf.inputs["Metallic"].default_value = 0.0
        vcol = nt.nodes.new("ShaderNodeVertexColor")
        vcol.layer_name = "Color"
        nt.links.new(vcol.outputs["Color"], bsdf.inputs["Base Color"])
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
        mats['proc_flowers'] = mat_fl

    return mats


class MeshCollector:
    """
    Collects geometry in local home coordinates (relative to PLACES['home'] = [-6, 0]),
    shifts by HOME_OFFSET = (-6.0, 0.0, 0.0) into Town world coordinates,
    and builds a Blender Mesh Object in world space.
    """
    def __init__(self, name, offset=HOME_OFFSET):
        self.name = name
        self.ox, self.oy, self.oz = offset
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

    def add_local_mesh(self, local_verts, faces, mat, color=(1.0, 1.0, 1.0), vert_colors=None, face_smooth_list=None):
        offset_idx = len(self.verts)
        for lx, ly, lz in local_verts:
            self.verts.append(t2b(lx + self.ox, ly + self.oy, lz + self.oz))
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

    def add_beveled_box(self, center, size, mat, rot_euler=(0.0, 0.0, 0.0), bevel=0.008, segments=2, color=(1.0, 1.0, 1.0)):
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
                bmesh.ops.bevel(bm, geom=bm.edges[:], offset=actual_b, segments=segments, profile=0.5, affect='EDGES')
        bm.normal_update()
        eul = Euler(rot_euler, 'XYZ')
        rot_mat = eul.to_matrix().to_4x4()
        cx, cy, cz = center
        local_verts = []
        for v in bm.verts:
            p = rot_mat @ v.co
            local_verts.append((p.x + cx, p.y + cy, p.z + cz))
        bm.verts.ensure_lookup_table()
        faces = []
        smooth_flags = []
        for f in bm.faces:
            faces.append([v.index for v in f.verts])
            # Main axis-aligned faces stay optically flat; chamfered bevel faces are smooth
            n = f.normal
            is_main_axis = (abs(n.x) > 0.995 or abs(n.y) > 0.995 or abs(n.z) > 0.995)
            smooth_flags.append(not is_main_axis)
        bm.free()
        self.add_local_mesh(local_verts, faces, mat, color=color, face_smooth_list=smooth_flags)

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

        local_verts = []
        for y_local, r in [(-length * 0.5, radius_a), (length * 0.5, radius_b)]:
            for i in range(sides):
                ang = i * TAU / sides
                local_p = Vector((math.cos(ang) * r, y_local, math.sin(ang) * r))
                wp = mid + (rot_mat @ local_p)
                local_verts.append((wp.x, wp.y, wp.z))
        faces = []
        for i in range(sides):
            ni = (i + 1) % sides
            faces.append((i, i + sides, ni + sides, ni))
        if cap and radius_a > 1e-5:
            faces.append(tuple(range(sides)))
        if cap and radius_b > 1e-5:
            faces.append(tuple(sides + i for i in reversed(range(sides))))
        self.add_local_mesh(local_verts, faces, mat, color=color)

    def add_beam(self, a, b, width, mat, profile='cyl', segs=10, color=(1.0, 1.0, 1.0)):
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

        samples = [eval_catmull(i / tubular_segs) for i in range(tubular_segs + 1)]
        local_verts = []
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
                local_verts.append((v.x, v.y, v.z))
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
        self.add_local_mesh(local_verts, faces, mat, color=color)

    def add_cylinder(self, center, r_top, r_bot, height, mat, segs=24, rot_euler=(0.0, 0.0, 0.0), bevel=0.003, color=(1.0, 1.0, 1.0)):
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
        local_verts = []
        for r_val, yl in rings:
            for i in range(segs):
                ang = i * TAU / segs
                p = rot_mat @ Vector((math.sin(ang) * r_val, yl, math.cos(ang) * r_val))
                local_verts.append((cx + p.x, cy + p.y, cz + p.z))
        faces = []
        for row in range(len(rings) - 1):
            for i in range(segs):
                ni = (i + 1) % segs
                a = row * segs + i
                b_idx = row * segs + ni
                c = (row + 1) * segs + ni
                d = (row + 1) * segs + i
                faces.append((a, b_idx, c, d))
        self.add_local_mesh(local_verts, faces, mat, color=color)

    def add_torus(self, center, major_r, minor_r, mat, major_segs=32, minor_segs=10, rot_euler=(0.0, 0.0, 0.0), color=(1.0, 1.0, 1.0)):
        cx, cy, cz = center
        eul = Euler(rot_euler, 'XYZ')
        rot_mat = eul.to_matrix().to_4x4()
        local_verts = []
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
                local_verts.append((cx + p.x, cy + p.y, cz + p.z))
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
        self.add_local_mesh(local_verts, faces, mat, color=color)

    def add_ellipsoid(self, center, scale, mat, subdivisions=2, color=(1.0, 1.0, 1.0)):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1.0)
        cx, cy, cz = center
        sx, sy, sz = scale
        local_verts = [(cx + v.co.x * sx, cy + v.co.y * sy, cz + v.co.z * sz) for v in bm.verts]
        bm.verts.ensure_lookup_table()
        faces = [[v.index for v in f.verts] for f in bm.faces]
        bm.free()
        self.add_local_mesh(local_verts, faces, mat, color=color)

    def add_pillow(self, center, scale, mat, nx=12, ny=4, nz=8, color=(1.0, 1.0, 1.0)):
        """
        Subdivided plush cushion matching v20 pillowGeometry() envelope:
        taper = 1 - 0.09 * (abs(y)*2)**4, crown = 0.28 * cos(x*pi) * cos(z*pi) on top face,
        plus soft edge rounding on upper/lower rims.
        """
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
        cx, cy, cz = center
        sx, sy, sz = scale
        local_verts = []
        for v in bm.verts:
            x, y, z = v.co.x, v.co.y, v.co.z
            taper = 1.0 - 0.09 * ((abs(y) * 2.0) ** 4.0)
            # Smoothly blend the crown near the top surface
            top_weight = max(0.0, (y + 0.15) / 0.65) ** 2.0 if y > -0.15 else 0.0
            crown = 0.28 * math.cos(x * math.pi) * math.cos(z * math.pi) * top_weight
            # Soft corner rounding in XZ
            r_edge = max(abs(x), abs(z))
            if r_edge > 0.42 and abs(y) > 0.35:
                y *= 0.92
            px = cx + (x * taper) * sx
            py = cy + (y + crown) * sy
            pz = cz + (z * taper) * sz
            local_verts.append((px, py, pz))
        bm.verts.ensure_lookup_table()
        faces = [[v.index for v in f.verts] for f in bm.faces]
        bm.free()
        self.add_local_mesh(local_verts, faces, mat, color=color)

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


def build_home_maru(mats):
    """
    Builds home_maru:
    - Mortar deck base: center (0, -0.036, -0.85), size (4.6, 0.20, 4.2)
    - Recessed mortar subfloor plate at y = 0.082 so joint gaps between paving slabs have crisp shadow
    - 15 rows of beveled limestone paving courses: top surface EXACTLY at y = 0.1295,
      x in [-2.275, 2.275], z in [-2.871, 1.227]
    - Left/right darkWood border timbers at x = +-2.25
    - Front stone step curb at z = 1.20
    """
    mc = MeshCollector("home_maru")

    # 1. Base mortar deck (only upper/visible skirt above y = -0.05 to save underground UV space)
    mc.add_beveled_box((0.0, 0.014, -0.85), (4.60, 0.10, 4.20), mats['proc_mortar'], bevel=0.006, segments=2)

    # 2. Recessed mortar subfloor plate right beneath the paving course gaps (y = 0.076 .. 0.088)
    mc.add_beveled_box((0.0, 0.082, -0.822), (4.50, 0.012, 4.08), mats['proc_mortar'], bevel=0.002, segments=1)

    # 3. 15 rows of beveled paving courses (exact v20 coordinates & seeded tints)
    rng = make_rng(81026)
    c_light = hex_to_linear('#f0ede4')
    c_warm = hex_to_linear('#d4d5ca')
    for iz in range(15):
        t_val = rng() * 0.15
        row_col = lerp_color(c_light, c_warm, t_val)
        z_c = -2.74 + iz * 0.274
        # Center y = 0.102, height = 0.055 -> top is 0.102 + 0.0275 = 0.1295!
        mc.add_beveled_box((0.0, 0.102, z_c), (4.55, 0.055, 0.262),
                           mats['proc_paving'], bevel=0.0045, segments=2, color=row_col)

    # 4. Left/right darkWood border timbers & front stone step apron
    for sx in (-2.25, 2.25):
        mc.add_beveled_box((sx, 0.102, -0.82), (0.075, 0.055, 4.12), mats['proc_dark_wood'], bevel=0.005, segments=2)
    mc.add_beveled_box((0.0, 0.006, 1.20), (4.54, 0.24, 0.075), mats['proc_stone'], bevel=0.008, segments=2)

    return mc.build_object(shade_smooth=True)


def build_home_wall(mats):
    """
    Builds home_wall:
    - Rear plaster wall: x in [-1.925, 1.925], y in [0.0, 2.20], z in [-2.125, -1.875]
      with rounded-arch window opening at (0.65, 1.27), w = 2.04, h = 1.36, round = 0.57
    - Front attic infill plaster panel at z = -1.98
    - Left & right upper plaster piers at (+-1.80, (pierTop+0.405)/2, -1.65), size (0.25, pierTop-0.405, 0.87)
    - Left & right stone pier bases at (+-1.80, 0.23, -1.65), size (0.28, 0.38, 0.90)
    - Roof stone chimney flue & cap at (1.18, 2.66..3.05, -2.55)
    - Window interior warm plaster wall (#897b64) & dark glass backing (#433f36)
    """
    mc = MeshCollector("home_wall")

    # 1. Rear wall with large rounded-arch window opening (cx=0.65, cy=1.27, w=2.04, h=1.36, r=0.57)
    cx, cy = 0.65, 1.27
    hw, hh, rr = 1.02, 0.68, 0.57
    ox_min, ox_max = -1.925, 1.925
    oy_min, oy_max = 0.0, 2.20

    hole_pts = rounded_rect_points(cx, cy, hw * 2.0, hh * 2.0, rr, segs_per_corner=16)

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
    for ox, oy in [(ox_max, oy_min), (ox_max, oy_max), (ox_min, oy_max), (ox_min, oy_min)]:
        angles.append(math.atan2(oy - cy, ox - cx))
    angles = sorted(angles)
    clean_angles = []
    for a in angles:
        if not clean_angles or abs(a - clean_angles[-1]) > 1e-4:
            clean_angles.append(a)
    if len(clean_angles) > 1 and abs((clean_angles[0] + TAU) - clean_angles[-1]) < 1e-4:
        clean_angles.pop()

    n_ring = len(clean_angles)
    z_back, z_front = -2.125, -1.875
    bev = 0.008
    w_verts = []
    for a in clean_angles:
        hx, hy = ray_to_rounded_rect(a)
        ox, oy = ray_to_outer(math.cos(a), math.sin(a))
        nx_h, ny_h = math.cos(a), math.sin(a)
        hx_b, hy_b = hx + nx_h * bev, hy + ny_h * bev
        ox_b, oy_b = ox - nx_h * bev, oy - ny_h * bev
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
    w_smooth = []
    for i in range(n_ring):
        ni = (i + 1) % n_ring
        b0 = i * 8
        b1 = ni * 8
        for r in range(8):
            nr = (r + 1) % 8
            w_faces.append((b0 + r, b0 + nr, b1 + nr, b1 + r))
            # Front (r=1) and back (r=5) flat wall faces stay flat; jambs & bevels are smooth
            w_smooth.append(r not in (1, 5))
    mc.add_local_mesh(w_verts, w_faces, mats['proc_home_plaster'], face_smooth_list=w_smooth)

    # 2. Front attic infill panel at z = -1.98 (thickness 0.04m: z in [-2.00, -1.96])
    n_attic = 32
    a_verts = []
    for z_a in (-1.96, -2.00):
        for i in range(n_attic + 1):
            xx = -1.925 + 3.85 * (i / n_attic)
            yy_top = home_roof_height(xx, -1.98) - 0.13
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
    mc.add_local_mesh(a_verts, a_faces, mats['proc_home_plaster'])

    # 3. Left & right stone pier bases & single continuous upper plaster piers (meeting rear wall at z = -1.875)
    for side in (-1, 1):
        sx = side * 1.80
        mc.add_beveled_box((sx, 0.23, -1.65), (0.28, 0.38, 0.90), mats['proc_stone'], bevel=0.014, segments=2)
        pier_top = home_roof_height(sx, -1.65) - 0.145
        # Single continuous pier shaft from y = 0.405 to pier_top, z = -1.875 .. -1.215 (depth 0.66, center z = -1.545)
        mc.add_beveled_box((sx, (pier_top + 0.405) * 0.5, -1.545), (0.25, pier_top - 0.405, 0.66),
                           mats['proc_home_plaster'], bevel=0.008, segments=2)

    # 4. Roof stone chimney flue & cap at (1.18, 2.66..3.05, -2.55)
    c_flue = hex_to_linear('#d4d9ce')
    flue_bot = home_roof_height(1.18, -2.55) - 0.02
    flue_top = 3.03
    mc.add_beveled_box((1.18, (flue_bot + flue_top) * 0.5, -2.55), (0.27, flue_top - flue_bot, 0.31),
                       mats['proc_stone'], bevel=0.012, segments=2, color=c_flue)
    mc.add_beveled_box((1.18, 3.05, -2.55), (0.38, 0.08, 0.41), mats['proc_stone'],
                       bevel=0.010, segments=2)

    # 5. Window interior warm plaster wall (#897b64) & dark glass backing (#433f36)
    gb_pts = rounded_rect_points(0.65, 1.27, 2.015, 1.335, 0.57, segs_per_corner=14)
    gb_verts = [(0.65, 1.27, -2.120)] + [(px, py, -2.120) for px, py in gb_pts]
    gb_faces = [(0, 1 + i, 1 + (i + 1) % len(gb_pts)) for i in range(len(gb_pts))]
    mc.add_local_mesh(gb_verts, gb_faces, mats['proc_glass_backing'])

    mc.add_beveled_box((0.65, 1.305, -2.114), (2.04 * 0.82, 1.36 * 0.82, 0.006),
                       mats['proc_interior_plaster'], bevel=0.001, segments=1)

    return mc.build_object(shade_smooth=True)


def build_home_timber(mats):
    """
    Builds home_timber:
    - Pier darkWood shoes & front wood posts
    - Rear wall darkWood baseboard & reverse-side timber cladding
    - Domestic wooden door at x = -1.03, w = 0.73 (frame, planked leaf, 5 battens, 3 rails)
    - Rounded-arch window wood frame, interior/exterior sills, 2 vertical mullions, horizontal transom
    - Window flower box (wood box + soil bed) at (0.65, 0.44, -1.65), width 1.80
    - Main roof fascia, sub-fascia, attic tie beam, 13 curved rafters
    - Reading-bay pergola: front curved darkWood beam, 9 box rafters, 2 diagonal struts
    - Bench wood slats (5 seat + 3 backrest) at (0.82, 0.12, -0.70), width 1.25
    - Reading-nook interior shelves & book paper blocks + 4th book darkWood cover
    - History hanger rod & crossbar at (-1.72, 1.325, -0.40)
    - Shop identity wooden plaque & 5 paper flower petals at (1.38, 1.92, -1.633)
    """
    mc = MeshCollector("home_timber")

    # 1. Pier darkWood shoes & front wood posts
    for side in (-1, 1):
        sx = side * 1.80
        mc.add_beveled_box((sx, 0.431, -1.5375), (0.285, 0.039, 0.675),
                           mats['proc_dark_wood'], bevel=0.004, segments=2)
        front_top = home_roof_height(sx, -1.198) - 0.145
        mc.add_beveled_box((sx, (front_top + 0.325) * 0.5, -1.198), (0.145, front_top - 0.325, 0.085),
                           mats['proc_wood'], bevel=0.006, segments=2)

    # 2. Rear wall darkWood baseboard (spanning cleanly between stone pier bases: x in [-1.66, 1.66]) & reverse cladding
    mc.add_beveled_box((0.0, 0.24, -1.824), (3.32, 0.25, 0.105),
                       mats['proc_dark_wood'], bevel=0.006, segments=2)
    for i in range(16):
        mc.add_beveled_box((-1.65 + i * 0.22, 0.47, -2.151), (0.204, 0.52, 0.047),
                           mats['proc_wood'], bevel=0.004, segments=1)
    mc.add_beveled_box((0.0, 0.76, -2.17), (3.78, 0.084, 0.084),
                       mats['proc_dark_wood'], bevel=0.005, segments=2)

    # 3. Domestic door at x = -1.03, w = 0.73
    door_x, door_w = -1.03, 0.73
    mc.add_beveled_box((door_x, 0.96, -1.819), (door_w + 0.17, 1.84, 0.105),
                       mats['proc_dark_wood'], bevel=0.006, segments=2)
    # Door leaf backing + 6 beveled vertical tongue-and-groove planks
    mc.add_beveled_box((door_x, 0.96, -1.751), (door_w - 0.01, 1.66, 0.052),
                       mats['proc_dark_wood'], bevel=0.002, segments=1)
    n_dp = 6
    pw = door_w / n_dp
    for ip in range(n_dp):
        px = (door_x - door_w * 0.5) + (ip + 0.5) * pw
        tint = (0.98, 0.98, 0.98) if (ip % 2 == 0) else (1.02, 1.02, 1.02)
        mc.add_beveled_box((px, 0.96, -1.746), (pw - 0.002, 1.67, 0.065),
                           mats['proc_wood'], bevel=0.0035, segments=2, color=tint)
    for i in range(5):
        bx = door_x - door_w * 0.38 + i * door_w * 0.19
        mc.add_beveled_box((bx, 1.19, -1.701), (0.024, 0.86, 0.031),
                           mats['proc_dark_wood'], bevel=0.003, segments=2)
    for ry in (0.47, 0.77, 1.61):
        mc.add_beveled_box((door_x, ry, -1.695), (door_w - 0.09, 0.043, 0.029),
                           mats['proc_dark_wood'], bevel=0.003, segments=2)

    # 4. Rounded-arch window frame (cx=0.65, cy=1.27, w=2.04, h=1.36, round=0.57)
    outer_pts = rounded_rect_points(0.65, 1.27, 2.04 + 0.19, 1.36 + 0.19, 0.57 + 0.08, segs_per_corner=16)
    inner_pts = rounded_rect_points(0.65, 1.27, 2.04 - 0.035, 1.36 - 0.035, 0.57 - 0.035, segs_per_corner=16)
    n_f = len(outer_pts)
    z0, z1 = -1.912, -1.724
    fb = 0.015
    f_verts = []
    for i in range(n_f):
        ox, oy = outer_pts[i]
        ix, iy = inner_pts[i]
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
    mc.add_local_mesh(f_verts, f_faces, mats['proc_wood'])

    # Window interior sill, 2 vertical mullions, horizontal transom
    mc.add_beveled_box((0.65, 1.27 - 1.36 * 0.37, -2.076), (2.04 * 0.82, 0.053, 0.071),
                       mats['proc_dark_wood'], bevel=0.004, segments=2)
    for u in (-0.18, 0.18):
        mc.add_beveled_box((0.65 + u * 2.04, 1.27, -1.789), (0.039, 1.36 - 0.07, 0.082),
                           mats['proc_dark_wood'], bevel=0.004, segments=2)
    mc.add_beveled_box((0.65, 1.27 - 0.05, -1.778), (2.04 - 0.09, 0.042, 0.088),
                       mats['proc_dark_wood'], bevel=0.004, segments=2)

    # 5. Exterior sill & window flower box (single unbroken front face on window box, non-overlapping sill wings)
    # Left & right sill wings outside the 1.80m window box (x: -0.52..-0.25 and 1.55..1.82, y: 0.438..0.558, z: -1.875..-1.576)
    for wx in (0.65 - 1.035, 0.65 + 1.035):
        mc.add_beveled_box((wx, 0.498, -1.7255), (0.27, 0.12, 0.299),
                           mats['proc_wood'], bevel=0.006, segments=2)
    # Upper sill ledge behind/above window box (x: -0.25..1.55, y: 0.535..0.558, z: -1.875..-1.576)
    mc.add_beveled_box((0.65, 0.5465, -1.7255), (1.80, 0.023, 0.299),
                       mats['proc_wood'], bevel=0.004, segments=2)
    # Single continuous window flower box at (0.65, 0.44, -1.65), size (1.80, 0.19, 0.26)
    mc.add_beveled_box((0.65, 0.44, -1.65), (1.80, 0.19, 0.26),
                       mats['proc_wood'], bevel=0.006, segments=2)
    # Soil bed sitting cleanly at the base of the window-box herbs (y = 0.560)
    mc.add_beveled_box((0.65, 0.560, -1.64), (1.68, 0.008, 0.16),
                       mats['proc_soil'], bevel=0.002, segments=1)

    # 6. Main roof timber fascia, sub-fascia, attic tie beam, and 13 curved rafters
    width_r = 4.70
    near_r, far_r = -0.74, -3.04
    for z_f in (near_r + 0.025, far_r - 0.025):
        pts_dark = [(-width_r * 0.5 + i * width_r / 24.0, home_roof_height(-width_r * 0.5 + i * width_r / 24.0, z_f) - 0.06, z_f) for i in range(25)]
        pts_wood = [(x, y - 0.076, z) for (x, y, z) in pts_dark]
        mc.add_curved_tube(pts_dark, 0.075, mats['proc_dark_wood'], tubular_segs=28, radial_segs=10)
        mc.add_curved_tube(pts_wood, 0.023, mats['proc_wood'], tubular_segs=28, radial_segs=8)

    pts_tie = [(-1.92 + i * 3.84 / 20.0, home_roof_height(-1.92 + i * 3.84 / 20.0, -1.92) - 0.13, -1.81) for i in range(21)]
    mc.add_curved_tube(pts_tie, 0.042, mats['proc_wood'], tubular_segs=24, radial_segs=8)

    for i in range(13):
        rx = -1.85 + i * 3.70 / 12.0
        pts_rafter = [(rx, home_roof_height(rx, far_r + (near_r - far_r) * j / 7.0) - 0.145, far_r + (near_r - far_r) * j / 7.0) for j in range(8)]
        mc.add_curved_tube(pts_rafter, 0.017, mats['proc_wood'], tubular_segs=16, radial_segs=8)

    # 7. Attached reading-bay pergola (smallCentre = 0.72, smallWidth = 2.08)
    small_centre, small_width = 0.72, 2.08
    pts_pergola_front = [
        (small_centre - small_width * 0.5 + i * small_width / 14.0,
         home_small_roof_height(small_centre - small_width * 0.5 + i * small_width / 14.0, -0.36) - 0.07,
         -0.36)
        for i in range(15)
    ]
    mc.add_curved_tube(pts_pergola_front, 0.053, mats['proc_dark_wood'], tubular_segs=24, radial_segs=10)

    for i in range(9):
        px = small_centre - 0.90 + i * 0.225
        pa = (px, home_small_roof_height(px, -1.57) - 0.045, -1.57)
        pb = (px, home_small_roof_height(px, -0.36) - 0.045, -0.36)
        mc.add_beam(pa, pb, 0.050, mats['proc_wood'], profile='box')

    for sx_p in (-0.18, 1.61):
        pa = (sx_p, 1.97, -1.79)
        pb = (sx_p, home_small_roof_height(sx_p, -0.54) - 0.08, -0.54)
        mc.add_beam(pa, pb, 0.026, mats['proc_wood'], profile='cyl', segs=10)

    # 8. Maru bench wood slats at (0.82, 0.12, -0.70), width = 1.25
    bx, by, bz = 0.82, 0.12, -0.70
    b_width = 1.25
    for i in range(5):
        mc.add_beveled_box((bx, by + 0.48, bz - 0.22 + i * 0.105), (b_width, 0.075, 0.093),
                           mats['proc_wood'], bevel=0.005, segments=2)
    for i in range(3):
        mc.add_beveled_box((bx, by + 0.68 + i * 0.115, bz - 0.29), (b_width, 0.086, 0.065),
                           mats['proc_wood'], rot_euler=(-0.09, 0.0, 0.0), bevel=0.005, segments=2)

    # 9. Home reading-nook shelves & books
    mc.add_beveled_box((0.68, 0.92, -2.055), (1.48, 0.055, 0.065),
                       mats['proc_wood'], bevel=0.004, segments=2)
    mc.add_beveled_box((1.32, 1.19, -2.045), (0.11, 0.49, 0.06),
                       mats['proc_wood'], bevel=0.004, segments=2)
    mc.add_beveled_box((1.07, 1.41, -2.045), (0.58, 0.047, 0.07),
                       mats['proc_wood'], bevel=0.004, segments=2)

    for i in range(4):
        bk_x = 0.22 + i * 0.22
        bk_y = 1.07
        bk_r = (0.0, 0.0, (i - 1.5) * 0.025)
        mc.add_beveled_box((bk_x, bk_y, -2.064), (0.152, 0.22, 0.037),
                           mats['proc_paper'], rot_euler=bk_r, bevel=0.002, segments=1)
        if i == 3:
            for kz in (-2.089, -2.039):
                mc.add_beveled_box((bk_x, bk_y, kz), (0.175, 0.24, 0.008),
                                   mats['proc_dark_wood'], rot_euler=bk_r, bevel=0.001, segments=1)
            mc.add_beveled_box((bk_x - 0.082, bk_y, -2.064), (0.012, 0.24, 0.053),
                               mats['proc_dark_wood'], rot_euler=bk_r, bevel=0.001, segments=1)

    # 10. History hanger at (-1.72, 0.94, -0.40)
    hx, hy, hz = -1.72, 0.94, -0.40
    mount_y = hy + 0.225 + 0.16
    mc.add_beam((hx, mount_y, -1.26), (hx, mount_y, hz), 0.013, mats['proc_dark_wood'], profile='cyl', segs=8)
    mc.add_beveled_box((hx, mount_y, hz), (0.38, 0.027, 0.032), mats['proc_wood'], bevel=0.003, segments=1)

    # 11. Shop identity wooden plaque & 5 paper flower petals at (1.38, 1.92, -1.633)
    mc.add_cylinder((1.38, 1.92, -1.633), 0.165, 0.165, 0.043, mats['proc_wood'],
                    segs=32, rot_euler=(math.pi * 0.5, 0.0, 0.0), bevel=0.004)
    for i in range(5):
        a = i * TAU / 5.0
        mc.add_ellipsoid((1.38 + math.sin(a) * 0.034, 1.92 + math.cos(a) * 0.034, -1.593),
                         (0.024, 0.024, 0.008), mats['proc_paper'], subdivisions=2)

    return mc.build_object(shade_smooth=True)


def build_home_roof(mats):
    """
    Builds home_roof:
    - Main curved slate roof shell (width 4.70, z in [-3.04, -0.74], thickness 0.10)
    - 19 longitudinal standing-seam tile ribs
    - 7 overlapping horizontal ceramic tile courses
    - Reading-bay shallow slate hood (smallCentre = 0.72, smallWidth = 2.08, z in [-1.78, -1.54])
    - Chimney base slate flashing collar at (1.18, 2.68, -2.55)
    """
    mc = MeshCollector("home_roof")
    width = 4.70
    far, near = -3.04, -0.74
    nx, nz = 40, 16
    thickness = 0.10

    # 1. Main curved roof shell
    r_verts = []
    for layer in range(2):
        for ix in range(nx + 1):
            for iz in range(nz + 1):
                x = -width * 0.5 + ix * width / nx
                z = far + iz * (near - far) / nz
                y = home_roof_height(x, z) - layer * thickness
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
        pts = [(rx, home_roof_height(rx, far + (near - far) * j / 7.0) + 0.018, far + (near - far) * j / 7.0) for j in range(8)]
        mc.add_curved_tube(pts, 0.0115, mats['proc_roof_slate'], tubular_segs=20, radial_segs=8)

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
            for z_c, lift in ((back_z, 0.006), (front_z, 0.025 + rib_phase), (front_z + 0.013, 0.007)):
                c_verts.append((x, home_roof_height(x, z_c) + lift, z_c))
        c_faces = []
        for i in range(cols):
            for strip in range(2):
                k = i * 3 + strip
                c_faces.append((k, k + 1, k + 4, k + 3))
        mc.add_local_mesh(c_verts, c_faces, mats['proc_roof_slate'])

    # 4. Reading-bay shallow slate hood (smallCentre = 0.72, smallWidth = 2.08, z in [-1.78, -1.54])
    small_centre, small_width = 0.72, 2.08
    s_far, s_near = -1.78, -1.54
    snx, snz = 24, 6
    s_verts = []
    for layer in range(2):
        for ix in range(snx + 1):
            for iz in range(snz + 1):
                lx = -small_width * 0.5 + ix * small_width / snx
                wx = lx + small_centre
                wz = s_far + iz * (s_near - s_far) / snz
                wy = home_small_roof_height(wx, wz) - layer * thickness
                s_verts.append((wx, wy, wz))
    s_stride = snz + 1
    s_offset = (snx + 1) * s_stride
    s_faces = []
    for ix in range(snx):
        for iz in range(snz):
            k = ix * s_stride + iz
            s_faces.append((k, k + 1, k + s_stride + 1, k + s_stride))
            s_faces.append((k + s_offset, k + s_stride + s_offset, k + s_stride + 1 + s_offset, k + 1 + s_offset))
    for i in range(snx):
        a, b = i * s_stride, (i + 1) * s_stride
        s_faces.append((a, b, b + s_offset, a + s_offset))
        a2, b2 = (i + 1) * s_stride + snz, i * s_stride + snz
        s_faces.append((a2, b2, b2 + s_offset, a2 + s_offset))
    for i in range(snz):
        a, b = i + 1, i
        s_faces.append((a, b, b + s_offset, a + s_offset))
        a2, b2 = snx * s_stride + i, snx * s_stride + i + 1
        s_faces.append((a2, b2, b2 + s_offset, a2 + s_offset))
    mc.add_local_mesh(s_verts, s_faces, mats['proc_roof_slate'])

    # 5. Chimney flashing collar at (1.18, 2.68, -2.55)
    flue_y = home_roof_height(1.18, -2.55)
    mc.add_beveled_box((1.18, flue_y + 0.015, -2.55), (0.32, 0.045, 0.36),
                       mats['proc_roof_slate'], bevel=0.006, segments=2)

    return mc.build_object(shade_smooth=True)


def build_home_cloth(mats):
    """
    Builds home_cloth:
    - Bench plush seat cushion at (0.82, 0.674, -0.70), scale (1.09, 0.075, 0.40)
    - 2 bench arm bolster pillows at (0.31, 0.75, -0.82) & (1.33, 0.75, -0.82), scale (0.12, 0.075, 0.29)
    - Window interior folded curtains at (0.65 +- 0.714, 1.27, -2.054)
    - Cloth book covers on reading-nook shelf (coral, lapis, white cloth)
    - History hanger cords at (-1.72 +- 0.13, 1.325..1.177, -0.40)
    """
    mc = MeshCollector("home_cloth")

    # 1. Bench seat cushion & 2 arm bolster pillows
    mc.add_pillow((0.82, 0.6755, -0.70), (1.09, 0.075, 0.40), mats['proc_cotton_white'])
    for px in (0.31, 1.33):
        mc.add_pillow((px, 0.752, -0.82), (0.12, 0.075, 0.29), mats['proc_cotton_white'])

    # 2. Window interior folded curtains (o = {x: 0.65, y: 1.27, w: 2.04, h: 1.36})
    w_o, h_o = 2.04, 1.36
    for side in (-1, 1):
        cx_c = 0.65 + side * w_o * 0.35
        cy_c = 1.27
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
        mc.add_local_mesh(c_verts, c_faces, mats['proc_cotton_white'])

    # 3. Cloth book covers (i = 0: coral, i = 1: lapis, i = 2: white cotton)
    cover_mats = [mats['proc_coral'], mats['proc_cotton_lapis'], mats['proc_cotton_white']]
    for i in range(3):
        bk_x = 0.22 + i * 0.22
        bk_y = 1.07
        bk_r = (0.0, 0.0, (i - 1.5) * 0.025)
        cmat = cover_mats[i]
        for kz in (-2.089, -2.039):
            mc.add_beveled_box((bk_x, bk_y, kz), (0.175, 0.24, 0.008),
                               cmat, rot_euler=bk_r, bevel=0.001, segments=1)
        mc.add_beveled_box((bk_x - 0.082, bk_y, -2.064), (0.012, 0.24, 0.053),
                           cmat, rot_euler=bk_r, bevel=0.001, segments=1)

    # 4. History hanger cords at (-1.72, 0.94, -0.40)
    hx, hy, hz = -1.72, 0.94, -0.40
    top_h = hy + 0.225
    mount_y = top_h + 0.16
    for side in (-1, 1):
        mc.add_beam((hx + side * 0.13, mount_y, hz), (hx + side * 0.13, top_h + 0.012, hz),
                    0.005, mats['proc_cotton_white'], profile='cyl', segs=6)

    return mc.build_object(shade_smooth=True)


def build_home_props(mats):
    """
    Builds home_props:
    - Coral enamel mailbox body, ceramic top cap, darkWood slot, brass lock at (-1.80, 0.92, -1.12)
    - Bench metal legs, backrest posts, and 4 brass rivets at (0.82, 0.12, -0.70)
    - Wall lantern metal bracket, top/bottom caps, and warm butter globe at (-0.23, 1.59, -1.56)
    - Front pier brass collars at (+-1.80, y, -1.20)
    - Door brass knob at (-1.03 + 0.73*0.30, 0.88, -1.674)
    - Shop identity plaque brass outer ring & brass flower stamen at (1.38, 1.92, -1.603)
    """
    mc = MeshCollector("home_props")

    # 1. Coral enamel mailbox at (-1.80, 0.92, -1.12)
    mc.add_beveled_box((-1.80, 0.92, -1.12), (0.26, 0.31, 0.16),
                       mats['proc_coral'], bevel=0.008, segments=2)
    mc.add_beveled_box((-1.80, 1.09, -1.12), (0.28, 0.055, 0.18),
                       mats['proc_ceramic'], bevel=0.006, segments=2)
    mc.add_beveled_box((-1.80, 0.99, -1.031), (0.15, 0.014, 0.008),
                       mats['proc_dark_wood'], bevel=0.001, segments=1)
    mc.add_ellipsoid((-1.80, 0.84, -1.027), (0.012, 0.012, 0.010),
                     mats['proc_brass'], subdivisions=2)

    # 2. Bench metal legs, backrest posts, and 4 brass rivets
    bx, by, bz = 0.82, 0.12, -0.70
    b_width = 1.25
    for lx in (-b_width * 0.36, b_width * 0.36):
        mc.add_beveled_box((bx + lx, by + 0.28, bz), (0.068, 0.51, 0.50),
                           mats['proc_metal'], bevel=0.005, segments=2)
        mc.add_beveled_box((bx + lx, by + 0.64, bz - 0.27), (0.055, 0.53, 0.055),
                           mats['proc_metal'], rot_euler=(-0.09, 0.0, 0.0), bevel=0.004, segments=2)
        for rz in (-0.18, 0.16):
            mc.add_ellipsoid((bx + lx, by + 0.522, bz + rz), (0.014, 0.005, 0.014),
                             mats['proc_brass'], subdivisions=2)

    # 3. Wall lantern at x = -0.23
    lx = -0.23
    mc.add_beveled_box((lx, 1.74, -1.71), (0.11, 0.08, 0.25),
                       mats['proc_metal'], bevel=0.004, segments=2)
    for ly in (1.46, 1.72):
        mc.add_beveled_box((lx, ly, -1.56), (0.17, 0.039, 0.17),
                           mats['proc_metal'], bevel=0.004, segments=2)
    mc.add_ellipsoid((lx, 1.59, -1.56), (0.078, 0.136, 0.078),
                     mats['proc_butter'], subdivisions=3)

    # 4. Front pier brass collars
    for side in (-1, 1):
        sx = side * 1.80
        front_top = home_roof_height(sx, -1.198) - 0.145
        for cy in (0.50, front_top - 0.12):
            mc.add_beveled_box((sx, cy, -1.20), (0.277, 0.058, 0.094),
                               mats['proc_brass'], bevel=0.004, segments=2)

    # 5. Door brass knob
    mc.add_ellipsoid((-1.03 + 0.73 * 0.30, 0.88, -1.674), (0.036, 0.036, 0.030),
                     mats['proc_brass'], subdivisions=2)

    # 6. Shop identity plaque brass ring & flower center
    mc.add_torus((1.38, 1.92, -1.603), 0.145, 0.008, mats['proc_brass'], major_segs=32, minor_segs=8)
    mc.add_ellipsoid((1.38, 1.92, -1.580), (0.020, 0.020, 0.009),
                     mats['proc_brass'], subdivisions=2)

    return mc.build_object(shade_smooth=True)


def build_home_foliage(mats):
    """
    Builds home_foliage:
    - Window box 5 herb & flower clusters at x = 0.65 - 1.80*0.37 + i*1.80*0.185, y = 0.55, z = -1.64
      with stems, botanical leaves, and pink (#e4bac4) 5-petal blossoms + golden (#d9b771) buds.
    """
    mc = MeshCollector("home_foliage")
    rng = make_rng(91423)
    c_dark = hex_to_linear('#496345')
    c_light = hex_to_linear('#a3ae69')
    c_bloom = hex_to_linear('#e4bac4')
    c_bud = hex_to_linear('#d9b771')

    def build_leaf_template(rows, cols, thick=0.004):
        lv, lf = [], []
        for layer in range(2):
            dz_l = (0.5 - layer) * thick
            for j in range(rows + 1):
                v = j / rows
                for i in range(cols + 1):
                    u = (i / cols) * 2.0 - 1.0
                    w = (math.sin(v * math.pi) ** 0.74) * (1.15 - 0.31 * v)
                    lx = u * 0.22 * w * (1.0 + u * 0.075) + math.sin(v * math.pi) * 0.018
                    ly = v + abs(u) * math.sin(v * math.pi) * 0.025
                    lz = math.sin(v * math.pi) * (0.10 - 0.075 * u * u) + v * v * 0.065 + dz_l
                    lv.append((lx, ly, lz))
        stride = cols + 1
        off = (rows + 1) * stride
        for j in range(rows):
            for i in range(cols):
                k = j * stride + i
                lf.append((k, k + 1, k + stride + 1, k + stride))
                lf.append((k + off, k + stride + off, k + stride + 1 + off, k + 1 + off))
        return lv, lf

    leaf_v, leaf_f = build_leaf_template(5, 3, thick=0.004)
    petal_v, petal_f = build_leaf_template(4, 3, thick=0.003)

    wb_x, wb_y, wb_z = 0.65, 0.564, -1.64
    wb_w = 1.80
    scale = 0.50
    count = 7

    for cluster_idx in range(5):
        px = wb_x - wb_w * 0.37 + cluster_idx * wb_w * 0.185
        py, pz = wb_y, wb_z
        for i in range(count):
            angle = i * 2.399 + rng()
            radius = math.sqrt(rng()) * 0.19 * scale
            h = (0.12 + rng() * 0.20) * scale
            sx = px + math.sin(angle) * radius
            sz = pz + math.cos(angle) * radius
            mc.add_beam((sx, py, sz), (sx, py + h, sz), 0.006 * scale, mats['proc_stem'], profile='cyl', segs=5)
            for j in range(3):
                rx = 0.88 + rng() * 0.52
                ry = angle + j * 2.2
                rot = Euler((rx, ry, 0.0), 'XYZ').to_matrix().to_4x4()
                sc = Vector((0.43 * scale, 0.20 * scale, 0.43 * scale))
                origin = Vector((sx, py + h * (0.25 + j * 0.25), sz))
                l_col = lerp_color(c_dark, c_light, rng())
                tv = []
                for lv in leaf_v:
                    p = rot @ Vector((lv[0] * sc.x, lv[1] * sc.y, lv[2] * sc.z))
                    tv.append((origin.x + p.x, origin.y + p.y, origin.z + p.z))
                mc.add_local_mesh(tv, leaf_f, mats['proc_foliage'], color=l_col)

            if i % 2 == 0:
                mc.add_ellipsoid((sx, py + h + 0.007, sz), (0.019 * scale, 0.020 * scale, 0.019 * scale),
                                 mats['proc_flowers'], subdivisions=1, color=c_bud)
                for j in range(5):
                    a = j * TAU / 5.0
                    rot_p = Euler((1.23, a, 0.0), 'XYZ').to_matrix().to_4x4()
                    sc_p = Vector((0.12 * scale, 0.058 * scale, 0.12 * scale))
                    orig_p = Vector((sx + math.sin(a) * 0.005, py + h, sz + math.cos(a) * 0.005))
                    pv = []
                    for lv in petal_v:
                        p = rot_p @ Vector((lv[0] * sc_p.x, lv[1] * sc_p.y, lv[2] * sc_p.z))
                        pv.append((orig_p.x + p.x, orig_p.y + p.y, orig_p.z + p.z))
                    mc.add_local_mesh(pv, petal_f, mats['proc_flowers'], color=c_bloom)

    return mc.build_object(shade_smooth=True)


def build_home_glass(mats):
    """
    Builds home_glass:
    - Rounded-arch window glass pane at local (0.65, 1.27, -1.976), size 2.015 x 1.335, r = 0.57
    - Uses live_glass material (no lightmap bake)
    """
    mc = MeshCollector("home_glass")
    pts = rounded_rect_points(0.65, 1.27, 2.015, 1.335, 0.57, segs_per_corner=16)
    verts = [(0.65, 1.27, -1.976)] + [(px, py, -1.976) for px, py in pts]
    faces = [(0, 1 + i, 1 + (i + 1) % len(pts)) for i in range(len(pts))]
    mc.add_local_mesh(verts, faces, mats['live_glass'])
    return mc.build_object(shade_smooth=True)


def build_all_home_meshes(mats):
    tune_home_materials(mats)
    objs = {
        'home_maru': build_home_maru(mats),
        'home_wall': build_home_wall(mats),
        'home_timber': build_home_timber(mats),
        'home_roof': build_home_roof(mats),
        'home_cloth': build_home_cloth(mats),
        'home_props': build_home_props(mats),
        'home_foliage': build_home_foliage(mats),
        'home_glass': build_home_glass(mats),
    }
    return objs

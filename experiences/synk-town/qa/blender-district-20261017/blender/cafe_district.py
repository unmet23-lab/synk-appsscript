# SYNK Town cafe district, Blender build + bake + export (Claude test, 2026-10-17).
#
#   blender -b -P cafe_district.py -- --stage build  --work <dir> --ref <dir> --sky <jpg>
#   blender -b -P cafe_district.py -- --stage bake   --work <dir> [--samples 1024]
#   blender -b -P cafe_district.py -- --stage export --work <dir> --out <glb>
#
# Geometry is written in Town coordinates (metres, +Y up, the same numbers as
# experiences/synk-town/day-environment.mjs) and converted once to Blender
# (+Z up): Blender (x, y, z) = Town (x, -z, y). Spec: ../자산규격.md.
import bpy, bmesh, math, random, json, sys, os, time
import numpy as np
from mathutils import Vector, Matrix, Euler

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return ARGV[ARGV.index(name) + 1] if name in ARGV else default
STAGE = arg('--stage', 'build')
WORK = os.path.abspath(arg('--work', '.'))
os.makedirs(WORK, exist_ok=True)
TAU = math.pi * 2
C4 = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # Town -> Blender
BOUNDS = dict(minX=-3.0, maxX=3.0, minZ=-3.4, maxZ=5.35)
GROUND_ROOT = .20
LAWN_Y = GROUND_ROOT - .125          # terrainHeight inside the flat meadow
COURT_Y = GROUND_ROOT - .097
GROUPS = {'ground': 2048, 'house': 2048, 'roof': 2048, 'props': 2048}
ANGLE_LIMIT = float(arg('--angle', '72'))

def log(*a):
    print('[cafe]', *a, flush=True)

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c]
def mul(a, b): return [x * y for x, y in zip(a, b)]
def scale(a, k): return [x * k for x in a]
def lerp(a, b, t): return [x + (y - x) * t for x, y in zip(a, b)]

# ---------------------------------------------------------------- materials
WOOD_TEX = [204 / 255 * .957, 168 / 255 * .957, 119 / 255 * .957]
WOOD_TEX = [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in WOOD_TEX]
PAL = {
    'wood': WOOD_TEX,
    'darkWood': mul(srgb('#8c7d6e'), WOOD_TEX),
    'plaster': mul(srgb('#f4f5f1'), srgb('#faf8f2')),
    'roof': mul(srgb('#344b64'), srgb('#f9fafb')),
    'stone': srgb('#e4e6e1'),
    'paving': mul(srgb('#eef0ed'), srgb('#e4e6e1')),
    'mortar': srgb('#b8beb5'),
    'gravel': srgb('#d8ceba'),
    'ceramic': srgb('#fcfbf6'),
    'metal': srgb('#46564d'),
    'brass': srgb('#baa17d'),
    'paper': srgb('#fbf8ef'),
    'cotton': srgb('#f7f5ee'),
    'lapis': srgb('#3d6bc9'),
    'butter': srgb('#f5c445'),
    'backing': srgb('#433f36'),
    'interior': srgb('#897b64'),
    'tea': srgb('#875e35'),
    'soil': srgb('#66553e'),
    'leaf': srgb('#5f7a4f'),
    'stem': srgb('#536143'),
    'lawn': [1, 1, 1],
}

def node(nt, kind, loc=(0, 0), **props):
    n = nt.nodes.new(kind); n.location = loc
    for k, v in props.items(): setattr(n, k, v)
    return n

def make_material(name, kind, color, rough=.85):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear()
    out = node(nt, 'ShaderNodeOutputMaterial', (900, 0))
    bsdf = node(nt, 'ShaderNodeBsdfPrincipled', (600, 0))
    bsdf.inputs['Roughness'].default_value = rough
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    tint = node(nt, 'ShaderNodeVertexColor', (-600, 300)); tint.layer_name = 'tint'
    base = node(nt, 'ShaderNodeRGB', (-600, 120)); base.outputs[0].default_value = (*color, 1)
    mix = node(nt, 'ShaderNodeMix', (-300, 200)); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1
    nt.links.new(base.outputs[0], mix.inputs[6]); nt.links.new(tint.outputs['Color'], mix.inputs[7])
    col = mix.outputs[2]
    coord = node(nt, 'ShaderNodeTexCoord', (-1200, 0))
    pos = coord.outputs['Object']
    bump_h = None
    if kind.startswith('wood'):
        axis = {'woodx': 'X', 'woody': 'Z', 'woodz': 'Y'}.get(kind, 'X')
        # Grain runs along the board; rings vary across it.
        mapping = node(nt, 'ShaderNodeMapping', (-1000, 0))
        rot = {'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}[axis]
        mapping.inputs['Rotation'].default_value = rot
        mapping.inputs['Scale'].default_value = (1, 1, 1)
        nt.links.new(pos, mapping.inputs['Vector'])
        wave = node(nt, 'ShaderNodeTexWave', (-800, 0)); wave.wave_type = 'RINGS'; wave.rings_direction = 'Z'
        wave.inputs['Scale'].default_value = 7.5; wave.inputs['Distortion'].default_value = 6.0
        wave.inputs['Detail'].default_value = 3; wave.inputs['Detail Scale'].default_value = 1.4
        nt.links.new(mapping.outputs['Vector'], wave.inputs['Vector'])
        noise = node(nt, 'ShaderNodeTexNoise', (-800, -250)); noise.inputs['Scale'].default_value = 3.5
        nt.links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
        ramp = node(nt, 'ShaderNodeMapRange', (-550, 0))
        ramp.inputs['From Min'].default_value = 0; ramp.inputs['From Max'].default_value = 1
        ramp.inputs['To Min'].default_value = .90; ramp.inputs['To Max'].default_value = 1.05
        nt.links.new(wave.outputs['Fac'], ramp.inputs['Value'])
        m2 = node(nt, 'ShaderNodeMix', (0, 100)); m2.data_type = 'RGBA'; m2.blend_type = 'MULTIPLY'; m2.inputs['Factor'].default_value = 1
        nt.links.new(col, m2.inputs[6])
        grey = node(nt, 'ShaderNodeCombineXYZ', (-300, -100))
        for k in 'XYZ': nt.links.new(ramp.outputs['Result'], grey.inputs[k])
        nt.links.new(grey.outputs[0], m2.inputs[7]); col = m2.outputs[2]
        bump_h = wave.outputs['Fac']; bump_strength = .06
    elif kind in ('plaster', 'stone', 'paving', 'cotton', 'gravel', 'roof', 'lawn', 'mortar'):
        noise = node(nt, 'ShaderNodeTexNoise', (-800, 0))
        noise.inputs['Scale'].default_value = {'plaster': 38, 'stone': 22, 'paving': 9, 'cotton': 140, 'gravel': 90, 'roof': 30, 'lawn': 60, 'mortar': 40}[kind]
        noise.inputs['Detail'].default_value = 8
        nt.links.new(pos, noise.inputs['Vector'])
        broad = node(nt, 'ShaderNodeTexNoise', (-800, -260)); broad.inputs['Scale'].default_value = 1.2
        nt.links.new(pos, broad.inputs['Vector'])
        amp = {'plaster': .035, 'stone': .07, 'paving': .05, 'cotton': .03, 'gravel': .12, 'roof': .06, 'lawn': .16, 'mortar': .06}[kind]
        mr = node(nt, 'ShaderNodeMapRange', (-550, 0))
        mr.inputs['From Min'].default_value = .3; mr.inputs['From Max'].default_value = .7
        mr.inputs['To Min'].default_value = 1 - amp; mr.inputs['To Max'].default_value = 1 + amp * .4
        nt.links.new(noise.outputs['Fac'], mr.inputs['Value'])
        mb = node(nt, 'ShaderNodeMapRange', (-550, -260))
        mb.inputs['From Min'].default_value = .35; mb.inputs['From Max'].default_value = .65
        mb.inputs['To Min'].default_value = 1 - amp * .5; mb.inputs['To Max'].default_value = 1 + amp * .2
        nt.links.new(broad.outputs['Fac'], mb.inputs['Value'])
        mm = node(nt, 'ShaderNodeMath', (-300, -100)); mm.operation = 'MULTIPLY'
        nt.links.new(mr.outputs['Result'], mm.inputs[0]); nt.links.new(mb.outputs['Result'], mm.inputs[1])
        grey = node(nt, 'ShaderNodeCombineXYZ', (-150, -100))
        for k in 'XYZ': nt.links.new(mm.outputs[0], grey.inputs[k])
        if kind == 'lawn':
            # Fine mown streaks with warm and cool blades over the terrain colour.
            streak = node(nt, 'ShaderNodeTexNoise', (-800, -520)); streak.inputs['Scale'].default_value = 260
            mp = node(nt, 'ShaderNodeMapping', (-1000, -520)); mp.inputs['Scale'].default_value = (1, 6, 1)
            nt.links.new(pos, mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], streak.inputs['Vector'])
            sr = node(nt, 'ShaderNodeMapRange', (-550, -520)); sr.inputs['To Min'].default_value = .86; sr.inputs['To Max'].default_value = 1.10
            sr.inputs['From Min'].default_value = .35; sr.inputs['From Max'].default_value = .65
            nt.links.new(streak.outputs['Fac'], sr.inputs['Value'])
            mm2 = node(nt, 'ShaderNodeMath', (-300, -300)); mm2.operation = 'MULTIPLY'
            nt.links.new(mm.outputs[0], mm2.inputs[0]); nt.links.new(sr.outputs['Result'], mm2.inputs[1])
            for k in 'XYZ': nt.links.new(mm2.outputs[0], grey.inputs[k])
        m2 = node(nt, 'ShaderNodeMix', (0, 100)); m2.data_type = 'RGBA'; m2.blend_type = 'MULTIPLY'; m2.inputs['Factor'].default_value = 1
        nt.links.new(col, m2.inputs[6]); nt.links.new(grey.outputs[0], m2.inputs[7]); col = m2.outputs[2]
        bump_h = noise.outputs['Fac']; bump_strength = {'plaster': .08, 'stone': .18, 'paving': .05, 'cotton': .12, 'gravel': .35, 'roof': .10, 'lawn': .25, 'mortar': .1}[kind]
    if kind == 'butter':
        bsdf.inputs['Emission Color'].default_value = (*color, 1); bsdf.inputs['Emission Strength'].default_value = .35
    nt.links.new(col, bsdf.inputs['Base Color'])
    if bump_h is not None:
        bump = node(nt, 'ShaderNodeBump', (300, -300)); bump.inputs['Strength'].default_value = bump_strength
        bump.inputs['Distance'].default_value = .02
        nt.links.new(bump_h, bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat

MATERIALS = {}
def mat(key):
    # key: palette name, optionally wood axis suffix ('wood:x')
    if key in MATERIALS: return MATERIALS[key]
    base, _, axis = key.partition(':')
    kind = {'wood': 'wood' + (axis or 'x'), 'darkWood': 'wood' + (axis or 'x'), 'plaster': 'plaster', 'stone': 'stone', 'paving': 'paving',
            'cotton': 'cotton', 'gravel': 'gravel', 'roof': 'roof', 'lawn': 'lawn', 'mortar': 'mortar', 'butter': 'butter'}.get(base, 'plain')
    rough = {'wood': .76, 'darkWood': .86, 'plaster': .92, 'stone': .94, 'paving': .88, 'roof': .84, 'cotton': .95, 'ceramic': .23,
             'metal': .4, 'brass': .33, 'paper': .94, 'mortar': 1, 'gravel': .98, 'lawn': .95, 'lapis': .95, 'butter': .6, 'backing': .91, 'interior': .94, 'tea': .22, 'leaf': .73, 'stem': .91, 'soil': 1}.get(base, .88)
    MATERIALS[key] = make_material('src_' + key.replace(':', '_'), kind, PAL[base], rough)
    return MATERIALS[key]

# ---------------------------------------------------------------- mesh builder
class Part:
    """One Blender object per (group, material). Geometry in Town space."""
    def __init__(self, group, key):
        self.group, self.key = group, key
        self.bm = bmesh.new(); self.bm.loops.layers.float_color.new('tint')
    def finish(self):
        me = bpy.data.meshes.new(f'{self.group}__{self.key}')
        self.bm.normal_update(); self.bm.to_mesh(me); self.bm.free()
        me.transform(C4)
        obj = bpy.data.objects.new(me.name, me)
        obj.data.materials.append(mat(self.key))
        obj['group'] = self.group
        bpy.data.collections['district'].objects.link(obj)
        for p in me.polygons: p.use_smooth = True
        try: me.set_sharp_from_angle(angle=math.radians(38))
        except Exception: pass
        return obj

PARTS = {}
def part(group, key):
    k = (group, key)
    if k not in PARTS: PARTS[k] = Part(group, key)
    return PARTS[k]

def paint(bm, layer, faces, color):
    c = (*color, 1) if color is not None else (1, 1, 1, 1)
    for f in faces:
        for l in f.loops: l[layer] = c

def merge_into(p, bm_src, matrix, tint=None):
    """Copy bm_src transformed by matrix (Town space) into part p."""
    bm_src.transform(matrix)
    keep_colors = bm_src.loops.layers.float_color.get('tint') is not None
    me = bpy.data.meshes.new('tmp'); bm_src.to_mesh(me); bm_src.free()
    p.bm.faces.ensure_lookup_table(); before = len(p.bm.faces)
    p.bm.from_mesh(me); bpy.data.meshes.remove(me)
    p.bm.faces.ensure_lookup_table()
    new_faces = [p.bm.faces[i] for i in range(before, len(p.bm.faces))]
    if not keep_colors: paint(p.bm, p.bm.loops.layers.float_color['tint'], new_faces, tint)
    return new_faces

def trs(pos=(0, 0, 0), rot=(0, 0, 0), size=(1, 1, 1)):
    # three.js Euler 'XYZ' == matrix Rx*Ry*Rz == Blender Euler order 'ZYX'.
    return Matrix.Translation(Vector(pos)) @ Euler(rot, 'ZYX').to_matrix().to_4x4() @ Matrix.Diagonal((*size, 1))

def box(group, key, pos, size, rot=(0, 0, 0), tint=None, bevel=None):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    sx, sy, sz = size
    # Bevel in true metres: scale first, then round the edges.
    bm.transform(Matrix.Diagonal((sx, sy, sz, 1)))
    w = bevel if bevel is not None else min(.012, .22 * min(size))
    if w > .0008:
        bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges), offset=w, segments=2, profile=.5, affect='EDGES', clamp_overlap=True)
    return merge_into(part(group, key), bm, trs(pos, rot), tint)

def cylinder(group, key, pos, r_top, r_bottom, height, segs=20, rot=(0, 0, 0), size=(1, 1, 1), tint=None, caps=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, segments=segs, radius1=r_bottom, radius2=r_top, depth=height)
    # create_cone is along Z; Town cylinders are along Y.
    bm.transform(Matrix.Rotation(-math.pi / 2, 4, 'X'))
    return merge_into(part(group, key), bm, trs(pos, rot, size), tint)

def sphere(group, key, pos, size, segs=16, rings=10, rot=(0, 0, 0), tint=None):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1)
    return merge_into(part(group, key), bm, trs(pos, rot, size), tint)

def lathe(group, key, profile, segs, pos, size=(1, 1, 1), tint=None):
    bm = bmesh.new(); rings = []
    for i in range(segs):
        a = i / segs * TAU
        rings.append([bm.verts.new((r * math.sin(a), y, r * math.cos(a))) for r, y in profile])
    for i in range(segs):
        a, b = rings[i], rings[(i + 1) % segs]
        for j in range(len(profile) - 1):
            try: bm.faces.new((a[j], a[j + 1], b[j + 1], b[j]))
            except ValueError: pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return merge_into(part(group, key), bm, trs(pos, (0, 0, 0), size), tint)

def catmull(points, n):
    """THREE.CatmullRomCurve3(points).getPoint(i/n): centripetal, open ends."""
    pts = [Vector(p) for p in points]
    if len(pts) == 2: return [pts[0].lerp(pts[1], i / n) for i in range(n + 1)]
    l = len(pts); out = []
    for i in range(n + 1):
        p = (l - 1) * i / n; k = int(math.floor(p)); w = p - k
        if w == 0 and k == l - 1: k = l - 2; w = 1
        p0 = pts[k - 1] if k > 0 else (pts[0] - pts[1]) + pts[0]
        p1, p2 = pts[k], pts[min(k + 1, l - 1)]
        p3 = pts[k + 2] if k + 2 < l else (pts[l - 1] - pts[l - 2]) + pts[l - 1]
        dt0 = (p1 - p0).length_squared ** .25; dt1 = (p2 - p1).length_squared ** .25; dt2 = (p3 - p2).length_squared ** .25
        if dt1 < 1e-4: dt1 = 1.0
        if dt0 < 1e-4: dt0 = dt1
        if dt2 < 1e-4: dt2 = dt1
        res = Vector((0, 0, 0))
        for a in range(3):
            x0, x1, x2, x3 = p0[a], p1[a], p2[a], p3[a]
            t1 = ((x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1) * dt1
            t2 = ((x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2) * dt1
            c2 = -3 * x1 + 3 * x2 - 2 * t1 - t2; c3 = 2 * x1 - 2 * x2 + t1 + t2
            res[a] = x1 + t1 * w + c2 * w * w + c3 * w * w * w
        out.append(res)
    return out

def tube(group, key, points, radius, sides=8, segs=24, tint=None, caps=True):
    path = catmull(points, segs)
    bm = bmesh.new(); rings = []
    for i, p in enumerate(path):
        t = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        ref = Vector((0, 1, 0)) if abs(t.y) < .9 else Vector((1, 0, 0))
        n1 = t.cross(ref).normalized(); n2 = t.cross(n1).normalized()
        rings.append([bm.verts.new(p + (n1 * math.cos(a) + n2 * math.sin(a)) * radius) for a in [j / sides * TAU for j in range(sides)]])
    for i in range(len(rings) - 1):
        for j in range(sides):
            bm.faces.new((rings[i][j], rings[i][(j + 1) % sides], rings[i + 1][(j + 1) % sides], rings[i + 1][j]))
    if caps:
        bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return merge_into(part(group, key), bm, Matrix.Identity(4), tint)

def beam(group, key, a, b, width, sides=8, tint=None, square=False):
    if square:
        a, b = Vector(a), Vector(b); d = b - a
        q = Vector((0, 1, 0)).rotation_difference(d.normalized())
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
        bm.transform(Matrix.Diagonal((width, d.length, width, 1)))
        w = min(.01, .2 * width)
        bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges), offset=w, segments=2, profile=.5, affect='EDGES', clamp_overlap=True)
        return merge_into(part(group, key), bm, Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), tint)
    return tube(group, key, [a, b], width * .5 if width > .05 else width, sides=sides, segs=1, tint=tint)

def grid(group, key, fn, nu, nv, tint=None, double=False, facing=None):
    bm = bmesh.new()
    vs = [[bm.verts.new(fn(i / nu, j / nv)) for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
    if facing is not None:
        bm.normal_update(); fv = Vector(facing)
        for f in bm.faces:
            if f.normal.dot(fv) < 0: f.normal_flip()
    if double:
        # Two explicit layers: the grid as built, and a copy 6 mm behind it with
        # reversed winding. (solidify + recalc flipped some faces of thin cloth,
        # which then baked dark, facing into the gap.)
        bm.normal_update(); front = list(bm.faces); twin = {}
        for v in list(bm.verts): twin[v] = bm.verts.new(v.co - v.normal * .006)
        for f in front: bm.faces.new([twin[v] for v in reversed(f.verts)])
    return merge_into(part(group, key), bm, Matrix.Identity(4), tint)

def rounded_rect(x, y, w, h, r, n=8):
    pts = []; l, rr, b, t = x - w / 2, x + w / 2, y - h / 2, y + h / 2
    for cx, cy, a0 in ((rr - r, b + r, -math.pi / 2), (rr - r, t - r, 0), (l + r, t - r, math.pi / 2), (l + r, b + r, math.pi)):
        for i in range(n + 1):
            a = a0 + i / n * math.pi / 2; pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def extrude_shape(group, key, outer, holes, z0, depth, bevel=0.0, tint=None):
    """Planar Town XY outline (+holes) extruded along +Z from z0 by depth."""
    cu = bpy.data.curves.new('shape', 'CURVE'); cu.dimensions = '2D'; cu.fill_mode = 'BOTH'
    for loop in [outer] + holes:
        sp = cu.splines.new('POLY'); sp.points.add(len(loop) - 1)
        for p, (x, y) in zip(sp.points, loop): p.co = (x, y, 0, 1)
        sp.use_cyclic_u = True
    cu.extrude = depth / 2 - bevel; cu.bevel_depth = bevel; cu.bevel_resolution = 2 if bevel else 0
    ob = bpy.data.objects.new('shape', cu); bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob); bpy.data.curves.remove(cu)
    bm = bmesh.new(); bm.from_mesh(me); bpy.data.meshes.remove(me)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    return merge_into(part(group, key), bm, Matrix.Translation((0, 0, z0 + depth / 2)), tint)

def poly_fill(group, key, loop, y, tint=None):
    bm = bmesh.new(); vs = [bm.verts.new((x, y, z)) for x, z in loop]
    f = bm.faces.new(vs)
    if f.normal.y < 0: f.normal_flip()
    bmesh.ops.triangulate(bm, faces=[f], quad_method='BEAUTY', ngon_method='BEAUTY')
    return merge_into(part(group, key), bm, Matrix.Identity(4), tint)

# ---------------------------------------------------------------- v20 functions (ported)
def cafe_roof_h(x, z, width=5.26):
    u = x / (width * .5); front = (z + 3.04) / 2.39
    return 3.22 - .72 * abs(u) ** 1.46 + .22 * abs(u) ** 7 + .13 * front ** 5

def rnd_factory(seed):
    state = [seed]
    def rnd():
        state[0] = (1664525 * state[0] + 1013904223) & 0xffffffff
        return state[0] / 4294967296
    return rnd

def field(x, z, cx, cz, rx, rz): return math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2))
def terrain_color(x, z):
    patch = .50 + .18 * math.sin(x * .33 + math.sin(z * .31) * 1.8) + .15 * math.cos(z * .54 - math.sin(x * .22)) + .11 * math.sin(x * 1.12 + z * .57)
    meadow = max(field(x, z, -17, 1, 9.3, 8.5), field(x, z, 17, -4, 8.5, 7), field(x, z, -5, 10, 10, 4), field(x, z, 7, -18, 10, 5))
    grove = max(field(x, z, -10.5, -6.5, 3.8, 6), field(x, z, 10.6, -8, 4.5, 5), field(x, z, -3, -13, 5.5, 3))
    # three.Color.lerp works on linear values.
    c = lerp(srgb('#72956e'), srgb('#a4b981'), patch * .62)
    c = lerp(c, srgb('#bdc38c'), meadow * .62)
    c = lerp(c, srgb('#5f887c'), grove * .41)
    return c

def bezier(p0, p1, p2, p3, n=24):
    return [(((1 - t) ** 3) * p0[0] + 3 * ((1 - t) ** 2) * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t ** 3 * p3[0],
             ((1 - t) ** 3) * p0[1] + 3 * ((1 - t) ** 2) * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t ** 3 * p3[1]) for t in [i / n for i in range(1, n + 1)]]

def court_outline():
    pts = [(-9.45, 1.12)]
    segs = [((-9.40, .42), (-7.28, .39), (-6.22, .48)), ((-4.06, .62), (-2.80, .73), (-.42, .60)), ((2.21, .44), (4.37, .55), (6.13, .50)),
            ((8.61, .31), (9.40, .72), (9.48, 1.37))]
    for c1, c2, end in segs: pts += bezier(pts[-1], c1, c2, end)
    pts.append((9.40, 4.10))
    for c1, c2, end in [((9.21, 4.86), (7.30, 5.01), (5.74, 4.94)), ((3.32, 4.81), (2.33, 5.13), (.12, 5.18)), ((-2.51, 5.23), (-3.89, 4.83), (-6.16, 4.92)), ((-8.82, 5.09), (-9.42, 4.83), (-9.48, 4.10))]:
        pts += bezier(pts[-1], c1, c2, end)
    return pts

def clip_polygon_rect(poly, b):
    def clip(pts, inside, inter):
        out = []
        for i in range(len(pts)):
            cur, prev = pts[i], pts[i - 1]
            if inside(cur):
                if not inside(prev): out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev): out.append(inter(prev, cur))
        return out
    def ix(xv):
        return lambda a, c: (xv, a[1] + (c[1] - a[1]) * (xv - a[0]) / (c[0] - a[0]))
    def iz(zv):
        return lambda a, c: (a[0] + (c[0] - a[0]) * (zv - a[1]) / (c[1] - a[1]), zv)
    pts = poly
    pts = clip(pts, lambda p: p[0] >= b['minX'], ix(b['minX']))
    pts = clip(pts, lambda p: p[0] <= b['maxX'], ix(b['maxX']))
    pts = clip(pts, lambda p: p[1] >= b['minZ'], iz(b['minZ']))
    pts = clip(pts, lambda p: p[1] <= b['maxZ'], iz(b['maxZ']))
    return pts

def ribbon(group, key, points, width, y, n=48, tint=None, uniform=False):
    # day-environment.mjs groundRibbon(): 48 samples, gently varying width.
    path = catmull([(x, 0, z) for x, z in points], 4800)
    rows = []
    for i in range(n + 1):
        t = i / n; p = path[i * 100]
        tan = (path[min(i * 100 + 1, 4800)] - path[max(i * 100 - 1, 0)]).normalized()
        w = width if uniform else width * (1 + math.sin(t * TAU + points[0][0] * .11) * .065 + math.sin(t * TAU * 2 + points[0][1]) * .035)
        rows.append([(p.x - tan.z * w * .5 * s, p.z + tan.x * w * .5 * s) for s in (-1, 1)])
    bm = bmesh.new()
    for (a0, b0), (a1, b1) in zip(rows, rows[1:]):
        quad = clip_polygon_rect([a0, b0, b1, a1], BOUNDS)
        if len(quad) >= 3:
            try: bm.faces.new([bm.verts.new((x, y, z)) for x, z in quad])
            except ValueError: pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    for f in bm.faces:
        if f.normal.y < 0: f.normal_flip()
    return merge_into(part(group, key), bm, Matrix.Identity(4), tint)

# ---------------------------------------------------------------- the district
def build_cafe():
    rand = rnd_factory(81026)
    G = 'house'
    # Maru: mortar base, staggered boards, rails and front apron.
    box(G, 'mortar', (0, -.036, -.85), (4.6, .20, 4.2), bevel=.01)
    for iz in range(15):
        t = rand() * .16
        tint = lerp([1, 1, 1], [.88, .86, .80], t / .16 * .6)
        joint = .43 if iz % 2 else -.36
        left, right = joint + 2.275, 2.275 - joint
        z = -2.74 + iz * .274
        jitter = lambda: (random.random() - .5) * .002
        box(G, 'wood:x', (-2.275 + left / 2, .102 + jitter(), z), (left - .008, .055, .258), rot=(jitter() * 2, 0, 0), tint=tint, bevel=.007)
        box(G, 'wood:x', (joint + right / 2, .102 + jitter(), z), (right - .008, .055, .258), rot=(jitter() * 2, 0, 0), tint=lerp(tint, [.95, .94, .9], .3), bevel=.007)
    for sx in (-2.25, 2.25): box(G, 'darkWood:z', (sx, .104, -.82), (.075, .055, 4.12))
    box(G, 'darkWood:x', (0, .006, 1.20), (4.54, .24, .075))
    # Back wall with the large rounded window, the curved roof's gable infill.
    o = dict(x=0, y=1.29, w=3.12, h=1.52, r=.16)
    wall_outline = [(-1.925, 0), (1.925, 0), (1.925, 2.2), (-1.925, 2.2)]
    extrude_shape(G, 'plaster', wall_outline, [list(reversed(rounded_rect(o['x'], o['y'], o['w'], o['h'], o['r'])))], -2.125, .25, bevel=.012)
    gable = [(-1.925, 2.11), (1.925, 2.11)] + [(x, cafe_roof_h(x, -1.98) - .13) for x in [1.925 - i * 3.85 / 24 for i in range(25)]]
    extrude_shape(G, 'plaster', gable, [], -1.99, .03)
    # Window: deep wood frame, dark interior, shelves, curtains, mullions.
    outer = rounded_rect(o['x'], o['y'], o['w'] + .19, o['h'] + .19, o['r'] + .08)
    inner = list(reversed(rounded_rect(o['x'], o['y'], o['w'] - .035, o['h'] - .035, max(.025, o['r'] - .035))))
    extrude_shape(G, 'wood:x', outer, [inner], -1.898, .16, bevel=.016)
    extrude_shape('props', 'backing', rounded_rect(o['x'], o['y'], o['w'] - .02, o['h'] - .02, o['r']), [], -2.124, .004)
    box('props', 'interior', (o['x'], o['y'] + .035, -2.114), (o['w'] * .82, o['h'] * .82, .006), bevel=0)
    box(G, 'darkWood:x', (o['x'], o['y'] - o['h'] * .37, -2.076), (o['w'] * .82, .053, .071))
    for side in (-1, 1):
        def curtain(u, v, side=side):
            xx = (u - .5) * o['w'] * .105; yy = (v - .5) * o['h'] * .84
            return (o['x'] + side * o['w'] * .35 + xx * (1 + .14 * math.cos(yy * 4)), o['y'] + yy, -2.054 + math.sin(xx * 58) * .021)
        grid('props', 'cotton', curtain, 10, 6, double=True)
    for u in (-.38, 0, .38): box(G, 'darkWood:y', (o['x'] + u * o['w'], o['y'], -1.789), (.047, o['h'] - .07, .082))
    box(G, 'darkWood:x', (o['x'], o['y'] - .05, -1.778), (o['w'] - .09, .042, .088))
    box(G, 'wood:x', (o['x'], o['y'] - o['h'] / 2 - .092, -1.731), (o['w'] + .30, .12, .31))
    # Tea shelves inside the recessed window.
    for y in (.88, 1.43): box(G, 'wood:x', (0, y, -2.060), (1.68, .053, .110))
    for x in (-.81, .81): box(G, 'wood:y', (x, 1.15, -2.077), (.055, .64, .065))
    cup = [(0, 0), (.036, 0), (.05, .008), (.060, .077), (.053, .081), (.046, .016), (0, .016)]
    for x in (-.46, .46): lathe('props', 'ceramic', cup, 14, (x, .907, -2.061), (1, 1, .7))
    # Piers, open tea-room framing, cloth side screens, brass bands.
    for side in (-1, 1):
        sx = side * 1.8
        box(G, 'stone', (sx, .23, -1.65), (.28, .38, .9), bevel=.03)
        pier_top = cafe_roof_h(sx, -1.65) - .145
        for z in (-2.032, -1.265):
            top = cafe_roof_h(sx, z) - .145
            box(G, 'wood:y', (sx, (top + .405) / 2, z), (.18, top - .405, .115))
        box(G, 'wood:z', (sx, .58, -1.65), (.18, .09, .87))
        beam(G, 'wood:z', (sx, cafe_roof_h(sx, -2.09) - .18, -2.09), (sx, cafe_roof_h(sx, -1.21) - .18, -1.21), .086, square=True)
        top, bottom = pier_top - .065, .65
        def screen(u, v, sx=sx, side=side, top=top, bottom=bottom):
            lx = (u - .5) * .68; ly = (v - .5)
            dz = math.sin(lx * math.pi * 9) * .023 + math.cos(ly * math.pi) * .009
            # rotation.y = side*pi/2 maps local x to world -side*z, local z to side*x
            return (sx + side * dz, (top + bottom) / 2 + ly * (top - bottom), -1.65 - side * lx * side * side)
        grid('roof', 'cotton', screen, 16, 10, double=True)
        box(G, 'darkWood:z', (sx, .431, -1.65), (.285, .039, .90))
        front_top = cafe_roof_h(sx, -1.198) - .145
        box(G, 'wood:y', (sx, (front_top + .325) / 2, -1.198), (.145, front_top - .325, .085))
        for y in (.50, front_top - .12): box('props', 'brass', (sx, y, -1.20), (.277, .058, .094), bevel=.008)
    box(G, 'darkWood:x', (0, .24, -1.824), (3.85, .25, .105))
    # Full-width tea counter and posts; continuous ledge with vessels.
    box(G, 'wood:x', (0, .53, -1.69), (3.31, .14, .32))
    for x in (-1.62, 0, 1.62): box(G, 'wood:y', (x, 1.29, -1.701), (.092, 1.62, .145))
    box(G, 'wood:x', (.14, .54, -1.57), (3.18, .13, .36))
    for x in (-1.10, -.83): sphere('props', 'ceramic', (x, .72, -1.52), (.115, .13, .09), 18, 12)
    # Lantern.
    lx = -1.47
    box('props', 'metal', (lx, 1.74, -1.71), (.11, .08, .25), bevel=.01)
    sphere('props', 'butter', (lx, 1.59, -1.56), (.078, .136, .078), 18, 12)
    for y in (1.46, 1.72): box('props', 'metal', (lx, y, -1.56), (.17, .039, .17), bevel=.008)
    # Rear cladding.
    for i in range(16): box(G, 'wood:y', (-1.65 + i * .22, .47, -2.151), (.204, .52, .047), tint=lerp([1, 1, 1], [.9, .88, .84], random.random()))
    box(G, 'darkWood:x', (0, .76, -2.17), (3.78, .084, .084))
    # Shop plaque.
    cylinder('props', 'wood:x', (1.38, 1.92, -1.633), .165, .165, .043, 32, rot=(math.pi / 2, 0, 0))
    tube('props', 'brass', [(1.38 + .145 * math.cos(a), 1.92 + .145 * math.sin(a), -1.603) for a in [i / 32 * TAU for i in range(33)]], .008, sides=6, segs=32, caps=False)
    box('props', 'paper', (1.376, 1.91, -1.59), (.105, .081, .013), bevel=.003)
    tube('props', 'paper', [(1.44 + .027 * math.cos(a), 1.913 + .027 * math.sin(a), -1.59) for a in [i / 16 * TAU for i in range(17)]], .007, sides=5, segs=16, caps=False)
    box('props', 'paper', (1.38, 1.858, -1.59), (.14, .009, .012), bevel=0)
    # Hanging herb pots.
    hr = rnd_factory(424242)
    for x in (-1.67, 1.62):
        beam('props', 'metal', (x, 2.19, -1.47), (x, 1.78, -1.47), .005, sides=4)
        sphere('props', 'ceramic', (x, 1.66, -1.47), (.145, .12, .13), 18, 12)
        for i in range(9):
            a = i * 2.399 + hr(); r = math.sqrt(hr()) * .19 * .53; h = (.12 + hr() * .2) * .53
            px, pz = x + math.sin(a) * r, -1.47 + math.cos(a) * r
            beam('props', 'stem', (px, 1.76, pz), (px, 1.76 + h, pz), .006, sides=4)
            for j in range(3):
                leaf_box = (px, 1.76 + h * (.25 + j * .25), pz)
                sphere('props', 'leaf', leaf_box, (.045, .012, .022), 6, 4, rot=(.9 + hr() * .5, a + j * 2.2, 0), tint=lerp([.85, .95, .8], [1.25, 1.2, .9], hr()))
    # History hanger (empty support).
    x, y, z = 1.73, 1.02, -.52; top = y + .225; mount = top + .16
    beam('props', 'darkWood', (x, mount, -1.26), (x, mount, z), .013, sides=6)
    box('props', 'wood:x', (x, mount, z), (.38, .027, .032), bevel=.004)
    for s in (-1, 1): beam('props', 'cotton', (x + s * .13, mount, z), (x + s * .13, top + .012, z), .004, sides=4)
    # Lapis textile guide with stitched line.
    gx, gy, gz = -1.80, 1.25, -1.17
    grid('props', 'lapis', lambda u, v: (gx + (u - .5) * .42, gy + (v - .5) * .74, gz + math.sin(v * .74 * 6.3) * .013), 4, 12, double=True)
    box('props', 'wood:x', (gx, gy + .38, gz), (.48, .030, .035), bevel=.006)
    box('props', 'wood:x', (gx, gy - .37, gz), (.42, .024, .030), bevel=.006)
    for (ax, ay), (bx, by) in [((-.11, .055), (.11, .055)), ((.04, .125), (.11, .055)), ((.11, .055), (.04, -.015)), ((-.14, -.25), (.14, -.25))]:
        beam('props', 'paper', (gx + ax, gy + ay, gz + .018), (gx + bx, gy + by, gz + .018), .0045, sides=4)
    # Tea table, tea set and teapot.
    top_profile = [(0, -.045), (.52, -.045), (.558, -.033), (.567, -.012), (.565, .018), (.551, .040), (.522, .046), (0, .046)]
    lathe('props', 'ceramic', top_profile, 40, (1.05, .68, -.3))
    cylinder('props', 'metal', (1.05, .37, -.3), .115, .21, .55, 20)
    for a in (0, TAU / 3, TAU * 2 / 3):
        box('props', 'metal', (1.05 + math.sin(a) * .16, .15, -.3 + math.cos(a) * .16), (.055, .08, .42), rot=(0, a, 0), bevel=.01)
    px, py, pz = 1.14, .732, -.33
    cylinder('props', 'ceramic', (px, py, pz), .19 / 2, .19 / 2, .018, 24)
    lathe('props', 'ceramic', [(.075, 0), (.082, .010), (.095, .137), (.096, .145), (.084, .145), (.083, .135), (.072, .020), (0, .02)], 20, (px, py + .008, pz))
    cylinder('props', 'tea', (px, py + .141, pz), .086, .086, .006, 20)
    tube('props', 'ceramic', [(px + .093 + .055 * math.cos(a), py + .087 + .055 * math.sin(a), pz) for a in [-1.3 + i / 10 * 2.6 for i in range(11)]], .016, sides=6, segs=10)
    box('props', 'paper', (px - .24, py + .018, pz), (.13, .018, .19), rot=(0, -.2, 0), bevel=.003)
    tx, ty, tz = .85, .740, -.34
    cylinder('props', 'ceramic', (tx, ty - .007, tz), .149, .149, .014, 24)
    lathe('props', 'ceramic', [(0, 0), (.075, 0), (.110, .035), (.119, .105), (.105, .170), (.073, .183), (.074, .170), (.106, .103), (.085, .040), (0, .036)], 24, (tx, ty, tz))
    sphere('props', 'ceramic', (tx, ty + .190, tz), (.078, .018, .078), 18, 6)
    sphere('props', 'ceramic', (tx, ty + .228, tz), (.019, .019, .019), 10, 6)
    tube('props', 'ceramic', [(tx - .073, ty + .100, tz), (tx - .163, ty + .146, tz), (tx - .214, ty + .205, tz)], .022, sides=8, segs=10)
    tube('props', 'ceramic', [(tx + .088, ty + .136, tz), (tx + .150, ty + .110, tz), (tx + .158, ty + .055, tz), (tx + .082, ty + .047, tz)], .012, sides=6, segs=12)
    build_roof()
    build_awning()

def build_roof():
    width, near, far = 5.26, -.65, -3.04
    H = lambda x, z: cafe_roof_h(x, z, width)
    tiles, courses = 36, 7
    def top(u, v):
        x = -width / 2 + u * width; z = far + v * (near - far)
        # Convex tile rows run from ridge to eave; low courses step at each lap.
        ridge = .024 * abs(math.sin(math.pi * u * tiles)) ** .55
        c = v * courses; lap = c - math.floor(c)
        step = .014 * (lap ** 2.2) if v < .999 else .014
        return (x, H(x, z) + ridge + step, z)
    grid('roof', 'roof', top, tiles * 4, courses * 6, facing=(0, 1, 0))
    def under(u, v):
        x = -width / 2 + u * width; z = far + v * (near - far)
        return (x, H(x, z) - .10, z)
    bm_under = bmesh.new()
    nu, nv = 24, 10
    vs = [[bm_under.verts.new(under(i / nu, j / nv)) for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv): bm_under.faces.new((vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j]))
    bm_under.normal_update()
    for f in bm_under.faces:
        if f.normal.y > 0: f.normal_flip()
    merge_into(part('roof', 'roof'), bm_under, Matrix.Identity(4))
    # Closed fascia between the tiled top and the underside.
    for z in (near, far):
        def fascia(u, v, z=z):
            x = -width / 2 + u * width; return (x, H(x, z) - .10 + v * .12, z)
        grid('roof', 'roof', fascia, 96, 1, facing=(0, 0, 1 if z == near else -1))
    for x in (-width / 2, width / 2):
        def side(u, v, x=x):
            z = far + u * (near - far); return (x, H(x, z) - .10 + v * .12, z)
        grid('roof', 'roof', side, 24, 1, facing=(1 if x > 0 else -1, 0, 0))
    for z in (near + .025, far - .025):
        pts = [(x, H(x, z) - .06, z) for x in [-width / 2 + i * width / 24 for i in range(25)]]
        tube('roof', 'darkWood:x', pts, .075, sides=12, segs=48)
        tube('roof', 'wood:x', [(x, y - .076, z) for x, y, z in pts], .023, sides=8, segs=48)
    tube('roof', 'wood:x', [(x, H(x, -1.92) - .13, -1.81) for x in [-1.92 + i * 3.84 / 20 for i in range(21)]], .042, sides=10, segs=40)
    for i in range(13):
        x = -1.85 + i * 3.70 / 12
        tube('roof', 'wood:z', [(x, H(x, z) - .145, z) for z in [far + (near - far) * j / 7 for j in range(8)]], .017, sides=6, segs=16)

def build_awning():
    cols, rows, width = 40, 12, 3.12
    near_z, far_z, front_y = -1.04, -1.80, 2.59
    def cloth(u, v):
        arch = math.sin(u * math.pi)
        y = 2.64 - v * .05 + arch * (.14 - v * .06) - math.sin(v * math.pi) * .055
        y += .004 * math.sin(u * math.pi * 18) * math.sin(v * math.pi)
        return ((u - .5) * width, y, far_z + v * (near_z - far_z))
    grid('roof', 'cotton', cloth, cols, rows, double=True)
    steps = 64
    def hem(u, v):
        x = (u - .5) * width; top = front_y + math.sin(u * math.pi) * .08; bottom = 2.555 + math.cos(u * TAU * 2) * .025
        return (x, bottom + (top - bottom) * v, near_z + .027 * (1 - v))
    grid('roof', 'cotton', hem, steps, 2, double=True)
    for side in (-1, 1):
        x = side * width / 2
        beam('roof', 'darkWood', (side * 1.80, 2.02, -1.65), (x, 2.64, far_z), .024, sides=6)
        beam('roof', 'darkWood', (x, 2.64, far_z), (x, front_y, near_z), .018, sides=6)
    tube('roof', 'darkWood:x', [((i / 30 - .5) * width, front_y + math.sin(i / 30 * math.pi) * .08 - .012, near_z - .009) for i in range(31)], .019, sides=8, segs=48)
    tube('roof', 'lapis', [((i / 40 - .5) * width, 2.555 + math.cos(i / 40 * TAU * 2) * .025, near_z + .031) for i in range(41)], .007, sides=6, segs=64)

def build_ground():
    G = 'ground'
    b = BOUNDS
    # Lawn under everything, coloured by the same terrain field as v20.
    nx, nz = 30, 44
    bm = bmesh.new(); vs = []
    for i in range(nx + 1):
        row = []
        for j in range(nz + 1):
            x = b['minX'] + (b['maxX'] - b['minX']) * i / nx; z = b['minZ'] + (b['maxZ'] - b['minZ']) * j / nz
            row.append(bm.verts.new((x, LAWN_Y, z)))
        vs.append(row)
    faces = []
    for i in range(nx):
        for j in range(nz):
            f = bm.faces.new((vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j])); faces.append(f)
    for f in faces:
        if f.normal.y < 0: f.normal_flip()
    layer = bm.loops.layers.float_color.new('tint')
    grass_tex = 218 / 255
    for f in bm.faces:
        for l in f.loops:
            c = terrain_color(l.vert.co.x, l.vert.co.z); l[layer] = (*[x * grass_tex for x in c], 1)
    merge_into(part(G, 'lawn'), bm, Matrix.Identity(4))
    # The limestone court, clipped to the district rectangle.
    # The court is x-monotone inside the district: fill between its front and
    # back curves with a clean strip grid instead of one concave polygon.
    outline = court_outline()
    def court_span(x):
        zs = []
        for (ax, az), (bx, bz) in zip(outline, outline[1:] + outline[:1]):
            if (ax - x) * (bx - x) <= 0 and ax != bx: zs.append(az + (bz - az) * (x - ax) / (bx - ax))
        return max(min(zs), b['minZ']), min(max(zs), b['maxZ'])
    def court_fn(u, v):
        x = b['minX'] + (b['maxX'] - b['minX']) * u; zf, zb = court_span(x)
        return (x, COURT_Y, zf + (zb - zf) * v)
    grid(G, 'paving', court_fn, 60, 24, facing=(0, 1, 0))
    # Slim curved mortar courses and the stone borders.
    for pts in ([(-9.08, 1.61), (-6.53, 1.35), (-3.4, 1.69), (0, 1.48), (3.4, 1.65), (6.4, 1.41), (9.11, 1.76)],
                [(-9.17, 2.50), (-6.62, 2.34), (-3.30, 2.64), (0, 2.56), (3.41, 2.49), (6.47, 2.43), (9.15, 2.69)],
                [(-8.85, 3.36), (-6.31, 3.30), (-3.21, 3.40), (0, 3.60), (3.03, 3.38), (6.41, 3.29), (8.95, 3.45)]):
        ribbon(G, 'mortar', pts, .014, GROUND_ROOT - .125 + .035)
    ribbon(G, 'stone', [(-9.39, 1.10), (-9.05, .62), (-6.20, .52), (-3.20, .70), (0, .62), (3.25, .58), (6.20, .54), (9.10, .79), (9.43, 1.34)], .13, GROUND_ROOT - .125 + .022)
    ribbon(G, 'stone', [(-9.28, 4.53), (-6.43, 4.96), (-3.48, 4.93), (0, 5.17), (3.32, 4.97), (6.37, 4.97), (9.23, 4.53)], .13, GROUND_ROOT - .125 + .022)
    ribbon(G, 'gravel', [(0, 1.5), (.04, -.6), (-.11, -2.6), (.04, -4.5), (0, -6.85)], 3.54, GROUND_ROOT - .125 + .014)
    ribbon(G, 'gravel', [(-9.2, 3), (-9.0, 5.3), (-4.5, 6.0), (0, 6.12), (4.8, 5.92), (9.0, 5.3), (9.2, 3)], 1.35, GROUND_ROOT - .125 + .025)
    # day-environment.mjs: the low gravel shoulder along the court's front edge, with flush pebbles.
    ribbon(G, 'gravel', [(-9.1, 5.19), (-6.3, 5.22), (-3, 5.25), (0, 5.18), (3.3, 5.24), (6.4, 5.21), (9.1, 5.19)], .30, GROUND_ROOT - .125 + .024)
    pr = rnd_factory(2410)
    for i in range(7):
        x = -2.8 + pr() * 5.6; z = 5.24 + (pr() - .5) * .17
        sphere(G, 'stone', (x, GROUND_ROOT - .109, z), (.027 + pr() * .030, .012, .025 + pr() * .022), 8, 4, rot=(0, pr() * TAU, 0), tint=srgb('#bcbca4') if i % 3 else srgb('#d8ceb8'))

def setup_world(sky_path):
    sc = bpy.context.scene
    world = bpy.data.worlds.new('town-sky'); sc.world = world; world.use_nodes = True
    nt = world.node_tree; nt.nodes.clear()
    out = node(nt, 'ShaderNodeOutputWorld', (900, 0))
    add = node(nt, 'ShaderNodeAddShader', (650, 0))
    coord = node(nt, 'ShaderNodeTexCoord', (-900, 0))
    mapping = node(nt, 'ShaderNodeMapping', (-700, 200))
    mapping.inputs['Rotation'].default_value = (0, 0, math.pi + .65)
    nt.links.new(coord.outputs['Generated'], mapping.inputs['Vector'])
    env = node(nt, 'ShaderNodeTexEnvironment', (-450, 200)); env.image = bpy.data.images.load(sky_path)
    nt.links.new(mapping.outputs['Vector'], env.inputs['Vector'])
    bg1 = node(nt, 'ShaderNodeBackground', (300, 200)); bg1.inputs['Strength'].default_value = .45
    nt.links.new(env.outputs['Color'], bg1.inputs['Color'])
    sep = node(nt, 'ShaderNodeSeparateXYZ', (-450, -200)); nt.links.new(coord.outputs['Generated'], sep.inputs[0])
    step = node(nt, 'ShaderNodeMath', (-250, -200)); step.operation = 'GREATER_THAN'; step.inputs[1].default_value = 0
    nt.links.new(sep.outputs['Z'], step.inputs[0])
    mix = node(nt, 'ShaderNodeMix', (0, -200)); mix.data_type = 'RGBA'
    k = .58 / math.pi
    mix.inputs[6].default_value = (*scale(srgb('#71815e'), k), 1); mix.inputs[7].default_value = (*scale(srgb('#d8eaff'), k), 1)
    nt.links.new(step.outputs[0], mix.inputs['Factor'])
    bg2 = node(nt, 'ShaderNodeBackground', (300, -200)); bg2.inputs['Strength'].default_value = 1
    nt.links.new(mix.outputs[2], bg2.inputs['Color'])
    nt.links.new(bg1.outputs[0], add.inputs[0]); nt.links.new(bg2.outputs[0], add.inputs[1]); nt.links.new(add.outputs[0], out.inputs['Surface'])
    def sun(name, color, strength, toward, angle):
        ld = bpy.data.lights.new(name, 'SUN'); ld.energy = strength; ld.color = color; ld.angle = math.radians(angle)
        ob = bpy.data.objects.new(name, ld); sc.collection.objects.link(ob)
        ob.rotation_euler = Vector(toward).normalized().to_track_quat('Z', 'Y').to_euler()
        return ob
    # Light colours are display-referred hex in three.js; Cycles wants linear.
    sun('sun', srgb('#fff3de'), 3.15, (-9, -7, 11), 1.5)
    sun('fill', srgb('#cddfff'), .18, (8, 10, 4), 4)

def setup_cycles(samples):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for kind in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = kind; prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == kind]
            if gpus:
                for d in prefs.devices: d.use = d.type == kind
                sc.cycles.device = 'GPU'; log('device', kind, [d.name for d in gpus]); break
        except Exception as e: log('device fail', kind, e)
    sc.cycles.samples = samples; sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 4; sc.cycles.glossy_bounces = 1; sc.cycles.transparent_max_bounces = 4
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'

def add_camera(name, pos_town, target_town, fov_deg, aspect):
    cam = bpy.data.cameras.new(name); cam.sensor_fit = 'VERTICAL'; cam.angle_y = math.radians(fov_deg)
    ob = bpy.data.objects.new(name, cam); bpy.context.scene.collection.objects.link(ob)
    p = C4 @ Vector(pos_town); t = C4 @ Vector(target_town)
    ob.location = p; ob.rotation_euler = (t - p).to_track_quat('-Z', 'Y').to_euler()
    return ob

CAMERAS = {
    'follow': ((-0.06624, 12.359059, 16.185798), (-0.06624, 1.559059, 1.185798), 44),
    'close': ((0.21376, 2.11, 6.21032), (-0.06624, .69, 2.36032), 42),
}

def remove_hidden_faces(objs):
    """Faces nobody can see waste bake texels: undersides resting on the
    ground or maru, lawn/gravel under the maru and the court, and faces in
    contact with another surface (checked with a short ray along the normal)."""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    trees = [BVHTree.FromObject(o, dg) for o in objs]
    removed = {}
    for o in objs:
        bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table()
        kill = []
        for f in bm.faces:
            c = f.calc_center_median(); n = f.normal
            tx, ty, tz = c.x, c.z, -c.y          # Town coordinates
            ny = n.z
            if ny < -.5 and ty < .135: kill.append(f); continue
            key = o.name.split('__')[-1]
            if key in ('lawn', 'gravel'):
                under_maru = abs(tx) < 2.27 and -2.86 < tz < 1.22
                in_court = .75 < tz < 4.95
                gravel_hidden = key == 'gravel' and -2.9 < tz < 4.9   # centre path under the maru and the court only
                if under_maru or (in_court and key == 'lawn') or gravel_hidden: kill.append(f); continue
            if key in ('mortar',) and o['group'] == 'ground': continue
            origin = c + n * 1e-4
            for t in trees:
                hit = t.ray_cast(origin, n, .004)
                if hit[0] is not None: kill.append(f); break
        removed[o.name] = len(kill)
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        bm.to_mesh(o.data); bm.free(); o.data.update()
    return removed

def stage_build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(1017)
    for name in ('district', 'occluders'):
        bpy.context.scene.collection.children.link(bpy.data.collections.new(name))
    ref = os.path.abspath(arg('--ref'))
    bpy.ops.import_scene.gltf(filepath=os.path.join(ref, 'v20_surroundings.glb'))
    occ = bpy.data.collections['occluders']
    for ob in list(bpy.context.selected_objects):
        for c in ob.users_collection: c.objects.unlink(ob)
        occ.objects.link(ob)
        ob['occluder'] = True
    t0 = time.time()
    build_cafe(); build_ground()
    objs = [p.finish() for p in PARTS.values()]
    removed = remove_hidden_faces(objs)
    log('removed hidden faces', removed)
    # Rafters sit under the roof shell. Their crisp stripes across the awning
    # read as noise from the walking camera, so they cast no baked shadow.
    for o in objs:
        if o.name == 'roof__wood:z': o.visible_shadow = False
    log('built', len(objs), 'objects in', round(time.time() - t0, 1), 's')
    setup_world(os.path.abspath(arg('--sky')))
    setup_cycles(64)
    for name, (p, t, fov) in CAMERAS.items(): add_camera('cam_' + name, p, t, fov, 1280 / 900)
    tris = {}
    for ob in objs:
        g = ob['group']; tris[g] = tris.get(g, 0) + sum(len(pl.vertices) - 2 for pl in ob.data.polygons)
    log('triangles', tris, 'total', sum(tris.values()))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, 'build.blend'))
    if arg('--preview', '1') == '1':
        sc = bpy.context.scene; sc.render.resolution_x, sc.render.resolution_y = 1280, 900
        for name in CAMERAS:
            sc.camera = bpy.data.objects['cam_' + name]
            sc.render.filepath = os.path.join(WORK, f'build-{name}.png'); bpy.ops.render.render(write_still=True)
    json.dump({'triangles': tris}, open(os.path.join(WORK, 'build.json'), 'w'), indent=2)

# ---------------------------------------------------------------- bake
def fill_dead_texels(rgb, passes=8):
    # Texels inside contacts bake black; spread their lit neighbours inward so
    # bilinear filtering and mipmaps never pull black into a visible edge.
    lum = rgb.mean(axis=2); valid = lum > 1e-4; out = rgb.copy()
    for _ in range(passes):
        acc = np.zeros_like(out); cnt = np.zeros(lum.shape, np.float32)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            v = np.roll(valid, (dy, dx), (0, 1)); c = np.roll(out, (dy, dx), (0, 1))
            acc += c * v[..., None]; cnt += v
        grow = (~valid) & (cnt > 0)
        out[grow] = acc[grow] / cnt[grow][:, None]; valid = valid | grow
    return out

def box_blur(a, r):
    k = 2 * r + 1; p = np.pad(a, r, mode='edge'); c = p.cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)

def to_srgb(lin):
    return np.where(lin <= .0031308, lin * 12.92, 1.055 * np.power(np.clip(lin, 0, None), 1 / 2.4) - .055)

def stage_bake():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(WORK, 'build.blend'))
    samples = int(arg('--samples', '1024'))
    setup_cycles(samples)
    sc = bpy.context.scene
    district = [o for o in bpy.data.collections['district'].objects if o.type == 'MESH']
    report = {'samples': samples, 'groups': {}}
    for group, res in GROUPS.items():
        objs = [o for o in district if o['group'] == group]
        if not objs: continue
        t0 = time.time()
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
            if 'bake' not in o.data.uv_layers: o.data.uv_layers.new(name='bake')
            o.data.uv_layers.active = o.data.uv_layers['bake']
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(ANGLE_LIMIT), island_margin=4 / res, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
        bpy.ops.object.mode_set(mode='OBJECT')
        # The maru base top is only seen through board cracks: keep it at 15%.
        for o in objs:
            if o.name.endswith('__mortar') and o['group'] == 'house':
                uv = o.data.uv_layers['bake'].data
                for p in o.data.polygons:
                    if p.normal.z > .5:
                        cu = sum((uv[i].uv for i in p.loop_indices), Vector((0, 0))) / len(p.loop_indices)
                        for i in p.loop_indices: uv[i].uv = cu + (uv[i].uv - cu) * .15
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.select_all(action='SELECT')
        bpy.ops.uv.pack_islands(rotate=True, rotate_method='ANY', scale=True, shape_method='CONCAVE', margin_method='SCALED', margin=4 / res)
        bpy.ops.object.mode_set(mode='OBJECT')
        images = {}
        for pass_name in ('full', 'sun'):
            img = bpy.data.images.new(f'{group}_{pass_name}', res, res, alpha=False, float_buffer=True)
            images[pass_name] = img
        def target(img):
            for o in objs:
                for m in o.data.materials:
                    nt = m.node_tree
                    n = nt.nodes.get('bake_target') or nt.nodes.new('ShaderNodeTexImage')
                    n.name = 'bake_target'; n.image = img; n.location = (900, -400)
                    nt.nodes.active = n
        # Full diffuse radiance (direct + indirect, no glossy).
        target(images['full'])
        bpy.ops.object.bake(type='COMBINED', pass_filter={'DIRECT', 'INDIRECT', 'DIFFUSE', 'GLOSSY', 'EMIT'}, margin=12, margin_type='EXTEND', use_clear=True, target='IMAGE_TEXTURES')
        # Sun share: the main sun only, direct diffuse.
        world_strengths = [(n, n.inputs['Strength'].default_value) for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND']
        for n, _ in world_strengths: n.inputs['Strength'].default_value = 0
        fill = bpy.data.objects['fill']; fill.hide_render = True
        sc.cycles.samples = max(128, samples // 2)
        target(images['sun'])
        bpy.ops.object.bake(type='COMBINED', pass_filter={'DIRECT', 'DIFFUSE'}, margin=12, margin_type='EXTEND', use_clear=True, target='IMAGE_TEXTURES')
        for n, s in world_strengths: n.inputs['Strength'].default_value = s
        fill.hide_render = False; sc.cycles.samples = samples
        def read(img):
            a = np.empty(res * res * 4, dtype=np.float32); img.pixels.foreach_get(a); return a.reshape(res, res, 4)[..., :3]
        full, sun = read(images['full']), read(images['sun'])
        full = fill_dead_texels(full)
        # Share of direct sun. Dim texels are noise-dominated: no live shadow
        # there, and a small box blur keeps the mask from speckling.
        lum_full, lum_sun = full.mean(axis=2), sun.mean(axis=2)
        share = np.clip(lum_sun / np.maximum(lum_full, 1e-4), 0, 1)
        share[lum_full < .03] = 0
        share = box_blur(share, 2)
        np.save(os.path.join(WORK, f'{group}_full.npy'), full)
        np.save(os.path.join(WORK, f'{group}_share.npy'), share)
        enc = np.concatenate([np.clip(to_srgb(full * .5), 0, 1), share[..., None]], axis=2)
        out = bpy.data.images.new(f'bake_{group}', res, res, alpha=True)
        out.pixels.foreach_set(enc.astype(np.float32).ravel())
        out.filepath_raw = os.path.join(WORK, f'bake_{group}.png'); out.file_format = 'PNG'; out.save()
        report['groups'][group] = {'resolution': res, 'objects': len(objs), 'seconds': round(time.time() - t0, 1),
            'radiance_p50': float(np.median(full)), 'radiance_p99': float(np.percentile(full, 99)), 'clipped_fraction': float((full * .5 > 1).mean())}
        log('baked', group, report['groups'][group])
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, 'bake.blend'))
    json.dump(report, open(os.path.join(WORK, 'bake.json'), 'w'), indent=2)

# ---------------------------------------------------------------- export
def stage_export():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(WORK, 'bake.blend'))
    out = os.path.abspath(arg('--out'))
    keep = []
    for group in GROUPS:
        objs = [o for o in bpy.data.collections['district'].objects if o.type == 'MESH' and o.get('group') == group and o not in keep]
        if not objs: continue
        img = bpy.data.images.load(os.path.join(WORK, f'bake_{group}.png'), check_existing=False)
        img.alpha_mode = 'CHANNEL_PACKED'
        m = bpy.data.materials.new(f'bake_{group}'); m.use_nodes = True; nt = m.node_tree
        bsdf = nt.nodes['Principled BSDF']; tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color']); nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        bsdf.inputs['Roughness'].default_value = 1
        m['synk_bake_scale'] = 2.0; m['synk_sun_alpha'] = 1
        m.blend_method = 'OPAQUE' if hasattr(m, 'blend_method') else None
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
            o.data.materials.clear(); o.data.materials.append(m)
            for name in [l.name for l in o.data.uv_layers if l.name != 'bake']: o.data.uv_layers.remove(o.data.uv_layers[name])
            for name in [a.name for a in o.data.color_attributes]: o.data.color_attributes.remove(o.data.color_attributes[name])
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        j = bpy.context.view_layer.objects.active; j.name = j.data.name = 'cafe_' + group
        keep.append(j)
    # Real-time glass stays a live material.
    o = dict(x=0, y=1.29, w=3.12, h=1.52, r=.16)
    PARTS.clear()
    extrude_shape('glass', 'glass_pane', rounded_rect(o['x'], o['y'], o['w'] - .025, o['h'] - .025, o['r']), [], -1.978, .004)
    gp = PARTS[('glass', 'glass_pane')]
    me = bpy.data.meshes.new('cafe_glass'); gp.bm.to_mesh(me); gp.bm.free(); me.transform(C4)
    g = bpy.data.objects.new('cafe_glass', me); bpy.context.scene.collection.objects.link(g)
    gm = bpy.data.materials.new('live_glass'); gm.use_nodes = True
    b = gm.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*srgb('#d6e7eb'), 1)
    b.inputs['Roughness'].default_value = .075; b.inputs['Alpha'].default_value = .29
    g.data.materials.append(gm); keep.append(g)
    bpy.ops.object.select_all(action='DESELECT')
    for k in keep: k.select_set(True)
    kwargs = dict(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_extras=True,
                  export_texcoords=True, export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False,
                  export_animations=False, export_image_format='WEBP', export_image_quality=90)
    props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    dropped = [k for k in kwargs if k not in props]
    for k in dropped: kwargs.pop(k)
    if dropped: log('exporter ignored', dropped)
    bpy.ops.export_scene.gltf(**kwargs)
    tris = {k.name: sum(len(p.vertices) - 2 for p in k.data.polygons) for k in keep}
    report = {'glb': out, 'bytes': os.path.getsize(out), 'meshes': len(keep), 'triangles': tris, 'total_triangles': sum(tris.values()),
              'textures': {gname: res for gname, res in GROUPS.items()}, 'bake': json.load(open(os.path.join(WORK, 'bake.json')))}
    json.dump(report, open(os.path.join(WORK, 'export.json'), 'w'), indent=2)
    log('exported', report['bytes'], 'bytes', report['total_triangles'], 'tris')

{'build': stage_build, 'bake': stage_bake, 'export': stage_export}[STAGE]()

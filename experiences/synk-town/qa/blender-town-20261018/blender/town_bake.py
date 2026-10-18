# SYNK Town core neighbourhood, Blender build + bake + export (Claude, 2026-10-18).
#
#   blender -b -P town_bake.py -- --stage build  --work <dir> --ref <reference dir> --sky <jpg> [--parts home,workshop,greenhouse,ground]
#   blender -b -P town_bake.py -- --stage bake   --work <dir> [--samples 1024] [--parts ...]
#   blender -b -P town_bake.py -- --stage export --work <dir> --out <dir> [--parts ...]
#
# The Claude route for the town keeps v20's own geometry: the per-part
# reference GLBs from ../export-town.cjs are imported in place, given procedural
# surface detail by their v20 material key, unwrapped and baked in one scene
# (all four buildings, the core ground and the live vegetation as occluders).
# The cafe building itself comes from the 10-17 cafe-claude.glb and is not
# rebuilt here. Spec: ../자산규격.md. Blender (x, y, z) = Town (x, -z, y).
import bpy, bmesh, math, json, sys, os, time, re
import numpy as np
from mathutils import Vector, Matrix

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return ARGV[ARGV.index(name) + 1] if name in ARGV else default
STAGE = arg('--stage', 'build')
WORK = os.path.abspath(arg('--work', '.'))
os.makedirs(WORK, exist_ok=True)
PARTS = (arg('--parts') or 'home,workshop,greenhouse,ground').split(',')
CORE = dict(minX=-13.6, maxX=13.6, minZ=-12.2, maxZ=8.7)
# The flat town bounds (town-layout.mjs ground.flatBounds): the merged version's
# ground ring part reaches out to them (10-18 outer ring).
OUTER = dict(minX=-22.6, maxX=22.6, minZ=-25.4, maxZ=9.6)
GROUND_PARTS = ('ground', 'ring')
RES = int(arg('--res', '2048'))
# Output names town-<variant>-<part>-<group>. 'merged' (10-18): Argon's modelling
# scripts build the geometry (../../blender-merged-20261018/blender/merged_build.py),
# this script bakes and exports it; its atlas groups come from the objects.
VARIANT = arg('--variant', 'claude')
# Atlases per part (spec: at most three of 2048² per part).
GROUPS = {'ground': ['hard', 'soft'], 'home': ['house', 'roof', 'props'], 'workshop': ['house', 'roof', 'props'], 'greenhouse': ['house', 'props']}
ANGLE_LIMIT = float(arg('--angle', '66'))
# 6 px between islands and margins filled from the 3D-adjacent faces: with 3 px
# and EXTEND, a dark stone island packed next to a path painted its margin over
# the path's edge texels (dark notches along the path, 10-18).
MARGIN_PX = float(arg('--margin', '6'))
# Per-group unwrap overrides, "group=value,group=value" (10-18 outer ring): the
# neighbour houses are thousands of small pieces and 6 px around each left 8% of
# the atlas covered (2 px: 28%); the ring's long path ribbons pack best with
# lightmap pack (25% against 11%). uv_fill_try.py in ../../blender-merged-20261018 measures them.
GROUP_MARGIN = {k: float(v) for k, v in (p.split('=') for p in (arg('--group-margin') or '').split(',') if p)}
GROUP_METHOD = dict(p.split('=') for p in (arg('--group-method') or '').split(',') if p)
# Per-group samples (10-18: the neighbour atlases are magnified a lot in close views,
# so their per-texel noise showed as blotches on the plaster at 1024).
GROUP_SAMPLES = {k: int(v) for k, v in (p.split('=') for p in (arg('--group-samples') or '').split(',') if p)}
# Per-group smallest island width in texels (10-18: neighbour shutter battens, see unwrap).
GROUP_MIN_ISLAND = {k: float(v) for k, v in (p.split('=') for p in (arg('--min-island') or '').split(',') if p)}
# Town camera poses (position, target, vertical fov) from ../poses (PC 1280x900).
PREVIEW_CAMERAS = {'core': ((0, 8.2, 12.4), (0, .2, -2.6), 42), 'home-close': ((-5.706, 2.11, 5.549), (-5.986, .69, 1.699), 42),
                   'greenhouse-close': ((2.6, 2.35, -2.75), (-.15, .95, -6.1), 42)}

def log(*a):
    print('[town]', *a, flush=True)

def srgb_hex(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c]

# ---------------------------------------------------------------- source materials
NAME = re.compile(r'^(?P<key>.+?)_(?P<hex>[0-9a-f]{6})_r(?P<r>\d+)_m(?P<m>\d+)(?:_t(?P<t>\d+))?(?:_x(?P<x>\d+))?(?:\.\d+)?$')
KIND = {
    'wood': 'wood', 'darkWood': 'wood', 'shutters': 'wood', 'districtWood': 'wood', 'bark': 'wood',
    'plaster': 'plaster', 'plasterWarm': 'plaster', 'homePlaster': 'plaster', 'cafePlaster': 'plaster', 'workshopPlaster': 'plaster', 'interiorPlaster': 'plaster', 'farWall': 'plaster',
    'roofSlate': 'roof', 'roofTerra': 'roof', 'roofSage': 'roof', 'districtRoof': 'roof',
    'stone': 'stone', 'cliffMaterial': 'stone', 'paving': 'paving', 'mortar': 'mortar', 'gravel': 'gravel',
    'gardenSoil': 'soil', 'soil': 'soil', 'terrainMaterial': 'lawn', 'cotton': 'cotton', 'cloth': 'cotton', 'butter': 'butter',
}
GLASS = {'glass', 'greenhouseGlass', 'districtGlass'}
ROUGH = {'ceramic': .23, 'metal': .4, 'brass': .33, 'frame': .48, 'tea': .22, 'water': .21}

def parse(name):
    mm = NAME.match(name)
    if not mm: return {'key': name, 'hex': 'ffffff', 'rough': .9, 'metal': 0, 'opacity': None, 'map': None}
    return {'key': mm['key'], 'hex': mm['hex'], 'rough': int(mm['r']) / 100, 'metal': int(mm['m']) / 100, 'opacity': int(mm['t']) / 100 if mm['t'] else None,
            'map': int(mm['x']) if mm['x'] else None}

def group_of(part, key):
    if part == 'ground':
        return 'soft' if KIND.get(key) in ('lawn', 'soil') else 'hard'
    kind = KIND.get(key)
    if kind == 'roof': return 'roof' if 'roof' in GROUPS[part] else 'house'
    if kind in ('plaster', 'wood', 'stone', 'mortar', 'paving'): return 'house'
    return 'props'

def node(nt, kind, loc=(0, 0), **props):
    n = nt.nodes.new(kind); n.location = loc
    for k, v in props.items(): setattr(n, k, v)
    return n

def make_material(name, kind, color, rough, color_layer, map_path=None, uv_layer=None, flag=False):
    """Principled diffuse look of one v20 material: v20 hex x vertex colour
    (instance tints / terrain field) x the v20 colour map on v20 UVs (exported
    by ../export-town.cjs), plus light procedural detail and bump. `flag` adds
    flagstone joints (the shared court only)."""
    mat = bpy.data.materials.new(name); mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear()
    out = node(nt, 'ShaderNodeOutputMaterial', (900, 0))
    bsdf = node(nt, 'ShaderNodeBsdfPrincipled', (600, 0)); bsdf.inputs['Roughness'].default_value = rough
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    base = node(nt, 'ShaderNodeRGB', (-600, 120)); base.outputs[0].default_value = (*color, 1)
    col = base.outputs[0]
    if color_layer:
        tint = node(nt, 'ShaderNodeVertexColor', (-600, 300)); tint.layer_name = color_layer
        mix = node(nt, 'ShaderNodeMix', (-300, 200)); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
        nt.links.new(col, mix.inputs[6]); nt.links.new(tint.outputs['Color'], mix.inputs[7]); col = mix.outputs[2]
    if map_path:
        uv = node(nt, 'ShaderNodeUVMap', (-900, 500)); uv.uv_map = uv_layer or ''
        img = node(nt, 'ShaderNodeTexImage', (-600, 500)); img.image = bpy.data.images.load(map_path, check_existing=True); img.interpolation = 'Cubic'
        nt.links.new(uv.outputs['UV'], img.inputs['Vector'])
        mx = node(nt, 'ShaderNodeMix', (-300, 400)); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1
        nt.links.new(col, mx.inputs[6]); nt.links.new(img.outputs['Color'], mx.inputs[7]); col = mx.outputs[2]
    soft = .4 if map_path else 1   # the v20 map already carries the surface colour detail
    pos = node(nt, 'ShaderNodeTexCoord', (-1200, 0)).outputs['Object']
    def multiply(c, grey_socket, x=0):
        g = node(nt, 'ShaderNodeCombineXYZ', (x - 150, -100))
        for k in 'XYZ': nt.links.new(grey_socket, g.inputs[k])
        m2 = node(nt, 'ShaderNodeMix', (x, 100)); m2.data_type = 'RGBA'; m2.blend_type = 'MULTIPLY'; m2.inputs['Factor'].default_value = 1
        nt.links.new(c, m2.inputs[6]); nt.links.new(g.outputs[0], m2.inputs[7]); return m2.outputs[2]
    def remap(sock, lo, hi, a=.3, b=.7, x=-550, y=0):
        r = node(nt, 'ShaderNodeMapRange', (x, y)); r.inputs['From Min'].default_value = a; r.inputs['From Max'].default_value = b
        r.inputs['To Min'].default_value = lo; r.inputs['To Max'].default_value = hi; nt.links.new(sock, r.inputs['Value']); return r.outputs['Result']
    bump_h, strength = None, 0
    if kind == 'wood':
        # Grain along the boards (most v20 boards run along Town x); rings across.
        mp = node(nt, 'ShaderNodeMapping', (-1000, 0)); mp.inputs['Scale'].default_value = (.35, 6, 6); nt.links.new(pos, mp.inputs['Vector'])
        wave = node(nt, 'ShaderNodeTexWave', (-800, 0)); wave.inputs['Scale'].default_value = 1.6; wave.inputs['Distortion'].default_value = 7
        wave.inputs['Detail'].default_value = 3; nt.links.new(mp.outputs['Vector'], wave.inputs['Vector'])
        if not map_path: col = multiply(col, remap(wave.outputs['Fac'], .9, 1.05, 0, 1))
        bump_h, strength = wave.outputs['Fac'], .05
    elif kind in ('plaster', 'stone', 'gravel', 'roof', 'lawn', 'mortar', 'soil', 'cotton', 'paving'):
        noise = node(nt, 'ShaderNodeTexNoise', (-800, 0)); noise.inputs['Detail'].default_value = 8
        noise.inputs['Scale'].default_value = {'plaster': 38, 'stone': 22, 'paving': 9, 'cotton': 140, 'gravel': 90, 'roof': 30, 'lawn': 60, 'mortar': 40, 'soil': 55}[kind]
        nt.links.new(pos, noise.inputs['Vector'])
        broad = node(nt, 'ShaderNodeTexNoise', (-800, -260)); broad.inputs['Scale'].default_value = 1.2; nt.links.new(pos, broad.inputs['Vector'])
        amp = {'plaster': .035, 'stone': .07, 'paving': .05, 'cotton': .03, 'gravel': .12, 'roof': .06, 'lawn': .16, 'mortar': .06, 'soil': .14}[kind] * soft
        mm = node(nt, 'ShaderNodeMath', (-300, -100)); mm.operation = 'MULTIPLY'
        nt.links.new(remap(noise.outputs['Fac'], 1 - amp, 1 + amp * .4), mm.inputs[0])
        nt.links.new(remap(broad.outputs['Fac'], 1 - amp * .5, 1 + amp * .2, .35, .65, y=-260), mm.inputs[1])
        grey = mm.outputs[0]
        if kind == 'lawn':
            mp = node(nt, 'ShaderNodeMapping', (-1000, -520)); mp.inputs['Scale'].default_value = (1, 6, 1); nt.links.new(pos, mp.inputs['Vector'])
            streak = node(nt, 'ShaderNodeTexNoise', (-800, -520)); streak.inputs['Scale'].default_value = 260; nt.links.new(mp.outputs['Vector'], streak.inputs['Vector'])
            m3 = node(nt, 'ShaderNodeMath', (-300, -300)); m3.operation = 'MULTIPLY'
            nt.links.new(grey, m3.inputs[0]); nt.links.new(remap(streak.outputs['Fac'], .86, 1.10, .35, .65, y=-520), m3.inputs[1]); grey = m3.outputs[0]
        if kind == 'paving' and flag:
            # Flagstone courses: irregular cells with soft mortar joints (the
            # 10-17 Argon court read best; same idea, Claude's own nodes).
            mp = node(nt, 'ShaderNodeMapping', (-1000, -780)); mp.inputs['Scale'].default_value = (1.45, 1.9, 1); nt.links.new(pos, mp.inputs['Vector'])
            vor = node(nt, 'ShaderNodeTexVoronoi', (-800, -780)); vor.feature = 'DISTANCE_TO_EDGE'; vor.inputs['Scale'].default_value = 1.6
            vor.inputs['Randomness'].default_value = .85; nt.links.new(mp.outputs['Vector'], vor.inputs['Vector'])
            joint = remap(vor.outputs['Distance'], .78, 1, .0, .035, y=-780)
            m4 = node(nt, 'ShaderNodeMath', (-300, -560)); m4.operation = 'MULTIPLY'
            nt.links.new(grey, m4.inputs[0]); nt.links.new(joint, m4.inputs[1]); grey = m4.outputs[0]
            cell = node(nt, 'ShaderNodeTexVoronoi', (-800, -1040)); cell.feature = 'F1'; cell.inputs['Scale'].default_value = 1.6
            cell.inputs['Randomness'].default_value = .85; nt.links.new(mp.outputs['Vector'], cell.inputs['Vector'])
            m5 = node(nt, 'ShaderNodeMath', (-300, -820)); m5.operation = 'MULTIPLY'
            nt.links.new(grey, m5.inputs[0]); nt.links.new(remap(cell.outputs['Color'], .955, 1.03, 0, 1, y=-1040), m5.inputs[1]); grey = m5.outputs[0]
            bump_h = vor.outputs['Distance']; strength = .25
        col = multiply(col, grey)
        if bump_h is None:
            bump_h = noise.outputs['Fac']; strength = {'plaster': .08, 'stone': .18, 'paving': .06, 'cotton': .12, 'gravel': .35, 'roof': .10, 'lawn': .25, 'mortar': .1, 'soil': .3}[kind]
    if kind == 'butter':
        bsdf.inputs['Emission Color'].default_value = (*color, 1); bsdf.inputs['Emission Strength'].default_value = .35
    nt.links.new(col, bsdf.inputs['Base Color'])
    if bump_h is not None:
        bump = node(nt, 'ShaderNodeBump', (300, -300)); bump.inputs['Strength'].default_value = strength; bump.inputs['Distance'].default_value = .02
        nt.links.new(bump_h, bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat

def make_glass(name, color, opacity):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    b = mat.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = .075; b.inputs['Alpha'].default_value = opacity
    try: mat.surface_render_method = 'BLENDED'
    except Exception: pass
    return mat

# ---------------------------------------------------------------- import
def import_glb(path, collection):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    for o in objs:
        for c in list(o.users_collection): c.objects.unlink(o)
        collection.objects.link(o)
    for o in [o for o in bpy.data.objects if o not in before and o.type != 'MESH']: bpy.data.objects.remove(o)
    return objs

def clip_to_core(o):
    """Cut ground meshes exactly at the core rectangle (Town x, z -> Blender x, -y)."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    for co, no in (((CORE['minX'], 0, 0), (-1, 0, 0)), ((CORE['maxX'], 0, 0), (1, 0, 0)),
                   ((0, -CORE['maxZ'], 0), (0, -1, 0)), ((0, -CORE['minZ'], 0), (0, 1, 0))):
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, clear_outer=True)
    bm.to_mesh(o.data); bm.free(); o.data.update()

def subdivide_long_edges(o, limit=.45, passes=6):
    """v20 lawn triangles are about 1.5 m: split them so the covered-face test
    below drops only the part that is really under the court or a deck."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    for _ in range(passes):
        long = [e for e in bm.edges if e.calc_length() > limit]
        if not long: break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    # Flat shading from the faces' own winding. (An earlier "flip every face
    # pointing down" rule also flipped the lower facets of the stepping stones,
    # which then baked black; the black wedges it was meant for were holes.)
    for f in bm.faces: f.smooth = False
    bm.to_mesh(o.data); bm.free()
    try:
        with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]): bpy.ops.mesh.customdata_custom_splitnormals_clear()
    except Exception as e: log('custom normals clear failed', o.name, e)
    o.data.update()

def remove_hidden_faces(objs, blockers):
    """Bake texels only for faces somebody can see: drop undersides resting on
    the ground or a deck, faces pressed against another surface (short ray
    along the normal), and ground layers covered by a higher layer (short ray
    straight up: lawn under the court and paths, ground under the decks)."""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    trees = [(o, BVHTree.FromObject(o, dg)) for o in objs + blockers]
    removed = {}
    up = Vector((0, 0, 1))
    # Ground faces may be hidden only by broad continuous covers: building decks
    # (any non-ground part) and the court (paving). Narrow beds, joint lines and
    # stepping stones never hide a lawn face — with them as covers, sparse probes
    # landing on different strips removed lawn faces with gaps between the strips
    # (10-18: see-through holes down to the underlay along the west beds).
    broad = [(o, t) for o, t in trees if o.get('part') != 'ground' or o.get('key') == 'paving']
    def covered(f, direction, dist, skip=None, among=trees):
        # Every probe must hit: centre, the three corners pulled 10% inward and
        # the three edge midpoints. A face only partly under a deck edge stays.
        c = f.calc_center_median(); vs = [v.co for v in f.verts]
        probes = [c] + [v + (c - v) * .1 for v in vs] + [(vs[i] + vs[(i + 1) % len(vs)]) / 2 + (c - (vs[i] + vs[(i + 1) % len(vs)]) / 2) * .1 for i in range(len(vs))]
        return all(any(t.ray_cast(p + direction * 2e-4, direction, dist)[0] is not None for other, t in among if other is not skip) for p in probes)
    for o in objs:
        bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table(); kill = []
        ground = o['part'] == 'ground'
        for f in bm.faces:
            c = f.calc_center_median(); n = f.normal
            if n.z < -.5 and c.z < .135: kill.append(f); continue
            if ground and n.z > .5:
                if covered(f, up, .09, skip=o, among=broad): kill.append(f)
                continue
            if covered(f, n.copy(), .004): kill.append(f)
        removed[o.name] = len(kill)
        bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(o.data); bm.free(); o.data.update()
    return removed

def prepare(objs, part, ref):
    """One material per imported object (the reference has one per v20 material)."""
    out = []
    for o in objs:
        src = o.material_slots[0].material.name if o.material_slots and o.material_slots[0].material else o.name
        info = parse(src); key = info['key']
        layer = o.data.color_attributes[0].name if len(o.data.color_attributes) else None
        color = srgb_hex(info['hex'])
        if key in GLASS or (info['opacity'] is not None and info['opacity'] < .6):
            o.data.materials.clear(); o.data.materials.append(make_glass(f'live_glass_{info["hex"]}', color, info['opacity'] or .29))
            o['part'], o['group'], o['key'], o['glass'] = part, 'glass', key, True
        else:
            kind = KIND.get(key, 'plain')
            map_path = os.path.join(ref, f'map_{info["map"]}.png') if info['map'] is not None else None
            uv_layer = o.data.uv_layers[0].name if len(o.data.uv_layers) else None
            o.data.materials.clear(); o.data.materials.append(make_material(f'src_{part}_{key}_{info["hex"]}', kind, color, ROUGH.get(key, info['rough'] if kind == 'plain' else {'wood': .8}.get(kind, .9)), layer,
                map_path if map_path and os.path.exists(map_path) else None, uv_layer, flag=part == 'ground' and key == 'paving'))
            o['part'], o['group'], o['key'], o['glass'] = part, group_of(part, key), key, False
        o.name = f'{part}__{o["group"]}__{key}'
        if not o['glass']: weld(o)
        out.append(o)
    return out

def weld(o):
    """The reference GLBs are unindexed (every triangle its own vertices), so
    each triangle became its own UV island and the margins ate the atlas (2–9%
    fill on 10-18). Welding joins coplanar neighbours into islands (45–56%);
    shading then comes from smooth-by-angle like the 10-17 cafe build."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(o.data); bm.free()
    try:
        with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]): bpy.ops.mesh.customdata_custom_splitnormals_clear()
    except Exception as e: log('custom normals clear failed', o.name, e)
    for p in o.data.polygons: p.use_smooth = True
    try: o.data.set_sharp_from_angle(angle=math.radians(38))
    except Exception: pass
    o.data.update()

# ---------------------------------------------------------------- world (v20 lights, see spec 5)
def setup_world(sky_path):
    sc = bpy.context.scene
    world = bpy.data.worlds.new('town-sky'); sc.world = world; world.use_nodes = True
    nt = world.node_tree; nt.nodes.clear()
    out = node(nt, 'ShaderNodeOutputWorld', (900, 0)); add = node(nt, 'ShaderNodeAddShader', (650, 0))
    coord = node(nt, 'ShaderNodeTexCoord', (-900, 0))
    mapping = node(nt, 'ShaderNodeMapping', (-700, 200)); mapping.inputs['Rotation'].default_value = (0, 0, math.pi + .65)
    nt.links.new(coord.outputs['Generated'], mapping.inputs['Vector'])
    env = node(nt, 'ShaderNodeTexEnvironment', (-450, 200)); env.image = bpy.data.images.load(sky_path)
    nt.links.new(mapping.outputs['Vector'], env.inputs['Vector'])
    bg1 = node(nt, 'ShaderNodeBackground', (300, 200)); bg1.inputs['Strength'].default_value = .45
    nt.links.new(env.outputs['Color'], bg1.inputs['Color'])
    sep = node(nt, 'ShaderNodeSeparateXYZ', (-450, -200)); nt.links.new(coord.outputs['Generated'], sep.inputs[0])
    step = node(nt, 'ShaderNodeMath', (-250, -200)); step.operation = 'GREATER_THAN'; step.inputs[1].default_value = 0
    nt.links.new(sep.outputs['Z'], step.inputs[0])
    mix = node(nt, 'ShaderNodeMix', (0, -200)); mix.data_type = 'RGBA'; k = .58 / math.pi
    mix.inputs[6].default_value = (*[x * k for x in srgb_hex('#71815e')], 1); mix.inputs[7].default_value = (*[x * k for x in srgb_hex('#d8eaff')], 1)
    nt.links.new(step.outputs[0], mix.inputs['Factor'])
    bg2 = node(nt, 'ShaderNodeBackground', (300, -200)); bg2.inputs['Strength'].default_value = 1
    nt.links.new(mix.outputs[2], bg2.inputs['Color'])
    nt.links.new(bg1.outputs[0], add.inputs[0]); nt.links.new(bg2.outputs[0], add.inputs[1]); nt.links.new(add.outputs[0], out.inputs['Surface'])
    def sun(name, color, strength, toward, angle):
        ld = bpy.data.lights.new(name, 'SUN'); ld.energy = strength; ld.color = color; ld.angle = math.radians(angle)
        ob = bpy.data.objects.new(name, ld); sc.collection.objects.link(ob)
        ob.rotation_euler = Vector(toward).normalized().to_track_quat('Z', 'Y').to_euler()
    sun('sun', srgb_hex('#fff3de'), 3.15, (-9, -7, 11), 1.5)
    sun('fill', srgb_hex('#cddfff'), .18, (8, 10, 4), 4)

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

# ---------------------------------------------------------------- build
def stage_build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for name in ('town', 'occluders'): bpy.context.scene.collection.children.link(bpy.data.collections.new(name))
    ref = os.path.abspath(arg('--ref')); town, occ = bpy.data.collections['town'], bpy.data.collections['occluders']
    t0 = time.time()
    # Occluders: live vegetation and the outer ring, the cafe (rebaked by the
    # 10-17 cafe-claude.glb, here only for shadows), and parts not rebuilt now.
    occluder_files = ['v20_live.glb', 'v20_cafe.glb'] + [f'v20_{p}.glb' for p in ('home', 'workshop', 'greenhouse') if p not in PARTS]
    if 'ground' not in PARTS: occluder_files.append('v20_town_ground.glb')
    for f in occluder_files:
        for o in import_glb(os.path.join(ref, f), occ):
            o['occluder'] = True; o['source'] = f
            # Street furniture near the export camera came out faded (v20
            # occlusion fading, opacity .14): occluders cast full shadows.
            for slot in o.material_slots:
                mt = slot.material
                if mt and parse(mt.name)['key'] not in GLASS and mt.use_nodes and 'Principled BSDF' in mt.node_tree.nodes:
                    alpha = mt.node_tree.nodes['Principled BSDF'].inputs['Alpha']
                    for link in list(alpha.links): mt.node_tree.links.remove(link)
                    alpha.default_value = 1
                    try: mt.surface_render_method = 'DITHERED'
                    except Exception: pass
    objs = []
    for part in PARTS:
        imported = import_glb(os.path.join(ref, 'v20_town_ground.glb' if part == 'ground' else f'v20_{part}.glb'), town)
        objs += prepare(imported, part, ref)
    for o in objs:
        if o['part'] == 'ground': clip_to_core(o); subdivide_long_edges(o)
    bake_objs = [o for o in objs if not o['glass']]
    # Live grass and trees never hide a ground face (grass grows on the baked lawn).
    removed = remove_hidden_faces(bake_objs, [o for o in occ.objects if o.type == 'MESH' and o.get('source') != 'v20_live.glb'])
    log('removed hidden faces', sum(removed.values()))
    setup_world(os.path.abspath(arg('--sky'))); setup_cycles(64)
    tris = {}
    for o in objs:
        k = f'{o["part"]}/{o["group"]}'; tris[k] = tris.get(k, 0) + sum(len(p.vertices) - 2 for p in o.data.polygons)
    log('built', len(objs), 'objects in', round(time.time() - t0, 1), 's', tris)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, 'build.blend'))
    if arg('--preview', '1') == '1':
        # Quick material check before a long bake (Town camera poses, 32 samples).
        sc = bpy.context.scene; sc.render.resolution_x, sc.render.resolution_y = 960, 675; sc.cycles.samples = 32
        for name, (p, t, fov) in PREVIEW_CAMERAS.items():
            cam = bpy.data.cameras.new(name); cam.sensor_fit = 'VERTICAL'; cam.angle_y = math.radians(fov)
            ob = bpy.data.objects.new('cam_' + name, cam); sc.collection.objects.link(ob)
            pb, tb = Vector((p[0], -p[2], p[1])), Vector((t[0], -t[2], t[1]))
            ob.location = pb; ob.rotation_euler = (tb - pb).to_track_quat('-Z', 'Y').to_euler()
            sc.camera = ob; sc.render.filepath = os.path.join(WORK, f'build-{name}.png'); bpy.ops.render.render(write_still=True)
    json.dump({'parts': PARTS, 'triangles': tris, 'removedHiddenFaces': removed, 'seconds': round(time.time() - t0, 1)}, open(os.path.join(WORK, 'build.json'), 'w'), indent=2)

# ---------------------------------------------------------------- bake (same passes as the cafe, 10-17)
def fill_dead_texels(rgb, passes=8, valid=None):
    """Grow the baked islands into the empty texels around them. `valid` (the
    texels the full pass covered) keeps the sun pass's true shade from being filled."""
    lum = rgb.mean(axis=2); valid = (lum > 1e-4) if valid is None else valid.copy(); out = rgb.copy()
    for _ in range(passes):
        acc = np.zeros_like(out); cnt = np.zeros(lum.shape, np.float32)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            v = np.roll(valid, (dy, dx), (0, 1)); c = np.roll(out, (dy, dx), (0, 1))
            acc += c * v[..., None]; cnt += v
        grow = (~valid) & (cnt > 0)
        out[grow] = acc[grow] / cnt[grow][:, None]; valid = valid | grow
    return out

def box_blur(a, r):
    k = 2 * r + 1; p = np.pad(a, r, mode='edge'); c = p.cumsum(0).cumsum(1); c = np.pad(c, ((1, 0), (1, 0)))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)

def to_srgb(lin):
    return np.where(lin <= .0031308, lin * 12.92, 1.055 * np.power(np.clip(lin, 0, None), 1 / 2.4) - .055)

def unwrap(objs, res, group=None):
    margin = GROUP_MARGIN.get(group, MARGIN_PX) / res
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
        if 'bake' not in o.data.uv_layers: o.data.uv_layers.new(name='bake')
        o.data.uv_layers.active = o.data.uv_layers['bake']
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    if GROUP_METHOD.get(group) == 'lightmap':
        # PREF_MARGIN_DIV: 0.2 gave ~2 px gaps at 2048 in the 10-18 trial.
        bpy.ops.uv.lightmap_pack(PREF_CONTEXT='ALL_FACES', PREF_PACK_IN_ONE=True, PREF_NEW_UVLAYER=False, PREF_MARGIN_DIV=.2)
        bpy.ops.object.mode_set(mode='OBJECT')
        if group in GROUP_MIN_ISLAND: log('--min-island is not applied to lightmap-packed groups', group)
        return
    bpy.ops.uv.smart_project(angle_limit=math.radians(ANGLE_LIMIT), island_margin=margin, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, rotate_method='ANY', scale=True, shape_method='CONCAVE', margin_method='SCALED', margin=margin)
    bpy.ops.object.mode_set(mode='OBJECT')
    if group in GROUP_MIN_ISLAND:
        # Islands thinner than a texel or two never get a texel centre, stay
        # unbaked and show black (10-18: the neighbours' shutter battens were
        # 0.7 px tall). Widen them across, then pack again; twice, since each
        # pack scales everything down a little.
        for _ in range(2):
            log('widened thin islands', group, widen_thin_islands(objs, res, GROUP_MIN_ISLAND[group] * 1.2))
            bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.select_all(action='SELECT')
            bpy.ops.uv.pack_islands(rotate=True, rotate_method='ANY', scale=True, shape_method='CONCAVE', margin_method='SCALED', margin=margin)
            bpy.ops.object.mode_set(mode='OBJECT')
        log('thin islands left', group, widen_thin_islands(objs, res, GROUP_MIN_ISLAND[group], dry=True))

def widen_thin_islands(objs, res, min_px, dry=False):
    """Stretch every UV island narrower than min_px texels along its thin axis
    (principal axes of its UV points) to min_px. Returns how many islands."""
    from bpy_extras import bmesh_utils
    n = 0
    for o in objs:
        bm = bmesh.new(); bm.from_mesh(o.data); uv = bm.loops.layers.uv['bake']
        for island in bmesh_utils.bmesh_linked_uv_islands(bm, uv):
            loops = [l for f in island for l in f.loops]
            pts = np.array([tuple(l[uv].uv) for l in loops]) * res
            c = pts.mean(axis=0); q = pts - c
            if len(pts) < 3 or not np.isfinite(q).all(): continue
            _, vecs = np.linalg.eigh(q.T @ q)
            minor = vecs[:, 0]; width = np.ptp(q @ minor)
            if width >= min_px: continue
            n += 1
            if dry: continue
            s = min_px / max(width, .05)
            q = q + np.outer(q @ minor, minor) * (s - 1)
            for l, p in zip(loops, (q + c) / res): l[uv].uv = p
        if not dry: bm.to_mesh(o.data)
        bm.free()
    return n

def groups_of(part):
    """Atlas groups of a part: the fixed Claude order, then any group the build stage set on the objects."""
    found = {o['group'] for o in bpy.data.collections['town'].objects if o.type == 'MESH' and o.get('part') == part and not o.get('glass')}
    return [g for g in GROUPS.get(part, []) if g in found] + sorted(found - set(GROUPS.get(part, [])))

def drop_live_ground_in_core():
    """The live reference keeps every v20 ground triangle whose centre lies
    outside the core, so triangles straddling the border reach into it, flat
    and coplanar with the clipped baked ground. As occluders they baked into
    the west lawn as light/dark wedges (10-18). Drop those faces for the bake
    (flat ones only: stone walls outside the core still cast their shadows)."""
    n = 0
    rect = OUTER if any(o.get('part') == 'ring' for o in bpy.data.collections['town'].objects) else CORE
    for o in bpy.data.collections['occluders'].objects:
        if o.type != 'MESH' or o.get('source') != 'v20_live.glb' or not o.material_slots or not o.material_slots[0].material: continue
        if KIND.get(parse(o.material_slots[0].material.name)['key']) not in ('lawn', 'soil', 'stone', 'paving', 'mortar', 'gravel'): continue
        bm = bmesh.new(); bm.from_mesh(o.data); mw = o.matrix_world; drop = []
        for f in bm.faces:
            pts = [mw @ v.co for v in f.verts]
            if max(p.z for p in pts) > .35: continue
            if max(p.x for p in pts) <= rect['minX'] or min(p.x for p in pts) >= rect['maxX']: continue
            if max(p.y for p in pts) <= -rect['maxZ'] or min(p.y for p in pts) >= -rect['minZ']: continue
            drop.append(f)
        if drop:
            bmesh.ops.delete(bm, geom=drop, context='FACES'); bm.to_mesh(o.data); o.data.update(); n += len(drop)
        bm.free()
    return n

def refresh_meshes(parts):
    """Put back the build.blend meshes of these parts' baked objects (the objects,
    their properties and materials stay). 10-18: the first face clean deleted a
    neighbour's front wall and a gable inside bake.blend, so a resumed bake needs
    the built meshes again before the better clean runs."""
    objs = [o for o in bpy.data.collections['town'].objects if o.type == 'MESH' and o.get('part') in parts and not o.get('glass')]
    with bpy.data.libraries.load(os.path.join(WORK, 'build.blend'), link=False) as (src, dst):
        dst.meshes = [o.data.name for o in objs]
    n = 0
    for o, me in zip(objs, dst.meshes):
        if me is None: log('no built mesh for', o.name); continue
        old = o.data
        # The baked mesh has the same slots as the built one (baking adds none), so
        # take its materials slot by slot; the name fallback is for a changed build
        # (the claude variant has same-named src_ materials with .001 suffixes).
        if len(old.materials) == len(me.materials):
            for i, m in enumerate(old.materials): me.materials[i] = m
        else:
            log('slot count changed, matching materials by name', o.name)
            for i, m in enumerate(me.materials):
                own = bpy.data.materials.get(re.sub(r'\.\d{3}$', '', m.name)) if m else None
                if own and own is not m: me.materials[i] = own
        name = old.name; o.data = me; bpy.data.meshes.remove(old); me.name = name; n += 1
    return n

def stage_bake():
    # --resume 1 continues a bake that stopped (10-18: the app quit with 15 of 16
    # atlases done): reopen bake.blend, which keeps the finished atlases' UVs, and
    # skip every atlas whose PNG and bake.json entry are already there.
    resume = arg('--resume') == '1' and os.path.exists(os.path.join(WORK, 'bake.blend')) and os.path.exists(os.path.join(WORK, 'bake.json'))
    bpy.ops.wm.open_mainfile(filepath=os.path.join(WORK, 'bake.blend' if resume else 'build.blend'))
    samples = int(arg('--samples', '1024')); setup_cycles(samples); sc = bpy.context.scene
    report = json.load(open(os.path.join(WORK, 'bake.json'))) if resume else {'samples': samples, 'resolution': RES, 'atlases': {}}
    # An atlas is done when its bake.json entry and its PNG are both there (the
    # same test the loop below skips by). --refresh and --clean touch only parts
    # with no atlas done: the meshes of a part carry the bake UVs of all its
    # atlases, so a part with one atlas done keeps its meshes (remove the entry or
    # the PNG of every atlas of the part to redo it).
    def atlas_done(p, g):
        name = f'town-{VARIANT}-{p}-{g}'
        return resume and name in report['atlases'] and os.path.exists(os.path.join(WORK, name + '.png'))
    def unbaked(names):
        return [p for p in names if not any(atlas_done(p, g) for g in groups_of(p))]
    for flag in ('--refresh', '--clean'):
        kept = [p for p in (arg(flag) or '').split(',') if p and p not in unbaked([p])]
        if kept: log(flag, 'skipped for parts with an atlas done', kept)
    if arg('--refresh') and not resume: log('--refresh needs --resume 1 and a bake.blend; skipped')
    # --refresh <part,...> (with --resume): those parts' meshes come back from build.blend.
    if resume and arg('--refresh') and unbaked(arg('--refresh').split(',')):
        parts = unbaked(arg('--refresh').split(','))
        log('refreshed meshes', parts, refresh_meshes(parts))
    town = [o for o in bpy.data.collections['town'].objects if o.type == 'MESH' and not o['glass']]
    log('dropped live ground faces in the core', drop_live_ground_in_core())
    # --clean <part,...>: flip inward faces and drop buried ones before unwrapping
    # (../../blender-merged-20261018/blender/clean_faces.py; merged_build.py does
    # the same at build time — this is for a resumed bake of an older build).
    if arg('--clean') and unbaked(arg('--clean').split(',')):
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'blender-merged-20261018', 'blender'))
        from clean_faces import clean_faces
        parts = unbaked(arg('--clean').split(','))
        log('cleaned faces', parts, clean_faces([o for o in town if o['part'] in parts]))
    for part in PARTS:
        # Ground layers lie 1-6 mm over each other (paths over gravel, beds over
        # lawn). Baked with each other as occluders, the lower layer went black
        # and showed through in Town as notches and wedges (10-18). v20's ground
        # pieces cast no shadows either (batch(..., cast=false)), so while the
        # ground bakes, ground objects are invisible to shadow and bounce rays.
        # The ground ring of the merged town is the same kind of layer (10-18).
        for o in town:
            if o['part'] in GROUND_PARTS:
                flat = part in GROUND_PARTS
                o.visible_shadow = not flat; o.visible_diffuse = not flat; o.visible_glossy = not flat
        for group in groups_of(part):
            objs = [o for o in town if o['part'] == part and o['group'] == group]
            if not objs: continue
            if atlas_done(part, group):
                log('already baked', f'town-{VARIANT}-{part}-{group}'); continue
            t0 = time.time(); res = RES; unwrap(objs, res, group)
            def poly_area(pts):
                return abs(sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))) / 2
            uv_fill = sum(poly_area([tuple(o.data.uv_layers['bake'].data[i].uv) for i in p.loop_indices]) for o in objs for p in o.data.polygons)
            log('uv fill', part, group, round(uv_fill, 3))
            images = {p: bpy.data.images.new(f'{part}_{group}_{p}', res, res, alpha=False, float_buffer=True) for p in ('full', 'sun')}
            def target(img):
                for o in objs:
                    for mt in o.data.materials:
                        nt = mt.node_tree; n = nt.nodes.get('bake_target') or nt.nodes.new('ShaderNodeTexImage')
                        n.name = 'bake_target'; n.image = img; n.location = (900, -400); nt.nodes.active = n
            bpy.ops.object.select_all(action='DESELECT')
            for o in objs: o.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            sc.cycles.samples = GROUP_SAMPLES.get(group, samples)
            target(images['full'])
            # No bake margin: Blender grows each object's margin on its own, over
            # the islands of the other objects in the same atlas. With 2 px between
            # the neighbour pieces, a wood door's margin painted the sage door planks
            # of another house tan (10-18, albedo baked with margin 0 and 16).
            # fill_dead_texels and compress-glb's push-pull fill the gaps instead.
            bpy.ops.object.bake(type='COMBINED', pass_filter={'DIRECT', 'INDIRECT', 'DIFFUSE', 'GLOSSY', 'EMIT'}, margin=0, use_clear=True, target='IMAGE_TEXTURES')
            strengths = [(n, n.inputs['Strength'].default_value) for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND']
            for n, _ in strengths: n.inputs['Strength'].default_value = 0
            fill = bpy.data.objects['fill']; fill.hide_render = True; sc.cycles.samples = max(128, GROUP_SAMPLES.get(group, samples) // 2)
            target(images['sun'])
            bpy.ops.object.bake(type='COMBINED', pass_filter={'DIRECT', 'DIFFUSE'}, margin=0, use_clear=True, target='IMAGE_TEXTURES')
            for n, s in strengths: n.inputs['Strength'].default_value = s
            fill.hide_render = False; sc.cycles.samples = samples
            def read(img):
                a = np.empty(res * res * 4, dtype=np.float32); img.pixels.foreach_get(a); return a.reshape(res, res, 4)[..., :3]
            raw = read(images['full']); covered = raw.mean(axis=2) > 1e-4
            full, sun = fill_dead_texels(raw), fill_dead_texels(read(images['sun']), valid=covered)
            lum_full, lum_sun = full.mean(axis=2), sun.mean(axis=2)
            share = np.clip(lum_sun / np.maximum(lum_full, 1e-4), 0, 1); share[lum_full < .03] = 0; share = box_blur(share, 2)
            enc = np.concatenate([np.clip(to_srgb(full * .5), 0, 1), share[..., None]], axis=2)
            name = f'town-{VARIANT}-{part}-{group}'
            out = bpy.data.images.new(name, res, res, alpha=True); out.pixels.foreach_set(enc.astype(np.float32).ravel())
            out.filepath_raw = os.path.join(WORK, name + '.png'); out.file_format = 'PNG'; out.save()
            report['atlases'][name] = {'objects': len(objs), 'uvFill': round(uv_fill, 3), 'samples': GROUP_SAMPLES.get(group, samples), 'seconds': round(time.time() - t0, 1), 'radiance_p50': float(np.median(full)),
                                       'clipped_fraction': float((full * .5 > 1).mean())}
            log('baked', name, report['atlases'][name])
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, 'bake.blend'))
            json.dump(report, open(os.path.join(WORK, 'bake.json'), 'w'), indent=2)

# ---------------------------------------------------------------- export (one GLB per part)
def stage_export():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(WORK, 'bake.blend'))
    out_dir = os.path.abspath(arg('--out')); os.makedirs(out_dir, exist_ok=True)
    report = {}
    for part in PARTS:
        objs = [o for o in bpy.data.collections['town'].objects if o.type == 'MESH' and o['part'] == part]
        keep = []
        for group in groups_of(part):
            # Joining removes objects: look them up again for every group (10-17 cafe lesson).
            g = [o for o in bpy.data.collections['town'].objects if o.type == 'MESH' and o.get('part') == part and o.get('group') == group and o not in keep]
            if not g: continue
            name = f'town-{VARIANT}-{part}-{group}'
            img = bpy.data.images.load(os.path.join(WORK, name + '.png'), check_existing=False); img.alpha_mode = 'CHANNEL_PACKED'
            m = bpy.data.materials.new(f'bake_{part}_{group}'); m.use_nodes = True; nt = m.node_tree
            bsdf = nt.nodes['Principled BSDF']; tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
            nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color']); nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
            bsdf.inputs['Roughness'].default_value = 1; m['synk_bake_scale'] = 2.0; m['synk_sun_alpha'] = 1
            # Objects tagged with a house (the neighbours) join per house, so Town can
            # hang each house's meshes under its own root and fade houses one by one.
            # Partition first: joining removes the joined objects from the file.
            by_house = {}
            for o in g: by_house.setdefault(o.get('house', ''), []).append(o)
            for house, hg in sorted(by_house.items()):
                bpy.ops.object.select_all(action='DESELECT')
                for o in hg:
                    o.select_set(True); o.data.materials.clear(); o.data.materials.append(m)
                    for n in [l.name for l in o.data.uv_layers if l.name != 'bake']: o.data.uv_layers.remove(o.data.uv_layers[n])
                    for n in [a.name for a in o.data.color_attributes]: o.data.color_attributes.remove(o.data.color_attributes[n])
                bpy.context.view_layer.objects.active = hg[0]; bpy.ops.object.join()
                j = bpy.context.view_layer.objects.active; j.name = j.data.name = f'{part}_{group}' + (f'_{house}' if house else ''); keep.append(j)
        all_glass = [o for o in bpy.data.collections['town'].objects if o.type == 'MESH' and o.get('part') == part and o.get('glass') and o not in keep]
        glass_by_house = {}
        for o in all_glass: glass_by_house.setdefault(o.get('house', ''), []).append(o)
        for house, glass in sorted(glass_by_house.items()):
            # One glass material per name: a second new('live_glass') becomes live_glass.001,
            # which Town would not recognise. The greenhouse panes are v20's thinner glass.
            glass_name = 'live_glass_thin' if part == 'greenhouse' else 'live_glass'
            gm = bpy.data.materials.get(glass_name) or bpy.data.materials.new(glass_name); gm.use_nodes = True
            b = gm.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*srgb_hex('#d6e7eb'), 1)
            b.inputs['Roughness'].default_value = .075; b.inputs['Alpha'].default_value = .29
            bpy.ops.object.select_all(action='DESELECT')
            for o in glass:
                o.select_set(True); o.data.materials.clear(); o.data.materials.append(gm)
                for n in [l.name for l in o.data.uv_layers]: o.data.uv_layers.remove(o.data.uv_layers[n])
                for n in [a.name for a in o.data.color_attributes]: o.data.color_attributes.remove(o.data.color_attributes[n])
            bpy.context.view_layer.objects.active = glass[0]; bpy.ops.object.join()
            j = bpy.context.view_layer.objects.active; j.name = j.data.name = f'{part}_glass' + (f'_{house}' if house else ''); keep.append(j)
        bpy.ops.object.select_all(action='DESELECT')
        for k in keep: k.select_set(True)
        path = os.path.join(out_dir, f'town-{VARIANT}-{part}-raw.glb')
        kwargs = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_extras=True,
                      export_texcoords=True, export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False,
                      export_animations=False, export_image_format='WEBP', export_image_quality=90)
        props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
        for k in [k for k in kwargs if k not in props]: kwargs.pop(k)
        bpy.ops.export_scene.gltf(**kwargs)
        report[part] = {'glb': path, 'bytes': os.path.getsize(path), 'meshes': len(keep),
                        'triangles': {k.name: sum(len(p.vertices) - 2 for p in k.data.polygons) for k in keep}}
        log('exported', part, report[part]['bytes'], 'bytes', sum(report[part]['triangles'].values()), 'tris')
    json.dump(report, open(os.path.join(WORK, 'export.json'), 'w'), indent=2)

if __name__ == '__main__':   # merged_build.py imports the helpers above
    {'build': stage_build, 'bake': stage_bake, 'export': stage_export}[STAGE]()

# Does Argon's ground ring cover the whole ring (flat town bounds minus the core
# rectangle) with no gap, and how far does Argon's core ground reach outside the core?
#   blender -b -P ring_cover_check.py -- --ring <Argon outer-ring folder> --ref <dir holding reference/>
# Prints the share of 0.25 m grid points with no ring surface under them, and the
# bounding box of the core ground objects.
import bpy, sys, os, json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
arg = lambda n: ARGV[ARGV.index(n) + 1] if n in ARGV else None
HERE = os.path.dirname(os.path.abspath(__file__)); QA = os.path.dirname(os.path.dirname(HERE))
ring_dir = os.path.abspath(arg('--ring')); ref = os.path.abspath(arg('--ref'))
sys.path[:0] = [os.path.join(ring_dir, 'scripts'), os.path.join(QA, 'blender-town-20261018', 'argon', 'scripts'), os.path.join(QA, 'blender-district-20261017', 'argon')]
bpy.ops.wm.read_factory_settings(use_empty=True)
import mat_builder, ring_geo, ground_geo
ring_geo.ROOT = ring_dir; ground_geo.ROOT = ref
ring = ring_geo.build_all_ring_meshes(mat_builder.build_procedural_materials())
for o in list(ring.values()):
    for s in o.material_slots:
        if s.material: s.material.name = 'ring:' + s.material.name
core = ground_geo.build_all_ground_meshes(mat_builder.build_procedural_materials())
dg = bpy.context.evaluated_depsgraph_get()
trees = [BVHTree.FromObject(o, dg) for o in ring.values()]
OUT, CORE = dict(minX=-22.6, maxX=22.6, minZ=-25.4, maxZ=9.6), dict(minX=-13.6, maxX=13.6, minZ=-12.2, maxZ=8.7)
miss, total, misses = 0, 0, []
x = OUT['minX'] + .05
while x < OUT['maxX']:
    z = OUT['minZ'] + .05
    while z < OUT['maxZ']:
        if not (CORE['minX'] < x < CORE['maxX'] and CORE['minZ'] < z < CORE['maxZ']):
            total += 1
            if not any(t.ray_cast(Vector((x, -z, 5)), Vector((0, 0, -1)), 10)[0] is not None for t in trees):
                miss += 1
                if len(misses) < 12: misses.append((round(x, 2), round(z, 2)))
        z += .25
    x += .25
def box(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return {'minX': round(min(p.x for p in pts), 2), 'maxX': round(max(p.x for p in pts), 2), 'minZ': round(min(-p.y for p in pts), 2), 'maxZ': round(max(-p.y for p in pts), 2)}
print('RINGCHECK', json.dumps({'points': total, 'missing': miss, 'share': round(miss / max(1, total), 4), 'firstMisses': misses,
      'ringBox': box(ring.values()), 'coreGroundBox': box(core.values()),
      'coreObjectsOutside': {k: box([o]) for k, o in core.items() if box([o])['minX'] < CORE['minX'] - .01 or box([o])['maxX'] > CORE['maxX'] + .01 or box([o])['minZ'] < CORE['minZ'] - .01 or box([o])['maxZ'] > CORE['maxZ'] + .01}}))

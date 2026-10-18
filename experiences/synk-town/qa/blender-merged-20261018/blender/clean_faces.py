# Face clean-up for modelled geometry before baking (10-18, the neighbour houses).
# Argon's neighbour houses had faces whose normal points into a solid (they bake
# black: the bake ray starts inside) and faces buried in other pieces (black too,
# and they ate the atlas: most of the wall atlas was black islands). For every
# face, cast a short ray along the normal and against it through all the given
# objects together:
#   front side inside a solid (first hit is a back face) and back side open -> flip
#   both sides inside a solid -> buried, delete
#   undersides resting on the ground (normal down, below 0.135 m) -> delete
# A face is judged at several points, not at its centre alone: the first pass
# (centre only) deleted a whole front wall whose centre sat behind the door and a
# gable whose centre sat behind a beam (10-18). Flip or delete only when every
# point agrees, so a face that is open anywhere stays as it is.
# Objects must carry world coordinates (identity transform), as Argon's do.
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def sample_points(f, mw, c, inset=.8, most=8):
    """Face centre plus points inset toward each corner and each edge middle."""
    vs = [mw @ v.co for v in f.verts]
    if len(vs) > most: vs = [vs[round(i * len(vs) / most) % len(vs)] for i in range(most)]
    mids = [(vs[i] + vs[(i + 1) % len(vs)]) / 2 for i in range(len(vs))]
    return [c] + [c + (p - c) * inset for p in vs + mids]


def clean_faces(objs, reach=.6, ground=.135):
    verts, polys, owner = [], [], []
    for oi, o in enumerate(objs):
        mw = o.matrix_world; base = len(verts)
        verts.extend(mw @ v.co for v in o.data.vertices)
        for p in o.data.polygons:
            polys.append([base + i for i in p.vertices]); owner.append(oi)
    tree = BVHTree.FromPolygons(verts, polys, all_triangles=False)

    def inside(c, d):
        loc, nrm, idx, dist = tree.ray_cast(c + d * 1e-3, d, reach)
        return loc is not None and nrm.dot(d) > 0

    report = {'faces': len(polys), 'flipped': 0, 'buried': 0, 'undersides': 0, 'largestBuried': 0.0}
    for o in objs:
        bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table(); mw = o.matrix_world
        flip, kill = [], []
        for f in bm.faces:
            n = (mw.to_3x3() @ f.normal)
            if n.length < .5: continue
            n.normalize(); c = mw @ f.calc_center_median()
            if n.z < -.5 and c.z < ground: kill.append(f); report['undersides'] += 1; continue
            pts = sample_points(f, mw, c)
            if not all(inside(p, n) for p in pts): continue
            backs = [inside(p, -n) for p in pts]
            if all(backs):
                kill.append(f); report['buried'] += 1
                report['largestBuried'] = max(report['largestBuried'], round(f.calc_area(), 4))
            elif not any(backs): flip.append(f); report['flipped'] += 1
        if flip: bmesh.ops.reverse_faces(bm, faces=flip)
        if kill: bmesh.ops.delete(bm, geom=kill, context='FACES')
        bm.to_mesh(o.data); bm.free(); o.data.update()
    return report


if __name__ == '__main__':
    # Trial on a build.blend: blender -b <work>/build.blend -P clean_faces.py
    import json
    objs = [o for o in bpy.data.collections['town'].objects if o.type == 'MESH' and o.get('part') == 'neighbours' and not o.get('glass')]
    print('CLEAN', json.dumps(clean_faces(objs)))

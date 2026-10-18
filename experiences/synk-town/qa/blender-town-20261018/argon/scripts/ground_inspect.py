import bpy
import bmesh
import os
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, "reference", "v20_town_ground.glb"))

def get_islands_with_vcol(obj):
    me = obj.data
    # Map vertex index to loop color
    v_col = {}
    if len(me.color_attributes) > 0:
        ca = me.color_attributes[0]
        for poly in me.polygons:
            for vi, li in zip(poly.vertices, poly.loop_indices):
                c = ca.data[li].color
                v_col[vi] = (round(c[0], 4), round(c[1], 4), round(c[2], 4))

    bm = bmesh.new()
    bm.from_mesh(me)
    # Before remove_doubles, store color on bm verts
    col_layer = bm.verts.layers.float_vector.new("vcol")
    for v in bm.verts:
        c = v_col.get(v.index, (1.0, 1.0, 1.0))
        v[col_layer] = c

    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bm.verts.ensure_lookup_table()
    visited = set()
    islands = []
    for v in bm.verts:
        if v.index in visited:
            continue
        comp = []
        stack = [v]
        visited.add(v.index)
        while stack:
            curr = stack.pop()
            comp.append(curr)
            for e in curr.link_edges:
                other = e.other_vert(curr)
                if other.index not in visited:
                    visited.add(other.index)
                    stack.append(other)
        ix = [c.co.x for c in comp]
        iy = [c.co.z for c in comp]
        iz = [-c.co.y for c in comp]
        cols = [tuple(round(x, 4) for x in c[col_layer]) for c in comp]
        islands.append({
            "verts": len(comp),
            "center": [round(sum(ix)/len(ix), 4), round(sum(iy)/len(iy), 4), round(sum(iz)/len(iz), 4)],
            "tx": [round(min(ix), 4), round(max(ix), 4)],
            "ty": [round(min(iy), 4), round(max(iy), 4)],
            "tz": [round(min(iz), 4), round(max(iz), 4)],
            "sample_col": cols[0],
        })
    bm.free()
    return islands

summary = {}
for obj in sorted(bpy.data.objects, key=lambda o: o.name):
    if obj.type == 'MESH':
        isl = get_islands_with_vcol(obj)
        summary[obj.name] = {
            "count": len(isl),
            "islands": isl,
        }

with open(os.path.join(ROOT, "work", "ground_islands_detail.json"), "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)
print("Done:", {k: v["count"] for k, v in summary.items()})

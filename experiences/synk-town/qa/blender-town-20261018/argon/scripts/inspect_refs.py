import bpy
import os
import json
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ref_dir = os.path.join(ROOT, "reference")

files = [
    "v20_home.glb",
    "v20_workshop.glb",
    "v20_greenhouse.glb",
    "v20_town_ground.glb",
    "v20_live.glb",
]

summary = {}

for fname in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    fpath = os.path.join(ref_dir, fname)
    bpy.ops.import_scene.gltf(filepath=fpath)
    meshes = []
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            me = obj.data
            me.calc_loop_triangles()
            # World bounding box in Blender coords (bx, by, bz) and Town coords (tx=bx, ty=bz, tz=-by)
            verts_w = [obj.matrix_world @ v.co for v in me.vertices]
            if verts_w:
                txs = [v.x for v in verts_w]
                tys = [v.z for v in verts_w]
                tzs = [-v.y for v in verts_w]
                bbox_town = [
                    round(min(txs), 4), round(min(tys), 4), round(min(tzs), 4),
                    round(max(txs), 4), round(max(tys), 4), round(max(tzs), 4),
                ]
            else:
                bbox_town = []
            mats = [m.name for m in me.materials if m]
            vcols = [ca.name for ca in me.color_attributes]
            meshes.append({
                "name": obj.name,
                "verts": len(me.vertices),
                "tris": len(me.loop_triangles),
                "mats": mats,
                "vcols": vcols,
                "bbox_town": bbox_town,
            })
    summary[fname] = meshes

os.makedirs(os.path.join(ROOT, "work"), exist_ok=True)
out_path = os.path.join(ROOT, "work", "ref_inspect.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)
print("INSPECT_DONE:", out_path)

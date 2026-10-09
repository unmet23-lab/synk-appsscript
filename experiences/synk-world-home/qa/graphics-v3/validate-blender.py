import bpy, json, pathlib
root=pathlib.Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'scene-assets/graphics-v3/mongle-v3.glb'))
meshes=[o for o in bpy.data.objects if o.type=='MESH']
report={'blender':bpy.app.version_string,'meshObjects':len(meshes),'materials':len(bpy.data.materials),'images':len(bpy.data.images),'triangles':sum(len(o.data.loop_triangles) for o in meshes),'nodes':sorted(o.name for o in bpy.data.objects),'finiteVertices':all(all(abs(float(x))<1000 for x in v.co) for o in meshes for v in o.data.vertices),'rigged':any(o.type=='ARMATURE' for o in bpy.data.objects),'validated':'GLB import only, not native rendering or game-device performance'}
for o in meshes:o.data.calc_loop_triangles()
report['triangles']=sum(len(o.data.loop_triangles) for o in meshes)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'scene-assets/graphics-v3/mongle-v3.blend'))
(pathlib.Path(__file__).parent/'blender-import.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report))

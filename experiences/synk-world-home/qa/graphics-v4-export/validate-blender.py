import bpy, json, pathlib, math, hashlib
root=pathlib.Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(root/'scene-assets/graphics-v4/mongle-v4.glb'))
meshes=[o for o in bpy.data.objects if o.type=='MESH']
for o in meshes:o.data.calc_loop_triangles()
materials=[]
for material in bpy.data.materials:
    nodes=list(material.node_tree.nodes) if material.use_nodes else []
    materials.append({'name':material.name,'images':[node.image.name for node in nodes if node.type=='TEX_IMAGE' and node.image], 'normalMap':any(node.type=='NORMAL_MAP' for node in nodes),'vertexColour':any(node.type in {'VERTEX_COLOR','ATTRIBUTE'} for node in nodes)})
report={'blender':bpy.app.version_string,'sourceGlbSha256':hashlib.sha256((root/'scene-assets/graphics-v4/mongle-v4.glb').read_bytes()).hexdigest(),'meshObjects':len(meshes),'materials':materials,'images':len(bpy.data.images),'triangles':sum(len(o.data.loop_triangles) for o in meshes),'nodes':sorted(o.name for o in bpy.data.objects),'finiteVertices':all(all(math.isfinite(float(x)) and abs(float(x))<1000 for x in v.co) for o in meshes for v in o.data.vertices),'vertexColorMeshes':sum(bool(o.data.color_attributes) for o in meshes),'uvMeshes':sum(bool(o.data.uv_layers) for o in meshes),'rigged':any(o.type=='ARMATURE' for o in bpy.data.objects),'validated':'GLB import, embedded textures, material nodes, colour attributes, UVs and editable file only; not Unity rendering or device performance'}
assert report['finiteVertices'] and report['vertexColorMeshes']==len(meshes) and report['uvMeshes']==len(meshes)
assert any(m['normalMap'] for m in materials)
assert bpy.data.objects.get('mongle-scarf-first-steps') and bpy.data.objects.get('mongle-apron-starter')
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(root/'scene-assets/graphics-v4/mongle-v4.blend'),compress=True)
(pathlib.Path(__file__).parent/'blender-import.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report))

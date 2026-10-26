# Claude 몫: 아르곤이 만든 residents.blend에서 높은 판(<id>_<부위>_high)의 펠트를 낮은 판(<id>_<부위>)의
# UV `bake` 한 장에 굽고(색 · 법선 · 그늘), 주민마다 GLB 하나로 내보낸다. 눈은 굽지 않고 유광 구슬 재질 그대로 둔다.
#   blender.exe -b work/residents.blend -P claude_bake_export.py -- <나올 폴더> [해상도=1024] [샘플=96]
import bpy, os, sys, json, time, traceback

RESIDENTS = ('bun', 'bean', 'ricecake')


def gpu(scene):
    scene.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for kind in ('OPTIX', 'CUDA'):
            try:
                prefs.compute_device_type = kind
                prefs.get_devices()
                if any(d.type == kind for d in prefs.devices):
                    for d in prefs.devices:
                        d.use = d.type == kind
                    scene.cycles.device = 'GPU'
                    return kind
            except TypeError:
                continue
    except Exception:
        pass
    return 'CPU'


def image_node(mat, image):
    nt = mat.node_tree
    node = nt.nodes.get('claude_bake_target') or nt.nodes.new('ShaderNodeTexImage')
    node.name = 'claude_bake_target'
    node.image = image
    nt.nodes.active = node
    node.select = True
    return node


def bake(kind, low, high, image, first, samples):
    scene = bpy.context.scene
    for mat in low.data.materials:
        if mat and mat.use_nodes:
            image_node(mat, image)
    bpy.ops.object.select_all(action='DESELECT')
    if high:
        high.hide_render = False
        high.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    scene.cycles.samples = samples if kind != 'NORMAL' else 1
    b = scene.render.bake
    b.use_selected_to_active = bool(high)
    b.cage_extrusion = .025
    b.max_ray_distance = .06
    b.margin = 8
    b.margin_type = 'EXTEND'
    b.use_clear = first
    b.target = 'IMAGE_TEXTURES'
    if kind == 'DIFFUSE':
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_selected_to_active=bool(high), use_clear=first, margin=8)
    elif kind == 'AO':
        bpy.ops.object.bake(type='AO', use_selected_to_active=bool(high), use_clear=first, margin=8)
    else:
        b.normal_space = 'TANGENT'
        bpy.ops.object.bake(type='NORMAL', use_selected_to_active=bool(high), use_clear=first, margin=8)


def baked_material(rid, color, normal):
    mat = bpy.data.materials.new('bake_' + rid)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = color
    tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = normal; tn.image.colorspace_settings.name = 'Non-Color'
    nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 1.0
    nt.links.new(tc.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value = 1.0
    for name, value in (('Sheen Weight', .55), ('Sheen Roughness', .6)):
        if name in bsdf.inputs:
            bsdf.inputs[name].default_value = value
    return mat


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = os.path.abspath(argv[0] if argv else 'out/glb')
    res = int(argv[1]) if len(argv) > 1 else 1024
    samples = int(argv[2]) if len(argv) > 2 else 96
    os.makedirs(out, exist_ok=True)
    scene = bpy.context.scene
    device = gpu(scene)
    report = {'device': device, 'resolution': res, 'samples': samples, 'residents': {}}
    for rid in RESIDENTS:
        t0 = time.time()
        lows = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith(rid + '_')
                and not o.name.endswith('_high') and '_fuzz' not in o.name]
        bakeable = [o for o in lows if '_eye' not in o.name and 'bake' in o.data.uv_layers]
        for o in bakeable:
            o.data.uv_layers.active = o.data.uv_layers['bake']
        images = {}
        for kind, cs in (('color', 'sRGB'), ('normal', 'Non-Color'), ('ao', 'Non-Color')):
            img = bpy.data.images.new(f'{rid}_{kind}', res, res, alpha=False)
            img.colorspace_settings.name = cs
            images[kind] = img
        for kind, key in (('DIFFUSE', 'color'), ('NORMAL', 'normal'), ('AO', 'ao')):
            first = True
            for low in bakeable:
                high = bpy.data.objects.get(low.name + '_high')
                bake(kind, low, high if high and high.type == 'MESH' else None, images[key], first, samples)
                first = False
        # Contact shade lives in the colour: felt is matte and the web view has no ambient occlusion pass.
        col, ao = images['color'], images['ao']
        px, ap = list(col.pixels), list(ao.pixels)
        for i in range(0, len(px), 4):
            k = .55 + .45 * ap[i]
            px[i] *= k; px[i + 1] *= k; px[i + 2] *= k
        col.pixels = px
        for kind, img in images.items():
            img.filepath_raw = os.path.join(out, f'{rid}_{kind}.png'); img.file_format = 'PNG'; img.save()
        mat = baked_material(rid, images['color'], images['normal'])
        for low in bakeable:
            low.data.materials.clear(); low.data.materials.append(mat)
        tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in lows)
        bpy.ops.object.select_all(action='DESELECT')
        for o in lows:
            o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=os.path.join(out, rid + '.glb'), use_selection=True, export_format='GLB', export_yup=True,
                                  export_apply=True, export_extras=True, export_image_format='WEBP', export_animations=False,
                                  export_lights=False, export_cameras=False)
        report['residents'][rid] = {'objects': [o.name for o in lows], 'baked': [o.name for o in bakeable], 'triangles': tris,
                                    'glbBytes': os.path.getsize(os.path.join(out, rid + '.glb')), 'seconds': round(time.time() - t0, 1)}
        print('[bake]', rid, json.dumps(report['residents'][rid], ensure_ascii=False))
    json.dump(report, open(os.path.join(out, 'bake_report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


try:
    main()
except Exception:
    traceback.print_exc()
    sys.exit(1)

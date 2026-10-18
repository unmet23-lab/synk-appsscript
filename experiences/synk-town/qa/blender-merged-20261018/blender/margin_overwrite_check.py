# How much of each atlas did Blender's per-object bake margin overwrite?
# Bakes the albedo of each group twice on the CPU (margin 0 and 16, 1 sample) and
# counts covered texels (non-black at margin 0) whose colour changed with margin 16.
#   blender -b <copy of bake.blend> -P margin_overwrite_check.py -- <part:group,...>
# (Works on a copy: it re-targets the bake image nodes and must not be saved over bake.blend.)
import bpy, sys
import numpy as np

want = [tuple(p.split(':')) for p in sys.argv[sys.argv.index('--') + 1].split(',')]
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 1
res = 1024
for part, group in want:
    objs = [o for o in bpy.data.collections['town'].objects if o.type == 'MESH' and o.get('part') == part and o.get('group') == group and not o.get('glass')]
    if not objs: print('OVR', part, group, 'none'); continue
    out = {}
    for margin in (0, 16):
        img = bpy.data.images.new(f'a{margin}', res, res, alpha=False, float_buffer=True)
        for o in objs:
            o.data.uv_layers.active = o.data.uv_layers['bake']
            for mt in o.data.materials:
                nt = mt.node_tree; n = nt.nodes.get('bake_target') or nt.nodes.new('ShaderNodeTexImage')
                n.name = 'bake_target'; n.image = img; nt.nodes.active = n
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        kw = dict(margin=margin, margin_type='ADJACENT_FACES') if margin else dict(margin=0)
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True, target='IMAGE_TEXTURES', **kw)
        a = np.empty(res * res * 4, dtype=np.float32); img.pixels.foreach_get(a); out[margin] = a.reshape(res, res, 4)[..., :3]
    cov = out[0].mean(axis=2) > 1e-4
    diff = np.abs(out[0] - out[16]).max(axis=2) > .05
    print('OVR', part, group, 'objects', len(objs), 'covered', int(cov.sum()), 'overwritten', int((cov & diff).sum()), 'share', round(float((cov & diff).sum() / max(1, cov.sum())), 4))

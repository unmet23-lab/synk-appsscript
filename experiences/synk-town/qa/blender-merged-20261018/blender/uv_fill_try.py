# How full can the neighbour atlases get? Tries unwrap settings on build.blend's
# neighbours groups and prints the UV fill (share of the atlas the faces cover).
#   blender -b <work>/build.blend -P uv_fill_try.py
import bpy, math

def fill(objs):
    a = 0
    for o in objs:
        uv = o.data.uv_layers['try'].data
        for p in o.data.polygons:
            pts = [tuple(uv[i].uv) for i in p.loop_indices]
            a += abs(sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))) / 2
    return a

def unwrap(objs, angle, margin, method):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
        if 'try' not in o.data.uv_layers: o.data.uv_layers.new(name='try')
        o.data.uv_layers.active = o.data.uv_layers['try']
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    if method == 'lightmap':
        bpy.ops.uv.lightmap_pack(PREF_CONTEXT='ALL_FACES', PREF_PACK_IN_ONE=True, PREF_NEW_UVLAYER=False, PREF_MARGIN_DIV=margin)
    else:
        bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=margin, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
        bpy.ops.uv.select_all(action='SELECT')
        bpy.ops.uv.pack_islands(rotate=True, rotate_method='ANY', scale=True, shape_method='CONCAVE', margin_method='SCALED', margin=margin)
    bpy.ops.object.mode_set(mode='OBJECT')
    n = 0
    return fill(objs)

town = [o for o in bpy.data.collections['town'].objects if o.type == 'MESH' and not o.get('glass')]
for group in ('neighbours_wall', 'neighbours_roof', 'ring_paths'):
    objs = [o for o in town if o.get('group') == group]
    if not objs: continue
    tris = sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)
    for angle, margin, method in ((66, 6 / 2048, 'smart'), (66, 2 / 2048, 'smart'), (66, 1 / 2048, 'smart'), (80, 2 / 2048, 'smart'), (0, 0.2, 'lightmap')):
        print('UVTRY', group, len(objs), tris, method, angle, round(margin * 2048, 1), round(unwrap(objs, angle, margin, method), 3), flush=True)

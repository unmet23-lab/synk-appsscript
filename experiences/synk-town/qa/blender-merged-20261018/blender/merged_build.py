# SYNK Town core neighbourhood, merged route (2026-10-18): Argon's modelling,
# Claude's bake. Argon's own bpy scripts (left by the 10-17 cafe run and the
# 10-18 per-part runs) build the geometry deterministically — no new Argon
# conversation — and ../../blender-town-20261018/blender/town_bake.py bakes and
# exports it like the Claude version (same light, two-pass sun share, margins,
# KTX2/meshopt afterwards).
#
#   blender -b -P merged_build.py -- --work <dir> --ref <dir holding reference/> --sky <jpg> [--preview 1]
#           [--ring <Argon outer-ring folder> --live <v20_live.glb of export-town.cjs --outer>]
#   --ring adds the outer ring (10-18 step ③): Argon's neighbours_geo.py / ring_geo.py
#   from that folder build the eight neighbour houses and the ground ring; their
#   ATLAS_GROUPS give the atlas groups. Neighbour objects are split per house so
#   the export joins one mesh per house (Town fades houses one by one).
#   blender -b -P ../../blender-town-20261018/blender/town_bake.py -- --stage bake   --work <dir> --variant merged --parts ground,home,cafe,workshop,greenhouse
#   blender -b -P ../../blender-town-20261018/blender/town_bake.py -- --stage export --work <dir> --variant merged --parts ground,home,cafe,workshop,greenhouse --out <dir>/out
#
# <ref>/reference holds the v20 export of ../../blender-town-20261018/export-town.cjs
# (v20_town_ground.glb + map_0.png feed Argon's ground; v20_live.glb is the only
# occluder set — v20_faded.glb, the benches, planters and trees Town fades out,
# stays out of the bake and keeps its live shadow).
import bpy, sys, os, json, time, math
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
QA = os.path.dirname(os.path.dirname(HERE))
# 10-18 Argon scripts first: their mat_builder.py supersedes the 10-17 one; the
# 10-17 folder still supplies geo_builder.py (the cafe and shared helpers).
sys.path[:0] = [os.path.join(QA, 'blender-town-20261018', 'blender'), os.path.join(QA, 'blender-town-20261018', 'argon', 'scripts'),
                os.path.join(QA, 'blender-district-20261017', 'argon')]
import town_bake as tb   # helpers only; its stage runs when it is the main script

# Atlas groups. Argon baked three 2048 maps per part (14 in all) and its phone
# set went over the 6 MB budget; here the ground and the greenhouse share two
# maps each (12 in all), like the Claude version's ground (hard / soft).
# Town (x, z) of the neighbour houses (town-layout.mjs houses).
HOUSES = [('neighbour-0', -16.6, -16.3), ('neighbour-1', -10, -16), ('neighbour-2', -4.7, -16.7), ('neighbour-3', 5.4, -16.6),
          ('neighbour-4', 12.2, -16.4), ('neighbour-5', 17.4, -17.6), ('neighbour-6', -12.9, -21.1), ('neighbour-7', 8.9, -21.1)]


def split_by_house(o):
    """Give every face to the nearest neighbour house (Town x, z = Blender x, -y)."""
    import bmesh
    mw = o.matrix_world; owner = {}
    bm = bmesh.new(); bm.from_mesh(o.data)
    for face in bm.faces:
        c = mw @ face.calc_center_median()
        owner.setdefault(min(HOUSES, key=lambda h: (h[1] - c.x) ** 2 + (h[2] + c.y) ** 2)[0], set()).add(face.index)
    bm.free()
    if len(owner) == 1:
        o['house'] = next(iter(owner)); return [o]
    out = []
    for house, faces in sorted(owner.items()):
        c = o.copy(); c.data = o.data.copy()
        for col in o.users_collection: col.objects.link(c)
        bm = bmesh.new(); bm.from_mesh(c.data); bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in faces], context='FACES'); bm.to_mesh(c.data); bm.free()
        c['house'] = house; c.name = f'{o.name}__{house}'; out.append(c)
    bpy.data.objects.remove(o, do_unlink=True)
    return out


GROUPS = {
    'home': {'home_maru': 'base', 'home_wall': 'base', 'home_timber': 'timber', 'home_props': 'timber',
             'home_roof': 'roof', 'home_cloth': 'roof', 'home_foliage': 'roof'},
    'workshop': {'workshop_maru': 'base', 'workshop_workbench': 'base', 'workshop_metal': 'base', 'workshop_wall': 'facade',
                 'workshop_timber': 'facade', 'workshop_roof': 'roof', 'workshop_foliage': 'roof'},
    'greenhouse': {'greenhouse_maru': 'house', 'greenhouse_curb': 'house', 'greenhouse_frame': 'house', 'greenhouse_metal': 'house',
                   'greenhouse_sill': 'house', 'greenhouse_planter': 'props', 'greenhouse_soil': 'props', 'greenhouse_crops': 'props',
                   'greenhouse_labels': 'props'},
    'cafe': {'cafe_maru': 'pavilion', 'cafe_wall': 'pavilion', 'cafe_ceramic': 'pavilion', 'cafe_metal_lantern': 'pavilion',
             'cafe_timber': 'upper', 'cafe_roof': 'upper', 'cafe_awning': 'upper', 'cafe_foliage': 'upper'},
    'ground': {'ground_court': 'hard', 'ground_mortar': 'hard', 'ground_curb': 'hard', 'ground_path': 'hard', 'ground_stepping': 'hard',
               'ground_gravel': 'hard', 'ground_stones': 'hard', 'ground_lawn': 'soft', 'ground_soil': 'soft'},
}


def main():
    t0 = time.time()
    work = tb.WORK; ref = os.path.abspath(tb.arg('--ref')); sky = os.path.abspath(tb.arg('--sky'))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    import importlib.util
    import mat_builder, home_geo, workshop_geo, greenhouse_geo, ground_geo, geo_builder
    spec = importlib.util.spec_from_file_location('mat_builder_1017', os.path.join(QA, 'blender-district-20261017', 'argon', 'mat_builder.py'))
    mat_builder_1017 = importlib.util.module_from_spec(spec); spec.loader.exec_module(mat_builder_1017)
    ground_geo.ROOT = ref   # Argon's ground reads <ROOT>/reference/v20_town_ground.glb and map_0.png
    # Each Argon script ran in its own Blender with its own material set, and the
    # tune_* functions retint shared materials in place: give every part a fresh
    # set so one part's tuning cannot leak into another (the cafe keeps the
    # 10-17 material module it was modelled with).
    # mat_builder reuses a material of the same name and rebuilds its nodes, so
    # after each part its materials are renamed '<part>:<name>' and the next
    # part gets new ones.
    built = {}
    def take(part, objs):
        for o in objs.values():
            for slot in o.material_slots:
                if slot.material and ':' not in slot.material.name: slot.material.name = f'{part}:{slot.material.name}'
        built.update(objs)
    take('home', home_geo.build_all_home_meshes(mat_builder.build_procedural_materials()))
    take('workshop', workshop_geo.build_all_workshop_meshes(mat_builder.build_procedural_materials()))
    take('greenhouse', greenhouse_geo.build_all_greenhouse_meshes(greenhouse_geo.build_greenhouse_materials()))
    cafe = geo_builder.build_all_cafe_meshes(mat_builder_1017.build_procedural_materials())
    bpy.data.objects.remove(cafe.pop('cafe_ground'), do_unlink=True)   # the shared ground slab replaces it
    take('cafe', cafe)
    take('ground', ground_geo.build_all_ground_meshes(mat_builder.build_procedural_materials()))
    # Argon's court border curb tops out at y 0.1036, 0.6 mm over the slabs
    # (0.1030): at a distance the depth test flips between the two and the curb
    # showed as white dashes along the court's south edge (10-18, both in
    # Argon's own set and here). Lift it 4 mm so it reads as v20's continuous rim.
    from mathutils import Matrix
    built['ground_curb'].data.transform(Matrix.Translation((0, 0, .004))); built['ground_curb'].data.update()
    ring_dir = tb.arg('--ring')
    if ring_dir:
        ring_dir = os.path.abspath(ring_dir); sys.path.insert(0, os.path.join(ring_dir, 'scripts'))
        import neighbours_geo, ring_geo
        for mod in (neighbours_geo, ring_geo):
            if hasattr(mod, 'ROOT'): mod.ROOT = ring_dir
        take('neighbours', neighbours_geo.build_all_neighbours_meshes(mat_builder.build_procedural_materials()))
        take('ring', ring_geo.build_all_ring_meshes(mat_builder.build_procedural_materials()))
        GROUPS['neighbours'] = dict(neighbours_geo.ATLAS_GROUPS); GROUPS['ring'] = dict(ring_geo.ATLAS_GROUPS)
        # Argon's core ground runs past the core rectangle (lawn to x ±14.53, z −14.5;
        # soil and gravel by up to 0.55 m) and the ring now covers that band too:
        # cut the flat layers at the rectangle so the two never lie on each other.
        # Stepping stones keep their whole shape (they stand above the lawn).
        for key in ('ground_lawn', 'ground_soil', 'ground_gravel'): tb.clip_to_core(built[key])
    tb.log('built by Argon scripts', len(built), 'objects in', round(time.time() - t0, 1), 's')

    for name in ('town', 'occluders'): bpy.context.scene.collection.children.link(bpy.data.collections.new(name))
    town, occ = bpy.data.collections['town'], bpy.data.collections['occluders']
    tris = {}
    for key, o in built.items():
        part = key.split('_')[0]; glass = key.endswith('_glass')
        group = 'glass' if glass else GROUPS[part].get(key)
        if group is None: raise RuntimeError(f'no atlas group for {key}')
        for c in list(o.users_collection): c.objects.unlink(o)
        town.objects.link(o)
        o['part'], o['group'], o['key'], o['glass'] = part, group, key, glass
        o.name = f'{part}__{group}__{key}'
        k = f'{part}/{group}'; tris[k] = tris.get(k, 0) + sum(len(p.vertices) - 2 for p in o.data.polygons)
    for o in [o for o in town.objects if o.get('part') == 'neighbours']: split_by_house(o)
    # Helpers the scripts left behind (imported references, temporary curves) do not belong in the bake.
    stray = [o for o in bpy.data.objects if o.name not in town.objects]
    tb.log('removed stray objects', [o.name for o in stray][:20], len(stray))
    for o in stray: bpy.data.objects.remove(o, do_unlink=True)

    # Occluders: v20_live only (grass, flowers, shrubs, the outer ring). Faded
    # roots (v20_faded.glb) are left out on purpose; see the header.
    live = os.path.abspath(tb.arg('--live')) if tb.arg('--live') else os.path.join(ref, 'reference', 'v20_live.glb')
    for o in tb.import_glb(live, occ):
        o['occluder'] = True; o['source'] = 'v20_live.glb'
        for slot in o.material_slots:
            mt = slot.material
            if mt and tb.parse(mt.name)['key'] not in tb.GLASS and mt.use_nodes and 'Principled BSDF' in mt.node_tree.nodes:
                alpha = mt.node_tree.nodes['Principled BSDF'].inputs['Alpha']
                for link in list(alpha.links): mt.node_tree.links.remove(link)
                alpha.default_value = 1
    tb.setup_world(sky); tb.setup_cycles(64)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(work, 'build.blend'))
    tb.log('saved build.blend', tris)
    if tb.arg('--preview', '1') == '1':
        sc = bpy.context.scene; sc.render.resolution_x, sc.render.resolution_y = 960, 675; sc.cycles.samples = 32
        for name, (p, t, fov) in tb.PREVIEW_CAMERAS.items():
            cam = bpy.data.cameras.new(name); cam.sensor_fit = 'VERTICAL'; cam.angle_y = math.radians(fov)
            ob = bpy.data.objects.new('cam_' + name, cam); sc.collection.objects.link(ob)
            pb, tb_ = Vector((p[0], -p[2], p[1])), Vector((t[0], -t[2], t[1]))
            ob.location = pb; ob.rotation_euler = (tb_ - pb).to_track_quat('-Z', 'Y').to_euler()
            sc.camera = ob; sc.render.filepath = os.path.join(work, f'build-{name}.png'); bpy.ops.render.render(write_still=True)
    json.dump({'route': 'argon-geometry + claude-bake', 'triangles': tris, 'seconds': round(time.time() - t0, 1)},
              open(os.path.join(work, 'build.json'), 'w'), indent=2)


main()

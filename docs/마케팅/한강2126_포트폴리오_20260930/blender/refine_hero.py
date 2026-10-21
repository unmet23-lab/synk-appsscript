"""Create a separate, editable hero study from the saved material prototype.

This preserves the input .blend. Build locally; render the packed output on
the already established ZeroGPU route. No human assets are included.
"""
import argparse
import bisect
import json
import math
from pathlib import Path
import random
import sys
import time

import bpy
from mathutils import Vector

p = argparse.ArgumentParser()
p.add_argument('--blend', required=True)
p.add_argument('--out-dir', required=True)
p.add_argument('--width', type=int, default=900)
p.add_argument('--height', type=int, default=1600)
p.add_argument('--samples', type=int, default=64)
p.add_argument('--fibers', type=int, default=180000)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
start = time.monotonic()
source = Path(a.blend).resolve(strict=True)
out = Path(a.out_dir).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
rng = random.Random(2126093002)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from hero_foliage import improve_foliage

coll = bpy.data.collections.new('09 Hero refinement / separate study')
scene.collection.children.link(coll)

def material(name, rgb, rough=.5, metal=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*rgb, 1)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    return m

def box(name, loc, scale, mat, bevel=0):
    x, y, z = [value*.5 for value in scale]
    me = bpy.data.meshes.new(name)
    me.from_pydata([(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),
                   (-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)], [],
                  [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    me.update()
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    coll.objects.link(ob)
    ob.data.materials.append(mat)
    if bevel:
        md = ob.modifiers.new('Subtle dressed stone edge', 'BEVEL')
        md.width, md.segments = bevel, 3
        ob.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return ob

def aim(ob, point):
    ob.rotation_euler = (Vector(point) - ob.location).to_track_quat('-Z', 'Y').to_euler()

# Match the lower photographic viewpoint and show the river beyond the right edge.
cam = bpy.data.objects['HERO / Han River felt academy']
cam.location = (-24, -40, 6.4)
aim(cam, (4.3, 2.0, 7.0))
cam.data.lens = 41
cam.data.clip_end = 1000
scene.camera = cam
cam.data.dof.use_dof = False

# Give the skyline room to breathe rather than looming immediately over the roof.
for ob in list(bpy.data.collections['05 Future Seoul concept skyline'].objects):
    if 'Namsan' in ob.name or 'river' in ob.name.lower():
        continue
    ob.location.x += 80
    ob.location.y += 40
    ob.location.z *= .75
    ob.scale.z *= .75

# The old large reflected disks made the interior appear to contain white blobs.
for ob in list(scene.objects):
    if ob.type == 'LIGHT':
        ob.visible_glossy = False
        ob.visible_transmission = False
        if 'Interior ambient' in ob.name:
            ob.data.energy = 190
        else:
            ob.hide_render = True
for node in scene.world.node_tree.nodes:
    if node.type == 'TEX_ENVIRONMENT':
        # Native unconnected environment coordinates keep Z up, as documented.
        for link in list(node.inputs['Vector'].links):
            scene.world.node_tree.links.remove(link)
        skyfile = Path(__file__).resolve().parent/'assets'/'wasteland_clouds_puresky_2k.hdr'
        node.image = bpy.data.images.load(str(skyfile), check_existing=True)
        node.image.pack()
    elif node.type == 'BACKGROUND':
        node.inputs['Strength'].default_value = .35

sun_data = bpy.data.lights.new('Low warm sun / long river shadows', 'SUN')
sun_data.energy = 2.0
sun_data.angle = math.radians(3.5)
sun_data.color = (1.0, .78, .56)
sun = bpy.data.objects.new(sun_data.name, sun_data)
coll.objects.link(sun)
sun.location = (35, -8, 24)
aim(sun, (0, 0, 3))
fill_data = bpy.data.lights.new('Large cool facade fill', 'AREA')
fill_data.energy, fill_data.size = 850, 18
fill_data.color = (.69, .82, 1)
fill = bpy.data.objects.new(fill_data.name, fill_data)
coll.objects.link(fill)
fill.location = (-12, -20, 14)
fill.visible_glossy = False
fill.visible_transmission = False
aim(fill, (0, 0, 7))

# Neutral white wool, a quiet fine base texture, and actual visible silhouette fibers.
felt = bpy.data.materials['Warm ivory / dense short wool felt']
for node in felt.node_tree.nodes:
    if node.type == 'BUMP':
        node.inputs['Strength'].default_value = .38
        node.inputs['Distance'].default_value = .012
    elif node.type == 'TEX_NOISE':
        node.inputs['Scale'].default_value = 65
    elif node.type == 'VALTORGB':
        node.color_ramp.elements[0].color = (.68, .685, .675, 1)
        node.color_ramp.elements[1].color = (.92, .925, .915, 1)
felt.node_tree.nodes.get('Principled BSDF').inputs['Sheen Weight'].default_value = .45
for ob in scene.objects:
    if 'Felt corner pier' in ob.name:
        ob.scale.x = 1.4
        ob.scale.y = 1.35
    if 'Physical short wool fibers' in ob.name:
        ob.hide_render = True

deps = bpy.context.evaluated_depsgraph_get()
triangles, cum = [], []
area_sum = 0.0
for ob in scene.objects:
    if not ('sculpted ivory felt fascia' in ob.name or 'Felt corner pier' in ob.name):
        continue
    ev = ob.evaluated_get(deps)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    for tr in me.loop_triangles:
        v = [ob.matrix_world @ me.vertices[i].co for i in tr.vertices]
        cross = (v[1]-v[0]).cross(v[2]-v[0])
        ar = cross.length / 2
        if ar < 1e-8:
            continue
        n = cross.normalized()
        mid = sum(v, Vector()) / 3
        if n.z < -.35 or (n.y > -.22 and n.x > -.22) or mid.y > 1:
            continue
        area_sum += ar
        triangles.append((*v, n))
        cum.append(area_sum)
    ev.to_mesh_clear()

# Four tapered segments per strand: one ribbon at a random azimuth.
# Kept small enough to build on a memory-constrained laptop.
verts, faces = [], []
print('SYNK_HERO_BUILD generating wool geometry', flush=True)
for i in range(a.fibers):
    va, vb, vc, normal = triangles[bisect.bisect_left(cum, rng.random()*area_sum)]
    u, v = math.sqrt(rng.random()), rng.random()
    root = (1-u)*va + u*(1-v)*vb + u*v*vc + normal*.001
    tangent = normal.cross(Vector((0, 0, 1)))
    if tangent.length < .1:
        tangent = normal.cross(Vector((0, 1, 0)))
    tangent.normalize()
    side = normal.cross(tangent).normalized()
    theta = rng.random()*math.tau
    along = tangent*math.cos(theta) + side*math.sin(theta)
    across = normal.cross(along).normalized()
    # Hero-distance fiber bundles are art-directed for screen readability.
    # These are not engineering-accurate individual textile filaments.
    length = rng.uniform(.055, .095)
    loft = rng.uniform(.006, .018)
    halfwidth = rng.uniform(.0015, .0035)
    base = len(verts)
    for j in range(4):
        t = j/3
        pos = root + along*((t-.5)*length) + normal*(math.sin(math.pi*t)*loft)
        pos += across*(math.sin(t*math.tau+theta)*length*.13)
        w = halfwidth*(.12+.88*math.sin(math.pi*t))
        verts.extend([tuple(pos-across*w), tuple(pos+across*w)])
        if j:
            k = base+j*2
            faces.append((k-2, k-1, k+1, k))
fiber_mat = material('Hero fine wool / white', (.76, .78, .755), .89)
fiber_mat.node_tree.nodes.get('Principled BSDF').inputs['Sheen Weight'].default_value = .5
me = bpy.data.meshes.new('Short white wool / view-facing geometry')
me.from_pydata(verts, [], faces)
me.materials.append(fiber_mat)
me.update()
fibers = bpy.data.objects.new('Hero actual short wool fibers', me)
coll.objects.link(fibers)
del verts, faces, triangles, cum

print('SYNK_HERO_BUILD generating natural foliage', flush=True)
foliage_report = improve_foliage(scene)

# Slightly wet limestone paving offers subdued sunset reflections and true joints.
paving = [material('Damp pale limestone %d' % i, (.39+i*.017, .405+i*.017, .40+i*.017), .25+i*.015) for i in range(5)]
for row in range(15):
    for col in range(18):
        x = -22+col*2.0+(row%2)*1.0
        y = -33+row*1.5
        box('Jointed riverside paving', (x, y, -.17), (1.985, 1.485, .12), rng.choice(paving), .006)
river = bpy.data.objects['Han river water surface']
river.location.x = 58
river.dimensions.x = 90
water = bpy.data.materials['Quiet Han river']
bs = water.node_tree.nodes.get('Principled BSDF')
bs.inputs['Roughness'].default_value = .19
bs.inputs['Metallic'].default_value = .20
bs.inputs['Base Color'].default_value = (.13, .23, .25, 1)

# Keep the source PNG exactly as supplied, at the original alpha and aspect ratio.
logo = bpy.data.objects['Official SYNK lettering source image']
assert logo.get('exact_asset') is True
scene.render.resolution_x, scene.render.resolution_y = a.width, a.height
scene.render.resolution_percentage = 100
scene.render.engine = 'CYCLES'
scene.cycles.samples = a.samples
scene.cycles.device = 'CPU'
scene.cycles.use_denoising = True
scene.cycles.seed = 2130
scene.view_settings.exposure = -.05
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(out/('synk_hanriver_'+out.name+'.png'))
scene['stage'] = 'Hero refinement study; not a final advertising shot or animation.'
scene['refinement'] = 'Natural leaves, lower viewpoint, directional sunset, fine physical wool, wet paving'
destination = out/('synk_hanriver_'+out.name+'.blend')
print('SYNK_HERO_BUILD packing and saving scene', flush=True)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(destination))
manifest = dict(source=str(source), blend=str(destination), image=scene.render.filepath,
                dimensions=[a.width, a.height], samples=a.samples, seed=2130,
                fibers=a.fibers, sampled_area_m2=round(area_sum, 3),
                fiber_bundle_length_m=[.055,.095], fiber_bundle_width_m=[.003,.007],
                fiber_note='Art-directed hero-distance bundles, not individual real wool filaments',
                foliage=foliage_report, render_completed=False,
                source_preserved=True, exact_logo_preserved=True,
                build_seconds=round(time.monotonic()-start, 3))
(out/'hero_manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print('SYNK_HERO_READY '+json.dumps(manifest, ensure_ascii=False), flush=True)

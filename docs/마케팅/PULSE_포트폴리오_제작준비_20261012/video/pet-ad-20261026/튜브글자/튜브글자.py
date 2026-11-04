# 첨벙댕 풍선 글자 2 — 조각마다 따로 부풀려 읽히게. glyph.py가 낸 윤곽선을 곡선 → 메시 → 천 압력. 알파 PNG로 뽑아 영상에 합성
#  blender -b -P balloon2.py -- --glyphs g.json --out <폴더> --frames 20 --only 20 --samples 48 [--letter 0]
import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--glyphs", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--env", default="")
ap.add_argument("--frames", type=int, default=20)
ap.add_argument("--only", default="")
ap.add_argument("--samples", type=int, default=48)
ap.add_argument("--voxel", type=float, default=0.008)
ap.add_argument("--force", type=float, default=7.0)
ap.add_argument("--res", default="1080x700")
ap.add_argument("--span", type=float, default=3.0)
ap.add_argument("--pitch", type=float, default=0.93)
ap.add_argument("--camz", type=float, default=1.1)
ap.add_argument("--letter", type=int, default=-1)   # 이 글자만(시차 합성용)
ap.add_argument("--foil", type=float, default=0.25)
a = ap.parse_args(argv)
os.makedirs(a.out, exist_ok=True)
G = json.load(open(a.glyphs, encoding="utf8"))

scene = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
W, H = [int(x) for x in a.res.split("x")]
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.engine = "CYCLES"
scene.cycles.samples = a.samples
scene.cycles.use_denoising = True
prefs = bpy.context.preferences.addons["cycles"].preferences
for kind in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = kind
        prefs.get_devices()
        if any(d.type == kind for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == kind
            scene.cycles.device = "GPU"
            break
    except Exception as e:
        print("장치 실패", kind, e, flush=True)
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.gravity = (0, 0, 0)


def srgb(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rubber(name, rgb, rough=0.17):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree.nodes["Principled BSDF"]
    n.inputs["Base Color"].default_value = (srgb(rgb[0]), srgb(rgb[1]), srgb(rgb[2]), 1)
    n.inputs["Roughness"].default_value = rough
    n.inputs["Metallic"].default_value = a.foil
    n.inputs["Coat Weight"].default_value = 1.0
    n.inputs["Coat Roughness"].default_value = 0.05
    return m


LEMON = rubber("lemon", (255, 224, 20))
ORANGE = rubber("orange", (255, 100, 12))
# 튜브 띠 — 물놀이 튜브처럼 주황 · 흰색을 번갈아(물체 좌표의 각도로)
_nt = ORANGE.node_tree
_bsdf = _nt.nodes["Principled BSDF"]
_tc = _nt.nodes.new("ShaderNodeTexCoord")
_sep = _nt.nodes.new("ShaderNodeSeparateXYZ")
_nt.links.new(_tc.outputs["Object"], _sep.inputs[0])
_at = _nt.nodes.new("ShaderNodeMath"); _at.operation = "ARCTAN2"
_nt.links.new(_sep.outputs["Z"], _at.inputs[0]); _nt.links.new(_sep.outputs["X"], _at.inputs[1])
_mul = _nt.nodes.new("ShaderNodeMath"); _mul.operation = "MULTIPLY"; _mul.inputs[1].default_value = 4.0
_nt.links.new(_at.outputs[0], _mul.inputs[0])
_sin = _nt.nodes.new("ShaderNodeMath"); _sin.operation = "SINE"
_nt.links.new(_mul.outputs[0], _sin.inputs[0])
_gt = _nt.nodes.new("ShaderNodeMath"); _gt.operation = "GREATER_THAN"; _gt.inputs[1].default_value = 0.0
_nt.links.new(_sin.outputs[0], _gt.inputs[0])
_mix = _nt.nodes.new("ShaderNodeMix"); _mix.data_type = "RGBA"
_mix.inputs["A"].default_value = (srgb(255), srgb(100), srgb(12), 1)
_mix.inputs["B"].default_value = (srgb(255), srgb(248), srgb(232), 1)
_nt.links.new(_gt.outputs[0], _mix.inputs["Factor"])
_nt.links.new(_mix.outputs["Result"], _bsdf.inputs["Base Color"])


def inflate(obj):
    cm = obj.modifiers.new("c", "CLOTH")
    s = cm.settings
    s.quality = 7
    s.mass = 0.12
    s.air_damping = 3.0
    s.tension_stiffness = 12
    s.compression_stiffness = 12
    s.shear_stiffness = 6
    s.bending_stiffness = 0.06
    s.use_pressure = True
    s.effector_weights.gravity = 0
    s.uniform_pressure_force = 0.0
    s.keyframe_insert("uniform_pressure_force", frame=1)
    s.uniform_pressure_force = a.force * 1.5
    s.keyframe_insert("uniform_pressure_force", frame=8)
    s.uniform_pressure_force = a.force
    s.keyframe_insert("uniform_pressure_force", frame=15)
    cm.point_cache.frame_start = 1
    cm.point_cache.frame_end = a.frames
    sub = obj.modifiers.new("s", "SUBSURF")
    sub.levels = 1
    sub.render_levels = 1


def part_obj(name, polys, x0, mat):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.extrude = 0.018
    cu.resolution_u = 1
    for p in polys:
        sp = cu.splines.new("POLY")
        sp.points.add(len(p["pts"]) - 1)
        for i, (x, y) in enumerate(p["pts"]):
            sp.points[i].co = (x, y, 0, 1)
        sp.use_cyclic_u = True
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.object
    rm = ob.modifiers.new("r", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = a.voxel
    rm.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=rm.name)
    ob.data.materials.append(mat)
    ob.rotation_euler = (math.radians(90), 0, 0)
    ob.location = (x0, 0, 0.1 - YMIN)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=False)
    if mat is ORANGE:
        for o in bpy.context.selected_objects:
            o.select_set(False)
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    inflate(ob)
    print(name, "면", len(ob.data.polygons), flush=True)
    return ob


letters = G["letters"]
YMIN = min(pt[1] for L in letters for p in L["parts"] for q in p["polys"] for pt in q["pts"])   # 글자 아래 끝을 바닥 위로
# 글자 가운데 맞춤 — 윤곽 x 범위로
for i, L in enumerate(letters):
    if a.letter >= 0 and i != a.letter:
        continue
    xs = [pt[0] for p in L["parts"] for q in p["polys"] for pt in q["pts"]]
    cx = (min(xs) + max(xs)) / 2
    x0 = (i - (len(letters) - 1) / 2) * a.pitch - cx
    for k, p in enumerate(L["parts"]):
        is_ring = p.get("ring", L["ch"] in "벙댕" and k == len(L["parts"]) - 1)
        part_obj(f"{L['ch']}{k}", p["polys"], x0, ORANGE if is_ring else LEMON)

# 그림자는 합성에서 깐다(받이 판의 지평선이 알파에 줄로 남았다)

cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
bpy.context.collection.objects.link(cam)
D = 7.0
cam_data.sensor_fit = "HORIZONTAL"
cam_data.sensor_width = 36
cam_data.lens = 36 * D / a.span
cam.location = (0, -D, a.camz)
target = Vector((0, 0, 0.6))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
nt = world.node_tree
bg = nt.nodes["Background"]
if a.env and os.path.exists(a.env):
    tex = nt.nodes.new("ShaderNodeTexEnvironment")
    tex.image = bpy.data.images.load(a.env)
    nt.links.new(tex.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0
else:
    bg.inputs["Color"].default_value = (0.82, 0.8, 0.76, 1)
    bg.inputs["Strength"].default_value = 0.9


def area(name, loc, size, power, look=(0, 0, 0.6), sz_y=None):
    d = bpy.data.lights.new(name, "AREA")
    d.shape = "RECTANGLE"
    d.size, d.size_y = size, sz_y or size
    d.energy = power
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    o.visible_camera = False
    return o


area("key", (-3.2, -4.0, 5.0), 3.5, 300, sz_y=5)
area("rim", (3.8, 2.5, 3.8), 2.5, 110, sz_y=4)
area("fill", (2.8, -5.0, 1.6), 4, 70)

scene.frame_start, scene.frame_end = 1, a.frames
only = {int(x) for x in a.only.split(",") if x} if a.only else None
for f in range(1, a.frames + 1):
    scene.frame_set(f)
    if only is None or f in only:
        scene.render.filepath = os.path.join(a.out, f"f{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        print("렌더", f, flush=True)
print("끝", flush=True)

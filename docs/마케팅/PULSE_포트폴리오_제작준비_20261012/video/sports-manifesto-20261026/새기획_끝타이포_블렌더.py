# 5번 새 기획(11-05 밤) 끝 화면 CG 시안 C — 직접 그린 대문자를 입체로 세워 Cycles로 굽는다(blender -b --python, 뒤에 인자: 해상도비율 샘플 패스 이름).
# 글자 면은 어두운 금속, 빛은 뒤쪽 줄 조명(테두리)과 앞쪽 낮은 판(면에 비침) 둘로 나눠 따로 구워 합성에서 세기를 움직인다 — 프레임마다 굽지 않는다. 카메라는 조금 올려다본다.
#   blender -b --python 새기획_끝타이포_블렌더.py -- 100 256 테두리 / 면
import bpy, json, math, sys
from mathutils import Vector
args = sys.argv[sys.argv.index("--") + 1:]
pct, samples, passname = int(args[0]), int(args[1]), args[2]
LENS = float(args[3]) if len(args) > 3 else 42.0
SHIFT = float(args[4]) if len(args) > 4 else 0.0
DIST = float(args[5]) if len(args) > 5 else 8.0
O = r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n/로고시안/cg"
d = json.load(open(O + "/글자.json"))
x0, y0, x1, y1 = d["bounds"]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.samples = samples; sc.cycles.use_denoising = True
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"; prefs.get_devices()
for dv in prefs.devices: dv.use = dv.type == "OPTIX"
sc.cycles.device = "GPU"
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1080, 1920, pct
sc.render.film_transparent = True
sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"; sc.render.image_settings.color_depth = "16"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[1].default_value = 0.0
# 글자: 2D 곡선(바깥 + 구멍) → 돌출 + 모따기. 글자 단위 100 = 1m
cu = bpy.data.curves.new("wm", "CURVE"); cu.dimensions = "2D"; cu.fill_mode = "BOTH"
S = 0.01
for p in d["polys"]:
    for ring in [p["ext"]] + p["holes"]:
        sp = cu.splines.new("POLY"); sp.points.add(len(ring) - 1)
        for i, (x, y) in enumerate(ring): sp.points[i].co = (x * S, y * S, 0, 1)
        sp.use_cyclic_u = True
cu.extrude = 0.028; cu.bevel_depth = 0.013; cu.bevel_resolution = 5   # 두께가 크면 올려다볼 때 옆면이 좁은 구멍을 메운다
ob = bpy.data.objects.new("wm", cu); sc.collection.objects.link(ob)
ob.location = (-(x0 + x1) / 2 * S, 0, 0); ob.rotation_euler = (math.radians(90), 0, 0)
m = bpy.data.materials.new("metal"); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
b.inputs["Base Color"].default_value = (0.018, 0.02, 0.024, 1); b.inputs["Metallic"].default_value = 0.92; b.inputs["Roughness"].default_value = 0.30
cu.materials.append(m)
# 카메라: 글자 아래쪽에서 조금 올려다본다
cam = bpy.data.cameras.new("c"); cam.lens = LENS; cam.sensor_fit = "VERTICAL"; cam.sensor_height = 36; cam.shift_y = SHIFT
co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
co.location = (0, -DIST, 0.25); co.rotation_euler = (math.radians(90 + 6), 0, 0)
def area(name, loc, size, power, color, aim=(0, 0, 0.8), sy=None):
    l = bpy.data.lights.new(name, "AREA"); l.shape = "RECTANGLE"; l.size = size[0]; l.size_y = size[1]; l.energy = power; l.color = color
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat("-Z", "Y").to_euler(); o.visible_camera = False
    return o
COOL = (0.78, 0.86, 1.0)
if passname == "테두리":
    area("뒤위", (0, 1.4, 3.0), (7, 0.6), 5200, COOL)
    area("뒤오른", (3.2, 1.2, 0.9), (0.5, 4.5), 5200, COOL)     # 빛 기둥 쪽이 더 세다
    area("뒤왼", (-3.2, 1.2, 0.9), (0.5, 4.5), 1800, COOL)
else:
    # 앞쪽 낮은 넓은 판: 금속 면에 젖은 트랙 빛처럼 비친다
    area("앞아래", (0, -4.0, -2.2), (9, 2.2), 900, COOL)
    area("앞위", (0.6, -3.5, 4.0), (6, 1.2), 240, COOL)
sc.render.filepath = f"{O}/{passname}_{pct}.png"
bpy.ops.render.render(write_still=True)
print("끝", sc.render.filepath)

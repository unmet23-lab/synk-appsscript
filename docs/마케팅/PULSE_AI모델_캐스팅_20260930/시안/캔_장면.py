# 시안용 가상 제품 「MORU 콜드브루 블랙 250 ml」 캔을 블렌더로 렌더한다(투명 바탕, 사람 사진에 합성할 판). 블렌더 5.2 배경 실행용.
#   blender -b --python 캔_장면.py -- --label <캔_라벨.png> --out <폴더> [--elev -8,0,8,16] [--yaw 0,-25,25] [--key L,R]
#                                    [--size 800x1600] [--samples 128] [--device GPU|CPU] [--save 장면.blend]
# 제작 규칙(제품·로고·글자는 AI로 그리지 않는다): 사람은 LoRA로 뽑고, 손에 든 자리에 이 렌더를 얹는다(시안_합성.py).
# 크기(mm): 슬림 캔 몸통 지름 53 · 높이 134, 인쇄는 몸통 z 8.5~121.5(라벨 2400×1620 = 둘레 166.5 × 높이 112.4).
# 카메라 85 mm, 캔이 화면 높이의 약 88%. elev = 카메라가 캔 가운데보다 위에 있는 각도(도, +면 뚜껑이 보임),
# yaw = 캔을 축으로 돌린 각도(도, +면 앞면이 화면 오른쪽으로 돈다), key = 큰 빛이 오는 쪽(화면 왼쪽 L · 오른쪽 R).
import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--label", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--elev", default="0")
ap.add_argument("--yaw", default="0")
ap.add_argument("--key", default="L")
ap.add_argument("--size", default="800x1600")
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--device", choices=["CPU", "GPU"], default="GPU")
ap.add_argument("--save", default="")
A = ap.parse_args(argv)
MM = 0.001

# ---------- 장면 비우기 ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- 캔 모양(반지름 r, 높이 z, mm): 바닥 중심 → 바닥 돔 → 받침 고리 → 몸통 → 목 → 이중 시밍 → 뚜껑 판 → 뚜껑 중심 ----------
PROFILE = [
    (0.0, 9.0), (6.0, 8.8), (12.0, 7.9), (16.5, 6.2), (19.3, 4.2), (20.8, 2.4), (21.7, 0.9), (22.5, 0.15), (23.4, 0.0),
    (24.3, 0.35), (25.2, 1.4), (25.9, 3.0), (26.35, 5.0), (26.5, 7.0),
    (26.5, 116.0), (26.35, 118.2), (25.8, 120.6), (25.0, 123.0), (24.2, 125.4), (23.7, 127.4), (23.6, 128.2),
    (24.15, 128.8), (24.25, 130.6), (24.15, 133.3), (23.75, 134.0), (23.2, 133.9), (22.85, 133.2), (22.55, 131.6),
    (22.2, 130.9), (21.0, 130.75), (12.0, 130.9), (0.0, 131.0),
]
LABEL_Z = (8.5, 121.5)
SEG = 160

bm = bmesh.new()
prev = None
verts = []
for r, z in PROFILE:
    verts.append(bm.verts.new((r * MM, 0.0, z * MM)))
edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=SEG, use_duplicate=False)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
mesh = bpy.data.meshes.new("can")
bm.to_mesh(mesh)
bm.free()
can = bpy.data.objects.new("can", mesh)
scene.collection.objects.link(can)
for p in mesh.polygons:
    p.use_smooth = True

# 바깥쪽 법선 확인(몸통 한 면의 법선이 바깥을 보게)
mesh.calc_loop_triangles()

# ---------- UV: 원통 펼침(앞면 = -Y 방향 = u 0.5) ----------
uv = mesh.uv_layers.new(name="label")
for poly in mesh.polygons:
    us, vs = [], []
    for li in poly.loop_indices:
        co = mesh.vertices[mesh.loops[li].vertex_index].co
        th = math.atan2(co.x, -co.y)  # 앞(-Y)에서 0, +X 쪽으로 커짐
        us.append(0.5 + th / (2 * math.pi))
        vs.append((co.z / MM - LABEL_Z[0]) / (LABEL_Z[1] - LABEL_Z[0]))
    if max(us) - min(us) > 0.5:  # 뒤쪽 이음매를 넘는 면
        us = [u + 1.0 if u < 0.5 else u for u in us]
    for li, u, v in zip(poly.loop_indices, us, vs):
        uv.data[li].uv = (u, v)

# ---------- 재질 ----------
def principled(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree.nodes["Principled BSDF"], m.node_tree


alu, alu_b, _ = principled("aluminium")
alu_b.inputs["Base Color"].default_value = (0.78, 0.79, 0.80, 1)
alu_b.inputs["Metallic"].default_value = 1.0
alu_b.inputs["Roughness"].default_value = 0.2

lab, lab_b, nt = principled("label")
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(os.path.abspath(A.label))
tex.extension = "REPEAT"
tex.interpolation = "Cubic"
uvn = nt.nodes.new("ShaderNodeUVMap")
uvn.uv_map = "label"
nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
nt.links.new(tex.outputs["Color"], lab_b.inputs["Base Color"])
# 짙은 잉크는 알루미늄 위 인쇄라 살짝 금속 빛, 크림 글자는 무광 잉크
bw = nt.nodes.new("ShaderNodeRGBToBW")
nt.links.new(tex.outputs["Color"], bw.inputs["Color"])
inv = nt.nodes.new("ShaderNodeMath")
inv.operation = "SUBTRACT"
inv.inputs[0].default_value = 1.0
nt.links.new(bw.outputs["Val"], inv.inputs[1])
mul = nt.nodes.new("ShaderNodeMath")
mul.operation = "MULTIPLY"
mul.inputs[1].default_value = 0.07
nt.links.new(inv.outputs["Value"], mul.inputs[0])
nt.links.new(mul.outputs["Value"], lab_b.inputs["Metallic"])
lab_b.inputs["Roughness"].default_value = 0.46
lab_b.inputs["Specular IOR Level"].default_value = 0.32
lab_b.inputs["Coat Weight"].default_value = 0.07
lab_b.inputs["Coat Roughness"].default_value = 0.18

mesh.materials.append(alu)
mesh.materials.append(lab)
for poly in mesh.polygons:
    zc = sum(mesh.vertices[v].co.z for v in poly.vertices) / len(poly.vertices) / MM
    r = max(math.hypot(mesh.vertices[v].co.x, mesh.vertices[v].co.y) for v in poly.vertices) / MM
    poly.material_index = 1 if (LABEL_Z[0] <= zc <= LABEL_Z[1] and r > 26.0) else 0

# ---------- 따개(뚜껑 위, 앞쪽으로 치우침) ----------
bpy.ops.mesh.primitive_cube_add(size=1)
tab = bpy.context.active_object
tab.name = "tab"
tab.scale = (11 * MM, 19 * MM, 0.45 * MM)
tab.location = (0, -3.5 * MM, 131.45 * MM)
bev = tab.modifiers.new("bevel", "BEVEL")
bev.width = 3.5 * MM
bev.segments = 6
tab.data.materials.append(alu)
bpy.ops.mesh.primitive_cylinder_add(radius=2.6 * MM, depth=0.6 * MM, location=(0, 1.0 * MM, 131.4 * MM))
rivet = bpy.context.active_object
rivet.data.materials.append(alu)
for o in (tab, rivet):
    for p in o.data.polygons:
        p.use_smooth = True
    o.parent = can

# ---------- 빛: 큰 빛 + 채움 + 캔 모서리 띠 두 개 + 은은한 주변 ----------
world = bpy.data.worlds.new("world")
scene.world = world
world.use_nodes = True
wn = world.node_tree.nodes
env = wn.new("ShaderNodeTexEnvironment")
hdr = os.path.join(os.path.dirname(bpy.app.binary_path), "5.2", "datafiles", "studiolights", "world", "interior.exr")
env.image = bpy.data.images.load(hdr)
world.node_tree.links.new(env.outputs["Color"], wn["Background"].inputs["Color"])
wn["Background"].inputs["Strength"].default_value = 0.3


def area(name, loc, size, power, shape="RECTANGLE", sy=None):
    d = bpy.data.lights.new(name, "AREA")
    d.shape = shape
    d.size = size
    if sy is not None:
        d.size_y = sy
    d.energy = power
    o = bpy.data.objects.new(name, d)
    o.location = loc
    scene.collection.objects.link(o)
    tgt = Vector((0, 0, 0.067))
    o.rotation_euler = (tgt - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


key = area("key", (0, 0, 0), 0.45, 20.0)
fill = area("fill", (0, 0, 0), 0.6, 7.0)
strip_a = area("strip_a", (0, 0, 0), 0.06, 7.0, "RECTANGLE", 0.6)
strip_b = area("strip_b", (0, 0, 0), 0.06, 5.0, "RECTANGLE", 0.6)


def place_lights(side):
    s = -1 if side == "L" else 1  # 화면 왼쪽 = -X
    def at(az_deg, el_deg, dist):
        az, el = math.radians(az_deg), math.radians(el_deg)
        return (s * dist * math.sin(az) * math.cos(el), -dist * math.cos(az) * math.cos(el), 0.067 + dist * math.sin(el))
    for o, (az, el, dist) in ((key, (50, 28, 0.75)), (fill, (-60, 10, 0.9)), (strip_a, (78, 6, 0.45)), (strip_b, (-80, 6, 0.45))):
        o.location = at(az, el, dist)
        tgt = Vector((0, 0, 0.067))
        o.rotation_euler = (tgt - o.location).to_track_quat("-Z", "Y").to_euler()


# ---------- 카메라 ----------
cam_d = bpy.data.cameras.new("cam")
cam_d.lens = 85
cam_d.sensor_fit = "VERTICAL"
cam_d.sensor_height = 24
cam = bpy.data.objects.new("cam", cam_d)
scene.collection.objects.link(cam)
scene.camera = cam
W, H = (int(v) for v in A.size.lower().split("x"))
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "16"
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.render.engine = "CYCLES"
scene.cycles.samples = A.samples
scene.cycles.use_denoising = True
if A.device == "GPU":
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            for d in prefs.devices:
                d.use = True
            scene.cycles.device = "GPU"
            break
        except Exception:
            continue

CENTER = Vector((0, 0, 0.067))
DIST = 0.6


def place_camera(elev):
    e = math.radians(elev)
    cam.location = CENTER + Vector((0, -DIST * math.cos(e), DIST * math.sin(e)))
    cam.rotation_euler = (CENTER - cam.location).to_track_quat("-Z", "Y").to_euler()


os.makedirs(A.out, exist_ok=True)
if A.save:
    place_lights("L")
    place_camera(0)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(A.save))

for side in A.key.split(","):
    place_lights(side)
    for elev in (float(v) for v in A.elev.split(",")):
        place_camera(elev)
        for yaw in (float(v) for v in A.yaw.split(",")):
            can.rotation_euler = (0, 0, math.radians(yaw))
            name = f"can_e{elev:+.0f}_y{yaw:+.0f}_k{side}.png"
            scene.render.filepath = os.path.join(A.out, name)
            bpy.ops.render.render(write_still=True)
            print("렌더", name, flush=True)

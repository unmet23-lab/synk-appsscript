# 솔리오 「사업계획서 쓰기」 첫 화면 그림: 호두나무 책상 뒤의 검은 구가 빈 종이 앞에서 귀 기울인다(2026-11-24).
# 구에는 눈을 굽지 않는다. 화면이 자리.json의 눈 자리에 눈을 얹어 깜빡이고 표정을 바꾼다.
#
#   blender -b --factory-startup -P 쓰기책상.py -- <나갈 폴더> [가로=1536] [샘플=192]
#   나가는 것: write.png(3:2, 불투명) · 책상자리.json(구의 중심 · 반지름 · 눈 자리, 화면 비율)
import bpy, math, os, sys, json
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0]; W = int(argv[1]) if len(argv) > 1 else 1536; SPP = int(argv[2]) if len(argv) > 2 else 192
H = int(W * 2 / 3 / 2) * 2
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene; col = scene.collection


def lin(hexs):
    h = hexs.lstrip('#'); v = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in v) + (1.0,)


def mat(name, color, rough=0.5, coat=0.0, coat_rough=0.12, spec=0.5, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    for k, v in (('Base Color', lin(color)), ('Roughness', rough), ('Coat Weight', coat), ('Coat Roughness', coat_rough), ('Specular IOR Level', spec)):
        if k in b.inputs: b.inputs[k].default_value = v
    if emit:
        for k, v in (('Emission Color', lin(color)), ('Emission Strength', emit)):
            if k in b.inputs: b.inputs[k].default_value = v
    return m


def wood(name):
    m = mat(name, '#3b2618', rough=0.4); nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    co = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.0, 7.0, 1.0)
    wv = nt.nodes.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'X'
    wv.inputs['Scale'].default_value = 1.6; wv.inputs['Distortion'].default_value = 2.5; wv.inputs['Detail'].default_value = 2.0
    rp = nt.nodes.new('ShaderNodeValToRGB')
    rp.color_ramp.elements[0].position = 0.3; rp.color_ramp.elements[0].color = lin('#33200f')
    rp.color_ramp.elements[1].position = 0.9; rp.color_ramp.elements[1].color = lin('#47301d')
    nt.links.new(co.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], wv.inputs['Vector'])
    nt.links.new(wv.outputs['Fac'], rp.inputs['Fac']); nt.links.new(rp.outputs['Color'], b.inputs['Base Color'])
    return m


ORB = mat('구', '#030303', rough=0.3, coat=0.6, coat_rough=0.14, spec=0.55)
FLOOR = mat('바닥', '#080808', rough=0.75, spec=0.3)
WOOD = wood('호두나무')
PAPER = mat('종이', '#f1eee7', rough=0.85, spec=0.2)
GRAPH = mat('흑연', '#1d1c1a', rough=0.35, coat=0.4)
SEAT = mat('의자', '#0d0d0c', rough=0.8, spec=0.2)
BULB = mat('전구', '#ffe7c2', rough=0.5, emit=6.0)


def add(o, m=None, smooth=False):
    if m: o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o


def box(name, loc, size, m, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot); o = bpy.context.active_object; o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2); bpy.ops.object.transform_apply(scale=True)
    if bevel:
        bv = o.modifiers.new('bevel', 'BEVEL'); bv.width = bevel; bv.segments = 4
    return add(o, m)


def cyl(name, loc, r, depth, m, rot=(0, 0, 0), verts=64, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if bevel:
        bv = o.modifiers.new('bevel', 'BEVEL'); bv.width = bevel; bv.segments = 4
    return add(o, m, True)


bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0)); add(bpy.context.active_object, FLOOR)
# 책상: 상판과 다리 넷
TOP = 0.74
box('상판', (0, 0, TOP - 0.025), (1.5, 0.75, 0.05), WOOD, bevel=0.008)
for i, (x, y) in enumerate(((-0.68, -0.31), (0.68, -0.31), (-0.68, 0.31), (0.68, 0.31))):
    box('다리%d' % i, (x, y, (TOP - 0.05) / 2), (0.045, 0.045, TOP - 0.05), WOOD)
# 뒤판: 책상 밑으로 의자 기둥이 막대처럼 보이지 않게 뒤쪽 다리 사이를 막는다(11-24 맹검 지적)
box('뒤판', (0, 0.31, 0.385), (1.32, 0.02, 0.61), WOOD, bevel=0.004)
# 구: 책상 뒤 의자에 앉아 앞을 본다
R = 0.3
bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=R, location=(0.05, 0.62, 0.62 + R)); orb = add(bpy.context.active_object, ORB, True)
cyl('의자', (0.05, 0.62, 0.6), 0.26, 0.05, SEAT, bevel=0.01); cyl('의자다리', (0.05, 0.62, 0.29), 0.03, 0.58, SEAT, verts=24)
# 종이 묶음과 앞으로 당겨 놓은 맨 위 한 장, 만년필
for i in range(5):
    box('종이%d' % i, (0.08, -0.02, TOP + 0.0035 + i * 0.0035), (0.3, 0.42, 0.003), PAPER, rot=(0, 0, math.radians(-3 + i * 0.8)))
box('맨위', (0.04, -0.13, TOP + 0.024), (0.3, 0.42, 0.002), PAPER, rot=(0, 0, math.radians(6)))
cyl('만년필', (0.34, -0.16, TOP + 0.009), 0.008, 0.16, GRAPH, rot=(math.radians(90), 0, math.radians(18)), verts=24)
# 작은 책상 등: 받침, 기둥, 갓, 전구
LX, LY = -0.52, 0.12
cyl('등받침', (LX, LY, TOP + 0.01), 0.07, 0.02, GRAPH, bevel=0.004)
cyl('등기둥', (LX, LY, TOP + 0.2), 0.009, 0.38, GRAPH, verts=24)
bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.085, radius2=0.03, depth=0.1, location=(LX + 0.06, LY - 0.03, TOP + 0.38), rotation=(math.radians(25), math.radians(35), 0))
shade = add(bpy.context.active_object, GRAPH, True)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, location=(LX + 0.08, LY - 0.05, TOP + 0.35)); add(bpy.context.active_object, BULB, True)


def light(name, kind, loc, power, size=1.0, color='#fff3e2', target=None, spot=None, shadow=True, glossy=True):
    ld = bpy.data.lights.new(name, kind); ld.energy = power; ld.color = lin(color)[:3]
    if kind == 'AREA': ld.size = size; ld.shape = 'DISK'
    if kind == 'SPOT': ld.spot_size = spot[0]; ld.spot_blend = spot[1]; ld.shadow_soft_size = size
    if kind == 'POINT': ld.shadow_soft_size = size
    try: ld.use_shadow = shadow
    except Exception: pass
    o = bpy.data.objects.new(name, ld); o.location = loc; col.objects.link(o); o.visible_glossy = glossy
    if target is not None:
        d = Vector(target) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return o

light('등빛', 'POINT', (LX + 0.09, LY - 0.07, TOP + 0.33), 9, size=0.03, color='#ffd9a8')
light('위빛', 'SPOT', (0.0, 0.1, 3.4), 260, size=0.3, target=(0.03, 0.1, TOP), spot=(math.radians(34), 0.55))
light('뒷빛', 'AREA', (0.6, 2.4, 1.9), 40, size=2.0, color='#ffe6c8', target=(0.05, 0.62, 0.9), shadow=False)
light('앞보조', 'AREA', (-1.6, -2.4, 2.2), 22, size=4.0, color='#e9ecf3', target=(0, 0.3, 0.8), shadow=False, glossy=False)
scene.world = bpy.data.worlds.new('어둠'); scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)

cd = bpy.data.cameras.new('카메라'); cd.lens = 46; cd.sensor_width = 36
cam = bpy.data.objects.new('카메라', cd); col.objects.link(cam); scene.camera = cam
cam.location = (0.62, -3.15, 1.78)
aim = Vector((0.02, 0.25, 0.8)); cam.rotation_euler = (aim - cam.location).to_track_quat('-Z', 'Y').to_euler()

r = scene.render; r.engine = 'CYCLES'; r.resolution_x = W; r.resolution_y = H; r.resolution_percentage = 100
r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGB'; r.film_transparent = False
scene.display_settings.display_device = 'sRGB'; scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'None'; scene.view_settings.exposure = 0.2
c = scene.cycles; c.samples = SPP; c.use_adaptive_sampling = True; c.adaptive_threshold = 0.01; c.max_bounces = 6; c.use_denoising = True
dev = 'CPU'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for backend in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = backend
            (prefs.refresh_devices if hasattr(prefs, 'refresh_devices') else prefs.get_devices)()
            found = False
            for d in prefs.devices:
                d.use = d.type == backend; found = found or d.use
            if found: dev = backend; break
        except Exception: pass
except Exception as e: print('장치 고르기 실패', e)
c.device = 'CPU' if dev == 'CPU' else 'GPU'
try: c.denoiser = 'OPTIX' if dev == 'OPTIX' else 'OPENIMAGEDENOISE'
except Exception: pass

bpy.context.view_layer.update()


def scr(p):
    v = world_to_camera_view(scene, cam, Vector(p)); return [round(v.x, 5), round(1 - v.y, 5)]

ctr = Vector(orb.location); right = cam.matrix_world.to_3x3() @ Vector((1, 0, 0))
a = scr(ctr); b = scr(ctr + right * R)
face = ((cam.location - ctr).normalized() + Vector((0, 0, 0.18))).normalized()
spot = {'c': a, 'r': round(abs(b[0] - a[0]), 5), 'eye': scr(ctr + face * R), 'size': [W, H]}
json.dump(spot, open(os.path.join(OUT, '책상자리.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('자리', json.dumps(spot))
r.filepath = os.path.join(OUT, 'write.png'); bpy.ops.render.render(write_still=True)
print('끝')

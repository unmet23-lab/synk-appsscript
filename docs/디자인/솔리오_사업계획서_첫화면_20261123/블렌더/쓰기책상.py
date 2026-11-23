# 솔리오 「사업계획서 쓰기」 첫 화면 그림: 호두나무 책상 뒤 나무 의자에 앉은 검은 구가 빈 종이 앞에서 귀 기울인다(2026-11-24).
# 2판(11-24 유호님 「3D 무대 다듬기」): 팀 고르기 6판 장면(유호님 「너무 훌륭해 깔끔하다」)의 결을 따른다.
#   무광에 가까운 구, 결이 보이는 호두나무와 둥근 모서리, 둥글고 가늘어지는 다리, 네 다리 의자, 따뜻한 어둠.
#   책상 밑으로 의자 기둥 하나가 막대처럼 보이던 1판(맹검 지적)은 네 다리 의자로 바꿨다.
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


def bsdf(m):
    return next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def mat(name, color, rough=0.5, coat=0.0, coat_rough=0.12, spec=0.5, metal=0.0, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = bsdf(m)
    for k, v in (('Base Color', lin(color)), ('Roughness', rough), ('Coat Weight', coat), ('Coat Roughness', coat_rough),
                 ('Specular IOR Level', spec), ('Metallic', metal)):
        if k in b.inputs: b.inputs[k].default_value = v
    if emit:
        for k, v in (('Emission Color', lin(color)), ('Emission Strength', emit)):
            if k in b.inputs: b.inputs[k].default_value = v
    return m


def bump(m, scale, strength):
    nt = m.node_tree; b = bsdf(m)
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 3.0
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength; bp.inputs['Distance'].default_value = 0.02
    nt.links.new(nz.outputs['Fac'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m


def wood(name, along='X', dark='#2a180e', light='#5c3b24', fine=7.0):
    """심사 무대와 같은 호두나무: 곧은 결과 가끔 휘는 무늬, 옅은 칠."""
    m = mat(name, '#4a2f1d', rough=0.4, coat=0.3, coat_rough=0.28, spec=0.45); nt = m.node_tree; b = bsdf(m)
    co = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = {'X': (0.35, fine, fine), 'Y': (fine, 0.35, fine), 'Z': (fine, fine, 0.35)}[along]
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.4; nz.inputs['Detail'].default_value = 6.0
    nz.inputs['Distortion'].default_value = 0.6
    wv = nt.nodes.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = {'X': 'Y', 'Y': 'X', 'Z': 'X'}[along]
    wv.inputs['Scale'].default_value = 1.6; wv.inputs['Distortion'].default_value = 3.5; wv.inputs['Detail'].default_value = 4.0
    mix = nt.nodes.new('ShaderNodeMath'); mix.operation = 'MULTIPLY_ADD'; mix.inputs[1].default_value = 0.55
    rp = nt.nodes.new('ShaderNodeValToRGB')
    rp.color_ramp.elements[0].position = 0.2; rp.color_ramp.elements[0].color = lin(dark)
    rp.color_ramp.elements[1].position = 0.95; rp.color_ramp.elements[1].color = lin(light)
    nt.links.new(co.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], wv.inputs['Vector'])
    nt.links.new(wv.outputs['Fac'], mix.inputs[0]); nt.links.new(nz.outputs['Fac'], mix.inputs[2])
    nt.links.new(mix.outputs['Value'], rp.inputs['Fac']); nt.links.new(rp.outputs['Color'], b.inputs['Base Color'])
    return m


def orb_mat():
    """정본 「구 가」(결정 11-16): 결을 깎은 검정 금속 구, 꼭지를 지나는 빛줄기 한 줄. 심사무대.py와 같은 재질이다."""
    m = bpy.data.materials.new('구'); m.use_nodes = True; nt = m.node_tree; b = bsdf(m)
    for k, v in (('Base Color', lin('#a0a0a0')), ('Metallic', 1.0), ('Roughness', 0.2), ('Anisotropic', 0.95), ('Anisotropic Rotation', 0.25)):
        if k in b.inputs: b.inputs[k].default_value = v
    tg = nt.nodes.new('ShaderNodeTangent'); tg.direction_type = 'RADIAL'; tg.axis = 'Z'
    nt.links.new(tg.outputs['Tangent'], b.inputs['Tangent'])
    return m


ORB = orb_mat()
FLOOR = mat('바닥', '#0b0908', rough=0.72, spec=0.3)
WOOD_X = wood('호두나무_가로', 'X', dark='#2e1b10', light='#553621', fine=3.2); WOOD_Y = wood('호두나무_깊이', 'Y'); WOOD_Z = wood('호두나무_세로', 'Z')
PAPER = mat('종이', '#f1eee7', rough=0.85, spec=0.2)
INK = mat('먹', '#141312', rough=0.3, coat=0.5)
BRASS = mat('놋', '#b08d57', rough=0.3, metal=1.0)
SHADE = mat('갓', '#1d1b19', rough=0.45, coat=0.3)
LEATHER = mat('가죽', '#3a2519', rough=0.55, coat=0.1)
SEAT = mat('방석', '#141210', rough=0.75, spec=0.25)
BULB = mat('전구', '#ffe2b8', rough=0.5, emit=8.0)


def add(o, m=None, smooth=False):
    if m: o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o


def box(name, loc, size, m, bevel=0.0, seg=4, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot); o = bpy.context.active_object; o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2); bpy.ops.object.transform_apply(scale=True)
    if bevel:
        bv = o.modifiers.new('bevel', 'BEVEL'); bv.width = bevel; bv.segments = seg; bv.limit_method = 'NONE'
        o.modifiers.new('ws', 'WEIGHTED_NORMAL'); return add(o, m, True)
    return add(o, m)


def cyl(name, loc, r, depth, m, rot=(0, 0, 0), verts=64, bevel=0.0, seg=5, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if bevel:
        bv = o.modifiers.new('bevel', 'BEVEL'); bv.width = bevel; bv.segments = seg; bv.limit_method = 'ANGLE'
        o.modifiers.new('ws', 'WEIGHTED_NORMAL')
    return add(o, m, True)


bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0)); add(bpy.context.active_object, FLOOR)
# 책상: 두꺼운 상판(둥근 모서리), 앞치마 판, 둥글고 가늘어지는 다리 넷
TOP = 0.74; TW, TD, TT = 1.5, 0.75, 0.055
box('상판', (0, 0, TOP - TT / 2), (TW, TD, TT), WOOD_X, bevel=0.024, seg=8)
for i, sy in enumerate((-1, 1)):
    box('앞치마%d' % i, (0, sy * (TD / 2 - 0.06), TOP - TT - 0.04), (TW - 0.26, 0.025, 0.08), WOOD_X, bevel=0.006)
for i, sx in enumerate((-1, 1)):
    box('옆치마%d' % i, (sx * (TW / 2 - 0.13), 0, TOP - TT - 0.04), (0.025, TD - 0.12, 0.08), WOOD_Y, bevel=0.006)
for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
    cyl('다리%d' % i, (sx * (TW / 2 - 0.14), sy * (TD / 2 - 0.09), (TOP - TT) / 2), 0.022, TOP - TT, WOOD_Z, verts=24, r2=0.032)
# 구: 책상 뒤 네 다리 나무 의자에 앉아 앞을 본다
R = 0.3; OX, OY = 0.05, 0.62
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=R, location=(OX, OY, 0.62 + R)); orb = add(bpy.context.active_object, ORB, True)
box('뒤판', (0, TD / 2 - 0.07, (TOP - TT) / 2 + 0.03), (TW - 0.3, 0.022, TOP - TT - 0.06), WOOD_X, bevel=0.006)
cyl('의자자리', (OX, OY, 0.585), 0.22, 0.07, SEAT, bevel=0.028, seg=6)
for k in range(4):
    a = math.radians(45 + 90 * k); lx, ly = math.cos(a) * 0.15, math.sin(a) * 0.15; t = math.radians(6)
    cyl('의자다리%d' % k, (OX + lx * 1.1, OY + ly * 1.1, 0.275), 0.016, 0.55, WOOD_Z, rot=(-math.sin(a) * t, math.cos(a) * t, 0), verts=20, r2=0.021)
# 종이 묶음과 앞으로 당겨 놓은 맨 위 한 장, 만년필, 가죽 수첩
for i in range(5):
    box('종이%d' % i, (0.08, -0.02, TOP + 0.0035 + i * 0.0035), (0.3, 0.42, 0.003), PAPER, rot=(0, 0, math.radians(-3 + i * 0.8)))
box('맨위', (0.04, -0.13, TOP + 0.024), (0.3, 0.42, 0.002), PAPER, rot=(0, 0, math.radians(6)))
cyl('만년필', (0.34, -0.16, TOP + 0.009), 0.0085, 0.15, INK, rot=(math.radians(90), 0, math.radians(18)), verts=24)
cyl('만년필띠', (0.34 - 0.03 * math.sin(math.radians(18)), -0.16 + 0.03 * math.cos(math.radians(18)), TOP + 0.009), 0.009, 0.012, BRASS,
    rot=(math.radians(90), 0, math.radians(18)), verts=24)
box('수첩', (0.5, 0.14, TOP + 0.012), (0.17, 0.24, 0.024), LEATHER, bevel=0.006, rot=(0, 0, math.radians(-9)))
# 책상 등: 놋 받침, 가는 기둥, 짙은 갓, 따뜻한 전구
LX, LY = -0.52, 0.12
cyl('등받침', (LX, LY, TOP + 0.012), 0.075, 0.024, BRASS, bevel=0.008)
cyl('등기둥', (LX, LY, TOP + 0.2), 0.008, 0.38, BRASS, verts=24)
bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.09, radius2=0.035, depth=0.11, location=(LX + 0.06, LY - 0.03, TOP + 0.38), rotation=(math.radians(25), math.radians(35), 0))
shade = add(bpy.context.active_object, SHADE, True)
sv = shade.modifiers.new('두께', 'SOLIDIFY'); sv.thickness = 0.004
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


light('등빛', 'POINT', (LX + 0.09, LY - 0.07, TOP + 0.33), 10, size=0.03, color='#ffd4a0')
light('위빛', 'SPOT', (0.0, 0.1, 3.4), 220, size=0.3, color='#fff0dc', target=(0.03, 0.1, TOP), spot=(math.radians(34), 0.6))
light('주광', 'AREA', (-2.0, -1.6, 2.6), 40, size=2.4, color='#ffe2c2', target=(0.05, 0.4, 0.8))
light('뒷빛', 'AREA', (0.7, 2.2, 1.9), 30, size=2.0, color='#ffe2c2', target=(OX, OY, 0.9), shadow=False)
light('앞보조', 'AREA', (1.6, -2.6, 2.0), 10, size=4.0, color='#e9ecf3', target=(0, 0.3, 0.8), shadow=False, glossy=False)
scene.world = bpy.data.worlds.new('어둠'); scene.world.use_nodes = True
bg = scene.world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = lin('#090706'); bg.inputs['Strength'].default_value = 0.1

cd = bpy.data.cameras.new('카메라'); cd.lens = 46; cd.sensor_width = 36
cam = bpy.data.objects.new('카메라', cd); col.objects.link(cam); scene.camera = cam
cam.location = (0.62, -3.15, 1.78)
aim = Vector((0.02, 0.25, 0.8)); cam.rotation_euler = (aim - cam.location).to_track_quat('-Z', 'Y').to_euler()
bpy.context.view_layer.update()
_M = cam.matrix_world.to_3x3(); _T = (cam.location - orb.location).normalized()
orb.rotation_euler = ((_M @ Vector((1, 0, 0))) * 0.28 + (_M @ Vector((0, 1, 0))) * 0.52 + _T * 0.81).normalized().to_track_quat('Z', 'Y').to_euler()
# 정본 구는 빛줄기만 비친다: 물체는 반사에 나오지 않는다. 넓은 빛은 구에 닿지 않고, 구에는 작은 빛 둘만 준다
for o in bpy.data.objects:
    if o.type == 'MESH': o.visible_glossy = False
rest = bpy.data.collections.new('구뺀것'); orbs_c = bpy.data.collections.new('구')
for o in bpy.data.objects:
    if o.type == 'MESH': (orbs_c if o is orb else rest).objects.link(o)
for o in [o for o in bpy.data.objects if o.type == 'LIGHT']:
    o.light_linking.receiver_collection = rest
for n, loc, pw, sz, colr in (('구빛', (-1.6, -1.8, 2.6), 30, 0.25, '#fff3e6'), ('구테', (1.2, 2.2, 1.4), 16, 1.2, '#ffe2c2'),
                             ('구바탕', (0.4, -1.4, 2.6), 9, 5.0, '#f4efe8')):   # 구바탕: 넓고 약한 빛이 구의 윤곽을 옅게 드러낸다(정본의 옅은 결)
    lo = light(n, 'AREA', loc, pw, size=sz, color=colr, target=(OX, OY, 0.92), shadow=(n == '구빛'))
    lo.light_linking.receiver_collection = orbs_c

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

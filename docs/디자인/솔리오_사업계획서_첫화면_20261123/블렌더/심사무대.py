# 솔리오 첫 업무 「사업계획서 심사」 무대를 층마다 굽는다(2026-11-24).
# 조명 아래 단상의 발표자 구, 오른쪽 이젤의 빈 종이, 앞쪽 긴 호두나무 탁자와 뒷모습의 심사위원 구 셋.
# 화면은 이 층들을 겹치고, 눈 · 말풍선 · 종이 글 · 점수 글만 그 위에서 움직인다. 층마다 같은 카메라라 그대로 겹치면 맞는다.
#
#   blender -b --factory-startup -P 심사무대.py -- <나갈 폴더> [가로=1920] [샘플=160] [층=all|plate|test|spots]   (spots는 자리.json만)
#   나가는 것: plate.png(배경, 불투명) · presenter.png · judge0~2.png · paddle0~2.png(투명, 화면 전체 크기) · orb.png(안내용 구 하나, 정사각)
#             자리.json(화면 비율 0~1로 구의 중심 · 반지름 · 눈 자리, 종이 네 모서리, 점수판 면)
import bpy, math, os, sys, json
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0]; W = int(argv[1]) if len(argv) > 1 else 1920; SPP = int(argv[2]) if len(argv) > 2 else 160
WHICH = argv[3] if len(argv) > 3 else 'all'
H = int(W * 10 / 16 / 2) * 2
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection


def lin(hexs):
    h = hexs.lstrip('#'); v = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in v) + (1.0,)


def mat(name, color, rough=0.5, coat=0.0, coat_rough=0.12, spec=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    def put(k, v):
        if k in b.inputs: b.inputs[k].default_value = v
    put('Base Color', lin(color)); put('Roughness', rough); put('Coat Weight', coat); put('Coat Roughness', coat_rough)
    put('Specular IOR Level', spec)
    return m


def wood(name):
    """호두나무: 결을 따라 짙고 옅은 띠, 결 방향 거칠기 차."""
    m = mat(name, '#3b2618', rough=0.42); nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    co = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.0, 9.0, 1.0)
    wv = nt.nodes.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'Y'
    wv.inputs['Scale'].default_value = 3.2; wv.inputs['Distortion'].default_value = 7.0; wv.inputs['Detail'].default_value = 3.0
    rp = nt.nodes.new('ShaderNodeValToRGB')
    rp.color_ramp.elements[0].position = 0.25; rp.color_ramp.elements[0].color = lin('#26170e')
    rp.color_ramp.elements[1].position = 0.85; rp.color_ramp.elements[1].color = lin('#4c3220')
    nt.links.new(co.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], wv.inputs['Vector'])
    nt.links.new(wv.outputs['Fac'], rp.inputs['Fac']); nt.links.new(rp.outputs['Color'], b.inputs['Base Color'])
    return m


ORB = mat('구', '#030303', rough=0.26, coat=0.75, coat_rough=0.12, spec=0.6)
FLOOR = mat('바닥', '#070707', rough=0.7, spec=0.3)
PLAT = mat('단상', '#1a1917', rough=0.4, coat=0.2)
EASEL = mat('이젤', '#24221f', rough=0.45)
PAPER = mat('종이', '#f1eee7', rough=0.85, spec=0.2)
WOOD = wood('호두나무')
STICK = mat('손잡이', '#4a3020', rough=0.5)
CARD = mat('점수판', '#f3f1ec', rough=0.7, spec=0.25)
_cb = next(n for n in CARD.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
for k, v in (('Emission Color', lin('#f3f1ec')), ('Emission Strength', 0.35)):
    if k in _cb.inputs: _cb.inputs[k].default_value = v
SEAT = mat('의자', '#0c0c0b', rough=0.85, spec=0.2)


def add(obj, m=None, smooth=False):
    if m: obj.data.materials.append(m)
    if smooth:
        for p in obj.data.polygons: p.use_smooth = True
    return obj


def sphere(name, loc, r):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=r, location=loc)
    o = bpy.context.active_object; o.name = name; return add(o, ORB, True)


def box(name, loc, size, m, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc); o = bpy.context.active_object; o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2); bpy.ops.object.transform_apply(scale=True)
    if bevel:
        bv = o.modifiers.new('bevel', 'BEVEL'); bv.width = bevel; bv.segments = 4
    return add(o, m)


def cyl(name, loc, r, depth, m, rot=(0, 0, 0), verts=96, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if bevel:
        bv = o.modifiers.new('bevel', 'BEVEL'); bv.width = bevel; bv.segments = 5
    return add(o, m, True)


# ── 무대 ──
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 6, 0)); floor = add(bpy.context.active_object, FLOOR); floor.name = '바닥'
PX, PY = -0.86, 3.05                     # 단상 가운데
plat = cyl('단상', (PX, PY, 0.25), 1.05, 0.5, PLAT, bevel=0.03)
PR = 0.42
presenter = sphere('발표자', (PX, PY, 0.5 + PR), PR)
# 이젤: 다리 셋, 받침, 종이
EX, EY = 1.0, 3.2
legs = []
for i, (dx, dy, tilt) in enumerate(((-0.3, -0.06, 0.16), (0.3, -0.06, -0.16), (0.0, 0.32, 0.0))):
    lg = cyl('이젤다리%d' % i, (EX + dx, EY + dy, 0.78), 0.018, 1.6, EASEL, rot=(0.2 if i == 2 else -0.08, tilt, 0), verts=24); legs.append(lg)
tray = box('받침', (EX, EY - 0.1, 0.86), (0.78, 0.07, 0.035), EASEL, bevel=0.006)
bpy.ops.mesh.primitive_plane_add(size=1, location=(EX, EY - 0.08, 1.31), rotation=(math.radians(82), 0, 0))
sheet = bpy.context.active_object; sheet.name = '종이'; sheet.scale = (0.64, 0.86, 1); bpy.ops.object.transform_apply(scale=True); add(sheet, PAPER)
# 심사위원 탁자와 셋
TY = 1.15
table = box('탁자', (0, TY, 0.79), (4.9, 0.8, 0.07), WOOD, bevel=0.012)
for i, x in enumerate((-2.2, 2.2)):
    box('탁자다리%d' % i, (x, TY, 0.38), (0.07, 0.6, 0.76), WOOD)
JR = 0.4; JX = (-1.36, 0.0, 1.36); JY = -0.12; JZ = 0.6
judges = [sphere('심사위원%d' % i, (x, JY, JZ), JR) for i, x in enumerate(JX)]
stools = []
for i, x in enumerate(JX):
    stools.append(cyl('의자%d' % i, (x, JY, JZ - JR - 0.03), 0.27, 0.06, SEAT, bevel=0.012))
    stools.append(cyl('의자다리%d' % i, (x, JY, (JZ - JR - 0.06) / 2), 0.035, JZ - JR - 0.06, SEAT, verts=24))
# 점수판: 둥근 흰 판과 나무 손잡이. 심사위원 머리 위로 든다
paddles = []
for i, x in enumerate(JX):
    face = cyl('점수판%d' % i, (x, JY + 0.15, JZ + JR + 0.5), 0.2, 0.025, CARD, rot=(math.radians(84), 0, 0), bevel=0.008)
    st = cyl('점수판손잡이%d' % i, (x, JY + 0.12, JZ + JR + 0.16), 0.016, 0.5, STICK, rot=(math.radians(-6), 0, 0), verts=20)
    paddles.append((face, st))

# 빛줄기: 위에서 단상으로 내리는 원뿔 안에만 아주 옅은 안개
bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=1.45, radius2=0.16, depth=4.6, location=(PX, PY - 0.05, 2.3))
beam = bpy.context.active_object; beam.name = '빛줄기'
vm = bpy.data.materials.new('안개'); vm.use_nodes = True; nt = vm.node_tree
for n in list(nt.nodes):
    if n.type == 'BSDF_PRINCIPLED': nt.nodes.remove(n)
try: vol = nt.nodes.new('ShaderNodeVolumePrincipled')
except RuntimeError: vol = nt.nodes.new('ShaderNodePrincipledVolume')
vol.inputs['Density'].default_value = 0.012; vol.inputs['Color'].default_value = lin('#fff1dc')
nt.links.new(vol.outputs['Volume'], nt.nodes['Material Output'].inputs['Volume']); beam.data.materials.append(vm)

# ── 빛 ──
def light(name, kind, loc, power, size=1.0, color='#fff3e2', target=None, spot=None, shadow=True):
    ld = bpy.data.lights.new(name, kind); ld.energy = power; ld.color = lin(color)[:3]
    if kind == 'AREA': ld.size = size; ld.shape = 'DISK'
    if kind == 'SPOT': ld.spot_size = spot[0]; ld.spot_blend = spot[1]; ld.shadow_soft_size = size
    try: ld.use_shadow = shadow
    except Exception: pass
    o = bpy.data.objects.new(name, ld); o.location = loc; col.objects.link(o)
    if name in ('앞보조', '탁자빛'):
        o.visible_glossy = False   # 구의 등에 큰 반사 원이 생기지 않게 빛만 준다
    if target is not None:
        d = Vector(target) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return o

light('조명', 'SPOT', (PX, PY - 0.05, 4.6), 820, size=0.25, target=(PX, PY, 0.2), spot=(math.radians(38), 0.45))
light('이젤빛', 'SPOT', (EX - 0.4, EY - 1.4, 3.2), 120, size=0.3, target=(EX, EY, 1.2), spot=(math.radians(26), 0.6))
light('뒷빛', 'AREA', (0, 5.6, 2.6), 55, size=4.0, color='#ffe6c8', target=(0, 0.4, 0.8), shadow=False)
light('앞보조', 'AREA', (-2.2, -2.6, 3.4), 46, size=5.0, color='#e9ecf3', target=(0, 2.5, 0.6), shadow=False)
light('탁자빛', 'AREA', (0, 2.4, 2.8), 12, size=3.0, target=(0, TY, 0.8), shadow=False)
scene.world = bpy.data.worlds.new('어둠'); scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)

# ── 카메라: 심사위원 뒤 조금 위에서 무대를 본다 ──
cd = bpy.data.cameras.new('카메라'); cd.lens = 38; cd.sensor_width = 36
cam = bpy.data.objects.new('카메라', cd); col.objects.link(cam); scene.camera = cam
cam.location = (0.1, -3.7, 2.5)
aim = Vector((0.0, 2.6, 0.5)); cam.rotation_euler = (aim - cam.location).to_track_quat('-Z', 'Y').to_euler()

# ── 굽기 설정 ──
r = scene.render; r.engine = 'CYCLES'; r.resolution_x = W; r.resolution_y = H; r.resolution_percentage = 100
r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'
scene.display_settings.display_device = 'sRGB'; scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'None'; scene.view_settings.exposure = 0.25
c = scene.cycles; c.samples = SPP; c.use_adaptive_sampling = True; c.adaptive_threshold = 0.012; c.max_bounces = 6; c.use_denoising = True
c.volume_step_rate = 2.0
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
print('장치', dev, W, 'x', H, '샘플', SPP)

CHARS = [presenter] + judges + [o for pair in paddles for o in pair]
STAGE = [floor, plat, sheet, tray, table] + legs + stools + [o for o in bpy.data.objects if o.name.startswith('탁자다리')]


def render(name, show, transparent):
    for o in CHARS: o.hide_render = o not in show
    beam.hide_render = transparent
    for o in STAGE:
        o.is_shadow_catcher = transparent
    r.film_transparent = transparent
    r.filepath = os.path.join(OUT, name + '.png'); bpy.ops.render.render(write_still=True); print('구움', name)


# ── 화면에 얹을 자리(0~1, 왼쪽 위가 0) ──
bpy.context.view_layer.update()   # 카메라 · 물체의 행렬을 새로 셈해야 자리가 맞는다
def scr(p):
    v = world_to_camera_view(scene, cam, Vector(p)); return [round(v.x, 5), round(1 - v.y, 5)]


def orb_spot(o, rad):
    ctr = Vector(o.location); right = cam.matrix_world.to_3x3() @ Vector((1, 0, 0))
    a = scr(ctr); b = scr(ctr + right * rad)
    to_cam = (cam.location - ctr).normalized(); up = Vector((0, 0, 1))
    face = (to_cam + up * 0.18).normalized()          # 눈은 얼굴 가운데보다 조금 위
    return {'c': a, 'r': round(abs(b[0] - a[0]), 5), 'eye': scr(ctr + face * rad)}

spots = {'presenter': orb_spot(presenter, PR), 'judges': [orb_spot(j, JR) for j in judges],
         'sheet': [scr(sheet.matrix_world @ v.co) for v in sheet.data.vertices],
         'paddles': [{'c': scr(f.location), 'r': round(abs(scr(f.location + cam.matrix_world.to_3x3() @ Vector((0.2, 0, 0)))[0] - scr(f.location)[0]), 5)} for f, _ in paddles],
         'plate': scr((PX, PY - 1.05, 0.5)), 'size': [W, H]}
json.dump(spots, open(os.path.join(OUT, '자리.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('자리', json.dumps(spots, ensure_ascii=False))

if WHICH in ('all', 'plate', 'test'):
    render('plate', [], False)
if WHICH == 'test':
    render('test_all', CHARS, False)
if WHICH == 'all':
    render('presenter', [presenter], True)
    for i, j in enumerate(judges): render('judge%d' % i, [j], True)
    for i, (f, s) in enumerate(paddles): render('paddle%d' % i, [f, s], True)
    # 안내용 구 하나: 앞에서 본 구, 바닥 그림자만
    for o in bpy.data.objects:
        if o.type == 'MESH': o.hide_render = True
    beam.hide_render = True
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=0.5, location=(30, 0, 0.5)); g = add(bpy.context.active_object, ORB, True)
    bpy.ops.mesh.primitive_plane_add(size=6, location=(30, 0, 0)); gf = add(bpy.context.active_object, FLOOR); gf.is_shadow_catcher = True
    for o in [o for o in bpy.data.objects if o.type == 'LIGHT']: o.hide_render = True
    light('안내앞', 'AREA', (28.7, -1.8, 2.1), 45, size=2.6, target=(30, 0, 0.5))
    light('안내뒤', 'AREA', (31.2, 1.8, 1.6), 90, size=1.4, color='#ffe6c8', target=(30, 0, 0.5), shadow=False)
    light('안내위', 'AREA', (30, 0.4, 3.2), 8, size=3.0, target=(30, 0, 0), shadow=True)
    cam.location = (30, -3.2, 1.0); cam.rotation_euler = (Vector((30, 0, 0.5)) - cam.location).to_track_quat('-Z', 'Y').to_euler(); cd.lens = 70
    r.resolution_x = 640; r.resolution_y = 640; r.film_transparent = True
    r.filepath = os.path.join(OUT, 'orb.png'); bpy.ops.render.render(write_still=True); print('구움 orb')
print('끝')

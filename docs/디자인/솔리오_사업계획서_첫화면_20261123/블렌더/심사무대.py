# 솔리오 첫 업무 「사업계획서 심사」 무대를 층마다 굽는다(2026-11-24).
# 조명 아래 단상의 발표자 구, 오른쪽 이젤의 빈 종이, 앞쪽 호두나무 탁자와 나무 의자에 앉은 뒷모습의 심사위원 구 셋.
# 3판(11-25 유호님 「무대도 바꿔」): 팀 고르기 4판 그림의 결을 따른다. 새틴 검정 구, 결이 거의 없는 따뜻한 호두나무,
#   장난감처럼 단순하고 둥근 소품(판 다리 탁자, 짙은 둥근 받침, 두 다리 판), 막과 빛줄기 안개 없는 어둠. 2판(11-24)의 정교한 가구는 걷었다.
# 2판(11-24 유호님 「3D 무대 다듬기」): 유호님이 「너무 훌륭해 깔끔하다」고 하신 팀 고르기 6판 장면의 결을 따랐다.
#   무광에 가까운 검은 구, 결이 보이는 호두나무와 둥근 모서리, 네 다리 나무 의자, 따뜻한 어둠.
#   심사위원마다 탁자 위 소품이 다르다(Opus 수첩과 만년필, Sol 노트북, Sonnet 서류 묶음). 고리 · 구멍 · 빽빽한 점 무늬는 쓰지 않는다.
# 화면은 이 층들을 겹치고, 눈 · 말풍선 · 종이 글 · 점수 글만 그 위에서 움직인다. 층마다 같은 카메라라 그대로 겹치면 맞는다.
#
#   blender -b --factory-startup -P 심사무대.py -- <나갈 폴더> [가로=1920] [샘플=160] [층=all|plate|test|spots]   (spots는 자리.json만)
#   나가는 것: plate.png(배경, 불투명) · presenter.png · judge0~2.png · paddle0~2.png(투명, 화면 전체 크기) · orb.png(안내용 구 하나, 정사각)
#             자리.json(화면 비율 0~1로 구의 중심 · 반지름 · 눈 자리, 종이 네 모서리, 점수판 면)
import bpy, bmesh, math, os, sys, json
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


def bsdf(m):
    return next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def mat(name, color, rough=0.5, coat=0.0, coat_rough=0.12, spec=0.5, metal=0.0, sheen=0.0, emit=0.0, emit_color=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = bsdf(m)
    def put(k, v):
        if k in b.inputs: b.inputs[k].default_value = v
    put('Base Color', lin(color)); put('Roughness', rough); put('Coat Weight', coat); put('Coat Roughness', coat_rough)
    put('Specular IOR Level', spec); put('Metallic', metal); put('Sheen Weight', sheen)
    if emit:
        put('Emission Color', lin(emit_color or color)); put('Emission Strength', emit)
    return m


def bump(m, scale, strength, detail=3.0):
    """겉에 아주 작은 결을 준다. 구가 거울처럼 매끈해 보이지 않게."""
    nt = m.node_tree; b = bsdf(m)
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = detail
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength; bp.inputs['Distance'].default_value = 0.02
    nt.links.new(nz.outputs['Fac'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m


def wood(name, along='X', base='#6a4128', dark='#5a3620', light='#77492c', fine=None):
    """4판 결의 호두나무: 결이 거의 보이지 않는 따뜻한 갈색에 아주 옅은 얼룩만(along · fine은 옛 부름과 맞추려고 둔다)."""
    m = mat(name, base, rough=0.55, coat=0.15, coat_rough=0.4, spec=0.35); nt = m.node_tree; b = bsdf(m)
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.4; nz.inputs['Detail'].default_value = 1.0
    rp = nt.nodes.new('ShaderNodeValToRGB')
    rp.color_ramp.elements[0].position = 0.3; rp.color_ramp.elements[0].color = lin(dark)
    rp.color_ramp.elements[1].position = 0.7; rp.color_ramp.elements[1].color = lin(light)
    nt.links.new(nz.outputs['Fac'], rp.inputs['Fac']); nt.links.new(rp.outputs['Color'], b.inputs['Base Color'])
    return m


def orb_mat():
    """4판 결의 구(11-25, 유호님 「4판 결로 맞춰」): 새틴 검정. 위 왼쪽에 부드러운 빛 한 점과 가장자리의 옅은 빛만 있고 결 · 빛줄기 · 무늬는 없다.
    11-24에 쓰던 「구 가」 금속 재질(이방성 반사로 빛줄기를 낸 것)은 「완전 대놓고 3d라 오히려 좀 촌스러운」이라 걷었다."""
    m = bpy.data.materials.new('구'); m.use_nodes = True; b = bsdf(m)
    for k, v in (('Base Color', lin('#0d0d0d')), ('Roughness', 0.46), ('Coat Weight', 0.22), ('Coat Roughness', 0.32), ('Specular IOR Level', 0.45)):
        if k in b.inputs: b.inputs[k].default_value = v
    return m


def orient(o, cam_obj):
    """정본처럼 결의 꼭지가 보는 쪽에서 오른쪽 위 앞을 향하게 돌린다(앱의 AXIS.rest = 오른쪽 0.28 · 위 0.52 · 앞 0.81)."""
    M = cam_obj.matrix_world.to_3x3(); R = M @ Vector((1, 0, 0)); U = M @ Vector((0, 1, 0))
    T = (cam_obj.location - Vector(o.location)).normalized()
    o.rotation_euler = (R * 0.28 + U * 0.52 + T * 0.81).normalized().to_track_quat('Z', 'Y').to_euler()


ORB = orb_mat()
FLOOR = mat('바닥', '#070605', rough=0.8, spec=0.25)
PLAT_SIDE = mat('받침', '#1b1917', rough=0.62, coat=0.12, coat_rough=0.35, spec=0.35)   # 4판의 짙은 둥근 받침
PAPER = mat('종이', '#f1eee7', rough=0.85, spec=0.2)
BOARD = mat('판', '#24201c', rough=0.6)
WOOD_X = wood('호두나무_가로', 'X')
WOOD_Y = wood('호두나무_깊이', 'Y')
WOOD_Z = wood('호두나무_세로', 'Z')
CARD = mat('점수판', '#f3f1ec', rough=0.7, spec=0.25, emit=0.35)
SEAT = mat('의자', '#1b1917', rough=0.62, coat=0.12, coat_rough=0.35, spec=0.35)
LEATHER = mat('가죽', '#3a2519', rough=0.55, coat=0.1)
INK = mat('먹', '#141312', rough=0.3, coat=0.5)
BRASS = mat('놋', '#b08d57', rough=0.32, metal=1.0)
ALU = mat('노트북', '#3a3a3c', rough=0.45, coat=0.2, spec=0.4)   # 금속 대신 짙은 회색(4판의 노트북)
GLOW = mat('화면빛', '#9fa6b0', rough=0.4, emit=0.4, emit_color='#dfe5ee')
KEYS = mat('자판', '#2b2b2d', rough=0.6)


def add(obj, m=None, smooth=False):
    if m: obj.data.materials.append(m)
    if smooth:
        for p in obj.data.polygons: p.use_smooth = True
    return obj


def sphere(name, loc, r):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=r, location=loc)   # 꼭지 없는 메시(이방성 빛이 꼭지에서 꼬집히지 않게)
    o = bpy.context.active_object; o.name = name; return add(o, ORB, True)


def box(name, loc, size, m, bevel=0.0, seg=4, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot); o = bpy.context.active_object; o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2); bpy.ops.object.transform_apply(scale=True)
    if bevel:
        bv = o.modifiers.new('bevel', 'BEVEL'); bv.width = bevel; bv.segments = seg; bv.limit_method = 'NONE'
        o.modifiers.new('ws', 'WEIGHTED_NORMAL')
        add(o, m, True); return o
    return add(o, m)


def cyl(name, loc, r, depth, m, rot=(0, 0, 0), verts=96, bevel=0.0, seg=5, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if bevel:
        bv = o.modifiers.new('bevel', 'BEVEL'); bv.width = bevel; bv.segments = seg; bv.limit_method = 'ANGLE'
        o.modifiers.new('ws', 'WEIGHTED_NORMAL')
    return add(o, m, True)


def stool(name, x, y, seat_top, r=0.24, legs_m=None):
    """4판 결의 둥근 의자: 짙은 둥근 자리와 곧은 짧은 다리 넷(나무 결 · 벌린 다리 없음)."""
    parts = [cyl(name + '자리', (x, y, seat_top - 0.04), r, 0.08, SEAT, bevel=0.035, seg=6)]
    h = seat_top - 0.08
    for k in range(4):
        a = math.radians(45 + 90 * k); lx, ly = math.cos(a) * r * 0.62, math.sin(a) * r * 0.62
        parts.append(cyl(name + '다리%d' % k, (x + lx, y + ly, h / 2), 0.028, h, SEAT, verts=24, bevel=0.01, seg=3))
    return parts


# ── 바닥(막 없이 어둠으로 녹는다) ──
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 6, 0)); floor = add(bpy.context.active_object, FLOOR); floor.name = '바닥'

# ── 발표자 받침: 4판처럼 짙은 둥근 받침 하나(윗면 높이 0.5는 그대로) ──
PX, PY = -0.86, 3.05
PR = 0.42
plat = [cyl('받침', (PX, PY, 0.25), 1.02, 0.5, PLAT_SIDE, bevel=0.05, seg=8)]
presenter = sphere('발표자', (PX, PY, 0.5 + PR), PR)

# ── 이젤: 짙은 판 하나를 곧은 다리 둘이 받친다(종이 자리는 그대로) ──
EX, EY = 1.0, 3.2
easel = []
for i, dx in enumerate((-0.27, 0.27)):
    easel.append(box('이젤다리%d' % i, (EX + dx, EY + 0.02, 0.44), (0.06, 0.06, 0.88), BOARD, bevel=0.02, seg=4))
SROT = (math.radians(82), 0, 0)
nrm = Vector((0, -math.sin(SROT[0]), math.cos(SROT[0])))          # 종이 앞면 방향
sc = Vector((EX, EY - 0.08, 1.31))
easel.append(box('판', tuple(sc - nrm * 0.022), (0.76, 0.98, 0.035), BOARD, bevel=0.016, seg=4, rot=SROT))
bpy.ops.mesh.primitive_plane_add(size=1, location=tuple(sc), rotation=SROT)
sheet = bpy.context.active_object; sheet.name = '종이'; sheet.scale = (0.64, 0.86, 1); bpy.ops.object.transform_apply(scale=True); add(sheet, PAPER)

# ── 심사위원 탁자: 4판처럼 둥글고 두툼한 상판과 양 끝의 판 다리 둘 ──
TY = 1.15; TW, TD, TT = 4.7, 0.86, 0.08; TZ = 0.83          # TZ는 상판 윗면
table = [box('탁자', (0, TY, TZ - TT / 2), (TW, TD, TT), WOOD_X, bevel=0.035, seg=8)]
for i, sx in enumerate((-1, 1)):
    table.append(box('탁자다리%d' % i, (sx * (TW / 2 - 0.3), TY, (TZ - TT) / 2), (0.1, TD - 0.16, TZ - TT), WOOD_X, bevel=0.025, seg=5))

# ── 심사위원 셋과 의자 ──
JR = 0.4; JX = (-1.36, 0.0, 1.36); JY = -0.12; JZ = 0.6
judges = [sphere('심사위원%d' % i, (x, JY, JZ), JR) for i, x in enumerate(JX)]
stools = []
for i, x in enumerate(JX):
    stools += stool('의자%d' % i, x, JY, JZ - JR + 0.01)

# ── 심사위원마다 다른 탁자 위 소품 ──
props = []
# Opus(투자자의 눈): 덮은 수첩 하나와 종이 한 장
ox, oy = JX[0] + 0.05, TY - 0.12
props.append(box('수첩', (ox + 0.1, oy + 0.02, TZ + 0.014), (0.2, 0.27, 0.028), LEATHER, bevel=0.009, seg=4, rot=(0, 0, math.radians(-8))))
props.append(box('종이한장', (ox - 0.14, oy - 0.03, TZ + 0.002), (0.21, 0.28, 0.003), PAPER, rot=(0, 0, math.radians(5))))
# Sol(실행 심사위원의 눈): 화면이 심사위원 쪽을 보는 노트북
lx, ly = JX[1] + 0.5, TY - 0.06
props.append(box('노트북몸', (lx, ly, TZ + 0.008), (0.36, 0.25, 0.016), ALU, bevel=0.005))
props.append(box('자판', (lx, ly - 0.01, TZ + 0.0165), (0.3, 0.12, 0.002), KEYS))
LID = math.radians(-14)            # 세운 덮개가 뒤로 조금 눕는다
hinge = Vector((lx, ly + 0.125, TZ + 0.016))
up = Vector((0, math.sin(-LID), math.cos(LID)))
props.append(box('노트북덮개', tuple(hinge + up * 0.115 + Vector((0, 0.005, 0))), (0.36, 0.23, 0.01), ALU, bevel=0.004, rot=(math.radians(90) + LID, 0, 0)))
props.append(box('노트북화면', tuple(hinge + up * 0.117 + Vector((0, -0.0008, 0))), (0.32, 0.2, 0.002), GLOW, rot=(math.radians(90) + LID, 0, 0)))
# Sonnet(공공기관 심사위원의 눈): 가지런한 서류 묶음과 연필
dx_, dy_ = JX[2] - 0.04, TY - 0.1
for k in range(4):
    props.append(box('서류%d' % k, (dx_ + 0.004 * k, dy_ - 0.003 * k, TZ + 0.003 + 0.004 * k), (0.23, 0.31, 0.003), PAPER,
                     rot=(0, 0, math.radians(4 - 2.5 * k))))

# ── 점수판: 둥근 흰 판과 나무 손잡이. 심사위원 머리 위로 든다 ──
paddles = []
for i, x in enumerate(JX):
    face = cyl('점수판%d' % i, (x, JY + 0.15, JZ + JR + 0.5), 0.2, 0.025, CARD, rot=(math.radians(84), 0, 0), bevel=0.008)
    paddles.append((face,))

# ── 빛: 6판처럼 왼쪽 위에서 오는 따뜻한 주광, 단상 조명, 뒤 테두리 빛 ──
def light(name, kind, loc, power, size=1.0, color='#fff3e2', target=None, spot=None, shadow=True, glossy=True):
    ld = bpy.data.lights.new(name, kind); ld.energy = power; ld.color = lin(color)[:3]
    if kind == 'AREA': ld.size = size; ld.shape = 'DISK'
    if kind == 'SPOT': ld.spot_size = spot[0]; ld.spot_blend = spot[1]; ld.shadow_soft_size = size
    try: ld.use_shadow = shadow
    except Exception: pass
    o = bpy.data.objects.new(name, ld); o.location = loc; col.objects.link(o); o.visible_glossy = glossy
    if target is not None:
        d = Vector(target) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return o


light('조명', 'SPOT', (PX, PY - 0.05, 4.6), 620, size=1.2, target=(PX, PY, 0.2), spot=(math.radians(40), 0.9))   # 부드러운 빛 웅덩이
light('이젤빛', 'SPOT', (EX - 0.4, EY - 1.4, 3.2), 110, size=0.3, target=(EX, EY, 1.2), spot=(math.radians(26), 0.6))
light('주광', 'AREA', (-3.6, -1.2, 3.8), 75, size=3.2, color='#ffe2c2', target=(0, 1.2, 0.6))
light('뒷빛', 'AREA', (0.6, 4.6, 2.8), 45, size=4.0, color='#ffe2c2', target=(0, 0.4, 0.8), shadow=False)
light('앞보조', 'AREA', (-2.2, -2.6, 3.4), 18, size=5.0, color='#e9ecf3', target=(0, 2.5, 0.6), shadow=False, glossy=False)
light('탁자빛', 'AREA', (0, 2.4, 2.8), 14, size=3.0, target=(0, TY, 0.8), shadow=False, glossy=False)
# 구에는 구만 받는 빛을 준다(아래). 나머지 빛은 구를 뺀 물체만 밝힌다
lit_nc = bpy.data.collections.new('구뺀것')
for o in bpy.data.objects:
    if o.type == 'MESH': lit_nc.objects.link(o)
for o in bpy.data.objects:
    if o.type == 'LIGHT':
        try: o.light_linking.receiver_collection = lit_nc
        except Exception as e: print('빛 연결 실패', o.name, e)
orbs_c = bpy.data.collections.new('구들')
for o in [presenter] + judges:
    orbs_c.objects.link(o); lit_nc.objects.unlink(o)
# 정본 구는 빛줄기만 비친다: 물체는 반사에 나오지 않고 빛만 나온다(탁자 · 바닥이 비치면 크롬 공처럼 보인다)
for o in bpy.data.objects:
    if o.type == 'MESH': o.visible_glossy = False
light('구빛', 'AREA', (-2.6, -2.2, 3.6), 95, size=2.2, color='#fff3e6', target=(0, 0.8, 0.8))   # 넓은 빛: 새틴 구에 부드러운 빛 한 점
light('구테', 'AREA', (2.6, 4.2, 2.6), 30, size=1.2, color='#ffe2c2', target=(0, 0.8, 0.8), shadow=False)
light('구바탕', 'AREA', (0.2, -2.6, 4.2), 22, size=6.0, color='#f4efe8', target=(0, 1.0, 0.8), shadow=False)   # 넓고 약한 빛이 구의 윤곽을 옅게 드러낸다(정본의 옅은 결)
for n in ('구빛', '구테', '구바탕'):
    bpy.data.objects[n].light_linking.receiver_collection = orbs_c
scene.world = bpy.data.worlds.new('어둠'); scene.world.use_nodes = True
bg = scene.world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = lin('#090706'); bg.inputs['Strength'].default_value = 0.12

# ── 카메라: 심사위원 뒤 조금 위에서 무대를 본다 ──
cd = bpy.data.cameras.new('카메라'); cd.lens = 38; cd.sensor_width = 36
cam = bpy.data.objects.new('카메라', cd); col.objects.link(cam); scene.camera = cam
cam.location = (0.1, -3.7, 2.5)
aim = Vector((0.0, 2.6, 0.5)); cam.rotation_euler = (aim - cam.location).to_track_quat('-Z', 'Y').to_euler()

bpy.context.view_layer.update()
for o in [presenter] + judges: orient(o, cam)

# ── 굽기 설정 ──
r = scene.render; r.engine = 'CYCLES'; r.resolution_x = W; r.resolution_y = H; r.resolution_percentage = 100
r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'
scene.display_settings.display_device = 'sRGB'; scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'None'; scene.view_settings.exposure = 0.25
try:
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Base Contrast'; scene.view_settings.exposure = 0.5   # 4판처럼 부드러운 대비
except Exception as e: print('보기 변환', e)
c = scene.cycles; c.samples = SPP; c.use_adaptive_sampling = True; c.adaptive_threshold = 0.012; c.max_bounces = 6; c.use_denoising = True
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
STAGE = [o for o in bpy.data.objects if o.type == 'MESH' and o not in CHARS]


def render(name, show, transparent):
    for o in CHARS: o.hide_render = o not in show
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
    to_cam = (cam.location - ctr).normalized(); up_ = Vector((0, 0, 1))
    face = (to_cam + up_ * 0.18).normalized()          # 눈은 얼굴 가운데보다 조금 위
    return {'c': a, 'r': round(abs(b[0] - a[0]), 5), 'eye': scr(ctr + face * rad)}


spots = {'presenter': orb_spot(presenter, PR), 'judges': [orb_spot(j, JR) for j in judges],
         'sheet': [scr(sheet.matrix_world @ v.co) for v in sheet.data.vertices],
         'paddles': [{'c': scr(f.location), 'r': round(abs(scr(f.location + cam.matrix_world.to_3x3() @ Vector((0.2, 0, 0)))[0] - scr(f.location)[0]), 5)} for f, *_ in paddles],
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
    for i, pd in enumerate(paddles): render('paddle%d' % i, list(pd), True)
    # 안내용 구 하나: 앞에서 본 구, 바닥 그림자만
    for o in bpy.data.objects:
        if o.type == 'MESH': o.hide_render = True
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=0.5, location=(30, 0, 0.5)); g = add(bpy.context.active_object, ORB, True)
    bpy.ops.mesh.primitive_plane_add(size=6, location=(30, 0, 0)); gf = add(bpy.context.active_object, FLOOR); gf.is_shadow_catcher = True
    for o in [o for o in bpy.data.objects if o.type == 'LIGHT']: o.hide_render = True
    light('안내앞', 'AREA', (28.2, -1.6, 2.4), 60, size=0.3, color='#ffe8d0', target=(30, 0, 0.5))
    light('안내뒤', 'AREA', (31.0, 1.6, 1.2), 24, size=2.0, color='#ffe2c2', target=(30, 0, 0.5), shadow=False)
    light('안내바탕', 'AREA', (30.3, -2.4, 2.2), 14, size=5.0, color='#f4efe8', target=(30, 0, 0.5), shadow=False)
    light('안내위', 'AREA', (30, 0.4, 3.2), 8, size=3.0, target=(30, 0, 0), shadow=True)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.06
    cam.location = (30, -3.2, 0.5); cam.rotation_euler = (Vector((30, 0, 0.5)) - cam.location).to_track_quat('-Z', 'Y').to_euler(); cd.lens = 70
    bpy.context.view_layer.update(); orient(g, cam)
    r.resolution_x = 640; r.resolution_y = 640; r.film_transparent = True
    r.filepath = os.path.join(OUT, 'orb.png'); bpy.ops.render.render(write_still=True); print('구움 orb')
print('끝')

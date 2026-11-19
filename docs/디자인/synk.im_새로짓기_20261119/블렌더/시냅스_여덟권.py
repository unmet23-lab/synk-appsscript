# 교실 쪽 「교재 시냅스」 카드의 3D 그림: 표지가 아직 없는 가제본 여덟 권과 떠 있는 물음표.
# 문법 여섯 권은 서 있고(책등에 권 번호만 있다), 회화 두 권은 옆에 눕혀 쌓았다. 물음표는 눕힌 책 위에 떠서 까딱이다가 한 바퀴 돈다(3초, 처음과 끝이 이어진다).
# 배경은 투명하고 바닥에는 그림자만 남는다. 카드의 흰 면에 틀 없이 얹는다.
#
#   blender -b --factory-startup -P 시냅스_여덟권.py -- <나갈 폴더> <still|anim> <SUIT-ExtraBold.otf> [프레임 수=72] [가로=960] [샘플=128]   (세로는 가로의 452/780)
#   still: <나갈 폴더>/still.png 한 장 · anim: <나갈 폴더>/f_000.png … (ffmpeg로 움직이는 WebP를 만든다. README의 「블렌더」 참고)
import bpy, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0]; MODE = argv[1] if len(argv) > 1 else 'still'; FONT = argv[2] if len(argv) > 2 else ''
N = int(argv[3]) if len(argv) > 3 else 72; W = int(argv[4]) if len(argv) > 4 else 960; SPP = int(argv[5]) if len(argv) > 5 else 128
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection


def lin(hexs):
    h = hexs.lstrip('#'); v = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in v) + (1.0,)


def mat(name, color, rough=0.6, coat=0.0, sss=0.0, sheen=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    def put(key, val):
        if key in b.inputs: b.inputs[key].default_value = val
    put('Base Color', lin(color)); put('Roughness', rough); put('Coat Weight', coat); put('Coat Roughness', 0.12)
    put('Subsurface Weight', sss); put('Subsurface Radius', (0.02, 0.008, 0.005)); put('Sheen Weight', sheen)
    return m


def grain(m, kind='noise', scale=520.0, strength=0.12, axis='X'):
    """표면의 잔결. noise: 종이 표지의 올 · wave: 종이 묶음의 결(axis 방향으로 줄이 쌓인다)."""
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    co = nt.nodes.new('ShaderNodeTexCoord')
    if kind == 'wave':
        tex = nt.nodes.new('ShaderNodeTexWave'); tex.wave_type = 'BANDS'; tex.bands_direction = axis
        tex.inputs['Scale'].default_value = scale; tex.inputs['Distortion'].default_value = 0.5
    else:
        tex = nt.nodes.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value = scale; tex.inputs['Detail'].default_value = 4.0
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength; bp.inputs['Distance'].default_value = 0.0015
    nt.links.new(co.outputs['Object'], tex.inputs['Vector']); nt.links.new(tex.outputs[0], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m


def paper(name, light, line, period=0.0024):
    """종이 묶음: 책 두께 방향(x)으로 종이 낱장의 가는 줄이 쌓인다."""
    m = mat(name, light, rough=0.92); nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    co = nt.nodes.new('ShaderNodeTexCoord'); tex = nt.nodes.new('ShaderNodeTexWave'); tex.wave_type = 'BANDS'; tex.bands_direction = 'X'
    tex.inputs['Scale'].default_value = 2 * math.pi / (20 * period); tex.inputs['Distortion'].default_value = 0.35; tex.inputs['Detail'].default_value = 2.0
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position = 0.08; ramp.color_ramp.elements[0].color = lin(line)
    ramp.color_ramp.elements[1].position = 0.55; ramp.color_ramp.elements[1].color = lin(light)
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.35; bp.inputs['Distance'].default_value = 0.0012
    nt.links.new(co.outputs['Object'], tex.inputs['Vector']); nt.links.new(tex.outputs[0], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(tex.outputs[0], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m


def box(name, size, loc, m, bevel=0.0012, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL'); mod.width = bevel; mod.segments = 4; mod.limit_method = 'ANGLE'
    o.data.materials.append(m)
    if parent: o.parent = parent
    return o


FONTOBJ = None
if FONT and os.path.exists(FONT):
    try: FONTOBJ = bpy.data.fonts.load(FONT)
    except Exception as e: print('글꼴 못 읽음', e)

stage = bpy.data.objects.new('stage', None); col.objects.link(stage)   # 책과 물음표를 한꺼번에 돌리는 받침

# ── 바닥: 그림자만 받는다(배경은 투명) ──
bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
floor = bpy.context.active_object; floor.name = 'floor'; floor.data.materials.append(mat('floor', '#FFFFFF', rough=0.9))
floor.is_shadow_catcher = True

# ── 가제본: 얇은 종이 표지를 두른 책. 위와 옆으로 종이 묶음이 보인다 ──
PAGE = paper('page', '#FDFCF8', '#D9D3C6')
INK = mat('ink', '#26262A', rough=0.55)
D = 0.168


def proof(name, t, h, cover, numeral=None):
    """서 있는 책 한 권을 원점에 짓는다. x 두께 · y 깊이(책등이 -y) · z 높이. 받침 빈 물체를 돌려 눕힌다."""
    root = bpy.data.objects.new(name, None); col.objects.link(root); root.parent = stage
    sp, cv = 0.0034, 0.0012   # 책등 두께 · 표지 종이 두께
    box(name + '.spine', (t, sp, h), (0, -D / 2 + sp / 2, h / 2), cover, 0.0015, root)
    box(name + '.front', (cv, D - 0.0014, h), (-t / 2 + cv / 2, 0.0007, h / 2), cover, 0.0004, root)
    box(name + '.back', (cv, D - 0.0014, h), (t / 2 - cv / 2, 0.0007, h / 2), cover, 0.0004, root)
    box(name + '.pages', (t - 2 * cv, D - sp - 0.0008, h - 0.0012), (0, sp / 2 - 0.0004, h / 2), PAGE, 0.0004, root)
    if numeral:
        c = bpy.data.curves.new(name + '.n', 'FONT'); c.body = numeral; c.size = 0.0235; c.align_x = 'CENTER'; c.align_y = 'CENTER'; c.extrude = 0.00025
        if FONTOBJ: c.font = FONTOBJ
        o = bpy.data.objects.new(name + '.n', c); col.objects.link(o); o.location = (0, -D / 2 - 0.0003, h * 0.735); o.rotation_euler = (math.pi / 2, 0, 0)
        o.data.materials.append(INK); o.parent = root
        box(name + '.rule', (t * 0.46, 0.0005, 0.0016), (0, -D / 2 - 0.0002, h * 0.735 - 0.024), INK, 0, root)
    return root


# 문법 여섯 권: 나란히 서 있다. 깊이를 조금씩 달리해 사람 손으로 꽂은 줄처럼 보이게 한다.
GRAMMAR = ['#EFEADF', '#EBE5D9', '#F1ECE2', '#EAE4D8', '#EFEADF', '#ECE6DB']
THICK = [0.034, 0.030, 0.036, 0.031, 0.034, 0.030]
NUDGE = [0.000, 0.004, -0.002, 0.005, 0.001, 0.006]
H = 0.240
x = -0.262
for i, (color, t, dy) in enumerate(zip(GRAMMAR, THICK, NUDGE)):
    cover = grain(mat('cover%d' % i, color, rough=0.74, sheen=0.2), 'noise', 760.0, 0.07)
    b = proof('g%d' % (i + 1), t, H, cover, str(i + 1))
    b.location = (x + t / 2, dy, 0); x += t + 0.0012
row_end = x

# 회화 두 권: 옆에 눕혀 쌓았다. 종이 묶음 쪽이 앞을 본다. 표지 자리는 비어 있다.
TALK = ['#DDD7CB', '#E2DCD1']
HT, TT = 0.226, 0.028
cx = row_end + 0.022 + HT / 2
z = 0.0
for i, color in enumerate(TALK):
    cover = grain(mat('talk%d' % i, color, rough=0.74, sheen=0.2), 'noise', 760.0, 0.07)
    b = proof('t%d' % (i + 1), TT, HT, cover)
    turn = math.radians(0 if i == 0 else 6.5)
    b.rotation_euler = (0, math.pi / 2, math.pi + turn)
    b.location = (cx + HT / 2 + (0.004 if i else 0), 0.006 * i, z + TT / 2); z += TT + 0.0006
stack_top = z

# ── 물음표: 굵은 SUIT 글자를 두껍게 뽑아 모서리를 둥글린 코랄색 덩어리. 눕힌 책 위에 뜬다 ──
cu = bpy.data.curves.new('q', 'FONT'); cu.body = '?'
if FONTOBJ: cu.font = FONTOBJ
cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.size = 0.172
cu.extrude = 0.015; cu.bevel_depth = 0.0066; cu.bevel_resolution = 8; cu.resolution_u = 32
q = bpy.data.objects.new('q', cu); col.objects.link(q); q.parent = stage
q.data.materials.append(mat('coral', '#F2573F', rough=0.40, coat=0.22, sss=0.10))
Q0 = Vector((cx + 0.004, -0.004, stack_top + 0.094))


def pose(t):
    """t: 0~1. 앞 절반은 까딱이고, 뒤에 한 바퀴 돈다."""
    u = min(1.0, t / 0.5)
    sway = math.radians(18) * math.sin(2 * math.pi * u) * math.sin(math.pi * u)
    s = min(1.0, max(0.0, (t - 0.5) / 0.4)); spin = 2 * math.pi * (4 * s ** 3 if s < 0.5 else 1 - (-2 * s + 2) ** 3 / 2)
    roll = math.radians(6) * math.sin(4 * math.pi * t)
    q.rotation_euler = (math.pi / 2, roll, sway + spin + math.radians(-10))
    q.location = Q0 + Vector((0, 0, 0.009 * math.sin(2 * math.pi * t)))


stage.rotation_euler = (0, 0, math.radians(15))

# ── 빛: 왼쪽 위의 작은 주광(그림자가 또렷하다), 오른쪽의 약한 보조광, 뒤의 테두리 빛 ──
def area(name, loc, size, power, color=(1, 1, 1), shadow=True):
    d = bpy.data.lights.new(name, 'AREA'); d.shape = 'DISK'; d.size = size; d.energy = power; d.color = color
    if not shadow:
        try: d.use_shadow = False
        except Exception: pass
    o = bpy.data.objects.new(name, d); col.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, 0.12)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


area('key', (-1.05, -1.0, 1.65), 0.62, 30, (1.0, 0.975, 0.94))
area('fill', (1.3, -1.0, 0.5), 1.5, 3.6, (0.93, 0.96, 1.0), shadow=False)
area('rim', (0.55, 1.05, 1.0), 0.9, 12, shadow=False)
world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs['Color'].default_value = (1, 0.985, 0.96, 1); bg.inputs['Strength'].default_value = 0.24

# ── 카메라: 멀리서 긴 초점으로, 조금 내려다본다(눕힌 책의 윗면이 보인다) ──
AIM = Vector((0.0, 0.0, 0.100)); DIST = 1.56; ELEV = math.radians(13.5)
cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 85; cam_d.sensor_width = 36
cam = bpy.data.objects.new('cam', cam_d); col.objects.link(cam); scene.camera = cam
cam.location = AIM + Vector((0.0, -DIST * math.cos(ELEV), DIST * math.sin(ELEV)))
cam.rotation_euler = (AIM - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam_d.dof.use_dof = True; cam_d.dof.focus_distance = DIST - 0.06; cam_d.dof.aperture_fstop = 9.0

# ── 굽기 ──
r = scene.render; r.engine = 'CYCLES'
RES_Y = int(W * 452 / 780 / 2) * 2   # 카드의 그림 자리와 같은 화면비(780:452)
r.resolution_x = W; r.resolution_y = RES_Y; r.resolution_percentage = 100
r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'; r.film_transparent = True
r.use_persistent_data = True
scene.display_settings.display_device = 'sRGB'; scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'None'
c = scene.cycles; c.samples = SPP; c.use_adaptive_sampling = True; c.adaptive_threshold = 0.015
c.max_bounces = 6; c.use_denoising = True
dev = 'CPU'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for backend in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
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
print('장치', dev, '· 샘플', SPP, '·', W, 'x', RES_Y)

if MODE == 'still':
    pose(0.0); r.filepath = os.path.join(OUT, 'still.png'); bpy.ops.render.render(write_still=True)
else:
    for f in range(N):
        pose(f / N); scene.frame_set(f)
        r.filepath = os.path.join(OUT, 'f_%03d.png' % f); bpy.ops.render.render(write_still=True)
print('끝', MODE)

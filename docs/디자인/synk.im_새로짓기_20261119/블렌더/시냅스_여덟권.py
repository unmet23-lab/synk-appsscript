# 교실 쪽 「교재 시냅스」 카드의 3D 그림: 표지가 아직 없는 책 여덟 권(문법 여섯 · 회화 둘)과 떠 있는 물음표.
# 물음표는 까딱이다가 한 바퀴 돈다(3초, 처음과 끝이 이어진다). 책은 가만히 있다.
#
#   blender -b --factory-startup -P 시냅스_여덟권.py -- <나갈 폴더> <still|anim> <SUIT-ExtraBold.otf> [프레임 수=72] [가로=960] [샘플=96]
#   still: <나갈 폴더>/still.png 한 장 · anim: <나갈 폴더>/f_000.png … (ffmpeg로 움직이는 WebP를 만든다. README의 「블렌더」 참고)
import bpy, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0]; MODE = argv[1] if len(argv) > 1 else 'still'; FONT = argv[2] if len(argv) > 2 else ''
N = int(argv[3]) if len(argv) > 3 else 72; W = int(argv[4]) if len(argv) > 4 else 960; SPP = int(argv[5]) if len(argv) > 5 else 96
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
    put('Base Color', lin(color)); put('Roughness', rough); put('Coat Weight', coat); put('Coat Roughness', 0.08)
    put('Subsurface Weight', sss); put('Subsurface Radius', (0.02, 0.008, 0.005)); put('Sheen Weight', sheen)
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


# ── 바닥과 뒷벽이 둥글게 이어진 배경 ──
def backdrop(color):
    prof = [(-6.0, 0.0)]
    r, y0 = 0.9, 0.9
    for i in range(0, 25):
        a = math.pi / 2 * i / 24
        prof.append((y0 + r * math.sin(a), r - r * math.cos(a)))
    prof.append((y0 + r, 5.0))
    verts, faces = [], []
    for y, z in prof: verts += [(-7.0, y, z), (7.0, y, z)]
    for i in range(len(prof) - 1): faces.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
    me = bpy.data.meshes.new('cyc'); me.from_pydata(verts, [], faces); me.update()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new('cyc', me); col.objects.link(o); o.data.materials.append(mat('cyc', color, rough=0.9))
    return o


backdrop('#F6F2EC')

# ── 책 여덟 권: 문법 여섯(버터색) · 회화 둘(풀색). 책등의 흰 딱지는 비어 있다(제목 미정) ──
shelf = bpy.data.objects.new('shelf', None); col.objects.link(shelf)
PAGE = mat('page', '#FBF6EA', rough=0.85)
LABEL = mat('label', '#FFFDF7', rough=0.7)
BAND = mat('band', '#1D1D1F', rough=0.5)
GRAMMAR = ['#F7D36B', '#F5C445', '#F3BD38', '#F5C445', '#F8D877', '#F5C445']
TALK = ['#9ED17F', '#B4DB9A']
D, x = 0.168, 0.0
books = [(c, 0.240, t) for c, t in zip(GRAMMAR, [0.034, 0.030, 0.036, 0.031, 0.034, 0.030])] + [(c, 0.226, 0.027) for c in TALK]
for i, (color, h, t) in enumerate(books):
    if i == 6: x += 0.014
    cx = x + t / 2
    cover = mat('cover%d' % i, color, rough=0.62, sheen=0.25)
    b = 0.0035  # 표지 두께
    box('spine%d' % i, (t, b, h), (cx, -D / 2 + b / 2, h / 2), cover, 0.0014, shelf)
    box('front%d' % i, (b, D, h), (cx - t / 2 + b / 2, 0, h / 2), cover, 0.0014, shelf)
    box('back%d' % i, (b, D, h), (cx + t / 2 - b / 2, 0, h / 2), cover, 0.0014, shelf)
    box('pages%d' % i, (t - 2 * b, D - b - 0.006, h - 0.010), (cx, 0.001, h / 2), PAGE, 0.0006, shelf)
    box('label%d' % i, (t * 0.62, 0.0008, 0.050), (cx, -D / 2 - 0.0003, h * 0.70), LABEL, 0.0003, shelf)
    box('band%d' % i, (t, 0.0006, 0.006), (cx, -D / 2 - 0.0002, 0.030), BAND, 0, shelf)
    x += t + 0.0035
total = x
for o in shelf.children: o.location.x -= total / 2
shelf.location = (-0.150, 0.02, 0.0); shelf.rotation_euler = (0, 0, math.radians(21))

# ── 물음표: 굵은 SUIT 글자를 두껍게 뽑아 모서리를 둥글린 코랄색 덩어리 ──
cu = bpy.data.curves.new('q', 'FONT'); cu.body = '?'
if FONT and os.path.exists(FONT):
    try: cu.font = bpy.data.fonts.load(FONT)
    except Exception as e: print('글꼴 못 읽음', e)
cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.size = 0.33
cu.extrude = 0.026; cu.bevel_depth = 0.011; cu.bevel_resolution = 8; cu.resolution_u = 32
q = bpy.data.objects.new('q', cu); col.objects.link(q)
q.data.materials.append(mat('coral', '#F2573F', rough=0.16, coat=0.9, sss=0.12))
Q0 = Vector((0.205, -0.16, 0.172))


def pose(t):
    """t: 0~1. 앞 절반은 까딱이고, 뒤에 한 바퀴 돈다."""
    u = min(1.0, t / 0.5)
    sway = math.radians(20) * math.sin(2 * math.pi * u) * math.sin(math.pi * u)
    s = min(1.0, max(0.0, (t - 0.5) / 0.4)); spin = 2 * math.pi * (4 * s ** 3 if s < 0.5 else 1 - (-2 * s + 2) ** 3 / 2)
    roll = math.radians(7) * math.sin(4 * math.pi * t)
    q.rotation_euler = (math.pi / 2, roll, sway + spin + math.radians(-12))
    q.location = Q0 + Vector((0, 0, 0.011 * math.sin(2 * math.pi * t)))


# ── 빛: 왼쪽 위의 넓은 주광, 오른쪽의 약한 보조광, 뒤의 테두리 빛 ──
def area(name, loc, size, power, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, 'AREA'); d.shape = 'DISK'; d.size = size; d.energy = power; d.color = color
    o = bpy.data.objects.new(name, d); col.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, 0.14)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


area('key', (-0.95, -1.15, 1.55), 1.5, 30, (1.0, 0.97, 0.93))
area('fill', (1.25, -0.9, 0.55), 1.4, 7.5, (0.93, 0.96, 1.0))
area('rim', (0.5, 1.0, 1.05), 0.9, 16)
world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs['Color'].default_value = (1, 0.98, 0.95, 1); bg.inputs['Strength'].default_value = 0.28

# ── 카메라: 멀리서 긴 초점으로(제품 사진처럼) ──
cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 85; cam_d.sensor_width = 36
cam = bpy.data.objects.new('cam', cam_d); col.objects.link(cam); scene.camera = cam
cam.location = (0.03, -2.2, 0.50)
cam.rotation_euler = (Vector((0.03, 0, 0.142)) - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
cam_d.dof.use_dof = True; cam_d.dof.focus_distance = 2.12; cam_d.dof.aperture_fstop = 7.0

# ── 굽기 ──
r = scene.render; r.engine = 'CYCLES'; r.resolution_x = W; r.resolution_y = W // 2; r.resolution_percentage = 100
r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGB'; r.film_transparent = False
r.use_persistent_data = True
scene.display_settings.display_device = 'sRGB'; scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'None'
c = scene.cycles; c.samples = SPP; c.use_adaptive_sampling = True; c.adaptive_threshold = 0.02
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
print('장치', dev, '· 샘플', SPP, '·', W, 'x', W // 2)

if MODE == 'still':
    pose(0.0); r.filepath = os.path.join(OUT, 'still.png'); bpy.ops.render.render(write_still=True)
else:
    for f in range(N):
        pose(f / N); scene.frame_set(f)
        r.filepath = os.path.join(OUT, 'f_%03d.png' % f); bpy.ops.render.render(write_still=True)
print('끝', MODE)

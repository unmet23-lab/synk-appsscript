# 시즌 2 · 홀리데이 기프트 세트(가칭 유리결 · 서리꽃 에디션) — 블렌더 장면 2판 (2026-10-26, 크레딧 0)
# 제품 · 포장은 AI로 그리지 않고 블렌더로 짓는다. 포장 글자 · 무늬는 ../라벨/포장.py가 만든 우리 원고.
#   blender -b --python 선물상자.py -- --shot hero --u 0 --look B [--rise 0.6] [--res 960x540] [--samples 96] [--seq N] [--save]
#   → <밖>/렌더/<shot>_<look>_u<u>[_r<rise>][_세로].png   (<밖> = Documents/synk-vendor/pulse-season4-20261025/콘티/holiday-giftset)
#   --rise r(0~1): 원본 1위(Carolina Herrera)의 「병이 하나씩 날아오름」 — 단지가 먼저 7 cm, 앰플이 뒤따라 6 cm 떠오른다
#   --seq N이면 u 0 → 1을 N장으로 <밖>/움직임/<shot>_<look>/0000.png …
# 진행값 u(0~1) 하나로 리본이 풀린다(원본 샷표의 박자에 맞출 때는 u 곡선만 바꾼다):
#   0 묶인 리본 → 0~0.30 나비 고리 · 꼬리가 매듭으로 빨려 들어감 → 0.28~0.55 네 갈래가 휘어 말리며 일어섬
#   → 0.50~0.78 바깥으로 쓰러져 바닥에 누움 → 0.72~1 뚜껑 앞이 먼저 들리고 위로 · 속에서 금빛 김이 샘
# shot: hero(3/4 · 리본) · top(위에서) · open(열린 상자) · macro(나비 매듭 접사) · product(눈높이 제품 접사)
# look: A 첫눈 새벽 · B 금빛 밤(추천) · C 얼음 유리
# 2판(Fable 1차 반영): 18 × 18 × 10 cm 상자 · 뚜껑 1.5 mm 크게 · 판지 잔결 · 샴페인 벨벳 인서트(제품 홈 둘) · 핸드크림 뺌 ·
#   두꺼운 유리 크림 단지(벽 5 mm · 바닥 12 mm · 둥근 크림 · 금 목 고리) · 앰플 벽 3 mm · 바닥 8 mm · 액 70 % · 고무 스포이드 ·
#   리본 공단 재질 하나로 통일(반짝이 결 뺌) · 단면 살짝 볼록 · 갈래가 휘고 끝이 말리며 비틀림 · 긴 꼬리가 옆면으로 흘러내림 ·
#   나비 고리 도톰하게 · 이름은 뚜껑 앞 옆띠(금박 돋움) · 윗면은 서리꽃 엠보만 · 바닥 눈은 판 모양 결정(상자 둘레는 비움)
# 3판(Fable 2차 반영): 인서트를 올리고 홈을 얕게(단지 · 앰플 몸통의 60 %가 위로 — 유리 벽과 흰 크림이 보이게) ·
#   나비 고리는 낮고 넓게(가로 : 높이 ≥ 1.2) 고리 면을 뒤로 35° 눕히고 매듭 쪽을 비틀어 안에 공기 · 꼬리는 면에서 떨어져
#   반 바퀴 비틀리며 내려와 V 끝이 뚜껑 선 아래에 · 금빛 김은 넓은 컷(hero)에서만, 위로 갈수록 옅게 · 상자 속 결정 · 눈송이 뺌 ·
#   단지 금 뚜껑은 이름 음각 + 가는 테만 · 스포이드 작게 · 벨벳 한 단계 밝게 · 앞 옆띠 이름 15 % 크게 · 공단 직조 결 ·
#   제품 접사(product)는 상자 앞 바닥에 둔 단지 · 앰플을 눈높이에서, 차가운 보조광으로 금과 금을 가른다
# 4판(02_콘티 — 15초 · 6초 움직임): --film 15|6 --frames 90-120 이면 움직임표.py의 컷 · 카메라 · u 곡선대로 프레임마다 짓고 굽는다
#   → <밖>/움직임/<film>초_<세로|가로>/0090.png …(있는 프레임은 건너뜀). 제목(뚜껑 윗면 스침) · 금가루(뚜껑이 열릴 때 터짐 ·
#   상자 위를 낮게 지나감 · 제품 둘레에 뜸 · 닫힘에서 화면을 덮음) · 뚜껑 나감 · 닫힘(u를 거꾸로) · 내리는 눈 · 모션 블러
#   (카메라 · 제품 · 금가루만 앞뒤 프레임 열쇠 — 리본 · 뚜껑은 2프레임마다 한 자세라 번지지 않는다). --cam az,el,d,x,y,z,lens[,f]는
#   한 장 시험용 카메라
# 단위 m.
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


SHOT = arg("--shot", "hero")
U = float(arg("--u", "0"))
LOOK = arg("--look", "B")
RES = tuple(int(v) for v in arg("--res", "960x540").split("x"))
SAMPLES = int(arg("--samples", "96"))
SAVE = "--save" in argv
SEQ = int(arg("--seq", "0"))
RISE = float(arg("--rise", "0"))
FILM = arg("--film", "")
FRAMES = arg("--frames", "")
CAM = arg("--cam", "")
TITLE_RAKE = float(arg("--rake", "15"))   # 제목 스침빛 세기(W) — Fable 움직임 1차 P2-2로 10 → 15
TITLE_EXPO = float(arg("--expo", "-0.6"))  # 제목 노출(흰 판지가 날지 않게, 진주빛은 살게 −0.8 → −0.6)
# 움직임(--film)에서 프레임마다 바뀌는 값 — 한 장 굽기에서는 None이라 3.1판과 같다
PROD = None          # {"jar": ((x, y, 바닥 z), 돎 °, (기울기 x, y °)), "amp": …} — 움직임표 prod_of
HERO_X = None        # 카메라 2판: 제품이 바닥에 서는 자리(세계 x) — 그 둘레에 두 번째 빛 묶음 · 결정 비움
PRINT_X = None       # 카메라 2판: 바닥 서리꽃 무늬가 시작되는 x(열림 컷만)
RIM_FADE = None      # 카메라 2판: 상자용 역광을 끄는 때(열림 컷만, 움직임표 RIM_FADE)
FLOOR_LIGHT = float(arg("--floor-light", "10"))  # 바닥 무늬 빛 세기(W) — 시험 6 · 15 W 사이
LID_OUT = 0.0
T = None
CAMC = None          # 끝 보강: 지금 프레임 카메라 값(움직임표 cam) — 금박 빛을 카메라에 비치는 자리에 둘 때
SWEEP = None         # 끝 보강: (시작, 끝) 빛줄기가 한 번 지나가는 때(움직임표 SWEEP)
FOIL_SOFT = float(arg("--foil-soft", "3"))     # 금박이 금으로 읽히게 비추는 넓은 면광(W, 반사로만)
SWEEP_E = float(arg("--sweep", "6"))            # 지나가는 빛줄기(W, 반사로만) — 24부터 뚜껑 왼쪽 반이 하얗게 날았고 14도 0.13초 동안
                                                # 상자의 11 %가 255였다(Fable P2-3)
GLINT_E = float(arg("--glint", "22"))          # 6초 제품 뒤 세로 띠 빛(W, 반사로만) — 30은 단지 뚜껑이 4.27초에 하얗게 날았다
FLOOR_TOP = float(arg("--floor-top", "18"))     # 닫힘 바닥만 받는 남빛(W)
밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "holiday-giftset")
라벨 = os.path.join(밖, "라벨")
OUT = arg("--out", os.path.join(밖, "렌더", f"{SHOT}_{LOOK}_u{U:.2f}{f'_r{RISE:.2f}' if RISE > 0 else ''}"
                                       f"{'_세로' if RES[1] > RES[0] else ''}.png"))

# ── 치수 ────────────────────────────────────────────────────────────────────
B_HALF = 0.090      # 몸통 반폭(18 cm)
B_H = 0.100         # 몸통 높이
L_HALF = 0.0915     # 뚜껑 반폭(몸통보다 1.5 mm 크다 — 틈이 보이게)
L_H = 0.040         # 뚜껑 높이(옆띠)
WALL = 0.0025       # 판지 두께
TOP = B_H + 0.003   # 닫힌 뚜껑 윗면 높이
RIB_W = 0.036       # 리본 폭
RIB_T = 0.0005      # 리본 두께
OFF = 0.0009        # 리본이 면에서 뜨는 거리
INS_TOP = 0.048     # 인서트 윗면(3판: 올림 — 앞 벽 너머로 제품 몸통이 보이게)
JAR_Z = 0.0296      # 단지 홈 바닥(몸통 4.6 cm의 60 %가 인서트 위로)
AMP_Z = 0.0295      # 앰플 홈 바닥(몸통 4.2 cm의 56 %가 위로 — 스포이드 끝이 닫힌 뚜껑 안쪽 1.0 cm에 닿지 않게)
AMP_H = 0.042       # 앰플 몸통 높이

GOLD = (0.86, 0.66, 0.36)
CHAMPAGNE = (0.93, 0.80, 0.58)


def smooth(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def set_u(u):
    global U, K_SHRINK, K_PEEL, K_FALL, K_TILT, K_LID
    U = u
    K_SHRINK = smooth(0.0, 0.30, u)     # 나비 고리 · 꼬리가 빨려 들어감
    K_PEEL = smooth(0.28, 0.55, u)      # 네 갈래가 일어섬
    K_FALL = smooth(0.50, 0.78, u)      # 바깥으로 쓰러짐
    K_TILT = smooth(0.72, 0.84, u)      # 뚜껑 앞이 먼저 들림
    K_LID = smooth(0.78, 1.00, u)       # 뚜껑이 떠오름


set_u(U)


# ── 장면 · 렌더 ─────────────────────────────────────────────────────────────
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            ok = False
            for d in prefs.devices:
                d.use = d.type == kind
                ok = ok or d.use
            if ok:
                break
        except Exception:
            continue
    sc.cycles.device = "GPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPTIX"
    except Exception:
        pass
    sc.cycles.max_bounces = 16
    sc.cycles.transmission_bounces = 16
    sc.cycles.glossy_bounces = 8
    sc.cycles.transparent_max_bounces = 16
    sc.cycles.volume_bounces = 1
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 0.5
    sc.render.resolution_x, sc.render.resolution_y = RES
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.view_settings.view_transform = "AgX"
    for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
        try:
            sc.view_settings.look = look
            break
        except Exception:
            pass
    world = bpy.data.worlds.new("world")
    sc.world = world
    world.use_nodes = True
    return sc


def world_gradient(low, high, strength=1.0):
    w = bpy.context.scene.world
    nt = w.node_tree
    bg = nt.nodes.get("Background")
    co = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(co.outputs["Generated"], sep.inputs["Vector"])
    mp = nt.nodes.new("ShaderNodeMapRange")
    mp.inputs["From Min"].default_value = -0.4
    mp.inputs["From Max"].default_value = 0.9
    nt.links.new(sep.outputs["Z"], mp.inputs["Value"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*low, 1)
    ramp.color_ramp.elements[1].color = (*high, 1)
    nt.links.new(mp.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength


def camera(loc, target, lens=85.0, fstop=None, focus=None):
    cd = bpy.data.cameras.new("cam")
    cd.lens = lens
    cd.sensor_fit = "VERTICAL" if RES[1] > RES[0] else "HORIZONTAL"
    cd.sensor_width = 36.0
    cd.sensor_height = 36.0 if RES[1] > RES[0] else 24.0
    cd.clip_start = 0.005
    cd.clip_end = 60
    cam = bpy.data.objects.new("cam", cd)
    bpy.context.collection.objects.link(cam)
    cam.location = Vector(loc)
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = focus if focus else d.length
    bpy.context.scene.camera = cam
    return cam


def area_light(name, loc, target, energy, size, rgb=(1, 1, 1), size_y=None, spread=180):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.color = rgb
    if size_y:
        ld.shape = "RECTANGLE"
        ld.size = size
        ld.size_y = size_y
    else:
        ld.shape = "DISK"
        ld.size = size
    ld.spread = math.radians(spread)
    ob = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(ob)
    ob.location = Vector(loc)
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob


def point_light(name, loc, energy, rgb, radius=0.01):
    ld = bpy.data.lights.new(name, "POINT")
    ld.energy = energy
    ld.color = rgb
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(ob)
    ob.location = Vector(loc)
    return ob


# ── 재질 ────────────────────────────────────────────────────────────────────
def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt.nodes, nt.links, out


def setin(node, name, value):
    if name in node.inputs:
        node.inputs[name].default_value = value


def principled(nodes, **kw):
    b = nodes.new("ShaderNodeBsdfPrincipled")
    names = {
        "base": "Base Color", "metal": "Metallic", "rough": "Roughness", "ior": "IOR", "trans": "Transmission Weight",
        "coat": "Coat Weight", "coat_rough": "Coat Roughness", "aniso": "Anisotropic", "sheen": "Sheen Weight",
        "sheen_tint": "Sheen Tint", "sheen_rough": "Sheen Roughness", "sss": "Subsurface Weight",
        "sss_r": "Subsurface Radius", "emit": "Emission Color", "emit_s": "Emission Strength",
        "film": "Thin Film Thickness", "film_ior": "Thin Film IOR",
    }
    for k, v in kw.items():
        n = names[k]
        if k in ("base", "emit", "sheen_tint") and len(v) == 3:
            v = (*v, 1)
        setin(b, n, v)
    return b


def shadow_pass(n, l, shader_out, tint=(1, 1, 1)):
    """굴절 물체가 그림자를 까맣게 드리우지 않게: 그림자 광선에는 투명(1번 캔 장면과 같은 처리)."""
    lp = n.new("ShaderNodeLightPath")
    tr = n.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = (*tint, 1)
    mix = n.new("ShaderNodeMixShader")
    l.new(lp.outputs["Is Shadow Ray"], mix.inputs["Fac"])
    l.new(shader_out, mix.inputs[1])
    l.new(tr.outputs[0], mix.inputs[2])
    return mix


def img(name, colorspace="Non-Color"):
    im = bpy.data.images.load(os.path.join(라벨, name), check_existing=True)
    im.colorspace_settings.name = colorspace
    return im


def math_node(n, l, op, a, b=None, clamp=False):
    x = n.new("ShaderNodeMath")
    x.operation = op
    x.use_clamp = clamp
    if isinstance(a, (int, float)):
        x.inputs[0].default_value = a
    else:
        l.new(a, x.inputs[0])
    if b is not None:
        if isinstance(b, (int, float)):
            x.inputs[1].default_value = b
        else:
            l.new(b, x.inputs[1])
    return x.outputs[0]


def planar_tex(n, l, image, half, axis="Z", z0=0.0, h=1.0):
    """물체 좌표를 0~1로 펴서 그림을 붙인다. axis Z = 윗면(x, y), Y = 앞면(x, z)."""
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Object"], sep.inputs["Vector"])
    comb = n.new("ShaderNodeCombineXYZ")
    if axis == "Z":
        l.new(math_node(n, l, "MULTIPLY_ADD", sep.outputs["X"], 1 / (2 * half)) if False else _ma(n, l, sep.outputs["X"], 1 / (2 * half), 0.5), comb.inputs["X"])
        l.new(_ma(n, l, sep.outputs["Y"], 1 / (2 * half), 0.5), comb.inputs["Y"])
    else:
        l.new(_ma(n, l, sep.outputs["X"], 1 / (2 * half), 0.5), comb.inputs["X"])
        l.new(_ma(n, l, sep.outputs["Z"], 1 / h, -z0 / h), comb.inputs["Y"])
    t = n.new("ShaderNodeTexImage")
    t.image = image
    t.extension = "CLIP"
    l.new(comb.outputs[0], t.inputs["Vector"])
    return t


def _ma(n, l, src, scale, add):
    m = n.new("ShaderNodeMath")
    m.operation = "MULTIPLY_ADD"
    l.new(src, m.inputs[0])
    m.inputs[1].default_value = scale
    m.inputs[2].default_value = add
    return m.outputs[0]


def normal_mask(n, l, axis, sign=1, lo=0.7):
    """물체 좌표계 법선이 그 축을 보는 면만 1."""
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Normal"], sep.inputs["Vector"])
    return math_node(n, l, "GREATER_THAN", math_node(n, l, "MULTIPLY", sep.outputs[axis], sign), lo)


def paper_grain(n, l, strength=0.06):
    """판지 잔결(미세 범프) — 칼같은 CG 면이 아니게."""
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 900.0
    nz.inputs["Detail"].default_value = 8.0
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = 0.0002
    l.new(nz.outputs["Fac"], bump.inputs["Height"])
    return bump


def mat_box(name, lid=True):
    """진주빛 흰 판지 — 뚜껑 윗면은 금박 서리꽃 + 이름, 앞 옆띠에 금박 이름(금박은 0.1 mm 돋움).
    끝 보강(10-28 유호님 「뚜껑까지 바꿔」): 3.1판 윗면은 흰 엠보만이라 끝 그림 거리에서 무늬도 이름도 안 보여, 원본 1위와 달리
    끝 그림이 영상에서 가장 밋밋한 판이었다 — 윗면을 ../라벨/포장.py lid_top_foil(뚜껑윗면_금박.png)로."""
    m, n, l, out = new_mat(name)
    paper = principled(n, base=(0.90, 0.902, 0.92), rough=0.52, sheen=0.3, sheen_tint=(0.95, 0.95, 1.0),
                       coat=0.06, coat_rough=0.3, film=120.0, film_ior=1.4)
    # 3판: 짙은 금 — 흰 판지 위에서 글자가 서고 역광에서 번쩍. 끝 보강: 거칠기 0.24 → 0.16(지나가는 빛줄기가 금박에 또렷이 흐르게)
    # 흰 판지 위에서 짙은 금으로 서게 — 끝 보강 2(Fable P2-2): 닫힘에서 (0.60, 0.37, 0.09)는 서리꽃 S 0.12 · 이름 S 0.25로
    # 베이지였다. 닫힘만 더 짙게(매듭 접사 · 열림은 그대로 — Fable이 그 자리 금박은 알맞다고 봤고 다시 굽지 않는다)
    foil = principled(n, base=(0.50, 0.29, 0.05) if SHOT == "top" else (0.60, 0.37, 0.09), metal=1.0, rough=0.16)
    mix = n.new("ShaderNodeMixShader")
    l.new(paper.outputs[0], mix.inputs[1])
    l.new(foil.outputs[0], mix.inputs[2])
    grain = paper_grain(n, l)
    if lid:
        top = normal_mask(n, l, "Z", 1)
        front = normal_mask(n, l, "Y", -1)
        top_t = planar_tex(n, l, img("뚜껑윗면_금박.png"), L_HALF, "Z")
        name_t = planar_tex(n, l, img("뚜껑앞_금박.png"), L_HALF, "Y", z0=TOP - L_H, h=L_H)
        foil_fac = math_node(n, l, "ADD", math_node(n, l, "MULTIPLY", top, top_t.outputs["Color"]),
                             math_node(n, l, "MULTIPLY", front, name_t.outputs["Color"]), clamp=True)
        l.new(foil_fac, mix.inputs["Fac"])
        height = math_node(n, l, "MULTIPLY", foil_fac, 0.5)
        bump = n.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 1.0   # 4판: 0.7 — 멈춘 끝 그림 · 제목에서 서리꽃이 평평했다(Fable 움직임 1차 P2-2 · 3)
        bump.inputs["Distance"].default_value = 0.0002
        l.new(height, bump.inputs["Height"])
        l.new(grain.outputs["Normal"], bump.inputs["Normal"])
        for b in (paper, foil):
            l.new(bump.outputs["Normal"], b.inputs["Normal"])
    else:
        mix.inputs["Fac"].default_value = 0.0
        l.new(grain.outputs["Normal"], paper.inputs["Normal"])
    l.new(mix.outputs[0], out.inputs["Surface"])
    return m


def mat_foil_inside():
    m, n, l, out = new_mat("foil_inside")
    b = principled(n, base=CHAMPAGNE, metal=1.0, rough=0.24)
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 260.0
    nz.inputs["Detail"].default_value = 6.0
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.22
    bump.inputs["Distance"].default_value = 0.0002
    l.new(nz.outputs["Fac"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def mat_velvet():
    """샴페인 벨벳 인서트 — 결 반사(sheen)가 밝게. 3판: 짙은 갈색 금이 골판지 플로킹처럼 무거워 한 단계 밝은 샴페인으로."""
    m, n, l, out = new_mat("velvet")
    b = principled(n, base=(0.42, 0.31, 0.19), rough=0.85, sheen=0.75, sheen_rough=0.30, sheen_tint=(1.0, 0.88, 0.70))
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 1400.0
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    bump.inputs["Distance"].default_value = 0.0002
    l.new(nz.outputs["Fac"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def mat_satin():
    """샴페인 금 공단 리본 하나로 통일(1판 top_B 결) — 길이 방향 이방성 + 결 반사, 반짝이 결은 뺐다.
    3판(Fable 2차 P3-4): 접사에서 가죽 · 두꺼운 종이로 보여 거칠기를 낮추고, 길이 방향 실결(폭을 따라 촘촘한 물결)을 노멀로.
    3.1판(Fable 3차 P2-1): 한 리본이 라메 · 거울 공단 · 무광 베이지 셋으로 보였다 — 금속에 가까운 반사(0.85)가 둘레를
    면마다 다르게 비추고, 잔결 노이즈가 스침각에서 알갱이로 깨졌다. 천 공단으로: 금속 0.2 · 결 반사 크게 · 실결은 물결만 반 세기."""
    m, n, l, out = new_mat("satin")
    # 끝 보강(10-28): 끝 그림에서 옅은 크림색으로 흰 상자에 묻혀 한 단계 짙은 금으로(바탕 · 결 반사 색 · 결 반사 세기)
    b = principled(n, base=(0.64, 0.40, 0.12), metal=0.3, rough=0.24, aniso=0.85, sheen=0.5, sheen_rough=0.35,
                   sheen_tint=(1.0, 0.76, 0.42))
    tg = n.new("ShaderNodeTangent")
    tg.direction_type = "UV_MAP"
    tg.uv_map = "UVMap"
    if "Tangent" in b.inputs:
        l.new(tg.outputs["Tangent"], b.inputs["Tangent"])
    uv = n.new("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(uv.outputs["UV"], sep.inputs["Vector"])
    threads = math_node(n, l, "SINE", math_node(n, l, "MULTIPLY", sep.outputs["Y"], 2 * math.pi * 240))  # 폭 3.6 cm에 실 240줄
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.025
    bump.inputs["Distance"].default_value = 0.00004
    l.new(threads, bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def mat_glass(name="glass", rough=0.0, tint=(1, 1, 1)):
    m, n, l, out = new_mat(name)
    b = principled(n, base=tint, rough=rough, ior=1.5, trans=1.0)
    l.new(shadow_pass(n, l, b.outputs[0], tint=(0.92, 0.94, 0.96)).outputs[0], out.inputs["Surface"])
    return m


def mat_serum():
    m, n, l, out = new_mat("serum")
    b = principled(n, base=(1.0, 0.93, 0.78), rough=0.0, ior=1.38, trans=1.0)
    vol = n.new("ShaderNodeVolumeAbsorption")
    vol.inputs["Color"].default_value = (1.0, 0.78, 0.42, 1)
    vol.inputs["Density"].default_value = 14.0
    l.new(shadow_pass(n, l, b.outputs[0], tint=(1.0, 0.9, 0.7)).outputs[0], out.inputs["Surface"])
    l.new(vol.outputs[0], out.inputs["Volume"])
    return m


def mat_print(name, mask_img, ink=(0.97, 0.97, 0.97), half=0.02, axis="Y", z0=0.0, h=0.05):
    """유리 위 흰 잉크 인쇄: 마스크 자리만 잉크, 나머지는 유리."""
    m, n, l, out = new_mat(name)
    base = principled(n, base=(1, 1, 1), rough=0.0, ior=1.5, trans=1.0)
    base_out = shadow_pass(n, l, base.outputs[0], tint=(0.92, 0.94, 0.96)).outputs[0]
    inkb = principled(n, base=ink, rough=0.35)
    t = planar_tex(n, l, img(mask_img), half, axis, z0=z0, h=h)
    mix = n.new("ShaderNodeMixShader")
    l.new(t.outputs["Color"], mix.inputs["Fac"])
    l.new(base_out, mix.inputs[1])
    l.new(inkb.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs["Surface"])
    return m


def mat_simple(name, **kw):
    m, n, l, out = new_mat(name)
    b = principled(n, **kw)
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def mat_snow(base=(0.95, 0.96, 0.99)):
    """눈 결정: 흰 산란 + 날카로운 반사."""
    return mat_simple("snow", base=base, rough=0.18, sss=0.5, sss_r=(0.01, 0.012, 0.015), coat=0.4, coat_rough=0.05)


def mat_emit(name, rgb, strength):
    m, n, l, out = new_mat(name)
    e = n.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*rgb, 1)
    e.inputs["Strength"].default_value = strength
    l.new(e.outputs[0], out.inputs["Surface"])
    return m


def mat_glow_volume(density):
    """뚜껑이 들릴 때 상자 속에서 피어오르는 금빛 김(빛을 받는 부피). 3판(Fable 2차 P3-5): 찜기처럼 솟지 않게 아래가 짙고
    위로 갈수록 옅어져, 테두리 위로는 얇게만 흘러넘친다."""
    m, n, l, out = new_mat("glow_volume")
    v = n.new("ShaderNodeVolumePrincipled")
    v.inputs["Color"].default_value = (1.0, 0.85, 0.6, 1)
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Generated"], sep.inputs["Vector"])
    fade = math_node(n, l, "POWER", math_node(n, l, "SUBTRACT", 1.0, sep.outputs["Z"], clamp=True), 2.2)
    l.new(math_node(n, l, "MULTIPLY", fade, density), v.inputs["Density"])
    l.new(v.outputs[0], out.inputs["Volume"])
    return m


# ── 도형 ────────────────────────────────────────────────────────────────────
def link(ob):
    bpy.context.collection.objects.link(ob)
    return ob


def open_box(name, half, h, z0, mat, open_side="top", bevel=0.0007):
    """한쪽이 열린 판지 상자(두께 WALL). open_side top = 몸통, bottom = 뚜껑."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 2 * half
        v.co.y *= 2 * half
        v.co.z = z0 + (v.co.z + 0.5) * h
    want_z = z0 + h if open_side == "top" else z0
    for f in list(bm.faces):
        c = f.calc_center_median()
        if abs(f.normal.z) > 0.9 and abs(c.z - want_z) < 1e-6:
            bm.faces.remove(f)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new(name, me))
    so = ob.modifiers.new("두께", "SOLIDIFY")
    so.thickness = WALL
    so.offset = -1.0
    bv = ob.modifiers.new("모서리", "BEVEL")
    bv.width = bevel
    bv.segments = 3
    bv.harden_normals = True
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    return ob


def ribbon_mesh(name, pts, wdirs, width, mat, thick=RIB_T, vcut=(False, False), cup=0.00025, twist=None):
    """점 줄(pts)을 따라 폭 방향(wdirs)으로 납작한 띠를 쓴다. 단면 가운데를 cup만큼 볼록하게(공단 리본은 살짝 둥글다).
    twist: 점마다 폭 방향을 길이 축으로 돌릴 각(라디안) 목록. UV: u = 길이, v = 폭."""
    n = len(pts)
    L = [0.0]
    for i in range(1, n):
        L.append(L[-1] + (pts[i] - pts[i - 1]).length)
    total = max(L[-1], 1e-6)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    rows = []
    for i in range(n):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)])
        t = t.normalized() if t.length > 1e-9 else Vector((1, 0, 0))
        w = wdirs[i] - t * wdirs[i].dot(t)
        w = w.normalized() if w.length > 1e-9 else t.orthogonal().normalized()
        if twist:
            w = (Matrix.Rotation(twist[i], 3, t) @ w).normalized()
        nn = t.cross(w).normalized()
        hw = width / 2
        cut = 0.0
        if (i == 0 and vcut[0]) or (i == n - 1 and vcut[1]):
            cut = width * 0.45 * (1 if i == n - 1 else -1)
        row = []
        for sw in (-1, 0, 1):
            for st in (-1, 1):
                p = pts[i] + w * (sw * hw) + nn * (st * thick / 2 + (cup if sw == 0 else 0.0))
                if sw == 0 and cut:
                    p = p - t * cut
                row.append(bm.verts.new(p))
        rows.append(row)
    bm.verts.ensure_lookup_table()

    def face(a, b, c, d, uvs):
        try:
            f = bm.faces.new((a, b, c, d))
        except ValueError:
            return
        for loop, uv in zip(f.loops, uvs):
            loop[uvl].uv = uv

    for i in range(n - 1):
        A, B = rows[i], rows[i + 1]
        u0, u1 = L[i] / total, L[i + 1] / total
        face(A[1], A[3], B[3], B[1], [(u0, 0), (u0, 0.5), (u1, 0.5), (u1, 0)])
        face(A[3], A[5], B[5], B[3], [(u0, 0.5), (u0, 1), (u1, 1), (u1, 0.5)])
        face(A[2], A[0], B[0], B[2], [(u0, 0.5), (u0, 0), (u1, 0), (u1, 0.5)])
        face(A[4], A[2], B[2], B[4], [(u0, 1), (u0, 0.5), (u1, 0.5), (u1, 1)])
        face(A[0], A[1], B[1], B[0], [(u0, 0), (u0, 0), (u1, 0), (u1, 0)])
        face(A[5], A[4], B[4], B[5], [(u0, 1), (u0, 1), (u1, 1), (u1, 1)])
    for R in (rows[0], rows[-1]):
        try:
            bm.faces.new((R[0], R[2], R[4], R[5], R[3], R[1]))
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    # 넓은 면과 얇은 옆면이 꼭짓점을 같이 써서 음영이 둥글게 말린다 — 60° 넘는 모서리를 갈라 각지게(현장노트 블렌더_3D)
    bmesh.ops.split_edges(bm, edges=[e for e in bm.edges if e.calc_face_angle(0) > math.radians(60)])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = link(bpy.data.objects.new(name, me))
    me.materials.append(mat)
    return ob


# ── 리본: 네 갈래 · 나비 매듭 · 긴 꼬리 ───────────────────────────────────────
def arm_points(direction):
    """한 갈래(바닥 → 옆면 → 위 모서리 → 가운데)를 2D(바깥 x, 높이 z)로 짓는다. 2판: 경첩 두 개의 곧은 판이 아니라
    뿌리 각 + 끝 처짐 + 끝 말림으로 휘는 곡선을 따라 쌓고(어느 프레임에도 곧은 판이 없게), 쓰러질 때는 끝으로 갈수록
    조금 더 돌아 채찍처럼 눕는다. 바닥에 누우면 물결 · 끝이 살짝 말려 든다."""
    a = L_HALF + OFF
    H = TOP + OFF
    peel = K_PEEL
    ph1 = math.radians(90) * peel
    ns, nt = 24, 40
    # 옆도막(바닥 → 위 모서리): 세로
    P = [(a, H * k / ns) for k in range(ns + 1)]
    # 윗도막: 모서리 T에서 안쪽으로, 각 α(s) = 뿌리 각 + 끝 처짐 + 끝 말림을 이어 붙인다
    x, z = a, H
    step = a / nt
    if FILM == "6" and tuple(direction) == (1, 0):
        # 카메라 2판 6초: 쓰러진 +x 갈래 끝(상자에서 0.29 m)이 제품 컷 가로 화면 왼쪽 끝에 1.8초 걸려 떨어진 종이 조각으로
        # 읽혔다(Fable 3차 P2-3). 6초는 매듭(u 0.30)에서 열림(u 0.78)으로 컷이 넘어가 갈래가 서고 쓰러지는 때가 안 보이니,
        # 쓰러진 뒤에만 윗도막을 0.15배로 — 끝이 0.21 m(가로 화면 왼끝은 2.95초 0.24 m)
        step *= 1 - 0.85 * K_FALL
    lift = math.sin(math.pi * min(1.0, peel * 1.15))  # 일어서는 동안 휨이 크다가 다 서면 줄어든다
    # 4판(Fable 움직임 1차 P2-5): 다 선 순간(u 0.40~0.60) 휨이 0이 되어 곧은 종이 탭으로 보였다 — 다 서도 휨 · 비틀림이
    # 남게 바닥값을 두고, 그 구간만 끝 처짐 · 말림 · 비틀림을 1.5배(뿌리 각은 그대로)
    stand = smooth(0.6, 1.0, peel) * (1 - K_FALL)
    flex = 1.0 + 0.5 * smooth(0.36, 0.44, U) * (1 - smooth(0.58, 0.66, U))
    lift = max(lift, 0.45 * stand)
    for k in range(1, nt + 1):
        s = k / nt
        alpha = (ph1 - math.radians(38) * lift * s * s * flex
                 - math.radians(55) * peel * max(0.0, s - 0.72) / 0.28 * (1 - K_FALL * 0.6) * flex)
        x += -math.cos(alpha) * step
        z += math.sin(alpha) * step
        P.append((x, max(z, H * (1 - peel) + 0.0)))
    # 쓰러짐: 바닥 모서리 B(a, 0)를 축으로 바깥(시계)으로 — 끝으로 갈수록 조금 더(채찍)
    ph2 = math.radians(90) * K_FALL
    Ltot = len(P) - 1
    out = []
    for i, (x, z) in enumerate(P):
        whip = 1.0 + 0.18 * math.sin(math.pi * K_FALL) * (i / Ltot)
        ang = -ph2 * min(whip, 1.0 / max(K_FALL, 1e-3)) if K_FALL > 0 else 0.0
        c, sn = math.cos(ang), math.sin(ang)
        rx, rz = x - a, z
        x2 = a + rx * c - rz * sn
        z2 = rx * sn + rz * c
        if K_FALL > 0:
            d = max(0.0, x2 - a)
            wav = 0.0022 * K_FALL * (1 + math.sin(d * 48.0)) * smooth(0.0, 0.04, d)
            tip = 0.010 * K_FALL * smooth(0.82, 1.0, i / Ltot)  # 끝이 살짝 말려 든다
            z2 = max(z2, 0.0) + wav + tip + OFF * K_FALL
        out.append((x2, z2))
    dx, dy = direction
    pts = [Vector((dx * x, dy * x, z)) for x, z in out]
    w = Vector((-dy, dx, 0.0))
    tw_amp = math.radians(14) * max(math.sin(math.pi * peel), 0.6 * stand) * flex
    tw = [tw_amp * (i / Ltot) * (1 if dx + dy > 0 else -1) for i in range(len(pts))]
    return pts, [w] * len(pts), tw


def tail_points(d, length_frac):
    """긴 꼬리: 매듭에서 뚜껑 위를 따라 모서리까지 → 둥글게 넘어 → 3판: 면에 붙지 않고 떨어져(최대 1.1 cm) 반 바퀴 가까이
    비틀리며 내려와 V 끝이 뚜껑 선(6.3 cm) 아래 3.4 cm에서 보인다(앞면의 세로 띠가 둘로 읽히던 것 — Fable 2차 P2-2).
    length_frac만큼만(빨려 들어감). 돌려주는 것: 점 · 폭 방향 · 비틀림 각."""
    d = Vector((d[0], d[1], 0)).normalized()
    side_w = Vector((-d.y, d.x, 0.0))
    pts = []
    # 윗면: 가운데 → 모서리(이 방향으로 뚜껑 가장자리에 닿는 거리)
    reach = min(L_HALF / max(abs(d.x), 1e-6), L_HALF / max(abs(d.y), 1e-6))
    top_z = TOP + OFF * 2 + RIB_T
    for k in range(0, 31):
        f = k / 30
        r = reach * f
        wob = 0.004 * math.sin(f * 5.0)
        pts.append(Vector((d.x * r, d.y * r, top_z + 0.010 * (1 - f) ** 2.2)) + side_w * wob)
    # 모서리를 넘는 호(반지름 5 mm)
    edge = pts[-1].copy()
    rad = 0.005
    for k in range(1, 9):
        th = math.radians(90) * k / 8
        pts.append(edge + d * (rad * math.sin(th)) + Vector((0, 0, -rad * (1 - math.cos(th)))))
    n_top = len(pts)
    # 면에서 떨어져 흔들리며 내려온다
    start = pts[-1].copy()
    drop = start.z - 0.034
    n_drop = 36
    for k in range(1, n_drop + 1):
        f = k / n_drop
        away = 0.0015 + 0.0095 * smooth(0.0, 0.45, f) * (1 - 0.25 * smooth(0.6, 1.0, f))
        sway = 0.005 * math.sin(f * 3.2)
        pts.append(start + d * away + side_w * sway + Vector((0, 0, -drop * f)))
    tws = [0.0] * n_top + [math.radians(160) * smooth(0.05, 0.95, k / n_drop) for k in range(1, n_drop + 1)]
    # 빨려 들어감: 앞(매듭 쪽)부터 length_frac만큼만 남긴다
    keep = max(2, int(len(pts) * length_frac))
    return pts[:keep], [side_w] * keep, tws[:keep]


def bow(mat, center):
    """나비 매듭: 매듭 띠 + 고리 둘 + 긴 꼬리 둘. K_SHRINK에 따라 매듭 쪽으로 빨려 들어간다.
    3판(Fable 2차 P2-2): 2판 고리가 좁고 높게 서서 가방 손잡이 · 토끼 귀로 읽혔다 — 고리를 낮고 넓게(가로 7.2 cm : 높이 약 4 cm),
    긴 축은 18°만 들고 고리 면을 뒤로 35° 눕혀 앞에서 고리 안(공기)이 보이게, 아래 가닥은 뚜껑에 얹히고, 매듭 쪽 두 끝을
    서로 반대로 28° 비틀어 모인 주름을 만든다."""
    s = 1.0 - K_SHRINK
    if s < 0.02:
        return
    knot_r = 0.0115 * (0.35 + 0.65 * s)
    kp, kw = [], []
    for k in range(41):
        t = 2 * math.pi * k / 40
        kp.append(center + Vector((knot_r * 1.25 * math.cos(t), 0, knot_r * math.sin(t) + knot_r * 0.6)))
        kw.append(Vector((0, 1, 0)))
    ribbon_mesh("매듭", kp, kw, RIB_W * 0.62, mat)
    up = Vector((0, 0, 1))
    floor_z = TOP + OFF + RIB_T * 3  # 아래 가닥이 뚜껑에 얹히는 높이
    elev, lean = math.radians(18), math.radians(35)
    for side in (1, -1):
        Ls, Hs = 0.064 * s, 0.028 * s    # 끝 보강(10-28): 7.2 → 6.4 cm — 고리가 뚜껑 폭을 거의 다 덮어 무늬 · 이름 자리를 먹었다
        e1 = Matrix.Rotation(math.radians(-8 * side), 3, "Z") @ Vector((side, 0, 0))  # 고리 끝이 살짝 뒤로
        el = (e1 * math.cos(elev) + up * math.sin(elev)).normalized()
        eo0 = (-e1 * math.sin(elev) + up * math.cos(elev)).normalized()
        b = el.cross(eo0)
        if b.y < 0:
            b = -b
        eo = (eo0 * math.cos(lean) + b * math.sin(lean)).normalized()
        nrm = el.cross(eo).normalized()
        base = center + e1 * (knot_r * 0.8) + up * (knot_r * 0.5)
        pts, wds, tws = [], [], []
        for k in range(97):
            t = 2 * math.pi * k / 96
            sv = Ls * (1 - math.cos(t)) / 2
            hv = Hs * math.sin(t) * (1 - math.cos(t)) / 2 * (1.35 if math.sin(t) > 0 else 0.55)
            p = base + el * sv + eo * hv
            p.z = max(p.z, floor_z)
            pts.append(p)
            wds.append(nrm)
            pinch = math.radians(28) * (1 - smooth(0.0, 0.9, math.sin(t / 2)))
            tws.append(pinch if t < math.pi else -pinch)
        ribbon_mesh(f"고리{side}", pts, wds, RIB_W * 0.96, mat, twist=tws)
    # 앞 왼쪽 꼬리는 앞 왼쪽 모서리 가까이로, 둘째는 뒷면으로(오른쪽 옆면 그늘에서 검은 띠로 보였다)
    for d in ((-0.55, -0.83), (0.45, 0.89)):
        pts, wds, tws = tail_points(d, s)
        ribbon_mesh(f"꼬리{d[0]:+.2f}", pts, wds, RIB_W * 0.9, mat, vcut=(False, s > 0.97), twist=tws)


def ribbons(mat):
    for i, (dx, dy) in enumerate(((1, 0), (-1, 0), (0, 1), (0, -1))):
        pts, wd, tw = arm_points((dx, dy))
        if dx == 0 and K_PEEL < 0.01:  # 가로 띠와 세로 띠가 겹치는 가운데는 세로 띠를 한 겹 위로
            pts = [p + Vector((0, 0, RIB_T * 1.4 if p.z > TOP - 0.001 else 0)) for p in pts]
        ribbon_mesh(f"갈래{i}", pts, wd, RIB_W, mat, twist=tw)
    bow(mat, Vector((0, 0, TOP + OFF + RIB_T * 2.5)))


# ── 제품 ────────────────────────────────────────────────────────────────────
def revolve(name, prof, segs=192, mat=None):
    """prof: [(r, z)] 닫힌 단면을 z축으로 돌린 껍질."""
    bm = bmesh.new()
    rings = []
    for r, z in prof:
        if r <= 0:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z))
                          for i in range(segs)])
    for k in range(len(rings) - 1):
        A, B = rings[k], rings[k + 1]
        if len(A) == 1 and len(B) == 1:
            continue
        if len(A) == 1:
            for i in range(segs):
                bm.faces.new((A[0], B[(i + 1) % segs], B[i]))
        elif len(B) == 1:
            for i in range(segs):
                bm.faces.new((A[i], A[(i + 1) % segs], B[0]))
        else:
            for i in range(segs):
                bm.faces.new((A[i], A[(i + 1) % segs], B[(i + 1) % segs], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = link(bpy.data.objects.new(name, me))
    if mat:
        me.materials.append(mat)
    return ob


def rounded_box(name, sx, sy, sz, loc, mat, bevel=0.004, segs=5):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new(name, me))
    ob.location = Vector(loc)
    if bevel > 0:
        bv = ob.modifiers.new("모서리", "BEVEL")
        bv.width = bevel
        bv.segments = segs
        bv.harden_normals = True
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    return ob


JAR = (0.038, 0.004)    # 크림 단지 자리
AMP = (-0.040, 0.004)   # 앰플 자리


def insert_with_cavities():
    """샴페인 벨벳 인서트 — 제품 홈 둘(단지 둥근 홈 · 앰플 네모 홈)을 불리언으로 판다. 3판: 홈은 얕게(몸통의 56~60 %가 위로)."""
    inner = B_HALF - WALL - 0.0006
    blk = rounded_box("인서트", 2 * inner, 2 * inner, INS_TOP - 0.004, (0, 0, (INS_TOP + 0.004) / 2), mat_velvet(),
                      bevel=0.0015, segs=3)
    cut1 = revolve("홈_단지", [(0.0, JAR_Z), (0.0378, JAR_Z), (0.0378, INS_TOP + 0.01), (0.0, INS_TOP + 0.01)], segs=96)
    cut1.location = (JAR[0], JAR[1], 0)
    cut2 = rounded_box("홈_앰플", 0.0432, 0.0432, INS_TOP - AMP_Z + 0.02, (AMP[0], AMP[1], AMP_Z + (INS_TOP - AMP_Z + 0.02) / 2),
                       mat_velvet(), bevel=0.002, segs=2)
    for c in (cut1, cut2):
        mo = blk.modifiers.new(c.name, "BOOLEAN")
        mo.operation = "DIFFERENCE"
        mo.solver = "EXACT"
        mo.object = c
        c.hide_render = True
        c.hide_viewport = True
    return blk


def pivot_empty(name, loc, rot=(0.0, 0.0, 0.0)):
    """제품 하나의 부품을 매다는 축(바닥 가운데). 움직임에서는 이 축만 앞뒤 프레임 열쇠를 받아 모션 블러가 걸린다."""
    e = link(bpy.data.objects.new(name, None))
    e.location = Vector(loc)
    e.rotation_euler = tuple(math.radians(v) for v in rot)
    return e


def prod_rot(pr):
    """움직임표 제품 값 → 축 돌림(x · y 기울기, z 돎) °."""
    (_, spin, (tx, ty)) = pr
    return (tx, ty, spin)


def _child(ob, parent, local):
    ob.parent = parent
    ob.location = Vector(local)
    return ob


PROD_E = None


def products(jar_at=None, amp_at=None):
    """jar_at · amp_at: (x, y, 바닥 z). 없으면 인서트 홈 자리. product 컷은 상자 앞 바닥에 둔다.
    4판: 부품을 제품마다 축(빈 물체)에 매단다 — 움직임에서 축만 옮겨 모션 블러를 건다."""
    global PROD_E
    glass = mat_glass("glass_heavy")
    gold = mat_simple("gold_cap", base=GOLD, metal=1.0, rough=0.16)
    # 3판(Fable 2차 P3-1): 흰 고무 캡슐이 알약처럼 읽혀 — 작게(지름 1.3 cm · 높이 1.7 cm) · 허리 · 둥근 윗면 · 실리콘 아이보리
    rubber = mat_simple("rubber_bulb", base=(0.90, 0.85, 0.78), rough=0.42, sss=0.3, sss_r=(0.004, 0.0035, 0.003),
                        coat=0.25, coat_rough=0.3)
    cream = mat_simple("cream", base=(0.97, 0.955, 0.93), rough=0.32, sss=0.6, sss_r=(0.006, 0.006, 0.005))
    # 크림 단지: 두꺼운 유리(벽 5 mm · 바닥 12 mm · 어깨 둥금) + 둥근 크림 + 금 목 고리 + 금 뚜껑
    jr = (0.0, 0.0, 0.0)
    if jar_at:
        jx, jy, jz = jar_at
    elif PROD is not None:
        (jx, jy, jz), jr = PROD["jar"][0], prod_rot(PROD["jar"])
    else:
        jx, jy, jz = JAR[0], JAR[1], JAR_Z + 0.095 * smooth(0.0, 0.8, RISE)  # 3.1판: 밑에 틈이 보이게 더 높이
    jar_e = pivot_empty("단지축", (jx, jy, jz), jr)
    jar = revolve("단지", [(0.0, 0.0), (0.0330, 0.0), (0.0352, 0.0012), (0.0360, 0.0040), (0.0360, 0.0400),
                           (0.0356, 0.0428), (0.0346, 0.0450), (0.0330, 0.0462), (0.0310, 0.0462), (0.0310, 0.0150),
                           (0.0300, 0.0128), (0.0280, 0.0120), (0.0, 0.0120)], mat=glass)
    _child(jar, jar_e, (0, 0, 0))
    # 3판: 크림이 안쪽 벽까지 차게(두꺼운 유리가 가운데를 키워 흰 공 · 달걀처럼 보였다) — 윗면만 낮은 둔덕
    # 3.1판(Fable 3차 P3-2): 그래도 반구로 읽혔다 — 크림과 안쪽 벽 사이 0.1 mm 공기층에서 옆쪽 빛이 전반사돼 가장자리 크림이
    # 안 보였다. 실제 크림은 유리에 붙어 있으니 안쪽 벽 · 바닥을 0.2 mm 파고들게(광학 접촉) 하고, 유리 어깨 바로 아래까지 채운다
    cr = revolve("크림", [(0.0, 0.0118), (0.0302, 0.0118), (0.0312, 0.0130), (0.0312, 0.0438), (0.0292, 0.0446),
                          (0.0150, 0.0450), (0.0, 0.0451)], mat=cream)
    _child(cr, jar_e, (0, 0, 0))
    ring = revolve("목고리", [(0.0330, 0.0), (0.0366, 0.0), (0.0366, 0.0018), (0.0330, 0.0018)], mat=gold)
    _child(ring, jar_e, (0, 0, 0.0455))
    jl = revolve("단지뚜껑", [(0.0, 0.0), (0.0368, 0.0), (0.0373, 0.0020), (0.0373, 0.0150), (0.0362, 0.0168),
                              (0.0300, 0.0172), (0.0, 0.0172)], mat=mat_jar_lid())
    _child(jl, jar_e, (0, 0, 0.0470))
    # 앰플: 네모 유리병(벽 3 mm · 바닥 8 mm, 3판 높이 4.2 cm) · 액 70 % · 금 목 · 실리콘 스포이드
    ar = (0.0, 0.0, 0.0)
    if amp_at:
        ax, ay, az = amp_at
    elif PROD is not None:
        (ax, ay, az), ar = PROD["amp"][0], prod_rot(PROD["amp"])
    else:
        ax, ay, az = AMP[0], AMP[1], AMP_Z + 0.085 * smooth(0.2, 1.0, RISE)
    amp_e = pivot_empty("앰플축", (ax, ay, az), ar)
    amp_glass = mat_print("amp_print", "앰플_흰잉크.png", half=0.020, axis="Y", z0=-0.009, h=0.036)
    _child(rounded_box("앰플병", 0.040, 0.040, AMP_H, (0, 0, 0), amp_glass, bevel=0.005), amp_e, (0, 0, AMP_H / 2))
    liq_h = (AMP_H - 0.008 - 0.004) * 0.70
    _child(rounded_box("앰플액", 0.0338, 0.0338, liq_h, (0, 0, 0), mat_serum(), bevel=0.003), amp_e,
           (0, 0, 0.008 + liq_h / 2))
    neck = revolve("앰플목", [(0.0, 0.0), (0.0105, 0.0), (0.0108, 0.0010), (0.0108, 0.0090), (0.0100, 0.0100),
                              (0.0, 0.0100)], mat=gold)
    _child(neck, amp_e, (0, 0, AMP_H))
    bulb = revolve("스포이드", [(0.0, 0.0), (0.0068, 0.0), (0.0070, 0.0022), (0.0058, 0.0040), (0.0064, 0.0075),
                                (0.0066, 0.0110), (0.0058, 0.0145), (0.0038, 0.0163), (0.0, 0.0170)], mat=rubber)
    _child(bulb, amp_e, (0, 0, AMP_H + 0.010))
    PROD_E = (jar_e, amp_e)


def mat_jar_lid():
    """금 뚜껑 윗면: 3판(Fable 2차 P2-3) — 흩뿌린 서리 엠보가 먼지 · 긁힘으로 보여 엠보를 뺐다.
    3.1판(Fable 3차 P2-2): 음각 「유리결」도 위에서 보면 흰 덩이 셋(긁힘 · 얼룩)으로 앉아 가는 테 한 줄만 둔다
    (이름은 상자 앞 옆띠 한 곳 — 2차 「바꾸지 말 것」)."""
    m, n, l, out = new_mat("jar_lid")
    b = principled(n, base=GOLD, metal=1.0, rough=0.16)
    t = planar_tex(n, l, img("단지뚜껑_테.png"), 0.037, "Z")
    top = normal_mask(n, l, "Z", 1)
    h = math_node(n, l, "MULTIPLY", math_node(n, l, "MULTIPLY", t.outputs["Color"], -1.0), top)
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.0004
    l.new(h, bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def crystals(n, rmin, rmax, inner, outer, z, seed=21, mat=None, flat=True):
    """판 모양 눈 결정(얇은 육각판) — 가운데(inner 안)는 비우고 바깥으로 갈수록 촘촘."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    for _ in range(n):
        r = inner + (outer - inner) * (rnd.random() ** 0.55)
        a = rnd.uniform(0, 2 * math.pi)
        c = Vector((r * math.cos(a), r * math.sin(a) + 0.04, z))
        size = rnd.uniform(rmin, rmax)
        if HERO_X is not None and abs(c.x - HERO_X) < 0.10 and abs(c.y) < 0.07:   # 카메라 2판: 제품이 서는 자리는 비운다
            continue
        geom = bmesh.ops.create_circle(bm, cap_ends=True, segments=6, radius=size)
        vs = geom["verts"]
        rot = Matrix.Rotation(rnd.uniform(0, math.pi), 3, "Z")
        if not flat:
            rot = Matrix.Rotation(rnd.uniform(-0.6, 0.6), 3, "X") @ rot
        else:
            rot = Matrix.Rotation(rnd.uniform(-0.25, 0.25), 3, "X") @ rot
        bmesh.ops.rotate(bm, verts=vs, cent=Vector((0, 0, 0)), matrix=rot)
        bmesh.ops.translate(bm, verts=vs, vec=c + Vector((0, 0, size * 0.15)))
    me = bpy.data.meshes.new("결정")
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new("결정", me))
    so = ob.modifiers.new("두께", "SOLIDIFY")
    so.thickness = 0.0002
    me.materials.append(mat or mat_snow())
    return ob


def snow_particles(n, region, rmin, rmax, seed=3, mat=None):
    """떨어지는 눈송이: 작은 공 n개(심도 바깥에서 보케 점). 3판: 상자 위 · 속(가로세로 ±12 cm, 높이 30 cm 아래)에는 두지 않는다
    — 열린 상자 속 공중에 뜬 한 알이 티끌로 보였다(Fable 2차 P2-3). 뽑는 순서는 그대로라 남은 눈송이 자리는 2판과 같다."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    (x0, x1), (y0, y1), (z0, z1) = region
    for i in range(n):
        r = rnd.uniform(rmin, rmax)
        c = Vector((rnd.uniform(x0, x1), rnd.uniform(y0, y1), rnd.uniform(z0, z1)))
        if T is not None:
            # 4판 움직임: 천천히 내리며 흔들린다(속도는 따로 뽑아 위 뽑는 순서를 지킨다). 상자 위 기둥에는 아예 두지 않는다 —
            # 높이로 가르면 내려오던 눈송이가 상자 위에서 갑자기 사라진다
            if abs(c.x) < 0.12 and abs(c.y) < 0.12:
                continue
            q = random.Random(seed * 7919 + i)
            v, amp, w, ph = q.uniform(0.012, 0.030), q.uniform(0.002, 0.008), q.uniform(0.6, 1.4), q.uniform(0, 6.3)
            c.z = z0 + (c.z - z0 - v * T) % (z1 - z0)
            c.x += amp * math.sin(w * T + ph)
            c.y += amp * math.cos(0.8 * w * T + ph)
        elif abs(c.x) < 0.12 and abs(c.y) < 0.12 and c.z < 0.30:
            continue
        if SHOT == "product" and c.y < 0.06 and abs(c.x) < 0.30 and c.z < 0.25:  # 렌즈 앞 눈송이가 단지 앞 얼룩으로
            continue
        geom = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
        bmesh.ops.translate(bm, verts=geom["verts"], vec=c)
    me = bpy.data.meshes.new("눈송이")
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new("눈송이", me))
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat or mat_simple("snowflake", base=(1, 1, 1), rough=0.4, sss=0.8,
                                          sss_r=(0.01, 0.01, 0.01)))
    return ob


def bokeh_lights(n, center, spread, rgb, strength, seed=9, rmin=0.006, rmax=0.016):
    rnd = random.Random(seed)
    bm = bmesh.new()
    for _ in range(n):
        c = Vector(center) + Vector((rnd.uniform(-spread[0], spread[0]), rnd.uniform(-spread[1], spread[1]),
                                     rnd.uniform(-spread[2], spread[2])))
        geom = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=rnd.uniform(rmin, rmax))
        bmesh.ops.translate(bm, verts=geom["verts"], vec=c)
    me = bpy.data.meshes.new("보케")
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new("보케", me))
    me.materials.append(mat_emit("bokeh", rgb, strength))
    return ob


def floor_mat(base, rough, coat, coat_rough, print_x=None):
    """바닥: 거친 광택 + 얇은 서리(미세 범프). print_x(카메라 2판): 그 x부터 12 cm에 걸쳐 제목 포장지와 같은 남색 종이 · 금박
    서리꽃으로 바뀐다 — 원본 3번은 병이 서는 바닥에 금 선화가 깔려 옆 이동이 읽혔다(상자 둘레 바닥은 무늬 없음).
    매끈한 밤 바닥 그대로는 카메라가 옆으로 흘러도 보이는 것이 금가루뿐이라 멈춘 화면처럼 읽혔다."""
    m, n, l, out = new_mat("floor")
    b = principled(n, base=base, rough=rough, coat=coat, coat_rough=coat_rough)
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 420.0
    nz.inputs["Detail"].default_value = 6.0
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    bump.inputs["Distance"].default_value = 0.0003
    l.new(nz.outputs["Fac"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    if "Coat Normal" in b.inputs:
        l.new(bump.outputs["Normal"], b.inputs["Coat Normal"])
    if print_x is None:
        l.new(b.outputs[0], out.inputs["Surface"])
        return m
    paper = principled(n, base=(0.022, 0.030, 0.062), rough=0.62)
    foil = principled(n, base=(0.86, 0.62, 0.27), metal=1.0, rough=0.26)
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Object"], sep.inputs["Vector"])
    comb = n.new("ShaderNodeCombineXYZ")
    l.new(_ma(n, l, sep.outputs["X"], 1 / 0.55, 0.17), comb.inputs["X"])
    l.new(_ma(n, l, sep.outputs["Y"], 1 / 0.55, 0.61), comb.inputs["Y"])
    t = n.new("ShaderNodeTexImage")
    t.image = img("포장지_엠보.png")
    t.extension = "REPEAT"
    l.new(comb.outputs[0], t.inputs["Vector"])
    pmix = n.new("ShaderNodeMixShader")
    l.new(t.outputs["Color"], pmix.inputs["Fac"])
    l.new(paper.outputs[0], pmix.inputs[1])
    l.new(foil.outputs[0], pmix.inputs[2])
    pb = n.new("ShaderNodeBump")
    pb.inputs["Strength"].default_value = 0.6
    pb.inputs["Distance"].default_value = 0.0001
    l.new(t.outputs["Color"], pb.inputs["Height"])
    l.new(paper_grain(n, l).outputs["Normal"], pb.inputs["Normal"])
    for sh in (paper, foil):
        l.new(pb.outputs["Normal"], sh.inputs["Normal"])
    mr = n.new("ShaderNodeMapRange")
    mr.interpolation_type = "SMOOTHSTEP"
    mr.inputs["From Min"].default_value = print_x
    mr.inputs["From Max"].default_value = print_x + 0.12
    l.new(sep.outputs["X"], mr.inputs["Value"])
    mix = n.new("ShaderNodeMixShader")
    l.new(mr.outputs["Result"], mix.inputs["Fac"])
    l.new(b.outputs[0], mix.inputs[1])
    l.new(pmix.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs["Surface"])
    return m


# ── 판(룩)마다 바닥 · 배경 · 빛 ───────────────────────────────────────────────
def set_look():
    if LOOK == "A":
        world_gradient((0.030, 0.045, 0.080), (0.13, 0.18, 0.27), 0.55)
        rounded_box("바닥", 4.0, 4.0, 0.02, (0, 0, -0.01), floor_mat((0.62, 0.68, 0.80), 0.55, 0.2, 0.4), bevel=0.0)
        crystals(900, 0.0006, 0.0022, 0.14, 0.9, 0.0002)
        area_light("키", (-0.55, -0.70, 0.75), (0, 0, 0.06), 16, 0.8, rgb=(0.80, 0.88, 1.0))
        area_light("역광", (0.45, 0.75, 0.22), (0, 0, 0.10), 85, 0.28, rgb=(1.0, 0.68, 0.30))
        area_light("윗빛", (0.05, 0.25, 0.90), (0, 0, 0.10), 5, 0.5, rgb=(0.86, 0.92, 1.0))
        snow_particles(260, ((-0.6, 0.6), (-0.3, 0.9), (0.0, 0.7)), 0.0012, 0.0032)
    elif LOOK == "B":
        world_gradient((0.004, 0.006, 0.016), (0.012, 0.018, 0.045), 1.0)
        # 끝 보강(10-28): 닫힘(위에서 내려다봄)에서는 반질한 밤 바닥이 키를 왼쪽 아래 회백 얼룩으로, 역광을 오른쪽 위 흰 덩이로
        # 비춰 흰 상자가 바탕에서 안 떴다 — 원본 끝 그림처럼 고른 무광 바탕(짙은 남색)으로
        fm = (floor_mat((0.010, 0.013, 0.030), 0.92, 0.0, 0.35) if SHOT == "top"
              else floor_mat((0.012, 0.014, 0.024), 0.46, 0.25, 0.35, print_x=PRINT_X))
        floor = rounded_box("바닥", 3.0, 3.0, 0.02, (0, 0, -0.01), fm, bevel=0.0)
        if PRINT_X is not None and HERO_X is not None:
            # 바닥 무늬 빛: 제품 자리 뒤 조금 왼쪽, 카메라(45°)를 바닥에 비춘 쪽(36°)의 넓은 면광 — 금박 서리꽃이 결마다
            # 반짝이고 종이는 남색 결빛만. 바닥만 받는다(제품 빛은 따로). 제품은 그림자를 앞으로 부드럽게 드리워 바닥에 선다
            # (46°로 높이거나 제품 그림자를 빼도 단지 앞 오른쪽이 어두운 것은 같았다 — 빛이 비스듬히 닿는 쪽의 자연스러운 낙차)
            fl = area_light("바닥빛", (HERO_X - 0.10, 0.55, 0.40), (HERO_X, 0.0, 0.0), FLOOR_LIGHT, 0.8,
                            rgb=(1.0, 0.84, 0.62))
            fl.visible_camera = False
            recv = bpy.data.collections.new("바닥빛_받음")
            bpy.context.scene.collection.children.link(recv)
            recv.objects.link(floor)
            fl.light_linking.receiver_collection = recv
        crystals(1100, 0.0005, 0.0020, 0.135, 0.85, 0.0002)
        area_light("키", (-0.60, -0.55, 0.60), (0, 0, 0.06), 45, 0.7, rgb=(1.0, 0.82, 0.58))
        # 3판: 역광 70 → 58(일어선 갈래가 역광을 받는 순간 하이라이트가 날아갔다 — 반 스톱쯤) · 채움 6 → 11(오른쪽 옆면 띠가 검게)
        # 카메라 2판: 열림 컷에서 카메라가 상자 오른쪽으로 빠지는 동안 끈다(반질한 바닥에 비친 역광이 화면 한가운데 흰 덩이가 됐다)
        rim = 58 * (1 - smooth(*RIM_FADE, T)) if RIM_FADE and T is not None else 58
        area_light("역광", (0.35, 0.70, 0.35), (0, 0, 0.08), rim, 0.25, rgb=(0.55, 0.70, 1.0))
        area_light("채움", (0.75, -0.40, 0.10), (0, 0, 0.05), 11, 0.6, rgb=(1.0, 0.85, 0.65))
        # 3.1판(Fable 3차 P2-2): 금 뚜껑 윗면이 남색 하늘을 비춰 검은 원판이 됐다 — 뒤 왼쪽 낮은 데 따뜻한 반사판(면광) 하나,
        # 히어로 · 떠오름 카메라에서 윗면에 비치는 방향에 둔다
        # 빛 연결로 금 뚜껑만 받게(build에서 이어 줌) — 그냥 두면 바닥 · 뒤가 밝아져 밤 기운이 빠진다
        global LID_LIGHT
        LID_LIGHT = area_light("뒤금빛", (-0.20, 0.55, 0.26), (0.0, 0.0, 0.12), 14, 0.7, rgb=(1.0, 0.78, 0.45))
        bokeh_lights(70, (0.1, 1.6, 0.35), (1.2, 0.4, 0.35), (1.0, 0.70, 0.32), 22.0)
        if SHOT != "title":    # 카메라 2판 제목은 포장지 3 cm 위를 미끄러진다 — 렌즈 앞 눈송이가 얼룩이 된다
            x1 = 0.6 if HERO_X is None else HERO_X + 0.6     # 제품 자리까지(눈 밀도는 그대로)
            snow_particles(int(220 * (x1 + 0.6) / 1.2), ((-0.6, x1), (-0.3, 0.9), (0.0, 0.7)), 0.0010, 0.0028)
        if HERO_X is not None:
            # 카메라 2판: 제품이 바닥에 서는 자리(상자에서 오른쪽 HERO_X)에 같은 빛 묶음 하나 더 — 제품만 받게 build에서 잇는다
            # (그냥 두면 반질한 밤 바닥이 그 빛을 비춰 화면이 회색으로 떴다)
            global HERO_RIG
            hx = HERO_X
            HERO_RIG = [area_light("키2", (hx - 0.60, -0.55, 0.60), (hx, 0, 0.04), 45, 0.7, rgb=(1.0, 0.82, 0.58)),
                        area_light("역광2", (hx + 0.35, 0.70, 0.35), (hx, 0, 0.05), 58, 0.25, rgb=(0.55, 0.70, 1.0)),
                        area_light("채움2", (hx + 0.75, -0.40, 0.10), (hx, 0, 0.03), 11, 0.6, rgb=(1.0, 0.85, 0.65))]
    else:
        world_gradient((0.16, 0.20, 0.27), (0.62, 0.70, 0.80), 0.7)
        icem = mat_glass("ice", rough=0.04, tint=(0.90, 0.96, 1.0))
        rounded_box("얼음판", 0.30, 0.30, 0.045, (0, 0, -0.0225), icem, bevel=0.008)
        rounded_box("바닥", 4.0, 4.0, 0.02, (0, 0, -0.055), mat_simple("cold_floor", base=(0.30, 0.36, 0.46),
                                                                      rough=0.25, coat=0.6), bevel=0.0)
        area_light("키", (-0.55, -0.70, 0.75), (0, 0, 0.06), 55, 0.8, rgb=(0.88, 0.94, 1.0))
        area_light("뒤빛", (0.0, 0.70, 0.05), (0, 0, -0.01), 60, 0.6, rgb=(0.75, 0.88, 1.0))
        area_light("역광", (0.55, 0.65, 0.42), (0, 0, 0.08), 60, 0.3, rgb=(1.0, 0.76, 0.45))
        snow_particles(160, ((-0.6, 0.6), (-0.3, 0.9), (0.0, 0.7)), 0.0010, 0.0026)


# ── 장면 ────────────────────────────────────────────────────────────────────
LID_LIGHT = None
HERO_RIG = []


def link_hero_rig():
    """카메라 2판: 제품 자리 빛 묶음은 제품(단지 · 앰플 부품)만 받는다."""
    if not HERO_RIG:
        return
    recv = bpy.data.collections.new("제품빛_받음")
    bpy.context.scene.collection.children.link(recv)
    for ob in list(bpy.context.scene.objects):
        if ob.type == "MESH" and ob.parent is not None and ob.parent.name in ("단지축", "앰플축"):
            recv.objects.link(ob)
    for lt in HERO_RIG:
        lt.light_linking.receiver_collection = recv


def link_lid_light():
    """뒤금빛(B판)은 금 뚜껑 · 금 목만 받는다 — 윗면이 하늘 대신 금빛을 비추게(Fable 3차 P2-2)."""
    if LID_LIGHT is None:
        return
    recv = bpy.data.collections.new("뒤금빛_받음")
    bpy.context.scene.collection.children.link(recv)
    for ob in list(bpy.context.scene.objects):
        if ob.type == "MESH" and ob.name.startswith(("단지뚜껑", "목고리", "앰플목")):
            recv.objects.link(ob)
    LID_LIGHT.light_linking.receiver_collection = recv


def scale_key(k):
    for ob in bpy.context.scene.objects:
        if ob.type == "LIGHT" and ob.name == "키":
            ob.data.energy *= k


def lid_rake(lid, energy, pos, target):
    """뚜껑 윗면 서리꽃 엠보를 세우는 낮은 스침빛(4판) — 빛 연결로 뚜껑만 받고(바닥 · 리본이 밝아지지 않게), 그림자 연결로
    뚜껑만 가린다(나비 · 띠가 낮은 빛에 긴 그림자를 뚜껑에 드리우지 않게). 카메라에는 안 보이게."""
    rake = area_light("스침빛", pos, target, energy, 0.30, rgb=(1.0, 0.84, 0.62), size_y=0.03)
    rake.visible_camera = False
    recv = bpy.data.collections.new("스침빛_받음")
    bpy.context.scene.collection.children.link(recv)
    recv.objects.link(lid)
    rake.light_linking.receiver_collection = recv
    rake.light_linking.blocker_collection = recv
    return rake


def mirror_xy(p_xy, cam_loc, h, z0=TOP):
    """높이 z0 면의 점 p에 비친 빛이 카메라에 들어오려면 빛(z0 + h)이 놓일 xy — 면에 비친 카메라 상과 빛을 잇는 선이 p를 지난다."""
    k = h / (cam_loc.z - z0 + h)
    return (Vector(p_xy) - k * Vector((cam_loc.x, cam_loc.y))) / (1 - k)


def gloss_light(name, xy, z, energy, size, size_y=None, angle=0.0, rgb=(1.0, 0.88, 0.70), receivers=()):
    """반사로만 비추는 아래 보는 면광(확산 빛은 안 줘 흰 판지가 밝아지지 않는다) — 빛 연결로 받을 물체를 정한다."""
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.color = rgb
    ld.shape = "RECTANGLE" if size_y else "DISK"
    ld.size = size
    if size_y:
        ld.size_y = size_y
    ob = link(bpy.data.objects.new(name, ld))
    ob.location = (xy[0], xy[1], z)
    ob.rotation_euler = (0.0, 0.0, angle)
    ob.visible_camera = False
    ob.visible_diffuse = False
    recv = bpy.data.collections.new(f"{name}_받음")
    bpy.context.scene.collection.children.link(recv)
    for o in receivers:
        recv.objects.link(o)
    ob.light_linking.receiver_collection = recv
    return ob


def foil_light(lid):
    """끝 보강(10-28): 금박은 비칠 빛이 없으면 둘레의 밤을 비춰 회색 · 검은 글자로 찍혔다(시험 0060 · 0095 · 0362).
    뚜껑 윗면(지금 자세 — 들리고 기운 것까지)에 카메라를 비춘 쪽 45 cm에 넓은 면광 하나 — 반사로만, 뚜껑만 받는다."""
    if CAMC is None:
        return
    cam_loc, _ = cam_pose(CAMC)
    mw = lid.matrix_world
    pc = mw @ Vector((0.0, 0.0, TOP))
    nrm = (mw.to_3x3() @ Vector((0.0, 0.0, 1.0))).normalized()
    v = (cam_loc - pc).normalized()
    r = 2 * nrm.dot(v) * nrm - v
    ld = bpy.data.lights.new("금박빛", "AREA")
    warm = (1.0, 0.80, 0.50) if SHOT == "top" else (1.0, 0.88, 0.70)   # 닫힘은 따뜻하게 — 흰 빛은 금을 크림으로 눌렀다
    ld.energy, ld.color, ld.shape, ld.size = FOIL_SOFT, warm, "DISK", 0.55
    ob = link(bpy.data.objects.new("금박빛", ld))
    ob.location = pc + r * 0.45
    ob.rotation_euler = (pc - ob.location).to_track_quat("-Z", "Y").to_euler()
    ob.visible_camera = False
    ob.visible_diffuse = False
    recv = bpy.data.collections.new("금박빛_받음")
    bpy.context.scene.collection.children.link(recv)
    recv.objects.link(lid)
    ob.light_linking.receiver_collection = recv


def floor_alone():
    """끝 보강(10-28) 닫힘: 키 · 역광 · 채움 · 보케가 무광 바닥까지 비춰 바탕이 회청색(127 · 146 · 182)으로 떴다 — 연결이 없는
    빛은 바닥을 빼고(바닥 말고 모든 물체만 받게 — 금가루까지 지은 뒤 부른다), 바닥은 왼쪽 앞 위 넓은 남빛 하나로 고르게
    (상자 그림자는 그대로 진다). 원본 끝 그림의 고른 진홍 바탕 자리."""
    sc = bpy.context.scene
    floor = sc.objects.get("바닥")
    if floor is None:
        return
    rest = bpy.data.collections.new("바닥뺌")
    sc.collection.children.link(rest)
    for ob in list(sc.objects):
        if ob.type == "MESH" and ob is not floor:
            rest.objects.link(ob)
    for ob in list(sc.objects):
        if ob.type == "LIGHT" and ob.light_linking.receiver_collection is None:
            ob.light_linking.receiver_collection = rest
    fl = area_light("바닥남빛", (-0.30, -0.30, 1.00), (0.04, 0.02, 0.0), FLOOR_TOP, 1.4, rgb=(0.62, 0.74, 1.0))
    fl.visible_camera = False
    only = bpy.data.collections.new("바닥남빛_받음")
    sc.collection.children.link(only)
    only.objects.link(floor)
    fl.light_linking.receiver_collection = only


def top_foil_lights(lid):
    """끝 보강(10-28): 매듭 한 방(SWEEP)에 긴 띠 빛이 비친 자리가 뚜껑 뒤 왼쪽 → 앞 오른쪽(이름 쪽)으로 흐른다(뚜껑 · 리본이 받음).
    원본 끝 그림은 금박이 번쩍인다 — 늘 비추는 금박빛(foil_light)에 더해 한 번."""
    if CAMC is None:
        return
    cam_loc, _ = cam_pose(CAMC)
    if SWEEP is None or T is None or not (SWEEP[0] - 0.04 <= T <= SWEEP[1] + 0.04):
        return
    x = smooth(SWEEP[0], SWEEP[1], T)
    d = Vector((math.sqrt(0.5), -math.sqrt(0.5)))           # 뒤 왼쪽 → 앞 오른쪽
    p = d * (-0.17 + 0.34 * x)                              # 뚜껑 모서리(대각 0.13) 밖에서 밖으로
    rib = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.name.startswith(("갈래", "매듭", "고리", "꼬리"))]
    gloss_light("빛줄기", mirror_xy(p, cam_loc, 0.25), TOP + 0.25, SWEEP_E, 0.50, size_y=0.022,
                angle=math.radians(45), rgb=(1.0, 0.82, 0.52), receivers=[lid] + rib)   # 따뜻하게 — 흰 띠는 금박 이름을 흰 글자로 바꿨다


def product_glint():
    """끝 보강(10-28) 6초: 마지막 유리 한 방(SWEEP)에 제품 뒤 위로 세로 띠 빛이 왼쪽 → 오른쪽으로 지나 금 뚜껑 · 유리에 빛줄기가
    흐른다(제품만 받음). 6초는 제품 둘이 서자마자 어두워져 끝이 맹했다."""
    if SWEEP is None or T is None or HERO_X is None or not (SWEEP[0] - 0.04 <= T <= SWEEP[1] + 0.04):
        return
    recv = bpy.data.collections.get("제품빛_받음")
    if recv is None:
        return
    # 끝 보강 2(Fable P2-4): S 곡선으로 상자 양옆에서 들어오니 띠가 4.27~4.43초에야 제품 뒤에 닿고 +5~9/255로 안 보였다 —
    # 앰플(가운데 −4 cm) 뒤에서 곧게 출발해 4.15 앰플 · 4.23 단지 순으로 금 뚜껑에 비치게(카메라 45°의 거울 자리: 뒤 25 cm · 높이 30 cm)
    k = min(1.0, max(0.0, (T - SWEEP[0]) / (SWEEP[1] - SWEEP[0])))
    x = HERO_X - 0.05 + 0.40 * k
    ld = bpy.data.lights.new("제품빛줄기", "AREA")
    ld.energy = GLINT_E
    ld.color = (1.0, 0.84, 0.58)
    ld.shape = "RECTANGLE"
    ld.size, ld.size_y = 0.06, 0.45
    ob = link(bpy.data.objects.new("제품빛줄기", ld))
    ob.location = (x, 0.25, 0.30)
    ob.rotation_euler = (Vector((x, 0.0, 0.05)) - ob.location).to_track_quat("-Z", "Y").to_euler()
    ob.visible_camera = False
    ob.visible_diffuse = False
    ob.light_linking.receiver_collection = recv


def mat_wrap_paper():
    """서리꽃 포장지(카메라 2판 제목): 룩 B의 남색 밤 종이에 뚜껑과 같은 크기의 서리꽃을 금박(살짝 돋움)으로 고르게 깐 55 cm
    한 장(../라벨/포장.py 포장지_엠보.png). 원본 제목 종이(짙은 붉은 바탕 · 금 선화)처럼 흐려도 무늬가 읽히게 — 흰 판지에
    흰 엠보 · 금박은 얕은 초점 속에서 흰 판으로 묻혔다. 상자 뚜껑은 정본대로 흰 판지 · 엠보만."""
    m, n, l, out = new_mat("wrap_paper")
    # 결 반사(sheen) · 코트는 뺀다 — 3 cm 높이에서 낮게 보는 제목 카메라에는 비스듬한 결 반사가 종이 전체를 하얗게 띄웠다
    paper = principled(n, base=(0.022, 0.030, 0.062), rough=0.62)
    foil = principled(n, base=(0.86, 0.62, 0.27), metal=1.0, rough=0.26)
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Object"], sep.inputs["Vector"])
    comb = n.new("ShaderNodeCombineXYZ")
    l.new(_ma(n, l, sep.outputs["X"], 1 / 0.55, 0.5), comb.inputs["X"])
    l.new(_ma(n, l, sep.outputs["Y"], 1 / 0.55, 0.3), comb.inputs["Y"])
    t = n.new("ShaderNodeTexImage")
    t.image = img("포장지_엠보.png")
    t.extension = "REPEAT"
    l.new(comb.outputs[0], t.inputs["Vector"])
    mix = n.new("ShaderNodeMixShader")
    l.new(t.outputs["Color"], mix.inputs["Fac"])
    l.new(paper.outputs[0], mix.inputs[1])
    l.new(foil.outputs[0], mix.inputs[2])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.0001
    l.new(t.outputs["Color"], bump.inputs["Height"])
    l.new(paper_grain(n, l).outputs["Normal"], bump.inputs["Normal"])
    for sh in (paper, foil):
        l.new(bump.outputs["Normal"], sh.inputs["Normal"])
    l.new(mix.outputs[0], out.inputs["Surface"])
    return m


def build_title():
    """카메라 2판 제목: 원본 1번처럼 포장지 위를 낮게 빠르게 미끄러진다 — 상자 · 리본 없이 넓은 서리꽃 포장지 한 장
    (가로 1.2 · 세로 1.6 m)과 앞에서 낮게 비추는 스침빛(종이만 받음), 키 1/4 · 노출."""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    for v in bm.verts:
        v.co.x *= 1.2
        v.co.y = v.co.y * 1.6 + 0.5
        v.co.z = 0.0005
    me = bpy.data.meshes.new("포장지")
    bm.to_mesh(me)
    bm.free()
    sheet = link(bpy.data.objects.new("포장지", me))
    me.materials.append(mat_wrap_paper())
    scale_key(0.25)
    # 상자용 역광 · 채움 · 뒤금빛은 끈다 — 역광(58 W)이 낮게 보는 카메라 바로 앞이라 종이 면의 비스듬한 반사가 화면을 뿌옇게 띄웠다
    for ob in bpy.context.scene.objects:
        if ob.type == "LIGHT" and ob.name in ("역광", "채움", "뒤금빛"):
            ob.data.energy = 0.0
    # 금박이 빛나게 앞 왼쪽 낮은 데서 카메라 쪽으로(역광) — 남색 종이에는 부드러운 결빛만 진다
    lid_rake(sheet, 10.0, (-0.35, 1.10, 0.06), (0.0, 0.25, 0.0))
    # 남색이 살게 위에서 약한 푸른 빛 하나(종이만 받음)
    cool = area_light("제목남빛", (0.0, 0.10, 0.60), (0.0, 0.20, 0.0), 6, 0.8, rgb=(0.55, 0.68, 1.0))
    cool.visible_camera = False
    cool.light_linking.receiver_collection = bpy.data.collections["스침빛_받음"]
    bpy.context.scene.view_settings.exposure = 0.0


def build():
    global LID_LIGHT, HERO_RIG
    LID_LIGHT = None
    HERO_RIG = []
    reset()
    set_look()
    if SHOT == "title" and FILM:
        build_title()
        return
    if SHOT == "product":
        # 3판: 제품 접사는 상자 없이 서리 바닥 위 단지(앞) · 앰플(뒤 오른쪽) — 흰 상자가 화면 한쪽을 하얗게 덮었다.
        # 유리 벽 두께 · 흰 크림 · 금 목 고리를 눈높이에서 한 프레임에, 차가운 보조광으로 금과 금을 가른다(Fable 2차 P2-3)
        products(jar_at=(0.0, 0.0, 0.0), amp_at=(0.075, 0.050, 0.0))
        link_lid_light()
        area_light("차가운보조", (-0.26, -0.22, 0.12), (0.0, 0.0, 0.04), 7, 0.22, rgb=(0.62, 0.76, 1.0))
        area_light("유리테", (0.30, 0.20, 0.10), (0.02, 0.02, 0.04), 10, 0.10, rgb=(0.85, 0.92, 1.0))
        point_light("먼금빛", (-0.30, 0.55, 0.06), 6.0, (1.0, 0.72, 0.38), radius=0.06)  # 화면 밖 열린 상자의 빛이 뒤에 번진 것처럼
        return
    paper = mat_box("paper_base", lid=False)
    lidm = mat_box("paper_lid", lid=True)
    open_box("몸통", B_HALF, B_H, 0.0, paper, "top")
    open_box("속금박", B_HALF - WALL - 0.0003, B_H - 0.004, 0.003, mat_foil_inside(), "top", bevel=0.0004)
    lid = open_box("뚜껑", L_HALF, L_H, TOP - L_H, lidm, "bottom")
    insert_with_cavities()
    products()
    if PROD is not None and LID_LIGHT is not None:
        # 카메라 2판: 제품이 바닥 자리로 옮겨 가도 뒤금빛이 같은 자리 관계로 따라가게(금 뚜껑 윗면이 검은 원판이 되지 않게)
        (jx, jy, jz) = PROD["jar"][0]
        aim = Vector((jx - JAR[0], 0.0, jz + 0.06))
        LID_LIGHT.location = aim + Vector((-0.20, 0.55, 0.20))
        if HERO_X is not None and jz < 0.001:
            # 바닥에 선 단지(정면 45° 카메라): 뚜껑 윗면을 카메라가 비춰 보는 쪽(뒤 45°)에 둔다 — 옛 자리(뒤 왼쪽 19°)는
            # 정면에서 윗면에 반만 비쳐 금 뚜껑이 속이 빈 그릇처럼 어둡게 읽혔다
            aim = Vector((jx, jy, jz + 0.064))
            LID_LIGHT.location = aim + Vector((-0.05, 0.32, 0.32))
        LID_LIGHT.rotation_euler = (aim - LID_LIGHT.location).to_track_quat("-Z", "Y").to_euler()
    link_lid_light()
    link_hero_rig()
    # (2판의 인서트 위 눈 결정은 뺐다 — 상자 속 티끌로 보였다)
    # 뚜껑: 앞이 먼저 들리고(뒤 모서리 축 −5°) → 위로 떠오르며 뒤로 기운다 → 4판 뚜껑 나감: 더 높이 · 뒤로 화면 밖까지
    if K_TILT > 0 or K_LID > 0 or LID_OUT > 0:
        pivot = Vector((0, L_HALF, TOP))
        ang = math.radians(-5) * K_TILT + math.radians(-17) * K_LID + math.radians(-26) * LID_OUT
        rot = Matrix.Rotation(ang, 4, "X")
        lift = Matrix.Translation(Vector((0, 0.050 * K_LID + 0.14 * LID_OUT,
                                          0.16 * K_LID + 0.46 * LID_OUT)))  # 3판: 더 높이 — 떠오르는 제품과 겹치지 않게
        lid.matrix_world = lift @ Matrix.Translation(pivot) @ rot @ Matrix.Translation(-pivot)
    ribbons(mat_satin())
    if SHOT in ("macro", "open", "top"):
        foil_light(lid)
    if K_TILT > 0:
        inner = [point_light("속빛", (0, 0.01, 0.075), 1.4 * max(K_TILT, K_LID), (1.0, 0.74, 0.40), radius=0.05)]
        if SHOT == "open" and RISE == 0:  # 앞 벽 안쪽에서 제품 앞면을 비춰 두꺼운 유리 속 흰 크림이 보이게(뚜껑 그늘에 묻혔다)
            inner.append(point_light("속앞빛", (0.0, -0.062, 0.082), 3.2, (1.0, 0.88, 0.70), radius=0.03))
        for ob in inner:  # 4판: 높은 각도로 상자 속을 들여다보므로 빛 구슬은 카메라에 안 보이게(4.83초 번쩍임은 렌즈 앞 금가루였다)
            ob.visible_camera = False
        # 금빛 김: 넓은 컷(hero)에서만 — 상자 속이 짙고 테두리 위 2 cm에서 사라진다(접사 · 열린 상자는 우윳빛이 됐다)
        if SHOT == "hero":
            h = B_H + 0.02 - INS_TOP
            vol = rounded_box("김", 2 * (B_HALF - WALL), 2 * (B_HALF - WALL), h, (0, 0, INS_TOP + h / 2),
                              mat_glow_volume(0.35 * K_LID), bevel=0.0)
            vol.visible_shadow = False
    if SHOT == "open":
        # 차가운 보조광 하나 — 금 뚜껑과 금박 속벽(금 위에 금)을 가르고 유리 모서리를 세운다
        area_light("차가운보조", (-0.34, -0.30, 0.16), (JAR[0], -0.05, 0.06 + 0.06 * RISE), 9, 0.25, rgb=(0.62, 0.76, 1.0))
        if HERO_X is not None:    # 카메라 2판: 바닥에 선 제품 자리에도 같은 보조광 — 제품만 받게(바닥 앞에 차가운 빛 웅덩이가 졌다)
            cool2 = area_light("차가운보조2", (HERO_X - 0.34, -0.30, 0.13), (HERO_X, -0.05, 0.03), 9, 0.25, rgb=(0.62, 0.76, 1.0))
            if bpy.data.collections.get("제품빛_받음") is not None:
                cool2.light_linking.receiver_collection = bpy.data.collections["제품빛_받음"]
            if FILM == "6":
                product_glint()
    elif SHOT == "macro":
        # 공단 결빛: 작고 센 빛 하나가 갈래 · 고리 면에 길이 방향 하이라이트 한 줄을 세운다(Fable 2차 P3-4)
        # 3.1판(Fable 3차 P2-1): 작고 센 빛은 실결을 알갱이로 키웠다 — 긴 면광으로 하이라이트 한 줄만
        sheen = area_light("결빛", (-0.16, 0.30, 0.34), (0.0, 0.0, TOP + 0.02), 30, 0.40, rgb=(1.0, 0.93, 0.82), size_y=0.08)
        # 4판(Fable 움직임 1차 P1-1): 접사에서 흰 뚜껑이 날아(250 넘는 픽셀 절반) 나비가 빠진 끝 0.3초가 빈 흰 화면이었다 —
        # 결빛은 리본만 받게(뚜껑까지 날렸다) · 키 절반 · 노출 −0.7, 뚜껑 면에는 오른쪽 낮은 스침빛으로 서리꽃 결을
        recv = bpy.data.collections.new("결빛_받음")
        bpy.context.scene.collection.children.link(recv)
        for ob in list(bpy.context.scene.objects):
            if ob.type == "MESH" and ob.name.startswith(("갈래", "매듭", "고리", "꼬리")):
                recv.objects.link(ob)
        sheen.light_linking.receiver_collection = recv
        scale_key(0.5)
        bpy.context.scene.view_settings.exposure = -0.7
        lid_rake(lid, TITLE_RAKE * 0.4, (0.32, 0.06, TOP + 0.03), (0.03, -0.04, TOP))
    elif SHOT == "title":
        # 4판 제목: 뚜껑 윗면의 서리꽃 엠보(0.2 mm)는 키 빛 아래에서 평평하다 — 키를 줄이고, 낮게 눕혀 비추는 긴 빛 하나로 결을
        # 세운다. 자리는 리본 꼬리가 없고 서리꽃이 가장 촘촘한 뒤 왼쪽 사분면. 스침빛은 그 바깥 모서리 너머 낮은 데서 카메라
        # 쪽으로(역광) — 나비 · 띠를 지나지 않아 그 그림자가 사분면에 안 진다
        scale_key(0.25)
        lid_rake(lid, TITLE_RAKE, (-0.30, 0.30, TOP + 0.024), (-0.05, 0.05, TOP))
        bpy.context.scene.view_settings.exposure = TITLE_EXPO
    elif SHOT == "top":
        # 4판(Fable 움직임 1차 P2-3): 82°로 멈춘 끝 그림에서 빛이 모두 비스듬히 위에서 와 엠보가 평평 — 「서리꽃 에디션」의
        # 서리꽃이 끝 그림에 없었다. 뒤 왼쪽 12° 높이 스침빛 하나(제목의 0.8 — 0.6은 아직 옅었다, 그림자 연결로 나비 그림자는 없다)
        lid_rake(lid, TITLE_RAKE * 0.8, (-0.30, 0.30, TOP + 0.09), (0.0, 0.0, TOP))
        top_foil_lights(lid)
        # 끝 보강 2(Fable P2-2 · P3-3): 밝은 흰 판지 · 공단을 AgX가 눌러 금박 S 0.25 · 리본 S 0.27로 옅었다 — 닫힘만 노출 −0.3
        bpy.context.scene.view_settings.exposure = -0.3


def shots():
    asp = RES[0] / RES[1]
    if SHOT == "hero":
        if asp >= 1:
            camera((0.58, -0.88, 0.36), (0.0, 0.0, 0.070), lens=85, fstop=2.8)
        else:
            camera((0.40, -0.62, 0.34), (0.0, 0.0, 0.080), lens=70, fstop=2.8)
    elif SHOT == "top":
        camera((0.02, -0.16, 0.85), (0.0, 0.0, 0.05), lens=60, fstop=4.0)
    elif SHOT == "open":
        if RISE >= 0.5:  # 떠오른 제품: 눈을 낮춰 유리 몸통을 옆에서(위에서 보면 유리 옆면은 반사만 보인다)
            if asp >= 1:  # 3.1판: 조금 높여 제품 밑의 틈 · 상자 속이 보이게(테두리 위에 선 것처럼 읽혔다)
                camera((0.17, -0.44, 0.25), (0.0, 0.004, 0.12), lens=55, fstop=5.6)
            else:
                camera((0.13, -0.36, 0.26), (0.0, 0.004, 0.12), lens=45, fstop=5.6)
        elif asp >= 1:
            camera((0.20, -0.36, 0.34), (0.0, 0.004, 0.045), lens=70, fstop=3.2)
        else:
            camera((0.16, -0.30, 0.36), (0.0, 0.004, 0.045), lens=60, fstop=3.2)
    elif SHOT == "macro":
        camera((0.18, -0.26, 0.22), (0.0, 0.0, TOP + 0.02), lens=100, fstop=2.8)
    elif SHOT == "product":  # 3판: 상자 앞 바닥의 단지(앞) · 앰플(뒤 오른쪽)을 눈높이에서 — 초점은 단지 앞 유리 벽
        # 3.1판(Fable 3차 P3-2): 크림 윗면보다 낮게 — 위에서 보면 두꺼운 유리가 크림 윗면을 키워 반구처럼 보였다
        camera((-0.05, -0.34, 0.030), (0.025, 0.0, 0.030), lens=70, fstop=11, focus=0.308)  # 초점은 단지 앞 유리 벽


def render_to(path):
    sc = bpy.context.scene
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


# ── 4판 움직임: 카메라 길 · 모션 블러 · 금가루 ─────────────────────────────────────
def cam_pose(c):
    """움직임표의 구면 카메라 값 → (위치, 돌림 쿼터니언). az 0 = 앞(−y)에서 봄, el = 내려다보는 각."""
    az, el = math.radians(c["az"]), math.radians(c["el"])
    tgt = Vector(c["tgt"])
    loc = tgt + c["d"] * Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    q = (tgt - loc).to_track_quat("-Z", "Y")
    if c.get("roll"):
        q = q @ Quaternion((0.0, 0.0, 1.0), math.radians(c["roll"]))
    return loc, q


def cam_tan(c):
    """화면 반폭 · 반높이의 tan(카메라 공간 금가루를 화면 안에 흩을 때)."""
    half = 18.0 / c["lens"]
    return (half * RES[0] / RES[1], half) if RES[1] > RES[0] else (half, half * RES[1] / RES[0])


def cam_matrix(c):
    loc, q = cam_pose(c)
    return Matrix.Translation(loc) @ q.to_matrix().to_4x4()


def camera_motion(cs):
    """cs = 앞 · 지금 · 뒤 프레임의 카메라 값 — 위치 · 돌림 · 렌즈 · 초점 · 조리개에 프레임 0 · 1 · 2 열쇠(1을 굽는다)."""
    c1 = cs[1]
    cam = camera((0, 0, 0), (0, 0, -1), lens=c1["lens"], fstop=c1["f"], focus=c1["d"])
    cam.rotation_mode = "QUATERNION"
    prev = None
    for k, c in enumerate(cs):
        loc, q = cam_pose(c)
        if prev is not None and prev.dot(q) < 0:
            q.negate()
        prev = q
        cam.location, cam.rotation_quaternion = loc, q
        cam.keyframe_insert("location", frame=k)
        cam.keyframe_insert("rotation_quaternion", frame=k)
        cam.data.lens = c["lens"]
        cam.data.keyframe_insert("lens", frame=k)
        cam.data.dof.focus_distance = c.get("focus", c["d"])
        cam.data.dof.aperture_fstop = c["f"]
        cam.data.dof.keyframe_insert("focus_distance", frame=k)
        cam.data.dof.keyframe_insert("aperture_fstop", frame=k)
    return cam


def product_motion(sts):
    """제품 축(단지 · 앰플)에 앞 · 지금 · 뒤 열쇠 — 떠오르는 동안 모션 블러가 걸린다."""
    if not PROD_E:
        return
    je, ae = PROD_E
    now = sts[1]
    for k, s in enumerate(sts):
        for e, key in ((je, "jar"), (ae, "amp")):
            pr = s[key]
            # 카메라 2판: 화면 밖에서 바닥 자리로 옮기는 프레임은 앞뒤 열쇠를 잇지 않는다(옛 자리와 새 자리 사이 긴 번짐이 화면을 가로지른다)
            if (Vector(pr[0]) - Vector(now[key][0])).length > 0.08:
                pr = now[key]
            e.location = pr[0]
            e.rotation_euler = tuple(math.radians(v) for v in prod_rot(pr))
            e.keyframe_insert("location", frame=k)
            e.keyframe_insert("rotation_euler", frame=k)


def _outline(q, kind):
    """금가루 한 조각의 2D 꼴(반지름 1): flake 찢긴 금박 다각형 · star 여섯 갈래 별(서리 결정) · snow 눈 조각."""
    if kind == "star":
        return [((1.0 if k % 2 == 0 else 0.40) * math.cos(math.pi * k / 6),
                 (1.0 if k % 2 == 0 else 0.40) * math.sin(math.pi * k / 6)) for k in range(12)]
    n = q.randint(5, 7) if kind == "flake" else 6
    a0 = q.uniform(0, 2 * math.pi)
    squash = q.uniform(0.45, 1.0) if kind == "flake" else 1.0
    pts = []
    for k in range(n):
        a = a0 + 2 * math.pi * k / n + q.uniform(-0.25, 0.25)
        r = q.uniform(0.55, 1.0) if kind == "flake" else q.uniform(0.8, 1.0)
        pts.append((r * math.cos(a), r * math.sin(a) * squash))
    return pts


class Mote:
    """금가루 · 눈 한 알. pose(t) → (자리, 돌림, 크기 0~1). cam=True면 자리가 카메라 공간(렌즈 앞)이다."""

    def __init__(self, q, kind, size, pos, alive, cam=False, spin=None, soft=False):
        self.kind, self.size, self.pos, self.alive, self.cam, self.soft = kind, size, pos, alive, cam, soft
        self.outline = _outline(q, kind)
        ax = Vector((q.uniform(-1, 1), q.uniform(-1, 1), q.uniform(-1, 1)))
        self.axis = ax.normalized() if ax.length > 1e-6 else Vector((0, 0, 1))
        self.a0 = q.uniform(0, 2 * math.pi)
        self.spin = spin if spin is not None else q.uniform(4.0, 14.0) * (1 if q.random() < 0.5 else -1)
        self.tilt = Matrix.Rotation(q.uniform(0, math.pi), 3, Vector((q.uniform(-1, 1), q.uniform(-1, 1), 1)).normalized())

    def pose(self, t):
        p, turn, s = self.pos(t), self.spin_at(t), self.alive(t)
        return p, Matrix.Rotation(self.a0 + turn, 3, self.axis) @ self.tilt, s

    def spin_at(self, t):
        return self.spin * t


def _kind(q, snow=0.12, star=0.18):
    r = q.random()
    return "snow" if r < snow else ("star" if r < snow + star else "flake")


def _size(q, kind, k=1.0):
    return k * {"flake": q.uniform(0.0008, 0.0022), "star": q.uniform(0.0016, 0.0030),
                "snow": q.uniform(0.0006, 0.0014)}[kind]


def motes_burst(t0, n=650, seed=401):
    """뚜껑 앞이 들리는 순간 앞 틈에서 금가루 · 눈이 터져 화면 오른쪽 아래(앞 · +x)로 쏟아지고, 일부는 위로 피었다가
    천천히 내려앉는다(공기 저항 + 약한 무게 — 바닥에 닿으면 멎는다). 원본 3.84–4.96초 「오른쪽 아래로 금가루」."""
    out = []
    for i in range(n):
        q = random.Random(seed * 1000 + i)
        tb = t0 + 0.50 * q.random() ** 1.7
        p0 = Vector((q.uniform(-0.078, 0.078), -0.097 + q.uniform(-0.003, 0.003), 0.100 + q.uniform(0.0, 0.012)))
        early = 1.0 - (tb - t0) / 0.50
        v0 = Vector((q.uniform(-0.06, 0.34), -q.uniform(0.16, 0.48), q.uniform(0.06, 0.36) + 0.40 * early * q.random()))
        kd, g = q.uniform(1.4, 3.0), q.uniform(0.16, 0.42)
        sw = (q.uniform(0.003, 0.010), q.uniform(1.5, 3.5), q.uniform(0, 6.3))
        kind = _kind(q, snow=0.08, star=0.20)
        size = _size(q, kind, 1.5)

        def pos(t, p0=p0, v0=v0, kd=kd, g=g, sw=sw, tb=tb, size=size):
            tau = max(0.0, t - tb)
            e = (1 - math.exp(-kd * tau)) / kd
            gk = Vector((0.0, 0.0, -g / kd))
            p = p0 + gk * tau + (v0 - gk) * e
            ramp_in = 1 - math.exp(-2.0 * tau)
            p.x += sw[0] * math.sin(sw[1] * tau + sw[2]) * ramp_in
            p.y += sw[0] * math.cos(0.7 * sw[1] * tau + sw[2]) * ramp_in
            p.z = max(p.z, 0.0004 + size * 0.3)
            return p

        m = Mote(q, kind, size, pos, lambda t, tb=tb: smooth(tb, tb + 0.06, t))
        m.spin_at = lambda t, m=m, tb=tb: m.spin * (1 - math.exp(-0.8 * max(0.0, t - tb))) / 0.8  # 내려앉으며 멎는다
        out.append(m)
    return out


def motes_sweep(t0, t1, n=900, seed=402):
    """상자 위를 낮게 지나는 금가루(샷표 4절 ⑧): 왼쪽에서 오른쪽으로 물결치는 띠가 열린 상자 위 5 cm를 지나간다
    (원본 5.0–7.0초 「바닥 위 금가루 사이를 지나감」의 자리)."""
    out = []
    for i in range(n):
        q = random.Random(seed * 1000 + i)
        s = q.random()
        r = (0.016 + 0.050 * s) * math.sqrt(q.random())
        th = q.uniform(0, 2 * math.pi)
        ph = q.uniform(-0.4, 0.4)
        kind = _kind(q, snow=0.06, star=0.22)
        size = _size(q, kind, 2.0)

        def pos(t, s=s, r=r, th=th, ph=ph):
            x = -0.62 + 1.45 * (t - t0) / (t1 - t0) - 0.55 * s
            y = -0.055 + 0.040 * math.sin(2 * math.pi * 1.3 * x + ph) + r * math.cos(th + 3 * t)
            z = 0.145 + 0.028 * math.sin(2 * math.pi * 1.0 * x + 0.6) + r * math.sin(th + 3 * t) + 0.025 * s
            return Vector((x, y, z))

        def alive(t, pos=pos):
            x = pos(t).x
            return smooth(t0, t0 + 0.05, t) * (1 - smooth(t1 - 0.25, t1, t)) * smooth(-0.62, -0.50, x) * (1 - smooth(0.62, 0.75, x))

        out.append(Mote(q, kind, size, pos, alive))
    return out


def motes_ambient(t0, t1, cx=0.0, n=220, seed=403):
    """제품이 소개되는 동안 화면 구석구석 떠다니는 작은 금빛 별 · 눈(원본 「병이 소개되는 내내」). 제품 앞자리는 비운다.
    카메라 2판: 제품이 서는 바닥 자리(cx) 둘레로."""
    out = []
    i = 0
    while len(out) < n:
        q = random.Random(seed * 1000 + i)
        i += 1
        base = Vector((cx + q.uniform(-0.28, 0.28), q.uniform(-0.24, 0.30), q.uniform(0.01, 0.40)))
        if -0.12 < base.x - cx < 0.30 and -0.20 < base.y < 0.10 and base.z < 0.16:   # 단지가 오른쪽에서 미끄러져 오는 길까지 비운다
            continue
        drift = Vector((q.uniform(-0.010, 0.010), q.uniform(-0.010, 0.010), -q.uniform(0.004, 0.012)))
        sw = (q.uniform(0.002, 0.007), q.uniform(0.5, 1.4), q.uniform(0, 6.3))
        kind = _kind(q, snow=0.30, star=0.40)
        size = _size(q, kind, 1.2)

        def pos(t, base=base, drift=drift, sw=sw):
            return base + drift * (t - t0) + Vector((sw[0] * math.sin(sw[1] * t + sw[2]),
                                                     sw[0] * math.cos(0.8 * sw[1] * t + sw[2]), 0.0))

        out.append(Mote(q, kind, size, pos, lambda t: smooth(t0, t0 + 0.6, t) * (1 - smooth(t1 - 0.2, t1, t)),
                        spin=q.uniform(0.6, 2.0)))
    return out


def motes_cloud(t0, t1, xa, xb, n=900, seed=406):
    """카메라 2판: 원본 5.2–6.4초처럼 카메라가 옆으로 빠르게 지나며 금가루 사이를 뚫고 간다 — 상자와 제품 자리 사이 바닥 위
    (x xa~xb)에 떠 있는 금가루 구름. 천천히 내리며 돌고, 시작 · 끝 0.25초에 옅어진다.
    원본의 별 조각은 화면 폭의 5 %쯤으로 크고 초점 안에 촘촘했다 — 1차 2판(앞뒤 75 cm · 높이 60 cm에 흩고 1.6배)은 대부분 초점
    밖 작은 점이라 비어 보였다. 겨냥점 앞뒤(−25~+15 cm) · 낮게(40 cm 아래)로 모으고 3배로, 별을 반쯤."""
    out = []
    for i in range(n):
        q = random.Random(seed * 1000 + i)
        base = Vector((q.uniform(xa, xb + 0.2), q.uniform(-0.25, 0.15), 0.005 + 0.395 * q.random() ** 1.6))
        drift = Vector((q.uniform(-0.02, 0.02), q.uniform(-0.02, 0.02), -q.uniform(0.01, 0.04)))
        sw = (q.uniform(0.003, 0.010), q.uniform(1.0, 2.5), q.uniform(0, 6.3))
        kind = _kind(q, snow=0.10, star=0.45)
        size = _size(q, kind, 3.0)

        def pos(t, base=base, drift=drift, sw=sw):
            p = base + drift * (t - t0) + Vector((sw[0] * math.sin(sw[1] * t + sw[2]), sw[0] * math.cos(sw[1] * t + sw[2]), 0.0))
            p.z = max(p.z, 0.0006)
            return p

        out.append(Mote(q, kind, size, pos, lambda t: smooth(t0, t0 + 0.25, t) * (1 - smooth(t1 - 0.25, t1, t)), soft=True))
    return out


def motes_cover(t0, t1, n=220, seed=404):
    """닫힘 머리: 화면을 덮은 금가루가 돌며 바깥으로 흩어져 걷힌다(원본 17초 판 12.0초 금가루 소용돌이).
    자리는 카메라 공간 — 화면 비율(가로 · 세로 tan)에 맞춰 펼친다. 카메라 2판(Fable 3차 P3-1): 원본은 별 조각이 초점 안에서
    돈다 — 렌즈 바로 앞(3.5~30 cm)은 모두 큰 보케 원판이라 금가루보다 빛 번짐으로 읽혀, 초점면(53 cm) 앞 40~52 cm에 3배 크기로."""
    out = []
    for i in range(n):
        q = random.Random(seed * 1000 + i)
        depth = 0.40 + 0.12 * q.random()
        nx, ny = q.uniform(-1.15, 1.15), q.uniform(-1.15, 1.15)
        w = q.uniform(0.6, 1.6) * (1 if q.random() < 0.7 else -1)
        kind = _kind(q, snow=0.05, star=0.45)
        size = _size(q, kind, 3.0)

        def pos(t, depth=depth, nx=nx, ny=ny, w=w):
            x = (t - t0) / (t1 - t0)
            grow = 1.0 + 2.4 * max(0.0, x) ** 2
            a = w * (t - t0)
            X = (nx * math.cos(a) - ny * math.sin(a)) * grow
            Y = (nx * math.sin(a) + ny * math.cos(a)) * grow - 0.5 * x
            return Vector((X, Y, depth))      # 화면 비율로 바꾸는 것은 gold_dust가 한다

        out.append(Mote(q, kind, size, pos, lambda t: 1.0 - smooth(t1 - 0.15, t1, t), cam=True))
    return out


def motes_lens(t0, t1, n=8, seed=405):
    """금가루 띠가 지나갈 때 렌즈 바로 앞을 가로지르는 큰 조각(원본 5.0–7.0초 「큰 조각이 렌즈 앞으로」)."""
    out = []
    for i in range(n):
        q = random.Random(seed * 1000 + i)
        depth = q.uniform(0.05, 0.14)
        tc = q.uniform(t0 + 0.1, t1 - 0.3)
        y0 = q.uniform(0.45, 0.95) * (1 if q.random() < 0.5 else -1)   # 화면 가운데(제품 자리)는 피한다
        sp = q.uniform(1.2, 2.0)
        kind = "star" if q.random() < 0.35 else "flake"
        size = _size(q, kind, 3.0)

        def pos(t, depth=depth, tc=tc, y0=y0, sp=sp):
            return Vector(((t - tc) * sp, y0 + 0.25 * (t - tc), depth))

        out.append(Mote(q, kind, size, pos, lambda t, tc=tc: smooth(tc - 0.9, tc - 0.8, t) * (1 - smooth(tc + 0.8, tc + 0.9, t)),
                        cam=True, soft=True))
    return out


def mat_gold_dust(glow=1.6, tint=(1.0, 0.60, 0.20), rough=0.20):
    """금가루: 금속 금 + 약한 제 빛(밤 장면에서 반사할 것이 없는 면도 금빛으로 읽히게)."""
    m, n, l, out = new_mat(f"gold_dust_{glow}")
    b = principled(n, base=(1.0, 0.70, 0.28), metal=1.0, rough=rough, emit=tint, emit_s=glow)
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def gold_dust(sts):
    """금가루 · 눈을 메시 하나로: 지금 프레임 자리가 바탕, 앞 · 뒤 프레임 자리는 모양 열쇠(프레임 0 · 2) — 모션 블러로 번진다."""
    ev = sts[1]["dust"]
    t1 = sts[1]["t"]
    motes = []
    # 끝 보강(10-28): 닫힘에서는 열림 때 바닥에 내려앉은 금가루 더미를 뺀다 — 카메라가 이름에 멎자 화면 아래 40 %를 덮어 상자와
    # 다퉜다(원본 닫힘 바닥은 몇 알뿐)
    if "burst" in ev and t1 >= ev["burst"] and SHOT != "top":
        motes += motes_burst(ev["burst"], n=650 if FILM == "15" else 520)
    if "sweep" in ev and ev["sweep"][0] <= t1 <= ev["sweep"][1]:
        motes += motes_sweep(*ev["sweep"]) + motes_lens(*ev["sweep"])
    if "cloud" in ev and ev["cloud"][0] <= t1 <= ev["cloud"][1]:
        motes += motes_cloud(*ev["cloud"]) + motes_lens(*ev["cloud"][:2])
    if "ambient" in ev and ev["ambient"][0] <= t1 <= ev["ambient"][1]:
        motes += motes_ambient(*ev["ambient"])
    if "cover" in ev and ev["cover"][0] <= t1 <= ev["cover"][1]:
        motes += motes_cover(*ev["cover"])
    if not motes:
        return None
    cams = [cam_matrix(s["cam"]) for s in sts]
    tans = [cam_tan(s["cam"]) for s in sts]
    keep = [m for m in motes if any(m.alive(s["t"]) > 0.001 for s in sts)]
    if not keep:
        return None
    coords = [[], [], []]
    faces, mats = [], []
    for m in keep:
        base = len(coords[0])
        for k, s in enumerate(sts):
            p, rot, sc = m.pose(s["t"])
            if m.cam:
                tx, ty = tans[k]
                p = cams[k] @ Vector((p.x * p.z * tx, p.y * p.z * ty, -p.z))
            r = m.size * max(sc, 0.0)
            for (ox, oy) in m.outline:
                coords[k].append(p + rot @ Vector((ox * r, oy * r, 0.0)))
        faces.append(list(range(base, base + len(m.outline))))
        mats.append(1 if m.kind == "snow" else (2 if m.soft else 0))
    me = bpy.data.meshes.new("금가루")
    me.from_pydata([tuple(v) for v in coords[1]], [], faces)
    me.materials.append(mat_gold_dust())
    me.materials.append(mat_simple("snow_fleck", base=(0.96, 0.97, 1.0), rough=0.35, emit=(0.85, 0.90, 1.0), emit_s=0.35))
    # 렌즈 바로 앞 큰 조각: 화면 반을 덮는 보케라 제 빛을 줄이고 더 짙은 금으로. 거칠기 0.6 — 0.2에서는 구르다 키 빛의
    # 거울 각에 닿는 한 프레임만 면광을 통째로 비춰 보케 원판이 순백으로 번쩍였다(Fable 움직임 2차 P2-1)
    me.materials.append(mat_gold_dust(0.6, (1.0, 0.55, 0.16), rough=0.6))
    me.polygons.foreach_set("material_index", mats)
    ob = link(bpy.data.objects.new("금가루", me))
    ob.shape_key_add(name="Basis")
    for name, k, keys in (("앞", 0, ((0, 1.0), (1, 0.0))), ("뒤", 2, ((1, 0.0), (2, 1.0)))):
        kb = ob.shape_key_add(name=name, from_mix=False)
        kb.data.foreach_set("co", [c for v in coords[k] for c in v])
        for fr, val in keys:
            kb.value = val
            kb.keyframe_insert("value", frame=fr)
    for attr in ("use_motion_blur", "use_deform_motion"):
        try:
            setattr(ob.cycles, attr, True)
        except Exception:
            pass
    return ob


def parse_frames(s, n):
    if not s:
        return list(range(n))
    out = []
    for part in s.split(","):
        if "-" in part:
            a, b = part.split("-")
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


def film_main():
    """움직임표.py의 컷대로 프레임을 하나씩 짓고 굽는다(블렌더 한 번에 여러 프레임, 있는 프레임은 건너뜀)."""
    global SHOT, RISE, PROD, HERO_X, PRINT_X, RIM_FADE, LID_OUT, T, SAMPLES, CAMC, SWEEP
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import 움직임표 as M
    orient = "v" if RES[1] > RES[0] else "h"
    SWEEP = M.SWEEP.get(FILM)
    d = arg("--out", os.path.join(밖, "움직임", f"{FILM}초_{'세로' if orient == 'v' else '가로'}"))
    os.makedirs(d, exist_ok=True)
    still = M.STILL_FROM[FILM]
    for f in parse_frames(FRAMES, M.LEN[FILM]):
        out = os.path.join(d, f"{f:04d}.png")
        st = M.state(FILM, orient, f)
        if st["scene"] == "black" or (still is not None and f > still) or (os.path.exists(out) and "--force" not in argv):
            continue
        sts = [M.state(FILM, orient, f, -1.0 / M.FPS), st, M.state(FILM, orient, f, 1.0 / M.FPS)]
        SHOT, LID_OUT, T, CAMC = st["scene"], st["lid_out"], st["t"], st["cam"]
        set_u(st["u"])
        PROD = {"jar": st["jar"], "amp": st["amp"]}
        HERO_X = st["hero"] if SHOT == "open" else None
        PRINT_X = st["print_x"] if SHOT == "open" else None
        RIM_FADE = st["rim_fade"] if SHOT == "open" else None
        RISE = 1.0 if st["jar"][0][2] > JAR_Z + 0.005 or abs(st["jar"][0][0] - JAR[0]) > 0.005 else 0.0
        if "--samples" not in argv:
            SAMPLES = st["samples"]
        build()
        sc = bpy.context.scene
        bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
        sc.render.fps = M.FPS
        sc.frame_start, sc.frame_end = 0, 2
        camera_motion([s["cam"] for s in sts])
        product_motion(sts)
        gold_dust(sts)
        if SHOT == "top":
            floor_alone()
        sc.render.use_motion_blur = True
        sc.render.motion_blur_shutter = st["shutter"]
        sc.frame_set(1)
        render_to(out)
        print("RENDERED", out, f"u={st['u']:.3f} t={st['t']:.3f}")


def main():
    global RISE
    if FILM:
        film_main()
        return
    if CAM:
        # 한 장 시험 카메라: az,el,d,x,y,z,lens[,f] — ⑦ 높이 시험 · 장면 스틸
        v = [float(x) for x in CAM.split(",")]
        build()
        c = dict(az=v[0], el=v[1], d=v[2], tgt=(v[3], v[4], v[5]), lens=v[6], f=v[7] if len(v) > 7 else 5.6, roll=0.0)
        loc, _ = cam_pose(c)
        camera(tuple(loc), c["tgt"], lens=c["lens"], fstop=c["f"], focus=c["d"])
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        render_to(OUT)
        print("RENDERED", OUT)
        return
    if SEQ:
        # 3판: 0~1 리본 · 뚜껑, 1~1.25 제품이 떠오름(원본 1위의 「병이 하나씩 날아오름」) — 마지막 20 %가 떠오름
        d = os.path.join(밖, "움직임", f"{SHOT}_{LOOK}")
        os.makedirs(d, exist_ok=True)
        for i in range(SEQ):
            t = 1.25 * i / (SEQ - 1)
            set_u(min(t, 1.0))
            RISE = smooth(1.0, 1.25, t)
            build()
            shots()
            render_to(os.path.join(d, f"{i:04d}.png"))
        print("RENDERED SEQ", d)
        return
    build()
    shots()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if SAVE:
        bpy.ops.wm.save_as_mainfile(filepath=OUT.replace(".png", ".blend"))
    render_to(OUT)
    print("RENDERED", OUT)


if __name__ == "__main__":
    main()

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
# 단위 m.
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

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
    """진주빛 흰 판지 — 뚜껑 윗면은 서리꽃 엠보(0.2 mm), 앞 옆띠에 금박 이름(0.1 mm 돋움)."""
    m, n, l, out = new_mat(name)
    paper = principled(n, base=(0.90, 0.902, 0.92), rough=0.52, sheen=0.3, sheen_tint=(0.95, 0.95, 1.0),
                       coat=0.06, coat_rough=0.3, film=120.0, film_ior=1.4)
    foil = principled(n, base=(0.66, 0.44, 0.15), metal=1.0, rough=0.24)  # 3판: 짙은 금 — 흰 판지 위에서 글자가 서고 역광에서 번쩍
    mix = n.new("ShaderNodeMixShader")
    l.new(paper.outputs[0], mix.inputs[1])
    l.new(foil.outputs[0], mix.inputs[2])
    grain = paper_grain(n, l)
    if lid:
        top = normal_mask(n, l, "Z", 1)
        front = normal_mask(n, l, "Y", -1)
        emb = planar_tex(n, l, img("뚜껑_엠보2.png"), L_HALF, "Z")
        name_t = planar_tex(n, l, img("뚜껑앞_금박.png"), L_HALF, "Y", z0=TOP - L_H, h=L_H)
        foil_fac = math_node(n, l, "MULTIPLY", front, name_t.outputs["Color"])
        l.new(foil_fac, mix.inputs["Fac"])
        height = math_node(n, l, "ADD", math_node(n, l, "MULTIPLY", top, emb.outputs["Color"]),
                           math_node(n, l, "MULTIPLY", foil_fac, 0.5))
        bump = n.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.7
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
    b = principled(n, base=(0.70, 0.45, 0.16), metal=0.3, rough=0.24, aniso=0.85, sheen=0.6, sheen_rough=0.35,
                   sheen_tint=(1.0, 0.80, 0.48))
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
    lift = math.sin(math.pi * min(1.0, peel * 1.15))  # 일어서는 동안 휨이 크다가 다 서면 줄어든다
    for k in range(1, nt + 1):
        s = k / nt
        alpha = ph1 - math.radians(38) * lift * s * s - math.radians(55) * peel * max(0.0, s - 0.72) / 0.28 * (1 - K_FALL * 0.6)
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
    tw = [math.radians(14) * math.sin(math.pi * peel) * (i / Ltot) * (1 if dx + dy > 0 else -1) for i in range(len(pts))]
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
        Ls, Hs = 0.072 * s, 0.030 * s
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


def products(jar_at=None, amp_at=None):
    """jar_at · amp_at: (x, y, 바닥 z). 없으면 인서트 홈 자리. product 컷은 상자 앞 바닥에 둔다."""
    glass = mat_glass("glass_heavy")
    gold = mat_simple("gold_cap", base=GOLD, metal=1.0, rough=0.16)
    # 3판(Fable 2차 P3-1): 흰 고무 캡슐이 알약처럼 읽혀 — 작게(지름 1.3 cm · 높이 1.7 cm) · 허리 · 둥근 윗면 · 실리콘 아이보리
    rubber = mat_simple("rubber_bulb", base=(0.90, 0.85, 0.78), rough=0.42, sss=0.3, sss_r=(0.004, 0.0035, 0.003),
                        coat=0.25, coat_rough=0.3)
    cream = mat_simple("cream", base=(0.97, 0.955, 0.93), rough=0.32, sss=0.6, sss_r=(0.006, 0.006, 0.005))
    # 크림 단지: 두꺼운 유리(벽 5 mm · 바닥 12 mm · 어깨 둥금) + 둥근 크림 + 금 목 고리 + 금 뚜껑
    jx, jy, jz = jar_at or (JAR[0], JAR[1], JAR_Z + 0.095 * smooth(0.0, 0.8, RISE))  # 3.1판: 밑에 틈이 보이게 더 높이
    jar = revolve("단지", [(0.0, 0.0), (0.0330, 0.0), (0.0352, 0.0012), (0.0360, 0.0040), (0.0360, 0.0400),
                           (0.0356, 0.0428), (0.0346, 0.0450), (0.0330, 0.0462), (0.0310, 0.0462), (0.0310, 0.0150),
                           (0.0300, 0.0128), (0.0280, 0.0120), (0.0, 0.0120)], mat=glass)
    jar.location = (jx, jy, jz)
    # 3판: 크림이 안쪽 벽까지 차게(두꺼운 유리가 가운데를 키워 흰 공 · 달걀처럼 보였다) — 윗면만 낮은 둔덕
    # 3.1판(Fable 3차 P3-2): 그래도 반구로 읽혔다 — 크림과 안쪽 벽 사이 0.1 mm 공기층에서 옆쪽 빛이 전반사돼 가장자리 크림이
    # 안 보였다. 실제 크림은 유리에 붙어 있으니 안쪽 벽 · 바닥을 0.2 mm 파고들게(광학 접촉) 하고, 유리 어깨 바로 아래까지 채운다
    cr = revolve("크림", [(0.0, 0.0118), (0.0302, 0.0118), (0.0312, 0.0130), (0.0312, 0.0438), (0.0292, 0.0446),
                          (0.0150, 0.0450), (0.0, 0.0451)], mat=cream)
    cr.location = (jx, jy, jz)
    ring = revolve("목고리", [(0.0330, 0.0), (0.0366, 0.0), (0.0366, 0.0018), (0.0330, 0.0018)], mat=gold)
    ring.location = (jx, jy, jz + 0.0455)
    jl = revolve("단지뚜껑", [(0.0, 0.0), (0.0368, 0.0), (0.0373, 0.0020), (0.0373, 0.0150), (0.0362, 0.0168),
                              (0.0300, 0.0172), (0.0, 0.0172)], mat=mat_jar_lid())
    jl.location = (jx, jy, jz + 0.0470)
    # 앰플: 네모 유리병(벽 3 mm · 바닥 8 mm, 3판 높이 4.2 cm) · 액 70 % · 금 목 · 실리콘 스포이드
    ax, ay, az = amp_at or (AMP[0], AMP[1], AMP_Z + 0.085 * smooth(0.2, 1.0, RISE))
    amp_glass = mat_print("amp_print", "앰플_흰잉크.png", half=0.020, axis="Y", z0=-0.009, h=0.036)
    rounded_box("앰플병", 0.040, 0.040, AMP_H, (ax, ay, az + AMP_H / 2), amp_glass, bevel=0.005)
    liq_h = (AMP_H - 0.008 - 0.004) * 0.70
    rounded_box("앰플액", 0.0338, 0.0338, liq_h, (ax, ay, az + 0.008 + liq_h / 2), mat_serum(), bevel=0.003)
    neck = revolve("앰플목", [(0.0, 0.0), (0.0105, 0.0), (0.0108, 0.0010), (0.0108, 0.0090), (0.0100, 0.0100),
                              (0.0, 0.0100)], mat=gold)
    neck.location = (ax, ay, az + AMP_H)
    bulb = revolve("스포이드", [(0.0, 0.0), (0.0068, 0.0), (0.0070, 0.0022), (0.0058, 0.0040), (0.0064, 0.0075),
                                (0.0066, 0.0110), (0.0058, 0.0145), (0.0038, 0.0163), (0.0, 0.0170)], mat=rubber)
    bulb.location = (ax, ay, az + AMP_H + 0.010)


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
    for _ in range(n):
        r = rnd.uniform(rmin, rmax)
        c = Vector((rnd.uniform(x0, x1), rnd.uniform(y0, y1), rnd.uniform(z0, z1)))
        if abs(c.x) < 0.12 and abs(c.y) < 0.12 and c.z < 0.30:
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


def floor_mat(base, rough, coat, coat_rough):
    """바닥: 거친 광택 + 얇은 서리(미세 범프)."""
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
    l.new(b.outputs[0], out.inputs["Surface"])
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
        rounded_box("바닥", 3.0, 3.0, 0.02, (0, 0, -0.01), floor_mat((0.012, 0.014, 0.024), 0.46, 0.25, 0.35), bevel=0.0)
        crystals(1100, 0.0005, 0.0020, 0.135, 0.85, 0.0002)
        area_light("키", (-0.60, -0.55, 0.60), (0, 0, 0.06), 45, 0.7, rgb=(1.0, 0.82, 0.58))
        # 3판: 역광 70 → 58(일어선 갈래가 역광을 받는 순간 하이라이트가 날아갔다 — 반 스톱쯤) · 채움 6 → 11(오른쪽 옆면 띠가 검게)
        area_light("역광", (0.35, 0.70, 0.35), (0, 0, 0.08), 58, 0.25, rgb=(0.55, 0.70, 1.0))
        area_light("채움", (0.75, -0.40, 0.10), (0, 0, 0.05), 11, 0.6, rgb=(1.0, 0.85, 0.65))
        # 3.1판(Fable 3차 P2-2): 금 뚜껑 윗면이 남색 하늘을 비춰 검은 원판이 됐다 — 뒤 왼쪽 낮은 데 따뜻한 반사판(면광) 하나,
        # 히어로 · 떠오름 카메라에서 윗면에 비치는 방향에 둔다
        # 빛 연결로 금 뚜껑만 받게(build에서 이어 줌) — 그냥 두면 바닥 · 뒤가 밝아져 밤 기운이 빠진다
        global LID_LIGHT
        LID_LIGHT = area_light("뒤금빛", (-0.20, 0.55, 0.26), (0.0, 0.0, 0.12), 14, 0.7, rgb=(1.0, 0.78, 0.45))
        bokeh_lights(70, (0.1, 1.6, 0.35), (1.2, 0.4, 0.35), (1.0, 0.70, 0.32), 22.0)
        snow_particles(220, ((-0.6, 0.6), (-0.3, 0.9), (0.0, 0.7)), 0.0010, 0.0028)
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


def build():
    global LID_LIGHT
    LID_LIGHT = None
    reset()
    set_look()
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
    link_lid_light()
    # (2판의 인서트 위 눈 결정은 뺐다 — 상자 속 티끌로 보였다)
    # 뚜껑: 앞이 먼저 들리고(뒤 모서리 축 −5°) → 위로 떠오르며 뒤로 기운다
    if K_TILT > 0 or K_LID > 0:
        pivot = Vector((0, L_HALF, TOP))
        ang = math.radians(-5) * K_TILT + math.radians(-17) * K_LID
        rot = Matrix.Rotation(ang, 4, "X")
        lift = Matrix.Translation(Vector((0, 0.050 * K_LID, 0.16 * K_LID)))  # 3판: 더 높이 — 떠오르는 제품과 겹치지 않게
        lid.matrix_world = lift @ Matrix.Translation(pivot) @ rot @ Matrix.Translation(-pivot)
    ribbons(mat_satin())
    if K_TILT > 0:
        point_light("속빛", (0, 0.01, 0.075), 1.4 * max(K_TILT, K_LID), (1.0, 0.74, 0.40), radius=0.05)
        if SHOT == "open" and RISE == 0:  # 앞 벽 안쪽에서 제품 앞면을 비춰 두꺼운 유리 속 흰 크림이 보이게(뚜껑 그늘에 묻혔다)
            point_light("속앞빛", (0.0, -0.062, 0.082), 3.2, (1.0, 0.88, 0.70), radius=0.03)
        # 금빛 김: 넓은 컷(hero)에서만 — 상자 속이 짙고 테두리 위 2 cm에서 사라진다(접사 · 열린 상자는 우윳빛이 됐다)
        if SHOT == "hero":
            h = B_H + 0.02 - INS_TOP
            vol = rounded_box("김", 2 * (B_HALF - WALL), 2 * (B_HALF - WALL), h, (0, 0, INS_TOP + h / 2),
                              mat_glow_volume(0.35 * K_LID), bevel=0.0)
            vol.visible_shadow = False
    if SHOT == "open":
        # 차가운 보조광 하나 — 금 뚜껑과 금박 속벽(금 위에 금)을 가르고 유리 모서리를 세운다
        area_light("차가운보조", (-0.34, -0.30, 0.16), (JAR[0], -0.05, 0.06 + 0.06 * RISE), 9, 0.25, rgb=(0.62, 0.76, 1.0))
    elif SHOT == "macro":
        # 공단 결빛: 작고 센 빛 하나가 갈래 · 고리 면에 길이 방향 하이라이트 한 줄을 세운다(Fable 2차 P3-4)
        # 3.1판(Fable 3차 P2-1): 작고 센 빛은 실결을 알갱이로 키웠다 — 긴 면광으로 하이라이트 한 줄만
        area_light("결빛", (-0.16, 0.30, 0.34), (0.0, 0.0, TOP + 0.02), 30, 0.40, rgb=(1.0, 0.93, 0.82), size_y=0.08)


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


def main():
    global RISE
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

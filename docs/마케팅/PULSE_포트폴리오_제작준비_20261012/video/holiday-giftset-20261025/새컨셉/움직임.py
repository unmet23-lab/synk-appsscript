# 기프트 세트 · 안 1 · 2 합친 판 움직임 시험 (2026-10-30, 크레딧 0)
# 유호님 10-30 「안 1 · 2로」 — 대표 두 장면을 블렌더 움직임으로 만들어 명품 홀리데이 광고와 나란히 본다.
#   m1 결정이 자라는 3초 — 안 1 첫 컷(a1)의 결정이 깜깜한 유리 위에서 자라고 카메라가 천천히 다가간다.
#   m2 멈춘 1초를 지나가는 3초 — 얼어붙은 비눗방울 같은 얇은 얼음 껍질이 깨진 순간이 멈추고, 카메라가 조각 · 금빛 세럼
#      방울 · 두 제품 사이로 들어간다(안 2의 「아크릴 큐브 · 흰 플라스틱 조각」을 버린 판 — Fable 10-29).
#   blender -b --python 움직임.py -- --shot m1 [--res 1080x1920] [--samples 160] [--s 0] [--e 89] [--dir 폴더]
# 장면 거리 · 재질은 시안.py를 그대로 가져다 쓴다. GPU는 공용 줄로(_공용차례/README.md 「GPU」).
import math
import os
import random
import sys
import time

import bmesh
import bpy
import numpy as np
from mathutils import Vector, noise

_here = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("--python") + 1]))
sys.path.insert(0, _here)
import 시안 as S  # noqa: E402

SHOT = S.arg("--shot", "m1")
N = 90  # 30fps × 3초
F0, F1 = int(S.arg("--s", "0")), int(S.arg("--e", str(N - 1)))
FRAMES = [int(x) for x in S.arg("--frames", "").split(",") if x] or list(range(F0, F1 + 1))  # 시험: --frames 0,45,89
DIR = S.arg("--dir", os.path.join(S.밖, "움직임", SHOT + ("" if S.RES[0] >= 1000 else "_미리") + ("_cov" + S.arg("--cov", "") if S.arg("--cov", "") else "")))


def smooth(s):
    s = min(1.0, max(0.0, s))
    return s * s * (3 - 2 * s)


def look(cam, loc, tgt, focus=None):
    cam.location = Vector(loc)
    d = Vector(tgt) - Vector(loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    if cam.data.dof.use_dof:
        cam.data.dof.focus_distance = focus if focus else d.length


def render_to(f):
    p = os.path.join(DIR, f"{SHOT}_{f:03d}.png")
    bpy.context.scene.render.filepath = p
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"장 {f} {time.time() - t:.1f}초 → {p}", flush=True)


# ── m1 결정이 자라는 3초 ───────────────────────────────────────────────────────
def growth_t(f):
    """도착 시각 지도의 지금 시각. 처음부터 여섯 갈래 별이 보이게 0.12에서 시작해 마지막 장까지 늦춰 가며 자란다
    (Fable 10-30 P2: 7~8장째에 모양이 멈추고 뒤 1초는 카메라만 흘렀다)."""
    s = min(1.0, f / (N - 1))
    return 0.12 + 0.88 * (1.0 - (1.0 - s) ** 1.25)  # 1.6은 7장째(2초)에 모양이 멎었다(Fable 2차 P2-2)


def plate(h):
    """둥근 관 같던 가지를 얇은 판으로 — 높이 지도를 평평한 판(가장자리만 비탈) + 원래 등뼈로(Fable P1-1: 크림 관 · 자수)."""
    return (0.65 * np.clip((h - 0.02) / 0.10, 0.0, 1.0) ** 0.5 + 0.35 * h).astype(np.float32)


def mat_ice_crystal():
    """얼음 결정 — 판 가운데는 맑은 얼음(굴절 · 약한 분산), 가장자리 · 막 자란 끝(얇은 곳)만 서리 흰빛, 모서리에 반짝임.
    10-30 본 굽기 1판의 a1 재질(흰 투과 + 확산)은 시험관 셋 · Fable 모두 「베이지 무늬판 · 자수 · 크림 · 효과 견본」."""
    m, n, l, out = S.new_mat("얼음결정")
    at = n.new("ShaderNodeAttribute")
    at.attribute_name = "frost"
    edge = n.new("ShaderNodeMapRange")
    edge.interpolation_type = "SMOOTHSTEP"
    edge.inputs["From Min"].default_value = 0.10
    edge.inputs["From Max"].default_value = 0.55
    edge.inputs["To Min"].default_value = 0.55
    edge.inputs["To Max"].default_value = 0.0
    l.new(at.outputs["Fac"], edge.inputs["Value"])
    ice = S.principled(n, base=(0.97, 0.99, 1.0), rough=0.05, ior=1.31, trans=1.0)
    S.setin(ice, "Dispersion", 0.35)
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 9000.0
    l.new(S.madd(n, l, nz.outputs["Fac"], 0.14, -0.02), ice.inputs["Roughness"])
    trl = n.new("ShaderNodeBsdfTranslucent")
    trl.inputs["Color"].default_value = (1.0, 0.96, 0.90, 1)
    dif = n.new("ShaderNodeBsdfDiffuse")
    dif.inputs["Color"].default_value = (0.86, 0.91, 0.98, 1)
    fr = n.new("ShaderNodeMixShader")
    fr.inputs["Fac"].default_value = 0.3
    l.new(trl.outputs[0], fr.inputs[1])
    l.new(dif.outputs[0], fr.inputs[2])
    mix = n.new("ShaderNodeMixShader")
    l.new(edge.outputs["Result"], mix.inputs["Fac"])
    l.new(ice.outputs[0], mix.inputs[1])
    l.new(fr.outputs[0], mix.inputs[2])
    gl = n.new("ShaderNodeBsdfGlossy")
    S.setin(gl, "Roughness", 0.03)
    vor = n.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 3200.0
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.5
    l.new(vor.outputs["Distance"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], gl.inputs["Normal"])
    lw = n.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.3
    gm = n.new("ShaderNodeMixShader")
    l.new(S.math_node(n, l, "MULTIPLY", lw.outputs["Fresnel"], 0.6), gm.inputs["Fac"])
    l.new(mix.outputs[0], gm.inputs[1])
    l.new(gl.outputs[0], gm.inputs[2])
    l.new(S.shadow_pass(n, l, gm.outputs[0], tint=(0.95, 0.97, 1.0)).outputs[0], out.inputs["Surface"])
    return m


def add_sweep(m, direction, width=0.0025, color=(1.0, 0.93, 0.82)):
    """결정 재질에 지나가는 반짝임 띠 — 얇은 가장자리(frost 속성이 낮은 곳)의 잔 반짝임 자리만 빛을 내고, 그 띠가 물체 좌표
    direction 쪽으로 한 번 지나간다(SWEEP_POS · SWEEP_GAIN 값 노드를 장마다 바꾼다). 빛으로 반사를 만들면 유리판 · 뚜껑
    겉에도 그 빛 면이 비쳐 흰 막대가 됐다(15초 2차 시험 m1 70장) — 결정 안에서 빛나게 해 다른 면엔 안 비친다."""
    n, l = m.node_tree.nodes, m.node_tree.links
    out = next(x for x in n if x.type == "OUTPUT_MATERIAL")
    base = out.inputs["Surface"].links[0].from_socket
    tc = n.new("ShaderNodeTexCoord")
    dt = n.new("ShaderNodeVectorMath")
    dt.operation = "DOT_PRODUCT"
    l.new(tc.outputs["Object"], dt.inputs[0])
    dt.inputs[1].default_value = tuple(Vector(direction).normalized())
    pos = n.new("ShaderNodeValue")
    pos.name = "SWEEP_POS"
    pos.outputs[0].default_value = -1.0
    gain = n.new("ShaderNodeValue")
    gain.name = "SWEEP_GAIN"
    gain.outputs[0].default_value = 0.0
    d = S.math_node(n, l, "DIVIDE", S.math_node(n, l, "SUBTRACT", dt.outputs["Value"], pos.outputs[0]), width)
    band = S.math_node(n, l, "EXPONENT", S.math_node(n, l, "MULTIPLY", S.math_node(n, l, "MULTIPLY", d, d), -1.0))
    at = n.new("ShaderNodeAttribute")
    at.attribute_name = "frost"
    thin = n.new("ShaderNodeMapRange")
    thin.inputs["From Min"].default_value = 0.04
    thin.inputs["From Max"].default_value = 0.40
    thin.inputs["To Min"].default_value = 1.0
    thin.inputs["To Max"].default_value = 0.15
    l.new(at.outputs["Fac"], thin.inputs["Value"])
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 1400.0
    l.new(tc.outputs["Object"], nz.inputs["Vector"])
    glit = S.math_node(n, l, "MINIMUM", S.math_node(n, l, "MAXIMUM", S.math_node(n, l, "MULTIPLY",
                                                                                     S.math_node(n, l, "SUBTRACT", nz.outputs["Fac"], 0.5), 5.0), 0.0), 1.0)
    mask = S.math_node(n, l, "MULTIPLY", S.math_node(n, l, "MULTIPLY", thin.outputs["Result"], S.madd(n, l, glit, 0.7, 0.3)),
                       S.math_node(n, l, "GREATER_THAN", at.outputs["Fac"], 0.002))
    em = n.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    l.new(S.math_node(n, l, "MULTIPLY", S.math_node(n, l, "MULTIPLY", band, mask), gain.outputs[0]), em.inputs["Strength"])
    add = n.new("ShaderNodeAddShader")
    l.new(base, add.inputs[0])
    l.new(em.outputs[0], add.inputs[1])
    l.new(add.outputs[0], out.inputs["Surface"])
    return pos, gain


GOLD_BOKEH = [(1.0, 0.60, 0.22), (1.0, 0.72, 0.34), (1.0, 0.50, 0.16)]


def round_bokeh(cam):
    """보케는 둥글게(Fable P2: 팔각 날 · 딱딱한 가장자리)."""
    cam.data.dof.aperture_blades = 0


def shot_m1():
    arr, h = S.load_sim(S.MACRO_SIM, "macro")
    h = plate(h)
    size = 0.032
    S.world_color((0.004, 0.007, 0.020), 0.03)
    S.box("유리", 0.20, S.GL, 0.20, (0, 0, 0), S.mat_glass("창유리"))
    ice_mat = mat_ice_crystal()
    S.box("방어둠", 3.0, 0.05, 3.0, (0, 2.6, 0), S.mat_simple("방어둠", base=(0.03, 0.02, 0.015), rough=0.9))
    tgt = Vector((0.0, S.GL / 2, 0.0))

    def cam_at(s):
        """결정보다 늦게 물러난다 — 화면 폭의 1/6쯤인 별이 끝에 화면을 거의 채운 온 결정이 된다(첫 시험: 다가가면
        끝에 결정이 화면 밖으로 넘쳐 여섯 갈래 모양을 잃고 가지 끝이 짠 크림처럼 보였다)."""
        c = smooth(s)
        az = math.radians(14 - 6 * c)
        dist = 0.085 + 0.065 * c
        return tgt + Vector((math.sin(az) * dist, -math.cos(az) * dist, 0.012 + 0.006 * c))

    # 보케는 밝고 짙은 금빛(Fable P1-2: 올리브빛으로 탁한 원판이 꺼진 전구로 읽혔다). 15초 판(10-30): 작은 공은 흐려지면 어둡고
    # 짙은 주황이 올리브로 떠(Fable 3차 「올리브 보케 하나」) — 가장 작은 공을 키우고 색을 조금 밝게(자리는 같은 난수 그대로)
    S.bokeh_in_view(cam_at(0.5), tgt, 16, 0.8, 1.8, 0.7, [(1.0, 0.66, 0.30), (1.0, 0.74, 0.40), (1.0, 0.58, 0.24)], 4.5,
                    0.010, 0.018, seed=5)  # 0.5 m 앞 보케가 왼쪽 과노출 흰 반원(Fable 2차 P2-1)
    # 어둠 속 결정 촬영처럼 뒤에서 비스듬히 비추는 빛(투과로 보여야 가장자리가 빛난다) — 금빛 하나 · 은빛 하나
    # 화각 밖 45° 넘게 — 0.18 m 뒤 20°에 둔 은빛 역광이 유리 너머로(투과 광선) 보여 첫 장들 왼쪽 흰 반원이 됐다.
    # 비낀 만큼 덜 비춰 결정이 어두워져(밝은 화소 10.7 % → 4.2 %) 세기를 2.5배로
    for nm, loc, e, rgb in (("뒤금", (0.20, 0.10, 0.08), 10.0, (1.0, 0.76, 0.46)), ("뒤은", (-0.20, 0.10, -0.08), 6.5, (0.75, 0.85, 1.0))):
        lt = S.area_light(nm, loc, (0, 0, 0), e, 0.06, rgb=rgb)
        lt.visible_camera = False
    # 카메라 쪽 두 빛은 화면에 안 보이게 — 첫 장들 왼쪽 과노출 흰 반원은 보케가 아니라 이 「찬빛」 원판이었다(3판 시험 장)
    for nm, loc, e, sz, rgb in (("찬빛", (-0.14, -0.05, 0.10), 3.2, 0.03, (0.60, 0.74, 1.0)), ("결빛", (0.10, -0.03, -0.09), 1.0, 0.015, (1.0, 0.90, 0.75))):
        S.area_light(nm, loc, (0, 0, 0), e, sz, rgb=rgb).visible_camera = False
    # 끝 반짝임 — 점광 9 W는 영상에서도 안 보였고(Fable 3차, 밝은 화소 0.05 → 0.08 %), 띠 빛은 유리판에 비쳐 흰 막대가 됐다.
    # 결정의 얇은 가장자리만 빛나는 띠가 왼쪽 아래 → 오른쪽 위로 한 번 지나간다(add_sweep)
    sw_pos, sw_gain = add_sweep(ice_mat, (1.0, 0.0, 0.6))
    cam = S.camera(cam_at(0), tgt, lens=100, fstop=16)
    round_bokeh(cam)
    for f in FRAMES:
        old = bpy.data.objects.get("결정")
        if old:
            me = old.data
            bpy.data.objects.remove(old, do_unlink=True)
            bpy.data.meshes.remove(me)
        S.frost_sheet("결정", S.grown(arr, h, growth_t(f), soft=0.05), size, size, S.GL / 2, 0.00022, ice_mat, z0=0.0)
        # 반짝임이 결정을 가로질러 한 번 지나간다(1.8은 어느 장에도 안 잡혔다). 15초 2판: 45–78장에 끝내고 세기 9 → 5 —
        # 1판은 89장까지 이어져 빛 번짐이 결정 위 「연기 뭉치」로 퍼졌고, 승과 겹치는 디졸브 장에 걸렸다(Fable 1판 2.9초)
        u = max(0.0, (f - 45) / 33.0)
        sw_pos.outputs[0].default_value = -0.022 + 0.044 * smooth(u)
        sw_gain.outputs[0].default_value = 0.0 if u <= 0 or u >= 1 else 5.0 * math.sin(math.pi * u) ** 0.7
        look(cam, cam_at(f / (N - 1)), tgt)
        render_to(f)


# ── m2 멈춘 1초를 지나가는 3초 ─────────────────────────────────────────────────
R_SHELL = 0.105
C = Vector((0.0, 0.0, 0.0))


def m2_cam(s):
    """껍질 밖 0.46 m(첫 장부터 제품이 읽히게 — Fable P1-3)에서 깨진 틈으로 0.30 m까지 들어가며 30° 돈다(제품 앞면 = −y 쪽에서 끝남)."""
    c = smooth(s)
    dist = 0.46 + (0.30 - 0.46) * c
    az = math.radians(-25 + 30 * c)
    el = math.radians(9 - 6 * c)
    return C + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * dist


def m2_target(s):
    return C + Vector((0.0, 0.0, 0.004 + 0.008 * smooth(s)))


def mat_shell(cov_img):
    """얼어붙은 비눗방울 껍질 — 맑은 얼음 위에 잔 결정(carpet 계산)이 서리꽃으로 번진 자리만 젖빛 · 반짝임.
    무늬 좌표는 깨지기 전 자리(orig)라 금을 따라 결정이 잘린다. 첫 시험은 결정이 껍질의 57 %를 덮고 흰빛 투과로 밝혀
    조각이 흰 도자기 · 달걀 껍데기로 읽혔다 → 덜 자란 결정(덮임 약 30 %)을 크게(한 송이 2~3 cm) 얹고, 서리 몫은 80 %까지만."""
    m, n, l, out = S.new_mat("얼음껍질")
    at = n.new("ShaderNodeAttribute")
    at.attribute_name = "orig"
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (0.5, 0.5, 0.5)
    tex = n.new("ShaderNodeTexImage")
    tex.image = cov_img
    tex.projection = "BOX"
    tex.projection_blend = 0.25
    tex.interpolation = "Cubic"
    tex.extension = "REPEAT"
    l.new(at.outputs["Vector"], mp.inputs["Vector"])
    l.new(mp.outputs["Vector"], tex.inputs["Vector"])
    rng = n.new("ShaderNodeMapRange")
    rng.interpolation_type = "SMOOTHSTEP"
    rng.inputs["From Min"].default_value = 0.10
    rng.inputs["From Max"].default_value = 0.50
    rng.inputs["To Max"].default_value = 0.0  # 서리 색은 빼고 — 흰 도자기 · 꽃무늬 타일 · 금빛 인쇄(Fable P2-3)로 읽혔다. 무늬는 아래 범프로만
    l.new(tex.outputs["Color"], rng.inputs["Value"])
    cov = rng.outputs["Result"]
    # 서리 = 젖빛 유리(얇게 언 막의 결정 자리) — 2차 시험: 흰 투과 · 확산 서리가 뒤 금빛 판을 받아 꽃무늬 도자기로 읽혔다
    fm = S.principled(n, base=(0.96, 0.98, 1.0), rough=0.22, ior=1.31, trans=1.0)
    ice = S.principled(n, base=(0.97, 0.99, 1.0), rough=0.012, ior=1.31, trans=1.0)
    S.setin(ice, "Dispersion", 0.3)
    bp = n.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.35
    bp.inputs["Distance"].default_value = 0.0006
    l.new(tex.outputs["Color"], bp.inputs["Height"])
    l.new(bp.outputs["Normal"], ice.inputs["Normal"])
    mix = n.new("ShaderNodeMixShader")
    if S.arg("--cov", ""):  # 진단: 0 = 모두 맑은 얼음, 1 = 모두 서리
        mix.inputs["Fac"].default_value = float(S.arg("--cov", "0"))
    else:
        l.new(cov, mix.inputs["Fac"])
    l.new(ice.outputs[0], mix.inputs[1])
    l.new(fm.outputs[0], mix.inputs[2])
    gl = n.new("ShaderNodeBsdfGlossy")
    S.setin(gl, "Roughness", 0.04)
    vor = n.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 2600.0
    l.new(at.outputs["Vector"], vor.inputs["Vector"])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.5
    l.new(vor.outputs["Distance"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], gl.inputs["Normal"])
    lw = n.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.25
    gmix = n.new("ShaderNodeMixShader")
    l.new(S.math_node(n, l, "MULTIPLY", lw.outputs["Fresnel"], S.math_node(n, l, "MULTIPLY", cov, 2.0, clamp=True)),
          gmix.inputs["Fac"])
    l.new(mix.outputs[0], gmix.inputs[1])
    l.new(gl.outputs[0], gmix.inputs[2])
    l.new(S.shadow_pass(n, l, gmix.outputs[0], tint=(0.92, 0.95, 1.0)).outputs[0], out.inputs["Surface"])
    return m


def mat_break():
    """깨진 면 — 맑은 얼음에 잔물결(조개껍질 꼴 깨짐) 범프, 모서리가 빛을 받아 반짝인다."""
    m, n, l, out = S.new_mat("깨진면")
    b = S.principled(n, base=(0.96, 0.985, 1.0), rough=0.03, ior=1.31, trans=1.0)
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 520.0
    nz.inputs["Detail"].default_value = 3.0
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.0004
    l.new(nz.outputs["Fac"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    l.new(S.shadow_pass(n, l, b.outputs[0], tint=(0.92, 0.95, 1.0)).outputs[0], out.inputs["Surface"])
    return m


def shell_cover():
    """carpet4096 잔 결정 1,279개를 껍질 무늬로 — 다 자란 지도를 반으로 줄여 16비트 PNG."""
    arr = np.load(os.path.join(S.결정, "carpet4096", "window_arrival.npy"))[::2, ::2]
    h = np.load(os.path.join(S.결정, "carpet4096", "window_height.npy"))[::2, ::2]
    g = S.grown(arr, h, 0.50, soft=0.08)  # 결정끼리 막 닿은 무렵 — 별 모양 송이가 아니라 고사리 그물(0.25는 「꽃무늬」로 읽힘)
    g = g / max(1e-6, float(np.percentile(g[g > 0], 99)))
    return S.height_image("얼음껍질_서리", np.clip(g, 0, 1))


def shell_pieces(n_seed=30, n_cluster=110, toward=None, seed=7, gap=0.0007):
    """구 표면 보로노이 — 씨앗이 모두 같은 반지름이라 이웃과의 이등분면이 중심을 지난다. 이웃 18개 면으로 잘라 조각 판을 얻는다.
    고른 씨앗(큰 판)에 깨진 쪽(toward)으로 몰린 씨앗을 더해 조각 크기에 위계를 둔다 — 고른 72조각은 「셀 프랙처 기본값 ·
    솔방울」로 읽혔다(Fable 10-30 P1-3)."""
    rng = random.Random(seed)
    pts = []
    ga = math.pi * (3 - math.sqrt(5))
    for i in range(n_seed):
        z = 1 - 2 * (i + 0.5) / n_seed
        r = math.sqrt(1 - z * z)
        a = i * ga
        p = Vector((r * math.cos(a), r * math.sin(a), z))
        p += Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))) * 0.16
        pts.append(p.normalized())
    if toward is not None:
        for i in range(n_cluster):
            pts.append((toward + Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))) * 0.55).normalized())
    out = []
    for i, p in enumerate(pts):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=128, v_segments=64, radius=R_SHELL)
        near = sorted((q for j, q in enumerate(pts) if j != i), key=lambda q: (q - p).length)[:18]
        for q in near:
            nrm = (q - p).normalized()
            geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=-nrm * gap, plane_no=nrm, clear_outer=True)
        if len(bm.faces) < 3:
            bm.free()
            continue
        for v in bm.verts:  # 얼어붙은 막은 완전한 구가 아니다 — 잔 울퉁불퉁
            v.co *= 1.0 + 0.012 * noise.noise(v.co * 28.0)
        out.append((p, bm))
    return out


def mat_liquid_gold():
    """액체 금 — 금빛을 머금은 유리(속으로 제품이 비침)에 금속 0.3을 섞는다(디올 로르처럼 「액체」가 먼저 읽히게)."""
    m, n, l, out = S.new_mat("액체금")
    g = S.principled(n, base=(1.0, 0.80, 0.42), rough=0.02, ior=1.45, trans=1.0)
    mt = S.principled(n, base=S.GOLD, metal=1.0, rough=0.08)
    mx = n.new("ShaderNodeMixShader")
    mx.inputs["Fac"].default_value = 0.3
    l.new(g.outputs[0], mx.inputs[1])
    l.new(mt.outputs[0], mx.inputs[2])
    v = n.new("ShaderNodeVolumeAbsorption")
    v.inputs["Color"].default_value = (1.0, 0.62, 0.18, 1)
    v.inputs["Density"].default_value = 60.0
    l.new(S.shadow_pass(n, l, mx.outputs[0], tint=(1.0, 0.85, 0.55)).outputs[0], out.inputs["Surface"])
    l.new(v.outputs[0], out.inputs["Volume"])
    return m


def liquid_drop(name, r, pos, tail, mat, seed=0):
    """꼬리 달린 방울 — 구를 꼬리 쪽으로 늘이고 끝을 가늘게, 겉에 잔물결."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=1.0)
    for v in bm.verts:
        z = v.co.z
        if z > 0:  # 위(꼬리 쪽)로 늘이며 가늘게
            v.co.z = z * 2.4
            k = 1.0 - 0.82 * z ** 1.6
            v.co.x *= k
            v.co.y *= k
        v.co *= 1.0 + 0.025 * noise.noise(v.co * 3.0 + Vector((seed, 0, 0)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    ob = S.link(bpy.data.objects.new(name, me))
    ob.scale = (r, r, r)
    ob.location = pos
    ob.rotation_euler = tail.normalized().to_track_quat("Z", "Y").to_euler()
    return ob


def shot_m2():
    sc = bpy.context.scene
    sc.cycles.max_bounces = 16
    sc.cycles.transmission_bounces = 16
    sc.cycles.glossy_bounces = 6
    sc.cycles.sample_clamp_indirect = 8.0
    path = [m2_cam(k / 40) for k in range(41)]

    def path_near(p):
        """카메라 길에서 가장 가까운 점과 거리."""
        best, near = 1e9, path[0]
        for a, b in zip(path, path[1:]):
            ab = b - a
            t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
            q = a + ab * t
            if (q - p).length < best:
                best, near = (q - p).length, q
        return best, near

    def path_dist(p):
        return path_near(p)[0]

    E, T = m2_cam(1.0), m2_target(1.0)
    v_end = (E - C).normalized()
    fwd = (T - E).normalized()
    right = fwd.cross(Vector((0, 0, 1))).normalized()
    up = right.cross(fwd)
    tan_w, tan_h = 10.125 / 40, 18.0 / 40  # 40 mm · 세로 센서 36 mm(1080×1920)의 반 화각

    # 제품 뒤로 넓게 번지는 금빛 — 깜깜한 바탕에선 맑은 얼음 조각이 까만 흑요석으로 읽혔다(고친 판 시험 장). 카메라 · 투과로만
    # 보이고 제품을 비추는 몫은 작게(light). 불가리 2025의 남색 → 금빛 바탕을 견줌.
    S.sky_world((0.003, 0.005, 0.014), (0.010, 0.014, 0.030), (0.003, 0.004, 0.010), 1.0,
                sun_dir=tuple((-v_end + Vector((0, 0, 0.25))).normalized()), sun_rgb=(1.0, 0.62, 0.28),
                core=8.0, core_gain=0.0, halo=40.0, halo_gain=0.30, light=0.35)  # 좁게 — 화각 안에서 가운데만 금빛, 가장자리는 남색(넓으면 고른 갈색 배경지)

    def clear_view(pos, margin=1.25):
        """끝 화면에서 카메라와 제품 사이(앞쪽)에 걸린 것은 가장 가까운 화면 가장자리 밖으로 — 제품을 가리지 않고 테두리가 된다."""
        rel = pos - E
        depth = rel.dot(fwd)
        if not (0.02 < depth < (T - E).length - 0.045):
            return pos
        x, y = rel.dot(right), rel.dot(up)
        lim_x, lim_y = depth * tan_w * margin, depth * tan_h * margin
        if abs(x) >= lim_x or abs(y) >= lim_y:
            return pos
        if lim_x - abs(x) < lim_y - abs(y):
            return pos + right * (math.copysign(lim_x, x if x else 1.0) - x)
        return pos + up * (math.copysign(lim_y, y if y else 1.0) - y)

    def cam_hidden(ob):
        ob.visible_camera = False  # 투과로는 보여야 역광이 얼음 · 세럼을 지난다(hide_from_camera는 투과까지 끈다)
        return ob

    # 껍질 조각
    cov = shell_cover()
    m_shell, m_break = mat_shell(cov), mat_break()
    rng = random.Random(11)
    movers = []
    for k, (p, bm) in enumerate(shell_pieces(toward=v_end)):
        c = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
        me = bpy.data.meshes.new(f"껍질{k}")
        bm.to_mesh(me)
        bm.free()
        orig = me.attributes.new("orig", "FLOAT_VECTOR", "POINT")
        orig.data.foreach_set("vector", np.array([v.co[:] for v in me.vertices], np.float32).ravel())
        for v in me.vertices:
            v.co -= c
        me.materials.append(m_shell)
        me.materials.append(m_break)
        ob = S.link(bpy.data.objects.new(f"껍질{k}", me))
        so = ob.modifiers.new("두께", "SOLIDIFY")
        so.thickness = 0.0035
        so.offset = -1.0
        so.use_even_offset = True
        so.use_rim = True
        so.material_offset_rim = 1
        d = c.normalized()
        push = 0.006 + 0.09 * rng.random() ** 1.3
        if d.dot(v_end) > 0.5:  # 깨진 쪽(카메라 쪽) 조각은 멀리 · 옆으로 터져 껍질에 큰 틈이 열린다
            push = 0.10 + 0.20 * rng.random()
        pos = clear_view(C + c + d * push)
        dist, near = path_near(pos)
        if dist < 0.10:  # 카메라 길에 걸린 조각은 길 옆으로 비킨다 — 곁을 지난 조각이 거친 번짐 · 흰 번짐이 됐다(미리 90장 · Fable 2차 P2-3)
            side = pos - near
            side = side.normalized() if side.length > 1e-6 else d
            pos += side * (0.10 - dist + 0.015)
        rot = Vector((rng.uniform(-0.9, 0.9), rng.uniform(-0.9, 0.9), rng.uniform(-0.9, 0.9)))
        movers.append((ob, pos, rot, d * rng.uniform(0.004, 0.009), Vector([rng.uniform(-1, 1) for _ in range(3)]) * 0.035))
    # 잔 조각 — 얇은 세모 판 130개, 깨진 쪽(카메라 쪽)으로 더 많이(Fable P1-3 위계 · 220개는 「꽉 채운 3D 쇼케이스」 — 시험관 2차)
    for i in range(130):
        d = (Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized() + v_end * 0.6).normalized()
        pos = clear_view(C + d * rng.uniform(R_SHELL * 0.8, R_SHELL * 2.8), margin=1.05)
        if path_dist(pos) < 0.04:
            continue
        sz = rng.uniform(0.002, 0.008)
        bm = bmesh.new()
        vs = [bm.verts.new((sz * math.cos(a) * rng.uniform(0.5, 1.0), sz * math.sin(a) * rng.uniform(0.5, 1.0), 0.0))
              for a in (0.0, 2.1 + rng.uniform(-0.4, 0.4), 4.2 + rng.uniform(-0.4, 0.4))]
        bm.faces.new(vs)
        me = bpy.data.meshes.new(f"잔조각{i}")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(m_break)
        ob = S.link(bpy.data.objects.new(f"잔조각{i}", me))
        so = ob.modifiers.new("두께", "SOLIDIFY")
        so.thickness = 0.0008
        movers.append((ob, pos, Vector([rng.uniform(-3, 3) for _ in range(3)]), d * rng.uniform(0.006, 0.014),
                       Vector([rng.uniform(-1, 1) for _ in range(3)]) * 0.15))
    # 얼음 가루
    dust_m = mat_break()
    for i in range(140):
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized()
        pos = clear_view(C + d * rng.uniform(R_SHELL * 0.95, R_SHELL * 1.9), margin=1.05)
        if path_dist(pos) < 0.03:
            continue
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=0, radius=rng.uniform(0.0004, 0.0016))
        for v in bm.verts:
            v.co.x *= rng.uniform(0.4, 1.6)
            v.co.z *= rng.uniform(0.3, 1.2)
        me = bpy.data.meshes.new(f"가루{i}")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(dust_m)
        ob = S.link(bpy.data.objects.new(f"가루{i}", me))
        movers.append((ob, pos, Vector([rng.uniform(-3, 3) for _ in range(3)]), d * rng.uniform(0.006, 0.012),
                       Vector([rng.uniform(-1, 1) for _ in range(3)]) * 0.2))
    # 금빛 세럼 방울 — 크기 · 자리 · 늘어남이 제각각(첫 시험: 고른 크기로 호를 그린 방울이 금 사슬 팔찌로 읽혔다)
    serum = S.mat_gold("액체금", rough=0.15)  # 액체 금 — 빛을 되비춰 화면에서 가장 밝은 점이 되게(0.06은 어두운 바탕을 비춰 검은 크롬 구슬)
    amp_a, amp_b = Vector((-0.036, -0.010, -0.046)), Vector((-0.020, -0.020, 0.060))
    jar_c0 = Vector((0.028, 0.004, -0.010))

    def clear_of_products(p, gap):
        ab = amp_b - amp_a
        t = max(0.0, min(1.0, (p - amp_a).dot(ab) / ab.length_squared))
        return (p - (amp_a + ab * t)).length > 0.020 + gap and (p - jar_c0).length > 0.048 + gap

    # 액체 금 방울 — 큰 방울 하나(꼬리 · 잔물결) + 작은 둘. 금속 콩 여럿은 「금빛 캡슐 · 초콜릿 금화」(Fable 2차 P1-A)
    gold_liq = mat_liquid_gold()
    for i, (pos, r, tail) in enumerate(((Vector((0.050, -0.062, 0.030)), 0.0068, Vector((0.6, 0.2, -0.75))),
                                       (Vector((-0.072, -0.040, 0.046)), 0.0030, Vector((-0.4, 0.1, -0.9))),
                                       (Vector((0.074, -0.020, -0.050)), 0.0022, Vector((0.5, 0.0, 0.85))))):
        dr = liquid_drop(f"방울{i}", r, pos, tail, gold_liq, seed=i)
        movers.append((dr, pos, Vector(dr.rotation_euler), -tail.normalized() * 0.003, Vector((0, 0, 0))))
    drops = [m[0] for m in movers if m[0].name.startswith(("방울", "잔방울"))]
    dl = S.area_light("방울빛", (0.0, -0.25, 0.35), (0, 0, 0), 25.0, 0.5, rgb=(1.0, 0.86, 0.60))
    dl.visible_camera = False
    S.light_only(dl, drops)  # 방울만 받는 넓은 금빛 — 금 방울이 크게 빛을 되비춘다
    # 두 제품
    jar_e, jp = S.cream_jar((0.028, 0.004, -0.040), (math.radians(26), math.radians(-10), math.radians(20)), relief_step=1)  # 뚜껑이 카메라를 보게(+x 돌림이 윗면을 −y 카메라 쪽으로)(결의 주인공 — Fable 2차 P1-B)
    amp_e, ap = S.ampoule((-0.036, -0.010, -0.046), (math.radians(-9), math.radians(13), math.radians(-24)))
    flake = next(o for o in jp if o.name.startswith("뚜껑결정"))
    jp.remove(flake)
    fz = flake.location.z
    bpy.data.objects.remove(flake, do_unlink=True)
    lid = S.relief_sheet("뚜껑결정판", plate(S.macro_height()), 0.056, 0.044 + 0.0026 + 0.016, 0.00030,
                         S.mat_frost("뚜껑서리", glow=(1.0, 0.95, 0.88), body=1.0, sparkle=1.4), step=1)  # 맑은 얼음 재질은 남색 위에서 흰 가루 덩어리로(시험관 · Fable)
    S.parent_to([lid], jar_e)
    jp.append(lid)
    movers.append((jar_e, jar_e.location.copy(), Vector(jar_e.rotation_euler), Vector((0, 0, 0.0015)),
                   Vector((0.0, 0.0, 0.018))))
    movers.append((amp_e, amp_e.location.copy(), Vector(amp_e.rotation_euler), Vector((0, 0, 0.0012)),
                   Vector((0.0, 0.0, -0.015))))
    end_cam = m2_cam(1.0)
    S.serum_card(amp_e, end_cam, strength=1.3, rgb=(1.0, 0.80, 0.50))  # 뒤 판이 밝으면 세럼이 복숭아색으로 옅다 — 낮춰 호박빛
    cam_hidden(S.area_light("금역광", (0.10, 0.62, 0.36), (0, 0, 0), 85.0, 0.12, rgb=(1.0, 0.70, 0.36)))  # 작고 세게 — 조각 모서리마다 금빛 림
    cam_hidden(S.area_light("은역광", (-0.42, 0.50, -0.10), (0, 0, 0), 35.0, 0.10, rgb=(0.78, 0.86, 1.0)))
    # 키 · 윗빛은 가는 띠 — 4차: 큰 원판 빛이 조각마다 넓게 비쳐 얼음이 흰 타일로 보였다(크리스털 촬영의 띠 조명처럼 가는 선으로)
    cam_hidden(S.area_light("찬키", (-0.55, -0.42, 0.40), (0, 0, 0), 30.0, 0.035, rgb=(0.70, 0.82, 1.0), size_y=0.60))
    cam_hidden(S.area_light("윗빛", (0.08, -0.08, 0.80), (0, 0, 0), 18.0, 0.50, rgb=(1.0, 0.95, 0.90), size_y=0.03))
    for i, (p, e) in enumerate((((0.30, -0.22, 0.18), 9.0), ((-0.24, -0.10, -0.20), 7.0), ((-0.18, -0.30, 0.26), 8.0),
                                ((0.22, 0.10, -0.24), 7.0), ((0.05, -0.35, -0.12), 8.0), ((-0.30, 0.15, 0.20), 6.0))):
        g = S.glint_only(S.point_light(f"반짝{i}", p, e, (1.0, 0.92, 0.80), radius=0.004))
        S.light_only(g, [m[0] for m in movers if m[0].type == "MESH"])  # 반짝임은 조각 · 방울에만 — 단지 겉칠에 흰 얼룩으로 번졌다
    # 보케는 멀리 작게 — 1~2.6 m의 큰 공은 흐려져도 공 모양이 남아 진주알로 읽혔다(3차)
    S.bokeh_in_view(m2_cam(0.5), C, 26, 3.0, 7.0, 0.9, GOLD_BOKEH, 90.0,
                    0.006, 0.015, seed=13)
    cam = S.camera(m2_cam(0), m2_target(0), lens=40, fstop=3.5)
    round_bokeh(cam)
    jar_c = jar_e.location + Vector((0, 0, 0.03))
    lid_top = jar_e.location + jar_e.rotation_euler.to_matrix() @ Vector((0, 0, 0.0628))
    lid_glint = S.glint_only(S.point_light("뚜껑반짝", lid_top + Vector((0.05, -0.08, 0.08)), 0.0, (1.0, 0.95, 0.86), radius=0.003))
    S.light_only(lid_glint, [lid])
    for f in FRAMES:
        s = f / (N - 1)
        for ob, pos, rot, vel, spin in movers:  # 거의 멈춘 시간 — 3초 동안 몇 mm · 몇 도만 흐른다
            ob.location = pos + vel * s
            ob.rotation_euler = rot + spin * s
        loc = m2_cam(s)
        front = jar_c + (loc - jar_c).normalized() * 0.033  # 단지 앞면(이름)에 초점 — 가운데에 맞추니 끝 장에서 이름이 흐렸다
        k = smooth(max(0.0, (s - 0.70) / 0.30))  # 끝 0.9초 — 초점이 이름에서 뚜껑 결정으로 옮겨 간다
        fpt = front.lerp(lid_top, k)
        look(cam, loc, m2_target(s), focus=(fpt - loc).length)
        lid_glint.data.energy = 6.0 * math.sin(math.pi * k) if k > 0 else 0.0
        render_to(f)


def main():
    S.reset()
    os.makedirs(DIR, exist_ok=True)
    {"m1": shot_m1, "m2": shot_m2}[SHOT]()


if __name__ == "__main__":
    main()

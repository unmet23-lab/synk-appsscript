# 기프트 세트 · 안 1 · 2 합친 판 15초 — 승 · 전 · 결 세 숏 (2026-10-30, 크레딧 0)
# 유호님이 움직임 시험 페이지를 보시고 15초로(10-30). 기 0–3초는 움직임.py m1 그대로, 나머지 셋을 이 파일이 굽는다.
#   승 3–6초  카메라가 그 결정에서 물러나면, 결정은 검은 유리 바닥에 놓인 얼음 돔(두 제품을 덮은 얼어붙은 비눗방울) 겉면에
#             있고 서리가 결정에서 돔 전체로 번진다 — Fable 1차가 짚은 가장 위험한 고리(기 → 전)를 한 숏으로.
#   전 6–11초 금이 결정 반대편 앞에서 번쩍 퍼지고 돔이 깨지는 순간 시간이 멈춘다. 제품은 깨짐에 살짝 떠오른 채,
#             카메라가 조각 사이로 들어간다(움직임.py m2를 3 → 5초로, 바닥 · 깨짐 머리를 더함).
#   결 11–15초 시간이 다시 흘러 조각은 화면 밖으로 빠지고, 두 제품이 바닥에 내려앉아 작게 흔들린 뒤 멈춘다. 첫 결정은 조각에서
#             떨어져 내려와 단지 뚜껑 결정에 겹쳐 앉는다(반짝임 · 유리 종). 이름은 멈춘 뒤 후반에서 작게, 마지막 1초는 카메라도
#             멈춘다.
# 2판(10-30 오후, 1판 시험 · Fable 「조건부」 뒤 — 고친 것과 시험은 기획 7-2): 승 서리를 흰 반투명 산란으로 · 돔 안
# 따뜻한 빛 · 금빛 둘레를 카메라에서 돔 너머로, 결 밑동 조각(「석탄」)을 뺌, 뚜껑 결정을 첫 결정 재질로 · 첫 결정이
# 내려와 겹쳐 앉음(opus), 금은 깨지는 자리 둘레만(깨지기 전 장은 온전한 돔으로 가림), 렌즈 앞 · 제품 앞 조각 비우기,
# 금 방울 뺌, 앰플 새김은 앞면 겉에만 옅게.
#   blender -b --python 움직임15.py -- --shot 승|전|결 [--res 1080x1920] [--samples 256] [--s 0 --e 89 | --frames 0,45,89]
# 장면 거리 · 재질은 시안.py · 움직임.py를 가져다 쓴다. GPU는 공용 줄로(_공용차례/README.md 「GPU」).
import math
import os
import random
import sys
import time

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector, noise

_here = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("--python") + 1]))
sys.path.insert(0, _here)
import 시안 as S  # noqa: E402
import 움직임 as M  # noqa: E402

FPS = 30.0
SHOT = S.arg("--shot", "승")
NF = {"승": 90, "전": 150, "결": 120}[SHOT]
F0, F1 = int(S.arg("--s", "0")), int(S.arg("--e", str(NF - 1)))
FRAMES = [int(x) for x in S.arg("--frames", "").split(",") if x] or list(range(F0, F1 + 1))
DIR = S.arg("--dir", os.path.join(S.밖, "움직임", "15초", SHOT + ("" if S.RES[0] >= 1000 else "_미리")))

R = M.R_SHELL  # 돔(얼어붙은 비눗방울) 반지름 0.105 m
C = M.C
ZF = -0.070  # 검은 유리 바닥 — 돔이 이 높이에서 잘려 바닥에 놓이고(닿는 원 반지름 7.8 cm), 두 제품이 그 안에 선다
GAP = 0.00002  # 조각 사이 틈(한쪽) — 깨지기 전 장에서 금이 안 보이게. 2판: 0.15 mm(틈 0.3 mm)도 겉 · 안 면이 없는 틈으로 돔 너머가
# 곧게 비쳐 돔 전체에 가는 줄 그물이 보였다(1판 「납땜 유리 램프」의 진짜 원인, 2판 첫 시험 전 0장)
V_END = (M.m2_cam(1.0) - C).normalized()  # 깨지는 자리 = 전 끝 카메라 쪽(잔 조각이 몰린다)
UP = Vector((0, 0, 1))

# 제품 자리 — 승 · 결 끝은 바닥에 선 자리, 전은 깨짐에 떠오른 m2 자리
JAR_STAND = (Vector((0.028, 0.004, ZF)), Euler((0.0, 0.0, math.radians(14))))
AMP_STAND = (Vector((-0.036, -0.010, ZF)), Euler((0.0, 0.0, math.radians(-12))))
JAR_FLOAT = (Vector((0.028, 0.004, -0.040)), Euler((math.radians(26), math.radians(-10), math.radians(20))))
AMP_FLOAT = (Vector((-0.036, -0.010, -0.046)), Euler((math.radians(-9), math.radians(13), math.radians(-24))))
JAR_DRIFT = (Vector((0, 0, 0.0015)), Vector((0.0, 0.0, 0.018)))  # 멈춘 3초 동안 흐르는 몫(m2와 같은 빠르기)
AMP_DRIFT = (Vector((0, 0, 0.0012)), Vector((0.0, 0.0, -0.015)))

smooth = M.smooth


def smoother(s):
    s = min(1.0, max(0.0, s))
    return s * s * s * (s * (s * 6 - 15) + 10)


def clamp01(s):
    return min(1.0, max(0.0, s))


def lerp(a, b, u):
    return a + (b - a) * u


def lerp_log(a, b, u):
    return math.exp(lerp(math.log(a), math.log(b), u))


def qlerp(e0, e1, u):
    """두 오일러 자세 사이를 쿼터니언으로 — 결에서 기운 단지가 바로 서며 내려앉는다."""
    return e0.to_quaternion().slerp(e1.to_quaternion(), u).to_euler()


def look_rot(loc, tgt, up=UP):
    """카메라 자세 — −Z가 겨냥점을 보고 Y가 up 쪽(to_track_quat('-Z', 'Y')와 같은데 up을 고를 수 있다)."""
    f = (Vector(tgt) - Vector(loc)).normalized()
    r = f.cross(up).normalized()
    return Matrix((r, r.cross(f), -f)).transposed().to_euler()


def halo_dir(cam_loc):
    """금빛 둘레(sky_world 해 방향) — 카메라에서 돔 가운데 너머 조금 위. 2판: 1판은 전 끝 카메라 뒤 방향 하나로 고정이라 승의
    돔 너머가 깜깜해 서리 굴절이 검정을 비췄다(Fable P1-1). 전 끝 카메라에서는 1판 방향(−V_END + 위 0.25)과 같다."""
    return ((C - Vector(cam_loc)).normalized() + Vector((0, 0, 0.25))).normalized()


# ── 결정 · 돔 · 조각 ───────────────────────────────────────────────────────────
def dome_seeds(seed=7, n_seed=30, n_cluster=110):
    """움직임.py shell_pieces와 같은 난수 순서로 씨앗을 만든다 — 큰 판 30(첫 결정은 그 7번 자리) + 깨지는 쪽 잔 조각 110.
    첫 결정(3.2 cm)이 한 조각 위에 온전히 남게 그 둘레 21° 안의 잔 씨앗은 뺀다(이등분면이 결정 반지름 8.7° 밖에 오게)."""
    rng = random.Random(seed)
    big = []
    ga = math.pi * (3 - math.sqrt(5))
    for i in range(n_seed):
        z = 1 - 2 * (i + 0.5) / n_seed
        r = math.sqrt(1 - z * z)
        a = i * ga
        p = Vector((r * math.cos(a), r * math.sin(a), z))
        p += Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))) * 0.16
        big.append(p.normalized())
    cl = [(V_END + Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))) * 0.55).normalized() for _ in range(n_cluster)]
    p0 = big[7]
    cl = [q for q in cl if q.angle(p0) > math.radians(21)]
    return big, cl, p0


BIG, CLUSTER, P0 = dome_seeds()


def frame_at(p):
    """구 위 한 점의 접평면 틀 — n(바깥), e1(오른쪽), e2(위). m1의 (x, −y, z)가 (e1, n, e2)로 간다."""
    n = p.normalized()
    e2 = (UP - n * UP.dot(n)).normalized()
    return n, e2.cross(n), e2


N0, E1, E2 = frame_at(P0)
P0R = P0 * R


def dome_jitter(v):
    """얼어붙은 막은 완전한 구가 아니다 — m2 조각과 같은 잔 울퉁불퉁(같은 식이라 돔과 조각의 겉이 같다)."""
    return v * (1.0 + 0.012 * noise.noise(v * 28.0))


def sphere_bm(segs=256):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=R)
    return bm


def cut_floor(bm):
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), plane_co=(0, 0, ZF),
                           plane_no=(0, 0, -1), clear_outer=True)


def solidify(ob, thick=0.0035):
    so = ob.modifiers.new("두께", "SOLIDIFY")
    so.thickness = thick
    so.offset = -1.0
    so.use_even_offset = True
    so.use_rim = True
    so.material_offset_rim = 1
    return so


def frost_maps():
    """carpet4096 잔 결정 1,279개 — 도착 시각 · 높이를 16비트 PNG로(한 번 만들어 둔다). 높이는 99번째 값으로 맞춘다."""
    d = os.path.join(S.결정, "_지도")
    pa, ph = os.path.join(d, "껍질_도착4096.png"), os.path.join(d, "껍질_높이4096.png")
    if not (os.path.exists(pa) and os.path.exists(ph)):
        os.makedirs(d, exist_ok=True)
        arr = np.load(os.path.join(S.결정, "carpet4096", "window_arrival.npy"))
        h = np.load(os.path.join(S.결정, "carpet4096", "window_height.npy"))
        S.png16(pa, np.clip(arr, 0.0, 1.0))
        S.png16(ph, np.clip(h / max(1e-6, float(np.percentile(h[h > 0], 99))), 0.0, 1.0))
    return S.load_map(pa), S.load_map(ph)


TMAX = 0.5  # 결정끼리 막 닿은 무렵(m2 조각 무늬와 같은 때)
K_GROW = 1.0  # 서리 머리가 1 rad 나아가는 동안 잔 결정이 자라는 몫(도착 시각 단위)
A_DEAD = 0.175  # 첫 결정(반지름 1.6 cm = 0.152 rad) 자리엔 잔 결정을 안 둔다
MAP_SCALE = 1.3
# 첫 시험(10-30): 범프 0.35는 굴절을 크게 비틀어 돔이 「구겨진 비닐」로, 막 자란 끝의 흰 띠(도착 시각 0.10 폭)는 「흰 낙서」로 읽혔다.
# 2판: 0.16도 돔 너머 제품을 네모 알갱이로 깨 「모자이크 · 각설탕 더미」(Fable 1판 4.6초)
BUMP = 0.07
FRESH_W = 0.025
FRESH_WHITE = 0.12  # 2차 시험 0.70은 「흰 테두리 스티커 · 레이스」, 1판 0.25도 자라는 송이 둘레가 「흰 풀 · 치약 테두리」(Fable 3.6초)
EDGE_WHITE = 0.16  # 가지 가장자리만 가는 은빛 결(얼어붙은 비눗방울 사진처럼) — 넓은 젖빛은 「흰 도자기」(10-30 현장노트)
# 2판: 자란 가지 자리는 흰 반투명 산란(젖빛 유리 + 확산 투과) — 1판은 굴절 요철뿐이라 깜깜한 바탕을 비춰 서리가
# 「검정 · 회색 곰팡이 스노볼」이었다(Fable P1-1). 돔 안 따뜻한 빛과 돔 너머 금빛 둘레를 받아 하얗게 빛난다.
# 2판 첫 시험: 0.55를 결정 모양 전체(높이 0.03~0.30 계단)에 주니 「흰 종이 눈꽃 스티커」로 돔을 덮어 제품이 안 보였다 →
# 가지 높이에 비례(두꺼운 등뼈일수록 젖빛). 0.22도 조각마다 흰 눈꽃이 찍혀 「꽃무늬 타일 · 눈꽃 스티커 유리」(같은 시험 전) →
# 0.12 · 거의 젖빛 유리(뒤 금빛을 흐리게 비춤)로, 전은 깨지며 0.04로(조각은 굴절 요철로 읽히게 — 1판 「점 찍은 유리」는 괜찮았다)
FROST_WHITE = 0.12
FROST_SHARD = 0.04


def mat_frost_shell(name, arr_img, h_img, coord_attr=None):
    """승의 돔과 전 · 결의 조각이 함께 쓰는 얼음 껍질 — 맑은 얼음 위로 잔 결정이 첫 결정에서 번져 나간 자리가 흰 반투명
    서리(산란)와 굴절 속 요철, 막 자란 끝은 잠깐 서리 흰빛으로 빛나다 가라앉는다(m1 결정의 「막 자란 끝만 서리」와 같은 결).
    PHI 값 노드(서리 머리의 각, rad)를 장마다 바꾼다 — 크게 두면 m2처럼 다 자란 무늬. 무늬 좌표는 깨지기 전 자리라
    돔(물체 좌표)과 조각(orig 속성)이 같은 무늬다."""
    m, n, l, out = S.new_mat(name)
    if coord_attr:
        at = n.new("ShaderNodeAttribute")
        at.attribute_name = coord_attr
        P = at.outputs["Vector"]
    else:
        P = n.new("ShaderNodeTexCoord").outputs["Object"]
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (0.5, 0.5, 0.5)
    mp.inputs["Scale"].default_value = (MAP_SCALE,) * 3  # 잔 결정 한 송이 약 2.3 cm — 첫 결정(3.2 cm)보다 작게 · 가까이서도 흐리지 않게
    l.new(P, mp.inputs["Vector"])

    def tex(im, interp):
        t = n.new("ShaderNodeTexImage")
        t.image = im
        t.projection = "BOX"
        t.projection_blend = 0.25
        t.interpolation = interp
        t.extension = "EXTEND"
        l.new(mp.outputs["Vector"], t.inputs["Vector"])
        return t.outputs["Color"]

    arr = tex(arr_img, "Linear")
    hh = tex(h_img, "Cubic")
    nv = n.new("ShaderNodeVectorMath")
    nv.operation = "NORMALIZE"
    l.new(P, nv.inputs[0])
    dt = n.new("ShaderNodeVectorMath")
    dt.operation = "DOT_PRODUCT"
    l.new(nv.outputs[0], dt.inputs[0])
    dt.inputs[1].default_value = tuple(P0)
    ang = S.math_node(n, l, "ARCCOSINE", S.math_node(n, l, "MAXIMUM", S.math_node(n, l, "MINIMUM", dt.outputs["Value"], 1.0), -1.0))
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 22.0
    l.new(P, nz.inputs["Vector"])
    act = S.madd(n, l, nz.outputs["Fac"], 0.5, S.math_node(n, l, "SUBTRACT", ang, 0.25))  # 머리가 손가락처럼 고르지 않게 ±0.25 rad
    phi = n.new("ShaderNodeValue")
    phi.name = "PHI"
    phi.outputs[0].default_value = 100.0
    teff = S.math_node(n, l, "MULTIPLY", S.math_node(n, l, "SUBTRACT", phi.outputs[0], act), K_GROW)
    teff = S.math_node(n, l, "MINIMUM", S.math_node(n, l, "MAXIMUM", teff, 0.0), TMAX)
    teff = S.math_node(n, l, "MULTIPLY", teff, S.math_node(n, l, "GREATER_THAN", ang, A_DEAD))
    grown = S.math_node(n, l, "SUBTRACT", teff, arr)  # 이 자리가 자란 지 얼마나 됐나(도착 시각 단위)
    age = S.math_node(n, l, "MINIMUM", S.math_node(n, l, "MAXIMUM", S.math_node(n, l, "DIVIDE", grown, 0.06), 0.0), 1.0)
    hvis = S.math_node(n, l, "MULTIPLY", hh, S.math_node(n, l, "SQRT", age))
    fresh = S.math_node(n, l, "MULTIPLY", S.math_node(n, l, "GREATER_THAN", grown, 0.0),
                        S.math_node(n, l, "MAXIMUM", S.math_node(n, l, "SUBTRACT", 1.0, S.math_node(n, l, "DIVIDE", grown, FRESH_W)), 0.0))
    done = S.math_node(n, l, "MINIMUM", S.math_node(n, l, "DIVIDE", S.math_node(n, l, "SUBTRACT", TMAX, teff), 0.12), 1.0)
    fresh = S.math_node(n, l, "MULTIPLY", S.math_node(n, l, "MULTIPLY", fresh, done), S.math_node(n, l, "GREATER_THAN", hh, 0.02))
    # 가지 가장자리(높이가 막 오르는 얇은 띠)만 은빛 — 자란 자리에만
    edge = n.new("ShaderNodeMapRange")
    edge.interpolation_type = "SMOOTHSTEP"
    edge.inputs["From Min"].default_value = 0.02
    edge.inputs["From Max"].default_value = 0.16
    edge.inputs["To Min"].default_value = 1.0
    edge.inputs["To Max"].default_value = 0.0
    l.new(hvis, edge.inputs["Value"])
    ew = n.new("ShaderNodeValue")
    ew.name = "EDGE"
    ew.outputs[0].default_value = EDGE_WHITE
    fw = n.new("ShaderNodeValue")
    fw.name = "FRESHW"
    fw.outputs[0].default_value = FRESH_WHITE
    edge_w = S.math_node(n, l, "MULTIPLY", S.math_node(n, l, "MULTIPLY", edge.outputs["Result"], S.math_node(n, l, "GREATER_THAN", hvis, 0.02)), ew.outputs[0])
    ice = S.principled(n, base=(0.97, 0.99, 1.0), rough=0.012, ior=1.31, trans=1.0)
    S.setin(ice, "Dispersion", 0.3)
    bp = n.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = BUMP
    bp.inputs["Distance"].default_value = 0.0006
    l.new(hvis, bp.inputs["Height"])
    l.new(bp.outputs["Normal"], ice.inputs["Normal"])
    # 자란 가지 = 흰 반투명 서리(젖빛 유리 0.85 : 확산 투과 0.15, 거칠기 0.35) — 가지 높이에 비례, FROSTW 값 노드로 몫을 정한다
    cov = S.math_node(n, l, "POWER", S.math_node(n, l, "MULTIPLY", hvis, 1.4, clamp=True), 0.8)
    frw = n.new("ShaderNodeValue")
    frw.name = "FROSTW"
    frw.outputs[0].default_value = FROST_WHITE
    milk_g = S.principled(n, base=(0.97, 0.985, 1.0), rough=0.35, ior=1.31, trans=1.0)
    l.new(bp.outputs["Normal"], milk_g.inputs["Normal"])
    milk_t = n.new("ShaderNodeBsdfTranslucent")
    milk_t.inputs["Color"].default_value = (1.0, 0.97, 0.93, 1)
    milk = n.new("ShaderNodeMixShader")
    milk.inputs["Fac"].default_value = 0.15
    l.new(milk_g.outputs[0], milk.inputs[1])
    l.new(milk_t.outputs[0], milk.inputs[2])
    body = n.new("ShaderNodeMixShader")
    l.new(S.math_node(n, l, "MULTIPLY", cov, frw.outputs[0]), body.inputs["Fac"])
    l.new(ice.outputs[0], body.inputs[1])
    l.new(milk.outputs[0], body.inputs[2])
    trl = n.new("ShaderNodeBsdfTranslucent")
    trl.inputs["Color"].default_value = (1.0, 0.96, 0.90, 1)
    dif = n.new("ShaderNodeBsdfDiffuse")
    dif.inputs["Color"].default_value = (0.86, 0.91, 0.98, 1)
    fr = n.new("ShaderNodeMixShader")
    fr.inputs["Fac"].default_value = 0.3
    l.new(trl.outputs[0], fr.inputs[1])
    l.new(dif.outputs[0], fr.inputs[2])
    mix = n.new("ShaderNodeMixShader")
    l.new(S.math_node(n, l, "MINIMUM", S.math_node(n, l, "ADD", S.math_node(n, l, "MULTIPLY", fresh, fw.outputs[0]), edge_w), 0.8),
          mix.inputs["Fac"])
    l.new(body.outputs[0], mix.inputs[1])
    l.new(fr.outputs[0], mix.inputs[2])
    gl = n.new("ShaderNodeBsdfGlossy")
    S.setin(gl, "Roughness", 0.04)
    vor = n.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 2600.0
    l.new(P, vor.inputs["Vector"])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.5
    l.new(vor.outputs["Distance"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], gl.inputs["Normal"])
    lw = n.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.25
    spark = S.math_node(n, l, "MULTIPLY", lw.outputs["Fresnel"], S.math_node(n, l, "MULTIPLY", hvis, 2.0, clamp=True))
    gmix = n.new("ShaderNodeMixShader")
    l.new(S.math_node(n, l, "MINIMUM", S.math_node(n, l, "ADD", spark, S.math_node(n, l, "MULTIPLY", fresh, 0.35)), 1.0), gmix.inputs["Fac"])
    l.new(mix.outputs[0], gmix.inputs[1])
    l.new(gl.outputs[0], gmix.inputs[2])
    l.new(S.shadow_pass(n, l, gmix.outputs[0], tint=(0.92, 0.95, 1.0)).outputs[0], out.inputs["Surface"])
    return m, phi


CRACK_A = 0.9  # 2판: 금은 깨지는 자리 둘레 0.9 rad까지만 — 1판은 0–4장에 돔 전체(π)로 번져 첫 장부터 고른 그물(「납땜 유리 램프 ·
# 디스코볼」, Fable 1판 5.8초). 그 너머 조각 둘레는 깨짐(4장)과 함께 드러난다


def mat_break_glow(coord_attr="orig"):
    """깨진 면(조각 둘레) — 맑은 얼음 + 조개껍질 꼴 잔물결. 금이 가는 몇 장 동안 깨지는 자리(V_END) 둘레에서 번져 나가며
    따뜻한 흰빛으로 번쩍인다(GLOW 세기 · CRACK 머리 각을 장마다 바꾼다)."""
    m, n, l, out = S.new_mat("깨진면빛")
    b = S.principled(n, base=(0.96, 0.985, 1.0), rough=0.03, ior=1.31, trans=1.0)
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 520.0
    nz.inputs["Detail"].default_value = 3.0
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.0004
    l.new(nz.outputs["Fac"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    at = n.new("ShaderNodeAttribute")
    at.attribute_name = coord_attr
    nv = n.new("ShaderNodeVectorMath")
    nv.operation = "NORMALIZE"
    l.new(at.outputs["Vector"], nv.inputs[0])
    dt = n.new("ShaderNodeVectorMath")
    dt.operation = "DOT_PRODUCT"
    l.new(nv.outputs[0], dt.inputs[0])
    dt.inputs[1].default_value = tuple(V_END)
    ang = S.math_node(n, l, "ARCCOSINE", S.math_node(n, l, "MAXIMUM", S.math_node(n, l, "MINIMUM", dt.outputs["Value"], 1.0), -1.0))
    crack = n.new("ShaderNodeValue")
    crack.name = "CRACK"
    crack.outputs[0].default_value = -1.0
    glow = n.new("ShaderNodeValue")
    glow.name = "GLOW"
    glow.outputs[0].default_value = 0.0
    on = S.math_node(n, l, "LESS_THAN", ang, crack.outputs[0])
    # 금은 머리가 지나가는 자리만 한 번 번쩍인다(머리 뒤 0.25 rad에 걸쳐 잦아듦) — 첫 시험의 그물 전체가 하얗게 빛나
    # 「흰 줄눈 · 흰 종이 조각」으로 읽혔다. 2판: 빛은 깨지는 자리 둘레(CRACK_A)에서만
    behind = S.math_node(n, l, "SUBTRACT", crack.outputs[0], ang)
    flash = S.math_node(n, l, "EXPONENT", S.math_node(n, l, "MULTIPLY", S.math_node(n, l, "MAXIMUM", behind, 0.0), -4.0))
    near = n.new("ShaderNodeMapRange")
    near.interpolation_type = "SMOOTHSTEP"
    near.inputs["From Min"].default_value = CRACK_A * 0.6
    near.inputs["From Max"].default_value = CRACK_A
    near.inputs["To Min"].default_value = 1.0
    near.inputs["To Max"].default_value = 0.0
    l.new(ang, near.inputs["Value"])
    em = n.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (1.0, 0.90, 0.72, 1)
    l.new(S.math_node(n, l, "MULTIPLY", S.math_node(n, l, "MULTIPLY", S.math_node(n, l, "MULTIPLY", on, flash), near.outputs["Result"]),
                      glow.outputs[0]), em.inputs["Strength"])
    add = n.new("ShaderNodeAddShader")
    l.new(b.outputs[0], add.inputs[0])
    l.new(em.outputs[0], add.inputs[1])
    # 금이 가기 전 조각 둘레는 투명 — 0.3 mm 틈의 둘레 면이 금 그물로 비쳐 돔이 처음부터 깨져 보였다(첫 시험 0장)
    tr = n.new("ShaderNodeBsdfTransparent")
    vis = n.new("ShaderNodeMixShader")
    l.new(on, vis.inputs["Fac"])
    l.new(tr.outputs[0], vis.inputs[1])
    l.new(add.outputs[0], vis.inputs[2])
    l.new(S.shadow_pass(n, l, vis.outputs[0], tint=(0.92, 0.95, 1.0)).outputs[0], out.inputs["Surface"])
    return m, crack, glow


def add_crack_mask(m, coord_attr="orig"):
    """전 머리의 가림 — 깨지기 전 장에는 승의 온전한 돔(물체 속성 「덮개」 = 1)을 두고, 조각은 금 머리(CRACKV) 안쪽만 보인다.
    SHOWALL = 1(깨짐부터)이면 조각만. 2판 시험: 조각 사이 틈을 0.02 mm로 줄여도 조각 경계마다 부드러운 법선이 달라 깨지기 전 돔
    전체에 옅은 줄 그물이 남았다(1판 시험관 셋 「기계로 찍은 격자 · 거미줄」, Fable 「첫 프레임부터 보로노이 그물」)."""
    n, l = m.node_tree.nodes, m.node_tree.links
    out = next(x for x in n if x.type == "OUTPUT_MATERIAL")
    base = out.inputs["Surface"].links[0].from_socket
    at = n.new("ShaderNodeAttribute")
    at.attribute_name = coord_attr
    nv = n.new("ShaderNodeVectorMath")
    nv.operation = "NORMALIZE"
    l.new(at.outputs["Vector"], nv.inputs[0])
    dt = n.new("ShaderNodeVectorMath")
    dt.operation = "DOT_PRODUCT"
    l.new(nv.outputs[0], dt.inputs[0])
    dt.inputs[1].default_value = tuple(V_END)
    ang = S.math_node(n, l, "ARCCOSINE", S.math_node(n, l, "MAXIMUM", S.math_node(n, l, "MINIMUM", dt.outputs["Value"], 1.0), -1.0))
    cv = n.new("ShaderNodeValue")
    cv.name = "CRACKV"
    cv.outputs[0].default_value = 10.0
    sa = n.new("ShaderNodeValue")
    sa.name = "SHOWALL"
    sa.outputs[0].default_value = 1.0
    flag = n.new("ShaderNodeAttribute")
    flag.attribute_type = "OBJECT"
    flag.attribute_name = "덮개"
    cracked = S.math_node(n, l, "LESS_THAN", ang, cv.outputs[0])
    piece_vis = S.math_node(n, l, "MAXIMUM", sa.outputs[0], cracked)
    dome_vis = S.math_node(n, l, "MULTIPLY", S.math_node(n, l, "SUBTRACT", 1.0, sa.outputs[0]), S.math_node(n, l, "SUBTRACT", 1.0, cracked))
    vis = S.madd(n, l, flag.outputs["Fac"], S.math_node(n, l, "SUBTRACT", dome_vis, piece_vis), piece_vis)
    tr = n.new("ShaderNodeBsdfTransparent")
    mx = n.new("ShaderNodeMixShader")
    l.new(vis, mx.inputs["Fac"])
    l.new(tr.outputs[0], mx.inputs[1])
    l.new(base, mx.inputs[2])
    l.new(mx.outputs[0], out.inputs["Surface"])
    return cv, sa


_GROWN = {}
CRYSTAL_SIZE, CRYSTAL_HMAX = 0.032, 0.00022
LID_SIZE, LID_HMAX = 0.056, 0.00030
LID_Z = 0.044 + 0.0026 + 0.016  # 단지 축에서 뚜껑 크리스털 판 윗면
# 뚜껑 결정의 얇은 가장자리 서리 몫 — m1 값 0.55는 이 거리(44 cm · 50 mm)에서 잔 가지 가장자리가 겹쳐 낮게 스치는 금빛 키를 받아
# 결정 전체가 「흰 석고 새김」이 됐다(2판 진단: 장면 빛 · 반사층을 꺼도 그대로, 금키를 끄면 검게). 떨어지는 결정은 앉으며 이 값으로
LID_EDGE = 0.12


def crystal_grown():
    """첫 결정 · 뚜껑 결정 · 떨어지는 결정이 같은 결(m1 끝 장과 같은 자람)."""
    if "g" not in _GROWN:
        arr, h = S.load_sim(S.MACRO_SIM, "macro")
        _GROWN["g"] = S.grown(arr, M.plate(h), 1.0, soft=0.05)
    return _GROWN["g"]


def lid_array():
    """뚜껑 결정 높이 — 첫 결정의 행을 뒤집은 것. 첫 결정은 돔 안쪽 면에서 안으로 돋은 결이라, 결이 위로 오게 돌려 눕히면
    거울상이 된다 — 결에서 떨어져 내려온 첫 결정이 뚜껑 결정과 그대로 겹쳐 앉게(opus 제안 · 인계 「등뼈 방향 맞춤」)."""
    return np.ascontiguousarray(crystal_grown()[::-1])


def crystal_base():
    """첫 결정 밑면 가운데 — 돔 안쪽 면(두께 3.5 mm) 위."""
    return P0 * (R * (1.0 + 0.012 * noise.noise(P0 * (R * 28.0))) - 0.0035 - 0.00003)


def first_crystal(mat):
    """기(m1)의 끝 결정 — 같은 지도 · 같은 높이 · 같은 재질을 돔 P0 자리에 감아 붙인다(납작한 판을 구로 투영).
    m1처럼 얇은 얼음(유리) 안쪽 면에서 안으로 돋는다 — 바깥에서 보면 m1과 같은 결(겉면에 얹으면 높낮이가 뒤집혀 빛이 달랐다)."""
    g = crystal_grown()
    size, hmax = CRYSTAL_SIZE, CRYSTAL_HMAX
    N0r, N1r = g.shape
    f = (g[:-1, :-1] > 0.002) | (g[1:, :-1] > 0.002) | (g[:-1, 1:] > 0.002) | (g[1:, 1:] > 0.002)
    r, c = np.nonzero(f)
    a = r * N1r + c
    quads = np.stack([a, a + 1, a + N1r + 1, a + N1r], 1)
    used = np.zeros(N0r * N1r, bool)
    used[quads.ravel()] = True
    remap = -np.ones(N0r * N1r, np.int64)
    remap[used] = np.arange(used.sum())
    rr, cc = np.divmod(np.nonzero(used)[0], N1r)
    hv = g.ravel()[used]
    # 안쪽 면(R − 3.5 mm)으로 투영하면 결정이 3.4 % 줄어 m1 끝 장보다 작았다(2판 첫 시험 디졸브 겹침) — 겉면에서 그만큼 넓게 편다
    grow = R / (R - 0.0035 - 0.00003)
    x = (cc / (N1r - 1) - 0.5) * size * grow
    z = (0.5 - rr / (N0r - 1)) * size * grow
    base = np.array(P0R)[None, :] + x[:, None] * np.array(E1)[None, :] + z[:, None] * np.array(E2)[None, :]
    dirs = base / np.linalg.norm(base, axis=1, keepdims=True)
    jit = np.fromiter((1.0 + 0.012 * noise.noise(Vector(d) * (R * 28.0)) for d in dirs), np.float64, len(dirs))
    rad = R * jit - 0.0035 - 0.00003 - hv * hmax  # 돔 안쪽 면(두께 3.5 mm)에서 안으로
    verts = dirs * rad[:, None]
    me = S.mesh_from_arrays("첫결정", verts, remap[quads])
    at = me.attributes.new("frost", "FLOAT", "POINT")
    at.data.foreach_set("value", hv.astype(np.float32))
    me.materials.append(mat)
    return S.link(bpy.data.objects.new("첫결정", me))


# 첫 결정의 네 빛(m1과 같은 자리 · 같은 세기, 결정 틀 (E1, −N0, E2) 기준) — 빛 연결로 결정만 받는다
CRYSTAL_LIGHTS = (("결정뒤금", (0.20, 0.10, 0.08), 10.0, 0.06, (1.0, 0.76, 0.46)),
                  ("결정뒤은", (-0.20, 0.10, -0.08), 6.5, 0.06, (0.75, 0.85, 1.0)),
                  ("결정찬빛", (-0.14, -0.05, 0.10), 3.2, 0.03, (0.60, 0.74, 1.0)),
                  ("결정결빛", (0.10, -0.03, -0.09), 1.0, 0.015, (1.0, 0.90, 0.75)))
CRYSTAL_K = 0.55  # 2판: 승 첫 1.2초에 1 → 0.55, 전 · 결은 0.55 — m1 세기 그대로 두면 장면 빛이 차오른 3.6초에 「흰 불투명 플라스틱」


def dome_object(frost_mat, break_mat):
    """승의 돔 하나 — 조각과 같은 구(256 × 128) · 같은 잔 울퉁불퉁 · 바닥에서 잘림 · 두께 3.5 mm."""
    bm = sphere_bm()
    cut_floor(bm)
    for v in bm.verts:
        v.co = dome_jitter(v.co)
    me = bpy.data.meshes.new("돔")
    bm.to_mesh(me)
    bm.free()
    orig = me.attributes.new("orig", "FLOAT_VECTOR", "POINT")  # 조각과 같은 무늬 좌표(두께 쪽 면도 겉 자리를 물려받는다)
    orig.data.foreach_set("vector", np.array([v.co[:] for v in me.vertices], np.float32).ravel())
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(frost_mat)
    me.materials.append(break_mat)
    ob = S.link(bpy.data.objects.new("돔", me))
    solidify(ob)
    return ob


def dome_pieces(frost_mat, break_mat):
    """전 · 결의 조각 — 큰 판 30 + 깨지는 쪽 잔 조각, 바닥에서 잘림. 돌려주는 것: [(물체, 씨앗, 무게중심)]."""
    pts = BIG + CLUSTER
    out = []
    for i, p in enumerate(pts):
        bm = sphere_bm()
        near = sorted((q for j, q in enumerate(pts) if j != i), key=lambda q: (q - p).length)[:18]
        for q in near:
            nrm = (q - p).normalized()
            bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), plane_co=-nrm * GAP,
                                   plane_no=nrm, clear_outer=True)
        cut_floor(bm)
        if len(bm.faces) < 3:
            bm.free()
            continue
        for v in bm.verts:
            v.co = dome_jitter(v.co)
        c = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
        me = bpy.data.meshes.new(f"껍질{i}")
        bm.to_mesh(me)
        bm.free()
        orig = me.attributes.new("orig", "FLOAT_VECTOR", "POINT")
        orig.data.foreach_set("vector", np.array([v.co[:] for v in me.vertices], np.float32).ravel())
        for v in me.vertices:
            v.co -= c
        for pg in me.polygons:
            pg.use_smooth = True
        me.materials.append(frost_mat)
        me.materials.append(break_mat)
        ob = S.link(bpy.data.objects.new(f"껍질{i}", me))
        ob.location = c
        solidify(ob)
        out.append((ob, p, c))
    return out


# ── 세계 · 바닥 · 빛 · 제품 ───────────────────────────────────────────────────
def mat_black_glass():
    """검은 유리 바닥 — 거칠기가 넓게 조금씩 달라 거울처럼 납작하지 않게."""
    m, n, l, out = S.new_mat("검은유리")
    b = S.principled(n, base=(0.004, 0.005, 0.009), rough=0.05, coat=1.0, coat_rough=0.02, spec=0.5)
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 4.0
    l.new(S.madd(n, l, nz.outputs["Fac"], 0.10, -0.02), b.inputs["Roughness"])
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def build_world():
    """금빛 둘레 세계 빛(m2 그대로 — 방향은 숏마다 halo_dir로 돌린다) + 검은 유리 바닥 + 빛. 빛 연결은 물체를 다 지은 뒤에."""
    sc = bpy.context.scene
    sc.cycles.max_bounces = 16
    sc.cycles.transmission_bounces = 16
    sc.cycles.glossy_bounces = 6
    sc.cycles.sample_clamp_indirect = 8.0
    S.sky_world((0.003, 0.005, 0.014), (0.010, 0.014, 0.030), (0.003, 0.004, 0.010), 1.0,
                sun_dir=tuple((-V_END + Vector((0, 0, 0.25))).normalized()), sun_rgb=(1.0, 0.62, 0.28),
                core=8.0, core_gain=0.0, halo=40.0, halo_gain=0.30, light=0.35)
    floor = S.box("바닥", 40.0, 40.0, 0.02, (0, 0, ZF - 0.01), mat_black_glass())
    L = {}

    def hid(ob):
        ob.visible_camera = False
        return ob
    # 금역광은 m2보다 높이(0.36 → 0.80 m, 세기는 거리 제곱만큼) — 검은 유리 바닥에 비친 상이 승 · 전 첫 장 왼쪽 아래 큰 흰
    # 원판이 됐다(빛 연결로 바닥을 빼도 바닥에 비친 빛 면은 남는다). 높이면 비친 상이 화면 아래 밖으로 간다
    L["금역광"] = hid(S.area_light("금역광", (0.10, 0.62, 0.80), (0, 0, 0), 168.0, 0.12, rgb=(1.0, 0.70, 0.36)))
    L["은역광"] = hid(S.area_light("은역광", (-0.42, 0.50, 0.02), (0, 0, 0), 35.0, 0.10, rgb=(0.78, 0.86, 1.0)))
    L["찬키"] = hid(S.area_light("찬키", (-0.55, -0.42, 0.40), (0, 0, 0), 30.0, 0.035, rgb=(0.70, 0.82, 1.0), size_y=0.60))
    L["윗빛"] = hid(S.area_light("윗빛", (0.08, -0.08, 0.80), (0, 0, 0), 18.0, 0.50, rgb=(1.0, 0.95, 0.90), size_y=0.03))
    L["반짝"] = [S.glint_only(S.point_light(f"반짝{i}", p, e, (1.0, 0.92, 0.80), radius=0.004)) for i, (p, e) in enumerate(
        (((0.30, -0.22, 0.18), 9.0), ((-0.24, -0.10, -0.02), 7.0), ((-0.18, -0.30, 0.26), 8.0),
         ((0.22, 0.10, -0.02), 7.0), ((0.05, -0.35, 0.02), 8.0), ((-0.30, 0.15, 0.20), 6.0)))]
    # 먼 보케 — 짙은 살구색 원판이 「색종이 · 납작한 원판」으로 읽혀(Fable 2 · 3차) 밝은 금빛으로 · 적게 · 작게
    # (크림빛은 결 끝 장에서 「흰 눈덩이」로 읽혔다 — 첫 시험)
    S.bokeh_in_view(M.m2_cam(0.5), C, 12, 3.0, 7.0, 0.8, [(1.0, 0.70, 0.36), (1.0, 0.62, 0.28), (1.0, 0.78, 0.46)], 80.0,
                    0.004, 0.011, seed=13)
    return floor, L


AMP_PAT_ROUGH, AMP_BUMP = 0.05, 0.35  # 앰플 새김 자리 거칠기 · 범프 — 0.12 · 0.6도 세럼 속 옅은 얼룩으로 보였다(2판 진단)


def ampoule_front_only(amp_parts):
    """앰플 서리꽃 새김을 바깥 앞면 겉에만 · 옅게 — 1판은 |노멀 y| > 0.9 면 모두(앞 · 뒤 · 빈 칸 뒷벽 안쪽)에 새겨, 세럼 너머
    뒷벽 무늬가 「세럼 속 흰 침전물」로 떠 보였다(Fable 1판 14.9초). 시안.py는 그대로 두고 이 영상의 재질만 바꾼다."""
    body = next(o for o in amp_parts if o.name.startswith("앰플병"))
    m = body.data.materials[0]
    n, l = m.node_tree.nodes, m.node_tree.links
    ab = next(x for x in n if x.type == "MATH" and x.operation == "ABSOLUTE")
    gt = ab.outputs[0].links[0].to_node
    ab.operation = "MULTIPLY"  # |n.y| → −n.y : 앞(−Y)을 보는 면만
    ab.inputs[1].default_value = -1.0
    tc = next(x for x in n if x.type == "TEX_COORD")
    sp = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Object"], sp.inputs["Vector"])
    both = S.math_node(n, l, "MULTIPLY", gt.outputs[0], S.math_node(n, l, "LESS_THAN", sp.outputs["Y"], -0.0145))  # 바깥 앞면(y −0.016)만
    for lk in list(gt.outputs[0].links):  # 노드 비교는 이름으로 — bpy 노드는 꺼낼 때마다 새 파이썬 객체라 `is`가 늘 다르다고 나와
        if lk.to_node.name != both.node.name:  # 곱 노드가 제 입력에 이어진 고리가 생겨 앰플이 통째로 검게 찍혔다(2판 첫 시험)
            l.new(both, lk.to_socket)
    for x in n:
        if x.type == "MATH" and x.operation == "MULTIPLY_ADD" and abs(x.inputs[1].default_value - 0.35) < 1e-6:
            x.inputs[1].default_value = AMP_PAT_ROUGH  # 무늬 자리 거칠기 0.35 → 맑게(젖빛 덩어리가 아니라 겉 식각)
        if x.type == "BUMP" and abs(x.inputs["Distance"].default_value - 0.00025) < 1e-7:
            x.inputs["Strength"].default_value = AMP_BUMP


def build_products():
    jar_e, jp = S.cream_jar(tuple(JAR_STAND[0]), tuple(JAR_STAND[1]), relief_step=1)
    amp_e, ap = S.ampoule(tuple(AMP_STAND[0]), tuple(AMP_STAND[1]))
    ampoule_front_only(ap)
    flake = next(o for o in jp if o.name.startswith("뚜껑결정"))
    jp.remove(flake)
    bpy.data.objects.remove(flake, do_unlink=True)
    # 2판: 뚜껑 결정 = 첫 결정 그 물건 — 같은 결(행만 뒤집음 · lid_array) · 같은 재질(M.mat_ice_crystal). 1판의 서리 재질은
    # 기의 은빛 결정과 딴 물건 「흰 분필 · 종이 도일리」였다(Fable P1-3)
    lid = S.relief_sheet("뚜껑결정판", lid_array(), LID_SIZE, LID_Z, LID_HMAX, M.mat_ice_crystal(), step=1)
    ice_edge(lid.data.materials[0]).inputs["To Min"].default_value = LID_EDGE
    S.parent_to([lid], jar_e)
    jp.append(lid)
    # 뚜껑 결정 한 면만 금빛 키(Fable 3차: 푸른 흰 결정이 금빛 장면에 붙여 넣은 듯) — 단지에 매달아 같이 움직인다
    gk = S.area_light("뚜껑금키", (-0.09, 0.05, 0.072), (0, 0, 0.062), 18.0, 0.02, rgb=(1.0, 0.72, 0.38))  # 낮게 스치게(2.2 · 8 W는 안 보였다)
    gk.visible_camera = False
    gk.parent = jar_e
    S.light_only(gk, [lid])
    # 뚜껑 결정 반짝임 — 점광(20 W)은 결 시험에서 안 보였다. m1 끝과 같은 「얇은 가장자리만 빛나는 띠」가 대각으로 한 번
    glint = M.add_sweep(lid.data.materials[0], (1.0, 1.0, 0.0), width=0.0030, color=(1.0, 0.82, 0.52))
    card = S.serum_card(amp_e, M.m2_cam(1.0), strength=1.3, rgb=(1.0, 0.80, 0.50))
    return jar_e, amp_e, lid, glint, card


def ice_edge(m):
    """M.mat_ice_crystal의 얇은 가장자리 서리(확산 · 투과) 몫 노드 — 「To Min」이 가장 얇은 곳의 몫(m1은 0.55)."""
    return next(x for x in m.node_tree.nodes if x.type == "MAP_RANGE" and abs(x.inputs["From Min"].default_value - 0.10) < 1e-6)


def product_meshes(jar_e, amp_e):
    return [o for o in bpy.context.scene.objects if o.type == "MESH" and o.parent in (jar_e, amp_e)]


INNER_W = 1.6


def inner_light(receivers):
    """돔 안 따뜻한 빛 — 제품 위 뒤쪽 안에서 제품과 돔(전은 조각)만 비춘다. 선물이 안에서 빛나고 서리가 그 빛을 받아 하얗게
    번진다(Fable 1판 「스와로브스키가 안에서 빛나는 것과 반대로 우리는 안이 어둡다」). 카메라 · 투과 광선엔 숨긴다 — 돔 너머로
    빛 공이 보인다(현장노트 「숨긴 면광이 창 유리 너머로 흰 원판」)."""
    lt = S.point_light("돔안빛", (0.0, 0.045, 0.060), INNER_W, (1.0, 0.80, 0.55), radius=0.012)
    lt.visible_camera = False
    lt.visible_transmission = False
    S.light_only(lt, receivers)
    return lt


def aim_serum_card(card, amp_e, cam_loc):
    """앰플 뒤 흰 판을 카메라 반대쪽으로(카메라가 크게 움직이는 승 · 결에서 장마다)."""
    c = amp_e.location.copy()
    d = c - Vector(cam_loc)
    d.z = 0.0
    d.normalize()
    card.location = c + d * 0.045 + Vector((0, 0, 0.040))
    card.rotation_euler = (0.0, 0.0, math.atan2(d.y, d.x) - math.pi / 2)


def link_except(light, skip):
    """이 빛은 skip 밖의 모든 물체만 — 바닥에 띠 빛이 비쳐 흰 줄로 뜨지 않게."""
    S.light_only(light, [o for o in bpy.context.scene.objects if o.type in ("MESH",) and o not in skip])


def link_scene_lights(L, floor, skip=()):
    """역광 · 키 · 윗빛은 바닥을 빼고 비춘다 — 은역광이 검은 유리 바닥에 큰 흰 원판으로 비쳤다(첫 시험 승 끝 장)."""
    for nm in ("금역광", "은역광", "찬키", "윗빛"):
        link_except(L[nm], [floor, *skip])


def world_nodes():
    """sky_world의 둘레 빛 거듭제곱 · 세기 노드, 바탕 세기에 거는 곱, 해 방향(DOT) 노드 — 결에서 둘레 빛을 좁히고(바탕이 납작한
    갈색 판으로 읽힘), 승 머리에서는 어둠에서 차오르게, 승 · 전에서는 둘레를 카메라에서 돔 너머로 돌린다."""
    w = bpy.context.scene.world
    n, l = w.node_tree.nodes, w.node_tree.links
    pw = next(x for x in n if x.type == "MATH" and x.operation == "POWER" and abs(x.inputs[1].default_value - 40.0) < 1e-6)
    gain = next(x for x in n if x.type == "MATH" and x.operation == "MULTIPLY" and abs(x.inputs[1].default_value - 0.30) < 1e-6)
    dot = next(x for x in n if x.type == "VECT_MATH" and x.operation == "DOT_PRODUCT")
    bg = n["Background"]
    src = bg.inputs["Strength"].links[0].from_socket if bg.inputs["Strength"].links else None
    k = n.new("ShaderNodeMath")
    k.operation = "MULTIPLY"
    k.inputs[1].default_value = 1.0
    if src is not None:
        l.new(src, k.inputs[0])
    else:
        k.inputs[0].default_value = bg.inputs["Strength"].default_value
    l.new(k.outputs[0], bg.inputs["Strength"])
    return pw, gain, k, dot


# ── 카메라 · 움직임 블러 ──────────────────────────────────────────────────────
def key3(items, render):
    """앞 · 지금 · 뒤 시각의 자세를 프레임 0 · 1 · 2 열쇠로 박고 1을 굽는다(현장노트 「모션 블러가 안 걸린다」).
    items: [(물체, 함수(dt) → (위치, 오일러))]."""
    for ob, fn in items:
        ob.animation_data_clear()
        for k, dt in enumerate((-1.0 / FPS, 0.0, 1.0 / FPS)):
            loc, rot = fn(dt)
            ob.location = loc
            ob.rotation_euler = rot
            ob.keyframe_insert("location", frame=k)
            ob.keyframe_insert("rotation_euler", frame=k)
    bpy.context.scene.frame_set(1)
    render()


def done(f):
    """--이어를 주면 이미 구운 장은 건너뛴다(끊긴 본 굽기를 다시 부를 때)."""
    return "--이어" in S.argv and os.path.exists(os.path.join(DIR, f"{SHOT}_{f:03d}.png"))


def render_to(f):
    p = os.path.join(DIR, f"{SHOT}_{f:03d}.png")
    bpy.context.scene.render.filepath = p
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"장 {f} {time.time() - t:.1f}초 → {p}", flush=True)


def blur_on():
    sc = bpy.context.scene
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.5
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"


def axial(cam_loc, cam_tgt, p):
    """초점 거리는 화면 축 위 거리 — 화면 가장자리 물체를 곧은 거리로 재면 그만큼 뒤에 맞는다."""
    return (Vector(p) - Vector(cam_loc)).dot((Vector(cam_tgt) - Vector(cam_loc)).normalized())


# ── 승 ────────────────────────────────────────────────────────────────────────
SEUNG_T = 3.0
# m1 끝 자리(결정 앞 15 cm · 8° · 위 1.8 cm)를 결정 틀로 옮긴 자리. 2판: 결정 밑면 가운데(CRYS_C)를 겨누고 결정의 위(E2)를
# 카메라 위로 — 1판은 돔 바깥 면(P0R)을 겨눠 결정이 0.5 mm 비끼고, 세계 위를 써 위도 30°의 P0에서 6° 돌아 디졸브 8장에 윤곽이
# 겹쳤다(Fable 1판 2.9초 「국수 가닥 · 뇌산호」). 거리는 얼음 3.5 mm(굴절률 1.31)와 m1 유리 4 mm(1.5)의 겉보기 깊이 차만큼
CRYS_C = crystal_base()
CAM_S0 = CRYS_C + (E1 * (math.sin(math.radians(8)) * 0.150) + N0 * (math.cos(math.radians(8)) * 0.150) + E2 * 0.018) * 0.9966
FOCUS_S0 = CRYS_C - N0 * 0.0005  # m1과 같은 초점 거리(0.1511) — m1 초점은 굴절로 1.3 mm 앞에 보이는 결정보다 조금 뒤(결정 밑면)
CAM_S1 = M.m2_cam(0.0)
TGT_S1 = M.m2_target(0.0)
HALO_SEUNG = 80.0  # 승의 금빛 둘레 거듭제곱 — 40은 돔 둘레 바탕까지 「베이지 배경지」(2판 첫 시험), 좁혀 돔 너머에만


def seung_cam(t):
    """m1 끝(결정 앞 15 cm · 100 mm · f/16)에서 전 첫 자리(돔 가운데에서 46 cm · 40 mm)로 — 결정에서 잰 거리와 렌즈를
    로그로 같이 옮겨 결정이 한 지수로 작아진다(멈춤 없이). 처음 · 끝은 멈춰 있다(m1 끝 · 금이 가는 순간).
    카메라 위는 결정의 위(E2)에서 세계 위로 물러나며 옮겨 간다."""
    u = smoother(t / SEUNG_T)
    d0, d1 = (CAM_S0 - CRYS_C), (CAM_S1 - CRYS_C)
    dist = lerp_log(d0.length, d1.length, u)
    q = d0.normalized().rotation_difference(d1.normalized())
    dirv = Quaternion().slerp(q, smooth(min(1.0, u * 1.15))) @ d0.normalized()
    loc = CRYS_C + dirv * dist
    tgt = CRYS_C.lerp(TGT_S1, smooth(clamp01((u - 0.05) / 0.80)))
    lens = lerp_log(100.0, 40.0, u)
    fstop = lerp_log(16.0, 8.0, u)
    front = C + (CAM_S1 - C).normalized() * R  # 돔에서 카메라를 보는 앞면
    fp = FOCUS_S0.lerp(front, smooth(clamp01((t - 1.2) / 1.2)))
    up = E2.lerp(UP, smooth(min(1.0, u * 1.25))).normalized()
    return loc, tgt, lens, axial(loc, tgt, fp), fstop, up


def seung_phi(t):
    """서리 머리의 각(rad) — 0.45초에 첫 결정 둘레에서 떠나(카메라가 물러나 잔 결정이 흐리지 않을 때) 점점 빨라져
    2.7초에 돔 뒤까지(그 뒤 0.3초는 다 덮인 돔)."""
    s = clamp01((t - 0.45) / 2.25)
    return A_DEAD - 0.30 + (math.pi + 0.9 - A_DEAD + 0.30) * s ** 1.4


def seung_light(t):
    """장면 빛이 차오르는 몫 — 승 첫 장은 m1처럼 결정만 빛나는 어둠(기 → 승을 한 숏으로 잇는 자리, 첫 시험은 흐린 제품 ·
    흰 줄 빛이 결정 뒤를 채워 m1 끝 장과 딴 그림이었다). 2판: 1.3초 → 2.0초에 다 차게 — 1판 3.6초(승 0.87초)에 이미 69 %가 차
    결정 뒤가 밝은 흐림으로 채워져 결정이 「흰 불투명 플라스틱」이 됐다(Fable P1-5)."""
    return smooth(clamp01((t - 0.30) / 1.7))


def shot_seung():
    arr_img, h_img = frost_maps()
    frost_mat, phi = mat_frost_shell("얼음껍질돔", arr_img, h_img, coord_attr="orig")
    floor, L = build_world()
    dome = dome_object(frost_mat, M.mat_break())
    crystal = first_crystal(M.mat_ice_crystal())
    jar_e, amp_e, lid, glint, card = build_products()
    # 첫 결정은 m1의 네 빛만(결정 틀 기준 같은 자리 · 같은 세기) — 장면 빛은 결정을 빼고 비춘다
    crys = []
    for nm, (x, y, z), e, sz, rgb in CRYSTAL_LIGHTS:
        lt = S.area_light(nm, P0R + E1 * x - N0 * y + E2 * z, P0R, e, sz, rgb=rgb)
        lt.visible_camera = False
        S.light_only(lt, [crystal])
        crys.append((lt, e))
    link_scene_lights(L, floor, skip=[crystal])
    for g in L["반짝"]:
        S.light_only(g, [dome])
    inner = inner_light([dome] + product_meshes(jar_e, amp_e))
    pw, _, wk, hdot = world_nodes()
    pw.inputs[1].default_value = HALO_SEUNG
    ramp = [(lt, lt.data.energy) for lt in [L["금역광"], L["은역광"], inner]]
    ramp += [(o, o.data.energy) for o in bpy.context.scene.objects if o.type == "LIGHT" and o.parent is jar_e]
    # 반짝임 점광은 카메라가 물러난 1.2초 뒤부터 — 가까울 때 결정 바로 앞 돔 겉에 비친 점이 「물방울이 묻었다」(Fable 1판 3.6초,
    # 2판 본 굽기 18~26장에도 남음)
    glints = [(lt, lt.data.energy) for lt in L["반짝"]]
    # 띠 빛 둘은 카메라가 물러난 뒤에 — 가까울 때 돔 겉에 비친 띠가 화면을 가로지르는 흰 줄이었다(2차 시험 15~45장).
    # 2판: 0.6배 — 돔 위에 비친 윗빛이 「흰 붓자국」(Fable 1판 4.6초)
    strips = [(lt, lt.data.energy * 0.6) for lt in (L["찬키"], L["윗빛"])]
    glow_mats = [(m_, m_.node_tree.nodes["Emission"].inputs["Strength"].default_value) for m_ in bpy.data.materials
                 if m_.name.startswith(("전구", "세럼판")) and m_.node_tree and "Emission" in m_.node_tree.nodes]
    cam = S.camera(CAM_S0, P0R, lens=100, fstop=16)
    M.round_bokeh(cam)
    blur_on()
    for f in FRAMES:
        if done(f):
            continue
        t = f / FPS
        phi.outputs[0].default_value = seung_phi(t)
        k = seung_light(t)
        wk.inputs[1].default_value = k
        for ob, e0 in ramp:
            ob.data.energy = e0 * k
        for ob, e0 in glints:
            ob.data.energy = e0 * k * smooth(clamp01((t - 1.2) / 0.6))
        for ob, e0 in strips:
            ob.data.energy = e0 * smooth(clamp01((t - 1.5) / 0.9))
        kc = lerp(1.0, CRYSTAL_K, smooth(clamp01(t / 1.2)))
        for ob, e0 in crys:
            ob.data.energy = e0 * kc
        for m_, s0 in glow_mats:
            m_.node_tree.nodes["Emission"].inputs["Strength"].default_value = s0 * k

        def cam_pose(dt, t=t):
            lo, tg, _, _, _, upv = seung_cam(t + dt)
            return lo, look_rot(lo, tg, upv)
        loc, tgt, lens, focus, fstop, _ = seung_cam(t)
        hdot.inputs[1].default_value = tuple(halo_dir(loc))
        cam.data.lens, cam.data.dof.focus_distance, cam.data.dof.aperture_fstop = lens, focus, fstop
        aim_serum_card(card, amp_e, loc)
        key3([(cam, cam_pose)], lambda f=f: render_to(f))


# ── 전 ────────────────────────────────────────────────────────────────────────
JEON_T = 5.0
CRACK_F = (0, 4)  # 금이 깨지는 자리에서 번져 나가는 장
BURST_F = (4, 14)  # 조각이 멈춘 자리로 터져 나가는 장(빨랐다가 멎음)


def crack_head(f):
    """금 머리의 각 — 0–4장에 깨지는 자리 둘레 CRACK_A까지, 깨짐(4–8장)에 나머지 둘레가 드러난다."""
    if f <= CRACK_F[1]:
        return CRACK_A * f / CRACK_F[1]
    return CRACK_A + (math.pi + 0.3 - CRACK_A) * smooth(min(1.0, (f - CRACK_F[1]) / 4.0))


def burst_u(f):
    """깨짐의 진행 — 4장부터 10장 동안 빨랐다가 멎는다(멈춘 1초의 속도 램프)."""
    x = clamp01((f - BURST_F[0]) / (BURST_F[1] - BURST_F[0]))
    return 1.0 - (1.0 - x) ** 3


def jeon_cam(t):
    s = t / JEON_T
    return M.m2_cam(s), M.m2_target(s)


def view_basis(s):
    E_, T_ = M.m2_cam(s), M.m2_target(s)
    fwd = (T_ - E_).normalized()
    right = fwd.cross(UP).normalized()
    return E_, T_, fwd, right, right.cross(fwd)


TAN_W, TAN_H = 10.125 / 40, 18.0 / 40  # 40 mm · 세로 센서 36 mm(1080×1920)의 반 화각


def push_out(pos, view, lim, depth_ok):
    """그 카메라에서 깊이가 depth_ok인데 화면 축에서 ±lim(깊이) 창 안에 든 것은 가장 가까운 창 가장자리 밖으로."""
    E_, T_, fwd, right, up = view
    rel = pos - E_
    depth = rel.dot(fwd)
    if not depth_ok(depth, (T_ - E_).length):
        return pos
    x, y = rel.dot(right), rel.dot(up)
    lx, ly = lim(depth, (T_ - E_).length)
    if abs(x) >= lx or abs(y) >= ly:
        return pos
    if lx - abs(x) < ly - abs(y):
        return pos + right * (math.copysign(lx, x if x else 1.0) - x)
    return pos + up * (math.copysign(ly, y if y else 1.0) - y)


VIEWS3 = [view_basis(s) for s in (0.0, 0.5, 1.0)]
VIEWS_PATH = [view_basis(k / 20) for k in range(21)]
WIN = 0.075  # 제품 앞 창 반폭(겨냥점 깊이에서, m) — 떠오른 두 제품이 다 든다


def in_front(d, dT):
    return 0.02 < d < dT - 0.045


def clear_view(pos, margin=1.25):
    """끝 화면에서 카메라와 제품 사이(앞쪽)에 걸린 것은 가장 가까운 화면 가장자리 밖으로 — 제품을 가리지 않고 테두리가 된다."""
    return push_out(pos, VIEWS3[2], lambda d, dT: (d * TAN_W * margin, d * TAN_H * margin), in_front)


def clear_front(pos, near_d):
    """2판: 전 내내 제품 앞 · 렌즈 앞을 비운다 — 카메라 s = 0 · 0.5 · 1 세 자리에서 제품 앞 창 밖으로, 카메라 길 위 모든 자리에서
    렌즈 앞 near_d m 안의 화면 밖으로. 1판은 끝 카메라에서만 비워 6.0~6.5초에 조각이 제품을 덮었고(시험관 셋 · Fable),
    렌즈 가까운 조각은 흐려져 「흰 거품 · 솜뭉치」(Fable 7.5 · 9.5 · 11.2초)."""
    for _ in range(3):
        for v in VIEWS3:
            pos = push_out(pos, v, lambda d, dT: (d * WIN / dT, d * WIN / dT), in_front)
        for v in VIEWS_PATH:
            pos = push_out(pos, v, lambda d, dT: (d * TAN_W * 1.15, d * TAN_H * 1.15), lambda d, dT: -0.01 < d < near_d)
    return pos


def build_shatter():
    """조각 · 잔 조각 · 가루를 짓고 멈춘 자리를 정한다(m2 그대로에 바닥 · 결정 조각 · 고친 것). 2판: 액체 금 방울은 뺐다 —
    1판 「갈색 호박 구슬 · 금빛 방울이 뭔지 모르겠다」(Fable · 이해 시험 둘)."""
    arr_img, h_img = frost_maps()
    frost_mat, phi = mat_frost_shell("얼음껍질", arr_img, h_img, coord_attr="orig")
    brk, crack, glow = mat_break_glow(coord_attr="orig")
    masks = [add_crack_mask(frost_mat), add_crack_mask(brk)]
    E = M.m2_cam(1.0)
    v_end = (E - C).normalized()
    path = [M.m2_cam(k / 40) for k in range(41)]

    def path_near(p):
        best, near = 1e9, path[0]
        for a, b in zip(path, path[1:]):
            ab = b - a
            tt = clamp01((p - a).dot(ab) / ab.length_squared)
            q = a + ab * tt
            if (q - p).length < best:
                best, near = (q - p).length, q
        return best, near

    def above_floor(pos, r):
        return Vector((pos.x, pos.y, max(pos.z, ZF + r)))

    rng = random.Random(11)
    movers = []  # [물체, 처음 자리, 처음 회전, 멈춘 자리, 멈춘 회전, 흐름 · 3초, 회전 흐름 · 3초, 종류, 금 벌어짐 몫]
    crystal_piece = None
    for ob, p, c in dome_pieces(frost_mat, brk):
        d = c.normalized()
        push = 0.006 + 0.09 * rng.random() ** 1.3
        if d.dot(v_end) > 0.5:  # 깨진 쪽(카메라 쪽) 조각은 멀리 · 옆으로 터져 큰 틈이 열린다
            push = 0.10 + 0.20 * rng.random()
        is_crystal = (p - P0).length < 1e-6
        if is_crystal:  # 첫 결정이 얹힌 큰 판은 조금만 밀려 왼쪽 위에 떠 있게(멀리 터지면 화면 밖으로 사라진다)
            push = 0.035
        low = c.z < ZF + 0.035  # 바닥에 닿은 아랫단은 바닥을 따라 밀려난다
        if low:
            d = Vector((d.x, d.y, 0.0)).normalized()
            push *= 0.5
        pos = clear_view(C + c + d * push)
        if not low:
            pos = clear_front(pos, 0.22)  # 렌즈 앞 22 cm — 2판 시험 0.15는 f/3.5에서 흐린 큰 조각이 「흰 솜」으로 남았다
        dist, near = path_near(pos)
        if dist < 0.10:
            side = pos - near
            side = side.normalized() if side.length > 1e-6 else d
            pos += side * (0.10 - dist + 0.015)
        r_ob = max((v.co.length for v in ob.data.vertices), default=0.01)
        rot = Vector((0, 0, rng.uniform(-0.3, 0.3))) if low else Vector((rng.uniform(-0.9, 0.9), rng.uniform(-0.9, 0.9), rng.uniform(-0.9, 0.9)))
        if is_crystal:
            rot = rot * 0.25  # 결정이 카메라 쪽을 계속 보게
        if not low:
            pos = above_floor(pos, r_ob * 0.6)
        else:
            pos.z = c.z
        vel = d * rng.uniform(0.004, 0.009)
        spin = Vector([rng.uniform(-1, 1) for _ in range(3)]) * 0.035
        if low:
            vel.z, spin = 0.0, Vector((0, 0, spin.z))
        movers.append([ob, c.copy(), Vector((0, 0, 0)), pos, rot, vel, spin, "조각", rng.random()])
        if is_crystal:
            crystal_piece = movers[-1]
    # 잔 조각 · 가루 — 카메라 길 10 cm 안 · 제품 앞 · 렌즈 앞에서 비킨다(Fable 3차: 7~8장 모래 같은 금빛 번짐 · 단지 윗면 흰 얼룩,
    # 2판: 1판 렌즈 앞 「흰 거품 · 솜뭉치」 — 길 비우기 잔 조각 4 · 가루 8 cm → 10 cm)
    m_break = M.mat_break()
    jar_c = JAR_FLOAT[0] + Vector((0, 0, 0.03))
    amp_c = AMP_FLOAT[0] + Vector((0, 0, 0.04))

    def near_products(pos, gap):
        return (pos - jar_c).length < 0.050 + gap or (pos - amp_c).length < 0.045 + gap

    for i in range(130):
        d = (Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized() + v_end * 0.6).normalized()
        pos = clear_front(clear_view(C + d * rng.uniform(R * 0.8, R * 2.8), margin=1.05), 0.14)
        if path_near(pos)[0] < 0.10 or pos.z < ZF + 0.01:
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
        start = C + d * R  # 껍질에서 떨어져 나온다
        movers.append([ob, start, Vector((0, 0, 0)), pos, Vector([rng.uniform(-3, 3) for _ in range(3)]),
                       d * rng.uniform(0.006, 0.014), Vector([rng.uniform(-1, 1) for _ in range(3)]) * 0.15, "잔", 0.0])
    for i in range(140):
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized()
        pos = clear_front(clear_view(C + d * rng.uniform(R * 0.95, R * 1.9), margin=1.05), 0.14)
        if path_near(pos)[0] < 0.10 or pos.z < ZF + 0.005 or near_products(pos, 0.03):
            continue
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=0, radius=rng.uniform(0.0004, 0.0016))
        for v in bm.verts:
            v.co.x *= rng.uniform(0.4, 1.6)
            v.co.z *= rng.uniform(0.3, 1.2)
        me = bpy.data.meshes.new(f"가루{i}")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(m_break)
        ob = S.link(bpy.data.objects.new(f"가루{i}", me))
        movers.append([ob, C + d * R, Vector((0, 0, 0)), pos, Vector([rng.uniform(-3, 3) for _ in range(3)]),
                       d * rng.uniform(0.006, 0.012), Vector([rng.uniform(-1, 1) for _ in range(3)]) * 0.2, "가루", 0.0])
    return movers, crystal_piece, (phi, crack, glow, frost_mat.node_tree.nodes["EDGE"], frost_mat.node_tree.nodes["FROSTW"], masks,
                                   frost_mat, brk)


def attach_crystal_lights(crystal, origin):
    """전의 첫 결정 — 승과 같은 m1의 네 빛(결정 틀 기준 같은 자리, 세기는 승 끝과 같은 CRYSTAL_K배)을 결정 물체에 매달아
    조각과 같이 움직이게. 승은 결정이 이 빛만 받고 전에서 장면 빛을 받으면 컷 자리에서 결정 밝기가 튄다."""
    for nm, (x, y, z), e, sz, rgb in CRYSTAL_LIGHTS:
        lt = S.area_light(nm, P0R + E1 * x - N0 * y + E2 * z, P0R, e * CRYSTAL_K, sz, rgb=rgb)
        lt.visible_camera = False
        S.light_only(lt, [crystal])
        lt.location = lt.location - origin  # 결정 물체(원점 = 조각 무게중심, 회전 0)에 매단다
        lt.parent = crystal


def mover_pose(mv, f_local, t_after=None):
    """조각 하나의 자세 — 금(0–4장): 깨지는 자리 둘레(CRACK_A 안)부터 0.4~1.6 mm 바깥으로(그 밖은 깨짐 장에), 깨짐(4–14장):
    멈춘 자리로 빨랐다가 멎음, 그 뒤: 3초에 몇 mm만 흐름. 장은 소수(움직임 블러의 앞뒤 시각)."""
    ob, p_start, r_start, p_stop, r_stop, vel, spin, kind, key = mv
    t = f_local / FPS
    if kind in ("조각", "결정"):
        d = p_start.normalized()
        ang = d.angle(V_END)
        crack_at = CRACK_F[0] + (CRACK_F[1] - CRACK_F[0]) * min(1.0, ang / CRACK_A)
        open_ = 0.0004 + 0.0012 * key  # 결정은 그 조각과 같은 몫(key를 물려받음)
        crack_off = d * open_ * clamp01((f_local - crack_at) / 1.5)
    else:
        crack_off = Vector((0, 0, 0))
    b = burst_u(f_local)
    drift = max(0.0, t - BURST_F[1] / FPS) / 3.0
    pos = (p_start + crack_off).lerp(p_stop, b) + vel * drift
    rot = Vector(r_start).lerp(Vector(r_stop), b) + spin * drift
    return pos, Euler(rot)


def product_pose(stand, float_, drift, f_local):
    """제품 — 깨짐에 바닥에서 살짝 떠올라(4–16장, 조각보다 조금 느리게) 기운 채 멈춘다."""
    x = clamp01((f_local - BURST_F[0]) / 12.0)
    b = 1.0 - (1.0 - x) ** 3
    t = f_local / FPS
    dr = max(0.0, t - 16 / FPS) / 3.0
    pos = stand[0].lerp(float_[0], b) + drift[0] * dr
    rot = qlerp(stand[1], float_[1], b)
    return pos, Euler(Vector(rot) + drift[1] * dr)


def shot_jeon():
    floor, L = build_world()
    movers, crystal_piece, (phi, crack, glow, edge_n, frostw, masks, frost_mat, brk) = build_shatter()
    cover = dome_object(frost_mat, brk)  # 깨지기 전 장의 온전한 돔(승 끝과 같은 그림) — 금 머리 밖은 이것이 보인다(add_crack_mask)
    cover["덮개"] = 1.0
    jar_e, amp_e, lid, glint, card = build_products()
    crystal = first_crystal(M.mat_ice_crystal())
    # 첫 결정은 그 결정이 얹힌 큰 조각과 같이 움직인다 — 원점을 조각 무게중심으로
    c0 = crystal_piece[1]
    me = crystal.data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3) - np.array(c0, np.float32)
    me.vertices.foreach_set("co", co.ravel())
    me.update()
    crystal.location = c0
    attach_crystal_lights(crystal, c0)
    movers.append([crystal] + crystal_piece[1:7] + ["결정", crystal_piece[8]])
    shards = [m[0] for m in movers if m[0].type == "MESH" and m[0] is not crystal] + [cover]
    for g in L["반짝"]:
        S.light_only(g, shards)
    link_scene_lights(L, floor, skip=[crystal])
    strips = [(lt, lt.data.energy) for lt in (L["찬키"], L["윗빛"])]  # 승 끝의 0.6배에서 깨짐 동안 1배로
    # 돔 안 빛은 승 끝과 같은 세기에서 — 껍질이 깨지며 갇혔던 빛이 빠진다(4–20장)
    inner = inner_light([m[0] for m in movers if m[7] == "조각"] + [cover] + product_meshes(jar_e, amp_e))
    pw, _, _, hdot = world_nodes()
    aim_serum_card(card, amp_e, M.m2_cam(1.0))
    cam = S.camera(M.m2_cam(0), M.m2_target(0), lens=40, fstop=8.0)
    M.round_bokeh(cam)
    blur_on()
    front = C + (M.m2_cam(0) - C).normalized() * R
    for f in FRAMES:
        if done(f):
            continue
        t = f / FPS
        # 금 — 깨지는 자리 둘레에서 0–4장에 번지며 머리만 번쩍이고(5장에 꺼짐), 지나간 금은 맑은 틈으로 남는다
        crack.outputs[0].default_value = crack_head(f)
        glow.outputs[0].default_value = 1.0 * (1.0 if f <= 3 else max(0.0, 1.0 - (f - 3) / 2.0))  # 6은 「흰 벌집 그물」(2차 시험), 2판 2 → 1
        inner.data.energy = INNER_W * (1.0 - smooth(clamp01((f - 4) / 16.0)))
        frostw.outputs[0].default_value = lerp(FROST_WHITE, FROST_SHARD, smooth(clamp01((f - 4) / 12.0)))  # 깨지며 서리 흰빛이 가라앉음
        for ob, e0 in strips:
            ob.data.energy = e0 * lerp(0.6, 1.0, smooth(clamp01((f - 4) / 16.0)))
        for cv, sa in masks:
            cv.outputs[0].default_value = crack_head(f)
            sa.outputs[0].default_value = 1.0 if f >= CRACK_F[1] else 0.0
        cover.hide_render = f >= CRACK_F[1]
        loc, tgt = jeon_cam(t)
        hdot.inputs[1].default_value = tuple(halo_dir(loc))
        pw.inputs[1].default_value = lerp(HALO_SEUNG, 40.0, smooth(clamp01(f / 60.0)))  # 승 끝의 좁은 둘레에서 1판 넓이로(결은 40에서)
        jar_front = (JAR_FLOAT[0] + Vector((0, 0, 0.03))) + (loc - JAR_FLOAT[0]).normalized() * 0.033
        lid_top = jar_e.location + jar_e.rotation_euler.to_matrix() @ Vector((0, 0, 0.0628))
        k_focus = smooth(clamp01((f - 4) / 26.0))  # 깨짐 뒤 0.9초 — 돔 앞면에서 단지 앞면(이름)으로
        k_lid = smooth(max(0.0, (t - 4.1) / 0.9))  # 끝 0.9초 — 뚜껑 결정으로
        fpt = front.lerp(jar_front, k_focus).lerp(lid_top, k_lid)
        cam.data.dof.focus_distance = (fpt - loc).length
        cam.data.dof.aperture_fstop = lerp_log(8.0, 3.5, k_focus)

        def pose_of(mv, f=f):
            return lambda dt: mover_pose(mv, f + dt * FPS)

        items = [(mv[0], pose_of(mv)) for mv in movers]
        items.append((jar_e, lambda dt, f=f: product_pose(JAR_STAND, JAR_FLOAT, JAR_DRIFT, f + dt * FPS)))
        items.append((amp_e, lambda dt, f=f: product_pose(AMP_STAND, AMP_FLOAT, AMP_DRIFT, f + dt * FPS)))

        def cam_pose(dt, t=t):
            lo, tg = jeon_cam(t + dt)
            return lo, (tg - lo).to_track_quat("-Z", "Y").to_euler()
        items.append((cam, cam_pose))
        for mv in movers:  # 잔 조각 · 가루는 깨짐과 함께 맺힌다(깨지기 전 돔 위에 붙어 보이지 않게)
            if mv[7] in ("잔", "가루"):
                s = smooth(clamp01((f - 4) / 3.0))
                mv[0].scale = (max(1e-4, s),) * 3
        aim_serum_card(card, amp_e, loc)
        key3(items, lambda f=f: render_to(f))


# ── 결 ────────────────────────────────────────────────────────────────────────
GYEOL_T = 4.0
STILL_AT = 3.0  # 14.0초부터 카메라 정지
LAND = {"단지": 1.30, "앰플": 1.15}  # 바닥에 닿는 때(결 시각) — 12.3 · 12.15초
GLINT_AT = 2.0  # 13.0초 뚜껑 결정 반짝임 · 유리 종
FALL_T0, FALL_T1 = 0.10, 1.95  # 첫 결정이 조각에서 떨어져 내려와 뚜껑 결정에 겹쳐 앉는 때(앉는 순간 반짝임 · 유리 종)
FADE_T = 0.15  # 겹쳐 앉은 결정이 뚜껑 결정으로 스며드는 몫(초)
CAM_G1_TGT = Vector((0.006, -0.003, ZF + 0.055))  # 제품을 조금 아래로 — 위 어둠에 이름 자리
# (방위, 높이, 거리, 렌즈, 조리개) — 첫 시험 21° · 33.5 cm는 단지가 오른쪽에서 잘리고 뚜껑 결정이 작았다
CAM_G1 = (math.radians(2), math.radians(27), 0.44, 50.0, 4.5)
# 결의 뚜껑 금빛 키 — 1판 25 W는 맑은 결정 가장자리를 하얗게 날렸다(2판 진단, LID_EDGE와 함께 낮춤)
GK_END = 16.0


def gyeol_cam(t):
    """전 끝(30 cm · 3° · 40 mm)에서 위로 오르며 물러나 뚜껑 결정이 보이는 27°로 — 한 번에 빨라졌다 멎고, 마지막 1초는 멈춤."""
    u = smoother(min(1.0, t / STILL_AT))
    e0, t0 = M.m2_cam(1.0), M.m2_target(1.0)
    tgt = t0.lerp(CAM_G1_TGT, u)
    rel0 = e0 - CAM_G1_TGT
    az0 = math.atan2(rel0.x, -rel0.y)
    el0 = math.asin(rel0.z / rel0.length)
    az1, el1, d1, lens1, f1 = CAM_G1
    az, el, d = lerp(az0, az1, u), lerp(el0, el1, u), lerp(rel0.length, d1, u)
    loc = CAM_G1_TGT + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * d
    # 처음은 전 끝 자리 그대로(돌아가는 중심이 달라 생기는 튐을 0으로)
    loc = loc + (e0 - (CAM_G1_TGT + Vector((math.sin(az0) * math.cos(el0), -math.cos(az0) * math.cos(el0), math.sin(el0))) * rel0.length)) * (1 - u)
    return loc, tgt, lerp_log(40.0, lens1, u), lerp_log(3.5, f1, u)


def land_pose(float_end, stand, t_land, wob_amp, r_base, t):
    """떠 있던 자세에서 바닥으로 — 0.2초부터 빨라지며(떨어지듯) 내려와 t_land에 닿고, 기운 몫이 작게 두세 번 흔들린 뒤 멈춘다.
    기운 만큼 몸을 들어 바닥 쪽 밑 모서리가 바닥에 머문다(밑면 가운데로 돌면 반대쪽 모서리가 바닥을 뚫는다)."""
    p0, e0 = float_end
    ps, es = stand
    t0 = 0.20
    if t <= t0:
        pos, rot = p0.copy(), e0.copy()
    elif t < t_land:
        x = (t - t0) / (t_land - t0)
        pos = p0.lerp(ps, x * x)  # 내려옴은 떨어지듯 빨라진다
        rot = qlerp(e0, Euler((math.radians(wob_amp), 0.0, es.z)), smooth(x))  # 바로 섬은 부드럽게
    else:
        w = t - t_land
        a = math.radians(wob_amp) * math.exp(-5.5 * w) * math.cos(2 * math.pi * 3.2 * w)
        pos, rot = ps.copy(), Euler((a, 0.0, es.z))
    tilt = (rot.to_matrix() @ Vector((0, 0, 1))).angle(Vector((0, 0, 1)))
    pos.z = max(pos.z, ZF + r_base * math.sin(tilt))
    return pos, rot


def add_fade(m):
    """재질을 FADE 값 노드(0 = 그대로, 1 = 투명)로 사라지게 — 떨어진 결정이 뚜껑 결정에 겹쳐 앉은 뒤 스며든다."""
    n, l = m.node_tree.nodes, m.node_tree.links
    out = next(x for x in n if x.type == "OUTPUT_MATERIAL")
    base = out.inputs["Surface"].links[0].from_socket
    v = n.new("ShaderNodeValue")
    v.name = "FADE"
    v.outputs[0].default_value = 0.0
    tr = n.new("ShaderNodeBsdfTransparent")
    mx = n.new("ShaderNodeMixShader")
    l.new(v.outputs[0], mx.inputs["Fac"])
    l.new(base, mx.inputs[1])
    l.new(tr.outputs[0], mx.inputs[2])
    l.new(mx.outputs[0], out.inputs["Surface"])
    return v


def shot_gyeol():
    floor, L = build_world()
    movers, crystal_piece, (phi, crack, glow, edge_n, frostw, _, _, _) = build_shatter()
    jar_e, amp_e, lid, glint, card = build_products()
    # 첫 결정이 조각에서 떨어져 내려와 뚜껑 결정에 겹쳐 앉는다(opus 제안) — 뚜껑 결정과 같은 판(lid_array · 같은 재질)을
    # 처음엔 첫 결정 크기(0.032/0.056)로 · 첫 결정 자리 · 결 방향(결 = 돔 안쪽, x → E1 · y → −E2 · z → −N0)으로 두고 시작한다
    fall_mat = M.mat_ice_crystal()
    fall_edge = ice_edge(fall_mat)  # 처음은 첫 결정(m1)의 0.55, 앉으며 뚜껑 결정 값으로
    fade = add_fade(fall_mat)
    fall = S.relief_sheet("떨어지는결정", lid_array(), LID_SIZE, 0.0, LID_HMAX, fall_mat, step=1)
    fall_lights = []
    for nm, (x, y, z), e, sz, rgb in CRYSTAL_LIGHTS:  # 전과 같은 네 빛을 결정 틀에 매단 자리로(크기는 따라가지 않는다)
        lt = S.area_light(nm, (0, 0, 0.1), (0, 0, 0), e * CRYSTAL_K, sz, rgb=rgb)
        lt.visible_camera = False
        S.light_only(lt, [fall])
        fall_lights.append((lt, Vector((x, -z, y - 0.0035))))
    shards = [m[0] for m in movers if m[0].type == "MESH"]
    for g in L["반짝"]:
        S.light_only(g, shards)
    link_scene_lights(L, floor, skip=[fall])
    crack.outputs[0].default_value = math.pi + 0.3
    glow.outputs[0].default_value = 0.0
    frostw.outputs[0].default_value = FROST_SHARD  # 전 끝과 같게
    f_end = int(JEON_T * FPS) - 1  # 전 마지막 장의 멈춘 자리에서 이어 간다
    E, T = M.m2_cam(1.0), M.m2_target(1.0)
    fwd = (T - E).normalized()
    right = fwd.cross(UP).normalized()
    up = right.cross(fwd)
    starts = {}
    for mv in movers:
        p, r = mover_pose(mv, f_end)
        rel = p - E
        sx, sy = rel.dot(right), rel.dot(up)
        out = (right * sx + up * sy)
        out = out.normalized() if out.length > 1e-6 else up
        out = (out - fwd * 0.25).normalized()
        if p.z < ZF + 0.04:
            out.z = max(out.z, 0.05)
            out.normalize()
        starts[mv[0].name] = (p, Vector(r), out)
    # 2판: 바닥에 남기던 밑동 조각(stay)을 뺐다 — 모든 조각이 화면 밖으로 빠지고, 끝 그림의 얼음은 내려앉는 첫 결정 · 뚜껑 결정이
    # 맡는다. 밑면에서 번지는 바닥 서리도 지어 봤으나 송이 1.9 cm · 8 mm · 3 mm 모두 「종이 눈꽃 깔개 · 흩뿌린 설탕 · 반짝이 가루」라
    # 뺐다(Fable 1판 「안 되면 빼고」) — 검은 유리 바닥 그대로
    jar_end = product_pose(JAR_STAND, JAR_FLOAT, JAR_DRIFT, f_end)
    amp_end = product_pose(AMP_STAND, AMP_FLOAT, AMP_DRIFT, f_end)
    # 떨어지는 결정의 처음 자세 = 전 끝 장의 첫 결정(그 조각의 자세로 돔 좌표를 옮긴 것)
    p_end, r_end = mover_pose(crystal_piece, f_end)
    Rp = r_end.to_matrix()
    loc0 = p_end + Rp @ (crystal_base() - crystal_piece[1])
    q0 = (Rp @ Matrix((E1, -E2, -N0)).transposed()).to_quaternion()
    s0 = CRYSTAL_SIZE / LID_SIZE
    sway_dir = right.copy()

    def lid_world(t):
        jp, jr = land_pose(jar_end, JAR_STAND, LAND["단지"], 2.4, 0.038, t)
        Rj = jr.to_matrix()
        return jp + Rj @ Vector((0, 0, LID_Z + 0.00025)), Rj.to_quaternion()

    def fall_pose(t):
        """조각이 빠지는 동안 남겨진 결정이 눈송이처럼 옆으로 한 번 흔들리며 내려와(크기는 뚜껑 결정까지 자람) 뚜껑에 겹쳐 앉는다.
        눕는 회전은 앉기 조금 전에 끝난다(앉을 땐 평평하게 미끄러져 든다)."""
        w = smoother((t - FALL_T0) / (FALL_T1 - FALL_T0))
        l1, q1 = lid_world(t)
        loc = loc0.lerp(l1, w) + sway_dir * (math.sin(math.pi * w) * 0.012) + UP * (math.sin(math.pi * w) * 0.010)
        q = q0.slerp(q1, smooth(clamp01(w / 0.85)))
        return loc, q, lerp(s0, 1.0, smooth(w))

    pw, gain, _, _ = world_nodes()
    cam = S.camera(E, T, lens=40, fstop=3.5)
    M.round_bokeh(cam)
    blur_on()
    gk = next(o for o in bpy.context.scene.objects if o.name.startswith("뚜껑금키"))
    gk_e0 = gk.data.energy  # 전 끝과 같은 세기에서 시작해 1초에 걸쳐 25 W로(컷 자리에서 튀지 않게)

    def shard_pose(mv, t):
        p, r, out = starts[mv[0].name]
        tau = max(0.0, t)
        k = {"가루": 1.6, "잔": 1.3}.get(mv[7], 1.0)
        disp = 0.55 * k * tau ** 3  # 멈춰 있다가 빨라져 0.9초 안에 화면 밖으로
        return p + out * disp, Euler(r + mv[6] * (tau * 6.0 + 25.0 * tau ** 3))

    for f in FRAMES:
        if done(f):
            continue
        t = f / FPS
        loc, tgt, lens, fstop = gyeol_cam(t)
        cam.data.lens, cam.data.dof.aperture_fstop = lens, fstop
        u = clamp01((t - GLINT_AT) / 0.5)
        glint[0].outputs[0].default_value = -0.035 + 0.07 * smooth(u)
        # 화면에서 가장 밝은 점이 되게(1판 24 — Fable 「부드럽게 밝아질 뿐 또렷한 글린트로는 안 잡힌다」), 10은 흰 결정에 묻혔다
        glint[1].outputs[0].default_value = 0.0 if u <= 0 or u >= 1 else 110.0 * math.sin(math.pi * u) ** 0.7  # 40은 회색 띠(2판 진단)
        edge_n.outputs[0].default_value = lerp(EDGE_WHITE, 0.05, smooth(clamp01((t - 0.3) / 1.7)))
        gk.data.energy = lerp(gk_e0, GK_END, smooth(min(1.0, t / 1.0)))  # 금빛 키가 결정 한 면에 보이게(2.2 · 8 W는 안 보였다)
        w = smooth(clamp01((t - 0.4) / 2.6))  # 시간이 흐르며 둘레 빛이 좁아져 바탕이 밤으로 가라앉는다
        pw.inputs[1].default_value = lerp(40.0, 90.0, w)
        gain.inputs[1].default_value = lerp(0.30, 0.22, w)
        # 떨어지는 결정 — 자리 · 네 빛 · 스며듦
        f_loc, f_q, f_s = fall_pose(t)
        fall.scale = (f_s,) * 3
        Rf = f_q.to_matrix()
        for lt, off in fall_lights:
            lt.location = f_loc + Rf @ off
            lt.rotation_euler = (f_loc - lt.location).to_track_quat("-Z", "Y").to_euler()
        fade.outputs[0].default_value = smooth(clamp01((t - FALL_T1) / FADE_T))
        fall_edge.inputs["To Min"].default_value = lerp(0.55, LID_EDGE, smooth(smoother((t - FALL_T0) / (FALL_T1 - FALL_T0))))
        items = []
        for mv in movers:
            items.append((mv[0], lambda dt, mv=mv, t=t: shard_pose(mv, t + dt)))
        items.append((jar_e, lambda dt, t=t: land_pose(jar_end, JAR_STAND, LAND["단지"], 2.4, 0.038, t + dt)))
        items.append((amp_e, lambda dt, t=t: land_pose(amp_end, AMP_STAND, LAND["앰플"], 1.8, 0.0185, t + dt)))
        e_mid = f_q.to_euler()

        def fall_item(dt, t=t, e_mid=e_mid):
            lo, q, _ = fall_pose(t + dt)
            return lo, q.to_euler("XYZ", e_mid)
        items.append((fall, fall_item))

        def cam_pose(dt, t=t):
            lo, tg, _, _ = gyeol_cam(t + dt)
            return lo, (tg - lo).to_track_quat("-Z", "Y").to_euler()
        items.append((cam, cam_pose))
        jp, jr = land_pose(jar_end, JAR_STAND, LAND["단지"], 2.4, 0.038, t)
        lid_now = jp + jr.to_matrix() @ Vector((0, 0, 0.0628))
        # 초점: 전 끝(뚜껑)에서 0.15–0.6초에 떨어지는 결정으로 옮겨 따라가고, 결정이 뚜껑에 앉으면 다시 뚜껑 자리
        kf = smooth(clamp01((t - 0.15) / 0.45))
        cam.data.dof.focus_distance = lerp(axial(loc, tgt, lid_now), axial(loc, tgt, f_loc), kf)
        aim_serum_card(card, amp_e, loc)
        key3(items, lambda f=f: render_to(f))


def main():
    S.reset()
    os.makedirs(DIR, exist_ok=True)
    {"승": shot_seung, "전": shot_jeon, "결": shot_gyeol}[SHOT]()


if __name__ == "__main__":
    main()

# 지유 광고 v7 · A2 병(서리 → 맑음) 블렌더 장면 — 룩 맞추기 스틸과 제품 컷 여섯(2026-10-21).
# 유호님 「A2로 하고 블렌더로 제품 컷 진행해줘」. v5 블렌더 병(../../블렌더/병_장면.py)은 뚜껑이 몸통의 60%라 목이 드러나는
# 대중 PET 비율이었고 글자를 렌더 위에 얹어 「100원짜리」로 읽혔다 → 벤치마킹 3-3 치수로 다시 짓고, 라벨 원고(../라벨_원고.py의
# label_a2를 4096px 인쇄판으로 뽑은 것)를 서리 유리 위 실크스크린 층으로 입힌다.
#   blender -b --python 병A2_장면.py -- --cut look --view front|45 --quality preview|mid|final --out <폴더>
#   blender -b --python 병A2_장면.py -- --cut P1|P3|P4|P6|P8|P9 --quality … --out <폴더> [--frames 1-36] [--save 장면.blend]
#   --set 이름=값 : 룩 맞추기 때 아래 T의 값을 바꿔 본다(여러 번 줄 수 있다)
# 단위는 m로 짓고 치수는 mm로 적는다. 병 앞면(라벨 가운데)은 -Y(카메라 쪽)를 본다.
import argparse
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--cut", choices=["look", "P1", "P3", "P4", "P6", "P8", "P9"], required=True)
ap.add_argument("--view", choices=["front", "45", "label"], default="front")   # label: 원고와 한 자씩 견줄 라벨 정면 접사
ap.add_argument("--quality", choices=["preview", "mid", "final"], default="preview")
ap.add_argument("--out", required=True)
ap.add_argument("--frames", default="")
ap.add_argument("--save", default="")
ap.add_argument("--device", choices=["GPU", "CPU"], default="GPU")
ap.add_argument("--set", action="append", default=[])
A = ap.parse_args(argv)

V7 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018", "v7")
PLATE = os.path.join(V7, "병시안", "라벨", "A2_인쇄판_4096.png")   # ../라벨_원고.py --인쇄판
MM = 0.001

# ── 병 치수(mm) — 벤치마킹 3-3 + A2 지시문 ─────────────────────────────────────────────
# 몸통 Ø52 · 몸통 높이 117(뚜껑 받침까지) · 뚜껑 44 → 전체 161, 높이 : 폭 3.1(3-3의 3.0~3.8 아래 끝 — A2 시안 2.7에 가깝게),
# 뚜껑은 전체의 27%. 벽 3.5 · 바닥 14(높이의 8.7%) · 어깨는 가로 3.5 · 세로 5 타원(폭의 7~10%).
# 안쪽 부피는 액체 높이(어깨 1cm 아래)까지 약 150ml.
R_OUT, WALL, BASE, H_BODY = 26.0, 3.5, 14.0, 117.0
R_IN = R_OUT - WALL
SH_RX, SH_RZ = 3.5, 5.0
CAP_R, CAP_Z0, CAP_Z1 = 26.15, 117.3, 161.0     # 뚜껑: 몸통보다 0.15mm 크게(같은 지름으로 보이되 면이 겹치지 않게)
LIQ_Z, MEN_H = 103.0, 1.2                        # 액체 윗면 높이 · 벽에 붙어 올라가는 메니스커스


def men_z(d):
    """벽에서 d mm 떨어진 곳의 액체 윗면 높이(2mm 밖은 LIQ_Z)."""
    return LIQ_Z + MEN_H * (math.exp(-d / 0.45) - math.exp(-2.0 / 0.45))

# 룩 맞추기 값(--set 이름=값으로 바꿔 본다)
T = {
    "frost_rough": 0.7,    # 서리 유리 거칠기(현장 노트: 0.27~0.36은 속 액체가 배경을 렌즈처럼 비춘다)
    "frost_lo": 43.0,      # 이 높이(mm) 아래는 맑음 — 몸통 아래 1/3
    "frost_hi": 49.0,      # 이 높이 위는 서리 — 그 사이 6mm(Fable 룩 검수: 13mm는 에어브러시처럼 매끈, A2는 z≈48에 거의 한 선)
    "frost_milk": 0.2,     # 서리에 섞는 흰 반투명(뒤에서 오는 빛에 서리가 빛난다) 비율
    "frost_diffuse": 0.45, # 서리 투과 가운데 흰 확산으로 돌리는 몫(앞에서 오는 빛에 하얗게)
    "cap_base": 0.4,       # 알루미늄 바탕(선형) — 0.78은 흰 판을 비춰 하얀 플라스틱 뚜껑처럼 보였다
    "cap_rough": 0.5,      # 0.4는 뒤 검은 판이 오른쪽 1/3에 거의 검정으로 비쳐 크롬 쪽(Fable)
    "cap_aniso": 0.55,
    "cap_top_rough": 0.16,  # 뚜껑 윗면 거칠기(한 방향 헤어라인이 빛 띠를 길게 늘인다)
    "ink_rough": 0.8,
    "ink_h": 0.0001,       # 잉크 도드라짐 높이(m, 범프) — 30µm는 P6 초접사에서도 1px 아래라 안 보였다(Fable P3-2)
    "grain": 0.000015,     # 서리 잔결 높이(m, 범프)
    "ink_dark": 0.55,     # 잉크 바탕 = 원고 숯색 × 이 값(AgX의 들린 어둠에서 원고처럼 짙게 — 1.0은 강한 빛에 회색으로 들떴다)
    "ink_spec": 0.06,     # 반광 실크 잉크 — 0.25는 키 빛이 글자 왼쪽에 번들거려 「맑」이 「음」보다 옅게 보였다
    "label_k": 0.094,      # 라벨 원고 1px = mm — 0.102는 A2 시안보다 「맑음」 18% · 아랫줄 24% 컸다(Fable 실측, 중간값)
    "label_z": 99.0,       # 원고 y250(MALGEUM 줄)이 놓이는 높이(mm) — 아랫줄 밑이 서리 경계보다 11mm 위
    "expo": -1.8,
    "wall_light": 0.6,
    "card": 0.6,           # 반사판 밝기
    "key": 1.2,
    "band": 1.0,           # P1 · P6 훑는 빛 띠 세기
    "p1_key_w": 0.9,       # P1 키 폭(m) — 0.18은 맑은 부분에 칼같은 흰 막대 202, 0.9에서 126 · 폭 89px
    "p9_key_w": 0.35,      # P9 키 폭(m) — 좁은 키는 맑은 부분에 흰 막대
    "soft_grow": 1.4,      # P1 키 반사판(soft_key) 크기 — 키의 1.4배(10-22 다듬기: 면광 키는 맑은 부분에 칼같은 칼날 · 유령을 비췄다)
    "soft_sigma": 0.25,    # 그 판의 가로 가우스 폭(판 폭 대비) — 가장자리에서 0으로 녹는다
    "soft_sigma_y": 0.25,  # 세로 가우스 폭(판 높이 대비), 가운데 위쪽 — 뚜껑 · 서리가 비치는 쪽
    "soft_sigma_dn": 0.12, # 가운데 아래쪽 — 맑은 부분은 판 아래쪽만 비치고 그 끝을 돌 받침 앞 모서리가 칼같이 자른다(0.25에서 1 → 60이 4px)
    "soft_gain": 1.65,     # 판 가운데 밝기(1.2 = 같은 키 면광과 같은 밝기, 진단 렌더) — 1.2는 뚜껑 평균 168 → 135로 어두웠다
    "p6_ink_spec": 0.03,   # P6만 잉크 반광 — 0.06은 훑는 빛이 지날 때 「맑」이 49 → 63~75로 들떴다(Fable P3)
    "p6_ink_dark": 0.42,   # P6만 잉크 바탕 — 들뜸은 반광보다 정면을 지나는 훑는 빛의 확산광 몫: 21장 「맑」 최소 67(반광만 줄이면 63) → 52
    "key_w": 0.18,         # 키 소프트박스 폭(m) — 0.45는 맑은 아랫부분에 넓은 흰 띠가 져 뿌옇게 보였다
    "fill": 1.6,
    "back": 1.0,
    "amb": 0.05,
    "front": 0.3,          # 앞 반사판 — 0.5는 맑은 부분을 고르게 채워 뿌옇다(Fable)
    "sun": 1.0,
    "glow": 0.3,
    "p1_glow": 1.0,        # P1 뒤빛 · 빛웅덩이 배율(룩 세트의 glow와 따로)
    "p8_cap": 0.5,         # P8 뚜껑 윗면 빛 띠 세기(W) — 윗판을 낮춘 뒤(Fable P1) 띠 하나가 결을 세운다
    "p8_cap_x": 0.013,     # 그 띠를 축에서 비킨 거리(m)
    "p8_shadow": 0.55,     # P8 유리병 그림자 투과 몫
    "p8_top": 0.2,         # P8 윗판(뚜껑 윗면에 비치는 넓은 판) 세기 — 3.0은 원반을 고르게 채워 표준편차 1.8의 흰 원반, 0.2에서 32
    "p4_beam": 1300.0,     # P4 벽 햇빛줄(W) — 2500은 벽이 227로 서리 몸통(222)보다 밝아 병 가장자리가 묻혔다(Fable)
    "p4_room": 0.5,        # P4 반사판 방 밝기
    "p4_world": 0.25,      # P4 주변광
    "p4_cam": 0.008,       # P4 카메라 높이 − 수면(m) — 수면 바로 위(8mm)에서 수면이 화면을 가로지르는 선 · 얇은 띠로 비친다
    "rim": 1.4,            # 뒤 테두리 띠 — 맑은 부분 · 바닥 가장자리 선을 세워 유리 두께가 읽히게
}
T_LOOK = "AgX - Medium High Contrast"
SET_KEYS = set()
for kv in A.set:
    if kv.startswith("look="):
        T_LOOK = kv.split("=", 1)[1]
        continue
    k, v = kv.split("=", 1)
    if k not in T:
        raise SystemExit(f"모르는 값: {k}")
    T[k] = float(v)
    SET_KEYS.add(k)

bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene
S.render.fps = 24


def link(ob):
    S.collection.objects.link(ob)
    return ob


# ── 노드 도우미 ───────────────────────────────────────────────────────────────
def new_mat(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    n, l = m.node_tree.nodes, m.node_tree.links
    for x in list(n):
        if x.type != "OUTPUT_MATERIAL":
            n.remove(x)
    out = [x for x in n if x.type == "OUTPUT_MATERIAL"][0]
    return m, n, l, out


def setin(node, name, value):
    if name in node.inputs:
        node.inputs[name].default_value = value


def bsdf(n, **kw):
    b = n.new("ShaderNodeBsdfPrincipled")
    names = {"base": "Base Color", "metal": "Metallic", "rough": "Roughness", "ior": "IOR", "trans": "Transmission Weight",
             "spec": "Specular IOR Level", "aniso": "Anisotropic", "coat": "Coat Weight", "coat_rough": "Coat Roughness"}
    for k, v in kw.items():
        if k == "base" and len(v) == 3:
            v = (*v, 1.0)
        setin(b, names[k], v)
    return b


def math_node(n, l, op, a, b=None, clamp=False):
    m = n.new("ShaderNodeMath")
    m.operation = op
    m.use_clamp = clamp
    for i, x in enumerate((a, b)):
        if x is None:
            continue
        if isinstance(x, (int, float)):
            m.inputs[i].default_value = x
        else:
            l.new(x, m.inputs[i])
    return m.outputs[0]


def mix_shader(n, l, fac, a, b):
    m = n.new("ShaderNodeMixShader")
    if isinstance(fac, (int, float)):
        m.inputs[0].default_value = fac
    else:
        l.new(fac, m.inputs[0])
    l.new(a, m.inputs[1])
    l.new(b, m.inputs[2])
    return m.outputs[0]


def obj_xyz(n, l):
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Object"], sep.inputs[0])
    return tc, sep


def noise(n, l, vec, scale, detail=4.0, rough=0.5):
    t = n.new("ShaderNodeTexNoise")
    t.inputs["Scale"].default_value = scale
    t.inputs["Detail"].default_value = detail
    t.inputs["Roughness"].default_value = rough
    if vec is not None:
        l.new(vec, t.inputs["Vector"])
    return t.outputs["Fac"]


def srgb(c):
    """sRGB 0~255 → 선형."""
    def f(x):
        x /= 255.0
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return tuple(f(x) for x in c)


# ── 모양: 옆 단면(r, z mm, 그 점에서 시작하는 면의 재질 칸, 모서리 각짐)을 z축으로 돌려 짓는다 ───────────────
# 단면은 재료가 늘 왼쪽에 오게 걷는다 → 면 법선이 오른쪽(재료 밖)을 본다. 유리 안쪽 벽(빈 곳 · 액체와 닿는 곳)도 같은 규칙이라
# 액체와 닿는 벽은 앞(법선 쪽) = 액체, 뒤 = 유리 → 굴절률 1.5/1.33으로 둔다(겹친 두 물체로 흉내 내지 않는다).
def arcpts(cx, cz, rx, rz, a0, a1, n):
    return [(cx + rx * math.cos(a0 + (a1 - a0) * i / n), cz + rz * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


class Prof:
    def __init__(self):
        self.p = []   # [r, z, tag, sharp]

    def add(self, pts, tag, sharp_first=False):
        for i, (r, z) in enumerate(pts):
            if self.p and abs(self.p[-1][0] - r) < 1e-9 and abs(self.p[-1][1] - z) < 1e-9:
                self.p[-1][2] = tag
                if sharp_first and i == 0:
                    self.p[-1][3] = True
                continue
            self.p.append([r, z, tag, sharp_first and i == 0])
        return self

    def line(self, a, b, tag, steps=1, ends=0.0):
        """a→b 곧은 선. ends>0이면 양 끝에서 그 길이(mm)만큼 들어간 곳에 점을 더해 매끈 음영의 법선 번짐을 끝에 가둔다."""
        (r0, z0), (r1, z1) = a, b
        L = math.hypot(r1 - r0, z1 - z0)
        ts = [i / steps for i in range(steps + 1)]
        if ends > 0 and L > 4 * ends:
            e = ends / L
            ts = sorted(set([0.0, e] + [t for t in ts if e < t < 1 - e] + [1 - e, 1.0]))
        return self.add([(r0 + (r1 - r0) * t, z0 + (z1 - z0) * t) for t in ts], tag)


def revolve(name, prof, tags, segs=256):
    verts, faces, fmat, rings = [], [], [], []
    for r, z, tag, sharp in prof.p:
        copies = 2 if sharp else 1
        group = []
        for _ in range(copies):
            if r < 1e-6:
                group.append([len(verts)])
                verts.append((0.0, 0.0, z * MM))
            else:
                idx = []
                for j in range(segs):
                    a = 2 * math.pi * j / segs
                    idx.append(len(verts))
                    verts.append((r * MM * math.cos(a), r * MM * math.sin(a), z * MM))
                group.append(idx)
        rings.append(group)
    for i in range(len(prof.p) - 1):
        A_ = rings[i][-1]       # 각진 점이면 뒤쪽 사본에서 다음 면이 시작한다
        B_ = rings[i + 1][0]
        tag = prof.p[i][2]
        if tag is None:
            continue
        for j in range(segs):
            j2 = (j + 1) % segs
            if len(A_) == 1 and len(B_) == 1:
                continue
            if len(A_) == 1:
                f = (A_[0], B_[j2], B_[j])
            elif len(B_) == 1:
                f = (A_[j], A_[j2], B_[0])
            else:
                f = (A_[j], A_[j2], B_[j2], B_[j])
            faces.append(f)
            fmat.append(tags[tag])
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.polygons.foreach_set("material_index", fmat)
    me.polygons.foreach_set("use_smooth", [True] * len(faces))
    me.update()
    return link(bpy.data.objects.new(name, me))


def bottle_profile():
    P = Prof()
    # 바닥: 가운데가 0.8mm 오목한 받침 → 바닥 모서리 R3
    P.add([(r, 0.8 * (1 - (r / 20.0) ** 2)) for r in (0.0, 5.0, 10.0, 15.0, 20.0)], "out")
    P.add(arcpts(23.0, 3.0, 3.0, 3.0, -math.pi / 2, 0.0, 12), "out")
    # 몸통 → 어깨(타원) → 뚜껑 받침(평평) → 목(뚜껑 속, 보이지 않음)
    P.line((R_OUT, 3.0), (R_OUT, H_BODY - SH_RZ), "out", ends=0.4)
    P.add(arcpts(R_OUT - SH_RX, H_BODY - SH_RZ, SH_RX, SH_RZ, 0.0, math.pi / 2, 16), "out")
    P.line((R_OUT - SH_RX, H_BODY), (16.0, H_BODY), "out", ends=0.3)
    P.add([(16.0, H_BODY)], "out", sharp_first=True)
    P.add([(16.0, 131.0)], "out", sharp_first=True)
    P.add([(12.0, 131.0)], "air", sharp_first=True)            # 입구 → 목 안쪽
    P.add([(12.0, 113.5)], "air", sharp_first=True)
    P.line((12.0, 113.5), (16.0, 113.5), "air")
    P.add(arcpts(16.0, 109.0, R_IN - 16.0, 4.5, math.pi / 2, 0.0, 14), "air")   # 안쪽 어깨 → (22.5, 109)
    zc = men_z(0.0)                                             # 액체가 벽에 닿는 높이
    P.line((R_IN, 109.0), (R_IN, zc), "air", ends=0.3)
    P.line((R_IN, zc), (R_IN, BASE + 5.0), "liq", ends=0.3)
    P.add(arcpts(R_IN - 5.0, BASE + 5.0, 5.0, 5.0, 0.0, -math.pi / 2, 14), "liq")  # 안쪽 바닥 모서리 R5 → (17.5, 14)
    P.line((R_IN - 5.0, BASE), (0.0, BASE), "liq", steps=4)
    P.p[-1][2] = None
    return P


def liquid_profile():
    """액체 윗면: 벽에서 축으로 걷는다(법선이 위 = 공기 쪽). 벽 2mm 안에서 메니스커스가 MEN_H만큼 올라간다."""
    P = Prof()
    pts = []
    for i in range(13):
        d = 2.0 * (i / 12) ** 1.6                                # 벽에서 떨어진 거리 0 → 2mm
        pts.append((R_IN - d, men_z(d)))
    P.add(pts, "top")
    P.line((R_IN - 2.0, LIQ_Z), (0.0, LIQ_Z), "top", steps=6)
    P.p[-1][2] = None
    return P


def cap_profile():
    """뚜껑: 뒤집은 컵(안은 비어 목을 품는다). 재료(금속) 왼쪽 → 법선이 금속 밖."""
    P = Prof()
    P.line((0.0, CAP_Z1 - 2.0), (CAP_R - 1.5, CAP_Z1 - 2.0), "cap", steps=2)
    P.p[-1][3] = True                                            # 안 천장 → 안 치마 모서리
    P.line((CAP_R - 1.5, CAP_Z1 - 2.0), (CAP_R - 1.5, CAP_Z0), "cap")
    P.p[-1][3] = True                                            # 안 치마 → 아래 테 모서리
    P.line((CAP_R - 1.5, CAP_Z0), (CAP_R - 0.4, CAP_Z0), "cap")
    P.add(arcpts(CAP_R - 0.4, CAP_Z0 + 0.4, 0.4, 0.4, -math.pi / 2, 0.0, 6), "cap")
    P.line((CAP_R, CAP_Z0 + 0.4), (CAP_R, CAP_Z1 - 1.0), "cap", ends=0.25)
    P.add(arcpts(CAP_R - 1.0, CAP_Z1 - 1.0, 1.0, 1.0, 0.0, math.pi / 2, 10), "cap")
    P.line((CAP_R - 1.0, CAP_Z1), (0.0, CAP_Z1), "cap", steps=4)
    P.p[-1][2] = None
    return P


# ── 재질 ──────────────────────────────────────────────────────────────────────
INK = srgb((52, 52, 50))        # 라벨 원고와 같은 따뜻한 숯색
SILVER = (0.74, 0.75, 0.76)     # 은색 잉크(선형) — 뚜껑과 같은 금속 한 점


WATER_Z = None   # 병이 물에 서는 컷에서 수면 높이(m, 세계 좌표) — build_bottle 전에 정한다
SHADOW_T = 0.0   # 유리 · 액체가 그림자 광선을 통과시키는 몫(0 = 불투명 그림자). P8만 — 맑은 유리병 그림자는 옅다(Fable P8)


def shadow_pass(n, l, surf):
    """그림자 광선에만 SHADOW_T만큼 투명(따뜻한 유리빛) — 굴절 유리가 그림자를 검정 띠로 만드는 것을 덜어 준다."""
    if SHADOW_T <= 0:
        return surf
    lp = n.new("ShaderNodeLightPath")
    tr = n.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = (1.0, 0.98, 0.94, 1)
    return mix_shader(n, l, math_node(n, l, "MULTIPLY", lp.outputs["Is Shadow Ray"], SHADOW_T), surf, tr.outputs[0])


def ior_switch(n, l, water_z, ior=1.5):
    """세계 높이가 수면 아래면 물 → 유리 굴절률(ior/1.33), 위면 공기 → 유리(ior)."""
    geo = n.new("ShaderNodeNewGeometry")
    sp = n.new("ShaderNodeSeparateXYZ")
    l.new(geo.outputs["Position"], sp.inputs[0])
    under = math_node(n, l, "LESS_THAN", sp.outputs["Z"], water_z)
    return math_node(n, l, "ADD", ior, math_node(n, l, "MULTIPLY", under, ior / 1.33 - ior))


def glass_outer_mat():
    """병 바깥면: 맑은 유리와 산 처리 서리 유리를 높이로 섞고(위 서리 · 가운데 부드럽게 · 아래 1/3 맑게),
    그 위에 인쇄판을 실크스크린 잉크(숯색 · 은색)로 입힌다. 인쇄는 원고 1px = label_k mm로 원기둥을 감아 돈다."""
    m, n, l, out = new_mat("유리_바깥")
    tc, sep = obj_xyz(n, l)
    zmm = math_node(n, l, "MULTIPLY", sep.outputs["Z"], 1000.0)
    # 서리 → 맑음: 0.35mm 알갱이 노이즈로 경계를 ±1.2mm 흩어 기계적인 띠가 아니라 뿌린 산 처리처럼
    dn = noise(n, l, tc.outputs["Object"], 2800.0, 2.0)
    dz = math_node(n, l, "MULTIPLY", math_node(n, l, "SUBTRACT", dn, 0.5), 2.4)
    z2 = math_node(n, l, "ADD", zmm, dz)
    mr = n.new("ShaderNodeMapRange")
    mr.interpolation_type = "SMOOTHERSTEP"
    mr.inputs["From Min"].default_value = T["frost_lo"]
    mr.inputs["From Max"].default_value = T["frost_hi"]
    l.new(z2, mr.inputs["Value"])
    frost = mr.outputs["Result"]
    if WATER_Z is not None:   # 젖은 서리 유리는 맑아진다(물이 산 처리 요철을 메운다) — 수면 아래 서리 몫을 15%로
        geo_w = n.new("ShaderNodeNewGeometry")
        sp_w = n.new("ShaderNodeSeparateXYZ")
        l.new(geo_w.outputs["Position"], sp_w.inputs[0])
        under_w = math_node(n, l, "LESS_THAN", sp_w.outputs["Z"], WATER_Z)
        frost = math_node(n, l, "MULTIPLY", frost, math_node(n, l, "SUBTRACT", 1.0, math_node(n, l, "MULTIPLY", under_w, 0.85)))
    # 서리 결: 0.05mm 잔 알갱이(접사에서 보이는 산 처리 표면)
    fb = n.new("ShaderNodeBump")
    fb.inputs["Distance"].default_value = T["grain"]
    l.new(math_node(n, l, "MULTIPLY", frost, 0.6), fb.inputs["Strength"])
    l.new(noise(n, l, tc.outputs["Object"], 26000.0, 3.0, 0.6), fb.inputs["Height"])
    clear = bsdf(n, base=(1, 1, 1), rough=0.0, ior=1.5, trans=1.0)
    if WATER_Z is not None:   # 물에 잠긴 컷(P4 · P8): 수면 아래 바깥면은 물 → 유리(1.5/1.33) — 서리도 물속에선 덜 흩어 맑아진다
        ior = ior_switch(n, l, WATER_Z)
    # 산 처리 표면은 빛을 흩어 하얗게 보인다: 투과 일부를 흰 확산으로(빛이 앞에서 와도 서리가 우윳빛으로 밝다)
    frosted = bsdf(n, base=(0.95, 0.94, 0.92), rough=T["frost_rough"], ior=1.5, trans=1.0 - T["frost_diffuse"])
    l.new(fb.outputs["Normal"], frosted.inputs["Normal"])
    if WATER_Z is not None:
        l.new(ior, clear.inputs["IOR"])
        l.new(ior, frosted.inputs["IOR"])
    fr = frosted.outputs[0]
    if T["frost_milk"] > 0:
        milk = n.new("ShaderNodeBsdfTranslucent")
        milk.inputs["Color"].default_value = (0.9, 0.9, 0.9, 1)
        fr = mix_shader(n, l, T["frost_milk"], fr, milk.outputs[0])
    glass = mix_shader(n, l, frost, clear.outputs[0], fr)
    # 인쇄: θ = atan2(y, x), 앞(-Y)에서 잰 각 φ = θ + π/2 → 원고 u, 높이 → 원고 v
    th = math_node(n, l, "ARCTAN2", sep.outputs["Y"], sep.outputs["X"])
    phi = math_node(n, l, "ADD", th, math.pi / 2)
    phi = math_node(n, l, "SUBTRACT", phi, math_node(n, l, "MULTIPLY", math_node(n, l, "GREATER_THAN", phi, math.pi), 2 * math.pi))
    u = math_node(n, l, "ADD", math_node(n, l, "MULTIPLY", phi, R_OUT / (T["label_k"] * 1000.0)), 0.5)
    vpx = math_node(n, l, "ADD", math_node(n, l, "MULTIPLY", math_node(n, l, "SUBTRACT", T["label_z"], zmm), 1.0 / T["label_k"]), 250.0)
    v = math_node(n, l, "SUBTRACT", 1.0, math_node(n, l, "DIVIDE", vpx, 1400.0))
    uv = n.new("ShaderNodeCombineXYZ")
    l.new(u, uv.inputs["X"])
    l.new(v, uv.inputs["Y"])
    img = bpy.data.images.load(PLATE, check_existing=True)
    img.colorspace_settings.name = "Non-Color"
    tex = n.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Cubic"
    tex.extension = "CLIP"
    l.new(uv.outputs[0], tex.inputs["Vector"])
    rgb = n.new("ShaderNodeSeparateColor")
    l.new(tex.outputs["Color"], rgb.inputs[0])
    cover = math_node(n, l, "MAXIMUM", rgb.outputs[0], rgb.outputs[1])
    # 얇게 도드라진 잉크: 덮임 가장자리에 30µm 높이 차 — 지나가는 빛이 획 가장자리에 걸린다
    ib = n.new("ShaderNodeBump")
    ib.inputs["Distance"].default_value = T["ink_h"]
    ib.inputs["Strength"].default_value = 1.0
    l.new(cover, ib.inputs["Height"])
    ink = bsdf(n, base=tuple(c * T["ink_dark"] for c in INK), rough=T["ink_rough"], spec=T["ink_spec"])
    sil = bsdf(n, base=SILVER, metal=1.0, rough=0.3)
    for b in (ink, sil):
        l.new(ib.outputs["Normal"], b.inputs["Normal"])
    paint = mix_shader(n, l, rgb.outputs[1], ink.outputs[0], sil.outputs[0])
    surf = mix_shader(n, l, cover, glass, paint)
    l.new(shadow_pass(n, l, surf), out.inputs["Surface"])
    return m


def glass_inner_mat(name, ior):
    m, n, l, out = new_mat(name)
    l.new(shadow_pass(n, l, bsdf(n, base=(1, 1, 1), rough=0.0, ior=ior, trans=1.0).outputs[0]), out.inputs["Surface"])
    return m


def cap_mat():
    """비드블라스트 + 세로 헤어라인 알루미늄(진짜 금속 재질, 칠한 회색 아님). 윗면은 한 방향 결(위에서 본 컷 P8)."""
    m, n, l, out = new_mat("알루미늄")
    tc, sep = obj_xyz(n, l)
    geo = n.new("ShaderNodeNewGeometry")
    gz = n.new("ShaderNodeSeparateXYZ")
    l.new(geo.outputs["Normal"], gz.inputs[0])
    top = math_node(n, l, "GREATER_THAN", math_node(n, l, "ABSOLUTE", gz.outputs["Z"]), 0.7)
    side_v = n.new("ShaderNodeMapping")
    side_v.inputs["Scale"].default_value = (1.0, 1.0, 0.012)       # 옆면: 세로로 길게 늘인 결
    l.new(tc.outputs["Object"], side_v.inputs["Vector"])
    top_v = n.new("ShaderNodeMapping")
    top_v.inputs["Scale"].default_value = (0.012, 1.0, 1.0)        # 윗면: x로 길게 늘인 결
    l.new(tc.outputs["Object"], top_v.inputs["Vector"])
    ns = noise(n, l, side_v.outputs[0], 5000.0, 6.0, 0.62)
    nt = noise(n, l, top_v.outputs[0], 5000.0, 6.0, 0.62)
    mx = n.new("ShaderNodeMix")
    mx.data_type = "FLOAT"
    l.new(top, mx.inputs[0])
    l.new(ns, mx.inputs[2])
    l.new(nt, mx.inputs[3])
    streak = mx.outputs[0]
    # 거칠기: 옆면 cap_rough(룩 검수 값), 윗면은 cap_top_rough — 위에서 내려다보는 P8에서 0.5는 결 없는 무광 회색 원반으로 보였다
    base_rough = math_node(n, l, "ADD", T["cap_rough"], math_node(n, l, "MULTIPLY", top, T["cap_top_rough"] - T["cap_rough"]))
    rough = math_node(n, l, "ADD", math_node(n, l, "MULTIPLY", math_node(n, l, "SUBTRACT", streak, 0.5), 0.24), base_rough)
    base = math_node(n, l, "ADD", math_node(n, l, "MULTIPLY", math_node(n, l, "SUBTRACT", streak, 0.5), 0.09), T["cap_base"])
    b = bsdf(n, metal=1.0, aniso=T["cap_aniso"])
    l.new(rough, b.inputs["Roughness"])
    bc = n.new("ShaderNodeCombineColor")
    for i in range(3):
        l.new(base, bc.inputs[i])
    l.new(bc.outputs[0], b.inputs["Base Color"])
    tg = n.new("ShaderNodeTangent")
    tg.direction_type = "RADIAL"
    tg.axis = "Z"
    tv = n.new("ShaderNodeMix")
    tv.data_type = "VECTOR"
    l.new(top, tv.inputs[0])
    l.new(tg.outputs[0], tv.inputs[4])
    tv.inputs[5].default_value = (0.0, 1.0, 0.0)
    l.new(tv.outputs[1], b.inputs["Tangent"])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.22
    bump.inputs["Distance"].default_value = 0.00002
    l.new(streak, bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def liquid_mat():
    m, n, l, out = new_mat("토너_윗면")
    l.new(shadow_pass(n, l, bsdf(n, base=(1, 1, 1), rough=0.0, ior=1.33, trans=1.0).outputs[0]), out.inputs["Surface"])
    return m


BOTTLE_ONLY = bpy.data.collections.new("병만")   # 빛 연결: 이 빛들은 병(유리 · 액체 · 뚜껑)만 밝힌다
BACKDROP = bpy.data.collections.new("배경만")    # 배경 빛이 밝히는 받침 · 바닥


def only_bottle(*lights):
    """제품 사진처럼 병 빛과 배경 빛을 나눈다 — 병을 밝히는 빛이 뒤 벽 · 받침에 번지지 않게(빛 연결)."""
    for ob in lights:
        ob.light_linking.receiver_collection = BOTTLE_ONLY
    return lights


def build_bottle(rot_deg=0.0):
    mats = [glass_outer_mat(), glass_inner_mat("유리_안_공기", 1.5), glass_inner_mat("유리_안_액체", 1.5 / 1.33)]
    g = revolve("병", bottle_profile(), {"out": 0, "air": 1, "liq": 2})
    for mt in mats:
        g.data.materials.append(mt)
    # 법선 확인: 바깥 벽 면은 바깥을, 액체와 닿는 안쪽 벽은 축 쪽(액체)을 봐야 한다
    me = g.data
    for p in me.polygons:
        c = p.center
        r = math.hypot(c.x, c.y) / MM
        if abs(r - R_OUT) < 0.05 and 30 < c.z / MM < 90:
            assert p.normal.x * c.x + p.normal.y * c.y > 0, "바깥 벽 법선이 안을 본다"
            break
    for p in me.polygons:
        c = p.center
        if p.material_index == 2 and 30 < c.z / MM < 90:
            assert p.normal.x * c.x + p.normal.y * c.y < 0, "액체 벽 법선이 유리를 본다"
            break
    lq = revolve("토너", liquid_profile(), {"top": 0})
    lq.data.materials.append(liquid_mat())
    for p in lq.data.polygons:
        assert p.normal.z > 0, "액체 윗면 법선이 아래를 본다"
        break
    cap = revolve("뚜껑", cap_profile(), {"cap": 0})
    cap.data.materials.append(cap_mat())
    for p in cap.data.polygons:
        c = p.center
        if abs(math.hypot(c.x, c.y) / MM - CAP_R) < 0.05 and p.normal.z == 0:
            assert p.normal.x * c.x + p.normal.y * c.y > 0, "뚜껑 법선이 안을 본다"
            break
    root = link(bpy.data.objects.new("병_묶음", None))
    for ob in (g, lq, cap):
        ob.parent = root
        BOTTLE_ONLY.objects.link(ob)
    root.rotation_euler.z = math.radians(rot_deg)
    return root, g, lq, cap


# ── 세트 재질 ──────────────────────────────────────────────────────────────────
def plaster_mat(name, rgb, bump=0.15):
    m, n, l, out = new_mat(name)
    tc, sep = obj_xyz(n, l)
    b = bsdf(n, base=rgb, rough=0.9, spec=0.3)
    bm = n.new("ShaderNodeBump")
    bm.inputs["Strength"].default_value = bump
    bm.inputs["Distance"].default_value = 0.0005
    l.new(noise(n, l, tc.outputs["Object"], 180.0, 8.0, 0.6), bm.inputs["Height"])
    l.new(bm.outputs["Normal"], b.inputs["Normal"])
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def travertine_mat(name="트래버틴", dark=False):
    """연한 트래버틴: 가로로 흐르는 따뜻한 베이지 결 + 가로로 길쭉한 숭숭한 구멍(어둡고 움푹, 띠를 지어 몰림).
    dark=True면 어두운 돌(P1 받침)."""
    m, n, l, out = new_mat(name)
    tc, sep = obj_xyz(n, l)
    stretch = n.new("ShaderNodeMapping")
    stretch.inputs["Scale"].default_value = (0.6, 1.0, 1.8)           # 결과 구멍이 가로(x)로 흐른다
    l.new(tc.outputs["Object"], stretch.inputs["Vector"])
    band = noise(n, l, stretch.outputs[0], 7.0, 8.0, 0.6)
    ramp = n.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    if dark:
        cr.elements[0].color = (*srgb((34, 32, 30)), 1)
        cr.elements[1].color = (*srgb((66, 61, 56)), 1)
    else:
        cr.elements[0].color = (*srgb((190, 170, 142)), 1)
        cr.elements[1].color = (*srgb((232, 219, 198)), 1)
    cr.elements[0].position = 0.3
    cr.elements[1].position = 0.7
    l.new(band, ramp.inputs[0])
    # 구멍: 늘인 좌표의 보로노이 칸 가운데 일부(색 값으로 고름)에 작은 타원 구멍 — 크기는 노이즈로 들쭉날쭉, 띠를 지어 몰린다
    vor = n.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 150.0
    l.new(stretch.outputs[0], vor.inputs["Vector"])
    cluster = noise(n, l, stretch.outputs[0], 5.0, 2.0)
    sepc = n.new("ShaderNodeSeparateColor")
    l.new(vor.outputs["Color"], sepc.inputs[0])
    pick = math_node(n, l, "LESS_THAN", sepc.outputs[0], math_node(n, l, "MULTIPLY", cluster, 1.15))
    rad = math_node(n, l, "ADD", 0.07, math_node(n, l, "MULTIPLY", noise(n, l, tc.outputs["Object"], 40.0, 2.0), 0.22))
    pit_soft = n.new("ShaderNodeMapRange")
    l.new(vor.outputs["Distance"], pit_soft.inputs["Value"])
    l.new(rad, pit_soft.inputs["From Min"])
    l.new(math_node(n, l, "SUBTRACT", rad, 0.05), pit_soft.inputs["From Max"])
    pit = math_node(n, l, "MULTIPLY", pit_soft.outputs["Result"], pick)
    col = n.new("ShaderNodeMix")
    col.data_type = "RGBA"
    l.new(pit, col.inputs[0])
    l.new(ramp.outputs[0], col.inputs[6])
    col.inputs[7].default_value = (*srgb((158, 136, 108) if not dark else (16, 15, 14)), 1)
    b = bsdf(n, rough=0.6 if not dark else 0.45, spec=0.4)
    l.new(col.outputs[2], b.inputs["Base Color"])
    bm = n.new("ShaderNodeBump")
    bm.inputs["Strength"].default_value = 1.0
    bm.inputs["Distance"].default_value = 0.002
    hgt = math_node(n, l, "SUBTRACT", math_node(n, l, "MULTIPLY", noise(n, l, tc.outputs["Object"], 700.0, 6.0, 0.6), 0.2), pit)
    l.new(hgt, bm.inputs["Height"])
    l.new(bm.outputs["Normal"], b.inputs["Normal"])
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def card(name, size, loc, target, strength, rgb=(1.0, 0.97, 0.93)):
    """반사판: 화면엔 안 나오는 넓은 빛 판 — 금속 뚜껑 · 유리에 부드러운 밝은 면을 비춘다(제품 사진의 흰 판)."""
    m, n, l, out = new_mat(name)
    em = n.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*rgb, 1)
    em.inputs["Strength"].default_value = strength
    l.new(em.outputs[0], out.inputs["Surface"])
    ob = plane(name, size[0], size[1], loc, (0, 0, 0), m)
    look_at(ob, target)
    ob.rotation_euler.rotate_axis("X", math.radians(180))
    ob.visible_camera = False
    ob.visible_shadow = False   # 반사판이 해를 가리면 장면 전체가 그늘이 된다(P4 수조 바닥이 회색으로 죽었다)
    return ob


def soft_key(key):
    """키(면광)의 반사 · 굴절을 맡는 그라데이션 반사판 — 제품 사진에서 소프트박스 가장자리를 녹이는 것(10-22 다듬기).
    면광은 가장자리가 칼같아, 맑은 유리에 비친 키(겉면 반사 칼날 · 병 안에서 한 번 꺾여 나온 유령)가 칼같이 섰다(Fable P3).
    같은 자리에 키의 soft_grow배 판을 두고 가운데에서 가우스로 0까지 빛나게 한다. 키는 확산만 남긴다 — 서리의 우윳빛은
    키의 확산광이라 그대로다. 판은 화면 · 확산 · 그림자에 안 보이고 병만 비춘다. 돌려주는 값: 판, 세기(키 에너지를 움직이는 컷은 같이)."""
    w, h = key.data.size * T["soft_grow"], key.data.size_y * T["soft_grow"]
    m, n, l, out = new_mat(key.name + "_반사판")
    tc, sep = obj_xyz(n, l)
    gx = math_node(n, l, "DIVIDE", sep.outputs["X"], w * T["soft_sigma"])
    up = math_node(n, l, "GREATER_THAN", sep.outputs["Y"], 0.0)   # 판 좌표 +Y = 위(look_at의 위 축)
    sy = math_node(n, l, "ADD", h * T["soft_sigma_dn"], math_node(n, l, "MULTIPLY", up, h * (T["soft_sigma_y"] - T["soft_sigma_dn"])))
    gy = math_node(n, l, "DIVIDE", sep.outputs["Y"], sy)
    r2 = math_node(n, l, "ADD", math_node(n, l, "MULTIPLY", gx, gx), math_node(n, l, "MULTIPLY", gy, gy))
    fall = math_node(n, l, "EXPONENT", math_node(n, l, "MULTIPLY", r2, -1.0))
    em = n.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*key.data.color, 1)
    k = n.new("ShaderNodeValue")
    k.name = "세기"
    k.outputs[0].default_value = T["soft_gain"] * key.data.energy / (key.data.size * key.data.size_y * math.pi)
    l.new(math_node(n, l, "MULTIPLY", fall, k.outputs[0]), em.inputs["Strength"])
    l.new(em.outputs[0], out.inputs["Surface"])
    ob = plane(key.name + "_반사판", w, h, key.location.copy(), (0, 0, 0), m)
    ob.rotation_euler = key.rotation_euler.copy()
    ob.visible_camera = ob.visible_diffuse = ob.visible_shadow = False
    ob.light_linking.receiver_collection = BOTTLE_ONLY
    key.visible_glossy = key.visible_transmission = False
    return ob, k.outputs[0]


def box(name, size, loc, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    # 크기만 굽는다(transform_apply 기본값은 위치 · 회전까지 메시에 구워, 뒤에서 look_at으로 돌리면 원점 둘레로 엉뚱한 데 간다)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        md = ob.modifiers.new("모서리", "BEVEL")
        md.width = bevel
        md.segments = 6
        md.limit_method = "NONE"
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = bevel > 0
    return ob


def plane(name, w, h, loc, rot, mat):
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (w, h, 1)
    # 크기만 굽는다(transform_apply 기본값은 위치 · 회전까지 메시에 구워, 뒤에서 look_at으로 돌리면 원점 둘레로 엉뚱한 데 간다)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    return ob


def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def area(name, size, loc, target, energy, color=(1, 1, 1), size_y=None, spread=None):
    ld = bpy.data.lights.new(name, "AREA")
    ld.shape = "RECTANGLE"
    ld.size = size
    ld.size_y = size if size_y is None else size_y
    ld.energy = energy
    ld.color = color
    if spread is not None:
        ld.spread = math.radians(spread)
    ob = link(bpy.data.objects.new(name, ld))
    ob.location = loc
    look_at(ob, target)
    return ob


def spot(name, pos, target, cone_deg, energy, color=(1, 1, 1), radius=0.01, blend=0.3):
    ld = bpy.data.lights.new(name, "SPOT")
    ld.energy = energy
    ld.color = color
    ld.spot_size = math.radians(cone_deg)
    ld.spot_blend = blend
    ld.shadow_soft_size = radius
    ob = link(bpy.data.objects.new(name, ld))
    ob.location = pos
    look_at(ob, target)
    return ob


def caustics(light, casters, receivers):
    """그림자 커스틱(MNEE): 빛이 병 · 액체를 지나 받침에 모이는 밝은 무늬."""
    light.data.cycles.is_caustics_light = True
    for ob in casters:
        ob.cycles.is_caustics_caster = True
    for ob in receivers:
        ob.cycles.is_caustics_receiver = True


def camera(lens, pos, target, fstop=None, focus=None, res=(1080, 1920), shift=(0.0, 0.0)):
    """shift: 카메라를 기울이지 않고 화면만 옮긴다(제품 사진의 시프트 렌즈 — 병의 세로선이 모이지 않는다)."""
    cd = bpy.data.cameras.new("카메라")
    cd.lens = lens
    cd.sensor_width = 36.0
    cd.sensor_fit = "AUTO"
    cd.shift_x, cd.shift_y = shift
    ob = link(bpy.data.objects.new("카메라", cd))
    ob.location = pos
    look_at(ob, target)
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = focus if focus is not None else (Vector(target) - Vector(pos)).length
    S.camera = ob
    S.render.resolution_x, S.render.resolution_y = res
    return ob


def world(strength, color=(1, 1, 1)):
    w = bpy.data.worlds.new("세계")
    S.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    bg = [x for x in w.node_tree.nodes if x.type == "BACKGROUND"][0]
    bg.inputs["Color"].default_value = (*color, 1)
    bg.inputs["Strength"].default_value = strength


# ── 룩 맞추기 세트: A2 시안(4:5)과 같은 자리 — 트래버틴 받침, 따뜻한 돌회색 벽, 왼쪽 큰 창빛, 오른쪽 뒤 가는 테두리 빛 ──
def flag(name, size, loc, target, rgb=(0.01, 0.01, 0.01)):
    """검은 판(사진의 플래그): 화면엔 안 나오고 유리 가장자리에 어두운 테를 비춘다."""
    m, n, l, out = new_mat(name)
    l.new(bsdf(n, base=rgb, rough=0.9, spec=0.1).outputs[0], out.inputs["Surface"])
    ob = plane(name, size[0], size[1], loc, (0, 0, 0), m)
    look_at(ob, target)
    ob.rotation_euler.rotate_axis("X", math.radians(180))   # 판 앞면(+Z)이 대상 쪽
    ob.visible_camera = False
    ob.visible_shadow = False
    return ob


def window_beam(name, pos, target, cone_deg, energy, color, gobo_dist=0.18, panes=(2, 2), mullion=0.07, radius=0.004):
    """창으로 드는 햇빛: 작은 스포트라이트 앞에 창살 가림판을 세워 벽 · 병 · 받침에 창 그림자를 비스듬히 던진다."""
    ld = bpy.data.lights.new(name, "SPOT")
    ld.energy = energy
    ld.color = color
    ld.spot_size = math.radians(cone_deg)
    ld.spot_blend = 0.15
    ld.shadow_soft_size = radius
    ob = link(bpy.data.objects.new(name, ld))
    ob.location = pos
    look_at(ob, target)
    d = (Vector(target) - Vector(pos)).normalized()
    w = 2 * gobo_dist * math.tan(math.radians(cone_deg) / 2) * 1.05
    m, n, l, out = new_mat(name + "_창살")
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["UV"], sep.inputs[0])
    holes = None
    for ax, k in (("X", panes[0]), ("Y", panes[1])):
        # 칸 사이 창살: frac(k·u)가 창살 폭 안이면 막는다
        fr = math_node(n, l, "FRACT", math_node(n, l, "MULTIPLY", sep.outputs[ax], k))
        open_ = math_node(n, l, "MULTIPLY", math_node(n, l, "GREATER_THAN", fr, mullion / 2),
                          math_node(n, l, "LESS_THAN", fr, 1 - mullion / 2))
        holes = open_ if holes is None else math_node(n, l, "MULTIPLY", holes, open_)
    tr = n.new("ShaderNodeBsdfTransparent")
    dk = n.new("ShaderNodeBsdfDiffuse")
    dk.inputs["Color"].default_value = (0, 0, 0, 1)
    l.new(mix_shader(n, l, holes, dk.outputs[0], tr.outputs[0]), out.inputs["Surface"])
    g = plane(name + "_창살", w, w, Vector(pos) + d * gobo_dist, (0, 0, 0), m)
    g.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    g.rotation_euler.rotate_axis("Z", math.radians(12))       # 창살이 비스듬히
    g.visible_camera = False
    g.visible_glossy = False
    g.visible_transmission = False
    return ob


def look_set():
    rot = -45.0 if A.view == "45" else 0.0
    _, glass, liquid, _ = build_bottle(rot)
    world(T["amb"], srgb((150, 140, 128)))
    wall_rgb = srgb((168, 156, 142))
    wall = plane("벽", 2.4, 1.4, (0, 0.40, 0.45), (math.radians(90), 0, 0), plaster_mat("벽", wall_rgb))
    BACKDROP.objects.link(wall)
    block = box("받침", (0.42, 0.26, 0.08), (0.05, 0.07, -0.04), travertine_mat(), bevel=0.005)
    BACKDROP.objects.link(block)
    warm = (1.0, 0.89, 0.76)
    # 햇빛: 왼쪽 뒤 위에서 — 병 그림자가 오른쪽 앞으로 떨어지고, 그 안에 병을 지난 빛이 모인다(A2 시안의 돌 위 빛 무늬)
    sun = spot("해", (-0.55, 0.30, 0.40), (0.02, -0.02, 0.04), 22.0, 400.0 * T["sun"], (1.0, 0.86, 0.70), radius=0.008)
    caustics(sun, (glass, liquid), (block,))
    # 병 뒤 벽을 은은하게 밝혀 서리 유리가 뒤에서 빛나게(카메라 · 반사에는 안 보이는 빛)
    glow = area("뒤벽빛", 0.12, (0.0, 0.30, 0.03), (0.0, 0.40, 0.14), 6.0 * T["glow"], (1.0, 0.95, 0.88))
    glow.visible_camera = glow.visible_glossy = glow.visible_transmission = False
    # 병 빛(빛 연결로 병만): 왼쪽 45° 큰 소프트박스 키 — 서리가 우윳빛으로, 뚜껑 왼쪽 가운데에 넓은 밝은 띠
    key = area("키", T["key_w"], (-0.39, -0.39, 0.12), (0, 0, 0.085), 30.0 * T["key"], warm, size_y=0.7)
    # 역광: 왼쪽 뒤 125° — 서리를 뒤에서 비추고 맑은 아랫부분 가장자리에 빛을 세운다
    back = area("역광", 0.4, (-0.45, 0.315, 0.12), (0, 0, 0.085), 30.0 * T["back"], (1.0, 0.95, 0.88), size_y=0.7)
    # 뒤 양쪽 세로 띠: 맑은 아랫부분 · 두꺼운 바닥 가장자리에 밝은 선(유리 두께)
    rims = [area(nm, 0.035, (x, y, 0.10), (0, 0, 0.07), e * T["rim"], (1, 0.96, 0.91), size_y=0.45)
            for nm, x, y, e in (("테두리_오른쪽", 0.30, 0.24, 9.0), ("테두리_왼쪽", -0.30, 0.22, 6.0))]
    only_bottle(key, back, *rims)
    # 배경 빛: 받침을 밝히는 넓은 창빛(병은 안 밝힘 — 병은 위의 병 빛으로만)
    fill = area("창빛", 0.6, (-0.75, -0.25, 0.35), (0.05, 0.05, 0.0), 40.0 * T["fill"], warm, size_y=0.6)
    fill.light_linking.receiver_collection = BACKDROP
    # 벽: 왼쪽 멀리서 벽을 스치는 빛 — 왼쪽 위가 밝고 오른쪽 · 아래로 어두워진다
    # 벽빛: 화면 왼쪽 밖을 겨눈 넓은 스포트 — 화면 안에는 빛 가장자리의 부드러운 감쇠만 들어와 왼쪽 위가 밝고 오른쪽이 어둡다
    # 벽은 서리보다 어둡게(Fable: 벽 202 · 서리 203이면 병이 묻힌다) — 룩 세트만 0.75배
    wl = spot("벽빛", (-0.70, -0.35, 0.80), (-0.34, 0.40, 0.30), 40.0, 525.0 * T["wall_light"], (1.0, 0.92, 0.82), radius=0.15, blend=1.0)
    wl.light_linking.receiver_collection = BACKDROP
    # 병 뒤 양옆 검은 판: 맑은 아랫부분 · 바닥 가장자리에 어두운 테(유리 두께가 읽히게)
    flag("검은판_뒤오른쪽", (0.10, 0.30), (0.13, 0.17, 0.08), (0, -0.4, 0.08))
    flag("검은판_뒤왼쪽", (0.10, 0.30), (-0.13, 0.17, 0.08), (0, -0.4, 0.08))
    # 반사판(반사에만 보임 — 벽 · 받침은 밝히지 않는다): 오른쪽 앞 · 카메라 뒤
    for c in (card("반사판_오른쪽앞", (0.3, 0.4), (0.42, -0.42, 0.12), (0, 0, 0.09), T["card"]),
              card("반사판_앞", (0.9, 0.5), (0.0, -1.05, 0.15), (0, 0, 0.09), T["front"])):
        c.visible_diffuse = False
    if A.view == "label":   # 200mm로 라벨 글자 묶음(가로 36 · 세로 43mm)을 화면에 꽉 — 심도는 끈다(원고 대조용)
        zc = (T["label_z"] - 196 * T["label_k"]) * MM
        camera(200, (0, -0.326, zc), (0, 0, zc), res=(1000, 1400))
        return
    # 수평 카메라 + 화면만 아래로(시프트): 병 높이가 화면의 75%, 병 가운데가 위에서 42%(A2 시안과 같은 자리)
    camera(100, (0, -0.596, 0.095), (0, 0, 0.095), fstop=11.0, focus=0.570, res=(1122, 1402), shift=(0.0, -0.149))


def window_gobo_mat():
    """창살 가림판: 격자 네 칸만 빛이 지나간다(나머지는 막음)."""
    m, n, l, out = new_mat("창살")
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Generated"], sep.inputs[0])
    def pane(x0, x1, y0, y1):
        a = math_node(n, l, "MULTIPLY", math_node(n, l, "GREATER_THAN", sep.outputs["X"], x0),
                      math_node(n, l, "LESS_THAN", sep.outputs["X"], x1))
        b = math_node(n, l, "MULTIPLY", math_node(n, l, "GREATER_THAN", sep.outputs["Y"], y0),
                      math_node(n, l, "LESS_THAN", sep.outputs["Y"], y1))
        return math_node(n, l, "MULTIPLY", a, b)
    hole = math_node(n, l, "MAXIMUM", math_node(n, l, "MAXIMUM", pane(0.18, 0.48, 0.15, 0.48), pane(0.52, 0.82, 0.15, 0.48)),
                     math_node(n, l, "MAXIMUM", pane(0.18, 0.48, 0.52, 0.85), pane(0.52, 0.82, 0.52, 0.85)))
    tr = n.new("ShaderNodeBsdfTransparent")
    dk = n.new("ShaderNodeBsdfDiffuse")
    dk.inputs["Color"].default_value = (0, 0, 0, 1)
    l.new(mix_shader(n, l, hole, dk.outputs[0], tr.outputs[0]), out.inputs["Surface"])
    return m


# ── 컷 공통 ────────────────────────────────────────────────────────────────────
T_TINT = (0.84, 0.92, 0.94)   # P4 수면 아래 물빛(앞 유리 두 면을 지나며 두 번 곱해진다)
CUT_EXPO = {"P1": -1.8, "P3": -0.8, "P4": -0.6, "P6": -2.8, "P8": -0.6, "P9": -1.2}
PER_FRAME = []   # 프레임마다 렌더 전에 부르는 것(물 높이 · 커스틱 그림 같은 파이썬 움직임): f(frame)


def keys(owner, prop, pts):
    """pts = [(프레임, 값)] — 블렌더 기본(베지어 · 자동 핸들)이라 출발 · 멈춤이 부드럽다."""
    for f, v in pts:
        setattr(owner, prop, v)
        owner.keyframe_insert(prop, frame=f)


def dark_stone_mat():
    """P1 받침: 거친 현무암(아주 어두운 따뜻한 회색, 결 · 잔 구멍, 빛 띠가 지날 때 윤이 조금 돈다)."""
    m, n, l, out = new_mat("현무암")
    tc, sep = obj_xyz(n, l)
    big = noise(n, l, tc.outputs["Object"], 14.0, 6.0, 0.6)
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*srgb((22, 20, 19)), 1)
    ramp.color_ramp.elements[1].color = (*srgb((52, 48, 44)), 1)
    l.new(big, ramp.inputs[0])
    b = bsdf(n, spec=0.5)
    l.new(ramp.outputs[0], b.inputs["Base Color"])
    rough = math_node(n, l, "ADD", 0.38, math_node(n, l, "MULTIPLY", noise(n, l, tc.outputs["Object"], 60.0, 3.0), 0.35))
    l.new(rough, b.inputs["Roughness"])
    bm = n.new("ShaderNodeBump")
    bm.inputs["Strength"].default_value = 0.9
    bm.inputs["Distance"].default_value = 0.0012
    l.new(math_node(n, l, "ADD", noise(n, l, tc.outputs["Object"], 900.0, 8.0, 0.65),
                    math_node(n, l, "MULTIPLY", noise(n, l, tc.outputs["Object"], 80.0, 4.0), 0.6)), bm.inputs["Height"])
    l.new(bm.outputs["Normal"], b.inputs["Normal"])
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def glow_mat(name, center, sigma, strength, rgb):
    """뒤 배경판: 한 점(center, 물체 좌표 x · y)에서 가우스로 퍼지는 은은한 빛 — 어둠 속 병 실루엣을 떼어 낸다."""
    m, n, l, out = new_mat(name)
    tc, sep = obj_xyz(n, l)
    dx = math_node(n, l, "SUBTRACT", sep.outputs["X"], center[0])
    dy = math_node(n, l, "SUBTRACT", sep.outputs["Y"], center[1])
    r2 = math_node(n, l, "ADD", math_node(n, l, "MULTIPLY", dx, dx), math_node(n, l, "MULTIPLY", dy, dy))
    fall = math_node(n, l, "EXPONENT", math_node(n, l, "MULTIPLY", r2, -1.0 / (sigma * sigma)))
    em = n.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*rgb, 1)
    k = n.new("ShaderNodeValue")
    k.name = "세기"
    k.outputs[0].default_value = strength
    l.new(math_node(n, l, "MULTIPLY", fall, k.outputs[0]), em.inputs["Strength"])
    l.new(em.outputs[0], out.inputs["Surface"])
    return m


def cut_p1():
    """P1 공개(0.0–1.5초 · 36장): 어둠 속 병, 가로로 긴 빛 띠가 위 → 아래로 뚜껑 · 서리 어깨 · 라벨 · 맑은 바닥을 훑고 지나간 자리에
    은은한 빛이 남는다. 망원 100mm, 3% 밀기. 화면 위 300px 근처는 MALGEUM 글자 자리라 어둡게 비운다."""
    S.frame_start, S.frame_end = 1, 36
    build_bottle(0.0)
    world(0.003, srgb((60, 50, 42)))
    slab = box("돌", (0.50, 0.32, 0.06), (0.0, 0.06, -0.03), dark_stone_mat(), bevel=0.004)
    BACKDROP.objects.link(slab)
    gm = glow_mat("뒤빛", (0.0, -0.48), 0.45, 0.40 * T["p1_glow"], srgb((150, 120, 92)))
    plane("뒤", 4.0, 2.4, (0, 1.4, 0.6), (math.radians(90), 0, 0), gm)
    gv = gm.node_tree.nodes["세기"].outputs[0]
    for f, v in ((1, 0.10), (8, 0.10), (33, 0.70)):   # 뒤빛도 띠를 따라 켜진다(처음엔 병이 거의 어둠 속)
        gv.default_value = v * T["p1_glow"]
        gv.keyframe_insert("default_value", frame=f)
    warm = (1.0, 0.88, 0.74)
    # 빛 띠: 병 앞에서 수평으로 쏘는 얇은 빛판(퍼짐 4°) — 병 · 받침에 가로 빛줄이 맺혀 위 → 아래로 내려간다(카메라에는 안 보임).
    # 처음 3장은 뚜껑 위 어둠, 31장째 받침 윗면을 지나 끝난다
    # 병에 닿는 빛줄(병만) — 받침은 따로, 빛줄이 받침 윗면에 닿는 끝 몇 장만 약하게
    band = area("빛띠", 1.2, (0.0, -0.45, 0.205), (0, 0, 0.205), 6.0 * T["band"], warm, size_y=0.05, spread=6.0)
    band.visible_camera = False
    for f, z in ((3, 0.205), (31, -0.004)):
        band.location.z = z
        band.keyframe_insert("location", frame=f)
    only_bottle(band)
    floor_band = area("빛띠_받침", 1.2, (0.0, -0.45, 0.205), (0, 0, 0.205), 6.0 * T["band"], warm, size_y=0.016, spread=5.0)
    floor_band.visible_camera = False
    for f, z in ((3, 0.205), (31, -0.004)):
        floor_band.location.z = z
        floor_band.keyframe_insert("location", frame=f)
    floor_band.light_linking.receiver_collection = BACKDROP
    keys(floor_band.data, "energy", [(24, 0.0), (29, 6.0 * T["band"]), (34, 0.0)])   # 받침 윗면을 스치고 사라진다
    # 병 둘레 받침 위 따뜻한 빛 웅덩이(받침만): 맑은 아랫부분 · 두꺼운 바닥이 이 빛을 굴절해 빛난다 — 키와 함께 켜진다
    pool = spot("빛웅덩이", (0.05, 0.30, 0.55), (0.0, 0.0, 0.0), 26.0, 0.0, (1.0, 0.86, 0.70), radius=0.05, blend=0.8)
    pool.light_linking.receiver_collection = BACKDROP
    keys(pool.data, "energy", [(1, 6.0 * T["p1_glow"]), (8, 6.0 * T["p1_glow"]), (33, 90.0 * T["p1_glow"])])
    # 테두리: 뒤 양쪽 세로 띠(병만) — 처음부터 실루엣의 가는 선
    rims = [area(nm, 0.03, (x, 0.24, 0.10), (0, 0, 0.08), e * T["rim"], (1, 0.95, 0.9), size_y=0.40)
            for nm, x, e in (("테두리_왼쪽", -0.26, 4.0), ("테두리_오른쪽", 0.26, 6.0))]
    top = area("윗빛", 0.20, (0.0, 0.10, 0.45), (0, 0, 0.16), 1.5 * T["rim"], (1, 0.95, 0.9), size_y=0.10)
    # 띠가 지나가며 병이 켜진다: 키(병만)가 띠를 따라 5% → 100%(콘티 P1의 밝기). 키는 넓게 — 좁은 키(0.18m)는 거의 검은 액체 속에
    # 칼같은 흰 막대(202)로 비쳤다(Fable P1)
    key = area("키", T["p1_key_w"], (-0.39, -0.39, 0.12), (0, 0, 0.085), 30.0 * T["key"], warm, size_y=0.7)
    keys(key.data, "energy", [(1, 0.6 * T["key"]), (6, 0.6 * T["key"]), (33, 30.0 * T["key"])])
    # 넓혀도 키의 반사 가장자리는 칼같았다(Fable 재확인 P3) → 반사 · 굴절은 같은 자리 그라데이션 판이 맡고 키와 같이 켜진다
    _, sv = soft_key(key)
    keys(sv, "default_value", [(1, sv.default_value * 0.02), (6, sv.default_value * 0.02), (33, sv.default_value)])
    only_bottle(*rims, top, key)
    # 카메라: 병 꼭대기 높이에서 수평(시프트로 병을 화면 가운데 · 높이 1080px) — 받침 윗면이 12° 비스듬히 보이고, 3% 밀어 들어간다
    cam = camera(100, (0, -0.795, 0.16), (0, 0, 0.16), fstop=8.0, focus=0.77, shift=(0.0, -0.278))
    for f, d in ((1, 0.795), (36, 0.771)):
        cam.location.y = -d
        cam.keyframe_insert("location", frame=f)
        cam.data.dof.focus_distance = d - 0.026
        cam.data.dof.keyframe_insert("focus_distance", frame=f)


def cut_p6():
    """P6 라벨 접사(8.0–9.5초 · 36장): 「맑음」 초접사 — 도톰한 인쇄와 서리 결. 첫 0.35초에 초점이 들어오고(흐림 → 또렷),
    세로 빛 띠가 왼쪽 → 오른쪽으로 라벨을 훑는다. 글자는 얹지 않는다(인쇄가 주인공). 1.5% 밀기."""
    S.frame_start, S.frame_end = 1, 36
    for k in ("ink_spec", "ink_dark"):   # 초접사에선 훑는 빛이 글자 위를 지난다 — 반광은 반으로, 바탕은 조금 짙게(10-22 다듬기)
        if k not in SET_KEYS:
            T[k] = T["p6_" + k]
    build_bottle(0.0)
    world(0.03, srgb((150, 140, 128)))
    wall = plane("벽", 1.6, 1.2, (0, 0.30, 0.30), (math.radians(90), 0, 0), plaster_mat("벽", srgb((176, 164, 150))))
    BACKDROP.objects.link(wall)
    warm = (1.0, 0.89, 0.76)
    # 뒤 벽은 흐린 따뜻한 회베이지(콘티 P6) — 병 양옆이 어둡게 죽지 않게 넓게 밝힌다
    wl = area("벽빛", 0.8, (-0.35, -0.30, 0.45), (0.0, 0.30, 0.10), 160.0 * T["wall_light"], (1.0, 0.92, 0.82), size_y=0.6)
    wl.light_linking.receiver_collection = BACKDROP
    key = area("키", T["key_w"], (-0.39, -0.39, 0.12), (0, 0, 0.08), 30.0 * T["key"], warm, size_y=0.7)
    back = area("역광", 0.4, (-0.45, 0.315, 0.12), (0, 0, 0.08), 30.0 * T["back"], (1.0, 0.95, 0.88), size_y=0.7)
    # 훑는 빛: 라벨 앞 반지름 0.33m 호 위를 왼쪽 -62° → 오른쪽 +62°로 도는 세로 띠 — 반사가 라벨을 -31° → +31°로 가로지른다
    sweep = area("훑는빛", 0.03, (0, -0.33, 0.08), (0, 0, 0.08), 7.0 * T["band"], (1.0, 0.95, 0.9), size_y=0.30)
    for f, a in ((9, -62.0), (36, 62.0)):
        r = math.radians(a)
        sweep.location = (0.33 * math.sin(r), -0.33 * math.cos(r), 0.08)
        look_at(sweep, (0, 0, 0.08))
        sweep.keyframe_insert("location", frame=f)
        sweep.keyframe_insert("rotation_euler", frame=f)
    only_bottle(key, back, sweep)
    # 카메라: 화면 폭 45mm(「맑음」이 화면 폭의 57% — 콘티 P6), 위로 뚜껑 아랫단 · 아래로 맑은 부분 시작. 심도 f/16을 앞면 2.5mm 뒤에
    # 맞춰 가운데 글자는 또렷하고 양 끝은 곡면을 따라 부드럽게 흐린다. 초점은 30mm 앞에서 들어온다
    zc = 0.079
    D0 = 0.222   # 화면 높이 80mm: MALGEUM 22% · 맑음 48% · 아랫줄 68%(label_k 0.094 기준)
    cam = camera(100, (0, -(0.026 + D0), zc), (0, 0, zc), fstop=16.0, focus=D0 + 0.0025)
    for f, d in ((1, D0), (36, D0 * 0.985)):
        cam.location.y = -(0.026 + d)
        cam.keyframe_insert("location", frame=f)
    keys(cam.data.dof, "focus_distance", [(1, D0 - 0.030), (9, D0 + 0.0025), (36, D0 * 0.985 + 0.0025)])


# ── 물: 높이장 h(x, y, t)를 numpy로 매 프레임 수면 메시에 넣고, 같은 높이장으로 바닥에 맺히는 빛 무늬(커스틱)를 그린다 ──
# 수면은 그림자를 드리우지 않게 두고(유리처럼 그림자 광선을 막으면 물속 바닥이 어둡다) 바닥 색에 빛 무늬를 곱한다.
# 빛 무늬는 햇빛 방향 광선을 수면에서 굴절시켜 바닥(깊이 d)에 떨어뜨린 점을 세는 것(평평한 물 = 1).
def ambient_waves(seed, n, amp, lam, speed):
    """잔물결 성분 n개: (진폭 m, 파장 m, 방향, 속도, 위상). 파장은 lam의 0.45~2.2배(로그 고르게), 진폭은 파장에 비례 —
    성분이 적거나 파장이 비슷하면 빛 그물이 벌집처럼 규칙적으로 보인다."""
    rng = np.random.default_rng(seed)
    out = []
    for _ in range(n):
        f = math.exp(math.log(0.45) + (math.log(2.2) - math.log(0.45)) * rng.random())
        out.append((amp * f * (0.7 + 0.6 * rng.random()), lam * f, rng.random() * 2 * math.pi,
                    speed * math.sqrt(f) * (0.7 + 0.6 * rng.random()), rng.random() * 2 * math.pi))
    return out


def h_ambient(X, Y, t, comps):
    h = np.zeros_like(X)
    for a, lam, ang, spd, ph in comps:
        k = 2 * math.pi / lam
        h += a * np.sin(k * (X * math.cos(ang) + Y * math.sin(ang)) - k * spd * t + ph)
    return h


def h_rings(X, Y, t, cx, cy, amp, lam, v_p, v_g, width, r0=0.0):
    """퍼지는 동심원 물결 묶음: 덩어리(포락선)는 v_g로, 마루는 v_p로 나아간다(마루가 묶음 안을 지나가 실제 파문처럼 보인다).
    진폭은 원 둘레가 늘어나는 만큼 1/√r로 준다."""
    r = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2)
    front = r0 + v_g * t
    env = np.exp(-((r - front) / width) ** 2) * np.clip((r - r0) / (0.4 * width) + 0.5, 0, 1)
    return amp * env * np.cos(2 * math.pi / lam * (r - r0 - v_p * t)) * np.sqrt(0.03 / (r + 0.03))


def polar_grid(cx, cy, r_in, r_out, n_r, n_t, growth=8.0):
    """수면 메시(병 둘레 · 파문 가운데): 반지름은 안쪽이 촘촘(기하 간격), 면은 위(+z)를 본다."""
    u = np.linspace(0.0, 1.0, n_r)
    rs = r_in + (r_out - r_in) * (growth ** u - 1) / (growth - 1)
    ts = np.linspace(0.0, 2 * math.pi, n_t, endpoint=False)
    R, TT = np.meshgrid(rs, ts, indexing="ij")
    X, Y = cx + R * np.cos(TT), cy + R * np.sin(TT)
    i, j = np.meshgrid(np.arange(n_r - 1), np.arange(n_t), indexing="ij")
    j2 = (j + 1) % n_t
    F = np.stack([i * n_t + j, (i + 1) * n_t + j, (i + 1) * n_t + j2, i * n_t + j2], -1).reshape(-1, 4)
    return X.ravel(), Y.ravel(), F


def rect_grid(xs, ys, hole=None):
    """수면 메시(넓은 판): hole = (x0, x1, y0, y1) 칸은 비운다(받침이 수면을 뚫는 자리 — 격자선을 그 모서리에 맞춰 둔다)."""
    X, Y = np.meshgrid(xs, ys)
    nx = len(xs)
    iy, ix = np.meshgrid(np.arange(len(ys) - 1), np.arange(nx - 1), indexing="ij")
    F = np.stack([iy * nx + ix, iy * nx + ix + 1, (iy + 1) * nx + ix + 1, (iy + 1) * nx + ix], -1).reshape(-1, 4)
    if hole:
        cxs = (xs[ix] + xs[ix + 1]).ravel() / 2
        cys = (ys[iy] + ys[iy + 1]).ravel() / 2
        keep = ~((cxs > hole[0]) & (cxs < hole[1]) & (cys > hole[2]) & (cys < hole[3]))
        F = F[keep]
    return X.ravel(), Y.ravel(), F


def water_mat():
    m, n, l, out = new_mat("물")
    l.new(bsdf(n, base=(1, 1, 1), rough=0.0, ior=1.33, trans=1.0).outputs[0], out.inputs["Surface"])
    return m


def water_surface(name, X, Y, F, z0, hfun):
    """수면 물체를 만들고, 프레임마다 높이를 바꾸는 함수를 PER_FRAME에 건다(t = (프레임-1)/24초)."""
    V = np.stack([X, Y, np.full_like(X, z0)], -1).astype(np.float32)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(V))
    me.vertices.foreach_set("co", V.ravel())
    me.loops.add(F.size)
    me.loops.foreach_set("vertex_index", F.ravel().astype(np.int32))
    me.polygons.add(len(F))
    me.polygons.foreach_set("loop_start", np.arange(0, F.size, 4, dtype=np.int32))
    me.update(calc_edges=True)
    me.polygons.foreach_set("use_smooth", np.ones(len(F), dtype=bool))
    me.materials.append(water_mat())
    ob = link(bpy.data.objects.new(name, me))
    ob.visible_shadow = False

    def update(f):
        t = (f - 1) / 24.0
        V[:, 2] = z0 + hfun(X, Y, t)
        me.vertices.foreach_set("co", V.ravel())
        me.update()
    PER_FRAME.append(update)
    return ob


def gauss_blur(img, sigma):
    """FFT로 가우스 흐림(빛 무늬 점 세기의 알갱이를 고른다)."""
    if sigma <= 0:
        return img
    ny, nx = img.shape
    fy = np.fft.fftfreq(ny)[:, None]
    fx = np.fft.fftfreq(nx)[None, :]
    g = np.exp(-2 * (math.pi * sigma) ** 2 * (fx * fx + fy * fy))
    return np.real(np.fft.ifft2(np.fft.fft2(img) * g))


def caustic_map(name, hfun, rect, res, depth, sun_dir, over=3, blur=0.9, focus=3.0, gamma=1.6, occluder=None, fill=1.0):
    """바닥 rect = (x0, x1, y0, y1)의 빛 무늬 그림(res × res, 평평한 물이면 1)과 프레임마다 다시 그리는 함수.
    focus: 빛 무늬만 깊이를 이 배로 쳐서 그물 무늬를 또렷하게(보이는 수면은 잔잔하게 두고), gamma: 밝은 줄을 더 세운다.
    occluder = (cx, cy, r, z_top): 물에 선 병 — 해를 병이 가리는 바닥 칸은 빛 무늬 대신 fill(바닥 색을 그대로 두는 값)로 채운다
    (그늘 속엔 직사광이 없어 빛 무늬가 있으면 안 된다 — Fable P8 지적). 그늘 자체는 Cycles 그림자 · 병을 지난 빛(MNEE)이 그린다."""
    real_depth = depth
    depth = depth * focus
    x0, x1, y0, y1 = rect
    img = bpy.data.images.new(name, res, res, alpha=False, float_buffer=True)
    img.colorspace_settings.name = "Non-Color"
    d = np.array(sun_dir, dtype=np.float64)
    d /= np.linalg.norm(d)
    eta = 1 / 1.33
    # 수면에서 굴절한 빛이 바닥까지 옆으로 밀리는 만큼 표본 자리를 넓힌다
    ct = math.sqrt(1 - eta * eta * (1 - d[2] * d[2]))
    shift = depth * eta * math.hypot(d[0], d[1]) / ct
    m = shift + 0.004
    N = res * over
    xs = np.linspace(x0 - m, x1 + m, round(N * (x1 - x0 + 2 * m) / (x1 - x0)))
    ys = np.linspace(y0 - m, y1 + m, round(N * (y1 - y0 + 2 * m) / (y1 - y0)))
    X, Y = np.meshgrid(xs, ys)
    per_px = over * over * ((xs[1] - xs[0]) * (ys[1] - ys[0])) / (((x1 - x0) / N) * ((y1 - y0) / N))
    shade = None
    if occluder is not None:
        # 바닥 칸마다: 평평한 물로 굴절한 햇빛 방향을 거슬러 수면까지 올라간 뒤 해 쪽으로 — 병 원기둥(수면 위 z_top까지)이나
        # 물속 병 아랫부분을 지나면 그늘
        cx, cy, r, z_top = occluder
        cosi0 = -d[2]
        T0 = eta * d + (eta * cosi0 - ct) * np.array([0.0, 0.0, 1.0])
        gx_ = x0 + (np.arange(res) + 0.5) * (x1 - x0) / res
        gy_ = y0 + (np.arange(res) + 0.5) * (y1 - y0) / res
        FX, FY = np.meshgrid(gx_, gy_)
        def hits(PX, PY, PZ, D, zlo, zhi):
            a = D[0] ** 2 + D[1] ** 2
            b = 2 * ((PX - cx) * D[0] + (PY - cy) * D[1])
            c = (PX - cx) ** 2 + (PY - cy) ** 2 - r * r
            disc = b * b - 4 * a * c
            ok = disc >= 0
            sq = np.sqrt(np.where(ok, disc, 0))
            t1, t2 = (-b - sq) / (2 * a), (-b + sq) / (2 * a)
            za, zb = PZ + t1 * D[2], PZ + t2 * D[2]
            lo, hi = np.minimum(za, zb), np.maximum(za, zb)
            return ok & (t2 > 0) & (hi >= zlo) & (lo <= zhi)
        up = -T0 / np.linalg.norm(T0)                               # 바닥 → 수면(물속)
        s_up = real_depth / up[2]
        SX, SY = FX + s_up * up[0], FY + s_up * up[1]
        shade = hits(FX, FY, np.zeros_like(FX), up, 0.0, real_depth) | hits(SX, SY, np.full_like(SX, real_depth), -d, real_depth, z_top)

    def update(f):
        t = (f - 1) / 24.0
        h = hfun(X, Y, t)
        gy, gx = np.gradient(h, ys, xs)
        nv = np.stack([-gx, -gy, np.ones_like(h)], -1)
        nv /= np.linalg.norm(nv, axis=-1, keepdims=True)
        cosi = -(nv @ d)
        k = np.clip(1 - eta * eta * (1 - cosi * cosi), 0, None)
        Tv = eta * d[None, None, :] + (eta * cosi - np.sqrt(k))[..., None] * nv
        s = (h + depth) / np.maximum(-Tv[..., 2], 1e-4)
        hx = X + s * Tv[..., 0]
        hy = Y + s * Tv[..., 1]
        H, _, _ = np.histogram2d(hy.ravel(), hx.ravel(), bins=[res, res], range=[[y0, y1], [x0, x1]])
        I = gauss_blur(H / per_px, blur)
        I = (np.power(np.clip(I, 0, None), gamma) / max(np.mean(np.power(np.clip(I, 0, None), gamma)), 1e-6)).astype(np.float32)
        if shade is not None:
            I = np.where(shade, np.float32(fill), I)
        px = np.empty((res, res, 4), np.float32)
        px[..., 0] = px[..., 1] = px[..., 2] = I
        px[..., 3] = 1.0
        img.pixels.foreach_set(px.ravel())
        img.update()
    PER_FRAME.append(update)
    return img


def caustic_floor_mat(name, base_mat_fn, img, rect, amb, gain):
    """바닥 재질: 원래 바닥 색 × (amb + gain × 빛 무늬). base_mat_fn은 (n, l) → 색 소켓을 돌려주는 함수."""
    m, n, l, out = new_mat(name)
    x0, x1, y0, y1 = rect
    tc, sep = obj_xyz(n, l)
    geo = n.new("ShaderNodeNewGeometry")
    wp = n.new("ShaderNodeSeparateXYZ")
    l.new(geo.outputs["Position"], wp.inputs[0])
    uv = n.new("ShaderNodeCombineXYZ")
    l.new(math_node(n, l, "DIVIDE", math_node(n, l, "SUBTRACT", wp.outputs["X"], x0), x1 - x0), uv.inputs["X"])
    l.new(math_node(n, l, "DIVIDE", math_node(n, l, "SUBTRACT", wp.outputs["Y"], y0), y1 - y0), uv.inputs["Y"])
    tex = n.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Cubic"
    tex.extension = "EXTEND"
    l.new(uv.outputs[0], tex.inputs["Vector"])
    gainv = math_node(n, l, "ADD", amb, math_node(n, l, "MULTIPLY", tex.outputs["Color"], gain))
    col, rough, normal = base_mat_fn(n, l, tc)
    cm = n.new("ShaderNodeMix")
    cm.data_type = "RGBA"
    cm.blend_type = "MULTIPLY"
    cm.inputs[0].default_value = 1.0
    l.new(col, cm.inputs[6])
    gc = n.new("ShaderNodeCombineColor")
    for i in range(3):
        l.new(gainv, gc.inputs[i])
    l.new(gc.outputs[0], cm.inputs[7])
    b = bsdf(n, rough=rough, spec=0.3)
    l.new(cm.outputs[2], b.inputs["Base Color"])
    if normal is not None:
        l.new(normal, b.inputs["Normal"])
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def stone_color(light=True, scale=1.0, pores=1.0):
    """물속 바닥 돌 색(트래버틴 결 + 작은 구멍, pores=0이면 구멍 없는 매끈한 석회암). caustic_floor_mat에 넘긴다."""
    def fn(n, l, tc):
        mp = n.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (0.6 * scale, 1.0 * scale, 1.8 * scale)
        l.new(tc.outputs["Object"], mp.inputs["Vector"])
        band = noise(n, l, mp.outputs[0], 7.0, 8.0, 0.6)
        ramp = n.new("ShaderNodeValToRGB")
        cr = ramp.color_ramp
        cr.elements[0].color = (*srgb((196, 178, 150) if light else (150, 140, 128)), 1)
        cr.elements[1].color = (*srgb((232, 220, 200) if light else (190, 182, 170)), 1)
        cr.elements[0].position, cr.elements[1].position = 0.3, 0.7
        l.new(band, ramp.inputs[0])
        vor = n.new("ShaderNodeTexVoronoi")
        vor.inputs["Scale"].default_value = 150.0 * scale
        l.new(mp.outputs[0], vor.inputs["Vector"])
        sepc = n.new("ShaderNodeSeparateColor")
        l.new(vor.outputs["Color"], sepc.inputs[0])
        pick = math_node(n, l, "LESS_THAN", sepc.outputs[0], math_node(n, l, "MULTIPLY", noise(n, l, mp.outputs[0], 5.0, 2.0), 1.15))
        rad = math_node(n, l, "ADD", 0.07, math_node(n, l, "MULTIPLY", noise(n, l, tc.outputs["Object"], 40.0, 2.0), 0.22))
        ps = n.new("ShaderNodeMapRange")
        l.new(vor.outputs["Distance"], ps.inputs["Value"])
        l.new(rad, ps.inputs["From Min"])
        l.new(math_node(n, l, "SUBTRACT", rad, 0.05), ps.inputs["From Max"])
        pit = math_node(n, l, "MULTIPLY", math_node(n, l, "MULTIPLY", ps.outputs["Result"], pick), pores)
        col = n.new("ShaderNodeMix")
        col.data_type = "RGBA"
        l.new(pit, col.inputs[0])
        l.new(ramp.outputs[0], col.inputs[6])
        col.inputs[7].default_value = (*srgb((158, 136, 108)), 1)
        bm = n.new("ShaderNodeBump")
        bm.inputs["Strength"].default_value = 0.8
        bm.inputs["Distance"].default_value = 0.0015
        l.new(math_node(n, l, "SUBTRACT", math_node(n, l, "MULTIPLY", noise(n, l, tc.outputs["Object"], 700.0, 6.0, 0.6), 0.2), pit),
              bm.inputs["Height"])
        return col.outputs[2], 0.6, bm.outputs["Normal"]
    return fn


def white_color(n, l, tc):
    """수조 바닥: 흰 무광 아크릴(아주 옅은 결)."""
    c = n.new("ShaderNodeRGB")
    c.outputs[0].default_value = (*srgb((236, 233, 228)), 1)
    return c.outputs[0], 0.5, None


def glass_wl_mat(name, water_z, rough=0.0, under_tint=None):
    """수면을 가로지르는 맑은 유리(받침 · 수조 벽): 수면 아래는 물 → 유리 굴절률.
    under_tint: 수면 아래로 보이는 것에 물빛(옅은 청록 · 조금 어둡게)을 입혀 수면선이 화면을 가로지르는 선으로 읽히게(수조 앞 유리)."""
    m, n, l, out = new_mat(name)
    b = bsdf(n, base=(1, 1, 1), rough=rough, trans=1.0)
    l.new(ior_switch(n, l, water_z), b.inputs["IOR"])
    if under_tint:
        geo = n.new("ShaderNodeNewGeometry")
        sp = n.new("ShaderNodeSeparateXYZ")
        l.new(geo.outputs["Position"], sp.inputs[0])
        under = math_node(n, l, "LESS_THAN", sp.outputs["Z"], water_z)
        mx = n.new("ShaderNodeMix")
        mx.data_type = "RGBA"
        l.new(under, mx.inputs[0])
        mx.inputs[6].default_value = (1, 1, 1, 1)
        mx.inputs[7].default_value = (*under_tint, 1)
        l.new(mx.outputs[2], b.inputs["Base Color"])
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def sun(name, rot_deg, strength, color=(1, 0.9, 0.78), angle=0.6):  # angle: 해 지름(°) — 클수록 그림자 · 반짝임이 부드럽다
    ld = bpy.data.lights.new(name, "SUN")
    ld.energy = strength
    ld.angle = math.radians(angle)
    ld.color = color
    ob = link(bpy.data.objects.new(name, ld))
    ob.rotation_euler = tuple(math.radians(a) for a in rot_deg)
    return ob


def sun_dir(ob):
    """해가 비추는 방향(빛이 나아가는 쪽, 세계 좌표)."""
    return tuple((ob.rotation_euler.to_matrix() @ Vector((0, 0, -1))))


def bright_room(strength=1.0):
    """밝은 방(물 · 유리에 비칠 것): 큰 흰 판 셋 — 뒤 창 쪽은 밝게, 옆은 은은하게. 카메라엔 직접 안 보인다."""
    for nm, loc, size, e in (("방_뒤", (0, 1.6, 0.8), (3.0, 1.6), 1.6), ("방_왼", (-1.4, 0.2, 0.6), (2.0, 1.4), 0.7),
                             ("방_오른", (1.4, 0.2, 0.6), (2.0, 1.4), 0.5), ("방_위", (0, 0.2, 1.6), (3.0, 3.0), 0.5)):
        c = card(nm, size, loc, (0, 0, 0.05), e * strength, (1.0, 0.96, 0.9))
        c.visible_camera = False


def cut_p3():
    """P3 방울(3.0–4.5초 · 36장): 병 없음. 얕은 맑은 물에 방울이 떨어진 뒤 동심원이 퍼지고, 바닥 돌에 굴절 빛 무늬.
    수면 높이 카메라(고정), 느린 화면(실제 시간의 1/4). 왼쪽 아래는 큰 글자 「약산성」 자리라 밝은 바닥으로 둔다."""
    S.frame_start, S.frame_end = 1, 36
    depth, cx, cy = 0.022, 0.0, 0.0
    calm = ambient_waves(3, 16, 0.000012, 0.030, 0.03)    # 보이는 수면: 아주 잔잔(파문만 또렷하게)
    web = ambient_waves(5, 28, 0.000050, 0.020, 0.03)     # 바닥 빛 그물만 만드는 잔물결(보이는 수면엔 안 넣는다)
    slow = 0.15   # 느린 화면: 1.5초에 파문 시간 0.225초 — 고리가 가운데에서 6 → 13cm로 천천히 벌어진다

    def rings(X, Y, tt):
        return (h_rings(X, Y, tt, cx, cy, 0.00070, 0.0085, 0.24, 0.30, 0.060)
                + h_rings(X, Y, tt, cx, cy, 0.00035, 0.0060, 0.20, 0.24, 0.045)
                + 0.00012 * np.exp(-((X - cx) ** 2 + (Y - cy) ** 2) / 0.0002) * math.cos(9.0 * tt))

    def h(X, Y, t):
        tt = 0.20 + t * slow
        return h_ambient(X, Y, tt, calm) + rings(X, Y, tt)

    def h_light(X, Y, t):
        tt = 0.20 + t * slow
        return h_ambient(X, Y, tt, web) + rings(X, Y, tt)
    X, Y, F = polar_grid(cx, cy, 0.0004, 0.9, 520, 1600, growth=30.0)
    water_surface("수면", X, Y, F, depth, h)
    s = sun("해", (40, 0, 205), 7.0 * T["sun"], angle=2.0)
    # 해는 바닥만 밝히고 수면에는 안 비친다 — 고리 마루에 순백 점(글린트)이 칼같이 찍혔다(Fable, 해 각 0.6 → 2°는 점만 넓혔다).
    # 바닥 빛 무늬는 numpy로 그리니 해 반사를 꺼도 그대로다
    s.visible_glossy = False
    rect = (-0.30, 0.30, -0.25, 0.75)
    img = caustic_map("빛무늬", h_light, rect, 1024, depth, sun_dir(s), over=2)
    floor = plane("바닥", 1.8, 1.8, (0, 0.2, 0.0), (0, 0, 0), caustic_floor_mat("물속바닥", stone_color(True, 0.8, 0.0), img, rect, 0.15, 1.4))
    # 물에 비칠 것: 멀리 밝은 창 쪽만 밝고 위는 은은하게 — 하늘 전체가 밝으면 수면 반사가 바닥을 뿌옇게 덮는다
    # 창: 가장자리가 녹는 빛 판(가우스) — 네모난 판은 잔잔한 물에 모서리 선 그대로 비쳤다
    win = plane("창", 2.4, 0.9, (0, 1.4, 0.35), (math.radians(90), 0, 0), glow_mat("창빛", (0.0, 0.0), 0.35, 7.0, (1.0, 0.96, 0.9)))
    win.visible_camera = False
    c = card("왼벽", (1.5, 0.8), (-1.2, 0.4, 0.3), (0, 0, 0.02), 0.25, (1.0, 0.96, 0.9))
    c.visible_camera = False
    # 먼 배경: 흐리게 녹는 밝은 창가(콘티 P3 위쪽) — 카메라에 보이는 은은한 발광 벽
    far = plane("먼벽", 4.0, 1.2, (0, 1.6, 0.3), (math.radians(90), 0, 0), glow_mat("먼벽빛", (0.0, -0.2), 0.9, 1.4, srgb((236, 228, 214))))
    world(0.12, srgb((236, 228, 216)))
    # 파문 가운데(0.50m 앞)를 15°로 낮게 내려다본다(콘티 P3의 납작한 타원). f/4로 앞 · 뒤가 녹는다
    camera(100, (0, -0.50, depth + 0.134), (cx, cy, depth), fstop=9.0, focus=0.518)


def cut_p4():
    """P4 물높이(4.5–6.5초 · 48장): 유리 수조, 병을 라벨 바로 아래(수면 50mm)까지 담가 수면선이 화면을 가른다. 병은 화면 오른쪽 3분의 1,
    왼쪽은 글자 「무향」 자리. 기포 몇 개, 바닥 굴절 빛. 카메라는 수면 높이에서 옆으로 미끄러진다(14mm)."""
    global WATER_Z
    S.frame_start, S.frame_end = 1, 48
    wl = 0.050
    WATER_Z = wl
    build_bottle(0.0)
    amb = ambient_waves(4, 28, 0.00004, 0.022, 0.035)
    front_y = -0.45

    def h(X, Y, t):   # 잔물결 + 병에서 퍼져 나가는 낮은 고리 + 앞 유리 · 병에 붙어 올라가는 메니스커스(수면선이 선으로 읽히게)
        r = np.sqrt(X * X + Y * Y)
        return (h_ambient(X, Y, t, amb) + h_rings(X, Y, 0.9 + t * 0.5, 0, 0, 0.0005, 0.009, 0.22, 0.28, 0.06, r0=R_OUT * MM)
                + 0.0016 * np.exp(-np.clip(Y - front_y, 0, None) / 0.0018) + 0.0014 * np.exp(-np.clip(r - R_OUT * MM, 0, None) / 0.0016))
    X, Y, F = polar_grid(0, 0, R_OUT * MM + 0.0001, 0.62, 400, 1200, growth=14.0)
    inside = (Y > front_y + 0.0002)[F].all(axis=1)   # 수조 안쪽 수면만(앞 유리 밖으로 물이 나가 있지 않게)
    water_surface("수면", X, Y, F[inside], wl, h)
    # 수조: 앞 유리(두께 6mm)는 병 앞 45cm — 수면 높이 카메라의 화면 아래 끝(9.4° 아래)이 수조 바닥에 닿게 · 흰 바닥 · 뒤 유리
    # 유리벽은 면마다 굴절률을 나눈다: 공기와 닿는 면은 1.5, 물과 닿는 면(수면 아래)만 1.5/1.33 + 물빛.
    # 판 전체에 수면 아래 1.5/1.33을 주면 들어가는 면 · 나가는 면이 같아 꺾임이 상쇄돼 물이 광학적으로 공기가 된다(물속 병 1.0배 — Fable P4,
    # 실제는 카메라 0.25m 앞 유리 · 병 0.45m 뒤에서 약 1.19배)
    plain = glass_inner_mat("수조유리_공기", 1.5)
    gfront = box("수조_앞", (0.90, 0.006, 0.22), (0, front_y - 0.003, 0.10), plain)
    gback = box("수조_뒤", (0.90, 0.006, 0.22), (0, 0.153, 0.10), plain)
    for gw, inner_y in ((gfront, 1.0), (gback, -1.0)):
        gw.data.materials.append(glass_wl_mat(gw.name + "_물쪽", wl, under_tint=T_TINT if inner_y > 0 else None))
        for poly in gw.data.polygons:
            poly.material_index = 1 if poly.normal.y * inner_y > 0.5 else 0
        gw.visible_shadow = False   # 유리벽이 햇빛 그림자 광선을 막으면 수조 바닥이 통째로 그늘이 된다
    s = sun("해", (38, 0, 150), 5.0 * T["sun"])
    rect = (-0.30, 0.30, -0.46, 0.16)
    img = caustic_map("빛무늬", h, rect, 1024, wl, sun_dir(s), over=2)
    floor = plane("수조바닥", 0.90, 0.62, (0, -0.15, 0.0), (0, 0, 0), caustic_floor_mat("수조바닥", white_color, img, rect, 0.3, 1.0))
    # 뒤 흰 벽 + 비스듬한 창빛 줄(블라인드 가림판)
    # 벽은 서리 몸통(225)보다 10~15% 어둡게 — 236은 병 왼쪽 가장자리가 벽에 묻혔다(Fable P4)
    wall = plane("벽", 2.0, 1.2, (0, 0.40, 0.45), (math.radians(90), 0, 0), plaster_mat("벽", srgb((205, 198, 188)), 0.08))
    BACKDROP.objects.link(wall)
    wall.visible_shadow = False   # 뒤에서 드는 해를 벽이 가려 수조 바닥 대부분이 그늘이었다
    beam = window_beam("햇빛줄", (-1.2, -0.5, 1.0), (0.0, 0.40, 0.18), 30.0, T["p4_beam"] * T["wall_light"], (1, 0.93, 0.84),
                       gobo_dist=0.22, panes=(1, 4), mullion=0.22, radius=0.05)
    beam.light_linking.receiver_collection = BACKDROP   # 비스듬한 빛줄은 뒤 벽에만(병에 줄무늬가 지지 않게)
    key = area("키", T["key_w"], (-0.39, -0.39, 0.12), (0, 0, 0.085), 36.0 * T["key"], (1.0, 0.92, 0.82), size_y=0.7)
    back = area("역광", 0.4, (-0.45, 0.315, 0.12), (0, 0, 0.085), 30.0 * T["back"], (1.0, 0.95, 0.88), size_y=0.7)
    only_bottle(key, back)
    bright_room(T["p4_room"])                       # 0.9 · 주변광 0.5는 벽(227)이 서리 몸통(222)보다 밝아 병 가장자리가 묻혔다
    world(T["p4_world"], srgb((236, 230, 222)))
    # 기포: 병 옆 물속에서 오르는 작은 공기 방울 다섯(법선을 안으로 — 안 = 공기, 밖 = 물, 굴절률 1.33)
    rng = np.random.default_rng(7)
    for i in range(5):
        r = 0.0006 + 0.0009 * rng.random()
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=24, ring_count=12)
        bb = bpy.context.active_object
        bb.name = f"기포{i}"
        bpy.ops.object.shade_smooth()
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.flip_normals()
        bpy.ops.object.mode_set(mode="OBJECT")
        bb.data.materials.append(water_mat())
        a = math.radians(-150 + 100 * rng.random())
        rr = R_OUT * MM + 0.003 + 0.010 * rng.random()
        x, y = rr * math.cos(a), rr * math.sin(a)
        z0 = 0.004 + 0.02 * rng.random()
        v = 0.012 + 0.010 * rng.random()
        for f in (1, 48):
            bb.location = (x + 0.0015 * math.sin(f * 0.3 + i), y, min(wl - 0.002, z0 + v * (f - 1) / 24.0))
            bb.keyframe_insert("location", frame=f)
    # 카메라: 수면 높이(0.5mm 위)에서 수평 — 수면은 앞 유리 뒤 가는 선, 위는 공기 속 병 · 아래는 물속 병과 바닥 빛 무늬(갈라 찍기).
    # 시프트 +0.04로 수면선이 화면 54%. 병은 오른쪽 3분의 1(화면 폭 143mm), 14mm 옆으로 미끄러진다
    cz = wl + T["p4_cam"]
    cam = camera(100, (-0.020, -0.706, cz), (-0.020, 0, cz), fstop=8.0, focus=0.68, shift=(0.0, 0.04))
    for f, x in ((1, -0.020), (48, -0.034)):
        cam.location.x = x
        cam.keyframe_insert("location", frame=f)


def cut_p8():
    """P8 위에서(11.0–12.0초 · 24장): 위에서 내려다본 은색 뚜껑 원 둘레로 얇은 물 파문(P3 동그라미와 같은 자리 — 화면 가운데),
    물속 트래버틴 바닥 · 빛 무늬, 병 그림자가 오른쪽 아래로. 카메라가 위에서 4° 돈다."""
    global WATER_Z, SHADOW_T
    S.frame_start, S.frame_end = 1, 24
    wl = 0.015
    WATER_Z = wl
    SHADOW_T = T["p8_shadow"]
    _, glass, liquid, _ = build_bottle(0.0)
    amb = ambient_waves(8, 28, 0.00004, 0.020, 0.03)

    def h(X, Y, t):   # 파문 시간 0.05 → 0.23초(느린 화면): 고리가 뚜껑 밖 4 → 9cm로 벌어져 1초 내내 화면 안에(장당 0.15λ — 0.29λ는 더듬거렸다)
        tt = 0.05 + t * 0.18
        return (h_ambient(X, Y, tt, amb) + h_rings(X, Y, tt, 0, 0, 0.0007, 0.0085, 0.24, 0.30, 0.045, r0=R_OUT * MM)
                + h_rings(X, Y, tt, 0, 0, 0.0004, 0.0062, 0.20, 0.25, 0.032, r0=R_OUT * MM))
    X, Y, F = polar_grid(0, 0, R_OUT * MM + 0.0001, 0.30, 420, 1400, growth=10.0)
    water_surface("수면", X, Y, F, wl, h)
    # 왼쪽 위에서 — 병 그림자가 오른쪽 아래로(콘티 P8). 해 각 3°로 그림자 가장자리를 흐리게(0.6°는 칼같은 검정 띠)
    s = sun("해", (55, 0, 230), 6.0 * T["sun"], angle=3.0)
    rect = (-0.16, 0.16, -0.22, 0.22)
    amb_k, gain_k = 0.35, 0.5
    # 병 그늘 칸은 빛 무늬 없이 바닥 색 그대로(그늘은 Cycles 그림자, 병을 지난 빛은 MNEE가 그린다)
    img = caustic_map("빛무늬", h, rect, 1024, wl, sun_dir(s), over=2, occluder=(0.0, 0.0, CAP_R * MM, CAP_Z1 * MM),
                      fill=(1 - amb_k) / gain_k)
    floor = plane("바닥", 1.0, 1.0, (0, 0, 0.0), (0, 0, 0), caustic_floor_mat("물속바닥", stone_color(True, 1.0), img, rect, amb_k, gain_k))
    caustics(s, (glass, liquid), (floor,))   # 유리 · 액체 병 그림자 가운데로 모이는 빛(실제 유리병 그림자는 가운데가 밝다)
    bright_room(0.7)
    world(0.4, srgb((236, 228, 216)))
    # 뚜껑 윗면(한 방향 결): 어두운 둘레 + 가는 밝은 띠 하나여야 헤어라인이 띠를 길게 늘여 금속으로 읽힌다 — 큰 윗판(3.0)은 원반 반사를
    # 고르게 채워 결 없는 흰 원반이었다(Fable P1) → 윗판 0.6, 세로 빛 띠(병만) p8_cap
    top = card("윗판", (0.5, 0.8), (-0.18, 0.10, 1.05), (0, 0, 0.16), T["p8_top"], (1.0, 0.96, 0.9))
    top.visible_diffuse = False
    # 띠는 카메라 바로 아래 축에서 13mm 비켜(위에서 보면 원반의 모든 점이 거의 같은 방향을 비춰, 12° 비킨 띠는 원반을 고르게 밝혔다) —
    # 거울 자리로 원반 가운데 오른쪽 7mm에 세로 밝은 띠가 맺히고 양옆으로 어두워진다. 카메라에는 안 보인다
    cap_hl = area("뚜껑빛", 0.012, (T["p8_cap_x"], 0.0, 0.75), (T["p8_cap_x"], 0.0, 0.161), T["p8_cap"], (1.0, 0.97, 0.93), size_y=0.5)
    cap_hl.visible_camera = False
    only_bottle(cap_hl)
    cam = camera(100, (0, 0, 0.161 + 0.617), (0, 0, 0), fstop=11.0, focus=0.617)
    for f, a in ((1, 0.0), (24, 4.0)):
        cam.rotation_euler = (0, 0, math.radians(a))
        cam.keyframe_insert("rotation_euler", frame=f)


def cut_p9():
    """P9 팩샷(12.0–15.0초 · 72장): 얕은 물(6mm) 위 두꺼운 맑은 유리 받침에 병, 물에 비친 병, 카메라 고정. 물은 아주 잔잔히 일렁인다.
    화면 위쪽(로크업 y 440~, AI 표시 알약 y 281)은 비운 밝은 벽."""
    S.frame_start, S.frame_end = 1, 72
    wl = 0.006
    ped = (0.120, 0.090, 0.030)   # 두꺼운 맑은 유리 받침(콘티 P9) — 20mm는 얇은 회색 판으로 보였다
    root, glass, liquid, cap = build_bottle(0.0)
    root.location.z = ped[2]
    amb = ambient_waves(9, 28, 0.00002, 0.025, 0.02)

    def h(X, Y, t):
        return h_ambient(X, Y, t, amb)
    hx, hy = ped[0] / 2, ped[1] / 2
    xs = np.unique(np.concatenate([np.linspace(-0.6, 0.6, 900), [-hx, hx]]))
    ys = np.unique(np.concatenate([np.linspace(-0.5, 0.9, 1000), [-hy, hy]]))
    X, Y, F = rect_grid(xs, ys, hole=(-hx, hx, -hy, hy))
    water_surface("수면", X, Y, F, wl, h)
    p = box("받침유리", (ped[0], ped[1], ped[2]), (0, 0, ped[2] / 2), glass_wl_mat("받침유리", wl, rough=0.02), bevel=0.003)
    BOTTLE_ONLY.objects.link(p)   # 병 빛(키 · 역광 · 테두리)이 받침 모서리에도 걸려 두꺼운 유리로 읽히게
    s = sun("해", (50, 0, 140), 4.0 * T["sun"])
    rect = (-0.30, 0.30, -0.25, 0.45)
    img = caustic_map("빛무늬", h, rect, 1024, wl, sun_dir(s), over=2)
    floor = plane("바닥", 2.0, 2.0, (0, 0.3, 0.0), (0, 0, 0), caustic_floor_mat("물속바닥", stone_color(True, 0.7), img, rect, 0.45, 0.7))
    wall = plane("벽", 2.4, 1.4, (0, 0.55, 0.60), (math.radians(90), 0, 0), plaster_mat("벽", srgb((214, 206, 196)), 0.08))
    BACKDROP.objects.link(wall)
    wall.visible_shadow = False
    window_beam("햇빛", (-1.4, -0.45, 1.1), (-0.05, 0.55, 0.32), 22.0, 2600.0 * T["wall_light"], (1, 0.92, 0.82), gobo_dist=0.25)
    key = area("키", T["p9_key_w"], (-0.39, -0.39, 0.15), (0, 0, 0.115), 38.0 * T["key"], (1.0, 0.91, 0.80), size_y=0.7)
    back = area("역광", 0.4, (-0.45, 0.315, 0.15), (0, 0, 0.115), 30.0 * T["back"], (1.0, 0.95, 0.88), size_y=0.7)
    rims = [area(nm, 0.035, (x, 0.24, 0.12), (0, 0, 0.10), e * T["rim"], (1, 0.96, 0.91), size_y=0.45)
            for nm, x, e in (("테두리_오른쪽", 0.30, 9.0), ("테두리_왼쪽", -0.30, 6.0))]
    # 받침 높이의 낮은 가로 띠(뒤 오른쪽): 두꺼운 유리 받침의 윗모서리 · 옆면에 밝은 선 — 30mm 받침이 얇은 아크릴 판으로 읽혔다(Fable P9)
    ped_rim = area("받침빛", 0.40, (0.18, 0.30, 0.035), (0, 0, 0.018), 6.0 * T["rim"], (1, 0.96, 0.91), size_y=0.02)
    only_bottle(key, back, *rims)
    # 받침빛은 받침에만 — 병도 받게 두면 병 맑은 부분 너머로 이 띠가 칼같은 흰 사각으로 비쳤다(Fable 재확인 P3, 10-22 진단)
    ped_only = bpy.data.collections.new("받침만")
    ped_only.objects.link(p)
    ped_rim.light_linking.receiver_collection = ped_only
    bright_room(0.6)
    world(0.35, srgb((236, 228, 216)))
    # 카메라: 0.13m 높이에서 수평 + 시프트 — 뚜껑 윗선 y≈820 · 받침 밑 y≈1750, 위쪽은 벽(글자 자리).
    # 처음 판(1.0배 · 뚜껑 y750)은 로크업 끝줄 「세안 뒤 첫 숨, 맑게」(y≈700)가 뚜껑에 15px로 붙었다
    camera(100, (0, -1.10, 0.13), (0, 0, 0.13), fstop=11.0, focus=1.075, shift=(0.0, 0.081))


# ── 렌더 ──────────────────────────────────────────────────────────────────────
def setup_render():
    S.render.engine = "CYCLES"
    q = A.quality
    S.render.resolution_percentage = {"preview": 50, "mid": 100, "final": 100}[q]
    S.cycles.samples = {"preview": 96, "mid": 384, "final": 1024}[q]
    S.cycles.use_adaptive_sampling = True
    S.cycles.adaptive_threshold = {"preview": 0.03, "mid": 0.012, "final": 0.006}[q]
    S.cycles.use_denoising = True
    try:
        S.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    S.cycles.max_bounces = 32
    S.cycles.diffuse_bounces = 4
    S.cycles.glossy_bounces = 16
    S.cycles.transmission_bounces = 32
    S.cycles.transparent_max_bounces = 16
    S.cycles.caustics_reflective = False
    S.cycles.caustics_refractive = False
    S.cycles.blur_glossy = 0.5
    S.view_settings.view_transform = "AgX"
    try:
        S.view_settings.look = T_LOOK
    except Exception:
        pass
    # 컷마다 세트 밝기가 달라 노출을 따로 둔다(--set expo=…가 있으면 그 값)
    S.view_settings.exposure = T["expo"] if ("expo" in SET_KEYS or A.cut == "look") else CUT_EXPO.get(A.cut, T["expo"])
    S.render.image_settings.file_format = "PNG"
    S.render.image_settings.color_mode = "RGB"
    S.render.image_settings.color_depth = "8"
    if A.device == "GPU":
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "OPTIX"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == "OPTIX"
        S.cycles.device = "GPU"
    else:
        S.cycles.device = "CPU"


def frames_list():
    if not A.frames:
        return list(range(S.frame_start, S.frame_end + 1))
    out = []
    for part in A.frames.split(","):
        if "-" in part:
            x, y = part.split("-")
            out += list(range(int(x), int(y) + 1))
        else:
            out.append(int(part))
    return out


def main():
    os.makedirs(A.out, exist_ok=True)
    if A.cut == "look":
        S.frame_start = S.frame_end = 1
        look_set()
        tag = f"룩_{A.view}"
    else:
        {"P1": cut_p1, "P3": cut_p3, "P4": cut_p4, "P6": cut_p6, "P8": cut_p8, "P9": cut_p9}[A.cut]()
        tag = A.cut
    setup_render()
    if A.save:
        bpy.ops.wm.save_as_mainfile(filepath=A.save)
    for f in frames_list():
        S.frame_set(f)
        for cb in PER_FRAME:
            cb(f)
        S.render.filepath = os.path.join(A.out, f"{tag}_{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", S.render.filepath, flush=True)


main()

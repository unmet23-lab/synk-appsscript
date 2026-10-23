# 콘티 v4 광고 카드 물건 셋(2026-10-23, 크레딧 0) — 원본 카드의 금장 라이터 · LP · 리본 핫도그 자리.
# 제품은 AI로 그리지 않고 블렌더로 짓는다. 용기 · 재질 도우미는 밀폐용기.py(2안 꽉 용기)를 main() 없이 읽어 빌린다.
#   python -X utf8 광고카드_그림.py                       (먼저 — 라벨 · 뚜껑판 · 상자 옆면)
#   blender -b --python 광고카드_물건.py -- --what set6 --out <폴더>/set6   → 상자 앞면에 넣을 6종 렌더
#   python -X utf8 광고카드_그림.py --상자                 (6종 렌더로 상자 앞면)
#   blender -b --python 광고카드_물건.py -- --what mini|giftbox|tteok|tteok_hang --out <폴더>/<what> [--quality preview|mid]
#   → <what>_0001.png(RGBA 1600², 투명 바탕 — 손 · 바탕은 합성에서)
# mini: 물건 1 금장 꽉 미니(작은 용기 · 금장 뚜껑 · 검정 라벨). giftbox: 물건 2 꽉 핑크 에디션 6종 세트 납작한 선물 상자(세운 채 앞면).
# tteok: 물건 3 리본 묶은 떡볶이 도시락(꽉 중 용기 · 떡볶이 · 크림 새틴 리본 띠 · 나비 · 앞 모서리로 길게 늘어진 꼬리 둘).
# tteok_hang: 같은 도시락이 위로 모인 리본 끝에 매달린 판(#31 강도 손).
import math
import os
import random
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


WHAT = arg("--what", "mini")
OUT = arg("--out", ".")
QUALITY = arg("--quality", "mid")
HERE = os.path.dirname(os.path.abspath(__file__))
CARD = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021", "블렌더", "카드v4")

# 밀폐용기.py를 main() 없이 읽는다(그 파일이 다시 병A2_장면.py를 읽어 장면 · 빛 · 카메라 도우미를 만든다)
KK = os.path.join(HERE, "밀폐용기.py")
src = open(KK, encoding="utf-8").read().rstrip()
assert src.endswith("main()"), "밀폐용기.py 끝이 main()이 아니다"
sys.argv = [sys.argv[0], "--", "--what", "stack", "--out", OUT, "--quality", QUALITY, "--refl", "0"]
M = {"__name__": "kkwak", "__file__": KK}
exec(compile(src[: -len("main()")], KK, "exec"), M)
G, S = M["G"], M["S"]
SIZES, LID_T = M["SIZES"], M["LID_T"]
SIZES["XS"] = (0.085, 0.062, 0.042)
mat_plastic, mat_clear, mat_decal, container, rounded_box = (M[k] for k in ("mat_plastic", "mat_clear", "mat_decal", "container", "rounded_box"))
TUNGSTEN = (1.0, 0.80, 0.58)


def mat_gold(name, rough=0.22, rgb=(1.0, 0.74, 0.34)):
    m, n, l, out = G["new_mat"](name)
    b = G["bsdf"](n, base=rgb, metal=1.0, rough=rough)
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def mat_satin(name, rgb):
    m, n, l, out = G["new_mat"](name)
    b = G["bsdf"](n, base=rgb, rough=0.34, aniso=0.5, spec=0.6)
    G["setin"](b, "Sheen Weight", 0.6)
    G["setin"](b, "Sheen Tint", (1.0, 0.96, 0.9, 1.0))
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def mat_print(name, path, rough=0.5):
    m, n, l, out = G["new_mat"](name)
    tex = n.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(path)
    b = G["bsdf"](n, rough=rough, coat=0.15)
    l.new(tex.outputs["Color"], b.inputs["Base Color"])
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


# ── 리본: 가운데 선을 따라 폭을 펼친 띠(얇게 두께) ──────────────────────────────
def norm(v):
    L = math.sqrt(sum(c * c for c in v)) or 1.0
    return tuple(c / L for c in v)


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def catmull(pts, n_per=12):
    """조절점을 지나는 매끈한 선(카트멀-롬)"""
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n_per):
            t = k / n_per
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3) for j in range(3)))
    out.append(pts[-1])
    return out


def strip(name, pts, face, width, mat, closed=False, thick=0.0012):
    """pts: 가운데 선, face(i, 접선) → 띠 면이 바라볼 방향. 폭 방향 = 접선 × 면 방향"""
    verts, faces = [], []
    n = len(pts)
    for i, p in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, n - 1)]
        if closed:
            a, b = pts[(i - 1) % n], pts[(i + 1) % n]
        t = norm(tuple(b[j] - a[j] for j in range(3)))
        w = norm(cross(t, face(i, t)))
        verts.append(tuple(p[j] - w[j] * width / 2 for j in range(3)))
        verts.append(tuple(p[j] + w[j] * width / 2 for j in range(3)))
    for i in range(n - 1 + (1 if closed else 0)):
        a, b = 2 * i, 2 * ((i + 1) % n)
        faces.append((a, b, b + 1, a + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = G["link"](bpy.data.objects.new(name, me))
    so = ob.modifiers.new("두께", "SOLIDIFY")
    so.thickness = thick
    so.offset = 0.0
    ob.data.materials.append(mat)
    return smooth(ob)


def rrect(a, c, r, n=10):
    """(u, v) 평면의 둥근 네모 둘레(반폭 a · 반높이 c · 모서리 r)"""
    out = []
    for (cu, cv, a0) in ((a - r, c - r, 0), (-(a - r), c - r, 90), (-(a - r), -(c - r), 180), (a - r, -(c - r), 270)):
        for k in range(n + 1):
            t = math.radians(a0 + 90 * k / n)
            out.append((cu + r * math.cos(t), cv + r * math.sin(t)))
    return out


def ribbon_box(parent, w, d, h, mat, hang=False):
    """꽉 용기에 리본: 가로 띠 하나(뚜껑 위 → 양옆 → 바닥) + 나비 고리 둘 + 매듭 + 꼬리 둘"""
    RW = 0.022
    top = h + LID_T + 0.0075
    # 띠는 몸에 붙인다: 뚜껑 위 → 옆 잠금 날개를 넘어(바깥으로 볼록) → 몸 옆면에 붙어 내려가 → 바닥 밑으로(10-23 첫 판은 떠 있는 테두리처럼 보였다)
    xs, xl, zb = w / 2 + 0.0018, w / 2 + 0.0095, -0.0018
    half = [(0.0, top), (w / 2 - 0.004, top), (w / 2 + 0.004, top - 0.002), (xl, top - 0.008), (xl, h - 0.022), (xs + 0.002, h - 0.032),
            (xs, h - 0.04), (xs, 0.004), (w / 2 - 0.004, zb), (0.0, zb)]
    path = half + [(-u, v) for (u, v) in reversed(half[1:-1])]
    band = catmull([(u, 0.0, v) for (u, v) in path + [path[0]]], 6)[:-1]
    strip("리본_띠", band, lambda i, t: norm(cross(t, (0, 1, 0))), RW, mat, closed=True).parent = parent
    # 나비 고리: XZ 평면의 납작한 타원(폭은 Y) — 양쪽으로 벌리고 뒤로 조금 눕힌다
    for s in (-1, 1):
        loop = []
        for k in range(48):
            t = 2 * math.pi * k / 48
            x, z = 0.031 * (1 - math.cos(t)), 0.016 * math.sin(t) + 0.004 * (1 - math.cos(t))
            ry = math.radians(-20 * s)   # 앞쪽으로 벌림(Z축)
            loop.append((s * x * math.cos(ry), -x * math.sin(ry) * s * s * 0.6, top + 0.003 + z))
        lo = strip(f"리본_고리_{s}", loop, lambda i, t: (0, 1, 0), RW * 0.95, mat, closed=True)
        lo.rotation_euler.x = math.radians(-14)
        lo.parent = parent
    knot = rounded_box("리본_매듭", (0.018, 0.024, 0.012), (0, 0, top + 0.004), mat, 0.004)
    knot.parent = parent
    # 꼬리 둘
    for s in (-1, 1):
        if hang:   # 위로 모여 손가락에 감기는 끝(#31)
            ctrl = [(s * 0.006, -0.004, top + 0.006), (s * 0.016, -0.006, top + 0.05), (s * 0.008, -0.006, top + 0.12), (s * 0.002, -0.004, top + 0.175)]
            face = lambda i, t: (0, -1, 0)
        else:      # 왼쪽 꼬리는 앞 왼쪽 모서리로, 오른쪽 꼬리는 오른쪽 옆면으로 늘어진다(좌우가 같으면 다리처럼 보였다 — 10-23 첫 판)
            y0 = -d / 2 - 0.006
            if s < 0:
                ctrl = [(-0.006, -0.006, top + 0.004), (-0.035, -0.03, top + 0.002), (-(w / 2 - 0.012), y0 + 0.002, top - 0.004),
                        (-(w / 2 - 0.008), y0 - 0.004, h * 0.45), (-(w / 2 - 0.016), y0 - 0.006, -0.015),
                        (-(w / 2 - 0.004), y0 - 0.008, -0.075), (-(w / 2 - 0.018), y0 - 0.006, -0.14)]
                side = (0, -1, 0)
            else:
                ctrl = [(0.006, -0.002, top + 0.004), (0.045, 0.004, top + 0.002), (w / 2 + 0.004, 0.012, top - 0.005),
                        (w / 2 + 0.011, 0.016, h * 0.5), (w / 2 + 0.013, 0.02, -0.012), (w / 2 + 0.02, 0.016, -0.07), (w / 2 + 0.012, 0.02, -0.115)]
                side = norm((1, -0.6, 0))
            face = None
        pts = catmull(ctrl, 14)
        if face is None:
            n_lid = 2 * 14   # 앞 세 조절점까지는 뚜껑 위(면이 위), 그다음은 바깥(카메라 쪽 · 옆)으로 돌아선다
            face = (lambda nl, sd: (lambda i, t: norm(tuple(sd[j] * min(1, max(0, (i - nl) / 10)) + (0, 0, 1)[j] * (1 - min(1, max(0, (i - nl) / 10))) for j in range(3)))))(n_lid, side)
        strip(f"리본_꼬리_{s}", pts, face, RW * 0.8, mat).parent = parent


def tteokbokki(z0, w, d, parent, mats):
    """떡볶이: 붉은 소스 바닥 · 떡 · 어묵 · 삶은 달걀 반쪽 · 파"""
    rnd = random.Random(11)
    sauce = rounded_box("소스", (w - 0.012, d - 0.012, 0.009), (0, 0, z0 + 0.0035 + 0.0045), mats["sauce"], 0.003)
    sauce.parent = parent
    for layer in range(3):
        for i in range(10 - 2 * layer):
            L = rnd.uniform(0.042, 0.056)
            x, y = rnd.uniform(-w / 2 + 0.036, w / 2 - 0.036), rnd.uniform(-d / 2 + 0.022, d / 2 - 0.022)
            bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.0074, depth=L, location=(x, y, z0 + 0.016 + layer * 0.012),
                                                rotation=(math.radians(90 + rnd.uniform(-12, 12)), 0, math.radians(rnd.uniform(0, 180))))
            c = bpy.context.active_object
            md = c.modifiers.new("모서리", "BEVEL")
            md.width, md.segments = 0.003, 3
            c.data.materials.append(mats["tteok"])
            smooth(c).parent = parent
    for i in range(5):
        x, y = rnd.uniform(-w / 2 + 0.03, w / 2 - 0.03), rnd.uniform(-d / 2 + 0.024, d / 2 - 0.024)
        o = rounded_box(f"어묵_{i}", (0.038, 0.026, 0.004), (x, y, z0 + 0.03), mats["eomuk"], 0.0015)
        o.rotation_euler = (math.radians(rnd.uniform(-35, 35)), math.radians(rnd.uniform(-35, 35)), math.radians(rnd.uniform(0, 180)))
        o.parent = parent
    for i, (x, y) in enumerate(((-0.03, -0.012), (0.038, 0.016))):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.016, location=(x, y, z0 + 0.034))
        e = bpy.context.active_object
        e.scale = (1.15, 0.85, 0.62)
        e.data.materials.append(mats["egg"])
        smooth(e).parent = parent
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0085, location=(x, y - 0.002, z0 + 0.0425))
        yk = bpy.context.active_object
        yk.scale = (1.0, 1.0, 0.45)
        yk.data.materials.append(mats["yolk"])
        smooth(yk).parent = parent
    for i in range(12):
        x, y = rnd.uniform(-w / 2 + 0.02, w / 2 - 0.02), rnd.uniform(-d / 2 + 0.02, d / 2 - 0.02)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.0042, minor_radius=0.0013, location=(x, y, z0 + 0.04 + rnd.uniform(-0.006, 0.004)),
                                         rotation=(math.radians(rnd.uniform(0, 70)), 0, 0))
        g = bpy.context.active_object
        g.data.materials.append(mats["pa"])
        smooth(g).parent = parent


def lights(gold=False):
    """텅스텐 호박빛 — 왼쪽 위 키, 오른쪽 약한 채움, 뒤 테두리. 금장이면 비칠 판(카드) 둘을 더 둔다"""
    area = G["area"]
    area("키_왼쪽위", 0.6, (-0.55, -0.6, 0.55), (0, 0, 0.05), 120.0, TUNGSTEN, size_y=0.5)
    area("채움_오른쪽", 0.8, (0.7, -0.5, 0.2), (0, 0, 0.05), 28.0, (1.0, 0.86, 0.7))
    area("뒤_테두리", 0.25, (0.25, 0.55, 0.35), (0, 0, 0.05), 60.0, TUNGSTEN)
    if gold:
        for nm, pos, st in (("금_비침_왼쪽", (-0.35, -0.45, 0.25), 2.2), ("금_비침_위", (0.05, -0.2, 0.55), 1.6)):
            c = G["card"](nm, (0.5, 0.35), pos, (0, 0, 0.03), st, TUNGSTEN)
            c.visible_diffuse = False
    G["world"](0.06, (0.55, 0.38, 0.24))


def render(name, cam_lens, cam_pos, target, res=(1600, 1600), expo=-1.4):
    G["camera"](cam_lens, cam_pos, target, res=res)
    G["setup_render"]()
    S.render.film_transparent = True
    S.cycles.film_transparent_glass = True
    S.cycles.film_transparent_roughness = 0.1
    S.render.image_settings.color_mode = "RGBA"
    S.view_settings.exposure = expo
    S.cycles.samples = 96 if QUALITY == "preview" else 200
    S.render.resolution_percentage = 50 if QUALITY == "preview" else 100
    os.makedirs(OUT, exist_ok=True)
    S.render.filepath = os.path.join(OUT, f"{name}_0001.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", S.render.filepath, flush=True)


def orbit(dist, yaw, elev, tz):
    ya, el = math.radians(yaw), math.radians(elev)
    return (dist * math.cos(el) * math.sin(ya), -dist * math.cos(el) * math.cos(ya), tz + dist * math.sin(el))


def main():
    root = G["link"](bpy.data.objects.new("물건", None))
    clear = mat_clear()
    if WHAT == "mini":
        mats = {"clear": clear, "white": mat_gold("금장_뚜껑"), "mint": mat_gold("금장_날개", 0.28), "button": mat_gold("금장_단추", 0.35, (0.82, 0.58, 0.24)),
                "decal": mat_decal(os.path.join(CARD, "카드_미니뚜껑판.png"), "금장_인쇄"), "label": mat_decal(os.path.join(CARD, "카드_미니라벨.png"), "금장_라벨")}
        container("XS", 0.0, root, mats)
        for ob in bpy.data.objects:   # 잠금 날개는 크기가 정해져 있어 작은 용기에선 라벨을 가린다 — 줄여 위로
            if ob.name.startswith("날개_XS_"):
                ob.scale = (0.62, 1.0, 0.62) if abs(ob.location.x) < 0.01 else (1.0, 0.62, 0.62)
                ob.location.z += 0.004
        root.rotation_euler.z = math.radians(-22)
        lights(gold=True)
        render("mini", 85, orbit(0.42, 0, 12, 0.03), (0, 0, 0.024), expo=-1.2)
    elif WHAT == "set6":
        pinks = [(0.92, 0.36, 0.55), (0.86, 0.22, 0.45), (0.96, 0.52, 0.66), (0.80, 0.16, 0.38), (0.98, 0.62, 0.74), (0.90, 0.30, 0.50)]
        k = 0
        for xs in (-0.115, 0.115):
            z = 0.0
            for key in ("L", "M", "S"):
                mats = {"clear": clear, "white": mat_plastic(f"분홍뚜껑_{k}", pinks[k], 0.3, 0.4), "mint": mat_plastic(f"분홍날개_{k}", tuple(c * 0.86 for c in pinks[k]), 0.35, 0.3),
                        "button": mat_plastic(f"분홍단추_{k}", tuple(c * 0.7 for c in pinks[k]), 0.6, 0.0),
                        "decal": mat_decal(os.path.join(CARD, "카드_핑크뚜껑판.png"), f"분홍인쇄_{k}"), "label": mat_decal(M["LABEL"], f"앞라벨_{k}")}
                holder = G["link"](bpy.data.objects.new(f"묶음_{k}", None))
                holder.parent = root
                z = container(key, z, holder, mats, top_print=(key == "S"))
                holder.location.x = xs
                k += 1
        lights()
        render("set6", 70, orbit(1.25, 0, 22, 0.11), (0, 0, 0.11), res=(1600, 1200), expo=-1.6)
    elif WHAT == "giftbox":
        W_, T_, H_ = 0.31, 0.045, 0.31
        pink = mat_print("상자_옆면", os.path.join(CARD, "카드_상자옆면.png"), 0.55)
        box = rounded_box("상자", (W_, T_, H_), (0, 0, H_ / 2), mat_plastic("상자_분홍", (0.93, 0.62, 0.72), 0.55, 0.1), 0.004)
        box.parent = root
        bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, -T_ / 2 - 0.0005, H_ / 2), rotation=(math.radians(90), 0, 0))
        fr = bpy.context.active_object
        fr.scale = (W_ - 0.004, H_ - 0.004, 1)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        fr.data.materials.append(mat_print("상자_앞면", os.path.join(CARD, "카드_상자앞면.png"), 0.42))
        fr.parent = root
        bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0, H_ + 0.0005))
        tp = bpy.context.active_object
        tp.scale = (W_ - 0.006, T_ - 0.006, 1)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        tp.data.materials.append(pink)
        tp.parent = root
        root.rotation_euler = (math.radians(4), 0, math.radians(-12))
        lights()
        render("giftbox", 70, orbit(1.35, 0, 4, 0.155), (0, 0, 0.155), expo=-1.8)   # -1.1은 카드 2 어두운 거실에서 앞면이 하얗게 떴다(10-23)
    elif WHAT in ("tteok", "tteok_hang"):
        mats = {"clear": clear, "white": mat_plastic("뚜껑_흰", M["WHITE"], 0.3, 0.4), "mint": mat_plastic("날개_민트", M["MINT"], 0.35, 0.3),
                "button": mat_plastic("단추_실리콘", M["MINT_DARK"], 0.6, 0.0), "decal": mat_decal(), "label": mat_decal(M["LABEL"], "앞라벨"),
                "sauce": mat_plastic("떡볶이_소스", (0.30, 0.012, 0.005), 0.2, 1.0), "tteok": mat_plastic("떡", (0.55, 0.05, 0.015), 0.28, 0.9),
                "eomuk": mat_plastic("어묵", (0.60, 0.28, 0.10), 0.35, 0.6), "egg": mat_plastic("달걀흰자", (0.93, 0.91, 0.86), 0.35, 0.3),
                "yolk": mat_plastic("노른자", (0.98, 0.70, 0.16), 0.5, 0.1), "pa": mat_plastic("파", (0.30, 0.58, 0.16), 0.4, 0.3)}
        w, d, h = SIZES["M"]
        container("M", 0.0, root, mats, tteokbokki)
        bpy.data.objects["라벨_M"].hide_render = True   # 앞 라벨이 떡볶이를 가렸다 — 꽉은 뚜껑 인쇄 · 잠금 날개 · 진공 단추로 읽힌다
        ribbon_box(root, w, d, h, mat_satin("리본_크림새틴", (0.80, 0.70, 0.58)), hang=(WHAT == "tteok_hang"))
        lights()
        if WHAT == "tteok":
            root.rotation_euler.z = math.radians(-14)
            render("tteok", 70, orbit(0.95, 0, 18, -0.02), (0, 0, -0.01), expo=-1.8)
        else:
            root.rotation_euler = (0, math.radians(7), math.radians(-10))
            render("tteok_hang", 70, orbit(1.05, 0, 6, 0.08), (0, 0, 0.08), res=(1200, 1600), expo=-1.8)


main()

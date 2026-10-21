# 「매진 임박」 홈쇼핑 컷 · 회전 받침 위 맑음 병 A2 알파 렌더(2026-10-21, 크레딧 0).
# 병은 지유 v7 블렌더 장면(../../jiyu-skincare-20261018/v7/블렌더/병A2_장면.py)의 build_bottle을 그대로 불러 치수 · 재질 · 라벨 인쇄판이
# 지유 광고와 같고, 받침 · 빛 · 카메라만 홈쇼핑 방송처럼(밝고 평평한 정면 빛, 흰 회전 받침) 새로 둔다. 배경은 투명 — Remotion이
# 촌스러운 방송 판 위에 얹는다(후반 가이드 다 「제품 고정 카메라」). 맑은 아랫부분은 「투명 유리」로 뒤 판이 비치게 한다.
#   blender -b --python 돌림판.py -- --what full|bottle|pedestal --out <폴더> [--frames 1-120] [--quality preview|mid|final]
#     full: 받침 + 병이 함께 돈다 — 120장(5초)에 -60°→+60°(15초에 한 바퀴 빠르기), 가운데 장(60~61)에서 라벨이 정면.
#           끼어들기마다 가운데를 둘러싼 구간만 쓴다(H1 48장 · H2 72장 · H3 · 끝 96장) · bottle: 병만 · pedestal: 받침만 1장
#   → <폴더>/<what>_0001.png … (RGBA 1080×1080)
import math
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


WHAT = arg("--what", "full")
OUT = arg("--out", ".")
FRAMES = arg("--frames", "1-120" if WHAT != "pedestal" else "1")
QUALITY = arg("--quality", "mid")
N_FR, A0, A1 = 120, -60.0, 60.0   # 장수 · 처음 각 · 끝 각(라벨이 늘 읽히는 범위)
HERE = os.path.dirname(os.path.abspath(__file__))
SCENE = os.path.normpath(os.path.join(HERE, "..", "..", "jiyu-skincare-20261018", "v7", "블렌더", "병A2_장면.py"))
if not os.path.exists(SCENE):   # 지유 v7 블렌더가 아직 이 작업본에 없으면 공용 작업본 것을 읽는다
    SCENE = os.path.join(os.environ["USERPROFILE"], "Documents", "SYNK-appsscript", "docs", "마케팅", "PULSE_포트폴리오_제작준비_20261012",
                         "video", "jiyu-skincare-20261018", "v7", "블렌더", "병A2_장면.py")

# 병 장면 파일을 맨 끝 main() 없이 읽는다 — 함수 · 재질 · 치수만 가져오고 장면은 여기서 짓는다
src = open(SCENE, encoding="utf-8").read().rstrip()
assert src.endswith("main()"), "병A2_장면.py 끝이 main()이 아니다 — 짜임이 바뀌었는지 본다"
sys.argv = [sys.argv[0], "--", "--cut", "look", "--quality", QUALITY, "--out", OUT]
G = {"__name__": "a2_scene", "__file__": SCENE}
exec(compile(src[: -len("main()")], SCENE, "exec"), G)
S, MM = G["S"], G["MM"]

DISC_R, DISC_H = 0.075, 0.018   # 받침: 지름 150mm(병 지름의 2.9배) · 높이 18mm


def white_gloss():
    """흰 회전 받침: 광택 코팅된 흰 아크릴."""
    m, n, l, out = G["new_mat"]("받침_흰광택")
    b = G["bsdf"](n, base=(0.86, 0.86, 0.86), rough=0.22, coat=1.0, coat_rough=0.05)
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def chrome():
    m, n, l, out = G["new_mat"]("받침_은테")
    b = G["bsdf"](n, base=(0.9, 0.9, 0.92), metal=1.0, rough=0.12)
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def pedestal():
    bpy.ops.mesh.primitive_cylinder_add(vertices=256, radius=DISC_R, depth=DISC_H - 0.003, location=(0, 0, (DISC_H - 0.003) / 2))
    disc = bpy.context.active_object
    disc.name = "받침"
    md = disc.modifiers.new("모서리", "BEVEL")
    md.width = 0.0025
    md.segments = 6
    disc.data.materials.append(white_gloss())
    for p in disc.data.polygons:
        p.use_smooth = True
    # 밑동 은테(3mm) — 받침이 떠 보이지 않게 바닥에 닿는 띠
    bpy.ops.mesh.primitive_cylinder_add(vertices=256, radius=DISC_R * 0.97, depth=0.003, location=(0, 0, 0.0015))
    rim = bpy.context.active_object
    rim.name = "받침_은테"
    rim.data.materials.append(chrome())
    for p in rim.data.polygons:
        p.use_smooth = True
    # 그림자 받이: 보이지 않는 바닥이 받침 그림자만 알파로 남긴다
    bpy.ops.mesh.primitive_plane_add(size=1.2, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = "그림자받이"
    floor.is_shadow_catcher = True
    return disc, rim


def lights():
    """홈쇼핑 방송 빛: 큰 소프트박스 둘을 정면 양쪽에서 거의 같게(그림자 옅게), 위 빛, 유리 가장자리 세우는 뒤 띠."""
    area = G["area"]
    warm, cool = (1.0, 0.96, 0.92), (0.95, 0.97, 1.0)
    area("키_왼쪽", 0.7, (-0.55, -0.62, 0.42), (0, 0, 0.10), 90.0, warm, size_y=0.9)
    area("채움_오른쪽", 0.7, (0.6, -0.6, 0.38), (0, 0, 0.10), 70.0, cool, size_y=0.9)
    area("위", 0.6, (0.0, -0.1, 0.75), (0, 0, 0.08), 70.0, (1, 1, 1))
    for nm, x in (("뒤띠_왼쪽", -0.32), ("뒤띠_오른쪽", 0.32)):
        G["area"](nm, 0.04, (x, 0.26, 0.14), (0, 0, 0.10), 16.0 * G["T"]["rim"], (1, 0.98, 0.95), size_y=0.5)
    # 반사판(반사에만): 뚜껑 · 유리에 넓고 깨끗한 흰 면 — 방송용 제품은 번들거림 없이 밝게
    for c in (G["card"]("반사판_왼쪽", (0.5, 0.6), (-0.42, -0.30, 0.15), (0, 0, 0.10), 0.9),
              G["card"]("반사판_오른쪽", (0.5, 0.6), (0.42, -0.30, 0.15), (0, 0, 0.10), 0.7)):
        c.visible_diffuse = False
    G["world"](0.35, (0.92, 0.93, 0.95))


def main():
    os.makedirs(OUT, exist_ok=True)
    root = None
    if WHAT in ("full", "pedestal"):
        pedestal()
    if WHAT in ("full", "bottle"):
        root, glass, liquid, cap = G["build_bottle"](0.0)
        root.location.z = DISC_H if WHAT == "full" else 0.0
        if WHAT == "bottle":   # 병만: 바닥 그림자 받이만 둔다
            bpy.ops.mesh.primitive_plane_add(size=1.2, location=(0, 0, 0))
            bpy.context.active_object.is_shadow_catcher = True
    lights()
    # 카메라: 받침 윗면이 보이게 조금 위에서(8°), 85mm. 정사각 1080 — 병 + 받침이 세로 60%쯤
    tz = 0.095 if WHAT != "pedestal" else 0.02
    dist = 0.78
    ang = math.radians(8.0)
    G["camera"](85, (0, -dist * math.cos(ang), tz + dist * math.sin(ang)), (0, 0, tz), res=(1080, 1080))
    G["setup_render"]()
    S.render.film_transparent = True
    S.cycles.film_transparent_glass = True
    S.cycles.film_transparent_roughness = 0.1
    S.render.image_settings.color_mode = "RGBA"
    S.view_settings.exposure = -0.6
    if QUALITY == "mid":
        S.cycles.samples = 256
    fr = []
    for part in FRAMES.split(","):
        a, _, b = part.partition("-")
        fr += list(range(int(a), int(b or a) + 1))
    for f in fr:
        if root is not None:   # 고르게 돈다(받침은 무늬가 없어 돌아도 안 보이니 병만 돌린다)
            root.rotation_euler.z = math.radians(A0 + (A1 - A0) * (f - 1) / (N_FR - 1))
        S.frame_set(f)
        S.render.filepath = os.path.join(OUT, f"{WHAT}_{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", S.render.filepath, flush=True)


main()

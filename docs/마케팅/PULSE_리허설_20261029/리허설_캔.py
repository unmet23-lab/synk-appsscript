# PULSE 첫 리허설(10-29) — 손님 제품 「오미톡 오미자 스파클링 355 ml」 캔 렌더. 블렌더 5.2 배경 실행.
# 캔 · 라벨 · 재질은 1 · 3번 편의 캔장면.py를 그대로 빌린다(제품 · 로고 · 글자는 AI로 그리지 않는다).
#   blender -b --python 리허설_캔.py -- --mode photos [--res 1600x2000] [--samples 96]
#       → <작업>/손님자료/오미톡_정면 · 옆면 · 뒷면.png  (손님이 보낸 「실제 사진」 역할 — 밝은 회색 탁자 위)
#   blender -b --python 리허설_캔.py -- --mode alpha --elev 0,8,16 --yaw 0,-20,20 --key L,R [--res 800x1600] [--drops 500]
#       → <작업>/렌더/합성/can_e+8_y+0_kL.png …  (투명 바탕 16비트 — 사람 장면 그림에 얹을 판, 시안_합성.py 이름 꼴)
#   … --mode alpha --open …  → <작업>/렌더/합성_딴캔/ (딴 캔 — 고리 들림 · 마시는 구멍, 컷 2)
#   blender -b --python 리허설_캔.py -- --mode pack [--res 2160x3840] [--drops 900]
#       → <작업>/렌더/팩샷.png  (엔드카드 — 투명 바탕, 낮은 눈높이 정면, 물방울)
#   공통: [--device CPU|GPU] (GPU가 다른 세션 ComfyUI로 차 있으면 CPU)
# <작업> = Documents/synk-vendor/pulse-rehearsal-20261029
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CAN = os.path.join(HERE, "..", "PULSE_포트폴리오_제작준비_20261012", "video", "product-hero-20261024", "블렌더")
sys.path.insert(0, os.path.abspath(CAN))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


MODE = arg("--mode", "photos")
DEVICE = arg("--device", "GPU")
DROPS = int(arg("--drops", "0" if MODE == "photos" else "500"))
if "--res" not in argv:  # 캔장면.py가 불러올 때 --res를 읽는다
    sys.argv += ["--res", {"photos": "1600x2000", "alpha": "800x1600", "pack": "2160x3840"}[MODE]]
if "--samples" not in argv:
    sys.argv += ["--samples", "96"]

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import 캔장면 as K  # noqa: E402

작업 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-rehearsal-20261029")
H = 0.061  # 캔 가운데 높이(m)


def base(transparent):
    sc = K.reset()
    if DEVICE == "CPU":
        sc.cycles.device = "CPU"
    sc.render.film_transparent = transparent
    if transparent:
        sc.render.image_settings.color_mode = "RGBA"
        sc.render.image_settings.color_depth = "16"
    return sc


OPEN = "--open" in argv  # 딴 캔: 고리가 들리고 앞쪽(-Y)에 마시는 구멍


def mouth(c):
    """마시는 구멍 — 리벳 앞(-Y)의 눈물 모양 어두운 면을 뚜껑 바로 위에 얹는다(위에서 30°로 보면 뚫린 입구로 읽힌다)."""
    import bmesh
    bm = bmesh.new()
    pts = []
    for i in range(48):
        a = 2 * math.pi * i / 48
        x = 6.4 * math.sin(a) * (1.0 - 0.28 * (0.5 - 0.5 * math.cos(a)))  # 리벳 쪽이 조금 좁은 눈물 모양
        y = -14.2 + 7.6 * math.cos(a)
        pts.append(bm.verts.new((x * K.MM, y * K.MM, 118.84 * K.MM)))
    bm.faces.new(pts)
    me = bpy.data.meshes.new("mouth")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("mouth", me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(K.mat_simple("mouth", base=(0.004, 0.003, 0.004), rough=0.18))
    ob.parent = c
    return ob


def can(rot_deg=0.0):
    c = K.make_can(wet_bump=0.0, tab_lift=38.0 if OPEN else 0.0)
    if OPEN:
        mouth(c)
    c.rotation_euler = (0, 0, math.radians(rot_deg))
    if DROPS:
        K.droplets(c, n=DROPS, r_range=(0.15, 1.6), seed=29)
    return c


def cam_at(dist, elev_deg, lens=85, target_h=H):
    e = math.radians(elev_deg)
    loc = (0.0, -dist * math.cos(e), target_h + dist * math.sin(e))
    return K.camera(loc, (0, 0, target_h), lens=lens)


def lights(key="L", warm=False):
    s = -1 if key == "L" else 1
    kr = (1.0, 0.86, 0.70) if warm else (1, 1, 1)
    K.area_light("key", (0.32 * s, -0.30, 0.30), (0, 0, H), 30, 0.30, rgb=kr, size_y=0.6)
    K.area_light("rim", (-0.30 * s, 0.25, 0.22), (0, 0, H), 22, 0.10, size_y=0.6)
    K.area_light("fill", (-0.20 * s, -0.35, 0.06), (0, 0, H), 5, 0.5)


def photos():
    """손님 사진 셋 — 밝은 회색 탁자 · 벽 앞, 눈높이보다 조금 위(8°)에서 휴대폰으로 찍은 정면 · 옆면 · 뒷면."""
    out = os.path.join(작업, "손님자료")
    os.makedirs(out, exist_ok=True)
    for name, rot in (("정면", 0.0), ("옆면", -K.SIDE_DEG), ("뒷면", 180.0)):
        sc = base(False)
        K.world_color((0.62, 0.62, 0.64), 0.9)
        can(rot)
        bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, 0))
        bpy.context.active_object.data.materials.append(K.mat_simple("table", base=(0.74, 0.74, 0.76), rough=0.55))
        K.backdrop("wall", (0.80, 0.80, 0.82), 1.7, (0, 0.55, 0.5), size=(3, 1.5))
        cam_at(0.41, 8)
        lights("L")
        sc.view_settings.exposure = -2.0
        sc.render.filepath = os.path.join(out, f"오미톡_{name}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", sc.render.filepath)


def alpha():
    """투명 바탕 합성 판 — elev(카메라가 캔 가운데보다 위인 각도) × yaw(+면 앞면이 화면 오른쪽으로) × key(큰 빛 쪽)."""
    out = os.path.join(작업, "렌더", "합성_딴캔" if OPEN else "합성")
    os.makedirs(out, exist_ok=True)
    elevs = [int(v) for v in arg("--elev", "8").split(",")]
    yaws = [int(v) for v in arg("--yaw", "0").split(",")]
    keys = arg("--key", "L").split(",")
    for e in elevs:
        for y in yaws:
            for k in keys:
                sc = base(True)
                K.world_gradient((0.10, 0.09, 0.10), (0.75, 0.70, 0.66), 0.8)
                can(y)
                cam_at(0.33, e)
                lights(k, warm=True)
                sc.view_settings.exposure = -2.0
                sc.render.filepath = os.path.join(out, f"can_e{e:+d}_y{y:+d}_k{k}.png")
                bpy.ops.render.render(write_still=True)
                print("RENDERED", sc.render.filepath)


def pack():
    """엔드카드 팩샷 — 캔 하나 정면, 낮은 눈높이(2°)에서 조금 올려다봄, 차가운 물방울, 해 질 녘 따뜻한 큰 빛 + 차가운 테."""
    out = os.path.join(작업, "렌더")
    os.makedirs(out, exist_ok=True)
    sc = base(True)
    # v2(10-29 엔드카드): 해 질 녘 판에 맞춰 둘레를 어둡게, 큰 앞빛 반사가 몸통 가운데를 하얗게 덮던 것(v1 가운데 세로 줄 240)을 빼고
    #   뒤 왼쪽 따뜻한 테 · 오른쪽 차가운 테 · 앞 아래에서 낮게 받치는 빛(벤치 반사)으로
    K.world_gradient((0.02, 0.02, 0.05), (0.30, 0.22, 0.16), 0.45)
    can(0.0)
    bpy.ops.mesh.primitive_plane_add(size=1.2, location=(0, 0.05, 0))
    bpy.context.active_object.is_shadow_catcher = True
    cam_at(0.36, 2, lens=85)
    K.area_light("rim_l", (-0.24, 0.20, 0.16), (0, 0, H), 34, 0.05, rgb=(1.0, 0.70, 0.45), size_y=0.4)
    K.area_light("rim_r", (0.24, 0.20, 0.14), (0, 0, H), 20, 0.05, rgb=(0.55, 0.70, 1.0), size_y=0.4)
    K.area_light("fill", (0.26, -0.30, 0.04), (0, 0, H), 4, 0.30, rgb=(1.0, 0.86, 0.72))  # 앞 가운데에 두면 몸통 가운데에 흰 세로 줄이 서서 옆으로
    sc.view_settings.exposure = -1.6
    sc.render.filepath = os.path.join(out, "팩샷.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath)


{"photos": photos, "alpha": alpha, "pack": pack}[MODE]()

# 12번 모두의코스 끝 CG 시안(2026-11-04) — 납작한 민트 판(11번에서 기각된 레몬 판과 같은 짜임) 대신, 식당 장면 안에 CG를 세운다.
#  「같은 코스」 입체 글자가 탁자에서 솟고 → 두 폰과 같은 코스(핀 15개 · 줄)가 불판을 둘러 탁자 위에 그려지고 → 딩에 돌담 뒤에서 「모두의코스」 간판이 솟는다.
# 카메라는 화면에서 잰 값(초점 1800px · 10° 아래 · 탁자에서 높이 1) — 위치를 화면 좌표로 적으면 3차원으로 바꾼다. 글자마다 움직임은 파이썬에서 프레임마다 정한다.
#   blender -b -P 끝CG.py -- --out <폴더> --env <그림> --group table|sign --frames 806-911 [--samples 32]
import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--env", default="")
ap.add_argument("--group", default="table")     # table(글자 · 코스) | sign(돌담 간판)
ap.add_argument("--frames", default="900")      # 「806-911」 또는 「820,850,900」 — 영상 전체 기준 프레임(24fps)
ap.add_argument("--samples", type=int, default=32)
ap.add_argument("--face", default="30,205,170")   # 글자 · 핀 색 sRGB — 브랜드 민트(#20B296)를 저녁 판에서 탁해지지 않게 밝힌 값
a = ap.parse_args(argv)
os.makedirs(a.out, exist_ok=True)

# ── 시각(최종편집.py · P12.tsx와 같은 값) ─────────────────────────
FPS = 24
TT16 = round(35.14 * FPS) / FPS
ZOOM = (round(31.27 * FPS) + 44) / FPS
BLOCK_AT = ZOOM + 0.5        # 「같은 코스」
TICK0 = 35.14 + 0.1          # 핀 첫 틱(최종편집.py T[16] + 0.1)
TICK = 0.055
BRAND_AT = TT16 + 0.95       # 딩

W, H, F = 1080, 1920, 1800.0
scene = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.engine = "CYCLES"
scene.cycles.samples = a.samples
scene.cycles.use_denoising = True
prefs = bpy.context.preferences.addons["cycles"].preferences
for kind in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = kind
        prefs.get_devices()
        if any(d.type == kind for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == kind
            scene.cycles.device = "GPU"
            break
    except Exception as e:
        print("장치 실패", kind, e, flush=True)
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"

cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
bpy.context.collection.objects.link(cam)
cam_data.sensor_fit = "HORIZONTAL"
cam_data.sensor_width = 36
cam_data.lens = F / W * 36
cam_data.clip_end = 100
cam.location = (0, 0, 1)
cam.rotation_euler = (math.radians(80), 0, 0)
scene.camera = cam
ROT = cam.rotation_euler.to_matrix()
ORIGIN = Vector(cam.location)


def ray(u, v):
    return ROT @ Vector(((u - W / 2) / F, -(v - H / 2) / F, -1.0))


def on_plane(u, v, z=0.0):
    d = ray(u, v)
    return ORIGIN + d * ((z - ORIGIN.z) / d.z)


def at_depth(u, v, t):
    return ORIGIN + ray(u, v) * t


def srgb(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def mat(name, rgb, rough=0.2, coat=1.0, spec=0.5, glow=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree.nodes["Principled BSDF"]
    n.inputs["Base Color"].default_value = (srgb(rgb[0]), srgb(rgb[1]), srgb(rgb[2]), 1)
    if glow:
        n.inputs["Emission Color"].default_value = (srgb(rgb[0]), srgb(rgb[1]), srgb(rgb[2]), 1)
        n.inputs["Emission Strength"].default_value = glow
    n.inputs["Roughness"].default_value = rough
    n.inputs["Coat Weight"].default_value = coat
    n.inputs["Coat Roughness"].default_value = 0.06
    n.inputs["Specular IOR Level"].default_value = spec
    return m


face_rgb = [int(x) for x in a.face.split(",")]
FACE = mat("face", face_rgb, rough=0.13, glow=0.14)
WHITE = mat("white", (250, 249, 245), rough=0.22, glow=0.12)


# 자모를 획으로 — 글꼴 돌출은 ㅌ 틈이 막혀 「갈은」으로 읽혔고 앞면이 납작해 그림처럼 보였다(11-04). 관은 어디서나 둥글어 빛이 획을 따라 흐른다
# 칸은 가로 1 × 세로 1.12, y는 위로. (점 목록, 닫힘)
TUBE_R = 0.1


def ring_pts(cx, cy, rx, ry, n=64):
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]


def round_rect(x0, y0, x1, y1, r=0.09, n=8):
    pts = []
    for (cx, cy, a0) in ((x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180), (x1 - r, y0 + r, 270)):
        for i in range(n + 1):
            th = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(th), cy + r * math.sin(th)))
    return pts


BAR_B = ([(0.04, 0.10), (0.96, 0.10)], False)   # 아래 가로획
STEM = ([(0.5, 0.44), (0.5, 0.10)], False)       # ㅗ의 기둥
GLYPHS = {
    "같": [([(0.06, 1.16), (0.50, 1.16), (0.50, 0.86)], False), ([(0.80, 1.20), (0.80, 0.82)], False), ([(0.80, 1.02), (0.98, 1.02)], False),
          ([(0.90, 0.60), (0.12, 0.60), (0.12, 0.10), (0.90, 0.10)], False), ([(0.12, 0.35), (0.84, 0.35)], False)],
    "은": [(ring_pts(0.5, 1.00, 0.27, 0.19), True), ([(0.04, 0.62), (0.96, 0.62)], False), ([(0.16, 0.41), (0.16, 0.10), (0.88, 0.10)], False)],
    "코": [([(0.14, 1.14), (0.80, 1.14), (0.80, 0.58)], False), ([(0.16, 0.85), (0.80, 0.85)], False), STEM, BAR_B],
    "스": [([(0.5, 1.16), (0.40, 0.90), (0.10, 0.54)], False), ([(0.5, 1.16), (0.60, 0.90), (0.90, 0.54)], False), ([(0.04, 0.16), (0.96, 0.16)], False)],
    "모": [(round_rect(0.14, 0.60, 0.86, 1.14, r=0.11), True), STEM, BAR_B],
    "두": [([(0.86, 1.14), (0.16, 1.14), (0.16, 0.66), (0.86, 0.66)], False), ([(0.04, 0.40), (0.96, 0.40)], False), ([(0.5, 0.40), (0.5, 0.04)], False)],
    "의": [(ring_pts(0.35, 0.90, 0.25, 0.235), True), ([(0.04, 0.34), (0.66, 0.34)], False), ([(0.88, 1.18), (0.88, 0.04)], False)],
}


def fillet(points, r=0.07, n=6):
    """꺾이는 자리를 둥글게 — 관이 접힌 자국 없이 휜다"""
    if len(points) < 3:
        return points
    out = [points[0]]
    for a0, b0, c0 in zip(points, points[1:], points[2:]):
        ba = Vector((a0[0] - b0[0], a0[1] - b0[1]))
        bc = Vector((c0[0] - b0[0], c0[1] - b0[1]))
        rr = min(r, ba.length * 0.45, bc.length * 0.45)
        p0 = Vector(b0) + ba.normalized() * rr
        p2 = Vector(b0) + bc.normalized() * rr
        for i in range(n + 1):
            k = i / n
            q = p0 * (1 - k) ** 2 + Vector(b0) * 2 * k * (1 - k) + p2 * k ** 2
            out.append((q.x, q.y))
    out.append(points[-1])
    return out


def syllable(ch, size, name, radius=TUBE_R):
    """글자 하나 — 원점은 글자 아래 가운데, 앞이 -Y"""
    objs = []
    for pts, closed in GLYPHS[ch]:
        data = bpy.data.curves.new(name + "_c", "CURVE")
        data.dimensions = "3D"
        data.bevel_depth = radius
        data.bevel_resolution = 6
        data.use_fill_caps = True
        pts2 = pts if closed else fillet(pts)
        sp = data.splines.new("POLY")
        sp.points.add(len(pts2) - 1)
        for i, (x, y) in enumerate(pts2):
            sp.points[i].co = (x - 0.5, 0, y, 1)
        sp.use_cyclic_u = closed
        o = bpy.data.objects.new(name + "_c", data)
        bpy.context.collection.objects.link(o)
        objs.append(o)
        if not closed:
            for (x, y) in (pts2[0], pts2[-1]):
                bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=radius, location=(x - 0.5, 0, y))
                objs.append(bpy.context.object)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.join()
    ob = bpy.context.object
    ob.name = name
    me = ob.data
    me.materials.clear()
    me.materials.append(FACE)
    for f in me.polygons:
        f.use_smooth = True
    zmin = min(v.co.z for v in me.vertices)
    me.transform(Matrix.Translation((0, 0, -zmin)))
    ob.data.transform(Matrix.Diagonal((size, size * 0.9, size, 1)))   # 앞뒤로 살짝 납작 — 위에서 볼 때 획 틈이 덜 가린다
    return ob


def make_pin(name, height):
    """핀 — 납작한 물방울 몸통에 양면 흰 점. 원점은 뾰족한 끝"""
    zc, R = 1.0, 0.62
    alpha = math.asin(R / zc)
    prof = [(0.0, 0.0)]
    tz = zc - R * math.sin(alpha)
    tr = R * math.cos(alpha)
    for i in range(1, 17):
        k = i / 16
        prof.append((tr * k ** 0.92, tz * k))
    for i in range(1, 25):
        th = -alpha + (math.pi / 2 + alpha) * i / 24
        prof.append((R * math.cos(th), zc + R * math.sin(th)))
    prof[-1] = (0.0, zc + R)
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    N = 64
    rings = []
    for r, z in prof:
        if r < 1e-5:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * j / N), r * math.sin(2 * math.pi * j / N) * 0.6, z)) for j in range(N)])
    for r0, r1 in zip(rings, rings[1:]):
        if len(r0) == 1:
            for j in range(N):
                bm.faces.new((r0[0], r1[j], r1[(j + 1) % N]))
        elif len(r1) == 1:
            for j in range(N):
                bm.faces.new((r0[j], r1[0], r0[(j + 1) % N]))
        else:
            for j in range(N):
                bm.faces.new((r0[j], r1[j], r1[(j + 1) % N], r0[(j + 1) % N]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(me)
    bm.free()
    me.materials.append(FACE)
    body = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(body)
    s = height / (zc + R)
    body.scale = (s, s, s)
    # 흰 점 앞뒤
    for sign in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.27, location=(0, sign * 0.335, zc))
        d = bpy.context.object
        d.name = f"{name}_dot{sign}"
        d.scale = (1, 0.28, 1)
        d.data.materials.append(WHITE)
        bpy.ops.object.shade_smooth()
        d.parent = body
    return body


def spring(tau, w=15.0, d=7.5):
    """0 → 넘쳤다 → 1"""
    if tau <= 0:
        return 0.0
    return 1 - math.exp(-d * tau) * math.cos(w * tau)


def world_setup():
    world = bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes["Background"]
    if a.env and os.path.exists(a.env):
        tex = nt.nodes.new("ShaderNodeTexEnvironment")
        tex.image = bpy.data.images.load(a.env)
        nt.links.new(tex.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = 1.0
    else:
        bg.inputs["Color"].default_value = (0.6, 0.6, 0.58, 1)
        bg.inputs["Strength"].default_value = 1.0


def area(name, loc, size, power, look, color=(1, 1, 1), size_y=None):
    d = bpy.data.lights.new(name, "AREA")
    d.shape = "RECTANGLE"
    d.size, d.size_y = size, size_y or size
    d.energy = power
    d.color = color
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    o.visible_camera = False
    return o


world_setup()
actors = []   # 프레임마다 부르는 함수들

if a.group == "table":
    # 코스 — 불판을 둘러 탁자 위에(앱 지도와 같은 기운 타원). 앞 폰 위 · 왼쪽 사람 어깨 안에 들어오게 화면 좌표로 잡았다
    left, right, far, near = on_plane(214, 1440), on_plane(948, 1440), on_plane(580, 1296), on_plane(580, 1606)
    cx, cy = (left.x + right.x) / 2, (far.y + near.y) / 2
    rx, ry = (right.x - left.x) / 2, (far.y - near.y) / 2
    tilt = math.radians(-6)
    Z = 0.045     # 접시 위로 뜬 높이

    def oval(angle):
        x, y = rx * math.cos(angle), ry * math.sin(angle)
        return Vector((cx + x * math.cos(tilt) - y * math.sin(tilt), cy + x * math.sin(tilt) + y * math.cos(tilt), Z))

    # 핀 15개는 줄을 따라 같은 간격으로(각도로 나누면 타원 양 끝에 몰렸다). 시작 · 끝이 앞 폰 위에서 만나 그 폰에서 나온 것처럼 — 앱 지도처럼 한 칸은 빈다
    A0 = math.radians(242)
    SWEEP = math.radians(336)
    fine = [A0 - SWEEP * i / 2000 for i in range(2001)]
    lens = [0.0]
    for g0, g1 in zip(fine, fine[1:]):
        lens.append(lens[-1] + (oval(g1) - oval(g0)).length)
    def ang_at(k):
        goal = lens[-1] * k
        lo = next(i for i, x in enumerate(lens) if x >= goal - 1e-9)
        return fine[lo]
    PIN_ANG = [ang_at(k / 14) for k in range(15)]
    route_data = bpy.data.curves.new("route", "CURVE")
    route_data.dimensions = "3D"
    route_data.bevel_depth = 0.0095
    route_data.bevel_resolution = 5
    route_data.use_fill_caps = True
    sp = route_data.splines.new("POLY")
    M = 280
    sp.points.add(M - 1)
    for i in range(M):
        p = oval(ang_at(i / (M - 1)))
        sp.points[i].co = (p.x, p.y, p.z, 1)
    route_data.materials.append(WHITE)
    route = bpy.data.objects.new("route", route_data)
    bpy.context.collection.objects.link(route)

    PIN_H = 0.105
    pins = []
    for k, ang in enumerate(PIN_ANG):
        big = k in (0, 14)
        pin = make_pin(f"pin{k}", PIN_H * (1.28 if big else 1.0))
        pin.location = oval(ang)
        pins.append(pin)

    def act_route(t):
        f = max(0.0, min(1.0, (t - TICK0) / (14 * TICK)))
        route_data.bevel_factor_end = f
        route.hide_render = f <= 0.002
        for k, pin in enumerate(pins):
            tau = t - (TICK0 + k * TICK)
            s = spring(tau, w=17, d=8)
            big = 1.28 if k in (0, 14) else 1.0
            base = PIN_H * big / 1.62
            ss = max(0.0, s) * base
            pin.scale = (ss, ss, ss * (1 + 0.1 * math.exp(-6 * max(tau, 0))))
            pin.hide_render = tau <= 0
            for ch in pin.children:
                ch.hide_render = tau <= 0
            # 튀어 오르며 한 바퀴 돌아 앞을 본다, 그 뒤 천천히 까딱인다
            pin.rotation_euler = (0, 0, -2 * math.pi * math.exp(-5.5 * max(tau, 0)) + 0.12 * math.sin(t * 2.2 + k))
            p = oval(PIN_ANG[k])
            pin.location = (p.x, p.y, p.z + 0.012 * max(0.0, math.sin(t * 2.6 + k * 0.7)) * min(1, max(tau, 0) * 2))

    actors.append(act_route)

    # 「같은 코스」 — 코스 가운데 탁자에 선다, 딩에 물러난다
    SIZE = 0.168
    text = [("같", 0.0), ("은", 1.0), ("코", 2.42), ("스", 3.42)]
    gap = SIZE * 1.22
    base = on_plane(594, 1508, 0.0)     # 왼쪽 사람 어깨(x 245)에 글자가 잘리지 않게 오른쪽으로
    letters = []
    for ch, slot in text:
        ob = syllable(ch, SIZE, f"w{slot}")
        x = base.x + (slot - 1.71) * gap
        ob.location = (x, base.y, 0.01)
        letters.append((ob, x))

    def act_word(t):
        for j, (ob, x) in enumerate(letters):
            tau = t - (BLOCK_AT + j * 0.07)
            s = spring(tau)
            if t >= TICK0 - 0.1:   # 코스가 그려지기 직전에 물러난다(글자 · 핀이 겹치면 어수선했다)
                s *= max(0.0, 1 - (t - (TICK0 - 0.1) - j * 0.02) / 0.14) if t >= TICK0 - 0.1 + j * 0.02 else 1.0
            ob.hide_render = s <= 0.001
            ss = max(0.001, s)
            ob.scale = (ss, ss, ss)
            ob.rotation_euler = (math.radians(-22), 0, math.radians(32) * (1 - min(1.0, max(0.0, tau) * 4)) * (1 if j % 2 else -1) + math.radians(1.6) * math.sin(t * 2.2 + j))

    actors.append(act_word)

    # 받이 — 탁자 안쪽에만(바닥에 그림자가 번지지 않게)
    bpy.ops.mesh.primitive_circle_add(vertices=128, radius=1.0, fill_type="NGON", location=(0, 0, 0))
    disc = bpy.context.object
    tc = on_plane(650, 1470)
    disc.location = (tc.x, tc.y, 0.0)
    disc.scale = (0.62, 0.6, 1)
    disc.is_shadow_catcher = True
    area("key", (-0.9, 1.0, 1.9), 0.9, 34, (0, 2.1, 0), color=(1, 0.96, 0.9))
    area("fill", (1.3, 0.6, 1.0), 1.5, 7, (0, 2.1, 0))
    area("back", (0.3, 3.6, 1.6), 1.2, 16, (0, 2.1, 0), color=(1, 0.86, 0.68))
    scene.render.use_border = True
    scene.render.use_crop_to_border = False
    scene.render.border_min_x, scene.render.border_max_x = 0.0, 1.0
    scene.render.border_min_y, scene.render.border_max_y = 0.08, 0.42    # 아래에서 8~42%(y 1114~1766)

else:
    # 돌담 간판 — 담 뒤에서 솟는다(담 가림은 합성에서). 핀 + 글자 다섯
    T_D = 5.6
    SIZE = 0.416
    word = "모두의코스"
    advance = SIZE * 1.22
    pin_h = SIZE * 1.1
    total = pin_h * 0.72 + 0.05 + advance * len(word)
    rest = at_depth(540, 288, T_D)   # 아래 획이 담(윗선 y 285~300) 위에 보이게 — 담에 살짝만 걸린다
    # 글자 앞면이 카메라 축에 수직에 가깝게 살짝 눕힌다
    px = rest.x - total / 2
    items = []
    pin = make_pin("sign_pin", pin_h)
    pin.location = (px + pin_h * 0.36, rest.y, rest.z)
    items.append((pin, pin.location.copy(), True))
    x = px + pin_h * 0.72 + 0.05 + advance / 2
    for j, ch in enumerate(word):
        ob = syllable(ch, SIZE, f"s{j}", radius=0.125)   # 멀리 있어 더 굵게(ㅌ처럼 좁은 틈이 없어 괜찮다)
        ob.location = (x + j * advance, rest.y, rest.z)
        items.append((ob, ob.location.copy(), False))

    def act_sign(t):
        for j, (ob, loc, is_pin) in enumerate(items):
            tau = t - (BRAND_AT - 0.04 + j * 0.05)
            s = spring(tau, w=13, d=6.5)
            ob.hide_render = tau <= 0
            for ch in ob.children:
                ch.hide_render = tau <= 0
            ob.location = (loc.x, loc.y, loc.z - SIZE * 1.1 * (1 - s))
            if is_pin:
                ob.rotation_euler = (0, 0, -2 * math.pi * math.exp(-4.5 * max(tau, 0)) + 0.1 * math.sin(t * 1.9))
            else:
                ob.rotation_euler = (math.radians(8), 0, math.radians(0.9) * math.sin(t * 1.7 + j) * min(1, max(tau, 0) * 2))

    actors.append(act_sign)
    area("key", (-3.0, 1.0, 5.0), 4.0, 160, (0, 5.5, 1.4), color=(1, 0.95, 0.9))
    area("fill", (3.0, 1.0, 2.5), 3.0, 40, (0, 5.5, 1.4))
    scene.render.use_border = True
    scene.render.use_crop_to_border = False
    scene.render.border_min_x, scene.render.border_max_x = 0.0, 1.0
    scene.render.border_min_y, scene.render.border_max_y = 0.72, 1.0     # 위쪽 28%


def parse_frames(s):
    out = []
    for part in s.split(","):
        if "-" in part:
            x, y = part.split("-")
            out += list(range(int(x), int(y) + 1))
        else:
            out.append(int(part))
    return out


for f in parse_frames(a.frames):
    path = os.path.join(a.out, f"{f:04d}.png")
    if os.path.exists(path):
        continue
    t = f / FPS
    for act in actors:
        act(t)
    bpy.context.view_layer.update()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("프레임", f, flush=True)
print("끝", flush=True)

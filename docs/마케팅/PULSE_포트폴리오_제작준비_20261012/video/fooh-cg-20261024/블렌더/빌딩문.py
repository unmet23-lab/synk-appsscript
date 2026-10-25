# PULSE 3번 FOOH — 서울 유리 빌딩 위 절반이 냉장고 문처럼 열리는 장면 (2026-10-25, 크레딧 0)
# 바탕(Gemini 2.1 한 판) 위에 문 · 투명 칸 · 캔 · 안쪽만 블렌더로 렌더해 얹는다(투명 바탕 RGBA).
# 카메라는 바탕의 빌딩 앞면 네 모서리 · 이음매 두 점으로 푼 값(<밖>/바탕/카메라.json, 폰 화각으로 초점 고정).
#   blender -b --python 빌딩문.py -- --state seam|half|open|closing --res 1536x2752 [--samples 96] [--out …png]
# 캔 · 재질 도우미는 1번 product-hero-20261024/블렌더/캔장면.py를 빌려 쓴다(같은 캔 · 같은 라벨).
import importlib.util
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


HERE = os.path.dirname(os.path.abspath(__file__))
CAN = os.path.normpath(os.path.join(HERE, "..", "..", "product-hero-20261024", "블렌더", "캔장면.py"))
spec = importlib.util.spec_from_file_location("canscene", CAN)
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)
_can_mats = {}
_mat_can_print = C.mat_can_print


def _cached_can_print(**kw):  # 캔 열여섯 개가 라벨 재질(8k 그림)을 하나만 쓰게
    key = tuple(sorted(kw.items()))
    if key not in _can_mats:
        _can_mats[key] = _mat_can_print(**kw)
    return _can_mats[key]


C.mat_can_print = _cached_can_print
PCT = int(arg("--pct", "100"))

STATE = arg("--state", "open")
밖 = C.밖
OUT = arg("--out", os.path.join(밖, "바탕", "렌더", f"문_{STATE}.png"))
CAL = json.load(open(os.path.join(밖, "바탕", "카메라.json"), encoding="utf-8"))
PLATE = os.path.join(밖, "바탕", "받음", "F1_155418.jpg")
# 문 각도(도): 바깥 끝 경첩으로 바깥(카메라 쪽)으로 연다. 원본 박 — 3.0–5.5초 열림 · 11.0 오른쪽 · 11.5 왼쪽 닫힘
ANGLES = {"pull": (0, 0), "seam": (0, 0), "half": (52, 60), "open": (106, 128), "closing": (58, 0), "closed": (0, 0)}
A_L, A_R = ANGLES[STATE]
SEAM_GLOW = STATE in ("seam", "closing")
MIST = STATE in ("open",)

Wb, Hd = CAL["Wb"], CAL["Hd"]
T = 2.4  # 문 두께(m)
IW, IH = CAL["image"]
f_px = CAL["f_px"]


def cv_to_blender_camera():
    import numpy as np  # Blender 파이썬에 numpy가 있다

    rv = np.array(CAL["rvec"], dtype=float)
    th = float(np.linalg.norm(rv))
    k = rv / th if th > 0 else np.array([1.0, 0.0, 0.0])
    Kx = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    R = np.eye(3) + math.sin(th) * Kx + (1 - math.cos(th)) * (Kx @ Kx)  # 로드리게스
    t = np.array(CAL["tvec"], dtype=float)
    Cw = -R.T @ t
    Rbl = R.T @ np.diag([1.0, -1.0, -1.0])
    M = Matrix(((Rbl[0, 0], Rbl[0, 1], Rbl[0, 2], Cw[0]),
                (Rbl[1, 0], Rbl[1, 1], Rbl[1, 2], Cw[1]),
                (Rbl[2, 0], Rbl[2, 1], Rbl[2, 2], Cw[2]),
                (0, 0, 0, 1)))
    return M, R, t


def project(p, R, t):
    import numpy as np

    pc = R @ np.array(p, dtype=float) + t
    u = f_px * pc[0] / pc[2] + IW / 2
    v = f_px * pc[1] / pc[2] + IH / 2
    return u / IW, 1.0 - v / IH


def slab(name, x0, x1, y0, y1, z0, z1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y = y0 if v.co.y < 0 else y1
        v.co.z = z0 if v.co.z < 0 else z1
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def mat_plate(img):
    m, n, l, out = C.new_mat("plate_face")
    tex = n.new("ShaderNodeTexImage")
    tex.image = img
    uv = n.new("ShaderNodeUVMap")
    uv.uv_map = "plate"
    l.new(uv.outputs["UV"], tex.inputs["Vector"])
    e = n.new("ShaderNodeEmission")
    l.new(tex.outputs["Color"], e.inputs["Color"])
    l.new(e.outputs[0], out.inputs["Surface"])
    return m


def mat_holdout():
    m, n, l, out = C.new_mat("holdout")
    h = n.new("ShaderNodeHoldout")
    l.new(h.outputs[0], out.inputs["Surface"])
    return m


def mat_clear_plastic():
    m, n, l, out = C.new_mat("bin_plastic")
    b = C.principled(n, base=(0.95, 0.97, 1.0), rough=0.06, ior=1.49, trans=1.0)
    l.new(C.shadow_pass(n, l, b.outputs[0]).outputs[0], out.inputs["Surface"])
    return m


def door(side, R, t, plate_img):
    """side = -1 왼쪽 · +1 오른쪽. 닫힌 자리에서 메시를 짓고 앞면 UV를 바탕 투영으로 굽는다."""
    x_out, x_in = (-Wb / 2, 0.0) if side < 0 else (Wb / 2, 0.0)
    xa, xb = min(x_out, x_in), max(x_out, x_in)
    gap = 0.06
    if side < 0:
        xb -= gap
    else:
        xa += gap
    ob = slab(f"door_{'L' if side < 0 else 'R'}", xa, xb, 0.0, T, 0.0, Hd)
    me = ob.data
    plate_m = mat_plate(plate_img)
    frame_m = C.mat_simple("door_frame", base=(0.05, 0.07, 0.09), metal=0.6, rough=0.35)
    liner_m = C.mat_simple("door_liner", base=(0.86, 0.87, 0.89), rough=0.30, sss=0.05)
    me.materials.append(plate_m)
    me.materials.append(frame_m)
    me.materials.append(liner_m)
    uvl = me.uv_layers.new(name="plate")
    for p in me.polygons:
        nrm = p.normal
        if nrm.y < -0.9:
            p.material_index = 0  # 바깥 유리면(바탕 투영)
        elif nrm.y > 0.9:
            p.material_index = 2  # 안쪽 내피
        else:
            p.material_index = 1  # 두께 옆면
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uvl.data[li].uv = project((co.x, co.y, co.z), R, t)
    # 안쪽 면 테두리(냉장고 문 고무) — 얇은 판
    gasket_m = C.mat_simple("gasket", base=(0.10, 0.12, 0.16), rough=0.6)
    parts = [ob]
    gw = 0.55
    for (gx0, gx1, gz0, gz1) in ((xa, xb, 0.0, gw), (xa, xb, Hd - gw, Hd), (xa, xa + gw, 0, Hd), (xb - gw, xb, 0, Hd)):
        g = slab("gasket", gx0, gx1, T, T + 0.18, gz0, gz1)
        g.data.materials.append(gasket_m)
        parts.append(g)
    # 투명 칸 두 단 + 캔 셋씩 — 원본 8.0초의 캔(화면 폭 약 9% · 높이 약 10%)에 맞춰 캔 배율 80, 칸도 같이 키움(Fable v1 P1)
    bin_m = mat_clear_plastic()
    wall = 0.22
    bw0, bw1 = xa + 0.6, xb - 0.6
    depth = 6.0
    open_sign = -1 if side < 0 else 1
    open_deg = ANGLES["open"][0] if side < 0 else ANGLES["open"][1]
    cam_w = Vector(CAL["cam"])
    for zb in (Hd * 0.08, Hd * 0.53):
        hb = 4.0  # 칸 높이(앞 턱)
        pieces = [
            (bw0, bw1, T, T + depth, zb, zb + wall),  # 바닥
            (bw0, bw1, T + depth - wall, T + depth, zb, zb + hb),  # 앞 턱
            (bw0, bw0 + wall, T, T + depth, zb, zb + hb + 0.8),  # 옆
            (bw1 - wall, bw1, T, T + depth, zb, zb + hb + 0.8),
        ]
        for pc in pieces:
            b = slab("bin", *pc)
            bev = b.modifiers.new("bev", "BEVEL")
            bev.width = 0.06
            bev.segments = 2
            b.data.materials.append(bin_m)
            parts.append(b)
        s = 80.0  # 캔 배율(지름 66 mm → 5.3 m, 높이 9.8 m)
        n_can = 3
        span = (bw1 - bw0 - 2 * wall)
        for k in range(n_can):
            cx = bw0 + wall + span * (k + 0.5) / n_can
            can = C.make_can(f"can_{side}_{k}_{int(zb)}", segs=96, wet_bump=0.0)
            can.scale = (s, s, s)
            loc = Vector((cx, T + depth * 0.5, zb + wall + 0.02))
            can.location = loc
            # 활짝 열린 자리에서 캔 앞면(엠블럼)이 카메라를 보게 돌린다(문에 매달려 함께 돈다)
            a = math.radians(open_sign * open_deg)
            rel = loc - Vector((x_out, 0.0, 0.0))
            w = Vector((x_out + rel.x * math.cos(a) - rel.y * math.sin(a), rel.x * math.sin(a) + rel.y * math.cos(a), 0.0))
            target = math.atan2(cam_w.y - w.y, cam_w.x - w.x)
            can.rotation_euler = (0, 0, target + math.pi / 2 - a + (k - 1) * 0.05)
            parts.append(can)
    if side > 0:
        # 냉장고 손잡이 — 원본 1.0–2.0초에 꼭대기 공 장식이 막대째 바깥으로 젖혀졌다 돌아오는 박(열림의 첫 박).
        # 실제 건물의 공 장식은 옮기지 않고, 이음매 옆 오른쪽 문 가운데 높이에 짧고 두꺼운 막대 손잡이를 받침 둘로 띄워 단다.
        # 무광 알루미늄(멀리언 색)이라 쉴 때는 커튼월의 일부처럼 보이고, pull(1.5초)에는 아래 받침을 축으로 카메라 쪽으로 40° 당겨진다.
        # (v2의 지붕 위까지 오는 가는 크롬 막대는 흰 안테나로 읽혔다 — Fable v2)
        alu = C.mat_simple("handle_alu", base=(0.60, 0.63, 0.66), metal=1.0, rough=0.38)
        hx, hy, hz0, hz1, hr = xa + 2.4, -2.0, Hd * 0.43, Hd * 0.67, 1.1
        piv = bpy.data.objects.new("door_handle_pivot", None)
        bpy.context.collection.objects.link(piv)
        piv.location = (hx, 0.0, hz0 + 0.9)  # 아래 받침이 문에 붙는 자리
        hparts = [C.cylinder("door_handle_bar", hr, hz1 - hz0, (hx, hy, (hz0 + hz1) / 2), mat=alu)]
        for nm, zc in (("door_handle_top", hz1), ("door_handle_bot", hz0)):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=hr, location=(hx, hy, zc), segments=32, ring_count=16)
            cp = bpy.context.active_object
            cp.name = nm
            for pg in cp.data.polygons:
                pg.use_smooth = True
            cp.data.materials.append(alu)
            hparts.append(cp)
        for nm, zc in (("door_handle_mount_bot", hz0 + 0.9), ("door_handle_mount_top", hz1 - 0.9)):
            hparts.append(C.cylinder(nm, 0.75, abs(hy), (hx, hy / 2, zc), rot=(math.radians(90), 0, 0), mat=alu))
        for ch in hparts:
            ch.parent = piv
            ch.matrix_parent_inverse = Matrix.Translation(Vector((-hx, 0.0, -(hz0 + 0.9))))
        if STATE == "pull":
            piv.rotation_euler = (math.radians(40), 0, 0)  # 위가 카메라 쪽으로 — 위 받침이 문에서 떨어진다(28°는 정지 그림에서 차이가 약했다)
        parts += [piv]
    # 문 전체를 경첩(바깥 앞 모서리)에 매단다
    hinge = bpy.data.objects.new(f"hinge_{side}", None)
    bpy.context.collection.objects.link(hinge)
    hinge.location = (x_out, 0.0, 0.0)
    bpy.context.view_layer.update()
    for p in parts:
        mw = p.matrix_world.copy()
        p.parent = hinge
        p.matrix_parent_inverse = hinge.matrix_world.inverted()
        p.matrix_world = mw
    return hinge


def main():
    sc = C.reset()
    sc.view_settings.view_transform = "Standard"  # 바탕 투영면이 바탕 화소와 같게(AgX면 색이 바뀐다)
    sc.view_settings.look = "None"
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.resolution_x, sc.render.resolution_y = IW, IH
    sc.render.resolution_percentage = PCT
    plate_img = bpy.data.images.load(PLATE)
    M, R, t = cv_to_blender_camera()
    cd = bpy.data.cameras.new("cam")
    cd.sensor_fit = "HORIZONTAL"
    cd.sensor_width = 36.0
    cd.lens = f_px * 36.0 / IW
    cd.clip_start = 1.0
    cd.clip_end = 5000
    cam = bpy.data.objects.new("cam", cd)
    bpy.context.collection.objects.link(cam)
    cam.matrix_world = M
    sc.camera = cam
    # 하늘빛(주변광) + 해(바탕처럼 왼쪽 위 앞에서)
    C.world_color((0.55, 0.68, 0.88), 0.9)
    sun_d = bpy.data.lights.new("sun", "SUN")
    sun_d.energy = 2.6
    sun_d.angle = math.radians(1.5)
    sun = bpy.data.objects.new("sun", sun_d)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
    # 문
    hl = door(-1, R, t, plate_img)
    hr = door(+1, R, t, plate_img)
    hl.rotation_euler = (0, 0, math.radians(-A_L))
    hr.rotation_euler = (0, 0, math.radians(A_R))
    # 안쪽 빈 곳: 냉장고 흰 내벽 + 루비빛(원본 노란빛 자리)
    D = 16.0
    inner = C.mat_simple("inner", base=(0.40, 0.012, 0.045), rough=0.20)  # 광택 루비 내벽(흰 벽 + 루비빛은 분홍으로 읽혔다 — Fable v1)
    for nm, box_ in (("back", (-Wb / 2 + 0.4, Wb / 2 - 0.4, D, D + 0.3, 0.2, Hd - 0.2)),
                     ("floor", (-Wb / 2 + 0.4, Wb / 2 - 0.4, 0.3, D, 0.0, 0.25)),
                     ("ceil", (-Wb / 2 + 0.4, Wb / 2 - 0.4, 0.3, D, Hd - 0.25, Hd)),
                     ("wl", (-Wb / 2 + 0.1, -Wb / 2 + 0.4, 0.3, D, 0.0, Hd)),
                     ("wr", (Wb / 2 - 0.4, Wb / 2 - 0.1, 0.3, D, 0.0, Hd))):
        o = slab(nm, *box_)
        o.data.materials.append(inner)
    led = C.mat_emit("ruby_led", (1.0, 0.30, 0.38), 10.0)  # 루비 벽 위 띠 — 네온 간판처럼 캔보다 먼저 보이지 않게(Fable v2 P3)
    xl, xr, zt = -Wb / 2 + 0.45, Wb / 2 - 0.45, Hd - 0.3
    for nm, box_ in (("led_t", (xl, xr, 0.35, 0.75, zt - 0.4, zt)),           # 천장 앞 가장자리
                     ("led_tb", (xl, xr, D - 0.4, D, zt - 0.4, zt)),           # 천장 뒤 가장자리
                     ("led_bl", (xl, xl + 0.4, D - 0.4, D, 0.3, zt)),           # 뒤 모서리 둘
                     ("led_br", (xr - 0.4, xr, D - 0.4, D, 0.3, zt)),
                     ("led_fl", (xl, xl + 0.4, 0.35, 0.75, 0.3, zt)),          # 앞 옆 가장자리 둘
                     ("led_fr", (xr - 0.4, xr, 0.35, 0.75, 0.3, zt))):
        o = slab(nm, *box_)
        o.data.materials.append(led)
    for k, (lx, lz) in enumerate(((0, Hd - 1.0),)):
        ld = bpy.data.lights.new(f"ruby{k}", "AREA")
        ld.shape = "RECTANGLE"
        ld.size, ld.size_y = (Wb - 2, D - 2) if k == 0 else (1.0, D - 2)
        ld.energy = 1500
        ld.color = (1.0, 0.86, 0.88)
        lo = bpy.data.objects.new(f"ruby{k}", ld)
        bpy.context.collection.objects.link(lo)
        lo.location = (lx, D * 0.5, lz)
        lo.rotation_euler = (0, 0, 0) if k == 0 else (0, math.radians(90 if k == 1 else -90), 0)
        if k == 0:
            lo.rotation_euler = (math.radians(180), 0, 0)
    # 해가 냉장고 속으로 들어오지 않게: 문 자리 바로 뒤의 판이 해 그림자만 낸다(카메라 · 반사 · 다른 빛에는 없음)
    blk = slab("sun_blocker", -Wb / 2, Wb / 2, 0.9, 1.0, 0.0, Hd)
    blk.visible_shadow = True
    for attr in ("visible_camera", "visible_diffuse", "visible_glossy", "visible_transmission", "visible_volume_scatter"):
        setattr(blk, attr, False)
    sun_block = bpy.data.collections.new("sun_blockers")
    bpy.context.scene.collection.children.link(sun_block)
    sun_block.objects.link(blk)
    for ob in list(bpy.context.scene.objects):
        if ob.name.startswith(("door_", "can_", "bin", "gasket", "tab", "Cylinder")) and ob.type == "MESH":
            sun_block.objects.link(ob)
        # 안쪽 벽도 해 그림자를 낸다 — 빠지면 해가 천장 · 옆벽을 뚫고 들어와 안쪽에 네모 자국이 난다(Fable v1 P2)
        elif ob.name.split(".")[0] in ("back", "floor", "ceil", "wl", "wr"):
            sun_block.objects.link(ob)
    sun.light_linking.blocker_collection = sun_block
    inner_coll = bpy.data.collections.new("inner_walls")
    bpy.context.scene.collection.children.link(inner_coll)
    for ob in list(bpy.context.scene.objects):
        if ob.name.split(".")[0] in ("back", "floor", "ceil", "wl", "wr"):
            inner_coll.objects.link(ob)
    for ob in list(bpy.context.scene.objects):
        if ob.type == "LIGHT" and ob.name.startswith("ruby"):
            ob.light_linking.blocker_collection = inner_coll
    # 앞면 가림판(구멍 뚫린 holdout): 문 자리 밖으로는 빈 곳이 안 보이게
    hold = mat_holdout()
    big = 400
    # 지붕 위(하늘)는 가리지 않는다 — 김이 지붕 위로 보여야 한다
    for box_ in ((-big, -Wb / 2, -0.05, -0.04, -big, Hd), (Wb / 2, big, -0.05, -0.04, -big, Hd),
                 (-Wb / 2, Wb / 2, -0.05, -0.04, -big, 0.0)):
        o = slab("holdout", *box_)
        o.data.materials.append(hold)
        o.visible_shadow = False
    # 이음매 빛(문 사이 틈으로 새는 안쪽 빛)
    if SEAM_GLOW:
        x_seam = 0.0 if STATE == "seam" else -0.0
        s_ = slab("seam_glow", x_seam - 0.12, x_seam + 0.12, -0.10, -0.06, 0.4, Hd - 0.4)
        s_.data.materials.append(C.mat_emit("seam", (1.0, 0.08, 0.18), 9.0))
    if MIST:
        C.mist("mist_roof", (Wb * 1.2, 14.0, 22.0), (0, 6.0, Hd + 9.0), density=0.10, scale=0.06, lo=0.42, hi=0.80,
               rgb=(0.95, 0.97, 1.0), seed=7.0)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sc.render.filepath = OUT
    if C.SAVE:
        bpy.ops.wm.save_as_mainfile(filepath=OUT.replace(".png", ".blend"))
    bpy.ops.render.render(write_still=True)
    print("RENDERED", OUT)


main()

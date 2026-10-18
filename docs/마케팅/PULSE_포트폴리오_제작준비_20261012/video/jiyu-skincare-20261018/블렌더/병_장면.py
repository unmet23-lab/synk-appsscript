# 지유 스킨케어 · 가상 브랜드 「맑음」 토너 병 장면(콘티 v2 5절, 경로 B). 블렌더 5.2 배경 실행용.
#   blender -b --python 병_장면.py -- --cut 2|6|7|alt --quality preview|final --out <폴더> [--frames 1,24,48] [--brand malgeum|soom]
#                                       [--device CPU|GPU] [--save 장면.blend]
# 컷 2: 100mm 접사, 병 어깨에 맺힌 물방울 하나가 컷 시작에서 흘러내리고(젖은 자국이 따라옴), 48프레임(2초 @24).
# 컷 6: 100mm, 병 전체, 창(화면 왼쪽)과 병 사이 화분 잎 그림자가 흔들리고 뒤 커튼이 부푼다, 4% 밀어 들어가기, 48프레임.
# 컷 7: 65mm 팩샷, 투명 바탕(엔드카드 그늘 벽에 띄워 합성), 한 장.
# alt: 컷 2 첫 프레임을 둘째 브랜드 라벨로(제품 교체 시연), 한 장.
# 재료(그림)는 같은 폴더 라벨.py·재료준비.py가 Documents/synk-vendor/jiyu-skincare-20261018/블렌더/에 만든다.
# 크기(mm): 병 지름 45, 높이 140(뚜껑 포함), 유리 두께 2, 서리 유리. 단위는 m로 짓는다.
import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--cut", choices=["2", "6", "7", "alt"], required=True)
ap.add_argument("--quality", choices=["preview", "mid", "final"], default="preview")
ap.add_argument("--frames", default="")
ap.add_argument("--brand", default="")
ap.add_argument("--out", required=True)
ap.add_argument("--device", choices=["CPU", "GPU"], default="CPU")
ap.add_argument("--save", default="")
A = ap.parse_args(argv)
BRAND = A.brand or ("soom" if A.cut == "alt" else "malgeum")
MAT_DIR = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018", "블렌더")
MM = 0.001
FRONT = -math.pi / 2          # 병 앞면(라벨 가운데)이 보는 방향 = -Y(카메라 쪽)
DROP_ANG = math.radians(-112)  # 물방울 길: 앞면에서 창 쪽(왼쪽)으로 22도

bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene
S.render.fps = 24
S.frame_start, S.frame_end = 1, 48 if A.cut in ("2", "6") else 1


def link(ob):
    S.collection.objects.link(ob)
    return ob


def new_mat(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    return m, m.node_tree.nodes, m.node_tree.links


def principled(nodes):
    for n in list(nodes):
        if n.type == "BSDF_PRINCIPLED":
            return n
    return nodes.new("ShaderNodeBsdfPrincipled")


def setin(node, name, value):
    if name in node.inputs:
        node.inputs[name].default_value = value


# ── 모양: 옆 단면(반지름 r, 높이 z, mm)을 z축으로 돌려 짓는다 ──────────────────────────
def revolve(name, prof, segs=160):
    bm = bmesh.new()
    vs = [bm.verts.new((r * MM, 0, z * MM)) for r, z in prof]
    es = [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
    bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=segs,
                   use_merge=True, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return link(bpy.data.objects.new(name, me))


def arc(cx, cz, rx, rz, a0, a1, n):
    return [(cx + rx * math.cos(a0 + (a1 - a0) * i / n), cz + rz * math.sin(a0 + (a1 - a0) * i / n)) for i in range(1, n + 1)]


SH_C, SH_RX, SH_RZ = (10.0, 98.0), 12.5, 16.0   # 어깨: 타원 1/4(가운데 r10·z98)


def bottle_profile():
    p = [(0.0, 0.0), (19.5, 0.0)]
    p += arc(19.5, 3.0, 3.0, 3.0, -math.pi / 2, 0, 8)           # 바닥 모서리 둥글게
    p += [(22.5, 98.0)]
    p += arc(SH_C[0], SH_C[1], SH_RX, SH_RZ, 0, math.pi / 2, 16)  # 둥근 어깨 → (10, 114)
    p += [(9.5, 114.5), (9.5, 120.0), (0.0, 120.0)]
    return p


def liquid_profile():
    # 10-18 Fable 재검수: 88mm(라벨 위 가로줄)까지만 채운 병은 「절반 채움」이라 CG 티가 났다 → 어깨 안쪽 z 108mm까지,
    # 어깨 곡선을 안쪽으로 2.2mm 띄워 따라간다(유리 안쪽 면과 겹치지 않게)
    p = [(0.0, 2.3), (17.6, 2.3)]
    p += arc(17.6, 5.0, 2.7, 2.7, -math.pi / 2, 0, 6)
    p += [(20.3, 98.0)]
    for i in range(1, 9):
        z = 98.0 + 10.0 * i / 8
        t = math.asin((z - SH_C[1]) / SH_RZ)
        p.append((SH_C[0] + SH_RX * math.cos(t) - 2.2, z))
    p += [(0.0, 108.0)]
    return p


def cap_profile():
    p = [(0.0, 117.5), (12.0, 117.5), (12.0, 138.8)]
    p += arc(10.8, 138.8, 1.2, 1.2, 0, math.pi / 2, 6)
    p += [(0.0, 140.0)]
    return p


def surface_at(a, z):
    # 몸통·어깨 바깥면의 점과 바깥 법선(높이 z mm, 각도 a)
    if z <= 98.0:
        r, nr, nz = 22.5, 1.0, 0.0
    else:
        t = math.asin(min(1.0, (z - SH_C[1]) / SH_RZ))
        r = SH_C[0] + SH_RX * math.cos(t)
        nr, nz = math.cos(t) / SH_RX, math.sin(t) / SH_RZ
        k = math.hypot(nr, nz)
        nr, nz = nr / k, nz / k
    P = Vector((r * math.cos(a) * MM, r * math.sin(a) * MM, z * MM))
    N = Vector((nr * math.cos(a), nr * math.sin(a), nz)).normalized()
    return P, N


# ── 재질 ──────────────────────────────────────────────────────────────────────
def glass_mat():
    m, n, l = new_mat("서리유리")
    b = principled(n)
    setin(b, "Base Color", (0.97, 0.98, 0.98, 1))
    setin(b, "Roughness", 0.5)  # 0.27·0.36은 속 토너가 렌즈처럼 배경을 또렷이 비춰 「ㅅ」자 무늬가 생겼다
    setin(b, "IOR", 1.47)
    setin(b, "Transmission Weight", 1.0)
    return m


def water_mat(name="물", rough=0.0, ior=1.33, tint=(1, 1, 1, 1)):
    m, n, l = new_mat(name)
    b = principled(n)
    setin(b, "Base Color", tint)
    setin(b, "Roughness", rough)
    setin(b, "IOR", ior)
    setin(b, "Transmission Weight", 1.0)
    return m


def trail_mat():
    # 젖은 띠: 맑은 물(투과·매끈)인데 UV v가 「진행」값보다 큰 곳(아직 안 흐른 곳)은 투명
    m, n, l = new_mat("젖은자국")
    out = [x for x in n if x.type == "OUTPUT_MATERIAL"][0]
    b = principled(n)
    setin(b, "Base Color", (1, 1, 1, 1))
    setin(b, "Roughness", 0.02)
    setin(b, "IOR", 1.33)
    setin(b, "Transmission Weight", 1.0)
    tr = n.new("ShaderNodeBsdfTransparent")
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    prog = n.new("ShaderNodeValue")
    prog.name = "진행"
    lt = n.new("ShaderNodeMath")
    lt.operation = "LESS_THAN"
    mix = n.new("ShaderNodeMixShader")
    l.new(tc.outputs["UV"], sep.inputs[0])
    l.new(sep.outputs["Y"], lt.inputs[0])
    l.new(prog.outputs[0], lt.inputs[1])
    l.new(lt.outputs[0], mix.inputs["Fac"])
    l.new(tr.outputs[0], mix.inputs[1])
    l.new(b.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs["Surface"])
    return m, prog


def cap_mat():
    m, n, l = new_mat("뚜껑")
    b = principled(n)
    setin(b, "Base Color", (0.86, 0.86, 0.85, 1))
    setin(b, "Roughness", 0.55)
    # 옆면 세로 홈(돌림 뚜껑): 각도 그라디언트 → 90번 핑퐁 → 범프, 위·아래 면은 빼기
    tc = n.new("ShaderNodeTexCoord")
    gr = n.new("ShaderNodeTexGradient")
    gr.gradient_type = "RADIAL"
    mul = n.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = 90.0
    pp = n.new("ShaderNodeMath")
    pp.operation = "PINGPONG"
    pp.inputs[1].default_value = 0.5
    geo = n.new("ShaderNodeNewGeometry")
    sep = n.new("ShaderNodeSeparateXYZ")
    absn = n.new("ShaderNodeMath")
    absn.operation = "ABSOLUTE"
    side = n.new("ShaderNodeMath")
    side.operation = "LESS_THAN"
    side.inputs[1].default_value = 0.5
    mask = n.new("ShaderNodeMath")
    mask.operation = "MULTIPLY"
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.0004
    l.new(tc.outputs["Object"], gr.inputs["Vector"])
    l.new(gr.outputs["Fac"], mul.inputs[0])
    l.new(mul.outputs[0], pp.inputs[0])
    l.new(geo.outputs["Normal"], sep.inputs[0])
    l.new(sep.outputs["Z"], absn.inputs[0])
    l.new(absn.outputs[0], side.inputs[0])
    l.new(pp.outputs[0], mask.inputs[0])
    l.new(side.outputs[0], mask.inputs[1])
    l.new(mask.outputs[0], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def label_mat(path):
    m, n, l = new_mat("라벨")
    out = [x for x in n if x.type == "OUTPUT_MATERIAL"][0]
    for x in list(n):
        if x.type == "BSDF_PRINCIPLED":
            n.remove(x)
    img = bpy.data.images.load(path, check_existing=True)
    img.alpha_mode = "STRAIGHT"
    tex = n.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Cubic"
    # 10-18 첫 미리보기: 흰 잉크는 서리 유리·흰 배경에 묻혀 안 읽혔다 → 짙은 회색 실크 인쇄(국내 토너 병에 흔한 방식)
    ink = n.new("ShaderNodeBsdfPrincipled")
    setin(ink, "Base Color", (0.075, 0.08, 0.085, 1))
    setin(ink, "Roughness", 0.5)
    tr = n.new("ShaderNodeBsdfTransparent")
    mix = n.new("ShaderNodeMixShader")
    l.new(tex.outputs["Alpha"], mix.inputs["Fac"])
    l.new(tr.outputs[0], mix.inputs[1])
    l.new(ink.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs["Surface"])
    return m


def marble_mat():
    m, n, l = new_mat("대리석")
    b = principled(n)
    setin(b, "Roughness", 0.13)
    setin(b, "Coat Weight", 0.25)
    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (3.0, 3.0, 3.0)
    wave = n.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "DIAGONAL"
    wave.inputs["Scale"].default_value = 1.6
    wave.inputs["Distortion"].default_value = 14.0
    wave.inputs["Detail"].default_value = 9.0
    wave.inputs["Detail Scale"].default_value = 1.8
    ramp = n.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, (0.90, 0.90, 0.89, 1)
    els[1].position, els[1].color = 1.0, (0.90, 0.90, 0.89, 1)
    for pos, c in ((0.46, 0.90), (0.5, 0.62), (0.54, 0.90)):
        e = els.new(pos)
        e.color = (c, c, c * 0.995, 1)
    # 잔 얼룩: 잔 노이즈를 결 값에 ±0.02 더한다(Mix 노드는 이름이 겹쳐 입력을 잘못 잡기 쉬워 Math로)
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 40.0
    noise.inputs["Detail"].default_value = 4.0
    ma = n.new("ShaderNodeMath")
    ma.operation = "MULTIPLY_ADD"
    ma.inputs[1].default_value = 0.04
    ma.inputs[2].default_value = -0.02
    add = n.new("ShaderNodeMath")
    add.operation = "ADD"
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    l.new(mp.outputs["Vector"], wave.inputs["Vector"])
    l.new(mp.outputs["Vector"], noise.inputs["Vector"])
    l.new(noise.outputs["Fac"], ma.inputs[0])
    l.new(wave.outputs["Fac"], add.inputs[0])
    l.new(ma.outputs[0], add.inputs[1])
    l.new(add.outputs[0], ramp.inputs["Fac"])
    l.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return m


def emission_image_mat(name, path, strength=1.0, sway=False):
    m, n, l = new_mat(name)
    out = [x for x in n if x.type == "OUTPUT_MATERIAL"][0]
    for x in list(n):
        if x.type == "BSDF_PRINCIPLED":
            n.remove(x)
    tex = n.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(path, check_existing=True)
    em = n.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = strength
    if sway:
        # 커튼이 부푸는 결: 배경 사진의 창 쪽(u < 0.32)만 4D 노이즈로 가로 ±0.6% 흔든다. W를 2초에 0 → 0.6
        tc = n.new("ShaderNodeTexCoord")
        sep = n.new("ShaderNodeSeparateXYZ")
        noise = n.new("ShaderNodeTexNoise")
        noise.noise_dimensions = "4D"
        noise.inputs["Scale"].default_value = 3.0
        noise.inputs["Detail"].default_value = 2.0
        wv = noise.inputs["W"]
        for f, v in ((1, 0.0), (48, 0.6)):
            wv.default_value = v
            wv.keyframe_insert("default_value", frame=f)
        mask = n.new("ShaderNodeMapRange")
        mask.inputs["From Min"].default_value = 0.36
        mask.inputs["From Max"].default_value = 0.28
        amt = n.new("ShaderNodeMath")
        amt.operation = "MULTIPLY_ADD"
        amt.inputs[1].default_value = 0.012
        amt.inputs[2].default_value = -0.006
        gate = n.new("ShaderNodeMath")
        gate.operation = "MULTIPLY"
        addx = n.new("ShaderNodeMath")
        addx.operation = "ADD"
        comb = n.new("ShaderNodeCombineXYZ")
        l.new(tc.outputs["UV"], sep.inputs[0])
        l.new(tc.outputs["UV"], noise.inputs["Vector"])
        l.new(sep.outputs["X"], mask.inputs["Value"])
        l.new(noise.outputs["Fac"], amt.inputs[0])
        l.new(amt.outputs[0], gate.inputs[0])
        l.new(mask.outputs["Result"], gate.inputs[1])
        l.new(sep.outputs["X"], addx.inputs[0])
        l.new(gate.outputs[0], addx.inputs[1])
        l.new(addx.outputs[0], comb.inputs["X"])
        l.new(sep.outputs["Y"], comb.inputs["Y"])
        l.new(comb.outputs[0], tex.inputs["Vector"])
    l.new(tex.outputs["Color"], em.inputs["Color"])
    l.new(em.outputs[0], out.inputs["Surface"])
    return m


def gobo_mat(path):
    m, n, l = new_mat("잎가림")
    out = [x for x in n if x.type == "OUTPUT_MATERIAL"][0]
    for x in list(n):
        if x.type == "BSDF_PRINCIPLED":
            n.remove(x)
    tex = n.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(path, check_existing=True)
    tex.image.colorspace_settings.name = "Non-Color"
    tr = n.new("ShaderNodeBsdfTransparent")
    df = n.new("ShaderNodeBsdfDiffuse")
    df.inputs["Color"].default_value = (0.02, 0.03, 0.02, 1)
    mix = n.new("ShaderNodeMixShader")
    l.new(tex.outputs["Color"], mix.inputs["Fac"])   # 흰 바탕 = 1 → 투명, 검은 잎 = 0 → 가림
    l.new(df.outputs[0], mix.inputs[1])
    l.new(tr.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs["Surface"])
    return m


# ── 병 짓기 ────────────────────────────────────────────────────────────────────
def build_bottle():
    body = revolve("병", bottle_profile())
    sol = body.modifiers.new("두께", "SOLIDIFY")
    sol.thickness = 2.0 * MM
    sol.offset = -1.0
    sol.use_even_offset = True
    body.data.materials.append(glass_mat())
    liq = revolve("토너", liquid_profile())
    liq.data.materials.append(water_mat("토너액", 0.0, 1.335, (0.995, 0.995, 0.99, 1)))
    cap = revolve("뚜껑", cap_profile())
    cap.data.materials.append(cap_mat())
    # 라벨 소매: 유리 바깥 0.12mm, 높이 14~84.7mm(라벨 그림 세로 70.7mm), u는 앞면이 0.5
    segs, z0, z1, r = 256, 14.0, 84.7, 22.62
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UV")
    cols = []
    for i in range(segs + 1):
        u = i / segs
        a = FRONT + (u - 0.5) * 2 * math.pi
        cols.append((bm.verts.new((r * MM * math.cos(a), r * MM * math.sin(a), z0 * MM)),
                     bm.verts.new((r * MM * math.cos(a), r * MM * math.sin(a), z1 * MM)), u))
    for i in range(segs):
        (a0, a1, u0), (b0, b1, u1) = cols[i], cols[i + 1]
        f = bm.faces.new((a0, b0, b1, a1))
        for lp, (uu, vv) in zip(f.loops, ((u0, 0), (u1, 0), (u1, 1), (u0, 1))):
            lp[uv].uv = (uu, vv)
    me = bpy.data.meshes.new("라벨")  # 면 순서(아래 둘레 → 위)로 법선이 바깥을 본다
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    lab = link(bpy.data.objects.new("라벨", me))
    lab.data.materials.append(label_mat(os.path.join(MAT_DIR, f"라벨_{BRAND}.png")))
    return body


def drop_mesh(name):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1.0 * MM)
    ob = bpy.context.active_object
    ob.name = name
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def place_on_surface(ob, a, z, lift, scale):
    P, N = surface_at(a, z)
    up = Vector((0, 0, 1))
    T = (up - N * up.dot(N)).normalized() * -1  # 아래로 흐르는 방향
    X = T.cross(N)
    ob.matrix_world = Matrix.Translation(P + N * lift * MM) @ Matrix((X, T, N)).transposed().to_4x4() @ Matrix.Diagonal((*scale, 1))


def build_drops():
    wm = water_mat("물방울")
    hero = drop_mesh("물방울_주인공")
    hero.data.materials.append(wm)
    # 김 서린 작은 물방울: 물방울 길(±3mm)은 비운다
    import random
    rnd = random.Random(1018)
    small = []
    for k in range(34):
        a = FRONT + math.radians(rnd.uniform(-70, 70))
        z = rnd.uniform(64, 111)
        if abs(math.degrees(a - DROP_ANG)) < 9:
            continue
        s = rnd.uniform(0.25, 0.75)
        ob = bpy.data.objects.new(f"김방울{k:02d}", hero.data)
        link(ob)
        place_on_surface(ob, a, z, 0.22 * s, (s, s * rnd.uniform(1.0, 1.35), s * 0.45))
        small.append(ob)
    # 주인공 물방울 길: 어깨 z108 → 몸통 z62, 살짝 구불(±0.6mm). 10-18 Fable 재검수: 1mm 물방울은 안 보이고,
    # 머리 없는 가는 직선 자국은 흠집으로 읽혔다 → 물방울 3~4mm, 자국은 서리 유리가 젖어 투명해진 2mm 띠
    zs = [108 - 46 * i / 300 for i in range(301)]
    angs = [DROP_ANG + 0.025 * math.sin((108 - z) / 6.0) for z in zs]
    pts = [surface_at(a, z) for a, z in zip(angs, zs)]
    length = [0.0]
    for i in range(1, len(pts)):
        length.append(length[-1] + (pts[i][0] - pts[i - 1][0]).length)
    total = length[-1]
    # 젖은 띠: 길을 따라 폭 2mm 띠를 표면에서 0.04mm 띄우고 0.12mm 두께로. UV v = 길이 비율, 셰이더 「진행」값까지만 보인다
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UV")
    rows = []
    for i, (P, N) in enumerate(pts):
        T = (pts[min(i + 1, len(pts) - 1)][0] - pts[max(i - 1, 0)][0]).normalized()
        S = T.cross(N).normalized()
        c = P + N * 0.04 * MM
        rows.append((bm.verts.new(c - S * 1.0 * MM), bm.verts.new(c + S * 1.0 * MM), length[i] / total))
    for i in range(len(rows) - 1):
        (a0, a1, v0), (b0, b1, v1) = rows[i], rows[i + 1]
        f = bm.faces.new((a0, a1, b1, b0))  # 옆(S) → 아래(T) 순서라 법선이 바깥(N)
        for lp, (uu, vv) in zip(f.loops, ((0, v0), (1, v0), (1, v1), (0, v1))):
            lp[uv].uv = (uu, vv)
    me = bpy.data.meshes.new("젖은자국")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    band = link(bpy.data.objects.new("젖은자국", me))
    sol = band.modifiers.new("두께", "SOLIDIFY")
    sol.thickness = 0.12 * MM
    sol.offset = 1.0
    tmat, prog = trail_mat()
    band.data.materials.append(tmat)
    for f in range(1, 49):
        t = max(0.0, (f - 3) / 45)
        s = t ** 1.7  # 처음 천천히, 점점 빨리
        target = s * total
        i = min(range(len(length)), key=lambda j: abs(length[j] - target))
        # 흐르는 동안 앞이 조금 늘어난다
        place_on_surface(hero, angs[i], zs[i], 0.55, (1.6, 2.0 + 0.4 * min(1, t * 3), 0.95))
        hero.keyframe_insert("location", frame=f)
        hero.keyframe_insert("rotation_euler", frame=f)
        hero.keyframe_insert("scale", frame=f)
        prog.outputs[0].default_value = max(0.0, (target - 1.5 * MM) / total)  # 물방울 머리 뒤 1.5mm까지 젖음
        prog.outputs[0].keyframe_insert("default_value", frame=f)
    return hero, (tmat, prog)


# ── 세면대·배경·빛 ─────────────────────────────────────────────────────────────
def build_room(with_counter=True, with_back=True, sway=False, plate=(0.0, 0.5)):
    # plate = (배경판 가운데 x, 폭 m). 컷마다 카메라가 보는 폭에 창(왼쪽)과 화분(오른쪽)이 함께 들어오게 놓는다
    objs = {}
    if with_counter:
        # 크기를 메시에 바로 넣는다(물체 배율로 키우면 둥근 끝 너비가 축마다 찌그러진다).
        # 10-18 Fable 재검수: 0.7×0.36m 판은 앞면이 보이는 진열대처럼 읽혔다 → 1.6×0.9m 세면대, 병은 앞 끝에서 30cm 안
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(1.6, 0.9, 0.025), verts=bm.verts)
        me = bpy.data.meshes.new("세면대")
        bm.to_mesh(me)
        bm.free()
        c = link(bpy.data.objects.new("세면대", me))
        c.location = (0.0, 0.15, -0.0125)  # 윗면 z=0, 앞 끝 y=-0.30, 뒤 끝 y=0.60
        bv = c.modifiers.new("둥근끝", "BEVEL")
        bv.width = 0.003
        bv.segments = 4
        c.data.materials.append(marble_mat())
        objs["counter"] = c
    if with_back:
        bpy.ops.mesh.primitive_plane_add(size=1.0)
        bp = bpy.context.active_object
        bp.name = "배경판"
        # 배경판 그림(컷 3 최종판 위쪽, 1536×1211): 세면대 뒤 끝(y 0.60)보다 40cm 뒤, 아래 끝은 세면대 윗면 아래까지
        px, pw = plate
        ph = pw * 1211 / 1536
        bp.scale = (pw, ph, 1)
        bp.rotation_euler = (math.radians(90), 0, 0)
        bp.location = (px, 1.0, -0.10 + ph / 2)
        # 0.95·1.7은 AgX가 밝은 쪽을 눌러 회색 벽으로 보였다 → 3.2(사람 컷 키프레임처럼 밝고 하얀 욕실)
        bp.data.materials.append(emission_image_mat("배경판", os.path.join(MAT_DIR, "배경판.jpg"), 3.2, sway))
        bp.visible_shadow = False
        objs["back"] = bp
    # 창: 화면 왼쪽(-X), 조금 뒤에서 들어오는 커튼 너머 부드러운 빛
    win = bpy.data.lights.new("창빛", "AREA")
    win.shape = "RECTANGLE"
    win.size, win.size_y = 0.9, 1.3
    win.energy = 200 if sway else 420  # 컷 6은 잎 그림자(햇빛)가 보이게 창빛을 줄인다
    # 사람 컷 벽은 따뜻한 흰색(R-B +6~12)인데 블렌더는 중성 회색으로 나와(Fable 재검수) 아침 창빛을 조금 따뜻하게
    win.color = (1.0, 0.95, 0.88)
    wob = link(bpy.data.objects.new("창빛", win))
    wob.location = (-1.1, 0.25, 0.55)
    wob.rotation_euler = (0, 0, 0)
    look_at(wob, Vector((0, 0, 0.07)))
    fill = bpy.data.lights.new("반사빛", "AREA")
    fill.shape = "RECTANGLE"
    fill.size, fill.size_y = 1.2, 1.0
    fill.energy = 60
    fob = link(bpy.data.objects.new("반사빛", fill))
    fob.location = (0.9, -0.8, 0.4)
    look_at(fob, Vector((0, 0, 0.07)))
    w = bpy.data.worlds.new("방")
    try:
        w.use_nodes = True
    except Exception:
        pass
    bg = w.node_tree.nodes.get("Background") or w.node_tree.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (0.86, 0.83, 0.79, 1)
    bg.inputs["Strength"].default_value = 0.35
    S.world = w
    return objs


def look_at(ob, target):
    d = (target - ob.location).normalized()
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def build_leaf_shadow():
    sun = bpy.data.lights.new("햇빛", "SUN")
    # 10-18 미리보기: 햇빛 2.2·4.5는 창빛(면적광 300W ≈ 병에서 66W/㎡)보다 15배 약해 잎 그림자가 묻혔다 → 창빛과 비슷하게
    sun.energy = 50
    sun.angle = math.radians(3.0)  # 얇은 커튼을 지난 빛이라 그림자 가장자리를 부드럽게(Fable 재검수)
    sun.color = (1.0, 0.94, 0.85)
    so = link(bpy.data.objects.new("햇빛", sun))
    so.location = (-0.8, -0.7, 0.55)  # 왼쪽 앞 위: 잎 그림자가 라벨 쪽 앞면에 걸리게(왼쪽 옆에서 비추면 세면대에만 졌다)
    look_at(so, Vector((0, 0, 0.06)))
    bpy.ops.mesh.primitive_plane_add(size=0.9)
    g = bpy.context.active_object
    g.name = "잎가림"
    g.data.materials.append(gobo_mat(os.path.join(MAT_DIR, "잎그림자.png")))
    g.visible_camera = False
    g.visible_glossy = False
    g.visible_transmission = False
    g.visible_diffuse = False
    # 햇빛과 병 사이(병에서 0.30m), 햇빛 쪽을 본다. 잎이 천천히 흔들리면서 2초에 4cm 옆으로 흘러
    # 그림자가 병 몸통을 지나간다(Fable 재검수: 그림자가 병 옆 바닥·벽에만 있었다)
    tgt = Vector((0, 0, 0.06))
    sdir = (so.location - tgt).normalized()
    side = sdir.cross(Vector((0, 0, 1))).normalized()
    base = tgt + sdir * 0.30
    for f in range(1, 49):
        t = (f - 1) / 47
        g.location = base + side * (-0.02 + 0.04 * t) + Vector((0, 0.008 * math.sin(2 * math.pi * (0.55 * t + 0.1)), 0.006 * math.sin(2 * math.pi * (0.8 * t))))
        look_at(g, so.location)
        g.rotation_euler.rotate_axis("Z", math.radians(2.5 * math.sin(2 * math.pi * 0.6 * t)))
        g.keyframe_insert("location", frame=f)
        g.keyframe_insert("rotation_euler", frame=f)


# ── 카메라 ────────────────────────────────────────────────────────────────────
def camera(lens, pos, target, fstop=None, focus=None):
    cd = bpy.data.cameras.new("카메라")
    cd.lens = lens
    cd.sensor_width = 36.0
    cd.sensor_fit = "AUTO"
    ob = link(bpy.data.objects.new("카메라", cd))
    ob.location = pos
    look_at(ob, target)
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        if isinstance(focus, bpy.types.Object):
            cd.dof.focus_object = focus
        elif focus is not None:
            cd.dof.focus_distance = focus
    S.camera = ob
    return ob


def setup_render(transparent=False):
    S.render.engine = "CYCLES"
    q = A.quality == "final"
    S.render.resolution_x, S.render.resolution_y = 1080, 1920
    # preview 25%·24샘플(구도 확인), mid 50%·48샘플(가편집에 끼울 정지 그림, CPU 한 장 2~3분), final 100%·384샘플(GPU)
    S.render.resolution_percentage = {"preview": 25, "mid": 50, "final": 100}[A.quality]
    S.cycles.samples = {"preview": 24, "mid": 48, "final": 384}[A.quality]
    S.cycles.use_adaptive_sampling = True
    S.cycles.adaptive_threshold = 0.01 if q else 0.05
    S.cycles.use_denoising = True
    S.cycles.max_bounces = 16
    S.cycles.transmission_bounces = 14
    S.cycles.glossy_bounces = 8
    S.cycles.transparent_max_bounces = 16
    S.cycles.caustics_reflective = False
    S.cycles.caustics_refractive = False
    S.cycles.blur_glossy = 1.0
    S.render.film_transparent = transparent
    S.view_settings.view_transform = "AgX"
    S.view_settings.exposure = -0.7 if A.cut == "6" else 0.0  # 컷 6은 햇빛을 더해 밝아진 만큼 낮춘다
    S.render.image_settings.file_format = "PNG"
    S.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    if A.device == "GPU":
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "OPTIX"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == "OPTIX"
        S.cycles.device = "GPU"
    else:
        S.cycles.device = "CPU"


def main():
    os.makedirs(A.out, exist_ok=True)
    build_bottle()
    hero, (tmat, prog) = build_drops()
    if A.cut in ("2", "alt"):
        # 10-18 Fable 재검수: 회색 스튜디오처럼 보였다 → 컷 3처럼 살짝 내려다봐(약 11°) 뒤로 대리석 면이 보이고,
        # 그 위로 흐린 벽·화분(배경판)이 들어오게. 카메라가 오른쪽 뒤를 보므로 배경판도 오른쪽으로
        build_room(plate=(0.10, 0.6))
        P, N = surface_at(DROP_ANG, 86)
        tgt = Vector((P.x * 0.6, P.y * 0.6, 0.096))
        a = math.radians(-100)
        pos = Vector((0.30 * math.cos(a), 0.30 * math.sin(a), 0.155))
        camera(100, pos, tgt, fstop=11.0, focus=hero)  # f/5.6은 심도 3mm라 라벨 글자까지 흐렸다
        setup_render()
    elif A.cut == "6":
        # 커튼은 따로 판을 세우면 흰 기둥처럼 보여(10-18 첫 미리보기) 배경 사진 속 커튼 주름을 흔든다.
        # 배경판 폭 0.5m: 카메라가 보는 폭(약 0.35m)에 왼쪽 커튼 창과 오른쪽 화분이 함께 들어온다
        build_room(sway=True, plate=(0.0, 0.5))
        build_leaf_shadow()
        # 컷 6은 컷 2보다 8초 뒤: 물방울은 다 흘러내린 자리에 멈춰 있고 젖은 자국도 다 그어져 있다
        S.frame_set(48)
        final = prog.outputs[0].default_value
        hero.animation_data_clear()
        tmat.node_tree.animation_data_clear()
        prog.outputs[0].default_value = final
        # 살짝 내려다봐(약 6°) 세면대 윗면이 뒤로 이어지고 앞 끝 두께가 화면에 들어오지 않게(진열대처럼 보였다)
        cam = camera(100, Vector((0, -0.75, 0.155)), Vector((0, 0, 0.075)), fstop=8.0, focus=0.73)
        for f, d in ((1, 0.75), (48, 0.72)):
            cam.location = Vector((0, -d, 0.155))
            cam.data.dof.focus_distance = d - 0.02
            cam.keyframe_insert("location", frame=f)
            cam.data.dof.keyframe_insert("focus_distance", frame=f)
        for fc in (cam.animation_data.action.fcurves if cam.animation_data and cam.animation_data.action and hasattr(cam.animation_data.action, "fcurves") else []):
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"
                kp.easing = "EASE_IN_OUT"
        setup_render()
    else:  # 7 팩샷
        build_room(with_counter=False, with_back=False)
        camera(65, Vector((0, -0.42, 0.078)), Vector((0, 0, 0.070)))
        setup_render(transparent=True)
    if A.save:
        bpy.ops.wm.save_as_mainfile(filepath=A.save)
    frames = []
    if A.frames:
        for part in A.frames.split(","):
            if "-" in part:
                x, y = part.split("-")
                frames += list(range(int(x), int(y) + 1))
            else:
                frames.append(int(part))
    else:
        frames = list(range(S.frame_start, S.frame_end + 1))
    tag = {"2": "컷2", "6": "컷6", "7": "컷7팩샷", "alt": f"컷2_{BRAND}"}[A.cut]
    for f in frames:
        S.frame_set(f)
        S.render.filepath = os.path.join(A.out, f"{tag}_{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", S.render.filepath, flush=True)


main()

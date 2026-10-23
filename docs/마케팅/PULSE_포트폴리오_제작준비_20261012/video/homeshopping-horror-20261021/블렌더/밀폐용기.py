# 「매진 임박」 2안 제품 · 가상 브랜드 「꽉 KKWAK」 진공 밀폐 용기 회전판 알파 렌더(2026-10-22, 크레딧 0).
# 유호님 「1안 2안 둘 다 띄워줘볼래 ?」 — 2안 후보 가운데 브리프가 권한 진공 밀폐 용기 세트. 제품은 AI로 그리지 않고 블렌더로 짓는다.
# 용기 셋(대 · 중 · 소)을 쌓은 탑(stack)과 뚜껑 하나(lid, 셋째 끼어들기 「뚜껑만 1개」)를 흰 회전 받침에 올려 돌린다.
# 빛 · 카메라 · 렌더 설정 도우미는 1안 병 장면(../../jiyu-skincare-20261018/v7/블렌더/병A2_장면.py)의 것을 그대로 빌린다(돌림판.py와 같은 길).
#   python -X utf8 꽉_라벨.py   (먼저 한 번 — 뚜껑 인쇄 · 앞면 라벨 PNG)
#   blender -b --python 밀폐용기.py -- --what stack|lid --out <폴더> [--frames 1-96] [--quality preview|mid|final]
#   → <폴더>/<what>_0001.png … (RGBA 1080², −45°→+45°, 96장 = 4초 · 가운데 48~49장에서 정면)
# 콘티 v3(10-22 반응 조사, 03_콘티_v3.md)에서 더한 둘 — 회전 받침 없이:
#   --what latch  → latch_0001~0024.png(RGBA 1920×1080, 1초): 앞 잠금 날개가 9~11장에 「꽉」 내려가고 12~15장에 진공 단추가 들어간다(H2b 접사)
#   --what horror → horror_0001.png(RGB 1920×1080 한 장): 붉은 빛과 촛불빛 속 어두운 탁자 위 용기 하나(C09b — 홈쇼핑이 공포 화면에 먼저 새어 든다)
import math
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


WHAT = arg("--what", "stack")
OUT = arg("--out", ".")
FRAMES = arg("--frames", "1-96")
QUALITY = arg("--quality", "mid")
REFL = float(arg("--refl", "3"))   # 유리 가장자리에 비치는 세계 밝기(0이면 끔, 10-22 시험 0 · 3 중 3) — bright_reflections
GLASS = arg("--glass", "fake")     # fake: 합성용 가짜 유리(기본) · real: 굴절 유리(10-22 첫 렌더) — mat_clear
N_FR, A0, A1 = 96, -45.0, 45.0
HERE = os.path.dirname(os.path.abspath(__file__))
SCENE = os.path.normpath(os.path.join(HERE, "..", "..", "jiyu-skincare-20261018", "v7", "블렌더", "병A2_장면.py"))
if not os.path.exists(SCENE):   # 1안 병 장면이 아직 이 작업본에 없으면 공용 작업본 것을 읽는다
    SCENE = os.path.join(os.environ["USERPROFILE"], "Documents", "SYNK-appsscript", "docs", "마케팅", "PULSE_포트폴리오_제작준비_20261012",
                         "video", "jiyu-skincare-20261018", "v7", "블렌더", "병A2_장면.py")
DECAL = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021", "블렌더", "2안", "꽉_뚜껑판.png")
LABEL = os.path.join(os.path.dirname(DECAL), "꽉_앞라벨.png")   # 용기 앞면 스티커(흰 바탕 · 민트 글자)

src = open(SCENE, encoding="utf-8").read().rstrip()
assert src.endswith("main()"), "병A2_장면.py 끝이 main()이 아니다"
sys.argv = [sys.argv[0], "--", "--cut", "look", "--quality", QUALITY, "--out", OUT]
G = {"__name__": "a2_scene", "__file__": SCENE}
exec(compile(src[: -len("main()")], SCENE, "exec"), G)
S = G["S"]

DISC_R, DISC_H = 0.135, 0.022
SIZES = {"L": (0.200, 0.140, 0.080), "M": (0.170, 0.118, 0.066), "S": (0.140, 0.098, 0.054)}   # 바깥 가로 · 세로 · 높이(m)
LID_T = 0.014
MINT, MINT_DARK, WHITE = (0.30, 0.72, 0.62), (0.22, 0.42, 0.38), (0.93, 0.94, 0.94)


def mat_plastic(name, rgb, rough=0.35, coat=0.3):
    m, n, l, out = G["new_mat"](name)
    b = G["bsdf"](n, base=rgb, rough=rough, coat=coat, coat_rough=0.2)
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def mat_clear():
    """맑은 플라스틱(트라이탄 느낌). GLASS=real은 굴절 유리(투과 1)인데, 얇은 벽 안에 빛이 갇혀 옆벽에 검은 띠가 생기고
    알파가 불투명해져 홈쇼핑 바탕이 비치지 않았다(10-22 H2). fake(기본)는 합성용 가짜 유리 — 살짝 푸른 회색 투명 +
    가장자리로 갈수록 반사(프레넬)라 바탕이 그대로 비치고 가장자리만 밝게 빛난다."""
    m, n, l, out = G["new_mat"]("용기_맑은플라스틱")
    if GLASS == "real":
        b = G["bsdf"](n, base=(0.97, 0.99, 1.0), rough=0.04, ior=1.49, trans=1.0)
        l.new(b.outputs[0], out.inputs["Surface"])
        return m
    tr = n.new("ShaderNodeBsdfTransparent")
    # 면마다 곱해진다(벽 하나 = 면 둘). 0.95 · 0.97 · 0.98로 옅게 하면 벽이 거의 사라져 뚜껑만 떠 보였다(10-22 시험)
    tr.inputs["Color"].default_value = (0.90, 0.94, 0.96, 1)
    try:
        gl = n.new("ShaderNodeBsdfGlossy")
    except RuntimeError:   # 4.0부터 반사 노드 이름이 바뀐 판
        gl = n.new("ShaderNodeBsdfAnisotropic")
    gl.inputs["Roughness"].default_value = 0.05
    # 반사 비율은 「바라보는 각」(1 − |N·I|)의 세제곱 — 프레넬 출력은 안쪽 면(뒷면)에서 전반사로 1이 되어 벽이 거울처럼 막혔다
    lw = n.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    pw = n.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 3.0
    l.new(lw.outputs["Facing"], pw.inputs[0])
    k = n.new("ShaderNodeMath")
    k.operation = "MULTIPLY"
    k.inputs[1].default_value = 0.85
    l.new(pw.outputs[0], k.inputs[0])
    # 바닥 같은 수평 면은 반사 없이 투명으로 — 낮은 카메라(12°)에선 바닥이 비스듬해 반사가 0.4쯤 섞여
    # 맨 아래 용기 속 바닥이 회청색 판으로 보였다(10-22 Fable P2). 탑은 Z축으로만 돌아 법선 Z가 그대로다
    geo = n.new("ShaderNodeNewGeometry")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(geo.outputs["Normal"], sep.inputs[0])
    upright = G["math_node"](n, l, "LESS_THAN", G["math_node"](n, l, "ABSOLUTE", sep.outputs["Z"]), 0.7)
    mix = n.new("ShaderNodeMixShader")
    l.new(G["math_node"](n, l, "MULTIPLY", k.outputs[0], upright), mix.inputs["Fac"])
    l.new(tr.outputs[0], mix.inputs[1])
    l.new(gl.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs["Surface"])
    return m


def mat_decal(path=None, name="뚜껑_인쇄"):
    """인쇄 · 스티커(PNG의 알파만큼 그림, 나머지는 투명). 스티커는 그림 색 그대로.
    잉크 · 스티커는 무광(반사 0 · 거칠기 0.9) — 위를 향한 뚜껑 인쇄가 밝은 반사 세계를 비춰 흰 뚜껑과 밝기 차가
    12/255뿐이라 「꽉」이 바랬다(10-22 Fable P2). 인쇄 잉크도 더 진한 민트로."""
    m, n, l, out = G["new_mat"](name)
    tex = n.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(path or DECAL)
    b = G["bsdf"](n, base=(0.03, 0.16, 0.14), rough=0.9, spec=0.0)
    if path:
        l.new(tex.outputs["Color"], b.inputs["Base Color"])
    tr = n.new("ShaderNodeBsdfTransparent")
    mix = n.new("ShaderNodeMixShader")
    l.new(tex.outputs["Alpha"], mix.inputs["Fac"])
    l.new(tr.outputs[0], mix.inputs[1])
    l.new(b.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs["Surface"])
    try:
        m.blend_method = "HASHED"
    except Exception:
        pass
    return m


def rounded_box(name, size, loc, mat, bevel, open_top=False, wall=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if open_top:   # 윗면을 지워 그릇으로
        me = ob.data
        top = [p.index for p in me.polygons if p.normal.z > 0.9]
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="DESELECT")
        bpy.ops.object.mode_set(mode="OBJECT")
        for i in top:
            me.polygons[i].select = True
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.delete(type="FACE")
        bpy.ops.object.mode_set(mode="OBJECT")
    md = ob.modifiers.new("모서리", "BEVEL")
    md.width = bevel
    md.segments = 8
    md.limit_method = "ANGLE"
    if open_top and wall:
        so = ob.modifiers.new("벽", "SOLIDIFY")
        so.thickness = wall
        so.offset = -1.0
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def container(key, z0, parent, mats, food=None, top_print=True):
    w, d, h = SIZES[key]
    box = rounded_box(f"용기_{key}", (w, d, h), (0, 0, z0 + h / 2), mats["clear"], 0.012, open_top=True, wall=0.0025)
    lid_z = z0 + h + LID_T / 2 - 0.001
    lid = rounded_box(f"뚜껑_{key}", (w + 0.006, d + 0.006, LID_T), (0, 0, lid_z), mats["white"], 0.006)
    # 네 면의 잠금 날개(민트)
    for i, (x, y, sx, sy) in enumerate(((0, d / 2 + 0.005, 0.046, 0.006), (0, -d / 2 - 0.005, 0.046, 0.006),
                                         (w / 2 + 0.005, 0, 0.006, 0.040), (-w / 2 - 0.005, 0, 0.006, 0.040))):
        rounded_box(f"날개_{key}_{i}", (sx, sy, 0.024), (x, y, z0 + h - 0.004), mats["mint"], 0.0025).parent = parent
    # 가운데 진공 단추(실리콘)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.016 * w / 0.2, depth=0.007, location=(0, 0, z0 + h + LID_T + 0.0025))
    btn = bpy.context.active_object
    btn.name = f"진공단추_{key}"
    btn.data.materials.append(mats["button"])
    md = btn.modifiers.new("모서리", "BEVEL")
    md.width = 0.002
    md.segments = 4
    for p in btn.data.polygons:
        p.use_smooth = True
    # 윗면 인쇄(뚜껑보다 0.3mm 위)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0, z0 + h + LID_T - 0.001 + 0.0003))
    dec = bpy.context.active_object
    dec.name = f"인쇄_{key}"
    dec.scale = ((w + 0.006) * 0.9, (d + 0.006) * 0.9, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    dec.data.materials.append(mats["decal"])
    # 아래 용기 뚜껑 인쇄는 위 용기의 맑은 바닥 너머로 비쳐 어수선해서(인쇄를 진하게 한 뒤) 맨 위 뚜껑에만 둔다
    dec.hide_render = not top_print
    # 맑은 벽 · 뚜껑이 빛을 막으면(커스틱 없음) 안의 음식이 거무스름해진다(10-22 시험) — 그림자를 드리우지 않게
    for ob in (box, lid, dec):
        ob.visible_shadow = False
    # 앞면 스티커 라벨(정면에서 브랜드가 읽히게)
    lw = w * 0.42
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, -d / 2 - 0.0012, z0 + h * 0.5), rotation=(math.radians(90), 0, 0))
    lab = bpy.context.active_object
    lab.name = f"라벨_{key}"
    lab.scale = (lw, lw * 380 / 900, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    lab.data.materials.append(mats["label"])
    lab.visible_shadow = False
    for ob in (box, lid, btn, dec, lab):
        ob.parent = parent
    if food:
        food(z0, w, d, parent, mats)
    return z0 + h + LID_T


def tomatoes(z0, w, d, parent, mats):
    import random
    rnd = random.Random(7)
    for i in range(7):
        x, y = rnd.uniform(-w / 2 + 0.03, w / 2 - 0.03), rnd.uniform(-d / 2 + 0.03, d / 2 - 0.03)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.017, location=(x, y, z0 + 0.0045 + 0.017))
        t = bpy.context.active_object
        t.scale = (1, 1, 0.9)
        t.data.materials.append(mats["tomato"])
        for p in t.data.polygons:
            p.use_smooth = True
        t.parent = parent


def carrots(z0, w, d, parent, mats):
    for i in range(5):
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.0085, depth=w * 0.7, location=(0, -d / 2 + 0.02 + i * 0.019, z0 + 0.0045 + 0.0085),
                                            rotation=(0, math.radians(90), 0))
        c = bpy.context.active_object
        c.data.materials.append(mats["carrot"])
        for p in c.data.polygons:
            p.use_smooth = True
        c.parent = parent


def blueberries(z0, w, d, parent, mats):
    import random
    rnd = random.Random(3)
    for i in range(16):
        x, y = rnd.uniform(-w / 2 + 0.02, w / 2 - 0.02), rnd.uniform(-d / 2 + 0.02, d / 2 - 0.02)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0075, location=(x, y, z0 + 0.0045 + 0.0075))
        b = bpy.context.active_object
        b.data.materials.append(mats["berry"])
        for p in b.data.polygons:
            p.use_smooth = True
        b.parent = parent


def pedestal():
    disc = rounded_box("받침", (DISC_R * 2, DISC_R * 2, DISC_H), (0, 0, DISC_H / 2), mat_plastic("받침_흰광택", (0.86, 0.86, 0.86), 0.22, 1.0), 0.003)
    # 상자를 원판으로: 실린더로 다시
    bpy.data.objects.remove(disc)
    bpy.ops.mesh.primitive_cylinder_add(vertices=256, radius=DISC_R, depth=DISC_H, location=(0, 0, DISC_H / 2))
    disc = bpy.context.active_object
    disc.name = "받침"
    md = disc.modifiers.new("모서리", "BEVEL")
    md.width = 0.003
    md.segments = 6
    disc.data.materials.append(mat_plastic("받침_흰광택2", (0.86, 0.86, 0.86), 0.22, 1.0))
    for p in disc.data.polygons:
        p.use_smooth = True
    bpy.ops.mesh.primitive_plane_add(size=1.6, location=(0, 0, 0))
    catcher = bpy.context.active_object
    catcher.is_shadow_catcher = True
    catcher.visible_glossy = False   # 용기 아래 가장자리에 회색 바닥판이 비치지 않게 — 반사에는 세계 · 반사판만


def lights():
    area = G["area"]
    warm, cool = (1.0, 0.96, 0.92), (0.95, 0.97, 1.0)
    area("키_왼쪽", 0.9, (-0.75, -0.85, 0.6), (0, 0, 0.13), 150.0, warm, size_y=1.1)
    area("채움_오른쪽", 0.9, (0.8, -0.8, 0.55), (0, 0, 0.13), 110.0, cool, size_y=1.1)
    area("위", 0.8, (0.0, -0.15, 1.0), (0, 0, 0.12), 120.0, (1, 1, 1))
    for nm, x in (("뒤띠_왼쪽", -0.45), ("뒤띠_오른쪽", 0.45)):
        area(nm, 0.05, (x, 0.35, 0.22), (0, 0, 0.13), 30.0, (1, 0.98, 0.95), size_y=0.7)
    for c in (G["card"]("반사판_왼쪽", (0.7, 0.8), (-0.6, -0.42, 0.22), (0, 0, 0.13), 0.9),
              G["card"]("반사판_오른쪽", (0.7, 0.8), (0.6, -0.42, 0.22), (0, 0, 0.13), 0.7)):
        c.visible_diffuse = False
    G["world"](0.35, (0.92, 0.93, 0.95))
    if REFL > 0:
        bright_reflections(REFL)


def bright_reflections(strength):
    """유리에 비치는 세계만 밝게(빛 경로 노드) — 어두운 세계(0.35 · 노출 −2.2)가 맑은 용기 벽에 검은 얼룩으로 비쳤다(10-22 H2).
    퍼짐 광선(바닥 · 음식 · 뚜껑을 밝히는 빛)은 그대로 두어 색이 날아가지 않게 한다."""
    nt = S.world.node_tree
    bg = [x for x in nt.nodes if x.type == "BACKGROUND"][0]
    out = [x for x in nt.nodes if x.type == "OUTPUT_WORLD"][0]
    bright = nt.nodes.new("ShaderNodeBackground")
    bright.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1)
    bright.inputs["Strength"].default_value = strength
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Diffuse Ray"], mix.inputs["Fac"])
    nt.links.new(bright.outputs[0], mix.inputs[1])   # 퍼짐이 아닌 광선(반사 · 투과)은 밝은 세계
    nt.links.new(bg.outputs[0], mix.inputs[2])       # 퍼짐 광선은 원래 세계
    nt.links.new(mix.outputs[0], out.inputs["Surface"])


def horror_lights():
    """C09b: 거실 공포 컷과 같은 빛 — 왼쪽 붉은 키, 앞 아래 촛불빛, 아주 어두운 세계"""
    area = G["area"]
    # 첫 시험(키 90 · 촛불 6 · 노출 -1.0)은 탁자까지 주황으로 밝아 공포 컷과 따로 놀았다 — 줄이고 어둡게
    area("붉은_키", 0.3, (-0.6, 0.12, 0.28), (0, 0, 0.05), 45.0, (1.0, 0.10, 0.07), size_y=0.3)   # 옆뒤에서 — 앞면은 촛불빛만, 나머지는 그늘
    bpy.ops.object.light_add(type="POINT", location=(0.12, -0.32, 0.03))
    candle = bpy.context.active_object
    candle.data.energy = 2.5
    candle.data.color = (1.0, 0.62, 0.30)
    candle.data.shadow_soft_size = 0.02
    area("뒤_테두리", 0.2, (0.25, 0.45, 0.3), (0, 0, 0.05), 25.0, (1.0, 0.35, 0.25))
    G["world"](0.02, (0.25, 0.06, 0.05))


def latch_only(root, mats):
    """앞 잠금 날개를 위 가장자리 경첩에 걸어 연 자리(-105°)에서 닫힌 자리(0°)로, 그 뒤 진공 단추를 누른다. 날개 · 단추를 돌려준다"""
    w, d, h = SIZES["M"]
    container("M", 0.0, root, mats, carrots)
    flap = bpy.data.objects["날개_M_1"]   # 앞면(-y) 날개
    hinge = G["link"](bpy.data.objects.new("앞날개_경첩", None))
    hinge.location = (0, -d / 2 - 0.005, h + 0.008)
    hinge.parent = root
    bpy.context.view_layer.update()
    mw = flap.matrix_world.copy()
    flap.parent = hinge
    flap.matrix_world = mw
    return hinge, bpy.data.objects["진공단추_M"], h


def main():
    os.makedirs(OUT, exist_ok=True)
    mats = {"clear": mat_clear(), "white": mat_plastic("뚜껑_흰", WHITE, 0.3, 0.4), "mint": mat_plastic("날개_민트", MINT, 0.35, 0.3),
            "button": mat_plastic("단추_실리콘", MINT_DARK, 0.6, 0.0), "decal": mat_decal(), "label": mat_decal(LABEL, "앞라벨"),
            "tomato": mat_plastic("방울토마토", (0.75, 0.05, 0.03), 0.18, 0.6), "carrot": mat_plastic("당근", (0.85, 0.28, 0.02), 0.45, 0.1),   # 0.95 · 0.42 · 0.06은 살구색 막대로 보였다(Fable P3)
            "berry": mat_plastic("블루베리", (0.10, 0.12, 0.30), 0.35, 0.2)}
    if WHAT in ("latch", "horror"):
        return main_v3(mats)
    pedestal()
    root = G["link"](bpy.data.objects.new("용기_묶음", None))
    if WHAT == "stack":
        z = DISC_H + 0.0008   # 받침 윗면과 용기 바닥이 같은 높이면 면이 겹쳐 바닥 너머가 군데군데 뚫린다(10-22 Fable P2 회청색 판)
        z = container("L", z, root, mats, tomatoes, top_print=False)
        z = container("M", z, root, mats, carrots, top_print=False)
        container("S", z, root, mats, blueberries)
        tz, elev, dist = 0.135, 12.0, 1.12
    else:   # 뚜껑 하나만(셋째 끼어들기 「뚜껑만 1개」) — 같은 크기 받침 위에 작게
        w, d, _ = SIZES["M"]
        holder = G["link"](bpy.data.objects.new("뚜껑_묶음", None))
        holder.parent = root
        # 뚜껑 하나만 남기려고 용기 높이를 0으로 둔 셈 — 그릇은 짓지 않고 뚜껑 · 날개 · 단추 · 인쇄만
        lid = rounded_box("뚜껑_하나", (w + 0.006, d + 0.006, LID_T), (0, 0, DISC_H + LID_T / 2), mats["white"], 0.006)
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.016 * w / 0.2, depth=0.007, location=(0, 0, DISC_H + LID_T + 0.0025))
        btn = bpy.context.active_object
        btn.data.materials.append(mats["button"])
        bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0, DISC_H + LID_T + 0.0003))
        dec = bpy.context.active_object
        dec.scale = ((w + 0.006) * 0.9, (d + 0.006) * 0.9, 1)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        dec.data.materials.append(mats["decal"])
        for i, (x, y, sx, sy) in enumerate(((0, d / 2 + 0.005, 0.046, 0.006), (0, -d / 2 - 0.005, 0.046, 0.006),
                                             (w / 2 + 0.005, 0, 0.006, 0.040), (-w / 2 - 0.005, 0, 0.006, 0.040))):
            rounded_box(f"날개_{i}", (sx, sy, 0.024), (x, y, DISC_H + 0.004), mats["mint"], 0.0025).parent = holder
        for ob in (lid, btn, dec):
            ob.parent = holder
        tz, elev, dist = 0.03, 26.0, 0.95   # 받침 크기는 탑과 같고 가운데에 — 큰 받침 위 뚜껑 하나가 작게 보인다
    lights()
    ang = math.radians(elev)
    G["camera"](85, (0, -dist * math.cos(ang), tz + dist * math.sin(ang)), (0, 0, tz), res=(1080, 1080))
    G["setup_render"]()
    S.render.film_transparent = True
    S.cycles.film_transparent_glass = True
    S.cycles.film_transparent_roughness = 0.1
    S.render.image_settings.color_mode = "RGBA"
    S.view_settings.exposure = -2.2   # -0.6 · -1.25는 흰 뚜껑 · 음식 색이 날아갔다(10-22 시험)
    if QUALITY == "mid":
        S.cycles.samples = 224
    fr = []
    for part in FRAMES.split(","):
        a, _, b = part.partition("-")
        fr += list(range(int(a), int(b or a) + 1))
    for f in fr:
        root.rotation_euler.z = math.radians(A0 + (A1 - A0) * (f - 1) / (N_FR - 1))
        S.frame_set(f)
        S.render.filepath = os.path.join(OUT, f"{WHAT}_{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", S.render.filepath, flush=True)


def main_v3(mats):
    root = G["link"](bpy.data.objects.new("용기_묶음", None))
    w, d, h = SIZES["M"]
    if WHAT == "latch":
        hinge, btn, top = latch_only(root, mats)
        lights()
        # 앞 오른쪽 위에서 날개 · 뚜껑 앞 가장자리 · 진공 단추가 한 화면에 — 100mm 접사(가로 약 12cm)
        tgt = (0.0, -0.035, top + 0.004)
        ang, az, dist = math.radians(24), math.radians(-22), 0.34
        G["camera"](100, (tgt[0] + dist * math.cos(ang) * math.sin(-az), tgt[1] - dist * math.cos(ang) * math.cos(az), tgt[2] + dist * math.sin(ang)), tgt, res=(1920, 1080))
        G["setup_render"]()
        S.render.film_transparent = True
        S.cycles.film_transparent_glass = True
        S.cycles.film_transparent_roughness = 0.1
        S.render.image_settings.color_mode = "RGBA"
        S.view_settings.exposure = -2.2
    else:   # horror — 어두운 나무 탁자 위 용기 하나, 공포 컷 빛
        container("M", 0.0008, root, mats, carrots)
        bpy.ops.mesh.primitive_plane_add(size=3.0, location=(0, 0, 0))
        table = bpy.context.active_object
        table.data.materials.append(mat_plastic("어두운_탁자", (0.012, 0.006, 0.004), 0.75, 0.0))
        horror_lights()
        tgt = (0.0, 0.0, h * 0.5)
        ang, dist = math.radians(12), 0.62   # 0.95는 용기가 화면의 5분의 1로 작았다 — 접사답게 가까이
        G["camera"](85, (0.03, -dist * math.cos(ang), tgt[2] + dist * math.sin(ang)), tgt, res=(1920, 1080))
        G["setup_render"]()
        S.render.film_transparent = False
        S.render.image_settings.color_mode = "RGB"
        S.view_settings.exposure = -2.4
    if QUALITY == "mid":
        S.cycles.samples = 224
    fr = []
    for part in (FRAMES if WHAT == "latch" else "1").split(","):
        a, _, b = part.partition("-")
        fr += list(range(int(a), int(b or a) + 1))
    for f in fr:
        if WHAT == "latch":
            # 1~8장 열린 채(-105°) → 9~11장 「꽉」 닫힘(가속) → 12장 살짝 튐 → 13장부터 닫힌 채. 단추는 12~15장에 3mm 들어간다
            if f <= 8:
                a_deg = -105.0
            elif f <= 11:
                k = (f - 8) / 3
                a_deg = -105.0 * (1 - k * k)
            elif f == 12:
                a_deg = -6.0
            else:
                a_deg = 0.0
            hinge.rotation_euler.x = math.radians(a_deg)   # X축 -105°면 날개 아래 끝이 바깥(-y) · 위로 젖혀진다 → 0°에서 벽에 붙는다
            p = min(1.0, max(0.0, (f - 11) / 4))
            btn.scale.z = 1.0 - 0.45 * p
            btn.location.z = top + LID_T + 0.0025 - 0.003 * p
        S.frame_set(f)
        S.render.filepath = os.path.join(OUT, f"{WHAT}_{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", S.render.filepath, flush=True)


main()

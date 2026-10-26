# 2번 · 남성 향수(가칭 솔서리 SOLSEORI) — 블렌더 제품 장면 1판 (2026-10-26, 크레딧 0)
# 병 · 뚜껑 · 얼음 · 「ㅅ」 얼음 조각은 AI로 그리지 않고 여기서 짓는다(AI 광고영상 제작 규칙 원칙 · 경로 B).
# 인쇄 · 각인 원고는 ../라벨/라벨.py가 만든 우리 원고. 원본(YSL Y Iced Cologne) 컷의 카메라 자리 · 크기 · 빛을 옮긴다(01_샷표_원본.md).
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python 솔서리병.py -- --shot s18 [--res 960x540] [--samples 64] [--t 0]
#   → <밖>/렌더/<shot>[_t<t>].png   (<밖> = Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p2)
# shot: look(병 3/4 · 디자인 확인) · s02(얼음에 박힌 라벨 아주 가까이) · s03(얼음 덩이 속 병) · s06(「ㅅ」 얼음 갈라진 자리) ·
#       s09(물에 잠긴 뚜껑 · 위에서) · s10(「ㅅ」 얼음 조각 · 속에 솔가지) · s17(기운 병 몸통 · 뒤 밝은 빛) · s18(병을 크게 · 빛 띠)
# --t: 그 컷 안의 진행(0 = 첫 프레임 · 1 = 끝 프레임) — 원본의 카메라 움직임(18번 0.53배 물러남 등)을 같은 비율로.
# 단위 m. 병 46 × 30 × 88 mm · 벽 6 mm · 바닥 13 mm · 뚜껑 24 × 24 × 26 mm(솔잎 「ㅅ」 음각).
import json
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


SHOT = arg("--shot", "look")
RES = tuple(int(v) for v in arg("--res", "960x540").split("x"))
SAMPLES = int(arg("--samples", "64"))
T = float(arg("--t", "0"))
LIGHT = float(arg("--light", "0.22"))   # 모든 면광 세기에 곱한다(2판: 작은 병에 40~90W는 하얗게 날았다)
EXPO = float(arg("--expo", "0"))
밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p2")
라벨 = os.path.join(밖, "라벨")
# 원본 카메라 곡선(../원본카메라_재기.py가 git 밖에 쓴 것) — 컷마다 프레임별 화면 배율 · 이동(화면 폭 %) · 회전
CURVES = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "레퍼런스", "p2",
                      "원본실측", "YSL아이스_yi_Fjg4OLJA", "카메라_프레임.json")
OUT = arg("--out", os.path.join(밖, "렌더", f"{SHOT}{f'_t{T:.2f}' if T > 0 else ''}.png"))

BW, BD, BH = 0.046, 0.030, 0.088     # 병 몸통
WALL, BASE = 0.006, 0.013
CAP = (0.024, 0.024, 0.026)
NECK_R, NECK_H = 0.0075, 0.005
COBALT_DEEP = (0.004, 0.018, 0.080)
COBALT = (0.020, 0.090, 0.330)
ICE_BLUE = (0.62, 0.80, 1.00)


# ── 장면 · 렌더 ─────────────────────────────────────────────────────────────
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            ok = False
            for d in prefs.devices:
                d.use = d.type == kind
                ok = ok or d.use
            if ok:
                break
        except Exception:
            continue
    sc.cycles.device = "GPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPTIX"
    except Exception:
        pass
    sc.cycles.max_bounces = 24
    sc.cycles.transmission_bounces = 24
    sc.cycles.glossy_bounces = 8
    sc.cycles.transparent_max_bounces = 16
    sc.cycles.volume_bounces = 2
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 0.5
    sc.render.resolution_x, sc.render.resolution_y = RES
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    # 3판: AgX는 밝은 파랑을 흰빛으로 빼 원본의 진한 코발트가 안 나왔다(면광을 꺼도 회청색) — Standard로
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.exposure = EXPO
    try:
        sc.view_settings.look = "None"
    except Exception:
        pass
    world = bpy.data.worlds.new("world")
    sc.world = world
    world.use_nodes = True
    return sc


def world_gradient(low, high, strength=1.0, lo=-0.3, hi=0.8):
    nt = bpy.context.scene.world.node_tree
    bg = nt.nodes.get("Background")
    co = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(co.outputs["Generated"], sep.inputs["Vector"])
    mp = nt.nodes.new("ShaderNodeMapRange")
    mp.inputs["From Min"].default_value = lo
    mp.inputs["From Max"].default_value = hi
    nt.links.new(sep.outputs["Z"], mp.inputs["Value"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*low, 1)
    ramp.color_ramp.elements[1].color = (*high, 1)
    nt.links.new(mp.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength


def camera(loc, target, lens=85.0, fstop=None, focus=None, roll=0.0):
    cd = bpy.data.cameras.new("cam")
    cd.lens = lens
    cd.sensor_fit = "HORIZONTAL"
    cd.sensor_width = 36.0
    cd.clip_start = 0.002
    cd.clip_end = 60
    cam = bpy.data.objects.new("cam", cd)
    bpy.context.collection.objects.link(cam)
    cam.location = Vector(loc)
    d = Vector(target) - Vector(loc)
    q = d.to_track_quat("-Z", "Y")
    cam.rotation_euler = q.to_euler()
    if roll:
        cam.rotation_euler.rotate_axis("Z", math.radians(roll))
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = focus if focus else d.length
    bpy.context.scene.camera = cam
    return cam


def orig_at(n, t):
    """원본 n번 컷의 진행 t(0~1) 자리 (화면 배율, 이동 x %, 이동 y %, 회전 °) — 첫 프레임 대비. 곡선이 없거나 잴 수 없던 컷은 움직이지 않음."""
    try:
        sh = json.load(open(CURVES, encoding="utf-8"))["shots"][n - 1]
    except (OSError, ValueError, IndexError):
        return 1.0, 0.0, 0.0, 0.0
    if sh.get("잴 수 없음"):
        return 1.0, 0.0, 0.0, 0.0
    out = []
    for key, base in (("배율_곡선", 1.0), ("x_곡선", 0.0), ("y_곡선", 0.0), ("회전_곡선", 0.0)):
        arr = [base] + sh[key]
        f = min(max(t, 0.0), 1.0) * (len(arr) - 1)
        i = int(f)
        u = f - i
        out.append(arr[i] if i + 1 >= len(arr) else arr[i] * (1 - u) + arr[i + 1] * u)
    return tuple(out)


def follow_camera(n, loc, target, lens=85.0, roll=0.0, **kw):
    """첫 프레임 카메라(loc → target)에서 원본 n번 컷의 카메라 곡선을 --t 자리까지 따라간다(10-26 밤 유호님 「카메라 기법도 완전히 똑같게」).
    화면 배율은 겨냥점 쪽으로 다가가거나 물러나는 것으로(거리 = 처음 거리 ÷ 배율), 화면 이동은 카메라를 반대쪽으로 옮겨서
    (카메라 오른쪽 · 위 축 — roll 180으로 뒤집어 찍은 컷은 반대), 회전은 roll에 더해서. 곡선의 빠르기 모양(고른 · 점점 느려짐 등)이 그대로 따라온다."""
    sc, dx, dy, rot = orig_at(n, T)
    loc, target = Vector(loc), Vector(target)
    f = target - loc
    d0 = f.length
    f.normalize()
    right = f.cross(Vector((0, 0, 1)))
    right.normalize()
    up = right.cross(f)
    flip = -1 if abs((roll % 360) - 180) < 1 else 1
    d = d0 / sc
    wf = d * 36 / lens
    tgt = target + right * (-dx / 100 * wf * flip) + up * (dy / 100 * wf * flip)
    return camera(tuple(tgt - f * d), tuple(tgt), lens=lens, roll=roll + rot, **kw)


def area_light(name, loc, target, energy, size, rgb=(1, 1, 1), size_y=None, spread=180):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy * LIGHT
    ld.color = rgb
    if size_y:
        ld.shape = "RECTANGLE"
        ld.size = size
        ld.size_y = size_y
    else:
        ld.shape = "DISK"
        ld.size = size
    ld.spread = math.radians(spread)
    ob = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(ob)
    ob.location = Vector(loc)
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    # 3판: 작은 면광이 카메라 · 얼음 너머로 그대로 보여 하얗게 탔다 — 비추기와 유리 테두리 반사로만 쓴다
    ob.visible_camera = False
    ob.visible_transmission = False
    return ob


# ── 재질 ────────────────────────────────────────────────────────────────────
def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt.nodes, nt.links, out


def setin(node, name, value):
    if name in node.inputs:
        node.inputs[name].default_value = value


NAMES = {"base": "Base Color", "metal": "Metallic", "rough": "Roughness", "ior": "IOR", "trans": "Transmission Weight",
         "coat": "Coat Weight", "aniso": "Anisotropic", "emit": "Emission Color", "emit_s": "Emission Strength"}


def principled(nodes, **kw):
    b = nodes.new("ShaderNodeBsdfPrincipled")
    for k, v in kw.items():
        if k in ("base", "emit") and len(v) == 3:
            v = (*v, 1)
        setin(b, NAMES[k], v)
    return b


def shadow_pass(n, l, shader_out):
    """굴절 물체가 그림자를 까맣게 드리우지 않게 그림자 광선에는 투명(1번 캔 · 기프트 세트 장면과 같은 처리)."""
    lp = n.new("ShaderNodeLightPath")
    tr = n.new("ShaderNodeBsdfTransparent")
    mix = n.new("ShaderNodeMixShader")
    l.new(lp.outputs["Is Shadow Ray"], mix.inputs["Fac"])
    l.new(shader_out, mix.inputs[1])
    l.new(tr.outputs[0], mix.inputs[2])
    return mix


def img(name, colorspace="Non-Color"):
    im = bpy.data.images.load(os.path.join(라벨, name), check_existing=True)
    im.colorspace_settings.name = colorspace
    return im


def _ma(n, l, src, scale, add):
    x = n.new("ShaderNodeMath")
    x.operation = "MULTIPLY_ADD"
    l.new(src, x.inputs[0])
    x.inputs[1].default_value = scale
    x.inputs[2].default_value = add
    return x.outputs[0]


def planar(n, l, image, u_of, v_of):
    """물체 좌표 두 축을 0~1로 펴서 그림을 붙인다 — u_of · v_of = (축, 최솟값, 최댓값)."""
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Object"], sep.inputs["Vector"])
    comb = n.new("ShaderNodeCombineXYZ")
    for ax, slot in ((u_of, "X"), (v_of, "Y")):
        a, lo, hi = ax
        l.new(_ma(n, l, sep.outputs[a], 1 / (hi - lo), -lo / (hi - lo)), comb.inputs[slot])
    tex = n.new("ShaderNodeTexImage")
    tex.image = image
    tex.extension = "CLIP"
    l.new(comb.outputs[0], tex.inputs["Vector"])
    return tex


def mat_glass_print():
    """두꺼운 맑은 유리 + 앞면 흰 잉크(병앞_흰잉크.png, 앞면 y < 0 쪽에만)."""
    m, n, l, out = new_mat("bottle_glass")
    glass = principled(n, base=(1, 1, 1), rough=0.0, ior=1.50, trans=1.0)
    ink = principled(n, base=(0.92, 0.94, 0.97), rough=0.45)
    tex = planar(n, l, img("병앞_흰잉크.png"), ("X", -BW / 2, BW / 2), ("Z", -BH / 2, BH / 2))  # 몸통 물체 좌표는 가운데가 원점
    # 바깥 앞면만 — 물체 좌표 y가 앞쪽 끝(-BD/2)에 붙은 자리. 1판은 법선으로 갈라 속 빈 곳의 안쪽 뒷벽에도 찍혀 여러 겹으로 비쳤다
    tcp = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tcp.outputs["Object"], sep.inputs["Vector"])
    front = n.new("ShaderNodeMath")
    front.operation = "LESS_THAN"
    l.new(sep.outputs["Y"], front.inputs[0])
    front.inputs[1].default_value = -(BD / 2 - 0.0004)
    mask = n.new("ShaderNodeMath")
    mask.operation = "MULTIPLY"
    l.new(tex.outputs["Color"], mask.inputs[0])
    l.new(front.outputs[0], mask.inputs[1])
    mix = n.new("ShaderNodeMixShader")
    l.new(mask.outputs[0], mix.inputs["Fac"])
    l.new(glass.outputs[0], mix.inputs[1])
    l.new(ink.outputs[0], mix.inputs[2])
    l.new(shadow_pass(n, l, mix.outputs[0]).outputs[0], out.inputs["Surface"])
    return m


def mat_print_decal():
    """앞면에 붙인 흰 잉크 판 — 잉크 자리만 불투명 흰색, 나머지는 완전히 투명(굴절 없음)."""
    m, n, l, out = new_mat("print")
    ink = principled(n, base=(0.92, 0.94, 0.97), rough=0.45)
    tr = n.new("ShaderNodeBsdfTransparent")
    tex = planar(n, l, img("병앞_흰잉크.png"), ("X", -(BW - 0.004) / 2, (BW - 0.004) / 2), ("Z", -(BH - 0.004) / 2, (BH - 0.004) / 2))
    mix = n.new("ShaderNodeMixShader")
    l.new(tex.outputs["Color"], mix.inputs["Fac"])
    l.new(tr.outputs[0], mix.inputs[1])
    l.new(ink.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs["Surface"])
    return m


def mat_glass_plain(name="glass_plain"):
    m, n, l, out = new_mat(name)
    b = principled(n, base=(1, 1, 1), rough=0.0, ior=1.50, trans=1.0)
    l.new(shadow_pass(n, l, b.outputs[0]).outputs[0], out.inputs["Surface"])
    return m


def mat_liquid():
    """옅은 얼음빛 파란 향수 — 표면은 굴절, 속은 아주 옅은 흡수."""
    m, n, l, out = new_mat("liquid")
    # 1판은 표면색이 옅은 파랑이라 우윳빛으로 탁했다 — 표면은 흰 유리, 색은 속 흡수로만
    b = principled(n, base=(1, 1, 1), rough=0.0, ior=1.36, trans=1.0)
    l.new(shadow_pass(n, l, b.outputs[0]).outputs[0], out.inputs["Surface"])
    va = n.new("ShaderNodeVolumeAbsorption")
    # 4판: 옅은 파랑은 코발트 바탕에 묻혔다 — 빙하 물빛(청록 쪽 파랑)으로 진하게. 원본의 남색과는 다른 색
    va.inputs["Color"].default_value = (0.22, 0.66, 0.85, 1)
    # 11판(Fable 이미지 콘티 1차 P1-4): 밀도 48은 바탕색을 그대로 비쳐 2 · 17번은 바탕과 같고 3 · 18번은 빈 병으로 보였다 —
    # 원본처럼 병 속이 바탕보다 어둡고 짙게(명도 0.35~0.45), 색상은 청록 쪽(200~210°)
    va.inputs["Density"].default_value = 150.0
    l.new(va.outputs[0], out.inputs["Volume"])
    return m


def mat_cap():
    """솔질한 은빛 금속 + 윗면 솔잎 「ㅅ」 음각(뚜껑_각인.png를 범프로)."""
    m, n, l, out = new_mat("cap")
    b = principled(n, base=(0.80, 0.82, 0.86), metal=1.0, rough=0.24, aniso=0.6)
    tex = planar(n, l, img("뚜껑_각인.png"), ("X", -CAP[0] / 2, CAP[0] / 2), ("Y", -CAP[1] / 2, CAP[1] / 2))
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.9
    bump.inputs["Distance"].default_value = 0.0004
    bump.invert = True
    # 윗면(법선이 위를 볼 때)에만 각인 — 옆면에 줄무늬가 번지지 않게
    geo = n.new("ShaderNodeNewGeometry")
    vt = n.new("ShaderNodeVectorTransform")
    vt.vector_type = "NORMAL"
    vt.convert_from = "WORLD"
    vt.convert_to = "OBJECT"
    l.new(geo.outputs["Normal"], vt.inputs["Vector"])
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(vt.outputs["Vector"], sep.inputs["Vector"])
    top = n.new("ShaderNodeMath")
    top.operation = "GREATER_THAN"
    l.new(sep.outputs["Z"], top.inputs[0])
    top.inputs[1].default_value = 0.8
    hmask = n.new("ShaderNodeMath")
    hmask.operation = "MULTIPLY"
    l.new(tex.outputs["Color"], hmask.inputs[0])
    l.new(top.outputs[0], hmask.inputs[1])
    l.new(hmask.outputs[0], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    # 음각 바닥은 조금 거칠게(빛이 들면 글자가 보이게)
    rmix = n.new("ShaderNodeMapRange")
    rmix.inputs["To Min"].default_value = 0.22
    rmix.inputs["To Max"].default_value = 0.55
    l.new(tex.outputs["Color"], rmix.inputs["Value"])
    l.new(rmix.outputs["Result"], b.inputs["Roughness"])
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def mat_ice(name="ice", frost=0.08):
    """얼음: 굴절 1.31, 녹은 표면 결(노이즈 범프), 군데군데 젖빛(거칠기 노이즈), 속은 아주 옅은 파랑."""
    m, n, l, out = new_mat(name)
    b = principled(n, base=(0.92, 0.96, 1.0), rough=0.02, ior=1.31, trans=1.0)
    tc = n.new("ShaderNodeTexCoord")
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 90.0
    nz.inputs["Detail"].default_value = 8.0
    nz.inputs["Roughness"].default_value = 0.62
    l.new(tc.outputs["Object"], nz.inputs["Vector"])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.0012
    l.new(nz.outputs["Fac"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    nz2 = n.new("ShaderNodeTexNoise")
    nz2.inputs["Scale"].default_value = 22.0
    nz2.inputs["Detail"].default_value = 4.0
    l.new(tc.outputs["Object"], nz2.inputs["Vector"])
    rm = n.new("ShaderNodeMapRange")
    rm.inputs["From Min"].default_value = 0.45
    rm.inputs["From Max"].default_value = 0.75
    rm.inputs["To Min"].default_value = 0.0
    rm.inputs["To Max"].default_value = frost
    l.new(nz2.outputs["Fac"], rm.inputs["Value"])
    l.new(rm.outputs["Result"], b.inputs["Roughness"])
    l.new(shadow_pass(n, l, b.outputs[0]).outputs[0], out.inputs["Surface"])
    va = n.new("ShaderNodeVolumeAbsorption")
    va.inputs["Color"].default_value = (0.55, 0.78, 1.0, 1)
    va.inputs["Density"].default_value = 6.0
    l.new(va.outputs[0], out.inputs["Volume"])
    return m


def mat_simple(name, **kw):
    m, n, l, out = new_mat(name)
    b = principled(n, **kw)
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def mat_emit(name, rgb, strength):
    m, n, l, out = new_mat(name)
    e = n.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*rgb, 1)
    e.inputs["Strength"].default_value = strength
    l.new(e.outputs[0], out.inputs["Surface"])
    return m


def mat_floor(rgb=(0.05, 0.12, 0.30), rough=0.18):
    """빛 띠를 길게 비추는 젖은 듯한 바닥."""
    return mat_simple("floor", base=rgb, rough=rough, coat=0.6)


# ── 모양 ────────────────────────────────────────────────────────────────────
def link(ob):
    bpy.context.collection.objects.link(ob)
    return ob


def rounded_box(name, sx, sy, sz, loc, mat, bevel=0.003, segs=5):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new(name, me))
    ob.location = loc
    if bevel > 0:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segs
        mod.limit_method = "NONE"
    if mat:
        ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def cylinder(name, r, h, loc, mat, segs=96):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=h)
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new(name, me))
    ob.location = loc
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    for mod in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def boolean(target, cutter, op="DIFFERENCE"):
    mod = target.modifiers.new("bool", "BOOLEAN")
    mod.operation = op
    mod.object = cutter
    mod.solver = "EXACT"
    apply_mods(target)
    bpy.data.objects.remove(cutter, do_unlink=True)


def bottle(loc=(0, 0, 0), rot_z=0.0, tilt=0.0, cap=True, print_through=False):
    """병 한 벌을 빈 물체 아래에 — 몸통 유리(속 빈 곳) · 향수 · 목 · 뚜껑."""
    root = link(bpy.data.objects.new("bottle_root", None))
    glass, liquid, capm = mat_glass_print(), mat_liquid(), mat_cap()
    body = rounded_box("body", BW, BD, BH, (0, 0, BH / 2), mat_glass_plain("bottle_glass"), bevel=0.0035)
    apply_mods(body)
    hole = rounded_box("hole", BW - 2 * WALL, BD - 2 * WALL, BH - BASE - WALL, (0, 0, BASE + (BH - BASE - WALL) / 2), None, bevel=0.003)
    apply_mods(hole)
    boolean(body, hole)
    liq_h = (BH - BASE - WALL) * 0.86
    liq = rounded_box("liquid", BW - 2 * WALL + 0.0002, BD - 2 * WALL + 0.0002, liq_h, (0, 0, BASE + liq_h / 2 - 0.0001), liquid, bevel=0.003)
    neck = cylinder("neck", NECK_R, NECK_H, (0, 0, BH + NECK_H / 2), mat_glass_plain())
    decal = rounded_box("print", BW - 0.004, 0.0001, BH - 0.004, (0, -BD / 2 - 0.0001, BH / 2), mat_print_decal(), bevel=0.0)
    # 7판: 인쇄 판이 두꺼운 유리 안에서 반사 · 투과로 한 번 더 비쳐 글자가 겹쳤다 — 카메라에 곧장 보이는 것만 남긴다.
    # 얼음 너머로 병을 보는 컷(03번)은 투과를 켜야 글자가 보인다(print_through)
    decal.visible_glossy = False
    decal.visible_transmission = print_through
    decal.visible_shadow = False
    parts = [body, liq, neck, decal]
    if cap:
        c = rounded_box("cap", CAP[0], CAP[1], CAP[2], (0, 0, BH + NECK_H + CAP[2] / 2 - 0.001), capm, bevel=0.0012, segs=4)
        parts.append(c)
    for p in parts:
        p.parent = root
    root.location = loc
    root.rotation_euler = (math.radians(tilt), 0, math.radians(rot_z))
    return root


def jag_cut(ob, center, normal, depth, seed=3):
    """얼음 덩이 모서리를 깨진 면으로 — 울퉁불퉁한 칼판(세분 + 노이즈)으로 잘라 낸다."""
    me = bpy.data.meshes.new("cut")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co *= depth
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=6, use_grid_fill=True)
    rnd = random.Random(seed)
    for v in bm.verts:
        v.co += Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * depth * 0.06
    bm.to_mesh(me)
    bm.free()
    cutter = link(bpy.data.objects.new("cut", me))
    cutter.location = Vector(center) + Vector(normal).normalized() * depth * 0.5
    cutter.rotation_euler = Vector(normal).to_track_quat("Z", "Y").to_euler()
    boolean(ob, cutter)


def ice_block(size, loc, mat, cuts=(), seed=1, roughen=0.0015, hole=None):
    ob = rounded_box("ice", *size, loc, mat, bevel=0.004, segs=3)
    apply_mods(ob)
    for c in cuts:
        jag_cut(ob, *c)
    if hole:
        # 병 자리를 비운다(병보다 조금 큰 둥근 상자) — 겹친 굴절 물체는 Cycles에서 탁해진다
        sx, sy, sz, hloc, rz = hole
        h = rounded_box("icehole", sx, sy, sz, hloc, None, bevel=0.004)
        h.rotation_euler = (0, 0, math.radians(rz))
        apply_mods(h)
        boolean(ob, h)
    # 녹은 표면의 출렁임
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 2
    sub.subdivision_type = "SIMPLE"
    tex = bpy.data.textures.new(f"icenoise{seed}", "CLOUDS")
    tex.noise_scale = 0.03
    disp = ob.modifiers.new("disp", "DISPLACE")
    disp.texture = tex
    disp.strength = roughen
    disp.texture_coords = "OBJECT"
    return ob


def siot_ice(mat, h=0.20, w=0.17, thick=0.060, depth=0.060, loc=(0, 0, 0), sheath=False):
    """「ㅅ」 얼음 조각 — 위에서 맞붙은 두 기둥(안쪽 갈라진 자리가 원본 Y의 V 자리). 원본 Y는 세 갈래, 우리는 두 갈래."""
    root = link(bpy.data.objects.new("siot_root", None))
    ang = math.atan2(w / 2, h)
    L = math.hypot(w / 2, h) + thick * 0.3
    bars = []
    for side in (-1, 1):
        b = rounded_box(f"bar{side}", thick, depth, L, (0, 0, 0), mat, bevel=0.006, segs=3)
        b.rotation_euler = (0, -side * ang, 0)   # 꼭짓점이 위(Λ) — 1판은 부호가 반대라 V로 섰다
        b.location = (side * w / 4, 0, h / 2 + 0.002)
        bars.append(b)
    # 두 기둥을 하나로(맞붙은 자리가 매끈하게)
    apply_mods(bars[0])
    apply_mods(bars[1])
    mod = bars[0].modifiers.new("u", "BOOLEAN")
    mod.operation = "UNION"
    mod.object = bars[1]
    mod.solver = "EXACT"
    apply_mods(bars[0])
    bpy.data.objects.remove(bars[1], do_unlink=True)
    ob = bars[0]
    ob.name = "siot"
    # 바닥을 평평하게, 꼭대기도 살짝 평평하게(두 기둥 머리가 W로 패이지 않게)
    jag_cut(ob, (0, 0, 0.0), (0, 0, -1), 0.4, seed=11)
    jag_cut(ob, (0, 0, h - 0.004), (0, 0, 1), 0.4, seed=12)
    # 잎집 마디(꼭대기 위로 솟은 가는 기둥)는 11판부터 뺀다(sheath=False) — Fable 이미지 콘티 1차 P0-1: 뒤집어 찍은 6 · 7번에서
    # 이 기둥이 원본 「Y」의 줄기가 되어 Y 얼음 조각 그대로 읽혔고, 세운 10번도 뒤집힌 Y(λ)로 읽혔다. 잎집은 라벨 · 뚜껑의 가는 선에만
    if sheath:
        sh = rounded_box("sheath", thick * 0.42, depth * 0.7, 0.060, (0, 0, h + 0.022), mat, bevel=0.006, segs=3)
        apply_mods(sh)
        mod = ob.modifiers.new("u2", "BOOLEAN")
        mod.operation = "UNION"
        mod.object = sh
        mod.solver = "EXACT"
        apply_mods(ob)
        bpy.data.objects.remove(sh, do_unlink=True)
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 2
    sub.subdivision_type = "SIMPLE"
    tex = bpy.data.textures.new("siotnoise", "CLOUDS")
    tex.noise_scale = 0.04
    disp = ob.modifiers.new("disp", "DISPLACE")
    disp.texture = tex
    disp.strength = 0.0018
    ob.parent = root
    root.location = loc
    return root


def pine_sprig(loc, length=0.10, needle=0.028, seed=5, mat_stem=None, mat_needle=None, el=(28, 48), az=None):
    """솔가지: 가는 줄기에 솔잎이 두 가닥씩(잎집에서 갈라짐) 비스듬히 난다. 원본의 얼음 속 초록 새싹 자리."""
    rnd = random.Random(seed)
    stem_m = mat_stem or mat_simple("stem", base=(0.20, 0.13, 0.08), rough=0.6)
    nd_m = mat_needle or mat_simple("needle", base=(0.05, 0.22, 0.09), rough=0.35, coat=0.3)
    root = link(bpy.data.objects.new("sprig_root", None))
    st = cylinder("stem", 0.0018, length, (0, 0, length / 2), stem_m, segs=16)
    st.parent = root
    me = bpy.data.meshes.new("needles")
    bm = bmesh.new()
    n_pairs = int(length / 0.0026)
    for i in range(n_pairs):
        z = 0.008 + (length - 0.010) * i / n_pairs
        a0 = rnd.uniform(0, 2 * math.pi) if az is None else rnd.choice(az) + rnd.uniform(-0.25, 0.25)
        for side in (-0.22, 0.22):
            a = a0 + side
            e = math.radians(rnd.uniform(*el))
            dirv = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
            ln = needle * rnd.uniform(0.85, 1.1)
            ret = bmesh.ops.create_cone(bm, cap_ends=True, segments=5, radius1=0.00042, radius2=0.00008, depth=ln)
            rot = dirv.to_track_quat("Z", "Y").to_matrix().to_4x4()
            for v in ret["verts"]:
                v.co = rot @ (v.co + Vector((0, 0, ln / 2))) + Vector((0, 0, z))
    bm.to_mesh(me)
    bm.free()
    nd = link(bpy.data.objects.new("needles", me))
    nd.data.materials.append(nd_m)
    nd.parent = root
    root.location = loc
    return root


def backdrop(rgb_low, rgb_high, strength=1.0, dist=0.6, width=3.0, height=1.6, z0=0.0, y=None):
    """카메라 뒤편의 큰 빛판(위가 밝은 파랑) — 원본의 흐린 파란 바탕."""
    m, n, l, out = new_mat("backdrop")
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Generated"], sep.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*rgb_low, 1)
    ramp.color_ramp.elements[1].color = (*rgb_high, 1)
    l.new(sep.outputs["Y"], ramp.inputs["Fac"])
    e = n.new("ShaderNodeEmission")
    l.new(ramp.outputs["Color"], e.inputs["Color"])
    e.inputs["Strength"].default_value = strength
    l.new(e.outputs[0], out.inputs["Surface"])
    me = bpy.data.meshes.new("bd")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    for v in bm.verts:
        v.co.x *= width
        v.co.y *= height
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new("backdrop", me))
    ob.data.materials.append(m)
    ob.location = (0, dist if y is None else y, z0 + height / 2)
    ob.rotation_euler = (math.radians(90), 0, 0)
    ob.visible_shadow = False
    return ob


def floor(mat, size=4.0, z=0.0):
    me = bpy.data.meshes.new("floor")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size / 2)
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new("floor", me))
    ob.data.materials.append(mat)
    ob.location = (0, 0, z)
    return ob


def mat_soft_bar(name, rgb, strength, length, end=0.012):
    """가장자리가 엷어지는 빛 띠 — 위아래는 포물선으로, 두 끝은 end(m) 안에서 사라진다(11판: 띠를 병 가까이 당기니 초점이 덜 흐려 모서리가 칼 같았다)."""
    m, n, l, out = new_mat(name)
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Generated"], sep.inputs["Vector"])
    def node(op, a, b=None):
        x = n.new("ShaderNodeMath")
        x.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                x.inputs[i].default_value = v
            else:
                l.new(v, x.inputs[i])
        return x.outputs[0]
    # 판은 세운 평면이라 띠 두께 방향이 생성 좌표 Y다. 아래 절반은 꽉 차게 두어 바닥 반사와 이어지게 하고(사이가 검게 비었다), 위로만 엷어진다
    zc = node("MAXIMUM", node("SUBTRACT", node("MULTIPLY", sep.outputs["Y"], 2.0), 1.0), 0.0)
    sz = node("MAXIMUM", node("SUBTRACT", 1.0, node("MULTIPLY", zc, zc)), 0.0)
    xd = node("SUBTRACT", 0.5, node("ABSOLUTE", node("SUBTRACT", sep.outputs["X"], 0.5)))
    sx = node("MINIMUM", node("MULTIPLY", xd, length / end), 1.0)
    e = n.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*rgb, 1)
    sz3 = node("POWER", sz, 3.0)   # 포물선 그대로는 빛이 하얗게 넘쳐 모서리가 여전히 칼 같았다 — 세제곱으로 엷어지는 폭을 넓힌다
    l.new(node("MULTIPLY", node("MULTIPLY", sz3, node("MULTIPLY", sx, sx)), strength * 1.5), e.inputs["Strength"])
    l.new(e.outputs[0], out.inputs["Surface"])
    return m


def light_bar(loc, length, thick, strength, rgb=(0.80, 0.90, 1.0), soft=False):
    """병 뒤의 가로 빛 띠(18번) — 흐린 초점에서 넓게 번진다."""
    if not soft:
        ob = rounded_box("lightbar", length, thick, thick, loc, mat_emit("bar", rgb, strength), bevel=0.0)
        ob.visible_shadow = False
        return ob
    # 11판: 상자는 윗면(생성 좌표 끝 = 빛 0)이 카메라에 검은 줄로 보였다 — 카메라를 보는 세운 평면 한 장으로
    me = bpy.data.meshes.new("lightbar")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    for v in bm.verts:
        v.co.x *= length
        v.co.y *= thick
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new("lightbar", me))
    ob.data.materials.append(mat_soft_bar("bar", rgb, strength, length))
    ob.location = loc
    ob.rotation_euler = (math.radians(90), 0, 0)
    ob.visible_shadow = False
    if soft:
        ob.visible_diffuse = False   # 바닥 바로 위라 바닥을 곧장 비춰 청록 웅덩이가 졌다 — 유리 · 바닥 반사로만 보이게
    return ob


def mat_frost(name, fade_axis="Z", fade=(0.45, 1.0), radial=False):
    """서리(18번): 흰 얼음 결정 알갱이 — 노이즈로 군데군데, 한쪽 끝(fade_axis 생성 좌표)으로 갈수록 엷어져 사라진다.
    radial이면 가운데서 멀수록 엷어진다(병 밑 바닥 서리). 투명과 섞어 쓰니 그림자는 드리우지 않는다."""
    m, n, l, out = new_mat(name)
    b = principled(n, base=(0.86, 0.93, 1.0), rough=0.55)
    tc = n.new("ShaderNodeTexCoord")
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 70.0   # 12판(Fable P2-10): 260은 병 속 얼음 알갱이처럼 잘게 보였다 · 13판(3차 P2-7): 140은 결정 없이 매끈한 흰 번짐 — 굵게
    nz.inputs["Detail"].default_value = 10.0
    nz.inputs["Roughness"].default_value = 0.7
    l.new(tc.outputs["Object"], nz.inputs["Vector"])
    grain = n.new("ShaderNodeMapRange")
    grain.inputs["From Min"].default_value = 0.55
    grain.inputs["From Max"].default_value = 0.70   # 13판: 성기게(덮임 40% 안팎)
    l.new(nz.outputs["Fac"], grain.inputs["Value"])
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Generated"], sep.inputs["Vector"])
    edge = n.new("ShaderNodeMapRange")
    edge.inputs["From Min"].default_value = fade[0]
    edge.inputs["From Max"].default_value = fade[1]
    edge.inputs["To Min"].default_value = 1.0
    edge.inputs["To Max"].default_value = 0.0
    if radial:
        vm = n.new("ShaderNodeVectorMath")
        vm.operation = "DISTANCE"
        vm.inputs[1].default_value = (0.5, 0.5, 1.0)   # 윗면(카메라에 보이는 면) 가운데에서 잰다
        l.new(tc.outputs["Generated"], vm.inputs[0])
        l.new(vm.outputs["Value"], edge.inputs["Value"])
    else:
        l.new(sep.outputs[fade_axis], edge.inputs["Value"])
    # 12판(Fable P2-10): 알갱이만 있으면 덩어리가 병 속 얼음처럼 보였다 — 옅은 젖빛 막(0.35) 위에 알갱이를 얹는다
    haze = n.new("ShaderNodeMath")
    haze.operation = "MULTIPLY_ADD"
    l.new(grain.outputs["Result"], haze.inputs[0])
    haze.inputs[1].default_value = 0.88
    haze.inputs[2].default_value = 0.12   # 12판(Fable 2차 P2-6): 막 0.35는 병 아랫부분이 젖빛 덩어리가 됐다 — 성긴 결정 뒤로 액체가 비치게
    mul = n.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    l.new(haze.outputs[0], mul.inputs[0])
    l.new(edge.outputs["Result"], mul.inputs[1])
    tr = n.new("ShaderNodeBsdfTransparent")
    mix = n.new("ShaderNodeMixShader")
    l.new(mul.outputs[0], mix.inputs["Fac"])
    l.new(tr.outputs[0], mix.inputs[1])
    l.new(b.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs["Surface"])
    return m


def frost_shell(height, root=None, pad=0.0015):   # 12판(Fable P2-10): 0.4 mm는 유리와 같은 자리라 병 속 서리로 읽혔다
    """병 몸통 바깥에 붙는 얇은 서리 껍질(바닥에서 height까지) — 원본 18번처럼 병 밑에서 서리가 차오른다(--t로 높이를 바꾼다).
    윗면은 서리가 엷어진 끝(투명)이라 병을 가로지르는 선이 생기지 않는다."""
    ob = rounded_box("frost", BW + pad * 2, BD + pad * 2, height, (0, 0, height / 2), mat_frost("frost"), bevel=0.0036)
    ob.visible_shadow = False
    if root is not None:
        ob.parent = root
    if arg("--바닥서리", "1") == "0":
        return ob
    pad_ob = cylinder("frost_floor", 0.045, 0.0004, (0, 0, 0.0002), mat_frost("frost_floor", radial=True, fade=(0.18, 0.5)))
    pad_ob.visible_shadow = False
    return ob


def glow_plane(x0, x1, y, z0, z1, strength, rgb=(0.80, 0.90, 1.0)):
    """빛 띠 위로 은은히 번지는 판(18번 끝) — 아래 끝이 가장 밝고 위로 갈수록 엷어져 사라진다. 바닥 · 유리는 안 비춘다."""
    m, n, l, out = new_mat("glow")
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Generated"], sep.inputs["Vector"])
    inv = n.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    l.new(sep.outputs["Y"], inv.inputs[1])
    pw = n.new("ShaderNodeMath")
    pw.operation = "POWER"
    l.new(inv.outputs[0], pw.inputs[0])
    pw.inputs[1].default_value = 1.6
    mul = n.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    l.new(pw.outputs[0], mul.inputs[0])
    mul.inputs[1].default_value = strength
    e = n.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*rgb, 1)
    l.new(mul.outputs[0], e.inputs["Strength"])
    tr = n.new("ShaderNodeBsdfTransparent")
    add = n.new("ShaderNodeAddShader")
    l.new(e.outputs[0], add.inputs[0])
    l.new(tr.outputs[0], add.inputs[1])
    l.new(add.outputs[0], out.inputs["Surface"])
    me = bpy.data.meshes.new("glow")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    for v in bm.verts:
        v.co.x *= (x1 - x0)
        v.co.y *= (z1 - z0)
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new("glow", me))
    ob.data.materials.append(m)
    ob.location = ((x0 + x1) / 2, y, (z0 + z1) / 2)
    ob.rotation_euler = (math.radians(90), 0, 0)
    ob.visible_shadow = False
    ob.visible_diffuse = False
    ob.visible_glossy = False
    return ob


def water_surface(z, size=0.25, strength=0.003, seed=2):
    m, n, l, out = new_mat("water")
    b = principled(n, base=(0.85, 0.93, 1.0), rough=0.0, ior=1.333, trans=1.0)
    l.new(shadow_pass(n, l, b.outputs[0]).outputs[0], out.inputs["Surface"])
    va = n.new("ShaderNodeVolumeAbsorption")
    va.inputs["Color"].default_value = (0.35, 0.62, 1.0, 1)
    va.inputs["Density"].default_value = 6.0
    l.new(va.outputs[0], out.inputs["Volume"])
    ob = rounded_box("water", 0.12, 0.12, 0.06, (0, 0, z - 0.03), m, bevel=0.0)   # 화면 밖은 필요 없어 작게(잘게 나눌 수 있게)
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = 6
    sub.render_levels = 6
    sub.subdivision_type = "SIMPLE"
    tex = bpy.data.textures.new("ripple", "STUCCI")
    tex.noise_scale = 0.018
    disp = ob.modifiers.new("disp", "DISPLACE")
    disp.texture = tex
    disp.strength = strength
    disp.texture_coords = "GLOBAL"
    disp.direction = "Z"
    return ob


# ── 컷 ───────────────────────────────────────────────────────────────────────
# 2판(1판 비교 뒤): 1판은 바탕 빛판 · 바닥이 밝아 화면이 하얗게 날았다. 원본은 짙은 코발트 바탕에 유리 가장자리 · 얼음 결만 빛나는 꼴이라
# 바탕을 어둡게(빛판 0.6~0.9) · 바닥을 짙은 파랑 광택으로 낮추고, 빛은 뒤 · 옆 테두리 위주로. 카메라는 원본 첫 프레임의 물체 자리 · 크기를
# 화면 비율로 재어 거리 · 렌즈를 셈했다(각 컷 주석).
def lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def studio(low=(0.010, 0.060, 0.400), high=(0.001, 0.006, 0.060), strength=0.6, dist=0.8, height=1.2, width=4.0,
           floor_rgb=(0.010, 0.030, 0.090), floor_z=0.0, use_floor=True):
    world_gradient((0.001, 0.004, 0.020), (0.006, 0.025, 0.090), 1.0)
    if use_floor:
        floor(mat_simple("floor", base=floor_rgb, rough=0.22, coat=0.35), z=floor_z)
    backdrop(low, high, strength=strength, dist=dist, height=height, width=width)


def rims(target, e=40, size=0.08, spread=(0.16, 0.20, 0.10)):
    sx, sy, sz = spread
    area_light("rimL", (-sx, sy, sz), target, e, size, (0.70, 0.85, 1.0))
    area_light("rimR", (sx, sy, sz), target, e, size, (0.70, 0.85, 1.0))


def shot_look():
    studio()
    bottle((0, 0, 0), rot_z=-28)
    area_light("key", (-0.25, -0.30, 0.30), (0, 0, 0.06), 12, 0.30, ICE_BLUE)
    rims((0, 0, 0.06))
    camera((0.12, -0.50, 0.09), (0, 0, 0.058), lens=70, fstop=5.6)


def shot_s18():
    """원본 18(15.84~20.00초): 첫 프레임은 병이 화면 왼쪽에 크게(뚜껑 가운데가 화면 폭의 0.22 · 뚜껑 위가 화면 위에 잘리고 바닥은 아래로 잘림,
    병 오른쪽 아래에 흐린 둥근 빛 덩이) → 20.0초까지 서지 않고 점점 느리게 물러나(0.51배) 병이 화면 왼쪽 1/3(가운데 0.30)에 서고,
    빛 덩이는 17초쯤까지 가로 빛 띠(높이 0.62~0.80)로 길어지며, 병 밑에서 서리가 차오른다."""
    # 11판(10-26 밤, 아르곤 첫 분석 · 원본 15.88~18.00초 프레임 대조): ① 원본 띠는 처음에 병 오른쪽 뒤의 둥근 빛 덩이였다가
    # 1초 동안 양옆으로 길어져 17초쯤 화면을 가로지른다 — 길이를 --t로 늘린다. ② 끝 프레임 띠 높이 0.65~0.80(우리 10판 0.55~0.65) —
    # 띠를 병 뒤 0.25 m · 바닥 바로 위로 당겨 낮춘다(바닥 밑으로는 못 내린다). ③ 원본 바닥은 띠를 흐리게만 비춘다(밝기 120~170, 우리 240~255) — 거칠게.
    # ④ 원본 바탕은 위가 어둡고 띠 쪽으로 밝아진다(23 → 114, 우리는 57~62로 평평) — 바탕판 높이를 줄여 화면 안에 기울기를 넣는다.
    # 12판(Fable 이미지 콘티 1차 P2-9 · 10): 첫 프레임 위가 원본의 2.3배 밝고 바탕판 아래 끝이 띠처럼 보였다 — 바탕을 어둡게, 기울기는 아래로 길게
    # 13판(Fable 3차 P2-5 · 7): 끝을 위해 올린 0.7이 첫 키까지 밝혀 위가 원본의 2.8배 — 세기를 T로 0.35 → 0.7, 기울기는 화면 안으로(높이 0.35 · 아래로 0.18)
    studio(low=(0.022, 0.13, 0.75), high=(0.0005, 0.003, 0.025), strength=0.35 + 0.65 * T, dist=0.9, height=0.35)
    bpy.data.objects["backdrop"].location.z -= 0.18
    fl = bpy.data.materials["floor"].node_tree.nodes["Principled BSDF"]
    fl.inputs["Roughness"].default_value = float(arg("--바닥거칠기", "0.4"))
    fl.inputs["Coat Weight"].default_value = 0.0
    fl.inputs["Base Color"].default_value = (0.004, 0.014, 0.045, 1) if arg("--검은바닥", "0") == "0" else (0, 0, 0, 1)   # 띠가 바닥을 곧장 비춰 청록 웅덩이가 졌다 — 바닥을 어둡게
    fl.inputs["Specular IOR Level"].default_value = float(arg("--바닥반사", "0.35"))   # 0.25는 바닥 반사가 원본보다 어두웠다(86/124)
    fl.inputs["Specular Tint"].default_value = (0.55, 0.78, 1.0, 1)   # 흰 띠가 회색 바닥으로 비쳤다 — 원본처럼 옅은 파랑으로
    # 띠 두 끝(m): 원본 프레임에서 오른쪽 끝이 화면 폭의 0.52(15.88초) → 0.77(16.34) → 0.91(16.6) → 17초쯤 화면 끝, 왼쪽 끝은 병 뒤에서 나와 17초쯤 화면 왼쪽 끝
    # 12판(Fable P2-11): T=0.30에서 3 m로 바꾸면 화면 왼쪽 끝이 한 프레임 튄다 — 0.36까지 이어 두 끝이 화면 밖으로 나간 뒤 바꾼다
    # 12판(P2-10): 띠를 바닥에서 띄우면 띠와 바닥 반사 사이가 검게 비고, 붙이면 바닥 반사까지 띠로 읽혀 아래 끝이 0.07 낮았다 —
    # 띠를 0.35 m 뒤로 물려 바닥선을 화면 높이 0.77쯤으로 올리고(바닥에 붙임), 바닥 반사는 줄인다. 빛 덩이 자람은 그 평면 폭(1.2배)만큼
    x0, x1 = (0.020 - 0.54 * T, 0.080 + 0.56 * T) if T < 0.36 else (-1.5, 1.5)   # 13판(Fable 3차 P2-5): 첫 빛 덩이가 작았다 · 14판(4차 P2-2): 0.10은 255로 타 0.08
    grow = min(1.0, T / 0.36)
    light_bar(((x0 + x1) / 2, 0.35, 0.0225), x1 - x0, 0.045, 1.1 + 0.9 * grow, soft=True)   # 13판: 2.6은 띠가 두 칸 255 · 14판(4차 P2-2): 첫 덩이는 1.1(원본 덩이는 부드러운 73)
    if grow >= 1.0:
        glow_plane(-1.5, 1.5, 0.352, 0.030, 0.085, 0.9)   # 14판(4차 P2-3): 원본은 띠 위 0.1 H에 걸쳐 번진다 — 띠 바로 위 은은한 번짐 판
    root = bottle((0, 0, 0), rot_z=-6)
    # ⑤ 원본은 병 밑에서 서리 · 냉기가 병을 타고 차오른다(끝에서 라벨 바로 아래까지) — 서리 껍질 높이를 --t로
    frost_shell(BH * (0.12 + 0.21 * T), root)   # 12판(Fable P3-4): 원본 끝은 몸통 아래 0.31쯤
    # 12판(Fable 2차 P1-2): 첫 프레임 뚜껑이 255로 타 흰 덩어리였다(≥250 7.3%) — key 9 → 6 · 테두리 55 → 30
    area_light("key", (-0.28, -0.30, 0.22), (0, 0, 0.06), 3, 0.60, ICE_BLUE)   # 13판(Fable 3차 P2-6): 뚜껑 앞면 ≥250 43% — 3 · 크기 0.6으로 퍼뜨림
    rims((0, 0, 0.06), e=30)
    # 11판: 병 뒤 테두리 조명 둘이 바닥까지 비춰 병 앞 · 오른쪽 바닥이 하얀 웅덩이가 됐다(원본 바닥은 띠 아래 밝기 120 안팎) — 빛 연결로 병만 비춘다
    lit = bpy.data.collections.new("rim_receivers")
    for ob in bpy.data.objects:
        if ob.type == "MESH" and ob.name not in ("floor", "backdrop", "lightbar", "frost_floor"):
            lit.objects.link(ob)
    for nm in ("rimL", "rimR"):
        bpy.data.objects[nm].light_linking.receiver_collection = lit
    # 9판(Fable 원본 대조 1차 P0-1 · 2): 원본은 서지 않고 20.0초까지 점점 느리게 물러나고, 병은 끝까지 화면 왼쪽 1/3에 선다.
    # 원본 끝 프레임(19.96초): 병 높이가 화면 높이의 0.80(위 0.14 ~ 아래 0.94) · 병 가운데가 너비의 0.30 → 화면 폭 0.264 m(렌즈 70 → 0.513 m).
    # 첫 프레임은 그 0.51배 화면(폭 0.135 m · 0.262 m) · 뚜껑 가운데가 너비의 0.215 · 뚜껑 위가 화면 위 끝.
    # 화면 배율 키(첫 프레임 대비): 16.92초 0.77 · 17.92초 0.62 · 18.92초 0.55 · 20.00초 0.51(카메라.json · Fable 재측정)
    keys = [(0.0, 1.0), (0.26, 0.77), (0.50, 0.62), (0.74, 0.55), (1.0, 0.51)]
    sc_t = keys[-1][1]
    for (t0, a0), (t1, a1) in zip(keys, keys[1:]):
        if t0 <= T <= t1:
            u = (T - t0) / (t1 - t0)
            sc_t = a0 + (a1 - a0) * u
            break
    w = 0.125 / sc_t                      # 화면 폭(m) — 9판 0.135는 우리 병(원본보다 가늘다)이 작게 보여 0.85배로 · 12판 0.115 → 0.125(끝 병 높이 0.88 → 0.80, Fable 1차 P2-10)
    k = (1.0 - sc_t) / (1.0 - 0.51)       # 0 → 1
    tx = 0.033 + (0.045 - 0.033) * k      # 겨냥점을 병 오른쪽으로(병이 왼쪽에 서게)
    tz = 0.078 + (0.0646 - 0.078) * k     # 12판(Fable 2차 P2-7 ⒝): 첫 키를 0.0867 → 0.078로 내려 뚜껑이 원본처럼 위에서 잘리고 이름 윗줄이 들게
    d = w * 70 / 36
    camera((tx, -d - BD / 2, tz + 0.004), (tx, 0, tz), lens=70, fstop=1.6 + 4.0 * k)   # 11판: 원본 첫 프레임의 빛 덩이는 더 둥글게 번진다 · 13판 2.0 → 1.6


def shot_s17():
    """원본 17(14.84~15.84초): 병 몸통이 화면을 채우고(폭의 0.12~0.85) 라벨이 가운데(높이 0.55~0.66), 윗부분이 왼쪽으로 15°쯤 기울어 보임,
    어깨 유리 · 뚜껑 밑이 위에 잘려 보이고 오른쪽 뒤가 밝다 → 1초에 0.64배로 물러남(돌지 않음)."""
    # 14판(Fable 4차 P2-1): 바닥을 빼니 한 단 어두워지고 오른쪽 아래가 검게 비었다 — 바탕은 되돌리고, 바닥은 두되 유리에 비치지 않게(glossy 끔)
    studio(low=(0.06, 0.22, 0.70), high=(0.004, 0.03, 0.22), strength=0.45, dist=0.5, height=0.5)   # 11판(P2-8)
    bpy.data.objects["floor"].visible_glossy = False   # 11판(P2-8) 가운데 값 117/86 · 12 · 13판(Fable 3차 P2-4)은 바탕을 낮췄었다
    bottle((0, 0, 0), rot_z=-16)
    area_light("key", (-0.20, -0.25, 0.20), (0, 0, 0.05), 5, 0.60, ICE_BLUE)   # 12판: 8 · 크기 0.25는 앞면 왼쪽 위에 큰 흰 반사 원 — 넓혀 퍼뜨림
    bk = area_light("back", (0.25, 0.30, 0.10), (0, 0, 0.05), 35, 0.35, (0.80, 0.90, 1.0))
    bk.visible_glossy = False   # 13판(Fable 3차 P2-4): 바닥을 빼도 오른쪽 옆 유리에 255 띠 — 뒤 조명이 두꺼운 옆면에 비친 반사였다   # 11판(Fable P2-8): 120은 원본보다 밝고 모서리가 탔다
    rims((0, 0, 0.05), e=20)   # 12판(Fable 2차 P2-5): 테두리 40이 오른쪽 유리 모서리를 255 띠로 태웠다
    # 9판(Fable P0-4): 원본은 돌지 않는다 — 기울기 고정, 1초에 0.64배로 물러남만 · 11판(P2-8): 어깨 유리가 위에 걸리게 조금 물림
    d = 0.190   # 12판: 물러남은 원본 곡선으로(follow_camera — 천천히 시작 · 가운데가 빠름 · 천천히 멈춤)
    # 11판: 라벨 2판에서 「솔서리」가 z 0.0497로 올라 겨냥도 올린다(이름이 원본 라벨 자리 높이 0.55~0.66에). 어깨까지 넣으면 병이 작아져 어깨는 뺀다
    follow_camera(17, (0.020, -d - BD / 2, 0.056), (0.0, 0, 0.054), lens=85, fstop=8.0, roll=-15)   # 10판: 원본은 병 윗부분이 왼쪽으로 기움


def shot_s02():
    """원본 2(2.08~2.48초): 얼음 덩이에 박힌 병의 이름 자리를 아주 가까이 — 화면 폭 ≈ 병 폭/0.9(0.052 m, 렌즈 100 → 0.144 m),
    이름이 화면 가운데 · 높이 0.62, 위로 뚜껑과 얼음 윗면, 왼쪽 · 오른쪽 끝에 얼음 덩이가 걸침. 0.4초에 0.98배로 살짝 물러남."""
    studio(low=(0.015, 0.09, 0.55), high=(0.005, 0.04, 0.30), strength=0.9, dist=0.5)   # 11판(Fable P2-1): 원본보다 어두웠다(가운데 값 67/96)
    bottle((0, 0, 0), rot_z=0)
    ice = mat_ice(frost=0.25)   # 11판(P2-1): 맑은 얼음이 바탕과 같아 양옆 얼음 덩이가 안 보였다 — 젖빛 결을 더
    ice_block((0.110, 0.075, 0.150), (0.0, 0.0, 0.075), ice,
              cuts=[((0.040, -0.04, 0.14), (0.6, -0.7, 0.5), 0.14, 4), ((-0.045, -0.035, 0.15), (-0.4, -0.8, 0.6), 0.10, 7),
                    ((0.0, -BD / 2 - 0.002, 0.07), (0.0, -1.0, 0.0), 0.30, 13)],
              hole=(BW + 0.0012, BD + 0.0012, 0.30, (0, 0, 0.15 - 0.0006), 0))
    area_light("key", (-0.20, -0.30, 0.25), (0, 0, 0.05), 8, 0.30, ICE_BLUE)   # 13판(Fable 3차 P3-4): 12는 어깨선이 255 띠
    area_light("back", (0.0, 0.30, 0.10), (0, 0, 0.06), 60, 0.25, (0.70, 0.85, 1.0))
    rims((0, 0, 0.05), e=30)
    # 7판: 이름이 원본 라벨 자리(높이 0.62)보다 아래였다 — 겨냥을 내리고, 양옆 얼음이 보이게 화면 폭을 0.065 m로
    # 11판: 라벨 2판에서 「솔서리」가 z 0.0497로 올라 겨냥도 올리고(이름이 높이 0.60), 조금 물려 위에 「ㅅ」 전체가 들게(화면 폭 0.070 m)
    d = 0.195
    follow_camera(2, (0.0, -d - BD / 2, 0.0537), (0.0, 0, 0.0537), lens=100, fstop=8.0)


def shot_s03():
    """원본 3(2.48~3.20초): 모서리가 깨진 큰 얼음 덩이(화면 폭의 0.27~0.75, 병 폭의 2.5배쯤) 속에 선 병, 뚜껑 위가 화면 위 0.05,
    병 바닥이 0.85 — 화면 높이 0.14 m(렌즈 70 → 0.484 m). 밝은 바닥 · 흐린 파란 바탕. 거의 고정(살짝 기움)."""
    # 11판(Fable 이미지 콘티 1차 P2-2): 원본은 얼음 왼쪽 위 모서리가 크게 깨졌고 병이 얼음 앞 오른쪽에 나와 있다 · 위 바탕이 밝았다(90/57)
    # 12판(Fable 2차 P2-4): 바닥이 255로 탔고(≥250 14%) 가운데가 어두웠다(74/106), 양옆이 곧은 유리 상자 — 바탕 올리고 뒤 빛 내리고 양옆도 깸
    studio(low=(0.03, 0.12, 0.55), high=(0.002, 0.02, 0.16), strength=float(arg('--바탕', '0.8')), dist=0.7, floor_rgb=(0.01, 0.03, 0.10))   # 아래 밝은 끝 · 바닥이 255로 탔다 — 둘 다 낮춤 · 13판: 가운데가 어두워(71/99) 바탕 0.8
    # 13판(Fable 3차 P2-3): 바닥 255(≥250 13%)는 뒤 빛이 아니라 바닥 코트(0.35)의 거울 반사 — 코트 0 · 거칠기 0.5
    fl3 = bpy.data.materials["floor"].node_tree.nodes["Principled BSDF"]
    fl3.inputs["Coat Weight"].default_value = 0.0
    fl3.inputs["Roughness"].default_value = 0.5
    BX, BY = 0.010, -0.020
    bottle((BX, BY, 0), rot_z=-10, print_through=True)
    ice = mat_ice()
    ice_block((0.115, 0.080, 0.150), (0.004, 0.0, 0.075), ice,
              cuts=[((0.050, -0.04, 0.14), (0.7, -0.6, 0.5), 0.13, 4), ((0.055, -0.04, 0.03), (0.9, -0.4, -0.2), 0.08, 9),
                    ((-0.05, -0.04, 0.15), (-0.5, -0.5, 0.7), 0.06, 21), ((-0.034, -0.030, 0.112), (-0.55, -0.45, 0.70), 0.20, 31),
                    ((-0.060, -0.030, 0.060), (-1.0, -0.3, 0.1), 0.16, 41), ((0.064, -0.030, 0.090), (1.0, -0.3, 0.2), 0.16, 43)],   # 13판: 깊이 0.06은 화면에서 안 보였다
              hole=(BW + 0.0012, BD + 0.0012, 0.30, (BX, BY, 0.15 - 0.0006), -10), roughen=0.004)
    area_light("key", (-0.25, -0.30, 0.25), (0, 0, 0.05), 10, 0.30, ICE_BLUE)
    area_light("back", (0.05, 0.30, 0.10), (0, 0, 0.06), 45, 0.30, (0.70, 0.85, 1.0))
    rims((0, 0, 0.06), e=35)
    # 13판(Fable 3차 P2-3): 바닥 255는 바닥 재질이 아니라 병 뒤 조명 · 테두리가 바닥을 곧장 비춘 것(바탕 0.5 · 0.8에서 같은 16%) — 18번처럼 병 · 얼음만 비추게
    lit3 = bpy.data.collections.new("s03_receivers")
    for ob in bpy.data.objects:
        if ob.type == "MESH" and ob.name not in ("floor", "backdrop"):
            lit3.objects.link(ob)
    for nm in ("back", "rimL", "rimR"):
        bpy.data.objects[nm].light_linking.receiver_collection = lit3
    # 바닥은 따로 은은하게 — 원본 3번 아래 1/3은 200~240의 흰 안개(255는 아님)
    area_light("floorglow", (0.0, 0.20, 0.06), (0.0, -0.05, 0.0), float(arg("--바닥빛", "30")), 0.80, (0.70, 0.85, 1.0))
    follow_camera(3, (0.007, -0.484 - 0.04, 0.049), (0.007, 0, 0.055), lens=70, fstop=5.6)   # 11판(P2-2): 병이 원본보다 0.08 아래였다 — 겨냥을 11 mm 내림


def shot_s06():
    """원본 6(4.96~5.24초): 머리글자 얼음 조각의 갈라진 자리를 아주 가까이(화면 폭 ≈ 0.12 m). 원본 Y는 V 자리가 화면 높이 0.35에서
    두 팔이 위로 벌어지고, 우리 「ㅅ」은 꼭짓점이 위라 꼭짓점을 같은 높이(0.35)에 두고 두 다리가 아래로 벌어진다(위아래만 뒤집힌 꼴)."""
    studio(low=(0.01, 0.08, 0.50), high=(0.001, 0.01, 0.10), strength=0.6, dist=0.5, use_floor=False)
    ice = mat_ice("ice_s", frost=0.05)   # 11판(Fable 이미지 콘티 1차 P2-3): 0.15 · 테두리 45는 모서리가 흰 선으로 타 아크릴 CG 같았다
    siot_ice(ice, loc=(0, 0, 0))
    area_light("back", (0.0, 0.35, 0.15), (0, 0, 0.15), 90, 0.40, (0.55, 0.78, 1.0))
    area_light("key", (-0.2, -0.25, 0.3), (0, 0, 0.15), 8, 0.3, ICE_BLUE)
    rims((0, 0, 0.17), e=20, spread=(0.20, 0.15, 0.25))
    # 9판(Fable P1-4 추천)은 카메라를 180° 돌려 V 깔때기로 찍었고, 11판은 잎집 기둥을 빼 꼭짓점 아래가 비었다.
    # 12판(Fable 이미지 콘티 2차 ② 의견): 뒤집은 V는 7번에서 물이 탈 면이 없어 컷이 비었다 — 6 · 7 · 10번을 세운 「ㅅ」(Λ) 한 물체로.
    # 6번은 두 다리가 갈라지는 안쪽 홈(거꾸로 V)을 접사 — 원본 6번의 「갈라진 자리」 구실, 홈 꼭짓점이 화면 높이 0.4쯤
    follow_camera(6, (0.0, -0.085 - 0.03, 0.122), (0.0, 0, 0.122), lens=60, fstop=8.0, focus=0.085)   # 0.135는 얼음 면이 화면을 덜 채워 흰 테두리 삼각형으로 읽혔다


def shot_s07():
    """원본 7(5.24~5.72초): 6번보다 낮고 가까운 카메라 — 갈라진 자리가 화면 위 끝에 흐리게 걸리고 그 아래 얼음 면을 타고 물이 흘러내린다.
    11판(Fable 이미지 콘티 1차 P1-2): 6번 렌더를 그대로 쓰지 않고 따로 찍는다.
    12판(Fable 2차 P1-1 · ② 의견): 뒤집은 V는 꼭짓점 아래에 물이 탈 면이 없어 화면 53%가 비고 물이 실오라기였다 — 세운 「ㅅ」(Λ) 앞에서
    낮고 가까이, 등마루가 화면 위 끝(0.05~0.1)에 걸리고 두 다리 앞면이 화면 가로를 채우게. 물은 GPT 결 입히기에서 등마루에서 갈라져 두 면을 타고 흐른다."""
    studio(low=(0.01, 0.08, 0.50), high=(0.001, 0.01, 0.10), strength=0.6, dist=0.5, use_floor=False)
    ice = mat_ice("ice_s", frost=0.05)
    siot_ice(ice, loc=(0, 0, 0))
    area_light("back", (0.0, 0.35, 0.15), (0, 0, 0.15), 90, 0.40, (0.55, 0.78, 1.0))
    area_light("key", (-0.2, -0.25, 0.3), (0, 0, 0.15), 8, 0.3, ICE_BLUE)
    rims((0, 0, 0.17), e=20, spread=(0.20, 0.15, 0.25))
    # 화면 폭 0.108 m(렌즈 60 → 0.18 m), 등마루(z 0.196)가 화면 높이 0.07에 오게 겨냥 z 0.17, 카메라는 겨냥보다 조금 낮게(올려다봄) — 0.25 m는 두 다리 사이 빈 바탕이 컸다
    follow_camera(7, (0.0, -0.18 - 0.03, 0.162), (0.0, 0, 0.170), lens=60, fstop=8.0)


def shot_s10():
    """원본 10(7.40~8.12초): 파란 바탕 앞 머리글자 얼음 조각이 화면 가운데(높이의 0.13~0.97 — 화면 높이 0.238 m, 렌즈 50 → 0.588 m),
    속에 초록 새싹 → 우리 「ㅅ」 속에 솔가지. 바닥 반사 선이 0.97. 0.72초에 4.7% 다가감."""
    # 11판(Fable 이미지 콘티 1차 P2-5): 원본보다 어두웠다(가운데 값 42/92, 아래 1/3 104/187 — 원본은 흰 바닥 안개가 화면 아래를 채움)
    studio(low=(0.06, 0.22, 0.85), high=(0.002, 0.02, 0.15), strength=0.8, dist=0.8, floor_rgb=(0.10, 0.22, 0.50))
    ice = mat_ice("ice_s", frost=0.12)
    siot_ice(ice, loc=(0, 0, 0))
    # 솔가지는 오른쪽 다리 속에 다리를 따라 비스듬히(원본 새싹이 Y 기둥 속에 박힌 자리) — 11판(P2-5): 짧은 바늘잎이 사방으로 나 가문비처럼 보였다 →
    # 긴 솔잎 두 가닥씩, 다리 면(좌우)을 따라 눕혀 얼음 밖으로 안 나오게, 밝은 초록
    sp = pine_sprig((0.050, 0.0, 0.014), length=0.12, needle=0.046, el=(14, 30), az=(0.0, math.pi),
                    mat_needle=mat_simple("needle_b", base=(0.10, 0.42, 0.14), rough=0.35, coat=0.3))
    sp.rotation_euler = (0, math.radians(-21), 0)
    area_light("floorglow", (0.0, -0.10, 0.03), (0, 0.10, 0.0), 8, 0.50, (0.70, 0.85, 1.0))   # 바닥 안개 자리를 밝게(30은 하얗게 탔다)
    area_light("back", (0.0, 0.40, 0.18), (0, 0, 0.10), 90, 0.40, (0.55, 0.78, 1.0))
    area_light("key", (-0.25, -0.30, 0.25), (0, 0, 0.10), 8, 0.30, ICE_BLUE)
    rims((0, 0, 0.10), e=40, spread=(0.25, 0.20, 0.20))
    d = 0.66
    follow_camera(10, (0.0, -d - 0.03, 0.125), (0.0, 0, 0.128), lens=50, fstop=8.0)


def shot_s09():
    """원본 9(6.68~7.40초): 출렁이는 물에 잠긴 뚜껑 윗면을 위에서(카메라가 수직에서 약 30° 기움) — 뚜껑 윗면이 화면 폭의 0.3,
    가운데 약간 오른쪽(0.6, 0.45). 화면 폭 0.08 m(렌즈 85 → 0.19 m)."""
    world_gradient((0.004, 0.03, 0.18), (0.02, 0.10, 0.45), 1.0)
    floor(mat_simple("deep", base=(0.01, 0.04, 0.14), rough=0.3), z=-0.12)
    bottle((0, 0, -(BH + NECK_H + CAP[2] - 0.001) - 0.002), rot_z=12)   # 뚜껑 윗면이 물 아래 2 mm
    water_surface(0.0, strength=0.009)
    # 물결에 비칠 위쪽 빛판(반사에만 보임) — 7판: 6판은 물 표면이 안 보여 뚜껑이 마른 채로 보였다
    sb = rounded_box("softbox", 0.6, 0.6, 0.002, (0.10, 0.10, 0.45), mat_emit("sb", (0.75, 0.88, 1.0), 1.8), bevel=0.0)   # 11판: 가까이 가니 하얗게 떴다(가운데 값 121/82)
    sb.visible_camera = False
    sb.visible_transmission = False
    sb.visible_shadow = False
    area_light("top", (0.05, -0.08, 0.40), (0, 0, 0), 18, 0.35, ICE_BLUE)
    area_light("side", (-0.30, 0.10, 0.10), (0, 0, 0), 25, 0.20, (0.55, 0.78, 1.0))
    a = math.radians(30)
    # 11판(Fable 이미지 콘티 1차 P2-4): 원본 뚜껑 윗면은 가운데 (0.58, 0.40) · 폭 0.38, 우리 10판은 (0.66, 0.56) · 0.30 — 가까이(0.19 → 0.15) · 겨냥을 뚜껑 쪽으로
    d = 0.15
    tx, ty = -0.005, -0.0066
    follow_camera(9, (tx, ty - d * math.sin(a), d * math.cos(a)), (tx, ty, 0.0), lens=85, fstop=5.6, roll=8)


def shot_hand():
    """12번 손에 든 병 — 투명 바탕(병만), 이미지 콘티 · 영상 시작 그림의 초록 대역 자리에 얹는다(제품은 AI로 그리지 않는다).
    원본 12번의 병은 앞면 + 왼쪽 옆면이 보이고, 윗부분(뚜껑)이 화면 오른쪽으로 17°쯤 기울었다(10-26 밤 원본 첫 프레임 눈금으로 잼 — 1판은 반대로 기울었다)."""
    bpy.context.scene.render.film_transparent = True
    bpy.context.scene.render.image_settings.color_mode = "RGBA"
    world_gradient((0.004, 0.02, 0.10), (0.03, 0.12, 0.40), 1.0)
    # 2판(10-27 새벽, Fable 3차 P1-2): 밝은 스튜디오(바탕 0.8 · 테두리 45)로 구워 얹은 병이 장면 바탕의 3.5배로 떠 보였다(원본 1.7배) — 장면 밝기로
    backdrop((0.03, 0.14, 0.60), (0.004, 0.02, 0.10), strength=0.3, dist=0.4)   # 굴절로 비칠 바탕(카메라에는 투명으로 빠짐)
    bpy.data.objects["backdrop"].visible_camera = False
    bottle((0, 0, 0), rot_z=22, print_through=False)
    area_light("key", (-0.22, -0.30, 0.18), (0, 0, 0.06), 5, 0.30, ICE_BLUE)
    rims((0, 0, 0.06), e=25)
    camera((0.0, -0.40, 0.040), (0.0, 0, 0.060), lens=85, fstop=11.0, roll=17)


SHOTS = {"hand": shot_hand, "look": shot_look, "s18": shot_s18, "s17": shot_s17, "s02": shot_s02, "s03": shot_s03,
         "s06": shot_s06, "s07": shot_s07, "s10": shot_s10, "s09": shot_s09}

if __name__ == "__main__":
    sc = reset()
    SHOTS[SHOT]()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sc.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
    print("저장", OUT)

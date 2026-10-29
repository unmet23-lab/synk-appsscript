# 기프트 세트 새 컨셉 · 스타일 프레임 (2026-10-29, 크레딧 0)
# 유호님 10-29 「컨셉부터 새로해서 만들어봐」 — 세 안의 시안 컷을 블렌더로 굽는다. 제품 · 글자는 AI로 그리지 않는다
# (제품은 이 장면의 모형, 서리 속 손글씨는 우리 글꼴로 녹인 자국, 화면 위 글은 시안글.py가 얹는다).
#   blender -b --python 시안.py -- --frame a1 [--res 1080x1920] [--samples 160] [--cpu] [--t 0.6] [--out 파일]
# frame — 안 1 「서리꽃은 따뜻한 창에만 핀다」(물리로 자라는 서리 · 온기로 녹는 창):
#   a1 서리 결정이 자라는 접사 · a2 서리꽃이 핀 창(밖에서, 안은 따뜻한 방) · a3 온기로 녹은 동그라미 너머 제품 · a4 끝 그림(서리 창 앞 제품)
#        안 2 「얼어붙은 1초」(얼음 · 굴절 · 멈춘 순간):  b1 얼음에 갇힌 선물 · b2 깨지는 순간이 멈춤(조각 · 금빛 방울 · 제품)
#        안 3 「창에 쓴 말」(서로 엇갈려 사는 둘이 서리 낀 창에 남기는 말):  c1 새벽 「손 트지 마」 · c2 크리스마스이브 「창틀 봐」와 선물
# 서리는 서리결정.py(Kobayashi 위상장 모형)가 만든 <밖>/새컨셉/결정/<이름>/*.npy — 높이 지도를 판 메시로 세운다.
# 새 제품(2판 디자인): 눈 결정의 여섯 모 — 육각 두꺼운 유리 앰플(금빛 세럼 · 금 목 · 얼음 결정 모양 젖빛 크리스털 캡) ·
#   육각 두꺼운 유리 크림 단지(진주빛 크림 · 금 띠 · 윗면에 시뮬레이션 서리꽃이 새겨진 젖빛 크리스털 뚜껑). 단위 m.
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


FRAME = arg("--frame", "a1")
RES = tuple(int(v) for v in arg("--res", "540x960").split("x"))
SAMPLES = int(arg("--samples", "64"))
CPU = "--cpu" in argv
TGROW = float(arg("--t", "0.62"))
밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "holiday-giftset", "새컨셉")
결정 = os.path.join(밖, "결정")
OUT = arg("--out", os.path.join(밖, "시안", f"{FRAME}_{'세로' if RES[1] > RES[0] else '가로'}.png"))
MACRO_SIM = arg("--macro", "macro1280")
WINDOW_SIM = arg("--window", "window2048")
GOLD = (0.88, 0.67, 0.36)
NAVY = (0.012, 0.018, 0.040)


# ── 바탕 ────────────────────────────────────────────────────────────────────
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    if not CPU:
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
    else:
        sc.cycles.device = "CPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE" if CPU else "OPTIX"
    except Exception:
        pass
    sc.cycles.max_bounces = 24
    sc.cycles.transmission_bounces = 24
    sc.cycles.glossy_bounces = 8
    sc.cycles.transparent_max_bounces = 32
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 0.6
    sc.render.resolution_x, sc.render.resolution_y = RES
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.view_settings.view_transform = "AgX"
    for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
        try:
            sc.view_settings.look = look
            break
        except Exception:
            pass
    world = bpy.data.worlds.new("world")
    sc.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0, 0, 0, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
    return sc


def world_color(rgb, strength):
    bg = bpy.context.scene.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*rgb, 1)
    bg.inputs["Strength"].default_value = strength


def camera(loc, target, lens=50.0, fstop=None, focus=None, roll=0.0):
    cd = bpy.data.cameras.new("cam")
    cd.lens = lens
    cd.sensor_fit = "VERTICAL" if RES[1] > RES[0] else "HORIZONTAL"
    cd.sensor_width = 36.0
    cd.sensor_height = 36.0 if RES[1] > RES[0] else 24.0
    cd.clip_start = 0.002
    cd.clip_end = 80
    cam = bpy.data.objects.new("cam", cd)
    bpy.context.collection.objects.link(cam)
    cam.location = Vector(loc)
    d = Vector(target) - Vector(loc)
    q = d.to_track_quat("-Z", "Y")
    cam.rotation_euler = (q @ Matrix.Rotation(math.radians(roll), 4, "Z").to_quaternion()).to_euler()
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.aperture_blades = 7
        cd.dof.aperture_rotation = math.radians(12)
        cd.dof.focus_distance = focus if focus else d.length
    bpy.context.scene.camera = cam
    return cam


def area_light(name, loc, target, energy, size, rgb=(1, 1, 1), size_y=None, spread=180, shadow=True):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.color = rgb
    if size_y:
        ld.shape = "RECTANGLE"
        ld.size = size
        ld.size_y = size_y
    else:
        ld.shape = "DISK"
        ld.size = size
    ld.spread = math.radians(spread)
    try:
        ld.use_shadow = shadow
    except Exception:
        pass
    ob = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(ob)
    ob.location = Vector(loc)
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob


def point_light(name, loc, energy, rgb, radius=0.01):
    ld = bpy.data.lights.new(name, "POINT")
    ld.energy = energy
    ld.color = rgb
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(ob)
    ob.location = Vector(loc)
    return ob


def light_only(light_ob, receivers):
    """빛 연결 — 이 빛은 receivers에만 닿는다(현장노트: 서리 유리 병이 회색으로 죽을 때 · 바탕이 회청색으로 뜰 때)."""
    col = bpy.data.collections.new(light_ob.name + "_받음")
    bpy.context.scene.collection.children.link(col)
    for r in receivers:
        col.objects.link(r)
    try:
        light_ob.light_linking.receiver_collection = col
    except Exception:
        pass


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


def principled(nodes, **kw):
    b = nodes.new("ShaderNodeBsdfPrincipled")
    names = {
        "base": "Base Color", "metal": "Metallic", "rough": "Roughness", "ior": "IOR", "trans": "Transmission Weight",
        "coat": "Coat Weight", "coat_rough": "Coat Roughness", "aniso": "Anisotropic", "sheen": "Sheen Weight",
        "sheen_tint": "Sheen Tint", "sheen_rough": "Sheen Roughness", "sss": "Subsurface Weight",
        "sss_r": "Subsurface Radius", "emit": "Emission Color", "emit_s": "Emission Strength", "spec": "Specular IOR Level",
    }
    for k, v in kw.items():
        if k in ("base", "emit", "sheen_tint") and len(v) == 3:
            v = (*v, 1)
        setin(b, names[k], v)
    return b


def shadow_pass(n, l, shader_out, tint=(1, 1, 1)):
    """굴절 물체는 그림자 광선에 투명 — 유리 · 얼음이 까만 그림자를 드리우지 않게(1번 캔 장면과 같은 처리)."""
    lp = n.new("ShaderNodeLightPath")
    tr = n.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = (*tint, 1)
    mix = n.new("ShaderNodeMixShader")
    l.new(lp.outputs["Is Shadow Ray"], mix.inputs["Fac"])
    l.new(shader_out, mix.inputs[1])
    l.new(tr.outputs[0], mix.inputs[2])
    return mix


def math_node(n, l, op, a, b=None, clamp=False):
    x = n.new("ShaderNodeMath")
    x.operation = op
    x.use_clamp = clamp
    if isinstance(a, (int, float)):
        x.inputs[0].default_value = a
    else:
        l.new(a, x.inputs[0])
    if b is not None:
        if isinstance(b, (int, float)):
            x.inputs[1].default_value = b
        else:
            l.new(b, x.inputs[1])
    return x.outputs[0]


def madd(n, l, a, b, c):
    """a × b + c (곱하고 더하기 — 입력 셋)."""
    x = n.new("ShaderNodeMath")
    x.operation = "MULTIPLY_ADD"
    for i, v in enumerate((a, b, c)):
        if isinstance(v, (int, float)):
            x.inputs[i].default_value = v
        else:
            l.new(v, x.inputs[i])
    return x.outputs[0]


def mat_simple(name, **kw):
    m, n, l, out = new_mat(name)
    b = principled(n, **kw)
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def mat_glass(name="glass", rough=0.0, ior=1.5, tint=(1, 1, 1), absorb=None):
    m, n, l, out = new_mat(name)
    b = principled(n, base=tint, rough=rough, ior=ior, trans=1.0)
    l.new(shadow_pass(n, l, b.outputs[0], tint=(0.93, 0.95, 0.97)).outputs[0], out.inputs["Surface"])
    if absorb:
        v = n.new("ShaderNodeVolumeAbsorption")
        v.inputs["Color"].default_value = (*absorb[0], 1)
        v.inputs["Density"].default_value = absorb[1]
        l.new(v.outputs[0], out.inputs["Volume"])
    return m


def mat_serum():
    m, n, l, out = new_mat("serum")
    b = principled(n, base=(1.0, 0.92, 0.74), rough=0.0, ior=1.40, trans=1.0)
    vol = n.new("ShaderNodeVolumeAbsorption")
    vol.inputs["Color"].default_value = (1.0, 0.62, 0.18, 1)
    vol.inputs["Density"].default_value = 38.0
    l.new(shadow_pass(n, l, b.outputs[0], tint=(1.0, 0.86, 0.6)).outputs[0], out.inputs["Surface"])
    l.new(vol.outputs[0], out.inputs["Volume"])
    return m


def mat_cream():
    return mat_simple("cream", base=(0.975, 0.962, 0.945), rough=0.28, sss=0.7, sss_r=(0.006, 0.006, 0.005), coat=0.35,
                      coat_rough=0.12)


def mat_gold(name="gold", rough=0.14):
    return mat_simple(name, base=GOLD, metal=1.0, rough=rough)


def height_image(name, arr):
    """numpy 높이 지도(0~1, 행 = 위→아래)를 블렌더 그림으로."""
    h, w = arr.shape
    im = bpy.data.images.new(name, w, h, alpha=False, float_buffer=True)
    px = np.repeat(np.flipud(arr).astype(np.float32)[..., None], 4, axis=2)
    px[..., 3] = 1.0
    im.pixels.foreach_set(px.ravel())
    im.colorspace_settings.name = "Non-Color"
    im.pack()
    return im


def mat_crystal_relief(name, relief, half, axis="Z", center=(0.0, 0.0), field=0.40, pattern=0.02, other=0.0,
                       bump_dist=0.00035, tint=(0.97, 0.985, 1.0)):
    """크리스털 + 서리꽃 새김(라리크 유리처럼). axis 쪽을 보는 면(윗면 · 앞면)에만 무늬를 얹는다 — 그 면의 바탕 거칠기 field,
    무늬 자리 pattern, 나머지 면 other. 뚜껑은 젖빛 바탕에 맑게 깎인 무늬(field 0.4 · pattern 0.02),
    앰플 앞면은 맑은 바탕에 젖빛 무늬(field 0 · pattern 0.35)."""
    m, n, l, out = new_mat(name)
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Object"], sep.inputs["Vector"])
    ax = {"Z": ("X", "Y"), "Y": ("X", "Z"), "X": ("Y", "Z")}[axis]
    u = madd(n, l, sep.outputs[ax[0]], 0.5 / half, 0.5 - center[0] * 0.5 / half)
    v = madd(n, l, sep.outputs[ax[1]], 0.5 / half, 0.5 - center[1] * 0.5 / half)
    comb = n.new("ShaderNodeCombineXYZ")
    l.new(u, comb.inputs["X"])
    l.new(v, comb.inputs["Y"])
    t = n.new("ShaderNodeTexImage")
    t.image = relief
    t.extension = "CLIP"
    t.interpolation = "Cubic"
    l.new(comb.outputs[0], t.inputs["Vector"])
    # 무늬가 얹히는 면 — 물체 좌표의 노멀이 axis 쪽(±)
    geo = n.new("ShaderNodeNewGeometry")
    vt = n.new("ShaderNodeVectorTransform")
    vt.vector_type = "NORMAL"
    vt.convert_from = "WORLD"
    vt.convert_to = "OBJECT"
    l.new(geo.outputs["Normal"], vt.inputs["Vector"])
    sepn = n.new("ShaderNodeSeparateXYZ")
    l.new(vt.outputs[0], sepn.inputs["Vector"])
    face = math_node(n, l, "GREATER_THAN", math_node(n, l, "ABSOLUTE", sepn.outputs[axis]), 0.9)
    pat = math_node(n, l, "MULTIPLY", math_node(n, l, "MULTIPLY", t.outputs["Color"], 6.0, clamp=True), face)
    # 거칠기 = 다른 면 other → 그 면 바탕 field → 무늬 자리 pattern
    r_face = madd(n, l, face, field - other, other)
    rough = madd(n, l, pat, pattern - field, r_face)
    b = principled(n, base=tint, ior=1.5, trans=1.0)
    l.new(rough, b.inputs["Roughness"])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 1.0
    bump.inputs["Distance"].default_value = bump_dist
    l.new(math_node(n, l, "MULTIPLY", t.outputs["Color"], face), bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    l.new(shadow_pass(n, l, b.outputs[0], tint=(0.93, 0.95, 0.97)).outputs[0], out.inputs["Surface"])
    return m


def mat_frost(name="frost", glow=(1.0, 0.86, 0.62), body=0.85, sparkle=1.0, core_lo=0.45):
    """창 서리(얇은 판): 가지 등뼈(두꺼운 곳)만 하얗게 흩고 뒤에서 오는 빛을 비춰 보내며, 얇은 가지 끝은 유리처럼 맑다.
    가지 모서리의 가파른 면은 반짝(잔 결 노멀의 반사) — 첫 시험의 흰 석고 · 종이처럼 뜬 서리를 고친 판."""
    m, n, l, out = new_mat(name)
    at = n.new("ShaderNodeAttribute")
    at.attribute_name = "frost"
    thick = math_node(n, l, "POWER", at.outputs["Fac"], 0.7)
    trl = n.new("ShaderNodeBsdfTranslucent")
    trl.inputs["Color"].default_value = (*glow, 1)
    dif = n.new("ShaderNodeBsdfDiffuse")
    dif.inputs["Color"].default_value = (0.78, 0.84, 0.92, 1)
    bm = n.new("ShaderNodeMixShader")
    bm.inputs["Fac"].default_value = 0.22
    l.new(trl.outputs[0], bm.inputs[1])
    l.new(dif.outputs[0], bm.inputs[2])
    ice = principled(n, base=(0.96, 0.98, 1.0), rough=0.05, ior=1.31, trans=1.0)
    see = n.new("ShaderNodeMixShader")
    core = math_node(n, l, "MULTIPLY", math_node(n, l, "SUBTRACT", thick, core_lo, clamp=True), 2.2 * body, clamp=True)
    l.new(core, see.inputs["Fac"])
    l.new(shadow_pass(n, l, ice.outputs[0], tint=(0.95, 0.97, 1.0)).outputs[0], see.inputs[1])
    l.new(bm.outputs[0], see.inputs[2])
    try:
        gl = n.new("ShaderNodeBsdfGlossy")
    except Exception:
        gl = n.new("ShaderNodeBsdfAnisotropic")
    try:
        gl.distribution = "GGX"
    except Exception:
        pass
    setin(gl, "Roughness", 0.04)
    setin(gl, "Color", (1, 1, 1, 1))
    vor = n.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 3200.0
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.5
    l.new(vor.outputs["Distance"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], gl.inputs["Normal"])
    lw = n.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.25
    gmix = n.new("ShaderNodeMixShader")
    edge = math_node(n, l, "MULTIPLY", lw.outputs["Fresnel"], math_node(n, l, "MULTIPLY", at.outputs["Fac"], 3.0, clamp=True))
    l.new(math_node(n, l, "MULTIPLY", edge, sparkle, clamp=True), gmix.inputs["Fac"])
    l.new(see.outputs[0], gmix.inputs[1])
    l.new(gl.outputs[0], gmix.inputs[2])
    l.new(gmix.outputs[0], out.inputs["Surface"])
    return m


def add_label(m, img_file, half_w, half_h, zc, ink, both=True):
    """±Y 면에 라벨(라벨.py 원고의 알파 = 잉크 · 금박 자리). 뒤에서 봐도 글씨가 바로 읽히게 뒷면은 가로를 뒤집는다.
    both=False면 앞(−Y) 면 하나만 — 맑은 유리 병은 뒷면 라벨이 앞에서 거꾸로 비쳐 이름이 두 번 보였다."""
    nt = m.node_tree
    n, l = nt.nodes, nt.links
    out = next(x for x in n if x.type == "OUTPUT_MATERIAL")
    base_out = out.inputs["Surface"].links[0].from_socket
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Object"], sep.inputs["Vector"])
    geo = n.new("ShaderNodeNewGeometry")
    vt = n.new("ShaderNodeVectorTransform")
    vt.vector_type = "NORMAL"
    vt.convert_from = "WORLD"
    vt.convert_to = "OBJECT"
    l.new(geo.outputs["Normal"], vt.inputs["Vector"])
    sn = n.new("ShaderNodeSeparateXYZ")
    l.new(vt.outputs[0], sn.inputs["Vector"])
    face = (math_node(n, l, "GREATER_THAN", math_node(n, l, "ABSOLUTE", sn.outputs["Y"]), 0.9) if both
            else math_node(n, l, "LESS_THAN", sn.outputs["Y"], -0.9))
    flip = math_node(n, l, "MULTIPLY", math_node(n, l, "SIGN", sn.outputs["Y"]), -1.0)
    u = madd(n, l, math_node(n, l, "MULTIPLY", sep.outputs["X"], flip), 0.5 / half_w, 0.5)
    v = madd(n, l, sep.outputs["Z"], 0.5 / half_h, 0.5 - zc * 0.5 / half_h)
    comb = n.new("ShaderNodeCombineXYZ")
    l.new(u, comb.inputs["X"])
    l.new(v, comb.inputs["Y"])
    t = n.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(os.path.join(결정, img_file), check_existing=True)
    t.extension = "CLIP"
    l.new(comb.outputs[0], t.inputs["Vector"])
    # 유리 안쪽에서 닿은 광선(뒷면)엔 잉크를 안 보인다 — 두꺼운 앰플 속에서 라벨 뒷면이 한 번 더 비쳐 이름이 두 번 보였다
    front = math_node(n, l, "SUBTRACT", 1.0, geo.outputs["Backfacing"])
    fac = math_node(n, l, "MULTIPLY", math_node(n, l, "MULTIPLY", t.outputs["Alpha"], face), front)
    mix = n.new("ShaderNodeMixShader")
    l.new(fac, mix.inputs["Fac"])
    l.new(base_out, mix.inputs[1])
    l.new(ink.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs["Surface"])
    return m


def mat_emit(name, rgb, strength):
    m, n, l, out = new_mat(name)
    e = n.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*rgb, 1)
    e.inputs["Strength"].default_value = strength
    l.new(e.outputs[0], out.inputs["Surface"])
    return m


def mat_water():
    m, n, l, out = new_mat("water")
    b = principled(n, base=(1, 1, 1), rough=0.0, ior=1.33, trans=1.0)
    l.new(shadow_pass(n, l, b.outputs[0]).outputs[0], out.inputs["Surface"])
    return m


# ── 도형 ────────────────────────────────────────────────────────────────────
def link(ob):
    bpy.context.collection.objects.link(ob)
    return ob


def mesh_from_arrays(name, verts, quads):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", np.ascontiguousarray(verts, np.float32).ravel())
    me.loops.add(len(quads) * 4)
    me.loops.foreach_set("vertex_index", np.ascontiguousarray(quads, np.int32).ravel())
    me.polygons.add(len(quads))
    me.polygons.foreach_set("loop_start", np.arange(0, len(quads) * 4, 4, dtype=np.int32))
    try:
        me.polygons.foreach_set("loop_total", np.full(len(quads), 4, np.int32))
    except Exception:
        pass
    me.update(calc_edges=True)
    try:
        me.shade_smooth()
    except Exception:
        me.polygons.foreach_set("use_smooth", np.ones(len(quads), bool))
    return me


def frost_sheet(name, h, W, H, y0, hmax, mat, x0=0.0, z0=0.0, sign=1.0):
    """창(XZ 평면, y = y0) 위로 sign 쪽에 서는 서리 높이 판. h(0~1, 행 = 위→아래)가 0보다 큰 칸만 면을 만든다."""
    N0, N1 = h.shape
    f = (h[:-1, :-1] > 0.002) | (h[1:, :-1] > 0.002) | (h[:-1, 1:] > 0.002) | (h[1:, 1:] > 0.002)
    r, c = np.nonzero(f)
    a = r * N1 + c
    quads = np.stack([a, a + 1, a + N1 + 1, a + N1], 1)  # 행이 아래로 늘어 z가 줄어 — 앞(−y)을 보게 감기
    if sign < 0:
        quads = quads[:, ::-1]
    used = np.zeros(N0 * N1, bool)
    used[quads.ravel()] = True
    remap = -np.ones(N0 * N1, np.int64)
    remap[used] = np.arange(used.sum())
    rr, cc = np.divmod(np.nonzero(used)[0], N1)
    hv = h.ravel()[used]
    xs = x0 + (cc / (N1 - 1) - 0.5) * W
    zs = z0 + (0.5 - rr / (N0 - 1)) * H
    ys = y0 + sign * (0.00003 + hv * hmax)
    verts = np.stack([xs, ys, zs], 1)
    me = mesh_from_arrays(name, verts, remap[quads])
    at = me.attributes.new("frost", "FLOAT", "POINT")
    at.data.foreach_set("value", hv.astype(np.float32))
    me.materials.append(mat)
    return link(bpy.data.objects.new(name, me))


def hex_ring(bm, rf, z, rot=0.0):
    R = rf / math.cos(math.pi / 6)
    return [bm.verts.new((R * math.cos(rot + k * math.pi / 3), R * math.sin(rot + k * math.pi / 3), z)) for k in range(6)]


def hex_prism_into(bm, rf, z0, z1, bevel, segs, flip=False, rot=0.0):
    before = set(bm.faces)
    a = hex_ring(bm, rf, z0, rot)
    b = hex_ring(bm, rf, z1, rot)
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    for k in range(6):
        bm.faces.new((a[k], a[(k + 1) % 6], b[(k + 1) % 6], b[k]))
    new_faces = [f for f in bm.faces if f not in before]
    edges = list({e for f in new_faces for e in f.edges})
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=segs, profile=0.5, affect="EDGES", clamp_overlap=True)
    new_faces = [f for f in bm.faces if f not in before]
    if flip:
        bmesh.ops.reverse_faces(bm, faces=new_faces)
    return new_faces


def hex_solid(name, rf, z0, z1, mat=None, bevel=0.0008, segs=3, cavity=None, rot=0.0):
    """육각기둥(맞변 거리 2·rf). cavity=(rf, z0, z1, bevel)이면 속이 빈 두꺼운 유리(속 면은 안쪽을 본다)."""
    bm = bmesh.new()
    hex_prism_into(bm, rf, z0, z1, bevel, segs, rot=rot)
    if cavity:
        hex_prism_into(bm, cavity[0], cavity[1], cavity[2], cavity[3], segs, flip=True, rot=rot)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new(name, me))
    if mat:
        me.materials.append(mat)
    return ob


def revolve(name, prof, segs=96, mat=None):
    bm = bmesh.new()
    rings = []
    for r, z in prof:
        if r <= 0:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z))
                          for i in range(segs)])
    for k in range(len(rings) - 1):
        A, B = rings[k], rings[k + 1]
        if len(A) == 1 and len(B) == 1:
            continue
        if len(A) == 1:
            for i in range(segs):
                bm.faces.new((A[0], B[(i + 1) % segs], B[i]))
        elif len(B) == 1:
            for i in range(segs):
                bm.faces.new((A[i], A[(i + 1) % segs], B[0]))
        else:
            for i in range(segs):
                bm.faces.new((A[i], A[(i + 1) % segs], B[(i + 1) % segs], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = link(bpy.data.objects.new(name, me))
    if mat:
        me.materials.append(mat)
    return ob


def box(name, sx, sy, sz, loc, mat, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=3, profile=0.5, affect="EDGES", clamp_overlap=True)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new(name, me))
    ob.location = Vector(loc)
    me.materials.append(mat)
    return ob


def sphere(name, r, loc, mat, segs=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=max(8, segs // 2), radius=r)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = link(bpy.data.objects.new(name, me))
    ob.location = Vector(loc)
    me.materials.append(mat)
    return ob


def parent_to(children, parent):
    for ch in children:
        ch.parent = parent


def empty(name, loc=(0, 0, 0), rot=(0, 0, 0)):
    e = link(bpy.data.objects.new(name, None))
    e.location = Vector(loc)
    e.rotation_euler = Euler(rot)
    return e


# ── 새 제품(2판 디자인) ───────────────────────────────────────────────────
_RELIEF = {}


def relief_image():
    """제품 뚜껑 · 앰플 앞면의 서리꽃 — 서리결정.py가 푼 결정 하나(macro)를 그대로 새긴다."""
    if "img" in _RELIEF:
        return _RELIEF["img"]
    for nm in (MACRO_SIM, "시험300"):
        p = os.path.join(결정, nm, "macro_height.npy")
        if os.path.exists(p):
            h = np.load(p)
            break
    else:
        yy, xx = np.mgrid[-1:1:256j, -1:1:256j]
        h = np.clip(1 - np.hypot(xx, yy), 0, 1)
    _RELIEF["img"] = height_image("서리꽃_돋을새김", h)
    return _RELIEF["img"]


def ampoule(loc=(0, 0, 0), rot=(0, 0, 0)):
    """육각 두꺼운 유리 앰플 30 ml — 맞변 3.2 cm · 몸통 7.4 cm(벽 3.5 mm · 바닥 12 mm) · 금빛 세럼 76 % ·
    금 목 · 얼음 결정 모양 젖빛 크리스털 캡(육각기둥 + 낮은 뿔). 앞면 위쪽에 서리꽃 돋을새김."""
    e = empty("앰플축", loc, rot)
    rf, H = 0.016, 0.074
    glass = mat_crystal_relief("앰플유리", relief_image(), half=0.0115, axis="Y", center=(0.0, 0.050), field=0.0,
                               pattern=0.35, other=0.0, bump_dist=0.00025)
    # 시청자 시험 「라벨이 없어 3D 견본 같다」 — 앞뒤 면 아래쪽에 흰 잉크 라벨(라벨.py)
    add_label(glass, "라벨_앰플.png", 0.0080, 0.0069, 0.026, principled(glass.node_tree.nodes, base=(0.97, 0.97, 0.96), rough=0.45),
              both=False)
    body = hex_solid("앰플병", rf, 0.0, H, glass, bevel=0.0012, segs=4, cavity=(rf - 0.0035, 0.012, H - 0.004, 0.0015))
    liq_top = 0.012 + (H - 0.016) * 0.76
    serum = hex_solid("앰플액", rf - 0.0033, 0.0118, liq_top, mat_serum(), bevel=0.0014, segs=3)
    gold = mat_gold("금목")
    neck = revolve("앰플목", [(0.0, 0.0), (0.0098, 0.0), (0.0101, 0.0010), (0.0101, 0.0118), (0.0094, 0.0128),
                              (0.0, 0.0128)], mat=gold)
    neck.location = (0, 0, H)
    capm = mat_glass("캡크리스털", rough=0.22, tint=(0.96, 0.98, 1.0))
    cap = hex_solid("앰플캡", 0.0092, 0.0, 0.020, capm, bevel=0.0009, segs=3, rot=math.pi / 6)
    cap.location = (0, 0, H + 0.0128)
    # 캡 위 낮은 육각뿔(얼음 결정 끝)
    bm = bmesh.new()
    R = 0.0092 / math.cos(math.pi / 6)
    ring = [bm.verts.new((R * math.cos(math.pi / 6 + k * math.pi / 3), R * math.sin(math.pi / 6 + k * math.pi / 3), 0.0))
            for k in range(6)]
    tip = bm.verts.new((0, 0, 0.0085))
    for k in range(6):
        bm.faces.new((ring[k], ring[(k + 1) % 6], tip))
    bm.faces.new(ring[::-1])
    me = bpy.data.meshes.new("앰플캡끝")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(capm)
    tipo = link(bpy.data.objects.new("앰플캡끝", me))
    tipo.location = (0, 0, H + 0.0128 + 0.020)
    parts = [body, serum, neck, cap, tipo]
    parent_to(parts, e)
    return e, parts


def cream_jar(loc=(0, 0, 0), rot=(0, 0, 0)):
    """육각 두꺼운 유리 크림 단지 50 ml — 맞변 6.6 cm · 높이 4.4 cm(벽 6 mm · 바닥 14 mm) · 진주빛 크림 · 금 띠 ·
    젖빛 크리스털 뚜껑(1.8 cm) 윗면에 서리꽃 돋을새김(맑게 깎인 결)."""
    e = empty("단지축", loc, rot)
    rf, H = 0.033, 0.044
    # 맑은 유리 속 크림이 두 시험 모두 「유리 속 흰 상자」로 읽혀 — 몸통을 깊은 밤 남색 불투명 유리(겉칠 광택)로,
    # 흰 크리스털 뚜껑 · 금 띠와 대비. 크림은 뚜껑을 열 때만 보인다
    glass = mat_simple("단지유리", base=(0.020, 0.034, 0.110), rough=0.06, coat=1.0, coat_rough=0.02, sss=0.15,
                       sss_r=(0.004, 0.006, 0.02), spec=0.6)
    add_label(glass, "라벨_단지.png", 0.0165, 0.0095, 0.022, principled(glass.node_tree.nodes, base=GOLD, metal=1.0, rough=0.22))
    jar = hex_solid("단지", rf, 0.0, H, glass, bevel=0.0018, segs=4, cavity=(rf - 0.006, 0.014, H - 0.003, 0.002))
    cream = hex_solid("크림", rf - 0.0058, 0.0138, H - 0.0045, mat_cream(), bevel=0.002, segs=3)
    band = hex_solid("금띠", rf + 0.0002, H, H + 0.0026, mat_gold("금띠"), bevel=0.0004, segs=2)
    lidm = mat_crystal_relief("단지뚜껑", relief_image(), half=0.030, axis="Z", field=0.42, pattern=0.02, other=0.10,
                              bump_dist=0.0005)
    lid = hex_solid("단지뚜껑", rf + 0.0006, H + 0.0026, H + 0.0026 + 0.018, lidm, bevel=0.0022, segs=4)
    parts = [jar, cream, band, lid]
    parent_to(parts, e)
    return e, parts


def gift_case(loc=(0, 0, 0), rot=(0, 0, 0), closed=True):
    """육각 선물 상자(맞변 20 cm · 높이 9 cm) — 밤 남색 무광 판지, 뚜껑 윗면에 금박 서리꽃, 흰 실크 띠 하나 · 금 육각 봉인."""
    e = empty("상자축", loc, rot)
    rf, H = 0.10, 0.09
    m, n, l, out = new_mat("상자남색")
    b = principled(n, base=(0.018, 0.026, 0.060), rough=0.62, sheen=0.25, sheen_tint=(0.4, 0.5, 0.8))
    l.new(b.outputs[0], out.inputs["Surface"])
    body = hex_solid("상자", rf, 0.0, H, m, bevel=0.0015, segs=3)
    # 뚜껑 윗면 금박: 같은 서리꽃 그림을 금속 마스크로
    m2, n2, l2, out2 = new_mat("상자뚜껑")
    tc = n2.new("ShaderNodeTexCoord")
    sep = n2.new("ShaderNodeSeparateXYZ")
    l2.new(tc.outputs["Object"], sep.inputs["Vector"])
    u = madd(n2, l2, sep.outputs["X"], 0.5 / 0.085, 0.5)
    v = madd(n2, l2, sep.outputs["Y"], 0.5 / 0.085, 0.5)
    comb = n2.new("ShaderNodeCombineXYZ")
    l2.new(u, comb.inputs["X"])
    l2.new(v, comb.inputs["Y"])
    t = n2.new("ShaderNodeTexImage")
    t.image = relief_image()
    t.extension = "CLIP"
    l2.new(comb.outputs[0], t.inputs["Vector"])
    foil = math_node(n2, l2, "GREATER_THAN", t.outputs["Color"], 0.05)
    paper = principled(n2, base=(0.018, 0.026, 0.060), rough=0.62)
    gold = principled(n2, base=GOLD, metal=1.0, rough=0.22)
    mx = n2.new("ShaderNodeMixShader")
    l2.new(foil, mx.inputs["Fac"])
    l2.new(paper.outputs[0], mx.inputs[1])
    l2.new(gold.outputs[0], mx.inputs[2])
    l2.new(mx.outputs[0], out2.inputs["Surface"])
    lid = hex_solid("상자뚜껑", rf + 0.0015, H - 0.03, H + 0.002, m2, bevel=0.0015, segs=3)
    silk = mat_simple("실크띠", base=(0.93, 0.92, 0.90), rough=0.32, sheen=0.6, sheen_rough=0.3)
    band = box("실크띠", 0.026, 2 * (rf + 0.0025) / math.cos(math.pi / 6) * 0.9, 0.0008, (0, 0, H + 0.0026), silk)
    band2 = box("실크띠옆", 0.026, 0.0008, 0.034, (0, -(rf + 0.0024), H - 0.014), silk)
    seal = hex_solid("봉인", 0.012, H + 0.003, H + 0.0042, mat_gold("봉인", 0.25), bevel=0.0004, segs=2)
    parts = [body, lid, band, band2, seal]
    if not closed:
        # 연 상자: 띠 · 봉인은 풀어 치우고 뚜껑은 뒤로 기대 세운다
        for ob in (band, band2, seal):
            bpy.data.objects.remove(ob, do_unlink=True)
        parts = [body, lid]
        lid.rotation_euler = (math.radians(72), 0.0, 0.0)
        lid.location = (0.0, -rf * 1.05, -H * 0.62)  # 상자 뒤(−y, 창 쪽)로 — 앞으로 기대면 방 안 카메라에서 제품을 가렸다
    parent_to(parts, e)
    return e, parts


# ── 장면 거리 ────────────────────────────────────────────────────────────────
def load_sim(name, mode):
    d = os.path.join(결정, name)
    arr = np.load(os.path.join(d, f"{mode}_arrival.npy"))
    h = np.load(os.path.join(d, f"{mode}_height.npy"))
    return arr, h


def grown(arr, h, t, soft=0.06):
    """지금 시각 t까지 자란 가지 — 막 자란 끝은 얇게 솟고(가지 끝이 가늘다) 시간이 지나며 굵어진다."""
    age = np.clip((t - arr) / soft, 0.0, 1.0)
    return (h * np.sqrt(age)).astype(np.float32)


def base_frost(shape, seed, level=0.3, grain=3.0):
    """서리 바탕(창 전체를 덮는 잔 서리) — 고운 잡음."""
    from numpy.random import default_rng
    rng = default_rng(seed)
    z = rng.random(shape).astype(np.float32)
    k = int(max(1, grain))
    # 작은 상자 흐림 두 번
    for _ in range(2):
        z = (np.roll(z, k, 0) + np.roll(z, -k, 0) + np.roll(z, k, 1) + np.roll(z, -k, 1) + z) / 5.0
    z = (z - z.min()) / max(1e-6, z.max() - z.min())
    return (level * (0.55 + 0.45 * z)).astype(np.float32)


def snow_flakes(n, region, rmin, rmax, seed=3, mat=None):
    rng = random.Random(seed)
    mat = mat or mat_simple("눈송이", base=(0.95, 0.97, 1.0), rough=0.4, sss=0.4, sss_r=(0.01, 0.01, 0.012))
    (x0, x1), (y0, y1), (z0, z1) = region
    obs = []
    for i in range(n):
        obs.append(sphere(f"눈{i}", rng.uniform(rmin, rmax), (rng.uniform(x0, x1), rng.uniform(y0, y1), rng.uniform(z0, z1)),
                          mat, segs=10))
    return obs


def bokeh(n, region, rgb_list, strength, rmin, rmax, seed=9):
    rng = random.Random(seed)
    (x0, x1), (y0, y1), (z0, z1) = region
    mats = [mat_emit(f"보케{i}", c, strength) for i, c in enumerate(rgb_list)]
    for i in range(n):
        sphere(f"보케{i}", rng.uniform(rmin, rmax), (rng.uniform(x0, x1), rng.uniform(y0, y1), rng.uniform(z0, z1)),
               mats[i % len(mats)], segs=12)


def bokeh_in_view(cam_loc, tgt, n, dmin, dmax, spread, rgb_list, strength, rmin, rmax, seed=9):
    """카메라가 보는 쪽(카메라 → 겨냥점 줄의 연장) 뒤 dmin~dmax 거리에 흐린 전구 — 화면 안에 들게."""
    rng = random.Random(seed)
    cam_loc, tgt = Vector(cam_loc), Vector(tgt)
    d = (tgt - cam_loc).normalized()
    side = d.cross(Vector((0, 0, 1))).normalized()
    up = side.cross(d).normalized()
    mats = [mat_emit(f"전구{i}", c, strength) for i, c in enumerate(rgb_list)]
    for i in range(n):
        dist = rng.uniform(dmin, dmax)
        p = tgt + d * dist + side * rng.uniform(-spread, spread) * dist * 0.35 + up * rng.uniform(-spread, spread) * dist * 0.6
        sphere(f"전구{i}", rng.uniform(rmin, rmax), p, mats[i % len(mats)], segs=12)


# 창: 유리 판 가운데 y = 0, 안(방) = +y, 밖 = −y. 서리는 안쪽 면(y = +GL/2)에서 방 쪽으로 선다.
GL = 0.004
PANE_W, PANE_H = 0.62, 1.00
SILL_Z = 0.0  # 창 아래 틀 윗면(안쪽 창턱 높이)


def window_frame(paint=(0.020, 0.026, 0.045), outer_snow=True):
    pm = mat_simple("창틀", base=paint, rough=0.42, coat=0.3, coat_rough=0.25)
    fw = 0.065
    z0, z1 = SILL_Z, SILL_Z + PANE_H
    box("틀왼", fw, 0.10, PANE_H + 2 * fw, (-PANE_W / 2 - fw / 2, 0.01, (z0 + z1) / 2), pm, bevel=0.004)
    box("틀오른", fw, 0.10, PANE_H + 2 * fw, (PANE_W / 2 + fw / 2, 0.01, (z0 + z1) / 2), pm, bevel=0.004)
    box("틀위", PANE_W + 2 * fw, 0.10, fw, (0, 0.01, z1 + fw / 2), pm, bevel=0.004)
    box("틀아래", PANE_W + 2 * fw, 0.10, fw, (0, 0.01, z0 - fw / 2), pm, bevel=0.004)
    # 안쪽 창턱(제품이 서는 자리)과 바깥 턱
    box("안창턱", PANE_W + 2 * fw + 0.12, 0.32, 0.03, (0, 0.06 + 0.16, z0 - 0.015), pm, bevel=0.003)
    box("밖턱", PANE_W + 2 * fw + 0.08, 0.16, 0.025, (0, -0.10, z0 - fw - 0.0125), pm, bevel=0.003)
    if outer_snow:
        sn = mat_simple("턱눈", base=(0.92, 0.95, 1.0), rough=0.6, sss=0.6, sss_r=(0.02, 0.02, 0.025))
        s = box("턱눈", PANE_W + 2 * fw + 0.06, 0.15, 0.03, (0, -0.10, z0 - fw + 0.012), sn, bevel=0.012)
        mod = s.modifiers.new("결", "DISPLACE")
        tex = bpy.data.textures.new("눈결", "CLOUDS")
        tex.noise_scale = 0.03
        mod.texture = tex
        mod.strength = 0.012
        sub = s.modifiers.new("잘게", "SUBSURF")
        sub.levels = 3
        sub.render_levels = 3
        s.modifiers.move(1, 0)
    return pm


def glass_pane():
    return box("유리", PANE_W, GL, PANE_H, (0, 0, SILL_Z + PANE_H / 2), mat_glass("창유리", rough=0.0))


def window_frost(t=1.0, melt=None, letters=None, base_level=0.05, hmax=0.0007, glow=(1.0, 0.86, 0.62), seed=4, rim=None):
    """창 서리 — window 시뮬레이션을 창 높이에 맞춰 세운다(정사각 시뮬레이션의 가운데를 창 폭만큼).
    melt=(x, z, R) 이면 그 둘레가 녹아 맑은 유리 · letters=마스크(창 칸과 같은 꼴)면 그 자리를 손가락으로 닦은 자국."""
    try:
        arr, h = load_sim(WINDOW_SIM, "window")
    except Exception:
        arr, h = load_sim("window768", "window")
    N = h.shape[0]
    g = grown(arr, h, t)
    rng = np.random.default_rng(seed + 100)
    grain = rng.random(g.shape).astype(np.float32)
    grain = (grain + np.roll(grain, 1, 0) + np.roll(grain, 1, 1)) / 3.0
    g = g * (0.62 + 0.38 * grain)
    g = np.maximum(g, base_frost(g.shape, seed, base_level, grain=max(1, N // 512)))
    cw = int(round(N * PANE_W / PANE_H))
    c0 = (N - cw) // 2
    g = g[:, c0:c0 + cw]
    if melt is not None:
        mx, mz, R = melt
        rr, cc = np.mgrid[0:g.shape[0], 0:g.shape[1]]
        xs = (cc / (g.shape[1] - 1) - 0.5) * PANE_W
        zs = SILL_Z + (0.5 - rr / (g.shape[0] - 1)) * PANE_H + PANE_H / 2
        ang = np.arctan2(zs - mz, xs - mx)
        rnd = random.Random(seed)
        wob = sum(rnd.uniform(0.01, 0.03) * np.sin(k * ang + rnd.uniform(0, 6.28)) for k in (3, 5, 8, 13))
        d = np.hypot(xs - mx, zs - mz) / R - 1.0 - wob
        fade = np.clip((d + 0.02) / 0.12, 0.0, 1.0)
        g = g * (fade ** 1.5)
    if letters is not None:
        ri = (np.arange(g.shape[0]) * letters.shape[0] // g.shape[0]).astype(int)
        ci = (np.arange(g.shape[1]) * letters.shape[1] // g.shape[1]).astype(int)
        if letters.shape != g.shape:  # 다른 크기의 서리 시뮬레이션(1536칸 등)에 맞춰 글자 지도를 다시 짚는다
            letters = letters[ri][:, ci]
        g = g * (1.0 - letters)
        if rim is not None:  # 손끝이 밀어낸 서리 둔덕 — 획 바깥 테가 조금 두껍고 하얗다
            if rim.shape != g.shape:
                rim = rim[ri][:, ci]
            g = np.maximum(g, np.clip(g + rim * 0.45, 0, 1) * (1.0 - letters))
    frost = frost_sheet("서리", g, PANE_W, PANE_H, GL / 2, hmax, mat_frost(glow=glow), z0=SILL_Z + PANE_H / 2)
    return frost, g


def melt_beads(mx, mz, R, n=260, seed=17):
    """녹은 둘레의 물방울 — 서리가 물이 되어 맺힌 자리."""
    rng = random.Random(seed)
    wm = mat_water()
    obs = []
    for i in range(n):
        a = rng.uniform(0, 2 * math.pi)
        rr = R * rng.uniform(0.93, 1.06)
        r = rng.uniform(0.0004, 0.0018) * (1.4 if rng.random() < 0.08 else 1.0)  # 굵은 방울 테가 「얼룩 점」으로 읽혔다(시청자 시험)
        x, z = mx + rr * math.cos(a), mz + rr * math.sin(a)
        if abs(x) > PANE_W / 2 - 0.01 or not (SILL_Z + 0.01 < z < SILL_Z + PANE_H - 0.01):
            continue
        s = sphere(f"물방울{i}", r, (x, GL / 2 + r * 0.35, z), wm, segs=12)
        s.scale = (1.0, 0.55, 1.0 + rng.uniform(0, 0.4))
        obs.append(s)
    return obs


def letters_mask(name):
    """창에 손가락으로 쓴 말 — 손글씨.py(바깥 파이썬, 우리 글꼴)가 만든 닦인 자국 지도. 블렌더 안에는 PIL이 없다."""
    return np.load(os.path.join(결정, f"글자_{name}.npy"))


def letters_rim(name):
    p = os.path.join(결정, f"글자_{name}_테.npy")
    return np.load(p) if os.path.exists(p) else None


def interior_room(warm=(1.0, 0.72, 0.42), n_bokeh=60, strength=5.0, wall_light=18.0):
    """창 안쪽 따뜻한 방 — 어두운 벽에 작은 금빛 전구 줄 · 벽에 고인 등불 빛. 창을 곧장 비추는 큰 빛은 두지 않는다
    (첫 시험에서 큰 면광이 젖빛 서리 너머 흰 원판으로 비쳐 창 전체가 종이처럼 떴다)."""
    bokeh(n_bokeh, ((-1.8, 1.8), (1.6, 4.6), (SILL_Z - 0.3, SILL_Z + 1.5)),
          [(1.0, 0.62, 0.26), (1.0, 0.74, 0.40), (1.0, 0.52, 0.18), (1.0, 0.84, 0.58)], strength, 0.004, 0.011, seed=21)
    wall = mat_simple("방벽", base=(0.20, 0.11, 0.06), rough=0.9)
    box("방벽", 6.0, 0.05, 4.0, (0, 5.0, SILL_Z + 1.0), wall)
    box("방바닥", 6.0, 5.0, 0.05, (0, 2.6, SILL_Z - 0.75), mat_simple("방바닥", base=(0.10, 0.055, 0.03), rough=0.7))
    lamp = hide_from_camera(area_light("벽빛", (0.7, 3.8, SILL_Z + 1.3), (0.5, 5.0, SILL_Z + 0.5), wall_light, 0.9, rgb=warm))
    lamp2 = hide_from_camera(area_light("벽빛2", (-1.1, 4.0, SILL_Z + 0.1), (-1.1, 5.0, SILL_Z + 0.7), wall_light * 0.6, 0.6,
                                        rgb=(1.0, 0.60, 0.28)))
    return lamp


def frost_glow(frost, energy=6.0, warm=(1.0, 0.80, 0.52), cool=1.5):
    """서리만 받는 빛 — 방 쪽에서 창 서리를 비스듬히 비춰 등뼈가 금빛으로 빛나고, 밖의 찬 빛이 가지 모서리를 은빛으로."""
    g = hide_from_camera(area_light("서리금빛", (0.0, 0.55, SILL_Z + 0.15), (0.0, 0.0, SILL_Z + 0.55), energy, 0.8, rgb=warm))
    c = hide_from_camera(area_light("서리은빛", (-0.6, -0.5, SILL_Z + 1.3), (0.0, 0.0, SILL_Z + 0.5), cool, 0.5,
                                    rgb=(0.62, 0.76, 1.0)))
    light_only(g, [frost])
    light_only(c, [frost])


def outside_night(strength=0.06):
    world_color((0.010, 0.020, 0.055), strength)
    moon = area_light("달빛", (-1.2, -2.2, SILL_Z + 2.4), (0, 0, SILL_Z + 0.5), 60.0, 1.2, rgb=(0.62, 0.74, 1.0))
    return moon


def hide_from_camera(ob, glossy=True):
    try:
        ob.visible_camera = False
        ob.visible_transmission = False  # 유리 너머로 보는 빛은 카메라 광선이 아니라 투과 광선 — 창 너머 흰 원판으로 떴다
        if not glossy:
            ob.visible_glossy = False  # 유리에 비친 흰 판이 닦인 글씨 속에 하얗게 떴다(창에 쓴 말 시험)
    except Exception:
        pass
    return ob


def scene_a1():
    """서리 결정이 자라는 접사 — 유리 안쪽 면의 결정 하나(macro 시뮬레이션)를 밖에서 유리 너머로. 결정은 찬 은빛,
    뒤는 어두운 방의 금빛 전구(안은 따뜻하고 밖은 찬 — 이 편의 두 온도)."""
    arr, h = load_sim(MACRO_SIM, "macro")
    g = grown(arr, h, TGROW, soft=0.05)
    S = 0.032  # 결정 지도 한 변 3.2 cm
    world_color((0.004, 0.007, 0.020), 0.03)
    box("유리", 0.20, GL, 0.20, (0, 0, 0), mat_glass("창유리"))
    frost_sheet("결정", g, S, S, GL / 2, 0.00022, mat_frost(glow=(1.0, 0.93, 0.84), body=0.6, sparkle=1.6), z0=0.0)
    box("방어둠", 3.0, 0.05, 3.0, (0, 2.6, 0), mat_simple("방어둠", base=(0.03, 0.02, 0.015), rough=0.9))
    tgt = Vector((0.0, GL / 2, 0.0))
    loc = tgt + Vector((math.sin(math.radians(16)) * 0.080, -math.cos(math.radians(16)) * 0.080, 0.014))
    bokeh_in_view(loc, tgt, 14, 0.5, 1.6, 0.6, [(1.0, 0.62, 0.26), (1.0, 0.76, 0.42), (1.0, 0.52, 0.20)], 2.6,
                  0.006, 0.018, seed=5)
    back = hide_from_camera(area_light("뒤빛", (0.05, 0.30, 0.10), (0, 0, 0), 1.6, 0.20, rgb=(1.0, 0.74, 0.44)))
    rim = area_light("찬빛", (-0.14, -0.05, 0.10), (0, 0, 0), 3.2, 0.03, rgb=(0.60, 0.74, 1.0))
    glint = area_light("결빛", (0.10, -0.03, -0.09), (0, 0, 0), 1.0, 0.015, rgb=(1.0, 0.90, 0.75))
    camera(loc, tgt, lens=100, fstop=14, focus=(tgt - loc).length)


def scene_a2():
    """서리꽃이 창을 덮어 감 — 눈 오는 밤 밖에서 창 윗부분을 가까이. 가장자리부터 고사리처럼 뻗은 서리가 방의 금빛을 받아
    빛나고, 서리 사이로 따뜻한 방의 전구가 보인다(넓은 창 전체는 아래 겹친 서리가 흰 덩이로 날아 이 구도로 바꿈)."""
    window_frame()
    glass_pane()
    frost, _ = window_frost(t=TGROW if "--t" in argv else 1.0, base_level=0.02, hmax=0.0009)
    frost.data.materials[0] = mat_frost("서리2", glow=(1.0, 0.84, 0.58), body=0.30, sparkle=2.2)
    g = hide_from_camera(area_light("서리금빛", (-0.10, 0.45, SILL_Z + 0.40), (-0.16, 0.0, SILL_Z + 0.55), 7.0, 0.6,
                                    rgb=(1.0, 0.80, 0.52)))
    c = hide_from_camera(area_light("서리은빛", (-0.6, -0.5, SILL_Z + 1.4), (0.0, 0.0, SILL_Z + 0.75), 1.8, 0.5,
                                    rgb=(0.62, 0.76, 1.0)))
    light_only(g, [frost])
    light_only(c, [frost])
    outside_night(0.03)
    interior_room()
    snow_flakes(70, ((-0.35, 0.35), (-0.42, -0.12), (SILL_Z + 0.45, SILL_Z + 1.05)), 0.0010, 0.0030, seed=8)
    camera((-0.08, -0.52, SILL_Z + 0.58), (-0.15, 0.0, SILL_Z + 0.56), lens=45, fstop=2.8, focus=0.52)


def scene_a3():
    """온기로 녹은 동그라미 — 안에서 손이 닿은 자리부터 서리가 녹아 맑은 유리 너머로 창턱의 선물이 또렷하다."""
    mx, mz, R = 0.0, SILL_Z + 0.105, 0.105
    window_frame()
    glass_pane()
    frost, _ = window_frost(t=1.0, melt=(mx, mz, R), base_level=0.03, hmax=0.0009)
    frost.data.materials[0] = mat_frost("서리3", glow=(1.0, 0.84, 0.58), body=0.32, sparkle=2.0)
    frost_glow(frost, energy=2.6)
    melt_beads(mx, mz, R)
    outside_night(0.03)
    interior_room()
    jar_e, jp = cream_jar((0.042, 0.15, SILL_Z), (0, 0, math.radians(14)))
    amp_e, ap = ampoule((-0.038, 0.12, SILL_Z), (0, 0, math.radians(-16)))
    key = hide_from_camera(area_light("제품키", (-0.25, 0.40, SILL_Z + 0.38), (0.0, 0.14, SILL_Z + 0.05), 12.0, 0.30,
                                      rgb=(1.0, 0.82, 0.58)))
    rim = hide_from_camera(area_light("제품뒤", (0.18, 0.48, SILL_Z + 0.20), (0.0, 0.14, SILL_Z + 0.05), 18.0, 0.20,
                                      rgb=(1.0, 0.70, 0.40)))
    front = hide_from_camera(area_light("제품앞", (0.10, -0.45, SILL_Z + 0.20), (0.0, 0.13, SILL_Z + 0.04), 4.0, 0.25,
                                        rgb=(0.92, 0.94, 1.0)))
    for lt in (key, rim, front):
        light_only(lt, jp + ap)
    snow_flakes(80, ((-0.3, 0.3), (-0.50, -0.12), (SILL_Z - 0.05, SILL_Z + 0.45)), 0.0008, 0.0028, seed=12)
    camera((0.0, -0.66, SILL_Z + 0.185), (0.0, 0.12, SILL_Z + 0.165), lens=50, fstop=3.5, focus=0.78)


def scene_a4():
    """끝 그림 — 방 안에서 본 창턱의 두 제품. 뒤 창의 서리꽃은 밖의 찬 달빛과 방의 금빛을 받아 레이스처럼 빛나고
    (틈으로는 짙은 남색 밤), 방의 따뜻한 빛이 제품을 감싼다. 위쪽 서리 자리에 끝 줄 · 이름이 앉는다(시안글.py)."""
    window_frame(paint=(0.06, 0.05, 0.05))
    glass_pane()
    frost, _ = window_frost(t=1.0, glow=(0.70, 0.82, 1.0), base_level=0.03, hmax=0.0009, seed=8)
    frost.data.materials[0] = mat_frost("서리끝", glow=(0.74, 0.84, 1.0), body=0.5, sparkle=2.0)
    world_color((0.006, 0.012, 0.035), 0.03)
    sky = box("밖하늘", 3.0, 0.02, 2.4, (0, -1.6, SILL_Z + 0.6), mat_emit("밤하늘", (0.10, 0.16, 0.40), 0.22))
    bokeh(14, ((-1.5, 1.5), (-5.5, -2.5), (SILL_Z - 0.2, SILL_Z + 1.2)), [(1.0, 0.78, 0.45), (0.85, 0.9, 1.0)], 2.0,
          0.012, 0.03, seed=31)
    moon = hide_from_camera(area_light("서리달빛", (-0.3, -0.6, SILL_Z + 0.9), (0.0, 0.0, SILL_Z + 0.45), 9.0, 0.8,
                                       rgb=(0.62, 0.76, 1.0)))
    warmf = hide_from_camera(area_light("서리금", (0.25, 0.45, SILL_Z + 0.55), (0.0, 0.0, SILL_Z + 0.35), 2.2, 0.6,
                                        rgb=(1.0, 0.78, 0.48)))
    light_only(moon, [frost])
    light_only(warmf, [frost])
    jar_e, jp = cream_jar((0.024, 0.11, SILL_Z), (0, 0, math.radians(-8)))
    amp_e, ap = ampoule((-0.040, 0.090, SILL_Z), (0, 0, math.radians(22 + 180)))  # 방 안 카메라 쪽으로 라벨
    card = hide_from_camera(area_light("반사판", (0.20, 0.42, SILL_Z + 0.10), (0.02, 0.10, SILL_Z + 0.03), 3.0, 0.06,
                                       rgb=(1.0, 0.90, 0.78), size_y=0.40))
    key = hide_from_camera(area_light("제품키", (0.30, 0.52, SILL_Z + 0.32), (0.0, 0.09, SILL_Z + 0.05), 16.0, 0.35,
                                      rgb=(1.0, 0.80, 0.55)))
    fill = hide_from_camera(area_light("보조", (-0.35, 0.48, SILL_Z + 0.14), (0.0, 0.09, SILL_Z + 0.05), 4.0, 0.40,
                                       rgb=(1.0, 0.88, 0.70)))
    rim = hide_from_camera(area_light("금테", (-0.02, -0.02, SILL_Z + 0.30), (0.0, 0.09, SILL_Z + 0.06), 7.0, 0.25,
                                      rgb=(1.0, 0.86, 0.6)))
    for lt in (key, fill, rim, card):
        light_only(lt, jp + ap)
    sill = mat_simple("창턱면", base=(0.05, 0.04, 0.035), rough=0.25, coat=0.6, coat_rough=0.08)
    box("창턱면", 0.9, 0.30, 0.004, (0, 0.17, SILL_Z - 0.002), sill)
    camera((0.030, 0.56, SILL_Z + 0.110), (0.018, 0.06, SILL_Z + 0.150), lens=46, fstop=2.8, focus=0.47)


def ice_material(name="얼음", rough=0.01):
    m, n, l, out = new_mat(name)
    b = principled(n, base=(0.97, 0.99, 1.0), rough=rough, ior=1.31, trans=1.0)
    geo = n.new("ShaderNodeNewGeometry")
    # 모서리는 서리(거칠게)
    edge = math_node(n, l, "MULTIPLY", math_node(n, l, "SUBTRACT", geo.outputs["Pointiness"], 0.5, clamp=True), 2.5,
                     clamp=True)
    l.new(madd(n, l, edge, 0.35, rough), b.inputs["Roughness"])
    v = n.new("ShaderNodeVolumeAbsorption")
    v.inputs["Color"].default_value = (0.86, 0.94, 1.0, 1)
    v.inputs["Density"].default_value = 1.2
    l.new(shadow_pass(n, l, b.outputs[0], tint=(0.9, 0.95, 1.0)).outputs[0], out.inputs["Surface"])
    l.new(v.outputs[0], out.inputs["Volume"])
    return m


def voronoi_shards(sx, sy, sz, n, seed=3, inset=0.0012):
    """얼음 덩어리를 보로노이 조각으로 — 씨앗마다 다른 씨앗과의 수직 이등분면으로 상자를 잘라 볼록 조각을 만든다."""
    rng = random.Random(seed)
    pts = [Vector((rng.uniform(-sx / 2, sx / 2), rng.uniform(-sy / 2, sy / 2), rng.uniform(-sz / 2, sz / 2))) for _ in range(n)]
    shards = []
    for i, p in enumerate(pts):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
        for j, q in enumerate(pts):
            if i == j:
                continue
            mid = (p + q) / 2
            nrm = (q - p).normalized()
            geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
            res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=mid - nrm * inset, plane_no=nrm, clear_outer=True)
            new_edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
            if new_edges:
                try:
                    bmesh.ops.contextual_create(bm, geom=new_edges)
                except Exception:
                    bmesh.ops.edgeloop_fill(bm, edges=new_edges)
        if len(bm.verts) < 4:
            bm.free()
            continue
        c = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
        for v in bm.verts:
            v.co -= c
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        shards.append((c, bm))
    return shards


def scene_b1():
    """얼음에 갇힌 선물 — 맑은 얼음 덩어리 속에 두 제품이 멈춰 있다. 기포 · 모서리 서리 · 금빛 역광."""
    world_color((0.004, 0.008, 0.020), 0.05)
    floor = box("바닥", 3.0, 3.0, 0.02, (0, 0, -0.01),
                mat_simple("검은바닥", base=(0.004, 0.005, 0.008), rough=0.95, spec=0.0))
    ice = box("얼음덩어리", 0.20, 0.15, 0.20, (0, 0, 0.1002), ice_material(), bevel=0.006)
    sub = ice.modifiers.new("결", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 2
    sub.subdivision_type = "SIMPLE"
    dm = ice.modifiers.new("울퉁", "DISPLACE")
    tx = bpy.data.textures.new("얼음결", "CLOUDS")
    tx.noise_scale = 0.05
    dm.texture = tx
    dm.strength = 0.0015
    rng = random.Random(5)
    air = mat_glass("기포", rough=0.0, ior=1.0 / 1.31)
    k = 0
    for st in range(9):  # 얼 때 갇힌 기포 줄기 — 아래에서 위로 가늘게
        x0, y0 = rng.uniform(-0.07, 0.07), rng.uniform(-0.05, 0.05)
        for j in range(rng.randint(14, 30)):
            z = 0.02 + j * rng.uniform(0.004, 0.007)
            if z > 0.18:
                break
            r = rng.uniform(0.0003, 0.0011) * (1.0 - z / 0.25)
            sphere(f"기포{k}", r, (x0 + rng.gauss(0, 0.002), y0 + rng.gauss(0, 0.002), z), air, segs=8)
            k += 1
    jar_e, jp = cream_jar((0.032, 0.0, 0.028), (math.radians(4), math.radians(-6), math.radians(18)))
    amp_e, ap = ampoule((-0.038, 0.005, 0.040), (math.radians(-5), math.radians(9), math.radians(-24)))
    back = area_light("금역광", (0.05, 0.60, 0.35), (0, 0, 0.1), 80.0, 0.35, rgb=(1.0, 0.70, 0.36))
    key = area_light("찬키", (-0.55, -0.40, 0.45), (0, 0, 0.1), 40.0, 0.5, rgb=(0.70, 0.82, 1.0))
    top = area_light("윗빛", (0.0, -0.05, 0.75), (0, 0, 0.1), 25.0, 0.3, rgb=(1.0, 0.95, 0.9))
    bokeh(16, ((-1.2, 1.2), (1.2, 3.0), (0.0, 0.8)), [(1.0, 0.72, 0.38), (1.0, 0.85, 0.6)], 6.0, 0.01, 0.03, seed=8)
    camera((0.26, -0.78, 0.23), (0.0, 0.0, 0.10), lens=60, fstop=5.6)


def scene_b2():
    """깨지는 순간이 멈춘 1초 — 얼음 조각 · 금빛 세럼 방울이 공중에 멈추고 두 제품이 가운데 떠 있다."""
    world_color((0.004, 0.008, 0.020), 0.05)
    box("바닥", 3.0, 3.0, 0.02, (0, 0, -0.01),
        mat_simple("검은바닥", base=(0.004, 0.005, 0.008), rough=0.95, spec=0.0))
    im = ice_material("얼음조각")
    rng = random.Random(11)
    for k, (c, bm) in enumerate(voronoi_shards(0.20, 0.15, 0.20, 34, seed=4)):
        me = bpy.data.meshes.new(f"조각{k}")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(im)
        ob = link(bpy.data.objects.new(f"조각{k}", me))
        dirv = c.normalized() if c.length > 1e-6 else Vector((0, 0, 1))
        push = 1.0 + rng.uniform(1.2, 2.6)
        pos = c * push + dirv * rng.uniform(0.02, 0.06) + Vector((0, 0, 0.13))
        if abs(pos.x) < 0.07 and abs(pos.y) < 0.07 and 0.04 < pos.z < 0.22:
            pos += dirv * 0.09
        ob.location = pos
        ob.rotation_euler = (rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6))
    serum = mat_serum()
    for i in range(60):
        r = rng.uniform(0.0022, 0.0070)
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0.2, 1))).normalized()
        pos = Vector((0, 0, 0.13)) + d * rng.uniform(0.07, 0.24)
        s = sphere(f"방울{i}", r, pos, serum, segs=16)
        s.scale = (1.0, 1.0, rng.uniform(1.0, 1.9))
        s.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    jar_e, jp = cream_jar((0.040, 0.0, 0.085), (math.radians(10), math.radians(-14), math.radians(24)))
    amp_e, ap = ampoule((-0.040, -0.01, 0.110), (math.radians(-12), math.radians(16), math.radians(-30)))
    back = area_light("금역광", (0.05, 0.70, 0.40), (0, 0, 0.13), 120.0, 0.35, rgb=(1.0, 0.70, 0.36))
    key = area_light("찬키", (-0.60, -0.45, 0.50), (0, 0, 0.13), 50.0, 0.5, rgb=(0.70, 0.82, 1.0))
    top = area_light("윗빛", (0.10, -0.10, 0.85), (0, 0, 0.13), 30.0, 0.3, rgb=(1.0, 0.95, 0.9))
    bokeh(20, ((-1.2, 1.2), (1.2, 3.0), (0.0, 0.8)), [(1.0, 0.72, 0.38), (1.0, 0.85, 0.6)], 6.0, 0.01, 0.03, seed=8)
    camera((0.24, -0.62, 0.22), (0.0, 0.0, 0.13), lens=55, fstop=5.0)


def street_outside(dawn=True):
    """닦인 글씨 너머로 보이는 바깥 — 건너편 집들의 그림자와 불 켠 창. 방 안 카메라에서 글씨를 지나는 시선이 건너편
    4~5 m에서 약 1 m 높이에 닿아, 창불 · 지붕도 그 높이에 둔다(첫 판은 글씨 아래쪽에 검은 건물만 비쳐 「그림자 진 글자」로 읽혔다)."""
    rng = random.Random(51)
    dark = mat_simple("건너집", base=(0.12, 0.14, 0.20) if dawn else (0.010, 0.012, 0.022), rough=0.9)
    for i in range(7):
        w, h = rng.uniform(0.8, 1.6), rng.uniform(1.0, 2.0)
        x = -2.6 + i * 0.85 + rng.uniform(-0.2, 0.2)
        box(f"건너집{i}", w, 0.4, h, (x, -4.2 - rng.uniform(0, 1.2), SILL_Z - 0.4 + h / 2), dark)
    lit = mat_emit("건너창", (1.0, 0.72, 0.40), 2.0 if dawn else 6.0)
    for i in range(10 if dawn else 34):
        box(f"건너창{i}", 0.06, 0.02, 0.08, (rng.uniform(-2.4, 2.4), -3.9 - rng.uniform(0, 1.0),
                                           SILL_Z + rng.uniform(0.5, 1.5)), lit)


def scene_c(kind="night"):
    """창에 쓴 말 — 부엌 창 서리에 손가락으로 쓴 말을 방 안에서. night: 새벽에 쓴 「다녀올게」(다시 서리가 반쯤 덮음) 아래
    밤에 쓴 「꼭 바르고 나가」 · dawn: 크리스마스이브 새벽 「창틀 봐」와 창턱의 상자 · morning: 「고마워」와 두 제품.
    2판(Fable 10-29): 창틀이 보이게 물러서고, 서리는 결정이 비치는 재질(젖빛 벽지 아님) · 손끝이 밀어낸 둔덕, 닦인 획은
    물리대로 — 밤엔 어두운 밖, 새벽 · 아침엔 밝은 밖이 보인다(첫 판은 밝은 아침 창에 검은 획이라 마커 글씨로 읽혔다)."""
    dawn = kind == "dawn"
    window_frame(paint=(0.80, 0.78, 0.74) if kind != "night" else (0.50, 0.46, 0.42), outer_snow=True)
    glass_pane()
    # 방 안에서 보면 창의 +x가 화면 왼쪽 — 안에서 쓴 글이 바로 읽히게 좌우를 뒤집는다(첫 시험은 거울 글씨였다)
    if kind == "night":
        lm = np.maximum(letters_mask("다녀올게") * 0.55, letters_mask("바르고"))
        rim = letters_rim("바르고")
    elif dawn:
        lm, rim = letters_mask("창틀봐"), letters_rim("창틀봐")
    else:
        lm, rim = letters_mask("고마워"), letters_rim("고마워")
    lm = lm[:, ::-1]
    rim = rim[:, ::-1] if rim is not None else None
    glow = {"night": (1.0, 0.82, 0.56), "dawn": (0.84, 0.90, 1.0), "morning": (1.0, 0.92, 0.78)}[kind]
    frost, _ = window_frost(t=1.0, letters=lm, rim=rim, base_level=0.22, hmax=0.0008, glow=glow, seed=6)
    frost.data.materials[0] = mat_frost("서리2판", glow=glow, body=0.55, sparkle=2.2, core_lo=0.20)
    cam_loc, cam_t, lens = (0.06, 1.05, SILL_Z + 0.42), (0.0, 0.0, SILL_Z + 0.40), 30
    inside = [ob for ob in bpy.context.scene.objects if ob.name.startswith(("안창턱", "틀"))]
    if kind == "night":
        world_color((0.010, 0.020, 0.055), 0.03)
        box("밖하늘", 8.0, 0.02, 5.0, (0, -7.0, SILL_Z + 1.0), mat_emit("밤하늘", (0.04, 0.07, 0.18), 0.30))
        street_outside(False)
        snow_flakes(40, ((-0.6, 0.6), (-1.4, -0.4), (SILL_Z - 0.2, SILL_Z + 1.2)), 0.002, 0.005, seed=19)
        lamp = hide_from_camera(area_light("방등", (0.55, 0.70, SILL_Z + 0.75), (0.0, 0.05, SILL_Z + 0.40), 30.0, 0.35,
                                           rgb=(1.0, 0.72, 0.42)), glossy=False)
        light_only(lamp, inside + [frost])
    elif dawn:
        world_color((0.30, 0.38, 0.55), 0.20)
        box("밖하늘", 8.0, 0.02, 5.0, (0, -7.0, SILL_Z + 1.0), mat_emit("새벽하늘", (0.72, 0.80, 0.96), 3.2))
        street_outside(True)
        case_e, cp = gift_case((0.00, 0.17, SILL_Z), (0, 0, math.radians(30)))
        key = hide_from_camera(area_light("새벽방", (0.45, 0.90, SILL_Z + 0.70), (0.0, 0.15, SILL_Z + 0.08), 8.0, 0.9,
                                          rgb=(0.84, 0.90, 1.0)), glossy=False)
        dawnf = hide_from_camera(area_light("새벽창", (0.0, -0.9, SILL_Z + 0.8), (0.0, 0.0, SILL_Z + 0.5), 70.0, 1.4,
                                            rgb=(0.74, 0.84, 1.0)))
        rim_l = hide_from_camera(area_light("상자금", (-0.30, 0.05, SILL_Z + 0.30), (0.0, 0.17, SILL_Z + 0.08), 6.0, 0.2,
                                            rgb=(1.0, 0.85, 0.6)), glossy=False)
        light_only(key, cp + inside)
        light_only(dawnf, [frost])
        light_only(rim_l, cp)
        cam_loc, cam_t = (0.06, 0.95, SILL_Z + 0.36), (0.0, 0.0, SILL_Z + 0.34)
    else:
        # 아침: 해가 창 뒤에서 — 서리는 역광으로 빛나고 닦인 「고마워」 너머로 밝은 하늘 · 눈 지붕, 제품은 창 쪽에서 테두리 빛
        world_color((0.34, 0.40, 0.55), 0.22)
        box("밖하늘", 8.0, 0.02, 5.0, (0, -7.0, SILL_Z + 1.0), mat_emit("아침하늘", (0.80, 0.86, 0.98), 3.4))
        street_outside(True)
        jar_e, jp = cream_jar((0.030, 0.16, SILL_Z), (0, 0, math.radians(-12)))
        amp_e, ap = ampoule((-0.045, 0.14, SILL_Z), (0, 0, math.radians(16 + 180)))  # 방 안 카메라 쪽으로 라벨
        sun = hide_from_camera(area_light("아침해", (-0.6, -0.9, SILL_Z + 0.9), (0.0, 0.0, SILL_Z + 0.5), 110.0, 1.2,
                                          rgb=(1.0, 0.88, 0.70)))
        light_only(sun, [frost])
        back = hide_from_camera(area_light("창쪽해", (-0.15, 0.02, SILL_Z + 0.22), (-0.01, 0.15, SILL_Z + 0.05), 14.0, 0.25,
                                           rgb=(1.0, 0.86, 0.62)), glossy=False)
        key = hide_from_camera(area_light("아침방", (0.40, 0.70, SILL_Z + 0.45), (0.0, 0.15, SILL_Z + 0.06), 9.0, 0.6,
                                          rgb=(1.0, 0.92, 0.80)), glossy=False)
        light_only(back, jp + ap)
        light_only(key, jp + ap + inside)
        cam_loc, cam_t, lens = (-0.005, 0.60, SILL_Z + 0.12), (-0.005, 0.0, SILL_Z + 0.30), 30
    camera(cam_loc, cam_t, lens=lens, fstop=5.6)


def scene_p0():
    """제품 디자인 확인 — 검은 바닥 위 두 제품, 따뜻한 키 · 찬 보조 · 뒤 금테(시안 판 고르기 전 모양 · 재질만 본다)."""
    world_color((0.006, 0.008, 0.016), 0.05)
    box("바닥", 2.0, 2.0, 0.02, (0, 0, -0.01),
        mat_simple("검은바닥", base=(0.010, 0.012, 0.018), rough=0.18, coat=1.0, coat_rough=0.03))
    box("뒤판", 2.0, 0.02, 1.0, (0, 0.6, 0.4), mat_simple("뒤판", base=(0.02, 0.03, 0.06), rough=0.8))
    jar_e, jp = cream_jar((0.040, 0.02, 0.0), (0, 0, math.radians(-12)))
    amp_e, ap = ampoule((-0.040, -0.005, 0.0), (0, 0, math.radians(18)))
    key = area_light("키", (0.35, -0.30, 0.35), (0, 0, 0.04), 25.0, 0.35, rgb=(1.0, 0.86, 0.66))
    fill = area_light("보조", (-0.40, -0.25, 0.15), (0, 0, 0.04), 6.0, 0.5, rgb=(0.72, 0.82, 1.0))
    rim = area_light("뒤금", (0.0, 0.30, 0.25), (0, 0, 0.05), 30.0, 0.25, rgb=(1.0, 0.75, 0.42))
    camera((0.0, -0.36, 0.105), (0.0, 0.0, 0.045), lens=85, fstop=4.0)


def main():
    reset()
    {"p0": scene_p0, "a1": scene_a1, "a2": scene_a2, "a3": scene_a3, "a4": scene_a4, "b1": scene_b1, "b2": scene_b2,
     "c1": lambda: scene_c("night"), "c2": lambda: scene_c("dawn"), "c3": lambda: scene_c("morning")}[FRAME]()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.context.scene.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
    print("저장", OUT)


main()

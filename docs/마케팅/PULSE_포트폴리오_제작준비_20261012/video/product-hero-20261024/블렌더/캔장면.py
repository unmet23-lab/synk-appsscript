# PULSE 1 · 3번 가상 브랜드 캔(가칭 오미톡) — 블렌더 장면 (2026-10-25, 크레딧 0)
# 제품은 AI로 그리지 않고 블렌더로 짓는다. 라벨은 라벨/라벨.py가 만든 우리 디자인 파일.
#   blender -b --python 캔장면.py -- --cut 2 [--frame first|mid] [--res 540x960] [--samples 64] [--save]
#   → <밖>/렌더/c<cut>_<frame>.png   (<밖> = Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p1p3)
# 컷: test(캔 확인) · 1(아이스박스) · 2(몸통 세로 낱말표 접사) · 3(젖은 바닥 · 네온) · 4(기운 캔 입구 · 붓기 시작 그림)
#     5(잔 가장자리 · 기포 시작 그림) · 6(기운 로고 접사)
# 단위는 m. 캔은 355ml 표준(몸통 지름 66 mm · 높이 122 mm).
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


CUT = arg("--cut", "test")
FRAME = arg("--frame", "first")
RES = tuple(int(v) for v in arg("--res", "540x960").split("x"))
SAMPLES = int(arg("--samples", "64"))
SAVE = "--save" in argv
DIAG = "--diag" in argv
밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p1p3")
LABEL = arg("--label", os.path.join(밖, "라벨", "라벨_오미톡_색.png"))
METAL = LABEL.replace("_색.png", "_금속.png")
OUT = arg("--out", os.path.join(밖, "렌더", f"c{CUT}_{FRAME}.png"))
MM = 0.001
VIEW = arg("--view", "agx")
METAL_K = float(arg("--metal_k", "0.3"))
INK_ROUGH = float(arg("--ink_rough", "0.12"))
EXPOSURE = arg("--exposure", None)
FROST_BIAS = [0.0, 0.0]  # (왼쪽 치우침, 아래 치우침) — 컷에서 정한다
FROST_CLEAR = [0.0, 0.0, 1.0]  # (세기, 세계 x, 반폭) — 이 x 둘레는 서리가 덜 앉는다(2번 컷 낱말표)
FROST_RGB = [0.60, 0.70, 0.86]


def FROST_RGB_SET(rgb):
    FROST_RGB[:] = list(rgb)

NAVY = (0.010, 0.016, 0.060)
RUBY = (0.62, 0.012, 0.045)
PINK = (0.93, 0.56, 0.64)


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
    sc.cycles.max_bounces = 16
    sc.cycles.transmission_bounces = 16
    sc.cycles.glossy_bounces = 8
    sc.cycles.transparent_max_bounces = 16
    sc.cycles.volume_bounces = 2
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 0.5
    sc.render.resolution_x, sc.render.resolution_y = RES
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    if VIEW == "standard":
        sc.view_settings.view_transform = "Standard"
    else:
        sc.view_settings.view_transform = "AgX"
        want = {"agx": "Medium High Contrast", "punchy": "Punchy"}.get(VIEW, "Medium High Contrast")
        for look in (f"AgX - {want}", want):
            try:
                sc.view_settings.look = look
                break
            except Exception:
                pass
    world = bpy.data.worlds.new("world")
    sc.world = world
    world.use_nodes = True
    return sc


def world_color(rgb, strength=1.0):
    w = bpy.context.scene.world
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (*rgb, 1)
    bg.inputs["Strength"].default_value = strength


def world_gradient(low, high, strength=1.0):
    """반사에 비칠 세계를 아래 어둡고 위 밝은 그라데이션으로(알루미늄 · 액체가 납작한 회색으로 죽지 않게)."""
    w = bpy.context.scene.world
    nt = w.node_tree
    bg = nt.nodes.get("Background")
    co = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(co.outputs["Generated"], sep.inputs["Vector"])
    mp = nt.nodes.new("ShaderNodeMapRange")
    mp.inputs["From Min"].default_value = -0.6
    mp.inputs["From Max"].default_value = 0.8
    nt.links.new(sep.outputs["Z"], mp.inputs["Value"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*low, 1)
    ramp.color_ramp.elements[1].color = (*high, 1)
    nt.links.new(mp.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength


def camera(loc, target, lens=100.0, roll_deg=0.0, fstop=None, focus=None, sensor=36.0):
    if DIAG:
        loc = tuple(Vector(target) + (Vector(loc) - Vector(target)) * 3.0)
        fstop = None
    cd = bpy.data.cameras.new("cam")
    cd.lens = lens
    cd.sensor_fit = "VERTICAL" if RES[1] > RES[0] else "HORIZONTAL"
    cd.sensor_height = sensor
    cd.sensor_width = sensor
    cd.clip_start = 0.002
    cd.clip_end = 100
    cam = bpy.data.objects.new("cam", cd)
    bpy.context.collection.objects.link(cam)
    cam.location = Vector(loc)
    d = Vector(target) - Vector(loc)
    q = d.to_track_quat("-Z", "Y")
    cam.rotation_euler = q.to_euler()
    cam.rotation_euler.rotate_axis("Z", math.radians(roll_deg))
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = focus if focus else d.length
    bpy.context.scene.camera = cam
    return cam


def area_light(name, loc, target, energy, size, rgb=(1, 1, 1), size_y=None, spread=180):
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
    ob = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(ob)
    ob.location = Vector(loc)
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
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


def principled(nodes, **kw):
    b = nodes.new("ShaderNodeBsdfPrincipled")
    names = {
        "base": "Base Color", "metal": "Metallic", "rough": "Roughness", "ior": "IOR", "trans": "Transmission Weight",
        "coat": "Coat Weight", "coat_rough": "Coat Roughness", "spec": "Specular IOR Level", "aniso": "Anisotropic",
        "sss": "Subsurface Weight", "emit": "Emission Color", "emit_s": "Emission Strength", "alpha": "Alpha",
    }
    for k, v in kw.items():
        n = names[k]
        if k in ("base", "emit") and len(v) == 3:
            v = (*v, 1)
        setin(b, n, v)
    return b


def shadow_pass(n, l, shader_out, tint=(1, 1, 1)):
    """굴절 물체(물방울 · 얼음 · 액체 · 유리)가 그림자를 까맣게 드리우지 않게: 그림자 광선에는 투명.
    (커스틱을 끈 Cycles에서 물방울 밑 라벨이 검은 구멍처럼 찍히던 것)"""
    lp = n.new("ShaderNodeLightPath")
    tr = n.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = (*tint, 1)
    mix = n.new("ShaderNodeMixShader")
    l.new(lp.outputs["Is Shadow Ray"], mix.inputs["Fac"])
    l.new(shader_out, mix.inputs[1])
    l.new(tr.outputs[0], mix.inputs[2])
    return mix


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


def mat_can_print(frost=0.0, frost_scale=60.0, wet_bump=0.0, frost_seed=0.0):
    """라벨 인쇄면: 잉크(남색 · 루비는 알루미늄이 비치는 금속 몫) + 투명 바니시. frost>0이면 서리 얼룩을 섞는다."""
    m, n, l, out = new_mat("can_print")
    uv = n.new("ShaderNodeTexCoord")
    tex = n.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(LABEL, check_existing=True)
    tex.interpolation = "Cubic"
    met = n.new("ShaderNodeTexImage")
    met.image = bpy.data.images.load(METAL, check_existing=True)
    met.image.colorspace_settings.name = "Non-Color"
    l.new(uv.outputs["UV"], tex.inputs["Vector"])
    l.new(uv.outputs["UV"], met.inputs["Vector"])
    ink = principled(n, rough=INK_ROUGH, coat=1.0, coat_rough=0.03)
    l.new(tex.outputs["Color"], ink.inputs["Base Color"])
    mk = n.new("ShaderNodeMath")
    mk.operation = "MULTIPLY"
    mk.inputs[1].default_value = METAL_K
    l.new(met.outputs["Color"], mk.inputs[0])
    l.new(mk.outputs[0], ink.inputs["Metallic"])
    shader = ink
    bump_in = None
    if wet_bump > 0:
        # 아주 잔 결로: 보로노이 거리로 오목한 점들을 범프로
        vor = n.new("ShaderNodeTexVoronoi")
        vor.feature = "F1"
        vor.inputs["Scale"].default_value = 1400.0
        l.new(uv.outputs["Object"], vor.inputs["Vector"])
        mp = n.new("ShaderNodeMapRange")
        mp.inputs["From Min"].default_value = 0.0
        mp.inputs["From Max"].default_value = 0.45
        mp.inputs["To Min"].default_value = 1.0
        mp.inputs["To Max"].default_value = 0.0
        l.new(vor.outputs["Distance"], mp.inputs["Value"])
        bump = n.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = wet_bump
        bump.inputs["Distance"].default_value = 0.0002
        l.new(mp.outputs["Result"], bump.inputs["Height"])
        l.new(bump.outputs["Normal"], ink.inputs["Coat Normal"])
        bump_in = bump
    if frost > 0:
        # 서리 얼룩: 세계 좌표 잡음 + 치우침(카메라 왼쪽 · 아래로 많게), 가장자리는 또렷하게
        geo = n.new("ShaderNodeNewGeometry")
        noise = n.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = frost_scale
        noise.inputs["Detail"].default_value = 10.0
        noise.inputs["Roughness"].default_value = 0.66
        noise.inputs["Distortion"].default_value = 0.35
        try:
            noise.noise_dimensions = "4D"
            noise.inputs["W"].default_value = frost_seed
        except Exception:
            pass
        l.new(geo.outputs["Position"], noise.inputs["Vector"])
        sep = n.new("ShaderNodeSeparateXYZ")
        l.new(geo.outputs["Position"], sep.inputs["Vector"])
        bx = n.new("ShaderNodeMath")
        bx.operation = "MULTIPLY"
        bx.inputs[1].default_value = -FROST_BIAS[0] / 0.033
        l.new(sep.outputs["X"], bx.inputs[0])
        bz = n.new("ShaderNodeMath")
        bz.operation = "MULTIPLY_ADD"
        bz.inputs[1].default_value = -FROST_BIAS[1] / 0.06
        bz.inputs[2].default_value = FROST_BIAS[1]
        l.new(sep.outputs["Z"], bz.inputs[0])
        add1 = n.new("ShaderNodeMath")
        add1.operation = "ADD"
        l.new(noise.outputs["Fac"], add1.inputs[0])
        l.new(bx.outputs[0], add1.inputs[1])
        add2 = n.new("ShaderNodeMath")
        add2.operation = "ADD"
        l.new(add1.outputs[0], add2.inputs[0])
        l.new(bz.outputs[0], add2.inputs[1])
        if FROST_CLEAR[0] > 0:
            # − 세기 · exp(−((x − x0)/반폭)²)
            cx_ = n.new("ShaderNodeMath")
            cx_.operation = "SUBTRACT"
            cx_.inputs[1].default_value = FROST_CLEAR[1]
            l.new(sep.outputs["X"], cx_.inputs[0])
            cd_ = n.new("ShaderNodeMath")
            cd_.operation = "DIVIDE"
            cd_.inputs[1].default_value = FROST_CLEAR[2]
            l.new(cx_.outputs[0], cd_.inputs[0])
            cp_ = n.new("ShaderNodeMath")
            cp_.operation = "MULTIPLY"
            l.new(cd_.outputs[0], cp_.inputs[0])
            l.new(cd_.outputs[0], cp_.inputs[1])
            ce_ = n.new("ShaderNodeMath")
            ce_.operation = "MULTIPLY"
            ce_.inputs[1].default_value = -1.0
            l.new(cp_.outputs[0], ce_.inputs[0])
            cexp = n.new("ShaderNodeMath")
            cexp.operation = "EXPONENT"
            l.new(ce_.outputs[0], cexp.inputs[0])
            cs_ = n.new("ShaderNodeMath")
            cs_.operation = "MULTIPLY_ADD"
            cs_.inputs[1].default_value = -FROST_CLEAR[0]
            l.new(cexp.outputs[0], cs_.inputs[0])
            l.new(add2.outputs[0], cs_.inputs[2])
            add2 = cs_
        ramp = n.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 1.0 - frost
        ramp.color_ramp.elements[1].position = 1.0 - frost + 0.018
        l.new(add2.outputs[0], ramp.inputs["Fac"])
        # 서리 결: 잔 알갱이 + 굵은 덩이
        g1 = n.new("ShaderNodeTexVoronoi")
        g1.inputs["Scale"].default_value = 4200.0
        l.new(geo.outputs["Position"], g1.inputs["Vector"])
        g2 = n.new("ShaderNodeTexNoise")
        g2.inputs["Scale"].default_value = 700.0
        g2.inputs["Detail"].default_value = 4.0
        l.new(geo.outputs["Position"], g2.inputs["Vector"])
        gm = n.new("ShaderNodeMath")
        gm.operation = "MULTIPLY_ADD"
        gm.inputs[1].default_value = 0.6
        l.new(g1.outputs["Distance"], gm.inputs[0])
        l.new(g2.outputs["Fac"], gm.inputs[2])
        gb = n.new("ShaderNodeBump")
        gb.inputs["Strength"].default_value = 1.0
        gb.inputs["Distance"].default_value = 0.0008
        l.new(gm.outputs[0], gb.inputs["Height"])
        fr = principled(n, base=tuple(FROST_RGB), rough=0.62, sss=0.15)
        l.new(gb.outputs["Normal"], fr.inputs["Normal"])
        mix = n.new("ShaderNodeMixShader")
        l.new(ramp.outputs["Color"], mix.inputs["Fac"])
        l.new(ink.outputs[0], mix.inputs[1])
        l.new(fr.outputs[0], mix.inputs[2])
        shader = mix
    l.new(shader.outputs[0], out.inputs["Surface"])
    return m


def mat_alu(rough=0.22):
    m, n, l, out = new_mat("alu")
    b = principled(n, base=(0.90, 0.91, 0.93), metal=1.0, rough=rough, aniso=0.35)
    l.new(b.outputs[0], out.inputs["Surface"])
    return m


def mat_water():
    m, n, l, out = new_mat("water")
    b = principled(n, base=(1, 1, 1), rough=0.0, ior=1.333, trans=1.0)
    l.new(shadow_pass(n, l, b.outputs[0]).outputs[0], out.inputs["Surface"])
    return m


def mat_ice(cloud=25.0):
    m, n, l, out = new_mat("ice")
    co = n.new("ShaderNodeTexCoord")
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 90.0
    noise.inputs["Detail"].default_value = 6.0
    l.new(co.outputs["Object"], noise.inputs["Vector"])
    rr = n.new("ShaderNodeMapRange")
    rr.inputs["To Min"].default_value = 0.02
    rr.inputs["To Max"].default_value = 0.22
    l.new(noise.outputs["Fac"], rr.inputs["Value"])
    b = principled(n, base=(1, 1, 1), ior=1.31, trans=1.0)
    l.new(rr.outputs["Result"], b.inputs["Roughness"])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    l.new(noise.outputs["Fac"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    l.new(shadow_pass(n, l, b.outputs[0], (0.9, 0.95, 1.0)).outputs[0], out.inputs["Surface"])
    vol = n.new("ShaderNodeVolumeScatter")
    vol.inputs["Density"].default_value = cloud
    vol.inputs["Color"].default_value = (0.9, 0.95, 1.0, 1)
    l.new(vol.outputs[0], out.inputs["Volume"])
    return m


def mat_liquid(density=55.0, rgb=(0.78, 0.035, 0.10)):
    """루비색 오미자 탄산: 겉은 물(IOR 1.34), 색은 부피 흡수로."""
    m, n, l, out = new_mat("ruby_liquid")
    b = principled(n, base=(1, 1, 1), rough=0.0, ior=1.34, trans=1.0)
    l.new(shadow_pass(n, l, b.outputs[0], (0.85, 0.25, 0.32)).outputs[0], out.inputs["Surface"])
    ab = n.new("ShaderNodeVolumeAbsorption")
    # 흡수 색 = 1 - 보이는 색에 가깝게
    ab.inputs["Color"].default_value = (*rgb, 1)
    ab.inputs["Density"].default_value = density
    l.new(ab.outputs[0], out.inputs["Volume"])
    return m


def mat_glass(rough=0.0):
    m, n, l, out = new_mat("glass")
    b = principled(n, base=(1, 1, 1), rough=rough, ior=1.5, trans=1.0)
    l.new(shadow_pass(n, l, b.outputs[0]).outputs[0], out.inputs["Surface"])
    return m


# ── 캔 ──────────────────────────────────────────────────────────────────────
PROFILE = [
    (0.0, 10.2), (6.0, 10.0), (12.0, 9.4), (17.0, 8.2), (20.5, 6.8), (23.2, 4.6), (24.4, 2.4), (24.9, 0.9),
    (25.6, 0.15), (26.6, 0.0), (27.6, 0.25), (28.8, 0.9), (30.2, 2.0), (31.5, 3.5), (32.4, 5.2), (32.9, 6.8),
    (33.0, 8.0), (33.0, 12.0), (33.0, 20.0), (33.0, 30.0), (33.0, 40.0), (33.0, 50.0), (33.0, 60.0), (33.0, 70.0),
    (33.0, 80.0), (33.0, 90.0), (33.0, 100.0), (33.0, 104.0), (32.85, 106.0), (32.4, 108.0), (31.6, 110.0),
    (30.5, 112.0), (29.3, 113.8), (28.2, 115.3), (27.45, 116.5), (27.15, 117.4), (27.2, 118.2), (27.55, 119.0),
    (27.85, 120.0), (27.9, 121.0), (27.6, 121.8), (27.0, 122.15), (26.5, 122.0), (26.2, 121.3), (26.0, 120.3),
    (25.85, 119.0), (25.7, 117.9), (25.45, 117.4), (25.1, 117.5), (24.8, 118.0), (24.4, 118.5), (23.5, 118.7),
    (20.0, 118.75), (10.0, 118.8), (0.0, 118.8),
]
LABEL_Z0, LABEL_Z1 = 4.0, 118.0


def make_can(name="can", segs=192, frost=0.0, wet_bump=0.0, frost_scale=60.0, frost_seed=0.0, tab=True, tab_lift=0.0):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    rings = []
    for r, z in PROFILE:
        if r == 0.0:
            rings.append([bm.verts.new((0, 0, z * MM))])
        else:
            ring = []
            for i in range(segs):
                a = 2 * math.pi * i / segs
                ring.append(bm.verts.new((r * MM * math.cos(a), r * MM * math.sin(a), z * MM)))
            rings.append(ring)
    faces = []
    for k in range(len(rings) - 1):
        A, B = rings[k], rings[k + 1]
        if len(A) == 1:
            for i in range(segs):
                faces.append((bm.faces.new((A[0], B[(i + 1) % segs], B[i])), k))
        elif len(B) == 1:
            for i in range(segs):
                faces.append((bm.faces.new((A[i], A[(i + 1) % segs], B[0])), k))
        else:
            for i in range(segs):
                faces.append((bm.faces.new((A[i], A[(i + 1) % segs], B[(i + 1) % segs], B[i])), k))
    bmesh.ops.recalc_face_normals(bm, faces=[f for f, _ in faces])
    # UV: 앞면 가운데(u 0.5)가 -Y를 보게. 이음매는 +Y(뒤)
    for f, k in faces:
        zc = sum(v.co.z for v in f.verts) / len(f.verts) / MM
        rc = sum(math.hypot(v.co.x, v.co.y) for v in f.verts) / len(f.verts) / MM
        is_label = LABEL_Z0 - 0.5 < zc < 117.6 and rc > 27.0
        f.material_index = 0 if is_label else 1
        f.smooth = True
        us = []
        for lp in f.loops:
            v = lp.vert.co
            ang = math.atan2(v.y, v.x)
            u = ((ang + math.pi / 2) / (2 * math.pi) + 0.5) % 1.0
            us.append(u)
        if max(us) - min(us) > 0.5:
            us = [u + 1.0 if u < 0.5 else u for u in us]
        for lp, u in zip(f.loops, us):
            z = lp.vert.co.z / MM
            lp[uvl].uv = (u, (z - LABEL_Z0) / (LABEL_Z1 - LABEL_Z0))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(mat_can_print(frost=frost, wet_bump=wet_bump, frost_scale=frost_scale, frost_seed=frost_seed))
    me.materials.append(mat_alu())
    parts = [ob]
    if tab:
        parts += make_tab(ob, lift_deg=tab_lift)
    return ob


def outline_tab():
    """당김 고리 윤곽(mm, 캔 윗면 좌표). 코는 -Y(앞면 쪽, 마시는 구멍 쪽), 고리는 +Y."""
    pts = []
    # 고리 끝 반원(중심 y=+6.2, 반지름 6.3) → 옆선 → 코 반원(중심 y=-5.8, 반지름 4.4)
    for i in range(0, 41):
        a = math.pi * i / 40
        pts.append((6.3 * math.cos(a), 6.2 + 6.3 * math.sin(a)))
    for i in range(0, 41):
        a = math.pi + math.pi * i / 40
        pts.append((4.4 * math.cos(a), -5.8 + 4.4 * math.sin(a)))
    hole = []
    for i in range(48):
        a = 2 * math.pi * i / 48
        hole.append((3.9 * math.cos(a), 6.0 + 2.9 * math.sin(a)))
    return pts, hole


def make_tab(can, lift_deg=0.0):
    pts, hole = outline_tab()
    bm = bmesh.new()
    vo = [bm.verts.new((x * MM, y * MM, 0)) for x, y in pts]
    vh = [bm.verts.new((x * MM, y * MM, 0)) for x, y in hole]
    edges = [bm.edges.new((vo[i], vo[(i + 1) % len(vo)])) for i in range(len(vo))]
    edges += [bm.edges.new((vh[i], vh[(i + 1) % len(vh)])) for i in range(len(vh))]
    bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges)
    # 구멍 안 삼각형 지우기
    from mathutils.geometry import intersect_point_tri_2d  # noqa

    def inside_hole(f):
        c = f.calc_center_median() / MM
        return ((c.x / 3.9) ** 2 + ((c.y - 6.0) / 2.9) ** 2) < 1.0

    bmesh.ops.delete(bm, geom=[f for f in bm.faces if inside_hole(f)], context="FACES")
    ret = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    verts = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=verts, vec=(0, 0, 0.45 * MM))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    me = bpy.data.meshes.new("tab")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("tab", me)
    bpy.context.collection.objects.link(ob)
    bev = ob.modifiers.new("bevel", "BEVEL")
    bev.width = 0.16 * MM
    bev.segments = 3
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat_alu(0.18))
    ob.parent = can
    ob.location = (0, 1.2 * MM, 118.85 * MM)
    ob.rotation_euler = (math.radians(lift_deg), 0, 0)
    # 리벳
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=1.7 * MM, depth=0.8 * MM, location=(0, -4.6 * MM, 119.0 * MM))
    rv = bpy.context.active_object
    rv.data.materials.append(mat_alu(0.2))
    rv.parent = can
    return [ob, rv]


def place(ob, loc=(0, 0, 0), rot_deg=(0, 0, 0)):
    ob.location = Vector(loc)
    ob.rotation_euler = Euler([math.radians(a) for a in rot_deg])
    return ob


# ── 물방울: 캔 몸통 위 구면 모자 ─────────────────────────────────────────────
def droplets(can, n=1500, z_range=(12, 104), ang_range=(-180, 180), r_range=(0.18, 2.6), power=2.4, seed=7,
             name="drops", gravity=True, avoid=None):
    """can은 서 있는 캔(원점 = 바닥 가운데)의 물체. ang 0° = 앞면(-Y)."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    placed = []
    cell = 1.5
    grid = {}

    def ok(x, y, r):
        gx, gy = int(x // cell), int(y // cell)
        for i in range(gx - 3, gx + 4):
            for j in range(gy - 3, gy + 4):
                for (px, py, pr) in grid.get((i, j), ()):
                    if (px - x) ** 2 + (py - y) ** 2 < (pr + r) ** 2 * 0.92:
                        return False
        return True

    arc0 = math.radians(ang_range[0]) * 33.0
    arc1 = math.radians(ang_range[1]) * 33.0
    tries = 0
    while len(placed) < n and tries < n * 30:
        tries += 1
        t = rnd.random() ** power
        r = r_range[0] + (r_range[1] - r_range[0]) * t
        x = rnd.uniform(arc0, arc1)  # 둘레 위 mm
        y = rnd.uniform(*z_range)
        if avoid and avoid(x, y):
            continue
        if not ok(x, y, r):
            continue
        placed.append((x, y, r))
        grid.setdefault((int(x // cell), int(y // cell)), []).append((x, y, r))
    for (x, y, r) in placed:
        theta = rnd.uniform(58, 82)
        R = r / math.sin(math.radians(theta))
        h = R * (1 - math.cos(math.radians(theta)))
        rings = 6 if r > 0.7 else 4
        segs = 16 if r > 0.7 else 10
        elong = 1.0 + (rnd.uniform(0.15, 0.55) if (gravity and r > 1.0) else rnd.uniform(0.0, 0.12))
        verts = []
        top = None
        for i in range(rings + 1):
            phi = math.radians(theta) * (1 - i / rings)  # 바닥 테두리 → 꼭대기
            rr = R * math.sin(phi)
            zz = R * math.cos(phi) - R * math.cos(math.radians(theta))
            if i == rings:
                top = (0.0, 0.0, zz)
                break
            ring = []
            for j in range(segs):
                a = 2 * math.pi * j / segs
                lx, ly = rr * math.cos(a), rr * math.sin(a)
                if ly < 0:
                    ly *= elong  # 아래쪽으로 처짐
                ring.append((lx, ly, zz))
            verts.append(ring)
        ang = x / 33.0  # 라디안, 0 = 앞면
        phi_can = -math.pi / 2 + ang
        nrm = Vector((math.cos(phi_can), math.sin(phi_can), 0))
        tangent = Vector((-math.sin(phi_can), math.cos(phi_can), 0))
        up = Vector((0, 0, 1))
        base = nrm * (33.0 + 0.01) + up * y
        bv = []
        for ring in verts:
            rv = []
            for (lx, ly, zz) in ring:
                p = base + tangent * lx + up * ly + nrm * zz
                rv.append(bm.verts.new(p * MM))
            bv.append(rv)
        tp = base + nrm * top[2]
        tv = bm.verts.new(tp * MM)
        for i in range(len(bv) - 1):
            A, B = bv[i], bv[i + 1]
            for j in range(segs):
                bm.faces.new((A[j], A[(j + 1) % segs], B[(j + 1) % segs], B[j]))
        last = bv[-1]
        for j in range(segs):
            bm.faces.new((last[j], last[(j + 1) % segs], tv))
        # 바닥(캔에 닿는 면)
        bm.faces.new(list(reversed(bv[0])))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(mat_water())
    ob.parent = can
    return ob, len(placed)


# ── 공통 소품 ────────────────────────────────────────────────────────────────
def box(name, size, loc=(0, 0, 0), bevel=0.0, mat=None, segs=4):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        m = ob.modifiers.new("bev", "BEVEL")
        m.width = bevel
        m.segments = segs
        m.harden_normals = True
    for p in ob.data.polygons:
        p.use_smooth = True
    if mat:
        ob.data.materials.append(mat)
    return ob


def cylinder(name, r, h, loc, rot=(0, 0, 0), mat=None, verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    for p in ob.data.polygons:
        p.use_smooth = True
    if mat:
        ob.data.materials.append(mat)
    return ob


def mist(name, size, loc, density=3.0, scale=18.0, rgb=(0.82, 0.88, 1.0), lo=0.42, hi=0.78, fade_top=True, seed=0.0):
    """찬 김: 잡음 덩어리를 문턱으로 깎은 부피. fade_top이면 위로 갈수록 옅게."""
    ob = box(name, size, loc)
    m, n, l, out = new_mat(name)
    co = n.new("ShaderNodeTexCoord")
    noise = n.new("ShaderNodeTexNoise")
    try:
        noise.noise_dimensions = "4D"
        noise.inputs["W"].default_value = seed
    except Exception:
        pass
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 7.0
    noise.inputs["Roughness"].default_value = 0.6
    noise.inputs["Distortion"].default_value = 0.6
    l.new(co.outputs["Object"], noise.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = lo
    ramp.color_ramp.elements[1].position = hi
    l.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    dens = n.new("ShaderNodeMath")
    dens.operation = "MULTIPLY"
    dens.inputs[1].default_value = density
    l.new(ramp.outputs["Color"], dens.inputs[0])
    last = dens
    if fade_top:
        sep = n.new("ShaderNodeSeparateXYZ")
        l.new(co.outputs["Generated"], sep.inputs["Vector"])
        fr = n.new("ShaderNodeMapRange")
        fr.inputs["From Min"].default_value = 0.0
        fr.inputs["From Max"].default_value = 1.0
        fr.inputs["To Min"].default_value = 1.0
        fr.inputs["To Max"].default_value = 0.0
        l.new(sep.outputs["Z"], fr.inputs["Value"])
        mul = n.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        l.new(dens.outputs[0], mul.inputs[0])
        l.new(fr.outputs["Result"], mul.inputs[1])
        last = mul
    vol = n.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (*rgb, 1)
    vol.inputs["Anisotropy"].default_value = 0.35
    l.new(last.outputs[0], vol.inputs["Density"])
    l.new(vol.outputs[0], out.inputs["Volume"])
    ob.data.materials.append(m)
    return ob


def ice_cubes(n, region, size=(0.022, 0.032), seed=3, mat=None, z_stack=True, avoid=None):
    """region = (x0, x1, y0, y1, z0, z1). 겹침을 대충 피해 쌓는다."""
    rnd = random.Random(seed)
    mat = mat or mat_ice()
    placed = []
    obs = []
    tries = 0
    while len(placed) < n and tries < n * 60:
        tries += 1
        s = rnd.uniform(*size)
        x = rnd.uniform(region[0], region[1])
        y = rnd.uniform(region[2], region[3])
        z = rnd.uniform(region[4], region[5])
        if avoid and avoid(x, y, z, s):
            continue
        if any((x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2 < ((s + ps) * 0.48) ** 2 for px, py, pz, ps in placed):
            continue
        placed.append((x, y, z, s))
    for i, (x, y, z, s) in enumerate(placed):
        ob = box(f"ice{i}", (s, s * rnd.uniform(0.8, 1.0), s * rnd.uniform(0.75, 0.95)), (x, y, z), bevel=s * 0.18, segs=3)
        ob.rotation_euler = (rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.uniform(0, 3.14))
        sub = ob.modifiers.new("sub", "SUBSURF")
        sub.levels = 2
        sub.render_levels = 2
        tex = bpy.data.textures.new(f"icen{i}", "CLOUDS")
        tex.noise_scale = 0.012
        disp = ob.modifiers.new("disp", "DISPLACE")
        disp.texture = tex
        disp.strength = s * 0.06
        disp.texture_coords = "GLOBAL"
        ob.data.materials.clear()
        ob.data.materials.append(mat)
        obs.append(ob)
    return obs


def wet_floor(size=3.0, rough_lo=0.03, rough_hi=0.30, drops=True):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    ob = bpy.context.active_object
    ob.name = "floor"
    m, n, l, out = new_mat("floor")
    co = n.new("ShaderNodeTexCoord")
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 5.0
    l.new(co.outputs["Object"], noise.inputs["Vector"])
    rr = n.new("ShaderNodeMapRange")
    rr.inputs["From Min"].default_value = 0.42
    rr.inputs["From Max"].default_value = 0.62
    rr.inputs["To Min"].default_value = rough_lo
    rr.inputs["To Max"].default_value = rough_hi
    l.new(noise.outputs["Fac"], rr.inputs["Value"])
    b = principled(n, base=(0.012, 0.012, 0.016), spec=0.6, coat=1.0, coat_rough=0.02)
    l.new(rr.outputs["Result"], b.inputs["Roughness"])
    if drops:
        vor = n.new("ShaderNodeTexVoronoi")
        vor.inputs["Scale"].default_value = 220.0
        try:
            vor.inputs["Randomness"].default_value = 1.0
        except Exception:
            pass
        l.new(co.outputs["Object"], vor.inputs["Vector"])
        mp = n.new("ShaderNodeMapRange")
        mp.inputs["From Min"].default_value = 0.0
        mp.inputs["From Max"].default_value = 0.30
        mp.inputs["To Min"].default_value = 1.0
        mp.inputs["To Max"].default_value = 0.0
        l.new(vor.outputs["Distance"], mp.inputs["Value"])
        bump = n.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.6
        bump.inputs["Distance"].default_value = 0.0008
        l.new(mp.outputs["Result"], bump.inputs["Height"])
        l.new(bump.outputs["Normal"], b.inputs["Coat Normal"])
    l.new(b.outputs[0], out.inputs["Surface"])
    ob.data.materials.append(m)
    return ob


def revolve(name, prof, segs=128, mat=None):
    """prof: [(r, z) m] 닫힌 단면(바깥 → 안)을 z축으로 돌린 껍질."""
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
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    if mat:
        me.materials.append(mat)
    return ob


def bubbles_mesh(name, pts, mat):
    """pts: [(x, y, z, r)] 작은 공 여럿을 한 메시로."""
    bm = bmesh.new()
    for (x, y, z, r) in pts:
        bmesh.ops.create_icosphere(bm, subdivisions=2 if r > 0.0006 else 1, radius=r,
                                   matrix=Matrix.Translation((x, y, z)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(mat)
    return ob


def mat_air_in_liquid():
    m, n, l, out = new_mat("air_bubble")
    b = principled(n, base=(1, 1, 1), rough=0.0, ior=1.0 / 1.34, trans=1.0)
    l.new(shadow_pass(n, l, b.outputs[0]).outputs[0], out.inputs["Surface"])
    return m


def stream_mesh(name, pts, widths, thick=0.55, twist=0.0, mat=None, res=6):
    """붓는 줄기: 가운데 선 pts(m)을 따라 납작한 타원 단면(폭 widths, 두께 = 폭 × thick)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = 24
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for i, (p, w) in enumerate(zip(pts, widths)):
        sp.points[i].co = (*p, 1.0)
        sp.points[i].radius = w
        sp.points[i].tilt = twist * i / max(1, len(pts) - 1)
    sp.use_endpoint_u = True
    sp.order_u = 4
    # 단면: 타원 곡선
    pc = bpy.data.curves.new(name + "_prof", "CURVE")
    pc.dimensions = "2D"
    ps = pc.splines.new("NURBS")
    k = 16
    ps.points.add(k - 1)
    for i in range(k):
        a = 2 * math.pi * i / k
        ps.points[i].co = (0.5 * math.cos(a), 0.5 * thick * math.sin(a), 0, 1)
    ps.use_cyclic_u = True
    prof = bpy.data.objects.new(name + "_prof", pc)
    bpy.context.collection.objects.link(prof)
    prof.hide_render = True
    cu.bevel_mode = "OBJECT"
    cu.bevel_object = prof
    cu.use_fill_caps = True
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.active_object
    for p in ob.data.polygons:
        p.use_smooth = True
    tex = bpy.data.textures.new(name + "_n", "CLOUDS")
    tex.noise_scale = 0.006
    d = ob.modifiers.new("wob", "DISPLACE")
    d.texture = tex
    d.strength = 0.0007
    d.texture_coords = "GLOBAL"
    if mat:
        ob.data.materials.clear()
        ob.data.materials.append(mat)
    return ob


def backdrop(name, rgb, strength, loc, size=(1.5, 1.5), rot=(90, 0, 0), grad=None):
    """빛나는 바탕판. grad=(rgb2, 축) 이면 판 위에서 두 색 사이로 흐린다."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=[math.radians(a) for a in rot])
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (size[0], size[1], 1)
    m, n, l, out = new_mat(name)
    e = n.new("ShaderNodeEmission")
    e.inputs["Strength"].default_value = strength
    if grad:
        co = n.new("ShaderNodeTexCoord")
        sep = n.new("ShaderNodeSeparateXYZ")
        l.new(co.outputs["Generated"], sep.inputs["Vector"])
        ramp = n.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (*rgb, 1)
        ramp.color_ramp.elements[1].color = (*grad[0], 1)
        l.new(sep.outputs[grad[1]], ramp.inputs["Fac"])
        l.new(ramp.outputs["Color"], e.inputs["Color"])
    else:
        e.inputs["Color"].default_value = (*rgb, 1)
    l.new(e.outputs[0], out.inputs["Surface"])
    ob.data.materials.append(m)
    return ob


# ── 컷별 장면 ────────────────────────────────────────────────────────────────
def scene_test():
    reset()
    world_color((0.05, 0.06, 0.09), 1.0)
    make_can(wet_bump=0.0)
    camera((0.0, -0.42, 0.075), (0, 0, 0.062), lens=85, fstop=None)
    area_light("key", (-0.30, -0.20, 0.25), (0, 0, 0.06), 25, 0.12, size_y=0.5)
    area_light("rim", (0.3, 0.2, 0.2), (0, 0, 0.06), 30, 0.08, size_y=0.5)
    area_light("fill", (0.2, -0.3, 0.05), (0, 0, 0.06), 4, 0.4)
    bpy.context.scene.view_settings.exposure = -2.5


def scene_label():
    """라벨 시안 보기: 같은 캔을 앞면 · 오른 옆면(세로 낱말표) · 뒷면으로 셋 나란히, 밝은 회색 스튜디오."""
    reset()
    world_color((0.20, 0.21, 0.24), 1.0)
    for k, (x, rot) in enumerate(((-0.085, 0.0), (0.0, 106.0), (0.085, 180.0))):
        c = make_can(f"can{k}", wet_bump=0.0)
        c.location = (x, 0, 0)
        c.rotation_euler = (0, 0, math.radians(rot))
    bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, 0))
    bpy.context.active_object.data.materials.append(mat_simple("floor", base=(0.55, 0.56, 0.6), rough=0.5))
    backdrop("bg", (0.62, 0.64, 0.70), 0.35, (0, 0.6, 0.4), size=(3, 1.5))
    camera((0.0, -0.62, 0.11), (0, 0, 0.060), lens=85)
    area_light("key", (-0.35, -0.30, 0.35), (0, 0, 0.06), 30, 0.25, size_y=0.6)
    area_light("rim", (0.35, 0.25, 0.25), (0, 0, 0.06), 25, 0.10, size_y=0.6)
    area_light("fill", (0.25, -0.35, 0.05), (0, 0, 0.06), 5, 0.5)
    bpy.context.scene.view_settings.exposure = -2.2


SIDE_DEG = -106.0  # 라벨.py SIDE_X: 앞면에서 왼쪽으로 약 106°(뒷면 표시가 2번 컷 밖으로 — Fable v1 P2)


def scene_c1():
    """컷 1: 남색 몸통 · 흰 뚜껑 아이스박스. first = 닫힌 뚜껑 앞면이 화면 위 2/3, mid = 뚜껑이 뒤 경첩으로 들려
    틈으로 얼음 속 캔(엠블럼 정면)이 남색 LED 빛에 드러남."""
    sc = reset()
    world_color((0.0, 0.0, 0.0), 0.0)
    W_, D_, H_ = 0.27, 0.21, 0.24  # 몸통 바깥 — 원본 손잡이 홈(화면 폭 90%)이 들어오는 작은 개인용
    t = 0.018
    navy_shell = mat_simple("shell", base=(0.016, 0.026, 0.10), rough=0.38)
    liner = mat_simple("liner", base=(0.80, 0.83, 0.88), rough=0.32)
    lidm = mat_simple("lid", base=(0.86, 0.87, 0.90), rough=0.42)
    walls = [
        ("front", (W_, t, H_), (0, -D_ / 2 + t / 2, H_ / 2)),
        ("back", (W_, t, H_), (0, D_ / 2 - t / 2, H_ / 2)),
        ("left", (t, D_, H_), (-W_ / 2 + t / 2, 0, H_ / 2)),
        ("right", (t, D_, H_), (W_ / 2 - t / 2, 0, H_ / 2)),
        ("bottom", (W_, D_, t), (0, 0, t / 2)),
    ]
    for nm, size, loc in walls:
        ob = box(nm, size, loc, bevel=0.005)
        ob.data.materials.append(navy_shell)
        ob.data.materials.append(liner)
        c = Vector((0, 0, H_ / 2))
        for p in ob.data.polygons:
            pc = ob.matrix_world @ p.center
            nrm = p.normal
            inward = nrm.dot(c - pc) > 0
            p.material_index = 1 if (inward or nrm.z > 0.7) else 0
    lid_h = 0.085
    lid = box("lid", (W_ + 0.010, D_ + 0.010, lid_h), (0, 0, 0), bevel=0.010, mat=lidm, segs=5)
    slot = box("slot", (0.078, 0.06, 0.030), (0, -D_ / 2 + 0.005, lid_h * 0.20), bevel=0.012, segs=6)  # 뚜껑 속까지 뚫린 손잡이
    # 깎인 홈 안쪽 면은 남청으로(뚜껑 흰 재질이면 뚜껑 속 LED 빛을 받아 홈이 하얗게 빛났다) — 자르개 재질을 넘겨받게
    slot_in = new_mat("slot_inner")
    si = principled(slot_in[1], base=(0.03, 0.05, 0.16), rough=0.7)
    se = slot_in[1].new("ShaderNodeEmission")
    se.inputs["Color"].default_value = (0.15, 0.30, 1.0, 1)
    se.inputs["Strength"].default_value = 0.05
    sadd = slot_in[1].new("ShaderNodeAddShader")
    slot_in[2].new(si.outputs[0], sadd.inputs[0])
    slot_in[2].new(se.outputs[0], sadd.inputs[1])
    slot_in[2].new(sadd.outputs[0], slot_in[3].inputs["Surface"])
    slot.data.materials.append(slot_in[0])
    bo = lid.modifiers.new("slot", "BOOLEAN")
    bo.object = slot
    bo.operation = "DIFFERENCE"
    bo.solver = "EXACT"
    bo.material_mode = "TRANSFER"
    slot.hide_render = True
    hollow = box("hollow", (W_ - 0.036, D_ - 0.036, lid_h - 0.02), (0, 0, -0.011))
    bo2 = lid.modifiers.new("hollow", "BOOLEAN")
    bo2.object = hollow
    bo2.operation = "DIFFERENCE"
    hollow.hide_render = True
    slot.parent = lid
    hollow.parent = lid
    # 손잡이 밑으로 비치는 냉기 빛: 홈 뒤 뚜껑 속에 은은한 남청 판을 댄다(뚜껑 속 LED 빛이 그대로 보이면 하얗게 날아간다)
    slot_glow = box("slot_glow", (0.100, 0.002, 0.046), (0, -D_ / 2 + 0.039, lid_h * 0.20),
                    mat=mat_emit("slotglow", (0.20, 0.40, 1.0), 0.10))
    slot_glow.parent = lid
    grip = box("grip", (0.080, 0.014, 0.018), (0, -D_ / 2 + 0.002, lid_h * 0.20 + 0.006), bevel=0.005, mat=lidm, segs=4)
    grip.parent = lid  # 구멍 위 60%를 가로지르는 흰 손잡이 막대 — 그 밑 틈만 남는다
    # 원본처럼 뚜껑 앞면이 위 모서리를 축으로 뒤로 젖혀지며(앞면이 짧아 보임) 아래 틈이 열린다
    hinge = bpy.data.objects.new("hinge", None)
    bpy.context.collection.objects.link(hinge)
    hinge.location = (0, -(D_ / 2 + 0.005), H_ + lid_h)
    lid.parent = hinge
    lid.location = (0, D_ / 2 + 0.005, -lid_h / 2)
    open_deg = 0.0 if FRAME == "first" else 60.0
    hinge.rotation_euler = (math.radians(open_deg), 0, 0)
    if FRAME == "first":
        hinge.location.z += 0.004  # 원본 첫 프레임: 뚜껑 · 몸통 사이로 파란 LED 띠가 샌다
    # 캔: 얼음 위에 서서 윗부분이 테두리 위로 올라온다(닫힌 뚜껑 속 빈 곳에 들어감)
    can = make_can(wet_bump=0.6)
    can_z = 0.180  # 열린 순간 엠블럼이 몸통 앞 테두리 위로 다 올라오게(닫힌 뚜껑 속 빈 곳 안에 든다)
    can.location = (0.0, 0.030, can_z)
    droplets(can, n=900, z_range=(30, 112), ang_range=(-70, 70), r_range=(0.18, 1.0), power=2.6, seed=21)
    ice_cubes(90, (-W_ / 2 + t + 0.016, W_ / 2 - t - 0.016, -D_ / 2 + t + 0.016, D_ / 2 - t - 0.016, 0.12, 0.245),
              seed=5, avoid=lambda x, y, z, s: (math.hypot(x - 0.0, y - 0.030) < 0.033 + s * 0.55 and z > can_z - 0.02)
              or (y < 0.02 and abs(x) < 0.065 and z > 0.165), mat=mat_ice(cloud=4.0))  # 캔 앞은 낮게 — 엠블럼이 틈에 다 보이게
    # 안쪽 남색 LED: 벽 위 가장자리 아래 띠 + 얼음 사이에서 올라오는 빛
    led = mat_emit("led", (0.06, 0.20, 1.0), 420.0 if FRAME != "first" else 230.0)  # 닫힌 첫 프레임 이음매 띠는 흰 심지 없이 부드럽게
    for y in (-D_ / 2 + t + 0.004, D_ / 2 - t - 0.004):
        cylinder("led", 0.0025, W_ - 2 * t - 0.02, (0, y, H_ - 0.016), rot=(0, math.radians(90), 0), mat=led)
    ig = area_light("ice_glow", (0, 0.0, 0.262), (0, 0, 0.0), 60.0, 0.20, rgb=(0.05, 0.27, 1.0), size_y=0.15)
    # 얼음 위 LED 빛은 얼음 · 벽만 받게 — 캔에 닿으면 캔이 이 빛 높이 아래로 뿌옇게 날린다
    # (Fable v1이 「엠블럼 아랫도리가 뿌연 얼음 막 뒤」로 본 것의 정체 — 김 · 얼음 · 물방울 · 앞벽 · 빛을 하나씩 빼서 가름)
    can_set = {can.name} | {o.name for o in can.children_recursive}
    recv = bpy.data.collections.new("ice_glow_recv")
    bpy.context.scene.collection.children.link(recv)
    for ob in list(bpy.context.scene.objects):
        if ob.type == "MESH" and ob.name not in can_set:
            recv.objects.link(ob)
    ig.light_linking.receiver_collection = recv
    area_light("ice_up", (0, -0.05, 0.12), (0, 0.03, 0.24), 14.0, 0.20, rgb=(0.05, 0.28, 1.0), size_y=0.12)
    area_light("can_key", (0.0, -0.06, 0.40), (0, 0.03, 0.25), 1.6, 0.15, rgb=(0.55, 0.72, 1.0))
    # 바깥 빛: 위 앞에서 흰 뚜껑 앞면을 밝히는 부드러운 빛(살짝 푸름)
    area_light("lid_key", (0.0, -0.25, 0.70), (0, -0.10, 0.30), 9.0, 0.6, rgb=(0.74, 0.72, 1.0), size_y=0.3)
    area_light("lid_top", (0.0, 0.0, 0.80), (0, 0, 0.3), 6.0, 0.6, rgb=(0.62, 0.68, 1.0))
    # 김: 뚜껑 위와 틈
    mist("mist_top", (0.5, 0.3, 0.12), (0, 0.0, H_ + lid_h + 0.08), density=4.0, scale=14.0, seed=1.0, rgb=(0.7, 0.78, 1.0))
    if FRAME != "first":
        mist("mist_gap", (0.26, 0.20, 0.05), (0, 0.0, H_ + 0.03), density=3.0, scale=22.0, lo=0.52, hi=0.86, seed=2.0,
             rgb=(0.7, 0.8, 1.0))
    focus = 0.134 if FRAME == "first" else 0.27   # 원본: 첫 프레임은 뚜껑 손잡이, 열린 뒤는 캔에 초점
    camera((0.0, -0.240, 0.262), (0.0, 0.0, 0.262), lens=35, fstop=4.0, focus=focus)
    sc.view_settings.exposure = -0.5 if FRAME == "first" else -0.8


def scene_c2():
    """컷 2: 서 있는 캔 몸통, 오른 옆면의 큰 세로 낱말표(아래→위)가 화면 왼쪽. 서리 · 물방울, 왼쪽 가장자리 밝은 역광."""
    sc = reset()
    world_color((0.006, 0.012, 0.045), 1.0)
    FROST_BIAS[0], FROST_BIAS[1] = 0.12, 0.08
    FROST_CLEAR[0], FROST_CLEAR[1], FROST_CLEAR[2] = 0.30, -0.011, 0.010  # 낱말표 둘레는 맑게(원본도 로고 위는 맑다)
    FROST_RGB_SET((0.40, 0.52, 0.74))
    can = make_can(frost=0.48, frost_scale=14.0, frost_seed=3.0, wet_bump=0.5)  # 세 값 시험 중 원본에 가장 가까운 것
    # 낱말표 방향(앞면 기준 +106°)을 카메라 기준 왼쪽 20°로
    can.rotation_euler = (0, 0, math.radians(-SIDE_DEG - 20))
    droplets(can, n=3600, z_range=(4, 116), ang_range=(SIDE_DEG - 80, SIDE_DEG + 95), r_range=(0.20, 1.8),
             power=2.4, seed=11)
    camera((-0.0026, -0.297, 0.058), (-0.0026, 0.0, 0.058), lens=100, fstop=4.5, focus=0.266)
    area_light("rim_l", (-0.15, 0.08, 0.058), (0, 0, 0.058), 12, 0.05, rgb=(0.20, 0.72, 1.0), size_y=0.45)
    # 왼쪽 앞 반사판: 바니시에 비쳐 낱말표 둘레가 밝은 남청으로(원본의 밝은 파랑 자리)
    sheen = area_light("sheen", (-0.12, -0.25, 0.06), (0, 0, 0.058), 2.0, 0.10, rgb=(0.12, 0.32, 1.0), size_y=0.6)
    sheen.visible_diffuse = False
    gl = area_light("glint", (0.02, -0.34, 0.14), (0, 0, 0.058), 0.25, 0.15, rgb=(0.80, 0.88, 1.0), size_y=0.2)
    gl.visible_diffuse = False
    area_light("key", (-0.10, -0.20, 0.20), (0, 0, 0.058), 2.2, 0.25, rgb=(0.85, 0.92, 1.0))
    area_light("fill_r", (0.25, -0.12, 0.03), (0, 0, 0.058), 0.6, 0.3, rgb=(0.25, 0.38, 1.0))
    backdrop("bg", (0.008, 0.02, 0.10), 1.0, (0.0, 0.35, 0.06), size=(1.2, 1.2))
    sc.view_settings.exposure = 0.3


def scene_c3():
    """컷 3: 젖은 반사 바닥 위 캔(가운데 오른쪽 · 초점), 왼쪽 앞 크게 흐린 캔, 오른쪽 뒤 작게 흐린 캔. 뒤 세로 네온(루비 · 흰 · 연분홍) 역광."""
    sc = reset()
    world_color((0.0, 0.0, 0.0), 0.0)
    wet_floor()
    hero = make_can(wet_bump=0.6)
    hero.location = (0.0, 0.0, 0.0)
    hero.rotation_euler = (0, 0, math.radians(-6))
    droplets(hero, n=800, z_range=(6, 116), ang_range=(-95, 95), r_range=(0.10, 0.50), power=2.6, seed=31)
    front = make_can(wet_bump=0.6)
    front.location = (-0.046, -0.30, 0.0)
    front.rotation_euler = (0, 0, math.radians(30))
    back = make_can(wet_bump=0.6)
    back.location = (0.075, 0.30, 0.0)
    back.rotation_euler = (0, 0, math.radians(-25))
    ruby, white, pink = (0.62, 0.02, 0.06), (1.0, 0.97, 0.95), (0.95, 0.50, 0.62)
    cols = [white, ruby, white, pink, ruby, white, ruby, pink, white, ruby, white, pink]
    xs = [-0.40, -0.33, -0.26, -0.19, -0.12, -0.05, 0.02, 0.09, 0.16, 0.23, 0.30, 0.37]
    for i, (x, c) in enumerate(zip(xs, cols)):
        strength = 6.0 if c == white else 18.0
        box(f"neon{i}", (0.030, 0.02, 1.6), (x, 1.00 + 0.05 * (i % 3), 0.80), mat=mat_emit(f"ne{i}", c, strength))
    backdrop("glow", (0.50, 0.30, 0.36), 0.5, (0.0, 1.25, 0.6), size=(2.0, 1.6))
    camera((-0.007, -0.69, 0.064), (-0.007, 0.0, 0.060), lens=100, fstop=2.8, focus=0.69)
    area_light("top", (0.0, -0.10, 0.45), (0, 0, 0.06), 6, 0.4, rgb=(0.95, 0.92, 1.0))
    fr = area_light("front", (-0.10, -0.50, 0.12), (0, 0, 0.06), 3.0, 0.3, rgb=(1.0, 0.92, 0.95))
    fr.visible_glossy = False
    st = area_light("strip_l", (-0.30, -0.30, 0.06), (0, 0, 0.06), 3.0, 0.04, rgb=(1.0, 0.9, 0.95), size_y=0.5)
    area_light("rim_top", (0.0, 0.25, 0.35), (0, 0, 0.10), 6.0, 0.3, rgb=(1.0, 0.85, 0.9))
    sc.view_settings.exposure = -0.4


def scene_c4():
    """컷 4: 기울인 캔 입구 극접사 — 뚜껑이 화면 왼쪽 위에서 카메라를 향하고, 아래쪽 마시는 구멍에서 루비색 액체가
    굵은 줄기로 오른쪽 아래로 쏟아진다. 짙은 남색 바탕 · 아래 왼쪽에 옅은 김."""
    sc = reset()
    world_gradient((0.004, 0.010, 0.05), (0.06, 0.14, 0.55), 1.0)
    can = make_can(wet_bump=0.4, tab=True, tab_lift=50.0)
    hole = bpy.data.meshes.new("holecut")
    bm = bmesh.new()
    pts = []
    for i in range(40):
        a = 2 * math.pi * i / 40
        x = 9.5 * math.cos(a)
        y = -14.8 + 6.4 * math.sin(a) * (1.0 + 0.35 * math.cos(a) ** 2)
        pts.append((x * MM, y * MM))
    top = [bm.verts.new((x, y, 125 * MM)) for x, y in pts]
    bot = [bm.verts.new((x, y, 112 * MM)) for x, y in pts]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    for i in range(len(pts)):
        bm.faces.new((top[i], bot[i], bot[(i + 1) % len(pts)], top[(i + 1) % len(pts)]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(hole)
    bm.free()
    hob = bpy.data.objects.new("holecut", hole)
    bpy.context.collection.objects.link(hob)
    hob.hide_render = True
    hob.parent = can
    bo = can.modifiers.new("hole", "BOOLEAN")
    bo.object = hob
    bo.operation = "DIFFERENCE"
    inside = cylinder("inside", 25.5 * MM, 1 * MM, (0, 0, 115.5 * MM), mat=mat_simple("dark", base=(0.06, 0.0, 0.01), rough=0.08))
    inside.parent = can
    # 캔 축(바닥→뚜껑)이 카메라 쪽 · 아래 · 오른쪽을 향하게 기울이고, 구멍(-Y)이 가장 낮게 돈다
    d = Vector((0.34, -0.74, -0.58)).normalized()
    can.rotation_mode = "QUATERNION"
    base_q = d.to_track_quat("Z", "Y")
    best = None
    for k in range(72):
        q = base_q @ Euler((0, 0, math.radians(k * 5))).to_quaternion()
        z = (q @ Vector((0, -1, 0))).z
        if best is None or z < best[0]:
            best = (z, q)
    can.rotation_quaternion = best[1]
    bpy.context.view_layer.update()
    M = can.matrix_world
    mouth = M @ Vector((0, -19.5 * MM, 119.0 * MM))
    lid_c = M @ Vector((0, 0, 119.0 * MM))
    out_dir = (mouth - lid_c).normalized()
    down = Vector((0, 0, -1))
    side = Vector((1, 0, 0))
    pts = [mouth,
           mouth + out_dir * 0.006 + down * 0.004,
           mouth + out_dir * 0.010 + down * 0.016 + side * 0.006,
           mouth + out_dir * 0.012 + down * 0.040 + side * 0.022,
           mouth + out_dir * 0.012 + down * 0.075 + side * 0.044,
           mouth + out_dir * 0.010 + down * 0.120 + side * 0.068,
           mouth + out_dir * 0.008 + down * 0.170 + side * 0.090]
    widths = [0.024, 0.027, 0.026, 0.025, 0.024, 0.023, 0.022]
    st = stream_mesh("stream", [tuple(p) for p in pts], widths, thick=0.95, twist=1.4, mat=mat_liquid(density=50.0))
    for m_ in st.modifiers:
        if m_.type == "DISPLACE":
            m_.strength = 0.0011
            m_.texture.noise_scale = 0.0045
    # 줄기 속 잔 기포(탄산) — 줄기 가운데 선을 따라
    rnd4 = random.Random(44)
    bpts = []
    for k_ in range(len(pts) - 1):
        a_, b_ = pts[k_], pts[k_ + 1]
        for _ in range(26):
            t_ = rnd4.random()
            c_ = a_.lerp(b_, t_)
            w_ = widths[k_] * 0.32
            bpts.append((c_.x + rnd4.uniform(-w_, w_), c_.y + rnd4.uniform(-w_ * 0.5, w_ * 0.5), c_.z + rnd4.uniform(-0.002, 0.002),
                         rnd4.uniform(0.00015, 0.0006)))
    bubbles_mesh("stream_bubbles", bpts, mat_air_in_liquid())
    backdrop("bg", (0.006, 0.02, 0.16), 1.0, (0.0, 0.50, 0.0), size=(2.0, 2.0), grad=((0.02, 0.08, 0.42), "Y"))
    mist("mist", (0.30, 0.10, 0.10), tuple(lid_c + Vector((-0.06, 0.12, -0.13))), density=4.0, scale=10.0,
         rgb=(0.45, 0.6, 1.0), seed=4.0)
    tgt = lid_c + Vector((0.016, 0.0, -0.030))
    cam_loc4 = tgt + Vector((0.028, -0.205, -0.016))
    focus4 = (pts[2] - cam_loc4).length  # 초점은 입구 바로 아래 줄기(뚜껑 먼 쪽이 살짝 풀리는 것은 원본과 같다)
    camera(tuple(cam_loc4), tuple(tgt), lens=100, fstop=13.0, focus=focus4)
    mist("mist_low", (0.05, 0.03, 0.022), tuple(tgt + Vector((-0.018, 0.035, -0.030))), density=90.0, scale=90.0,
         rgb=(0.55, 0.70, 1.0), lo=0.40, hi=0.80, seed=6.0)
    area_light("rim_r", tuple(tgt + Vector((0.20, 0.10, 0.05))), tuple(tgt), 1.0, 0.01, rgb=(0.45, 0.70, 1.0), size_y=0.3)
    area_light("rim_l", tuple(tgt + Vector((-0.20, 0.08, 0.00))), tuple(tgt), 0.8, 0.01, rgb=(0.4, 0.65, 1.0), size_y=0.3)
    # 뚜껑(알루미늄 거울면)이 비추는 쪽 = 카메라에서 뚜껑으로 온 빛줄이 꺾여 나가는 아래 오른쪽 — 그 자리에 큰 판
    n_lid = (M.to_3x3() @ Vector((0, 0, 1))).normalized()
    v = (lid_c - (tgt + Vector((0.028, -0.205, -0.016)))).normalized()
    r = (v - 2 * v.dot(n_lid) * n_lid).normalized()
    lidrefl = area_light("lid_refl", tuple(lid_c + r * 0.40), tuple(lid_c), 1.4, 0.60, rgb=(0.45, 0.62, 1.0), size_y=0.45)
    lidrefl.visible_diffuse = False
    area_light("key", tuple(tgt + Vector((-0.06, -0.22, 0.22))), tuple(tgt), 3, 0.25, rgb=(0.92, 0.95, 1.0))
    area_light("back", tuple(tgt + Vector((0.02, 0.25, -0.02))), tuple(tgt), 3, 0.20, rgb=(1.0, 0.55, 0.65))
    # 뚜껑 알루미늄이 비출 큰 판(카메라 뒤 위) — 반사에만 보인다
    env = area_light("env", tuple(tgt + Vector((-0.06, -0.45, 0.14))), tuple(tgt), 1.2, 0.7, rgb=(0.55, 0.70, 1.0), size_y=0.6)
    kick = area_light("kick", tuple(tgt + Vector((0.16, -0.10, 0.18))), tuple(tgt), 1.2, 0.03, rgb=(0.85, 0.92, 1.0), size_y=0.35)
    # 빛은 캔(뚜껑 · 당김 고리)만 받게 — 줄기 가장자리에 빛이 비쳐 흰 테두리가 두껍게 생겼다(빛을 하나씩 빼서 가름).
    # 줄기는 세계 그라데이션과 줄기 뒤 빛(액체 너머로만 보임)으로만 밝힌다
    can_parts = bpy.data.collections.new("can_parts")
    bpy.context.scene.collection.children.link(can_parts)
    for ob in [can] + list(can.children_recursive):
        can_parts.objects.link(ob)
    for ob in bpy.context.scene.objects:
        if ob.type == "LIGHT":
            ob.light_linking.receiver_collection = can_parts
    env.visible_diffuse = False
    # 줄기 표면의 가는 젖은 광택 줄 — 줄기만 받고 반사로만 보이게(확산 · 투과에는 없음)
    spec = area_light("stream_spec", tuple(tgt + Vector((-0.10, -0.16, 0.10))), tuple(pts[3]), 0.6, 0.006,
                      rgb=(1.0, 0.97, 0.98), size_y=0.12)
    spec.visible_diffuse = False
    spec.visible_transmission = False
    spec.visible_volume_scatter = False
    st_only = bpy.data.collections.new("stream_only")
    bpy.context.scene.collection.children.link(st_only)
    st_only.objects.link(st)
    spec.light_linking.receiver_collection = st_only
    # 줄기 뒤에서 비추는 가는 빛 — 액체 속이 루비로 빛나게
    # 줄기와 같은 길을 뒤로 0.12 m 옮긴 빛 띠: 카메라에는 직접 안 보이고 액체를 지나는 빛에만 보인다
    # 빨간 액체 너머가 남색 바탕이면 줄기가 검붉게 죽는다 — 뒤 빛 띠를 넓고 밝게 해 줄기 속이 루비로 빛나게
    glow = stream_mesh("stream_glow", [tuple(p + Vector((0.0, 0.12, 0.0))) for p in pts], [w * 2.6 for w in widths],
                       thick=0.8, mat=mat_emit("glowm", (1.0, 0.35, 0.42), 6.0))
    glow.visible_camera = False
    glow.visible_glossy = False
    glow.visible_diffuse = False
    glow.visible_shadow = False
    sc.view_settings.exposure = -0.4


def scene_c5():
    """컷 5: 잔 가장자리 높이 접사 — 위에 잔 테, 가운데 아래에 액체 면과 거품 띠, 그 아래 루비색 액체 · 얼음 · 촘촘한 기포.
    빈 잔 위쪽 너머로 옅은 남색 · 연분홍 세로 막대 역광, 오른쪽에 붓는 가는 줄기."""
    sc = reset()
    world_color((0.0, 0.0, 0.0), 0.0)
    R, Hg, wall, base = 0.040, 0.125, 0.0025, 0.012
    prof = [(0.0, 0.0), (R, 0.0), (R, Hg - 0.0012), (R - 0.0004, Hg), (R - wall + 0.0004, Hg), (R - wall, Hg - 0.0012),
            (R - wall, base), (R - wall - 0.002, base - 0.0005), (0.0, base - 0.0008)]
    revolve("glass", prof, segs=180, mat=mat_glass())
    level = 0.0790
    ri = R - wall - 0.00015
    revolve("liquid", [(0.0, base + 0.0002), (ri, base + 0.0002), (ri, level), (0.0, level)], segs=180,
            mat=mat_liquid(density=60.0))
    rnd = random.Random(5)
    # 거품: 잔 벽에 눌린 기포층(앞쪽 반)만 — 뒤에 흰 덩이를 두면 안개처럼 번졌다
    foam_pts = []
    for _ in range(1100):  # 크기가 들쭉날쭉한 얇은 막(Fable v1: 고른 구슬 5천 개는 스티로폼으로 보였다)
        a_ = rnd.uniform(-math.pi * 0.98, -math.pi * 0.02)
        r_b = math.exp(rnd.uniform(math.log(0.0003), math.log(0.0025)))
        rr = ri - r_b - rnd.uniform(0.0, 0.0015)
        thick_here = 0.0025 + 0.0045 * (0.5 + 0.5 * math.sin(a_ * 7.0 + 1.3)) * rnd.random()
        z = level - 0.0008 + rnd.random() * thick_here
        foam_pts.append((rr * math.cos(a_), rr * math.sin(a_), z, r_b))
    fm, n, l, out = new_mat("foam_film")
    fb = principled(n, base=(1.0, 0.86, 0.90), rough=0.03, ior=1.33, trans=0.98)
    l.new(shadow_pass(n, l, fb.outputs[0]).outputs[0], out.inputs["Surface"])
    bubbles_mesh("foam_bubbles", foam_pts, fm)
    # 얼음(액체 안): 상대 굴절률 + 흐린 속
    ice_in = mat_ice(cloud=6.0)
    for nd in ice_in.node_tree.nodes:
        if nd.type == "BSDF_PRINCIPLED":
            nd.inputs["IOR"].default_value = 1.31 / 1.34
    ice_cubes(5, (-0.022, 0.022, -0.022, 0.018, 0.030, 0.060), size=(0.024, 0.030), seed=8, mat=ice_in)
    # 수면에 뜬 얼음 둘 — 물 위로 4 mm쯤 드러나 보이게(공기 속 얼음 재질)
    ice_cubes(2, (-0.020, 0.016, -0.030, -0.012, level - 0.007, level - 0.005), size=(0.022, 0.026), seed=13,
              mat=mat_ice(cloud=3.0))
    # 기포: 액체 속 오르는 잔 기포 + 앞 벽에 붙은 기포
    pts = []
    for _ in range(5200):
        a_ = rnd.uniform(0, 2 * math.pi)
        rr = (ri - 0.0006) * math.sqrt(rnd.random())
        z = rnd.uniform(base + 0.004, level - 0.0012)
        pts.append((rr * math.cos(a_), rr * math.sin(a_), z, rnd.uniform(0.00014, 0.00042)))
    for _ in range(1600):
        a_ = rnd.uniform(-math.pi * 0.95, -math.pi * 0.05)
        r_b = rnd.uniform(0.00012, 0.00045)
        rr = ri - r_b - 0.00003
        z = rnd.uniform(base + 0.004, level - 0.001)
        pts.append((rr * math.cos(a_), rr * math.sin(a_), z, r_b))
    for _ in range(46):  # 기포 기둥: 바닥에서 수면까지 줄지어 오른다
        a_ = rnd.uniform(-math.pi * 0.95, -math.pi * 0.05) if rnd.random() < 0.7 else rnd.uniform(0, 2 * math.pi)
        rr = (ri - 0.0012) * math.sqrt(rnd.uniform(0.35, 1.0))
        cx_, cy_ = rr * math.cos(a_), rr * math.sin(a_)
        z = base + 0.003 + rnd.uniform(0, 0.004)
        while z < level - 0.0012:
            r_c = rnd.uniform(0.00022, 0.00050)
            pts.append((cx_ + rnd.uniform(-0.0002, 0.0002), cy_ + rnd.uniform(-0.0002, 0.0002), z, r_c))
            z += rnd.uniform(0.0012, 0.0021)
    bubbles_mesh("bubbles", pts, mat_air_in_liquid())
    # 빈 잔 벽 안쪽에 맺힌 잔 물방울 · 튄 기포(액체 위)
    dp = []
    for _ in range(1000):
        a_ = rnd.uniform(-math.pi * 0.95, -math.pi * 0.05)
        r_d = rnd.uniform(0.00010, 0.00040)
        rr = ri - r_d * 0.5
        z = level + 0.007 + (Hg - 0.004 - level - 0.007) * rnd.random() ** 1.6
        dp.append((rr * math.cos(a_), rr * math.sin(a_), z, r_d))
    bubbles_mesh("wall_drops", dp, mat_water())
    # 붓는 줄기(오른쪽, 위에서 수직)
    stream_mesh("pour", [(0.021, -0.008, Hg + 0.08), (0.021, -0.008, Hg + 0.02), (0.020, -0.008, level + 0.03),
                         (0.019, -0.008, level + 0.004)], [0.0095, 0.0090, 0.0086, 0.0090], thick=0.9,
                mat=mat_liquid(density=18.0))
    # 뒤 세로 막대: 옅은 남색 · 연분홍(원본 하늘색 · 분홍 자리) — 빈 잔 너머로 보인다
    pale_navy = (0.16, 0.30, 1.0)
    pink = (1.0, 0.18, 0.48)
    bars = [(-0.09, pale_navy, 0.12), (0.000, pink, 0.034), (0.034, pale_navy, 0.022), (0.075, pink, 0.06)]
    for i, (x, c, w) in enumerate(bars):
        backdrop(f"bar{i}", c, 4.0, (x, 0.30, 0.10), size=(w, 0.6))
    backdrop("bgfill", (0.12, 0.24, 0.90), 1.6, (0.0, 0.32, 0.10), size=(0.8, 0.8))
    camera((0.004, -0.229, 0.0944), (0.004, 0.0, 0.0944), lens=100, fstop=8.0, focus=0.190)
    area_light("top", (0.0, -0.02, 0.30), (0, 0, 0.09), 9, 0.25)
    area_light("front", (-0.12, -0.25, 0.10), (0, 0, 0.09), 3.0, 0.3, rgb=(1.0, 0.95, 0.97))
    sc.view_settings.exposure = -1.1


def scene_c6():
    """컷 6: 기울인 캔 위쪽 앞면 접사 — 캔 축이 화면 대각선(위 끝이 왼쪽 위). 어깨가 위 가장자리를 가로지르고,
    엠블럼이 왼쪽 위에 크게, 낱말표가 오른쪽 위로 비스듬히, 오른쪽 아래 모서리에 바닥 테가 흐리게."""
    sc = reset()
    world_color((0.01, 0.02, 0.08), 1.0)
    make_can(wet_bump=0.0)
    tgt = (-0.003, -0.032, 0.0715)
    cam6 = camera((-0.037, -0.230, 0.0715), tgt, lens=100, roll_deg=-33, fstop=4.0, focus=0.200)
    cam6.location += cam6.matrix_world.to_3x3() @ Vector((0.0034, 0.0009, 0.0))  # 엠블럼 가운데가 폭 50% → 원본처럼 약 37%
    key = area_light("key", (-0.06, -0.22, 0.28), (0, 0, 0.07), 6, 0.40, rgb=(0.92, 0.95, 1.0))
    key.visible_glossy = False
    # 캔 축을 따라 비치는 긴 반사(원본의 밝은 대각 띠)
    area_light("strip", (0.16, -0.12, 0.05), (0, 0, 0.05), 2.5, 0.05, rgb=(0.35, 0.65, 1.0), size_y=0.5)
    area_light("rim_r", (0.22, 0.14, 0.12), (0, 0, 0.07), 2.0, 0.03, rgb=(0.25, 0.75, 1.0), size_y=0.4)
    area_light("fill", (0.10, -0.25, 0.0), (0, 0, 0.07), 1.0, 0.4, rgb=(0.5, 0.6, 1.0))
    backdrop("bg", (0.02, 0.10, 0.50), 3.0, (0.0, 0.40, 0.08), size=(1.5, 1.5), grad=((0.06, 0.45, 1.0), "X"))
    sc.view_settings.exposure = -1.3


SCENES = {"test": scene_test, "label": scene_label, "1": scene_c1, "2": scene_c2, "3": scene_c3, "4": scene_c4, "5": scene_c5, "6": scene_c6}


def main():
    SCENES[CUT]()
    if EXPOSURE is not None:
        bpy.context.scene.view_settings.exposure = float(EXPOSURE)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sc = bpy.context.scene
    sc.render.filepath = OUT
    if SAVE:
        bpy.ops.wm.save_as_mainfile(filepath=OUT.replace(".png", ".blend"))
    bpy.ops.render.render(write_still=True)
    print("RENDERED", OUT)


if __name__ == "__main__":  # 3번 FOOH 장면(fooh-cg-20261024/블렌더)이 캔 · 재질 도우미만 빌려 쓴다
    main()

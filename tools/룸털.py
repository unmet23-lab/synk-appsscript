"""Loom 털 — 펠트↔털 축의 Blender Cycles 장면 (v1 · 2026-08-18).

무엇 — 유호 지시 08-18 「첨부 사진처럼 질감이 살아 움직이는 것처럼」의 실물 통로.
       재질 넷(3D초현실·펠트·레진·글래시)을 섞던 판을 **섬유 하나**로 좁힌 자리다:
       펠트와 털은 다른 재질이 아니라 «같은 섬유의 두 상태»이고, 가르는 것은 셋뿐이다
       — 길이 · 세움 · 밀도. 그래서 한 통로가 축 전체를 낸다(개선이 한 갈래에 쌓인다).

돌리는 법
    blender -b -P tools/룸털.py -- --out 판.png --px 900 --samples 160 --hair 30000 --child 50
    (--coral 을 주면 마스코트 코랄. Blender 는 저장소에 안 넣는다 — 공식 tarball 을 받아 쓴다.)

🔴 exit 0 함정 — `blender -b -P` 는 스크립트가 예외로 죽어도 종료코드 0 이다.
   시간·종료코드·stderr 어느 것도 근거가 아니라, 마지막에 «판이 디스크에 있는지»를 본다.

━━ 축 다섯 — 전부 «양쪽 끝이 다 실패한다». 한쪽만 적으면 다음 사람이 그쪽으로 민다 ━━
   실측 2026-08-18 · 열두 판의 왕복에서 건진 것이고, 그 왕복 자체가 이 표가 없어서 났다.

  ① 길이       길면 → 털이 형태를 «먹는다»(털공)      | 짧으면 → 실루엣에만 남고 결이 없다
  ② 굵기       굵으면 → 「양털 러그」                  | 가늘면 → 「반투명 솜」(형태가 비친다)
  ③ 광원 크기  작으면 → 자체 그림자가 딱딱해 표면 얼룩 | 크면 → **명암이 통째로 사라진다**
                                                        (피사체 반경의 2~3배가 자리 · 7배는 반구 조명이다)
  ④ 변이       크면 → 헝클어진 「양털」                | 작으면 → 매끈한 「면」
                ⚠**엔진마다 반대다** — Canvas 는 획을 직접 그어서 변이를 크게 줘야 자연스럽고,
                  Cycles 는 실제 기하라 같은 값이 그대로 «헝클어짐»이 된다.
  ⑤ 눕힘       크면 → 표면에 «붙어» 결이 사라진다     | 작으면 → 정면에서 «끝»만 보여 결이 없다

🔑 **끝은 뾰족해야 한다**(tip_radius = 0 · 기본값). 유호 판정 08-18 「털이 기하학적이고 징그럽다」의
   범인이 정확히 이것이었다 — 끝에 두께를 주면 가닥이 «뭉툭한 막대»가 되고, 수십만 개가 모이면
   생물이 아니라 «구조물»로 읽힌다. 굵기를 손으로 고정하는 것도 같은 이유로 하지 않는다
   (균일함 자체가 인공이다 · Blender 기본은 뿌리→끝으로 자연히 가늘어진다).

🔑 형태는 **ico sphere 를 superellipsoid 로 접는다**. 큐브+베벨+서브서프는 면 크기가 극도로
   불균일해 파티클이 큰 면에만 몰리고, 렌더에 «맨살 패치»로 나온다(실측). ico 는 삼각형이 고르고,
   정점을 직접 접으면 Canvas 판과 «같은 수식»이라 두 층이 같은 형태를 말한다.

⚠ 아직 안 한 것 — 사진의 «2겹 구조»(뒤 진한 회색 + 앞 밝은 흰색)는 이 판에 없다. 한 덩어리다.
"""
import bpy, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def 인자(이름, 기본):
    return argv[argv.index(이름) + 1] if 이름 in argv else 기본

OUT = 인자("--out", "/tmp/loom_fur.png")
PX = int(인자("--px", "900"))
SAMPLES = int(인자("--samples", "96"))
HAIR = int(인자("--hair", "12000"))
CHILD = int(인자("--child", "24"))
LEN = float(인자("--len", "0.155"))
CORAL = "--coral" in argv

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ── 형태: ico sphere 를 superellipsoid 로 «접는다» ─────────────────────
# 🔴 큐브+bevel+subsurf 는 면 크기가 극도로 불균일해서 파티클이 큰 면에만 몰렸다
#    (렌더에 «맨살 패치»로 나왔다). ico 는 삼각형이 고르고, 정점을 직접 접으면
#    Canvas 판과 «같은 수식»의 squircle 이 나온다 — 두 층이 같은 형태를 말하게 된다.
NEXP = 4.2
AX = (1.00, 0.97, 0.83)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=1.0)
ob = bpy.context.object
for v in ob.data.vertices:
    d = v.co.normalized()
    k = (abs(d.x / AX[0]) ** NEXP + abs(d.y / AX[1]) ** NEXP + abs(d.z / AX[2]) ** NEXP) ** (-1.0 / NEXP)
    v.co = d * k

# ⓒ 유기적 변형 — 완벽한 대칭은 «도표»의 얼굴이다
tex = bpy.data.textures.new("wob", type='CLOUDS')
tex.noise_scale = 2.1
disp = ob.modifiers.new("wob", 'DISPLACE')
disp.texture = tex
disp.strength = 0.052
disp.mid_level = 0.5

bpy.ops.object.shade_smooth()

# ── 털 — 2층 ─────────────────────────────────────────────────────────
# 🔴 한 층만 쓰면 아무리 심어도 «면»이 된다(실측: 0.34 균일 길이 = 매끈한 덩어리).
#    실물 모피는 «촘촘한 속털» + «길게 삐져나오는 겉털» 두 층이고,
#    실루엣에서 털로 읽히게 만드는 것은 **겉털**이다.
def 털층(이름, 개수, 자식, 길이, 뭉침, 거칠, 반경):
    ob.modifiers.new(이름, 'PARTICLE_SYSTEM')
    ps = ob.particle_systems[-1]
    st = ps.settings
    st.name = 이름
    st.type = 'HAIR'
    st.count = 개수
    st.hair_length = 길이
    st.hair_step = 5
    st.render_type = 'PATH'
    st.use_advanced_hair = True
    st.distribution = 'RAND'
    st.use_even_distribution = True
    st.userjit = 0
    st.child_type = 'INTERPOLATED'
    st.rendered_child_count = 자식
    st.child_percent = 자식
    st.child_radius = 반경
    st.child_roundness = 0.6
    st.child_length = 1.0
    st.child_length_threshold = 0.30
    st.clump_factor = 뭉침
    st.clump_shape = 0.22
    st.roughness_1 = 거칠
    st.roughness_1_size = 0.20
    st.roughness_2 = 거칠 * 1.5
    st.roughness_2_size = 0.55
    st.roughness_endpoint = 거칠 * 1.3
    st.kink = 'NO'
    st.effector_weights.gravity = 0.145
    st.brownian_factor = 0.0
    return st

_속 = 털층("undercoat", int(HAIR * 0.86), CHILD, LEN * 0.58, 0.26, 0.008, 0.030)
_겉 = 털층("guard",     int(HAIR * 0.14), max(6, CHILD // 5), LEN * 1.65, 0.18, 0.018, 0.062)

ob.show_instancer_for_render = False

# ── 재질: Principled Hair BSDF ────────────────────────────────────────
mat = bpy.data.materials.new("loom_fur")
mat.use_nodes = True
nt = mat.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
hair = nt.nodes.new('ShaderNodeBsdfHairPrincipled')
out = nt.nodes.new('ShaderNodeOutputMaterial')
try:
    hair.parametrization = 'COLOR'
except Exception:
    pass
def 넣(이름, 값):
    if 이름 in hair.inputs:
        hair.inputs[이름].default_value = 값
넣("Color", (0.72, 0.30, 0.26, 1.0) if CORAL else (0.875, 0.875, 0.875, 1.0))
넣("Roughness", 0.44)
넣("Radial Roughness", 0.36)
넣("Coat", 0.20)
넣("Random Color", 0.055)     # 가닥마다 미세하게 다른 색 — 균일함을 깨는 자리
넣("Random Roughness", 0.10)
nt.links.new(hair.outputs[0], out.inputs[0])
ob.data.materials.append(mat)

# ── 조명 3점 ─────────────────────────────────────────────────────────
def 등(이름, 위치, 에너지, 크기, 겨냥=(0, 0, 0)):
    d = bpy.data.lights.new(이름, type='AREA')
    d.energy = 에너지
    d.size = 크기
    o = bpy.data.objects.new(이름, d)
    scene.collection.objects.link(o)
    o.location = 위치
    dirv = Vector(겨냥) - Vector(위치)
    o.rotation_euler = dirv.to_track_quat('-Z', 'Y').to_euler()
    return o

등("key",  (-3.0, -3.8, 3.6), 620, 2.8)
등("fill", (4.2, -1.2, -2.0), 14, 6.0)
등("rim",  (0.4, 4.6, 2.6), 560, 2.2)

world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.0045, 0.0048, 0.0060, 1.0)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

# ── 카메라 — 정면·정중앙·꽉 참은 «도표»의 눈이다. 살짝 옆에서, 여백을 두고 ──
cd = bpy.data.cameras.new("cam")
cd.lens = 85
cam = bpy.data.objects.new("cam", cd)
scene.collection.objects.link(cam)
cam.location = (1.15, -7.5, 1.25)
cam.rotation_euler = (Vector((0, 0, 0.02)) - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam
cd.dof.use_dof = True
cd.dof.focus_object = ob
cd.dof.aperture_fstop = 4.2

# ── 렌더 ─────────────────────────────────────────────────────────────
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 8
scene.cycles.transmission_bounces = 8
scene.cycles.transparent_max_bounces = 24     # 털은 투과가 많다 — 낮으면 «검게» 막힌다
scene.cycles.blur_glossy = 0.0
try:
    scene.cycles.curve_subdivisions = 2
except Exception:
    pass
scene.render.resolution_x = PX
scene.render.resolution_y = PX
scene.render.film_transparent = False
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = OUT
_vt = [v.name for v in scene.view_settings.bl_rna.properties['view_transform'].enum_items]
for _c in ('AgX', 'Filmic', 'Standard'):
    if _c in _vt:
        scene.view_settings.view_transform = _c
        break
_lk = [v.name for v in scene.view_settings.bl_rna.properties['look'].enum_items]
for _c in ('AgX - Punchy', 'Punchy', 'None'):
    if _c in _lk:
        scene.view_settings.look = _c
        break
scene.view_settings.exposure = -0.10

if os.path.exists(OUT):
    os.remove(OUT)
# 진단 — 파티클이 실제로 몇 가닥 평가되는지 «렌더 전에» 찍는다(0 이면 위가 전부 무의미)
dg = bpy.context.evaluated_depsgraph_get()
_ev = ob.evaluated_get(dg)
try:
    for _ps in _ev.particle_systems:
        print("DIAG %s particles=%d child=%d len=%.3f" % (
            _ps.settings.name, len(_ps.particles), _ps.settings.rendered_child_count,
            _ps.settings.hair_length))
except Exception as e:
    print("DIAG FAIL", e)

bpy.ops.render.render(write_still=True)

# 🔴 exit 0 함정 — 시간·종료코드·stderr 어느 것도 근거가 아니다. 판이 «있는지»를 본다
if not os.path.exists(OUT) or os.path.getsize(OUT) < 2000:
    sys.stderr.write("RENDER_MISSING: %s\n" % OUT)
    sys.exit(3)
print("RENDER_OK %s %d bytes" % (OUT, os.path.getsize(OUT)))

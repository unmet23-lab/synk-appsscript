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

━━ 축 ⑥ 톤 — **재 봤고, 레버가 아니었다**(2026-08-19 · 세 판 실측) ━━━━━━━━━━━━━━━
   「앞 덩어리가 흰색이 아니라 회색으로 읽힌다」의 범인이 톤 곡선(AgX)일 것이라 보고 A/B 했다.
   결과는 **아니다** — 톤도 노출도 이 축에서 ±7/255 밖에 안 움직인다:

     판                    뒤 덩어리   앞(위)   앞(중앙)
     AgX · exposure -0.10     99.1     141.5     124.9
     Standard · 0.0          103.6     149.0     129.5
     AgX · +0.90 EV          105.7     148.7     132.0

   🔑 +0.9 EV 를 줘도 앞이 7 밖에 안 오른다 = **한계는 조명이 아니라 재질**이다. 섬유 덩어리는
      가닥 사이 다중산란으로 스스로를 어둡게 만든다(흰 털뭉치가 사진에서 0.5~0.6 로 찍히는 그 이유).
      ⇒ 「더 희게」를 원하면 손댈 자리는 톤이 아니라 **광원 세기(축 ③)** 이고, 그건 명암을 먹는다.
      다음 사람이 이 A/B 를 다시 하지 않도록 표째 남긴다.
   ⚠ 앞/뒤 분리는 **되고 있다**(99 vs 141 ≈ 0.70) — 2겹 구조는 섰다(2026-08-19 렌더로 확인).

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

# 🔑 털 레시피는 **여기 없다** — `tools/lib/룸섬유.py` 하나가 진다(부품 굽는 층과 같은 값을 써야 한다).
#    두 벌로 적으면 갈라지고, 갈라진 날 시험대만 좋아지고 지면의 부품은 그대로다.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import 룸섬유

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def 인자(이름, 기본):
    return argv[argv.index(이름) + 1] if 이름 in argv else 기본

OUT = 인자("--out", "/tmp/loom_fur.png")
PX = int(인자("--px", "900"))
SAMPLES = int(인자("--samples", "96"))
HAIR = int(인자("--hair", "12000"))
CHILD = int(인자("--child", "24"))
LEN = float(인자("--len", "0.155"))
TONE = 인자("--tone", "AgX")            # AgX | Standard | Filmic — 축 ⑥(아래 톤 절)
EXPO = float(인자("--exposure", "-0.10"))
CORAL = "--coral" in argv

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ── 덩어리 하나 = 형태 + 털 2층 + 재질 ────────────────────────────────
# 레퍼런스의 «깊이»는 두 덩어리의 겹침에서 온다 — 뒤는 진한 회색, 앞은 밝은 흰색.
# 한 덩어리만 두면 아무리 잘 구워도 «단품 사진»이고, 겹쳐야 «한 세계»가 된다.
NEXP = 4.2

def 덩어리(이름, 위치, 크기, 밝기, 뭉치수, 자식수, 길이, 축=(1.00, 0.97, 0.83), 흔들=0.052):
    """ico sphere 를 superellipsoid 로 접고, 털 2층을 심고, 재질을 물린다."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=1.0)
    ob = bpy.context.object
    ob.name = 이름
    for v in ob.data.vertices:
        d = v.co.normalized()
        k = (abs(d.x / 축[0]) ** NEXP + abs(d.y / 축[1]) ** NEXP + abs(d.z / 축[2]) ** NEXP) ** (-1.0 / NEXP)
        v.co = d * k
    ob.scale = (크기, 크기, 크기)
    ob.location = 위치
    bpy.ops.object.transform_apply(scale=True, location=True)

    # ⓒ 유기적 변형 — 완벽한 대칭은 «도표»의 얼굴이다. 씨앗을 덩어리마다 달리해 쌍둥이를 피한다
    tex = bpy.data.textures.new("wob_" + 이름, type='CLOUDS')
    tex.noise_scale = 2.1
    tex.noise_depth = 2
    disp = ob.modifiers.new("wob", 'DISPLACE')
    disp.texture = tex
    disp.strength = 흔들
    disp.mid_level = 0.5
    disp.texture_coords = 'GLOBAL'

    bpy.ops.object.shade_smooth()

    # ── 털 2층 + 재질 — 공용 레시피(`tools/lib/룸섬유.py`) ──
    룸섬유.털입히기(ob, 이름, 밝기, 뭉치수, 자식수, 길이, 코랄=CORAL)
    return ob

# 뒤 — 위·뒤로 물러난 진한 회색. 앞 덩어리에 대부분 가려지므로 밀도를 낮게 둔다
뒤 = 덩어리("back", (0.00, 0.58, 0.46), 1.04, 0.155,
          int(HAIR * 0.55), max(8, CHILD // 2), LEN * 0.92,
          축=(1.02, 0.99, 0.72), 흔들=0.040)
# 앞 — 주인공. 밝은 흰색
앞 = 덩어리("front", (-0.10, -0.20, -0.10), 1.00, 0.875,
          HAIR, CHILD, LEN)
ob = 앞                                   # 카메라 초점·진단이 겨누는 덩어리

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
_rim = 등("rim",  (0.4, 4.6, 2.6), 560, 2.2)

# ── Light Linking — rim 은 «앞» 덩어리만 비춘다 ──────────────────────
# rim 의 직책은 「앞 덩어리의 실루엣을 띄우는 것」인데, 뒤 덩어리에는 그게 정면 조명이 되어
# 진회색이어야 할 것을 흰색으로 만든다. 세기로는 못 푼다(낮추면 앞의 실루엣이 같이 죽는다).
try:
    _rc = bpy.data.collections.new("rim_receivers")
    _rc.objects.link(앞)
    _rim.light_linking.receiver_collection = _rc      # ← light data 가 아니라 object 에 붙는다
    print("DIAG light-linking ON — rim → front only")
except Exception as _e:
    # 폴백: 이 판에 light linking 이 없으면 rim 을 앞쪽으로 당겨 뒤에 덜 닿게 한다.
    # ⚠효과가 같지 않다 — 폴백을 탄 것을 «조용히» 넘기지 않는다.
    _rim.location = (0.5, 2.9, 2.2)
    _rim.data.energy = 380
    print("DIAG light-linking 없음(%s) — 폴백: rim 을 앞으로 당김" % _e)

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
cam.location = (0.55, -7.6, 1.35)
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
# ── 톤 — 축 ⑥ (2026-08-19 신설 · 실측으로 들어왔다) ────────────────────────
#   🔴 AgX 는 하이라이트를 강하게 접는다. 그래서 재질 밝기를 0.875 로 줘도 판에서는
#      **평균 141/255(=0.55)** 로 나온다 — 「밝은 흰색」이 회색으로 읽히던 원인이 조명이
#      아니라 **톤 곡선**이었다(실측 2026-08-19 · 앞 141.5 · 뒤 99.1).
#   ⚠양쪽 끝이 다 실패한다: Standard 는 흰색을 살리는 대신 **하이라이트가 타서 결이 뭉갠다** ·
#     AgX 는 결을 지키는 대신 **흰색이 회색이 된다**. 그래서 값이 아니라 **레버**로 뺐다 —
#     같은 장면을 두 톤으로 굽고 자로 재서 고른다(눈으로 고르면 다음 판에서 또 흔들린다).
# 🔴 **enum_items 로 후보를 고르지 마라 — 이 두 열거자는 «동적»이다.**
#    `view_transform`·`look` 은 OCIO 설정에서 실행 시점에 채워지므로 `bl_rna.properties[…].enum_items`
#    는 `['None']` **하나만** 준다(실측 2026-08-19 · Blender 4.2.9). 그래서 「후보에 있으면 지정」 식
#    코드는 **한 번도 지정하지 않고** 기본값(AgX)에 머문다 — 그런데 로그도 렌더도 멀쩡해서,
#    「AgX 를 골랐다」로 읽힌다. 이 트랙의 첫 A/B 가 통째로 헛돌았다(두 판이 같은 톤이었다).
# ⇒ **그냥 지정하고, 지정이 «먹었는지» 되읽어 확인한다.** 안 먹으면 그 사실을 찍는다(말 없는 폴백 금지).
def 톤지정(값, 뭐):
    try:
        setattr(scene.view_settings, 뭐, 값)
    except Exception as _e:
        print("DIAG %s='%s' 지정 실패 — %s" % (뭐, 값, _e))
        return False
    got = getattr(scene.view_settings, 뭐)
    if got != 값:
        print("DIAG %s 지정이 «안 먹었다» — 원했다 '%s' · 실제 '%s'" % (뭐, 값, got))
        return False
    return True

톤지정(TONE, 'view_transform')
# look 은 톤에 딸린 값이다 — Standard 에 Punchy 를 얹으면 하이라이트가 두 번 접힌다.
톤지정('None' if scene.view_settings.view_transform == 'Standard' else 'AgX - Punchy', 'look') \
    or 톤지정('None', 'look')
scene.view_settings.exposure = EXPO
print('DIAG tone=%s look=%s exposure=%.2f' % (
    scene.view_settings.view_transform, scene.view_settings.look, scene.view_settings.exposure))

if os.path.exists(OUT):
    os.remove(OUT)
# 진단 — 파티클이 실제로 몇 가닥 평가되는지 «렌더 전에» 찍는다(0 이면 위가 전부 무의미)
# 🔴 옛 판은 «앞» 덩어리만 셌다 — 뒤 덩어리의 가닥이 0 이어도 로그가 조용했다(분모 없는 초록).
for _o, _라벨 in ((뒤, "back"), (앞, "front")):
    룸섬유.가닥진단(_o, _라벨)

bpy.ops.render.render(write_still=True)

# 🔴 exit 0 함정 — 시간·종료코드·stderr 어느 것도 근거가 아니다. 판이 «있는지»를 본다
if not os.path.exists(OUT) or os.path.getsize(OUT) < 2000:
    sys.stderr.write("RENDER_MISSING: %s\n" % OUT)
    sys.exit(3)
print("RENDER_OK %s %d bytes" % (OUT, os.path.getsize(OUT)))

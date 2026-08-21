# Loom 굽는 층 — 「사진이 없는 재질의 «사진»은 렌더다」(설계 §3-5)
#
# 이 파일은 스크래치패드 실증 3판(`loom_장면.py`·`loom_장면3.py` · 08-16)의 **승격판**이다.
# 승격이 전파보다 먼저인 이유: 굽는 층이 repo 밖에 있으면 93개 지면이 CSS 흉내로 태어난다(F498).
#
# 🚫 손으로 blender 를 부르지 않는다 — 통로는 `node tools/룸굽기.js` 하나다.
#    (그쪽이 산출 경로·씨앗·장부를 정하고, 이 파일은 «장면»만 안다.)
#
# 직접 호출 형태(룸굽기.js 가 조립한다):
#   blender -b -P tools/룸장면.py -- --부품 레진구 --출력 <폴더> [--이름 x] [--해상도 1400]
#           [--샘플 420] [--hdri <hdr>] [--hdri세기 0.35] [--안개] [--봉입 글자|파편|없음]
#           [--단계 결] [--그림자층] [--글자 ㅅ] [--폰트 <otf>]
import bpy, sys, math, os, random

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import 룸섬유            # 섬유 레시피 한 벌 — 시험대(`룸털.py`)와 같은 값을 쓴다

# ── 인자 ─────────────────────────────────────────────────────
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def 값(이름, 기본=None):
    if 이름 in argv:
        i = argv.index(이름)
        if i + 1 < len(argv) and not argv[i + 1].startswith("--"):
            return argv[i + 1]
    return 기본


def 켜짐(이름):
    return 이름 in argv


부품 = 값("--부품", "레진구")
# 🔴 재질 축 (2026-08-19 · 유호 지시 08-18 「재질 넷을 섬유 하나로 좁힌다」의 집행 자리).
#    `유리` = 지금까지의 판(굴절·분산·박막) · `털` = 섬유 축(실제 가닥 기하 · Principled Hair).
#    ⚠기본값은 **안 바꿨다** — 바꾸면 이미 구운 자산이 전부 갈리고, 그건 «다른 트랙»이다.
#    레시피는 여기 안 적는다: `tools/lib/룸섬유.py` 하나가 진다(시험대 `룸털.py` 와 같은 값).
재질 = 값("--재질", "유리")
OUT = os.path.abspath(값("--출력", "."))
이름 = 값("--이름", 부품)
RES = int(값("--해상도", "1100"))
SAMPLES = int(값("--샘플", "380"))
HDRI = 값("--hdri")
HDRI세기 = float(값("--hdri세기", "0.35"))
안개 = 켜짐("--안개")
봉입종류 = 값("--봉입", "파편")
단계 = 값("--단계", "결")
그림자층 = 켜짐("--그림자층")
글자 = 값("--글자", "ㅅ")
폰트경로 = 값("--폰트")
펠트색 = 값("--펠트색")          # 펠트패치_0815 타일 이름(Coral·Oat·Paper·Stitch…) — 로고 부품이 쓴다
# 헌법 — 「반복 부품의 갇힌 빛은 **무채**」다. 코랄이 갇히는 것은 히어로 1점뿐이라,
# 불릿·체크처럼 지면에 수십 개 도는 부품은 같은 레진이되 갇힌 빛만 크림이다(킷 철칙 ④).
갇힌빛 = 값("--갇힌빛", "코랄")

# 3차 누적 단계 — 앞의 것을 포함한다. 대조는 이 눈금 하나만 움직여서 낸다(F045).
순서 = ["기준", "속", "봉입", "박막", "빛", "결"]
켬 = lambda 이름: 순서.index(단계) >= 순서.index(이름)

CORAL = (1.0, 0.239, 0.216, 1.0)
CREAM = (0.965, 0.949, 0.918, 1.0)
갇힌색 = lambda: CORAL if 갇힌빛 == "코랄" else CREAM
# 무채 레진의 흡수는 «색»이 아니라 «어둠»이다 — 크림을 흡수색으로 주면 하얗게 뜬다.
흡수색 = lambda: CORAL if 갇힌빛 == "코랄" else (0.42, 0.44, 0.50, 1.0)
루트 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
펠트패치 = os.path.join(루트, "docs", "캐릭터", "펠트패치_0815")
펠트타일 = os.path.join(펠트패치, "Cream3.png")

# 🔑 씨앗 고정 — 기포·봉입물의 «불완전»(§3-4 ④)은 난수인데, 씨앗이 흔들리면
#    A/B 대조에서 재질이 아니라 «다른 개체»를 비교하게 된다(F045 ③: 대조는 입력을 얼린다).
random.seed(20260816)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
c = scene.cycles
c.samples = SAMPLES
c.use_denoising = True
c.caustics_refractive = True
c.caustics_reflective = True
c.transmission_bounces = 32
c.max_bounces = 32
# 🔴 3차의 첫 발견 — 2차까지 volume_bounces 가 **0**이었다(Blender 기본값).
#    레진은 «두께가 색을 만드는» 재질인데 볼륨 안에서 빛이 한 번도 안 튀면
#    그 두께는 «필터 한 장»으로 납작해진다. 2차 레진이 평평했던 물리적 원인이 여기다.
c.volume_bounces = 8 if 켬("속") else 0

# ── 🔴 섬유 프로파일 — 유리용 예산을 털에 그대로 쓰면 «안 되는 게 아니라 안 끝난다» (2026-08-19 실측)
#    위 값들은 전부 **유리**의 자다: 투과 32튐 · 코스틱 양쪽 · 간접광 무제한 클램프.
#    털에는 투과가 아예 없고, 대신 «가닥 수십만 개의 다중산란»이 있다 — 같은 예산을 주면
#    500px·64샘플이 **11분을 넘겨 타임아웃**했다(첫 판 실측). 그리고 그 비용으로 사는 것이 없다:
#      · transmission_bounces — 털은 투과체가 아니다 ⇒ 0
#      · caustics — 샌 빛은 «투명체 뒤»의 현상이다. 털엔 뒤가 없다 ⇒ 끔
#      · sample_clamp_indirect 무제한 — 다중산란의 반딧불이를 그대로 키운다 ⇒ 되돌린다
#    ⚠**유리 경로는 한 줄도 안 건드린다** — 이 블록은 `--재질 털` 일 때만 돈다(F503: 더하는 층만 얹는다).
if 재질 == "털":
    c.max_bounces = 8
    c.transmission_bounces = 0
    c.caustics_refractive = False
    c.caustics_reflective = False
    c.sample_clamp_indirect = 10.0
    print("[loom] 섬유 프로파일 — max_bounces 8 · 투과 0 · 코스틱 끔 · 간접 클램프 10")

if 켬("빛"):
    # 코스틱은 «간접광»이라 클램프에 제일 먼저 잘린다 — 켜 놓고도 안 보이던 이유.
    c.sample_clamp_indirect = 0.0     # 0 = 무제한
    c.blur_glossy = 0.25              # 기본 1.0 은 반사를 뭉개 코스틱을 지운다
    try:
        c.use_guiding = True          # 경로 유도 — 굴절·코스틱 노이즈를 크게 줄인다
    except Exception:
        pass
scene.render.film_transparent = True
scene.render.resolution_x = RES
scene.render.resolution_y = RES
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
if 켬("결"):
    # 8bit PNG 는 넓은 그라디언트에서 «띠»(밴딩)가 생긴다 — 디더가 그 경계를 흩는다.
    scene.render.dither_intensity = 1.6
try:
    scene.view_settings.view_transform = 'AgX'
except TypeError:
    scene.view_settings.view_transform = 'Filmic'

try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for 종류 in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
        try:
            prefs.compute_device_type = 종류
            prefs.get_devices()
            if any(d.type == 종류 for d in prefs.devices):
                for d in prefs.devices:
                    d.use = True
                c.device = 'GPU'
                print("[loom] GPU =", 종류); break
        except Exception:
            continue
except Exception as e:
    print("[loom] CPU:", e)

# ── 카메라 ───────────────────────────────────────────────────
# ⑤광학 — 정면·정중앙·꽉 참은 «도표»의 눈이다. 살짝 옆에서, 여백을 두고, 심도를 준다.
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 85
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
cam_data.dof.use_dof = True
if 부품 == "합주":
    cam.location = (0.75, -10.2, 1.35)
    cam.rotation_euler = (math.radians(85.0), 0, math.radians(4.2))
    cam_data.dof.focus_distance = 9.9
    cam_data.dof.aperture_fstop = 4.4
elif 부품 == "판":
    # ⚠ **여기만 ⑤광학(오프센터·심도)을 일부러 어긴다.** 카드 테두리는 9분할(border-image)로
    #   늘려 쓰는 부품이라 원근이 있으면 네 변의 두께가 달라져 «못 늘린다».
    #   ⑤는 «구도»의 자이고 재질의 자가 아니다 — 굴절·분산·박막·모따기 하이라이트는 그대로 산다.
    #   그래서 이 예외는 재질을 깎지 않는다(깎았다면 예외를 두지 않았을 것이다).
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2.35
    cam_data.dof.use_dof = False
    cam.location = (0, -7.0, 0)
    cam.rotation_euler = (math.radians(90), 0, 0)
elif 부품 == "로고꺾쇠":
    # ⚠ **판과 같은 예외** — 워드마크 위에 «그 자리 그대로» 앉는 합성 부품이라 원근이 있으면
    #   벡터 정본과 외곽이 어긋난다. ⑤광학을 어기는 대신 입체는 결·붕긋함·그림자가 진다.
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2.5
    cam_data.dof.use_dof = False
    cam.location = (0, -7.0, 0)
    cam.rotation_euler = (math.radians(90), 0, 0)
elif 부품 in ("원판", "칩", "로고배지"):
    # 각진 부품은 «모서리»가 주인공이라 더 정면에 가깝게 — 대신 완전 정면은 피한다.
    cam.location = (0.62, -6.6, 1.05)
    cam.rotation_euler = (math.radians(81.5), 0, math.radians(5.4))
    cam_data.dof.focus_distance = 6.7
    cam_data.dof.aperture_fstop = 5.6
else:
    cam.location = (1.15, -7.4, 1.85)
    cam.rotation_euler = (math.radians(78.0), 0, math.radians(8.8))
    cam_data.dof.focus_distance = 6.9
    cam_data.dof.aperture_fstop = 3.6
scene.camera = cam

# ── 조명 (2차에서 4판 돌려 확정 · 건드리지 않는다) ─────────────
# 🔴 3차 실사고: 감광판을 더하면서 이 세 줄까지 «동시에» 갈아엎어 유리가 하얗게 떴다(F503).
#    더하는 층만 얹는다.
def area(name, loc, rot, size, energy, color=(1, 1, 1), shape='DISK'):
    # 🔑 shape='DISK' — 사각 조명은 유리에 «각진 흰 반사»를 남기고, 그게 CG 티의 절반이었다.
    d = bpy.data.lights.new(name, type='AREA')
    d.shape = shape; d.size = size; d.energy = energy; d.color = color
    o = bpy.data.objects.new(name, d)
    o.location = loc; o.rotation_euler = rot
    scene.collection.objects.link(o)
    # 🔴 **1~3차 전 판에 있던 결함**(08-16 발견) — Cycles 의 램프는 기본값이 «카메라에 보임»이다.
    #    rim 램프가 피사체 뒤 위에 있어서, 렌더마다 실루엣을 가로지르는 **흰 뚜껑**으로 찍혔다.
    #    실물 제품 사진은 소프트박스를 화면에 넣지 않는다 — 그게 CG 티의 조용한 원인 중 하나였다.
    #    ⚠끄는 것은 «카메라 직선» 하나뿐이다: 반사·굴절·확산은 그대로라 조명은 1도 안 바뀐다
    #      (그래서 이 수정은 §3-4 여섯 자의 값을 건드리지 않는다 — 지우는 것은 «카메라가 본 램프»뿐).
    o.visible_camera = 켜짐("--램프보임")
    return o


# 🔴 실측 08-16 — 여기에 `0.72 if HDRI else 1.0` 이라고 적었다가 **자를 스스로 망가뜨렸다.**
#    HDRI 를 켜는 순간 램프까지 같이 내려가서, A/B 가 「환경 하나」가 아니라 「환경+조명 둘」이
#    바뀐 대조가 됐다(F045: 둘을 동시에 바꾸면 모르는 채 「알아냈다」고 쓰게 된다).
#    자가 그 사실을 잡아냈다 — 국소 대비 **-0.6%**·하이라이트 4.23%→3.35%.
#    「반사에 세상이 맺힌다」면서 반사 «구조»가 줄어드는 판이 나왔으면 그건 눈금이 잘못 걸린 것이다.
#    ⇒ 램프는 램프대로 별도 눈금으로 뺀다. 기본은 **안 건드림**(1.0)이다.
램프배 = float(값("--램프배", "1.0"))
area("key",  (-2.4, -2.8, 2.6), (math.radians(42), 0, math.radians(-40)), 5.2, 380 * 램프배)
area("fill", ( 3.0, -1.4, 0.9), (math.radians(78), 0, math.radians(60)),  3.4,  26 * 램프배)
area("rim",  ( 0.0,  3.4, 1.7), (math.radians(-56), 0, 0),                3.0, 175 * 램프배)

# ── 로고 부품 전용 «스침» 키 — 글자공방 인계 08-20 의 명품 렌더 4계 이식 ──
#   ① 대비는 재료가 낸다: 잔털·범프의 요철을 세우는 것은 «저각 빛»이다 ② 가장 밝은 것은 하나(이 키)
#   함정 ⑤: 스침광은 33°가 하한(14°는 코사인 소멸) — 아래 자리는 면 기준 33.1°.
#   함정 ④: 역제곱 — key 380W@4.51 과 같은 조도가 이 거리(6.59)면 811W. 900 은 «가장 밝은 하나» 몫.
if 부품 in ("로고꺾쇠", "로고배지"):
    import mathutils as _mu
    스침위치 = (-4.0, -3.6, 3.8)
    _d = _mu.Vector((0, 0, 0)) - _mu.Vector(스침위치)
    area("스침", 스침위치, _d.to_track_quat('-Z', 'Y').to_euler(), 3.8, 900 * 램프배)

세트 = []


def 판셋(name, loc, 크기, 밝기=None, 색=(0.02, 0.02, 0.025), 보임=False):
    """②감광 — 빛이 아니라 «빛 아닌 것». 투명체의 윤곽은 어두운 띠가 만든다.
    ③뒤 — 배경벽은 카메라엔 안 보이고(보임=False) 굴절에만 비친다."""
    bpy.ops.mesh.primitive_plane_add(size=크기, location=loc)
    o = bpy.context.object; o.name = name
    import mathutils
    d = mathutils.Vector((0, 0, 0)) - mathutils.Vector(loc)
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    if 밝기:
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Strength"].default_value = 밝기
        nt.links.new(e.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    else:
        p = nt.nodes.new("ShaderNodeBsdfPrincipled")
        p.inputs["Base Color"].default_value = (*색, 1)
        p.inputs["Roughness"].default_value = 0.62
        nt.links.new(p.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    o.data.materials.append(m)
    o.visible_camera = 보임
    o.visible_shadow = False   # 안 끄면 알파에 사각 띠가 남는다(실측)
    세트.append(o)
    return o


판셋("감광판A", (-3.05, -0.35, 0.45), 4.4)
판셋("감광판B", ( 3.25, -0.55, 0.10), 3.6)
판셋("배경벽",  (0.0, 4.8, 0.9), 12.0, 색=(0.075, 0.085, 0.115))

# ── 환경 ─────────────────────────────────────────────────────
# ①환경 — 반사할 것이 있는가. 없으면 흰 얼룩 몇 개가 떠 있는 그림이 된다.
world = bpy.data.worlds.new("w"); scene.world = world
world.use_nodes = True
wnt = world.node_tree
bg = wnt.nodes["Background"]

if HDRI and os.path.exists(HDRI):
    # 🥇 HDRI — 지오메트리 스튜디오는 «내가 세운 판 몇 장»이 맺히고, HDRI 는 «세상»이 맺힌다.
    #   ⚠ film_transparent 라 배경으로는 안 보인다 — 반사·굴절에만 산다. 그게 우리가 원하는 것이다.
    #   ⚠ 세기를 올리면 ②감광(검은 띠)이 씻겨 형태가 무너진다. 0.35 는 «채우되 안 씻는» 자리.
    env = wnt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(HDRI)
    mapn = wnt.nodes.new("ShaderNodeMapping")
    texc = wnt.nodes.new("ShaderNodeTexCoord")
    mapn.inputs["Rotation"].default_value = (0, 0, math.radians(-38))  # 소프트박스를 키라이트 쪽으로
    wnt.links.new(texc.outputs["Generated"], mapn.inputs["Vector"])
    wnt.links.new(mapn.outputs[0], env.inputs["Vector"])
    wnt.links.new(env.outputs["Color"], bg.inputs[0])
    bg.inputs[1].default_value = HDRI세기
    print("[loom] HDRI =", os.path.basename(HDRI), "· 세기", HDRI세기)
else:
    # 폴백 = 2차까지의 그라디언트 무대. HDRI 없이도 «돌긴 돈다»(대조군이기도 하다).
    tc = wnt.nodes.new("ShaderNodeTexCoord")
    sep = wnt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = wnt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.36
    ramp.color_ramp.elements[0].color = (0.021, 0.026, 0.045, 1)
    ramp.color_ramp.elements[1].position = 0.72
    ramp.color_ramp.elements[1].color = (0.155, 0.178, 0.235, 1)
    mr = wnt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -1.0
    mr.inputs["From Max"].default_value = 1.0
    wnt.links.new(tc.outputs["Generated"], sep.inputs[0])
    wnt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    wnt.links.new(mr.outputs[0], ramp.inputs["Fac"])
    wnt.links.new(ramp.outputs["Color"], bg.inputs[0])
    bg.inputs[1].default_value = 1.0

bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -1.0))
floor = bpy.context.object; floor.name = "바닥"
floor.is_shadow_catcher = True
fm = bpy.data.materials.new("floor"); fm.use_nodes = True
fm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.04, 0.05, 0.09, 1)
fm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.28
floor.data.materials.append(fm)

# ── 무대 안개 ─────────────────────────────────────────────────
안개덩이 = None
if 안개:
    # ▶ 3차가 「알파와 충돌 가능 — 실증 필요」로 남긴 층.
    #   🔑 실증으로 나온 해법 = **월드 볼륨이 아니라 «가장자리가 0으로 꺼지는 구»**.
    #      월드에 안개를 걸면 화면 전체(=알파 전체)가 뿌예져 지면에 못 얹는다.
    #      구에 걸면 «상자 테두리»가 알파에 각지게 남는데, 밀도를 반경으로 떨어뜨리면 그 경계가 사라진다.
    bpy.ops.mesh.primitive_uv_sphere_add(radius=4.2, location=(0, 0, 0.2), segments=32, ring_count=16)
    안개덩이 = bpy.context.object; 안개덩이.name = "안개"
    m = bpy.data.materials.new("Loom_안개"); m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    out = nt.nodes["Material Output"]
    sc = nt.nodes.new("ShaderNodeVolumeScatter")
    sc.inputs["Color"].default_value = (0.86, 0.89, 1.0, 1.0)
    sc.inputs["Anisotropy"].default_value = 0.62   # 앞으로 퍼진다 = 역광에서 빛줄기가 선다
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = 'SPHERICAL'
    texc2 = nt.nodes.new("ShaderNodeTexCoord")
    rng = nt.nodes.new("ShaderNodeMapRange")
    rng.inputs["From Min"].default_value = 0.0
    rng.inputs["From Max"].default_value = 0.62   # 반경 62% 밖은 완전히 0 — 경계가 안 생긴다
    rng.inputs["To Min"].default_value = 0.0
    rng.inputs["To Max"].default_value = 0.030
    nt.links.new(texc2.outputs["Object"], grad.inputs["Vector"])
    nt.links.new(grad.outputs["Fac"], rng.inputs["Value"])
    nt.links.new(rng.outputs[0], sc.inputs["Density"])
    nt.links.new(sc.outputs[0], out.inputs["Volume"])
    안개덩이.data.materials.append(m)
    안개덩이.visible_shadow = False

# ── 부품 ─────────────────────────────────────────────────────
def 구(이름, 반경=1.0, 위치=(0, 0, 0), 비대칭=False, 세그=160):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=반경, location=위치, segments=세그, ring_count=세그 // 2)
    o = bpy.context.object; o.name = 이름
    if 비대칭:
        # ④불완전 — 수학적으로 완벽한 구는 CG 다. 0.6% 만 찌그러뜨린다.
        o.scale = (1.0, 0.994, 1.009)
        o.rotation_euler = (math.radians(3.5), 0, math.radians(-6))
    bpy.ops.object.shade_smooth()
    return o


def 모따기(o, 폭=0.014, 단=4, 각=math.radians(52)):
    """▶ 3차가 「구엔 무의미 · 각진 부품엔 결정적」으로 남긴 층.
    「완벽하게 날카로운 모서리」가 CG 티의 1순위다 — 실물에는 그런 모서리가 **없다**.
    폭 0.014 는 «보이지 않는데 빛은 잡는» 자리: 모서리를 따라 가는 하이라이트 실선이 생긴다.
    ⚠구·유기 형상에 걸면 세그먼트만 늘고 화면은 그대로다 — 판·원판·칩에만 건다."""
    mod = o.modifiers.new(name="모따기", type='BEVEL')
    mod.width = 폭
    mod.segments = 단
    mod.limit_method = 'ANGLE'
    mod.angle_limit = 각
    # 🔴 실측 08-16 — 여기 `o.data.use_auto_smooth = True if hasattr(...) else False` 라고 적었다.
    #    삼항은 «값»만 고를 뿐 대입 자체는 막지 못한다 — Blender 4.1 에서 사라진 속성이라
    #    각진 부품 셋(원판·판·칩)이 전부 AttributeError 로 죽었다. hasattr 를 쓴 줄이
    #    hasattr 의 보호를 못 받는 모양이었다(맞는 얼굴로 틀린 값 · 지침 v9.2 맹점 ④).
    if hasattr(o.data, "use_auto_smooth"):
        o.data.use_auto_smooth = True
    # harden_normals 는 «부드럽게 칠해진 면»을 요구한다 — 안 걸면 모따기 띠가 각져 보인다.
    bpy.ops.object.shade_smooth()
    return o


def 새재질(이름):
    m = bpy.data.materials.new(이름); m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    return m, nt, nt.nodes["Material Output"]


def 미세결(nt, 셰이더, 기본거칠기, 스케일=340, 세기=0.022, 폭=0.028):
    """④불완전 — 미세 요철. 균일한 거칠기는 «플라스틱 사출»로 읽힌다."""
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n1 = nt.nodes.new("ShaderNodeTexNoise")
    n1.inputs["Scale"].default_value = 스케일
    n1.inputs["Detail"].default_value = 8.0
    n1.inputs["Roughness"].default_value = 0.62
    nt.links.new(tc.outputs["Object"], n1.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 세기
    bump.inputs["Distance"].default_value = 0.006
    nt.links.new(n1.outputs["Fac"], bump.inputs["Height"])
    if "Normal" in 셰이더.inputs:
        nt.links.new(bump.outputs["Normal"], 셰이더.inputs["Normal"])
    n2 = nt.nodes.new("ShaderNodeTexNoise")
    n2.inputs["Scale"].default_value = 26
    n2.inputs["Detail"].default_value = 4.0
    nt.links.new(tc.outputs["Object"], n2.inputs["Vector"])
    rg = nt.nodes.new("ShaderNodeMapRange")
    rg.inputs["To Min"].default_value = max(0.004, 기본거칠기 - 폭 * 0.35)
    rg.inputs["To Max"].default_value = 기본거칠기 + 폭
    nt.links.new(n2.outputs["Fac"], rg.inputs["Value"])
    nt.links.new(rg.outputs[0], 셰이더.inputs["Roughness"])


def 박막(셰이더, 두께=380.0, ior=1.42):
    """⑩박막 간섭 — 표면의 아주 얇은 코팅이 각도마다 다른 색을 낸다(비눗방울·보석 코팅).
    안료가 아니라 «두께»가 내는 색이라 헌법 「유리에 안료를 칠하지 않는다」에 안 걸린다.
    ⚠세면 즉시 기름막이 된다 — 380nm 는 가시광 하단이라 «있는 줄 모르게» 뜬다."""
    if "Thin Film Thickness" in 셰이더.inputs:
        셰이더.inputs["Thin Film Thickness"].default_value = 두께
        셰이더.inputs["Thin Film IOR"].default_value = ior
        return True
    return False


def 유리재질():
    m, nt, out = 새재질("Loom_유리")
    g = nt.nodes.new("ShaderNodeBsdfGlass")
    g.inputs["Color"].default_value = (0.88, 0.91, 0.95, 1.0)
    g.inputs["IOR"].default_value = 1.46
    if "Dispersion" in g.inputs:
        g.inputs["Dispersion"].default_value = 0.31   # 분산 림 — 유리의 색은 여기서만 온다
    미세결(nt, g, 0.014, 스케일=380, 세기=0.018, 폭=0.022)
    if 켬("박막"):
        박막(g, 380.0, 1.42)
    nt.links.new(g.outputs[0], out.inputs["Surface"])
    return m


def 레진재질(봉입있음):
    m, nt, out = 새재질("Loom_레진")
    g = nt.nodes.new("ShaderNodeBsdfGlass")
    g.inputs["Color"].default_value = (0.97, 0.96, 0.95, 1.0)
    g.inputs["IOR"].default_value = 1.55
    if "Dispersion" in g.inputs:
        g.inputs["Dispersion"].default_value = 0.18
    미세결(nt, g, 0.042, 스케일=300, 세기=0.038, 폭=0.044)
    # 🔴 레진에는 박막을 걸지 않는다 — 간섭색이 «보라 얼룩»으로 떠서 갇힌 코랄을 오염시켰다(실측).
    #    박막은 «맑은 유리»의 층이고, 레진의 표면은 매트하다.
    nt.links.new(g.outputs[0], out.inputs["Surface"])

    vol = nt.nodes.new("ShaderNodeVolumeAbsorption")
    vol.inputs["Color"].default_value = 흡수색()
    # 🔑 봉입물이 들어오면 밀도가 «두 일»을 한다 — 두께로 색을 만들고, 갇힌 것을 삼킨다.
    #    2.9 에서는 박편이 반사한 빛까지 통째로 흡수돼 검은 조각으로 보였다(실측).
    vol.inputs["Density"].default_value = 2.05 if 봉입있음 else 2.9
    if 켬("속"):
        # 🔑 흡수만 있으면 «색 필터»다. 산란이 있어야 «덩어리»가 된다.
        #    ⚠2차에서 기각한 «방출»과 다르다: 방출은 흡수를 상쇄하고, 산란은 안 한다.
        sc = nt.nodes.new("ShaderNodeVolumeScatter")
        sc.inputs["Color"].default_value = (1.0, 0.62, 0.55, 1.0) if 갇힌빛 == "코랄" else (0.86, 0.88, 0.94, 1.0)
        sc.inputs["Density"].default_value = 0.42
        sc.inputs["Anisotropy"].default_value = 0.35
        add = nt.nodes.new("ShaderNodeAddShader")
        nt.links.new(vol.outputs[0], add.inputs[0])
        nt.links.new(sc.outputs[0], add.inputs[1])
        nt.links.new(add.outputs[0], out.inputs["Volume"])
    else:
        nt.links.new(vol.outputs[0], out.inputs["Volume"])
    return m


def 코어재질(세기=1.15):
    m, nt, out = 새재질("Loom_코어")
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = 갇힌색()
    e.inputs["Strength"].default_value = 세기
    nt.links.new(e.outputs[0], out.inputs["Surface"])
    return m


def 기포재질():
    m, nt, out = 새재질("Loom_기포")
    g = nt.nodes.new("ShaderNodeBsdfGlass")
    g.inputs["Roughness"].default_value = 0.0
    g.inputs["IOR"].default_value = 0.645   # <1 = 레진(1.55)보다 성긴 것 = 공기 방울
    nt.links.new(g.outputs[0], out.inputs["Surface"])
    return m


def 봉입재질():
    """⑦봉입 — 「3D 레진아트」의 정체성. 레진은 «가둔 것»이 있어야 레진아트다.
    ⚠색은 **무채 금속**이다 — 킷 철칙 ④(신호 1점)를 안 건드리고,
      유리 헌법 「반복 부품의 갇힌 빛은 무채」와 같은 자리에 선다. 금색은 안 쓴다.
    🔴 순금속(Metallic 1.0)은 «정반사만» 한다 — 붉은 속에는 반사할 것이 없어 검은 조각으로 묻혔다.
      ⇒ 반금속 0.55(반사도 하고 확산도 한다)."""
    m, nt, out = 새재질("Loom_봉입")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = (0.94, 0.93, 0.91, 1.0)
    p.inputs["Metallic"].default_value = 0.55
    p.inputs["Roughness"].default_value = 0.13
    if "Anisotropic" in p.inputs:
        p.inputs["Anisotropic"].default_value = 0.62   # 결 방향 반사 — 얇은 박편의 서명
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


def 봉입_파편(중심=(0, 0, 0), 개수=8):
    """얇은 박편을 흩는다 — 판판하고 크기가 제각각이어야 «손으로 뿌린 것»이 된다.
    🔴1회차 실패: 너무 작고 완전 평면이라 옆에서 보면 «선»이 됐다 ⇒ 크게·두껍게.
      그리고 «앞쪽»에 더 둔다 — 굴절이 뒤쪽 것을 삼킨다."""
    m = 봉입재질()
    for i in range(개수):
        s = random.uniform(0.12, 0.26)
        d = random.uniform(0.34, 0.70)
        th = random.uniform(0, math.tau); ph = math.acos(random.uniform(-1, 1))
        p = (중심[0] + d * math.sin(ph) * math.cos(th),
             중심[1] + d * math.sin(ph) * math.sin(th) * 0.55 - 0.16,
             중심[2] + d * math.cos(ph))
        bpy.ops.mesh.primitive_cube_add(size=s, location=p)
        o = bpy.context.object; o.name = "봉입%d" % i
        o.rotation_euler = (random.uniform(0, math.pi), random.uniform(0, math.pi), random.uniform(0, math.pi))
        o.scale = (1.0, random.uniform(0.06, 0.14), random.uniform(0.55, 1.0))
        o.data.materials.append(m)


def 글자몸(문자, 폰트, 크기=1.0, 두께=0.055):
    """글자를 3D 몸으로 세운다 — 평면 텍스처가 아니라 «두께가 있는 것»이어야 갇힌 것이 된다."""
    cu = bpy.data.curves.new(type="FONT", name="글자_" + 문자)
    cu.body = 문자
    if 폰트:
        try:
            cu.font = bpy.data.fonts.load(폰트)
        except Exception as e:
            print("[loom] 🔴 폰트 실패:", e)
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    cu.size = 크기
    cu.extrude = 두께
    # 🔑 글자에도 모따기를 건다 — 활자의 날 선 모서리야말로 «벡터 티»가 나는 자리다.
    cu.bevel_depth = 0.010
    cu.bevel_resolution = 3
    o = bpy.data.objects.new("글자_" + 문자, cu)
    scene.collection.objects.link(o)
    return o


def 봉입_글자(중심=(0, 0, 0), 문자=None, 폰트=None):
    """💡 3차 제안(유호 승인 08-16) — 봉입물에 «의미»를 가둔다.
    파편은 예쁜 것이고, 자모·마크는 **브랜드 자산**이다.
    ⚠미검증이었던 것 = 「작은 글자가 굴절 너머로 읽히는가」. 그래서 조건을 셋 걸었다:
      ①크게(구 반경의 55%) ②앞쪽 얕게(굴절이 뒤를 삼킨다) ③정면을 살짝 비껴 — 정면 평행이면
      굴절이 글자를 «판판한 스티커»로 만들어 갇힌 느낌이 죽는다.
    ⚠히어로 1점에만 — 지면마다 글자가 갇혀 있으면 킷 신호 1점이 죽는다."""
    문자 = 문자 or "ㅅ"
    m = 봉입재질()
    글리프 = list(문자)
    for i, ch in enumerate(글리프):
        o = 글자몸(ch, 폰트, 크기=0.62, 두께=0.048)
        # 여러 자면 앞뒤로 층을 나눠 «떠 있는 깊이»를 만든다(한 평면에 두면 인쇄물이 된다).
        z = 0.10 - i * 0.30
        y = -0.30 + i * 0.26
        o.location = (중심[0] + (i - (len(글리프) - 1) / 2) * 0.05, 중심[1] + y, 중심[2] + z)
        o.rotation_euler = (math.radians(84 + i * 5), math.radians(-7 + i * 4), math.radians(-6 + i * 9))
        o.data.materials.append(m)
    # 자모 옆에 아주 작은 파편 몇 개 — 글자만 있으면 «인쇄»가 되고, 섞여야 «가둔 것»이 된다.
    파 = 봉입재질()
    for i in range(4):
        s = random.uniform(0.07, 0.13)
        d = random.uniform(0.42, 0.70)
        th = random.uniform(0, math.tau); ph = math.acos(random.uniform(-1, 1))
        p = (중심[0] + d * math.sin(ph) * math.cos(th),
             중심[1] + d * math.sin(ph) * math.sin(th) * 0.55 - 0.10,
             중심[2] + d * math.cos(ph))
        bpy.ops.mesh.primitive_cube_add(size=s, location=p)
        o = bpy.context.object; o.name = "곁파편%d" % i
        o.rotation_euler = (random.uniform(0, math.pi), random.uniform(0, math.pi), random.uniform(0, math.pi))
        o.scale = (1.0, random.uniform(0.06, 0.12), random.uniform(0.55, 1.0))
        o.data.materials.append(파)


def 펠트재질(색=None, 스케일=2.4, 돌림=0.0, 염색보정=False, 결흩기=0.0, 채도=1.22, 밝기=0.86, 염색혼합=None):
    """헌법 ① — 결은 사진 픽셀에서만. 펠트는 실물이 있으니 «찍은 것»을 쓴다.
    색 = 펠트패치_0815 타일 이름(Coral·Oat·Paper·Stitch…). 안 주면 구판 그대로 Cream3 —
    기존 호출은 전부 무인자라 이 확장은 더하는 층이다(F503).
    스케일↑ = 결이 잘아진다 · 돌림 = 축 정렬 깨기 · 염색보정 = AgX·조명이 씻는 채도 복원.
    결흩기 = 표본 좌표를 노이즈로 흩는다 — 🔴 2판 실측: 패치 전량이 «거울 타일»이라
    어느 스케일에서도 반복 격자가 무늬로 드러났다. 소재가 아니라 좌표를 흩어야 풀린다
    (픽셀은 여전히 실물 사진에서 온다 — 헌법 ① 그대로)."""
    m, nt, out = 새재질("Loom_펠트" + ("_" + 색 if 색 else ""))
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Roughness"].default_value = 0.95
    if "Sheen Weight" in p.inputs:
        p.inputs["Sheen Weight"].default_value = 0.30
    if "Specular IOR Level" in p.inputs:
        p.inputs["Specular IOR Level"].default_value = 0.12
    try:
        타일 = os.path.join(펠트패치, 색 + ".png") if 색 else 펠트타일
        img = bpy.data.images.load(타일)
        tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
        tc2 = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (스케일, 스케일, 스케일)
        if 돌림:
            mp.inputs["Rotation"].default_value = (0.0, 0.0, math.radians(돌림))
        nt.links.new(tc2.outputs["Object"], mp.inputs["Vector"])
        if 결흩기:
            nz = nt.nodes.new("ShaderNodeTexNoise")
            nz.inputs["Scale"].default_value = 3.2
            nz.inputs["Detail"].default_value = 4.0
            nt.links.new(tc2.outputs["Object"], nz.inputs["Vector"])
            빼 = nt.nodes.new("ShaderNodeVectorMath"); 빼.operation = 'SUBTRACT'
            빼.inputs[1].default_value = (0.5, 0.5, 0.5)
            nt.links.new(nz.outputs["Color"], 빼.inputs[0])
            곱 = nt.nodes.new("ShaderNodeVectorMath"); 곱.operation = 'SCALE'
            곱.inputs["Scale"].default_value = 결흩기
            nt.links.new(빼.outputs["Vector"], 곱.inputs[0])
            더 = nt.nodes.new("ShaderNodeVectorMath"); 더.operation = 'ADD'
            nt.links.new(mp.outputs[0], 더.inputs[0])
            nt.links.new(곱.outputs["Vector"], 더.inputs[1])
            nt.links.new(더.outputs["Vector"], tex.inputs["Vector"])
        else:
            nt.links.new(mp.outputs[0], tex.inputs["Vector"])
        색끝 = tex.outputs["Color"]
        if 염색보정:
            hsv = nt.nodes.new("ShaderNodeHueSaturation")
            hsv.inputs["Saturation"].default_value = 채도
            hsv.inputs["Value"].default_value = 밝기
            nt.links.new(색끝, hsv.inputs["Color"])
            색끝 = hsv.outputs["Color"]
        if 염색혼합:
            # 🔴 4판 실측: Oat 타일은 거의 무채라 채도 곱으로는 안 물든다 — 염색은 «혼합»이어야 한다.
            혼 = nt.nodes.new("ShaderNodeMixRGB"); 혼.blend_type = 'MULTIPLY'
            혼.inputs["Fac"].default_value = 염색혼합[3]
            혼.inputs["Color2"].default_value = (염색혼합[0], 염색혼합[1], 염색혼합[2], 1.0)
            nt.links.new(색끝, 혼.inputs["Color1"])
            색끝 = 혼.outputs["Color"]
        nt.links.new(색끝, p.inputs["Base Color"])
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.34
        nt.links.new(tex.outputs["Color"], bump.inputs["Height"])   # 결(요철)은 보정 전 원판을 쓴다
        nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    except Exception as e:
        print("[loom] 🔴 펠트 타일 실패:", e)
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


# ── 후처리 ───────────────────────────────────────────────────
def 결층(경로, 그레인=0.014):
    """⑫필름 결 — «생성물»과 «촬영물»을 가르는 마지막 한 겹.
    ①그레인 ②split toning(하이라이트 따뜻·그림자 차갑게) ③비네팅. 알파는 안 건드린다.
    🔴1회차 과다: 회색 하이라이트가 «보라»로 물들었다 ⇒ 세기 1/3. 알아채면 진 것인 층이다."""
    try:
        import numpy as np
        img = bpy.data.images.load(경로)
        w, h = img.size
        px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
        보임 = (px[:, :, 3:4] > 0.02).astype(np.float32)
        rgb = px[:, :, 0:3]
        if 켬("결"):
            L = rgb.mean(axis=2, keepdims=True)
            따뜻 = np.array([0.0055, 0.0014, -0.0040], dtype=np.float32)
            차갑 = np.array([-0.0030, -0.0006, 0.0052], dtype=np.float32)
            rgb = rgb + (L * 따뜻 + (1.0 - L) * 차갑) * 보임
            yy, xx = np.mgrid[0:h, 0:w]
            r = np.sqrt(((xx / w - .5) * 2) ** 2 + ((yy / h - .5) * 2) ** 2)[:, :, None]
            rgb = rgb * (1.0 - 0.085 * np.clip(r - 0.55, 0, None) / 0.85)
        rng2 = np.random.default_rng(20260816)
        g = rng2.normal(0.0, 그레인, size=(h, w, 1)).astype(np.float32)
        rgb = np.clip(rgb + g * 보임, 0.0, 1.0)
        px[:, :, 0:3] = rgb
        img.pixels = px.reshape(-1).tolist()
        img.filepath_raw = 경로; img.file_format = 'PNG'; img.save()
        # 알파 실측 — 안개가 알파를 얼마나 오염시켰는지는 «재야» 안다(추정 금지).
        덮 = float((px[:, :, 3] > 0.02).mean())
        옅 = float(((px[:, :, 3] > 0.02) & (px[:, :, 3] < 0.35)).mean())
        print("[loom] 알파 실측 · 덮인 픽셀 %.1f%% · 그중 옅은 띠 %.1f%%" % (덮 * 100, 옅 * 100))
    except Exception as e:
        print("[loom] 결층 건너뜀:", e)


# ── 세우기 ───────────────────────────────────────────────────
def 치우기():
    보호 = {floor.name} | {o.name for o in 세트} | ({안개덩이.name} if 안개덩이 else set())
    for o in [o for o in bpy.data.objects if o.type in ('MESH', 'FONT', 'CURVE') and o.name not in 보호]:
        bpy.data.objects.remove(o, do_unlink=True)


def 기포들(중심=(0, 0, 0), 개수=9):
    bm = 기포재질()
    for i in range(개수):
        r = random.uniform(0.018, 0.052)
        d = random.uniform(0.28, 0.72)
        th = random.uniform(0, math.tau); ph = math.acos(random.uniform(-1, 1))
        p = (중심[0] + d * math.sin(ph) * math.cos(th),
             중심[1] + d * math.sin(ph) * math.sin(th),
             중심[2] + d * math.cos(ph))
        b = 구("기포%d" % i, r, p, 세그=48)
        b.data.materials.append(bm)


def 레진세우기(중심=(0, 0, 0)):
    봉입있음 = 봉입종류 in ("파편", "글자") and 켬("봉입")
    s = 구("레진", 1.0, 중심, 비대칭=True)
    s.data.materials.append(레진재질(봉입있음))
    cc = 구("코어", 0.26, (중심[0], 중심[1], 중심[2] + 0.06))
    cc.scale = (1.06, 0.68, 1.18)
    cc.rotation_euler = (math.radians(14), math.radians(-9), math.radians(22))
    cc.data.materials.append(코어재질())
    기포들(중심)
    if 봉입있음:
        if 봉입종류 == "글자":
            봉입_글자(중심, 글자, 폰트경로)
        else:
            봉입_파편(중심)


def 몸재질(o, 이름):
    """이 부품의 «몸»에 재질을 물린다 — 유리 아니면 섬유. 한 자리에서 갈라야 세 부품이 안 어긋난다."""
    if 재질 == "털":
        # 🔴 가닥 수는 «부품 크기»에 맞춘다 — 시험대(`룸털.py`)의 값을 그대로 가져오면 안 된다.
        #    실측 2026-08-19: 24,000뿌리 × 26자식(=624k 가닥)을 반경 1 원판에 심었더니 500px·80샘플이
        #    **11분을 넘겨 타임아웃**했다. 덩어리(시험대)는 넓고 부품은 좁은데 밀도를 그대로 쓴 탓이다.
        #    부품은 지면에서 35~90px 로 앉으므로 이 밀도면 충분하다(그 이상은 픽셀이 못 받는다).
        # 🔑 **부품은 «펠트»다, 「털」이 아니다.** 축 표(`lib/룸섬유.py`)가 가르는 것은 셋인데
        #    그중 길이 하나가 이 자리의 전부다: 펠트=짧다·눕는다·밀도 높다 / 털=길다·선다·중간.
        #    첫 판(길이 0.105)은 원기둥의 «면»에서 가닥이 방사로 뻗어 **민들레**로 읽혔다(실측 렌더).
        #    번호 원판은 손톱만 하게 앉는 부품이라 결이 «표면의 결»이어야지 «삐침»이면 안 된다.
        룸섬유.털입히기(o, 이름, 0.875, 9000, 18, 0.030)
        룸섬유.가닥진단(o, 이름)
    else:
        o.data.materials.append(유리재질())


def 유리세우기():
    s = 구("유리", 1.0, (0, 0, 0), 비대칭=True)
    s.data.materials.append(유리재질())


def 원판세우기():
    """번호 원판 — `loom.js` 의 `.원판`. 각진 테두리라 **모따기가 결정적**이다."""
    bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=0.26, vertices=192, location=(0, 0, 0))
    o = bpy.context.object; o.name = "원판"
    # 🔴 첫 판은 실린더를 «누워 있는 동전»으로 뒀다 — 렌더는 아름다웠지만 지면의 `.번호` 는
    #    **정면 원**이라 타원을 원형 상자에 넣으면 눌린 알약으로 읽힌다(용도가 형상을 정한다).
    #    축을 카메라 쪽으로 세운다 = «들어 보인 동전». 기울기 6°·4° 는 ④불완전(정면 평행 금지).
    o.rotation_euler = (math.radians(90 - 6.0), math.radians(-4.0), 0)
    모따기(o, 폭=0.030, 단=5)
    몸재질(o, "원판")


def 판세우기():
    """유리 판 — `.유리` 카드의 «테두리»를 굽는다(9분할 border-image 재료).
    🔑 지면의 카드는 크기가 제각각이라 통짜 렌더로는 못 쓴다 — 모서리만 구워 늘린다."""
    bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 0))
    o = bpy.context.object; o.name = "판"
    o.scale = (1.0, 0.085, 0.66)
    o.rotation_euler = (math.radians(2.5), 0, math.radians(-1.5))
    모따기(o, 폭=0.048, 단=6)
    몸재질(o, "판")


def 칩세우기():
    """칩·태그 — 작고 각진 부품. 모따기가 없으면 이 크기에서 «벡터 도형»으로 읽힌다."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    o = bpy.context.object; o.name = "칩"
    o.scale = (1.35, 0.16, 0.52)
    o.rotation_euler = (math.radians(5.0), math.radians(2.0), math.radians(-3.5))
    모따기(o, 폭=0.055, 단=6)
    몸재질(o, "칩")


def 합주세우기():
    """⑥합주 — 부품이 서로를 아는가. 따로 굽고 얹으면 «AI 콜라주»가 된다."""
    유리 = 구("유리", 0.82, (-1.52, 0.42, -0.18), 비대칭=True)
    유리.data.materials.append(유리재질())
    펠트 = 구("펠트", 0.66, (1.42, 0.75, -0.34))
    펠트.data.materials.append(펠트재질())
    레진세우기((0, -0.55, 0))


def 구슬재질(이름="구슬"):
    """마스코트의 구슬눈 — 잉크 #2B2320(리니어 환산값), 광은 조명이 맺는다."""
    m, nt, out = 새재질(이름)
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = (0.0242, 0.0168, 0.0144, 1.0)
    p.inputs["Roughness"].default_value = 0.14
    if "Coat Weight" in p.inputs:
        p.inputs["Coat Weight"].default_value = 0.6
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


def 실재질():
    """실땀의 실 — 방적사(꼬인 실)라 펠트보다 매끈하고 살짝 광이 돈다. 색 = Stitch(리니어).
    7판: 꼬임 범프 — 매끈한 튜브는 «플라스틱 끈»으로 읽힌다. 잔 노이즈가 방적의 서명."""
    m, nt, out = 새재질("Loom_실")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = (0.871, 0.768, 0.577, 1.0)
    p.inputs["Roughness"].default_value = 0.5
    if "Sheen Weight" in p.inputs:
        p.inputs["Sheen Weight"].default_value = 0.25
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 42.0
    nz.inputs["Detail"].default_value = 3.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.2
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    return m


# 🔴 7판 실측 — 「잔털(파티클)」 방향은 이 부품들에서 철회했다. 두 겹으로 실패:
#   ① 이 스케일의 판판한 아플리케에서 겉털이 형태·«사진 결»을 통째로 덮어 회색 카펫이 됐다
#      (룸섬유 축 ① 「길면 털이 형태를 먹는다」 그대로) ② 이 블렌더 판에서 털재질의 색 입력이
#      조용히 무시돼 코랄이 회색으로 떴다(넣기가 없는 키를 조용히 넘김). 펠트의 결은 사진이 정본.


def 땀하나(이름, 부모, 중심, 방향, 표면z, 길이=0.11, 굵기=0.014, 솟음=0.032, 잠김=0.024, 재질=None):
    """실땀 한 개 — 실이 천을 «뚫고 나와» 봉긋 솟았다가 다시 «들어간다»(양끝은 표면 아래).
    납작한 원기둥을 얹으면 인쇄로 읽힌다 — 손바느질의 서명은 이 아치다."""
    ux, uy = 방향
    cu = bpy.data.curves.new(이름, 'CURVE')
    cu.dimensions = '3D'; cu.bevel_depth = 굵기; cu.bevel_resolution = 3; cu.use_fill_caps = True
    sp = cu.splines.new('NURBS')
    sp.points.add(2)
    좌 = (중심[0] - ux * 길이 / 2, 중심[1] - uy * 길이 / 2, 표면z - 잠김, 1.0)
    마루 = (중심[0], 중심[1], 표면z + 솟음, 1.0)
    우 = (중심[0] + ux * 길이 / 2, 중심[1] + uy * 길이 / 2, 표면z - 잠김, 1.0)
    for pt, v in zip(sp.points, (좌, 마루, 우)):
        pt.co = v
    sp.use_endpoint_u = True; sp.order_u = 3
    o = bpy.data.objects.new(이름, cu)
    bpy.context.scene.collection.objects.link(o)
    if 재질:
        o.data.materials.append(재질)
    if 부모:
        o.parent = 부모
    return o


def _안인가(pts2, px, py):
    """짝홀 판정 — 오목 꺾쇠에서 «안쪽 법선»을 고르는 데 쓴다."""
    안 = False
    n = len(pts2)
    for i in range(n):
        x1, y1 = pts2[i]; x2, y2 = pts2[(i + 1) % n]
        if (y1 > py) != (y2 > py):
            xc = x1 + (py - y1) * (x2 - x1) / (y2 - y1)
            if xc > px:
                안 = not 안
    return 안


def 꺾쇠실땀(부모, 크기=1.0, 안쪽=0.10, 표면z=0.16, 간격=0.17, 굵기=0.014, 길이=0.11, 재질=None, 이름앞="땀"):
    """꺾쇠 외곽을 따라 실땀을 두른다 — 확정 시안의 점선 실땀을 3D 로 옮긴 것.
    변마다 안쪽 법선을 짝홀 판정으로 고르므로 오목 다각형에서도 밖으로 안 샌다."""
    pts2 = [((x - 135.5) / 24.0 * 크기, (66.35 - y) / 24.0 * 크기) for x, y in
            [(146, 46.7), (112, 66.35), (146, 86), (159, 86), (125, 66.35), (159, 46.7)]]
    n = len(pts2); 번 = 0
    for i in range(n):
        ax, ay = pts2[i]; bx, by = pts2[(i + 1) % n]
        ex, ey = bx - ax, by - ay
        L = math.hypot(ex, ey)
        ux, uy = ex / L, ey / L
        nx, ny = -uy, ux
        mx, my = (ax + bx) / 2 + nx * 0.03, (ay + by) / 2 + ny * 0.03
        if not _안인가(pts2, mx, my):
            nx, ny = uy, -ux
        여백 = 0.15 * 크기 + 안쪽
        가용 = L - 2 * 여백
        if 가용 < 길이 * 0.6:
            continue                                   # 꼭짓점 근처 짧은 변은 비운다(손바느질도 그렇다)
        개수 = max(1, int(가용 // 간격))
        for k in range(개수):
            t = 여백 + 가용 * (k + 0.5) / 개수
            땀하나("%s%d" % (이름앞, 번), 부모,
                  (ax + ux * t + nx * 안쪽, ay + uy * t + ny * 안쪽), (ux, uy),
                  표면z, 길이=길이, 굵기=굵기, 재질=재질)
            번 += 1


def 꺾쇠몸(이름="꺾쇠", 크기=1.0, 두께=0.32, 모폭=0.07, 평면="XZ"):
    """로고 v2 꺾쇠 — 정본 좌표(벌림 60° · x-height 정렬)를 그대로 세운다.
    🚫자리마다 눈대중으로 다시 그리지 않는다(DESIGN.md §4) — 좌표의 주인은 로고 정본이다."""
    pts = [(146, 46.7), (112, 66.35), (146, 86), (159, 86), (125, 66.35), (159, 46.7)]
    if 평면 == "XY":
        verts = [((x - 135.5) / 24.0 * 크기, (66.35 - y) / 24.0 * 크기, 0.0) for x, y in pts]
    else:
        verts = [((x - 135.5) / 24.0 * 크기, 0.0, (66.35 - y) / 24.0 * 크기) for x, y in pts]
    mesh = bpy.data.meshes.new(이름)
    mesh.from_pydata(verts, [], [list(range(6))])
    mesh.update()
    o = bpy.data.objects.new(이름, mesh)
    bpy.context.scene.collection.objects.link(o)
    # 오목 다각형이라 삼각화를 먼저 — ngon 그대로 두면 솔리디파이가 면을 뒤집을 수 있다.
    o.modifiers.new('tri', 'TRIANGULATE')
    sol = o.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 두께; sol.offset = 0.0
    bev = o.modifiers.new('bev', 'BEVEL'); bev.width = 모폭; bev.segments = 4
    bev.limit_method = 'ANGLE'; bev.angle_limit = math.radians(52)
    return o


def 로고꺾쇠세우기():
    """B2 «신호만 펠트» — 워드마크의 코랄 꺾쇠(로고 한 벌 확정 · 유호 08-21).
    벡터 정본은 그대로 살고, 이 판은 그 위에 앉는 «표현층»이다.
    🔴 1판 실측: XZ 평면에 지으면 Object 매핑이 이미지의 (x,y)만 써서 y=상수 → 결이
    **1차원 줄무늬**로 뽑혔다(직물처럼 보임). XY 평면에 짓고 몸을 세워야 (x,y)가 다 산다."""
    o = 꺾쇠몸("로고꺾쇠", 모폭=0.085, 평면="XY")
    o.rotation_euler = (math.radians(90.0), 0, 0)      # 정면 직교 카메라와 한 벌 — 원근 0
    o.data.materials.append(펠트재질(펠트색 or "Coral", 스케일=2.6, 돌림=9.0, 염색보정=True, 결흩기=0.45))
    # 🔴 5판 실측: 굵기 0.015·간격 0.18 두 줄이 좁은 팔(폭 0.47)에서 «철길»로 읽혔다 — 가늘고 성기게.
    꺾쇠실땀(o, 크기=1.0, 안쪽=0.08, 표면z=0.16, 간격=0.21, 굵기=0.0095, 길이=0.082, 재질=실재질())


def 로고배지세우기():
    """앱 아이콘 «몽글 배지» — 꺾쇠가 입이 되는 옆모습(로고 한 벌 확정 · 유호 08-21).
    좌표는 확정 시안 SVG(r106 원판 기준)를 1/106 로 그대로 옮겼다 — 눈대중 금지."""
    bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=0.30, vertices=192, location=(0, 0, 0))
    판 = bpy.context.object; 판.name = "배지판"
    모따기(판, 폭=0.09, 단=5)
    # 🔴 3·4판 실측: Oat 는 거의 무채라 채도로는 안 물든다 — Stone(리니어) 혼합으로 «염색»한다.
    판.data.materials.append(펠트재질("Oat", 스케일=2.8, 돌림=9.0, 염색보정=True, 결흩기=0.45,
                                   채도=1.25, 밝기=0.85, 염색혼합=(0.571, 0.521, 0.445, 0.62)))

    def 붙이기(o, 위치):
        o.parent = 판          # matrix_parent_inverse 는 항등 그대로 — location 이 판-로컬 좌표가 된다
        o.location = 위치

    실 = 실재질()
    입 = 꺾쇠몸("입", 크기=0.453, 두께=0.10, 모폭=0.042, 평면="XY")   # 시안: scale2 꺾쇠 폭 94 / 지름 212
    입.data.materials.append(펠트재질("Coral", 스케일=2.6, 돌림=9.0, 염색보정=True, 결흩기=0.45))
    붙이기(입, (-0.038, -0.236, 0.20))
    # 🔴 5판 실측: 입에 실땀을 두르니 과밀해 신호(코랄 1점)를 잡아먹었다 — 입은 민 코랄이 정답.

    눈 = 구("눈", 0.099, (0, 0, 0), 세그=96)                          # 1~2시 방향(유호 픽 08-20)
    눈.data.materials.append(구슬재질())
    붙이기(눈, (0.302, 0.340, 0.195))

    bpy.ops.mesh.primitive_cylinder_add(radius=0.094, depth=0.024, vertices=96, location=(0, 0, 0))
    홍조 = bpy.context.object; 홍조.name = "홍조"
    홍조.scale = (1.0, 0.65, 1.0)
    홍조.data.materials.append(펠트재질("CoralSoft", 스케일=3.0, 염색보정=True, 결흩기=0.45))
    붙이기(홍조, (0.509, 0.038, 0.163))

    # 🔴 1판 실측: z=0.02(원판 중간면)에 두니 뿔이 원판 실루엣 «뒤»에 숨어 겨우 비쳤다.
    #   앞면 쪽(z 0.10)으로 당기고 조금 키워야 「반 이상 걸침」(시안 검산 기준)이 렌더에서도 산다.
    뿔펠트 = 펠트재질("Coral", 스케일=3.5, 돌림=9.0, 염색보정=True, 결흩기=0.45)
    뿔모양 = [(1.0, 0.93, 0.87), (0.95, 1.0, 0.9), (0.9, 0.87, 1.0)]   # 완전 구는 공장 티 — 뭉친 양모는 부정형
    for i, (x, y, r) in enumerate([(-0.075, 1.0, 0.082), (0.009, 1.005, 0.092), (0.094, 0.99, 0.070)]):
        뿔 = 구("뿔%d" % i, r, (0, 0, 0), 세그=64)                     # 양모 뿔 — 원판 윗단에 걸친다
        뿔.scale = 뿔모양[i]
        뿔.rotation_euler = (0.3, 0.2 * i, 0.4 + 0.5 * i)
        뿔.data.materials.append(뿔펠트)
        붙이기(뿔, (x, y, 0.10))

    for i in range(24):                                               # 실땀 링 r0.868 — 3D 아치 24땀
        a = i / 24.0 * math.tau
        땀하나("링땀%d" % i, 판, (0.868 * math.cos(a), 0.868 * math.sin(a)),
              (-math.sin(a), math.cos(a)), 0.15, 길이=0.13, 굵기=0.016, 재질=실)

    판.rotation_euler = (math.radians(84.0), math.radians(-4.0), 0)   # 원판과 같은 «들어 보인» 각


세우기표 = {
    "유리구": 유리세우기,
    "레진구": lambda: 레진세우기((0, 0, 0)),
    "원판": 원판세우기,
    "판": 판세우기,
    "칩": 칩세우기,
    "합주": 합주세우기,
    "로고꺾쇠": 로고꺾쇠세우기,
    "로고배지": 로고배지세우기,
}


def 굽기(이름, 만들기):
    치우기(); 만들기()
    os.makedirs(OUT, exist_ok=True)

    # 🥇 한 수 더 — **몸과 그림자를 두 장으로 가른다.**
    #   설계 §3-4 ⚠ 는 「③뒤·⑥합주는 지면 배경을 알아야 성립 → 한 번 굽고 아무 데나 붙이기와
    #   원리적으로 충돌」이라 적었다. 그 충돌의 절반은 **접지**다 — 그림자·코스틱이 몸에 구워져 있으면
    #   배경이 바뀔 때마다 다시 구워야 한다. 두 장으로 가르면 지면이 그림자를 곱하기로 얹어
    #   **배경마다 다시 굽지 않아도 접지가 맞는다**(굴절에 비친 «뒤»는 여전히 무대의 것이라
    #   충돌이 사라지진 않는다 — 절반이 열린 것이고, 그 절반이 지면 수를 곱하던 쪽이다).
    몸들 = [o for o in bpy.data.objects if o.type in ('MESH', 'FONT', 'CURVE') and o.name not in
            ({floor.name} | {s.name for s in 세트} | ({안개덩이.name} if 안개덩이 else set()))]

    if 그림자층:
        floor.hide_render = True          # 몸만 — 접지 없이 깨끗한 알파
        scene.render.filepath = os.path.join(OUT, 이름 + "_몸")
        bpy.ops.render.render(write_still=True)
        결층(os.path.join(OUT, 이름 + "_몸.png"))
        print("[loom] 구움:", os.path.join(OUT, 이름 + "_몸.png"))

        floor.hide_render = False         # 그림자·코스틱만 — 몸은 카메라에서만 숨긴다
        for o in 몸들:
            o.visible_camera = False
        scene.render.filepath = os.path.join(OUT, 이름 + "_접지")
        bpy.ops.render.render(write_still=True)
        for o in 몸들:
            o.visible_camera = True
        print("[loom] 구움:", os.path.join(OUT, 이름 + "_접지.png"))
    else:
        경로 = os.path.join(OUT, 이름 + ".png")
        scene.render.filepath = os.path.join(OUT, 이름)
        bpy.ops.render.render(write_still=True)
        결층(경로)
        print("[loom] 구움:", 경로)


if 부품 not in 세우기표:
    print("[loom] 🔴 모르는 부품:", 부품, "· 있는 것 =", ", ".join(세우기표))
    sys.exit(2)

굽기(이름, 세우기표[부품])
print("[loom] 끝 · 부품=%s 단계=%s volume_bounces=%d HDRI=%s 안개=%s 봉입=%s"
      % (부품, 단계, c.volume_bounces, bool(HDRI), 안개, 봉입종류))

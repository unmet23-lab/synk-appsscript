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
변주 = 값("--변주")              # 실험 부품의 색 갈래 — 로고쌍꺾쇠가 쓴다(쌍꺾쇠변주 표 참조)
# 요리 사진은 «다 안 보여준다» — 접시를 자르고 들어가는 것이 그 장르의 서명이다.
# 1.0 = 접시 전체(제품 사진) · 0.6 = 당겨 자른 판(요리 사진). 카메라 거리만 움직이는 눈금.
당김 = float(값("--당김", "1.0"))
# ── 모션 눈금 (로고 한 벌의 «모션·영상» 칸 · 공명 기각 뒤 다시 짓는 자리) ──
#   진행 0.0~1.0 = 한 컷 안의 시각. 시퀀스 n = 한 번 실행으로 n 장을 잇달아 굽는다
#   (프레임마다 블렌더를 새로 띄우면 씬 셋업만 40번이라 굽기 시간이 몇 배가 된다).
진행 = float(값("--진행", "1.0"))
시퀀스 = int(값("--시퀀스", "0"))
# 상을 넓게 담을수록 카메라가 높으면 «요리 사진»이 아니라 «배치도»가 된다 — 눈을 낮추면
# 사물이 서로 겹치며 깊이가 생긴다. 1.0 = 기본 32.4° · 0.82 = 눕힌 27.5°.
눈높이 = float(값("--눈높이", "1.0"))
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
# 🪦 「합주」의 카메라 자리는 2026-09-07 에 걷혔다 — 까닭은 아래 세우기표의 무덤 줄이 쥔다.
if 부품 == "판":
    # ⚠ **여기만 ⑤광학(오프센터·심도)을 일부러 어긴다.** 카드 테두리는 9분할(border-image)로
    #   늘려 쓰는 부품이라 원근이 있으면 네 변의 두께가 달라져 «못 늘린다».
    #   ⑤는 «구도»의 자이고 재질의 자가 아니다 — 굴절·분산·박막·모따기 하이라이트는 그대로 산다.
    #   그래서 이 예외는 재질을 깎지 않는다(깎았다면 예외를 두지 않았을 것이다).
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2.35
    cam_data.dof.use_dof = False
    cam.location = (0, -7.0, 0)
    cam.rotation_euler = (math.radians(90), 0, 0)
elif 부품 == "로고고리":
    # ⚠ **꺾쇠와 같은 예외** — 심볼 자리(도장·워터마크)에 벡터와 겹쳐 앉는 부품이라 원근이 있으면
    #   외곽이 어긋난다. bbox 는 x·y 모두 ±3.2/±2.9 이므로 여유를 둬 6.9.
    cam_data.type = 'ORTHO'
    # 정적 판은 6.9 가 «딱»이다(최대 x 3.475 vs 화면 반경 3.45 — 0.025 만 빠듯하게 잘린다).
    # 🔴 모션 실측: 첫 컷은 링이 1.30 배 벌어져 최대 x 3.835 라 그대로 두면 프레임 밖으로 나간다.
    #    ⇒ 시퀀스일 때만 1.22 배 넓힌다(여유 0.374). 정적 판의 구도는 한 눈금도 안 건드린다.
    cam_data.ortho_scale = 6.9 * (1.22 if 시퀀스 else 1.0)
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
elif 부품 == "로고찡긋플레이팅":
    # ⑤광학 그대로 — 오프센터·심도. 다만 «식탁 내려보기»(요소굽기 플레이팅 59° 문법)로 눕힌다.
    #   🔑 거리는 눈이 아니라 화각이 정한다(4계 ④): 담을 폭 8.0(접시 지름 6.4 + 여백) ·
    #      85mm/센서36 화각폭 23.9° ⇒ d = 8.0 / (2·tan 11.95°) = 18.9. 그 방향으로 물러선다.
    #      망원 압축은 덤이 아니라 «요리 사진의 문법»이다 — 접시가 안 휘고 알들이 서로 기댄다.
    import mathutils as _mu0
    _눈 = _mu0.Vector((1.1, -15.9, 10.1 * 눈높이)) * 당김
    cam.location = _눈
    cam.rotation_euler = (_mu0.Vector((0, -0.2, 0.0)) - _눈).to_track_quat('-Z', 'Y').to_euler()
    cam_data.dof.focus_distance = 18.9 * 당김
    #   🔴 5판: f/3.2 는 화면 전체가 거의 선명해 «제품 사진»으로 남았다 — 요리 사진은 초점면이
    #      얇아 앞뒤가 풀리고, 그 풀림이 «눈으로 본 한 순간»을 만든다.
    cam_data.dof.aperture_fstop = 2.5
elif 부품 in ("원판", "칩", "로고배지", "로고쌍꺾쇠"):
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
# ── 플레이팅 전용 «창빛» — 요리 사진의 조명은 스튜디오가 아니라 «창문»이다 ──
#   음식 사진의 서명: 큰 창이 후측면에서 들어와 윤곽을 긋고, 반대편은 약한 반사판이 겨우 든다.
#   4계 ②(가장 밝은 것은 하나)·③(어둠을 두려워 않기)를 그대로 — 다만 그 하나가 창이다.
#   ⚠기존 key·fill·rim 은 **이 부품에서만** 낮춘다(다른 부품의 확정 조명은 한 줄도 안 건드린다).
if 부품 == "로고찡긋플레이팅":
    import mathutils as _mu2
    창위치 = (-4.2, 4.0, 5.2)
    _dw = _mu2.Vector((0, 0, 0)) - _mu2.Vector(창위치)
    # 역제곱(4계 ④): 로고 스침 1000W@6.59 와 같은 조도가 이 거리(7.79)면 1400W. 창은 더 크고 부드러우니 1800.
    #   🔴 1판 실측: 창 크기 8.0 은 그림자를 통째로 지워 알들이 접시에서 **떴다**.
    #      요리 사진에서 «놓여 있음»을 만드는 것은 빛이 아니라 그 빛이 만드는 접촉 그림자다.
    #      창을 좁혀(5.0) 방향을 주되, 부드러움은 유지한다.
    #   🔴 4판 실측: 백색 창빛 아래 화면 전체가 «회색조»가 되어 「귀엽다」엔 닿아도
    #      「맛있다」엔 못 닿았다. 요리 사진의 온기는 색을 칠해서가 아니라 **빛의 색온도**가 낸다 —
    #      오후 창가(≈3400K)의 따뜻함이 들어와야 같은 펠트가 «먹을 것»으로 읽힌다.
    #      그리고 반대편 반사판은 살짝 차갑게: 따뜻↔차가움의 «색 대비»가 사진의 입체를 만든다
    #      (인계 4계 ①의 색판 — 대비는 재료가 내고 빛은 거든다).
    area("창빛", 창위치, _dw.to_track_quat('-Z', 'Y').to_euler(), 4.5, 1560 * 램프배,
         color=(1.0, 0.845, 0.665), shape='SQUARE')
    반사위치 = (4.0, -3.2, 1.8)
    _dr = _mu2.Vector((0, 0, 0)) - _mu2.Vector(반사위치)
    area("반사판", 반사위치, _dr.to_track_quat('-Z', 'Y').to_euler(), 6.0, 78 * 램프배,
         color=(0.88, 0.925, 1.0))   # 5판: 0.80 은 접시를 파랗게 물들여 «차가운 그릇»이 됐다
    for _n, _배 in (("key", 0.22), ("fill", 0.45), ("rim", 0.12)):
        bpy.data.lights[_n].energy *= _배

if 부품 in ("로고꺾쇠", "로고배지", "로고쌍꺾쇠", "로고고리"):
    import mathutils as _mu
    스침위치 = (-4.0, -3.6, 4.6)      # 9판: 더 위에서, 더 크게 — 라벨태그 판의 «큰 소프트 명암» 이식
    _d = _mu.Vector((0, 0, 0)) - _mu.Vector(스침위치)
    area("스침", 스침위치, _d.to_track_quat('-Z', 'Y').to_euler(), 4.6, 1000 * 램프배)

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


def 펠트재질(색=None, 스케일=2.4, 돌림=0.0, 염색보정=False, 결흩기=0.0, 채도=1.22, 밝기=0.86, 염색혼합=None, 거칠기=0.95):
    """헌법 ① — 결은 사진 픽셀에서만. 펠트는 실물이 있으니 «찍은 것»을 쓴다.
    색 = 펠트패치_0815 타일 이름(Coral·Oat·Paper·Stitch…). 안 주면 구판 그대로 Cream3 —
    기존 호출은 전부 무인자라 이 확장은 더하는 층이다(F503).
    스케일↑ = 결이 잘아진다 · 돌림 = 축 정렬 깨기 · 염색보정 = AgX·조명이 씻는 채도 복원.
    결흩기 = 표본 좌표를 노이즈로 흩는다 — 🔴 2판 실측: 패치 전량이 «거울 타일»이라
    어느 스케일에서도 반복 격자가 무늬로 드러났다. 소재가 아니라 좌표를 흩어야 풀린다
    (픽셀은 여전히 실물 사진에서 온다 — 헌법 ① 그대로)."""
    m, nt, out = 새재질("Loom_펠트" + ("_" + 색 if 색 else ""))
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    # 0.95 = 완전 확산(펠트의 정의 · 토큰 §재질.펠트.셰이딩). 낮추는 것은 «과육의 윤기» 같은
    # 예외 한 점뿐이다 — 지면 부품이 이 값을 내리면 펠트가 아니라 왁스가 된다.
    p.inputs["Roughness"].default_value = 거칠기
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


def 수제눌림(o, 세기=0.03, 크기=0.55, 좌표='LOCAL'):
    """실물의 서명 — 기계로 뽑은 면은 평평하고, 손으로 만든 펠트는 «저주파»로 울퉁불퉁하다.
    결 범프(고주파)와 다른 층: 이건 형태 자체의 미세 굴곡이다(라벨태그 판과의 대조에서 나온 처방).
    ⚠저폴리 메시에선 디스플레이스가 안 먹는다 — 단순 서브디비전을 먼저 깐다."""
    sub = o.modifiers.new('눌림밑', 'SUBSURF')
    sub.subdivision_type = 'SIMPLE'
    sub.levels = sub.render_levels = 3
    tx = bpy.data.textures.new('눌림_' + o.name, 'CLOUDS')
    tx.noise_scale = 크기
    dm = o.modifiers.new('눌림', 'DISPLACE')
    dm.texture = tx
    dm.strength = 세기
    dm.mid_level = 0.5
    # 🔴 실측 08-21(냅킨): scale 로 늘린 판에서 LOCAL 은 주름까지 같이 늘려 «물결 비닐»이 된다
    #    (늘린 배수만큼 주름이 가로로 퍼진다). 늘린 오브젝트는 GLOBAL 이 답이다.
    dm.texture_coords = 좌표


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
    수제눌림(o, 세기=0.030, 크기=0.55)
    o.rotation_euler = (math.radians(90.0), 0, 0)      # 정면 직교 카메라와 한 벌 — 원근 0
    o.data.materials.append(펠트재질(펠트색 or "Coral", 스케일=2.6, 돌림=9.0, 염색보정=True, 결흩기=0.45))
    # 🔴 5판 실측: 굵기 0.015·간격 0.18 두 줄이 좁은 팔(폭 0.47)에서 «철길»로 읽혔다 — 가늘고 성기게.
    꺾쇠실땀(o, 크기=1.0, 안쪽=0.08, 표면z=0.16, 간격=0.21, 굵기=0.0095, 길이=0.082, 재질=실재질())


def 로고배지세우기():
    """앱 아이콘 «몽글 배지» — 꺾쇠가 입이 되는 옆모습(로고 한 벌 확정 · 유호 08-21).
    좌표는 확정 시안 SVG(r106 원판 기준)를 1/106 로 그대로 옮겼다 — 눈대중 금지.
    🔒 **확정 = 3차 마감판**(유호 08-21 「3차 마감본으로 확정하자」 · 결정.md):
    옆모습 그대로 · 수제 눌림 없음(매끈한 쿠션이 이 부품의 확정 결) · 모따기 0.09/5단.
    🔴 10~11판 «정면 얼굴»(큰 눈 둘·작은 중앙 입·홍조 둘)은 실험 후 **기각**됐다 —
    코드는 git 이력(11676697)에 있다. 재제안 전 결정.md 를 본다."""
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


쌍꺾쇠변주 = {
    # 색은 킷 «이름» 참조(디자인_토큰 §색 · 퇴역 대기 12색 금지) — 값은 그대로 펠트재질 인자다.
    # 눈(Paper)은 밝기 보정을 끈다: 근사 백은 기본 0.86 감광이 «때 탄 흰색»으로 읽힌다.
    # 🔴 1판 실측: 판 결흩기 0.45 로는 Lapis 타일의 강한 모티프가 다이아 격자로 살아남았다
    #    (Oat 만 겪은 문제가 아니었다 — 유채 타일이 더 세다). 판은 0.78/스케일 3.2 가 자리.
    "버터":  {"판": dict(색="Butter",  스케일=3.2, 돌림=13.0, 염색보정=True, 결흩기=0.78),
             "눈": dict(색="Coral",   스케일=2.6, 돌림=9.0, 염색보정=True, 결흩기=0.45)},
    "라피스": {"판": dict(색="Lapis",  스케일=3.2, 돌림=13.0, 염색보정=True, 결흩기=0.78),
             "눈": dict(색="Paper",   스케일=2.6, 돌림=9.0, 염색보정=True, 채도=1.0, 밝기=1.0, 결흩기=0.45)},
    "팝":   {"판": dict(색="PopSoft", 스케일=3.2, 돌림=13.0, 염색보정=True, 결흩기=0.78),
             "눈": dict(색="Pop",     스케일=2.6, 돌림=9.0, 염색보정=True, 결흩기=0.45)},
}


def 로고쌍꺾쇠세우기():
    """«>< 찡긋» 실험 배지 (유호 지시 08-21 「얼굴을 전부 지우고 … >< 이런식으로 귀엽고 트랜디하게」).
    얼굴 부품 0 — 눈·홍조·뿔을 다 걷어내면 꺾쇠 «둘»이 마주 보는 것만으로
    찡긋 감은 눈(이모티콘 >< 문법)이 된다: 그리지 않았는데 얼굴인 것이 이 판의 위트다.
    쿠션·모따기·실땀 링은 확정 배지(3차)의 결을 그대로 빌린다 — 움직이는 것은 색과 부호뿐.
    ⚠확정 아님 — 몽글 배지 확정(결정.md 08-21)과 «별개» 실험. 변주 = --변주 (쌍꺾쇠변주 표)."""
    if 변주 and 변주 not in 쌍꺾쇠변주:  # 모르는 변주가 조용히 버터로 대체돼 굽기 시간을 버리던 것(검수 7f48254b68c1)
        raise SystemExit("모르는 변주: %s · 있는 것 = %s" % (변주, ", ".join(쌍꺾쇠변주)))
    갈래 = 쌍꺾쇠변주.get(변주 or "버터", 쌍꺾쇠변주["버터"])
    판 = 찡긋배지하나(갈래, 이름앞="찡긋")
    판.rotation_euler = (math.radians(84.0), math.radians(-4.0), 0)   # 확정 배지와 같은 «들어 보인» 각


def 찡긋배지하나(갈래, 이름앞="찡긋", 위치=(0, 0, 0), 롤=0.0, 기울=None):
    """찡긋 배지 «한 알»을 세워 판 오브젝트를 돌려준다 — 회전·자리는 부르는 쪽이 정한다.
    아이콘 판(로고쌍꺾쇠)과 플레이팅 판(로고찡긋플레이팅)이 **같은 레시피**를 쓰게 하는 자리다:
    둘이 갈리면 「접시 위의 그것」과 「아이콘의 그것」이 조용히 다른 물건이 된다."""
    bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=0.30, vertices=192, location=위치)
    판 = bpy.context.object; 판.name = 이름앞 + "판"
    모따기(판, 폭=0.09, 단=5)
    판.data.materials.append(펠트재질(**갈래["판"]))

    눈재 = 펠트재질(**갈래["눈"])
    for 이름, 쪽 in ((이름앞 + "눈왼", -1), (이름앞 + "눈오", +1)):
        눈 = 꺾쇠몸(이름, 크기=0.34, 두께=0.10, 모폭=0.036, 평면="XY")
        눈.data.materials.append(눈재)
        눈.parent = 판                     # matrix_parent_inverse 항등 — location 이 판-로컬
        눈.location = (0.42 * 쪽, 0.06, 0.20)
        # 왼쪽은 180° 돌려 «>» — 꺾쇠가 상하 대칭이라 거울과 같다.
        # 🔴 1판 실측: ±6° «손맛» 기울임은 찡긋이 아니라 삐딱함으로 읽혔다 — 곧게 둔다.
        #    손맛은 이미 판의 -4° 롤·펠트 결·수제 실땀이 낸다(겹치면 흐트러짐이 된다).
        눈.rotation_euler = (0, 0, math.radians(180.0 if 쪽 < 0 else 0.0))

    실 = 실재질()
    for i in range(24):                                               # 실땀 링 — 확정 배지와 같은 값
        a = i / 24.0 * math.tau
        땀하나(이름앞 + "링땀%d" % i, 판, (0.868 * math.cos(a), 0.868 * math.sin(a)),
              (-math.sin(a), math.cos(a)), 0.15, 길이=0.13, 굵기=0.016, 재질=실)
    if 기울:
        # 🔑 «놓인 것»과 «떠 있는 것»을 가르는 것은 그림자가 아니라 **기울기**다(유호 08-21
        #    「파란색이 공중에 떠있는것같아」). 무언가에 걸친 물건은 반드시 기운다 — 수평을
        #    유지하려면 공중부양이 필요하다. 축·각은 눈이 아니라 접점 둘로 계산한다(4계 ④).
        import mathutils as _mt
        축, 각 = 기울
        판.rotation_euler = (_mt.Quaternion(축, math.radians(각))
                             @ _mt.Quaternion((0, 0, 1), math.radians(롤))).to_euler()
    elif 롤:
        판.rotation_euler = (0, 0, math.radians(롤))
    return 판


# ── 카페 디저트 소품 (유호 지시 08-21 「과일이나 케이크나 음료수같은 플레이팅을 제대로」) ──
#   ⚠다른 세션의 «음식» 갈래(tools/요소굽기.py 만두·김밥·붕어빵·귤·도넛)와 **겹치지 않는다** —
#     그쪽은 낱개로 굽는 «부품»이고 이것들은 플레이팅 장면 안에서만 사는 «소품»이다.
#     둘 다 같은 규율을 따른다: 재료는 전부 펠트·실이고 색은 킷 이름 참조다.

def 부채꼴몸(이름, 반경, 각도, 두께, 위치, 세그=30, 모=0.014):
    """케이크 «한 조각»의 한 층 — 중심에서 호까지의 부채꼴을 세워 두께를 준다."""
    각 = math.radians(각도)
    verts = [(0.0, 0.0, 0.0)]
    for i in range(세그 + 1):
        a = -각 / 2 + 각 * i / 세그
        verts.append((반경 * math.cos(a), 반경 * math.sin(a), 0.0))
    mesh = bpy.data.meshes.new(이름)
    mesh.from_pydata(verts, [], [list(range(len(verts)))])
    mesh.update()
    o = bpy.data.objects.new(이름, mesh)
    bpy.context.scene.collection.objects.link(o)
    o.location = 위치
    o.modifiers.new('tri', 'TRIANGULATE')
    sol = o.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 두께; sol.offset = 0.0
    bev = o.modifiers.new('bev', 'BEVEL'); bev.width = 모; bev.segments = 3
    bev.limit_method = 'ANGLE'; bev.angle_limit = math.radians(50)
    return o


def 케이크조각(위치, 바닥z, 돌림=0.0):
    """시트–크림–시트–크림 네 층 + 위의 열매 한 알. 층이 보여야 «케이크»다 —
    한 덩이 갈색은 빵이고, 켜가 보이는 순간 디저트가 된다."""
    x, y = 위치
    시트천 = 펠트재질("Butter", 스케일=3.4, 돌림=13.0, 염색보정=True, 채도=1.1, 밝기=0.86, 결흩기=0.6)
    크림천 = 펠트재질("Paper", 스케일=4.6, 돌림=7.0, 염색보정=True, 채도=0.95, 밝기=1.0, 결흩기=0.5)
    층 = []
    z = 바닥z
    for 이름, 반경, 두께, 천 in (("시트1", 1.00, 0.20, 시트천), ("크림1", 1.02, 0.07, 크림천),
                              ("시트2", 1.00, 0.20, 시트천), ("크림2", 1.02, 0.07, 크림천)):
        o = 부채꼴몸("케이크" + 이름, 반경 * 0.86, 56.0, 두께, (x, y, z + 두께 / 2))
        o.rotation_euler = (0, 0, math.radians(돌림))
        o.data.materials.append(천)
        층.append(o)
        z += 두께
    # 위의 크림 한 덩이 + 그 위의 열매 — 케이크의 «한 점». 시선이 여기서 멈춘다(4계 ②).
    #   크림이 한 겹 있어야 열매가 «얹힌» 것이 되고, 없으면 열매가 시트에 «박힌» 것이 된다.
    꼭짓 = (x + 0.42 * math.cos(math.radians(돌림)), y + 0.42 * math.sin(math.radians(돌림)))
    크림덩이 = 구("케이크크림", 0.21, (꼭짓[0], 꼭짓[1], z + 0.055), 세그=48)
    크림덩이.scale = (1.0, 0.96, 0.54)
    크림덩이.data.materials.append(크림천)
    윗열매 = 구("케이크열매", 0.145, (꼭짓[0], 꼭짓[1], z + 0.055 + 0.113 + 0.115), 세그=56)
    윗열매.scale = (1.0, 0.94, 0.88)
    윗열매.data.materials.append(펠트재질("PopDeep", 스케일=3.6, 돌림=11.0, 염색보정=True,
                                      채도=1.15, 밝기=0.82, 결흩기=0.5, 거칠기=0.72))
    return z


def 컵세트(위치, 바닥z):
    """커피 한 잔 — 소서 · 위가 넓은 컵 · 검은 수면 · 손잡이. 음료가 있어야 «한 상»이 된다:
    디저트 사진에서 잔은 배경이 아니라 «시간»이다(누군가 앉아 있었다는 뜻)."""
    x, y = 위치
    도자기 = 펠트재질("Stone", 스케일=2.6, 돌림=5.0, 염색보정=True, 채도=1.0, 밝기=0.86,
                  결흩기=0.6, 거칠기=0.62)          # 도자기라 펠트보다 매끈하다
    bpy.ops.mesh.primitive_cylinder_add(radius=1.10, depth=0.07, vertices=96,
                                        location=(x, y, 바닥z + 0.035))
    소서 = bpy.context.object; 소서.name = "소서"
    모따기(소서, 폭=0.028, 단=3)
    소서.data.materials.append(도자기)
    # 컵은 «위가 넓다» — 원기둥이면 통조림이 된다.
    # 🔴 12판: 작은 잔은 «통조림»으로 읽혔다 — 잔은 소서 대비 충분히 커야 잔이다.
    # 🔴 14판: 지름 1.40 대 높이 0.90 은 넓적해서 «모자»로 읽혔다 — 잔은 지름과 높이가 비슷하다.
    bpy.ops.mesh.primitive_cone_add(radius1=0.46, radius2=0.56, depth=1.00, vertices=96,
                                    location=(x, y, 바닥z + 0.07 + 0.50))
    컵 = bpy.context.object; 컵.name = "컵"
    bpy.ops.object.shade_smooth()
    컵.data.materials.append(도자기)
    # 수면 — 컵 테두리보다 조금 아래(가득 찬 잔은 «못 드는 잔»이다)
    # 🔴 13판 실측: 수면을 «잔 안쪽»(테두리 0.16 아래)에 두었더니 아예 안 보였다 —
    #    primitive_cone 은 **속이 찬 덩어리**라 파낸 공간이 없다. 그릇을 진짜로 파려면 불리언이
    #    필요하고, 이 크기(화면에서 잔은 손톱만하다)에 그 비용을 쓸 이유가 없다.
    #   🔴 14판 재실측: 테두리 «아래»로는 부족했다 — 원뿔은 위쪽에도 «뚜껑»(반경 radius2 의 원판)이
    #      있어서 그 아래 있는 것은 무엇이든 가린다. 수면은 그 뚜껑 «위»에 얹혀야 보인다.
    #      ⇒ z 를 상단보다 0.005 올리고 반경을 0.04 줄여, 남는 테두리가 잔의 림으로 읽히게 한다.
    #      🔴 15판: 0.005 만 올렸더니 수면 «밑면»이 뚜껑보다 아래라 두 면이 겹쳐(z-fighting)
    #         묻혔다. 얹는 것은 «중심»이 아니라 **밑면**을 기준으로 올려야 한다.
    bpy.ops.mesh.primitive_cylinder_add(radius=0.50, depth=0.03, vertices=96,
                                        location=(x, y, 바닥z + 0.07 + 1.02))
    수면 = bpy.context.object; 수면.name = "수면"
    # 🔴 16판 실측(씬 계측): 수면은 제자리였다(z 0.725~0.755 · 컵 상단 0.720) — 안 보인 게 아니라
    #    **너무 밝았다**. 창빛이 위에서 오니 수평면이 가장 많이 받는다: 같은 값도 수직면보다 밝게 뜬다.
    #    ⇒ 밑색을 크게 내리고(0.30→0.09) 곱을 세워(0.92) 어둠에 «닿게» 한다. 거칠기도 낮춘다 —
    #      커피는 빛을 먹지 않고 «비춘다»(수면 하이라이트 하나가 액체의 서명이다).
    수면.data.materials.append(펠트재질("DeepWool", 스케일=5.0, 염색보정=True, 채도=1.1, 밝기=0.09,
                                    결흩기=0.4, 거칠기=0.18,
                                    염색혼합=(0.239, 0.145, 0.086, 0.92)))
    # 손잡이는 «허리»에 단다 — 12판에서 위쪽에 달렸더니 귀처럼 보였다.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.26, minor_radius=0.058,
                                     location=(x + 0.60, y, 바닥z + 0.07 + 0.46),
                                     major_segments=48, minor_segments=16)
    손잡이 = bpy.context.object; 손잡이.name = "컵손잡이"
    손잡이.rotation_euler = (math.radians(90), 0, math.radians(-90))
    bpy.ops.object.shade_smooth()
    손잡이.data.materials.append(도자기)


def 딸기(이름, 위치, 크기=0.28, 돌림=0.0):
    """딸기 — 아래가 뾰족한 원뿔에 서브디비전을 먹여 둥글린다. 꼭지는 초록 잎 셋."""
    x, y, z = 위치
    # 🔴 11판 실측: depth 1.55·subsurf 2 는 «토마토»가 됐다 — 서브디비전 2 가 원뿔을 거의 구로
    #    되돌려 뾰족함이 사라졌다. 딸기의 서명은 «세로로 긴 원뿔»이다: 길이를 키우고 둥글림은 1 로.
    bpy.ops.mesh.primitive_cone_add(radius1=0.10 * 크기 / 0.28, radius2=크기, depth=크기 * 2.15,
                                    vertices=40, location=(x, y, z))
    몸 = bpy.context.object; 몸.name = 이름
    sub = 몸.modifiers.new('둥글', 'SUBSURF'); sub.levels = sub.render_levels = 1
    # 🔴 14판 실측: radius1(아래)을 이미 좁게 만들어 놓고 178° 로 «또» 뒤집어서 뾰족한 쪽이
    #    위로 갔다 — 종·도토리로 읽힌 까닭이다. 세우는 방향은 한 번만 정한다.
    몸.rotation_euler = (0, 0, math.radians(돌림))                   # 넓은 쪽이 위(꼭지 쪽)
    bpy.ops.object.shade_smooth()
    # 🔴 13판: 킷 Coral 은 «주황빛» 코랄이라 초록 꼭지와 만나니 당근으로 읽혔다.
    #    딸기는 붉어야 딸기다 — 채도를 올리고 붉은 쪽으로 곱해 색상을 끌어온다.
    몸.data.materials.append(펠트재질("Coral", 스케일=4.4, 돌림=17.0, 염색보정=True,
                                  채도=1.45, 밝기=0.72, 결흩기=0.5, 거칠기=0.78,
                                  염색혼합=(0.898, 0.216, 0.196, 0.45)))
    잎천 = 펠트재질("MeadowDeep", 스케일=6.0, 염색보정=True, 채도=1.05, 밝기=0.74, 결흩기=0.85)
    for i in range(3):
        a = math.radians(돌림 + 120 * i)
        꼭 = 구(이름 + "꼭지%d" % i, 크기 * 0.30, (x + 크기 * 0.26 * math.cos(a),
                                             y + 크기 * 0.26 * math.sin(a), z + 크기 * 1.02), 세그=32)
        꼭.scale = (1.0, 0.44, 0.12)
        꼭.rotation_euler = (0, math.radians(-14), a)
        꼭.data.materials.append(잎천)


def 로고찡긋플레이팅세우기():
    """«>< 찡긋» 배지 세 알을 **요리 사진**으로 차린다 (유호 지시 08-21 「음식 사진으로 만들어보면」).
    다른 세션의 플레이팅 트랙(유호 승인 08-21 「요리 컨셉 시험 — 맛있고 정성스럽게」 ·
    tools/요소굽기.py 음식접시·귤·도넛)과 **같은 규율**을 따른다:
      「요리는 «재질»이 아니라 «차림새»다 — 재료는 전부 펠트·실(킷 색)이고,
       세계(양모)를 안 깨고 미각 연상만 들인다.」
    그래서 배지 레시피는 한 줄도 안 바꾼다(찡긋배지하나 공유) — 바뀌는 것은 «차림»뿐.
    🔑 찡긋 배지가 이 문법에 맞는 것은 우연이 아니다 — 둥근 쿠션·실땀 테두리·톤온톤 색은
       이미 «마카롱»의 서명이다. 차림새만 주면 아이콘이 디저트가 된다.

    ── 3판 «더 맛있게» (유호 지시 08-21 「접시에 변화를 준다던지 플레이팅을 추가한다던지」) ──
    2판이 덜 맛있던 까닭 넷을 각각 채운다:
      ① 접시가 «원반»이라 그릇이 아니었다      ⇒ 테두리(림)를 올려 담기는 그릇으로
      ② 셋이 다 평평히 누워 «높이»가 없었다     ⇒ 한 알을 다른 알에 걸쳐 포갠다
      ③ 곁들임이 없어 «한 접시»가 아니었다      ⇒ 냅킨·열매·잎 — 주인공 옆의 것들이 맛을 만든다
      ④ «갓 만든» 신호가 없었다               ⇒ 슈가파우더(알 위의 흰 가루)
    ⚠규율은 그대로다 — 곁들임도 전부 펠트·실이고 색은 킷 이름 참조다."""
    손 = random.Random(20260821)

    # ① 식탁보 — 접시 아래 넓은 천. 전 픽셀이 재질이어야 위의 것이 «스티커»로 안 뜬다.
    #   🔴 1판 실측: 반경 7.2 는 내려보기에서 **뒤가 프레임 위로 잘렸다**(멀어질수록 더 넓은 천이
    #      필요하다 — 수평 카메라의 직관이 안 통한다). 화면을 확실히 덮는 24 로 넓힌다.
    #   🔴 1판 실측: 밝기 0.78 은 «회색 시멘트»로 떴다 — 요리 사진의 상은 어둡고 «따뜻»해야
    #      음식이 산다. 밝기를 내리고 Ink(따뜻한 먹) 리니어로 염색한다(무채 타일은 채도로 안 물든다).
    bpy.ops.mesh.primitive_cylinder_add(radius=24.0, depth=0.10, vertices=128, location=(0, 0, -0.40))
    상 = bpy.context.object; 상.name = "식탁보"
    상.data.materials.append(펠트재질("DeepWool", 스케일=4.5, 돌림=21.0, 염색보정=True,
                                   채도=1.0, 밝기=0.40, 결흩기=0.9,
                                   염색혼합=(0.169, 0.133, 0.118, 0.72)))

    # ②-a 냅킨 — 접시 밑에 비스듬히 깐 리넨. 요리 사진에서 «차림»을 만드는 가장 싼 한 겹이다:
    #     접시가 맨 상에 놓이면 «놓았다»이고, 천 위에 놓이면 «차렸다»가 된다.
    #     명도 사다리(상 어둠 → 냅킨 중간 → 접시 밝음 → 알 가장 밝음)의 빠진 칸이기도 하다.
    bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0.24, -0.26, -0.345))
    냅킨 = bpy.context.object; 냅킨.name = "냅킨"
    # 🔴 12판: 3.95×2.98 은 대각선 4.95 라 모서리가 멀리 뻗어 «작업대 매트»로 읽혔다.
    #    냅킨은 접시를 «감싸는» 크기여야 한다 — 정사각에 가깝게 하고 더 비스듬히 눕힌다.
    냅킨.scale = (3.45, 3.30, 0.042)
    냅킨.rotation_euler = (0, 0, math.radians(-21.0))
    모따기(냅킨, 폭=0.13, 단=4)                       # 각진 모서리는 종이다 — 천은 모서리가 둥글게 눕는다
    # 🔴 3판 실측: 눌림 0.022/크기 0.9 는 «A4 용지»로 읽혔다. 천으로 읽히는 것은 두께가 아니라
    #    **잔주름의 빈도**다 — 세기를 두 배, 주름 크기를 절반으로(같은 값이라도 잘면 천이 된다).
    수제눌림(냅킨, 세기=0.055, 크기=0.62, 좌표='GLOBAL')
    # 🔴 3판 실측: 밝기 0.50 이 접시(0.70 Stone)보다 **밝게** 나왔다 — LapisSoft 타일 자체가 밝아
    #    명도 사다리가 뒤집혔다(냅킨은 접시 아래 단이어야 한다). 타일의 밝기까지 계산에 넣는다.
    # 🔴 4판 실측: 청회색(LapisSoft)은 어둡게 해도 «비닐 매트»로 읽혔다 — 요리 사진에서 차가운
    #    중간색은 음식의 온기를 빨아먹는다. 리넨은 따뜻한 쪽에 있어야 한다(Oat 를 그늘로 염색).
    냅킨.data.materials.append(펠트재질("Oat", 스케일=3.0, 돌림=17.0, 염색보정=True,
                                    채도=1.05, 밝기=0.44, 결흩기=0.8,
                                    염색혼합=(0.404, 0.322, 0.263, 0.55)))

    # ②-b 접시 — 바닥판 + **올라온 테두리(림)**. 림 하나가 원반을 그릇으로 바꾼다.
    #   🔴 1판 실측: 밝기 0.94 는 접시가 **화면에서 가장 밝은 것**이 되어 주인공(배지)을 이겼다
    #      — 4계 ② 위반. 접시는 «받치는 것»이라 알들보다 반 단 어두워야 한다.
    # 🔴 7판(유호 08-21 「조금 허전한데」): 반경 3.2 는 알 셋에 비해 빈 자리가 넓었다.
    #    허전함의 절반은 «곁들임 부족»이지만 나머지 절반은 «접시가 큰 것»이다 — 둘 다 손본다.
    bpy.ops.mesh.primitive_cylinder_add(radius=3.2, depth=0.20, vertices=192, location=(0, 0, -0.25))
    접시 = bpy.context.object; 접시.name = "접시"
    모따기(접시, 폭=0.07, 단=4)
    접시천 = 펠트재질("Stone", 스케일=2.2, 돌림=7.0, 염색보정=True, 채도=1.0, 밝기=0.70, 결흩기=0.7)
    접시.data.materials.append(접시천)
    # 림 — 가장자리에 두른 도넛. 접시 윗면(-0.15) 에 반쯤 잠겨 0.11 만큼 솟는다(계산 · 4계 ④).
    bpy.ops.mesh.primitive_torus_add(major_radius=3.16, minor_radius=0.13, location=(0, 0, -0.15),
                                     major_segments=128, minor_segments=20)
    림 = bpy.context.object; 림.name = "접시림"
    림.scale = (1.0, 1.0, 0.62)                      # 3판: 두툼한 림은 그릇이 아니라 쿠션 테두리로 읽혔다
    bpy.ops.object.shade_smooth()
    림.data.materials.append(접시천)                  # 같은 그릇이니 같은 천 — 색이 갈리면 두 물건이 된다

    # ③ 세 알 — 손으로 놓은 자리(정삼각 배치 금지: 계산한 티가 나면 «차림»이 아니라 «도표»다).
    #    접시 윗면 -0.15 = 배지 밑면(두께 0.30 의 절반) — 눈이 아니라 계산으로 앉힌다(4계 ④).
    #    🔑 라피스는 버터 알 **위에 걸친다**(z 0.30 = 버터 윗면 0.15 + 제 두께 절반 0.15):
    #       포개진 한 알이 «쌓을 만큼 있다»를 말한다 — 요리 사진에서 높이는 곧 풍성함이다.
    #       겹침은 0.25 만(중심거리 1.75) — 더 겹치면 아래 알의 «눈»을 가려 얼굴이 죽는다.
    #    🔴 4판 실측: 라피스를 버터 위에 «수평 그대로» 얹으니 공중부양으로 읽혔다
    #       (유호 08-21 「파란색이 공중에 떠있는것같아」). 걸친 물건은 기운다 — 접점 둘로 계산했다:
    #       버터 쪽 끝은 버터 윗면(z 0.15 · 버터중심에서 0.58 이라 «위»)에, 반대쪽 끝은
    #       접시(z -0.15 · 2.58 이라 접시)에 닿는다 ⇒ 기울기 = atan(0.30 / 지름 2.0) = 8.53°,
    #       판 중심 z = 밑면중심 0.0 + 두께절반 0.15. 축은 버터→라피스 방향의 수직.
    #    나머지 둘도 1.6~2.2° 만 기울인다 — 완벽한 수평 셋은 «진열»이지 «차림»이 아니다.
    #    🔴 5판 실측: 기울여도 여전히 «떠» 보였다 — 각도가 틀린 게 아니라 **접점이 안 보였다**.
    #       라피스가 버터의 «뒤»에 걸쳐 있어서 두 알이 맞닿는 자리를 버터가 가렸다.
    #       눈은 계산을 못 보고 접점만 본다 ⇒ 라피스를 버터의 «앞»(카메라 쪽 -y)으로 옮긴다.
    #    🔴 6판 실측: 앞으로 옮기니 이번엔 라피스가 버터의 **눈을 가렸다**. 평면 거리로는
    #       1.14 여서 반경 1.0 을 넘겼는데도 가려진 까닭 = **투영 기어듦**이다:
    #       31° 내려보기에서 높은 물체는 낮은 물체 쪽으로 Δz / tan31° 만큼 다가와 보인다
    #       (라피스 윗면 0.45 vs 버터 눈 0.20 ⇒ 0.416). 평면 여유가 그보다 커야 «안 가림»이다.
    #       ⇒ 겹침을 0.222 로 줄여 여유 0.539 확보(> 0.416 ✓). 배치도 삼각으로 되돌린다
    #         (뒤 둘 · 앞 하나) — 일렬은 「차림」이 아니라 「진열대」다.
    알판들 = []
    #    🔴 17판(유호 「당겨자른판 앵글로 사용하고싶은데 너무 허전해」): 허전함의 진짜 원인은
    #       여백이 아니라 **먹을 것이 죄다 프레임 밖**이었다 — 당김 0.62 의 프레임 반경은 2.48 인데
    #       커피·케이크는 4~5 거리라 이 앵글에 아예 안 잡혔다. ⇒ 케이크와 딸기를 **접시 위로**
    #       올려 «디저트 플레이트» 한 접시로 다시 짠다. 자리는 전부 프레임 반경 안으로 계산했다.
    for 갈래이름, 위치, 롤, 기울 in (
            ("버터",  (-1.45, 0.80,  0.018), -14.0, ((0.62, 0.78, 0.0), 2.2)),
            ("라피스", (-0.62, -0.72, 0.155),   7.0, ((0.8777, 0.4793, 0.0), 8.53)),
            ("팝",    ( 0.85, 1.25,  0.014),   6.0, ((-0.85, 0.53, 0.0), 1.6))):
        알판들.append(찡긋배지하나(쌍꺾쇠변주[갈래이름], 이름앞=갈래이름, 위치=위치, 롤=롤, 기울=기울))

    # ④-a 곁들임 열매 — 접시 여백의 두 알. 「한 접시」로 읽히려면 주인공 말고도 뭔가 놓여야 한다.
    #     색은 Pop Deep(진한 자두) — 알들의 파스텔보다 어두워 신호를 안 뺏고 «과육»으로 읽힌다.
    #   🔴 3판 실측: 열매 둘과 잎이 대각선으로 «일렬»이 되어 애벌레로 읽혔다. 곁들임은 줄이 아니라
    #      **무리**다 — 잎을 먼저 눕히고 그 위에 열매가 기대 앉게 겹쳐야 «놓인 것»이 된다.
    #   🔴 7판: 곁들임이 오른쪽 앞 «한 무리»뿐이라 반대편이 비어 허전했다. 요리 사진의 곁들임은
    #      주인공을 둘러싸야 한다 — 한 무리만 있으면 「놓다 만 자리」로 읽힌다. 두 무리로 나눈다.
    # 🔴 8판: 매끈한 초록은 «젤리»로 읽혔다 — 결을 세게 흩어 펠트 잎으로 되돌린다.
    잎천 = 펠트재질("MeadowDeep", 스케일=5.2, 돌림=5.0, 염색보정=True, 채도=1.05, 밝기=0.76, 결흩기=0.85)
    for i, (x, y, r, 회전) in enumerate((
            (2.25, 0.35, 0.32, (9, -16, -28)),       # 오른쪽 위 — 열매 무리가 이 위에 앉는다
            (-2.15, -1.05, 0.29, (7, 13, 41)))):     # 왼쪽 앞 — 아몬드 무리의 받침
        잎 = 구("곁잎%d" % i, r, (x, y, -0.115), 세그=64)
        잎.scale = (1.0, 0.42, 0.085)
        잎.rotation_euler = tuple(math.radians(v) for v in 회전)
        잎.data.materials.append(잎천)
    # 거칠기 0.72 — 이 장면에서 유일하게 펠트의 «완전 확산»을 벗어나는 한 점이다.
    # 과육의 윤기가 있어야 열매가 «먹는 것»이 된다(4계 ②: 가장 밝은 것 하나 = 그 위의 점광).
    열매천 = 펠트재질("PopDeep", 스케일=3.6, 돌림=11.0, 염색보정=True, 채도=1.15, 밝기=0.82,
                   결흩기=0.5, 거칠기=0.72)
    for i, (x, y, r) in enumerate(((2.25, 0.35, 0.180), (2.50, 0.62, 0.142), (2.08, 0.68, 0.126))):
        열매 = 구("열매%d" % i, r, (x, y, -0.15 + r * 0.90), 세그=64)
        열매.scale = (1.0, 0.94, 0.88)                # 완전 구는 공장 티 — 열매도 눌린다
        열매.rotation_euler = (0.2, 0.3 * i, 0.5 * i)
        열매.data.materials.append(열매천)
    # ④-c 아몬드 — 반대편 무리. 씨앗·견과가 놓여야 «디저트 한 접시»의 재료가 갖춰진다.
    #     거칠기 0.80 = 열매(0.72)보다 무디고 펠트(0.95)보다 매끈 — 껍질의 결이 그 사이에 있다.
    #     🔴 8~9판: 밝기 0.80→0.70·혼합 0.46→0.66 으로도 여전히 «흰 자갈»이었다. 창빛이 센
    #        장면에서 작은 물체는 하이라이트가 지배해 «칠한 색»보다 훨씬 밝게 뜬다 — 무채 타일을
    #        유채로 끌어오려면 곱 비중을 크게(0.85) 밑색을 낮게(0.52) 잡아야 갈색에 «닿는다».
    아몬드천 = 펠트재질("Oat", 스케일=4.2, 돌림=23.0, 염색보정=True, 채도=1.2, 밝기=0.52,
                    결흩기=0.5, 거칠기=0.80, 염색혼합=(0.478, 0.322, 0.196, 0.85))
    for i, (x, y, r, 눕힘) in enumerate((
            (-2.15, -1.05, 0.155, (0.18, 0.10, -0.55)),
            (-1.88, -1.55, 0.140, (0.12, -0.22, 1.05)),
            (-2.42, -1.42, 0.132, (0.22, 0.14, 0.35)))):
        알몬 = 구("아몬드%d" % i, r, (x, y, -0.15 + r * 0.62), 세그=56)
        알몬.scale = (1.0, 0.56, 0.44)               # 눌린 타원 — 아몬드는 구가 아니다(8판: 더 납작하게)
        알몬.rotation_euler = 눕힘
        알몬.data.materials.append(아몬드천)

    # ④-d 한 상 (유호 08-21 「밑에 과일이나 케이크나 음료수같은 플레이팅을 제대로」)
    #     쿠키 접시 하나로는 «접시 사진»이지 «플레이팅»이 아니다. 잔과 케이크가 놓이는 순간
    #     화면은 «누군가의 자리»가 된다 — 그게 요리 사진이 파는 것이다.
    #   🔑 17판 재구성(유호 「당겨자른판 앵글로 사용하고싶은데 너무 허전해」): 허전함의 진짜 원인은
    #      여백이 아니라 **먹을 것이 죄다 프레임 밖**이었다 — 당김 0.62 의 프레임 반경은 2.48 인데
    #      케이크·커피는 4~5 거리라 이 앵글에 아예 안 잡혔다. 주력 앵글에 안 잡히는 소품은
    #      «있어도 없는 것»이다 ⇒ 케이크와 딸기를 **접시 위로** 올려 한 접시에 담는다.
    #      (11판의 작은 케이크 접시는 이 재구성으로 은퇴 — 접시가 둘일 이유가 사라졌다.)
    상면 = -0.35
    접시면 = -0.15                                    # 접시 윗면 — 여기 담기는 것들의 바닥
    케이크조각((1.85, -0.95), 접시면, 돌림=-128.0)
    for i, (x, y, 크기, 돌 ) in enumerate(((0.30, -2.05, 0.30, 24.0),
                                         (1.05, -2.30, 0.26, -52.0))):
        딸기("딸기%d" % i, (x, y, 접시면 + 크기 * 0.62), 크기=크기, 돌림=돌)
    # 커피는 접시 밖에 남는다 — «한 상» 앵글의 몫이고 당김 앵글에서는 프레임 밖으로 빠진다.
    컵세트((-4.15, 1.85), 상면)
    딸기("딸기상", (-3.35, -0.95, 상면 + 0.28 * 0.62), 크기=0.28, 돌림=71.0)

    # ⑤ 실 부스러기 — 도넛 스프링클과 같은 문법(부스러기가 «실»이라는 것이 이 세계의 미각).
    #   🔴 1판 실측: 흰 실땀(Stitch)을 어두운 상 위에 흩으니 «부스러기»가 아니라 **먼지·실밥**으로
    #      읽혔다. 요리 사진의 부스러기는 «음식과 같은 색»이다(설탕가루가 아니라 부서진 그 과자).
    #      ⇒ 색을 알들의 것으로 바꾸고, 상 위로 새는 것은 줄여 접시 둘레에 모은다.
    부스랑 = [펠트재질(**쌍꺾쇠변주[n]["눈"]) for n in ("버터", "라피스", "팝")]
    # 🔴 10판(유호 08-21 「저 스마일 위에 있는게 부스러기였구나 · 스티치랑 똑같이 생겨서 헷갈렸어」):
    #    부스러기와 실땀은 «같은 물건»이다(둘 다 짧은 실 토막) — 형태로는 절대 안 갈린다.
    #    그러니 개수로 가른다: 실땀은 규칙적인 링이고 부스러기는 드물게 흩어진 것이어야 한다.
    #    많으면 «어느 게 바느질이고 어느 게 흘린 것인지» 눈이 못 고른다. ⇒ 대폭 줄인다.
    for i in range(5):
        a = 손.uniform(0, math.tau)
        r = 손.uniform(2.15, 2.74)                   # 림 안쪽 — 그릇이 생겼으니 부스러기도 담긴다
        땀하나("부스러기%d" % i, None, (r * math.cos(a), r * math.sin(a)),
              (math.cos(a + 1.2), math.sin(a + 1.2)), -0.14,
              길이=손.uniform(0.09, 0.15), 굵기=0.013, 솟음=0.010, 잠김=0.0,
              재질=부스랑[i % 3])

    # ⑥ 슈가파우더 — «갓 만든» 신호. 요리 사진에서 가루 한 겹이 하는 일은 색이 아니라 «시간»이다:
    #    방금 뿌렸다는 뜻이라, 그 접시는 기다린 접시가 아니라 지금 나온 접시가 된다.
    #    이 세계의 가루도 실이다 — 아주 짧게 끊은 Paper 실 조각.
    #   🔴 3판 실측: 길이 0.03·굵기 0.0065 는 1400px 에서도 **안 보였다**(서브픽셀은 디노이저가 먹는다).
    #      가루는 «있는 듯 없는 듯»이어야 하지만 «없으면» 아무 일도 안 한다 — 키운다.
    #   🔴 5판: 그런데 길게 키우니 «막대»가 됐다 — 설탕은 알갱이라 짧고 통통해야 한다(길이↓ 굵기↑).
    가루천 = 펠트재질("Paper", 스케일=6.0, 염색보정=True, 채도=0.9, 밝기=1.0, 결흩기=0.4)
    번 = 0
    # 🔴 7판 실측(유호 08-21 「파란 쿠키에 하얀 스티치가 중간에 껴있는데」): 알 위 가루를 **월드
    #    좌표의 평평한 높이**로 뿌렸더니, 기울어진 라피스에서는 낮은 쪽은 뜨고 높은 쪽은 표면을
    #    뚫고 박혀 «잘못 박힌 실땀»으로 보였다. 기운 면에 평평한 높이를 쓰면 반드시 이렇게 된다.
    #    ⇒ 가루를 **알의 자식으로** 붙이고 판-로컬 윗면(0.15)에 얹는다 — 알이 어떻게 기울든
    #      같이 기울어 표면에 정확히 앉는다(링 실땀이 이미 쓰던 방식 그대로다).
    # 🔴 17판(유호 08-21 「찡긋 위에있는 부스러기는 없애줘도 될것같아」): 알 «위»의 가루는
    #    실땀과 같은 물건이라 얼굴 옆에 있으면 반드시 «잘못 박힌 땀»으로 읽힌다. 0 이 정답이다.
    #    가루는 접시에만 남긴다 — 거기서는 실땀 링이 없으니 헷갈릴 상대가 없다.
    for 판 in []:
        for _ in range(0):
            a = 손.uniform(0, math.tau)
            d = 손.uniform(0.18, 0.80)              # 알 윗면 안쪽에만 — 가장자리로 새면 «먼지»다
            땀하나("가루%d" % 번, 판, (d * math.cos(a), d * math.sin(a)),
                  (math.cos(a + 0.8), math.sin(a + 0.8)), 0.156,
                  길이=손.uniform(0.034, 0.058), 굵기=0.0125, 솟음=0.006, 잠김=0.0, 재질=가루천)
            번 += 1
    # 🔴 8판: 접시에 15 알을 흘리니 «채움»이 아니라 «먼지»가 됐다 — 흰 점은 어두운 바탕에서
    #    개수보다 대비가 세다. 채우는 일은 곁들임(무리)이 하고 가루는 «흔적»만 남긴다.
    for _ in range(3):                               # 접시에도 조금 — 뿌리다 흘린 것
        a = 손.uniform(0, math.tau); r = 손.uniform(1.0, 2.72)
        땀하나("가루%d" % 번, None, (r * math.cos(a), r * math.sin(a)),
              (math.cos(a + 0.8), math.sin(a + 0.8)), -0.142,
              길이=손.uniform(0.032, 0.054), 굵기=0.0115, 솟음=0.005, 잠김=0.0, 재질=가루천)
        번 += 1


def 고리가닥(이름, 중심, 반경, 굵기, 위각, 아래각, 진폭, 재질, 마디=384, 흔들폭=34.0, 꼬임=24):
    """«고리» 한 가닥 — 평면 원이 아니라 **z 가 교차점에서만 흔들리는** 닫힌 곡선.
    토러스로는 이 형태를 못 만든다: 토러스는 통째로 한 평면에 있어서 두 링이 «꿰이지» 못하고
    한쪽이 통째로 위에 얹힌다. 실제 사슬·매듭이 그렇듯, 가닥은 상대를 넘는 곳에서 솟고
    빠지는 곳에서 잠긴다 — 그 국소적 오르내림이 «꿰임»의 전부다.
    위각/아래각 = 이 가닥이 솟는(넘는) 각과 잠기는(빠지는) 각. 실측 좌표에서 계산해 넣는다."""
    def 언덕(각차):
        각차 = (각차 + 180.0) % 360.0 - 180.0        # -180~180 으로 접는다
        return math.exp(-(각차 / 흔들폭) ** 2)
    # 🔑 «실»은 한 가닥이 아니라 **두 겹이 꼬인 것**(플라이드 얀)이다 — 매끈한 튜브는 고무로 읽힌다.
    #    중심선을 따라가며 두 겹을 반대 위상으로 감는다: 피치 0.52 는 겹 지름(0.143)의 1.9배로,
    #    실제 실의 비율이다(더 촘촘하면 뭉개지고 성기면 «전선»이 된다).
    #    ⚠꼬임 24회를 곡선으로 표현하려면 마디가 꼬임당 16점은 있어야 한다(384) — 적으면 각진다.
    겹굵기 = 굵기 * 0.52
    오프셋 = 굵기 - 겹굵기
    cu = bpy.data.curves.new(이름, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 겹굵기; cu.bevel_resolution = 5; cu.use_fill_caps = True
    for 겹 in range(2):
        sp = cu.splines.new('NURBS')
        sp.points.add(마디 - 1)
        for i in range(마디):
            도 = 360.0 * i / 마디
            r = math.radians(도)
            z = 진폭 * (언덕(도 - 위각) - 언덕(도 - 아래각))
            φ = math.radians(도 * 꼬임) + 겹 * math.pi        # 두 겹은 반대 위상
            밖 = 오프셋 * math.cos(φ)                          # 링 평면 안쪽 반경 방향
            높 = 오프셋 * math.sin(φ)                          # 링 평면에 수직
            sp.points[i].co = (중심[0] + (반경 + 밖) * math.cos(r),
                               중심[1] + (반경 + 밖) * math.sin(r), z + 높, 1.0)
        sp.use_cyclic_u = True
        sp.order_u = 4
    o = bpy.data.objects.new(이름, cu)
    bpy.context.scene.collection.objects.link(o)
    # 🔴 1판 실측: XY 평면에 지어 놓고 «세우지» 않아 정면 직교 카메라가 링을 옆에서 봤다
    #    — 고리가 «납작한 막대»로 찍혔다. 꺾쇠와 같은 처방이다: 결을 살리려면 XY 에 짓고
    #    (Object 매핑이 (x,y)를 쓴다), 카메라를 향하도록 세운다. 꿰임의 z 흔들림은
    #    세우면 «앞뒤»가 되어 정면에서 그대로 읽힌다.
    o.rotation_euler = (math.radians(90.0), 0, 0)
    if 재질:
        o.data.materials.append(재질)
    return o


def 로고고리세우기():
    """심볼·도장·워터마크 «고리» — 양모 실 두 가닥이 서로를 꿴다 (로고 한 벌 확정 · 유호 08-21).
    로고 다섯 자리 중 유일하게 펠트 실물이 없던 칸이다(벡터 시안만 있었다).
    좌표는 확정 시안(반경 40 · 두께 11 · 중심 ±(24,18))을 1/20 로 옮겼다 — 눈대중 금지.
    교점과 «넘는 각»은 원-원 교차로 계산했다: 교점 (-15.87, 21.17) / (15.87, -21.17) —
    시안의 clip 중심 (-15.9, 21.2) 와 일치한다(같은 그림을 두 방법으로 얻었으니 서로가 검산이다).
      · 잉크 가닥은 78.3° 에서 솟고 -4.5° 에서 잠긴다
      · 코랄 가닥은 175.5° 에서 잠기고 -101.7° 에서 솟는다  ← 서로 반대라야 «꿴다»
    ⚠꺾쇠와 같은 **정면 직교**로 굽는다 — 심볼 자리(도장·워터마크)에 벡터와 겹쳐 앉는 부품이다."""
    # ── 모션 (로고 «모션·영상» 칸 · 유호 08-22) ──────────────────────────────
    #   🔑 공명 기각(08-21)의 교훈: 정지 시안이 좋다고 그 «형태»를 그대로 시간축에 올리면 안 된다.
    #      두 가닥 사인파는 움직이는 순간 벌레가 됐다 — 꿈틀거림은 생물의 문법이지 실의 문법이 아니다.
    #      그래서 이번에는 형태가 아니라 **사건**을 움직인다: 「두 실이 서로를 잡는 순간」.
    #      떨어져 있던 고리 둘이 다가와 겹치고, 겹친 뒤에야 위아래로 엮이며 꿰임이 «성립»한다.
    #      이동과 성립은 벌레의 문법이 아니라 «연결»의 문법이고, 그게 SYNK 라는 이름의 뜻이다.
    #   진행 1.0 = 확정 정지 화면(=정적 렌더판과 같은 그림). 그래서 마지막 컷이 곧 심볼이다.
    def 미끄럼(t):                                    # ease-in-out — 기계적 등속은 «장치»로 보인다
        return t * t * (3.0 - 2.0 * t)
    다가옴 = 미끄럼(min(1.0, 진행 / 0.62))             # 0~0.62 구간에 서로 다가온다
    엮임 = 미끄럼(max(0.0, min(1.0, (진행 - 0.46) / 0.42)))   # 겹치기 시작한 뒤에야 엮인다(살짝 겹침)
    벌어짐 = 1.0 + (1.30 - 1.0) * (1.0 - 다가옴)        # 중심 거리 배수 2.30 → 1.00
    실꼬임 = 0.30 * 엮임                               # 진폭 0 → 0.30: 평면 겹침이 «꿰임»이 되는 순간
    기울 = math.radians(-9.0 * (1.0 - 다가옴))         # 들어오며 살짝 기울었다가 반듯해진다
    # 🔴 2판 실측: 밝기 0.34·혼합 0.78 은 «검정»이 됐다 — Ink 는 검정이 아니라 «따뜻한 먹»이고,
    #    무엇보다 어두우면 **결이 사라진다**(펠트인지 고무인지 구분이 안 된다). 한 단 올린다.
    잉크천 = 펠트재질("DeepWool", 스케일=3.6, 돌림=13.0, 염색보정=True, 채도=1.05, 밝기=0.54,
                   결흩기=0.9, 염색혼합=(0.169, 0.133, 0.118, 0.60))
    # 🔴 2판 실측: 스케일 3.0·결흩기 0.6 에서 코랄 타일의 반복 모티프가 «점»으로 드러났다
    #    (거울 타일 격자 문제의 재발 — 가는 가닥은 면보다 무늬가 더 잘 보인다). 잘게·더 흩는다.
    코랄천 = 펠트재질("Coral", 스케일=4.4, 돌림=9.0, 염색보정=True, 채도=1.2, 밝기=0.86, 결흩기=0.92)
    잉크 = 고리가닥("고리잉크", (-1.20 * 벌어짐, -0.90 * 벌어짐), 2.00, 0.275,
                  위각=78.3, 아래각=-4.5, 진폭=실꼬임, 재질=잉크천)
    코랄 = 고리가닥("고리코랄", (1.20 * 벌어짐, 0.90 * 벌어짐), 2.00, 0.275,
                  위각=-101.7, 아래각=175.5, 진폭=실꼬임, 재질=코랄천)
    if 기울:
        for o, 쪽 in ((잉크, -1), (코랄, +1)):
            o.rotation_euler = (math.radians(90.0), 0, 기울 * 쪽)


세우기표 = {
    "유리구": 유리세우기,
    "레진구": lambda: 레진세우기((0, 0, 0)),
    "원판": 원판세우기,
    "판": 판세우기,
    "칩": 칩세우기,
    # 🪦 **「합주」는 2026-09-07 에 은퇴했다** — 되살리지 않는다.
    #   여기서 굽던 표지 장면은 유리 구·레진 구·펠트 구 셋을 세웠는데, 09-03 확정
    #   「유리·레진 구슬은 나간다」가 부품에는 닿고 이 장면에는 안 닿아 표지에만 구슬이 남아 있었다.
    #   09-07 에 그 자리를 펠트 구슬 셋으로 다시 구웠고(제미나이 4K), 굽는 통로도 그날
    #   제미나이 하나로 고정됐다(블렌더는 «제미나이가 막혔을 때의 대안»으로 내려 뒀다).
    #   ⇒ 이 줄을 남겨 두면 다음 세션이 그 함수를 돌려 구슬이 되돌아온다. 그래서 함수째 걷었다.
    #   지금 표지 장면 = `docs/Loom_자산/구움/합주.avif` · 굽는 일감 = `docs/공방/계획.json`.
    "로고꺾쇠": 로고꺾쇠세우기,
    "로고배지": 로고배지세우기,
    "로고쌍꺾쇠": 로고쌍꺾쇠세우기,
    "로고찡긋플레이팅": 로고찡긋플레이팅세우기,
    "로고고리": 로고고리세우기,
}


def 시퀀스굽기(이름, 만들기):
    """한 실행으로 n 장 — 프레임마다 씬을 다시 세우되 블렌더는 한 번만 띄운다.
    ⚠결층(필름 그레인)은 건너뛴다: 프레임마다 다른 그레인은 «지글거림»으로 보이고,
      같은 그레인은 화면에 붙박인 얼룩으로 보인다. 움직이는 판에서 그레인은 손해다."""
    global 진행
    os.makedirs(OUT, exist_ok=True)
    for f in range(시퀀스):
        진행 = f / max(1, 시퀀스 - 1)
        치우기(); 만들기()
        경로 = os.path.join(OUT, "%s_%03d" % (이름, f))
        scene.render.filepath = 경로
        bpy.ops.render.render(write_still=True)
        print("[loom] 컷 %d/%d 진행 %.3f" % (f + 1, 시퀀스, 진행))
    print("[loom] 시퀀스 %d장:" % 시퀀스, os.path.join(OUT, 이름 + "_000.png"))


def 굽기(이름, 만들기):
    if 시퀀스:
        return 시퀀스굽기(이름, 만들기)
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

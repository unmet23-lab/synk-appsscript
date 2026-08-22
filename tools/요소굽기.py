# 요소굽기 — UI·UX 요소를 «실물»로 굽는다 (조항 ⓘ 집행급 · 유호 확정 08-19 「짧은 퍼」)
# 퍼프로브.py 의 승격판. 형태별로 몸을 짓고 짧은 퍼를 심어 Cycles 로 찍는다.
#   python3 -c "import sys; sys.argv=['x','--','형태=오브','색=Coral','샘플=96','너비=900','출력=/tmp/판.png']; exec(open('tools/요소굽기.py').read())"
# 형태: 오브 · 알약 · 아이콘 · 스티치 · 털실진행바(진행=0~1) · 단추토글 · 밑그림 · 페이지점 · 폼폼 · 시침핀 · 와펜 · 블랭킷 · 실패스피너 · 직조라벨
#      · 패턴지판 · 다린천판 · 유리판 · 단춧구멍필드 · 스냅 · 조각보타일 · 매듭 · 앱판(재질=패턴지|유리|다린천)
#      · 자수글자 · 레터프레스(등힘=90) · 라벨태그(등힘=80)
#      · 기호(기호=체크|별|하트|집|책|차트|사람|말풍선) · 도장(본문=참) · 게이지고리(진행=0~1)
#      · 슬라이더(진행=0~1) · 스테퍼(수량=4) · 토스트 · 모달 · 탭전환 · 읽음표시
#      · 귤 · 도넛 · 넘버쿠키(본문=01) · 만두 · 김밥 · 붕어빵  ← 플레이팅 갈래
# 규율: 염료는 토큰 킷 「이름」 참조(hex 하드코딩 금지) · **본문** 글자는 굽지 않는다(타이포 불가침 — HTML 층 몫)
#      — 오브제 글자(고정 라벨 · 화면당 한 점)는 별도 항이다(글자공방 채택 08-20 · 옛 「글자는 굽지 않는다」는 본문 한정을 떨어뜨린 과대 일반화)
# 2027 킷 배선(08-20): 실땀=Stitch · 무채=양모 회색(Oat·Stone·Ash Wool·Deep Wool) — 퇴역 대기 12색 사용 0
# 조명: 원본(기본) · 결광2(자수 글자) · 스침(압인·라벨) — 인자 「조명=」로 덮어쓴다 · 글자 보조광 힘은 「등힘=」
# ⚠룸굽기.js 합류 전의 독립 통로다 — 룸굽기는 blender.exe(윈도)를 부르고 이건 bpy 모듈(클라우드)로 돈다.
import bpy, json, math, os, sys, random

인자 = {k: v for k, v in (a.split('=', 1) for a in sys.argv[sys.argv.index('--') + 1:])} if '--' in sys.argv else {}

def 토큰찾기():
    """정본 토큰의 자리 — 클라우드(bpy 모듈)와 노트북(blender.exe)이 같은 스크립트를 쓴다.
    순서: 인자 「토큰=」 > 클라우드 정본 경로 > 현재 폴더에서 위로 올라가며 docs/디자인_토큰.json."""
    if 인자.get('토큰'):
        return 인자['토큰']
    클라우드 = '/home/user/synk-appsscript/docs/디자인_토큰.json'
    if os.path.exists(클라우드):
        return 클라우드
    d = os.path.abspath(os.getcwd())
    while True:
        p = os.path.join(d, 'docs', '디자인_토큰.json')
        if os.path.exists(p):
            return p
        위 = os.path.dirname(d)
        if 위 == d:
            raise SystemExit('디자인_토큰.json 을 못 찾았다 — 「토큰=경로」 로 준다')
        d = 위

토큰길 = 토큰찾기()
색 = {c['이름']: c['hex'] for c in json.load(open(토큰길, encoding='utf-8'))['색']['킷']}

def 리니어(hex_):
    h = hex_.lstrip('#')
    def ch(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return tuple(ch(int(h[i:i+2], 16)) for i in (0, 2, 4)) + (1.0,)

형태 = 인자.get('형태', '오브')
염료이름 = 인자.get('색', 'Coral')
출력 = 인자.get('출력', '/tmp/요소.png')
견본 = int(인자.get('샘플', '96'))
너비 = int(인자.get('너비', '900'))
# 「투명=1」 — 판(밤천)을 걷고 **알파 두 층(몸+접지)** 으로 뽑는다. 지면·앱에 꽂을 «부품» 통로다.
#   왜 두 층인가(룸장면 §3-4 의 배움): 그림자가 몸에 구워져 있으면 배경이 바뀔 때마다 다시 구워야
#   한다. 가르면 지면이 접지를 따로 얹어 **배경마다 다시 안 굽는다.**
#   판은 사라지는 게 아니라 «그림자 받이»가 된다 — 접지가 실제 판 위에 진 그림자라야 맞는다.
투명 = 인자.get('투명', '') in ('1', '켬', 'on')

bpy.ops.wm.read_factory_settings(use_empty=True)
씬 = bpy.context.scene

# ── 재료 공방 ────────────────────────────────────────────────────────────────
def 살재질(이름, hex_):
    m = bpy.data.materials.new('살_' + 이름)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    기본 = 리니어(hex_)
    p.inputs['Base Color'].default_value = tuple(v * 0.55 for v in 기본[:3]) + (1.0,)
    p.inputs['Roughness'].default_value = 1.0
    return m

def 털재질(이름, hex_):
    기본 = 리니어(hex_)
    m = bpy.data.materials.new('털_' + 이름)
    m.use_nodes = True
    tp = m.node_tree.nodes['Principled BSDF']
    tp.inputs['Roughness'].default_value = 0.62
    정보 = m.node_tree.nodes.new('ShaderNodeHairInfo')
    램프 = m.node_tree.nodes.new('ShaderNodeValToRGB')
    램프.color_ramp.elements[0].color = tuple(v * 0.72 for v in 기본[:3]) + (1.0,)
    램프.color_ramp.elements[1].color = tuple(min(1.0, v * 1.18) for v in 기본[:3]) + (1.0,)
    m.node_tree.links.new(정보.outputs['Intercept'], 램프.inputs['Fac'])
    m.node_tree.links.new(램프.outputs['Color'], tp.inputs['Base Color'])
    return m

def 베개몸(크기, 위치=(0, 0, 0), 회전z=0.0, 크리스=0.62, 레벨=3):
    bpy.ops.mesh.primitive_cube_add(size=2, location=위치)
    몸 = bpy.context.object
    몸.scale = 크기
    몸.rotation_euler = (0, 0, math.radians(회전z))
    sub = 몸.modifiers.new('sub', 'SUBSURF')     # 큐브+서브서프+크리스 = 연속 곡률 스쿼클
    sub.levels = sub.render_levels = 레벨
    층 = 몸.data.edge_creases_ensure()
    for d in 층.data:
        d.value = 크리스
    bpy.ops.object.shade_smooth()
    return 몸

def 짧은퍼(몸, 털이름, 살, 털, 길이=0.10, 개수=16000):
    """유호 확정 08-19 «짧은 퍼» — 깨끗함과 부피를 함께 내는 길이. 긴 갈기는 요소용이 아니다."""
    몸.data.materials.append(살)
    bpy.context.view_layer.objects.active = 몸
    bpy.ops.object.particle_system_add()
    ps = 몸.particle_systems[-1].settings
    ps.type = 'HAIR'
    ps.count = 개수
    ps.hair_length = 길이
    ps.hair_step = 5
    ps.child_type = 'INTERPOLATED'
    ps.rendered_child_count = ps.child_percent = 70
    ps.clump_factor = 0.28
    ps.roughness_1 = 0.06
    ps.roughness_2 = 0.08
    ps.roughness_endpoint = 0.03
    ps.factor_random = 0.06
    ps.length_random = 0.12
    ps.use_hair_bspline = True
    ps.render_step = 4
    ps.root_radius = 0.011
    ps.tip_radius = 0.0015
    몸.data.materials.append(털)
    ps.material = len(몸.data.materials)

# ── 형태들 ──────────────────────────────────────────────────────────────────
def 오브():
    """오브 명품판 (08-21 · 유호 교정 「아직 퀄리티가 많이 떨어져 — 명품화」 · 조율 6회전).

    1판(가로 눌림·클로즈업·받침 없음)이 «털 텍스처»로 찍힌 뒤 회전마다 렌더로 실측해 세웠다:
    ①정사각 — 지면 `.오브`(112px 정사각)와 같은 물건으로 읽히게.
    ②구도 — 카메라 12.6·판 폭은 눈이 아니라 화각 계산(85mm·23.9° → 보이는 폭 4.95 의 90%).
    ③받침 = 직물결 천 판 — 물건은 «놓여야» 부피가 생긴다. 매끈 회색판은 «접시»로 읽혔다.
      🔑 **염료 명도가 받침을 고른다**(4계 ① 대비는 재료가 낸다): 밝은 염료 → 밤천(Ink) ·
      어두운 염료(선형 휘도 Y<0.09) → 다린천(Oat). 한 받침에 26색을 다 올리면 절반이 먹힌다.
    ④테두리 = Stitch 실땀 한 바퀴 — **DESIGN.md 운용 규칙 ② 「실땀은 모든 펠트 오브젝트의
      테두리」.** 킷 정본이 이미 요구하던 서명이 여태 빠져 있었다 — 이것이 «사람이 만든 것»을 가른다.
      땀은 자수글자와 같은 손 지터(각 ±7°·길이 ±10% · 고정 씨앗 — 같은 판이 다시 나온다).
    ⑤조명 — 기본은 원본이되 굽기 통로(오브굽기.js)가 결광2 를 넘긴다(자수 글자 채택 조명).
    """
    기본 = 리니어(색[염료이름])
    휘도 = 0.2126 * 기본[0] + 0.7152 * 기본[1] + 0.0722 * 기본[2]
    받침색, 받침이름 = (('Oat', '다린천') if 휘도 < 0.09 else ('Ink', '밤천'))
    판 = 베개몸((2.23, 0.14, 1.72), 위치=(0, 0.95, 0), 크리스=0.34, 레벨=3)
    판.data.materials.append(직물결(매끈재질(받침이름, 색[받침색], 거칠기=0.96), 지름=4.46))

    몸 = 베개몸((0.82, 0.5, 0.82), 위치=(0, 0, 0.06))
    짧은퍼(몸, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]),
          길이=0.085, 개수=22000)
    ps = 몸.particle_systems[-1].settings
    ps.clump_factor = 0.34          # 니들펠트의 «정돈된» 결 — 성기면 스펀지로 읽힌다(1판 실측)
    ps.roughness_1 = 0.04
    ps.roughness_2 = 0.05

    # 실땀 테두리 — 앞면(-y) 가장자리의 초타원 경로. 자수글자·와펜과 같은 실(Stitch).
    실재 = 매끈재질('실', 색['Stitch'], 거칠기=0.5)
    손 = random.Random(20260821)                    # 고정 씨앗 — 재현 가능
    # ⚠러닝 스티치는 «점선»이다 — 첫 판(22땀·길이 0.115)은 땀끼리 이어붙어 실선 테두리로
    #   읽혔고, 털(y=-0.52)에 묻혀 몇 땀은 사라졌다(렌더 실측). 땀:빈틈 ≈ 1:1.5 로 벌린다.
    n, 반폭, 지수 = 16, 0.64, 4.0                   # 반폭·지수는 렌더 실측으로 맞춘 값(스쿼클 실루엣 안쪽)
    for i in range(n):
        t = 2 * math.pi * i / n
        ct, st = math.cos(t), math.sin(t)
        x = 반폭 * math.copysign(abs(ct) ** (2 / 지수), ct)
        z = 반폭 * math.copysign(abs(st) ** (2 / 지수), st) + 0.06
        # 접선 각 — 초타원 미분. 극점(분모 0)은 축 방향으로 접는다.
        dx = -반폭 * (2 / 지수) * (abs(ct) ** (2 / 지수 - 1)) * st if abs(ct) > 1e-4 else -math.copysign(1, st)
        dz = 반폭 * (2 / 지수) * (abs(st) ** (2 / 지수 - 1)) * ct if abs(st) > 1e-4 else math.copysign(1, ct)
        각 = math.degrees(math.atan2(dz, dx)) + 손.uniform(-7, 7)
        땀하나(x, -0.575, z, 0.085 * (1 + 손.uniform(-0.1, 0.1)), 0.021, 실재, 회전y=-각)
    return (0, -12.6, 1.32), 84

def 알약():
    몸 = 베개몸((2.0, 0.5, 0.66), 크리스=0.58)
    짧은퍼(몸, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]))
    return (0, -11.8, 0.0), 90   # 본굽기 2판 실측: 86° 내려봄이 위 치우침의 원인 — 알약은 수평이 맞다

def 아이콘():
    """참조 ② 문법 — 겹친 두 스쿼클. 뒤판은 무채(Deep Wool — 따뜻한 심회색 털 · 2027 킷),
    앞판이 기본색. 겹침의 그림자·빛이 «실물»의 깊이를 낸다."""
    뒤 = 베개몸((1.04, 0.5, 1.04), 위치=(0.52, 0.62, 0.56), 회전z=-8)
    짧은퍼(뒤, 'Deep Wool', 살재질('Deep Wool', 색['Deep Wool']), 털재질('Deep Wool', 색['Deep Wool']))
    앞 = 베개몸((1.0, 0.5, 1.0), 위치=(-0.16, 0, -0.18), 회전z=3)
    짧은퍼(앞, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]))
    return (0.16, -8.8, 0.3), 86

def 스티치():
    """자수(러닝 스티치) 실금 시안 — 코랄 펠트 띠 위에 분필색(Chalk) 땀이 지나간다.
    구분선·테두리·뱃지의 «실» 후보를 그림으로 낸다(아이디어 층 · 확정 아님)."""
    띠 = 베개몸((2.4, 0.35, 0.42), 크리스=0.7)
    짧은퍼(띠, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]), 길이=0.05, 개수=22000)
    실 = bpy.data.materials.new('실')
    실.use_nodes = True
    p = 실.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = 리니어(색['Stitch'])
    p.inputs['Roughness'].default_value = 0.38
    for i in range(9):                       # 러닝 스티치 — 땀은 천을 «파고들되» 한 줄로 고르게 간다
        x = -1.92 + i * 0.48                 # (기울기를 번갈면 흩뿌린 지그재그로 읽힌다 — 시안2 실측)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(x, -0.335, 0))
        땀 = bpy.context.object
        땀.scale = (0.2, 0.032, 0.032)
        땀.rotation_euler = (0, math.radians(11), 0)
        bpy.ops.object.shade_smooth()
        땀.data.materials.append(실)
    return (0, -6.4, 0.2), 86

def 털실진행바():
    """털실 진행바 — 「실이 감긴다」(재질가족 제안 #1 · 유호 픽 08-19 실물화).
    어두운 무채 펠트 홈 트랙 위에 코랄 털실(3가닥 꼬임 로프)이 진행분만큼 놓인다.
    진행 인자(0~1): 진행=0.62 — 감아온 길이가 곧 진행률이다."""
    진행 = min(1.0, max(0.05, float(인자.get('진행', '0.62'))))
    트랙 = 베개몸((2.5, 0.28, 0.3), 크리스=0.7)
    짧은퍼(트랙, 'Deep Wool', 살재질('Deep Wool', 색['Deep Wool']),
          털재질('Deep Wool', 색['Deep Wool']), 길이=0.04, 개수=15000)
    실몸 = bpy.data.materials.new('실몸')
    실몸.use_nodes = True
    p = 실몸.node_tree.nodes['Principled BSDF']
    기본 = 리니어(색[염료이름])
    p.inputs['Base Color'].default_value = tuple(v * 0.82 for v in 기본[:3]) + (1.0,)
    p.inputs['Roughness'].default_value = 0.85
    시작, 끝 = -2.5, -2.5 + 5.0 * 진행
    N = 160
    for st in range(3):                       # 3가닥 꼬임 — 나선 위상 120°씩
        curve = bpy.data.curves.new('가닥%d' % st, 'CURVE')
        curve.dimensions = '3D'
        curve.bevel_depth = 0.062
        curve.bevel_resolution = 6
        curve.use_fill_caps = True
        sp = curve.splines.new('POLY')
        sp.points.add(N - 1)
        for i in range(N):
            x = 시작 + (끝 - 시작) * i / (N - 1)
            θ = 2 * math.pi * (x / 0.62) + st * 2 * math.pi / 3
            sp.points[i].co = (x, -0.30 - 0.075 * math.cos(θ), 0.075 * math.sin(θ), 1)
        obj = bpy.data.objects.new('가닥%d' % st, curve)
        bpy.context.collection.objects.link(obj)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')   # 곡선엔 털이 안 심겨 — 메쉬로 바꿔 보풀을 심는다
        가닥 = bpy.context.object
        bpy.ops.object.shade_smooth()
        짧은퍼(가닥, 염료이름, 실몸, 털재질(염료이름, 색[염료이름]), 길이=0.03, 개수=3500)
    return (0, -11.8, 0.0), 90

def 매끈재질(이름, hex_, 거칠기=0.5, 배율=1.0):
    m = bpy.data.materials.new('매끈_' + 이름)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    기본 = 리니어(hex_)
    p.inputs['Base Color'].default_value = tuple(min(1.0, v * 배율) for v in 기본[:3]) + (1.0,)
    p.inputs['Roughness'].default_value = 거칠기
    return m

def 직물결(m, 규모=200.0, 세기=0.9, 지름=None, 촘촘=58.0, 깊이=1.0):
    """민무늬 살 위에 «천의 결» — 매끈 슬라브는 도자기로 읽힌다(시안2027 실측).
    펠트·다린 천은 부직포라 짜임이 아니라 «알갱이 결»이 맞다 — 노이즈 범프.

    🔴 **실측 08-22 — 이 함수는 여태 아무 일도 안 하고 있었다.** 까닭이 둘이고, 둘 다 필요하다.

       ① **범프 노드의 「Distance」 기본값이 1.0 이 아니라 0.001 이다**(블렌더 5.2 실측).
          이 함수는 그 입력을 한 번도 안 건드렸으니, 세기를 1.0 으로 올려도 결이 1000분의 1로
          눌려 아무것도 안 나왔다 — 세기만 만지며 여섯 판을 헤맨 진짜 까닭이 이것이다.
          같은 판·같은 노드 그래프에서 Distance 0.001 → σ 2.99 · Distance 1.0 → σ 19.68.
          (몸 종류는 무관했다: 평면 σ 19.68 · 베개몸 σ 20.58 — 서브서프를 의심했던 것은 헛짚음이다.)
       ② Distance 를 세워도 **세기 0.05(옛 기본값)는 여전히 아무 일도 안 한다** — 민 판과 σ 가 같다.
          호출 자리 28곳이 전부 0.03~0.12 였으니 이 저장소의 «미세 결»은 두 겹으로 죽어 있었다.
       쓸모 있는 세기 구간은 0.7~1.0 이다(Distance 1.0 에서 · 민 판 대비 σ 배수):
         0.05→×1.0(없음) · 0.30→×1.2 · 0.45→×2.0 · 0.70→×2.7 · 1.0/규모90→×5.7 · 1.0/규모40→×7.5
       곁들여 결은 면을 **어둡게** 한다(평균 214→173) — 포화해 하얗게 뜨던 밝은 천이 같이 풀린다.
       Distance 는 1.0 위로는 곧 포화한다(1.0 vs 4.0 에서 σ 9.57 vs 9.86) — 0 에서 1 로 세우는 것이 전부다.

    🔴 **규모는 세계 단위가 아니라 «물체 바운딩 박스» 기준이다**(노이즈가 Generated 좌표를 쓴다).
       같은 규모라도 물체가 작으면 결이 촘촘해진다 — 판마다 손으로 맞추면 결의 «굵기»가 갈린다.
       ⇒ **「지름=」에 물체의 세계 폭을 주면 «세계 단위당 결 수(촘촘)»로 환산한다.**
         채택값 촘촘 58 = 폭 2.4 판에서 규모 140 일 때의 그 결(펠트·다린 천).
         큰 물체는 규모가 커져 앨리어싱이 나므로 1000 에서 자른다(식탁보처럼 화면 끝에 있는 것들).
       ⚠한때 «규모가 크면 면이 새까맣게 뒤집힌다»고 여기에 적었으나 **그것은 오진이었다** —
         김밥의 (0,0,0) 화소는 밥·속이 속 꽉 찬 김 원기둥 «안»에 파묻혀 생긴 겹침이었다.
         게다가 그때는 Distance 0.001 이라 범프가 애초에 아무 일도 안 하고 있었다.
    """
    if 지름:
        규모 = min(2400.0, min(240.0, 촘촘) * float(지름))   # 상한을 낮게 잡으면 큰 물체(상)만 결이 굵어져 갈린다
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 규모
    noise.inputs['Detail'].default_value = 6.0
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 세기
    bump.inputs['Distance'].default_value = 깊이   # 🔑 기본값 0.001 — 안 세우면 결이 통째로 죽는다
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    return m

def 분필재질(이름, hex_):
    """무광 분필 가루 — 하이라이트가 서면 분필이 아니라 실로 읽힌다(유호 지시 08-20 무광화).
    거칠기 1.0 + 스펙큘러 0: 빛을 먹기만 하는 면 — 펠트 헌법 「빛을 먹는다」의 가루판."""
    m = bpy.data.materials.new('분필_' + 이름)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = 리니어(hex_)
    p.inputs['Roughness'].default_value = 1.0
    if 'Specular IOR Level' in p.inputs:
        p.inputs['Specular IOR Level'].default_value = 0.0
    return m

def 땀하나(x, y, z, 길이, 굵기, 재질, 회전y=11, 회전z=0, 납작=False):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(x, y, z))
    땀 = bpy.context.object
    땀.scale = (길이, 0.006 if 납작 else 굵기, 굵기)   # 납작 = 분필 «가루선»(밑그림 ①단계 — 실이 아니다)
    땀.rotation_euler = (0, math.radians(회전y), math.radians(회전z))
    bpy.ops.object.shade_smooth()
    땀.data.materials.append(재질)
    return 땀

시접 = 0.05   # 실땀이 천 가장자리에서 물러나 앉는 거리(월드).
              # 2차의 0.13 은 실땀선 밖에 화면 50px 짜리 «맨 천»을 남겼다 — 판이 스티치보다 한참 커
              # 뭉툭해 보인 진짜 까닭이다(유호 08-21). 실땀 자리는 그대로 두고 **몸을 줄여** 0.05 로.
              # 몸 = 실땀 + 시접이라, 이 상수 하나가 카드·라벨의 «맨 테두리 두께»를 정한다.

def 상자(o):
    """몸의 월드 상자 — 서브서프 «수축»은 없다(실측 08-21: 크리스 0.34·0.62·0.80 전부 반폭 1.2500
    · 굳혀도 같음). 크리스는 모서리만 말지 최대 폭은 scale 그대로다. 그래서 큐브 8꼭짓점이 곧 답."""
    꼭 = [o.matrix_world @ v.co for v in o.data.vertices]
    return 꼭

def 둥근사각걷기(반폭, 반높, 라운드, 간격):
    """둥근 사각 둘레를 «한 줄로» 균일하게 걷는다 → [(x, z, 진행각도°), ...].
    3차 명품화(유호 08-21 「테두리가 너무 뚝뚝 끊겨보여」)의 진범이 여기 있었다:
      2차까지 실땀은 **네 직선 변을 따로** 돌았다. 몸의 모서리는 서브서프로 둥근데 실땀 경로만
      각져서, ①모서리마다 땀이 몸 밖으로 벗어나고 ②변마다 `max(3, 길이/간격)` 이 따로 반올림돼
      짧은 변은 **3~4땀**밖에 안 놓였다(라벨 가로 4땀 — 그래서 점선이 뚝뚝 끊겼다).
    한 줄로 걸으면 모서리가 이어지고 간격이 전 둘레에서 같아진다 — 손바느질의 서명은 «균일한 밀도»다."""
    r = max(0.0, min(라운드, 반폭, 반높))
    가로, 세로 = (반폭 - r) * 2, (반높 - r) * 2
    호 = math.pi * r / 2
    구간 = [('직', 가로, 0.0), ('호', 호, 0.0), ('직', 세로, -90.0), ('호', 호, -90.0),
           ('직', 가로, 180.0), ('호', 호, 180.0), ('직', 세로, 90.0), ('호', 호, 90.0)]
    총 = sum(길 for _, 길, _ in 구간)
    n = max(8, int(round(총 / 간격)))
    걸음 = 총 / n
    # 구간 시작점(위변 왼끝에서 시계방향: 위 → 오른 → 아래 → 왼)
    꼭 = [(-(반폭 - r), 반높), (반폭 - r, 반높), (반폭, 반높 - r), (반폭, -(반높 - r)),
         (반폭 - r, -반높), (-(반폭 - r), -반높), (-반폭, -(반높 - r)), (-반폭, 반높 - r)]
    중심 = [(반폭 - r, 반높 - r), (반폭 - r, -(반높 - r)), (-(반폭 - r), -(반높 - r)), (-(반폭 - r), 반높 - r)]
    점 = []
    for i in range(n):
        t = (i + 0.5) * 걸음
        for k, (종, 길, 각) in enumerate(구간):
            if t > 길 and k < len(구간) - 1:
                t -= 길
                continue
            if 종 == '직':
                sx, sz = 꼭[k]
                ex, ez = 꼭[(k + 1) % 8]
                u = min(1.0, t / 길) if 길 > 0 else 0.0
                점.append((sx + (ex - sx) * u, sz + (ez - sz) * u, 각))
            else:
                cx, cz = 중심[k // 2]
                u = min(1.0, t / 길) if 길 > 0 else 0.0
                시작각 = 90.0 - 90.0 * (k // 2)          # 오른위 90→0 · 오른아래 0→-90 · …
                a = math.radians(시작각 - 90.0 * u)
                점.append((cx + r * math.cos(a), cz + r * math.sin(a), 각 - 90.0 * u))
            break
    return 점

def 러닝스티치(자리들, 깊이, 중심xz, 재질, 땀, 굵기, 손, 흔들=0.004, 각흔들=5.0, 기울fn=None):
    """걸은 자리에 땀을 하나씩 놓는다 — 손 지터는 남기되(사람 손) 밀도는 고르게(솜씨).
    ⚠각흔들이 크면 땀이 «제각각 누운 조각»으로 읽힌다(2차 ±7°: 좌우 변 땀이 사선으로 누워
      끊긴 인상의 절반을 만들었다). 손의 흔적은 ±4° 안쪽에서 충분하다."""
    cx, cz = 중심xz
    for (x, z, 각) in 자리들:
        px, pz = (x + 손.uniform(-흔들, 흔들), z + 손.uniform(-흔들, 흔들))
        더 = 0.0
        if 기울fn:
            px, pz, 더 = 기울fn(px, pz)
        땀하나(cx + px, 깊이, cz + pz, 땀 * 손.uniform(0.92, 1.08), 굵기, 재질,
              회전y=-(각 + 더) + 손.uniform(-각흔들, 각흔들))


def 단추토글():
    """꿰맨 단추 토글 — 켬 = 실이 X 로 꿰매짐 / 끔 = 빈 구멍(제안 #2 실물화 · 유호 픽 08-19).
    두 단추의 몸은 같고 «실»만 다르다 — 상태가 재질 차이가 아니라 바느질 유무로 읽힌다.
    켬의 실 = 기본색(신호 1점 — 켜짐이 곧 신호다)."""
    몸재 = 매끈재질('단추', 색['Stone'], 거칠기=0.55)
    구멍재 = 매끈재질('구멍', 색['Deep Wool'], 거칠기=0.9)
    실재 = 매끈재질('실', 색[염료이름], 거칠기=0.42)
    def 단추(cx, 꿰맴):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.85, depth=0.3, location=(cx, 0, 0),
                                            rotation=(math.radians(90), 0, 0))
        몸 = bpy.context.object
        bev = 몸.modifiers.new('bev', 'BEVEL')
        bev.width = 0.11
        bev.segments = 8
        bpy.ops.object.shade_smooth()
        몸.data.materials.append(몸재)
        for dx, dz in ((-0.28, 0.28), (0.28, 0.28), (-0.28, -0.28), (0.28, -0.28)):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.085, depth=0.06,
                location=(cx + dx, -0.14, dz), rotation=(math.radians(90), 0, 0))
            구멍 = bpy.context.object
            bpy.ops.object.shade_smooth()
            구멍.data.materials.append(구멍재)
        if 꿰맴:   # X 자 실 — 구멍 네 개를 대각으로 잇는다
            for (x1, z1, x2, z2) in ((-0.28, 0.28, 0.28, -0.28), (-0.28, -0.28, 0.28, 0.28)):
                길이 = math.hypot(x2 - x1, z2 - z1) / 2
                각 = math.degrees(math.atan2(z2 - z1, x2 - x1))
                땀하나(cx + (x1 + x2) / 2, -0.19, (z1 + z2) / 2, 길이, 0.068, 실재,
                      회전y=-각, 회전z=0)
    단추(-1.15, True)
    단추(1.15, False)
    return (0, -8.0, 0.0), 90

def 밑그림():
    """밑그림 점선 — 스켈레톤 로딩(제안 #7 실물화): 「아직 안 꿰맨 자수 도안」.
    어두운 펠트 판 위에 분필 점선이 앞으로 생길 카드의 윤곽과 글줄 자리를 긋는다."""
    판 = 베개몸((1.9, 0.3, 1.25), 크리스=0.66)
    짧은퍼(판, 'Deep Wool', 살재질('Deep Wool', 색['Deep Wool']),
          털재질('Deep Wool', 색['Deep Wool']), 길이=0.05, 개수=18000)
    분필 = 분필재질('분필', 색['Stitch'])   # 무광 가루 — 광택이 서면 ③꿰맴(실)과 안 갈린다
    앞 = -0.33
    w, h, r = 1.15, 0.62, 0.26          # 카드 윤곽 — 둥근 사각 경로를 따라 점선을 놓는다
    경로 = []
    for (sx, sz, ex, ez) in ((-w + r, h, w - r, h), (w, h - r, w, -h + r),
                             (w - r, -h, -w + r, -h), (-w, -h + r, -w, h - r)):
        길이 = math.hypot(ex - sx, ez - sz)
        n = max(2, int(길이 / 0.3))
        for i in range(n):
            t = (i + 0.5) / n
            경로.append((sx + (ex - sx) * t, sz + (ez - sz) * t,
                        math.degrees(math.atan2(ez - sz, ex - sx))))
    for (cx, cz, 각) in ((-w + r, h - r, None), (w - r, h - r, None),
                         (w - r, -h + r, None), (-w + r, -h + r, None)):
        중심각 = math.degrees(math.atan2(cz, cx))
        for d in (-22, 22):
            a = math.radians(중심각 + d)
            경로.append((cx + r * math.cos(a) * 1.0, cz + r * math.sin(a) * 1.0, 중심각 + d + 90))
    for (x, z, 각) in 경로:
        땀하나(x, 앞, z, 0.085, 0.03, 분필, 회전y=-각, 납작=True)
    for (z, 폭) in ((0.16, 0.78), (-0.12, 0.55)):   # 글줄 자리 두 줄
        n = max(2, int(폭 * 2 / 0.26))
        for i in range(n):
            x = -폭 + (2 * 폭) * (i + 0.5) / n
            땀하나(x, 앞, z, 0.075, 0.028, 분필, 회전y=0, 납작=True)
    return (0, -7.8, 0.05), 88

def 페이지점():
    """바늘땀 페이지 점 — 페이지네이션(제안 #9 실물화): 지나온 쪽 = 꿰맨 땀(분필) ·
    지금 = 기본색 땀(신호 1점) · 남은 쪽 = 빈 바늘구멍 두 점(꿰맬 자리)."""
    띠 = 베개몸((2.2, 0.3, 0.42), 크리스=0.7)
    짧은퍼(띠, 'Deep Wool', 살재질('Deep Wool', 색['Deep Wool']),
          털재질('Deep Wool', 색['Deep Wool']), 길이=0.045, 개수=16000)
    분필 = 매끈재질('분필', 색['Stitch'], 거칠기=0.5)
    실재 = 매끈재질('실', 색[염료이름], 거칠기=0.42)
    구멍재 = 매끈재질('구멍', 색['Deep Wool'], 거칠기=0.95)
    앞 = -0.315
    for k, x in enumerate((-1.6, -0.8, 0.0, 0.8, 1.6)):
        if k < 2:
            땀하나(x, 앞, 0, 0.2, 0.032, 분필)
        elif k == 2:
            땀하나(x, 앞 - 0.01, 0, 0.24, 0.042, 실재)
        else:
            for dx in (-0.09, 0.09):    # 빈 바늘구멍 — 땀 길이와 같은 간격의 두 점
                bpy.ops.mesh.primitive_uv_sphere_add(radius=0.032, location=(x + dx, 앞 + 0.015, 0))
                구멍 = bpy.context.object
                구멍.scale = (1, 0.5, 1)
                bpy.ops.object.shade_smooth()
                구멍.data.materials.append(구멍재)
    return (0, -10.8, 0.0), 90

def 폼폼():
    """폼폼(털실 방울) — 알림 점·뱃지 카운터·불릿 상급판·슬라이더 손잡이(제안 #5 · 채택 08-19).
    공 하나에서 보풀이 사방으로 뻗는다 — 3px 코랄 점의 실물화."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.95)
    몸 = bpy.context.object
    bpy.ops.object.shade_smooth()
    짧은퍼(몸, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]),
          길이=0.32, 개수=9000)   # 방울은 요소 중 유일하게 «긴» 보풀 — 뻗침이 정체성이다
    return (0, -8.4, 0.0), 90

def 시침핀():
    """시침핀 — 지도 핀·북마크·현재 위치(제안 #6 · 채택 08-19). 꽂는 행위 = 저장.
    쿠션 = 작은 코랄 베개(오브 재사용) · 바늘 = 무채 매끈 · 머리 = 레진 구슬(레진 1점 문법)."""
    쿠션 = 베개몸((0.85, 0.55, 0.6), 크리스=0.62)
    짧은퍼(쿠션, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]),
          길이=0.09, 개수=14000)
    바늘재 = 매끈재질('바늘', 색['Paper'], 거칠기=0.22)
    # v2(유호 교정 08-20 「좀 어색」): 가장자리에 걸치지 않게 윗면 안쪽에 꽂고, 노출 축을 줄여 롤리팝 비율을 버린다
    bpy.ops.mesh.primitive_cylinder_add(radius=0.024, depth=1.15, location=(0.3, -0.02, 0.79),
                                        rotation=(math.radians(8), math.radians(20), 0))
    바늘 = bpy.context.object
    bpy.ops.object.shade_smooth()
    바늘.data.materials.append(바늘재)
    머리재 = 매끈재질('핀머리', 색[염료이름], 거칠기=0.14)   # 레진 — 갇힌 빛(각진 반사는 거칠기로 눅인다)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.155, location=(0.5, -0.1, 1.32))
    머리 = bpy.context.object
    bpy.ops.object.shade_smooth()
    머리.data.materials.append(머리재)
    return (0, -8.6, 0.35), 90

def 와펜():
    """와펜(자수 패치) — 성취 뱃지·급수장(제안 #3 · 채택 08-19). 「달아 준다」의 실물.
    코랄 펠트 원판 + 분필 실 테두리 땀 + 가운데 자수 체크(체크 채택분의 뱃지판)."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0)   # 납작 구 = 패치 원판 — 원기둥 캡 n-gon 은 헤어 보간이 폭발한다(실측 08-20 타임아웃)
    판 = bpy.context.object
    판.scale = (0.95, 0.3, 0.95)
    bpy.ops.object.shade_smooth()
    짧은퍼(판, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]),
          길이=0.08, 개수=12000)
    실재 = 매끈재질('실', 색['Stitch'], 거칠기=0.4)
    r = 0.7
    for i in range(16):                      # 테두리 땀 — 원주를 따라 접선 방향
        a = 2 * math.pi * i / 16
        땀하나(r * math.cos(a), -0.21, r * math.sin(a), 0.13, 0.03, 실재,
              회전y=-math.degrees(a) - 90)
    땀하나(-0.14, -0.37, -0.06, 0.14, 0.042, 실재, 회전y=45)    # 체크 — 짧은 획(털끝 앞 y-0.37)
    땀하나(0.12, -0.37, 0.02, 0.26, 0.042, 실재, 회전y=-38)     # 체크 — 긴 획
    return (0, -7.6, 0.0), 90

def 블랭킷():
    """블랭킷 스티치 테두리 — 카드 감침질(제안 #4 · 채택 08-19). 카드 = 감쳐진 천 조각.
    코랄 펠트 카드의 앞면 가장자리를 분필 실이 감아간다: 안쪽 세로 땀 + 능선 이음 땀."""
    카드 = 베개몸((1.5, 0.4, 1.02), 크리스=0.6)
    짧은퍼(카드, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]),
          길이=0.07, 개수=16000)
    실재 = 매끈재질('실', 색['Stitch'], 거칠기=0.4)
    앞 = -0.42
    w, h, 안 = 1.22, 0.78, 0.2              # 능선 사각(모서리 전 직선부만) + 안쪽 세로 땀
    for (sx, sz, ex, ez, 법x, 법z) in ((-w + 0.2, h, w - 0.2, h, 0, -1), (w, h - 0.2, w, -h + 0.2, -1, 0),
                                       (w - 0.2, -h, -w + 0.2, -h, 0, 1), (-w, -h + 0.2, -w, h - 0.2, 1, 0)):
        길이 = math.hypot(ex - sx, ez - sz)
        n = max(3, int(길이 / 0.3))
        변각 = math.degrees(math.atan2(ez - sz, ex - sx))
        for i in range(1, n):                # 끝점 제외 — 모서리에서 두 변의 땀이 겹쳐 ⌐ 가 된다(시안5 실측)
            t = i / n
            x, z = sx + (ex - sx) * t, sz + (ez - sz) * t
            땀하나(x + 법x * 0.11, 앞, z + 법z * 0.11, 0.13, 0.03, 실재, 회전y=-변각 - 90)  # 안쪽 세로 땀
    능선 = bpy.data.curves.new('능선', 'CURVE')   # 연속 실 줄 — 땀으로 끊으면 T자 클러스터가 된다(시안4 실측)
    능선.dimensions = '3D'
    능선.bevel_depth = 0.028
    능선.bevel_resolution = 4
    sp = 능선.splines.new('POLY')
    둘레 = []
    r = 0.18
    for (cx, cz, a0) in ((w - r + 0.18, h - r + 0.18, 0), (-w + r - 0.18, h - r + 0.18, 90),
                         (-w + r - 0.18, -h + r - 0.18, 180), (w - r + 0.18, -h + r - 0.18, 270)):
        for d in range(0, 91, 15):
            a = math.radians(a0 + d)
            둘레.append((cx + r * math.cos(a), 앞, cz + r * math.sin(a)))
    sp.points.add(len(둘레) - 1)
    for i, (x, y, z) in enumerate(둘레):
        sp.points[i].co = (x, y, z, 1)
    sp.use_cyclic_u = True
    obj = bpy.data.objects.new('능선', 능선)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(실재)
    return (0, -8.4, 0.0), 90

def 실패스피너():
    """실패(보빈) 스피너 — 로딩(제안 #8 · 채택 08-19). 기다림 = 실이 풀리는 시간.
    무채 보빈에 코랄 실이 감기고 꼬리가 풀려 나간다."""
    몸재 = 매끈재질('보빈', 색['Stone'], 거칠기=0.6)
    for z in (0.62, -0.62):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.62, depth=0.14, location=(0, 0, z))
        원반 = bpy.context.object
        bev = 원반.modifiers.new('bev', 'BEVEL')
        bev.width = 0.04
        bev.segments = 4
        bpy.ops.object.shade_smooth()
        원반.data.materials.append(몸재)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.26, depth=1.1, location=(0, 0, 0))
    허리 = bpy.context.object
    bpy.ops.object.shade_smooth()
    허리.data.materials.append(몸재)
    실재 = 매끈재질('실', 색[염료이름], 거칠기=0.5, 배율=0.85)
    for i in range(7):                       # 감긴 실 — 반지름이 살짝 다른 고리 일곱
        z = -0.42 + i * 0.14
        bpy.ops.mesh.primitive_torus_add(major_radius=0.38, minor_radius=0.05,
                                         location=(0.01 * (i % 2), 0, z))
        고리 = bpy.context.object
        bpy.ops.object.shade_smooth()
        고리.data.materials.append(실재)
    꼬리 = bpy.data.curves.new('꼬리', 'CURVE')          # 풀려 나가는 꼬리 실
    꼬리.dimensions = '3D'
    꼬리.bevel_depth = 0.05
    꼬리.bevel_resolution = 5
    sp = 꼬리.splines.new('POLY')
    N = 40
    sp.points.add(N - 1)
    for i in range(N):
        t = i / (N - 1)
        sp.points[i].co = (0.4 + 1.5 * t, -0.15 * math.sin(t * 5), -0.35 - 0.55 * t + 0.14 * math.sin(t * 9), 1)
    obj = bpy.data.objects.new('꼬리', 꼬리)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(실재)
    return (0.55, -7.8, -0.15), 90

def 직조라벨():
    """직조 라벨 태그 — 카테고리 칩(제안 #10 · 채택 08-19). 옷 안쪽 라벨 문법.
    분필색 얇은 천 조각 + 코랄 러닝 스티치 테두리 + 위 모서리 고정 땀 두 개(달려 있음)."""
    라벨 = 베개몸((0.95, 0.055, 1.3), 크리스=0.42)
    천재 = 직물결(매끈재질('라벨천', 색['Oat'], 거칠기=0.88), 지름=1.90)
    라벨.data.materials.append(천재)
    실재 = 매끈재질('실', 색['Deep Wool'], 거칠기=0.72)   # 양모 회색 실 — 2027 킷 · 0.42 는 구슬로 읽혔다(시안2027)
    앞 = -0.075
    w, h = 0.72, 1.05
    for (sx, sz, ex, ez) in ((-w, h, w, h), (w, h, w, -h), (w, -h, -w, -h), (-w, -h, -w, h)):
        길이 = math.hypot(ex - sx, ez - sz)
        n = max(3, int(길이 / 0.24))
        변각 = math.degrees(math.atan2(ez - sz, ex - sx))
        for i in range(n):
            t = (i + 0.5) / n
            땀하나(sx + (ex - sx) * t, 앞, sz + (ez - sz) * t, 0.075, 0.026, 실재, 회전y=-변각)
    return (0, -9.2, 0.0), 90   # 고정 땀은 뺐다 — 테두리와 충돌해 오히려 어지럽다(시안5 실측) · -6.6 은 라벨 2.6 이 가시 2.3 을 넘겨 상하가 잘렸다

def 판뒤구():
    """판 3종 공통 뒤구 — 오른쪽 밖으로 반쯤 나온 코랄 퍼 구슬. 판 뒤로 들어간 반이
    «비치는가/막히는가»로 재질이 갈린다. 세 판 같은 구도(745ffc93 요청 08-20 — 실물 판정 공정성).
    y=0.75 는 확산 투과에 씻겨 안 비쳤다(시안2027) — 판에 바싹 붙인다."""
    뒤구 = 베개몸((0.6, 0.4, 0.6), 위치=(1.42, 0.50, 0.34), 크리스=0.62)
    짧은퍼(뒤구, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]))

def 판재질(종류):
    """판 3종의 재질 — **여기 한 곳에서만 정의한다.** 스튜디오 대조판과 앱판이 각자 값을 지니면
    대조가 거짓이 된다(같은 재질이라 믿고 나란히 놓는데 값이 갈려 있는 형태). 두께도 함께 낸다."""
    if 종류 == '패턴지':
        m = bpy.data.materials.new('패턴지')
        m.use_nodes = True
        p = m.node_tree.nodes['Principled BSDF']
        p.inputs['Base Color'].default_value = 리니어(색['Paper'])
        p.inputs['Roughness'].default_value = 0.80   # 0.92 는 투과가 다 씻겨 불투명으로 읽혔다(시안2027)
        if 'Transmission Weight' in p.inputs:
            p.inputs['Transmission Weight'].default_value = 0.7   # 반투명 — 서리 낀 종이(유리 광 없음)
        직물결(m, 규모=260.0, 세기=0.03)   # 종이 이빨 — 매끈하면 아크릴로 읽힌다
        return m, 0.028
    if 종류 == '유리':
        m = bpy.data.materials.new('서리유리')
        m.use_nodes = True
        p = m.node_tree.nodes['Principled BSDF']
        p.inputs['Base Color'].default_value = 리니어(색['Paper'])
        p.inputs['Roughness'].default_value = 0.3    # 서리 — 맑은 유리는 창문이지 판이 아니다
        if 'Transmission Weight' in p.inputs:
            p.inputs['Transmission Weight'].default_value = 1.0
        p.inputs['IOR'].default_value = 1.45
        return m, 0.028
    if 종류 == '다린천':
        m = bpy.data.materials.new('다린천')
        m.use_nodes = True
        p = m.node_tree.nodes['Principled BSDF']
        p.inputs['Base Color'].default_value = 리니어(색['Oat'])
        p.inputs['Roughness'].default_value = 0.96
        if 'Specular IOR Level' in p.inputs:
            p.inputs['Specular IOR Level'].default_value = 0.12   # 광을 거의 죽인다 — 무광 숙청과 정합
        직물결(m, 규모=200.0, 세기=0.045)   # 눌린 부직포 알갱이 — 민무늬는 도자기로 읽혔다(시안2027)
        return m, 0.055
    raise SystemExit('모르는 판 재질: ' + 종류)

def 시접선(y앞=-0.055):
    """패턴지 고유 장식 — 재단지의 시접 표시. 유리엔 못 얹는 것이라 후보의 «값»에 포함된다."""
    분필 = 분필재질('시접', 색['Ash Wool'])
    for i in range(7):                        # 왼 가장자리 «안쪽» 한 줄 한정(제안 3차 #3)
        땀하나(-0.94, y앞, -0.55 + i * 0.185, 0.08, 0.024, 분필, 회전y=90, 납작=True)

def 패턴지판():
    """패턴지(재단지) 판 — 유리 대체 «후보»(은퇴 미확정 — 유호 정정 08-20): 반투명 «판»을
    재단 도면 종이로 내는 시험. 공방 은유 안의 종이 — 빛을 «통과»시키되 차갑지 않다.
    유리는 판정 전까지 존속 — 실물 대조는 판 3종 같은 구도."""
    판뒤구()
    재질, 두께 = 판재질('패턴지')
    판 = 베개몸((1.35, 두께, 0.95), 크리스=0.38, 레벨=4)
    판.data.materials.append(재질)
    시접선()                                  # 시접선 — 왼 가장자리 «안쪽» 한 줄 한정(제안 3차 #3)
    return (0, -6.8, 0.0), 90

def 다린천판():
    """다린 무광 천 판 — 카드·판 바닥 «후보»(은퇴 미확정 08-20 — 실물 대조 후 확정): 결을 눕힌
    무채 천. 광택 0 · 결 최소 — 다림질 자국의 «눌린» 면. 뒤구가 «막혀» 보이는 것이 이 판의 답이다."""
    판뒤구()
    재질, 두께 = 판재질('다린천')
    판 = 베개몸((1.35, 두께, 0.95), 크리스=0.34, 레벨=4)
    판.data.materials.append(재질)
    return (0, -6.8, 0.0), 90

def 유리판():
    """서리 유리 판 — 정보 판의 현직(은퇴 미확정 — 유호 정정 08-20 「지금 굽고 있어」).
    패턴지판과 같은 구도·조명·크기, 재질만 유리. 시접선은 재단지 고유 장식이라 없다."""
    판뒤구()
    재질, 두께 = 판재질('유리')
    판 = 베개몸((1.35, 두께, 0.95), 크리스=0.38, 레벨=4)
    판.data.materials.append(재질)
    return (0, -6.8, 0.0), 90

# ── 글자 공방 — 오브제 글자 3종 (유호 채택 08-20 「조율판 채택」 · 글자공방_0820 인계) ──────
# 본문 글자는 여전히 HTML 층 몫이다. 여기서 굽는 것은 «고정 라벨급 오브제 글자» 화면당 한 점.
글자후보 = (r'C:\Windows\Fonts\malgunbd.ttf',                      # 채택판을 구운 본가(윈도 · 맑은고딕 볼드)
          '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc')          # 클라우드 대역 — ⚠Noto CJK(CFF)는
          # Blender 가 글리프를 1/3 스케일로 읽는다(실측 08-20: 「가」 0.30 vs wqy 0.73) — 후보에 안 넣는다.

def 글자체(t):
    """오브제 글자의 붓 — 맑은고딕 볼드(채택 환경)가 없으면 한글 되는 고딕으로 대신한다.
    대역으로 구운 판은 시안 급이다 — 정본 글리프 확정은 본가 폰트로 굽는다.
    ⚠fonts.load 는 없는 경로에도 예외 없이 «깨진 폰트»를 돌려준다(리눅스 실측 08-20 — ERROR
    리포트만 남기고 두부 글리프가 나온다) — 그래서 파일 실존을 먼저 잰다."""
    import os
    for 길 in 글자후보:
        if not os.path.isfile(길):
            continue
        try:
            t.data.font = bpy.data.fonts.load(길)
            return
        except Exception:
            continue
    print('경고 · 글자체: 한글 폰트를 못 찾아 기본체 — 한글이 빈 칸으로 나올 수 있다')

def 유리글자(본문, 크기, 위치, 재질, 돌출=0.032, 베벨=0.006):
    """범용 «오브제 글자» — 잉크가 아니라 재질로 서는 글자(이름과 달리 재질 무관).
    베벨이 핵심이다: 모서리가 둥글어야 빛을 물어 «부어 만든» 것으로 읽힌다(각지면 아크릴 간판)."""
    bpy.ops.object.text_add()
    t = bpy.context.object
    t.data.body = 본문
    글자체(t)
    t.data.size = 크기
    t.data.extrude = 돌출
    t.data.bevel_depth = 베벨
    t.data.bevel_resolution = 3
    t.data.align_x = 'CENTER'
    t.data.align_y = 'CENTER'
    t.rotation_euler = (math.radians(90), 0, 0)   # 극 +z → 세계 -y: 돌출이 카메라 쪽으로 나온다
    t.location = 위치
    t.data.materials.append(재질)
    return t

def 글자곡선표본(본문, 크기, 간격=0.15):
    """글자 윤곽을 땀 자리로 바꾼다 — 텍스트를 곡선으로 떠서 베지어를 균일 간격으로 걷는다.
    돌려주는 것 = [(x, y, 진행각도), ...] (글리프 평면 좌표 — 호출자가 세계로 옮긴다).
    **어떤 한글이든 자수 경로가 자동으로 나온다** — 글자마다 도안을 손으로 놓지 않는다."""
    from mathutils.geometry import interpolate_bezier
    bpy.ops.object.text_add()
    t = bpy.context.object
    t.data.body = 본문
    글자체(t)
    t.data.size = 크기
    t.data.align_x = 'CENTER'
    t.data.align_y = 'CENTER'
    bpy.ops.object.convert(target='CURVE')
    자리들 = []
    for sp in t.data.splines:
        if sp.type != 'BEZIER' or len(sp.bezier_points) < 2:
            continue
        bps = sp.bezier_points
        n = len(bps)
        걸음 = []
        마디수 = n if sp.use_cyclic_u else n - 1
        for i in range(마디수):
            a, b = bps[i], bps[(i + 1) % n]
            for v in interpolate_bezier(a.co, a.handle_right, b.handle_left, b.co, 8)[:-1]:
                걸음.append((v.x, v.y))
        지나온 = 0.0
        다음땀 = 간격 * 0.5
        for i in range(len(걸음)):
            x0, y0 = 걸음[i]
            x1, y1 = 걸음[(i + 1) % len(걸음)]
            d = math.hypot(x1 - x0, y1 - y0)
            while 지나온 + d >= 다음땀 and d > 1e-6:
                t비 = (다음땀 - 지나온) / d
                자리들.append((x0 + (x1 - x0) * t비, y0 + (y1 - y0) * t비,
                              math.degrees(math.atan2(y1 - y0, x1 - x0))))
                다음땀 += 간격
            지나온 += d
    bpy.data.objects.remove(t, do_unlink=True)
    return 자리들

def 글자등(받는것들, 위치=(0, -2.2, 0.4), 크기=1.6, 힘=150):
    """«받는 것만 비추는» 보조광 — 라이트 링킹. 무대의 분위기(결광·스침)는 안 건드리고 명도만
    반 단계 올린다. ⚠어두운 글자(먹·코랄 3·양모 실)에 직사 금지 — 바래서 죽는다(글자공방 함정 ③).
    규칙: 밝은 글자는 글자를, 어두운 글자는 «바탕»을 비춘다. 힘은 은은하게 — 세면 무대와 그림자가 어긋난다."""
    bpy.ops.object.light_add(type='AREA', location=위치,
                             rotation=(math.radians(90), 0, 0))
    등불 = bpy.context.object
    등불.data.size = 크기
    등불.data.energy = 힘
    등불.name = '글자등'
    받는 = bpy.data.collections.new('글자등_받는것')
    bpy.context.scene.collection.children.link(받는)
    for o in 받는것들:
        받는.objects.link(o)
    등불.light_linking.receiver_collection = 받는
    return 등불

def 자수글자():
    """자수 글자 — 밤천(Ink) 위 코랄 아플리케 + 테두리 새틴 땀(채택판 = 글자공방 3차 · 결광2).
    손맛이 핵심: 각도 ±8° · 길이 ±12% · 자리 ±0.004 지터(고정 씨앗 — 재현 가능).
    ⚠텍스트 변환 메시에 바로 퍼 심기 금지(함정 ①) — 법선·밀도가 들쭉날쭉해 털이 제멋대로 뻗친다.
    복셀 리메시(0.018) 후 심는다 — 획이 가는 글자는 0.018 이 획을 뭉갤 수 있음(글자별 확인)."""
    바닥 = 베개몸((1.35, 0.055, 0.95), 크리스=0.34, 레벨=4)
    바닥.data.materials.append(직물결(매끈재질('밤천', 색['Ink'], 거칠기=0.96), 지름=2.70))
    본문 = 인자.get('본문', '가')
    # 채택판 「가」는 1.28 이다(그대로 둔다). 낱자·숫자처럼 한 글자짜리 교보재 타일은 판에 비해
    # 글자가 작아 보이므로 굽는 자리에서 「글자크기=」로 키운다 — 땀 표본도 같은 값을 쓴다.
    글크 = float(인자.get('글자크기', '1.28'))
    bpy.ops.object.text_add()
    t = bpy.context.object
    t.data.body = 본문
    글자체(t)
    t.data.size = 글크
    t.data.extrude = 0.018
    t.data.bevel_depth = 0.006
    t.data.bevel_resolution = 3
    t.data.align_x = 'CENTER'
    t.data.align_y = 'CENTER'
    t.rotation_euler = (math.radians(90), 0, 0)
    글y = -0.075
    t.location = (0, 글y, 0.03)
    bpy.ops.object.convert(target='MESH')
    rm = t.modifiers.new('리메시', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = 0.018
    bpy.ops.object.modifier_apply(modifier='리메시')
    bpy.ops.object.shade_smooth()
    짧은퍼(t, 염료이름, 살재질(염료이름, 색[염료이름]),
          털재질(염료이름, 색[염료이름]), 길이=0.022, 개수=9000)
    ps = t.particle_systems[-1].settings
    ps.clump_factor = 0.35
    ps.roughness_1 = 0.03
    ps.roughness_2 = 0.04
    ps.rendered_child_count = ps.child_percent = 40
    실재 = 매끈재질('테두리실', 색['Stitch'], 거칠기=0.5)
    손 = random.Random(20260820)               # 고정 씨앗 — 같은 판이 다시 나온다
    for (px, py, 각) in 글자곡선표본(본문, 글크, 간격=0.115 * 글크 / 1.28):
        땀하나(px + 손.uniform(-0.004, 0.004), 글y - 0.026,
              py + 0.03 + 손.uniform(-0.004, 0.004),
              0.046 * 손.uniform(0.88, 1.12), 0.018, 실재,
              회전y=-각 + 손.uniform(-8, 8))
    return (0, -6.8, 0.0), 90

def 레터프레스():
    """레터프레스 — 다린천 불리언 눌림 + 먹 상감(채택판 = 글자공방 4차 · 스침 · 등힘=90).
    어두운 글자는 띄우면 죽는다 — 대신 «천만» 은은한 정면광을 받아 먹과의 대비가 오른다."""
    재질, 두께 = 판재질('다린천')
    판 = 베개몸((1.35, 두께, 0.95), 크리스=0.34, 레벨=4)
    판.data.materials.append(재질)
    본문 = 인자.get('본문', '숙제')
    bpy.ops.object.text_add()
    커터 = bpy.context.object
    커터.data.body = 본문
    글자체(커터)
    커터.data.size = 0.68
    커터.data.extrude = 0.03
    # ⚠커터에 베벨 금지(함정 ②) — 베벨 텍스트는 획 모서리에서 자기교차가 생겨 불리언이 천을 통째로
    #   삼킨다(시험 2회 재현). 눌린 모서리의 부드러움은 스침광의 그늘이 대신 낸다.
    커터.data.align_x = 'CENTER'
    커터.data.align_y = 'CENTER'
    커터.rotation_euler = (math.radians(90), 0, 0)
    커터.location = (0, -두께, 0.06)
    bpy.ops.object.convert(target='MESH')
    m = 판.modifiers.new('눌림', 'BOOLEAN')
    m.operation = 'DIFFERENCE'
    m.object = 커터
    커터.hide_render = True
    먹 = 매끈재질('먹', 색['Ink'], 거칠기=0.85)   # 인쇄 잉크의 새틴 한 방울(모서리 하이라이트)
    유리글자(본문, 0.6696, (0, -0.026, 0.06), 먹, 돌출=0.012, 베벨=0.0)
    # 등힘 채택값 = 90(유호 08-20) — 200 은 스침의 명암이 씻겼고 150 도 위계가 평평했다.
    글자등([판], 위치=(0, -2.4, 0.3), 크기=2.2, 힘=float(인자.get('등힘', '90')))
    return (0, -6.8, 0.0), 90

def 라벨태그():
    """라벨 태그 — 직조라벨 + 손 지터 테두리 + 코랄 3 진행 숫자(채택판 = 글자공방 4차 · 스침 · 등힘=80).
    글자등은 «천만» 받는다 — 코랄 3 은 어두운 글자색이라 직사에 바랜다(함정 ③)."""
    라벨 = 베개몸((0.95, 0.055, 1.3), 크리스=0.42)
    라벨.data.materials.append(직물결(매끈재질('라벨천', 색['Oat'], 거칠기=0.88), 지름=1.90))
    실재 = 매끈재질('실', 색['Deep Wool'], 거칠기=0.72)
    손 = random.Random(20260820)
    앞, w, h = -0.075, 0.72, 1.05
    for (sx, sz, ex, ez) in ((-w, h, w, h), (w, h, w, -h), (w, -h, -w, -h), (-w, -h, -w, h)):
        길이 = math.hypot(ex - sx, ez - sz)
        n = max(3, int(길이 / 0.24))
        변각 = math.degrees(math.atan2(ez - sz, ex - sx))
        for i in range(n):
            tt = (i + 0.5) / n
            땀하나(sx + (ex - sx) * tt + 손.uniform(-0.006, 0.006), 앞,
                  sz + (ez - sz) * tt + 손.uniform(-0.006, 0.006),
                  0.075 * 손.uniform(0.9, 1.1), 0.026, 실재,
                  회전y=-변각 + 손.uniform(-7, 7))
    강조 = 매끈재질('진행실', 색['Coral 3'], 거칠기=0.6)
    유리글자(인자.get('본문', '3'), 0.40, (-0.26, -0.070, 0.30), 강조, 돌출=0.012, 베벨=0.004)
    유리글자(인자.get('본문2', '/ 10'), 0.26, (0.20, -0.064, 0.285), 실재, 돌출=0.010, 베벨=0.004)
    유리글자('SYNK', 0.15, (0, -0.063, -0.55),
            매끈재질('보조실', 색['Ash Wool'], 거칠기=0.72), 돌출=0.008, 베벨=0.003)
    글자등([라벨], 위치=(0, -2.4, 0.0), 크기=2.0, 힘=float(인자.get('등힘', '80')))
    return (0, -9.2, 0.0), 90
def 단춧구멍필드():
    """단춧구멍 슬롯 — 텍스트 필드(사전 1-a). 입력칸은 «천에 낸 구멍»이다:
    감침질 땀이 슬롯의 긴 변을 비스듬히 물고 넘어가고, 양 끝은 빗장 땀이 막는다(안 막으면 째진 천이다).
    위 = 포커스(코랄 실 한 줄이 슬롯을 두른다 — 신호 1점) · 아래 = 기본(초크 힌트 — 「아직 확정 아님」).
    실측 교정 2벌: ① 어두운 판을 천 «위»에 얹으니 구멍이 아니라 «검은 판때기»로 읽혔다.
    ② 천 조각 여럿을 이어 틈을 내니 이음선이 가로로 길게 드러나 «여러 장»으로 읽혔다.
    → 천은 한 장으로 두고 구멍을 실제로 «잘라낸다»(불리언). 잘린 살에서도 털이 자라 — 절단면이 보풀진다."""
    안감 = 베개몸((2.7, 0.07, 1.6), 위치=(0, 0.17, 0), 크리스=0.4)   # 틈 너머의 어둠 — 앱 다크 바닥의 실물
    안감.data.materials.append(직물결(매끈재질('안감', 색['Deep Wool'], 거칠기=0.98, 배율=0.3)))
    실재 = 매끈재질('실', 색['Stitch'], 거칠기=0.4)
    코랄실 = 매끈재질('포커스실', 색[염료이름], 거칠기=0.42)
    초크 = 분필재질('초크', 색['Ash Wool'])
    앞, w, 반높이 = -0.2, 1.15, 0.26          # 반높이 = 틈의 반높이(땀이 0.11 을 물고 들어온다)

    판 = 베개몸((2.6, 0.18, 1.5), 크리스=0.8)
    bpy.context.view_layer.objects.active = 판
    bpy.ops.object.modifier_apply(modifier='sub')   # 털을 심기 «전»에 살을 확정한다 — 뒤에 자르면 털이 안 따라온다
    for cz in (0.68, -0.68):
        칼 = 베개몸((w + 0.05, 0.6, 반높이), 위치=(0, 0, cz), 크리스=0.95)   # 둥근 사각 칼 — 재단가위 자리
        bpy.context.view_layer.objects.active = 판
        자름 = 판.modifiers.new('자름%d' % int(cz * 100), 'BOOLEAN')
        자름.object = 칼
        자름.operation = 'DIFFERENCE'
        bpy.ops.object.modifier_apply(modifier=자름.name)
        bpy.data.objects.remove(칼, do_unlink=True)
    판.data.materials.clear()                 # 불리언이 남긴 빈 재질 칸을 치운다 — 안 치우면 살이 기본 흰색이 된다
    짧은퍼(판, 'Deep Wool', 살재질('Deep Wool', 색['Deep Wool']),
          털재질('Deep Wool', 색['Deep Wool']), 길이=0.05, 개수=24000)

    def 슬롯(cz, 포커스, 힌트):
        n = 21                                # 감침질 — 곧게 세우면 사다리다: 비스듬히 물고 넘어가는 땀
        for i in range(n):                    # 위·아래 기울기는 «같은» 쪽이다 — 실 한 오리가 감아 도니까
            x = -w + 2 * w * (i + 0.5) / n    # (어긋내면 밀 이삭 무늬가 된다 — 시안2 실측)
            for 쪽 in (1, -1):
                땀하나(x, 앞 - 0.02, cz + 쪽 * 0.27, 0.115, 0.021, 실재, 회전y=72)
        for sx in (-w - 0.06, w + 0.06):      # 빗장 땀 — 구멍의 양 끝을 막는다
            땀하나(sx, 앞 - 0.02, cz, 0.3, 0.034, 실재, 회전y=90)
        if 힌트:                               # 초크 마킹 — 틈 «안»(안감 위)에 자리만 잡은 «가루»
            for i in range(4):                 # 안에 있으니 어둡다 — 힌트는 원래 흐리다(③꿰맴이 아니다)
                땀하나(-0.86 + i * 0.29, 0.09, cz, 0.1, 0.022, 초크, 회전y=0, 납작=True)
        if 포커스:                             # 포커스 링 — 슬롯을 두르는 연속 코랄 실 한 줄
            링 = bpy.data.curves.new('포커스', 'CURVE')
            링.dimensions = '3D'
            링.bevel_depth = 0.026
            링.bevel_resolution = 4
            sp = 링.splines.new('POLY')
            둘레, rw, rh, r = [], w + 0.2, 반높이 + 0.22, 0.16   # 필드를 «감싸는» 링이지 액자가 아니다
            for (dx, dz, a0) in ((rw - r, rh - r, 0), (-rw + r, rh - r, 90),
                                 (-rw + r, -rh + r, 180), (rw - r, -rh + r, 270)):
                for d in range(0, 91, 15):
                    a = math.radians(a0 + d)
                    둘레.append((dx + r * math.cos(a), 앞 - 0.035, cz + dz + r * math.sin(a)))
            sp.points.add(len(둘레) - 1)
            for i, (x, y, z) in enumerate(둘레):
                sp.points[i].co = (x, y, z, 1)
            sp.use_cyclic_u = True
            obj = bpy.data.objects.new('포커스', 링)
            bpy.context.collection.objects.link(obj)
            obj.data.materials.append(코랄실)

    슬롯(0.68, True, False)
    슬롯(-0.68, False, True)
    return (0, -8.1, 0.0), 90   # 천은 프레임을 넘긴다(밑그림 판의 구도 규율)

def 스냅():
    """스냅 단추(똑딱이) — 체크박스(사전 1-a): 체크 = «눌려 잠김».
    왼쪽 = 잠김(수 단추가 암 링에 앉고 코랄 실로 달렸다 — 신호 1점) · 오른쪽 = 열림(빈 링 · ⓪빈 구멍).
    다중 선택이 스냅인 까닭: 똑딱이는 몇 개든 각자 잠긴다 — 단일 확정은 꿰맨 단추다.
    시안1 실측 교정: 달림 땀이 링 밖에 떠 있어 «햇살»로 읽혔다 — 링 위를 가로지르게 옮겼다."""
    띠 = 베개몸((2.6, 0.3, 1.75), 크리스=0.66)
    짧은퍼(띠, 'Deep Wool', 살재질('Deep Wool', 색['Deep Wool']),
          털재질('Deep Wool', 색['Deep Wool']), 길이=0.05, 개수=24000)
    링재 = 매끈재질('링', 색['Stone'], 거칠기=0.42, 배율=0.92)
    수재 = 매끈재질('수단추', 색['Oat'], 거칠기=0.35)
    구멍재 = 매끈재질('구멍', 색['Deep Wool'], 거칠기=0.98, 배율=0.28)
    코랄실 = 매끈재질('코랄실', 색[염료이름], 거칠기=0.42)
    크림실 = 매끈재질('크림실', 색['Stitch'], 거칠기=0.4)
    앞 = -0.31

    def 스냅하나(cx, 잠김, 실재):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.52, minor_radius=0.09,
                                         location=(cx, 앞, 0), rotation=(math.radians(90), 0, 0),
                                         major_segments=56, minor_segments=14)
        링 = bpy.context.object
        bpy.ops.object.shade_smooth()
        링.data.materials.append(링재)
        if 잠김:
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.43, location=(cx, 앞 - 0.02, 0))
            돔 = bpy.context.object            # 링 «안»을 꽉 채워 앉는다 — 틈이 남으면 렌즈로 읽힌다(품질판 실측)
            돔.scale = (1, 0.62, 1)            # 봉긋해야 «끼워 잠긴 수 단추»다(납작하면 흰 원판이다)
            bpy.ops.object.shade_smooth()
            돔.data.materials.append(수재)
        else:
            bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(cx, 앞 + 0.02, 0))
            구멍 = bpy.context.object
            구멍.scale = (0.44, 0.02, 0.44)   # 빈 가운데 — 잠기지 않은 스냅은 «구멍»이다
            bpy.ops.object.shade_smooth()
            구멍.data.materials.append(구멍재)
        for a in (38, 142, 218, 322):         # 달림 땀 — 링 «위»를 방사로 가로지른다(꿰매 달았다)
            r = math.radians(a)
            땀하나(cx + 0.52 * math.cos(r), 앞 - 0.115, 0.52 * math.sin(r), 0.17, 0.034, 실재, 회전y=-a)

    스냅하나(-1.15, True, 코랄실)
    스냅하나(1.15, False, 크림실)
    return (0, -9.0, 0.0), 90

def 조각보타일():
    """조각보(패치워크) 타일 — 대시보드 그리드(사전 1-b). 그리드는 «선»이 아니라 «솔기»다.
    무채 조각 셋(Oat·Ash Wool·Deep Wool — 밝기 사다리)에 기본색 조각 하나 — 오늘의 카드가 신호 1점이다.
    조각들은 떠 있지 않고 이어 붙어 있다: 솔기마다 러닝 스티치가 지나간다(몽골·한국 서사).
    품질판 실측 교정: 털이 길고 조각이 두꺼워 «앙고라 방석 넷»으로 읽혔다 — 조각보는 얇고 납작하다.
    털 0.06→0.035 · 두께 0.26→0.18 · 크리스 0.5→0.75 · 틈을 거의 닫아 «솔기»는 땀이 긋게 했다."""
    바닥 = 베개몸((2.9, 0.12, 2.2), 위치=(0, 0.3, 0), 크리스=0.4)
    바닥.data.materials.append(직물결(매끈재질('바닥', 색['Deep Wool'], 거칠기=0.96, 배율=0.6)))
    for (cx, cz, 이름, 개수) in ((-1.13, 0.86, 염료이름, 13000), (1.13, 0.86, 'Oat', 11000),
                               (-1.13, -0.86, 'Ash Wool', 11000), (1.13, -0.86, 'Deep Wool', 11000)):
        # 무채는 «사다리»로 고른다 — Oat·Stone·Ash 는 털이 빛을 먹어 셋 다 흰 조각으로 읽혔다(시안3 실측)
        조각 = 베개몸((1.12, 0.18, 0.84), 위치=(cx, 0, cz), 크리스=0.75)
        짧은퍼(조각, 이름, 살재질(이름, 색[이름]), 털재질(이름, 색[이름]), 길이=0.035, 개수=개수)
    실재 = 매끈재질('실', 색['Stitch'], 거칠기=0.4)
    for i in range(21):                       # 세로 솔기 — 두 열 사이를 지나는 러닝 스티치
        z = -2.0 + i * 0.2
        if abs(z) > 0.14:                     # 솔기 교차점은 비운다 — 땀 둘이 겹치면 매듭으로 읽힌다
            땀하나(0, -0.21, z, 0.062, 0.024, 실재, 회전y=90)
    for i in range(25):                       # 가로 솔기
        x = -2.4 + i * 0.2
        if abs(x) > 0.14:
            땀하나(x, -0.21, 0, 0.062, 0.024, 실재, 회전y=0)
    return (0, -10.9, 0.0), 90

def 매듭():
    """매듭 오너먼트 — 챕터·시즌 구분의 큰 자리 1점(사전 1-c · 한국적 표현 트랙 접점).
    다섯 잎 로제트: 잎 수는 매화매듭(5잎)을 따르되 짜임은 «반 바퀴 어긋나게 두 바퀴 도는» 경로로 지었다
    — 실제 매화매듭 매는 법의 고증판이 아니다(공예 고증 미실시 · 그림으로서의 매듭이다).
    난도 최상인 까닭: 겹침 한 자리라도 같은 쪽으로 지나가면 매듭이 아니라 «무늬»가 된다.
    두 바퀴의 깊이를 서로 반대로 흔들어(sin 부호가 뒤집힌다) 다섯 자리 모두 위·아래가 엇갈린다.
    실은 **3가닥 꼬임 로프**다 — 이 세트의 「실」 문법(털실진행바)을 그대로 쓴다.
    품질판 실측: 민 튜브에 보풀만 심으니 꼬임이 없어 «파이프클리너»로 읽혔다 — 꼬임이 보여야 털실이다.
    검산 둘: ①겹침 자리 깊이차 0.30 > 로프 지름 0.206(보풀 포함 0.25) — 다섯 자리 모두 엇갈린다.
    ②닫힌 고리라 꼬임 위상이 한 바퀴 뒤 맞아떨어져야 한다 — 피치를 총길이(22.08)의 약수로 맞춘다.
    꼬리 끝은 프레임 밖에 둔다(잘린 끝이 보이면 «다리»가 된다)."""
    실몸 = 매끈재질('매듭실', 색[염료이름], 거칠기=0.86, 배율=0.82)
    털 = 털재질(염료이름, 색[염료이름])

    def 빼기(p, q): return (p[0] - q[0], p[1] - q[1], p[2] - q[2])
    def 외적(u, v): return (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])

    def 정규(u):
        길이 = math.sqrt(u[0] ** 2 + u[1] ** 2 + u[2] ** 2) or 1.0
        return (u[0] / 길이, u[1] / 길이, u[2] / 길이)

    def 거리(p, q): return math.sqrt(sum((x - y) ** 2 for x, y in zip(p, q)))

    def 실가닥(점들, 굵기, 털수, 닫힘=False):
        곡선 = bpy.data.curves.new('매듭실', 'CURVE')
        곡선.dimensions = '3D'
        곡선.bevel_depth = 굵기
        곡선.bevel_resolution = 5
        곡선.use_fill_caps = True
        sp = 곡선.splines.new('POLY')
        sp.points.add(len(점들) - 1)
        for i, (x, y, z) in enumerate(점들):
            sp.points[i].co = (x, y, z, 1)
        sp.use_cyclic_u = 닫힘
        obj = bpy.data.objects.new('매듭실', 곡선)
        bpy.context.collection.objects.link(obj)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')   # 곡선엔 털이 안 심겨 — 메쉬로 바꿔 보풀을 심는다
        몸 = bpy.context.object
        bpy.ops.object.shade_smooth()
        짧은퍼(몸, 염료이름, 실몸, 털, 길이=0.022, 개수=털수)
        return 몸

    def 꼬임로프(길, 닫힘, 벌림, 굵기, 털수):
        """가운데 심을 따라 세 가닥이 서로를 감는다 — 꼬임이 보여야 «털실»로 읽힌다."""
        n = len(길)
        누적, 자리 = 0.0, [0.0]
        for i in range(1, n):
            누적 += 거리(길[i], 길[i - 1])
            자리.append(누적)
        총 = 누적 + (거리(길[0], 길[-1]) if 닫힘 else 0.0)
        피치 = 총 / max(1, round(총 / 0.42))     # 닫힌 고리는 위상이 맞아떨어져야 이음매가 없다
        for k in range(3):
            점들 = []
            for i in range(n):
                앞 = 길[(i + 1) % n] if (닫힘 or i + 1 < n) else 길[i]
                뒤 = 길[(i - 1) % n] if (닫힘 or i > 0) else 길[i]
                접선 = 정규(빼기(앞, 뒤))
                법선 = 정규(외적(접선, (0.0, 1.0, 0.0)))   # 길이 거의 평면이라 위축을 기준틀로 쓴다
                종선 = 정규(외적(접선, 법선))
                각 = 2 * math.pi * 자리[i] / 피치 + k * 2 * math.pi / 3
                c, s = math.cos(각), math.sin(각)
                점들.append(tuple(길[i][축] + 벌림 * (c * 법선[축] + s * 종선[축]) for 축 in (0, 1, 2)))
            실가닥(점들, 굵기, 털수, 닫힘=닫힘)

    잎, R, a, 깊이, N = 5, 1.10, 0.78, 0.15, 800   # 가운데(R-a)를 0.32 로 조여야 «엮인 매듭»이다
    고리 = []
    돌림 = math.radians(18)                     # 아래 한가운데를 «잎 사이 골»로 돌린다 — 꼬리가 나올 문이다
    for i in range(N):
        각 = 4 * math.pi * i / N
        반 = R + a * math.cos(잎 * 각 / 2)
        고리.append((반 * math.cos(각 + 돌림), 깊이 * math.sin(잎 * 각 / 2), 반 * math.sin(각 + 돌림)))
    꼬임로프(고리, True, 0.055, 0.048, 10000)
    for 쪽 in (-1, 1):                          # 아래로 흘러내려 프레임을 넘는 두 가닥 — 술이 달릴 자리
        꼬리 = []                                # 끝을 안 보여야 «이어진다»: 잘린 끝은 프레임 밖에 둔다
        for i in range(34):
            t = i / 33
            꼬리.append((쪽 * (0.3 + 0.22 * t), 0.02, -0.55 - 1.9 * t))   # 둘이 붙으면 «줄기»가 된다 — 벌린다
        꼬임로프(꼬리, False, 0.045, 0.04, 1400)
    return (0, -12.4, 0.0), 90


def 앱판():
    """앱 화면 위의 판 — 재질을 «앱 상황에서» 잰다(유호 요청 08-20 「앱 화면 위에서도 재봐줘」).
    스튜디오 대조판은 검은 무대에 판만 띄운 그림이라 「앱에서 어떻게 읽히는가」는 안 재본 값이었다.
    여기서는 앱 다크(양모 밤)의 층을 실제로 쌓는다:
      바탕(무대가 검다 = Ink Deep #080605 와 사실상 같다) ← 카드(Ink) ← 카드 위 콘텐츠 ← 판.
    🔑 콘텐츠가 **판 가장자리를 가로지른다** — 한 장 안에서 「판 밖의 그것」과 「판 뒤의 그것」이
      나란히 잡힌다. 눈이 두 장을 오갈 필요가 없다(대조의 공정성).
    ⚠ 패턴지에는 시접선이 함께 선다 — 유리엔 못 얹는 장식이라 «후보의 값»에 포함해 재는 것이 맞다.
    재질 인자: 재질=패턴지|유리|다린천."""
    종류 = 인자.get('재질', '패턴지')
    카드 = 베개몸((2.25, 0.1, 1.5), 위치=(0, 0.62, 0), 크리스=0.5)      # 앱 카드 = 낮의 잉크가 밤의 면이 된다
    카드.data.materials.append(직물결(매끈재질('앱카드', 색['Ink'], 거칠기=0.95), 규모=180.0, 세기=0.04))
    실재 = 매끈재질('글줄', 색['Stitch'], 거칠기=0.4)
    for (z, 폭) in ((0.34, 2.05), (-0.02, 2.05), (-0.38, 1.55)):        # 글줄 — 판 좌우 밖까지 이어진다
        n = max(2, int(2 * 폭 / 0.24))
        for i in range(n):
            땀하나(-폭 + 2 * 폭 * (i + 0.5) / n, 0.5, z, 0.075, 0.026, 실재, 회전y=0)
    for cx in (0.62, 1.8):                                             # 같은 알약 둘 — 하나는 판 뒤, 하나는 판 밖
        알약 = 베개몸((0.38, 0.14, 0.17), 위치=(cx, 0.4, -0.78), 크리스=0.58)
        짧은퍼(알약, 염료이름, 살재질(염료이름, 색[염료이름]),
              털재질(염료이름, 색[염료이름]), 길이=0.045, 개수=7000)
    재질, 두께 = 판재질(종류)
    판 = 베개몸((1.35, 두께, 0.95), 크리스=0.38, 레벨=4)
    판.data.materials.append(재질)
    if 종류 == '패턴지':
        시접선(y앞=-두께 - 0.027)
    return (0, -11.3, 0.0), 90


# ── 플레이팅 시험 2종 (유호 승인 08-21 「요리 컨셉 시험 — 맛있고 정성스럽게」) ──────────
# 규율: 요리는 «재질»이 아니라 «차림새»다 — 재료는 전부 펠트·실(킷 색)이고, 접시는 오브와
# 같은 받침 문법이다. 세계(양모)를 안 깨고 미각 연상만 들인다. 채택 판정 전의 시험 형태.

def 음식접시(천색='Ink', 반경=1.62):
    """음식이 놓이는 **그릇** — 상(식탁보) + 바닥판 + 올라온 림.
    🔴 이 함수의 1판은 «평평한 원반»이었고, 그 뒤 룸장면 플레이팅 3판이 그것을 실측으로 기각했다
       (유호 08-21 「접시에 변화를 준다던지」): **림 하나가 원반을 «담기는 그릇»으로 바꾼다.**
       음식 갈래가 둘로 갈려 있어 이쪽만 기각된 판에 남아 있었다 — 같은 배움을 여기도 넣는다.
    🔴 같은 실측 ①: 상(식탁보)이 화면을 덮어야 위의 것이 «스티커»로 안 뜬다 — 검은 무대에 접시만
       놓으면 음식이 공중에 뜬다. 상은 Ink Deep(따뜻한 먹) — 요리 사진의 바닥은 어둡고 따뜻하다.
    ⚠오브 받침은 84° 수평 카메라용 «세운 판»이라 내려보기(59°)에서 벽처럼 기운다(1차 렌더 실측)
    — 음식 그릇은 눕는다. **윗면은 z=-0.02 로 못 박는다**(귤·도넛·쿠키가 그 높이에 앉아 있다)."""
    bpy.ops.mesh.primitive_cylinder_add(radius=20.0, depth=0.12, location=(0, 0, -0.30), vertices=96)
    상 = bpy.context.object
    상.data.materials.append(직물결(매끈재질('상', 색['Ink Deep'], 거칠기=0.98), 지름=40.0))
    접시천 = 직물결(매끈재질('접시천', 색[천색], 거칠기=0.96), 지름=3.24)
    bpy.ops.mesh.primitive_cylinder_add(radius=반경, depth=0.22, location=(0, 0.06, -0.13), vertices=160)
    판 = bpy.context.object                          # 윗면 = -0.13 + 0.11 = -0.02 (옛 판과 같은 높이)
    bev = 판.modifiers.new('bev', 'BEVEL')
    bev.width = 0.045
    bev.segments = 4
    bpy.ops.object.modifier_apply(modifier='bev')
    bpy.ops.object.shade_smooth()
    판.data.materials.append(접시천)
    bpy.ops.mesh.primitive_torus_add(major_radius=반경 - 0.05, minor_radius=0.09, location=(0, 0.06, -0.02),
                                     major_segments=128, minor_segments=18)
    림 = bpy.context.object
    림.scale = (1.0, 1.0, 0.60)                      # 두툼한 림은 그릇이 아니라 쿠션 테두리다(3판 실측)
    bpy.ops.object.shade_smooth()
    림.data.materials.append(접시천)                  # 같은 그릇이니 같은 천 — 색이 갈리면 두 물건이 된다
    return 판

def 귤():
    """펠트 귤 — 플레이팅 1호. 몽골의 겨울 선물 과일이자 제주의 얼굴 — 보상·기념 자리 후보.
    껍질 딤플은 짧은 보풀의 클럼프가 대신하고(귤답게), 꼭지·잎은 Meadow 램프가 진다."""
    음식접시('Ink')
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.66, location=(0, 0, 0.44), segments=48, ring_count=24)
    몸 = bpy.context.object
    몸.scale = (1.0, 1.0, 0.86)                     # 귤은 눌린 구
    bpy.ops.object.shade_smooth()
    # ⚠1차 렌더: 길이 0.05·클럼프 0.55 는 «복숭아 폼폼»이 됐다 — 안개처럼 부풀고 딤플이 안 보였다.
    #   귤 껍질은 «아주 짧고 촘촘한» 보풀이다: 길이를 반으로, 뿌리를 굵게, 클럼프를 세게.
    짧은퍼(몸, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]),
          길이=0.028, 개수=42000)
    ps = 몸.particle_systems[-1].settings
    ps.clump_factor = 0.72
    ps.roughness_1 = 0.02
    ps.root_radius = 0.022
    ps.tip_radius = 0.009                           # 끝이 뾰족하면 서브픽셀로 사라져 디노이저 먹이가 된다
    # 꼭지 — 위 중앙의 짧은 초록 그루터기
    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.1, location=(0, 0, 1.04))
    꼭지 = bpy.context.object
    bpy.ops.object.shade_smooth()
    꼭지.data.materials.append(직물결(매끈재질('꼭지', 색['Meadow Deep'], 거칠기=0.95), 지름=0.16))
    # 잎 하나 — 납작 눌린 구를 비스듬히. 둘이면 산만하다(주인공은 귤이다).
    #   ⚠1차: 작은 매끈 구가 결광 키를 정면으로 받아 «발광 알약»으로 읽혔다 — 키우고 거칠기·결로 죽인다.
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.30, location=(0.30, -0.02, 1.04))
    잎 = bpy.context.object
    잎.scale = (1.0, 0.36, 0.07)
    잎.rotation_euler = (math.radians(18), math.radians(-32), math.radians(34))
    bpy.ops.object.shade_smooth()
    # ⚠2차: 매끈 구는 «초록 캡슐»로 읽혔다 — 펠트 잎은 보풀이 있어야 이 세계 물건이다.
    짧은퍼(잎, 'Meadow', 살재질('잎', 색['Meadow']), 털재질('잎', 색['Meadow']),
          길이=0.018, 개수=5200)
    잎.particle_systems[-1].settings.clump_factor = 0.6
    return (0, -7.4, 4.7), 59                       # 식탁 내려보기 — 당길수록 픽셀 밀도가 선명을 산다

def 도넛():
    """펠트 도넛 — 플레이팅 2호. 도우(Butter Soft 털) 위에 글레이즈 «아플리케»(자수 글자와
    같은 눌린 펠트 문법 · 염료이름이 글레이즈 색)와 실 조각 스프링클(Soft 단 셋 순환).
    스프링클이 «실»이라는 것 — 그게 이 세계 안의 미각이다."""
    음식접시('Ink')
    bpy.ops.mesh.primitive_torus_add(major_radius=0.60, minor_radius=0.30, location=(0, 0, 0.28),
                                     major_segments=64, minor_segments=32)
    도우 = bpy.context.object
    bpy.ops.object.shade_smooth()
    짧은퍼(도우, 'Butter Soft', 살재질('도우', 색['Butter Soft']), 털재질('도우', 색['Butter Soft']),
          길이=0.045, 개수=28000)
    ps = 도우.particle_systems[-1].settings
    ps.clump_factor = 0.5
    # 글레이즈 — 위에 얹힌 눌린 펠트 링(털 없음 = 다린 아플리케). 염료이름이 이 색이다.
    # ⚠2차: 글레이즈가 도우 털에 통째로 묻혔다 — 도우 겉면(0.28+0.30+털 0.045 ≈ 0.63)을
    #   계산해 그 «위»에 얹는다(눈보다 계산 · 4계 ④). 상단 = 0.50+0.27×0.72 ≈ 0.69 > 0.63 ✓
    bpy.ops.mesh.primitive_torus_add(major_radius=0.60, minor_radius=0.27, location=(0, 0, 0.50),
                                     major_segments=64, minor_segments=32)
    글레이즈 = bpy.context.object
    글레이즈.scale = (1.0, 1.0, 0.72)               # 납작 — 도우를 덮은 막
    bpy.ops.object.shade_smooth()
    글레이즈.data.materials.append(직물결(매끈재질('글레이즈', 색[염료이름], 거칠기=0.88), 지름=1.74, 세기=0.55))
    # 스프링클 — 실 조각. Soft 단 셋 순환(신호 1점을 안 넘는 여린 단들).
    실색들 = ['Stitch', 'Lapis Soft', 'Meadow Soft']
    손 = random.Random(20260821)
    for i in range(14):
        a = 2 * math.pi * i / 14 + 손.uniform(-0.16, 0.16)
        r = 0.60 + 손.uniform(-0.13, 0.13)
        재 = 매끈재질('실' + str(i), 색[실색들[i % 3]], 거칠기=0.55)
        땀하나(r * math.cos(a), r * math.sin(a), 0.695 + 손.uniform(-0.012, 0.012),
              0.085 * (1 + 손.uniform(-0.12, 0.12)), 0.026, 재,
              회전y=손.uniform(0, 180), 회전z=손.uniform(-24, 24))
    return (0, -7.4, 4.7), 59


def 조합판():
    """앱 카드 조합판 — 채택된 부품들이 «한 화면»에서 성립하는지의 실물 검증(판정 재료 · 세션 06168e3f).
    양모 밤 퀴즈 화면: 무대 검정 = Ink Deep(#080605 와 사실상 동일) 위에
      ① 미니 라벨 태그(오브제 글자 1점 — 「신호는 하나」: 코랄은 이 「3」뿐)
      ② 문제 카드(Ink 펠트 + 글줄 실땀 = 산 글자 자리 표시 — 본문은 HTML 층 몫이라 «자리»만 굽는다)
      ③ 보기 알약 3(Deep Wool 펠트 — 상태 표시는 HTML 층 몫이라 중립으로)
    글자·본문의 실물 검증은 굽기 뒤 PIL 덧씌움(정밀 본문 규칙)이 잇는다."""
    손 = random.Random(20260820)
    # ⓪ 배경천 — 2차 명품화 ①: 무대가 «죽은 검정 픽셀»이면 위의 펠트가 스티커로 뜬다.
    #    Ink Deep 펠트를 화면 뒤에 깔아 «전 픽셀이 재질»이 되게 한다(카드가 놓인 작업대).
    #    ⚠배경 노출은 양끝이 다 틀렸다(시험 2회): 키제외 = 죽은 검정(결이 0) · 키 전량 = 회색으로 뜸
    #      (#080605 라도 1400W 정면광엔 뜬다). → 키에서 빼고 «배경등» 전용 약광을 준다:
    #      결이 서는 최소치만. 글자가 앉지 않는 면이라 대비 예산과 무관하다.
    배경 = 베개몸((2.6, 0.06, 5.2), 위치=(0, 1.05, 0.2), 크리스=0.12, 레벨=3)
    배경.data.materials.append(직물결(매끈재질('배경천', 색['Ink Deep'], 거칠기=0.97), 규모=90.0, 세기=0.085))
    키제외.append(배경)
    글자등([배경], 위치=(-1.2, -3.2, 2.6), 크기=3.0, 힘=90).name = '배경등'
    # ② 문제 카드 — 위쪽. 글줄 자리표시 없이 «빈 그릇»으로 굽는다:
    #    본문은 HTML 층이 붓는다(규율 「본문 글자는 굽지 않는다」의 실물 형태).
    #    2차 명품화 ②: 크리스 0.5→0.34 — 각진 모서리는 «판때기», 펠트는 눌린 곡률을 갖는다.
    # ⚠3차(유호 08-21 「유리판 크기가 부자연스럽다 — 직사각형으로 하면?」): 카드의 «판다움»을 인자로 뺀다.
    #   크리스는 «모서리 날카로움»이다 — 2차가 0.5→0.34 로 **내려** 둥글게 만든 값이라, 직사각형은 **올려서** 낸다.
    #   세로는 내용(문제 2줄 + 키릴 1줄)에 대해 과했다: 글이 위 1/3 에만 앉고 아래 2/3 가 빈 채로 굽혔다.
    # 4차b: 줄일 것은 «실땀선 밖 맨 천»이지 실땀 사각형이 아니다(4차a 는 둘 다 줄여 본문이 카드에 꽉 찼다).
    #   실땀선을 3차 값(1.12 × 0.47)에 고정하고 몸을 «실땀 + 시접 0.09»로 = 1.21 × 0.56.
    카드세로 = float(인자.get('카드세로', '0.60'))     # 3차 몸으로 복귀(유호 08-21 「3차가 더 좋다」)
    카드각 = float(인자.get('카드각', '0.80'))          # 3차 크리스 — 원호 반경(5차)은 너무 둥글었다
    핀 = 인자.get('핀', '개선') != '없음'              # 시침핀 갈래 — 개선판 / 아예 안 꽂는 판
    알약각 = float(인자.get('알약각', '0.66'))          # 3차 크리스
    카드 = 베개몸((1.25, 0.09, 카드세로), 위치=(0, 0.5, 0.9), 크리스=카드각, 레벨=4)
    카드.data.materials.append(직물결(매끈재질('밤카드', 색['Ink'], 거칠기=0.95), 규모=180.0, 세기=0.04))
    키제외.append(카드)      # 실측: 키를 받으면 Ink 가 떠서 Paper 본문이 4.4:1 로 추락 — 그릇은 가라앉힌다
    # 2차 명품화 ④: 킷 운용 ② 「실땀 = 모든 펠트 오브젝트의 테두리」 — 카드에 손 지터 러닝 스티치.
    #    ⚠명품 렌더 4계 ②(가장 밝은 것은 하나): Stitch 실은 카드보다 밝아 «테두리가 주인공»이 된다
    #      (시험 실측 — 흰 점선이 화면을 먹었다). 카드 테두리는 Deep Wool 로 한 단 낮춘다:
    #      실땀의 «자리»는 지키되 밝기 서열은 라벨(Oat)·코랄에 넘긴다.
    카드실 = 매끈재질('카드실', 색['Deep Wool'], 거칠기=0.78)
    칸들['카드'] = 카드
    # ⚠카드는 두께(0.09)가 라벨의 두 배라 옆면 곡률도 그만큼 넓다 — 시접 0.05 로는 실땀이
    #   그 곡면에 «올라타» 좌우 변 땀이 서 버린다(4차 시험 실측). 카드만 0.09 로 물러앉힌다.
    카드시접 = 0.13
    cw, ch = 1.25 - 카드시접, 카드세로 - 카드시접   # 손좌표(1.12/0.72) 를 걷는다 — 세로를 줄이면 실땀이 따라온다
    # 3차: 네 변 따로 → «한 줄로» 걷는다. 간격 0.2 → 0.115 (세로 변이 4땀이던 것이 8땀으로).
    러닝스티치(둥근사각걷기(cw, ch, 0.10, 0.115), 0.40, (0, 0.9),
             카드실, 0.040, 0.0085, 손, 흔들=0.004, 각흔들=4.0)
    # ① 미니 라벨 태그 — 오른 위 (화면의 유일한 오브제 글자·유일한 코랄 = 신호 1점).
    #    2차 명품화 ③: 반듯하게 놓인 라벨은 «붙인 스티커»다 — 공방에서는 시침핀으로 «매단다».
    #    3° 기울이고 위 가운데를 핀이 꿴다(시침핀 부품 문법 재사용).
    #   ⚠라벨을 프레임 위끝에 붙이면 핀머리가 화면 밖으로 나간다(시험 실측) — 매단 것은 «매단 자리»가
    #     보여야 매단 것이다. 2.5 → 2.15 로 내려 핀머리·바늘이 온전히 든다.
    lx, lz = 0.92, 2.15
    기울 = math.radians(-3)
    코, 사 = math.cos(기울), math.sin(기울)

    def 라벨자리(dx, dz):
        """라벨 로컬(dx,dz) → 세계. y축(깊이) 둘레 회전이라 x-z 평면에서 돈다.
        ⚠mathutils.Matrix.Rotation(각, 2, 'Y') 는 2×2 라 3D 벡터에 못 곱한다(시험 실측) — 손으로 돈다."""
        return lx + dx * 코 + dz * 사, lz - dx * 사 + dz * 코

    # 3차: 세로 0.44 → 0.38 («3 / 10» 한 줄에 맞춘 태그) · 크리스 0.42 → 0.55 (모서리 부정형 완화)
    #      깊이 0.32 → 0.44 (배경천에 가까이 = 매달린 것이 천에 «닿아» 있다)
    라벨 = 베개몸((0.26, 0.05, 0.30), 위치=(lx, 0.44, lz), 크리스=0.55, 레벨=4)
    라벨.rotation_euler = (0, 기울, 0)
    라벨.data.materials.append(직물결(매끈재질('라벨천', 색['Oat'], 거칠기=0.88), 지름=1.90))
    라벨실 = 매끈재질('라벨실', 색['Deep Wool'], 거칠기=0.68)   # 실의 광을 살린다 — 0.72 는 «눌린 자국»으로 읽혔다
    lw, lh = 0.175, 0.215

    def 라벨기울(px, pz):
        wx, wz = 라벨자리(px, pz)
        return wx, wz, math.degrees(기울)

    # 간격 0.1 → 0.058: 가로 변이 4땀이던 것이 8땀으로. 「뚝뚝 끊김」의 절반은 여기에 있었다.
    러닝스티치(둥근사각걷기(lw, lh, 0.070, 0.046), 0.39, (0, 0), 라벨실, 0.021, 0.0085,
             손, 흔들=0.0025, 각흔들=3.5, 기울fn=라벨기울)
    강조 = 매끈재질('진행실', 색['Coral 3'], 거칠기=0.6)
    gx, gz = 라벨자리(-0.072, 0.01)
    유리글자('3', 0.145, (gx, 0.385, gz), 강조, 돌출=0.006, 베벨=0.002).rotation_euler = (math.radians(90), 0, 기울)
    bx, bz = 라벨자리(0.060, 0.0)
    유리글자('/ 10', 0.078, (bx, 0.388, bz), 라벨실, 돌출=0.005, 베벨=0.002).rotation_euler = (math.radians(90), 0, 기울)
    # 시침핀 — 3차 재설계(유호 08-21 「사탕인지 핀인지 뭔지 너무 부자연스럽다」).
    #   2차가 사탕으로 읽힌 세 까닭: ①머리가 크고(r 0.062 = 라벨 반폭의 18%) ②염료색 + 거칠기 0.14 라
    #   **화면에서 가장 밝은 점**이 됐고(4계 ② 위반 — 신호 코랄은 「3」 하나여야 한다) ③바늘이 라벨을
    #   «관통»하지 않고 앞면에 얹혀 막대사탕의 막대가 됐다.
    #   → 머리를 절반 아래로 줄이고 무채(Stone)로 내리고, 꽂는 자리를 라벨 «가장자리»로 옮겨
    #     바늘이 천으로 들어가는 지점이 보이게 한다. 중앙이 아니라 살짝 왼쪽 = 손으로 꽂은 자리.
    if 핀:
        핀x, 핀z = 라벨자리(-0.05, 0.30)
        # ⚠2차·3차 시험 모두 바늘이 라벨 «앞»에 떠 막대사탕이 됐다. 깊이(y)를 라벨 뒷면 너머로 보내고
        #   화면 평면에 눕혀야(x회전 68° → 20°) 아래끝이 천에 숨고 «꽂힌 길이»가 보인다.
        bpy.ops.mesh.primitive_cylinder_add(radius=0.008, depth=0.19, location=(핀x, 0.47, 핀z - 0.02),
                                            rotation=(math.radians(20), 0, math.radians(-15)))
        바늘 = bpy.context.object
        bpy.ops.object.shade_smooth()
        바늘.data.materials.append(매끈재질('핀바늘', 색['Stone'], 거칠기=0.25))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.027, location=(핀x - 0.0084, 0.439, 핀z + 0.069))
        핀머리 = bpy.context.object
        bpy.ops.object.shade_smooth()
        핀머리.data.materials.append(매끈재질('핀머리', 색['Stone'], 거칠기=0.30))
    # ③ 보기 알약 3 — 무광 펠트 버튼(털 없음 — 버튼은 조용해야 한다 · 상태 표시는 HTML 층).
    #    Deep Wool 은 이 키 아래서 카드보다 밝게 떠 위계가 뒤집혔다(시험 실측) — 카드와 같은 Ink 로.
    # 3차: 카드가 낮아지자 카드-알약 틈(0.41)이 알약끼리의 틈(0.22)의 두 배가 돼 리듬이 끊겼다.
    #   틈을 하나로 맞춰 올린다 — 덤으로 마지막 알약이 화면 바닥의 힌트를 밀치던 것도 풀린다.
    for 번, z in enumerate((-0.16, -0.86, -1.56)):
        알 = 베개몸((0.95, 0.1, 0.24), 위치=(0, 0.55, z), 크리스=알약각)
        칸들['알약%d' % (번 + 1)] = 알     # 보기 글자도 자기 그릇에 묻는다 — 알약을 옮기면 글이 따라온다
        알.data.materials.append(직물결(매끈재질('알약천', 색['Ink'], 거칠기=0.95), 규모=160.0, 세기=0.04))
        키제외.append(알)    # 실측: 가운데 알약에 키 하이라이트가 앉아 3.65:1 — 셋 다 가라앉힌다
    return (0, -12.0, 0.35), 90


def 넘버쿠키():
    """넘버 쿠키 — 번호의 플레이팅판(유호 아이디어 08-21 「번호도 음식 플레이팅 방식으로」).
    접시 위 펠트 쿠키에 자수 숫자 — 절번호·단락 머리·페이지 표식이 서는 자리의 «음식» 변주.
    숫자는 자수글자와 같은 통로(리메시 + 퍼 + 새틴 땀 · 함정 ① 그대로) — 「본문=」 으로 01~10.
    쿠키 도우 = Butter Soft(기쁨·보상의 실) · 숫자 = 염료이름(기본 Coral · 신호 1점)."""
    음식접시('Ink')
    bpy.ops.mesh.primitive_cylinder_add(radius=0.74, depth=0.26, location=(0, 0, 0.14), vertices=96)
    쿠키 = bpy.context.object
    bv = 쿠키.modifiers.new('bv', 'BEVEL')
    bv.width = 0.11
    bv.segments = 4
    bpy.ops.object.modifier_apply(modifier='bv')
    bpy.ops.object.shade_smooth()
    # 🔑 **털 위에 털을 올리면 뭉갠다** — 이 공방에서 세 번 겪은 같은 병이다(만두 도우 · 김밥 밥 ·
    #    그리고 여기). 밀도(22000→8000)도 높이(여유 0.096)도 맞췄는데 숫자가 여전히 «분홍 얼룩»이었다:
    #    까닭은 계산이 아니라 **대비**다. 채택판 자수글자가 사는 것은 «매끈한 밤천 위의 털»이라서다.
    #    ⇒ 쿠키는 무광 펠트 면으로 두고, 털은 숫자에만 남긴다. 대비가 서면 글자가 산다.
    쿠키.data.materials.append(직물결(분필재질('쿠키', 색['Butter Soft']), 지름=1.48, 세기=0.7))
    # 숫자 몸 — 눕혀서 쿠키 윗면에(음식 카메라는 내려보므로 글자가 하늘을 본다)
    본문 = 인자.get('본문', '01')
    bpy.ops.object.text_add()
    t = bpy.context.object
    t.data.body = 본문
    글자체(t)
    t.data.size = 0.98                   # 0.66·0.86 은 «얼룩»이었다 — 숫자가 쿠키를 거의 채워야 읽힌다
    t.data.extrude = 0.026
    t.data.bevel_depth = 0.005
    t.data.bevel_resolution = 3
    t.data.align_x = 'CENTER'
    t.data.align_y = 'CENTER'
    # 🔴 «투영 기어듦» — 내려보는 카메라에서 띄운 물건은 먼 쪽으로 밀려 보인다(룸장면 6판이 배지
    #    가림에서 겪은 그 셈). 숫자는 쿠키 중심면(0.14)보다 0.152 높으니 화면에서 0.152 ×
    #    (sin40/cos40) = 0.127 만큼 위로 밀린다 — 그만큼 카메라 쪽으로 당겨 앉힌다.
    민 = 0.127
    t.location = (0, -민, 0.292)          # 앞면 = 0.292+0.026+0.005 = 0.323 (매끈 쿠키 윗면 0.27 위)
    bpy.ops.object.convert(target='MESH')
    rm = t.modifiers.new('리메시', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = 0.018                            # 함정 ① — 텍스트 메시에 바로 퍼를 심지 않는다
    bpy.ops.object.modifier_apply(modifier='리메시')
    bpy.ops.object.shade_smooth()
    짧은퍼(t, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]),
          길이=0.009, 개수=3000)
    tps = t.particle_systems[-1].settings
    tps.clump_factor = 0.5
    tps.roughness_1 = 0.03
    tps.roughness_2 = 0.04
    tps.tip_radius = 0.007
    # 새틴 땀 — 글리프 평면 (px,py) 을 눕는 평면 (x, y, z고정) 으로. 진행각은 회전z 가 진다.
    실재 = 매끈재질('테두리실', 색['Stitch'], 거칠기=0.5)
    손 = random.Random(20260821)
    for (px, py, 각) in 글자곡선표본(본문, 0.98, 간격=0.095):
        땀하나(px + 손.uniform(-0.003, 0.003), py - 민 + 손.uniform(-0.003, 0.003),
              0.327, 0.046 * 손.uniform(0.88, 1.12), 0.017, 실재,   # 숫자 앞면 0.323 에 걸터앉는다
              회전y=0, 회전z=각 + 손.uniform(-8, 8))
    # 🔴 본판 실측 08-22 둘: ①59°(수평에서 31° 위)는 털 «테두리»가 가운데를 가려 숫자가 안 보였다
    #    — 만두·김밥·붕어빵은 40°로 올렸는데 이 형태만 남아 있었다. ②거리 8.8 에서 0.86 짜리 숫자는
    #    화면에서 백 몇 픽셀뿐이라 자수 땀이 뭉갠다. 채택판 자수글자는 글자가 화면의 절반을 먹는다
    #    — 접시 테가 조금 잘려도 «당기는» 쪽이 맞다(귤 주석의 「당길수록 픽셀 밀도가 선명을 산다」).
    return (0, -4.37, 5.21), 40

# ── 도안 공방 — «점 목록»이 곧 형태다 (08-22 · 유호 「전부 해줘」) ─────────────────
# 왜 형태 함수를 하나씩 안 짓나: 체크·별·하트·집·책·차트·사람·말풍선·붕어빵은 전부 «오려 붙인
#   펠트 조각»이다 — 다른 것은 윤곽뿐이다. 통로를 하나로 두면 새 도안이 «점 한 줄»로 는다.
#   (요소가 늘 때마다 굽기 함수가 늘면, 조명·실땀·리메시 규율이 판마다 갈린다 — 그게 진짜 비용이다.)

def 자리맞춤(고리들, 폭, 높):
    """도안(고리 목록)을 원점 중심 «폭×높» 상자에 비율 유지로 앉힌다(폭·높은 지름이지 반지름이 아니다).
    도안마다 좌표계를 손으로 맞추면 판마다 크기가 튄다 — 상자 하나가 그걸 없앤다."""
    xs = [p[0] for g in 고리들 for p in g]
    ys = [p[1] for g in 고리들 for p in g]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    배 = min(폭 / max(1e-6, max(xs) - min(xs)), 높 / max(1e-6, max(ys) - min(ys)))
    return [[((x - cx) * 배, (y - cy) * 배) for (x, y) in g] for g in 고리들]

def 옮김(고리, dx, dy):
    return [(x + dx, y + dy) for (x, y) in 고리]

def 획폴리곤(중심선, 반폭):
    """열린 중심선 → 닫힌 «획» 폴리곤(마이터 이음). 체크처럼 «그은 선»이 그대로 몸이 되는 도안용.
    마이터가 없으면 꺾이는 자리에서 획이 얇아져 «부러진 실»로 읽힌다 — 늘림은 2.6배에서 자른다
    (예각에서 마이터가 발산한다)."""
    P = [complex(x, y) for x, y in 중심선]
    법 = []
    for i in range(len(P) - 1):
        d = P[i + 1] - P[i]
        법.append(complex(-d.imag, d.real) / abs(d))
    def 옆(부호):
        점 = [P[0] + 부호 * 반폭 * 법[0]]
        for i in range(1, len(P) - 1):
            m = 법[i - 1] + 법[i]
            if abs(m) < 1e-6:
                점.append(P[i] + 부호 * 반폭 * 법[i - 1])
                continue
            m /= abs(m)
            늘 = min(2.6, 1.0 / max(0.38, m.real * 법[i].real + m.imag * 법[i].imag))
            점.append(P[i] + 부호 * 반폭 * m * 늘)
        점.append(P[-1] + 부호 * 반폭 * 법[-1])
        return 점
    한, 반 = 옆(1), 옆(-1)
    return [(p.real, p.imag) for p in 한] + [(p.real, p.imag) for p in reversed(반)]

def 둥근사각폴리곤(반폭, 반높, 라운드, 마디=7):
    """닫힌 둥근 사각 — 「둥근사각걷기」(땀 자리)의 «몸» 짝. 둘이 같은 수식을 쓰니 땀이 몸을 안 벗어난다."""
    r = max(0.0, min(라운드, 반폭, 반높))
    점 = []
    for (cx, cy, a0) in ((반폭 - r, -(반높 - r), 270), (반폭 - r, 반높 - r, 0),
                         (-(반폭 - r), 반높 - r, 90), (-(반폭 - r), -(반높 - r), 180)):
        for i in range(마디 + 1):
            a = math.radians(a0 + 90.0 * i / 마디)
            점.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return 점

def 원폴리곤(반지름, n=40, 중심=(0.0, 0.0), 뒤집=False):
    cx, cy = 중심
    각들 = [2 * math.pi * i / n for i in range(n)]
    if 뒤집:
        각들 = 각들[::-1]          # 구멍 고리는 반대로 감는다(짝수-홀수 채우기라 실은 무관하나, 뜻을 남긴다)
    return [(cx + 반지름 * math.cos(a), cy + 반지름 * math.sin(a)) for a in 각들]

def 아플리케(고리들, 색이름, 두께=0.022, 베벨=0.008, 자리=(0.0, 0.0), 높이=0.0, 눕힘=False,
           털길이=0.022, 털수=9000, 리메시=0.018, 뭉침=0.35, 재질=None):
    """도안 → «오려 붙인 펠트 조각». 자수글자와 같은 통로다:
      2D 곡선을 두께 있는 몸으로 세우고 → 복셀 리메시 → 보풀(함정 ① — 곡선/텍스트 메시에 바로
      퍼를 심으면 법선·밀도가 들쭉날쭉해 털이 제멋대로 뻗친다).
    고리 여럿: 겹치지 않으면 각각 «조각»(차트 막대 셋), 안에 들면 «구멍»(도장 테) — 짝수-홀수 채우기.
    눕힘=True 는 음식 카메라(내려보기)용 — 도안 평면이 세계 xy 로 눕는다. False 면 세계 xz(정면).
    털수=0 은 «다린 아플리케»(보풀 없는 눌린 조각 — 도장·글레이즈 문법)."""
    cu = bpy.data.curves.new('도안', 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.extrude = 두께
    cu.bevel_depth = 베벨            # 모서리가 둥글어야 빛을 물어 «오려 붙인 천»이 된다(각지면 아크릴)
    cu.bevel_resolution = 3
    for 고리 in 고리들:
        sp = cu.splines.new('POLY')
        sp.points.add(len(고리) - 1)
        for i, (x, y) in enumerate(고리):
            sp.points[i].co = (x, y, 0, 1)
        sp.use_cyclic_u = True
    o = bpy.data.objects.new('아플리케', cu)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')
    조각 = bpy.context.object
    if 리메시:
        rm = 조각.modifiers.new('리메시', 'REMESH')
        rm.mode = 'VOXEL'
        rm.voxel_size = 리메시
        bpy.ops.object.modifier_apply(modifier='리메시')
    bpy.ops.object.shade_smooth()
    # 극 +z(돌출) → 세계 -y = 카메라 쪽(유리글자와 같은 규약). 눕히면 돌출이 하늘을 본다.
    조각.rotation_euler = (0, 0, 0) if 눕힘 else (math.radians(90), 0, 0)
    조각.location = (자리[0], 자리[1], 높이) if 눕힘 else (자리[0], -높이, 자리[1])
    if 털수:
        짧은퍼(조각, 색이름, 살재질(색이름, 색[색이름]), 털재질(색이름, 색[색이름]),
              길이=털길이, 개수=털수)
        ps = 조각.particle_systems[-1].settings   # 채택판 자수글자와 «같은 털» — 값이 갈리면 세계가 갈린다
        ps.clump_factor = 뭉침
        ps.roughness_1 = 0.03
        ps.roughness_2 = 0.04
        ps.rendered_child_count = ps.child_percent = 40
    elif 재질:
        조각.data.materials.append(재질)              # 잉크·글레이즈처럼 «천이 아닌» 조각
    else:
        조각.data.materials.append(직물결(매끈재질('조각_' + 색이름, 색[색이름], 거칠기=0.94),
                                       규모=190.0, 세기=0.55))
    return 조각

def 고리걷기(고리, 간격):
    """닫힌 고리를 «한 줄로» 균일 간격으로 걷는다 → [(x, y, 진행각도°), ...].
    둥근사각걷기의 임의 도안판 — 그 함수가 3차 명품화에서 배운 것(변마다 따로 반올림하면
    짧은 변이 3~4땀으로 끊긴다)을 도안 전체에 그대로 적용한다."""
    n = len(고리)
    변, 총 = [], 0.0
    for i in range(n):
        x0, y0 = 고리[i]
        x1, y1 = 고리[(i + 1) % n]
        d = math.hypot(x1 - x0, y1 - y0)
        변.append((x0, y0, x1, y1, d, 총))
        총 += d
    수 = max(6, int(round(총 / 간격)))
    걸음 = 총 / 수
    자리, k = [], 0
    for j in range(수):
        s = (j + 0.5) * 걸음
        while k < n - 1 and s > 변[k][5] + 변[k][4]:
            k += 1
        x0, y0, x1, y1, d, 시작 = 변[k]
        u = 0.0 if d < 1e-9 else min(1.0, (s - 시작) / d)
        자리.append((x0 + (x1 - x0) * u, y0 + (y1 - y0) * u,
                   math.degrees(math.atan2(y1 - y0, x1 - x0))))
    return 자리

def 윤곽땀(고리들, 재질, 손, 간격=0.078, 깊이=0.0, 땀=0.038, 굵기=0.014, 눕힘=False,
         흔들=0.004, 각흔들=6.0):
    """도안 윤곽을 실땀이 한 바퀴 감는다 — **DESIGN.md 운용 규칙 ②**(실땀은 모든 펠트 오브젝트의
    테두리)의 도안 일반화. 오브 명품화 ④에서 배운 그 한 줄이 «사람이 만든 것»을 가른다.
    깊이 = 면에서 바깥 법선 쪽 거리(세우면 -y, 누우면 +z)."""
    for 고리 in 고리들:
        for (x, y, 각) in 고리걷기(고리, 간격):
            jx = x + 손.uniform(-흔들, 흔들)
            jy = y + 손.uniform(-흔들, 흔들)
            길 = 땀 * 손.uniform(0.9, 1.1)
            흔 = 손.uniform(-각흔들, 각흔들)
            if 눕힘:
                땀하나(jx, jy, 깊이, 길, 굵기, 재질, 회전y=0, 회전z=각 + 흔)
            else:
                땀하나(jx, -깊이, jy, 길, 굵기, 재질, 회전y=-(각 + 흔))

def 하트도안():
    점 = []
    for i in range(56):
        t = 2 * math.pi * i / 56
        점.append((16 * math.sin(t) ** 3,
                  13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)))
    return 점

def 별도안():
    return [(r * math.cos(math.pi / 2 + i * math.pi / 5), r * math.sin(math.pi / 2 + i * math.pi / 5))
            for i, r in ((i, 0.62 if i % 2 == 0 else 0.265) for i in range(10))]

def 사람몸도안():
    점 = [(0.46, -0.56)]
    for i in range(16):                       # 어깨 — 반타원(사람 글리프의 «둥근 어깨»)
        a = math.pi * i / 15
        점.append((0.46 * math.cos(a), -0.16 + 0.30 * math.sin(a)))
    점.append((-0.46, -0.56))
    return 점

def 붕어도안():
    점 = []
    for i in range(37):                       # 몸 — 타원 150°→-150°(왼쪽 쐐기는 꼬리가 맡는다)
        a = math.radians(150 - 300 * i / 36)
        점.append((0.92 * math.cos(a), 0.50 * math.sin(a)))
    점 += [(-1.22, -0.60), (-1.02, 0.0), (-1.22, 0.60)]    # 갈래 꼬리
    return 점

def 말풍선도안():
    몸 = 둥근사각폴리곤(0.68, 0.42, 0.20)      # 바닥 변이 «닫는 선»이라 꼬리를 그 자리에 끼운다
    return 몸 + [(-0.34, -0.42), (-0.28, -0.80), (-0.04, -0.42)]

도안들 = {
    '체크':   lambda: [획폴리곤([(-0.60, 0.08), (-0.18, -0.36), (0.62, 0.54)], 0.16)],
    '별':     lambda: [별도안()],
    '하트':   lambda: [하트도안()],
    '집':     lambda: [[(-0.62, 0.08), (0.0, 0.68), (0.62, 0.08), (0.44, 0.08),
                       (0.44, -0.56), (-0.44, -0.56), (-0.44, 0.08)]],
    '책':     lambda: [[(-0.66, 0.14), (-0.33, 0.30), (0.0, 0.16), (0.33, 0.30), (0.66, 0.14),
                       (0.66, -0.16), (0.33, -0.24), (0.0, -0.34), (-0.33, -0.24), (-0.66, -0.16)]],
    '차트':   lambda: [옮김(둥근사각폴리곤(0.17, 0.24, 0.09), -0.40, -0.30),
                      옮김(둥근사각폴리곤(0.17, 0.46, 0.09), 0.0, -0.08),
                      옮김(둥근사각폴리곤(0.17, 0.34, 0.09), 0.40, -0.20)],
    '사람':   lambda: [원폴리곤(0.235, 28, (0.0, 0.46)), 사람몸도안()],
    '말풍선': lambda: [말풍선도안()],
}

def 기호():
    """기호 아플리케 — 체크·별·하트·집·책·차트·사람·말풍선(「기호=」).
    앱에서 가장 자주 보는 픽셀들이다: 정답 체크·보상 별·좋아요 하트·하단 탭 넷·힌트 말풍선.
    밤천 위 신호 1점(염료이름) + 실땀 테두리 — 오브·와펜과 같은 서명(철칙 ④ 주연 1실).
    새 기호를 더하려면 「도안들」에 점 목록 한 줄이면 된다 — 이 함수는 안 갈린다."""
    이름 = 인자.get('기호', '체크')
    if 이름 not in 도안들:
        raise SystemExit('모르는 기호: ' + 이름 + ' — 아는 것은 ' + '·'.join(도안들))
    고리들 = 자리맞춤(도안들[이름](), 1.28, 1.28)
    밤판()
    # 두께·높이·땀은 채택판 자수글자의 «같은 수»다(글자 앞면 0.099 · 땀 0.101 — 표면에 걸터앉음).
    # 조각 앞면 = 0.075 + 0.022 + 0.008 = 0.105 → 땀 0.109 로 같은 관계를 만든다(눈보다 계산 · 4계 ④).
    아플리케(고리들, 염료이름, 두께=0.022, 베벨=0.008, 높이=0.075)
    윤곽땀(고리들, 매끈재질('테두리실', 색['Stitch'], 거칠기=0.5), random.Random(20260822),
         간격=0.105, 깊이=0.109, 땀=0.046, 굵기=0.018)
    return (0, -5.4, 0.0), 90

def 도장():
    """참 잘했어요 도장 — 출석·칭찬의 «찍힘»(유호 아이디어 08-22 #7 「찍힌다는 행위 자체가 보상」).
    다린 천(Oat) 위 코랄 인장: 두 겹 원 테 + 가운데 글자(「본문=」 · 기본 「참」).
    ⚠도장은 «잉크가 천에 앉은» 것이라 보풀을 안 심는다 — 털을 심으면 도장이 아니라 뱃지가 된다.
    조명은 스침(압인 문법) — 눌린 자리의 그늘이 «찍혔다»를 만든다."""
    본문 = 인자.get('본문', '참')
    # 잉크는 «깊은» 코랄이다 — 「색=」을 주면 그 색, 안 주면 Coral 3(라벨태그 강조실과 같은 실).
    인장색 = 염료이름 if '색' in 인자 else 'Coral 3'
    바닥 = 밤판()          # 도장만 천 색이 다르다 — 다린 천(Stone) 위의 인장
    바닥.data.materials.clear()
    바닥.data.materials.append(직물결(매끈재질('다린천', 색['Stone'], 거칠기=0.98), 지름=1.96, 촘촘=72.0))
    # 손으로 판 인장 — 반지름을 미세하게 흔든다(완벽한 원은 기계 도장이다).
    손 = random.Random(20260822)
    흔 = lambda r, n: [(math.cos(2 * math.pi * i / n) * (r + 손.uniform(-0.006, 0.006)),
                       math.sin(2 * math.pi * i / n) * (r + 손.uniform(-0.006, 0.006))) for i in range(n)]
    테 = [흔(0.80, 60), 흔(0.712, 60)[::-1]]
    잉크 = 분필재질('잉크', 색[인장색])        # 무광 — 광택이 서면 잉크가 아니라 플라스틱 링이다
    아플리케(테, 인장색, 두께=0.010, 베벨=0.0, 높이=0.060, 털수=0, 리메시=0, 재질=잉크)
    유리글자(본문, 0.60, (0, -0.078, 0.02), 잉크, 돌출=0.010, 베벨=0.002)
    return (0, -5.4, 0.0), 90

def 게이지고리():
    """원형 게이지 — 실이 «감겨» 차오르는 레벨 링(털실진행바의 원형 짝 · 유호 아이디어 08-22 #3).
    12시에서 출발해 시계 방향으로 감긴다 — 채움은 위에서 시작해야 «차오른다»로 읽힌다.
    「진행=0~1」. 트랙은 Deep Wool 펠트 홈, 감긴 실은 기본색 3가닥 꼬임(털실진행바와 같은 실)."""
    진행 = min(1.0, max(0.03, float(인자.get('진행', '0.68'))))
    밤판()                                       # 검은 데 뜨지 않게 — 기호와 같은 판
    큰, 살 = 0.55, 0.085                       # 바깥 = 0.55+0.133+0.052 = 0.735 → 지름 1.47 (판 1.96)
    bpy.ops.mesh.primitive_torus_add(major_radius=큰, minor_radius=살, location=(0, -0.16, 0),
                                     rotation=(math.radians(90), 0, 0),
                                     major_segments=112, minor_segments=20)
    트랙 = bpy.context.object
    bpy.ops.object.shade_smooth()
    짧은퍼(트랙, 'Deep Wool', 살재질('Deep Wool', 색['Deep Wool']),
          털재질('Deep Wool', 색['Deep Wool']), 길이=0.020, 개수=13000)
    트랙.particle_systems[-1].settings.clump_factor = 0.62
    실몸 = 매끈재질('실몸', 색[염료이름], 거칠기=0.85, 배율=0.82)
    N = max(28, int(300 * 진행))
    for st in range(3):                        # 3가닥 꼬임 — 나선 위상 120°씩(털실진행바와 같은 문법)
        curve = bpy.data.curves.new('가닥%d' % st, 'CURVE')
        curve.dimensions = '3D'
        curve.bevel_depth = 0.052
        curve.bevel_resolution = 6
        curve.use_fill_caps = True
        sp = curve.splines.new('POLY')
        sp.points.add(N - 1)
        감 = 살 + 0.048                       # 🔑 실은 트랙 «겉»을 감는다 — 살보다 안쪽이면 파묻힌다
        for i in range(N):
            진각 = 2 * math.pi * 진행 * i / (N - 1)
            a = math.pi / 2 - 진각                                  # 12시 → 시계 방향
            꼬 = 2 * math.pi * (큰 * 진각) / 0.38 + st * 2 * math.pi / 3
            r = 큰 + 감 * math.cos(꼬)                               # 단면 = 반경 방향 × y
            sp.points[i].co = (r * math.cos(a), -0.16 + 감 * math.sin(꼬), r * math.sin(a), 1)
        obj = bpy.data.objects.new('가닥%d' % st, curve)
        bpy.context.collection.objects.link(obj)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')   # 곡선엔 털이 안 심겨 — 메쉬로 바꿔 보풀을 심는다
        bpy.ops.object.shade_smooth()
        짧은퍼(bpy.context.object, 염료이름, 실몸, 털재질(염료이름, 색[염료이름]),
              길이=0.011, 개수=4000)      # 털이 길면 세 가닥 꼬임이 솜으로 뭉친다(2판 실측)
    return (0, -5.4, 0.0), 90

def 만두():
    """펠트 만두 — 플레이팅 3호. **몽골의 부즈와 한국의 만두가 같은 자리에 선다** — 두 나라가
    겹치는 음식이라 우리 교실의 첫 낱말로 값이 있다. 몸 = Stone 무광 초승달 · 주름 = 일곱 겹.

    🔴 1~5판 실측: 도우에 짧은 퍼를 심으면 색(Paper→Oat→Stone)·밀도(34000→6500)·뭉침을
       어떻게 만져도 **흰 솜뭉치**가 됐다. 이 크기·이 카메라에서 헤어는 형태를 못 남긴다.
       ⇒ 털을 걷는다. 찐만두는 원래 «매끈하고 촉촉한» 면이라 무광 면이 오히려 맞다 —
         털은 이 세계의 서명이지만, 서명을 지키느라 물건이 안 읽히면 순서가 뒤집힌 것이다.
       (같은 판정: 김밥 밥도 털을 걷고 무광 면 + 밥알로 갔다.)"""
    음식접시('Ink')
    도우 = 직물결(분필재질('도우', 색['Stone']), 지름=1.44, 세기=0.75)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.62, location=(0, 0.02, 0.34), segments=64, ring_count=32)
    몸 = bpy.context.object
    몸.scale = (1.16, 0.86, 0.72)                # 만두는 앞뒤로 눌리고 옆으로 퍼진 몸
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    굽 = 몸.modifiers.new('굽힘', 'SIMPLE_DEFORM')   # 🔑 초승달 — 달걀 실루엣과 만두를 가르는 한 가지
    굽.deform_method = 'BEND'
    굽.deform_axis = 'Z'
    굽.angle = math.radians(52)
    bpy.ops.object.modifier_apply(modifier='굽힘')
    bpy.ops.object.shade_smooth()
    몸.data.materials.append(도우)
    주름재 = 직물결(분필재질('주름', 색['Oat']), 지름=0.31, 세기=0.6)    # 접힌 마루는 «밝다»
    for i in range(7):                           # 주름 — 마루선을 따라 일곱 겹(홀수라 가운데가 선다)
        u = -1 + 2 * i / 6
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=12,
                                             location=(0.54 * u, -0.11 - 0.06 * u * u, 0.76 - 0.075 * u * u))
        주름 = bpy.context.object
        주름.scale = (0.078, 0.135, 0.165)
        주름.rotation_euler = (0, math.radians(14 * u), math.radians(-16 * u))
        bpy.ops.object.shade_smooth()
        주름.data.materials.append(주름재)
    # 고명 — 부추 두 오라기를 «무리»로(룸장면 3판 실측: 곁들임은 줄이 아니라 무리다).
    부추 = 매끈재질('부추', 색['Meadow'], 거칠기=0.7)
    땀하나(0.62, -0.72, 0.012, 0.26, 0.030, 부추, 회전y=0, 회전z=28)
    땀하나(0.40, -0.86, 0.010, 0.20, 0.026, 부추, 회전y=0, 회전z=-14)
    땀하나(0.80, -0.90, 0.010, 0.15, 0.024, 부추, 회전y=0, 회전z=62)
    return (0, -5.66, 6.74), 40                  # 초승달은 «위»에서 봐야 초승달이다

def 김밥():
    """펠트 김밥 — 플레이팅 4호. 자른 단면 셋이 접시에 눕는다(한국 음식 중 «단면»이 가장 예쁜 것).
    김 = Ink Deep 테 · 밥 = Paper 무광 · 속 = 킷 색 셋(당근 Coral · 시금치 Meadow · 단무지 Butter).
    ⚠단면이 주인공이라 원기둥을 «세워» 뚜껑이 카메라를 향하게 하고, 카메라도 위로 올린다(59°→40°).

    ── 네 판의 실측이 남긴 규율 셋 ──
    🔴 ① 밥에 헤어를 심으면 옆면에서도 뻗어 **김 테를 통째로 덮는다**(1·2판) — 밥알은 털이 아니다.
    🔴 ② 속이 정확히 (0,0,0)으로 렌더됐다(3·4·5판 화소 실측 — 검은 무대라 «구멍»으로 보였다).
         베벨·스무딩·범프를 차례로 의심했지만 **전부 오진**이었다. 진범은 겹침이다:
         김이 «고리»가 아니라 속이 꽉 찬 원기둥이라 밥도 속도 그 «안»에 파묻혀 있었다.
         밥=Coral·김=Lapis 로 칠해 구우니 화면이 통째로 Lapis 였다 — 그것이 판정이다.
         🔑 **보이는 것은 쌓은 순서가 아니라 «높이»가 정한다** — 안 보이면 재질을 만지기 전에
           바깥 물체보다 위로 솟았는지부터 잰다. 색을 갈아 굽는 것이 가장 싼 판정이다.
    🔴 ③ 이 무대에서 Ink 는 «검정»이 아니라 따뜻한 중간 회색(≈150)으로 뜬다 — 접시도 Ink 라
         테가 안 갈렸다. 김은 한 단 더 내린 Ink Deep 이라야 «김»이 된다."""
    음식접시('Ink')
    김재 = 매끈재질('김', 색['Ink Deep'], 거칠기=0.72)
    # 🔴 6판 실측: 분필(스펙큘러 0) + 평평한 뚜껑은 이 키 각도에서 속(구)보다 어둡게 앉았다.
    #    밥은 실제로도 윤기가 조금 있다 — 매끈으로 돌리고 거칠기로만 죽인다.
    밥재 = 직물결(매끈재질('밥', 색['Paper'], 거칠기=0.74), 지름=0.84, 촘촘=44.0, 세기=0.85)
    # 속 넷 — 당근·시금치·단무지·우엉. 단면의 속은 «둥근 알»이 아니라 «누운 막대»다(4판 실측:
    #   동그란 셋은 «신호등»으로 읽혔다). 길이·각도를 저마다 달리해 손으로 만 김밥을 만든다.
    속결 = [('Coral', (1.9, 0.62, 0.40), 0.20, 18),      # 당근 — 가늘고 긴 채
           ('Meadow', (1.5, 0.80, 0.38), 0.19, 104),     # 시금치 — 뭉친 나물
           ('Butter', (1.7, 0.72, 0.42), 0.20, -66),     # 단무지 — 도톰한 막대
           ('Butter Deep', (1.3, 0.55, 0.36), 0.13, 152)]  # 우엉 — 가장 가늘고 어둡다
    손 = random.Random(20260822)

    def 통(반, 깊, 자리, 재, 면=128):
        """굵은 통만 원기둥으로 세운다(⚠규율 ② — 작은 것은 구로). 캡은 «평평하게» 둔다:
        n-gon 캡을 스무딩하면 뚜껑 법선이 옆면과 섞인다. 자른 단면은 원래 평평한 것이 맞다."""
        bpy.ops.mesh.primitive_cylinder_add(radius=반, depth=깊, location=자리, vertices=면)
        o = bpy.context.object
        o.data.materials.append(재)
        return o

    for k, (cx, cy, 돌, 배) in enumerate(((-0.74, 0.14, -9, 1.00), (0.02, -0.20, 6, 0.955),
                                          (0.74, 0.16, 14, 1.035))):   # 손으로 썬 것은 굵기가 다르다
        # ⚠쌓는 순서가 아니라 «높이»가 보이는 것을 정한다: 밥이 김보다 **위로** 올라와야
        #   위에서 밥이 보이고, 김은 그 둘레의 테로 남는다(김 0.300 · 밥 0.335 · 테 폭 0.080).
        통(0.500 * 배, 0.42, (cx, cy, 0.090), 김재)         # 김 윗면 0.300
        통(0.420 * 배, 0.47, (cx, cy, 0.100), 밥재)         # 밥 윗면 0.335 — 김보다 0.035 위로 솟는다
        for j, (색이름, 결, 거리, 눕각) in enumerate(속결):
            a = math.radians(74 + 92 * j + 돌 * 2.2)
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.088, segments=28, ring_count=14,
                location=(cx + 거리 * 배 * math.cos(a), cy + 거리 * 배 * math.sin(a), 0.334))
            속 = bpy.context.object
            속.scale = 결                                     # 누운 막대 = 자른 속의 단면
            속.rotation_euler = (0, 0, math.radians(눕각 + 돌))
            bpy.ops.object.shade_smooth()
            속.data.materials.append(매끈재질('속%d_%d' % (k, j), 색[색이름], 거칠기=0.86))
        for _ in range(9):                                   # 밥알 몇 톨 — 무광 면만으로는 «찰흙»이다
            a = 손.uniform(0, 2 * math.pi)
            r = 손.uniform(0.05, 0.33) * 배
            땀하나(cx + r * math.cos(a), cy + r * math.sin(a),
                  0.349, 0.030, 0.019,
                  매끈재질('밥알', 색['Oat'], 거칠기=0.62), 회전y=0, 회전z=손.uniform(0, 180))
    return (0, -5.66, 6.74), 40      # 단면이 주인공이라 더 위에서 — 59°는 세운 뚜껑을 거의 못 본다

def 붕어빵():
    """펠트 붕어빵 — 플레이팅 5호. 겨울 길거리의 얼굴이자 우리 교실의 낱말.
    몸 = Butter 보풀 아플리케(눕힘) · 눈 = Ink 점 · 테두리 = Stitch 실 — 붕어빵 틀의 «집게 자국»이
    실땀으로 읽힌다(운용 규칙 ②가 여기서는 형태의 뜻이 된다)."""
    음식접시('Ink')
    고리들 = 자리맞춤([붕어도안()], 1.66, 0.98)
    아플리케(고리들, 'Butter', 두께=0.072, 베벨=0.026, 높이=0.085, 눕힘=True,
           털길이=0.016, 털수=17000, 리메시=0.015, 뭉침=0.62)             # 윗면 = 0.085+0.098 = 0.183
    손 = random.Random(20260822)
    윤곽땀(고리들, 매끈재질('집게실', 색['Stitch'], 거칠기=0.5), 손,
         간격=0.085, 깊이=0.186, 땀=0.044, 굵기=0.016, 눕힘=True)
    아플리케([원폴리곤(0.058, 20, (0.42, 0.13))], 'Ink', 두께=0.014, 베벨=0.004,
           높이=0.196, 눕힘=True, 털수=0, 리메시=0)                       # 눈 — 한 점
    for i in range(3):                             # 지느러미 결 셋 — 몸통 위 짧은 실금
        땀하나(-0.10 + 0.20 * i, -0.02 - 0.05 * i, 0.188, 0.10, 0.014,
              매끈재질('결%d' % i, 색['Butter Soft'], 거칠기=0.6), 회전y=0, 회전z=74)
    return (0, -5.66, 6.74), 40      # 붕어빵은 «옆»이 아니라 «위»에서 봐야 붕어다

def 떡볶이():
    """펠트 떡볶이 — 플레이팅 6호. 학생이 한국 음식에서 **가장 먼저 배우는 낱말**이다.
    🔑 소스가 킷의 코랄(Coral 3)이라는 것 — 이 음식만은 브랜드 색이 «음식 색»과 같다.
       그래서 다른 음식처럼 신호를 따로 안 준다: 접시 전체가 이미 한 점이다.
    떡은 매끈(쫀득)이고 어묵은 보풀(결) — **결의 대비**가 둘을 가른다(슬라이더에서 배운 그 손잡이)."""
    음식접시('Ink')
    손 = random.Random(20260822)
    # 소스 — 접시에 담긴 낮은 원판. 떡이 «잠겨» 보여야 국물 음식이 된다.
    bpy.ops.mesh.primitive_cylinder_add(radius=1.16, depth=0.18, location=(0, 0.06, 0.06), vertices=96)
    소스 = bpy.context.object
    bev = 소스.modifiers.new('bev', 'BEVEL'); bev.width = 0.05; bev.segments = 3
    bpy.ops.object.shade_smooth()
    소스.data.materials.append(직물결(매끈재질('소스', 색['Coral 3'], 거칠기=0.62), 지름=2.32, 세기=0.5))
    떡재 = 직물결(매끈재질('떡', 색['Stitch'], 거칠기=0.74), 지름=0.34, 세기=0.75)
    # 떡 여섯 — 눕힌 원기둥. 각도를 흩어야 «쏟아 놓은 것»이 된다(줄 세우면 진열이다).
    for x, y, 각 in ((-0.44, 0.30, 24), (0.10, 0.44, -38), (0.56, 0.16, 62),
                     (-0.52, -0.24, -18), (0.02, -0.10, 78), (0.44, -0.40, 12)):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.135, depth=0.60,
                                            location=(x, y + 0.06, 0.20), vertices=32,
                                            rotation=(math.radians(90), 0, math.radians(각)))
        떡 = bpy.context.object
        b = 떡.modifiers.new('bev', 'BEVEL'); b.width = 0.055; b.segments = 5
        bpy.ops.object.shade_smooth()
        떡.data.materials.append(떡재)
    # 어묵 두 조각 — 납작한 판.
    #   ⚠1판은 여기에 보풀을 심어 «결 대비»를 노렸는데 **베이지 얼룩**이 됐다(실측): 작은 조각의
    #     짧은 털은 형태를 흐리기만 한다. 떡과의 구별은 결이 아니라 **색·모양**이 진다
    #     — 흰 원기둥 vs 노란 납작판. 큰 물건에서 값을 하던 손잡이가 작은 물건에서는 독이다.
    어묵재 = 직물결(매끈재질('어묵', 색['Butter']), 지름=0.62, 세기=0.7)
    for x, y, 각 in ((-0.10, 0.50, 32), (0.50, -0.06, -24)):
        어 = 베개몸((0.30, 0.34, 0.028), 위치=(x, y + 0.06, 0.20), 회전z=각, 크리스=0.80)
        어.data.materials.append(어묵재)
    # 파 — 초록 한 점 셋(음식 사진의 «마지막 한 점»)
    for i in range(3):
        땀하나(-0.30 + 0.42 * i + 손.uniform(-0.05, 0.05), 손.uniform(-0.30, 0.50) + 0.06,
              0.235, 0.055, 0.022, 매끈재질('파%d' % i, 색['Meadow'], 거칠기=0.6),
              회전y=손.uniform(0, 180), 회전z=손.uniform(-30, 30))
    return (0, -7.4, 4.7), 59


def 호떡():
    """펠트 호떡 — 플레이팅 7호. 붕어빵의 **겨울 짝**이다(같은 길거리·같은 계절의 낱말).
    ⚠붕어빵은 «위에서» 봐야 붕어였는데 호떡도 같다 — 옆에서 보면 그냥 원반이다.
    구운 자국은 색이 아니라 **눌린 자리의 그늘**로 낸다(도장에서 배운 압인 문법)."""
    음식접시('Ink')
    손 = random.Random(20260822)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.80, location=(0, 0.06, 0.10), segments=56, ring_count=28)
    몸 = bpy.context.object
    몸.scale = (1.0, 1.0, 0.30)                     # 눌러 구운 반죽
    bpy.ops.object.shade_smooth()
    짧은퍼(몸, 'Butter', 살재질('호떡', 색['Butter']), 털재질('호떡', 색['Butter']),
          길이=0.020, 개수=26000)
    ps = 몸.particle_systems[-1].settings
    ps.clump_factor = 0.66
    ps.root_radius = 0.020
    # 🔴**1판은 여기서 통째로 실패했다 — 자국도 꿀도 렌더에 한 픽셀도 안 나왔다.**
    #   까닭은 하나: 표면 높이를 안 재고 «눈대중 0.25»에 얹었다. 실제 표면은
    #     몸 윗면 = 0.10 + 0.80×0.30 = 0.34, 거기에 털 0.020 → **0.36**.
    #   ⇒ 0.25 는 반죽 «속»이었다. 4계 ④(눈보다 계산)를 어긴 자리다.
    표면 = 0.10 + 0.80 * 0.30 + 0.020
    # 구운 자국 — 눌린 원 셋. 돔이라 가운데가 가장 높으니 자국도 가운데로 모은다.
    for r, x, y in ((0.26, -0.14, 0.08), (0.17, 0.22, -0.10), (0.11, 0.06, 0.26)):
        아플리케([원폴리곤(r, 24, (x, y + 0.06))], 'Butter Deep', 두께=0.012, 베벨=0.004,
               높이=표면 - 0.004, 눕힘=True, 털수=0, 리메시=0)
    # 꿀 — 옆으로 조금 흘러나온 한 줄(꿀이 «보여야» 호떡이다). 가장자리는 돔이 낮으니 조금 내린다.
    for i in range(5):
        땀하나(0.34 + 0.10 * i, -0.30 + 0.06 * i + 0.06, 표면 - 0.055 - 0.018 * i, 0.080, 0.030,
              매끈재질('꿀%d' % i, 색['Butter Deep'], 거칠기=0.35), 회전y=손.uniform(-8, 8), 회전z=-28)
    return (0, -5.66, 6.74), 40


def 라면():
    """펠트 라면 — 플레이팅 8호. 국물 음식의 대표이고 몽골 학생에게도 낯설지 않은 자리다.
    🔑 면을 «실»로 뽑는다 — 이 세계에서 국수는 실이다(도넛의 스프링클이 실인 것과 같은 농담).
       끊기면 안 되는 실은 곡선으로 뽑는다(실가닥 주석)."""
    음식접시('Ink')
    손 = random.Random(20260822)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.18, depth=0.20, location=(0, 0.06, 0.06), vertices=96)
    국물 = bpy.context.object
    b = 국물.modifiers.new('bev', 'BEVEL'); b.width = 0.05; b.segments = 3
    bpy.ops.object.shade_smooth()
    국물.data.materials.append(직물결(매끈재질('국물', 색['Coral 3'], 거칠기=0.58), 지름=2.36, 세기=0.45))
    면재 = 매끈재질('면', 색['Butter Soft'], 거칠기=0.62)
    # 면 — «둥지»로 쌓는다.
    #   ⚠1판은 아홉 가닥을 접시 전체에 흩어 **거미줄**이 됐다(실측). 국수는 흩어진 선이 아니라
    #     건져 올려 «뭉친» 덩어리다 — 그래서 ①가닥을 두 배로 ②굵게 ③중심 반경을 좁혀 겹치게 한다.
    for k in range(18):
        기울 = 손.uniform(-3.14, 3.14)
        중심 = (손.uniform(-0.20, 0.20) - 0.14, 손.uniform(-0.18, 0.18) + 0.06)
        반 = 0.34 + 0.028 * (k % 7)
        점 = []
        for i in range(26):
            t = math.pi * 1.25 * (i / 25) + 기울
            점.append((중심[0] + 반 * math.cos(t), 중심[1] + 반 * 0.74 * math.sin(t),
                       0.19 + 0.10 * math.sin(math.pi * i / 25) + 0.012 * (k % 5)
                       + 손.uniform(-0.010, 0.010)))
        실가닥(점, 0.034, 면재, '면%d' % k)
    # 계란 반쪽 — 흰자 위에 노른자 한 점(가장 밝은 것은 하나 · 4계 ②)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.34, location=(0.52, -0.28, 0.24), segments=40, ring_count=20)
    흰 = bpy.context.object
    흰.scale = (1.0, 1.0, 0.42)
    bpy.ops.object.shade_smooth()
    흰.data.materials.append(직물결(매끈재질('흰자', 색['Paper'], 거칠기=0.80), 지름=0.68, 세기=0.7))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.155, location=(0.52, -0.28, 0.35), segments=28, ring_count=14)
    노 = bpy.context.object
    노.scale = (1.0, 1.0, 0.52)
    bpy.ops.object.shade_smooth()
    노.data.materials.append(직물결(매끈재질('노른자', 색['Butter'], 거칠기=0.62), 지름=0.31, 세기=0.8))
    # 파 — 국물 위 초록 넷
    for i in range(4):
        땀하나(손.uniform(-0.62, 0.30), 손.uniform(-0.10, 0.62) + 0.06, 0.30, 0.055, 0.022,
              매끈재질('라파%d' % i, 색['Meadow'], 거칠기=0.6),
              회전y=손.uniform(0, 180), 회전z=손.uniform(-40, 40))
    return (0, -7.4, 4.7), 59


def 김치():
    """펠트 김치 — 플레이팅 9호. 한국 음식의 **이름표**라 없으면 목록이 안 닫힌다.

    🔴 **세 판 걸렸다. 두 번의 실패가 같은 오해에서 나왔다** — 김치를 «색 문제»로 본 것이다.
       1판: 흰 줄기를 붉은 잎 «밑»에 깔았다 → 내려보기 40°에서 통째로 가려 한 색이 됐다.
       2판: 켜를 끝과 끝으로 갈랐다 → 두 색은 보였지만 여전히 **«천 조각»**이었다(유호 판정).
       ⇒ 진짜 원인: **판이 평평했다.** 배춧잎을 배춧잎으로 만드는 것은 색이 아니라 **주름**이다.
         평평한 사각은 아무리 색을 맞춰도 잎이 안 된다 — 잎은 «펴지지 않는 것»이기 때문이다.

    3판의 셋: ①격자 메시에 주름을 넣고(잎끝으로 갈수록 크게) ②잎끝으로 갈수록 넓히고
    ③잎맥을 그 **주름 위에** 앉힌다(같은 식으로 높이를 구해 표면을 따라간다).
    ⚠주름 없는 잎맥은 판을 가로지르는 «줄무늬»가 된다 — 2판에서 실제로 그렇게 읽혔다."""
    음식접시('Ink')
    손 = random.Random(20260822)
    # 🔴**7판 — 접근을 바꿨다.** 6판까지는 «조각을 접시에 늘어놓는» 그림이었고 유호 판정은
    #   「전혀 김치처럼 안 보인다」였다. 형태를 여섯 번 고쳐도 안 됐다면 고칠 것이 형태가 아니다.
    #   ⇒ **재료가 질감을 못 내면 맥락으로 낸다.** 김치는 「접시에 놓인 조각」이 아니라
    #     **「보시기에 담긴 반찬」**으로 읽히는 음식이다. 그릇이 「이건 반찬이다」를 먼저 말하면
    #     그 안의 붉은 것이 김치가 된다 — 펠트가 못 내는 «젖고 구겨진 질감»을 그릇이 대신 진다.
    #   ⚠1판의 보시기는 «흰 원반»이었다 — 림을 바닥과 같은 높이에 둬서 **속이 없었다.**
    #     그릇이 그릇으로 읽히는 조건은 색도 크기도 아니고 **«림이 바닥보다 높다»** 하나다
    #     (음식접시 §3판이 이미 같은 것을 배웠는데 여기서 그 배움을 안 썼다).
    보시기 = 매끈재질('보시기', 색['Paper'], 거칠기=0.86)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.92, depth=0.22, location=(0, 0.06, 0.02), vertices=72)
    사발 = bpy.context.object
    bev = 사발.modifiers.new('bev', 'BEVEL'); bev.width = 0.05; bev.segments = 4
    bpy.ops.object.shade_smooth()
    사발.data.materials.append(직물결(보시기, 지름=1.84, 세기=0.45))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.88, minor_radius=0.145, location=(0, 0.06, 0.17),
                                     major_segments=96, minor_segments=20)
    림 = bpy.context.object
    림.scale = (1.0, 1.0, 0.80)                     # 바닥 0.13 · 림 꼭대기 0.29 — 속이 파인다
    bpy.ops.object.shade_smooth()
    림.data.materials.append(직물결(보시기, 지름=1.76, 세기=0.45))

    잎재 = 직물결(매끈재질('김치잎', 색['Coral 3'], 거칠기=0.68), 지름=0.45, 세기=0.88)
    줄기재 = 직물결(매끈재질('김치줄기', 색['Stitch'], 거칠기=0.78), 지름=0.35, 세기=0.72)
    맥재 = 매끈재질('김치맥', 색['Stitch'], 거칠기=0.60)

    def 주름z(u, w):
        """잎 표면 높이 — u = 길이(−1 줄기 … +1 잎끝) · w = 폭(−1 … +1).
        주름은 **잎끝으로 갈수록 커진다** — 줄기 쪽은 두껍고 빳빳해 거의 안 접힌다."""
        끝 = (u + 1) / 2
        return (0.095 * math.sin(2.9 * w) * 끝 ** 1.4
                + 0.050 * math.sin(4.7 * u + 1.1) * 끝
                + 0.032 * math.cos(3.3 * w + 2.0) * 끝)

    def 폭(u):
        # 잎끝이 넓고 줄기 쪽이 좁다 + 가장자리를 조금 흔든다(자른 배추는 반듯하지 않다).
        return 0.46 + 0.54 * (u + 1) / 2 + 0.055 * math.sin(5.5 * u + 0.7)

    # 보시기 안에 다섯 조각을 «무더기»로 쌓는다 — 반찬은 가지런하지 않다. 높이를 층으로 흩어야
    # 담긴 것으로 읽힌다(한 층에 늘어놓으면 다시 «늘어놓은 조각»이 된다).
    for k, (px, py, 각, s, 층) in enumerate(((-0.34, 0.22, 34, 0.70, 0.00), (0.30, 0.28, -46, 0.64, 0.04),
                                             (-0.28, -0.24, 8, 0.68, 0.08), (0.34, -0.16, -18, 0.62, 0.12),
                                             (-0.02, 0.04, 70, 0.58, 0.17), (0.06, -0.34, 118, 0.55, 0.21),
                                             (-0.16, 0.34, 152, 0.52, 0.25))):
        코, 사 = math.cos(math.radians(각)), math.sin(math.radians(각))
        길, 너 = 0.62 * s, 0.30 * s
        밑 = 0.17 + 층 * 0.8
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=26, y_subdivisions=18, size=2.0,
                                        location=(0, 0, 0))
        잎 = bpy.context.object
        for v in 잎.data.vertices:
            u, w = v.co.x, v.co.y
            v.co.y = w * 폭(u)
            # 줄기 쪽이 «도톰»하다 — 배추 밑동은 두껍고 잎끝은 얇다. 따로 덩이를 놓지 않고
            # 잎 자체를 부풀려 낸다(4판에서 덩이를 놨다가 «각설탕»이 됐다).
            v.co.z = 주름z(u, w) + (0.16 * max(0.0, (-0.28 - u) / 0.72) ** 1.3 if u < -0.28 else 0.0)
        잎.scale = (길, 너, s)
        잎.rotation_euler = (0, 0, math.radians(각))
        잎.location = (px, py + 0.06, 밑)
        두께 = 0.055 * s
        sol = 잎.modifiers.new('sol', 'SOLIDIFY')     # 격자는 두께가 0 이다 — 살을 붙여야 «잎»이 된다
        sol.thickness = 두께
        sol.offset = 0
        bpy.ops.object.shade_smooth()
        # 🔑 **줄기는 «따로 놓은 흰 덩이»가 아니라 같은 잎의 다른 색이다.**
        #   3판은 흰 줄기를 네모난 몸으로 옆에 붙였는데 렌더에서 **«각설탕»**으로 읽혔다(실측).
        #   한 메시에 재질 둘을 걸고 면을 길이로 가르면, 색 경계가 «주름을 따라» 흘러 붙은 것이 된다.
        잎.data.materials.append(잎재)      # 0 = 잎(붉음)
        잎.data.materials.append(줄기재)     # 1 = 줄기(흼)
        for 면 in 잎.data.polygons:
            cx = sum(잎.data.vertices[i].co.x for i in 면.vertices) / len(면.vertices)
            면.material_index = 1 if cx < -0.38 else 0
        # 🔴**흰 덩이(베개몸)는 걷었다.** 4판에서 크리스를 0.98 까지 올려도 «각설탕»이었고,
        #   게다가 그 덩이가 잎의 흰 부분을 통째로 덮어 재질 가르기가 아무 일도 안 하고 있었다.
        #   ⇒ 줄기의 «두께»는 덩이가 아니라 **잎 자체의 부풀림**이 낸다(위 v.co.z 항).
        #     하나의 잎이 밑동에서 두껍고 희며 끝으로 갈수록 얇고 붉어진다 — 그게 배추다.

        # 잎맥 — **이어진 실**이다. 3판은 낱땀으로 놓았더니 고르게 박힌 점선이 되어
        #   오히려 «바느질한 천»으로 읽혔다(유호 판정의 그 인상). 끊기면 안 되는 실은 곡선으로 뽑는다.
        # ⚠8판까지 잎맥이 넷이었는데 «그려 넣은 줄»로 읽혔다 — 규칙적인 흰 선 넷은 자연물이 아니다.
        #   둘로 줄이고 가늘게 한다: 잎맥은 «있다는 것»만 알리면 되고 세는 대상이 아니다.
        for r in (-0.34, 0.30):
            점 = []
            for i in range(16):
                u = -0.52 + 1.24 * i / 15      # 흰 줄기 «다음»에서 시작한다(흰 위 흰 실은 안 보인다)
                w = r * (0.55 + 0.45 * (u + 1) / 2)      # 잎맥도 잎끝으로 갈수록 벌어진다
                lx, ly = u * 길, w * 폭(u) * 너
                점.append((px + lx * 코 - ly * 사, py + 0.06 + lx * 사 + ly * 코,
                           밑 + 주름z(u, w) * s + 두께 * 0.5 + 0.008))
            실가닥(점, 0.0052 * s, 맥재, '맥%d_%d' % (k, int(r * 100)))

        # 고춧가루 — 잎에 앉은 잔 알갱이. **이 갈래에서 마지막까지 없던 신호가 이것이었다**:
        #   주름도 잎맥도 «배춧잎»까지만 말하고, 「양념에 버무렸다」는 알갱이가 말한다.
        #   ⚠흰 줄기에는 안 뿌린다(u > −0.30) — 밑동까지 붉으면 두 색 대비가 다시 무너진다.
        고재 = 매끈재질('고춧가루%d' % k, 색['Coral Rim'], 거칠기=0.52)
        for i in range(16):
            u = 손.uniform(-0.28, 0.92)
            w = 손.uniform(-0.86, 0.86)
            lx, ly = u * 길, w * 폭(u) * 너
            땀하나(px + lx * 코 - ly * 사, py + 0.06 + lx * 사 + ly * 코,
                  밑 + 주름z(u, w) * s + 두께 * 0.5 + 0.006,
                  0.016 * s, 0.011, 고재, 회전y=손.uniform(0, 180), 회전z=손.uniform(0, 180))
    return (0, -5.66, 6.74), 40


def 딸기():
    """펠트 딸기 — 플레이팅 10호. 귤의 **짝**이다(겨울 과일 하나 · 봄 과일 하나).
    ⚠귤과 색이 갈려야 한다 — 귤이 염료(Coral)를 쓰므로 딸기는 **Coral 3**(깊은 붉음)이다.
      같은 코랄이면 둘이 «같은 과일 두 판»으로 읽힌다.
    씨는 눌린 점이 아니라 **박힌 실**이다 — 이 세계의 씨앗은 바느질이다."""
    음식접시('Ink')
    손 = random.Random(20260822)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.62, location=(0, 0.06, 0.50), segments=48, ring_count=24)
    몸 = bpy.context.object
    몸.scale = (1.0, 1.0, 1.12)
    # 아래를 뾰족하게 — 딸기는 «아래로 좁아지는» 구다(구만 두면 사과가 된다)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.transform.vertex_random(offset=0.0)
    bpy.ops.object.mode_set(mode='OBJECT')
    for v in 몸.data.vertices:
        t = max(0.0, min(1.0, (0.70 - v.co.z) / 1.40))      # 아래로 갈수록 좁힌다
        v.co.x *= 1.0 - 0.52 * t ** 1.7
        v.co.y *= 1.0 - 0.52 * t ** 1.7
    bpy.ops.object.shade_smooth()
    짧은퍼(몸, 'Coral 3', 살재질('딸기', 색['Coral 3']), 털재질('딸기', 색['Coral 3']),
          길이=0.022, 개수=30000)
    ps = 몸.particle_systems[-1].settings
    ps.clump_factor = 0.68
    ps.root_radius = 0.020
    # 씨 — 박힌 실 스물. 나선으로 돌려야 «심어진» 것으로 읽힌다.
    for i in range(20):
        a = 2.4 * i
        h = 0.16 + 0.68 * (i / 19)
        r = 0.60 * (1.0 - 0.50 * ((0.90 - h) / 1.20) ** 1.6)
        # ⚠1판은 털 길이(0.022) 안쪽에 앉아 흐렸다 — 겉으로 밀고(0.86→0.95) 굵힌다(0.016→0.022).
        땀하나(r * math.cos(a) * 0.95, r * math.sin(a) * 0.95 + 0.06, 0.20 + h,
              0.040, 0.022, 매끈재질('씨%d' % i, 색['Butter'], 거칠기=0.45),
              회전y=손.uniform(0, 180), 회전z=손.uniform(-40, 40))
    # 꼭지 잎 다섯 — 위에서 방사(귤은 하나, 딸기는 왕관이다)
    for i in range(5):
        a = 2 * math.pi * i / 5
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.26, location=(0.20 * math.cos(a),
                                                                   0.20 * math.sin(a) + 0.06, 1.20))
        잎 = bpy.context.object
        잎.scale = (1.0, 0.34, 0.07)
        잎.rotation_euler = (math.radians(14), math.radians(-18), a)
        bpy.ops.object.shade_smooth()
        짧은퍼(잎, 'Meadow', 살재질('딸잎%d' % i, 색['Meadow']), 털재질('딸잎%d' % i, 색['Meadow']),
              길이=0.014, 개수=2600)
    return (0, -7.4, 4.7), 59


def 바나나우유():
    """펠트 바나나우유 — 플레이팅 11호. 편의점의 얼굴이자 K문화 낱말이고, 음식 목록에서
    **유일한 «마시는 것»**이다(먹는 것만 열 개면 목록이 한 결로 눕는다).
    ⚠단지는 매끈이다 — 보풀을 심으면 «털 난 병»이 된다(털 위에 털 규율의 사촌:
      «재료가 아닌 것에 털을 심지 않는다»). 결은 직물결 범프가 낸다."""
    음식접시('Ink')
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.60, location=(0, 0.06, 0.60), segments=56, ring_count=28)
    단지 = bpy.context.object
    단지.scale = (1.0, 1.0, 1.30)
    # 항아리 허리 — 위아래를 좁혀 «단지»를 만든다(구만 두면 공이다)
    for v in 단지.data.vertices:
        t = abs(v.co.z) / 1.0
        v.co.x *= 1.0 - 0.30 * t ** 2.2
        v.co.y *= 1.0 - 0.30 * t ** 2.2
    bpy.ops.object.shade_smooth()
    단지.data.materials.append(직물결(매끈재질('단지', 색['Butter Soft'], 거칠기=0.72), 지름=1.22, 세기=0.62))
    # 뚜껑 — 은박 대신 Paper 한 겹(킷 밖 금속은 안 쓴다)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.30, depth=0.07, location=(0, 0.06, 1.36), vertices=48)
    뚜 = bpy.context.object
    b = 뚜.modifiers.new('bev', 'BEVEL'); b.width = 0.018; b.segments = 3
    bpy.ops.object.shade_smooth()
    뚜.data.materials.append(직물결(매끈재질('뚜껑', 색['Paper'], 거칠기=0.66), 지름=0.60, 세기=0.7))
    # 빨대 — 이 접시의 신호 한 점(염료). 기울여 꽂혀야 «마시는 중»이 된다.
    bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=1.05, location=(0.20, -0.02, 1.66),
                                        vertices=20, rotation=(math.radians(16), math.radians(20), 0))
    빨 = bpy.context.object
    bpy.ops.object.shade_smooth()
    빨.data.materials.append(매끈재질('빨대', 색[염료이름], 거칠기=0.40))
    return (0, -7.4, 4.7), 59


def 삼겹살():
    """펠트 삼겹살 — 한식 1호(유호 지시 08-22 「삼겹살같은 한식도 퀄리티있게 다양하게」).
    🔑 삼겹살을 삼겹살로 만드는 것은 **켜**다(살↔지방 세 겹). 그런데 내려보기에서는 윗면만 보여
       켜가 사라진다 — 그래서 조각 다섯 중 **둘을 세워** 단면을 카메라로 돌린다(김치에서 배운 그대로).
    석쇠는 그릇이 아니라 «불판»이라 접시천을 Graphite 로 내린다."""
    음식접시('Ink')
    손 = random.Random(20260822)
    불판재 = 직물결(매끈재질('불판', 색['Graphite 3'], 거칠기=0.86), 지름=2.6, 세기=0.5)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.18, depth=0.10, location=(0, 0.06, 0.03), vertices=96)
    불판 = bpy.context.object
    b = 불판.modifiers.new('bev', 'BEVEL'); b.width = 0.03; b.segments = 3
    bpy.ops.object.shade_smooth()
    불판.data.materials.append(불판재)
    살재 = 직물결(매끈재질('살', 색['Coral 3'], 거칠기=0.74), 지름=0.5, 세기=0.7)
    지방재 = 직물결(매끈재질('지방', 색['Stitch'], 거칠기=0.80), 지름=0.4, 세기=0.7)
    구운재 = 매끈재질('구운자국', 색['Graphite 2'], 거칠기=0.62)

    def 켜조각(x, y, 각, 세움=False, s=1.0):
        """살-지방-살 세 겹. 세우면 단면이 카메라를 본다."""
        for i, (재, 두께) in enumerate(((살재, 0.052), (지방재, 0.030), (살재, 0.052))):
            아래 = 0.09 + (0.052 + 0.030) * 0 + (0.0, 0.052, 0.082)[i] * 2
            if 세움:
                조 = 베개몸((0.30 * s, 0.020, 두께 * 2.6 * s),
                          위치=(x, y + 0.06 - (i - 1) * 두께 * 2.1, 0.09 + 두께 * 2.6 * s),
                          회전z=각, 크리스=0.72)
            else:
                # ⚠1판은 «층 케이크»로 읽혔다 — 삼겹살은 두꺼운 덩어리가 아니라 «넓고 얇은 조각»이다.
                조 = 베개몸((0.36 * s, 0.27 * s, 두께 * 0.62),
                          위치=(x, y + 0.06, 0.07 + 아래 * 0.62 + 두께 * 0.62), 회전z=각, 크리스=0.72)
            조.data.materials.append(재)

    켜조각(-0.46, 0.30, 18)
    켜조각(0.34, 0.40, -26, s=0.94)
    켜조각(0.02, -0.34, 6, s=1.05)
    켜조각(-0.58, -0.36, 74, 세움=True, s=0.92)      # 세운 둘 — 여기서 «삼겹»이 읽힌다
    켜조각(0.62, -0.10, 96, 세움=True, s=0.88)
    # 구운 자국 — 석쇠가 남긴 검은 줄(눕힌 조각 위에만)
    for x, y, 각 in ((-0.46, 0.30, 18), (0.34, 0.40, -26), (0.02, -0.34, 6)):
        for i in range(2):
            땀하나(x + 0.10 * (i - 0.5) * 2, y + 0.06, 0.28, 0.20, 0.018, 구운재,
                  회전y=0, 회전z=각 + 90)
    # 마늘 한 점 · 파 한 점 — 접시의 «마지막 한 점»(음식 사진 문법)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11, location=(0.74, 0.42, 0.15), segments=20, ring_count=10)
    마늘 = bpy.context.object
    마늘.scale = (1.0, 1.0, 0.72)
    bpy.ops.object.shade_smooth()
    마늘.data.materials.append(직물결(매끈재질('마늘', 색['Stitch'], 거칠기=0.78), 지름=0.22))
    for i in range(3):
        땀하나(-0.80 + 0.10 * i, 0.60 + 0.06, 0.14, 0.055, 0.022,
              매끈재질('삼파%d' % i, 색['Meadow'], 거칠기=0.6), 회전y=손.uniform(0, 180), 회전z=손.uniform(-40, 40))
    return (0, -7.4, 4.7), 59


def 비빔밥():
    """펠트 비빔밥 — 한식 2호. **펠트가 가장 잘 맞는 한식**이다: 나물을 색 조각으로 두르는 그릇이
    곧 이 재료의 문법이라, 색 다섯이 부채꼴로 앉으면 그대로 비빔밥이 된다.
    🔑 가장 밝은 것은 하나(4계 ②) — 가운데 노른자다. 나물 다섯은 그 둘레에서 물러선다."""
    음식접시('Ink')
    손 = random.Random(20260822)
    # 밥 — 흰 돔. 나물이 앉을 «땅»이라 넓고 낮다.
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.04, location=(0, 0.06, 0.02), segments=56, ring_count=28)
    밥 = bpy.context.object
    밥.scale = (1.0, 1.0, 0.26)
    bpy.ops.object.shade_smooth()
    # ⚠1판은 «눈덩이»였다 — 길이 0.020·뭉침 0.58 은 밥이 아니라 솜이다. 밥알은 **짧고 촘촘하고
    #   세게 뭉친다**(귤 껍질에서 배운 그 손잡이: 길이를 반으로·뿌리를 굵게·뭉침을 세게).
    짧은퍼(밥, 'Paper', 살재질('밥', 색['Paper']), 털재질('밥', 색['Paper']), 길이=0.011, 개수=44000)
    ps밥 = 밥.particle_systems[-1].settings
    ps밥.clump_factor = 0.80
    ps밥.root_radius = 0.020
    밥면 = 0.02 + 1.04 * 0.26 + 0.011                 # 밥 윗면 = 0.301 (계산 · 4계 ④)
    # 나물 다섯 — 부채꼴로 두른다. 색이 다섯이면 이름도 다섯이다(교보재로 그대로 쓴다).
    나물 = (('Meadow', '시금치'), ('Coral 2', '당근'), ('Butter', '지단'),
            ('Deep Wool', '고사리'), ('Stone', '콩나물'))
    for k, (색이름, 이름) in enumerate(나물):
        a = 2 * math.pi * k / 5 + 0.3
        재 = 직물결(매끈재질('나물' + 이름, 색[색이름], 거칠기=0.72), 지름=0.5, 세기=0.7)
        for j in range(4):                             # 한 나물 = 굵고 긴 조각 넷
            # ⚠1판은 조각이 가늘어(0.030) 밥 털에 파묻혔다 — 나물은 «덩어리»로 얹혀야 색이 산다.
            t = a + (j - 1.5) * 0.115
            r = 0.58 + 손.uniform(-0.04, 0.04)
            조 = 베개몸((0.30, 0.050, 0.040), 위치=(r * math.cos(t), r * math.sin(t) + 0.06,
                                                밥면 + 0.030),
                      회전z=math.degrees(t) + 90, 크리스=0.80)
            조.data.materials.append(재)
    # 노른자 — 가운데 한 점(화면에서 가장 밝은 것)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.27, location=(0, 0.06, 밥면 + 0.10),
                                         segments=32, ring_count=16)
    노 = bpy.context.object
    노.scale = (1.0, 1.0, 0.62)
    bpy.ops.object.shade_smooth()
    노.data.materials.append(직물결(매끈재질('비노른자', 색['Butter']), 지름=0.54, 세기=0.8))
    return (0, -7.4, 4.7), 59


def 치킨():
    """펠트 치킨 — 한식 3호. K문화의 얼굴이자 «다 같이 먹는» 음식이라 학생 대화에 가장 자주 나온다.
    🔑 여기서는 **보풀이 옳다** — 튀김옷이 곧 결이다(작은 조각에 털을 심지 말라는 규율의 예외이고,
       예외인 까닭이 뚜렷하다: 이 털은 장식이 아니라 «재료 그 자체»다).
    뼈(Paper 원기둥)가 하나라도 보여야 «닭»이 된다 — 덩어리만 셋이면 감자튀김이다."""
    음식접시('Ink')
    손 = random.Random(20260822)
    for k, (x, y, 각, s) in enumerate(((-0.46, 0.26, 28, 1.00), (0.40, 0.34, -34, 0.94),
                                       (0.06, -0.36, 8, 1.06))):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.42 * s, location=(x, y + 0.06, 0.30 * s),
                                             segments=40, ring_count=20)
        몸 = bpy.context.object
        몸.scale = (1.0, 0.82, 0.86)
        몸.rotation_euler = (0, 0, math.radians(각))
        for v in 몸.data.vertices:                     # 튀김은 «울퉁불퉁»하다 — 완벽한 구는 고무공이다
            v.co.x *= 1 + 0.10 * math.sin(6 * v.co.z + k)
            v.co.y *= 1 + 0.09 * math.cos(5 * v.co.x + k)
        bpy.ops.object.shade_smooth()
        # 🔴**털을 걷었다 — 두 판을 고쳐도 «노란 솜뭉치»였다.**
        #   길이(0.030→0.015)도 뭉침(0.42→0.66)도 못 고쳤고, 개수를 올리자 이번엔
        #   **iGPU 드라이버가 죽었다**(26000×3덩이 · 5분 뒤 ze_intel_gpu64.dll 크래시 · 실측 08-22
        #   — 한계는 «오브젝트당»이 아니라 «장면 전체»다. 귤 42000 은 되는데 세 덩이는 안 된다).
        #   ⇒ 세 판 만에 손잡이가 틀렸다는 것이 확실해졌다: **작은 덩이에 털을 심으면 실루엣이 죽는다.**
        #   바삭함은 털이 아니라 **잔 범프**로 낸다(지름 0.30 = 아주 잔 결 · 세기 0.95 = 깊게).
        #   같은 처방이 어묵·김치에서 이미 통했다 — 이 공방에서 세 번째다.
        몸.data.materials.append(직물결(매끈재질('튀김%d' % k, 색['Butter'], 거칠기=0.86),
                                     지름=0.30, 세기=0.95))
        # ⚠«구운 면»(위에 얹은 진한 원판)은 **걷었다** — 완전한 원이라 튀김 자국이 아니라
        #   «단추»로 읽혔다. 두 색이 필요하다는 판단 자체가 틀렸다: 털을 걷고 잔 범프를 넣자
        #   울퉁불퉁한 그림자가 이미 «튀겨진 것»을 만들고 있었다. 있는 신호 위에 신호를 더하면 는 게 아니라 샌다.
        # 뼈 — 덩어리에서 삐져나온 흰 대(하나면 충분하다)
        # 뼈 — **셋 다** 낸다. 뼈가 보여야 덩어리가 «닭다리»가 된다(하나만으로는 감자튀김이다).
        if True:
            bpy.ops.mesh.primitive_cylinder_add(radius=0.085, depth=0.74,
                                                location=(x - 0.52 * s, y + 0.06 - 0.22, 0.30 * s),
                                                vertices=20,
                                                rotation=(math.radians(88), 0, math.radians(각 + 28)))
            뼈 = bpy.context.object
            b = 뼈.modifiers.new('bev', 'BEVEL'); b.width = 0.03; b.segments = 4
            bpy.ops.object.shade_smooth()
            뼈.data.materials.append(직물결(매끈재질('뼈', 색['Paper'], 거칠기=0.72), 지름=0.15))
    return (0, -7.4, 4.7), 59


def 잡채():
    """펠트 잡채 — 한식 4호. 라면과 **갈려야** 한다: 국물이 없고 면이 갈색이며 채소가 섞여 든다.
    ⚠같은 «면 둥지» 문법을 두 번 쓰지만, 국물을 빼고 색을 바꾸면 다른 음식으로 읽힌다
      — 문법을 다시 배우지 않고 낱말만 느는 것이 이 세계의 이점이다."""
    음식접시('Ink')
    손 = random.Random(20260822)
    면재 = 매끈재질('당면', 색['Butter Deep'], 거칠기=0.42)     # 당면은 반들거린다(라면 면은 무광)
    for k in range(20):
        기울 = 손.uniform(-3.14, 3.14)
        중심 = (손.uniform(-0.26, 0.26), 손.uniform(-0.22, 0.22) + 0.06)
        반 = 0.36 + 0.030 * (k % 8)
        점 = []
        for i in range(26):
            t = math.pi * 1.35 * (i / 25) + 기울
            점.append((중심[0] + 반 * math.cos(t), 중심[1] + 반 * 0.78 * math.sin(t),
                       0.06 + 0.11 * math.sin(math.pi * i / 25) + 0.010 * (k % 6)
                       + 손.uniform(-0.010, 0.010)))
        실가닥(점, 0.032, 면재, '당면%d' % k)
    # 채소 — 면 위에 얹힌 색 조각 셋씩(시금치·당근·지단)
    for 색이름, 각0 in (('Meadow', 0.4), ('Coral 2', 2.4), ('Butter', 4.4)):
        재 = 직물결(매끈재질('잡채' + 색이름, 색[색이름], 거칠기=0.72), 지름=0.45, 세기=0.7)
        for j in range(3):
            t = 각0 + j * 0.5
            r = 0.30 + 손.uniform(-0.16, 0.22)
            조 = 베개몸((0.20, 0.028, 0.020), 위치=(r * math.cos(t), r * math.sin(t) + 0.06, 0.235),
                      회전z=math.degrees(t) + 90 + 손.uniform(-20, 20), 크리스=0.80)
            조.data.materials.append(재)
    return (0, -7.4, 4.7), 59


def 파전():
    """펠트 파전 — 한식 5호. 호떡과 **갈려야** 한다: 파전은 «파가 보이는» 전이라 표면이 초록으로 갈린다.
    ⚠가장자리를 흔든다 — 완벽한 원은 전이 아니라 팬케이크다(손으로 부친 것은 삐뚤다)."""
    음식접시('Ink')
    손 = random.Random(20260822)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.92, location=(0, 0.06, 0.06), segments=64, ring_count=32)
    몸 = bpy.context.object
    몸.scale = (1.0, 1.0, 0.14)
    for v in 몸.data.vertices:                     # 가장자리 흔들기 — 손으로 부친 자국
        d = math.hypot(v.co.x, v.co.y)
        if d > 0.001:
            k = 1 + 0.075 * math.sin(5.0 * math.atan2(v.co.y, v.co.x)) + 0.04 * math.sin(9.0 * d)
            v.co.x *= k
            v.co.y *= k
    bpy.ops.object.shade_smooth()
    짧은퍼(몸, 'Butter', 살재질('전', 색['Butter']), 털재질('전', 색['Butter']), 길이=0.016, 개수=24000)
    몸.particle_systems[-1].settings.clump_factor = 0.60
    표면 = 0.06 + 0.92 * 0.14 + 0.016               # = 0.205
    # 파 — 표면에 «누워» 깔린 긴 조각 일곱. 이것이 전을 파전으로 만든다.
    파재 = 직물결(매끈재질('전파', 색['Meadow'], 거칠기=0.66), 지름=0.5, 세기=0.7)
    for i in range(7):
        각 = 손.uniform(-40, 40) + (-70 + 24 * i)
        조 = 베개몸((0.46 + 손.uniform(-0.10, 0.10), 0.038, 0.018),
                  위치=(손.uniform(-0.42, 0.42), 손.uniform(-0.40, 0.40) + 0.06, 표면 + 0.004),
                  회전z=각, 크리스=0.86)
        조.data.materials.append(파재)
    # 홍고추 두 점 — 신호 한 점(염료). 파전에서 붉은 점 둘이 「전」을 「한식」으로 만든다.
    고재 = 매끈재질('홍고추', 색[염료이름], 거칠기=0.48)
    for x, y, 각 in ((-0.22, 0.30, 26), (0.34, -0.18, -52)):
        조 = 베개몸((0.13, 0.030, 0.016), 위치=(x, y + 0.06, 표면 + 0.010), 회전z=각, 크리스=0.9)
        조.data.materials.append(고재)
    return (0, -5.66, 6.74), 40


def 김치찌개():
    """펠트 김치찌개 — 한식 6호. 라면과 **갈려야** 한다: 그릇이 뚝배기(검은 흙)이고
    **두부 흰 사각 둘**이 그 표식이다. 국물 색은 같아도 얹힌 것이 다르면 다른 음식이다.
    ⚠뚝배기라 접시천을 Graphite 로 내린다 — 그릇이 갈리면 «다른 상»에서 온 것으로 읽힌다."""
    음식접시('Graphite 3', 반경=1.44)
    손 = random.Random(20260822)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.06, depth=0.22, location=(0, 0.06, 0.07), vertices=96)
    국물 = bpy.context.object
    b = 국물.modifiers.new('bev', 'BEVEL'); b.width = 0.05; b.segments = 3
    bpy.ops.object.shade_smooth()
    국물.data.materials.append(직물결(매끈재질('찌개국물', 색['Coral 3'], 거칠기=0.58), 지름=2.1, 세기=0.45))
    # 두부 두 모 — 이 접시의 이름표. 각지고 희다(국물의 둥근 붉음과 정반대라 눈이 바로 잡는다).
    두부재 = 직물결(매끈재질('두부', 색['Paper'], 거칠기=0.82), 지름=0.4, 세기=0.75)
    for x, y, 각 in ((-0.34, 0.22, 14), (0.30, -0.16, -22)):
        두 = 베개몸((0.30, 0.24, 0.115), 위치=(x, y + 0.06, 0.24), 회전z=각, 크리스=0.30)
        두.data.materials.append(두부재)
    # 김치 조각 셋 — 잎맥 없이 «잠긴» 조각(찌개 속 김치는 흐물흐물하다)
    김재 = 직물결(매끈재질('찌개김치', 색['Coral Rim'], 거칠기=0.70), 지름=0.5, 세기=0.7)
    for x, y, 각 in ((0.10, 0.42, 40), (-0.52, -0.24, -16), (0.52, 0.28, 68)):
        조 = 베개몸((0.24, 0.19, 0.045), 위치=(x, y + 0.06, 0.20), 회전z=각, 크리스=0.85)
        조.data.materials.append(김재)
    # 파 — 국물 위 넷
    for i in range(4):
        땀하나(손.uniform(-0.60, 0.60), 손.uniform(-0.40, 0.55) + 0.06, 0.20, 0.055, 0.022,
              매끈재질('찌파%d' % i, 색['Meadow'], 거칠기=0.6),
              회전y=손.uniform(0, 180), 회전z=손.uniform(-40, 40))
    return (0, -7.4, 4.7), 59


def 송편():
    """펠트 송편 — 한식 7호. 유일한 «명절» 낱말이고 목록에서 유일한 떡이다.
    세 색(백·쑥·오미자)이 곧 낱말 셋이라 교보재로 그대로 선다.
    ⚠솔잎을 깐다 — 송편은 «솔잎에 쪄서» 송편이고, 초록 실 몇 가닥이 그 이야기를 다 한다."""
    음식접시('Ink')
    손 = random.Random(20260822)
    # 솔잎 — 바닥에 먼저 깔린다(떡 아래에 있어야 «쪄낸 것»으로 읽힌다)
    for i in range(9):
        땀하나(손.uniform(-0.80, 0.80), 손.uniform(-0.60, 0.60) + 0.06, 0.00,
              0.16, 0.014, 매끈재질('솔잎%d' % i, 색['Meadow Deep'], 거칠기=0.6),
              회전y=0, 회전z=손.uniform(0, 180))
    떡색 = (('Paper', -0.52, 0.30, 16), ('Meadow Soft', 0.26, 0.40, -28), ('Coral Soft', 0.62, -0.06, 44),
            ('Paper', -0.18, -0.34, 68), ('Meadow Soft', -0.72, -0.28, -12))
    for k, (색이름, x, y, 각) in enumerate(떡색):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.34, location=(x, y + 0.06, 0.16),
                                             segments=36, ring_count=18)
        떡 = bpy.context.object
        떡.scale = (1.0, 0.74, 0.80)
        # ⚠1판은 **폼폼**이었다. 까닭 둘: ①집기(0.42)가 약해 양끝이 안 뾰족했다
        #   ②털 0.014 가 그 실루엣을 통째로 덮었다. 형태를 털보다 «세게» 만들어야 형태가 이긴다.
        for v in 떡.data.vertices:                 # 반달 — 위는 봉긋, 아래는 평평, 양끝은 뾰족
            집 = 1.0 - 0.80 * abs(v.co.x) ** 1.5
            v.co.y *= 집
            v.co.z *= 0.55 + 0.45 * 집
            if v.co.z < 0:
                v.co.z *= 0.30
        떡.rotation_euler = (0, 0, math.radians(각))
        bpy.ops.object.shade_smooth()
        # 🔴**털을 걷었다 — 길이를 0.014→0.007 로 내려도 폼폼이었다.**
        #   떡은 애초에 «보풀 있는 것»이 아니다: 쪄낸 떡은 매끈하고 조금 눅눅하다.
        #   실루엣(반달)이 이 형태의 전부인데 털이 그걸 덮으면 남는 게 없다.
        떡.data.materials.append(직물결(매끈재질('송편%d' % k, 색[색이름], 거칠기=0.78),
                                     지름=0.42, 세기=0.62))
        # 오므린 자국 — 위 능선의 짧은 실땀 하나(손으로 빚었다는 표식)
        땀하나(x, y + 0.06, 0.16 + 0.34 * 0.80 + 0.016, 0.10, 0.013,
              매끈재질('빚음%d' % k, 색['Stone'], 거칠기=0.55), 회전y=0, 회전z=각 + 90)
    return (0, -5.66, 6.74), 40


def 불고기():
    """펠트 불고기 — 한식 8호. 삼겹살과 **갈려야** 한다: 삼겹살은 «켜가 있는 두꺼운 조각»이고
    불고기는 «양념에 잠긴 얇은 저민 고기»다. 두께와 색(Deep Wool 간장빛)이 그 차이를 진다.
    양파(Stitch 반투명 결)가 사이사이 보여야 «불고기»가 된다 — 고기만 있으면 그냥 고기다."""
    음식접시('Ink')
    손 = random.Random(20260822)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.14, depth=0.14, location=(0, 0.06, 0.05), vertices=96)
    양념 = bpy.context.object
    b = 양념.modifiers.new('bev', 'BEVEL'); b.width = 0.04; b.segments = 3
    bpy.ops.object.shade_smooth()
    양념.data.materials.append(직물결(매끈재질('양념', 색['Butter Deep'], 거칠기=0.52), 지름=2.28, 세기=0.5))
    # 🔴**1판은 «회색 타일»이었다.** Deep Wool(#575046)은 이름과 달리 «따뜻한 회색»이라 고기가 안 된다
    #   — 킷에 갈색이 없다는 것이 진짜 제약이고, 그럴 땐 «붉은 쪽»으로 간다(Coral Rim #941F19).
    #   양념(Butter Deep)과 나란히 놓이면 그제서야 «간장 양념에 잠긴 고기»로 읽힌다.
    고기재 = 직물결(매끈재질('저민고기', 색['Coral Rim'], 거칠기=0.70), 지름=0.55, 세기=0.7)
    양파재 = 직물결(매끈재질('양파', 색['Stitch'], 거칠기=0.80), 지름=0.45, 세기=0.75)
    # 저민 고기 여섯 — 얇고 넓고 «접힌» 조각(굽으면 오그라든다)
    for x, y, 각, s in ((-0.44, 0.32, 22, 1.00), (0.30, 0.42, -30, 0.92), (0.56, 0.02, 64, 0.96),
                        (-0.56, -0.26, -14, 1.04), (0.06, -0.12, 84, 0.98), (0.36, -0.42, 8, 0.90)):
        조 = 베개몸((0.34 * s, 0.24 * s, 0.030), 위치=(x, y + 0.06, 0.15), 회전z=각, 크리스=0.88)
        조.data.materials.append(고기재)
        # 접힌 자락 — 조각 한쪽에 살짝 들린 얇은 판(같은 색이라 «접힘»으로만 읽힌다)
        자 = 베개몸((0.20 * s, 0.10 * s, 0.022), 위치=(x + 0.16 * s, y + 0.06 - 0.10 * s, 0.20),
                  회전z=각 + 24, 크리스=0.9)
        자.data.materials.append(고기재)
    # 양파 넷 — 고기 사이로 비치는 흰 채
    for i in range(4):
        조 = 베개몸((0.22, 0.030, 0.018), 위치=(손.uniform(-0.62, 0.62), 손.uniform(-0.44, 0.52) + 0.06, 0.19),
                  회전z=손.uniform(0, 180), 크리스=0.9)
        조.data.materials.append(양파재)
    # 참깨 — 마지막 한 점 다섯(작지만 이 음식의 서명이다)
    for i in range(5):
        땀하나(손.uniform(-0.70, 0.70), 손.uniform(-0.50, 0.60) + 0.06, 0.215, 0.030, 0.014,
              매끈재질('참깨%d' % i, 색['Stitch'], 거칠기=0.5), 회전y=손.uniform(0, 180),
              회전z=손.uniform(0, 180))
    return (0, -7.4, 4.7), 59


def 초밥():
    """펠트 초밥 — 「초밥=」 으로 열일곱 가지(유호 08-22 「초밥도 많이」 → 「디테일을 더 살려줘 아니면 종류를 추가」).

    🔑 **이 재료가 가장 잘하는 음식이다.** 김치가 안 읽히는 것과 정확히 반대 까닭이다 —
       초밥은 «기하»다: 쥔 밥덩이 + 그 위에 덮인 색 판 하나 + (가끔) 검은 띠.
       펠트는 마르고 각이 살아 있어 이런 «단정한 형태»를 그대로 낸다.
       김치처럼 «구겨지고 젖고 뭉친 것»은 이 재료가 원리적으로 흉내내기 어렵다.

    🔑 그래서 이 갈래는 **표 한 줄로 는다** — 밥·비례·조명·와사비·생강은 안 갈리고
       네타의 «색·두께·광택·결줄»만 바뀐다. 「모둠」도 같은 표에서 다섯 줄을 뽑아 세운다.

    ⚠밥에 털을 심지 않는다 — `베개몸`의 비균등 스케일이 털을 늘려 «솜뭉치»가 된다(실측 08-22).
      밥알은 «잔 범프 + 가장자리로 흘러나온 알갱이»가 낸다."""
    종류 = 인자.get('초밥', '연어')
    손 = random.Random(20260822)
    음식접시('Ink')

    김재 = 직물결(매끈재질('김', 색['Graphite 2'], 거칠기=0.88), 지름=0.5, 세기=0.75)

    def 밥재질():
        """밥알 — 잔 범프. 지름 0.10 = 알갱이 하나가 밥알만 하다."""
        return 직물결(매끈재질('샤리', 색['Paper'], 거칠기=0.84), 지름=0.10, 세기=0.88)

    def 샤리(cx=0.0, cy=0.0, 각=0.0, s=1.0, z=0.0):
        """샤리(밥덩이) — **쥔 덩이**다(유호 지적 08-22 「초밥이 사각형이면 안되잖아」).
        🔴 1판은 `베개몸`(스케일 큐브)이라 «모서리만 둥근 블록»이었다 — 밥은 손으로 «쥐어서»
           만드는 것이라 사각일 수가 없다. 각진 밥덩이는 초밥이 아니라 떡이다.
        ⇒ 타원체로 짓는다: **바닥은 평평하고**(접시에 앉는다) **위는 봉긋하고** 양끝이 둥글다."""
        R = 0.44 * s
        bpy.ops.mesh.primitive_uv_sphere_add(radius=R, location=(0, 0, 0), segments=64, ring_count=32)
        몸 = bpy.context.object
        for v in 몸.data.vertices:
            u = v.co.x / R
            v.co.y *= 0.585 + 0.045 * math.sin(2.6 * u + 0.6)   # 손으로 쥔 자국
            v.co.z *= 0.44
            if v.co.z < 0:
                v.co.z *= 0.28                                   # 바닥 평평 — 접시에 «앉는다»
        bpy.ops.object.shade_smooth()
        바닥 = R * 0.44 * 0.28
        몸.location = (cx, cy + 0.06, z + 바닥)
        몸.rotation_euler = (0, 0, math.radians(각))
        몸.data.materials.append(밥재질())
        # 흘러나온 밥알 — 실루엣 가장자리에 «알갱이»가 보여야 덩이가 «밥»으로 읽힌다.
        #   범프만으로는 «흰 돌»과 안 갈린다(유호 지적 「밥 재질 표현을 자연스럽게」의 자리).
        알재 = 매끈재질('밥알', 색['Paper'], 거칠기=0.80)
        코, 사 = math.cos(math.radians(각)), math.sin(math.radians(각))
        for i in range(11):
            lu = 손.uniform(-0.88, 0.88) * R
            lv = (0.58 * R) * (1 if i % 2 else -1) * 손.uniform(0.84, 1.02)
            땀하나(cx + lu * 코 - lv * 사, cy + 0.06 + lu * 사 + lv * 코,
                  z + 바닥 * 0.9 + 손.uniform(0.005, 0.055) * s,
                  0.026 * s, 0.014 * s, 알재,
                  회전y=손.uniform(0, 180), 회전z=각 + 손.uniform(-45, 45))
        return z + R * 0.44                       # 밥 윗면(봉긋한 꼭대기)

    def 와사비(윗면, cx=0.0, cy=0.0, 각=0.0, s=1.0):
        """와사비 — 밥과 네타 «사이»에 낀 초록 한 점. 옆으로 조금 삐져나와야 보인다.
        초밥집 초밥과 마트 초밥을 가르는 디테일이 이것이다."""
        코, 사 = math.cos(math.radians(각)), math.sin(math.radians(각))
        lv = -0.20 * s
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.075 * s,
                                             location=(cx - lv * 사, cy + 0.06 + lv * 코, 윗면 - 0.010 * s),
                                             segments=18, ring_count=9)
        w = bpy.context.object
        w.scale = (1.5, 0.75, 0.55)
        w.rotation_euler = (0, 0, math.radians(각))
        bpy.ops.object.shade_smooth()
        w.data.materials.append(매끈재질('와사비', 색['Meadow'], 거칠기=0.62))

    def 네타(색이름, 윗면, cx=0.0, cy=0.0, 각=0.0, s=1.0, 두께=0.040, 거칠기=0.52,
            폭=0.475, 높=0.275, 처짐=0.085, 물결=0.0):
        """네타 — 밥 위에 «덮은» 한 판. **양끝이 처져야** 얹힌 것이지 올려둔 판이 아니다.
        ⚠처짐이 과하면 네타가 밥을 «감싸» 초밥이 아니라 조개가 된다(0.16 은 과했다).
        ⚠거칠기 기본을 0.52 로 둔다 — 생선은 밥보다 «젖어» 있고, 그 광택 차이가 재료를 가른다."""
        R = 폭 * s
        bpy.ops.mesh.primitive_uv_sphere_add(radius=R, location=(0, 0, 0), segments=56, ring_count=28)
        n = bpy.context.object
        for v in n.data.vertices:
            u = v.co.x / R
            v.co.y *= (높 / 폭) * (0.98 - 0.06 * u * u + 0.035 * math.sin(4.1 * u))  # 자른 가장자리
            v.co.z = v.co.z * (두께 * s / R) - 처짐 * s * (u * u)
            if 물결:              # 결이 «파도치는» 살(엔가와) — 평평하면 그냥 흰 판이다
                v.co.z += 물결 * s * math.sin(5.6 * u)
        bpy.ops.object.shade_smooth()
        n.location = (cx, cy + 0.06, 윗면 + 두께 * s * 0.55)
        n.rotation_euler = (math.radians(-4), math.radians(2), math.radians(각))
        n.data.materials.append(직물결(매끈재질('네타', 색[색이름], 거칠기=거칠기), 지름=0.9, 세기=0.55))
        # 🔑 자기 윗면을 돌려준다 — 결줄을 «윗면 + 두께»에 놓으면 네타 «속»이라 안 보인다(실측).
        return 윗면 + 두께 * s * 1.55

    def 띠(윗면, cx=0.0, cy=0.0, 각=0.0, s=1.0):
        """김 띠 — 계란·군함을 묶는 검은 한 줄. 초밥에서 «검정»은 늘 김이다."""
        b = 베개몸((0.085 * s, 0.28 * s, 0.155 * s), 위치=(cx, cy + 0.06, 윗면 - 0.060 * s),
                 회전z=각, 크리스=0.55)
        b.data.materials.append(김재)

    def 결줄(윗면, 색이름, n=3, 폭=0.30, 간격=0.085, cx=0.0, cy=0.0, 각=0.0, 굵기=0.014):
        """네타 위의 «결» — 연어 지방줄·참치 힘줄·장어 소스. 한 줄이 그 생선의 이름표다."""
        재 = 매끈재질('결' + 색이름, 색[색이름], 거칠기=0.42)
        코, 사 = math.cos(math.radians(각)), math.sin(math.radians(각))
        for i in range(n):
            d = (i - (n - 1) / 2) * 간격
            땀하나(cx + d * 코, cy + 0.06 + d * 사, 윗면 + 0.005, 폭 / 2, 굵기, 재,
                  회전y=0, 회전z=각 + 90)

    # ── 니기리 표 — «무엇을 얹는가»의 정본. 새 초밥은 여기 한 줄이면 는다 ──────────────
    #    (색, 두께, 거칠기, 처짐, 폭, 높, 결=(색, 개수, 폭, 간격, 굵기))
    니기리 = {
        '연어':   ('Coral 2',    0.040, 0.46, 0.085, 0.475, 0.275, ('Paper', 3, 0.30, 0.075, 0.014)),
        '참치':   ('Coral 3',    0.040, 0.44, 0.085, 0.475, 0.275, ('Coral Rim', 2, 0.26, 0.095, 0.011)),
        '광어':   ('Paper',      0.034, 0.56, 0.095, 0.470, 0.270, ('Stone', 2, 0.24, 0.100, 0.010)),
        '새우':   ('Coral Soft', 0.040, 0.50, 0.080, 0.480, 0.270, ('Coral 3', 4, 0.23, 0.078, 0.019)),
        '문어':   ('Paper',      0.034, 0.40, 0.090, 0.470, 0.265, ('Coral 2', 2, 0.40, 0.200, 0.020)),
        '장어':   ('Butter Deep', 0.042, 0.34, 0.080, 0.475, 0.275, ('Coral Rim', 3, 0.32, 0.080, 0.013)),
        '오징어': ('Paper',      0.030, 0.30, 0.075, 0.470, 0.265, ('Chalk 3', 3, 0.28, 0.085, 0.009)),
        '가리비': ('Paper',      0.070, 0.48, 0.030, 0.430, 0.310, ('Stone', 3, 0.34, 0.070, 0.010)),
        '아보카도': ('Meadow Soft', 0.038, 0.44, 0.070, 0.470, 0.270, ('Meadow', 4, 0.26, 0.070, 0.012)),
        # 엔가와 — 광어 지느러미살. 이름표는 **물결진 결**이다: 근육이 파도쳐서 흰 살에 잔 골이 진다.
        #   그래서 광어(매끈한 흰 판)와 갈린다 — 색이 아니라 «표면»이 두 생선을 가른다.
        '광어지느러미': ('Paper', 0.030, 0.26, 0.065, 0.465, 0.245, ('Stone', 6, 0.28, 0.052, 0.0075)),
    }
    물결표 = {'광어지느러미': 0.022}
    띠붙는것 = ('장어',)

    def 니기리하나(이름, cx, cy, 각, s):
        색이름, 두께, 거칠, 처짐, 폭, 높, 결 = 니기리[이름]
        윗 = 샤리(cx, cy, 각, s)
        와사비(윗, cx, cy, 각, s)
        면 = 네타(색이름, 윗, cx, cy, 각, s, 두께=두께, 거칠기=거칠, 처짐=처짐, 폭=폭, 높=높,
                물결=물결표.get(이름, 0.0))
        결줄(면, 결[0], 결[1], 결[2] * s, 결[3] * s, cx, cy, 각, 굵기=결[4])
        if 이름 in 띠붙는것:
            띠(면 + 0.030, cx, cy, 각, s * 0.86)

    def 군함(cx, cy, s, 알색, 알수=16, 알크기=0.055, 덩이=False):
        """군함 — 김이 밥을 «둘러싼다». 위가 열려 있고 거기 알(또는 살)이 담긴다."""
        bpy.ops.mesh.primitive_cylinder_add(radius=0.36 * s, depth=0.32 * s,
                                            location=(cx, cy + 0.06, 0.16 * s), vertices=48)
        벽 = bpy.context.object
        bev = 벽.modifiers.new('bev', 'BEVEL'); bev.width = 0.02; bev.segments = 3
        bpy.ops.object.shade_smooth()
        벽.data.materials.append(김재)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.31 * s, location=(cx, cy + 0.06, 0.20 * s),
                                             segments=32, ring_count=16)
        밥 = bpy.context.object
        for v in 밥.data.vertices:
            v.co.z *= 0.36
        bpy.ops.object.shade_smooth()
        밥.data.materials.append(밥재질())
        알재 = 직물결(매끈재질('알', 색[알색], 거칠기=0.26), 지름=0.10, 세기=0.4)
        for i in range(알수):
            a, r = 손.uniform(0, 6.28), 손.uniform(0, 0.20) * s
            bpy.ops.mesh.primitive_uv_sphere_add(radius=알크기 * s,
                                                 location=(cx + r * math.cos(a), cy + 0.06 + r * math.sin(a),
                                                           0.30 * s + 손.uniform(-0.01, 0.02)),
                                                 segments=16, ring_count=8)
            덩 = bpy.context.object
            if 덩이:                                   # 우니 = 알이 아니라 «갈라진 살»이다
                덩.scale = (1.9, 0.72, 0.62)
                덩.rotation_euler = (0, 0, 손.uniform(0, 3.14))
            bpy.ops.object.shade_smooth()
            덩.data.materials.append(알재)

    def 마키(cx, cy, s, 속들, 겉반=0.34):
        """마키 — 세워 놓아 «단면»이 위를 본다. 김(겉) → 밥(켜) → 속(가운데) 세 겹.
        ⚠속 밥도 «원기둥»이어야 한다 — 네모로 넣으면 김이 감긴 것으로 안 읽힌다."""
        bpy.ops.mesh.primitive_cylinder_add(radius=겉반 * s, depth=0.34 * s,
                                            location=(cx, cy + 0.06, 0.16 * s), vertices=56)
        겉 = bpy.context.object
        bpy.ops.object.shade_smooth()
        겉.data.materials.append(김재)
        bpy.ops.mesh.primitive_cylinder_add(radius=(겉반 - 0.045) * s, depth=0.36 * s,
                                            location=(cx, cy + 0.06, 0.163 * s), vertices=48)
        밥 = bpy.context.object
        bpy.ops.object.shade_smooth()
        밥.data.materials.append(밥재질())
        for (색이름, r, dx, dy) in 속들:
            bpy.ops.mesh.primitive_cylinder_add(radius=r * s, depth=0.38 * s,
                                                location=(cx + dx * s, cy + 0.06 + dy * s, 0.172 * s),
                                                vertices=28)
            속 = bpy.context.object
            bpy.ops.object.shade_smooth()
            속.data.materials.append(직물결(매끈재질('속' + 색이름, 색[색이름], 거칠기=0.56), 지름=0.21))

    # ── 종류 가르기 ──────────────────────────────────────────────────────────────
    if 종류 in 니기리:
        for k, (cx, cy, 각) in enumerate(((-0.34, 0.20, 14), (0.36, -0.16, -22))):
            니기리하나(종류, cx, cy, 각, 1.0 if k == 0 else 0.94)
    elif 종류 == '계란':
        for k, (cx, cy, 각) in enumerate(((-0.34, 0.20, 14), (0.36, -0.16, -22))):
            s = 1.0 if k == 0 else 0.94
            윗 = 샤리(cx, cy, 각, s)
            # 계란은 «자른 블록»이라 안 처진다 — 처짐 0.012 는 모서리만 눅인다.
            면 = 네타('Butter', 윗, cx, cy, 각, s, 두께=0.085, 거칠기=0.74, 폭=0.45, 높=0.26, 처짐=0.012)
            띠(면 + 0.030, cx, cy, 각, s)
    elif 종류 == '모둠':
        # 모둠 — 다섯 가지를 한 접시에. **초밥이라는 낱말의 대표 그림**이라 하나는 있어야 한다.
        for 이름, cx, cy, 각, s in (('연어', -0.52, 0.30, 22, 0.82), ('참치', 0.10, 0.44, -8, 0.82),
                                    ('광어', 0.62, 0.14, -32, 0.80), ('새우', -0.30, -0.30, 8, 0.80),
                                    ('장어', 0.36, -0.42, -20, 0.80)):
            니기리하나(이름, cx, cy, 각, s)
    elif 종류 == '연어알':
        for k, (cx, cy) in enumerate(((-0.34, 0.18), (0.36, -0.18))):
            군함(cx, cy, 1.0 if k == 0 else 0.94, 'Coral 2', 알수=17, 알크기=0.055)
    elif 종류 == '성게':
        for k, (cx, cy) in enumerate(((-0.34, 0.18), (0.36, -0.18))):
            군함(cx, cy, 1.0 if k == 0 else 0.94, 'Butter', 알수=7, 알크기=0.085, 덩이=True)
    elif 종류 == '오이롤':
        for cx, cy, s in ((-0.40, 0.22, 1.00), (0.30, 0.30, 0.94), (0.10, -0.34, 1.04)):
            마키(cx, cy, s, [('Meadow', 0.105, 0, 0)])
    elif 종류 == '참치롤':
        for cx, cy, s in ((-0.40, 0.22, 1.00), (0.30, 0.30, 0.94), (0.10, -0.34, 1.04)):
            마키(cx, cy, s, [('Coral 3', 0.105, 0, 0)])
    elif 종류 == '후토마키':
        # 후토마키 — 속이 여럿이라 단면이 «그림»이 된다. 굵기로도 마키와 갈린다.
        for cx, cy, s in ((-0.36, 0.24, 1.00), (0.38, -0.20, 0.94)):
            마키(cx, cy, s, [('Butter', 0.095, -0.10, 0.09), ('Meadow', 0.075, 0.11, 0.08),
                            ('Coral 2', 0.080, 0.02, -0.11), ('Stitch', 0.060, -0.13, -0.07)],
                겉반=0.46)
    elif 종류 == '새우튀김롤':
        # 새우튀김롤 — 이름표 둘: ①단면의 **튀김옷 링 + 분홍 살** 두 겹 ②삐져나온 **꼬리**.
        #   꼬리가 없으면 그냥 «굵은 롤»이고, 두 겹이 없으면 «노란 점»이다. 둘 다 있어야 이 롤이다.
        옷재 = 직물결(매끈재질('튀김옷', 색['Butter Deep'], 거칠기=0.80), 지름=0.11, 세기=0.95)
        살재 = 직물결(매끈재질('새우살', 색['Coral Soft'], 거칠기=0.46), 지름=0.20, 세기=0.5)
        for k, (cx, cy, s) in enumerate(((-0.40, 0.26, 1.00), (0.36, 0.28, 0.94), (0.04, -0.36, 1.04))):
            마키(cx, cy, s, [('Meadow', 0.068, 0.15, 0.08), ('Butter', 0.052, -0.16, -0.05)], 겉반=0.46)
            for r, 재 in ((0.150, 옷재), (0.092, 살재)):     # 두 겹 — 바깥이 옷, 안이 살
                bpy.ops.mesh.primitive_cylinder_add(radius=r * s, depth=0.40 * s,
                                                    location=(cx - 0.03 * s, cy + 0.06 + 0.02 * s,
                                                              0.176 * s), vertices=32)
                고 = bpy.context.object
                bpy.ops.object.shade_smooth()
                고.data.materials.append(재)
            if k == 2:                                     # 꼬리 — 한 조각에서만 뻗는다
                # ⚠1판은 꼬리가 작고 뒤(+y)에 있어 «작은 잎»으로 보였다. 꼬리는 이 롤의 이름표라
                #   **카메라 쪽(−y)으로, 크게** 세워야 한다 — 안 보이면 없는 것과 같다.
                꼬재 = 직물결(매끈재질('새우꼬리', 색['Coral 3'], 거칠기=0.40), 지름=0.14, 세기=0.7)
                for j in (-1, 0, 1):
                    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.30 * s,
                                                         location=(cx + j * 0.085 * s,
                                                                   cy + 0.06 - 0.26 * s, 0.46 * s),
                                                         segments=20, ring_count=10)
                    날 = bpy.context.object
                    날.scale = (0.26, 1.05, 0.13)
                    날.rotation_euler = (math.radians(52), 0, math.radians(j * 21))
                    bpy.ops.object.shade_smooth()
                    날.data.materials.append(꼬재)
                # 꼬리 밑동 — 꼬리가 롤에서 «나온» 것으로 보이려면 이어지는 마디가 있어야 한다.
                bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13 * s,
                                                     location=(cx, cy + 0.06 - 0.12 * s, 0.34 * s),
                                                     segments=18, ring_count=9)
                밑 = bpy.context.object
                밑.scale = (0.85, 1.0, 0.72)
                bpy.ops.object.shade_smooth()
                밑.data.materials.append(옷재)

    elif 종류 == '유부':
        for k, (cx, cy, 각) in enumerate(((-0.34, 0.18, 12), (0.36, -0.18, -20))):
            s = 1.0 if k == 0 else 0.94
            주 = 베개몸((0.42 * s, 0.27 * s, 0.165 * s), 위치=(cx, cy + 0.06, 0.17 * s),
                     회전z=각, 크리스=0.72, 레벨=4)
            주.data.materials.append(직물결(매끈재질('유부%d' % k, 색['Butter Deep'], 거칠기=0.78),
                                        지름=0.44, 세기=0.85))
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.30 * s, location=(cx, cy + 0.06, 0.335 * s),
                                                 segments=40, ring_count=20)
            밥 = bpy.context.object
            for v in 밥.data.vertices:
                v.co.y *= 0.60
                v.co.z *= 0.26
            bpy.ops.object.shade_smooth()
            밥.rotation_euler = (0, 0, math.radians(각))
            밥.data.materials.append(밥재질())
    else:
        raise SystemExit('모르는 초밥: ' + 종류 + ' — 아는 것은 ' +
                         '·'.join(list(니기리) + ['계란', '모둠', '연어알', '성게',
                                                 '오이롤', '참치롤', '후토마키', '유부']))

    # ── 곁들이 — 초밥«집»의 접시로 만드는 두 점 ──────────────────────────────────
    # 생강(가리) — 얇은 분홍 조각 넷을 겹쳐 «주름진 더미»로. 초밥 접시의 서명이다.
    생강재 = 직물결(매끈재질('생강', 색['Coral Soft'], 거칠기=0.62), 지름=0.30, 세기=0.7)
    for i in range(4):
        조 = 베개몸((0.155, 0.115, 0.012), 위치=(-0.74 + 손.uniform(-0.05, 0.05),
                                             -0.50 + 0.045 * i + 손.uniform(-0.04, 0.04),
                                             0.03 + 0.026 * i),
                  회전z=손.uniform(0, 180), 크리스=0.95)
        조.data.materials.append(생강재)
    # 간장 종지 + 와사비 한 점
    bpy.ops.mesh.primitive_cylinder_add(radius=0.30, depth=0.10, location=(0.78, 0.50, 0.03), vertices=40)
    종지 = bpy.context.object
    bev = 종지.modifiers.new('bev', 'BEVEL'); bev.width = 0.025; bev.segments = 3
    bpy.ops.object.shade_smooth()
    종지.data.materials.append(직물결(매끈재질('종지', 색['Stone'], 거칠기=0.86), 지름=0.52))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.235, depth=0.03, location=(0.78, 0.50, 0.088), vertices=40)
    간장 = bpy.context.object
    bpy.ops.object.shade_smooth()
    간장.data.materials.append(매끈재질('간장', 색['Graphite'], 거칠기=0.34))
    return (0, -7.4, 4.7), 59


def 계란찜():
    """펠트 계란찜 — 유호 지시 08-22 「계란찜도 있으면 너무 좋겠는데?」.

    🔑 계란찜의 정체는 **«부풀어 넘친 것»**이다 — 뚝배기 «위로» 봉긋하게 솟아야 계란찜이고,
       그릇 안에 얌전히 담기면 그냥 노란 죽이다. 그래서 돔의 꼭대기를 림보다 높게 못 박는다.
    ⚠표면은 매끈하지 않다 — 김이 빠져나간 자리가 얽은 자국으로 남는다(잔 범프 + 오목 셋).
    ⚠뚝배기는 검은 흙그릇이라 접시천을 Graphite 로 내린다 — 노란 돔과의 대비가 이 그림의 전부다."""
    음식접시('Graphite 3', 반경=1.38)
    손 = random.Random(20260822)
    뚝재 = 직물결(매끈재질('뚝배기', 색['Graphite 4'], 거칠기=0.92), 지름=2.2, 세기=0.6)

    # 뚝배기 — 바닥판 + 도톰한 림(림이 바닥보다 높아야 «그릇»이다 · 김치 8판에서 배운 것)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.00, depth=0.30, location=(0, 0.06, 0.02), vertices=80)
    몸 = bpy.context.object
    b = 몸.modifiers.new('bev', 'BEVEL'); b.width = 0.06; b.segments = 4
    bpy.ops.object.shade_smooth()
    몸.data.materials.append(뚝재)
    # ⚠림이 두꺼우면 그릇이 «타이어»가 되고 계란 자리가 줄어든다 — 얇게 두른다.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.97, minor_radius=0.082, location=(0, 0.06, 0.165),
                                     major_segments=96, minor_segments=18)
    림 = bpy.context.object
    림.scale = (1.0, 1.0, 0.78)
    bpy.ops.object.shade_smooth()
    림.data.materials.append(뚝재)
    for 쪽 in (-1, 1):                              # 손잡이 둘 — 뚝배기의 이름표
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.20, location=(쪽 * 1.06, 0.06, 0.13),
                                             segments=24, ring_count=12)
        손잡 = bpy.context.object
        손잡.scale = (0.72, 0.42, 0.34)
        bpy.ops.object.shade_smooth()
        손잡.data.materials.append(뚝재)

    # 계란 — 림(0.26)보다 «조금» 높이 부푼 돔. 이것이 «찜»이다.
    #   🔴1판은 반지름 0.94·높이 0.53 이라 **뚝배기를 통째로 덮어** 「냄비에 담긴 거품」이 됐다.
    #     부푼 것으로 읽히려면 그릇이 «보이는 채로» 그 위로 조금 솟아야 한다 — 덮으면 그릇이 사라진다.
    #   🔴색도 틀렸다: Butter Soft(#FFEBB0)는 이 노출에서 «흰색»으로 찍힌다. 계란은 Butter 다.
    # ⚠1판은 돔 꼭대기(0.347)가 림(0.26)보다 겨우 높아 «잠긴» 것으로 보였다.
    #   계란찜은 **넘쳐야** 계란찜이다 — 림보다 확실히 솟게 올린다(0.46).
    Rd, Zd, 납작 = 0.90, 0.05, 0.455
    오목들 = ((0.26, -0.28, 0.14, 0.075), (0.17, 0.30, -0.12, 0.055), (0.12, 0.06, 0.34, 0.042))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=Rd, location=(0, 0.06, Zd), segments=72, ring_count=36)
    찜 = bpy.context.object
    for v in 찜.data.vertices:
        v.co.z *= 납작
        if v.co.z < 0:
            v.co.z *= 0.24
        r = math.hypot(v.co.x, v.co.y) / Rd
        v.co.z += 0.040 * math.sin(3.1 * math.atan2(v.co.y, v.co.x)) * r ** 2   # 넘칠 때 생긴 봉우리
        # 🔑 김 빠진 자국은 **파는 것**이다. 1판은 «공을 위에 얹어» 계란찜이 아니라 사탕이 됐다.
        for (오r, ox, oy, 깊이) in 오목들:
            d = math.hypot(v.co.x - ox, v.co.y - oy)
            if d < 오r:
                v.co.z -= 깊이 * (1.0 - d / 오r) ** 2
    bpy.ops.object.shade_smooth()
    찜.data.materials.append(직물결(매끈재질('계란찜', 색['Butter'], 거칠기=0.76), 지름=0.30, 세기=0.66))
    돔면 = Zd + Rd * 납작                              # = 0.347 (림 0.26 보다 조금 높다)

    # 파 — 노란 돔 위 초록 여섯. 계란찜의 «마지막 한 점»이다.
    for i in range(7):
        a, r = 손.uniform(0, 6.28), 손.uniform(0.08, 0.56)
        땀하나(r * math.cos(a), r * math.sin(a) + 0.06,
              돔면 - 0.010 - 0.12 * (r / 0.62) ** 2,
              0.095, 0.034, 매끈재질('찜파%d' % i, 색['Meadow'], 거칠기=0.6),
              회전y=손.uniform(0, 180), 회전z=손.uniform(0, 180))
    return (0, -7.4, 4.7), 59


def 게장():
    """펠트 간장게장 — 유호 물음 08-22 「게장같은건 어렵겠지?」에 대한 답이다.

    🔑 **결론: 게장은 김치보다 쉽다.** 까닭이 뚜렷하다 —
       김치의 정체는 «구겨지고 젖은 질감»인데 그건 펠트가 원리적으로 못 낸다.
       게장의 정체는 **«형태»**다: 둥근 등딱지 · 집게 둘 · 다리 여덟. 펠트는 형태를 잘 낸다.
       어려운 것은 간장의 «윤기» 하나뿐이고, 그건 거칠기를 0.18 까지 내려 «젖은 바닥»으로 흉내낸다
       (이 세계에서 유일하게 반들거리는 것이라 오히려 «장»이라는 신호가 된다).

    ⚠다리는 «굵기가 변하는 마디»다 — 굵기가 같으면 게가 아니라 거미가 된다.
      그래서 한 다리를 세 도막으로 뽑고 끝으로 갈수록 가늘게 한다."""
    음식접시('Ink')
    손 = random.Random(20260822)

    # 간장 — 이 세계에서 유일하게 반들거리는 바닥. 거칠기 0.18 이 «젖음»을 만든다.
    bpy.ops.mesh.primitive_cylinder_add(radius=1.16, depth=0.13, location=(0, 0.06, 0.03), vertices=96)
    장 = bpy.context.object
    b = 장.modifiers.new('bev', 'BEVEL'); b.width = 0.04; b.segments = 3
    bpy.ops.object.shade_smooth()
    # ⚠1판은 거칠기 0.18 이라 **거울**이 됐다 — 키 라이트를 통째로 되쏘아 «윤기»가 아니라
    #   «금속판»으로 읽혔다. 젖은 것은 반사가 아니라 **좁고 흐린 하이라이트**다: 0.34 가 그 자리다.
    장.data.materials.append(매끈재질('간장', 색['Graphite'], 거칠기=0.34))

    껍재 = 직물결(매끈재질('등딱지', 색['Coral 3'], 거칠기=0.66), 지름=0.9, 세기=0.72)
    다리재 = 직물결(매끈재질('다리', 색['Coral 3'], 거칠기=0.70), 지름=0.5, 세기=0.7)
    결재 = 매끈재질('등결', 색['Coral Rim'], 거칠기=0.50)

    # 등딱지 — 앞이 넓고 뒤가 좁은 «부채»다(완전한 타원이면 감자가 된다).
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.60, location=(0, 0.02, 0.20),
                                         segments=56, ring_count=28)
    등 = bpy.context.object
    등.scale = (1.06, 0.80, 0.30)
    for v in 등.data.vertices:
        t = (v.co.y + 1) / 2                      # 뒤(−y)가 좁다
        v.co.x *= 0.72 + 0.28 * t
    bpy.ops.object.shade_smooth()
    등.data.materials.append(껍재)
    등면 = 0.20 + 0.60 * 0.30                     # 등딱지 꼭대기 = 0.38

    # 등딱지 결 — 가운데 세로 한 줄 + 옆 두 줄. 게 등의 «갈래»가 이 셋으로 읽힌다.
    for dx, 길이 in ((0.0, 0.30), (-0.26, 0.20), (0.26, 0.20)):
        땀하나(dx, 0.02, 등면 - 0.012, 길이, 0.014, 결재, 회전y=0, 회전z=0)

    # 집게발 둘 — **카메라 쪽(앞)**이다. 1판은 +y(먼 쪽)에 뒀더니 등딱지에 가려 게가 아니라
    #   «감자에 붙은 귀»로 읽혔다. 집게는 게의 얼굴이라 보이는 자리에 와야 한다.
    #   ⚠2판은 집게가 팔에서 **떨어져** 떠 있었다 — 팔의 «축»을 안 재고 눈대중으로 놓은 탓이다.
    #     팔 각 θ 의 방향은 (cos θ, sin θ) 이고 팔 반길이는 0.20×1.55 = 0.31 이므로
    #     팔끝 = 팔중심 + 0.31·(cos θ, sin θ) — 집게는 거기서 이어져야 한다(4계 ④).
    for 쪽 in (-1, 1):
        θ = math.radians(쪽 * -40)                # 앞(−y)을 향해 뻗는다
        팔중심 = (쪽 * 0.56, -0.30)
        반길이 = 0.20 * 1.55
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.20, location=(팔중심[0], 팔중심[1], 0.19),
                                             segments=28, ring_count=14)
        팔 = bpy.context.object
        팔.scale = (1.55, 0.60, 0.52)
        팔.rotation_euler = (0, 0, θ)
        bpy.ops.object.shade_smooth()
        팔.data.materials.append(껍재)
        끝x = 팔중심[0] + 반길이 * math.cos(θ)
        끝y = 팔중심[1] + 반길이 * math.sin(θ)
        for 벌 in (1, -1):                        # 벌어진 두 도막 — 팔끝에서 이어 뻗는다
            수x, 수y = -math.sin(θ), math.cos(θ)   # 팔축에 수직인 방향(벌어지는 쪽)
            bpy.ops.mesh.primitive_uv_sphere_add(
                radius=0.115,
                location=(끝x + 0.13 * math.cos(θ) + 벌 * 0.055 * 수x,
                          끝y + 0.13 * math.sin(θ) + 벌 * 0.055 * 수y, 0.19),
                segments=20, ring_count=10)
            집 = bpy.context.object
            집.scale = (1.45, 0.40, 0.40)
            집.rotation_euler = (0, 0, θ + math.radians(벌 * 16))
            bpy.ops.object.shade_smooth()
            집.data.materials.append(껍재)

    # 다리 여덟 — 굵기가 변하는 세 마디. 굵기가 같으면 거미가 된다.
    # ⚠1판은 다리가 몸 «밑»으로 모였다 — 몸에서 바깥으로 뻗어야 다리다.
    #   몸을 타원으로 두고 **각도마다 바깥으로 뻗되 마디마다 조금씩 뒤로 꺾는다**(게 다리의 문법).
    for 쪽 in (-1, 1):
        for i, 도 in enumerate((-6, 26, 58, 90)):
            점 = []
            for j, (rr, zz) in enumerate(((1.00, 0.19), (1.46, 0.25), (1.92, 0.16), (2.26, 0.09))):
                a = math.radians(도 + 쪽 * 0 + j * 9)      # 마디마다 뒤로 꺾인다
                점.append((쪽 * 0.60 * math.cos(a) * rr, 0.02 + 0.46 * math.sin(a) * rr, zz))
            실가닥(점, 0.040 - 0.005 * i, 다리재, '다리%d_%d' % (쪽, i))

    # 마무리 — 청양고추 셋 · 깨 다섯. 「장」에 담긴 것이라는 마지막 한 점.
    for i in range(3):
        땀하나(손.uniform(-0.90, 0.90), 손.uniform(-0.70, 0.30) + 0.06, 0.10, 0.10, 0.026,
              매끈재질('고추%d' % i, 색['Meadow'], 거칠기=0.5),
              회전y=손.uniform(0, 180), 회전z=손.uniform(0, 180))
    for i in range(5):
        땀하나(손.uniform(-0.95, 0.95), 손.uniform(-0.75, 0.40) + 0.06, 0.098, 0.028, 0.013,
              매끈재질('깨%d' % i, 색['Stitch'], 거칠기=0.5),
              회전y=손.uniform(0, 180), 회전z=손.uniform(0, 180))
    return (0, -7.4, 4.7), 59


def 성장판():
    """「나의 성장」 탭 — 조합판(퀴즈)에 이어 두 번째 화면(유호 픽 08-21 「다음 화면 굽기」).
    전수분석 §1-C 가 지목한 게임화 코어의 얼굴이고, 랭킹을 버린 자리를 «자기 종단 비교»가 승계한다.
      ① 여행 게이지 — 학29(몽골→한국 도장) × N13(승급 게이지). 판정문의 「도장」을 새로 그리지 않고
         **꿰맨 단추의 켬/끔**(단추토글 · 유호 픽 08-19)으로 낸다 — 도달 = X 로 꿰맴, 미도달 = 빈 구멍.
         상태가 «재질 차이»가 아니라 «바느질 유무»로 읽히는 그 문법이 도달제와 정확히 같은 모양이다.
      ② 오늘의 성장 카드 — N15 개인 코치 카드(운세·ai_daily·AIQ 흡수 자리)
      ③ 도전 기록 · 성장 기록 — D+1 확정(따로 셈)
    뺀 것: 목소리 성장카드(학14 · 부품 하나가 더 필요) · 몬스터 최소형(학16 · 「단순화 수위」 미확정 —
    지금 그리면 그 결정을 앞지른다).
    글자는 전부 HTML/PIL 층 몫이다 — 여기서 굽는 것은 «그릇»뿐(오브제 글자 1점도 이 화면엔 없다)."""
    손 = random.Random(20260821)
    갈래 = 인자.get('게이지', '판')          # 판 = 카드 안에 / 천 = 배경천에 직접 수놓음

    # ⓪ 배경천 — 조합판과 같은 무대(전 픽셀이 재질 · 죽은 검정은 «없음»이지만 어두운 펠트는 «작업대»)
    배경 = 베개몸((2.6, 0.06, 5.2), 위치=(0, 1.05, 0.2), 크리스=0.12, 레벨=3)
    배경.data.materials.append(직물결(매끈재질('배경천', 색['Ink Deep'], 거칠기=0.97), 규모=90.0, 세기=0.085))
    키제외.append(배경)
    글자등([배경], 위치=(-1.2, -3.2, 2.6), 크기=3.0, 힘=90).name = '배경등'

    실재 = 매끈재질('실', 색['Deep Wool'], 거칠기=0.78)
    몸재 = 매끈재질('단추', 색['Stone'], 거칠기=0.55)
    구멍재 = 매끈재질('구멍', 색['Deep Wool'], 거칠기=0.92)
    지금실 = 매끈재질('지금실', 색[염료이름], 거칠기=0.42)      # 화면의 유일한 코랄 = 「지금 여기」 한 점

    X보정 = float(인자.get('X보정', '0.004'))
    # ⚠구멍 돌기를 고치고 나니 **최소 보정으로 충분**했다 — 0.008 은 확대 대조에서 오른쪽으로
    #   넘어간다(과보정). 0.030 은 X 가 구멍에서 떨어져 나간다. 자동 측정은 단추 몸 하이라이트에
    #   희석돼 과대값(0.016)을 내니, 이 값은 «확대해 눈으로» 잡는다.

    def 단추(cx, cz, 깊이, 꿰맴, 지금=False, r=0.085):
        """게이지 한 칸 — 단추토글의 축소판. 몸은 같고 «실»만 다르다."""
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=0.038, location=(cx, 깊이, cz),
                                            rotation=(math.radians(90), 0, 0))
        몸 = bpy.context.object
        bev = 몸.modifiers.new('bev', 'BEVEL')
        bev.width = r * 0.13
        bev.segments = 8
        bpy.ops.object.shade_smooth()
        몸.data.materials.append(몸재)
        키제외.append(몸)
        단추몸 = 몸
        단추들.append(몸)
        for dx, dz in ((-0.33, 0.33), (0.33, 0.33), (-0.33, -0.33), (0.33, -0.33)):
            bpy.ops.mesh.primitive_cylinder_add(radius=r * 0.10, depth=0.005,
                                                location=(cx + dx * r, 깊이 - 0.0205, cz + dz * r),
                                                rotation=(math.radians(90), 0, 0))
            구멍 = bpy.context.object
            bpy.ops.object.shade_smooth()
            구멍.data.materials.append(구멍재)
            단추들.append(구멍)
        if 꿰맴:
            재 = 지금실 if 지금 else 실재
            for (x1, z1, x2, z2) in ((-0.33, 0.33, 0.33, -0.33), (-0.33, -0.33, 0.33, 0.33)):
                각 = math.degrees(math.atan2(z2 - z1, x2 - x1))
                # ⚠X 는 코드상 정확히 (cx, cz) 인데 렌더에선 늘 «왼쪽 1.5px»으로 나온다
                #   (유호 지적 2회 · 실측: 왼쪽 단추 −1.58 · 오른쪽 단추 −1.42 — 양끝이 같은 방향이라
                #    원근 가설은 반박됐다). 기하가 아니라 렌더가 만드는 편향이라 «광학 보정»으로 맞춘다.
                땀하나(cx + (x1 + x2) / 2 * r + X보정, 깊이 - 0.024, cz + (z1 + z2) / 2 * r,
                      math.hypot(x2 - x1, z2 - z1) * r / 2, r * 0.085, 재, 회전y=-각)
        return 단추몸

    def 경로(x0, x1, cz, 깊이, 간격=0.052, 땀=0.019, 굵기=0.0085):
        """단추와 단추를 잇는 러닝 스티치 — «여정»은 실이 지나간 자리다."""
        n = max(2, int(abs(x1 - x0) / 간격))
        for i in range(n):
            t = (i + 0.5) / n
            땀하나(x0 + (x1 - x0) * t + 손.uniform(-0.003, 0.003), 깊이,
                  cz + 손.uniform(-0.004, 0.004), 땀 * 손.uniform(0.92, 1.08), 굵기, 실재,
                  회전y=손.uniform(-4, 4))

    # ── ① 여행 게이지 — 몽골(왼)에서 한국(오른)까지 여섯 칸, 지금은 세 번째 ──────────────
    칸수, 도달 = 6, 3
    gz = 1.845
    if 갈래 == '판':
        # ㉮ 판 위: 게이지가 «카드 안»에 든다 — 조합판 카드와 같은 그릇 문법
        게판 = 베개몸((1.21, 0.09, 0.27), 위치=(0, 0.5, gz), 크리스=0.80, 레벨=4)
        게판.data.materials.append(직물결(매끈재질('게판', 색['Ink'], 거칠기=0.95), 규모=180.0, 세기=0.055))
        키제외.append(게판)
        칸들['게이지'] = 게판
        gw, gh = 1.21 - 0.09, 0.27 - 0.09
        러닝스티치(둥근사각걷기(gw, gh, 0.10, 0.115), 0.40, (0, gz),
                 매끈재질('게판실', 색['Deep Wool'], 거칠기=0.78), 0.040, 0.0085, 손, 흔들=0.004, 각흔들=4.0)
        길깊이, 단깊이 = 0.395, 0.375
        반폭 = 0.86
    else:
        # ㉯ 천 위: 판 없이 배경천에 «직접» 수놓는다 — 지도는 그릇이 아니라 땅이라는 읽기
        길깊이, 단깊이 = 0.995, 0.975
        # ⚠깊이가 다르면 같은 x 가 화면에서 어긋난다 — 천 위 단추는 y 0.975 로 카드(0.5)보다
        #   0.475 뒤에 있어, 같은 1.21 을 줘도 화면에선 19.9px 안쪽으로 들어간다(실측).
        #   원근 보정: (반폭 + 단추반지름) / 12.975 = 1.21 / 12.5  →  반폭 = 1.171
        #   기록 칸에서도 같은 자리에 걸렸다(그쪽은 깊이를 카드와 맞춰 풀었다).
        반폭 = 1.178      # 1.171 은 실측 2.7px 안쪽 — 한 번 더 당겼다
        앵커 = 베개몸((반폭 + 0.10, 0.02, 0.135), 위치=(0, 0.5, gz), 크리스=0.9)
        앵커.hide_render = True      # ⚠렌더엔 안 나오되 «칸»은 낸다 — 배경천을 칸으로 주면
        칸들['게이지'] = 앵커         #   본문이 화면 전체를 기준 삼아 통째로 틀어진다

    단추들 = []
    자리 = [-반폭 + (2 * 반폭) * i / (칸수 - 1) for i in range(칸수)]
    for i in range(칸수 - 1):
        경로(자리[i] + 0.085, 자리[i + 1] - 0.085, gz, 길깊이)
    for i, x in enumerate(자리):
        몸 = 단추(x, gz, 단깊이, 꿰맴=(i < 도달), 지금=(i == 도달 - 1))
        if i in (0, 칸수 - 1):
            칸들['칸%d' % i] = 몸        # 여정 양끝 라벨의 앵커
    글자등(단추들, 위치=(0.15, -2.4, gz - 0.55), 크기=2.2, 힘=38).name = '단추등'

    # ── ② 오늘의 성장 카드 — 코치 한 줄이 앉을 그릇(본문은 PIL 층) ──────────────────────
    카드 = 베개몸((1.21, 0.09, 0.62), 위치=(0, 0.5, 0.335), 크리스=0.80, 레벨=4)
    카드.data.materials.append(직물결(매끈재질('성장카드', 색['Ink'], 거칠기=0.95), 규모=180.0, 세기=0.055))
    키제외.append(카드)
    칸들['카드'] = 카드
    cw, ch = 1.21 - 0.09, 0.62 - 0.09
    러닝스티치(둥근사각걷기(cw, ch, 0.10, 0.115), 0.40, (0, 0.335),
             매끈재질('카드실', 색['Deep Wool'], 거칠기=0.78), 0.040, 0.0085, 손, 흔들=0.004, 각흔들=4.0)

    # ── ④ 탭바 — 오늘 · 나의 성장 · 소식(전수분석 §1 「탭 3개」) ───────────────────────
    #   화면 바닥 330px 자리에 선다. 탭바는 «조용해야» 한다 — 4계 ②의 가장 밝은 것은 본문이고,
    #   코랄 신호는 게이지의 «지금 칸» 하나가 이미 쓰고 있다. 그래서 여기엔 색을 안 쓴다.
    #   지금 탭은 «실땀 밑줄» 한 도막으로 표시한다 — 화면의 다른 표시(꿰맴·테두리)와 같은 문법.
    if 인자.get('탭바', '있음') != '없음':
        탭z = -2.06
        탭판 = 베개몸((1.38, 0.07, 0.26), 위치=(0, 0.62, 탭z), 크리스=0.50, 레벨=3)
        탭판.data.materials.append(직물결(매끈재질('탭천', 색['Ink'], 거칠기=0.96), 규모=170.0, 세기=0.05))
        키제외.append(탭판)
        칸들['탭바'] = 탭판
        탭자리 = (-0.78, 0.0, 0.78)          # 오늘 · 나의 성장 · 소식
        for 번, tx in enumerate(탭자리):
            앵 = 베개몸((0.34, 0.02, 0.17), 위치=(tx, 0.55, 탭z + 0.01), 크리스=0.9)
            앵.hide_render = True             # 글자가 자기 칸을 묻는 앵커(렌더엔 안 나온다)
            칸들['탭%d' % 번] = 앵
        # 지금 탭(나의 성장 = 가운데) — 실땀 한 도막
        밑실 = 매끈재질('탭실', 색['Deep Wool'], 거칠기=0.78)
        for i in range(7):
            t = (i + 0.5) / 7
            땀하나(-0.20 + 0.40 * t + 손.uniform(-0.003, 0.003), 0.55,
                  탭z + 0.155 + 손.uniform(-0.003, 0.003),
                  0.020 * 손.uniform(0.92, 1.08), 0.0085, 밑실, 회전y=손.uniform(-4, 4))

    # ── ③ 도전 기록 · 성장 기록 — 따로 세는 두 칸(D+1 확정) ────────────────────────────
    for 번, cx in enumerate((-0.63, 0.63)):
        기 = 베개몸((0.58, 0.1, 0.38), 위치=(cx, 0.50, -1.12), 크리스=0.66)
        기.data.materials.append(직물결(매끈재질('기록칸', 색['Ink'], 거칠기=0.95), 규모=160.0, 세기=0.045))
        키제외.append(기)
        칸들['기록%d' % (번 + 1)] = 기
    return (0, -12.0, 0.35), 90

def 오늘판():
    """「오늘」 탭 — 조합판(퀴즈)·성장판(나의 성장)에 이은 **세 번째 화면**(트랙 §2-A 「다음 차례」).
    성장판이 «어디까지 왔나»를 그린다면 이 화면은 «오늘 무엇을 하나»를 그린다.
      ① 오늘의 도전 — 하루의 «한 가지». 학7(목소리 제출)이 기본이고 학8(출석)·학4(퀴즈)가 확정대로
         여기로 흡수됐다. 화면의 **유일한 코랄**은 이 카드 아래 「시작 실」 한 도막이다.
      ② 할 일 셋 — 숙제(학1) · 대화(학6) · 강의(학9). 완료는 **꿰맨 단추의 켬/끔**으로 읽는다.
      ③ 탭바 — 지금 탭이 «오늘»(왼쪽)이라 실땀 밑줄이 첫 칸에 선다.

    🔑 **새 부품이 0개다.** 그릇(카드)·꿰맴(단추토글)·밑줄(실땀)은 앞 두 화면이 이미 세운 문법이라
       학생이 화면마다 새로 배우지 않는다 — 성장판이 판정문의 「도장」을 새로 그리지 않고 단추의
       켬/끔으로 낸 것과 같은 판단이다. 여기서 늘어난 것은 «자리»뿐이다.

    🔑 코랄이 두 곳에 안 서게 «층위»로 가른다 — 밑줄은 두 번 쓰이는데(도전 카드 · 탭바) **조용한
       것은 무채, 지금 할 것은 코랄**이다. 같은 문법을 색으로만 갈라야 학생이 규칙을 하나만 익힌다.

    뺀 것: **개인 코치 카드(N15)** 는 성장판이 「오늘의 성장 카드」로 이미 쓴다 — 두 탭에 같은 카드를
       두면 «오늘»이 성장 탭의 요약본으로 읽힌다. **첨삭 도착(학2)** 은 소식 탭 몫이다.
    글자는 전부 PIL 층 몫이다 — 여기서 굽는 것은 «그릇»뿐이다(오브제 글자 1점도 이 화면엔 없다)."""
    손 = random.Random(20260822)

    # ⓪ 배경천 — 조합판·성장판과 같은 무대. 세 화면이 한 세계로 읽히려면 여기가 안 갈려야 한다.
    배경 = 베개몸((2.6, 0.06, 5.2), 위치=(0, 1.05, 0.2), 크리스=0.12, 레벨=3)
    배경.data.materials.append(직물결(매끈재질('배경천', 색['Ink Deep'], 거칠기=0.97), 규모=90.0, 세기=0.085))
    키제외.append(배경)
    글자등([배경], 위치=(-1.2, -3.2, 2.6), 크기=3.0, 힘=90).name = '배경등'

    실재 = 매끈재질('실', 색['Deep Wool'], 거칠기=0.78)
    몸재 = 매끈재질('단추', 색['Stone'], 거칠기=0.55)
    구멍재 = 매끈재질('구멍', 색['Deep Wool'], 거칠기=0.92)
    지금실 = 매끈재질('지금실', 색[염료이름], 거칠기=0.42)
    X보정 = float(인자.get('X보정', '0.004'))     # 성장판과 같은 광학 보정(단추 X 가 왼쪽으로 1.5px 밀린다)
    단추들 = []

    def 단추(cx, cz, 깊이, 꿰맴, r=0.085):
        """할 일 한 줄의 «했나» — 성장판 게이지 칸과 같은 단추토글 축소판이다.
        r 도 게이지와 같은 0.085 다 — 줄 전폭(0.38)의 45% 라 «누를 것»으로 읽힌다."""
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=0.038, location=(cx, 깊이, cz),
                                            rotation=(math.radians(90), 0, 0))
        몸 = bpy.context.object
        bev = 몸.modifiers.new('bev', 'BEVEL')
        bev.width = r * 0.13
        bev.segments = 8
        bpy.ops.object.shade_smooth()
        몸.data.materials.append(몸재)
        키제외.append(몸)
        단추들.append(몸)
        for dx, dz in ((-0.33, 0.33), (0.33, 0.33), (-0.33, -0.33), (0.33, -0.33)):
            bpy.ops.mesh.primitive_cylinder_add(radius=r * 0.10, depth=0.005,
                                                location=(cx + dx * r, 깊이 - 0.0205, cz + dz * r),
                                                rotation=(math.radians(90), 0, 0))
            구멍 = bpy.context.object
            bpy.ops.object.shade_smooth()
            구멍.data.materials.append(구멍재)
            단추들.append(구멍)
        if 꿰맴:
            for (x1, z1, x2, z2) in ((-0.33, 0.33, 0.33, -0.33), (-0.33, -0.33, 0.33, 0.33)):
                각 = math.degrees(math.atan2(z2 - z1, x2 - x1))
                땀하나(cx + (x1 + x2) / 2 * r + X보정, 깊이 - 0.024, cz + (z1 + z2) / 2 * r,
                      math.hypot(x2 - x1, z2 - z1) * r / 2, r * 0.085, 실재, 회전y=-각)
        return 몸

    # ── ① 오늘의 도전 — 하루의 «한 가지»가 앉을 큰 그릇 ────────────────────────────────
    #   성장판 카드(반높 0.62)보다 크다(0.70). 이 화면에서 가장 큰 것이 «오늘 할 일»이어야
    #   화면이 무엇을 시키는지가 한 눈에 읽힌다 — 4계 ②의 자리 배치판이다.
    #   ⚠**`베개몸` 의 `크기` 는 반폭이다**(`cube_add(size=2)` 에 scale 을 건다) — 전폭으로 읽으면
    #     칸이 두 배로 서서 서로 파묻힌다. 1판에서 정확히 그 일이 났다(세 줄이 한 덩어리가 됐다).
    #     세로 예산 실측: 보이는 z 는 **+2.94 … −2.32** 이고 탭바가 −1.80 아래를 쓴다.
    도전z = 1.32
    도전 = 베개몸((1.21, 0.09, 0.70), 위치=(0, 0.5, 도전z), 크리스=0.80, 레벨=4)
    도전.data.materials.append(직물결(매끈재질('도전카드', 색['Ink'], 거칠기=0.95), 규모=180.0, 세기=0.055))
    키제외.append(도전)
    칸들['도전'] = 도전
    러닝스티치(둥근사각걷기(1.21 - 0.09, 0.70 - 0.09, 0.10, 0.115), 0.40, (0, 도전z),
             매끈재질('도전실', 색['Deep Wool'], 거칠기=0.78), 0.040, 0.0085, 손, 흔들=0.004, 각흔들=4.0)

    # 시작 실 — 화면의 «유일한» 코랄. 탭 밑줄과 같은 문법이고 층위만 다르다.
    #   ⚠여기 말고 어디에도 코랄을 두지 않는다(성장판의 「지금 칸」 하나와 같은 예산).
    #   ⚠**왼쪽 정렬이다.** 가운데에 두면 «무엇을» 밑줄 치는지가 안 읽힌다 — 글은 왼쪽에서
    #     시작하므로 밑줄도 거기서 시작해야 한 덩어리로 읽힌다(본문 층 좌여백 124px 과 같은 선).
    #   ⚠깊이(0.40)는 카드 앞면(0.5 − 0.09 = 0.41)보다 «앞»이어야 한다 — 1판은 0.42 로 앞면에
    #     걸쳐 반쯤 파묻혀 아예 안 보였다. 러닝스티치가 0.40 을 쓰는 것과 같은 까닭이다.
    for i in range(7):
        t = (i + 0.5) / 7
        땀하나(-0.89 + 0.90 * t + 손.uniform(-0.004, 0.004), 0.40,
              도전z - 0.48 + 손.uniform(-0.004, 0.004),
              0.036 * 손.uniform(0.92, 1.08), 0.0105, 지금실, 회전y=손.uniform(-4, 4))

    # ── ② 할 일 셋 — 숙제·대화·강의. 첫 줄만 꿰매져 있다(했다) ──────────────────────────
    #   ⚠단추 깊이는 «칸 앞면 − 0.015» 다 — 성장판이 천 앞면 0.99 에 0.975 를 놓은 그 비례다.
    #     칸 앞면 = 0.5 − 0.08 = 0.42 이므로 0.405. 깊이가 어긋나면 같은 x 가 화면에서 밀린다.
    할일깊이 = 0.405
    for 번, hz in enumerate((0.06, -0.42, -0.90)):
        줄 = 베개몸((1.21, 0.08, 0.19), 위치=(0, 0.5, hz), 크리스=0.66, 레벨=3)
        줄.data.materials.append(직물결(매끈재질('할일칸', 색['Ink'], 거칠기=0.95), 규모=160.0, 세기=0.045))
        키제외.append(줄)
        칸들['할일%d' % 번] = 줄
        단추(-0.98, hz, 할일깊이, 꿰맴=(번 == 0))
    글자등(단추들, 위치=(0.15, -2.4, -0.97), 크기=2.2, 힘=38).name = '단추등'

    # ── ③ 탭바 — 지금 탭이 «오늘»이라 밑줄이 첫 칸에 선다 ──────────────────────────────
    #   성장판과 같은 치수·같은 자리다. 갈리면 탭 전환이 «화면이 바뀌는» 것이 아니라
    #   «앱이 바뀌는» 것으로 읽힌다.
    if 인자.get('탭바', '있음') != '없음':
        탭z = -2.06
        탭판 = 베개몸((1.38, 0.07, 0.26), 위치=(0, 0.62, 탭z), 크리스=0.50, 레벨=3)
        탭판.data.materials.append(직물결(매끈재질('탭천', 색['Ink'], 거칠기=0.96), 규모=170.0, 세기=0.05))
        키제외.append(탭판)
        칸들['탭바'] = 탭판
        탭자리 = (-0.78, 0.0, 0.78)          # 오늘 · 나의 성장 · 소식
        for 번, tx in enumerate(탭자리):
            앵 = 베개몸((0.34, 0.02, 0.17), 위치=(tx, 0.55, 탭z + 0.01), 크리스=0.9)
            앵.hide_render = True             # 글자가 자기 칸을 묻는 앵커(렌더엔 안 나온다)
            칸들['탭%d' % 번] = 앵
        밑실 = 매끈재질('탭실', 색['Deep Wool'], 거칠기=0.78)
        for i in range(7):
            t = (i + 0.5) / 7
            땀하나(탭자리[0] - 0.20 + 0.40 * t + 손.uniform(-0.003, 0.003), 0.55,
                  탭z + 0.155 + 손.uniform(-0.003, 0.003),
                  0.020 * 손.uniform(0.92, 1.08), 0.0085, 밑실, 회전y=손.uniform(-4, 4))

    return (0, -12.0, 0.35), 90


def 밤판(반폭=0.98, 반높=None):
    """모든 «세운 요소»가 서는 밤천 판 — 기호·도장·게이지·조작 부품이 **같은 땅** 위에 선다.
    판이 형태마다 갈리면, 세트로 늘어놨을 때 물건마다 다른 방에서 온 것으로 읽힌다.
    「투명=1」 이면 같은 자리에 **그림자 받이**로 선다 — 몸에서는 사라지고 접지에만 남는다."""
    반높 = 반폭 if 반높 is None else 반높
    판 = 베개몸((반폭, 0.055, 반높), 크리스=0.34, 레벨=4)
    판.data.materials.append(직물결(매끈재질('밤천', 색['Ink'], 거칠기=0.96), 지름=반폭 * 2))
    if 투명:
        판.is_shadow_catcher = True
        그림자받이.append(판)
    return 판

def 실가닥(점들, 굵기, 재질, 이름='가닥'):
    """이어진 실 한 줄 — 땀으로 끊으면 «점선»이 된다(블랭킷 능선 주석과 같은 배움).
    매다는 실·감는 실처럼 «끊기지 않아야 하는» 실은 곡선으로 뽑는다."""
    cu = bpy.data.curves.new(이름, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 굵기
    cu.bevel_resolution = 4
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY')
    sp.points.add(len(점들) - 1)
    for i, (x, y, z) in enumerate(점들):
        sp.points[i].co = (x, y, z, 1)
    o = bpy.data.objects.new(이름, cu)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(재질)
    return o

def 감긴실(축, 시작, 끝, 중심yz, 감, 굵기, 재질, 피치=0.34, 가닥=3, 털이름=None, 털길이=0.014, 털수=3000):
    """트랙 «겉»을 감아 도는 3가닥 꼬임 — 게이지 고리의 직선판(같은 문법이라 같은 실로 읽힌다).
    ⚠감은 반지름은 트랙 살보다 커야 한다 — 작으면 실이 트랙 속에 파묻힌다(게이지 1판 실측)."""
    cy, cz = 중심yz
    N = max(24, int(220 * abs(끝 - 시작) / max(1e-6, 축)))
    for st in range(가닥):
        점 = []
        for i in range(N):
            t = 시작 + (끝 - 시작) * i / (N - 1)
            꼬 = 2 * math.pi * (t - 시작) / 피치 + st * 2 * math.pi / 가닥
            점.append((t, cy + 감 * math.cos(꼬), cz + 감 * math.sin(꼬)))
        o = 실가닥(점, 굵기, 재질, '감%d' % st)
        if 털이름:                      # ⚠곡선엔 털이 안 심긴다 — 메쉬로 바꿔야 «실»이 된다(털실진행바)
            bpy.ops.object.select_all(action='DESELECT')
            o.select_set(True)
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.convert(target='MESH')
            bpy.ops.object.shade_smooth()
            짧은퍼(bpy.context.object, 털이름, 재질, 털재질(털이름, 색[털이름]),
                  길이=털길이, 개수=털수)

def 슬라이더():
    """슬라이더 — 「털실을 당겨 감는다」(사전 1-a). 트랙은 털실진행바 문법, 손잡이는 폼폼.
    당긴 만큼만 실이 감겨 있고 그 끝에 방울이 «잡는 자리»로 앉는다 — 남은 구간은 빈 홈이다.
    「진행=0~1」. 방울은 요소 중 유일하게 «긴» 보풀을 쓴다 — 뻗침이 그 정체성이다(폼폼 주석)."""
    진행 = min(0.94, max(0.08, float(인자.get('진행', '0.58'))))
    밤판(1.50, 0.76)
    트랙 = 베개몸((1.16, 0.10, 0.10), 위치=(0, -0.10, -0.02), 크리스=0.72)
    짧은퍼(트랙, 'Deep Wool', 살재질('Deep Wool', 색['Deep Wool']),
          털재질('Deep Wool', 색['Deep Wool']), 길이=0.026, 개수=9000)
    트랙.particle_systems[-1].settings.clump_factor = 0.62
    실몸 = 매끈재질('실몸', 색[염료이름], 거칠기=0.85, 배율=0.85)
    끝 = -1.16 + 2.32 * 진행
    # 🔑 «털 위에 털을 올리면 뭉갠다» 네 번째 — 실에도 방울에도 심으니 손잡이가 사라졌다(2판 실측).
    #   여기서는 **실은 매끈, 방울은 보풀**이 답이다: 손잡이를 만드는 것은 크기가 아니라 «결의 대비»다.
    감긴실(2.32, -1.16, 끝, (-0.10, -0.02), 0.10 + 0.045, 0.043, 실몸, 피치=0.30)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.155, location=(끝, -0.10, -0.02), segments=40, ring_count=20)
    방울 = bpy.context.object
    bpy.ops.object.shade_smooth()
    짧은퍼(방울, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]),
          길이=0.13, 개수=6000)                 # 방울만 «긴» 보풀 — 손잡이는 잡히는 것이라 부풀어야 한다
    return (0, -7.4, 0.0), 90

def 스테퍼():
    """스테퍼(수량) — 「+1 은 땀 하나 더」(사전 1-a). 수를 숫자로 쓰지 않고 **땀 수로 센다**.
    이미 놓인 땀은 기본색, 다음 두 자리는 분필 점선 — 「아직 안 꿰맨 자리」(밑그림 문법 ①단계).
    ⇒ 늘리기가 «버튼을 누르는 일»이 아니라 «한 땀 더 뜨는 일»이 된다. 「수량=4」."""
    수량 = max(1, min(9, int(float(인자.get('수량', '4')))))
    밤판(1.28, 0.50)
    실재 = 매끈재질('실', 색[염료이름], 거칠기=0.42)
    # ⚠분필을 Stitch(밝은 실색)로 깔면 유령 땀이 코랄 신호보다 «밝게» 떠 신호가 뒤집힌다(1판 실측).
    #   아직 안 꿰맨 자리는 «흐릿해야» 한다 — 한 단 내린 무채로 놓는다.
    분필 = 분필재질('분필', 색['Ash Wool'])    # 무광 가루 — 광택이 서면 «실»로 읽혀 상태가 안 갈린다
    손 = random.Random(20260822)
    폭 = 0.235
    왼 = -폭 * (수량 + 1) / 2
    for i in range(수량 + 2):
        놓임 = i < 수량
        땀하나(왼 + 폭 * i, -0.098, 손.uniform(-0.012, 0.012),
              0.088 * 손.uniform(0.92, 1.08), 0.030 if 놓임 else 0.021,
              실재 if 놓임 else 분필, 회전y=90 + 손.uniform(-6, 6), 납작=not 놓임)
    return (0, -6.8, 0.0), 90

def 토스트():
    """토스트·스낵바 — 「실에 매달려 내려오는 태그」(사전 1-b). 알림은 «떠 있는 상자»가 아니라
    위에서 내려온 물건이다: 두 가닥 실이 화면 밖에서 태그의 두 귀를 잡는다.
    태그는 4.5° 기운다 — **매달린 것은 수평이 아니다**(수평이면 붙인 것이다).
    본문 글자는 굽지 않는다(타이포 불가침) — 신호 점 하나와 «글줄 자리»(분필)만 굽는다."""
    밤판(1.42, 0.98)
    실재 = 매끈재질('실', 색['Stitch'], 거칠기=0.42)
    태그 = 베개몸((0.88, 0.10, 0.28), 위치=(0.02, -0.18, -0.22), 회전z=-4.5, 크리스=0.55)
    # ⚠Oat 보풀은 이 조명에서 통째로 하얗게 뜬다(조각보 실측: Oat·Stone·Ash 가 셋 다 흰 조각) —
    #   태그는 «분필 글줄»이 얹힐 바탕이라 한 단 내린 Stone 이라야 글줄이 산다.
    짧은퍼(태그, 'Stone', 살재질('태그', 색['Stone']), 털재질('태그', 색['Stone']), 길이=0.022, 개수=11000)
    태그.particle_systems[-1].settings.clump_factor = 0.5
    각 = math.radians(-4.5)
    for 옆 in (-1, 1):                          # 매다는 실 둘 — 판 위로 뻗어 «화면 밖»에서 온다
        gx = 0.02 + 옆 * 0.74 * math.cos(각)
        gz = -0.22 + 옆 * 0.74 * math.sin(각) + 0.24
        실가닥([(gx, -0.20, gz), (gx - 옆 * 0.05, -0.20, 0.35), (gx - 옆 * 0.09, -0.20, 1.10)],
              0.014, 실재, '매단실%d' % 옆)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.075, location=(-0.56, -0.30, -0.20), segments=32, ring_count=16)
    점 = bpy.context.object
    bpy.ops.object.shade_smooth()
    짧은퍼(점, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]),
          길이=0.055, 개수=2600)                 # 신호 1점 — 이 판에서 유채는 이것뿐이다(철칙 ④)
    분필 = 분필재질('분필', 색['Stitch'])
    손 = random.Random(20260822)
    for i in range(9):                          # 글줄 자리 — 본문은 HTML 층 몫이라 «자리»만 굽는다
        땀하나(-0.34 + i * 0.115, -0.30, -0.19 + 손.uniform(-0.006, 0.006),
              0.044, 0.017, 분필, 회전y=-4.5, 납작=True)
    return (0, -7.0, 0.0), 90

def 모달():
    """모달·바텀시트 — 「주머니에서 꺼낸 천 조각」(사전 1-b). 닫기는 시접선을 따라 도로 접힘이다.
    그래서 이 판은 «주머니»와 «반쯤 꺼낸 천»을 함께 굽는다 — 열림은 상태가 아니라 **동작**이다.
    ⚠주머니는 천보다 «카메라 쪽»(작은 y)에 있어야 안에서 나온 것이 된다 — 순서가 아니라 깊이가 정한다."""
    밤판(1.30, 1.04)
    카드 = 베개몸((0.94, 0.10, 0.62), 위치=(0.03, -0.02, 0.02), 회전z=-1.8, 크리스=0.5)
    짧은퍼(카드, 'Stone', 살재질('카드', 색['Stone']), 털재질('카드', 색['Stone']), 길이=0.024, 개수=15000)
    카드.particle_systems[-1].settings.clump_factor = 0.5
    주머니 = 베개몸((1.14, 0.17, 0.36), 위치=(0, -0.20, -0.60), 크리스=0.62)
    짧은퍼(주머니, 'Deep Wool', 살재질('주머니', 색['Deep Wool']),
          털재질('주머니', 색['Deep Wool']), 길이=0.03, 개수=14000)
    실재 = 매끈재질('실', 색['Stitch'], 거칠기=0.42)
    손 = random.Random(20260822)
    for i in range(15):                         # 주머니 입구 감침질 — 여기가 «시접선»이다
        x = -1.05 + i * 0.15
        땀하나(x + 손.uniform(-0.006, 0.006), -0.375, -0.235 + 손.uniform(-0.008, 0.008),
              0.075, 0.026, 실재, 회전y=90 + 손.uniform(-7, 7))
    분필 = 분필재질('분필', 색['Stitch'])
    for r in range(3):                          # 카드 위 글줄 자리(본문은 HTML 층 몫)
        for i in range(10 - r * 2):
            땀하나(-0.66 + i * 0.135, -0.14, 0.34 - r * 0.20, 0.05, 0.018, 분필, 회전y=0, 납작=True)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.085, location=(-0.66, -0.14, -0.16), segments=32, ring_count=16)
    점 = bpy.context.object
    bpy.ops.object.shade_smooth()
    짧은퍼(점, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]),
          길이=0.06, 개수=3000)                  # 신호 1점
    return (0, -7.4, 0.0), 90

def 탭전환():
    """탭 전환 — 「천 견본 고리 넘기기」(사전 1-b). 견본 넉 장이 한 고리에 꿰여 부채처럼 펴진다.
    지금 탭만 기본색이고 나머지는 무채 «사다리»(Stone→Ash Wool→Deep Wool) — 신호 1점(철칙 ④).
    🔑 무채를 밝기 사다리로 고르는 것은 조각보 타일의 실측이다 — 같은 단끼리 두면 셋이 한 장으로 읽힌다.
    🔴 1판 실측: 견본의 «중심»을 고리에서 길이만큼 떨어뜨려 두니 견본이 고리에서 시작하지 않았고,
       폭(0.40)이 부챗살 간격보다 커서 넉 장이 통째로 뭉갰다. 견본은 고리에 «꿰여» 시작해야 하고,
       벌어지는 각의 간격이 견본 폭보다 커야 한다(20° × 반지름 0.9 ≈ 0.31 > 폭 0.23)."""
    밤판(1.34, 0.98)
    고리재 = 매끈재질('고리', 색['Stone'], 거칠기=0.32)
    ox, oz = -0.86, 0.06
    bpy.ops.mesh.primitive_torus_add(major_radius=0.155, minor_radius=0.032, location=(ox, -0.30, oz),
                                     rotation=(math.radians(90), 0, 0), major_segments=64, minor_segments=16)
    bpy.ops.object.shade_smooth()
    bpy.context.object.data.materials.append(고리재)
    실재 = 매끈재질('실', 색['Stitch'], 거칠기=0.42)
    손 = random.Random(20260822)
    # 🔴 2판 실측: 부챗살 간격(20°×0.76 ≈ 0.27)이 견본 폭(0.23 + 털 0.04×2 = 0.31)보다 좁아
    #    넉 장이 서로 잡아먹었다. 간격을 벌리고(22°) 폭·털을 줄여 «넉 장»이 넉 장으로 보이게 한다.
    반길, 띄움, 반폭 = 0.74, 0.02, 0.088
    # 무채 사다리는 «아래가 어둡게» — 밝은 둘을 붙여 두면 한 장으로 뭉친다(조각보 실측).
    견본표 = (('Deep Wool', -33.0), ('Ash Wool', -11.0), ('Stone', 11.0), (염료이름, 33.0))
    for i, (이름, 각도) in enumerate(견본표):
        a = math.radians(각도)
        cx = ox + (띄움 + 반길) * math.cos(a)
        cz = oz + (띄움 + 반길) * math.sin(a)
        깊 = -0.14 - 0.07 * i               # 뒤 견본일수록 멀리 — 마지막(지금 탭)이 가장 앞이다
        견본 = 베개몸((반길, 0.05, 반폭), 위치=(cx, 깊, cz), 회전z=각도, 크리스=0.5)
        # 🔑 **지금 탭만 털을 입는다.** 무채 셋에 보풀을 심으면 Deep Wool(#575046)까지 흰 조각으로
        #   씻겨 넉 장이 한 덩어리가 된다(조각보 실측의 재확인 · 3판 실측). 그런데 이 제약이
        #   오히려 뜻과 맞다 — 사전 1-c 의 「현재 탭만 꿰매짐」이 곧 «지금 것만 살아 있다»이다.
        #   안 고른 견본은 눌린 천, 고른 견본은 보풀 선 천 — 상태가 색이 아니라 «결»로 갈린다.
        if i == len(견본표) - 1:
            짧은퍼(견본, 이름, 살재질('견본%d' % i, 색[이름]), 털재질('견본%d' % i, 색[이름]),
                  길이=0.016, 개수=6000)
            견본.particle_systems[-1].settings.clump_factor = 0.5
        else:
            견본.data.materials.append(직물결(매끈재질('견본%d' % i, 색[이름], 거칠기=0.95),
                                           지름=반길 * 2, 세기=0.8))
        for j in range(3):                  # 꿰인 자리 한 줄 — 고리 쪽 끝에만(흩으면 «얼룩»이다)
            t = -반길 + 0.12 + j * 0.10
            땀하나(cx + t * math.cos(a), 깊 - 0.062, cz + t * math.sin(a),
                  0.042, 0.016, 실재, 회전y=-각도 + 90 + 손.uniform(-6, 6))
    return (0, -6.9, 0.0), 90

def 읽음표시():
    """읽음·방문 표시 — 「다림질 자국」(사전 1-b). 상태를 색이나 점으로 말하지 않고 **눌린 결**로 말한다.
    왼쪽 = 안 읽음(보풀이 서 있다) · 오른쪽 = 읽음(다려져 결이 눕고 살짝 윤이 난다).
    단추토글과 같은 축이다 — 상태 차이는 «다른 재료»가 아니라 «손이 지나갔는가»다.
    🔑 그래서 두 칸은 **같은 색**이다. 색을 갈면 이 문법이 죽고 그냥 두 물건이 된다."""
    밤판(1.30, 0.72)
    for cx, 읽음 in ((-0.60, False), (0.60, True)):
        칸 = 베개몸((0.42, 0.11, 0.40), 위치=(cx, -0.11, 0), 크리스=0.55)
        if 읽음:
            # 다린 면 — 털을 걷고 거칠기를 낮춰 윤을 준다. 결은 남되 «눕는다»(촘촘하고 얕게).
            # ⚠거칠기 0.44 는 «지우개»로 읽혔다(1판 실측) — 다린 펠트는 광이 아니라 «눕은 결»이다.
            칸.data.materials.append(직물결(매끈재질('다린칸', 색[염료이름], 거칠기=0.62),
                                          지름=0.84, 촘촘=100.0, 세기=0.8))
        else:
            짧은퍼(칸, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]),
                  길이=0.055, 개수=15000)
            칸.particle_systems[-1].settings.clump_factor = 0.3   # 안 읽음은 «서 있다» — 덜 뭉친다
    return (0, -6.6, 0.0), 90

형태들 = {'오브': 오브, '넘버쿠키': 넘버쿠키, '알약': 알약, '아이콘': 아이콘, '스티치': 스티치, '털실진행바': 털실진행바, '귤': 귤, '도넛': 도넛,
        '단추토글': 단추토글, '밑그림': 밑그림, '페이지점': 페이지점, '폼폼': 폼폼, '시침핀': 시침핀,
        '와펜': 와펜, '블랭킷': 블랭킷, '실패스피너': 실패스피너, '직조라벨': 직조라벨,
        '패턴지판': 패턴지판, '다린천판': 다린천판, '유리판': 유리판,
        '단춧구멍필드': 단춧구멍필드, '스냅': 스냅, '조각보타일': 조각보타일, '매듭': 매듭,
        '앱판': 앱판, '자수글자': 자수글자, '레터프레스': 레터프레스, '라벨태그': 라벨태그,
        '조합판': 조합판, '성장판': 성장판, '오늘판': 오늘판,
        '기호': 기호, '도장': 도장, '게이지고리': 게이지고리,
        '만두': 만두, '김밥': 김밥, '붕어빵': 붕어빵,
        '떡볶이': 떡볶이, '호떡': 호떡, '라면': 라면, '김치': 김치, '딸기': 딸기, '바나나우유': 바나나우유,
        '삼겹살': 삼겹살, '비빔밥': 비빔밥, '치킨': 치킨, '잡채': 잡채,
        '파전': 파전, '김치찌개': 김치찌개, '송편': 송편, '불고기': 불고기,
        '초밥': 초밥, '게장': 게장, '계란찜': 계란찜,
        '슬라이더': 슬라이더, '스테퍼': 스테퍼, '토스트': 토스트,
        '모달': 모달, '탭전환': 탭전환, '읽음표시': 읽음표시}
if 형태 not in 형태들:
    raise SystemExit('모르는 형태: ' + 형태 + ' — 아는 것은 ' + '·'.join(형태들))
그림자받이 = []      # 「투명=1」에서 몸 패스에는 숨고 접지 패스에만 남는 판(밤판이 채운다)
키제외 = []          # 형태가 채우면 키 라이트에서 빠진다 — 밝은 글자가 앉을 그릇을 가라앉히는 «가림» 문법
칸들 = {}            # 형태가 채우면 «그릇의 화면 픽셀 자리»가 굽기 뒤 JSON 으로 나온다 — 본문 층이 손좌표를 안 쓰게
카메라위치, 카메라피치 = 형태들[형태]()

# ── 무대·광 — 검은 무대 · 큰 소프트 키 · 여린 필 · 위 림 ────────────────────
씬.world = bpy.data.worlds.new('무대')
씬.world.use_nodes = True
씬.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)

# 「조명배=」 — 조명 변주는 글자 판(폭 1.35·카메라 6.8) 기준으로 조율됐다. 씬이 큰 형태(오브 판
#   2.23·카메라 12.6)에 그대로 쓰면 키가 상대적으로 작아져 결이 씻긴다(2판 렌더 실측 — 평평했다).
#   위치·크기 ×배 · 힘 ×배²(역제곱 보상 — 함정 ④를 손잡이로 만든 것). 글자 3종 채택값은 배=1 불변.
조명배 = float(인자.get('조명배', '1'))
# 「빛배=」 — 자리는 그대로 두고 **세기만** 곱한다(조명배는 자리까지 옮긴다).
#   🔴 실측 08-22: 음식 무대는 통째로 저노출이었다. 김(Ink Deep · 알베도 0.002)과 밥(Paper · 0.95)이
#      화소 125 vs 132 로 «같게» 찍혔다 — 알베도가 500배 다른데 7 차이다. AgX 뷰 변환의 저역은
#      이렇게 압축이 세서, 어둡게 깔린 장면에서는 무엇을 칠하든 같은 중간 회색으로 눌린다.
#      대비는 재료가 낸다(4계 ①)지만, **재료가 일하려면 노출이 그 자리까지 올라와 있어야 한다.**
빛배 = float(인자.get('빛배', '1'))

def 등(이름, 위치, 회전, 크기, 힘, 빛색=None):
    bpy.ops.object.light_add(type='AREA', location=tuple(v * 조명배 for v in 위치), rotation=회전)
    L = bpy.context.object
    L.data.size = 크기 * 조명배
    L.data.energy = 힘 * 조명배 * 조명배 * 빛배
    if 빛색:
        L.data.color = 빛색          # 색온도 — 요리 사진의 온기는 «칠한 색»이 아니라 빛이 낸다
    L.name = 이름

# 조명 변주(글자공방 08-20 이식) — 형태별 채택 조명이 기본값, 「조명=」 인자로 덮어쓴다.
조명 = 인자.get('조명', {'자수글자': '결광2', '레터프레스': '스침', '라벨태그': '스침',
                                '도장': '결광2', '기호': '결광2',
                                '귤': '식탁', '도넛': '식탁', '넘버쿠키': '식탁',
                                '만두': '식탁', '김밥': '식탁', '붕어빵': '식탁'}.get(형태, '원본'))
if 조명 == '원본':
    등('키', (-2.8, -2.2, 3.4), (math.radians(46), math.radians(-30), 0), 4.0, 1400)
    등('필', (2.6, -2.2, 0.6), (math.radians(78), math.radians(28), 0), 4.0, 80)
    등('림', (0.6, 2.6, 2.8), (math.radians(-42), 0, 0), 3.0, 560)
elif 조명 == '결광2':
    # 펠트 «결»의 조명 — 키를 작고 가깝게(자연 비네트) + 림은 은은한 후광.
    # ⚠조명을 옮겼으면 노출을 다시 계산한다(함정 ④): 결광 키는 원본보다 1.5배 가까워 역제곱으로
    #   두 배 세게 때린다(950@3.4 ≈ 2050@5.1 상당) — 분홍 씻김의 진범. 거리 보정값 = 650.
    등('키', (-1.9, -2.3, 1.6), (math.radians(62), math.radians(-27), 0), 2.2, 650)
    등('필', (2.6, -2.2, 0.5), (math.radians(80), math.radians(27), 0), 4.0, 50)
    등('림', (0.3, 2.4, 2.6), (math.radians(-44), 0, 0), 2.0, 560)
elif 조명 == '식탁':
    # 내려보는 음식 카메라(40~59°) 전용 — 원본·결광2·스침은 전부 «세운 물건»(84~90°)을 위해
    # 조율된 것이라, 수평인 뚜껑에는 빛이 스치기만 한다. 김밥 밥(Paper #FBF7F0)이 화소 150 회색으로
    # 앉은 진범이 이것이다(4판 실측). 키를 머리 위 앞쪽으로 올려 «상 위의 창빛»을 만든다.
    # 색온도는 룸장면 플레이팅 4판의 배움 그대로 — 따뜻한 키 ↔ 살짝 찬 반사판이 입체를 만든다.
    등('키', (-2.2, -3.0, 5.2), (math.radians(27.8), math.radians(-22.7), 0), 5.0, 2000,
      빛색=(1.0, 0.86, 0.72))
    등('필', (3.2, -2.4, 2.2), (math.radians(31.8), math.radians(55.8), 0), 4.0, 240,
      빛색=(0.86, 0.92, 1.0))
    등('림', (0, 3.4, 3.0), (math.radians(-48.6), 0, 0), 3.0, 700)
elif 조명 == '스침':
    # 압인의 조명 — 빛이 표면을 왼쪽에서 스치면 눌린 홈의 그늘이 깊어진다.
    # ⚠스침광은 33°가 하한(함정 ⑤) — 14° 는 코사인 소멸로 면이 통째로 꺼진다(시험 실측).
    등('키', (-3.0, -1.6, 1.2), (math.radians(33), math.radians(-63), 0), 3.0, 1300)
    등('필', (2.6, -2.2, 0.5), (math.radians(80), math.radians(27), 0), 4.0, 120)
    등('림', (0.6, 2.6, 2.8), (math.radians(-42), 0, 0), 3.0, 300)
else:
    raise SystemExit('모르는 조명: ' + 조명 + ' — 아는 것은 원본·결광2·스침·식탁')

if 키제외:
    # «가림» 문법 — 키제외 목록의 그릇들은 키를 안 받는다(필·림만) → 밝은 글자의 땅으로 가라앉는다.
    받는 = bpy.data.collections.new('키_받는것')
    씬.collection.children.link(받는)
    빠질 = set(o.name for o in 키제외)
    for o in bpy.data.objects:
        if o.type in ('MESH', 'CURVE', 'FONT', 'SURFACE') and o.name not in 빠질:
            받는.objects.link(o)
    bpy.data.objects['키'].light_linking.receiver_collection = 받는

bpy.ops.object.camera_add(location=카메라위치, rotation=(math.radians(카메라피치), 0, 0))
씬.camera = bpy.context.object
씬.camera.data.lens = 85

씬.render.engine = 'CYCLES'
씬.cycles.samples = 견본
씬.cycles.use_denoising = True
# 🔑 디노이저에 «가이드»를 준다 — 맨 RGB 디노이즈는 가는 털을 페인팅으로 뭉갠다(선명도 실측 08-21).
#   albedo·normal 패스가 있으면 디노이저가 결의 자리를 알아 털을 «지우지 않고» 노이즈만 걷는다.
try:
    씬.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    씬.cycles.denoising_prefilter = 'ACCURATE'
except (AttributeError, TypeError) as 왜:
    print('디노이즈 가이드 실패(기본으로 간다):', 왜)
씬.render.film_transparent = 투명      # 「투명=1」 — 배경을 알파로 비운다(부품 통로)
씬.render.resolution_x = 너비
씬.render.resolution_y = int(너비 * float(인자.get('비율', '0.82')))   # 조합판 = 1.9(폰 세로)
씬.render.filepath = 출력

# ── 그릇의 «화면 자리»를 함께 낸다 — 본문 층(PIL)이 손좌표를 짚지 않게 ──────────────
#   까닭: 본문 좌표(150/596/692…)는 2차 카드의 크기에 손으로 맞춘 값이라, 카드를 줄이면
#   글이 카드 밖으로 새거나 위로 쏠린다. 그릇이 자기 자리를 말하게 하면 판마다 다시 안 잰다.
if 칸들:
    from bpy_extras.object_utils import world_to_camera_view
    표 = {}
    for 이름, o in 칸들.items():
        점 = [world_to_camera_view(씬, 씬.camera, v) for v in 상자(o)]
        xs = [p.x * 씬.render.resolution_x for p in 점]
        ys = [(1 - p.y) * 씬.render.resolution_y for p in 점]
        표[이름] = {'좌': min(xs), '우': max(xs), '위': min(ys), '아래': max(ys)}
    with open(출력 + '.칸.json', 'w', encoding='utf-8') as f:
        json.dump(표, f, ensure_ascii=False, indent=1)
    print('칸:', 표)


def GPU켜기():
    """있는 GPU 백엔드 하나를 켜고 이름을 낸다 — 없으면 False(클라우드 bpy 통로가 이 갈래다)."""
    try:
        사전 = bpy.context.preferences.addons['cycles'].preferences
    except (KeyError, AttributeError):
        return False
    for 종류 in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
        try:
            사전.compute_device_type = 종류
            사전.get_devices()
        except Exception:
            continue
        if any(d.type == 종류 for d in 사전.devices):
            for d in 사전.devices:
                d.use = (d.type == 종류)
            return 종류
    return False


# ── 굽는 장치 — **GPU 먼저 · 죽으면 그 자리에서 CPU 로 되문다** (유호 확정 08-20) ──────────
# 왜 되물림이 필요한가 (실측 08-20 · 노트북 Arc B390):
#   · GPU 가 2.1배 빠르고(스냅 1152px/128샘플 76초 vs 160초) **출력은 픽셀 동일**하다
#     (표본 106,097 · 평균 차이 0.10/255 · 최대 3) — 세트 일관성 위험은 0이다.
#   · 그런데 털이 무거운 형태는 OUT_OF_RESOURCES 로 **죽는다**(매듭 2회 재현). 내장 GPU라
#     수백만 가닥이 어차피 같은 시스템 RAM 을 쓴다 — 「GPU 로 옮기면 메모리가 는다」가 아니다.
#   ⇒ 그래서 장치를 고르는 게 아니라 **순서**를 박는다. 되는 형태는 GPU 가 빠르게, 안 되는
#     형태는 CPU 가 조용히 완주한다. 「장치=CPU」로 부르면 GPU 를 아예 안 건드린다.
장치 = 인자.get('장치', 'GPU').upper()
켠것 = GPU켜기() if 장치 == 'GPU' else False
if 켠것:
    print('GPU:', 켠것)
    씬.cycles.device = 'GPU'
else:
    씬.cycles.device = 'CPU'

def 그리기(경로):
    """한 장 찍는다 — GPU 먼저, 죽으면 그 자리에서 CPU 로 되문다(유호 확정 08-20).
    ⚠되물린 뒤에도 다음 장을 GPU 로 되돌리지 않는다 — 한 세트 안에서 장치가 오락가락하면
      «왜 이 장만 다른가»를 나중에 못 푼다(픽셀은 같지만 실패 자리는 같지 않다)."""
    global 켠것
    씬.render.filepath = 경로
    try:
        bpy.ops.render.render(write_still=True)
    except RuntimeError as 왜:      # OUT_OF_RESOURCES 류 — 판정하지 않고 되문다(장면마다 한계가 다르다)
        print('GPU 가 죽어 CPU 로 되문다:', 왜)
        씬.cycles.device = 'CPU'
        켠것 = False
        bpy.ops.render.render(write_still=True)

if 투명:
    # 두 패스 — 몸(받이 숨김)과 접지(몸을 «카메라에서만» 숨김: 그림자는 계속 진다).
    바탕 = 출력[:-4] if 출력.lower().endswith('.png') else 출력
    몸들 = [o for o in bpy.data.objects
           if o.type in ('MESH', 'CURVE', 'FONT', 'SURFACE') and o not in 그림자받이]
    for 받이 in 그림자받이:
        받이.hide_render = True
    그리기(바탕 + '_몸')
    for 받이 in 그림자받이:
        받이.hide_render = False
    for o in 몸들:
        o.visible_camera = False
    그리기(바탕 + '_접지')
    for o in 몸들:
        o.visible_camera = True
else:
    그리기(출력)
print('구움:', 형태, 출력, '샘플', 견본, '염료', 염료이름, 색.get(염료이름),
      '장치', 켠것 or 'CPU')

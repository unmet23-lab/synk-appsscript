# 요소굽기 — UI·UX 요소를 «실물»로 굽는다 (조항 ⓘ 집행급 · 유호 확정 08-19 「짧은 퍼」)
# 퍼프로브.py 의 승격판. 형태별로 몸을 짓고 짧은 퍼를 심어 Cycles 로 찍는다.
#   python3 -c "import sys; sys.argv=['x','--','형태=오브','색=Coral','샘플=96','너비=900','출력=/tmp/판.png']; exec(open('tools/요소굽기.py').read())"
# 형태: 오브 · 알약 · 아이콘 · 스티치 · 털실진행바(진행=0~1) · 단추토글 · 밑그림 · 페이지점 · 폼폼 · 시침핀 · 와펜 · 블랭킷 · 실패스피너 · 직조라벨
#      · 패턴지판 · 다린천판 · 유리판 · 단춧구멍필드 · 스냅 · 조각보타일 · 매듭 · 앱판(재질=패턴지|유리|다린천)
#      · 자수글자 · 레터프레스(등힘=90) · 라벨태그(등힘=80)
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
    판.data.materials.append(직물결(매끈재질(받침이름, 색[받침색], 거칠기=0.96), 규모=200.0, 세기=0.045))

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
    # 구도 실측 08-22 — 「내용이 화면 끝에 닿는가」 전수 측정에서 잡힌 잘림을 고친 값이다.
    #   🔑 거리만이 아니라 «중심»이 문제였다: 1.5배 물려도 내용이 58×74% 인데 여백이 2.3% 였다
    #   (크기 탓이면 13% 가 남았어야 한다). 그래서 손을 둘로 나눈다 — 중심 보정 + 거리.
    #   값은 눈이 아니라 계산이다(4계 ④): 탐침 렌더의 내용 bbox 를 화각(85mm·23.9°)으로
    #   월드 좌표에 되돌려 «중심 밀림»과 «채운 비율»을 얻고, 목표 84% 에 맞는 거리를 역산했다.
    #   아이콘 = 위로 0.50 · 1.32배 물림 — 겹친 두 스쿼클이 둘 다 위로 잘려 「겹침」이 안 읽혔다.
    return (0.148, -11.589, 0.99), 86

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

결깊이배 = 0.44   # 「세기」(호출자 눈금) → Bump Distance(월드 깊이) 환산.
                  # 눈금 = 다린천 실측 08-22: 세기 0.045 → 깊이 0.02 → 상대 대비 2.8%(눈 문턱 ≈1%).
                  # 0.006(1.2%)은 아직 종이 · 0.06(4.2%)은 스터코로 읽혀 기각 — 0.02 가 눌린 부직포다.

def 직물결(m, 규모=200.0, 세기=0.05):
    """민무늬 살 위에 미세 결 — 매끈 슬라브는 도자기로 읽힌다(시안2027 실측).
    펠트·다린 천은 부직포라 짜임이 아니라 «알갱이 결»이 맞다 — 노이즈 범프."""
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 규모
    noise.inputs['Detail'].default_value = 6.0
    bump = nt.nodes.new('ShaderNodeBump')
    # 🔑 **Distance 를 안 주면 이 함수는 통째로 무동작이다** (실측 08-22).
    #   Bump 의 실효 왜곡 = Strength × Distance × 기울기인데, 블렌더가 Distance 를 0.001 로
    #   두고 시작한다. 그래서 세기를 8배(0.045→0.36) 올리고 규모를 25배(200→8) 바꿔도
    #   판 안 평균차가 0.0145/255 — 렌더 잡음과 구분이 안 됐다. 「민무늬는 도자기로 읽힌다」며
    #   만든 결이 16곳 전부에서 한 번도 안 나오고 있었다.
    #   ⇒ Strength 는 1.0 으로 열고, 호출자 눈금 「세기」를 실제 깊이(Distance)로 옮긴다.
    bump.inputs['Strength'].default_value = 1.0
    bump.inputs['Distance'].default_value = 세기 * 결깊이배
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
    # 구도 실측 08-22 — 「내용이 화면 끝에 닿는가」 전수 측정에서 잡힌 잘림을 고친 값이다.
    #   🔑 거리만이 아니라 «중심»이 문제였다: 1.5배 물려도 내용이 58×74% 인데 여백이 2.3% 였다
    #   (크기 탓이면 13% 가 남았어야 한다). 그래서 손을 둘로 나눈다 — 중심 보정 + 거리.
    #   값은 눈이 아니라 계산이다(4계 ④): 탐침 렌더의 내용 bbox 를 화각(85mm·23.9°)으로
    #   월드 좌표에 되돌려 «중심 밀림»과 «채운 비율»을 얻고, 목표 84% 에 맞는 거리를 역산했다.
    #   단추토글 = 중심 맞음 · 1.42배 물림 — 두 단추가 좌우로 잘려 나갔다.
    return (0, -11.333, 0.0), 90

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
    # 구도 실측 08-22 — 「내용이 화면 끝에 닿는가」 전수 측정에서 잡힌 잘림을 고친 값이다.
    #   🔑 거리만이 아니라 «중심»이 문제였다: 1.5배 물려도 내용이 58×74% 인데 여백이 2.3% 였다
    #   (크기 탓이면 13% 가 남았어야 한다). 그래서 손을 둘로 나눈다 — 중심 보정 + 거리.
    #   값은 눈이 아니라 계산이다(4계 ④): 탐침 렌더의 내용 bbox 를 화각(85mm·23.9°)으로
    #   월드 좌표에 되돌려 «중심 밀림»과 «채운 비율»을 얻고, 목표 84% 에 맞는 거리를 역산했다.
    #   블랭킷 = 중심은 맞았고 크기만 컸다(1.21배 물림) — 털이 네 변을 다 넘어 «질감 접사»로 읽혔다.
    return (0, -10.2, 0.0), 90

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
    천재 = 직물결(매끈재질('라벨천', 색['Oat'], 거칠기=0.88))
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
    # 구도 실측 08-22 — 「내용이 화면 끝에 닿는가」 전수 측정에서 잡힌 잘림을 고친 값이다.
    #   🔑 거리만이 아니라 «중심»이 문제였다: 1.5배 물려도 내용이 58×74% 인데 여백이 2.3% 였다
    #   (크기 탓이면 13% 가 남았어야 한다). 그래서 손을 둘로 나눈다 — 중심 보정 + 거리.
    #   값은 눈이 아니라 계산이다(4계 ④): 탐침 렌더의 내용 bbox 를 화각(85mm·23.9°)으로
    #   월드 좌표에 되돌려 «중심 밀림»과 «채운 비율»을 얻고, 목표 84% 에 맞는 거리를 역산했다.
    #   판 3종 = 오른쪽으로 0.44 · 1.49배 물림 — 판 뒤 코랄 구슬이 오른쪽에서 잘렸다.
    #   ⚠셋은 «대조 세트»라 카메라가 같아야 한다 — 한 판만 옮기면 그 비교가 무효가 된다.
    return (0.441, -10.146, 0.115), 90

def 다린천판():
    """다린 무광 천 판 — 카드·판 바닥 «후보»(은퇴 미확정 08-20 — 실물 대조 후 확정): 결을 눕힌
    무채 천. 광택 0 · 결 최소 — 다림질 자국의 «눌린» 면. 뒤구가 «막혀» 보이는 것이 이 판의 답이다."""
    판뒤구()
    재질, 두께 = 판재질('다린천')
    판 = 베개몸((1.35, 두께, 0.95), 크리스=0.34, 레벨=4)
    판.data.materials.append(재질)
    # 구도 실측 08-22 — 「내용이 화면 끝에 닿는가」 전수 측정에서 잡힌 잘림을 고친 값이다.
    #   🔑 거리만이 아니라 «중심»이 문제였다: 1.5배 물려도 내용이 58×74% 인데 여백이 2.3% 였다
    #   (크기 탓이면 13% 가 남았어야 한다). 그래서 손을 둘로 나눈다 — 중심 보정 + 거리.
    #   값은 눈이 아니라 계산이다(4계 ④): 탐침 렌더의 내용 bbox 를 화각(85mm·23.9°)으로
    #   월드 좌표에 되돌려 «중심 밀림»과 «채운 비율»을 얻고, 목표 84% 에 맞는 거리를 역산했다.
    #   판 3종 = 오른쪽으로 0.44 · 1.49배 물림 — 판 뒤 코랄 구슬이 오른쪽에서 잘렸다.
    #   ⚠셋은 «대조 세트»라 카메라가 같아야 한다 — 한 판만 옮기면 그 비교가 무효가 된다.
    return (0.441, -10.146, 0.115), 90

def 유리판():
    """서리 유리 판 — 정보 판의 현직(은퇴 미확정 — 유호 정정 08-20 「지금 굽고 있어」).
    패턴지판과 같은 구도·조명·크기, 재질만 유리. 시접선은 재단지 고유 장식이라 없다."""
    판뒤구()
    재질, 두께 = 판재질('유리')
    판 = 베개몸((1.35, 두께, 0.95), 크리스=0.38, 레벨=4)
    판.data.materials.append(재질)
    # 구도 실측 08-22 — 「내용이 화면 끝에 닿는가」 전수 측정에서 잡힌 잘림을 고친 값이다.
    #   🔑 거리만이 아니라 «중심»이 문제였다: 1.5배 물려도 내용이 58×74% 인데 여백이 2.3% 였다
    #   (크기 탓이면 13% 가 남았어야 한다). 그래서 손을 둘로 나눈다 — 중심 보정 + 거리.
    #   값은 눈이 아니라 계산이다(4계 ④): 탐침 렌더의 내용 bbox 를 화각(85mm·23.9°)으로
    #   월드 좌표에 되돌려 «중심 밀림»과 «채운 비율»을 얻고, 목표 84% 에 맞는 거리를 역산했다.
    #   판 3종 = 오른쪽으로 0.44 · 1.49배 물림 — 판 뒤 코랄 구슬이 오른쪽에서 잘렸다.
    #   ⚠셋은 «대조 세트»라 카메라가 같아야 한다 — 한 판만 옮기면 그 비교가 무효가 된다.
    return (0.441, -10.146, 0.115), 90

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
    바닥.data.materials.append(직물결(매끈재질('밤천', 색['Ink'], 거칠기=0.96), 규모=200.0, 세기=0.045))
    본문 = 인자.get('본문', '가')
    bpy.ops.object.text_add()
    t = bpy.context.object
    t.data.body = 본문
    글자체(t)
    t.data.size = 1.28
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
    for (px, py, 각) in 글자곡선표본(본문, 1.28, 간격=0.115):
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
    라벨.data.materials.append(직물결(매끈재질('라벨천', 색['Oat'], 거칠기=0.88)))
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
    # 구도 실측 08-22 — 「내용이 화면 끝에 닿는가」 전수 측정에서 잡힌 잘림을 고친 값이다.
    #   🔑 거리만이 아니라 «중심»이 문제였다: 1.5배 물려도 내용이 58×74% 인데 여백이 2.3% 였다
    #   (크기 탓이면 13% 가 남았어야 한다). 그래서 손을 둘로 나눈다 — 중심 보정 + 거리.
    #   값은 눈이 아니라 계산이다(4계 ④): 탐침 렌더의 내용 bbox 를 화각(85mm·23.9°)으로
    #   월드 좌표에 되돌려 «중심 밀림»과 «채운 비율»을 얻고, 목표 84% 에 맞는 거리를 역산했다.
    #   매듭 = 아래로 0.28 · 1.36배 물림 — 로제트 아래 꼬리가 잘렸다.
    return (0, -16.565, -0.276), 90


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

def 음식접시(천색='Ink'):
    """음식이 놓이는 접시 — 직물결 천을 «눕힌» 바닥판. 플레이팅의 접시 그 자체.
    ⚠오브 받침은 84° 수평 카메라용 «세운 판»이라 내려보기(59°)에서 벽처럼 기운다(1차 렌더 실측)
    — 음식 접시는 z 가 얇은 바닥판이어야 한다."""
    판 = 베개몸((1.75, 1.35, 0.10), 위치=(0, 0.1, -0.12), 크리스=0.30, 레벨=3)
    판.data.materials.append(직물결(매끈재질('접시천', 색[천색], 거칠기=0.96), 규모=200.0, 세기=0.045))
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
    # 꼭지 — 위 중앙의 짧은 초록 그루터기
    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.1, location=(0, 0, 1.04))
    꼭지 = bpy.context.object
    bpy.ops.object.shade_smooth()
    꼭지.data.materials.append(직물결(매끈재질('꼭지', 색['Meadow Deep'], 거칠기=0.95), 규모=150.0, 세기=0.06))
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
    return (0, -8.8, 5.6), 59                       # 식탁 내려보기 — 음식은 위에서 봐야 맛있다

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
    글레이즈.data.materials.append(직물결(매끈재질('글레이즈', 색[염료이름], 거칠기=0.88), 규모=170.0, 세기=0.05))
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
    return (0, -8.8, 5.6), 59


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
    라벨.data.materials.append(직물결(매끈재질('라벨천', 색['Oat'], 거칠기=0.88)))
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

형태들 = {'오브': 오브, '알약': 알약, '아이콘': 아이콘, '스티치': 스티치, '털실진행바': 털실진행바, '귤': 귤, '도넛': 도넛,
        '단추토글': 단추토글, '밑그림': 밑그림, '페이지점': 페이지점, '폼폼': 폼폼, '시침핀': 시침핀,
        '와펜': 와펜, '블랭킷': 블랭킷, '실패스피너': 실패스피너, '직조라벨': 직조라벨,
        '패턴지판': 패턴지판, '다린천판': 다린천판, '유리판': 유리판,
        '단춧구멍필드': 단춧구멍필드, '스냅': 스냅, '조각보타일': 조각보타일, '매듭': 매듭,
        '앱판': 앱판, '자수글자': 자수글자, '레터프레스': 레터프레스, '라벨태그': 라벨태그,
        '조합판': 조합판}
if 형태 not in 형태들:
    raise SystemExit('모르는 형태: ' + 형태 + ' — 아는 것은 ' + '·'.join(형태들))
키제외 = []          # 형태가 채우면 키 라이트에서 빠진다 — 밝은 글자가 앉을 그릇을 가라앉히는 «가림» 문법
칸들 = {}            # 형태가 채우면 «그릇의 화면 픽셀 자리»가 굽기 뒤 JSON 으로 나온다 — 본문 층이 손좌표를 안 쓰게
카메라위치, 카메라피치 = 형태들[형태]()

# 「카메라배=」 — 광축을 따라 뒤로 «달리»한다(구도 실측용 손잡이 · 기본 1 = 형태가 정한 그대로).
#   🔑 Y 만 늘리면 안 된다 — 피치가 90°가 아닌 형태(아이콘 86°)에서 중심이 위로 밀린다.
#   조명은 월드 좌표라 카메라를 물려도 안 따라온다(등() 참조) — 구도«만» 바뀐다.
카메라배 = float(인자.get('카메라배', '1'))
if 카메라배 != 1.0:
    _θ = math.radians(카메라피치)
    _축 = (0.0, math.sin(_θ), -math.cos(_θ))                    # 카메라가 보는 방향
    _거리 = -(카메라위치[1] * _축[1] + 카메라위치[2] * _축[2])     # 원점까지의 광축 거리
    _물림 = _거리 * (카메라배 - 1.0)
    카메라위치 = tuple(카메라위치[i] - _축[i] * _물림 for i in range(3))

# ── 무대·광 — 검은 무대 · 큰 소프트 키 · 여린 필 · 위 림 ────────────────────
씬.world = bpy.data.worlds.new('무대')
씬.world.use_nodes = True
씬.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)

# 「조명배=」 — 조명 변주는 글자 판(폭 1.35·카메라 6.8) 기준으로 조율됐다. 씬이 큰 형태(오브 판
#   2.23·카메라 12.6)에 그대로 쓰면 키가 상대적으로 작아져 결이 씻긴다(2판 렌더 실측 — 평평했다).
#   위치·크기 ×배 · 힘 ×배²(역제곱 보상 — 함정 ④를 손잡이로 만든 것). 글자 3종 채택값은 배=1 불변.
조명배 = float(인자.get('조명배', '1'))

def 등(이름, 위치, 회전, 크기, 힘):
    bpy.ops.object.light_add(type='AREA', location=tuple(v * 조명배 for v in 위치), rotation=회전)
    L = bpy.context.object
    L.data.size = 크기 * 조명배
    L.data.energy = 힘 * 조명배 * 조명배
    L.name = 이름

# 조명 변주(글자공방 08-20 이식) — 형태별 채택 조명이 기본값, 「조명=」 인자로 덮어쓴다.
조명 = 인자.get('조명', {'자수글자': '결광2', '레터프레스': '스침', '라벨태그': '스침'}.get(형태, '원본'))
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
elif 조명 == '스침':
    # 압인의 조명 — 빛이 표면을 왼쪽에서 스치면 눌린 홈의 그늘이 깊어진다.
    # ⚠스침광은 33°가 하한(함정 ⑤) — 14° 는 코사인 소멸로 면이 통째로 꺼진다(시험 실측).
    등('키', (-3.0, -1.6, 1.2), (math.radians(33), math.radians(-63), 0), 3.0, 1300)
    등('필', (2.6, -2.2, 0.5), (math.radians(80), math.radians(27), 0), 4.0, 120)
    등('림', (0.6, 2.6, 2.8), (math.radians(-42), 0, 0), 3.0, 300)
else:
    raise SystemExit('모르는 조명: ' + 조명 + ' — 아는 것은 원본·결광2·스침')

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
    try:
        bpy.ops.render.render(write_still=True)
    except RuntimeError as 왜:      # OUT_OF_RESOURCES 류 — 판정하지 않고 되문다(장면마다 한계가 다르다)
        print('GPU 가 죽어 CPU 로 되문다:', 왜)
        씬.cycles.device = 'CPU'
        bpy.ops.render.render(write_still=True)
        켠것 = False
else:
    씬.cycles.device = 'CPU'
    bpy.ops.render.render(write_still=True)
print('구움:', 형태, 출력, '샘플', 견본, '염료', 염료이름, 색.get(염료이름),
      '장치', 켠것 or 'CPU')

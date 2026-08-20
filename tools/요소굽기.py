# 요소굽기 — UI·UX 요소를 «실물»로 굽는다 (조항 ⓘ 집행급 · 유호 확정 08-19 「짧은 퍼」)
# 퍼프로브.py 의 승격판. 형태별로 몸을 짓고 짧은 퍼를 심어 Cycles 로 찍는다.
#   python3 -c "import sys; sys.argv=['x','--','형태=오브','색=Coral','샘플=96','너비=900','출력=/tmp/판.png']; exec(open('tools/요소굽기.py').read())"
# 형태: 오브 · 알약 · 아이콘 · 스티치 · 털실진행바(진행=0~1) · 단추토글 · 밑그림 · 페이지점 · 폼폼 · 시침핀 · 와펜 · 블랭킷 · 실패스피너 · 직조라벨
#      · 패턴지판 · 다린천판 · 유리판 · 단춧구멍필드 · 스냅 · 조각보타일 · 매듭
# 규율: 염료는 토큰 킷 「이름」 참조(hex 하드코딩 금지) · 글자는 굽지 않는다(타이포 불가침 — HTML 층 몫)
# 2027 킷 배선(08-20): 실땀=Stitch · 무채=양모 회색(Oat·Stone·Ash Wool·Deep Wool) — 퇴역 대기 12색 사용 0
# ⚠룸굽기.js 합류 전의 독립 통로다 — 룸굽기는 blender.exe(윈도)를 부르고 이건 bpy 모듈(클라우드)로 돈다.
import bpy, json, math, os, sys

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
    몸 = 베개몸((1.2, 0.55, 1.0))
    짧은퍼(몸, 염료이름, 살재질(염료이름, 색[염료이름]), 털재질(염료이름, 색[염료이름]))
    return (0, -8.6, 0.45), 86

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

def 직물결(m, 규모=200.0, 세기=0.05):
    """민무늬 살 위에 미세 결 — 매끈 슬라브는 도자기로 읽힌다(시안2027 실측).
    펠트·다린 천은 부직포라 짜임이 아니라 «알갱이 결»이 맞다 — 노이즈 범프."""
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 규모
    noise.inputs['Detail'].default_value = 6.0
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 세기
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

def 패턴지판():
    """패턴지(재단지) 판 — 정보 판 후보 ①(⏳판정 보류 08-20 — 유리와 실물 대조 후 확정).
    반투명 «도면 종이» — 빛을 «통과»시키되 차갑지 않다. 분필 시접선 1곳 한정(745ffc93 제안 #3)."""
    판뒤구()
    판 = 베개몸((1.35, 0.028, 0.95), 크리스=0.38, 레벨=4)
    종이 = bpy.data.materials.new('패턴지')
    종이.use_nodes = True
    p = 종이.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = 리니어(색['Paper'])
    p.inputs['Roughness'].default_value = 0.80   # 0.92 는 투과가 다 씻겨 불투명으로 읽혔다(시안2027)
    if 'Transmission Weight' in p.inputs:
        p.inputs['Transmission Weight'].default_value = 0.7   # 반투명 — 서리 낀 종이(유리 광 없음 · 드래프트 실측 0.55 는 불투명으로 읽혔다)
    직물결(종이, 규모=260.0, 세기=0.03)   # 종이 이빨 — 매끈하면 아크릴로 읽힌다
    판.data.materials.append(종이)
    분필 = 분필재질('시접', 색['Ash Wool'])
    for i in range(7):                        # 시접선 — 왼 가장자리 «안쪽» 한 줄 한정(제안 3차 #3)
        땀하나(-0.94, -0.055, -0.55 + i * 0.185, 0.08, 0.024, 분필, 회전y=90, 납작=True)
    return (0, -6.8, 0.0), 90

def 다린천판():
    """다린 무광 천 판 — 카드·판 바닥(⏳판정 보류 08-20 — 실물 대조 후 확정): 결을 눕힌 무채 천.
    광택 0 · 결 최소 — 다림질 자국의 «눌린» 면이다. 뒤구가 «막혀» 보이는 것이 이 판의 답이다."""
    판뒤구()
    판 = 베개몸((1.35, 0.055, 0.95), 크리스=0.34, 레벨=4)
    천 = bpy.data.materials.new('다린천')
    천.use_nodes = True
    p = 천.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = 리니어(색['Oat'])
    p.inputs['Roughness'].default_value = 0.96
    if 'Specular IOR Level' in p.inputs:
        p.inputs['Specular IOR Level'].default_value = 0.12   # 광을 거의 죽인다 — 무광 숙청과 정합
    직물결(천, 규모=200.0, 세기=0.045)   # 눌린 부직포 알갱이 — 민무늬는 도자기로 읽혔다(시안2027)
    판.data.materials.append(천)
    return (0, -6.8, 0.0), 90

def 유리판():
    """서리 유리 판 — 정보 판 후보 ②(⏳판정 보류 08-20 유호 «CSS 시안으론 똑같아 보인다 —
    전부 제대로 만들고 나중에 결정»). 패턴지판과 같은 구도·조명·크기, 재질만 유리.
    시접선은 재단지 고유 장식이라 없다 — 유리는 민면이 정체성이다."""
    판뒤구()
    판 = 베개몸((1.35, 0.028, 0.95), 크리스=0.38, 레벨=4)
    유리 = bpy.data.materials.new('서리유리')
    유리.use_nodes = True
    p = 유리.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = 리니어(색['Paper'])
    p.inputs['Roughness'].default_value = 0.3    # 서리 — 글라스모피즘의 «흐린 비침»(맑은 유리는 창문이지 판이 아니다)
    if 'Transmission Weight' in p.inputs:
        p.inputs['Transmission Weight'].default_value = 1.0
    p.inputs['IOR'].default_value = 1.45
    판.data.materials.append(유리)
    return (0, -6.8, 0.0), 90

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

형태들 = {'오브': 오브, '알약': 알약, '아이콘': 아이콘, '스티치': 스티치, '털실진행바': 털실진행바,
        '단추토글': 단추토글, '밑그림': 밑그림, '페이지점': 페이지점, '폼폼': 폼폼, '시침핀': 시침핀,
        '와펜': 와펜, '블랭킷': 블랭킷, '실패스피너': 실패스피너, '직조라벨': 직조라벨,
        '패턴지판': 패턴지판, '다린천판': 다린천판, '유리판': 유리판,
        '단춧구멍필드': 단춧구멍필드, '스냅': 스냅, '조각보타일': 조각보타일, '매듭': 매듭}
if 형태 not in 형태들:
    raise SystemExit('모르는 형태: ' + 형태 + ' — 아는 것은 ' + '·'.join(형태들))
카메라위치, 카메라피치 = 형태들[형태]()

# ── 무대·광 — 검은 무대 · 큰 소프트 키 · 여린 필 · 위 림 ────────────────────
씬.world = bpy.data.worlds.new('무대')
씬.world.use_nodes = True
씬.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)

def 등(이름, 위치, 회전, 크기, 힘):
    bpy.ops.object.light_add(type='AREA', location=위치, rotation=회전)
    L = bpy.context.object
    L.data.size = 크기
    L.data.energy = 힘
    L.name = 이름

등('키', (-2.8, -2.2, 3.4), (math.radians(46), math.radians(-30), 0), 4.0, 1400)
등('필', (2.6, -2.2, 0.6), (math.radians(78), math.radians(28), 0), 4.0, 80)
등('림', (0.6, 2.6, 2.8), (math.radians(-42), 0, 0), 3.0, 560)

bpy.ops.object.camera_add(location=카메라위치, rotation=(math.radians(카메라피치), 0, 0))
씬.camera = bpy.context.object
씬.camera.data.lens = 85

씬.render.engine = 'CYCLES'
씬.cycles.device = 'CPU'   # GPU(oneAPI) 는 매듭의 털에서 메모리가 터졌고 이득도 2배뿐이다(실측 08-20)
씬.cycles.samples = 견본
씬.cycles.use_denoising = True
씬.render.resolution_x = 너비
씬.render.resolution_y = int(너비 * 0.82)
씬.render.filepath = 출력
bpy.ops.render.render(write_still=True)
print('구움:', 형태, 출력, '샘플', 견본, '염료', 염료이름, 색.get(염료이름))

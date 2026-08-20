# 요소굽기 — UI·UX 요소를 «실물»로 굽는다 (조항 ⓘ 집행급 · 유호 확정 08-19 「짧은 퍼」)
# 퍼프로브.py 의 승격판. 형태별로 몸을 짓고 짧은 퍼를 심어 Cycles 로 찍는다.
#   python3 -c "import sys; sys.argv=['x','--','형태=오브','색=Coral','샘플=96','너비=900','출력=/tmp/판.png']; exec(open('tools/요소굽기.py').read())"
# 형태: 오브 · 알약 · 아이콘 · 스티치 · 털실진행바(진행=0~1) · 단추토글 · 밑그림 · 페이지점 · 폼폼 · 시침핀 · 와펜 · 블랭킷 · 실패스피너 · 직조라벨
#      · 패턴지판 · 다린천판 · 유리판 · 자수글자 · 레터프레스(등힘=90) · 라벨태그(등힘=80)
# 규율: 염료는 토큰 킷 「이름」 참조(hex 하드코딩 금지) · **본문** 글자는 굽지 않는다(타이포 불가침 — HTML 층 몫)
#      — 오브제 글자(고정 라벨 · 화면당 한 점)는 별도 항이다(글자공방 채택 08-20 · 옛 「글자는 굽지 않는다」는 본문 한정을 떨어뜨린 과대 일반화)
# 2027 킷 배선(08-20): 실땀=Stitch · 무채=양모 회색(Oat·Stone·Ash Wool·Deep Wool) — 퇴역 대기 12색 사용 0
# 조명: 원본(기본) · 결광2(자수 글자) · 스침(압인·라벨) — 인자 「조명=」로 덮어쓴다 · 글자 보조광 힘은 「등힘=」
# ⚠룸굽기.js 합류 전의 독립 통로다 — 룸굽기는 blender.exe(윈도)를 부르고 이건 bpy 모듈(클라우드)로 돈다.
import bpy, json, math, sys, random

토큰길 = '/home/user/synk-appsscript/docs/디자인_토큰.json'
색 = {c['이름']: c['hex'] for c in json.load(open(토큰길, encoding='utf-8'))['색']['킷']}

def 리니어(hex_):
    h = hex_.lstrip('#')
    def ch(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return tuple(ch(int(h[i:i+2], 16)) for i in (0, 2, 4)) + (1.0,)

인자 = {k: v for k, v in (a.split('=', 1) for a in sys.argv[sys.argv.index('--') + 1:])} if '--' in sys.argv else {}
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

def 판재질(종류):
    """판 3종의 재질 — **여기 한 곳에서만 정의한다.** 소비자마다 값을 지니면 대조가 거짓이 된다
    (같은 재질이라 믿고 나란히 놓는데 값이 갈려 있는 형태). 두께도 함께 낸다."""
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
    시접선()
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

형태들 = {'오브': 오브, '알약': 알약, '아이콘': 아이콘, '스티치': 스티치, '털실진행바': 털실진행바,
        '단추토글': 단추토글, '밑그림': 밑그림, '페이지점': 페이지점, '폼폼': 폼폼, '시침핀': 시침핀,
        '와펜': 와펜, '블랭킷': 블랭킷, '실패스피너': 실패스피너, '직조라벨': 직조라벨,
        '패턴지판': 패턴지판, '다린천판': 다린천판, '유리판': 유리판,
        '자수글자': 자수글자, '레터프레스': 레터프레스, '라벨태그': 라벨태그}
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

bpy.ops.object.camera_add(location=카메라위치, rotation=(math.radians(카메라피치), 0, 0))
씬.camera = bpy.context.object
씬.camera.data.lens = 85

씬.render.engine = 'CYCLES'
씬.cycles.device = 'CPU'
씬.cycles.samples = 견본
씬.cycles.use_denoising = True
씬.render.resolution_x = 너비
씬.render.resolution_y = int(너비 * 0.82)
씬.render.filepath = 출력
bpy.ops.render.render(write_still=True)
print('구움:', 형태, 출력, '샘플', 견본, '염료', 염료이름, 색.get(염료이름))

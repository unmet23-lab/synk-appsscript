# 요소굽기 — UI·UX 요소를 «실물»로 굽는다 (조항 ⓘ 집행급 · 유호 확정 08-19 「짧은 퍼」)
# 퍼프로브.py 의 승격판. 형태별로 몸을 짓고 짧은 퍼를 심어 Cycles 로 찍는다.
#   python3 -c "import sys; sys.argv=['x','--','형태=오브','색=Coral','샘플=96','너비=900','출력=/tmp/판.png']; exec(open('tools/요소굽기.py').read())"
# 형태: 오브 · 알약 · 아이콘 · 스티치(자수 채택) · 털실진행바(진행=0~1) · 단추토글 · 밑그림 · 페이지점
# 규율: 염료는 토큰 킷 「이름」 참조(hex 하드코딩 금지) · 글자는 굽지 않는다(타이포 불가침 — HTML 층 몫)
# ⚠룸굽기.js 합류 전의 독립 통로다 — 룸굽기는 blender.exe(윈도)를 부르고 이건 bpy 모듈(클라우드)로 돈다.
import bpy, json, math, sys

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

def 베개몸(크기, 위치=(0, 0, 0), 회전z=0.0, 크리스=0.62):
    bpy.ops.mesh.primitive_cube_add(size=2, location=위치)
    몸 = bpy.context.object
    몸.scale = 크기
    몸.rotation_euler = (0, 0, math.radians(회전z))
    sub = 몸.modifiers.new('sub', 'SUBSURF')     # 큐브+서브서프+크리스 = 연속 곡률 스쿼클
    sub.levels = sub.render_levels = 3
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
    """참조 ② 문법 — 겹친 두 스쿼클. 뒤판은 무채(Graphite 4 — 검은 무대에서 읽히는 가장 어두운 털),
    앞판이 기본색. 겹침의 그림자·빛이 «실물»의 깊이를 낸다."""
    뒤 = 베개몸((1.04, 0.5, 1.04), 위치=(0.52, 0.62, 0.56), 회전z=-8)
    짧은퍼(뒤, 'Graphite 4', 살재질('Graphite 4', 색['Graphite 4']), 털재질('Graphite 4', 색['Graphite 4']))
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
    p.inputs['Base Color'].default_value = 리니어(색['Chalk'])
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
    짧은퍼(트랙, 'Graphite 4', 살재질('Graphite 4', 색['Graphite 4']),
          털재질('Graphite 4', 색['Graphite 4']), 길이=0.04, 개수=15000)
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

def 땀하나(x, y, z, 길이, 굵기, 재질, 회전y=11, 회전z=0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(x, y, z))
    땀 = bpy.context.object
    땀.scale = (길이, 굵기, 굵기)
    땀.rotation_euler = (0, math.radians(회전y), math.radians(회전z))
    bpy.ops.object.shade_smooth()
    땀.data.materials.append(재질)
    return 땀

def 단추토글():
    """꿰맨 단추 토글 — 켬 = 실이 X 로 꿰매짐 / 끔 = 빈 구멍(제안 #2 실물화 · 유호 픽 08-19).
    두 단추의 몸은 같고 «실»만 다르다 — 상태가 재질 차이가 아니라 바느질 유무로 읽힌다.
    켬의 실 = 기본색(신호 1점 — 켜짐이 곧 신호다)."""
    몸재 = 매끈재질('단추', 색['Chalk 3'], 거칠기=0.55)
    구멍재 = 매끈재질('구멍', 색['Graphite 2'], 거칠기=0.9)
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
                땀하나(cx + (x1 + x2) / 2, -0.19, (z1 + z2) / 2, 길이, 0.055, 실재,
                      회전y=-각, 회전z=0)
    단추(-1.15, True)
    단추(1.15, False)
    return (0, -8.0, 0.0), 90

def 밑그림():
    """밑그림 점선 — 스켈레톤 로딩(제안 #7 실물화): 「아직 안 꿰맨 자수 도안」.
    어두운 펠트 판 위에 분필 점선이 앞으로 생길 카드의 윤곽과 글줄 자리를 긋는다."""
    판 = 베개몸((1.9, 0.3, 1.25), 크리스=0.66)
    짧은퍼(판, 'Graphite 4', 살재질('Graphite 4', 색['Graphite 4']),
          털재질('Graphite 4', 색['Graphite 4']), 길이=0.05, 개수=18000)
    분필 = 매끈재질('분필', 색['Chalk'], 거칠기=0.5)
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
        땀하나(x, 앞, z, 0.085, 0.026, 분필, 회전y=-각)
    for (z, 폭) in ((0.16, 0.78), (-0.12, 0.55)):   # 글줄 자리 두 줄
        n = max(2, int(폭 * 2 / 0.26))
        for i in range(n):
            x = -폭 + (2 * 폭) * (i + 0.5) / n
            땀하나(x, 앞, z, 0.075, 0.024, 분필, 회전y=0)
    return (0, -7.8, 0.05), 88

def 페이지점():
    """바늘땀 페이지 점 — 페이지네이션(제안 #9 실물화): 지나온 쪽 = 꿰맨 땀(분필) ·
    지금 = 기본색 땀(신호 1점) · 남은 쪽 = 빈 바늘구멍 두 점(꿰맬 자리)."""
    띠 = 베개몸((2.2, 0.3, 0.42), 크리스=0.7)
    짧은퍼(띠, 'Graphite 4', 살재질('Graphite 4', 색['Graphite 4']),
          털재질('Graphite 4', 색['Graphite 4']), 길이=0.045, 개수=16000)
    분필 = 매끈재질('분필', 색['Chalk'], 거칠기=0.5)
    실재 = 매끈재질('실', 색[염료이름], 거칠기=0.42)
    구멍재 = 매끈재질('구멍', 색['Graphite 2'], 거칠기=0.95)
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
    return (0, -7.6, 0.0), 90

형태들 = {'오브': 오브, '알약': 알약, '아이콘': 아이콘, '스티치': 스티치, '털실진행바': 털실진행바,
        '단추토글': 단추토글, '밑그림': 밑그림, '페이지점': 페이지점}
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
씬.cycles.device = 'CPU'
씬.cycles.samples = 견본
씬.cycles.use_denoising = True
씬.render.resolution_x = 너비
씬.render.resolution_y = int(너비 * 0.82)
씬.render.filepath = 출력
bpy.ops.render.render(write_still=True)
print('구움:', 형태, 출력, '샘플', 견본, '염료', 염료이름, 색.get(염료이름))

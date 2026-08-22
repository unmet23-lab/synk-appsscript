# 집행급 펠트/퍼 프로브 — 유호 교정 08-19 「UI·UX 하나하나 실제 그래픽처럼」
# 상태 = «프로브»다(승격 전 · 유호 픽 대기) — 룸굽기.js 부품표 합류가 승격의 모양이다.
# 쓰는 법: python3 -c "import sys; sys.argv=['x','--','색=Coral','샘플=96','너비=900','출력=/tmp/판.png']; exec(open('tools/퍼프로브.py').read())"
#   (bpy 모듈 필요 — pip install bpy · 이 저장소 첫 실증: 클라우드 컨테이너 bpy 5.0.1 · 900px 96샘플 ≈ 13분 CPU)
# ⚠선대 도구다 — 승격판은 `tools/요소굽기.py`, 그 폴더의 굽기 주인은 `tools/요소전량굽기.js`(1800px).
#   이 파일이 내던 `코랄사각_v1.png`(참조 ① 문법)은 재현 통로가 없어 08-22 에 지웠다(git 이력에 있다).
# 참조 문법: 볼륨 실루엣 · 섬유가 윤곽을 뚫는다 · 검은 무대 · 큰 소프트 키라이트
# 염료 = 킷 Coral #FF6B5C (조항 ⓘ 기본색) — 값은 여기 하드코딩하지 않고 토큰에서 읽는다
import bpy, json, math, sys, os

토큰길 = '/home/user/synk-appsscript/docs/디자인_토큰.json'
색 = {c['이름']: c['hex'] for c in json.load(open(토큰길, encoding='utf-8'))['색']['킷']}

def 리니어(hex_):
    h = hex_.lstrip('#')
    def ch(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return tuple(ch(int(h[i:i+2], 16)) for i in (0, 2, 4)) + (1.0,)

인자 = {k: v for k, v in (a.split('=', 1) for a in sys.argv[sys.argv.index('--') + 1:])} if '--' in sys.argv else {}
염료이름 = 인자.get('색', 'Coral')
출력 = 인자.get('출력', '/tmp/퍼프로브.png')
견본 = int(인자.get('샘플', '64'))
너비 = int(인자.get('너비', '768'))

bpy.ops.wm.read_factory_settings(use_empty=True)
씬 = bpy.context.scene

# ── 몸 — 둥근 사각 슬랩(스쿼클) ──────────────────────────────────────────────
bpy.ops.mesh.primitive_cube_add(size=2)
몸 = bpy.context.object
몸.scale = (1.2, 0.55, 1.0)
sub = 몸.modifiers.new('sub', 'SUBSURF')   # 큐브+서브서프+크리스 = 스쿼클 베개 — 평평한 옆벽 없이 네모가 산다
sub.levels = sub.render_levels = 3
크리스층 = 몸.data.edge_creases_ensure()   # Blender 4+ — crease 는 속성층이다
for d in 크리스층.data:
    d.value = 0.62
bpy.ops.object.shade_smooth()

# 바탕 살(털 사이로 비치는 속) — 염료보다 살짝 어둡게
살 = bpy.data.materials.new('살')
살.use_nodes = True
p = 살.node_tree.nodes['Principled BSDF']
기본 = 리니어(색[염료이름])
p.inputs['Base Color'].default_value = tuple(v * 0.55 for v in 기본[:3]) + (1.0,)
p.inputs['Roughness'].default_value = 1.0
몸.data.materials.append(살)

# ── 털 — 레거시 파티클 헤어(안 되면 그 자리에서 죽는다 — 조용한 폴백 금지) ──
bpy.ops.object.particle_system_add()
ps = 몸.particle_systems[0].settings
ps.type = 'HAIR'
ps.count = 12000
ps.hair_length = 0.16
ps.hair_step = 5
ps.child_type = 'INTERPOLATED'
ps.rendered_child_count = ps.child_percent = 30
ps.child_length = 1.0
ps.clump_factor = 0.5
ps.factor_random = 0.08
ps.roughness_1 = 0.08        # 뿌리 흐트러짐
ps.roughness_2 = 0.12        # 끝 흐트러짐
ps.roughness_endpoint = 0.06
ps.use_hair_bspline = True
ps.render_step = 4
ps.length_random = 0.25
ps.root_radius = 0.016       # 섬유 굵기 — 참조의 «가는 털»
ps.tip_radius = 0.0015

털 = bpy.data.materials.new('털')
털.use_nodes = True
tp = 털.node_tree.nodes['Principled BSDF']
tp.inputs['Base Color'].default_value = 기본
tp.inputs['Roughness'].default_value = 0.62
# 뿌리→끝 미세 명암 — 털 결이 읽히게(끝이 살짝 밝다: 빛을 먹는 재질의 잔털 림)
정보 = 털.node_tree.nodes.new('ShaderNodeHairInfo')
램프 = 털.node_tree.nodes.new('ShaderNodeValToRGB')
램프.color_ramp.elements[0].color = tuple(v * 0.72 for v in 기본[:3]) + (1.0,)
램프.color_ramp.elements[1].color = tuple(min(1.0, v * 1.18) for v in 기본[:3]) + (1.0,)
털.node_tree.links.new(정보.outputs['Intercept'], 램프.inputs['Fac'])
털.node_tree.links.new(램프.outputs['Color'], tp.inputs['Base Color'])
몸.data.materials.append(털)
몸.particle_systems[0].settings.material = 2

# ── 무대·광 — 참조: 검은 바탕 · 큰 소프트 키 · 여린 필 · 위 림 ──────────────
씬.world = bpy.data.worlds.new('무대')
씬.world.use_nodes = True
씬.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)

def 등(이름, 위치, 회전, 크기, 힘):
    bpy.ops.object.light_add(type='AREA', location=위치, rotation=회전)
    L = bpy.context.object
    L.data.size = 크기
    L.data.energy = 힘
    L.name = 이름
    return L

등('키', (-2.8, -2.2, 3.4), (math.radians(46), math.radians(-30), 0), 4.0, 1400)
등('필', (2.6, -2.2, 0.6), (math.radians(78), math.radians(28), 0), 4.0, 80)
등('림', (0.6, 2.6, 2.8), (math.radians(-42), 0, 0), 3.0, 560)

bpy.ops.object.camera_add(location=(0, -8.6, 0.45), rotation=(math.radians(86), 0, 0))
씬.camera = bpy.context.object
씬.camera.data.lens = 85

# ── 렌더 — Cycles CPU + 디노이즈 ─────────────────────────────────────────────
씬.render.engine = 'CYCLES'
씬.cycles.device = 'CPU'
씬.cycles.samples = 견본
씬.cycles.use_denoising = True
씬.render.resolution_x = 너비
씬.render.resolution_y = int(너비 * 0.82)
씬.render.film_transparent = False
씬.render.filepath = 출력
bpy.ops.render.render(write_still=True)
print('구움:', 출력, '샘플', 견본, '염료', 염료이름, 색[염료이름])

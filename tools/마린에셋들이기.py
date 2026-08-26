# 바깥 3D 에셋을 SYNK 세계로 들이는 통로 (유호 픽 08-27 「2번이 제일 좋아보여」).
#
#   왜 이 통로가 생겼나: `마린굽기.py` 는 형체를 «큐브 + 서브디비전»으로만 짓는다.
#   그것은 부풀리는 연산이라 평평한 면·날카로운 모서리·얇은 판·파낸 홈을 원리상 못 낸다 —
#   갑옷의 형태 언어가 정확히 그 넷이라, 08-27 하루를 태우고도 「펠트 인형의 갑옷 코스프레」에서
#   멈췄다. 조형 밀도는 바깥에서 들이고, **우리 것으로 만드는 일**을 여기서 한다.
#
#   ■ 이 도구가 하는 일 넷
#     ① 파일을 읽어 무대 한가운데 «정해진 키»로 앉힌다(어떤 스케일로 나왔든 상관없게)
#     ② 우리 킷 재질을 입힌다 — Lapis 갑옷 램프 + Coral Rim 발광 렌즈 + Butter 금테
#     ③ SYNK 표식을 붙인다 — 등가방 · 어깨 문장 자리
#     ④ 우리 무대·조명으로 굽고, 원하면 프린팅용 STL 로 다시 뺀다
#
#   ■ 재질을 «어느 조각에» 입히나
#     들여온 모델은 파츠가 나뉜 것도, 통짜인 것도 온다. 통짜면 색을 나눌 자리가 없으므로
#     **이름으로 가른다** — 파츠 이름에 아래 낱말이 있으면 그 갈래로 간다(대소문자 무시).
#     맞는 것이 없으면 전부 갑옷색이 된다(조용한 실패가 아니라 «한 색»이 나오므로 눈에 보인다).
#
#   호출: blender --background --python tools/마린에셋들이기.py -- 파일=... 출력=...
#         [키=2.28] [갑옷=Lapis Deep] [갑옷배율=0.42] [렌즈=Coral Rim] [렌즈발광=6]
#         [받침=Ink] [조명=스침] [구도=전신|얼굴] [가방=1] [내보내기=...stl]
import sys, os

_인자 = {k: v for k, v in (a.split('=', 1) for a in sys.argv[sys.argv.index('--') + 1:])} if '--' in sys.argv else {}
REPO = _인자.get('저장소') or (
    os.path.dirname(os.path.dirname(os.path.abspath(globals()['__file__'])))
    if '__file__' in globals() else os.getcwd())

if not any(a.startswith('실감=') for a in sys.argv):
    sys.argv.append('실감=속살,섬유')      # 들여온 갑옷에 털·잔털은 안 심는다

원문 = open(os.path.join(REPO, 'tools', '요소굽기.py'), encoding='utf-8').read()
앵커 = '카메라위치, 카메라피치 = 형태들[형태]()'
assert 원문.count(앵커) == 1, '요소굽기 실행부 앵커가 바뀌었다 — 이 통로를 다시 맞춘다'
본문 = 원문.replace(앵커, '카메라위치, 카메라피치 = 에셋시안()')

ns = {}

# 파츠 이름 → 갈래. 위에서부터 먼저 맞는 것이 이긴다(렌즈가 헬멧보다 먼저여야 한다).
_갈래 = [
    ('렌즈', ('lens', 'eye', 'visor', 'glow', '렌즈', '눈')),
    ('금테', ('trim', 'gold', 'laurel', 'wreath', 'aquila', '금')),
    ('관절', ('joint', 'cable', 'hose', 'boot', 'glove', 'gauntlet', 'seal', 'undersuit',
             'grille', 'vent', 'skull', '관절', '부츠')),
]


def _갈래이름(이름):
    소문 = 이름.lower()
    for 갈래, 낱말들 in _갈래:
        if any(w in 소문 for w in 낱말들):
            return 갈래
    return '갑옷'


def _시안(bpy, math, random, g):
    import mathutils
    매끈재질, 색, 리니어 = g['매끈재질'], g['색'], g['리니어']
    베개몸, 직물결 = g['베개몸'], g['직물결']

    #   🔑 여러 파일을 «같이» 들일 수 있다(쉼표) — 이것이 방향을 재는 자이기도 하다.
    #     받침대처럼 «누가 봐도 바른 방향인» 조각을 함께 놓으면, 본체가 어느 쪽으로 누웠는지가
    #     추측이 아니라 눈으로 갈린다(08-27 실측: 회전 일곱 판을 추측으로 태우고서야 이 길로 왔다).
    파일들 = [os.path.abspath(p.strip()) for p in (_인자.get('파일') or '').split(',') if p.strip()]
    assert 파일들, '파일= 이 없다 — 들여올 3D 파일 경로를 준다(stl·obj·fbx·glb·gltf·ply · 쉼표로 여럿)'
    for _p in 파일들:
        assert os.path.exists(_p), '없는 파일: ' + _p
    파일 = 파일들[0]

    갑옷색 = _인자.get('갑옷', 'Lapis Deep')
    렌즈색 = _인자.get('렌즈', 'Coral Rim')
    금색 = _인자.get('금테색', 'Butter')
    관절색 = _인자.get('관절', 'Ink')
    갑옷배율 = float(_인자.get('갑옷배율', '0.42'))
    쇠거칠 = float(_인자.get('쇠거칠', '0.34'))
    쇠금속 = float(_인자.get('쇠금속', '0.88'))
    렌즈발광 = float(_인자.get('렌즈발광', '6'))
    목표키 = float(_인자.get('키', '2.28'))     # 마린굽기와 같은 무대 높이 — 나란히 놓고 비교할 수 있게

    def 쇠재질(이름, hex_, 거칠기=None, 금속=None, 배율=None):
        m = 매끈재질('에셋_' + 이름, hex_, 거칠기=쇠거칠 if 거칠기 is None else 거칠기,
                   반사=0.5, 배율=갑옷배율 if 배율 is None else 배율)
        m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = (
            쇠금속 if 금속 is None else 금속)
        return m

    def 발광재질(이름, hex_, 세기):
        m = 매끈재질('에셋_' + 이름, hex_, 거칠기=0.14, 반사=0.3)
        p = m.node_tree.nodes['Principled BSDF']
        for 키, 값 in (('Emission Color', tuple(리니어(hex_))[:3] + (1.0,)),
                      ('Emission Strength', 세기)):
            if 키 in p.inputs:
                p.inputs[키].default_value = 값
        return m

    재질표 = {
        '갑옷': 쇠재질('갑옷', 색[갑옷색]),
        '관절': 쇠재질('관절', 색[관절색], 거칠기=0.42, 배율=0.75),
        '금테': 쇠재질('금테', 색[금색], 거칠기=0.28, 배율=0.9),
        '렌즈': (발광재질('렌즈', 색[렌즈색], 렌즈발광) if 렌즈발광 > 0
                else 쇠재질('렌즈', 색[렌즈색], 거칠기=0.14, 금속=0.2, 배율=1.0)),
    }

    # ── 받침천 — 마린굽기와 같은 무대라야 두 판을 나란히 놓고 잴 수 있다 ──────────
    판 = 베개몸((3.4, 0.14, 3.4), 위치=(0, 0.95, 0.5), 크리스=0.34, 레벨=3)
    판.data.materials.append(직물결(매끈재질('받침천', 색[_인자.get('받침', 'Ink')], 거칠기=0.96),
                                 지름=6.8))

    # ── 들이기 ────────────────────────────────────────────────────────────────
    있던것 = set(bpy.data.objects)
    for _p in 파일들:
        확장 = os.path.splitext(_p)[1].lower()
        가져오기 = {
            '.stl': lambda f=_p: bpy.ops.wm.stl_import(filepath=f),
            '.obj': lambda f=_p: bpy.ops.wm.obj_import(filepath=f),
            '.fbx': lambda f=_p: bpy.ops.import_scene.fbx(filepath=f),
            '.glb': lambda f=_p: bpy.ops.import_scene.gltf(filepath=f),
            '.gltf': lambda f=_p: bpy.ops.import_scene.gltf(filepath=f),
            '.ply': lambda f=_p: bpy.ops.wm.ply_import(filepath=f),
        }.get(확장)
        assert 가져오기, '모르는 확장자: ' + 확장 + ' — stl·obj·fbx·glb·gltf·ply 를 준다'
        가져오기()
    들인것 = [o for o in bpy.data.objects if o not in 있던것 and o.type == 'MESH']
    assert 들인것, '파일은 열렸는데 «메시가 0개»다 — 빈 파일이거나 이 통로가 못 읽는 구조다'
    print('들임: %d 파츠 — %s' % (len(들인것), ', '.join(o.name for o in 들인것[:8])))

    # 🔴 **바깥 에셋은 «어느 쪽이 위인지»가 제각각이다.** 첫 타이투스 판은 통째로 누워서 나왔다 —
    #   Z-up 으로 저장된 것을 임포터가 Y-up 으로 읽은 탓이다. 포맷마다 다른 임포트 인자를 외우는
    #   대신, 들인 «뒤에» 돌린다(모든 포맷에 같은 방식이 통한다).
    #   돌리기=x90 · x-90 · z180 처럼 준다(여러 개면 쉼표).
    for _돌 in (s.strip() for s in _인자.get('돌리기', '').split(',') if s.strip()):
        축, 각 = _돌[0].upper(), float(_돌[1:])
        R = mathutils.Matrix.Rotation(math.radians(각), 4, 축)
        for o in 들인것:
            o.matrix_world = R @ o.matrix_world
        print('돌림: %s 축 %.0f°' % (축, 각))

    # ── 앉히기: 어떤 스케일·어떤 자리로 나왔든 무대 한가운데 정해진 키로 ─────────
    #   🔑 바깥 에셋은 단위가 제각각이다(밀리미터·인치·임의). «재서 맞추는» 것이 유일하게 안전하다.
    for o in 들인것:
        o.select_set(True)
    bpy.context.view_layer.objects.active = 들인것[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    구석 = [o.matrix_world @ mathutils.Vector(v) for o in 들인것 for v in o.bound_box]
    최소 = mathutils.Vector((min(v.x for v in 구석), min(v.y for v in 구석), min(v.z for v in 구석)))
    최대 = mathutils.Vector((max(v.x for v in 구석), max(v.y for v in 구석), max(v.z for v in 구석)))
    높이 = max(1e-6, (최대 - 최소).z)
    배 = 목표키 / 높이
    중심 = (최소 + 최대) * 0.5
    print('원본 크기 %.3f×%.3f×%.3f → 배율 %.4f' % (최대.x - 최소.x, 최대.y - 최소.y, 높이, 배))

    for o in 들인것:
        o.matrix_world = (mathutils.Matrix.Translation((0, 0, -최소.z * 배))
                          @ mathutils.Matrix.Scale(배, 4)
                          @ mathutils.Matrix.Translation((-중심.x, -중심.y, 0))
                          @ o.matrix_world)

    # ── 우리 색 입히기 ────────────────────────────────────────────────────────
    셈 = {}
    for o in 들인것:
        갈래 = _갈래이름(o.name)
        셈[갈래] = 셈.get(갈래, 0) + 1
        o.data.materials.clear()
        o.data.materials.append(재질표[갈래])
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        try:
            bpy.ops.object.shade_auto_smooth(angle=math.radians(32))
        except Exception:
            pass
    print('색 갈래: ' + ' · '.join('%s %d' % (k, v) for k, v in sorted(셈.items())))
    if 셈.get('갑옷', 0) == len(들인것):
        print('⚠파츠 이름에서 렌즈·금테·관절을 하나도 못 갈랐다 — 통짜이거나 이름이 다른 말이다.'
              ' 「렌즈이름=」 인자로 낱말을 더 주거나, 색은 한 벌로 간다.')

    # ── SYNK 표식 — 등가방(유호 확정 08-26 「뒤에 가방을 멘 상태라면 더 재밌겠다」) ──
    if _인자.get('가방', '1') not in ('0', '끔'):
        폭, 두께, 높 = 0.62, 0.24, 0.46
        가방 = 베개몸((폭, 두께, 높), 위치=(0, 최대.y * 0 + 0.46, 1.56), 크리스=0.34, 레벨=2)
        가방.data.materials.append(재질표['관절'])
        print('가방: 등 뒤 (0, 0.46, 1.56) — 실물 모델 두께를 보고 y 를 맞춰야 할 수 있다')

    # 카메라 — 마린굽기와 같은 자리(전신) 또는 얼굴 클로즈업
    #   ⚠들여온 모델은 자세가 제각각이라 «같은 카메라»가 늘 정면이 되지는 않는다 — 눈으로
    #     맞출 수 있게 거리와 눈높이를 연다(거리를 늘리면 원근이 약해져 위에서 본 느낌이 준다).
    거리 = float(_인자.get('거리', '8.6'))
    눈높이 = float(_인자.get('눈높이', '0.51'))
    if _인자.get('구도', '전신') == '얼굴':
        return (0, -2.55, 목표키 * 0.86), 90
    return (0, -거리, 목표키 * 눈높이), 90


def 에셋시안():
    return _시안(ns['bpy'], ns['math'], ns['random'], ns)


ns['에셋시안'] = 에셋시안
ns['__name__'] = '__main__'
exec(compile(본문, os.path.join(REPO, 'tools', '요소굽기.py'), 'exec'), ns)

# ── 프린팅용 다시 내보내기 ────────────────────────────────────────────────────
#   🔑 우리가 붙인 가방까지 «한 벌»로 나가야 피규어가 된다 — 받침천만 뺀다.
_내보내기 = _인자.get('내보내기')
if _내보내기:
    bpy = ns['bpy']
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:
        if o.type == 'MESH' and not o.name.startswith('받침') and '받침천' not in o.name:
            o.select_set(True)
    bpy.ops.wm.stl_export(filepath=os.path.abspath(_내보내기), export_selected_objects=True)
    print('내보냄: ' + _내보내기)

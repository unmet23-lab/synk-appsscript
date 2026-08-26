# 바깥 3D 에셋을 SYNK 세계로 들이는 통로 (유호 픽 08-27 「2번이 제일 좋아보여」).
#
#   왜 이 통로가 생겼나: `마린굽기.py` 는 형체를 «큐브 + 서브디비전»으로만 짓는다.
#   그것은 부풀리는 연산이라 평평한 면·날카로운 모서리·얇은 판·파낸 홈을 원리상 못 낸다 —
#   갑옷의 형태 언어가 정확히 그 넷이라, 08-27 하루를 태우고도 「펠트 인형의 갑옷 코스프레」에서
#   멈췄다. 조형 밀도는 바깥에서 들이고, **우리 것으로 만드는 일**을 여기서 한다.
#
#   ■ 이 도구가 하는 일 넷
#     ① 파일을 «재서» 세우고, 무대 한가운데 정해진 키로 앉힌다(어떤 스케일·어떤 축으로 나왔든)
#     ② 우리 킷 재질을 입힌다 — Lapis 갑옷 램프 + Coral Rim 발광 렌즈 + Butter 금테
#     ③ SYNK 표식 — 등가방(`가방=1`). ⚠**어깨 문장은 아직 없다**(도구가 못 하는 것 · 굽은 어깨판에
#        로고를 투영하려면 UV 나 슈링크랩 한 벌이 더 필요하다). 헤더가 있다고 말하던 자리를 지웠다.
#     ④ 우리 무대·조명으로 굽고, 원하면 프린팅용 STL 로 다시 뺀다
#
#   ■ 재질을 «어느 조각에» 입히나
#     들여온 모델은 파츠가 나뉜 것도, 통짜인 것도 온다. 통짜면 색을 나눌 자리가 없으므로
#     **이름으로 가른다** — 파츠 이름에 아래 낱말이 있으면 그 갈래로 간다(대소문자 무시).
#     맞는 것이 없으면 전부 갑옷색이 된다(조용한 실패가 아니라 «한 색»이 나오므로 눈에 보인다).
#
#   호출: blender --background --python tools/마린에셋들이기.py -- 파일=... 출력=...
#         [키=2.28] [갑옷=Lapis Deep] [갑옷배율=0.42] [렌즈=Coral Rim] [렌즈발광=6]
#         [받침=Ink] [조명=스침] [구도=전신|얼굴] [가방=0] [내보내기=...stl]
#         [세움=자동|끔] [자동틀=1|0] [채움=0.86] [돌리기=z35] [거리=] [눈높이=]
#
#   ■ 「어느 쪽이 위인가」와 「어디까지 들어오나」는 **묻지 않고 잰다**
#     08-27 에 이 자리에서 x 축 회전 «열넷»을 태우고도 못 풀었다. 진범은 회전값이 아니었다 —
#     **재본 적이 없었다.** 재보니 서전트 둘은 처음부터 서 있었고(발→머리 축이 수직에서 10.5°·12.2°),
#     기운 것처럼 보인 것은 조형(고개 숙인 자세·거대한 어깨판)과 «손으로 맞춘 카메라» 탓이었다.
#     ⇒ `세움=자동`(기본)이 몸축을 재서 필요할 때만 돌리고, `자동틀=1`(기본)이 거리를 계산한다.
#       손값(`돌리기=`·`거리=`·`눈높이=`)을 주면 그 자리는 손값이 이긴다.
import sys, os

_인자 = {k: v for k, v in (a.split('=', 1) for a in sys.argv[sys.argv.index('--') + 1:])} if '--' in sys.argv else {}
REPO = _인자.get('저장소') or (
    os.path.dirname(os.path.dirname(os.path.abspath(globals()['__file__'])))
    if '__file__' in globals() else os.getcwd())

if not any(a.startswith('실감=') for a in sys.argv):
    sys.argv.append('실감=속살,섬유')      # 들여온 갑옷에 털·잔털은 안 심는다
if not any(a.startswith('토큰=') for a in sys.argv):
    # 🔴 요소굽기는 색 토큰을 «현재 폴더에서 위로» 찾는다 — 저장소 밖에서 부르면 통째로 죽는다.
    #   배치에서 그 죽음은 «종료코드 0 + 산출 0장»으로 조용히 찍힌다(08-27 실측 14판 전멸).
    #   우리는 저장소가 어디인지 이미 아니까, 묻지 말고 넘긴다.
    sys.argv.append('토큰=' + os.path.join(REPO, 'docs', '디자인_토큰.json'))

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
    #   돌리기=x90 · x-90 · z180 처럼 준다(여러 개면 쉼표 · z 는 «찍는 각»을 도는 턴테이블이다).
    def 돌리기(글):
        for _돌 in (s.strip() for s in 글.split(',') if s.strip()):
            축, 각 = _돌[0].upper(), float(_돌[1:])
            R = mathutils.Matrix.Rotation(math.radians(각), 4, 축)
            for o in 들인것:
                o.matrix_world = R @ o.matrix_world
            print('돌림: %s 축 %.0f°' % (축, 각))

    def 점모으기():
        """들인 것 «전부»의 정점을 세계좌표 numpy 로. 300만 점도 40MB 라 통째로 든다."""
        import numpy as np
        덩이 = []
        for o in 들인것:
            수 = len(o.data.vertices)
            a = np.empty(수 * 3, dtype=np.float32)
            o.data.vertices.foreach_get('co', a)
            M = np.array(o.matrix_world)
            덩이.append(a.reshape(수, 3).astype(np.float64) @ M[:3, :3].T + M[:3, 3])
        return np.concatenate(덩이)

    # ── 「어느 쪽이 위인가」 — 추측이 아니라 잰다 ──────────────────────────────
    #   🔑 08-27: 이 물음에 회전 열넷을 태웠다. 답은 회전표에 없었고 «자»에 있었다.
    #     ①가장 긴 축이 몸축이다(사람 꼴은 늘 그렇다) ②그 축의 두 끝 중 **넓은 끝이 발**이다.
    #     둘 다 실물에서 나오는 값이라, 새 에셋이 어떤 축으로 저장돼 있든 같은 절차가 통한다.
    import numpy as _np
    P = 점모으기()
    _lo, _hi = P.min(0), P.max(0)
    긴축 = int(_np.argmax(_hi - _lo))
    폭 = _hi - _lo

    def 끝넓이(a, 위쪽):
        """축 a 의 한쪽 끝 8% 토막이 «옆으로» 얼마나 퍼졌나 — 발은 넓고 머리는 좁다."""
        문턱 = _hi[a] - 폭[a] * 0.08 if 위쪽 else _lo[a] + 폭[a] * 0.08
        토막 = P[P[:, a] > 문턱] if 위쪽 else P[P[:, a] < 문턱]
        곁 = [i for i in range(3) if i != a]
        return max(1e-9, max(_np.ptp(토막[:, 곁[0]]), _np.ptp(토막[:, 곁[1]])))

    윗넓이, 아랫넓이 = 끝넓이(긴축, True), 끝넓이(긴축, False)
    발 = P[P[:, 긴축] < _lo[긴축] + 폭[긴축] * 0.06].mean(0)
    머 = P[P[:, 긴축] > _hi[긴축] - 폭[긴축] * 0.06].mean(0)
    몸축 = 머 - 발
    몸축 = 몸축 / _np.linalg.norm(몸축)
    기욺 = math.degrees(math.acos(min(1.0, abs(float(몸축[2])))))
    print('잼: 긴축 %s(%.1f×%.1f×%.1f) · 몸축 %s · 수직에서 %.1f° · 끝너비 위 %.1f 아래 %.1f'
          % ('xyz'[긴축], 폭[0], 폭[1], 폭[2], _np.round(몸축, 3), 기욺, 윗넓이, 아랫넓이))

    했나 = []
    if _인자.get('돌리기'):
        돌리기(_인자['돌리기'])          # 손값이 이긴다 — 잰 것은 위에 이미 말했다
        했나.append('손값 ' + _인자['돌리기'])
    elif _인자.get('세움', '자동') != '끔':
        if 긴축 != 2:                    # 몸축이 z 가 아니면 z 로 눕힌 것을 세운다
            돌리기('x-90' if 긴축 == 1 else 'y90')
            했나.append('%s축→z' % 'xyz'[긴축])
            P = 점모으기()
            _lo, _hi = P.min(0), P.max(0)
            폭 = _hi - _lo
            윗넓이, 아랫넓이 = 끝넓이(2, True), 끝넓이(2, False)
        if 윗넓이 > 아랫넓이 * 1.25:      # 넓은 끝이 위 = 거꾸로 섰다. 가름이 약하면 안 건드린다
            돌리기('x180')
            했나.append('위아래 뒤집음(위 %.1f > 아래 %.1f)' % (윗넓이, 아랫넓이))
        print('세움: ' + (' · '.join(했나) if 했나 else '손댈 것 없다 — 이미 서 있다'))
        if not 했나 and 기욺 > 30:
            print('⚠몸축이 수직에서 %.0f° 다. 긴축은 z 인데 기울었다 — 조형이 그런 자세이거나'
                  ' 비스듬히 저장된 것이다. 눈으로 보고 「돌리기=x±」 를 손으로 준다.' % 기욺)
    if 했나:
        P = 점모으기()                   # 🔴 돌렸으면 자를 다시 댄다 — 안 그러면 아래 앉히기가 옛 자를 쓴다

    # ── 앉히기: 어떤 스케일·어떤 자리로 나왔든 무대 한가운데 정해진 키로 ─────────
    #   🔑 바깥 에셋은 단위가 제각각이다(밀리미터·인치·임의). «재서 맞추는» 것이 유일하게 안전하다.
    #   🔑 자는 **정점**이지 bound_box 가 아니다 — 돌린 뒤의 상자 여덟 귀는 실제보다 큰 통을 말하고,
    #     그 통으로 키를 맞추면 모델이 조용히 작아진다(돌리기를 쓸 때만 나던 무늬).
    bpy.ops.object.select_all(action='DESELECT')
    for o in 들인것:
        o.select_set(True)
    bpy.context.view_layer.objects.active = 들인것[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    최소 = mathutils.Vector(P.min(0).tolist())
    최대 = mathutils.Vector(P.max(0).tolist())
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

    # 무대 좌표로 옮겨 둔 정점 — 아래 가방·카메라가 «실물»을 보고 정한다(다시 안 잰다).
    무대P = (P - _np.array([중심.x, 중심.y, 0.0])) * 배 + _np.array([0.0, 0.0, -최소.z * 배])

    # ── SYNK 표식 — 등가방(유호 확정 08-26 「뒤에 가방을 멘 상태라면 더 재밌겠다」) ──
    #   ⚠기본이 «끔»이다: 들여오는 미니어처는 대개 제 등짐을 이미 지고 있어서(서전트 둘 다 그렇다)
    #     하나 더 붙이면 등에 혹이 둘 달린다. 등짐 없는 모델에 `가방=1` 로 켠다.
    if _인자.get('가방', '0') not in ('0', '끔'):
        폭, 두께, 높 = 0.62, 0.24, 0.46
        # 🔑 y 를 손으로 짚지 않는다 — 가방이 앉을 «높이 띠»에서 모델의 등(최대 y)을 재서 그 뒤에 붙인다.
        #   손값 0.46 은 첫 서전트 판에서 몸 «앞»에 떠서 갈색 판때기로 찍혔다(08-27 실측).
        띠 = 무대P[(무대P[:, 2] > 1.56 - 높 * 0.5) & (무대P[:, 2] < 1.56 + 높 * 0.5)]
        등 = float(띠[:, 1].max()) if len(띠) else 0.46
        가방 = 베개몸((폭, 두께, 높), 위치=(0, 등 + 두께 * 0.5, 1.56), 크리스=0.34, 레벨=2)
        가방.data.materials.append(재질표['관절'])
        print('가방: 등 뒤 y %.2f (그 높이 띠의 등 표면 %.2f 에 맞춤)' % (등 + 두께 * 0.5, 등))

    # ── 카메라 — 「어디까지 들어오나」도 잰다 ────────────────────────────────
    #   🔴 손으로 맞춘 거리·눈높이가 08-27 오진의 절반이었다: 자세가 제각각인 모델에 같은 값을 대니
    #     어떤 판은 머리가 잘리고 어떤 판은 위에서 본 것처럼 보였고, 그것을 «모델이 누웠다»로 읽었다.
    #   ⇒ 화각(85mm·센서 36)과 잰 크기로 거리를 «계산»한다. 손값을 주면 손값이 이긴다.
    반각 = 18.0 / 85.0                                   # 가로 반화각의 탄젠트
    세로비 = float(_인자.get('비율', '0.82'))             # 요소굽기의 세로/가로 — 세로 화각은 이만큼 좁다
    채움 = float(_인자.get('채움', '0.86'))               # 프레임의 몇 할을 물건이 차지하나
    얼굴 = _인자.get('구도', '전신') == '얼굴'
    골 = 무대P[무대P[:, 2] > 목표키 * 0.76] if 얼굴 else 무대P
    가로반 = max(abs(float(골[:, 0].min())), abs(float(골[:, 0].max())))
    앞 = abs(float(골[:, 1].min()))                       # 카메라 쪽으로 가장 나온 자리
    위, 아래 = float(골[:, 2].max()), float(골[:, 2].min())
    # 「자동」·빈값은 «재서 정한다»는 뜻이다 — 배치가 앞에서 손값을 깔아도 뒤에서 되돌릴 수 있게.
    #   거리는 0 도 자동으로 읽는다(거리 0 은 뜻이 없는 값이고, 0 을 그대로 믿으면 카메라가 몸속에 선다).
    def 손값(이름, 자동으로도=()):
        값 = _인자.get(이름)
        return None if 값 in (None, '', '자동') or 값 in 자동으로도 else float(값)

    #   🔑 카메라 높이와 «겨누는 자리»를 가른다. 수평 카메라만 쓰면 그 둘이 한 값이라,
    #     낮게 서면(압도감) 프레임 아래가 통째로 비고 물건이 작아진다. 피치를 계산해 겨누면
    #     **낮게 서면서 꽉 채운다** — 08-27 첫 판이 위쪽으로 쏠려 있던 자리다.
    눈높이 = 손값('눈높이')
    눈높이 = (눈높이 * 목표키 if 눈높이 is not None
             else (위 + 아래) * 0.5 if 얼굴 else 목표키 * 0.32)
    겨눔 = (위 + 아래) * 0.5                              # 프레임 한가운데에 올 자리 = 물건의 허리
    세로반 = (위 - 아래) * 0.5
    거리 = 손값('거리', ('0',)) or 앞 + max(
        세로반 / (반각 * 세로비 * 채움), 가로반 / (반각 * 채움))
    피치 = 90 + math.degrees(math.atan2(겨눔 - 눈높이, max(0.1, 거리)))
    print('틀: %s · 거리 %.2f · 눈높이 %.2f · 겨눔 %.2f · 피치 %.2f° (가로반 %.2f · 세로반 %.2f · 앞 %.2f)'
          % ('얼굴' if 얼굴 else '전신', 거리, 눈높이, 겨눔, 피치, 가로반, 세로반, 앞))
    return (0, -거리, 눈높이), 피치


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

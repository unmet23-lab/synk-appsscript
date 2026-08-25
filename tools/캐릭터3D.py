# 캐릭터 3D — 실시간(360°) 자산을 «표준 GLB 하나»로 굽는다 (2026-08-26 · 유호 지시 「진짜 게임처럼 360도」).
#
# ■ 이 도구가 푸는 관문 하나 — «펠트 털을 GLB 에 담는 법»
#   정본 굽기(요소굽기.py)의 털은 **블렌더 헤어 파티클**이라 glTF 규격 밖이다.
#   그대로 내보내면 **털이 통째로 사라진 민둥 몸**이 나온다 — 펠트는 회사 전용 재질이라 그건 죽음이다.
#   ⇒ 털을 **«셸»(껍질 여러 겹)로 굽는다**: 몸 표면을 N 겹 복제해 노멀 방향으로 밀어내고,
#     각 겹을 «털 밀도» 텍스처로 알파 클립(MASK)한다. 낮은 겹은 많이 남고 높은 겹은 조금 남아
#     **원뿔 모양 털**이 선다. 겹은 «진짜 지오메트리»라 커스텀 셰이더가 필요 없다 —
#     🔑 그래서 이 GLB 는 three.js·filament·블렌더 어디에 넣어도 **그대로 털이 보인다.**
#
#   🔑 텍스처는 **한 장**이다. 겹을 가르는 것은 `alphaCutoff` 하나뿐(겹 i → i/N).
#     같은 무작위 밀도 맵을 점점 높은 문턱으로 자르면 그것이 곧 털의 «가늘어짐»이다.
#   ⚠ 알파는 BLEND 가 아니라 **MASK** 다 — BLEND 는 겹칠 때 그리는 순서를 타서(정렬 문제)
#     360° 로 돌리면 겹이 서로를 지운다. MASK 는 픽셀이 있거나 없거나라 순서와 무관하다.
#
# ■ 형태는 «절차»로 짓는다 — 몽글이는 3D 소스가 없기 때문이다
#   정본 `펠트코랄_0815` 는 생성 이미지를 재염색한 PNG 뿐이다(커밋 15e2290d5).
#   그래서 3D 는 새로 짓는 수밖에 없다. 까몽·마린이 이미 그 방식(절차적 블렌더)이고,
#   이것은 «생성 모델 재생성»이 아니라 코드가 쥐는 형태라 유호 확정 08-14 「재생성 금지」와 무충돌이다.
#   실루엣은 정본 그림에서 읽었다: 둥근 돔 → 아래로 벌어지는 몸 → **물결 밑단 6산**.
#
# ■ 대가(틀릴 때의 모습)
#   · 셸은 «짧은 털»에만 성립한다. 긴 갈기는 겹이 벌어져 «비늘»로 읽힌다 — SYNK 는 짧은 퍼라 성립한다.
#   · 겹 수가 성능을 가른다(겹 = 정점 배수). 8겹이 기본 — 모바일에서 그 이상은 재보고 올린다.
#   · 극단 클로즈업에서는 겹 사이가 보인다. 그 자리는 실시간이 아니라 밤 Cycles 렌더가 맡는다.
#
# 쓰기:
#   blender -b -P tools/캐릭터3D.py -- 출력=<경로.glb> [캐릭터=몽글] [겹=8] [털길이=0.055] [해상도=1024]
import math
import os
import sys

import bpy

_인자 = {}
if '--' in sys.argv:
    for a in sys.argv[sys.argv.index('--') + 1:]:
        if '=' in a:
            k, v = a.split('=', 1)
            _인자[k] = v

출력 = _인자.get('출력') or sys.exit('출력=<경로.glb> 가 필요하다')
캐릭터 = _인자.get('캐릭터', '몽글')
겹수 = int(_인자.get('겹', '5'))
털길이 = float(_인자.get('털길이', '0.075'))
해상도 = int(_인자.get('해상도', '1024'))
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 킷 색 — docs/디자인_토큰.json 의 마스코트 평상복 램프와 같은 값(DESIGN.md §2 표).
색 = {
    'Coral':      (0.976, 0.408, 0.349),
    'Coral 2':    (0.992, 0.612, 0.529),
    'Coral Soft': (0.984, 0.718, 0.639),
    'Coral 3':    (0.682, 0.196, 0.165),
    'Stitch':     (0.941, 0.890, 0.784),
    'Ink':        (0.169, 0.137, 0.125),
    'Paper':      (0.984, 0.969, 0.941),
}


def s리니어(c):
    """sRGB → 선형. 블렌더 재질 색은 선형이고 위 표는 sRGB 라 반드시 거친다."""
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def 판갈이():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ── ① 형태 — 정본 «사진에서 뜬» 윤곽으로 짓는다 ──────────────────────────────
윤곽경로 = os.path.join(REPO, 'docs', '캐릭터', '생명공방_0826', '몽글_정면윤곽_사진에서뜸.json')


def 윤곽읽기(경로=None):
    """🔴 08-26 유호 반려 「윤곽자체도 다르지않아?」의 답.

    새벽 판은 프로파일을 **손으로 지어냈고**, 그것이 정본과 다른 몸을 만들었다 —
    같은 자로 재니 정면 IoU **81.1%**. 어깨가 15% 넓고, 최대폭이 중간에 있고(사진은 92%),
    밑단이 확 좁아졌다(사진 0.443 대 3D 0.192).
    ⇒ 지어내지 않는다. 정본 사진의 실루엣에서 **행마다 반폭을 뜬 64칸**을 그대로 쓴다.
      같은 자로 **97.18%**(왕복 검증 · 회전체의 원리적 천장 ≈99.4% 에 거의 붙었다).

    ⚠ 이 파일이 없으면 «조용히 옛 몸»으로 돌아가지 않고 그 자리에서 깨진다 —
      조용한 폴백이 「왜 옛 판이 나오지?」를 만드는 자리다.
    """
    import json
    경로 = 경로 or 윤곽경로
    if not os.path.exists(경로):
        raise SystemExit(f'🔴 정본 윤곽이 없다: {경로} — 이 프로파일이 몸의 주인이다')
    d = json.load(open(경로, encoding='utf-8'))
    return d['반폭'], int(d['칸수'])


# 물결이 «아래로 뻗는» 몫 — 프로파일 끝 3칸(96.8·98.4·100%)이 그 산의 끝이라 급락한다.
# 프로파일은 그 앞(95.2%)까지 쓰고, 아래는 물결이 맡는다. 안 그러면 회전체에 «뾰족한 꼬리»가 돈다.
윤곽꼬리 = 3


def 몽글몸(고리=64, 물결산=6, 물결깊이=None, 높이=None):
    """정본 실루엣을 회전체로 세운다 — 반지름은 «사진에서 뜬 반폭», 세로도 그 비율 그대로.

    🔑 물결은 **아래로만** 판다. 프로파일의 마지막 칸이 이미 «물결 골의 바닥»이라
      위아래로 흔들면 골이 두 번 파여 밑단이 얇아진다(팀메이트 왕복검증 §_쓰는법 의 그 자리).
    """
    반폭, N = 윤곽읽기()
    쓸칸 = N - 윤곽꼬리
    # 세로 비율 — 반폭이 «전체 높이로 정규화»된 값이라, 최대 반지름이 1.0 이 되게 높이를 잡으면
    # 사진의 가로세로 비가 그대로 선다(크기는 상대적이라 카메라가 맞춘다).
    # 🔑 가로와 세로를 «가른다». H 하나로 줄이면 가로도 같이 줄어 절대값인 털·물결이
    #   상대적으로 커져 세로가 오히려 더 길어진다(08-26 실측: 보정 0.945 를 넣자 −5.5% → −8.2%).
    H = 높이 if 높이 else 1.0 / max(반폭[:쓸칸])          # 가로 스케일 = 반지름의 주인
    세로 = H * float(_인자.get('세로보정', '0.945'))       # 세로만 따로 — 물결·셸이 더하는 몫을 되돌린다(실측)
    # 물결 진폭 = 정본 밑단 실측 «몸높이의 6.89%»(열마다 최하단 픽셀을 떠서 잼).
    #   윤곽꼬리(3칸=4.76%)로 잡던 값보다 1.45배 깊다 — 그래서 밑단이 밋밋했다.
    깊이 = 물결깊이 if 물결깊이 is not None else 세로 * float(_인자.get('물결깊이몫', '0.0689'))
    # ⚠ 「사진 윤곽은 털 끝이니 몸을 털 두께만큼 안으로 넣자」는 **실측에서 졌다**(08-26):
    #   보정 0 → IoU 94.39% · 보정 0.075 → **90.63%**. 셸의 바깥 겹은 컷오프가 높아 거의 안 남으므로
    #   실루엣이 실제로 넓어지는 폭은 털길이보다 훨씬 작다. ⇒ 기본 0, 손잡이만 남긴다.
    안쪽 = float(_인자.get('안쪽', '0'))

    # 위쪽은 칸 간격이 넓어 직선으로 이으면 «원뿔»이 된다 — 정본은 둥근 돔이다.
    # 칸 사이를 3차 보간으로 갈라 넣어 꼭대기를 둥글린다(칸 값 자체는 안 건드린다).
    잘게 = int(_인자.get('세로분할', '3'))
    물결시작 = float(_인자.get('물결시작', '0.70'))     # 아래 30% 가 스캘럽으로 내려간다
    def 보간(x):
        i = max(0, min(쓸칸 - 1, int(x)))
        f = x - i
        p0 = 반폭[max(0, i - 1)]; p1 = 반폭[i]
        p2 = 반폭[min(쓸칸 - 1, i + 1)]; p3 = 반폭[min(쓸칸 - 1, i + 2)]
        return 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f
                      + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f)

    정점, 면, uv면 = [], [], []
    М = (쓸칸 - 1) * 잘게 + 1
    for jj in range(М):
        x = jj / 잘게
        j = x
        v = x / (N - 1)                       # 0(위) ~ 1(아래) — 원본 칸 기준
        r = max(0.004, 보간(x) * H - 안쪽)
        z = (0.5 - v) * (세로 - 2 * 안쪽)
        for i in range(고리):
            t = 2 * math.pi * i / 고리
            # 아래로만 파는 물결 — (1-cos)/2 는 0~1 이라 위로는 절대 안 올라간다.
            # ⚠ 감쇠를 (jj/М)³ 로 두면 **마지막 한 줄만** 내려가 «얇은 주름»이 된다(08-26 실측
            #   화면 진폭 0.98% · 정본 6.84%). 스캘럽은 밑단 «구간»이 통째로 내려가야 선다.
            u = jj / (М - 1)
            f = max(0.0, (u - 물결시작) / max(1e-6, 1.0 - 물결시작))
            내림 = 깊이 * ((1.0 - math.cos(물결산 * t)) * 0.5) * (f * f * (3.0 - 2.0 * f))
            정점.append((r * math.cos(t), r * math.sin(t), z - 내림))
    # 🔴 바닥을 «중앙점 하나»로 닫으면 그 팬 삼각형이 물결 골을 가로질러 메운다 —
    #   깊이를 키울수록 화면 물결이 «줄어드는» 거꾸로가 나온다(08-26 실측 2.00% → 0.89% → 0.00%).
    #   ⇒ 밑단 링을 «자기 자리에서 안쪽으로 말아» 닫는다. 각 산·골이 제 각도를 지킨 채 오므라든다.
    말이단 = 2
    for k in range(1, 말이단 + 1):
        f = k / (말이단 + 1)
        for i in range(고리):
            t = 2 * math.pi * i / 고리
            내림 = 깊이 * ((1.0 - math.cos(물결산 * t)) * 0.5)
            r밑 = max(0.004, 보간(쓸칸 - 1) * H - 안쪽) * (1.0 - f * 0.82)
            z밑 = (0.5 - (쓸칸 - 1) / (N - 1)) * (세로 - 2 * 안쪽) - 내림 * (1.0 - f * 0.35) + 깊이 * f * 0.30
            정점.append((r밑 * math.cos(t), r밑 * math.sin(t), z밑))
    바닥z = (0.5 - (쓸칸 - 1) / (N - 1)) * (세로 - 2 * 안쪽) + 깊이 * 0.42
    정점.append((0.0, 0.0, 바닥z))
    바닥 = len(정점) - 1
    М전체 = М + 말이단

    def idx(i, j):
        return j * 고리 + (i % 고리)

    for j in range(М - 1):
        for i in range(고리):
            a, b2, c, d = idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)
            # ⚠ winding — 뒤집히면 노멀이 안쪽을 향해 셸이 몸 속으로 파고든다(08-26 실측 dot=−0.999).
            if j == 0:
                면.append((a, d, c))
                uv면.append(((i / 고리, 0.0), (i / 고리, 1 / (М - 1)), ((i + 1) / 고리, 1 / (М - 1))))
            else:
                면.append((a, d, c, b2))
                uv면.append(((i / 고리, j / (М - 1)), (i / 고리, (j + 1) / (М - 1)),
                            ((i + 1) / 고리, (j + 1) / (М - 1)), ((i + 1) / 고리, j / (М - 1))))
    # 말이 링들을 잇는다
    for j in range(М - 1, М전체 - 1):
        for i in range(고리):
            a, b2, c, d = idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)
            면.append((a, d, c, b2))
            uv면.append(((i / 고리, 1.0), (i / 고리, 1.0), ((i + 1) / 고리, 1.0), ((i + 1) / 고리, 1.0)))
    for i in range(고리):
        면.append((idx(i, М전체 - 1), idx(i + 1, М전체 - 1), 바닥))
        uv면.append(((i / 고리, 1.0), ((i + 1) / 고리, 1.0), ((i + 0.5) / 고리, 1.0)))

    me = bpy.data.meshes.new('몽글몸')
    me.from_pydata(정점, [], 면)
    me.update()
    층 = me.uv_layers.new(name='UVMap')
    k = 0
    for f, uvs in zip(me.polygons, uv면):
        for uv in uvs:
            층.data[k].uv = uv
            k += 1
    ob = bpy.data.objects.new('몽글몸', me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    ob['H'] = H
    return ob


def 표면점(v):
    """세로 v(0~1) 자리의 «몸 표면 반지름과 높이» — 눈·소품을 프로파일에 맞춰 앉힌다.
    손으로 적은 좌표는 프로파일이 바뀔 때마다 조용히 어긋난다(눈이 털에 묻힌 08-26 자리)."""
    반폭, N = 윤곽읽기()
    쓸칸 = N - 윤곽꼬리
    # 🔴 몽글몸() 과 «같은 식»이어야 한다. 08-26 에 여기만 안쪽=털길이 였고 몸은 0 이라
    #   표면점이 몸보다 0.075 안쪽을 돌려줬다 — 그 자리에 눈을 놓으니 셸이 통째로 덮었다.
    #   좌표를 두 곳에서 따로 계산하면 반드시 갈린다(CLAUDE.md 「주인은 하나」).
    H = 1.0 / max(반폭[:쓸칸])
    세로 = H * float(_인자.get('세로보정', '1.0'))
    안쪽 = float(_인자.get('안쪽', '0'))
    j = min(쓸칸 - 1, max(0, int(round(v * (N - 1)))))
    return max(0.004, 반폭[j] * H - 안쪽), (0.5 - j / (N - 1)) * (세로 - 2 * 안쪽)


# ── ② 털 밀도 맵 — 무작위 «가닥 씨앗» 한 장 ──────────────────────────────────
def 털맵(경로, 크기, 밀도=0.62, 씨=20260826):
    """각 텍셀 = 「그 자리 털이 어디까지 자라는가」(0~1).

    겹 i 는 이 값이 i/N 보다 큰 자리만 남긴다 ⇒ 낮은 겹은 굵고 높은 겹은 가늘어져 원뿔이 선다.
    ⚠ 균일 난수를 그대로 쓰면 «모래»가 된다 — 가닥은 «점»이 아니라 «작은 원»이라야
      털로 읽힌다. 그래서 씨앗을 뿌리고 각 씨앗 둘레에 부드러운 감쇠를 그린다.
    ⚠ 블렌더 내장 파이썬에는 PIL 이 없다(실측 08-26) — 이미지 저장은 bpy 가 한다.
    """
    import random

    import numpy as np

    손 = random.Random(씨)
    a = np.zeros((크기, 크기), dtype=np.float32)
    # 🔑 08-26 파라미터 탐색으로 못박은 값 — 「덮임」과 「끝」 둘을 동시에 만족하는 자리다.
    #   피부 덮임 94.2%(>0.115) · 중간 86.7%(>0.46) · **털 끝 29.7%(>0.92)**.
    #   ⚠ 너무 촘촘하면(끝 60%대) 최상단 겹이 화면을 다 덮어 **다시 매끈해진다** — 위아래 둘 다 함정이다.
    가닥수 = int(크기 * 크기 * 밀도 / 14.0)
    반경 = max(3.0, 크기 / 110.0)
    R = int(반경 * 1.3)
    yy, xx = np.mgrid[-R:R + 1, -R:R + 1]
    거리 = np.sqrt(xx ** 2 + yy ** 2) / 반경
    # 단면은 «원뿔»이 아니라 **평평한 원판 + 부드러운 테**다.
    #   원뿔(지수 감쇠)이면 중심만 높아 털 «끝»이 3.5% 밖에 안 남는다(실측) — 끝이 없으면 결이 안 보인다.
    핵 = np.clip((1.0 - 거리) / 0.28, 0.0, 1.0)
    for _ in range(가닥수):
        cx, cy = 손.randrange(크기), 손.randrange(크기)
        조각 = 핵 * 손.uniform(0.62, 1.0)          # 가닥마다 키가 다르다 = 층이 생긴다
        ys = (cy + np.arange(-R, R + 1)) % 크기    # 감김 인덱싱 — 타일 이음매 0
        xs = (cx + np.arange(-R, R + 1)) % 크기
        칸 = np.ix_(ys, xs)
        a[칸] = np.maximum(a[칸], 조각)
    im = bpy.data.images.new('털밀도', 크기, 크기, alpha=True)
    px = np.ones((크기, 크기, 4), dtype=np.float32)
    px[:, :, 3] = a
    im.pixels.foreach_set(px.ravel())
    im.filepath_raw = 경로
    im.file_format = 'PNG'
    im.alpha_mode = 'STRAIGHT'
    im.save()
    return im



# ── ②-b 펠트 표면 — 정본에서 «잘라낸» 타일을 쓴다 ────────────────────────────
def 펠트타일(패치경로, 세기=None):
    """🔑 08-26 유호 반려 「펠트 느낌이 1도 안 난다」의 답.

    절차 생성으로 양모를 «흉내내는» 길을 네 판 시도했고 전부 졌다 — 정본은 짧은 보풀이 아니라
    **긴 섬유가 표면에 누워 얽힌 것**이라 점·선을 뿌려서는 그 결이 안 나온다.
    ⇒ 흉내내지 않는다. `docs/캐릭터/펠트패치_0815/`(Loom L2b)가 **정본 사진에서 잘라 둔 타일**을
      이미 갖고 있다(미러 처리되어 이음매 0). 그걸 그대로 표면에 입힌다 —
      유호 확정 08-14 「원본 픽셀을 두고 좌표만」과 정면 정합이고, 결은 사진 픽셀에서만 온다는
      펠트엔진 헌법 ①과도 같은 자리다.

    노멀맵은 그 사진의 «밝기»에서 유도한다 — 양모 사진에서 밝은 자리는 빛을 받는 섬유의 «위»다.
    이것이 조명을 받아 «미세 그림자»를 만들고, 그 그림자가 펠트로 읽히게 하는 실체다.
    """
    import numpy as np
    if 세기 is None:
        세기 = float(_인자.get('노멀세기', '1.5'))
    tex = bpy.data.images.load(패치경로)
    # 🔴 08-26 실측 — 색공간을 «명시»한다. 안 하면 블렌더가 이 PNG 의 sRGB 값을 선형으로
    #   취급해 통째로 밝아진다(읽힌 평균 #FBAA9F vs 파일 #F6695A). 렌더가 「바랜 분홍」이 된
    #   진짜 원인이 이 한 줄이었다 — 조명도 톤매핑도 아니었다.
    tex.colorspace_settings.name = 'sRGB'
    W, H = tex.size
    px = np.zeros(W * H * 4, dtype=np.float32)
    tex.pixels.foreach_get(px)
    rgb = px.reshape(H, W, 4)[:, :, :3]
    if float(rgb.max()) > 0.0 and float(np.percentile(rgb, 99.5)) > 0.95:
        # 값이 sRGB 로 들어온 판(빌드에 따라 다르다) — 선형으로 되돌려 기울기를 잰다
        rgb = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    Y = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    gx = np.roll(Y, -1, 1) - np.roll(Y, 1, 1)
    gy = np.roll(Y, -1, 0) - np.roll(Y, 1, 0)
    배 = 세기 / max(1e-6, float(np.percentile(np.abs(gx), 99)))
    n = np.stack([-gx * 배, -gy * 배, np.ones_like(Y)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    법 = bpy.data.images.new('펠트노멀', W, H, alpha=False, float_buffer=False)
    법.colorspace_settings.name = 'Non-Color'      # ⚠컬러로 두면 감마가 먹어 요철이 뒤틀린다
    출 = np.ones((H, W, 4), dtype=np.float32)
    출[:, :, :3] = n * 0.5 + 0.5
    법.pixels.foreach_set(출.ravel())
    return tex, 법


def 펠트칠(nt, bsdf, 펠트, 법, 타일, 밝기=1.0):
    """재질 노드에 펠트 타일 + 노멀맵을 건다. 밝기는 셸 겹의 뿌리 그늘용."""
    좌표 = nt.nodes.new('ShaderNodeTexCoord')
    맵핑 = nt.nodes.new('ShaderNodeMapping')
    맵핑.inputs['Scale'].default_value = (타일[0], 타일[1], 1.0)
    nt.links.new(좌표.outputs['UV'], 맵핑.inputs['Vector'])
    색텍 = nt.nodes.new('ShaderNodeTexImage')
    색텍.image = 펠트
    # 🔑 REPEAT 이면 타일 경계가 «가로 띠»로 보인다(08-26 몸통 중앙). MIRROR 는 경계에서
    #   무늬가 접히므로 이음매가 사라진다 — 패치가 이미 미러 처리라 결이 어긋나지 않는다.
    색텍.extension = _인자.get('타일방식', 'MIRROR')
    nt.links.new(맵핑.outputs['Vector'], 색텍.inputs['Vector'])
    if 밝기 == 1.0:
        nt.links.new(색텍.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        곱 = nt.nodes.new('ShaderNodeMixRGB')
        곱.blend_type = 'MULTIPLY'
        곱.inputs['Fac'].default_value = 1.0
        곱.inputs['Color2'].default_value = (밝기, 밝기, 밝기, 1.0)
        nt.links.new(색텍.outputs['Color'], 곱.inputs['Color1'])
        nt.links.new(곱.outputs['Color'], bsdf.inputs['Base Color'])
    법텍 = nt.nodes.new('ShaderNodeTexImage')
    법텍.image = 법
    법텍.extension = _인자.get('타일방식', 'MIRROR')
    nt.links.new(맵핑.outputs['Vector'], 법텍.inputs['Vector'])
    법노드 = nt.nodes.new('ShaderNodeNormalMap')
    법노드.inputs['Strength'].default_value = 0.55
    nt.links.new(법텍.outputs['Color'], 법노드.inputs['Color'])
    nt.links.new(법노드.outputs['Normal'], bsdf.inputs['Normal'])
    return 색텍

# ── ③ 셸 — 겹을 «진짜 지오메트리»로 굽는다 ───────────────────────────────────
def 셸입히기(몸, tex, 겹수, 길이, 몸색, 타일=3.0, 펠트=None, 법=None, 펠트타일수=(5.2, 1.6)):
    """몸을 N 겹 복제해 노멀 방향으로 밀고, 겹마다 alphaCutoff 를 높인다."""
    안쪽 = s리니어(몸색)
    껍질들 = []
    for i in range(1, 겹수 + 1):
        t = i / 겹수
        새 = 몸.copy()
        새.data = 몸.data.copy()
        새.name = f'털겹_{i:02d}'
        bpy.context.collection.objects.link(새)
        # 노멀 방향 밀어내기 — Displace 대신 정점을 직접 옮긴다(모디파이어는 GLB 로 안 나간다).
        # ⚠ 노멀을 «먼저 전부» 읽는다 — co 를 고치는 도중에 읽으면 이미 옮긴 이웃 때문에 재계산되어 오염된다.
        법선 = [v.normal.copy() for v in 새.data.vertices]
        zs = [v.co[2] for v in 새.data.vertices]
        z0, z1 = min(zs), max(zs)
        띠 = max(1e-6, (z1 - z0) * float(_인자.get('밑단셸띠', '0.22')))
        for v, n in zip(새.data.vertices, 법선):
            # 🔴 밑단에서는 «아래로» 밀지 않는다 — 셸이 물결 골을 메워 스캘럽이 사라진다
            #   (08-26 실측: 셸 0겹 2.98% → 5겹 0.89%. 메시 자체는 6.75% 로 멀쩡했다).
            #   옆으로는 그대로 나가므로 털의 두께·실루엣 보풀은 안 잃는다.
            zk = min(1.0, max(0.0, (v.co[2] - z0) / 띠))
            v.co = (v.co[0] + n[0] * 길이 * t,
                    v.co[1] + n[1] * 길이 * t,
                    v.co[2] + n[2] * 길이 * t * zk)
        m = bpy.data.materials.new(f'털_{i:02d}')
        m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes['Principled BSDF']
        # 뿌리는 그늘, 끝은 빛 — 이 한 축이 «부피»를 낸다(펠트 램프 5단의 축약).
        # 🔑 08-26 실측: 0.72~1.14(폭 1.58배)로는 **정면이 매끈한 고무로 렌더된다.**
        #   겹의 구멍으로 보이는 것은 «바로 아래 겹»인데 밝기가 1/8 밖에 안 갈리면 대비가 0 이다.
        #   털이 보이는 것은 가닥이 아니라 **뿌리 그늘**이므로 t 를 비선형으로 눌러 폭을 4배로 연다.
        # 08-26 실측: 표면 결을 펠트 타일이 맡게 된 뒤로는 겹의 밝기 곱이 «누적»되어 흰빛으로 떴다.
        #   겹은 이제 실루엣 보풀만 맡으므로 1.0 을 넘지 않는다(위로 밝히지 않고 아래로만 어둡게).
        밝기 = 0.62 + 0.38 * (t ** 1.4)
        if 펠트 is not None:
            펠트칠(nt, bsdf, 펠트, 법, 펠트타일수, 밝기)      # 결은 사진에서, 그늘은 겹 깊이에서
        else:
            bsdf.inputs['Base Color'].default_value = (안쪽[0] * 밝기, 안쪽[1] * 밝기, 안쪽[2] * 밝기, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.97
        if 'Specular IOR Level' in bsdf.inputs:
            bsdf.inputs['Specular IOR Level'].default_value = 0.04   # 양모는 거의 반사가 없다
        텍노드 = nt.nodes.new('ShaderNodeTexImage')
        텍노드.image = tex
        텍노드.interpolation = 'Closest'   # 문턱 근처를 뭉개지 않는다 — 가닥 끝이 또렷해진다
        맵핑 = nt.nodes.new('ShaderNodeMapping')
        좌표 = nt.nodes.new('ShaderNodeTexCoord')
        맵핑.inputs['Scale'].default_value = (타일, 타일, 1.0)
        nt.links.new(좌표.outputs['UV'], 맵핑.inputs['Vector'])
        nt.links.new(맵핑.outputs['Vector'], 텍노드.inputs['Vector'])
        # 🔑 알파를 **0/1 로 직접 자른다** — blender 4.2 에서 CLIP 블렌드가 사라져
        #   재질 설정만으로는 클립이 안 된다(08-26 실측: 8겹이 통째로 불투명해져 매끈한 고무로 렌더됐다).
        #   Greater Than 은 렌더러·내보내기와 무관하게 «셰이더가» 자르므로 어디서나 같은 그림이 나온다.
        자르기 = nt.nodes.new('ShaderNodeMath')
        자르기.operation = 'GREATER_THAN'
        자르기.inputs[1].default_value = t * 0.92
        nt.links.new(텍노드.outputs['Alpha'], 자르기.inputs[0])
        nt.links.new(자르기.outputs['Value'], bsdf.inputs['Alpha'])
        # 🔑 glTF exporter 는 이 둘을 읽어 alphaMode=MASK · alphaCutoff 를 쓴다.
        #   5.x 에서 이름이 바뀐 자리가 있어 있는 것만 세팅한다(없으면 후처리가 GLB JSON 에 직접 박는다).
        for 키, 값 in (('blend_method', 'CLIP'), ('alpha_threshold', t * 0.92),
                      ('surface_render_method', 'DITHERED')):
            try:
                setattr(m, 키, 값)
            except (AttributeError, TypeError):
                pass
        새.data.materials.clear()
        새.data.materials.append(m)
        껍질들.append((새, t * 0.92))
        if i == 겹수:
            print(f'[캐릭터3D] 진단 · 바깥겹 재질: '
                  f"surface_render_method={getattr(m, 'surface_render_method', '없음')} "
                  f"blend={getattr(m, 'blend_method', '없음')} 컷오프={t*0.92:.3f}")
    # 속몸 — 겹 사이로 배경이 비치지 않게 받치는 불투명 몸
    속 = bpy.data.materials.new('속살')
    속.use_nodes = True
    b = 속.node_tree.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.97
    if 'Specular IOR Level' in b.inputs:
        b.inputs['Specular IOR Level'].default_value = 0.04
    if 펠트 is not None:
        펠트칠(속.node_tree, b, 펠트, 법, 펠트타일수, 1.0)    # 표면 = 정본 펠트 그대로
    else:
        b.inputs['Base Color'].default_value = (안쪽[0] * 0.26, 안쪽[1] * 0.26, 안쪽[2] * 0.26, 1.0)
    몸.data.materials.clear()
    몸.data.materials.append(속)
    return 껍질들


# ── ④ 구슬 눈 ────────────────────────────────────────────────────────────────
def 구슬눈(반경=None, 눈v=None, 지름몫=None, 간격몫=None, 털두께=None):
    """또렷한 것은 «광 나는 구슬» — 몽글 문법. 캐치라이트 한 점이 생기를 낸다.

    🔑 자리는 **프로파일에서 계산한다** — 손으로 적은 좌표는 윤곽이 바뀌면 조용히 어긋난다
      (08-26 에 셸을 밀자 눈이 털에 통째로 묻힌 자리가 그것이다).
      눈v = 사진 실측 「눈이 위에서 30.7%」(character-customization-verdict).
    ⚠ 구슬 반경이 털 두께보다 커야 절반이 솟는다.
    """
    # 🔑 08-26 정본 실측(채도<0.22 & 어두움으로 구슬만 골라 잼) — 지어낸 값을 쓰지 않는다:
    #   지름 = 몸폭의 8.63% · 중심 간격 = 몸폭의 34.87% · 세로 = 위에서 34.3%.
    #   ⚠ 그 값을 «그대로» 넣으면 화면에서는 간격 +8.9% · 세로 +12.5% 로 어긋난다 —
    #     눈이 «구면»에 붙어 정면 투영이 벌어지고, 물결·셸이 세로를 늘리기 때문이다.
    #     ⇒ 화면에서 되재어 수렴시킨 값이 아래 기본값이다(실측 차 지름 +2.9% · 간격 −0.1% · 세로 −2.3%).
    #   내 첫 값(지름 14.25% · 간격 25% · 세로 30.7%)은 눈이 크고 몰려 있어 다른 얼굴로 읽혔다.
    눈v = 눈v if 눈v is not None else float(_인자.get('눈세로', '0.305'))
    지름몫 = 지름몫 if 지름몫 is not None else float(_인자.get('눈지름', '0.0863'))
    간격몫 = 간격몫 if 간격몫 is not None else float(_인자.get('눈간격', '0.3203'))
    r몸, z = 표면점(눈v)
    털 = 털두께 if 털두께 is not None else 털길이
    # 🔴 셸이 몸을 털길이만큼 덮는다 — 눈 중심을 «털 표면»에 두어야 절반이 솟는다.
    #   몸 표면에 두면 08-26 처럼 통째로 묻힌다(같은 함정 두 번째).
    r표면 = r몸 + 털
    몸폭 = 2.0                                   # 몽글몸() 이 max 반폭을 1.0 으로 정규화한다
    반경 = 반경 if 반경 else 몸폭 * 지름몫 * 0.5
    간격 = 몸폭 * 간격몫
    sin각 = min(0.985, 간격 / (2 * max(r표면, 1e-6)))
    각 = math.asin(sin각)
    눈들 = []
    검정 = bpy.data.materials.new('눈구슬')
    검정.use_nodes = True
    b = 검정.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*s리니어(색['Ink']), 1.0)
    b.inputs['Roughness'].default_value = 0.14
    if 'Metallic' in b.inputs:
        b.inputs['Metallic'].default_value = 0.0
    흰 = bpy.data.materials.new('캐치라이트')
    흰.use_nodes = True
    w = 흰.node_tree.nodes['Principled BSDF']
    w.inputs['Base Color'].default_value = (*s리니어(색['Paper']), 1.0)
    w.inputs['Roughness'].default_value = 0.08
    if 'Emission Color' in w.inputs:
        w.inputs['Emission Color'].default_value = (*s리니어(색['Paper']), 1.0)
        w.inputs['Emission Strength'].default_value = 0.45
    for 쪽 in (-1, 1):
        x = 쪽 * r표면 * math.sin(각)
        y = -r표면 * math.cos(각)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=반경, segments=28, ring_count=18)
        눈 = bpy.context.object
        눈.name = f'눈_{"좌" if 쪽 < 0 else "우"}'
        눈.location = (x, y, z)          # 중심이 몸 «표면»에 — 절반이 솟는다
        눈.data.materials.append(검정)
        for p in 눈.data.polygons:
            p.use_smooth = True
        눈들.append(눈)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=반경 * 0.27, segments=16, ring_count=10)
        빛 = bpy.context.object
        빛.name = f'캐치_{"좌" if 쪽 < 0 else "우"}'
        빛.location = (x - 쪽 * 반경 * 0.30, y - 반경 * 0.62, z + 반경 * 0.34)
        빛.data.materials.append(흰)
        for p in 빛.data.polygons:
            p.use_smooth = True
    return 눈들



# ── ④-b 실땀 — 「실땀은 모든 펠트 오브젝트의 테두리」(DESIGN.md 운용 규칙 ②) ────
def 밑단실땀(몸, 땀수=78, 물결산=6, 굵기몫=0.0105, 길이몫=0.042, 바깥몫=0.006, 띄움몫=0.050):
    """정본 밑단을 따라 도는 크림 러닝스티치. 08-26 첫 판에 통째로 빠져 있던 자리다.

    ⚠ 같은 날 두 번 어긋났다 — ①안쪽에 박아 털에 묻혔고(화면 0px) ②밖으로 뺐더니 굵어서
      «소시지»로 읽혔다. 정본의 실은 «가늘고 촘촘»하다(몸폭의 약 1% 굵기).

    밑단 곡선(물결)을 그대로 따라가야 «기운 자국»으로 읽힌다 — 평평한 링에 두르면
    테이프처럼 보인다. 그래서 각 땀의 z 를 몽글몸() 과 «같은 물결 식»으로 계산한다.
    """
    반폭, N = 윤곽읽기()
    쓸칸 = N - 윤곽꼬리
    H = 1.0 / max(반폭[:쓸칸])
    세로 = H * float(_인자.get('세로보정', '0.945'))
    깊이 = 세로 * float(_인자.get('물결깊이몫', '0.0689'))
    r밑 = 반폭[쓸칸 - 1] * H
    z밑 = (0.5 - (쓸칸 - 1) / (N - 1)) * 세로
    몸폭 = 2.0
    재 = bpy.data.materials.new('실땀')
    재.use_nodes = True
    bs = 재.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*s리니어(색['Stitch']), 1.0)
    bs.inputs['Roughness'].default_value = 0.86
    if 'Specular IOR Level' in bs.inputs:
        bs.inputs['Specular IOR Level'].default_value = 0.06
    굵기 = 몸폭 * 굵기몫 * 0.5
    길이 = 몸폭 * 길이몫
    땀들 = []
    for k in range(땀수):
        t = 2 * math.pi * k / 땀수
        내림 = 깊이 * ((1.0 - math.cos(물결산 * t)) * 0.5)   # 밑단 링이라 감쇠 1.0
        # 🔴 08-26: 안쪽으로 넣었더니 털(0.075)보다 안쪽이라 통째로 묻혔다 — 실땀이 0px 로 보였다.
        #   기운 자국은 «털 위에 얹힌» 것이라야 읽힌다.
        r = r밑 + 털길이 + 몸폭 * 바깥몫 * 0.5
        z = z밑 - 내림 + 세로 * 띄움몫
        bpy.ops.mesh.primitive_cylinder_add(radius=굵기, depth=길이, vertices=6)
        땀 = bpy.context.object
        땀.name = f'실땀_{k:02d}'
        땀.location = (r * math.cos(t), r * math.sin(t), z)
        # 원주 접선 방향으로 눕힌다 — 밑단을 «따라» 도는 땀
        땀.rotation_euler = (math.pi / 2, 0.0, t)
        땀.data.materials.append(재)
        for pp in 땀.data.polygons:
            pp.use_smooth = True
        땀들.append(땀)
    return 땀들

# ── ⑤ 굽기 ───────────────────────────────────────────────────────────────────
def 굽기():
    판갈이()
    os.makedirs(os.path.dirname(출력), exist_ok=True)
    맵 = 털맵(os.path.join(os.path.dirname(출력), '털밀도.png'), 해상도)
    패치 = _인자.get('펠트') or os.path.join(REPO, 'docs', '캐릭터', '펠트패치_0815', 'Coral.png')
    펠트, 법 = (펠트타일(패치) if os.path.exists(패치) else (None, None))
    if 펠트 is None:
        print('⚠ 펠트 패치를 못 찾았다 — 단색으로 굽는다:', 패치)
    몸 = 몽글몸()
    껍질 = 셸입히기(몸, 맵, 겹수, 털길이, 색['Coral'], 펠트=펠트, 법=법)
    구슬눈()
    밑단실땀(몸)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=출력,
        export_format='GLB',
        export_apply=True,
        export_yup=True,
        export_materials='EXPORT',
        export_image_format='AUTO',
    )
    총정점 = sum(len(o.data.vertices) for o in bpy.data.objects if o.type == 'MESH')
    print(f'[캐릭터3D] {출력}  {os.path.getsize(출력)//1024}KB · 겹 {겹수} · 정점 {총정점:,} · 오브젝트 {len(bpy.data.objects)}')
    return [c for _, c in 껍질]



# ── ⑥ GLB 후처리 — alphaMode 를 MASK 로 못 박는다 ────────────────────────────
def GLB알파고치기(경로, 컷오프들):
    """blender 4.2 부터 재질의 CLIP 블렌드가 없어져 exporter 가 **BLEND** 를 쓴다(실측 08-26).

    BLEND 는 그리는 «순서»를 타므로 360° 로 돌리면 겹이 서로를 지운다 — 털이 깜빡인다.
    ⇒ GLB 의 JSON 청크를 열어 털 겹 재질만 `MASK` + `alphaCutoff` 로 바꾼다.
      🔑 이 한 자리가 「털이 360° 로 버티는가」를 가른다. 몸·눈은 OPAQUE 그대로 둔다.
    ⚠ 청크는 4바이트 정렬이다 — JSON 은 공백(0x20), BIN 은 0x00 으로 채운다.
      길이 셋(파일 전체·JSON 청크·BIN 청크)을 다 고쳐야 한다(하나만 틀려도 로더가 거절한다).
    """
    import json
    import struct

    raw = open(경로, 'rb').read()
    if raw[:4] != b'glTF':
        raise SystemExit('GLB 가 아니다: ' + 경로)
    off, js, binc = 12, None, b''
    while off < len(raw):
        ln, ty = struct.unpack_from('<II', raw, off)
        off += 8
        if ty == 0x4E4F534A:
            js = json.loads(raw[off:off + ln].decode('utf-8'))
        elif ty == 0x004E4942:
            binc = raw[off:off + ln]
        off += ln

    고침 = 0
    for m in js.get('materials', []):
        이름 = m.get('name', '')
        if not 이름.startswith('털_'):
            continue
        i = int(이름.split('_')[1])
        m['alphaMode'] = 'MASK'
        m['alphaCutoff'] = round(컷오프들[i - 1], 4)
        m['doubleSided'] = True          # 털 겹은 안쪽에서도 보여야 실루엣이 안 뚫린다
        고침 += 1

    jb = json.dumps(js, separators=(',', ':')).encode('utf-8')
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    bb = binc + bytes((4 - len(binc) % 4) % 4)
    총 = 12 + 8 + len(jb) + (8 + len(bb) if bb else 0)
    out = bytearray()
    out += b'glTF' + struct.pack('<II', 2, 총)
    out += struct.pack('<II', len(jb), 0x4E4F534A) + jb
    if bb:
        out += struct.pack('<II', len(bb), 0x004E4942) + bb
    open(경로, 'wb').write(out)
    print(f'[캐릭터3D] alphaMode=MASK 로 고친 재질 {고침}개 · GLB {len(out)//1024}KB')
    return 고침


# ── ⑦ 미리보기 — EEVEE 로 360° 를 «네 각도»에서 본다 ─────────────────────────
def 미리보기(접두, 각도들=(0, 90, 180, 270), 너비=560):
    """🔑 셸은 헤어 파티클이 «아니라» 그냥 메시다 — 그래서 EEVEE 가 정상 속도로 돈다.
    (헤어 파티클에서 EEVEE Next 가 레거시보다 40배 느린 함정 #114752 을 원리적으로 비켜간다.)
    이 렌더 시간이 곧 «영화형을 EEVEE 로 굽는 비용»의 실측이다.
    """
    import time

    씬 = bpy.context.scene
    씬.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in         bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items else 'BLENDER_EEVEE'
    # 🔑 배경을 «투명»으로 굽는다 — world 는 환경광 전용이 되고, 무대 회색은 합성 때 깐다.
    #   안 그러면 환경광을 낮출 때 배경까지 어두워져 정본과 같은 조건에서 못 잰다(08-26).
    씬.render.film_transparent = _인자.get('투명배경', '1') != '0'
    # 🔴 08-26 실측 — **AgX 는 이 캐릭터의 색을 죽인다.** 몸 채도 0.29 (#C39991) 로 뭉개져
    #   「바랜 분홍」이 나왔다. Standard 는 0.88 (정본 펠트패치 0.90) 로 정본을 재현한다.
    #   요소굽기.py 는 AgX 를 쓰지만 그쪽 정본은 «렌더로 태어난» 색이고, 몽글이의 정본은
    #   **사진 픽셀**이다 — 사진을 톤매핑으로 다시 굽으면 그 픽셀이 아니게 된다.
    #   ⇒ 사진 텍스처를 쓰는 캐릭터는 Standard 로 간다(까몽·마린 세트 정합은 별도 판정 자리).
    씬.view_settings.view_transform = _인자.get('색관리', 'Standard')
    try:
        룩 = _인자.get('룩', 'None')
        if 룩 and 룩 != 'None':
            씬.view_settings.look = 룩
    except TypeError:
        pass
    씬.render.resolution_x = 너비
    씬.render.resolution_y = 너비
    씬.render.image_settings.color_mode = 'RGBA'
    씬.world = bpy.data.worlds.new('무대')
    씬.world.use_nodes = True
    # 🔴 흰 환경광이 코랄의 «채도»를 씻는다 — 사방에서 흰빛이 더해지면 G·B 가 올라가
    #   바랜 분홍이 된다(08-26 실측 3D 0.58 대 정본 0.64). 텍스처 자체는 정확했다
    #   (조명 없이 Emission 단독 렌더 #F66A5B 대 파일 #F6695A · 채도 0.90).
    #   ⇒ 세기를 낮추고, 색도 «양모가 서로 반사한 빛»에 가깝게 코랄로 물들인다.
    #   ⚠ world 는 «배경»과 «환경광»을 겸한다 — 색을 코랄로 물들이면 무대까지 빨개진다(08-26).
    #     그래서 색은 정본 사진과 같은 «회색 무대»로 두고 **세기만** 낮춘다.
    무대 = (0.588, 0.588, 0.588)     # 정본 누끼가 놓인 회색과 같은 값
    씬.world.node_tree.nodes['Background'].inputs['Color'].default_value = (*s리니어(무대), 1.0)
    씬.world.node_tree.nodes['Background'].inputs['Strength'].default_value = float(_인자.get('환경광', '0.30'))

    # 조명 총량이 곧 «채도»다 — 어두우면 회색으로 죽고, 과하면 흰빛으로 바랜다.
    #   정본 몸 평균 #D96355(채도 0.64)에 맞춰 배수를 잰다.
    빛배 = float(_인자.get('빛', '1.15'))   # 08-26 실측: 정본 #D96355 채도 0.64 밝기 134 에 맞춘 값(3D #DE6254 · 0.68 · 135)
    for 이름, 위치, 힘 in (('키', (2.6, -3.4, 2.9), 250 * 빛배), ('필', (-3.2, -1.8, 1.1), 88 * 빛배),
                          ('림', (0.4, 3.6, 2.4), 135 * 빛배)):
        d = bpy.data.lights.new(이름, 'AREA')
        d.energy = 힘
        d.size = 3.4
        o = bpy.data.objects.new(이름, d)
        o.location = 위치
        o.rotation_euler = (math.atan2(math.hypot(위치[0], 위치[1]), 위치[2]),
                            0, math.atan2(위치[1], 위치[0]) + math.pi / 2)
        bpy.context.collection.objects.link(o)

    cam_d = bpy.data.cameras.new('카메라')
    cam_d.lens = 85
    cam = bpy.data.objects.new('카메라', cam_d)
    bpy.context.collection.objects.link(cam)
    씬.camera = cam

    # 🔴 몸 크기에 맞춰 카메라를 «자동»으로 뺀다. 고정 거리면 물결·털을 키울 때마다 밑단이
    #   프레임 밖으로 잘려 「깊이를 키워도 안 변한다」는 오독이 난다(08-26 실측 그 자리).
    쟤 = [o for o in bpy.data.objects if o.type == 'MESH']
    zs = [(o.matrix_world @ v.co) for o in 쟤 for v in o.data.vertices]
    zmin = min(p.z for p in zs); zmax = max(p.z for p in zs)
    rmax = max(math.hypot(p.x, p.y) for p in zs)
    중심z = (zmin + zmax) * 0.5
    반높 = (zmax - zmin) * 0.5
    여백 = float(_인자.get('여백', '1.16'))
    필요 = max(반높, rmax) * 여백
    #   ⚠ `angle_y` 는 **이미 라디안**이다 — `math.radians()` 를 한 번 더 씌우면 안 된다.
    거리 = 필요 / math.tan(cam_d.angle_y * 0.5)
    피벗 = bpy.data.objects.new('피벗', None)
    bpy.context.collection.objects.link(피벗)
    피벗.location = (0, 0, 중심z)
    cam.parent = 피벗
    기울 = math.radians(float(_인자.get('카메라피치', '86')))
    cam.location = (0, -거리 * math.sin(기울), 거리 * math.cos(기울))
    cam.rotation_euler = (기울, 0, 0)

    잰값 = []
    for a in 각도들:
        피벗.rotation_euler = (0, 0, math.radians(a))
        씬.render.filepath = f'{접두}_{a:03d}.png'
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        잰값.append((a, time.time() - t0))
    for a, 초 in 잰값:
        print(f'[캐릭터3D] 미리보기 {a:3d}° · {초:.1f}초')
    print(f'[캐릭터3D] 한 장 평균 {sum(s for _, s in 잰값)/len(잰값):.1f}초 '
          f'({너비}px · EEVEE) — 60fps 10초(600장) 환산 {sum(s for _, s in 잰값)/len(잰값)*600/60:.0f}분')
    return 잰값

컷오프들 = 굽기()
GLB알파고치기(출력, 컷오프들)
if _인자.get('미리보기'):
    미리보기(_인자['미리보기'])
print('[캐릭터3D] 겹 컷오프:', ' '.join(f'{c:.3f}' for c in 컷오프들))

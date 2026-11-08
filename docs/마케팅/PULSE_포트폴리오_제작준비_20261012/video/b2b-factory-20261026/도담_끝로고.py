# 10번 도담중공업 끝 로고 CG(2026-11-08, Claude) — 유호님 「마지막 엔딩장면에 도담중공업 로고 있으면 그거로 엔딩장면 cg로 추가해서 마무리해줘」.
# 37번 판(송전탑이 비켜 나가고 도시 불이 켜짐)을 앞부터 끝까지 통째로 살리고, 그 위에 직접 그린 로고(도담_로고.py)를 켠다:
#   「어디서든 잘 돌아갑니다」(57.92초에 끝)가 끝나자마자 곡의 마지막 화음(58.0초 — 끝에서 가장 센 소리)에 표식 + 이름 묶음이 스위치를 올리듯 한 번에 켜지고(4장, 낮은 쿵 + 쇠 딸깍 — 26번 시동 레버와 같은 소리),
#   탑이 빠져나가고 불이 켜지는 동안 2.7초 그대로 있다가 판 끝 무렵 0.5초에 걸쳐 어두워진다. 첫 판은 58.71초의 작은 음에 켰는데 가장 센 소리가 로고보다 0.7초 앞에 있었다(11-08 Fable).
# 로고는 흰 단색 · 도형 그대로 · 움직임 없음(슬롭 점검표 22번 「묶음 하나, 한 방에 함께 켠다」). 움직이는 것은 판뿐이다.
# 판(1345~1465장) 안에서 어두워진다 — 판 뒤를 정지 그림으로 잇고 왼쪽 아래 전깃줄만 합성으로 마저 내보낸 판은 도로 불빛까지 딸려 겹쳤다(11-09 Fable).
#   그래서 로고는 2.7초 그대로 있다가 판 마지막 장 무렵 어둠으로 빠지고, 판 뒤 네 장(거의 검정)만 마지막 장을 잇는다.
# 앞 시험은 다 버렸다(02_콘티 24절): 터빈 날개 원이 돌다 고리가 되는 판(「3D 프리셋 · 로딩 링」 · 노을 앞 동전, Fable 「못 씀」), 노을을 어둡게 죽였다 다시 켜는 판(「템플릿 플래시 전환」),
#   고리만 먼저 도는 판(「로딩 아이콘」 — 40도만 돌아도 같다), 표식이 비키며 이름이 밀려 나오는 판(원본의 움직임이지만 아르곤 · Gemini 따로 「무료 템플릿 로고 프리셋」).
import numpy as np

import 도담_로고 as L

FPS, W, H = 24, 1920, 1080
CX, CY = W / 2, H * 0.43     # 로고 자리 — 원본 끝 화면처럼 하늘 가운데, 아래 구름 띠(y 520~560) 위
NAME_H = 100                 # 이름 글자 높이(px) — 묶음 폭 약 37%(원본 끝 화면과 같은 몫)
COLOR = 248.0

# 시각 — 영화 장 번호(24장/초). 자막 「어디서든 잘 돌아갑니다」는 58.02초에 진다(최종소리.py — 로고와 겹치지 않게 끝 줄만 앞당김)
ON_F = 1389                  # 켜지기 시작
LOCK_F = 1392                # 다 켜짐 — 곡의 마지막 화음이 들어오는 장(58.00~58.02초)
HOLD_END_F = 1456            # 64장(2.7초) 그대로 있은 뒤 — 판 마지막 장(1465)에서 7% 밝기, 그 뒤 두 장은 2% · 0%
FADE_LEN = 12                # 12장(0.5초)에 걸쳐 어두워짐
END_F = HOLD_END_F + FADE_LEN + 2   # 영화 끝 장(까만 장 둘)
LOCK_T = LOCK_F / FPS

TAKE_DOWN = (1380, 1410, 0.13)   # 흰 글자가 서도록 노을을 아주 천천히 13% 내린다(눈에 띄면 안 된다 — 어둡게 죽였다 켜는 시험은 「템플릿 플래시」였다)

PLATE_N = 121                # 37번 판 전체 장 수


def ease_io(x):
    x = min(1.0, max(0.0, x))
    return 3 * x * x - 2 * x * x * x


def logo_alpha():
    """표식 + 이름 묶음의 불투명도(H×W, 0~1) — 픽셀 자리에 맞춰 놓아 흐려지지 않게"""
    mark, name, gap = L.render(NAME_H)
    m, n = mark[..., 3].astype(np.float32) / 255.0, name[..., 3].astype(np.float32) / 255.0
    x = int(round(CX - (m.shape[1] + gap + n.shape[1]) / 2))
    a = np.zeros((H, W), np.float32)
    y = int(round(CY - m.shape[0] / 2))
    a[y:y + m.shape[0], x:x + m.shape[1]] = m
    nx, ny = int(round(x + m.shape[1] + gap)), int(round(CY - n.shape[0] / 2))
    a[ny:ny + n.shape[0], nx:nx + n.shape[1]] = np.maximum(a[ny:ny + n.shape[0], nx:nx + n.shape[1]], n)
    return a


def compose(base, f, logo):
    """base(RGB, uint8 또는 float) 위에 영화 장 f의 로고 · 내림 · 끝 어두워짐을 얹는다 — uint8로 돌려준다"""
    a0, a1, amt = TAKE_DOWN
    img = base.astype(np.float32) * (1 - amt * ease_io((f - a0) / (a1 - a0)))
    k = ease_io((f - ON_F + 1) / (LOCK_F - ON_F + 1))
    if k > 0:
        a = (logo * k)[..., None]
        img = img * (1 - a) + COLOR * a
    if f >= HOLD_END_F:
        img = img * (1 - ease_io((f - HOLD_END_F + 1) / FADE_LEN))
    return np.clip(img + 0.5, 0, 255).astype(np.uint8)


def frames(plate, first_f, count):
    """37번 컷 전체 — plate는 판 전체 장(uint8), first_f는 컷 첫 장의 영화 장 번호"""
    logo = logo_alpha()
    for i in range(count):
        base = plate[min(i, PLATE_N - 1)]     # 판 뒤 장은 이미 거의 검정이라 마지막 장을 그대로 쓴다
        yield compose(base, first_f + i, logo)

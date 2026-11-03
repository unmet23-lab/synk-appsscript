# B24 본편의 1인칭 판 — V1(초록 화면) + 실제 ChatGPT 요금 화면(화면/*.png, 2026-11-03 깨끗한 프로필 · 원화). 표시(동그라미 · 형광)는 화면 안에 구워 휴대폰과 같이 움직인다.
# 시험관들이 작은 표 글자(Codex · Sites 같은 낱말)를 짚어 핵심 줄 밖은 어둡게 눌렀다 — 값 · 글은 그대로다.
import sys, cv2, numpy as np
sys.path.insert(0, '합성')
from 판굽기 import 굽기, 읽기


def 어둡게(im, y0, y1, 위까지=True, k=0.42):
    out = im.astype(np.float32).copy()
    if 위까지: out[:y0] *= k
    out[y1:] *= k
    return out.astype(np.uint8)


def 형광(im, y0, y1, p, 색=(10, 214, 255), 세기=0.34):
    out = im.copy(); w = int(im.shape[1] * p)
    if w <= 0: return out
    칸 = out[y0:y1, 0:w].astype(np.float32)
    out[y0:y1, 0:w] = np.clip(칸 * (1 - 세기) + np.array(색, np.float32) * 세기, 0, 255).astype(np.uint8)
    return out


# 실제 화면을 손가락으로 벌린 만큼
플러스 = 어둡게(읽기('화면/챗GPT_Plus.png')[192:192 + 2237, 40:40 + 1032], 690, 1300, k=0.28)   # 1.25배 · 「Plus 사용하기」가 엄지 바로 위
파일 = 읽기('화면/챗GPT_표_파일.png')[283:283 + 2071, 90:90 + 955]   # 1.35배 · 「파일 업로드 · 제한적」 줄이 위에서 33%
무료 = 읽기('화면/챗GPT_Free목록.png')[192:192 + 1645, 60:60 + 759]  # 1.7배 · 위에 ₩0, 그 아래 「GPT-6와 무제한 텍스트 대화」
파일어둠 = 어둡게(파일, 683 - 58, 683 + 58, k=0.22)
무료어둠 = 어둡게(무료, 531 - 46, 531 + 46, 위까지=False, k=0.3)
펜 = cv2.imdecode(np.fromfile('remotion/public/img/pen_oval.png', np.uint8), cv2.IMREAD_UNCHANGED)
펜 = cv2.resize(펜, (500, 176), interpolation=cv2.INTER_AREA)  # ₩29,000을 둘러 그리는 빨간 동그라미 — 사실 검수: 취소선은 「값이 틀렸다 · 할인됐다」로 읽힐 수 있어 동그라미로
펜x, 펜y = 2, 1026 - 88
_yy, _xx = np.mgrid[0:펜.shape[0], 0:펜.shape[1]].astype(np.float32)
_각 = (np.degrees(np.arctan2((_yy - 88) * 2.8, _xx - 250)) - 60) % 360 / 360  # 오른쪽 아래(펜이 겹치는 자리)에서 시작해 한 바퀴


def 동그라미(p):
    im = 플러스.copy()
    if p <= 0: return im
    칸 = im[펜y:펜y + 펜.shape[0], 펜x:펜x + 펜.shape[1]].astype(np.float32)
    a = (펜[..., 3:4].astype(np.float32) / 255) * (_각[..., None] <= p)
    im[펜y:펜y + 펜.shape[0], 펜x:펜x + 펜.shape[1]] = (펜[..., :3] * a + 칸 * (1 - a)).astype(np.uint8)
    return im


다그림 = 동그라미(1.0)
넓게 = lambda t: (1.12, 522, 985)
가까이 = lambda t: (1.22 + 0.006 * t, 522, 830)
쉼 = [(8.7, 9.9), (9.9, 8.7), (8.7, 9.9)]
이름들 = sys.argv[1:]


def 고르기(이름):
    return not 이름들 or 이름 in 이름들


if 고르기('pov_A'): 굽기('pov_A', [(1.10, 3.20)], lambda t: 플러스, 줌=넓게)
# 「어제 뭐 물어봤어?」 「…오늘 점심 뭐 먹지.」 — 실제 ChatGPT 임시 채팅(2026-11-03)
대화 = 읽기('화면/챗GPT_점심.png')[60:60 + 2542, 60:60 + 1173]
if 고르기('pov_chat'): 굽기('pov_chat', [(8.7, 9.9), (9.9, 8.8)], lambda t: 대화, 줌=lambda t: (1.22 + 0.012 * t, 522, 800))
# 「어… 가끔?」 「가끔이면 됐고.」 — 파일 줄
if 고르기('pov_file'): 굽기('pov_file', [(8.7, 9.9), (9.9, 9.3)], lambda t: 형광(파일어둠, 683 - 58, 683 + 58, min(max((t - 0.15) / 0.3, 0), 1)), 줌=가까이)
# 「챗GPT는 글로 묻는 건, 무료도 무제한이야.」 — ₩0 · 무제한 줄(초록)
if 고르기('pov_free'): 굽기('pov_free', 쉼, lambda t: 형광(무료어둠, 531 - 46, 531 + 46, min(max((t - 0.55) / 0.4, 0), 1), 색=(94, 197, 34), 세기=0.4), 줌=가까이)


# 19.6~ : ₩29,000에 빨간 동그라미(0.2초 뒤부터 0.4초 동안)
def 다가감(t):
    return (1.45 + 0.03 * t, 460, 1095)


if 고르기('pov_strike'): 굽기('pov_strike', [(8.7, 9.9), (9.9, 9.3)], lambda t: 동그라미(min(max((t - 0.2) / 0.4, 0), 1)), 줌=다가감)
# 끝: 그래도 엄지가 다시 올라옴(V1 0.55~) → 손바닥 탁(V1 2.56초)
if 고르기('pov_end'): 굽기('pov_end', [(0.55, 2.70)], lambda t: 다그림, 줌=넓게)

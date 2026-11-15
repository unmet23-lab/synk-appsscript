# 최종본 검사 — 다 만든 영상 한 편에서 컷 전수 검수가 되풀이해 잡던 것을 기계로 잰다(2026-11-13, 유호님 「실수한것들이나 검수에서 지적받은부분들 다음에 참고해서
# 더 효율적으로 제작할수있게 어느정도 반영되고있어 ?」 → 「응, 고쳐」).
#
# 왜 있나: 「사람이 굳음」(점검표 26) · 「같은 판을 배율만 바꿔 이어 붙임 · 같은 장면 두 번」(50) · 「끝 3초가 약함」(2) · 「낮은 화소를 크게」(48)가 B38 v10 →
#   B39 v10 → B39 v16 → 메일비서 v12까지 편마다 마지막 컷 전수 검수에서야 잡혔다. 그 검사들(사람움직임.py · 컷연속성검사의 「같은판」)은 받은 판이나 컷표(틀 2)를
#   보는데, SNS 두 브랜드 편은 옛 컷표이거나 컷표가 없고 편집에서 판을 잘라 키운 것은 컷표에 안 나온다. 그래서 최종 영상 하나만 보고 잰다 —
#   올리기 전 검사 ⑳이 부르고(재연 · 진행자 편), 혼자 불러도 된다.
#
#   python -I -X utf8 tools/최종본검사.py <최종.mp4> [--json] [--항목 굳음,같은판,되풀이,끝,화소,조용[,흐름]] [--컷초 3.9,5.87,…]
#   「흐름」은 기본 항목이 아니다. 영상 마감 관문(tools/영상관문판.py)이 붙여 부른다. 맞춘 자료가 애니 공모전 한 편뿐이라 SNS 올리기 전 검사에는 아직 넣지 않았다.
#
# 잰 것(결과 「걸림」의 항목 이름 — 올리기 전 검사가 이 이름으로 등급을 매긴다):
#   굳음      컷마다 사람움직임.py(카메라를 걷어 낸 사람 자리 움직임, 480×270 장당 px)의 「사람」 값 — 0.12 아래(점검표 26 문턱)이고 사람 자리를
#             얼굴 · 실루엣으로 잡은 컷. 0.8초 아래 컷은 재지 않는다. 얼굴 극접사(「가까움」)는 값이 미덥지 않아 알림으로만
#   구간굳음  3초 넘는 컷 안에서 1.5초 창(0.5초씩)이 잇달아 0.12 아래인 자리 — 컷 전체 값은 넘어도 뒤 절반이 멎은 꼴(B39 v10 54.4~57.0)
#   같은판    이웃한 두 컷의 경계 장이 한 그림의 배율 · 자리만 바꾼 것(닮음 변환이 화면 넓게 맞음 · 배율 6% 넘게 다르거나 25px 넘게 옮김) — 같은 판을 잘라 붙임
#   같은구도  이웃한 두 컷이 배율 · 자리까지 같은 그림(점프 컷)
#   되풀이    이웃하지 않은 두 컷의 가운데 장이 같은 그림(배율이 달라도) — 「똑같은 장면이 반복」(11-12 서울로) · 같은 판 두 번(B39 21.4초 = 54.4초)
#   끝소리    끝에서 2초 넘게 0.25초 칸마다 몸통 소리 가운데보다 10dB 넘게 작다 — 끝에 소리 한 방 없이 방 소리만 남는다(점검표 2 · B39 v10 −43dB)
#   끝화소    끝 3초에 걸린 컷의 가는 결 비(가는 결 / 중간 결 에너지)가 0.125 아래 — 720p 판을 화면에서 또 잘라 키운 흐린 끝(점검표 48 · 2,
#             B39 v10 57~58.5초 0.107). 끝 밖의 컷은 값만 「알림」에 적는다(어두운 판 · 얕은 심도와 아직 가르지 못한다)
#   조용구간  가운데(앞 0.5초 · 끝 3초 뺌) 1초 창 소리가 이 편의 큰 소리(몸통 0.25초 칸의 위 10%)보다 10dB 넘게 작은 채 10초 넘게 이어진다 —
#             말 · 사건 소리 없이 작은 소리만 깔린 긴 구간(최종 확인 갈래 「소리」, 흠 장부 설계 3단계 · 11-15). 끝 코드를 바꾸지 않는 걸림이다(SOFT).
#             맞춘 자료(두 브랜드 최종본 45개 · 만족 사례 영상 6개 실측, 걸림 1/51): 걸리는 것 synkbrief 무료체험 28.0~40.75초 12.75초(큰 소리 −11.4dB ·
#             평균 −25.5dB), 지나가는 것 가운데 가장 긴 자리 영상통화연인 8.0초(최종 확인 통과 · 만족 사례 S52) · 없는판결 7.5초 · 질문다섯개 6.5초 · 나머지 5초 아래.
#             10dB를 8 · 12dB로 바꿔도 무료체험만 걸린다(13.25초 · 10.5초).
#             짧고 깊은 빈 소리(필라테스예약 14.0~16.25초 −37~−38dB)는 재지 않는다 — 통과한 영상통화연인 14.5~17.75초가 더 깊고 길어(−37~−40dB) 가를 문턱이 없다
#   흐름(11-16, 컷 안의 탈것과 배경 움직임 — 셋 다 끝 코드를 바꾸지 않는 「확인」이다)
#             왜: 11-15 서울로 「다리가 기억하는 것」 시험에서 카본 영상 심사와 Fable 마감 관문이 유호님이 짚으신 움직임 흠을 하나도 못 봤다. 카본은 1초에 한 장쯤,
#             Fable은 8장 띠로 보기 때문이다(docs/마케팅/PULSE_AI모델_캐스팅_20260930/검수방식_시험_완성영상_카본과Fable_20261115.md). 그래서 기계가 잰다.
#             어떻게: 컷마다 특징점을 긴 변 1000으로 이어 추적한다(Lucas-Kanade, 앞뒤로 추적해 0.3px 넘게 어긋난 점은 버림). 장마다 닮음 변환으로 카메라 움직임을
#             맞추고 그 나머지를 그 점의 움직임으로 본다. 0.5초 넘게 이어진 점의 평균 가로 속도가 초당 2px(화면 너비 1000 기준) 넘으면 「움직이는 점」이다.
#             화면을 띠 셋(위 · 가운데 · 아래) × 왼쪽 · 오른쪽 여섯 칸으로 나누고, 움직이는 점이 25개 넘고 그 85% 넘게 한 방향이면 그 칸의 방향으로 친다.
#             컷은 장 차이로 찾은 경계에 --컷초(관문은 컷표 경계를 준다)를 더해 나눈다 — 천 닦기 같은 전환은 장 차이로 못 찾는다.
#             카메라 배율이 초당 2% 넘게 바뀌는 컷(앞으로 가는 카메라 · 확대)은 ①②를 재지 않는다. 움직이는 점이 가로와 세로로 함께 퍼지거나 모이는 컷
#             (다가오는 차)은 ①을 재지 않는다. 두 퍼짐이 모두 초당 1%를 넘으면 ②도 재지 않는다(바닥 없이 쓰면 퍼짐이 0에 가까운 서울로 라f E03k도
#             부호만 같아 빠졌고, ②에서 아예 빼면 다가오는 버스 지금 판 Q04가 걸렸다).
#   흐름갈림  ① 같은 띠의 왼쪽 칸과 오른쪽 칸이 반대 방향으로 가고, 둘 다 초당 2.5px 넘고, 두 칸의 점이 옆으로 간다(세로 / 가로 속도의 가운데 값 0.5 아래 —
#             카메라 위로 지나가는 버스는 1.4~1.8이라 빠진다) — 같은 길의 차가 서로 반대로 가거나 한쪽이 뒤로 밀린다
#             (서울로 11-14 판 C08 55.3~57.7초: 가운데 띠 왼쪽 −8.0, 오른쪽 +3.2. 고친 지금 판은 같은 방향이라 지나간다)
#   멈췄다감  ② 한 방향으로 가는 칸의 1/8초 속도가, 가다가 0.5초 넘게 멈춘 뒤 다시 간다(간다 = 그 칸 속도 위 20% 값의 40% 넘음, 멈춤 = 속도의 크기가
#             초당 1.5px 아래 — 뒤로 가는 창(차단벽을 밀며 몸을 흔드는 서울로 S04y)과 느려진 창(실이 풀리는 지금 판 E04m 0.6~3.5)은 멈춤이 아니다)
#             (서울로 11-14 판 E03k 147.8~151.7초: 위 띠 오른쪽 금빛 버스가 1초 서 있다가 다시 감. 서 있다가 처음 출발하거나 가다가 끝에 서는 컷은 걸지 않는다.
#             「감」은 1/8초 창 둘 넘게 잇달아야 한다 — 탈것이 화면 밖으로 나간 뒤 남은 점 몇 개가 한 창씩 튀는 값(서울로 Y15w)을 치지 않으려고.
#             사람도 걸린다: 같은 판 S06k는 사진 찍는 아이가 0.9초 굳었다가 다시 움직인다 — 11-15 카본이 짚은 굳음과 같은 자리)
#   제자리바퀴 ③ 한 열에서 위와 아래의 가로 흐름이 반대로 초당 20px 넘고 한 줄에서 왼쪽과 오른쪽의 세로 흐름도 반대다(도는 것). 그런데 도는 자리와
#             그 옆 한 열을 뺀 나머지 칸 흐름의 90번째 값이 초당 10px 아래다 — 바퀴만 돌고 탈것도 배경도 안 간다(긴 변 480 조밀 흐름, 4 × 8칸)
#             (서울로 라f 판 Q06 16.6~18.1초 파란 버스 바퀴: 나머지 칸 흐름 90번째 값 0.2px/s. 11-14 노란 택시 판은 배경이 초당 240px 넘게 흘러 지나간다)
#             맞춘 자료와 헛걸림 수는 tests/최종본검사.test.js 머리에 있다.
# 글자 판 · 표시가 컷을 넘어 그대로 남는 자리는 맞춤에서 뺀다 — 맞은 점이 화면 위아래로 네 줄(80px 칸) 넘게 퍼져야 그림으로 본다(자막 두 줄은 한두 줄).
#
# 끝 코드: 0 걸림 없음(조용구간만 걸려도 0) / 1 걸림 있음 / 2 잴 수 없음(파일 · ffmpeg). 판정(고칠 것 · 확인할 것)은 올리기 전 검사가 한다 — 이 도구는 잰 값과 자리만 낸다.
#   조용구간이 끝 코드를 바꾸지 않는 까닭: 혼자 부르는 편집 스크립트 · 세션이 끝 코드 1을 「고칠 것」으로 읽어 멈추지 않게(새 항목은 어디서나 확인할 것이다).
# 맞춘 자료(11-13): B39 「없는 판결」 v10(컷 전수 검수 표 — 같은판 4.4→5.5→7.4 · 9.7→11.0 · 54.4→57.0→58.5, 되풀이 21.4=54.4,
#   굳음 4.4~5.5 · 21.4~23.4 · 54.4~57.0, 끝 3초 방 소리 −44dB, 끝 근접 2.55배). 시험: node --test tests/최종본검사.test.js
import argparse
import importlib.util
import json
import math
import os
import subprocess
import sys

import cv2

cv2.setNumThreads(4)   # 올리기 전 검사가 여러 편을 함께 돌려도 PC를 다 잡지 않게
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MOTION_PY = os.environ.get("SYNK_MOTION_PY") or os.path.join(HERE, "..", "docs", "마케팅", "PULSE_포트폴리오_제작준비_20261012", "시댄스무제한", "사람움직임.py")
FPS = 24.0             # 모든 장을 24fps로 풀어 잰다 — 사람움직임 0.12 문턱을 맞춘 판이 24fps이고(30fps 편은 같은 움직임이 0.8배로 나온다),
                       # 가변 프레임 편도 장 번호 = 초 × 24가 된다(11-13 Fable 검수 3 · 4)
CHUNK = 240            # 사람 움직임은 컷을 10초(240장)씩 끊어 잰다 — 한 판 긴 편도 메모리가 컷 길이에 비례해 불지 않게(Fable 검수 8)
FROZEN = 0.12          # 사람움직임.py와 같은 문턱(점검표 26)
MIN_CUT = 0.8          # 이보다 짧은 컷은 굳음을 재지 않는다
WIN, WIN_STEP, WIN_LONG = 1.5, 0.5, 3.0
SCALE_STEP = 0.06      # 같은판: 배율이 이만큼 넘게 다르면 「배율 바꿈」
SHIFT_PX = 25          # 같은판: 긴 변 640 기준 이만큼 넘게 옮기면 「자리 옮김」
MIN_INLIERS = 25
CUT_AREA = 0.3         # 컷으로 볼 바뀐 화면 몫(회색 25 넘게 바뀐 화소)
MIN_ROWS = 4           # 맞은 점이 80px 칸 줄 몇 줄에 퍼져야 그림으로 보나(글자 판은 한두 줄)
REPEAT_INLIERS = 40
END_SEC = 3.0
END_QUIET_DB = 10.0
END_QUIET_SEC = 2.0     # 끝에서 이만큼 넘게 조용하면 「끝 소리 한 방 없음」
DETAIL_FLAG = 0.125    # 이 아래면 잘라 키운 판으로 본다(끝 3초만 걸림 — 그 밖은 알림)
DETAIL_MIN = 5.0
QUIET_REF_PCT = 90     # 조용구간: 몸통 0.25초 칸의 위 10%를 「큰 소리」 기준으로(가운데 값은 긴 조용함 자체에 끌려 내려간다 — 무료체험 가운데 −25.9dB)
QUIET_DB = 10.0        # 1초 창 소리가 기준보다 이만큼 넘게 작으면 조용한 칸
QUIET_SEC = 10.0       # 조용한 칸이 이만큼 넘게 이어지면 걸림
SOFT = {"조용구간", "흐름갈림", "멈췄다감", "제자리바퀴"}     # 끝 코드를 바꾸지 않는 걸림 — 검사이력에도 등급 「확인」으로 남는다
DEFAULT_ITEMS = "굳음,같은판,되풀이,끝,화소,조용"
# 흐름(컷 안 탈것 · 배경 움직임) — 값은 모두 「화면 너비 1000 기준 px/s」다
FLOW_LONG = 1000       # 특징점 추적은 긴 변 1000으로 푼다
FLOW_EDGE = 2          # 컷 앞뒤 2장(경계 · 전환)은 뺀다
FLOW_MIN_SEC = 0.75    # 앞뒤를 뺀 컷이 이보다 짧으면 재지 않는다
FLOW_SEED = 6          # 0.25초마다 빈 자리에 새 점을 뿌린다
FLOW_FB = 0.3          # 앞뒤로 추적해 이만큼(px) 넘게 어긋난 점은 버린다
TRACK_MIN = 12         # 0.5초 넘게 이어진 점만 센다
MOVE_MIN = 2.0         # 카메라를 걷어 낸 가로 속도가 이만큼 넘으면 움직이는 점
CELL_MIN = 25          # 칸에 움직이는 점이 이만큼 있어야 칸의 방향을 낸다
AGREE = 0.85           # 칸 안 움직이는 점의 이만큼이 한 방향이어야 그 칸의 방향이다(0.8이면 서울로 R03 와이퍼 0.82가 걸린다)
SPLIT_MIN = 2.5        # ① 엇갈린 두 칸이 모두 이만큼 넘게 간다
SIDEWAYS = 0.5         # ① 엇갈린 두 칸의 점이 옆으로 간다(세로 / 가로 속도의 가운데 값이 이 아래) — 카메라 위로 지나가는 버스(서울로 라f Q04 1.4~1.8)는 뺀다
ZOOM_MAX = 2.0         # 카메라 배율이 초당 이만큼(%) 넘게 바뀌는 컷은 ①②를 재지 않는다
STEP_WIN = 3           # ② 1/8초 창
STOP_RUN = 4           # ② 1/8초 창 넷(0.5초) 넘게 멈춘 뒤 다시 간다
GO_FRAC, STOP_FRAC = 0.4, 0.15
STOP_ABS = 1.5         # ② 멈춤은 1/8초 창의 가로 속도 크기가 이 아래(px/s) — 서울로 E03k · S06k의 멈춤은 0.0~0.2
ZOOM_SPREAD = 0.01     # ② 움직이는 점의 가로 · 세로 퍼짐이 둘 다 초당 1% 넘을 때만 확대로 본다(라f E03k 0.3%는 확대가 아니다, 다가오는 버스 Q04는 15% · 54%)
ROT_MIN = 20.0         # ③ 한 열 위아래 가로 흐름이 반대로 이만큼 넘으면 도는 것
BG_MAX = 10.0          # ③ 도는 자리 밖 칸 흐름의 90번째 값이 이 아래면 배경이 안 흐른다
DENSE_LONG = 480       # ③ 조밀 흐름은 긴 변 480으로
BANDS = ("위", "가운데", "아래")


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                        "-show_entries", "format=duration", "-of", "json", path], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr.strip() or "ffprobe 실패")
    j = json.loads(r.stdout)
    s = j["streams"][0]
    n, d = (int(x) for x in s["r_frame_rate"].split("/"))
    return int(s["width"]), int(s["height"]), n / d, float(j["format"]["duration"])


def fit_size(w, h, long_side):
    k = long_side / max(w, h)
    return max(2, int(round(w * k / 2)) * 2), max(2, int(round(h * k / 2)) * 2)


def decode(path, size, gray=True):
    w, h = size
    pix = "gray" if gray else "bgr24"
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", f"fps={FPS:g},scale={w}:{h}",
                          "-f", "rawvideo", "-pix_fmt", pix, "-"], capture_output=True).stdout
    c = 1 if gray else 3
    n = len(raw) // (w * h * c)
    a = np.frombuffer(raw[: n * w * h * c], np.uint8)
    return a.reshape(n, h, w) if gray else a.reshape(n, h, w, 3)


def pick(path, size, idxs):
    """필요한 장만 골라 푼다 — {장 번호: 회색 그림}. 한 번 흘려 읽으며 고른다.
    11-16까지는 select='eq(n,…)+…' 식 하나로 골랐는데, 컷이 쉰 개 남짓인 편(서울로 3분)은 식이 길어 ffmpeg가 아무것도 안 내
    같은판 · 되풀이가 KeyError로 못 쟀다(현장 노트 영상 「select=eq(n…)」 항목과 같은 함정)."""
    idxs = sorted(set(int(i) for i in idxs))
    if not idxs:
        return {}
    w, h = size
    want, last, out = set(idxs), idxs[-1], {}
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", f"fps={FPS:g},scale={w}:{h}",
                             "-f", "rawvideo", "-pix_fmt", "gray", "-"], stdout=subprocess.PIPE)
    try:
        k = 0
        while k <= last:
            raw = proc.stdout.read(w * h)
            if len(raw) < w * h:
                break
            if k in want:
                out[k] = np.frombuffer(raw, np.uint8).reshape(h, w)
            k += 1
    finally:
        proc.stdout.close()
        if proc.poll() is None:
            proc.kill()
        proc.wait()
    return out


# ── 컷 ──
def find_cuts(small, fps):
    """이웃 장 차이가 앞뒤 반 초의 가운데 값보다 크게 튀고 화면의 CUT_AREA 넘게 바뀐 장 — 새 컷의 첫 장 번호. 3장 안에 붙은 둘은 큰 쪽 하나"""
    f = small.astype(np.float32)
    dd = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
    half = max(6, int(round(fps / 2)))
    hits = []
    for i in range(len(dd)):
        nb = np.concatenate([dd[max(0, i - half):i], dd[i + 1:i + 1 + half]])
        med = float(np.median(nb)) if len(nb) else 0.0
        if dd[i] > 6 and dd[i] > 4 * max(med, 0.8):
            area = float((np.abs(f[i + 1] - f[i]) > 25).mean())
            if area >= CUT_AREA:                # 화면 캡처의 글자 · 스크롤처럼 한 자리만 바뀐 것은 컷이 아니다(y한도 0.05~0.28 · 실제 컷 0.32~0.84)
                hits.append((i + 1, float(dd[i])))
    cuts = []
    for k, v in hits:
        if k < 2 or k > len(f) - 2:
            continue
        if cuts and k - cuts[-1][0] <= 3:
            if v > cuts[-1][1]:
                cuts[-1] = (k, v)
            continue
        cuts.append((k, v))
    return [k for k, _ in cuts]


# ── 같은 그림 맞춤 ──
_ORB = None


def orb():
    global _ORB
    if _ORB is None:
        _ORB = cv2.ORB_create(3000, edgeThreshold=15, patchSize=15)
    return _ORB


def features(img):
    return orb().detectAndCompute(img, None)


def relation(fa, fb, shape, min_inliers=MIN_INLIERS, strict=False):
    """두 장을 잇는 닮음 변환 가운데 「그림」으로 볼 만한 것.
    글자 판 · 표시는 컷을 넘어 같은 자리에 남아 「배율 1 · 안 옮김」 맞춤을 한두 줄(80px 칸)에 모은다 — 그런 맞춤은 걷어 내고 남은 점으로 다시 맞춘다.
    배율 · 자리가 바뀐 맞춤은 글자 판이 만들 수 없으니 두 줄에 퍼지면 그림이다(사람 자리는 화면 가운데 두세 줄에 모인다 — B39 5.5초 · 57초).
    배율 · 자리가 그대로인 맞춤은 네 줄 넘게 퍼져야 그림이다. strict(되풀이 — 멀리 떨어진 두 컷)면 늘 네 줄을 요구한다."""
    (ka, da), (kb, db) = fa, fb
    if da is None or db is None or len(ka) < 20 or len(kb) < 20:
        return None
    bf = cv2.BFMatcher(cv2.NORM_HAMMING)
    m = [x for x in bf.knnMatch(da, db, k=2) if len(x) == 2 and x[0].distance < 0.75 * x[1].distance]
    if len(m) < min_inliers:
        return None
    pa = np.float32([ka[x[0].queryIdx].pt for x in m])
    pb = np.float32([kb[x[0].trainIdx].pt for x in m])
    h, w = shape
    unit = max(h, w) / 640                      # 길이 기준(긴 변 640)
    cell_h = 80 * unit
    centre = np.float32([[w / 2, h / 2]])
    keep = np.ones(len(m), bool)
    for _ in range(4):
        if keep.sum() < min_inliers:
            return None
        M, inl = cv2.estimateAffinePartial2D(pa[keep], pb[keep], method=cv2.RANSAC, ransacReprojThreshold=3.0 * unit, maxIters=4000, confidence=0.995)
        if M is None:
            return None
        inl = inl.ravel().astype(bool)
        idx = np.where(keep)[0][inl]
        if len(idx) < min_inliers:
            return None
        rows = {}
        for _x, y in pa[idx]:
            rows[int(y // cell_h)] = rows.get(int(y // cell_h), 0) + 1
        spread = sum(1 for v in rows.values() if v >= 3)
        s = float(math.hypot(M[0, 0], M[1, 0]))
        if not 0.4 <= s <= 2.5:                 # 찌그러진 맞춤(배율 0 · 수십 배) — 그림이 아니다
            keep[idx] = False
            continue
        moved = float(np.linalg.norm(cv2.transform(centre[None], M)[0, 0] - centre[0])) / unit   # 화면 가운데가 옮겨 간 거리(긴 변 640 기준 px)
        changed = abs(s - 1) > SCALE_STEP or moved > SHIFT_PX
        if (changed and spread >= 2 and not strict) or spread >= MIN_ROWS:
            return {"맞은점": int(len(idx)), "맞춤비": round(len(idx) / len(m), 2), "배율": round(s, 3), "옮김": round(moved, 1), "줄": spread}
        keep[idx] = False                       # 글자 판 맞춤 — 걷어 내고 남은 점으로 다시
    return None


def kind_of(rel):
    if not rel:
        return None
    if abs(rel["배율"] - 1) > SCALE_STEP or rel["옮김"] > SHIFT_PX:
        return "같은판"
    return "같은구도"


# ── 화소(잘라 키운 판) ──
def detail_ratio(gray):
    """가는 결(σ1 아래) 에너지 / 중간 결(σ1~3) 에너지 — 제 화소 판은 0.25~0.31(B39 · 메일비서 실측), 720p 판을 화면에서 또 잘라 키운 컷은 0.11 안팎.
    결이 거의 없는 어두운 판은 둘 다 작아 미덥지 않으니 중간 결이 DETAIL_MIN 아래면 None. 위 20%(글자 판)는 뺀다"""
    g = gray.astype(np.float32)
    g = g[int(g.shape[0] * 0.2):]
    b1 = cv2.GaussianBlur(g, (0, 0), 1.0)
    b3 = cv2.GaussianBlur(g, (0, 0), 3.0)
    mid = float(np.mean((b1 - b3) ** 2))
    if mid < DETAIL_MIN:
        return None
    return round(float(np.mean((g - b1) ** 2)) / mid, 3)


# ── 사람 움직임(사람움직임.py를 빌려 컷마다) ──
_MOTION = None


def motion_mod():
    global _MOTION
    if _MOTION is None:
        spec = importlib.util.spec_from_file_location("사람움직임", MOTION_PY)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _MOTION = mod
    return _MOTION


def _summarise(mod, a, b, fps, ps):
    s = mod.summary(ps)
    if not s:
        return None
    row = {"시작": round(a / fps, 2), "끝": round(b / fps, 2), "사람": s["사람"], "카메라": s["카메라"], "판정": s["판정"],
           "사람장": s["얼굴 장"] + s["실루엣 장"], "장": s["장"]}
    wins = []
    if (b - a) / fps >= WIN_LONG:
        n = int(round(WIN * fps))
        st = int(round(WIN_STEP * fps))
        for w0 in range(0, max(1, len(ps) - n + 1), st):
            part = ps[w0:w0 + n]
            ws = mod.summary(part)
            ppl = sum(1 for x in part if x[2] in ("얼굴", "실루엣"))
            if ws and ws["사람"] < FROZEN and ppl > len(part) / 2:
                wins.append(round((a + 2 + w0) / fps, 2))
    row["멎은창"] = wins
    return row


def measure_motion(path, fps, segs):
    """사람움직임.py와 같은 480×270 bgr 장을 한 번만 풀어(24fps) 컷마다 이웃 장 흐름을 잰다 — 컷 앞뒤 2장은 빼고, 긴 컷은 CHUNK장씩
    (끊는 자리의 장은 다음 덩이의 첫 장으로 다시 써서 이웃 쌍을 잃지 않는다)"""
    mod = motion_mod()
    W, H = mod.W, mod.H
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", f"fps={FPS:g},scale={W}:{H}",
                             "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    size = W * H * 3
    out, i = [], 0

    def pairs_of(buf):
        fr = np.array(buf)
        mod.frames = lambda *_args, _fr=fr: _fr          # pairs()가 이 덩이의 장만 보게
        return mod.pairs(None)

    try:
        for a, b in segs:
            ps, buf = [], []
            while i < b:
                raw = proc.stdout.read(size)
                if len(raw) < size:
                    break
                if a + 2 <= i < b - 2:
                    buf.append(np.frombuffer(raw, np.uint8).reshape(H, W, 3))
                    if len(buf) >= CHUNK:
                        ps += pairs_of(buf)
                        buf = [buf[-1]]
                i += 1
            if len(buf) >= 2:
                ps += pairs_of(buf)
            if (b - a) / fps < MIN_CUT or len(ps) < 5:
                continue
            row = _summarise(mod, a, b, fps, ps)
            if row:
                out.append(row)
    finally:
        proc.stdout.close()
        proc.wait()
    return out


# ── 소리 ──
def audio_rms(path, dur=None, rate=16000):
    """0.25초 칸마다 dBFS. 소리 줄기가 영상보다 짧으면 모자란 칸을 무음(−90dB)으로 채운다 — 소리가 먼저 끝난 끝도 「조용한 끝」이다(Fable 검수 5)"""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(rate), "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32)
    if not len(x):
        return None
    hop = rate // 4
    n = len(x) // hop
    rms = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    want = int(dur * 4) if dur else 0
    if want > len(db):
        db = np.concatenate([db, np.full(want - len(db), -90.0)])
    return db


# ── 흐름(컷 안 탈것 · 배경 움직임) ──
_LK = dict(winSize=(21, 21), maxLevel=3, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))


class FlowCut:
    """한 컷의 장을 차례로 받아 특징점 추적(①②)과 조밀 흐름(③)을 함께 쌓는다."""

    def __init__(self, W, H):
        self.W, self.H, self.k = W, H, 1000.0 / W            # k: 화면 너비 1000 기준으로 바꾸는 배율
        s = DENSE_LONG / max(W, H)
        self.dw, self.dh = max(16, int(W * s) // 2 * 2), max(16, int(H * s) // 2 * 2)
        self.gx, self.gy = (8, 4) if W >= H else (4, 8)
        self.prev = self.prev_small = self.pts = self.ids = None
        self.nid, self.n, self.scales = 0, 0, []
        self.tracks = {}       # id → [첫 x, 첫 y, 걸음 수, 가로 합, 세로 합]
        self.steps = []        # 걸음마다 {id: 카메라를 걷어 낸 가로 이동}
        self.dense = []        # 조밀 흐름 칸 값(가로, 세로) — 두 장에 한 번

    def add(self, g):
        if self.prev is not None and self.pts is not None and len(self.pts):
            self._track(g)
        small = cv2.resize(g, (self.dw, self.dh), interpolation=cv2.INTER_AREA)
        if self.prev_small is not None and self.n % 2 == 1:
            f = cv2.calcOpticalFlowFarneback(self.prev_small, small, None, 0.5, 3, 15, 3, 5, 1.2, 0)
            cells = np.zeros((self.gy, self.gx, 2), np.float32)
            for r in range(self.gy):
                for c in range(self.gx):
                    cells[r, c] = np.median(f[r * self.dh // self.gy:(r + 1) * self.dh // self.gy,
                                              c * self.dw // self.gx:(c + 1) * self.dw // self.gx].reshape(-1, 2), axis=0)
            self.dense.append(cells)
        if self.n % FLOW_SEED == 0:
            self._seed(g)
        self.prev, self.prev_small = g, small
        self.n += 1

    def _seed(self, g):
        mask = np.full(g.shape, 255, np.uint8)
        if self.pts is not None:
            for x, y in self.pts.reshape(-1, 2):
                cv2.circle(mask, (int(x), int(y)), 8, 0, -1)
        new = cv2.goodFeaturesToTrack(g, 800, 0.005, 8, mask=mask)
        if new is None:
            return
        ids = np.arange(self.nid, self.nid + len(new))
        self.nid += len(new)
        if self.pts is None or not len(self.pts):
            self.pts, self.ids = new, ids
        else:
            self.pts, self.ids = np.concatenate([self.pts, new]), np.concatenate([self.ids, ids])

    def _track(self, g):
        q, st, _ = cv2.calcOpticalFlowPyrLK(self.prev, g, self.pts, None, **_LK)
        back, st2, _ = cv2.calcOpticalFlowPyrLK(g, self.prev, q, None, **_LK)
        fb = np.linalg.norm((back - self.pts).reshape(-1, 2), axis=1)
        ok = (st.ravel() == 1) & (st2.ravel() == 1) & (fb < FLOW_FB)
        P, Q = self.pts.reshape(-1, 2)[ok], q.reshape(-1, 2)[ok]
        ids = self.ids[ok]
        self.pts, self.ids = q[ok], ids
        step = {}
        if len(P) >= 8:
            M, _ = cv2.estimateAffinePartial2D(P, Q, method=cv2.RANSAC, ransacReprojThreshold=0.5, maxIters=2000)
            if M is not None:
                self.scales.append(float(math.hypot(M[0, 0], M[1, 0])))
                R = (Q - P) - (P @ M[:, :2].T + M[:, 2] - P)
                for i, p, r in zip(ids, P, R):
                    t = self.tracks.setdefault(int(i), [float(p[0]), float(p[1]), 0, 0.0, 0.0])
                    t[2] += 1
                    t[3] += float(r[0])
                    t[4] += float(r[1])
                    step[int(i)] = float(r[0])
        self.steps.append(step)

    # ── 판정 ──
    def zoom_rate(self):
        """카메라 배율이 초당 몇 % 바뀌나(앞으로 가는 카메라 · 확대)"""
        if not self.scales:
            return 0.0
        return (float(np.exp(np.mean(np.log(np.clip(self.scales, 0.5, 2.0))) * FPS)) - 1) * 100

    def _moving(self):
        """0.5초 넘게 이어진 점 → (x, y, 가로 속도, 세로 속도) — px/s(화면 너비 1000 기준)"""
        rows = [(t[0], t[1], t[3] / t[2] * FPS * self.k, t[4] / t[2] * FPS * self.k, i) for i, t in self.tracks.items() if t[2] >= TRACK_MIN]
        return [r for r in rows if math.hypot(r[2], r[3]) >= MOVE_MIN]

    def _cells(self, mv):
        """칸(띠, 쪽) → (가운데 가로 속도, 한 방향 몫, 점 수, 그 방향 점 id들) — 방향이 서는 칸만"""
        out = {}
        for b in range(3):
            for side in range(2):
                m = [r for r in mv if min(2, int(r[1] / self.H * 3)) == b and (r[0] >= self.W / 2) == bool(side) and abs(r[2]) >= MOVE_MIN]
                if len(m) < CELL_MIN:
                    continue
                med = float(np.median([r[2] for r in m]))
                agree = float(np.mean([np.sign(r[2]) == np.sign(med) for r in m]))
                if agree >= AGREE:
                    side_ratio = float(np.median([abs(r[3]) / abs(r[2]) for r in m]))     # 세로 / 가로 — 옆으로 가는 탈것은 작다
                    out[(b, side)] = (med, agree, len(m), {r[4] for r in m if np.sign(r[2]) == np.sign(med)}, side_ratio)
        return out

    def _zoomlike(self, mv, floor=0.0):
        """움직이는 점이 가로 · 세로로 함께 퍼지거나 모이나(다가오는 · 멀어지는 것 — 확대처럼 보이는 것). floor: 두 퍼짐이 모두 넘어야 할 초당 몫"""
        if len(mv) < 10:
            return False
        a = np.array(mv)
        sx = np.polyfit(a[:, 0] - self.W / 2, a[:, 2], 1)[0]
        sy = np.polyfit(a[:, 1] - self.H / 2, a[:, 3], 1)[0]
        return bool(sx * sy > 0 and abs(sy) >= 0.5 * abs(sx) and min(abs(sx), abs(sy)) >= floor)

    def judge(self, t0, t1):
        hits, zoom = [], self.zoom_rate()
        mv = self._moving()
        cells = self._cells(mv)
        zoomlike = self._zoomlike(mv)
        note = {"항목": "흐름", "초": t0, "끝초": t1, "카메라배율": round(zoom, 2), "움직이는점": len(mv),
                "칸": {f"{BANDS[b]}{'왼오'[s]}": round(v[0], 1) for (b, s), v in sorted(cells.items())}}
        if abs(zoom) < ZOOM_MAX:
            갈림 = []
            for b in range(3 if not zoomlike else 0):
                L, R = cells.get((b, 0)), cells.get((b, 1))
                if (L and R and np.sign(L[0]) != np.sign(R[0]) and min(abs(L[0]), abs(R[0])) >= SPLIT_MIN
                        and max(L[4], R[4]) <= SIDEWAYS):
                    갈림.append((b, L, R))
            if 갈림:   # 한 컷에 한 줄 — 가장 세게 엇갈린 띠를 글에, 나머지 띠는 값에
                b, L, R = max(갈림, key=lambda x: min(abs(x[1][0]), abs(x[2][0])))
                hits.append({"항목": "흐름갈림", "초": t0, "끝초": t1,
                             "값": {"띠": BANDS[b], "왼": round(L[0], 1), "오른": round(R[0], 1), "점": [L[2], R[2]], "한방향": [round(L[1], 2), round(R[1], 2)],
                                   "띠들": [BANDS[x[0]] for x in 갈림]},
                             "글": f"{t0}~{t1}초 컷의 {BANDS[b]} 띠에서 왼쪽은 {L[0]:+.1f}, 오른쪽은 {R[0]:+.1f}로 가로 방향이 엇갈린다"
                                   f"(카메라를 걷어 낸 움직이는 점의 가운데 값, 화면 너비 1000 기준 px/s) — 같은 길의 탈것이 서로 반대로 가거나 뒤로 밀리는지 본다"})
            멈춤 = [] if self._zoomlike(mv, ZOOM_SPREAD) else [((b, s), r) for (b, s), v in sorted(cells.items()) for r in [self._stop_go(v)] if r]
            if 멈춤:   # 한 컷에 한 줄 — 가장 오래 멈춘 칸을 글에
                (b, s), (a_, b_, ser) = max(멈춤, key=lambda x: x[1][1] - x[1][0])
                hits.append({"항목": "멈췄다감", "초": round(t0 + a_, 2), "끝초": round(t0 + b_, 2),
                             "값": {"컷": [t0, t1], "칸": f"{BANDS[b]}{'왼오'[s]}", "칸들": [f"{BANDS[x[0][0]]}{'왼오'[x[0][1]]}" for x in 멈춤], "속도": ser},
                             "글": f"{t0}~{t1}초 컷의 {BANDS[b]} {('왼쪽', '오른쪽')[s]} 칸에서 가던 것이 {t0 + a_:.2f}~{t0 + b_:.2f}초 동안 멈췄다가 다시 간다"
                                   f"(1/8초마다 가로 속도 px/s: {' '.join(f'{x:+.0f}' for x in ser if x is not None)}) — 탈것이 뚝 섰다가 튀어 나가는지, 사람이 잠깐 굳는지 본다"})
        r = self._spin()
        if r:
            hits.append({"항목": "제자리바퀴", "초": t0, "끝초": t1, "값": r,
                         "글": f"{t0}~{t1}초 컷에 도는 것(바퀴)이 있는데 나머지 화면이 거의 안 흐른다(흐름 90번째 값 {r['바탕90']}px/s, 문턱 {BG_MAX:g}) — "
                               f"바퀴만 돌고 탈것도 배경도 제자리인지 본다"})
        return hits, note

    def _stop_go(self, cell):
        """가다가 0.5초 넘게 멈춘 뒤 다시 가는 자리 → (멈춘 시작초, 끝초, 1/8초 속도 줄) — 컷 첫 장 기준 초"""
        med, _, _, group, _ = cell
        sign = 1.0 if med > 0 else -1.0
        ser = []
        for s0 in range(0, len(self.steps) - STEP_WIN + 1, STEP_WIN):
            win = self.steps[s0:s0 + STEP_WIN]
            common = [i for i in group if all(i in st for st in win)]
            ser.append(float(np.median([sum(st[i] for st in win) for i in common])) * FPS / STEP_WIN * self.k if len(common) >= 8 else None)
        vals = [x * sign for x in ser if x is not None]
        if len(vals) < 6:
            return None
        ref = float(np.percentile(vals, 80))
        if ref < 2 * MOVE_MIN:
            return None
        go = [x is not None and x * sign >= max(MOVE_MIN, GO_FRAC * ref) for x in ser]
        # 거의 서 있음 — 뒤로 가는 창은 멈춤이 아니다(서울로 S04y 차단벽을 밀며 몸을 앞뒤로 흔듦). 느려진 것도 멈춤이 아니다(지금 판 E04m 실이 풀리며 초당 0.6~3.5)
        stop = [x is not None and abs(x) < min(max(1.0, STOP_FRAC * ref), STOP_ABS) for x in ser]

        def 이어감(g):
            """창 둘 넘게 잇달아 가나 — 탈것이 화면 밖으로 나간 뒤 남은 점 몇 개가 한 창씩 튀는 값(서울로 Y15w 125 · 60)을 「감」으로 치지 않는다"""
            return any(g[k] and g[k + 1] for k in range(len(g) - 1))

        i = 0
        while i < len(ser):
            if not stop[i]:
                i += 1
                continue
            j = i
            while j < len(ser) and stop[j]:
                j += 1
            if j - i >= STOP_RUN and 이어감(go[:i]) and 이어감(go[j:]):   # 걸음 k = 컷 첫 장에서 FLOW_EDGE + k번째 장 → 다음 장
                return round((FLOW_EDGE + i * STEP_WIN) / FPS, 2), round((FLOW_EDGE + j * STEP_WIN) / FPS, 2), [None if x is None else round(x, 1) for x in ser]
            i = j
        return None

    def _spin(self):
        """도는 것(한 열 위아래 가로 흐름 반대 + 한 줄 좌우 세로 흐름 반대)이 있는데 그 밖 칸이 거의 안 흐르면 값을 낸다"""
        if len(self.dense) < 3:
            return None
        m = np.mean(self.dense, axis=0) * FPS * (1000.0 / self.dw)      # px/s(화면 너비 1000 기준)
        dx, dy = m[..., 0], m[..., 1]
        cols = {c for c in range(self.gx) for r1 in range(self.gy) for r2 in range(r1 + 1, self.gy)
                if dx[r1, c] * dx[r2, c] < 0 and min(abs(dx[r1, c]), abs(dx[r2, c])) >= ROT_MIN}
        if not cols:
            return None
        c0, c1 = max(0, min(cols) - 1), min(self.gx, max(cols) + 2)
        flip = any(dy[r, a] * dy[r, b] < 0 and min(abs(dy[r, a]), abs(dy[r, b])) >= ROT_MIN / 2
                   for r in range(self.gy) for a in range(c0, c1) for b in range(a + 1, c1))
        rest = np.ones((self.gy, self.gx), bool)
        rest[:, c0:c1] = False
        if not flip or not rest.any():
            return None
        bg = np.hypot(dx[rest], dy[rest])
        bg90 = float(np.percentile(bg, 90))
        if bg90 >= BG_MAX:
            return None
        return {"도는열": [min(cols), max(cols)], "바탕90": round(bg90, 1), "바탕가운데": round(float(np.median(bg)), 1),
                "도는칸가로": [round(float(x), 0) for x in dx[:, min(cols)]]}


def measure_flow(path, segs, w, h, pre=None):
    """컷마다 FlowCut — 긴 변 1000 회색 장을 한 번만 풀어(24fps) 컷 앞뒤 2장을 빼고 잰다 → (걸림, 알림).
    segs는 차례대로 겹치지 않는 (첫 장, 끝 장) 줄이다. 받은 뒤 검사(tools/받은뒤검사.py)는 판의 쓰는 구간만 준다(11-16).
    pre는 풀기 앞에 거는 ffmpeg 거르개다(받은 뒤 검사가 편집 창으로 자르는 crop) — 그때 w · h는 자른 크기다. 재는 법은 같다.
    풀기는 마지막 덩이의 끝 장에서 멈춘다 — 판 뒤의 버리는 구간까지 풀다가 읽기를 끊으면 ffmpeg가 「Broken pipe」를 쏟는다."""
    W, H = fit_size(w, h, FLOW_LONG)
    last = max((b for _a, b in segs), default=0)
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", (f"{pre}," if pre else "") + f"fps={FPS:g},scale={W}:{H}",
                             "-frames:v", str(max(1, last)), "-f", "rawvideo", "-pix_fmt", "gray", "-"], stdout=subprocess.PIPE)
    size = W * H
    hits, notes, i = [], [], 0
    try:
        for a, b in segs:
            lo, hi = a + FLOW_EDGE, b - FLOW_EDGE
            fc = FlowCut(W, H) if (hi - lo) / FPS >= FLOW_MIN_SEC else None
            while i < b:
                raw = proc.stdout.read(size)
                if len(raw) < size:
                    break
                if fc is not None and lo <= i < hi:
                    fc.add(np.frombuffer(raw, np.uint8).reshape(H, W))
                i += 1
            if fc is not None and fc.n >= 4:
                hs, note = fc.judge(round(a / FPS, 2), round(b / FPS, 2))
                hits += hs
                notes.append(note)
    finally:
        proc.stdout.close()
        proc.wait()
    return hits, notes


def quiet_runs(db):
    """조용구간 — 0.25초 칸 dB 줄 → (큰 소리 기준 dB, [(시작 칸, 끝 칸, 그 자리 평균 dB)] 긴 순). 앞 0.5초와 끝 3초(끝소리가 본다)는 뺀다.
    1초 창(칸 넷의 평균 전력)으로 다듬어 말 사이 짧은 숨 · 한 번 튄 효과음에 자리가 끊기지 않게 한다. 몸통이 QUIET_SEC보다 짧으면 (None, [])"""
    a, b = 2, len(db) - int(END_SEC * 4)
    if b - a < QUIET_SEC * 4:
        return None, []
    ref = float(np.percentile(db[a:b], QUIET_REF_PCT))
    pw = 10 ** (np.asarray(db, np.float64) / 10)
    runs, s = [], -1
    for i in range(a, b + 1):
        lo = max(0, i - 2)
        q = i < b and 10 * math.log10(float(pw[lo:lo + 4].mean()) + 1e-12) < ref - QUIET_DB
        if q and s < 0:
            s = i
        elif not q and s >= 0:
            runs.append((s, i, round(10 * math.log10(float(pw[s:i].mean()) + 1e-12), 1)))
            s = -1
    return round(ref, 1), sorted(runs, key=lambda r: r[0] - r[1])


def main(argv=None):
    ap = argparse.ArgumentParser(description="최종본 검사 — 굳음 · 같은 판 · 되풀이 · 끝 · 화소 · 조용 (+ 흐름: 관문이 붙여 부른다)")
    ap.add_argument("mp4")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--항목", default=DEFAULT_ITEMS)
    ap.add_argument("--컷초", default="", help="흐름만 쓴다: 컷이 바뀌는 초(쉼표) — 천 닦기 같은 전환은 장 차이로 못 찾아 컷표 경계를 더한다")
    o = ap.parse_args(argv)
    want = set(o.항목.split(","))
    try:
        w, h, src_fps, dur = probe(o.mp4)
    except Exception as e:  # noqa: BLE001 — 끝 코드 2로 알린다
        print(json.dumps({"파일": o.mp4, "오류": str(e)}, ensure_ascii=False) if o.json else f"잴 수 없음: {e}")
        return 2
    small = decode(o.mp4, fit_size(w, h, 192))
    if len(small) < 4:
        print(json.dumps({"파일": o.mp4, "오류": "장이 모자람"}, ensure_ascii=False) if o.json else "잴 수 없음: 장이 모자람")
        return 2
    n = len(small)
    fps = FPS
    cuts = find_cuts(small, fps)
    bounds = [0] + cuts + [n]
    segs = [(bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1)]
    t = lambda k: round(k / fps, 2)  # noqa: E731
    hits, notes, failed = [], [], []

    def guard(name, fn):
        """항목 하나가 죽어도 앞서 잰 것은 낸다 — 못 잰 항목은 「못잼」에(Fable 검수 2)"""
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            failed.append({"항목": name, "오류": f"{type(e).__name__}: {e}"[:300]})

    need = set()
    if "같은판" in want:
        for c in cuts:
            need.update((c - 1, c))
    if "되풀이" in want:
        need.update((a + b) // 2 for a, b in segs)
    size = fit_size(w, h, 640)
    shape = (size[1], size[0])
    mid = None
    try:
        mid = pick(o.mp4, size, need) if need else None
    except Exception as e:  # noqa: BLE001
        failed.append({"항목": "같은판 · 되풀이", "오류": f"{type(e).__name__}: {e}"[:300]})

    def _same():
        if "같은판" in want and mid is not None:
            for c in cuts:
                rel = relation(features(mid[c - 1]), features(mid[c]), shape)
                k = kind_of(rel)
                if k:
                    hits.append({"항목": k, "초": t(c), "값": rel,
                                 "글": (f"{t(c)}초 컷 경계가 앞 컷과 같은 그림이다 — 배율 {rel['배율']} · {rel['옮김']}px 옮김(같은 판을 잘라 키워 이어 붙임, 점검표 50)"
                                        if k == "같은판" else f"{t(c)}초 컷 경계의 앞뒤가 배율 · 자리까지 같은 그림이다(점프 컷, 점검표 50)")})

    guard("같은판", _same)

    def _repeat():
        if "되풀이" in want and mid is not None:
            reps = [(a, b, features(mid[(a + b) // 2])) for a, b in segs if (b - a) / fps >= 0.5]
            group_of = {}                              # 컷 번호 → 무리(가장 이른 컷) — 이은 이은 것으로 번지지 않게 각 컷은 가장 이른 짝의 무리에만 든다
            for j in range(len(reps)):
                for i in range(j):
                    if reps[j][0] <= reps[i][1]:       # 이웃 컷은 같은판이 본다
                        continue
                    if relation(reps[i][2], reps[j][2], shape, REPEAT_INLIERS, strict=True):
                        group_of[j] = group_of.get(i, i)
                        group_of.setdefault(i, i)
                        break
            groups = {}
            for j, g in sorted(group_of.items()):
                groups.setdefault(g, []).append(j)
            for g in groups.values():                  # 같은 그림 무리마다 한 줄(B39 v10 법정 전경 0 · 2.9 · 18.4 · 34초가 네 줄로 흩어지지 않게)
                if len(g) < 2:
                    continue
                times = [t(reps[i][0]) for i in g]
                hits.append({"항목": "되풀이", "초": times[1], "앞초": times[0], "값": {"컷": times},
                             "글": f"같은 그림의 컷이 {len(times)}번 나온다 — {' · '.join(f'{x}초' for x in times)}(같은 장면 반복, 점검표 50)"})

    guard("되풀이", _repeat)

    def _detail():
        if "화소" in want:
            full = pick(o.mp4, (w, h), [(a + b) // 2 for a, b in segs if (b - a) / fps >= 0.5])
            end_from = n - int(round(END_SEC * fps))
            for a, b in segs:
                k = (a + b) // 2
                if k not in full:
                    continue
                r = detail_ratio(full[k])
                if r is None:
                    continue
                if r < DETAIL_FLAG and b > end_from:
                    hits.append({"항목": "끝화소", "초": t(a), "끝초": t(b), "값": {"가는결비": r},
                                 "글": f"끝 3초의 {t(a)}~{t(b)}초 컷이 잘라 키운 흐린 그림이다 — 가는 결 비 {r}(제 화소 판 0.25 안팎, 점검표 48 · 2)"})
                else:
                    notes.append({"항목": "화소", "초": t(a), "가는결비": r})

    guard("화소", _detail)

    sound = {}

    def audio():
        """0.25초 칸 dB — 끝 · 조용이 함께 쓰도록 한 번만 푼다"""
        if "db" not in sound:
            sound["db"] = audio_rms(o.mp4, dur)
        return sound["db"]

    def _end():
        if "끝" in want:
            db = audio()
            if db is not None and len(db) > 4 * (END_SEC + 2):
                end_n = int(END_SEC * 4)
                body_mid = float(np.median(db[4: len(db) - end_n]))
                quiet = 0                               # 끝에서부터(마지막 0.25초 칸은 빼고) 몸통 가운데보다 10dB 넘게 작은 칸이 잇달아 몇 개인가
                for v in db[-2::-1]:
                    if v < body_mid - END_QUIET_DB:
                        quiet += 1
                    else:
                        break
                row = {"끝조용초": round((quiet + 1) / 4, 2), "몸통가운데dB": round(body_mid, 1), "끝최대dB": round(float(np.max(db[-end_n:-1])), 1)}
                if quiet >= END_QUIET_SEC * 4:
                    hits.append({"항목": "끝소리", "초": round(dur - row["끝조용초"], 2), "값": row,
                                 "글": f"끝 {row['끝조용초']}초가 몸통 소리 가운데({row['몸통가운데dB']}dB)보다 {END_QUIET_DB:.0f}dB 넘게 작은 방 소리뿐이다 — 끝 소리 한 방이 없다(점검표 2)"})
                else:
                    notes.append({"항목": "끝소리", **row})

    guard("끝", _end)

    def _quiet():
        if "조용" in want:
            db = audio()
            if db is None:
                return
            ref, runs = quiet_runs(db)
            if ref is None:
                return
            for s, e, lvl in runs:
                if (e - s) / 4 <= QUIET_SEC:
                    break
                a_, b_, n_ = round(s / 4, 2), round(e / 4, 2), round((e - s) / 4, 2)
                hits.append({"항목": "조용구간", "초": a_, "끝초": b_, "값": {"길이초": n_, "평균dB": lvl, "기준dB": ref},
                             "글": f"{a_}~{b_}초 {n_}초 동안 소리가 이 편의 큰 소리({ref}dB)보다 {QUIET_DB:.0f}dB 넘게 작다(평균 {lvl}dB) — "
                                   f"말 · 사건 소리 없이 작은 소리만 깔린 긴 구간이라 폰 스피커로는 비어 들린다(최종 확인 갈래 「소리」)"})
            notes.append({"항목": "조용구간", "최장초": round((runs[0][1] - runs[0][0]) / 4, 2) if runs else 0, "기준dB": ref})

    guard("조용", _quiet)

    def _flow():
        if "흐름" in want:
            fsegs = segs
            extra = sorted({int(round(float(x) * fps)) for x in o.컷초.split(",") if x.strip()})
            if extra:   # 장 차이로 찾은 경계와 합친다(3장 안은 하나로) — 컷표가 낡았어도 한 컷이 둘로 나뉠 뿐이다
                bs = sorted(set(cuts))
                for e in extra:
                    if 2 <= e <= n - 2 and all(abs(e - c) > 3 for c in bs):
                        bs.append(e)
                bs = [0] + sorted(bs) + [n]
                fsegs = [(bs[k], bs[k + 1]) for k in range(len(bs) - 1)]
            hs, ns = measure_flow(o.mp4, fsegs, w, h)
            hits.extend(hs)
            notes.extend(ns)

    guard("흐름", _flow)

    def _motion():
        if want & {"굳음"}:
            for r in measure_motion(o.mp4, fps, segs):
                if r["판정"] == "가까움 · 눈으로 판정":
                    notes.append({"항목": "가까움", "초": r["시작"], "끝초": r["끝"], "사람": r["사람"]})
                    continue
                mostly_people = r["사람장"] > (r["장"] - 1) / 2
                if mostly_people and r["사람"] < FROZEN:
                    hits.append({"항목": "굳음", "초": r["시작"], "끝초": r["끝"], "값": {"사람": r["사람"], "카메라": r["카메라"]},
                                 "글": f"{r['시작']}~{r['끝']}초 컷의 사람이 굳어 있다 — 사람 {r['사람']}(0.12 아래, 점검표 26)"})
                elif mostly_people and r["멎은창"]:
                    hits.append({"항목": "구간굳음", "초": r["멎은창"][0], "끝초": r["끝"], "값": {"사람": r["사람"], "창": r["멎은창"]},
                                 "글": f"{r['시작']}~{r['끝']}초 컷 안 {r['멎은창'][0]}초부터 1.5초 넘게 사람이 멎는다(점검표 26)"})
                notes.append({"항목": "사람", "초": r["시작"], "끝초": r["끝"], "사람": r["사람"], "판정": r["판정"], "사람장": r["사람장"], "장": r["장"]})

    guard("굳음", _motion)

    out = {"파일": o.mp4, "길이": round(dur, 2), "fps": fps, "원본fps": round(src_fps, 3), "컷": [t(c) for c in cuts], "걸림": hits, "알림": notes,
           **({"못잼": failed} if failed else {})}
    if o.json:
        print(json.dumps(out, ensure_ascii=False))
    else:
        print(f"{os.path.basename(o.mp4)} · {out['길이']}초 · 컷 {len(cuts) + 1}개")
        for x in hits:
            print(f"  [{x['항목']}] {x['글']}")
        for x in failed:
            print(f"  [못 잼 · {x['항목']}] {x['오류']}")
        if not hits and not failed:
            print("  걸림 없음")
    hard = [x for x in hits if x["항목"] not in SOFT]
    code = 1 if hard else (2 if failed else 0)
    _검사이력(시작=o.mp4, 눈="최종본검사", 단계="편집", 결과="걸림" if hard else ("못 잼" if failed else ("확인" if hits else "통과")), 끝코드=code,
           판경로=[o.mp4], 걸림=[{"규칙": x["항목"], "등급": "확인" if x["항목"] in SOFT else "걸림", "글": x["글"]} for x in hits]
           + [{"규칙": x["항목"], "등급": "확인", "글": f"못 잼 — {x['오류']}"} for x in failed])
    return code


def _검사이력(판경로=None, **k):
    """편 폴더 게시/검사이력.jsonl에 이 실행 한 줄(tools/lib/검사이력.py, 흠 장부 설계 1단계). 무엇이 실패해도 위 출력과 끝 코드는 그대로다.
    올리기 전 검사 ⑳이 부를 때는 그 검사가 한 줄로 남기므로 SYNK_검사이력=끔으로 부른다. 최종 확인 묶음은 SYNK_검사단계=최종 확인을 넘긴다."""
    try:
        if os.environ.get("SYNK_검사이력") == "끔":
            return
        spec = importlib.util.spec_from_file_location("검사이력", os.path.join(HERE, "lib", "검사이력.py"))
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        m.도구에서남기기(판=m.경로지문(판경로) if 판경로 else None, **k)
    except BaseException:   # noqa: BLE001 — 이력은 검사 결과를 바꾸지 않는다
        pass


if __name__ == "__main__":
    sys.exit(main())

# 한강2126 가편집 11판(11-06) — 받은 시댄스 판으로 처음 짜는 편집. 정지 그림 가편집(9 · 10판)의 시간표 · 음악 자리를 이어받는다.
#   python -X utf8 가편집11.py [--판 full|sns] [--빠르게]
#   → git 밖 재촬영_v40/가편집/가편집11_전체.mp4 · _폰용.mp4 · _시간표.json   (sns: 가편집11_SNS30.mp4)
# 11-06 유호님 「걱정되는곳을 전부 보완해줘」 — 걱정 넷과 보완:
#   ① 첫 3초가 약함 → 면접실 콜드 오픈(「왜 늦었어요?」 →「…상어랑 어깨빵했어요.」)으로 시작해 그 말을 풀어 가는 짜임
#   ② 2:45 세로는 SNS에 김 → 전체판은 다듬고, SNS 30초 판을 따로(--판 sns)
#   ③ 층이 하는 일이 그림만으론 반쯤 → 층 꼬리표(층 · 이름 · 한 줄)를 제대로 그려 얹음
#   ④ 대화 장면 정면 고정 반복 → 2E · L3 · L6 · P8을 비켜 선 구도로 다시 뽑음(다시_1106), T4b 옷 · 어깨빵도 다시
# 소리: 사람 목소리는 그 판에서 시댄스가 낸 목소리(제작 규칙), 대사 없는 판의 생성 소리는 끄고 효과음(일레븐 효과음) · 음악(M1 · M2)을 얹음.
import argparse
import json
import os
import re
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt

HOME = os.path.expanduser("~").replace("\\", "/")
V40 = f"{HOME}/Videos/한강2126_새판_20261009/재촬영_v40"
GOT = f"{HOME}/Documents/synk-vendor/pulse-seedance-day-20261028/받음"
OUTD = f"{V40}/가편집"
FONT = "C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트"
SFXD = f"{V40}/소리/효과음/raw_1106"
KIT = "C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_사운드킷"
M1 = f"{V40}/소리/음악/M1_A_무표정펑크_97fdd596.wav"
M2 = f"{V40}/소리/음악/M2_G1_SPLASH_b9b03e7b.wav"
TITLE = f"{V40}/타이틀/출력/시안1.mp4"              # O8 탑뷰 + HAN RIVER 타이틀(같은 K04b 탑뷰라 그대로 씀)
S2UP = f"{V40}/업스케일/S2_v19_1층_4.92-12.63_1080p.mp4"   # 1층 옷 교차 몽타주(v20 장면, 굽지 않는 칸)
CARD = f"{HOME}/Videos/한강2126_새판_20261009/video/v31장면/마감카드_로고1.2초줄임.mp4"
W, H, FPS, SR = 1080, 1920, 24, 48000


def clip(name):
    """받은 판 — 다시 뽑은 판(이름__N)이 있으면 고른 판을 PICK에서."""
    n = PICK.get(name, name)
    p = f"{GOT}/hg-{n}.mp4"
    if not os.path.exists(p):
        raise SystemExit(f"없음: {p}")
    return p


# 다시 뽑은 판(11-06, 시작 그림 재촬영_v40/시댄스/다시_1106 · 꾸러미 웹올리기_한강다시_1106[b]) 가운데 고른 판.
#   O2-O3__2: 상어 머리가 어깨를 들이받고 튕겨 나가며 컵이 뜸(3.3~4.05초) · 2E__3: 「…모악산 배네치아요」 끝 「요」까지(__2는 빠짐)
#   L3__2: 왼손으로 핸들을 받음(__3은 컵 손까지 핸들로) · L6__3: 「네」가 1 dB 큼 · P8__3: 대사 맞음(__2는 「면접이시죠? 신자는…」) · T4b__3: 가방 · 까몽 또렷, 검은 바지
PICK = {"O2-O3": "O2-O3__2", "2E": "2E__3", "L3": "L3__2", "L6": "L6__3", "P8": "P8__3", "T4b": "T4b__3"}

# ── 컷 표 ───────────────────────────────────────────────────────────────────────────
# (컷 이름, 판, 판 안 시작초, 길이, 소리, 자막)
#   판: 받은 판 이름(hg- 뒤) · ("file", 경로) · ("title",) · ("card",)
#   소리: "voice" = 그 판 소리(대사) · "amb" = 그 판 소리를 −14 dB(공기) · ("from", 판, 그 판 초) = 화면 밖 대사 판 소리 · None = 끔
#   자막: 한 화면에 한 문장(「|」로 나누면 컷 안에서 차례로)
#   판 안 시작초는 받아쓰기(faster-whisper medium, 낱말 시각)로 잰 말 자리에서 정했다 — 말 앞 0.3초 · 뒤 0.25초 이상 숨
V = "voice"
CUTS_FULL = [
    # 콜드 오픈 — 면접실의 이상한 대답으로 시작해, 그 말이 무슨 뜻인지 영상 전체가 풀어 준다
    ("C1 「왜 늦었어요?」", "O5", 2.10, 1.80, ("from", "F1", 0.00), "왜 늦었어요?"),
    ("C2 「…상어랑 어깨빵했어요.」", "F2", 1.55, 2.55, V, "…상어랑 어깨빵했어요."),
    # 오프닝(광고처럼 시작 → 어깨빵 → 슬로 → 누움 → 타이틀 → 상어 풍덩 → 마린)
    ("O1 광고 첫 장면 · 난간", "O1", 0.00, 1.30, None, ""),
    ("O1b 커피 광고 클로즈업", "O1b", 0.20, 0.90, None, ""),
    ("O2-O3 어깨빵", "O2-O3", 3.30, 0.75, None, ""),
    ("O4 슬로모션", "O4", 0.00, 2.50, None, ""),
    ("O6 바닥으로", "O6", 0.40, 1.50, None, ""),
    ("O7 누워서 한숨", "O7", 0.50, 2.40, V, "하아……"),
    ("O8 탑뷰 · 컵 착지 = 타이틀", ("title",), 0.00, 2.60, None, ""),
    ("O9a 상어도 난간에 기대다", "O9a", 0.00, 1.60, None, ""),
    ("O9 풍덩", "O9", 0.00, 1.20, None, ""),
    ("O10-O11 바닥 시점 · 마린이 일으킴", "O10-O11", 0.00, 3.30, None, ""),
    ("O12 안경 받기", "O12", 0.00, 1.50, None, ""),
    ("T0 드론 상승 · 건물", "T0", 0.00, 3.00, None, ""),
    # 로비 · 1층 PULSE
    ("S1a-S1d 로비 · 안내판 · 10:14 · 한 모금", "S1a-S1d", 0.40, 4.60, None, ""),
    ("S1e-S1f 마린 따라 베리 아치로", "S1e-S1f", 1.50, 2.60, None, ""),
    ("S2a-S2b 1층 · 모델로 오해", "S2a-S2b", 0.00, 3.60, V, "모델분, 늦으셨네요. 이쪽이요."),
    ("S2c 나란히 · 스트로브(v20)", ("file", S2UP), 0.00, 2.50, V, ""),
    ("S2d 몽글 움찔(v20)", ("file", S2UP), 2.50, 0.71, V, ""),
    ("S2e 옷 교차 몽타주(v20)", ("file", S2UP), 4.46, 3.25, V, "AI 모델은 옷을 안 갈아입어도 돼요."),
    ("S2f LED 거대한 얼굴", "S2f", 0.00, 2.00, None, ""),
    ("G1 「4층은 저 계단이요」", "G1", 0.00, 4.00, V, "수고하셨어요. 4층은 저 계단이요."),
    ("T1 계단 FPV → 2층", "T1", 0.00, 5.00, None, ""),
    # 2층 SHIFT
    ("2A 접수대 「14분」", "2A-2B", 0.00, 3.10, V, "면접이시죠? 14분 늦으셨네요."),
    ("2B 펠트 화면판 · AI 처리", "2A-2B", 3.25, 1.20, None, ""),
    ("2C1 인사 몽골어", "2C1", 0.00, 1.00, V, "Сайн байна уу!"),
    ("2C2 인사 베트남어", "2C2", 0.00, 0.90, V, "Xin chào!"),
    ("2C4 인사 러시아어", "2C4", 0.00, 0.95, V, "Здравствуйте!"),
    ("2C5 인사 중국어", "2C5", 0.00, 1.00, V, "니하오!"),
    ("2D 컵을 빤히", "2D", 0.00, 3.10, V, "음.. 커피 어디서 샀어요?"),
    ("2E 「모악산 배네치아요」", "2E", 1.80, 2.25, V, "…모악산 배네치아요."),
    ("2F 마린과 종이컵", "2F", 0.00, 1.00, None, ""),
    ("2G 「4층이에요」 → 뱃고동", "2G", 0.60, 3.40, V, "4층이에요. 계속 올라가세요."),
    # T2 — 창 → 강 → 배 → 3층 띠 창 → 계단
    ("T2a1 창 → 유리 플레어", "T2a1", 0.00, 1.00, None, ""),
    ("T2a2 다이브 · 갑판 · 깃발", "T2a2", 0.00, 4.30, None, ""),
    ("T2b 구조된 상어", "T2b", 0.00, 1.50, None, ""),
    ("T2c1 3층 띠 창 통과", "T2c1", 0.00, 1.90, None, ""),
    ("T2c2 계단 → 코랄 문", "T2c2", 0.00, 2.40, None, ""),
    # 3층 LAB
    ("L1-L2 「어. 서. 오. 세. 요~!」", "L1-L2", 1.40, 4.40, V, "어. 서. 오. 세. 요~!"),
    ("L3 핸들 받기 「병원!」", "L3", 0.60, 3.30, ("from", "말-선생님", -0.15), "한 번 해 보세요. 병원!"),
    ("L4 병원 관문 · 몽글", "L4", 0.00, 2.60, None, ""),
    ("L5 「…한국 분이세요?」", "L5-L7", 0.30, 1.40, V, "…한국 분이세요?"),
    ("L6 「네.」", "L6", 3.00, 1.00, V, "네."),
    ("L7 「아, 면접?」", "L5-L7", 3.90, 1.40, V, "아, 면접?"),
    ("T3 코랄 아치 터널 → PATH", "T3", 0.00, 3.20, None, ""),
    # 3층 PATH
    ("P1 상담사 「연습하고 가세요」", "P1-P2", 0.70, 2.40, V, "면접이시죠? 한 번 연습하고 가세요."),   # 판 안 하드컷 3.125초 앞에서 끊음(뒤는 갈색 뿔테 클로즈업)
    ("P2 헤드셋 → 하얘짐", "P1-P2", 5.00, 0.80, None, ""),
    ("P2a STAGE 1 · 비자", "P2a", 0.00, 1.10, None, ""),
    ("P2b STAGE 2 · 수업", "P2b", 0.00, 1.10, None, ""),
    ("P3-P4 VR 방 · 거짓말 감지", "P3-P4", 1.20, 2.60, None, ""),
    ("P5 노랑 · 통과", "P5", 1.20, 1.80, None, ""),
    ("P6 「잘 부탁드립니다!」", "P6", 0.00, 2.10, V, "잘 부탁드립니다!"),
    ("P7 반전 · 빈 의자에 절", "P7", 0.00, 2.60, None, ""),
    ("P8 「진짜는 4층이에요」", "P8", 0.70, 2.90, V, "좋아요. 진짜는 4층이에요."),
    ("T4a 펜던트 → 하얘짐", "T4a", 0.90, 1.10, None, ""),
    ("T4b 4층 펜던트 → 문 여는 그", "T4b", 1.10, 2.30, None, ""),
    # 4층 면접실 — 콜드 오픈의 그 자리로 돌아온다
    ("F0 숫자 없는 벽시계", "F0", 0.00, 0.70, None, ""),
    ("F1 「왜 늦었어요?」", "F1", 0.20, 1.50, V, "왜 늦었어요?"),
    ("F2 「…상어랑 어깨빵했어요.」", "F2", 1.85, 2.10, V, "…상어랑 어깨빵했어요."),
    ("F3 크래시 줌", "F3-F4", 1.90, 0.35, None, ""),
    ("F4 「수영 잘해요?」", "F3-F4", 2.25, 1.90, V, "수영 잘해요?"),
    ("F5 눈 극 클로즈업", "F5", 0.00, 0.80, None, ""),
    ("F6 「…아니요.」", "F6", 1.70, 2.10, V, "…아니요."),
    ("F7 「솔직해서, 합격.」", "F7", 0.00, 3.40, ("from", "말-면접관", 0.60), "솔직해서, 합격."),
    ("F8a 마린 갸웃", "F8a", 0.00, 0.60, None, ""),
    ("F8b 코트걸이 까몽", "F8b", 0.00, 0.40, None, ""),
    # 엔딩
    ("T5 노을 창 → 유리 → 까치", "T5", 0.60, 3.20, None, ""),
    ("E1 까치 이륙", "E1", 2.40, 1.60, None, ""),
    ("E2 라이드 얼롱", "E2", 0.00, 4.60, None, ""),
    ("E3 상어 머리 착지 · 무대", "E3", 0.30, 5.60, None, ""),
    ("TAIL 로고", ("end",), 0.00, 2.80, None, ""),
]
# 디지털 줌(크래시 줌 등) — 컷 이름: (처음 배율, 끝 배율, 가운데 x, 가운데 y)
# F3 · F4: 면접관 뒤 가방 키링을 영상이 곰처럼 다시 그려(시작 그림은 고양이) 살짝 당겨 화면 밖으로
ZOOM = {"F3 크래시 줌": (1.42, 2.7, 0.38, 0.33), "F4 「수영 잘해요?」": (1.42, 1.44, 0.38, 0.45)}
# 대사 크기 맞춤(첫 렌더 컷별 실측: 대사 컷 대부분 −15~−17 dB RMS, 아래 컷만 작았다)
GAIN = {"S2e 옷 교차 몽타주(v20)": 9, "2C2 인사 베트남어": 4, "2C4 인사 러시아어": 3, "2C5 인사 중국어": 4, "F6 「…아니요.」": 5}
# 공간음 깔개(첫 렌더에 디지털 무음 컷이 열둘 — 끊긴 소리로 들림): (시작 컷, 끝 컷, 파일, dB)
AMB_FULL = [
    ("O1 광고 첫 장면 · 난간", "T0 드론 상승 · 건물", "amb_river_1.mp3", -30),
    ("S1a-S1d 로비 · 안내판 · 10:14 · 한 모금", "S2f LED 거대한 얼굴", "amb_lounge_1.mp3", -34),
    ("2A 접수대 「14분」", "2G 「4층이에요」 → 뱃고동", "amb_office_1.mp3", -32),
    ("L1-L2 「어. 서. 오. 세. 요~!」", "L7 「아, 면접?」", "amb_lounge_2.mp3", -34),
    ("T3 코랄 아치 터널 → PATH", "T4b 4층 펜던트 → 문 여는 그", "amb_lounge_1.mp3", -32),
    ("C1 「왜 늦었어요?」", "C2 「…상어랑 어깨빵했어요.」", "amb_room_1.mp3", -30),
    ("F0 숫자 없는 벽시계", "F8b 코트걸이 까몽", "amb_room_1.mp3", -30),
]
SFX_FULL = [     # (컷 이름, 컷 안 초, 효과음 파일, dB) — 받은 판의 장면 변화량으로 잰 사건 시각에
    ("O2-O3 어깨빵", 0.20, "bump_3.mp3", -1),
    ("O4 슬로모션", 0.00, "slowmo_1.mp3", -8),
    ("O6 바닥으로", 0.62, "fall_2.mp3", -3),
    ("O8 탑뷰 · 컵 착지 = 타이틀", 1.00, "cup_land_4.mp3", -6),
    ("O9 풍덩", 0.05, "splash_3.mp3", -1),
    ("T0 드론 상승 · 건물", 0.00, "drone_up_1.mp3", -9),
    ("2G 「4층이에요」 → 뱃고동", 2.55, "horn_2.mp3", -2),
    ("T2a1 창 → 유리 플레어", 0.80, "glass_1.mp3", -6),
    ("T2c1 3층 띠 창 통과", 1.95, "glass_1.mp3", -6),
    ("P2a STAGE 1 · 비자", 0.45, f"{V40}/소리/효과음/도장_임시.wav", -3),
    ("P2a STAGE 1 · 비자", 0.60, f"{KIT}/synk-sound-achieve.wav", -8),
    ("P2b STAGE 2 · 수업", 0.55, f"{KIT}/synk-sound-achieve.wav", -8),
    ("F3 크래시 줌", 0.00, "crash_zoom_1.mp3", -4),
    ("E1 까치 이륙", 0.85, "magpie_3.mp3", -5),
    ("E3 상어 머리 착지 · 무대", 0.30, "crowd_2.mp3", -12),
]
FLOORS_FULL = [   # (시작 컷, 끝 컷, 층, 이름, 한 줄, 칩 색 BGR)
    ("S2a-S2b 1층 · 모델로 오해", "G1 「4층은 저 계단이요」", "1F", "PULSE", "광고 · 뮤직비디오 · AI 모델", "4A2398"),
    ("2A 접수대 「14분」", "2G 「4층이에요」 → 뱃고동", "2F", "SHIFT", "회사 일을 대신하는 AI", "8A4520"),
    ("L1-L2 「어. 서. 오. 세. 요~!」", "L7 「아, 면접?」", "3F", "LAB", "게임으로 배우는 한국어", "4A62D9"),
    ("P1 상담사 「연습하고 가세요」", "P8 「진짜는 4층이에요」", "3F", "PATH", "한국 유학 · 취업을 VR로 미리", "5E8A6A"),
    ("F0 숫자 없는 벽시계", "F8b 코트걸이 까몽", "4F", "면접실", "", "3A3A3A"),
]
STAGES = {"P2a STAGE 1 · 비자": ("STAGE 1 · 비자", "CLEAR"), "P2b STAGE 2 · 수업": ("STAGE 2 · 수업", "CLEAR")}
SCREEN = {"2B 펠트 화면판 · AI 처리": (492, 905, ["1,284건", "1,285건", "1,286건", "1,287건"])}


def music_full(mix, T, at, read_wav, lufs):
    s1, s2 = read_wav(M1), read_wav(M2)
    g1, g2 = -17.0 - lufs(M1), -17.0 - lufs(M2)
    end = lambda c: at[c]["시작"] + at[c]["길이"]
    # M1 ① 오프닝 걸음 → 어깨빵에서 뚝(콜드 오픈은 음악 없이 방 소리만)
    a, b = T("O1 광고 첫 장면 · 난간"), T("O2-O3 어깨빵", 0.20)
    place(mix, s1, 0.0, a, b, [(a, g1 - 30), (a + 0.3, g1), (b - 0.02, g1), (b, -120)])
    # M1 ② 컵 착지 = 타이틀에 곡의 다시 들어오는 자리 97.90 → 뱃고동
    a, b = T("O8 탑뷰 · 컵 착지 = 타이틀", 1.0), T("2G 「4층이에요」 → 뱃고동", 2.55)
    place(mix, s1, 97.90, a, b + 0.6, [(a, g1), (b, g1), (b + 0.6, -120)])
    # M2 ① 뱃고동 뒤 → 창 안 먹먹 → 다이브부터 또렷 · 「Splash」(곡 4.73초)가 구조된 상어 컷에 → 띠 창부터 먹먹 → 계단에서 멀어짐
    a = T("2G 「4층이에요」 → 뱃고동", 3.0)
    s0 = max(0.0, 4.73 - (T("T2b 구조된 상어") - a))
    b = end("T2c2 계단 → 코랄 문")
    c1, c2 = T("T2a2 다이브 · 갑판 · 깃발"), T("T2c1 3층 띠 창 통과", 1.95)
    place(mix, s2, s0, a, b, [(a, g2 - 6), (c1, g2 - 3), (c1 + 0.5, g2), (c2, g2), (c2 + 0.1, g2 - 10), (b - 0.4, g2 - 36), (b, -120)],
          lp_mix=[(a, 1), (c1, 1), (c1 + 0.5, 0), (c2, 0), (c2 + 0.1, 1), (b, 1)], lp_hz=600)
    # M1 ③ LAB 변주(곡 앞 성긴 도입, 낮게) → 터널 어둠에서 끝
    a, b = T("L1-L2 「어. 서. 오. 세. 요~!」"), T("T3 코랄 아치 터널 → PATH", 1.8)
    place(mix, s1, 0.0, a, b, [(a, g1 - 30), (a + 0.4, g1 - 5), (b - 0.5, g1 - 5), (b, -120)])
    # PATH · 4층은 음악 없음(건조한 침묵이 웃음 자리)
    # M2 ② 엔딩 — 마지막 후렴(곡 96.20)이 E4 하드컷에서 뚝
    hit = T("TAIL 로고")                # 마지막 후렴(곡 96.20)이 끝 카드 첫 장에 터지고 카드 끝까지, 마지막 0.8초에 줄어듦
    end_ = end("TAIL 로고")
    off = hit - 96.20
    a = T("T5 노을 창 → 유리 → 까치")
    e2 = T("E2 라이드 얼롱")
    place(mix, s2, a - off, a, end_, [(a, g2 - 12), (e2, g2 - 2), (T("E3 상어 머리 착지 · 무대"), g2), (end_ - 0.8, g2), (end_, -40)],
          lp_mix=[(a, 1), (T("E1 까치 이륙"), 1), (e2, 0), (end_, 0)], lp_hz=700)


def run(a, **kw):
    r = subprocess.run(a, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)
    if r.returncode:
        raise SystemExit("실패: " + " ".join(map(str, a[:8])) + "\n" + r.stderr[-1500:])
    return r.stdout


END = f"{OUTD}/_끝카드11.mp4"


def make_endcard(sec=2.8):
    """끝 카드 — 옛 마감 카드의 펠트 로고만 떠서, 상어 무대 마지막 장을 흐리고 어둡게 깐 위에 한 줄과 함께(11-06 Fable 「끝이 꺼진다 ·
    둘째 · 셋째 줄 판독 불가 · 「한 건물」이 떨어져 버그처럼」). 넓게 벌린 글줄 여러 개는 쓰지 않는다(끝 로고 메모)."""
    from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance
    tmp = tempfile.mkdtemp(prefix="끝카드_")
    run(["ffmpeg", "-v", "error", "-y", "-ss", "3.5", "-i", CARD, "-frames:v", "1", f"{tmp}/c.png"])
    run(["ffmpeg", "-v", "error", "-y", "-ss", "5.85", "-i", clip("E3"), "-frames:v", "1",
         "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}", f"{tmp}/b.png"])
    card = Image.open(f"{tmp}/c.png").convert("RGB")
    logo = card.crop((180, 720, 900, 1040))                       # 펠트 synk(1080×1920 판의 글자 상자 226~854 × 758~1000)
    mask = logo.convert("L").point(lambda v: 0 if v < 18 else min(255, int((v - 18) * 2.2)))
    bg = Image.open(f"{tmp}/b.png").convert("RGB").filter(ImageFilter.GaussianBlur(28))
    bg = ImageEnhance.Brightness(bg).enhance(0.32)
    font = ImageFont.truetype(f"{FONT}/SUIT-SemiBold.otf", 46) if os.path.exists(f"{FONT}/SUIT-SemiBold.otf") else ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 46)
    nfr = round(sec * FPS)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", END], stdin=subprocess.PIPE)
    line = "PULSE · SHIFT · LAB · PATH"
    for i in range(nfr):
        t = i / FPS
        a = min(1.0, t / 0.25)                                       # 로고는 0.25초에 떠오름(움직임 효과 없이)
        b = min(1.0, max(0.0, (t - 0.35) / 0.3))
        fr = bg.copy()
        fr.paste(logo, (180, 700), mask.point(lambda v: int(v * a)))
        d = ImageDraw.Draw(fr)
        tw = d.textlength(line, font=font)
        d.text(((W - tw) / 2, 1060), line, font=font, fill=(int(236 * b), int(230 * b), int(220 * b)))
        enc.stdin.write(fr.tobytes())
    enc.stdin.close()
    enc.wait()
    return END


def src_of(pic):
    if isinstance(pic, tuple):
        return {"file": lambda: pic[1], "title": lambda: TITLE, "card": lambda: CARD, "end": lambda: END}[pic[0]]()
    return clip(pic)


def video_frames(path, t0, nfr):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{t0:.3f}", "-i", path, "-vf",
                          f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},tpad=stop_mode=clone:stop_duration=5",
                          "-frames:v", str(nfr), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    n = W * H * 3
    got = 0
    last = None
    while got < nfr:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        last = b
        got += 1
        yield b
    p.stdout.close()
    p.wait()
    while got < nfr and last is not None:
        got += 1
        yield last


def read_wav(path):
    sr, x = wavfile.read(path)
    assert sr == SR, (path, sr)
    x = x.astype(np.float32) / 32768.0
    return x if x.ndim == 2 else np.stack([x, x], 1)


def to_wav(src, out, t0=0.0, dur=None):
    a = ["ffmpeg", "-v", "error", "-y", "-ss", f"{t0:.3f}", "-i", src]
    if dur:
        a += ["-t", f"{dur:.4f}"]
    run(a + ["-vn", "-af", "aresample=48000,aformat=channel_layouts=stereo", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", out])


def db2(g):
    return 10 ** (g / 20)


def lowpass(x, hz):
    sos = butter(4, hz, btype="low", fs=SR, output="sos")
    return sosfiltfilt(sos, x, axis=0).astype(np.float32)


def lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=framelog=quiet", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)[-1])


def place(mix, song, s0, t0, t1, gain_pts, lp_mix=None, lp_hz=700):
    """곡의 s0초부터를 편집 t0~t1초에. gain_pts [(편집 초, dB)], lp_mix [(편집 초, 0~1)] 1이면 먹먹."""
    a, b = int(round(t0 * SR)), int(round(t1 * SR))
    i0 = int(round(s0 * SR))
    seg = song[i0:i0 + (b - a)].copy()
    n = len(seg)
    if n <= 0:
        return
    tt = t0 + np.arange(n) / SR
    g = db2(np.interp(tt, [p[0] for p in gain_pts], [p[1] for p in gain_pts])).astype(np.float32)
    if lp_mix:
        wet = lowpass(seg, lp_hz)
        m = np.interp(tt, [p[0] for p in lp_mix], [p[1] for p in lp_mix]).astype(np.float32)[:, None]
        seg = seg * (1 - m) + wet * m
    mix[a:a + n] += seg * g[:, None]


def ts(x):
    h = int(x // 3600)
    mm = int(x % 3600 // 60)
    s = x % 60
    return f"{h}:{mm:02d}:{s:05.2f}"


def build(cuts, sfx, floors, music, out, fast=False, amb=None):
    tmp = tempfile.mkdtemp(prefix="가편집11_")
    vid = f"{tmp}/v.mp4"
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "veryfast" if fast else "medium", "-crf", "17", "-pix_fmt", "yuv420p", vid],
                           stdin=subprocess.PIPE)
    timeline, t = [], 0.0
    voice_parts = []
    for i, (name, pic, t0, dur, snd, sub) in enumerate(cuts):
        nfr = round(dur * FPS)
        real = nfr / FPS
        src = src_of(pic)
        zm = ZOOM.get(name)
        for k_, b in enumerate(video_frames(src, t0, nfr)):
            if zm:   # 디지털 줌 — 가운데를 잡고 배율을 처음 → 끝으로(빨라지며)
                from PIL import Image
                u = (k_ / max(1, nfr - 1)) ** 2
                z = zm[0] + (zm[1] - zm[0]) * u
                im = Image.frombytes("RGB", (W, H), b)
                w_, h_ = W / z, H / z
                l_ = min(max(0, zm[2] * W - w_ / 2), W - w_)
                t_ = min(max(0, zm[3] * H - h_ / 2), H - h_)
                b = im.resize((W, H), Image.BICUBIC, box=(l_, t_, l_ + w_, t_ + h_)).tobytes()
            enc.stdin.write(b)
        if snd:
            w = f"{tmp}/a{i:03d}.wav"
            try:
                if isinstance(snd, tuple) and snd[0] == "from":       # 화면 밖 대사 판의 소리(음수 = 컷 시작 뒤에 말이 시작)
                    so = snd[2]
                    to_wav(clip(snd[1]), w, max(0.0, so), real)
                    x = read_wav(w)
                    if so < 0:
                        x = np.concatenate([np.zeros((int(-so * SR), 2), np.float32), x])
                else:
                    to_wav(src, w, t0, real)
                    x = read_wav(w)
            except SystemExit:
                x = np.zeros((0, 2), np.float32)
            n = int(round(real * SR))
            x = np.pad(x[:n], ((0, max(0, n - len(x[:n]))), (0, 0)))
            k = int(0.008 * SR)                       # 컷 경계 딸깍 막기
            x[:k] *= np.linspace(0, 1, k)[:, None]
            x[-k:] *= np.linspace(1, 0, k)[:, None]
            if snd == "amb":
                x *= db2(-14)
            if name in GAIN:
                x *= db2(GAIN[name])
            voice_parts.append((t, x, snd))
        timeline.append({"컷": name, "판": pic if isinstance(pic, str) else pic[0], "판안": round(t0, 3), "시작": round(t, 3), "길이": round(real, 3),
                         "소리": snd or "", "자막": sub or ""})
        print(f"{i:03d} {t:7.3f} {real:5.2f}s {name}  ←  {pic if isinstance(pic, str) else pic[0]} @{t0:.2f}", flush=True)
        t += real
    enc.stdin.close()
    enc.wait()
    total = t
    N = int(round(total * SR)) + SR
    D = np.zeros((N, 2), np.float32)      # 대사 · 판 소리
    for t0, x, _ in voice_parts:
        a = int(round(t0 * SR))
        D[a:a + len(x)] += x[:N - a]
    at = {r["컷"]: r for r in timeline}

    def T(cut, off=0.0):
        return at[cut]["시작"] + off

    # 효과음
    F = np.zeros_like(D)
    for cut, off, fx, g in sfx:
        if cut not in at:
            continue
        p = f"{SFXD}/{fx}" if not os.path.isabs(fx) else fx
        w = f"{tmp}/fx.wav"
        to_wav(p, w)
        x = read_wav(w)
        # 효과음 판은 앞에 빈자리가 있다 — 봉우리 −1 dBFS로 맞추고 어택(봉우리의 −30 dB를 처음 넘는 곳)을 그 시각에
        pk = np.abs(x).max() + 1e-9
        x = x / pk * db2(-1)
        env = np.abs(x).max(axis=1)
        on = int(np.argmax(env > db2(-31)))
        x = x[max(0, on - int(0.01 * SR)):] * db2(g)
        a = int(round(T(cut, off) * SR))
        F[a:a + len(x)] += x[:N - a]
    # 공간음 깔개 — 고리 파일을 이어 붙여 그 구간에, 양끝 0.25초 경사
    for c0, c1, fx, g in (amb or []):
        if c0 not in at or c1 not in at or not os.path.exists(f"{SFXD}/{fx}"):
            continue
        w = f"{tmp}/amb.wav"
        to_wav(f"{SFXD}/{fx}", w)
        x = read_wav(w)
        a, b = int(round(T(c0) * SR)), int(round((at[c1]["시작"] + at[c1]["길이"]) * SR))
        n = b - a
        x = np.tile(x, (n // len(x) + 1, 1))[:n]
        x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * db2(g)        # RMS 기준으로 맞춤
        k = min(int(0.25 * SR), n // 2)
        x[:k] *= np.linspace(0, 1, k)[:, None]
        x[-k:] *= np.linspace(1, 0, k)[:, None]
        F[a:a + n] += x * db2(6)     # F는 아래에서 −6 dB로 섞이므로 그만큼 미리 올림
    # 음악
    Mx = np.zeros_like(D)
    if music:
        music(Mx, T, at, read_wav, lufs)
    # 대사 밑 음악 낮추기 — 대사 컷마다 말소리 크기보다 12 dB 아래
    duck = np.zeros(N, np.float32)
    for r in timeline:
        if r["소리"] and r["소리"] != "amb" and r["자막"]:
            a, b = int(r["시작"] * SR), int((r["시작"] + r["길이"]) * SR)
            mus = 20 * np.log10(np.sqrt(np.mean(Mx[a:b] ** 2)) + 1e-9)
            v = D[a:b].mean(axis=1)
            f = int(0.05 * SR)
            e = np.sqrt(np.mean(v[: (len(v) // f) * f].reshape(-1, f) ** 2, axis=1) + 1e-12) if len(v) >= f else np.array([1e-6])
            e = np.sort(e)[len(e) // 2:]
            sp = 20 * np.log10(np.sqrt(np.mean(e ** 2)) + 1e-9)
            duck[a:b] = float(np.clip(sp - 12 - mus, -20, -4))
    k = int(0.15 * SR)
    duck = np.convolve(duck, np.ones(k, np.float32) / k, mode="same")
    mixed = D + F * db2(-6) + Mx * db2(duck)[:, None]
    mixed = mixed[: int(round(total * SR))]
    pk = float(np.abs(mixed).max())
    if pk > 0.99:
        mixed *= 0.99 / pk
    mw = f"{tmp}/mix.wav"
    wavfile.write(mw, SR, (np.clip(mixed, -1, 1) * 32767).astype(np.int16))
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", mw, "-af", "loudnorm=I=-14:TP=-2.0:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    mj = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    ln = (f"loudnorm=I=-14:TP=-2.0:LRA=11:measured_I={mj['input_i']}:measured_TP={mj['input_tp']}:measured_LRA={mj['input_lra']}:"
          f"measured_thresh={mj['input_thresh']}:offset={mj['target_offset']}:linear=true")
    norm = f"{tmp}/norm.wav"
    run(["ffmpeg", "-y", "-v", "error", "-i", mw, "-af", ln, "-ar", str(SR), "-c:a", "pcm_s16le", norm])

    # 글자 — 대사 자막(한 화면 한 문장, 어두운 바탕 · 얼굴 아래) · 층 꼬리표 · 화면판 · VR 단계
    ass = ["[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 0", "ScaledBorderAndShadow: yes", "",
           "[V4+ Styles]",
           "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
           "Style: Line,SUIT Bold,58,&H00FFFFFF,&H00FFFFFF,&H5A0F0D0C,&H5A0F0D0C,0,0,0,0,100,100,0,0,3,16,0,2,80,80,300,1",
           "Style: FloorNum,SUIT ExtraBold,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,0,0,7,0,0,0,1",
           "Style: FloorName,SUIT ExtraBold,104,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,2,0,1,0,3,7,0,0,0,1",
           "Style: FloorLine,SUIT SemiBold,44,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,0,2,7,0,0,0,1",
           "Style: Shade,SUIT,10,&H00000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1",
           "Style: Stage,SUIT ExtraBold,52,&H00FFFFFF,&H00FFFFFF,&H006A8F5E,&H006A8F5E,0,0,0,0,100,100,1,0,3,18,0,5,60,60,0,1",
           "Style: Screen,SUIT Bold,34,&H00603A1E,&H00603A1E,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1",
           "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    for r in timeline:
        if r["자막"]:
            s0, d = r["시작"], r["길이"]
            for j, line in enumerate(r["자막"].split("|")):          # 「|」로 나눈 줄은 같은 컷 안에서 차례로
                parts = r["자막"].split("|")
                a_ = s0 + d * j / len(parts)
                b_ = s0 + d * (j + 1) / len(parts)
                ass.append(f"Dialogue: 5,{ts(a_ + 0.04)},{ts(b_ - 0.02)},Line,,0,0,0,,{line}")
    for c0, c1, num, nm, line, col in floors:
        if c0 not in at or c1 not in at:
            continue
        a_ = at[c0]["시작"] + 0.10
        b_ = min(at[c1]["시작"] + at[c1]["길이"], a_ + 2.8, max(at[c0]["시작"] + at[c0]["길이"] - 0.05, a_ + 1.4))
        # 위쪽 어두운 그늘(얼굴 위 빈 벽에만 닿게 높이 520까지) → 층 칩 → 이름 → 한 줄
        ass.append(f"Dialogue: 1,{ts(a_)},{ts(b_)},Shade,,0,0,0,,{{\\pos(0,0)\\fad(200,300)\\blur60\\1a&H88&\\p1}}m 0 0 l 1080 0 l 1080 420 l 0 420{{\\p0}}")
        ass.append(f"Dialogue: 2,{ts(a_)},{ts(b_)},Shade,,0,0,0,,{{\\pos(72,196)\\fad(150,300)\\c&H{col}&\\p1}}m 14 0 l 106 0 b 114 0 120 6 120 14 l 120 62 b 120 70 114 76 106 76 l 14 76 b 6 76 0 70 0 62 l 0 14 b 0 6 6 0 14 0{{\\p0}}")
        ass.append(f"Dialogue: 3,{ts(a_)},{ts(b_)},FloorNum,,0,0,0,,{{\\an5\\pos(132,235)\\fad(150,300)}}{num}")
        ass.append(f"Dialogue: 3,{ts(a_ + 0.08)},{ts(b_)},FloorName,,0,0,0,,{{\\an4\\move(226,238,218,238,0,260)\\fad(180,300)}}{nm}")
        if line:
            ass.append(f"Dialogue: 3,{ts(a_ + 0.22)},{ts(b_)},FloorLine,,0,0,0,,{{\\an7\\pos(76,300)\\fad(220,300)}}{line}")
    for r in timeline:
        s0, d = r["시작"], r["길이"]
        if r["컷"] in STAGES:
            top, bottom = STAGES[r["컷"]]
            ass.append(f"Dialogue: 4,{ts(s0 + 0.05)},{ts(s0 + d)},Stage,,0,0,0,,{{\\pos(540,560)}}{top}")
            ass.append(f"Dialogue: 4,{ts(s0 + min(0.6, d * 0.55))},{ts(s0 + d)},Stage,,0,0,0,,{{\\pos(540,680)\\fs44\\3c&H4A62D9&\\4c&H4A62D9&\\fscx130\\fscy130\\t(0,120,\\fscx100\\fscy100)}}{bottom}")
            if r["컷"].startswith("P2b"):
                ass.append(f"Dialogue: 4,{ts(s0 + d - 0.35)},{ts(s0 + d + 0.25)},Stage,,0,0,0,,{{\\pos(540,560)}}FINAL STAGE · 면접")
        if r["컷"] in SCREEN:
            x_, y_, nums = SCREEN[r["컷"]]
            for j, num in enumerate(nums):
                a_ = s0 + 0.1 + j * (d - 0.1) / len(nums)
                ass.append(f"Dialogue: 4,{ts(a_)},{ts(a_ + (d - 0.1) / len(nums))},Screen,,0,0,0,,{{\\pos({x_},{y_})\\fry16}}오늘 AI가 끝낸 일\\N{{\\fs96\\b1}}{num}")
    ap = f"{tmp}/s.ass"
    open(ap, "w", encoding="utf-8-sig").write("\n".join(ass) + "\n")
    sub_f = ap.replace("\\", "/").replace(":", "\\:")
    fd = FONT.replace("\\", "/").replace(":", "\\:")
    run(["ffmpeg", "-v", "error", "-y", "-i", vid, "-i", norm, "-map", "0:v", "-map", "1:a", "-vf", f"subtitles='{sub_f}':fontsdir='{fd}'",
         "-c:v", "libx264", "-preset", "veryfast" if fast else "medium", "-crf", "19", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-shortest", out])
    phone = out[:-4] + "_폰용.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-i", out, "-vf", "scale=720:1280:flags=lanczos", "-c:v", "libx264", "-preset", "medium", "-crf", "27",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", phone])
    json.dump(timeline, open(out[:-4] + "_시간표.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("끝", round(total, 2), "초 →", out)
    return timeline


# ── SNS 30초 판 — 콜드 오픈 → 어깨빵 · 풍덩 → 건물 → 층마다 한 컷(꼬리표) → 4층 대답 셋 → 춤추는 상어 → 로고 ──
CUTS_SNS = [
    ("C1 「왜 늦었어요?」", "O5", 2.10, 1.75, ("from", "F1", 0.00), "왜 늦었어요?"),
    ("C2 「…상어랑 어깨빵했어요.」", "F2", 2.00, 1.85, V, "…상어랑 어깨빵했어요."),
    ("O2-O3 어깨빵", "O2-O3", 3.30, 0.75, None, ""),
    ("O4 슬로모션", "O4", 0.30, 1.30, None, ""),
    ("O6 바닥으로", "O6", 0.40, 1.00, None, ""),
    ("O9 풍덩", "O9", 0.00, 1.00, None, ""),
    ("T0 드론 상승 · 건물", "T0", 1.20, 2.00, None, ""),
    ("S2e 옷 교차 몽타주(v20)", ("file", S2UP), 4.46, 2.00, None, ""),
    ("2C4 인사 러시아어", "2C4", 0.00, 1.00, None, ""),
    ("2C1 인사 몽골어", "2C1", 0.00, 1.00, None, ""),
    ("L1-L2 「어. 서. 오. 세. 요~!」", "L1-L2", 2.80, 2.00, V, "어. 서. 오. 세. 요~!"),
    ("P3-P4 VR 방 · 거짓말 감지", "P3-P4", 2.40, 1.20, None, ""),
    ("P7 반전 · 빈 의자에 절", "P7", 0.60, 1.20, None, ""),
    ("F4 「수영 잘해요?」", "F3-F4", 2.25, 1.80, V, "수영 잘해요?"),
    ("F6 「…아니요.」", "F6", 1.90, 1.70, V, "…아니요."),
    ("F7 「솔직해서, 합격.」", "F7", 0.00, 3.20, ("from", "말-면접관", 0.60), "솔직해서, 합격."),
    ("E3 상어 머리 착지 · 무대", "E3", 2.50, 2.00, None, ""),
    ("TAIL 로고", ("end",), 0.00, 2.20, None, ""),
]
SFX_SNS = [s for s in SFX_FULL if s[0] in {c[0] for c in CUTS_SNS}]
AMB_SNS = [("C1 「왜 늦었어요?」", "C2 「…상어랑 어깨빵했어요.」", "amb_room_1.mp3", -30), ("F4 「수영 잘해요?」", "F7 「솔직해서, 합격.」", "amb_room_1.mp3", -30)]
FLOORS_SNS = [
    ("S2e 옷 교차 몽타주(v20)", "S2e 옷 교차 몽타주(v20)", "1F", "PULSE", "광고 · 뮤직비디오 · AI 모델", "4A2398"),
    ("2C4 인사 러시아어", "2C1 인사 몽골어", "2F", "SHIFT", "회사 일을 대신하는 AI", "8A4520"),
    ("L1-L2 「어. 서. 오. 세. 요~!」", "L1-L2 「어. 서. 오. 세. 요~!」", "3F", "LAB", "게임으로 배우는 한국어", "4A62D9"),
    ("P3-P4 VR 방 · 거짓말 감지", "P7 반전 · 빈 의자에 절", "3F", "PATH", "한국 유학 · 취업을 VR로 미리", "5E8A6A"),
    ("F4 「수영 잘해요?」", "F7 「솔직해서, 합격.」", "4F", "면접실", "", "3A3A3A"),
]


def music_sns(mix, T, at, read_wav, lufs):
    """M2 하나로 — 어깨빵에서 들어와 4층에서 숨죽였다가 상어 무대에서 후렴."""
    s2 = read_wav(M2)
    g2 = -16.0 - lufs(M2)
    a = T("O2-O3 어깨빵", 0.20)
    f4 = T("F4 「수영 잘해요?」")
    e3 = T("E3 상어 머리 착지 · 무대")
    hit = at["TAIL 로고"]["시작"]
    end = hit + at["TAIL 로고"]["길이"]
    place(mix, s2, 0.0, a, f4, [(a, g2), (f4 - 0.4, g2), (f4, -120)])
    off = hit - 96.20                    # 마지막 후렴이 끝 카드 첫 장에 터지고 카드 끝까지(전체판과 같음)
    place(mix, s2, e3 - off, e3, end, [(e3, g2), (end - 0.8, g2), (end, -40)])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--판", default="full", choices=["full", "sns"])
    ap.add_argument("--빠르게", action="store_true")
    a = ap.parse_args()
    make_endcard()
    if a.판 == "full":
        build(CUTS_FULL, SFX_FULL, FLOORS_FULL, music_full, f"{OUTD}/가편집11_전체.mp4", a.빠르게, AMB_FULL)
    else:
        build(CUTS_SNS, SFX_SNS, FLOORS_SNS, music_sns, f"{OUTD}/가편집11_SNS30.mp4", a.빠르게, AMB_SNS)


if __name__ == "__main__":
    main()

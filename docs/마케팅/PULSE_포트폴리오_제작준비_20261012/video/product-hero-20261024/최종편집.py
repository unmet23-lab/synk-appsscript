# 1번 오미톡 캔 최종 편집(2026-11-05, Claude) — 02_콘티 4절 6컷을 하드컷으로 잇고, 음악 · 효과음을 놓고, 끝 글자를 얹는다.
#   python -X utf8 최종편집.py [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/p1/오미톡_9x16.mp4 · _폰.mp4 · _반초.jpg
# 컷 경계는 원본 샷표(30fps 1.133 · 4.433 · 8.800 · 10.967 · 13.133 · 15.367초)를 24fps 프레임으로 옮긴 값이다 — 시댄스 판이 24fps라 전체를 24fps로 찍는다.
# 후보정 없음(결정 10-24): 색 · 속도 손질 없이 프레임 번호로만 자른다. 영상 모델 소리는 쓰지 않는다(판이 모두 소리 끔).
# 판: 11-05 시작 그림을 GPT 이미지 2.5로 다시 구워(블렌더 판은 구도 참고) MonoGPT 시댄스 2.5로 낸 판 — 블렌더 줄기 · 얼음이 CG로 읽혀 드롭이 싸 보였다(02_콘티 11절 · 결정 표).
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
OUT = ROOT + "/최종/p1"
SFX = ROOT + "/최종/음악/p1_효과음/"
FAIR = ROOT.replace("pulse-portfolio12-20261024", "sound-library") + "/fairlight/Media Files/"
FPS, W, H = 24, 1080, 1920

# 곡(MonoGPT Suno v5.5, 109 BPM 연주곡) — 재어 보니 박 0.5483초(109.4 BPM), 드롭 첫 박이 곡 8.805초로 원본 컷 격자와 거의 같다.
# 곡의 드롭을 4번 컷 첫 프레임에 맞추고, 컷 경계는 그 격자에 가장 가까운 프레임으로 둔다(콘티 4절 2 · 8 · 16 · 20 · 24 · 28박)
MUSIC = ROOT + "/최종/음악/p1_OmiDrop_A.mp3"
SONG_DROP = 8.805      # 곡 안 드롭 첫 박(고역 어택)
SONG_LAST_HIT = 25.796 # 곡 끝 마지막 타 — 이 뒤로 몸통이 0.58초 울리고 1.4초 꼬리
BEAT = 0.5483
# 마지막 타는 콘티 자리(8마디 첫 박 15.37초)이고, 그 뒤로 두 박을 더 둔다 — 심사 「글이 뜨자마자 꺼진다」. 원본은 이 자리에 검은 끝 카드 2초가 있는데 우리는 끝 그림을 그대로 둔다(카메라는 15.47초에 닿아 멈춤)
# 11-06 유호님 「첫 시작하자마자 2초정도는 너무 좋은데 그 뒤로 너무 늘어지는것같은데 ? … 오래 머물러있는 장면들이 오래 머무는 의미가 딱히 없어」 → 드롭 앞을 넉 마디에서 두 마디(8박 · 4.39초)로:
# 2번 접사 3.3초 → 두 박, 3번 초점 넘김 4.4초 → 네 박. 곡은 셋째 마디 첫 박부터 튼다(드롭까지 그대로). 끝은 마지막 타 뒤 「오미톡」 말이 들어가도록 세 박.
F = [0, 27, 53, 105, 131, 210, 302]   # 컷 경계 프레임(24fps). 옛 판(16.46초)은 [0, 27, 106, 211, 237, 316, 395]
DROP = F[3] / FPS


def beat(k):
    # 드롭을 0으로 센 박의 화면 시각
    return DROP + k * BEAT


# 컷 번호 → (판 차례, 그 판에서 시작하는 프레임). 한 컷을 토막 내면 [(판 차례, 시작, 장수, 자르기 칸), …]
C5_ICE = 14      # 5번 컷 안 얼음 물보라 토막 시작 — 물이 튀는 12장이 드롭 네 박(263.6장)에 오도록 13 → 14
# 차오름 토막(p1-05k)은 Fable 2차 「물보라 최고점에서 잔잔한 수면으로 끊기고 0.75초가 아무 일 없다」로 뺐다 — 물보라 판을 왕관 · 무너짐 · 물기둥까지 잇는다
ICE_FROM = 0
ICE_HIT = (12 - ICE_FROM) / 24       # 얼음 둘레로 물이 튀기 시작하는 때(물보라 토막 안 초, p1-05p__2 12장)
SPLASH_BACK = (42 - ICE_FROM) / 24   # 왕관이 무너져 수면으로 내려앉는 때(42~46장)
PLIP = (48 - ICE_FROM) / 24          # 가운데 물기둥이 솟는 때(46~50장) — 실제 물에서 「퐁」이 나는 자리
C2_FROM = 14                         # 2번 접사는 두 박만 — 큰 물방울이 흐르기 시작하는 20장 바로 앞부터
DRIP_START = (20 - C2_FROM) / 24     # 2번 컷 안에서 물방울이 움직이기 시작하는 때
CUT3_FROM = 28                       # p1-03i__2 네 박: 캔이 또렷한 끝(28~40장) → 초점이 넘어감(40~72장) → 잔이 또렷(72~80장). 앞 8장 · 120장은 원래 안 씀
GLASS_FOCUS = (74 - CUT3_FROM) / 24  # 3번 컷에서 초점이 잔에 닿는 때(p1-03i__2 40~76장)
CUTS = {
    1: (("p1-01c",), 0),            # d(캔이 일찍 또렷)는 뚜껑이 느려 컷 끝에도 엠블럼이 반만 나오고 뚜껑 밑에 없던 홈이 생겨 안 쓴다 — c는 끝까지 조금 흐리지만 원본도 그렇다
    2: (("p1-02e", "p1-02d"), C2_FROM),   # d: 첫 · 끝 그림을 한 사진에서 잘라 카메라를 묶은 판(첫끝자르기.py). c는 다가감이 17.5%로 콘티 6.6%의 2.6배였다
    # 3번 컷: 유호님 11-05 「똑같은 캔이라 … 맹한느낌」 → 열매 컷은 「엥두가 너무 뜬금없이 … 억지로 만든 슬롭」으로 버림 → 시안을 거쳐 「E-2로」. 캔에서 오미자 · 레몬 잔으로 초점이 넘어가는 한 판(드리미나 시댄스 2.5 첫 · 끝 프레임).
    # p1-03g는 유호님 「컵이 자기 혼자 조금 움직이고 컵 내용물이 움직여」 — 84~100장에 배경은 멈췄는데 잔만 18 px, 얼음 · 오미자 배치도 바뀌었다(지시문의 「열매가 까딱」, 처음 · 끝 그림의 잔 크기 1.7배 차이 탓).
    # h: 한 사진에서 초점만 바꾼 처음 · 끝 그림(어긋남 0~1 px) + 카메라 고정. 세 벌 모두 잔 · 내용물 · 캔 위치 변화가 거의 0 px(한 벌 레몬 1 px). __2는 캔이 42장까지 또렷하고 90장에 잔으로 넘어가 시점이 알맞다(첫 벌은 28장부터 흐려지고 셋째는 잔이 104장 뒤에야 또렷).
    # 11-06 Fable 7차 「카탈로그 2샷 · 줄무늬 배경이 앞뒤와 달라 다른 날 촬영분」 → 배경 시안 A · B 중 유호님 「B로 구워」: 같은 구도의 배경만 4 · 5번 컷의 빛 막대로 바꾼 i.
    # i 세 벌 모두 잔 · 내용물 · 캔 위치 0 px, 배경은 초점이 넘어가며 2~4 px(렌즈 숨쉬기 정도). __2는 캔이 40장까지 또렷하고 72장에 잔이 또렷 — 첫 벌은 캔이 16장부터 흐려지고 셋째는 잔이 88장 뒤에야 또렷.
    3: (("p1-03i__2",), CUT3_FROM),
    # h: 입구 전체에서 세차게 쏟아진다(흐름 초당 126 px, 원본 47). 처음 14장은 매끈하다가 출렁이기 시작해 그 뒤부터 쓴다. 11-05 오후부터 두 박(26장)만 쓴다.
    # e는 유호님 11-05 「물 떨어지는데가 좀 부자연스럽거든」 — 줄기 옆 방울이 공중에 떠 있거나 위로 올라가고 입구가 비어 아래 턱에서만 얇게 나왔다. d · c는 젤리 · 리본
    # 11-05 밤 Fable 맹검 3차 「검붉고 시럽처럼 … 와인 · 시럽으로 읽히고」(h · f는 줄기가 어둡고 기포가 없다) · 유호님 「응, 구워」 → 밝은 탄산 시작 그림 c4_E2로 다시. i__2는 첫 26장이 가는 줄기에 기포가 초당 157~253 px로 내려간다(h 같은 자리 105~226).
    # i는 12장부터 줄기가 호스처럼 꺾이고, j(시작 그림 c4_E1)는 초당 30~40 px로 느리다. i__2도 27장 뒤로는 입구 쪽이 부풀어 앞 26장만 쓴다.
    # 같은 밤 유호님 「응, 맞춰 구워」 — i__2는 색상이 −18°로 자홍 쪽이었다(잔 · 물보라 −4°, 꽂힘 줄기 −10°, 지시문의 raspberry 탓). 시작 그림 c4_F2로 색을 맞춘 l은 0~−2°, 첫 26장 흐름 초당 180~243 px.
    # 같은 시작 그림 계열 k 두 벌은 「폭이 그대로 · 부풀지 않게」를 세게 써서 줄기가 초당 10~19 px로 거의 멈췄다.
    # l은 남색 앞이라 어둡고(밝기 111~115, 꽂힘 줄기 158) 입구가 접히고 거품 띠가 띠째 내려와 Fable 5차 「원액」 → 시안을 거쳐 유호님 「빛 막대 배경」. m__3은 5번 컷과 같은 빛 막대 앞에서 색상 −8° · 밝기 150, 접힘 · 띠 없음.
    # m 세 벌 다 부드럽고 느린 쪽이다. 그중 __3은 줄기 가운데 무늬가 초당 약 48 px로 실제로 내려가고(m은 제자리에서 일렁임) 변화량이 __2보다 조금 크다.
    4: ((os.environ.get("P1_CUT4", "p1-04m__3"),), int(os.environ.get("P1_CUT4_FROM", "0"))),
    # 5번 컷은 박에 맞춰 두 토막: e 13장(한 박, 줄기가 파고들며 기포 구름이 핀다) + k 39장(세 박, 줄기 없이 잔물결 치며 차오르고 얼음이 떠올라 모서리가 수면을 뚫는다).
    # 유호님 11-05 「담길때 이 모습이 부자연스러워서」 — 옛 d는 빈 유리에 기포가 뜨고 줄기가 막대처럼 꽂히고 수면이 납작했다.
    # 시댄스는 줄기 닿는 자리를 1초 넘게 살려 두지 못한다(e · f는 뒤로 갈수록 거품 언덕 위에 얹히고, g는 거의 멈추고, h는 유리 막대가 되고 물방울이 위로 뜬다) — 그래서 줄기는 한 박만 쓴다.
    # 뒤 토막: i는 위에서 가는 줄기가 튀어나오고, j는 수면이 왼쪽 한 자리에서 봉긋 자라기만 하고 얼음이 잠겨 맹검 「고치고 통과」, l은 오른쪽 가에 줄기가 보였다.
    # k 앞 16장은 오른쪽 가 아래에 붉은 세로 띠(시작 그림에 있던 것)가 남아 뺀다. 판이 720×1278이라 9:16로 1 px씩 잘라 늘림을 없앤다.
    # 11-05 오후: 줄인 붓기 뒤에 얼음이 잔에 떨어지며 물보라가 튀는 판을 넣었다 — 유호님 「효과음이나 cg같은걸 추가해서 하면 훨씬 재밌을거라고」.
    # 11-05 밤: Flow 판(p1-05n)을 드리미나 시댄스 2.5 판으로 바꿈. __2는 물이 튀기 전 얼음이 파고들고, 왕관이 44장까지 버티고, 물기둥이 솟아 끝(64장)에 방울이 맺힌 채 컷. 첫 벌은 왕관이 한 번에 무너진다.
    5: [(("p1-05e",), 0, C5_ICE, None), (("p1-05p__2",), ICE_FROM, 79 - C5_ICE, None)],
    6: (("p1-06e", "p1-06d"), 0),   # e: 짙은 파랑 + 네온 테두리. d: 첫 · 끝 그림으로 묶음. c는 카메라가 콘티와 반대로 가서 낱말표가 잘리고 작은 한글이 「지통」으로 깨졌다
}

# 끝 글: 11-06 유호님 「"다섯 가지 맛, 톡" 이거 좀 짜친다. cg나 더 세련되게 타이포그래피를 써줘야해」(슬롭 점검표 24번) — 글로 친 「다섯 가지 맛,」은 빼고 내레이션이 말한다.
# 화면에는 그린 「톡」 마크(라벨/톡마크.py — ㅗ 세로획 자리가 라벨 i 점과 같은 빨간 열매 점) 하나: 획 셋이 한 박 앞에 끊어 들어오고, 빨간 점이 기포처럼 떠올라 마지막 타에 박힌다.
TOK_STROKES = beat(11)
TEXT_TOK = beat(12)
TOK_POS = (885, 300, 400)   # 마크 가운데 x · y · 높이(1080×1920) — 캔 모서리 네온 위 남색 자리. Fable 맹검 「세련됐지만 소심하다」로 330 → 400

# 내레이션: 일레븐 v4 Mr. K 한 번에 구운 판에서 낱말을 잘라 박에 놓는다(유호님 11-06 「나레이션을 추가해보자」 → 「남자」).
# 첫 원고 「달고, 시고, 쓰고, 짜고, 맵고」는 유호님 「너무 뒤죽박죽인데 … 쓰고, 맵고를 다른거로 대체하거나」로 버렸다 — 맛있게 들리는 셋(새콤 · 달콤 · 쌉싸름)을
# 두 박에 하나씩 컷이 바뀌는 자리에(접사 · 초점이 넘어가기 시작 · 잔이 또렷), 드롭 뒤는 효과음만, 끝에서 「다섯 가지 맛이, 한 캔에. 톡! 오미톡.」으로 받는다.
NARR_FILE = ROOT + "/소리/p1/내레이션후보_20261106/" + os.environ.get("P1_NARR", "MrK2_1") + ".mp3"
NARR_CUTS = {   # (파일 안 시작, 끝) — 소리 덩이는 -38 dB 문턱으로 잼
    "MrK2_1": [(0.00, 0.68), (1.18, 1.86), (2.36, 3.06), (3.62, 5.34), (5.78, 6.16), (6.60, 7.24)],
}
NARR_AT = [("새콤", beat(-6)), ("달콤", beat(-4)), ("쌉싸름", beat(-2)),
           ("다섯 가지 맛이, 한 캔에", beat(8.5)), ("톡", TEXT_TOK), ("오미톡", beat(13))]
NARR = [(w, a0, a1, at) for (w, at), (a0, a1) in zip(NARR_AT, NARR_CUTS[os.environ.get("P1_NARR", "MrK2_1")])]   # (낱말, 파일 안 시작, 끝, 화면 시각)
NARR_DB = -4


def picture():
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    paths = []
    for n, spec in CUTS.items():
        total = F[n] - F[n - 1]
        parts = spec if isinstance(spec, list) else [(spec[0], spec[1], total, None)]
        if sum(p[2] for p in parts) != total:
            raise SystemExit(f"#{n}: 토막 장수 합이 {total}장이 아니다")
        at = F[n - 1]
        for i, (ids, a, k, crop) in enumerate(parts):
            pid = C.latest(*ids)
            src = C.clip(pid)
            have = C.frames_of(src)
            if a + k > have:
                raise SystemExit(f"#{n} {pid}: {a}장부터 {k}장이 필요한데 {have}장뿐")
            out = os.path.join(d, f"{n:02d}{'abc'[i]}.mp4" if len(parts) > 1 else f"{n:02d}.mp4")
            C.cut_video(src, a, k, W, H, FPS, out, crop=crop)
            if C.frames_of(out) != k:
                raise SystemExit(f"{out}: {k}장이어야 하는데 {C.frames_of(out)}장")
            paths.append(out)
            print(f"#{n} {pid} {a}장부터 {k}장 → {at / FPS:.3f}~{(at + k) / FPS:.3f}초")
            at += k
    C.join_videos(paths, os.path.join(OUT, "화면.mp4"))


def cut(path, start, dur):
    # 파일마다 크기가 제각각이라(팅 -43 dB ~ 캔따기 -1.5 dB) 자른 구간의 봉우리를 1로 맞춘 뒤 차례표의 dB로 놓는다
    x = C.load(path)
    x = x[int(start * C.RATE):int((start + dur) * C.RATE)]
    return x / (float(np.max(np.abs(x))) or 1.0)


def music(total):
    # 곡 앞부분(드롭 뒤 마지막 타 자리까지) + 곡 끝 마지막 타 · 꼬리. 잇는 자리는 같은 박의 어택이라 8 ms만 겹친다
    s = C.load_stereo(MUSIC)
    R = C.RATE
    off = SONG_DROP - DROP
    join_film = TEXT_TOK
    a = s[int(off * R):int((join_film + off) * R)]
    n = int(0.008 * R)
    b = s[int((SONG_LAST_HIT - 0.008) * R):]
    a = a.copy()
    b = b.copy()
    a[-n:] *= np.linspace(1, 0, n)[:, None]
    b[:n] *= np.linspace(0, 1, n)[:, None]
    bed = np.concatenate([a[:-n], a[-n:] + b[:n], b[n:]])[:int(total * R) + 1]
    # 4마디 마지막 박은 비운다(콘티 · 원본의 드롭 앞 쉼) — 곡에 빈 박이 없어 여기서 내린다
    g = np.ones(len(bed), np.float32)
    i0, i1 = int(beat(-1) * R), int((beat(-1) + 0.03) * R)
    i2, i3 = int((DROP - 0.012) * R), int(DROP * R)
    g[i0:i1] = np.linspace(1, 0.02, i1 - i0)
    g[i1:i2] = 0.02
    g[i2:i3] = np.linspace(0.02, 1, i3 - i2)
    # 붓기 · 기포 컷에서는 음악을 조금 낮춰 사건 소리가 들리게 한다(첫 타는 그대로 두고 0.18초 뒤부터). 6번 컷에서 돌아온다
    i4, i5 = int((DROP + 0.18) * R), int((DROP + 0.26) * R)
    i6, i7 = int((F[5] / FPS - 0.06) * R), int(F[5] / FPS * R)
    g[i4:i5] = np.linspace(1, 0.66, i5 - i4)
    g[i5:i6] = 0.66
    g[i6:i7] = np.linspace(0.66, 1, i7 - i6)
    # 내레이션 아래에서는 음악을 5 dB 내린다(앞뒤 40 ms 기울기)
    duck = 10 ** (-5 / 20)
    r = int(0.04 * R)
    for _, a0, a1, at in NARR:
        j0, j1 = int((at - 0.05) * R), int((at + (a1 - a0) + 0.05) * R)
        g[j0:j1] = np.minimum(g[j0:j1], duck)
        g[max(0, j0 - r):j0] = np.minimum(g[max(0, j0 - r):j0], np.linspace(1, duck, j0 - max(0, j0 - r)))
        g[j1:j1 + r] = np.minimum(g[j1:j1 + r], np.linspace(duck, 1, len(g[j1:j1 + r])))
    bed *= g[:, None]
    bed[-int(0.25 * R):] *= np.linspace(1, 0, int(0.25 * R))[:, None]
    return bed


def fx(name):
    return C.load(SFX + name)


# 효과음 차례표 — (이름, 파일, 파일 안 시작 초, 길이, 화면 시각, 크기 dB, 끝 줄임 초). 어택 자리는 소리고르기.py로 재어 파일 안 시작 초에 적는다
# 파일: p1_효과음 = 일레븐랩스 효과음 v3(11-05 이 편용으로 생성), FAIR = 녹음 모음. 컷 2의 큰 물방울은 컷 안 0.85~2.75초에 흘러내린다(p1-02e를 프레임으로 잼)
EVENTS = [
    # 컷 1 — 걸쇠 「딸깍」(첫 프레임부터 뚜껑이 움직임) · 들리는 소리 · 찬 공기 · 얼음(캔이 드러나는 15장쯤)
    ("걸쇠", SFX + "뚜껑_3.wav", 0.00, 0.25, 0.00, -11, 0.10),
    ("들림", SFX + "뚜껑_1.wav", 0.55, 1.10, 0.06, -15, 0.30),
    ("찬 공기", SFX + "기포_3.wav", 2.00, 1.00, 0.20, -24, 0.40),
    ("얼음", SFX + "얼음_1.wav", 0.60, 0.70, 0.60, -11, 0.25),
    # 컷 2 — 또르르(물방울_3 어택 0.82초를 물방울이 움직이기 시작하는 자리에)
    ("또르르", SFX + "물방울_3.wav", 0.30, 1.40, F[1] / FPS + DRIP_START - 0.52, -21, 0.50),
    # 컷 3 — 카메라가 멈춰 있어 「휙」은 뺐다. 초점이 잔에 닿을 때 탄산이 사르르 올라오고 얼음이 한 번 달그락
    ("잔 탄산", SFX + "기포_3.wav", 2.00, 1.50, F[2] / FPS + GLASS_FOCUS - 0.35, -24, 0.50),
    ("잔 얼음", SFX + "얼음_1.wav", 0.60, 0.50, F[2] / FPS + GLASS_FOCUS, -19, 0.25),
    # 드롭 앞 빈 박 — 캔 따는 「칙」이 빈자리에 혼자 들리고 바로 터진다
    ("캔 따기", SFX + "캔따기_1.wav", 0.00, 0.30, beat(-0.5), -5, 0.12),
    ("치익", SFX + "기포_3.wav", 3.00, 0.30, beat(-0.5) + 0.05, -14, 0.05),
    # 컷 4 — 붓기(첫 프레임에 머리) 둘을 잇고 탄산을 깐다
    ("콸콸 1", SFX + "붓기_1.wav", 0.66, 1.40, DROP, -3, 0.40),
    ("콸콸 2", SFX + "붓기_3.wav", 0.80, 1.00, F[4] / FPS - 0.02, -4, 0.40),   # 꽂힘 첫 장
    ("치익 깔림", SFX + "기포_1.wav", 3.00, 2.40, DROP, -11, 0.30),   # 아르곤 1차 「치지직」(-8) · 2차 「묻힌다」(-16) 사이
    # 컷 5 — 줄기가 꽂히는 앞 토막부터 붓는 소리를 이어 차오르는 동안 잦아든다. 사르르를 깔고, 얼음이 보이는 첫 프레임(뒤 토막 시작)에 얼음 한 번
    ("사르르", SFX + "기포_3.wav", 2.00, 2.30, F[4] / FPS, -7, 0.40),
    # 얼음 물보라 — 얼음이 수면에 닿는 장에 첨벙(물보라) · 쨍(잔 속 얼음)을 함께
    ("첨벙", FAIR + "Water Splashing 2.M.wav", 0.71, 0.70, (F[4] + C5_ICE) / FPS + ICE_HIT, -6, 0.30),
    ("쨍", FAIR + "Ice Cubes Dropped in Glass.M.wav", 0.85, 0.45, (F[4] + C5_ICE) / FPS + ICE_HIT, -10, 0.25),
    ("철썩", FAIR + "Water Light Splashing.M.wav", 0.10, 0.60, (F[4] + C5_ICE) / FPS + SPLASH_BACK - 0.04, -12, 0.25),   # 왕관이 무너짐(파일 첫 어택 0.141초)
    ("방울 톡", SFX + "물방울_3.wav", 0.72, 0.45, (F[4] + C5_ICE) / FPS + PLIP - 0.10, -13, 0.25),   # 물기둥이 솟는 「퐁」(물방울_3 가장 큰 어택 0.82초)
    # 끝 — 마지막 타(곡)와 「톡」 글자가 같은 자리, 캔 따는 소리로 찍고 캔 두드림 · 유리 한 번. 그 뒤 곡 꼬리와 탄산만 남아 멈춘다
    ("톡 칙", SFX + "캔따기_1.wav", 0.00, 0.30, TEXT_TOK, -9, 0.12),   # 내레이션 「톡」과 겹쳐 4 dB 내림
    ("톡", FAIR + "Can Soda Pop Touches.M.wav", 0.91, 0.40, TEXT_TOK, -3, 0.20),
    ("팅", FAIR + "Glass Clink Toast.M.wav", 0.15, 0.40, TEXT_TOK, -11, 0.20),
    ("남은 탄산", SFX + "기포_1.wav", 6.00, 1.00, TEXT_TOK + 0.08, -13, 0.60),
]


def sound():
    total = F[-1] / FPS
    m = C.Mix(total)
    m.put(0, music(total), db=-2, fade=0.0)
    for name, path, start, dur, at, db, out in EVENTS:
        x = cut(path, start, dur)
        m.put(at, x, db=db, fade=0.004, fade_out=out)
    # 내레이션 — 쓰는 낱말들을 합친 RMS로 한 번에 맞춘다(목소리마다 원래 크기가 −19 ~ −26 LUFS로 달라 봉우리로 맞추면 크기가 갈린다). 낱말 사이 세기 차이는 그대로
    v = C.load(NARR_FILE)
    used = np.concatenate([v[int(a0 * C.RATE):int(a1 * C.RATE)] for _, a0, a1, _ in NARR])
    v = v * (0.12 / (float(np.sqrt(np.mean(used ** 2))) or 1.0))
    for name, a0, a1, at in NARR:
        m.put(at, v[int(a0 * C.RATE):int(a1 * C.RATE)], db=NARR_DB, fade=0.01, fade_out=0.05)
    m.finish(os.path.join(OUT, "소리.wav"), boost_db=0)


def tok_frames(d):
    # 「톡」 마크 장마다(1080×1920 RGBA) — 마크가 없는 장은 투명 한 장을 함께 쓴다
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "라벨"))
    import 톡마크 as T
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))
    cx, cy, h = TOK_POS
    ease = lambda u: 1 - (1 - max(0.0, min(1.0, u))) ** 3
    blank = None
    for i in range(F[-1]):
        t = i / FPS
        layer = np.zeros((1920, 1080, 4), np.uint8)
        if t >= TOK_STROKES:
            grow = 1.06 - 0.06 * ease((t - TOK_STROKES) / (6 / FPS))
            for k, name in enumerate(("ㅌ", "ㅗ", "ㄱ")):
                u = (t - TOK_STROKES - k * 2 / FPS) / (3 / FPS)
                if u <= 0:
                    continue
                m = T.draw(1080, 1920, cx, cy, h, parts=[name], dot_scale=0, scale=grow, alpha=min(1.0, u))
                a = m[..., 3:4].astype(np.float32) / 255
                layer[..., :3] = (layer[..., :3] * (1 - a) + m[..., :3] * a).astype(np.uint8)
                layer[..., 3] = np.maximum(layer[..., 3], m[..., 3])
            rise0 = TEXT_TOK - 5 / FPS
            if t >= rise0:
                u = (t - rise0) / (5 / FPS)
                dy = -2.4 * T.S * (1 - ease(u)) if u < 1 else 0.0
                pop = 1.0 if u < 1 else 1.0 + 0.28 * np.exp(-(t - TEXT_TOK) * 14) * np.cos((t - TEXT_TOK) * 22)
                m = T.draw(1080, 1920, cx, cy, h, parts=[], dot_scale=max(0.55, min(1.0, 0.55 + u * 0.45)) * pop, dot_dy=dy, scale=grow)
                a = m[..., 3:4].astype(np.float32) / 255
                layer[..., :3] = (layer[..., :3] * (1 - a) + m[..., :3] * a).astype(np.uint8)
                layer[..., 3] = np.maximum(layer[..., 3], m[..., 3])
        ok, buf = cv2.imencode(".png", layer)
        buf.tofile(os.path.join(d, f"{i:04d}.png"))


def render():
    pic = os.path.join(OUT, "화면.mp4")
    wav = os.path.join(OUT, "소리.wav")
    seq = os.path.join(OUT, "톡마크")
    tok_frames(seq)
    raw = os.path.join(OUT, "_합침.mp4")
    b = TEXT_TOK
    # 마지막 타에 화면이 2.5% 밀렸다 돌아온다(옛 판 그대로). 「톡」 마크는 화면에 붙은 글자라 밀리지 않는다
    S = f"(1+0.025*gte(t,{b:.4f})*exp(-max(0,t-{b:.4f})*10))"
    vf = (f"[0:v]scale=w='trunc(1080*{S}/2)*2':h='trunc(1920*{S}/2)*2':eval=frame:flags=lanczos,crop=1080:1920:(iw-1080)/2:(ih-1920)/2[p];"
          f"[1:v]format=rgba[k];"
          f"[p][k]overlay=0:0:shortest=1,scale=out_color_matrix=bt709,format=yuv420p[v]")
    C.run("ffmpeg", "-y", "-v", "error", "-i", pic, "-framerate", str(FPS), "-i", os.path.join(seq, "%04d.png"),
          "-filter_complex", vf, "-map", "[v]", "-frames:v", str(F[-1]), "-c:v", "libx264", "-crf", "14", "-preset", "medium", "-r", str(FPS),
          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", raw)
    tmp = os.path.join(OUT, "_소리붙임.mp4")
    C.run("ffmpeg", "-y", "-v", "error", "-i", raw, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-shortest", tmp)
    out = os.path.join(OUT, os.environ.get("P1_NAME", "오미톡_9x16") + ".mp4")
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), tmp, out, "--리미터", "0.78", "--덮어쓰기")   # 11-05 오후 물보라 소리를 넣자 0.8로는 최대 -1.1 dBFS
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", os.path.join(OUT, os.environ.get("P1_NAME", "오미톡_9x16") + "_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=200:-2,tile=8x4:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_반초.jpg"))
    print(out)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for w in sys.argv[1:] or ["화면", "소리", "판"]:
        {"화면": picture, "소리": sound, "판": render}[w]()

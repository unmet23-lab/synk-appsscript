# 10번 도담중공업 「이 아이를 보냅니다」 최종 편집(2026-11-07, Claude) — 02_콘티 2절 37컷을 원본(GE Aerospace 「Emotional Launch」) 시각 그대로 하드컷으로 잇고,
# 31 → 32만 원본처럼 0.12초 밝기 램프, 위아래 띠(그림 약 2:1), 끝 컷에 직접 그린 로고(도담_로고.py)를 원본 끝 화면의 움직임대로 얹고, 소리(최종소리.py)를 놓는다.
#   python -X utf8 최종편집.py [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/p10/도담중공업_16x9.mp4 · _16x9_폰.mp4 · _반초.jpg
#   python -X utf8 최종편집.py 낱장 <초> [<초> …]     → 최종/p10/_낱장/t<초>.png(띠 · 로고까지 얹은 화면 확인)
# 후보정 없음(결정 10-24): 색 · 밝기 · 떨림 · 속도를 건드리지 않고 받은 판을 시작 장부터 잘라 잇기만 한다. 쓰는 판 · 시작 장은 CUTS 한 곳이다.
# 판 고르기 · 시작 장의 근거(편집전점검.py · 겹친장.py · 장 확대)는 02_콘티 12절 표.
import os
import shutil
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
OUT = os.path.join(ROOT, "최종", "p10")
NAME = "도담중공업_16x9"
FPS, W, H = 24, 1920, 1080
BAR = 60   # 위아래 검은 띠 — 원본(854×480 안 854×428)처럼 그림 1920×960(2:1)

# 컷 경계(초) — 01_샷표_원본 2절 · 02_콘티 2절 그대로(37컷 · 60.06초)
T = [0.00, 1.63, 3.04, 3.59, 4.30, 5.42, 6.84, 9.43, 11.30, 12.43, 14.64, 16.18, 18.14, 19.19, 20.85, 21.73, 22.86, 24.52, 25.52, 30.53,
     33.45, 34.49, 35.58, 37.16, 39.25, 40.79, 42.33, 44.04, 46.00, 47.30, 49.13, 50.13, 50.42, 52.26, 53.68, 54.80, 56.06, 60.06]
F = [round(t * FPS) for t in T]   # 장 경계 — 끝 1441장
TF = [f / FPS for f in F]         # 화면이 실제로 자르는 시각 — 소리 · 로고는 이 값으로 놓는다

# 컷 → (판, 그 판에서 시작하는 장). 장은 24fps(드리미나 파일 머리 60fps와 상관없이 실제 장 순서)
CUTS = {
    1: ("p10-01b__2", 0),   # 눈 접사 — 다시 낸 판 둘째 벌(눈동자를 자연스러운 갈색으로 고친 S01b, 받은 p10-01은 눈동자가 파랗게 빛나 Fable 「컬러렌즈 · CG 눈」).
                            #   0.83초에 한 번 깜빡이고 뜬 눈으로 끝난다(첫 벌은 컷 끝에서 눈을 감음)
    2: ("p10-02", 0),       # 도면 — 오른쪽 아래로 미끄러짐(1.42초에 약 5%)
    3: ("p10-03", 0),       # 바닥 불꽃
    4: ("p10-04", 15),      # 불꽃이 판 19장에 켜진다 — 15장부터면 컷 0.17초(원본 0.15초)
    5: ("p10-05", 0),       # 용접 — 고르게 다가감(1.13초에 3%)
    6: ("p10-06", 0),       # 배관 틈 너머 용접공 — 고정
    7: ("p10-07", 30),      # 렌치 손 → 오른쪽 위로 따라가 뒤통수 — 30장부터 끝(4.0초)에 머리가 들어오게
    8: ("p10-08", 0),       # 날개 원 — 고르게 다가감(1.88초에 8%)
    9: ("p10-09", 48),      # 날개 원판 — 판 앞쪽은 1초에 20%로 너무 빨라, 빠르다 멈추는 2.0초부터(1.13초에 약 11%)
    10: ("p10-10n", 0),     # 조립동 와이드 — 물러남 · 가리키던 손이 날개를 따라가다 2.0초부터 내려오고 옆 사람이 고개를 돌림(11-07 밤 「손이 굳어서 그냥 화면만 움직이고있어」 — 옛 p10-10__2는 사람 0.45 · 원본 1.06)
    11: ("p10-11n", 30),    # 터빈 밑 안전모 — 라쳇을 당기며 안전모가 끄덕이고 1.25~2.8초에 팔이 들어옴(11-08 굳은 사람 다시 — 옛 11m은 안전모만 아주 조금, 02_콘티 17절)
    12: ("p10-12b", 0),     # 작업대 → 날개 든 작업자 — 다시 낸 판(받은 p10-12의 날개가 칼로 읽힘), 아래로 따라 기울임 2초에 25%
    13: ("p10-13", 0),      # 덮개를 받치는 작업자 — 손에 든 흔들림
    14: ("p10-14n", 30),    # 이음매를 누르는 손 — 두 손이 이음새를 따라 옮겨 가며 누르고 두드림, 카메라는 물러나며 위로(11-08 — 옛 14는 손이 한 점을 쥔 채)
    15: ("p10-15", 0),      # 날개 사이 팔
    # 16 · 17 · 19 · 21~24 · 26 · 28 · 30 · 33은 11-07 「발전용으로 다시」 판(발전_1107_꾸러미.py — 터보팬 → 발전용 가스터빈, 02_콘티 13절)
    16: ("p10-16e", 30),    # 운송 덮개 쓴 앞면을 보는 준호 옆얼굴 — 옆 미끄러짐이 1.25~2.5초에만 있어(약 2%) 30장부터
    17: ("p10-17n", 18),    # 조립동 와이드 — 덮개 쓴 터빈을 비껴 세움, 고정 · 왼쪽 둘이 덮개 볼트를 가리키고 손대며 오른쪽 사람이 자리를 옮김(11-08 — 옛 17e는 셋이 거의 그대로)
    # 18 · 31 · 34 · 36은 11-07 밤 「얼굴결」 판(얼굴결_1107_꾸러미.py — Fable 맹검의 왁스 얼굴 넷을 따뜻한 한쪽 빛 · 날아간 곳 없는 시작 그림으로, 02_콘티 14절)
    18: ("p10-18t", 36),    # 준호 올려다봄 — 바탕이 오른쪽으로 흐르기 시작하는 1.5~2.5초(약 5%, 뒤쪽은 얼굴이 가운데 정면으로 돌아 안 씀)
    19: ("p10-19e", 0),     # 흙받이 아기 표지 → 크레인으로 물러나 체인에 묶인 덮개 쓴 터빈 — 끝 배율 0.241(원본 4분의 1), 5.25초에 멈춤, 겹침 없음
    20: ("p10-20", 10),     # 기어 손 → 운전대 → 옆 창 — 가장 빠른 자리가 컷 0.6~1.6초(원본 0.47~1.27초)
    21: ("p10-21e", 0),     # 사이드미러 속 덮개 쓴 터빈 — 거의 고정(4초에 2% 물러남)
    22: ("p10-22f", 0),     # 시험대 틀 — 22e(1.1초에 5.7%, 원본 2%의 세 배)를 「판 전체 3%」로 다시 낸 판, 1.1초에 약 4%
    23: ("p10-23g", 5),     # 시험동 입구 — 고정 · 작은 작업자(23e · 23f는 다가가며 4장마다 멈칫, 겹친장 6/6). 5장부터 — 판 0 → 1 · 1 → 2장에 화면 전체가 1~2% 튀고(이웃차 5.19 · 4.11) 5장부터 안정(0.3~0.4, 11-08 Fable). 제자리걸음이라 23q(제자리 연기)를 승인 뒤 낼 판
    24: ("p10-24n", 42),    # 시험동 — 터빈을 올려다보는 뒷모습이 숨을 들이쉬고 고개를 더 젖히다 한 걸음 나섬, 고정 · 옅은 연무(11-08 — 옛 24e는 숨만 얕아 사진처럼)
    25: ("p10-25", 1),      # 준호 3/4 얼굴 · 호박빛 — 1장부터(0장 → 1장 튐 1.52 대 그 뒤 0.39, 11-08)
    26: ("p10-26e", 44),    # 관제실 레버 — 레버를 미는 손(1.3~2.3초)과 화면 쪽 다가감이 겹치는 44장부터(1.54초에 약 8%, 원본 9.6%)
    27: ("p10-27", 42),     # 준호 눈 접사 → 동료로 초점 이동 — 판의 준호 선명도 1.5~2.5초에 풀리고 동료가 2.9~3.75초에 맺힌다. 42장(1.75초)부터면 준호가 아직 또렷한 데서 시작해 컷 끝에 동료가 맺힌다(11-07 밤 교차 검수 셋 다 「초점 이동 없음」 — 옛 14장은 동료가 컷 밖)
                            #   첫 판은 36장부터라 얼굴이 처음부터 흐려 Fable이 「다른 사람처럼 넓은 얼굴」(얼굴 닮음도 흐린 장 0.01~0.15, 선명한 장 0.36~0.53)
    28: ("p10-28e", 0),     # 시험동 터빈 옆 낮은 각도 — 0.5초에 벽 경광등, 0.75초부터 연소기 관측창이 차례로 주황빛(시동), 고르게 다가감
    29: ("p10-29", 0),      # 손바닥 — 거의 고정
    30: ("p10-30e", 38),    # 덮개 쓴 터빈 옆 준호 — 손을 2.3~3.1초에 내리고 올려다본다, 38장부터면 컷 0.7초(원본 0.7초)
    31: ("p10-31t", 6),     # 준호 올려다봄(아래에서) — 첫 0.25초에 화면이 2.6% 툭 커져 6장부터, 천천히 위로 기울임
    32: ("p10-32", 3),      # 역광 실루엣 — 31 끝 세 장이 어두워진 뒤 이어진다
    33: ("p10-33e", 0),     # 노을 발전소 터빈동 — 기초 위 터빈을 3/4 뒤옆에서, 노을빛이 몸통을 훑음 · 1.84초에 약 2.5% 물러남
    34: ("p10-34t", 0),     # 걸어 나오는 세 사람 — 앞사람 뒤통수가 빠지며 준호, 낮은 노을빛이 얼굴을 훑음
    35: ("p10-35", 0),      # 세 사람 뒷모습 너머 굴뚝 · 노을 — 위로 기울임
    36: ("p10-36t", 24),    # 준호 얼굴 — 따뜻한 옆빛, 옅은 웃음이 피는 1.0~2.25초
    37: ("p10-37", 25),     # 송전탑이 스쳐 지나 멀어지고 도시 불이 켜짐 — 1.04초부터 판 끝(5.04초)까지: 로고가 떠오를 때 탑이 비켜 나가고 끝 장은 탑 없는 하늘 · 다 켜진 도시
}
RAMP = 3   # 31 끝 밝기 램프 장 수(0.125초 — 원본 0.12초)

# ---------- 끝 로고(원본 끝 화면의 움직임: 표식이 작게 떠올라 커짐 → 왼쪽으로 비키며 이름이 표식 뒤에서 미끄러져 나옴)
LOGO_NAME_H = 92                   # 이름 글자 높이(px) — 묶음 폭 약 34%(원본 37%)
LOGO_CY = 0.45                     # 묶음 세로 가운데(화면 높이 몫) — 노을 하늘 아래쪽, 도시 불빛 위
MARK_IN = (58.25, 58.57)           # 표식이 커지며 켜짐 — 곡의 마지막 화음(58.25초)과 함께(원본 58.08 작게 → 58.33)
SLIDE = (59.02, 59.38)             # 표식이 비키고 이름이 나옴(원본 58.96)


def ease_out(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


def ease_io(x):
    x = min(1.0, max(0.0, x))
    return 3 * x * x - 2 * x * x * x


def logo_parts():
    import 도담_로고
    mark, name, gap = 도담_로고.render(LOGO_NAME_H)
    return mark.astype(np.float32), name.astype(np.float32), gap


def put(frame, img, x, y, alpha=1.0, scale=1.0):
    """frame(RGB float32)에 흰 RGBA img를 (x, y) 왼쪽 위로 얹는다 — 크기 바꿈은 가운데 기준"""
    import cv2
    if alpha <= 0:
        return
    if scale != 1.0:
        h0, w0 = img.shape[:2]
        w1, h1 = max(1, int(round(w0 * scale))), max(1, int(round(h0 * scale)))
        img = cv2.resize(img, (w1, h1), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR)
        x, y = x + (w0 - w1) / 2, y + (h0 - h1) / 2
    x, y = int(round(x)), int(round(y))
    h, w = img.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(frame.shape[1], x + w), min(frame.shape[0], y + h)
    if x0 >= x1 or y0 >= y1:
        return
    sub = img[y0 - y:y1 - y, x0 - x:x1 - x]
    a = sub[..., 3:4] / 255.0 * alpha
    frame[y0:y1, x0:x1] = frame[y0:y1, x0:x1] * (1 - a) + sub[..., :3] * a


def draw_logo(frame, t, parts):
    mark, name, gap = parts
    if t < MARK_IN[0]:
        return
    mw, nw = mark.shape[1], name.shape[1]
    total = mw + gap + nw
    cx, cy = W / 2, H * LOGO_CY
    x_final = cx - total / 2
    k = ease_io((t - SLIDE[0]) / (SLIDE[1] - SLIDE[0]))
    mx = (cx - mw / 2) * (1 - k) + x_final * k                 # 표식 왼쪽 끝
    a_in = ease_out((t - MARK_IN[0]) / (MARK_IN[1] - MARK_IN[0]))
    if k > 0:
        # 이름은 표식 뒤에서 오른쪽으로 미끄러져 나온다 — 표식 고리의 실제 오른쪽 끝보다 왼쪽은 가린다
        # (첫 판은 그림 폭 기준 0.82로 잡아 59.21초에 「도」가 고리 위로 비쳤다)
        cols_on = np.where(mark[..., 3].max(axis=0) > 8)[0]
        ring_right = mx + (cols_on[-1] + 1 if len(cols_on) else mw)
        nx = x_final + mw + gap - (1 - k) * (mw * 0.9)
        edge = ring_right + 4
        nm = name.copy()
        cols = np.arange(nm.shape[1]) + nx
        nm[..., 3] *= np.clip((cols - edge) / 6.0, 0, 1)[None, :]
        put(frame, nm, nx, cy - name.shape[0] / 2, alpha=k ** 0.5)
    put(frame, mark, mx, cy - mark.shape[0] / 2, alpha=a_in, scale=0.78 + 0.22 * a_in)


# ---------- 화면
def decode(src, a, k):
    """판의 a장부터 k장을 W×H RGB(uint8)로 — cut_video와 같은 크기 바꿈 · 색 행렬(판 → bt709). 장마다 float로 바꿔 쓴다(96장 float면 2.4GB)"""
    vf = f"select='between(n,{a},{a + k - 1})',setpts=N/{FPS}/TB,scale={W}:{H}:flags=lanczos:out_color_matrix=bt709,format=yuv420p,scale=in_color_matrix=bt709:in_range=tv,format=rgb24"
    # -fps_mode passthrough: 드리미나 CLI 판은 머리가 60 fps(실제 24장/초)라, 없으면 rawvideo 출력이 60 fps로 같은 장을 2~3번씩 채운다 —
    #   11-07 밤까지 31(p10-31t)이 판 6~29장 대신 6~15장을 2.4배 느리게 · 계단처럼 냈다(교차 검수 「시선 내리기 없음」, 02_콘티 16절)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-an", "-fps_mode", "passthrough", "-vf", vf, "-frames:v", str(k), "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).copy()


def encode(frames, out):
    p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p", "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS),
                          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out], stdin=subprocess.PIPE)
    for f in frames:
        p.stdin.write(f.tobytes() if f.dtype == np.uint8 else np.clip(f + 0.5, 0, 255).astype(np.uint8).tobytes())
    p.stdin.close()
    if p.wait():
        raise SystemExit(f"{out}: 인코딩 실패")


def picture():
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    parts = logo_parts()
    paths = []
    for n in range(1, 38):
        k = F[n] - F[n - 1]
        pid, a = CUTS[n]
        src = C.clip(pid)
        have = C.frames_of(src)
        if a + k > have:
            raise SystemExit(f"#{n} {pid}: {a}장부터 {k}장이 필요한데 {have}장뿐")
        out = os.path.join(d, f"{n:02d}.mp4")
        if n == 31:
            # 31 끝 RAMP장의 밝기를 내려 「불이 꺼지듯」 어두워진 뒤 32 실루엣으로 하드컷 — 원본 50.05~50.15초 밝기 램프.
            # 첫 판은 32의 앞 장과 겹쳐 녹였는데, 두 판의 얼굴 자리가 달라 반투명 두 얼굴이 겹쳐 보였다(11-07 장 확인)
            fr = decode(src, a, k)
            for i in range(RAMP):
                g = 1 - 0.75 * (i + 1) / RAMP   # 0.75 · 0.5 · 0.25
                fr[k - RAMP + i] = np.clip(fr[k - RAMP + i].astype(np.float32) * g + 0.5, 0, 255).astype(np.uint8)
            encode(fr, out)
        elif n == 37:
            fr = decode(src, a, k)
            for i in range(k):
                f = fr[i].astype(np.float32)
                draw_logo(f, TF[36] + i / FPS, parts)
                fr[i] = np.clip(f + 0.5, 0, 255).astype(np.uint8)
            encode(fr, out)
        else:
            C.cut_video(src, a, k, W, H, FPS, out)
        if C.frames_of(out) != k:
            raise SystemExit(f"{out}: {k}장이어야 하는데 {C.frames_of(out)}장")
        print(f"#{n:2d} {pid:10s} {a:3d}장({a / FPS:.2f}초)부터 {k:3d}장 → 화면 {TF[n - 1]:.2f}–{TF[n]:.2f}초")
        paths.append(out)
    raw = os.path.join(OUT, "_화면_띠없음.mp4")
    C.join_videos(paths, raw)
    C.run("ffmpeg", "-y", "-v", "error", "-i", raw, "-vf", f"drawbox=x=0:y=0:w=iw:h={BAR}:color=black:t=fill,drawbox=x=0:y=ih-{BAR}:w=iw:h={BAR}:color=black:t=fill",
          "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
          os.path.join(OUT, "화면.mp4"))
    print("화면", C.frames_of(os.path.join(OUT, "화면.mp4")), "장")


def sound():
    import 최종소리
    최종소리.build(os.path.join(OUT, "소리.wav"), TF)


def render():
    out, raw = os.path.join(OUT, NAME + ".mp4"), os.path.join(OUT, "_렌더.mp4")
    C.run("ffmpeg", "-y", "-v", "error", "-i", os.path.join(OUT, "화면.mp4"), "-i", os.path.join(OUT, "소리.wav"), "-map", "0:v", "-map", "1:a",
          "-c:v", "copy", "-c:a", "aac", "-b:a", "384k", "-ar", "48000", "-t", f"{TF[-1]:.3f}", "-movflags", "+faststart", raw)
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), raw, out, "--목표", "-14", "--덮어쓰기")
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-c:a", "aac", "-b:a", "160k",
          "-movflags", "+faststart", os.path.join(OUT, NAME + "_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=240:-2,tile=12x10:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_반초.jpg"))
    print(out)


def stills(*secs):
    d = os.path.join(OUT, "_낱장")
    os.makedirs(d, exist_ok=True)
    src = os.path.join(OUT, NAME + ".mp4")
    if not os.path.exists(src):
        src = os.path.join(OUT, "화면.mp4")
    for s in secs:
        n = int(round(float(s) * FPS))
        C.run("ffmpeg", "-y", "-v", "error", "-i", src, "-vf", f"select=eq(n\\,{n})", "-frames:v", "1", os.path.join(d, f"t{float(s):05.2f}.png"))
    print(d)


if __name__ == "__main__":
    what = sys.argv[1:] or ["화면", "소리", "판"]
    if what[0] == "낱장":
        stills(*what[1:])
        raise SystemExit
    os.makedirs(OUT, exist_ok=True)
    for w in what:
        {"화면": picture, "소리": sound, "판": render}[w]()

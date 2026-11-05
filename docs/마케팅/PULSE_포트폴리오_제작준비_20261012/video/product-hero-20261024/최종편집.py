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
F = [0, 27, 106, 211, 264, 316, 395]   # 컷 경계 프레임(24fps)
DROP = F[3] / FPS


def beat(k):
    # 드롭을 0으로 센 박의 화면 시각
    return DROP + k * BEAT


# 컷 번호 → (판 차례, 그 판에서 시작하는 프레임)
CUTS = {
    1: (("p1-01c",), 0),            # d(캔이 일찍 또렷)는 뚜껑이 느려 컷 끝에도 엠블럼이 반만 나오고 뚜껑 밑에 없던 홈이 생겨 안 쓴다 — c는 끝까지 조금 흐리지만 원본도 그렇다
    2: (("p1-02e", "p1-02d"), 0),   # d: 첫 · 끝 그림을 한 사진에서 잘라 카메라를 묶은 판(첫끝자르기.py). c는 다가감이 17.5%로 콘티 6.6%의 2.6배였다
    3: (("p1-03d", "p1-03c"), 0),   # d: 부제를 라벨대로 「오미톡 오미자 스파클링」. c는 시작 그림을 구울 때 낱말 순서가 바뀌었다
    # h: 입구 전체에서 세차게 쏟아진다(흐름 초당 126 px, 원본 47). 처음 14장은 매끈하다가 출렁이기 시작해 그 뒤부터 쓴다.
    # e는 유호님 11-05 「물 떨어지는데가 좀 부자연스럽거든」 — 줄기 옆 방울이 공중에 떠 있거나 위로 올라가고 입구가 비어 아래 턱에서만 얇게 나왔다. d · c는 젤리 · 리본
    4: ((os.environ.get("P1_CUT4", "p1-04h"),), int(os.environ.get("P1_CUT4_FROM", "14"))),
    5: (("p1-05d", "p1-05c"), 0),   # d: 잔이 차오르고 줄기가 닿는 자리가 끓는다. c는 움직임이 원본의 1/4이었다
    6: (("p1-06e", "p1-06d"), 0),   # e: 짙은 파랑 + 네온 테두리. d: 첫 · 끝 그림으로 묶음. c는 카메라가 콘티와 반대로 가서 낱말표가 잘리고 작은 한글이 「지통」으로 깨졌다
}

# 끝 글: 낱말표 전체가 캔에 보이니 이름을 다시 얹지 않고, 위 오른쪽 어두운 파란 자리에 「다섯 가지 맛,」(한 박 앞) → 「톡」(마지막 타)
TEXT_LINE = beat(11)
TEXT_TOK = beat(12)


def picture():
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    paths = []
    for n, (ids, a) in CUTS.items():
        k = F[n] - F[n - 1]
        pid = C.latest(*ids)
        src = C.clip(pid)
        have = C.frames_of(src)
        if a + k > have:
            raise SystemExit(f"#{n} {pid}: {a}장부터 {k}장이 필요한데 {have}장뿐")
        out = os.path.join(d, f"{n:02d}.mp4")
        C.cut_video(src, a, k, W, H, FPS, out)
        if C.frames_of(out) != k:
            raise SystemExit(f"{out}: {k}장이어야 하는데 {C.frames_of(out)}장")
        paths.append(out)
        print(f"#{n} {pid} {a}장부터 {k}장 → {F[n - 1] / FPS:.3f}~{F[n] / FPS:.3f}초")
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
    ("또르르", SFX + "물방울_3.wav", 0.30, 1.90, F[1] / FPS + 0.85 - 0.52, -21, 0.50),
    # 컷 3 — 슬라이더 「휙」 아주 작게
    ("휙", FAIR + "Low Whoosh x2.wav", 0.15, 0.50, F[2] / FPS - 0.04, -28, 0.20),
    # 드롭 앞 빈 박 — 캔 따는 「칙」이 빈자리에 혼자 들리고 바로 터진다
    ("캔 따기", SFX + "캔따기_1.wav", 0.00, 0.30, beat(-0.5), -5, 0.12),
    ("치익", SFX + "기포_3.wav", 3.00, 0.30, beat(-0.5) + 0.05, -14, 0.05),
    # 컷 4 — 붓기(첫 프레임에 머리) 둘을 잇고 탄산을 깐다
    ("콸콸 1", SFX + "붓기_1.wav", 0.66, 1.40, DROP, -3, 0.40),
    ("콸콸 2", SFX + "붓기_3.wav", 0.80, 1.30, DROP + 1.05, -4, 0.50),
    ("치익 깔림", SFX + "기포_1.wav", 3.00, 2.40, DROP, -11, 0.30),   # 아르곤 1차 「치지직」(-8) · 2차 「묻힌다」(-16) 사이
    # 컷 5 — 사르르 · 톡톡, 얼음 한 번
    ("사르르", SFX + "기포_3.wav", 2.00, 2.30, F[4] / FPS, -7, 0.40),
    ("얼음 톡", SFX + "얼음_3.wav", 0.55, 0.60, F[4] / FPS + 0.55, -14, 0.20),
    # 끝 — 마지막 타(곡)와 「톡」 글자가 같은 자리, 캔 따는 소리로 찍고 캔 두드림 · 유리 한 번. 그 뒤 곡 꼬리와 탄산만 남아 멈춘다
    ("톡 칙", SFX + "캔따기_1.wav", 0.00, 0.30, TEXT_TOK, -5, 0.12),
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
    m.finish(os.path.join(OUT, "소리.wav"), boost_db=0)


def render():
    pic = os.path.join(OUT, "화면.mp4")
    wav = os.path.join(OUT, "소리.wav")
    here = os.path.dirname(os.path.abspath(__file__))
    txt = os.path.join(OUT, "끝글")
    os.makedirs(txt, exist_ok=True)
    C.run(sys.executable, "-X", "utf8", os.path.join(here, "라벨", "끝글자.py"), "--오른쪽위", txt)
    raw = os.path.join(OUT, "_합침.mp4")
    a, b = TEXT_LINE, TEXT_TOK
    # 「톡」은 글자 칸만 잘라 3장 동안 0.9 → 1배로 커지며 들어온다(글자 오른쪽 아래를 붙잡음). 다른 글은 0.2초 줄 단위로 조용히
    im = cv2.imdecode(np.fromfile(os.path.join(txt, "끝글_톡.png"), np.uint8), cv2.IMREAD_UNCHANGED)
    ys, xs = np.where(im[..., 3] > 0)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    ok, buf = cv2.imencode(".png", im[y0:y1, x0:x1])
    assert ok
    tok = os.path.join(txt, "끝글_톡_칸.png")
    buf.tofile(tok)
    S = f"(1+0.025*gte(t,{b:.4f})*exp(-max(0,t-{b:.4f})*10))"
    vf = (f"[0:v]scale=w='trunc(1080*{S}/2)*2':h='trunc(1920*{S}/2)*2':eval=frame:flags=lanczos,crop=1080:1920:(iw-1080)/2:(ih-1920)/2[p];"
          f"[1:v]format=rgba,fade=t=in:st={a:.4f}:d=0.2:alpha=1[l];"
          f"[2:v]format=rgba,scale=w='iw*min(1,0.9+max(0,t-{b:.4f})/0.125*0.1)':h='ih*min(1,0.9+max(0,t-{b:.4f})/0.125*0.1)':eval=frame:flags=lanczos,fade=t=in:st={b:.4f}:d=0.05:alpha=1[k];"
          f"[p][l]overlay=x=0:y='if(lt(t,{a + 0.2:.4f}),12*(1-max(0,t-{a:.4f})/0.2),0)':enable='gte(t,{a:.4f})':shortest=1[v1];"
          f"[v1][k]overlay=x='{x1}-overlay_w':y='{y1}-overlay_h':eval=frame:enable='gte(t,{b:.4f})':shortest=1,scale=out_color_matrix=bt709,format=yuv420p[v]")
    C.run("ffmpeg", "-y", "-v", "error", "-i", pic, "-loop", "1", "-framerate", str(FPS), "-i", os.path.join(txt, "끝글_줄.png"), "-loop", "1", "-framerate", str(FPS), "-i", tok,
          "-filter_complex", vf, "-map", "[v]", "-frames:v", str(F[-1]), "-c:v", "libx264", "-crf", "14", "-preset", "medium", "-r", str(FPS),
          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", raw)
    tmp = os.path.join(OUT, "_소리붙임.mp4")
    C.run("ffmpeg", "-y", "-v", "error", "-i", raw, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-shortest", tmp)
    out = os.path.join(OUT, os.environ.get("P1_NAME", "오미톡_9x16") + ".mp4")
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), tmp, out, "--리미터", "0.8", "--덮어쓰기")
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", os.path.join(OUT, os.environ.get("P1_NAME", "오미톡_9x16") + "_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=200:-2,tile=8x4:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_반초.jpg"))
    print(out)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for w in sys.argv[1:] or ["화면", "소리", "판"]:
        {"화면": picture, "소리": sound, "판": render}[w]()

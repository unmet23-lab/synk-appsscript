# 4번 패션 필름 「결채」 15초 다시 편집(2026-11-07, Claude) — 유호님 「15초로 편집해」.
#   python -X utf8 편집_15초.py [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/p4/결채_15초.mp4 · _15초_폰.mp4 · _반초_15초.jpg
#   python -X utf8 편집_15초.py 낱장 <초> [<초> …]     → 최종/p4/_낱장15/t<초>.png
#   python -X utf8 편집_15초.py 끝시안                 → 끝 화면 1.6초 장을 뜻 한 줄 A · B로 하나씩(최종/p4/_낱장15/끝_A.png · 끝_B.png)
# 왜: 30초 판(최종편집.py)은 원본 MARAH 70초 중 앞 26초 35컷을 1:1로 옮겨 장소가 열네 번 뒤섞이고(밤이 세 번 따로), 원본의 볼거리였던
#   「컷마다 바뀌는 옷」을 한 벌로 바꾸며 지워 같은 얼굴 · 가방 컷이 되풀이됐다 — 유호님 「너무 긴것같아. 뭘 말하려는지 내용이 이해가 안가네」.
#   받아 둔 판만으로(새로 굽지 않음) 장소를 하루 순서로 묶는다: 스튜디오(천 · 얼굴 · 허리) → 오후 억새밭 → 해 질 녘 빈집 창틀 → 밤 붉은 흙담 →
#   끝 화면(결채 + 뜻 한 줄). 콘티 1절의 「트렌치 한 벌로 가을을 건넌다」가 빛의 차례(파란 하늘 → 금빛 역광 → 창틀 노을 → 붉은 밤)로 보이게.
# 박(곡 통째_a, 86 BPM): 곡 5.63초 첫 박 = 억새밭 첫 장(70장 · 2.917초) · 빈집은 다음 마디(137장), 곡 11.21초 한 단 세짐 = 밤 첫 장(204장 · 8.5초),
#   끝 화면은 그다음 마디 첫 박 271장(11.29초) — 마디마다 장소 하나.
# 후보정 없음(결정 10-24) — 받은 판의 색 · 떨림 · 속도는 그대로, 판 안에서 고른 장만 잇는다. 전환 셋만 여기서 만든다:
#   흰 빛 번쩍(스튜디오 → 억새밭, 30초 판 10 · 17a · 31과 같은 꼴) · 창틀 빛이 꺼져 어둠으로(해가 짐) · 밤이 어둠에서 떠오름(30초 판 32 → 33과 같은 밝기 램프).
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import 최종편집 as E   # decode · flash_frames · prewash · sink · put · ease (같은 손질을 다시 쓴다)

C = E.C
FPS, W, H = E.FPS, E.W, E.H
OUT = E.OUT
NAME = "결채_15초"

# (이름, 판, 판 안 시작 장, 장 수, 손질)
SEQ = [
    ("A1 천", "p4-29b", 0, 30, "열림"),          # 입은 코트와 같은 아이보리 울 주름 — 어둠에서 떠오름. 30초 판 2의 능직(p4-02b)은 「코듀로이 · 소파 천처럼 보여
                                                 #   코트 울과 다르고 끝 화면 천과도 다르다 — 여는 천 · 입은 천 · 닫는 천이 셋」(Fable 11-07)
    ("A2 얼굴", "p4-23b", 44, 21, None),         # 복숭아빛 · 목에 댄 손 · 렌즈를 올려다봄(Fable 2차 「이 편 최고의 얼굴 컷」) — 판 전체에 4장 무늬가 있어
                                                 #   움직임이 가장 작은 44장부터(움직임 0.6~0.7 — 거의 멈춘 얼굴이라 멈칫이 안 보이는 쪽)
    ("A3 허리", "p4-24a__2", 70, 19, "번쩍"),    # 트렌치 한 벌 · 고개를 내리며 눈을 떠 렌즈를 보고 한 번 깜빡임 — 연기 박자 지시문으로 다시 낸 판(11-07 「다시 구워」, 다시_1107c_연기꾸러미.py).
                                                 #   옛 p4-24m 64장부터는 사람 0.07(「keeps still」 지시문 — 굳음) → 0.30. 같은 장 되풀이는 없고 튐 무늬(2.5배)는 남음. 끝 장이 타고 두 장 흰 빛
    ("B1 바람", "p4-17m__2", 51, 34, None),      # 파란 하늘 · 바람 · 57장에 눈을 뜸(무늬 없음)
    ("B2 억새", "p4-18", 0, 33, None),           # 금빛 역광 속 억새 씨앗 접사 — 파란 하늘에서 노을로 넘어가는 다리(무늬 없음, 움직임 0.45).
                                                 #   걷는 판(`p4-21p__2`)은 뺐다 — 얼굴이 든 54장부터는 「다른 사람」(Fable 1차 꼭 고칠 것), 어깨 아래 4장부터도
                                                 #   「벨트 아래 단추가 갑자기 생기고 개수가 바뀜 · 걸을 때 바지와 발이 겹쳐 뒤틀림」(아르곤), Gemini 두 모델도 이 자리를 「가장 AI 같은 곳」.
                                                 #   걷는 판 다섯 벌 모두 4장마다 튀는 무늬(움직임 3~9)라 다른 걷는 판도 없다
    ("C1 부츠", "p4-27", 38, 27, None),          # 흙길을 딛는 부츠(57장에 앞발이 닿음)
    ("C2 창틀", "p4-22", 0, 40, "가라앉음"),      # 창밖 억새밭 노을 앞에 선 실루엣 — 끝 0.33초에 빛이 꺼진다(해가 짐)
    ("D1 옆얼굴", "p4-33-34", 0, 12, None),      # 붉은 어둠 속 옆얼굴(고개 숙임) — 빛이 꺼진 바로 다음 장, 곡이 세지고 붐. 사람 0.08(굳음)이라 0.5초로 줄였다 —
                                                 #   연기 박자로 다시 낸 p4-33a 두 벌은 실패(하나는 끝나지 않음 · 하나는 코드 20115)
    ("D2 흙담", "p4-34b", 40, 55, None),         # 흙담에 기대어 고개를 돌려 렌즈를 보고 벽에서 몸을 고쳐 기댐 — 첫 줄을 「시작 자세일 뿐 · 그림을 멈춰 두지 말 것」으로 바꾼
                                                 #   시험 판(옛 p4-33-34 29장부터 사람 0.01 → 0.25, 같은 그림 · 같은 박자의 34a 두 벌은 0.04 · 0.07)
    # 뺀 것: 아치(p4-30b__2) · 문간(p4-08m) — Gemini 두 모델이 두 판 내리 9~10초를 「붉은 조명 아래 인물이 배경과 따로 놀아 합성 같다」.
    #   밤 감나무(p4-07) · 창틀 두 팔(p4-26) — 「거의 검정, 집 밑 주황 빛이 불난 집 · 스릴러 예고처럼」 · 「두 팔 매달린 실루엣도 같은 쪽」, 해 짐 뒤 0.6초 검은 구멍(Fable 11-07)
    ("끝", "p4-endb", 0, 89, "끝"),              # 개버딘 결 극접사 + 결채 + 뜻 한 줄 — 원본 끝 화면(65.02~68.74초)처럼 3.7초, 마디 첫 박(11.29초)에 선다.
                                                 #   Fable 「3초로 줄이고 들판 · 창가에」는 따르지 않음 — 곡 마디와 줄 읽을 시간
]
F = [0]
for s in SEQ:
    F.append(F[-1] + s[3])
TF = [f / FPS for f in F]
MARK = {s[0].split()[0]: TF[i] for i, s in enumerate(SEQ)}   # 컷 머리 이름 → 화면 시작 초(소리가 쓴다)

# 끝 화면 — 원본 MARAH: 워드마크가 컷 0.08초 뒤 바로 서고, 작은 줄이 천천히 떠오르고(원본 2.08~2.88초), 마지막에 어두워진다.
#   15초 판 끝 화면은 3.7초라 줄은 0.9~1.6초 — 다 뜬 줄을 1.6초 넘게 읽는다
LINE = os.environ.get("결채_한줄", "B")   # A 「한 벌로 건너는 가을」 · B 「가을을 건너는 한 벌」 — Fable 11-07 B: 끝 낱말이 제품이라 「뭐였지?」에 답한다
LINE_PX = 40       # 34px는 휴대폰에서 작다(Fable 11-07 「15~20% 키우기」)
LINE_IN = (0.90, 1.60)
LINE_GAP = 0.30    # 워드마크 칸 높이 대비 두 줄 사이
FADE_OUT = 0.5


def end_parts(which):
    import 결채_로고
    import 결채_한줄
    word = 결채_로고.raster(결채_로고.wordmark(), E.LOGO_H).astype(np.float32)
    line = 결채_한줄.render(which, LINE_PX).astype(np.float32)
    return word, line


def draw_end(frame, t, parts):
    word, line = parts
    if t < E.LOGO_IN:
        return
    cy = H * E.LOGO_CY
    top = cy - word.shape[0] / 2
    E.put(frame, word, (W - word.shape[1]) / 2, top)
    a = E.ease((t - LINE_IN[0]) / (LINE_IN[1] - LINE_IN[0]))
    E.put(frame, line, (W - line.shape[1]) / 2, top + word.shape[0] + E.LOGO_H * LINE_GAP - line.shape[0] / 2, alpha=a)


def rise(fr, n, floor=0.08):
    """첫 n장이 어둠에서 떠오른다 — sink의 거꾸로(밝기만, 색 · 대비 그대로)"""
    out = list(fr)
    for i in range(min(n, len(out))):
        g = floor + (1 - floor) * ((i + 1) / (n + 1)) ** 1.2
        out[i] = np.clip(out[i].astype(np.float32) * g + 0.5, 0, 255).astype(np.uint8)
    return out


def cut(i, parts):
    name, pid, a, k, how = SEQ[i]
    have = C.frames_of(C.clip(pid))
    if a + k > have:
        raise SystemExit(f"{name} {pid}: {a}장부터 {k}장이 필요한데 {have}장뿐")
    if how == "번쩍":
        fr = list(E.decode(C.clip(pid), a, k - 2))
        fr[-1] = E.prewash(fr[-1])   # 번쩍 앞 장이 먼저 탄다(30초 판 17 · 30)
        cont = E.decode(C.clip(pid), min(a + k - 2, have - 2), 2)
        return fr + E.flash_frames(list(cont), None, 2)
    fr = E.decode(C.clip(pid), a, k)
    if how == "가라앉음":
        return E.sink(fr, k - 8, floor=0.04)   # 마지막 0.33초에 빛이 꺼진다 — 해가 진다(12장 · 감나무까지는 「한 박자 빈 검은 구멍」, Fable 11-07)
    if how == "열림":
        return rise(fr, 10)                    # 첫 장이 어둠에서 떠오른다(30초 판 첫 컷처럼)
    if how == "끝":
        def ending():
            for j in range(k):
                f = fr[j].astype(np.float32)
                draw_end(f, j / FPS, parts)
                left = (k - j) / FPS
                if left <= FADE_OUT:
                    f *= max(0.0, (left - 1 / FPS) / FADE_OUT)
                yield f
        return ending()
    return list(fr)


def picture():
    import subprocess
    os.makedirs(OUT, exist_ok=True)
    parts = end_parts(LINE)
    out = os.path.join(OUT, "화면_15초.mp4")
    p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p", "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS),
                          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out], stdin=subprocess.PIPE)
    for i, (name, pid, a, k, how) in enumerate(SEQ):
        n = 0
        for f in cut(i, parts):
            p.stdin.write(f.tobytes() if f.dtype == np.uint8 else np.clip(f + 0.5, 0, 255).astype(np.uint8).tobytes())
            n += 1
        if n != k:
            raise SystemExit(f"{name}: {n}장 — {k}장이어야 한다")
        print(f"{name:7s} {pid:11s} {a:3d}장({a / FPS:.2f}초)부터 {k:3d}장 {how or '':5s} → 화면 {TF[i]:.3f}–{TF[i + 1]:.3f}초")
    p.stdin.close()
    if p.wait():
        raise SystemExit("인코딩 실패")
    n = C.frames_of(out)
    if n != F[-1]:
        raise SystemExit(f"화면 {n}장 — {F[-1]}장이어야 한다")
    print("화면", n, "장", out)


def sound():
    import 소리_15초
    소리_15초.build(os.path.join(OUT, "소리_15초.wav"), MARK, TF[-1])


def render():
    out, raw = os.path.join(OUT, NAME + ".mp4"), os.path.join(OUT, "_렌더_15초.mp4")
    C.run("ffmpeg", "-y", "-v", "error", "-i", os.path.join(OUT, "화면_15초.mp4"), "-i", os.path.join(OUT, "소리_15초.wav"), "-map", "0:v", "-map", "1:a",
          "-c:v", "copy", "-c:a", "aac", "-b:a", "384k", "-ar", "48000", "-t", f"{TF[-1]:.3f}", "-movflags", "+faststart", raw)
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), raw, out, "--목표", "-14", "--덮어쓰기")
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-c:a", "aac", "-b:a", "160k",
          "-movflags", "+faststart", os.path.join(OUT, NAME + "_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=240:-2,tile=10x3:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_반초_15초.jpg"))
    print(out)


def stills(*secs):
    d = os.path.join(OUT, "_낱장15")
    os.makedirs(d, exist_ok=True)
    src = os.path.join(OUT, NAME + ".mp4")
    if not os.path.exists(src):
        src = os.path.join(OUT, "화면_15초.mp4")
    for s in secs:
        n = int(round(float(s) * FPS))
        C.run("ffmpeg", "-y", "-v", "error", "-i", src, "-vf", f"select=eq(n\\,{n})", "-frames:v", "1", os.path.join(d, f"t{float(s):05.2f}.png"))
    print(d)


def end_options(t=1.6):
    """끝 화면 t초 장을 뜻 한 줄 A · B로 하나씩 — 화면 전체를 만들지 않고 끝 판 한 장 위에만 얹는다"""
    from PIL import Image
    d = os.path.join(OUT, "_낱장15")
    os.makedirs(d, exist_ok=True)
    j = int(round(t * FPS))
    base = E.decode(C.clip("p4-endb"), j, 1)[0]
    for k in ("A", "B"):
        f = base.astype(np.float32)
        draw_end(f, t, end_parts(k))
        Image.fromarray(np.clip(f + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(d, f"끝_{k}.png"))
    print(d)


if __name__ == "__main__":
    what = sys.argv[1:] or ["화면", "소리", "판"]
    if what[0] == "낱장":
        stills(*what[1:])
        raise SystemExit
    if what[0] == "끝시안":
        end_options(*(float(x) for x in what[1:]))
        raise SystemExit
    for w in what:
        {"화면": picture, "소리": sound, "판": render}[w]()

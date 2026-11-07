# 6번 「연말 빈방」 최종 편집(2026-11-07, Claude) — 02_콘티 2절 15조각을 콘티 시각대로 하드컷으로 잇고(검은 글판 둘 포함), 목소리 · 노래 A · 내레이션 · 효과음을 놓고,
# 화면 글(말자막 · 글판 · 끝 문구 · 그린 로고)은 자막시안_20261103/remotion의 p6(src/p6/P6.tsx)이 굽는다.
#   python -X utf8 최종편집.py [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/p6/연말빈방_16x9.mp4 · _16x9_폰.mp4 · _반초.jpg
# 후보정 없음(결정 10-24): 색 · 밝기 · 떨림 · 속도를 건드리지 않고 받은 판을 시작점부터 잘라 잇기만 한다. 쓰는 판 · 시작점은 CUTS 한 곳이다.
# 컷 시각은 콘티 그대로이고 하나만 바꿨다 — 21 → 22 경계를 51.68 → 49.542초(1189장)로 당겨 21번을 3.29초로 줄였다(11-07 Fable E10 「얼굴 6.5초 → 3.5초」).
# 22번은 받은 p6-22 앞 5.0초(앉아 방을 둘러봄) + 그 120장을 첫 프레임으로 이은 22b 4.0초(번호 소리에 고개 듦 → 「엄마!」에 웃음 — Fable R4)
# + 22b 96장을 첫 프레임으로 이은 22c 1.46초(웃음이 머묾 — Fable 둘째 판 「웃음이 마지막 장에서야 완성돼 머무는 시간 0초」). 세 판은 같은 장 이음이라 이음새가 안 보인다.
# 끝 넷의 소리 시각(최종소리.py END_*)과 내레이션 · 로고(아래 NARR_AT · BRAND_AT)는 22b 판 안 사건에 맞췄다.
import os
import shutil
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
OUT = os.path.join(ROOT, "최종", "p6")
VOX = os.path.join(OUT, "소리", "목소리")      # 판마다 허깅페이스 BS-RoFormer로 뗀 목소리(<판>_목소리.wav)
NARR = os.path.join(OUT, "소리", "내레이션", "루나1.mp3")   # 일레븐 v4 Luna(힉스필드 founder) · [softly] · stability 0.6 · 끝 문구와 「솜채.」를 한 번에 — 세 판 가운데 두 귀 모두 대본대로 들은 판
SONG = os.path.join(ROOT, "소리", "p6", "suno", "8346c7dd-628d-4f8f-a48a-491a8f8bc679.mp3")   # 노래 A 「미리 덮어 둘게」 2분52초(10-26 유호님 「6번 노래는 A로 가자.」)
SFX = os.path.join(OUT, "소리", "효과음")
CAP = os.path.join(HERE, "..", "자막시안_20261103")
PUB = os.path.join(ROOT, "최종", "자막시안_public", "p6")
FPS, W, H = 24, 1920, 1080

# 컷 경계(초) — 02_콘티 2절 조각 시작 시각, 21 → 22 경계만 51.68 → 49.542(1189장, 위 머리말)
T = [0.00, 4.77, 7.57, 9.94, 15.48, 20.65, 24.83, 28.46, 31.06, 34.56, 37.97, 41.07, 44.07, 46.24, 1189 / FPS, 60.0]
F = [round(t * FPS) for t in T]   # 장 경계 — 끝 1440장(60.00초)
NAMES = [1, 2, 3, 4, 7, 11, 12, 14, 16, 17, 18, 19, 20, 21, 22]
CARDS = {2, 17}   # 검은 글판 — 글은 P6.tsx

# 조각 → (판, 그 판에서 시작하는 장). 장은 24fps(드리미나 파일 머리 60fps와 상관없이 실제 장 순서)
CUTS = {
    1: ("p6-01", 16),     # 문이 판 4.95초에 닫힌다 — 16장(0.67초)부터면 컷 4.28초(원본 4.3초)에 닫힘
    3: ("p6-03", 12),
    4: ("p6-04", 18),
    7: ("p6-07b", 1),     # 다시 낸 판(앉은 채 문에 소리친다) — 대사 둘(판 1.45–2.95 · 3.65–5.05초)이 컷 안에, 둘째 줄이 컷 끝 0.16초 앞에 끝난다
    11: ("p6-11c__2", 6), # 다시 낸 판 둘째 벌(딸이 찡그리며 소리치고 문을 세게 닫는다) — 딸 말(판 0.25–2.35초)이 컷 처음부터 22.77초까지,
                          # 문은 판 2.67초(64장 → 23.08초)에 닫히고 걸이의 비닐이 0.7초 흔들리다 멎는다(첫 벌 · 11b는 비닐이 공중에 떠 버림)
    12: ("p6-12", 12),
    14: ("p6-14", 31),    # 판 3.0–3.5초에 숙여 상자를 내려놓는다 — 컷 1.7–2.2초(원본 1.9초)
    16: ("p6-16", 12),
    18: ("p6-18", 12),
    19: ("p6-19", 0),     # 다가감은 판 0–2.0초(5.5%)에 있다 — 처음부터. 문은 1.6초부터 열린다
    20: ("p6-20", 0),     # 오른쪽 옆 이동 초당 4.4%(원본 8.2%/2.17초). 1.3초부터 오른쪽 앞 가구가 들어오는 것은 원본 끝(77.85초 앞 책장)과 같은 짜임
    21: ("p6-21", 0),     # 기욺 → 팬. 3.0초쯤부터 눈을 내리깐다. 79장(3.29초)만 쓴다
    22: ("p6-22", 0),     # 앉음 0.5–1.6초 · 방을 둘러봄 — 고개를 들기 전 120장(5.0초)까지만
    222: (None, 0),       # 22b — p6-22 120장을 첫 프레임으로 이은 판(다시_1107_꾸러미.py): 번호 소리에 고개 듦 → 「엄마!」에 눈이 풀리며 작게 웃음. 쓸 판은 B22 아래
    223: (None, 0),       # 22c — 22b 96장을 첫 프레임으로 이은 판: 웃음이 머물고 눈이 복도 쪽으로 조금 옮겨 감. 쓸 판은 B22C 아래
}
JOIN22 = 120           # 22 → 22b 이음 장(같은 장 — 첫 프레임 판)
JOIN22B = 96           # 22b → 22c 이음 장
B22 = "p6-22b"          # 고른 22b 판
B22C = "p6-22c"         # 고른 22c 판(받은 두 벌 가운데)
# 화면만 22를 셋으로 나눈다(이음새는 같은 장이라 보이지 않는다). 소리 · 자막 시각표(TF)는 그대로 15조각
F_PIC = F[:-1] + [F[-2] + JOIN22, F[-2] + JOIN22 + JOIN22B, F[-1]]
NAMES_PIC = NAMES + [222, 223]


def picture():
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    paths = []
    for b in (B22, B22C):
        if not os.path.exists(C.clip(b)):
            raise SystemExit(f"{b} 판이 없다 — 끝 시간표(22 · 22b · 22c)를 짤 수 없다")
    names, bounds = NAMES_PIC, F_PIC
    cuts = dict(CUTS)
    cuts[222] = (B22, 0)
    cuts[223] = (B22C, 0)
    for i, n in enumerate(names):
        k = bounds[i + 1] - bounds[i]
        out = os.path.join(d, f"{n:02d}.mp4")
        if n in CARDS:
            C.run("ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r={FPS}", "-frames:v", str(k), "-vf", "format=yuv420p",
                  "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out)
            print(f"#{n} 검은 글판 {k}장")
        else:
            pid, a = cuts[n]
            src = C.clip(pid)
            have = C.frames_of(src)
            if a + k > have:
                raise SystemExit(f"#{n} {pid}: {a}장부터 {k}장이 필요한데 {have}장뿐")
            C.cut_video(src, a, k, W, H, FPS, out)
            print(f"#{n} {pid} {a}장({a / FPS:.2f}초)부터 {k}장 → 화면 {bounds[i] / FPS:.2f}–{bounds[i + 1] / FPS:.2f}초")
        if C.frames_of(out) != k:
            raise SystemExit(f"{out}: {k}장이어야 하는데 {C.frames_of(out)}장")
        paths.append(out)
    C.join_videos(paths, os.path.join(OUT, "화면.mp4"))
    print("화면", C.frames_of(os.path.join(OUT, "화면.mp4")), "장")


TF = [f / FPS for f in F]   # 화면이 실제로 자르는 장 경계(초) — 소리 · 자막은 이 값으로 놓는다(현장노트 「마스크 · 컷 그래픽을 초로 바꾸면 …」)
NARR_AT = 49.13   # Luna 판 0초를 놓는 자리 — 「아무도」 49.38초(22번 컷 49.54초 0.16초 앞, 속말 끝 48.80초에서 0.58초 쉼), 끝 문구 54.23초에 끝
BRAND_AT = 54.53  # 로고가 켜지는 자리 — 「솜채.」는 54.48~55.08초(끝 문구 뒤 0.25초), 도어락 번호(55.45초)와 0.37초 띄운다
TIMING = os.path.join(CAP, "remotion", "src", "p6", "timing.json")


def sound():
    import 최종소리
    os.makedirs(os.path.dirname(TIMING), exist_ok=True)
    lines = 최종소리.build(os.path.join(OUT, "소리.wav"), TIMING, TF, VOX, NARR, SONG, NARR_AT, BRAND_AT)
    for l in lines:
        print(f"  {l['a']:6.2f}–{l['b']:6.2f} {l['who']} {l['s']}")


def publish():
    # Remotion public(git 밖 자막시안_public/p6)에 화면 · 소리 · 로고를 넣는다 — 같은 파일이면 건너뛴다
    import 솜채_로고
    from PIL import Image
    os.makedirs(PUB, exist_ok=True)
    for src, to in ((os.path.join(OUT, "화면.mp4"), "picture.mp4"), (os.path.join(OUT, "소리.wav"), "sound.wav")):
        dst = os.path.join(PUB, to)
        if not os.path.exists(dst) or C.md5(src) != C.md5(dst):
            shutil.copyfile(src, dst)
    Image.fromarray(솜채_로고.render(900)).save(os.path.join(PUB, "somchae.png"))
    for name, im in zip(("lock_word", "lock_sub"), 솜채_로고.render_lockup(300)):   # 끝 로고 두 단(솜채 · SOMCHAE)
        Image.fromarray(im).save(os.path.join(PUB, f"{name}.png"))


def stills(*frames):
    # 확인용 낱장 — git 밖 최종/p6/_낱장/f<장>.png
    publish()
    d = os.path.join(OUT, "_낱장")
    os.makedirs(d, exist_ok=True)
    for f in frames:
        C.run(shutil.which("npx"), "remotion", "still", "src/index.ts", "p6", os.path.join(d, f"f{int(f):04d}.png"), f"--frame={int(f)}", "--log=error", cwd=os.path.join(CAP, "remotion"))
    print(d)


def render(name="연말빈방_16x9", jobs=3):
    publish()
    out, raw = os.path.join(OUT, name + ".mp4"), os.path.join(OUT, "_렌더.mp4")
    C.run(shutil.which("npx"), "remotion", "render", "src/index.ts", "p6", raw, f"--concurrency={jobs}", "--log=error", cwd=os.path.join(CAP, "remotion"))
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), raw, out, "--목표", "-14", "--덮어쓰기")   # 소리 AAC 320k 이상(영상사전검사)
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", os.path.join(OUT, name + "_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=240:-2,tile=12x10:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_반초.jpg"))
    print(out)


if __name__ == "__main__":
    what = sys.argv[1:] or ["화면", "소리", "판"]
    if what[0] == "낱장":
        stills(*what[1:])
        raise SystemExit
    for w in what:
        {"화면": picture, "소리": sound, "판": render}[w]()

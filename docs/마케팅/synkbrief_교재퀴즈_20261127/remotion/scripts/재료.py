# synkbrief B75 「교재 사진 한 장으로 퀴즈 다섯 문제」 화면 재료.
# 원본은 git 밖 %USERPROFILE%/ego/synkbrief-quiz-20261127/runs/E05 — 2026-11-27 ChatGPT 임시 채팅(휴대폰 크기 430 × 932 · 배율 2.5 · 어두운 화면)에
# 실제로 보낸 실험 E05(공부 쪽 사진 + 「이 쪽으로 퀴즈 다섯 개 내 줘. 답은 맨 끝에.」 → 다섯 문제를 모두 첫 보기로 풀고 → 「틀린 문제만 다시 내 줘.」)의 화면이다.
# 보낸 사진은 우리가 직접 쓴 공부 쪽(편 폴더 시안/공부쪽/)을 사진처럼 만든 것이다.
# 사용: python -I -X utf8 scripts/재료.py   (remotion 폴더에서) → public/img/<이름>.png(영상용, git 밖) · src/sizes.json · 편 폴더 그림/<이름>.jpg(정본 사본)
import json, os, shutil, subprocess
from PIL import Image

SRC = os.path.join(os.path.expanduser("~"), "ego", "synkbrief-quiz-20261127", "runs", "E05")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EP = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(os.path.dirname(EP)))
OUT = os.path.join(HERE, "public", "img")
KEEP = os.path.join(EP, "그림")
os.makedirs(OUT, exist_ok=True)
os.makedirs(KEEP, exist_ok=True)

sizes = {}
def put(name, im, keep=True):
    im.save(os.path.join(OUT, name + ".png"))
    sizes[name] = list(im.size)
    if keep:
        im.convert("RGB").save(os.path.join(KEEP, name + ".jpg"), quality=92)

def shot(n):
    return Image.open(os.path.join(SRC, n)).convert("RGB")

# 보낸 사진(우리가 쓴 공부 쪽을 사진처럼)
put("page", Image.open(os.path.join(EP, "시안", "공부쪽", "공부쪽_사진.jpg")).convert("RGB"), keep=False)
# 보낸 사진 미리보기와 보낸 한 줄(실제 말풍선) — 첫 화면 위쪽
def clear_bg(im, bg, soft=10):
    # 화면 바탕색에 가까운 화소를 투명하게 — 말풍선 · 사진만 남겨 뒤 카드 위에 얹는다(미학 맹검 r5 「캡처를 덮어 씌운 짜깁기 티」)
    im = im.convert("RGBA")
    px = im.load()
    for yy in range(im.size[1]):
        for xx in range(im.size[0]):
            r, g, b, _ = px[xx, yy]
            d = max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2]))
            px[xx, yy] = (r, g, b, min(255, int(255 * d / soft)))
    return im
_s = shot("1_받은뒤.png")
put("sent", clear_bg(_s.crop((300, 94, 1045, 495)), _s.getpixel((8, 1400))))  # 위 머리 줄 글자(대화 제목)가 걸리지 않게 94부터(r3에서 걸림)
# 퀴즈 카드 — 테두리(둥근 모서리 포함) 바깥 4px까지. 위아래는 카드 왼쪽 테두리의 곧은 구간 ± 46px(둥근 모서리)
CARD_X = (37, 1039)
def card(n, y0, y1, name):
    put(name, shot(n).crop((CARD_X[0], y0 - 50, CARD_X[1], y1 + 50)))
card("1_받은뒤.png", 956, 1801, "q1")        # 1/5 — 누르기 전
card("2_q1_누른뒤.png", 846, 1891, "q1x")     # 1/5 — A(첫 번째 행)를 눌러 틀림, B(첫 번째 열)가 정답과 까닭
card("2_q2_누른뒤.png", 1006, 1821, "q2x")    # 2/5 — O를 눌러 틀림
card("2_q3_누른뒤.png", 771, 1771, "q3x")     # 3/5 — A를 눌러 틀림
card("2_q4_누른뒤.png", 1006, 1721, "q4x")    # 4/5 — O를 눌러 맞음(초록)
card("3_다푼뒤.png", 726, 1821, "q5x")       # 5/5 — 「제출」 뒤 채점(고른 첫 줄 틀림 · 정답 둘). 3번(수식 문제)은 이해 시험 r4에서 s · h가 함께 「작아서 모르겠다」고 짚어 이 판으로 바꿈
# 같은 대화에 이어 보낸 한 줄과 받은 답(틀린 네 문제만 다시 · 1/4)
s = shot("5_다시낸_아래.png")
put("rebub", s.crop((520, 335, 1045, 470)))
put("recard", s.crop((30, 555, 1045, 1677)))

# 바탕색(카드 둘레의 화면 바탕) — 판 바탕을 같은 색으로 깐다
bg = shot("1_받은뒤.png").getpixel((8, 1400))
sizes["_bg"] = list(bg)

json.dump(sizes, open(os.path.join(HERE, "src", "sizes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps(sizes, ensure_ascii=False))

# 효과음은 지난 편(강아지 카드)의 것을 그대로, 배경음은 보유곡 시티팝_147의 28초부터(빈 마디 26.25~27초 밖) 28초
SFX = os.path.join(EP, "..", "synkbrief_강아지카드_20261126", "remotion", "public", "sfx")
os.makedirs(os.path.join(HERE, "public", "sfx"), exist_ok=True)
for f in os.listdir(SFX):
    shutil.copyfile(os.path.join(SFX, f), os.path.join(HERE, "public", "sfx", f))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "28", "-t", "28", "-i", os.path.join(REPO, "docs", "홍보물", "BGM", "시티팝_147.wav"),
                "-ar", "48000", "-ac", "2", os.path.join(HERE, "public", "bgm.wav")], check=True)
# 목소리 — 음성/범수/<줄>.wav
os.makedirs(os.path.join(HERE, "public", "vo"), exist_ok=True)
for f in os.listdir(os.path.join(EP, "음성", "범수")):
    if f.endswith(".wav"):
        shutil.copyfile(os.path.join(EP, "음성", "범수", f), os.path.join(HERE, "public", "vo", f))
print("소리 재료 끝")

# 11번 반려동물 「첨벙댕」 최종 편집(2026-11-03, Claude) — 02_콘티 2절 10컷을 시각 그대로 하드컷으로 잇고, 내레이션 · 음악 · 효과음을 놓고, 자막 · 모션은 Remotion 섞은 판으로 굽는다.
#   python -X utf8 최종편집.py [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/p11/첨벙댕_9x16.mp4 · _폰.mp4 · _반초.jpg
# 11-03 밤 유호님 「세 편에 넣기」: 흰 굵은 글자 + 검은 테 자막(「촌스럽고 맹한 느낌」)을 버리고 자막시안_20261103/remotion의 p11-AB
#   (A 사람 뒤 큰 글자 · 말자막 상자 + 제품 이름 · 끝 브랜드만 레몬 블록, Fable 맹검 1위 · 가림검사 여덟 낱말 100%)를 최종으로 굽는다.
# 내레이션: 시댄스 세 판이 모두 「구명조끼」를 「구명조닉」으로 읽어 일레븐 v4 후보(VOICE). 목소리를 바꾸면 소리 → 판을 다시 돌린다 — 낱말 시각 · 큰 낱말이 따라간다.
# 다시 뽑은 판(p11-04b)이 들어오면 화면이 저절로 그 판을 쓴다(마스크 컷 c04는 rembg로 다시 따야 한다). 후보정 없음(결정 10-24).
import os
import shutil
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p11"
PUB = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/자막시안_public/p11"
CAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "자막시안_20261103")
VOICE = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p11/소리/일레븐후보_20261103/Kevin.mp3"   # 유호님 11-04 Kevin으로 확정(결정 표) — Andre · Miles는 같은 폴더에 후보로 남김
FPS, W, H = 24, 1080, 1920
T = [0, 2.17, 3.80, 6.50, 11.23, 12.83, 13.47, 14.90, 16.27, 19.33, 22.06]   # 컷 경계(02_콘티 2절)

# 컷 번호 → (쓸 판 차례, 그 판에서 시작하는 초)
CUTS = {
    1: (("p11-01-02",), 0.00),   # 샷1 — 2.42초에 샷2로 넘어가니 그 앞까지
    2: (("p11-01-02",), 3.38),   # 샷2 끝 — 걸어 나가 발자국만 남는 구간
    3: (("p11-03b", "p11-03"), 1.30),   # 11-03 MonoGPT p11-03b — 2.75초에 두 사람 가까이로 건너뛰어 놀라는 모습(끊어 붙인 컷처럼 읽힘), 1.30초부터면 「깜짝」에 넘어감
    4: (("p11-04b", "p11-04"), 1.00),
    5: (("p11-05-06",), 0.20),   # 샷1(1.88초에 컷)
    6: (("p11-05-06",), 2.90),   # 샷2 — 손잡이를 쥔 채 살짝 당김
    7: (("p11-07-08",), 0.10),   # 샷1(1.67초에 컷)
    8: (("p11-07-08",), 1.75),   # 샷2 — 다리 사이에 매달린 무표정
    9: (("p11-09c", "p11-09"), 0.40),   # 고글 테 주황(11-04 유호님 — 시작 · 끝 그림의 테만 바꿔 MonoGPT로 다시). 옛 판 p11-09의 둘째 판(__2)은 2.4초에 고개가 휙 돌아 첫 판을 썼다
    10: (("p11-10",), 0.35),     # 놓고 → 쓰다듬고 → 엄지척이 컷 안에, 엄지는 끝 브랜드 글자 아래
}


def picture():
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    paths = []
    for n, (ids, t) in CUTS.items():
        a0, a1 = round(T[n - 1] * FPS), round(T[n] * FPS)
        k = a1 - a0
        pid = C.latest(*ids)
        src = C.clip(pid)
        a = round(t * FPS)
        have = C.frames_of(src)
        if a + k > have:
            a = max(0, have - k)
            print(f"#{n} {pid}: 시작을 {a / FPS:.2f}초로 당김")
        out = os.path.join(d, f"{n:02d}.mp4")
        C.cut_video(src, a, k, W, H, FPS, out)
        paths.append(out)
        print(f"#{n} {pid} {a / FPS:.2f}초부터 {k}장")
    C.join_videos(paths, os.path.join(OUT, "화면.mp4"))   # 10번 컷까지 이은 옛 화면 — `엄지끝` 판 몫
    dog_picture()


def dog_picture():
    # 최종 화면(11-04 유호님 「고글 개 끝으로」 · 「고글 색 있는 테」 · 「밑에 첨벙댕 이거 너무 슬롭」, 결정 표) — 9번 컷(주황 고글)을 판 끝까지 잇고,
    # 그 마지막 프레임에서 시작한 물 판(p11-11x — 조끼 덕에 개가 뜨고 화면이 물 위 · 물속으로 갈린다)에 글자를 얹어 잇는다(끝합성.py). 1~8번은 picture()가 자른 _컷을 그대로 쓴다
    d = os.path.join(OUT, "_컷")
    ids, t = CUTS[9]
    src = C.clip(C.latest(*ids))
    a = round(t * FPS)
    live = C.frames_of(src) - a
    out = os.path.join(d, "09_개끝.mp4")
    C.cut_video(src, a, live, W, H, FPS, out)
    raw = os.path.join(d, "10_물_원판.mp4")
    C.cut_video(C.clip("p11-11x"), 0, C.frames_of(C.clip("p11-11x")), W, H, FPS, raw)
    wet = os.path.join(d, "10_물.mp4")
    C.run(sys.executable, "-X", "utf8", os.path.join(os.path.dirname(os.path.abspath(__file__)), "끝합성.py"), wet, "--물", raw)
    paths = [os.path.join(d, f"{n:02d}.mp4") for n in range(1, 9)] + [out, wet]
    C.join_videos(paths, os.path.join(OUT, "화면_개끝.mp4"))
    print(f"#9 {live}장 + 물 {C.frames_of(wet)}장")


def sound():
    # 낱말 시각표(remotion/src/p11/timing.ts) → 그 자리에 내레이션 · 음악(말 밑 −17) · 바다 · 효과음(자막시안 시안소리.py)
    C.run(sys.executable, "-X", "utf8", os.path.join(CAP, "내레이션시각.py"), VOICE)
    C.run(sys.executable, "-X", "utf8", os.path.join(CAP, "시안소리.py"), VOICE)
    shutil.copyfile(os.path.join(PUB, "sound_narr.wav"), os.path.join(OUT, "소리.wav"))


def render(comp="p11-AB-dog", pic_name="화면_개끝.mp4", pub_name="picture_dog.mp4", name="첨벙댕_9x16"):
    pic = os.path.join(OUT, pic_name)
    if not os.path.exists(os.path.join(PUB, pub_name)) or C.md5(pic) != C.md5(os.path.join(PUB, pub_name)):
        shutil.copyfile(pic, os.path.join(PUB, pub_name))
    out, raw = os.path.join(OUT, f"{name}.mp4"), os.path.join(OUT, f"_렌더_{name}.mp4")
    C.run(shutil.which("npx"), "remotion", "render", "src/index.ts", comp, raw, "--concurrency=4", "--log=error", cwd=os.path.join(CAP, "remotion"))
    # 소리만 다시 담아 올림 기준(스테레오 AAC 320k 이상)을 맞춘다 — Remotion AAC는 317k로 영상사전검사 「검토」(11-04)
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), raw, out, "--목표", "-14", "--덮어쓰기")
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", os.path.join(OUT, f"{name}_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=200:-2,tile=12x4:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, f"_반초_{name}.jpg"))
    print(out)


if __name__ == "__main__":
    what = sys.argv[1:] or ["화면", "소리", "판"]
    if "엄지끝" in what:   # 고르기 전 판(남자 엄지 + 레몬 판) — 나란히 볼 때만
        render("p11-AB", "화면.mp4", "picture.mp4", "첨벙댕_9x16_엄지끝")
        what = [w for w in what if w != "엄지끝"]
    for w in what:
        {"화면": picture, "소리": sound, "판": render}[w]()

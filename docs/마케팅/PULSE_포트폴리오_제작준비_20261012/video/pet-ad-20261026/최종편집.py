# 11번 반려동물 「첨벙댕」 최종 편집(2026-11-03, Claude) — 02_콘티 2절 10컷을 시각 그대로 하드컷으로 잇고, 내레이션 · 음악 · 효과음을 놓고, 자막 · 모션은 Remotion 섞은 판으로 굽는다.
#   python -X utf8 최종편집.py [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/p11/첨벙댕_9x16.mp4 · _폰.mp4 · _반초.jpg
# 11-05 유호님 「이 판으로 바꿔」: 최종은 B급 판이다(CUTS_B · B급소리.py · remotion p11-viral). 「화면」이 번쩍 컷 앞판(집게앞판.py)까지 같이 딴다.
# 앞 판(섞은 판 자막 + 물 위아래로 갈리는 끝)은 옛화면 · 옛소리 · 옛판으로 다시 구울 수 있고, 파일은 첨벙댕_9x16_물판끝으로 남겼다. p11-04b는 11-05부터 내지 않는다.
#   그 판은 11-03 밤 유호님 「세 편에 넣기」로 자막시안_20261103/remotion의 p11-AB(A 사람 뒤 큰 글자 · 말자막 상자 + 제품 이름 · 끝 브랜드만 레몬 블록)를 구웠다.
# 내레이션: 시댄스 세 판이 모두 「구명조끼」를 「구명조닉」으로 읽어 일레븐 v4 후보(VOICE). 목소리를 바꾸면 자막시안 내레이션시각.py → 소리 → 판을 다시 돌린다 — 낱말 시각이 따라간다.
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


# B급 판(11-04 유호님 「B급처럼 재밌게」 · 「필요하면 아예 다시 뽑아도 좋아」, 결정 표) — 내레이션은 그대로, 화면은 개가 정말 외계인처럼 군다.
# (판, 그 판에서 시작하는 장, 끝나는 화면 장) — 장 번호는 24fps. 낱말 시각은 timing.ts, 효과음은 B급소리.py, 글자는 remotion/src/p11/B.tsx가 같은 값을 쓴다.
# 넷째 값이 있으면 그 판의 장까지를 이 자리에 맞춰 빠르게 돌린다(고정 카메라 판이라 끊긴 데 없이 낱말에 맞는다).
CUTS_B = [
    ("p11-b01", 20, 52, 97),     # 귀가 레이더처럼 따로 돌고 고개가 넘어간다(×1.48, 첫 프레임부터 돈다) — 외계인 닮은 우리 개는 바닷가에서
    ("p11-b02", 30, 91),         # 달 중력으로 너무 오래 떠 있다 — 뛰어노는 걸 제일 좋아해요
    ("p11-b03", 4, 131, 62),     # 막대기처럼 솟아 떠 있고 두 사람은 얼어붙는다(×1.45) — 근데 사람들이 보면
    ("p11-b03", 62, 163),        # 깜짝에 비명, 남자는 넘어져 기어 나간다 — 깜짝 놀라요
    ("p11-b04c", 14, 185, 73),   # 눈이 켜지고 조끼가 슉 떠오른다(×2.68) — 그래서 올해는
    ("p11-b04e", 0, 191),        # 조끼가 휙 날아와 철썩(6장) — 특별한
    ("p11-b04e", 6, 216, 42),    # 끈이 진짜 촉수가 되어 꿀렁인다(×1.44) — 특별한 걸 준비했어요
    ("p11-b04e", 42, 280, 97),   # 촉수가 들어가고 아무 일 없다는 듯 앉아 있다(×0.86) — 첨벙댕 구명조끼! 값도 착하고
    ("p11-b05", 12, 304, 54),    # 조끼를 쥔 채 고개가 뒤통수까지 돈다 — 튼튼해요
    ("p11-b05b", 40, 318, 78),   # 점점 빨라져 빙글빙글 — 등에 손잡이가
    ("p11-b05b", 85, 330),       # 뚝 멈춰 무표정 — 두 개라(고정 카메라 두 판이라 고개만 튄다)
    ("p11-b07", 25, 371),        # 뽑기 집게가 손잡이를 물어 번쩍 — 물에서도 번쩍 건져요
    ("p11-b09", 15, 453),        # 샴푸 광고 바람 → 슬그머니 공중 부양 — 올해는 진짜 멋있을 거예요. 아무도 외계인인 줄 모를걸요?
    ("p11-b11", 0, 574),         # 물이 차고 중력이 돌아와 첨벙, 코르크처럼 떠오른다 — 물놀이 가는 날엔, 첨벙댕, 우주에서도 뜹니다
    ("p11-s1", 21, 622),         # 궤도(제 속도 — 32장에서 집게가 벌어져 놓치고 빈 집게가 위로 날아간다. 속도는 손대지 않는다, 결정 10-24) — 본편 집게가 손잡이를 물었다 놓치고 개는 그대로 떠 있다(11-05 유호님 「집게 컷으로」). 622장부터 632장은 B.tsx가 검정
]


def b_picture():
    d = os.path.join(OUT, "_컷B")
    os.makedirs(d, exist_ok=True)
    paths, at = [], 0
    for i, cut in enumerate(CUTS_B):
        pid, a, end = cut[:3]
        k = end - at
        src = C.clip(pid)
        have = C.frames_of(src)
        out = os.path.join(d, f"{i:02d}.mp4")
        if len(cut) > 3:
            b = cut[3]
            speed = (b - a) / k
            if b > have:
                raise SystemExit(f"{pid}: {b}장까지 필요한데 {have}장뿐")
            vf = (f"select='between(n,{a},{b - 1})',setpts=N/({FPS}*{speed:.5f})/TB,fps={FPS},"
                  f"scale={W}:{H}:flags=lanczos:out_color_matrix=bt709,format=yuv420p")
            C.run("ffmpeg", "-y", "-v", "error", "-i", src, "-an", "-vf", vf, "-frames:v", str(k), "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS),
                  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out)
            print(f"{i} {pid} {a}~{b}장을 {k}장으로(×{speed:.2f}) → 화면 {at / FPS:.2f}~{end / FPS:.2f}초")
        else:
            if a + k > have:
                raise SystemExit(f"{pid}: {a}장부터 {k}장이 필요한데 {have}장뿐")
            C.cut_video(src, a, k, W, H, FPS, out)
            print(f"{i} {pid} {a}장부터 {k}장 → 화면 {at / FPS:.2f}~{end / FPS:.2f}초")
        if C.frames_of(out) != k:
            raise SystemExit(f"{out}: {k}장이어야 하는데 {C.frames_of(out)}장")
        paths.append(out)
        at = end
    C.join_videos(paths, os.path.join(OUT, "화면_B급.mp4"))
    # 번쩍 컷의 앞판 — 화면을 다시 이으면 같이 딴다(현장 노트 「빛줄기를 피사체 뒤로 보내려면」)
    i = next(n for n, c in enumerate(CUTS_B) if c[0] == "p11-b07")
    C.run(sys.executable, "-X", "utf8", os.path.join(os.path.dirname(os.path.abspath(__file__)), "집게앞판.py"),
          os.path.join(OUT, "화면_B급.mp4"), str(CUTS_B[i - 1][2]), str(CUTS_B[i][2]), C.clip("p11-b07"), str(CUTS_B[i][1]))


def b_sound():
    C.run(sys.executable, "-X", "utf8", os.path.join(os.path.dirname(os.path.abspath(__file__)), "B급소리.py"), VOICE)


def sound():
    # 낱말 시각표(remotion/src/p11/timing.ts) → 그 자리에 내레이션 · 음악(말 밑 −17) · 바다 · 효과음(자막시안 시안소리.py)
    C.run(sys.executable, "-X", "utf8", os.path.join(CAP, "내레이션시각.py"), VOICE)
    C.run(sys.executable, "-X", "utf8", os.path.join(CAP, "시안소리.py"), VOICE)
    shutil.copyfile(os.path.join(PUB, "sound_narr.wav"), os.path.join(OUT, "소리.wav"))


def render(comp, pic_name, pub_name, name, jobs=4):
    pic = os.path.join(OUT, pic_name)
    if not os.path.exists(os.path.join(PUB, pub_name)) or C.md5(pic) != C.md5(os.path.join(PUB, pub_name)):
        shutil.copyfile(pic, os.path.join(PUB, pub_name))
    out, raw = os.path.join(OUT, f"{name}.mp4"), os.path.join(OUT, f"_렌더_{name}.mp4")
    C.run(shutil.which("npx"), "remotion", "render", "src/index.ts", comp, raw, f"--concurrency={jobs}", "--log=error", cwd=os.path.join(CAP, "remotion"))
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
        {"화면": b_picture, "소리": b_sound,
         "판": lambda: render("p11-viral", "화면_B급.mp4", "picture_b.mp4", "첨벙댕_9x16", jobs=2),
         "우주판": lambda: render("p11-viral", "화면_B급.mp4", "picture_b.mp4", "첨벙댕_9x16_우주판", jobs=2),   # 지금 끝과 맹검으로 견주는 동안은 최종을 덮지 않는다   # 다른 세션이 메모리를 쓰는 때 4개는 크롬이 죽었다(11-04)
         "옛화면": picture, "옛소리": sound,
         "옛판": lambda: render("p11-AB-dog", "화면_개끝.mp4", "picture_dog.mp4", "첨벙댕_9x16_물판끝")}[w]()

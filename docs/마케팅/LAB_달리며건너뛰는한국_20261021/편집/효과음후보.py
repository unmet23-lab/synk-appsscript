# 「달리며 건너뛰는 한국」 효과음 후보(2026-11-07, Claude) — stable-audio-3(ZeroGPU, 돈 안 나감)로 소리 종류마다 짧게 굽는다.
#   python -X utf8 편집/효과음후보.py [<이름> …]   → git 밖 synk-vendor/korea-run-montage-20261021/편집/소리/효과음/<이름>.wav
# 영상 판에 딸려 온 소리(드리미나는 소리 끔 칸이 없어 약한 효과음이 붙는다)는 쓰지 않는다(결정 10-19 · 제작 규칙 「소리」) — 효과음은 소리 종류로 따로.
# 서울 지하철 실제 안내 선율은 베끼지 않는다(「generic two-tone chime」).
import glob
import json
import os
import shutil
import subprocess
import sys

REPO = "C:/Users/q1212/Documents/SYNK-appsscript"
OUT = "C:/Users/q1212/Documents/synk-vendor/korea-run-montage-20261021/편집/소리/효과음"
TAIL = " Isolated sound effect, no music, no voice, clean close recording, high quality."
JOBS = [
    ("발소리_승강장", "Footsteps of one person in white sneakers walking briskly on a tiled subway platform, about two steps per second, light station room tone." + TAIL, 4, 6101),
    ("테이프", "Strip of duct tape pulled off a roll with a quick tearing rip, then pressed and smoothed onto a glass window with firm finger rubs." + TAIL, 3, 6102),
    ("유리_두드림", "Two open palms pressing and patting flat on a glass window twice, soft muffled thumps on glass." + TAIL, 2, 6103),
    ("문닫힘_차임", "Subway train door warning: a simple generic two-tone electronic chime, then train doors sliding shut with a pneumatic hiss and a soft thud." + TAIL, 4, 6104),
    ("열차_출발", "Electric subway train pulling away from a platform: rising electric motor whine accelerating smoothly, wheels clacking faster and faster on rails." + TAIL, 6, 6105),
    ("달리기", "One person sprinting fast on a hard platform floor in sneakers, quick rhythmic footsteps, heavy breathing absent." + TAIL, 4, 6106),
    ("휙", "Fast airy whoosh swish passing by, short and clean, like a quick camera whip." + TAIL, 2, 6107),
    ("꽃밭_풀썩", "A person diving head first into a dense field of tall flowers: big leafy rustle burst and a soft body thud on soft ground, plants swishing." + TAIL, 3, 6108),
    ("꽃_바스락", "Gentle rustling of tall flower stems and leaves being kicked and wiggled, light playful rustle." + TAIL, 3, 6109),
    ("종이_착", "A sheet of thick paper card sliding quickly and landing flat on a table with a soft crisp tap." + TAIL, 2, 6110),
    ("톡", "One soft short wooden tick click, very short and clean, like a small tap on a felt board." + TAIL, 1, 6111),
]
# 11-07 둘째 차례 — 첫 판을 Gemini에 들려 보니(편집/소리/효과음/_맹검.txt) 테이프 · 열차 주행 · 유리만 맞고 발소리는 「박수」, 달리기는 「구두 걷기」,
#   휙은 「칼 뽑는 쇳소리」, 꽃밭은 「비닐 봉지」로 들렸다. 소리 낱말을 폴리 녹음처럼 구체적으로 바꿔 씨앗 셋씩.
FOLEY = " Realistic foley sound effect recording, no music, no voice."
SECOND = [
    ("발소리2", "Close-up foley of rubber-soled sneaker footsteps walking on a hard concrete subway platform, steady relaxed walking pace, "
               "about two steps per second, slight reverb of an underground station." + FOLEY, 3),
    ("유리2", "Two open hands slapping and pressing flat against a window pane of glass, two soft hollow glassy thumps with a tiny squeak." + FOLEY, 2),
    ("문닫힘2", "Subway train sliding doors closing: a short pneumatic air hiss, then the rubber door edges meet with a soft muffled thump." + FOLEY, 3),
    ("달리기2", "Fast running footsteps of rubber sneakers on a hard concrete floor, a person sprinting, quick rhythm about four steps per second." + FOLEY, 3),
    ("휙2", "A soft airy wind whoosh swoosh for a fast video transition, breathy air movement only, no metal, no ringing." + FOLEY, 2),
    ("풀썩2", "A person falls face first into a thick bush of tall leafy plants: a loud crash of rustling leaves and stems and a dull soft thud on the earth." + FOLEY, 3),
    ("바스락2", "Two legs kicking and wiggling inside tall leafy plants, light rustling of leaves and stems, playful." + FOLEY, 3),
    ("종이2", "A thick piece of cardboard dropped flat onto a wooden table, one short soft slap." + FOLEY, 1),
    ("톡2", "A single soft muted click, like pressing a soft rubber button once." + FOLEY, 1),
]
JOBS += [(f"{n}{c}", p, sec, 7000 + 10 * i + k) for i, (n, p, sec) in enumerate(SECOND) for k, c in enumerate("abc")]
# 11-07 셋째 차례 — Gemini 소리 맹검(v4, flash-lite) 「10.0초 드롭에 한 방이 약함 · 폰 시점 소리가 비어 있음 · 끝이 갑자기 사그라듦 · 다이빙이 물소리 같음」
THIRD = [
    ("한방", "One deep cinematic impact hit for a music drop: a punchy low boom with a short sub drop tail, clean and powerful." + FOLEY, 2),
    ("상승", "A short reverse cymbal swell rising into a hit, airy and bright, about one second long, ending abruptly." + FOLEY, 2),
    ("승강장", "Quiet underground subway platform ambience: low electric hum, faint distant train rumble, soft air flow, no voices, no announcements." + FOLEY, 10),
    ("꽃밭바람", "Gentle wind blowing over a wide field of flowers, soft rustle of plants, a few faraway birds, calm and open." + FOLEY, 6),
    ("털썩", "A body landing face down in a thick soft bed of leafy plants: one dull muffled thud and a short burst of dry leaf rustling, no water." + FOLEY, 2),
]
JOBS += [(f"{n}{c}", p, sec, 8000 + 10 * i + k) for i, (n, p, sec) in enumerate(THIRD) for k, c in enumerate("ab")]


def main():
    want = sys.argv[1:]
    os.makedirs(OUT, exist_ok=True)
    for name, prompt, sec, seed in JOBS:
        if want and name not in want:
            continue
        dst = os.path.join(OUT, name + ".wav")
        if os.path.exists(dst):
            print("있음", name)
            continue
        before = set(glob.glob(os.path.join(OUT, "*", "*.wav")))
        env = dict(os.environ, MSYS_NO_PATHCONV="1", PYTHONIOENCODING="utf-8")
        r = subprocess.run([sys.executable, "-X", "utf8", os.path.join(REPO, "tools", "허깅페이스.py"), "부르기", "stabilityai/stable-audio-3", "--api", "/infer",
                            "--인자", json.dumps(["medium", prompt, sec, 8, 1.0, "pingpong", seed]), "--예상초", "60", "--받을곳", OUT,
                            "--메모", f"달리며 건너뛰는 한국 효과음 {name}"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
        new = sorted(set(glob.glob(os.path.join(OUT, "*", "*.wav"))) - before)
        if not new:
            print("못 받음", name, (r.stdout + r.stderr)[-400:], flush=True)
            continue
        shutil.move(new[0], dst)
        shutil.rmtree(os.path.dirname(new[0]), ignore_errors=True)
        print("받음", name, flush=True)
    json.dump([{"이름": n, "지시문": p, "초": s, "씨앗": d} for n, p, s, d in JOBS], open(os.path.join(OUT, "_지시문.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

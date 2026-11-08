# 10번 내레이션 고르기 판(2026-11-08, Claude) — 일레븐 v4 후보 넷(아이작 · 애셔 · 헨리 · 에스엠, 내레이션_후보.py)을 실제 장면 위에서 견준다.
#   후보마다 최종소리.py를 P10_NARR=<이름>으로 다시 섞어(같은 곡 · 효과음 · 같은 자리) 39.5~60.04초를 잘라 잇는다. 자막은 아이작 시각이라 넣지 않는다(화면.mp4).
#   위 검은 띠에 번호와 이름(고르기용 표시). 크기는 최종본 마감 이득(최종본 LUFS − 아이작 섞음 LUFS)을 똑같이 주고 같은 리미터를 건다.
#   11-08 유호님이 「--초반」 판의 31초 이음매(아이작 구간 끝 운전대 → 애셔 구간 0초 준호 얼굴, 곡도 처음으로)를 영상 결함으로 보셨다(02_콘티 22절) —
#   구간 앞에 검은 이름 카드(CARD초, 무음)를 넣고 구간 끝 그림 · 소리를 잦아들게 해, 이어 붙인 자리가 「목소리를 바꿔 처음부터 다시」로 읽히게 한다.
#   python -X utf8 목소리견줌.py [--초반]   → git 밖 최종/p10/_고르기/목소리_내레이션_넷(_초반).mp4 · _폰.mp4(최종본을 렌더한 뒤에 — 마감 이득을 최종본에서 잰다)
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))
import 최종편집 as E

OUT = os.path.join(E.OUT, "_고르기")
NAMES = ["아이작", "애셔", "헨리", "에스엠"]
A, B = 39.5, E.TF[-1]
DST = "목소리_내레이션_넷.mp4"
# 11-08 3차 — 내레이션이 처음부터 나오는 원고(「_초반」 판)로 0~31초(줄 다섯)를 견준다:  python -X utf8 목소리견줌.py --초반
if "--초반" in sys.argv:
    NAMES = ["아이작_초반b", "애셔_초반", "헨리_초반", "에스엠_초반"]
    A, B = 0.0, 31.0
    DST = "목소리_내레이션_넷_초반.mp4"
FONT = "C\\:/Windows/Fonts/malgun.ttf"   # 한글 경로 글꼴은 ffmpeg drawtext가 죽는다(8번 목소리견줌.py)
CARD = 1.75                              # 구간 앞 검은 이름 카드(초) — 24장 단위(42장)라 그림 · 소리 길이가 같다
ENC_V = ["-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", str(E.FPS)]
ENC_A = ["-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2"]


def lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-map", "0:a", "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)[-1])


def mix_of(name):
    wav = os.path.join(OUT, f"_{name}.wav")
    env = dict(os.environ, P10_NARR=name)
    subprocess.run([sys.executable, "-X", "utf8", "-c",
                    "import sys; sys.path.insert(0, r'%s'); sys.path.insert(0, r'%s'); import 최종소리 as S, 최종편집 as E; S.build(r'%s', E.TF, timing_path=None)"
                    % (HERE, os.path.join(HERE, ".."), wav)], check=True, env=env)
    return wav


def card(k, name, path):
    """구간 앞 검은 카드 — 「목소리 k / 넷  이름」과 「영상 A초부터 다시」, 소리는 무음"""
    who = re.sub(r"_초반.*$", "", name)
    t1 = f"목소리 {k} / {len(NAMES)}  {who}"
    t2 = f"영상 {A:g}초부터 다시 — 그림과 곡은 같고 목소리만 바뀝니다"
    vf = (f"drawtext=fontfile='{FONT}':text='{t1}':x=(w-text_w)/2:y=h/2-100:fontsize=76:fontcolor=white,"
          f"drawtext=fontfile='{FONT}':text='{t2}':x=(w-text_w)/2:y=h/2+24:fontsize=38:fontcolor=0xBBBBBB,setsar=1")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=black:s={E.W}x{E.H}:r={E.FPS}:d={CARD}",
                    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", f"{CARD}", "-vf", vf, *ENC_V, *ENC_A, path], check=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    final = os.path.join(E.OUT, E.NAME + ".mp4")
    gain = lufs(final) - lufs(mix_of(NAMES[0]))
    print(f"마감 이득 {gain:+.2f} dB")
    parts = []
    for k, name in enumerate(NAMES, 1):
        wav = mix_of(name)
        cp = os.path.join(OUT, f"_내레이션_{k}_카드.mp4")
        card(k, name, cp)
        clip = os.path.join(OUT, f"_내레이션_{k}.mp4")
        d = B - A
        label = f"내레이션 {k} · 일레븐 v4 {re.sub(r'_초반.*$', '', name)}"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{A}", "-to", f"{B}", "-i", os.path.join(E.OUT, "화면.mp4"), "-ss", f"{A}", "-to", f"{B}", "-i", wav,
                        "-map", "0:v", "-map", "1:a",
                        # setsar=1 — 화면.mp4는 SAR 2889:2864를 지녀(판에서 옮겨 옴) 카드(1:1)와 concat 거르개가 「Invalid argument」로 멈췄다
                        "-vf", f"drawtext=fontfile='{FONT}':text='{label}':x=40:y=12:fontsize=34:fontcolor=white,fade=t=out:st={d - 0.45:.3f}:d=0.45,setsar=1",
                        "-af", f"volume={gain:.2f}dB,alimiter=limit=0.89:level=false,afade=t=out:st={d - 0.5:.3f}:d=0.5",
                        *ENC_V, *ENC_A, clip], check=True)
        parts += [cp, clip]
    dst = os.path.join(OUT, DST)
    ins = [a for p in parts for a in ("-i", p)]
    fc = "".join(f"[{i}:v][{i}:a]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=1[v][a]"
    subprocess.run(["ffmpeg", "-y", "-v", "error", *ins, "-filter_complex", fc, "-map", "[v]", "-map", "[a]", *ENC_V, *ENC_A, "-movflags", "+faststart", dst], check=True)
    phone = dst[:-4] + "_폰.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", dst, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "23", "-preset", "medium",
                    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", phone], check=True)
    print(dst, phone)


if __name__ == "__main__":
    main()

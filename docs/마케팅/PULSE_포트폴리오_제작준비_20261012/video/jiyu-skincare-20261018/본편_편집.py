# 지유 스킨케어 광고 · 본편과 훅 판 편집(영상판). 컷 길이·엔드카드·소리는 이미지콘티_가편집.py와 같고, 정지 그림 자리에 영상을 넣는다.
#   python 본편_편집.py [본편 훅B 훅C] [--비율 9:16,4:5,1:1] [--판 v1]
#   → Documents/synk-vendor/jiyu-skincare-20261018/편집/<판이름>_<비율>_<판>.mp4
# 납품(브리프 6절): 본편 9:16·4:5·1:1, 훅 B·C는 9:16만. 비율 판은 같은 원본에서 자르고 병·글자는 비율마다 다시 놓는다.
# 그림 고르는 순서(컷마다 있는 것 가운데 앞의 것):
#   사람·솜 컷: 영상_H3/업/<컷>/*.png(영상_다듬기.py, 1080×1920) → 영상_H3/구간/<컷>.mp4(756×1344을 키움) → 키프레임 정지 그림
#   병 컷: 블렌더/최종/<컷>_*.png → 블렌더/중간/<컷>_*.png
# 엔드카드: 블렌더 팩샷 + 글자(14.0초 타격, 가편집과 같은 겹). 훅 B·C는 첫 2초에 얹는 글자를 넣는다(브리프 3절 훅 표).
# 소리: 음악(음악_15초.py) + 내레이션 세 줄 + 효과음(효과음_목록.json). 끝에 -14 LUFS로 맞추고 봉우리를 누른다.
# 색 맞춤·입자는 후반 한 번(브리프 1절 질감): 아주 옅은 시간 입자만 넣는다.
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import 이미지콘티_가편집 as 가편집  # noqa: E402  엔드카드 겹(end_layer·with_end)과 경로를 같이 쓴다

V = 가편집.V
K = 가편집.K
N = 가편집.N
H3 = os.path.join(V, "영상_H3")
BLF = os.path.join(V, "블렌더", "최종")
BLM = os.path.join(V, "블렌더", "중간")
OUT = os.path.join(V, "편집")
MUSIC = os.path.join(V, "음악", "지유_음악_15초_A1.wav")
SFX = os.path.join(HERE, "효과음_목록.json")  # 배치표는 저장소, 소리 파일은 synk-vendor/…/효과음/
W, H, FPS = 1080, 1920, 24
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
SUIT_M = os.path.join(ROOT, "docs", "브랜드_폰트", "SUIT", "SUIT-Medium.otf")
INK = (52, 52, 50)

# 사람·솜 컷의 정지 그림(영상이 아직 없을 때 대신 쓴다)
STILL = {"컷1": "컷1_v3.jpg", "컷3": "컷3_시작_창.jpg", "컷4": "컷4_v4_틀.jpg", "컷5": "컷5_v3b_틀.jpg",
         "컷7": "컷7_v6b_틀.jpg", "훅C": "훅C_틀.jpg"}
# (시작초, 끝초, 종류:이름) — 사람: 영상_H3 컷, 병: 블렌더 컷
BODY = [(4.0, 6.0, "사람:컷3"), (6.0, 8.0, "사람:컷4"), (8.0, 10.0, "사람:컷5"), (10.0, 12.0, "병:컷6"), (12.0, 15.0, "사람:컷7")]
EDITS = {
    "본편": {"head": [(0.0, 2.0, "사람:컷1"), (2.0, 4.0, "병:컷2")], "line1": 0.3, "text": None},
    # 훅 B: 병 0–2(물방울은 2.0 직전에 흘러내림) → 지유 2–4, 내레이션 첫 줄은 지유 컷으로.
    # 글자: 병 접사는 위쪽을 뚜껑이, 아래쪽을 라벨이 차지해 창 쪽(왼쪽) 위 흐린 벽에 두 줄로
    "훅B": {"head": [(0.0, 2.0, "병:컷2"), (2.0, 4.0, "사람:컷1")], "line1": 2.3,
            "text": (["약산성", "무향 토너"], "la", (72, 210))},
    # 훅 C: 수건 컷은 머리가 위 끝에 붙어 위쪽 글자 자리가 없다 → 머리카락 끝(1650쯤) 아래 흰 티 위
    "훅C": {"head": [(0.0, 2.0, "사람:훅C"), (2.0, 4.0, "병:컷2")], "line1": 0.3,
            "text": (["세안 후 3초, 토너부터"], "mm", (540, 1740))},
}
# 비율: 9:16 원본에서 잘라 낸다. 사람 컷은 가운데 자르기면 머리가 잘린다 → 헤어밴드 윗선(1080×1920 기준 컷 1 약 170,
# 컷 4 약 130, 컷 5 약 160, 컷 7 약 310, 정지 그림에서 잼) 위로 70px쯤 남기고 자른다. 병 컷 2는 라벨까지 들어오게 아래로.
RATIOS = {"9:16": (1080, 1920), "4:5": (1080, 1350), "1:1": (1080, 1080)}
CROP_Y = {
    "9:16": {},
    "4:5": {"사람": 200, "컷1": 100, "컷4": 60, "컷5": 90, "컷7": 200, "컷2": 470, "컷3": 285, "컷6": 285},
    "1:1": {"사람": 230, "컷1": 100, "컷4": 60, "컷5": 90, "컷7": 230, "컷2": 700, "컷3": 420, "컷6": 420},
}
# 엔드카드 자리(자른 화면 좌표): 9:16은 가편집과 같다. 1:1은 병을 줄이고 올려 글자까지 들어오게
END_LAYOUTS = {
    "9:16": 가편집.END_LAYOUT,
    "4:5": {**가편집.END_LAYOUT, "bottle_bottom": 가편집.END_LAYOUT["bottle_bottom"] - 200},
    "1:1": {**가편집.END_LAYOUT, "bottle_h": 340, "bottle_bottom": 760, "text_w": 260},
}


def numbered(folder, prefix=""):
    """<prefix><숫자>.png만 번호 순으로(블렌더 제품 교체판 「컷2_soom_0001.png」 같은 이름은 뺀다)."""
    pat = re.compile(re.escape(prefix) + r"(\d+)\.png$")
    files = [(int(m.group(1)), f) for f in glob.glob(os.path.join(folder, "*.png"))
             if (m := pat.fullmatch(os.path.basename(f)))]
    return [f for _, f in sorted(files)]


def fit(im):
    s = W / im.width
    im = im.resize((W, round(im.height * s)), Image.LANCZOS)
    top = (im.height - H) // 2
    return im.crop((0, top, W, top + H))


def read_video(path, n):
    """mp4를 1080×1920 프레임으로(폭을 1080에 맞춰 키우고 가운데 9:16)."""
    p = subprocess.Popen(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vf",
                          f"scale={W}:-2:flags=lanczos,crop={W}:{H}", "-frames:v", str(n), "-f", "rawvideo",
                          "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, stdin=subprocess.DEVNULL)
    size = W * H * 3
    for _ in range(n):
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        yield Image.frombytes("RGB", (W, H), buf)
    p.stdout.close()
    p.wait()


def source(kind, name, n):
    """길이 n의 1080×1920 프레임을 차례로 낸다. 모자라면 마지막 프레임을 늘인다."""
    if kind == "사람":
        # SeedVR2 CLI는 <출력>/<입력 이름>/<입력 이름>_000000.png로 쓴다(영상_다듬기.py의 입력 이름 = 컷 이름)
        up = numbered(os.path.join(H3, "업", name, name), f"{name}_")
        clip = os.path.join(H3, "구간", f"{name}.mp4")
        if up:
            gen, what = (fit(Image.open(f).convert("RGB")) for f in up[:n]), f"업스케일 {len(up)}장"
        elif os.path.exists(clip):
            gen, what = read_video(clip, n), "구간 영상(키우기 전)"
        else:
            gen, what = iter([fit(Image.open(os.path.join(K, STILL[name])).convert("RGB"))]), "정지 그림"
    else:
        fin = numbered(BLF, f"{name}_")
        files = fin or numbered(BLM, f"{name}_")
        gen, what = (fit(Image.open(f).convert("RGB")) for f in files[:n]), ("블렌더 최종" if fin else "블렌더 중간")
    print(f"  {name}: {what}", flush=True)
    last, made = None, 0
    for im in gen:
        if made >= n:
            break
        last, made = im, made + 1
        yield im
    for _ in range(n - made):
        yield last


def text_layer(spec, size):
    """훅 글자 겹: 짙은 글자(창 쪽 흰 글자 금지), SUIT Medium 62px, 줄 간격 1.3."""
    lines, anchor, (x, y) = spec
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    font = ImageFont.truetype(SUIT_M, 62)
    for i, line in enumerate(lines):
        d.text((x, y + i * 80), line, font=font, fill=INK + (255,), anchor=anchor)
    return layer


def crop_y(kind, name, ratio, h):
    table = CROP_Y[ratio]
    y = table.get(name, table.get(kind, (H - h) // 2))
    return max(0, min(H - h, y))


def frames(edit, ratio):
    w, h = RATIOS[ratio]
    plan = EDITS[edit]["head"] + BODY
    pack = numbered(BLF, "컷7팩샷_")
    layer = 가편집.end_layer(END_LAYOUTS[ratio], (w, h), pack[0] if pack else None)
    spec = EDITS[edit]["text"]
    text = text_layer(spec, (w, h)) if spec and ratio == "9:16" else None
    for start, end, src in plan:
        kind, name = src.split(":")
        n = round((end - start) * FPS)
        y0 = crop_y(kind, name, ratio, h)
        for i, im in enumerate(source(kind, name, n)):
            t = start + i / FPS
            im = im.crop((0, y0, w, y0 + h))
            if name == "컷7":
                im = 가편집.with_end(im, layer, min(1.0, max(0.0, (t - END_LAYOUTS[ratio]["appear"]) / 0.15)))
            if text is not None and t < 2.0:
                a = min(1.0, t / 0.15, max(0.0, (2.0 - t) / 0.15))  # 0.15초에 들어와 1.85초부터 빠진다
                lay = text.copy()
                lay.putalpha(lay.getchannel("A").point(lambda v: int(v * a)))
                base = im.convert("RGBA")
                base.alpha_composite(lay)
                im = base.convert("RGB")
            yield im


def audio_args(edit):
    """소리 입력과 섞기 필터(내레이션 + 음악 + 효과음, 15초로 못 박음)."""
    lines = [("1_세안하고.wav", EDITS[edit]["line1"]), ("2_피부가먼저.wav", 6.0), ("3a_말금.wav", 12.6)]
    args, filt, labels = [], [], []
    k = 0
    for f, t in lines:
        args += ["-i", os.path.join(N, f)]
        ms = int(t * 1000)
        filt.append(f"[{k}:a]aresample=48000,adelay={ms}|{ms}[n{k}]")
        labels.append(f"[n{k}]")
        k += 1
    args += ["-i", MUSIC]
    filt.append(f"[{k}:a]aresample=48000,volume=0.35[m]")
    labels.append("[m]")
    k += 1
    if os.path.exists(SFX):
        for s in json.load(open(SFX, encoding="utf-8")):
            if edit not in s.get("edits", [edit]):
                continue
            t = s["at"] + s.get("shift", {}).get(edit, 0)
            args += ["-i", os.path.join(V, "효과음", s["file"])]
            ms = int(t * 1000)
            filt.append(f"[{k}:a]aresample=48000,volume={s.get('gain', 1.0)},adelay={ms}|{ms}[s{k}]")
            labels.append(f"[s{k}]")
            k += 1
    # 무음 채우기는 길이를 못 박는다(apad=whole_dur) — 끝없는 apad는 ffmpeg가 멈췄다(현장 노트, 10-18)
    filt.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest,apad=whole_dur=15,atrim=0:15[mix]")
    return args, filt


def loudness(path):
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "info", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, stdin=subprocess.DEVNULL)
    err = r.stderr.decode("utf-8", "ignore")
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", err)
    p = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", err)
    return (float(i[-1]) if i else None), (float(p[-1]) if p else None)


def mix_audio(edit, tmp):
    """섞고 -14 LUFS로 맞춘 뒤 봉우리를 누른다(누른 뒤 다시 재서 한 번 더 맞춤)."""
    raw = os.path.join(tmp, "a_raw.wav")
    a_args, a_filt = audio_args(edit)
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", *a_args, "-filter_complex", ";".join(a_filt),
                    "-map", "[mix]", "-ar", "48000", "-ac", "2", raw], check=True, stdin=subprocess.DEVNULL)
    gain = 0.0
    out = os.path.join(tmp, "a.wav")
    for _ in range(2):
        lufs, _ = loudness(raw if gain == 0.0 else out)
        gain += -14.0 - lufs if lufs is not None else 0.0
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", raw, "-af",
                        f"volume={gain:.2f}dB,alimiter=limit=0.79:level=false", "-ar", "48000", out],
                       check=True, stdin=subprocess.DEVNULL)
    return out


def render(edit, ratios, tag):
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp()
    audio = mix_audio(edit, tmp)
    outs = []
    for ratio in ratios:
        if edit != "본편" and ratio != "9:16":
            print(f"{edit} {ratio}: 납품 목록에 없음(훅 판은 9:16만) — 건너뜀", flush=True)
            continue
        w, h = RATIOS[ratio]
        print(f"{edit} {ratio}: 그림", flush=True)
        video = os.path.join(tmp, f"v_{ratio.replace(':', 'x')}.mp4")
        enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
                                "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "14", "-preset", "slow",
                                "-pix_fmt", "yuv420p", video], stdin=subprocess.PIPE)
        count = 0
        for im in frames(edit, ratio):
            enc.stdin.write(im.tobytes())
            count += 1
        enc.stdin.close()
        if enc.wait() != 0:
            raise SystemExit("영상 인코딩 실패")
        out = os.path.join(OUT, f"{edit}_{ratio.replace(':', 'x')}_{tag}.mp4")
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", video, "-i", audio,
                        "-vf", "noise=c0s=3:c0f=t", "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "18",
                        "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-t", "15",
                        "-movflags", "+faststart", out], check=True, stdin=subprocess.DEVNULL)
        i, p = loudness(out)
        print(f"  프레임 {count}장 → {out} ({i} LUFS, 봉우리 {p} dBFS)", flush=True)
        outs.append(out)
    return outs


if __name__ == "__main__":
    args = sys.argv[1:]
    ratios = ["9:16"]
    tag = "v1"
    if "--비율" in args:
        ratios = args[args.index("--비율") + 1].split(",")
    if "--판" in args:
        tag = args[args.index("--판") + 1]
    edits = [a for a in args if a in EDITS] or ["본편"]
    for e in edits:
        render(e, ratios, tag)

# 지유 스킨케어 광고: 이미지 콘티 가편집(정지 그림 + 내레이션, 콘티 v2 2·3절 시각) — 영상을 뽑기 전에 리듬·컷 길이를 확인하는 판
#   python 이미지콘티_가편집.py [음악.wav]   → Documents/synk-vendor/jiyu-skincare-20261018/가편집/이미지콘티_v3(_음악).mp4
# 그림: 키프레임_A(Gemini, 10-18 Fable 지적 반영판 · `_틀`은 키프레임_틀.py로 자른 것), 블렌더 병 컷(2·6)·엔드카드 팩샷.
# 시작·끝 그림이 있는 컷은 두 그림을 서서히 섞어 움직임 방향만 보여 준다. 24fps, 1080×1920.
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageFilter

sys.stdout.reconfigure(encoding="utf-8")
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018")
K = os.path.join(V, "키프레임_A")
N = os.path.join(V, "내레이션")
OUT = os.path.join(V, "가편집")
W, H, FPS = 1080, 1920, 24

# 블렌더 병 컷(2·6)과 엔드카드 팩샷: CPU 중간 화질(540×960·48샘플). GPU 최종 렌더가 나오면 블렌더/최종으로 바꾼다
BL = os.path.join(V, "블렌더", "중간")

# (시작초, 끝초, 그림 또는 카드, 끝 그림) — 콘티 v2 3절. 그림은 키프레임_A 안 이름이거나 절대 경로
CUTS = [
    (0.0, 2.0, "컷1_v3.jpg", None),
    (2.0, 4.0, os.path.join(BL, "컷2_0001.png"), os.path.join(BL, "컷2_0048.png")),
    (4.0, 6.0, "컷3_시작_창.jpg", "컷3_끝_창.jpg"),
    (6.0, 8.0, "컷4_v2_틀.jpg", None),
    (8.0, 10.0, "컷5_v3b_틀.jpg", None),
    (10.0, 12.0, os.path.join(BL, "컷6_0001.png"), os.path.join(BL, "컷6_0048.png")),
    (12.0, 15.0, "컷7_v6b_틀.jpg", None),
]
END_CARD = "컷7_v6b_틀.jpg"
LINES = [("1_세안하고.wav", 0.3), ("2_피부가먼저.wav", 6.0), ("3a_말금.wav", 12.6)]
# 엔드카드: 병 팩샷(블렌더, 최종 렌더가 나오면 경로를 바꾼다)과 글자(블렌더/라벨.py). 브랜드명은 12.6초에 말하고, 병·글자는 14.0초 타격에 나타난다.
PACK = os.path.join(BL, "컷7팩샷_0001.png")
ECTEXT = os.path.join(V, "블렌더", "엔드카드글자_malgeum.png")
# 컷7_v3_틀(1080 폭): 지유 팔 바깥선 x≈735, 머리(헤어밴드~턱) 470px ≈ 23cm → 병 140mm의 1.4배 ≈ 420px
END_LAYOUT = {"cx": 885, "bottle_h": 420, "bottle_bottom": 1290, "text_gap": 40, "text_w": 300, "appear": 14.0}


def fit(path):
    im = Image.open(path).convert("RGB")
    s = W / im.width
    im = im.resize((W, round(im.height * s)), Image.LANCZOS)
    top = (im.height - H) // 2
    return im.crop((0, top, W, top + H))


def end_layer():
    # 엔드카드 겹(투명 바탕 1080×1920): 블렌더 팩샷(그래픽 팩샷, 벽에 부드러운 그림자) + 병 아래 가운데 글자.
    # 10-18 Fable 검수: 병을 머리 옆에 띄우고 글자를 위쪽 벽에 둔 첫 배치는 스티커처럼 보였다 → 오른쪽 그늘 벽 가슴 높이에 병, 글자는 병 아래.
    L = END_LAYOUT
    pack = Image.open(PACK).convert("RGBA")
    pack = pack.crop(pack.getchannel("A").getbbox())
    s = L["bottle_h"] / pack.height
    pack = pack.resize((round(pack.width * s), L["bottle_h"]), Image.LANCZOS)
    x0, y0 = L["cx"] - pack.width // 2, L["bottle_bottom"] - pack.height
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # 벽 그림자: 창이 왼쪽이라 오른쪽으로 병 폭 40%만큼 밀려 퍼진다. 10-18 Fable 재검수: 5단계(216→211)는 떠 있는 스티커로 읽혔다 → 15~20단계
    shadow = Image.new("RGBA", pack.size, (40, 38, 36, 0))
    shadow.putalpha(pack.getchannel("A").point(lambda v: int(v * 0.14)))  # 0.42는 73단계로 너무 짙었다
    pad = 70
    sh = Image.new("RGBA", (pack.width + 2 * pad, pack.height + 2 * pad), (0, 0, 0, 0))
    sh.alpha_composite(shadow, (pad, pad))
    sh = sh.filter(ImageFilter.GaussianBlur(22))
    layer.alpha_composite(sh, (x0 - pad + round(pack.width * 0.4), y0 - pad + 12))
    layer.alpha_composite(pack, (x0, y0))
    txt = Image.open(ECTEXT).convert("RGBA")
    txt = txt.crop(txt.getchannel("A").getbbox())
    k = min(1.0, L["text_w"] / txt.width)
    txt = txt.resize((round(txt.width * k), round(txt.height * k)), Image.LANCZOS)
    layer.alpha_composite(txt, (L["cx"] - txt.width // 2, L["bottle_bottom"] + L["text_gap"]))
    return layer


def with_end(base, layer, a):
    # a: 0~1. 14.0초 타격에 0.15초 동안 20px 떠오르며 나타난다
    if a <= 0:
        return base
    lay = layer.copy()
    lay.putalpha(lay.getchannel("A").point(lambda v: int(v * a)))
    out = base.convert("RGBA")
    out.alpha_composite(lay, (0, round((1 - a) * 20)))
    return out.convert("RGB")


def main():
    music = sys.argv[1] if len(sys.argv) > 1 else None
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp()
    n = 0
    layer = end_layer()
    for start, end, src, end_src in CUTS:
        frames = round((end - start) * FPS)
        a = fit(os.path.join(K, src))  # 절대 경로면 join이 그대로 둔다
        b = fit(os.path.join(K, end_src)) if end_src else None
        for i in range(frames):
            im = Image.blend(a, b, i / max(frames - 1, 1)) if b is not None else a
            if src == END_CARD:
                t = start + i / FPS
                im = with_end(im, layer, min(1.0, max(0.0, (t - END_LAYOUT["appear"]) / 0.15)))
            im.save(os.path.join(tmp, f"{n:04d}.png"))
            n += 1
    # 소리: 내레이션 세 줄을 시각에 놓고(음악이 있으면 깔고) 15초로 자른다
    args = ["ffmpeg", "-nostdin", "-v", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(tmp, "%04d.png")]
    for f, _ in LINES:
        args += ["-i", os.path.join(N, f)]
    filt = []
    for k, (_, t) in enumerate(LINES, 1):
        ms = int(t * 1000)
        filt.append(f"[{k}:a]aresample=48000,adelay={ms}|{ms}[n{k}]")
    mix = "".join(f"[n{k}]" for k in range(1, len(LINES) + 1))
    inputs = len(LINES)
    if music:
        args += ["-i", music]
        filt.append(f"[{len(LINES) + 1}:a]aresample=48000,volume=0.35[m]")
        mix += "[m]"
        inputs += 1
    # 무음 채우기는 길이를 못 박는다(apad=whole_dur). 끝없는 apad는 ffmpeg 9에서 출력을 파이프로 받을 때 2MB쯤 쓰고 멈췄다(10-18)
    filt.append(f"{mix}amix=inputs={inputs}:normalize=0:duration=longest,apad=whole_dur=15,atrim=0:15[a]")
    name = "이미지콘티_v3_음악.mp4" if music else "이미지콘티_v3.mp4"
    out = os.path.join(OUT, name)
    args += ["-filter_complex", ";".join(filt), "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p",
             "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-t", "15", out]
    subprocess.run(args, check=True, stdin=subprocess.DEVNULL)
    shutil.rmtree(tmp, ignore_errors=True)
    print(out)


if __name__ == "__main__":
    main()

# 녹화 마감(2026-10-25): raw 프레임(1179×2415) 위에 휴대폰 상태 표시줄(47pt = 141px)을 얹어 1179×2556으로 만들고, 미리보기 mp4와 확인판을 만든다.
#   python -X utf8 녹화_마감.py [R3 …]  → 녹화/<R>/frames/0000.png … · 녹화/<R>.mp4(30fps, 합성용이 아니라 보기용) · 녹화/_확인_<R>.jpg
# 크게 보기(검은 바탕) 프레임은 상태 표시줄도 검게 · 글자는 희게(아이폰이 화면 위 색을 따라가는 것처럼).
import sys, json, subprocess, shutil
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

R = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8/녹화")
FONT = r"C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT/SUIT-SemiBold.otf"
TIME = "3:12"   # 오후 세 시쯤(손님 없는 오후)
S = 3           # 배율
BAR = 47 * S


def status_bar(dark):
    bg, fg = ((10, 10, 10), (255, 255, 255)) if dark else ((255, 255, 255), (15, 15, 15))
    im = Image.new("RGB", (393 * S, BAR), bg)
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, 17 * S)
    d.text((44 * S, 15 * S), TIME, font=f, fill=fg)
    x = 300 * S
    for i, h in enumerate([4, 6, 8, 10]):            # 신호 막대 넷
        d.rounded_rectangle([x + i * 5 * S, (26 - h) * S, x + i * 5 * S + 3 * S, 26 * S], radius=S, fill=fg)
    cx, cy = 330 * S, 26 * S                           # 와이파이 부채꼴
    for r in (9, 6, 3):
        d.pieslice([cx - r * S, cy - r * S, cx + r * S, cy + r * S], 225, 315, fill=fg)
        if r > 3:
            rr = r - 1.6
            d.pieslice([cx - rr * S, cy - rr * S, cx + rr * S, cy + rr * S], 225, 315, fill=bg)
    bx, by = 346 * S, 18 * S                           # 배터리
    d.rounded_rectangle([bx, by, bx + 25 * S, by + 12 * S], radius=3.5 * S, outline=fg, width=int(1.2 * S))
    d.rounded_rectangle([bx + 2 * S, by + 2 * S, bx + 18 * S, by + 10 * S], radius=2 * S, fill=fg)
    d.rounded_rectangle([bx + 26.5 * S, by + 4 * S, bx + 28 * S, by + 8 * S], radius=S, fill=fg)
    return im


def finish(rid):
    d = R / rid
    st = json.load(open(d / "states.json", encoding="utf-8"))
    raws = sorted((d / "raw").glob("[0-9][0-9][0-9][0-9].png"))
    out = d / "frames"
    shutil.rmtree(out, ignore_errors=True); out.mkdir()
    bars = {False: status_bar(False), True: status_bar(True)}
    for p in raws:
        im = Image.open(p).convert("RGB")
        top = np.asarray(im.crop((0, 0, im.width, 6))).mean()
        dark = top < 60
        full = Image.new("RGB", (im.width, im.height + BAR))
        full.paste(bars[dark], (0, 0)); full.paste(im, (0, BAR))
        full.save(out / p.name)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "30", "-i", str(out / "%04d.png"), "-vf", "scale=590:-2", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", str(R / f"{rid}.mp4")], check=True)
    # 확인판: 다섯 프레임마다(0.17초) 한 칸, 시각 · 스크롤 자리 표시
    fr = sorted(out.glob("*.png"))
    pick = fr[::5] + ([fr[-1]] if (len(fr) - 1) % 5 else [])
    w = 236; thumbs = []
    font = ImageFont.truetype(FONT, 22)
    for p in pick:
        i = int(p.stem)
        im = Image.open(p).convert("RGB"); im = im.resize((w, int(im.height * w / im.width)))
        c = Image.new("RGB", (w, im.height + 34), (24, 24, 24)); c.paste(im, (0, 34))
        s = st["states"][i]
        ImageDraw.Draw(c).text((6, 4), f"{s['t']:.2f}s" + (f" y{s['y']:.0f}" if "y" in s else "") + (" 눌림" if s.get("pressed") else "") + (" 크게" if s.get("opened") else "") + (f" 사진{s['photo']}" if "photo" in s else ""), font=font, fill=(255, 220, 0))
        thumbs.append(c)
    sheet = Image.new("RGB", (len(thumbs) * (w + 6), thumbs[0].height), (0, 0, 0))
    for k, t in enumerate(thumbs):
        sheet.paste(t, (k * (w + 6), 0))
    sheet.save(R / f"_확인_{rid}.jpg", quality=86)
    print(rid, len(raws), "프레임 →", out, sheet.size)


if __name__ == "__main__":
    for rid in (sys.argv[1:] or ["R3", "R6", "R10", "R12", "R15", "R17"]):
        finish(rid)

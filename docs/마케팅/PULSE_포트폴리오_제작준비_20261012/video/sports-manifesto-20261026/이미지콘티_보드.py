# 5번 스포츠 매니페스토 이미지 콘티 보드(2026-10-26) — 행마다 「원본 첫 프레임 | 우리 판」 한 쌍 + 행 · 초 · 누구 · 화면 · 경로 · 말.
# 글은 02_콘티.md 3절 표에서 읽는다. 원본 프레임이 들어가므로 보드는 git 밖(synk-vendor/…/콘티/p5/보드/)에만 둔다.
#   python -X utf8 이미지콘티_보드.py 고름   → 콘티/p5/고름.json의 받은 판을 정지컷/<id>.png로(받은 판 그대로 — 9행만 180° 돌리고,
#                                            16행 초록 화면에는 심박 숫자, 21행 빛 기둥 옆에는 가쁨 로고를 얹은 판을 따로 둔다)
#   python -X utf8 이미지콘티_보드.py        → 보드/가쁨_이미지콘티_1.jpg · _2.jpg(12행씩) · 가쁨_한눈.jpg(우리 판만 차례로) · 가쁨_기준.jpg(기준 그림 · 로고)
# 우리 판은 정지컷/<id>.png, 그래픽 조각은 그래픽/G_*.png(그래픽조각.py). 번쩍 몽타주 행(5 · 12 · 14)은 조각 여럿을 한 칸에 모자이크로.
import json, os, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p5")
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
BG, INK, DIM, GOLD, SAY, BLUE = (17, 16, 18), (236, 234, 230), (160, 156, 150), (240, 200, 120), (170, 220, 170), (140, 200, 230)
FW, FH = 400, 225
COLS, PER = 3, 12

# 행 → 우리 칸에 들어갈 판(하나면 그 판, 여럿이면 모자이크). 정지컷 이름 또는 그래픽 이름(G_ · 로고).
OURS = {
    1: ["S01"], 2: ["S02"], 3: ["S03"], 4: ["S04"],
    5: ["F4", "F1", "F3", "G_빛줄기", "G_판", "F2"],   # 번쩍 몽타주 2.63초 — 사람 조각 · 전구 · 빛줄기 · 판 · 숫자
    6: ["S06"], 7: ["G_숫자_흐림"], 8: ["S08"], 9: ["S09"], 10: ["S10"], 11: ["S11"],
    12: ["G_심박", "S12a", "G_숫자_흐림", "S12b"], 13: ["S13"], 14: ["G_판", "G_숫자_172"], 15: ["S15"],
    16: ["S16_합성"], 17: ["S17"], 18: ["S18", "G_막대"], 19: ["S19"], 20: ["G_빛줄기_20"], 21: ["S21_로고"],
}


# 원본 얼굴 크기 · 자리에 맞춰 자른다(행: 배율 · 가운데 x · y) — Fable 10-27: 11행 끝 그림이 원본 끝보다 25% 작고 오른쪽, 12행 옆얼굴이 20% 작음
FIT_CROP = {"S11": (1.32, 0.552, 0.47), "S12a": (1.24, 0.467, 0.55)}
# 바탕이 순검정인 컷은 줄이고 내려 원본 자리에 놓는다(행: 배율 · 우리 머리 꼭대기 y · 원본 머리 꼭대기 y) — 6행은 세 번 구워도 머리가 위(18%)에 남았다(원본 35.7%, 어깨 폭 0.20/0.22)
FIT_PAD = {"S06": (0.91, 0.182, 0.357)}
# 끝 그림(행: 배율 · 잘라 낼 가운데 x · y 비율) — 1행 3.13초에 1.115배(위로 0.8% 기욺), 4행 0.7초에 약 1.8배(머리가 화면 가운데 위로), 6행 2.8초에 1.069배(아래로 1% 기욺)
END_CROP = {"S01": (1.115, 0.5, 0.496), "S04": (1.8, 0.48, 0.37), "S06": (1.069, 0.5, 0.505)}


def src(name):
    for p in (os.path.join(V, "정지컷", f"{name}.png"), os.path.join(V, "그래픽", f"{name}.png")):
        if os.path.exists(p):
            return p
    return None


def fit(p, w=FW, h=FH):
    if not p:
        im = Image.new("RGB", (w, h), (40, 40, 44))
        ImageDraw.Draw(im).text((16, h // 2 - 12), "아직 없음", font=F("Medium", 20), fill=DIM)
        return im
    im = Image.open(p).convert("RGB")
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def ours(row, w=FW, h=FH):
    names = OURS[row]
    if len(names) == 1:
        return fit(src(names[0]), w, h)
    c = 3 if len(names) > 4 else 2
    r = (len(names) + c - 1) // c
    tw, th = (w - (c - 1) * 2) // c, (h - (r - 1) * 2) // r
    im = Image.new("RGB", (w, h), BG)
    for i, n in enumerate(names):
        im.paste(fit(src(n), tw, th), ((i % c) * (tw + 2), (i // c) * (th + 2)))
    return im


def wrap(d, text, font, width, maxl):
    lines, cur = [], ""
    for ch in text:
        if d.textlength(cur + ch, font=font) > width:
            lines.append(cur)
            cur = ch.lstrip()
        else:
            cur += ch
    if cur:
        lines.append(cur)
    if len(lines) > maxl:
        lines = lines[:maxl]
        lines[-1] = lines[-1][:-1] + "…"
    return lines


def rows_from_md():
    out = {}
    for ln in open(os.path.join(HERE, "02_콘티.md"), encoding="utf-8"):
        m = re.match(r"\|\s*(\d+)\s*\|\s*([\d.]+)–([\d.]+) \(([\d.]+)\)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|", ln)
        if m:
            n = int(m.group(1))
            clean = lambda s: re.sub(r"\*\*|\[([^\]]+)\]\([^)]+\)", lambda k: k.group(1) or "", s).strip()
            out[n] = dict(a=float(m.group(2)), len=float(m.group(4)), who=clean(m.group(5)), scene=clean(m.group(6)),
                          cam=clean(m.group(7)), path=clean(m.group(8)), say=clean(m.group(9)))
    return out


def board(rs, path, title):
    pad, gap, inner = 36, 26, 6
    cw, ch = FW * 2 + inner, FH + 168
    W = pad * 2 + COLS * cw + (COLS - 1) * gap
    H = 130 + ((len(rs) + COLS - 1) // COLS) * (ch + gap) + 20
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((pad, 28), title, font=F("ExtraBold", 38), fill=INK)
    d.text((pad, 82), "칸마다 왼쪽 원본 첫 프레임(구도 · 카메라 · 빛을 옮긴 자리) | 오른쪽 우리 판(받은 판 그대로). 아래 글: 행 · 초 · 누구 · 화면 · 카메라(원본을 프레임마다 잰 값) · 말. 여러 칸 모자이크는 번쩍 조각 몽타주.",
           font=F("Medium", 21), fill=DIM)
    for i, (n, r) in enumerate(rs):
        x = pad + (i % COLS) * (cw + gap)
        y = 130 + (i // COLS) * (ch + gap)
        # 11행은 우리 판이 고개 든 끝 그림이라 원본도 끝 프레임과 짝짓는다(Fable 10-27)
        im.paste(fit(os.path.join(V, "원본첫프레임", "S11끝.png" if n == 11 else f"S{n:02d}.png")), (x, y))
        im.paste(ours(n), (x + FW + inner, y))
        d.text((x + 6, y + 4), "원본 끝" if n == 11 else "원본", font=F("ExtraBold", 18), fill=(255, 230, 0), stroke_width=2, stroke_fill=(0, 0, 0))
        d.text((x + FW + inner + 6, y + 4), "우리", font=F("ExtraBold", 18), fill=(255, 230, 0), stroke_width=2, stroke_fill=(0, 0, 0))
        ty = y + FH + 8
        d.text((x, ty), f"{n}행  {r['a']:.2f}초 · {r['len']:.2f}초  {r['who']}", font=F("ExtraBold", 22), fill=GOLD)
        pth = re.sub(r"\(.*", "", r["path"]).strip()   # 괄호 속 설명은 글 콘티에 — 보드에는 A · B · D만
        d.text((x + cw - d.textlength(pth, font=F("Medium", 18)), ty + 3), pth, font=F("Medium", 18), fill=BLUE)
        ty += 32
        for ln in wrap(d, r["scene"], F("Medium", 17), cw, 3):
            d.text((x, ty), ln, font=F("Medium", 17), fill=INK)
            ty += 22
        for ln in wrap(d, "카메라  " + r["cam"], F("Medium", 17), cw, 2):   # 10-26: 원본을 프레임마다 잰 카메라(움직임 · 크기 · 초)
            d.text((x, ty), ln, font=F("Medium", 17), fill=BLUE)
            ty += 22
        for ln in wrap(d, r["say"], F("Medium", 17), cw, 1):
            d.text((x, ty), ln, font=F("Medium", 17), fill=SAY)
    im.save(path, quality=86)
    print(path, im.size)


def glance(rs, path, title):
    w, h, gap, cols = 320, 180, 8, 7
    im = Image.new("RGB", (gap + cols * (w + gap), 70 + ((len(rs) + cols - 1) // cols) * (h + 34)), BG)
    d = ImageDraw.Draw(im)
    d.text((gap + 4, 16), title, font=F("ExtraBold", 30), fill=INK)
    for i, (n, r) in enumerate(rs):
        x, y = gap + (i % cols) * (w + gap), 70 + (i // cols) * (h + 34)
        im.paste(ours(n, w, h), (x, y))
        d.text((x + 2, y + h + 4), f"{n}  {r['len']:.2f}초", font=F("ExtraBold", 20), fill=GOLD)
    im.save(path, quality=86)
    print(path, im.size)


def refs(path):
    items = [("R1", "실험실(한결 · 1 2 10 12 16 19)"), ("R2", "밤 트랙과 빛 기둥(채원 · 3 8 13 17 21)"), ("R3", "가쁨 러닝화"), ("로고_가쁨_검은바탕", "끝 로고(코드로 그림)")]
    w, h, gap = 480, 270, 16
    im = Image.new("RGB", (gap + len(items) * (w + gap), h + 120), BG)
    d = ImageDraw.Draw(im)
    d.text((gap, 14), "5번 가쁨 — 기준 그림(같은 장소 · 신발 컷마다 참고로 넣는다)", font=F("ExtraBold", 30), fill=INK)
    for i, (n, lab) in enumerate(items):
        im.paste(fit(src(n), w, h), (gap + i * (w + gap), 64))
        d.text((gap + i * (w + gap), h + 76), f"{n} · {lab}", font=F("Medium", 21), fill=DIM)
    im.save(path, quality=88)
    print(path, im.size)


def pick():
    # 고름.json: {"S04": "받음/S04_….png", …} — 받은 판을 그대로 옮긴다(색 · 얼굴 손대지 않음)
    sel = json.load(open(os.path.join(V, "고름.json"), encoding="utf-8"))
    os.makedirs(os.path.join(V, "정지컷"), exist_ok=True)
    for k, rel in sel.items():
        im = Image.open(os.path.join(V, rel)).convert("RGB")
        if k == "S09":
            im = im.rotate(180)   # 바로 선 얼굴로 굽고 원본처럼 뒤집는다
        if k in FIT_PAD:
            z, ys, yd = FIT_PAD[k]
            small = im.resize((round(im.width * z), round(im.height * z)), Image.LANCZOS)
            a = np.asarray(small)
            edge = np.concatenate([a[:40].reshape(-1, 3), a[:, :40].reshape(-1, 3), a[:, -40:].reshape(-1, 3)])
            canvas = Image.new("RGB", im.size, tuple(int(v) for v in np.median(edge, 0)))   # 판 가장자리 색(아주 어두운 회색)으로 채운다
            fm = np.ones(a.shape[:2], np.float32)
            r = np.minimum(np.arange(fm.shape[0]), 10**6)[:, None]; c = np.arange(fm.shape[1])[None, :]
            fm = np.minimum(np.minimum(r, fm.shape[0] - 1 - r), np.minimum(c, fm.shape[1] - 1 - c)) / 40.0   # 경계 40화소를 부드럽게
            mask = Image.fromarray((np.clip(fm, 0, 1) * 255).astype(np.uint8))
            canvas.paste(small, (round(im.width * (1 - z) / 2), round(im.height * yd - im.height * ys * z)), mask)
            im = canvas
        if k in FIT_CROP:
            z, cx, cy = FIT_CROP[k]
            w, h = im.width / z, im.height / z
            x0 = min(max(0, im.width * cx - w / 2), im.width - w); y0 = min(max(0, im.height * cy - h / 2), im.height - h)
            im = im.crop((round(x0), round(y0), round(x0 + w), round(y0 + h))).resize(im.size, Image.LANCZOS)
        im.save(os.path.join(V, "정지컷", f"{k}.png"))
        print(k, "←", rel, im.size)
    # 10-26 카메라: 원본이 다가가는 행은 시작 그림을 그 배율만큼 잘라 끝 그림을 둔다(같은 구도의 끝 그림이면 영상 모델이 카메라를 멈춘다 — 9번 Veo 시험)
    for k, (z, cx, cy) in END_CROP.items():
        if k in sel:
            im = Image.open(os.path.join(V, "정지컷", f"{k}.png"))
            w, h = im.width / z, im.height / z
            x0 = min(max(0, im.width * cx - w / 2), im.width - w)
            y0 = min(max(0, im.height * cy - h / 2), im.height - h)
            im.crop((round(x0), round(y0), round(x0 + w), round(y0 + h))).resize(im.size, Image.LANCZOS).save(os.path.join(V, "정지컷", f"{k}_끝.png"))
            print(k + "_끝", f"{z}배 · 가운데 {cx:.2f},{cy:.2f}")
    g = os.path.join(V, "그래픽")
    if "S16" in sel:   # 초록 화면 자리에 심박 숫자(영상 단계에서도 같은 자리)
        im = np.asarray(Image.open(os.path.join(V, "정지컷", "S16.png")).convert("RGB")).astype(np.int16)
        key = (im[..., 1] > 90) & (im[..., 1] > im[..., 0] + 30) & (im[..., 1] > im[..., 2] + 30)
        import cv2
        key = cv2.dilate(key.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0   # 초록 가장자리(번진 화소)까지 덮는다
        ys, xs = np.nonzero(key)
        out = Image.fromarray(im.astype(np.uint8))
        if len(xs) > 500:
            x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
            bw, bh = x1 - x0 + 1, y1 - y0 + 1
            num = Image.open(os.path.join(g, "G_모니터.png")).convert("RGB")   # 그래픽조각.py 모니터() — 심박 172 · 심박 선 · 페이스
            k = min(bw / num.width, bh / num.height) * 0.94   # 비율을 지키고 화면 안에 다 들어가게 — 남는 곳은 화면 바탕색
            small = num.resize((round(num.width * k), round(num.height * k)), Image.LANCZOS)
            num = Image.new("RGB", (bw, bh), num.getpixel((4, 4)))
            num.paste(small, ((bw - small.width) // 2, (bh - small.height) // 2))
            m = Image.fromarray((key[y0:y1 + 1, x0:x1 + 1] * 255).astype(np.uint8))
            out.paste(num, (x0, y0), m)
        out.save(os.path.join(V, "정지컷", "S16_합성.png"))
        print("S16_합성", "초록 화소", len(xs))
    if "S21" in sel:   # 빛 기둥 오른쪽 위에 로고(28.49초부터 켜진 판)
        im = Image.open(os.path.join(V, "정지컷", "S21.png")).convert("RGB")
        lg = Image.open(os.path.join(g, "로고_가쁨.png"))
        s = im.width * 0.2 / lg.width
        lg = lg.resize((round(lg.width * s), round(lg.height * s)), Image.LANCZOS)
        a = np.asarray(im).astype(np.float32).mean(2)
        cx = int(np.argmax(a.mean(0)))   # 가장 밝은 세로줄 = 빛 기둥
        im.paste(lg, (min(cx + int(im.width * 0.05), im.width - lg.width - 20), int(im.height * 0.36)), lg)
        im.save(os.path.join(V, "정지컷", "S21_로고.png"))
        print("S21_로고", "기둥 x", cx)


if __name__ == "__main__":
    import sys
    if sys.argv[1:] == ["고름"]:
        pick()
        raise SystemExit
    allr = rows_from_md()
    rs = sorted(allr.items())
    assert len(rs) == 21, f"02_콘티.md 3절 표에서 {len(rs)}행만 읽었다"
    out = os.path.join(V, "보드")
    os.makedirs(out, exist_ok=True)
    for p in range(2):
        part = rs[p * PER:(p + 1) * PER]
        board(part, os.path.join(out, f"가쁨_이미지콘티_{p + 1}.jpg"), f"5번 스포츠 매니페스토 「가쁨」 · 이미지 콘티 {p + 1}/2 ({part[0][0]}~{part[-1][0]}행)")
    glance(rs, os.path.join(out, "가쁨_한눈.jpg"), "5번 「가쁨」 — 우리 판 21행 차례대로(30초)")
    refs(os.path.join(out, "가쁨_기준.jpg"))

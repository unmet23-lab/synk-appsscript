# 7번 「사랑 한 칸」 가편집(2026-10-27) — 우리 정지컷을 원본 컷 길이대로 이어 본다. 영상 생성 전 흐름 · 낯선 사람 이해 시험용.
#   python -X utf8 가편집.py [1|2]   → git 밖 콘티/p7/가편집/
#     사랑한칸_가편집_<화>화_나란히.mp4 — 왼쪽 원본 그 컷(소리 없음) | 오른쪽 우리 정지컷, 위 띠에 컷 · 길이 · 말(원본이 들어가므로 git 밖에만)
#     사랑한칸_가편집_<화>화_자막.mp4  — 우리 정지컷만 1080×1920, 「」 안 대사를 아래 자막으로(소리 없음)
# 길이 · 원본 구간은 콘티표.py가 낸 컷목록.json(원본초 · 길이)에서 읽는다. 끝 그림이 있는 컷(2-10 → 2-10e)은 반씩 나눠 보인다.
# 정지컷이 아직 없으면 어두운 칸에 「아직 없음」. 색 · 빛은 건드리지 않는다(정지컷 그대로).
import json
import os
import re
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
VEN = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024")
V = os.path.join(VEN, "콘티", "p7")
SRC = {1: os.path.join(VEN, "레퍼런스", "p7", "원본영상", "tt_7490730962452499730", "tt_7490730962452499730.mp4"),
       2: os.path.join(VEN, "레퍼런스", "p7", "원본영상", "tt_7491100599451192583", "tt_7491100599451192583.mp4")}
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
W, H, FPS = 1080, 1920, 30
HW, HH, BAND = 540, 960, 84


def still(k):
    p = os.path.join(V, "정지컷", f"{k}.jpg")
    if os.path.exists(p):
        im = Image.open(p).convert("RGB")
        return im if im.size == (W, H) else im.resize((W, H), Image.LANCZOS)
    im = Image.new("RGB", (W, H), (34, 34, 38))
    ImageDraw.Draw(im).text((W // 2, H // 2), f"{k}\n아직 없음", font=F("ExtraBold", 64), fill=(150, 146, 140), anchor="mm", align="center")
    return im


def lines_of(say):
    return [t.strip() for t in re.findall(r"「([^」]*)」", say) if t.strip()]


def wrap(d, text, font, width):
    out, cur = [], ""
    for ch in text:
        if d.textlength(cur + ch, font=font) > width and cur:
            out.append(cur)
            cur = ch.lstrip()
        else:
            cur += ch
    return out + ([cur] if cur else [])


def subtitle(im, say):
    im = im.copy()
    d = ImageDraw.Draw(im)
    f = F("ExtraBold", 56)
    ls = []
    for t in lines_of(say):
        ls += wrap(d, t, f, 900)
    y = 1500 - (len(ls) - 1) * 36
    for ln in ls:
        d.text((W // 2, y), ln, font=f, fill=(255, 255, 255), anchor="mm", stroke_width=5, stroke_fill=(0, 0, 0))
        y += 72
    return im


def band(c, k):
    im = Image.new("RGB", (W, BAND), (17, 16, 18))
    d = ImageDraw.Draw(im)
    d.text((14, 8), f"{k}  {c['길이']:.2f}초   원본 {c['원본']}", font=F("ExtraBold", 28), fill=(240, 200, 120))
    d.text((14, 46), (c["말"] or "-")[:60], font=F("Medium", 24), fill=(170, 220, 170))
    d.text((W // 2 + 14, 8), "왼쪽 원본(소리 없음) | 오른쪽 우리", font=F("Medium", 22), fill=(160, 156, 150))
    return im


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        sys.exit(r.stderr[-1500:])


def parts(c):
    k = f"{c['화']}-{c['컷']}"
    if os.path.exists(os.path.join(V, "정지컷", f"{k}e.jpg")):
        return [(k, c["길이"] / 2), (k + "e", c["길이"] / 2)]
    return [(k, c["길이"])]


def frames(cs):
    """컷 · 끝 그림 조각마다 프레임 수 — 누적 시각을 반올림해 나눠야 두 판 길이가 컷목록 합과 같다(조각마다 따로 반올림하면 49컷에 1.4초 늘었다)."""
    t, out = 0.0, []
    for c in cs:
        ps = []
        for k, dur in parts(c):
            ps.append((k, round((t + dur) * FPS) - round(t * FPS)))
            t += dur
        out.append((c, ps))
    return out


def concat(segs, tmp, name, dst):
    with open(f"{tmp}/{name}.txt", "w", encoding="utf-8") as fh:
        fh.writelines(f"file '{x}'\n" for x in segs)
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", f"{tmp}/{name}.txt", "-c", "copy", "-movflags", "+faststart", dst])
    print(dst)


def build(ep, cs, out):
    tmp = tempfile.mkdtemp(prefix=f"p7가편집{ep}_").replace("\\", "/")   # concat 목록은 / 경로로
    enc = ["-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS)]
    plan = frames(cs)
    # 1) 자막 판 — 조각마다 정지컷 + 자막을 n프레임
    segs = []
    for c, ps in plan:
        for k, n in ps:
            p = f"{tmp}/s_{k}.png"
            subtitle(still(k), c["말"]).save(p)
            sp = f"{tmp}/s_{k}.mp4"
            run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", str(FPS), "-i", p, "-frames:v", str(n), *enc, sp])
            segs.append(sp)
    concat(segs, tmp, "s", os.path.join(out, f"사랑한칸_가편집_{ep}화_자막.mp4"))
    # 2) 나란히 판 — 컷마다 원본 구간 | 우리 정지컷(끝 그림이 있으면 반씩), 위 띠
    segs = []
    for c, ps in plan:
        k = f"{c['화']}-{c['컷']}"
        n = sum(x for _, x in ps)
        bp = f"{tmp}/b_{k}.png"
        band(c, k).save(bp)
        ins, chain = [], []
        for j, (kk, nj) in enumerate(ps):
            pp = f"{tmp}/o_{kk}.png"
            still(kk).resize((HW, HH), Image.LANCZOS).save(pp)
            ins += ["-loop", "1", "-framerate", str(FPS), "-i", pp]
            chain.append(f"[{j + 2}:v]trim=end_frame={nj},setpts=PTS-STARTPTS,setsar=1[u{j}]")
        ours = "".join(f"[u{j}]" for j in range(len(ps))) + f"concat=n={len(ps)}:v=1:a=0[u]"
        fc = (f"[0:v]scale={HW}:{HH},fps={FPS},setsar=1[o];" + ";".join(chain) + ";" + ours + ";"
              f"[o][u]hstack=2[h];[1:v]setsar=1[b];[b][h]vstack=2[v]")
        sp = f"{tmp}/seg_{k}.mp4"
        run(["ffmpeg", "-y", "-v", "error", "-ss", f"{c['원본초'][0]:.3f}", "-i", SRC[ep],
             "-loop", "1", "-framerate", str(FPS), "-i", bp, *ins,
             "-filter_complex", fc, "-map", "[v]", "-an", "-frames:v", str(n), *enc, sp])
        segs.append(sp)
    concat(segs, tmp, "n", os.path.join(out, f"사랑한칸_가편집_{ep}화_나란히.mp4"))


def sound(say):
    """그림 판 아래 「소리」 한 줄 — 대사(「」 안)는 자막으로 이미 보이니 빼고, 효과음 · 노래 · 화면 밖 목소리만 남긴다."""
    if "「" in say:
        return "화면 밖 목소리" if "화면 밖" in say else ""
    if say.strip() in ("-", "(이어짐)"):
        return ""
    # 만든 쪽 말(배역 이름 · J컷)은 보는 사람이 모르니 뺀다
    say = re.sub(r"\(J컷\)|\d+초 ", "", say)
    say = re.sub(r"(서진|이안|민재|소연)(의|이|가)? ?", "", say)
    return say.replace("첫말이 ", "목소리가 ").strip(" ·")


# 후반 합성 자리(크로마 초록)와 끝 글자 — 시험 판에서만 흉내 낸다(정지컷 · 보드는 그대로 초록)
합성 = {"1-26": "혼인신고서\n(빈 칸)", "1-27": "혼인신고서\n남편 ____ 아내 ____", "2-4": "칸찬\n반찬 정기배송",
        "2-43": "혼인신고서", "2-44": "혼인신고서\n남편 이안 · 아내 서진\n(이름이 다 적힘)"}
끝글자 = {"1-45": "다음 화에", "2-48": "사랑 한 칸\n반찬 정기배송 칸찬"}


def mock(k, im):
    if k in 합성:
        import numpy as np
        a = np.asarray(im).astype(int)
        g = (a[:, :, 1] > 140) & (a[:, :, 0] < 90) & (a[:, :, 2] < 130)
        if g.sum() > 500:
            ys, xs = np.nonzero(g)
            a[g] = (242, 240, 232)
            im = Image.fromarray(a.astype("uint8"))
            d = ImageDraw.Draw(im)
            cx, cy = (xs.min() + xs.max()) // 2, (ys.min() + ys.max()) // 2
            size = max(28, min(90, (xs.max() - xs.min()) // 9))
            d.multiline_text((cx, cy), 합성[k], font=F("ExtraBold", size), fill=(60, 50, 50), anchor="mm", align="center", spacing=12)
    if k in 끝글자:
        im = im.copy()
        ImageDraw.Draw(im).multiline_text((W // 2, 380), 끝글자[k], font=F("ExtraBold", 96), fill=(255, 255, 255), anchor="mm", align="center",
                                          stroke_width=6, stroke_fill=(0, 0, 0), spacing=20)
    return im


def sheets(ep, cs, out):
    """낯선 사람 이해 시험용 그림 판(10-28) — 자막을 얹은 정지컷을 차례대로 한 장에 12컷(4 × 3), 칸 아래에 차례 · 초 · 소리만. 만든 쪽 정보(배역 · 카메라 · 원본)는 넣지 않는다."""
    w, h, gap, pad = 300, 533, 18, 24
    for p in range(0, len(cs), 12):
        part = cs[p:p + 12]
        im = Image.new("RGB", (pad * 2 + 4 * w + 3 * gap, 70 + 3 * (h + 64)), (17, 16, 18))
        d = ImageDraw.Draw(im)
        d.text((pad, 20), f"{ep}화 — 장면 {p + 1}~{p + len(part)} / {len(cs)} (왼쪽 위부터 차례로)", font=F("ExtraBold", 28), fill=(236, 234, 230))
        for i, c in enumerate(part):
            x, y = pad + (i % 4) * (w + gap), 70 + (i // 4) * (h + 64)
            k = f"{c['화']}-{c['컷']}"
            im.paste(subtitle(mock(k, still(k)), c["말"]).resize((w, h), Image.LANCZOS), (x, y))
            d.text((x, y + h + 6), f"{p + i + 1}  ({c['시작']:.1f}초~, {c['길이']:.1f}초)", font=F("ExtraBold", 20), fill=(240, 200, 120))
            s = sound(c["말"])
            if s:
                d.text((x, y + h + 34), "소리: " + s[:24], font=F("Medium", 18), fill=(170, 220, 170))
        path = os.path.join(out, f"그림_{ep}화_{p // 12 + 1}.jpg")
        im.save(path, quality=88)
        print(path)


if __name__ == "__main__" and "--시험" in sys.argv:
    # python -X utf8 가편집.py --시험   → git 밖 콘티/p7/시험/그림_<화>화_<n>.jpg
    allc = json.load(open(os.path.join(V, "컷목록.json"), encoding="utf-8"))
    out = os.path.join(V, "시험")
    os.makedirs(out, exist_ok=True)
    for ep in (1, 2):
        sheets(ep, [c for c in allc if c["화"] == ep], out)
    sys.exit(0)

if __name__ == "__main__":
    allc = json.load(open(os.path.join(V, "컷목록.json"), encoding="utf-8"))
    out = os.path.join(V, "가편집")
    os.makedirs(out, exist_ok=True)
    for ep in [int(x) for x in sys.argv[1:]] or [1, 2]:
        build(ep, [c for c in allc if c["화"] == ep], out)

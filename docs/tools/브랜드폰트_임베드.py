# -*- coding: utf-8 -*-
"""
SYNK 인쇄물 빌더 — 브랜드 폰트 3종을 「실제 쓰는 글자만」 서브셋해 HTML에 임베드하고,
헤드리스 크롬으로 PDF까지 뽑는다.

왜 임베드인가 (셋 다 실측 근거가 있다):
  · CDN 서브셋은 글자를 조용히 떨어뜨린다 — fontsource woff2는 몽골 키릴이 빠지고,
    구글폰트 unicode-range 는 ₮(U+20AE) 를 보장하지 않는다. 빠져도 화면은 「그럴듯」해서
    안 보인다. 임베드하면 없는 글자는 빌드가 잡는다.
  · 폴백은 실패가 아니라 「통과」로 보인다 — 현재 등록서 PDF 가 DM Mono 로 ₮·№·→ 를
    찍으려다 Courier New 로 폴백돼 있었다(폰트 덤프로 확인).
  · 네트워크 없이 어디서나 열리고 인쇄된다.

글자별 담당 (실측 · fontprobe):
  · Inter Tight  2504 글리프 — 라틴 + 키릴(Өө·Үү 포함) + ₮ № → × ÷ §   ← 몽골어는 여기만 가능
  · SUIT        11437 글리프 — 한글 전용. 키릴·₮·№ 없음
  · DM Mono       381 글리프 — 라틴 전용. 키릴·한글·₮·№·→ 없음

쓰는 법:
  python docs/tools/브랜드폰트_임베드.py <src.html> <out.html> [--pdf <out.pdf>]

src.html 의 <style> 안에 `/*@FONTS@*/` 마커를 두면 그 자리에 @font-face 가 채워진다.
"""

import argparse
import base64
import html as htmlmod
import io
import os
import pathlib
import re
import subprocess
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

# ── 폰트 원본 위치 ────────────────────────────────────────────────
# 유호님 폴더가 정본이다. 바탕화면 실체는 OneDrive\Desktop 이다(로컬 Desktop 은 비어 있다).
FONT_ROOT = os.path.join(os.environ.get("USERPROFILE", ""), "OneDrive", "Desktop", "SYNK_브랜드폰트")

# (css family, weight, 파일 상대경로)
FACES = [
    ("Inter Tight", 400, "InterTight/InterTight-Regular.ttf"),
    ("Inter Tight", 500, "InterTight/InterTight-Medium.ttf"),
    ("Inter Tight", 600, "InterTight/InterTight-SemiBold.ttf"),
    ("Inter Tight", 700, "InterTight/InterTight-Bold.ttf"),
    ("SUIT", 400, "SUIT/SUIT-Regular.otf"),
    ("SUIT", 500, "SUIT/SUIT-Medium.otf"),
    ("SUIT", 600, "SUIT/SUIT-SemiBold.otf"),
    # 800·900 은 인쇄물 헤드·태그라인이 실제로 쓰는 굵기다. 없으면 브라우저가 600 으로 대신 그리거나
    # 가짜 볼드를 합성한다 — 둘 다 화면에선 「굵어 보여서」 통과로 보인다.
    ("SUIT", 800, "SUIT/SUIT-ExtraBold.otf"),
    ("SUIT", 900, "SUIT/SUIT-Heavy.otf"),
    ("DM Mono", 300, "DM_Mono/DMMono-Light.ttf"),
    ("DM Mono", 400, "DM_Mono/DMMono-Regular.ttf"),
    ("DM Mono", 500, "DM_Mono/DMMono-Medium.ttf"),
]

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.join(os.environ.get("LOCALAPPDATA", ""), r"Google\Chrome\Application\chrome.exe"),
]


def visible_text(src):
    """HTML 에서 실제로 렌더되는 글자만 뽑는다 — <style>/<script>/태그/주석 제외, 엔티티 해제."""
    s = re.sub(r"(?is)<style.*?</style>", " ", src)
    s = re.sub(r"(?is)<script.*?</script>", " ", s)
    s = re.sub(r"(?s)<!--.*?-->", " ", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    return htmlmod.unescape(s)


def build_faces(chars):
    """각 폰트를 「쓰는 글자 ∩ 그 폰트가 가진 글자」로 서브셋해 base64 woff2 로 만든다."""
    out = []
    coverage = {}          # 글자 -> 그 글자를 그릴 수 있는 패밀리들
    for fam, wt, rel in FACES:
        path = os.path.join(FONT_ROOT, *rel.split("/"))
        if not os.path.exists(path):
            raise SystemExit("폰트 없음: %s" % path)

        probe = TTFont(path, lazy=True)
        cmap = set(probe.getBestCmap().keys())
        probe.close()

        keep = sorted({ord(c) for c in chars if ord(c) in cmap})
        for c in chars:
            if ord(c) in cmap:
                coverage.setdefault(c, set()).add(fam)
        if not keep:
            continue

        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]
        opts.notdef_outline = True
        opts.drop_tables = []
        opts.recalc_bounds = True

        font = subset.load_font(path, opts)
        sub = subset.Subsetter(options=opts)
        sub.populate(unicodes=keep)
        sub.subset(font)
        buf = io.BytesIO()
        subset.save_font(font, buf, opts)
        font.close()

        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        out.append(
            "@font-face{font-family:'%s';font-style:normal;font-weight:%d;"
            "font-display:block;src:url(data:font/woff2;base64,%s) format('woff2')}"
            % (fam, wt, b64)
        )
        print("  %-14s %3d  glyphs=%-4d  %6.1f KB" % (fam, wt, len(keep), len(buf.getvalue()) / 1024.0))
    return out, coverage


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--pdf", default=None)
    a = ap.parse_args()

    src = pathlib.Path(a.src).read_text(encoding="utf-8")
    if "/*@FONTS@*/" not in src:
        raise SystemExit("소스에 /*@FONTS@*/ 마커가 없다")

    text = visible_text(src)
    chars = {c for c in text if not c.isspace()}
    print("쓰이는 글자 %d종" % len(chars))

    faces, coverage = build_faces(chars)

    # 🔴 어느 브랜드 폰트도 못 그리는 글자 = 폴백이 생긴다는 뜻. 조용히 넘기지 않고 깬다.
    orphans = sorted(c for c in chars if c not in coverage)
    if orphans:
        raise SystemExit(
            "브랜드 폰트 3종 어디에도 없는 글자 %d개 → 폴백 발생: %s\n"
            "   (해당 글자를 CSS 도형으로 바꾸거나 문구를 고칠 것)"
            % (len(orphans), " ".join("%s U+%04X" % (c, ord(c)) for c in orphans))
        )

    out_html = src.replace("/*@FONTS@*/", "\n".join(faces))
    outp = pathlib.Path(a.out)
    outp.parent.mkdir(parents=True, exist_ok=True)
    outp.write_text(out_html, encoding="utf-8")
    print("HTML → %s  (%.0f KB)" % (outp, outp.stat().st_size / 1024.0))

    if a.pdf:
        chrome = next((c for c in CHROME_CANDIDATES if c and os.path.exists(c)), None)
        if not chrome:
            raise SystemExit("크롬을 못 찾았다")
        pdfp = pathlib.Path(a.pdf)
        pdfp.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            chrome, "--headless=new", "--disable-gpu", "--no-sandbox",
            "--no-pdf-header-footer", "--virtual-time-budget=8000",
            "--print-to-pdf=%s" % str(pdfp.resolve()), outp.resolve().as_uri(),
        ]
        # 크롬 stderr 은 UTF-8 인데 윈도 기본이 cp949 라 그대로 읽으면 죽는다(로그가 본 작업을 죽인다).
        r = subprocess.run(cmd, capture_output=True, timeout=180)
        if not pdfp.exists():
            raise SystemExit("PDF 생성 실패 (rc=%s)\n%s\n%s" % (
                r.returncode,
                r.stdout.decode("utf-8", "replace"),
                r.stderr.decode("utf-8", "replace")))
        print("PDF  → %s  (%.0f KB)" % (pdfp, pdfp.stat().st_size / 1024.0))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

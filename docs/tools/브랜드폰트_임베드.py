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
import shutil
import subprocess
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

# ── 폰트 원본 위치 ────────────────────────────────────────────────
# 2026-08-10 이전에는 여기가 `%USERPROFILE%\OneDrive\Desktop\SYNK_브랜드폰트` 였다.
# 즉 **PDF 빌드가 유호님 PC 의 바탕화면 폴더에 의존**했다 — 그 폴더를 옮기거나 지우면
# 발표물·인쇄본·지도가 조용히 폴백 서체로 떨어지고, 다른 기계·클라우드 세션에서는 애초에 안 돌았다.
# 폰트 3종은 전부 OFL(각 폴더에 원문 동봉)이라 저장소에 들일 수 있다 → 저장소가 정본이 됐다(유호 승인 08-10).
# 폴백 경로를 두지 않는다 — 없으면 조용히 옛 자리를 쓰는 게 아니라 `build_faces` 가 누락을 소리내야 한다.
FONT_ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "브랜드_폰트"))
REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

# ── 쪽번호 ────────────────────────────────────────────────────────
# 쪽 상자를 손으로 안 나눈 «흐르는» 지면은 크롬이 아무 데서나 끊고 쪽번호도 못 넣는다
# (크롬은 @page 의 «여백 칸»을 안 그린다 — 표준에는 있는데 구현이 없다).
# Paged.js 가 그 자리를 메운다: 지면을 쪽 상자로 잘라 놓고 여백 칸에 번호를 그린다.
# 원고가 아래 마커를 품은 판에만 실린다 — 안 품으면 한 글자도 안 늘어난다.
PAGED_마커 = "<!--@PAGED@-->"
PAGED_JS = os.path.join(REPO, "tools", "vendor", "paged.polyfill.min.js")

# 🔴 총쪽수를 «우리가» 넣는 까닭(09-03 실측): Paged.js 는 다 짜고 나서 총수를 제 변수에 적는데
#   크롬이 그걸로 counter(pages) 를 다시 안 센다 — 「1 / 0」이 여덟 쪽 내리 찍혔다.
#   그래서 다 짠 뒤 우리가 «글자»로 넣고, 두 번 그려진 다음에 「다 됐다」를 올린다.
PAGED_훅 = (
    "<script>window.PagedConfig={after:function(f){"
    "var n=(f&&f.total)||document.querySelectorAll('.pagedjs_page').length;"
    "document.documentElement.style.setProperty('--synk-total-pages',"
    "String.fromCharCode(34)+n+String.fromCharCode(34));"
    "requestAnimationFrame(function(){requestAnimationFrame(function(){"
    "window.__SYNK_PAGED_DONE=true;});});"
    "}};</script>"
)

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
    # 낫표 「 」 두 글리프만 담은 조각(트랙 §3-낫표 인쇄 갈래 ㄱ · 09-01). 화면은 local() 별칭
    # 가족이 OS 폰트로 그리지만 임베드 인쇄물은 폰트 «파일»이 필요하다 — Noto Sans KR(OFL)에서
    # 서브셋·개명(3.8KB · RFN 'Source' 미사용 · 원본 저작권 name 레코드 유지 · OFL.txt 동봉).
    # 글리프가 둘뿐이라 unicode-range 없이도 나머지 글자는 다음 폰트로 폴백된다.
    ("SYNK Bracket", 400, "SYNKBracket/SYNKBracket-Regular.ttf"),
]

def _chrome_candidates():
    """PDF 를 뽑을 크롬을 찾는다.

    🔑 **윈도 경로만 있으면 이 저장소 밖에서는 PDF 가 원리적으로 안 나온다**(2026-08-19 실측:
       리눅스 클라우드 세션에서 6종 전부 「크롬을 못 찾았다」로 죽었다). 유호님 노트북에서만
       도는 빌드는 CI·클라우드에서 조용히 반쪽이 된다 — 그리고 그 반쪽은 **HTML 은 갱신되고
       PDF 만 낡는** 모습으로 와서, 산출물 짝이 어긋난 것을 아무도 못 본다.
    ⚠순서가 곧 우선순위다: 환경변수를 맨 앞에 둔다(부르는 쪽이 못 이기면 그건 규칙이 아니라 벽이다).
    """
    import glob as _glob
    cands = [os.environ.get("SYNK_CHROME"), os.environ.get("CHROME_PATH")]
    # 윈도 — 유호님 기본 환경
    cands += [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.join(os.environ.get("LOCALAPPDATA", ""), r"Google\Chrome\Application\chrome.exe"),
    ]
    # 리눅스·CI — 플레이라이트가 깔아 둔 크로미움이 가장 흔하다(버전 폴더라 glob 로 집는다)
    cands += sorted(_glob.glob("/opt/pw-browsers/chromium-*/chrome-linux/chrome"), reverse=True)
    cands += [
        "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",  # macOS
    ]
    return cands


CHROME_CANDIDATES = _chrome_candidates()


def visible_text(src):
    """HTML 에서 실제로 렌더되는 글자만 뽑는다 — <style>/<script>/태그/주석 제외, 엔티티 해제."""
    s = re.sub(r"(?is)<style.*?</style>", " ", src)
    s = re.sub(r"(?is)<script.*?</script>", " ", s)
    s = re.sub(r"(?s)<!--.*?-->", " ", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    return htmlmod.unescape(s)


_CSS_CONTENT = re.compile(r"content\s*:\s*([^;}]+)", re.I)
_CSS_STR = re.compile(r"'([^']*)'|\"([^\"]*)\"")
_CSS_ESC = re.compile(r"\\([0-9A-Fa-f]{1,6})[ \t]?")


def css_content_chars(src):
    """<style> 안 `content:` 이 **그리는** 글자.

    🔴 왜 있나 (2026-09-03 실측 · 03_상담브로셔 한 글자)
      서브셋은 「쓰이는 글자」로 만드는데 그 목록을 `visible_text` 가 뽑고, 그 함수는 <style> 을
      통째로 버린다. 그런데 CSS 는 글자를 «그린다» — `.vs .col li::before{content:'— '}` 처럼.
      본문에도 그 글자가 있는 동안은 우연히 덮였다. 09-03 문안 스윕이 본문의 긴 줄표를 0으로
      만들자 그 글자가 서브셋에서 빠졌고, 크롬이 맑은고딕으로 떨어뜨렸다 —
      **인쇄물 한 장에 시스템 글꼴 한 글자**가 섞인 것이다.
      키트검사 실측: 옛 판 MalgunGothic 잉크글자 0 → 새 판 1(—). 화면으로는 안 보인다.
    ⚠ 이 자가 틀릴 때의 모습 = 넓게 긁어 **안 그리는 글자까지 싣는 것**. 값은 서브셋이 조금
      커지는 것뿐이고(글자 하나 = 수십 바이트), 반대 방향(빠뜨림)은 종이에 남는다.
    ⚠ `counter()`·`attr()` 같은 함수형 값은 문자열이 아니라 안 걷는다 — 거기서 나오는 숫자는
      본문에도 있어서 이미 실린다.
    """
    out = set()
    for block in re.findall(r"(?is)<style[^>]*>(.*?)</style>", src):
        block = re.sub(r"(?s)/\*.*?\*/", " ", block)      # CSS 주석은 안 그린다
        for m in _CSS_CONTENT.finditer(block):
            for a, b in _CSS_STR.findall(m.group(1)):
                s = a or b
                s = _CSS_ESC.sub(lambda mm: chr(int(mm.group(1), 16)), s)
                out.update(c for c in s if not c.isspace())
    return out


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
    # 인쇄물은 폴백이 곧 사고라 기본이 「깬다」. 다만 내부 지도는 ✅🔴⛔ 같은 **이모지**를 상태 언어로
    # 쓰는데 그건 어느 텍스트 폰트에도 없고 OS 가 컬러로 그린다 — 그걸 이유로 임베드를 통째로 막으면
    # 지도는 영원히 「이 PC 폰트」로 나간다. 그래서 막는 대신 **무엇이 폴백되는지 찍고 통과**시킨다.
    ap.add_argument("--폴백허용", action="store_true",
                    help="브랜드 폰트에 없는 글자를 오류가 아니라 경고로 처리한다(목록을 찍는다)")
    a = ap.parse_args()

    src = pathlib.Path(a.src).read_text(encoding="utf-8")
    if "/*@FONTS@*/" not in src:
        raise SystemExit("소스에 /*@FONTS@*/ 마커가 없다")

    text = visible_text(src)
    chars = {c for c in text if not c.isspace()}
    css_only = css_content_chars(src) - chars
    chars |= css_only

    # 🔴 쪽번호는 «CSS 가 그리는 숫자»다 — 본문에 숫자가 없으면 서브셋에서 빠지고
    #   번호 자리에 두부(네모)가 선다. 조용히 틀리는 자리라 여기서 못 박는다.
    쪽번호판 = PAGED_마커 in src
    if 쪽번호판:
        쪽글자 = set("0123456789/")
        더한것 = 쪽글자 - chars
        chars |= 쪽글자
        print("쪽번호판이다 — 숫자와 빗금을 서브셋에 못 박는다 (더 실은 것 %d자%s)" % (
            len(더한것), "" if not 더한것 else ": " + " ".join(sorted(더한것))))
    print("쓰이는 글자 %d종%s" % (
        len(chars),
        "" if not css_only else "  (본문엔 없고 CSS 가 그리는 것 %d: %s)" % (
            len(css_only), " ".join(sorted(css_only)))))

    faces, coverage = build_faces(chars)

    # 🔴 어느 브랜드 폰트도 못 그리는 글자 = 폴백이 생긴다는 뜻. 조용히 넘기지 않고 깬다.
    orphans = sorted(c for c in chars if c not in coverage)
    if orphans:
        말 = "브랜드 폰트 3종 어디에도 없는 글자 %d개 → 폴백 발생: %s" % (
            len(orphans), " ".join("%s U+%04X" % (c, ord(c)) for c in orphans))
        if not a.폴백허용:
            raise SystemExit(말 + "\n   (해당 글자를 CSS 도형으로 바꾸거나 문구를 고칠 것)")
        print("⚠ " + 말)
        print("   --폴백허용 이라 통과시킨다. 이 글자들만 OS 글꼴이 그린다(나머지는 임베드본).")

    out_html = src.replace("/*@FONTS@*/", "\n".join(faces))
    if 쪽번호판:
        js = pathlib.Path(PAGED_JS).read_text(encoding="utf-8")
        out_html = out_html.replace(
            PAGED_마커,
            PAGED_훅 + chr(10) + chr(60) + 'script data-synk-paged="0.4.3"' + chr(62)
            + chr(10) + js + chr(10) + chr(60) + "/script" + chr(62), 1)
        print("쪽번호 폴리필을 실었다 (%.0f KB) — 지면을 쪽으로 자르고 아래 칸에 번호를 그린다"
              % (len(js) / 1024.0))

    outp = pathlib.Path(a.out)
    outp.parent.mkdir(parents=True, exist_ok=True)
    outp.write_text(out_html, encoding="utf-8")
    print("HTML → %s  (%.0f KB)" % (outp, outp.stat().st_size / 1024.0))

    if a.pdf and 쪽번호판:
        # 🔴 쪽번호판을 «시간»으로 기다리면 조용히 잘린다 — 09-03 실측: 같은 지면을
        #   40초어치 기다려 1쪽 · 120초어치 2쪽 · 400초어치 3쪽으로 뱉었다(진짜는 8쪽).
        #   셋 다 «열리는» PDF 라 아무 검사도 안 문다. 그래서 «신호»로 기다리는 통로에 맡긴다.
        pdfp = pathlib.Path(a.pdf)
        pdfp.parent.mkdir(parents=True, exist_ok=True)
        # 🔴 옛 PDF 를 «먼저 치운다». 안 치우면 인쇄가 실패해도 그 자리에 파일이 있어서
        #   「났다」로 읽힌다 — 09-03 에 실제로 그렇게 지나갔다(스크립트가 스타일 안에 갇혀
        #   신호가 영영 안 왔는데, 옛 PDF 덕에 빌드가 초록이었다).
        if pdfp.exists():
            pdfp.unlink()
        노드 = shutil.which("node") or "C:/Program Files/nodejs/node.exe"
        r = subprocess.run(
            [노드, os.path.join(REPO, "tools", "지면인쇄.js"),
             str(outp.resolve()), str(pdfp.resolve()),
             "--기다림", "window.__SYNK_PAGED_DONE===true", "--최대초", "120"],
            capture_output=True, timeout=600)
        if r.returncode != 0 or not pdfp.exists():
            raise SystemExit("쪽번호판 PDF 생성 실패 (rc=%s)%s%s%s%s" % (
                r.returncode, chr(10), r.stdout.decode("utf-8", "replace"),
                chr(10), r.stderr.decode("utf-8", "replace")))
        print("PDF  → %s  (%.0f KB · 쪽번호판)" % (pdfp, pdfp.stat().st_size / 1024.0))
    elif a.pdf:
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

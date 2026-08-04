# -*- coding: utf-8 -*-
"""
SYNK 인쇄물 검사 — 만들어진 PDF 를 직접 열어 브랜드 키트 준수를 판정한다.

「고쳤다」는 소스가 아니라 결과물로 증명한다. 소스 CSS 를 문자열로 검색하면 거짓 음성이
난다(색을 rgb 숫자로 쓰거나 폰트가 조용히 폴백해도 CSS 는 멀쩡하다).

⚠ 단 결과물 검사도 양방향으로 틀린다. 초판이 그랬다 —
   **리소스 목록**을 읽고 Arial·Courier·Type3 를 「폴백 발생」이라 판정했는데, 실제로는
   Tf 로 선택된 적이 없는 미사용 리소스였다(브라우저가 넣어두기만 한 것). 색도 마찬가지로
   `0 g` 같은 초기화 연산이 칠한 적 없는 검정을 92회로 세게 만들었다.
   그래서 이 검사기는 선언이 아니라 **실사용**을 읽는다 — 컨텐츠 스트림을 해석해
   Tf 로 선택되고 Tj/TJ 로 그려진 폰트, 그리고 실제 페인트 연산에 걸린 색만 센다.

판정 3축:
  ① 쪽수  — 정해진 쪽수와 정확히 일치하는가
  ② 폰트  — 실제로 그린 서체가 브랜드 3종뿐인가 (Type3·Courier·Malgun = 폴백의 증거)
  ③ 색    — 실제로 칠한 색이 전부 키트 19색(+백지) 안인가, 금지색이 없는가

쓰는 법:
  python docs/tools/인쇄물_키트검사.py <file.pdf> [--pages 1] [--forbid lime,kc] [-v]
"""

import argparse
import re
import sys
from collections import Counter

from pypdf import PdfReader
from pypdf.generic import IndirectObject

KIT = {
    "#F6F1E8": "Cream",       "#FF6B5C": "Coral",      "#1A2340": "Navy",
    "#C8FF3D": "Lime",        "#171820": "Ink",
    "#FBF7EE": "Paper",       "#EFE7D7": "Cream 2",    "#E7DDC7": "Cream 3",
    "#FFE9E4": "Coral Wash",  "#FFCFC6": "Coral Soft", "#FF8877": "Coral 2",
    "#E8543F": "Coral 3",
    "#2A3358": "Navy 3",      "#131A32": "Navy Ink",   "#0F1730": "Navy 2",
    "#FF3E88": "KC Hot Pink", "#FF6BA8": "KC Pink 2",  "#FFD447": "KC Sun",
    "#4E7CFF": "KC Cool Blue",
}
NEUTRAL = {"#FFFFFF": "백지"}          # 종이 자체 — 잉크가 아니다

GROUPS = {
    "lime": ["#C8FF3D"],                                    # 앱 전용(성장·획득)
    "kc": ["#FF3E88", "#FF6BA8", "#FFD447", "#4E7CFF"],     # Part 6 · 모드 C 전용
}

BRAND_FONTS = ("intertight", "suit", "dmmono")
DELIMS = " \t\r\n\f\x00/[]<>(){}%"


def tokens(data):
    i, n = 0, len(data)
    while i < n:
        c = data[i]
        if c in " \t\r\n\f\x00":
            i += 1
        elif c == "%":
            j = data.find("\n", i)
            i = n if j < 0 else j + 1
        elif c == "(":
            depth, j = 1, i + 1
            while j < n and depth:
                if data[j] == "\\":
                    j += 2
                    continue
                depth += (data[j] == "(") - (data[j] == ")")
                j += 1
            yield ("lit", data[i + 1:j - 1])
            i = j
        elif c == "<":
            if data[i:i + 2] == "<<":
                yield ("op", "<<")
                i += 2
            else:
                j = data.find(">", i)
                yield ("hex", data[i + 1:(n if j < 0 else j)])
                i = (n if j < 0 else j + 1)
        elif c == ">":
            yield ("op", ">>")
            i += 2 if data[i:i + 2] == ">>" else 1
        elif c in "[]{}":
            yield ("op", c)
            i += 1
        elif c == "/":
            j = i + 1
            while j < n and data[j] not in DELIMS:
                j += 1
            yield ("name", data[i + 1:j])
            i = j
        else:
            j = i
            while j < n and data[j] not in DELIMS:
                j += 1
            tok = data[i:j]
            i = j if j > i else i + 1
            try:
                yield ("num", float(tok))
            except ValueError:
                yield ("op", tok)


def hexof(*v):
    return "#" + "".join("%02X" % max(0, min(255, round(x * 255))) for x in v)


def cmyk(c, m, y, k):
    return hexof(*[(1 - x) * (1 - k) for x in (c, m, y)])


def basefont(fdict):
    bf = fdict.get("/BaseFont")
    if bf:
        return re.sub(r"^[A-Z]{6}\+", "", str(bf).lstrip("/"))
    if fdict.get("/Subtype") == "/Type3":
        # Type3 = 글리프를 그리는 절차. 패스면 진짜 윤곽선, 이미지면 래스터라 화질이 죽는다.
        return "Type3(벡터)" if type3_is_vector(fdict) else "Type3(래스터)"
    return "?"


def type3_is_vector(fdict):
    cp = fdict.get("/CharProcs")
    if not cp:
        return False
    try:
        for k in list(cp.keys())[:6]:
            s = cp[k].get_object().get_data().decode("latin-1", "replace")
            if "BI " in s or ("/Im" in s and "Do" in s):
                return False
    except Exception:
        return False
    return True


def tounicode(fdict):
    """코드 → 유니코드 표. 이게 있어야 「그 폰트가 실제로 무슨 글자를 그렸나」를 읽을 수 있다."""
    m = {}
    tu = fdict.get("/ToUnicode")
    if tu is None:
        return m
    try:
        data = tu.get_object().get_data().decode("latin-1", "replace")
    except Exception:
        return m
    for blk in re.findall(r"beginbfchar(.*?)endbfchar", data, re.S):
        for a, b in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", blk):
            try:
                m[int(a, 16)] = "".join(chr(int(b[i:i + 4], 16)) for i in range(0, len(b), 4))
            except Exception:
                pass
    for blk in re.findall(r"beginbfrange(.*?)endbfrange", data, re.S):
        for lo, hi, dst in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", blk):
            lo_i, hi_i, d = int(lo, 16), int(hi, 16), int(dst, 16)
            for k in range(lo_i, min(hi_i, lo_i + 512) + 1):
                m[k] = chr(d + (k - lo_i))
    if not m:   # 블록 표기가 아닌 CMap 도 있다 — 못 읽으면 판정을 못 하므로 느슨하게 한 번 더
        for a, b in re.findall(r"<([0-9A-Fa-f]{2,4})>\s*<([0-9A-Fa-f]{4,})>", data):
            try:
                m[int(a, 16)] = "".join(chr(int(b[i:i + 4], 16)) for i in range(0, len(b), 4))
            except Exception:
                pass
    return m


def decode(raw, kind, tu):
    """PDF 문자열을 그 폰트의 ToUnicode 로 푼다. 못 풀면 U+FFFD 로 남겨 드러낸다."""
    if kind == "hex":
        h = re.sub(r"[^0-9A-Fa-f]", "", raw)
        codes = [int(h[i:i + 4], 16) for i in range(0, len(h) - 3, 4)]
    else:
        codes = [ord(c) for c in raw]
    return "".join(tu.get(c, "�") for c in codes)


def run(stream, resources, fonts_used, fills, strokes, depth=0, cache=None):
    """컨텐츠 스트림을 해석해 실제로 쓰인 폰트·색만 모은다. 폼 XObject 는 재귀."""
    if depth > 6:
        return
    cache = {} if cache is None else cache
    fdict = (resources or {}).get("/Font") or {}
    xobjs = (resources or {}).get("/XObject") or {}

    st = []                       # 피연산자 (kind, val)
    fill = stroke = "#000000"     # PDF 초기 색
    font, ftu = None, {}
    gstack = []

    for kind, val in tokens(stream):
        if kind in ("num", "name", "lit", "hex"):
            st.append((kind, val))
            continue
        op = val
        nums = [v for k, v in st if k == "num"]
        strs = [(k, v) for k, v in st if k in ("lit", "hex")]
        try:
            if op == "q":
                gstack.append((fill, stroke, font, ftu))
            elif op == "Q":
                if gstack:
                    fill, stroke, font, ftu = gstack.pop()
            elif op in ("rg", "RG") and len(nums) >= 3:
                c = hexof(*nums[-3:])
                fill, stroke = (c, stroke) if op == "rg" else (fill, c)
            elif op in ("g", "G") and len(nums) >= 1:
                c = hexof(nums[-1], nums[-1], nums[-1])
                fill, stroke = (c, stroke) if op == "g" else (fill, c)
            elif op in ("k", "K") and len(nums) >= 4:
                c = cmyk(*nums[-4:])
                fill, stroke = (c, stroke) if op == "k" else (fill, c)
            elif op in ("sc", "scn", "SC", "SCN") and nums:
                c = hexof(*nums[-3:]) if len(nums) >= 3 else hexof(nums[0], nums[0], nums[0])
                fill, stroke = (c, stroke) if op in ("sc", "scn") else (fill, c)
            elif op == "Tf":
                key = next((v for k, v in st if k == "name"), None)
                d = fdict.get("/" + str(key))
                if isinstance(d, IndirectObject):
                    d = d.get_object()
                if d is not None:
                    cid = id(d)
                    if cid not in cache:
                        cache[cid] = (basefont(d), tounicode(d))
                    font, ftu = cache[cid]
                else:
                    font, ftu = "?", {}
            elif op in ("Tj", "TJ", "'", '"'):
                if font:
                    rec = fonts_used.setdefault(font, {"runs": 0, "chars": set()})
                    rec["runs"] += 1
                    for k, v in strs:
                        rec["chars"].update(decode(v, k, ftu))
                fills[fill] += 1          # 텍스트는 채우기 색으로 그려진다(렌더모드 0)
            elif op in ("f", "F", "f*", "b", "b*", "B", "B*"):
                fills[fill] += 1
            elif op in ("S", "s"):
                strokes[stroke] += 1
            elif op == "Do":
                key = next((v for k, v in st if k == "name"), None)
                xo = xobjs.get("/" + str(key))
                if isinstance(xo, IndirectObject):
                    xo = xo.get_object()
                if xo is not None and xo.get("/Subtype") == "/Form":
                    run(xo.get_data().decode("latin-1", "replace"),
                        xo.get("/Resources") or resources,
                        fonts_used, fills, strokes, depth + 1, cache)
        except Exception:
            pass
        st = []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--pages", type=int, default=None)
    ap.add_argument("--forbid", default="")
    ap.add_argument("-v", "--verbose", action="store_true")
    a = ap.parse_args()

    r = PdfReader(a.pdf)
    fails = []

    # ── ① 쪽수 ──
    n = len(r.pages)
    ok = a.pages is None or n == a.pages
    if not ok:
        fails.append("쪽수 %d — 기대 %d" % (n, a.pages))
    print("① 쪽수 : %d  %s" % (n, "" if a.pages is None else ("OK" if ok else "FAIL")))

    fonts_used, fills, strokes = {}, Counter(), Counter()
    for p in r.pages:
        run(p.get_contents().get_data().decode("latin-1", "replace"),
            p.get("/Resources"), fonts_used, fills, strokes)

    # ── ② 폰트 (실제로 그린 것만) ──
    # ⚠ 「브랜드 밖 폰트가 있다」와 「브랜드 밖 글자가 보인다」는 다르다.
    #    브라우저는 단어 사이 공백을 시스템 폰트로 흘려보낸다(잉크 0). 그걸 폴백이라
    #    부르면 영원히 빨간 불이고, 그렇다고 이름만 보고 넘기면 진짜 폴백을 놓친다.
    #    → 그 폰트가 **잉크 있는 글자**를 그렸는지로 가른다.
    print("② 폰트 : 실제 렌더 %d종" % len(fonts_used))
    bad = []
    for f in sorted(fonts_used, key=lambda k: -fonts_used[k]["runs"]):
        rec = fonts_used[f]
        ink = {c for c in rec["chars"] if not c.isspace() and c != "�"}
        unknown = "�" in rec["chars"]
        brand = any(b in f.replace(" ", "").replace("-", "").lower() for b in BRAND_FONTS)
        vector3 = f == "Type3(벡터)"
        # 순서가 판정을 가른다 — 「못 읽었다」가 「무해」로 새지 않게 먼저 거른다.
        if brand:
            note = ""
        elif vector3:
            note = "← 윤곽선을 패스로 그림 · 자형 보존"
        elif f == "Type3(래스터)":
            note = "← 래스터 · 화질 손실"
            bad.append("%s(이미지 글리프)" % f)
        elif rec["runs"] and not rec["chars"]:
            # 그리긴 그렸는데 무슨 글자인지 못 읽었다 = 무해를 증명 못 한 상태다.
            note = "← 판독 불가 · 무해를 증명 못 함"
            bad.append("%s(판독불가)" % f)
        elif not ink and not unknown:
            note = "← 잉크 0 (공백만) · 무해"
        else:
            note = "← 브랜드 밖 · 폴백"
            bad.append("%s(%s)" % (f, "".join(sorted(ink))[:20] or "?"))
        print("     %-22s runs=%-5d 잉크글자=%-3d %s" % (f, rec["runs"], len(ink), note))
        if a.verbose and not brand:
            print("        그린 글자: %s" % (" ".join(sorted(rec["chars"])) or "(없음)"))
    if bad:
        fails.append("브랜드 밖 서체가 잉크를 그린다: %s" % ", ".join(sorted(set(bad))))
    else:
        print("     OK — 잉크는 브랜드 3종만")

    # ── ③ 색 (실제로 칠한 것만) ──
    forbid_hex = {}
    for grp in [x.strip() for x in a.forbid.split(",") if x.strip()]:
        for h in GROUPS.get(grp, []):
            forbid_hex[h] = grp

    print("③ 색   : 실제 페인트")
    outside = []
    both = fills + strokes
    for h, cnt in both.most_common():
        if h in KIT:
            tag = KIT[h]
            if h in forbid_hex:
                fails.append("이 문서에 금지된 색 %s %s (%s 전용) x%d" % (h, tag, forbid_hex[h], cnt))
                tag += "  ← 금지"
        elif h in NEUTRAL:
            tag = NEUTRAL[h]
        else:
            tag = "← 키트 밖"
            outside.append((h, cnt))
        print("     %-8s x%-5d %s" % (h, cnt, tag))
    if outside:
        fails.append("키트 밖 색 %d종: %s" % (len(outside), ", ".join("%s(x%d)" % o for o in outside)))

    print()
    if fails:
        print("판정: FAIL")
        for f in fails:
            print("  · %s" % f)
        sys.exit(1)
    print("판정: PASS — 쪽수·서체·색 전부 키트 안")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

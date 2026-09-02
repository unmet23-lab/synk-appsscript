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

   세 번째 결함(08-04 발표물 6종 검사에서 실측): scn 의 **이름 피연산자(Pattern)** 를 몰라
   `/Pattern cs /P117 scn … re f` 를 「초기 상태 검정 페인트」로 오인했다 — 크롬은 CSS
   radial-gradient 도트를 타일링 패턴으로 낸다. 이번엔 「실패」 쪽으로 샜지만(안전한 방향)
   가드가 실작업을 벌주면 사람이 가드를 끈다. 지금은 패턴 정의를 열어 **패턴이 실제로 칠할
   색**을 센다. 회귀 = `--selftest` — 그걸 CI 에서 발화시키던 tests/인쇄물키트검사.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다) 는 걷혔다: 지금은 손으로 부른다.

판정 3축:
  ① 쪽수  — 정해진 쪽수와 정확히 일치하는가
  ② 폰트  — 실제로 그린 서체가 브랜드 3종뿐인가 (Type3·Courier·Malgun = 폴백의 증거)
  ③ 색    — 실제로 칠한 색이 전부 킷(+백지) 안인가, 금지색이 없는가
            (개수는 여기 적지 않는다 — 토큰이 안다. 「19색」을 박아 뒀더니 색이 늘자 거짓이 됐다)

쓰는 법:
  python docs/tools/인쇄물_키트검사.py <file.pdf> [--pages 1] [--forbid lime,kc] [-v]
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

from pypdf import PdfReader
from pypdf.generic import IndirectObject

# 킷 색은 **여기 적지 않는다** — `docs/디자인_토큰.json` 에서 파생한다.
# 2026-08-07 실증: 이 파일이 손으로 19색을 들고 있는 사이 킷이 23색이 됐고(Slate 2색·Lime 2·
# Emerald), 새 회색으로 조판한 PDF 가 「키트 밖 색 2종」으로 **거짓 FAIL** 이 났다.
# 같은 드리프트를 `tools/브랜드렌더린트.js` 가 먼저 밟아 파생으로 고쳤는데 이 파이썬 사본만
# 남아 있었다 — 토큰의 `_규약` 소비자 목록에도 빠져 있다.
_토큰 = json.loads((Path(__file__).resolve().parents[1] / "디자인_토큰.json").read_text(encoding="utf-8"))
KIT = {c["hex"].upper(): c["이름"] for c in _토큰["색"]["킷"]}
NEUTRAL = {"#FFFFFF": "백지"}          # 종이 자체 — 잉크가 아니다

# 직책(전용 구역)은 파생하지 않는다 — 「어디에 쓰나」는 토큰의 `직책` 산문에만 있고,
# Lime 2·Emerald 의 구역 경계는 아직 미결이다(F153: 구역 선택자가 없어 렌더린트도 Lime 을
# 일부러 뺐다). 손 목록이되 킷 밖을 가리키면 아래 정합 검사가 죽인다.
GROUPS = {
    "lime": ["#C8FF3D"],                                    # 앱 전용(성장·획득)
    "kc": ["#FF3E88", "#FF6BA8", "#FFD447", "#4E7CFF"],     # Part 6 · 모드 C 전용
}
_미아 = [h for g in GROUPS.values() for h in g if h not in KIT]
if _미아:
    raise SystemExit("[키트검사] GROUPS 가 킷에 없는 색을 가리킨다(이름이 바뀌었거나 킷에서 빠졌다): "
                     + ", ".join(_미아))

BRAND_FONTS = ("intertight", "suit", "dmmono")

# 🔴 킷이 «일부러» 시스템 글꼴에 맡기는 가족 하나 — 그 두 글자에 한해서만 통과시킨다.
#   유호 확정 2026-08-31 「낫표 그거 킷에 박아줘」 · 정본 = docs/디자인_토큰.json 「서체.낫표교정」:
#     @font-face{font-family:'SYNK Bracket';src:local('Malgun Gothic'),…;unicode-range:U+300C-300D;}
#   낫표 「 」 는 Inter Tight 에 글리프가 없고 SUIT 이 그리면 0.396em 이라 옆 글자에 붙어
#   여는 따옴표로 오독된다(08-31 헤드리스 크롬 34px 실측 · 교정 뒤 0.571em).
#   ⇒ 이 가족이 그 두 글자를 그리는 것은 «폴백»이 아니라 킷 그대로다.
# ⚠ 그래서 이름만으로 통과시키지 않는다 — **그린 글자가 「」 안일 때만** 통과다.
#   이름만 보고 넘기면 이 가족이 다른 글자를 그리는 날(unicode-range 를 잘못 고친 날)
#   진짜 폴백이 이 문으로 조용히 지나간다.
# 실측 09-03: 이 칸이 없어 발표물 7벌 «전량»이 08-31 부터 FAIL 이었다 — 종이는 멀쩡한데
#   판정만 빨간, 주인 없는 적색이다.
SYSTEM_BY_DESIGN = {"synkbracket": set("「」")}

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


def _u16be(h):
    """UTF-16BE 16진 문자열 → 파이썬 문자열.

    코드유닛마다 chr() 하면 BMP 밖 글자(이모지)가 **lone surrogate 두 개**로 남는다. 그러면
    판정은 나오는데 위반 사유를 print 하는 순간 UnicodeEncodeError 로 죽는다 — 2026-08-07
    실측(인쇄본 16종 중 2종). 🔑 재는 층이 값을 깨뜨리면 「무엇이 위반인지」가 통째로 사라진다.
    """
    h = h[:len(h) - len(h) % 4]                       # 4자리 = 1 코드유닛 단위로만
    return bytes.fromhex(h).decode("utf-16-be", "replace")


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
                m[int(a, 16)] = _u16be(b)
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
                m[int(a, 16)] = _u16be(b)
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


def pattern_colors(po, resources, fonts_used, fills, strokes, depth, cache):
    """패턴이 실제로 칠할 색을 센다 — 타일링(1)은 내용 스트림 재귀, 셰이딩(2)은 함수 C0/C1."""
    try:
        pt = po.get("/PatternType")
        if pt == 1:
            run(po.get_data().decode("latin-1", "replace"),
                po.get("/Resources") or resources, fonts_used, fills, strokes, depth + 1, cache)
        elif pt == 2:
            sh = po.get("/Shading")
            if isinstance(sh, IndirectObject):
                sh = sh.get_object()
            fn = (sh or {}).get("/Function")
            if isinstance(fn, IndirectObject):
                fn = fn.get_object()
            fns = fn if isinstance(fn, list) else [fn] if fn is not None else []
            flat = []
            for f in fns:
                if isinstance(f, IndirectObject):
                    f = f.get_object()
                subs = f.get("/Functions") if hasattr(f, "get") else None
                flat.extend([s.get_object() if isinstance(s, IndirectObject) else s for s in subs] if subs else [f])
            for f in flat:
                for key in ("/C0", "/C1"):
                    arr = f.get(key) if hasattr(f, "get") else None
                    if arr is not None and len(arr) >= 3:
                        fills[hexof(*[float(x) for x in arr[:3]])] += 1
    except Exception:
        pass


def run(stream, resources, fonts_used, fills, strokes, depth=0, cache=None,
        init_fill="#000000", init_stroke="#000000"):
    """컨텐츠 스트림을 해석해 실제로 쓰인 폰트·색만 모은다. 폼 XObject 는 재귀(색 상태 상속)."""
    if depth > 6:
        return
    cache = {} if cache is None else cache
    fdict = (resources or {}).get("/Font") or {}
    xobjs = (resources or {}).get("/XObject") or {}

    st = []                            # 피연산자 (kind, val)
    fill, stroke = init_fill, init_stroke   # 페이지 스트림 = PDF 초기 검정 · XObject = 호출자 상태
    font, ftu = None, {}
    gstack = []
    # 크롬은 패턴 타일 이음새에 폭 ~0.00006유닛(0.00002mm) 짜리 봉합 rect 를 임의 색으로
    # 채운다 — 잉크 면적 0 이라 실체가 없다(05 로드맵에서 #333355·#404040 로 실측).
    # 경로가 「퇴화 rect 뿐」인 채우기는 세지 않는다. 스트로크는 퇴화 rect 라도 선이 찍히므로 그대로 센다.
    EPS = 0.05                         # PDF 유닛 · 실컨텐츠 최소 두께(≈0.3mm=0.85u)보다 훨씬 작다
    degen = None                       # None=경로 없음 · True=퇴화 rect 뿐 · False=실경로 있음

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
            elif op in ("sc", "scn", "SC", "SCN"):
                # 이름 피연산자 = Pattern 색공간. 잉크는 패턴 정의 안에 있으므로 거기서 세고,
                # 현재 색은 센티널로 바꿔 페인트 연산에서 이중 계수·검정 오인을 막는다(3번째 결함).
                pname = next((v for k, v in st if k == "name"), None)
                if pname is not None:
                    pats = (resources or {}).get("/Pattern") or {}
                    po = pats.get("/" + str(pname))
                    if isinstance(po, IndirectObject):
                        po = po.get_object()
                    if po is not None:
                        pattern_colors(po, resources, fonts_used, fills, strokes, depth, cache)
                    c = "(pattern)"
                    fill, stroke = (c, stroke) if op in ("sc", "scn") else (fill, c)
                elif nums:
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
                if fill != "(pattern)":   # 패턴 잉크는 정의에서 이미 셌다
                    fills[fill] += 1      # 텍스트는 채우기 색으로 그려진다(렌더모드 0)
            elif op == "re" and len(nums) >= 4:
                d = abs(nums[-2]) < EPS or abs(nums[-1]) < EPS
                degen = d if degen is None else (degen and d)
            elif op in ("m", "l", "c", "v", "y"):
                degen = False
            elif op in ("f", "F", "f*"):
                if fill != "(pattern)" and degen is not True:
                    fills[fill] += 1
                degen = None
            elif op in ("b", "b*", "B", "B*"):
                if fill != "(pattern)":
                    fills[fill] += 1
                if stroke != "(pattern)":
                    strokes[stroke] += 1
                degen = None
            elif op in ("S", "s"):
                if stroke != "(pattern)":
                    strokes[stroke] += 1
                degen = None
            elif op == "n":
                degen = None
            elif op == "Do":
                key = next((v for k, v in st if k == "name"), None)
                xo = xobjs.get("/" + str(key))
                if isinstance(xo, IndirectObject):
                    xo = xo.get_object()
                if xo is not None and xo.get("/Subtype") == "/Form":
                    run(xo.get_data().decode("latin-1", "replace"),
                        xo.get("/Resources") or resources,
                        fonts_used, fills, strokes, depth + 1, cache,
                        init_fill=fill, init_stroke=stroke)
        except Exception:
            pass
        st = []


class _FakeStream(dict):
    """selftest 용 최소 패턴 객체 — pypdf 스트림처럼 get()·get_data() 만 흉내낸다."""
    def __init__(self, d, data):
        super().__init__(d)
        self._d = data

    def get_data(self):
        return self._d.encode("latin-1")


def selftest():
    """3번째 결함(Pattern → 검정 오인) 회귀 픽스처. 탐지력은 여기가 지고,
    이걸 CI 에서 발화시키던 tests/인쇄물키트검사.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다) 는 걷혔다 — 지금 이 픽스처를 돌리는 것은 손 `--selftest` 하나다."""
    fonts, fills, strokes = {}, Counter(), Counter()
    tile = _FakeStream({"/PatternType": 1, "/Resources": {}}, "1 0 0 rg 0 0 5 5 re f")
    res = {"/Pattern": {"/P1": tile}, "/Font": {}, "/XObject": {}}
    run("/Pattern cs /P1 scn 0 0 10 10 re f 0 1 0 rg 0 0 1 1 re f", res, fonts, fills, strokes)
    assert fills.get("#FF0000") == 1, "타일링 패턴 안의 빨강을 못 셌다: %r" % dict(fills)
    assert "#000000" not in fills, "패턴 칠을 초기 검정으로 오인했다(3번째 결함 재발): %r" % dict(fills)
    assert fills.get("#00FF00") == 1, "패턴 뒤 일반 색 복원이 깨졌다: %r" % dict(fills)
    # 거짓양성만 없애고 탐지력은 유지 — 진짜 검정 페인트는 여전히 잡는다
    fonts2, fills2, strokes2 = {}, Counter(), Counter()
    run("0 0 10 10 re f", {}, fonts2, fills2, strokes2)
    assert fills2.get("#000000") == 1, "진짜 검정 페인트를 놓치게 됐다: %r" % dict(fills2)
    # 크롬의 타일 이음새 슬리버(면적 0 rect 채우기)는 세지 않는다 — 단 스트로크·실경로는 여전히 센다
    fonts3, fills3, strokes3 = {}, Counter(), Counter()
    run(".2 .2 .3333 rg 0 0 157 .00006 re f  1 0 0 RG 0 0 157 .00006 re S  0 0 1 rg 0 0 157 .00006 re 0 0 5 5 re f",
        {}, fonts3, fills3, strokes3)
    assert "#333355" not in fills3, "면적 0 슬리버 채우기를 세고 있다: %r" % dict(fills3)
    assert strokes3.get("#FF0000") == 1, "퇴화 rect 스트로크(실제로 선이 찍힌다)를 놓쳤다"
    assert fills3.get("#0000FF") == 1, "퇴화+실경로 혼합 채우기를 놓쳤다"
    # ToUnicode 의 서로게이트 페어 — 깨지면 「무엇이 위반인지」가 사라진다(판정은 FAIL 인 채로)
    assert _u16be("D83DDE00") == "\U0001F600", "이모지가 lone surrogate 로 남는다: %r" % _u16be("D83DDE00")
    assert _u16be("AC00") == "가"
    assert _u16be("AC0") == "", "잘린 코드유닛을 버리지 않는다"
    # 킷은 파생이라 손 목록과 갈라질 수 없다 — GROUPS 만 손이고 그건 로드 때 정합을 본다
    assert KIT == {c["hex"].upper(): c["이름"] for c in _토큰["색"]["킷"]}, "KIT 파생이 끊겼다"
    print("selftest OK — 패턴 3건 + 검정 탐지력 1건 + 슬리버 3건 + 서로게이트 3건 + 킷 파생 1건")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf", nargs="?")
    ap.add_argument("--pages", type=int, default=None)
    ap.add_argument("--forbid", default="")
    ap.add_argument("-v", "--verbose", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()

    if a.selftest:
        selftest()
        return
    if not a.pdf:
        ap.error("pdf 경로가 필요하다 (--selftest 제외)")

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
        평평한이름 = f.replace(" ", "").replace("-", "").lower()
        brand = any(b in 평평한이름 for b in BRAND_FONTS)
        # 킷이 일부러 시스템 글꼴에 맡긴 가족 — **그 글자 안일 때만** 통과다(위 SYSTEM_BY_DESIGN).
        맡긴글자 = next((v for k, v in SYSTEM_BY_DESIGN.items() if k in 평평한이름), None)
        킷대로 = 맡긴글자 is not None and ink and ink <= 맡긴글자
        벗어남 = 맡긴글자 is not None and not (ink <= 맡긴글자)
        vector3 = f == "Type3(벡터)"
        # 순서가 판정을 가른다 — 「못 읽었다」가 「무해」로 새지 않게 먼저 거른다.
        if brand:
            note = ""
        elif 킷대로:
            note = "← 킷이 시스템 글꼴에 맡긴 자리(낫표) · 토큰 「서체.낫표교정」"
        elif 벗어남:
            note = "← 🔴 맡긴 글자 밖까지 그린다"
            bad.append("%s(%s · 맡긴 것은 %s 뿐)" % (f, "".join(sorted(ink))[:20] or "?", "".join(sorted(맡긴글자))))
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

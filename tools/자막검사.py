# -*- coding: utf-8 -*-
# 자막 · 화면 글 검사 — 렌더하기 전에 글자가 제대로 읽히는지 본다(2026-11-13, 서울로 애니 자막 판에서).
#
# 왜 있나: 11-13 서울로 애니 자막을 다시 굽는 데 렌더 11분이 세 번 들었다. 세 번 모두 **렌더한 뒤에야** 알았다 —
#   ① 강조 금빛이 「누구나 걷는 길」+「로」처럼 조사 · 어미 앞에서 끊겨, 맥락 없는 시험관 둘이 따로 보고 「노래방 자막처럼 색이 차오르는 중」이라 했다(점검표 61)
#   ② 가장 긴 줄이 화면보다 넓어 text-align:center가 오른쪽으로만 넘쳤다(현장 노트 · 영상_ffmpeg_자막)
#   ③ 공고가 「서울서체 70pt 이상」을 요구했는데 실제 화면(640×120 LED)에서 몇 화소로 보이는지 재 본 적이 없었다.
#   모두 글자 그림(PNG) 단계에서 잡히는 것이라, 렌더 앞으로 당겨 「사람이 기억하지 않아도 걸리게」 옮겼다.
#
#   python -I -X utf8 tools/자막검사.py <자막글.json | 글.txt> [--그림 <PNG 폴더>] [--화면 640x120] [--폭 2000]
#                                        [--글꼴 <ttf>] [--크기 108] [--pt 70] [--장면글 "1970 처음 열린 찻길;2015 차가 멈춘 날"] [--json]
#
#   <자막글.json>: {"줄": {"1": {"화면": ["얘야, <i>옛날이야기</i> 하나 해 줄까?"]}}} 또는 ["…", "…"] 또는 한 줄에 하나인 글 파일.
#   --그림: 화면마다 <폴더>/S01_1/0001.png … (투명 PNG 연번). 가운데 맞춤 · 실제 화면 화소에서 읽히는지를 이 그림으로 잰다.
#   --화면 640x120: 실제로 걸리는 화면의 화소 수(서울로미디어캔버스는 640×120). 글자가 그 화면에서 몇 줄을 차지하는지 센다.
#   --폭 2000: 영상 가로 화소(그림이 없을 때 글 너비를 글꼴로 재는 데 쓴다).
#   --pt 70: 공고가 정한 가장 작은 글자 크기(pt). --크기(px)와 견준다 — 72dpi 기준 1pt = 1.333px.
#   --장면글: 장면 안에 구운 글(현수막 · 간판)을 세미콜론으로. 자막이 같은 연도 · 같은 말을 같이 하면 확인으로 알린다.
#
# 끝 코드: 0 걸림 · 확인 없음 / 1 걸림 있음 / 2 걸림은 없고 눈으로 볼 것(확인)이 있음 — 통과로 치지 않는다.
import json
import re
import sys
from pathlib import Path

강조 = re.compile(r"<i>(.*?)</i>", re.S)
맨글 = lambda t: re.sub(r"</?i>", "", t)


def 글읽기(p: Path):
    """자막글.json · 글 목록 json · 한 줄에 하나인 글 파일 → [(이름, 글)]."""
    if p.suffix.lower() == ".json":
        d = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(d, dict) and "줄" in d:
            return [(f"{n}_{j}", t) for n, v in d["줄"].items() for j, t in enumerate(v["화면"], 1)]
        if isinstance(d, dict):
            return [(str(k), v) for k, v in d.items()]
        return [(str(i + 1), t) for i, t in enumerate(d)]
    return [(str(i + 1), l) for i, l in enumerate(p.read_text(encoding="utf-8").splitlines()) if l.strip()]


def 글검사(화면들, 장면글=None):
    """원고만으로 보는 것 — 강조 어절 · 마침표 · 빈칸 · 장면 글과 겹침."""
    out = []
    for 이름, t in 화면들:
        s = 맨글(t)
        for m in 강조.finditer(t):
            w = m.group(1)
            i = s.find(w)
            if i < 0:
                out.append(("걸림", 이름, f"강조한 글을 본문에서 찾지 못했다 — 「{w}」")); continue
            if i > 0 and s[i - 1] != " ":
                out.append(("걸림", 이름, f"강조가 어절 중간에서 시작한다 — 「{w}」 ← 「{s}」(낱말 통째로 칠한다 · 점검표 61)"))
            j = i + len(w)
            if j < len(s) and s[j] != " ":
                out.append(("걸림", 이름, f"강조가 어절 중간에서 끝난다 — 「{w}」+「{s[j:].split(' ')[0]}」(조사 · 어미까지 묶는다 · 점검표 61)"))
        if s != s.strip() or "  " in s:
            out.append(("걸림", 이름, f"앞뒤 · 겹친 빈칸이 있다 — 「{s}」"))
        if s.rstrip().endswith("."):
            out.append(("확인", 이름, f"자막 끝에 마침표가 있다 — 「{s}」(물음표 · 느낌표 · 쉼표만 쓴다 · 점검표 6)"))
    if 장면글:
        연도 = lambda x: set(re.findall(r"(?:19|20)\d{2}", x))
        for 이름, t in 화면들:
            s, 칠한것 = 맨글(t), [m.group(1) for m in 강조.finditer(t)]
            for g in 장면글:
                같은해 = 연도(s) & 연도(g)
                if 같은해:
                    out.append(("확인", 이름, f"장면 안 글과 같은 연도를 함께 말한다 — 자막 「{s}」 · 장면 「{g}」({sorted(같은해)[0]}). 한 화면에 글이 두 줄로 겹쳐 읽힌다"))
                    if any(연도(w) & 같은해 for w in 칠한것):
                        out.append(("걸림", 이름, f"장면 안 글이 이미 말한 연도를 자막에서 또 칠했다 — 「{칠한것[0]}」 · 장면 「{g}」(같은 말이 두 색으로 두 번 · 점검표 61)"))
    # 강조를 고르는 규칙 — 줄마다 갈래가 다르면 보는 사람이 그 색의 뜻을 배울 수 없다(11-14 맹검 둘이 따로 같은 말을 했다)
    칠한화면 = [(이름, m.group(1)) for 이름, t in 화면들 for m in 강조.finditer(t)]
    if 칠한화면:
        비율 = len({이름 for 이름, _ in 칠한화면}) / max(1, len(화면들))
        if 비율 > 0.5:
            out.append(("확인", "-", f"자막 {len(화면들)}화면 가운데 {len({이름 for 이름, _ in 칠한화면})}곳을 칠했다({비율*100:.0f}%) — 줄마다 색이 있으면 강조가 아니라 무늬가 된다(점검표 61)"))
        갈래 = lambda w: ("때" if re.search(r"(?:19|20)\d{2}|겨울|여름|봄|가을|크리스마스|설날|추석", w) else
                        "사람" if re.search(r"할머니|할아버지|엄마|아빠|아이|아들|딸|손녀|손자|우리", w) else "그 밖")
        종류 = {갈래(w) for _, w in 칠한화면}
        if len(종류) > 1:
            보기 = " · ".join(f"「{w}」({갈래(w)})" for _, w in 칠한화면[:5])
            out.append(("확인", "-", f"칠한 낱말의 갈래가 섞였다({' · '.join(sorted(종류))}) — {보기}. 한 갈래로 묶지 않으면 그 색이 무엇을 뜻하는지 읽히지 않는다(점검표 61)"))
    return out


def 그림검사(화면들, 폴더: Path, 화면화소=None):
    """구운 PNG로 보는 것 — 가운데 맞춤 · 실제 화면 화소에서의 글자 높이와 대비."""
    from PIL import Image
    import numpy as np
    out, 잰것 = [], []
    for 이름, t in 화면들:
        d = 폴더 / f"S{int(이름.split('_')[0]):02d}_{이름.split('_')[1]}" if "_" in 이름 else 폴더 / 이름
        if not d.is_dir():
            d2 = 폴더 / 이름
            if not d2.is_dir():
                out.append(("확인", 이름, f"글자 그림 폴더가 없다 — {d}")); continue
            d = d2
        장 = sorted(d.glob("*.png"))
        if not 장:
            out.append(("확인", 이름, f"글자 그림이 없다 — {d}")); continue
        im = Image.open(장[len(장) // 2]).convert("RGBA")
        a = np.asarray(im)[..., 3]
        xs = np.where((a > 200).any(axis=0))[0]
        ys = np.where((a > 200).any(axis=1))[0]
        if not len(xs):
            out.append(("걸림", 이름, "글자 그림에 불투명한 글자가 없다")); continue
        왼, 오 = int(xs.min()), im.width - 1 - int(xs.max())
        높이 = int(ys.max() - ys.min()) + 1
        잰것.append((이름, 왼, 오, 높이, im.width))
        if abs(왼 - 오) > max(12, im.width * 0.01):
            out.append(("걸림", 이름, f"글자가 가운데에 있지 않다 — 왼쪽 여백 {왼}px · 오른쪽 {오}px(글이 화면보다 넓으면 한쪽으로만 넘친다 · flex 가운데 맞춤)"))
        if 왼 < 0 or 오 < 0 or xs.min() == 0 or xs.max() == im.width - 1:
            out.append(("걸림", 이름, "글자가 화면 가장자리에 닿거나 잘렸다"))
        if 화면화소:
            W, H = 화면화소
            작 = im.resize((W, int(round(H * im.height / im.width * im.width / im.height)) if False else H), Image.BOX)
            aa = np.asarray(작)[..., 3].astype(np.int16)
            줄 = np.where((aa > 110).any(axis=1))[0]
            if not len(줄):
                out.append(("걸림", 이름, f"실제 화면({W}×{H})으로 줄이면 글자가 사라진다"))
            else:
                h = int(줄.max() - 줄.min()) + 1
                if h < 8:
                    out.append(("걸림", 이름, f"실제 화면({W}×{H})에서 글자 높이가 {h}줄뿐이다 — 한글은 8줄 아래면 획이 뭉개진다"))
                elif h < 12:
                    out.append(("확인", 이름, f"실제 화면({W}×{H})에서 글자 높이 {h}줄 — 획 많은 글자를 눈으로 본다"))
    if 잰것:
        hs = [h for *_, h, _ in 잰것]
        print(f"  글자 높이 {min(hs)}~{max(hs)}px · 좌우 여백 차이 최대 {max(abs(l - r) for _, l, r, *_ in 잰것)}px · 화면 {잰것[0][4]}px", file=sys.stderr)
    return out


def 크기검사(화면들, 글꼴, 크기, pt최소, 폭):
    out = []
    if pt최소 and 크기:
        pt = 크기 * 0.75                                  # 72dpi: 1px = 0.75pt
        if pt < pt최소:
            out.append(("걸림", "-", f"글자 크기 {크기}px = {pt:.0f}pt — 규정 {pt최소}pt 아래다(규정 크기는 {pt최소 / 0.75:.0f}px부터)"))
    if 글꼴 and 크기 and 폭:
        from PIL import ImageFont
        ft = ImageFont.truetype(str(글꼴), 크기)
        for 이름, t in 화면들:
            w = ft.getlength(맨글(t))
            if w > 폭:
                out.append(("걸림", 이름, f"글이 화면보다 넓다 — {w:.0f}px > {폭}px 「{맨글(t)}」"))
            elif w > 폭 * 0.94:
                out.append(("확인", 이름, f"글이 화면 폭의 {w / 폭 * 100:.0f}% — 그늘 · 테두리 여백까지 더하면 넘칠 수 있다 「{맨글(t)}」"))
    return out


def main(argv):
    def 값(k, 기본=None):
        return argv[argv.index(k) + 1] if k in argv else 기본
    if len(argv) < 2 or argv[1].startswith("--"):
        print(__doc__ or "사용법은 이 파일 맨 위 주석", file=sys.stderr); return 1
    화면들 = 글읽기(Path(argv[1]))
    장면글 = [s.strip() for s in (값("--장면글") or "").split(";") if s.strip()]
    out = 글검사(화면들, 장면글)
    크기 = int(값("--크기", 0) or 0)
    out += 크기검사(화면들, 값("--글꼴"), 크기, float(값("--pt", 0) or 0), int(값("--폭", 0) or 0))
    if "--그림" in argv:
        화면화소 = None
        if "--화면" in argv:
            W, H = 값("--화면").lower().split("x")
            화면화소 = (int(W), int(H))
        out += 그림검사(화면들, Path(값("--그림")), 화면화소)
    걸림 = [x for x in out if x[0] == "걸림"]
    확인 = [x for x in out if x[0] == "확인"]
    if "--json" in argv:
        print(json.dumps({"화면": len(화면들), "걸림": len(걸림), "확인": len(확인),
                          "항목": [{"등급": a, "화면": b, "글": c} for a, b, c in out]}, ensure_ascii=False, indent=1))
    else:
        for a, b, c in out:
            print(f"  {a} {b}: {c}")
        print(f"자막 {len(화면들)}화면 · 걸림 {len(걸림)} · 확인 {len(확인)}")
    return 1 if 걸림 else (2 if 확인 else 0)


if __name__ == "__main__":
    sys.exit(main(sys.argv))

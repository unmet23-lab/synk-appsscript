#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""콘티 검수 판 — 이미지 콘티를 「처음 보는 시청자」가 시간 순서대로 보게 판과 컷 표를 만든다.

    python -I -X utf8 tools/콘티검수판.py <편 폴더> [--그림 <폴더>] [--밖 <폴더>] [--json]

왜 있나(2026-11-20 유호님 「시청자입장에서 흐름 끊기지않고 몰입해서 재밌게 볼수있는지에대한 검수도 해줘. 그리고 이 검수자도 추가하면 어떨까?」):
  공모전 편 하나가 컷마다 지적을 반영하며 38컷 3분 35초에서 61컷 5분 7초로 늘었다. 컷 하나하나는 나아졌지만 편 전체를
  시간 순서로 본 눈이 없어, 핵심 꺾임이 전체의 76% 자리까지 밀린 것을 아무도 재지 않았다. 처음 보는 시청자 둘이 따로 보고
  둘 다 꺾임 전에 넘긴다고 답했다. 글 정본은 슬롭 점검표 「심사 지시문」의 시청자 검수 문단, 지시문 정본은
  docs/마케팅/제작양식/영상양식/시청자검수_지시문.md.

만드는 것(밖 — 기본 <편>/검수/시청자):
  판_N.jpg         컷을 보는 순서대로 아홉 장씩(세로 영상은 열 장씩 · 컷이 적으면 판이 셋은 되게 줄인다).
                   꼬리표는 번호 · 시작 시각 · 길이 · 그 컷에서 들리는 말뿐이다.
  컷/NN.jpg        한 장씩 크게.
  컷표_검수용.md   번호 · 시각 · 초 · 화면(구도 + 카메라 + 연기 · 움직임) · 소리.
                   만든 사람의 제목(line) · 기승전결(band) · 메모 · 넘어옴 · 타당성 · 감정자리 · 앵글 까닭 · 소품 표는 뺀다.
                   글 속의 컷 이름은 보는 순서 번호로 바꾼다.
  지시문_시청자.md 지시문 정본에 이 편의 수(판 · 컷 · 길이)를 채운 사본.

그림은 --그림 <폴더>의 <컷>.jpg|png|webp, 없으면 컷표의 「시작그림」(편 폴더 기준 · 목록이면 첫 장)에서 찾는다.
못 찾은 컷은 「그림 없음」 칸으로 두고 끝에 목록을 찍는다. 그림이 한 장도 없으면 만들지 않는다(끝 코드 1).
이 도구는 판만 만든다 — 검수자를 부르는 것은 제작 세션이 한다(맥락 없는 하위 에이전트 둘, 서로 다른 모델).
"""
import argparse
import json
import math
import os
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

뿌리 = Path(__file__).resolve().parent.parent
정본 = 뿌리 / "docs" / "마케팅" / "제작양식" / "영상양식" / "시청자검수_지시문.md"
가름 = "<!-- 여기부터 검수자에게 준다 -->"
글꼴후보 = {False: [Path("C:/Windows/Fonts/malgun.ttf"), Path("/usr/share/fonts/truetype/nanum/NanumGothic.ttf")],
          True: [Path("C:/Windows/Fonts/malgunbd.ttf"), Path("/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf")]}
그림확장자 = (".jpg", ".jpeg", ".png", ".webp")
긴변 = 1568          # 한 장씩 크게 보는 그림의 긴 변
메모낱말 = re.compile(r"유호님|고르심|\d{1,2}-\d{1,2} ")   # 화면 · 소리 칸에 섞인 만든 사람의 메모로 보이는 글


def 글꼴(크기, 굵게=False):
    for p in 글꼴후보[굵게] + 글꼴후보[not 굵게]:
        if p.exists():
            try:
                return ImageFont.truetype(str(p), 크기)
            except OSError:
                pass
    return ImageFont.load_default()


def 시각(t):
    m, s = divmod(int(round(float(t or 0))), 60)
    return f"{m}:{s:02d}"


def 길이글(초):
    m, s = divmod(int(round(초)), 60)
    return (f"{m}분 {s}초" if s else f"{m}분") if m else f"{s}초"


def 단위글(초):
    """관심 곡선의 단위 — 짧은 편은 30초 단위로는 한두 칸뿐이다."""
    return "5초" if 초 <= 40 else "10초" if 초 <= 120 else "30초"


def 들리는말(d):
    return re.findall(r"「([^」]{1,90})」", str(d.get("소리") or ""))


def 그림찾기(d, 편, 그림폴더):
    """--그림 폴더의 <컷>.* 가 먼저, 없으면 컷표 「시작그림」(편 폴더 기준 · 목록이면 첫 장)."""
    컷 = str(d.get("cut"))
    if 그림폴더:
        for e in 그림확장자:
            p = 그림폴더 / f"{컷}{e}"
            if p.is_file():
                return p
    v = d.get("시작그림")
    for x in ([v] if isinstance(v, str) else v if isinstance(v, list) else [])[:1]:
        if isinstance(x, str) and x.strip():
            p = Path(os.path.expanduser(x.strip()))
            p = p if p.is_absolute() else 편 / p
            if p.is_file():
                return p
    return None


def 움직임글(d):
    줄 = []
    for e in d.get("연기") or []:
        if isinstance(e, dict) and str(e.get("무엇") or "").strip():
            t = e.get("t")
            줄.append((f"{t:g}초 " if isinstance(t, (int, float)) else "") + str(e["무엇"]).strip())
        elif isinstance(e, str) and e.strip():
            줄.append(e.strip())
    글 = " → ".join(줄)
    둘레 = str(d.get("움직임") or "").strip()
    if 글 and 둘레:
        return f"{글} / 둘레: {둘레}"
    return 글 or 둘레


def 칸글(글):
    return str(글).replace("|", "/").replace("\r", " ").replace("\n", " ").strip()


def 번호바꾸기(글, 번호):
    """글 속의 컷 이름(C07 · A11#2)을 보는 순서 번호로 — 검수자는 컷 이름을 모른다. 뒤 조사도 받침에 맞춘다."""
    조사 = {"와": "과", "가": "이", "는": "은", "를": "을", "로": "으로"}
    for 이름 in sorted(번호, key=len, reverse=True):
        무늬 = re.compile(rf"(?<![A-Za-z0-9]){re.escape(이름)}(?![A-Za-z0-9#])([와가는를로]?)")
        글 = 무늬.sub(lambda m: f"{번호[이름]}번{조사.get(m.group(1), m.group(1))}", 글)
    return 글


def 줄나눔(dr, 글, 폰트, 폭):
    out, cur = [], ""
    for ch in 글:
        if dr.textlength(cur + ch, font=폰트) > 폭:
            out.append(cur)
            cur = ch
        else:
            cur += ch
    if cur:
        out.append(cur)
    return out


def 판짜임(컷수, 세로):
    """(열, 행, 한 판의 칸 수, 칸 폭, 칸 높이) — 가로 영상은 3×3, 세로 영상은 5×2.
    컷이 적으면 한 판의 칸을 줄여 판이 셋은 되게 한다(판 한 장을 보고 바로 적는 읽기가 뜻을 가지려면 판이 여럿이어야 한다)."""
    열, 행최대, 폭, 높이 = (5, 2, 384, 683) if 세로 else (3, 3, 640, 360)
    칸 = min(열 * 행최대, max(2, math.ceil(컷수 / 3)))
    return 열, math.ceil(칸 / 열), 칸, 폭, 높이


def 만들기(편, 그림폴더=None, 밖=None):
    표길 = 편 / "컷표.json"
    if not 표길.is_file():
        raise SystemExit(f"컷표가 없다 — {표길}")
    표 = json.loads(표길.read_text(encoding="utf-8"))
    컷들 = [d for d in (표.get("detail") or []) if isinstance(d, dict) and d.get("cut") is not None]
    if not 컷들:
        raise SystemExit("컷표에 컷(detail)이 없다")
    그림들 = [그림찾기(d, 편, 그림폴더) for d in 컷들]
    없는 = [f"{n}번({d.get('cut')})" for n, (d, p) in enumerate(zip(컷들, 그림들), 1) if p is None]
    if all(p is None for p in 그림들):
        raise SystemExit("그림이 한 장도 없다 — 이미지 콘티를 받은 뒤 돌린다(--그림 <폴더> 또는 컷표의 「시작그림」)")
    밖 = 밖 or 편 / "검수" / "시청자"
    (밖 / "컷").mkdir(parents=True, exist_ok=True)
    for p in list(밖.glob("판_*.jpg")) + list((밖 / "컷").glob("*.jpg")):   # 지난 판이 섞이지 않게
        p.unlink()

    자리 = max(2, len(str(len(컷들))))
    열린 = []
    for n, p in enumerate(그림들, 1):
        if p is None:
            열린.append(None)
            continue
        im = Image.open(p).convert("RGB")
        큰 = im.copy()
        큰.thumbnail((긴변, 긴변), Image.LANCZOS)
        큰.save(밖 / "컷" / f"{n:0{자리}d}.jpg", quality=88)
        열린.append(im)
    세로 = sum(1 for im in 열린 if im is not None and im.height > im.width) * 2 > sum(1 for im in 열린 if im is not None)
    열, 행, 칸, 폭, 높이 = 판짜임(len(컷들), 세로)
    꼬리 = 96
    판수 = 0
    for s in range(0, len(컷들), 칸):
        판수 += 1
        묶음 = 컷들[s:s + 칸]
        판 = Image.new("RGB", (폭 * 열, (높이 + 꼬리) * 행), (18, 18, 18))
        dr = ImageDraw.Draw(판)
        for i, d in enumerate(묶음):
            n = s + i + 1
            x, y = (i % 열) * 폭, (i // 열) * (높이 + 꼬리)
            im = 열린[n - 1]
            if im is None:
                dr.rectangle((x + 4, y + 4, x + 폭 - 4, y + 높이 - 4), outline=(90, 90, 90))
                dr.text((x + 폭 // 2 - 50, y + 높이 // 2 - 12), "그림 없음", font=글꼴(22), fill=(150, 150, 150))
            else:
                a = im.copy()
                a.thumbnail((폭 - 8, 높이 - 8), Image.LANCZOS)
                판.paste(a, (x + (폭 - a.width) // 2, y + (높이 - a.height) // 2))
            dr.text((x + 8, y + 높이 + 4), str(n), font=글꼴(26, True), fill=(255, 214, 80))
            dr.text((x + 16 + 16 * len(str(n)), y + 높이 + 9), f"{시각(d.get('t'))} · {float(d.get('dur') or 0):g}초", font=글꼴(20), fill=(200, 200, 200))
            말 = " / ".join(들리는말(d))
            if 말:
                for k, 줄 in enumerate(줄나눔(dr, "들리는 말: " + 말, 글꼴(18), 폭 - 20)[:2]):
                    dr.text((x + 8, y + 높이 + 40 + k * 24), 줄, font=글꼴(18), fill=(235, 235, 235))
        판.save(밖 / f"판_{판수}.jpg", quality=88)

    끝초 = float(표.get("end") or max(float(d.get("t") or 0) + float(d.get("dur") or 0) for d in 컷들))
    번호 = {}
    세는 = {}
    for n, d in enumerate(컷들, 1):
        이름 = str(d["cut"])
        세는[이름] = 세는.get(이름, 0) + 1
        번호.setdefault(이름, n)                      # 「A11」은 첫 토막
        번호.setdefault(f"{이름}#{세는[이름]}", n)      # 「A11#2」는 둘째 토막
    줄 = [f"# 컷 표(검수용) — {len(컷들)}컷 · {시각(끝초)}", "", "| 번호 | 시각 | 초 | 화면 | 소리 |", "|---|---|---|---|---|"]
    의심 = []
    for n, d in enumerate(컷들, 1):
        조각 = [칸글(d.get("구도") or "")]
        if str(d.get("카메라") or "").strip():
            조각.append("카메라 " + 칸글(d["카메라"]))
        if 움직임글(d):
            조각.append(칸글(움직임글(d)))
        화면 = 번호바꾸기(". ".join(x for x in 조각 if x), 번호)
        소리 = 번호바꾸기(칸글(d.get("소리") or ""), 번호)
        if 메모낱말.search(화면 + " " + 소리):
            의심.append(f"{n}번({d.get('cut')})")
        줄.append(f"| {n} | {시각(d.get('t'))} | {float(d.get('dur') or 0):g} | {화면} | {소리} |")
    (밖 / "컷표_검수용.md").write_text("\n".join(줄) + "\n", encoding="utf-8", newline="\n")

    지시문 = ""
    if 정본.is_file():
        글 = 정본.read_text(encoding="utf-8")
        if 가름 in 글:
            지시문 = 글.split(가름, 1)[1].lstrip("\r\n")
            for 열쇠, 값 in {"{길이}": 길이글(끝초), "{판수}": str(판수), "{컷수}": str(len(컷들)), "{첫번호}": f"{1:0{자리}d}",
                           "{끝번호}": f"{len(컷들):0{자리}d}", "{단위}": 단위글(끝초)}.items():
                지시문 = 지시문.replace(열쇠, 값)
            (밖 / "지시문_시청자.md").write_text(지시문, encoding="utf-8", newline="\n")
    return {"밖": str(밖), "판": 판수, "컷": len(컷들), "길이": 시각(끝초), "세로": 세로, "한판": 칸, "그림없음": 없는, "메모의심": 의심, "지시문": bool(지시문)}


def main(argv=None):
    ap = argparse.ArgumentParser(description="이미지 콘티를 처음 보는 시청자에게 보일 판 · 컷 표 · 지시문을 만든다")
    ap.add_argument("편", help="편 폴더(컷표.json이 있는 곳)")
    ap.add_argument("--그림", help="<컷>.jpg|png|webp가 든 폴더 — 없으면 컷표의 「시작그림」")
    ap.add_argument("--밖", help="만들 곳 — 기본 <편>/검수/시청자")
    ap.add_argument("--json", action="store_true", help="결과를 JSON 한 줄로")
    a = ap.parse_args(argv)
    편 = Path(a.편).resolve()
    r = 만들기(편, Path(a.그림).resolve() if a.그림 else None, Path(a.밖).resolve() if a.밖 else None)
    if a.json:
        print(json.dumps(r, ensure_ascii=False))
        return 0
    print(f"콘티 검수 판 — 판 {r['판']}장(한 판 {r['한판']}칸{' · 세로' if r['세로'] else ''}) · 컷 {r['컷']} · {r['길이']} → {r['밖']}")
    if r["그림없음"]:
        print(f"  그림 없음 {len(r['그림없음'])}컷 — {' · '.join(r['그림없음'])}")
    if r["메모의심"]:
        print(f"  화면 · 소리 칸에 만든 사람의 메모로 보이는 글이 있다 — {' · '.join(r['메모의심'])}. 컷표에서 그 글을 「메모」 칸으로 옮기고 다시 만든다")
    if not r["지시문"]:
        print(f"  지시문 정본을 못 읽었다 — {정본}")
    print("다음: 맥락 없는 하위 에이전트 둘(서로 다른 모델 · 보통 시청자와 이 편을 실제로 고르는 사람)에게 이 폴더의 지시문_시청자.md를 따로 맡긴다 — "
          "맡기는 글은 docs/마케팅/제작양식/영상양식/시청자검수_지시문.md. 답은 「구조의 끊김」과 「정지 그림의 한계」로 갈라 읽는다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

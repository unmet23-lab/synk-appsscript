#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""글꼴재기 — 글 한 줄을 그 글꼴 줄(CSS font-family 순서)로 실제 글꼴 파일에 대 본다(2026-11-10, LAB 하루 두 편 설계 11).

tools/lib/글자검사.js가 부른다. 읽기만 하고 아무것도 쓰지 않는다.
  ① 없는 글자(네모 글자) — 글꼴 줄의 어느 글꼴 cmap에도 없는 글자(fontTools)
  ② 결합 글자 깨짐 — HarfBuzz(uharfbuzz)로 조판했을 때 원문에 없던 점선 원(U+25CC)이나 빈 글리프(.notdef)가 생긴 수.
     태국 · 크메르 · 버마 · 데바나가리 · 싱할라 셰이퍼는 바탕 글자 없이 붙은 표시 · 순서가 틀린 묶음에 점선 원을 끼운다.
  ③ 폭 — 글꼴 크기 「크기」(px)로 조판한 한 줄 폭(px). 줄 최대 글자 어림과 넘침 미리 보기에 쓴다(실제 넘침은 크롬 잼이 정본).
  ④ 글꼴별 — 어느 글꼴이 몇 글자를 맡았나(글꼴 대체 확인).

  python -X utf8 tools/lib/글꼴재기.py < 입력.json
  입력: {"크기": 100, "줄들": [{"글": "…", "언어": "th", "크기": 60, "볼글자": "…“”", "글꼴": [{"이름": "Inter Tight", "파일": "…ttf", "번호": 0}, …]}]}
  출력: {"줄들": [{"없는글자": ["U+0E01 ก"], "점선원": 0, "빈글리프": 0, "폭": 812.4, "줄폭": [812.4], "글꼴별": {"Leelawadee UI": 9},
         "볼글자글꼴": {"…": "Inter Tight"}}], "글꼴": {...}}   (글 안의 줄바꿈마다 따로 재고 「폭」은 가장 긴 줄)
"""
import io
import json
import sys
import unicodedata

try:
    from fontTools.ttLib import TTFont
    import uharfbuzz as hb
except Exception as e:  # 모듈이 없으면 부르는 쪽이 「확인할 것: 글꼴 검사 못 함」으로 받는다
    print(json.dumps({"오류": f"fontTools · uharfbuzz를 못 불렀다: {e}"}, ensure_ascii=False))
    sys.exit(3)

# 글꼴에 없어도 되는 글자 — 공백 · 줄바꿈과 보이지 않는 이음 글자(ZWJ · ZWNJ · WJ · 변형 선택자 · BOM · 소프트 하이픈).
무시 = set([0x0A, 0x0D, 0x09, 0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF, 0x00AD] + list(range(0xFE00, 0xFE10)))
점선원 = 0x25CC

_글꼴들 = {}


def 글꼴열기(파일, 번호=0):
    키 = (파일, 번호)
    if 키 in _글꼴들:
        return _글꼴들[키]
    tt = TTFont(파일, fontNumber=번호, lazy=False)
    cmap = tt.getBestCmap() or {}
    이름 = tt["name"].getDebugName(1) or 파일
    if 파일.lower().endswith((".woff2", ".woff")):
        # HarfBuzz는 woff2를 못 읽는다 — fontTools로 풀어 sfnt 바이트로 넘긴다(brotli 필요).
        tt.flavor = None
        buf = io.BytesIO()
        tt.save(buf)
        data = buf.getvalue()
        face = hb.Face(hb.Blob(data), 0)
    else:
        with open(파일, "rb") as f:
            data = f.read()
        face = hb.Face(hb.Blob(data), 번호)
    font = hb.Font(face)
    값 = {"cmap": cmap, "이름": 이름, "face": face, "font": font, "upem": face.upem,
         "점선": font.get_nominal_glyph(점선원)}
    _글꼴들[키] = 값
    return 값


def 묶음들(글):
    """바탕 글자 + 뒤따르는 결합 표시(M*) · 이음 글자를 한 묶음으로(크롬도 글꼴 대체를 묶음 단위로 한다)."""
    out = []
    for ch in 글:
        cp = ord(ch)
        cat = unicodedata.category(ch)
        붙음 = cat.startswith("M") or cp in (0x200C, 0x200D) or (out and ord(out[-1][-1]) in (0x200D,))
        if out and 붙음:
            out[-1] += ch
        else:
            out.append(ch)
    return out


def 한줄(글, 글꼴줄, 언어, 크기, 볼글자, 없는, 맡음, 볼결과, 기호):
    조각 = []  # [글꼴 순번, 글]
    for 묶음 in 묶음들(글):
        보일것 = [c for c in 묶음 if ord(c) not in 무시 and not unicodedata.category(c).startswith("C")]
        if not 보일것:
            # 공백 · 이음 글자만 — 앞 조각에 붙인다(앞이 없으면 첫 글꼴)
            if 조각:
                조각[-1][1] += 묶음
            else:
                조각.append([0, 묶음])
            continue
        고른 = None
        for i, g in enumerate(글꼴줄):
            if all(ord(c) in g["cmap"] for c in 보일것):
                고른 = i
                break
        if 고른 is None:
            # 바탕 글자라도 있는 글꼴 — 없으면 첫 글꼴(네모 글자로 나온다)
            for i, g in enumerate(글꼴줄):
                if ord(보일것[0]) in g["cmap"]:
                    고른 = i
                    break
            for c in 보일것:
                if not any(ord(c) in g["cmap"] for g in 글꼴줄):
                    # 이모지 · 화살표 같은 기호(So)는 크롬이 시스템 이모지 · 기호 글꼴로 그린다 — 네모가 아니라 「글꼴 줄 밖」으로 따로 센다
                    if unicodedata.category(c) == "So" and ord(c) >= 0x2190:
                        기호.append("U+%04X %s" % (ord(c), c))
                    else:
                        없는.append("U+%04X %s" % (ord(c), c))
            if 고른 is None:
                고른 = 0
        if 글꼴줄:
            이름 = 글꼴줄[고른]["이름"]
            맡음[이름] = 맡음.get(이름, 0) + 1
            for c in 보일것:
                if c in 볼글자:
                    볼결과[c] = 이름 if any(ord(c) in g["cmap"] for g in 글꼴줄) else None
        if 조각 and 조각[-1][0] == 고른:
            조각[-1][1] += 묶음
        else:
            조각.append([고른, 묶음])
    폭 = 0.0
    점선 = 0
    빈 = 0
    for 순번, 텍스트 in 조각:
        g = 글꼴줄[순번]
        buf = hb.Buffer()
        buf.add_str(텍스트)
        buf.guess_segment_properties()
        if 언어:
            try:
                buf.language = 언어
            except Exception:
                pass
        hb.shape(g["font"], buf, {})
        원문점선 = 텍스트.count(chr(점선원))
        생긴점선 = 0
        for info in buf.glyph_infos:
            if info.codepoint == 0:
                빈 += 1
            if g["점선"] is not None and info.codepoint == g["점선"]:
                생긴점선 += 1
        점선 += max(0, 생긴점선 - 원문점선)
        폭 += sum(p.x_advance for p in buf.glyph_positions) * 크기 / g["upem"]
    return 폭, 점선, 빈


def 재기(줄, 크기):
    글 = 줄.get("글", "")
    크기 = float(줄.get("크기", 크기))
    글꼴줄 = []
    for g in 줄.get("글꼴", []):
        f = dict(글꼴열기(g["파일"], int(g.get("번호", 0))))
        f["이름"] = g.get("이름") or f["이름"]  # CSS 글꼴 이름으로 센다(가변 글꼴의 name 표는 「SUIT Variable Thin」처럼 나온다)
        글꼴줄.append(f)
    볼글자 = set(줄.get("볼글자", ""))
    없는, 맡음, 볼결과, 기호 = [], {}, {}, []
    줄폭 = []
    점선 = 빈 = 0
    for 조각글 in 글.split(chr(10)):
        if not 글꼴줄:
            break
        w, d, b = 한줄(조각글, 글꼴줄, 줄.get("언어"), 크기, 볼글자, 없는, 맡음, 볼결과, 기호)
        줄폭.append(round(w, 1))
        점선 += d
        빈 += b
    return {"없는글자": sorted(set(없는)), "점선원": 점선, "빈글리프": 빈, "폭": max(줄폭) if 줄폭 else 0.0,
            "줄폭": 줄폭, "글꼴별": 맡음, "볼글자글꼴": 볼결과, "기호대체": sorted(set(기호))}


def main():
    입력 = json.loads(sys.stdin.buffer.read().decode("utf-8-sig"))
    크기 = float(입력.get("크기", 100))
    결과 = []
    for 줄 in 입력.get("줄들", []):
        try:
            결과.append(재기(줄, 크기))
        except Exception as e:
            결과.append({"오류": str(e)})
    글꼴 = {f"{k[0]}#{k[1]}": {"이름": v["이름"], "글자수": len(v["cmap"])} for k, v in _글꼴들.items()}
    sys.stdout.buffer.write(json.dumps({"줄들": 결과, "글꼴": 글꼴}, ensure_ascii=False).encode("utf-8"))


if __name__ == "__main__":
    main()

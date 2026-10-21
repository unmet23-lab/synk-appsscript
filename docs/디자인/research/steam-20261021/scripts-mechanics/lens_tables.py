# -*- coding: utf-8 -*-
"""렌즈별 지표 표(마크다운)를 만든다. 보고서에 그대로 붙인다.
사용: python -I -X utf8 lens_tables.py <out_dir> > tables.md
"""
import json, sys, pathlib, re

LENS = {1: "주민 자율성·욕구·기분", 2: "일과·관계 이벤트·선물·축제", 3: "기여로 자라는 마을", 4: "손님 응대와 사연",
        5: "읽기·언어를 놀이로", 6: "채팅 없는 비동기 온기", 7: "성격 있는 동물 돌봄", 8: "공부 동반·머무는 모드",
        9: "작은 외출·배달·여행", 10: "이야기 진행 관리자", 11: "기억하고 언급하기·편지"}

def pct(x):
    return "-" if x is None else f"{x*100:.1f}%"

def recent(tip):
    if not tip: return "표시 없음"
    m = re.match(r"(\d+)% of the ([\d,]+) user reviews in the last 30 days", tip)
    return f"{m.group(1)}% / {m.group(2)}건" if m else tip

def main():
    out = pathlib.Path(sys.argv[1])
    S = json.loads((out / "stats.json").read_text(encoding="utf-8"))
    M = json.loads((out / "mech_stats.json").read_text(encoding="utf-8"))
    for ln, title in LENS.items():
        print(f"\n#### 렌즈 {ln} 지표 — {title}\n")
        print("| 게임 | 상태·상점 출시일 | 누적 리뷰(전 언어) · 긍정률 | 상점 최근 30일 | 최근순 영어 표본(기간 · 추천률) | 기능 낱말 언급(영어) | 한국어 표본 · 추천률 |")
        print("|---|---|---:|---|---|---|---|")
        for s in S:
            if ln not in s["lens"]: continue
            a = s["appid"]; nm = s.get("store_name") or s["name"]
            st = []
            if s.get("coming_soon"): st.append("출시 전")
            if s.get("early_access"): st.append("앞서 해보기")
            rel = s.get("release") or "-"
            sa = s.get("sum_all", {})
            tot = sa.get("total") or 0
            se = s.get("sample_english", {}); sk = s.get("sample_koreana", {})
            m = M.get(str(a), {}).get("recent_en", {})
            mech = f"{m.get('hits',0)}건({pct(m.get('hit_share'))}) · 추천 {pct(m.get('pos_hit'))}" if m.get("n") else "-"
            en = f"{se.get('n',0)}건({se.get('from','-')}~{se.get('to','-')}) · {pct(se.get('pos_rate'))}" if se.get("n") else "0건"
            ko = f"{sk.get('n',0)}건 · {pct(sk.get('pos_rate'))}" if sk.get("n") else "0건"
            print(f"| [{nm}](https://store.steampowered.com/app/{a}/) | {' · '.join(st + [rel])} | {tot:,} · {pct(sa.get('pos_rate'))} | {recent(s['store_rows'].get('recent'))} | {en} | {mech} | {ko} |")

if __name__ == "__main__":
    main()

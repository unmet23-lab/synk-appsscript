# 지시문 검수 판 — 굽기 전에 영상 지시문을 판마다 다른 눈(.claude/agents/video-prompt-review.md)이 보게 판을 짓고, 그 판정을 결과로 적는다(2026-11-25).
# 왜: 유호님 11-25 「지시문도 자체 검수자가 있어야할것같아 … 지시문 검수자의 역할이 정말 클거라고 생각해. 그래야 영상만들때 토큰을 낭비하지않을테니까」.
#   받은 뒤 · 마감에서 다시 구운 까닭의 절반은 굽기 전에 지시문 글에서 이미 보였다. 뜻을 읽어야 보이는 자리라 기계 검사는 못 잡았다.
#   잣대는 docs/마케팅/제작양식/영상양식/지시문_흠표.md(지1~ — 컨셉과 상관없이 모든 편). 설계: docs/마케팅/제작양식/영상양식/지시문검수_설계_20261125.md
#
#   python -I -X utf8 tools/지시문검수판.py 판 <편 폴더> [--판 C3,C5] [--꾸러미 <폴더>] [--출력 <폴더>]
#       → <편>/검수/지시문검수_<YYYYMMDD-HHmm>/판.json — 판마다 지시문 · 지문 · 컷표 줄 · 앞뒤 컷 · 그림 · 기계 검사 줄
#   python -I -X utf8 tools/지시문검수판.py 적기 <출력 폴더>
#       → 검수자가 쓴 <출력>/판정.json을 판.json과 대 보고 <출력>/결과.json을 쓴다. 끝 코드 0 모두 그대로 · 2 고칠 판 있음 · 1 판정.json을 고친다
#
# 내기 도구(크레딧내기 · 드리미나내기)와 컷연속성검사.py --지시문검수가 결과.json을 읽는다(컷연속성검사.지시문검수결과검사).
# 판정.json 꼴: {"검수자": {"모델": "claude-fable-5-2"}, "판": {"C3": {"판정": "고침", "흠": ["지7"],
#                "고칠것": [{"흠": "지7", "무엇": "…", "고칠문장": "…"}]}, "C4": {"판정": "그대로", "흠": [], "고칠것": []}}}
import datetime
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import 컷연속성검사 as 검사  # noqa: E402

뿌리 = Path(__file__).resolve().parent.parent
틀 = 뿌리 / "docs" / "마케팅" / "제작양식" / "영상양식" / "지시문_흠표.md"
판정들 = ("그대로", "고침", "나눔", "시험 먼저")
컷칸 = ("cut", "in", "out", "장면", "인물", "실내", "구도", "앵글", "카메라", "연기", "소품", "소품행동", "둘레", "넘어옴", "감정자리", "타당성", "소리", "line")


def 흠표(경로=틀):
    """지시문 흠 표 → {번(지1 …): 다시 낸 까닭}"""
    글 = Path(경로).read_text(encoding="utf-8")
    return {m.group(1): m.group(2).strip() for m in re.finditer(r"^\|\s*(지\d+)\s*\|([^|]*)\|", 글, re.M)}


def 그림(편, v):
    if 검사.빈칸(v): return None
    p = Path(str(v)); p = p if p.is_absolute() else 편 / p
    return {"경로": str(p), "있음": p.is_file()}


def 컷줄(편, d):
    if not d: return None
    out = {k: d[k] for k in 컷칸 if k in d}
    out["시작그림"] = 그림(편, d.get("시작그림")); out["끝그림"] = 그림(편, d.get("끝그림"))
    return out


def 판짓기(편, 고름=None, 꾸러미=None, 출력=None):
    편 = Path(편).resolve()
    표경로 = 편 / "컷표.json"
    if not 표경로.is_file(): raise SystemExit(f"컷표가 없다: {표경로}")
    seq = 검사.장면실내채움(json.loads(표경로.read_text(encoding="utf-8-sig")))
    if not 검사.틀둘(seq): raise SystemExit("틀 2 컷표가 아니다 — 지시문 검수는 틀 2 컷표에 이어진 판만 본다")
    꾸 = Path(꾸러미).resolve() if 꾸러미 else 편 / "꾸러미"
    if not (꾸 / "_순서.json").is_file(): raise SystemExit(f"꾸러미가 없다: {꾸} — tools/꾸러미만들기.py <편> --실행으로 먼저 짓는다")
    흠 = 흠표()
    if not 흠: raise SystemExit(f"지시문 흠 표(| 지1 | …)가 없다: {틀}")
    판들 = 검사.지시문판들([꾸])
    if 고름:
        없는 = set(고름) - {p["id"] for p in 판들}
        if 없는: raise SystemExit(f"꾸러미에 없는 판: {' · '.join(sorted(없는))}")
    r = 검사.결과(); 검사.지시문항목(seq, r, [꾸], 폴더=편)   # 내기 도구의 굽기전과 같은 기계 검사 — 검수자는 이 줄이 짚은 꼴을 다시 적지 않는다
    기계 = {}
    for x in r.항목들:
        if x["등급"] in ("걸림", "확인", "주의"): 기계.setdefault(str(x["컷"]), []).append([x["등급"], x["글"]])
    det = [d for d in seq.get("detail") or [] if isinstance(d, dict)]
    차례 = [d.get("cut") for d in det]
    인물표, 장면표, 소품표 = (seq.get(k) if isinstance(seq.get(k), dict) else {} for k in ("인물", "장면", "소품"))
    판목록, 건너뜀 = [], []
    for p in 판들:
        if 고름 and p["id"] not in 고름: continue
        정보 = 검사.판정보(p["판"], seq)
        if 정보["소리만"] or 정보["프리비즈"]:
            건너뜀.append({"id": p["id"], "까닭": "소리만 쓰는 판" if 정보["소리만"] else "프리비즈 판"}); continue
        컷들 = [c for c in 정보["컷들"] if c in 차례]
        if not 컷들:
            건너뜀.append({"id": p["id"], "까닭": "컷표에 없는 판 — 기계 검사가 걸림으로 막는다"}); continue
        행 = [d for d in det if d.get("cut") in 컷들]
        처음, 끝 = 차례.index(컷들[0]), 차례.index(컷들[-1])
        사람 = [n for n in (정보["인물"] or []) if isinstance(n, str)]
        소품이름 = list(dict.fromkeys(k for d in 행 if isinstance(d.get("소품"), dict) for k in d["소품"]))
        판목록.append({
            "id": p["id"], "컷들": 컷들, "지시문파일": str(p["파일"]), "지문": 검사.지시문지문(p["글"]), "지시문": p["글"],
            "길이": p["판"].get("길이"), "소리": p["판"].get("소리"), "인물": 사람,
            "인물표": {n: 인물표[n] for n in 사람 if n in 인물표},
            "장면표": {k: 장면표[k] for k in dict.fromkeys(d.get("장면") for d in 행) if isinstance(k, str) and k in 장면표},
            "소품표": {k: 소품표[k] for k in 소품이름 if k in 소품표},
            "컷표": [컷줄(편, d) for d in 행],
            "앞컷": 컷줄(편, det[처음 - 1]) if 처음 > 0 else None,
            "뒤컷": 컷줄(편, det[끝 + 1]) if 끝 + 1 < len(det) else None,
            "기계": 기계.get(p["id"], []),
        })
    if not 판목록: raise SystemExit("검수할 판이 없다 — " + (" · ".join(f"{x['id']}({x['까닭']})" for x in 건너뜀) or "꾸러미가 비었다"))
    if 출력: 출력 = Path(출력).resolve()
    else:
        이름 = "지시문검수_" + datetime.datetime.now().strftime("%Y%m%d-%H%M"); 출력 = 편 / "검수" / 이름; n = 2
        while 출력.exists(): 출력 = 편 / "검수" / f"{이름}-{n}"; n += 1
    출력.mkdir(parents=True, exist_ok=True)
    판 = {"편": str(편), "컷표": str(표경로), "꾸러미": str(꾸), "컨셉": seq.get("컨셉"), "때": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
         "흠표": str(틀), "흠": 흠, "판": 판목록, "건너뜀": 건너뜀}
    (출력 / "판.json").write_text(json.dumps(판, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"지시문 검수 판: 판 {len(판목록)}개" + (f" · 건너뜀 {len(건너뜀)}({' · '.join(x['id'] for x in 건너뜀)})" if 건너뜀 else "") + f" → {출력 / '판.json'}")
    print(f"다음: 검수자가 {출력 / '판정.json'}을 쓰고 python -I -X utf8 tools/지시문검수판.py 적기 \"{출력}\"")
    return 출력


def 적기(출력):
    출력 = Path(출력).resolve()
    판 = json.loads((출력 / "판.json").read_text(encoding="utf-8"))
    try: 받음 = json.loads((출력 / "판정.json").read_text(encoding="utf-8-sig"))
    except FileNotFoundError: print(f"판정.json이 없다: {출력 / '판정.json'}"); return 1
    except ValueError as e: print(f"판정.json을 JSON으로 읽지 못했다: {e}"); return 1
    흠 = set(판.get("흠") or {})
    틀림 = []
    받은판 = 받음.get("판") if isinstance(받음, dict) else None
    검수자 = 받음.get("검수자") if isinstance(받음, dict) else None
    if not (isinstance(검수자, dict) and str(검수자.get("모델") or "").strip()): 틀림.append("「검수자」.「모델」에 판정한 모델 id를 적는다")
    if not isinstance(받은판, dict): 틀림.append("판정.json에 「판」 표가 없다"); 받은판 = {}
    결과판 = {}
    for p in 판["판"]:
        이름 = p["id"]; x = 받은판.get(이름)
        if not isinstance(x, dict): 틀림.append(f"{이름}: 판정이 없다"); continue
        g = x.get("판정"); hs = x.get("흠") if isinstance(x.get("흠"), list) else None; 고칠 = x.get("고칠것") if isinstance(x.get("고칠것"), list) else None
        if g not in 판정들: 틀림.append(f"{이름}: 판정은 {' · '.join(판정들)} 가운데 하나다 — 「{g}」"); continue
        if hs is None or 고칠 is None: 틀림.append(f"{이름}: 「흠」과 「고칠것」은 목록이다(없으면 [])"); continue
        모름 = [h for h in hs if h not in 흠]
        if 모름: 틀림.append(f"{이름}: 흠은 지시문 흠 표의 번({' · '.join(sorted(흠, key=lambda s: int(s[1:])))})으로 적는다 — 모르는 번 {모름}")
        if g == "그대로":
            if hs or 고칠: 틀림.append(f"{이름}: 「그대로」인데 흠이나 고칠 것이 있다 — 고칠 것이 있으면 「고침」이다")
        else:
            if not hs: 틀림.append(f"{이름}: 「{g}」는 걸린 흠의 번을 적는다")
            나쁜 = [c for c in 고칠 if not (isinstance(c, dict) and str(c.get("무엇") or "").strip() and (g != "고침" or str(c.get("고칠문장") or "").strip()))]
            if not 고칠 or 나쁜: 틀림.append(f"{이름}: 「{g}」는 고칠것마다 「무엇」을 적고, 「고침」은 「고칠문장」(넣거나 바꿀 문장 그대로)까지 적는다")
        f = Path(p["지시문파일"])
        if 검사.지시문지문(f.read_text(encoding="utf-8") if f.is_file() else "") != p["지문"]:
            틀림.append(f"{이름}: 판을 만든 뒤 지시문이 바뀌었다 — 판을 다시 만든다(tools/지시문검수판.py 판 <편> --판 {이름})")
        결과판[이름] = {"컷들": p["컷들"], "지문": p["지문"], "판정": g, "흠": hs, "고칠것": 고칠, **({"메모": x["메모"]} if x.get("메모") else {})}
    남은 = sorted(set(받은판) - {p["id"] for p in 판["판"]})
    if 남은: 틀림.append(f"판.json에 없는 판의 판정: {' · '.join(남은)}")
    if 틀림:
        print("판정.json을 고친다:")
        for t in 틀림: print(f"  ✗ {t}")
        return 1
    셈 = Counter(x["판정"] for x in 결과판.values())
    결과 = {"때": datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "편": 판["편"], "컷표": 판["컷표"], "꾸러미": 판["꾸러미"],
          "검수자": 검수자, "판": 결과판, "건너뜀": 판.get("건너뜀") or [], "요약": dict(셈)}
    (출력 / "결과.json").write_text(json.dumps(결과, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"지시문 검수 결과 — {' · '.join(f'{k} {셈[k]}' for k in 판정들 if 셈[k])} → {출력 / '결과.json'}")
    for 이름, x in 결과판.items():
        if x["판정"] == "그대로": continue
        for c in x["고칠것"]:
            print(f"  {이름} {x['판정']} [{c.get('흠') or ' · '.join(x['흠'])}] {str(c.get('무엇'))[:90]}" + (f" → {str(c.get('고칠문장'))[:120]}" if c.get("고칠문장") else ""))
    return 0 if set(셈) == {"그대로"} else 2


def main(argv):
    if not argv or argv[0] not in ("판", "적기"):
        print(Path(__file__).read_text(encoding="utf-8").split("import datetime")[0]); return 1
    if argv[0] == "적기":
        if len(argv) != 2: raise SystemExit("쓰는 법: tools/지시문검수판.py 적기 <출력 폴더>")
        return 적기(argv[1])
    편, 고름, 꾸러미, 출력 = None, None, None, None
    i = 1
    while i < len(argv):
        a = argv[i]
        if a in ("--판", "--꾸러미", "--출력"):
            if i + 1 >= len(argv): raise SystemExit(f"{a} 뒤에 값이 없다")
            v = argv[i + 1]
            if a == "--판": 고름 = [s.strip() for s in v.split(",") if s.strip()]
            elif a == "--꾸러미": 꾸러미 = v
            else: 출력 = v
            i += 2
        elif a.startswith("--"): raise SystemExit(f"모르는 선택: {a}")
        elif 편 is None: 편 = a; i += 1
        else: raise SystemExit(f"편 폴더는 하나다: {a}")
    if not 편: raise SystemExit("쓰는 법: tools/지시문검수판.py 판 <편 폴더> [--판 C3,C5] [--꾸러미 <폴더>] [--출력 <폴더>]")
    판짓기(편, 고름, 꾸러미, 출력)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

# 받은 뒤 검사 — 받은 판(<편>/받음/<판>.mp4)을 컷표의 쓰는 구간으로 바로 잰다(2026-11-14, Claude · 유호님 「응, 시작해」).
#
# 왜 있나: 받은 뒤 검사는 사람이 기억해서 불렀다(11-10 진단 「아직 안 된 것」 첫 줄). 사람 굳음(점검표 26)은 편마다 마지막 컷 전수 검수에서야 잡혔고,
#   그때는 이미 편집 · 소리까지 얹은 뒤였다. 이 도구는 받자마자 판마다 ① 길이가 쓰는 구간을 덮는가 ② 화면 비율 ③ 대사 판의 소리 줄기 ④ 사람 굳음을 재고
#   컷표의 받음 검사(tools/컷연속성검사.py --받음 — 소품 자리 · 고요 · 소리 사건 · 점 · 얼굴 빛)를 이어 돌린다. 내기 도구(크레딧내기.py · 드리미나내기.py)가
#   받은 직후 스스로 부른다 — 손으로는 아래처럼.
#
#   python -X utf8 tools/받은뒤검사.py <편 폴더> [--받음 <폴더>] [--꾸러미 <폴더>] [--컷표 <파일>] [--판 C1,C2b] [--연속성안함] [--json]
#     끝 코드: 0 통과 · 1 걸림(다시 낼 판이 있다) · 2 확인(눈으로 볼 것 — 얼굴 극접사 · 못 잰 판 · 어느 컷인지 모르는 판 · 아직 안 받은 판).
#     통과(0)는 「받음 폴더의 영상을 모두 쟀고 걸린 것이 없다」는 뜻이다 — 하나라도 재지 않았으면(어느 판에도 안 맞는 영상 · 꾸러미의 깨진 줄) 확인이다.
#     끝 코드 · 다시 낼 판 · 쓸 판 · 걸림 수 · 확인 수는 늘 **받은 판 전체**에서 셈한다 — --판으로 일부만 잰 회차도 앞 회차에 남은 다시 낼 판이 있으면 1이다.
#     (아직 안 받은 판만은 물어본 판일 때 끝 코드에 든다 — 시험 묶음만 낸 회차에서 아직 안 낸 판은 볼 것이 아니다.)
#
# 읽는 것
#   <편>/컷표.json            틀 2 — 컷의 in · out(쓰는 구간) · 「인물」 · 「편.비율」 · 컷의 「판」(그 컷이 다른 이름의 판을 쓸 때)
#   <편>/꾸러미/_순서.json     (있으면) 판 → 컷("컷": ["C2"]) · 소리 · 소리만. 없으면 컷 이름이 곧 판 이름이다.
#   <편>/받음/<판>.mp4         같은 판을 다시 낸 것은 <판>__2.mp4 …(내기 도구가 붙이는 이름)
#
# 재는 것(판 파일마다) — 그 판을 쓰는 **모든 구간**으로 잰다(같은 컷이 둘째 토막으로 또 나오는 줄 · "컷"으로 이은 컷들 · 컷표에서 「판」으로 이 판을 가리킨 컷)
#   길이   영상 줄기가 끝나는 때가 쓰는 구간의 가장 늦은 끝(out)보다 이르면 걸림 — 편집에서 그 컷이 모자란다.
#          (파일 길이가 아니라 영상 줄기로 잰다 — 소리 줄기만 긴 파일이 지나가지 않게. 줄기 길이를 못 읽으면 파일 길이로 보고 확인.)
#   비율   화면 가로:세로가 「편.비율」과 3% 넘게 다르면 걸림.
#   소리   꾸러미에서 소리 켬 판인데 소리 줄기가 없으면 걸림(대사 판은 그 판에서 나온 목소리가 첫 시도 — 지시문 틀 8).
#   사람   「인물」에 이름이 있는 구간마다 사람 움직임(사람움직임.py — 카메라를 걷어 낸 사람 자리, 480폭 장당 px, 24fps 기준).
#          어느 구간이든 0.12 아래(「카메라만 · 사람 굳음」 · 「멈춘 화면」)면 걸림 — 숨기지 말고 연기 박자를 고친 지시문으로 다시 낸다(원칙 2).
#          얼굴 극접사(「가까움」)는 값이 부풀어 확인 — 1/8초 띠를 눈으로 본다. 구간 안에 1초 넘게 굳은 창이 있으면 주의로 그 초를 적는다.
#          사람 움직임 도구를 못 부르면(모델 · 라이브러리 없음) 그 항목만 「못 잼」 확인으로 남기고 나머지는 낸다.
#   꾸러미 _순서.json의 잘못된 줄(id 없음) · 겹친 id · 어느 판에도 안 맞는 받은 영상도 확인이다 — 조용히 버리면 아무것도 재지 않고 통과로 끝난다.
#   컷표 「인물」 칸이 목록이 아닌 줄(깨진 칸)은 사람이 있는 것으로 보고 잰다.
#   못 재는 판은 통과로 두지 않는다 — 어느 컷의 판인지 모르는 판(꾸러미의 판 이름 · "컷"이 컷표와 안 맞음) · in · out이 없는 컷의 판은 확인이고 「쓸판」에 넣지 않는다.
# 쓰는 것
#   <받음>/_받은뒤검사.json   판 파일마다 잰 값과 판정, 「다시낼판」(쓸 수 있는 파일이 하나도 없는 판), 「쓸판」(판마다 걸림 없는 파일 가운데 사람 값이 가장 큰 것),
#                            「아직없는판」 · 「안잰판」(받은 파일은 있는데 이번에 재지 않았고 앞 기록도 못 쓰는 판) · 「이번에잰판」
#     --판으로 일부만 잰 회차: 고르지 않은 판은 앞 기록을 그대로 쓴다 — 그 판의 파일(이름 · 크기)과 재는 조건(쓰는 구간 · 비율 · 소리)이 그때와 같을 때만.
#     달라졌으면 「안잰판」(확인)으로 낸다.
#   연속성 검사의 시트는 그 도구가 늘 두는 자리(<편>/검사_연속성/)에 남는다.
import importlib.util
import json
import math
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
MOTION_PY = os.environ.get("SYNK_MOTION_PY") or str(HERE.parent / "docs" / "마케팅" / "PULSE_포트폴리오_제작준비_20261012" / "시댄스무제한" / "사람움직임.py")
기준FPS = 24.0     # 사람움직임 0.12 문턱을 맞춘 판이 24fps다 — 다른 fps는 장당 값을 fps/24로 고쳐 견준다(최종본검사.py와 같은 까닭)
굳음 = 0.12
비율허용 = 0.03
기록이름 = "_받은뒤검사.json"


def 인자풀기(argv):
    o = {"편": None, "받음": None, "꾸러미": None, "컷표": None, "판": None, "연속성안함": False, "json": False}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ("--받음", "--꾸러미", "--컷표", "--판"):
            if i + 1 >= len(argv) or argv[i + 1].startswith("--"):
                raise SystemExit(f"{a} 뒤에 값이 없다")
            o[a[2:]] = argv[i + 1]; i += 2
        elif a in ("--연속성안함", "--json"):
            o[a[2:]] = True; i += 1
        elif a.startswith("--"):
            raise SystemExit(f"모르는 선택: {a}")
        elif o["편"] is None:
            o["편"] = a; i += 1
        else:
            raise SystemExit(f"편 폴더는 하나만 준다(남는 인자: {a})")
    if not o["편"]:
        raise SystemExit("쓰는 법: python -X utf8 tools/받은뒤검사.py <편 폴더> [--받음 <폴더>] [--꾸러미 <폴더>] [--컷표 <파일>] [--판 C1,C2b] [--연속성안함] [--json]")
    if o["판"] is not None:
        o["판"] = [s.strip() for s in o["판"].split(",") if s.strip()]
        if not o["판"]:
            raise SystemExit("--판 뒤에 판 이름이 없다")
    return o


def 글목록(v):
    return [x.strip() for x in v if isinstance(x, str) and x.strip()] if isinstance(v, list) else []


def 살피기(mp4):
    """ffprobe → {초(영상 줄기가 끝나는 때), 파일초, 길이출처, 가로, 세로, fps, 소리} | 오류 글"""
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(mp4)],
                           capture_output=True, text=True, encoding="utf-8")
        j = json.loads(r.stdout or "{}")
    except Exception as e:   # noqa: BLE001
        return f"ffprobe를 못 돌렸다: {e}"
    v = next((s for s in j.get("streams") or [] if s.get("codec_type") == "video"), None)
    if not v:
        return "영상 줄기가 없다(깨진 파일)"

    def 몫(글):
        m = re.fullmatch(r"(\d+)/(\d+)", str(글 or ""))
        return int(m.group(1)) / int(m.group(2)) if m and int(m.group(2)) else None

    def 수(x):
        try:
            f = float(x)
        except (TypeError, ValueError):
            return None
        return f if math.isfinite(f) else None
    fps = 몫(v.get("avg_frame_rate")) or 몫(v.get("r_frame_rate")) or 기준FPS
    파일초 = 수((j.get("format") or {}).get("duration"))
    # 길이는 영상 줄기로 — 파일(컨테이너) 길이는 소리 줄기가 더 길면 영상보다 길다(11-14 검수: 파일 5초 · 영상 2초가 지나갔다)
    줄기, 출처 = 수(v.get("duration")), "영상 줄기"
    if not 줄기 or 줄기 <= 0:
        장 = 수(v.get("nb_frames"))
        줄기, 출처 = (장 / fps, "장 수") if 장 and 장 > 0 and fps else (None, None)
    if 줄기:
        초 = max(0.0, 수(v.get("start_time")) or 0.0) + 줄기
    elif 파일초 and 파일초 > 0:
        초, 출처 = 파일초, "파일"
    else:
        return "길이를 읽지 못했다"
    return {"초": round(초, 3), "파일초": round(파일초, 3) if 파일초 else None, "길이출처": 출처, "가로": int(v.get("width") or 0), "세로": int(v.get("height") or 0),
            "fps": round(fps, 3), "소리": any(s.get("codec_type") == "audio" for s in j.get("streams") or [])}


_사람모듈 = None


def 사람모듈():
    """사람움직임.py를 한 번만 읽는다 → (모듈, None) | (None, 까닭)"""
    global _사람모듈
    if _사람모듈 is None:
        try:
            if not os.path.isfile(MOTION_PY):
                raise FileNotFoundError(MOTION_PY)
            spec = importlib.util.spec_from_file_location("사람움직임", MOTION_PY)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            _사람모듈 = (mod, None)
        except Exception as e:   # noqa: BLE001 — 모델 · cv2 · rembg가 없으면 그 항목만 못 잰다
            _사람모듈 = (None, f"{type(e).__name__}: {e}")
    return _사람모듈


def 사람재기(mp4, 시작, 끝, fps):
    """쓰는 구간 [시작, 끝]초의 사람 움직임 → {사람, 카메라, 판정, 장, 굳은창} | {"못잼": 까닭}"""
    mod, 탈 = 사람모듈()
    if not mod:
        return {"못잼": f"사람 움직임 도구를 못 불렀다({탈})"}
    a, k = max(0, int(round(시작 * fps))), max(3, int(round((끝 - 시작) * fps)))
    try:
        ps = mod.pairs(str(mp4), a, k)
        s = mod.summary(ps) if len(ps) >= 2 else None
    except Exception as e:   # noqa: BLE001
        return {"못잼": f"{type(e).__name__}: {str(e)[:160]}"}
    if not s:
        return {"못잼": "쓰는 구간에 잴 장이 모자란다"}
    곱 = fps / 기준FPS
    사람, 카메라 = round(s["사람"] * 곱, 3), round(s["카메라"] * 곱, 3)
    판정 = s["판정"] if s["판정"].startswith("가까움") else mod.verdict(카메라, 사람)
    굳은창 = []
    try:
        창 = max(2, int(round(fps)))
        for t, c, p, v in mod.windows(ps, fps=fps, win=창, step=max(1, 창 // 2)):
            if not str(v).startswith("가까움") and p * 곱 < 굳음:
                굳은창.append(round(시작 + t, 2))
    except Exception:   # noqa: BLE001 — 창 셈은 참고다
        굳은창 = []
    return {"사람": 사람, "카메라": 카메라, "판정": 판정, "장": s["장"], "굳은창": 굳은창}


def 컷줄모음(seq):
    return [d for d in seq.get("detail") or [] if isinstance(d, dict) and isinstance(d.get("cut"), str) and d["cut"].strip()]


def 판표(seq, 꾸러미):
    """→ ([{id, 컷(컷표에 있는 것), 모르는컷(꾸러미가 이었는데 컷표에 없는 것), 소리, 소리만}], 탈 [글]) — 꾸러미 _순서.json이 있으면 그 판들, 없으면 컷표의 컷.
    탈 = 버릴 수밖에 없는 줄(id 없음 · 겹친 id) — 조용히 버리지 않고 확인으로 낸다"""
    컷들 = list(dict.fromkeys(d["cut"] for d in 컷줄모음(seq)))
    순서 = Path(꾸러미) / "_순서.json" if 꾸러미 else None
    if not (순서 and 순서.is_file()):
        return [{"id": c, "컷": [c], "모르는컷": [], "소리": None, "소리만": False} for c in 컷들], []
    try:
        줄들 = json.loads(순서.read_text(encoding="utf-8-sig"))
        if not isinstance(줄들, list):
            raise ValueError("판 목록(배열)이 아니다")
    except Exception as e:   # noqa: BLE001
        raise SystemExit(f"꾸러미 _순서.json을 읽지 못했다({순서}): {e}")
    out, 본, 탈 = [], set(), []
    for n, b in enumerate(줄들, 1):
        if not isinstance(b, dict) or not isinstance(b.get("id"), str) or not b["id"].strip():
            탈.append(f"꾸러미 _순서.json {n}번째 줄에 판 id가 없다 — 그 줄의 판은 재지 않았다(꾸러미를 다시 짓는다)")
            continue
        if b["id"] in 본:
            탈.append(f"꾸러미 _순서.json에 판 id 「{b['id']}」가 두 번 나온다({n}번째 줄) — 뒤 줄의 컷 · 소리 조건은 보지 않았다(꾸러미를 다시 짓는다)")
            continue
        판id = b["id"]
        본.add(판id)
        적힌 = list(dict.fromkeys(글목록(b.get("컷"))))
        컷 = [c for c in 적힌 if c in 컷들]
        if not 적힌 and 판id in 컷들:
            컷 = [판id]
        out.append({"id": 판id, "컷": 컷, "모르는컷": [c for c in 적힌 if c not in 컷들], "소리": b.get("소리"),
                    "소리만": b.get("소리만") is True or b.get("방식") == "목소리 판"})
    return out, 탈


def 줄의판(d):
    """컷표 줄이 쓰는 받은 파일 이름(확장자 없이) — 「판」 칸이 있으면 그 값(대안 판 C2b · 다시 낸 파일 C1__2), 없으면 컷 이름"""
    return d["판"].strip() if isinstance(d.get("판"), str) and d["판"].strip() else d["cut"]


def 판기준이름(이름):
    """받은 파일 이름 → 판 id — 다시 낸 파일의 꼬리(__2)를 뗀다"""
    return re.sub(r"__\d+$", "", 이름)


def 판의줄(seq, 판):
    """이 판을 쓰는 컷표 줄 모두 — 이어진 컷의 모든 줄(둘째 토막까지) + 컷표에서 「판」으로 이 판(또는 이 판을 다시 낸 파일 C1__2)을 가리킨 줄"""
    return [d for d in 컷줄모음(seq) if d["cut"] in 판["컷"] or (isinstance(d.get("판"), str) and 판["id"] in (d["판"].strip(), 판기준이름(d["판"].strip())))]


def 구간모으기(rows):
    """→ (구간 [[in, out, 사람?]] — 같은 구간은 하나로, 차례대로 · in · out을 못 읽은 컷 [이름])"""
    구간, 못읽은 = {}, []
    for d in rows:
        a, b = d.get("in"), d.get("out")
        if all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in (a, b)) and b > a >= 0:
            k = (float(a), float(b))
            인물 = d.get("인물")   # 목록이 아니게 깨진 칸("수아" · {"수아": 1})은 사람이 있는 것으로 본다 — 사람 검사를 건너뛰는 쪽으로 읽지 않는다
            구간[k] = 구간.get(k, False) or (bool(글목록(인물)) if isinstance(인물, list) or 인물 is None else True)
        elif d["cut"] not in 못읽은:
            못읽은.append(d["cut"])
    return [[a, b, 사람] for (a, b), 사람 in sorted(구간.items())], 못읽은


def 재는조건(판, rows, 편비율):
    """판을 무엇으로 쟀는가 — 일부 회차에서 앞 기록을 그대로 써도 되는지 견줄 때 쓴다"""
    구간, 못읽은 = 구간모으기(rows)
    return json.loads(json.dumps({"컷": 판["컷"], "모르는컷": 판["모르는컷"], "구간": 구간, "못읽은컷": 못읽은, "비율": 편비율, "소리": 판["소리"]}, ensure_ascii=False))


def 한파일(mp4, 판, rows, 편비율):
    """판 파일 하나 → {파일, 크기, 값…, 걸림 [글], 확인 [글], 주의 [글]}"""
    r = {"파일": mp4.name, "크기": mp4.stat().st_size, "걸림": [], "확인": [], "주의": []}
    본 = 살피기(mp4)
    if isinstance(본, str):
        r["걸림"].append(본)
        return r
    r.update(본)
    if 본["길이출처"] == "파일":
        r["확인"].append(f"영상 줄기 길이를 읽지 못해 파일 길이({본['초']}초)로 봤다 — 소리만 긴 파일일 수 있으니 끝까지 재생해 본다")
    구간, 못읽은 = 구간모으기(rows)
    if not rows:
        r["못잰판"] = True
        r["확인"].append(f"어느 컷의 판인지 모른다 — 꾸러미 _순서.json의 판 이름 「{판['id']}」 · \"컷\"이 컷표와 안 맞아 쓰는 구간 · 사람을 재지 않았다(쓸 판으로 뽑지 않는다)")
    if 판["모르는컷"]:
        r["못잰판"] = True
        r["확인"].append(f"꾸러미가 이 판을 {' · '.join(판['모르는컷'])}에 이었는데 컷표에 그 컷이 없다 — 그 컷의 구간은 재지 않았다(쓸 판으로 뽑지 않는다)")
    if 못읽은:
        r["못잰판"] = True
        r["확인"].append(f"컷표 {' · '.join(못읽은)}의 in · out을 읽지 못해 그 구간의 길이 · 사람을 재지 않았다(쓸 판으로 뽑지 않는다)")
    if 구간:
        r["쓰는구간"] = [[a, b] for a, b, _ in 구간]
        끝 = max(b for _, b, _ in 구간)
        if 본["초"] + 0.05 < 끝:
            r["걸림"].append(f"받은 판의 영상이 {본['초']}초인데 쓰는 구간이 {끝:g}초까지다 — 편집에서 이 컷이 {round(끝 - 본['초'], 2)}초 모자란다(판 길이를 늘려 다시 내거나 쓰는 구간을 고친다)")
    m = re.fullmatch(r"\s*(\d+)\s*:\s*(\d+)\s*", str(편비율 or ""))
    if m and 본["가로"] and 본["세로"]:
        바람, 실제 = int(m.group(1)) / int(m.group(2)), 본["가로"] / 본["세로"]
        if abs(실제 / 바람 - 1) > 비율허용:
            r["걸림"].append(f"화면이 {본['가로']}×{본['세로']}로 「편.비율」 {편비율.strip()}과 다르다 — 잘라 키우지 말고 그 비율로 다시 낸다")
    if 판["소리"] == "켬" and not 본["소리"]:
        r["걸림"].append("소리 켬 판인데 받은 판에 소리 줄기가 없다 — 대사 판은 그 판에서 나온 목소리가 첫 시도다(다시 낸다)")
    사람구간 = [(a, b) for a, b, 사람 in 구간 if 사람]
    if 사람구간 and not r["걸림"]:
        잰 = []
        for a, b in 사람구간:   # 구간마다 따로 — 한 구간이 살아 있어도 다른 구간이 굳었으면 걸린다
            s = 사람재기(mp4, a, min(b, 본["초"]), 본["fps"])
            s["구간"] = [a, b]
            잰.append(s)
            어디 = f"{a:g}~{b:g}초 구간 — " if len(사람구간) > 1 else ""
            if "못잼" in s:
                r["확인"].append(f"{어디}사람 움직임을 못 쟀다 — {s['못잼']}. 1/8초 띠를 눈으로 본다")
            elif str(s["판정"]).startswith("가까움"):
                r["확인"].append(f"{어디}얼굴 극접사라 사람 값({s['사람']})이 부풀 수 있다 — 1/8초 띠를 눈으로 본다")
            elif s["판정"] != "-":
                r["걸림"].append(f"{어디}{s['판정']}(사람 {s['사람']} · 카메라 {s['카메라']} — 문턱 {굳음}) — 숨기지 말고 연기 박자를 고친 지시문으로 다시 낸다(26)")
            elif s["굳은창"]:
                r["주의"].append(f"쓰는 구간 안에 사람이 굳은 1초 창이 있다({' · '.join(str(t) + '초' for t in s['굳은창'][:5])}{' …' if len(s['굳은창']) > 5 else ''}) — 편집에서 그 구간을 피하거나 다시 낸다")
        쟀다 = [s for s in 잰 if "못잼" not in s]
        if 쟀다:
            r["사람"] = min(쟀다, key=lambda s: s["사람"])   # 판의 값은 가장 굳은 구간의 값이다
        if len(잰) > 1:
            r["사람구간"] = 잰
    return r


def 앞기록(자리):
    """<받음>/_받은뒤검사.json → {판 id: 그 판의 기록} — 꼴이 맞는 판만(깨진 기록 · 다른 꼴은 버린다)"""
    try:
        j = json.loads(자리.read_text(encoding="utf-8"))
    except Exception:   # noqa: BLE001
        return {}
    판 = j.get("판") if isinstance(j, dict) else None
    out = {}
    for k, v in (판.items() if isinstance(판, dict) else []):
        파일 = v.get("파일") if isinstance(v, dict) else None
        if (isinstance(파일, list) and 파일 and isinstance(v.get("컷"), list) and isinstance(v.get("조건"), dict)
                and all(isinstance(f, dict) and isinstance(f.get("파일"), str) and isinstance(f.get("크기"), int)
                        and all(isinstance(f.get(x), list) for x in ("걸림", "확인", "주의")) for f in 파일)):
            out[k] = v
    return out


def 연속성(컷표, 받음):
    """tools/컷연속성검사.py <컷표> --받음 <받음> → (끝 코드, [걸림 · 확인 줄]) — 못 돌리면 (None, [확인 한 줄])"""
    검사 = HERE / "컷연속성검사.py"
    try:
        r = subprocess.run([sys.executable, "-I", "-X", "utf8", str(검사), str(컷표), "--받음", str(받음), "--항목", "고요,소리,점,지도,빛", "--json"],
                           capture_output=True, text=True, encoding="utf-8")
        항목들 = json.loads(r.stdout)
    except Exception as e:   # noqa: BLE001
        return None, [{"항목": "연속성", "컷": "표", "등급": "확인", "글": f"컷표의 받음 검사를 못 돌렸다({type(e).__name__}) — python -I -X utf8 tools/컷연속성검사.py <컷표> --받음 <받음>을 따로 돌린다"}]
    # 받은 판에서 잰 줄만 남긴다 — 「표」 줄(소품 지도 · 고요 칸이 없다)은 콘티 단계의 일이고, 「받은 판 없음」은 이 도구가 「아직없는판」으로 이미 말한다
    return r.returncode, [x for x in 항목들 if x.get("등급") in ("걸림", "확인") and x.get("컷") != "표" and not str(x.get("글") or "").startswith("받은 판 없음")]


def main(argv=None):
    o = 인자풀기(list(sys.argv[1:] if argv is None else argv))
    편 = Path(o["편"]).resolve()
    컷표 = Path(o["컷표"]).resolve() if o["컷표"] else 편 / "컷표.json"
    if not 컷표.is_file():
        raise SystemExit(f"컷표가 없다: {컷표}")
    try:
        seq = json.loads(컷표.read_text(encoding="utf-8-sig"))
    except Exception as e:   # noqa: BLE001
        raise SystemExit(f"컷표를 읽지 못했다: {e}")
    if not isinstance(seq, dict) or seq.get("틀") != 2:
        raise SystemExit("이 도구는 컷표 틀 2에서만 돈다(맨 위 \"틀\": 2) — 옛 틀 편은 사람움직임.py · 편집전점검.py를 판 이름으로 부른다")
    받음 = Path(o["받음"]).resolve() if o["받음"] else 편 / "받음"
    꾸러미 = Path(o["꾸러미"]).resolve() if o["꾸러미"] else 편 / "꾸러미"
    첫줄 = {}
    for d in 컷줄모음(seq):
        첫줄.setdefault(d["cut"], d)
    편비율 = (seq.get("편") or {}).get("비율") if isinstance(seq.get("편"), dict) else None
    모든판, 꾸러미탈 = 판표(seq, 꾸러미)
    전체판 = [p for p in 모든판 if not p["소리만"]]
    if o["판"] is not None:
        모르는 = [x for x in o["판"] if x not in {p["id"] for p in 전체판}]
        if 모르는:
            raise SystemExit(f"--판의 {' · '.join(모르는)}은 꾸러미 · 컷표에 없다(소리만 쓰는 판은 재지 않는다)")
    파일들 = sorted(받음.glob("*.mp4")) if 받음.is_dir() else []
    자리 = 받음 / 기록이름
    옛판 = 앞기록(자리) if o["판"] is not None and 자리.is_file() else {}
    # 편 전체를 한 표로 모은다 — 이번에 잰 판, 앞 기록을 그대로 쓰는 판, 받은 파일은 있는데 잰 값이 없는 판(안잰판), 아직 없는 판
    결과판, 없는판, 안잰판, 잰판, 그대로 = {}, [], [], [], []
    맞은파일 = set()
    for p in 전체판:
        내것 = sorted((f for f in 파일들 if re.fullmatch(re.escape(p["id"]) + r"(?:__\d+)?\.mp4", f.name)),
                    key=lambda f: int((re.search(r"__(\d+)\.mp4$", f.name) or [0, 1])[1]))
        맞은파일.update(f.name for f in 내것)
        if not 내것:
            없는판.append(p["id"])
            continue
        rows = 판의줄(seq, p)
        조건 = 재는조건(p, rows, 편비율)
        if o["판"] is None or p["id"] in o["판"]:
            결과판[p["id"]] = {"컷": p["컷"], "조건": 조건, "파일": [한파일(f, p, rows, 편비율) for f in 내것]}
            잰판.append(p["id"])
            continue
        옛 = 옛판.get(p["id"])
        if 옛 and 옛["조건"] == 조건 and [(f["파일"], f["크기"]) for f in 옛["파일"]] == [(f.name, f.stat().st_size) for f in 내것]:
            결과판[p["id"]] = 옛
            그대로.append(p["id"])
        else:
            안잰판.append(p["id"])
    for p in 모든판:
        if p["소리만"]:
            맞은파일.update(f.name for f in 파일들 if re.fullmatch(re.escape(p["id"]) + r"(?:__\d+)?\.mp4", f.name))
    남는파일 = [f.name for f in 파일들 if f.name not in 맞은파일]
    # 어느 판에도 안 맞는 영상은 재지 않았다 — 꾸러미에서 그 판이 빠졌거나 줄이 깨졌거나 이름이 틀렸다. 재지 않은 것이 있으면 통과로 두지 않는다(확인)
    다시낼판, 쓸판, 못잰판 = [], {}, []
    for 판id, v in 결과판.items():
        좋은 = [f for f in v["파일"] if not f["걸림"]]
        if not 좋은:
            다시낼판.append(판id)
        elif any(f.get("못잰판") for f in 좋은):
            못잰판.append(판id)   # 쓰는 구간을 못 잰 판 — 통과로 두지 않고, 쓸 판으로 뽑지도 않는다
        else:
            쓸판[판id] = max(좋은, key=lambda f: (f.get("사람") or {}).get("사람", 0))["파일"]
    이을것 = []   # 컷 이름과 다른 파일(대안 판 · 다시 낸 __2)을 쓸 컷 — 편집 · 컷표의 받음 검사가 그 파일을 읽게 컷표에 적는다
    판찾기 = {p["id"]: p for p in 전체판}
    for 판id, 파일 in 쓸판.items():
        이름 = 파일[:-4]
        for c in dict.fromkeys(d["cut"] for d in 판의줄(seq, 판찾기[판id])):   # 이 판에 이어진 컷 + 「판」으로 이 판을 가리킨 컷
            지금 = 줄의판(첫줄[c])
            if 지금 == 이름:
                continue
            if 판기준이름(지금) == 판id:
                쓸까 = True    # 그 컷은 이미 이 판을 쓴다(자기 이름의 판 · 「판」으로 가리킨 판 · 다른 회차 파일) — 쓸 파일이 달라졌으니 고쳐 적는다
            else:
                쓸까 = 지금 == c and not (c in 쓸판 and 쓸판[c][:-4] == c)   # 대안 판은 그 컷 자기 판을 못 쓸 때만 권한다(다른 대안을 이미 골라 적은 컷은 그대로 둔다)
            if 쓸까:
                이을것.append(f'{c}: 쓸 판이 {이름}이면 컷표 그 컷에 "판": "{이름}"을 적는다')
    연속코드, 연속줄 = (None, []) if o["연속성안함"] or not 결과판 else 연속성(컷표, 받음)
    걸림수 = sum(len(f["걸림"]) for v in 결과판.values() for f in v["파일"]) + sum(1 for x in 연속줄 if x["등급"] == "걸림")
    확인수 = (sum(len(f["확인"]) for v in 결과판.values() for f in v["파일"]) + sum(1 for x in 연속줄 if x["등급"] == "확인") + len(안잰판)
           + len(꾸러미탈) + len(남는파일))
    # 아직 없는 판은 물어본 판만 끝 코드에 든다 — 시험 묶음 두세 판만 낸 회차(--판)에서 아직 안 낸 나머지 판은 볼 것이 아니다(기록 「아직없는판」에는 모두 적는다)
    물은없는판 = 없는판 if o["판"] is None else [x for x in 없는판 if x in o["판"]]
    끝 = 1 if 다시낼판 or any(x["등급"] == "걸림" for x in 연속줄) else (2 if 확인수 or 물은없는판 or 못잰판 else 0)
    기록 = {"때": datetime.now(timezone.utc).isoformat(timespec="seconds"), "컷표": 컷표.name, "판": 결과판, "다시낼판": 다시낼판, "쓸판": 쓸판,
            "못잰판": 못잰판, "아직없는판": 없는판, "안잰판": 안잰판, "이번에잰판": 잰판, "남는파일": 남는파일,
            "꾸러미탈": 꾸러미탈, "이을것": 이을것,
            "연속성": {"끝코드": 연속코드, "줄": 연속줄}, "걸림수": 걸림수, "확인수": 확인수, "끝코드": 끝}
    if 받음.is_dir() and (결과판 or 자리.is_file()):   # 잰 판이 없어도 앞 기록이 있으면 고쳐 쓴다 — 무효가 된 옛 통과 기록(쓸판 · 끝코드 0)을 남기지 않는다
        자리.write_text(json.dumps(기록, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    if o["json"]:
        print(json.dumps(기록, ensure_ascii=False, indent=1))
        return 끝
    print(f"받은 뒤 검사 — 편 {편.name} · 받음 {받음} · 이번에 잰 판 {len(잰판)}개" + (f" · 앞 회차 기록 그대로 {len(그대로)}개" if 그대로 else "")
          + (f" · 아직 없는 판 {len(없는판)}({' · '.join(없는판[:8])}{' …' if len(없는판) > 8 else ''})" if 없는판 else ""))
    for 판id in 잰판:
        for f in 결과판[판id]["파일"]:
            s = f.get("사람")
            값 = f"사람 {s['사람']:.3f} · 카메라 {s['카메라']:.3f}" if s else "사람 -"
            표 = "✗" if f["걸림"] else "?" if f["확인"] else "✓"
            print(f"  {표} {f['파일']:<22} {f.get('초', '?')}초 · {f.get('가로', '?')}×{f.get('세로', '?')} · 소리 {'있음' if f.get('소리') else '없음'} · {값}")
            for 글 in f["걸림"]:
                print(f"      ✗ {글}")
            for 글 in f["확인"]:
                print(f"      ? {글}")
            for 글 in f["주의"]:
                print(f"      · {글}")
    for x in 연속줄:
        print(f"  {'✗' if x['등급'] == '걸림' else '?'} [{x.get('항목')}] {x.get('컷')}: {x.get('글')}")
    for 글 in 이을것:
        print(f"  · {글}")
    for 글 in 꾸러미탈:
        print(f"  ? {글}")
    if 남는파일:
        print(f"  ? 어느 판에도 안 맞는 영상 {len(남는파일)}개는 재지 않았다: {' · '.join(남는파일[:6])}{' …' if len(남는파일) > 6 else ''} — 꾸러미 _순서.json의 판 이름과 견주고, 이 편의 판이 아니면 받음 폴더 밖으로 옮긴다")
    if 안잰판:
        print(f"  ? 받은 파일은 있는데 잰 값이 없는 판 {len(안잰판)}: {' · '.join(안잰판)} — 이번에 고르지 않았고 앞 기록도 못 쓴다(파일이나 쓰는 구간이 바뀌었다). --판 없이 다시 돌린다")
    if 다시낼판:
        앞것 = [x for x in 다시낼판 if x not in 잰판]
        print(f"다시 낼 판 {len(다시낼판)}: {' · '.join(다시낼판)}" + (f"(앞 회차에서 남은 것: {' · '.join(앞것)})" if 앞것 else "")
              + " — 지시문(영상지시문/<판>.txt)을 고쳐 꾸러미를 다시 지은 뒤 그 판 id로 낸다")
    elif 결과판:
        print("걸림 없음" + (f" · 확인 {확인수}건은 눈으로 본다" if 확인수 else "") + (f" · 못 잰 판 {' · '.join(못잰판)}" if 못잰판 else ""))
    elif 안잰판 or 꾸러미탈 or 남는파일:
        print("이번에 잰 판이 없다 — 위에 적은 것은 잰 값이 없으니 통과가 아니다")
    else:
        print("받은 판이 없다")
    return 끝


if __name__ == "__main__":
    sys.exit(main())

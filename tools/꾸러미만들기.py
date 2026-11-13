# 영상 굽기 꾸러미 만들기 — 컷표(틀 2)와 <편>/영상지시문/<판>.txt에서 <편>/꾸러미를 만든다(2026-11-14, Claude · 유호님 「응, 시작해」).
#
# 왜 있나: 꾸러미(_순서.json + 판 폴더)는 내기 도구(크레딧내기.py · 드리미나내기.py)와 굽기 전 검사가 읽는 꼴인데, 만드는 스크립트는 편마다 새로 짰다
#   (11-14에 세어 보니 `_순서.json`을 쓰는 편별 스크립트가 스무 개를 넘는다 — 「다시_1107_꾸러미.py」 · 「사람판_꾸러미.py」 …). 길이 셈 · 파일 이름 ·
#   실내 칸 · 대안 판 잇기가 스크립트마다 달랐고, 11-10 진단이 「다음 일」로 남겼다(docs/마케팅/제작양식/영상작업_진단_20261110.md 「아직 안 된 것」).
#   이 도구는 모든 편이 같이 쓴다 — 편에는 컷표와 지시문 글만 둔다.
#
#   python -I -X utf8 tools/꾸러미만들기.py <편 폴더> [--컷 C1,C3b] [--지시문 <폴더>] [--꾸러미 <폴더>] [--컷표 <파일>] [--덮어쓰기] [--실행] [--json]
#     기본은 미리 보기 — 임시 폴더에 지어 판 표와 굽기 전 검사 결과만 찍고 편 폴더는 건드리지 않는다. --실행일 때만 <편>/꾸러미에 쓴다.
#     끝 코드: 0 통과 · 1 걸림(이 도구의 걸림이면 쓰지 않는다 — 검사의 걸림은 쓰고 알린다, 내기 도구도 그 걸림으로 멈춘다) · 2 확인(눈으로 볼 것).
#
# 읽는 것
#   <편>/컷표.json                틀 2. 컷마다 「시작그림」(편 폴더 기준 — 목록이면 첫째) · in · out · 「실내」 · 「인물」.
#                                 더 적을 수 있는 칸(모두 선택): "끝그림": "정지/C3_끝.png" · "참고그림": ["ref/소품_빈그릇.jpg"] ·
#                                 "목소리견본": ["음성/수아.mp3"] · "길이": 6(판 길이를 손으로 정할 때 — 초, 4~15)
#   <편>/영상지시문/<판>.txt       지시문 틀(docs/마케팅/제작양식/영상양식/지시문_틀.md)대로 쓴 글. 파일 이름이 판 id다.
#                                 컷 이름이면 그 컷의 판, 컷 이름 + 소문자 · 숫자 꼬리(C2b · C2-2)면 그 컷의 대안 판("컷": ["C2"]로 잇는다).
#   <편>/영상지시문/_판.json       (선택) 판마다 덮어쓸 값: {"C2b": {"시작그림": "정지/C2b.png", "길이": 5, "판 수": 2},
#                                 "V1": {"소리만": true, "목소리견본": ["음성/수아.mp3"], "길이": 5}, "X7": {"컷": ["C3", "C4"]}}
#
# 쓰는 것(지시문 틀 「편 폴더」와 같은 꼴)
#   <편>/꾸러미/_순서.json         [{"순서", "id", "폴더", "길이", "비율", "소리", "파일", "빠진 파일", "실내", "인물", "쓰는초", "판 수"(+ "컷" · "소리만")}]
#   <편>/꾸러미/<NNN>_<판>/        지시문.txt · 1_시작.<ext> · 2_끝.<ext> · 3_참고<n>.<ext> · 4_목소리<n>.<ext>
#                                 (내기 도구는 「1_」로 시작하는 그림을 시작, 이름에 「끝」이 든 그림을 끝, 나머지 그림을 참고, mp3 · wav를 소리로 읽는다 —
#                                  지시문의 @이미지 N은 시작 · 끝 · 참고 차례, @오디오 N은 목소리 차례다)
#   <편>/꾸러미/_만든것.json       이 도구가 만든 폴더 · 파일 목록. 다시 돌리면 이 목록에 있는 것만 고치고 지운다.
#
# 지우기 · 덮어쓰기 — 이 도구가 만든 것만(11-14 GPT 검수 뒤 다시 지음)
#   · 쓰기 전에 충돌을 모두 먼저 본다. 멈출 때는 아무것도 바꾸지 않는다.
#   · _만든것.json이 없거나 이 도구의 표식이 아닌데(도구 이름 · 꼴 · 이름마다 경로 글자 검사) 꾸러미 폴더에 무언가 있으면 손으로 만든 꾸러미다 → 멈춘다.
#   · 판 폴더 · 파일이 「이 도구가 넣지 않은 것」과 이름이 겹쳐도 멈춘다(손으로 넣은 2_끝.png 위에 새 끝 그림을 덮지 않는다).
#   · --덮어쓰기: 겹치는 것과 앞 _순서.json을 지우지 않고 꾸러미 안 _앞<번호>/ 로 옮긴 뒤 짓는다.
#   · 이제 안 쓰는 판 폴더는 적어 둔 파일만 하나씩 지우고 빈 폴더만 걷는다(폴더 통째 지우기는 하지 않는다) — 손으로 넣은 파일 · 하위 폴더가 있으면 남긴다.
#   · 표식의 이름은 꾸러미 폴더 바로 아래 것만 받는다(「..」 · 「C:..」 · 경로 구분 글자는 표식 전체를 믿지 않는다).
#
# 정하는 법
#   길이   컷표 「길이」나 _판.json 「길이」가 있으면 그 값, 없으면 이 판을 쓰는 모든 구간(같은 컷의 둘째 토막 · "컷"으로 이은 컷들)에서
#          max(out, (out − in) + 0.8)의 가장 큰 값을 올림한 초 — 최소 4, 15를 넘으면 걸림(지시문 틀 「길이는 쓰는 초 + 0.8초, 최소 4초」). 손으로 준 길이가 out보다 짧아도 걸림.
#   소리   지시문 글에서 읽는다 — 「No sound.」가 한 문장으로 있으면 끔, 그 밖의 SOUND: 줄이 있으면 켬, 둘 다 없으면 끔 + 주의.
#   실내   컷의 「실내」, 없으면 그 장면의 「실내」.  비율은 「편.비율」.
#   폴더   <컷표에서 그 컷의 차례 3자리>_<판 id> — 대안 판은 그 컷과 같은 번호, 소리만 쓰는 판은 9로 시작.
#   순서   컷표 차례 → 같은 컷의 대안 판은 이름 차례 → 소리만 쓰는 판.
#
# 굽기 전 검사: 지은 꾸러미에 tools/컷연속성검사.py <컷표> --지시문 <꾸러미>를 바로 돌려 걸림 · 확인 · 주의를 같이 찍는다(내기 도구의 굽기전()과 같은 판정).
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

그림꼴 = (".jpg", ".jpeg", ".png", ".webp")
소리꼴 = (".mp3", ".wav")
표식 = "_만든것.json"
도구이름 = "tools/꾸러미만들기.py"
최소초, 최대초 = 4, 15
금지글자 = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def 인자풀기(argv):
    o = {"편": None, "컷": None, "지시문": None, "꾸러미": None, "컷표": None, "덮어쓰기": False, "실행": False, "json": False}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ("--컷", "--지시문", "--꾸러미", "--컷표"):
            if i + 1 >= len(argv) or argv[i + 1].startswith("--"):
                raise SystemExit(f"{a} 뒤에 값이 없다")
            o[a[2:]] = argv[i + 1]; i += 2
        elif a in ("--덮어쓰기", "--실행", "--json"):
            o[a[2:]] = True; i += 1
        elif a.startswith("--"):
            raise SystemExit(f"모르는 선택: {a}")
        elif o["편"] is None:
            o["편"] = a; i += 1
        else:
            raise SystemExit(f"편 폴더는 하나만 준다(남는 인자: {a})")
    if not o["편"]:
        raise SystemExit("쓰는 법: python -I -X utf8 tools/꾸러미만들기.py <편 폴더> [--컷 C1,C3b] [--지시문 <폴더>] [--꾸러미 <폴더>] [--컷표 <파일>] [--덮어쓰기] [--실행] [--json]")
    if o["컷"] is not None:
        o["컷"] = [s.strip() for s in o["컷"].split(",") if s.strip()]
        if not o["컷"]:
            raise SystemExit("--컷 뒤에 판 이름이 없다")
    return o


def 지문(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for 조각 in iter(lambda: f.read(1 << 20), b""):
            h.update(조각)
    return h.hexdigest()[:16]


def 목록으로(v):
    """글 하나 · 목록 → 빈 글을 뺀 글 목록"""
    if isinstance(v, str):
        v = [v]
    return [x.strip() for x in v if isinstance(x, str) and x.strip()] if isinstance(v, list) else []


def 안전한이름(이름):
    """폴더 · 파일 이름 하나 — 경로 구분 · 드라이브(:) · 제어 글자가 없고 . · ..이 아니며 앞뒤 빈칸 · 끝 마침표가 없다(윈도우가 다른 이름으로 푸는 꼴)"""
    return isinstance(이름, str) and 이름 not in ("", ".", "..") and not 금지글자.search(이름) and 이름 == 이름.strip() and not 이름.endswith(".")


def 직계(부모, 이름):
    """부모/이름이 정말 부모의 바로 아래인가 — 이름이 안전하고, 풀어 본 경로의 부모가 부모와 같다"""
    if not 안전한이름(이름):
        return False
    try:
        return (부모 / 이름).resolve().parent == 부모.resolve()
    except OSError:
        return False


def 쓰는구간들(rows):
    """컷 줄들 → [(in, out)] — 숫자이고 out > in >= 0인 것만"""
    out = []
    for d in rows:
        a, b = d.get("in"), d.get("out")
        if all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in (a, b)) and b > a >= 0:
            out.append((float(a), float(b)))
    return out


def 판길이(rows, 덮음):
    """(길이, 걸림 글 | None) — 손으로 준 길이가 먼저, 없으면 이 판을 쓰는 모든 구간(같은 컷의 둘째 토막 · 이은 컷들)을 덮게 셈한다"""
    구간 = 쓰는구간들(rows)
    if len(구간) < len(rows):   # 「길이」를 손으로 적어도 쓰는 구간은 줄마다 있어야 한다 — 없으면 그 구간을 덮는지 볼 수 없고 받은 판도 잴 수 없다
        못읽은 = next(d for d in rows if not 쓰는구간들([d]))
        return None, f"컷표 {못읽은.get('cut')}의 in · out을 읽을 수 없다(in {못읽은.get('in')!r} · out {못읽은.get('out')!r}) — 쓰는 구간을 적는다"
    끝 = max((b for _, b in 구간), default=None)

    def 손길이(어디, v):
        if isinstance(v, bool) or not isinstance(v, (int, float)) or v != int(v) or not 최소초 <= v <= 최대초:
            return f"{어디}의 「길이」가 {v!r}다 — {최소초}~{최대초} 사이 정수 초로 적는다"
        return None
    손, 어디 = None, None
    if 덮음.get("길이") is not None:   # 판마다 덮어쓴 값(_판.json)이 먼저다
        탈 = 손길이("_판.json", 덮음["길이"])
        if 탈:
            return None, 탈
        손, 어디 = int(덮음["길이"]), "_판.json"
    else:   # 컷표 줄마다 적힌 「길이」는 모두 보고 가장 큰 값을 쓴다(첫 줄 값만 보면 뒤 컷에 적은 더 긴 길이 · 틀린 값이 묻힌다)
        적힌 = [d["길이"] for d in rows if d.get("길이") is not None]
        for v in 적힌:
            탈 = 손길이("컷표", v)
            if 탈:
                return None, 탈
        if 적힌:
            손, 어디 = max(int(v) for v in 적힌), "컷표"
    if 손 is not None:
        if 끝 is not None and 손 < 끝:
            return None, f"{어디}의 「길이」 {손}초가 쓰는 구간 끝 {끝:g}초보다 짧다 — 편집에서 이 컷이 모자란다"
        return 손, None
    if not rows:
        return None, "소리만 쓰는 판은 _판.json에 「길이」를 적는다"
    n = max(최소초, math.ceil(round(max(max(b, (b - a) + 0.8) for a, b in 구간), 3)))
    if n > 최대초:
        return None, f"쓰는 구간이 {끝:g}초까지라 판이 {n}초가 된다 — 한 판은 {최대초}초까지다(컷을 나누거나 「길이」를 적는다)"
    return n, None


def 소리읽기(글):
    """(끔 | 켬, 주의 글 | None) — 지시문 글의 SOUND 줄에서"""
    # 「No sound.」가 한 문장으로 서 있을 때만 끔이다 — 대사 판의 「no music, no other voices, no sound effects.」를 끔으로 읽지 않는다
    if re.search(r"(?:^|[\n.:]\s*)No sound\s*\.", 글, re.I) or re.search(r"\bSilent clip\b", 글, re.I):
        return "끔", None
    if re.search(r"^\s*SOUND\s*:", 글, re.M):
        return "켬", None
    return "끔", "SOUND 줄이 없다 — 소리 끔 판은 「SOUND: No sound.」, 대사 판은 SOUND · VOICE 줄을 쓴다(지시문 틀 8)"


def 판기준이름(값):
    """컷표 「판」 칸의 값 → 판 id. 다시 낸 파일 이름(C1__2 — 받은 뒤 검사가 그렇게 적으라고 안내한다)은 꼬리를 떼면 그 판이다"""
    return re.sub(r"__\d+$", "", 값.strip()) if isinstance(값, str) else None


def 대안의컷(이름, 컷들):
    """컷 이름 + 소문자 · 숫자 꼬리 → 그 컷(가장 긴 이름부터). 아니면 None"""
    for c in sorted(컷들, key=len, reverse=True):
        if 이름.startswith(c) and re.fullmatch(r"[-_]?[a-z0-9]{1,6}", 이름[len(c):] or ""):
            return c
    return None


def 판모으기(편, seq, 지시문폴더, 고른):
    """→ (판 목록, 걸림 [(판, 글)], 주의 [(판, 글)]) — 파일을 쓰지 않는다"""
    걸림, 주의, 판들 = [], [], []
    det = [d for d in seq.get("detail") or [] if isinstance(d, dict) and isinstance(d.get("cut"), str) and d["cut"].strip()]
    컷차례 = list(dict.fromkeys(d["cut"] for d in det))
    컷줄들 = {}
    for d in det:
        컷줄들.setdefault(d["cut"], []).append(d)   # 같은 컷이 둘째 토막으로 또 나오면 그 줄들도 함께 본다(길이가 모든 쓰는 구간을 덮게)
    장면표 = seq.get("장면") if isinstance(seq.get("장면"), dict) else {}
    비율 = (seq.get("편") or {}).get("비율") if isinstance(seq.get("편"), dict) else None
    if not isinstance(비율, str) or not re.fullmatch(r"\d+:\d+", 비율.strip()):
        걸림.append(("표", f"컷표 「편.비율」이 {비율!r}다 — 9:16 · 16:9처럼 적는다"))
        비율 = None
    else:
        비율 = 비율.strip()
    글들 = {p.stem: p for p in sorted(지시문폴더.glob("*.txt")) if not p.name.startswith("_")} if 지시문폴더.is_dir() else {}
    if not 지시문폴더.is_dir():
        걸림.append(("표", f"지시문 폴더가 없다: {지시문폴더} — 컷마다 <컷>.txt를 지시문 틀대로 쓴다"))
    덮음표 = {}
    덮음파일 = 지시문폴더 / "_판.json"
    if 덮음파일.is_file():
        try:
            덮음표 = json.loads(덮음파일.read_text(encoding="utf-8-sig"))
            if not isinstance(덮음표, dict) or any(not isinstance(v, dict) for v in 덮음표.values()):
                raise ValueError("판 id → {칸: 값} 꼴이 아니다")
        except Exception as e:   # noqa: BLE001 — 까닭을 그대로 보인다
            걸림.append(("표", f"_판.json을 읽지 못했다: {e}"))
            덮음표 = {}
    for 이름 in 덮음표:
        if 이름 not in 글들:
            걸림.append((이름, f"_판.json에 「{이름}」이 있는데 {이름}.txt가 없다"))

    def 한판(이름, 글파일):
        if not 안전한이름(이름):
            걸림.append((이름, f"판 이름 {이름!r}은 폴더 이름으로 쓸 수 없다 — 경로 글자(\\ / : * ? \" < > |) · 앞뒤 빈칸 · 끝 마침표를 뺀다"))
            return None
        덮음 = 덮음표.get(이름, {})
        소리만 = 덮음.get("소리만") is True
        if 이름 in 컷줄들:
            잇는컷, 대안 = [이름], False
        elif 소리만:
            잇는컷, 대안 = [], False
        else:
            적은 = list(dict.fromkeys(목록으로(덮음.get("컷"))))
            if 적은:
                없는 = [c for c in 적은 if c not in 컷줄들]
                if 없는:
                    걸림.append((이름, f"_판.json 「컷」의 {' · '.join(없는)}이 컷표에 없다"))
                    return None
                잇는컷, 대안 = 적은, True
            else:
                c = 대안의컷(이름, 컷차례)
                if not c:
                    걸림.append((이름, f"{이름}.txt가 어느 컷의 판인지 모른다 — 파일 이름을 컷 이름(또는 컷 이름 + 소문자 꼬리)으로 하거나 _판.json에 \"컷\": [\"<컷>\"] · \"소리만\": true를 적는다"))
                    return None
                잇는컷, 대안 = [c], True
        rows = [r for c in 잇는컷 for r in 컷줄들[c]]
        # 컷표에서 「판」으로 이 판을 가리킨 다른 컷(한 판을 이어 쓰는 컷)의 구간도 이 판이 덮어야 한다 — 받은 뒤 검사도 같은 줄들로 잰다
        rows += [d for d in det if isinstance(d.get("판"), str) and 이름 in (d["판"].strip(), 판기준이름(d["판"])) and d["cut"] not in 잇는컷]
        글 = 글파일.read_text(encoding="utf-8-sig")
        if not 글.strip():
            걸림.append((이름, f"{글파일.name}이 비었다"))
            return None
        길이, 탈 = 판길이(rows, 덮음)
        if 탈:
            걸림.append((이름, 탈))
        소리, 소리주의 = 소리읽기(글)
        if 소리주의:
            주의.append((이름, 소리주의))

        def 값(k):
            return 덮음[k] if k in 덮음 else next((r[k] for r in rows if k in r), None)
        시작 = 목록으로(값("시작그림"))[:1] if not 소리만 else []
        끝 = 목록으로(값("끝그림"))[:1] if not 소리만 else []
        참고 = 목록으로(값("참고그림")) if not 소리만 else []
        목소리 = 목록으로(값("목소리견본"))
        if not 소리만 and not 시작:
            걸림.append((이름, "「시작그림」이 없다 — 컷표 그 컷에 시작 그림 파일(편 폴더 기준)을 적는다(이미지 콘티를 고른 뒤)"))
        파일들, 빠짐 = [], []

        def 담기(목록, 이름틀, 꼴):
            for n, 길 in enumerate(목록, 1):
                원 = Path(길) if os.path.isabs(길) else 편 / 길
                끝꼴 = 원.suffix.lower()
                if 끝꼴 not in 꼴:
                    걸림.append((이름, f"{길} — {' · '.join(꼴)} 파일이 아니다"))
                    continue
                새 = 이름틀.format(n=n) + 끝꼴
                if not 원.is_file():
                    빠짐.append(새)
                    걸림.append((이름, f"파일이 없다: {길}"))
                    continue
                파일들.append((새, 원))
        담기(시작, "1_시작", 그림꼴)
        담기(끝, "2_끝", 그림꼴)
        담기(참고, "3_참고{n}", 그림꼴)
        담기(목소리, "4_목소리{n}", 소리꼴)
        그림수 = sum(1 for 새 in [새 for 새, _ in 파일들] + 빠짐 if 새.lower().endswith(그림꼴))
        소리수 = sum(1 for 새 in [새 for 새, _ in 파일들] + 빠짐 if 새.lower().endswith(소리꼴))
        for 꼬리표, 수, 뜻 in (("이미지", 그림수, "그림"), ("오디오", 소리수, "소리")):
            쓴 = sorted({int(n) for n in re.findall(rf"@\s*{꼬리표}\s*(\d+)", 글)})
            넘침 = [n for n in 쓴 if n > 수 or n < 1]
            if 넘침:
                걸림.append((이름, f"지시문이 @{꼬리표} {' · '.join(map(str, 넘침))}을 부르는데 이 판의 {뜻}은 {수}개다 — 컷표 「끝그림」 · 「참고그림」 · 「목소리견본」이나 _판.json에 파일을 적는다(차례: 시작 · 끝 · 참고)"))
        if 시작 and not 소리만 and not re.search(r"@\s*이미지\s*1\b", 글) and "attached image" not in 글.lower():
            주의.append((이름, "지시문에 「@이미지 1」이 없다 — 첫 줄에서 시작 그림을 가리킨다(지시문 틀 1)"))
        실내값 = [r["실내"] for r in rows if isinstance(r.get("실내"), bool)]
        if not 실내값:
            실내값 = [s["실내"] for r in rows for s in [장면표.get(r.get("장면")) if isinstance(r.get("장면"), str) else None]
                    if isinstance(s, dict) and isinstance(s.get("실내"), bool)]
        실내 = (True if any(실내값) else False) if 실내값 else None
        판수 = 덮음.get("판 수", 1)
        if isinstance(판수, bool) or not isinstance(판수, int) or not 1 <= 판수 <= 9:
            걸림.append((이름, f"_판.json 「판 수」가 {판수!r}다 — 1~9 사이 정수"))
            판수 = 1
        번호 = (900 + len([p for p in 판들 if p["소리만"]]) + 1) if 소리만 else 컷차례.index(잇는컷[0]) + 1
        인물 = list(dict.fromkeys(x for r in rows if isinstance(r.get("인물"), list) for x in 목록으로(r["인물"]))) if any(isinstance(r.get("인물"), list) for r in rows) else None
        return {"id": 이름, "폴더": f"{번호:03d}_{이름}", "길이": 길이, "비율": 비율, "소리": 소리, "글": 글, "파일들": 파일들, "빠짐": 빠짐,
                "실내": 실내, "인물": 인물, "소리만": 소리만, "대안": 대안, "컷": 잇는컷,
                "쓰는초": [round(b - a, 3) for a, b in 쓰는구간들(rows)], "판수": 판수, "컷번호": 번호}

    쓴이름 = set()
    for c in 컷차례:   # 컷표 차례대로 — 그 컷의 판, 이어서 그 컷의 대안 판
        줄들 = 컷줄들[c]
        if c in 글들:
            p = 한판(c, 글들[c])
            쓴이름.add(c)
            if p:
                판들.append(p)
        elif not any((isinstance(d.get("같은판"), str) and d["같은판"].strip()) or d.get("판") or d.get("이어찍기") is True for d in 줄들):
            주의.append((c, f"영상지시문/{c}.txt가 없다 — 이 컷은 꾸러미에 넣지 않았다(다른 컷의 판을 이어 쓰는 컷이면 컷표에 같은판: \"<까닭>\"이나 \"판\")"))
    for 이름, 글파일 in 글들.items():   # 컷 이름이 아닌 글 — 대안 판 · 소리만 쓰는 판
        if 이름 in 쓴이름:
            continue
        p = 한판(이름, 글파일)
        if p:
            판들.append(p)
    판들.sort(key=lambda p: (2, 0, p["id"]) if p["소리만"] else (0, p["컷번호"], (1, p["id"]) if p["대안"] else (0, "")))
    if 고른 is not None:
        모르는 = [x for x in 고른 if x not in {p["id"] for p in 판들} and not any(x == 누구 for 누구, _ in 걸림)]
        if 모르는:
            걸림.append(("표", f"--컷의 {' · '.join(모르는)}에 맞는 지시문 글이 없다"))
        판들 = [p for p in 판들 if p["id"] in 고른]
        걸림 = [(누구, 글) for 누구, 글 in 걸림 if 누구 == "표" or 누구 in 고른]
        주의 = [(누구, 글) for 누구, 글 in 주의 if 누구 in 고른]
    if not 판들 and not 걸림:
        걸림.append(("표", "꾸러미에 넣을 판이 없다 — 영상지시문/<컷>.txt를 쓴다"))
    폴더들 = {}
    for p in 판들:
        if p["폴더"].lower() in 폴더들:   # 윈도우는 대소문자를 가리지 않는다
            걸림.append((p["id"], f"판 폴더 이름이 겹친다({p['폴더']} ↔ {폴더들[p['폴더'].lower()]})"))
        폴더들[p["폴더"].lower()] = p["id"]
    return 판들, 걸림, 주의


def 순서줄(판들):
    줄 = []
    for n, p in enumerate(판들, 1):
        b = {"순서": n, "id": p["id"], "폴더": p["폴더"], "길이": p["길이"], "비율": p["비율"], "소리": p["소리"],
             "파일": [새 for 새, _ in p["파일들"]], "빠진 파일": list(p["빠짐"]), "쓰는초": p["쓰는초"], "판 수": p["판수"]}
        if p["실내"] is not None:
            b["실내"] = p["실내"]
        if p["인물"] is not None and not p["소리만"]:
            b["인물"] = p["인물"]
        if p["대안"]:
            b["컷"] = p["컷"]
        if p["소리만"]:
            b["소리만"] = True
        줄.append(b)
    return 줄


def 표식읽기(파일):
    """_만든것.json → {폴더: [파일…]} | None(이 도구의 표식이 아니다 · 깨졌다 · 이름에 경로 글자가 있다)"""
    try:
        j = json.loads(파일.read_text(encoding="utf-8"))
    except Exception:   # noqa: BLE001
        return None
    폴더 = j.get("폴더") if isinstance(j, dict) and j.get("도구") == 도구이름 else None
    if not isinstance(폴더, dict):
        return None
    for k, v in 폴더.items():
        if not 안전한이름(k) or not isinstance(v, list) or any(not 안전한이름(x) for x in v):
            return None
    return 폴더


def 짓기(대상, 판들, 원천, 덮어쓰기):
    """대상 폴더에 꾸러미를 쓴다 → (남긴 것 [글], 지운 것 [폴더], 옮긴 것 [글]). 쓰기 전에 충돌을 모두 먼저 본다 — 멈출 때는 아무것도 바꾸지 않는다."""
    순서파일, 표식파일 = 대상 / "_순서.json", 대상 / 표식
    있던것 = sorted(x.name for x in 대상.iterdir()) if 대상.is_dir() else []
    앞 = 표식읽기(표식파일) if 표식파일.is_file() else None
    손꾸러미 = 앞 is None and bool(있던것)   # 표식이 없거나 믿을 수 없는데 폴더에 무언가 있다
    앞 = 앞 or {}
    충돌 = []   # (폴더, 파일 | None) — 이 도구가 넣지 않은 것과 이름이 겹친다
    for p in 판들:
        if not 직계(대상 if 대상.is_dir() else 대상.parent, p["폴더"]):
            raise SystemExit(f"[멈춤] 판 폴더 이름을 쓸 수 없다: {p['폴더']!r} — 아무것도 바꾸지 않았다")
        d = 대상 / p["폴더"]
        if not (d.exists() or d.is_symlink()):
            continue
        if not d.is_dir() or d.is_symlink() or p["폴더"] not in 앞:
            충돌.append((p["폴더"], None))
            continue
        for 새 in ["지시문.txt"] + [새 for 새, _ in p["파일들"]]:
            if ((d / 새).exists() or (d / 새).is_symlink()) and 새 not in 앞[p["폴더"]]:
                충돌.append((p["폴더"], 새))
    if (손꾸러미 or 충돌) and not 덮어쓰기:
        까닭 = []
        if 손꾸러미:
            까닭.append(f"이 도구가 만든 꾸러미가 아니다({표식}이 없거나 이 도구의 표식이 아닌데 폴더에 {len(있던것)}개가 있다)")
        if 충돌:
            까닭.append("이 도구가 넣지 않은 것과 이름이 겹친다(" + " · ".join(f"{a}/{b}" if b else f"{a}/" for a, b in 충돌[:6]) + (" …" if len(충돌) > 6 else "") + ")")
        raise SystemExit(f"[멈춤] {대상} — {' / '.join(까닭)} — 아무것도 바꾸지 않았다. 그 위에 지으려면 --덮어쓰기(겹치는 것과 앞 _순서.json은 지우지 않고 꾸러미 안 _앞<번호>/ 로 옮긴다)")
    대상.mkdir(parents=True, exist_ok=True)
    옮김 = []
    if 손꾸러미 or 충돌:   # --덮어쓰기 — 지우지 않고 옮긴다
        n = 1
        while (대상 / f"_앞{n}").exists():
            n += 1
        보관 = 대상 / f"_앞{n}"
        보관.mkdir()
        if 손꾸러미:
            for 이름 in ("_순서.json", 표식):
                if (대상 / 이름).is_file():
                    shutil.move(str(대상 / 이름), str(보관 / 이름))
                    옮김.append(f"{이름} → {보관.name}/")
        for 폴더, 파일 in 충돌:
            if 파일 is None:
                shutil.move(str(대상 / 폴더), str(보관 / 폴더))
                옮김.append(f"{폴더}/ → {보관.name}/")
            else:
                (보관 / 폴더).mkdir(exist_ok=True)
                shutil.move(str(대상 / 폴더 / 파일), str(보관 / 폴더 / 파일))
                옮김.append(f"{폴더}/{파일} → {보관.name}/{폴더}/")
    남김, 지움, 새표 = [], [], {}
    지금폴더 = {p["폴더"] for p in 판들}
    for 폴더, 파일들 in 앞.items():   # 앞에 이 도구가 만들었고 이제 안 쓰는 폴더 — 적어 둔 파일만 지우고 빈 폴더만 걷는다
        if 폴더 in 지금폴더 or not 직계(대상, 폴더):
            continue
        d = 대상 / 폴더
        if not d.is_dir() or d.is_symlink():
            continue
        남 = sorted(f.name for f in d.iterdir() if f.name not in set(파일들) or not f.is_file() or f.is_symlink())
        if 남:
            남김.append(f"{폴더} — 이 도구가 넣지 않은 파일이 있어 지우지 않았다({' · '.join(남[:4])})")
            continue
        for f in list(d.iterdir()):
            f.unlink()
        d.rmdir()
        지움.append(폴더)
    for p in 판들:
        d = 대상 / p["폴더"]
        d.mkdir(exist_ok=True)
        쓸 = ["지시문.txt"] + [새 for 새, _ in p["파일들"]]
        for 옛 in 앞.get(p["폴더"]) or []:   # 앞에 넣었고 이번에는 안 넣는 파일(끝 그림을 뺀 판 등)
            if 옛 not in 쓸 and 직계(d, 옛) and (d / 옛).is_file() and not (d / 옛).is_symlink():
                (d / 옛).unlink()
        (d / "지시문.txt").write_text(p["글"].replace("\r\n", "\n"), encoding="utf-8", newline="\n")
        for 새, 원 in p["파일들"]:
            if not (d / 새).is_file() or 지문(d / 새) != 지문(원):
                shutil.copyfile(원, d / 새)
        새표[p["폴더"]] = 쓸
    순서파일.write_text(json.dumps(순서줄(판들), ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    표식파일.write_text(json.dumps({"도구": 도구이름, "원천": 원천, "폴더": 새표}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    return 남김, 지움, 옮김


def 굽기전검사(컷표, 꾸러미):
    """tools/컷연속성검사.py <컷표> --지시문 <꾸러미> → (끝 코드, 통과가 아닌 줄 [{항목, 컷, 등급, 글}]) — 못 부르면 (None, [까닭])"""
    검사 = Path(__file__).resolve().parent / "컷연속성검사.py"
    with tempfile.TemporaryDirectory(prefix="synk-pack-check-") as 임시:
        r = subprocess.run([sys.executable, "-I", "-X", "utf8", str(검사), str(컷표), "--지시문", str(꾸러미), "--출력", 임시, "--json"],
                           capture_output=True, text=True, encoding="utf-8")
    try:
        항목들 = json.loads(r.stdout)
    except Exception:   # noqa: BLE001
        return None, [{"항목": "검사", "컷": "표", "등급": "걸림", "글": f"굽기 전 검사를 돌리지 못했다(끝 코드 {r.returncode}): {(r.stderr or r.stdout).strip()[:300]}"}]
    return r.returncode, [x for x in 항목들 if x.get("등급") in ("걸림", "확인", "주의")]


def main(argv=None):
    o = 인자풀기(list(sys.argv[1:] if argv is None else argv))
    if o["컷"] is not None and o["실행"]:
        raise SystemExit("--컷은 미리 보기에서만 쓴다 — 꾸러미는 늘 모든 판으로 짓는다(일부만 쓰면 _순서.json에서 나머지 판이 빠진다). 낼 판은 내기 도구에 판 id로 고른다")
    편 = Path(o["편"]).resolve()
    if not 편.is_dir():
        raise SystemExit(f"편 폴더가 없다: {편}")
    컷표 = Path(o["컷표"]).resolve() if o["컷표"] else 편 / "컷표.json"
    if not 컷표.is_file():
        raise SystemExit(f"컷표가 없다: {컷표} — 컷표 틀(docs/마케팅/제작양식/영상양식/컷표_틀.json)을 복사해 채운다")
    try:
        seq = json.loads(컷표.read_text(encoding="utf-8-sig"))
    except Exception as e:   # noqa: BLE001
        raise SystemExit(f"컷표를 읽지 못했다: {e}")
    if not isinstance(seq, dict) or seq.get("틀") != 2:
        raise SystemExit("이 도구는 컷표 틀 2에서만 돈다(맨 위 \"틀\": 2) — 옛 틀 편은 그 편의 꾸러미를 그대로 쓴다")
    지시문폴더 = Path(o["지시문"]).resolve() if o["지시문"] else 편 / "영상지시문"
    꾸러미 = Path(o["꾸러미"]).resolve() if o["꾸러미"] else 편 / "꾸러미"
    판들, 걸림, 주의 = 판모으기(편, seq, 지시문폴더, o["컷"])
    원천 = {"컷표": 지문(컷표), "지시문": {p["id"]: hashlib.sha256(p["글"].encode("utf-8")).hexdigest()[:16] for p in 판들}}
    결과 = {"편": str(편), "꾸러미": str(꾸러미), "실행": o["실행"], "판": 순서줄(판들), "걸림": [f"{누구}: {글}" for 누구, 글 in 걸림],
            "주의": [f"{누구}: {글}" for 누구, 글 in 주의], "검사": None, "쓴것": False, "남김": [], "지움": [], "옮김": []}
    검사코드, 검사줄 = None, []
    if not 걸림:
        if o["실행"]:
            결과["남김"], 결과["지움"], 결과["옮김"] = 짓기(꾸러미, 판들, 원천, o["덮어쓰기"])
            결과["쓴것"] = True
            검사코드, 검사줄 = 굽기전검사(컷표, 꾸러미)
        else:
            with tempfile.TemporaryDirectory(prefix="synk-pack-") as 임시:
                짓기(Path(임시) / "꾸러미", 판들, 원천, True)
                검사코드, 검사줄 = 굽기전검사(컷표, Path(임시) / "꾸러미")
        결과["검사"] = {"끝코드": 검사코드, "줄": 검사줄}
    검사걸림 = [x for x in 검사줄 if x["등급"] == "걸림"]
    검사확인 = [x for x in 검사줄 if x["등급"] == "확인"]
    끝 = 1 if 걸림 or 검사걸림 else (2 if 검사확인 else 0)
    결과["끝코드"] = 끝
    if o["json"]:
        print(json.dumps(결과, ensure_ascii=False, indent=1))
        return 끝
    print(f"편 {편.name} · 컷표 {컷표.name} · 지시문 {지시문폴더.name}/ → {'꾸러미 ' + str(꾸러미) if o['실행'] and not 걸림 else '미리 보기(쓰지 않음)'}")
    if 판들:
        print(f"  판 {len(판들)}개 · 합 {sum((p['길이'] or 0) * p['판수'] for p in 판들)}초")
        for n, p in enumerate(판들, 1):
            꼬리 = (" · 대안(" + " · ".join(p["컷"]) + ")" if p["대안"] else "") + (" · 소리만" if p["소리만"] else "") + (f" · {p['판수']}번" if p["판수"] > 1 else "")
            print(f"  {n:>3}  {p['폴더']:<16} {p['길이'] if p['길이'] is not None else '?':>2}초 · {p['비율'] or '?'} · 소리 {p['소리']} · 파일 {len(p['파일들'])}{' · 빠짐 ' + str(len(p['빠짐'])) if p['빠짐'] else ''}{꼬리}")
    for 누구, 글 in 걸림:
        print(f"  ✗ {누구}: {글}")
    for 누구, 글 in 주의:
        print(f"  · {누구}: {글}")
    for x in 검사줄:
        print(f"  {'✗' if x['등급'] == '걸림' else '?' if x['등급'] == '확인' else '·'} [{x.get('항목')}] {x.get('컷')}: {x.get('글')}")
    for 글 in 결과["옮김"]:
        print(f"  옮김(지우지 않음): {글}")
    for 글 in 결과["남김"]:
        print(f"  남김: {글}")
    if 결과["지움"]:
        print(f"  지움(앞에 이 도구가 만든 폴더): {' · '.join(결과['지움'])}")
    if 걸림:
        print("[멈춤] 위 걸림을 고친 뒤 다시 돌린다 — 꾸러미는 쓰지 않았다.")
    elif 검사걸림:
        print(f"[걸림] 굽기 전 검사 걸림 {len(검사걸림)}건 — 지시문 글(영상지시문/<판>.txt)이나 컷표를 고쳐 다시 돌린다. 내기 도구도 이 걸림으로 멈춘다.")
    elif not o["실행"]:
        print("검사 통과 — --실행을 붙이면 꾸러미에 쓴다." if 끝 == 0 else "확인할 것이 있다 — 눈으로 본 뒤 --실행을 붙인다.")
    else:
        print(f"다음: 견적 미리 보기 — python -X utf8 docs/마케팅/PULSE_포트폴리오_제작준비_20261012/시댄스무제한/크레딧내기.py \"{꾸러미}\"  (드리미나는 드리미나내기.py)")
    return 끝


if __name__ == "__main__":
    sys.exit(main())

# 검사 이력(파이썬 판) — tools/lib/검사이력.js와 같은 줄을 편 폴더 게시/검사이력.jsonl에 덧붙인다(2026-11-15, 흠 장부 설계 1단계).
#
# 왜와 줄 꼴은 tools/lib/검사이력.js 머리에 있다. 최종본검사.py · 컷연속성검사.py · 받은뒤검사.py가 결과를 다 낸 뒤 부른다.
# 가장 중요한 약속: 남기기()는 던지지 않고 화면에 아무것도 찍지 않는다 — 검사의 결과와 끝 코드는 이 모듈과 상관없이 그대로다.
# 도구 쪽에서도 이 파일을 불러오는 일부터 try로 감싼다(파일이 없거나 깨져도 검사는 그대로 끝난다). 끄기: SYNK_검사이력=끔.
import hashlib
import json
import os
import re
from datetime import datetime, timezone

HISTORY = "검사이력.jsonl"
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
갈래파일 = os.path.join(REPO, "docs", "마케팅", "제작양식", "흠갈래.json")
걸림상한 = 40
글상한 = 200
결과들 = {"걸림", "확인", "통과", "못 잼"}
_픽스처 = re.compile(r"[\\/]tests[\\/]fixtures([\\/]|$)")


def _있나(p):
    return os.path.exists(p)


def 편인가(d):
    return _있나(os.path.join(d, "게시", "준비.json")) or _있나(os.path.join(d, "컷표.json")) or _있나(os.path.join(d, "컷순서.json"))


def 편찾기(시작):
    """준 경로(파일이면 그 폴더)에서 위로 여섯 층까지 — 게시/준비.json · 컷표.json · 컷순서.json이 있는 폴더. 저장소 뿌리 · docs/마케팅에서 멈춘다."""
    try:
        env = os.environ.get("SYNK_검사편")
        if env:
            d = os.path.abspath(env)
            return d if 편인가(d) else None
        if not 시작:
            return None
        d = os.path.abspath(str(시작))
        if not os.path.isdir(d):
            d = os.path.dirname(d)
        if _픽스처.search(d):
            return None
        for _ in range(6):
            if 편인가(d):
                return d
            if _있나(os.path.join(d, ".git")) or os.path.basename(d) == "마케팅":
                return None
            up = os.path.dirname(d)
            if up == d:
                return None
            d = up
    except Exception:   # noqa: BLE001 — 못 찾으면 쓰지 않는다
        return None
    return None


def _json읽기(p):
    try:
        with open(p, encoding="utf-8-sig") as f:
            return json.load(f)
    except Exception:   # noqa: BLE001
        return None


def 길of(편):
    준비 = _json읽기(os.path.join(편, "게시", "준비.json"))
    브랜드 = str((준비 or {}).get("브랜드") or "").strip() if isinstance(준비, dict) else ""
    if re.fullmatch(r"(?i)lab", 브랜드) or (not 브랜드 and re.match(r"(?i)LAB[_-]", os.path.basename(편))):
        return "LAB"
    if _있나(os.path.join(편, "컷표.json")) or _있나(os.path.join(편, "컷순서.json")):
        return "컷표영상"
    return "그래픽"


def 엔진of(편):
    표 = _json읽기(os.path.join(편, "컷표.json"))
    e = 표.get("엔진") if isinstance(표, dict) else None
    if not e:
        return None
    if isinstance(e, str):
        return e[:80]
    if isinstance(e, dict):
        out = {k: v.strip()[:80] for k, v in e.items() if isinstance(v, str) and v.strip()}
        return out or None
    return None


def 지문(조각들):
    xs = [str(x) for x in (조각들 or []) if x]
    if not xs:
        return None
    return hashlib.sha256("\n".join(xs).encode("utf-8")).hexdigest()[:12]


def 파일지문(p):
    """파일 바이트의 SHA-256 앞 12자(못 읽으면 None)."""
    try:
        h = hashlib.sha256()
        with open(p, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        return h.hexdigest()[:12]
    except Exception:   # noqa: BLE001
        return None


def 경로지문(경로들):
    """판 지문 — 파일은 바이트(SHA-256), 폴더는 안의 파일 이름 · 크기(큰 받은 판을 다 읽지 않게)를 이어 앞 12자.
    파일 하나면 그 파일의 SHA-256 앞 12자 그대로다(최종 확인 메모가 적는 영상 지문과 같은 꼴)."""
    xs = [str(p) for p in (경로들 or []) if p]
    if len(xs) == 1 and os.path.isfile(xs[0]):
        return 파일지문(xs[0])
    조각 = []
    for p in 경로들 or []:
        if not p:
            continue
        p = str(p)
        if os.path.isdir(p):
            for n in sorted(os.listdir(p)):
                q = os.path.join(p, n)
                if os.path.isfile(q):
                    조각.append(f"{n}:{os.path.getsize(q)}")
        else:
            조각.append(파일지문(p) or p)
    return 지문(조각)


_번호표 = None


def 번호찾기(눈, 규칙):
    global _번호표
    if _번호표 is None:
        _번호표 = {}
        j = _json읽기(갈래파일)
        for 줄 in (j or {}).get("줄", []) if isinstance(j, dict) else []:
            for 올림 in (줄 or {}).get("올린검사", []) or []:
                for r in (올림 or {}).get("규칙", []) or []:
                    if 올림.get("검사") and r:
                        _번호표[f"{올림['검사']}:{r}"] = 줄.get("번호")
    n = _번호표.get(f"{눈}:{규칙}")
    return n if isinstance(n, int) else None


def 경로꼴(r):
    """경로 → 대소문자와 구분 기호를 가리지 않는 정규식 글. 맨 앞 구분 기호(POSIX 뿌리)는 남기고 그 앞이 글자면 맞추지 않는다(노드 판과 같다)."""
    r = str(r)
    조각 = r"[\\/]+".join(re.escape(x) for x in re.split(r"[\\/]+", r) if x)
    return (r"""(?<![^\s"'`|(\[=:,;])[\\/]+""" + 조각) if re.match(r"[\\/]", r) else 조각


_이름끝 = r"""(?![^\\/\s"'`|)\],;:])"""   # 뒤가 이름 글자면 다른 경로다


def 글다듬기(글, 저장소=None, 홈=None):
    # 윈도우 경로는 대소문자와 구분 기호(\ · / · JSON의 \\)가 섞여 들어온다 — 둘 다 가리지 않고 맞춘다(GPT 검수 GA1). 뒤 두 인자는 시험용이다
    s = "" if 글 is None else str(글)
    저장소 = 저장소 or REPO
    홈 = 홈 or os.path.expanduser("~")
    if len(저장소) > 3:
        s = re.sub(경로꼴(저장소) + r"(?:[\\/]+|" + _이름끝 + r")", lambda m: "" if m.group(0)[-1] in "\\/" else ".", s, flags=re.IGNORECASE)
    if 홈 and len(홈) > 3:
        s = re.sub(경로꼴(홈) + _이름끝, "~", s, flags=re.IGNORECASE)
    s = re.sub(r"[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s\"'`|]+", "~", s, flags=re.IGNORECASE)   # 다른 사용자 폴더도 이름을 남기지 않는다
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= 글상한 else s[: 글상한 - 1] + "…"


def _때():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def 줄만들기(편, 눈, 단계, 결과, 끝코드=None, 판=None, 걸림=(), 길=None, 엔진=None):
    items = []
    for x in 걸림 or []:
        if not x:
            continue
        등급 = "확인" if x.get("등급") == "확인" else "걸림"
        규칙 = str(x.get("규칙") or "").strip() or "이름없음"
        번호 = x.get("번호") if isinstance(x.get("번호"), int) else 번호찾기(눈, 규칙)
        item = {"규칙": 규칙}
        if isinstance(번호, int):
            item["번호"] = 번호
        item["등급"] = 등급
        item["글"] = 글다듬기(x.get("글"))
        items.append(item)
    엔진값 = 엔진 if 엔진 is not None else 엔진of(편)
    줄 = {"때": _때(), "길": 길 or 길of(편)}
    if 엔진값:
        줄["엔진"] = 엔진값
    if 판:
        줄["판"] = str(판)
    줄["단계"] = (os.environ.get("SYNK_검사단계") or 단계 or "").strip() or "모름"
    줄["눈"] = str(눈 or "").strip() or "모름"
    줄["결과"] = 결과 if 결과 in 결과들 else "못 잼"
    if isinstance(끝코드, int) and not isinstance(끝코드, bool):
        줄["끝코드"] = 끝코드
    줄["걸림"] = items[:걸림상한]
    if len(items) > 걸림상한:
        줄["더있음"] = len(items) - 걸림상한
    return 줄


def 줄들읽기(파일):
    try:
        with open(파일, encoding="utf-8") as f:
            글 = f.read()
    except Exception:   # noqa: BLE001
        return []
    out = []
    for l in re.split(r"\r?\n", 글):
        if not l.strip():
            continue
        try:
            out.append(json.loads(l))
        except Exception:   # noqa: BLE001
            pass
    return out


def _같은꼴(a):
    return json.dumps({"판": a.get("판") or "", "결과": a.get("결과"),
                       "걸림": [[x.get("규칙"), x.get("번호"), x.get("등급"), x.get("글")] for x in a.get("걸림") or []],
                       "더있음": a.get("더있음") or 0}, ensure_ascii=False, sort_keys=True)


def 남기기(편=None, 시작=None, 눈="", 단계="", 결과="", 끝코드=None, 판=None, 걸림=(), 길=None, 엔진=None):
    """검사가 끝난 뒤 부른다. 던지지 않는다 → (남겼나, 까닭)"""
    try:
        if os.environ.get("SYNK_검사이력", "") == "끔":
            return False, "SYNK_검사이력=끔"
        d = 편찾기(편 or 시작)
        if not d:
            return False, "편 폴더를 못 찾음"
        줄 = 줄만들기(d, 눈, 단계, 결과, 끝코드, 판, 걸림, 길, 엔진)
        파일 = os.path.join(d, "게시", HISTORY)
        앞 = next((x for x in reversed(줄들읽기(파일)) if isinstance(x, dict) and x.get("눈") == 줄["눈"] and x.get("단계") == 줄["단계"]), None)
        if 앞 is not None and _같은꼴(앞) == _같은꼴(줄):
            return False, "바로 앞 줄과 같음"
        os.makedirs(os.path.dirname(파일), exist_ok=True)
        try:
            with open(파일, "rb") as f:
                앞글 = f.read()
        except Exception:   # noqa: BLE001
            앞글 = b""
        줄끝 = b"\r\n" if b"\r\n" in 앞글 else b"\n"
        머리 = 줄끝 if 앞글 and not 앞글.endswith(b"\n") else b""
        with open(파일, "ab") as f:
            f.write(머리 + json.dumps(줄, ensure_ascii=False, separators=(",", ":")).encode("utf-8") + 줄끝)
        return True, 파일
    except Exception as e:   # noqa: BLE001
        return False, str(e)


def 도구에서남기기(**k):
    """도구가 부르는 입구 — 여기서도 무엇이든 삼킨다."""
    try:
        return 남기기(**k)
    except BaseException as e:   # noqa: BLE001 — SystemExit · KeyboardInterrupt도 검사 끝 코드를 바꾸지 않게
        return False, str(e)

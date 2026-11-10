# 사람 연기 낱말 판정 견줌(2026-11-10) — 꾸러미점검.py의 check()와 tools/컷연속성검사.py의 사람지시문검사가 같은 지시문에 같은 걸림을 내는지 본다.
#   python -I -X utf8 사람판정_견줌.py <지시문 묶음.json(글 목록)> <임시 폴더>
#   → JSON [{"글", "꾸러미점검": ["정지:<낱말>(<누구>)" | "박자없음", …], "검사기": […]}] — 두 목록이 같아야 한다.
# 꾸러미점검.py는 git 밖 꾸러미 폴더(BASE)를 읽으니 BASE를 임시 폴더로 돌려 판마다 지시문 하나짜리 가짜 꾸러미를 만든다.
# 그림 파일이 없는 꾸러미라 PIL은 쓰이지 않는다 — PIL이 없는 곳(CI)에서도 돌게 빈 모듈로 채운다.
import contextlib, io, json, os, re, sys, types
from pathlib import Path

뿌리 = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(뿌리 / "docs" / "마케팅" / "PULSE_포트폴리오_제작준비_20261012" / "시댄스무제한"))
sys.path.insert(0, str(뿌리 / "tools"))
try:
    import PIL  # noqa: F401
except ImportError:
    가짜 = types.ModuleType("PIL"); 가짜.Image = types.ModuleType("PIL.Image")
    sys.modules["PIL"], sys.modules["PIL.Image"] = 가짜, 가짜.Image

import 꾸러미점검  # noqa: E402
import 컷연속성검사  # noqa: E402

글들 = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
임시 = Path(sys.argv[2]); 꾸러미 = 임시 / "견줌꾸러미"; 꾸러미.mkdir(parents=True)
순서 = []
for i, 글 in enumerate(글들, 1):
    폴더 = f"{i:03d}_t{i:02d}"; (꾸러미 / 폴더).mkdir()
    (꾸러미 / 폴더 / "지시문.txt").write_text(글, encoding="utf-8")
    순서.append({"순서": i, "id": f"t{i:02d}", "폴더": 폴더, "파일": [], "빠진 파일": [], "비율": "9:16", "길이": 5, "편": "zz", "소리": "끔"})
(꾸러미 / "_순서.json").write_text(json.dumps(순서, ensure_ascii=False), encoding="utf-8")

꾸러미점검.BASE = str(임시)
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    꾸러미점검.check("견줌꾸러미")


def 줄임(말):
    m = re.search(r"사람 정지 낱말 「(.+?)」\((.+?)\)", 말)
    if m: return f"정지:{m.group(1)}({m.group(2)})"
    return "박자없음" if "시간 박자 없음" in 말 else None


옛 = {x["id"]: [] for x in 순서}
for 줄 in buf.getvalue().splitlines():
    m = re.match(r"\s+⚠ (t\d+): (.*)$", 줄)
    if m and 줄임(m.group(2)): 옛[m.group(1)].append(줄임(m.group(2)))
out = []
for x, 글 in zip(순서, 글들):
    새 = [s for s in (줄임(말) for 등급, 항목, 말 in 컷연속성검사.사람지시문검사(글) if 등급 == "걸림") if s]   # 두 판정이 함께 가진 걸림(정지 낱말 · 박자)만 견준다
    out.append({"글": 글, "꾸러미점검": 옛[x["id"]], "검사기": 새})
print(json.dumps(out, ensure_ascii=False))

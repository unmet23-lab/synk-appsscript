"""첫컷검사 시험용 눈. SYNK_FIRSTCUT_EYE에 이 파일을 주면 실제 눈 대신 답한다.

받은 글의 「## 질문」 열쇠마다 SYNK_FAKE_EYE_ANSWER(JSON: 열쇠 → 결과, 또는 열쇠 → {"결과", "관찰"})대로 답하고, 없는 열쇠는 충족이다.
SYNK_FAKE_EYE_LOG를 주면 부를 때마다 한 줄(작업 폴더의 파일 이름들과 받은 글)을 남긴다.
SYNK_FAKE_EYE_MODE: 빠짐(열쇠 하나를 빠뜨림) · 실패(종료 1).
"""
import json
import os
import re
import sys
from pathlib import Path

글 = sys.stdin.read()
질문 = json.loads(re.search(r"## 질문\n```json\n(.*?)\n```", 글, re.S).group(1))
정답 = json.loads(os.environ.get("SYNK_FAKE_EYE_ANSWER") or "{}")
판정 = {}
for k in 질문:
    값 = 정답.get(k, "충족")
    판정[k] = 값 if isinstance(값, dict) else {"결과": 값, "관찰": f"0.5초 칸에서 {k}에 해당하는 모습을 봤다"}
로그 = os.environ.get("SYNK_FAKE_EYE_LOG")
if 로그:
    with open(로그, "a", encoding="utf-8") as f:
        f.write(json.dumps({"파일": sorted(p.name for p in Path.cwd().iterdir()), "글": 글}, ensure_ascii=False) + "\n")
꼴 = os.environ.get("SYNK_FAKE_EYE_MODE", "")
if 꼴 == "실패":
    print("인증 실패", file=sys.stderr)
    sys.exit(1)
if 꼴 == "빠짐":
    판정.pop(next(iter(판정)))
print(json.dumps({"판정": 판정}, ensure_ascii=False))

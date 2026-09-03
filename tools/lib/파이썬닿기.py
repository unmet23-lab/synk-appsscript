# -*- coding: utf-8 -*-
"""파이썬 소스 두 벌에서 «어느 형태가 닿는 코드가 바뀌었나»를 잰다.
`tools/재굽기값.js` 가 부른다 — 혼자 쓰는 물건이 아니다.

■ 재는 법
  ① 형태 함수에서 시작해 **전이적으로** 닿는 함수를 전부 모은다(호출의 호출까지).
     화면 함수 하나는 보통 13~21개 함수에 닿는다(09-03 실측).
  ② 그 함수들의 «코드 줄»만 두 판에서 비교한다 — 주석과 docstring 은 걷는다.
     걷지 않으면 낱말 정리 커밋 하나에 「전부 바뀌었다」가 나온다. 09-03 에 실제로
     화면 넷이 그렇게 보였다(몬스터→캐릭터 · 칭찬 왕관→오늘의 성장 · 전부 주석이었다).
  ③ 옛 판에 없던 함수는 «새것»으로 센다(새 형태가 끼어든 자리).

■ 못 재는 것 — 솔직하게 적는다
  · 모듈 최상위 코드(무대·조명·렌더 설정)는 함수가 아니라 이 자에 안 잡힌다.
    호출하는 쪽(`재굽기값.js`)이 그 구간을 따로 대조한다.
  · 인자로 갈리는 갈래(`받침=`·`조명배=` 같은 손잡이)는 코드가 같아도 결과가 갈린다.
    그래서 이 자는 «코드가 같다»까지만 말하고, 인자가 같은지는 부르는 쪽이 안다.
  · 이름을 문자열로 부르는 자리(`형태들[이름]()`)는 호출로 안 읽힌다.

쓰기(인자는 JSON 한 덩이를 stdin 으로):
  {"old": "<옛 소스>", "new": "<새 소스>", "names": ["조합판", ...]}
내는 것:
  {"조합판": {"reached": 13, "changed": []}, ...}
"""
import io
import json
import re
import sys
import tokenize

DEF = re.compile(r"^def (\w+)\s*\(")
CALL = re.compile(r"(\w+)\s*\(")


def 함수들(src):
    """최상위 `def 이름(` 을 찾아 그 함수의 몸을 뜬다.
    파이썬 문법으로 정확히 파싱하지 않는 까닭: 이 파일(요소굽기.py)은 전부 최상위 def 이고,
    ast 로 뜨면 **주석이 사라져** 나중에 「무엇이 바뀌었나」를 사람이 못 읽는다.

    🔴 끝을 «다음 def» 로 잡으면 안 된다 — 마지막 def 가 파일 꼬리(형태들 딕셔너리·무대·조명·
       렌더 ≈200줄)를 통째로 삼킨다. 그러면 그 함수 하나가 «늘 바뀐 것»으로 보이고, 그 함수에
       닿는 형태는 영영 「다시 구워야 한다」가 된다. 끝은 «들여쓰기가 0 으로 돌아오는 줄»이다."""
    줄 = src.split("\n")
    나온것 = {}
    for i, l in enumerate(줄):
        m = DEF.match(l)
        if not m:
            continue
        e = len(줄)
        for j in range(i + 1, len(줄)):
            if 줄[j].strip() and not 줄[j][:1].isspace():
                e = j
                break
        나온것.setdefault(m.group(1), 줄[i:e])
    return 나온것


def 코드만(몸):
    """주석·docstring 을 걷고 토큰만 남긴다 — 이것이 「그림이 바뀌나」의 자다."""
    글 = "\n".join(몸)
    try:
        토큰 = list(tokenize.generate_tokens(io.StringIO(글).readline))
    except (tokenize.TokenError, IndentationError, SyntaxError):
        # 토큰화가 안 되면 보수적으로 — 주석 줄만 걷고 나머지를 그대로 쓴다.
        # (여기서 조용히 «같다»를 내면 안 구워야 할 것을 안 굽는 것이 아니라
        #  구워야 할 것을 «안 굽게» 만든다. 그쪽이 훨씬 비싸다.)
        return "\n".join(l.rstrip() for l in 몸
                         if l.strip() and not l.strip().startswith("#"))
    남길것 = []
    for t in 토큰:
        if t.type == tokenize.COMMENT:
            continue
        # 줄에 홀로 선 문자열 = docstring. 값으로 쓰이는 문자열은 앞에 무언가가 있다.
        if t.type == tokenize.STRING and t.line.strip().startswith(t.string[:3]):
            continue
        if t.type in (tokenize.NL, tokenize.NEWLINE, tokenize.INDENT,
                      tokenize.DEDENT, tokenize.ENDMARKER):
            continue
        남길것.append(t.string)
    return " ".join(x for x in 남길것 if x.strip())


def 닿는것(표, 씨앗):
    """전이 폐포 — 호출의 호출까지 따라간다."""
    본것, 쌓기 = set(), list(씨앗)
    while 쌓기:
        n = 쌓기.pop()
        if n in 본것 or n not in 표:
            continue
        본것.add(n)
        for c in CALL.findall("\n".join(표[n])):
            if c in 표 and c not in 본것:
                쌓기.append(c)
    return 본것


def main():
    들온것 = json.load(sys.stdin)
    새표 = 함수들(들온것["new"])
    옛표 = 함수들(들온것["old"])
    답 = {}
    for 이름 in 들온것["names"]:
        if 이름 not in 새표:
            답[이름] = {"reached": 0, "changed": [], "missing": True}
            continue
        닿 = 닿는것(새표, [이름])
        바뀐것 = []
        for n in sorted(닿):
            if n not in 옛표:
                바뀐것.append(n + " (새것)")
            elif 코드만(새표[n]) != 코드만(옛표[n]):
                바뀐것.append(n)
        답[이름] = {"reached": len(닿), "changed": 바뀐것}
    sys.stdout.write(json.dumps(답, ensure_ascii=False))


if __name__ == "__main__":
    main()

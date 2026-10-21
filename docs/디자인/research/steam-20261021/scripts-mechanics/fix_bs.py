# -*- coding: utf-8 -*-
"""mech_stats.py에 잘못 들어간 백스페이스 글자(0x08)를 정규식 단어 경계 표기로 되돌린다."""
import pathlib, sys
p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8")
n = s.count("\x08")
s = s.replace("\x08", "\\b")
p.write_text(s, encoding="utf-8")
print("replaced", n)

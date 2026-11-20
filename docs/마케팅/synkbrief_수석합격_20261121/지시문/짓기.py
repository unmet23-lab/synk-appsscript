# B60 그림 지시문 짓기 — _공통.txt를 덩이(LOOK · PEOPLE · 소품 · 곳)로 나눠, 그 그림에 드는 곳만 넣는다.
# Seedream 지시문은 5,000자 한도라 두 곳을 다 넣으면 넘는다(11-21 시작_축하 5,226자 거절).
#   python -I -X utf8 짓기.py            → 장면/*.txt 를 읽어 같은 이름의 지시문을 이 폴더에 쓴다
# 장면/<이름>.txt 첫 줄: 「곳: 1」 · 「곳: 2」 · 「곳: 1,2」 · 「곳: 없음」, 둘째 줄부터 머리(첫 문단) --- FRAME 문단.
import os, re, sys

여기 = os.path.dirname(os.path.abspath(__file__))
공통 = open(os.path.join(여기, "_공통.txt"), encoding="utf-8").read().replace("\r\n", "\n").strip()
덩이 = re.split(r"\n(?=PLACE \d)", 공통)
앞 = 덩이[0].strip()
곳 = {re.match(r"PLACE (\d)", d).group(1): d.strip() for d in 덩이[1:]}

for f in sorted(os.listdir(os.path.join(여기, "장면"))):
    if not f.endswith(".txt"):
        continue
    글 = open(os.path.join(여기, "장면", f), encoding="utf-8").read().replace("\r\n", "\n").strip()
    첫, 나머지 = 글.split("\n", 1)
    m = re.match(r"곳:\s*(.+)", 첫)
    if not m:
        sys.exit(f"{f}: 첫 줄이 「곳: …」가 아니다")
    고른 = [] if m.group(1).strip() == "없음" else [x.strip() for x in m.group(1).split(",")]
    머리, 틀 = 나머지.split("\n---\n", 1)
    몸 = "\n\n".join([머리.strip(), 앞] + [곳[k] for k in 고른] + [틀.strip()])
    open(os.path.join(여기, f), "w", encoding="utf-8").write(몸 + "\n")
    print(f, len(몸), "자", "넘음!" if len(몸) > 4950 else "")

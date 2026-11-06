# B27 실측 — 지어낸 리뷰 100개를 고정 씨앗으로 섞어 붙여 넣을 글을 만든다.
import json, random, pathlib
from collections import Counter

여기 = pathlib.Path(__file__).parent
d = json.load(open(여기 / "리뷰_원재료.json", encoding="utf-8"))
줄 = []
for 갈래, v in d["갈래"].items():
    for g in v["글"]:
        줄.append((갈래, "★" * v["별"] + "☆" * (5 - v["별"]) + " " + g))
assert len(줄) == 100, len(줄)
for 씨앗 in (11, 27):
    r = random.Random(씨앗)
    s = 줄[:]
    r.shuffle(s)
    (여기 / f"리뷰100_씨앗{씨앗}.txt").write_text("\n".join(x for _, x in s) + "\n", encoding="utf-8")
    위치 = [i + 1 for i, (갈래, _) in enumerate(s) if 갈래 == "맛"]
    print(씨앗, "맛 리뷰 자리", 위치, "글자", sum(len(x) for _, x in s))
print(Counter(갈래 for 갈래, _ in 줄))

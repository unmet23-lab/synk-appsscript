"""측정(등바뀜.json) 두 개를 Remotion 장면이 읽는 src/y54/data.ts로 옮긴다 — 화면의 숫자 · 깜빡임 표시는 모두 이 측정값이다.

python -I -X utf8 데이터짓기.py <반짝 측정 폴더> <그대로 측정 폴더> <data.ts> [--반짝구간 <시작초>,<끝초>]
"""
import json
import os
import sys


def 읽기(폴더):
    return json.load(open(os.path.join(폴더, "등바뀜.json"), encoding="utf8"))


def 꺼짐누적(d):
    n = d["프레임"]
    offs = [0] * n
    for row in d["상태"]:
        for j in range(1, n):
            if row[j - 1] == "1" and row[j] == "0":
                offs[j] += 1
    out, c = [], 0
    for v in offs:
        c += v
        out.append(c)
    return out


def 누적(d):
    n = d["프레임"]
    flips = [0] * n
    for row in d["상태"]:
        for j in range(1, n):
            if row[j] != row[j - 1]:
                flips[j] += 1
    out, c = [], 0
    for v in flips:
        c += v
        out.append(c)
    return out


def ts(이름, d):
    return (
        f"export const {이름} = {{\n"
        f"  fps: {d['fps']},\n  frames: {d['프레임']},\n  total: {d['바뀜합']},\n"
        f"  lamps: {json.dumps([{'x': l['x'], 'y': l['y'], 'r': l['r']} for l in d['등']])},\n"
        f"  state: {json.dumps(d['상태'])},\n"
        f"  cum: {json.dumps(누적(d))},\n"
        f"  offCum: {json.dumps(꺼짐누적(d))},\n  offTotal: {꺼짐누적(d)[-1]},\n"
        f"  lit: {json.dumps(d['켜진등수_프레임별'])},\n"
        f"}};\n"
    )


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    a, b, out = 읽기(sys.argv[1]), 읽기(sys.argv[2]), sys.argv[3]
    글 = "// 데이터짓기.py가 측정(측정/등바뀜.py)에서 지은 파일 — 손으로 고치지 않는다.\n" + ts("TW", a) + ts("ST", b)
    open(out, "w", encoding="utf8").write(글)
    print(f"반짝 {a['바뀜합']}번 · 그대로 {b['바뀜합']}번 → {out}")


if __name__ == "__main__":
    main()

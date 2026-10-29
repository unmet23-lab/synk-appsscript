# 시댄스 무제한 꾸러미 전수 점검(2026-10-30) — 결제 · 웹 내기 앞에, 그리고 꾸러미를 다시 만들 때마다 판 폴더를 하나도 빼지 않고 잰다.
#   python -X utf8 꾸러미점검.py [웹올리기 · 웹올리기_둘째날 …]   (기본은 둘 다)
# _순서.json의 판마다: 폴더 이름 · 목록 밖 파일 · 없거나 빈 파일(목소리 견본은 「파일 아직」으로 따로 셈), 그림 비율(판 비율과 2% 안) · 크기,
# 지시문 첫 줄 꼴(한 샷은 시작 그림 줄, 두 샷은 머리 · 「ONE hard cut at N s」), 올리는 그림 · 소리 수와 지시문이 부르는 @이미지 · @오디오 수,
# 끝 그림 줄, VOICE 줄(B 판에만 한 번), 소리 끔 판의 한국어 대사, 카메라 줄, 길이(4초~하루권 한 판 상한), 낡은 낱말을 본다.
# 판 id 겹침 · 순서 끊김 · 순서표 밖 폴더도 본다. 숫자는 거르기용 — 지시문이 장면에 맞는지는 사람(검수자)이 본다.
import json, os, re, sys

from PIL import Image

BASE = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
HEAD = "@이미지 1 is the exact first frame of this video"
OLD = ["Typecast", "타입캐스트", "후보판", "in sync with the reference audio"]
LIMIT = 8   # 하루권 한 판 길이 상한(카드에서 7초 이상인지 본다 — 가장 긴 판 7초)
KEEP = {"_순서.json", "순서표.html"}


def ratio(s):
    a, b = map(float, s.split(":"))
    return a / b


def check(name):
    out = os.path.join(BASE, name)
    items = json.load(open(os.path.join(out, "_순서.json"), encoding="utf-8"))
    bad, wait = [], 0
    ids = [x["id"] for x in items]
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        bad.append(("꾸러미", f"판 id 겹침 {dup}"))
    if [x["순서"] for x in items] != list(range(1, len(items) + 1)):
        bad.append(("꾸러미", "순서 끊김"))
    stray = sorted(set(os.listdir(out)) - {x["폴더"] for x in items} - KEEP)
    if stray:
        bad.append(("꾸러미", f"순서표 밖 폴더 · 파일 {stray[:8]}{' …' if len(stray) > 8 else ''}"))
    longest = (0, "")
    for x in items:
        pid, d = x["id"], os.path.join(out, x["폴더"])

        def no(msg):
            bad.append((pid, msg))

        if not os.path.isdir(d):
            no("폴더 없음")
            continue
        if not x["폴더"].startswith(f"{x['순서']:03d}_"):
            no(f"폴더 이름 {x['폴더']}")
        extra = set(os.listdir(d)) - set(x["파일"]) - {"지시문.txt"}
        if extra:
            no(f"목록 밖 파일 {sorted(extra)}")
        imgs = [f for f in x["파일"] if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))]
        auds = [f for f in x["파일"] if f.lower().endswith((".mp3", ".wav", ".m4a"))]
        for f in x["파일"]:
            p = os.path.join(d, f)
            if f in x["빠진 파일"]:
                if f == "3_목소리견본.mp3" and x.get("방식") == "B":
                    wait += 1
                else:
                    no(f"빠진 파일 {f}")
            elif not os.path.exists(p) or os.path.getsize(p) == 0:
                no(f"없거나 빈 파일 {f}")
        for f in imgs:
            p = os.path.join(d, f)
            if not os.path.exists(p):
                continue
            w, h = Image.open(p).size
            if abs(w / h - ratio(x["비율"])) / ratio(x["비율"]) > 0.02:
                no(f"{f} 비율 {w}x{h} ≠ {x['비율']}")
            if min(w, h) < 700:
                no(f"{f} 작음 {w}x{h}")
        t = open(os.path.join(d, "지시문.txt"), encoding="utf-8").read()
        longest = max(longest, (len(t), pid))
        if x.get("묶음"):
            if "TWO SHOTS" not in t or not re.search(r"ONE hard cut at [\d.]+ ?s", t):
                no("두 샷 머리 · 컷 초 없음")
        elif not t.startswith(HEAD):
            no("첫 줄이 시작 그림 꼴이 아님")
        n_img = max([int(n) for n in re.findall(r"@이미지 (\d+)", t)] or [0])
        n_aud = max([int(n) for n in re.findall(r"@오디오 (\d+)", t)] or [0])
        if n_img != len(imgs):
            no(f"올리는 그림 {len(imgs)} · 지시문이 부르는 @이미지 {n_img}")
        if n_aud != len(auds):
            no(f"올리는 소리 {len(auds)} · 지시문이 부르는 @오디오 {n_aud}")
        if "2_끝.jpg" in x["파일"] and "@이미지 2 is the exact last frame" not in t:
            no("끝 그림 줄 없음")
        v = t.count("VOICE:")
        if x.get("방식") == "B":
            if v != 1:
                no(f"B 판인데 VOICE 줄 {v}개")
        elif v:
            no("B 판이 아닌데 VOICE 줄")
        if x["소리"] == "끔" and re.search(r'["“][^"”]*[가-힣]', t):
            no("소리 끔 판인데 따옴표 안 한국어(대사?)")
        if x["소리"] == "켬" and x.get("방식") not in ("B", "목소리 판"):
            no("소리 켬인데 B · 목소리 판이 아님")
        if not re.search(r"CAMERA|Camera", t):
            no("카메라 줄 없음")
        if not 4 <= x["길이"] <= LIMIT:
            no(f"길이 {x['길이']}초")
        for w in OLD:
            if w in t:
                no(f"낡은 낱말 「{w}」")
    main = [x for x in items if not x.get("대안")]
    print(f"{name}: {len(items)}판(주판 {len(main)} · {sum(x['길이'] for x in main)}초, 대안 {len(items) - len(main)}) · "
          f"가장 긴 판 {max(x['길이'] for x in items)}초 · 가장 긴 지시문 {longest[0]}자({longest[1]}) · 목소리 견본 기다림 {wait}판")
    for pid, msg in bad:
        print(f"  ⚠ {pid}: {msg}")
    if not bad:
        print("  어긋남 0")
    return not bad


if __name__ == "__main__":
    names = [a for a in sys.argv[1:] if not a.startswith("--")] or [n for n in ("웹올리기", "웹올리기_둘째날", "웹올리기_7번비교")
                                                                   if os.path.exists(os.path.join(BASE, n, "_순서.json"))]
    ok = [check(n) for n in names]
    sys.exit(0 if all(ok) else 1)

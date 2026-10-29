# 7번 「사랑 한 칸」 이미지 콘티를 GPT Image 2.5 Sunburst · max로 다시 그린다(2026-10-30 유호님 「7번 선버스트로」).
#   python -X utf8 이미지콘티_선버스트.py 굽기 [컷…] [--다시]   → git 밖 콘티/p7/선버스트/받음/<컷>.png(tools/GPT콘티굽기.mjs, 셋씩 동시에)
#   python -X utf8 이미지콘티_선버스트.py 맞춤 [컷…]            → 선버스트/정지컷/<컷>.jpg(1080×1920, 이미지콘티_맞춤.fit) · _맞춤.json
#   python -X utf8 이미지콘티_선버스트.py 재기                  → 선버스트/_재기.json · 닮음(지금 → 새) · 얼굴 크기가 확정 판과 12% 넘게 다른 컷
#   python -X utf8 이미지콘티_선버스트.py 판                    → 선버스트/보드/<화>_<n>.jpg(컷마다 지금 | 새, 여덟 컷씩)
# 길: 새로 굽지 않고 확정 판(정지컷/<컷>.jpg)을 배치도 자리에 넣어 「이 구도 그대로, 빛 · 피부 · 렌즈만 영화 스틸로 다시」 그린다.
#   10-30 시험에서 같은 지시문으로 새로 구우면 원본보다 가깝게 잡았고(얼굴 높이 1-5 0.295 · 원본 0.248, 2-45 0.353 · 0.21) 구도 줄로도
#   안 막혔다. 확정 판을 넣으면 1-5는 0.249로 그대로였고, 2-45는 아래 FRAMING 줄로 0.311 → 0.265. 37차까지 맞춘 소품 · 옷 이어짐(10-28 ·
#   10-29 고친 컷 포함)도 그대로 간다 — 현장노트 그림_굽기_오리기 「실사 광고 콘티를 API Sunburst · max로 구우면」.
# 1-12는 1-14 판을 같이 쓰고(10-29), 1-10은 다시 그린 1-9를 1-10 얼굴 자리로 잘라 맞춘다(10-29 펀치인). 색 · 빛 후보정 없음(결정 10-24).
# --길 <다시그림 · 얼굴흐림 · 새로>(기본 다시그림) — 유호님 10-30 「다시보니 새로도 좋은데 … 새로가 더 예쁘고 잘생기게 나오긴하네」 →
#   「이번만 둘 다 구워서 내일 시댄스로 뽑아서 비교해보자」. 얼굴흐림은 확정 판에서 큰 얼굴(화면 높이 5% 넘게)만 흐리게 지운 판을 구도로
#   넣는다 — 얼굴을 지우지 않으면 선버스트가 확정 판 얼굴을 그대로 베끼고(닮음 그대로), 지우면 캐스팅북 사진만 보고 새로 그린다(시험:
#   2-45 이안 0.384 → 0.513 · 얼굴 크기 0.96배). 새로는 처음 지시문 그대로 굽는다(구도는 원본보다 가깝게 나옴) — 10-29에 그림만 편집으로
#   고친 컷은 그 고침을 지시문 줄로 더한다(FIX). 판은 길마다 git 밖 콘티/p7/<선버스트 · 선버스트_얼굴흐림 · 선버스트_새로>/.
import json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]   # 저장소 뿌리(tools/GPT콘티굽기.mjs)
V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p7")
ROUTES = {"다시그림": "선버스트", "얼굴흐림": "선버스트_얼굴흐림", "새로": "선버스트_새로"}
ROUTE = sys.argv[sys.argv.index("--길") + 1] if "--길" in sys.argv else "다시그림"
OUT = V / ROUTES[ROUTE]
SPEC = HERE / "지시문" / "이미지콘티.json"
FIX = {   # 10-29 시댄스 앞 일관성 검수에서 그림만 편집으로 고친 것 — 새로 구울 때는 지시문으로(02_콘티 8-1 표)
    "1-1": "Inside the lunchbox: the long compartment holds only plain white rice with a single red pickled plum in the middle; the square "
           "side-dish compartment is completely empty.",
    "2-16": "Her right arm is fully there from the shoulder down — no part of her body is cut off or missing.",
    "2-10e": "Nobody else is in the frame — no passing legs or feet at the edges.",
    "2-20": "Nothing floats in the air — every cup and saucer rests on the table.",
    "2-31": "The bedroom door behind is white — the same white door as in the shot before.",
    "2-42": "On the table: exactly the same items as in the close-up that follows — an A4 sheet with a black pen, two open cream-white "
            "lunchboxes with light-oak lids beside it and an open kraft-paper box; no other containers or tins.",
}
BLUR_MIN = 0.05   # 얼굴흐림: 화면 높이의 이만큼 넘는 얼굴만 지운다(작은 얼굴은 구도 단서로 남김)
SAME = {"1-12": "1-14", "1-10": "1-9"}   # 다시 그리지 않고 이 컷의 판에서 만든다
LAYOUT = [re.compile(r"Image (\d+) is a layout guide:.*?The silhouettes have no faces, clothes or colors to copy\.", re.S),
          re.compile(r"Image (\d+) is a layout guide for the camera framing:.*?ignore it\.", re.S)]
FRAMING = ("FRAMING (most important): output exactly the same framing as Image {n} — the same field of view and the same face sizes; do not zoom "
           "in, do not crop tighter and do not move the camera closer. Everything visible at the edges of Image {n} stays visible at the same place.")
NAMES = {"S": "서진", "I": "이안", "M": "민재", "Y": "소연"}
DRIFT = 1.12   # 다시 그린 판의 얼굴이 확정 판보다 이만큼 넘게 크거나 작으면 다시 굽기 후보


def blur_faces(k):
    # 확정 판에서 큰 얼굴만 타원으로 흐리게 지운 구도판(얼굴흐림 길) — 머리 윤곽 · 자리 · 크기는 남는다
    import cv2, numpy as np
    sys.path.insert(0, str(HERE))
    import 이미지콘티_닮음 as 닮음
    dst = OUT / "구도판" / f"{k}.jpg"
    if dst.exists():
        return dst
    im = cv2.imdecode(np.fromfile(str(V / "정지컷" / f"{k}.jpg"), np.uint8), cv2.IMREAD_COLOR)
    h, w = im.shape[:2]
    s, out = 1200 / max(h, w), im.copy()
    for f in 닮음.faces(im):
        x, y, fw, fh = [float(v) / s for v in f[0][:4]]
        if fh / h < BLUR_MIN:
            continue
        mask = np.zeros((h, w), np.uint8)
        cv2.ellipse(mask, (int(x + fw / 2), int(y + fh * 0.45)), (int(fw * 0.75), int(fh * 0.85)), 0, 0, 360, 255, -1)
        a = (cv2.GaussianBlur(mask, (0, 0), fw * 0.08).astype(np.float32) / 255)[..., None]
        out = (out * (1 - a) + cv2.GaussianBlur(im, (0, 0), fw * 0.22) * a).astype(np.uint8)
    dst.parent.mkdir(parents=True, exist_ok=True)
    cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 93])[1].tofile(str(dst))
    return dst


def jobs(keys=None):
    d = json.load(open(SPEC, encoding="utf-8"))
    out = {}
    for k, x in d.items():
        if k.startswith("L") or k in SAME or (keys and k not in keys):
            continue
        if ROUTE == "새로":   # 처음 지시문 · 참고 그대로(배치도 실루엣) + 10-29 고침 줄
            out[k] = (x["prompt"] + (" " + FIX[k] if k in FIX else ""), [V / "ego" / "refs" / r for r in x["refs"]])
            continue
        i = next(n for n, r in enumerate(x["refs"]) if r.startswith("배치_"))
        n = i + 1
        if ROUTE == "얼굴흐림":
            new = (f"Image {n} is the approved storyboard frame of this exact shot with the faces deliberately blurred out: copy its framing, camera "
                   f"distance, height and angle, every person's position, pose, size, hair outline and clothing, and every object exactly. Paint each "
                   f"blurred face fresh from that person's identity reference photos — at exactly the same position, size and head angle — with the "
                   f"polished, attractive look of the leads in a premium Korean romance drama, sharp and in focus. Re-render the whole frame as a "
                   f"high-end film still: cinematic, flattering light and depth of field.")
            comp = blur_faces(k)
        else:
            new = (f"Image {n} is the approved storyboard frame of this exact shot: copy its framing, camera distance, height and angle, every "
                   f"person's position, pose, size and clothing, and every object exactly — change nothing about what is in the frame or where. "
                   f"Only re-render it as a high-end Korean romance-drama film still: cinematic light and depth of field, natural skin texture, true "
                   f"colors; keep every face exactly as in that person's identity reference photos.")
            comp = V / "정지컷" / f"{k}.jpg"
        p = x["prompt"]
        for pat in LAYOUT:
            m = pat.search(p)
            if m and int(m.group(1)) == n:
                p = p[:m.start()] + new + p[m.end():]
                break
        else:
            raise SystemExit(f"{k}: 배치도 문장을 못 찾음")
        refs = [comp if j == i else V / "ego" / "refs" / r for j, r in enumerate(x["refs"])]
        out[k] = (p + " " + FRAMING.format(n=n), refs)
    return out


def bake(keys, again):
    todo = {k: v for k, v in jobs(keys).items() if again or not (OUT / "받음" / f"{k}.png").exists()}
    (OUT / "받음").mkdir(parents=True, exist_ok=True)
    (OUT / "지시문").mkdir(parents=True, exist_ok=True)

    def one(item):
        k, (prompt, refs) = item
        txt = OUT / "지시문" / f"{k}.txt"
        txt.write_text(prompt, encoding="utf-8")
        r = subprocess.run(["node", str(ROOT / "tools" / "GPT콘티굽기.mjs"), str(txt), str(OUT / "받음" / f"{k}.png"), *map(str, refs),
                            "--크기", "1152x2048", "--덮어쓰기"], capture_output=True, text=True, encoding="utf-8")
        return k, r.returncode, (r.stdout + r.stderr).strip().splitlines()[-1:] or [""]

    print(f"굽기 {len(todo)}장 → {OUT / '받음'}", flush=True)
    with ThreadPoolExecutor(3) as ex:
        for k, code, last in ex.map(one, sorted(todo.items())):
            print(f"{k}: {'✓' if code == 0 else f'✗ 종료 {code}'} {last[0][-80:]}", flush=True)
            if code == 3:   # 마지막 키까지 크레딧 바닥 — 돈 드는 길로 돌리지 않는다(결정 10-29)
                raise SystemExit("API 크레딧 바닥 — 멈춤")


def fit(keys):
    sys.path.insert(0, str(HERE))
    import 이미지콘티_맞춤 as M
    M.V = OUT
    (OUT / "정지컷").mkdir(parents=True, exist_ok=True)
    log_p = OUT / "정지컷" / "_맞춤.json"
    log = json.load(open(log_p, encoding="utf-8")) if log_p.exists() else {}
    cuts = [k for k in json.load(open(SPEC, encoding="utf-8")) if not k.startswith("L")]
    for k in keys or cuts:
        src = OUT / "받음" / f"{SAME.get(k, k)}.png"
        if not src.exists():
            print(f"{k}: 받은 판 없음")
            continue
        log[k] = M.fit(k, src)
        print(k, log[k].get("판정"), log[k].get("배율"), flush=True)
    json.dump(log, open(log_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def measure():
    import cv2, numpy as np
    sys.path.insert(0, str(HERE))
    import 이미지콘티_닮음 as 닮음
    d = json.load(open(SPEC, encoding="utf-8"))
    fits = json.load(open(OUT / "정지컷" / "_맞춤.json", encoding="utf-8"))

    def sim(path, who):
        im = cv2.imdecode(np.fromfile(str(path), np.uint8), cv2.IMREAD_COLOR)
        fs = 닮음.faces(im)
        return round(max([float(np.mean([닮음.FR.match(f[1], r, cv2.FaceRecognizerSF_FR_COSINE) for r in 닮음.REF[who]])) for f in fs] or [0.0]), 3)

    def face_h(path, who):   # 그 배역 얼굴 높이(화면 높이에 대한 비)
        im = cv2.imdecode(np.fromfile(str(path), np.uint8), cv2.IMREAD_COLOR)
        fs = 닮음.faces(im)
        if not fs or who not in 닮음.REF:
            return None
        best = max(fs, key=lambda f: np.mean([닮음.FR.match(f[1], r, cv2.FaceRecognizerSF_FR_COSINE) for r in 닮음.REF[who]]))
        return float(best[0][3]) / (1200 / max(im.shape[:2])) / im.shape[0]

    sys.path.insert(0, str(HERE))
    import 이미지콘티_맞춤 as M
    res, flag = {}, []
    for k, x in d.items():
        new = OUT / "정지컷" / f"{k}.jpg"
        if k.startswith("L") or not new.exists():
            continue
        who = [NAMES[c] for c in (x.get("who") or "") if c in NAMES]
        row = {"닮음": {w: [sim(V / "정지컷" / f"{k}.jpg", w), sim(new, w)] for w in who}, "배율": fits.get(k, {}).get("배율")}
        # 지금 판은 같은 사람(0.363 위)이었는데 새 판이 그 밑이거나, 크게(0.1 넘게) 떨어진 배역
        bad = [f"{w} 닮음 {a:.2f}→{b:.2f}" for w, (a, b) in row["닮음"].items() if (a >= 0.363 > b) or b < a - 0.1]
        # 구도는 확정 판과 견준다(원본과 견주면 확정 판부터 가까웠던 컷이 걸린다 — 10-30 첫 재기의 9컷)
        _, tw = M.target(k)
        if tw:
            a, b = face_h(V / "정지컷" / f"{k}.jpg", tw), face_h(new, tw)
            if a and b:
                row["얼굴크기비"] = round(b / a, 2)
                if not 1 / DRIFT <= b / a <= DRIFT:
                    bad.append(f"얼굴이 확정 판의 {b / a:.2f}배")
        row["알림"] = bad
        res[k] = row
        if bad:
            flag.append(k)
        print(f"{k:<6} " + " · ".join(f"{w} {a:.2f}→{b:.2f}" for w, (a, b) in row["닮음"].items()) + (f"  ⚠ {bad}" if bad else ""), flush=True)
    json.dump(res, open(OUT / "_재기.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"알림 {len(flag)}컷: {flag}")


def boards():
    from PIL import Image, ImageDraw, ImageFont
    d = [k for k in json.load(open(SPEC, encoding="utf-8")) if not k.startswith("L")]
    res = json.load(open(OUT / "_재기.json", encoding="utf-8")) if (OUT / "_재기.json").exists() else {}
    font = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 26)
    small = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 20)
    (OUT / "보드").mkdir(parents=True, exist_ok=True)
    w, h, per = 300, 533, 8
    for ep in ("1", "2"):
        ks = [k for k in d if k.split("-")[0] == ep]
        for n in range(0, len(ks), per):
            part = ks[n:n + per]
            cols = 4
            rows = (len(part) + cols - 1) // cols
            b = Image.new("RGB", (cols * (2 * w + 30) + 10, rows * (h + 70) + 10), (18, 18, 20))
            dr = ImageDraw.Draw(b)
            for i, k in enumerate(part):
                x0, y0 = 10 + (i % cols) * (2 * w + 30), 10 + (i // cols) * (h + 70)
                for j, p in enumerate([V / "정지컷" / f"{k}.jpg", OUT / "정지컷" / f"{k}.jpg"]):
                    if p.exists():
                        b.paste(Image.open(p).convert("RGB").resize((w, h)), (x0 + j * (w + 6), y0 + 40))
                r = res.get(k, {})
                tag = " · ".join(f"{a} {v[0]:.2f}→{v[1]:.2f}" for a, v in r.get("닮음", {}).items())
                dr.text((x0, y0 + 2), k, font=font, fill=(255, 210, 120) if r.get("알림") else (240, 240, 240))
                dr.text((x0 + 90, y0 + 8), tag, font=small, fill=(190, 200, 210))
            b.save(OUT / "보드" / f"{ep}화_{n // per + 1:02d}.jpg", quality=85)
    print(f"보드 → {OUT / '보드'}")


if __name__ == "__main__":
    args = sys.argv[2:]
    if "--길" in args:
        del args[args.index("--길"):args.index("--길") + 2]
    cmd, rest = sys.argv[1], [a for a in args if not a.startswith("--")]
    if cmd == "굽기":
        bake(rest or None, "--다시" in sys.argv)
    elif cmd == "맞춤":
        fit(rest)
    elif cmd == "재기":
        measure()
    elif cmd == "판":
        boards()

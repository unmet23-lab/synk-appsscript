# 자막 시안 — GPU가 줄 밖 작업(학습)에 묶였을 때 CPU rembg(isnet)로 컷마다 피사체(개 · 사람) 알파를 딴다. 사람개분리.py(SAM 3)와 같은 자리에 쓴다.
#   python -X utf8 피사체따기_rembg.py p11 c01 c04 …   → public/<편>/cut/<컷>/f · m · report.json
import json, subprocess, sys, tempfile, time
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

PUB = Path("C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/자막시안_public")
FPS = 24
# p11 c05 · c07 · c08(11-03 밤): 「튼튼」 · 「번쩍」이 남자 머리 · 민소매 위에 얹혀 묻혀서(가림검사.py) 뒤로 보낼 자리를 찾으려고 더 땄다
JOBS = {"p11": {"c01": (0.00, 2.17), "c04": (6.50, 11.23), "c05": (11.23, 12.83), "c07": (13.47, 14.90), "c08": (14.90, 16.27), "c09": (16.27, 19.33), "c10": (19.33, 22.06)},
        # p12 전 컷(11-03 밤 「세 편에 넣기」): 컷마다 「그 사람 마주침」 큰 숫자를 남자 뒤에 둔다 — 컷 경계는 comedy-montage 최종편집.py T
        "p12": {f"c{n:02d}": (a, b) for n, (a, b) in enumerate(zip([0, 1.87, 3.87, 7.20, 11.73, 15.10, 18.30, 21.77, 22.87, 27.07, 27.77, 28.47, 29.17, 29.87, 30.57, 31.27],
                                                                  [1.87, 3.87, 7.20, 11.73, 15.10, 18.30, 21.77, 22.87, 27.07, 27.77, 28.47, 29.17, 29.87, 30.57, 31.27, 35.14]), 1)},
        # 매진 임박(16:9 화면) — 강도 컷 둘(2 「내놔!」 · 23 「한국말이야?」)에만 큰 글자를 강도 뒤에 둔다. 컷 경계는 원본_샷.json
        "hs": {"c02": (0.54, 1.38), "c23": (41.33, 45.75)}}
film, cuts = sys.argv[1], sys.argv[2:]
sess = new_session("isnet-general-use")
for cut in cuts:
    a, b = JOBS[film][cut]
    out = PUB / film / "cut" / cut
    (out / "f").mkdir(parents=True, exist_ok=True); (out / "m").mkdir(parents=True, exist_ok=True)
    t0 = time.monotonic()
    with tempfile.TemporaryDirectory() as tmp:
        n = round((b - a) * FPS)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.4f}", "-i", str(PUB / film / "picture.mp4"), "-frames:v", str(n), "-vf", f"fps={FPS}", "-q:v", "2", str(Path(tmp) / "%05d.jpg")], check=True)
        stats, prev = [], None
        for i, p in enumerate(sorted(Path(tmp).glob("*.jpg"))):
            im = Image.open(p).convert("RGB")
            im.save(out / "f" / f"{i + 1:05}.jpg", quality=92)
            small = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)   # 반 크기(세로 540×960 · 가로 960×540)
            m = remove(small, session=sess, only_mask=True)
            arr = np.array(m) > 127
            iou = float(np.logical_and(arr, prev).sum() / max(1, np.logical_or(arr, prev).sum())) if prev is not None else 1.0
            prev = arr
            alpha = m.resize(im.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.2))
            rgba = Image.new("RGBA", im.size, "white"); rgba.putalpha(alpha); rgba.save(out / "m" / f"{i + 1:05}.png")
            stats.append({"frame": i + 1, "area": round(float(arr.mean()), 4), "iou": round(iou, 4)})
    rep = {"cut": cut, "from": a, "to": b, "engine": "rembg isnet-general-use (CPU)", "frames": len(stats), "minIou": min(s["iou"] for s in stats), "minArea": min(s["area"] for s in stats), "maxArea": max(s["area"] for s in stats), "stats": stats}
    (out / "report.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    print("MASKED", film, cut, len(stats), "minIoU", rep["minIou"], "area", rep["minArea"], rep["maxArea"], round(time.monotonic() - t0), "s", flush=True)
# Remotion이 읽는 목록(마스크가 있는 컷만)
lst = []
for rep in sorted((PUB / film / "cut").glob("*/report.json")):
    r = json.loads(rep.read_text(encoding="utf-8"))
    if r["maxArea"] > 0.02:
        lst.append({"cut": r["cut"], "from": r["from"], "to": r["to"], "frames": r["frames"]})
dst = Path(__file__).resolve().parent / "remotion" / "src" / film / "masks.json"
dst.write_text(json.dumps(lst, ensure_ascii=False, indent=1), encoding="utf-8")
print("LIST", dst, len(lst))

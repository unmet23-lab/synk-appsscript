# 세일 편 — 벽 화면 글자(전광판 · 끝 시계)를 채원 머리 뒤로 보내려고 그 컷의 사람 알파를 딴다(2026-11-07). 자막시안_20261103/피사체따기_rembg.py와 같은 길(CPU rembg isnet),
# 공용 파일의 JOBS를 고치지 않으려고 편 폴더에 둔다.   python -X utf8 피사체따기.py   → public/s3/<판>/cut/<컷>/f · m · report.json + src/s3/masks_<판>.json
import json
import math
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

PUB = Path("C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/자막시안_public/s3")
SRC = Path(__file__).resolve().parent.parent / "자막시안_20261103" / "remotion" / "src" / "s3"
PIC = Path("C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/s3")
FPS = 24
JOBS = {"15": {"c01": (0.00, 0.96), "c13": (12.56, 14.30)}, "6": {"c01": (0.00, 0.90), "c05": (4.60, 5.38)}}   # 끝은 11-07 판 휙 시작 + 0.12초까지(시계가 밀려 나가는 동안 머리가 앞에)


def main():
    sess = new_session("isnet-general-use")
    for name, cuts in JOBS.items():
        rows = []
        for cut, (a, b) in cuts.items():
            out = PUB / name / "cut" / cut
            (out / "f").mkdir(parents=True, exist_ok=True)
            (out / "m").mkdir(parents=True, exist_ok=True)
            t0 = time.monotonic()
            # 첫 장은 lib/subject.tsx의 startF(⌈초 × 24⌉)와 같게 — 반올림으로 뽑았더니 시작이 정수 장이 아닌 끝 컷(12.56 · 4.60초)에서
            # 가림이 한 장 늦어 주먹을 휘두를 때 사람이 겹쳐 보였다(11-07)
            fa = math.ceil(a * FPS - 1e-6)
            n = round(b * FPS) - fa
            with tempfile.TemporaryDirectory() as tmp:
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(PIC / f"화면_{name}.mp4"), "-vf", f"select='between(n,{fa},{fa + n - 1})',setpts=N/{FPS}/TB",
                                "-frames:v", str(n), "-q:v", "2", str(Path(tmp) / "%05d.jpg")], check=True)
                stats = []
                for i, p in enumerate(sorted(Path(tmp).glob("*.jpg"))):
                    im = Image.open(p).convert("RGB")
                    im.save(out / "f" / f"{i + 1:05}.jpg", quality=92)
                    m = remove(im.resize((im.width // 2, im.height // 2), Image.LANCZOS), session=sess, only_mask=True)
                    alpha = m.resize(im.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.2))
                    rgba = Image.new("RGBA", im.size, "white")
                    rgba.putalpha(alpha)
                    rgba.save(out / "m" / f"{i + 1:05}.png")
                    stats.append(round(float((np.array(m) > 127).mean()), 4))
            json.dump({"cut": cut, "from": a, "to": b, "frames": len(stats), "area": stats}, open(out / "report.json", "w"))
            rows.append({"cut": cut, "from": a, "to": b, "frames": len(stats)})
            print(f"{name} {cut}: {len(stats)}장 · 면적 {min(stats):.3f}~{max(stats):.3f} · {time.monotonic() - t0:.0f}초")
        SRC.mkdir(parents=True, exist_ok=True)
        json.dump(rows, open(SRC / f"masks_{name}.json", "w"))


if __name__ == "__main__":
    main()

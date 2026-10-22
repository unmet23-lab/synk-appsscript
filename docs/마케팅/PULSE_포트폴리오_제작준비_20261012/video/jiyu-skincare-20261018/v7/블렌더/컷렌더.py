# 지유 광고 v7 · 블렌더 제품 컷 여섯을 차례로 최종 렌더(2026-10-21, Fable 룩 검수 판4 통과 뒤).
#   python 컷렌더.py [P1 P3 …] [--quality final|mid] [--frames 1-5]
#   → Documents/synk-vendor/jiyu-skincare-20261018/v7/블렌더/<컷 이름>/<컷>_0001.png … (1080×1920 · 24fps 프레임 열), 기록 _렌더기록.log
# 컷마다 블렌더를 따로 띄운다(한 컷이 죽어도 다음 컷은 돈다). 이미 있는 프레임은 건너뛴다 — 끊겨도 다시 부르면 이어 간다.
import os
import subprocess
import sys
import time

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
SCENE = os.path.join(HERE, "병A2_장면.py")
BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
OUT = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018", "v7", "블렌더")
CUTS = {"P1": ("P1_공개", 36), "P3": ("P3_방울", 36), "P4": ("P4_물높이", 48),
        "P6": ("P6_라벨접사", 36), "P8": ("P8_위에서", 24), "P9": ("P9_팩샷", 72)}


def main():
    args = sys.argv[1:]
    q = args[args.index("--quality") + 1] if "--quality" in args else "final"
    only = args[args.index("--frames") + 1] if "--frames" in args else ""
    pick = [a for a in args if a in CUTS] or list(CUTS)
    log = open(os.path.join(OUT, "_렌더기록.log"), "a", encoding="utf-8")
    for c in pick:
        name, n = CUTS[c]
        d = os.path.join(OUT, name)
        os.makedirs(d, exist_ok=True)
        if only:
            todo = only
        else:
            missing = [f for f in range(1, n + 1) if not os.path.exists(os.path.join(d, f"{c}_{f:04d}.png"))]
            if not missing:
                print(c, "다 있음")
                continue
            todo = ",".join(str(f) for f in missing)
        t0 = time.time()
        r = subprocess.run([BLENDER, "-b", "--python", SCENE, "--", "--cut", c, "--quality", q, "--out", d, "--frames", todo],
                           capture_output=True, text=True, encoding="utf-8", errors="ignore")
        done = r.stdout.count("RENDERED")
        line = f"{time.strftime('%H:%M:%S')} {c} {q} {done}장 {time.time() - t0:.0f}초 코드 {r.returncode}"
        print(line, flush=True)
        log.write(line + "\n")
        log.flush()
        if r.returncode != 0:
            log.write(r.stdout[-3000:] + r.stderr[-3000:] + "\n")


if __name__ == "__main__":
    main()

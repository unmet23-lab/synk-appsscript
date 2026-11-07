# 받은 판이 4장마다 같은 장을 되풀이하는지 잰다(2026-11-07) — 현장노트 브라우저_게시 「CLI: 첫 · 끝 프레임 판의 일곱에 하나꼴이 …」의 자.
# 드리미나 시댄스 2.5 판 일부가 내용 18장/초를 24장/초로 채워(4장마다 한 장이 앞 장과 거의 같음) 움직이는 자리에서 초당 여섯 번 멈칫한다.
#   python -X utf8 겹친장.py <mp4 …>            → 판마다 위상 점수 · 걸린 1초 창(그 창의 움직임) · 판정
# 실제 장을 passthrough로 읽어(드리미나 파일은 머리 60 fps · 실제 24) 160×90 회색 이웃 장 차이를 낸다. 1초 창(24장, 0.5초씩 밀며)마다 차이를 4로 나눈
# 자리(위상)별 중앙값을 내고 「가장 낮은 위상 ÷ 나머지 위상 중앙값」이 0.4 아래면 그 창은 무늬다. 판 전체 문턱(둘레 중앙값의 25%)만 보면 움직임이 적은 판
# (이웃 장 차이 중앙 0.2~0.35)을 놓쳤다. 걸린 창의 움직임(나머지 위상 중앙값)이 0.5를 넘는 창이 둘 이상(1초 넘게)이면 눈에 보이는 멈칫으로 보고 다시 낸다 —
# 그 아래는 거의 멈춘 화면이고, 한 창만 걸린 판(rs-C60m 1.0초)은 흩어진 몇 장이다.
import os
import subprocess
import sys

import numpy as np

W, H, WIN, STEP, CUT, SEEN = 160, 90, 24, 12, 0.4, 0.5


def diffs(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-fps_mode", "passthrough", "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"],
                         capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
    return np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))


def windows(d):
    out = []
    for w0 in range(0, max(1, len(d) - WIN), STEP):
        w = d[w0:w0 + WIN]
        ph = [float(np.median(w[k::4])) for k in range(4)]
        lo = int(np.argmin(ph))
        rest = float(np.median([ph[k] for k in range(4) if k != lo]))
        out.append((w0 / 24, ph[lo] / rest if rest > 0.15 else 1.0, rest))
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    for p in sys.argv[1:]:
        d = diffs(p) if os.path.exists(p) else np.array([])
        if len(d) < 8:
            print(f"{os.path.basename(p):<24} 못 읽음(파일이 없거나 장이 모자람)", flush=True)
            continue
        ws = windows(d)
        hit = [(t, m) for t, r, m in ws if r < CUT]
        seen = [(t, m) for t, m in hit if m >= SEEN]
        verdict = "다시 냄(움직이는 자리에서 멈칫)" if len(seen) >= 2 else "움직이는 창 하나뿐 — 둠" if seen else "거의 멈춘 화면에서만 — 둠" if hit else "없음"
        print(f"{os.path.basename(p):<24} 창 {len(hit)}/{len(ws)} · 이웃차 중앙 {np.median(d):.2f} · {verdict}"
              + (f" · 걸린 창 {' '.join(f'{t:.1f}s({m:.2f})' for t, m in hit)}" if hit else ""), flush=True)


if __name__ == "__main__":
    main()

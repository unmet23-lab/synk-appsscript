'use strict';
// 흐름(컷 안 탈것 · 배경 움직임) 시험의 합성 영상 — tests/최종본검사.test.js와 tests/받은뒤검사.test.js가 함께 쓴다(11-16).
// 고정된 무늬 바탕(640×360, 24fps) 위에 무늬 네모(차) · 무늬 원판(바퀴)을 움직인다. 종류:
//   갈림     가운데 띠의 두 차가 반대로 간다(흐름갈림)            같은방향  두 차가 같은 쪽으로 간다
//   멈춤     위 띠의 차가 1.3~2.5초에 섰다가 다시 간다(멈췄다감)   고른      고르게 간다          출발  1.5초까지 서 있다가 처음 출발한다
//   바퀴     바퀴만 돌고 바탕이 서 있다(제자리바퀴)                 바퀴흐름  바퀴가 돌고 바탕도 흐른다
//   앞갈림   2.5초까지 두 차가 반대로 가다가 그 자리에 선다 — 받은 판의 앞쪽 버리는 구간에만 흠이 있는 판
//   아래갈림 화면 아래쪽(270~350줄)의 두 차가 반대로 간다 — 편집이 위쪽 띠만 잘라 쓰면 보이지 않는 흠(컷표 「창」 시험)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const 합성 = String.raw`
import sys, subprocess, numpy as np, cv2
kind, out = sys.argv[1], sys.argv[2]
W, H, FPS = 640, 360, 24
DUR = float(sys.argv[3]) if len(sys.argv) > 3 else 4.5
def tex(h, w, seed):
    r = np.random.default_rng(seed).integers(0, 256, (h, w)).astype(np.float32)
    r = cv2.GaussianBlur(r, (0, 0), 1.2)
    return np.clip((r - r.mean()) / (r.std() + 1e-6) * 50 + 128, 0, 255).astype(np.uint8)
bg, car, wheel = tex(H, W * 3, 1), tex(80, 160, 2), tex(220, 220, 3)
yy, xx = np.mgrid[0:220, 0:220]
disc = (xx - 110) ** 2 + (yy - 110) ** 2 <= 105 ** 2
def paste(f, img, x, y):
    x = int(round(x)); x0, x1 = max(0, x), min(W, x + img.shape[1])
    if x1 > x0: f[y:y + img.shape[0], x0:x1] = img[:, x0 - x:x1 - x]
def stopgo(t, stop):
    a, b = stop
    return 40 + 48 * (min(t, a) + max(0.0, t - b))
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', out], stdin=subprocess.PIPE)
for n in range(int(DUR * FPS)):
    t = n / FPS
    off = int(round(90 * t)) if kind == '바퀴흐름' else 0
    f = bg[:, off:off + W].copy()
    if kind == '갈림':
        paste(f, car, 120 - 25 * t, 150); paste(f, car, 360 + 25 * t, 150)
    elif kind == '앞갈림':
        u = min(t, 2.5)
        paste(f, car, 120 - 25 * u, 150); paste(f, car, 360 + 25 * u, 150)
    elif kind == '아래갈림':
        paste(f, car, 120 - 25 * t, 270); paste(f, car, 360 + 25 * t, 270)
    elif kind == '같은방향':
        paste(f, car, 60 + 25 * t, 150); paste(f, car, 360 + 25 * t, 150)
    elif kind == '멈춤':
        paste(f, car, stopgo(t, (1.3, 2.5)), 20)
    elif kind == '고른':
        paste(f, car, 40 + 48 * t, 20)
    elif kind == '출발':
        paste(f, car, 40 + 48 * max(0.0, t - 1.5), 20)
    elif kind in ('바퀴', '바퀴흐름'):
        w = cv2.warpAffine(wheel, cv2.getRotationMatrix2D((110, 110), float(np.degrees(2.0 * t)), 1.0), (220, 220), borderMode=cv2.BORDER_REFLECT)
        sub = f[70:290, 210:430]; sub[disc] = w[disc]
    p.stdin.write(f.tobytes())
p.stdin.close(); p.wait()
`;

/** 합성 영상 하나를 만든다 → 영상 경로. 자리를 주지 않으면 임시 폴더를 만들고 시험이 끝나면 지운다 */
function 흐름영상(t, kind, { py = 'python', 자리 = null, 길이 = null } = {}) {
  let out = 자리;
  if (!out) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), '흐름합성-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    out = path.join(dir, `${kind}.mp4`);
  }
  const gen = path.join(os.tmpdir(), `흐름합성-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.py`);
  fs.writeFileSync(gen, 합성);
  try {
    execFileSync(py, ['-I', '-X', 'utf8', gen, kind, out, ...(길이 ? [String(길이)] : [])], { stdio: 'pipe' });
  } finally {
    fs.rmSync(gen, { force: true });
  }
  return out;
}

module.exports = { 합성, 흐름영상 };

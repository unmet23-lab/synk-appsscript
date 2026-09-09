"""승인된 추석 무대의 실제 픽셀을 국소 변형하여 60초 무음 반복 영상으로 만든다.

카메라·건물·마당·로고는 고정. 달의 섬유와 구름, 감나무 끝, 창 안의 빛만 움직인다.
새 그림을 그리지 않으며 소스는 서버의 승인된 720p 배경 프레임이다.
python tools/라디오자연무대.py [--preview] [--seconds 60]
"""
import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/Loom_자산/라디오생동/추석_기준.png'
OUTPUT = ROOT / 'docs/라디오/무대영상/추석_자연생동_20260909.mp4'
QA = ROOT / 'docs/_ops/라디오생동_20260909'
PERIOD = 60.0


def smoothstep(a, b, x):
    p = np.clip((x - a) / (b - a), 0, 1)
    return p * p * (3 - 2 * p)


class Stage:
    def __init__(self):
        self.base = cv2.imdecode(np.frombuffer(SOURCE.read_bytes(), np.uint8), cv2.IMREAD_COLOR)
        if self.base is None or self.base.shape != (720, 1280, 3):
            raise ValueError('무대 기준은 승인된 1280×720 프레임이어야 한다')
        self.y, self.x = np.mgrid[0:720, 0:1280].astype(np.float32)
        self.mx, self.my = self.x - 896, self.y - 145
        radius = np.hypot(self.mx, self.my)
        self.moon = 1 - smoothstep(79, 122, radius)
        self.cloud = np.exp(-(((self.x - 966) / 140) ** 2 + ((self.y - 119) / 19) ** 2) * 2)
        self.cloud *= 1 - smoothstep(0.20, 0.70, self.moon)
        # 윗 가지가 흔들리고 몸통으로 갈수록 잠잠해진다. 회색 기와는 제외한다.
        area = np.zeros((720, 1280), np.uint8)
        polygon = np.array([[1116, 147], [1199, 102], [1279, 97], [1279, 306],
                            [1205, 284], [1139, 218]], np.int32)
        cv2.fillPoly(area, [polygon], 255)
        b, g, r = cv2.split(self.base.astype(np.float32))
        warm = smoothstep(1.08, 1.38, r / np.maximum(b, 1))
        self.tree = cv2.GaussianBlur(area.astype(np.float32) / 255 * warm, (0, 0), 3)
        self.tree *= np.clip((325 - self.y) / 175, 0, 1) ** 1.2
        # 기와 앞의 굵은 가지는 고정하고 하늘에 드러난 윗가지·잎·감만 살랑인다.
        # 따뜻한 조명을 받은 회색 기와도 색 조건을 통과하므로 기하 경계로 분리한다.
        self.tree *= 1 - smoothstep(181, 197, self.y)
        self.windows = []
        for rect in [(204, 322, 265, 388), (339, 322, 403, 388),
                     (1119, 331, 1135, 402), (1190, 329, 1225, 406)]:
            x1, y1, x2, y2 = rect
            mask = np.zeros((720, 1280), np.float32)
            mask[y1:y2, x1:x2] = 1
            # 실제 발광 픽셀만 고른다. 창살이나 벽까지 밝히지 않는다.
            mask *= smoothstep(110, 190, r) * smoothstep(1.3, 2.4, r / np.maximum(b, 1))
            self.windows.append(cv2.GaussianBlur(mask, (0, 0), 0.8))
        self.moving = (self.moon + self.cloud + self.tree + sum(self.windows)) > 0.001

    def render(self, t):
        p = 2 * math.pi * ((t % PERIOD) / PERIOD)
        # 완전히 한 바퀴 돌리는 장난감 느낌을 피하는 느린 섬유 회전. ±3.2도.
        angle = math.radians(3.2) * math.sin(p)
        c, s = math.cos(angle), math.sin(angle)
        dx = (self.mx * c - self.my * s - self.mx) * self.moon
        dy = (self.mx * s + self.my * c - self.my) * self.moon
        dx += self.cloud * (3.8 * math.sin(p * 2 + .45))
        dy += self.cloud * (.65 * math.sin(p * 2 - .4))
        breeze = (2.7 * math.sin(p * 6 + .3) + .75 * math.sin(p * 11 - .8))
        dx += self.tree * breeze
        dy += self.tree * (.65 * math.sin(p * 6 -.5) + .22 * math.sin(p * 11 - 1.4))
        frame = cv2.remap(self.base, self.x + dx.astype(np.float32), self.y + dy.astype(np.float32),
                          cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT_101).astype(np.float32)
        gain = np.zeros((720, 1280), np.float32)
        for i, mask in enumerate(self.windows):
            phase = [0.2, 2.1, 4.5, 5.6][i]
            # 각각 다른 박자, 꺼짐/켜짐 대신 촛불 같은 부드러운 7~12% 변화.
            glow = .085 * math.sin(p * (4 + i) + phase) + .027 * math.sin(p * (13 + i * 2) + phase * .7)
            gain += mask * glow
        frame *= (1 + gain[..., None])
        return np.clip(np.rint(frame), 0, 255).astype(np.uint8)


def save_png(path, frame):
    path.write_bytes(cv2.imencode('.png', frame)[1].tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', action='store_true')
    ap.add_argument('--seconds', type=float, default=60)
    args = ap.parse_args()
    QA.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    stage = Stage()
    first, end = stage.render(0), stage.render(60)
    assert np.array_equal(first, end), '반복 이음매가 맞지 않는다'
    frames = [stage.render(t) for t in [0, 3, 7, 15, 30, 45, 59 + 29/30]]
    static = np.ones((720, 1280), bool)
    static[:310, 720:] = False
    for m in stage.windows:
        static[m > 0] = False
    fixed_difference = max(int(np.abs(f.astype(np.int16) - first.astype(np.int16))[static].max()) for f in frames)
    assert fixed_difference == 0, f'고정해야 할 건물/마당/로고가 움직인다: {fixed_difference}'
    for x1, y1, x2, y2 in [(1150, 228, 1180, 240), (1150, 232, 1160, 240), (1190, 235, 1210, 244)]:
        assert all(np.array_equal(f[y1:y2, x1:x2], first[y1:y2, x1:x2]) for f in frames), '기와가 나무와 함께 움직인다'
    for t, frame in zip([0, 3, 7, 15, 30, 45, 59.9667], frames):
        save_png(QA / f'배경_{t:07.3f}.png', frame)
    report = {
        'source': str(SOURCE.relative_to(ROOT)), 'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'duration': args.seconds, 'fps': 30, 'size': [1280, 720], 'cycle_seconds': PERIOD,
        'seam_pixel_max_difference': int(np.abs(first.astype(int) - end.astype(int)).max()),
        'fixed_building_ground_logo_pixel_difference': fixed_difference,
        'motion': {'moon_degrees': 3.2, 'cloud_max_px': 3.8, 'branch_max_px': 3.45,
                   'window_brightness_max_fraction': .112},
        'frame_mean_differences': [float(np.abs(f.astype(float)-first).mean()) for f in frames],
    }
    (QA / '배경검증.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False), flush=True)
    if args.preview:
        return
    ff = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo',
                           '-pix_fmt', 'bgr24', '-s', '1280x720', '-r', '30', '-i', '-', '-an',
                           '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
                           '-g', '60', '-movflags', '+faststart', str(OUTPUT)], stdin=subprocess.PIPE)
    try:
        for k in range(round(args.seconds * 30)):
            ff.stdin.write(stage.render(k / 30).tobytes())
            if k % 300 == 0:
                print(f'무대 {k//30}/{args.seconds:g}초', flush=True)
    finally:
        ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError('ffmpeg 인코딩 실패')
    print(f'완료: {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)', flush=True)


if __name__ == '__main__':
    main()

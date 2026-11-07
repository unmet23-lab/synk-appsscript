"""드리미나 받은 판을 v36 조립에 쓸 24fps 1080×1920 사본으로 옮기고, 대사 구간을 소리 크기 곡선으로 잰다(11-07).
드리미나 파일 머리는 60fps라고 적혀 있어(실제 24) 그대로 넣으면 조립 스크립트가 길이를 잘못 읽는다(현장노트 영상 · 11-06).
받아쓰기 낱말 시각은 0.7~0.9초 이르므로 쓰지 않고, 50ms 창 소리 크기가 최고보다 14dB 낮은 선을 넘는 구간을 말소리로 본다.
  python -X utf8 새판_24fps.py <받은 mp4> <나갈 mp4>
"""
import subprocess
import sys

import numpy as np

src, out = sys.argv[1], sys.argv[2]
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', 'fps=24,scale=1080:1920:flags=lanczos,setsar=1', '-r', '24',
                '-c:v', 'libx264', '-crf', '12', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', out], check=True)
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', out, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
x = np.frombuffer(raw, np.int16).astype(float) / 32768
w = 800
db = np.array([20 * np.log10(np.sqrt((x[i:i + w] ** 2).mean()) + 1e-9) for i in range(0, len(x) - w, w)])
on = db > db.max() - 14
spans, s = [], None
for i, v in enumerate(on):
    if v and s is None:
        s = i
    if not v and s is not None:
        spans.append((s * 0.05, i * 0.05))
        s = None
if s is not None:
    spans.append((s * 0.05, len(on) * 0.05))
n = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-count_packets', '-show_entries', 'stream=nb_read_packets',
                        '-of', 'csv=p=0', out], capture_output=True, text=True).stdout.strip())
print(f'{out}: {n}프레임 = {n / 24:.3f}초 · 최고 {db.max():.1f}dB')
print('소리 구간:', ' '.join(f'{a:.2f}~{b:.2f}' for a, b in spans if b - a >= 0.1))

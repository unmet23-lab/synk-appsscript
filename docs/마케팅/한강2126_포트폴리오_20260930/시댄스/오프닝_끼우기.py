"""B18 오프닝(1080×1920 · 24fps)의 두 슬로모션 컷 자리에 새로 구운 판을 프레임 단위로 끼운다 — 소리 · 다른 장면은 원래 그대로(11-07).
까몽이 둘로 보이던 ③ 옆 컷(102~141번 장, 40장) · ④ 올려다본 컷(142~189번 장, 48장)을 가방에 빈 고리만 남은 판으로.
  python -X utf8 오프닝_끼우기.py <나갈 mp4> <③ 판 mp4> <③ 판 시작 장> <④ 판 mp4> <④ 판 시작 장>
판은 24fps 1080×1920 사본(새판_24fps.py)이어야 한다.
"""
import subprocess
import sys

import numpy as np

B18 = r'C:\Users\q1212\Videos\한강2126_새판_20261009\video\v33장면\B18_오프닝_머리_복제프레임고침.mp4'
W, H, FPS = 1080, 1920, 24
SLOTS = [(102, 40), (142, 48)]


def read(path, first, n):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f"select='between(n\\,{first}\\,{first + n - 1})',scale={W}:{H}",
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
    if len(a) != n:
        raise SystemExit(f'{path} {first}부터 {n}장을 못 읽음({len(a)}장)')
    return a


def main():
    out = sys.argv[1]
    news = [(sys.argv[2], int(sys.argv[3])), (sys.argv[4], int(sys.argv[5]))]
    total = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-count_packets', '-show_entries', 'stream=nb_read_packets',
                                '-of', 'csv=p=0', B18], capture_output=True, text=True).stdout.strip())
    repl = {}
    for (s, n), (p, f0) in zip(SLOTS, news):
        for i, fr in enumerate(read(p, f0, n)):
            repl[s + i] = fr
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', B18, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-i', B18, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '12', '-preset', 'slow', '-pix_fmt', 'yuv420p',
                            '-c:a', 'copy', '-shortest', out], stdin=subprocess.PIPE)
    sz = W * H * 3
    for k in range(total):
        buf = dec.stdout.read(sz)
        if len(buf) < sz:
            break
        enc.stdin.write(repl[k].tobytes() if k in repl else buf)
    enc.stdin.close()
    enc.wait()
    dec.wait()
    print('나감', out, f'{total}장 중 {len(repl)}장 바꿈')


if __name__ == '__main__':
    main()

# 모델 벽 영상: 받은 판에서 소리를 빼고 웹용으로 다시 담아 wall/<코드>.mp4(+ 첫 장면 .webp)에 둔다(loop/처럼 git 밖). 사용: python -X utf8 모델벽_영상만들기.py F02=vF02b M07=vM07 …
# 원본: ~/ego/pulse-casting-reel-20261104/flow/받기/ — 고른 판과 까닭은 시안/모델릴_20261104/사람별_한컷.md
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.expanduser('~/ego/pulse-casting-reel-20261104/flow/받기/')
os.makedirs(os.path.join(HERE, 'wall'), exist_ok=True)
for a in sys.argv[1:]:
    code, name = a.split('=')
    src, dst = RAW + name + '_a.mp4', os.path.join(HERE, 'wall', code + '.mp4')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-an', '-c:v', 'libx264', '-crf', '21', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dst], check=True)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', dst, '-frames:v', '1', '-q:v', '82', os.path.join(HERE, 'wall', code + '.webp')], check=True)  # 포스터는 영상 첫 장면(칸이 열릴 때 튀지 않게)
    print(code, name, round(os.path.getsize(dst) / 1e6, 2), 'MB')

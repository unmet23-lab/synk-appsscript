# 판/<앞말>칸N_*.png(앞말은 첫 인자 — v3이면 학교 복도 판) 가운데 가장 최근 것을 remotion/public/img/kN.jpg로 옮긴다(없는 칸은 앞 칸으로 임시 채움 — 첫 렌더 전 자리 보기용)
import glob, os, sys
from PIL import Image
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'img')
os.makedirs(밖, exist_ok=True)
앞말 = sys.argv[1] if len(sys.argv) > 1 else ''
앞 = None
for n in range(1, 10):
    fs = sorted(glob.glob(os.path.join(여기, f'{앞말}칸{n}_*.png')), key=os.path.getmtime)
    src = fs[-1] if fs else 앞
    if not fs:
        print(f'k{n}: 없음 — 앞 칸으로 임시')
    Image.open(src).convert('RGB').save(os.path.join(밖, f'k{n}.jpg'), quality=93)
    print(f'k{n} <- {os.path.basename(src)}')
    앞 = src

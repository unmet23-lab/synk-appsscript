"""synkbrief B23 핵심 장면 v3 (2026-11-02) — v1 · v2 심사(둘 다 넘김 · 2 — 「검은 바탕에 글자뿐, 손해가 안 보임, 이야기 없음」)를 받아
관문 조건(재연 한 컷 이하)이 허락한 한 컷을 더한다: 막 들인 키오스크 옆에서 공문과 휴대폰을 견주던 사장님이 키오스크를 돌아보며
「…폐업하면 돌려줘야 한다고?」(제미나이 앱 동영상 V1 — 시작 그림 판/키오스크옆_080512.png, 지시문/동영상_키오스크옆.txt, 받아쓰기로 말 확인).
아래쪽은 v2의 실제 화면 조각 그대로: AI 요약 굵은 줄 → 확인 질문 → 쿵, 진짜 줄 → 빨간 줄 · 노란 형광. 중얼거림이 형광 칠한 줄과 같은 말이다.

  python -I -X utf8 장면v3.py   →  장면/장면_v3.mp4(git 밖)
"""
import os, subprocess, shutil, tempfile
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
EGO = 'C:/Users/q1212/ego/synkbrief-b23-20261102'
IMG = os.path.join(HERE, '..', 'remotion', 'public', 'img')
SFX = os.path.join(HERE, '..', 'remotion', 'public', 'sfx')
OUT = os.path.join(HERE, '장면_v3.mp4')
FPS, DUR, V0 = 30, 6.0, 2.6          # 동영상 2.6~8.6초(공문을 들어 견줌 → 키오스크를 돌아봄 → 6.5~8.6초 중얼거림)
W, H = 1080, 1920
BG = (14, 14, 14)
TOP = 1060                           # 위 영상 높이

def ease(x):
    x = max(0.0, min(1.0, x)); return 1 - (1 - x) ** 3

A = Image.open(os.path.join(IMG, 'line_ai_big.png')).convert('RGB')
Q = Image.open(os.path.join(IMG, 'q_bubble.png')).convert('RGB')
B1 = Image.open(os.path.join(IMG, 'ans_b1.png')).convert('RGB')
B2 = Image.open(os.path.join(IMG, 'ans_b2.png')).convert('RGB')
Qs = Q.resize((int(Q.width * 0.8), int(Q.height * 0.8)), Image.LANCZOS)
POS = {'A': (33, TOP + 70), 'Q': (300, TOP + 190), 'B1': (64, TOP + 420), 'B2': (64, TOP + 535)}

def main():
    tmp = tempfile.mkdtemp(prefix='b23장면3_')
    vf = os.path.join(tmp, 'v')
    os.makedirs(vf)
    # 원본 720x1280 → 사장님 · 공문 · 키오스크가 든 위쪽 가운데(640x628)를 1080x1060으로
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(V0), '-t', str(DUR), '-i', os.path.join(EGO, 'V1.mp4'),
                    '-vf', f'fps={FPS},crop=640:628:60:110,scale={W}:{TOP}:flags=lanczos', os.path.join(vf, '%04d.png')], check=True, stdin=subprocess.DEVNULL)
    vids = sorted(os.listdir(vf))
    for i in range(int(FPS * DUR)):
        t = i / FPS
        c = Image.new('RGB', (W, H), BG)
        c.paste(Image.open(os.path.join(vf, vids[min(i, len(vids) - 1)])), (0, 0))
        c.paste(A, POS['A'])
        if t >= 0.4:
            q = ease((t - 0.4) / 0.18)
            c.paste(Qs, (POS['Q'][0], POS['Q'][1] + int(24 * (1 - q))))
        if t >= 0.9: c.paste(B1, POS['B1'])
        if t >= 1.05: c.paste(B2, POS['B2'])
        d = ImageDraw.Draw(c, 'RGBA')
        if t >= 1.35:
            p = ease((t - 1.35) / 0.3)
            xa, xb = POS['A'][0] + int((451 - 430) * 1.3), POS['A'][0] + int((1197 - 430) * 1.3)
            y = POS['A'][1] + int((1437 - 1405) * 1.3)
            d.line([(xa, y), (xa + (xb - xa) * p, y)], fill=(235, 64, 52, 255), width=11)
        if t >= 1.7:
            p = (t - 1.7) / 0.5
            for key, crop0, (xa, xb), r0, r1, top, start in [('B1', 725, (738, 1174), 1180, 1229, 1172, 0.0), ('B2', 40, (51, 494), 1258, 1304, 1250, 0.5)]:
                q = ease((p - start) / 0.5)
                if q <= 0: continue
                ox, oy = POS[key]
                x0 = ox + int((xa - crop0) * 1.5) - 8; x1 = ox + int((xb - crop0) * 1.5) + 8
                y0 = oy + int((r0 - top) * 1.5) - 8; y1 = oy + int((r1 - top) * 1.5) + 8
                d.rectangle([x0, y0, x0 + (x1 - x0) * q, y1], fill=(255, 214, 10, 100))
        c.save(os.path.join(tmp, f'{i:04d}.png'))
    # 소리: 동영상 소리(실내 · 3.9초부터 중얼거림) + 휙 · 쿵 · 톡 · 펜
    ev = [(0.4, 'swish.wav', 0.5), (0.9, 'thud.wav', 0.95), (1.05, 'tok.wav', 0.45), (1.35, 'pen.wav', 0.6)]
    ins = ['-ss', str(V0), '-t', str(DUR), '-i', os.path.join(EGO, 'V1.mp4')]
    flt = ['[0:a]volume=1.6[v]']
    for j, (at, f, vol) in enumerate(ev):
        ins += ['-i', os.path.join(SFX, f)]
        flt.append(f'[{j + 1}:a]volume={vol},adelay={int(at * 1000)}|{int(at * 1000)}[a{j}]')
    mix = '[v]' + ''.join(f'[a{j}]' for j in range(len(ev)))
    flt.append(f'anullsrc=r=48000:cl=stereo[z];[z]{mix}amix=inputs={len(ev) + 2}:normalize=0:duration=first[aout]')
    wav = os.path.join(tmp, 'mix.wav')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y'] + ins + ['-filter_complex', ';'.join(flt), '-map', '[aout]', '-t', str(DUR), wav],
                   check=True, stdin=subprocess.DEVNULL)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', os.path.join(tmp, '%04d.png'), '-i', wav,
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-t', str(DUR), OUT],
                   check=True, stdin=subprocess.DEVNULL)
    shutil.rmtree(tmp, ignore_errors=True)
    print(OUT)

if __name__ == '__main__':
    main()

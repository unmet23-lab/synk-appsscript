"""synkbrief B23 핵심 장면 v1 (2026-11-02) — 실제 ChatGPT 임시 채팅(휴대폰 430x932 @3x) 녹화 프레임을 세로 1080x1920으로 다시 짠다.

A 0~2.6초  요약의 「꼭 알아둘 점」(굵은 「6개월 이내에 키오스크를 설치」) 아래 입력 칸에 확인 문장이 쳐진다(실제 프레임, 약 2배 빠르게)
B 2.6초    보냄(실제 보낸 뒤 프레임)
C 2.75초~  질문 말풍선 → 3.1초 실제 답 「…6개월 안에 폐업하면 지원금을 돌려주셔야 합니다」 → 4.2초 위 요약 줄에 빨간 줄 · 아래 답에 노란 형광
그림 · 글은 모두 실제 화면 그대로 자르고 키웠다(새로 쓴 글 없음). 영상은 git 밖.

  python -I -X utf8 장면v1.py   →  장면/장면_v1.mp4
"""
import os, subprocess, shutil, tempfile
from PIL import Image, ImageDraw, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
REC = 'C:/Users/q1212/ego/synkbrief-b23-20261102/R1'
SFX = os.path.join(HERE, '..', '..', 'synkbrief_안내문한줄_20261031', 'remotion', 'public', 'sfx')
OUT = os.path.join(HERE, '장면_v1.mp4')
FPS, DUR = 30, 5.6
W, H = 1080, 1920
BG = (14, 14, 14)
K = 0.87                      # 화면 1290px → 1122px, 가운데 1080만
X0 = int((1290 * K - W) / 2)  # 21

frames = sorted(os.listdir(os.path.join(REC, 'frames')))
stamp = [(int(f.split('_')[1][:-4]), f) for f in frames]
def frame_at(ms):
    best = stamp[0][1]
    for t, f in stamp:
        if t <= ms: best = f
        else: break
    return Image.open(os.path.join(REC, 'frames', best)).convert('RGB')

def piece(im, y0, y1):
    p = im.crop((0, y0, 1290, y1)).resize((int(1290 * K), int((y1 - y0) * K)), Image.LANCZOS)
    return p.crop((X0, 0, X0 + W, p.height))

ans = Image.open(os.path.join(REC, '05_확인답.png')).convert('RGB')
Q = piece(ans, 730, 985)        # 질문 말풍선
A = piece(ans, 1085, 1320)      # 답 세 줄
S_Y, I_Y, Q_Y, A_Y = 360, 1150, 900, 1150
sx = lambda x: int(x * K) - X0

def compose(t):
    c = Image.new('RGB', (W, H), BG)
    if t < 2.6:
        real = 1214 + t / 2.6 * (6298 - 1214)
        fr = frame_at(real)
        c.paste(piece(fr, 1210, 1720), (0, S_Y))
        c.paste(piece(fr, 2470, 2745), (0, I_Y))
        z = 1 + 0.05 * (t / 2.6)
    else:
        fr = frame_at(6298)
        s = piece(fr, 1210, 1720)
        if t >= 2.75:   # 위 요약: 둘째 줄 말고는 어둡게
            dim = ImageEnhance.Brightness(s).enhance(0.45)
            keep = s.crop((0, int((1405 - 1210) * K), W, int((1545 - 1210) * K)))
            dim.paste(keep, (0, int((1405 - 1210) * K)))
            s = dim
        c.paste(s, (0, S_Y))
        if t < 2.75:
            c.paste(piece(frame_at(6743), 2470, 2745), (0, I_Y))
        else:
            c.paste(Q, (0, Q_Y))
            if t >= 3.1:
                c.paste(A, (0, A_Y + 80))
        z = 1.05
        d = ImageDraw.Draw(c, 'RGBA')
        if t >= 4.2:
            p = min(1, (t - 4.2) / 0.35)
            # 요약 줄 「6개월 이내에 키오스크를 설치해야」 빨간 줄
            y = S_Y + int((1437 - 1210) * K)
            xa, xb = sx(451), sx(1197)
            d.line([(xa, y), (xa + (xb - xa) * p, y)], fill=(235, 64, 52, 255), width=9)
        if t >= 4.45:
            p = min(1, (t - 4.45) / 0.45)
            # 답 「6개월 안에 폐업하면」 「지원금을 돌려주셔야」 노란 형광(글 뒤가 아니라 반투명 위)
            ay = A_Y + 80
            for (r0, r1, xa, xb, start) in [(1180, 1229, 738, 1174, 0.0), (1258, 1304, 51, 494, 0.5)]:
                q = max(0.0, min(1.0, (p - start) / 0.5))
                ya, yb = ay + int((r0 - 1085) * K) - 6, ay + int((r1 - 1085) * K) + 6
                xa2, xb2 = sx(xa) - 6, sx(xb) + 6
                d.rectangle([xa2, ya, xa2 + (xb2 - xa2) * q, yb], fill=(255, 214, 10, 95))
    if z != 1:
        big = c.resize((int(W * z), int(H * z)), Image.LANCZOS)
        ox, oy = (big.width - W) // 2, int((big.height - H) * 0.42)
        c = big.crop((ox, oy, ox + W, oy + H))
    return c

def main():
    tmp = tempfile.mkdtemp(prefix='b23장면_')
    n = int(FPS * DUR)
    for i in range(n):
        compose(i / FPS).save(os.path.join(tmp, f'{i:04d}.png'))
    # 소리: 글자마다 tick(실제 프레임에서 글자가 늘어난 때 ÷ 2배속), 보냄 swish, 말풍선 pop, 답 thud, 줄 pen
    check = "'6개월'이 나오는 줄을 원문 그대로 옮겨 줘."
    ev = [(0.12 + i * (2.35 / len(check)), 'tick.wav', 0.35) for i, ch in enumerate(check) if ch != ' ']
    ev += [(2.6, 'swish.wav', 0.6), (2.78, 'pop.wav', 0.5), (3.1, 'thud.wav', 0.9), (4.2, 'pen.wav', 0.7)]
    ins = []; flt = []
    for j, (at, f, vol) in enumerate(ev):
        ins += ['-i', os.path.join(SFX, f)]
        flt.append(f'[{j}:a]volume={vol},adelay={int(at * 1000)}|{int(at * 1000)}[a{j}]')
    mix = ''.join(f'[a{j}]' for j in range(len(ev)))
    # 소리는 따로 길이를 못 박아 굽는다(apad + -shortest로 한 번에 묶으면 ffmpeg가 끝나지 않았다 — 11-02)
    flt.append(f'anullsrc=r=48000:cl=stereo[z];[z]{mix}amix=inputs={len(ev) + 1}:normalize=0:duration=first[aout]')
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

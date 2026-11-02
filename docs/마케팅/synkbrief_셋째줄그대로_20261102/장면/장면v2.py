"""synkbrief B23 핵심 장면 v2 (2026-11-02) — v1 심사(넘김 · 2)의 「치는 장면을 빼고 쿵을 1초 안으로 · 틀린 요약과 원문을 큰 글씨로
위아래 맞대기 · 잃는 것 한 줄 · 왼쪽 끝 붙음」을 반영. 실제 ChatGPT 화면(휴대폰 430x932 @3x 녹화)의 글을 낱말 덩이째 잘라 크게 다시 짰다
(값 · 글은 실제 그대로, 새로 쓴 글 없음 — 제작 절차 「synkbrief · yuhobuilds 편」 3).

0.0초  위: AI 요약의 「140만 원 · 구청 지원금 70%」 카드 · 그 아래 굵은 「6개월 이내에 키오스크를 설치해야」(크게)
0.35초 확인 질문 말풍선 「'6개월'이 나오는 줄을 원문 그대로 옮겨 줘.」
0.8초  쿵 — 실제 답 「6개월 안에 폐업하면 / 지원금을 돌려주셔야 합니다.」(크게)
1.25초 위 줄에 빨간 줄 · 1.6초 아래 줄에 노란 형광, 4.6초까지 천천히 다가감

  python -I -X utf8 장면v2.py   →  장면/장면_v2.mp4(git 밖)
"""
import os, subprocess, shutil, tempfile
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REC = 'C:/Users/q1212/ego/synkbrief-b23-20261102/R1'
SFX = os.path.join(HERE, '..', '..', 'synkbrief_안내문한줄_20261031', 'remotion', 'public', 'sfx')
OUT = os.path.join(HERE, '장면_v2.mp4')
FPS, DUR = 30, 4.6
W, H = 1080, 1920
BG = (14, 14, 14)

sumf = Image.open(os.path.join(REC, 'frames', '0048_6298.jpg')).convert('RGB')
ans = Image.open(os.path.join(REC, '05_확인답.png')).convert('RGB')

def cut(im, box, k):
    p = im.crop(box)
    return p.resize((int(p.width * k), int(p.height * k)), Image.LANCZOS)

CARD = cut(sumf, (40, 770, 1250, 1150), 0.85)          # 140만 원 · 구청 지원금 70% · 60만 원
A = cut(sumf, (430, 1405, 1210, 1470), 1.3)             # 6개월 이내에 키오스크를 설치해야
Qb = cut(ans, (400, 730, 1250, 985), 1.0)               # 질문 말풍선
B1 = cut(ans, (725, 1172, 1185, 1238), 1.5)             # 6개월 안에 폐업하면
B2 = cut(ans, (40, 1250, 675, 1312), 1.5)               # 지원금을 돌려주셔야 합니다.
POS = {'card': (26, 300), 'A': (33, 700), 'Q': (200, 880), 'B1': (64, 1230), 'B2': (64, 1345)}

def ease(x):
    x = max(0.0, min(1.0, x)); return 1 - (1 - x) ** 3

def compose(t):
    c = Image.new('RGB', (W, H), BG)
    c.paste(CARD, POS['card']); c.paste(A, POS['A'])
    if t >= 0.35:
        q = ease((t - 0.35) / 0.18); y = POS['Q'][1] + int(30 * (1 - q))
        c.paste(Qb, (POS['Q'][0], y))
    if t >= 0.8: c.paste(B1, POS['B1'])
    if t >= 0.95: c.paste(B2, POS['B2'])
    d = ImageDraw.Draw(c, 'RGBA')
    if t >= 1.25:
        p = ease((t - 1.25) / 0.3)
        xa, xb = POS['A'][0] + int((451 - 430) * 1.3), POS['A'][0] + int((1197 - 430) * 1.3)
        y = POS['A'][1] + int((1437 - 1405) * 1.3)
        d.line([(xa, y), (xa + (xb - xa) * p, y)], fill=(235, 64, 52, 255), width=11)
    if t >= 1.6:
        p = (t - 1.6) / 0.5
        for key, crop0, (xa, xb), r0, r1, top, start in [('B1', 725, (738, 1174), 1180, 1229, 1172, 0.0), ('B2', 40, (51, 494), 1258, 1304, 1250, 0.5)]:
            q = ease((p - start) / 0.5)
            if q <= 0: continue
            ox, oy = POS[key]
            x0 = ox + int((xa - crop0) * 1.5) - 8; x1 = ox + int((xb - crop0) * 1.5) + 8
            y0 = oy + int((r0 - top) * 1.5) - 8; y1 = oy + int((r1 - top) * 1.5) + 8
            d.rectangle([x0, y0, x0 + (x1 - x0) * q, y1], fill=(255, 214, 10, 100))
    z = 1 + 0.04 * max(0.0, t - 1.6) / (DUR - 1.6)
    if z > 1:
        big = c.resize((int(W * z), int(H * z)), Image.LANCZOS)
        ox, oy = (big.width - W) // 2, int((big.height - H) * 0.45)
        c = big.crop((ox, oy, ox + W, oy + H))
    return c

def main():
    tmp = tempfile.mkdtemp(prefix='b23장면2_')
    for i in range(int(FPS * DUR)):
        compose(i / FPS).save(os.path.join(tmp, f'{i:04d}.png'))
    ev = [(0.35, 'swish.wav', 0.55), (0.8, 'thud.wav', 0.95), (0.95, 'tok.wav', 0.5), (1.25, 'pen.wav', 0.7)]
    ins, flt = [], []
    for j, (at, f, vol) in enumerate(ev):
        ins += ['-i', os.path.join(SFX, f)]
        flt.append(f'[{j}:a]volume={vol},adelay={int(at * 1000)}|{int(at * 1000)}[a{j}]')
    mix = ''.join(f'[a{j}]' for j in range(len(ev)))
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

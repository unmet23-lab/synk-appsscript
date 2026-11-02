"""synkbrief B23 영상 재료(public/img — git 밖) — 실제 ChatGPT 휴대폰 화면 녹화(R1 · R2 · R5, 430x932 @3x)와 시험 공문에서 자르고 키운다.
글 · 값은 화면 그대로(새로 쓴 글 없음). R1 화면의 「서울 서초구」(AI가 새솔구를 잘못 읽은 칸 · 결론)는 어느 조각에도 들어오지 않게 자른다(Fable 사실 검수 4).

  python -I -X utf8 scripts/img.py
"""
import os, io, subprocess, shutil, tempfile
from PIL import Image
import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, '..', 'public', 'img')
EGO = 'C:/Users/q1212/ego/synkbrief-b23-20261102'
EP = os.path.join(HERE, '..', '..')
os.makedirs(PUB, exist_ok=True)
W = 1080

def phone(path):
    return Image.open(path).convert('RGB')

def save(im, name):
    im.save(os.path.join(PUB, name)); print(name, im.size)

def cut(im, box, k):
    p = im.crop(box)
    return p.resize((round(p.width * k), round(p.height * k)), Image.LANCZOS)

# 1) R2 요약 첫 화면(제목 · 최대 지원금 140만 원 · 표 — 새솔구 그대로) — 휴대폰 화면 폭을 1080으로
r2top = phone(f'{EGO}/R2/03_요약_0.png')
k = W / 1290
save(r2top.resize((W, round(2796 * k)), Image.LANCZOS), 'r2_top.png')

# 2) R1 「꼭 알아둘 점」 굵은 줄(결론 칸 위에서 끊음) · 돈 카드(「키오스크 가격이 200만 원일 경우」 줄째 — Fable 5)
r1 = phone(f'{EGO}/R1/frames/0048_6298.jpg')
save(cut(r1, (21, 1210, 1269, 1720), W / 1248), 'r1_bullets.png')
save(cut(r1, (40, 770, 1250, 1150), 0.85), 'card.png')
save(cut(r1, (430, 1405, 1210, 1470), 1.3), 'line_ai_big.png')          # 6개월 이내에 키오스크를 설치해야

# 3) 바뀐 줄 화면 셋(R1 굵은 글 · R2 문단 · R5 굵은 글) — 그 줄이 가운데 오게 찍은 화면에서 가운데 띠
for r in ['R1', 'R2', 'R5']:
    im = phone(f'{EGO}/{r}/04_6개월줄.png')
    if r == 'R1':
        band = im.crop((0, 1100, 1290, 1560))   # 결론(서초구) 위에서 끊는다
    else:
        band = im.crop((0, 1100, 1290, 1700))
    save(band.resize((W, round(band.height * k)), Image.LANCZOS), f'line_{r}.png')

# 4) 확인 답(R1) — 질문 말풍선 · 답 세 줄, 그리고 크게 자른 두 줄
ans = phone(f'{EGO}/R1/05_확인답.png')
save(cut(ans, (400, 730, 1250, 985), 1.0), 'q_bubble.png')
save(cut(ans, (0, 1085, 1290, 1320), W / 1290 * 1.0), 'ans_full.png')
save(cut(ans, (725, 1172, 1185, 1238), 1.5), 'ans_b1.png')               # 6개월 안에 폐업하면
save(cut(ans, (40, 1250, 675, 1312), 1.5), 'ans_b2.png')                 # 지원금을 돌려주셔야 합니다.

# 5) 시험에 쓴 흐린 스캔 공문(지어낸 예시) — 쪽 그림 · 「사.」 줄 가까이
doc = pymupdf.open(os.path.join(EP, '공문', '공문_키오스크지원_스캔.pdf'))
pix = doc[0].get_pixmap(dpi=150)
scan = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
save(scan, 'scan_page.png')

# 6) R2 타자 → 보냄 → 답(실제 프레임, 휴대폰 화면 폭 1080 · 위아래는 입력 칸이 아래에 오게)
fr = sorted(os.listdir(f'{EGO}/R2/frames'))
stamp = [(int(f.split('_')[1][:-4]), f) for f in fr]
def at(ms):
    best = stamp[0][1]
    for t, f in stamp:
        if t <= ms: best = f
        else: break
    return best
tmp = tempfile.mkdtemp(prefix='b23type_')
H = round(2796 * k)
y0 = H - 1920
n = 0
for i in range(int(30 * 10.5)):          # 실제 1.2~11.7초를 그대로(10.5초)
    ms = 1200 + i * 1000 / 30
    im = Image.open(f'{EGO}/R2/frames/{at(ms)}').convert('RGB').resize((W, H), Image.LANCZOS).crop((0, y0, W, y0 + 1920))
    im.save(os.path.join(tmp, f'{n:04d}.png')); n += 1
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', '30', '-i', os.path.join(tmp, '%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16',
                os.path.join(PUB, 'type.mp4')], check=True, stdin=subprocess.DEVNULL)
shutil.rmtree(tmp, ignore_errors=True)
print('type.mp4', n, 'frames · 실제 1.2초부터(보냄', [m for m in __import__('json').load(open(f'{EGO}/R2/표시.json', encoding='utf8'))['marks']], ')')

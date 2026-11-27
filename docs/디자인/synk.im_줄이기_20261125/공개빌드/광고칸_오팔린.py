"""홈 첫 화면 「광고」 칸 영상: OPALIN 「시스루」 뮤직비디오 2분 16.67초~2분 24.43초를 세로 칸으로 자른다.

유호님 11-27 저녁 「오팔린 2분 17초 이 부분부터 써주면 너무 좋을것같아」(눈 감고 노래하는 진주 귀걸이 클로즈업).
쓰임: python -I 광고칸_오팔린.py <원본 mp4> <시안 폴더>
  원본: docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/assets/films/opalin-seethrough-v1.mp4 (1920×1080, 30fps)
  시안 폴더의 a/opalin-port.mp4(720×900, 소리 없음)와 a/opalin-port.webp(포스터)를 쓴다. 짓기.py가 이 둘을 홈에 싣는다.
컷 경계는 장면 감지(scdet)로 잰 값이다. 컷마다 얼굴 가운데(가로 x)에 맞춰 1080 높이 × 864 폭을 잘라 720×900으로 줄인다.
컴퓨터 칸은 영상 가운데 약 2/3만 보이므로(object-fit: cover) 얼굴 가운데를 창 가운데에 둔다.
첫 컷(클로즈업)은 원본에서 눈이 화면 맨 위라, 그대로 자르면 칸 위의 제목과 그늘 밑에 눈이 깔린다.
그래서 이 컷은 조금 넓게(1036 폭) 잘라 720×750으로 줄여 칸 아래쪽에 앉히고, 위 150px은 같은 장면을 크게 흐려 채운다
(제목 그늘 안이라 거의 보이지 않게 어둡게 낮춘다). 날카로운 판의 위 가장자리는 110px에 걸쳐 흐린 판으로 스민다.
"""
import subprocess, sys
from pathlib import Path

SRC, DRAFT = Path(sys.argv[1]), Path(sys.argv[2])
A = DRAFT / 'a'
SEEK = 130.0                      # 앞에서 정확히 찾아 들어간 뒤 프레임 번호로 자른다(30fps, 130초 = 0번)
FPS = 30
# (처음 초, 끝 초, 얼굴 가운데 x — 1920 폭 기준, 위를 비워 아래로 앉힐지)
CUTS = [
    (136.6667, 139.4, 900, True),     # 눈 감고 노래하는 클로즈업(진주 귀걸이)
    (139.4, 140.4, 900, False),       # 기울어진 웃는 얼굴(눈이 화면 가운데 높이라 그대로 자른다)
    (140.4, 142.4, 900, False),       # 소금사막 — 손 흔들기, 가슴에 손
    (142.4, 144.4333, 960, False),    # 소금사막 — 머리 날리며 노래
]
W, H = 864, 1080
PAD, FEATHER = 150, 110                # 앉힐 때 위를 비우는 높이와 스미는 높이(720×900 기준)
WP = round(H * 720 / (900 - PAD) / 2) * 2   # 앉히는 컷의 자르는 폭(1036)


def chain(src, cx, pad, out):
    """한 컷(또는 한 장)을 720×900으로. pad면 넓게 잘라 아래에 앉히고 위를 흐린 판으로 채운다."""
    if not pad:
        x = max(0, min(1920 - W, cx - W // 2))
        return f'{src}crop={W}:{H}:{x}:0,scale=720:900:flags=lanczos,setsar=1[{out}]'
    x = max(0, min(1920 - WP, cx - WP // 2))
    a = f'{out}a'
    return (f'{src}crop={WP}:{H}:{x}:0,split[{a}1][{a}2];'
            f'[{a}1]scale=720:900,boxblur=28:3,eq=brightness=-0.22:saturation=0.7[{a}b];'
            f'[{a}2]scale=720:{900 - PAD}:flags=lanczos,format=rgba,'
            f"geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(Y,{FEATHER}),255*Y/{FEATHER},255)'[{a}f];"
            f'[{a}b][{a}f]overlay=0:{PAD}:format=auto,format=yuv420p,setsar=1[{out}]')
POSTER_T = 137.27                 # 포스터: 눈 감고 노래하는 순간(휴대폰은 재생 전 이 그림이 보인다)

parts, labels = [], []
for i, (s, e, cx, pad) in enumerate(CUTS):
    f0, f1 = round((s - SEEK) * FPS), round((e - SEEK) * FPS)
    parts.append(chain(f'[0:v]trim=start_frame={f0}:end_frame={f1},setpts=PTS-STARTPTS,', cx, pad, f'v{i}'))
    labels.append(f'[v{i}]')
graph = ';'.join(parts) + f';{"".join(labels)}concat=n={len(CUTS)}:v=1:a=0,format=yuv420p[out]'
out = A / 'opalin-port.mp4'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(SEEK), '-i', str(SRC), '-filter_complex', graph, '-map', '[out]', '-an',
                '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '24', '-r', str(FPS), '-movflags', '+faststart', str(out)], check=True)

# 포스터: 첫 컷과 같은 자름으로 그 순간을 뽑는다
s, e, cx, pad = CUTS[0]
poster = A / 'opalin-port.webp'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(POSTER_T), '-i', str(SRC), '-frames:v', '1',
                '-filter_complex', chain('[0:v]', cx, pad, 'p'), '-map', '[p]', '-c:v', 'libwebp', '-quality', '82', str(poster)], check=True)
print(out, out.stat().st_size, '·', poster, poster.stat().st_size)

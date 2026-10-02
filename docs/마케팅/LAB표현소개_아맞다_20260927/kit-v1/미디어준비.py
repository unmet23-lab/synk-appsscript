# -*- coding: utf-8 -*-
"""LAB 표현 소개 「아 맞다」 키트판 v1 — 기존 결과물에서 소리·장면·몽글 컷을 꺼내 assets/에 둔다.

새로 생성하는 것은 없다. 모두 v2 원본에서 잘라 오거나 정본에서 줄인다.
- assets/media/mix_en.m4a      게시본(게시/01-lab-youtube/video.mp4)의 최종 믹스 오디오. 재인코딩 없이 스트림 복사
                               (내레이션·음악·몽글 소리·UI 소리와 그 시각이 v2와 똑같다)
- assets/media/umbrella_veo.mp4 v2 예문 장면에 쓴 Veo 원본(소스/veo_우산_장면_원본.mp4)의 같은 구간.
                               영상 1.50초 = 원본 2.32초(v2: 1.58초 = 2.40초). 아치 창 비율로 자르고 720px로 줄였다
- assets/mascot/mongle-*.webp  키트 사본에 없는 몽글 컷(좌34·윙크·눈감음). 정본_4K에서 키트와 같은 테두리(477,400)-(3627,3517)로
                               잘라 1400px로 줄인다. 키트의 다른 표정 컷과 위치가 똑같이 겹친다
쓰는 법: python 미디어준비.py   (ffmpeg 필요)
"""
import os, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)                      # docs/마케팅/LAB표현소개_아맞다_20260927
REPO = os.path.abspath(os.path.join(SRC, '..', '..', '..'))
MEDIA = os.path.join(HERE, 'assets', 'media')
MASCOT = os.path.join(HERE, 'assets', 'mascot')
os.makedirs(MEDIA, exist_ok=True)
os.makedirs(MASCOT, exist_ok=True)


def ff(*args):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *args], check=True)


# 1 최종 믹스 오디오(스트림 복사)
ff('-i', os.path.join(SRC, '게시', '01-lab-youtube', 'video.mp4'), '-vn', '-c:a', 'copy',
   os.path.join(MEDIA, 'mix_en.m4a'))

# 2 Veo 우산 장면: 2.32초부터 3.1초. 1080×1336(아치 420×520과 같은 비율)을 y 500에서 잘라 720×890
ff('-ss', '2.32', '-t', '3.1', '-i', os.path.join(SRC, '소스', 'veo_우산_장면_원본.mp4'),
   '-vf', 'crop=1080:1336:0:500,scale=720:890:flags=lanczos', '-an',
   '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
   os.path.join(MEDIA, 'umbrella_veo.mp4'))

# 3 몽글 컷: 키트(tools/SNS키트_자산준비.py)와 같은 방법, 같은 테두리
BOX = (477, 400, 3627, 3517)
for 이름, 파일 in (('좌34', 'mongle-left34'), ('윙크', 'mongle-wink'), ('눈감음', 'mongle-blink')):
    im = Image.open(os.path.join(REPO, 'docs', '캐릭터', '정본_4K', f'몽글_{이름}.png')).convert('RGBA').crop(BOX)
    im.thumbnail((1400, 1400), Image.LANCZOS)
    im.save(os.path.join(MASCOT, 파일 + '.webp'), quality=92, method=6)
    print('몽글', 파일, im.size)

print('준비 끝:', MEDIA, MASCOT)

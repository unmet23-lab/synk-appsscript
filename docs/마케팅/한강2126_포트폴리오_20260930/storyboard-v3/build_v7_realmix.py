# -*- coding: utf-8 -*-
"""오프닝 v7: 실제 영상(우리 게임 실제 플레이, Pexels 실제 촬영)과 AI 컷을 섞어 붙인다(720×1280, 30fps).

    python build_v7_realmix.py [결과.mp4]

실제: 게임 「학교」 관문(직접 녹화), 한강공원 자전거길, 젖은 돌바닥, 비둘기 떼.
AI: 유호님이 좋다고 한 v5 컷(「생각 켬」의 미끄러짐·놀란 얼굴·까몽, 기본 판의 누워서 VR 벗기)과 v6 컵 컷.
소리: 게임 구간은 게임의 실제 음성 「학교」와 게임 음악 「해안선」, 나머지는 각 컷의 소리(실제 영상은 조용한 주변 소리).
"""
import subprocess, sys

D = 'C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/한강2126_포트폴리오_20260930/video/'
G = 'C:/Users/q1212/Documents/SYNK-appsscript/experiences/korean-racing/assets/'
out = sys.argv[1] if len(sys.argv) > 1 else D + 'v7-opening-실사혼합_720p.mp4'
inputs = [
    D + '실제게임_녹화/레이싱_학교_세로.webm',                 # 0 우리 게임 실제 플레이
    D + '실제촬영_스톡/한강공원_자전거길_13940271.mp4',          # 1
    D + '실제촬영_스톡/젖은_돌바닥_접사_30226954.mp4',           # 2
    D + 'v5-opening-zoomtour-wan-480p-think.mp4',               # 3 AI 「생각 켬」
    D + 'v6-cup-insert-wan-720p.mp4',                           # 4 AI 컵
    D + '실제촬영_스톡/비둘기_날아오름_28705460.mp4',            # 5
    D + 'v5-opening-zoomtour-wan-480p.mp4',                     # 6 AI 기본
    G + 'music/coastline.mp3',                                  # 7 게임 음악 「해안선」
    G + 'narration/c01q2o0.mp3',                                # 8 게임 음성 「학교」
]
FIN = 'format=yuv420p,setsar=1'
GRAIN = 'noise=c0s=4:c0f=t+u'
UP = f'scale=720:1280:flags=lanczos,unsharp=5:5:0.45:5:5:0,{GRAIN},{FIN}'   # AI 480p → 720p


def stock(crop_x, grade, h=1440):   # 가로 실제 영상 → 세로로 자르고 AI 컷의 흐린 날 색에 맞춘다(h를 줄이면 위쪽만 쓴다)
    return f'fps=30,crop={h * 9 // 16 // 2 * 2}:{h}:{crop_x}:0,scale=720:1280:flags=lanczos,{grade},{GRAIN},{FIN}'


# (이름, 입력 번호, 영상 자르기, 영상 필터, 소리: (입력 번호, 시작, 길이, 크기))
AMB = (3, 13.6)   # 실제 영상 밑에 깔 조용한 강바람·도시 소리(「생각 켬」 끝부분)
segs = [
    ('게임', 0, 'trim=20.30:22.30,setpts=PTS-STARTPTS,fps=30', f'crop=1035:1840:22:0,scale=720:1280:flags=lanczos,vignette=PI/7,{FIN}', None, 2.0),
    ('한강공원', 1, 'trim=5.2:5.9,setpts=PTS-STARTPTS', stock(1150, "curves=all='0/0 0.55/0.47 1/0.9',eq=contrast=1.1:saturation=0.82,colorbalance=rm=-0.03:bm=0.02:rh=-0.03:bh=0.03"), (AMB[0], AMB[1], 1.4), 0.7),
    ('젖은돌', 2, 'trim=10:10.5,setpts=PTS-STARTPTS', stock(900, 'eq=contrast=1.12:brightness=-0.02,colorbalance=rm=-0.02:bm=0.04:bs=0.03'), (AMB[0], AMB[1] + 0.7, 1.4), 0.5),
    ('미끄러짐·얼굴', 3, 'trim=start_frame=80:end_frame=173,setpts=PTS-STARTPTS', UP, (3, 80 / 30, 1.0), 93 / 30),
    ('컵', 4, 'trim=start_frame=5:end_frame=74,setpts=PTS-STARTPTS', f'{GRAIN},{FIN}', (4, 5 / 30, 0.45), 69 / 30),
    ('까몽', 3, 'trim=start_frame=241:end_frame=299,setpts=PTS-STARTPTS', UP, (3, 241 / 30, 1.0), 58 / 30),   # 241부터: 그 앞 프레임에는 옛 컵이 보인다
    ('비둘기', 5, 'trim=0.2:0.9,setpts=PTS-STARTPTS', stock(1040, 'eq=contrast=1.08:saturation=0.82,colorbalance=rm=-0.02:bm=0.03', h=1296), (AMB[0], AMB[1], 1.6), 0.7),
    ('착지', 3, 'trim=start_frame=317:end_frame=366,setpts=PTS-STARTPTS', UP, (3, 317 / 30, 1.0), 49 / 30),
    ('누워서 VR 벗기', 6, 'trim=start_frame=387,setpts=PTS-STARTPTS', UP, (6, 387 / 30, 1.0), None),
]
fc, vl, al = [], [], []
for i, (name, src, cut, vf, aud, dur) in enumerate(segs):
    fc.append(f'[{src}:v]{cut},{vf}[v{i}]'); vl.append(f'[v{i}]')
    if aud is None:   # 게임: 음악 2초 위에 「학교」 음성
        fc.append(f'[7:a]atrim=60.07:62.07,asetpts=PTS-STARTPTS,volume=0.26,afade=t=in:d=0.03,afade=t=out:st=1.97:d=0.03[m]')
        fc.append(f'[8:a]adelay=1050|1050,volume=2.3,apad=whole_dur=2.0[sp]')
        fc.append(f'[m][sp]amix=inputs=2:duration=first:normalize=0,aresample=48000,aformat=channel_layouts=stereo[a{i}]')
    else:
        a_src, a_ss, gain = aud
        end = f':end={a_ss + dur:.4f}' if dur else ''
        fade = f',afade=t=out:st={dur - 0.03:.4f}:d=0.03' if dur else ''
        fc.append(f'[{a_src}:a]atrim=start={a_ss:.4f}{end},asetpts=PTS-STARTPTS,volume={gain},afade=t=in:d=0.03{fade},aresample=48000,aformat=channel_layouts=stereo[a{i}]')
    al.append(f'[a{i}]')
n = len(segs)
fc.append(''.join(vl) + f'concat=n={n}:v=1:a=0[v]')
fc.append(''.join(al) + f'concat=n={n}:v=0:a=1[a]')
cmd = ['ffmpeg', '-v', 'error', '-y']
for p in inputs:
    cmd += ['-i', p]
cmd += ['-filter_complex', ';'.join(fc), '-map', '[v]', '-map', '[a]', '-r', '30', '-c:v', 'libx264', '-crf', '17',
        '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]
subprocess.run(cmd, check=True)
t = 0.0
for name, *_rest, dur in segs:
    print(f'{t:5.2f}  {name}')
    t += dur or 0
print(out)

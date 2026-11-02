#!/usr/bin/env python3
# 날것 영상을 콘티 흐름대로 자른다 — 자르기만 하고 없는 것을 더하지 않는다(콘티 「두 판」, 2026-11-03).
#   python -X utf8 experiences/drama/qa/쇼케이스-20261031/영상판편집.py <날것 폴더> <나갈.mp4> [--30초]
# 구간은 소리구간.json의 시각에서 잡아 다시 녹화해도 그대로 맞는다.
# 뺀 것: 받아쓰기 동의 창, 8번 줄과 선배 4, 장면 뒤 앞 선배 대사 다시 듣기, 카드 앞 긴 틈. --30초는 앱스토어 미리보기(15~30초)용으로 스스로 고쳐 선배가 웃으며 받는 데(C2)까지만.
import json, os, subprocess, sys
from pathlib import Path

D = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2]).resolve()
SHORT = '--30초' in sys.argv
o = json.loads((D / '소리구간.json').read_text('utf8'))
segs, steps, end = o['segs'], o['steps'], o['end']

def seg(who, nth=0):
    return [s for s in segs if s['who'] == who or s['who'] == 'learner:' + who or Path(s['file']).stem == who][nth]
def click(label):
    return next(s['t'] for s in steps if s['name'] == '단추' and s.get('눌림') == label)
def step(pred):
    return next(s['t'] for s in steps if pred(s))

BEFORE = 0.35 if SHORT else 0.6  # 내 차례 카드를 보는 틈(말 시작 전)
c1, reask, c2, c4 = seg('c1-reply'), seg('c3-reask'), seg('c2-reply'), seg('c4-reply')
l6, l6b, l7, l7b, l9 = seg('6-첫'), seg('6-고침'), seg('7'), seg('7-다른말'), seg('t9')
wrap = seg('coach-wrap')
# 숫자는 11-03 Fable 검수 반영 — 말 끝을 먹지 않게, 결과 카드는 읽을 수 있게, 반만 뜨는 표지 둘(End of scene · New situation)은 뺀다(카드 머리에 같은 글이 있다).
cuts = [
    ('첫 화면', click('Start the scene') - (1.0 if SHORT else 1.5), c1['at']),
    ('C1 선배 1', c1['at'], c1['at'] + c1['dur'] - 0.95),
    ('내 차례 ① 끝 「요」 빠짐', l6['at'] - BEFORE, l6['at'] + l6['dur'] + 0.15),
    ('C3 되묻기', reask['at'], reask['at'] + reask['dur'] - (1.3 if SHORT else 1.0)),
    ('스스로 고침 ✓', l6b['at'] - BEFORE, l6b['at'] + l6b['dur'] + (1.4 if SHORT else 1.9)),
    ('C2 선배 2', c2['at'], c2['at'] + c2['dur'] - (0.9 if SHORT else 0.6)),
]
if not SHORT:
    finish = click('Finish')
    cuts += [
        ('내 차례 ② ✓', l7['at'] - BEFORE, l7['at'] + l7['dur'] + 1.4),
        ('C4 선배 3', c4['at'], c4['at'] + c4['dur'] - 0.25),
        ('다른 말로 한번 더 카드', click('Start take 2') - 1.8, click('Start take 2')),
        ('다른 말로 말하기 → ✓', l7b['at'] - BEFORE, l7b['at'] + l7b['dur'] + 2.4),
        ('새 상황 카드', l9['at'] - 1.8, l9['at'] + l9['dur'] + 2.5),
        ('오늘 기록', finish + 0.3, min(end, wrap['at'] + wrap['dur'] + 2.0)),
    ]
total = sum(b - a for _, a, b in cuts)
parts, labels = [], ''
for i, (name, a, b) in enumerate(cuts):
    d = b - a
    parts.append(f"[0:v]trim={a:.3f}:{b:.3f},setpts=PTS-STARTPTS[v{i}];[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.015,afade=t=out:st={max(0, d - 0.015):.3f}:d=0.015[a{i}]")
    labels += f'[v{i}][a{i}]'
# 식당 방 소리 — 구운 원본(시댄스)의 대사 없는 틈을 이어 깐다. 카드 구간이 완전 무음이 되지 않게, 폰 스피커에서 무음으로 들리지 않을 만큼(약 −34dB).
RAW = Path(os.environ['USERPROFILE']) / 'Documents/synk-vendor/pulse-seedance-day-20261028/받음'
BED = [('sc-C3b', 6.25, 7.95), ('sc-C4b', 6.1, 7.6), ('sc-C1', 7.05, 8.0), ('sc-C4b', 1.9, 2.7)]
bed_in = [x for c, _, _ in BED for x in ('-i', str(RAW / f'{c}.mp4'))]
b = ''.join(f"[{i + 1}:a]atrim={a}:{e},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[b{i}];" for i, (_, a, e) in enumerate(BED))
b += f"[b0][b1]acrossfade=d=0.25[x1];[x1][b2]acrossfade=d=0.25[x2];[x2][b3]acrossfade=d=0.25,aloop=loop=-1:size=2147483647,atrim=0:{total:.3f},volume=+9dB[bed];"
fc = ';'.join(parts) + f";{labels}concat=n={len(cuts)}:v=1:a=1[v][a0];" + b + "[a0][bed]amix=inputs=2:normalize=0:duration=first,volume=+2.5dB,alimiter=limit=0.89:level=false[a]"
subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-y', '-loglevel', 'error', '-i', str(D / '날것.mp4'), *bed_in, '-filter_complex', fc, '-map', '[v]', '-map', '[a]',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', str(OUT)], check=True)
t = 0
for name, a, b in cuts:
    print(f"{t:6.2f}–{t + b - a:6.2f}  ({b - a:5.2f})  {name}  [날것 {a:.2f}~{b:.2f}]")
    t += b - a
print('합', round(total, 2))

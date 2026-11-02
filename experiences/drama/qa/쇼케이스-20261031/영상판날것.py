#!/usr/bin/env python3
# 영상판녹화.mjs가 남긴 프레임 · 재생 기록으로 날것 영상을 만든다(2026-11-03).
#   python -X utf8 experiences/drama/qa/쇼케이스-20261031/영상판날것.py <날것 폴더>
# 나오는 것: 날것.mp4(1080×1920 · 30fps · 소리 포함), 소리구간.json(소리 구간 · 단계의 영상 안 초).
# 소리는 화면 녹화에 없어서 재생 기록의 시각대로 원본 파일(선배 · 코치 녹음, 얹은 영상의 소리, 학습자 줄)을 놓는다.
# 화면이 재생 기록보다 0.13~0.17초 늦게 잡혀(스크린캐스트 지연) 입이 소리를 못 따라간다 — 영상 구간마다 프레임을 원본과 대조해 재고 그만큼 소리를 늦춘다.
import json, subprocess, sys
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PILOT = ROOT / 'experiences/drama/pilot'
D = Path(sys.argv[1]).resolve()
FPS = 30
frames = sorted(json.loads((D / 'frames.json').read_text('utf8')), key=lambda f: f['t'])  # 스크린캐스트는 도착 순서가 시각 순서와 조금 다르다
T = json.loads((D / 'timeline.json').read_text('utf8'))
t0 = frames[0]['t']
end = max(frames[-1]['t'], T['steps'][-1]['at'] / 1000 + 7) - t0  # 끝 화면은 안 바뀌면 프레임이 안 온다 — 마지막 프레임을 늘린다

# 1) 30fps 시간표 — 각 칸에 그 시각까지 나온 마지막 프레임
lines, j = ['ffconcat version 1.0'], 0
n = int(end * FPS)
for k in range(n):
    t = k / FPS
    while j + 1 < len(frames) and frames[j + 1]['t'] - t0 <= t:
        j += 1
    lines.append(f"file 'frames/{frames[j]['i']:06d}.jpg'\nduration {1 / FPS:.6f}")
lines.append(f"file 'frames/{frames[j]['i']:06d}.jpg'")
(D / 'frames.ffconcat').write_text('\n'.join(lines), 'utf8')

# 2) 소리 구간
def local(src):
    p = src.split('/drama/', 1)[-1].split('?')[0]
    return PILOT / p

segs = []
open_ = {}
for ev in T['tl']:
    key = ev['id'] or ev['src']
    if ev['type'] == 'playing':
        if ev['muted'] or not ev['src'] or ev['src'].startswith('blob:'):
            continue
        if key in open_ and open_[key]['src'] == ev['src']:
            continue  # 이어지는 playing
        open_[key] = ev
    elif ev['type'] in ('pause', 'ended') and key in open_:
        a = open_.pop(key)
        segs.append({'file': str(local(a['src'])), 'at': a['at'] / 1000 - t0, 'from': a['ct'], 'dur': ev['at'] / 1000 - a['at'] / 1000, 'vol': a['volume'], 'who': a['id']})
for a in open_.values():
    segs.append({'file': str(local(a['src'])), 'at': a['at'] / 1000 - t0, 'from': a['ct'], 'dur': end - (a['at'] / 1000 - t0), 'vol': a['volume'], 'who': a['id']})
for c in T['learner']:
    segs.append({'file': c['file'], 'at': c['at'] / 1000 - t0, 'from': 0, 'dur': c['dur'], 'vol': 1, 'who': 'learner:' + c['label']})
segs.sort(key=lambda s: s['at'])

# 2) 화면만
subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(D / 'frames.ffconcat'),
                '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-r', str(FPS), '-t', f'{end:.3f}',
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', str(D / '화면.mp4')], check=True)

# 3) 영상 구간의 지연 재기 — 머리 쪽 조각이 원본의 몇 초 프레임과 같은지
def gray(path, ss, dur, w=180):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', str(path)], capture_output=True, text=True)
    W, H = map(int, r.stdout.strip().split(','))
    h = round(H * w / W)
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-loglevel', 'error', '-ss', str(ss), '-t', str(dur), '-i', str(path), '-vf', f'fps={FPS},scale={w}:{h},format=gray', '-f', 'rawvideo', '-'], capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.uint8).reshape(-1, h, w).astype(np.float32)
def lag_of(s):
    src, raw = gray(s['file'], s['from'], s['dur']), gray(D / '화면.mp4', max(0, s['at'] - 0.5), s['dur'] + 1)
    P = raw[len(raw) // 2][25:90, 40:140]
    y = min(range(0, src.shape[1] - 65), key=lambda y: min(float(((src[k, y:y + 65, 40:140] - P) ** 2).mean()) for k in range(0, len(src), 6)))
    lags = []
    for i, f in enumerate(raw):
        t = i / FPS - 0.5
        if 0.3 < t < s['dur'] - 0.3:
            lags.append(t - float(((src[:, y:y + 65, 40:140] - f[25:90, 40:140]) ** 2).mean((1, 2)).argmin()) / FPS)
    return float(np.median(lags))
for s in segs:
    s['lag'] = lag_of(s) if s['who'] == 'reply' else None
known = [s['lag'] for s in segs if s['lag'] is not None]
common = float(np.median(known)) if known else 0
for s in segs:
    if s['lag'] is None:
        s['lag'] = common

# 4) 소리 얹기
inputs, parts = [], []
for i, s in enumerate(segs):
    inputs += ['-i', s['file']]
    parts.append(f"[{i + 1}:a]atrim={s['from']:.3f}:{s['from'] + s['dur']:.3f},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume={s['vol']:.3f},adelay={int((s['at'] + s['lag']) * 1000)}:all=1[a{i}]")
mix = ''.join(f'[a{i}]' for i in range(len(segs)))
fc = ';'.join(parts) + f";{mix}amix=inputs={len(segs)}:normalize=0:duration=longest,apad=whole_dur={end:.3f},atrim=0:{end:.3f}[a]"
subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-y', '-loglevel', 'error', '-i', str(D / '화면.mp4'), *inputs, '-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-t', f'{end:.3f}',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', str(D / '날것.mp4')], check=True)
out = {'segs': segs, 'steps': [{**x, 't': x['at'] / 1000 - t0} for x in T['steps']], 'end': end}
(D / '소리구간.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), 'utf8')
for s in segs:
    print(f"{s['at']:7.2f} +{s['dur']:5.2f}  지연 {s['lag']:5.2f}  {s['who']:18} {Path(s['file']).name}")
print('끝', end, '프레임', n)

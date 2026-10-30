# 드라마 말하기 영상 시험 — 우리 녹음을 클립 속 문장 자리에 맞춰 얹는다(2026-10-30).
# 입맞춤.py(크기 곡선 맞대기)는 태오 2번에서 짧은 웃음 토막 「하」가 첫 문장 속 봉우리에 붙어 뒤 문장을 1초쯤 늦게 놓았다.
# 받아쓰기 낱말의 「시작」 시각은 앞 쉼을 끌어안는다(원본 「여기」 0.0초 · 「나는」 2.96초 — 실제 첫소리는 1.24 · 3.61초).
# 그래서 문장 첫 낱말(닻)의 「끝」 시각이 들어 있는 소리 토막(쉼 0.25초 이상으로 나눔)의 시작을 그 문장의 첫소리로 잡고,
# 원본의 [첫소리 k, 첫소리 k+1) 토막을 클립의 첫소리 k에 놓는다. 첫 닻 앞 토막(웃음 등)은 클립의 첫 소리 토막 자리에 놓는다.
# 10-30 첫 판은 끝없는 apad 때문에 ffmpeg가 10분 넘게 멈췄다(현장노트 영상_ffmpeg_자막에 이미 있던 함정) → apad=whole_dur로 길이를 못 박는다.
#   python -X utf8 문장맞춤.py <클립.mp4> <대사.mp3> <나갈.mp4> --닻 여기,나는,편하게 [--힌트 권태오]
#   받아쓰기는 <나갈>.낱말.json에 남겨 다시 돌릴 때 쓴다.
import json
import os
import subprocess
import sys

import numpy as np

args = sys.argv[1:]
clip, line, dst = args[:3]
anchors = args[args.index('--닻') + 1].split(',') if '--닻' in args else []
hint = args[args.index('--힌트') + 1] if '--힌트' in args else None
if not anchors:
    raise SystemExit('--닻 <문장 첫 낱말,…>을 준다')
SR, HOP = 16000, 160


def pcm(path):
    raw = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def spans(path):
    x = pcm(path)
    n = len(x) // HOP
    e = np.sqrt((x[: n * HOP].reshape(n, HOP) ** 2).mean(axis=1) + 1e-12)
    on = e > max(e.max() * 0.08, 1e-4)
    out, start = [], None
    for i, v in enumerate(list(on) + [False]):
        if v and start is None:
            start = i
        if not v and start is not None:
            if i - start >= 3:
                out.append([start, i])
            start = None
    merged = []
    for s, t in out:
        if merged and s - merged[-1][1] < 25:
            merged[-1][1] = t
        else:
            merged.append([s, t])
    return [[s * HOP / SR, t * HOP / SR] for s, t in merged]


def words(paths):
    cache = dst + '.낱말.json'
    if os.path.exists(cache):
        return json.load(open(cache, encoding='utf-8'))
    from faster_whisper import WhisperModel
    m = WhisperModel('large-v3-turbo', device='cpu', compute_type='int8')
    out = {}
    for k, p in paths.items():
        segs, _ = m.transcribe(p, language='ko', vad_filter=False, word_timestamps=True, beam_size=5, initial_prompt=hint)
        out[k] = [[w.word.strip(), round(w.start, 3), round(w.end, 3)] for s in segs for w in s.words]
    json.dump(out, open(cache, 'w', encoding='utf-8'), ensure_ascii=False)
    return out


def dur(path, stream):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', stream, '-show_entries', 'stream=duration', '-of', 'csv=p=0', path],
                                capture_output=True, text=True, check=True).stdout.strip())


def onsets(ws, sp):
    got, after = [], 0.0
    for a in anchors:
        w = next((w for w in ws if w[1] >= after - 0.05 and w[0].startswith(a)), None)
        if not w:
            raise SystemExit(f'닻 「{a}」를 받아쓰기에서 못 찾았다')
        seg = next((s for s in sp if s[0] - 0.05 <= w[2] <= s[1] + 0.05), None) or min(sp, key=lambda s: abs(s[0] - w[2]))
        got.append(seg[0])
        after = w[2]
    return got


W = words({'원본': line, '클립': clip})
sl, sc = spans(line), spans(clip)
ol, oc = onsets(W['원본'], sl), onsets(W['클립'], sc)
L, V = dur(line, 'a:0'), dur(clip, 'v:0')
plan = []
head_l = [s for s in sl if s[1] <= ol[0] + 0.01]
head_c = [s for s in sc if s[1] <= oc[0] + 0.01]
if head_l and head_c:
    a0 = head_l[0][0]
    plan.append({'무엇': '첫 닻 앞', '원본': [round(a0, 2), round(ol[0], 2)], '클립자리': round(head_c[0][0], 2)})
for i, a in enumerate(anchors):
    a1 = ol[i + 1] if i + 1 < len(ol) else L
    plan.append({'무엇': a, '원본': [round(ol[i], 2), round(a1, 2)], '클립자리': round(oc[i], 2),
                 '클립다음': round(oc[i + 1], 2) if i + 1 < len(oc) else None})
parts = []
for i, p in enumerate(plan):
    a0, a1 = p['원본']
    ms = int(round(max(0.0, p['클립자리'] - 0.03) * 1000))
    parts.append(f"[1]atrim={max(0.0, a0 - 0.03):.3f}:{a1:.3f},asetpts=PTS-STARTPTS,aresample=48000,adelay={ms}|{ms}[s{i}]")
    if p.get('클립다음') is not None:
        p['겹침'] = round(p['클립자리'] + (a1 - a0) - p['클립다음'], 2)
# aresample=async=1:first_pts=0 — 첫 토막이 늦게 놓이면 소리 트랙이 컨테이너에서 늦게 시작해(편집 목록 0.27초, 10-30 Fable P3) 편집 목록을 무시하는 경로에서 앞서 들린다
fc = ';'.join(parts) + ';' + ''.join(f'[s{i}]' for i in range(len(plan))) + f"amix=inputs={len(plan)}:normalize=0:duration=longest,aresample=async=1:first_pts=0,apad=whole_dur={V:.3f},atrim=0:{V:.3f}[a]"
subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', clip, '-i', line, '-filter_complex', fc, '-map', '0:v', '-map', '[a]',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', f'{V:.3f}', dst], check=True)
print(json.dumps({'클립': clip, '영상초': round(V, 3), '원본첫소리': [round(x, 2) for x in ol], '클립첫소리': [round(x, 2) for x in oc], '토막': plan}, ensure_ascii=False))

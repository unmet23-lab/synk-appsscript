"""Y22 실제 소리 자료 — LAB 이름 편 해설 줄의 깨진 판 · 다시 구운 판에서 화면에 쓸 값을 뽑는다(10-29).

    python -X utf8 자료/파형.py   (편 폴더에서)

- remotion/public/clip/{broken,clean}.wav — 「Your turn!」 한마디(줄 맨 앞, 낱말 시각 끝 + 0.06초, 끝 20ms 줄임), {broken,clean}_long.wav — 「Your turn! Comment your name,」(v2)
- remotion/src/y22/data.generated.ts — 한마디 파형(봉우리) · 확대 물결(30ms 실제 표본) · 줄 전체의 모음 프레임별 배음 밖 비율(검사기 tools/목소리엉킴.py 그대로)
"""
import importlib.util
import json
import pathlib
import subprocess

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent.parent
ROOT = HERE.parents[2]
SRC = ROOT / 'docs/마케팅/LAB_댓글이름한글_20261027/remotion/public/vo2'
FILES = {'broken': SRC / 'pick_하나/e6.wav', 'clean': SRC / 'pick/e6.wav'}
WORDS = {'broken': SRC / 'pick_하나/e6.json', 'clean': SRC / 'pick/e6.json'}
OUT_PUB = HERE / 'remotion/public'
(OUT_PUB / 'clip').mkdir(parents=True, exist_ok=True)

spec = importlib.util.spec_from_file_location('tangle', ROOT / 'tools/목소리엉킴.py')
tangle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tangle)

SR = 48000


def load(path, sr):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)


data = {}
for key, path in FILES.items():
    words = json.loads(WORDS[key].read_text(encoding='utf-8'))['words']
    end = next(w['end'] for w in words if w['text'].startswith('turn')) + 0.06
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(path), '-t', f'{end:.3f}', '-af', f'afade=t=out:st={end - 0.02:.3f}:d=0.02', '-ar', '48000', '-ac', '2', str(OUT_PUB / 'clip' / f'{key}.wav')], check=True)
    x = load(path, SR)
    seg = x[: int(end * SR)]
    # 파형 봉우리 120칸
    n = 120
    env = [float(np.abs(c).max()) for c in np.array_split(seg, n)]
    pk = max(env) or 1
    # 줄 전체 모음 프레임(검사기 그대로, 16kHz) — 비율 0.35 넘으면 깨진 프레임
    fr = tangle.analyse(tangle.load(str(path)))
    bad = sum(1 for _, r, _ in fr if r > 0.35)
    # 확대 물결: 깨진 판은 깨진 칸 첫머리(0.43초), 깨끗한 판은 「turn!」 모음 가운데(0.50초)의 30ms 실제 표본 300점
    z0 = int((0.43 if key == 'broken' else 0.50) * SR)
    zs = x[z0:z0 + int(0.03 * SR)]
    zs = zs / (np.abs(zs).max() + 1e-9)
    zoom = [round(float(v), 3) for v in np.interp(np.linspace(0, len(zs) - 1, 300), np.arange(len(zs)), zs)]
    # v2(10-30): 「Your turn! Comment your name,」 긴 판(줄 맨 앞부터 「name,」 끝 + 0.06초)과 그 봉우리 160칸, 줄 전체 길이
    lend = next(w['end'] for w in words if w['text'].startswith('name')) + 0.06
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(path), '-t', f'{lend:.3f}', '-af', f'afade=t=out:st={lend - 0.03:.3f}:d=0.03', '-ar', '48000', '-ac', '2', str(OUT_PUB / 'clip' / f'{key}_long.wav')], check=True)
    lseg = x[: int(lend * SR)]
    lenv = [float(np.abs(c).max()) for c in np.array_split(lseg, 160)]
    lpk = max(lenv) or 1
    data[key + '_long'] = {'clipDur': round(lend, 3), 'wave': [round(e / lpk, 3) for e in lenv], 'lineDur': round(len(x) / SR, 3)}
    data[key] = {
        'zoom': zoom,
        'clipDur': round(end, 3),
        'wave': [round(e / pk, 3) for e in env],
        'frames': [[round(t, 3), round(r, 3)] for t, r, _ in fr],
        'bad': bad,
        'total': len(fr),
        'pct': round(100 * bad / max(1, len(fr)), 1),
    }
    print(f'{key}: 한마디 {end:.2f}초 · 모음 프레임 {len(fr)} · 깨진 {bad} · {data[key]["pct"]}%')

ts_dir = HERE / 'remotion/src/y22'
ts_dir.mkdir(parents=True, exist_ok=True)
(ts_dir / 'data.generated.ts').write_text('// python -X utf8 자료/파형.py가 만든 파일. 고치지 말고 다시 만든다.\nexport const SOUND = ' + json.dumps(data) + ' as const;\n', encoding='utf-8')

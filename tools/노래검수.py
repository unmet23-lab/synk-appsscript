#!/usr/bin/env python
"""노래 검수 — 받은 노래 후보의 발음을 재서 걸린 곳을 초까지 적는다(2026-11-11 Claude, LAB 21:00 노래 · 리듬 한국어 준비안 「나」 줄).

사람 귀를 대신하지 않는다. 유호님께 드릴 최종 후보 두 곡을 먼저 거르고, 후보마다 발음 보고 표(음절 · 들린 소리 · 길이 · 판정 · 걸린
곳의 초)를 만든다. 이 도구의 판정을 거르는 데 쓰기 전에 `맞혀보기`로 이미 판정이 있는 곡을 맞히는지부터 본다(준비안 「기계 검수는
먼저 정답으로 맞혀 본다」) — 맞혀 본 결과와 믿어도 되는 칸 · 안 되는 칸은 docs/마케팅/LAB_리듬한국어_준비_20261110/노래검수_맞혀보기.md.

  python -X utf8 tools/노래검수.py 떼기 <낼 폴더> <곡…>
      목소리만 뗀다(Demucs htdemucs_ft, GPU 줄 `synk-vendor/_공용차례/차례.py gpu 돌리기`로 선다) → <이름>_목소리.wav · <이름>_바탕.wav.
  python -X utf8 tools/노래검수.py 재기 <곡> --후보 <후보.json> --밖 <폴더> [--목소리 <wav> --바탕 <wav>] [--귀 scribe,gemini]
                                       [--구간 <시작초> <끝초>] [--이름 <보고 이름>] [--끊어 <줄 번호…>]
      한 곡을 잰다 → <밖>/<이름>.검수.json · <이름>.보고.md. 목소리 · 바탕을 안 주면 <밖>/떼기/에서 찾고 없으면 떼기부터 한다.
      후보.json = Suno 곡 정보 {"id", "title", "prompt"(넣은 가사), "aligned": {"aligned_words", "hoot_cer"}} — 받기 전에도 읽힌다
      (현장 노트 브라우저_게시 「후보를 보이기 전에 가사를 다 불렀는지」). 가사만 있으면 {"prompt": "<가사>"}로 된다.
  python -X utf8 tools/노래검수.py 맞혀보기 --정답 <정답 폴더> --밖 <폴더> [--귀 …]
      정답(손으로 맞춘 음절 시각 표 · 알려진 결함 · 결함을 고친 판)으로 이 도구를 맞혀 본다. 정답 폴더의 꼴은 맞혀보기 함수 머리말.

재는 것(방법은 첫 인사 때 vocal_onsets.py · beat_probe.py와 11-11 가사 노래 대체 시험의 재기.py를 옮겨 일반화했다):
  ① 박자 눈금 — 바탕 갈래의 타악 성분 흐름이 가장 잘 맞는 빠르기 · 첫 박.
  ② 음절 시작 — 목소리 갈래 150~6000Hz 스펙트럼 흐름 봉우리(소리 덩어리 첫머리 포함), 음절 길이 = 다음 시작 또는 덩어리 끝까지.
  ③ 받아 적기 — 목소리 덩어리(1~7초)마다 따로, **가사를 주지 않고**. 일레븐 Scribe v2(언어 kor)와 Gemini Flash(무료 키, 모델마다 하루
     20번 — 429면 다음 모델, 다 막히면 「못 들음」으로 적고 판정은 남은 귀로). 덩어리를 묶어 한 번에 보내지 않는다 — 앞 조각에 끌려간다
     (11-11 대체 시험). 받아 적기 결과는 <밖>/귀/에 소리 지문으로 저장해 다시 부르지 않는다.
  ④ 대조 — 귀마다 들은 음절열 전체를 가사 음절열에 맞댄다(한글 자모 거리로 바꿈 · 끼움 · 빠짐). 가사 음절마다 귀들이 들은 소리 · 시작 ·
     길이 · 판정, 가사 사이에 끼어든 소리는 「가사에 없는 소리」(앞뒤 가사 음절과 같으면 「두 번 부름」).
판정: 통과(귀 과반이 그 음절로 들음) · 확인(한 귀만 그 음절로 · 너무 짧음 · 끊어 부르는 줄인데 반 박 아래) · 걸림(어느 귀도 그 음절로 못
듣거나, 귀 둘 이상이 같은 자리에 가사에 없는 소리를 들음). 귀 하나만 남으면 그 귀가 다르게 들은 음절은 「확인(귀 하나)」이다.
키 값은 찍지 않는다. 돈이 드는 길(Vertex 유료 · 허깅페이스 Jobs)은 쓰지 않는다.
"""
import argparse
import base64
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
import wave
from pathlib import Path

import numpy as np
from scipy.ndimage import maximum_filter1d, median_filter
from scipy.signal import find_peaks

sys.stdout.reconfigure(encoding='utf-8')
HOME = Path(os.path.expanduser('~'))
REPO = Path(__file__).resolve().parent.parent
SR = 22050
DEMUCS_PY = Path('C:/SYNK-LoRA/tools/demucs/venv/Scripts/python.exe')
DEMUCS_SCRIPT = Path('C:/SYNK-LoRA/tools/demucs/목소리떼기.py')
QUEUE = HOME / 'Documents' / 'synk-vendor' / '_공용차례' / '차례.py'
GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash',
                 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest']
# 무료 키는 모델마다 하루 20번이다(현장 노트 AI_CLI 11-01) — 위에서부터 쓰고 429면 다음으로. 답한 모델은 귀 칸 「모델」에 남는다.


# ── 소리 ──────────────────────────────────────────────────────────────

def load(path, sr=SR):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def wav_bytes(x, sr=SR):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    return buf.getvalue()


def separate(out_dir, inputs):
    """Demucs로 목소리 · 바탕을 뗀다 — GPU 줄에 서서. 이미 있으면 건너뛴다."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    todo = [p for p in inputs if not (out_dir / f'{Path(p).stem}_목소리.wav').exists()]
    if todo:
        cmd = [sys.executable, '-X', 'utf8', str(QUEUE), 'gpu', '돌리기', f'노래검수-{os.getpid()}', 'LAB 노래 검수 — 목소리 떼기',
               '--상한', '40', '--', str(DEMUCS_PY), '-X', 'utf8', str(DEMUCS_SCRIPT), str(out_dir), *map(str, todo), '--gpu']
        r = subprocess.run(cmd, stdin=subprocess.DEVNULL)
        if r.returncode:
            raise SystemExit(f'목소리 떼기 실패(종료 {r.returncode})')
    return {Path(p).stem: (out_dir / f'{Path(p).stem}_목소리.wav', out_dir / f'{Path(p).stem}_바탕.wav') for p in inputs}


# ── 박자 눈금(바탕 갈래) ──────────────────────────────────────────────

def beat_grid(acc, bpm_range=(80.0, 130.0)):
    N, H = 2048, 256
    fr = np.lib.stride_tricks.sliding_window_view(acc, N)[::H] * np.hanning(N)
    S = np.abs(np.fft.rfft(fr, axis=1)).astype(np.float32)
    harm = median_filter(S, size=(17, 1))
    perc = median_filter(S, size=(1, 17))
    P = S * (1 - harm ** 2 / (harm ** 2 + perc ** 2 + 1e-9))
    L = np.log1p(P * 30)
    flux = np.r_[0, np.maximum(L[1:] - L[:-1], 0).sum(1)]
    flux3 = maximum_filter1d(flux, 3)
    dt, t0, dur = H / SR, N / 2 / SR, len(acc) / SR

    def score(bpm, ph):
        ts = np.arange(ph, dur - 0.1, 60 / bpm)
        idx = np.clip(np.round((ts - t0) / dt).astype(int), 0, len(flux3) - 1)
        return float(flux3[idx].mean())

    best = (0.0, 0.0, 0.0)
    for bpm in np.arange(bpm_range[0], bpm_range[1], 0.1):
        for ph in np.arange(0, 60 / bpm, 0.01):
            s = score(bpm, ph)
            if s > best[0]:
                best = (s, bpm, ph)
    s, bpm, ph = best
    for b2 in np.arange(bpm - 0.1, bpm + 0.1, 0.005):
        for p2 in np.arange(max(ph - 0.012, 0), ph + 0.012, 0.002):
            s2 = score(b2, p2)
            if s2 > best[0]:
                best = (s2, b2, p2)
    s, bpm, ph = best
    beat = 60 / bpm
    clarity = s / (score(bpm, ph + beat / 2) + 1e-9)
    return {'bpm': round(float(bpm), 3), '박': round(beat, 5), '첫박': round(float(ph), 3), '눈금뚜렷함': round(float(clarity), 2)}


# ── 목소리 갈래: 덩어리 · 음절 시작 ────────────────────────────────────

def vocal_units(v, t_from=0.0, t_to=1e9):
    N2, H2 = 1024, 110
    fr2 = np.lib.stride_tricks.sliding_window_view(v, N2)[::H2]
    S2 = np.abs(np.fft.rfft(fr2 * np.hanning(N2), axis=1)).astype(np.float32)
    f = np.fft.rfftfreq(N2, 1 / SR)
    t = (np.arange(len(S2)) * H2 + N2 / 2) / SR
    dt2 = H2 / SR
    rms = 20 * np.log10(np.sqrt((fr2 ** 2).mean(1)) + 1e-7)
    band = (f >= 150) & (f <= 6000)
    L2 = np.log1p(S2[:, band] * 50)
    fl = np.r_[0, np.maximum(L2[1:] - L2[:-1], 0).sum(1)]
    fl = np.convolve(fl, np.hanning(5) / np.hanning(5).sum(), 'same')
    top = float(np.percentile(rms, 99.5))
    on = rms > top - 30
    segs, i = [], 0
    while i < len(on):
        if on[i]:
            j = i
            while j < len(on) and on[j]:
                j += 1
            segs.append([float(t[i]), float(t[j - 1])])
            i = j
        else:
            i += 1
    merged = []
    for s0, s1 in segs:
        if merged and s0 - merged[-1][1] < 0.06:
            merged[-1][1] = s1
        else:
            merged.append([s0, s1])
    merged = [m for m in merged if m[1] - m[0] >= 0.05 and m[1] >= t_from and m[0] <= t_to]
    pk, _ = find_peaks(fl, distance=int(0.08 / dt2), prominence=np.percentile(fl, 80) * 0.5)
    pk = [int(i) for i in pk if t_from <= t[i] <= t_to and rms[i] > top - 34]
    onsets = []
    for s0, s1 in merged:
        ons = [float(t[i]) for i in pk if s0 - 0.03 <= t[i] <= s1]
        if not ons or ons[0] - s0 > 0.12:
            ons = [s0] + ons
        for k, o in enumerate(ons):
            e = ons[k + 1] if k + 1 < len(ons) else s1
            if e - o < 0.04:
                continue
            seg = (t >= o) & (t <= e)
            onsets.append({'시작': round(o, 3), '끝': round(e, 3), '길이': round(e - o, 3), '최고dB': round(float(rms[seg].max() - top), 1),
                           '덩어리': [round(s0, 3), round(s1, 3)]})
    env = {'t': t, 'rms': rms, 'top': top}
    return merged, onsets, env


def chunks_for_ears(merged, env, max_len=3.5, gap_join=0.25):
    """받아 적기 조각: 쉼이 gap_join 넘는 자리에서 나누고, max_len 넘는 덩어리는 가운데 근처 가장 깊은 골에서 자른다."""
    groups = []
    for s0, s1 in merged:
        if groups and s0 - groups[-1][1] < gap_join and s1 - groups[-1][0] <= max_len:
            groups[-1][1] = s1
        else:
            groups.append([s0, s1])
    t, rms = env['t'], env['rms']
    out = []
    stack = list(groups)
    while stack:
        a, b = stack.pop(0)
        if b - a <= max_len:
            out.append([a, b])
            continue
        lo, hi = a + (b - a) * 0.3, a + (b - a) * 0.7
        m = (t >= lo) & (t <= hi)
        cut = float(t[m][np.argmin(rms[m])]) if m.any() else (a + b) / 2
        stack[0:0] = [[a, cut], [cut, b]]
    return [[round(a, 3), round(b, 3)] for a, b in out if b - a >= 0.15]


# ── 가사 ──────────────────────────────────────────────────────────────

HANGUL = re.compile(r'[가-힣]')
TOKEN = re.compile(r'[가-힣]|[A-Za-z]+')


def tokens(text):
    return [m.group(0).lower() if m.group(0)[0].isascii() else m.group(0) for m in TOKEN.finditer(text)]


def parse_lyrics(prompt):
    """[구간] 머리와 줄 — 줄마다 음절(한글 한 글자 · 영어 낱말 하나가 한 토큰)과 끊어 부르는 줄인지(음절마다 ! , 로 끊김)."""
    lines, sec = [], ''
    for raw in prompt.splitlines():
        s = raw.strip()
        if not s:
            continue
        m = re.fullmatch(r'\[(.+?)\]', s)
        if m:
            sec = m.group(1)
            continue
        toks = tokens(s)
        if not toks:
            continue
        words = [w for w in re.split(r'\s+', s) if tokens(w)]
        chopped = len(words) >= 2 and all(len([c for c in tokens(w) if HANGUL.match(c)]) == 1 and re.search(r'[!,?.]$', w) for w in words)
        lines.append({'줄': len(lines) + 1, '구간': sec, '글': s, '음절': toks, '끊어': bool(chopped)})
    return lines


# ── 한글 거리 ─────────────────────────────────────────────────────────

CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
SAME_CLASS = [set('ㄱㄲㅋ'), set('ㄷㄸㅌ'), set('ㅂㅃㅍ'), set('ㅈㅉㅊ'), set('ㅅㅆ'), set('ㅐㅔ'), set('ㅒㅖ'), set('ㅙㅚㅞ')]


def jamo(s):
    if not HANGUL.match(s):
        return None
    c = ord(s) - 0xAC00
    return CHO[c // 588], JUNG[(c % 588) // 28], (c % 28)


def sub_cost(a, b):
    if a == b:
        return 0.0
    ja, jb = jamo(a), jamo(b)
    if not ja or not jb:
        return 1.0
    cost = 0.0
    for x, y, w in ((ja[0], jb[0], 0.35), (ja[1], jb[1], 0.45), (ja[2], jb[2], 0.2)):
        if x != y:
            cost += w * (0.5 if any(x in g and y in g for g in SAME_CLASS) else 1.0)
    return min(cost, 1.0)


def align(lyr, heard):
    """가사 음절열 lyr와 들은 음절열 heard(각 [토큰, 조각 번호])를 맞댄다 → (가사 i마다 들은 j 또는 None, 끼어든 j 목록과 그 자리)."""
    n, m = len(lyr), len(heard)
    D = np.zeros((n + 1, m + 1), np.float32)
    D[:, 0] = np.arange(n + 1)
    D[0, :] = np.arange(m + 1)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            D[i, j] = min(D[i - 1, j] + 1, D[i, j - 1] + 1, D[i - 1, j - 1] + sub_cost(lyr[i - 1], heard[j - 1][0]))
    i, j = n, m
    match = [None] * n
    inserted = []  # (가사 몇 번째 앞에 끼었나, j)
    while i > 0 or j > 0:
        if i > 0 and j > 0 and abs(D[i, j] - (D[i - 1, j - 1] + sub_cost(lyr[i - 1], heard[j - 1][0]))) < 1e-6:
            match[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif i > 0 and abs(D[i, j] - (D[i - 1, j] + 1)) < 1e-6:
            i -= 1
        else:
            inserted.append((i, j - 1))
            j -= 1
    return match, inserted[::-1]


# ── 귀 ────────────────────────────────────────────────────────────────

def _cache(dir_, ear, data):
    key = hashlib.sha256(data).hexdigest()[:20]
    return Path(dir_) / f'{ear}_{key}.json'


def ear_scribe(data, cache_dir):
    cf = _cache(cache_dir, 'scribe', data)
    if cf.exists():
        return json.loads(cf.read_text(encoding='utf-8'))
    keyf = HOME / 'SYNK_보안' / 'elevenlabs.txt'
    if not keyf.exists():
        return {'못들음': '일레븐 열쇠 파일 없음'}
    key = keyf.read_text(encoding='utf-8').strip().splitlines()[0].strip()
    b = uuid.uuid4().hex
    parts = [f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
             for k, v in (('model_id', 'scribe_v2'), ('language_code', 'kor'), ('tag_audio_events', 'false'))]
    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + data + b'\r\n')
    parts.append(f'--{b}--\r\n'.encode())
    req = urllib.request.Request('https://api.elevenlabs.io/v1/speech-to-text', data=b''.join(parts),
                                 headers={'xi-api-key': key, 'Content-Type': f'multipart/form-data; boundary={b}'}, method='POST')
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                out = {'글': json.loads(r.read()).get('text', '').strip(), '모델': 'scribe_v2'}
            cf.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
            time.sleep(0.25)
            return out
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 2:
                time.sleep(3 * (attempt + 1))
                continue
            return {'못들음': f'HTTP {e.code}'}
        except Exception as e:  # 망 끊김 등 — 판정에서 이 귀만 빠진다
            if attempt < 2:
                time.sleep(3)
                continue
            return {'못들음': type(e).__name__}


GEMINI_PROMPT = ('이 소리는 노래 한 토막에서 목소리만 떼어 낸 것이다. 들리는 소리를 한글로 그대로 받아 적어라. '
                 '뜻이 통하게 고치거나 아는 노래로 채우지 말고, 같은 음절을 두 번 부르면 두 번 적고, 알아듣기 어려운 음절도 가장 가깝게 들리는 '
                 '한글 한 음절로 적어라. 영어 낱말로 들리면 영어로 적는다. 목소리가 없으면 빈 글. '
                 'JSON으로만 답한다: {"글": "<받아 적은 것>", "또렷함": <0~10 정수>}')
_gemini_dead = set()


def ear_gemini(data, cache_dir):
    cf = _cache(cache_dir, 'gemini', data)
    if cf.exists():
        return json.loads(cf.read_text(encoding='utf-8'))
    keyf = Path(os.environ.get('GEMINI_KEY_PATH_FREE', str(HOME / 'SYNK_보안' / '제미나이_무료.txt')))
    if not keyf.exists():
        return {'못들음': 'Gemini 무료 열쇠 파일 없음'}
    toks = [t for t in keyf.read_text(encoding='utf-8').replace('\ufeff', '').split() if re.match(r'^(AIza|AQ\.)', t)]
    if not toks:
        return {'못들음': 'Gemini 열쇠 꼴 모름'}
    body = json.dumps({'contents': [{'role': 'user', 'parts': [{'inline_data': {'mime_type': 'audio/wav', 'data': base64.b64encode(data).decode()}},
                                                              {'text': GEMINI_PROMPT}]}],
                       'generationConfig': {'temperature': 0, 'responseMimeType': 'application/json'}}).encode()
    last = '모델 없음'
    for model in GEMINI_MODELS:
        if model in _gemini_dead:
            continue
        req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent', data=body,
                                     headers={'x-goog-api-key': toks[0], 'content-type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                j = json.loads(r.read())
            txt = ''.join(p.get('text', '') for p in j['candidates'][0]['content']['parts'])
            try:
                ans = json.loads(txt)
            except json.JSONDecodeError:
                ans = {'글': txt}
            out = {'글': str(ans.get('글', '')).strip(), '또렷함': ans.get('또렷함'), '모델': j.get('modelVersion', model)}
            cf.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
            return out
        except urllib.error.HTTPError as e:
            last = f'{model} HTTP {e.code}'
            print(f'  Gemini {last}', file=sys.stderr)
            if e.code in (404, 429, 400, 403):
                _gemini_dead.add(model)
                continue
            if e.code in (500, 503):
                time.sleep(4)
                continue
        except Exception as e:
            last = f'{model} {type(e).__name__}'
            print(f'  Gemini {last}', file=sys.stderr)
            continue
    return {'못들음': last}


EARS = {'scribe': ear_scribe, 'gemini': ear_gemini}


# ── 재기 ──────────────────────────────────────────────────────────────

def measure(song, cand, out_dir, voc=None, acc=None, ears=('scribe', 'gemini'), span=None, name=None, chopped_lines=None):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    name = name or Path(song).stem
    if not voc:
        voc, acc = separate(out_dir / '떼기', [song])[Path(song).stem]
    v, a = load(voc), load(acc)
    t_from, t_to = span if span else (0.0, len(v) / SR)
    grid = beat_grid(a[int(t_from * SR):int(t_to * SR)] if span else a)
    if span:
        grid['첫박'] = round(grid['첫박'] + t_from, 3)
    merged, onsets, env = vocal_units(v, t_from, t_to)
    pieces = chunks_for_ears(merged, env)
    lyr_lines = parse_lyrics(cand.get('prompt') or '')
    if chopped_lines:
        for ln in lyr_lines:
            ln['끊어'] = ln['줄'] in chopped_lines
    lyr = [(tok, ln['줄']) for ln in lyr_lines for tok in ln['음절']]
    ear_dir = out_dir / '귀'
    ear_dir.mkdir(exist_ok=True)
    heard = {e: [] for e in ears}
    piece_rows = []
    for k, (p0, p1) in enumerate(pieces):
        clip = v[max(0, int((p0 - 0.12) * SR)):int((p1 + 0.12) * SR)]
        data = wav_bytes(clip)
        row = {'조각': k, '시작': p0, '끝': p1}
        for e in ears:
            ans = EARS[e](data, ear_dir)
            row[e] = ans.get('글', '') if '못들음' not in ans else None
            if '못들음' in ans:
                row[e + '_못들음'] = ans['못들음']
            for tok in tokens(row[e] or ''):
                heard[e].append((tok, k))
        piece_rows.append(row)
    live = [e for e in ears if any(r.get(e) is not None for r in piece_rows)]
    lyr_toks = [x[0] for x in lyr]
    matches, inserts = {}, {}
    for e in live:
        matches[e], inserts[e] = align(lyr_toks, heard[e])
    # 가사 음절마다 시각: 맞은 귀의 조각 안에서 그 조각에 들은 음절 차례대로 음절 시작을 붙인다.
    piece_onsets = {k: [o for o in onsets if p0 - 0.05 <= o['시작'] <= p1 + 0.02] for k, (p0, p1) in enumerate(pieces)}
    beat = grid['박']
    rows = []
    for i, (tok, line_no) in enumerate(lyr):
        ln = lyr_lines[line_no - 1]
        got = {}
        when = None
        for e in live:
            j = matches[e][i]
            if j is None:
                got[e] = '—'
                continue
            hj, piece = heard[e][j]
            got[e] = hj
            if when is None:
                same_piece = [x for x in range(len(heard[e])) if heard[e][x][1] == piece]
                order = same_piece.index(j)
                po = piece_onsets.get(piece) or []
                if po:
                    when = po[min(order, len(po) - 1)] if len(po) >= len(same_piece) else po[min(int(order * len(po) / len(same_piece)), len(po) - 1)]
                else:
                    when = {'시작': pieces[piece][0], '길이': pieces[piece][1] - pieces[piece][0]}
        exact = sum(1 for e in live if got.get(e) == tok)
        notes = []
        if not live:
            verdict = '못 잼'
        elif exact * 2 > len(live) or (len(live) == 1 and exact == 1):
            verdict = '통과'
        elif exact >= 1:
            verdict = '확인'
            notes.append('한 귀만 그 음절로 들음' if len(live) > 1 else '')
        else:
            verdict = '걸림' if len(live) > 1 else '확인'
            notes.append('어느 귀도 그 음절로 못 들음' if len(live) > 1 else '귀 하나가 다르게 들음')
        dur = when['길이'] if when else None
        if dur is not None and HANGUL.match(tok):
            if dur < 0.12:
                notes.append(f'짧음 {dur:.2f}초')
                verdict = '걸림' if verdict == '걸림' else '확인'
            if ln['끊어'] and dur < beat * 0.5:
                notes.append(f'끊어 부르는 줄인데 반 박({beat * 0.5:.2f}초) 아래')
                verdict = '걸림' if verdict == '걸림' else '확인'
        rows.append({'#': i + 1, '줄': line_no, '구간': ln['구간'], '음절': tok, '시작': when and when['시작'], '길이': dur,
                     '들림': got, '판정': verdict, '메모': '; '.join(n for n in notes if n)})
    # 가사에 없는 소리: 같은 자리(가사 i 앞)에 귀 둘 이상(귀가 하나면 그 하나)이 끼워 들은 것
    extra = {}
    for e in live:
        for pos, j in inserts[e]:
            extra.setdefault(pos, {}).setdefault(e, []).append(heard[e][j])
    extras = []
    need = 2 if len(live) >= 2 else 1
    for pos, by in sorted(extra.items()):
        if len(by) < need:
            continue
        sample = by[live[0]] if live[0] in by else next(iter(by.values()))
        toks_ = [x[0] for x in sample]
        prev_tok = lyr[pos - 1][0] if pos > 0 else None
        next_tok = lyr[pos][0] if pos < len(lyr) else None
        kind = '두 번 부름' if any(t in (prev_tok, next_tok) for t in toks_) else '가사에 없는 소리'
        piece = sample[0][1]
        extras.append({'가사 앞': pos + 1, '앞 음절': prev_tok, '뒤 음절': next_tok, '들림': {e: ''.join(x[0] for x in v_) for e, v_ in by.items()},
                       '종류': kind, '조각': piece, '초': pieces[piece][0]})
    # 조각마다 셈 맞대기: 그 조각에 맞춰진 가사 음절 수 · 음절 시작 수 · 귀마다 들은 음절 수.
    #   가사가 하나도 안 맞춰진 목소리 조각 → 「가사와 못 맞춘 목소리」(군소리 의심 — 귀가 못 알아들은 노래일 수도 있어 확인).
    #   음절 시작과 귀 둘 다 가사보다 하나 넘게 많음 → 「음절이 더 있음」(두 번 부름 · 군소리 의심).
    piece_counts = []
    for k, (p0, p1) in enumerate(pieces):
        mapped = set()
        for e in live:
            for i, j in enumerate(matches[e]):
                if j is not None and heard[e][j][1] == k and sub_cost(lyr_toks[i], heard[e][j][0]) < 0.6:
                    mapped.add(i)
        n_l = len(mapped)
        n_o = len(piece_onsets.get(k) or [])
        n_h = {e: sum(1 for x in heard[e] if x[1] == k) for e in live}
        row = {'조각': k, '초': [p0, p1], '가사음절': n_l, '음절시작': n_o, '들은음절': n_h,
               '가사': ''.join(lyr_toks[i] for i in sorted(mapped))}
        # 알아들은 비율: 귀가 들은 한글 음절 수(가장 많이 들은 귀) ÷ 그 조각에 있어야 할 음절 수(맞춰진 가사, 없으면 음절 시작 ÷ 1.4 —
        # 음절 시작은 한 음절을 둘로 쪼개 정답 표보다 1.3~1.6배 많이 잡힌다, 맞혀보기 11-11). 0.4 아래면 「알아듣기 어려움」.
        n_hh = {e: sum(1 for x in heard[e] if x[1] == k and HANGUL.match(x[0])) for e in live}
        expect = max(n_l, round(n_o / 1.4))
        heard_ratio = round(min(1.0, max(n_hh.values()) / expect), 2) if (n_hh and expect) else None
        row['알아들은비율'] = heard_ratio
        if n_l == 0 and (n_o >= 1 or any(n_h.values())):
            row['판정'] = '가사와 못 맞춘 목소리'
        elif heard_ratio is not None and expect >= 3 and heard_ratio < 0.4:
            row['판정'] = '알아듣기 어려움'
        elif n_l and n_o >= n_l + 2 and n_h and max(n_h.values()) >= n_l + 1:
            row['판정'] = '음절이 더 있음'
        piece_counts.append(row)
    for row in piece_counts:
        if row.get('판정') == '음절이 더 있음':
            extras.append({'가사 앞': None, '앞 음절': None, '뒤 음절': None, '들림': {e: next((r.get(e) for r in piece_rows if r['조각'] == row['조각']), '') for e in live},
                           '종류': f"음절이 더 있음(가사 {row['가사음절']} · 음절 시작 {row['음절시작']} · 들음 {row['들은음절']})", '조각': row['조각'], '초': row['초'][0]})
    # 박 어긋남(참고): 가사 음절 시작이 8분음표 눈금에서 얼마나 벗어났나
    for r in rows:
        if r['시작'] is not None:
            pos = (r['시작'] - grid['첫박']) / beat
            r['반박어긋남_ms'] = round(((pos * 2 - round(pos * 2)) / 2) * beat * 1000)
    total = len(rows)
    passed = sum(r['판정'] == '통과' for r in rows)
    flagged = [r for r in rows if r['판정'] == '걸림']
    checks = [r for r in rows if r['판정'] == '확인']
    hangul_rows = [r for r in rows if HANGUL.match(r['음절'])]
    ear_acc = {e: round(sum(1 for r in rows if r['들림'].get(e) == r['음절']) / max(total, 1), 3) for e in live}
    summary = {'이름': name, '곡': str(song), '후보': cand.get('id'), '길이': round(len(v) / SR, 2), **grid,
               '가사 음절': total, '한글 음절': len(hangul_rows), '통과': passed, '확인': len(checks), '걸림': len(flagged),
               '가사에 없는 소리': len(extras), '귀': live, '귀마다 맞게 들음': ear_acc,
               '못 들은 귀': {e: next((r.get(e + '_못들음') for r in piece_rows if r.get(e + '_못들음')), None) for e in ears if e not in live},
               'suno_hoot_cer': (cand.get('aligned') or {}).get('hoot_cer')}
    summary['가사와 못 맞춘 목소리'] = sum(1 for r in piece_counts if r.get('판정') == '가사와 못 맞춘 목소리')
    summary['알아듣기 어려운 조각'] = sum(1 for r in piece_counts if r.get('판정') == '알아듣기 어려움')
    ratios = [r['알아들은비율'] for r in piece_counts if r.get('알아들은비율') is not None]
    summary['알아들은 비율 중앙'] = round(float(np.median(ratios)), 2) if ratios else None
    result = {'요약': summary, '음절': rows, '가사에 없는 소리': extras, '조각': piece_rows, '조각 셈': piece_counts, '음절 시작': onsets, '덩어리': merged}
    (out_dir / f'{name}.검수.json').write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding='utf-8')
    (out_dir / f'{name}.보고.md').write_text(report_md(result), encoding='utf-8')
    return result


def fmt_t(x):
    if x is None:
        return '—'
    m, s = divmod(float(x), 60)
    return f'{int(m)}:{s:05.2f}'


def report_md(res):
    s = res['요약']
    out = [f"# 발음 검수 — {s['이름']}", '',
           f"- 곡 길이 {s['길이']}초 · {s['bpm']} BPM(한 박 {s['박']}초 · 첫 박 {s['첫박']}초 · 눈금 뚜렷함 {s['눈금뚜렷함']})",
           f"- 가사 음절 {s['가사 음절']} — 통과 {s['통과']} · 확인 {s['확인']} · 걸림 {s['걸림']}, 가사에 없는 소리 {s['가사에 없는 소리']}곳",
           f"- 조각마다 알아들은 비율 중앙 {s.get('알아들은 비율 중앙')} · 알아듣기 어려운 조각 {s.get('알아듣기 어려운 조각')} · 가사와 못 맞춘 목소리 {s.get('가사와 못 맞춘 목소리')}",
           f"- 귀: {', '.join(s['귀']) or '없음'} — 귀마다 가사 음절을 그대로 들은 비율 {s['귀마다 맞게 들음']}"
           + (f" · 못 들은 귀 {s['못 들은 귀']}" if any(s['못 들은 귀'].values()) else ''),
           '- 귀는 가사를 받지 않고 목소리 덩어리마다 따로 들었다. 판정은 사람 귀 대신이 아니다 — 유호님이 들으실 자리를 좁힌다.', '']
    bad = [r for r in res['음절'] if r['판정'] in ('걸림', '확인')]
    out += ['## 걸린 곳', '']
    if not bad and not res['가사에 없는 소리']:
        out.append('없음.')
    for r in bad:
        heard = ' / '.join(f"{e} 「{h}」" for e, h in r['들림'].items())
        out.append(f"- **{fmt_t(r['시작'])}** {r['판정']} — 줄 {r['줄']}({r['구간']}) 「{r['음절']}」: {heard}" + (f" · {r['메모']}" if r['메모'] else ''))
    for x in res['가사에 없는 소리']:
        heard = ' / '.join(f"{e} 「{h}」" for e, h in x['들림'].items())
        out.append(f"- **{fmt_t(x['초'])}** 걸림 — {x['종류']}: 「{x['앞 음절'] or ''}」와 「{x['뒤 음절'] or ''}」 사이에 {heard}")
    out += ['', '## 음절 표', '', '| # | 줄 | 음절 | 시작 | 길이 | ' + ' | '.join(s['귀']) + ' | 판정 | 메모 |',
            '|---|---|---|---|---|' + '---|' * len(s['귀']) + '---|---|']
    for r in res['음절']:
        dur = '—' if r['길이'] is None else format(r['길이'], '.2f')
        out.append(f"| {r['#']} | {r['줄']} | {r['음절']} | {fmt_t(r['시작'])} | {dur} | "
                   + ' | '.join(r['들림'].get(e, '') for e in s['귀']) + f" | {r['판정']} | {r['메모']} |")
    counts = {c['조각']: c for c in res.get('조각 셈', [])}
    for c in counts.values():
        if c.get('판정') == '가사와 못 맞춘 목소리':
            bad_line = f"- **{fmt_t(c['초'][0])}** 확인 — 가사와 못 맞춘 목소리(음절 시작 {c['음절시작']} · 들은 음절 {c['들은음절']}) — 군소리이거나 귀가 못 알아들은 노래"
        elif c.get('판정') == '알아듣기 어려움':
            bad_line = f"- **{fmt_t(c['초'][0])}** 걸림 — 알아듣기 어려움(있어야 할 음절의 {c['알아들은비율']:.0%}만 들림 · 맞춘 가사 「{c['가사']}」)"
        else:
            continue
        out.insert(out.index('## 음절 표') - 1 if '## 음절 표' in out else len(out), bad_line)
    out += ['', '## 조각마다 받아 적은 것', '', '| 조각 | 초 | 맞춘 가사 | 가사·시작·들음 | ' + ' | '.join(s['귀']) + ' | 셈 판정 |',
            '|---|---|---|---|' + '---|' * len(s['귀']) + '---|']
    for p in res['조각']:
        c = counts.get(p['조각'], {})
        cnt = f"{c.get('가사음절', '')}·{c.get('음절시작', '')}·" + '/'.join(str(v) for v in (c.get('들은음절') or {}).values()) + (f" ({c['알아들은비율']:.0%})" if c.get('알아들은비율') is not None else '')
        out.append(f"| {p['조각']} | {fmt_t(p['시작'])}–{fmt_t(p['끝'])} | {c.get('가사', '')} | {cnt} | "
                   + ' | '.join((p.get(e) or ('못 들음' if p.get(e + '_못들음') else '')).replace('|', '/') for e in s['귀']) + f" | {c.get('판정', '')} |")
    return '\n'.join(out) + '\n'


# ── 훅 견주기(메들리) ─────────────────────────────────────────────────

def hook_sections(res, starts):
    """메들리 한 후보를 훅마다 나눈다. starts = 훅마다 첫 가사 줄 번호(그 앞 카운트인 줄 포함, 예 [1, 7, 13]).
    훅마다: 그 줄들의 음절 · 귀마다 맞게 들은 비율 · 걸림 · 확인 · 가사에 없는 소리(초가 그 훅 안) · 시작~끝 초."""
    rows = res['음절']
    lines = sorted({r['줄'] for r in rows})
    bounds = []
    for k, s in enumerate(starts):
        e = starts[k + 1] if k + 1 < len(starts) else max(lines) + 1
        bounds.append((s, e))
    out = []
    for k, (s, e) in enumerate(bounds):
        rs = [r for r in rows if s <= r['줄'] < e]
        ts = [r['시작'] for r in rs if r['시작'] is not None]
        t0 = min(ts) if ts else None
        nxt = [r['시작'] for r in rows if r['줄'] >= e and r['시작'] is not None]
        t1 = min(nxt) if nxt else res['요약']['길이']
        ears = res['요약']['귀']
        acc = {e_: round(sum(1 for r in rs if r['들림'].get(e_) == r['음절']) / max(len(rs), 1), 3) for e_ in ears}
        extras = [x for x in res['가사에 없는 소리'] if t0 is not None and t0 - 0.3 <= x['초'] < t1]
        hard = [c for c in res.get('조각 셈', []) if c.get('판정') == '알아듣기 어려움' and t0 is not None and t0 - 0.3 <= c['초'][0] < t1]
        out.append({'훅': k + 1, '줄': [s, e - 1], '초': [t0, t1], '음절': len(rs), '귀마다맞게': acc,
                    '걸림': sum(r['판정'] == '걸림' for r in rs), '확인': sum(r['판정'] == '확인' for r in rs),
                    '가사에없는소리': [{'초': x['초'], '종류': x['종류'], '들림': x['들림']} for x in extras],
                    '알아듣기어려움': [c['초'] for c in hard],
                    '점수': round(acc.get('scribe', max(acc.values()) if acc else 0) - 0.08 * len(extras) - 0.05 * len(hard)
                                  - 0.02 * sum(r['판정'] == '걸림' for r in rs), 3)})
    return out


# ── 맞혀보기 ──────────────────────────────────────────────────────────

def onset_recall(onsets, truth, tol=0.07):
    starts = np.array([o['시작'] for o in onsets])
    hit = [float(np.min(np.abs(starts - t))) <= tol for t in truth] if len(starts) else [False] * len(truth)
    return sum(hit), len(truth)


def calibrate(gt_dir, out_dir, ears):
    """정답 폴더(--정답)의 정답.json을 읽는다:
      {"시각": [{"이름", "곡", "목소리", "바탕", "시각": [초…]}],          — 손으로 맞춘 음절 시각 표
       "곡": [{"이름", "곡", "목소리", "바탕", "후보": <후보.json>, "알려진": "결함"|"깨끗", "어디": [[초, 초]…], "무엇": "…"}]}
    시각: 시각 표마다 음절 시작이 0.07초 안에 있는 비율. 곡: 재기를 돌려 「알려진 결함」 자리(어디)에 걸림 · 가사에 없는 소리가 있는지,
    「깨끗」 판의 같은 자리에는 없는지."""
    gt = json.loads((Path(gt_dir) / '정답.json').read_text(encoding='utf-8'))
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    report = {'시각': [], '곡': []}
    for item in gt.get('시각', []):
        v = load(item['목소리'])
        _, onsets, _ = vocal_units(v)
        h, n = onset_recall(onsets, item['시각'])
        report['시각'].append({'이름': item['이름'], '맞음': h, '모두': n, '비율': round(h / max(n, 1), 3)})
        print(f"[시각] {item['이름']}: {h}/{n} ({h / max(n, 1):.0%}) 이 0.07초 안")
    for item in gt.get('곡', []):
        cand = json.loads(Path(item['후보']).read_text(encoding='utf-8')) if isinstance(item['후보'], str) else item['후보']
        res = measure(item['곡'], cand, out_dir, voc=item.get('목소리'), acc=item.get('바탕'), ears=ears, name=item['이름'])
        # 창 안 · 밖 밀도로 본다 — 곡 전체가 걸리는 곡(글자 구호)을 「잡음」으로 세지 않게.
        #   걸린 것 = 걸림 음절 + 가사에 없는 소리 + 알아듣기 어려운 조각(조각 셈), 1초에 몇 개인가.
        dur_all = res['요약']['길이']
        marks = [r['시작'] for r in res['음절'] if r['판정'] == '걸림' and r['시작'] is not None]
        marks += [x['초'] for x in res['가사에 없는 소리']]
        marks += [c['초'][0] for c in res.get('조각 셈', []) if c.get('판정') == '알아듣기 어려움'] * 3  # 조각 하나 = 음절 여럿
        hard = [c['초'] for c in res.get('조각 셈', []) if c.get('판정') == '알아듣기 어려움']
        hits = []
        for a, b in item.get('어디', []):
            inside = sum(1 for t in marks if a - 0.3 <= t <= b)
            outside = len(marks) - inside
            d_in = inside / max(b - a, 0.1)
            d_out = outside / max(dur_all - (b - a), 0.1)
            hard_in = [h for h in hard if h[1] > a and h[0] < b]
            hits.append({'구간': [a, b], '창안밀도': round(d_in, 2), '창밖밀도': round(d_out, 2), '알아듣기어려움': hard_in,
                         '잡음': bool(hard_in) or (d_in >= 2 * d_out and d_in > 0.5)})
        row = {'이름': item['이름'], '알려진': item['알려진'], '무엇': item.get('무엇'), '요약': res['요약'], '구간': hits}
        report['곡'].append(row)
        tag = '잡음' if all(h['잡음'] for h in hits) else ('일부' if any(h['잡음'] for h in hits) else '못 잡음')
        if item['알려진'] == '깨끗':
            tag = '깨끗하게 봄' if not any(h['잡음'] for h in hits) else '헛걸림'
        print(f"[곡] {item['이름']}({item['알려진']}): {tag} — " + ', '.join(
            f"{h['구간'][0]}~{h['구간'][1]}초 걸린 것 1초에 {h['창안밀도']}(창 밖 {h['창밖밀도']})" + (f" · 알아듣기 어려운 조각 {h['알아듣기어려움']}" if h['알아듣기어려움'] else '')
            for h in hits) + f" · 전체 Scribe 맞음 {res['요약']['귀마다 맞게 들음'].get('scribe')}")
    (out_dir / '맞혀보기.json').write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
    return report


def main():
    ap = argparse.ArgumentParser(description='노래 검수(LAB 21:00 노래)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('떼기')
    p.add_argument('out')
    p.add_argument('songs', nargs='+')
    p = sub.add_parser('재기')
    p.add_argument('song')
    p.add_argument('--후보', required=True)
    p.add_argument('--밖', required=True)
    p.add_argument('--목소리')
    p.add_argument('--바탕')
    p.add_argument('--귀', default='scribe,gemini')
    p.add_argument('--구간', nargs=2, type=float)
    p.add_argument('--이름')
    p.add_argument('--끊어', nargs='*', type=int)
    p = sub.add_parser('훅')
    p.add_argument('results', nargs='+', help='<이름>.검수.json 여럿(같은 메들리의 후보들)')
    p.add_argument('--첫줄', nargs='+', type=int, required=True, help='훅마다 첫 가사 줄 번호(카운트인 줄 포함)')
    p.add_argument('--이름', nargs='*', help='훅 이름(배고파 잠깐만 진짜 …)')
    p.add_argument('--밖')
    p = sub.add_parser('맞혀보기')
    p.add_argument('--정답', required=True)
    p.add_argument('--밖', required=True)
    p.add_argument('--귀', default='scribe,gemini')
    a = ap.parse_args()
    if a.cmd == '떼기':
        for k, (v, b) in separate(a.out, a.songs).items():
            print(k, v, b)
    elif a.cmd == '재기':
        cand = json.loads(Path(a.후보).read_text(encoding='utf-8'))
        res = measure(a.song, cand, a.밖, a.목소리, a.바탕, tuple(e for e in a.귀.split(',') if e), a.구간, a.이름, a.끊어)
        print(json.dumps(res['요약'], ensure_ascii=False, indent=1))
    elif a.cmd == '훅':
        table = {}
        for f in a.results:
            res = json.loads(Path(f).read_text(encoding='utf-8'))
            for h in hook_sections(res, a.첫줄):
                table.setdefault(h['훅'], []).append({'후보': res['요약']['이름'], **h})
        names = a.이름 or []
        for k, cands in sorted(table.items()):
            cands.sort(key=lambda c: -c['점수'])
            print(f"== 훅 {k} {names[k - 1] if k - 1 < len(names) else ''}")
            for c in cands:
                ex = '; '.join(f"{x['초']:.1f}초 {x['종류'][:14]} {x['들림']}" for x in c['가사에없는소리'])
                print(f"  {c['점수']:+.3f} {c['후보']} {c['초'][0]:.1f}~{c['초'][1]:.1f}초 · 귀 {c['귀마다맞게']} · 걸림 {c['걸림']} · 확인 {c['확인']}"
                      + (f" · 없는 소리 {ex}" if ex else '') + (f" · 알아듣기 어려움 {c['알아듣기어려움']}" if c['알아듣기어려움'] else ''))
        if a.밖:
            Path(a.밖).write_text(json.dumps(table, ensure_ascii=False, indent=1), encoding='utf-8')
    else:
        calibrate(a.정답, a.밖, tuple(e for e in a.귀.split(',') if e))


if __name__ == '__main__':
    main()

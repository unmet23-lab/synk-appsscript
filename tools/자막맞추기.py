# 자막 맞추기 공용 도구 — 회차마다 복사해 쓰던 make_srt_v1~v6.py(12개)·한번에_맞추기.py(3벌)를 합쳤다(2026-10-19). 유료 호출 없음.
#   python -X utf8 tools/자막맞추기.py srt <큐.json> [-o subtitles-en.srt] [--영상 완성본.mp4] [--덮어쓰기]
#       이미 있는 SRT는 내용이 같으면 그대로, 다르면 --덮어쓰기 없이 멈춘다(게시한 자막을 말없이 바꾸지 않게).
#       큐 표(JSON)로 SRT를 만든다. 시각은 초(숫자)·박({"박": k})·원곡 시각({"원곡": t}, 끼운 마디만큼 밀림)으로 적고 "앞": true면 앞당김(기본 0.15초)만큼 당긴다.
#       큐가 겹치거나 거꾸로 가면 쓰지 않고 멈춘다. --영상을 주면 영상 끝을 넘는 큐도 막는다.
#   python -X utf8 tools/자막맞추기.py srt --시각 <take.json|*.align.json> --계획 <계획.json> [-o subtitles-ko.srt] [--시작 0] [--앞당김 0] [--머묾 0.3]
#       나레이션 테이크의 줄 시각(tools/나레이션굽기.mjs의 take.json, 또는 아래 정렬 결과)으로 줄마다 큐 하나를 만든다(화면 글은 show, 없으면 text).
#   python -X utf8 tools/자막맞추기.py 정렬 <테이크.wav…> --계획 <계획.json> [--segs c1,c2] [--모델 small] [--출력폴더 폴더] [--덮어쓰기]
#       한 번에 읽힌 테이크(Gemini·녹음)를 로컬 받아쓰기(faster-whisper)로 듣고 대본 낱말에 시각을 붙인다 → <wav>.align.json.
#       Typecast로 줄마다 구운 판은 받아쓰기보다 tools/나레이션굽기.mjs의 take.json(Typecast 낱말 시각)이 정확하다(숫자 많은 문장 경계 0.3~0.7초 오차).
#   python -X utf8 tools/자막맞추기.py 대조 <완성본.mp4|wav> --자막 <자막.srt> [--줄 1] [--언어 ko] [--기준 0.8] [--모델 small] [--다시보기 medium,large-v3-turbo] [-o 결과.json]
#       완성본 소리를 받아써서 큐마다 들린 글과 자막 글을 견준다. 걸린 큐만 다른 모델로 자르는 자리 다섯 곳에서 다시 듣는다.
#       결과 JSON(text·segments 포함)은 node tools/영상사전검사.mjs --transcript에 그대로 넣을 수 있다. 판정은 귀로 하는 확인을 대신하지 않는다.
# 받아쓰기 모델은 이 PC 캐시(small·medium·large-v3-turbo)만 쓴다(HF_HUB_OFFLINE=1). 숫자는 원문·받아쓰기 모두 한자어·고유어 읽기로도 바꿔 견준다.
import argparse
import difflib
import json
import math
import os
import re
import subprocess
import sys
import tempfile

LEAD = 0.15                # 박·원곡 시각을 당기는 기본값(노래 자막은 부르기 0.15초 전에 뜬다)
THR = -40.0                # 말소리로 보는 크기(dBFS, 10ms 창)
MIN_GAP = 0.06             # 이보다 긴 조용한 구간을 쉼으로 본다
FFMPEG = os.environ.get('SYNK_FFMPEG_EXE', 'ffmpeg')
FFPROBE = os.environ.get('SYNK_FFPROBE_EXE', 'ffprobe')


class 자막오류(Exception):
    pass


def read_json(path):
    with open(path, encoding='utf-8-sig') as fh:
        return json.load(fh)


def write_json(path, value):
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(value, fh, ensure_ascii=False, indent=1)


# ── SRT 쓰기 ──────────────────────────────────────────────────────────────
def ts(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


def parse_ts(text):
    h, m, rest = text.strip().split(':')
    s, ms = rest.replace('.', ',').split(',')
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def check_cues(cues, video_seconds=None):
    """(시작, 끝, [줄…]) 목록을 검사한다. 끝 ≤ 시작, 앞 큐와 겹침, 빈 글, 영상 끝 넘김은 오류. 긴 줄은 경고."""
    errors, warnings, prev = [], [], 0.0
    for i, (a, z, lines) in enumerate(cues, 1):
        if not z > a:
            errors.append(f'{i}번 큐: 끝 {z}초가 시작 {a}초보다 늦지 않다')
        if a < prev - 1e-6:
            errors.append(f'{i}번 큐: 시작 {a}초가 앞 큐 끝 {prev}초보다 이르다(겹침)')
        if not any(str(x).strip() for x in lines):
            errors.append(f'{i}번 큐: 글이 비었다')
        for x in lines:
            if len(str(x)) > 42:
                warnings.append(f'{i}번 큐: 한 줄 {len(str(x))}자 — 휴대폰에서 두 줄로 접힐 수 있다: {x}')
        if video_seconds is not None and z > video_seconds + 0.25:
            errors.append(f'{i}번 큐: 끝 {z}초가 영상 끝 {video_seconds:.3f}초를 넘는다')
        prev = max(prev, z)
    return errors, warnings


def render_srt(cues):
    return '\n'.join(f'{i}\n{ts(a)} --> {ts(z)}\n' + ''.join(f'{x}\n' for x in lines) for i, (a, z, lines) in enumerate(cues, 1))


def write_srt(cues, path, video_seconds=None, overwrite=False):
    """검사를 통과한 큐만 쓴다. 이미 있는 파일은 내용이 같으면 그대로 두고, 다르면 overwrite가 있어야 바꾼다(올린 자막을 말없이 바꾸지 않게)."""
    errors, warnings = check_cues(cues, video_seconds)
    if errors:
        raise 자막오류('자막을 쓰지 않았다:\n  ' + '\n  '.join(errors))
    text = render_srt(cues)
    if os.path.exists(path):
        with open(path, 'rb') as fh:
            if fh.read() == text.encode('utf-8'):
                return warnings
        if not overwrite:
            raise 자막오류(f'이미 있는 다른 자막을 덮지 않는다: {path}\n  올린 자막이면 그대로 두고 새 이름으로 쓰거나(-o), 바꿀 거면 --덮어쓰기')
    folder = os.path.dirname(os.path.abspath(path))
    os.makedirs(folder, exist_ok=True)
    part = path + '.part'
    with open(part, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    os.replace(part, path)
    return warnings


def read_srt(path):
    with open(path, encoding='utf-8-sig') as fh:
        text = fh.read().replace('\r\n', '\n')
    cues = []
    for block in re.split(r'\n\s*\n', text.strip()):
        rows = block.split('\n')
        k = next((j for j, r in enumerate(rows) if '-->' in r), None)
        if k is None:
            continue
        a, z = [parse_ts(x) for x in rows[k].split('-->')]
        cues.append((a, z, rows[k + 1:]))
    return cues


# ── 큐 표(JSON) → 큐 ─────────────────────────────────────────────────────
class 시각표:
    """노래 자막 시각: 박 눈금(bpm·첫박), 끼운 마디(원곡 시각 이후를 밀기), 앞당김. make_srt_v*.py의 b()·sh()·at()와 같은 반올림."""

    def __init__(self, spec):
        beat = spec.get('박자') or {}
        self.beat = 60 / float(beat['bpm']) if beat.get('bpm') else None
        self.first = float(beat.get('첫박', 0))
        self.ins = [(float(a), float(n)) for a, n in spec.get('끼움', [])]
        self.lead = float(spec.get('앞당김', LEAD))

    def shift(self, t):
        return round(t + sum(n for c, n in self.ins if t >= c), 3)

    def at(self, v):
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            return round(float(v), 3)
        if not isinstance(v, dict):
            raise 자막오류(f'시각을 읽지 못했다: {v!r}')
        if '박' in v:
            if self.beat is None:
                raise 자막오류('박으로 적은 시각이 있는데 "박자": {"bpm": …, "첫박": …}가 없다')
            t = self.shift(self.first + self.beat * float(v['박']))
        elif '원곡' in v:
            t = self.shift(float(v['원곡']))
        elif '초' in v:
            t = round(float(v['초']), 3)
        else:
            raise 자막오류(f'시각에 박·원곡·초 가운데 하나가 필요하다: {v!r}')
        lead = v.get('앞', False)
        if lead is True:
            t = round(t - self.lead, 3)
        elif isinstance(lead, (int, float)) and not isinstance(lead, bool) and lead:
            t = round(t - float(lead), 3)
        if '더' in v:
            t = round(t + float(v['더']), 3)
        return t


def cues_from_spec(spec):
    tt = 시각표(spec)
    cues = []
    for c in spec.get('cues', []):
        if isinstance(c, list):
            a, z, *lines = c
        else:
            a, z, lines = c['start'], c['end'], c.get('lines') or [x for x in (c.get('ko'), c.get('en')) if x]
        cues.append((tt.at(a), tt.at(z), [str(x) for x in lines]))
    end = spec.get('끝화면')
    if end:
        # 끝 화면 「읽어 볼까요?」: 물음 1.15초 → 낱말마다 (보여 주기 1초 → 답 1초), 마지막 답은 끝까지(make_srt_v*.py와 같은 셈)
        start = tt.at(end['시작'])
        if end.get('물음'):
            cues.append((start, round(start + 1.15, 3), [str(x) for x in end['물음']]))
        words = end.get('낱말', [])
        hint = end.get('힌트', 'Try it first!')
        last = tt.at(end['끝']) if end.get('끝') is not None else round(start + 1.2 + 2 * (len(words) - 1) + 3.1, 3)
        for i, w in enumerate(words):
            ko, en = w[0], w[1]
            answer = w[2] if len(w) > 2 else ko + '!'
            s, v = round(start + 1.2 + 2 * i, 3), round(start + 2.2 + 2 * i, 3)
            nxt = round(start + 3.2 + 2 * i, 3) if i < len(words) - 1 else last
            cues += [(s, v, [ko, hint]), (v, round(nxt - 0.05, 3), [answer, en])]
    return cues


def cues_from_timing(timing, plan, offset=0.0, lead=0.0, hold=0.3):
    """take.json·align.json의 segs(줄마다 start·end)와 계획의 화면 글로 줄마다 큐 하나. 다음 줄 0.02초 전에는 내린다."""
    segs = timing.get('segs') or {}
    lines = plan_lines(plan)
    order = [l for l in lines if l['id'] in segs]
    if not order:
        raise 자막오류('시각 파일과 계획에 같은 줄 id가 없다')
    cues = []
    for i, l in enumerate(order):
        g = segs[l['id']]
        a = round(offset + g['start'] - lead, 3)
        z = round(offset + g['end'] + hold, 3)
        if i + 1 < len(order):
            z = min(z, round(offset + segs[order[i + 1]['id']]['start'] - lead - 0.02, 3))
        text = str(l.get('show') or l['text'])
        cues.append((max(0.0, a), z, [x for x in re.split(r'\s*\|\s*|\n', text) if x]))
    return cues


def plan_lines(plan, segs=None):
    """계획 파일의 줄: lines 또는 segments(+ variants는 --segs로 고를 때만)."""
    lines = list(plan.get('lines') or plan.get('segments') or [])
    if segs:
        extra = [dict(v, id=k) for k, v in (plan.get('variants') or {}).items()]
        lines = [s for s in lines + extra if s['id'] in segs]
    return lines


# ── 소리 읽기 ─────────────────────────────────────────────────────────────
def decode(path, rate=16000):
    import numpy as np
    r = subprocess.run([FFMPEG, '-v', 'error', '-nostdin', '-i', path, '-vn', '-ac', '1', '-ar', str(rate), '-f', 's16le', '-'], capture_output=True, stdin=subprocess.DEVNULL)
    if r.returncode != 0:
        raise 자막오류('소리를 읽지 못했다: ' + r.stderr.decode('utf-8', 'replace')[-300:])
    return np.frombuffer(r.stdout, np.int16).astype(np.float32) / 32768


def native_rate(path):
    r = subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', path], capture_output=True, text=True, encoding='utf-8')
    try:
        return int(r.stdout.strip().split()[0])
    except (ValueError, IndexError):
        raise 자막오류('소리 표본율을 읽지 못했다: ' + path)


def media_seconds(path):
    r = subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration:format=duration', '-of', 'json', path], capture_output=True, text=True, encoding='utf-8')
    j = json.loads(r.stdout or '{}')
    v = (j.get('streams') or [{}])[0].get('duration') or j.get('format', {}).get('duration')
    return float(v) if v else None


def levels(x, sr):
    import numpy as np
    win = int(0.01 * sr)
    n = len(x) // win
    e = (x[:n * win].reshape(n, win) ** 2).mean(1)
    return 10 * np.log10(e + 1e-12)


def silences(lv):
    out, k = [], 0
    while k < len(lv):
        if lv[k] <= THR:
            j = k
            while j < len(lv) and lv[j] <= THR:
                j += 1
            if (j - k) / 100 >= MIN_GAP:
                out.append((k / 100, j / 100))
            k = j
        else:
            k += 1
    return out


def f0_track(x, sr):
    import numpy as np
    fr, hop, vals = int(0.04 * sr), int(0.02 * sr), []
    lo, hi = int(sr / 350), int(sr / 65)
    for i in range(0, len(x) - fr, hop):
        seg = x[i:i + fr]
        seg = seg - seg.mean()
        if 10 * np.log10((seg ** 2).mean() + 1e-12) < THR + 12:
            continue
        ac = np.correlate(seg, seg, 'full')[fr - 1:]
        if ac[0] <= 0:
            continue
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] / ac[0] > 0.5:
            vals.append(sr / k)
    return np.array(vals)


# ── 받아쓰기 ─────────────────────────────────────────────────────────────
_models = {}


def whisper(name):
    os.environ.setdefault('HF_HUB_OFFLINE', '1')
    if name not in _models:
        from faster_whisper import WhisperModel
        _models[name] = WhisperModel(name, device='cpu', compute_type='int8', cpu_threads=8)
    return _models[name]


def transcribe(model_name, audio, language='ko'):
    """(낱말, 시작, 끝) 목록과 들린 글 전체. audio는 16kHz 모노 float32 또는 파일 경로."""
    segs, _ = whisper(model_name).transcribe(audio, language=language, beam_size=5, vad_filter=False, word_timestamps=True, condition_on_previous_text=False)
    words, text = [], []
    for sg in segs:
        text.append(sg.text)
        for w in (sg.words or []):
            words.append((w.word, float(w.start), float(w.end)))
    return words, ''.join(text).strip()


# ── 정렬(한번에_맞추기.py) ───────────────────────────────────────────────
def norm(s):
    return re.sub(r'[^가-힣A-Za-z0-9]', '', s)


def align_take(segments, x, sr, words):
    """대본 줄(segments: id·text)과 받아쓰기 낱말로 줄마다 시작·끝·낱말 시각을 붙인다(한번에_맞추기.py와 같은 셈)."""
    S, owner = [], []
    for si, s in enumerate(segments):
        for ti, tk in enumerate(s['text'].split()):
            for ch in norm(tk):
                S.append(ch)
                owner.append((si, ti))
    lv = levels(x, sr)
    import numpy as np
    voiced = np.where(lv > THR)[0]
    if not len(voiced):
        raise 자막오류('말소리가 없다')
    on, off = voiced[0] / 100, (voiced[-1] + 1) / 100
    sil = [g for g in silences(lv) if g[0] > on and g[1] < off]
    R, rt0, rt1 = [], [], []
    for word, start, end in words:
        cs = norm(word)
        for i, ch in enumerate(cs):
            R.append(ch)
            rt0.append(start + (end - start) * i / len(cs))
            rt1.append(start + (end - start) * (i + 1) / len(cs))
    sm = difflib.SequenceMatcher(None, S, R, autojunk=False)
    t0 = [None] * len(S)
    t1 = [None] * len(S)
    ridx = [None] * len(S)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            t0[a + k] = rt0[b + k]
            t1[a + k] = rt1[b + k]
            ridx[a + k] = b + k
    known = [i for i in range(len(S)) if t0[i] is not None]

    def fill(arr):
        for i in range(len(S)):
            if arr[i] is not None:
                continue
            prev = max([k for k in known if k < i], default=None)
            nxt = min([k for k in known if k > i], default=None)
            if prev is None and nxt is None:
                arr[i] = on
            elif prev is None:
                arr[i] = arr[nxt]
            elif nxt is None:
                arr[i] = arr[prev]
            else:
                arr[i] = arr[prev] + (arr[nxt] - arr[prev]) * (i - prev) / (nxt - prev)
    fill(t0)
    fill(t1)
    out = {}
    for si, s in enumerate(segments):
        idx = [i for i in range(len(S)) if owner[i][0] == si]
        if not idx:
            raise 자막오류(f'{s["id"]}: 견줄 글자가 없다')
        toks = []
        for ti in range(len(s['text'].split())):
            first = next((i for i in idx if owner[i][1] == ti), None)
            toks.append(t0[first] if first is not None else t0[idx[0]])
        a, b = t0[idx[0]], t1[idx[-1]]
        # 시작: 바로 앞(−0.3~+0.12초)에 쉼이 있으면 그 쉼이 끝나는 곳, 끝: 바로 뒤(−0.15~+0.35초)에 쉼이 있으면 쉼이 시작하는 곳
        pre = [g for g in sil if a - 0.3 <= g[1] <= a + 0.12]
        if pre:
            a = pre[-1][1]
        if si == 0:
            a = on
        post = [g for g in sil if b - 0.15 <= g[0] <= b + 0.35]
        if post:
            b = post[0][0]
        if si == len(segments) - 1:
            b = off
        toks[0] = a
        toks = [max(t, a) for t in toks]
        rs = [ridx[i] for i in idx if ridx[i] is not None]
        got = ''.join(R[min(rs):max(rs) + 1]) if rs else ''
        out[s['id']] = {'start': round(a, 3), 'end': round(b, 3), 'tokens': [round(t, 3) for t in toks],
                        'match': round(difflib.SequenceMatcher(None, norm(s['text']), got, autojunk=False).ratio(), 3), 'heard': got}
    return out, sm.ratio(), on, off, sil


def run_align(files, plan, segs, model_name, out_dir=None, overwrite=False):
    rows = []
    segments = plan_lines(plan, segs)
    targets = [os.path.join(out_dir or os.path.dirname(os.path.abspath(w)), re.sub(r'\.[^.]+$', '', os.path.basename(w)) + '.align.json') for w in files]
    for t in targets:
        if os.path.exists(t) and not overwrite:
            raise 자막오류(f'이미 있는 정렬 결과를 덮지 않는다: {t}\n  다른 곳에 쓰려면 --출력폴더, 다시 쓰려면 --덮어쓰기')
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    for wav, target in zip(files, targets):
        # 크기·쉼은 원래 표본율로 재고(한번에_맞추기.py와 같게), 받아쓰기는 파일을 그대로 준다(faster-whisper가 16kHz로 푼다).
        sr = native_rate(wav)
        x = decode(wav, sr)
        dur = len(x) / sr
        words, heard = transcribe(model_name, wav)
        out, ratio, on, off, sil = align_take(segments, x, sr, words)
        ids = [s['id'] for s in segments]
        gaps = {ids[i + 1]: round(out[ids[i + 1]]['start'] - out[ids[i]]['end'], 3) for i in range(len(ids) - 1)}
        pause_total = sum(g[1] - g[0] for g in sil)
        syl = sum(len(re.findall(r'[가-힣]', s['text'])) + 2 * len(re.findall(r'[A-Za-z]+', s['text'])) for s in segments)
        import numpy as np
        f0 = f0_track(x, sr)
        f0 = f0[(f0 > 60) & (f0 < 320)]
        st = 12 * np.log2(f0 / np.median(f0)) if len(f0) else np.array([0.0])
        res = {'file': os.path.basename(wav), 'seconds': round(dur, 2), 'lead': round(on, 2), 'tail': round(dur - off, 2), 'speech': round(off - on, 2),
               'match': round(ratio, 3), 'syl_per_s': round(syl / (off - on), 2), 'artic_per_s': round(syl / max(0.1, off - on - pause_total), 2),
               'pauses': len(sil), 'pause_total': round(pause_total, 2), 'longest_pause': round(max([g[1] - g[0] for g in sil], default=0), 2),
               'f0_median': round(float(np.median(f0)), 1) if len(f0) else 0, 'f0_st_sd': round(float(np.std(st)), 2),
               'gaps': gaps, 'segs': out, 'heard': heard, 'stt': model_name, 'tool': 'tools/자막맞추기.py 정렬'}
        write_json(target, res)
        rows.append(res)
        worst = sorted(out.items(), key=lambda kv: kv[1]['match'])[:2]
        print(f"{res['file']:<34} {dur:5.1f}초 말 {res['speech']:5.1f} 일치 {res['match']:.3f} 초당 {res['syl_per_s']:.1f}(발화 {res['artic_per_s']:.1f}) 쉼 {res['pauses']}개 {res['pause_total']:.1f}초 최장 {res['longest_pause']:.2f} F0 {res['f0_median']:.0f}Hz ±{res['f0_st_sd']:.1f}반음 | 약한 곳 " + ', '.join(f"{k} {v['match']:.2f}" for k, v in worst), flush=True)
    return rows


# ── 대조(받아쓰기 ↔ 자막) ───────────────────────────────────────────────
DIG = '영일이삼사오육칠팔구'
NATIVE_ONES = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉']
NATIVE_TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔']


def sino(n):
    """한자어 수 읽기: 16 → 십육, 2026 → 이천이십육, 10000 → 만."""
    if n == 0:
        return '영'
    out = []
    for unit, size in (('조', 10 ** 12), ('억', 10 ** 8), ('만', 10 ** 4), ('', 1)):
        part, n = divmod(n, size)
        if not part:
            continue
        s = ''
        for u, d in (('천', 1000), ('백', 100), ('십', 10), ('', 1)):
            q, part = divmod(part, d)
            if q:
                s += ('' if (q == 1 and u) else DIG[q]) + u
        if unit == '만' and s == '일':
            s = ''
        out.append(s + unit)
    return ''.join(out)


def native(n):
    """고유어 수 읽기(1~99): 16 → 열여섯. 그 밖은 한자어로."""
    if 1 <= n <= 99:
        return NATIVE_TENS[n // 10] + NATIVE_ONES[n % 10]
    return sino(n)


def readings(s):
    """견줄 판들: 그대로, 숫자를 한자어로, 숫자를 고유어로(소문자·문장부호 뺌)."""
    base = norm(s).lower()
    out = {base}
    for f in (sino, native):
        out.add(norm(re.sub(r'\d+', lambda m: f(int(m.group())), s.replace(',', ''))).lower())
    return out


def similarity(expected, heard):
    best = 0.0
    for a in readings(expected):
        for b in readings(heard):
            if not a and not b:
                return 1.0
            best = max(best, difflib.SequenceMatcher(None, a, b, autojunk=False).ratio())
    return round(best, 3)


def heard_in(words, a, z, pad=0.25):
    return ''.join(w for w, s, e in words if a - pad <= (s + e) / 2 <= z + pad).strip()


def compare_cues(cues, words, line=1, threshold=0.8):
    rows = []
    for i, (a, z, lines) in enumerate(cues, 1):
        expected = lines[line - 1] if len(lines) >= line else ''
        heard = heard_in(words, a, z)
        sim = similarity(expected, heard) if expected else None
        rows.append({'cue': i, 'start': a, 'end': z, 'expected': expected, 'heard': heard, 'similarity': sim,
                     'flag': sim is not None and sim < threshold})
    return rows


def recheck(x, sr, row, models, language, threshold):
    """걸린 큐를 자르는 자리 다섯 곳 × 모델마다 다시 듣는다. 두 모델이 같이 맞다고 할 때만 판정을 바꾼다."""
    best = {}
    for name in models:
        top = (0.0, '')
        for d in (-0.2, -0.1, 0.0, 0.1, 0.2):
            a, z = max(0.0, row['start'] - 0.3 + d), row['end'] + 0.3 + d
            piece = x[int(a * sr):int(z * sr)]
            if len(piece) < sr * 0.2:
                continue
            _, text = transcribe(name, piece, language)
            sim = similarity(row['expected'], text)
            if sim > top[0]:
                top = (sim, text)
        best[name] = {'similarity': top[0], 'heard': top[1]}
    ok = [v['similarity'] >= threshold for v in best.values()]
    verdict = '다시 들으니 맞음(처음 모델이 잘못 들음)' if ok and all(ok) else '다시 들어도 다름 — 귀로 확인' if not any(ok) else '모델마다 다름 — 귀로 확인'
    return best, verdict


def run_compare(media, srt, line, language, threshold, model_name, rechecks, out_path):
    cues = read_srt(srt)
    x = decode(media, 16000)
    words, text = transcribe(model_name, x, language)
    rows = compare_cues(cues, words, line, threshold)
    for row in rows:
        if row['flag'] and rechecks:
            row['recheck'], row['verdict'] = recheck(x, 16000, row, rechecks, language, threshold)
    flagged = [r for r in rows if r['flag'] and not str(r.get('verdict', '')).startswith('다시 들으니 맞음')]
    report = {'tool': 'tools/자막맞추기.py 대조', 'media': os.path.abspath(media), 'subtitle': os.path.abspath(srt), 'model': model_name, 'rechecks': rechecks,
              'language': language, 'line': line, 'threshold': threshold, 'cues': rows, 'needsEar': [r['cue'] for r in flagged],
              'text': text, 'segments': [{'start': r['start'], 'end': r['end'], 'text': r['heard']} for r in rows],
              'note': '받아쓰기 판정은 귀로 하는 확인을 대신하지 않는다. 낱말 하나짜리 큐는 받아쓰기 쪽이 자주 틀린다.'}
    if out_path:
        write_json(out_path, report)
    for r in rows:
        mark = '  ' if not r['flag'] else ('✓ ' if str(r.get('verdict', '')).startswith('다시 들으니 맞음') else '⚠ ')
        sim = '-' if r['similarity'] is None else f"{r['similarity']:.2f}"
        print(f"{mark}{r['cue']:>3} {ts(r['start'])} {sim:>5}  {r['expected']}  |  {r['heard']}" + (f"  → {r['verdict']}" if r.get('verdict') else ''), flush=True)
    print(f'큐 {len(rows)}개 · 귀로 확인할 큐 {len(flagged)}개' + (f' → {out_path}' if out_path else ''))
    return report


# ── 명령 ─────────────────────────────────────────────────────────────────
def main(argv=None):
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    p = argparse.ArgumentParser(prog='자막맞추기.py', description='SRT 만들기·받아쓰기 정렬·받아쓰기 대조(유료 호출 없음)')
    sub = p.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('srt')
    s.add_argument('spec', nargs='?')
    s.add_argument('-o', '--out')
    s.add_argument('--영상')
    s.add_argument('--시각')
    s.add_argument('--계획')
    s.add_argument('--시작', type=float, default=0.0)
    s.add_argument('--앞당김', type=float, default=0.0)
    s.add_argument('--머묾', type=float, default=0.3)
    s.add_argument('--덮어쓰기', action='store_true')
    a = sub.add_parser('정렬')
    a.add_argument('files', nargs='+')
    a.add_argument('--계획', required=True)
    a.add_argument('--segs')
    a.add_argument('--모델', default=os.environ.get('STT_MODEL', 'small'))
    a.add_argument('--출력폴더')
    a.add_argument('--덮어쓰기', action='store_true')
    c = sub.add_parser('대조')
    c.add_argument('media')
    c.add_argument('--자막', required=True)
    c.add_argument('--줄', type=int, default=1)
    c.add_argument('--언어', default='ko')
    c.add_argument('--기준', type=float, default=0.8)
    c.add_argument('--모델', default='small')
    c.add_argument('--다시보기', default='')
    c.add_argument('-o', '--out')
    o = p.parse_args(argv)
    try:
        if o.cmd == 'srt':
            video = media_seconds(o.영상) if o.영상 else None
            if o.시각:
                if not o.계획:
                    raise 자막오류('--시각에는 --계획(줄의 화면 글)이 필요하다')
                timing = read_json(o.시각)
                plan = read_json(o.계획)
                cues = cues_from_timing(timing, plan, o.시작, o.앞당김, o.머묾)
                out = o.out or os.path.join(os.path.dirname(os.path.abspath(o.시각)), 'subtitles-' + str(plan.get('language') or 'ko') + '.srt')
            else:
                if not o.spec:
                    raise 자막오류('큐 표 JSON을 주거나 --시각·--계획을 준다')
                spec = read_json(o.spec)
                cues = cues_from_spec(spec)
                out = o.out or (os.path.join(os.path.dirname(os.path.abspath(o.spec)), 'subtitles-' + spec['언어'] + '.srt') if spec.get('언어') else None)
                if not out:
                    raise 자막오류('-o로 출력 파일을 주거나 큐 표에 "언어"를 적는다(subtitles-<언어>.srt)')
            for w in write_srt(cues, out, video, o.덮어쓰기):
                print('⚠ ' + w)
            print(f'{len(cues)}줄 {out}')
        elif o.cmd == '정렬':
            plan = read_json(o.계획)
            run_align(o.files, plan, o.segs.split(',') if o.segs else None, o.모델, o.출력폴더, o.덮어쓰기)
        elif o.cmd == '대조':
            rechecks = [x for x in o.다시보기.split(',') if x]
            out = o.out or re.sub(r'\.[^.]+$', '', o.media) + '.대조.json'
            run_compare(o.media, o.자막, o.줄, o.언어, o.기준, o.모델, rechecks, out)
    except 자막오류 as e:
        print(str(e), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

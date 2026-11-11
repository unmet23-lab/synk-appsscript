#!/usr/bin/env python
"""곡 손질 — 받은 노래를 영상 길이로 자르고, 생각할 틈(반주만 흐르는 마디)을 끼우고, 끝이 첫 마디로 이어지게 다듬는다
(2026-11-11 Claude, LAB 21:00 노래 · 리듬 한국어 준비안 「다」 줄). 곡마다 따로 짜던 스크립트를 하나로 묶었다:
  첫 인사 · 애 에 `make_song_v2.py`(떠올리기 틈 한 마디 — 앞 60ms · 뒤 6~8ms 겹침), 겹모음 `make_song_v3.py`(한 박 쉼 · 무음 이음),
  그 아 가 `work4/make_song_v4.py`(물음 끝을 답에 이어 부른 곳은 답이 솟는 순간 10ms 앞에서 자름) — 모두 공용 작업본
  `.tmp/hangul-mascot-video-20261006/<곡>/work/`.

  python -X utf8 tools/곡손질.py <계획.json> [--밖 <폴더>] [--미리]
    → <밖>/<이름>.wav(48kHz 스테레오) · <이름>.mp3(192k) · <이름>.손질.json(원곡 시각 → 손질본 시각 대응 · 이음매 검사)

계획.json:
  {"이름": "배고파_v1",
   "곡": "<원곡 — Suno 공식 내려받기본>", "바탕": "<그 곡의 Demucs 바탕 갈래>", "목소리": "<목소리 갈래 — 자를 곳 찾기용>",
   "박": {"bpm": 100.0, "첫박": 0.31} | "자동"(바탕에서 잰다 — tools/노래검수.py의 박자 눈금),
   "마디첫박": 0,                      # 첫박에서 몇 박 뒤가 마디 첫 박인가(시작이 못갖춘마디면 1~3)
   "끼우기": [{"곳": 21.79, "길이": "마디"|"박"|<초>, "찾기": "골"|"솟음"|null, "앞겹침": 0.06, "뒤겹침": 0.008}],
        # 원곡 시각 「곳」 바로 앞에 같은 길이만큼의 반주(바로 앞 그 길이의 바탕 갈래 — 박 자리가 그대로라 반주가 안 끊긴다)를 끼운다.
        # 찾기 골 = ±0.15초 안 목소리(300~3000Hz) 세기의 가장 낮은 곳, 솟음 = 답이 솟는 순간의 10ms 앞(이어 부른 물음 · 답).
        # "원천마디": n · "원천끝마디": k(선택) — 끼울 반주를 「곳」에서 k마디 앞에서 끝나는 n마디로 떠서 되풀이해 채운다(박 자리는 마디 단위라 그대로).
        #   바로 앞 그 길이가 카운트인 · 스톱 타임(박 사이 반주가 멎는 편곡)처럼 빈 자리면 끼운 마디가 뚝 꺼진다(11-12 메들리 A 「진짜」 −41.8dB ·
        #   네 차례 마디 안 0.4~0.65초 무음). 되풀이 이음은 앞 조각 끝을 원천 바로 앞 소리와 겹쳐(10ms) 다음 조각 처음으로 잇고,
        #   끼운 반주 뒤 「곳」으로 돌아가는 이음은 원천 끝 뒤 소리에서 들어온다(뒤겹침). 둘 다 없으면 예전처럼 「곳」 바로 앞 그 길이.
   "자르기": [시작초, 끝초, (끝빼기초)] | {"시작마디": n, "마디수": m},   # 원곡 시각. 마디 수로 주면 마디 첫 박에 맞춰 자른다.
        # 끝빼기 = 끼운 뒤 시각에서 끝을 당기는 길이(시작을 못갖춘마디만큼 당겼을 때 끝도 같이 — 셋째 값을 주면 마디에 맞춘 것으로 본다)
   "잇기": {"겹침": 0.04},             # 끝 뒤 꼬리를 처음에 겹쳐 더해 되풀이 재생이 이어지게(끝 · 시작은 마디 첫 박이어야 한다)
   "목표길이": [15, 18]}
끼우기는 원곡 시각에서 하고, 자르기는 끼운 뒤의 시각으로 옮겨 적용한다(손질.json 「대응」 — 영상 틀이 음절 시각을 이걸로 옮긴다).
검사: 길이가 목표 밖이면, 이음매 앞뒤 세기 차가, 되풀이 이음(끝 ↔ 원곡에서 시작 바로 앞)이 크면 「확인할 것」으로
적고 종료 코드 1(창 80ms · 문턱 8dB — 20ms 창은 북 소리 사이 틈을 끊김으로 잰다). 소리를 고르게 · 크게 하지 않는다(음량 마감은 영상 렌더 뒤 tools/음량마감.mjs).
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.stdout.reconfigure(encoding='utf-8')
SR = 48000


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def idx(t):
    return int(round(t * SR))


def band_env(voc, t0, t1, hop=0.0025):
    """목소리 갈래 300~3000Hz 세기(dB), 2.5ms 간격 — 자를 곳 찾기."""
    a, b = max(0, idx(t0)), min(len(voc), idx(t1))
    x = voc[a:b].mean(1)
    n, h = 512, int(hop * SR)
    if len(x) < n + h:
        return np.array([t0]), np.array([-120.0])
    fr = np.lib.stride_tricks.sliding_window_view(x, n)[::h] * np.hanning(n)
    S = np.abs(np.fft.rfft(fr, axis=1))
    f = np.fft.rfftfreq(n, 1 / SR)
    e = 10 * np.log10((S[:, (f >= 300) & (f <= 3000)] ** 2).sum(1) + 1e-12)
    t = t0 + (np.arange(len(e)) * h + n / 2) / SR
    return t, e


def snap(voc, t, how, win=0.15):
    if not how or voc is None:
        return t
    tt, e = band_env(voc, t - win, t + win)
    if how == '골':
        sm = np.convolve(e, np.ones(4) / 4, 'same')
        return float(tt[int(np.argmin(sm))])
    if how == '솟음':
        d = np.diff(np.convolve(e, np.ones(3) / 3, 'same'))
        k = int(np.argmax(d))
        return float(tt[k] - 0.010)
    raise SystemExit(f'찾기는 골 · 솟음: {how}')


def rms_db(x):
    return 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('plan')
    ap.add_argument('--밖')
    ap.add_argument('--미리', action='store_true', help='쓰지 않고 자를 곳 · 길이만 보인다')
    a = ap.parse_args()
    plan_path = Path(a.plan)
    P = json.loads(plan_path.read_text(encoding='utf-8'))
    out_dir = Path(a.밖) if a.밖 else plan_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    name = P.get('이름') or plan_path.stem
    mix = load(P['곡'])
    acc = load(P['바탕']) if P.get('바탕') else None
    voc = load(P['목소리']) if P.get('목소리') else None
    n = len(mix) if acc is None else min(len(mix), len(acc))
    mix = mix[:n]
    if acc is not None:
        acc = acc[:n]
    if voc is not None:
        voc = voc[:n]
    beat_cfg = P.get('박', '자동')
    if beat_cfg == '자동':
        sys.path.insert(0, str(Path(__file__).parent))
        import importlib.util
        spec = importlib.util.spec_from_file_location('노래검수', Path(__file__).parent / '노래검수.py')
        ng = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(ng)
        g = ng.beat_grid(ng.load(P['바탕']))
        beat_cfg = {'bpm': g['bpm'], '첫박': g['첫박'], '눈금뚜렷함': g['눈금뚜렷함']}
    BEAT = 60 / float(beat_cfg['bpm'])
    BAR = 4 * BEAT
    first = float(beat_cfg['첫박']) + int(P.get('마디첫박', 0)) * BEAT

    # ① 끼우기(원곡 시각)
    ins = []
    for item in P.get('끼우기', []):
        L = {'마디': BAR, '박': BEAT}.get(item.get('길이', '마디'), item.get('길이'))
        c = snap(voc, float(item['곳']), item.get('찾기'))
        ins.append((c, float(L), float(item.get('앞겹침', 0.06)), float(item.get('뒤겹침', 0.008)), float(item['곳']),
                    (item.get('원천마디'), int(item.get('원천끝마디') or 0))))
    ins.sort()
    if ins and acc is None:
        raise SystemExit('끼우기에는 바탕 갈래가 든다')
    parts, prev, tail, joins = [], 0, None, []
    for c, L, X, Y, asked, (src_bars, src_k) in ins:
        ci, Li, Xi = idx(c), idx(L), max(1, idx(X))
        chunk = mix[prev:ci].copy()
        if tail is not None:
            a0, Yi = tail
            up = np.linspace(0, 1, Yi)[:, None]
            chunk[:Yi] = chunk[:Yi] * up + acc[a0:a0 + Yi] * (1 - up)
        Ei = ci - idx(src_k * BAR)  # 원천이 끝나는 자리(k마디 앞)
        Si = idx(float(src_bars) * BAR) if src_bars else Li
        if src_k or Si < Li:
            # 원천 n마디를 되풀이 — 조각 끝을 원천 바로 앞 소리와 겹쳐 다음 조각 처음으로 잇는다(마지막 조각은 그대로 — 원천 끝 뒤로 이어진다)
            Fi = max(1, idx(0.01))
            seg = acc[Ei - Si:Ei].copy()
            loop = seg.copy()
            fade = np.linspace(1, 0, Fi)[:, None]
            loop[-Fi:] = loop[-Fi:] * fade + acc[Ei - Si - Fi:Ei - Si] * (1 - fade)
            need = Li + Xi
            reps = need // Si + 2
            tiled = np.concatenate([loop] * (reps - 1) + [seg])[-need:]
            pre, block = tiled[:Xi], tiled[Xi:]
        else:
            pre, block = acc[ci - Li - Xi:ci - Li], acc[ci - Li:ci].copy()
        down = np.linspace(1, 0, Xi)[:, None]
        chunk[-Xi:] = chunk[-Xi:] * down + pre * (1 - down)
        parts += [chunk, block]
        prev, tail = ci, (Ei, max(1, idx(Y)))  # 뒤겹침은 끼운 반주가 끝난 자리(원천 끝) 뒤 소리에서 「곳」 뒤 원곡으로
    chunk = mix[prev:].copy()
    if tail is not None:
        a0, Yi = tail
        up = np.linspace(0, 1, Yi)[:, None]
        chunk[:Yi] = chunk[:Yi] * up + acc[a0:a0 + Yi] * (1 - up)
    parts.append(chunk)
    body = np.concatenate(parts)

    def to_new(t):
        return t + sum(L for c, L, *_ in ins if c <= t)

    pos = 0
    for k, p in enumerate(parts[:-1]):
        pos += len(p)
        joins.append(pos / SR)
    # ② 자르기(끼운 뒤 시각)
    cut = P.get('자르기')
    if isinstance(cut, dict):
        s_new = to_new(first + int(cut['시작마디']) * BAR)
        e_new = s_new + int(cut['마디수']) * BAR
        bar_aligned = True
    elif isinstance(cut, list) and len(cut) >= 2:
        # [시작, 끝, (끝빼기)] — 끝빼기는 끼운 뒤 시각에서 끝을 그만큼 당긴다(못갖춘마디: 시작을 반 박 당겼으면 끝도 같이 — 길이가
        # 마디의 정수배로 남아 되풀이 재생이 박에 맞는다). 셋째 값이 있으면 마디에 맞춘 것으로 본다.
        s_new, e_new = to_new(float(cut[0])), to_new(float(cut[1])) - (float(cut[2]) if len(cut) > 2 else 0.0)
        bar_aligned = len(cut) > 2
    else:
        s_new, e_new, bar_aligned = 0.0, len(body) / SR, False
    si, ei = idx(s_new), min(idx(e_new), len(body))
    out = body[si:ei].copy()
    joins = [j - s_new for j in joins if s_new < j < e_new]
    # ③ 잇기 — 끝 뒤 꼬리를 처음에 겹쳐 더한다(되풀이 재생 때 울림이 끊기지 않게), 끝은 짧게 줄인다
    loop = P.get('잇기')
    if loop:
        X = max(1, idx(float(loop.get('겹침', 0.04))))
        tail_ = body[ei:ei + X].copy()
        if len(tail_) == X:
            fade = np.linspace(1, 0, X)[:, None]
            out[:X] += tail_ * fade
        out[-idx(0.004):] *= np.linspace(1, 0, idx(0.004))[:, None]
    peak = float(np.abs(out).max())
    if peak > 0.99:
        out *= 0.99 / peak
    dur = len(out) / SR
    # 검사
    checks = []
    lo, hi = P.get('목표길이', [0, 1e9])
    if not (lo <= dur <= hi):
        checks.append(f'길이 {dur:.2f}초가 목표 {lo}~{hi}초 밖')
    seam = []
    for j in joins:
        k = idx(j)
        if 0.1 < j < dur - 0.1:
            # 80ms 창 — 20ms 창은 북 소리 사이 틈을 끊김으로 잰다(11-11 메들리 A 「진짜?」 판 +35dB 헛걸림)
            d = rms_db(out[k:k + idx(0.08)]) - rms_db(out[k - idx(0.08):k])
            seam.append({'초': round(j, 3), '세기차_dB': round(float(d), 1)})
            if abs(d) > 8:
                checks.append(f'이음매 {j:.3f}초 앞뒤 세기 차 {d:+.1f}dB')
    loop_diff = None
    if loop:
        # 되풀이 재생에서 끝 다음에 처음이 온다 — 끝 50ms가 원곡에서 시작 바로 앞 50ms(원래 그 처음 앞에 오던 소리)와 세기가 닮았나
        before = body[max(0, si - idx(0.08)):si]
        # 곡 맨 앞에서 시작하면 앞 소리가 없다(비교할 것 없음 — 곡 첫머리라 끊김이 아니다)
        loop_diff = float(rms_db(out[-idx(0.08):]) - rms_db(before)) if len(before) >= idx(0.08) and si >= idx(0.1) else 0.0
        if abs(loop_diff) > 8:
            checks.append(f'되풀이 이음 세기 차 {loop_diff:+.1f}dB(끝 80ms − 원곡에서 시작 앞 80ms)')
        if not bar_aligned:
            checks.append('잇기를 했는데 자르기가 마디 첫 박에 맞춰지지 않았다(「자르기」를 {시작마디, 마디수}로)')
    info = {'이름': name, '원곡': str(P['곡']), 'bpm': round(float(beat_cfg['bpm']), 3), '박': round(BEAT, 5), '마디': round(BAR, 5),
            '마디첫박': round(first, 3), '끼움': [{'원곡곳': round(c, 3), '부탁한곳': asked, '길이': round(L, 5)} for c, L, _, _, asked, _ in ins],
            '자름': [round(s_new, 3), round(e_new, 3)], '길이': round(dur, 3), '최고': round(min(peak, 0.99), 3), '이음매': seam,
            '되풀이세기차_dB': loop_diff and round(loop_diff, 1), '확인할것': checks,
            '대응': '손질본 시각 = 원곡 시각 + (원곡곳 ≤ 원곡 시각인 끼움 길이 합) − 자름[0]'}
    print(json.dumps(info, ensure_ascii=False, indent=1))
    if a.미리:
        return 1 if checks else 0
    wav = out_dir / f'{name}.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s16le', str(wav)],
                   input=out.astype(np.float32).tobytes(), check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '192k', str(out_dir / f'{name}.mp3')], check=True)
    (out_dir / f'{name}.손질.json').write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding='utf-8')
    print('써짐', wav)
    return 1 if checks else 0


if __name__ == '__main__':
    sys.exit(main())

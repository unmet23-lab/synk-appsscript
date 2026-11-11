"""메들리 후보 하나에서 훅 하나를 하루 판으로 — 곡 손질 계획 · 손질 · 가사판 정본(song.json)까지(2026-11-11 Claude, 리듬 한국어 준비안 「라」 줄).

  python -X utf8 docs/마케팅/LAB_노래틀/틀/편만들기.py <검수.json> <곡.mp3> <바탕.wav> <목소리.wav> --첫줄 <카운트인 줄 번호> --밖 <폴더>
        --낱말 배고파 --판본 <판본 글.json> [--무대 mongle|plain] [--그림 <public 안 경로>] [--곡이름 <이름>]

하루 판(준비안 「새 노래 — 한 곡의 꼴」): 카운트인 → 끊어 → 이어 → [네 차례: 손뼉] → 끊어 → 이어 → 진짜 속도 → [네 차례: 말하기] → 끝 물음.
가사 줄은 첫줄(카운트인) 다음 다섯 줄이 끊어 · 이어 · 끊어 · 이어 · 진짜 속도라고 본다(메들리 A 가사 꼴).
- 쉼(네 차례)은 반주 갈래에서 바로 앞 같은 길이를 떼어 끼운다(tools/곡손질.py) — 길이가 마디의 정수배라 박 자리는 어디에 끼워도 그대로다.
  끼우는 곳은 앞 줄 끝과 다음 줄 첫 음절 사이 안에서 목소리(300~3000Hz)가 가장 조용한 곳(메들리 A는 줄이 마디 안에서 붙어 나와
  마디 첫 박에 끼우면 다음 줄을 자른다).
- 시작은 카운트인 첫 음절 바로 앞(「다섯」의 「다」가 박 앞에 붙는 못갖춘마디면 그만큼 당김), 끝은 둘째 쉼 뒤 끝 물음 자리 안에서 시작과 같은
  박 자리 — 되풀이 재생이 박에 맞게 이어진다(곡손질 「잇기」 · 「끝빼기」).
음절 시각은 노래검수가 목소리 갈래에서 잰 음절 시작(귀가 그 음절로 맞춘 자리)을 손질본 시각으로 옮긴 값이다.
"""
import argparse
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.stdout.reconfigure(encoding='utf-8')
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
_spec = importlib.util.spec_from_file_location('곡손질', REPO / 'tools' / '곡손질.py')
gs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gs)


END_MIN = 2.5  # 끝 물음 화면의 가장 짧은 길이(초)


def quiet_between(voc, a, b):
    """a~b 사이에서 목소리가 가장 조용한 곳(2.5ms 세기를 10ms로 고른 값). 틈이 30ms보다 좁으면 가운데."""
    if b - a < 0.03:
        return (a + b) / 2
    tt, e = gs.band_env(voc, a, b)
    sm = np.convolve(e, np.ones(4) / 4, 'same')
    return float(tt[int(np.argmin(sm))])


def gap_cut(voc, prev_end, next_start):
    """앞 줄 끝과 다음 줄 첫 음절 사이 끼울 곳. 재기가 앞 줄 끝 음절을 다음 줄 첫 음절과 같은 자리로 잡으면(겹침) 창이 뒤집혀
    가운데가 다음 줄 첫 음절 한가운데에 떨어진다(11-12 메들리 A 「진짜」 — 쉼 마디가 「진」을 반으로 갈랐다). 그때는 다음 줄 첫 음절
    앞 0.6초 안에서 가장 조용한 곳을 찾는다 — 끼울 곳은 늘 다음 줄 첫 음절보다 앞이다."""
    b = next_start - 0.01
    a = prev_end - 0.02
    if b - a < 0:  # 창이 뒤집혔다(재기 겹침) — 틈이 좁기만 하면 예전처럼 가운데(quiet_between)
        a = b - 0.6
    return quiet_between(voc, a, b)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('result')
    ap.add_argument('song')
    ap.add_argument('acc')
    ap.add_argument('voc')
    ap.add_argument('--첫줄', type=int, required=True)
    ap.add_argument('--밖', required=True)
    ap.add_argument('--낱말', required=True)
    ap.add_argument('--판본', required=True)
    ap.add_argument('--무대', default='mongle')
    ap.add_argument('--그림')
    ap.add_argument('--곡이름')
    ap.add_argument('--줄짜임', default='1,1,1,1,1',
                    help='카운트인 다음 끊어 · 이어 · 끊어 · 이어 · 진짜 속도가 각각 몇 줄인가(메들리 B처럼 끊어 줄을 한 줄에 한 음절로 적었으면 4,1,4,1,1)')
    a = ap.parse_args()
    res = json.loads(Path(a.result).read_text(encoding='utf-8'))
    out = Path(a.밖)
    out.mkdir(parents=True, exist_ok=True)
    s = res['요약']
    beat, first = s['박'], s['첫박']
    bar = 4 * beat
    rows = res['음절']
    L = a.첫줄
    line = lambda n: [r for r in rows if r['줄'] == n and r['시작'] is not None]  # noqa: E731
    sizes = [int(x) for x in a.줄짜임.split(',')]
    if len(sizes) != 5:
        raise SystemExit('--줄짜임은 다섯 수(끊어 · 이어 · 끊어 · 이어 · 진짜 속도)')
    count, groups, n_ = line(L), [], L + 1
    for sz in sizes:
        groups.append([r for j in range(sz) for r in line(n_ + j)])
        n_ += sz
    chop1, whole1, chop2, whole2, real = groups
    after = line(n_)
    if not all([count, chop1, whole1, chop2, whole2, real]):
        raise SystemExit('줄 시각이 빈 줄이 있다 — 보고서를 보고 첫줄을 확인')
    end_line = lambda ln: max(r['시작'] + (r['길이'] or 0.2) for r in ln)  # noqa: E731
    voc = gs.load(a.voc)
    # 시작 — 카운트인 첫 음절에 가장 가까운 박을 마디 첫 박으로, 박 앞에 붙은 음절만큼 당긴다
    c0 = count[0]['시작']
    b0 = first + round((c0 - first) / beat) * beat
    pickup = min(b0, max(0.0, b0 - c0 + 0.04)) if c0 < b0 - 0.03 else 0.0
    start = b0 - pickup
    if start < 0:
        raise SystemExit(f'시작이 곡 앞으로 나간다(첫 박 {b0:.3f}, 당김 {pickup:.3f})')
    # 끼울 곳 — 줄 사이에서
    c1 = gap_cut(voc, end_line(whole1), chop2[0]['시작'])
    nxt = after[0]['시작'] if after else end_line(real) + 0.6
    c2 = quiet_between(voc, end_line(real) - 0.02, min(nxt - 0.01, end_line(real) + 0.6))
    # 끝 — 둘째 끼움(쉼 한 마디 + 끝 물음 자리) 안에서 시작과 같은 박 자리. 끝 물음이 END_MIN초 넘게 남도록 끼움을 두 마디 또는 세 마디로.
    # (11-12: 1.0초였을 때 메들리 A 「진짜」의 끝 물음이 1.59초뿐이라 40~50자 물음을 못 읽었다 — 글자 검사 읽기 시간)
    y = (c2 - start) % bar  # 끼운 반주의 끝(=c2 박 자리)에서 이만큼 당기면 시작과 같은 박 자리
    L2 = 2 * bar if (bar - y) >= END_MIN else 3 * bar
    acc = gs.load(a.acc)

    def source(c, n, L):
        """끼울 반주의 원천 — 「곳」에서 k마디 앞에서 끝나는 n마디 가운데 반주가 고르게 찬(0.1초 창이 모두 −45dB 위) 가장 가까운 것.
        바로 앞(k=0)이 고르고 n마디가 끼울 길이면 예전 그대로(곡손질 기본). 스톱 타임 곡(메들리 A 「진짜」)은 앞 구간의 고른 마디를 쓴다."""
        w = int(0.1 * gs.SR)
        mono = acc.mean(axis=1) if acc.ndim > 1 else acc

        def steady(a_t, b_t):
            if a_t < 0:
                return False
            seg = mono[int(a_t * gs.SR):int(b_t * gs.SR)]
            dbs = [20 * np.log10(np.sqrt((seg[i:i + w] ** 2).mean()) + 1e-9) for i in range(0, len(seg) - w, w)]
            return bool(dbs) and min(dbs) > -45

        if steady(c - L, c):
            return {}  # 바로 앞 그 길이가 고르면 예전 그대로
        for k in range(0, 9):
            if c - (k + n) * bar < 0:
                break
            if steady(c - (k + n) * bar, c - k * bar):
                return {'원천마디': n, '원천끝마디': k}
        return {} if abs(n * bar - L) < 1e-6 else {'원천마디': n}

    name = a.곡이름 or f"{Path(a.song).stem}_{a.낱말}"
    plan = {'이름': name, '곡': a.song, '바탕': a.acc, '목소리': a.voc, '박': {'bpm': s['bpm'], '첫박': first},
            '끼우기': [{'곳': round(c1, 4), '길이': bar, '찾기': None, '앞겹침': 0.03, '뒤겹침': 0.008, **source(c1, 1, bar)},
                     {'곳': round(c2, 4), '길이': L2, '찾기': None, '앞겹침': 0.03, '뒤겹침': 0.008, **source(c2, 2, L2)}],
            '자르기': [round(start, 4), round(c2, 4), round(y, 4)], '잇기': {'겹침': 0.03}, '목표길이': [14, 20]}
    pp = out / f'{name}.손질계획.json'
    pp.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding='utf-8')
    r = subprocess.run([sys.executable, '-X', 'utf8', str(REPO / 'tools' / '곡손질.py'), str(pp), '--밖', str(out)], capture_output=True, text=True, encoding='utf-8')
    if not (out / f'{name}.손질.json').exists():
        raise SystemExit(r.stdout[-1500:] + r.stderr[-1500:])
    info = json.loads((out / f'{name}.손질.json').read_text(encoding='utf-8'))
    dur = info['길이']
    s0 = start

    def to_clip(t):
        return round(t + (bar if c1 <= t + 1e-6 else 0) + (L2 if c2 <= t + 1e-6 else 0) - s0, 3)

    loc = json.loads(Path(a.판본).read_text(encoding='utf-8'))
    syl = [ch for ch in a.낱말 if '가' <= ch <= '힣']
    def pick(ln):
        """끊어 부른 음절 시각 — 낱말 음절을 차례로 되풀이한 것만(「가! 자! 가! 자!」는 넷, 「고! 마! 워! 짝!」의 추임새 「짝」은 뺀다).
        메들리 A처럼 낱말을 한 번 끊어 부르면 예전과 같다(음절 수만큼)."""
        out, k = [], 0
        for r in ln:
            if r['음절'] == syl[k % len(syl)]:
                out.append(to_clip(r['시작']))
                k += 1
        return out
    reps = lambda ln: [to_clip(r['시작']) for r in ln[::len(syl)]]  # noqa: E731  — 낱말을 되풀이해 부른 첫 음절들
    rest1 = to_clip(c1) - bar
    rest2 = to_clip(c2) - L2
    parts = [
        {'kind': 'count', 't': 0.0, 'end': round(to_clip(chop1[0]['시작']) - 0.05, 3)},
        {'kind': 'chop', 't': round(to_clip(chop1[0]['시작']) - 0.05, 3), 'end': round(to_clip(whole1[0]['시작']) - 0.05, 3), 'at': pick(chop1)},
        {'kind': 'whole', 't': round(to_clip(whole1[0]['시작']) - 0.05, 3), 'end': round(rest1, 3), 'at': reps(whole1)},
        {'kind': 'rest', 't': round(rest1, 3), 'end': to_clip(c1), 'mode': 'clap'},
        {'kind': 'chop', 't': to_clip(c1), 'end': round(to_clip(whole2[0]['시작']) - 0.05, 3), 'at': pick(chop2)},
        {'kind': 'whole', 't': round(to_clip(whole2[0]['시작']) - 0.05, 3), 'end': round(to_clip(real[0]['시작']) - 0.05, 3), 'at': reps(whole2)},
        {'kind': 'real', 't': round(to_clip(real[0]['시작']) - 0.05, 3), 'end': round(rest2, 3), 'at': reps(real)},
        {'kind': 'rest', 't': round(rest2, 3), 'end': round(rest2 + bar, 3), 'mode': 'say'},
        {'kind': 'end', 't': round(rest2 + bar, 3), 'end': dur},
    ]
    doc = {'fps': 30, 'duration': dur, 'audio': 'song.wav', 'bpm': s['bpm'], 'first': round((b0 - s0) % beat, 3),
           'word': a.낱말, 'syl': syl, 'parts': parts,
           'stage': {'mode': a.무대, **({'img': a.그림} if a.무대 == 'mongle' and a.그림 else {}), **({'pic': a.그림} if a.무대 == 'plain' and a.그림 else {})},
           'loc': {k: v for k, v in loc.items() if not k.startswith('_')}, '_원문': loc.get('_원문', {}),
           '_출처': {'검수': a.result, '곡': a.song, '손질': str(out / f'{name}.손질.json'), '확인할것': info['확인할것']}}
    (out / f'{name}.song.json').write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps({'길이': dur, '끼움': info['끼움'], '자름': info['자름'], '이음매': info['이음매'], '되풀이세기차_dB': info['되풀이세기차_dB'],
                      '확인할것': info['확인할것']}, ensure_ascii=False))
    for p in parts:
        print(' ', p)


if __name__ == '__main__':
    main()

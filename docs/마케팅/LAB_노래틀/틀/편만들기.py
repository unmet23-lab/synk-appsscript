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
- 11-14 유호님 「배고 하고 끊기네」: 재기가 진짜 속도 줄 끝 음절을 일찍 잡으면(메들리 A 「배고파」 — 「파」를 10.53초로 잡았는데
  실제 「파」는 11.18~11.66초) 둘째 끼움이 「파」 바로 앞 틈(11.13초)에 떨어진다. 끝 자리 바로 뒤 0.12초 안에서 목소리가 다시
  커지는데 다음 가사 줄은 0.3초 넘게 뒤면 「확인할 것」으로 적는다 — 그때는 목소리 갈래 세기 · 받아쓰기로 줄 끝을 다시 재고 `--끝자리 <원곡 초>`로 준다. 고른 모음 끝처럼 틈이 없는 자리는 `--끝겹침`(초)로
  목소리만 천천히 내린다(곡손질 앞겹침 = 곡 → 바탕 갈래 교차 — 바탕은 그대로 흐른다).
- `--쉼 있음|손뼉|없음`(11-14): 있음 = 예전 그대로(반주만 흐르는 네 차례 두 마디), 손뼉 = 손뼉 마디 박마다 손뼉 소리를 얹는다
  (`--손뼉 <소리…>` 번갈아), 없음 = 네 차례 두 마디를 빼고 노래만(끝 물음 자리만 끼운다).
- `--읽기 <편 폴더>`(11-15 유호님 「읽기 빠듯하면 읽기 좋게 만들어야지」): 판본 글 26개를 읽는 시간(틀/읽기재기.cjs --필요)으로
  ① 카운트인 화면이 가장 긴 다리 글보다 짧으면 노래 앞에 반주 마디를 붙이고(곡손질 「앞마디」 — song.json count에 intro 초),
  ② 노래만 판에서 진짜 속도 딱지가 모자라면 끝 화면을 박 단위로 늦추고(딱지 머묾), ③ 끝 물음 화면이 가장 긴 끝 물음을 읽을 만큼 되게
  끝 끼움 마디 수를 고른다. 판본 글이 아직 없는 첫 자르기는 --읽기 없이 하고, 판본글짓기.cjs 끝의 읽기 관문이 걸리면 --읽기로 다시 자른다.
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
sys.path.insert(0, str(HERE))
import 이식경로 as ep  # noqa: E402 — song.json 「_출처」에 사용자 폴더 경로를 적지 않는다(11-15, 공개 저장소)
_spec = importlib.util.spec_from_file_location('곡손질', REPO / 'tools' / '곡손질.py')
gs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gs)


END_MIN = 2.5  # 끝 물음 화면의 가장 짧은 길이(초) — --읽기를 주지 않을 때만(판본 글이 아직 없는 첫 자르기)
# 11-15 유호님 「읽기 빠듯하면 읽기 좋게 만들어야지 왜 빠듯하게 만든거야」 — 노래만 판의 끝 화면이 2.7~2.8초라 끝 물음이 49개 판에서,
# 카운트인 3.09초인 「진짜」는 다리 글이 21개 판에서, 진짜 속도 딱지가 32개 판에서 넘쳤다. --읽기 <편 폴더>를 주면 판본 글 26개의 읽는
# 시간(틀/읽기재기.cjs --필요 — 글자 검사와 같은 셈)으로 앞마디 · 딱지 머묾 · 끝 물음 마디 수를 정한다. 아래 값은 Song.tsx · 읽기재기.cjs와 같다.
END_IN = 0.4      # 끝 물음 첫 낱말이 끝 화면 12프레임 뒤에 들어온다
BRIDGE_OUT = 0.2  # 다리 글이 카운트인 끝 0.3초 앞부터 빠진다
LABEL_IN = 0.2    # 딱지가 흐림에서 또렷해지는 동안
REAL_LEAD = 0.5   # 진짜 속도 딱지는 그 구간보다 0.5초 먼저 뜬다


def 읽기맞춤(count_len, real_win, bar, beat, y, rest_on, need, 앞마디=None):
    """읽는 시간에 맞춘 곡 짜임 → (앞마디 수, 진짜 속도 딱지 머묾 초, 끝 끼움 마디 수).
    ① 앞마디: 카운트인 화면이 가장 긴 다리 글(need 다리)을 읽을 만큼 되도록 노래 앞에 붙일 반주 마디 수(앞마디를 주면 그 값).
    ② 딱지 머묾: 노래만 판(rest_on 거짓)은 진짜 속도 줄 바로 뒤가 끝 화면이라 딱지가 1초 안팎만 뜬다 — 모자라면 박 단위로 끝 화면을 늦춘다.
    ③ 끝 끼움: 둘째 끼움(쉼 한 마디 + 끝 물음 자리) 안에서 시작과 같은 박 자리. 끝 물음 화면(딱지 머묾 뒤)이 가장 긴 끝 물음을 읽을 만큼
       남도록 마디 수를 고른다(need 끝이 없으면 예전대로 END_MIN초 — 11-12: 1.0초였을 때 메들리 A 「진짜」의 끝 물음이 1.59초뿐이었다)."""
    if 앞마디 is not None:
        n0 = 앞마디
    else:
        n0 = 0
        while count_len + n0 * bar - BRIDGE_OUT < need.get('다리', 0) - 1e-9:
            n0 += 1
    hold = 0.0
    if not rest_on:
        short = need.get('딱지', 0) - real_win
        if short > 1e-9:
            hold = int(np.ceil(short / beat - 1e-9)) * beat
    end_need = (need['끝'] + END_IN) if need.get('끝') is not None else END_MIN
    B1 = bar if rest_on else 0.0
    k2 = 2 if rest_on else 1
    while k2 * bar - B1 - y - hold < end_need - 1e-9:
        k2 += 1
    return n0, hold, k2


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


def lay_claps(wav, mp3, samples, rest, first, beat, gain_db):
    """손뼉 마디(rest) 안 박마다 손뼉 소리를 번갈아 얹고 wav · mp3를 다시 쓴다. 손뼉은 어택(봉우리의 10%를 처음 넘는 곳) 2ms 앞에서
    0.25초만 쓰고, 첫 50ms 세기를 그 마디 반주 세기보다 gain_db 위로 맞춘다. 놓은 박 시각(손질본 초)을 돌려준다."""
    y = gs.load(wav)
    t0, t1 = rest['t'], rest['end']
    seg = y[int(t0 * gs.SR):int(t1 * gs.SR)]
    bed = 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9)
    cut = []
    for x in samples:
        m = np.abs(x).max(axis=1)
        on = int(np.argmax(m > m.max() * 0.1))
        c = x[max(0, on - int(0.002 * gs.SR)):][:int(0.25 * gs.SR)].copy()
        c *= (np.linspace(1, 0, len(c)) ** 0.5)[:, None]
        lvl = 20 * np.log10(np.sqrt((c[:int(0.05 * gs.SR)] ** 2).mean()) + 1e-9)
        cut.append(c * 10 ** ((bed + gain_db - lvl) / 20))
    k0 = int(np.ceil((t0 - 0.02 - first) / beat))
    at = [first + k * beat for k in range(k0, k0 + 8) if t0 - 0.02 <= first + k * beat <= t1 - 0.1]
    for i, t in enumerate(at):
        c = cut[i % len(cut)]
        a_ = int(t * gs.SR)
        n = min(len(c), len(y) - a_)
        g = 1.0
        for _ in range(40):  # 손뼉 자리 봉우리가 0.95를 넘지 않을 때까지 그 손뼉만 줄인다 — 곡 전체를 낮추면 손뼉 판만 1.7dB 작게 들렸다(11-14)
            if np.abs(y[a_:a_ + n] + c[:n] * g).max() <= 0.95:
                break
            g *= 0.89
        y[a_:a_ + n] += c[:n] * g
    peak = float(np.abs(y).max())
    if peak > 0.99:
        y *= 0.99 / peak
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(gs.SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s16le', str(wav)],
                   input=y.astype(np.float32).tobytes(), check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '192k', str(mp3)], check=True)
    return [round(t, 3) for t in at]


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
    ap.add_argument('--끝자리', type=float, help='둘째 끼움(진짜 속도 뒤) 자리를 원곡 초로 준다 — 귀로 들은 줄 끝')
    ap.add_argument('--끝겹침', type=float, default=0.03, help='둘째 끼움 앞겹침(초) — 목소리를 이만큼에 걸쳐 내린다')
    ap.add_argument('--쉼', choices=['있음', '손뼉', '없음'], default='있음')
    ap.add_argument('--손뼉', nargs='*', default=[], help='손뼉 소리 파일(번갈아 놓음) — --쉼 손뼉일 때')
    ap.add_argument('--손뼉세기', type=float, default=5.0, help='손뼉 첫 50ms 세기를 그 마디 반주 세기보다 몇 dB 위로')
    ap.add_argument('--읽기', help='편 폴더 — 판본 글 26개를 읽는 시간으로 앞마디 · 진짜 속도 딱지 머묾 · 끝 물음 마디 수를 정한다(11-15)')
    ap.add_argument('--앞마디', type=int, help='노래 앞에 붙일 반주 마디 수(주면 --읽기 셈보다 앞선다)')
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
    c2 = a.끝자리 if a.끝자리 is not None else quiet_between(voc, end_line(real) - 0.02, min(nxt - 0.01, end_line(real) + 0.6))
    rest_on = a.쉼 != '없음'
    B1 = bar if rest_on else 0.0
    # 읽는 시간(11-15) — 판본 글 26개 가운데 가장 긴 것. 없으면 예전 값(끝 화면 END_MIN초 · 앞마디 없음 · 딱지 머묾 없음)
    need = {'다리': 0.0, '딱지': 0.0, '끝': None}
    if a.읽기:
        r = subprocess.run(['node', str(HERE / '읽기재기.cjs'), a.읽기, '--필요'], capture_output=True, text=True, encoding='utf-8')
        if r.returncode != 0:
            raise SystemExit('읽기재기 실패: ' + (r.stderr or r.stdout)[-800:])
        need.update(json.loads(r.stdout))
    count_len = (chop1[0]['시작'] - start) + (B1 if c1 <= chop1[0]['시작'] else 0) - 0.05  # 카운트인 화면(다리 글) 길이
    real_t = (real[0]['시작'] - start) + B1 - 0.05
    real_win = (c2 - start) + B1 - (real_t - REAL_LEAD + LABEL_IN)  # 진짜 속도 딱지가 읽히는 동안(머묾 없이)
    y = (c2 - start) % bar  # 끼운 반주의 끝(=c2 박 자리)에서 이만큼 당기면 시작과 같은 박 자리
    n0, hold, k2 = 읽기맞춤(count_len, real_win, bar, beat, y, rest_on, need, a.앞마디)
    B0 = n0 * bar
    L2 = k2 * bar
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
            '끼우기': ([{'곳': round(c1, 4), '길이': bar, '찾기': None, '앞겹침': 0.03, '뒤겹침': 0.008, **source(c1, 1, bar)}] if rest_on else [])
                     + [{'곳': round(c2, 4), '길이': L2, '찾기': None, '앞겹침': a.끝겹침, '뒤겹침': 0.008, **source(c2, 2, L2)}],
            **({'앞마디': {'마디': n0, '겹침': 0.03, **source(start, n0, B0)}} if n0 else {}),
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
        return round(t + (B1 if c1 <= t + 1e-6 else 0) + (L2 if c2 <= t + 1e-6 else 0) - s0 + B0, 3)

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
    rest1 = to_clip(c1) - B1
    rest2 = to_clip(c2) - L2
    parts = [
        {'kind': 'count', 't': 0.0, 'end': round(to_clip(chop1[0]['시작']) - 0.05, 3), **({'intro': round(B0, 3)} if B0 else {})},
        {'kind': 'chop', 't': round(to_clip(chop1[0]['시작']) - 0.05, 3), 'end': round(to_clip(whole1[0]['시작']) - 0.05, 3), 'at': pick(chop1)},
        {'kind': 'whole', 't': round(to_clip(whole1[0]['시작']) - 0.05, 3), 'end': round(rest1, 3), 'at': reps(whole1)},
        {'kind': 'rest', 't': round(rest1, 3), 'end': to_clip(c1), 'mode': 'clap'},
        {'kind': 'chop', 't': to_clip(c1) if rest_on else round(to_clip(chop2[0]['시작']) - 0.05, 3), 'end': round(to_clip(whole2[0]['시작']) - 0.05, 3), 'at': pick(chop2)},
        {'kind': 'whole', 't': round(to_clip(whole2[0]['시작']) - 0.05, 3), 'end': round(to_clip(real[0]['시작']) - 0.05, 3), 'at': reps(whole2)},
        {'kind': 'real', 't': round(to_clip(real[0]['시작']) - 0.05, 3), 'end': round(rest2, 3), 'at': reps(real)},
        {'kind': 'rest', 't': round(rest2, 3), 'end': round(rest2 + bar, 3), 'mode': 'say'},
        {'kind': 'end', 't': round(rest2 + bar, 3), 'end': dur},
    ]
    if not rest_on:  # 네 차례 두 마디 없음 — 이어(뜻)는 다음 끊어 바로 앞까지, 진짜 속도 다음이 끝 물음(딱지 머묾만큼 뒤 — 11-15)
        parts[2]['end'] = parts[4]['t']
        parts = [p for p in parts if p['kind'] != 'rest']
        parts[-1]['t'] = parts[-2]['end'] = round(rest2 + hold, 3)
    # 저절로 고른 끝 자리 뒤 0.12초 안에서 목소리가 다시 커지는데 다음 가사 줄은 0.3초 넘게 뒤면(줄 끝 음절을 일찍 잡은 재기 ·
    # 가사에 없는 소리) 귀로 확인하게 적는다. --끝자리로 준 자리는 들은 것이라 보지 않는다.
    tt, e = gs.band_env(voc, c2 - 0.3, c2 + 0.12)
    before, after_ = e[tt < c2], e[tt >= c2]
    if a.끝자리 is None and nxt - c2 > 0.3 and len(before) and len(after_) and after_.max() > before.max() - 6:  # band_env는 dB
        info['확인할것'].append(f'끝 자리 {c2:.3f}초 바로 뒤에서 목소리가 다시 커진다(뒤 봉우리 {after_.max():.1f}dB · 앞 {before.max():.1f}dB) — 들어 보고 --끝자리')
    claps = []
    if a.쉼 == '손뼉' and a.손뼉:
        claps = lay_claps(out / f'{name}.wav', out / f'{name}.mp3', [gs.load(Path(c)) for c in a.손뼉], parts[3], (b0 - s0) % beat, beat, a.손뼉세기)
    doc = {'fps': 30, 'duration': dur, 'audio': 'song.wav', 'bpm': s['bpm'], 'first': round((b0 - s0) % beat, 3),
           'word': a.낱말, 'syl': syl, 'parts': parts,
           'stage': {'mode': a.무대, **({'img': a.그림} if a.무대 == 'mongle' and a.그림 else {}), **({'pic': a.그림} if a.무대 == 'plain' and a.그림 else {})},
           'loc': {k: v for k, v in loc.items() if not k.startswith('_')}, '_원문': loc.get('_원문', {}),
           '_출처': {'검수': ep.줄이기(a.result), '곡': ep.줄이기(a.song), '손질': ep.줄이기(out / f'{name}.손질.json'), '확인할것': info['확인할것'],
                     '쉼': a.쉼, **({'손뼉': claps} if claps else {}), **({'끝자리': a.끝자리} if a.끝자리 is not None else {}),
                     **({'끝겹침': a.끝겹침} if a.끝겹침 != 0.03 else {}),
                     **({'읽기': {'필요': need, '앞마디': n0, '딱지머묾': round(hold, 3), '끝마디': k2 - (1 if rest_on else 0)}} if a.읽기 or a.앞마디 is not None else {})}}
    (out / f'{name}.song.json').write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps({'길이': dur, '끼움': info['끼움'], '자름': info['자름'], '이음매': info['이음매'], '되풀이세기차_dB': info['되풀이세기차_dB'],
                      '확인할것': info['확인할것']}, ensure_ascii=False))
    for p in parts:
        print(' ', p)


if __name__ == '__main__':
    main()

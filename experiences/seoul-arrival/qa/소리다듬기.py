# 서울행 배경 소리 · 효과음 다듬기(시안 소리/다듬기.py와 같은 기준). 소리굽기.mjs가 구운 판에서 고른 판을 앱 폴더로.
#   python -I -X utf8 experiences/seoul-arrival/qa/소리다듬기.py room=1 clock=2 …   (이름=판, 안 적으면 1판)
#   → experiences/seoul-arrival/assets/snd/<amb|sfx>_<이름>.mp3 · 들어 볼 판은 .tmp/seoul-sound/web/<이름>_<판>.mp3
# 세기 기준: 배경(고리) −30 · 한 번 나는 소리 −20(화면에서 장면마다 줄인다). 같은 값이라 앱의 소리 값을 안 고쳐도 시안과 같은 균형이다.
# 배경 고리는 앞뒤에 0.1초씩 덧대 굽는다(PAD) — 앱이 덧댄 곳을 건너 돈다. 이음새가 튀거나 꺼지거나 딸깍하는 판은 시작 자리를 옮긴다
# (loop_even · seam_cost, 딸깍은 구운 MP3를 풀어 한 번 더 잰다). 고리 겹침은 1초, 새벽만 0.5초(XF), 식당은 자르지 않고 통째로 돈다(WHOLE).
# 새벽 2판은 책상 둔탁한 소리를 잘라 낸 뒤 고리로 만든다(CUT — 그 판만, 다른 판은 원판 그대로).
import json, os, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
RAW = os.path.join(ROOT, '.tmp', 'seoul-sound', 'raw')
WEB = os.path.join(ROOT, '.tmp', 'seoul-sound', 'web')
APP = os.path.join(ROOT, 'experiences', 'seoul-arrival', 'assets', 'snd')
os.makedirs(WEB, exist_ok=True)
SR = 44100
AMB = {'room', 'dawn', 'cabin', 'train', 'campus', 'airport', 'hall', 'canteen', 'clock'}
ONE = {'crowd', 'applause', 'zip', 'walk', 'print', 'stamp'}
# 함성은 4.5초에서 1초에 걸쳐 끝낸다 — 크게 빠지는 끝(4.6~6초)에 한 사람의 외침이 홀로 튀었다(아르곤 듣기, 11-05).
LEN = {'room': 6.5, 'dawn': 5.1,'cabin': 6.5, 'train': 6.5, 'campus': 6.5, 'airport': 6.5, 'hall': 6.5, 'clock': 4.0, 'crowd': 4.5, 'applause': 5.6, 'zip': 3.0, 'walk': 5.0, 'print': 3.0, 'stamp': 1.5}
# 자르지 않고 통째로 도는 고리. 일레븐랩스 「Loop」 판은 9.000초로 풀리고 판 전체가 이음새 없이 돌게 구워지는 일이 많다.
# 식당 소리는 6.6초로 자른 2판이 겹침 1초 · 2초 둘 다 아르곤 「결이 살짝 바뀜」(끝 2초와 처음 2초의 띠 모양 차 4.5dB — 판 안에서 웅성거림이 자라 간다),
# 1판 통째는 「장면 맞음 · 이음새 안 들림」, 4판 통째는 「뚜렷」이라 1판 통째로 간다(11-05).
WHOLE = {'canteen'}
# 고리 길이 · 겹침 · 찾기 시작할 자리(초). 새벽 소리 3판은 획 사이 쉼이 길어 판 안에서 연필 바쁨이 크게 달라진다 — 6.5초 · 겹침 1초로 자르니 시작 0.03초에서
# 겹침 안 연필이 두 겹(「흐름이 미세하게 끊김」), 1.02초에서는 끝의 바쁜 연필이 처음의 조용한 자리로 넘어가며 「음량과 질감이 살짝 바뀜」, 연필 띠를 맞춘 짧은 고리는
# 「둔탁한 소리가 주기적으로」. 연필이 고르게 이어지는 2판에서 책상 둔탁한 소리(CUT)를 잘라 낸 뒤, 이음새 앞 0.8초와 뒤 0.8초의 연필 띠(6~12kHz) 세기 차
# 0.08dB인 0.15초부터 5.1초 · 겹침 0.5초로 자른다 — 아르곤 「이음새 안 들림 · 둔탁한 소리 없음」(11-05).
XF = {'dawn': 0.5}
FIRST = {'dawn': 0.15}
# 잘라 낼 곳(초, 원판 시각). 새벽 2판의 2.80~3.50초 두 번 울리는 책상 둔탁한 소리(40~300Hz가 중앙보다 17~23dB, 아르곤 「책상 쪽 둔탁한 물체 소리가 한 번」) —
# 앞 2.58초까지와 3.60초부터를 0.15초 겹쳐 잇는다(겹치는 두 자리에는 둔탁한 소리가 없다).
CUT = {'dawn': (2.58, 3.60)}


def splice(x, a, b, c=.15):
    A, B, C = int(a * SR), int(b * SR), int(c * SR)
    t = np.linspace(0, 1, C)[:, None]
    return np.concatenate([x[:A], x[A:A + C] * np.sqrt(1 - t) + x[B:B + C] * np.sqrt(t), x[B + C:]])


def load(path, ch=1):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, ch).copy()


def save(x, path, kbps):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(x.shape[1]), '-i', '-', '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', path], input=x.astype(np.float32).tobytes())
    assert p.returncode == 0, path


def lufs(x):
    m = x.mean(axis=1)
    w = int(.4 * SR)
    blocks = [np.mean(m[i:i + w] ** 2) for i in range(0, max(1, len(m) - w), w // 2)]
    blocks = [b for b in blocks if b > 1e-7] or [1e-7]
    return 10 * np.log10(np.mean(blocks) + 1e-12)


def gain_to(x, target):
    g = 10 ** ((target - lufs(x)) / 20)
    y = x * g
    pk = np.max(np.abs(y))
    lim = 10 ** (-1.5 / 20)
    return y * (lim / pk) if pk > lim else y


def fade(x, a=0.0, b=0.0):
    y = x.copy()
    if a:
        k = int(a * SR)
        y[:k] *= np.linspace(0, 1, k)[:, None]
    if b:
        k = int(b * SR)
        y[len(y) - k:] *= np.linspace(1, 0, k)[:, None]
    return y


def loop(x, seconds, xf=1.0):
    n = int(seconds * SR)
    F = int(xf * SR)
    x = x[:n + F] if len(x) >= n + F else x
    L = len(x) - F
    y = x[:L].copy()
    t = np.linspace(0, 1, F)[:, None]
    y[:F] = x[:F] * np.sqrt(t) + x[L:L + F] * np.sqrt(1 - t)
    return y


# 앱(app.mjs AMB_PAD)이 loopStart · loopEnd로 건너뛰는 덧댐. MP3는 처음 · 끝 몇 ms가 앞뒤 무음과 섞여 풀리니
# 고리의 끝 0.1초를 앞에, 처음 0.1초를 뒤에 붙여 구우면 앱이 도는 자리(덧댐 안쪽)는 가운데처럼 고르게 풀린다.
PAD = 0.1


def pad(y):
    k = int(PAD * SR)
    return np.concatenate([y[-k:], y, y[:k]])


def seam_level(y):
    """이음새(끝 50ms → 처음 50ms) 세기 차와, 파일 안쪽 이웃한 50ms 창끼리 세기 차의 최대."""
    m = y.mean(axis=1) if y.ndim > 1 else y
    w = int(.05 * SR)
    r = lambda a: 20 * np.log10(np.sqrt(np.mean(m[a:a + w] ** 2)) + 1e-9)
    inner = max(abs(r(a + w) - r(a)) for a in range(0, len(m) - 2 * w, w))
    return abs(r(len(m) - w) - r(0)), inner


BANDS = ((40, 500), (500, 2500), (2500, 9000))


def seam_click(m):
    """이음새를 가운데로 한 4ms 창의 4kHz 위 세기가 고리 안 창들의 99% 자리를 넘는 만큼(dB). 고리로 보고 둥글게 잰다."""
    n = len(m)
    Z = np.fft.rfft(m)
    Z[np.fft.rfftfreq(n, 1 / SR) < 4000] = 0
    e = np.fft.irfft(Z, n) ** 2
    w = int(.002 * SR)
    c = np.concatenate([e[-w:], e, e[:w]])
    cs = np.cumsum(np.concatenate([[0], c]))
    win = (cs[2 * w:] - cs[:-2 * w])[:n]
    return max(0.0, 10 * np.log10(win[0] + 1e-20) - 10 * np.log10(np.percentile(win, 99) + 1e-20))


def seam_cost(y):
    """이음새가 얼마나 튀거나 꺼지는가(0이면 고르다): 50ms 세기 차가 안쪽 최대를 넘는 만큼 + 이음새 앞뒤 100ms가 띠마다 고리 안 10% 자리 밑으로 내려간 만큼
    + 이음새 4ms의 높은 띠가 고리 안 99% 자리를 넘는 만큼(dB). 비행기 소리는 띠만 보고 옮긴 시작 자리가 높은 띠 99.9% 자리에 걸렸다(11-05)."""
    lv, inner = seam_level(y)
    m = y.mean(axis=1) if y.ndim > 1 else y
    w = int(.1 * SR)
    n = len(m) // w
    fr = m[:n * w].reshape(n, w) * np.hanning(w)
    X = np.abs(np.fft.rfft(fr, axis=1)) ** 2
    f = np.fft.rfftfreq(w, 1 / SR)
    cost = max(0.0, lv - inner) + seam_click(m)
    for lo, hi in BANDS:
        b = 10 * np.log10(X[:, (f >= lo) & (f < hi)].sum(1) + 1e-12)
        floor = np.percentile(b, 10)
        cost += max(0.0, floor - b[-1]) + max(0.0, floor - b[0])
    return cost


def loop_even(x, seconds, first=0.0, xf=1.0):
    """이음새가 튀거나 살짝 꺼지면(seam_cost > 0) 시작 자리를 10ms씩 옮겨 가장 고른 곳을 고른다(고리 · 옮긴 초 · 남은 비용).
    first부터 찾는다 — 풀어 낸 MP3에서 딸깍이 걸리면 그다음 자리부터 다시 찾는다(work)."""
    n, F, step = int(seconds * SR), int(xf * SR), int(.01 * SR)
    best = None
    for s in range(int(round(first * SR)), len(x) - n - F + 1, step):
        z = loop(x[s:], seconds, xf)
        c = seam_cost(z)
        if best is None or c < best[0]:
            best = (c, s, z)
        if c == 0:
            break
    return best[2], round(best[1] / SR, 2), best[0]


def ticks(x):
    """초침 자리(초)와 고르기(간격의 표준편차). 짧은 세기 봉우리를 0.5초 넘게 떼어 고른다."""
    w = int(.004 * SR)
    m = x.mean(axis=1)
    env = np.sqrt(np.convolve(m ** 2, np.ones(w) / w, 'same'))
    thr = max(np.percentile(env, 99) * .35, np.percentile(env, 50) * 3)
    out, last = [], -SR
    for i in np.flatnonzero(env > thr):
        if i - last > .5 * SR:
            out.append(i)
            last = i
    out = np.array(out)
    if len(out) < 3:
        return out / SR, 9.0
    d = np.diff(out) / SR
    return out / SR, float(np.std(d))


def clock_loop(x):
    """시안(소리/시계.py)과 같게: 똑딱 넷을 고리로 — 똑딱 사이 조용한 곳에서 자르고, 바닥은 반쯤 낮추고, 꼭대기를 −12dBFS로. 앱이 0 → 0.3~0.4로 천천히 키운다."""
    m = x.mean(axis=1)
    w = int(.004 * SR)
    env = np.sqrt(np.convolve(m ** 2, np.ones(w) / w, 'same'))
    floor = np.percentile(env, 30)
    want = np.where(env > floor * 4, 1.0, .4)
    g = np.empty_like(want)
    cur, a, r = .4, 1 - np.exp(-1 / (.002 * SR)), 1 - np.exp(-1 / (.09 * SR))
    for i, v in enumerate(want):
        cur += (v - cur) * (a if v > cur else r)
        g[i] = cur
    y = m * g
    t, _ = ticks(x)
    if len(t) < 6:
        raise SystemExit(f'초침이 모자란다: {len(t)}')
    # 똑딱 사이 가운데에서 자른다. 넷을 담는 길이로 잘라 이음매에 똑딱이 겹치지 않게 한다.
    i0 = 0
    A = int((t[i0] + t[i0 + 1]) / 2 * SR)
    B = int((t[i0 + 4] + t[i0 + 5]) / 2 * SR)
    L, F = B - A, int(.25 * SR)
    seg = y[A:min(len(y), B + F)]
    F = min(F, len(seg) - L)
    out = seg[:L].copy()
    if F > 8:
        c = np.linspace(0, 1, F)
        out[:F] = seg[:F] * np.sqrt(c) + seg[L:L + F] * np.sqrt(1 - c)
    out *= 10 ** (-12 / 20) / (np.max(np.abs(out)) + 1e-9)
    return out[:, None]


def work(name, take):
    src = os.path.join(RAW, f'{name}_{take}.mp3')
    x = load(src)
    if name in CUT and take == '2':
        x = splice(x, *CUT[name])
    shift = 0.0
    if name == 'clock':
        y = pad(clock_loop(x))
        out, kbps = 'amb_clock', 64
    elif name in WHOLE:
        out, kbps = 'amb_' + name, 64
        y = pad(gain_to(x, -30))
        tmp = os.path.join(WEB, f'.재기_{name}_{take}.mp3')
        save(y, tmp, kbps)
        d = load(tmp)[:, 0]
        os.remove(tmp)
        k = int(PAD * SR)
        cost = seam_cost(x) + seam_click(d[k:len(d) - k])
        if cost > 0:
            print(f'주의: {name}_{take} 통고리 이음새 비용 {cost:.2f}', file=sys.stderr)
    elif name in AMB:
        out, kbps = 'amb_' + name, 64
        first = FIRST.get(name, 0.0)
        for _ in range(40):
            y, shift, cost = loop_even(x, LEN[name], first, XF.get(name, 1.0))
            y = pad(gain_to(y, -30))
            if cost > 0:
                break
            # 풀어 낸 MP3에서도 이음새 딸깍이 99% 자리 밑인가 — 굽기 전에는 고르던 비행기 소리 이음새가 MP3 잡음으로 0.65dB 넘었다(11-05)
            tmp = os.path.join(WEB, f'.재기_{name}_{take}.mp3')
            save(y, tmp, kbps)
            d = load(tmp)[:, 0]
            os.remove(tmp)
            k = int(PAD * SR)
            if seam_click(d[k:len(d) - k]) == 0:
                break
            first = shift + 0.01
    else:
        # 도장 · 프린터 · 지퍼 · 발소리는 화면 사건과 맞물린다 — 앞 무음을 잘라 누른 순간에 나게 한다
        if name in ('stamp', 'print', 'zip', 'walk'):
            m = np.abs(x.mean(axis=1))
            w = int(.005 * SR)
            e = np.sqrt(np.convolve(m ** 2, np.ones(w) / w, 'same'))
            on = int(np.argmax(e > e.max() * 10 ** (-30 / 20)))
            x = x[max(0, on - int(.008 * SR)):]
        # 지퍼 9판부터는 1초 남짓 한 번에 끝나는 판이라 0.4초를 덮으면 가장 센 자리가 눌린다 — 끝만 짧게 닫는다
        y = fade(x[:int(LEN[name] * SR)], .004 if name in ('stamp', 'print', 'zip', 'walk') else .01, 1.6 if name == 'applause' else 1.0 if name == 'crowd' else .08 if name == 'zip' else .4)
        y = gain_to(y, -20)
        out, kbps = 'sfx_' + name, 96
    save(y, os.path.join(WEB, f'{name}_{take}.mp3'), kbps)
    return out, y, kbps, shift


picks = dict(a.split('=') for a in sys.argv[1:])
names = sorted(AMB | ONE)
summary = {}
for name in names:
    takes = [f[len(name) + 1:-4] for f in os.listdir(RAW) if f.startswith(name + '_') and f.endswith('.mp3')] if os.path.isdir(RAW) else []
    for t in sorted(takes):
        out, y, kbps, shift = work(name, t)
        if picks.get(name, '1') == t:
            save(y, os.path.join(APP, out + '.mp3'), kbps)
            row = {'판': t, '길이': round(len(y) / SR, 2), '출처': '일레븐랩스 효과음(유료 구독, 상업 이용)'}
            if out.startswith('amb_'):
                row['길이'] = round(len(y) / SR - 2 * PAD, 2)
                row['덧댐'] = PAD
                if shift:
                    row['시작'] = shift
                if name in XF:
                    row['겹침'] = XF[name]
                if name in WHOLE:
                    row['통째'] = True
                if name in CUT and t == '2':
                    row['뺀 곳'] = list(CUT[name])
            summary[out] = row
json.dump(summary, open(os.path.join(HERE, '소리출처.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(json.dumps(summary, ensure_ascii=False))

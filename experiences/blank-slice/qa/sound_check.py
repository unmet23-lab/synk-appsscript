# 손맛 소리 재기: qa/sound/*.wav 마다 최고 레벨·클리핑·들리는 길이·음량(K 가중 순간 음량, BS.1770 방식)·밝기(스펙트럼 무게중심)를 재고,
# 스펙트로그램을 한 장에 모은다. 사람이 듣는 확인을 대신하지 않는다(귀 확인은 유호님 몫). qa/sound.cjs가 부른다.
import json, os, subprocess, sys, tempfile
import numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'sound')
LABEL = {
    'kit-earn': '사운드킷 획득(픽) · 기준', 'kit-achieve': '사운드킷 성취', 'kit-calm1': '몽글 ‘괜찮아’',
    'felt-slice-ok': 'A 베기 · 맞힘', 'felt-slice-side': 'A 베기 · 가장자리 4연속', 'clean-slice-side': 'B 베기 · 가장자리 4연속', 'felt-slice-wrong': 'A 베기 · 틀림', 'felt-swing-soft': 'A 휙 · 천천히', 'felt-swing-hard': 'A 휙 · 빠르게',
    'felt-launch': 'A 뽁 · 던지기', 'felt-flow': 'A 한 번 베기(흐름)', 'felt-combo': 'A 연속 여섯 번', 'felt-wrong': 'A 틀리게 베기(흐름)',
    'clean-slice-ok': 'B 베기 · 맞힘', 'clean-slice-wrong': 'B 베기 · 틀림', 'clean-swing-soft': 'B 휙 · 천천히', 'clean-swing-hard': 'B 휙 · 빠르게',
    'clean-launch': 'B 뽁 · 던지기', 'clean-flow': 'B 한 번 베기(흐름)', 'clean-combo': 'B 연속 여섯 번', 'clean-wrong': 'B 틀리게 베기(흐름)',
    'felt-stress': 'A 최악 겹침(목소리 둘 + 베기 + 휙 + 뽁 넷 + 끼워짐 + 성취)', 'clean-stress': 'B 최악 겹침',
    'snap': '톡 · 빈칸 끼워짐만', 'star': '별 하나(도6)', 'fill': '빈칸 끼워짐(톡 + 획득)', 'stars': '결과 별 셋(성취 + 도·미·솔)',
}

def biquad_k(fs):
    # BS.1770 K 가중(높은 선반 + 낮은 소리 거르기) — 표본율에 맞춰 계산(pyloudnorm과 같은 식)
    G, Q, fc = 3.99984385397, 0.7071752369554193, 1681.9744509555319
    A = 10 ** (G / 40); w0 = 2 * np.pi * fc / fs; al = np.sin(w0) / (2 * Q); c = np.cos(w0)
    b1 = [A * ((A + 1) + (A - 1) * c + 2 * np.sqrt(A) * al), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - 2 * np.sqrt(A) * al)]
    a1 = [(A + 1) - (A - 1) * c + 2 * np.sqrt(A) * al, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - 2 * np.sqrt(A) * al]
    fc2, Q2 = 38.13547087613982, 0.5003270373253953
    w0 = 2 * np.pi * fc2 / fs; al = np.sin(w0) / (2 * Q2); c = np.cos(w0)
    b2 = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; a2 = [1 + al, -2 * c, 1 - al]
    return (b1, a1), (b2, a2)

def measure(path):
    fs, x = wavfile.read(path)
    x = x.astype(np.float64) / (32768.0 if x.dtype == np.int16 else 1.0)
    if x.ndim == 1: x = x[:, None]
    peak = float(np.max(np.abs(x))) or 1e-9
    clip = int(np.sum(np.abs(x) >= 0.999))
    (b1, a1), (b2, a2) = biquad_k(fs)
    y = lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)
    win, hop = int(0.4 * fs), int(0.05 * fs)
    pad = np.vstack([np.zeros((win, y.shape[1])), y, np.zeros((win, y.shape[1]))])
    best = -120.0
    for s in range(0, len(pad) - win, hop):
        z = np.mean(pad[s:s + win] ** 2, axis=0).sum()
        if z > 0: best = max(best, -0.691 + 10 * np.log10(z))
    mono = x.mean(axis=1)
    env = np.convolve(np.abs(mono), np.ones(int(0.005 * fs)) / int(0.005 * fs), mode='same')
    on = np.where(env > np.max(env) * 10 ** (-40 / 20))[0]
    length = (on[-1] - on[0]) / fs if len(on) else 0.0
    seg = mono[on[0]:on[-1] + 1] if len(on) else mono
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) if len(seg) > 16 else np.zeros(2)
    freqs = np.fft.rfftfreq(len(seg), 1 / fs) if len(seg) > 16 else np.zeros(2)
    centroid = float(np.sum(freqs * spec) / np.sum(spec)) if np.sum(spec) > 0 else 0.0
    return {'peak_dbfs': round(20 * np.log10(peak), 1), 'clipped_samples': clip, 'loudness_lufs_m': round(best, 1),
            'audible_ms': round(length * 1000), 'centroid_hz': round(centroid)}

def spectrogram(path, w, h):
    out = tempfile.NamedTemporaryFile(suffix='.png', delete=False).name
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', path, '-lavfi',
                    f'aformat=channel_layouts=mono,showspectrumpic=s={w}x{h}:legend=0:scale=log:fscale=log:color=intensity', out], check=True)
    im = Image.open(out).convert('RGB'); os.unlink(out)
    return im

def main():
    names = [n[:-4] for n in sorted(os.listdir(SRC)) if n.endswith('.wav')]
    if '--only' in sys.argv:   # 빠른 반복: 고른 소리만 재고 표만 찍는다
        for n in sys.argv[sys.argv.index('--only') + 1:]:
            m = measure(os.path.join(SRC, n + '.wav'))
            print(f"{LABEL.get(n, n):<26} 최고 {m['peak_dbfs']:>6} 클립 {m['clipped_samples']} 음량 {m['loudness_lufs_m']:>6} 길이 {m['audible_ms']}ms")
        return
    order = [n for n in LABEL if n in names] + [n for n in names if n not in LABEL]
    res = {n: measure(os.path.join(SRC, n + '.wav')) for n in order}
    ref = res.get('kit-earn', {}).get('loudness_lufs_m')
    for n, m in res.items():
        if ref is not None: m['vs_earn_lu'] = round(m['loudness_lufs_m'] - ref, 1)
    with open(os.path.join(HERE, 'sound-results.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print(f"{'소리':<26}{'최고':>8}{'클립':>6}{'음량':>8}{'획득 대비':>10}{'길이':>8}{'밝기':>8}")
    for n, m in res.items():
        print(f"{LABEL.get(n, n):<22}{m['peak_dbfs']:>8}{m['clipped_samples']:>6}{m['loudness_lufs_m']:>8}{m.get('vs_earn_lu', ''):>10}{m['audible_ms']:>8}{m['centroid_hz']:>8}")
    # 스펙트로그램 한 장(가로: 시간, 세로: 낮은 음 → 높은 음, 로그 눈금)
    font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 20)
    small = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 15)
    cell_w, spec_h, head = 560, 150, 56
    cols = 3; rows = (len(order) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (cell_w + 16) + 16, rows * (spec_h + head + 16) + 16), '#fbf7f0')
    d = ImageDraw.Draw(sheet)
    for i, n in enumerate(order):
        x0 = 16 + (i % cols) * (cell_w + 16); y0 = 16 + (i // cols) * (spec_h + head + 16)
        m = res[n]
        d.text((x0, y0), LABEL.get(n, n), font=font, fill='#2b2320')
        d.text((x0, y0 + 27), f"최고 {m['peak_dbfs']}dBFS · 음량 {m['loudness_lufs_m']} (획득 대비 {m.get('vs_earn_lu', '-')}) · {m['audible_ms']}ms", font=small, fill='#575046')
        sheet.paste(spectrogram(os.path.join(SRC, n + '.wav'), cell_w, spec_h), (x0, y0 + head))
    sheet.save(os.path.join(HERE, '소리_스펙트럼.jpg'), quality=88)
    bad = [n for n, m in res.items() if m['clipped_samples'] or m['peak_dbfs'] > -0.3]
    if bad: print('클리핑 또는 최고 레벨 초과:', bad); sys.exit(1)

if __name__ == '__main__':
    main()

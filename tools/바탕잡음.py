"""바탕 잡음 재기 — 편에 까는 긴 소리 파일이 고르게 쉬익거리는 잡음(화이트 · 핑크 노이즈 꼴)인지 잰다(2026-11-27).

    python -X utf8 tools/바탕잡음.py <소리 파일…>

11-27 유호님 「화이트노이즈 소리랑 … 마지막에 이해가 잘 안가」 — LAB E64 「서비스」에 분식집 바탕으로 깐 sfx/bunsik.wav가
실제 식당 녹음이 아니라 고른 잡음이었다(1~12kHz 평탄도 0.36, 1초 음량 흔들림 0.5dB). 섞은 소리의 6kHz 위가 거의 다 이 파일이라
말이 없는 끝 5초에 쉬익 소리만 남았다. 음악(bgm.wav)은 평탄도 0.08~0.18이다.

파일마다 1초 칸으로 1~12kHz 스펙트럼 평탄도(기하 평균 ÷ 산술 평균, 잡음 1에 가깝고 음악 · 말 0.1 안팎)의 가운데값,
평탄도 0.30 넘는 칸의 비율(잡음초비율), 1초 음량(dB)의 표준편차를 낸다. 영상(mp4)을 주면 섞인 소리를 잰다.
판정은 tools/lib/바탕소리관문.js(올리기 전 검사 ㉔)가 한다. 11-27 실측: 잡음 바탕을 깐 최종본은 잡음초비율 0.21~0.59 ·
가운데 0.20~0.32(E64 v6 · v7, 드세요, 아까워, 이잔주세요), 음악 · 말만 있거나 바탕이 아주 작은 LAB 최종본 18편은 0.12 이하 · 0.18 이하.
"""
import json
import subprocess
import sys

import numpy as np

SR = 32000


def load(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)


def measure(path):
    x = load(path)
    out = {'파일': path, '길이': round(len(x) / SR, 2)}
    if len(x) < SR:
        out['못잼'] = '1초보다 짧거나 읽지 못했다'
        return out
    n, hop = 2048, 1024
    w = np.hanning(n)
    f = np.fft.rfftfreq(n, 1 / SR)
    band = (f >= 1000) & (f <= 12000)
    flats, levels = [], []
    for s in range(0, len(x) - SR + 1, SR):
        seg = x[s:s + SR]
        rms = float(np.sqrt(np.mean(seg ** 2)))
        db = 20 * np.log10(rms + 1e-12)
        if db < -60:
            continue
        levels.append(db)
        fl = []
        for i in range(0, len(seg) - n + 1, hop):
            p = np.abs(np.fft.rfft(seg[i:i + n] * w))[band] ** 2 + 1e-18
            fl.append(np.exp(np.mean(np.log(p))) / np.mean(p))
        flats.append(float(np.mean(fl)))
    if not flats:
        out['못잼'] = '소리가 거의 없다(1초 칸이 모두 −60dB 아래)'
        return out
    out['평탄도'] = round(float(np.median(flats)), 3)
    out['잡음초비율'] = round(float(np.mean(np.array(flats) >= 0.30)), 2)
    out['초수'] = len(flats)
    out['흔들림dB'] = round(float(np.std(levels)), 2)
    out['음량dB'] = round(float(np.median(levels)), 1)
    return out


if __name__ == '__main__':
    files = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not files:
        print(__doc__)
        sys.exit(2)
    print(json.dumps([measure(p) for p in files], ensure_ascii=False))

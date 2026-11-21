# C6 서진의 「Okay, Grandma.」를 시댄스가 「Grandpa」로 냈다(11-21 — 두 받아쓰기 모델이 모두 Grandpa, 1.83~1.85초 완전한 끊김 뒤 1.86~1.90초 높은 띠 터짐 = p).
# 입 모양은 p와 m이 같으니 다시 굽지 않고, p 터짐 자리(1.830~1.925초)를 바로 앞 「n」 콧소리(1.770~1.825초)로 메우고
# 모음 첫머리(~1.960초)의 높은 띠(숨 꼬리)를 걷어 「Granma」로 잇는다. 고친 소리를 두 모델(large-v3-turbo · medium)이 모두 「Grandma」로 받아썼다.
import numpy as np
from scipy.signal import butter, sosfiltfilt

SR = 48000


def patch(x, a=1.830, b=1.925, s0=1.770, s1=1.825, lp_end=1.960):
    """x: C6 판 처음부터의 소리(48kHz, (n, 2))."""
    y = x.copy()
    seg = x[int(s0 * SR):int(s1 * SR)]
    n = int((b - a) * SR)
    rep = np.concatenate([seg, seg[::-1], seg, seg[::-1]])[:n]
    k = int(0.006 * SR)
    w = np.ones(n, np.float32); w[:k] = np.linspace(0, 1, k); w[-k:] = np.linspace(1, 0, k)
    i = int(a * SR)
    y[i:i + n] = y[i:i + n] * (1 - w[:, None]) + rep * w[:, None]
    sos = butter(6, 1800, "low", fs=SR, output="sos")
    i, j = int(b * SR), int(lp_end * SR)
    f = sosfiltfilt(sos, y[i - 200:j + 200], axis=0)
    w = np.ones(j - i, np.float32); k = int(0.01 * SR); w[-k:] = np.linspace(1, 0, k)
    y[i:j] = f[200:200 + j - i] * w[:, None] + y[i:j] * (1 - w[:, None])
    return y.astype(np.float32)

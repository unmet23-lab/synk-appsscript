# -*- coding: utf-8 -*-
"""교정한 조율 — 내레이션 버스를 build()와 똑같이 만들되(압축만 뺀 상태), 압축·리미터 조합별로 리미터가 일한 양을 잰다."""
import sys, os, json, itertools
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
import mix_v2 as M
SR = M.SR
res = []
for bgm_lufs in (-27.0, -25.0):
    M.BGM_LUFS = bgm_lufs
    orig = M.compress; M.compress = lambda v, **k: (v, 0.0)
    mix, meta = M.build(voice=True); M.compress = orig
    bus_v = np.zeros(len(mix), np.float32)
    for t, bus, f, gdb, what in M.R.AUDIO:
        if bus != "voice": continue
        y = M.load(os.path.join(M.BASE, f), 1)[:, 0] * (10 ** (gdb / 20)); i = int(round(t * SR)); j = min(len(mix), i + len(y)); bus_v[i:j] += y[: j - i]
    rest = mix - bus_v[:, None]
    assert np.abs(rest).max() < 1.0
    for thr, ratio in ((-16.0, 2.5), (-20.0, 3.0), (-22.0, 3.5)):
        for att in (0.001, 0.003):
            vc, gr_c = M.compress(bus_v.copy(), thr_db=thr, ratio=ratio, att=att, rel=0.10)
            I_pre = M.measure(np.repeat(bus_v[:, None], 2, 1))[0]; I_post = M.measure(np.repeat(vc[:, None], 2, 1))[0]
            vc = vc * 10 ** ((I_pre - I_post) / 20)
            y, info = M.master(rest + vc[:, None])
            act = np.abs(bus_v) > 1e-4
            r = {"bgm": bgm_lufs, "thr": thr, "ratio": ratio, "att_ms": att * 1000, **{k: info[k] for k in ("I", "TP", "gain_db", "limiter_max_gr_db", "limiter_over3db_pct", "limiter_over1db_pct")}, "comp_max_gr": round(gr_c, 1)}
            res.append(r); print(json.dumps(r))
json.dump(res, open("out/tune_mix2.json", "w"), indent=1)

# 콘티 v5 영상 시작 · 끝 그림(2026-10-25) — Gemini에서 받은 그대로의 판을 Seedance에 넣을 16:9 1920×1080으로 자르기만 한다.
#   python -X utf8 영상시작_v5.py S07=S07_165012.jpg S05e=S05e_171230.jpg@x0,y0,폭 …   → synk-vendor/…/영상/시작_v5/<id>.jpg · _시작기록.json
# 결정 10-24(후보정 최대한 안 함): 색 옮기기 · 밝히기 · 흐림을 하지 않는다. 빛은 지시문(이미지콘티_v5.json 「빛」 칸)으로 굽는다.
# 자르기 창은 v4와 같은 셈(이미지콘티_v4_맞춤.fit, light=False) — 얼굴(YuNet) · 강도 머리 폭 · 사람 전체 상자를 원본 그 컷의 프레임과 같은 자리 · 폭으로.
# 끝 그림(<컷>e)은 원본 그 컷의 끝 프레임에 맞추고, @x0,y0,폭을 주면 그 창(받은 그림 좌표)으로 자른다. 창이 받은 폭의 45%보다 작아야 맞으면 45%에서 멈추고 「다시 굽기 후보」로 적는다.
import importlib.util
import json
import os
import sys

V = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/"
OUT = V + "영상/시작_v5/"

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    lp = OUT + "_시작기록.json"
    log = json.load(open(lp, encoding="utf-8")) if os.path.exists(lp) else {}
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location("fit", os.path.join(here, "이미지콘티_v4_맞춤.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    for arg in sys.argv[1:]:
        cid, _, pick = arg.partition("=")
        pick, _, win = pick.partition("@")
        n = int(cid[1:3])
        end = cid.endswith("e")
        keep_crop, keep_sh = m.CROP.pop(n, None), m.SH[n - 1]
        if win:
            m.CROP[n] = tuple(int(v) for v in win.split(","))
        if end:   # 끝 그림은 원본 그 컷의 끝 프레임 자리에 맞춘다
            m.SH[n - 1] = {**keep_sh, "f0": keep_sh["f1"] - 1}
        try:
            _, note = m.fit(n, V + "받음/v5/" + pick, out=OUT + cid + ".jpg", light=False, blur=False)
        finally:
            m.SH[n - 1] = keep_sh
            m.CROP.pop(n, None)
            if keep_crop is not None:
                m.CROP[n] = keep_crop
        log[cid] = f"받은 그대로 {pick} · " + ("원본 끝 프레임 기준 · " if end else "") + note
        print(cid, log[cid])
    json.dump(log, open(lp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

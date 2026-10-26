# 7번 이미지 콘티 — 받은 판을 원본 첫 프레임의 얼굴 자리 · 크기로 잘라 맞춘다(2026-10-27, 「매진 임박」 v4 이미지콘티_v4_맞춤.py와 같은 길 — 만족 사례 S31).
# Gemini는 「얼굴이 화면 높이의 몇 %」를 잘 안 따르고 넓게 그린다(10-26 시험: 원본 25%인 컷이 10~13%). 색 · 빛은 건드리지 않고 자르기 · 크기만 바꾼다(결정 10-24 후보정 없음).
#   python -X utf8 이미지콘티_맞춤.py [컷…]   → 콘티/p7/정지컷/<컷>.jpg(1080×1920) · 정지컷/_맞춤.json(배율 · 자리)
# 고른 판은 정지컷/_고른판.json(컷 → 받음/ 파일 이름). 얼굴 상자는 원본첫프레임/_얼굴.json(YuNet), 받은 판의 얼굴은 같은 배역(SFace)으로 고른다.
# 배율이 2.2를 넘으면(받은 판이 너무 넓음) 자르지 않고 「다시 굽기」로 적는다 — 너무 키우면 화질이 무너진다.
import json, os, sys
from pathlib import Path
import cv2, numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p7")
W, H = 1080, 1920
MAXS = 2.2
sys.path.insert(0, str(HERE))
import 이미지콘티_닮음 as 닮음   # noqa: E402  (YuNet · SFace · 배역 기준)
import 이미지콘티_지시문 as 지시   # noqa: E402  (컷마다 배역 · 얼굴 순번)

NAME = {"Seojin": "서진", "Ian": "이안", "Minjae": "민재", "Soyeon": "소연"}
CODE = {"S": "서진", "I": "이안", "M": "민재", "Y": "소연"}


def target(k):
    c = 지시.C.get(k, {})
    fx = c.get("fx")
    if not fx:
        return None, None
    who = next((v for n, v in NAME.items() if n in fx[1]), CODE.get((c.get("f") or "S")[0]))
    return fx[0], who


def fit(k, src):
    im = cv2.imdecode(np.fromfile(str(src), np.uint8), cv2.IMREAD_COLOR)
    h0, w0 = im.shape[:2]
    rec = {"원본": src.name}
    idx, who = target(k)
    ofs = 지시.facebox.get(k) or []
    if idx is not None and len(ofs) > idx:
        o = ofs[idx]
        fs = 닮음.faces(im)
        if fs:
            s = 1200 / max(h0, w0)
            best = max(fs, key=lambda fe: np.mean([닮음.FR.match(fe[1], r, cv2.FaceRecognizerSF_FR_COSINE) for r in 닮음.REF[who]]) if who in 닮음.REF else fe[0][2])
            f = best[0] / s
            fh, fcx, fcy = float(f[3]) / h0, float(f[0] + f[2] / 2) / w0, float(f[1] + f[3] / 2) / h0
            scale = o["h"] / fh
            rec.update({"배역": who, "우리얼굴높이": round(fh, 3), "원본얼굴높이": o["h"], "배율": round(scale, 2)})
            if scale > MAXS:
                rec["판정"] = "다시 굽기(너무 넓음)"
            elif scale > 1.04:
                cw, chh = w0 / scale, h0 / scale
                ocx, ocy = o["x"] + o["w"] / 2, o["y"] + o["h"] / 2
                x0 = fcx * w0 - ocx * cw
                y0 = fcy * h0 - ocy * chh
                x0c, y0c = min(max(x0, 0), w0 - cw), min(max(y0, 0), h0 - chh)
                rec["밀림"] = [round((x0c - x0) / cw, 3), round((y0c - y0) / chh, 3)]
                im = im[int(y0c):int(y0c + chh), int(x0c):int(x0c + cw)]
                rec["판정"] = "잘라 맞춤"
            else:
                rec["판정"] = "그대로(우리 판이 원본만큼 가깝거나 더 가까움)"
    # 9:16로 가운데 맞춤 후 1080×1920
    hh, ww = im.shape[:2]
    if ww / hh > W / H:
        nw = int(hh * W / H); x = (ww - nw) // 2; im = im[:, x:x + nw]
    else:
        nh = int(ww * H / W); y = (hh - nh) // 2; im = im[y:y + nh, :]
    out = cv2.resize(im, (W, H), interpolation=cv2.INTER_CUBIC if im.shape[1] < W else cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 93])
    buf.tofile(str(V / "정지컷" / f"{k}.jpg"))
    return rec


if __name__ == "__main__":
    picks = json.load(open(V / "정지컷" / "_고른판.json", encoding="utf-8"))
    keys = sys.argv[1:] or [k for k in picks if not k.startswith("L")]
    log_p = V / "정지컷" / "_맞춤.json"
    log = json.load(open(log_p, encoding="utf-8")) if log_p.exists() else {}
    for k in keys:
        log[k] = fit(k, V / "받음" / picks[k])
        print(k, log[k])
    json.dump(log, open(log_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

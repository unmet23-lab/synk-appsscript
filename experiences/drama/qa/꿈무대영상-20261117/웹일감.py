"""
꿈 무대 콘티(2026-11-17) — 드리미나 웹 굽기 일감(job.json)을 만든다. 실행은 ego 스크립트 `~/ego/dream-stage-20261117/bake.mjs`.
지시문은 한 줄로 펴고(무제한 스위치는 지시문이 약 1,000자를 넘거나 줄바꿈이 많으면 사라진다 — 11-17 실측) 1,000자를 넘으면 멈춘다.
참고 그림은 왼쪽 위 「AI」 표시를 지우고(unmet23 계정은 받은 그림에 표시가 찍힌다) 긴 변 1920 JPEG로 줄여 넣는다.

    python -I -X utf8 웹일감.py <지시문.txt> <판 이름> [<참고 그림>…]
"""
import base64
import json
import os
import sys

import cv2
import numpy as np

EGO = "C:/Users/q1212/ego/dream-stage-20261117/job.json"
OUT = "C:/Users/q1212/Documents/SYNK-appsscript/.tmp/꿈무대영상-20261117/콘티/"


def 참고(p, k):
    im = cv2.imdecode(np.fromfile(p, np.uint8), 1)
    h0, w0 = im.shape[:2]
    if "드리미나" in p or os.path.basename(p).startswith(("C1", "C2", "C3")):
        s = w0 / 1920
        m = np.zeros(im.shape[:2], np.uint8)
        m[int(10 * s):int(70 * s), int(10 * s):int(90 * s)] = 255
        im = cv2.inpaint(im, m, 7, cv2.INPAINT_TELEA)
    if max(h0, w0) > 1920:
        f = 1920 / max(h0, w0)
        im = cv2.resize(im, (int(w0 * f), int(h0 * f)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", im, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return {"name": f"ref{k}.jpg", "b64": base64.b64encode(buf.tobytes()).decode()}


def main():
    글 = open(sys.argv[1], encoding="utf-8").read().strip()
    글 = " ".join(x.strip() for x in 글.splitlines() if x.strip()).replace("[IMG1]", "reference image 1").replace("[IMG2]", "reference image 2").replace("[IMG3]", "reference image 3")
    if len(글) > 1000:
        raise SystemExit(f"지시문이 {len(글)}자 — 1,000자 아래로 줄인다(무제한 스위치가 사라진다)")
    refs = [참고(p, k) for k, p in enumerate(sys.argv[3:], 1)]
    json.dump({"prompt": 글, "refs": refs, "out": OUT, "tag": sys.argv[2]}, open(EGO, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"일감 {sys.argv[2]} · {len(글)}자 · 참고 {len(refs)}장")


if __name__ == "__main__":
    main()

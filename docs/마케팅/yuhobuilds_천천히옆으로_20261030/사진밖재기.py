"""yuhobuilds Y24 — AI 영상 프레임마다 「넣은 사진 밖」(AI가 지어낸 곳)이 화면의 몇 %인지 잰다(2026-10-30).

넣은 사진과 영상 프레임을 SIFT 특징점으로 맞춰(RANSAC 호모그래피) 사진 테두리를 프레임 위에 옮기고,
그 테두리 밖 넓이를 화면 대비 %로 적는다. 깊이가 다른 물체가 섞여 있어 한 장 변환은 어림이다 —
맞은 점 수와 테두리 그림을 함께 남겨 눈으로 확인한다.

    python -I 사진밖재기.py <넣은 사진> <영상.mp4> <출력 폴더> [--간격 0.5] [--그림없이] [--조용히]

테두리(화면 비율 좌표 네 점)도 프레임마다 남겨 Remotion이 흰 선 · 붉은 덮개를 그린다(--간격 0.0417 = 24fps 모든 프레임).
"""
import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    photo_p, video, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    step = float(sys.argv[sys.argv.index("--간격") + 1]) if "--간격" in sys.argv else 0.5
    out.mkdir(parents=True, exist_ok=True)
    photo = cv2.imdecode(np.fromfile(photo_p, np.uint8), cv2.IMREAD_COLOR)
    sift = cv2.SIFT_create(4000)
    kp0, des0 = sift.detectAndCompute(cv2.cvtColor(photo, cv2.COLOR_BGR2GRAY), None)
    matcher = cv2.BFMatcher()
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], capture_output=True, text=True).stdout)
    cap = cv2.VideoCapture(video)
    fps = cap.get(cv2.CAP_PROP_FPS)
    rows = []
    t = 0.0
    while t <= dur - 0.05:
        cap.set(cv2.CAP_PROP_POS_FRAMES, round(t * fps))
        ok, fr = cap.read()
        if not ok:
            break
        H_, W_ = fr.shape[:2]
        kp1, des1 = sift.detectAndCompute(cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY), None)
        good = [m for m, n in matcher.knnMatch(des0, des1, k=2) if m.distance < 0.72 * n.distance]
        row = {"초": round(t, 2), "맞은점": len(good)}
        if len(good) >= 12:
            src = np.float32([kp0[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
            dst = np.float32([kp1[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
            Hm, mask = cv2.findHomography(src, dst, cv2.RANSAC, 4.0)
            if Hm is not None:
                h0, w0 = photo.shape[:2]
                quad = cv2.perspectiveTransform(np.float32([[0, 0], [w0, 0], [w0, h0], [0, h0]]).reshape(-1, 1, 2), Hm)
                inside = np.zeros((H_, W_), np.uint8)
                cv2.fillPoly(inside, [np.int32(quad.reshape(-1, 2))], 1)
                row["사진밖_화면비"] = round(float(1 - inside.mean()) * 100, 1)
                row["안쪽점"] = int(mask.sum())
                row["사진_오른쪽끝_x비"] = round(float(max(quad[1, 0, 0], quad[2, 0, 0]) / W_ * 100), 1)
                row["테두리"] = [[round(float(x) / W_, 4), round(float(y) / H_, 4)] for x, y in quad.reshape(-1, 2)]
                # 테두리 그림: 사진 밖을 붉게 덮고 테두리를 흰 선으로
                vis = fr.copy()
                red = vis.copy()
                red[inside == 0] = (0.45 * red[inside == 0] + 0.55 * np.array([40, 40, 230])).astype(np.uint8)
                cv2.polylines(red, [np.int32(quad.reshape(-1, 2))], True, (255, 255, 255), 3)
                if "--그림없이" not in sys.argv:
                    cv2.imencode(".jpg", red)[1].tofile(str(out / f"밖_{t:04.1f}.jpg"))
        rows.append(row)
        if "--조용히" not in sys.argv:
            print({k: v for k, v in row.items() if k != "테두리"})
        t += step
    (out / "사진밖.json").write_text(json.dumps({"사진": photo_p, "영상": video, "프레임": rows}, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()

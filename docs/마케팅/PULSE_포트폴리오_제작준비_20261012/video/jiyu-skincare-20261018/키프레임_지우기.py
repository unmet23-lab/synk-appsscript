# 지유 스킨케어 · 키프레임에서 남는 작은 것(물방울·배경 소품)을 주변으로 메운다(OpenCV Telea, CPU).
#   <AI-Toolkit 가상환경 python> -X utf8 키프레임_지우기.py   → 키프레임_A/컷1_v3.jpg, 컷3_시작_v4b.jpg, 컷5_v3b.jpg
# 10-18 Fable 검수:
#   - 컷1_v2 물방울 5개(콘티는 1~2개). 「헤어라인 1·턱 끝 1만」을 Gemini에 이미 한 번 요청했는데도 5개가 나와,
#     다시 뽑으면 얼굴이 바뀔 위험이 커서 셋(이마 가운데·볼·입술 밑)만 지운다. 입술 밑 것은 영상에서 기어갈 위험이 있었다.
#   - 컷3_시작_v4(솜을 새 대화로 다시 뽑은 판)는 뒤 선반 화분 옆에 흐린 흰 병 모양 소품이 있다(콘티: 병은 블렌더로만).
import os
import sys

import cv2
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
K = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018", "키프레임_A")

# (파일, 결과, 동그라미 [(x, y, 반지름)], 네모 [(x0, y0, x1, y1)], 메움 반경) — 원본 1536×2752 좌표
JOBS = [
    ("컷1_v2.jpg", "컷1_v3.jpg", [(752, 715, 9), (820, 1085, 9), (680, 1445, 8)], [], 6),
    ("컷3_시작_v4.jpg", "컷3_시작_v4b.jpg", [], [(1290, 855, 1378, 1042), (1495, 1015, 1536, 1165)], 25),
    # 컷5_v3: Fable 재검수 「볼에 점 3개가 새로 생김(다른 컷엔 없음)」 — 볼 아래 둘·광대 위 하나. 옅은 주근깨는 둔다
    ("컷5_v3.jpg", "컷5_v3b.jpg", [(730, 1151, 6), (721, 1217, 6), (854, 962, 7)], [], 5),
]


def main():
    for src, dst, circles, rects, rad in JOBS:
        img = cv2.imdecode(np.fromfile(os.path.join(K, src), dtype=np.uint8), cv2.IMREAD_COLOR)
        mask = np.zeros(img.shape[:2], np.uint8)
        for x, y, r in circles:
            cv2.circle(mask, (x, y), r, 255, -1)
        for x0, y0, x1, y1 in rects:
            cv2.rectangle(mask, (x0, y0), (x1, y1), 255, -1)
        out = cv2.inpaint(img, mask, rad, cv2.INPAINT_TELEA)
        if rects:
            # 흐린 배경을 넓게 메우면 가장자리에 결이 남아 한 번 더 흐린다(메운 자리만)
            blur = cv2.GaussianBlur(out, (0, 0), 6)
            soft = cv2.GaussianBlur(mask, (0, 0), 8).astype(np.float32)[..., None] / 255.0
            out = (out * (1 - soft) + blur * soft).astype(np.uint8)
        ok, buf = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 96])
        buf.tofile(os.path.join(K, dst))
        print(f"{src} → {dst}: {len(circles) + len(rects)}곳 메움")


if __name__ == "__main__":
    main()

"""
「제2의 나」 사진 기반 아바타 시험 — 대역의 눈가림 시험지 (2026-11-03).
올린 셀카 한 장 옆에 후보 넷(보정 약 · 중 · 강 + 미끼 = 같은 지역 · 성별의 다른 조각)을 정해진 씨앗으로 섞어 A~D로 붙인다.
시험관은 순서표를 모르고 「같은 사람인가 · 매력 · 이 셀카 주인이라면 내 캐릭터로 쓰고 싶은 순서」를 답한다(질문은 `시험관질문.md`).
실제 사람(유호님) 사진은 시험관에게 보내지 않는다 — 본인 판정만.

    python -I -X utf8 눈가림.py <대역 id> <올린 셀카> <약> <중> <강> <미끼> <밖 폴더>
"""
import json
import os
import random
import sys

import cv2
import numpy as np

대역, 올림, 약, 중, 강, 미끼, 밖 = sys.argv[1:8]
os.makedirs(밖, exist_ok=True)
후보 = [("약", 약), ("중", 중), ("강", 강), ("미끼", 미끼)]
random.Random(f"me2-photo-{대역}").shuffle(후보)
H = 640


def 칸(p, 글):
    im = cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
    h, w = im.shape[:2]
    im = cv2.resize(im, (int(w * H / h), H), interpolation=cv2.INTER_AREA)
    cv2.rectangle(im, (0, 0), (150 if len(글) > 1 else 60, 52), (0, 0, 0), -1)
    cv2.putText(im, 글, (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (255, 255, 255), 3)
    return im


줄 = [칸(올림, "UP")] + [칸(p, "ABCD"[i]) for i, (_, p) in enumerate(후보)]
판 = np.hstack([np.pad(x, ((0, 0), (0, 12), (0, 0)), constant_values=255) for x in 줄])
시험지 = os.path.join(밖, f"{대역}_시험지.jpg")
cv2.imencode(".jpg", 판, [cv2.IMWRITE_JPEG_QUALITY, 88])[1].tofile(시험지)
for i, (_, p) in enumerate(후보):  # GPT에는 한 장씩도 붙인다(붙인 순서 = UP, A, B, C, D)
    cv2.imencode(".jpg", 칸(p, "ABCD"[i]), [cv2.IMWRITE_JPEG_QUALITY, 88])[1].tofile(os.path.join(밖, f"{대역}_{'ABCD'[i]}.jpg"))
cv2.imencode(".jpg", 칸(올림, "UP"), [cv2.IMWRITE_JPEG_QUALITY, 88])[1].tofile(os.path.join(밖, f"{대역}_UP.jpg"))
json.dump({"ABCD"[i]: 이름 for i, (이름, _) in enumerate(후보)}, open(os.path.join(밖, f"{대역}_순서표.json"), "w", encoding="utf-8"), ensure_ascii=False)
print(json.dumps({"시험지": 시험지}, ensure_ascii=False))

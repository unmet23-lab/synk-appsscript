"""
「제2의 나」 실존 인물 대조 — 얼굴 자르기와 역검색 결과 닮음 (2026-11-03).
T-C `닮음.py`와 같은 모델(OpenCV YuNet + SFace). 얼굴 닮음 점수는 공인 대조 도구가 아니다(설계 5절) — 역검색이 데려온 사진 가운데
실제로 얼굴이 가까운 것을 골라낼 뿐이다. 렌즈는 웹 전체에서 가장 닮은 얼굴을 모아 오므로 스톡 · AI 그림 · SNS 일반인 사진이
0.50~0.60까지 나온다(T-C 넷 모두) — 그래서 판정은 공인 출처 카드(배우 프로필 · 위키 · 영화 DB · 소속사 · 선수 기록 등)로만 한다.
  - 걸림: 공인 카드 하나가 0.55 이상(셀카 속 같은 사람의 가장 낮은 값 0.56 언저리), 또는 0.40 이상인 공인 카드가 서로 같은 얼굴(0.55 이상)로 둘 넘게 모임
          — 렌즈가 그 한 사람 쪽으로 모였다는 뜻(T-C uz-m: 같은 해외 배우 셋 0.40~0.43, Fable 「특정 해외 배우 인상」과 같음)
  - 살핌: 공인 카드 하나가 0.40 이상 — 나란히 놓고 눈으로 정해 적는다(T-C mn-f 0.497: 긴 생머리 · 가운데 가르마 유형만 같고 얼굴은 다름)
  - 일반 카드 최고값은 기록만 한다.

    python -I -X utf8 실존대조_얼굴.py 자르기 <그림> <밖.jpg>          얼굴 + 머리만 정사각에 가깝게 자른다(렌즈 · 판별 모델에 넣을 판)
    python -I -X utf8 실존대조_얼굴.py 렌즈닮음 <조각 그림> <렌즈 결과 폴더>   결과.json의 썸네일마다 얼굴을 찾아 견주고 렌즈.json을 쓴다
    python -I -X utf8 실존대조_얼굴.py 나란히 <조각 그림> <렌즈 결과 폴더> <밖.jpg>   살핌을 눈으로 정할 한 장(조각 + 공인 카드 위 다섯)
"""
import json
import os
import re
import sys

import cv2
import numpy as np

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")
걸림, 살핌, 같은얼굴 = 0.55, 0.40, 0.55
공인출처 = re.compile(r"IMDb|Movie Database|TMDB|위키|Wikipedia|wiki|Кинориум|Кинопоиск|키노라이츠|왓챠|배우|actor|actress|프로필·출연작|Biography|Management|agency|소속사|Cast &|Full Cast|덕스티켓|필름메이커스|Transfermarkt|선수|가수|아이돌|idol|singer|K-?pop|Kpop|kprofiles|celebrit|famous|news|뉴스|기자", re.I)


def 닮음(a, b):
    return round(float(FR.match(a, b, cv2.FaceRecognizerSF_FR_COSINE)), 3)


def 읽기(p):
    buf = np.fromfile(p, np.uint8)
    return cv2.imdecode(buf, cv2.IMREAD_COLOR) if buf.size else None  # 빈 썸네일(0바이트 응답)은 없는 그림으로


def 얼굴들(img):
    h, w = img.shape[:2]
    if min(h, w) < 160:  # 썸네일은 작아 YuNet이 놓친다 — 두 배로 키워 찾는다
        img = cv2.resize(img, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
        h, w = img.shape[:2]
    elif max(h, w) > 1200:  # 큰 원본(1792×2400)은 점수가 떨어진다(히잡 조각 0.68 → 줄이면 0.94) — 긴 변 1200으로
        s = 1200 / max(h, w)
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]
    FD.setInputSize((w, h))
    _, faces = FD.detect(img)
    return img, ([] if faces is None else [f for f in faces if f[14] >= 0.7])


def 가장큰(img):
    img, fs = 얼굴들(img)
    if not fs:
        return img, None
    return img, max(fs, key=lambda f: f[2] * f[3])


if sys.argv[1] == "자르기":
    src, dst = sys.argv[2], sys.argv[3]
    img, f = 가장큰(읽기(src))
    if f is None:
        raise SystemExit(f"얼굴을 못 찾음: {src}")
    h, w = img.shape[:2]
    x, y, fw, fh = f[:4]
    cx, cy, s = x + fw / 2, y + fh * 0.40, max(fw, fh) * 1.45
    x0, y0, x1, y1 = int(max(0, cx - s / 2)), int(max(0, cy - s / 2)), int(min(w, cx + s / 2)), int(min(h, cy + s / 2))
    cv2.imencode(".jpg", img[y0:y1, x0:x1], [cv2.IMWRITE_JPEG_QUALITY, 92])[1].tofile(dst)
    print(json.dumps({"자름": dst, "크기": [x1 - x0, y1 - y0]}, ensure_ascii=False))

elif sys.argv[1] == "렌즈닮음":
    조각, 폴더 = sys.argv[2], sys.argv[3]
    img, f = 가장큰(읽기(조각))
    if f is None:
        raise SystemExit(f"조각 얼굴을 못 찾음: {조각}")
    기준 = FR.feature(FR.alignCrop(img, f))
    결과 = json.load(open(os.path.join(폴더, "결과.json"), encoding="utf-8"))
    줄, 특징 = [], {}
    for c in 결과["카드"]:
        if not c.get("파일"):
            continue
        원 = 읽기(os.path.join(폴더, c["파일"]))
        if 원 is None:  # 받은 썸네일이 그림이 아닌 때(빈 응답 · 지원 밖 형식) — 건너뛴다
            continue
        t, fs = 얼굴들(원)
        if not fs:
            continue
        점, g = max(((닮음(기준, FR.feature(FR.alignCrop(t, g))), g) for g in fs), key=lambda x: x[0])
        특징[c["번호"]] = FR.feature(FR.alignCrop(t, g))
        줄.append({"번호": c["번호"], "파일": c["파일"], "닮음": 점, "공인": bool(공인출처.search(c["글"] + " " + c.get("주소", ""))), "글": c["글"][:100], "주소": c.get("주소", "")[:160]})
    줄.sort(key=lambda r: -r["닮음"])
    공인 = [r for r in 줄 if r["공인"]]
    # 0.40 넘은 공인 카드를 얼굴끼리 묶는다 — 같은 사람이 여러 번 잡히면 렌즈가 그 사람 쪽으로 모인 것
    높은 = [r for r in 공인 if r["닮음"] >= 살핌]
    무리 = max((sum(1 for s in 높은 if 닮음(특징[r["번호"]], 특징[s["번호"]]) >= 같은얼굴) for r in 높은), default=0)
    공인최고 = 공인[0]["닮음"] if 공인 else None
    판정 = "걸림" if (공인최고 or 0) >= 걸림 or 무리 >= 2 else "살핌" if (공인최고 or 0) >= 살핌 else "통과"
    요약 = {"조각": os.path.basename(조각), "카드": len(결과["카드"]), "얼굴": len(줄), "최고": 줄[0]["닮음"] if 줄 else None,
            "공인카드": len(공인), "공인최고": 공인최고, "공인무리": 무리, "판정": 판정, "공인위": 공인[:5], "위": 줄[:5]}
    json.dump(요약, open(os.path.join(폴더, "렌즈.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in 요약.items() if k not in ("위", "공인위")}, ensure_ascii=False))
elif sys.argv[1] == "나란히":
    # 살핌 판정을 눈으로 정할 한 장 — 조각 얼굴 + 렌즈 공인 카드 위 다섯(닮음 숫자 붙임). 공인 카드가 없으면 전체 위 다섯.
    조각, 폴더, 밖 = sys.argv[2], sys.argv[3], sys.argv[4]
    요약 = json.load(open(os.path.join(폴더, "렌즈.json"), encoding="utf-8"))
    줄 = (요약.get("공인위") or 요약.get("위") or [])[:5]
    H = 300
    def 칸(im, 글):
        h, w = im.shape[:2]
        im = cv2.resize(im, (max(1, int(w * H / h)), H))
        cv2.putText(im, 글, (6, H - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 4)
        cv2.putText(im, 글, (6, H - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        return im
    img, f = 가장큰(읽기(조각))
    x, y, fw, fh = [int(v) for v in f[:4]]
    s = int(max(fw, fh) * 0.75)
    cx, cy = x + fw // 2, y + int(fh * 0.45)
    칸들 = [칸(img[max(0, cy - s):cy + s, max(0, cx - s):cx + s], "piece")]
    칸들 += [칸(읽기(os.path.join(폴더, r["파일"])), f"{r['닮음']:.2f}") for r in 줄]
    cv2.imencode(".jpg", np.hstack(칸들), [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tofile(밖)
    print(json.dumps({"나란히": 밖, "칸": len(칸들) - 1}, ensure_ascii=False))
else:
    raise SystemExit(__doc__)

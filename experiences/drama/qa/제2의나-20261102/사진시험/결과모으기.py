"""
「제2의 나」 사진 기반 아바타 시험 — 결과 페이지에 넣을 결과.json을 판 · 숫자에서 모은다 (2026-11-03).
숫자는 이 자리에서 다시 잰다(닮음.py와 같은 YuNet + SFace). 판 경로는 공용 작업본 .tmp/me2-20261102/ 아래, 유호님 실제 사진은 고정 얼굴 세트 폴더.

    python -I -X utf8 결과모으기.py <밖 결과.json>
"""
import glob
import json
import os
import sys

import cv2
import numpy as np

W = r"C:\Users\q1212\Documents\SYNK-appsscript\.tmp\me2-20261102"
D = r"C:\Users\q1212\Videos\한강2126_새판_20261009\재촬영_v40\기준그림\얼굴세트"
M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")


def 하나(p, 쪽=None):
    im = cv2.imdecode(np.fromfile(p, np.uint8), 1)
    h, w = im.shape[:2]
    if max(h, w) > 1200:
        s = 1200 / max(h, w); im = cv2.resize(im, (int(w * s), int(h * s))); h, w = im.shape[:2]
    FD.setInputSize((w, h)); _, fs = FD.detect(im)
    fs = [f for f in fs if f[14] >= 0.7 and f[2] >= 0.06 * w]
    if 쪽 == "왼":
        f = min(fs, key=lambda f: f[0])
    elif 쪽 == "오른":
        f = max(fs, key=lambda f: f[0])
    else:
        f = max(fs, key=lambda f: f[2] * f[3])
    return FR.feature(FR.alignCrop(im, f))


닮 = lambda a, b: round(float(FR.match(a, b, cv2.FaceRecognizerSF_FR_COSINE)), 2)


def 결비(p):
    """셀카 한 장의 볼 잔결 태오 ÷ 학생(셀카결.py와 같은 셈 — 원본에서 얼굴 너비 256px, 회색 − 가우스 σ1.5의 표준편차)."""
    원 = cv2.imdecode(np.fromfile(p, np.uint8), 1)
    h, w = 원.shape[:2]
    s = min(1.0, 1200 / max(h, w))
    작 = cv2.resize(원, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA) if s < 1 else 원
    FD.setInputSize((작.shape[1], 작.shape[0])); _, fs = FD.detect(작)
    둘 = sorted(sorted([f for f in fs if f[14] >= 0.7 and f[2] >= 0.06 * 작.shape[1]], key=lambda f: -f[2])[:2], key=lambda f: f[0])
    값 = []
    for f in 둘:
        f = f[:14] / s; 배 = 256.0 / f[2]
        회 = cv2.cvtColor(cv2.resize(원, None, fx=배, fy=배, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32)
        고 = 회 - cv2.GaussianBlur(회, (0, 0), 1.5)
        볼 = [고[int(cy - 18):int(cy + 18), int(cx - 18):int(cx + 18)].std() for cx, cy in (((f[4] * .45 + f[10] * .55) * 배, (f[5] * .45 + f[11] * .55) * 배), ((f[6] * .45 + f[12] * .55) * 배, (f[7] * .45 + f[13] * .55) * 배))]
        값.append(float(np.mean(볼)))
    return round(값[1] / 값[0], 2)
g = lambda pat: (sorted(glob.glob(os.path.join(W, pat))) or [None])[0]
F1 = 하나(os.path.join(W, "photo-nb", "refs", "taeo2-f1.jpg"))

결과 = {
    "머리말": "학생이 사진 한 장을 올리면 이야기(한국 대학 1학년) 속 「제2의 나」를 만드는 길을 시험했다. 올린 사진 → 기준 사진 한 장(빈 학생 식당에서 웃는 모습, 늘 19~20살쯤 · 주름 없이) → 그 한 장만으로 1화 식당 태오 셀카 → 옷 · 머리 · 액세서리는 기준 사진을 편집해 갈아입기. 숫자는 얼굴 닮음(SFace, 1에 가까울수록 같은 얼굴 — 다른 사람끼리 최고 0.47).",
    "결론": [
        "<b>사진 한 장으로 만든 「제2의 나」는 확실히 그 사람으로 남는다.</b> 「강」 기준 사진과 올린 사진의 닮음 — 유호님 0.62(「확실히 내 얼굴」이라 한 승인 시안 B는 0.45), 대역 0.78 · 0.82. 같은 지역 · 성별의 가장 가까운 기존 조각은 0.50 · 0.52라, 조각 고르기의 이질감이 숫자로도 보인다.",
        "<b>세기 기본값은 「강」.</b> 유호님은 대역 · 본인 모두 강을 골랐다. 눈가림 시험관(Sonnet)은 「이 사진 주인이라면」으로 약을 1등, 기존 조각을 꼴찌로 — 기본은 강, 학생이 「더 자연스럽게」로 낮추게 한다. 나이와 상관없이 19~20살 · 주름 없는 피부는 늘 깐다.",
        "<b>셀카도 GPT로 된다(학생 사진 길은 Google 생성형 AI 금지).</b> 같은 지시문의 GPT 셀카 여섯 — 학생 ↔ 기준 0.77~0.89(유호님은 Gemini 0.69~0.73보다 높음). 태오는 Fable 눈가림 줄세우기에서 아니오 없이 예 1 · 아마 5 — 같은 사람 폭이지만 얼굴 살집이 야윔 ↔ 통통으로 흔들린다. 결 비(태오 ÷ 학생 볼 잔결)는 GPT 0.58~0.85로 Gemini(0.81~1.14)보다 태오가 매끈한 쪽이다.",
        "<b>장면 판 편집이 태오 흔들림을 푼다.</b> 태오 · 식판 · 배경이 확정된 판에서 학생 자리만 바꾸면 학생 ↔ 기준 0.78~0.89, 태오 ↔ 판 태오 0.91~0.94 — 성별이 다른 자리도 바뀐다. 태오가 판 그대로라 학생마다 눈 검사를 하지 않고 숫자만으로 출고 검사를 할 수 있다. 결(매끈함)은 판을 구울 때 한 번 맞춘다.",
        "<b>옷장:</b> 머리 둘 · 옷 · 액세서리 열두 장 모두 바꾼 것만 바뀌고 얼굴 · 구도 · 배경이 그대로(기준과 0.73~0.96), 합성 티 없음. 액세서리 · 염색 · 투블럭은 지시문을 고쳐 다시 구운 판에서 한눈에 보이게 됐다. 한 장 86~174초 — 「배송 중」 시간 안에 굽고 검사하는 구조가 맞다.",
        "<b>나이:</b> 36세는 「강+」(열아홉 얼굴 단락)로 21~24세 · 0.85. 40~50대는 강으로 20대 중후반에 머물고 콧수염 · 턱 괸 포즈가 흔들렸는데, 강+로 20대 초중반 · 면도 · 포즈 고정까지 됐다. 45세는 닮음이 「아마」(0.53)로 남아, 나이 차가 큰 학생은 만든 뒤 「이게 나?」 확인과 한 단계 덜 어린 판을 둔다.",
        "<b>「이게 나」는 숫자와 본인 확인으로.</b> AI 시험관(GPT · Haiku)은 지어낸 인물이어도 「같은 사람인가」를 거절한다. 학생 얼굴은 SFace 점수와 학생 본인 눈으로만 보고, AI 눈 검사는 태오 · 장면 판 같은 지어낸 것에만 쓴다.",
        "<b>앱에서는 OpenAI 이미지 API 일괄 처리로, 무료 월 크레딧 안에서(받아 적기가 먼저).</b> 일괄 처리 설계 · 모의는 docs/제2의나_사진아바타_일괄처리_설계_20261103.md — 받기 → 기준 두 판 → 출고 검사 → 원본 · OpenAI 파일 지우기 → 「이게 나?」 → 추억 사진 · 룩, 몫이 모자라면 「배송 지연」.",
    ],
    "사람": [],
    "꼬리말": "그림은 모두 구독 경로(ChatGPT · Gemini, 현금 0). 유호님 사진은 본인 동의, 대역은 모두 지어낸 사람. 재료와 다시 돌리는 법: experiences/drama/qa/제2의나-20261102/사진시험/README.md · 일괄 처리 검사 · 모의 experiences/drama/qa/제2의나-20261102/일괄처리/README.md · 동의 문구 초안 docs/제2의나_사진아바타_동의문구_초안_20261103.md.",
}


def 사람(id, 제목, 설명, 올림, 판들, 셀카들, 옷장, 판정, gpt셀카=()):
    f올림 = 하나(올림)
    f강 = 하나(판들["강"])
    줄 = []
    칸 = [{"이름": "올린 사진", "그림": 올림, "메모": "학생이 보낸 원본"}]
    for lv, p in 판들.items():
        c = {"이름": f"기준 · {lv}", "그림": p, "숫자": {"올린 사진과": 닮(하나(p), f올림)}}
        if lv == "강":
            c.update({"표": "ok", "표글": "유호님 고름"})
        칸.append(c)
    줄.append({"제목": "올린 사진 → 기준 사진(GPT, 보정 약 · 중 · 강)", "칸": 칸})
    sc = []
    for 이름, p, 메모 in 셀카들:
        if not p:
            continue
        학 = 닮(하나(p, "왼"), f강); 태 = 닮(하나(p, "오른"), F1)
        sc.append({"이름": 이름, "그림": p, "숫자": {"학생 ↔ 기준(강)": 학, "태오 ↔ F1": 태}, "메모": 메모,
                   "표": "bad" if "다른 사람" in 메모 else ("warn" if "흔들" in 메모 else "ok"),
                   "표글": "태오 다른 사람" if "다른 사람" in 메모 else ("태오 흔들림" if "흔들" in 메모 else "통과")})
    줄.append({"제목": "셀카(Gemini, 기준 강 한 장 + 태오 승인 넷)", "설명": "학생은 기준과 같은 사람인지, 태오는 미끼를 섞은 줄세우기로 F1과 같은 사람인지(Fable) 본다.", "칸": sc})
    if gpt셀카:
        gc = []
        for 이름, p, 메모, 표 in gpt셀카:
            gc.append({"이름": 이름, "그림": p, "숫자": {"학생 ↔ 기준(강)": 닮(하나(p, "왼"), f강), "태오 ↔ F1": 닮(하나(p, "오른"), F1), "결 비(태오 ÷ 학생)": 결비(p)},
                       "메모": 메모, "표": 표[0], "표글": 표[1]})
        줄.append({"제목": "셀카(GPT 이미지 — 같은 지시문 · 본판 엔진)", "설명": "학생 사진이 닿는 길은 Google 생성형 AI를 못 써서 본판 셀카도 GPT다. 결 비는 한 사진 안 두 얼굴의 볼 잔결 — 1보다 낮을수록 태오가 학생보다 매끈하다.", "칸": gc})
    wd = [{"이름": "기준(강)", "그림": 판들["강"]}]
    for 이름, p, 메모 in 옷장:
        if p:
            wd.append({"이름": 이름, "그림": p, "숫자": {"기준과": 닮(하나(p), f강)}, "메모": 메모})
    줄.append({"제목": "옷장(GPT 편집 — 바꾼 것만 바뀌게)", "칸": wd})
    결과["사람"].append({"제목": 제목, "설명": 설명, "줄": 줄, "판정": 판정})


GP = os.path.join(W, "photo-gpt", "판")
OW = os.path.join(W, "photo-gpt", "옷장판", "판")
# GPT 셀카 태오 — Fable 눈가림 줄세우기(11-03, 미끼 옛 태오 · F2) 판정과 표시
태오말 = {"yuho-kimchi": "태오 F1과 「아마」 — 같은 사람 폭, 얼굴이 야윈 쪽(Fable 줄세우기)", "yuho-fight": "태오 F1과 「아마」 — 같은 사람 폭, 얼굴이 통통한 쪽",
         "u1-kimchi": "태오 F1과 「아마」 — 야윈 쪽", "u1-fight": "태오 F1과 「아마」 — 통통한 쪽", "u2-kimchi": "태오 F1과 「예」 — 여섯 가운데 가장 가까움", "u2-fight": "태오 F1과 「아마」 — 통통한 쪽"}
태오표 = {k: (("ok", "태오 예") if "「예」" in v else ("warn", "태오 흔들림")) for k, v in 태오말.items()}
사람("yuho", "유호님(실제 사진 한 장)", "올린 사진은 고정 얼굴 세트의 셀카 꼴 pro01. 실제 사진끼리 평균 0.52 · 승인 시안 B ↔ 올린 사진 0.45가 「본인으로 인정한 범위」다.",
     os.path.join(D, "ref_pro01_face.png"),
     {"약": g("photo-gpt/판/gpt2-yuho-약_*.png"), "중": g("photo-gpt/판/gpt2-yuho-중_*.png"), "강": g("photo-gpt/판/gpt2-yuho-강_*.png")},
     [("김치", g("photo-nb/out/sf-yuho-kimchi-nb_g1.png"), "태오가 조금 아이돌화해 흔들림(Fable P2)"),
      ("김치 · 다시", g("photo-nb2/out/sf-yuho-kimchi-nb_g2.png") or g("photo-nb/out/sf-yuho-kimchi-nb_g2.png"), "태오 줄을 F1 특징으로 고친 판 — 태오 F1로 돌아옴(Fable 줄세우기 5/5)"),
      ("파이팅", g("photo-nb/out/sf-yuho-fight-nb_g1.png"), "학생 · 태오 모두 같은 사람")],
     [("쉼표머리", g("photo-gpt/옷장판/판/wd-yuho-hair1_*.png"), ""), ("애쉬 브라운", g("photo-gpt/옷장판/판/wd-yuho-hair2_*.png"), "색이 약하게만 바뀜(P3)"),
      ("애쉬 브라운 · 다시", g("photo-gpt/옷장판/판/wd2-yuho-hair2_*.png"), "「밝게, 햇빛에 분명히」로 고친 판 — 한눈에 보임(Fable)"),
      ("데님 재킷", g("photo-gpt/옷장판/판/wd-yuho-outfit_*.png"), ""), ("은테 안경", g("photo-gpt/옷장판/판/wd-yuho-acc_*.png"), "")],
     "유호님 판정: 기준은 「강」(11-03). 셀카 속 학생은 기준과 0.72 안팎 — 실제 사람은 숫자가 낮게 나와(실제 사진끼리 0.52) 지어낸 조각으로 정한 0.84 관문을 그대로 쓰지 않고 그 사람 기준으로 다시 맞춘다. GPT 셀카는 0.77 · 0.84로 Gemini(0.69~0.73)보다 기준에 더 붙는다.",
     gpt셀카=[("GPT 김치", g("photo-gpt/셀카판/판/gsf-yuho-kimchi_*_1.png"), 태오말["yuho-kimchi"], 태오표["yuho-kimchi"]),
             ("GPT 파이팅", g("photo-gpt/셀카판/판/gsf-yuho-fight_*.png"), 태오말["yuho-fight"], 태오표["yuho-fight"])])
사람("u1", "대역 · 몽골 여학생(지어낸 사람, 기숙사 저녁 셀카)", "가장 가까운 기존 조각(mn-f2)과 올린 사진은 0.50 — 조각 고르기로는 이만큼만 「나」에 닿는다.",
     os.path.join(W, "photo-gpt", "u1-up.jpg"),
     {"약": g("photo-gpt/판/gpt2-u1-약_*.png"), "중": g("photo-gpt/판/gpt2-u1-중_*.png"), "강": g("photo-gpt/판/gpt2-u1-강_*.png")},
     [("김치", g("photo-nb/out/sf-u1-kimchi-nb_g1.png"), "V가 턱 옆(P3)"), ("파이팅", g("photo-nb2/out/sf-u1-fight-nb_g1.png"), "통과")],
     [("레이어드 단발", g("photo-gpt/옷장판/판/wd-u1-hair1_*.png"), ""), ("하이 포니테일", g("photo-gpt/옷장판/판/wd-u1-hair2_*.png"), ""),
      ("셔츠 + 니트 조끼", g("photo-gpt/옷장판/판/wd-u1-outfit_*.png"), ""), ("목걸이 · 귀걸이", g("photo-gpt/옷장판/판/wd-u1-acc_*.png"), "바뀐 게 잘 안 보임(P2)"),
      ("목걸이 · 귀걸이 · 다시", g("photo-gpt/옷장판/판/wd2-u1-acc_*.png"), "「보이게」로 고친 판 — 목걸이 · 귀걸이가 보임(Fable)")],
     "눈가림 시험관(Sonnet): 약 > 중 > 강 > 기존 조각 — 「강은 가장 예쁘지만 내가 아닌 듯」. 유호님: 강이 가장 좋음.",
     gpt셀카=[("GPT 김치", g("photo-gpt/셀카판/판/gsf-u1-kimchi_*_1.png"), 태오말["u1-kimchi"], 태오표["u1-kimchi"]),
             ("GPT 파이팅", g("photo-gpt/셀카판/판/gsf-u1-fight_*.png"), 태오말["u1-fight"], 태오표["u1-fight"])])
사람("u2", "대역 · 베트남 남학생(지어낸 사람, 도서관 형광등 셀카)", "가장 가까운 기존 조각(vn-m)과 올린 사진은 0.52.",
     os.path.join(W, "photo-nb2", "refs", "u2-up.jpg"),
     {"약": g("photo-gpt/판/gpt2-u2-약_*.png"), "중": g("photo-gpt/판/gpt2-u2-중_*.png"), "강": g("photo-gpt/판/gpt2-u2-강_*.png")},
     [("김치", g("photo-nb2/out/sf-u2-kimchi-nb_g1.png"), "태오가 다른 사람(Fable P1) — 숫자는 0.73으로 못 거름"),
      ("김치 · 다시", g("photo-nb2/out/sf-u2-kimchi-nb_g2.png"), "태오 줄을 F1 특징으로 고친 판 — 태오 F1로 돌아옴 · 활짝 웃음 · 구도 수평(Fable)"),
      ("파이팅", g("photo-nb2/out/sf-u2-fight-nb_g1.png"), "통과")],
     [("다운펌 투블럭", g("photo-gpt/옷장판/판/wd-u2-hair1_*.png"), "옆머리 민 투블럭이 아님(P3)"), ("다운펌 · 다시", g("photo-gpt/옷장판/판/wd2-u2-hair1_*.png"), "「옆머리 짧게」로 고친 판 — 투블럭으로 읽힘(Fable)"),
      ("밝은 갈색 쉼표머리", g("photo-gpt/옷장판/판/wd-u2-hair2_*.png"), ""), ("카키 항공점퍼", g("photo-gpt/옷장판/판/wd-u2-outfit_*.png"), ""),
      ("로고 없는 볼캡", g("photo-gpt/옷장판/판/wd-u2-acc_*.png"), "")],
     "눈가림 시험관(Sonnet): 약 > 중 > 강 > 기존 조각. 유호님: 강이 가장 좋음.",
     gpt셀카=[("GPT 김치", g("photo-gpt/셀카판/판/gsf-u2-kimchi_*.png"), 태오말["u2-kimchi"], 태오표["u2-kimchi"]),
             ("GPT 파이팅", g("photo-gpt/셀카판/판/gsf-u2-fight_*_1.png"), 태오말["u2-fight"], 태오표["u2-fight"])])

나이 = {"제목": "나이 맞추기 — 30 · 40 · 50대가 올려도 19~20살로", "설명": "지어낸 36세 · 45세 · 52세의 평범한 셀카. 「강+」는 30대 이상으로 읽히는 올림에 「열아홉 얼굴」 단락(볼 · 턱선 · 머리선 · 기본 면도)을 더한 판(Fable 고침).", "줄": []}
강플나이 = {"a36": "≈ 21~24", "a45": "≈ 20~24, 닮음 「아마」", "a52": "≈ 22~27"}
보이는나이 = {"a36": ("≈ 28~32", "≈ 22~27"), "a45": ("≈ 35~40", "≈ 26~30"), "a52": ("≈ 30~35", "≈ 25~30")}
for a, 이름 in [("a36", "36세 베트남 여"), ("a45", "45세 우즈베크 남"), ("a52", "52세 몽골 여")]:
    up = g(f"photo-gpt/나이판/판/up-{a}_*.png"); fu = 하나(up)
    칸 = [{"이름": f"올린 사진 · {이름}", "그림": up}]
    for lv, pat, 메모 in [("약", f"base-{a}-약_*.png", f"보이는 나이 {보이는나이[a][0]}(Fable)"), ("강", f"base-{a}-강_*.png", f"보이는 나이 {보이는나이[a][1]}(Fable)"), ("강+", f"base-{a}-강플_*.png", f"보이는 나이 {강플나이[a]}(Fable) — 콧수염 · 포즈 고침")]:
        p = g(f"photo-gpt/나이판/판/{pat}")
        if p:
            칸.append({"이름": lv, "그림": p, "숫자": {"올린 사진과": 닮(하나(p), fu)}, "메모": 메모})
    나이["줄"].append({"제목": 이름, "칸": 칸})
결과["사람"].append(나이)

# 장면 판 편집(11-03) — 태오 · 식판 · 배경이 확정된 판에서 학생 자리만 다른 학생의 기준으로. 태오는 판의 태오와 견준다.
판편집 = {"제목": "장면 판 편집 — 태오가 판 그대로 남나", "설명": "일괄 처리에서는 학생마다 태오 눈 검사를 할 수 없다. 김치 판 둘(여 · 남 대역 자리)에서 학생 자리만 바꿔 구웠다(GPT 이미지 2.5, 참고 = 판 + 학생 기준 두 장).", "줄": []}
for 판이름, 판p, 짝들 in [("여 대역 판(u1 자리)", g("photo-gpt/셀카판/판/gsf-u1-kimchi_*_1.png"), [("→ 유호님", "yuho"), ("→ u2(남)", "u2")]),
                       ("남 대역 판(u2 자리)", g("photo-gpt/셀카판/판/gsf-u2-kimchi_*.png"), [("→ u1(여)", "u1"), ("→ 유호님", "yuho")])]:
    f판태오 = 하나(판p, "오른")
    칸 = [{"이름": 판이름, "그림": 판p, "메모": "태오 · 식판 · 창은 이 판 그대로 남아야 한다"}]
    for 이름, who in 짝들:
        p = g(f"photo-gpt/판편집판/판/pe-{'u1' if 판이름.startswith('여') else 'u2'}-to-{who}_*.png")
        fb = 하나(g(f"photo-gpt/판/gpt2-{who}-강_*.png"))
        칸.append({"이름": 이름, "그림": p, "숫자": {"학생 ↔ 기준(강)": 닮(하나(p, "왼"), fb), "태오 ↔ 판 태오": 닮(하나(p, "오른"), f판태오), "결 비(태오 ÷ 학생)": 결비(p)},
                  "표": "ok", "표글": "통과"})
    판편집["줄"].append({"제목": 판이름, "칸": 칸})
결과["사람"].append(판편집)
json.dump(결과, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok", sum(len(z["칸"]) for p in 결과["사람"] for z in p["줄"]), "칸")

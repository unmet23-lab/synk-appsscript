#!/usr/bin/env python3
# 사이트 구역 그림을 만든다(2026-11-09). 나가는 곳은 SYNK-website site-v10/assets/learner/(공개 주소 /assets/v10/learner/).
#  ① 사진 두 연작: 홈 · 아틀라스의 창가 다섯 장(window-*)과 LAB의 교실 창가 넉 장(class-*). 구운 원본(GPT 이미지 2.6 구독,
#     지시문은 창가사진_지시문.md)을 연작의 첫 판에 맞춰 옮겨(칸이 바뀔 때 창틀 · 칠판 · 책상이 떨지 않게) webp로.
#  ② 실제 화면 부품: 장면 캡처(experiences/synk-world-app/qa/site-learner-scene.mjs 출력 — 한국어 --폭 390, 영어 --폭 430)에서 물음에 답하는 자리만 언어마다 webp로.
#     다시 확인은 그 항목 카드만(위 설명문은 뺀다) — 11-09 맹검 「위젯처럼 보인다」.
#     조각 속 앱의 단추 · 링크 줄은 잘라 낸다(11-10): 튜터 카드의 흰 단추, 다시 확인의 「다음 레슨에서 확인하기」, 근거의 「이 항목 연습하기」.
#     사이트에서 누를 곳은 사이트 단추 하나다 — 조각 속 흰 알약과 사이트 단추가 한 화면에 둘이면 어디를 누를지 갈린다(맹검 K36 · C018, 세 회차 연속).
#     돌아올 표현은 앞 두 줄(1분 뒤 · 내일)만 — 셋째 줄이 둘째 줄과 시각까지 같아 「대충 채운 목록」으로 읽혔다(11-10 맹검 C024).
#  (11-10까지 ③ LAB 문제 카드의 펠트 그림도 만들었다 — 흰 바탕째 붙은 그림이 맹검 네 회차 연속 「스티커」(C023)라 카드에서 뺐다.)
# 쓰기: python -I -X utf8 그림.py <구운 사진 폴더 | - (사진은 건너뜀)> <캡처 폴더(ko · en이 든)> <나갈 폴더> [조각 이름…]
#   조각 이름(예: piece-game)을 주면 그 조각만 쓴다 — 게임 화면만 바뀌었을 때 튜터 카드 조건(「최근 놓친」이 나온 날)에 걸리지 않는다(11-13).
import os, sys
import numpy as np
import cv2
from PIL import Image, ImageDraw

사진폴더, 캡처뿌리, 나갈 = sys.argv[1], sys.argv[2], sys.argv[3]
고를조각 = set(sys.argv[4:])  # 비면 모두
os.makedirs(나갈, exist_ok=True)

# ── ① 사진 ──
여백 = 8  # 옮긴 뒤 가장자리에 빈 칸이 보이지 않게 네 변을 조금 자른다
def 읽기(p):  # cv2.imread는 윈도우에서 한글 경로를 못 읽는다(사진 원본이 SYNK-보관함/연구 아래에 있다)
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
def 연작(접두, 장면, 가림칠, 움직임=cv2.MOTION_AFFINE):
    기준 = 읽기(os.path.join(사진폴더, 장면[0][1] + '.png'))
    H, W = 기준.shape[:2]
    가림 = np.zeros((H, W), np.uint8)
    가림칠(가림, W, H)  # 움직이지 않는 실내(벽 · 틀 · 책상 가장자리)로만 맞춘다
    g0 = cv2.GaussianBlur(cv2.cvtColor(기준, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 2)
    for 이름, 원본 in 장면:
        im = 읽기(os.path.join(사진폴더, 원본 + '.png'))
        if im.shape[:2] != (H, W):
            im = cv2.resize(im, (W, H), interpolation=cv2.INTER_AREA)
        if 원본 != 장면[0][1]:
            g = cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 2)
            w = np.eye(2, 3, dtype=np.float32)
            cc, w = cv2.findTransformECC(g0, g, w, 움직임, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-5), 가림, 5)
            im = cv2.warpAffine(im, w, (W, H), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
            print(f'{접두}-{이름} 맞춤 {cc:.3f} 옮김 {w[0, 2]:.1f} {w[1, 2]:.1f}')
        im = im[여백:H - 여백, 여백:W - 여백]
        pil = Image.fromarray(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
        p = os.path.join(나갈, f'{접두}-{이름}.webp')
        pil.resize((1664, round(pil.height * 1664 / pil.width)), Image.LANCZOS).save(p, 'WEBP', quality=80, method=6)
        print(os.path.basename(p), os.path.getsize(p) // 1024, 'KB')

def 창가가림(m, W, H):  # 창틀 위 · 책상 위 물건 · 창틀 왼쪽 기둥 · 창 아래 턱
    m[0:40, 640:W] = 255; m[640:H, 560:1300] = 255; m[0:760, 640:700] = 255; m[690:760, 700:W] = 255
def 교실가림(m, W, H):  # 칠판 틀 · 창틀 · 턱 · 벽 · 책상 먼 가장자리 왼쪽(유리 안 풍경 · 칠판 안 분필 글 · 책상 위 물건은 날마다 다르다)
    m[0:700, :] = 255; m[760:815, 0:480] = 255
    m[50:618, 1027:1335] = 0; m[50:618, 1362:1612] = 0; m[75:652, 5:930] = 0
# 창가 연작은 옮기기만 한다. 원본 구도가 2~3px 안으로 같은데, 방 전체 빛을 바꾼 판에서는 아핀 맞춤이 빛에 속아 사진을 비튼다(11-09 오후 판: 창틀 안쪽 호박빛 때문에 세로선 38px 기울임, 비 판: 세로 배율 16px)
if 사진폴더 != '-':
    연작('window', [('evening', 'a1'), ('morning', 'w-morning'), ('golden', 'w-golden'), ('rain', 'w-rain'), ('snow', 'w-snow')], 창가가림, cv2.MOTION_TRANSLATION)
    연작('class', [('now', 'e1'), ('morning', 'e-morning'), ('rain', 'e-rain'), ('snow', 'e-snow')], 교실가림)

# ── ② 실제 화면 부품 ──
def 둥글게(im, r):
    m = Image.new('L', (im.width * 4, im.height * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, m.width - 1, m.height - 1), r * 4, fill=255)
    m = m.resize(im.size, Image.LANCZOS); im = im.convert('RGBA'); im.putalpha(m)
    return im
def 단추자리(im):
    # 튜터 카드의 흰 단추가 차지하는 줄(위 · 아래). 11-09까지는 홈이 스크립트로 준 초점의 고리(2px + 3px 틈)가
    # 단추 둘레에 함께 찍혀 「바깥 고리 · 채움 · 바깥 고리」 세 덩어리였다 — 앱이 키보드를 쓰기 전에는 그 고리를 그리지 않게 고친 뒤로는 한 덩어리다.
    a = np.array(im.convert('RGB')).astype(int); h, w, _ = a.shape
    bright = (a[:, int(w * .15):int(w * .85)].min(axis=2) > 200).mean(axis=1)
    rows = np.where(bright > .55)[0]
    blocks = np.split(rows, np.where(np.diff(rows) > 3)[0] + 1)
    단추 = max(blocks, key=len)
    assert len(단추) > 60, '튜터 카드 단추를 못 찾음'
    assert len(blocks) == 1, f'단추 둘레에 고리가 또 찍혔다(덩어리 {len(blocks)}) — 초점 고리가 보이는 판이다'
    return int(단추[0]), int(단추[-1])
def 덩어리(im, 틈=20, 가=40):
    # 바탕과 다른 화소가 있는 줄을 이어 글 · 그림 덩어리로 묶는다(줄 사이 틈 20px(@2x) 안은 한 덩어리 — 한 문단 · 한 근거 줄).
    # 가장자리 40px은 보지 않는다(둥근 모서리 밖 쪽 바탕 · 카드 옆 테두리).
    a = np.array(im.convert('RGB')).astype(int); h, w, _ = a.shape
    bg = np.median(a[:, w // 2].reshape(-1, 3), axis=0)
    줄 = np.where((np.abs(a[:, 가:w - 가] - bg).sum(axis=2) > 60).any(axis=1))[0]
    줄 = 줄[줄 > 3]  # 맨 위 테두리 1px(@2x 2줄)는 덩어리가 아니다
    if not len(줄): return []
    묶음 = np.split(줄, np.where(np.diff(줄) > 틈)[0] + 1)
    return [(int(b[0]), int(b[-1])) for b in 묶음]
def 아래로자름(im, 끝, 여백):
    # 끝 줄 아래 여백만 남기고 자른다 — 여백은 조각 위쪽 여백과 같게(카드가 한 장으로 끝나 보이게)
    return im.crop((0, 0, im.width, min(im.height, 끝 + 여백)))
def 아래줄지움(im, 몇=46):
    # 조각 맨 아래에 걸린 구분선(카드 밑 테두리 · 목록 줄)을 바탕색으로 지운다 — 가로로 고르게 이어진 줄만(글자 · 밑줄 링크는 고르지 않다).
    # 둥근 틀 안에서 바닥에 곧은 줄이 비치면 캡처를 오린 자국으로 보인다(11-09 마감 점검).
    a = np.array(im.convert('RGB')); h = a.shape[0]
    bg = np.median(a[h - 30:, 20:-20].reshape(-1, 3), axis=0)
    for r in range(max(0, h - 몇), h):
        row = a[r, 40:-40].astype(int)
        if np.abs(row - bg).mean() > 3 and row.std(axis=0).mean() < 6:
            a[r, :] = bg
    return Image.fromarray(a)
def 위줄지움(im, 몇=46):
    a = np.array(im.convert('RGB'))
    bg = np.median(a[:30, 20:-20].reshape(-1, 3), axis=0)
    for r in range(0, min(몇, a.shape[0])):
        row = a[r, 40:-40].astype(int)
        if np.abs(row - bg).mean() > 3 and row.std(axis=0).mean() < 6:
            a[r, :] = bg
    return Image.fromarray(a)
def 찾기(전체, 조각):
    a = cv2.cvtColor(np.array(전체.convert('RGB')), cv2.COLOR_RGB2GRAY); b = cv2.cvtColor(np.array(조각.convert('RGB')), cv2.COLOR_RGB2GRAY)
    r = cv2.matchTemplate(a, b, cv2.TM_CCOEFF_NORMED); _, v, _, at = cv2.minMaxLoc(r)
    assert v > .98, f'조각 자리를 못 찾음 {v:.3f}'
    return at
for 언어 in ('ko', 'en'):
    캡처 = os.path.join(캡처뿌리, 언어)
    폴더 = os.path.join(나갈, 언어)
    if not os.path.isdir(캡처):
        print(언어, '캡처 없음'); continue
    os.makedirs(폴더, exist_ok=True)
    열기 = lambda n: Image.open(os.path.join(캡처, n + '.png')).convert('RGB')
    쓰기 = lambda 이름, im: None if 고를조각 and 이름 not in 고를조각 else (im.save(os.path.join(폴더, 이름 + '.webp'), 'WEBP', quality=88, method=6), print(언어, 이름, im.size, os.path.getsize(os.path.join(폴더, 이름 + '.webp')) // 1024, 'KB'))
    # 튜터 카드 — 단추 아래 34px(@2x)에서 자른다. 사이트 카드에는 「최근 놓친 …」 이유가 나온 날을 쓴다 — 환승 러시 결과는 판마다 달라 그 문장이
    # 나오는 날도 판마다 다르다(11-09: 8일째가 「다시 살펴볼 때」인 판이 있었다). 8일째를 먼저 본다 — 둘째 날은 추천도 「듣기 짧은 연습 · 듣고 세부 정보 찾기」라
    # 카드 위아래 줄에 같은 말이 겹쳤다(11-09 맹검). 8일째는 「바람길 · 짧은 지시 듣기」 + 놓친 항목이라 겹치지 않는다.
    찾을글 = {'ko': '최근 놓친', 'en': 'since you missed'}[언어]
    놓친날 = next((n for n in ('30-day8-home', '20-day2-home', '40-day31-home') if 찾을글 in open(os.path.join(캡처, n + '.txt'), encoding='utf-8').read()), None)
    튜터 = not 고를조각 or bool(고를조각 & {'piece-tutor', 'piece-tutor-review'})
    assert 놓친날 or not 튜터, f'{언어}: 「{찾을글}」 이유가 나온 날이 없다 — 장면을 다시 돌린다'
    if 튜터: print(언어, 'piece-tutor 원본', 놓친날)
    # 튜터 카드는 이유 문장까지 — 흰 단추 줄부터 잘라 내고, 아래 여백은 카드 위 여백(테두리에서 첫 글 · 얼굴까지)과 같게
    for 이름, 원본 in ((('piece-tutor', 놓친날 + '.crop'), ('piece-tutor-review', '63-day2-home-review.crop')) if 튜터 else ()):
        im = 열기(원본); 단추위, _ = 단추자리(im)
        글 = [b for b in 덩어리(im.crop((0, 0, im.width, 단추위 - 2)))]
        assert len(글) >= 2, f'{이름}: 단추 위 글 덩어리를 못 찾음'
        쓰기(이름, 둥글게(아래로자름(im, 글[-1][1], 글[0][0]), 58))
    # 같은 표현, 다른 장면 · 게임 — 자리를 재서 찍은 띠 그대로(영어는 430 폭으로 찍어 튜터 줄이 말줄임 없이 다 보인다)
    쓰기('piece-scene', 열기('05-review-new-scene.band'))
    # 게임 — 고를 차례에 아래에서 올라오는 길 안내 표지판(11-12 「B 표지판」)만. 띠 위쪽 객실 사진은 승객이 허리 아래로만 잘려 들어와
    # (사이트 맹검 「잘린 승객」) 판 바탕색이 한 줄을 다 채우는 첫 줄부터 자른다 — 질문 한 줄 · 세 칸 · 꼬리표가 남는다
    band = 열기('13-game-pick.band'); a = np.array(band).astype(int)
    판 = (np.abs(a - a[-10, 6]).max(axis=2) < 7).mean(axis=1)
    위 = next((y for y in range(len(판)) if 판[y] > .95), None)
    assert 위 is not None and 위 < len(판) * .8, f'{언어}: 게임 표지판 판의 위 끝을 못 찾음'
    쓰기('piece-game', band.crop((0, 위, band.width, band.height)))
    # 돌아올 표현 — 머리 + 앞 두 줄(틀린 말 1분 뒤 · 맞힌 말 내일). 줄마다 산호색 때 글이 끝이다
    band = 열기('04-review-summary.band'); a = np.array(band).astype(int)
    산호 = np.where(((a[:, :, 0] > 200) & (a[:, :, 1] > 110) & (a[:, :, 1] < 200) & (a[:, :, 2] > 90) & (a[:, :, 2] < 190) & (a[:, :, 0] - a[:, :, 2] > 50)).sum(axis=1) > 3)[0]
    산호 = np.split(산호, np.where(np.diff(산호) > 20)[0] + 1)
    assert len(산호) >= 2, '돌아올 표현의 때 글을 못 찾음'
    쓰기('piece-back', 아래줄지움(아래로자름(band, int(산호[1][-1]), 34)))
    # 다시 확인 — 그 항목 카드만(위 「시간을 두고 다시 확인」 제목 · 설명은 뺀다). 띠에서 카드 자리를 찾아 위 30px 여백부터.
    for 이름, 띠, 카드 in (('piece-check-d7', '30-day8-followups-open.band', '30-day8-card-open.crop'), ('piece-check-d30', '40-day31-followups-open.band', '40-day31-card-open.crop')):
        band = 열기(띠); x, y = 찾기(band, 열기(카드))
        위 = max(0, y - 30)
        band = band.crop((44, 위, band.width - 44, band.height))
        # 카드 맨 위 테두리(앞 설명과 나누던 구분선)와 맨 아래 테두리는 바탕색으로 지운다
        band = 아래줄지움(위줄지움(band))
        # 카드 위 여백에 걸린 앞 설명 글자의 꼬리(470 폭 영어에서 1~2줄)도 비운다
        여백 = y - 위  # 잘라 낸 띠에서 카드가 시작하는 줄
        if 여백 > 2:
            a = np.array(band); a[:여백 - 2] = np.median(a[여백:여백 + 20, 20:-20].reshape(-1, 3), axis=0); band = Image.fromarray(a)
        # 맨 아래 덩어리는 「다음 레슨에서 확인하기」 링크다 — 그 위(때 · 상태 줄)까지 남긴다
        글 = 덩어리(band)
        assert len(글) >= 3 and 글[-1][1] - 글[-1][0] < 90 and 글[-1][0] > band.height * .55, f'{이름}: 맨 아래 링크 줄을 못 찾음 {글}'
        # 위 · 아래 여백을 같게: 상태 줄과 링크 사이 틈보다 넓으면 링크 머리가 비친다 — 그 틈 안에서 맞추고 위도 같은 만큼만 남긴다
        여 = min(글[0][0], 글[-1][0] - 글[-2][1] - 10)
        band = band.crop((0, 글[0][0] - 여, band.width, 글[-2][1] + 여))
        쓰기(이름, 둥글게(band, 32))
    # 근거 줄: 부품 조각의 자리를 찾아 양옆 여백까지. 「맞음」 근거 줄(초록 점)까지만 — 아래 「세지 않은 답」 설명과 「이 항목 연습하기」 링크는 뺀다
    전체 = 열기('17-evidence-ko.reading.vocabulary'); 조각 = 열기('17-evidence-ko.reading.vocabulary.crop')
    x, y = 찾기(전체, 조각)
    # 그 줄의 위 · 아래 구분선(목록 테두리)은 지운다
    ev = 위줄지움(전체.crop((0, max(0, y - 6), 전체.width, min(전체.height, y + 조각.height + 12))))
    a = np.array(ev).astype(int)
    초록 = np.where(((a[:, :120, 1] > 150) & (a[:, :120, 0] < 150) & (a[:, :120, 2] < 130) & (a[:, :120, 1] - a[:, :120, 0] > 40)).sum(axis=1) > 2)[0]
    assert len(초록), '근거 줄의 초록 점을 못 찾음'
    끝 = next(b for b in 덩어리(ev) if b[0] <= 초록[-1] <= b[1])[1]
    쓰기('piece-evidence', 아래줄지움(아래로자름(ev, 끝, 34)))

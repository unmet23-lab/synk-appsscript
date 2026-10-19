"""라디오 장면의 얼굴 조각을 만든다 — 장면째 구운 세 친구의 깜빡임·눈웃음·렌즈 반짝 (2026-10-19).

장면 한 장(GPT 이미지 2.5)과, 같은 장면을 「까몽 눈만 바꿔」 다시 구운 표정 판에서 **까몽 두 눈 둘레만** 떼어
장면과 같은 좌표의 투명 조각으로 낸다. 몸·배경은 장면 픽셀 그대로다(09-19 방송 깜빡임과 같은 방식 —
docs/라디오/눈깜빡임_정지마당_20260919/노을눈자산.py). 표정 판은 다시 구운 그림이라 몇 픽셀 어긋날 수 있어
까몽 머리로 자리·배율을 맞춘 뒤 눈 타원만 옮겨 붙이고, 둘레 털의 밝기를 장면에 맞춘다.
마린 렌즈 반짝은 굽지 않는다 — 장면의 노란 렌즈 픽셀만 조금 밝힌 조각이다.

  python -X utf8 docs/라디오/DJ장면_20261019/얼굴조각.py [결…]

입력은 같은 폴더의 장면표.json, 출력은 docs/Loom_자산/라디오장면/<결>/(장면.webp · 조각 webp · 판.json)과
구운판/확인/<결>_조각확인.jpg(2배 확대 비교 · git 밖).
"""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

여기 = Path(__file__).resolve().parent
뿌리 = 여기.parents[2]
자산뿌리 = 뿌리 / 'docs/Loom_자산/라디오장면'
확인 = 여기 / '구운판/확인'


def 읽기(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.float32)


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def 상대(p):
    return Path(p).resolve().relative_to(뿌리).as_posix()


def 덩어리(mask, 몇):
    """mask 안 연결 덩어리 중 큰 것 몇 개의 (중심x, 중심y, 반폭, 반높이) — 큰 것부터."""
    라벨, n = ndimage.label(mask)
    if n < 몇:
        raise SystemExit(f'눈을 {몇}개 못 찾았다(덩어리 {n})')
    크기 = ndimage.sum(np.ones_like(mask, dtype=np.float32), 라벨, range(1, n + 1))
    고른 = np.argsort(크기)[::-1][:몇] + 1
    결과 = []
    for k in 고른:
        ys, xs = np.nonzero(라벨 == k)
        결과.append(((xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2, (xs.max() - xs.min() + 1) / 2, (ys.max() - ys.min() + 1) / 2))
    return sorted(결과)  # 왼쪽 눈부터


def 까몽눈(장면, 상자):
    x0, y0, x1, y1 = 상자
    hsv = cv2.cvtColor(장면[y0:y1, x0:x1].astype(np.uint8), cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    # 연두 구슬 눈(OpenCV 색상 0~180). 밤 장면은 홍채 아래쪽이 누렇게 어두워져 22까지 받는다(10-19 네온 물가 실측)
    초록 = (h >= 22) & (h <= 60) & (s >= 45) & (v >= 60)
    초록 = ndimage.binary_closing(초록, iterations=3)
    초록 = ndimage.binary_fill_holes(초록)                          # 검은 눈동자·반짝 점까지 한 덩어리로
    초록 = ndimage.binary_opening(초록, iterations=1)
    return [(cx + x0, cy + y0, rx, ry) for cx, cy, rx, ry in 덩어리(초록, 2)]


def 마린렌즈(장면, 상자):
    x0, y0, x1, y1 = 상자
    hsv = cv2.cvtColor(장면[y0:y1, x0:x1].astype(np.uint8), cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    노랑 = (h >= 14) & (h <= 34) & (s >= 110) & (v >= 120)
    노랑 = ndimage.binary_opening(ndimage.binary_closing(노랑, iterations=2), iterations=1)
    # 상자 안의 다른 노란 것(데이지 가운데·감·전축 불빛·물에 비친 렌즈)은 빼고 가장 큰 두 덩어리(두 렌즈)만 남긴다
    라벨, n = ndimage.label(노랑)
    크기 = ndimage.sum(np.ones_like(노랑, dtype=np.float32), 라벨, range(1, n + 1))
    두렌즈 = np.isin(라벨, np.argsort(크기)[::-1][:2] + 1)
    전체 = np.zeros(장면.shape[:2], bool)
    전체[y0:y1, x0:x1] = 두렌즈
    눈 = [(cx + x0, cy + y0, rx, ry) for cx, cy, rx, ry in 덩어리(노랑, 2)]
    return 눈, 전체


def 맞추기(장면, 판, 상자):
    """까몽 머리 상자를 표정 판에서 찾는다 — (배율, 판의 상자 왼쪽 위 x, y)."""
    x0, y0, x1, y1 = 상자
    회장면 = cv2.cvtColor(장면.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    회판 = cv2.cvtColor(판.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    본 = 회장면[y0:y1, x0:x1]
    여유 = 48
    가장 = None
    for 배 in np.arange(0.97, 1.0301, 0.005):
        틀 = cv2.resize(본, None, fx=배, fy=배, interpolation=cv2.INTER_AREA)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        wx0 = int(max(0, cx - 틀.shape[1] / 2 - 여유)); wy0 = int(max(0, cy - 틀.shape[0] / 2 - 여유))
        wx1 = int(min(회판.shape[1], cx + 틀.shape[1] / 2 + 여유)); wy1 = int(min(회판.shape[0], cy + 틀.shape[0] / 2 + 여유))
        창 = 회판[wy0:wy1, wx0:wx1]
        if 창.shape[0] < 틀.shape[0] or 창.shape[1] < 틀.shape[1]:
            continue
        r = cv2.matchTemplate(창, 틀, cv2.TM_CCOEFF_NORMED)
        _, 최고, _, 자리 = cv2.minMaxLoc(r)
        if 가장 is None or 최고 > 가장[0]:
            가장 = (최고, float(배), wx0 + 자리[0], wy0 + 자리[1])
    return 가장


def 눈조각(장면, 판, 눈들, 상자, 맞춤, 넓힘):
    """표정 판의 두 눈 둘레를 장면 좌표로 옮긴 그림과 알파."""
    점수, 배, mx, my = 맞춤
    x0, y0 = 상자[0], 상자[1]
    H, W = 장면.shape[:2]
    yy, xx = np.mgrid[:H, :W].astype(np.float32)
    옮김 = cv2.remap(판, (mx + (xx - x0) * 배).astype(np.float32), (my + (yy - y0) * 배).astype(np.float32),
                    cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT_101)
    알파 = np.zeros((H, W), np.float32)
    결과 = 장면.copy()
    for cx, cy, rx, ry in 눈들:
        rx2, ry2 = rx * 넓힘, ry * 넓힘
        d = np.sqrt(((xx - cx) / rx2) ** 2 + ((yy - cy) / ry2) ** 2)
        a = np.clip((1.0 - d) / 0.28, 0, 1)
        고리 = (d > 1.15) & (d < 1.7)                                # 눈 둘레 털 — 밝기 맞추기
        차이 = np.clip(np.median(장면[고리], 0) - np.median(옮김[고리], 0), -22, 22)
        조각 = np.clip(옮김 + 차이, 0, 255)
        결과 = 결과 * (1 - a[..., None]) + 조각 * a[..., None]
        알파 = np.maximum(알파, a)
    return 결과, 알파


def 렌즈조각(장면, 노랑):
    부드럽게 = cv2.GaussianBlur(ndimage.binary_dilation(노랑, iterations=1).astype(np.float32), (0, 0), 1.2)
    밝게 = np.clip(장면 * 1.08 + np.array([12, 10, 2], np.float32), 0, 255)
    return 밝게, np.clip(부드럽게, 0, 1)


def 조각저장(그림, 알파, 파일):
    ys, xs = np.nonzero(알파 > 1 / 255)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rgba = np.dstack([np.rint(그림[y0:y1, x0:x1]), np.rint(알파[y0:y1, x0:x1] * 255)]).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(파일, 'WEBP', lossless=True)
    return [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]


def 확인시트(장면, 판들, 상자, 낼):
    x0, y0, x1, y1 = 상자
    칸 = [Image.fromarray(np.rint(장면[y0:y1, x0:x1]).astype(np.uint8))]
    칸 += [Image.fromarray(np.rint(p[y0:y1, x0:x1]).astype(np.uint8)) for p in 판들]
    칸 = [c.resize((c.width * 2, c.height * 2), Image.Resampling.LANCZOS) for c in 칸]
    시트 = Image.new('RGB', (sum(c.width for c in 칸) + 8 * (len(칸) - 1), 칸[0].height), (20, 18, 16))
    x = 0
    for c in 칸:
        시트.paste(c, (x, 0)); x += c.width + 8
    시트.save(낼, quality=90)


def 한결(결, 항목):
    장면경로 = 여기 / 항목['장면']
    장면 = 읽기(장면경로)
    H, W = 장면.shape[:2]
    폴더 = 자산뿌리 / 결
    폴더.mkdir(parents=True, exist_ok=True)
    Image.fromarray(장면.astype(np.uint8)).save(폴더 / '장면.webp', 'WEBP', quality=90, method=6)
    눈들 = 까몽눈(장면, 항목['까몽머리'])
    print(결, '까몽 눈', [(round(cx), round(cy), round(rx), round(ry)) for cx, cy, rx, ry in 눈들])
    판 = {
        '결': 결, '이름': 항목['이름'], '만든때': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        '장면': {'파일': '장면.webp', '크기': [W, H], '원본': 상대(장면경로), '원본sha256': sha(장면경로),
               '지시문': 상대(여기 / 항목['지시문'])},
        '조각': {},
    }
    확인판 = []
    for 이름, 표정 in 항목['표정'].items():
        판경로 = 여기 / 표정['판']
        표정판 = 읽기(판경로)
        맞춤 = 맞추기(장면, 표정판, 항목['까몽머리'])
        print(' ', 이름, '맞춤 점수 %.3f 배율 %.3f' % (맞춤[0], 맞춤[1]))
        if 맞춤[0] < 0.55:
            raise SystemExit(f'{결} {이름}: 표정 판에서 까몽 머리를 못 찾았다(점수 {맞춤[0]:.2f})')
        합성, 알파 = 눈조각(장면, 표정판, 눈들, 항목['까몽머리'], 맞춤, 표정['넓힘'])
        자리 = 조각저장(합성, 알파, 폴더 / f'{이름}.webp')
        판['조각'][이름] = {'파일': f'{이름}.webp', '자리px': 자리,
                         '자리': [round(자리[0] / W * 100, 3), round(자리[1] / H * 100, 3), round(자리[2] / W * 100, 3), round(자리[3] / H * 100, 3)],
                         '원본': 상대(판경로), '원본sha256': sha(판경로), '지시문': 상대(여기 / 표정['지시문']),
                         '맞춤': {'점수': round(맞춤[0], 4), '배율': 맞춤[1]}}
        확인판.append(합성)
    if 항목.get('마린머리'):
        렌즈들, 노랑 = 마린렌즈(장면, 항목['마린머리'])
        밝게, 알파 = 렌즈조각(장면, 노랑)
        자리 = 조각저장(밝게, 알파, 폴더 / '마린렌즈.webp')
        판['조각']['마린렌즈'] = {'파일': '마린렌즈.webp', '자리px': 자리,
                             '자리': [round(자리[0] / W * 100, 3), round(자리[1] / H * 100, 3), round(자리[2] / W * 100, 3), round(자리[3] / H * 100, 3)],
                             '만든법': '장면의 노란 렌즈 픽셀만 ×1.08 + (12,10,2) — 굽지 않음'}
    (폴더 / '판.json').write_text(json.dumps(판, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    확인.mkdir(parents=True, exist_ok=True)
    확인시트(장면, 확인판, 항목['까몽머리'], 확인 / f'{결}_조각확인.jpg')


def main():
    표 = json.loads((여기 / '장면표.json').read_text(encoding='utf-8'))
    고른 = sys.argv[1:] or list(표)
    for 결 in 고른:
        한결(결, 표[결])


if __name__ == '__main__':
    main()

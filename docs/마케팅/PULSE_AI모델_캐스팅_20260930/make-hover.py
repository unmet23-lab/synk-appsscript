# 카드에 마우스를 올리면 보이는 웃음 사진을 만든다. 사용: python make-hover.py
# 웃음 컷을 대표 사진과 같은 눈 위치·얼굴 크기로 옮긴다(확대·이동만, 회전 없음). 바뀌는 동안 두 얼굴이 겹쳐 보이지 않게 하려는 것이다.
# 맞춤 값은 hover-align.json에 있다. 가장자리가 비면(한 변에 3%까지) 웃음 컷 가장자리를 늘이고 흐리게 채운다.
# 결과: raw/<key>-hover.png. build-site.cjs가 이것을 img/<코드>/hover-s.webp로 줄인다.
import json, os
import numpy as np
import cv2

here = os.path.dirname(os.path.abspath(__file__))
read = lambda p: cv2.imdecode(np.fromfile(os.path.join(here, p), dtype=np.uint8), cv2.IMREAD_COLOR)  # 한글 경로
for m in json.load(open(os.path.join(here, 'hover-align.json'), encoding='utf-8'))['models']:
    hero, sm = read(m['hero']), read(m['smile'])
    H, W = hero.shape[:2]; sh, sw = sm.shape[:2]
    (hx, hy), (sx, sy), k = m['heroEye'], m['smileEye'], m['scale']
    ax, ay = k * W / sw, k * H / sh
    A = np.float32([[ax, 0, hx * W - ax * sx * sw], [0, ay, hy * H - ay * sy * sh]])
    out = cv2.warpAffine(sm, A, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
    cov = cv2.warpAffine(np.full((sh, sw), 255, np.uint8), A, (W, H), flags=cv2.INTER_NEAREST, borderValue=0)
    gap = float((cov == 0).mean())
    if gap:
        blur = cv2.GaussianBlur(out, (0, 0), 0.012 * W)
        d = cv2.distanceTransform((cov > 0).astype(np.uint8), cv2.DIST_L2, 5)
        w = np.clip(d / (0.015 * W), 0, 1)[..., None]
        out = (w * out + (1 - w) * blur).astype(np.uint8)
    cv2.imencode('.png', out)[1].tofile(os.path.join(here, 'raw', f"{m['key']}-hover.png"))
    print(m['code'], f'{W}x{H}', f'빈 가장자리 {gap * 100:.1f}%')

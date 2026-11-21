# 재료 옮기기 — 실제로 받은 결과(git 밖 실험 폴더의 원본 PNG)를 편 폴더 그림/(JPEG 기록)과 영상용 사본 public/img(git 밖)으로 가져오고,
# 영상이 쓰는 그림마다 두 눈의 자리를 재서 src/faces.json에 적는다(얼굴을 같은 자리에 놓고 겹쳐 띄우려고).
#   python -I -X utf8 remotion/scripts/재료.py            (편 폴더에서)
# 원본: 실험 실행기 폴더 ~/ego/synkbrief-profile-20261121/runs/<번호>/<번호>.png · gem/<번호>.png — 받은 그대로다. 여기서는 크기 · 색을 바꾸지 않고 JPEG로만 다시 담는다.
import json, os, sys
import cv2, numpy as np
from PIL import Image

EP = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EGO = os.path.expanduser('~/ego/synkbrief-profile-20261121')
YUNET = os.path.expanduser('~/.rembg/models/yunet/face_detection_yunet_2023mar.onnx')

# 실험 번호 → 그림/ 파일 이름(번호 뒤는 보낸 명령어의 갈래)
NAMES = {
    'E01': '한줄만', 'E02': '배경만', 'E03': '조명만', 'E04': '옷만', 'E05': '흑백', 'E06': '구도만',
    'E07': '한번에', 'E08': '한번에_얼굴말없이', 'E09': '한번에_다시', 'E10': '예쁘게보정', 'E11': '카페창가',
    'E12': '한번에_이어서잔머리', 'E13': '둘째얼굴_한번에', 'E14': '둘째얼굴_배경만', 'E15': '한번에_얼굴말없이_다시',
    'E16': '증명사진', 'E17': '활짝웃게', 'E18': '둘째얼굴_한줄만', 'E20': '짧게', 'E21': '짧게_다시',
    'E22': '둘째얼굴_짧게', 'E23': '짧게_이어서잔머리',
}
# 영상이 쓰는 그림: public/img 이름 → 원본
USE = json.load(open(os.path.join(EP, 'remotion', 'scripts', '쓰는그림.json'), encoding='utf8')) if os.path.exists(os.path.join(EP, 'remotion', 'scripts', '쓰는그림.json')) else {}


def src_of(key):
    if key == 'A': return os.path.join(EP, '판', '셀카A_150805.png')
    if key == 'B': return os.path.join(EP, '판', '셀카B_151759_2.png')
    if key.startswith('G'):
        for ext in ('png', 'jpg'):
            p = os.path.join(EGO, 'gem', f'{key}.{ext}')
            if os.path.exists(p): return p
        return None
    p = os.path.join(EGO, 'runs', key, key + '.png')
    return p if os.path.exists(p) else None


def eyes(path):
    im = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
    h, w = im.shape[:2]
    fd = cv2.FaceDetectorYN.create(YUNET, '', (w, h), 0.5, 0.3, 5000)
    _, fs = fd.detect(im)
    if fs is None: return {'w': w, 'h': h}
    f = max(fs, key=lambda r: r[2] * r[3])
    re, le = f[4:6], f[6:8]
    return {'w': w, 'h': h, 'ex': round(float((re[0] + le[0]) / 2), 1), 'ey': round(float((re[1] + le[1]) / 2), 1),
            'd': round(float(np.linalg.norm(le - re)), 1), 'a': round(float(np.degrees(np.arctan2(le[1] - re[1], le[0] - re[0]))), 2),
            'box': [round(float(v), 1) for v in f[:4]]}


def main():
    os.makedirs(os.path.join(EP, '그림'), exist_ok=True)
    os.makedirs(os.path.join(EP, 'remotion', 'public', 'img'), exist_ok=True)
    made = []
    for key, name in list(NAMES.items()) + [('G1', '제미나이_한번에'), ('G2', '제미나이_한줄만')]:
        s = src_of(key)
        if not s: continue
        out = os.path.join(EP, '그림', f'실험_{key}_{name}.jpg')
        Image.open(s).convert('RGB').save(out, quality=92, subsampling=0)
        made.append(os.path.basename(out))
    for key, name in (('A', '셀카A_보낸사진'), ('B', '셀카B_보낸사진')):
        Image.open(src_of(key)).convert('RGB').save(os.path.join(EP, '그림', f'{name}.jpg'), quality=92, subsampling=0)
    print('그림/', len(made) + 2, '장')
    faces = {}
    for pub, key in USE.items():
        s = src_of(key)
        if not s: print('없음', pub, key); continue
        Image.open(s).convert('RGB').save(os.path.join(EP, 'remotion', 'public', 'img', pub + '.jpg'), quality=95, subsampling=0)
        faces[pub] = eyes(s)
        print(pub, key, faces[pub])
    if USE:
        json.dump(faces, open(os.path.join(EP, 'remotion', 'src', 'faces.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()

"""대표 차림의 열린 눈 윤곽. 색 연결성으로 얼굴 털을 추출하지 않는다.

검수 좌표: 여름델+전설의팻말, 1290x1219 RGBA, 2026-09-09.
L/R은 보는 사람의 화면 좌/우이며 size는 PIL 순서 (너비, 높이)다.
기존 4K 그림의 새 생성/재해석, 좌우 복제, 정본 파일 변경은 하지 않는다.
응원 우측만 기존 4K 동일 표정의 온전한 눈을 원래 등록값으로 복구한다.
외부 호출은 validate_sources() 후 open_eye_mask(), source_frames()를 사용한다.
이 모듈의 수학/파일 검사는 최종 합성의 자연스러움 판정과 별개다.
"""
from pathlib import Path
import hashlib

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
KEY = '여름델+전설의팻말'
SIZE = (1290, 1219)
OPEN_CUTS = ('본체', '궁금함', '응원', '놀람')
SOURCE_FOLDER = Path('docs/Loom_자산/옷/GPT_표정_누끼')
SOURCE_SHA256 = {
    '본체': 'c4c29804ce1467aadb5c4608fba5d957a2b26b87fad724cf0ed06faf5f3d8e1b',
    '궁금함': '73a83bdc26834bb6e8658c30befdfd5972599e76f97bbfe87ffe8a1304c11ce3',
    '응원': '966a25d9c765031851477964498ec887410ee00f4e0f6ce89b6972135f052524',
    '놀람': '8ac39f17278a158fed90c9badfce8907cec71f8504e5fc4d6754d425649bf4ec',
}
REGISTRATION_SOURCES = {
    'docs/Loom_자산/옷/GPT정액시험/까몽_여름델+전설의팻말.png':
        '956a25fcc8d109269119fc776752d9e91eb2416210df60e018d522c5dc4c3ab8',
    'docs/캐릭터/정본_4K/까몽_본체.png':
        'fea5f2b66db16a1089f4475492c59fb8273bfcf80b18fbcde4909a950e3796ab',
    'docs/캐릭터/정본_4K/까몽_응원.png':
        'dfd8de63e6e45ae4788facddf16dfa825f45abf99c8ce9dca12f41144109cd3e',
}
# 옷표정얹기.한벌의 정본 본체 두 눈 → 표정 전 의상 두 눈 계산값 그대로.
# 기존 코드와 동일하게 정본을 int(W*k), int(H*k)로 1회 Lanczos 축소한 뒤
# (round(dx),round(dy))에 mask 없이 RGBA를 복사한다.
REGISTRATION = {'k': 0.39812854094155703,
                'dx': -205.57734088840982, 'dy': -229.75186019771724}

# 원본 실물의 바깥 윤곽을 명시한다. 녹색 bbox보다 검정 동공·반사광·흰자 쪽이 넓다.
# (중심x, 중심y, 반지름x, 반지름y, 회전도). 좌표는 1290x1219에만 유효하다.
# 검은 털의 밝기/연결성은 윤곽 결정에 전혀 쓰지 않는다.
ELLIPSES = {
    '본체': ((377.5, 355.0, 55.5, 61.0, 5), (660.5, 355.5, 57.5, 61.5, -4)),
    '궁금함': ((379.0, 354.5, 51.0, 55.5, 3), (663.5, 355.5, 63.5, 65.5, -5)),
    '응원': ((476.0, 466.5, 63.5, 71.0, 8), (800.5, 467.0, 64.5, 71.0, -6)),
    '놀람': ((373.5, 355.0, 73.5, 79.0, 3), (661.5, 355.0, 74.0, 79.0, -3)),
}


def _side(side):
    if side in ('L', '왼', 0):
        return 0
    if side in ('R', '오', 1):
        return 1
    raise ValueError('side는 화면 기준 L/R 또는 0/1이어야 한다')


def open_eye_mask(cut, side, size=SIZE):
    """검수된 원본 좌표의 이진 마스크. 크기 변경/미검수 표정은 묵시 대체하지 않는다."""
    if tuple(size) != SIZE:
        raise ValueError('이 눈 윤곽은 1290x1219 전용이다. 다른 크기는 다시 검수해야 한다')
    if cut not in ELLIPSES:
        raise ValueError('검수된 열린 눈 표정이 아니다: '+str(cut))
    cx, cy, rx, ry, angle = ELLIPSES[cut][_side(side)]
    mask = np.zeros((SIZE[1], SIZE[0]), np.uint8)
    # 1/256화소 좌표로 타원을 재단한다. 마스크는 0/255이며 후처리 feather는 호출자 몫이다.
    cv2.ellipse(mask, (round(cx*256), round(cy*256)),
                (round(rx*256), round(ry*256)), angle, 0, 360, 255, -1,
                lineType=cv2.LINE_8, shift=8)
    return mask


def source_path(cut, root=ROOT):
    if cut not in SOURCE_SHA256:
        raise ValueError('검수한 원본 표정이 아니다: '+str(cut))
    return Path(root)/SOURCE_FOLDER/f'까몽_{KEY}_{cut}.png'


def validate_sources(root=ROOT, include_registration=True):
    """좌표를 검수한 실제 입력 파일을 SHA-256으로 고정한다. 차이가 나면 멈춘다."""
    root = Path(root)
    evidence = {source_path(cut, root): digest for cut, digest in SOURCE_SHA256.items()}
    if include_registration:
        evidence.update({root/path: digest for path, digest in REGISTRATION_SOURCES.items()})
    checked = {}
    for path, expected in evidence.items():
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError('눈 윤곽 검수 원본이 바뀌었다: '+str(path))
        checked[path.relative_to(root).as_posix()] = actual
    return checked


def registered_cheer(root=ROOT):
    """동일 표정 정본을 기존 원본 눈 등록값 그대로 축소·배치한다. 파일은 쓰지 않는다."""
    validate_sources(root)
    path = Path(root)/'docs/캐릭터/정본_4K/까몽_응원.png'
    with Image.open(path) as source:
        image = source.convert('RGBA')
    k = REGISTRATION['k']
    image = image.resize((int(image.width*k), int(image.height*k)), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', SIZE, (0, 0, 0, 0))
    canvas.paste(image, (round(REGISTRATION['dx']), round(REGISTRATION['dy'])))
    return np.asarray(canvas).copy()


def source_frames(frames=None, root=ROOT):
    """원본 dict의 복사본을 반환하며 응원 우측의 RGB만 복구한다.

    None이면 열린 눈 4컷 dict를 반환한다. 전체 8컷 dict를 전달하면 닫힌 눈도
    그대로 복사한다. 호출자의 입력 배열, 다른 눈/표정, 전체 알파는 변경하지 않는다.
    """
    validate_sources(root)
    originals = {}
    for cut in OPEN_CUTS:
        with Image.open(source_path(cut, root)) as image:
            if image.mode != 'RGBA' or image.size != SIZE:
                raise ValueError('검수 원본 RGBA/크기 불일치: '+cut)
            originals[cut] = np.asarray(image).copy()
    if frames is None:
        frames = originals
    for cut, original in originals.items():
        if cut not in frames or not np.array_equal(frames[cut], original):
            raise ValueError('전달한 표정이 검수 원본과 다르다: '+cut)
    result = {cut: frame.copy() for cut, frame in frames.items()}
    donor = registered_cheer(root)
    selected = open_eye_mask('응원', 'R') > 0
    if not np.all(donor[..., 3][selected] == 255):
        raise ValueError('등록한 응원 눈이 불투명 얼굴 범위를 벗어났다')
    result['응원'][..., :3][selected] = donor[..., :3][selected]
    return result

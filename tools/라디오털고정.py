"""라디오 표정 합성 수리: 한 장의 털 바탕 + 분리한 두 눈.

기존 RGBA를 읽는 결정적 로컬 합성이다. 생성 API, 정본 덮어쓰기 없음.
현재 검증 프로필은 까몽 여름델+전설의팻말 한 벌만 지원한다.
python tools/라디오털고정.py
"""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

try:
    from mascot_originals import ensure_files
except ModuleNotFoundError:
    from tools.mascot_originals import ensure_files

ROOT = Path(__file__).resolve().parent.parent
KEY = '여름델+전설의팻말'
OUT = ROOT / 'docs/_ops/의상라디오검수_20260909/털일관성'
CUTS = ['본체', '눈감음', '눈웃음', '궁금함', '집중', '안도', '응원', '놀람']
OPEN = {'본체', '궁금함', '응원', '놀람'}


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'tools' / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def eye_mask(image, box, opened):
    """검수한 눈 상자 안의 녹색 눈꺼풀/홍채만. 열린 눈의 동공·반사광은 내부 채움.

    얼굴 사각형 통째 복사는 금지. 닫힌 눈에는 볼록 껍질을 쓰지 않는다.
    """
    x0, y0, x1, y1 = box
    rgb = image[y0:y1, x0:x1, :3].astype(np.int16)
    seed = ((rgb[..., 1] > rgb[..., 0] + 3) &
            (rgb[..., 1] > rgb[..., 2] + 3) & (rgb[..., 1] > 35)).astype(np.uint8) * 255
    count, labels, stats, _ = cv2.connectedComponentsWithStats(seed)
    seed = np.zeros_like(seed)
    for i in range(1, count):
        if stats[i, cv2.CC_STAT_AREA] >= 4:
            seed[labels == i] = 255
    if not np.any(seed):
        raise ValueError('눈을 찾지 못함: '+str(box))
    if opened:
        # 합성 fixture용 일반 눈. 실제 대표 자산은 별도 검수 윤곽을 사용한다.
        yy, xx = np.where(seed > 0)
        left, top, right, bottom = int(xx.min()), int(yy.min()), int(xx.max()), int(yy.max())
        cv2.ellipse(seed, (round((left+right)/2), round((top+bottom)/2)),
                    (round((right-left)/2+1), round((bottom-top)/2+1)), 0, 0, 360, 255, -1)
    # 털을 넓게 끌어오지 않고 눈 경계의 표본 오차만 1화소 허용한다.
    seed = cv2.dilate(seed, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    mask = np.zeros(image.shape[:2], np.uint8)
    mask[y0:y1, x0:x1] = seed
    return mask


def bounds(mask):
    yy, xx = np.where(mask > 0)
    if not len(xx):
        raise ValueError('빈 눈 마스크')
    return [int(xx.min()), int(yy.min()), int(xx.max()+1), int(yy.max()+1)]


def center(mask):
    x0, y0, x1, y1 = bounds(mask)
    return ((x0+x1-1)/2, (y0+y1-1)/2)


def feather(mask):
    # 경계 안쪽으로만 부드럽게. 바깥 털에 번지는 가우시안 창은 사용하지 않는다.
    distance = cv2.distanceTransform((mask > 0).astype(np.uint8), cv2.DIST_L2, 3)
    return np.clip(distance / 1.6, 0, 1)[..., None]


def blend(base, source, weight):
    result = base.copy()
    result[..., :3] = np.rint(base[..., :3]*(1-weight)+source[..., :3]*weight).astype(np.uint8)
    return result


def build(frames, boxes, reviewed_masks=None, donor_offset=None):
    if set(frames) != set(CUTS) or set(boxes) != set(CUTS):
        raise ValueError('같은 크기의 RGBA 8표정이 필요하다')
    base = frames['본체']
    if any(a.shape != base.shape for a in frames.values()):
        raise ValueError('같은 크기의 RGBA 8표정이 필요하다')
    if base.ndim != 3 or base.shape[2] != 4:
        raise ValueError('RGBA만 허용')
    if reviewed_masks:
        if set(reviewed_masks) - OPEN:
            raise ValueError('검수 윤곽은 열린 눈 표정만 교체한다')
        for pair in reviewed_masks.values():
            if len(pair) != 2 or any(m.shape != base.shape[:2] or m.dtype != np.uint8
                                     or not np.any(m) or np.any((m != 0) & (m != 255)) for m in pair):
                raise ValueError('검수 윤곽은 같은 크기의 이진 두 눈이어야 한다')
    masks = {cut: (reviewed_masks[cut] if reviewed_masks and cut in reviewed_masks else
                    [eye_mask(frames[cut], b, cut in OPEN) for b in boxes[cut]]) for cut in CUTS}
    targets = [center(m) for m in masks['본체']]
    # 기존 열린 눈이 차지했던 곳의 바탕도 기본 그림의 볼 털에서만 가져온다.
    # 다른 표정의 털·옛 눈꺼풀 그림자를 다시 들여오지 않는다.
    erase_base = cv2.dilate(np.maximum.reduce(masks['본체']),
                           cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
    # 두 눈을 따로 경계 명암에 맞춰 붙인다. 전체 얼굴 재질은 가져오지 않는다.
    plate = base.copy()
    for mask in masks['본체']:
        hole = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
        bx0, by0, bx1, by1 = bounds(hole)
        at = ((bx0+bx1)//2, (by0+by1)//2)
        offset = donor_offset if donor_offset is not None else round((bx1-bx0)*1.15)
        if by1+offset > base.shape[0]:
            raise ValueError('기본 볼 털 표본이 프레임 밖')
        donor = np.ascontiguousarray(base[by0+offset:by1+offset, bx0:bx1, :3])
        if donor_offset is not None:
            donor_alpha = base[by0+offset:by1+offset, bx0:bx1, 3]
            colors = donor.astype(np.int16)
            if np.any(donor_alpha < 255) or np.any(colors.max(axis=2)-colors.min(axis=2) > 52):
                raise ValueError('검수한 볼 털 표본에 투명 배경 또는 의상색이 섞임')
        local_mask = np.ascontiguousarray(hole[by0:by1, bx0:bx1])
        healed = cv2.seamlessClone(donor, np.ascontiguousarray(plate[..., :3]),
                                   local_mask, at, cv2.NORMAL_CLONE)
        plate[..., :3][hole > 0] = healed[hole > 0]
    # OpenCV의 clone 경계 계산도 명시적으로 눈 구멍 안으로 제한한다.
    plate[erase_base == 0] = base[erase_base == 0]
    results, active, shifts = {}, {}, {}
    height, width = base.shape[:2]
    for cut in CUTS:
        frame = plate.copy()
        active[cut] = np.zeros(base.shape[:2], np.uint8)
        shifts[cut] = []
        for mask, target in zip(masks[cut], targets):
            cx, cy = center(mask)
            dx, dy = round(target[0]-cx), round(target[1]-cy)
            matrix = np.float32([[1, 0, dx], [0, 1, dy]])
            moved_mask = cv2.warpAffine(mask, matrix, (width, height), flags=cv2.INTER_NEAREST)
            moved = cv2.warpAffine(frames[cut], matrix, (width, height), flags=cv2.INTER_NEAREST)
            if (moved_mask > 0).sum() != (mask > 0).sum():
                raise ValueError('눈이 프레임 밖으로 잘림')
            frame = blend(frame, moved, feather(moved_mask))
            active[cut] = np.maximum(active[cut], moved_mask)
            shifts[cut].append([dx, dy])
        results[cut] = frame
    # 바탕 수리용 구멍을 움직이는 눈 허용영역으로 세지 않는다.
    # 기본까지 같은 바탕을 공유하므로 실제 눈 마스크 밖은 컷 간 완전 불변이다.
    support = np.maximum.reduce(list(active.values())) > 0
    reference = results['본체']
    checks = []
    for cut, frame in results.items():
        changed = np.any(frame[..., :3] != reference[..., :3], axis=2)
        fur = ~support
        fur_changed = int((changed & fur).sum())
        alpha_changed = int(np.any(frame[..., 3] != base[..., 3]))
        if fur_changed or alpha_changed:
            raise ValueError(f'{cut}: 고정 털/알파 변경 {fur_changed}/{alpha_changed}; {bounds((changed & fur).astype(np.uint8)) if fur_changed else None}')
        checks.append({'표정': cut, '눈경계밖_변경화소': fur_changed,
                       '알파차이': alpha_changed, '변경화소': int(changed.sum()),
                       '눈_이동': shifts[cut]})
    return results, support, plate, masks, checks


def main():
    source = ROOT / 'docs/Loom_자산/옷/GPT_표정_누끼'
    paths = {cut: source/f'까몽_{KEY}_{cut}.png' for cut in CUTS}
    ensure_files(paths.values())
    frames = {cut: np.asarray(Image.open(path).convert('RGBA')) for cut, path in paths.items()}
    finder = module('옷표정얹기')
    boxes = {}
    for cut, arr in frames.items():
        eyes = finder.눈찾기(arr[..., :3], arr[..., 3] > 128)
        if eyes is None:
            raise ValueError(cut + ': 두 눈 등록 실패')
        radius = eyes['사이'] * .35
        boxes[cut] = [[max(0, round(x-radius)), max(0, round(y-radius)),
                       min(arr.shape[1], round(x+radius)), min(arr.shape[0], round(y+radius))]
                      for x, y in [eyes['왼'], eyes['오']]]
    outline = module('라디오눈윤곽')
    outline_sources = outline.validate_sources()
    recovered = outline.source_frames(frames)
    reviewed = {cut: [outline.open_eye_mask(cut, side) for side in ['L', 'R']] for cut in OPEN}
    results, support, plate, masks, checks = build(recovered, boxes, reviewed_masks=reviewed, donor_offset=140)
    version = hashlib.sha256(b''.join(results[cut].tobytes() for cut in CUTS)).hexdigest()[:16]
    folder = OUT/'후보_RGBA'/version
    folder.mkdir(parents=True, exist_ok=True)
    for cut, frame in results.items():
        Image.fromarray(frame).save(folder/paths[cut].name)
    Image.fromarray(support.astype(np.uint8)*255).save(OUT/'눈변화허용영역.png')
    Image.fromarray(plate).save(OUT/'고정털바탕.png')
    x0, y0, x1, y1 = bounds(support)
    crop = (x0-50, y0-70, x1+50, y1+80)
    tile_width, tile_height = x1-x0+100, y1-y0+150
    font = ImageFont.truetype(str(ROOT/'docs/브랜드_폰트/SUIT/SUIT-Medium.otf'), 22)
    sheet = Image.new('RGB', (tile_width*4, (tile_height+42)*4), '#f5f1e8')
    draw = ImageDraw.Draw(sheet)
    for i, cut in enumerate(CUTS):
        col, row = i % 4, (i//4)*2
        for offset, arr, label in [(0, frames[cut], '전'), (1, results[cut], '후')]:
            x, y = col*tile_width, (row+offset)*(tile_height+42)
            sheet.paste(Image.fromarray(arr).crop(crop).convert('RGB'), (x, y+42))
            draw.text((x+12, y+8), cut+' · 수정 '+label, font=font, fill='#2c211b')
    sheet.save(OUT/'표정8개_전후.png')
    report = {'차림': KEY, '방식': '기본 털 고정 + 두 눈/실눈만 합성. 응원 눈 위치를 같은 닻에 등록.',
              '범위': '대표 한 벌 로컬 후보, 다른 차림/캐릭터 합격 아님',
              '후보폴더': folder.relative_to(ROOT).as_posix(),
              '눈윤곽원본': outline_sources,
              '응원_오른눈': '동일 표정 4K 정본을 기존 등록값으로 1회 Lanczos 축소하여 잘린 흰자/눈 경계 복구. 좌우 복제/새 생성 아님.',
              '기본_RGBA_동일': np.array_equal(frames['본체'], results['본체']),
              '기본_변경화소': int(np.any(frames['본체'] != results['본체'], axis=2).sum()),
              '기본_변경설명': '정본 파일은 불변. 파생 기본도 공통 눈바탕을 쓰므로 눈가의 좁은 수리 영역은 원래 기본과 다르다.',
              '전체화소': int(support.size), '눈변화허용화소': int(support.sum()),
              '입력': {cut: {'파일': p.relative_to(ROOT).as_posix(), 'sha256': sha(p)} for cut, p in paths.items()},
              '눈상자': boxes, '검사': checks}
    (OUT/'털고정검사.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in ['입력', '눈상자']}, ensure_ascii=False))


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()

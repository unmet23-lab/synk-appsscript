"""Conditional, local comparison; no production function imports or writes.

The comparator receives the existing common restored plate, the same reviewed
eye geometry, the same closed-eye selection recipe, registration and feather.
It does NOT independently invent those inputs from the cited prior art.
"""
import ast
import hashlib
import json
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import PIL
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent / 'loom-comparison-20260913'
CUTS = ['본체', '눈감음', '눈웃음', '궁금함', '집중', '안도', '응원', '놀람']
KEY = '여름델+전설의팻말'
OPS = ROOT / 'docs/_ops/의상라디오검수_20260909/털일관성'
watched = {}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path, expected=None):
    path = Path(path)
    h = digest(path)
    if expected is not None and h != expected:
        raise ValueError('Input changed: ' + str(path))
    watched[str(path.relative_to(ROOT))] = h
    return path


def rgba(path, expected=None):
    return np.array(Image.open(read(path, expected)).convert('RGBA'))


def constants(path):
    # Read literal calibration data without importing any production module.
    tree = ast.parse(read(path).read_text(encoding='utf-8-sig'))
    out = {}
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    try:
                        out[target.id] = ast.literal_eval(node.value)
                    except (ValueError, TypeError):
                        pass
    return out


def centre(mask):
    y, x = np.nonzero(mask)
    return ((int(x.min()) + int(x.max())) / 2, (int(y.min()) + int(y.max())) / 2)


def translate(array, dx, dy):
    # Integer translation by array slices, not the production warpAffine call.
    h, w = array.shape[:2]
    out = np.zeros_like(array)
    x0, y0, x1, y1 = max(0, -dx), max(0, -dy), min(w, w-dx), min(h, h-dy)
    out[y0+dy:y1+dy, x0+dx:x1+dx] = array[y0:y1, x0:x1]
    return out


def difference(a, b):
    delta = np.abs(a.astype(np.int16)-b.astype(np.int16))
    return {'changedPixels': int(np.any(delta != 0, axis=2).sum()),
            'changedChannels': int(np.count_nonzero(delta)), 'maxChannelDelta': int(delta.max())}


def main():
    if OUT.exists():
        raise FileExistsError('Existing evidence must not be overwritten: ' + str(OUT))
    report = json.loads(read(OPS/'털고정검사.json').read_text(encoding='utf-8'))
    radio_root = ROOT/'docs/Loom_자산/라디오차림'
    radio = json.loads(read(radio_root/'_기록'/f'{KEY}.json').read_text(encoding='utf-8'))
    for p in ['tools/옷표정얹기.py', 'tools/옷표정검사.py', 'tools/라디오털고정.py',
              'tools/라디오눈윤곽.py', 'tools/라디오차림굽기.py',
              'docs/캐릭터/캐릭터_생명감_설계.md', 'DESIGN.md',
              'docs/Loom_자산/라디오차림/목록.json', 'bots/오버레이/마스코트.html']:
        read(ROOT/p)
    spec = constants(ROOT/'tools/라디오눈윤곽.py')
    required = {row['파일']: row['sha256'] for row in report['입력'].values()}
    required.update(report['눈윤곽원본'])
    missing = [{'path': p, 'expectedSHA256': h} for p, h in required.items() if not (ROOT/p).is_file()]
    mismatched = []
    for p, expected in required.items():
        if (ROOT/p).is_file():
            actual_hash = digest(read(ROOT/p))
            if actual_hash != expected:
                mismatched.append({'path': p, 'expectedSHA256': expected, 'actualSHA256': actual_hash})
    if missing or mismatched:
        # A stored output is not substituted for the missing pre-composite input.
        # Only audit the existing approved outputs, explicitly not a baseline run.
        support = np.array(Image.open(read(OPS/'눈변화허용영역.png')).convert('L')) > 0
        plate = rgba(OPS/'고정털바탕.png')
        actual = {cut: rgba(ROOT/radio['파일'][cut]['원본'], radio['파일'][cut]['원본_sha256']) for cut in CUTS}
        rows = []
        for cut in CUTS:
            row = radio['파일'][cut]
            final = rgba(radio_root/row['결과'], row['결과_sha256'])
            rows.append({'cut': cut, 'rawShape': list(actual[cut].shape), 'radioShape': list(final.shape),
                         'outsideStoredSupportChangedPixels': int((np.any(actual[cut] != actual['본체'], axis=2) & ~support).sum()),
                         'alphaChangedPixels': int(np.count_nonzero(actual[cut][..., 3] != plate[..., 3])),
                         'rawSHA256matchesRecord': True, 'radioSHA256matchesRecord': True})
        result = {'status': 'blocked-original-inputs-not-reproducible', 'comparisonExecuted': False,
                  'approvedOutputAuditExecuted': True, 'commonPlateGenerationRetested': False,
                  'productionFunctionsCalled': [], 'archiveRestoreCalled': False,
                  'scope': '8 stored approved outputs only; no same-input baseline output was produced',
                  'missingInputs': missing, 'mismatchedInputs': mismatched, 'perCut': rows, 'supportPixels': int(support.sum()),
                  'outsideSupportPixels': int((~support).sum()),
                  'libraries': {'Python': sys.version.split()[0], 'OpenCV': cv2.__version__, 'NumPy': np.__version__, 'Pillow': PIL.__version__},
                  'inputsSHA256': watched,
                  'allReadInputsUnchanged': all(digest(ROOT/p) == hv for p, hv in watched.items()),
                  'reason': 'Historical pre-composite inputs are absent or differ from pinned SHA. ensure_files would restore production paths; not called. Stored outputs cannot serve as an independent baseline input.'}
        OUT.mkdir(parents=True, exist_ok=False)
        (OUT/'RESULTS.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        print(json.dumps({k: v for k, v in result.items() if k != 'inputsSHA256'}, ensure_ascii=False))
        return
    for p, h in report['눈윤곽원본'].items():
        read(ROOT/p, h)
    frames = {cut: rgba(ROOT/row['파일'], row['sha256']) for cut, row in report['입력'].items()}
    plate = rgba(OPS/'고정털바탕.png')
    masks = {}
    h, w = plate.shape[:2]
    for cut in CUTS:
        pair = []
        for side in range(2):
            m = np.zeros((h, w), np.uint8)
            if cut in spec['ELLIPSES']:
                cx, cy, rx, ry, angle = spec['ELLIPSES'][cut][side]
                cv2.ellipse(m, (round(cx*256), round(cy*256)), (round(rx*256), round(ry*256)),
                            angle, 0, 360, 255, -1, lineType=cv2.LINE_8, shift=8)
            else:
                x0, y0, x1, y1 = report['눈상자'][cut][side]
                rgb = frames[cut][y0:y1, x0:x1, :3].astype(np.int16)
                seed = ((rgb[..., 1] > rgb[..., 0]+3) & (rgb[..., 1] > rgb[..., 2]+3) & (rgb[..., 1] > 35)).astype(np.uint8)
                n, labels, stats, _ = cv2.connectedComponentsWithStats(seed)
                kept = np.zeros_like(seed)
                for label in range(1, n):
                    if stats[label, cv2.CC_STAT_AREA] >= 4:
                        kept[labels == label] = 255
                m[y0:y1, x0:x1] = cv2.dilate(kept, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
            if not np.any(m):
                raise ValueError('Empty mask: ' + cut)
            pair.append(m)
        masks[cut] = pair
    # Existing, explicitly supplied registration recovers the same right eye.
    reg = spec['REGISTRATION']
    donor = Image.open(read(ROOT/'docs/캐릭터/정본_4K/까몽_응원.png')).convert('RGBA')
    donor = donor.resize((int(donor.width*reg['k']), int(donor.height*reg['k'])), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (w, h))
    canvas.paste(donor, (round(reg['dx']), round(reg['dy'])))
    selected = masks['응원'][1] > 0
    frames['응원'][..., :3][selected] = np.array(canvas)[..., :3][selected]
    anchors = [centre(m) for m in masks['본체']]
    support = np.zeros((h, w), bool)
    outputs, hard_outputs, per_cut = {}, {}, []
    started = time.perf_counter()
    for cut in CUTS:
        output, hard = plate.copy(), plate.copy()
        shifts = []
        for mask, target in zip(masks[cut], anchors):
            cx, cy = centre(mask)
            dx, dy = round(target[0]-cx), round(target[1]-cy)
            shifted_mask = translate(mask, dx, dy)
            if np.count_nonzero(shifted_mask) != np.count_nonzero(mask):
                raise ValueError('Clipped eye')
            source = translate(frames[cut], dx, dy)
            # Ordinary linear interpolation; same feather supplied to both sides.
            distance = cv2.distanceTransform((shifted_mask > 0).astype(np.uint8), cv2.DIST_L2, 3)
            a = np.clip(distance/1.6, 0, 1)[..., None]
            output[..., :3] = np.rint((1-a)*output[..., :3] + a*source[..., :3]).astype(np.uint8)
            hard[..., :3][shifted_mask > 0] = source[..., :3][shifted_mask > 0]
            support |= shifted_mask > 0
            shifts.append([dx, dy])
        outputs[cut], hard_outputs[cut] = output, hard
        row = radio['파일'][cut]
        approved = rgba(ROOT/row['원본'], row['원본_sha256'])
        final = rgba(radio_root/row['결과'], row['결과_sha256'])
        tr = radio['변환']
        img = Image.fromarray(output)
        scaled = img.resize((round(w*tr['k']), round(h*tr['k'])), Image.Resampling.LANCZOS)
        radio_image = Image.new('RGBA', tuple(radio['출력크기']))
        radio_image.paste(scaled, (tr['dx'], tr['dy']))
        per_cut.append({'cut': cut, 'vsApprovedRGBA': difference(output, approved),
                        'vsApprovedRadioRGBA': difference(np.array(radio_image), final),
                        'hardMaskVsFeather': difference(hard, output), 'eyeShifts': shifts,
                        'rawRGBAsha256': hashlib.sha256(output.tobytes()).hexdigest()})
    elapsed = time.perf_counter()-started
    reference = outputs['본체']
    for row in per_cut:
        output = outputs[row['cut']]
        row['outsideSupportChangedPixels'] = int((np.any(output != reference, axis=2) & ~support).sum())
        row['alphaChangedPixels'] = int(np.count_nonzero(output[..., 3] != plate[..., 3]))
        row['hardOutsideSupportChangedPixels'] = int((np.any(hard_outputs[row['cut']] != hard_outputs['본체'], axis=2) & ~support).sum())
    existing_support = np.array(Image.open(read(OPS/'눈변화허용영역.png')).convert('L')) > 0
    preservation = {p: digest(ROOT/p) == hash_value for p, hash_value in watched.items()}
    result = {'scope': 'one existing approved set, 8 expressions; conditional same-input comparison, not independent derivability from prior art',
              'baselineInputs': 'stored common restored plate; identical reviewed geometry, closed-eye selection recipe, source recovery, feather 1.6 and display transform',
              'productionFunctionsCalled': [], 'commonPlateGenerationRetested': False,
              'libraries': {'Python': sys.version.split()[0], 'OpenCV': cv2.__version__, 'NumPy': np.__version__, 'Pillow': PIL.__version__},
              'inputShape': [w, h], 'supportPixels': int(support.sum()),
              'outsideSupportPixels': int((~support).sum()), 'supportMatchesStored': bool(np.array_equal(support, existing_support)),
              'perCut': per_cut, 'elapsedSecondsIncludingComparisonReads': elapsed,
              'timingIsPerformanceBenchmark': False, 'inputsSHA256': watched,
              'allReadInputsUnchanged': all(preservation.values()), 'preservation': preservation,
              'conclusion': 'Output equality is conditional on supplied plate, masks and policy; it is not a legal obviousness result.'}
    OUT.mkdir(parents=True, exist_ok=False)
    for cut, output in outputs.items():
        Image.fromarray(output).save(OUT/f'{cut}.png')
    (OUT/'RESULTS.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k not in ['inputsSHA256','preservation']}, ensure_ascii=False))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()

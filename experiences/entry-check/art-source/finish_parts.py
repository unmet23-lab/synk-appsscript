# -*- coding: utf-8 -*-
"""입장 검사 펠트 부품 마감(2026-10-05) — 새로 굽지 않고 이 게임의 펠트 사진에서 만든다.

    python experiences/entry-check/art-source/finish_parts.py          바뀐 것만 다시 만든다
    python experiences/entry-check/art-source/finish_parts.py --다시   모두 다시 만든다

prepare_assets.py 를 다시 돌린 뒤에는 이 스크립트를 이어서 돌린다(도장이 cut-fixed/ 의 판으로 돌아가기 때문).
이미 마감한 파일은 건너뛴다: 마감한 결과의 해시를 finish_parts.json 에 적어 두고, 파일이 그 해시와 같으면
손대지 않는다(색을 손실 압축으로 저장하므로 같은 파일을 거듭 처리하면 조금씩 닳는다).

1) sparkle-off.webp — 아직 못 받은 별. 같은 펠트 별(sparkle.webp)의 양모 색만 키트 크림(badge-cream 의 평균색)으로
   바꾼다. 털 결과 그늘은 그대로 두고, 바닥 그림자는 손대지 않는다. 회색 필터(grayscale + opacity)를 대신한다.
   빈칸 베기(experiences/blank-slice/assets/felt/)에도 같은 파일을 둔다.
2) stamp-pass.webp · stamp-reject.webp — 받침 아래 흰 판을 걷는다(tools/펠트부품_오리기.py --고치기, 캔버스 그대로).
   그 도구는 크림 손잡이의 그늘진 목을 판으로 읽어 파먹으므로, 손잡이(받침 색이 아닌, 그림 위쪽과 이어진 양모)는
   걷기 전 픽셀로 되돌린다. 흰 판은 받침 아래에만 있다.
3) stamp-pass-sticker.webp — 바닥 그림자를 뺀 도장. 입구 화면의 스티커 테두리(.diecut 의 흰 drop-shadow)가 구워진
   바닥 그림자까지 감싸 받침 아래가 흰 판처럼 보이던 것을 없앤다.

색은 손실(quality 92), 알파는 무손실로 저장한다(알파가 한 픽셀도 달라지지 않는지 확인하고 쓴다).
끝나면 `python tools/펠트부품_오리기.py --검사 experiences/entry-check/assets/felt` 로 흰 테를 잰다(0.5% 넘으면 걸림).
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
FELT = os.path.join(ROOT, 'experiences', 'entry-check', 'assets', 'felt')
KIT = os.path.join(ROOT, 'experiences', 'entry-check', 'kit', 'felt')   # SYNK LAB PLAY 키트 사본(별·크림 배지는 키트에서 읽는다)
SLICE_FELT = os.path.join(ROOT, 'experiences', 'blank-slice', 'assets', 'felt')
CUTTER = os.path.join(ROOT, 'tools', '펠트부품_오리기.py')
RECORD = os.path.join(HERE, 'finish_parts.json')
SHADOW = np.array([47, 33, 29], np.float32)   # the cutter's ground shadow colour
LUMA = np.array([0.299, 0.587, 0.114], np.float32)
AGAIN = '--다시' in sys.argv[1:]
record = json.load(open(RECORD, encoding='utf-8')) if os.path.exists(RECORD) else {}


def digest(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def relative(path):
    return os.path.relpath(path, ROOT).replace(os.sep, '/')


def finished(path):
    """The file is the result this script recorded: nothing to do."""
    return not AGAIN and os.path.exists(path) and record.get(relative(path)) == digest(path)


def load(path):
    return np.asarray(Image.open(path).convert('RGBA')).astype(np.float32)


def save(pixels, path):
    """Lossy colour, exact alpha. Refuses to write if the alpha would change."""
    image = Image.fromarray(np.clip(pixels + 0.5, 0, 255).astype(np.uint8), 'RGBA')
    temporary = path + '.tmp.webp'
    image.save(temporary, 'WEBP', quality=92, alpha_quality=100, method=6, exact=True)
    back = np.asarray(Image.open(temporary).convert('RGBA'))
    if not (back[..., 3] == np.asarray(image)[..., 3]).all():
        os.remove(temporary)
        raise SystemExit('알파가 달라졌다: ' + path)
    os.replace(temporary, path)
    record[relative(path)] = digest(path)
    print('썼다', relative(path), os.path.getsize(path), 'bytes')


def unlit_star():
    sources = [os.path.join(KIT, 'sparkle.webp'), os.path.join(KIT, 'badge-cream.webp')]
    made_from = [digest(p) for p in sources]
    targets = [os.path.join(folder, 'sparkle-off.webp') for folder in (FELT, SLICE_FELT)]
    if record.get('sparkle-off.inputs') == made_from and all(finished(t) for t in targets):
        print('그대로', relative(targets[0]))
        return
    star, cream = load(sources[0]), load(sources[1])
    rgb, alpha = star[..., :3], star[..., 3]
    lum = rgb @ LUMA
    wool = ((rgb.max(-1) - rgb.min(-1)) > 28) & (alpha > 8)      # coloured wool; the shadow is a dark neutral
    cream_rgb = cream[..., :3][cream[..., 3] > 250]
    cream_lum = cream_rgb @ LUMA
    solid = wool & (alpha > 250)
    mean, spread = lum[solid].mean(), lum[solid].std()
    # The star's own light and dark, scaled to the spread cream wool really has.
    shade = 1 + (lum - mean) / mean * min(1.0, (cream_lum.std() / cream_lum.mean()) / (spread / mean) * 1.35)
    out = star.copy()
    out[..., :3] = np.where(wool[..., None], cream_rgb.mean(0)[None, None, :] * shade[..., None], rgb)
    for target in targets:
        save(out, target)
    record['sparkle-off.inputs'] = made_from


def stamp(name):
    """Returns True when the stamp was finished now (so what is made from it must follow)."""
    path = os.path.join(FELT, name + '.webp')
    if finished(path):
        print('그대로', relative(path))
        return False
    before = load(path)
    with tempfile.TemporaryDirectory() as work:
        cut = os.path.join(work, name + '.webp')
        subprocess.run([sys.executable, CUTTER, '--고치기', path, cut], check=True, stdout=subprocess.DEVNULL)
        fixed = load(cut)
    rgb, alpha = before[..., :3], before[..., 3]
    # Not the coloured base (coral: red well over green; green: green over red). Cream wool shaded by
    # the base beside it still counts as handle.
    base = (rgb[..., 0] - rgb[..., 1] > 60) | (rgb[..., 1] - rgb[..., 0] > 15)
    labels, _ = ndi.label((alpha >= 250) & ~base)
    top = labels[: alpha.shape[0] // 3]
    handle = ndi.binary_dilation(labels == int(np.bincount(top[top > 0]).argmax()), iterations=3)
    fixed[handle] = before[handle]
    save(fixed, path)
    return True


def sticker(remade):
    path = os.path.join(FELT, 'stamp-pass-sticker.webp')
    if not remade and finished(path):
        print('그대로', relative(path))
        return
    fixed = load(os.path.join(FELT, 'stamp-pass.webp'))
    rgb, alpha = fixed[..., :3], fixed[..., 3]
    shadow = (np.linalg.norm(rgb - SHADOW[None, None, :], axis=-1) < 30) & (alpha < 250)
    out = fixed.copy()
    out[..., 3] = np.where(shadow, 0, alpha)
    labels, count = ndi.label(out[..., 3] > 0)      # specks left where fur and shadow mixed
    if count > 1:
        sizes = ndi.sum(out[..., 3] > 0, labels, range(1, count + 1))
        out[..., 3] = np.where(labels == 1 + int(np.argmax(sizes)), out[..., 3], 0)
    save(out, path)


if __name__ == '__main__':
    unlit_star()
    sticker(stamp('stamp-pass'))
    stamp('stamp-reject')
    with open(RECORD, 'w', encoding='utf-8', newline='\n') as out:
        json.dump(record, out, ensure_ascii=False, indent=2, sort_keys=True)
        out.write('\n')

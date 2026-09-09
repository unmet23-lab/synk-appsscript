"""새싹 보호 범위와 승인 그림 보존을 검사하고, 별도 라디오 후보만 만든다."""
import hashlib
import importlib.util
import json
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BASE = ROOT/'docs/Loom_자산/옷'
CANDIDATE = HERE/'새싹보존후보'
spec = importlib.util.spec_from_file_location('expression', ROOT/'tools/옷표정얹기.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def legacy_seed(rgb, body, eyes):
    rgb = rgb.astype(int)
    green = (rgb[..., 1] > rgb[..., 0]) & (rgb[..., 1] > rgb[..., 2])
    return body & (rgb.max(axis=2)-rgb.min(axis=2) >= 52) & ~green


def mask_for(token, seed):
    class Captured(Exception):
        pass
    found = {}

    def capture_seed(rgb, body, eyes):
        found['seed'] = seed(rgb, body, eyes)
        found['eyes'] = eyes
        return found['seed']

    def capture(front, back, mask):
        found['mask'] = np.asarray(mask).copy()
        raise Captured()
    with patch.object(mod, '색옷씨앗', capture_seed), patch.object(Image, 'composite', capture):
        try:
            mod.한벌(token, 검사만=True, 출력=str(CANDIDATE/'무출력검사'))
        except Captured:
            pass
    return found


def main():
    candidate_token = '앞치마+한달출석새싹'
    tokens = [candidate_token, '여름델+한달출석새싹', '안경', '안경+여름델']
    inputs = [Path(mod.옷그림찾기('까몽', t)) for t in tokens]
    inputs += sorted((ROOT/'docs/캐릭터/정본_4K').glob('까몽_*.png'))
    for token in tokens:
        inputs += sorted((BASE/'GPT_표정').glob(f'까몽_{token}_*.png'))
        inputs += sorted((BASE/'GPT_표정_누끼').glob(f'까몽_{token}_*.png'))
    before = {str(p.relative_to(ROOT)): sha(p) for p in inputs}
    report = {'검사범위': '4차림의 14표정 공통 마스크. 후보 교체는 앞치마+새싹 14표정만.',
              '마스크': [], '후보': [], '원본보존': {}}
    corrected_seed = mod.색옷씨앗
    roi = None
    restore = None
    for token in tokens:
        old_capture, new_capture = mask_for(token, legacy_seed), mask_for(token, corrected_seed)
        old, new = old_capture['mask'], new_capture['mask']
        changed = old != new
        row = {'차림': token, '변경마스크픽셀': int(changed.sum()),
               '변경은보호확대뿐': bool(np.all(new <= old))}
        assert row['변경은보호확대뿐']
        if token == candidate_token:
            roi = np.zeros(changed.shape, bool)
            roi[450:560, 580:770] = True
            assert not (changed & ~roi).any(), '새 보호가 잎 영역 밖으로 나갔다'
            assert np.all(new[changed] == 0), '부분 혼합 재계산은 승인하지 않는다'
            # 과거 승인본의 창은 현 생성기 재현과 다를 수 있다. 마스크 차이가 난 일부만이
            # 아니라 이번에 새로 보호하는 초록 옷 전체를 같은 보호폭으로 원복한다.
            eye_height = new_capture['eyes'][3]-new_capture['eyes'][1]+1
            width = max(3, int(eye_height*.12))
            width += width % 2 == 0
            added_seed = new_capture['seed'] & ~old_capture['seed']
            restore = np.asarray(Image.fromarray((added_seed*255).astype(np.uint8))
                                 .filter(ImageFilter.MaxFilter(width))) > 0
            assert not (restore & ~roi).any()
            row['새보호영역픽셀'] = int(restore.sum())
            row['원본복원보호폭'] = width
            row['새싹영역밖_변경'] = 0
        else:
            assert not changed.any(), f'{token}: 기존 눈/옷 마스크에 영향'
        report['마스크'].append(row)
        print(json.dumps(row, ensure_ascii=False), flush=True)

    raw = np.asarray(Image.open(mod.옷그림찾기('까몽', candidate_token)).convert('RGB'))
    green = roi & (raw[..., 1].astype(int) > raw[..., 0].astype(int)+15) & (raw[..., 1].astype(int) > raw[..., 2].astype(int)+15)
    # 잎은 정확히 원복하되, 주위 털·흰 배지 일부를 사각형처럼 베껴 붙이지 않는다.
    # 초록 잎은 100%, 바로 주변은 2픽셀 부드러운 경계로 승인 그림에 잇는다.
    blend = np.asarray(Image.fromarray((green*255).astype(np.uint8))
                       .filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(2))).copy()
    blend[green] = 255
    blend[~restore] = 0
    weight = blend[..., None].astype(float)/255
    rgb_dir, rgba_dir = CANDIDATE/'보존형_RGB', CANDIDATE/'GPT_표정_누끼'
    rgb_dir.mkdir(parents=True, exist_ok=True)
    rgba_dir.mkdir(parents=True, exist_ok=True)
    samples = {}
    for expression in mod.표정목록('까몽'):
        name = f'까몽_{candidate_token}_{expression}.png'
        old_rgb = np.asarray(Image.open(BASE/'GPT_표정'/name).convert('RGB'))
        old_rgba = np.asarray(Image.open(BASE/'GPT_표정_누끼'/name).convert('RGBA'))
        assert np.all(old_rgba[..., 3][restore] == 255), '투명 가장자리는 변경하지 않는다'
        new_rgb = np.rint(raw*weight+old_rgb*(1-weight)).astype(np.uint8)
        new_rgba = old_rgba.copy()
        new_rgba[..., :3] = np.rint(raw*weight+old_rgba[..., :3]*(1-weight)).astype(np.uint8)
        assert np.array_equal(new_rgb[~roi], old_rgb[~roi])
        assert np.array_equal(new_rgba[~roi], old_rgba[~roi])
        assert np.array_equal(new_rgba[..., 3], old_rgba[..., 3])
        assert np.array_equal(new_rgb[green], raw[green]), '잎 색이 원본과 다르다'
        Image.fromarray(new_rgb).save(rgb_dir/name)
        Image.fromarray(new_rgba).save(rgba_dir/name)
        with Image.open(rgba_dir/name) as check:
            assert np.array_equal(np.asarray(check), new_rgba)
        d_old = np.abs(old_rgb.astype(int)-raw.astype(int)).max(axis=2)
        full = np.asarray(Image.open(CANDIDATE/'GPT_표정'/name).convert('RGB'))
        row = {'표정': expression, '크기': list(new_rgb.shape[1::-1]), '초록잎픽셀': int(green.sum()),
               '수정전_잎변경픽셀': int(((d_old > 0) & green).sum()),
               '수정전_잎최대RGB차이': int(d_old[green].max()),
               '수정후_잎원본RGB차이': 0, '새싹영역밖_RGB차이': 0, '알파차이': 0,
               '채택후보': str((rgba_dir/name).relative_to(ROOT)), 'sha256': sha(rgba_dir/name),
               '전체재계산_미채택_새싹밖변경': int(((full != old_rgb).any(axis=2) & ~roi).sum())}
        report['후보'].append(row)
        if expression == '본체':
            samples = {'원본': raw, '수정 전': old_rgb, '수정 후': new_rgb,
                       '전RGBA': old_rgba, '후RGBA': new_rgba}

    # 실제 눈 영역을 바꾸지 않았고, 승인 표정의 서로 다른 표정을 그대로 보존한다.
    hashes = [hashlib.sha256(np.asarray(Image.open(rgba_dir/f'까몽_{candidate_token}_{e}.png')).tobytes()).hexdigest()
              for e in mod.표정목록('까몽')]
    report['후보_서로다른표정'] = len(set(hashes))
    assert len(set(hashes)) == 14
    report['원본보존'] = {path: before[path] == sha(ROOT/path) for path in before}
    assert all(report['원본보존'].values())
    report['후보방식'] = '현 마스크 수정으로 추가 보호된 잎은 의상 원본 RGB 100% 복원. 잎 바로 주변은 2픽셀 부드러운 경계로 잇고 나머지는 승인 RGB/RGBA 그대로. 기존 알파 전체 보존.'
    report['전체재계산_미채택이유'] = '현 파이프라인 전체 재계산은 과거 승인 표정과 잎 밖 재현 차이가 있어 채택하지 않음. GPT_표정 폴더는 비교용 미채택 출력.'

    palette = {v['이름']:v['hex'] for v in json.loads((ROOT/'docs/디자인_토큰.json').read_text(encoding='utf-8'))['색']['킷']}
    font = ImageFont.truetype(str(ROOT/'docs/브랜드_폰트/SUIT/SUIT-Medium.otf'), 24)
    sheet = Image.new('RGB', (1460, 550), palette['Paper'])
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 14), '#029 앞치마 + 한달 출석 새싹 · 원본 / 수정 전 / 수정 후', font=font, fill=palette['Ink'])
    for i, key in enumerate(['원본', '수정 전', '수정 후']):
        # 2배 최근접 확대: 비교를 위한 픽셀 확대이며 새 디테일 생성이 아니다.
        crop = Image.fromarray(samples[key]).crop((570, 440, 800, 670)).resize((460, 460), Image.Resampling.NEAREST)
        sheet.paste(crop, (24+i*482, 52))
        draw.text((24+i*482, 518), key, font=font, fill=palette['Ink'])
    sheet.save(CANDIDATE/'새싹_전후확대.png')
    whole = Image.new('RGB', (848, 488), palette['Paper'])
    draw = ImageDraw.Draw(whole)
    for i, (key, label) in enumerate([('전RGBA', '수정 전'), ('후RGBA', '수정 후')]):
        thumb = Image.fromarray(samples[key]); thumb.thumbnail((400, 400), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (400, 400), palette['Oat'])
        frame.alpha_composite(thumb, ((400-thumb.width)//2, (400-thumb.height)//2))
        whole.paste(frame.convert('RGB'), (16+i*416, 16))
        draw.text((16+i*416, 438), label+' · 눈/몸/알파 유지', font=font, fill=palette['Ink'])
    whole.save(CANDIDATE/'까몽_전체전후.png')
    (HERE/'새싹후보검사.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('후보 14장 완료 / 원본 보존 / 잎 바깥 및 알파 변경 0', flush=True)


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    main()

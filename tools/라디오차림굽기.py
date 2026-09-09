"""라디오 검수용 차림: 기존 RGBA 원본 → 눈 등록 → 1024 lossless WebP.

새 그림/API/정본 덮어쓰기 없음. lossless는 WebP 인코딩에만 해당하며 축소는 리샘플링이다.
python tools/라디오차림굽기.py [--본체만] [--차림 여름델+전설의팻말] [--목록만|--검사만]
별도 후보: --차림 앞치마+한달출석새싹 --입력 docs/_ops/.../GPT_표정_누끼
기본 실행은 129개 본체와 연락판을 먼저 만들고 나머지 7표정을 이어 만든다.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'docs/Loom_자산/라디오차림'
PROOFS = ROOT / 'docs/_ops/의상라디오검수_20260909/실물'
PIPELINE = 'rgba-single-resample-unmasked-paste-lossless-webp-v1'
EXPRESSIONS = {'기본': '본체', '깜빡': '눈감음', '눈웃음': '눈웃음',
               '궁금함': '궁금함', '집중': '집중', '안도': '안도', '응원': '응원', '놀람': '놀람'}
ALIASES = {'기쁨': '눈웃음'}
SIZE = 1024


def load_module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'tools' / (name + '.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def relative(path):
    return Path(path).resolve().relative_to(ROOT).as_posix()


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.writing')
    temp.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(path)


def catalog():
    # 이름·차례의 정본을 JS 모듈에서 직접 받는다. 임의 사본 목록을 유지하지 않는다.
    js = """const L=require('./tools/lib/옷목록.js');const out={};
for(const c of ['까몽','몽글','마린']){const a=L.목록(c);const clothes=a.filter(v=>v.갈래==='의상').map(v=>v.이름),acc=a.filter(v=>v.갈래==='악세').map(v=>v.이름);const sets=[...a.map(v=>[v.이름]),...clothes.flatMap(x=>acc.map(y=>[x,y]))];out[c]={의상:clothes,악세:acc,차림:sets.map(parts=>({key:L.옷토막(c,parts),parts,의상:parts.find(x=>clothes.includes(x))||null,악세:parts.find(x=>acc.includes(x))||null,source:Object.fromEntries(['본체','눈감음','눈웃음','궁금함','집중','안도','응원','놀람'].map(e=>[e,L.옷경로(c,parts,e,'표정누끼')]))}))};}console.log(JSON.stringify(out));"""
    result = subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True,
                            text=True, encoding='utf-8', check=True)
    return json.loads(result.stdout)


def source_files(item, input_dir=None):
    folder = (ROOT / input_dir).resolve() if input_dir is not None else (ROOT / 'docs/Loom_자산/옷/GPT_표정_누끼').resolve()
    folder.relative_to(ROOT.resolve())
    files = {cut: (folder / Path(path).name if input_dir is not None else ROOT / path).resolve()
             for cut, path in item['source'].items()}
    for resolved in files.values():
        resolved.relative_to(folder)
    return files


def reusable_file(old, source, source_hash, destination):
    # 같은 화소의 본체를 후보 폴더로 옮겼어도 출처가 바뀌었으면 새 기록을 쓴다.
    return (old.get('원본') == relative(source) and old.get('원본_sha256') == source_hash
            and destination.is_file() and old.get('결과_sha256') == sha(destination))


def validate_source_set(item, input_dir=None, anchor_size=None):
    files = source_files(item, input_dir)
    absent = [relative(path) for path in files.values() if not path.is_file()]
    if absent:
        raise ValueError('표정 원본이 없다: '+', '.join(absent))
    if input_dir is not None and anchor_size is not None:
        for cut, path in files.items():
            with Image.open(path) as im:
                if im.mode != 'RGBA' or list(im.size) != list(anchor_size):
                    raise ValueError(f"{item['key']}/{cut}: 후보는 기존 기준과 같은 크기의 RGBA여야 한다")
    return files


def find_anchor(key):
    for folder in ['GPT_누끼', 'GPT정액시험_누끼']:
        path = ROOT / 'docs/Loom_자산/옷' / folder / f'까몽_{key}.png'
        if path.is_file():
            return path
    raise ValueError(f'{key}: 표정 전 기준 그림이 없다')


def source_windows():
    windows = {}
    folder = ROOT / 'docs/Loom_자산/옷/GPT_표정'
    for path in sorted(folder.glob('_보고*.json'), key=lambda p: p.stat().st_mtime):
        data = json.loads(path.read_text(encoding='utf-8-sig'))
        for row in data if isinstance(data, list) else [data]:
            if isinstance(row, dict) and '옷' in row and '창' in row:
                windows[row['옷']] = {'상자': row['창'], '기록': relative(path),
                    '한계': '기존 표정 작업의 창 기록. 당시 입력 지문이 없어 범위 대조 참고이며 원본 동일성 인증은 아님.'}
    return windows


def derive_rgba(source, transform, size=SIZE, compositor=None):
    k, dx, dy = transform['k'], transform['dx'], transform['dy']
    width, height = max(1, round(source.width * k)), max(1, round(source.height * k))
    scaled = source.resize((width, height), Image.Resampling.LANCZOS)
    if compositor:
        canvas = compositor(scaled, size, dx, dy)
    else:
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        canvas.paste(scaled, (dx, dy))  # mask=self 금지: 반투명 알파 제곱을 피한다.
    alpha = np.asarray(scaled)[..., 3]
    visible = np.zeros(alpha.shape, dtype=bool)
    x0, x1 = max(0, -dx), min(width, size - dx)
    y0, y1 = max(0, -dy), min(height, size - dy)
    if x1 > x0 and y1 > y0:
        visible[y0:y1, x0:x1] = True
    cropped = {'알파128초과_잘린픽셀': int(((alpha > 128) & ~visible).sum()),
               '알파0초과_잘린픽셀': int(((alpha > 0) & ~visible).sum())}
    return canvas, cropped


def encode_checked(image, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, 'WEBP', lossless=True, quality=100, method=3, exact=True)
    with Image.open(destination) as decoded:
        actual = np.asarray(decoded.convert('RGBA'))
    expected = np.asarray(image)
    if actual.shape != expected.shape or not np.array_equal(expected, actual):
        raise ValueError(f'WebP 무손실 재조회 불일치: {destination}')
    alpha = actual[..., 3]
    return {'RGBA_재조회차이': 0, '알파_재조회차이': 0,
            '가장자리_알파128초과': int((alpha[0] > 128).sum() + (alpha[-1] > 128).sum()
                + (alpha[:, 0] > 128).sum() + (alpha[:, -1] > 128).sum()),
            'RGBA_sha256': hashlib.sha256(actual.tobytes()).hexdigest()}


def record_path(key):
    return OUTPUT / '_기록' / f'{key}.json'


def source_edges(source):
    """입력부터 프레임에 닿는 화소를 센다. 접촉만으로 잘림을 확정하지 않는다."""
    alpha = np.asarray(source)[..., 3]
    return {name: int((edge > 128).sum()) for name, edge in
            [('상', alpha[0]), ('하', alpha[-1]), ('좌', alpha[:, 0]), ('우', alpha[:, -1])]}


def merge_inspection_rows(previous, updated):
    by_key = {row['차림']: row for row in previous}
    by_key.update({row['차림']: row for row in updated})
    return list(by_key.values())


def expression_paths(record):
    files = record.get('파일', {})
    output = {state: files[cut]['결과'] for state, cut in EXPRESSIONS.items()
              if cut in files and (OUTPUT / files[cut]['결과']).is_file()}
    for alias, original in ALIASES.items():
        if original in output:
            output[alias] = output[original]
    return output


def manifest(data):
    result = {'규격': 1, '크기': SIZE, '인코딩': 'WebP lossless; 축소 리샘플링과 구분',
              '표정계약': EXPRESSIONS, '별칭': ALIASES, '캐릭터': {}}
    for char, options in data.items():
        result['캐릭터'][char] = {'의상': options['의상'], '악세': options['악세'], '차림': {},
            '상태': '검수준비' if char == '까몽' else '통합 의상 표정 세트 없음 — 임의 합성하지 않음'}
        if char != '까몽':
            continue
        for index, item in enumerate(options['차림'], 1):
            path = record_path(item['key'])
            record = json.loads(path.read_text(encoding='utf-8')) if path.is_file() else {'key': item['key']}
            expressions = expression_paths(record)
            entry = {'번호': index, '이름': ' + '.join(item['parts']), '의상': item['의상'], '악세': item['악세'],
                     '표정': expressions, '상태': '검수후보' if all(s in expressions for s in EXPRESSIONS)
                     else ('표정준비중' if expressions else '미제작'), '출처': record}
            result['캐릭터'][char]['차림'][item['key']] = entry
    write_json(OUTPUT / '목록.json', result)
    return result


def check_faces(record, window, output_root=None):
    output_root = OUTPUT if output_root is None else output_root
    cuts = list(EXPRESSIONS.values())
    files = record['파일']
    if not all(c in files for c in cuts):
        return
    duplicate = [[a, b] for i, a in enumerate(cuts) for b in cuts[i+1:]
                 if files[a]['검사']['RGBA_sha256'] == files[b]['검사']['RGBA_sha256']]
    report = {'같은표정짝': duplicate, '한벌_동일변환': True}
    if window:
        k, dx, dy = (record['변환'][v] for v in ['k', 'dx', 'dy'])
        x0, y0, x1, y1 = window['상자']
        # Lanczos의 유한한 필터 범위만 추가한다. 눈 밖을 넓게 숨기는 임의 마스크가 아니다.
        box = [max(0, math.floor(x0*k+dx)-3), max(0, math.floor(y0*k+dy)-3),
               min(SIZE, math.ceil(x1*k+dx)+3), min(SIZE, math.ceil(y1*k+dy)+3)]
        with Image.open(output_root / files['본체']['결과']) as im:
            base = np.asarray(im.convert('RGBA'))
        outside = np.ones((SIZE, SIZE), dtype=bool)
        outside[box[1]:box[3], box[0]:box[2]] = False
        differences = []
        for cut in cuts[1:]:
            with Image.open(output_root / files[cut]['결과']) as im:
                arr = np.asarray(im.convert('RGBA'))
            # 완전 투명한 화소의 숨은 RGB는 화면의 차이가 아니다. 알파는 따로 전량 비교한다.
            changed = ((arr != base).any(axis=2) & ((arr[..., 3] > 0) | (base[..., 3] > 0)))
            magnitude = np.abs(arr.astype(np.int16)-base.astype(np.int16)).max(axis=2)
            selected = changed & outside
            differences.append({'표정': cut, '창밖_보이는RGBA다른픽셀': int((changed & outside).sum()),
                                '창밖_알파다른픽셀': int(((arr[..., 3] != base[..., 3]) & outside).sum()),
                                '창밖_최대채널차이': int(magnitude[selected].max()) if selected.any() else 0,
                                '창밖_채널차이2초과픽셀': int((selected & (magnitude > 2)).sum())})
        report.update({'창기록': window, '파생창': box, '창밖비교': differences})
    else:
        report['창밖비교'] = '미검사 — 해당 차림의 눈 창 작업기록 없음'
    record['표정검사'] = report


def bake_frames(record, item, cuts, transform, anchor_size, fitter, input_dir, output_root, reuse=False, result_folder='까몽'):
    for cut in cuts:
        source = source_files(item, input_dir)[cut]
        source_hash = sha(source)
        result_path = f"{result_folder}/{item['key']}_{cut}.webp"
        dest = output_root/result_path
        old = record['파일'].get(cut, {})
        if reuse and reusable_file(old, source, source_hash, dest):
            continue
        with Image.open(source) as im:
            image = im.convert('RGBA')
        if list(image.size) != list(anchor_size):
            raise ValueError(f"{item['key']}/{cut}: 기준과 표정 원본 크기가 다름")
        derived, cropped = derive_rgba(image, transform, compositor=fitter.투명틀에앉히기)
        checks = encode_checked(derived, dest)
        checks.update(cropped)
        record['파일'][cut] = {'원본': relative(source), '원본_sha256': source_hash,
            '원본크기': list(image.size), '결과': result_path,
            '결과_sha256': sha(dest), 'bytes': dest.stat().st_size, '검사': checks}
        image.close(); derived.close()


class CandidateRecoveryError(RuntimeError):
    pass


def install_file(source, destination):
    source.replace(destination)


def commit_candidate(stage, record, data):
    """8컷 버전 폴더를 먼저 확정하고 목록만 교체한다. 이전 이미지 경로는 건드리지 않는다."""
    version = Path(record['버전경로'])
    destination = OUTPUT/version
    destination.resolve().relative_to(OUTPUT.resolve())
    if destination.exists():
        raise ValueError('이미 존재하는 후보 버전은 덮어쓰지 않는다: '+str(destination))
    record_file, manifest_file = record_path(record['key']), OUTPUT/'목록.json'
    backup = stage/'_이전'
    backup.mkdir()
    saved = {}
    for index, target in enumerate([record_file, manifest_file]):
        target.resolve().relative_to(OUTPUT.resolve())
        target.parent.mkdir(parents=True, exist_ok=True)
        saved[target] = backup/str(index) if target.is_file() else None
        if saved[target] is not None:
            shutil.copy2(target, saved[target])

    def restore(target):
        if saved[target] is None:
            target.unlink(missing_ok=True)
        else:
            saved[target].replace(target)

    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        install_file(stage/version, destination)
        write_json(record_file, record)
        manifest(data)
    except BaseException as failure:
        rollback_errors = []
        for target in [record_file, manifest_file]:
            try:
                restore(target)
            except OSError as error:
                rollback_errors.append(f'{target.name}: {error}')
        if rollback_errors:
            raise CandidateRecoveryError(f'후보 복원 미완료. 백업 보존: {backup}; '+', '.join(rollback_errors)) from failure
        raise


def bake_candidate(record, item, transform, anchor_size, fitter, input_dir, window, data):
    stage = Path(tempfile.mkdtemp(prefix='.차림후보-', dir=OUTPUT))
    preserve_backup = False
    try:
        version = f"까몽/_후보/{item['key']}/{uuid.uuid4().hex[:16]}"
        record['버전경로'] = version
        bake_frames(record, item, list(EXPRESSIONS.values()), transform, anchor_size, fitter, input_dir, stage, result_folder=version)
        check_faces(record, window, stage)
        commit_candidate(stage, record, data)
    except CandidateRecoveryError:
        preserve_backup = True
        raise
    finally:
        if not preserve_backup:
            stage.resolve().relative_to(OUTPUT.resolve())
            shutil.rmtree(stage)


def make_contacts(current):
    entries = [(key, entry) for key, entry in current['캐릭터']['까몽']['차림'].items()
               if '기본' in entry['표정']]
    if not entries:
        return []
    palette = {v['이름']: v['hex'] for v in json.loads((ROOT/'docs/디자인_토큰.json').read_text(encoding='utf-8'))['색']['킷']}
    regular = ImageFont.truetype(str(ROOT/'docs/브랜드_폰트/SUIT/SUIT-Medium.otf'), 20)
    heading = ImageFont.truetype(str(ROOT/'docs/브랜드_폰트/SUIT/SUIT-ExtraBold.otf'), 32)
    pages, start = math.ceil(len(entries)/16), 0
    output = []
    PROOFS.mkdir(parents=True, exist_ok=True)
    for page in range(pages):
        count = math.ceil((len(entries)-start)/(pages-page))
        selected = entries[start:start+count]
        rows, cell, gap, margin = math.ceil(count/4), 304, 16, 24
        sheet = Image.new('RGB', (margin*2+4*cell+3*gap, 104+rows*376), palette['Paper'])
        draw = ImageDraw.Draw(sheet)
        draw.text((margin, 20), f'까몽 라디오 차림  {page+1:02d} / {pages:02d}', font=heading, fill=palette['Ink'])
        draw.text((margin, 64), '기존 그림의 검수 후보 · 1024 파생본 · 번호로 지적할 수 있습니다', font=regular, fill=palette['Deep Wool'])
        for i, (key, entry) in enumerate(selected):
            x, y = margin+(i%4)*(cell+gap), 104+(i//4)*376
            frame = Image.new('RGBA', (cell, cell), palette['Oat'])
            with Image.open(OUTPUT/entry['표정']['기본']) as image:
                frame.alpha_composite(image.convert('RGBA').resize((cell, cell), Image.Resampling.LANCZOS))
            sheet.paste(frame.convert('RGB'), (x, y))
            label = f"{entry['번호']:03d}  {entry['이름']}"
            lines, line = [], ''
            for character in label:
                if draw.textlength(line+character, font=regular) > cell:
                    lines.append(line); line = character
                else:
                    line += character
            lines.append(line)
            for li, line in enumerate(lines):
                draw.text((x, y+cell+8+li*26), line, font=regular, fill=palette['Ink'])
            if len(lines) > 2:
                raise ValueError(f'연락판 이름이 두 줄을 넘음: {label}')
        path = PROOFS/f'까몽_129차림_{page+1:02d}.png'
        sheet.save(path)
        output.append({'파일': relative(path), '번호': [v['번호'] for _, v in selected], '차림': [k for k, _ in selected]})
        start += count
    write_json(PROOFS/'연락판목록.json', output)
    return output


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--목록만', action='store_true')
    parser.add_argument('--검사만', action='store_true', help='인코딩 없이 기존 파생본의 표정 차이와 입력 경계 접촉을 재검사')
    parser.add_argument('--본체만', action='store_true')
    parser.add_argument('--차림', help='기존 공백 없는 옷토막. 여러 차림은 쉼표로 구분')
    parser.add_argument('--입력', help='선택한 한 차림의 후보 PNG 폴더. 기존 파일명·8표정·기준 크기를 유지하며 원본은 덮지 않음')
    args = parser.parse_args(argv)
    input_dir = None
    if args.입력:
        if not args.차림 or ',' in args.차림:
            parser.error('--입력은 --차림으로 한 차림을 선택해야 한다')
        if args.목록만 or args.검사만 or args.본체만:
            parser.error('--입력은 실제 파생 실행에만 사용한다. 기존 결과 검사는 --검사만으로 실행한다')
        input_dir = (ROOT / args.입력).resolve()
        try:
            input_dir.relative_to(ROOT.resolve())
        except ValueError:
            parser.error('--입력은 현재 저장소 안의 후보 폴더여야 한다')
        if not input_dir.is_dir():
            parser.error('--입력 폴더가 없다: '+str(input_dir))
    data = catalog()
    items = data['까몽']['차림']
    if args.차림:
        requested = set(args.차림.split(','))
        unknown = requested - {v['key'] for v in items}
        if unknown:
            parser.error('정본 목록에 없는 차림: '+', '.join(sorted(unknown)))
        items = [v for v in items if v['key'] in requested]
    OUTPUT.mkdir(parents=True, exist_ok=True)
    if args.목록만:
        current = manifest(data)
        print(json.dumps({c: len(v['차림']) for c, v in current['캐릭터'].items()}, ensure_ascii=False), flush=True)
        return
    if args.검사만:
        windows = source_windows()
        rows = []
        for item in items:
            path = record_path(item['key'])
            if not path.is_file():
                continue
            record = json.loads(path.read_text(encoding='utf-8'))
            base = record.get('파일', {}).get('본체')
            if not base:
                continue
            with Image.open(ROOT / base['원본']) as im:
                edges = source_edges(im.convert('RGBA'))
            record['입력본체_경계접촉'] = {'알파128초과': edges,
                '뜻': '원본에서부터 프레임에 닿는 화소. 새 파생 잘림과 별개이며 시각 확인 전에는 잘림 확정 아님.'}
            check_faces(record, windows.get(item['key']))
            write_json(path, record)
            rows.append({'차림': item['key'], '원본': base['원본'], '원본_경계': edges,
                         '파생_잘림': base['검사']['알파128초과_잘린픽셀'],
                         '표정검사': record.get('표정검사', {})})
        manifest(data)
        report_path = PROOFS/'상세자산검사.json'
        if args.차림 and report_path.is_file():
            previous = json.loads(report_path.read_text(encoding='utf-8'))
            rows = merge_inspection_rows(previous.get('차림', []), rows)
        result = {'검사차림': len(rows), '원본경계접촉차림': [r['차림'] for r in rows if any(r['원본_경계'].values())],
                  '주의': '원본 접촉과 시각 잘림, 채널 미세차이와 눈 밖 변경을 동일 판정하지 않음. 시각 합격은 별도.', '차림': rows}
        write_json(report_path, result)
        print(json.dumps({k: v for k, v in result.items() if k != '차림'}, ensure_ascii=False, indent=2), flush=True)
        return
    fitter = load_module('옷틀맞추기')
    ruler = fitter.정본자('까몽')
    windows = source_windows()
    transforms = {}
    # 전체 입력을 먼저 확인한다. 없는 표정을 다른 표정으로 몰래 대체하지 않는다.
    for item in items:
        anchor_size = None
        if input_dir is not None:
            with Image.open(find_anchor(item['key'])) as im:
                anchor_size = im.size
        validate_source_set(item, input_dir, anchor_size)
    phases = [['본체']] if args.본체만 else [['본체'], [v for v in EXPRESSIONS.values() if v != '본체']]
    if input_dir is not None and not args.본체만:
        phases = [list(EXPRESSIONS.values())]  # 후보 8표정을 한 번에 기록해 기존 표정과 섞여 준비 완료로 보이지 않게 한다.
    for phase, cuts in enumerate(phases, 1):
        for number, item in enumerate(items, 1):
            key = item['key']
            anchor = find_anchor(key)
            anchor_hash = sha(anchor)
            if key not in transforms:
                transform = fitter.맞춤값(str(anchor), ruler, SIZE)
                if transform is None:
                    raise ValueError(f'{key}: 두 눈 등록 실패 — 장마다 재거나 몸폭으로 대체하지 않음')
                transforms[key] = transform
            transform = transforms[key]
            with Image.open(anchor) as im:
                anchor_size = list(im.size)
            path = record_path(key)
            record = json.loads(path.read_text(encoding='utf-8')) if path.is_file() else {'파일': {}}
            input_label = relative(source_files(item, input_dir)['본체'].parent)
            same = (record.get('변환') == transform and record.get('기준_sha256') == anchor_hash
                    and record.get('방식') == PIPELINE
                    and record.get('입력폴더', 'docs/Loom_자산/옷/GPT_표정_누끼') == input_label)
            if not same:
                record = {'파일': {}}
            record.update({'key': key, '방식': PIPELINE, '변환': transform, '출력크기': [SIZE, SIZE],
                           '입력폴더': input_label, '입력갈래': '별도 후보' if input_dir is not None else '기존 표정 누끼',
                           '기준': relative(anchor), '기준_sha256': anchor_hash, '기준크기': anchor_size,
                           '정본': relative(ROOT/'docs/캐릭터/정본_4K/까몽_본체.png'),
                           '정본_sha256': sha(ROOT/'docs/캐릭터/정본_4K/까몽_본체.png'),
                           '합성': '수정된 옷틀맞추기.투명틀에앉히기; 원본 RGBA→Lanczos 1회→빈판에 mask 없이 복사',
                           '새생성': False, '모델': '과거 GPT 결과 재사용. 2.5로 소급 표시하지 않음'})
            if input_dir is not None:
                bake_candidate(record, item, transform, anchor_size, fitter, input_dir, windows.get(key), data)
            else:
                bake_frames(record, item, cuts, transform, anchor_size, fitter, input_dir, OUTPUT, same)
                check_faces(record, windows.get(key))
                write_json(path, record)
            if number % 8 == 0 or number == len(items):
                manifest(data)
                print(f'phase {phase}/{len(phases)} · {number}/{len(items)} · {key}', flush=True)
        current = manifest(data)
        if phase == 1:
            sheets = make_contacts(current)
            print(f'본체 연락판 {len(sheets)}장 준비 완료', flush=True)
    current = manifest(data)
    ready = [v for v in current['캐릭터']['까몽']['차림'].values() if v['상태'] == '검수후보']
    files = [r for v in current['캐릭터']['까몽']['차림'].values() for r in v['출처'].get('파일', {}).values()]
    summary = {'차림총수': len(current['캐릭터']['까몽']['차림']), '8표정준비': len(ready), '파생파일': len(files),
               '합계bytes': sum(v['bytes'] for v in files),
               '잘림알파128초과파일': sum(v['검사']['알파128초과_잘린픽셀'] > 0 for v in files),
               '동일표정짝있는차림': [v['이름'] for v in ready if v['출처'].get('표정검사', {}).get('같은표정짝')],
               '몽글마린통합세트': '없음 — 임의 합성·채택 안 함', '시각합격': '별도 실물 검수 필요'}
    write_json(PROOFS/'파생검사.json', summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')
    main()

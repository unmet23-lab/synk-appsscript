"""Unicode-safe upload bundles, with a full read-back and per-entry SHA-256 check."""
from pathlib import Path
import hashlib
import html
import json
import shutil
import sys
import zipfile

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
BASE = Path(__file__).resolve().parent

def digest(data):
    return hashlib.sha256(data).hexdigest()

def main():
    audit = json.loads((BASE / '_검토' / '납품실물검증.json').read_text(encoding='utf-8'))
    if audit['status'] != 'pass' or audit['accounts'] != 19 or audit['videos'] != 7:
        raise RuntimeError('All 19 current packages and 7 movies must pass the artifact audit first')
    items = json.loads((BASE / '콘텐츠원고.json').read_text(encoding='utf-8'))['items']
    common = {}
    for folder in ['assets', 'resources']:
        for p in (BASE / folder).rglob('*'):
            if p.is_file() and p.suffix.lower() in {'.png', '.jpg', '.webp', '.svg', '.html', '.md', '.pdf'}:
                common[p.relative_to(BASE).as_posix()] = p.read_bytes()
    common['edition.css'] = (BASE / 'edition.css').read_bytes()
    for name in ['납품실물검증.json', '배경음악.json', '최신정본대조.json', '영상최종실물검수.md', '정적실물최종검수.md', '저장공간_중단기록.json', '음량검증.json', 'video/전체영상검증.json', '영상최종_파일독립대조.json', '01-음성수정/최종영상수정검증.json', '01-음성수정/applied-voice.json', '01-표정편집엔딩/입력변경.json', '01-표정편집엔딩/최종검증.json', '01-표정편집엔딩/통합검증.json']:
        common['_검토/' + name] = (BASE / '_검토' / name).read_bytes()
    outputs = []
    for name in ['로고반영/최종검증.json', '로고반영/납품반영.json', '로고반영/자산동기화.json']:
        common['_검토/' + name] = (BASE / '_검토' / name).read_bytes()
    for name in ['독립최종/몽글-합성-독립대조.json', '독립최종/몽글-합성-v2-635-독립검수.png', '독립최종/01v3-part1-독립대조.json', '독립최종/01v3-최종통합-독립대조.json', '01-표정편집엔딩/독립음성검증.json']:
        common['_검토/' + name] = (BASE / '_검토' / name).read_bytes()
    groups = [('전체', items)]
    if '--company-bundles' in sys.argv:
        groups += [(brand, [i for i in items if i['brand'] == brand]) for brand in ['LAB', 'SHIFT', 'SYNK']]
    for group, selected in groups:
        entries = dict(common)
        for item in selected:
            directory = BASE / item['id']
            for p in directory.iterdir():
                if not p.is_file() or p.name.startswith('master-') or 'thumbnail-master' in p.name:
                    continue
                if p.suffix.lower() in {'.jpg', '.png', '.mp4', '.wav', '.srt', '.vtt', '.txt', '.md', '.html', '.pdf', '.json'}:
                    entries[p.relative_to(BASE).as_posix()] = p.read_bytes()
        if group == '전체':
            for name in ['index.html', '타겟과플랫폼.html', '읽어주세요.md', '회사별_첫게시물보고.md', '검증결과.md', '콘텐츠원고.json']:
                entries[name] = (BASE / name).read_bytes()
        else:
            cards = ''.join(f'<article class="entry"><a href="{i["id"]}/index.html"><img src="{i["id"]}/upload-01.jpg" alt="{html.escape(i["title"], quote=True)}"></a><p class="meta">{html.escape(i["platform"])} · {html.escape(i["account"])}</p><h3>{html.escape(i["title"])}</h3><p>{html.escape(i["promise"])}</p><a class="button" href="{i["id"]}/index.html">게시물과 사용 안내</a></article>' for i in selected)
            page = f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK {group} 첫 게시물</title><link rel="stylesheet" href="edition.css"></head><body class="first-edition"><main class="sheet"><p class="eyebrow">FIRST EDITION / 2026.09.10</p><h1>{group} · 첫 만남 {len(selected)}개</h1><p>19개 첫 게시물 가운데 이 꾸러미에 해당하는 계정입니다. 파일을 전부 압축 해제한 뒤 index.html을 여세요. SNS에는 각 폴더의 업로드안내에 적힌 파일과 게시문안을 사용합니다.</p><div class="grid">{cards}</div></main></body></html>'
            entries['index.html'] = page.encode('utf-8')
            entries['읽어주세요.md'] = f'# {group} 첫 게시물\n\n전체 19개 계정 가운데 {len(selected)}개를 담았습니다.\n\n압축을 해제한 뒤 index.html을 여세요. 각 계정의 업로드안내.md와 게시문안.txt를 함께 사용합니다. 실제 SNS 게시와 새 계정 개설은 수행하지 않았습니다.\n'.encode('utf-8')
        # Gallery buttons may offer bundles. The archive is deliberately not nested in itself.
        if group == '전체':
            page = entries['index.html'].decode('utf-8')
            import re
            page = re.sub(r'<a\b[^>]*href="[^"]*\.zip"[^>]*>.*?</a>', '', page)
            entries['index.html'] = page.encode('utf-8')
        index = [{'path': name, 'bytes': len(data), 'sha256': digest(data)} for name, data in sorted(entries.items())]
        entries['파일목록.json'] = json.dumps({'group': group, 'accounts': [i['id'] for i in selected], 'files': index}, ensure_ascii=False, indent=2).encode('utf-8')
        target = BASE / (group + '_업로드.zip')
        temp = target.with_suffix('.partial.zip')
        required_space = sum(len(data) for data in entries.values()) + 32 * 1024 * 1024
        available_space = shutil.disk_usage(BASE).free
        if available_space < required_space:
            raise RuntimeError(f'ZIP needs up to {required_space:,} bytes; {available_space:,} bytes free. Existing deliverables are preserved.')
        with zipfile.ZipFile(temp, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=5) as archive:
            for name, data in sorted(entries.items()):
                archive.writestr(name, data, compress_type=zipfile.ZIP_STORED if name.endswith(('.mp4', '.jpg', '.png', '.pdf', '.webp')) else zipfile.ZIP_DEFLATED)
        with zipfile.ZipFile(temp, 'r') as archive:
            if set(archive.namelist()) != set(entries):
                raise RuntimeError('ZIP names mismatch')
            for name, data in entries.items():
                if digest(archive.read(name)) != digest(data):
                    raise RuntimeError('ZIP round-trip mismatch: ' + name)
            if archive.testzip() is not None:
                raise RuntimeError('ZIP CRC error')
        temp.replace(target)
        outputs.append({'file': target.name, 'accounts': len(selected), 'entries': len(entries), 'bytes': target.stat().st_size, 'sha256': digest(target.read_bytes()), 'unicodeNamesPreserved': True, 'allEntriesHashChecked': True})
        print(json.dumps(outputs[-1], ensure_ascii=False), flush=True)
    (BASE / '_검토' / '압축검증.json').write_text(json.dumps(outputs, ensure_ascii=False, indent=2), encoding='utf-8')

if __name__ == '__main__':
    main()

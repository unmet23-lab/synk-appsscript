"""Read ZIP member names and export index only. No extraction, editing, or repackaging."""
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import zipfile

review = Path(__file__).resolve().parent
bundle = review.parent
archive_path = bundle.parent / f'{bundle.name}_업로드꾸러미.zip'
video_report = json.loads((review / '영상_독립지문.json').read_text(encoding='utf-8'))
prefix = bundle.name + '/'
with zipfile.ZipFile(archive_path, 'r') as archive:
    names = archive.namelist()
    records = archive.infolist()
    index = json.loads(archive.read(prefix + '출고목록.json'))
    relative = [name.removeprefix(prefix) for name in names]
    metadata = {entry['path']: entry for entry in index['files']}
    video_items = [name for name in relative if name.endswith('.mp4')]
    bad = [name for name in relative if name.endswith('.zip') or re.search(r'(?:^|/)(?:_runtime|node_modules|__pycache__)(?:/|$)|\.wav$|전사.*\.json$|생성.*(?:json|log)$|job.*\.json$', name, re.I)]
    mismatches = [video['file'] for video in video_report['results'] if metadata.get(prefix + video['file'], {}).get('exportSha256') != video['videoSha256']]
    out = {
        'method': 'ZIP 이름 목록과 출고목록만 읽음. 압축 해제·재출고 없음. 멤버 실제 SHA 전량 재계산 검사를 대체하지 않음.',
        'archive': archive_path.name,
        'members': len(names),
        'indexMembers': len(index['files']),
        'videoCount': len(video_items),
        'uploadJpgCount': len([name for name in relative if re.search(r'/upload-\d{2}\.jpg$', name)]),
        'accountCoverJpgCount': len([name for name in relative if re.search(r'^\d{2}-[^/]+/cover\.jpg$', name)]),
        'longVideoPosters': [name for name in relative if name in {'공개수업/표지.jpg','공개수업/클리닉-표지.jpg'}],
        'forbiddenMembers': bad,
        'duplicateNames': len(names) - len(set(names)),
        'windowsNameCollisions': len(names) - len({unicodedata.normalize('NFC', name).casefold() for name in names}),
        'unicodeNamesWithoutUtf8Flag': [entry.filename for entry in records if any(ord(char) > 127 for char in entry.filename) and not entry.flag_bits & 0x800],
        'videoIndexHashMismatches': mismatches,
    }
    assert len(video_items) == 9 and out['uploadJpgCount'] == 29 and len(out['longVideoPosters']) == 2
    assert not bad and not mismatches and not out['duplicateNames'] and not out['windowsNameCollisions'] and not out['unicodeNamesWithoutUtf8Flag']
out['passed'] = True
(review / '꾸러미_독립대조.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(out, ensure_ascii=False, indent=2))

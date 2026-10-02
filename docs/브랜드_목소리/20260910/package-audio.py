from pathlib import Path
import hashlib
import json
import zipfile

base = Path(__file__).resolve().parent
data = json.loads((base / 'data.json').read_text(encoding='utf-8'))
target = base / '음원_10개.zip'
staging = base / '음원_10개.pending.zip'
guide = '''SYNK 브랜드 목소리 비교 · 2026-09-10

동일 대본으로 만든 합성음성 10개입니다. 번호는 품질 순위가 아닙니다.
먼저 마음에 남는 목소리를 듣고, 후보 번호 한두 개를 알려주세요.
음량만 약 -23 LUFS로 맞췄습니다. EQ·잡음 제거·속도 변경·업샘플링은 하지 않았습니다.
가장 편안한 재생 음량으로 비교해주세요.

대본: 같이 들어볼까요? 좋아요, 이번에는 조금 다르게 해볼게요. 작은 차이가 모이면, 우리만의 목소리가 돼요.

전체 조사와 청취 페이지는 원래 받은 로컬 링크에서 볼 수 있습니다.
이 ZIP에는 음원과 후보 기록만 들어 있습니다. 브랜드 목소리 채택 전 비교본입니다.
'''
files = {}
records = []
with zipfile.ZipFile(staging, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    z.writestr('비교안내.txt', guide.encode('utf-8'))
    for i, sample in enumerate(data['samples'], 1):
        name = f'후보{i:02d}.wav'
        content = (base / sample['file']).read_bytes()
        actual = hashlib.sha256(content).hexdigest()
        if actual != sample['listenSha256']:
            raise RuntimeError(f'Audio changed: {name}')
        files[name] = actual
        z.writestr(name, content)
        records.append({**sample, 'file': name})
    z.writestr('들은뒤_후보정보.json', json.dumps(records, ensure_ascii=False, indent=2).encode('utf-8'))
with zipfile.ZipFile(staging) as z:
    if z.testzip() is not None:
        raise RuntimeError('Invalid ZIP')
    for name, digest in files.items():
        if hashlib.sha256(z.read(name)).hexdigest() != digest:
            raise RuntimeError(f'ZIP roundtrip mismatch: {name}')
    names = z.namelist()
staging.replace(target)
result = {'file': str(target), 'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'entries': names, 'audioRoundtripSha256': files, 'status': 'passed'}
(base / '검증' / '음원ZIP검사.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'status': 'passed', 'audio': len(files), 'bytes': result['bytes'], 'sha256': result['sha256']}))

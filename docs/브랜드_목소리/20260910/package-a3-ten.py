"""Verify source/output audio independently and package the ten selected auditions."""
from pathlib import Path
from array import array
import hashlib
import io
import json
import math
import subprocess
import sys
import wave
import zipfile

BASE = Path(__file__).resolve().parent
OUT = BASE / 'A3_새후보_10개'
BASELINE_SHA = '86371ee78632a9ac4a6612509651d46211ce6386f2008c0d6199a27ea19d149b'
BASELINE_LISTEN_SHA = '540fd4c54a1f19a5a4e76063180f300b1c100fab86d9762221db650094dc057c'
EXPECTED = '같이 들어볼까요? 좋아요, 이번에는 조금 다르게 해볼게요. 작은 차이가 모이면, 우리만의 목소리가 돼요.'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def probe(path):
    result = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels,bits_per_sample:format=duration', '-of', 'json', str(path)], capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(result.stdout)

def timing(seconds):
    return f'{int(seconds // 60):02d}:{seconds % 60:05.2f}'

def rail_stats(path):
    with wave.open(str(path), 'rb') as source:
        assert source.getsampwidth() == 2
        values = array('h', source.readframes(source.getnframes()))
        if sys.byteorder != 'little':
            values.byteswap()
    count = longest = current = 0
    for value in values:
        if value >= 32767 or value <= -32768:
            count += 1
            current += 1
            longest = max(longest, current)
        else:
            current = 0
    return {'fullScaleSamples': count, 'longestFullScaleRunSamples': longest, 'maxAbsoluteAmplitude': max(abs(v) for v in values) / 32768, 'doesNotProveAbsenceOfAudibleDistortion': True}

recipes = json.loads((BASE / 'a3-ten-recipes.json').read_text(encoding='utf-8'))
assert recipes['text'] == EXPECTED
selected = [dict(item) for item in recipes['candidates']]
selected[0]['key'] = 'a3-ten-01-r2'
selected[8]['key'] = 'a3-ten-09-r2'
all_items = [{'number': 'A3', 'key': 'a-natural-flow', 'direction': '이전에 가장 선호한 기준', 'method': 'baseline'}] + selected
OUT.mkdir(exist_ok=True)
(OUT / '원본').mkdir(exist_ok=True)
checks = []
archive_files = {}
combined_frames = bytearray()
cue_rows = []
sample_format = None
cursor = 0

for index, item in enumerate(all_items):
    folder = BASE / '실험' / item['key']
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
    inspection = json.loads((folder / 'inspection.json').read_text(encoding='utf-8'))
    assert manifest['status'] == 'completed'
    assert inspection['expected'] == EXPECTED
    assert inspection['characterSimilarity'] == 1, (item['key'], inspection['actual'])
    raw = folder / 'raw.wav'
    listen = folder / 'listen.wav'
    raw_bytes, listen_bytes = raw.read_bytes(), listen.read_bytes()
    assert sha(raw_bytes) == manifest['sha256'] == inspection['rawSha256']
    assert sha(listen_bytes) == inspection['listenSha256']
    raw_probe, listen_probe = probe(raw), probe(listen)
    r, l = raw_probe['streams'][0], listen_probe['streams'][0]
    assert r['sample_rate'] == l['sample_rate'] == '24000'
    assert r['channels'] == l['channels'] == 1
    assert r['codec_name'] == 'pcm_s16le' and l['codec_name'] == 'pcm_s24le'
    assert raw_probe['format']['duration'] == listen_probe['format']['duration']
    duration = float(raw_probe['format']['duration'])
    assert math.isfinite(duration) and 6 < duration < 13
    assert abs(float(inspection['listenLoudness']['input_i']) + 23) < .1
    assert float(inspection['listenLoudness']['input_tp']) <= -3
    if index == 0:
        assert sha(raw_bytes) == BASELINE_SHA and sha(listen_bytes) == BASELINE_LISTEN_SHA
    rails = rail_stats(raw)
    assert rails['longestFullScaleRunSamples'] <= 2, (item['key'], rails)
    filename = '기준_A3.wav' if index == 0 else item['number'] + '.wav'
    raw_filename = '원본/' + filename
    (OUT / filename).write_bytes(listen_bytes)
    (OUT / raw_filename).write_bytes(raw_bytes)
    archive_files[filename] = listen_bytes
    archive_files[raw_filename] = raw_bytes
    with wave.open(io.BytesIO(listen_bytes), 'rb') as audio:
        this_format = (audio.getnchannels(), audio.getsampwidth(), audio.getframerate())
        if sample_format is None:
            sample_format = this_format
        assert this_format == sample_format
        frames = audio.readframes(audio.getnframes())
        start = cursor / sample_format[2]
        cue_rows.append({'number': item['number'], 'startSeconds': start, 'start': timing(start), 'duration': audio.getnframes()/sample_format[2], 'file': filename})
        combined_frames.extend(frames)
        cursor += audio.getnframes()
        if index < len(all_items)-1:
            gap = int(.8 * sample_format[2])
            combined_frames.extend(b'\x00' * gap * sample_format[0] * sample_format[1])
            cursor += gap
    checks.append({**item, 'file': filename, 'rawSha256': sha(raw_bytes), 'listenSha256': sha(listen_bytes), 'duration': duration, 'sampleRate': int(l['sample_rate']), 'LUFS': float(inspection['listenLoudness']['input_i']), 'truePeak': float(inspection['listenLoudness']['input_tp']), 'actual': inspection['actual'], 'characterSimilarity': inspection['characterSimilarity'], 'rawSignal': rails, 'nativeSampleRateAndDurationVerifiedFromBothFiles': True})

assert len(checks) == 11 and len({row['rawSha256'] for row in checks}) == 11
continuous = OUT / '한번에_듣기.wav'
with wave.open(str(continuous), 'wb') as audio:
    audio.setnchannels(sample_format[0])
    audio.setsampwidth(sample_format[1])
    audio.setframerate(sample_format[2])
    audio.writeframes(combined_frames)
with wave.open(str(continuous), 'rb') as audio:
    assert audio.getnframes() == cursor
    assert audio.readframes(audio.getnframes()) == combined_frames
archive_files['한번에_듣기.wav'] = continuous.read_bytes()

lines = [
    '# A3를 기준으로 만든 새 목소리 10개', '',
    '2026-09-10 · 가장 마음에 든 A3를 별도 기준으로 두고 새 후보 10개를 만들었습니다. 01~08은 비슷한 방향으로 새로 합성한 음색, 09~10은 A3의 음성을 참조해 다시 읽은 버전입니다. 실제 성우 10명의 녹음이나 확정된 브랜드 목소리는 아닙니다.', '',
    '## 듣는 방법', '',
    '`한번에_듣기.wav`는 기준 A3 → 새 01~10 순서입니다. 파일 사이에 0.8초 무음이 있으며, 번호를 읽는 목소리나 배경음은 넣지 않았습니다. 개별 파일은 번호가 이름입니다. `원본/`에는 음량을 조정하기 전 파일을 보관했습니다.', '',
    '| 순서 | 시작 | 길이 | 제작 방향 |', '|---|---:|---:|---|',
]
for item, cue in zip(checks, cue_rows):
    lines.append(f"| {item['number']} | {cue['start']} | {item['duration']:.2f}초 | {item['direction']} |")
lines.extend([
    '', '제작 방향은 요청한 연출이며, 청취 평가를 마친 음색 설명이나 순위가 아닙니다.', '',
    '## 비교 대본', '', EXPECTED, '',
    '## 품질 확인', '',
    '- 10개 모두 동일 대본으로 생성하고, 자동 받아쓰기에서 공백·문장부호를 제외한 대본 일치를 확인했습니다. 첫 01 시도는 대본에 없는 웃음이, 첫 09 시도는 불확실한 단어가 받아써져 제외하고 별도 파일로 다시 생성했습니다.',
    '- 원본 24kHz를 그대로 유지했습니다. 비교본은 일정한 음량 변화만 적용해 약 −23 LUFS로 맞췄습니다. 원본과 비교본의 길이·채널·샘플레이트·파일 해시를 각각 확인했습니다.',
    '- 원본의 최대치 연속 구간과 비교본의 최대 음량 여유를 검사했습니다. 이는 생성 음성에 거친 질감이나 발음 문제가 전혀 없다는 청취 판정을 뜻하지 않습니다.',
    '- WAV는 손실 압축을 추가하지 않는 형식입니다. 비교본을 24비트에 담은 것이 원본 16비트·24kHz의 실제 해상도를 높이지는 않습니다. 음높이·속도·잡음 제거·EQ·리버브는 변경하지 않았습니다.',
    '- 말끝이 작위적으로 들리는지, 자음·모음 연결이 기계적인지, A3보다 더 자연스러운지는 사용자 청취 확인이 남았습니다.', '',
    '## 사용 기준과 남은 일', '',
    '사용자 최신 선택인 A3와 현재 회사 운영 원칙을 기준으로 했습니다. 공급자는 공식 Qwen/Qwen3-TTS 공개 데모이며, 화자 설계는 /generate_voice_design, A3 참조는 Base 1.7B /generate_voice_clone을 사용했습니다. 업로드한 참조는 이 작업에서 합성한 A3이며 사람의 녹음은 아닙니다. Higgsfield 음성 생성은 사용하지 않았습니다.', '',
    'A3 선호를 최종 화자 승인으로 확대하지 않았습니다. 목소리 선정 후 LAB·최신 SHIFT 문장으로 재확인하고, 나머지 6편의 템포·음량·브랜드별 엔딩 제작을 재개합니다.', '',
    '생성 요청과 원본은 ../실험/a3-ten-*/manifest.json, 개별 검사 기록은 inspection.json, 묶음 검증은 ../검증/A3_새후보_10개_검사.json에 있습니다.', '',
])
guide = '\n'.join(lines)
(OUT / '비교안내.md').write_text(guide, encoding='utf-8')
archive_files['비교안내.md'] = guide.encode('utf-8')
cue_text = json.dumps(cue_rows, ensure_ascii=False, indent=2)
(OUT / '시작시간.json').write_text(cue_text, encoding='utf-8')
archive_files['시작시간.json'] = cue_text.encode('utf-8')

target = BASE / 'A3_새후보_10개.zip'
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name, content in archive_files.items():
        archive.writestr(name, content)
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(archive_files)
    for name, content in archive_files.items():
        assert archive.read(name) == content

record = {'status': 'file-signal-and-transcription-checks-passed', 'humanListening': False, 'naturalnessImprovementConfirmed': False, 'brandVoiceSelected': False, 'newAudioCount': 10, 'baselineCount': 1, 'excluded': [{'key': 'a3-ten-01', 'reason': 'An unrequested laugh appeared in automatic transcription; preserved outside the delivered pack.'}, {'key': 'a3-ten-09', 'reason': 'Automatic transcription did not match a word; excluded as uncertain, not a confirmed listening diagnosis.'}], 'samples': checks, 'continuous': {'file': str(continuous), 'sha256': sha(continuous.read_bytes()), 'duration': cursor/sample_format[2], 'gapSeconds': .8, 'exactPcmConcatenationVerified': True, 'cues': cue_rows}, 'zip': {'file': str(target), 'bytes': target.stat().st_size, 'sha256': sha(target.read_bytes()), 'roundTripVerified': True, 'entries': len(archive_files)}}
(BASE / '검증' / 'A3_새후보_10개_검사.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'status': record['status'], 'samples': [{'number': s['number'], 'duration': s['duration'], 'LUFS': s['LUFS'], 'railRun': s['rawSignal']['longestFullScaleRunSamples']} for s in checks], 'continuous': record['continuous'], 'zip': record['zip']}, ensure_ascii=True))

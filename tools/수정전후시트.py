"""수정 전후에 편집자가 대응시킨 구간당 여섯 순간을 같은 진척도에서 짝지어 그린다."""
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile
import uuid

from PIL import Image, ImageDraw, ImageFont


def interval(value):
    parts = value.split('~')
    if len(parts) != 2:
        raise ValueError('구간은 시작초~끝초로 씁니다.')
    start, end = map(Fraction, parts)
    if not 0 <= start < end:
        raise ValueError(f'시작과 끝을 확인하세요 ({value}).')
    return start, end


def correspondence(value):
    parts = value.split('=')
    if len(parts) not in (1, 2):
        raise ValueError('이전시작~끝=수정시작~끝 형식으로 씁니다.')
    return interval(parts[0]), interval(parts[-1])


def fingerprint(path):
    with Path(path).open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def stream(path):
    command = ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
               'stream=avg_frame_rate,time_base,start_pts,duration_ts:format=start_time',
               '-of', 'json', str(path)]
    metadata = json.loads(subprocess.check_output(command))
    video, = metadata['streams']
    # 검수의 0초는 재생 시작이다. 영상 트랙이 늦게 시작한 파일은 같은 프레임 번호가
    # 같은 재생 시각을 뜻하지 않아, 비교에서 빼고 기존 검수를 계속한다.
    if video.get('start_pts') != 0 or Fraction(metadata['format']['start_time']) != 0:
        raise ValueError('재생 시작과 영상 시작 시각이 모두 0초인 입력에서만 비교할 수 있습니다.')
    rate = Fraction(video['avg_frame_rate'])
    duration = int(video['duration_ts']) * Fraction(video['time_base'])
    if rate <= 0 or duration <= 0:
        raise ValueError('영상의 프레임률과 길이를 확인할 수 없습니다.')
    return rate, duration


def anchors(span, rate, duration):
    start, end = span
    if end > duration:
        raise ValueError(f'지정 끝 {float(end):g}초가 영상 길이 {float(duration):g}초를 넘습니다.')
    # 범위 양 끝을 넘지 않는 실제 프레임에서 여섯 등분의 중간 장을 고른다.
    first = math.ceil(start * rate)
    last = math.ceil(end * rate) - 1
    if last < first:
        raise ValueError('해당 구간에 프레임이 없습니다.')
    return [round(first + (last - first) * Fraction(2*i + 1, 12)) for i in range(6)]


def extract(path, numbers, dest, rate):
    dest.mkdir()
    frames = sorted(set(numbers))
    expr = '+'.join(f'eq(n\\,{n})' for n in frames)
    filtergraph = (f"select='{expr}',showinfo=checksum=0,"
                   "scale=540:960:force_original_aspect_ratio=decrease:force_divisible_by=2:"
                   "reset_sar=1:flags=lanczos,pad=540:960:(ow-iw)/2:(oh-ih)/2")
    cmd = ['ffmpeg', '-nostdin', '-hide_banner', '-nostats', '-loglevel', 'info', '-threads', '3',
           '-copyts', '-i', str(path), '-map', '0:v:0', '-an', '-vf', filtergraph, '-fps_mode', 'vfr',
           '-threads', '2', '-c:v', 'mjpeg', '-q:v', '2', str(dest/'%06d.jpg')]
    proc = subprocess.run(cmd, capture_output=True, encoding='utf8', errors='replace')
    if proc.returncode:
        raise RuntimeError('ffmpeg 프레임 추출 실패: ' + proc.stderr[-400:].strip())
    time_base = re.search(r'config in time_base:\s*(\d+/\d+)', proc.stderr)
    ticks = re.findall(r'\bn:\s*\d+\s+pts:\s*(-?\d+)\s+pts_time:', proc.stderr)
    files = sorted(dest.glob('*.jpg'))
    if not time_base or len(ticks) != len(frames) or len(files) != len(frames):
        raise ValueError('요청한 프레임 전체에서 실제 표시 시각을 확인할 수 없습니다.')
    unit = Fraction(time_base[1])
    samples = {}
    for n, timestamp, file in zip(frames, ticks, files):
        t = int(timestamp) * unit
        if abs(t - n / rate) > unit:
            raise ValueError('요청한 프레임 번호와 실제 표시 시각이 맞지 않습니다.')
        samples[n] = (file, t)
    return samples


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return None


def write_sheet(path, spans, tracks, labels):
    # 2열 × 3행. 각 칸은 전판과 수정판의 같은 장면을 나란히 보여 준다.
    sh = Image.new('RGB', (2176, 3096), '#14191d')
    draw = ImageDraw.Draw(sh)
    titlefont, textfont, ko = labels
    ranges = [f'{float(a)}–{float(b)}' for a, b in spans]
    title = (ranges[0] + ' → ' + ranges[1]) if ranges[0] != ranges[1] else ranges[0]
    draw.text((12, 8), title + ('초' if ko else ' s'), font=titlefont, fill='white')
    for i in range(6):
        x, y = (i % 2)*1088, 60 + (i // 2)*1010
        for side, label in enumerate(('수정 전', '수정 후') if ko else ('Before', 'After')):
            f, t = tracks[side][i]
            xx = x + side*542
            draw.text((xx+8, y+3), f'{label}   {float(t):05.2f}'+('초' if ko else ' s'),
                      font=textfont, fill='white')
            with Image.open(f) as image:
                sh.paste(image, (xx, y+40))
    sh.save(path, quality=93, subsampling=0)


def create(before, after, ranges, out, expected_hash=None, expected_after=None):
    """구간의 양쪽 장면이 대응하는지는 호출자가 확인한다. 자동으로 같은 컷을 추측하지 않는다."""
    if not before or not ranges:
        raise ValueError('--비교전과 --비교구간을 함께 지정하세요.')
    spans = [correspondence(item) for item in ranges]
    paths = [Path(before).resolve(), Path(after).resolve()]
    hashes = [fingerprint(p) for p in paths]
    if expected_after and hashes[1] != expected_after:
        raise ValueError('기본 묶음을 만들기 시작했을 때와 수정판 SHA-256이 다릅니다.')
    if expected_hash and hashes[0] != expected_hash.strip().lower():
        raise ValueError('이전 영상 SHA-256이 지정한 검수 기록과 다릅니다.')
    if hashes[0] == hashes[1]:
        raise ValueError('전판과 수정판의 파일이 같습니다.')
    out = Path(out)
    name = 'compare_' + uuid.uuid4().hex[:16]
    with tempfile.TemporaryDirectory(dir=out) as work:
        work = Path(work)
        sheets = work/'sheets'
        sheets.mkdir()
        tracks = []
        for idx, path in enumerate(paths):
            rate, duration = stream(path)
            groups = [anchors(pair[idx], rate, duration) for pair in spans]
            samples = extract(path, [n for group in groups for n in group], work/str(idx), rate)
            tracks.append([[samples[n] for n in group] for group in groups])
        title = font('C:/Windows/Fonts/malgun.ttf', 34)
        small = font('C:/Windows/Fonts/malgun.ttf', 23)
        labels = (title or font('DejaVuSans.ttf', 34) or ImageFont.load_default(),
                  small or font('DejaVuSans.ttf', 23) or ImageFont.load_default(), bool(title and small))
        manifest = {'before_sha256': hashes[0], 'after_sha256': hashes[1], 'sections': []}
        for i, (pair, a, b) in enumerate(zip(spans, *tracks), 1):
            filename = f'cut_{i:02d}.jpg'
            write_sheet(sheets/filename, pair, (a, b), labels)
            manifest['sections'].append({'file': filename, 'mapping': ranges[i-1],
                                         'time_seconds': [[float(x[1]),float(y[1])] for x,y in zip(a,b)]})
        if [fingerprint(p) for p in paths] != hashes:
            raise ValueError('자료를 만드는 도중 원본 영상이 바뀌었습니다.')
        (sheets/'source.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
        sheets.rename(out/name)
    return [f"{name}/{row['file']}" for row in manifest['sections']]

"""Mux the visual render with the approved-voice edit, inspect outputs, package."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
DURATION = 29.4

def run(args):
    p = subprocess.run([str(x) for x in args], capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode('utf-8', errors='replace'))
    return p.stdout.decode('utf-8', errors='replace'), p.stderr.decode('utf-8', errors='replace')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    video = OUT / 'video.mp4'
    run(['ffmpeg', '-y', '-v', 'error', '-i', OUT / 'render-muted.mp4', '-i', OUT / 'audio/master.wav',
         '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
         '-ar', '48000', '-ac', '2', '-t', str(DURATION), '-movflags', '+faststart', video])
    stdout, _ = run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', video])
    probe = json.loads(stdout)
    v = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    a = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
    assert (v['width'], v['height']) == (1080, 1920)
    assert v['r_frame_rate'] == '30/1' and int(v['nb_frames']) == 882
    assert abs(float(probe['format']['duration']) - DURATION) < .001
    assert a['sample_rate'] == '48000' and a['channels'] == 2
    run(['ffmpeg', '-v', 'error', '-xerror', '-i', video, '-f', 'null', '-'])
    _, loudness = run(['ffmpeg', '-hide_banner', '-i', video, '-af',
                       'loudnorm=I=-23:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'])
    meter = json.loads(re.findall(r'\{[^{}]*"input_i"[^{}]*\}', loudness, re.S)[-1])
    assert float(meter['input_tp']) < -1
    qa = OUT / '검토'
    qa.mkdir(exist_ok=True)
    frame_map = {'01_소개': 90, '02_실제작업': 218, '03_철학': 370,
                 '04_가져갈방법': 642, '05_계정의가치': 726, '06_엔딩': 818,
                 '07_마지막': 881, '00_첫순간': 15}
    for name, frame in frame_map.items():
        run(['ffmpeg', '-y', '-v', 'error', '-ss', str(frame / 30), '-i', video,
             '-frames:v', '1', '-vf', 'scale=360:640', qa / f'{name}.png'])
    values = '+'.join(f'eq(n,{n})' for n in [90, 218, 370, 642, 726, 818])
    run(['ffmpeg', '-y', '-v', 'error', '-i', video, '-vf',
         f"select='{values}',scale=360:640,tile=3x2", '-frames:v', '1', qa / '전체_장면.jpg'])
    result = {'revision': 'plain-language-v2', 'durationSeconds': DURATION, 'resolution': [v['width'], v['height']],
              'fps': 30, 'frames': int(v['nb_frames']), 'videoCodec': v['codec_name'],
              'audioCodec': a['codec_name'], 'audioSampleRate': 48000, 'audioChannels': 2,
              'integratedLufs': float(meter['input_i']), 'truePeakDbtp': float(meter['input_tp']),
              'fullDecodePassed': True, 'audioEncodedOnceFromPcm': True,
              'filmSha256': sha(video), 'approvedMusicUnchanged':
              sha(OUT / 'audio/bed.wav') == sha(OUT / '_이전_문구v1/bed.wav') ==
              '0c58485b9b973b2dfc6d1bba00eb8310f20a99b56b183c488baf79467c4f0b26',
              'voiceIntroSeconds': 4.88, 'originalApprovedFilmUnchanged':
              sha(ROOT / 'docs/홍보물/첫게시물_20260910/_실험/수노_임시남성_01/video_17.2초.mp4') ==
              '345283d20b41fa48dfc056b264cf702e236f1e71799d806dfb0482a63069f9ec',
              'visualReview': 'Review extracted frames after generation.',
              'audioListening': 'Direct model listening unavailable; prior user-approved voice reused. See audio-audit.json.',
              'socialPublishing': 'Not requested; not performed.'}
    (OUT / '검사.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    shutil.copyfile(video, OUT / 'video_쉬운설명.mp4')
    assert sha(OUT / 'video_쉬운설명.mp4') == sha(video)
    bundle = OUT / 'SHIFT_첫게시물_업로드.zip'
    files = [video, OUT / 'cover.png', OUT / '업로드문안.txt']
    with zipfile.ZipFile(bundle, 'w', zipfile.ZIP_DEFLATED, compresslevel=4) as z:
        for p in files:
            z.write(p, p.name)
    with zipfile.ZipFile(bundle) as z:
        assert z.testzip() is None
        for p in files:
            assert hashlib.sha256(z.read(p.name)).hexdigest() == sha(p)
    print(json.dumps({**result, 'verifiedZip': str(bundle), 'zipBytes': bundle.stat().st_size}, ensure_ascii=False))

if __name__ == '__main__':
    main()

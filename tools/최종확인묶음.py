# -*- coding: utf-8 -*-
"""최종 확인 묶음 — SNS 최종본 하나로 컷 전수 검수에 쓸 그림 · 소리 자료와 맥락 없는 독립 검수 지시문을 만든다(11-15).

  python -I -X utf8 tools/최종확인묶음.py <최종본.mp4> --out <폴더> [--ref <승인 얼굴.jpg>] [--up <올리기판.mp4>] [--skip-stt]

왜: 11-11~14 최종 확인 세션은 이 일을 세션 임시 폴더의 스크립트(review.py)로 했다. 그 세션이 멈추자 아무도 같은 묶음을 만들 수 없었다.
11-15 유호님 「예약으로 바꿔」 — 최종 확인을 예약 작업(synk-sns-final-check)이 하므로 묶음 도구를 저장소에 둔다.

만드는 것(--out 폴더):
  최종본검사.json      tools/최종본검사.py 결과(사람 굳음 · 같은 판 · 되풀이 · 끝 소리 · 끝 화소)
  sheet_N.jpg         0.5초마다 한 장(60장씩)
  m8_NN.jpg           1/8초 띠(한 장에 8초)
  cuts_N.jpg          컷 경계 앞 · 뒤 장
  z/f_<초>.jpg        컷마다 가운데 한 장(원화질의 절반)
  faces.jpg           0.5초마다 잡힌 얼굴과 기계가 묶은 무리(같은 사람 선 0.36). --ref면 승인 얼굴과 대조
  top.jpg · bot.jpg   1초마다 위 420px(빨간 줄 = 269px 안전선) · 아래 560px(앱 캡션 자리)
  end.jpg             끝 3초 1/8초
  stt.txt             받아쓰기(faster-whisper large-v3-turbo, 오프라인)
  report.txt          위 숫자 요약
  독립검수_지시문.md   맥락 없는 독립 검수자에게 줄 지시문. {{…}} 칸(원고 · 영상 성격 · 이 편에서 볼 것)은 부르는 쪽이 채운다
각 단계는 따로 잰다 — 한 단계가 실패해도 나머지는 만들고 report.txt 끝 「못 만든 것」에 적는다(끝 코드 2).
"""
import argparse
import glob
import json
import os
import subprocess
import sys
import traceback

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
FINAL_CHECK = os.path.join(HERE, '최종본검사.py')
FACE_MODELS = os.path.expanduser('~/.rembg/models/yunet/')
SAFE_TOP = 269

ap = argparse.ArgumentParser()
ap.add_argument('mp4')
ap.add_argument('--out', required=True)
ap.add_argument('--ref')
ap.add_argument('--up')
ap.add_argument('--skip-stt', action='store_true')
a = ap.parse_args()
MP4 = os.path.abspath(a.mp4)
OUT = os.path.abspath(a.out)
os.makedirs(OUT, exist_ok=True)

rep, failed = [], []


def say(*x):
    s = ' '.join(str(i) for i in x)
    print(s, flush=True)
    rep.append(s)


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', **kw)


def guard(name, fn):
    try:
        return fn()
    except Exception as ex:  # 한 단계가 깨져도 나머지는 만든다
        failed.append(f'{name}: {type(ex).__name__} {ex}')
        say(f'[못 만듦] {name}: {type(ex).__name__} {ex}')
        traceback.print_exc(file=sys.stderr)
        return None


if not os.path.exists(MP4):
    print(json.dumps({'오류': f'파일이 없다: {MP4}'}, ensure_ascii=False))
    sys.exit(2)

try:
    pr = json.loads(run(['ffprobe', '-v', 'error', '-show_entries',
                         'stream=codec_type,width,height,r_frame_rate,sample_rate,channels:format=duration,size,bit_rate',
                         '-of', 'json', MP4]).stdout)
    v = [s for s in pr['streams'] if s['codec_type'] == 'video'][0]
    AUD = [s for s in pr['streams'] if s['codec_type'] == 'audio']
    W, H = int(v['width']), int(v['height'])
    num, den = map(int, v['r_frame_rate'].split('/'))
    FPS = num / den
    DUR = float(pr['format']['duration'])
except Exception as ex:  # 영상 줄기를 못 읽으면 아무것도 만들 수 없다 — 끝 줄을 찍고 끝낸다
    print(json.dumps({'오류': f'영상을 읽지 못했다: {type(ex).__name__} {ex}'}, ensure_ascii=False))
    sys.exit(2)
say(f'파일 {MP4}\n크기 {W}x{H} · {FPS:.3f}fps · {DUR:.2f}초 · {int(pr["format"]["size"]) / 1e6:.1f}MB · 오디오 {[s.get("sample_rate") for s in AUD]}')

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

try:
    FONT = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 15)
except Exception:
    FONT = ImageFont.load_default()

info = {'컷': [], '멈춤': [], '최종본검사': None, '받아쓰기': [], '음량': '', '1초dB': [], '튐': [], '얼굴': [], 'sheets': 0, 'm8': 0, 'cuts': 0, 'z': []}


def extract(sub, fps, w, h):
    d = os.path.join(OUT, sub)
    os.makedirs(d, exist_ok=True)
    for f in glob.glob(os.path.join(d, '*.jpg')):
        os.remove(f)
    r = run(['ffmpeg', '-v', 'error', '-i', MP4, '-vf', f'fps={fps},scale={w}:{h}', '-q:v', '3', os.path.join(d, 'f_%04d.jpg')])
    files = sorted(glob.glob(os.path.join(d, 'f_*.jpg')))
    if not files:  # 0장이면 그 단계는 「못 만듦」이다(11-15 Fable 검수 P2)
        raise RuntimeError(f'ffmpeg가 장을 뽑지 못했다({sub}): {(r.stderr or "").strip()[-200:]}')
    return files


def sheet(files, step, out, cols, t0=0.0, lines=None, labels=None):
    w, h = Image.open(files[0]).size
    rows = (len(files) + cols - 1) // cols
    sh = Image.new('RGB', (cols * w, rows * (h + 18)), (20, 20, 20))
    d = ImageDraw.Draw(sh)
    for i, f in enumerate(files):
        x = (i % cols) * w
        y = (i // cols) * (h + 18)
        sh.paste(Image.open(f), (x, y + 18))
        d.text((x + 3, y + 1), labels[i] if labels else f'{t0 + i * step:.2f}', fill=(255, 220, 0), font=FONT)
        for ly in lines or []:
            d.line([(x, y + 18 + ly), (x + w, y + 18 + ly)], fill=(255, 0, 0), width=1)
    sh.save(out, quality=86)


# 0) 최종본 검사(도구가 따로 잰다)
def step_final_check():
    r = run([sys.executable, '-I', '-X', 'utf8', FINAL_CHECK, MP4, '--json'], cwd=REPO, timeout=1800)
    lines = [ln for ln in r.stdout.splitlines() if ln.startswith('{')]
    j = json.loads(lines[-1]) if lines else {'오류': (r.stderr or '')[-300:]}
    json.dump(j, open(os.path.join(OUT, '최종본검사.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    info['최종본검사'] = j
    hits = j.get('걸림') or []
    say('최종본 검사:', '걸림 없음' if not hits else ' · '.join(f"{h.get('항목')} {h.get('초')}" for h in hits))
    for m in j.get('못잼') or []:
        say('  최종본 검사 못잼:', m)


guard('최종본 검사', step_final_check)


# 1) 0.5초 시트 · 2) 1/8초 띠
def step_sheets():
    hf = extract('h', 2, 216, 384)
    for k in range(0, len(hf), 60):
        sheet(hf[k:k + 60], 0.5, os.path.join(OUT, f'sheet_{k // 60}.jpg'), 12, t0=k * 0.5)
    info['sheets'] = (len(hf) + 59) // 60
    say(f'0.5초 시트 {len(hf)}장 → sheet_*.jpg {info["sheets"]}장')
    af = extract('a8', 8, 120, 213)
    for k in range(0, len(af), 64):
        sheet(af[k:k + 64], 0.125, os.path.join(OUT, f'm8_{k // 64:02d}.jpg'), 16, t0=k * 0.125)
    info['m8'] = (len(af) + 63) // 64
    say(f'1/8초 띠 {len(af)}장 → m8_*.jpg {info["m8"]}장')


guard('시트 · 1/8초 띠', step_sheets)


# 3) 컷 경계 · 멈춘 장 · 컷 앞뒤 · 컷 가운데 한 장
def step_cuts():
    proc = subprocess.run(['ffmpeg', '-v', 'error', '-i', MP4, '-an', '-vf', 'scale=96:170,format=gray', '-f', 'rawvideo', '-'], capture_output=True)
    G = np.frombuffer(proc.stdout, np.uint8).reshape(-1, 170, 96).astype(np.float32)
    D = np.abs(np.diff(G, axis=0)).mean(axis=(1, 2))
    hist = []
    for g in G:
        hh = np.histogram(g, bins=32, range=(0, 256))[0].astype(np.float32)
        hist.append(hh / max(hh.sum(), 1))
    HD = 0.5 * np.abs(np.diff(np.array(hist), axis=0)).sum(axis=1)
    cuts = []
    for i in range(len(D)):
        if (D[i] > 18 and HD[i] > 0.25) or D[i] > 30:
            if not cuts or i + 1 - cuts[-1] > 3:
                cuts.append(i + 1)
    info['컷'] = [round(c / FPS, 2) for c in cuts]
    say('컷 경계(초):', ' '.join(f'{c:.2f}' for c in info['컷']) or '없음')
    dup = D < 0.15
    runs, s = [], None
    for i, x in enumerate(dup):
        if x and s is None:
            s = i
        if not x and s is not None:
            if i - s >= 3:
                runs.append((s, i))
            s = None
    if s is not None and len(dup) - s >= 3:
        runs.append((s, len(dup)))
    info['멈춤'] = [(round(r0 / FPS, 2), round(r1 / FPS, 2)) for r0, r1 in runs]
    say('같은 장 3장 넘게 이어짐(멈춘 화면 · 느린 재생 의심):', ' '.join(f'{x}~{y}' for x, y in info['멈춤']) or '없음')
    d = os.path.join(OUT, 'cut')
    os.makedirs(d, exist_ok=True)
    for f in glob.glob(os.path.join(d, '*.jpg')):
        os.remove(f)
    cf, labels = [], []
    for c in cuts:
        for k, t in ((0, (c - 1) / FPS), (1, (c + 0.5) / FPS)):
            p = os.path.join(d, f'c_{c:05d}_{k}.jpg')
            run(['ffmpeg', '-v', 'error', '-ss', f'{max(0, t):.3f}', '-i', MP4, '-frames:v', '1', '-vf', 'scale=150:267', p])
            if os.path.exists(p):
                cf.append(p)
                labels.append(f'{t:.2f}{" 앞" if k == 0 else " 뒤"}')
    for k in range(0, len(cf), 48):
        sheet(cf[k:k + 48], 0, os.path.join(OUT, f'cuts_{k // 48}.jpg'), 12, labels=labels[k:k + 48])
    info['cuts'] = (len(cf) + 47) // 48
    say(f'컷 앞뒤 → cuts_*.jpg {info["cuts"]}장(두 장씩: 앞 · 뒤)')
    zd = os.path.join(OUT, 'z')
    os.makedirs(zd, exist_ok=True)
    for f in glob.glob(os.path.join(zd, '*.jpg')):
        os.remove(f)
    bounds = [0.0] + [c / FPS for c in cuts] + [DUR]
    for i in range(len(bounds) - 1):
        t = (bounds[i] + bounds[i + 1]) / 2
        p = os.path.join(zd, f'f_{t:06.2f}.jpg')
        run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', MP4, '-frames:v', '1', '-vf', f'scale={W // 2}:{H // 2}', '-q:v', '3', p])
        if os.path.exists(p):
            info['z'].append(round(t, 2))
    say(f'컷 가운데 한 장 → z/f_<초>.jpg {len(info["z"])}장')


guard('컷 경계', step_cuts)


# 4) 2fps 원본 크기 장(얼굴 · 위아래 띠가 같이 쓴다)
FULL = guard('2fps 원본 장', lambda: extract('full', 2, W, H)) or []


# 5) 얼굴 무리
def step_faces():
    import cv2
    ff = FULL
    if not ff:
        raise RuntimeError('2fps 원본 장이 없다')
    fd = cv2.FaceDetectorYN.create(FACE_MODELS + 'face_detection_yunet_2023mar.onnx', '', (320, 320), 0.6, 0.3, 5000)
    fr = cv2.FaceRecognizerSF.create(FACE_MODELS + 'face_recognition_sface_2021dec.onnx', '')
    items = []
    for i, f in enumerate(ff):
        img = cv2.imread(f)
        hh, ww = img.shape[:2]
        fd.setInputSize((ww, hh))
        _, faces = fd.detect(img)
        if faces is None:
            continue
        for fc in faces:
            x, y, fw, fh = fc[:4]
            if fw < 60:
                continue
            feat = fr.feature(fr.alignCrop(img, fc))
            m = 0.3 * fw
            x0, y0 = int(max(0, x - m)), int(max(0, y - m))
            x1, y1 = int(min(ww, x + fw + m)), int(min(hh, y + fh + m))
            crop = Image.fromarray(cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2RGB)).resize((160, 160))
            items.append(dict(t=i * 0.5, fw=int(fw), feat=feat, crop=crop))
    ref = None
    if a.ref:
        rimg = cv2.imread(a.ref)
        if rimg is None:
            say(f'  승인 얼굴 그림을 못 읽음 — 대조 없이 무리만 낸다: {a.ref}')
        else:
            fd.setInputSize((rimg.shape[1], rimg.shape[0]))
            _, rf = fd.detect(rimg)
            if rf is not None:
                ref = fr.feature(fr.alignCrop(rimg, max(rf, key=lambda z: z[2])))
            else:
                say('  승인 얼굴 그림에서 얼굴을 못 찾음 — 대조 없이 무리만 낸다')
    groups = []
    for it in items:
        best, bs = None, 0
        for gi, g in enumerate(groups):
            sc = max(fr.match(it['feat'], o['feat'], cv2.FaceRecognizerSF_FR_COSINE) for o in g[:12])
            if sc > bs:
                bs, best = sc, gi
        if best is not None and bs >= 0.36:
            groups[best].append(it)
            it['g'] = best
        else:
            groups.append([it])
            it['g'] = len(groups) - 1
        if ref is not None:
            it['ref'] = fr.match(it['feat'], ref, cv2.FaceRecognizerSF_FR_COSINE)
    say(f'얼굴 {len(items)}개 · 무리 {len(groups)}')
    for gi, g in enumerate(groups):
        ts = [i['t'] for i in g]
        inn = [fr.match(g[0]['feat'], o['feat'], cv2.FaceRecognizerSF_FR_COSINE) for o in g]
        extra = ''
        if ref is not None:
            rs = [i['ref'] for i in g]
            extra = f' · 승인 얼굴 대조 중앙 {np.median(rs):.2f} 최저 {min(rs):.2f}'
        line = f'무리{gi}: {len(g)}개 {min(ts):.1f}~{max(ts):.1f}초 · 무리 안 최저 {min(inn):.2f}{extra}'
        info['얼굴'].append(line)
        say('  ' + line)
    if items:
        cols = 12
        rows = (len(items) + cols - 1) // cols
        sh = Image.new('RGB', (cols * 160, rows * 178), (20, 20, 20))
        dr = ImageDraw.Draw(sh)
        for k, it in enumerate(items):
            x, y = (k % cols) * 160, (k // cols) * 178
            sh.paste(it['crop'], (x, y + 18))
            dr.text((x + 2, y + 1), f"{it['t']:.1f} g{it['g']} w{it['fw']}" + (f" r{it['ref']:.2f}" if 'ref' in it else ''), fill=(255, 220, 0), font=FONT)
        sh.save(os.path.join(OUT, 'faces.jpg'), quality=86)


guard('얼굴', step_faces)


# 6) 위 · 아래 띠(1초마다)
def step_strips():
    if not FULL:
        raise RuntimeError('2fps 원본 장이 없다')
    tf = [FULL[i] for i in range(0, len(FULL), 2)]
    for name, box, size, lines in (('top', (0, 0, W, 420), (270, 105), [int(SAFE_TOP * 105 / 420)]), ('bot', (0, H - 560, W, H), (270, 140), None)):
        dd = os.path.join(OUT, name)
        os.makedirs(dd, exist_ok=True)
        outs = []
        for i, f in enumerate(tf):
            p = os.path.join(dd, f'{name[0]}_{i:03d}.jpg')
            Image.open(f).crop(box).resize(size).save(p)
            outs.append(p)
        if outs:
            sheet(outs, 1.0, os.path.join(OUT, f'{name}.jpg'), 6, lines=lines)
    say(f'위 띠(빨간 줄 = {SAFE_TOP}px) → top.jpg · 아래 띠 → bot.jpg')


guard('위 · 아래 띠', step_strips)


# 7) 끝 3초
def step_end():
    ed = os.path.join(OUT, 'end')
    os.makedirs(ed, exist_ok=True)
    for f in glob.glob(os.path.join(ed, '*.jpg')):
        os.remove(f)
    t0 = max(0, DUR - 3.2)
    run(['ffmpeg', '-v', 'error', '-ss', f'{t0:.3f}', '-i', MP4, '-vf', 'fps=8,scale=270:480', '-q:v', '3', os.path.join(ed, 'f_%03d.jpg')])
    ef = sorted(glob.glob(os.path.join(ed, 'f_*.jpg')))
    if ef:
        sheet(ef, 0.125, os.path.join(OUT, 'end.jpg'), 9, t0=t0)
    say('끝 3초 → end.jpg')


guard('끝 3초', step_end)


# 8) 소리
def step_sound():
    if not AUD:
        say('소리 줄기 없음')
        return
    r = run(['ffmpeg', '-hide_banner', '-nostats', '-i', MP4, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'])
    summ = ' '.join(r.stderr[r.stderr.rfind('Summary:'):].split('[out#')[0].split())[:400]
    info['음량'] = summ
    say('음량:', summ)
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', MP4, '-ar', '48000', '-f', 'f32le', '-'], capture_output=True).stdout
    ch = int(AUD[0].get('channels', 2))
    A2 = np.frombuffer(pcm, np.float32).reshape(-1, ch)
    clip = int((np.abs(A2) >= 0.999).sum())
    A = A2.mean(axis=1)
    # 소리가 영상보다 짧으면 끝을 무음으로 채워 잰다(최종본검사와 같은 셈)
    need = int(DUR * 48000)
    if len(A) < need:
        A = np.concatenate([A, np.zeros(need - len(A), np.float32)])
    sec = [20 * np.log10(np.sqrt(np.mean(A[i:i + 48000] ** 2)) + 1e-9) for i in range(0, len(A), 48000)]
    info['1초dB'] = [round(x) for x in sec]
    say(f'깨짐 의심(|x|≥0.999) {clip}표본 · 1초 RMS dB:', ' '.join(f'{x:.0f}' for x in sec))
    win = 480
    e = np.array([np.sqrt(np.mean(A[i:i + win] ** 2)) + 1e-9 for i in range(0, len(A) - win, win)])
    edb = 20 * np.log10(e)
    spk = [round(i * win / 48000, 2) for i in range(2, len(edb) - 2) if edb[i] - max(edb[i - 2], edb[i + 2]) > 20 and edb[i] > -30]
    info['튐'] = spk[:30]
    say('소리 튐(10ms가 앞뒤보다 20dB 큼):', ' '.join(str(x) for x in spk[:30]) or '없음')
    run(['ffmpeg', '-v', 'error', '-y', '-i', MP4, '-ac', '1', '-ar', '16000', os.path.join(OUT, 'mix16.wav')])


guard('소리', step_sound)


# 9) 올리기판 대조
def step_upload():
    if not (a.up and os.path.exists(a.up)):
        return
    r = run(['ffmpeg', '-hide_banner', '-i', os.path.abspath(a.up), '-i', MP4, '-lavfi', f'[0:v]scale={W}:{H}[u];[u][1:v]ssim=stats_file=ssim.txt', '-f', 'null', '-'], cwd=OUT)
    ln = [x for x in r.stderr.splitlines() if 'SSIM' in x]
    say('올리기판 SSIM:', ln[-1] if ln else r.stderr[-300:])
    vals = [float(x.split('All:')[1].split()[0]) for x in open(os.path.join(OUT, 'ssim.txt')) if 'All:' in x]
    lo = np.argsort(vals)[:5]
    say('  가장 낮은 장:', ' '.join(f'{i / FPS:.2f}s={vals[i]:.3f}' for i in lo))


guard('올리기판 대조', step_upload)


# 10) 받아쓰기
def step_stt():
    wav = os.path.join(OUT, 'mix16.wav')
    if a.skip_stt or not os.path.exists(wav):
        say('받아쓰기 건너뜀')
        return
    os.environ['HF_HUB_OFFLINE'] = '1'
    from faster_whisper import WhisperModel
    m = WhisperModel('large-v3-turbo', device='cpu', compute_type='int8')
    segs, _ = m.transcribe(wav, language='ko', word_timestamps=False, vad_filter=False, beam_size=5, condition_on_previous_text=False)
    with open(os.path.join(OUT, 'stt.txt'), 'w', encoding='utf-8') as f:
        for s in segs:
            line = f'{s.start:6.2f}-{s.end:6.2f}  {s.text.strip()}'
            info['받아쓰기'].append(f'{s.start:.2f}-{s.end:.2f} {s.text.strip()}')
            f.write(line + '\n')
    say(f'받아쓰기 {len(info["받아쓰기"])}줄 → stt.txt')


guard('받아쓰기', step_stt)


# 11) 맥락 없는 독립 검수 지시문(11-13 B47 · 윈도우깨짐 검수 지시문을 틀로)
def step_prompt():
    fc = info['최종본검사'] or {}
    machine = [f"- {h.get('초')}초: {h.get('항목')} — {json.dumps(h.get('값'), ensure_ascii=False)}" for h in (fc.get('걸림') or [])]
    machine += [f'- {x}~{y}초: 같은 장이 이어짐(멈춘 화면 · 느린 재생 의심)' for x, y in info['멈춤']]
    if info['튐']:
        machine.append('- 소리 튐(10ms가 앞뒤보다 20dB 큼): ' + ' '.join(f'{x}초' for x in info['튐']))
    m8 = info['m8']
    m8_note = ', '.join(f'{k:02d}={k * 8}~{min((k + 1) * 8, DUR):.0f}' for k in range(m8))
    files = [
        f"- sheet_0.jpg{' ~ sheet_%d.jpg' % (info['sheets'] - 1) if info['sheets'] > 1 else ''} — 0.5초마다 한 장(칸 위 숫자가 초)",
        f"- m8_00.jpg ~ m8_{max(m8 - 1, 0):02d}.jpg — 1/8초 띠(한 장에 8초씩: {m8_note})",
        f"- cuts_0.jpg{' ~ cuts_%d.jpg' % (info['cuts'] - 1) if info['cuts'] > 1 else ''} — 컷 경계 앞 · 뒤 장(경계: {' '.join(f'{c:.2f}' for c in info['컷']) or '없음'}초)",
        "- faces.jpg — 0.5초마다 잡힌 얼굴(칸 이름 「초 g무리 w폭」, 같은 무리 = 기계가 같은 사람으로 묶음)" if os.path.exists(os.path.join(OUT, 'faces.jpg')) else '- (얼굴이 잡히지 않아 faces.jpg 없음)',
        "- end.jpg — 끝 3초(1/8초), top.jpg · bot.jpg — 위 · 아래 띠(앱 단추 · 캡션 자리 확인용, 위 빨간 줄이 안전선)",
        f"- z/f_<초>.jpg — 컷마다 가운데 한 장, 원화질의 절반({len(info['z'])}장)",
    ]
    stt = ' / '.join(info['받아쓰기']) or '(받아쓰기 없음)'
    text = f"""답 첫 줄에 지금 돌고 있는 모델 이름(정확한 모델 ID)을 적어 주세요. 그다음 한국어로 답합니다.

당신은 SNS 세로 영상({DUR:.1f}초, {W}x{H}, 인스타 릴스 · 유튜브 쇼츠 · 틱톡용)을 공개 전에 처음 보는 독립 검수자입니다. 만든 사람의 의도나 앞선 검수 결과는 모릅니다. 아래 자료만 보고 「처음 보는 시청자가 무엇을 보고 · 듣고 · 오해하는지」와 「눈에 걸리는 제작 실수」를 찾아 주세요. 파일은 읽기만 하고 아무것도 고치거나 만들지 마세요. {{{{영상 성격 — 예: 사람이 나오는 AI 재연 영상(위 작은 글 「재연 · 인물 · 상황은 각색」) / 화면 캡처와 진행자가 나오는 설명 영상}}}}

## 자료(모두 Read 도구로 그림을 직접 보세요)
폴더: {OUT.replace(os.sep, '/')}
{chr(10).join(files)}

## 원고(만든 쪽 대사표 — 초는 시작)
{{{{원고 — 기획.md · 컷표에서 말과 화면 글을 초 순서로 옮긴다. 누가 하는 말인지(사람 · 화면 글 · 폰 말풍선)도 적는다}}}}

## 받아쓰기(실제 소리)
{stt}
1초 음량 dB(0초부터): {' '.join(str(x) for x in info['1초dB']) or '(못 잼)'}
{info['음량'] or ''}

## 기계 검사가 짚은 것(판단은 당신 몫)
{chr(10).join(machine) or '- 없음'}

## 볼 것
1. 컷 전수: 컷마다 무엇이 보이는지, 같은 컷 안에서 배경 · 옷 · 소품이 갑자기 바뀌는지, 컷 사이 이어짐(옷 · 머리 · 자리 · 좌우 · 손에 든 것), 같은 사람의 얼굴 · 나이가 컷마다 같아 보이는지, 손 · 얼굴 일그러짐, 사람이 굳거나 혼자 움직이는 물건, 2초 넘게 멈춘 화면, 4초 넘게 떠 있는 작은 글자 표. {{{{이 편의 인물과 장소 — 예: 남자: 밤 침대 · 아침 침대 · 스튜디오}}}}
2. 처음 보는 사람이 알아듣나: 각 대사 · 화면 글을 누가 하는 말로 읽는지, 무슨 이야기인지 언제 이해되는지, 화면 숫자끼리 맞는지, 끝 3초가 무엇으로 닫히는지(가장 센 장면인지). {{{{이 편에서 특히 물을 것}}}}
3. 소리: 받아쓰기와 음량으로 보아 말 없는 구간이 비어 보이거나 늘어지는지, 화면 글과 말 박자가 맞는지, 깨지거나 튀는 소리.
4. 글자: 겹침 · 잘림 · 너무 작음 · 앱 단추 자리(위 안전선 · 아래 캡션 자리)에 걸린 글자.

## 답 형식
- 첫 줄 모델 ID, 둘째 줄 판정 한 줄: 「그대로 내도 된다」 / 「고쳐서 내야 한다」 / 「내면 안 된다」
- 지적 표: 번호 | 초 | 등급(P0 · P1 · P2 · P3) | 평소 속도로 한 번 볼 때 알아채나(예 · 아니오) | 무엇이 보이고 · 들리나 | 왜 문제인가 | 어떻게 고치나. P0 = 공개하면 안 되는 것 · 크게 깨진 화면, P1 = 처음 보는 사람이 정상 시청에서 오해하거나 못 알아듣는 것 · 눈에 띄는 제작 실수(얼굴이 다른 사람으로 보임 · 말한 사람 혼동 · 굳은 사람 등), P2 = 품질 문제, P3 = 의심.
- 마지막에 「처음 보는 사람이 한 문장으로 무슨 말이라고 할지」와 「다시 볼 때 남는 한 장면」.
- 그림을 보지 못한 파일이 있으면 그 파일 이름을 밝히고 그 범위의 지적은 만들지 마세요.
"""
    open(os.path.join(OUT, '독립검수_지시문.md'), 'w', encoding='utf-8').write(text)
    say('독립 검수 지시문 → 독립검수_지시문.md({{…}} 칸은 부르는 쪽이 채운다)')


guard('독립 검수 지시문', step_prompt)

if failed:
    rep.append('\n못 만든 것:\n' + '\n'.join(failed))
open(os.path.join(OUT, 'report.txt'), 'w', encoding='utf-8').write('\n'.join(rep) + '\n')
print(json.dumps({'폴더': OUT, '컷': info['컷'], '못만듦': failed}, ensure_ascii=False))
sys.exit(2 if failed else 0)

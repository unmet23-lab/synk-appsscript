"""v35(v34 바탕) 롱폼이 쓰는 480p 구간만 로컬 SeedVR2-3B로 1080p 업스케일한다(11-07, 크레딧 0).
유호님 11-06 「좋아, 흠 고쳐」 — 10-18에 짚으신 v34 흠 「중간중간 화질이 깨지는 부분이 꽤 있고」: v34는 오프닝 뒤 거의 모든 컷이
480×854 시댄스 초안 판을 1080으로 늘린 것이었다. 1층 몽타주를 같은 길로 키운 판(업스케일_GPU대기.py, 11-01)과 같은 설정.
- 입력: scratchpad의 v35_timeline.json(러프컷_만들기_v35.py의 SEQ를 잰 시간표) — 480p 원본마다 쓰는 구간을 앞뒤 0.5초 여유로 묶음(틈 1.5초 안이면 하나로).
- 출력: 재촬영_v40/업스케일/v35/<원본이름>__<시작>-<끝>_1080p.mp4(원래 소리 붙임) + _목록.json(원본 · 구간 · 결과 파일).
- 이미 있는 결과는 건너뛴다(끊겨도 다시 돌리면 이어 감). 공용 GPU 차례로 띄운다:
  python 차례.py gpu 돌리기 hangang-v35-up "한강 v35 480p 키우기" --상한 240 -- <이 파이썬> -X utf8 업스케일_v35.py <시간표 json>
"""
import json
import os
import subprocess
import sys
import time

V40 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTD = os.path.join(V40, '업스케일', 'v35')
os.makedirs(OUTD, exist_ok=True)
COMFY = r'C:\SYNK-LoRA\tools\ComfyUI'
LOG = os.path.join(OUTD, '_기록.log')


def log(m):
    line = f"{time.strftime('%m-%d %H:%M:%S')} {m}"
    print(line, flush=True)
    open(LOG, 'a', encoding='utf-8').write(line + '\n')


def run(a, **kw):
    r = subprocess.run(a, capture_output=True, text=True, encoding='utf-8', errors='replace', **kw)
    if r.returncode:
        raise SystemExit('실패: ' + ' '.join(map(str, a[:6])) + '\n' + (r.stdout or '')[-2500:] + '\n' + (r.stderr or '')[-1500:])
    return r


def spans(timeline):
    by = {}
    for r in timeline:
        if (r.get('w') or 9999) >= 1000:
            continue
        by.setdefault(r['src'], []).append((max(0.0, r['tin'] - 0.5), r['tout'] + 0.5))
    out = []
    for src, rs in by.items():
        rs.sort()
        cur = list(rs[0])
        for a, b in rs[1:]:
            if a <= cur[1] + 1.5:
                cur[1] = max(cur[1], b)
            else:
                out.append((src, cur[0], cur[1]))
                cur = [a, b]
        out.append((src, cur[0], cur[1]))
    return out


def main():
    tl = json.load(open(sys.argv[1], encoding='utf-8'))
    jobs = spans(tl)
    total = sum(b - a for _, a, b in jobs)
    log(f'구간 {len(jobs)}개 · {total:.1f}초')
    index_p = os.path.join(OUTD, '_목록.json')
    index = json.load(open(index_p, encoding='utf-8')) if os.path.exists(index_p) else []
    done = {(e['src'], e['a'], e['b']) for e in index}
    env = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONPATH=r'C:\SYNK-LoRA\tools\seedvr2-extra')
    for src, a, b in jobs:
        a, b = round(a, 3), round(b, 3)
        name = f"{os.path.splitext(os.path.basename(src))[0]}__{a:.2f}-{b:.2f}"
        final = os.path.join(OUTD, name + '_1080p.mp4')
        if (src, a, b) in done and os.path.exists(final):
            continue
        cut = os.path.join(OUTD, name + '_480p.mp4')
        up = os.path.join(OUTD, name + '_1080p_소리없음.mp4')
        run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{a:.3f}', '-i', src, '-t', f'{b - a:.3f}', '-c:v', 'libx264', '-crf', '10', '-preset', 'slow',
             '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', cut])
        t1 = time.time()
        run([os.path.join(COMFY, 'venv', 'Scripts', 'python.exe'), '-X', 'utf8',
             os.path.join(COMFY, 'custom_nodes', 'ComfyUI-SeedVR2_VideoUpscaler', 'inference_cli.py'), cut,
             '--output', up, '--dit_model', 'seedvr2_ema_3b_fp16.safetensors', '--resolution', '1080', '--batch_size', '33',
             '--seed', '42', '--attention_mode', 'sdpa', '--vae_encode_tiled', '--vae_decode_tiled'], cwd=COMFY, env=env)
        has_a = run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', cut]).stdout.strip()
        if has_a:
            run(['ffmpeg', '-v', 'error', '-y', '-i', up, '-i', cut, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', final])
        else:
            os.replace(up, final)
        index.append({'src': src, 'a': a, 'b': b, 'up': final})
        json.dump(index, open(index_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        log(f'{name} {b - a:.1f}초 → {time.time() - t1:.0f}초')
    log('끝')


if __name__ == '__main__':
    main()

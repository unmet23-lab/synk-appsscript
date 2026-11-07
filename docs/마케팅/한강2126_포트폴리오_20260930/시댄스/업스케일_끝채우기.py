"""배치 33 · mp4로 키운 판이 끝 1~3장을 버린 구간(11-07 v36 조립에서 13컷이 원본으로 돌아감)의 끝만 다시 키워 잇는다.
구간 잘린 판의 끝 37장을 조각으로 떠 폴더 하나에 두고 SeedVR2를 한 번(--cache_dit --cache_vae, 배치 37, PNG — PNG는 장을 버리지 않음)
돌린 뒤, 기존 판의 끝 8장에 걸쳐 기존 → 새 판으로 섞고 모자란 장을 새 판으로 채운다. 결과는 <이름>_1080p_끝.mp4, _목록.json의 up · nf를 바꾼다.
  python 차례.py gpu 돌리기 hangang-v36-tail "한강 v36 끝 장 채우기" --상한 60 -- <이 파이썬> -X utf8 업스케일_끝채우기.py
"""
import glob
import json
import os
import shutil
import subprocess
import time

import numpy as np
from PIL import Image

V40 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPD = os.path.join(V40, '업스케일', 'v35')
COMFY = r'C:\SYNK-LoRA\tools\ComfyUI'
WORK = r'C:\SYNK-LoRA\work\hangang_v36_tail'
FPS, T, XF = 24, 37, 8


def count(p):
    return int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-count_packets', '-show_entries', 'stream=nb_read_packets',
                               '-of', 'csv=p=0', p], capture_output=True, text=True).stdout.strip() or 0)


def frames(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, 1920, 1080, 3)


def main():
    ip = os.path.join(UPD, '_목록.json')
    idx = json.load(open(ip, encoding='utf-8'))
    todo = []
    for e in idx:
        cut = e['up'].replace('_1080p.mp4', '_480p.mp4')
        if e['up'].endswith('_끝.mp4') or not os.path.exists(cut):
            continue
        nc, nu = count(cut), count(e['up'])
        if nu < nc:
            todo.append((e, cut, nc, nu))
    print(f'끝이 모자란 구간 {len(todo)}개', flush=True)
    if not todo:
        return
    shutil.rmtree(WORK, ignore_errors=True)
    os.makedirs(os.path.join(WORK, 'in'))
    for k, (e, cut, nc, nu) in enumerate(todo):
        s = nc - T
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', cut, '-vf', f"select='between(n\\,{s}\\,{nc - 1})',setpts=N/{FPS}/TB",
                        '-an', '-r', str(FPS), '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', os.path.join(WORK, 'in', f't_{k:02d}.mp4')],
                       check=True)
    env = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONPATH=r'C:\SYNK-LoRA\tools\seedvr2-extra')
    t0 = time.time()
    with open(os.path.join(WORK, 'seedvr2.log'), 'w', encoding='utf-8') as lf:
        r = subprocess.run([os.path.join(COMFY, 'venv', 'Scripts', 'python.exe'), '-X', 'utf8',
                            'custom_nodes/ComfyUI-SeedVR2_VideoUpscaler/inference_cli.py', os.path.join(WORK, 'in').replace('\\', '/'),
                            '--output', os.path.join(WORK, 'out').replace('\\', '/'), '--output_format', 'png',
                            '--dit_model', 'seedvr2_ema_3b_fp16.safetensors', '--resolution', '1080', '--batch_size', str(T),
                            '--uniform_batch_size', '--seed', '42', '--attention_mode', 'sdpa', '--vae_encode_tiled', '--vae_decode_tiled',
                            '--cache_dit', '--cache_vae'], cwd=COMFY, env=env, stdout=lf, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
    print(f'SeedVR2 {time.time() - t0:.0f}초 rc={r.returncode}', flush=True)
    for k, (e, cut, nc, nu) in enumerate(todo):
        fr = sorted(glob.glob(os.path.join(WORK, 'out', f't_{k:02d}', '**', '*.png'), recursive=True))
        if r.returncode or len(fr) < T:
            raise SystemExit(f'끝 조각 {k} 실패 {len(fr)}/{T}장 — {WORK}\\seedvr2.log')
        old = frames(e['up'])
        s = nc - T
        out = e['up'].replace('_1080p.mp4', '_1080p_끝.mp4')
        enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1080x1920', '-r', str(FPS), '-i', '-',
                                '-c:v', 'libx264', '-crf', '10', '-preset', 'slow', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
        x0 = nu - XF   # 여기부터 기존 → 새 판으로 섞음
        for j in range(nc):
            if j < x0:
                im = old[j]
            else:
                new = np.asarray(Image.open(fr[j - s]).convert('RGB').resize((1080, 1920), Image.LANCZOS), np.float32)
                if j < nu:
                    w = (j - x0 + 1) / (XF + 1)
                    im = (old[j].astype(np.float32) * (1 - w) + new * w).round().astype(np.uint8)
                else:
                    im = new.round().astype(np.uint8)
            enc.stdin.write(np.ascontiguousarray(im).tobytes())
        enc.stdin.close()
        enc.wait()
        e['up_mp4_원래'] = e['up']
        e['up'] = out
        e['nf'] = nc
        print(f"{os.path.basename(out)} {nu} → {nc}장(끝 {nc - nu}장 채움, {XF}장 섞음)", flush=True)
    json.dump(idx, open(ip, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    shutil.rmtree(WORK, ignore_errors=True)


if __name__ == '__main__':
    main()

"""Local 1-second foreground-preservation test; no generation or downloads."""
from pathlib import Path
import json, subprocess, time
import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent
P = OUT.parent.parent
SOURCE = P / 'performance-references/upload-ready/yuho-genuine-smile-under10s-compatible.mp4'
BACKGROUND = P / 'google-vids/test-10-motion-preservation.mp4'
MODEL = Path(r'C:\Users\q1212\.rembg\models\isnet-general-use\isnet-general-use.onnx')
FFMPEG = Path(r'C:\Users\q1212\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe')
START, FPS, N = 2.0, 24, 24
BG_CROP = (1050, 200, 870, 490)
cv2.setNumThreads(2)
opts = ort.SessionOptions()
opts.intra_op_num_threads = 4
opts.inter_op_num_threads = 1
session = ort.InferenceSession(str(MODEL), sess_options=opts, providers=['CPUExecutionProvider'])
source = cv2.VideoCapture(str(SOURCE))
bg_source = cv2.VideoCapture(str(BACKGROUND))
frames = OUT / 'frames'
frames.mkdir(exist_ok=True)

def read_at(cap, timestamp):
    cap.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)
    ok, frame = cap.read()
    if not ok:
        raise RuntimeError(f'Cannot decode {timestamp}s')
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

def mask_for(rgb):
    im = Image.fromarray(rgb).resize((1024, 1024), Image.Resampling.LANCZOS)
    ar = np.asarray(im).astype(np.float32)
    ar = ar / max(float(ar.max()), 1e-6) - 0.5
    feed = ar.transpose(2, 0, 1)[None]
    pred = session.run(['output_image'], {'input_image': feed})[0][0, 0]
    pred = (pred - pred.min()) / max(float(pred.max() - pred.min()), 1e-6)
    alpha = cv2.resize(pred, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_LINEAR)
    alpha = np.clip(alpha, 0.0, 1.0)
    # Interior opaque, low-confidence background clear; no change to foreground RGB.
    alpha[alpha >= 0.90] = 1.0
    alpha[alpha <= 0.02] = 0.0
    return alpha

results, samples, inference = [], [], []
t0 = time.perf_counter()
for i in range(N):
    timestamp = START + i / FPS
    rgb = read_at(source, timestamp)
    bg = read_at(bg_source, timestamp)
    x, y, w, h = BG_CROP
    crop = bg[y:y+h, x:x+w]
    background = cv2.resize(crop, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_CUBIC)
    background = cv2.GaussianBlur(background, (0, 0), 2.2)
    # Background alone receives a fixed restrained luminance/saturation adjustment.
    gray = cv2.cvtColor(background, cv2.COLOR_RGB2GRAY).astype(np.float32)[..., None]
    background = np.clip((gray + (background.astype(np.float32) - gray) * 0.70) * 0.90, 0, 255).astype(np.uint8)
    step = time.perf_counter()
    alpha = mask_for(rgb)
    inference.append(time.perf_counter() - step)
    mix = np.rint(rgb.astype(np.float32) * alpha[..., None] + background.astype(np.float32) * (1.0 - alpha[..., None])).astype(np.uint8)
    opaque = alpha == 1.0
    max_diff = int(np.abs(mix.astype(np.int16) - rgb.astype(np.int16))[opaque].max())
    # Central face patch is inside the face throughout the selected second.
    face_patch_min = float(alpha[270:510, 285:460].min())
    results.append({'frame': i, 'source_time': timestamp, 'opaque_pixel_count': int(opaque.sum()), 'opaque_rgb_max_diff': max_diff, 'central_face_alpha_min': face_patch_min})
    Image.fromarray(mix).save(frames / f'{i:04d}.png')
    if i in [0, 12, 23]:
        Image.fromarray(rgb).save(OUT / f'before-{i:02d}.png')
        Image.fromarray(mix).save(OUT / f'after-{i:02d}.png')
        Image.fromarray(np.rint(alpha * 255).astype(np.uint8)).save(OUT / f'alpha-{i:02d}.png')
        Image.fromarray(crop).save(OUT / f'background-crop-{i:02d}.png')
        samples.append((i, timestamp, rgb, mix, crop))
    print(f'frame {i+1}/{N}: {inference[-1]:.3f}s inference; opaque RGB delta={max_diff}; central face alpha={face_patch_min:.5f}', flush=True)
source.release()
bg_source.release()
processing = time.perf_counter() - t0
sheet = Image.new('RGB', (1440, 3 * 435), '#151a20')
draw = ImageDraw.Draw(sheet)
for row, (i, timestamp, before, after, _) in enumerate(samples):
    for col, array in enumerate([before, after]):
        panel = Image.fromarray(array).resize((720, 405), Image.Resampling.LANCZOS)
        sheet.paste(panel, (col*720, row*435+30))
        draw.text((col*720+12, row*435+9), f'{"ORIGINAL" if col == 0 else "LOCAL COMPOSITE"} | source {timestamp:.3f}s', fill='white')
sheet.save(OUT / 'before-after-3frames.jpg', quality=95)
bg_sheet = Image.new('RGB', (870, 3*520), '#151a20')
bg_draw = ImageDraw.Draw(bg_sheet)
for row, (i, timestamp, _, _, crop) in enumerate(samples):
    bg_sheet.paste(Image.fromarray(crop), (0, row*520+30))
    bg_draw.text((12,row*520+9),f'BACKGROUND ONLY | source {timestamp:.3f}s | crop x1050 y200 w870 h490',fill='white')
bg_sheet.save(OUT / 'background-crop-3frames.jpg',quality=95)
output = OUT / 'yuho-original-face-cafe-1s.mp4'
cmd = [str(FFMPEG), '-hide_banner', '-loglevel', 'warning', '-y', '-framerate', str(FPS), '-i', str(frames/'%04d.png'), '-ss', str(START), '-t', '1', '-i', str(SOURCE), '-map', '0:v:0', '-map', '1:a:0?', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-t', '1', '-movflags', '+faststart', str(output)]
subprocess.run(cmd, check=True)
report = {'status':'one-second local foreground preservation trial; not new cafe dialogue', 'input':str(SOURCE), 'background_input':str(BACKGROUND), 'output':str(output), 'source_start_seconds':START, 'duration_seconds':1, 'fps':FPS, 'background_crop_xywh':BG_CROP, 'background_adjustment':{'saturation':0.70,'brightness_multiplier':0.90,'blur_sigma':2.2}, 'foreground_rgb_adjustment':'none', 'cached_model':str(MODEL), 'provider':'CPUExecutionProvider', 'intra_op_threads':4, 'processing_seconds_excluding_encode':processing, 'inference_mean_seconds_per_frame':float(np.mean(inference)), 'inference_max_seconds_per_frame':max(inference), 'all_opaque_rgb_deltas_zero':all(r['opaque_rgb_max_diff']==0 for r in results), 'central_face_all_opaque':all(r['central_face_alpha_min']==1.0 for r in results), 'frames':results}
(OUT/'report-1s.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='frames'},ensure_ascii=False),flush=True)

"""Offline source-pixel-preserving composite, 24 fps, full 9.92-second source."""
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
FFPROBE = FFMPEG.with_name('ffprobe.exe')
FPS, N, DURATION = 24, 238, 9.92
BG_CROP = (1050, 200, 870, 490)
cv2.setNumThreads(2)
opts = ort.SessionOptions()
opts.intra_op_num_threads = 4
opts.inter_op_num_threads = 1
session = ort.InferenceSession(str(MODEL), sess_options=opts, providers=['CPUExecutionProvider'])

class SequentialReader:
    def __init__(self, path):
        self.cap = cv2.VideoCapture(str(path))
        self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        self.count = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.index = -1
        self.last = None
    def at(self, timestamp):
        desired = min(self.count - 1, round(timestamp * self.fps))
        while self.index < desired:
            ok, frame = self.cap.read()
            if not ok:
                raise RuntimeError(f'Cannot decode source frame {desired}')
            self.last = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            self.index += 1
        return self.last
    def close(self):
        self.cap.release()

def mask_for(rgb):
    im = Image.fromarray(rgb).resize((1024, 1024), Image.Resampling.LANCZOS)
    ar = np.asarray(im).astype(np.float32)
    ar = ar / max(float(ar.max()), 1e-6) - 0.5
    pred = session.run(['output_image'], {'input_image': ar.transpose(2, 0, 1)[None]})[0][0, 0]
    pred = (pred - pred.min()) / max(float(pred.max() - pred.min()), 1e-6)
    alpha = np.clip(cv2.resize(pred, (1920, 1080), interpolation=cv2.INTER_LINEAR), 0.0, 1.0)
    alpha[alpha >= 0.90] = 1.0
    alpha[alpha <= 0.02] = 0.0
    return alpha

source, bg_source = SequentialReader(SOURCE), SequentialReader(BACKGROUND)
output = OUT / 'yuho-original-face-cafe-10s.mp4'
encode_log = open(OUT/'encode-10s.log','w',encoding='utf-8')
cmd = [str(FFMPEG),'-hide_banner','-loglevel','warning','-y','-f','rawvideo','-pixel_format','rgb24','-video_size','1920x1080','-framerate',str(FPS),'-i','pipe:0','-i',str(SOURCE),'-map','0:v:0','-map','1:a:0?','-c:v','libx264','-threads','4','-crf','16','-preset','medium','-pix_fmt','yuv420p','-c:a','copy','-t',str(DURATION),'-movflags','+faststart',str(output)]
encoder = subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=encode_log)
results, samples, inference = [], [], []
sample_indices = [0, 60, 120, 180, 237]
t0 = time.perf_counter()
try:
    for i in range(N):
        timestamp = i/FPS
        rgb = source.at(timestamp)
        bg = bg_source.at(timestamp)
        x,y,w,h = BG_CROP
        crop = bg[y:y+h,x:x+w]
        background = cv2.resize(crop,(1920,1080),interpolation=cv2.INTER_CUBIC)
        background = cv2.GaussianBlur(background,(0,0),2.2)
        gray = cv2.cvtColor(background,cv2.COLOR_RGB2GRAY).astype(np.float32)[...,None]
        background = np.clip((gray+(background.astype(np.float32)-gray)*0.70)*0.90,0,255).astype(np.uint8)
        step = time.perf_counter()
        alpha = mask_for(rgb)
        inference.append(time.perf_counter()-step)
        mix = np.rint(rgb.astype(np.float32)*alpha[...,None]+background.astype(np.float32)*(1.0-alpha[...,None])).astype(np.uint8)
        opaque = alpha==1.0
        max_diff = int(np.abs(mix.astype(np.int16)-rgb.astype(np.int16))[opaque].max())
        face_patch = alpha[270:510,285:460]
        results.append({'frame':i,'source_time':timestamp,'source_frame_index':source.index,'background_frame_index':bg_source.index,'opaque_pixel_count':int(opaque.sum()),'opaque_rgb_max_diff':max_diff,'fixed_central_patch_alpha_min':float(face_patch.min()),'fixed_central_patch_opaque_fraction':float(np.mean(face_patch==1.0))})
        encoder.stdin.write(mix.tobytes())
        if i in sample_indices:
            Image.fromarray(rgb).save(OUT/f'full-before-{i:03d}.png')
            Image.fromarray(mix).save(OUT/f'full-after-{i:03d}.png')
            Image.fromarray(np.rint(alpha*255).astype(np.uint8)).save(OUT/f'full-alpha-{i:03d}.png')
            Image.fromarray(crop).save(OUT/f'full-background-{i:03d}.png')
            samples.append((i,timestamp,rgb,mix,crop))
        if i%12==0 or i==N-1:
            progress = {'frame':i+1,'total':N,'elapsed_seconds':time.perf_counter()-t0,'mean_inference_seconds':float(np.mean(inference)),'opaque_rgb_delta':max_diff}
            (OUT/'progress-10s.json').write_text(json.dumps(progress,indent=2),encoding='utf-8')
            print(json.dumps(progress),flush=True)
finally:
    source.close(); bg_source.close()
    encoder.stdin.close()
encoder.wait()
encode_log.close()
if encoder.returncode:
    raise RuntimeError(f'Encoder exit {encoder.returncode}')
elapsed = time.perf_counter()-t0
print('OUTPUT_READY: '+str(output),flush=True)

sheet = Image.new('RGB',(1440,5*435),'#151a20')
draw = ImageDraw.Draw(sheet)
for row,(i,timestamp,before,after,_) in enumerate(samples):
    for col,array in enumerate([before,after]):
        panel = Image.fromarray(array).resize((720,405),Image.Resampling.LANCZOS)
        sheet.paste(panel,(col*720,row*435+30))
        draw.text((col*720+12,row*435+9),f'{"ORIGINAL" if col==0 else "LOCAL COMPOSITE"} | source {timestamp:.3f}s',fill='white')
sheet.save(OUT/'before-after-5frames-full.jpg',quality=95)
report = {'status':'local foreground preservation test; not new cafe dialogue','input':str(SOURCE),'background_input':str(BACKGROUND),'output':str(output),'duration_target_seconds':DURATION,'video_frame_count':N,'video_duration_seconds':N/FPS,'fps':FPS,'background_crop_xywh':BG_CROP,'background_tail':'last background frame held for final 2 frames; original foreground keeps moving','background_adjustment':{'saturation':0.70,'brightness_multiplier':0.90,'blur_sigma':2.2},'foreground_rgb_adjustment':'none','audio':'original AAC stream copied without re-encoding','cached_model':str(MODEL),'provider':'CPUExecutionProvider','intra_op_threads':4,'total_processing_and_encode_seconds':elapsed,'inference_mean_seconds_per_frame':float(np.mean(inference)),'inference_max_seconds_per_frame':max(inference),'all_opaque_rgb_deltas_zero':all(r['opaque_rgb_max_diff']==0 for r in results),'fixed_central_patch_all_opaque':all(r['fixed_central_patch_alpha_min']==1.0 for r in results),'frames':results}
(OUT/'report-10s.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
decode = subprocess.run([str(FFMPEG),'-v','error','-i',str(output),'-f','null','-'],capture_output=True,text=True,encoding='utf-8')
report['full_decode_returncode']=decode.returncode
report['full_decode_stderr']=decode.stderr
(OUT/'full-decode-10s.log').write_text(decode.stderr or 'PASS: full video and audio decoded without errors.\n',encoding='utf-8')
probe = subprocess.run([str(FFPROBE),'-v','error','-show_streams','-show_format','-of','json',str(output)],capture_output=True,text=True,encoding='utf-8',check=True)
(OUT/'ffprobe-10s.json').write_text(probe.stdout,encoding='utf-8')
(OUT/'report-10s.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ['frames','input','background_input','output','cached_model']},ensure_ascii=False),flush=True)

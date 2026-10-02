"""Independent validation of completed composite; no matting rerun."""
from pathlib import Path
import json, subprocess
import cv2
import numpy as np
from PIL import Image

OUT=Path(__file__).resolve().parent
P=OUT.parent.parent
SOURCE=P/'performance-references/upload-ready/yuho-genuine-smile-under10s-compatible.mp4'
OUTPUT=OUT/'yuho-original-face-cafe-10s.mp4'
FFMPEG=Path(r'C:\Users\q1212\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe')
def run(args):
    return subprocess.run(args,capture_output=True,text=True,encoding='utf-8',check=True)
probe=json.loads(run([str(FFMPEG.with_name('ffprobe.exe')),'-v','error','-show_streams','-show_format','-of','json',str(OUTPUT)]).stdout)
(OUT/'ffprobe-10s.json').write_text(json.dumps(probe,ensure_ascii=False,indent=2),encoding='utf-8')
decode=run([str(FFMPEG),'-v','error','-i',str(OUTPUT),'-f','null','-'])
(OUT/'full-decode-10s.log').write_text(decode.stderr or 'PASS: full video and audio decoded without errors.\n',encoding='utf-8')
src=cv2.VideoCapture(str(SOURCE)); comp=cv2.VideoCapture(str(OUTPUT))
source_fps=src.get(cv2.CAP_PROP_FPS)
source_index=-1
frame_errors=[]
i=0
while True:
    ok,rendered=comp.read()
    if not ok: break
    target=round(i/24*source_fps)
    while source_index<target:
        ok,original=src.read()
        assert ok
        source_index+=1
    # Same fixed central-face patch used by compositor, inside the face at all sampled times.
    delta=np.abs(rendered[270:510,285:460].astype(np.int16)-original[270:510,285:460].astype(np.int16))
    frame_errors.append({'frame':i,'source_frame':source_index,'face_patch_mean_abs_rgb_error':float(delta.mean()),'face_patch_max_abs_rgb_error':int(delta.max())})
    i+=1
src.release();comp.release()
samples=[]
for idx in [0,60,120,180,237]:
    original=np.array(Image.open(OUT/f'full-before-{idx:03d}.png').convert('RGB'))
    composite=np.array(Image.open(OUT/f'full-after-{idx:03d}.png').convert('RGB'))
    alpha=np.array(Image.open(OUT/f'full-alpha-{idx:03d}.png'))
    # Alpha quantization can round nearly-opaque pixels to 255. Erode for exact interior only.
    opaque=cv2.erode((alpha==255).astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)
    diff=np.abs(original.astype(np.int16)-composite.astype(np.int16))
    samples.append({'frame':idx,'interior_rgb_max_diff':int(diff[opaque].max()),'central_face_alpha_min_u8':int(alpha[270:510,285:460].min()),'opaque_pixel_count':int(opaque.sum())})
hashes={}
for key,path in [('source',SOURCE),('composite',OUTPUT)]:
    hashes[key]=run([str(FFMPEG),'-v','error','-i',str(path),'-map','0:a:0','-f','hash','-hash','sha256','-']).stdout.strip()
report={'status':'completed local source-expression preservation test; not new cafe dialogue','output':str(OUTPUT),'duration_seconds':float(probe['format']['duration']),'video_frames':i,'fps':24,'foreground_rgb_adjustment':'none; same source frame RGB under alpha; output H264 introduces compression differences','background_crop_xywh':[1050,200,870,490],'background_tail':'last background frame held for final two frames only','cached_model':'isnet-general-use.onnx; CPU threads 4; no download','processing_seconds_until_last_frame':318.6232977,'inference_mean_seconds_per_frame':1.0741860189,'preencode_full_validation_note':'Compositor evaluated opaque RGB difference each frame; only progress checkpoints survived a final cp949 report-write error. Five saved lossless samples rechecked independently. Full 238-frame encoded central-face comparison below is independently verified.','preencode_saved_samples':samples,'full_decode_returncode':decode.returncode,'full_decode_stderr':decode.stderr,'encoded_face_patch_mean_abs_rgb_error':float(np.mean([r['face_patch_mean_abs_rgb_error'] for r in frame_errors])),'encoded_face_patch_max_frame_mean_abs_rgb_error':max(r['face_patch_mean_abs_rgb_error'] for r in frame_errors),'encoded_face_patch_max_abs_rgb_error':max(r['face_patch_max_abs_rgb_error'] for r in frame_errors),'encoded_comparison_roi_xywh':[285,270,175,240],'decoded_audio_hashes':hashes,'decoded_audio_identical':hashes['source']==hashes['composite'],'frames':frame_errors}
(OUT/'report-10s.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ['frames','output']},ensure_ascii=False,indent=2))

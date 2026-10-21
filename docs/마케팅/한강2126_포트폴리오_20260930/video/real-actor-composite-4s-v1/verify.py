from pathlib import Path
import json,subprocess,shutil
import cv2,numpy as np
from PIL import Image
OUT=Path(__file__).resolve().parent
ffmpeg=shutil.which('ffmpeg'); ffprobe=shutil.which('ffprobe')
files=['source-master.mp4','composite-master.mp4','portrait-480p.mp4','source-portrait-480p.mp4']
probes={}
for name in files:
    path=OUT/name
    probe=json.loads(subprocess.run([ffprobe,'-v','error','-show_streams','-show_format','-of','json',str(path)],capture_output=True,text=True,encoding='utf-8',check=True).stdout)
    dec=subprocess.run([ffmpeg,'-v','error','-i',str(path),'-f','null','-'],capture_output=True,text=True,encoding='utf-8')
    v=next(s for s in probe['streams'] if s['codec_type']=='video')
    probes[name]={'duration':float(probe['format']['duration']),'frames':int(v['nb_frames']),'width':v['width'],'height':v['height'],'codec':v['codec_name'],'fps':v['r_frame_rate'],'audio_streams':sum(s['codec_type']=='audio' for s in probe['streams']),'full_decode_returncode':dec.returncode,'full_decode_errors':dec.stderr}
a=cv2.VideoCapture(str(OUT/'source-master.mp4')); b=cv2.VideoCapture(str(OUT/'composite-master.mp4'))
errors=[]
while True:
    oka,aa=a.read(); okb,bb=b.read()
    if not oka or not okb:
        assert oka==okb
        break
    roi_a=aa[270:510,285:460].astype(np.float32);roi_b=bb[270:510,285:460].astype(np.float32)
    errors.append(float(np.mean(np.abs(roi_a-roi_b))))
a.release();b.release()
samples=[]
for i in [0,24,48,72,95]:
    aa=np.asarray(Image.open(OUT/f'source-{i:03}.png')).astype(np.int16)
    bb=np.asarray(Image.open(OUT/f'composite-{i:03}.png')).astype(np.int16)
    alpha=np.asarray(Image.open(OUT/f'alpha-{i:03}.png'))
    samples.append({'frame':i,'opaque_rgb_max_delta':int(np.abs(aa-bb)[alpha==255].max()),'central_face_alpha_min':int(alpha[270:510,285:460].min())})
result={'status':'media_verified_browser_playback_pending','files':probes,'encoded_face_comparison':{'frames':len(errors),'roi_xywh':[285,270,175,240],'mean_absolute_channel_error_0_255':float(np.mean(errors)),'worst_frame_mean_absolute_channel_error':max(errors),'note':'Both files encode the same original sampled face. Differences arise from surrounding macroblocks and compression; no perceptual quality score.'},'lossless_samples':samples,'all_media_4_seconds_96_frames':all(v['frames']==96 and v['duration']==4 for v in probes.values()),'all_full_decodes_pass':all(v['full_decode_returncode']==0 and not v['full_decode_errors'].strip() for v in probes.values()),'intentional_silent':all(v['audio_streams']==0 for v in probes.values())}
(OUT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=True),flush=True)


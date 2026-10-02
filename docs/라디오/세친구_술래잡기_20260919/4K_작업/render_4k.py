"""Framewise Real-ESRGAN general-x4v3, then 3840x2160 SDR silent video.

The source remains 1376x768. This is a documented AI upscale, not native 4K.
"""
from pathlib import Path
import json
import subprocess
import time

folder = Path(__file__).resolve().parent.parent
cache = Path('C:/Users/q1212/.cache/synk-media/radio-h3-happy-20260919')
inputs, outputs = cache / 'input', cache / 'output'
inputs.mkdir(parents=True, exist_ok=True)
outputs.mkdir(parents=True, exist_ok=True)
source = folder / 'H3_몽글눈웃음_원본.mp4'
result = folder / 'H3_몽글눈웃음_4K_무음.mp4'
exe = Path('C:/Users/q1212/.cache/synk-media/realesrgan-ncnn-v0.2.0/realesrgan-ncnn-vulkan-v0.2.0-windows/realesrgan-ncnn-vulkan.exe')
model = Path('C:/Users/q1212/.cache/synk-media/realesrgan-general/models')
started = time.time()
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(source),
                '-an','-fps_mode','passthrough',str(inputs/'%06d.png')],check=True)
expected = len(list(inputs.glob('*.png')))
print(f'Extracted {expected} original frames; retaining 48 fps.', flush=True)
with (cache/'upscale.log').open('w') as log:
    subprocess.run([str(exe),'-i',str(inputs),'-o',str(outputs),'-m',str(model),
                    '-n','realesrgan-x4plus','-s','4','-t','256','-j','1:2:2','-f','png'],
                    stdout=log,stderr=subprocess.STDOUT,check=True)
actual = len(list(outputs.glob('*.png')))
if actual != expected:
    raise RuntimeError(f'Incomplete upscale {actual}/{expected}')
print(f'Upscaled {actual} frames in {time.time()-started:.1f}s; encoding 4K.', flush=True)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-framerate','48',
                '-i',str(outputs/'%06d.png'),'-an','-vf',
                'scale=3840:2160:force_original_aspect_ratio=increase:flags=lanczos,crop=3840:2160',
                '-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p',
                '-movflags','+faststart',str(result)],check=True)
probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams',
                                           '-show_format','-of','json',str(result)]))
record = {'source':str(source),'output':str(result),'native4K':False,
          'model':'Real-ESRGAN realesr-general-x4v3 (official v0.2.5.0 weights)',
          'modelAliasNote':'The ncnn runner requires a supported model filename; alias is realesrgan-x4plus.',
          'frames':actual,'secondsElapsed':time.time()-started,'ffprobe':probe}
(folder/'4K_작업'/'render-result.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'completed':True,'frames':actual,'elapsedSeconds':round(time.time()-started),
                  'output':str(result)},ensure_ascii=True),flush=True)

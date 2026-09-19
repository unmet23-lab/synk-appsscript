from pathlib import Path
import subprocess,json,numpy as np
from PIL import Image
P=Path(__file__).resolve().parent
# Decode the actual public receipt, then find the strongest eyelid change.
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(P/'공개수신.mp4'),'-vf','fps=12,crop=92:48:920:370','-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
a=np.frombuffer(raw,np.uint8).reshape(-1,48,92,3);baseline=np.median(a,axis=0);scores=np.mean(np.abs(a.astype(float)-baseline),axis=(1,2,3));idx=int(np.argmax(scores));t=idx/12
subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(P/'공개수신.mp4'),'-frames:v','1',str(P/'공개수신_눈깜빡임.png')],check=True)
grid=Image.new('RGB',(92*5*3,48*3));ids=[max(0,min(len(a)-1,idx+v)) for v in [-3,-1,0,1,3]]
for i,j in enumerate(ids):grid.paste(Image.fromarray(a[j]).resize((276,144)),(i*276,0))
grid.save(P/'공개수신_눈연속.jpg',quality=95)
report={'decodedFrames':len(a),'fps':12,'peakEyeChangeTime':t,'peakMeanAbsoluteDifference':float(scores[idx]),'eyeSampleFrames':ids,'silenceDetections':len(json.loads((P/'공개수신.json').read_text(encoding='utf-8'))['silence'])}
(P/'수신눈검수.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))

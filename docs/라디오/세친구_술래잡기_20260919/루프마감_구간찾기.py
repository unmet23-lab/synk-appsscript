from pathlib import Path
import cv2, numpy as np, json
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parent
cap=cv2.VideoCapture(str(root/'H3_몽글눈웃음_4K_무음.mp4'))
frames=[]
while True:
    ok,f=cap.read()
    if not ok: break
    frames.append(cv2.resize(f,(688,384),interpolation=cv2.INTER_AREA))
cap.release()
arr=[cv2.GaussianBlur(cv2.cvtColor(f,cv2.COLOR_BGR2GRAY)[160:360,90:520],(5,5),0).astype(np.float32) for f in frames]
scores=[]
for start in range(6,30):
    for end in range(169,185):
        delta=float(np.mean(np.abs(arr[start]-arr[end])))
        velocity=float(np.mean(np.abs((arr[start+2]-arr[start])-(arr[end]-arr[end-2]))))
        scores.append({'startFrame':start,'endFrame':end,'startSeconds':start/48,'endSeconds':end/48,'poseMAE':delta,'velocityMAE':velocity,'score':delta+.2*velocity})
best=sorted(scores,key=lambda x:x['score'])[:8]
(root/'루프마감_연결후보.json').write_text(json.dumps(best,indent=2),encoding='utf-8')
sheet=Image.new('RGB',(1376,404*4))
for i,p in enumerate(best[:4]):
    for j,k in enumerate([p['startFrame'],p['endFrame']]):
        im=Image.fromarray(cv2.cvtColor(frames[k],cv2.COLOR_BGR2RGB))
        ImageDraw.Draw(im).text((10,10),f"{k/48:.3f}s - frame {k}",fill='white',stroke_width=1,stroke_fill='black')
        sheet.paste(im,(688*j,404*i))
sheet.save(root/'루프마감_연결후보.jpg',quality=95)
print(json.dumps(best[:4],indent=2))

from pathlib import Path
previous = Path(__file__).resolve().parent.parent / '재확인/background_motion_audit.py'
source = previous.read_text(encoding='utf-8')
source = source.replace("docs/라디오/무대영상/추석_자연생동_20260909.mp4", "docs/_ops/라디오생동_20260909/v2/유튜브수신_수정후.mp4")
source = source.replace('TIMES = [0, 3, 7, 15, 30, 45, 59 + 29 / 30]', 'TIMES = [0, 3, 5, 20, 30, 45, 60, 80, 100, 110]')
source = source.replace("'background_audit_", "'수신검수_")
exec(compile(source, str(__file__), 'exec'))

raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(VIDEO),'-vf','fps=5,crop=190:140:525:305','-f','rawvideo','-pix_fmt','bgr24','-'])
faces = np.frombuffer(raw,np.uint8).reshape(-1,140,190,3)
green = []
for f in faces:
    eye = f[44:92,20:161].astype(float)
    b,g,r = np.moveaxis(eye,-1,0)
    green.append(int(((g>r*1.07)&(g>b*1.15)&(g>60)).sum()))
events=[]
low=np.array(green)<max(green)*.20
for i,on in enumerate(low):
    if on and i>=10 and (not low[i-1]):
        j=i
        while j+1<len(low) and low[j+1]: j+=1
        events.append({'start_s':i/5,'end_s':(j+1)/5,'frame':(i+j)//2,'min_green_count':min(green[i:j+1])})
chosen=sorted(set([0,15,25,100,150,225,300,400,500,550]+[e['frame'] for e in events]))
sheet=np.full((int(np.ceil(len(chosen)/6))*165,6*190,3),240,np.uint8)
for n,i in enumerate(chosen):
    x,y=(n%6)*190,(n//6)*165
    sheet[y+25:y+165,x:x+190]=faces[i]
    cv2.putText(sheet,f'{i/5:.1f}s green={green[i]}',(x+3,y+18),cv2.FONT_HERSHEY_SIMPLEX,.4,(30,30,30),1,cv2.LINE_AA)
(OUT/'수신검수_얼굴.png').write_bytes(cv2.imencode('.png',sheet)[1].tobytes())
blink=np.full((165,6*190,3),240,np.uint8)
for n,i in enumerate([305,306,307,308,309,310]):
    blink[25:,n*190:(n+1)*190]=faces[i]
    cv2.putText(blink,f'{i/5:.1f}s',(n*190+3,18),cv2.FONT_HERSHEY_SIMPLEX,.4,(30,30,30),1,cv2.LINE_AA)
(OUT/'수신검수_눈깜빡연속.png').write_bytes(cv2.imencode('.png',blink)[1].tobytes())
(OUT/'수신검수_얼굴.json').write_text(json.dumps({'fps':5,'frames':len(faces),'min_green':min(green),'max_green':max(green),'low_green_intervals':events,'caveat':'Candidate selection only: open eyes can also have low green after encoding. Intervals are NOT blink or expression durations. Visually verified crops: 61.0/61.2 open, 61.4/61.6/61.8 closed, 62.0 open; 81.2 arched smile.'},ensure_ascii=False,indent=2),encoding='utf8')
print('FACE',json.dumps({'frames':len(faces),'min_green':min(green),'max_green':max(green),'events':events}))
print('sha256',report['sha256'])

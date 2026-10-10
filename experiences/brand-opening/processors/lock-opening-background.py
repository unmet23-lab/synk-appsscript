"""Cinemagraph finishing: new generated motion, fixed rigid scenery, no face overlays."""
import argparse,json,subprocess,hashlib
from pathlib import Path
import cv2,numpy as np
p=argparse.ArgumentParser();p.add_argument('--variant',choices=['portrait','landscape'],required=True);p.add_argument('--revision',default='v9');a=p.parse_args()
root=Path(__file__).resolve().parents[1];folder=root/'raw'/f'felt-trio-{a.revision}';qa=root/'qa'/f'felt-{a.revision}'/a.variant
source=folder/f'{a.variant}-omni11-1080p-{a.revision}.mp4';target=folder/f'{a.variant}-omni11-1080p-{a.revision}-locked.mp4'
metrics=json.loads((qa/'static-plate-original.json').read_text());cap=cv2.VideoCapture(str(source));fps=cap.get(cv2.CAP_PROP_FPS);ok,reference=cap.read();assert ok
h,w=reference.shape[:2];alpha=np.zeros((h,w),np.float32)
def rect(x1,y1,x2,y2,val=1):cv2.rectangle(alpha,(round(x1*w),round(y1*h)),(round(x2*w),round(y2*h)),val,-1)
def poly(points,val=1):cv2.fillPoly(alpha,[np.array([(round(x*w),round(y*h)) for x,y in points],np.int32)],val)
def ellipse(x,y,rx,ry,val=1):cv2.ellipse(alpha,(round(x*w),round(y*h)),(round(rx*w),round(ry*h)),0,0,360,val,-1)
if a.variant=='portrait':
    # Sky/clouds and high leaf tips. The entire house and tower remain rigid.
    rect(0,0,1,.366)
    poly([(0,.07),(.11,.10),(.22,.13),(.30,.18),(.35,.225),(.34,.252),(.12,.267),(.095,.505),(0,.515)],0)
    rect(.708,.301,.759,.376,0)
    # River and the original continuous boat passage, including its native occlusion.
    rect(.094,.424,.991,.516)
    # The complete trio in one continuous generated region, with room for their full motion.
    poly([(.038,.636),(.074,.598),(.089,.52),(.127,.463),(.395,.463),(.456,.51),(.606,.51),(.629,.49),(.875,.49),(.955,.545),(.951,.65),(.921,.692),(.942,.739),(.085,.739),(.038,.706)])
    # Small plant tips and light INSIDE the fixed lantern, not its frame.
    ellipse(.14,.31,.018,.016);ellipse(.018,.566,.027,.03);ellipse(.97,.35,.028,.04)
    anchors=['roof','tower','buildings']
else:
    rect(0,0,1,.441)
    poly([(0,.075),(.091,.138),(.166,.236),(.17,.278),(.149,.318),(.083,.313),(.082,.554),(0,.554)],0)
    rect(.673,.283,.709,.444,0)
    rect(.177,.506,.907,.646)
    poly([(.486,.661),(.511,.572),(.52,.487),(.592,.471),(.638,.51),(.67,.554),(.75,.55),(.763,.508),(.853,.506),(.897,.562),(.895,.759),(.882,.811),(.883,.858),(.497,.858)])
    ellipse(.059,.348,.012,.022);ellipse(.972,.585,.011,.026)
    ellipse(.123,.522,.035,.057);ellipse(.904,.419,.035,.03)
    anchors=['roof_end','pillar','tower','buildings','railing']
alpha=cv2.GaussianBlur(alpha,(0,0),3.5)
cv2.imwrite(str(qa/'motion-regions.png'),np.uint8(alpha*255))
cv2.imwrite(str(qa/'motion-region-overlay.jpg'),cv2.addWeighted(reference,.72,np.dstack((np.zeros_like(alpha),alpha*255,np.zeros_like(alpha))).astype(np.uint8),.28,0))
command=['ffmpeg','-y','-v','error','-f','rawvideo','-pixel_format','bgr24','-video_size',f'{w}x{h}','-framerate',str(fps),'-i','pipe:0','-an','-c:v','libx264','-crf','15','-preset','medium','-threads','2','-pix_fmt','yuv420p','-g','24','-keyint_min','24','-sc_threshold','0','-movflags','+faststart',str(target)]
process=subprocess.Popen(command,stdin=subprocess.PIPE);index=0;transforms=[];mask=alpha[:,:,None];fixed=reference.astype(np.float32)
referenceValue=cv2.cvtColor(reference,cv2.COLOR_BGR2HSV)[:,:,2].astype(np.int16);leafTrace=[]
while ok:
    row=metrics['rows'][index]['anchors'];good=[(row[n]['dx'],row[n]['dy']) for n in anchors if row[n]['valid']]
    if len(good)<2:raise RuntimeError('Insufficient fixed scenery anchors')
    dx,dy=np.median(good,axis=0);matrix=np.array([[1,0,-dx],[0,1,-dy]],np.float32)
    moving=cv2.warpAffine(reference if index==0 else frame,matrix,(w,h),flags=cv2.INTER_LANCZOS4,borderMode=cv2.BORDER_REFLECT_101)
    frameMask=mask
    if a.variant=='landscape':
        # The generated shot contains falling green leaves. Preserve their complete
        # continuous passage across the static skyline, rather than cutting them
        # off at the sky/river region edges. Only original source pixels are used.
        hsv=cv2.cvtColor(moving,cv2.COLOR_BGR2HSV);blue,green,red=cv2.split(moving)
        leaf=((hsv[:,:,0]>25)&(hsv[:,:,0]<90)&(hsv[:,:,1]>65)&(referenceValue-hsv[:,:,2].astype(np.int16)>35)&(green.astype(np.float32)>red*.95)).astype(np.uint8)*255
        leaf[:round(.26*h)]=0;leaf[round(.84*h):]=0;leaf[:,:round(.13*w)]=0;leaf[:,round(.95*w):]=0
        leaf=cv2.morphologyEx(leaf,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
        count,labels,stats,centers=cv2.connectedComponentsWithStats(leaf);keep=np.zeros((h,w),np.uint8)
        for k in range(1,count):
            lx,ly,lw,lh,area=stats[k]
            if 45<area<3000 and lw>5 and lh>5:
                # Keep the complete source leaf, including its pale edge and stem,
                # instead of clipping the object to a saturated green core.
                cv2.ellipse(keep,(int(lx+lw/2),int(ly+lh/2)),(int(lw/2+40),int(lh/2+24)),0,0,360,255,-1)
                leafTrace.append({'frame':index,'center':[float(c) for c in centers[k]],'area':int(area)})
        leafAlpha=cv2.GaussianBlur(keep.astype(np.float32)/255,(0,0),3.5)
        frameMask=np.maximum(alpha,leafAlpha)[:,:,None]
    output=np.uint8(np.clip(moving.astype(np.float32)*frameMask+fixed*(1-frameMask),0,255))
    process.stdin.write(output.tobytes());transforms.append({'frame':index,'dx':float(dx),'dy':float(dy)})
    index+=1;ok,frame=cap.read()
process.stdin.close();code=process.wait();cap.release();assert code==0
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
record={'date':'2026-10-10','source':str(source.relative_to(root)),'sourceSha256':sha(source),'file':str(target.relative_to(root)),'sha256':sha(target),'frames':index,'fps':fps,'width':w,'height':h,'duration':index/fps,'method':'New Omni v9 motion is kept in sky/clouds, river/boat, the whole trio, leaf tips and lantern interiors. Median fixed-architecture registration removes common translation from that motion. Rigid scenery is the first frame of the SAME NEW video. Region edges feather 3.5px. No individual face, eye, head or boat overlay, no reverse/retime/frozen tail, no crop/zoom, original native dimensions and 240-frame duration.','reason':'Both new Omni image generations retained source-level micro-jitter despite locked-camera prompts; original files retained as failed stability candidates.','motionMask':'motion-regions.png','transforms':transforms}
(qa/'background-lock.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
if a.variant=='landscape':
    record['foregroundLeafPreservation']='Source-only full-leaf motion envelopes extend across skyline boundaries; 40px horizontal and 24px vertical padding preserve pale edges and stems, with 3.5px feather. No synthesized or separately animated leaves.'
    record['leafTrace']=leafTrace;(qa/'background-lock.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:record[k] for k in ['file','frames','fps','duration','sha256']}))

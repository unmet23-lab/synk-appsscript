from pathlib import Path
import subprocess, json, hashlib
import cv2
import numpy as np

ROOT=Path.cwd(); OUT=Path(__file__).resolve().parent
VIDEO=ROOT/'docs/_ops/라디오생동_20260909/v3/생성_A_15초.mp4'
OUT.mkdir(parents=True,exist_ok=True)
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(VIDEO),'-vf','fps=2','-f','rawvideo','-pix_fmt','bgr24','-'])
frames=np.frombuffer(raw,np.uint8).reshape(-1,720,1280,3)
def save(name,img): (OUT/name).write_bytes(cv2.imencode('.png',img)[1].tobytes())
def grid(rect,scale,name):
    x1,y1,x2,y2=rect
    crop=frames[0,y1:y2,x1:x2].copy()
    for x in range((x1//20+1)*20,x2,20):
        cv2.line(crop,(x-x1,0),(x-x1,y2-y1-1),(125,125,125),1)
        cv2.putText(crop,str(x),(x-x1+1,10),cv2.FONT_HERSHEY_SIMPLEX,.25,(240,240,240),1)
    for y in range((y1//20+1)*20,y2,20):
        cv2.line(crop,(0,y-y1),(x2-x1-1,y-y1),(125,125,125),1)
        cv2.putText(crop,str(y),(2,y-y1-2),cv2.FONT_HERSHEY_SIMPLEX,.25,(240,240,240),1)
    save(name,cv2.resize(crop,None,fx=scale,fy=scale,interpolation=cv2.INTER_NEAREST))
grid((1020,70,1280,450),2,'영역_오른쪽_좌표.png')
grid((175,300,430,425),3,'영역_왼창_좌표.png')
grid((1100,307,1250,436),4,'영역_오른창_좌표.png')

# Sparse validated feature travel helps distinguish branch motion from codec noise.
g0=cv2.cvtColor(frames[0],cv2.COLOR_BGR2GRAY)
mask=np.zeros_like(g0); mask[82:465,1080:]=255
points=cv2.goodFeaturesToTrack(g0,500,.01,4,mask=mask)
all_motion=[]
for i,frame in enumerate(frames):
    g=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
    q,s,_=cv2.calcOpticalFlowPyrLK(g0,g,points,None,winSize=(21,21),maxLevel=3)
    back,sb,_=cv2.calcOpticalFlowPyrLK(g,g0,q,None,winSize=(21,21),maxLevel=3)
    good=(s.ravel()==1)&(sb.ravel()==1)&(np.linalg.norm(back-points,axis=2).ravel()<.7)
    p=points.reshape(-1,2)[good]; q=q.reshape(-1,2)[good]
    mag=np.linalg.norm(q-p,axis=1)
    keep=mag>.55
    all_motion.extend(np.vstack([p[keep],q[keep]]).tolist())

# Connected pale cloud component; thin low-contrast fibres still need visual review.
cloud_bounds=[]
for i,frame in enumerate(frames):
    cut=frame[82:163,995:1205]
    hsv=cv2.cvtColor(cut,cv2.COLOR_BGR2HSV)
    h,s,v=cv2.split(hsv)
    pale=((s<88)&(v>139)).astype(np.uint8)
    pale=cv2.morphologyEx(pale,cv2.MORPH_CLOSE,np.ones((3,5),np.uint8))
    n,lab,stat,cent=cv2.connectedComponentsWithStats(pale)
    candidates=[j for j in range(1,n) if stat[j,4]>30 and stat[j,0]<75 and 12<cent[j,1]<65]
    if candidates:
        j=max(candidates,key=lambda k:stat[k,4]); x,y,w,h,area=stat[j]
        cloud_bounds.append({'time_s':i/2,'bbox':[int(x+995),int(y+82),int(x+w-1+995),int(y+h-1+82)]})

motion=np.array(all_motion)
report={'video':str(VIDEO),'sha256':hashlib.sha256(VIDEO.read_bytes()).hexdigest(),
    'samples_2fps':len(frames),'right_upper_region_feature_motion_gt_0_55_bbox':
        [float(motion[:,0].min()),float(motion[:,1].min()),float(motion[:,0].max()),float(motion[:,1].max())] if len(motion) else None,
    'cloud_pale_component_bounds':cloud_bounds,
    'limitations':['Feature bbox includes cloud and tree; final object boundary requires visual classification.',
        'Thin fibre extent below colour threshold is not guaranteed by pale component bbox.']}
(OUT/'영역_측정.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
save('영역_원본.png',frames[0])

# Provisional conservative static polygon; both object extent and cloud gap are reviewed visually.
poly=np.array([[1196,88],[1279,88],[1279,468],[1074,468],
    [1074,240],[1117,215],[1127,148],[1196,148]],np.int32)
proposal=frames[0].copy()
cv2.polylines(proposal,[poly],True,(50,200,255),1,cv2.LINE_AA)
save('영역_고정경계제안.png',proposal)

windows={
    'left_1':[(204,321),(267,321),(267,390),(205,390)],
    'left_2':[(339,320),(405,321),(405,392),(339,391)],
    'right_narrow':[(1119,330),(1135,333),(1134,404),(1118,398)],
    'right_large':[(1192,329),(1226,330),(1225,408),(1191,401)],
}
window_img=frames[0].copy()
for name,pts in windows.items():
    cv2.polylines(window_img,[np.array(pts,np.int32)],True,(60,220,90),1,cv2.LINE_AA)
save('영역_창문다각형제안.png',window_img)
report['static_polygon_proposal']=poly.tolist()
tree_motion=np.array([p for p in motion if cv2.pointPolygonTest(poly,(float(p[0]),float(p[1])),False)>=0])
report['tree_feature_travel_gt_0_55_bbox_inside_proposed_patch']=[float(tree_motion[:,0].min()),float(tree_motion[:,1].min()),float(tree_motion[:,0].max()),float(tree_motion[:,1].max())]
report['window_polygons_proposal']=windows
fixed=np.zeros((720,1280),np.uint8); cv2.fillPoly(fixed,[poly],1)
distance=cv2.distanceTransform(1-fixed,cv2.DIST_L2,5)
cloud_union=np.zeros((720,1280),np.uint8)
for frame in frames:
    hsv=cv2.cvtColor(frame[88:164,1060:1205],cv2.COLOR_BGR2HSV)
    h,s,v=cv2.split(hsv)
    pale=((s<95)&(v>128)).astype(np.uint8)
    pale=cv2.morphologyEx(pale,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    n,lab,stat,cent=cv2.connectedComponentsWithStats(pale)
    candidates=[j for j in range(1,n) if stat[j,0]<5 and stat[j,4]>80]
    if candidates:
        j=max(candidates,key=lambda k:stat[k,4]); cloud_union[88:164,1060:1205]|=(lab==j).astype(np.uint8)
report['pale_cloud_union_distance_to_proposed_fixed_polygon_px']=float(distance[cloud_union>0].min())
report['pale_cloud_union_pixels_inside_fixed_polygon']=int((cloud_union*fixed).sum())
(cy,cx)=np.where(cloud_union)
report['pale_outer_cloud_union_bbox']=[int(cx.min()),int(cy.min()),int(cx.max()),int(cy.max())]
(OUT/'영역_측정.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report,ensure_ascii=True))

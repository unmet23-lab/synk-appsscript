"""Measure fixed architecture at native pixel resolution, without changing video."""
import argparse,json,hashlib
from pathlib import Path
import cv2,numpy as np

p=argparse.ArgumentParser();p.add_argument('video',type=Path);p.add_argument('output',type=Path);p.add_argument('--variant',choices=['portrait','landscape'],required=True);a=p.parse_args()
points={'portrait':{'roof':(.23,.18),'beam':(.1,.23),'pillar':(.041,.407),'tower':(.736,.34),'buildings':(.518,.412),'deck':(.60,.76),'deck_left':(.27,.744)},'landscape':{'roof':(.06,.27),'roof_end':(.148,.233),'pillar':(.022,.452),'tower':(.691,.35),'buildings':(.471,.477),'railing':(.243,.691),'deck':(.375,.823),'deck_front':(.69,.885)}}[a.variant]
def peak(v,k):
    if k==0 or k==len(v)-1:return 0.
    u,z,w=map(float,v[k-1:k+2]);den=u-2*z+w
    return .5*(u-w)/den if abs(den)>1e-9 else 0.
def match(gray,x,y,tpl):
    r=20;search=12;left=x-r-search;top=y-r-search
    window=gray[top:y+r+search+1,left:x+r+search+1]
    corr=cv2.matchTemplate(window,tpl,cv2.TM_CCOEFF_NORMED)
    _,score,_,(px,py)=cv2.minMaxLoc(corr)
    return np.array([left+px+peak(corr[py,:],px)+r-x,top+py+peak(corr[:,px],py)+r-y]),score
cap=cv2.VideoCapture(str(a.video));fps=cap.get(cv2.CAP_PROP_FPS);ok,frame=cap.read();assert ok
h,w=frame.shape[:2];gray=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY);r=20
templates={}
for name,(x,y) in points.items():
    x,y=round(x*w),round(y*h);tpl=gray[y-r:y+r+1,x-r:x+r+1].copy();offset,_=match(gray,x,y,tpl)
    templates[name]=(x,y,tpl,offset)
positions=[];scores=[];rows=[];index=0
while ok:
    gray=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY);pos=[];quality=[]
    for name,(x,y,tpl,offset) in templates.items():
        d,c=match(gray,x,y,tpl);pos.append(d-offset);quality.append(c)
    positions.append(pos);scores.append(quality);rows.append({'frame':index,'time':index/fps,'anchors':{name:{'dx':round(float(d[0]),4),'dy':round(float(d[1]),4),'correlation':round(float(c),4),'valid':bool(c>=.92)} for name,d,c in zip(templates,pos,quality)}})
    index+=1;ok,frame=cap.read()
cap.release();positions=np.asarray(positions);scores=np.asarray(scores);valid=scores>=.92
summary={};all_moves=[];anchor_passes=[]
for j,name in enumerate(templates):
    pair=valid[:-1,j]&valid[1:,j];steps=np.linalg.norm(np.diff(positions[:,j],axis=0),axis=1);moves=steps[pair]
    drift=np.linalg.norm(positions[:,j],axis=1)[valid[:,j]]
    coverage=float(valid[:,j].mean());p95=float(np.percentile(moves,95)) if len(moves) else None;maxstep=float(moves.max()) if len(moves) else None
    bands=[]
    for start,end in [(0,2.5),(2.5,5),(5,8),(8,10)]:
        ids=np.arange(len(steps));mask=pair&(ids/fps>=start)&(ids/fps<end);v=steps[mask]
        bands.append({'start':start,'end':end,'validPairs':len(v),'p95':round(float(np.percentile(v,95)),4) if len(v) else None,'max':round(float(v.max()),4) if len(v) else None})
    seam=float(np.linalg.norm(positions[-1,j]-positions[0,j])) if valid[-1,j] else None
    bands_pass=all(b['validPairs']>0 and b['p95']<=.35 for b in bands)
    passed=coverage>=.95 and p95<=.35 and maxstep<=.75 and float(drift.max())<=1. and seam is not None and seam<=.75 and bands_pass
    summary[name]={'coverage':round(coverage,4),'minimumCorrelation':round(float(scores[:,j].min()),4),'adjacentP95Px':round(p95,4) if p95 is not None else None,'adjacentMaxPx':round(maxstep,4) if maxstep is not None else None,'maxDriftPx':round(float(drift.max()),4) if len(drift) else None,'loopSeamPx':round(float(np.linalg.norm(positions[-1,j]-positions[0,j])),4) if valid[-1,j] else None,'bands':bands,'passesTarget':passed}
    all_moves.extend(moves.tolist());anchor_passes.append(passed)
common=[];residual=[];transforms=[];base=np.array([(x,y) for x,y,_,_ in templates.values()],dtype=np.float32)
for i in range(len(positions)):
    keep=valid[i]
    if sum(keep)<4:common.append([np.nan,np.nan]);residual.append(np.nan);transforms.append(None);continue
    d=positions[i,keep];med=np.median(d,axis=0);common.append(med.tolist());residual.append(float(np.percentile(np.linalg.norm(d-med,axis=1),95)))
    matrix,_=cv2.estimateAffinePartial2D(base[keep],base[keep]+d.astype(np.float32),method=cv2.LMEDS)
    transforms.append({'tx':float(matrix[0,2]),'ty':float(matrix[1,2]),'rotationDegrees':float(np.degrees(np.arctan2(matrix[1,0],matrix[0,0]))),'scale':float(np.hypot(matrix[0,0],matrix[1,0]))} if matrix is not None else None)
common=np.array(common);commonsteps=np.linalg.norm(np.diff(common,axis=0),axis=1);good=commonsteps[np.isfinite(commonsteps)]
result={'file':str(a.video.resolve()),'sha256':hashlib.sha256(a.video.read_bytes()).hexdigest(),'variant':a.variant,'width':w,'height':h,'fps':fps,'frames':len(rows),'method':'Native-resolution fixed first-frame architecture templates, subpixel normalized correlation; first-frame interpolation bias subtracted. Occluded/changed patches below correlation .92 excluded, coverage reported. No water/boat/leaf patches. Multiple-point median common displacement and similarity fit reported separately. Image texture changes can affect measurements.','target':{'meaning':'Project QA target, not an industry standard; must also pass visual review and movement checks','minimumCoverage':.95,'adjacentP95Px':.35,'adjacentMaxPx':.75,'maxDriftPx':1},'numericTargetPassed':all(anchor_passes),'passingAnchors':sum(anchor_passes),'totalAnchors':len(anchor_passes),'commonAdjacentP95Px':round(float(np.percentile(good,95)),4),'commonAdjacentMaxPx':round(float(good.max()),4),'residualP95Px':round(float(np.nanpercentile(residual,95)),4),'anchors':summary,'rows':rows,'commonDisplacement':common.tolist(),'similarityFits':transforms}
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:result[k] for k in ['variant','frames','numericTargetPassed','passingAnchors','totalAnchors','commonAdjacentP95Px','commonAdjacentMaxPx','residualP95Px']}))
print(json.dumps({name:{k:v[k] for k in ['coverage','adjacentP95Px','adjacentMaxPx','maxDriftPx','loopSeamPx','passesTarget']} for name,v in summary.items()}))

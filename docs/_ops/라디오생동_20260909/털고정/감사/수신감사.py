"""Read-only stream video sampling; QA derivatives stay beside this script."""
from pathlib import Path
import cv2
import numpy as np
import json
import hashlib
import subprocess

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[4]
NEW=OUT.parent/'유튜브수신_털고정.mp4'
OLD=OUT.parent.parent/'v4/유튜브수신_나무조명.mp4'

def save(name, im):
    cv2.imencode('.png',im)[1].tofile(str(OUT/name))

def extract(path,t):
    cap=cv2.VideoCapture(str(path)); cap.set(cv2.CAP_PROP_POS_MSEC,t*1000)
    ok, im=cap.read(); cap.release()
    assert ok, (path,t)
    return im

def main():
    for tag,path in [('new',NEW),('old',OLD)]:
        cap=cv2.VideoCapture(str(path))
        print(tag,cap.get(cv2.CAP_PROP_FPS),cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()
        save(f'수신감사_{tag}_0.png',extract(path,0))
    cap=cv2.VideoCapture(str(NEW))
    samples=[]
    frame_count=0
    while True:
        ok,im=cap.read()
        if not ok: break
        if frame_count%6==0:
            eye=im[352:409,548:684]
            b,g,r=cv2.split(eye)
            green=(g.astype(int)>r.astype(int)+5)&(g.astype(int)>b.astype(int)+4)
            samples.append({'t':frame_count/30,'frame':im,'eye':eye,'green':int(green.sum())})
        frame_count+=1
    cap.release()
    # Times and minima guide visual inspection, not automatic expression naming.
    selected=[0,25,50,100,150,200,250,300,350,400,449]
    low=[]
    for i in sorted(range(len(samples)),key=lambda i:samples[i]['green']):
        if all(abs(samples[i]['t']-samples[j]['t'])>1.4 for j in low): low.append(i)
        if len(low)>=13: break
    selected=sorted(set(selected+low))
    tiles=[]
    for idx in selected:
        sm=samples[idx]
        tile=np.zeros((186,272,3),np.uint8)
        tile[30:]=cv2.resize(sm['frame'][302:440,508:749],(272,156),interpolation=cv2.INTER_AREA)
        cv2.putText(tile,f"{sm['t']:05.1f}s green={sm['green']}",(5,20),cv2.FONT_HERSHEY_SIMPLEX,.5,(255,255,255),1,cv2.LINE_AA)
        tiles.append(tile)
    while len(tiles)%4: tiles.append(np.zeros_like(tiles[0]))
    save('수신감사_눈표본.png',np.vstack([np.hstack(tiles[i:i+4]) for i in range(0,len(tiles),4)]))
    comparison=[]
    for path,name in [(OLD,'OLD v4'),(NEW,'NEW receiving')]:
        for t in [0,30,85]:
            im=extract(path,t)
            tile=np.zeros((370,350,3),np.uint8)
            tile[30:]=im[280:620,475:825]
            description='OLD prefix' if path==NEW and t==0 else name
            cv2.putText(tile,f'{description} / {t}s / 1:1',(5,20),cv2.FONT_HERSHEY_SIMPLEX,.48,(255,255,255),1,cv2.LINE_AA)
            comparison.append(tile)
    save('수신감사_전후동일크기.png',np.vstack([np.hstack(comparison[:3]),np.hstack(comparison[3:])]))
    rois={'forehead':[555,320,676,350],'left_cheek':[539,402,564,429],'blue_garment':[551,471,592,520]}
    roi_changes={}
    for name,(x0,y0,x1,y1) in rois.items():
        diffs=[]
        for previous,current in zip(samples,samples[1:]):
            a=previous['frame'][y0:y1,x0:x1].astype(float)
            b=current['frame'][y0:y1,x0:x1].astype(float)
            diffs.append(float(np.abs(a-b).mean()))
        roi_changes[name]={'bbox_xyxy': [x0,y0,x1,y1], 'adjacent_0p2sec_mean_absolute_difference_median':float(np.median(diffs)),
                           'adjacent_0p2sec_mean_absolute_difference_p95':float(np.percentile(diffs,95)),
                           'largest_sample_pairs':sorted([{'from':samples[i]['t'],'to':samples[i+1]['t'],'mae':v} for i,v in enumerate(diffs)],key=lambda r:r['mae'],reverse=True)[:8]}
    probe=subprocess.run(['ffmpeg','-v','error','-i',str(NEW),'-map','0:v:0','-f','null','-'],capture_output=True,text=True)
    expression_pairs=[]
    for path,tag,t0,t1 in [(OLD,'old_open_to_closed',0,60),(NEW,'new_open_to_closed',20,20.4),(NEW,'new_open_to_closed',30,31)]:
        a,b=extract(path,t0).astype(float),extract(path,t1).astype(float)
        d=np.abs(a-b)
        expression_pairs.append({'source':tag,'from_seconds':t0,'to_seconds':t1,
                                 'eyes_roi_mae':float(d[352:401,557:678].mean()),
                                 'cheek_fur_below_eyes_mae':float(d[404:443,566:674].mean()),
                                 'blue_garment_mae':float(d[471:520,551:592].mean())})
    result={'source':str(NEW),'sha256':hashlib.sha256(NEW.read_bytes()).hexdigest(),'decoded_frame_count':frame_count,
            'candidate':'first live rim helper: 6px; retained for comparison, not final acceptance',
            'overall_verdict':'needs edge-integration improvement; do not report complete',
            'fur_expression_verdict':'improvement confirmed in sampled received open/closed states',
            'edge_verdict':'visible bright lower-belly/hand rim remains; first candidate rejected for final edge-quality acceptance',
            'sample_interval_seconds':0.2,'sample_count':len(samples),'full_decode_exit_code':probe.returncode,'full_decode_errors':probe.stderr,
            'eye_contact_times':[samples[i]['t'] for i in selected], 'roi_diagnostics':roi_changes,
            'all_eye_green_samples':[{'t':s['t'],'green_pixels':s['green']} for s in samples],
            'selected_open_closed_comparisons':expression_pairs,
            'visually_confirmed_expression_states':['base open eyes','closed-eye/blink state','focus: short narrow horizontal green eyelids at85seconds'],
            'unconfirmed_expression_states':['smile as a separate full target state','curious','relief','cheer','surprise'],
            'visual_findings':[
                'The received recording starts with the old mascot for about0-4seconds. Around4.4-7.6seconds the character moves out below the frame and returns. This is a whole-character entry/exit transition, not evidence of fur instability.',
                'At10seconds and the inspected later samples through89.8seconds, the fixed-fur candidate is visible. Open-eye and closed-eye states are both present; the old broad face-fur replacement around blinking no longer appears in these sampled new states.',
                'Inspected new samples at20/20.4,30/31seconds retain the same forehead, lower cheek fur, blue clothes, ties, sign and body silhouette. Nonzero codec differences are expected; no claim of decoded-stream pixel equality is made.',
                'The shadow in later new frames is closer to the lower body than in the old recording/prefix. The scene still intentionally depicts a footless floating mascot; changed grounding does not mean feet or physical floor contact were added.',
                'At matching1:1 display size the new body still has a visible bright cream outline, particularly the lower belly and outer hands. The lower-belly line appears more continuous/clearer than the old received version. Therefore edge blending is not fully resolved despite confirmed new-asset delivery.',
                'The eight local candidate expressions were separately pixel-audited earlier, but this90second broadcast sample does not independently demonstrate all eight full expression states.'
            ],
            'limits':['Encoded public-receiving video: exact pixel equality is not expected or claimed.',
                      'Frame samples and contacts inspected, not a continuous-human-viewing claim.',
                      'Any zero values in individual numeric ROIs are narrow actual samples/codec reuse, not a claim that broadcast pixels or all fur stay exactly identical across the recording.',
                      'ROI changes can reflect existing mascot greeting/transition position as well as compression; not an automatic fur defect verdict.'],
            'source_server_git_modified':False}
    (OUT/'수신감사.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'sample_times':result['eye_contact_times'],'selected_open_closed_comparisons':expression_pairs,
                      'decode_exit_code':probe.returncode,'frame_count':frame_count},ensure_ascii=False,indent=2))

if __name__=='__main__': main()

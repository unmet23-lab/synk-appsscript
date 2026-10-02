"""Second received rim-correction comparison. No source/video modifications."""
from pathlib import Path
import cv2
import numpy as np
import hashlib
import json
import subprocess

OUT=Path(__file__).resolve().parent
FIRST=OUT.parent/'유튜브수신_털고정.mp4'
SECOND=OUT.parent/'유튜브수신_경계2.mp4'
TIMES=[20,50,85]

def get_frame(path,t):
    cap=cv2.VideoCapture(str(path)); cap.set(cv2.CAP_PROP_POS_MSEC,t*1000)
    ok,frame=cap.read(); cap.release()
    assert ok,(path,t)
    return frame

def save(name,im):
    cv2.imencode('.png',im)[1].tofile(str(OUT/name))

def main():
    receipt=json.loads(SECOND.with_suffix('.json').read_text(encoding='utf-8-sig'))
    assert receipt.get('finished') and float(receipt['probe']['format']['duration'])>=89.9
    first=[get_frame(FIRST,t) for t in TIMES]
    second=[get_frame(SECOND,t) for t in TIMES]
    tiles=[]
    for title,frames in [('FIRST / 6px',first),('SECOND / 12px',second)]:
        for t,frame in zip(TIMES,frames):
            tile=np.zeros((370,350,3),np.uint8)
            tile[30:]=frame[280:620,475:825]
            cv2.putText(tile,f'{title} / {t}s / 1:1',(5,20),cv2.FONT_HERSHEY_SIMPLEX,.48,(255,255,255),1,cv2.LINE_AA)
            tiles.append(tile)
    save('수신감사_경계2_전후.png',np.vstack([np.hstack(tiles[:3]),np.hstack(tiles[3:])]))
    save('수신감사_경계2_50초.png',second[1])
    # Paired enlargement is diagnostic only; no original media edits.
    edge_tiles=[]
    for title,frame in [('FIRST',first[1]),('SECOND',second[1])]:
        crop=frame[536:570,541:692]
        tile=np.zeros((132,453,3),np.uint8)
        tile[30:]=cv2.resize(crop,(453,102),interpolation=cv2.INTER_NEAREST)
        cv2.putText(tile,title+' lower belly x3',(5,20),cv2.FONT_HERSHEY_SIMPLEX,.5,(255,255,255),1,cv2.LINE_AA)
        edge_tiles.append(tile)
    save('수신감사_경계2_아랫배.png',np.vstack(edge_tiles))
    decode=subprocess.run(['ffmpeg','-v','error','-i',str(SECOND),'-map','0:v:0','-f','null','-'],capture_output=True,text=True)
    report={'source':str(SECOND),'sha256':hashlib.sha256(SECOND.read_bytes()).hexdigest(),
            'reference':str(FIRST),'reference_sha256':hashlib.sha256(FIRST.read_bytes()).hexdigest(),
            'receipt':receipt,'sample_times_seconds':TIMES,'pixel_display_scale':'1280x720 source crop shown1:1, no crop resizing',
            'full_decode_exit_code':decode.returncode,'full_decode_errors':decode.stderr,
            'visual_findings':[
                'At received20,50,85seconds the second correction is visible. Compared with the first correction at the same display scale, the lower-belly bright contour is weaker and less like a continuous hard white line.',
                'The1:1 crops and full1280x720 frame show brown fur tips blending more softly into the pale courtyard. Ear tips, hand shapes, tail, blue clothing, cream ties and sign remain recognizable and intact; no obvious wholesale silhouette erosion, missing tufts or overall blur is visible.',
                'Warm pale fur remains on the ears, hands and lower belly. In these frames it reads more like light catching fur tips than the first correction\'s sticker-like rim. This is a qualitative visual judgment, not a claim of physically perfect scene relighting or complete removal of all bright edge pixels.',
                'The three samples show differing eye openness while the surrounding face fur, clothes and body outline remain visually consistent. These samples do not establish delivery of all eight named expressions.',
                'The raised soft ground shadow remains present. The mascot still has the intentionally footless, floating appearance; this audit does not interpret that approved design as a compositing failure.',
                'Further broad edge removal is not recommended from this evidence: the main hard-line issue is reduced and more removal risks thinning the accepted furry silhouette.'
            ],
            'verdict':'Scoped visual acceptance: second correction improves the bright sticker-like contour without obvious over-trimming; retain natural pale fur. Not a full8-expression or continuous-viewing certification.',
            'limits':['Three late received frames inspected, not all eight expressions or continuous human playback.',
                      'Lossy broadcast encoding: decoded pixel equality is neither required nor claimed.',
                      'Natural light-colored fur is not automatically a compositing defect; assess the continuous bright contour separately.'],
            'source_server_git_modified':False}
    (OUT/'수신감사_경계2.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'duration':receipt['probe']['format']['duration'],'decode_exit_code':decode.returncode,'samples':TIMES},indent=2))

if __name__=='__main__': main()

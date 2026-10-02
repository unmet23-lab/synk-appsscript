"""Independent, read-only decoded-video QA; numerical motion is NOT visual approval.

python <this.py> <video.mp4> [--out <folder>] [--sample-fps 2]
Writes only its own QA files. Does not alter the source video or a live service.
"""
import argparse
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import subprocess

import cv2
import numpy as np

SIZE = (1280, 720)
STATIC = {
    'left_roof': (25, 150, 520, 317),
    'left_columns': (135, 305, 490, 444),
    'right_roof_clear': (1028, 254, 1106, 302),
    'right_columns': (1048, 321, 1276, 450),
    'ground': (145, 458, 1095, 570),
    'logo': (45, 580, 236, 680),
    'wall': (535, 310, 1000, 425),
}
MOVING = {
    'moon': (787, 33, 1007, 257),
    'cloud_left': (621, 153, 835, 214),
    'cloud_right': (985, 86, 1177, 160),
    'tree_top_fruit': (1202, 98, 1279, 193),
    'tree_mid_branch': (1120, 145, 1235, 216),
    'tree_lower_branch': (1105, 221, 1279, 311),
    'tree_trunk': (1231, 184, 1279, 335),
}
REGIONS = STATIC | MOVING


def run(args):
    return subprocess.check_output(args)


def crop(frame, rect):
    x1, y1, x2, y2 = rect
    return frame[y1:y2, x1:x2]


def gray(frame):
    return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)


def save(path, frame):
    path.write_bytes(cv2.imencode('.png', frame)[1].tobytes())


def flow(a, b, mask=None):
    """Forward/backward checked feature motion, with fit residual as a warp clue."""
    ga, gb = gray(a), gray(b)
    points = cv2.goodFeaturesToTrack(ga, 600, .012, 5, mask=mask)
    result = {'available': False}
    if points is None or len(points) < 6:
        return result
    q, ok, _ = cv2.calcOpticalFlowPyrLK(ga, gb, points, None, winSize=(25,25), maxLevel=4)
    back, back_ok, _ = cv2.calcOpticalFlowPyrLK(gb, ga, q, None, winSize=(25,25), maxLevel=4)
    good = (ok.ravel()==1) & (back_ok.ravel()==1) & (np.linalg.norm(back-points, axis=2).ravel()<.8)
    p, q = points.reshape(-1,2)[good], q.reshape(-1,2)[good]
    result.update(detected=len(points), tracked=len(p), tracked_fraction=float(len(p)/len(points)))
    if len(p)<6:
        return result
    displacement=q-p
    length=np.linalg.norm(displacement,axis=1)
    matrix, inliers=cv2.estimateAffinePartial2D(p,q,method=cv2.RANSAC,ransacReprojThreshold=1.1)
    result.update(available=True, median_vector_px=np.median(displacement,axis=0).tolist(),
        median_px=float(np.median(length)),p95_px=float(np.percentile(length,95)))
    if matrix is not None:
        projected=cv2.transform(p[None,:,:],matrix)[0]
        residual=np.linalg.norm(projected-q,axis=1)
        center=np.array([ga.shape[1]/2,ga.shape[0]/2,1.])
        center_drift=matrix@center-center[:2]
        result.update(rotation_degrees=float(np.degrees(np.arctan2(matrix[1,0],matrix[0,0]))),
            scale=float(np.hypot(matrix[0,0],matrix[1,0])),center_drift_px=center_drift.tolist(),
            affine_inlier_fraction=float(inliers.mean()), nonrigid_residual_p95_px=float(np.percentile(residual,95)),
            matrix=matrix.tolist())
    return result


def appearance(a,b):
    """Brightness-compensated edge differences; texture changes remain only a clue."""
    ga,gb=gray(a).astype(np.float32),gray(b).astype(np.float32)
    rgb_delta=np.abs(a.astype(np.float32)-b.astype(np.float32))
    gb_norm=gb-float(np.median(gb-ga))
    ea=cv2.Laplacian(cv2.GaussianBlur(ga,(0,0),.7),cv2.CV_32F)
    eb=cv2.Laplacian(cv2.GaussianBlur(gb_norm,(0,0),.7),cv2.CV_32F)
    return {'rgb_mean_abs_delta_255':float(rgb_delta.mean()),
        'luma_mean_delta_255':float(gb.mean()-ga.mean()),
        'edge_mean_abs_delta':float(np.abs(ea-eb).mean()),
        'note':'Edge variation can include codec noise or legitimate light; inspect actual pixels.'}


def moon_shape(frame):
    """Heuristic visible warm disk ellipse, not proof of a geometrically correct moon."""
    cut=crop(frame,(754,4,1044,289))
    hsv=cv2.cvtColor(cut,cv2.COLOR_BGR2HSV)
    h,s,v=cv2.split(hsv)
    mask=((h>=8)&(h<=42)&(s>=28)&(s<=190)&(v>=145)).astype(np.uint8)*255
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
    contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    if not contours:
        return {'available':False}
    contour=max(contours,key=cv2.contourArea)
    if len(contour)<5:
        return {'available':False}
    (x,y),(w,h),angle=cv2.fitEllipse(contour)
    area=cv2.contourArea(contour)
    perimeter=cv2.arcLength(contour,True)
    return {'available':True,'center_px':[x+754,y+4], 'axes_px':[w,h],
        'axis_ratio':float(min(w,h)/max(w,h)), 'area_px':float(area),
        'circularity':float(4*math.pi*area/max(perimeter*perimeter,1)),
        'note':'Cloud occlusion and warm halo affect this estimate; visual contour review required.'}


def contact(frames,times,rect,columns=4):
    pieces=[crop(f,rect) for f in frames]
    h,w=pieces[0].shape[:2]
    result=np.full((math.ceil(len(pieces)/columns)*(h+24),columns*w,3),240,np.uint8)
    for i,(t,piece) in enumerate(zip(times,pieces)):
        x,y=(i%columns)*w,(i//columns)*(h+24)
        result[y+24:y+24+h,x:x+w]=piece
        cv2.putText(result,f'{t:.3f}s',(x+4,y+17),cv2.FONT_HERSHEY_SIMPLEX,.45,(30,30,30),1,cv2.LINE_AA)
    return result


def decode_at(video,t):
    raw=run(['ffmpeg','-v','error','-ss',f'{t:.6f}','-i',str(video),'-frames:v','1',
        '-vf','scale=1280:720:flags=lanczos','-f','rawvideo','-pix_fmt','bgr24','-'])
    return np.frombuffer(raw,np.uint8).reshape(720,1280,3)


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('video',type=Path)
    ap.add_argument('--out',type=Path,default=Path(__file__).resolve().parent/'독립결과')
    ap.add_argument('--sample-fps',type=float,default=2.)
    ap.add_argument('--reference',type=Path,default=Path.cwd()/'docs/Loom_자산/라디오생동/추석_기준.png')
    args=ap.parse_args()
    video=args.video.resolve(strict=True)
    if not .5<=args.sample_fps<=5:
        ap.error('sample fps must be 0.5..5')
    meta=json.loads(run(['ffprobe','-v','error','-select_streams','v:0','-show_entries',
        'stream=width,height,avg_frame_rate,nb_frames,duration:format=duration,size','-of','json',str(video)]))
    stream=meta['streams'][0]
    duration=float(stream.get('duration') or meta['format']['duration'])
    fps=float(Fraction(stream['avg_frame_rate']))
    if duration>180 or duration<=0:
        ap.error('audit bounded to videos longer than zero and at most 180 seconds')
    if abs(stream['width']/stream['height']-16/9)>.02:
        ap.error('expected 16:9; do not distort another composition into the audit ROIs')
    out=args.out.resolve()
    if video==out or video.is_relative_to(out):
        ap.error('output QA directory must not contain the input video')
    out.mkdir(parents=True,exist_ok=True)
    raw=run(['ffmpeg','-v','error','-i',str(video),'-vf',
        f'fps={args.sample_fps},scale=1280:720:flags=lanczos','-f','rawvideo','-pix_fmt','bgr24','-'])
    frames=np.frombuffer(raw,np.uint8).reshape(-1,720,1280,3)
    times=[i/args.sample_fps for i in range(len(frames))]
    # fps filtering may choose the nearest centered frame; exact endpoints are decoded separately.
    first=decode_at(video,0)
    count=int(stream.get('nb_frames') or round(duration*fps))
    last_time=(count-1)/fps
    last=decode_at(video,last_time)
    mask=np.zeros((720,1280),np.uint8)
    for rect in STATIC.values():
        x1,y1,x2,y2=rect
        mask[y1:y2,x1:x2]=255
    report={'video':str(video),'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),
        'metadata':meta,'decoded_size':SIZE,'sample_fps':args.sample_fps,'sample_count':len(frames),
        'exact_last_time':last_time,'automatic_verdict':None,
        'mandatory_visual_review':['normal-speed playback at normal viewing size',
            'camera/structure boiling vs intentional localized motion','round moon boundary',
            'cloud and branch continuity, no rubber warping or duplicate edges','loop transition'],
        'notes':['Feature flow is not a comfort/quality score.','Do not classify codec noise as motion.',
            'Fixed scene ROIs must be visually checked against the generated composition.',
            'Sample fps filter timestamps are nominal; endpoints use exact decoded frame timing.'],
        'global_camera_vs_first':[],'regions':{},'moon_shape':[]}
    for t,f in zip(times,frames):
        save(out/f'독립프레임_{t:07.3f}.png',f)
        report['global_camera_vs_first'].append({'t':t,**flow(first,f,mask)})
        report['moon_shape'].append({'t':t,**moon_shape(f)})
    for name,rect in REGIONS.items():
        report['regions'][name]={'rect':rect,'intended_static':name in STATIC,
            'vs_first':[{'t':t,'flow':flow(crop(first,rect),crop(f,rect)),
                'appearance':appearance(crop(first,rect),crop(f,rect))} for t,f in zip(times,frames)],
            'consecutive':[{'from':a,'to':b,'flow':flow(crop(f,rect),crop(g,rect))}
                for a,b,f,g in zip(times,times[1:],frames,frames[1:])],
            'seam_last_to_first':{'flow':flow(crop(last,rect),crop(first,rect)),
                'appearance':appearance(crop(last,rect),crop(first,rect))}}
    report['seam_last_to_first']={'flow':flow(last,first,mask),'appearance':appearance(last,first)}
    # A 12-second/24fps generated clip may contain 289 frames. Test rather than
    # assuming its final frame is a byte-identical duplicate of frame zero.
    second=decode_at(video,1/fps)
    before_last=decode_at(video,(count-2)/fps)
    before_before_last=decode_at(video,(count-3)/fps)
    report['endpoint_steps']={}
    for label,a,b in [('first_to_second',first,second),
                     ('before_before_last_to_before_last',before_before_last,before_last),
                     ('before_last_to_last',before_last,last),
                     ('last_to_first',last,first),('trimmed_last_to_first',before_last,first)]:
        report['endpoint_steps'][label]={'decoded_pixels_identical':bool(np.array_equal(a,b)),
            'appearance':appearance(a,b),
            'moon_cloud_flow':flow(crop(a,(610,5,1190,300)),crop(b,(610,5,1190,300)))}
    if args.reference.exists():
        reference=cv2.imdecode(np.frombuffer(args.reference.read_bytes(),np.uint8),cv2.IMREAD_COLOR)
        reference=cv2.resize(reference,SIZE,interpolation=cv2.INTER_AREA)
        report['reference']={'path':str(args.reference.resolve()),
            'sha256':hashlib.sha256(args.reference.read_bytes()).hexdigest(),
            'first_camera':flow(reference,first,mask),'first_appearance':appearance(reference,first)}
    indices=sorted(set([0,len(frames)//4,len(frames)//2,3*len(frames)//4,len(frames)-1]))
    review_frames=[frames[i] for i in indices]+[last]
    review_times=[times[i] for i in indices]+[last_time]
    save(out/'독립비교_달구름.png',contact(review_frames,review_times,(595,0,1200,310),columns=2))
    save(out/'독립비교_기와나무.png',contact(review_frames,review_times,(1020,85,1280,451),columns=3))
    save(out/'독립비교_로고.png',contact(review_frames,review_times,STATIC['logo'],columns=3))
    save(out/'독립비교_이음매.png',contact([last,first],[last_time,0],(0,0,1280,720),columns=1))
    (out/'독립검수.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    summary={'file':str(video),'qa':str(out),'duration':duration,'frames_sampled':len(frames),
        'sha256':report['sha256'],'automatic_verdict':None,
        'max_global_center_drift_px':max((float(np.linalg.norm(v.get('center_drift_px',[0,0])))
            for v in report['global_camera_vs_first']),default=None),
        'max_global_rotation_degrees':max((abs(v.get('rotation_degrees',0))
            for v in report['global_camera_vs_first']),default=None),
        'static_max_nonrigid_residual_p95':{name:max((s['flow'].get('nonrigid_residual_p95_px',0)
            for s in report['regions'][name]['vs_first']),default=None) for name in STATIC},
        'seam':report['seam_last_to_first'],'visual_review_required':True}
    (out/'독립요약.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(summary,ensure_ascii=False),flush=True)


if __name__=='__main__':
    main()

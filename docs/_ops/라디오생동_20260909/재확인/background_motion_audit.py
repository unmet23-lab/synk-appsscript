"""Read-only audit of the encoded background, not the renderer's source frames."""
from pathlib import Path
import hashlib
import json
import subprocess
import cv2
import numpy as np

ROOT = Path.cwd()
OUT = Path(__file__).resolve().parent
VIDEO = ROOT / 'docs/라디오/무대영상/추석_자연생동_20260909.mp4'
TIMES = [0, 3, 7, 15, 30, 45, 59 + 29 / 30]
ROIS = {
    'moon_core': (817, 66, 975, 224),
    'cloud_right': (978, 90, 1088, 135),
    'cloud_left': (635, 158, 806, 205),
    'tree_top': (1128, 100, 1280, 196),
    'tree_lower': (1110, 197, 1280, 312),
    'window_left_1': (204, 322, 265, 388),
    'window_left_2': (339, 322, 403, 388),
    'window_right_narrow': (1119, 331, 1135, 402),
    'window_right_large': (1190, 329, 1225, 406),
    'static_roof': (1000, 235, 1100, 275),
    'whole': (0, 0, 1280, 720),
}

def decode(t):
    data = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', str(VIDEO),
        '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'])
    return np.frombuffer(data, np.uint8).reshape(720, 1280, 3)

def crop(f, rect):
    x1, y1, x2, y2 = rect
    return f[y1:y2, x1:x2]

def compare(a, b):
    d = np.abs(a.astype(float) - b)
    ga = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
    stats = {
        'mean_rgb_abs_difference_255': float(d.mean()),
        'pixel_fraction_any_channel_delta_gt_3': float((d.max(2) > 3).mean()),
        'luma_mean_a': float(ga.mean()), 'luma_mean_b': float(gb.mean()),
        'luma_mean_delta': float(gb.mean() - ga.mean()),
        'luma_abs_delta_p95': float(np.percentile(np.abs(gb.astype(float)-ga), 95)),
    }
    pts = cv2.goodFeaturesToTrack(ga, 150, .02, 5)
    if pts is not None:
        q, s, err = cv2.calcOpticalFlowPyrLK(ga, gb, pts, None, winSize=(19,19), maxLevel=3)
        back, sb, errb = cv2.calcOpticalFlowPyrLK(gb, ga, q, None, winSize=(19,19), maxLevel=3)
        valid = (s.ravel() == 1) & (sb.ravel() == 1) & (np.linalg.norm(back-pts,axis=2).ravel() < .6)
        pp, qq = pts.reshape(-1,2)[valid], q.reshape(-1,2)[valid]
        mag = np.linalg.norm(qq-pp,axis=1)
        if len(mag):
            stats['feature_flow'] = {'count':len(mag), 'median_px':float(np.median(mag)),
                'p95_px':float(np.percentile(mag,95)), 'max_px':float(mag.max())}
        if len(mag)>6:
            mat, inside = cv2.estimateAffinePartial2D(pp, qq, method=cv2.RANSAC, ransacReprojThreshold=.6)
            if mat is not None:
                stats['fit_rotation_degrees'] = float(np.degrees(np.arctan2(mat[1,0],mat[0,0])))
    return stats

OUT.mkdir(parents=True, exist_ok=True)
frames = [decode(t) for t in TIMES]
for t, f in zip(TIMES, frames):
    (OUT / f'background_audit_decoded_{t:06.3f}.png').write_bytes(cv2.imencode('.png', f)[1].tobytes())
report = {'video':str(VIDEO), 'sha256':hashlib.sha256(VIDEO.read_bytes()).hexdigest(),
    'method':'ffmpeg decoding; RGB difference and forward/backward checked Lucas-Kanade feature flow, not source renderer',
    'times':TIMES, 'regions':{}}
for name,rect in ROIS.items():
    report['regions'][name] = {'rect':rect, 'vs_0':[compare(crop(frames[0],rect),crop(f,rect)) for f in frames]}

# Short-interval flow shows what a viewer gets rather than maximum one-minute excursion.
one_sec = [decode(t) for t in range(16)]
for name in ['moon_core', 'cloud_right', 'tree_top', 'window_left_1', 'window_left_2']:
    rect=ROIS[name]
    report['regions'][name]['one_second_intervals_0_to_15'] = [compare(crop(a,rect),crop(b,rect)) for a,b in zip(one_sec,one_sec[1:])]

# Actual-size sheets; no artificially amplified difference in these crops.
for name in ['moon_core','cloud_right','tree_top','window_left_1','window_left_2']:
    rect=ROIS[name]
    crops=[crop(f,rect).copy() for f in frames]
    h,w=crops[0].shape[:2]
    sheet=np.full((h+30,w*len(crops),3),240,np.uint8)
    for i,(t,f) in enumerate(zip(TIMES,crops)):
        sheet[30:,i*w:(i+1)*w]=f
        cv2.putText(sheet,f'{t:.3f}s',(i*w+4,20),cv2.FONT_HERSHEY_SIMPLEX,.4,(30,30,30),1,cv2.LINE_AA)
    (OUT/f'background_audit_{name}_actualsize.png').write_bytes(cv2.imencode('.png',sheet)[1].tobytes())
(OUT/'background_audit_metrics.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
for name,reg in report['regions'].items():
    print(name, json.dumps({
        'vs0_mean_rgb_delta':[round(s['mean_rgb_abs_difference_255'],3) for s in reg['vs_0']],
        'vs0_changed_gt3_fraction':[round(s['pixel_fraction_any_channel_delta_gt_3'],4) for s in reg['vs_0']],
        'vs0_flow_p95':[round(s.get('feature_flow',{}).get('p95_px',0),3) for s in reg['vs_0']],
        'vs0_luma_delta':[round(s['luma_mean_delta'],3) for s in reg['vs_0']],
        'vs0_rotation_deg':[round(s.get('fit_rotation_degrees',0),3) for s in reg['vs_0']],
        'one_second_flow_p95':[round(s.get('feature_flow',{}).get('p95_px',0),3) for s in reg.get('one_second_intervals_0_to_15',[])],
    }))

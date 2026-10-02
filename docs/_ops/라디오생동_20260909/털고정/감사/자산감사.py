"""Independent read-only decoded-pixel mascot audit. Writes only own QA directory."""
from pathlib import Path
import hashlib
import json
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
NEW = ROOT / 'docs/Loom_자산/라디오차림/까몽/_후보/여름델+전설의팻말/65f92a753bb5416b'
OLD = ROOT / 'docs/Loom_자산/라디오DJ'
CUTS = ['본체', '눈감음', '눈웃음', '궁금함', '집중', '안도', '응원', '놀람']

def read(path):
    im = cv2.imdecode(np.frombuffer(path.read_bytes(), np.uint8), cv2.IMREAD_UNCHANGED)
    assert im is not None and im.ndim == 3 and im.shape[2] == 4, str(path)
    return im

def bbox(mask):
    yy, xx = np.where(mask)
    return [int(xx.min()), int(yy.min()), int(xx.max())+1, int(yy.max())+1] if len(xx) else None

def metadata(path, im):
    a = im[..., 3]
    weighted = a.astype(float)
    yy, xx = np.indices(a.shape)
    # Browser Canvas downsampling is not guaranteed identical to this approximation.
    a96 = cv2.resize(a, (96, 96), interpolation=cv2.INTER_AREA)
    b96 = bbox(a96 > 24)
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'size_wh': [im.shape[1], im.shape[0]], 'bytes': path.stat().st_size,
            'bbox_xyxy_exclusive': {str(v): bbox(a > v) for v in [0, 8, 24, 128, 254]},
            'alpha_weighted_centroid_xy': [float((xx*weighted).sum()/weighted.sum()), float((yy*weighted).sum()/weighted.sum())],
            'approx_canvas96_alpha24_bbox': b96,
            'approx_canvas96_height_fraction': (b96[3]-b96[1])/96,
            'approx_canvas96_bottom_fraction': (96-b96[3])/96}

def composite(im, bg_bgr=(17, 21, 30)):
    a = im[..., 3:4].astype(np.float32)/255
    return np.clip(im[..., :3]*a + np.array(bg_bgr)*(1-a), 0, 255).astype(np.uint8)

def label(im, title):
    out = np.zeros((im.shape[0]+34, im.shape[1], 3), np.uint8)
    out[34:] = im
    cv2.putText(out, title, (8,23), cv2.FONT_HERSHEY_SIMPLEX, .53, (240,240,240), 1, cv2.LINE_AA)
    return out

def edge_stats(im):
    a = im[..., 3]
    luma = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2GRAY)
    # Exclude clothes/tail: upper-head silhouette plus hands is dark brown fur.
    region = np.indices(a.shape)[0] < 360
    white = im[..., :3].min(axis=2) > 190
    dist = cv2.distanceTransform((a >= 128).astype(np.uint8), cv2.DIST_L2, 5)
    masks = {'partial_alpha_8_247': (a>8)&(a<248)&region,
             'opaque_inner_band_0_3': (a>=248)&(dist>0)&(dist<=3)&region,
             'opaque_inner_band_3_7': (a>=248)&(dist>3)&(dist<=7)&region,
             'opaque_inner_band_7_14': (a>=248)&(dist>7)&(dist<=14)&region}
    result = {}
    for key, mask in masks.items():
        result[key] = {'pixels': int(mask.sum()), 'mean_luma': float(luma[mask].mean()) if mask.any() else None,
                       'near_white_rgb_min_gt190_pixels': int((mask&white).sum()),
                       'near_white_fraction': float(white[mask].mean()) if mask.any() else None}
    return result

def main():
    new_paths = [NEW / f'여름델+전설의팻말_{cut}.webp' for cut in CUTS]
    old_paths = [OLD / f'까몽_여름델+전설의팻말_{cut}.webp' for cut in CUTS]
    new = [read(p) for p in new_paths]
    old = [read(p) for p in old_paths]
    union = np.zeros(new[0].shape[:2], bool)
    changes = {}
    for cut, im in zip(CUTS, new):
        diff = np.any(im != new[0], axis=2)
        union |= diff
        changes[cut] = {'rgba_diff_pixels_vs_base': int(diff.sum()), 'diff_bbox': bbox(diff),
                       'alpha_diff_pixels_vs_base': int(np.count_nonzero(im[...,3] != new[0][...,3]))}
    n, cc, stats, centroids = cv2.connectedComponentsWithStats(union.astype(np.uint8), 8)
    components = [{'bbox':[int(x),int(y),int(x+w),int(y+h)],'pixels':int(area)} for x,y,w,h,area in stats[1:] if area >= 20]
    # Independent anatomical envelopes include tiny Lanczos support specks.
    allowed = np.zeros(union.shape, bool)
    for x0,y0,x1,y1 in [(315,313,417,422),(492,313,595,422)]:
        allowed[y0:y1,x0:x1] = True
    result = {'scope':'Eight candidate decoded WebPs, old local radioDJ WebPs; not live rendered verification',
              'new':[metadata(p,im) for p,im in zip(new_paths,new)], 'old':[metadata(p,im) for p,im in zip(old_paths,old)],
              'new_expression_changes': changes,
              'new_diff_union_pixels':int(union.sum()), 'new_diff_union_bbox':bbox(union),
              'new_diff_connected_components_ge20':components,
              'independent_two_eye_envelopes_xyxy':[[315,313,417,422],[492,313,595,422]],
              'new_differing_pixels_outside_two_eye_envelopes':int((union & ~allowed).sum()),
              'new_pixels_equal_across_all_eight':int(union.size-union.sum()),
              'new_alpha_identical_across_all_eight': all(np.array_equal(im[...,3],new[0][...,3]) for im in new),
              'edge_diagnostics':{'new':edge_stats(new[0]),'old':edge_stats(old[0])},
              'limitations':['Pixel equality outside expression changes does not mean candidate base equals the earlier approved image. See 12,772 source-pixel common-base repair in author report.',
                             'Approximate 96px alpha measurement uses OpenCV area sampling, not a claim of browser Canvas bit-exactness.',
                             'Edge brightness counts are diagnostic, not proof of the original matte process. Visual inspection required.'],
              'visual_findings':[
                  'Inspected the actual base assets and own alpha-composited contact sheet. Across eight expressions the ears, head silhouette, cheeks, outfit, arms, belly and tail retain identical decoded pixels; changes are confined to the two eye regions.',
                  'Both old and candidate assets have an obvious light cream rim at ears, hands and lower belly against a dark brown composite, already noticeable at a 384px-wide canvas. The candidate still needs edge-integration work.',
                  'Near-white RGB exists in partial-alpha outer pixels and also in the first opaque inner band. Therefore reducing only CSS shadow or blurring the whole character cannot specifically remove the baked bright edge.',
                  'The canvas and placement are essentially preserved: both 1024x1024, opaque alpha>128 width 810px, height old763/new765px. No recropping or per-expression scaling is warranted.',
                  'Local overlay img CSS has no outline/filter. The actual live browser/server state was not verified by this audit.'
              ],
              'recommendations':[
                  'Preserve a single common RGBA base, one fixed canvas/anchor, and one alpha matte across all expression derivatives. Limit expressions to approved eye/eyelid contours; never regenerate full facial fur per expression.',
                  'For edge integration, derive one shared outer-fur edge correction from the accepted base, addressing bright edge RGB as well as matte if necessary; apply identical edge pixels to all eight. Preserve individual fur tips, blue clothing, cream ties, sign, eyes, and silhouette.',
                  'Do not globally erode the silhouette, add an outline, blur the whole character, repaint the entire fur, or process every expression independently. Inspect the corrected asset at actual live size on dark and light backgrounds before deployment.',
                  'Recheck actual browser Canvas size correction after replacement: 96px approximation gives old72/new73 high-alpha rows, which can alter runtime scale by about1.37%. Compare rendered physical body/booth alignment, not only 1024 canvas metadata.',
                  'This audit confirms only this outfit of Kamong. Do not extend the pass to other outfits or other mascots.'
              ]}
    OUT.mkdir(parents=True,exist_ok=True)
    diffview = composite(new[0])
    diffview[union] = (40,40,255)
    # Composites are QA-only; source assets are never modified.
    first = [label(cv2.resize(composite(old[0]),(384,384),interpolation=cv2.INTER_AREA),'OLD / dark stage'),
             label(cv2.resize(composite(new[0]),(384,384),interpolation=cv2.INTER_AREA),'NEW / dark stage'),
             label(cv2.resize(diffview,(384,384),interpolation=cv2.INTER_AREA),'NEW / all changes red')]
    face = [label(cv2.resize(composite(im)[275:455,295:615], (288,160), interpolation=cv2.INTER_AREA), f'{i}: {cut.encode("ascii", "ignore").decode() or ["base","closed","smile","curious","focus","relief","cheer","surprise"][i]}') for i,(cut,im) in enumerate(zip(CUTS,new))]
    sheet = np.vstack([np.hstack(first), np.hstack(face[:4]), np.hstack(face[4:])])
    cv2.imencode('.png',sheet)[1].tofile(str(OUT/'자산감사_비교.png'))
    # Original pixels at 3x magnification. Same upper-ear crop for old and new.
    crops=[]
    for kind,im in [('OLD',old[0]),('NEW',new[0])]:
        crops.append(label(cv2.resize(composite(im)[130:272,250:410],(480,426),interpolation=cv2.INTER_NEAREST),kind+' ear edge x3'))
    cv2.imencode('.png',np.hstack(crops))[1].tofile(str(OUT/'자산감사_경계.png'))
    (OUT/'자산감사.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'new_base':result['new'][0], 'old_base':result['old'][0], 'changes':changes,
                      'union_pixels':int(union.sum()),'components':components,'edge':result['edge_diagnostics']},ensure_ascii=False,indent=2))

if __name__ == '__main__': main()

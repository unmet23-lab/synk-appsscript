"""Full 4K decode; black allowed only in question cards; exact-frame contacts."""
import argparse, csv, json, re, subprocess
from datetime import datetime,timezone
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from delivery_common_v4 import (REV,MP4,PLAN_PATH,PICTURE_PLAN,OVERLAY_PLAN,SRT,VALIDATION_PATH,
    probe,stream,sha256,read_plan,picture_contract,read_srt,validate_dimensions,preflight,question_intervals,inside_question)
from validate_audio import run_audio_validation

def select_expression(frames):
    terms=[f'eq(n,{int(f)})' for f in sorted(set(frames))]
    if not terms: return '0'
    def balanced(lo,hi):
        if hi-lo==1: return terms[lo]
        mid=(lo+hi)//2
        return '('+balanced(lo,mid)+'+'+balanced(mid,hi)+')'
    return balanced(0,len(terms))

def contact(frames,images,path,columns=3,width=480):
    font=ImageFont.truetype(r'C:\Windows\Fonts\arial.ttf',18); height=round(width*9/16)
    canvas=Image.new('RGB',(columns*width,((len(frames)+columns-1)//columns)*(height+30)),(16,18,22)); draw=ImageDraw.Draw(canvas)
    for i,f in enumerate(frames):
        with Image.open(images[f]) as im: thumb=im.convert('RGB').resize((width,height))
        x=(i%columns)*width; y=(i//columns)*(height+30)
        canvas.paste(thumb,(x,y+30)); draw.text((x+8,y+5),f'F{f} / {f/60:.4f}s',font=font,fill='white')
    canvas.save(path,quality=94)

def extra_stills(frames,images,run):
    buckets={}
    for f in sorted(set(frames)-images.keys()): buckets.setdefault(f//60,[]).append(f)
    folder=run/'short_candidate_stills'; folder.mkdir()
    for second,group in buckets.items():
        selection=select_expression([f-second*60 for f in group]); pattern=folder/f'sec{second:04d}_%03d.jpg'
        subprocess.run(['ffmpeg','-hide_banner','-nostdin','-loglevel','error','-xerror','-threads','2','-filter_threads','2',
            '-ss',str(second),'-i',str(MP4),'-an','-vf',f"select='{selection}',scale=960:540:flags=lanczos",
            '-frames:v',str(len(group)),'-fps_mode','vfr','-c:v','mjpeg','-threads:v','1','-q:v','3','-n',str(pattern)],check=True)
        for i,f in enumerate(group,1):
            images[f]=folder/f'sec{second:04d}_{i:03d}.jpg'
            if not images[f].is_file(): raise RuntimeError(f'Missing candidate still F{f}')

def outside_allowed(start,end,allowed):
    fragments=[(start,end)]
    for a,b in allowed:
        next_fragments=[]
        for x,y in fragments:
            if y<=a or x>=b: next_fragments.append((x,y))
            else:
                if x<a: next_fragments.append((x,a))
                if y>b: next_fragments.append((b,y))
        fragments=next_fragments
    return [(a,b) for a,b in fragments if b-a>1/120]

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--prepare-only',action='store_true')
    parser.add_argument('--plans-only',action='store_true',help='Check plans before the audio master exists.')
    args=parser.parse_args(); prepared=preflight(require_audio=not args.plans_only)
    if args.prepare_only or args.plans_only:
        print(json.dumps(prepared,ensure_ascii=False,indent=2)); return
    if VALIDATION_PATH.exists(): raise FileExistsError(f'Preserving completed validation: {VALIDATION_PATH}')
    if not MP4.is_file(): raise FileNotFoundError(f'Native render is not ready: {MP4}')
    plan=read_plan(); total=plan['duration_frames']; rows,seams=picture_contract(plan); cues=read_srt(plan)
    input_paths={'plan_sha256':PLAN_PATH,'picture_plan_sha256':PICTURE_PLAN,'overlay_plan_sha256':OVERLAY_PLAN,
        'subtitle_sha256':SRT,'mix_report_sha256':REV/'audio/mix_report.json'}
    hashes={k:sha256(p) for k,p in input_paths.items()}
    meta=probe(MP4); video=validate_dimensions(meta,plan)
    run=REV/'validation_runs'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S_%fZ'); run.mkdir(parents=True)
    question_ranges=question_intervals(plan)
    groups={
        'preserved_seams':[v for s in seams for v in [s['frame']-1,s['frame'],s['frame']+1]],
        'cut_boundaries':sorted(set(v for row in rows[1:] for v in [row['record']-1,row['record'],row['record']+1,row['record']+12])),
        'question_typing_hold':sorted(set(a+offset for a,b in question_ranges for offset in [0,14,15,30,60,90,120,150,195,209] if a+offset<b)),
        'all_captions':[round((c['start']+c['end'])*30) for c in cues],
        'interview_ends':[0,1,15,total-16,total-2,total-1],
    }
    groups={k:sorted(set(f for f in values if 0<=f<total)) for k,values in groups.items()}
    still_frames=sorted(set(f for values in groups.values() for f in values))
    still_dir=run/'exact_frame_stills'; still_dir.mkdir(); selection=select_expression(still_frames)
    graph=("[0:v:0]blackdetect=d=0.05:pix_th=0.04:pic_th=0.98,split=2[g][s];"
        "[g]scale=320:180:flags=fast_bilinear,format=gray[gray];"
        f"[s]select='{selection}',scale=960:540:flags=lanczos[stills]")
    command=['ffmpeg','-hide_banner','-nostdin','-nostats','-xerror','-threads','4','-i',str(MP4),
        '-filter_complex_threads','2','-filter_complex',graph,'-map','[gray]','-an','-c:v','rawvideo','-threads:v','1',
        '-fps_mode','passthrough','-pix_fmt','gray','-f','rawvideo','pipe:1','-map','[stills]','-an','-c:v','mjpeg',
        '-threads:v','1','-q:v','2','-fps_mode','vfr','-n',str(still_dir/'frame_%04d.jpg')]
    scores=[]; previous=None; frame_index=0; black_frames=[]; log_path=run/'full_4k_decode.log'
    with log_path.open('wb') as log:
        process=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=log)
        while True:
            raw=process.stdout.read(320*180)
            if not raw: break
            if len(raw)!=320*180:
                process.kill(); process.wait(); raise RuntimeError('Incomplete decoded frame.')
            frame=np.frombuffer(raw,dtype=np.uint8).reshape(180,320); roi=frame[:150]
            black_ratio=float(np.mean(roi<=10)); mean_gray=float(np.mean(roi))
            if black_ratio>=.98:
                black_frames.append({'frame':frame_index,'seconds':frame_index/60,'roi_black_ratio':black_ratio,
                    'allowed_question_card':inside_question(frame_index,plan)})
            if previous is not None:
                difference=np.abs(frame.astype(np.int16)-previous.astype(np.int16))
                scores.append({'frame':frame_index,'seconds':frame_index/60,'mad_255':float(np.mean(difference)),
                    'picture_roi_mad_255':float(np.mean(difference[:150])),
                    'picture_roi_mean_gray':mean_gray,'picture_roi_black_ratio':black_ratio})
            previous=frame.copy(); frame_index+=1
            if frame_index%1800==0: print(f'Decoded {frame_index}/{total} frames',flush=True)
        code=process.wait()
    log=log_path.read_text(encoding='utf-8',errors='replace')
    if code or frame_index!=total: raise RuntimeError(f'Full decode failed: status={code}, frames={frame_index}\n{log[-2500:]}')
    with (run/'all_frame_mad.csv').open('x',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=list(scores[0])); writer.writeheader(); writer.writerows(scores)
    by_frame={s['frame']:s for s in scores}
    seam_results=[{**s,**by_frame[s['frame']],'passed':by_frame[s['frame']]['mad_255']<4} for s in seams]
    black_intervals=[dict(zip(['start','end','duration'],map(float,m))) for m in
        re.findall(r'black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)',log)]
    allowed_seconds=[(a/60,b/60) for a,b in question_ranges]
    unexpected_intervals=[{'start':a,'end':b,'duration':b-a} for row in black_intervals
        for a,b in outside_allowed(row['start'],row['end'],allowed_seconds)]
    unexpected_black=[r for r in black_frames if not r['allowed_question_card']]
    # Typing/fade motion inside question cards is intentional; do not turn each
    # letter change into a short-shot candidate. Interview boundaries stay visible.
    peaks=[s for s in scores if s['picture_roi_mad_255']>=4 and not inside_question(s['frame'],plan)]
    transitions=[]; previous_peak=None
    for s in peaks:
        if previous_peak is None or s['frame']-previous_peak>2: transitions.append(s['frame'])
        previous_peak=s['frame']
    boundaries=sorted(set([0,*transitions,*[f for ab in question_ranges for f in ab],total])); planned={r['record'] for r in rows}
    shorts=[{'start_frame':a,'end_frame_exclusive':b,'frames':b-a,'seconds':(b-a)/60,
        'start_matches_planned_boundary':any(abs(a-f)<=1 for f in planned),
        'end_matches_planned_boundary':any(abs(b-f)<=1 for f in planned)}
        for a,b in zip(boundaries,boundaries[1:]) if 0<b-a<60 and not inside_question((a+b)/2,plan)]
    images={f:still_dir/f'frame_{i:04d}.jpg' for i,f in enumerate(still_frames,1)}
    for f,path in images.items():
        if not path.is_file(): raise RuntimeError(f'Missing exact-frame still F{f}')
    contacts={}
    for name,frames in groups.items():
        contacts[name]=[]
        for page,start in enumerate(range(0,len(frames),48),1):
            path=run/f'{name}_{page:02d}_contact.jpg'; contact(frames[start:start+48],images,path,3,640 if name=='question_typing_hold' else 480)
            contacts[name].append(str(path))
    candidate_frames=[]
    for row in shorts: candidate_frames.extend([max(0,row['start_frame']-1),row['start_frame'],min(total-1,row['end_frame_exclusive'])])
    short_contacts=[]
    if candidate_frames:
        extra_stills(candidate_frames,images,run)
        for page,start in enumerate(range(0,len(candidate_frames),48),1):
            path=run/f'short_candidates_{page:02d}.jpg'; contact(candidate_frames[start:start+48],images,path); short_contacts.append(str(path))
    print('Video decode complete; comparing final AAC with PCM and preserved speech...',flush=True)
    audio=run_audio_validation(MP4,run/'final_audio_validation.json')
    unchanged=all(sha256(input_paths[k])==v for k,v in hashes.items())
    passed=all(r['passed'] for r in seam_results) and not unexpected_intervals and not unexpected_black and audio['passed'] and unchanged
    report={'output':str(MP4),'bytes':MP4.stat().st_size,'sha256':sha256(MP4),'passed':passed,'full_decode':'pass',
        'expected_frames':total,'decoded_frames':frame_index,'duration_seconds':total/60,'video':video,'audio':stream(meta,'audio'),
        **hashes,'subtitle_cues':len(cues),'inputs_unchanged_during_validation':unchanged,
        'allowed_black_intervals_frames':question_ranges,'black_intervals':black_intervals,'unexpected_black_intervals':unexpected_intervals,
        'picture_roi_black_frames':black_frames,'unexpected_picture_roi_black_frames':unexpected_black,'preserved_repaired_seams':seam_results,
        'transition_candidates_outside_question_cards':peaks,'short_shot_candidates_under_one_second':shorts,
        'audio_validation':audio,'exact_frame_stills':still_frames,'contacts':contacts,'short_candidate_contacts':short_contacts,
        'all_frame_mad_csv':str(run/'all_frame_mad.csv'),'run_directory':str(run),
        'visual_review':'Exact-frame contacts require visual review. Short-shot candidates are evidence, not automatic edit failures.'}
    with (run/'validation_result.json').open('x',encoding='utf-8') as f: json.dump(report,f,ensure_ascii=False,indent=2)
    if passed:
        with VALIDATION_PATH.open('x',encoding='utf-8') as f: json.dump(report,f,ensure_ascii=False,indent=2)
    print(json.dumps({'passed':passed,'report':str(run/'validation_result.json'),'short_candidates':shorts,'contacts':contacts,'audio_passed':audio['passed']},ensure_ascii=False,indent=2))
    if not passed: raise SystemExit(1)

if __name__=='__main__': main()

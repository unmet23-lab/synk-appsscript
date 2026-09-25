"""Dynamic v4 delivery contract; never overwrite a different completed output."""
from pathlib import Path
from fractions import Fraction
import json, re, shutil, sys

REV=Path(__file__).resolve().parent
PROJECT=REV.parent
sys.path.insert(0,str(PROJECT/'review'))
from delivery_common import probe, stream, stream_hash, sha256, check_video

OUT=Path(r'C:\Users\q1212\OneDrive\Desktop\SYNK_인터뷰_구성개선_v4')
MP4=OUT/'SYNK_인터뷰_구성개선_4K60_v4.mp4'
MASTER=REV/'audio/final_mix.wav'
PLAN_PATH=REV/'edit_plan.json'
PICTURE_PLAN=REV/'picture_plan.json'
OVERLAY_PLAN=REV/'overlay_plan.json'
SRT=REV/'graphics/SYNK_Structured_ko.srt'
VALIDATION_PATH=REV/'final_validation.json'
LUT_SOURCES=[PROJECT/'revision2/grade'/f'SYNK_R2_Bright_{a}.cube' for a in ['A','B']]

def read_plan():
    plan=json.loads(PLAN_PATH.read_text(encoding='utf-8'))
    frames=plan['duration_frames']
    if plan['fps']!=60 or not isinstance(frames,int) or frames<=0 or abs(plan['duration_seconds']-frames/60)>1e-8:
        raise ValueError('Expected positive integer frames at exactly 60fps.')
    cursor=0; ids=set()
    for cut in plan['cuts']:
        n=cut['duration_frames']
        if cut['id'] in ids or cut['output_start_frame']!=cursor or not isinstance(n,int) or n<=0:
            raise ValueError(f'Invalid/overlapping edit cut: {cut}')
        ids.add(cut['id'])
        if abs(cut['output_start']-cursor/60)>1e-8 or abs(cut['output_end']-(cursor+n)/60)>1e-8:
            raise ValueError('Edit seconds differ from edit frames.')
        if cut['kind']=='speech':
            if cut['prior_last']-cut['prior_first']!=n: raise ValueError('V3 speech interval length changed.')
        elif cut['kind']!='question' or n!=210:
            raise ValueError('Expected speech or a 210-frame question card.')
        cursor+=n
    if cursor!=frames or len(question_intervals(plan))!=4: raise ValueError('Incomplete v4 edit.')
    return plan

def question_intervals(plan):
    return [(c['output_start_frame'],c['output_start_frame']+c['duration_frames'])
            for c in plan['cuts'] if c['kind']=='question']

def inside_question(frame,plan):
    return any(a<=frame<b for a,b in question_intervals(plan))

def picture_contract(plan):
    rows=json.loads(PICTURE_PLAN.read_text(encoding='utf-8'))
    cursor=0
    for row in rows:
        if row['record']!=cursor or row['last']<=row['first']: raise ValueError(f'Picture gap/overlap: {row}')
        cursor+=row['last']-row['first']
    if cursor!=plan['duration_frames']: raise ValueError('Picture total differs from edit.')
    for c in plan['cuts']:
        if c['kind']=='question':
            found=[r for r in rows if r['id']==c['id']]
            if len(found)!=1 or found[0]['record']!=c['output_start_frame'] or found[0]['last']-found[0]['first']!=c['duration_frames']:
                raise ValueError('Question picture interval differs from edit.')
    overlays=json.loads(OVERLAY_PLAN.read_text(encoding='utf-8'))
    for row in overlays:
        a,b=row['record'],row['record']+row['last']-row['first']
        if a<0 or b<=a or b>cursor: raise ValueError('Invalid overlay interval.')
        if any(max(a,x)<min(b,y) for x,y in question_intervals(plan)):
            raise ValueError('Interview alpha overlay overlaps a question card.')
    # Gate only formerly repaired seams whose two exact source frames and
    # geometry are still adjacent. Reordered cuts and the why hold are excluded.
    prior_rows=json.loads((PROJECT/'revision3/picture_plan.json').read_text(encoding='utf-8'))
    prior_by_id={r['id']:r for r in prior_rows}
    prior_report=json.loads((PROJECT/'revision3/final_validation.json').read_text(encoding='utf-8'))
    prior_seams={r['frame'] for r in prior_report['repaired_seams'] if r['passed']}
    seams=[]
    def prior_frame(row,edge):
        rid=row['id'].split('__',1)[-1]
        old=prior_by_id.get(rid)
        if old is None or Path(row['media']).resolve()!=Path(old['media']).resolve(): return None
        if any(abs(row.get(k,0)-old.get(k,0))>1e-6 for k in ['zoom','pan','tilt']): return None
        local=row['first'] if edge=='first' else row['last']-1
        if not old['first']<=local<old['last']: return None
        return old['record']+local-old['first']
    for left,right in zip(rows,rows[1:]):
        a,b=prior_frame(left,'last'),prior_frame(right,'first')
        if a is not None and b is not None and b==a+1 and b in prior_seams:
            seams.append({'frame':right['record'],'prior_frame':b,'left_id':left['id'],'right_id':right['id']})
    return rows,seams

def read_srt(plan=None):
    plan=plan or read_plan(); cues=[]
    def seconds(t):
        h,m,s,ms=map(int,re.split('[:,]',t)); return h*3600+m*60+s+ms/1000
    for expected,chunk in enumerate(re.split(r'\r?\n\s*\r?\n',SRT.read_text(encoding='utf-8-sig').strip()),1):
        lines=chunk.splitlines()
        if len(lines)<3 or int(lines[0])!=expected: raise ValueError('Invalid SRT sequence.')
        match=re.fullmatch(r'(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})',lines[1])
        if not match: raise ValueError('Invalid SRT timecode.')
        start,end=map(seconds,match.groups())
        if start<0 or end<=start or end>plan['duration_seconds']+.001: raise ValueError('Invalid SRT interval.')
        if cues and start<cues[-1]['end']-.001: raise ValueError('SRT cues overlap.')
        if any(max(start,a/60)<min(end,b/60)-.001 for a,b in question_intervals(plan)):
            raise ValueError('Speech subtitle overlaps a question card.')
        cues.append({'id':expected,'start':start,'end':end,'text':'\n'.join(lines[2:])})
    canonical=json.loads((REV/'graphics/captions.json').read_text(encoding='utf-8'))
    if len(cues)!=69 or len(canonical)!=len(cues): raise ValueError('Expected 69 speech cues.')
    for cue,original in zip(cues,canonical):
        if cue['text']!=original['text'] or any(abs(cue[k]-original[k])>.00051 for k in ['start','end']):
            raise ValueError('SRT differs from canonical caption timing/text.')
    return cues

def validate_dimensions(meta,plan,size=(3840,2160),codec='hevc',pix='yuv420p10le'):
    video=check_video(meta,plan,size,codec,pix)
    if abs(float(video.get('start_time',0)))>1e-8 or Fraction(video['avg_frame_rate'])!=60:
        raise ValueError('Video must start at zero at exactly 60fps.')
    return video

def safe_copy(source,target):
    source,target=Path(source),Path(target); target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists():
        if sha256(source)!=sha256(target): raise FileExistsError(f'Preserving different file: {target}')
    else: shutil.copy2(source,target)
    return sha256(target)

def preflight(require_audio=True):
    plan=read_plan(); rows,seams=picture_contract(plan); cues=read_srt(plan)
    report={'expected_frames':plan['duration_frames'],'duration_seconds':plan['duration_seconds'],
        'pcm_samples':plan['duration_frames']*800,'picture_rows':len(rows),'preserved_repaired_seams':seams,
        'question_intervals_frames':question_intervals(plan),'subtitle_cues':len(cues),
        'master':str(MASTER),'native_output':str(MP4),'audio_ready':False}
    if require_audio:
        mix=json.loads((REV/'audio/mix_report.json').read_text(encoding='utf-8'))
        if mix['samples']!=report['pcm_samples'] or mix['files']['final_mix.wav']['sha256']!=sha256(MASTER):
            raise ValueError('PCM master differs from completed v4 mix report.')
        if mix['edit_plan_sha256']!=sha256(PLAN_PATH) or mix['duration_frames']!=plan['duration_frames']:
            raise ValueError('PCM mix was made for a different edit plan.')
        if mix['typing_events_sha256']!=sha256(REV/'graphics/question_typing_events.json'):
            raise ValueError('Typing picture/audio schedule changed after the mix.')
        if mix['sample_rate']!=48000 or mix['channels']!=2: raise ValueError('Invalid PCM mix format.')
        if mix['source_sha256']!=sha256(Path(mix['source'])): raise ValueError('Approved prior speech changed after the mix.')
        ranges={r['id']:r for r in mix['cut_ranges']}
        for cut in plan['cuts']:
            if cut['kind']!='speech': continue
            row=ranges[cut['id']]
            if (row['prior_start_sample'],row['output_start_sample'],row['samples'])!=(cut['prior_first']*800,cut['output_start_frame']*800,cut['duration_frames']*800):
                raise ValueError('PCM speech ranges differ from the edit plan.')
        for name in ['dialogue_stem.wav','music_stem.wav','sfx_stem.wav']:
            path=REV/'audio'/name
            if mix['files'][name]['sha256']!=sha256(path): raise ValueError(f'Stem differs from mix report: {name}')
        report['audio_ready']=True; report['master_sha256']=sha256(MASTER)
    for lut in LUT_SOURCES:
        if not lut.is_file() or lut.stat().st_size==0: raise FileNotFoundError(lut)
    return report

def verified_final_source():
    plan=read_plan(); record=json.loads(VALIDATION_PATH.read_text(encoding='utf-8'))
    if record.get('passed') is not True or record.get('full_decode')!='pass': raise ValueError('Final validation has not passed.')
    if Path(record['output']).resolve()!=MP4.resolve() or record['sha256']!=sha256(MP4) or record['bytes']!=MP4.stat().st_size:
        raise ValueError('Native MP4 changed after validation.')
    for key,path in [('plan_sha256',PLAN_PATH),('picture_plan_sha256',PICTURE_PLAN),('overlay_plan_sha256',OVERLAY_PLAN),('subtitle_sha256',SRT)]:
        if record[key]!=sha256(path): raise ValueError(f'Validated input changed: {path}')
    if record['audio_validation']['reference_sha256']!=sha256(MASTER): raise ValueError('PCM master changed after validation.')
    if record['mix_report_sha256']!=sha256(REV/'audio/mix_report.json'): raise ValueError('Mix report changed after validation.')
    preflight(); meta=probe(MP4); validate_dimensions(meta,plan)
    return plan,record,meta

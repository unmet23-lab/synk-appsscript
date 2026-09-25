"""V4 rearrangement of the approved v3 dialogue, with quiet question-card Foley."""
from pathlib import Path
import json,math,re,subprocess,sys,wave,hashlib
import numpy as np
HERE=Path(__file__).resolve().parent
PROJECT=HERE.parent.parent
REV=HERE.parent
PLAN=REV/'edit_plan.json'
EVENTS=REV/'graphics/question_typing_events.json'
SOURCE=PROJECT/'revision3/audio/dialogue_stem.wav'
MUSIC=PROJECT/'audio/music/Suno_Bright_Perspective_c69c5358.mp3'
SR=48000
FRAMES=14560
N=FRAMES*800
MUSIC_FX='highpass=f=55:p=2,equalizer=f=1700:t=o:w=2:g=-4'
sys.path.insert(0,str(PROJECT/'revision3'))
from validate_audio import pcm
from make_typing_sfx import tap

def sha(path):
    with Path(path).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

def ff(args,log,data=None):
    p=subprocess.run(['ffmpeg','-hide_banner','-nostdin','-threads','2','-filter_threads','2',*map(str,args)],
        input=data,capture_output=True)
    text=p.stderr.decode('utf-8',errors='replace');(HERE/log).write_text(text,encoding='utf-8')
    if p.returncode:raise RuntimeError(text[-2500:])
    return p.stdout,text

def measure(a,label):
    _,log=ff(['-f','f32le','-ar',SR,'-ac',2,'-i','pipe:0','-af',
        'loudnorm=I=-17:TP=-1.15:LRA=20:print_format=json','-f','null','NUL'],
        label+'_measure.log',np.asarray(a,dtype='<f4').tobytes())
    r=json.loads(re.findall(r'\{[^{}]+\}',log)[-1])
    return {k:float(r[k]) for k in ['input_i','input_tp','input_lra','input_thresh']}

def save(a,name):
    ff(['-n','-f','f32le','-ar',SR,'-ac',2,'-i','pipe:0','-c:a','pcm_s24le',HERE/name],
       Path(name).stem+'_write.log',np.asarray(a,dtype='<f4').tobytes())

def edge_fades(clip,head,tail):
    ramp=np.sin(np.linspace(0,math.pi/2,384,dtype=np.float32))**2
    if head:clip[:384]*=ramp[:,None]
    if tail:clip[-384:]*=ramp[::-1,None]

def prior_word_times(prior):
    transcript=json.loads((PROJECT/'transcript/transcript_medium.json').read_text(encoding='utf-8'))
    words=[w for seg in transcript['segments'] for w in seg.get('words',[])]
    mapped=[]
    for c in prior['cuts']:
        offset=c['output_start']
        for part in c.get('source_parts') or [{'source_in':c['source_in'],'source_out':c['source_out']}]:
            start,end=part['source_in'],part['source_out']
            for w in words:
                lo,hi=max(start,w['start']),min(end,w['end'])
                if hi>lo:mapped.append((offset+lo-start,offset+hi-start))
            offset+=end-start
    return mapped

def music_envelope(cuts,prior,typing):
    steps=math.ceil(N/480)
    speaking=np.zeros(steps,dtype=bool)
    old_words=prior_word_times(prior)
    for c in cuts:
        if c['kind']!='speech':continue
        start,end=c['prior_first']/60,c['prior_last']/60
        shift=c['output_start']-start
        for lo,hi in old_words:
            lo,hi=max(lo,start),min(hi,end)
            if hi>lo:
                a=max(0,math.floor((lo+shift-.12)*100));b=min(steps,math.ceil((hi+shift+.23)*100))
                speaking[a:b]=True
    boost=np.zeros(steps,dtype=np.float32)
    changes=np.flatnonzero(np.diff(np.r_[True,speaking,True].astype(np.int8)))
    for a,b in zip(changes[::2],changes[1::2]):
        if b-a<80:continue
        edge=min(30,(b-a)//3)
        gap=np.ones(b-a,dtype=np.float32)*3.5
        gap[:edge]*=np.linspace(0,1,edge);gap[-edge:]*=np.linspace(1,0,edge)
        boost[a:b]=gap
    for c,card in zip([c for c in cuts if c['kind']=='question'],typing['cards']):
        a=round(c['output_start']*100);b=round(c['output_end']*100)
        local=np.ones(b-a,dtype=np.float32)*-3
        local[:15]=np.linspace(0,-3,15);local[-30:]=np.linspace(-3,0,30)
        first=card['keystrokes'][0]['frame']/60;last=card['keystrokes'][-1]['frame']/60
        ta=max(15,round((first-.05)*100));tb=min(len(local)-30,round((last+.15)*100))
        duck=np.ones(tb-ta,dtype=np.float32)*-2
        ramp=min(10,len(duck)//3)
        duck[:ramp]*=np.linspace(0,1,ramp);duck[-ramp:]*=np.linspace(1,0,ramp)
        local[ta:tb]+=duck
        boost[a:b]=local
    start=max(0,steps-400)
    boost[start:]=np.maximum(boost[start:],np.linspace(0,1.5,steps-start))
    db=np.interp(np.arange(N)/SR,np.arange(steps)/100,boost).astype(np.float32)
    env=np.power(10.,db/20).astype(np.float32)
    env[:12000]*=np.sin(np.linspace(0,math.pi/2,12000))**2
    env[-72000:]*=np.sin(np.linspace(math.pi/2,0,72000))**2
    return env,boost

def make_sfx(cuts,typing):
    questions=[c for c in cuts if c['kind']=='question']
    assert len(questions)==len(typing['cards'])==4
    sfx=np.zeros((N,2),dtype=np.float32);schedule=[]
    for index,(question,card) in enumerate(zip(questions,typing['cards']),1):
        assert question['question']==card['question']
        rng=np.random.default_rng(26092600+index)
        local=np.zeros((question['duration_frames']*800,2),dtype=np.float32)
        events=[]
        for event in card['keystrokes']:
            strength=float(rng.uniform(.76,1.08));pan=float(rng.uniform(-.1,.1))
            sound=tap(rng,strength)
            at=event['frame']*800
            theta=(pan+1)*math.pi/4
            local[at:at+len(sound),0]+=sound*math.cos(theta)
            local[at:at+len(sound),1]+=sound*math.sin(theta)
            events.append({'local_frame':event['frame'],'timeline_frame':question['output_start_frame']+event['frame'],
                'timeline_sample':(question['output_start_frame']+event['frame'])*800,'revealed_unit':event['revealed_unit']})
        gain=10**(-24/20)/float(np.max(np.abs(local)))
        local*=gain
        at=question['output_start_frame']*800
        sfx[at:at+len(local)]=local
        schedule.append({'question_id':question['id'],'card_id':card['id'],'seed':26092600+index,
            'peak_dbfs':-24.0,'first_contact_frame':events[0]['timeline_frame'],
            'last_contact_frame':events[-1]['timeline_frame'],'keystrokes':events})
    return sfx,schedule

def main():
    for name in ['dialogue_stem.wav','music_stem.wav','sfx_stem.wav','final_mix.wav','mix_report.json','mix_validation.json']:
        if (HERE/name).exists():raise FileExistsError(f'Preserving existing v4 artifact: {name}')
    plan_hash,event_hash=sha(PLAN),sha(EVENTS)
    plan=json.loads(PLAN.read_text(encoding='utf-8'));typing=json.loads(EVENTS.read_text(encoding='utf-8'))
    prior=json.loads((PROJECT/'revision3/edit_plan.json').read_text(encoding='utf-8'))
    prior_by_id={c['id']:c for c in prior['cuts']}
    assert plan['duration_frames']==FRAMES and plan['fps']==60 and plan['why_end_local_frame']==1324
    voice=np.zeros((N,2),dtype=np.float32);ranges=[];cursor=0
    for c in plan['cuts']:
        assert c['output_start_frame']==cursor
        cursor+=c['duration_frames']
        if c['kind']!='speech':continue
        si=c['prior_first']*800;count=(c['prior_last']-c['prior_first'])*800;oi=c['output_start_frame']*800
        assert count==c['duration_frames']*800
        head=c['prior_cut_local_first']>0
        tail=c['prior_cut_local_last']<prior_by_id[c['id']]['duration_frames']
        clip=pcm(SOURCE,si,count).astype(np.float32)
        edge_fades(clip,head,tail)
        voice[oi:oi+count]=clip
        ranges.append({'id':c['id'],'prior_start_sample':si,'output_start_sample':oi,'samples':count,
            'new_head_fade_samples':384 if head else 0,'new_tail_fade_samples':384 if tail else 0,
            'gain_relative_to_v3':1.0})
    assert cursor==FRAMES
    print('Approved dialogue rearranged, unity gain; two new trim edges only.',flush=True)
    sfx,schedule=make_sfx(plan['cuts'],typing)
    raw,_=ff(['-i',MUSIC,'-t',N/SR,'-af',MUSIC_FX,'-ar',SR,'-ac',2,'-c:a','pcm_f32le','-f','f32le','pipe:1'],
        'music_decode_filter.log')
    music=np.frombuffer(raw,dtype='<f4').reshape(-1,2).copy();del raw
    assert len(music)>=N;music=music[:N]
    music_before=measure(music,'music_before')
    music_gain=-32.5-music_before['input_i']
    env,boost=music_envelope(plan['cuts'],prior,typing)
    music*=10**(music_gain/20)*env[:,None];del env
    headroom_db=0.;mix=voice+music+sfx
    premix=measure(mix,'premix');measured=premix
    while measured['input_tp']>-1.15:
        if headroom_db<=-12:raise ValueError('Unexpected peak; preserve dialogue and investigate rather than compressing it.')
        headroom_db-=.5;music*=10**(-.5/20)
        mix=voice+music+sfx
        measured=measure(mix,f'headroom_{int(-headroom_db*10)}')
    assert sha(PLAN)==plan_hash and sha(EVENTS)==event_hash,'Plan/timing changed during mix; no deliverable written.'
    measurements={}
    for array,name in [(voice,'dialogue_stem.wav'),(music,'music_stem.wav'),(sfx,'sfx_stem.wav'),(mix,'final_mix.wav')]:
        assert np.isfinite(array).all() and np.max(np.abs(array))<1
        save(array,name)
        measurements[name]=measure(array,Path(name).stem)
    np.save(HERE/'music_boost_db_100hz.npy',boost)
    (HERE/'sfx_timeline_schedule.json').write_text(json.dumps(schedule,ensure_ascii=False,indent=2),encoding='utf-8')
    report={'source':str(SOURCE),'source_sha256':sha(SOURCE),'edit_plan':str(PLAN),'edit_plan_sha256':plan_hash,
        'typing_events':str(EVENTS),'typing_events_sha256':event_hash,'music_source':str(MUSIC),'music_sha256':sha(MUSIC),
        'samples':N,'duration':N/SR,'duration_frames':FRAMES,'fps':60,'sample_rate':SR,'channels':2,
        'dialogue_operations':['unity-gain rearrangement of approved v3 PCM','8 ms fade only on newly trimmed edges'],
        'dialogue_static_gain_db':0.,'shared_master_trim_db':0.,'music_headroom_trim_db':headroom_db,
        'dialogue_measure':measurements['dialogue_stem.wav'],'music_measure':measurements['music_stem.wav'],
        'sfx_measure':measurements['sfx_stem.wav'],'mix_measure':measurements['final_mix.wav'],
        'music_before':music_before,'premix_measure':premix,'music_filter':MUSIC_FX,'music_normalization_gain_db':music_gain,
        'music_baseline_target_lufs':-32.5,'music_repeated':False,'music_source_offset_seconds':0,
        'question_music_db_relative_to_speech_baseline':-3,'typing_extra_music_duck_db':-2,
        'phrase_gap_boost_db':3.5,'ending_lift_db':1.5,'ending_fade_seconds':1.5,
        'dialogue_denoiser':False,'dialogue_agc':False,'dialogue_compression':False,'final_limiter':False,
        'sfx_provenance':'Deterministic local tap synthesis synchronized to exact visible character frames; no external recording.',
        'sfx_card_peak_dbfs':-24,'sfx_event_count':sum(len(c['keystrokes']) for c in schedule),
        'stem_relationship':'Sum dialogue_stem, music_stem and sfx_stem at unity gain.',
        'cut_ranges':ranges,'clipped_samples':0,'sample_peak':float(np.max(np.abs(mix))),
        'files':{name:{'bytes':(HERE/name).stat().st_size,'sha256':sha(HERE/name)} for name in measurements},
        'subjective_validation_limit':'Objective checks do not replace listening or certify perceived naturalness.'}
    (HERE/'mix_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    validate(plan,ranges,report)
    print(json.dumps({'duration':N/SR,'frames':FRAMES,'dialogue':report['dialogue_measure'],
        'music':report['music_measure'],'sfx':report['sfx_measure'],'mix':report['mix_measure'],
        'music_headroom_trim_db':headroom_db,'voice_gain_db':0.,'sfx_events':report['sfx_event_count']},indent=2),flush=True)

def validate(plan,ranges,report):
    comparisons=[]
    for r in ranges:
        original=pcm(SOURCE,r['prior_start_sample'],r['samples'])
        expected=original.astype(np.float32)
        edge_fades(expected,bool(r['new_head_fade_samples']),bool(r['new_tail_fade_samples']))
        actual=pcm(HERE/'dialogue_stem.wav',r['output_start_sample'],r['samples'])
        a=r['new_head_fade_samples'];b=r['samples']-r['new_tail_fade_samples']
        interior=np.max(np.abs(actual[a:b]-original[a:b]))
        comparisons.append({'id':r['id'],'interior_max_abs_error':float(interior),
            'max_abs_error_against_documented_fades':float(np.max(np.abs(actual-expected)))})
    sum_max=0.;silence=[];sfx_outside=0.
    for at in range(0,N,SR):
        count=min(SR,N-at)
        stems=[pcm(HERE/name,at,count) for name in ['dialogue_stem.wav','music_stem.wav','sfx_stem.wav']]
        final=pcm(HERE/'final_mix.wav',at,count)
        sum_max=max(sum_max,float(np.max(np.abs(sum(stems)-final))))
    for c in plan['cuts']:
        path=HERE/('dialogue_stem.wav' if c['kind']=='question' else 'sfx_stem.wav')
        x=pcm(path,c['output_start_frame']*800,c['duration_frames']*800)
        peak=float(np.max(np.abs(x)))
        if c['kind']=='question':silence.append({'id':c['id'],'dialogue_peak':peak})
        else:sfx_outside=max(sfx_outside,peak)
    shapes=[]
    for name in report['files']:
        with wave.open(str(HERE/name),'rb') as w:
            ok=(w.getframerate(),w.getnchannels(),w.getsampwidth(),w.getnframes())==(SR,2,3,N)
            shapes.append(ok)
    passed=(all(shapes) and sum_max<=3/8388608 and all(c['interior_max_abs_error']==0 for c in comparisons)
        and max(c['max_abs_error_against_documented_fades'] for c in comparisons)<=1/8388608
        and all(q['dialogue_peak']==0 for q in silence) and sfx_outside==0 and report['mix_measure']['input_tp']<=-1.0)
    result={'passed':passed,'samples':N,'duration_frames':FRAMES,'sample_rate':SR,'channels':2,'sample_width_bytes':3,
        'prior_v3_voice_comparisons':comparisons,'stem_sum_max_abs_error':sum_max,'one_pcm24_lsb':1/8388608,
        'question_voice_silence':silence,'sfx_outside_question_peak':sfx_outside,
        'typing_frames_are_exact_sample_multiples_of_800':True,
        'limits':'Numerical preservation and exact timing do not certify subjective sound quality.'}
    (HERE/'mix_validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    if not passed:raise ValueError('V4 mix validation did not pass.')

if __name__=='__main__':main()

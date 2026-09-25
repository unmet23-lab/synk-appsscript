"""Compare final AAC to the v4 PCM mix and preserved v3 speech intervals."""
from pathlib import Path
import argparse, json, os, re, subprocess, wave
os.environ['OPENBLAS_NUM_THREADS']='2'
os.environ['MKL_NUM_THREADS']='2'
import numpy as np
from scipy.signal import correlate
from delivery_common_v4 import REV,PROJECT,MP4,MASTER,read_plan,preflight,probe,stream,stream_hash,sha256

SR=48000
STEMS=['dialogue_stem.wav','music_stem.wav','sfx_stem.wav']

def pcm(path,start,count):
    with wave.open(str(path),'rb') as w:
        if (w.getframerate(),w.getnchannels(),w.getsampwidth())!=(SR,2,3): raise ValueError(f'Expected stereo PCM24: {path}')
        w.setpos(int(start)); raw=w.readframes(int(count))
    if len(raw)!=count*6: raise ValueError(f'PCM window is short: {path} @ {start}')
    b=np.frombuffer(raw,dtype=np.uint8).reshape(-1,3).astype(np.int32)
    x=b[:,0]|(b[:,1]<<8)|(b[:,2]<<16)
    return (((x^0x800000)-0x800000).reshape(-1,2).astype(np.float64)/8388608)

def alignment_windows(plan):
    """Seventeen energetic, two-second windows wholly inside speech cuts."""
    options=[]; count=2*SR
    for c in plan['cuts']:
        if c['kind']!='speech': continue
        lo=c['output_start_frame']*800+960
        hi=(c['output_start_frame']+c['duration_frames'])*800-count-960
        if hi<lo: continue
        candidates=[]
        for fraction in [.25,.5,.75]:
            start=round(lo+(hi-lo)*fraction)
            voice=pcm(REV/'audio/dialogue_stem.wav',start,count).mean(axis=1)
            candidates.append((float(voice@voice),start))
        energy,start=max(candidates)
        if energy<1e-8: raise ValueError(f'No useful speech for alignment: {c["id"]}')
        options.append({'cut_id':c['id'],'start_sample':start,'duration_samples':count})
    if len(options)<17: raise ValueError('Fewer than 17 usable speech windows.')
    return [options[i] for i in np.linspace(0,len(options)-1,17).round().astype(int)]

def check_preserved_dialogue(plan):
    """Ignore only 20ms at each cut edge to allow declared 8ms edit fades."""
    results=[]; prior_hashes={}
    for cut in plan['cuts']:
        if cut['kind']!='speech': continue
        source=Path(cut['approved_voice_source'])
        if str(source) not in prior_hashes: prior_hashes[str(source)]=sha256(source)
        count=cut['duration_frames']*800-1920
        x=pcm(source,cut['prior_first']*800+960,count)
        y=pcm(REV/'audio/dialogue_stem.wav',cut['output_start_frame']*800+960,count)
        delta=y-x; peak=float(np.max(np.abs(delta))); xx=float(np.sum(x*x)); xy=float(np.sum(x*y))
        results.append({'cut_id':cut['id'],'prior_first_frame':cut['prior_first'],
            'prior_last_frame_exclusive':cut['prior_last'],'output_start_frame':cut['output_start_frame'],
            'compared_samples_per_channel':count,'excluded_edge_samples':960,
            'max_difference_lsb24':peak*8388608,'gain_db':float(20*np.log10(max(abs(xy/xx),1e-15))),
            'passed':peak<=2/8388608})
    return {'passed':all(r['passed'] for r in results),'source_sha256':prior_hashes,'cuts':results,
        'scope':'All retained speech interiors, excluding 20ms at each edit edge for declared 8ms fades.'}

def run_audio_validation(video=MP4,report_path=None):
    if report_path is not None and report_path.exists(): raise FileExistsError(report_path)
    preflight(); plan=read_plan(); samples=plan['duration_frames']*800
    meta=probe(video); a=stream(meta,'audio')
    if a['codec_name']!='aac' or int(a['sample_rate'])!=SR or a['channels']!=2: raise ValueError('Expected one AAC stereo 48kHz track.')
    if abs(float(a.get('start_time',0)))>1e-8: raise ValueError('Audio does not start at zero.')
    for path in [MASTER,*[REV/'audio'/n for n in STEMS]]:
        with wave.open(str(path),'rb') as w:
            if w.getnframes()!=samples: raise ValueError(f'PCM duration differs from current plan: {path}')
    raw=subprocess.check_output(['ffmpeg','-hide_banner','-nostdin','-loglevel','error','-xerror',
        '-threads','2','-i',str(video),'-map','0:a:0','-vn','-f','f32le','-c:a','pcm_f32le','pipe:1'])
    out=np.frombuffer(raw,dtype='<f4').reshape(-1,2)
    pad=2880; lags=[]
    for window in alignment_windows(plan):
        start,count=window['start_sample'],window['duration_samples']
        ref=pcm(MASTER,start,count).mean(axis=1)
        y=out[start-pad:start+count+pad].mean(axis=1,dtype=np.float64)
        if len(y)!=count+2*pad: raise ValueError('AAC is too short for an alignment window.')
        corr=correlate(y,ref,mode='valid',method='fft'); shift=int(np.argmax(np.abs(corr))-pad)
        lags.append({**window,'start_seconds':start/SR,'duration_seconds':count/SR,'lag_samples':shift,'lag_ms':shift/SR*1000})
    lag=round(float(np.median([r['lag_samples'] for r in lags])))
    rs,os_=max(0,-lag),max(0,lag); n=min(samples-rs,len(out)-os_)
    xx=yy=xy=0.; matrix=np.zeros((3,3)); rhs=np.zeros(3)
    channel_xx=np.zeros((2,2)); channel_xy=np.zeros((2,2)); windows=[]
    clipped=nonfinite=0; peak=0.; sum_error=0.; card_voice_peak=0.; outside_sfx_peak=0.
    card_samples=[(c['output_start_frame']*800,(c['output_start_frame']+c['duration_frames'])*800)
        for c in plan['cuts'] if c['kind']=='question']
    for start in range(0,n,5*SR):
        count=min(5*SR,n-start); x=pcm(MASTER,rs+start,count)
        y=out[os_+start:os_+start+count].astype(np.float64)
        stems=[pcm(REV/'audio'/name,rs+start,count) for name in STEMS]
        sum_error=max(sum_error,float(np.max(np.abs(sum(stems)-x))))
        indices=np.arange(rs+start,rs+start+count); in_card=np.zeros(count,dtype=bool)
        for a_,b_ in card_samples: in_card|=(indices>=a_)&(indices<b_)
        if np.any(in_card): card_voice_peak=max(card_voice_peak,float(np.max(np.abs(stems[0][in_card]))))
        if np.any(~in_card): outside_sfx_peak=max(outside_sfx_peak,float(np.max(np.abs(stems[2][~in_card]))))
        xf,yf=x.ravel(),y.ravel(); qxx,qyy,qxy=float(xf@xf),float(yf@yf),float(xf@yf)
        xx+=qxx; yy+=qyy; xy+=qxy
        if qxx>1e-20: windows.append({'start_seconds':start/SR,'gain_db':float(20*np.log10(max(abs(qxy/qxx),1e-12)))})
        sm=np.stack([v.ravel() for v in stems],axis=1); matrix+=sm.T@sm; rhs+=sm.T@yf
        channel_xx+=x.T@x; channel_xy+=x.T@y
        clipped+=int(np.count_nonzero(np.abs(y)>=1)); nonfinite+=int(np.count_nonzero(~np.isfinite(y)))
        peak=max(peak,float(np.max(np.abs(y))))
    gain=xy/xx; coeff=np.linalg.lstsq(matrix,rhs,rcond=None)[0]
    residual=max(yy-2*gain*xy+gain*gain*xx,1e-30)
    log=subprocess.run(['ffmpeg','-hide_banner','-nostdin','-threads','2','-filter_threads','2',
        '-i',str(video),'-map','0:a:0','-vn','-af','loudnorm=I=-17:TP=-1.15:LRA=20:print_format=json',
        '-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace',check=True).stderr
    ((report_path.parent if report_path else REV)/'final_audio_loudness.log').write_text(log,encoding='utf-8')
    loud=json.loads(re.findall(r'\{[^{}]+\}',log)[-1]); loud={k:float(loud[k]) for k in ['input_i','input_tp','input_lra','input_thresh']}
    tail=out[samples:]; tail_peak=20*np.log10(max(1e-12,float(np.max(np.abs(tail))))) if tail.size else None
    mix=json.loads((REV/'audio/mix_report.json').read_text(encoding='utf-8'))
    preserved=check_preserved_dialogue(plan)
    conclusions={
        'no_measurable_delay_or_drift':all(r['lag_samples']==0 for r in lags),
        'level_preserved_within_0_1db':abs(20*np.log10(abs(gain)))<.1,
        'waveform_correlation_above_0_999':xy/np.sqrt(xx*yy)>.999,
        'encoding_residual_snr_above_27db':10*np.log10(xx/residual)>27,
        'no_voice_or_music_duplication_evidence':np.all(np.abs(coeff[:2]-1)<.02),
        'typing_sfx_scale_preserved':abs(coeff[2]-1)<.1,
        'pcm_master_equals_three_unity_stems':sum_error*8388608<=3,
        'question_cards_contain_no_dialogue':card_voice_peak==0,
        'typing_sfx_only_inside_question_cards':outside_sfx_peak==0,
        'approved_v3_dialogue_interior_preserved':preserved['passed'],
        'loudness_within_0_2lu':abs(loud['input_i']-mix['mix_measure']['input_i'])<.2,
        'true_peak_below_minus1':loud['input_tp']<=-1,
        'padding_only_after_programme':0<=len(out)-samples<=2048 and (tail_peak is None or tail_peak<-40),
        'finite_and_unclipped':clipped==0 and nonfinite==0,
    }
    conclusions={k:bool(v) for k,v in conclusions.items()}
    report={'passed':all(conclusions.values()),'render':str(video),'reference':str(MASTER),
        'reference_sha256':sha256(MASTER),'audio_metadata':a,'aac_sha256':stream_hash(video,'a','copy'),
        'reference_samples':samples,'decoded_samples':len(out),'compared_samples':n,'padding_samples':len(out)-samples,
        'tail_peak_dbfs':None if tail_peak is None else float(tail_peak),'alignment_checks':lags,'median_lag_samples':lag,
        'least_squares_gain_db':float(20*np.log10(abs(gain))),'rms_difference_db':float(10*np.log10(yy/xx)),
        'correlation':float(xy/np.sqrt(xx*yy)),'encoding_residual_snr_db':float(10*np.log10(xx/residual)),
        'five_second_gain_min_db':min(q['gain_db'] for q in windows),'five_second_gain_max_db':max(q['gain_db'] for q in windows),
        'stem_regression':dict(zip(['dialogue_scale','music_scale','sfx_scale'],map(float,coeff))),
        'pcm_unity_sum_max_error_lsb24':sum_error*8388608,'preserved_v3_dialogue':preserved,
        'question_dialogue_peak':card_voice_peak,'sfx_outside_questions_peak':outside_sfx_peak,
        'channel_matrix':np.linalg.lstsq(channel_xx,channel_xy,rcond=None)[0].tolist(),'loudness':loud,
        'sample_peak_dbfs':float(20*np.log10(max(peak,1e-12))),'clipped_samples':clipped,'nonfinite_samples':nonfinite,
        'conclusions':conclusions,'limits':'Seventeen speech-only lag windows and waveform checks do not replace listening.'}
    if report_path:
        with report_path.open('x',encoding='utf-8') as f: json.dump(report,f,ensure_ascii=False,indent=2)
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('--video',type=Path,default=MP4)
    p.add_argument('--report',type=Path,default=REV/'final_audio_validation.json'); args=p.parse_args()
    report=run_audio_validation(args.video,args.report); print(json.dumps(report,ensure_ascii=False,indent=2))
    if not report['passed']: raise SystemExit(1)

"""Deterministic, quiet synthetic keyboard Foley for four question cards.

No recordings, third-party assets, downloads, AI voices, music generation,
or dialogue processing. All writes are confined to this directory.
"""
from pathlib import Path
import hashlib, json, math, re, subprocess, wave
import numpy as np
from scipy.signal import butter, sosfilt

HERE=Path(__file__).resolve().parent
SR=48000
DURATION=1.4
SAMPLES=67200
TARGET_PEAK_DBFS=-24.0
BASE_ONSETS=np.array([.095,.184,.303,.398,.479,.633,.731,.823,.982,1.094,1.225])

def db(x): return float(20*np.log10(max(float(x),1e-12)))

def tap(rng,strength):
    """Rounded mechanical contact plus very short, damped plastic resonance."""
    t=np.arange(round(.093*SR))/SR
    noise=rng.normal(0,1,len(t))
    band=sosfilt(butter(2,[750,4900],btype='bandpass',fs=SR,output='sos'),noise)
    # No hard impulse: sub-millisecond attack and several-ms contact decay.
    envelope=(1-np.exp(-t/.00042))*np.exp(-t/rng.uniform(.0036,.0053))
    contact=.78*band*envelope
    low_freq=rng.uniform(320,530)
    low=.10*np.sin(2*np.pi*low_freq*t)*(1-np.exp(-t/.0007))*np.exp(-t/.0105)
    shell=(.22*np.sin(2*np.pi*rng.uniform(1150,1610)*t)*np.exp(-t/.0034)
           +.065*np.sin(2*np.pi*rng.uniform(2380,3100)*t)*np.exp(-t/.0017))
    shell*=1-np.exp(-t/.00035)
    sound=contact+low+shell
    # Softer key release is a brief noisy plastic contact, not a second ring.
    release_at=rng.uniform(.029,.046)
    rt=np.maximum(0,t-release_at)
    release=.10*band*(1-np.exp(-rt/.0007))*np.exp(-rt/.0046)*(t>=release_at)
    sound+=release
    sound*=strength
    sound=sosfilt(butter(2,5400,btype='lowpass',fs=SR,output='sos'),sound)
    sound=sosfilt(butter(2,110,btype='highpass',fs=SR,output='sos'),sound)
    # Taper residual filter state to zero; this only affects synthesized SFX.
    count=round(.012*SR)
    sound[-count:]*=np.sin(np.linspace(np.pi/2,0,count))**2
    sound[0]=0;sound[-1]=0
    return sound

def synthesize(seed):
    rng=np.random.default_rng(seed)
    onsets=BASE_ONSETS+rng.uniform(-.010,.010,len(BASE_ONSETS))
    audio=np.zeros((SAMPLES,2),dtype=np.float64)
    events=[]
    for index,onset in enumerate(onsets):
        strength=float(rng.uniform(.76,1.08))
        pan=float(rng.uniform(-.10,.10))
        sound=tap(rng,strength)
        start=round(onset*SR)
        theta=(pan+1)*np.pi/4
        length=min(len(sound),SAMPLES-start)
        audio[start:start+length,0]+=sound[:length]*math.cos(theta)
        audio[start:start+length,1]+=sound[:length]*math.sin(theta)
        events.append({'key':index+1,'onset_sample':start,'onset_seconds':start/SR,
                       'relative_strength':strength,'pan':pan})
    gain=(10**(TARGET_PEAK_DBFS/20))/np.max(np.abs(audio))
    audio*=gain
    return audio,events,gain

def save_pcm24(path,audio):
    if path.exists(): raise FileExistsError(f'Preserving existing asset: {path}')
    pcm=np.rint(np.clip(audio,-1,1-1/8388608)*8388608).astype(np.int32).ravel()
    encoded=np.empty((len(pcm),3),dtype=np.uint8)
    encoded[:,0]=pcm&255;encoded[:,1]=(pcm>>8)&255;encoded[:,2]=(pcm>>16)&255
    with wave.open(str(path),'wb') as w:
        w.setnchannels(2);w.setsampwidth(3);w.setframerate(SR);w.writeframes(encoded.tobytes())

def measurement(path):
    p=subprocess.run(['ffmpeg','-hide_banner','-nostdin','-threads','1','-filter_threads','1',
        '-i',str(path),'-af','loudnorm=I=-24:TP=-1:LRA=20:print_format=json',
        '-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
    (HERE/(path.stem+'_measure.log')).write_text(p.stderr,encoding='utf-8')
    raw=json.loads(re.findall(r'\{[^{}]+\}',p.stderr)[-1])
    return {k:float(raw[k]) for k in ['input_i','input_tp','input_lra']}

def main():
    report_path=HERE/'typing_sfx_report.json'
    if report_path.exists(): raise FileExistsError(report_path)
    assets=[]
    for index in range(1,5):
        seed=26092600+index
        audio,events,gain=synthesize(seed)
        # Replay seed to check reproducibility before creating the source asset.
        replay,_,_=synthesize(seed)
        assert np.array_equal(audio,replay)
        assert np.isfinite(audio).all() and np.max(np.abs(audio))<1
        assert np.count_nonzero(audio[:480])==0 and np.count_nonzero(audio[-480:])==0
        path=HERE/f'typing_soft_{index:02d}.wav'
        save_pcm24(path,audio)
        with wave.open(str(path),'rb') as w:
            assert (w.getframerate(),w.getnchannels(),w.getsampwidth(),w.getnframes())==(SR,2,3,SAMPLES)
        measured=measurement(path)
        assets.append({'file':str(path),'seed':seed,'duration_seconds':DURATION,'samples':SAMPLES,
            'sample_rate':SR,'channels':2,'codec':'PCM signed 24-bit little-endian',
            'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'peak_dbfs':db(np.max(np.abs(audio))),'rms_dbfs':db(np.sqrt(np.mean(audio**2))),
            'loudness':measured,'stereo_correlation':float(np.corrcoef(audio.T)[0,1]),
            'initial_10ms_all_zero':True,'final_10ms_all_zero':True,'clipped_samples':0,
            'deterministic_replay_equal':True,'synthesis_static_gain':gain,'keystrokes':events})
    report={'purpose':'Four quiet 1.4-second keyboard typing clusters for question cards.',
        'provenance':'Original deterministic NumPy/SciPy synthesis; no external audio or learned generator used.',
        'local_asset_search':'Project audio contains only interview/music assets; no usable keyboard/typing audio was found by filename search within the project.',
        'timbre_design':'Soft band-limited contact noise with damped plastic taps; narrow stereo, small timing/strength variation, no bell or return flourish.',
        'source_gain_guidance':'Start with unity gain on a black question card; source peaks are intentionally -24dBFS. Adjust by fixed gain after the dialogue/music arrangement is known.',
        'timing_guidance':'Each asset is exactly 84 frames at 60fps. First contact is approximately 0.09s into the asset; align the asset start with the beginning of text typing.',
        'dialogue_or_music_modified':False,'whole_mix_created':False,
        'limits':'Objective measurements verify format, peaks, silence at edges, and reproducibility; no listening-based realism claim is made.',
        'assets':assets}
    with report_path.open('x',encoding='utf-8') as f: json.dump(report,f,ensure_ascii=False,indent=2)
    print(json.dumps([{'file':a['file'],'duration':a['duration_seconds'],'peak_dbfs':a['peak_dbfs'],
        'loudness':a['loudness']} for a in assets],ensure_ascii=False,indent=2))

if __name__=='__main__': main()

"""Encode approved local Suno originals and measure a pulse grid from each actual MP3.
No original files are modified. Uses installed ffmpeg and numpy only.
"""
import hashlib, json, pathlib, subprocess
import numpy as np

ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=pathlib.Path('C:/Users/q1212/Documents/SYNK-radio-20260926')
SONGS=[('blue-signal','파란 신호가 켜지면','94e8eeb8-fcba-4434-a0ba-cd1490d8c6d3'),('one-hour-to-sea','바다까지 한 시간','c2835bc7-6963-4503-95bd-781b55e20b88'),('four-pm-promise','오후 네 시의 약속','ed3ac4b9-0386-4f47-8c1f-eb61cbd11f52')]
DISPLAY_TITLES={'파란 신호가 켜지면':'초록','바다까지 한 시간':'해안선','오후 네 시의 약속':'네 시'}
manifest=json.loads((SOURCE/'manifest.json').read_text('utf-8'))
(ROOT/'assets/music').mkdir(parents=True,exist_ok=True)
report=[];configs=[]
for slug,title,suno_id in SONGS:
 src=SOURCE/'원본'/f'{title}.wav';dst=ROOT/'assets/music'/f'{slug}.mp3'
 source_hash=hashlib.sha256(src.read_bytes()).hexdigest()
 entry=next(s for s in manifest['songs'] if s['suno_id']==suno_id)
 assert source_hash==entry['source_sha256'],f'Original mismatch: {title}'
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(src),'-map','0:a:0','-ar','44100','-c:a','libmp3lame','-b:a','160k','-metadata',f'title={title}','-metadata','artist=SYNK','-metadata',f'comment=Made with Suno; original id={suno_id}',str(dst)],check=True)
 raw=subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-i',str(dst),'-ac','1','-ar','22050','-f','f32le','-'])
 y=np.frombuffer(raw,dtype='<f4');sr=22050;hop=220;n_fft=2048
 duration=len(y)/sr;frames=np.lib.stride_tricks.sliding_window_view(y,n_fft)[::hop]
 window=np.hanning(n_fft);freq=np.fft.rfftfreq(n_fft,1/sr)
 weights=np.where((freq>=35)&(freq<=260),3.0,np.where((freq>260)&(freq<4000),.6,0.0))
 previous=np.zeros(n_fft//2+1);flux=[]
 for begin in range(0,len(frames),256):
  mag=np.log1p(np.abs(np.fft.rfft(frames[begin:begin+256]*window,axis=1))*4)
  diff=np.maximum(0,np.diff(np.vstack([previous,mag]),axis=0));flux.extend((diff*weights).sum(axis=1));previous=mag[-1]
 flux=np.array(flux);flux=np.maximum(0,flux-np.convolve(flux,np.ones(101)/101,mode='same'))
 flux/=max(float(np.percentile(flux,95)),1e-9);flux=np.minimum(flux,5)
 times=(np.arange(len(flux))*hop+n_fft/2)/sr;rate=sr/hop
 # Global periodicity: beat candidates and their phase concentration.
 n=1<<int(np.ceil(np.log2(len(flux)*8)));spectrum=np.abs(np.fft.rfft(flux-flux.mean(),n));bpm_grid=np.fft.rfftfreq(n,1/rate)*60
 candidate_indices=np.flatnonzero((bpm_grid>=85)&(bpm_grid<=150));peaks=[]
 for idx in candidate_indices[np.argsort(spectrum[candidate_indices])[::-1]]:
  bpm=float(bpm_grid[idx])
  if all(abs(bpm-p['bpm'])>1 for p in peaks):peaks.append({'bpm':round(bpm,3),'strength':round(float(spectrum[idx]),2)})
  if len(peaks)==6:break
 bpm=peaks[0]['bpm'];period=60/bpm
 # Refine a complete-song pulse rather than adopting a placeholder BPM.
 best=(-1,None,None)
 for trial in np.arange(bpm-.6,bpm+.6,.01):
  p=60/trial;phases=np.arange(0,p,.005);grid=phases[:,None]+np.arange(int(duration/p)+1)[None,:]*p
  indices=np.clip(np.rint((grid*sr-n_fft/2)/hop).astype(int),0,len(flux)-1);valid=(grid>4)&(grid<duration-5)
  score=((flux[indices]*valid).sum(axis=1)/np.maximum(1,valid.sum(axis=1)))
  i=int(np.argmax(score))
  if score[i]>best[0]:best=(float(score[i]),float(trial),float(phases[i]))
 _,bpm,phase=best;period=60/bpm
 beats=[];shifts=[]
 for ideal in np.arange(phase,duration-.18,period):
  ix=np.flatnonzero(abs(times-ideal)<.055)
  if len(ix):
   at=int(ix[np.argmax(flux[ix])]);actual=float(times[at]) if flux[at]>.18 else float(ideal)
  else:actual=float(ideal)
  beats.append(round(actual,5));shifts.append(abs(actual-ideal))
 # Early, middle and late windows reveal whether a constant pulse remains coherent.
 sections=[]
 for lo,hi in [(5,35),(duration/2-15,duration/2+15),(duration-35,duration-5)]:
  selected=[b for b in beats if lo<=b<hi];indices=np.clip(np.rint((np.array(selected)*sr-n_fft/2)/hop).astype(int),0,len(flux)-1)
  sections.append({'from':round(lo,2),'to':round(hi,2),'meanPulseStrength':round(float(flux[indices].mean()),3)})
 config={'sourceId':suno_id,'title':DISPLAY_TITLES[title],'audioUrl':f'assets/music/{slug}.mp3','duration':round(duration,5),'bpm':round(bpm,3),'beatOffset':round(phase,5),'beatTimes':beats}
 configs.append(config)
 report.append({**{k:v for k,v in config.items() if k!='beatTimes'},'source':str(src),'sourceSha256':source_hash,'assetSha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'assetBytes':dst.stat().st_size,'samples':len(y),'analysisSampleRate':sr,'tempoCandidates':peaks,'beatCount':len(beats),'maxGridShiftSeconds':round(max(shifts),5),'pulseWindows':sections,'method':'low-frequency weighted spectral flux, whole-song periodicity and phase search, local onset refinement within 55ms; automatic pulse estimate, not a human beat audit'})
 print(json.dumps({k:v for k,v in report[-1].items() if k in ['title','duration','bpm','beatOffset','beatCount','tempoCandidates','pulseWindows','assetBytes']},ensure_ascii=False),flush=True)
(ROOT/'suno-tracks.mjs').write_text('export const SUNO_RECORDINGS='+json.dumps(configs,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
(ROOT/'qa/suno-audio-analysis.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

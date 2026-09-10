"""Prepare one isolated SHIFT voice trial from existing approved local assets."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import array
import math
import re
import sys

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'docs/홍보물/첫게시물_20260910/_실험/수노_임시남성_01'
PUBLIC=OUT/'public'
VOICE=ROOT/'docs/브랜드_목소리/20260910/수노_유호보컬/말하기_시험01/A_음질보정_v1.wav'
SOURCE=ROOT/'영상/public/firstposts20260910'
COPY_RECORD=[]
TIMING=json.loads((ROOT/'영상/src/firstposts20260910/voice-trial-timing.json').read_text(encoding='utf-8'))
TOTAL_SECONDS=round(TIMING['bodySeconds']+TIMING['endingSeconds'],6)

def run(args,**kwargs):
 return subprocess.run(args,capture_output=True,check=True,**kwargs)

def stream_hash(path,stream):
 return run(['ffmpeg','-v','error','-i',str(path),'-map',stream,'-c','copy','-f','hash','-']).stdout.decode().strip()

def prepare_ending_bgm(bed_gain_db=None):
 # Rebuild from the song, before the old fade, so the extended hold stays audible.
 source=SOURCE/'bed-shift.wav'
 reference=PUBLIC/'bed.wav'
 sustain=PUBLIC/'bed-sustain.wav'
 target=PUBLIC/'bed-ending.wav'
 rate,channels=48000,2
 start,rise,gain_db=TIMING['bodySeconds'],TIMING['bgmRiseSeconds'],TIMING['bgmGainDb']
 fade_start=start+rise+TIMING['bgmHoldSeconds']
 assert abs(fade_start+TIMING['fadeOutSeconds']-TOTAL_SECONDS)<1e-6
 if bed_gain_db is None:
  bed_gain_db=json.loads((OUT/'원본명세.json').read_text(encoding='utf-8-sig'))['bedGainDb']
 run(['ffmpeg','-y','-v','error','-stream_loop','-1','-i',str(source),'-t',str(TOTAL_SECONDS),
      '-af',f'volume={bed_gain_db}dB,afade=t=in:d=0.3','-ar',str(rate),'-ac',str(channels),
      '-c:a','pcm_s24le',str(sustain)])
 pcm=run(['ffmpeg','-v','error','-i',str(sustain),'-f','s32le','-']).stdout
 reference_pcm=run(['ffmpeg','-v','error','-i',str(reference),'-f','s32le','-']).stdout
 samples=array.array('i',pcm)
 first=round(start*rate)
 assert pcm[:first*channels*4]==reference_pcm[:first*channels*4], 'Source BGM differs from the approved body section.'
 for frame in range(first,len(samples)//channels):
  phase=min(1,(frame-first)/(rise*rate))
  fade_phase=max(0,min(1,(frame/rate-fade_start)/TIMING['fadeOutSeconds']))
  gain=10**(gain_db*(.5-.5*math.cos(math.pi*phase))/20)*(.5+.5*math.cos(math.pi*fade_phase))
  for channel in range(channels):
   index=frame*channels+channel
   value=round((samples[index]>>8)*gain)
   if not -(1<<23)<=value<(1<<23):raise ValueError('Ending bed would clip.')
   samples[index]=value<<8
 run(['ffmpeg','-y','-v','error','-f','s32le','-ar',str(rate),'-ac',str(channels),'-i','-',
      '-c:a','pcm_s24le',str(target)],input=samples.tobytes())
 after=run(['ffmpeg','-v','error','-i',str(target),'-f','s32le','-']).stdout
 prefix_bytes=first*channels*4
 assert len(after)==len(pcm) and after[:prefix_bytes]==pcm[:prefix_bytes]
 settings={'source':str(source.relative_to(ROOT)),'output':str(target.relative_to(ROOT)),
           'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
           'outputSha256':hashlib.sha256(target.read_bytes()).hexdigest(),
           'quietReference':str(reference.relative_to(ROOT)),'baseGainDb':bed_gain_db,
           'startSeconds':start,'riseSeconds':rise,'holdSeconds':TIMING['bgmHoldSeconds'],
           'gainDb':gain_db,'curve':'raised cosine in dB; cosine amplitude fade-out',
           'fadeOut':{'startSeconds':fade_start,'durationSeconds':TIMING['fadeOutSeconds']},
           'pcmBeforeEndingIdentical':True,'durationSeconds':len(samples)/channels/rate,'humanListening':False}
 (OUT/'엔딩_BGM_설정.json').write_text(json.dumps(settings,ensure_ascii=False,indent=2),encoding='utf-8')
 return settings

def copy(src,dest):
 dest.parent.mkdir(parents=True,exist_ok=True)
 shutil.copy2(src,dest)
 digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
 assert digest(src)==digest(dest)
 COPY_RECORD.append({'source':str(src.relative_to(ROOT)),'output':str(dest.relative_to(ROOT)),'sha256':digest(src)})

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 for name in ['logo-shift.png','logo-shift-paper.png','felt-dark.webp','synk-intro.png','notebook.webp','letter.webp']:
  copy(SOURCE/name,PUBLIC/'firstposts20260910'/name)
 font_manifest=json.loads((ROOT/'영상/src/킷/폰트벌.json').read_text(encoding='utf-8'))
 for row in font_manifest['벌']:
  name=Path(row['정본']).name
  copy(ROOT/'영상/public/폰트'/name,PUBLIC/'폰트'/name)
 copy(VOICE,PUBLIC/'voice.wav')
 audio=array.array('f',run(['ffmpeg','-v','error','-i',str(VOICE),'-ac','1','-f','f32le','-']).stdout)
 hop=960
 levels=[math.sqrt(sum(v*v for v in audio[i:i+hop])/len(audio[i:i+hop])) for i in range(0,len(audio),hop)]
 peak=max(levels)
 levels=[round(v/peak,5) for v in levels]
 # Fixed gain on the existing bed, leaving the narration file untouched.
 raw=run(['ffmpeg','-hide_banner','-i',str(SOURCE/'bed-shift.wav'),'-af','loudnorm=I=-23:TP=-3:LRA=7:print_format=json','-f','null','-']).stderr.decode('utf-8',errors='replace')
 measurement=json.loads(re.findall(r'\{\s*"input_i"[\s\S]*?\}',raw)[-1])
 gain=-46-float(measurement['input_i'])
 run(['ffmpeg','-y','-v','error','-stream_loop','-1','-i',str(SOURCE/'bed-shift.wav'),'-t','16.2','-af',f'volume={gain}dB,afade=t=in:d=0.3,afade=t=out:st=14.8:d=1.4','-ar','48000','-c:a','pcm_s24le',str(PUBLIC/'bed.wav')])
 prepare_ending_bgm(gain)
 scenes=[
  {'title':'안녕하세요,\n유호입니다.','kicker':'AI로 회사를 만드는 기록','duration':2},
  {'title':'AI와 함께\n회사를 만듭니다.','body':'직접 만든 자료, 그리고 다음 선택.','asset':'synk-intro','duration':95/30},
  {'title':'직접 해보고,\n막히면 고치고.','asset':'notebook','duration':60/30},
  {'title':'쓸 만한 방법을\n함께 나눕니다.','asset':'letter','duration':75/30},
  {'title':'오늘은,\n우리 목소리부터.','body':'우리에게 맞는 소리를 찾는 중입니다.','duration':118/30},
 ]
 cues=[
  (0,2000,'안녕하세요. 유호입니다.'),
  (2000,5160,'저는 AI와 함께\n회사를 만들고 있어요.'),
  (5160,7160,'직접 해보고, 막히면 고치고,'),
  (7160,9680,'쓸 만한 방법을 함께 나눌게요.'),
  (9680,12280,'오늘은 우리 목소리부터\n만들어볼까요?'),
 ]
 captions=[{'startMs':a,'endMs':b,'text':s,'timestampMs':None,'confidence':None} for a,b,s in cues]
 props={'item':{'id':'shift-temporary-male-trial','brand':'SHIFT','account':'@yuhobuilds','scenes':scenes},'captions':captions,'levels':levels}
 (OUT/'props.json').write_text(json.dumps(props,ensure_ascii=False,indent=2),encoding='utf-8')
 (OUT/'자막.json').write_text(json.dumps(captions,ensure_ascii=False,indent=2),encoding='utf-8')
 (OUT/'원본명세.json').write_text(json.dumps({'copies':COPY_RECORD,'voiceStatus':'temporary male until actual Yuho voice is ready','female':'DIVE Nana remains selected','narrationRegenerated':False,'voiceGainDb':0,'bedGainDb':gain,'captionTiming':'Local ASR boundaries with reading holds. Independent word ASR: middle split 7.12s, final words 9.72-11.94s; caption timing uses rounded scene boundary and a short final hold. Human audio review pending.'},ensure_ascii=False,indent=2),encoding='utf-8')
 print(str(OUT))

def finalize():
 # Remotion's render measured a 2048-sample audio delay. Keep its video and
 # encode the original WAV mix once with ffmpeg's normal AAC timestamp handling.
 render=OUT/'render.mp4'
 final=OUT/'video.mp4'
 if not render.exists():
  final.rename(render)
 render_duration=float(run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(render)]).stdout)
 if abs(render_duration-TOTAL_SECONDS)>.001:raise ValueError(f'Render must be {TOTAL_SECONDS} seconds before finalizing.')
 preserved_audio=None
 if '--preserve-audio-from' in sys.argv:
  preserved_audio=Path(sys.argv[sys.argv.index('--preserve-audio-from')+1]).resolve(strict=True)
  if preserved_audio==final.resolve():raise ValueError('Preserve a separate approved source, not the output being overwritten.')
  run(['ffmpeg','-y','-v','error','-i',str(render),'-i',str(preserved_audio),
       '-map','0:v:0','-map','1:a:0','-map_metadata','1','-c','copy','-t',str(TOTAL_SECONDS),'-movflags','+faststart',str(final)])
 else:
  prepare_ending_bgm()
  run(['ffmpeg','-y','-v','error','-i',str(render),'-i',str(PUBLIC/'voice.wav'),'-i',str(PUBLIC/'bed-ending.wav'),
       '-filter_complex','[1:a][2:a]amix=inputs=2:normalize=0:duration=longest[a]',
       '-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','320k','-ar','48000',
       '-t',str(TOTAL_SECONDS),'-movflags','+faststart','-metadata',
       'comment=Narration: Suno My Voice - Sep 8, song 0518e341-74d4-4b11-8165-4508761169fd; local EQ; temporary male voice trial. Visuals: SYNK SHIFT.',str(final)])
 probe=json.loads(run(['ffprobe','-v','error','-show_entries','stream=codec_name,width,height,sample_rate,channels,r_frame_rate,duration:format=duration,size','-of','json',str(final)]).stdout)
 assert all(abs(float(s['duration'])-TOTAL_SECONDS)<.001 for s in probe['streams'])
 run(['ffmpeg','-v','error','-xerror','-i',str(final),'-f','null','-'])
 log=run(['ffmpeg','-hide_banner','-i',str(final),'-af','loudnorm=I=-23:TP=-3:LRA=7:print_format=json','-f','null','-']).stderr.decode('utf-8',errors='replace')
 loudness=json.loads(re.findall(r'\{\s*"input_i"[\s\S]*?\}',log)[-1])
 assert stream_hash(render,'0:v:0')==stream_hash(final,'0:v:0')
 audit={'probe':probe,'loudness':loudness,'sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'fullDecodePassed':True,'voiceProcessing':'Approved audio stream copied without re-encoding' if preserved_audio else 'Approved narration WAV at unity gain; ending BGM follows shared timing JSON; AAC once from WAV','humanListening':False,'visualFramesReviewed':[],
        'videoBitstreamPreserved':True,'videoStreamSha256':stream_hash(final,'0:v:0'),
        'narrationSourceSha256':hashlib.sha256((PUBLIC/'voice.wav').read_bytes()).hexdigest()}
 if preserved_audio:
  def audio_hash(path):
   return run(['ffmpeg','-v','error','-i',str(path),'-map','0:a:0','-c','copy','-f','hash','-']).stdout.decode().strip()
  assert audio_hash(preserved_audio)==audio_hash(final)
  audit.update({'audioSource':str(preserved_audio.relative_to(ROOT)),'audioStreamSha256':audio_hash(final),'audioBitstreamPreserved':True})
 else:
  audit.update({'audioBitstreamPreserved':False,'audioStreamSha256':stream_hash(final,'0:a:0'),
                'endingBgm':json.loads((OUT/'엔딩_BGM_설정.json').read_text(encoding='utf-8'))})
 (OUT/'검사.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({'duration':probe['format']['duration'],'LUFS':loudness['input_i'],'truePeak':loudness['input_tp']}))

if __name__=='__main__':
 if hasattr(sys.stdout,'reconfigure'):sys.stdout.reconfigure(encoding='utf-8')
 if '--finalize' in sys.argv:finalize()
 elif '--ending-bgm' in sys.argv:print(json.dumps(prepare_ending_bgm(),ensure_ascii=False))
 else:main()

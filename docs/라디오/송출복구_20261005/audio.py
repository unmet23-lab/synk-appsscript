from pathlib import Path
import subprocess,json,hashlib,sys
import numpy as np
P=Path(__file__).resolve().parent
R=P.parents[2]
OLD=R/'docs/라디오/곡제목_모음집_20260927/old11.flac'
SOURCES=[R/'docs/라디오/곡제목_모음집_20260927/오늘 밤 제일 환한 사람.wav',R/"docs/라디오/곡제목_모음집_20260927/The Phantom's Lament.wav"]
def run(args):
 r=subprocess.run(args,capture_output=True,check=True);return r
def ff(args):return run(['ffmpeg','-hide_banner','-nostats','-v','error',*args])
def probe(f):return json.loads(run(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels,bits_per_raw_sample','-of','json',str(f)]).stdout)
def pcm(f):return np.frombuffer(ff(['-i',str(f),'-ac','1','-ar','8000','-f','f32le','-']).stdout,np.float32)
o=pcm(OLD);s=pcm(SOURCES[0]);ph=pcm(SOURCES[1])
gain=lambda a,b:float(20*np.log10(np.dot(a,b)/np.dot(a,a)))
gains=[gain(s[6*8000:35*8000],o[:29*8000]),gain(ph[10*8000:80*8000],o[int(59.6*8000):int(129.6*8000)])]
analysis={'sourceDurations':[float(probe(f)['format']['duration'])for f in SOURCES],'gainDb':gains,'swingCorrelation':float(np.corrcoef(s[6*8000:35*8000],o[:29*8000])[0,1]),'swingTailRmsDb':{str(i):float(20*np.log10(np.sqrt(np.mean(s[i*8000:min((i+1)*8000,len(s))]**2))))for i in range(48,62)},'oldProbe':probe(OLD)}
(P/'source-analysis.json').write_text(json.dumps(analysis,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(analysis,ensure_ascii=False,indent=2))
if '--build' not in sys.argv:sys.exit()
# Source-complete first two tracks, then byte-identical decoded remainder of the prior block.
# No cyclic head/tail splice is allowed on a block placed between other blocks.
dur=analysis['sourceDurations'];tail_start=205.94425
filters=[f'[0:a]aresample=44100,aformat=sample_fmts=s32:channel_layouts=stereo,volume={gains[0]:.8f}dB,asetpts=N/SR/TB[a]',f'[1:a]aresample=44100,aformat=sample_fmts=s32:channel_layouts=stereo,volume={gains[1]:.8f}dB,asetpts=N/SR/TB[b]',f'[2:a]atrim=start={tail_start},asetpts=N/SR/TB[c]','[a][b][c]concat=n=3:v=0:a=1[out]']
out=P/'synk-radio-blok11-sourcecomplete-20261005.flac'
ff(['-y',*sum([['-i',str(f)]for f in [*SOURCES,OLD]],[]),'-filter_complex',';'.join(filters),'-map','[out]','-map_metadata','-1','-c:a','flac','-sample_fmt','s32','-bits_per_raw_sample','24','-frame_size','4608','-ar','44100','-ac','2',str(out)])
ff(['-i',str(out),'-f','null','-'])
stop=json.loads((P/'stop.json').read_text(encoding='utf8'));now=json.loads(stop['nowPlaying']);delta=sum(dur)-tail_start
playlist=stop['playlist'].replace('synk-radio-blok11-20260909-gapless.flac',out.name).replace('1701.192199546',probe(out)['format']['duration'])
now['duration']+=delta;now['tracks'][9]['start']=now['tracks'][8]['start']+dur[0]
for i in range(10,len(now['tracks'])):now['tracks'][i]['start']+=delta
now['playlistSha256']=hashlib.sha256(playlist.encode()).hexdigest();now['sourceNotes']+='; 2026-10-05: first two old11 tracks restored from complete source, no cyclic block seam. Remainder preserved from 205.94425s.'
(P/'playlist.txt').write_text(playlist,encoding='utf8');(P/'now-playing.json').write_text(json.dumps(now,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
report={'file':out.name,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'probe':probe(out),'deltaSeconds':delta,'swingSecondsBefore':49.6,'swingSecondsAfter':dur[0],'firstTwoSources':[str(f)for f in SOURCES],'tailPreservedFromSeconds':tail_start,'decodeErrors':0}
(P/'audio-build.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(report,ensure_ascii=False,indent=2))

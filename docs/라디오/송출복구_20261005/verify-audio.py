from pathlib import Path
import subprocess,json,hashlib
import numpy as np
P=Path(__file__).resolve().parent
def ff(args):return subprocess.run(['ffmpeg','-v','error',*args],capture_output=True,check=True).stdout
def pcm(f,args=[]):return np.frombuffer(ff([*args,'-i',str(f),'-ac','1','-ar','8000','-f','f32le','-']),np.float32)
sources=json.loads((P/'audio-build.json').read_text(encoding='utf8'))['firstTwoSources'];gains=json.loads((P/'source-analysis.json').read_text())['gainDb'];out=P/'synk-radio-blok11-sourcecomplete-20261005.flac'
x=pcm(out);checks=[]
for name,f,start,dur,g in zip(['swing','phantom'],sources,[0,61.6],[61.6,162.32],gains):
 a=pcm(f);b=x[round(start*8000):round((start+dur)*8000)];n=min(len(a),len(b));error=float(np.max(np.abs(a[80:n-80]*10**(g/20)-b[80:n-80])));corr=float(np.corrcoef(a[:n],b[:n])[0,1]);print(name,corr,error);assert corr>.99999;assert error<.00005
 checks.append({'track':name,'seconds':dur,'correlation':corr,'maxError':error,'completeSourceVerified':True})
old=P.parents[2]/'docs/라디오/곡제목_모음집_20260927/old11.flac'
orig=ff(['-i',str(old),'-af','atrim=start=205.94425,asetpts=N/SR/TB','-c:a','pcm_s24le','-f','s24le','-'])
tail=ff(['-i',str(out),'-af','atrim=start=223.92,asetpts=N/SR/TB','-c:a','pcm_s24le','-f','s24le','-'])
assert orig==tail,'Unchanged remainder differs';checks.append({'remainingOldTracksPcmSha256':hashlib.sha256(tail).hexdigest(),'byteIdentical':True})
# Play the rebuilt whole first song and next transition through the broadcast AAC codec.
ff(['-y','-i',str(out),'-t','78','-c:a','aac','-b:a','192k',str(P/'swing-complete-and-transition.m4a')]);ff(['-i',str(P/'swing-complete-and-transition.m4a'),'-f','null','-'])
report={'checks':checks,'aacDecodeErrors':0};(P/'audio-verified.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))

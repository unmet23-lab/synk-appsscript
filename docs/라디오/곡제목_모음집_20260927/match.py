import pathlib,subprocess,numpy as np,json
from scipy.signal import fftconvolve
out=pathlib.Path(__file__).parent
rate=4000
def pcm(p,ss=None,t=None):
 a=['ffmpeg','-v','error']
 if ss is not None:a+=['-ss',str(ss)]
 a+=['-i',str(p)]
 if t is not None:a+=['-t',str(t)]
 a+=['-vn','-ac','1','-ar',str(rate),'-f','f32le','-']
 return np.frombuffer(subprocess.check_output(a),dtype=np.float32)
y=pcm(out/'old11.flac');sources=list(pathlib.Path('G:/내 드라이브/OneDrive_음악보관_20260924').glob('*.wav'))+list(out.glob('*.wav'))
results=[]
for p in sources:
 x=pcm(p,20,18);x=x-x.mean();n=len(x)
 cor=fftconvolve(y,x[::-1],mode='valid')
 eng=np.maximum(np.cumsum(np.r_[0,y.astype(np.float64)**2])[n:]-np.cumsum(np.r_[0,y.astype(np.float64)**2])[:-n],1e-10)
 score=cor/np.sqrt(eng*np.sum(x*x));idx=int(np.argmax(score));peak=float(score[idx]);start=idx/rate-20
 r={'title':p.stem,'source':str(p),'start':start,'correlation':peak}
 if peak>.65:results.append(r)
 print(json.dumps(r,ensure_ascii=False),flush=True)
 (out/'matched-old11.json').write_text(json.dumps(sorted(results,key=lambda x:x['start']),ensure_ascii=False,indent=2),encoding='utf8')

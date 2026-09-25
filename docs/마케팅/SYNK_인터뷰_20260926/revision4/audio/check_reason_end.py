"""Inspect only the final word/pause near the v4 reason segment endpoint."""
from pathlib import Path
import sys,json,wave
import numpy as np
from scipy.signal import butter,sosfilt,spectrogram
from PIL import Image,ImageDraw,ImageFont
HERE=Path(__file__).resolve().parent
PROJECT=HERE.parent.parent
sys.path.insert(0,str(PROJECT/'revision3'))
from validate_audio import pcm
SOURCE=Path(r'C:\Users\q1212\Videos\kkkk_4k_audio_natural_20260925\voice_natural_master.wav')
SR=48000
start,end=756.45,757.8
x=pcm(SOURCE,round(start*SR),round((end-start)*SR))
mono=x.mean(axis=1)
filtered=sosfilt(butter(4,[180,4200],btype='bandpass',fs=SR,output='sos'),mono)
def db(x):return float(20*np.log10(max(float(x),1e-12)))
envelope=[]
for i in range(0,len(x)-480+1,480):
 y=x[i:i+480];z=filtered[i:i+480]
 envelope.append({'source_start':round(start+i/SR,6),'raw_rms_dbfs':db(np.sqrt(np.mean(y*y))),
     'band_rms_dbfs':db(np.sqrt(np.mean(z*z))), 'peak_dbfs':db(np.max(np.abs(y)))})
boundaries=[]
for f in range(round(757.10*60),round(757.30*60)+1):
 t=f/60;i=round((t-start)*SR);s=x[max(0,i-240):i]
 boundaries.append({'source_end_frame':f,'source_end_seconds':t,
  'extra_picture_frames_after_757_133333':f-45428,'last_5ms_rms_dbfs':db(np.sqrt(np.mean(s*s))),
  'last_sample_max_abs':float(np.max(np.abs(x[i-1])))})
f,t,s=spectrogram(mono,fs=SR,nperseg=512,noverlap=416,mode='magnitude')
keep=f<=5000;mag=20*np.log10(np.maximum(s[keep],1e-10))
v=np.clip((mag+95)/60,0,1)
rgb=np.zeros((*v.shape,3),dtype=np.uint8)
rgb[:,:,0]=(255*v).astype(np.uint8);rgb[:,:,1]=(230*np.sqrt(v)).astype(np.uint8);rgb[:,:,2]=(170*v**2).astype(np.uint8)
img=Image.new('RGB',(1500,780),(18,20,25));draw=ImageDraw.Draw(img)
font=ImageFont.truetype(r'C:\Windows\Fonts\arial.ttf',19)
spec=Image.fromarray(rgb[::-1]).resize((1380,430));img.paste(spec,(85,80))
draw.text((85,15),'Source 756.45-757.80s: 0-5kHz spectrogram, then 10ms RMS',font=font,fill='white')
for sec in np.arange(756.5,757.801,.1):
 xx=85+int((sec-start)/(end-start)*1380)
 draw.line((xx,80,xx,710),fill=(65,70,80));draw.text((xx-25,730),f'{sec:.1f}',font=font,fill='white')
for frame,color in [(45428,(90,180,255)),(45433,(255,90,80))]:
 sec=frame/60;xx=85+int((sec-start)/(end-start)*1380)
 draw.line((xx,60,xx,715),fill=color,width=3)
 draw.text((xx+3,40),f'{sec:.6f}',font=font,fill=color)
for key,color in [('raw_rms_dbfs',(230,220,90)),('band_rms_dbfs',(80,220,170))]:
 points=[]
 for row in envelope:
  xx=85+(row['source_start']-start)/(end-start)*1380
  yy=710-(np.clip(row[key],-45,-10)+45)/35*160
  points.append((round(xx),round(yy)))
 draw.line(points,fill=color,width=2)
for level in [-40,-30,-20,-10]:
 yy=710-(level+45)/35*160
 draw.text((5,int(yy)-10),str(level),font=font,fill='white')
img.save(HERE/'reason_end_756_757.png')
report={'source':str(SOURCE),'range':[start,end],'envelope_10ms':envelope,'frame_boundaries':boundaries,
 'full_medium_word_end':757.19,'candidate_medium_no_vad_word_end':757.14,
 'candidate_medium_next_word_start':757.56,
 'note':'Waveform/spectrum and ASR timing are evidence, not a claim of listening.'}
(HERE/'reason_end_analysis.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'boundaries':boundaries,'envelope':[r for r in envelope if 756.95<=r['source_start']<=757.65]},indent=2))

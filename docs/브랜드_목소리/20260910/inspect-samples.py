from pathlib import Path
import difflib
import hashlib
import json
import os
import re
import subprocess
import sys
from faster_whisper import WhisperModel

if hasattr(sys.stdout,'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
BASE=Path(__file__).resolve().parent
TEXT='같이 들어볼까요? 좋아요, 이번에는 조금 다르게 해볼게요. 작은 차이가 모이면, 우리만의 목소리가 돼요.'
CACHE=Path('C:/Users/q1212/.cache/huggingface/hub/models--Systran--faster-whisper-small/snapshots')
os.environ['HF_HUB_OFFLINE']='1'
os.environ['TRANSFORMERS_OFFLINE']='1'
def run(args):
    return subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()
def loudness(p):
    data=run(['ffmpeg','-hide_banner','-i',str(p),'-af','loudnorm=I=-23:TP=-3:LRA=7:print_format=json','-f','null','NUL']).stderr
    return json.loads(re.findall(r'\{\s*"input_i"[\s\S]*?\}',data)[-1])
def norm(t):
    return re.sub('[^가-힣a-z0-9]','',t.lower())
def main():
    snapshot=next(p for p in CACHE.iterdir() if (p/'model.bin').is_file())
    model=WhisperModel(str(snapshot),device='cpu',compute_type='int8',cpu_threads=2,local_files_only=True)
    results=[]
    files=[Path(x) for x in sys.argv[1:]] or sorted(list((BASE/'실험').glob('*/raw.wav'))+list((BASE/'실험'/'supertonic3').glob('F*-raw.wav')))
    for p in files:
        if not p.is_absolute():
            p=BASE/p
        candidate=p.parent.name if p.name=='raw.wav' else p.parent.name+'-'+p.stem.replace('-raw','')
        dest=p.parent/'inspection.json' if p.name=='raw.wav' else p.with_suffix('.inspection.json')
        source_hash=sha(p)
        if dest.exists():
            old=json.loads(dest.read_text(encoding='utf-8'))
            if old['rawSha256']==source_hash:
                results.append(old)
                print(json.dumps({'candidate':candidate,'reused':True}),flush=True)
                continue
        probe=json.loads(run(['ffprobe','-v','error','-show_entries','stream=codec_name,sample_rate,channels,bits_per_sample:format=duration','-of','json',str(p)]).stdout)
        segments,info=model.transcribe(str(p),language='ko',beam_size=5,word_timestamps=True,vad_filter=False,condition_on_previous_text=False,temperature=0)
        rows=[{'start':s.start,'end':s.end,'text':s.text,'words':[{'word':w.word,'start':w.start,'end':w.end} for w in s.words or []]} for s in segments]
        actual=''.join(s['text'] for s in rows).strip()
        measured=loudness(p)
        # Fixed gain only. No EQ, denoising, tempo change or sample-rate conversion.
        gain_db=min(-23-float(measured['input_i']),-3-float(measured['input_tp']))
        listen=p.parent/'listen.wav' if p.name=='raw.wav' else p.parent/(p.stem.replace('-raw','')+'-listen.wav')
        run(['ffmpeg','-y','-v','error','-i',str(p),'-af',f'volume={gain_db:.6f}dB','-c:a','pcm_s24le',str(listen)])
        final_loudness=loudness(listen)
        result={'candidate':candidate,'rawFile':str(p),'rawSha256':source_hash,'listenFile':str(listen),'listenSha256':sha(listen),'probe':probe,'expected':TEXT,'actual':actual,'characterSimilarity':difflib.SequenceMatcher(a=norm(TEXT),b=norm(actual),autojunk=False).ratio(),'segments':rows,'rawLoudness':measured,'gainDb':gain_db,'listenLoudness':final_loudness,'sampleRatePreserved':True,'processing':'fixed gain only; native sample rate; 24-bit comparison container does not increase source detail','humanListening':False,'modelSnapshot':snapshot.name,'expectedUsedAsASRPrompt':False}
        dest.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        results.append(result)
        print(json.dumps({'candidate':result['candidate'],'actual':actual,'similarity':round(result['characterSimilarity'],3),'LUFS':final_loudness['input_i'],'gainDb':round(gain_db,2)},ensure_ascii=False),flush=True)
    (BASE/'조사'/'비교음성검사.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
if __name__=='__main__':
    main()

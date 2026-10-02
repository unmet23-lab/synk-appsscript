import os,sys,json,hashlib
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1'
os.environ['TRANSFORMERS_OFFLINE']='1'
sys.stdout.reconfigure(encoding='utf-8')
from faster_whisper import WhisperModel
base=Path(__file__).resolve().parent/'_검토'/'01-음성수정'
cache=Path('C:/Users/q1212/.cache/huggingface/hub/models--Systran--faster-whisper-small/snapshots')
snapshots=[p for p in cache.iterdir() if (p/'model.bin').is_file()]
model=WhisperModel(str(snapshots[0]),device='cpu',compute_type='int8',cpu_threads=4,local_files_only=True)
for name in sys.argv[1:]:
    file=base/name
    segments,info=model.transcribe(str(file),language='ko',beam_size=5,word_timestamps=True,vad_filter=False,condition_on_previous_text=False,temperature=0)
    rows=[{'start':s.start,'end':s.end,'text':s.text,'words':[{'start':w.start,'end':w.end,'word':w.word} for w in (s.words or [])]} for s in segments]
    result={'file':name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'duration':info.duration,'segments':rows,'actual':' '.join(r['text'].strip() for r in rows),'humanListening':False,'offline':True,'expectedUsedAsPrompt':False}
    out=base/(file.stem+'-asr.json');tmp=out.with_suffix('.tmp');tmp.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(out)
    print(json.dumps(result,ensure_ascii=False),flush=True)

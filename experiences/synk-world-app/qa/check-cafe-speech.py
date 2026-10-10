import json, re, sys, argparse, hashlib
from pathlib import Path
from faster_whisper import WhisperModel
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[3]
parser=argparse.ArgumentParser();parser.add_argument('--medium',action='store_true');parser.add_argument('--small',action='store_true');parser.add_argument('--subset',default='');args=parser.parse_args()
cache='models--Systran--faster-whisper-small' if args.small else 'models--Systran--faster-whisper-medium' if args.medium else 'models--mobiuslabsgmbh--faster-whisper-large-v3-turbo'
snapshots=Path('C:/Users/q1212/.cache/huggingface/hub')/cache/'snapshots'
model_dir=next(p for p in snapshots.iterdir() if (p/'model.bin').exists())
model=WhisperModel(str(model_dir),device='cpu',compute_type='int8',cpu_threads=4,local_files_only=True)
folder=root/'experiences/brand-opening/assets/cafe-voice'
bank=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
def normal(text):
    text=re.sub(r'([123])\s*잔',lambda m:{'1':'한','2':'두','3':'세'}[m.group(1)]+'잔',text)
    return re.sub(r'[^가-힣0-9]','',text)
rows=[]
for key,clip in bank['clips'].items():
    if args.subset and key not in args.subset.split(','):continue
    segments,info=model.transcribe(str(folder/clip['file']),language='ko',beam_size=5,condition_on_previous_text=False,vad_filter=False)
    actual=' '.join(s.text.strip() for s in segments)
    rows.append({'id':key,'expected':clip['text'],'recognized':actual,'exactNormalizedMatch':normal(actual)==normal(clip['text']),'sha256':hashlib.sha256((folder/clip['file']).read_bytes()).hexdigest()})
    print(key+': '+actual,flush=True)
report={'model':'cached local small' if args.small else 'cached local medium' if args.medium else 'cached local large-v3-turbo','network':False,'humanListening':False,'clips':rows,'matched':sum(r['exactNormalizedMatch'] for r in rows)}
filename='speech-transcription-small.json' if args.small else 'speech-transcription-medium.json' if args.medium else 'speech-transcription.json'
(root/'experiences/synk-world-app/qa/cafe-complete-20261010'/filename).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'matched':report['matched'],'total':len(rows)},ensure_ascii=False),flush=True)

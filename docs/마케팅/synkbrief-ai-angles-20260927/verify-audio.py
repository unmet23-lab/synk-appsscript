"""ASR verification is evidence of intelligibility, not subjective listening approval."""
import json,re,subprocess
from pathlib import Path
from difflib import SequenceMatcher
import numpy as np
from faster_whisper import WhisperModel
ROOT=Path(__file__).resolve().parent
timing=json.loads((ROOT/'audio-timing.json').read_text(encoding='utf-8'))
file=ROOT/'assets/audio/narration.wav'
raw=subprocess.run(['ffmpeg','-v','error','-i',str(file),'-f','f32le','-ar','16000','-ac','1','-'],check=True,capture_output=True).stdout
model=WhisperModel('mobiuslabsgmbh/faster-whisper-large-v3-turbo',device='cpu',compute_type='int8')
segments,info=model.transcribe(np.frombuffer(raw,dtype=np.float32),language='ko',beam_size=5,vad_filter=True,vad_parameters={'min_silence_duration_ms':350},condition_on_previous_text=False,word_timestamps=True)
segments=list(segments)
actual=' '.join(s.text.strip() for s in segments)
expected=' '.join(s['text'] for s in timing['segments']).replace('AI','에이아이').replace('synk','싱크')
norm=lambda s:re.sub(r'[^가-힣a-z0-9]','',s.lower().replace('ai','에이아이').replace('synk','싱크'))
report={'expected':expected,'transcript':actual,'normalizedSimilarity':SequenceMatcher(None,norm(expected),norm(actual)).ratio(),'asrModel':'faster-whisper-large-v3-turbo','directListeningVerified':False,'segments':[{'start':s.start,'end':s.end,'text':s.text.strip(),'averageLogProbability':s.avg_logprob} for s in segments]}
(ROOT/'verification').mkdir(exist_ok=True)
(ROOT/'verification/audio-asr.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))

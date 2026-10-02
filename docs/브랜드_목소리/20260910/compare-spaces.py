from pathlib import Path
import hashlib
import json
import shutil
import sys
import time
from gradio_client import Client, handle_file
if hasattr(sys.stdout,'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
BASE=Path(__file__).resolve().parent
TEXT='같이 들어볼까요? 좋아요, 이번에는 조금 다르게 해볼게요. 작은 차이가 모이면, 우리만의 목소리가 돼요.'
STYLE='A native Korean adult woman with a naturally bright, fresh, lightly smiling conversational voice. Warm rounded vocal body and clear smooth consonants. Keep lively gentle energy through sentence endings, with short natural breaths and an engaging comfortable pace. Friendly and confident, never childish, shrill, theatrical, whispery or like a loud announcer. A clean dry close studio recording, with no music or sound effects.'
SPECS={
 'qwen-sohee':('Qwen/Qwen3-TTS','/generate_custom_voice',{'text':TEXT,'language':'Korean','speaker':'Sohee','instruct':STYLE,'model_size':'1.7B'}),
 'qwen-design':('Qwen/Qwen3-TTS','/generate_voice_design',{'text':TEXT,'language':'Korean','voice_description':STYLE}),
 'voxcpm2-design':('openbmb/VoxCPM-Demo','/generate',{'text_input':TEXT,'control_instruction':STYLE,'reference_wav_path_input':None,'use_prompt_text':False,'prompt_text_input':'','cfg_value_input':2,'do_normalize':False,'denoise':False}),
 'chatterbox-v3':('ResembleAI/Chatterbox-Multilingual-TTS-V3','/generate_tts_audio',{'text_input':TEXT,'audio_prompt_path_input':handle_file(str(BASE/'실험'/'qwen-design'/'raw.wav')),'language_id_input':'ko','exaggeration_input':.5,'temperature_input':.8,'seed_num_input':42,'cfgw_input':.5}),
 'moss-nano':('OpenMOSS-Team/MOSS-TTS-Nano','/run_inference',{'text':TEXT,'prompt_audio_path':handle_file(str(BASE/'실험'/'qwen-design'/'raw.wav')),'enable_wetext_processing':False,'enable_normalize_tts_text':False,'max_new_frames':375,'voice_clone_max_text_tokens':75,'do_sample':True,'text_temperature':1.0,'text_top_p':1.0,'text_top_k':50,'audio_temperature':.8,'audio_top_p':.95,'audio_top_k':25,'audio_repetition_penalty':1.2,'seed':42}),
 'magpie-aria':('nvidia/magpie_tts_multilingual_demo','/demo_tts',{'input_text':TEXT,'language':'Korean','speaker':'Aria','apply_TN':'Do not apply TN'}),
}
REFERENCES={}
def main():
    for key in sys.argv[1:]:
        space,api,parameters=SPECS[key]
        dest=BASE/'실험'/key
        dest.mkdir(parents=True,exist_ok=True)
        if (dest/'manifest.json').exists():
            previous=json.loads((dest/'manifest.json').read_text(encoding='utf-8'))
            if previous.get('status')=='completed':
                print(json.dumps({'candidate':key,'status':'completed sample preserved'}),flush=True)
                continue
            shutil.copyfile(dest/'manifest.json',dest/('attempt-'+str(int(time.time()))+'.json'))
        record={'candidate':key,'space':space,'api':api,'parameters':parameters,'text':TEXT,'synthetic':True,'privateReferenceUploaded':False,'higgsfieldUsed':False,'humanListening':False,'startedAt':time.time()}
        if key in ('chatterbox-v3','moss-nano') or key in REFERENCES:
            ref=REFERENCES.get(key,BASE/'실험'/'qwen-design'/'raw.wav')
            record['reference']={'type':'original synthetic voice created for this comparison; not an identified person','file':str(ref),'sha256':hashlib.sha256(ref.read_bytes()).hexdigest(),'origin':'Qwen3-TTS VoiceDesign official demo'}
        try:
            client=Client(space,verbose=False,download_files=str(dest/'download'))
            start=time.monotonic()
            job=client.submit(**parameters,api_name=api)
            last=None
            while not job.done():
                status=job.status()
                msg=str(status.code)
                if msg!=last:
                    print(json.dumps({'candidate':key,'status':msg,'queueRank':status.rank},ensure_ascii=False),flush=True)
                    last=msg
                if time.monotonic()-start>300:
                    record['cancelRequested']=job.cancel()
                    raise TimeoutError('Public demo did not finish within five minutes; no new submission')
                time.sleep(3)
            output=job.result()
            result=output[0] if isinstance(output,(list,tuple)) else output
            record['providerMessage']=output[1] if isinstance(output,(list,tuple)) and len(output)>1 else None
            if not result or not isinstance(result,str) or not Path(result).is_file():
                raise RuntimeError('No audio returned: '+str(record['providerMessage']))
            target=dest/'raw.wav'
            if target.exists():
                raise RuntimeError('Existing sample preserved; use a new candidate key')
            shutil.copyfile(result,target)
            record.update(status='completed',file=str(target),sha256=hashlib.sha256(target.read_bytes()).hexdigest(),elapsedSeconds=time.monotonic()-start)
        except Exception as e:
            record.update(status='unavailable',error=str(e))
        (dest/'manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({k:record.get(k) for k in ['candidate','status','file','error','providerMessage']},ensure_ascii=False),flush=True)
if __name__=='__main__':
    main()

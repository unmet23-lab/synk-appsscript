from pathlib import Path
from gradio_client import Client, handle_file
import hashlib,json,shutil,time

base=Path(__file__).resolve().parent
dest=base/'실험'/'a-confucius4'
ref=base/'실험'/'qwen-fresh-sparkle'/'raw.wav'
text='같이 들어볼까요? 좋아요, 이번에는 조금 다르게 해볼게요. 작은 차이가 모이면, 우리만의 목소리가 돼요.'
record={'candidate':'a-confucius4','space':'https://confucius4-tts.youdao.com/gradio/','text':text,'synthetic':True,'privateReferenceUploaded':False,'higgsfieldUsed':False,'humanListening':False,'reference':{'type':'original synthetic voice, not an identified person','file':str(ref),'sha256':hashlib.sha256(ref.read_bytes()).hexdigest(),'origin':'Qwen official VoiceDesign demo'},'startedAt':time.time()}
try:
    if (dest/'raw.wav').exists():
        raise RuntimeError('Existing generated audio is preserved')
    if (dest/'manifest.json').exists():
        shutil.copyfile(dest/'manifest.json',dest/'attempt-api-info-mismatch.json')
    client=Client(record['space'],verbose=False,download_files=str(dest/'download'),httpx_kwargs={'timeout':30})
    # Public API names and visible input labels observed in the current official config.
    dependencies=[d for d in client.config['dependencies'] if d.get('api_name')=='_gradio_predict' and d.get('show_api') is True]
    if len(dependencies)!=1:
        raise RuntimeError('Expected public generation endpoint is no longer advertised')
    inputs={c['id']:c['type'] for c in client.config['components']}
    if [inputs[i] for i in dependencies[0]['inputs']]!=['textbox','dropdown','audio','state']:
        raise RuntimeError('Public generation inputs changed; no submission')
    record['api']='/_gradio_predict'
    record['parameters']={'text':text,'language':'ko','reference_audio':str(ref)}
    record['apiInfoMismatch']='API help listed /_preset_gradio_predict, current public app config instead advertised /_gradio_predict with text, language, reference audio and internal State.'
    job=client.submit(text,'ko',handle_file(str(ref)),api_name=record['api'])
    start=time.monotonic()
    while not job.done():
        if time.monotonic()-start>180:
            record['cancelRequested']=job.cancel()
            raise TimeoutError('Three-minute bound reached; no resubmission')
        time.sleep(3)
    output=job.result()
    print(str(output),flush=True)
    audio=output[0]
    if not audio or not Path(audio).is_file():
        raise RuntimeError('No audio returned: '+str(output[1:]))
    shutil.copyfile(audio,dest/'raw.wav')
    record.update(status='completed',providerMessage=str(output[1:]),file=str(dest/'raw.wav'),sha256=hashlib.sha256((dest/'raw.wav').read_bytes()).hexdigest())
except Exception as error:
    record.update(status='unavailable',error=str(error))
(dest/'manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:record.get(k) for k in ['candidate','status','file','error']},ensure_ascii=True),flush=True)

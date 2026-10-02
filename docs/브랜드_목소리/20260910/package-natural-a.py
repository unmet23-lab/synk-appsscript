from pathlib import Path
import hashlib,json,zipfile

base=Path(__file__).resolve().parent
labels=[('A_기준','qwen-fresh-sparkle'),('A1_음색참조','a-natural-identity'),('A2_음성과대본참조','a-natural-context'),('A3_일상대화체','a-natural-flow')]
items={}
checks=[]
for label,key in labels:
    q=json.loads((base/'실험'/key/'inspection.json').read_text(encoding='utf-8'))
    raw=Path(q['rawFile']).read_bytes()
    audio=Path(q['listenFile']).read_bytes()
    assert hashlib.sha256(raw).hexdigest()==q['rawSha256']
    assert hashlib.sha256(audio).hexdigest()==q['listenSha256']
    assert q['characterSimilarity']==1
    assert abs(float(q['listenLoudness']['input_i'])+23)<.1
    assert float(q['listenLoudness']['input_tp'])<=-3
    items[label+'.wav']=audio
    checks.append({'label':label,'candidate':key,'rawSha256':q['rawSha256'],'listenSha256':q['listenSha256'],'duration':float(q['probe']['format']['duration']),'sampleRate':int(q['probe']['streams'][0]['sample_rate']),'LUFS':float(q['listenLoudness']['input_i']),'truePeak':float(q['listenLoudness']['input_tp']),'actual':q['actual'],'characterSimilarity':q['characterSimilarity']})
assert checks[0]['rawSha256']=='798eb1e01a4f99eaca44f939e596b07add412b4e181e864dfcf9309929263148'
items['비교안내.md']=(base/'A_자연스러움.md').read_bytes()
target=base/'A_자연스러움_비교.zip'
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for name,body in items.items():
        z.writestr(name,body)
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    assert set(z.namelist())==set(items)
    for name,body in items.items():
        assert z.read(name)==body
record={'status':'file-and-transcription-checks-passed','humanListening':False,'brandVoiceSelected':False,'userDirection':'A tone is preferred; improve artificial sentence-final intonation and machine-like pronunciation/timbre','processing':'fixed gain only, no EQ, denoising, compression, tempo edits or resampling','samples':checks,'zip':{'file':str(target),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'roundTripVerified':True,'newAudio':3,'baselineAudio':1}}
(base/'검증/A_자연스러움_검사.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(record,ensure_ascii=True))

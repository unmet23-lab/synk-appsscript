"""Generate original Korean narration with word timing; retain sources and build aligned WAV.

Existing Edge TTS route, no account or payment changes. Run from any cwd.
"""
import asyncio, json, math, re, subprocess
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent
AUDIO = ROOT / 'assets' / 'audio'
AUDIO.mkdir(parents=True, exist_ok=True)
LINES = [
    '사진은 한 장인데, 광고는 세 컷. 이 머그컵으로 직접 만들어봤어요.',
    '이미지 편집이 되는 AI에 제품 사진을 올리세요. 사진 속 제품의 모양이 잘 보여야 해요.',
    '먼저 바꾸면 안 되는 걸 적습니다. 제품의 모양, 색, 재질은 그대로. 글자는 추가하지 말아 주세요.',
    '그다음 세 장을 따로 요청하세요. 전체 컷은 빛으로 분위기를, 가까운 컷은 질감을, 사용 컷은 손과 소품으로 상황을 보여주세요.',
    '예쁘게 나와도 바로 쓰진 마세요. 원본과 나란히 놓고 손잡이, 색, 테두리가 달라졌는지 확인해요.',
    '세 컷을 짧게 이어 붙이면 끝. 프롬프트와 확인표도 준비했어요. 필요하시면 팔로우하시고 댓글에 싱크를 남겨주세요.',
]
CAPTION_CHUNKS = [
    ['사진은 한 장인데, 광고는 세 컷.', '이 머그컵으로 직접 만들어봤어요.'],
    ['이미지 편집이 되는 AI에', '제품 사진을 올리세요.', '사진 속 제품의 모양이', '잘 보여야 해요.'],
    ['먼저 바꾸면 안 되는 걸 적습니다.', '제품의 모양, 색, 재질은 그대로.', '글자는 추가하지 말아 주세요.'],
    ['그다음 세 장을 따로 요청하세요.', '전체 컷은 빛으로 분위기를,', '가까운 컷은 질감을,', '사용 컷은 손과 소품으로', '상황을 보여주세요.'],
    ['예쁘게 나와도 바로 쓰진 마세요.', '원본과 나란히 놓고', '손잡이, 색, 테두리가', '달라졌는지 확인해요.'],
    ['세 컷을 짧게 이어 붙이면 끝.', '프롬프트와 확인표도 준비했어요.', '필요하시면 팔로우하시고', '댓글에 synk를 남겨주세요.'],
]
def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, encoding='utf-8', errors='replace').stdout
def duration(p):
    return float(run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(p)]).strip())
def display(s):
    return s.replace('에이아이','AI').replace('싱크','synk')
async def generate(i, text):
    key = f'voice-{i+1:02d}'
    target = AUDIO / (key + '.mp3')
    infofile = AUDIO / (key + '.json')
    if target.exists() and infofile.exists():
        saved = json.loads(infofile.read_text(encoding='utf-8'))
        if saved['text'] != text: raise RuntimeError('Cached text mismatch '+key)
        return
    spoken = text.replace('AI','에이아이')
    options = {'voice':'ko-KR-SunHiNeural','rate':'+0%','pitch':'+1Hz' if i == 0 else '+0Hz','boundary':'WordBoundary'}
    voice = edge_tts.Communicate(spoken, **options)
    words=[]
    with target.open('wb') as f:
        async for event in voice.stream():
            if event['type'] == 'audio': f.write(event['data'])
            elif event['type'] == 'WordBoundary':
                words.append({'text':event['text'],'start':event['offset']/1e7,'end':(event['offset']+event['duration'])/1e7})
    meta={'text':text,'spokenText':spoken,'provider':'edge-tts','settings':options,'duration':duration(target),'words':words}
    infofile.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'id':key,'duration':meta['duration'],'words':len(words)},ensure_ascii=False),flush=True)
async def main():
    for i,t in enumerate(LINES): await generate(i,t)
    start=0; segments=[]; captions=[]; allwords=[]; concat=[]; sentences=[]
    for i,text in enumerate(LINES):
        key=f'voice-{i+1:02d}'
        data=json.loads((AUDIO/(key+'.json')).read_text(encoding='utf-8'))
        lead=.3 if i==0 else 0
        tail=.3 if i==len(LINES)-1 else .35
        span=math.ceil((lead+data['duration']+tail)*30)/30
        block=AUDIO/(key+'-block.wav')
        run(['ffmpeg','-y','-v','error','-i',str(AUDIO/(key+'.mp3')),'-af',f'aresample=48000,adelay={round(lead*1000)}:all=1,apad,atrim=duration={span}','-ar','48000','-ac','2','-c:a','pcm_s16le',str(block)])
        concat.append("file '"+block.name+"'")
        words=[{'text':display(w['text']),'start':round(start+lead+w['start'],4),'end':round(start+lead+w['end'],4)} for w in data['words']]
        allwords+=words
        offset=0
        for chunk in CAPTION_CHUNKS[i]:
            count=len(chunk.split()); group=words[offset:offset+count]
            captions.append({'text':chunk,'start':group[0]['start'],'end':round(group[-1]['end']+.09,4),'segment':i+1})
            offset+=count
        assert offset==len(words), (i,offset,len(words))
        offset=0
        for sentence in re.findall(r'[^.!?]+[.!?]?',text):
            sentence=sentence.strip()
            if not sentence:continue
            count=len(sentence.split());group=words[offset:offset+count]
            sentences.append({'text':display(sentence),'start':group[0]['start'],'end':group[-1]['end'],'segment':i+1})
            offset+=count
        segments.append({'id':i+1,'start':round(start,4),'duration':round(span,4),'end':round(start+span,4),'voiceStart':round(start+lead,4),'voiceDuration':data['duration'],'text':display(text),'audio':f'assets/audio/{key}.mp3','words':words})
        start+=span
    for a,b in zip(captions,captions[1:]):a['end']=min(a['end'],b['start'])
    (AUDIO/'blocks.txt').write_text('\n'.join(concat)+'\n',encoding='utf-8')
    run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(AUDIO/'blocks.txt'),'-c:a','pcm_s16le',str(AUDIO/'narration.wav')])
    timing={'duration':round(start,4),'fps':30,'voice':'ko-KR-SunHiNeural','provider':'edge-tts','directListeningVerified':False,'segments':segments,'captions':captions,'sentences':sentences,'words':allwords}
    (ROOT/'audio-timing.json').write_text(json.dumps(timing,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    def fmt(t):
        ms=round(t*1000);return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
    (ROOT/'captions.srt').write_text('\n\n'.join(f'{n+1}\n{fmt(c["start"])} --> {fmt(c["end"])}\n{c["text"]}' for n,c in enumerate(captions))+'\n',encoding='utf-8')
    print(json.dumps({'totalDuration':round(start,4),'paragraphs':len(segments),'captions':len(captions)},ensure_ascii=False))
if __name__=='__main__':asyncio.run(main())

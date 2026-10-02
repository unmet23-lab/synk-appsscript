import asyncio, json, pathlib, subprocess
import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / 'audio'
OUT.mkdir(exist_ok=True)
LINES = [
    ('question', 'barista', '드시고 가세요, 가지고 가세요?'),
    ('yes', 'mongle', '네!'),
    ('thought', 'mongle', '어? 나 방금 뭐라고 한 거지?'),
    ('guide', 'guide', '잘 못 들었을 땐, 이렇게 말해 보세요.'),
    ('phrase', 'mongle', '다시 말해 주세요.'),
    ('repeat', 'guide', '한 번 따라 말해 볼까요?'),
    ('easy-question', 'barista', '여기서 드세요? 가져가세요?'),
    ('eat', 'mongle', '여기서 먹을게요.'),
    ('receipt', 'barista', '영수증 드릴까요?'),
    ('your-turn', 'guide', '이번엔 직접 말해 보세요.'),
    ('easy-receipt', 'barista', '영수증 필요하세요?'),
    ('thanks', 'mongle', '아, 괜찮아요. 감사합니다!'),
]
SETTINGS = {
    'barista': {'voice': 'ko-KR-SunHiNeural', 'rate': '+0%', 'pitch': '+0Hz'},
    'guide': {'voice': 'ko-KR-SunHiNeural', 'rate': '-3%', 'pitch': '-2Hz'},
    'mongle': {'voice': 'ko-KR-InJoonNeural', 'rate': '+0%', 'pitch': '+8Hz'},
}

def probe(p):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(p)],text=True).strip())

async def generate(line):
    name, role, text = line
    p, j = OUT / (name + '.mp3'), OUT / (name + '.json')
    if p.exists() and j.exists():
        return json.loads(j.read_text(encoding='utf-8'))
    settings = dict(SETTINGS[role])
    if name == 'phrase':
        settings['rate'] = '-10%'
    words = []
    speech = edge_tts.Communicate(text, **settings, boundary='WordBoundary')
    with p.open('wb') as f:
        async for chunk in speech.stream():
            if chunk['type'] == 'audio':
                f.write(chunk['data'])
            elif chunk['type'] == 'WordBoundary':
                words.append({'text':chunk['text'],'start':chunk['offset']/1e7,'end':(chunk['offset']+chunk['duration'])/1e7})
    result = {'id':name,'role':role,'text':text,'provider':'Microsoft Edge TTS','settings':settings,'path':str(p),'duration':probe(p),'words':words}
    j.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'id':name,'duration':result['duration']},ensure_ascii=False),flush=True)
    return result

async def main():
    sem = asyncio.Semaphore(3)
    async def limited(line):
        async with sem:
            return await generate(line)
    results = await asyncio.gather(*(limited(line) for line in LINES))
    (OUT/'speech.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__ == '__main__':
    asyncio.run(main())

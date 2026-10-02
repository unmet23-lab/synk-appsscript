import json, math, subprocess
from pathlib import Path
root = Path(__file__).resolve().parent
base = root.parent / 'video-v17'
data = json.loads((root/'audio/ending-follow.json').read_text(encoding='utf-8'))
script = json.loads((root/'extra-narration-script.json').read_text(encoding='utf-8'))
assert data['request']['text'] == script['segments'][0]['text']
assert data['request']['voice_id'] == script['voice']['id']
timing = json.loads((base/'voice-timing.json').read_text(encoding='utf-8'))
scenes = json.loads((root/'content.json').read_text(encoding='utf-8'))
ending = next(c for c in timing['clips'] if c['id'] == 'ending')
start = ending['start']
duration = math.ceil(max(9, .22 + data['audio_duration'] + .35)*30)/30
next(s for s in scenes if s['id']=='ending')['duration'] = duration
def ff(*args):
    subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error',*map(str,args)],check=True)
ff('-i',base/'audio/narration.wav','-af',f'atrim=end={start},asetpts=PTS-STARTPTS','-ar',48000,'-ac',2,'-c:a','pcm_s16le',root/'audio/before-ending.wav')
ff('-i',root/'audio/ending-follow.wav','-af',f'aresample=48000,adelay=220:all=1,apad,atrim=duration={duration}','-ar',48000,'-ac',2,'-c:a','pcm_s16le',root/'audio/block-ending-follow.wav')
(root/'audio/ending-concat.txt').write_text("file 'before-ending.wav'\nfile 'block-ending-follow.wav'\n",encoding='utf-8')
ff('-f','concat','-safe',0,'-i',root/'audio/ending-concat.txt','-c:a','pcm_s16le',root/'audio/narration.wav')
captions = [c for c in timing['captions'] if c['start'] < start]
group=[]
def flush():
    if not group: return
    text=' '.join(w['text'] for w in group).replace('피디에프','PDF').replace('싱크','synk')
    captions.append({'text':text,'start':start+.22+group[0]['start'],'end':min(start+duration-.12,start+.22+group[-1]['end']+.1)})
    group.clear()
for word in data['words']:
    if group and (len(' '.join(w['text'] for w in [*group,word])) > 32 or word['end']-group[0]['start'] > 4): flush()
    group.append(word)
    if word['text'].endswith(('.', '?', '!')): flush()
flush()
for i in range(len(captions)-1):
    if captions[i]['start'] >= start:
        captions[i]['end'] = min(captions[i]['end'], captions[i+1]['start'])
timing.update(duration=start+duration,captions=captions)
timing['clips'][-1]={'id':'ending','start':start,'duration':duration,'voiceStart':start+.22,'voiceDuration':data['audio_duration']}
(root/'content.json').write_text(json.dumps(scenes,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'voice-timing.json').write_text(json.dumps(timing,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def srt(t):
    ms=round(t*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'
(root/'narration.srt').write_text('\n'.join(f"{i}\n{srt(c['start'])} --> {srt(c['end'])}\n{c['text']}\n" for i,c in enumerate(captions,1)),encoding='utf-8')
print(json.dumps({'duration':timing['duration'],'ending':duration,'captions':len(captions)},ensure_ascii=False))

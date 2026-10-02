from pathlib import Path
import json,hashlib,math
out=Path('docs/라디오/곡제목_모음집_20260927');new=json.loads(Path('C:/Users/q1212/Documents/SYNK-radio-20260926/manifest.json').read_text(encoding='utf8'))
old=json.loads((out/'matched-old11.json').read_text(encoding='utf8'));tracks=[];start=0
for i,x in enumerate(new['songs']):
 if i: start-=3
 tracks.append({'start':start,'title':x['title']});start+=x['duration_seconds']
assert abs(start-new['duration_seconds'])<.001
start=new['duration_seconds'];names={'시티팝 1':'노을빛 드라이브','시티팝 2':'너와 걷던 여름밤','시티팝 3':'Golden Hour Beach','펑크 1':'Neon Bittersweet','Autumn Sea Hush (1)':'Autumn Sea Hush (Version 2)'}
for x in old:
 sec=max(0,x['start'])
 if x['title']=='Autumn Sea Hush':sec+=6 # The old nine-song loop already trimmed its first six seconds.
 tracks.append({'start':round(start+sec,6),'title':names.get(x['title'],x['title'])})
playlist='ffconcat version 1.0\nfile synk-radio-new8-20260926.flac\nduration 1819.935397\nfile synk-radio-blok11-20260909-gapless.flac\nduration 1701.192199546\n'
m={'duration':1819.935397+1701.192199546,'playlistSha256':hashlib.sha256(playlist.encode()).hexdigest(),'tracks':tracks,'sourceNotes':'New8 normalized source durations minus 3s crossfades; old11 waveform correlation >0.993. Autumn Sea Hush starts at its already-trimmed 6s position.'}
(out/'now-playing.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf8')
def timestamp(s):
 s=math.floor(s);return f'{s//60:02d}:{s%60:02d}'
chapters='\n'.join(timestamp(x['start'])+' '+x['title'] for x in tracks)
(out/'chapters.txt').write_text(chapters+'\n',encoding='utf8')
meta={'snippet':{'title':'SYNK Radio | 음악은 켜 두고 · 19곡 모음집','description':'SYNK Radio에서 흐르는 19곡을 한 번씩 담았습니다.\n듣고 싶은 곡의 시간을 누르면 바로 이동할 수 있어요.\n\n🎧 24시간 라디오\nhttps://www.youtube.com/watch?v=mP3T7Sabeh4\n\n곡 목록 / Tracklist\n'+chapters+'\n\n음악 · SYNK PULSE (Suno로 제작)\nhttps://synk.im/','categoryId':'10','defaultLanguage':'ko','tags':['SYNK Radio','SYNK PULSE','city pop','chill','공부 음악','작업 음악']},'status':{'privacyStatus':'unlisted','selfDeclaredMadeForKids':False}}
(out/'upload-metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf8')
concat="ffconcat version 1.0\nfile 'C:/Users/q1212/Documents/SYNK-radio-20260926/소리/synk-radio-new8-20260926.flac'\nfile 'old11.flac'\n"
(out/'audio.ffconcat').write_text(concat,encoding='utf8')
def ass_time(s):
 cs=round(s*100);return f'{cs//360000}:{cs//6000%60:02d}:{cs//100%60:02d}.{cs%100:02d}'
ass='''[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,SUIT,21,&H00EDF8FF,&H00EDF8FF,&H20251F18,&H20251F18,0,0,0,0,100,100,0.2,0,3,10,0,1,48,48,40,1
Style: Brand,SUIT,15,&H00EDF8FF,&H00EDF8FF,&H20251F18,&H20251F18,0,0,0,0,100,100,1,0,3,6,0,7,48,48,40,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
ass+=f'Dialogue: 0,0:00:00.00,{ass_time(m["duration"])},Brand,,0,0,0,,SYNK RADIO\n'
for i,x in enumerate(tracks):
 end=tracks[i+1]['start'] if i+1<len(tracks) else m['duration']
 ass+=f'Dialogue: 0,{ass_time(x["start"])},{ass_time(end)},Title,,0,0,0,,{x["title"]}\n'
(out/'titles.ass').write_text(ass,encoding='utf8')
print(chapters);print(m['duration'])

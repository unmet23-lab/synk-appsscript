from pathlib import Path
import json, html

P = Path(__file__).resolve().parent
C = P / 'compositions'
C.mkdir(exist_ok=True)
# Replace only the generated scene files owned by this builder.
scenes = [
    dict(id='hook', name='01-hook', duration=8.5, src='shot-01.mp4', offset=0,
         captions=[(0,1.94,'드시고 가세요? 가지고 가세요?'),(2.35,.88,'네!',True),(3.4,1.24,'어느 쪽이요?'),(5.93,1.85,'다시 말해 주세요.',True)]),
    dict(id='practice',name='02-practice',duration=3.5),
    dict(id='understand',name='03-understand',duration=7.85,src='shot-02-03.mp4',offset=0,
         captions=[(.4,1.04,'여기서 드세요?'),(1.78,1.1,'가져가세요?'),(3.97,1.56,'여기서 먹을게요.',True),(6.1,1.6,'영수증 드릴까요?')]),
    dict(id='yourturn',name='04-your-turn',duration=4.5),
    dict(id='answer',name='05-answer',duration=11.15,src='shot-02-03.mp4',offset=10.5,videoDuration=7.7,
         captions=[(.45,1.8,'다시 말해 주세요.',True),(2.54,1.55,'영수증 필요하세요?'),(4.4,1.4,'아, 괜찮아요.',True),(6.02,1.4,'감사합니다!',True)])
]
config=P/'timing-overrides.json'
if config.exists():
    overrides=json.loads(config.read_text(encoding='utf-8-sig'))
    for s in scenes: s.update(overrides.get(s['id'],{}))

def clip(id,start,dur,body,cls='',track=3):
    return f'<div id="{id}" class="clip {cls}" data-start="{start}" data-duration="{dur}" data-track-index="{track}">{body}</div>'

common='''
@font-face {font-family:SUIT;src:url('assets/SUIT-Variable.woff2') format('woff2');font-weight:100 900}
* {box-sizing:border-box} #root {position:absolute;inset:0;width:100%;height:100%;background:#fff;color:#000;overflow:hidden;font-family:SUIT,sans-serif}
.footage {position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.caption {position:absolute;left:70px;top:1330px;width:880px;text-align:center;}
.caption-inner {display:inline-block;max-width:880px;background:#000;color:#fff;padding:19px 30px 24px;border-radius:16px;font-size:59px;font-weight:750;line-height:1.22;letter-spacing:-1.5px;}
.customer .caption-inner {background:#fff;color:#000;border:2px solid #000}
.eyebrow {font-size:37px;font-weight:650;line-height:1.35;letter-spacing:-.6px}
.big {font-size:94px;font-weight:850;line-height:1.16;letter-spacing:-4px;margin:0}
.support {font-size:41px;font-weight:580;line-height:1.5;letter-spacing:-1px}
.paper {position:absolute;background:#fff;color:#000}
.underline {display:inline-block;border-bottom:10px solid #d76556;padding-bottom:5px}
.track {width:800px;height:10px;background:#dadada;overflow:hidden;border-radius:10px}
.fill {width:100%;height:100%;background:#000;transform-origin:left center}
'''
for s in scenes:
    body=[]; anim=[]; sid=s['id']; dur=s['duration']
    if s.get('src'):
        vd=s.get('videoDuration',dur)
        body += [f'<video id="{sid}-video" class="clip footage" data-start="0" data-duration="{vd}" data-track-index="0" data-media-start="{s["offset"]}" src="assets/{s["src"]}" muted playsinline></video>']
    for j,cap in enumerate(s.get('captions',[])):
        a,b,txt=cap[:3]; customer=len(cap)>3 and cap[3]
        cid=f'{sid}-cap{j}'
        body.append(clip(cid,a,b,f'<div class="caption-inner">{html.escape(txt)}</div>','caption'+(' customer' if customer else '')))
        anim.append(f'tl.fromTo("#{cid} .caption-inner",{{opacity:0,y:12,scale:.97}},{{opacity:1,y:0,scale:1,duration:.16,ease:"power3.out",immediateRender:false}},{a});')
    if sid=='hook':
        body.append(clip('hook-title',0,2.25,'<div class="paper" style="left:70px;top:245px;padding:25px 30px 29px;border-radius:18px;font-size:60px;line-height:1.18;font-weight:820;letter-spacing:-2px">못 알아들었는데<br>일단 “네”?</div>','',4))
        body.append(clip('hook-thought',4.65,1.25,'<div class="paper" style="left:70px;top:280px;padding:20px 27px;border-radius:14px;font-size:43px;font-weight:700">대답은 했는데…</div>','',4))
        anim.append('tl.fromTo("#hook-title .paper",{y:-12,opacity:0},{y:0,opacity:1,duration:.25,ease:"power3.out"},0);')
    elif sid=='practice':
        body.append(clip('practice-card',0,dur,'<div class="paper" style="inset:0"><div class="eyebrow" style="position:absolute;left:90px;top:510px">못 들었을 때는</div><div class="big" style="position:absolute;left:90px;top:680px">다시<br><span class="underline">말해 주세요.</span></div><div class="support" style="position:absolute;left:90px;top:1070px">한 번 더 말해 달라는<br>부탁이에요.</div><div class="track" style="position:absolute;left:90px;top:1370px"><div class="fill"></div></div></div>','',0))
        anim+=['tl.fromTo("#practice-card .big",{opacity:0,y:28,scale:.97},{opacity:1,y:0,scale:1,duration:.42,ease:"power3.out"},.05);', 'tl.fromTo("#practice-card .support",{opacity:0,y:12},{opacity:1,y:0,duration:.25,ease:"power2.out"},.32);', f'tl.fromTo("#practice-card .fill",{{scaleX:0}},{{scaleX:1,duration:{dur-.4},ease:"none"}},.2);']
    elif sid=='understand':
        body.append(clip('understand-tag',0,2.9,'<div class="paper" style="left:70px;top:250px;padding:20px 27px;border-radius:14px;font-size:40px;font-weight:700">이번엔 천천히 들어볼까요?</div>','',4))
    elif sid=='yourturn':
        body.append(clip('quiz-card',0,dur,'<div class="paper" style="inset:0"><div class="eyebrow" style="position:absolute;left:90px;top:460px">이번에는 당신 차례</div><div class="big" style="position:absolute;left:90px;top:625px;font-size:82px">또 못 들었어요.<br>뭐라고 할까요?</div><div class="support" style="position:absolute;left:90px;top:1040px">소리 내서 말해 보세요.</div><div class="track" style="position:absolute;left:90px;top:1285px"><div class="fill"></div></div></div>','',0))
        anim+=['tl.fromTo("#quiz-card .big",{opacity:0,y:25},{opacity:1,y:0,duration:.34,ease:"power3.out"},0);', f'tl.fromTo("#quiz-card .fill",{{scaleX:0}},{{scaleX:1,duration:{dur-.5},ease:"none"}},.3);']
        for i in range(3):
            body.append(clip(f'count-{i}',1.25+i,1,f'<div style="position:absolute;left:90px;top:1375px;font-size:80px;font-weight:800">{3-i}</div>','',4))
    elif sid=='answer':
        end=s.get('videoDuration',7.7)
        body.append(clip('end-card',end,dur-end,'<div class="paper" style="inset:0"><div class="eyebrow" style="position:absolute;left:90px;top:485px">못 들었을 때, 이 한마디.</div><div class="big" style="position:absolute;left:90px;top:680px">다시<br><span class="underline">말해 주세요.</span></div><div class="support" style="position:absolute;left:90px;top:1120px">모르면, 다시 물어봐도 괜찮아요.</div></div>','',5))
        anim += [f'tl.fromTo("#end-card .big",{{opacity:0,y:22}},{{opacity:1,y:0,duration:.35,ease:"power3.out",immediateRender:false}},{end});']
    text=f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body><template>
<style>{common}</style><div id="root" data-composition-id="{sid}" data-width="1080" data-height="1920" data-duration="{dur}">{''.join(body)}</div>
<script>(function(){{const tl=gsap.timeline({{paused:true}});{''.join(anim)}window.__timelines=window.__timelines||{{}};window.__timelines['{sid}']=tl;}})();</script>
</template></body></html>'''
    (C/f'{s["name"]}.html').write_text(text,encoding='utf-8')

start=0;hosts=[];ledger=[];audio=[]
for s in scenes:
    hosts.append(f'<div id="slot-{s["id"]}" class="clip" data-composition-id="{s["id"]}" data-composition-src="compositions/{s["name"]}.html" data-start="{start:.3f}" data-duration="{s["duration"]}" data-width="1080" data-height="1920" data-track-index="0"></div>')
    ledger.append(dict(scene=s['id'],start=round(start,3),end=round(start+s['duration'],3),src=s.get('src'),offset=s.get('offset')))
    if s.get('src'):
        audio.append(f'<audio id="{s["id"]}-voice" class="clip" data-start="{start:.3f}" data-duration="{s.get("videoDuration",s["duration"])}" data-track-index="1" data-media-start="{s["offset"]}" src="assets/{s["src"]}"></audio>')
    if s['id'] in ('practice','yourturn','answer'):
        local=s.get('videoDuration',0) if s['id']=='answer' else 0
        ad=s['duration']-local
        fade=html.escape(json.dumps({'version':1,'lanes':[{'target':'volume','points':[{'t':0,'v':0},{'t':.08,'v':.65},{'t':ad-.16,'v':.65},{'t':ad,'v':0}]}]}),quote=True)
        audio.append(f'<audio id="{s["id"]}-roomtone" class="clip" data-start="{start+local:.3f}" data-duration="{ad}" data-track-index="2" src="assets/cafe-roomtone.wav" data-automation="{fade}"></audio>')
    if s['id']=='practice':
        audio.append(f'<audio id="practice-repeat" class="clip" data-start="{start+.35:.3f}" data-duration="1.8" data-track-index="1" data-media-start="5.9" src="assets/shot-01.mp4"></audio>')
    start+=s['duration']
root=f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>SYNK LAB · 다시 말해 주세요</title><script src="assets/gsap.min.js"></script>
<style>@font-face{{font-family:SUIT;src:url('assets/SUIT-Variable.woff2') format('woff2');font-weight:100 900}}*{{box-sizing:border-box}}html,body{{margin:0;width:100%;height:100%;overflow:hidden;background:#fff}}#cafe{{position:relative;width:100%;height:100%;font-family:SUIT,sans-serif}}#brand{{position:absolute;left:70px;top:125px;width:240px;height:74px;background:#fff;padding:10px 12px;border-radius:10px}}#brand img{{width:100%;height:100%;object-fit:contain}}#episode{{position:absolute;left:635px;top:133px;background:#fff;padding:9px 17px;border-radius:8px;color:#000;font:650 29px SUIT}}
</style></head><body><main id="cafe" data-composition-id="cafe" data-width="1080" data-height="1920" data-duration="{start:.3f}" data-fps="24">{''.join(hosts)}<div id="brand" class="clip" data-start="0" data-duration="{start:.3f}" data-track-index="10"><img src="assets/lab-logo.png" alt="synk LAB"></div><div id="episode" class="clip" data-start="0" data-duration="{start:.3f}" data-track-index="10">카페 한국어 01</div></main><script>const tl=gsap.timeline({{paused:true}});window.__timelines=window.__timelines||{{}};window.__timelines.cafe=tl;</script></body></html>'''
root=root.replace('</main>', ''.join(audio)+'</main>')
(P/'index.html').write_text(root,encoding='utf-8')
(P/'edit-timeline.json').write_text(json.dumps(dict(duration=round(start,3),fps=24,scenes=ledger),ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Built {len(scenes)} scenes, {start:.2f}s')

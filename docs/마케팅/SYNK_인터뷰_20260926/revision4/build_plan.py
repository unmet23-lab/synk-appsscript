from pathlib import Path
import json

R=Path(__file__).resolve().parents[1]
V=R/'revision4'; G=V/'graphics'; G.mkdir(parents=True,exist_ok=True)
old=json.loads((R/'revision3/edit_plan.json').read_text(encoding='utf-8'))
byid={c['id']:c for c in old['cuts']}
oldrows=json.loads((R/'revision3/picture_plan.json').read_text(encoding='utf-8'))
oldov=json.loads((R/'revision3/overlay_plan.json').read_text(encoding='utf-8'))
oldcues=json.loads((R/'revision3/graphics/captions.json').read_text(encoding='utf-8'))
why_end=1323
boundary=V/'audio/why_boundary.json'
if boundary.exists(): why_end=json.loads(boundary.read_text(encoding='utf-8'))['end_local_frame']
questions=[
    '왜 이 시스템을 만들기 시작했나요?',
    '왜 TOPIK 4급이 중요한가요?',
    'AI 시대, 어떤 교육 철학이 필요한가요?',
    '기술이 만든 시간을 어떻게 쓰고 싶나요?',
]
sequence=[
    ('02_intro',0,None),('Q1',0,210),
    ('03_student',0,None),('04_care',0,None),('05_personal',0,None),('new_personal_design',135,None),
    ('Q2',0,210),('new_level4_reason',0,why_end),('new_accountability',0,None),
    ('Q3',0,210),('new_analogue',0,None),('01_hook',0,None),('06_human',0,None),('07_critical',0,None),
    ('10_philosophy',0,None),('11_experience',0,None),('12_growth',0,None),('13_education',0,None),('14_leader',0,None),
    ('Q4',0,210),('15_time',0,None),('16_invitation',0,None),('17_outro',0,None),
]
rows=[];overlays=[];cues=[];cuts=[];cursor=0
for cid,local_a,local_b in sequence:
    if cid.startswith('Q'):
        qi=int(cid[1:]); media=str(G/f'question_{qi:02d}_4K60.mov')
        cut=dict(id=cid,kind='question',question=questions[qi-1],output_start_frame=cursor,duration_frames=210,
            output_start=cursor/60,output_end=(cursor+210)/60,duration=3.5,media=media)
        rows.append(dict(id=cid,media=media,first=0,last=210,record=cursor,zoom=1.,pan=0.,tilt=0.,angle='NONE'))
        cuts.append(cut);cursor+=210;continue
    c=byid[cid];b=c['duration_frames'] if local_b is None else local_b
    a=c['output_start_frame']+local_a;z=c['output_start_frame']+b
    cut=dict(id=cid,kind='speech',prior_first=a,prior_last=z,prior_cut_local_first=local_a,prior_cut_local_last=b,
        output_start_frame=cursor,duration_frames=z-a,output_start=cursor/60,output_end=(cursor+z-a)/60,duration=(z-a)/60,
        approved_voice_source=str(R/'revision3/audio/dialogue_stem.wav'))
    cuts.append(cut)
    for row in oldrows:
        lo=max(a,row['record']);hi=min(z,row['record']+row['last']-row['first'])
        if hi<=lo:continue
        n=dict(row);n.update(id=cid+'__'+row['id'],first=row['first']+lo-row['record'],last=row['first']+hi-row['record'],record=cursor+lo-a)
        # A source pose change occurred at local F1319. If the final syllable
        # extends beyond it, hold the immediately preceding frame briefly.
        if cid=='new_level4_reason' and lo>=c['output_start_frame']+1319:
            n.update(id=cid+'__tail_hold',media=str(G/'why_tail_hold_4K60.mov'),first=0,last=hi-lo,zoom=1.,pan=0.,tilt=0.,angle='B')
        rows.append(n)
    for row in oldov:
        lo=max(a,row['record']);hi=min(z,row['record']+row['last']-row['first'])
        if hi<=lo:continue
        n=dict(row);n.update(first=row['first']+lo-row['record'],last=row['first']+hi-row['record'],record=cursor+lo-a,cut_id=cid)
        overlays.append(n)
    for q in oldcues:
        if q['cut_id']!=cid:continue
        start=q['start']*60;end=q['end']*60
        if end<=a+.01 or start>=z-.01:continue
        n=dict(q);n.update(id=len(cues)+1,prior_id=q['id'],start=(cursor+max(a,start)-a)/60,end=(cursor+min(z,end)-a)/60)
        assert n['end']-n['start']>.5,(cid,q)
        cues.append(n)
    cursor+=z-a
pos=0
for row in rows:
    assert row['record']==pos,(row,pos)
    pos+=row['last']-row['first']
assert pos==cursor
assert len(cues)==69,len(cues)
for x,y in zip(cues,cues[1:]):assert x['end']<=y['start']+.0001
plan=dict(fps=60,duration_frames=cursor,duration_seconds=cursor/60,cuts=cuts,
    source=str(R/'revision3/edit_plan.json'),note='V4: contextual question chapters, reordered approved speech, no added voice or stronger voice processing.',
    questions=questions,omitted_v3_cuts=['08_center','09_value'],why_end_local_frame=why_end)
for name,obj in [('edit_plan.json',plan),('picture_plan.json',rows),('overlay_plan.json',overlays),('graphics/captions.json',cues)]:
    (V/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
def stamp(s):
    ms=round(s*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'
(G/'SYNK_Structured_ko.srt').write_text('\n\n'.join(f"{q['id']}\n{stamp(q['start'])} --> {stamp(q['end'])}\n{q['text']}" for q in cues)+'\n',encoding='utf-8-sig')
print(json.dumps({'frames':cursor,'seconds':cursor/60,'cues':len(cues),'picture_rows':len(rows),'overlays':len(overlays),'why_end':why_end},indent=2))
print('\n'.join(f"{c['output_start']:7.3f} - {c['output_end']:7.3f} {c['id']}" for c in cuts))

from pathlib import Path
import json

R=Path(__file__).resolve().parents[1]; V=R/'revision4'
P='SYNK_Premium_4K60_Structured_v4_20260926'
O=Path(r'C:\Users\q1212\OneDrive\Desktop\SYNK_인터뷰_구성개선_v4');O.mkdir(exist_ok=True)
plan=json.loads((V/'edit_plan.json').read_text(encoding='utf-8'))
rows=json.loads((V/'picture_plan.json').read_text(encoding='utf-8'))
ov=json.loads((V/'overlay_plan.json').read_text(encoding='utf-8'))
N=plan['duration_frames']; cues=json.loads((V/'graphics/captions.json').read_text(encoding='utf-8'))
def ll(x):return '[['+str(x).replace('\\','/')+']]'
lr=['{id=%s,media=%s,first=%d,last=%d,record=%d,zoom=%.6f,pan=%.6f,tilt=%.6f,angle=%s}'%(ll(c['id']),ll(c['media']),c['first'],c['last'],c['record'],c['zoom'],c['pan'],c['tilt'],ll(c['angle'])) for c in rows]
lo=['{media=%s,first=%d,last=%d,record=%d}'%(ll(c['media']),c['first'],c['last'],c['record']) for c in ov]
base=str(R).replace('\\','/')
prepare=f'''local r=resolve or Resolve()
local pm=r:GetProjectManager()
local p=assert(pm:GetCurrentProject())
assert(not p:IsRenderingInProgress())
assert(pm:SaveProject())
assert(pm:ImportProject([[C:/Users/q1212/OneDrive/Desktop/SYNK_인터뷰_확장본_v3/SYNK_인터뷰_확장프로젝트_v3.drp]],'{P}'))
local n=assert(pm:LoadProject('{P}'))
print('STRUCTURED_PROJECT_READY',n:GetName(),n:GetTimelineCount())
'''
(V/'prepare_project.lua').write_text(prepare,encoding='utf-8')
code=r'''local r=resolve or Resolve()
local pm=r:GetProjectManager()
local p=assert(pm:GetCurrentProject())
assert(p:GetName()=='PROJECT_NAME')
assert(not p:IsRenderingInProgress())
p:SetSetting('perfRenderCacheMode','none');p:RefreshLUTList()
local mp=p:GetMediaPool()
for i=1,p:GetTimelineCount() do assert(p:GetTimelineByIndex(i):GetName()~='01_FINAL_4K60_v4','V4 already exists') end
local tl=assert(mp:CreateEmptyTimeline('01_FINAL_4K60_v4'))
assert(p:SetCurrentTimeline(tl));assert(tl:SetStartTimecode('00:00:00:00'))
while tl:GetTrackCount('video')<2 do assert(tl:AddTrack('video')) end
while tl:GetTrackCount('audio')<4 do assert(tl:AddTrack('audio','stereo')) end
tl:SetTrackName('video',1,'Interview / four question chapters')
tl:SetTrackName('video',2,'Approved Korean typography')
tl:SetTrackName('audio',1,'FINAL MIX - voice / Suno / soft typing')
tl:SetTrackName('audio',2,'Dialogue stem - reference')
tl:SetTrackName('audio',3,'Music stem - reference')
tl:SetTrackName('audio',4,'Typing stem - reference')
local pool={}
local function media(path)
 if not pool[path] then pool[path]=assert(mp:ImportMedia({path}))[1] end
 return pool[path]
end
assert(tl:AddTrack('subtitle'))
assert(mp:AppendToTimeline({{mediaPoolItem=media([[BASE/revision4/graphics/SYNK_Structured_ko.srt]]),recordFrame=0,trackIndex=1}}))
assert(tl:SetTrackEnable('subtitle',1,false));tl:SetTrackName('subtitle',1,'Editable Korean speech / 69 cues')
local cues=tl:GetItemListInTrack('subtitle',1)
assert(#cues==69 and cues[1]:GetStart()==2,'Subtitle count or origin')
local rows={ROWS}
for _,c in ipairs(rows) do
 local item=assert(mp:AppendToTimeline({{mediaPoolItem=media(c.media),startFrame=c.first,endFrame=c.last,mediaType=1,trackIndex=1,recordFrame=c.record}}))[1]
 assert(item:GetStart()==c.record and item:GetDuration()==c.last-c.first,'Picture '..c.id)
 if c.angle~='NONE' then assert(item:GetNodeGraph():SetLUT(1,'SYNK_Premium_20260926_v2/SYNK_R2_Bright_'..c.angle..'.cube')) end
 assert(item:SetProperties({ZoomX=c.zoom,ZoomY=c.zoom,Pan=c.pan,Tilt=c.tilt}))
 item:SetColorOutputCache(false)
 print('V4_PICTURE',c.id,item:GetStart(),item:GetEnd())
end
for i,name in ipairs({'final_mix','dialogue_stem','music_stem','sfx_stem'}) do
 local item=assert(mp:AppendToTimeline({{mediaPoolItem=media([[BASE/revision4/audio/]]..name..'.wav'),startFrame=0,endFrame=FRAMES,mediaType=2,trackIndex=i,recordFrame=0}}))[1]
 assert(item:GetStart()==0 and item:GetDuration()==FRAMES)
end
for i=2,4 do assert(tl:SetTrackEnable('audio',i,false)) end
assert(tl:GetEndFrame()==FRAMES)
local clean=assert(tl:DuplicateTimeline('03_CLEAN_v4'))
assert(p:SetCurrentTimeline(tl))
local overlays={OVERLAYS}
for _,o in ipairs(overlays) do
 local m=media(o.media);assert(m:SetClipProperty('Alpha mode','Premultiplied'))
 local item=assert(mp:AppendToTimeline({{mediaPoolItem=m,startFrame=o.first,endFrame=o.last,mediaType=1,trackIndex=2,recordFrame=o.record}}))[1]
 assert(item:GetStart()==o.record and item:GetDuration()==o.last-o.first)
end
local edit=assert(tl:DuplicateTimeline('02_EDITABLE_v4'))
assert(p:SetCurrentTimeline(edit))
assert(edit:SetTrackEnable('video',2,false));assert(edit:SetTrackEnable('subtitle',1,true))
assert(edit:SetTrackEnable('audio',1,false));for i=2,4 do assert(edit:SetTrackEnable('audio',i,true)) end
assert(edit:AddTrack('video'));edit:SetTrackName('video',3,'Opening name / philosophy title')
local title=media([[BASE/graphics/SYNK_Premium_TitlesOnly_4K60_alpha.mov]])
assert(title:SetClipProperty('Alpha mode','Premultiplied'))
assert(mp:AppendToTimeline({{mediaPoolItem=title,startFrame=558,endFrame=888,mediaType=1,trackIndex=3,recordFrame=0}}))
assert(mp:AppendToTimeline({{mediaPoolItem=title,startFrame=0,endFrame=558,mediaType=1,trackIndex=3,recordFrame=HOOK_FRAME}}))
assert(p:SetCurrentTimeline(tl))
local names={['01_FINAL_4K60_v3']='90_PREVIOUS_v3_FINAL',['02_EDITABLE_v3']='91_PREVIOUS_v3_EDITABLE',['03_CLEAN_v3']='92_PREVIOUS_v3_CLEAN',['04_PREVIOUS_v2']='93_PREVIOUS_v2',['05_SOURCE_COMPARISON']='94_SOURCE_COMPARISON'}
for i=1,p:GetTimelineCount() do local t=p:GetTimelineByIndex(i);if names[t:GetName()] then assert(t:SetName(names[t:GetName()])) end end
assert(tl:GetEndFrame()==FRAMES and #tl:GetItemListInTrack('video',1)==33)
assert(#tl:GetItemListInTrack('video',2)==19)
assert(not tl:GetIsTrackEnabled('subtitle',1))
assert(tl:GetIsTrackEnabled('audio',1));for i=2,4 do assert(not tl:GetIsTrackEnabled('audio',i)) end
assert(pm:SaveProject());r:OpenPage('edit');tl:SetCurrentTimecode('00:00:07:30')
print('STRUCTURED_TIMELINE_READY',tl:GetName(),tl:GetEndFrame(),p:GetTimelineCount(),#cues)
'''
hook=next(c for c in plan['cuts'] if c['id']=='01_hook')['output_start_frame']
for a,b in [('PROJECT_NAME',P),('BASE',base),('FRAMES',str(N)),('HOOK_FRAME',str(hook)),('ROWS',',\n'.join(lr)),('OVERLAYS',',\n'.join(lo))]:code=code.replace(a,b)
(V/'build_native.lua').write_text(code,encoding='utf-8')
render=(R/'revision3/render_expanded.lua').read_text(encoding='utf-8').replace('SYNK_Premium_4K60_Expanded_v3_20260926',P).replace('01_FINAL_4K60_v3','01_FINAL_4K60_v4').replace('15158',str(N)).replace('SYNK_인터뷰_확장본_v3','SYNK_인터뷰_구성개선_v4').replace('SYNK_인터뷰_확장본_4K60_v3','SYNK_인터뷰_구성개선_4K60_v4').replace('synkExpandedFinalJob','synkStructuredFinalJob').replace('EXPANDED_RENDER','STRUCTURED_RENDER')
render=render.replace("assert(not p:GetCurrentTimeline():GetIsTrackEnabled('audio',3))","assert(not p:GetCurrentTimeline():GetIsTrackEnabled('audio',3))\nassert(not p:GetCurrentTimeline():GetIsTrackEnabled('audio',4))")
(V/'render_structured.lua').write_text(render,encoding='utf-8')
export=f'''local r=resolve or Resolve()
local pm=r:GetProjectManager();local p=assert(pm:GetCurrentProject())
assert(p:GetName()=='{P}');assert(not p:IsRenderingInProgress())
local t=assert(p:GetCurrentTimeline());assert(t:GetName()=='01_FINAL_4K60_v4' and t:GetEndFrame()=={N})
assert(pm:SaveProject())
assert(pm:ExportProject(p:GetName(),{ll(O/'SYNK_인터뷰_구성개선_프로젝트_v4.drp')},true))
assert(t:Export({ll(O/'SYNK_인터뷰_구성개선_타임라인_v4.drt')},r.EXPORT_DRT))
print('STRUCTURED_EXPORTED',t:GetEndFrame(),p:GetTimelineCount())
'''
(V/'export_structured.lua').write_text(export,encoding='utf-8')
print('Native scripts prepared',N,len(rows),len(ov),len(cues))

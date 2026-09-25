local r=resolve or Resolve()
local pm=r:GetProjectManager()
local p=assert(pm:GetCurrentProject())
assert(p:GetName()=='SYNK_Premium_4K60_Structured_v4_20260926')
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
assert(mp:AppendToTimeline({{mediaPoolItem=media([[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/revision4/graphics/SYNK_Structured_ko.srt]]),recordFrame=0,trackIndex=1}}))
assert(tl:SetTrackEnable('subtitle',1,false));tl:SetTrackName('subtitle',1,'Editable Korean speech / 69 cues')
local cues=tl:GetItemListInTrack('subtitle',1)
assert(#cues==69 and cues[1]:GetStart()==2,'Subtitle count or origin')
local rows={{id=[[02_intro__02_intro]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_02_intro_4K60.mov]],first=0,last=330,record=0,zoom=1.000000,pan=-0.000000,tilt=0.000000,angle=[[A]]},
{id=[[Q1]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/revision4/graphics/question_01_4K60.mov]],first=0,last=210,record=330,zoom=1.000000,pan=0.000000,tilt=0.000000,angle=[[NONE]]},
{id=[[03_student__03_student]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_03_student_4K60.mov]],first=0,last=318,record=540,zoom=1.110000,pan=73.700000,tilt=-47.300000,angle=[[A]]},
{id=[[03_student__bridge_pre04]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/revision2_pre04_4K60.mov]],first=0,last=29,record=858,zoom=1.000000,pan=-0.000000,tilt=0.000000,angle=[[A]]},
{id=[[04_care__04_care]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_04_care_4K60.mov]],first=0,last=520,record=887,zoom=1.000000,pan=-0.000000,tilt=0.000000,angle=[[A]]},
{id=[[05_personal__05_personal]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_05_personal_4K60.mov]],first=0,last=430,record=1407,zoom=1.000000,pan=0.000000,tilt=0.000000,angle=[[B]]},
{id=[[new_personal_design__new_personal_design_part2]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/v3_new_personal_design_4K60.mov]],first=147,last=1137,record=1837,zoom=1.100000,pan=-8.000000,tilt=-43.000000,angle=[[B]]},
{id=[[Q2]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/revision4/graphics/question_02_4K60.mov]],first=0,last=210,record=2827,zoom=1.000000,pan=0.000000,tilt=0.000000,angle=[[NONE]]},
{id=[[new_level4_reason__new_level4_reason]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/v3_new_level4_reason_4K60.mov]],first=0,last=293,record=3037,zoom=1.000000,pan=-0.000000,tilt=-0.000000,angle=[[B]]},
{id=[[new_level4_reason__new_level4_reason_part2]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/v3_new_level4_reason_4K60.mov]],first=293,last=859,record=3330,zoom=1.080000,pan=-75.200000,tilt=-20.800000,angle=[[B]]},
{id=[[new_level4_reason__new_level4_reason_part3]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/v3_new_level4_reason_4K60.mov]],first=859,last=1319,record=3896,zoom=1.000000,pan=-0.000000,tilt=-0.000000,angle=[[B]]},
{id=[[new_level4_reason__tail_hold]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/revision4/graphics/why_tail_hold_4K60.mov]],first=0,last=5,record=4356,zoom=1.000000,pan=0.000000,tilt=0.000000,angle=[[B]]},
{id=[[new_accountability__new_accountability]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/v3_new_accountability_4K60.mov]],first=0,last=228,record=4361,zoom=1.000000,pan=-0.000000,tilt=-0.000000,angle=[[B]]},
{id=[[new_accountability__new_accountability_part2]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/v3_new_accountability_4K60.mov]],first=228,last=1128,record=4589,zoom=1.080000,pan=-6.400000,tilt=-34.400000,angle=[[B]]},
{id=[[Q3]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/revision4/graphics/question_03_4K60.mov]],first=0,last=210,record=5489,zoom=1.000000,pan=0.000000,tilt=0.000000,angle=[[NONE]]},
{id=[[new_analogue__new_analogue]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/v3_new_analogue_4K60.mov]],first=0,last=1113,record=5699,zoom=1.000000,pan=-0.000000,tilt=-0.000000,angle=[[B]]},
{id=[[01_hook__01_hook]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_01_hook_4K60.mov]],first=0,last=558,record=6812,zoom=1.040000,pan=26.800000,tilt=-17.200000,angle=[[A]]},
{id=[[06_human__06_human]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_06_human_4K60.mov]],first=0,last=398,record=7370,zoom=1.130000,pan=-10.400000,tilt=-55.900000,angle=[[B]]},
{id=[[07_critical__bridge_post06]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/revision2_post06_4K60.mov]],first=0,last=6,record=7768,zoom=1.130000,pan=-10.400000,tilt=-55.900000,angle=[[B]]},
{id=[[07_critical__07_critical]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_07_critical_4K60.mov]],first=6,last=1009,record=7774,zoom=1.020000,pan=13.400000,tilt=-8.600000,angle=[[A]]},
{id=[[10_philosophy__10_philosophy]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_10_philosophy_4K60.mov]],first=0,last=840,record=8777,zoom=1.110000,pan=73.700000,tilt=-47.300000,angle=[[A]]},
{id=[[11_experience__bridge_post10]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/revision2_post10_4K60.mov]],first=0,last=9,record=9617,zoom=1.110000,pan=73.700000,tilt=-47.300000,angle=[[A]]},
{id=[[11_experience__11_experience]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_11_experience_4K60.mov]],first=9,last=1297,record=9626,zoom=1.000000,pan=-0.000000,tilt=0.000000,angle=[[A]]},
{id=[[12_growth__12_growth]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_12_growth_4K60.mov]],first=0,last=632,record=10914,zoom=1.120000,pan=80.400000,tilt=-51.600000,angle=[[A]]},
{id=[[12_growth__bridge_pre13]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/revision2_pre13_4K60.mov]],first=0,last=29,record=11546,zoom=1.000000,pan=-0.000000,tilt=0.000000,angle=[[A]]},
{id=[[13_education__13_education]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_13_education_4K60.mov]],first=0,last=526,record=11575,zoom=1.000000,pan=-0.000000,tilt=0.000000,angle=[[A]]},
{id=[[14_leader__14_leader]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_14_leader_4K60.mov]],first=0,last=394,record=12101,zoom=1.120000,pan=80.400000,tilt=-51.600000,angle=[[A]]},
{id=[[Q4]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/revision4/graphics/question_04_4K60.mov]],first=0,last=210,record=12495,zoom=1.000000,pan=0.000000,tilt=0.000000,angle=[[NONE]]},
{id=[[15_time__15_time]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_15_time_4K60.mov]],first=0,last=846,record=12705,zoom=1.020000,pan=13.400000,tilt=-8.600000,angle=[[A]]},
{id=[[15_time__bridge_pre16]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/revision2_pre16_4K60.mov]],first=0,last=35,record=13551,zoom=1.110000,pan=73.700000,tilt=-47.300000,angle=[[A]]},
{id=[[16_invitation__16_invitation]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_16_invitation_4K60.mov]],first=0,last=591,record=13586,zoom=1.110000,pan=73.700000,tilt=-47.300000,angle=[[A]]},
{id=[[16_invitation__bridge_pre17]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/revision2_pre17_4K60.mov]],first=0,last=11,record=14177,zoom=1.000000,pan=-0.000000,tilt=0.000000,angle=[[A]]},
{id=[[17_outro__17_outro]],media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/portrait/cut_17_outro_4K60.mov]],first=0,last=372,record=14188,zoom=1.000000,pan=-0.000000,tilt=0.000000,angle=[[A]]}}
for _,c in ipairs(rows) do
 local item=assert(mp:AppendToTimeline({{mediaPoolItem=media(c.media),startFrame=c.first,endFrame=c.last,mediaType=1,trackIndex=1,recordFrame=c.record}}))[1]
 assert(item:GetStart()==c.record and item:GetDuration()==c.last-c.first,'Picture '..c.id)
 if c.angle~='NONE' then assert(item:GetNodeGraph():SetLUT(1,'SYNK_Premium_20260926_v2/SYNK_R2_Bright_'..c.angle..'.cube')) end
 assert(item:SetProperties({ZoomX=c.zoom,ZoomY=c.zoom,Pan=c.pan,Tilt=c.tilt}))
 item:SetColorOutputCache(false)
 print('V4_PICTURE',c.id,item:GetStart(),item:GetEnd())
end
for i,name in ipairs({'final_mix','dialogue_stem','music_stem','sfx_stem'}) do
 local item=assert(mp:AppendToTimeline({{mediaPoolItem=media([[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/revision4/audio/]]..name..'.wav'),startFrame=0,endFrame=14560,mediaType=2,trackIndex=i,recordFrame=0}}))[1]
 assert(item:GetStart()==0 and item:GetDuration()==14560)
end
for i=2,4 do assert(tl:SetTrackEnable('audio',i,false)) end
assert(tl:GetEndFrame()==14560)
local clean=assert(tl:DuplicateTimeline('03_CLEAN_v4'))
assert(p:SetCurrentTimeline(tl))
local overlays={{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=558,last=888,record=0},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=888,last=1235,record=540},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=1235,last=1755,record=887},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=1755,last=2185,record=1407},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/revision3/graphics/SYNK_v3_Additional_Captions_4K60_alpha.mov]],first=1248,last=2238,record=1837},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/revision3/graphics/SYNK_v3_Additional_Captions_4K60_alpha.mov]],first=3366,last=4690,record=3037},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/revision3/graphics/SYNK_v3_Additional_Captions_4K60_alpha.mov]],first=2238,last=3366,record=4361},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/revision3/graphics/SYNK_v3_Additional_Captions_4K60_alpha.mov]],first=0,last=1113,record=5699},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=0,last=558,record=6812},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=2185,last=2583,record=7370},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=2583,last=3592,record=7768},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=4692,last=5532,record=8777},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=5532,last=6829,record=9617},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=6829,last=7490,record=10914},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=7490,last=8016,record=11575},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=8016,last=8410,record=12101},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=8410,last=9291,record=12705},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=9291,last=9893,record=13586},
{media=[[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_Captions_Titles_4K60_alpha.mov]],first=9893,last=10265,record=14188}}
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
local title=media([[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/graphics/SYNK_Premium_TitlesOnly_4K60_alpha.mov]])
assert(title:SetClipProperty('Alpha mode','Premultiplied'))
assert(mp:AppendToTimeline({{mediaPoolItem=title,startFrame=558,endFrame=888,mediaType=1,trackIndex=3,recordFrame=0}}))
assert(mp:AppendToTimeline({{mediaPoolItem=title,startFrame=0,endFrame=558,mediaType=1,trackIndex=3,recordFrame=6812}}))
assert(p:SetCurrentTimeline(tl))
local names={['01_FINAL_4K60_v3']='90_PREVIOUS_v3_FINAL',['02_EDITABLE_v3']='91_PREVIOUS_v3_EDITABLE',['03_CLEAN_v3']='92_PREVIOUS_v3_CLEAN',['04_PREVIOUS_v2']='93_PREVIOUS_v2',['05_SOURCE_COMPARISON']='94_SOURCE_COMPARISON'}
for i=1,p:GetTimelineCount() do local t=p:GetTimelineByIndex(i);if names[t:GetName()] then assert(t:SetName(names[t:GetName()])) end end
assert(tl:GetEndFrame()==14560 and #tl:GetItemListInTrack('video',1)==33)
assert(#tl:GetItemListInTrack('video',2)==19)
assert(not tl:GetIsTrackEnabled('subtitle',1))
assert(tl:GetIsTrackEnabled('audio',1));for i=2,4 do assert(not tl:GetIsTrackEnabled('audio',i)) end
assert(pm:SaveProject());r:OpenPage('edit');tl:SetCurrentTimecode('00:00:07:30')
print('STRUCTURED_TIMELINE_READY',tl:GetName(),tl:GetEndFrame(),p:GetTimelineCount(),#cues)

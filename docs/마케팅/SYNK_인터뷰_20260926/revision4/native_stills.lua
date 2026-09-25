local r=resolve or Resolve()
local p=assert(r:GetProjectManager():GetCurrentProject())
assert(p:GetName()=='SYNK_Premium_4K60_Structured_v4_20260926')
local t=assert(p:GetCurrentTimeline());assert(t:GetName()=='01_FINAL_4K60_v4')
local cases={{'intro',120},{'question1',450},{'question3',5609},{'why_before_hold',4355},{'why_hold',4356}}
for _,s in ipairs(cases) do
 local f=s[2];local h=math.floor(f/216000);local m=math.floor(f/3600)%60;local sec=math.floor(f/60)%60;local frame=f%60
 local tc=string.format('%02d:%02d:%02d:%02d',h,m,sec,frame)
 assert(t:SetCurrentTimecode(tc))
 assert(p:ExportCurrentFrameAsStill([[C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/revision4/graphics/native_]]..s[1]..'.png'))
 print('V4_STILL',s[1],tc)
end
print('V4_STILLS_READY')

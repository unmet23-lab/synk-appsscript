const test=require('node:test');
const assert=require('node:assert/strict');
const {needsScheduleEdit}=require('../tools/hermes-synk/install-automation.cjs');
test('refreshing the source manifest preserves an unchanged official schedule',()=>{
  const job={schedule:{kind:'interval',minutes:5},script:'synk_automation.py',no_agent:true,deliver:'local',failure_deliver:'local',workdir:'C:/fixture'};
  assert.equal(needsScheduleEdit(job,'C:/fixture'),false);
  assert.equal(needsScheduleEdit({...job,schedule:{kind:'interval',minutes:10}},'C:/fixture'),true);
  assert.equal(needsScheduleEdit({...job,failure_deliver:'origin'},'C:/fixture'),true);
});

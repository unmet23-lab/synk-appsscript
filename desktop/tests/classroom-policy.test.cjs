const {test}=require('node:test'),assert=require('node:assert/strict');
const {classroomURL}=require('../src/classroom-policy.cjs'),origin='http://127.0.0.1:4295';
test('connected teacher and WORLD keep their own main documents',()=>{
  assert(classroomURL(origin+'/#teacher-key=local',origin,'teacher'));
  assert(classroomURL(origin+'/synk-account/local-world.html',origin,'world'));
  assert(!classroomURL(origin+'/synk-account/local-world.html',origin,'teacher'));
  assert(!classroomURL(origin+'/',origin,'world'));
  assert(!classroomURL(origin+'/synk-account/platform.html',origin,'world'));
});
test('WORLD game frames and API resources stay within the validated loopback origin',()=>{
  assert(classroomURL(origin+'/entry-check/',origin,'world',{frame:true}));
  assert(classroomURL(origin+'/api/student',origin,'world',{resource:true}));
  for(const url of ['https://example.com/','http://user:pass@127.0.0.1:4295/','http://127.0.0.1:4191/','file:///C:/secret','http://127.0.0.1.evil.invalid:4295/'])for(const role of ['world','teacher'])assert(!classroomURL(url,origin,role,{resource:true}),url);
});

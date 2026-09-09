'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {만들기}=require('../bots/오버레이/송출진척.js');
test('progress가 임의 chunk에서 잘려도 완성된 줄만 해석한다',()=>{
  let now=0;const p=만들기({지금:()=>now});
  p.받기('speed=0.9');p.받기('8x\nout_ti');now=4000;p.받기('me=00:00:03.200000\nframe=20\n');
  assert.equal(p.상태.speed,'0.98x');assert.equal(p.상태.out_time,'00:00:03.200000');
  now=33000;assert.equal(p.확인().재시작,false);
});
test('초기 60초는 기다리고 이후 30초 정체는 복구한다',()=>{
  let now=0;const p=만들기({지금:()=>now});
  now=59000;assert.equal(p.확인().재시작,false);
  now=60000;assert.equal(p.확인().재시작,true);
  p.받기('out_time=00:00:20.000000\n');
  now=89999;assert.equal(p.확인().재시작,false);
  now=90000;assert.equal(p.확인().재시작,true);
});
test('느리더라도 방송 시각이 진행하면 재시작하지 않는다',()=>{
  let now=0;const p=만들기({지금:()=>now});
  for(let i=1;i<=30;i++){now=i*10000;p.받기(`speed=0.20x\nout_time=00:00:${String(i).padStart(2,'0')}.000000\n`);assert.equal(p.확인().재시작,false);}
});
test('같은 시각 반복·역행·불완전값은 살아 있음으로 세지 않는다',()=>{
  let now=0;const p=만들기({지금:()=>now});
  now=60000;p.받기('out_time=00:00:40.000000\n');
  now=89000;p.받기('out_time=00:00:40.000000\nout_time=N/A\nout_time=00:00:39.000000\n');
  now=90000;assert.equal(p.확인().재시작,true);
});
test('진행 통계는 거르고 오류 문장은 호출자에게 반환한다',()=>{
  const p=만들기();assert.deepEqual(p.받기('frame=10\nstream_0_0_q=2\nBroken pipe\n'),['Broken pipe']);
});
test('초장문을 버릴 때 URL 뒤 조각도 다음 개행까지 함께 버린다',()=>{
  const p=만들기();
  assert.deepEqual(p.받기('x'.repeat(16380)+'rtmp://example.invalid/live/'),['[지나치게 긴 오류 줄 생략]']);
  assert.deepEqual(p.받기('DUMMY_TEST_SECRET'),[]);
  assert.deepEqual(p.받기('\nspeed=1.0x\n'),[]);
  assert.equal(p.상태.speed,'1.0x');
});
